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

### Deadline run on `0x25886d12efC9cce0CB141cb18D6a56ed9a2e41fA`

`scripts/e2e-deadline.mjs`, 2026-10-12, 14:11 to 15:19 UTC, fee 0. Every
refusal below carries the contract's own sentence (read with
`scripts/explain-tx.mjs`).

| Step | Transaction | Outcome |
| --- | --- | --- |
| Post with no deadline | `0x1698aa701b06ecdb258ec73e90b0217e60b7f6a38bc9b7950f1c50ddfeee3d21` | accepted, `open_until` empty |
| A stranger closes it | `0xe1eb7c59d305e4d469ab74c71d1456d43190ea0f3779d4f320615b1e6b336a2d` | refused: posted with no deadline, so only the poster can withdraw it |
| Deadline under an hour | `0x736634a01b3b50e2c66592d91c75d9938d0396fed8176d027db15e75ad9835ac` | refused: a task that closes in under an hour leaves nobody time to see it |
| Deadline shorter than the claim window | `0xff1a3411c32b176c6f23c3e1e010dfb8f15468135efe80b10f35924e5f76bab7` | refused: give it at least 120 minutes |
| Deadline over a year | `0xc0c26822cf9ff7561728edcfec808612e8b417188adc5d6a87eda5cecce2a646` | refused: at most a year |
| Post A, 60 minutes | `0xbde2584d6dd2718a7b9f4ddd21881f40a8022b1685cd4bb45d92ff55a995caa3` | accepted, `open_until` 15:15:08 |
| Post B, 60 minutes | `0x76913f4a22bf5d73bc5ea5d207a2ecb8cac7e49c53a1483e5ee21320ccdef0c9` | accepted, `open_until` 15:16:05 |
| A stranger closes A early | `0x78eead1009eae6b9111f648853c7cce7eb19b9091c3ebc1b7ed539d9c8867ae2` | refused: this task is open until 2026-10-12T15:15:08 |
| Claim B, 30 minute window, 20 minutes before its deadline | `0xb8ca66143fc9c0a3e50b7c1cf7fed10d7aca865a9b1ab45913d090ab3a9e7c8c` | accepted, `claim_expires` 15:16:05, equal to `open_until` (unclamped it would have run to 15:30) |
| A stranger closes B over a live claim | `0xf2cc5dd568583852b76a09dcf7fe31d11ea628360c5bd0aa58cc3b982d74797d` | refused: only a task that is open and unclaimed can be closed this way |
| A stranger closes A after the deadline | `0x4860996e1ce00ee0ee246d907b57c86df17cb886c3ce8cdf46d76bf3a4f70eba` | accepted, status `expired` |
| A stranger closes B after its claim ran out with the deadline | `0x611e58a042f9a3b617c13e0468da97ce398aea2c396cf056bf2f1bdd2320896f` | accepted, status `expired` |
| A stranger closes A again | `0x5bda256e9dd8793c915cd60edc2627f2391ebab1b175fd845bc703f335090aae` | refused: only a task that is open and unclaimed can be closed this way |

The three refused deadlines were sent again after the run to capture their
hashes and sentences, because the run did not print them; same instance, same
arguments. The first attempt of the run itself (an earlier instance) stopped on
a proxy error page and was repeated with retries on dropped replies.

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
