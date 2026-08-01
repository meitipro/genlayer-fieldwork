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
  const expires = raw.claim_expires
    ? Date.parse(raw.claim_expires + "Z")
    : Date.now() + 90 * 60_000;

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
    expiresAt: Number.isFinite(expires) ? expires : Date.now() + 90 * 60_000,
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

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function fetchTasks(limit = 40): Promise<Task[]> {
  if (!IS_LIVE) return SEED;

  try {
    const c = client();
    const total = Number(
      await (c as any).readContract({
        address: CONTRACT,
        functionName: "total_tasks",
        args: [],
      })
    );
    if (!Number.isFinite(total) || total <= 0) return [];

    // Newest first, bounded.
    const ids: number[] = [];
    for (let i = total - 1; i >= 0 && ids.length < limit; i--) ids.push(i);

    const rows = await Promise.all(
      ids.map(async (id) => {
        try {
          const raw = await (c as any).readContract({
            address: CONTRACT,
            functionName: "task_json",
            args: [id],
          });
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
    const raw = await (client() as any).readContract({
      address: CONTRACT,
      functionName: "task_json",
      args: [id],
    });
    return toTask(JSON.parse(String(raw)) as RawTask);
  } catch {
    return SEED.find((t) => t.id === id);
  }
}
