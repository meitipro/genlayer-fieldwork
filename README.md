# Fieldwork

Bounties for physical tasks, verified by photo against a written acceptance test.

A poster writes an acceptance test and funds a task. A worker claims it and the
contract issues a six character code. The worker photographs the place before
and after with that code in frame, and several validators grade both images
against the test. Payment and verdict are one transaction.

Built on GenLayer, running on the Studio network. Project 09 of 10 in the
InferNode build brief series.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmeitipro%2Fgenlayer-fieldwork&env=NEXT_PUBLIC_GENLAYER_NETWORK%2CPINATA_JWT%2CCAS_GATEWAY&envDescription=Network+is+studionet.+PINATA_JWT+is+optional+at+first+-+without+it+every+page+works+and+only+photo+upload+is+disabled.+Add+NEXT_PUBLIC_FIELDWORK_CONTRACT+afterwards%2C+once+you+have+deployed+the+contract+from+%2Fdeploy.&envLink=https%3A%2F%2Fgithub.com%2Fmeitipro%2Fgenlayer-fieldwork%2Fblob%2Fmaster%2FDEPLOY.md&project-name=genlayer-fieldwork&repository-name=genlayer-fieldwork)

Deploying asks for three variables. Leave `NEXT_PUBLIC_FIELDWORK_CONTRACT` out
for now — the site runs on seed records without it, and you add it after
deploying the contract from `/deploy` on the live URL.

---

## Run it

```bash
npm install
npm run dev
```

Without `NEXT_PUBLIC_FIELDWORK_CONTRACT` set, the site runs on seed records and
every write explains that nothing was sent. That is deliberate: every screen
reads through `lib/onchain.ts`, so pointing it at a live contract is one
environment variable, and an unreachable chain degrades to the seed records
rather than a 500.

To deploy your own, see [`DEPLOY.md`](DEPLOY.md).

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
| `/deploy` | One-off setup: deploy the contract with your own wallet so you own it |

## The contracts

See [`contracts/README.md`](contracts/README.md). It documents the verified SDK
API names, the bugs found in the original brief, and the three traps that stood
between "the SDK has an `images` parameter" and a model actually describing a
photograph.

**Vision is proven working** on GenLayer Studio. Reproduce it in one command —
no account, no faucet, because Studio is gasless:

```bash
node scripts/prove-vision.mjs
```

## Network

Studio is the default. Bradbury has a confirmed bug where a deploy reports
`FINALIZED` and then has no readable code.

[`lib/chain.ts`](lib/chain.ts) is the single switch: chain id, RPC, currency and
gas policy all derive from genlayer-js's own chain objects, with one documented
exception (the SDK's Studio explorer URL answers 503, so the working one is
pinned there instead).

Contract addresses are **per network**. Changing the network without redeploying
and updating the address points the app at something that does not exist.

## Environment

| Variable | Needed for |
| --- | --- |
| `NEXT_PUBLIC_GENLAYER_NETWORK` | `studionet` (default) or `bradbury` |
| `NEXT_PUBLIC_FIELDWORK_CONTRACT` | Live reads and writes. Unset means seed mode. |
| `PINATA_JWT` | Uploading photographs to content addressed storage |
| `CAS_GATEWAY` | Gateway used to build the url handed to the contract |

The contract refuses any photograph url that is not on its allow list of
content addressed gateways. A mutable url would let the leader and the
validators grade two different photographs, which would make the whole
verification theatre.

## Deployed

| | |
| --- | --- |
| Network | GenLayer Studio (`studionet`, chain id 61999) |
| Contract | `0x7132E013d9b3e118319E92B8DAfFFB8De41c35bB` |
| Explorer | <https://explorer-studio.genlayer.com> |
| Source | [`contracts/fieldwork.py`](contracts/fieldwork.py), also served live at `/api/contract-source` |

There is no build step between that file and the chain — what you read is what
runs. To deploy your own copy with your own wallet, open `/deploy` on the
running site, or follow the CLI route below.

## Deploying

[`DEPLOY.md`](DEPLOY.md) is the runbook: contract checks, proving vision on the
network, deploy, end-to-end exercise, seeding, and pointing the site at it —
with what "worked" looks like at each step, because on this stack a failure
often reports success.

## Why this needs GenLayer

The contract does not use a model as a backend; it uses one where a **judgment
has to be settled between parties who do not trust each other**.

A poster and a worker disagree about whether a job was done. Today the poster
decides, days later, with a model they own — which is exactly the arrangement
workers distrust. Here the standard is written down and made public *before*
anyone spends time, several validators grade the same two photographs against
that same text independently, and they must agree on three coarse judgements
before a single coin moves. Payment and verdict are one transaction.

Nothing about that reduces to a deterministic API call, and nothing about it is
safe to let one party compute. That is the boundary:

- **Frontend owns** the camera, the checklist, uploads, and the map.
- **The contract owns** the acceptance test, the challenge code, the grading,
  the reuse checks, and the payout.
- **Storage owns** the photographs, content addressed so every validator
  provably grades identical bytes.

## Tests

```bash
python contracts/test_contract_logic.py   # url rules, codes, datetimes, LLM parsing
python contracts/test_images.py           # pre-flight checks and the phash measurement
pytest tests/direct -q                    # full contract with mocked web + LLM
node scripts/e2e.mjs                      # against a real deployed contract
```

See [`contracts/README.md`](contracts/README.md) for why `tests/direct` currently
skips.

## Design rules worth keeping

- **One accent colour**, three jobs only: primary action, verified state, the mark.
- **No italics**, type scale is 12/14/15/18/22/30/44 and nothing between.
- **Monospace for labels, hashes, times and every eyebrow.**
- Light is the default and high contrast, because this is read on a phone
  outdoors. Dark follows the system unless the visitor picks one, and both were
  measured for contrast rather than eyeballed.
- Rejections say exactly what to change and never imply dishonesty.
