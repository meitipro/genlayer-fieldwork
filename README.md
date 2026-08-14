<div align="center">

# Fieldwork

**Evidence in, settlement out.**

Bounties for physical work, settled by photograph against a written standard.
The verdict and the payment leave the contract as a single transaction.

[![Built by InferNode](https://img.shields.io/badge/built%20by-InferNode-7ac943?style=flat-square)](https://github.com/meitipro)
[![GenLayer](https://img.shields.io/badge/GenLayer-Intelligent%20Contract-101216?style=flat-square)](https://genlayer.com)
[![Network](https://img.shields.io/badge/network-Studio%20%C2%B7%2061999-101216?style=flat-square)](https://explorer-studio.genlayer.com)
[![Next.js 14](https://img.shields.io/badge/Next.js-14-101216?style=flat-square)](https://nextjs.org)
[![Contract](https://img.shields.io/badge/contract-36%20methods%20%C2%B7%20lint%20clean-7ac943?style=flat-square)](contracts/fieldwork.py)

[Documentation](docs/DOCUMENTATION.md) · [Deployment runbook](DEPLOY.md) · [Contract notes](contracts/README.md) · [The honest limits](#what-this-cannot-do)

</div>

---

## Overview

Someone posts a real world task and writes down exactly what "done" looks like.
They photograph how the place looks right now, and they lock the payment. A
worker claims it, does the work, and photographs the result. An Intelligent
Contract on GenLayer grades the two photographs against the written standard and
settles.

Two design decisions carry the product:

**The standard is frozen before anyone spends time.** The acceptance test is
written at posting, published on the task page, and is the exact text handed to
the graders. The contract refuses a test too vague to grade from a photograph
before the task can be funded.

**The before photograph belongs to whoever is paying.** A worker who supplies
both frames can photograph a mess, clear it, photograph it again, and be paid
for work nobody needed. Taking that frame at posting time removes the whole
class of fraud, and it gives the worker something honest in return: they can see
the state they are being measured against before they walk anywhere.

Built by **InferNode**. Project 09 of 10 in the InferNode GenLayer build brief
series.

---

## How it works

| | Step | What the contract does |
| --- | --- | --- |
| 1 | The poster writes an acceptance test and photographs the place | Opens the photograph, reads the test, and refuses either if nobody could grade it - before the money is committed |
| 2 | The poster funds the task | Holds the reward plus the fee. Overpayment is banked rather than stranded |
| 3 | A worker claims it | Issues a six character code derived from the task, the worker and the moment, for the window the poster chose |
| 4 | The worker photographs the finished work with the code in frame | One frame, not two - the before frame is already on the task |
| 5 | Validators grade | Every validator fetches the same two photographs and grades them against the same text |
| 6 | Settlement | Verdict and payment in one transaction, and a public receipt is left behind |

Validators must agree on three judgements before a coin moves: **the code is
legible**, **both frames show the same place**, and **the acceptance test
passed**. No single party decides - not the poster, not one model, not one node.

---

## Why this needs GenLayer

The contract does not use a model as a backend. It uses one where a **judgement
has to be settled between parties who do not trust each other**.

A poster and a worker disagree about whether a job was done. Today the poster
decides, days later, with a model they own, which is exactly the arrangement
workers distrust. Here the standard is public before anyone spends time, several
validators grade the same evidence against that same text independently, and
they must agree before a single coin moves.

Nothing about that reduces to a deterministic API call, and nothing about it is
safe to let one party compute. That boundary is the whole architecture:

- **The contract owns** the acceptance test, the challenge code, the grading,
  the reuse checks and the payout.
- **The frontend owns** the camera, the checklist, the uploads and the map.
- **Storage owns** the photographs, content addressed so every validator
  provably grades identical bytes.

---

## Quick start

```bash
npm install
npm run dev
```

Without `NEXT_PUBLIC_FIELDWORK_CONTRACT` set, the site runs on seed records and
every write explains that nothing was sent. Every screen reads through
`lib/onchain.ts`, so pointing it at a live contract is one environment variable,
and an unreachable chain degrades to the seed records rather than a 500.

Vision on GenLayer is proven, not assumed. Reproduce it in one command - no
account and no faucet, because Studio is gasless:

```bash
node scripts/prove-vision.mjs
```

### Deploy your own

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmeitipro%2Fgenlayer-fieldwork&env=NEXT_PUBLIC_GENLAYER_NETWORK%2CPINATA_JWT%2CCAS_GATEWAY&envDescription=Network+is+studionet.+PINATA_JWT+is+optional+at+first+-+without+it+every+page+works+and+only+photo+upload+is+disabled.+Add+NEXT_PUBLIC_FIELDWORK_CONTRACT+afterwards%2C+once+you+have+deployed+the+contract+from+%2Fdeploy.&envLink=https%3A%2F%2Fgithub.com%2Fmeitipro%2Fgenlayer-fieldwork%2Fblob%2Fmaster%2FDEPLOY.md&project-name=genlayer-fieldwork&repository-name=genlayer-fieldwork)

Leave `NEXT_PUBLIC_FIELDWORK_CONTRACT` out at first. Deploy the contract from
`/deploy` on the live URL with your own wallet - the deployer becomes the
contract owner - then add the address it returns.

[`DEPLOY.md`](DEPLOY.md) is the full runbook, with what "worked" looks like at
each step, because on this stack a failure often reports success.

---

## The contract

[`contracts/fieldwork.py`](contracts/fieldwork.py). **36 methods, 29 view and 7
write**, `genvm-lint` clean. There is no build step between that file and the
chain: what you read is what runs, and it is served live at
`/api/contract-source`.

### Writes

| Method | Caller |
| --- | --- |
| `post_task(...)` | Anyone. Payable, and must carry reward plus fee |
| `claim(task_id)` | Anyone meeting the reputation bar. Returns the challenge code |
| `submit(task_id, after_url)` | The claimant only. Returns `paid` or `rejected` |
| `release_expired(task_id)` | Anyone. Returns an abandoned task to the pool |
| `cancel_task(task_id)` | The poster only, while no live claim holds it |
| `withdraw_fees(to)` | The owner only |
| `transfer_ownership(new_owner)` | The owner only |

29 views cover every field on a task, plus reputation, fees and ownership.
`task_json` returns a whole task in one call, which is what the site reads:
twenty tasks through the per field views would be twenty times a dozen round
trips against a 30 requests per minute limit.

### Notable behaviour

- **The claim window is the poster's choice**, between ten minutes and a week.
  Below ten minutes a task is not a task but a trap; above a week one worker can
  sit on it to keep everyone else off.
- **A rejection does not cost the claim.** Most failures are lighting and
  framing, not fraud, so the task stays with the worker and can be retaken
  inside the same window.
- **An abandoned task returns to the pool carrying nothing of the failed
  attempt** - not the photograph, not the judgements, not the graded stamp.
- **A task can publish its own code**, which makes the product testable by one
  person and is a real weakening. Those tasks are labelled `test task`
  everywhere they appear, and the reason is printed on the task page.

Full behaviour, including the consensus design and the pre-flight thresholds, is
in [`docs/DOCUMENTATION.md`](docs/DOCUMENTATION.md).
[`contracts/README.md`](contracts/README.md) documents the verified SDK API
names and the traps between "the SDK has an `images` parameter" and a model
actually describing a photograph.

---

## The site

Next.js 14, App Router. Eight routes, one job each.

| Route | Its one job |
| --- | --- |
| `/` | Say what this is, and show what has actually settled |
| `/map` | Get a worker to a task they can reach today |
| `/task/[id]` | Make the acceptance test impossible to misread |
| `/submit/[id]` | Guide a phone camera to a passing photograph |
| `/proof/[id]` | Be the public receipt for the work |
| `/receipts` | Every settled task, paid and rejected together |
| `/console` | Let a poster fund work and see what is at stake |
| `/limits` | Say plainly what this cannot do |
| `/deploy` | One-off setup: deploy the contract with your own wallet |

### Nothing is announced before the chain has settled

A GenLayer receipt carries three fields that all read like a verdict, and two of
them lie. `status` is `FINALIZED` on a refused call, because refusing is a
perfectly successful transaction. `result` is `MAJORITY_AGREE`, because
validators agreeing that a call failed is still agreement. Only
`consensus_data.leader_receipt[].execution_result` answers "did my code run".

So every write asserts that field, waits for finality, holds, and then **reads
the answer back off the chain** rather than off the receipt that arrived first.
Where an answer genuinely is not available, the interface says so instead of
guessing at one.

---

## Configuration

| Variable | Needed for |
| --- | --- |
| `NEXT_PUBLIC_GENLAYER_NETWORK` | `studionet` (default) or `bradbury` |
| `NEXT_PUBLIC_FIELDWORK_CONTRACT` | Live reads and writes. Unset means seed mode |
| `PINATA_JWT` | Uploading photographs to content addressed storage |
| `CAS_GATEWAY` | The gateway used to build the url handed to the contract |

[`lib/chain.ts`](lib/chain.ts) is the single network switch. Contract addresses
are **per network** - changing the network without redeploying points the app at
something that does not exist.

The contract refuses any photograph url that is not on its allow list of content
addressed gateways. A mutable url would let the leader and the validators grade
two different photographs, which would make the whole verification theatre.

---

## Deployed

| | |
| --- | --- |
| Network | GenLayer Studio (`studionet`, chain id 61999) |
| Explorer | <https://explorer-studio.genlayer.com> |
| Source | [`contracts/fieldwork.py`](contracts/fieldwork.py), served live at `/api/contract-source` |

Studio is the default. Bradbury has a confirmed bug where a deploy reports
`FINALIZED` and then has no readable code.

**On Studio the verdict is real and the money does not move.** A payout is an
emitted message, Studio delivers one as a contract call, and a wallet is not a
contract - so it fails with `not found` and no balance changes. The verdict is
already final by then and stands. Measured on transaction `0x62dfbbc8`, not
assumed, and the site says so wherever it claims payment. On a live network the
same transaction pays.

---

## Testing

```bash
npm run check                             # 12 repo guards
npx tsc --noEmit                          # types
npm run build                             # production build
python contracts/test_contract_logic.py   # urls, codes, datetimes, state transitions, LLM parsing
python contracts/test_images.py           # pre-flight checks and the phash measurement
node scripts/e2e.mjs                      # against a real deployed contract
```

`npm run check` is the guard that matters. Every item in it is something that
has actually shipped broken in this repository at least once: house style, every
`Task` field set on construction and exposed on `task_json`, the verdict read
from the chain rather than inferred, every write asserting `execution_result`,
every photograph rendered behind a presence check, every chain-facing script
forcing IPv4 first, and the contract source traced into the serverless bundle.

`pytest tests/direct -q` currently skips everywhere - gltest's direct mode
fetches an asset no genvm release ships. See
[`contracts/README.md`](contracts/README.md).

### Test photographs

```bash
python scripts/make_test_set.py
```

Ten before/after pairs. Seven are built to pass; **three are built to fail** -
too small, a JPEG variant the grader cannot read, and work done with no code in
frame. A set that only succeeds proves nothing. Every after frame carries the
code `TEST42`, so with the "set the code yourself" field one person can run the
whole loop.

---

## What this cannot do

[`/limits`](app/limits/page.tsx) is a first class page, not a footnote, and it
opens by saying that if any other page seems to promise more, that page is
wrong.

1. **It cannot prove where a photograph was taken.** No system can, and phone
   coordinates can be changed. Nothing is ever marked location verified.
2. **On Studio the money does not move.** The grading is real; the transfer is
   not.
3. **The challenge code cannot appear in the before frame.** It does not exist
   yet when the poster shoots it.
4. **A published code is weaker than an issued one**, and those tasks are
   labelled.
5. **It does not match photographs by how they look.** Perceptual matching was
   built, measured and removed: the same corner on a different day scored closer
   than the same photograph re-encoded, so it would have accused honest workers.
6. **Its pre-flight is weaker on a JPEG than on a PNG.** The runtime ships no
   JPEG decoder, so the brightness checks cannot run. That is our limitation, so
   the photograph goes through rather than being charged to the worker.
7. **The model can be wrong, and there is no appeal.** Nothing overturns a final
   verdict and there is no human review step. What a rejected worker has is the
   rest of their window to retake, and a receipt anyone can check the grading
   against.
8. **It does not know whether a task is safe to do.** The posting gate tests
   gradeability only. A posted task is not a vetted task.
9. **Small tasks do not pay for themselves.** Below roughly ten GEN a task costs
   more to settle than it is worth, and there is no batching.

---

## Documentation

| Document | What is in it |
| --- | --- |
| [`docs/DOCUMENTATION.md`](docs/DOCUMENTATION.md) | The complete reference: architecture, contract surface, states, grading, troubleshooting |
| [`DEPLOY.md`](DEPLOY.md) | The deployment runbook, step by step |
| [`contracts/README.md`](contracts/README.md) | Verified SDK API names, and the bugs found in the original brief |
| [`docs/Fieldwork.pdf`](docs/Fieldwork.pdf) | The idea, as a document |
| [`docs/VIDEO_PROMPT.md`](docs/VIDEO_PROMPT.md) | Claude Design prompts for the film and the teaser |

---

<div align="center">

Built by **InferNode**

</div>
