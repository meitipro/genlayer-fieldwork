# Claude Design prompt — Fieldwork demo video

Paste everything inside the rule below into Claude Design. It is written to be
self-contained: it carries the brand, the story, and every fact, so nothing has
to be invented.

Two notes before you use it:

- **Every number in it is measured, not marketing.** If you change a figure,
  change it to another true one. The product's entire argument is that it does
  not overclaim, and a demo video that oversells it undoes that.
- **The payout caveat is deliberate.** On Studio the money does not actually
  move. Leaving that out would make the video the one dishonest artefact in a
  project built around honesty.

---

Build me a 60–75 second product demo video for **Fieldwork**.

## What Fieldwork is

Bounties for physical work, verified by photograph. Someone posts a real-world
task and locks the payment up front. A worker does it, photographs the place
against a before frame the poster supplied, and an Intelligent Contract on GenLayer grades those two
photographs against a written standard and pays — verdict and payment in one
transaction.

The one-line version: **Do the work. Get paid on the spot.**

## The problem, in the opening 10 seconds

Coordinating physical work costs you twice: once for the work, once for checking
it. Checking usually means someone in an office, days later, looking at a folder
of photos — or not looking at all.

So the worker doesn't know when, or whether, they get paid. The decision belongs
to the person holding the money. Crypto solved paying a stranger and left
"was it actually done?" completely untouched.

## The story beats, in order

1. **The ask.** A poster writes a task. Not "tidy the yard" — a precise
   acceptance test: *"The bin area is empty. No bags remain against the wall,
   the ground is clear of loose litter, and both bins are upright with their
   lids closed."* They fund it in the same action. Show the money locking.

2. **The gate nobody expects.** The contract reads the acceptance test *before
   accepting the task* and refuses it if it can't be judged from a photograph.
   Show a vague one being rejected: *"Make sure the area is nice and clean and
   looks good when you finish"* → refused. This really happens on chain — it is
   the single most surprising beat, lead with it.

3. **The claim.** A worker takes the task. The contract issues a six-character
   code that belongs to this claim and this moment alone — e.g. `8AFMB6`. They
   have ninety minutes. Show the code appearing.

4. **The work.** They write the code on a scrap of paper, and shoot two
   photograph of the finished work with that paper in frame. Phone in one hand,
   outdoors, daylight. This should feel physical and unglamorous. Real hands,
   real bins, real biro on real paper.

5. **The judgement.** Several independent validators fetch the *same two images*
   and grade them against the *same written text*. They must agree on three
   things before anything moves:
   - the code is legible in both frames
   - it is the same place in both frames
   - the acceptance test passed

   Show these as three checks landing. Emphasise that **no single party decides**
   — not the poster, not one model, not one node.

6. **The receipt.** Verdict and payment are one transaction. A public page is
   left behind: both photographs, the exact text they were graded against, the
   three judgements, and how many validators agreed. Link-able, not buried in a
   dashboard.

## Three details worth a beat each if there is room

- **The code is the anti-fraud device.** A recycled photograph from last month
  carries the wrong code, and the model is already checking for it. Free.
- **The contract looks at the pixels before it pays for a grader.** Too dark,
  too small to read a code, or unopenable → refused in a fraction of a second
  with a specific instruction: *"the after photograph is too dark to grade,
  retake it with more light."*
- **A rejection does not burn the claim.** Most failures are lighting and
  framing, not fraud. The task stays yours; retake it.

## Tone and voice

Plain, short sentences. Written for someone holding a phone outdoors, not for a
conference stage. Confident but never breathless. No "revolutionary", no
"disrupting", no crypto-hype vocabulary. The product's whole personality is that
it tells you the truth including the unflattering parts.

Rejections in the product never imply dishonesty — they say what to change. Keep
that register.

## Look

- **Light, paper-like.** Cream background `#F5F2E9`, near-black ink `#14140F`,
  one single accent green `#0B7A3B`. There is a dark theme (`#121310`
  background, `#46C877` accent) if you want one beat at night.
- **One accent, three jobs only:** the primary action, the verified state, and
  the logo mark. Nothing else is coloured. Resist adding a second hue.
- **The mark** is camera brackets around a location pin — the brackets mean
  framing, the pin means place, which are the two things every submission has to
  get right.
- Monospace for codes, hashes, timestamps and small labels. Bold tight-tracked
  sans for headlines. No italics anywhere.
- Type scale: 12 / 14 / 15 / 18 / 22 / 30 / 44 and nothing between.

## Close on this

> The standard is public before anyone spends a minute. Several strangers grade
> the same evidence against the same words. Payment and verdict are the same
> transaction.

Then the mark and **fieldwork.app**.

## Do not claim any of this

These are false, and the product says so on its own `/limits` page:

- ❌ That it proves *where* a photograph was taken. **No system can.** Phone
  coordinates can be changed. Never show a "location verified" badge.
- ❌ That it detects a cropped or re-saved photograph by how it looks. This was
  built, measured, and removed — for this product the same corner on a different
  day scored *closer* than the same photo re-encoded, so it would accuse honest
  workers. Reuse is caught by the challenge code instead.
- ❌ That the model is always right. Validators agreeing is not the same as being
  correct. Every rejection can be escalated to a person.
- ❌ That it suits any task. Anything on private property, involving
  confrontation, or hazardous is refused at posting.

## If the video mentions money moving

It currently runs on GenLayer's **Studio** development network, where the
grading, the verdict and the receipt are all real but the transfer is not —
Studio debits the contract and never credits the payee. Measured directly:
funding a task moved 19.08 GEN in correctly; the refund took exactly 19.08 GEN
out of the contract and the payee's balance did not change by a single wei.

So either keep the money abstract, or say plainly that this is a development
network and balances move on a live one. Do not show a balance going up.
