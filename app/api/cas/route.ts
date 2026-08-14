import { NextResponse } from "next/server";

/**
 * Put an uploaded photograph into content addressed storage.
 *
 * This runs on the server so the storage credential never reaches the browser.
 * The url handed back must be content addressed: the contract refuses any host
 * that is not on its allow list, because a mutable url would let the leader and
 * the validators grade two different photographs.
 */

export const runtime = "nodejs";

const PINATA_JWT = process.env.PINATA_JWT || "";
const GATEWAY = process.env.CAS_GATEWAY || "https://gateway.pinata.cloud";

/**
 * The contract's own allow list, mirrored.
 *
 * A `CAS_GATEWAY` pointing anywhere else is a deployment that uploads fine and
 * then has every single submission refused on chain with "photograph must sit
 * in content addressed storage" - a failure that looks like the contract is
 * broken and is really one environment variable. Catch it at the upload, where
 * the message can name the actual cause.
 */
const ALLOWED_HOSTS = [
  "ipfs.io",
  "w3s.link",
  "dweb.link",
  "cf-ipfs.com",
  "gateway.pinata.cloud",
];

function gatewayIsAllowed(): boolean {
  try {
    const host = new URL(GATEWAY).hostname.toLowerCase();
    return ALLOWED_HOSTS.some((h) => host === h || host.endsWith("." + h));
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  if (!gatewayIsAllowed()) {
    return NextResponse.json(
      {
        error: "gateway_not_allowed",
        message:
          `CAS_GATEWAY is set to ${GATEWAY}, which the contract will not accept. ` +
          `It only reads photographs from ${ALLOWED_HOSTS.join(", ")}, because a ` +
          `mutable url would let the leader and the validators grade two ` +
          `different photographs.`,
      },
      { status: 500 }
    );
  }

  if (!PINATA_JWT) {
    return NextResponse.json(
      {
        error: "storage_not_configured",
        message:
          "Set PINATA_JWT to upload photographs. Without it nothing can be submitted, because the contract only accepts content addressed urls.",
      },
      { status: 501 }
    );
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "no_file" }, { status: 400 });
  }
  if (file.size > 12 * 1024 * 1024) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }

  const out = new FormData();
  out.append("file", file, "photo.jpg");

  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${PINATA_JWT}` },
    body: out,
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: "upload_failed", status: res.status },
      { status: 502 }
    );
  }

  const json = await res.json();
  const cid = json.IpfsHash as string;
  return NextResponse.json({ cid, url: `${GATEWAY}/ipfs/${cid}` });
}
