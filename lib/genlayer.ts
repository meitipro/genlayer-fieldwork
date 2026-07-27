// Wiring to the Fieldwork Intelligent Contract on GenLayer Testnet Bradbury.
// Writes go through the browser wallet; reads go through a cached server route.

import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

export const FAUCET_URL = "https://testnet-faucet.genlayer.foundation/";

export const FIELDWORK_CONTRACT = (process.env
  .NEXT_PUBLIC_FIELDWORK_CONTRACT || "") as `0x${string}`;

export const IS_LIVE = FIELDWORK_CONTRACT.length > 0;

const BRADBURY = {
  chainIdHex: "0x107d", // 4221
  chainName: "GenLayer Testnet Bradbury",
  rpcUrls: ["https://rpc-bradbury.genlayer.com"],
  nativeCurrency: { name: "GenLayer", symbol: "GEN", decimals: 18 },
  blockExplorerUrls: ["https://explorer.testnet-chain.genlayer.com"],
};

/* eslint-disable @typescript-eslint/no-explicit-any */

export function readClient() {
  return createClient({ chain: testnetBradbury });
}

export function writeClient(address: `0x${string}`, provider: any) {
  return createClient({ chain: testnetBradbury, account: address, provider });
}

async function ensureNetwork(provider: any): Promise<void> {
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: BRADBURY.chainIdHex }],
    });
  } catch (e: any) {
    const code = e?.code ?? e?.data?.originalError?.code;
    if (code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: BRADBURY.chainIdHex,
            chainName: BRADBURY.chainName,
            rpcUrls: BRADBURY.rpcUrls,
            nativeCurrency: BRADBURY.nativeCurrency,
            blockExplorerUrls: BRADBURY.blockExplorerUrls,
          },
        ],
      });
    } else {
      throw e;
    }
  }
}

export async function connectWallet(): Promise<string> {
  const provider = (globalThis as any).ethereum;
  if (!provider) throw new Error("no_wallet");
  const accounts: string[] = await provider.request({
    method: "eth_requestAccounts",
  });
  await ensureNetwork(provider);
  return accounts[0];
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
  const provider = (globalThis as any).ethereum;
  if (!provider) throw new Error("no_wallet");

  onStage?.("uploading");
  const [beforeUrl, afterUrl] = await Promise.all([
    putToCAS(before),
    putToCAS(after),
  ]);

  const client = writeClient(address, provider);
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
 * Put a blob in content addressed storage and return a gateway url.
 * Routed through our own endpoint so the storage credential never reaches the
 * browser. The contract refuses any host that is not on its allow list.
 */
export async function putToCAS(blob: Blob): Promise<string> {
  const body = new FormData();
  body.append("file", blob);
  const res = await fetch("/api/cas", { method: "POST", body });
  if (!res.ok) throw new Error("upload_failed");
  const json = await res.json();
  return json.url as string;
}
