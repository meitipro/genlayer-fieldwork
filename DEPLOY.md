# Deploying Fieldwork

From nothing to a running, seeded site. Every step says what "worked" looks
like, because on this stack a failure often reports success.

Target network is **Studio** (`studionet`). Bradbury has a confirmed bug where a
deploy reports `FINALIZED` and the code is then unreadable - step 3 is what
catches it.

---

## 0. Once

```bash
npm install
pip install genvm-linter
npm install -g genlayer
```

On Windows, export `PYTHONIOENCODING=utf-8` before any `genvm-lint` command, or
it crashes printing its own tick character and you cannot tell pass from fail.

---

## 1. Check the contract before spending anything on it

```bash
PYTHONIOENCODING=utf-8 genvm-lint check contracts/fieldwork.py
```

Expect `No contract class found` - that is a linter bug, not yours. It skips any
class literally named `Contract`, which is the GenLayer convention. To really
validate, rename into a temp copy:

```bash
sed 's/^class Contract(gl.Contract):/class Probe(gl.Contract):/' contracts/fieldwork.py > /tmp/probe.py && PYTHONIOENCODING=utf-8 genvm-lint check /tmp/probe.py
```

Good: `Lint passed`, `Validation passed`, **33 methods (26 view, 7 write)**.

Then the logic that needs no chain:

```bash
python contracts/test_contract_logic.py
```

```bash
python contracts/test_images.py
```

Both should end `all ... checks passed`.

---

## 2. Prove image input works on the network

Do this **before** deploying the product. It is the only thing that can sink
Fieldwork, and it costs nothing - Studio is gasless and the script uses a
throwaway in-memory account.

```bash
node scripts/prove-vision.mjs
```

Good: `vision text ok`, `vision json ok`, and the model describing the actual
photograph. If it says `INVALID_IMAGE`, read the three causes in
`contracts/README.md` - it is almost always that the url returned an error page
rather than an image.

---

## 3. Deploy

The deployer becomes the contract `owner`, and only the owner can
`withdraw_fees` or `transfer_ownership`. Use a **named CLI account**, not the
throwaway one in `scripts/deploy.mjs`.

```bash
genlayer network set studionet
```

```bash
genlayer account create --name fieldwork
```

```bash
genlayer deploy --contract contracts/fieldwork.py --args 600
```

`600` is the take rate in basis points (6%).

**`ACCEPTED` is not enough.** Confirm the code is really there:

```bash
genlayer schema <CONTRACT_ADDRESS>
```

Good: 33 methods listed. If this errors, you hit the Bradbury-style bug - do not
continue, redeploy.

---

## 4. Exercise it end to end

```bash
FIELDWORK=<CONTRACT_ADDRESS> node scripts/e2e.mjs
```

Good: `all end to end checks passed`. This covers posting, the LLM gate refusing
a vague acceptance test, underfunding, claiming, double-claim, and unknown ids.

Optional but worth knowing before you demo anything:

```bash
FIELDWORK=<CONTRACT_ADDRESS> node scripts/check-payout.mjs
```

On Studio this reports **the payout does not land** - the contract is debited by
exactly the right amount and the payee is never credited. That is Studio's
ledger, not the contract. The site already says so wherever it claims payment.

---

## 5. Seed real records

The launch checklist asks for real records before any announcement.

```bash
FIELDWORK=<CONTRACT_ADDRESS> node scripts/seed.mjs
```

Slow on purpose: every post runs the acceptance-test gate. It backs off through
Studio's `Server busy` and rate limits.

---

## 6. Point the site at it

Create `.env.local`:

```
NEXT_PUBLIC_GENLAYER_NETWORK=studionet
NEXT_PUBLIC_FIELDWORK_CONTRACT=0x...
PINATA_JWT=
CAS_GATEWAY=https://gateway.pinata.cloud
```

`PINATA_JWT` (from <https://app.pinata.cloud> → API Keys) is required for photo
upload. Without it everything else works and submitting a photograph does not - the contract only accepts content addressed urls.

```bash
npm run dev
```

Never run `npm run build` while `npm run dev` is running. Both write `.next` and
the dev server dies with `Cannot find module './682.js'`. Fix: stop it,
`rm -rf .next`, start again.

---

## 7. Check it

```bash
npm run build
```

Then walk `/`, `/map`, `/task/<id>`, `/submit/<id>`, `/console`, `/limits` in
both themes. On the task page, "Claim this task" must be a real transaction that
returns a six character code.

A few rate-limit lines during build are normal - Studio allows 30 requests a
minute and the reads back off and retry.

---

## Switching to a live network later

`lib/chain.ts` is the only switch. But **contract addresses are per network**:
change `NEXT_PUBLIC_GENLAYER_NETWORK` without redeploying and updating
`NEXT_PUBLIC_FIELDWORK_CONTRACT`, and the app points at an address that does not
exist. Redo steps 3 - 6.

Two things become true on a live network that are not true on Studio: payouts
actually land, and gas is real - `REQUIRES_GAS` turns on, so the "no GEN" guard
starts rejecting unfunded wallets instead of being skipped.
