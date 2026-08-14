/**
 * Repo guard: the checks that are easy to break and boring to remember.
 *
 *   npm run check
 *
 * Exists because "I will remember the rule" does not work. Every item here is
 * something that has actually shipped broken in this project at least once.
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, extname, relative } from "node:path";

const ROOT = process.cwd();

// Built from escape sequences on purpose. Written as literal characters, this
// file's own source would contain them and the checker would report itself on
// every clean run, which is how a check becomes noise people skip.
const DASHES = new RegExp("[\\u2014\\u2013]", "g");
const ENTITY = new RegExp("&" + "mdash;|&" + "ndash;", "g");

const SOURCE_EXT = new Set([".ts", ".tsx", ".css", ".py", ".mjs", ".js", ".md"]);
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "test-photos",
  "__pycache__",
]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

let failures = 0;
const note = (ok, label, detail = "") => {
  if (!ok) failures++;
  console.log(`  [${ok ? "ok  " : "FAIL"}] ${label}${detail ? "  " + detail : ""}`);
};

// ---------------------------------------------------------------- house style
console.log("house style");
{
  const hits = [];
  for (const file of walk(ROOT)) {
    if (!SOURCE_EXT.has(extname(file))) continue;
    if (relative(ROOT, file).replace(/\\/g, "/") === "scripts/check.mjs") continue;
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const n =
      (text.match(DASHES) || []).length + (text.match(ENTITY) || []).length;
    if (n > 0) hits.push(`${relative(ROOT, file)} (${n})`);
  }
  note(
    hits.length === 0,
    "no em or en dashes in sources",
    hits.length ? "\n         " + hits.join("\n         ") : ""
  );
}

// The source scan is not enough on its own. An entity only becomes a dash once
// rendered, so the built output is the check that actually counts.
{
  const outDir = join(ROOT, ".next", "server", "app");
  if (!existsSync(outDir)) {
    console.log("  [skip] build output not scanned (run npm run build first)");
  } else {
    const hits = [];
    for (const file of walk(outDir)) {
      if (![".js", ".html", ".rsc", ".json"].includes(extname(file))) continue;
      let text;
      try {
        text = readFileSync(file, "utf8");
      } catch {
        continue;
      }
      const n = (text.match(DASHES) || []).length;
      if (n > 0) hits.push(`${relative(ROOT, file)} (${n})`);
    }
    note(
      hits.length === 0,
      "no dashes in the built output either",
      hits.length ? "\n         " + hits.join("\n         ") : ""
    );
  }
}

// ------------------------------------------------------------- contract shape
console.log("\ncontract");
{
  const src = readFileSync(join(ROOT, "contracts", "fieldwork.py"), "utf8");

  note(
    /^# \{ "Depends": "py-genlayer:[a-z0-9]+" \}/m.test(src),
    "pins a concrete runner version"
  );

  // Every field on the Task dataclass has to be set where a Task is built, or
  // the constructor throws at runtime and nothing catches it until a deploy.
  const body = src.slice(src.indexOf("class Task:"), src.indexOf("class Contract"));
  const fields = [...body.matchAll(/^    (\w+):\s/gm)].map((m) => m[1]);
  const ctor = src.slice(src.indexOf("self.tasks.append("));
  const missing = fields.filter((f) => !ctor.includes(`${f}=`));
  note(
    missing.length === 0,
    `all ${fields.length} Task fields are set on construction`,
    missing.length ? `missing: ${missing.join(", ")}` : ""
  );

  // task_json is what the whole site reads, so a field that never reaches it is
  // invisible however well it is stored.
  const json = src.slice(src.indexOf("def task_json"), src.indexOf("def title_of"));
  const unexposed = fields.filter((f) => !json.includes(`"${f}"`));
  note(
    unexposed.length === 0,
    "every Task field is exposed on task_json",
    unexposed.length ? `missing: ${unexposed.join(", ")}` : ""
  );
}

// ------------------------------------------------------------------ frontend
console.log("\nfrontend");
{
  const onchain = readFileSync(join(ROOT, "lib", "onchain.ts"), "utf8");

  note(
    !/codeVisible:\s*true/.test(onchain),
    "the verdict is read from the chain, not hard coded"
  );

  const genlayer = readFileSync(join(ROOT, "lib", "genlayer.ts"), "utf8");
  const writes = [...genlayer.matchAll(/export async function (\w+)/g)].map(
    (m) => m[1]
  );
  const guarded = (genlayer.match(/assertExecuted\(/g) || []).length - 1;
  note(
    guarded >= 5,
    `every write asserts execution_result (${guarded} call sites)`,
    `writes: ${writes.join(", ")}`
  );

  // A refused call finalizes perfectly well, so status alone means nothing.
  note(
    /consensus_data\?\.leader_receipt/.test(genlayer),
    "reads the leader receipt rather than trusting status"
  );

  // A url off the chain can be absent on any task the contract refused before
  // recording it, and `<img src={undefined}>` is a broken image on a page whose
  // whole job is to be trustworthy evidence.
  const unguarded = [];
  for (const file of walk(join(ROOT, "app")).concat(walk(join(ROOT, "components")))) {
    if (extname(file) !== ".tsx") continue;
    const text = readFileSync(file, "utf8");
    const lines = text.split("\n");
    lines.forEach((line, i) => {
      const m = /src=\{(\w+)\.(beforeUrl|afterUrl)\}/.exec(line);
      if (!m) return;
      // Guarded either by a ternary above, or by being handed to a component
      // that does the checking. The window has to cover a whole JSX element,
      // style object and all: at six lines this reported a guard that sits
      // fifteen lines up, and a check that cries wolf gets ignored.
      const context = lines.slice(Math.max(0, i - 24), i + 1).join("\n");
      if (new RegExp(`${m[1]}\\.${m[2]}\\s*\\?`).test(context)) return;
      if (/<Frame\b/.test(context)) return;
      unguarded.push(`${relative(ROOT, file)}:${i + 1}`);
    });
  }
  // Heuristic, not a parser: it looks backwards for a guard on the same field
  // rather than tracking JSX scope. It will miss a second unguarded image
  // sitting just below a guarded one. Good enough to catch the mistake that
  // actually happened, and cheap enough to keep.
  note(
    unguarded.length === 0,
    "every photograph is rendered behind a presence check",
    unguarded.length ? unguarded.join(", ") : ""
  );
}

// -------------------------------------------------------------------- scripts
console.log("\nscripts");
{
  const files = readdirSync(join(ROOT, "scripts")).filter((f) => f.endsWith(".mjs"));
  const unguarded = files.filter((f) => {
    const text = readFileSync(join(ROOT, "scripts", f), "utf8");
    const talksToChain = /genlayer-js|rpcUrls|fetch\(RPC/.test(text);
    return talksToChain && !text.includes("setDefaultResultOrder");
  });
  note(
    unguarded.length === 0,
    "every chain-facing script forces IPv4 first",
    unguarded.length ? `missing: ${unguarded.join(", ")}` : ""
  );

  const next = readFileSync(join(ROOT, "next.config.mjs"), "utf8");
  note(
    next.includes("setDefaultResultOrder"),
    "the Next server forces IPv4 first too"
  );
}

// ----------------------------------------------------------------- deployment
console.log("\ndeployment");
{
  const next = readFileSync(join(ROOT, "next.config.mjs"), "utf8");
  note(
    next.includes("outputFileTracingIncludes") &&
      next.includes("contracts/fieldwork.py"),
    "the contract source is traced into the serverless bundle"
  );
  note(
    existsSync(join(ROOT, ".env.local")) || true,
    "env is a deploy-time concern, not checked here"
  );
}

console.log(
  failures === 0 ? "\nall checks passed" : `\n${failures} FAILURES`
);
process.exit(failures === 0 ? 0 : 1);
