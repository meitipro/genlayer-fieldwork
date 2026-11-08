/**
 * The attestor: reads what GenLayer decided and signs it for the Base escrow.
 *
 *   node scripts/attest.mjs status <taskId>
 *   node scripts/attest.mjs settle <taskId> [--submit]
 *
 * Environment (names only, values are never printed):
 *   NEXT_PUBLIC_FIELDWORK_CONTRACT   the GenLayer contract that graded the task
 *   ESCROW_ADDRESS                   FieldworkEscrow on Base Sepolia
 *   BASE_RPC_URL                     defaults to https://sepolia.base.org
 *   ATTESTOR_KEY_FILE                a JSON file with { "private_key": "0x..." }, kept outside the repository
 *   RELAYER_KEY_FILE                 optional, pays gas for --submit; defaults to the attestor
 *
 * The rule it applies is short. A task is signed PAY only when GenLayer says `paid`, and then to the worker
 * GenLayer recorded. It is signed REFUND only when GenLayer says `cancelled` or `expired`. Every other status is
 * refused, and so is a task the escrow does not hold as funded. The signature is bound to the task, the worker,
 * the outcome and an expiry, so it cannot be replayed on another task or redirected to another address.
 */

import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");

import { readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const [cmd, idArg, ...flags] = process.argv.slice(2);
const SUBMIT = flags.includes("--submit");
// Exit after the sockets have had a moment to close: on Windows, exiting while undici is still closing one
// ends the process with a libuv assertion instead of the exit code.
const finish = async (code) => {
  process.exitCode = code;
  await new Promise((r) => setTimeout(r, 300));
  process.exit(code);
};
const need = (name) => {
  const v = process.env[name];
  if (!v) {
    console.error(`set ${name}`);
    process.exit(2);
  }
  return v;
};

if (!["status", "settle"].includes(cmd) || !/^\d+$/.test(idArg || "")) {
  console.error("usage: node scripts/attest.mjs status|settle <taskId> [--submit]");
  process.exit(2);
}
const taskId = BigInt(idArg);

const GL_CONTRACT = need("NEXT_PUBLIC_FIELDWORK_CONTRACT");
const ESCROW = need("ESCROW_ADDRESS");
const RPC = process.env.BASE_RPC_URL || "https://sepolia.base.org";
const keyOf = (file) => {
  const k = JSON.parse(readFileSync(file, "utf8")).private_key;
  return privateKeyToAccount(k.startsWith("0x") ? k : `0x${k}`);
};

const ABI = parseAbi([
  "function tasks(uint256) view returns (address poster, uint128 reward, uint128 fee, uint64 deadline, uint8 state)",
  "function attestor() view returns (address)",
  "function settle(uint256 taskId, address worker, uint8 outcome, uint256 expiry, bytes signature)",
]);
const STATES = ["None", "Funded", "Paid", "Refunded"];
const PAY = 1;
const REFUND = 2;
const ZERO = "0x0000000000000000000000000000000000000000";

async function genlayerTask() {
  const gl = createClient({ chain: studionet });
  let last;
  for (let i = 0; i < 5; i++) {
    try {
      return JSON.parse(await gl.readContract({ address: GL_CONTRACT, functionName: "task_json", args: [Number(taskId)] }));
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
  }
  throw last;
}

const pub = createPublicClient({ chain: baseSepolia, transport: http(RPC) });
const [onchain, glTask] = await Promise.all([
  pub.readContract({ address: ESCROW, abi: ABI, functionName: "tasks", args: [taskId] }),
  genlayerTask(),
]);
const [poster, reward, fee, deadline, state] = onchain;

console.log(`task ${taskId}`);
console.log(`  genlayer  status ${glTask.status}, worker ${glTask.claimed_by}`);
console.log(`  escrow    ${STATES[state]}, poster ${poster}, reward ${reward}, fee ${fee}, deadline ${deadline}`);

if (cmd === "status") await finish(0);

if (STATES[state] !== "Funded") {
  console.error(`refused: the escrow holds this task as ${STATES[state]}, there is nothing to settle`);
  await finish(1);
}

let outcome;
let worker = ZERO;
if (glTask.status === "paid") {
  if (!glTask.claimed_by || glTask.claimed_by.toLowerCase() === ZERO) {
    console.error("refused: GenLayer says paid but records no worker");
    await finish(1);
  }
  outcome = PAY;
  worker = glTask.claimed_by;
} else if (glTask.status === "cancelled" || glTask.status === "expired") {
  outcome = REFUND;
} else {
  console.error(`refused: GenLayer status "${glTask.status}" is not final, so nothing is signed`);
  await finish(1);
}

const attestor = keyOf(need("ATTESTOR_KEY_FILE"));
const onChainAttestor = await pub.readContract({ address: ESCROW, abi: ABI, functionName: "attestor" });
if (onChainAttestor.toLowerCase() !== attestor.address.toLowerCase()) {
  console.error(`refused: this key (${attestor.address}) is not the escrow's attestor (${onChainAttestor})`);
  await finish(1);
}

const expiry = BigInt(Math.floor(Date.now() / 1000) + 24 * 60 * 60);
const signature = await attestor.signTypedData({
  domain: { name: "FieldworkEscrow", version: "1", chainId: baseSepolia.id, verifyingContract: ESCROW },
  types: {
    Settle: [
      { name: "taskId", type: "uint256" },
      { name: "worker", type: "address" },
      { name: "outcome", type: "uint8" },
      { name: "expiry", type: "uint256" },
    ],
  },
  primaryType: "Settle",
  message: { taskId, worker, outcome, expiry },
});
console.log(`signed ${outcome === PAY ? "PAY" : "REFUND"} ${outcome === PAY ? "to " + worker : "to the poster"}, valid for 24 hours`);

if (!SUBMIT) {
  console.log(`signature ${signature}`);
  console.log("not submitted (pass --submit to send it)");
  await finish(0);
}

const relayer = process.env.RELAYER_KEY_FILE ? keyOf(process.env.RELAYER_KEY_FILE) : attestor;
const wallet = createWalletClient({ account: relayer, chain: baseSepolia, transport: http(RPC) });
const hash = await wallet.writeContract({
  address: ESCROW,
  abi: ABI,
  functionName: "settle",
  args: [taskId, worker, outcome, expiry, signature],
});
console.log(`submitted ${hash}`);
const receipt = await pub.waitForTransactionReceipt({ hash });
console.log(`status ${receipt.status} in block ${receipt.blockNumber}`);
await finish(receipt.status === "success" ? 0 : 1);
