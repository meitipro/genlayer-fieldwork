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
    claimedBy: short(raw.claimed_by) || undefined,
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
 * Studio answers -32006 "Server busy: all N execution slots occupied" when its
 * execution slots are full. Without a retry a busy moment silently drops tasks
 * from the list, which reads as tasks disappearing rather than as load.
 */
async function busyRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let wait = 700;
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      const msg = String((e as { details?: string; message?: string })?.details ?? (e as Error)?.message ?? e);
      const busy = msg.includes("-32006") || /slots occupied|Server busy/i.test(msg);
      if (!busy || i >= attempts) throw e;
      await new Promise((r) => setTimeout(r, wait));
      wait *= 2;
    }
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function fetchTasks(limit = 40): Promise<Task[]> {
  if (!IS_LIVE) return SEED;

  try {
    const c = client();
    const total = Number(
      await busyRetry(() =>
        (c as any).readContract({
          address: CONTRACT,
          functionName: "total_tasks",
          args: [],
        })
      )
    );
    if (!Number.isFinite(total) || total <= 0) return [];

    // Newest first, bounded.
    const ids: number[] = [];
    for (let i = total - 1; i >= 0 && ids.length < limit; i--) ids.push(i);

    const rows = await Promise.all(
      ids.map(async (id) => {
        try {
          const raw = await busyRetry(() =>
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
      })
    );

    return rows.filter((t): t is Task => t !== null);
  } catch {
    // A chain that cannot be reached should not take the site down.
    return SEED;
  }
}

export async function fetchTask(id: number): Promise<Task | undefined> {
  if (!IS_LIVE) return SEED.find((t) => t.id === id);

  try {
    const raw = await busyRetry(() =>
      (client() as any).readContract({
        address: CONTRACT,
        functionName: "task_json",
        args: [id],
      })
    );
    return toTask(JSON.parse(String(raw)) as RawTask);
  } catch {
    return SEED.find((t) => t.id === id);
  }
}
