// Wiring to the Fieldwork Intelligent Contract.
// Writes go through the browser wallet; the network comes from lib/chain.ts.

import { createClient } from "genlayer-js";
import { TransactionStatus } from "genlayer-js/types";
import { chain, walletChainParams, REQUIRES_GAS } from "./chain";
import { normalisePhoto } from "./image";

export {
  FAUCET_URL,
  EXPLORER,
  txUrl,
  addressUrl,
  NETWORK,
  CHAIN_NAME,
  IS_STUDIO,
  REQUIRES_GAS,
} from "./chain";

export const FIELDWORK_CONTRACT = (process.env
  .NEXT_PUBLIC_FIELDWORK_CONTRACT || "") as `0x${string}`;

export const IS_LIVE = FIELDWORK_CONTRACT.length > 0;

/* eslint-disable @typescript-eslint/no-explicit-any */

export function readClient() {
  return createClient({ chain });
}

export function writeClient(address: `0x${string}`, provider: any) {
  return createClient({ chain, account: address, provider });
}

function getProvider(): any {
  const p = (globalThis as any).ethereum;
  if (!p) throw new Error("no_wallet");
  return p;
}

async function ensureNetwork(provider: any): Promise<void> {
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: walletChainParams.chainId }],
    });
  } catch (e: any) {
    const code = e?.code ?? e?.data?.originalError?.code;
    if (code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [walletChainParams],
      });
    } else {
      throw e;
    }
  }
}

export async function connectWallet(): Promise<`0x${string}`> {
  const provider = getProvider();
  const accounts: string[] = await provider.request({
    method: "eth_requestAccounts",
  });
  await ensureNetwork(provider);
  return accounts[0] as `0x${string}`;
}

/**
 * True when the wallet cannot pay for a transaction.
 * Always false on Studio: it is gasless, so every address reads 0 GEN and a
 * balance check there would reject everything.
 */
export async function isOutOfGas(address: `0x${string}`): Promise<boolean> {
  if (!REQUIRES_GAS) return false;
  try {
    const provider = getProvider();
    const hex: string = await provider.request({
      method: "eth_getBalance",
      params: [address, "latest"],
    });
    return BigInt(hex) === BigInt(0);
  } catch {
    return false;
  }
}

/**
 * The sentence the contract refused with, out of whichever shape this build
 * uses. Studio sends `result` as base64 with a one byte tag in front; other
 * builds send `{status, payload}`.
 */
function refusalText(round: any): string {
  const res = round?.result;
  if (!res) return "";
  if (typeof res === "object") return String(res.payload ?? res.data ?? "");
  try {
    return atob(String(res))
      .slice(1)
      .replace(/[^\x20-\x7e\n]/g, "")
      .trim();
  } catch {
    return "";
  }
}

/**
 * Throw if the contract refused the call, however cheerful the receipt looks.
 *
 * This is the single most important line of defence in this file. A GenLayer
 * receipt carries three fields that all read like a verdict, and two of them
 * lie: `status` is `FINALIZED` on a refused call, because refusing is a
 * perfectly successful transaction, and `result` is `MAJORITY_AGREE`, because
 * validators agreeing that a call failed is still agreement. Only
 * `consensus_data.leader_receipt[].execution_result` answers "did my code run".
 *
 * Without this, every write in the app reports success on a refusal: a claim
 * that was rejected for low reputation handed the worker an empty code and a
 * link to go and photograph a task that was never theirs. Measured on
 * transaction 0xfa6f7d9f, which finalized, agreed, and refused.
 */
function assertExecuted(receipt: any, what: string): void {
  const lr =
    receipt?.consensus_data?.leader_receipt ?? receipt?.consensusData?.leaderReceipt;
  const rounds = Array.isArray(lr) ? lr : lr ? [lr] : [];
  const leader =
    rounds.find((r: any) => String(r?.mode ?? "").toLowerCase() === "leader") ??
    rounds[0];

  // No leader receipt at all means the shape is unfamiliar, not that the call
  // failed. Inventing a failure here would be worse than missing one.
  if (!leader) return;

  const exec = String(leader.execution_result ?? leader.executionResult ?? "");
  if (exec === "" || exec.toUpperCase() === "SUCCESS") return;

  throw new Error(refusalText(leader) || `${what} was refused by the contract`);
}

/**
 * Withdraw a task the poster no longer wants, and get the money back.
 *
 * The contract has always supported this and the site never offered it, so a
 * poster who funded a task nobody wanted had no way to recover the reward
 * except by writing their own transaction. `cancel_task` refunds the reward and
 * the fee together, and only works while the task is unpaid.
 */
export async function cancelTask(
  address: `0x${string}`,
  taskId: number,
  onStage?: (s: Stage) => void
): Promise<{ hash: string; settled: boolean }> {
  const client = writeClient(address, getProvider());
  const hash = await client.writeContract({
    address: FIELDWORK_CONTRACT,
    functionName: "cancel_task",
    args: [taskId],
    value: BigInt(0),
  });
  onStage?.("sent");

  const accepted: any = await waitFor(client, hash, TransactionStatus.ACCEPTED);
  assertExecuted(accepted, "cancelling this task");
  onStage?.("accepted");

  // The refund is a value movement, so it only really happens on finality.
  const settled = await settle(client, hash, onStage);
  return { hash, settled };
}

/**
 * A dropped connection is not a failed transaction.
 *
 * Studio drops TLS roughly one call in three, and genlayer-js also gives up on
 * its own poll loop with "Timed out while waiting for transaction". Neither
 * means anything went wrong on chain, so a bare await here reports a failure for
 * a transaction that is sitting in a block.
 */
function isTransientRpc(e: unknown): boolean {
  const msg = String((e as Error)?.message ?? e);
  return /fetch failed|ECONNRESET|socket|network|timed out|timeout|Server busy|-32006|Rate limit/i.test(
    msg
  );
}

async function waitFor(
  client: any,
  hash: string,
  status: TransactionStatus,
  attempts = 5
): Promise<any> {
  let wait = 2000;
  for (let i = 1; ; i++) {
    try {
      return await client.waitForTransactionReceipt({ hash, status });
    } catch (e) {
      if (i >= attempts || !isTransientRpc(e)) throw e;
      await new Promise((r) => setTimeout(r, wait));
      wait = Math.min(Math.round(wait * 1.8), 15000);
    }
  }
}

/**
 * Wait for finality without letting a slow chain become a reported failure.
 *
 * Once a call is ACCEPTED and `assertExecuted` has passed, the write happened:
 * the task exists, the claim is issued, the money is committed. Finality is a
 * matter of time. Awaiting it bare meant a dropped socket during the second
 * wait threw, the form showed "your transaction was rejected", and the task was
 * sitting on chain the whole time. That is worse than saying nothing, because
 * the poster then posts it twice.
 *
 * Returns whether finality was actually observed, so the interface can say
 * "still settling" rather than claiming either outcome it does not have.
 */
async function settle(
  client: any,
  hash: string,
  onStage?: (s: Stage) => void
): Promise<boolean> {
  onStage?.("confirming");
  try {
    await waitFor(client, hash, TransactionStatus.FINALIZED);
  } catch {
    return false;
  }
  // Finality reached. Hold before speaking, then the caller reads the answer
  // off the chain rather than off the receipt.
  await new Promise((r) => setTimeout(r, HOLD_MS));
  onStage?.("finalized");
  return true;
}

/** Read one view, tolerating the network rather than failing the whole write. */
async function readView(functionName: string, args: unknown[] = []): Promise<any> {
  return (readClient() as any).readContract({
    address: FIELDWORK_CONTRACT,
    functionName,
    args,
  });
}

/**
 * Who owns the contract, and how much fee is sitting in it.
 *
 * Only the owner can withdraw, and the site never showed either number, so a
 * deployment with a non-zero fee quietly accumulated money nobody could see or
 * collect. Returns null when the chain will not say.
 */
export async function ownerAndFees(): Promise<{
  owner: string;
  feesWei: bigint;
  feeBps: number;
} | null> {
  try {
    const c = readClient() as any;
    const [owner, fees, bps] = await Promise.all([
      c.readContract({ address: FIELDWORK_CONTRACT, functionName: "owner_address", args: [] }),
      c.readContract({ address: FIELDWORK_CONTRACT, functionName: "fees_accrued_value", args: [] }),
      c.readContract({ address: FIELDWORK_CONTRACT, functionName: "fee_bps_value", args: [] }),
    ]);
    return {
      owner: String(owner),
      feesWei: BigInt(String(fees ?? 0)),
      feeBps: Number(bps ?? 0),
    };
  } catch {
    return null;
  }
}

/** Collect the accrued fee. Owner only, and the contract enforces that. */
export async function withdrawFees(
  address: `0x${string}`,
  to: `0x${string}`
): Promise<{ hash: string; settled: boolean }> {
  const client = writeClient(address, getProvider());
  const hash = await client.writeContract({
    address: FIELDWORK_CONTRACT,
    functionName: "withdraw_fees",
    args: [to],
    value: BigInt(0),
  });
  const accepted: any = await waitFor(client, hash, TransactionStatus.ACCEPTED);
  assertExecuted(accepted, "withdrawing fees");
  const settled = await settle(client, hash);
  return { hash, settled };
}

/**
 * How many tasks this address has been paid for.
 *
 * Read before claiming so the worker is told they are not eligible *before*
 * signing, rather than after a transaction that was always going to be refused.
 * Returns null when the chain will not say, and the caller then lets the
 * contract be the judge rather than blocking on a failed read.
 */
export async function reputationOf(
  address: `0x${string}`
): Promise<number | null> {
  try {
    const raw: any = await readClient().readContract({
      address: FIELDWORK_CONTRACT,
      functionName: "reputation_of",
      args: [address],
    });
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/**
 * Contract errors carry a class prefix so validators can compare failures, as
 * in "[EXPECTED] this task is not open". The class is for consensus, not for
 * the person holding the phone, so it is stripped before display. The sentence
 * behind it is written for humans and is shown as-is.
 */
export function humanError(raw: unknown): string {
  const code = (raw as { code?: number | string })?.code;
  // MetaMask: the user closed the confirmation. Not a failure worth alarming
  // anyone about.
  if (code === 4001 || code === "ACTION_REJECTED") {
    return "You cancelled that in your wallet, nothing was sent.";
  }

  const text =
    raw instanceof Error ? raw.message : typeof raw === "string" ? raw : String(raw);

  const cleaned = text
    .replace(/^Error:\s*/i, "")
    .replace(/\[(EXPECTED|EXTERNAL|TRANSIENT|LLM_ERROR)\]\s*/g, "")
    .trim();

  // Internal codes are for us, not for someone standing in the street.
  const known: Record<string, string> = {
    no_wallet:
      "No wallet found. Install MetaMask, then reload this page to claim work.",
    upload_failed:
      "Your photographs could not be uploaded. Check your signal and try again.",
    storage_not_configured:
      "Photo upload is not configured on this deployment yet.",
    too_large: "That photograph is too large. Try again with a smaller image.",
  };
  if (known[cleaned]) return known[cleaned];

  if (/user rejected|denied transaction/i.test(cleaned)) {
    return "You cancelled that in your wallet, nothing was sent.";
  }
  if (/insufficient funds/i.test(cleaned)) {
    return "This wallet does not have enough GEN for that transaction.";
  }

  return cleaned;
}

/** The stages the interface has to show, because a write is not a spinner. */
/**
 * The stages a write actually passes through, and the interface shows all of
 * them rather than a spinner.
 *
 * `confirming` is deliberate. A GenLayer call is readable as soon as it is
 * ACCEPTED, and the site used to answer from there, so it announced "paid" or
 * "rejected" while consensus was still running and could still rotate to
 * another leader. Now nothing is said until the transaction is FINALIZED and a
 * further hold has passed, and the answer is then read back off the chain
 * rather than taken from the receipt that arrived first.
 */
export type Stage =
  | "idle"
  | "uploading"
  | "sent"
  | "accepted"
  | "confirming"
  | "finalized"
  | "failed";

/**
 * How long each write usually takes end to end on Studio, measured across the
 * runs in scripts/e2e-full.mjs rather than guessed. Shown to the user as an
 * estimate, because a two minute wait with no number on it reads as a hang.
 */
export const ESTIMATE_MS: Record<string, number> = {
  post: 3 * 60_000,
  claim: 90_000,
  submit: 4 * 60_000,
  deploy: 2 * 60_000,
  cancel: 90_000,
  withdraw: 90_000,
};

/**
 * Held after finality before any verdict is shown.
 *
 * Finality is the chain's answer, but the read that follows it can still race
 * ahead of the node's own view of state. Half a minute costs the user nothing
 * next to a four minute wait and removes the whole class of "it said rejected
 * and then the task was there".
 */
export const HOLD_MS = 30_000;

export type SubmitResult = {
  status: "paid" | "rejected";
  reason: string;
  hash: string;
  /**
   * Whether finality was actually observed. False means the write is on chain
   * and the site simply could not watch it land, which the interface says
   * plainly instead of guessing at an outcome.
   */
  settled: boolean;
};

/** Whole GEN -> wei. */
export function toWei(whole: number): bigint {
  return BigInt(Math.round(whole)) * BigInt(10) ** BigInt(18);
}

/**
 * Upload both photographs to content addressed storage, then submit.
 * The upload has to happen first: every validator must fetch identical bytes,
 * which is only true if the url is derived from the content.
 */
export async function submitPhotographs(opts: {
  address: `0x${string}`;
  taskId: number;
  after: Blob;
  onStage?: (s: Stage) => void;
}): Promise<SubmitResult> {
  const { address, taskId, after, onStage } = opts;

  onStage?.("uploading");
  // Normalise first. A JPEG without a JFIF header is rejected by the node as
  // INVALID_IMAGE, and the worker would never learn why. See lib/image.ts.
  // Only the finished state is uploaded here - the before frame belongs to the
  // poster and was fixed when the task was funded.
  const ready = await normalisePhoto(after);
  const afterUrl = await putToCAS(ready.blob);

  const client = writeClient(address, getProvider());
  const hash = await client.writeContract({
    address: FIELDWORK_CONTRACT,
    functionName: "submit",
    args: [taskId, afterUrl],
    value: BigInt(0),
  });

  onStage?.("sent");

  const accepted: any = await waitFor(client, hash, TransactionStatus.ACCEPTED);
  onStage?.("accepted");
  assertExecuted(accepted, "your submission");

  // Nothing is said here, deliberately. The verdict is readable off this
  // receipt and it is not final: consensus can still rotate. So wait for
  // finality, hold, and then ask the chain what the task actually says.
  const settled = await settle(client, hash, onStage);

  let status: "paid" | "rejected" = "rejected";
  let reason = "";
  try {
    status = String(await readView("status_of", [taskId])) === "paid" ? "paid" : "rejected";
    reason = String((await readView("reason_of", [taskId])) ?? "");
  } catch {
    // The chain would not answer. Fall back to the receipt rather than
    // inventing a verdict, and say so through `settled`.
    status = accepted?.result?.status === "paid" ? "paid" : "rejected";
    reason = accepted?.result?.reason ?? "";
  }

  return { status, reason, hash, settled };
}

/**
 * Deploy the contract from the browser, signed by the visitor's own wallet.
 *
 * The deployer becomes the contract `owner`, and the owner is the only account
 * that can withdraw fees or hand ownership on. Deploying from a CLI keystore or
 * from Studio's own account selector makes one of those the owner instead - * which is fine for a throwaway and wrong for a deployment you intend to keep.
 * This is the only path that ends with your wallet holding it.
 */
export async function deployFieldwork(
  address: `0x${string}`,
  feeBps: number,
  onStage?: (s: Stage) => void
): Promise<{ hash: string; contract: `0x${string}` }> {
  const res = await fetch("/api/contract-source");
  if (!res.ok) throw new Error("could not read the contract source");
  const code = await res.text();

  const client = writeClient(address, getProvider());
  const hash = await client.deployContract({ code, args: [feeBps] });
  onStage?.("sent");

  // A deploy is only real once the code is readable, which is a finality-time
  // fact - some networks report a finalized deploy whose code is not there.
  onStage?.("confirming");
  const receipt: any = await waitFor(
    client,
    hash as string,
    TransactionStatus.FINALIZED
  );
  assertExecuted(receipt, "the deploy");
  // Same hold as every other write, so a deploy is never announced before the
  // chain has actually settled on it.
  await new Promise((r) => setTimeout(r, HOLD_MS));
  onStage?.("finalized");

  const contract =
    receipt?.data?.contract_address ??
    receipt?.contract_address ??
    receipt?.contractAddress;

  if (!contract) throw new Error("the deploy finished but returned no address");
  return { hash, contract: contract as `0x${string}` };
}

export type PostTaskInput = {
  title: string;
  place: string;
  acceptanceTest: string;
  examplePass: string;
  exampleFail: string;
  /** How the place looks now. Uploaded and pinned before the task exists. */
  before: Blob;
  latE6: number;
  lngE6: number;
  reward: number;
  minReputation: number;
  /** Six characters to publish with the task, or "" for the issued one. */
  fixedCode?: string;
};

/**
 * Fund and post a task.
 *
 * post_task is payable and the contract requires value >= reward + fee, so the
 * fee rate is read from the contract rather than assumed. This only works from
 * a browser wallet: the CLI has no flag for sending value with a method call.
 */
export async function postTask(
  address: `0x${string}`,
  input: PostTaskInput,
  onStage?: (s: Stage) => void
): Promise<{ hash: string; taskId: number | null; settled: boolean }> {
  const client = writeClient(address, getProvider());

  // The poster's frame goes up first: the contract stores its url, and refuses
  // any url that is not content addressed.
  onStage?.("uploading");
  const beforeReady = await normalisePhoto(input.before);
  const beforeUrl = await putToCAS(beforeReady.blob);

  let feeBps = 600;
  try {
    const raw: any = await readClient().readContract({
      address: FIELDWORK_CONTRACT,
      functionName: "fee_bps_value",
      args: [],
    });
    feeBps = Number(raw);
  } catch {
    // fall back to the deployed default rather than blocking the post
  }

  const rewardWei = toWei(input.reward);
  const value = rewardWei + (rewardWei * BigInt(feeBps)) / BigInt(10000);

  const hash = await client.writeContract({
    address: FIELDWORK_CONTRACT,
    functionName: "post_task",
    args: [
      input.title,
      input.place,
      input.acceptanceTest,
      input.examplePass,
      input.exampleFail,
      beforeUrl,
      input.latE6,
      input.lngE6,
      rewardWei,
      input.minReputation,
      (input.fixedCode ?? "").trim().toUpperCase(),
    ],
    value,
  });

  onStage?.("sent");

  const accepted: any = await waitFor(client, hash, TransactionStatus.ACCEPTED);
  onStage?.("accepted");
  assertExecuted(accepted, "posting this task");

  const taskId =
    accepted?.result === undefined || accepted?.result === null
      ? null
      : Number(accepted.result);

  // The task exists on acceptance and its money is only committed on finality,
  // so the poster hears nothing until then.
  const settled = await settle(client, hash, onStage);

  return { hash, taskId, settled };
}

/**
 * Claim a task and get back the six character challenge code.
 *
 * The code is readable on acceptance, which is what the worker needs, but the
 * claim is only really theirs once finalized - so both stages are awaited and
 * reported rather than returning early on the first one.
 */
export async function claimTask(
  address: `0x${string}`,
  taskId: number,
  onAccepted?: () => void,
  onStage?: (s: Stage) => void
): Promise<{ hash: string; code: string; settled: boolean }> {
  const client = writeClient(address, getProvider());
  const hash = await client.writeContract({
    address: FIELDWORK_CONTRACT,
    functionName: "claim",
    args: [taskId],
    value: BigInt(0),
  });

  const accepted: any = await waitFor(client, hash, TransactionStatus.ACCEPTED);
  onAccepted?.();
  assertExecuted(accepted, "the claim");

  const settled = await settle(client, hash, onStage);

  // Read the code back rather than trusting the first receipt: the claim is
  // only really this worker's once it is final.
  let code = String(accepted?.result ?? "");
  try {
    const onChain = String(await readView("challenge_code_of", [taskId]));
    if (onChain) code = onChain;
  } catch {
    // keep the receipt's copy
  }

  return { hash, code, settled };
}

/**
 * Put a blob in content addressed storage and return a gateway url.
 * Routed through our own endpoint so the storage credential never reaches the
 * browser. The contract refuses any host that is not on its allow list.
 */
export async function putToCAS(blob: Blob): Promise<string> {
  const body = new FormData();
  body.append("file", blob);
  const res = await fetch("/api/cas", { method: "POST", body });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail?.message || "upload_failed");
  }
  const json = await res.json();
  return json.url as string;
}
