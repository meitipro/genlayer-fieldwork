# Fieldwork - complete documentation

Bounties for physical work, settled by photograph against a written standard.

Built by **InferNode**.

This document is the whole product in one place: what it is, how the contract
behaves in every state, how the site is wired to it, how to run it, how to
deploy it and what to do when something looks wrong. Where a number appears it
was measured against the deployed contract, not estimated.

---

## Contents

1. [What it is](#1-what-it-is)
2. [The problem it addresses](#2-the-problem-it-addresses)
3. [The flow, end to end](#3-the-flow-end-to-end)
4. [Why this needs GenLayer](#4-why-this-needs-genlayer)
5. [Architecture](#5-architecture)
6. [The contract](#6-the-contract)
7. [Task states](#7-task-states)
8. [Grading](#8-grading)
9. [Anti-fraud, and its exact reach](#9-anti-fraud-and-its-exact-reach)
10. [Error classes and consensus](#10-error-classes-and-consensus)
11. [The site](#11-the-site)
12. [Settlement on Studio](#12-settlement-on-studio)
13. [Configuration](#13-configuration)
14. [Running it](#14-running-it)
15. [Deploying](#15-deploying)
16. [Testing](#16-testing)
17. [The test photograph set](#17-the-test-photograph-set)
18. [Troubleshooting](#18-troubleshooting)
19. [Scope, for whoever works on this next](#19-scope-for-whoever-works-on-this-next)
20. [Design rules](#20-design-rules)
21. [File map](#21-file-map)

---

## 1. What it is

Someone posts a real world task and writes down exactly what "done" looks like.
They photograph how the place looks right now, and they lock the payment. A
worker claims it, does the work, and photographs the result. An Intelligent
Contract on GenLayer grades the two photographs against the written standard,
and the verdict and the payment leave the contract as one transaction.

The one line version: **evidence in, settlement out**.

Two properties matter more than the rest:

- **The standard is frozen before anyone spends time.** The acceptance test is
  written at posting, published on the task page, and is the exact text the
  graders are given.
- **The before photograph belongs to whoever is paying.** A worker who supplies
  both frames can photograph a mess, clear it, photograph it again, and be paid
  for work nobody needed. Taking that frame at posting time removes the whole
  class of fraud.

## 2. The problem it addresses

Coordinating physical work costs twice: once for the work, once for checking it.
Checking means someone in an office, days later, looking at a folder of photos -
or not looking at all. So the worker does not know when, or whether, they get
paid, and the decision belongs to whoever is holding the money.

Crypto solved paying a stranger and left "was it actually done?" untouched. That
question is a judgement, not a computation, and a judgement one party makes
alone is exactly the arrangement the other party distrusts.

## 3. The flow, end to end

**1. The standard.** The poster writes an acceptance test. Not "tidy the yard",
but something two careful people would grade the same way:

> The bin area is empty. No bags remain against the wall, the ground is clear of
> loose litter, and both bins are upright with their lids closed.

They also write one pass example and one fail example. All three are required.

**2. The poster's photograph.** They shoot how the place looks now. It is
uploaded to content addressed storage before the transaction is sent, so the
contract stores a url whose bytes cannot change afterwards.

**3. The gate.** Before the task exists, the contract does two things in one
consensus round: it opens the poster's photograph and refuses it if nobody could
grade it, and it reads the acceptance test and refuses it if it cannot be judged
from a photograph. Both refusals happen before the money is committed. A vague
test poisons every submission made against it and the worker carries the cost,
so this is the cheapest place to catch one.

**4. Funding.** The transaction carries the reward plus the fee. Anything sent
beyond that is banked as fee rather than stranded in the contract.

**5. The claim.** A worker claims the task. The contract issues a six character
code derived deterministically from the task id, the worker's address and the
moment, so anyone auditing the record can recompute it. The claim runs for the
window the poster chose.

**6. The work.** The worker writes the code on paper and photographs the
finished work with it in frame. One photograph, not two - the before frame is
already on the task.

**7. The judgement.** Every validator fetches the same two photographs and
grades them against the same text. They must agree on three things:

- the code is legible in the worker's frame
- both frames show the same place
- the acceptance test passed

**8. The receipt.** Verdict and payment are one transaction. A public page is
left behind carrying both photographs, the exact text they were graded against,
the three judgements and the reason given to the worker.

## 4. Why this needs GenLayer

The contract does not use a model as a backend. It uses one where **a judgement
has to be settled between parties who do not trust each other**.

Nothing in step 7 reduces to a deterministic API call, and nothing about it is
safe to let one party compute. That is the boundary the whole design sits on:

| Owner | What it owns |
| --- | --- |
| The contract | The acceptance test, the challenge code, the grading, the reuse checks, the payout |
| The frontend | The camera, the checklist, uploads, the map, the explanations |
| Storage | The photographs, content addressed so every validator provably grades identical bytes |

## 5. Architecture

```
browser (MetaMask)
   |
   |  writes: post_task / claim / submit / cancel_task / withdraw_fees
   v
GenLayer Studio  <---- reads ---- Next.js server (lib/onchain.ts)
   |
   |  gl.nondet.web.request  -> IPFS gateway (photograph bytes)
   |  gl.nondet.exec_prompt  -> vision model, per validator
   v
consensus: leader result compared by every validator
```

Reads are server side and cached briefly. Writes always go through the visitor's
own wallet - the site never holds a key. Photograph uploads are proxied through
`/api/cas` so the storage credential never reaches the browser.

## 6. The contract

`contracts/fieldwork.py`. There is no build step between that file and the
chain: what you read is what runs, and it is also served live at
`/api/contract-source`.

36 methods, 29 view and 7 write, validated with `genvm-lint`.

### Writes

| Method | Who may call it |
| --- | --- |
| `post_task(title, place, acceptance_test, example_pass, example_fail, before_url, lat_e6, lng_e6, reward, min_reputation, fixed_code, claim_minutes) -> u256` | Anyone. Payable, and must carry reward + fee |
| `claim(task_id) -> str` | Anyone meeting the reputation bar. Returns the challenge code |
| `submit(task_id, after_url) -> str` | The claimant only. Returns `paid` or `rejected` |
| `release_expired(task_id) -> str` | Anyone. Returns an abandoned task to the pool |
| `cancel_task(task_id) -> str` | The poster only, while the task is unpaid |
| `withdraw_fees(to) -> u256` | The owner only |
| `transfer_ownership(new_owner)` | The owner only |

### Views

`total_tasks`, `task_json`, `status_of`, `reason_of`, `challenge_code_of`,
`claim_expires_of`, `claimed_by`, `acceptance_test_of`, `title_of`, `place_of`,
`example_pass_of`, `example_fail_of`, `reward_of`, `min_reputation_of`,
`poster_of`, `lat_e6_of`, `lng_e6_of`, `judgements_of`, `claim_minutes_of`,
`fixed_code_of`, `before_url_of`, `after_url_of`, `content_hash_of`, `phash_of`,
`reputation_of`, `hash_used_by`, `fee_bps_value`, `fees_accrued_value`,
`owner_address`.

The per field views are convenient from a CLI. The site reads `task_json`
instead: a list of twenty tasks through the individual views would be twenty
times a dozen round trips, and Studio rate limits at 30 requests per minute.

### Parameters worth explaining

**`claim_minutes`** - how long a claim lasts on this task. Zero means the
default of 90 minutes. Bounded at both ends by the contract: under 10 minutes is
not a task but a trap, since the worker cannot reach the place before it
expires; over a week lets one worker sit on a task purely to keep everyone else
off it. The poster picks it because they are the only one who knows whether the
job is a five minute look at a noticeboard or an afternoon with a van.

**`fixed_code`** - normally `""`. Setting it publishes the challenge code with
the task, so it is knowable before anyone claims. This exists so one person can
run the whole product end to end: prepare the photograph, post, claim, submit.
It is a real weakening and the site labels those tasks `test task` everywhere
they appear. An issued code proves the photograph was taken after the claim,
because nobody could have known it before. A published one proves only that the
photographer read the task page.

**`min_reputation`** - reputation is one point per task paid, and nothing else
moves it. The site reads a wallet's reputation before offering the claim button,
so an ineligible worker is told the two numbers before signing rather than after
a transaction that was always going to be refused.

**`fee_bps`** - set once at deploy, capped at 2000 (20 percent). Charged to the
poster on top of the reward and accrued in the contract until the owner
withdraws.

## 7. Task states

```
                post_task
                    |
                    v
      +---------> open <-----------------+
      |             |                    |
      |             | claim              | release_expired, or the
      |             v                    | next claim on an expired task
      |          claimed ----------------+
      |             |                    |
      |             | submit             |
      |             v                    |
      |    +-- rejected -----------------+
      |    |        |
      |    |        | submit again, inside the same window
      |    |        v
      |    |      paid  (terminal)
      |    |
      +----+ cancel_task (poster, and only once no live claim holds it)
            |
            v
        cancelled  (terminal)
```

Three rules in that diagram are easy to miss and all three were bugs once:

- **A rejection does not cost the claim.** Most failures are lighting and
  framing, not fraud, so the task stays with the worker and they may retake
  inside the same window.
- **An abandoned `rejected` task returns to the pool.** Without that, a worker
  rejected once and then gone would leave the task frozen for ever with the
  reward locked.
- **Returning a task to the pool clears the previous attempt entirely** - the
  after photograph, the three judgements and the graded stamp, not just the
  claim fields. An open task must never advertise somebody else's failed
  evidence.

`cancel_task` accepts `open` always, and `rejected` only once the claim window
has run out. Cancelling under a worker who has been told to retake would take
the task away from someone who has already made the trip.

## 8. Grading

Both nondeterministic blocks use `gl.vm.run_nondet_unsafe(leader_fn,
validator_fn)` with **comparative** validators: the validator does the work
itself and compares its own answer with the leader's, rather than being asked to
bless a label. Asking a validator only to agree would let one node decide alone.

### What is compared

At posting: `gradeable`, `refused`, and the sha256 of the before photograph.

At submission: `refused`, `code_visible`, `same_place`, `test_passed`, the
content hash and the perceptual hash. The two hashes are compared as well as the
three judgements, because without that a leader could report a hash that is not
the photograph's and walk straight past the reuse checks. Both are pure
functions of bytes that every node fetched identically, so honest nodes always
agree on them.

The wording of the model's `reason` is never compared. Two honest models phrase
the same verdict differently, and comparing prose is how a correct grading
becomes a consensus failure.

### Pre-flight, before any model is paid for

The contract opens the photograph and refuses one nobody could grade. Every
bound is deliberately extreme, because a false rejection costs an honest worker
a trip:

| Check | Threshold | Why |
| --- | --- | --- |
| Opens as an image at all | - | A gateway error page is not a photograph |
| Shortest edge | 480 px | Below this a six character code is not legible |
| Mean brightness, dark | 12 | Lens cap, pocket, unlit yard |
| Mean brightness, bright | 243 | Sun straight into the lens, detail gone |
| JPEG has a JFIF or EXIF header | - | The node's decoder cannot read the variants without one |

**The brightness checks do not run on a JPEG.** The node's image library ships
without a JPEG decoder, so the contract can read the dimensions out of the
header but cannot look at a single pixel. That is our limitation and not the
worker's, so the photograph goes through to the model rather than being refused.
Upload a PNG and the full check runs. This is measured on the network, not
assumed - `contracts/probe_preflight.py` and `scripts/probe-run.mjs` exist to
ask the runner rather than guess, and `contracts/test_images.py` includes a test
that monkeypatches the decoder away so a host with libjpeg cannot hide it.

### The blind grader

Some routers hand a vision call to a text only model, which then answers
confidently about a photograph it never received. The prompt asks for a
`saw_images` flag, and a false one is **raised** as `[TRANSIENT]`, not returned
as a verdict.

The difference is the whole point. Returned, it becomes a verdict, and the
validator compares verdicts: a blind leader and a sighted validator disagree,
the block reaches `NO_MAJORITY`, and the transaction stalls in `PROPOSING` with
the task stuck as claimed. Measured on transaction `0x60743996`. Raised, it goes
through `_handle_leader_error`: if the validator is also blind both are
transient and they agree on a clean retryable failure, and if the validator can
see it disagrees and the round rotates to another leader, which is the one
outcome that actually gets the worker graded.

## 9. Anti-fraud, and its exact reach

| Mechanism | What it actually catches |
| --- | --- |
| The poster owns the before frame | Staging: shove the bags into shot, photograph, clear, photograph |
| Challenge code, issued at claim time | A photograph recycled from another task or another month carries the wrong code |
| Same place judgement | An after frame shot somewhere else entirely |
| Content hash on chain | The identical file submitted twice |
| Content id on chain | The same stored object under a different gateway url |
| Pre-flight | A file that is not a photograph, or is too small for a code to be legible |

**There is deliberately no perceptual match against previously accepted
photographs.** It was built and measured and it does not work for this product:
the same place photographed on another day scored closer (2 bits of 64) than the
same photograph re-encoded (8 bits of 64), so no threshold separates honest
repeat work from reuse. The failure mode is accusing a worker who did the job.
The perceptual hash is still recorded on the task and shown on the receipt so a
person can compare two photographs themselves, and it decides nothing.

## 10. Error classes and consensus

Every refusal carries a class prefix so validators know how to compare a failure
rather than guessing at one.

| Class | Meaning | How validators compare it |
| --- | --- | --- |
| `[EXPECTED]` | A deterministic refusal: bad url, wrong claimant, expired window | Must match exactly |
| `[EXTERNAL]` | The gateway answered 4xx, or returned no photograph | Must match exactly |
| `[TRANSIENT]` | Storage 5xx, a blind grader, anything retryable | Both sides transient is agreement |
| `[LLM_ERROR]` | The model returned nothing usable | Always disagrees, which forces rotation |

The prefix is for consensus, not for the person holding the phone. `humanError`
in `lib/genlayer.ts` strips it before display; the sentence behind it is written
for humans and shown as it is.

## 11. The site

Next.js 14, App Router. Eight routes, each with one job.

| Route | Its one job |
| --- | --- |
| `/` | Say what this is, and show what has actually settled |
| `/map` | Get a worker to a task they can reach today |
| `/task/[id]` | Make the acceptance test impossible to misread |
| `/submit/[id]` | Guide a phone camera to a passing photograph |
| `/proof/[id]` | Be the public receipt for the work |
| `/receipts` | Every settled task, paid and rejected together |
| `/console` | Let a poster fund work and see what is at stake |
| `/how-it-works` | The verification design, mechanism by mechanism |
| `/deploy` | One-off setup: deploy the contract with your own wallet so you own it |

### Reading a receipt is not the same as reading a status

A GenLayer receipt carries three fields that all read like a verdict, and two of
them lie. `status` is `FINALIZED` on a refused call, because refusing is a
perfectly successful transaction. `result` is `MAJORITY_AGREE`, because
validators agreeing that a call failed is still agreement. Only
`consensus_data.leader_receipt[].execution_result` answers "did my code run".

`assertExecuted` in `lib/genlayer.ts` is the single most important function in
the frontend for that reason. Without it every write reported success on a
refusal: a claim rejected for low reputation handed the worker an empty code and
a link to go and photograph a task that was never theirs. Measured on
transaction `0xfa6f7d9f`, which finalized, agreed, and refused.

`scripts/check.mjs` enforces that every write path calls it.

### Nothing is announced before the chain has settled

A GenLayer call is readable as soon as it is `ACCEPTED`, and consensus can still
rotate to another leader after that. So every write:

1. waits for `ACCEPTED` and asserts `execution_result`
2. waits for `FINALIZED`, retrying transient RPC failures
3. holds a further 30 seconds
4. **reads the answer back off the chain**, rather than off the receipt that
   arrived first

Each stage is shown to the user with an elapsed clock and an estimate, because a
four minute wait with no number on it reads as a hang.

Two failure modes are reported rather than guessed at. If finality could not be
observed, the interface says the write is on chain and it could not watch it
land - it does not claim either outcome. If the verdict read fails after a
submission, the status is `unknown` and the screen says so; falling back to
`rejected` there once told a worker whose task had been paid that their work had
failed because a socket dropped.

### Estimates

Measured across the runs in `scripts/e2e-full.mjs`, not guessed:

| Write | Usual total |
| --- | --- |
| Post a task | about 3 minutes |
| Claim | about 90 seconds |
| Submit | about 4 minutes |
| Deploy | about 2 minutes |
| Cancel or withdraw | about 90 seconds |

## 12. Settlement on Studio

**On the Studio network the verdict is real and the money does not move.**

A payout is an emitted message from the contract to the payee, and Studio
delivers an emitted message as a *contract call*. An ordinary wallet is not a
contract, so the message fails. Caught in full on transaction `0x62dfbbc8`:
contract `0x1Ac28fab` to wallet `0x3e1D268c`, value 1 GEN, `NO_MAJORITY`, and
the leader's refusal reads `contract 0x3e1D268c... not found`.

Funding works correctly in the same deployment: 19.08 GEN moved in. The refund
took exactly 19.08 GEN out of the contract while the payee's balance did not
change by a single wei.

The task is already `paid` and finalized before the transfer is attempted,
because `emit_transfer` defaults to `on="finalized"` - the transfer is a
separate message that runs after the verdict, so its failure cannot roll the
verdict back. So a task here can read `paid` off a real, recorded, agreed
verdict and still leave nobody richer.

The contract is correct. The site says so wherever it claims payment, through
`components/SettlementNotice.tsx`, which renders nothing on any other network.
On a live network the same transaction pays.

## 13. Configuration

| Variable | Needed for |
| --- | --- |
| `NEXT_PUBLIC_GENLAYER_NETWORK` | `studionet` (default) or `bradbury` |
| `NEXT_PUBLIC_FIELDWORK_CONTRACT` | Live reads and writes. Unset means seed mode |
| `PINATA_JWT` | Uploading photographs to content addressed storage |
| `CAS_GATEWAY` | The gateway used to build the url handed to the contract |

`lib/chain.ts` is the single network switch. Chain id, RPC, currency and gas
policy all derive from genlayer-js's own chain objects, with one documented
exception: the SDK's Studio explorer url answers 503, so the working one is
pinned there instead.

**Contract addresses are per network.** Changing the network without redeploying
and updating the address points the app at something that does not exist.

The contract refuses any photograph url that is not on its allow list of content
addressed gateways: `ipfs.io`, `w3s.link`, `dweb.link`, `cf-ipfs.com`,
`gateway.pinata.cloud`. A mutable url would let the leader and the validators
grade two different photographs, which would make the whole verification
theatre.

## 14. Running it

```bash
npm install
npm run dev
```

Without `NEXT_PUBLIC_FIELDWORK_CONTRACT` set, the site runs on the seed records
in `lib/tasks.ts` and every write explains that nothing was sent. That is
deliberate: every screen reads through `lib/onchain.ts`, so pointing it at a
live contract is one environment variable, and an unreachable chain degrades to
the seed records rather than a 500.

```bash
npm run check
```

Twelve repo guards, each of them something that has actually shipped broken here
at least once: house style, that every `Task` field is set on construction and
exposed on `task_json`, that the verdict is read from the chain rather than
inferred, that every write asserts `execution_result`, that every photograph is
rendered behind a presence check, that every chain-facing script forces IPv4
first, and that the contract source is traced into the serverless bundle.

## 15. Deploying

`DEPLOY.md` is the runbook, with what "worked" looks like at each step, because
on this stack a failure often reports success.

The short version: open `/deploy` on the running site and deploy with your own
wallet. The deployer becomes the contract `owner`, and the owner is the only
account that can withdraw fees or hand ownership on. Deploying from a CLI
keystore or from Studio's own account selector makes one of those the owner
instead, which is fine for a throwaway and wrong for a deployment you intend to
keep.

Then set `NEXT_PUBLIC_FIELDWORK_CONTRACT` to the address it returns and
redeploy the site.

**Any change to `contracts/fieldwork.py` needs a fresh deploy.** A contract is
immutable, so a site built against a newer signature calling an older deployment
fails with an arity error such as `post_task() takes 10 arguments but 11 were
given`.

## 16. Testing

```bash
python contracts/test_contract_logic.py   # urls, codes, datetimes, state transitions, LLM parsing
python contracts/test_images.py           # pre-flight checks and the phash measurement
npm run check                             # the repo guards
npx tsc --noEmit                          # types
npm run build                             # the production build
pytest tests/direct -q                    # the full contract with mocked web and LLM
node scripts/e2e.mjs                      # against a real deployed contract
```

`tests/direct` currently skips on every platform. gltest's direct mode fetches
`genvm-universal.tar.xz` from a genvm release, and no release ships that asset -
they carry `genvm-linux-amd64` and `genvm-linux-arm64` only. The tests are
written and kept because they are correct and will run the moment the asset
appears. Meanwhile the deterministic half is covered by
`contracts/test_contract_logic.py`, which extracts the helpers out of the
shipping contract with `ast` rather than reimplementing them, and the whole loop
is covered on a real chain by `scripts/e2e.mjs`.

### Scripts

| Script | What it answers |
| --- | --- |
| `scripts/prove-vision.mjs` | Does `exec_prompt(images=[...])` actually execute on this network |
| `scripts/probe-run.mjs` | What can the runner really do, asked of the runner rather than guessed |
| `scripts/deploy.mjs` | Deploy from the CLI |
| `scripts/e2e.mjs` | Exercise a deployed contract, everything that does not need a person holding paper |
| `scripts/e2e-full.mjs` | The whole product on a real chain with real photographs |
| `scripts/seed.mjs` | Put real records on chain so the site has something to show |
| `scripts/check-payout.mjs` | Does a payout from this contract actually reach the payee |
| `scripts/verify-fix.mjs` | Replay a specific failing call against the current contract |
| `scripts/explain-tx.mjs` | Decode one transaction: method, args, per-round result, refusal text |
| `scripts/make_test_set.py` | Build the ten pair test photograph zip |

Every chain-facing script sets `dns.setDefaultResultOrder("ipv4first")` before
creating a client. Studio sits behind Cloudflare on both stacks and its AAAA
addresses time out, so without it every request burns about ten seconds and then
reports a bare `fetch failed` that looks like the chain is down.

## 17. The test photograph set

`python scripts/make_test_set.py` writes a zip of ten before/after pairs.

Seven are built to pass: bins, a charger and its display, a shelf bay, a
noticeboard, graffiti on a shutter, a blocked gutter, fly tipping under a
bridge. **Three are built to fail**, and they matter more:

| | The fault | What it proves |
| --- | --- | --- |
| 08 | 320x240 | Pre-flight refuses a frame too small for a code to be legible |
| 09 | JPEG with no JFIF header (`ffd8ffdb`) | The variant the grader cannot read is caught early, with an instruction |
| 10 | Work done, no code in frame | The grader rejects on `code_visible` rather than on the work |

Every after frame carries the code `TEST42`. Put that in the "set the code
yourself" field when posting and one person can run the whole loop. The before
frames carry no code, because the poster shoots them before any code exists.

The zip ships a `README.txt` with the exact acceptance test text for each pair,
so a photograph and the test it was built for cannot drift apart. The generator
verifies every file after writing it - dimensions and magic bytes - and fails if
a fixture is not what the README says it is.

For a ten pair run, set the claim window to **1 day** and the minimum reputation
to **0**. Each step takes minutes, and a 90 minute window can run out in the
middle of the run.

## 18. Troubleshooting

**"post_task() takes 10 arguments but 11 were given"**
The deployed contract is older than the site. Redeploy from `/deploy` and update
`NEXT_PUBLIC_FIELDWORK_CONTRACT`.

**A transaction says `FINALIZED` and `MAJORITY_AGREE` but nothing happened**
It was refused. Run `node scripts/explain-tx.mjs 0x<hash>` - it prints the
method, the decoded arguments, each round's `execution_result` and the refusal
sentence.

**"contract 0x... not found" on a payout**
Expected on Studio. See [Settlement on Studio](#12-settlement-on-studio).

**`NO_MAJORITY`, or a transaction stuck in `PROPOSING`**
Validators disagreed. The usual cause is a nondeterministic value being compared
- prose, a timestamp, a float. Check what `validator_fn` compares.

**"unknown RPC error", or reads that come back empty**
Studio rate limits at 30 requests per minute. `lib/onchain.ts` backs off and
batches for this reason; a script hammering it will still trip it.

**A read says "contract not found" for an address that exists**
Studio is case sensitive about addresses. Use the checksummed form exactly as
the deploy returned it.

**Every route 500s with `Cannot find module './948.js'`**
`.next` was corrupted by running `npm run build` while `npm run dev` was
running. Stop the dev server, delete `.next`, rebuild. It looks like a code
regression and is not one.

**`decoder jpeg not available` in a contract log**
The runtime has no libjpeg. This is handled - see
[Pre-flight](#pre-flight-before-any-model-is-paid-for) - but a host test will
not reproduce it, because host Pillow does have libjpeg.

**`genvm-lint validate` says "No contract class found"**
The validator skips a class named `Contract` by name, which is the GenLayer
convention every real contract follows. Rename the class into a temp copy to
validate:

```bash
sed 's/^class Contract(gl\.Contract):/class Fieldwork(gl.Contract):/' contracts/fieldwork.py > /tmp/fw.py && PYTHONIOENCODING=utf-8 genvm-lint validate /tmp/fw.py
```

`genvm-lint lint contracts/fieldwork.py` works directly. On Windows set
`PYTHONIOENCODING=utf-8` or the linter dies printing its own tick.

## 19. Scope, for whoever works on this next

Engineering notes. The user facing version of this material is the
`/how-it-works` page, which states the same design as what the product does
rather than as what it does not.

- **Location is never presented as proven**, on any screen, because it cannot
  be. The design does not need it to be: the poster owns the before frame, the
  code is issued at claim time, and the same place judgement ties the two
  together.
- **The code is checked in the worker's frame only.** It does not exist when the
  poster shoots theirs.
- **A published code makes a demonstration task**, not a live one, and those
  carry a `test task` label everywhere they appear.
- **No perceptual matching.** Built, measured, removed on the evidence. See
  section 9.
- **The brightness checks do not run on a JPEG.** No decoder in the runtime, so
  the frame goes through rather than being charged to the worker. See section 8.
- **A verdict is final.** There is no appeal path in the contract and no
  reviewer role. The design answer is the retake window plus a public receipt,
  and if a review layer is ever wanted it belongs off chain rather than as a key
  that can rewrite settled state.
- **The posting gate tests gradeability, not safety.** Anything that vets tasks
  for danger would be a new mechanism, not a tweak to this one.
- **One vision call per validator per submission** is the cost floor. Roughly
  ten GEN. There is no batching.

## 20. Design rules

- **One accent colour**, three jobs only: the primary action, the verified
  state, the mark. Nothing else is coloured.
- **Dark is the default.** A light theme exists and follows the system unless
  the visitor picks one. Both were measured for contrast rather than eyeballed.
- **Manrope for everything human, JetBrains Mono for codes, hashes, timestamps,
  rewards and every small uppercase label.** No italics anywhere.
- **Depth is spent in exactly one place**, the evidence stack on the home page.
- **Rejections say exactly what to change** and never imply dishonesty.
- **House style is the spaced hyphen.** No em dashes, no en dashes, anywhere a
  person reads. `npm run check` enforces it against both the sources and the
  built output.

## 21. File map

```
contracts/
  fieldwork.py            the contract, deployed as-is
  probe_preflight.py      asks the runner what it can actually do
  test_contract_logic.py  deterministic logic, extracted from the shipping file
  test_images.py          pre-flight and the perceptual hash measurement
  README.md               verified SDK API names and the traps behind them
lib/
  chain.ts                the single network switch
  genlayer.ts             writes, receipt reading, stage reporting
  onchain.ts              server side reads, caching, backoff
  image.ts                normalise a photograph before upload
  tasks.ts                seed records and every display helper
  types.ts                the Task shape the site reads
app/                      eight routes, one job each
components/               the screens' parts
scripts/                  deploy, probe, prove, exercise, explain
docs/
  DOCUMENTATION.md        this file
  VIDEO_PROMPT.md         Claude Design prompts for the film and the teaser
  Fieldwork.pdf           the idea, as a document
  build_pdf.py            which builds it
tests/direct/             gltest direct mode, skipped until genvm ships the asset
```

---

Built by InferNode.
