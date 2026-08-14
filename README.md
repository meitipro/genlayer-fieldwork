<div align="center">

# Fieldwork

**Evidence in, settlement out.**

Bounties for physical work, settled by photograph against a written standard.
The verdict and the payment leave the contract as a single transaction.

[![Built by InferNode](https://img.shields.io/badge/built%20by-InferNode-7ac943?style=flat-square)](https://github.com/meitipro)
[![GenLayer](https://img.shields.io/badge/GenLayer-Intelligent%20Contract-101216?style=flat-square)](https://genlayer.com)
[![Next.js 14](https://img.shields.io/badge/Next.js-14-101216?style=flat-square)](https://nextjs.org)

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

## The contract

**36 methods, 29 view and 7 write**, `genvm-lint` clean. There is no build step
between the source and the chain: what runs is the file as written, and the
running site serves it at `/api/contract-source` so anyone can read exactly what
is deployed.

### Behaviour worth knowing

- **The claim window is the poster's choice**, between ten minutes and a week.
  Below ten minutes a task is not a task but a trap; above a week one worker can
  sit on it to keep everyone else off.
- **A rejection does not cost the claim.** Most failures are lighting and
  framing, not fraud, so the task stays with the worker and can be retaken
  inside the same window.
- **An abandoned task returns to the pool carrying nothing of the failed
  attempt** - not the photograph, not the judgements, not the graded stamp.
- **A poster cannot cancel out from under a live claim.** A worker told to
  retake keeps the task until their window runs out.
- **Photographs are refused before a grader is paid for.** Anything unopenable,
  or too small for a six character code to be legible, costs a retake and
  nothing else.

---

## The site

Next.js 14, App Router. Eight screens, one job each: find work, read the
standard, photograph the result, and a public receipt for every settled task -
rejections listed beside payments, because a wall of only successes proves
nothing.

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

## What this cannot do

A first class page in the product, not a footnote. It opens by saying that if
any other page seems to promise more, that page is wrong.

1. **It cannot prove where a photograph was taken.** No system can, and phone
   coordinates can be changed. Nothing is ever marked location verified.
2. **The challenge code cannot appear in the before frame.** It does not exist
   yet when the poster shoots it.
3. **It does not match photographs by how they look.** Perceptual matching was
   built, measured and removed: the same corner on a different day scored closer
   than the same photograph re-encoded, so it would have accused honest workers.
   What catches a recycled photograph is the challenge code.
4. **Its pre-flight is weaker on a JPEG than on a PNG.** The runtime ships no
   JPEG decoder, so the brightness checks cannot run. That is our limitation, so
   the photograph goes through rather than being charged to the worker.
5. **The model can be wrong, and there is no appeal.** Nothing overturns a final
   verdict and there is no human review step. What a rejected worker has is the
   rest of their window to retake, and a receipt anyone can check the grading
   against.
6. **It does not know whether a task is safe to do.** The posting gate tests
   gradeability only. A posted task is not a vetted task.
7. **Small tasks do not pay for themselves.** Below roughly ten GEN a task costs
   more to settle than it is worth, and there is no batching.

---

<div align="center">

Built by **InferNode**

</div>
