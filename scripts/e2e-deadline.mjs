/**
 * End to end exercise of task deadlines on a deployed Fieldwork contract.
 *
 *   FIELDWORK=0x... node scripts/e2e-deadline.mjs
 *
 * The deadline floor is an hour, so this run takes a little over an hour of
 * wall clock: it posts, waits, and then closes. Everything it does is on chain
 * and every transaction hash is printed, so the output is the evidence.
 *
 *   1. a task with no deadline cannot be closed by a stranger
 *   2. a deadline under an hour, or shorter than the claim window, is refused
 *   3. a task with a deadline stores it, and a stranger cannot close it early
 *   4. a claim taken near the deadline is clamped to it
 *   5. after the deadline a stranger closes both the unclaimed task and the
 *      one whose claim ran out with it, and the status is expired
 *   6. a second close is refused, so nothing can be paid twice
 *
 * The photographs are the ones scripts/e2e.mjs uses, known to be readable by
 * validators. The acceptance test is the same gradeable one.
 */

import dns from "node:dns";

// See scripts/e2e.mjs: Studio's AAAA addresses time out, and this has to run
// before any client is created.
dns.setDefaultResultOrder("ipv4first");

import { createAccount, createClient } from "genlayer-js";
import { studionet, testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const NETWORK = process.env.GENLAYER_NETWORK || "studionet";
const chain = NETWORK === "bradbury" ? testnetBradbury : studionet;
const RPC = chain.rpcUrls.default.http[0];
const ADDRESS = process.env.FIELDWORK;
if (!ADDRESS) {
  console.error("set FIELDWORK=0x... to the deployed contract address");
  process.exit(1);
}

const BEFORE =
  "https://gateway.pinata.cloud/ipfs/QmPiuq2ec8CRuVLXidgNYbx8VYRhhv8uBobHKQB6BvBU8Y";
const GEN = (n) => BigInt(n) * BigInt(10) ** BigInt(18);
const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;

function check(ok, label, detail = "") {
  if (!ok) failures++;
  log(`  [${ok ? "ok  " : "FAIL"}] ${label}${detail ? " - " + detail : ""}`);
}

async function rpc(method, params) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
  });
  return res.json();
}

function explain(receipt) {
  const lr =
    receipt?.consensus_data?.leader_receipt ??
    receipt?.consensusData?.leaderReceipt;
  const one = Array.isArray(lr) ? lr[0] : lr;
  const stderr = one?.genvm_result?.stderr ?? one?.genvmResult?.stderr ?? "";
  const err = one?.error || "";
  const last = String(stderr).trim().split("\n").filter(Boolean).pop() || "";
  return {
    execResult: one?.execution_result ?? one?.executionResult,
    reason: err || last,
  };
}

const TASK = {
  title: "Clear the bin area behind 14 Mill St",
  place: "Mill St, behind the parade",
  test:
    "The bin area is empty. No bags remain against the wall, the ground is " +
    "clear of loose litter, and both bins are upright with their lids closed.",
  pass:
    "Wall and ground both visible and clear, bins upright, lids down, code " +
    "legible on paper held in frame.",
  fail:
    "Bags moved out of shot rather than removed, or the wall is not visible " +
    "in the after photograph.",
};

// Studio sits behind a proxy that now and then answers with an HTML error page.
// That is a dropped request, not a result, and reads and receipt polls are
// idempotent, so they are retried. A write is never re-sent once it has a hash.
const transient = (e) =>
  /RPC|<!DOCTYPE|Unexpected token|fetch failed|ECONN|ETIMEDOUT|50[234]|429/i.test(
    String(e?.message || e)
  );

async function retrying(fn, tries = 8) {
  let wait = 2000;
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= tries || !transient(e)) throw e;
      await sleep(wait);
      wait = Math.min(Math.round(wait * 1.7), 20000);
    }
  }
}

async function send(client, functionName, args, value = BigInt(0)) {
  try {
    const hash = await retrying(() =>
      client.writeContract({ address: ADDRESS, functionName, args, value })
    );
    const receipt = await retrying(() =>
      client.waitForTransactionReceipt({
        hash,
        status: TransactionStatus.FINALIZED,
        retries: 300,
        interval: 3000,
      })
    );
    const d = explain(receipt);
    const ok = !d.execResult || String(d.execResult).toUpperCase() === "SUCCESS";
    return { ok, reason: d.reason, hash };
  } catch (e) {
    return { ok: false, reason: e?.message || String(e), hash: null };
  }
}

const read = (client, fn, args = []) =>
  retrying(() => client.readContract({ address: ADDRESS, functionName: fn, args }));

// 12 arguments of the contract's signature before deadlines, then open_minutes.
const postArgs = (reward, claimMinutes, openMinutes) => [
  TASK.title, TASK.place, TASK.test, TASK.pass, TASK.fail, BEFORE,
  51505100, -122600, GEN(reward), 0, "", claimMinutes, openMinutes,
];

async function main() {
  log(`network   ${chain.name} (${chain.id})`);
  log(`contract  ${ADDRESS}\n`);

  const poster = createAccount();
  const stranger = createAccount();
  const posterClient = createClient({ chain, account: poster });
  const strangerClient = createClient({ chain, account: stranger });
  log(`poster    ${poster.address}`);
  log(`stranger  ${stranger.address}\n`);
  for (const a of [poster, stranger]) {
    await rpc("sim_fundAccount", [a.address, Number(GEN(5000))]);
  }
  await sleep(6000);

  const feeBps = Number(await read(posterClient, "fee_bps_value"));
  const reward = 12;
  const value = GEN(reward) + (GEN(reward) * BigInt(feeBps)) / BigInt(10000);
  log(`fee_bps   ${feeBps}\n`);

  // ---- 1. no deadline: a stranger cannot close it ----
  log("1. a task with no deadline");
  const open0 = await send(posterClient, "post_task", postArgs(reward, 30, 0), value);
  check(open0.ok, "posted with open_minutes 0", open0.ok ? open0.hash : open0.reason);
  const id0 = Number(await read(posterClient, "total_tasks")) - 1;
  const until0 = String(await read(posterClient, "open_until_of", [id0]));
  check(until0 === "", "open_until is empty", JSON.stringify(until0));
  const x0 = await send(strangerClient, "expire_task", [id0]);
  check(!x0.ok, "a stranger cannot close it", x0.reason.slice(0, 100));
  log(`     tx ${x0.hash}`);

  // ---- 2. refused deadlines ----
  log("\n2. deadlines the contract refuses");
  const tooShort = await send(posterClient, "post_task", postArgs(reward, 30, 30), value);
  check(!tooShort.ok, "under an hour is refused", tooShort.reason.slice(0, 100));
  const beforeClaim = await send(posterClient, "post_task", postArgs(reward, 120, 60), value);
  check(!beforeClaim.ok, "shorter than the claim window is refused", beforeClaim.reason.slice(0, 100));
  const tooLong = await send(posterClient, "post_task", postArgs(reward, 30, 525601), value);
  check(!tooLong.ok, "over a year is refused", tooLong.reason.slice(0, 100));

  // ---- 3. a task with a deadline ----
  log("\n3. two tasks that stay open for an hour");
  const t0 = Date.now();
  const a = await send(posterClient, "post_task", postArgs(reward, 30, 60), value);
  check(a.ok, "task A posted with open_minutes 60", a.ok ? a.hash : a.reason);
  const idA = Number(await read(posterClient, "total_tasks")) - 1;
  const b = await send(posterClient, "post_task", postArgs(reward, 30, 60), value);
  check(b.ok, "task B posted with open_minutes 60", b.ok ? b.hash : b.reason);
  const idB = Number(await read(posterClient, "total_tasks")) - 1;
  if (!a.ok || !b.ok) {
    log("\nthe deadline tasks were not posted, nothing further can be shown");
    process.exit(1);
  }

  const untilA = String(await read(posterClient, "open_until_of", [idA]));
  const untilB = String(await read(posterClient, "open_until_of", [idB]));
  check(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/.test(untilA), `A open_until ${untilA}`);
  check(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/.test(untilB), `B open_until ${untilB}`);
  const stamp = (u) => Date.parse(u + (u.endsWith("Z") ? "" : "Z"));
  const deadlineA = stamp(untilA);
  const deadlineB = stamp(untilB);
  check(
    Math.abs(deadlineA - t0 - 60 * 60 * 1000) < 15 * 60 * 1000,
    "the deadline is about an hour after posting"
  );

  const early = await send(strangerClient, "expire_task", [idA]);
  check(!early.ok, "a stranger cannot close it early", early.reason.slice(0, 100));
  log(`     tx ${early.hash}`);

  // ---- 4. a claim near the deadline is clamped ----
  // Task B's own deadline, so the 30 minute claim window overruns it and the
  // clamp is exercised rather than assumed.
  const claimAt = deadlineB - 20 * 60 * 1000;
  log(`\n4. wait until 20 minutes before the deadline, then claim task B`);
  if (Date.now() < claimAt) {
    log(`   sleeping ${Math.ceil((claimAt - Date.now()) / 60000)} minutes`);
    await sleep(claimAt - Date.now());
  }
  const claim = await send(posterClient, "claim", [idB]);
  check(claim.ok, "claim accepted", claim.ok ? claim.hash : claim.reason);
  if (claim.ok) {
    const exp = String(await read(posterClient, "claim_expires_of", [idB]));
    check(exp <= untilB, `claim_expires ${exp} is not after open_until ${untilB}`);
    const live = await send(strangerClient, "expire_task", [idB]);
    check(!live.ok, "a live claim cannot be closed over", live.reason.slice(0, 100));
    log(`     tx ${live.hash}`);
  }

  // ---- 5. after the deadline ----
  const closeAt = Math.max(deadlineA, deadlineB) + 90 * 1000;
  log("\n5. wait for the deadline, then a stranger closes both");
  if (Date.now() < closeAt) {
    log(`   sleeping ${Math.ceil((closeAt - Date.now()) / 60000)} minutes`);
    await sleep(closeAt - Date.now());
  }
  async function closeWithRetry(id, label) {
    let last;
    for (let i = 0; i < 6; i++) {
      last = await send(strangerClient, "expire_task", [id]);
      if (last.ok) break;
      await sleep(60000);
    }
    check(last.ok, `${label} closed by a stranger`, last.ok ? last.hash : last.reason.slice(0, 100));
    return last;
  }
  const closedA = await closeWithRetry(idA, "unclaimed task A");
  const closedB = await closeWithRetry(idB, "task B whose claim ran out with the deadline");
  const stA = String(await read(posterClient, "status_of", [idA]));
  const stB = String(await read(posterClient, "status_of", [idB]));
  check(stA === "expired", "A is expired", stA);
  check(stB === "expired", "B is expired", stB);

  // ---- 6. a second close ----
  log("\n6. closing twice");
  const again = await send(strangerClient, "expire_task", [idA]);
  check(!again.ok, "the second close is refused", again.reason.slice(0, 100));
  log(`     tx ${again.hash}`);

  log("\ntransactions");
  log(`  A closed  ${closedA.hash}`);
  log(`  B closed  ${closedB.hash}`);

  log("\n" + "=".repeat(58));
  log(failures === 0 ? "  all deadline checks passed" : `  ${failures} FAILURES`);
  log("=".repeat(58));
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
