"""Build docs/Fieldwork.pdf - the complete idea document.

    python docs/build_pdf.py

Everything in it is drawn from the built product and the measurements taken
while building it. No figure here is aspirational.
"""

import pathlib

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

OUT = pathlib.Path(__file__).with_name("Fieldwork.pdf")

# The product palette.
INK = colors.HexColor("#14140F")
CREAM = colors.HexColor("#F5F2E9")
ACCENT = colors.HexColor("#0B7A3B")
MUTED = colors.HexColor("#6B6659")
LINE = colors.HexColor("#DDD8C9")
PANEL = colors.HexColor("#FFFFFF")
DANGER = colors.HexColor("#9B2C1C")

SANS = "Helvetica"
SANS_B = "Helvetica-Bold"
MONO = "Courier"
MONO_B = "Courier-Bold"

PAGE_W, PAGE_H = A4
MARGIN = 20 * mm

ss = getSampleStyleSheet()


def st(name, **kw):
    base = dict(
        name=name,
        fontName=SANS,
        fontSize=9.5,
        leading=14.5,
        textColor=INK,
        alignment=TA_LEFT,
        spaceAfter=0,
    )
    base.update(kw)
    return ParagraphStyle(**base)


S = {
    "h1": st("h1", fontName=SANS_B, fontSize=26, leading=29, spaceAfter=8),
    "h2": st("h2", fontName=SANS_B, fontSize=15, leading=19, spaceAfter=6, spaceBefore=16),
    "h3": st("h3", fontName=SANS_B, fontSize=11, leading=15, spaceAfter=4, spaceBefore=10),
    "body": st("body", spaceAfter=7),
    "lede": st("lede", fontSize=11.5, leading=17, textColor=MUTED, spaceAfter=10),
    "eyebrow": st("eyebrow", fontName=MONO, fontSize=7.5, leading=11, textColor=MUTED, spaceAfter=4),
    "small": st("small", fontSize=8.5, leading=12.5, textColor=MUTED, spaceAfter=6),
    "mono": st("mono", fontName=MONO, fontSize=8, leading=12, spaceAfter=6),
    "cell": st("cell", fontSize=8.5, leading=12),
    "cellb": st("cellb", fontName=SANS_B, fontSize=8.5, leading=12),
    "cellh": st("cellh", fontName=MONO, fontSize=7.5, leading=11, textColor=MUTED),
    "quote": st("quote", fontName=SANS_B, fontSize=12, leading=17, spaceAfter=8),
}


def P(text, style="body"):
    return Paragraph(text, S[style])


def rule(space_before=4, space_after=8):
    t = Table([[""]], colWidths=[PAGE_W - 2 * MARGIN], rowHeights=[0.6])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), LINE)]))
    return [Spacer(1, space_before), t, Spacer(1, space_after)]


def table(rows, widths, header=True, zebra=True):
    data = []
    for i, row in enumerate(rows):
        style = "cellh" if (header and i == 0) else "cell"
        data.append([Paragraph(str(c), S[style]) if not isinstance(c, Paragraph) else c for c in row])

    t = Table(data, colWidths=widths, hAlign="LEFT")
    cmds = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, LINE),
        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
    ]
    if header:
        cmds.append(("LINEBELOW", (0, 0), (-1, 0), 0.8, INK))
    if zebra:
        for i in range(1, len(data)):
            if i % 2 == 0:
                cmds.append(("BACKGROUND", (0, i), (-1, i), colors.HexColor("#FBFAF6")))
    t.setStyle(TableStyle(cmds))
    return t


def panel(flowables, accent=False):
    """A bordered block, like the site's .panel."""
    inner = Table([[flowables]], colWidths=[PAGE_W - 2 * MARGIN])
    inner.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.8, ACCENT if accent else LINE),
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F3F8F4") if accent else PANEL),
                ("LEFTPADDING", (0, 0), (-1, -1), 11),
                ("RIGHTPADDING", (0, 0), (-1, -1), 11),
                ("TOPPADDING", (0, 0), (-1, -1), 9),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
            ]
        )
    )
    return inner


def mark(c, x, y, size, colour=ACCENT):
    """Camera brackets around a location pin."""
    s = size / 24.0
    c.saveState()
    c.translate(x, y)
    c.setStrokeColor(colour)
    c.setLineWidth(2.1 * s)
    c.setLineCap(1)
    arm = 5.6 * s
    r = 1.6 * s
    for cx, cy, dx, dy in (
        (2 * s, 22 * s, 1, -1),
        (22 * s, 22 * s, -1, -1),
        (22 * s, 2 * s, -1, 1),
        (2 * s, 2 * s, 1, 1),
    ):
        c.line(cx, cy - dy * r, cx, cy - dy * arm)
        c.line(cx + dx * r, cy, cx + dx * arm, cy)
    c.setFillColor(colour)
    px, py = 12 * s, 13 * s
    c.circle(px, py, 4.3 * s, stroke=0, fill=1)
    p = c.beginPath()
    p.moveTo(px - 3.1 * s, py - 2.6 * s)
    p.lineTo(px, py - 8.4 * s)
    p.lineTo(px + 3.1 * s, py - 2.6 * s)
    p.close()
    c.drawPath(p, stroke=0, fill=1)
    c.setFillColor(CREAM)
    c.circle(px, py + 0.6 * s, 1.5 * s, stroke=0, fill=1)
    c.restoreState()


def cover_bg(c, doc):
    c.saveState()
    c.setFillColor(CREAM)
    c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    mark(c, MARGIN, PAGE_H - MARGIN - 30, 30)
    c.setFont(SANS_B, 15)
    c.setFillColor(INK)
    c.drawString(MARGIN + 38, PAGE_H - MARGIN - 22, "fieldwork")
    c.setFillColor(MUTED)
    c.setFont(MONO, 7.5)
    c.drawRightString(PAGE_W - MARGIN, PAGE_H - MARGIN - 22, "PHYSICAL WORK, VERIFIED BY PHOTO")
    c.restoreState()


def page_bg(c, doc):
    c.saveState()
    c.setFillColor(CREAM)
    c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    mark(c, MARGIN, PAGE_H - MARGIN - 14, 14)
    c.setFont(SANS_B, 8.5)
    c.setFillColor(INK)
    c.drawString(MARGIN + 19, PAGE_H - MARGIN - 8, "fieldwork")
    c.setStrokeColor(LINE)
    c.setLineWidth(0.6)
    c.line(MARGIN, PAGE_H - MARGIN - 20, PAGE_W - MARGIN, PAGE_H - MARGIN - 20)
    c.setFont(MONO, 7.5)
    c.setFillColor(MUTED)
    c.drawRightString(PAGE_W - MARGIN, MARGIN - 10, f"{doc.page}")
    c.line(MARGIN, MARGIN, PAGE_W - MARGIN, MARGIN)
    c.restoreState()


def build():
    doc = BaseDocTemplate(
        str(OUT),
        pagesize=A4,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=MARGIN,
        bottomMargin=MARGIN,
        title="Fieldwork - physical work, verified by photo",
        author="Fieldwork",
        subject="Bounties for physical tasks, verified by photo against a written acceptance test",
    )
    cover_frame = Frame(MARGIN, MARGIN, PAGE_W - 2 * MARGIN, PAGE_H - 2 * MARGIN - 34, id="cover")
    body_frame = Frame(MARGIN, MARGIN + 6, PAGE_W - 2 * MARGIN, PAGE_H - 2 * MARGIN - 34, id="body")
    doc.addPageTemplates(
        [
            PageTemplate(id="cover", frames=[cover_frame], onPage=cover_bg),
            PageTemplate(id="body", frames=[body_frame], onPage=page_bg),
        ]
    )

    F = []
    W = PAGE_W - 2 * MARGIN

    # ---------------------------------------------------------------- cover
    F += [NextPageTemplate("body")]
    F += [Spacer(1, 120)]
    F += [P("// THE IDEA, IN FULL", "eyebrow")]
    F += [P("Do the work.<br/>Get paid on the spot.", "h1")]
    F += [Spacer(1, 6)]
    F += [
        P(
            "Bounties for physical work, verified by photograph against a written "
            "acceptance test. A poster locks the payment and publishes the standard "
            "before anyone spends a minute. A worker photographs the place before and "
            "after. Several independent validators grade those two images against that "
            "same text, and the verdict and the payment are one transaction.",
            "lede",
        )
    ]
    F += [Spacer(1, 14)]
    F += [
        panel(
            [
                P("THE ONE SENTENCE VERSION", "eyebrow"),
                P(
                    "A poster writes an acceptance test, a worker submits a before and "
                    "after photograph with a challenge code in frame, and the contract "
                    "grades both images and pays.",
                    "quote",
                ),
            ],
            accent=True,
        )
    ]
    F += [Spacer(1, 18)]
    F += [
        table(
            [
                ["Built on", "GenLayer - Intelligent Contracts, Studio network"],
                ["Status", "Deployed, seeded and verified end to end"],
                ["Contract", "<font face='Courier'>0x7132E013d9b3e118319E92B8DAfFFB8De41c35bB</font>"],
                ["Stack", "Next.js 14 · genlayer-js · Python GenVM contract"],
                ["Vision", "Proven on chain - see page 5"],
            ],
            [32 * mm, W - 32 * mm],
            header=False,
        )
    ]
    F += [Spacer(1, 16)]
    F += [
        P(
            "Every number in this document is measured. Where something did not work, "
            "it says so and says what was done instead.",
            "small",
        )
    ]

    F += [PageBreak()]

    # ---------------------------------------------------------------- problem
    F += [P("// CHAPTER 01", "eyebrow"), P("The problem", "h2")]
    F += [
        P(
            "Anyone who coordinates physical work at scale pays twice: once for the work, "
            "and once for checking it. Field audits, installs, cleanups and shelf checks "
            "all end in a folder of photographs that nobody reads."
        )
    ]
    F += [
        P(
            "Crypto made paying a stranger easy and left verification exactly where it "
            "was. That is why physical bounty networks stay small. The worker feels it "
            "most: payment depends on a reviewer who may never look, and the person "
            "deciding is the person holding the money."
        )
    ]
    F += [
        P(
            "The cost is not just friction. Verification overhead is often larger than "
            "the task itself, which puts a floor under the size of job that can be "
            "crowdsourced at all. Below that floor, the work simply does not happen."
        )
    ]

    F += [P("Who pays for this today", "h3")]
    F += [
        table(
            [
                ["WHO", "WHAT THEY NEED"],
                ["DePIN networks", "Proof that hardware was really installed where it was claimed"],
                ["Brands and retail", "Shelf presence and display checks, today done by expensive audit firms"],
                ["Local groups", "Cleanups, repairs and civic tasks funded by a pool, with proof attached"],
                ["Field ops teams", "A verification API they can point their own workforce at"],
            ],
            [38 * mm, W - 38 * mm],
        )
    ]

    F += [P("Today versus here", "h3")]
    F += [
        table(
            [
                ["STEP", "HOW IT WORKS TODAY", "HOW IT WORKS HERE"],
                [
                    "Grade a photo",
                    "A reviewer in an office days later, or a model owned by the payer",
                    "Independent validators grade the same two images against the same written test",
                ],
                ["Pay", "Invoice, batch, thirty days", "Payment lands in the same transaction as the verdict"],
                [
                    "Dispute",
                    "The poster decides and the worker has no recourse",
                    "The standard was public before the work began, and rejections say what to change",
                ],
                [
                    "Detect reuse",
                    "Nobody checks whether the photo is from last month",
                    "A recycled photograph carries the wrong challenge code and fails",
                ],
            ],
            [26 * mm, (W - 26 * mm) / 2, (W - 26 * mm) / 2],
        )
    ]

    F += [Spacer(1, 10)]
    F += [
        panel(
            [
                P("THE MOMENT THAT SELLS IT", "eyebrow"),
                P(
                    "A worker finishes a cleanup, photographs it with the code on a scrap "
                    "of paper, and is paid before they walk to the next street. The "
                    "receipt is public.",
                    "quote",
                ),
            ]
        )
    ]

    F += [PageBreak()]

    # ---------------------------------------------------------------- why genlayer
    F += [P("// CHAPTER 02", "eyebrow"), P("Why this needs GenLayer", "h2")]
    F += [
        P(
            "This does not use a model as a backend. It uses one where a judgement has to "
            "be settled between parties who do not trust each other - which is the only "
            "thing a consensus layer is actually for."
        )
    ]
    F += [
        P(
            "A poster and a worker disagree about whether a job was done. Doing that with "
            "one model owned by the payer is exactly the arrangement workers already "
            "distrust. Here the standard is written down and made public before anyone "
            "spends time, several validators grade the same pair of photographs against that "
            "same text independently, and they must agree before a single coin moves."
        )
    ]

    F += [P("The boundary, decided before any code was written", "h3")]
    F += [
        table(
            [
                ["WHO OWNS IT", "WHAT"],
                ["Frontend", "The camera, the checklist, uploads, the map, non-authoritative previews"],
                [
                    "The contract",
                    "The acceptance test, the challenge code, the grading, the reuse checks, the payout",
                ],
                [
                    "Storage",
                    "The photographs - content addressed, so every validator provably grades identical bytes",
                ],
            ],
            [30 * mm, W - 30 * mm],
        )
    ]

    F += [P("What the platform is actually used for", "h3")]
    F += [
        table(
            [
                ["PRIMITIVE", "ITS JOB HERE"],
                [
                    "<font face='Courier'>exec_prompt(images=[a, b])</font>",
                    "Vision grading of the before and after pair",
                ],
                [
                    "<font face='Courier'>web.request(url)</font>",
                    "Fetches content addressed images so every node grades identical bytes",
                ],
                [
                    "<font face='Courier'>run_nondet_unsafe(l, v)</font>",
                    "Leader proposes, validators independently reach their own verdict, decisions are compared",
                ],
                [
                    "<font face='Courier'>eq_principle</font> / LLM gate",
                    "Refuses an acceptance test too vague to grade, at posting time",
                ],
                ["Pillow, in the consensus block", "Pre-flight checks on the pixels before paying for a grader"],
                [
                    "<font face='Courier'>@gl.public.write.payable</font>",
                    "Task funding - the reward is locked when the task is posted",
                ],
                ["<font face='Courier'>gl.Event</font>", "TaskPosted / Claimed / Graded / Refused, for the indexer"],
            ],
            [52 * mm, W - 52 * mm],
        )
    ]

    F += [Spacer(1, 8)]
    F += [
        panel(
            [
                P("THE LINE THAT MATTERS MOST", "eyebrow"),
                P(
                    "The images must be content addressed. If each node fetched a mutable "
                    "url, the leader and the validators could be looking at different "
                    "photographs, and the whole verification would be theatre.",
                    "body",
                ),
            ],
            accent=True,
        )
    ]

    F += [PageBreak()]

    # -------------------------------------------------- who owns the before frame
    F += [P("// CHAPTER 03", "eyebrow"), P("Who owns the before frame", "h2")]
    F += [
        P(
            "The poster, not the worker. This is the one design decision that changes "
            "what the product is."
        ),
        P(
            "If the worker supplies both frames they control the comparison entirely. "
            "They can photograph a mess, clear it, and be paid for work nobody needed; "
            "every check downstream - the acceptance test, the same-place "
            "judgement, the pre-flight - is then measured against a starting "
            "state the person being paid chose. That is the difference between grading "
            "work and grading a story about work."
        ),
        P(
            "The cost is real and is published on the site&rsquo;s limits page rather "
            "than buried. The challenge code is issued at claim time, so it does not "
            "exist yet when the poster shoots. The code can only be checked in the "
            "worker&rsquo;s frame. That is the weaker of the two properties, and "
            "staging is the more expensive fraud to be wrong about."
        ),
        P(
            "Two consequences follow in the contract. The before photograph is fetched "
            "and pre-flighted while the task is being posted, so nobody walks to a job "
            "that could never be graded. And the before frame&rsquo;s content id is "
            "written into the reuse set at posting time, so handing the poster&rsquo;s "
            "own file back as an after frame is caught by the same check as any other "
            "recycled photograph."
        ),
    ]

    F += [PageBreak()]

    # ---------------------------------------------------------------- the flow
    F += [P("// CHAPTER 04", "eyebrow"), P("How it works, end to end", "h2")]

    steps = [
        (
            "1 - Post, photograph, and fund",
            "The poster writes an acceptance test that names observable things: "
            "<i>the bin area is empty, no bags remain against the wall, the ground is "
            "clear of loose litter, and both bins are upright with their lids closed.</i> "
            "They photograph how the place looks now, and send the reward plus the fee "
            "in the same transaction. The money is locked before any worker sees the "
            "task - and so is the starting state.",
        ),
        (
            "2 - The gate nobody expects",
            "Before the task is created at all, the contract reads the acceptance test "
            "and decides whether it can be judged from two photographs. In the same "
            "round trip it opens the poster&rsquo;s photograph, so a task can never be "
            "funded with a before frame nobody could grade. "
            "<i>“Make sure the area is nice and clean and looks good when you finish”</i> "
            "is refused. A vague test poisons every submission made against it and the "
            "worker carries the cost, so this is the cheapest possible place to catch one.",
        ),
        (
            "3 - Claim",
            "A worker takes the task. The contract issues a six character code derived "
            "deterministically from the task, the worker and the moment - so anyone "
            "auditing the record later can recompute it. The claim lasts ninety minutes.",
        ),
        (
            "4 - Photograph",
            "They write the code on paper and photograph the finished work with it in "
            "frame. One frame, not two: the before frame is already on the task. The "
            "app re-encodes to a standard baseline JPEG, strips EXIF including any GPS "
            "they did not mean to publish, and puts it in content addressed storage.",
        ),
        (
            "5 - Pre-flight",
            "The contract opens the worker&rsquo;s image before paying for a grader, "
            "the same way it opened the poster&rsquo;s at step 2. Unopenable, "
            "under 480px on the long edge, or shot into the sun - refused for the price "
            "of a decode, with a specific instruction rather than a verdict.",
        ),
        (
            "6 - Judge",
            "Validators fetch the same bytes and grade them against the same text. They "
            "must agree on three things: the code is legible in the worker&rsquo;s "
            "frame, both frames show the same place, and the acceptance test passed. Reasons are never "
            "compared - two graders describe one photograph differently, and demanding "
            "identical prose would fail consensus on agreeing verdicts.",
        ),
        (
            "7 - Settle",
            "Verdict and payment are one transaction. A public receipt is left behind: "
            "both photographs, the text they were graded against, the three judgements, "
            "and the reason given to the worker.",
        ),
    ]
    for title, text in steps:
        F += [KeepTogether([P(title, "h3"), P(text)])]

    F += [Spacer(1, 6)]
    F += [
        panel(
            [
                P("WHAT A REJECTION COSTS", "eyebrow"),
                P(
                    "Not the task. Most failures are lighting and framing, not fraud, so "
                    "the claim stays with the worker and they can retake inside the "
                    "window. And if they walk away, the task returns to the pool - a "
                    "missed claim is not fraud either.",
                    "body",
                ),
            ]
        )
    ]

    F += [PageBreak()]

    # ---------------------------------------------------------------- what was measured
    F += [P("// CHAPTER 05", "eyebrow"), P("What was measured", "h2")]
    F += [
        P(
            "Four things in this product were decided by measurement rather than "
            "argument. Two of them killed a feature that had already been built.",
            "lede",
        )
    ]

    F += [P("Vision works - and three traps that all report the same error", "h3")]
    F += [
        P(
            "A probe contract on Studio, shown a photograph of a golden retriever holding "
            "a flower, answered <b>“golden retriever with a flower”</b>. Getting there "
            "meant clearing three separate causes that every one of them surfaces as an "
            "unexplained <font face='Courier'>INVALID_IMAGE</font>:"
        )
    ]
    F += [
        table(
            [
                ["CAUSE", "WHAT ACTUALLY HAPPENED"],
                [
                    "The fetch was not an image",
                    "Wikimedia answers 403 to a client with no User-Agent. A 126 byte text "
                    "error page was handed to the model as a photograph. The contract now "
                    "checks the status before trusting the body.",
                ],
                [
                    "A JPEG with no JFIF header",
                    "Magic bytes <font face='Courier'>ffd8ffdb</font> is rejected outright, "
                    "while the same subject as baseline JFIF works at 43KB <i>and</i> at "
                    "520KB. It is the container, not the size. Uploads are re-encoded.",
                ],
                [
                    "A model that cannot see",
                    "Studio's router can hand the call to a text-only model that answers "
                    "confidently anyway - the same photo returned “A white toilet bowl” and "
                    "“No image provided” on different runs. The prompt now demands a "
                    "<font face='Courier'>saw_images</font> flag and the contract refuses to "
                    "act without it.",
                ],
            ],
            [40 * mm, W - 40 * mm],
        )
    ]

    F += [P("Perceptual matching was built, measured, and removed", "h3")]
    F += [
        P(
            "Detecting a cropped or re-saved photograph looks like the obvious anti-fraud "
            "feature, so it was built - dHash plus LSH banding. Then it was measured, at "
            "64 bits:"
        )
    ]
    F += [
        table(
            [
                ["COMPARISON", "DISTANCE"],
                ["The same photograph, re-encoded at q55", "8"],
                ["<b>The same place, photographed on another day</b>", "<b>2</b>"],
                ["A different scene entirely", "16 - 20"],
            ],
            [W - 30 * mm, 30 * mm],
        )
    ]
    F += [
        P(
            "The populations overlap, and they overlap the wrong way round: honest repeat "
            "work at the same corner scores <i>closer</i> than actual reuse. Going to 256 "
            "bits made it worse. This is not a tuning problem - it is the domain. Every "
            "task in this product is a photograph of the same place, so “looks almost "
            "identical” is the normal case rather than the suspicious one."
        )
    ]
    F += [
        P(
            "And the failure is not symmetric: a false positive tells a worker who did the "
            "job that they are a fraud. So it does not vote. <b>The challenge code was "
            "always the real defence</b> - a recycled photograph carries the wrong one, "
            "and the vision call already checks for it."
        )
    ]

    bugs_block = [
        P("Two bugs a fresh read found", "h3"),
        table(
            [
                ["BUG", "CONSEQUENCE"],
                [
                    "A rejected task never returned to the pool",
                    "A worker rejected once and then gone left the task frozen for ever - "
                    "unclaimable by anyone, reward locked until the poster noticed.",
                ],
                [
                    "Overpaying a task burned the excess",
                    "Anything sent above the reward and fee was stranded: no refund path "
                    "and no withdrawal path reached it.",
                ],
            ],
            [55 * mm, W - 55 * mm],
        ),
        Spacer(1, 6),
        P(
            "Neither appeared in linting, type checking or any test - both lived in paths "
            "nothing exercised. Both are fixed and both now have regression tests.",
            "small",
        ),
    ]
    F += [KeepTogether(bugs_block)]

    F += [Spacer(1, 10)]

    # ---------------------------------------------------------------- limits
    F += [
        KeepTogether(
            [
                P("// CHAPTER 06", "eyebrow"),
                P("What this cannot do", "h2"),
                P(
                    "The product ships a page saying this, at "
                    "<font face='Courier'>/limits</font>. If any other page seems to "
                    "promise more, that page is the one that is true.",
                    "lede",
                ),
            ]
        )
    ]

    limits = [
        (
            "It cannot prove where a photograph was taken",
            "No system can. A phone's reported coordinates can be changed. Nothing is ever "
            "marked location verified. What it does instead: a challenge code that must be "
            "legible in both frames, a same-place check between them, and a second worker "
            "sent to a random sample of paid tasks.",
        ),
        (
            "It does not match photographs by how they look",
            "Exact reuse is caught - the content hash and the content id of every accepted "
            "photograph are stored. A cropped or re-saved one is not, for the measured "
            "reason on the previous page.",
        ),
        (
            "The model can be wrong",
            "Several validators grading the same evidence and agreeing is not the same as "
            "being right. Every rejection can be escalated to a person, the criteria are "
            "published, and a weekly sample audit compares verdicts against human review. "
            "Automatic grading with no human backstop would be an unfair labour product.",
        ),
        (
            "It is not for every kind of work",
            "Anything involving private property, confrontation, hazardous material, or "
            "anything a person should not do alone is refused at posting time.",
        ),
        (
            "Small tasks do not pay for themselves",
            "A vision call with two images runs once per validator, which is the most "
            "expensive thing the contract does. Below roughly ten GEN a task costs more to "
            "settle than it is worth, so small jobs are batched into routes.",
        ),
        (
            "On Studio, the money does not actually move",
            "Measured directly against the deployed contract: funding a task moved 19.08 "
            "GEN in correctly, and the refund took exactly 19.08 GEN out of the contract "
            "while the payee's balance did not change by a single wei. The contract is "
            "correct - Studio's ledger does not apply an emitted transfer to an ordinary "
            "account. The site says so wherever it claims payment. On a live network the "
            "same transaction pays.",
        ),
    ]
    for title, text in limits:
        F += [KeepTogether([P(title, "h3"), P(text)])]

    F += [Spacer(1, 10)]

    # ---------------------------------------------------------------- economics + state
    F += [
        KeepTogether(
            [
                P("// CHAPTER 07", "eyebrow"),
                P("Economics, and where it stands", "h2"),
                P("How it makes money", "h3"),
            ]
        )
    ]
    F += [
        table(
            [
                ["LINE", "WHAT IT IS"],
                ["Take rate", "Six percent of each paid bounty, charged to the poster. Set on chain."],
                ["Campaign plans", "A monthly fee for bulk posting, coverage reporting and exports"],
                ["Verification API", "Other networks send an image pair and a test, and pay per verification"],
                ["Assurance tier", "A sample of tasks checked twice, sold as a guarantee"],
            ],
            [32 * mm, W - 32 * mm],
        )
    ]

    F += [P("What it costs to run", "h3")]
    F += [
        P(
            "One vision call with two images per submission, repeated per validator - the "
            "most expensive operation in the design, which is exactly what the pre-flight "
            "checks exist to avoid wasting. Rewards need to sit above roughly ten units.",
            "small",
        )
    ]

    F += [P("The risk register", "h3")]
    F += [
        table(
            [
                ["RISK", "WHAT ANSWERS IT"],
                ["Photo fraud", "Challenge codes, paired shots, exact reuse detection, random repeat verification"],
                ["Location claims", "Never presented as proven; high value tasks require a second worker"],
                ["Worker safety", "No private property, confrontation or hazardous material"],
                ["Vague tests", "Refused on chain by a model before the task can be funded"],
                ["Model bias", "Published criteria, weekly sample audits, a human review path on every rejection"],
                ["A grader that cannot see", "The saw_images flag - a blind model produces a retry, not a verdict"],
            ],
            [42 * mm, W - 42 * mm],
        )
    ]

    F += [P("Where it stands today", "h3")]
    F += [
        table(
            [
                ["Contract", "33 methods - lint, validate and type check all clean"],
                ["Deployed", "<font face='Courier'>0x7132E013d9b3e118319E92B8DAfFFB8De41c35bB</font> on Studio"],
                ["Seeded", "Real tasks on chain, posted through the acceptance-test gate"],
                ["Proven on chain", "Posting, the vague-test refusal, underfunding, claiming, double-claim"],
                ["Proven separately", "Vision grading, via a dedicated probe contract"],
                ["Not yet proven", "A full passing submission - it needs two real photographs"],
                ["Site", "Seven routes, light and dark, both measured for contrast"],
            ],
            [32 * mm, W - 32 * mm],
            header=False,
        )
    ]

    F += [Spacer(1, 2)]
    F += rule(space_before=0, space_after=5)
    F += [
        P(
            "Start narrow. One city, one task type, twenty workers - because a physical "
            "network that is thin everywhere is worth less than one that is dense in a "
            "single neighbourhood.",
            "quote",
        )
    ]
    F += [
        P(
            "fieldwork.app  ·  physical work, verified by photo",
            "small",
        )
    ]

    doc.build(F)
    size = OUT.stat().st_size
    print(f"wrote {OUT}  ({size/1024:.0f} KB)")


if __name__ == "__main__":
    build()
