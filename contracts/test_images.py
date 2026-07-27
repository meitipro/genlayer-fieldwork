"""Tests for the contract's image handling.

Run with:  python contracts/test_images.py

`_preflight`, `_dhash` and `_BytesFile` are extracted out of fieldwork.py by
parsing the file, so this exercises exactly the code that ships rather than a
copy that can drift away from it.

Requires Pillow locally. The GenVM runtime has Pillow too — the SDK's own
`gl.nondet.web.render(mode="screenshot")` imports it.
"""

import io
import pathlib
import random
import re
import sys

import PIL.Image
import PIL.ImageDraw
import PIL.ImageFilter

CONTRACT = pathlib.Path(__file__).with_name("fieldwork.py")


def load_from_contract():
    src = CONTRACT.read_text(encoding="utf-8")
    env = {}
    for name in ("MIN_EDGE", "DARK_MEAN", "BRIGHT_MEAN"):
        m = re.search(rf"^{name}\s*=\s*(\d+)", src, re.M)
        assert m, f"{name} not found in the contract"
        env[name] = int(m.group(1))

    parts = []
    m = re.search(r"^class _BytesFile:.*?(?=\n(?:def |class )|\Z)", src, re.M | re.S)
    assert m, "_BytesFile not found"
    parts.append(m.group(0))
    for func in ("_preflight", "_dhash"):
        m = re.search(rf"^def {func}\(.*?(?=\n(?:def |class )|\Z)", src, re.M | re.S)
        assert m, f"{func} not found"
        parts.append(m.group(0))

    exec(compile("\n\n".join(parts), "fieldwork_extract", "exec"), env)
    return env


ENV = load_from_contract()
_preflight = ENV["_preflight"]
_dhash = ENV["_dhash"]
MIN_EDGE, DARK_MEAN, BRIGHT_MEAN = ENV["MIN_EDGE"], ENV["DARK_MEAN"], ENV["BRIGHT_MEAN"]


def photo(w=1200, h=900, seed=3):
    """A plausible outdoor photograph: mid tones, texture, soft edges."""
    rng = random.Random(seed)
    img = PIL.Image.new("RGB", (w, h), (150, 145, 132))
    d = PIL.ImageDraw.Draw(img)
    d.rectangle([0, h // 2, w, h], fill=(120, 115, 104))
    d.rectangle([int(w * 0.62), int(h * 0.28), int(w * 0.77), int(h * 0.55)], fill=(47, 93, 58))
    px = img.load()
    for _ in range(w * h // 12):
        x, y = rng.randrange(w), rng.randrange(h)
        r, g, b = px[x, y]
        n = rng.randint(-26, 26)
        px[x, y] = (max(0, min(255, r + n)), max(0, min(255, g + n)), max(0, min(255, b + n)))
    return img.filter(PIL.ImageFilter.GaussianBlur(0.5))


def enc(img, fmt="JPEG", q=92):
    b = io.BytesIO()
    img.save(b, format=fmt, quality=q)
    return b.getvalue()


def scale(img, factor):
    return img.point(lambda v: max(0, min(255, int(v * factor))))


def test_preflight():
    cases = [
        ("normal daylight photo", enc(photo()), False, ""),
        ("normal, PNG", enc(photo(), fmt="PNG"), False, ""),
        ("large 4000px photo", enc(photo(4000, 3000)), False, ""),
        ("exactly at MIN_EDGE", enc(photo(MIN_EDGE, 360)), False, ""),
        ("dusk, still gradeable", enc(scale(photo(), 0.30)), False, ""),
        ("bright day, still gradeable", enc(scale(photo(), 1.55)), False, ""),
        ("thumbnail 320px", enc(photo(320, 240)), True, "too small"),
        ("lens cap", enc(PIL.Image.new("RGB", (1200, 900), (3, 3, 3))), True, "too dark"),
        ("very underexposed", enc(scale(photo(), 0.05)), True, "too dark"),
        ("sun into lens", enc(PIL.Image.new("RGB", (1200, 900), (252, 252, 250))), True, "washed out"),
        ("blown highlights", enc(scale(photo(), 2.4)), True, "washed out"),
        ("a PDF, not an image", b"%PDF-1.7\n1 0 obj\n<<>>\nendobj\n", True, "could not be opened"),
        ("empty upload", b"", True, "could not be opened"),
        ("truncated jpeg", enc(photo())[:40], True, "could not be opened"),
    ]
    bad = 0
    for label, data, should_refuse, expect in cases:
        got = _preflight(data, "after")
        ok = (got != "") == should_refuse and (expect in got if expect else True)
        bad += 0 if ok else 1
        print(f"  [{'ok  ' if ok else 'FAIL'}] {label:<28} {got[:52] or 'accepted'}")

    msg = _preflight(enc(photo(64, 48)), "before")
    ok = "before" in msg
    bad += 0 if ok else 1
    print(f"  [{'ok  ' if ok else 'FAIL'}] refusal names which photograph")
    return bad


def test_determinism():
    """Validators recompute both of these, so identical bytes must agree."""
    a = enc(photo())
    bad = 0
    for name, fn in (("preflight", _preflight), ("dhash", _dhash)):
        left = fn(a, "after") if name == "preflight" else fn(a)
        right = fn(bytes(a), "after") if name == "preflight" else fn(bytes(a))
        ok = left == right
        bad += 0 if ok else 1
        print(f"  [{'ok  ' if ok else 'FAIL'}] {name} is deterministic on identical bytes")
    return bad


def test_phash_is_not_a_fraud_signal():
    """The measurement behind the decision not to match perceptually.

    If this ever starts passing cleanly, perceptual reuse detection becomes
    worth revisiting. Today it does not: the same place on another day scores
    closer than the same photograph re-encoded.
    """
    after = photo(seed=1)
    same_reencoded = _dhash(enc(after, q=45))
    base = _dhash(enc(after))
    other_day = _dhash(enc(scale(photo(seed=1), 1.06)))

    def dist(x, y):
        return bin(int(x, 16) ^ int(y, 16)).count("1")

    d_same = dist(base, same_reencoded)
    d_other = dist(base, other_day)
    print(f"  same photograph, re-encoded      distance {d_same}")
    print(f"  same place, another day          distance {d_other}")
    overlapping = d_other <= d_same
    print(
        f"  [{'ok  ' if overlapping else 'note'}] populations overlap "
        f"({d_other} <= {d_same}), so no threshold separates them"
    )
    return 0


def main():
    bad = 0
    print("preflight")
    bad += test_preflight()
    print("\ndeterminism")
    bad += test_determinism()
    print("\nwhy there is no perceptual reuse check")
    bad += test_phash_is_not_a_fraud_signal()
    print("\n" + ("all image checks passed" if bad == 0 else f"{bad} FAILURES"))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
