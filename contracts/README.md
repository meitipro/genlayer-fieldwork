# Fieldwork — Intelligent Contracts

Two contracts:

| File | Purpose |
| --- | --- |
| `fieldwork.py` | The product. Tasks, claims, vision grading, reuse detection, payment. |
| `vision_probe.py` | A throwaway probe that answers one question: does image input actually execute on this network? Deploy it first. |

---

## The API names, verified against the pinned SDK

Do not take these from the docs site. `docs.genlayer.com` and
`sdk.genlayer.com/main` both describe a **newer** SDK than the one contracts
actually pin, and at least one symbol they document does not exist in the pinned
version.

The authority is the SDK that `genvm-lint` downloads for the exact hash in the
`Depends` header. On this machine it sits at:

```
~/.cache/genvm-linter/extracted/v0.3.0-rc7.tar/py-lib-genlayer-std/<hash>/genlayer
```

Read that, not the website.

| Purpose | USE THIS | NOT THIS |
| --- | --- | --- |
| Revert | `raise gl.vm.UserError("msg")` | any builtin exception — they crash the WASM with no message |
| Fetch bytes | `gl.nondet.web.request(url, method="GET").body` | — `method` is **keyword-only and required** |
| Vision | `gl.nondet.exec_prompt(p, images=[b1, b2], response_format="json")` | — `images` is keyword-only |
| Consensus block | `gl.vm.run_nondet_unsafe(leader_fn, validator_fn)` | — both args are **positional-only** |
| Send value | `gl.get_contract_at(addr).emit_transfer(value=amount)` | **`genlayer.chain.Account` does not exist in the pinned SDK** |
| Current time | `gl.message_raw["datetime"]` → `str` | `datetime.now()` |
| Signed numbers | `i64` | `u256` for anything that can go negative (latitude!) |

### Things that cost time, written down so they cost it once

**`genlayer.chain` is not real here.** `sdk.genlayer.com/main` documents
`genlayer.chain.Account(addr).emit_transfer(value)`. That module does not exist
in the pinned SDK — `genvm-lint check` fails with
`Import error: No module named 'genlayer.chain'`. The pinned SDK puts transfers
on the contract proxy instead: `gl.get_contract_at(addr).emit_transfer(value=…)`,
defined in `gl/genvm_contracts.py`. It works for a plain wallet address too.

**`emit_transfer` defaults to `on='finalized'`.** That is the behaviour we want
and it is the SDK's default, so the brief's "value only moves on finality" rule
is enforced for free. It also raises a bare `ValueError` when value is zero,
which would crash the VM with an empty error, so `_pay()` guards zero itself.

**`io` is a forbidden import, but Pillow is available.** `os`, `random`,
`pathlib`, `http`, `requests` are forbidden too — the list is
`FORBIDDEN_MODULES` in the linter's `lint/safety.py`. `hashlib`, `datetime`,
`urllib.parse` and `dataclasses` are allowed.

`io` being banned looks like it rules out image processing, because the usual
way in is `PIL.Image.open(io.BytesIO(body))`. It does not. **Pillow is present
in the GenVM runtime** — the SDK's own `gl.nondet.web.render(mode="screenshot")`
does `import PIL.Image` and `PIL.Image.open(io.BytesIO(raw))` at
`gl/nondet/web.py:146`. The ban is a linter rule on contract code, not a runtime
limit.

So `import PIL.Image` is fine, and the only thing needed is a stand-in for
`io.BytesIO`. `_BytesFile` at the bottom of `fieldwork.py` is that: the three
methods (`read`, `seek`, `tell`) Pillow actually asks for. Both lint and
validate pass with it.

**`genvm-lint validate` cannot see a class named `Contract`.** This is a bug in
the linter, not in your contract: `validate/sdk_loader.py:223` does
`if not isinstance(obj, type) or name == "Contract": continue`, skipping the
exact name GenLayer convention tells you to use. Both of these contracts and the
GenLayer Identity contracts all report `No contract class found`. To actually
run validation, copy to a temp file with the class renamed:

```bash
sed 's/^class Contract(gl.Contract):/class Probe(gl.Contract):/' contracts/fieldwork.py > /tmp/v.py
PYTHONIOENCODING=utf-8 genvm-lint check /tmp/v.py
```

**On Windows, set `PYTHONIOENCODING=utf-8`.** Otherwise the linter crashes with
`UnicodeEncodeError` trying to print its own tick character, and you cannot tell
a pass from a failure.

---

## What the contract uses beyond the brief

- **Events** — `TaskPosted`, `TaskClaimed`, `SubmissionGraded`,
  `SubmissionRefused`. The brief's chapter 05 wants an indexer that renders proof
  pages and drives the repeat-verification sample; events are how it follows
  along without polling every task. Event `__init__` takes indexed fields
  positionally before `/` and everything else as `**blob` — any named parameter
  after the `/` fails with `specify / after indexed fields`.
- **An LLM gate on the acceptance test at posting time.** `post_task` runs
  `gl.eq_principle.prompt_non_comparative` and refuses a test that is too vague
  to grade from a photograph. The brief's risk register names vague tests as a
  top risk and only requires that the three fields are non-empty. A bad test
  poisons every submission made against it and the worker carries the cost, so
  this is the highest-leverage place in the contract to spend one LLM call.
- **Pillow** for the pre-flight checks described below.

`min_gas(leader=…, validator=…)` is deliberately **not** set. It is real and
keyword-only, but the right numbers are unknown until the first real submissions
land, and a wrong minimum makes every `submit` fail. Add it once
`genlayer trace <txId>` has shown actual gas for a vision call with two images.

## Two things the brief got wrong

**There is no two image limit.** The brief builds the whole product shape around
"the vision call accepts two, which is why the entire product is a before and
after pair rather than a gallery". The SDK signature is
`images: Sequence[bytes | Image] | None` with no bound anywhere. Before/after is
a good *design* decision — it is what makes the same-place check meaningful —
but it is a choice, not a constraint. If a task ever needs three angles, the SDK
will take them.

**The reuse check as written was bypassable.** The brief computes a hash inside
`leader_fn` but its `validator_fn` only compares the three booleans:

```python
return all(mine[k] == theirs[k] for k in ("code_visible", "same_place", "test_passed"))
```

Nothing checks the hash, so a leader could return a hash that is not the
photograph's, walk past `if v["phash"] in self.phashes`, and get paid for an
image already used. `fieldwork.py` compares `content_hash` too. It is a pure
function of the fetched bytes, so honest nodes always agree on it, and a lying
one fails consensus.

---

## Image processing

Three things happen to the pixels, in this order.

**1. Pre-flight, before the model runs.** `_preflight()` opens each photograph
and refuses it if it cannot be decoded, if the long edge is under `MIN_EDGE`
(480px, below which a six character code is not legible), or if mean luminance
is outside `[DARK_MEAN, BRIGHT_MEAN]` = `[12, 243]`. Those bounds are extreme on
purpose: they catch a lens cap or the sun straight into the lens, not a dim
afternoon. A refused photograph never reaches `exec_prompt`, so the most
expensive call in the contract is skipped and the worker gets a specific reason
while they are still standing there.

Covered by `contracts/test_images.py` — 14 cases including the negatives that
matter (a dusk photo and a bright-day photo must still be accepted).

**2. Exact reuse, deterministic.** The CID is parsed out of the url before
anything is fetched, and `sha256` of the after image is computed in the
consensus block. Both are exact matches against everything already paid for.

**3. A perceptual hash that decides nothing.** `_dhash()` is recorded on the
task and shown on the receipt for human reviewers, and that is all it does.

### Why there is no perceptual reuse check

It was built — dHash plus LSH banding over four 16-bit bands — and then measured,
and the measurement killed it. Distances at 64 bits:

| | distance |
| --- | --- |
| same photograph, re-encoded at q55 | 8 |
| same photograph, resized | 4–6 |
| **same place, photographed another day** | **2** |
| a different scene entirely | 16–20 |

The populations overlap, and they overlap the wrong way round: honest repeat
work at the same corner scores *closer* than actual reuse. Going to 256 bits made
it worse (39 vs 28). There is no threshold. This is not a tuning problem, it is
the domain — every task in this product is a photograph of the same place, so
"looks almost identical" is the normal case rather than the suspicious one.

The failure mode also is not symmetric: a false positive tells a worker who did
the job that they are a fraud. So it does not vote.

**What actually catches a recycled photograph is the challenge code.** It is
issued at claim time, it is different for every claim, and an old photograph
carries the wrong one — which the vision model is already checking for, in the
call we are already paying for. The brief's own design had the answer; the
perceptual hash was never load-bearing.

`test_images.py` keeps the measurement as a test, so if the numbers ever
separate, the decision can be revisited on evidence.

---

## Deploy

Requires a funded Bradbury account. The CLI keeps the key in its own encrypted
keystore.

```bash
genlayer network set testnet-bradbury
genlayer account create --name fieldwork
genlayer account show
```

Fund the printed address at <https://testnet-faucet.genlayer.foundation/>, then:

```bash
# 1. Prove vision works at all. Point it at any public raster image.
genlayer deploy --contract contracts/vision_probe.py
genlayer write <PROBE_ADDRESS> describe --args "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gull_portrait_ca_usa.jpg/640px-Gull_portrait_ca_usa.jpg"
genlayer call <PROBE_ADDRESS> answer
```

If `answer` comes back describing a bird, image input works on this network and
Fieldwork is buildable. If it errors, stop — nothing else in the product matters.
Check `genlayer trace <txId>` for the real reason.

```bash
# 2. The product. Constructor arg is the take rate in basis points (600 = 6%).
genlayer deploy --contract contracts/fieldwork.py --args 600
```

Put the address in the site env and redeploy:

```
NEXT_PUBLIC_FIELDWORK_CONTRACT=0x…
```

### Verify the deploy actually landed

`ACCEPTED` is not enough; the code is only readable once finalized.

```bash
genlayer code <CONTRACT_ADDRESS>
genlayer schema <CONTRACT_ADDRESS>
```

---

## Method reference

Writes (wallet signed):

- `post_task(title, place, acceptance_test, example_pass, example_fail, lat_e6, lng_e6, reward, min_reputation)` — **payable**, send `reward + fee`
- `claim(task_id) -> str` — returns the six character challenge code
- `submit(task_id, before_url, after_url) -> str` — returns `paid` or `rejected`
- `release_expired(task_id)` — returns an abandoned claim to the pool
- `cancel_task(task_id)` — poster only, refunds reward and fee
- `withdraw_fees(to)`, `transfer_ownership(new_owner)` — owner only

Views are one per field (`status_of`, `reason_of`, `challenge_code_of`,
`acceptance_test_of`, `reward_of`, `before_url_of`, `after_url_of`,
`content_hash_of`, `reputation_of`, `total_tasks`, …). Run
`genlayer schema <address>` for the full list.

### The challenge code alphabet

`23456789ABCDEFGHJKMNPQRSTVWXYZ` — no `I`, `L`, `O`, `U`, `0` or `1`. The code is
written by hand on a scrap of paper and read back by a vision model, so
characters that are misread by hand are simply not in the alphabet. The brief
used `sha256` hex, which contains `0`, `1` and `O`-alikes.
