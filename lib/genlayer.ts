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
 * Contract errors carry a class prefix so validators can compare failures —
 * "[EXPECTED] this task is not open". The class is for consensus, not for the
 * person holding the phone, so it is stripped before display. The sentence
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

/**
 * Deploy the contract from the browser, signed by the visitor's own wallet.
 *
 * The deployer becomes the contract `owner`, and the owner is the only account
 * that can withdraw fees or hand ownership on. Deploying from a CLI keystore or
 * from Studio's own account selector makes one of those the owner instead —
 * which is fine for a throwaway and wrong for a deployment you intend to keep.
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
  // fact — some networks report a finalized deploy whose code is not there.
  const receipt: any = await client.waitForTransactionReceipt({
    hash: hash as `0x${string}` & { length: 66 },
    status: TransactionStatus.FINALIZED,
  });
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

  // The task exists on acceptance, but the funds it holds are only committed on
  // finality, so the poster is not told it is live until then.
  await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.FINALIZED,
  });
  onStage?.("finalized");

  return { hash, taskId };
}

/**
 * Claim a task and get back the six character challenge code.
 *
 * The code is readable on acceptance, which is what the worker needs, but the
 * claim is only really theirs once finalized — so both stages are awaited and
 * reported rather than returning early on the first one.
 */
export async function claimTask(
  address: `0x${string}`,
  taskId: number,
  onAccepted?: () => void
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
  onAccepted?.();

  const code = String(accepted?.result ?? "");

  await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.FINALIZED,
  });

  return { hash, code };
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
