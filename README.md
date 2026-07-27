# Fieldwork

Bounties for physical tasks, verified by photo against a written acceptance test.

A poster writes an acceptance test and funds a task. A worker claims it and the
contract issues a six character code. The worker photographs the place before
and after with that code in frame, and several validators grade both images
against the test. Payment and verdict are one transaction.

Built on GenLayer, Testnet Bradbury. Project 09 of 10 in the InferNode build
brief series.

---

## Run it

```bash
npm install
npm run dev
```

Without `NEXT_PUBLIC_FIELDWORK_CONTRACT` set, the site runs on seed records and
the submit button explains that nothing was sent. That is deliberate: every
screen reads through `lib/tasks.ts`, so pointing it at a live contract is a one
file change.

## Routes

| Route | Its one job |
| --- | --- |
| `/` | Show real completed tasks with the photographs that passed |
| `/map` | Get a worker to a task they can reach today |
| `/task/[id]` | Make the acceptance test impossible to misread |
| `/submit/[id]` | Guide a phone camera to a passing photograph |
| `/proof/[id]` | Be the public receipt for the work |
| `/console` | Let a poster run a campaign of many tasks |
| `/limits` | Say plainly what this cannot do |

## The contracts

See [`contracts/README.md`](contracts/README.md). It documents the verified SDK
API names, two bugs in the original brief, and why perceptual hashing is not
possible on chain.

Deploy `contracts/vision_probe.py` **first**. It answers the only question that
can sink this product: does image input actually execute on this network.

## Environment

| Variable | Needed for |
| --- | --- |
| `NEXT_PUBLIC_FIELDWORK_CONTRACT` | Live reads and writes. Unset means seed mode. |
| `PINATA_JWT` | Uploading photographs to content addressed storage |
| `CAS_GATEWAY` | Gateway used to build the url handed to the contract |

The contract refuses any photograph url that is not on its allow list of
content addressed gateways. A mutable url would let the leader and the
validators grade two different photographs, which would make the whole
verification theatre.

## Design rules worth keeping

- **One accent colour**, three jobs only: primary action, verified state, the mark.
- **No italics**, type scale is 12/14/15/18/22/30/44 and nothing between.
- **Monospace for labels, hashes, times and every eyebrow.**
- Light only and high contrast, because this is read on a phone outdoors.
- Rejections say exactly what to change and never imply dishonesty.
