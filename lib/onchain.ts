// Server side reads of the deployed contract.
//
// Every page reads through here, so pointing the site at a live contract is a
// question of whether NEXT_PUBLIC_FIELDWORK_CONTRACT is set, not a rewrite.
// When it is unset, or the chain cannot be reached, the seed records in
// lib/tasks.ts stand in.

import { createClient } from "genlayer-js";
import { chain } from "./chain";
import type { Task, TaskStatus } from "./types";
import { TASKS as SEED } from "./tasks";

const CONTRACT = (process.env.NEXT_PUBLIC_FIELDWORK_CONTRACT ||
  "") as `0x${string}`;

export const IS_LIVE = CONTRACT.length > 0;

/** Reads are cached briefly at the route. Nothing depends on the cache for
 *  correctness, so a stale read is a cosmetic bug rather than a money bug. */
export const revalidate = 5;

type RawTask = {
  id: number;
  poster: string;
  title: string;
  place: string;
  acceptance_test: string;
  example_pass: string;
  example_fail: string;
  lat_e6: number;
  lng_e6: number;
  reward: string;
  fee: string;
  min_reputation: number;
  claimed_by: string;
  challenge_code: string;
  claim_expires: string;
  status: string;
  reason: string;
  before_url: string;
  after_url: string;
  content_hash: string;
  phash: string;
};

const ZERO = "0x0000000000000000000000000000000000000000";

function weiToWhole(wei: string): number {
  try {
    return Number(BigInt(wei) / BigInt(10) ** BigInt(18));
  } catch {
    return 0;
  }
}

function short(addr: string): string {
  if (!addr || addr === ZERO) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function toTask(raw: RawTask): Task {
  // Only a claimed task has a deadline. An unclaimed one is 0, which the UI
  // reads as "no clock running yet" rather than inventing one.
  const parsed = raw.claim_expires ? Date.parse(raw.claim_expires + "Z") : 0;
  const expires = Number.isFinite(parsed) ? parsed : 0;

  return {
    id: raw.id,
    title: raw.title,
    place: raw.place,
    acceptanceTest: raw.acceptance_test,
    examplePass: raw.example_pass,
    exampleFail: raw.example_fail,
    latE6: raw.lat_e6,
    lngE6: raw.lng_e6,
    reward: weiToWhole(raw.reward),
    minReputation: raw.min_reputation,
    status: (raw.status as TaskStatus) || "open",
    // Distance is a viewer-relative idea, so it is not on chain.
    distanceM: 0,
    expiresAt: expires,
    poster: short(raw.poster),
    // Full, not shortened: the task page compares this against the visitor's
    // wallet to tell "yours" from "someone else's".
    claimedBy:
      raw.claimed_by && raw.claimed_by !== ZERO ? raw.claimed_by : undefined,
    challengeCode: raw.challenge_code || undefined,
    reason: raw.reason || undefined,
    beforeUrl: raw.before_url || undefined,
    afterUrl: raw.after_url || undefined,
    contentHash: raw.content_hash || undefined,
    phash: raw.phash || undefined,
    verdict:
      raw.status === "paid"
        ? { codeVisible: true, samePlace: true, testPassed: true }
        : undefined,
  };
}

function client() {
  return createClient({ chain });
}

/**
 * Studio pushes back in two ways, and both look like a broken site if ignored:
 * `-32006 Server busy: all N execution slots occupied`, and
 * `Rate limit exceeded: 30 requests per minute`.
 */
function isBackpressure(e: unknown): boolean {
  const msg = String(
    (e as { details?: string; message?: string })?.details ??
      (e as Error)?.message ??
      e
  );
  return (
    msg.includes("-32006") ||
    /slots occupied|Server busy|Rate limit exceeded|too many requests/i.test(msg)
  );
}

async function backoff<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let wait = 900;
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (!isBackpressure(e) || i >= attempts) throw e;
      await new Promise((r) => setTimeout(r, wait));
      wait *= 2;
    }
  }
}

/**
 * Read the chain at most once every few seconds, however many pages ask.
 *
 * Home, /map and /console all want the same list, and each task costs a call.
 * Rendering them together against a 30-requests-per-minute limit is enough to
 * start losing tasks, so concurrent callers share one in-flight read and the
 * result is held briefly. Nothing depends on the cache for correctness - a
 * stale read is a cosmetic bug, never a money bug.
 */
const TTL_MS = 5000;
let cached: { at: number; tasks: Task[] } | null = null;
let inflight: Promise<Task[]> | null = null;
let cachedTotal: { at: number; total: number } | null = null;

/** Small concurrency, so a long list never bursts through the rate limit. */
async function inBatches<In, Out>(
  items: In[],
  size: number,
  fn: (item: In) => Promise<Out>
): Promise<Out[]> {
  const out: Out[] = [];
  for (let i = 0; i < items.length; i += size) {
    const batch = items.slice(i, i + size);
    out.push(...(await Promise.all(batch.map(fn))));
  }
  return out;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * How many tasks the contract has, or null if the chain would not say.
 *
 * Needed because the SDK does not surface a contract's own error text: asking
 * for an id that does not exist comes back as a bare "execution failed", which
 * is indistinguishable from a busy node. One extra read settles it.
 */
async function totalTasks(): Promise<number | null> {
  if (cachedTotal && Date.now() - cachedTotal.at < TTL_MS) return cachedTotal.total;
  try {
    const total = Number(
      await backoff(() =>
        (client() as any).readContract({
          address: CONTRACT,
          functionName: "total_tasks",
          args: [],
        })
      )
    );
    if (!Number.isFinite(total)) return null;
    cachedTotal = { at: Date.now(), total };
    return total;
  } catch {
    return null;
  }
}

export async function fetchTasks(limit = 40): Promise<Task[]> {
  if (!IS_LIVE) return SEED;

  if (cached && Date.now() - cached.at < TTL_MS) return cached.tasks;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const c = client();
      const total = Number(
        await backoff(() =>
          (c as any).readContract({
            address: CONTRACT,
            functionName: "total_tasks",
            args: [],
          })
        )
      );
      if (!Number.isFinite(total) || total <= 0) return [];
      cachedTotal = { at: Date.now(), total };

      // Newest first, bounded.
      const ids: number[] = [];
      for (let i = total - 1; i >= 0 && ids.length < limit; i--) ids.push(i);

      const rows = await inBatches(ids, 4, async (id) => {
        try {
          const raw = await backoff(() =>
            (c as any).readContract({
              address: CONTRACT,
              functionName: "task_json",
              args: [id],
            })
          );
          return toTask(JSON.parse(String(raw)) as RawTask);
        } catch {
          return null;
        }
      });

      const tasks = rows.filter((t): t is Task => t !== null);
      cached = { at: Date.now(), tasks };
      return tasks;
    } catch {
      // A chain that cannot be reached should not take the site down.
      return cached?.tasks ?? SEED;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/**
 * "I could not reach the chain" and "there is no such task" are different
 * answers and must not be collapsed.
 *
 * The seed records cannot stand in for a single live task: their ids are in a
 * different space entirely, so falling back to them turns a busy RPC into a
 * confident "this task does not exist" for a task that plainly does.
 */
export type TaskLookup =
  | { status: "found"; task: Task }
  | { status: "missing" }
  | { status: "unavailable" };

export async function lookupTask(id: number): Promise<TaskLookup> {
  if (!IS_LIVE) {
    const seeded = SEED.find((t) => t.id === id);
    return seeded ? { status: "found", task: seeded } : { status: "missing" };
  }

  // generateMetadata and the page body both ask for the same task, so a warm
  // list answers both without touching the chain again.
  if (cached && Date.now() - cached.at < TTL_MS) {
    const hit = cached.tasks.find((t) => t.id === id);
    if (hit) return { status: "found", task: hit };
  }

  try {
    const raw = await backoff(
      () =>
        (client() as any).readContract({
          address: CONTRACT,
          functionName: "task_json",
          args: [id],
        }),
      5
    );
    return { status: "found", task: toTask(JSON.parse(String(raw)) as RawTask) };
  } catch (e) {
    const warm = cached?.tasks.find((t) => t.id === id);
    if (warm) return { status: "found", task: warm };

    // The contract says "no task with that id", but the SDK reports every
    // failed gen_call as "execution failed" and drops the message, so the read
    // that failed cannot tell us why on its own. Ask how many tasks exist: an
    // id past the end is genuinely missing, and anything else is the network.
    if (/no task with that id/i.test(String((e as Error)?.message ?? e))) {
      return { status: "missing" };
    }
    const total = await totalTasks();
    if (total !== null && (id < 0 || id >= total)) return { status: "missing" };
    return { status: "unavailable" };
  }
}

export async function fetchTask(id: number): Promise<Task | undefined> {
  const found = await lookupTask(id);
  return found.status === "found" ? found.task : undefined;
}
