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

**`io` is a forbidden import.** So is `os`, `random`, `pathlib`, `http`,
`requests`. This is what kills perceptual hashing: you cannot do
`PIL.Image.open(io.BytesIO(body))`, so pixels cannot be decoded on chain. See
"Reuse detection" below. `hashlib`, `datetime`, `urllib.parse` and `dataclasses`
are all allowed.

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

## Reuse detection, and what it honestly catches

Two layers, both deterministic:

1. **Content id, before any model runs.** Photograph urls must be content
   addressed (the contract refuses any other host). The CID is parsed straight
   out of the url in the deterministic half, so a repeat submission is rejected
   *without paying for a vision call*.
2. **`sha256` of the fetched bytes**, computed in the consensus block and
   compared by every validator.

Neither is perceptual. A cropped or re-saved photograph produces a different
hash and will not be caught by arithmetic — `io` and PIL are unavailable, so
there is no way to decode pixels on chain. That gap is real, it is stated on
`/limits`, and the defence against it is the random repeat-verification sample
plus human review. Better to say so than to claim a defence that is not there.

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
