# Milestone 01: task deadlines

Reviewed baseline: `4291b588cca81cc3aa00a69ac150e0fff37cb3da` (2026-08-16).
Milestone head: `4d9835c1ebed138f97eb8dca6df3c1286cf4ae5f` (2026-09-14).
Comparison: https://github.com/meitipro/genlayer-fieldwork/compare/4291b588cca81cc3aa00a69ac150e0fff37cb3da...4d9835c1ebed138f97eb8dca6df3c1286cf4ae5f

Everything below is pinned to the milestone head. Later commits only add
tooling and evidence around it and do not change the contract.

## What it adds

An unclaimed task used to hold its reward until the poster came back for it.
A task can now carry its own deadline.

- `post_task` takes `open_minutes` as a thirteenth argument. Zero keeps the old
  behaviour exactly. Otherwise it must be an hour to a year, and not shorter
  than the claim window the task offers.
- `expire_task(task_id)` closes a task whose deadline has passed with nobody
  holding it. Anyone can call it. The reward and the fee go back to the poster
  in one transaction and the status becomes `expired`.
- A claim is clamped to the deadline, so a live claim can never outlive it or
  block the refund. A claim that ran out is returned to the pool before the
  task is judged.
- `open_until_of` and `task_json` expose the deadline. The task page shows the
  close action once a deadline has passed.

Shipped in the same commit: an exposure pre-check in the browser that mirrors
the contract's thresholds and never blocks (the Pillow build inside GenVM has no
JPEG decoder, so the contract skips that measurement on JPEG), and a deploy that
is byte-matchable against the repository.

## Where it is (pinned to 4d9835c)

| Piece | File |
| --- | --- |
| Deadline bounds | `contracts/fieldwork.py` L42-L43, L251-L270 |
| Deadline test | `contracts/fieldwork.py` L302-L304 |
| `post_task` signature | `contracts/fieldwork.py` L333-L366 |
| Claim checks and clamp | `contracts/fieldwork.py` L510-L560 |
| `expire_task` | `contracts/fieldwork.py` L786-L827 |
| `open_until_of` | `contracts/fieldwork.py` L988 |
| Site call sites | `lib/genlayer.ts` L185 (`expireTask`), L628 (`postTask`) |
| Close action | `components/ExpireTask.tsx` |
| Reasoning, method by method | `contracts/RATIONALE.md` |

## Digests

`sha256` of `contracts/fieldwork.py` with LF line endings:

| Commit | sha256 | Bytes |
| --- | --- | --- |
| `4291b58` (reviewed) | `8b3c36d5d329dafc3e452d0cabecf569aa5104cab508c797d9ed6b48e7e7c9dd` | 51,802 |
| `4d9835c` (milestone) | `36714c24737f25b45f32fe89aa2b11db5e34fe4562e7b2e8bd6a734468ebb408` | 51,686 |

Reproduce with `git show <sha>:contracts/fieldwork.py | tr -d '\r' | sha256sum`.
The running site serves the milestone source at `/api/contract-source` and its
digest is the second row.

## Evidence, 2026-10-12

Studio, fee 0, throwaway instances deployed by `scripts/deploy.mjs`. Each was
compared against the repository with `npm run verify-source`, which reads the
bytes back from the chain with `gen_getContractCode`.

| Instance | Deploy transaction | Result |
| --- | --- | --- |
| `0x1A9e3b878DfC1b6E15f8984bbf71e7D440c65BfD` | `0x99190cec221970c3715054f73024ff68756cb4f1d11d13d4bc2694edb9ed4b35` | `MATCH`, 51,686 bytes; `scripts/e2e.mjs` passed (post, vague test refused, underfunded refused, claim, double claim refused) |
| `0x0594311b0F1bcc405491149c94913Cb5D29a4315` | `0x2066b214d52d6a5a59fb578a8f5dca344e3df454cde89b76e1c734d1c65226c0` | `MATCH`; used to check the site against a contract that carries deadlines |
| `0x25886d12efC9cce0CB141cb18D6a56ed9a2e41fA` | `0x54d91b010f9ea8a66ee361f2059c44749dee6889812aa974bef94052dd579673` | `MATCH`; `scripts/e2e-deadline.mjs` run |

Off chain: `python contracts/test_contract_logic.py` (97 checks) and
`npm run check` pass; `genvm-lint check` passes its lint stage.

## The state of the live deployment

The site at `field-works.xyz` is the milestone head, but the contract it points
at, `0xcb598d7cc755890A74cdc5392f0e68A404546C41` on Studio, runs the reviewed
baseline: its bytes are the `4291b58` digest above, and it has no
`expire_task`. Deadlines are therefore not live there yet. Making them live is
a new deployment from the owner's wallet at `/deploy`, then
`npm run verify-source -- <address>` until it prints `MATCH`, then setting
`NEXT_PUBLIC_FIELDWORK_CONTRACT` and deploying the site.

Until then the site stays usable against the old contract: it reads the
contract's schema, posts the twelve arguments that contract takes and hides the
deadline control (`lib/genlayer.ts`, `contractHasDeadlines`). Before that change
every post from the site failed on the argument count.
