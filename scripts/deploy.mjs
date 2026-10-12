/**
 * Deploy contracts/fieldwork.py.
 *
 *   node scripts/deploy.mjs            # ephemeral account (Studio, disposable)
 *   FEE_BPS=600 node scripts/deploy.mjs
 *
 *   DEPLOYER_KEY_FILE=/path/outside/the/repo/deployer.json node scripts/deploy.mjs
 *
 * The deployer becomes the contract owner, which is the only account that can
 * withdraw fees or transfer ownership. An ephemeral account is fine for a
 * throwaway test deploy and wrong for anything you intend to keep.
 *
 * For a deploy you intend to keep, DEPLOYER_KEY_FILE names a file that holds the
 * deployer's key. It is created on the first run and reused after, so the same
 * account owns every deployment made with it. Keep it outside the repository:
 * only the address is ever printed. The same key can be imported into a wallet
 * to use the owner functions from the site.
 */

import dns from "node:dns";

// Studio sits behind Cloudflare on both stacks and its AAAA addresses time out.
// Node tries IPv6 first, so every request burns ~10s and then reports a bare
// "fetch failed" that looks like the chain is down. This must run before any
// client is created, in every entry point that talks to the RPC.
dns.setDefaultResultOrder("ipv4first");

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { createAccount, createClient, generatePrivateKey } from "genlayer-js";
import { studionet, testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");

const NETWORK = process.env.GENLAYER_NETWORK || "studionet";
const chain = NETWORK === "bradbury" ? testnetBradbury : studionet;
const RPC = chain.rpcUrls.default.http[0];
const FEE_BPS = Number(process.env.FEE_BPS || 600);

const log = (...a) => console.log(...a);

async function rpc(method, params) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
  });
  return res.json();
}

/**
 * Studio drops TLS connections, fills its execution slots and rate limits at 30
 * requests a minute. None of those mean the deploy failed, so anything that
 * talks to the chain goes through here.
 */
async function retry(fn, label, attempts = 6) {
  let wait = 2500;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      const msg = String(e?.details || e?.message || e);
      const soft =
        /fetch failed|ECONNRESET|Rate limit|slots occupied|Server busy|socket hang up|timeout/i.test(
          msg
        );
      if (!soft || i === attempts) throw e;
      log(`     (${label} hiccup, retrying in ${wait / 1000}s)`);
      await new Promise((r) => setTimeout(r, wait));
      wait = Math.min(wait * 2, 20000);
    }
  }
}

function explain(receipt) {
  const lr =
    receipt?.consensus_data?.leader_receipt ??
    receipt?.consensusData?.leaderReceipt;
  const one = Array.isArray(lr) ? lr[0] : lr;
  const stderr = one?.genvm_result?.stderr ?? one?.genvmResult?.stderr ?? "";
  return {
    execResult: one?.execution_result ?? one?.executionResult,
    last: String(stderr).trim().split("\n").filter(Boolean).pop() || "",
    stderr,
  };
}

/** The deployer: a kept account when DEPLOYER_KEY_FILE is set, else disposable. */
function deployer() {
  const file = process.env.DEPLOYER_KEY_FILE;
  if (!file) return { account: createAccount(), kept: false };
  if (existsSync(file)) {
    const saved = JSON.parse(readFileSync(file, "utf8"));
    return { account: createAccount(saved.private_key), kept: true, file };
  }
  const key = generatePrivateKey();
  const account = createAccount(key);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(
    file,
    JSON.stringify({ address: account.address, private_key: key }, null, 2),
    { mode: 0o600 }
  );
  return { account, kept: true, file, created: true };
}

async function main() {
  log(`network  ${chain.name} (${chain.id})`);
  log(`fee      ${FEE_BPS} bps (${FEE_BPS / 100}%)\n`);

  const { account, kept, file, created } = deployer();
  if (kept) {
    log(`[ok] deployer ${account.address} (${created ? "created in" : "read from"} ${file})`);
    log("     this account becomes the contract owner, and the key file is the only");
    log("     copy - back it up outside the repository.\n");
  } else {
    log(`[ok] ephemeral deployer ${account.address}`);
    log("     this account becomes the contract owner - set DEPLOYER_KEY_FILE for a");
    log("     deploy you intend to keep.\n");
  }

  const client = createClient({ chain, account });
  // LF on every platform, the same normalisation /api/contract-source applies.
  // A Windows checkout carries CRLF, and deploying those bytes puts carriage
  // returns on chain that exist in no clone, so `npm run verify-source` could
  // never report a match for anyone else.
  const code = readFileSync(join(ROOT, "contracts", "fieldwork.py"), "utf8")
    .split(String.fromCharCode(13) + String.fromCharCode(10))
    .join(String.fromCharCode(10));

  log("deploying contracts/fieldwork.py ...");
  const hash = await retry(
    () => client.deployContract({ code, args: [FEE_BPS] }),
    "deploy"
  );
  log(`     tx ${hash}`);

  const receipt = await retry(
    () =>
      client.waitForTransactionReceipt({
        hash,
        status: TransactionStatus.FINALIZED,
        retries: 250,
        interval: 3000,
      }),
    "receipt"
  );

  const address =
    receipt?.data?.contract_address ??
    receipt?.contract_address ??
    receipt?.contractAddress;

  if (!address) {
    console.error(JSON.stringify(explain(receipt), null, 2));
    console.error("\n✗ no contract address came back");
    process.exit(1);
  }
  log(`[ok] deployed at ${address}`);

  // ACCEPTED is not enough. This is the check that exposes the Bradbury bug
  // where a deploy finalizes and the code is nevertheless gone.
  const shape = NETWORK === "bradbury" ? [{ address }] : [address];
  const codeCheck = await retry(() => rpc("gen_getContractCode", shape), "code check");
  if (!codeCheck?.result) {
    console.error(JSON.stringify(codeCheck, null, 2));
    console.error("\n✗ deploy finalized but the code is not readable");
    process.exit(1);
  }
  log(`[ok] code readable (${String(codeCheck.result).length} chars)`);

  const total = await retry(
    () => client.readContract({ address, functionName: "total_tasks", args: [] }),
    "total_tasks"
  );
  const fee = await retry(
    () => client.readContract({ address, functionName: "fee_bps_value", args: [] }),
    "fee_bps_value"
  );
  const owner = await retry(
    () => client.readContract({ address, functionName: "owner_address", args: [] }),
    "owner_address"
  );
  log(`[ok] total_tasks=${total}  fee_bps=${fee}  owner=${owner}`);

  log("\n" + "=".repeat(58));
  log(`  NEXT_PUBLIC_FIELDWORK_CONTRACT=${address}`);
  log(`  NEXT_PUBLIC_GENLAYER_NETWORK=${NETWORK}`);
  log("=".repeat(58));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
