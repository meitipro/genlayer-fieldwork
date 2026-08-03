import type { NetworkStats, Task } from "./types";

/* Seed records.
   The launch checklist asks for ten real records before any announcement;
   these stand in until the contract address is set, and every screen reads
   through the same helpers so swapping the source is a one file change. */

const HOUR = 3600_000;
const MIN = 60_000;

// Fixed epoch so server and client render the same relative times and React
// does not complain about a hydration mismatch.
const T0 = Date.UTC(2026, 6, 21, 15, 22, 0);

export const TASKS: Task[] = [
  {
    id: 4471,
    title: "Clear the bin area behind 14 Mill St",
    place: "Mill St, behind the parade",
    acceptanceTest:
      "The bin area is empty. No bags remain against the wall, the ground is clear of loose litter, and both bins are upright with their lids closed.",
    examplePass:
      "Wall and ground both visible and clear, bins upright, lids down, code legible on paper held in frame.",
    exampleFail:
      "Bags moved out of shot rather than removed, or the wall is not visible in the after photograph.",
    latE6: 51_505_100,
    lngE6: -122_600,
    reward: 18,
    minReputation: 1,
    status: "paid",
    distanceM: 800,
    expiresAt: T0 + 2 * HOUR,
    poster: "0x91c4…7a2f",
    claimedBy: "0x3fd2…9b41",
    challengeCode: "K73QXB",
    reason: "Wall and ground clear in the after frame, code legible in both.",
    beforeUrl: "/samples/bins-before.svg",
    afterUrl: "/samples/bins-after.svg",
    contentHash:
      "b31a9c0e5f74d2688a1c47f0e9d3b6521c8ae4f7920d5b3ce16a8f4d27b90cc3",
    phash: "3c1e0f0f87c3e1f0",
    agreement: { agreed: 4, of: 5 },
    paidAt: T0,
    verdict: { codeVisible: true, samePlace: true, testPassed: true },
  },
  {
    id: 4472,
    title: "Photograph charger 41 and its display",
    place: "Level 2, Northgate car park",
    acceptanceTest:
      "Charger 41 is shown head on with its screen readable. The screen shows a status line, and the charger's unit number is visible in the same frame.",
    examplePass:
      "Screen readable without glare, unit number 41 visible, code held beside the screen.",
    exampleFail:
      "Screen washed out by sunlight, or the unit number cropped out of frame.",
    latE6: 51_512_800,
    lngE6: -131_900,
    reward: 12,
    minReputation: 0,
    status: "open",
    distanceM: 1400,
    expiresAt: T0 + 5 * HOUR,
    poster: "0x77ab…31c9",
  },
  {
    id: 4473,
    title: "Confirm shelf display for brand X",
    place: "Aisle 7, Weston Road",
    acceptanceTest:
      "The brand X display stands at the aisle end, fully stocked with no gaps in the front row, and the header card is present and straight.",
    examplePass:
      "Aisle end shown wide enough to see the whole display, front row complete, header card straight.",
    exampleFail:
      "Close crop that hides gaps, or a photograph of a different aisle end.",
    latE6: 51_498_400,
    lngE6: -118_200,
    reward: 25,
    minReputation: 5,
    status: "open",
    distanceM: 2100,
    expiresAt: T0 + 24 * HOUR,
    poster: "0x77ab…31c9",
  },
  {
    id: 4474,
    title: "Clear fly tipping at the Canal Rd bridge",
    place: "Canal Rd, under the bridge",
    acceptanceTest:
      "The area under the bridge is clear of dumped material. The towpath is walkable end to end and nothing is stacked against the bridge wall.",
    examplePass:
      "Towpath visible along its length, bridge wall clear, code held in frame.",
    exampleFail:
      "Material pushed to the side rather than removed, or only a partial view of the towpath.",
    latE6: 51_520_300,
    lngE6: -140_500,
    reward: 30,
    minReputation: 2,
    status: "claimed",
    distanceM: 3200,
    expiresAt: T0 + 40 * MIN,
    poster: "0x91c4…7a2f",
    claimedBy: "0x8ee1…04d7",
    challengeCode: "M2P9WD",
  },
  {
    id: 4475,
    title: "Check the noticeboard at Ashfield Green",
    place: "Ashfield Green, north gate",
    acceptanceTest:
      "The noticeboard is clear of out of date posters, the glass is closed and latched, and the current month's sheet is pinned in the top left.",
    examplePass:
      "Whole board in frame, glass closed, current sheet visible top left.",
    exampleFail: "Angled shot that hides half the board, or glass left open.",
    latE6: 51_489_900,
    lngE6: -112_700,
    reward: 10,
    minReputation: 0,
    status: "rejected",
    distanceM: 4100,
    expiresAt: T0 + 90 * MIN,
    poster: "0x2b60…ff18",
    claimedBy: "0x3fd2…9b41",
    challengeCode: "R4TJ8N",
    reason: "The code is not legible in the after photo, retake it closer.",
  },
];

export const STATS: NetworkStats = {
  tasksPaid: 1204,
  firstTryPassRate: 83,
  medianMinutesToPayment: 4,
};

export function listTasks(): Task[] {
  return TASKS;
}

export function openTasks(): Task[] {
  return TASKS.filter((t) => t.status === "open");
}

export function paidTasks(): Task[] {
  return TASKS.filter((t) => t.status === "paid");
}

export function getTask(id: number): Task | undefined {
  return TASKS.find((t) => t.id === id);
}

/* ---------- display helpers ---------- */

export function formatDistance(metres: number): string {
  // Distance is viewer relative, so it is not on chain. An unknown distance
  // says so rather than claiming the task is at your feet.
  if (!metres || metres <= 0) return "—";
  if (metres < 1000) return `${metres} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

/**
 * What to put in the clock column.
 *
 * Only a claimed task is counting down. An open one has no deadline at all —
 * the ninety minutes start when you claim it — so it says what you would get
 * rather than a countdown that is not running.
 */
export function formatWindow(
  task: Pick<Task, "status" | "expiresAt">,
  now: number
): string {
  if (task.status !== "claimed" || !task.expiresAt) return "90m on claim";
  return formatRemaining(task.expiresAt, now);
}

/** Workers care about minutes, not timestamps. */
export function formatRemaining(expiresAt: number, now: number): string {
  const ms = expiresAt - now;
  if (ms <= 0) return "expired";
  const mins = Math.round(ms / MIN);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function formatStamp(ms: number): string {
  const d = new Date(ms);
  const day = d.getUTCDate();
  const month = d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day} ${month} ${hh}:${mm}`;
}

/** The epoch the seed records are written against. */
export const SEED_NOW = T0;
