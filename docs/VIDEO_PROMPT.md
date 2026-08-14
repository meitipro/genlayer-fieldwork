# Claude Design prompts - Fieldwork video

Two prompts below, each self-contained. Paste one whole block into Claude Design.

- **Prompt A** is the full film, 75 to 90 seconds. The complete story.
- **Prompt B** is a 15 second teaser. One idea, hard cuts, no narration.

Three rules that apply to both, and that matter more than anything else here:

- **Every number is measured, not marketing.** Change a figure only to another
  true one. The product's whole argument is that it does not overclaim, and a
  video that oversells it undoes the product.
- **The payout caveat is deliberate.** On Studio the money does not move.
  Leaving that out would make the video the one dishonest artefact in a project
  built around honesty.
- **No em dashes.** House style is the spaced hyphen, and the interface uses it
  everywhere. An em dash in a title card breaks the typography.

---
---

# PROMPT A - the full film

Build me a 75 to 90 second product film for **Fieldwork**.

## What Fieldwork is

Bounties for physical work, settled by photograph. Someone posts a real world
task, writes down exactly what "done" looks like, photographs how the place
looks right now, and locks the payment. A worker claims it, does it, and
photographs the result. An Intelligent Contract on GenLayer grades the two
photographs against the written standard and settles.

The one line version: **Evidence in, settlement out.**

## The problem, in the first 10 seconds

Coordinating physical work costs you twice: once for the work, once for checking
it. Checking means someone in an office, days later, looking at a folder of
photos. Or not looking at all.

So the worker does not know when, or whether, they get paid. The decision
belongs to whoever is holding the money. Crypto solved paying a stranger and
left "was it actually done?" completely untouched.

## The story beats, in order

**1. The standard.** A poster writes the task. Not "tidy the yard" but a
precise acceptance test:

> The bin area is empty. No bags remain against the wall, the ground is clear of
> loose litter, and both bins are upright with their lids closed.

**2. The poster's own photograph.** They shoot how the place looks now. This is
the beat that makes the product make sense, so give it room. The before frame
belongs to whoever is paying, not to whoever is being paid. A worker who
supplies both frames can photograph a mess, clear it, and be paid for work
nobody needed. Show the poster standing where they would stand to judge it,
taking the shot, and funding the task in the same action. Show the money
locking.

**3. The gate nobody expects.** Before the task exists, the contract reads the
acceptance test and refuses it if it cannot be judged from a photograph. Show a
vague one bouncing:

> "Make sure the area is nice and clean and looks good when you finish"

refused. In the same round trip it opens the poster's photograph and refuses
that too if nobody could grade it. This really happens on chain, and it is the
most surprising beat in the film. Do not bury it.

**4. The claim.** A worker takes the task. The contract issues a six character
code belonging to this claim and this moment alone, for example `K73QXB`. Ninety
minutes on the clock. Show the code arriving on the phone, big and green.

**5. The work.** Biro on a scrap of paper. One photograph of the finished work
with that paper in frame. One, not two: the before frame is already on the task,
and the worker only ever supplies the after. Phone in one hand, outdoors,
daylight. Real hands, real bins, real paper. This beat should feel physical and
unglamorous.

**6. The judgement.** Independent validators fetch the same two photographs and
grade them against the same written text. They must agree on three things before
anything moves:

- the code is legible in the worker's frame
- both frames show the same place
- the acceptance test passed

Land these as three checks. Emphasise that **no single party decides**: not the
poster, not one model, not one node.

**7. The receipt.** Verdict and payment are one transaction. A public page is
left behind carrying both photographs, the exact text they were graded against,
the three judgements, and the reason given to the worker. A link you can send
someone, not a row in a dashboard.

## Three details worth a beat each if there is room

- **The code is the anti fraud device.** A photograph recycled from last month
  carries the wrong code, and the grader is already looking for it. Free.
- **The contract checks the file before it pays for a grader.** Unopenable, or
  too small for a six character code to be legible, and it is refused in a
  fraction of a second with an instruction rather than a verdict.
- **A rejection does not burn the claim.** Most failures are lighting and
  framing, not fraud. The task stays yours. Retake it.

## The look

This is the part to get exactly right. The interface is a dark instrument panel
and the film should feel like it.

**Dark is the default.** A light theme exists and is worth one beat if you want
contrast, but open and close in the dark.

| role | dark | light |
| --- | --- | --- |
| background | `#101216` | `#f5f6f2` |
| raised panel | `#171a1f` | `#ffffff` |
| recessed panel | `#14171b` | `#fbfcf9` |
| hairline | `#262a31` | `#e3e6dd` |
| stronger line | `#2f353d` | `#d6dacf` |
| primary text | `#eef1f4` | `#14181a` |
| secondary text | `#a4abb4` | `#4d545a` |
| quiet text | `#8d949e` | `#6a7178` |
| accent | `#7ac943` | `#4a8b1c` |
| text on accent | `#0d1a06` | `#ffffff` |
| grid lines | `#1b1f26` | `#e8ebe3` |
| footer | `#0c0e11` | `#eef0ea` |
| refusal | `#f08a72` | `#9b2c1c` |

**One accent, three jobs only:** the primary action, the verified state, and the
mark. Nothing else is coloured. Resist a second hue.

**Type.** Manrope for everything human, weights 400 to 800. JetBrains Mono for
codes, hashes, timestamps, rewards, and every small uppercase label. Headlines
are weight 800 with tight tracking, around `-0.045em` at the largest size. Small
mono labels run the other way, `0.14em` to `0.16em`, uppercase. No italics
anywhere.

**The surveyor grid.** A 56px square grid at low opacity behind the opening,
with a soft green radial glow up in the top right. It should read as a survey
plot rather than a tech background.

**The mark** is camera brackets around a location pin. The brackets mean
framing, the pin means place, which are the two things every submission has to
get right.

## The one piece of motion that matters

The site's hero is a stack of evidence floating in 3D, and it is the only place
in the entire product where depth is spent. Rebuild it as the film's signature
shot.

Five layers on a shared plane, seen at a steep isometric angle, roughly
`rotateX(54deg) rotateZ(-36deg)` under a 1300px perspective. From the ground up:

1. the task itself, a flat plate with a faint green edge
2. the acceptance test card, floating a little above it, with the code `K73QXB`
   in mono green at the bottom
3. the poster's **Before** photograph, higher again, offset left
4. the worker's **After** photograph, higher still, offset down and right
5. a solid green pill reading **Paid - 18 GEN**, highest of all, because it is
   the last thing that happens

Then the whole stack eases up towards the viewer, to about
`rotateX(38deg) rotateZ(-22deg)`, over 0.7 seconds on `cubic-bezier(.2,.7,.3,1)`.
It moves as one solid object, never as five independent cards. That single
movement is the film's hero moment. Hold on it.

Everything else moves the way the interface does: cards lift 3px with an accent
edge, buttons do nothing clever, nothing bounces.

## Copy to use verbatim

These are the real strings from the product. Using them keeps the film and the
site the same artefact.

- `Evidence in - settlement out`
- `One written standard, two photographs and independent graders - the verdict and the payment leave the contract as a single transaction`
- `Live on studionet - chain 61999`
- `01 - Standard` / `02 - Evidence` / `03 - Settlement`
- `Tasks settled` `1,204` / `First attempt pass` `83%` / `Median to settlement` `4m`
- `Your code for this claim`
- `Submit for settlement`
- `Paid - 18 GEN`
- `Physical work - verified by photograph`

## Tone

Plain, short sentences. Written for someone holding a phone outdoors, not for a
conference stage. Confident and never breathless. No "revolutionary", no
"disrupting", no crypto vocabulary at all. The product's entire personality is
that it tells you the truth including the unflattering parts.

Rejections in the product never imply dishonesty. They say what to change. Keep
that register everywhere.

## Close on this

> The standard is public before anyone spends a minute. The starting state comes
> from the person paying. Strangers grade the same evidence against the same
> words. Payment and verdict are one transaction.

Then the mark, and **fieldwork**.

## Keep the film accurate

The product's argument is that it settles work honestly, so a film that oversells
it undercuts the thing it is selling. None of the following is true of it, so do
not put any of them on screen:

- **Never** that it proves *where* a photograph was taken. No system can. Phone
  coordinates can be changed. Never show a "location verified" badge.
- **Never** that it spots a cropped or re-saved photograph by how it looks. That
  was built, measured, and removed: the same corner on a different day scored
  closer than the same photograph re-encoded, so it would have accused honest
  workers. Reuse is caught by the challenge code instead.
- **Never** that the code appears in the before frame. It cannot. The code is
  issued at claim time, and the poster shot that frame before anyone claimed.
- **Never** show an appeal, a reviewer or a support queue. There is none, and
  none is wanted: what a rejected worker gets is the rest of their window to
  retake, and a public receipt anyone can check the grading against. Show the
  retake.
- **Never** that a posted task has been vetted for safety. The gate at posting
  time asks one question only: can this acceptance test be graded from a
  photograph. Nothing reads a task for danger.

## If the film shows money moving

It currently runs on GenLayer's **Studio** development network, where the
grading, the verdict and the receipt are all real and the transfer is not.
Studio debits the contract and never credits the payee. Measured directly:
funding a task moved 19.08 GEN in correctly, and paying out took exactly 19.08
GEN out of the contract while the payee's balance did not change by a single
wei.

So either keep the money abstract, or say plainly that this is a development
network and that balances move on a live one. Do not show a balance going up.

---
---

# PROMPT B - the 15 second teaser

Build me a 15 second teaser for **Fieldwork**, a product that settles payment for
physical work by photograph.

No voiceover. No music swell resolving into a logo. Hard cuts, and one idea:
**the proof arrives before the payment does.**

## The cut list

| time | what is on screen |
| --- | --- |
| 0.0 - 1.5s | Black. A single mono line types out in green on `#101216`: `The bin area is empty. No bags against the wall.` Cursor blinks once. |
| 1.5 - 3.0s | Hard cut. Daylight, handheld. Bin bags heaped against a brick wall, litter on the ground, one lid open. Ugly and real. Hold long enough to be uncomfortable. |
| 3.0 - 4.0s | Cut to a phone screen, dark UI. A six character code slams in, mono, green, wide tracking: `K73QXB`. Below it, small and grey: `90 minutes`. |
| 4.0 - 6.0s | Biro writing that code onto a scrap of paper. Extreme close. Real hand, bad handwriting. |
| 6.0 - 8.0s | The same wall, now clear. The paper with the code held in frame at the edge of the shot. Shutter sound. Freeze. |
| 8.0 - 11.0s | The signature shot. The frozen photograph drops into a 3D stack of evidence floating on a dark survey grid, and the whole stack eases up towards camera. See below. |
| 11.0 - 12.5s | Three mono lines land one after another, fast, green ticks: `code visible` / `same place` / `test passed` |
| 12.5 - 14.0s | Everything drops away except a single solid green pill, centred: `Paid - 18 GEN`. One beat of silence. |
| 14.0 - 15.0s | Cut to black. The mark, then `fieldwork` in mono, then `Evidence in - settlement out` in small grey. |

## The signature shot, 8.0 to 11.0s

Five layers on a shared plane under a 1300px perspective, seen at roughly
`rotateX(54deg) rotateZ(-36deg)`. Ground up:

1. a flat plate, faint green edge
2. the acceptance test card, with `K73QXB` in mono green
3. the **Before** photograph, offset left
4. the **After** photograph, offset down and right
5. a solid green `Paid - 18 GEN` pill, highest

The stack eases towards the viewer to about `rotateX(38deg) rotateZ(-22deg)`
over 0.7 seconds on `cubic-bezier(.2,.7,.3,1)`, moving as one solid object. A
56px survey grid sits underneath at low opacity with a soft green glow top
right.

## Look

Background `#101216`. Text `#eef1f4`. Grey `#8d949e`. One accent and only one:
`#7ac943`, on `#0d1a06` when it is a filled pill. Grid `#1b1f26`.

Manrope 800 for the two title cards. JetBrains Mono for the code, the three
checks, the pill and the wordmark. Uppercase mono labels track wide at `0.14em`.
No italics. No em dashes: the connector is a spaced hyphen.

## Sound

Diegetic only. A biro on paper. A camera shutter. One low sub hit when the pill
lands. Silence everywhere else. The silence is the point.

## Do not

- Do not show a wallet balance going up. This runs on a development network
  where the transfer does not land, and the film should not claim otherwise.
- Do not show a map pin, a GPS lock, or anything implying the location was
  proved. It was not, and no system can.
- Do not put the code in the before photograph. It does not exist yet when that
  frame is taken.
- No stock crypto imagery. No glowing chains, no rotating coins, no particles.
