// Wiring to the Fieldwork Intelligent Contract.
// Writes go through the browser wallet; the network comes from lib/chain.ts.

import { createClient } from "genlayer-js";
import { TransactionStatus } from "genlayer-js/types";
import { chain, walletChainParams, REQUIRES_GAS } from "./chain";
import { normalisePhoto } from "./image";

export { FAUCET_URL, EXPLORER, txUrl, addressUrl, NETWORK, IS_STUDIO, REQUIRES_GAS } from "./chain";

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

/** The stages the interface has to show, because a write is not a spinner. */
export type Stage =
  | "idle"
  | "uploading"
  | "sent"
  | "accepted"
  | "finalized"
  | "failed";

export type SubmitResult = {
  status: "paid" | "rejected";
  reason: string;
  hash: string;
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
  before: Blob;
  after: Blob;
  onStage?: (s: Stage) => void;
}): Promise<SubmitResult> {
  const { address, taskId, before, after, onStage } = opts;

  onStage?.("uploading");
  // Normalise first. A JPEG without a JFIF header is rejected by the node as
  // INVALID_IMAGE, and the worker would never learn why. See lib/image.ts.
  const [beforeReady, afterReady] = await Promise.all([
    normalisePhoto(before),
    normalisePhoto(after),
  ]);
  const [beforeUrl, afterUrl] = await Promise.all([
    putToCAS(beforeReady.blob),
    putToCAS(afterReady.blob),
  ]);

  const client = writeClient(address, getProvider());
  const hash = await client.writeContract({
    address: FIELDWORK_CONTRACT,
    functionName: "submit",
    args: [taskId, beforeUrl, afterUrl],
    value: BigInt(0),
  });

  onStage?.("sent");

  // The verdict is readable on acceptance, so the worker is told immediately.
  const accepted: any = await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
  });
  onStage?.("accepted");

  const status = accepted?.result?.status === "paid" ? "paid" : "rejected";
  const reason = accepted?.result?.reason ?? "";

  if (status === "paid") {
    // The coins themselves move on finality, which is seconds later.
    await client.waitForTransactionReceipt({
      hash,
      status: TransactionStatus.FINALIZED,
    });
    onStage?.("finalized");
  }

  return { status, reason, hash };
}

export type PostTaskInput = {
  title: string;
  place: string;
  acceptanceTest: string;
  examplePass: string;
  exampleFail: string;
  latE6: number;
  lngE6: number;
  reward: number;
  minReputation: number;
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
): Promise<{ hash: string; taskId: number | null }> {
  const client = writeClient(address, getProvider());

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
      input.latE6,
      input.lngE6,
      rewardWei,
      input.minReputation,
    ],
    value,
  });

  onStage?.("sent");

  const accepted: any = await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
  });
  onStage?.("accepted");

  const taskId =
    accepted?.result === undefined || accepted?.result === null
      ? null
      : Number(accepted.result);

  return { hash, taskId };
}

/** Claim a task and get back the six character challenge code. */
export async function claimTask(
  address: `0x${string}`,
  taskId: number
): Promise<{ hash: string; code: string }> {
  const client = writeClient(address, getProvider());
  const hash = await client.writeContract({
    address: FIELDWORK_CONTRACT,
    functionName: "claim",
    args: [taskId],
    value: BigInt(0),
  });
  const accepted: any = await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
  });
  return { hash, code: String(accepted?.result ?? "") };
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
