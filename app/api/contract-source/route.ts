import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

/**
 * The contract, as text.
 *
 * Two jobs. The deploy page needs the source to hand to the chain, and anyone
 * reviewing the running site can read exactly what is deployed without cloning
 * the repository. It is the same file either way — there is no build step
 * between `contracts/fieldwork.py` and what gets deployed.
 */

export const runtime = "nodejs";
export const revalidate = 3600;

export async function GET() {
  try {
    const file = path.join(process.cwd(), "contracts", "fieldwork.py");
    const source = await readFile(file, "utf8");
    return new NextResponse(source, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "contract_source_unavailable" },
      { status: 500 }
    );
  }
}
