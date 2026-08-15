"""Tests for the contract's deterministic logic.

    python contracts/test_contract_logic.py

The helpers are extracted out of fieldwork.py by parsing the file, so this
exercises exactly the code that ships. It needs no GenVM, no chain and no
network, which matters because gltest's direct mode cannot start today (see
tests/direct/test_fieldwork.py).

Covers the parts that decide things without a model: url validation, challenge
code generation, datetime handling, and the defensive reading of LLM output.
The model-dependent paths are covered on a real chain by scripts/e2e.mjs.
"""

import hashlib
import pathlib
import re
import sys
import types

CONTRACT = pathlib.Path(__file__).with_name("fieldwork.py")


def load():
    """Pull the module-level helpers and constants out of the contract.

    Parsed with ast rather than matched with regexes, so reformatting the
    contract cannot quietly break the extraction and leave the tests passing
    against nothing.
    """
    import ast
    import urllib.parse

    src = CONTRACT.read_text(encoding="utf-8")
    tree = ast.parse(src)

    class UserError(Exception):
        pass

    env = {
        "hashlib": hashlib,
        "urllib": urllib,
        "gl": types.SimpleNamespace(vm=types.SimpleNamespace(UserError=UserError)),
        "UserError": UserError,
        # The extracted methods keep their annotations, which name GenLayer
        # types this harness never loads. They only have to resolve.
        "Task": object,
        "Address": str,
        "u256": int,
        "i64": int,
        "str_": str,
    }

    wanted_consts = {
        "CODE_ALPHABET",
        "ALLOWED_HOSTS",
        "ERROR_EXPECTED",
        "ERROR_EXTERNAL",
        "ERROR_TRANSIENT",
        "ERROR_LLM",
        "ZERO_ADDRESS",
        "CLAIM_MINUTES",
        "MIN_CLAIM_MINUTES",
        "MAX_CLAIM_MINUTES",
    }
    wanted_funcs = {"_flag", "_looks_like_image"}
    wanted_methods = {
        "_cid_of",
        "_code_from",
        "_normalise",
        "_abandoned",
        "_return_to_pool",
        "_clean_claim_minutes",
        "_clean_fixed_code",
    }

    found_consts, found_funcs, found_methods = set(), set(), set()

    for node in tree.body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id in wanted_consts:
                    try:
                        env[target.id] = ast.literal_eval(node.value)
                    except ValueError:
                        # literal_eval refuses arithmetic (MAX_CLAIM_MINUTES is
                        # 7 * 24 * 60) and calls (ZERO_ADDRESS wraps Address).
                        # Evaluate those against the same stub namespace the
                        # extracted methods run in, with no builtins available.
                        env[target.id] = eval(  # noqa: S307 - contract source, no builtins
                            compile(ast.Expression(node.value), "extract", "eval"),
                            {"__builtins__": {}, "Address": env["Address"]},
                            {},
                        )
                    found_consts.add(target.id)
        elif isinstance(node, ast.FunctionDef) and node.name in wanted_funcs:
            exec(compile(ast.Module([node], []), "extract", "exec"), env)
            found_funcs.add(node.name)
        elif isinstance(node, ast.ClassDef) and node.name == "Contract":
            for item in node.body:
                if isinstance(item, ast.FunctionDef) and item.name in wanted_methods:
                    # Drop `self` and rewrite `self.x` -> `x` so the method can
                    # be called as a plain function.
                    item.args.args = [a for a in item.args.args if a.arg != "self"]
                    code = ast.unparse(item).replace("self.", "")
                    exec(compile(code, "extract", "exec"), env)
                    found_methods.add(item.name)

    missing = (
        (wanted_consts - found_consts)
        | (wanted_funcs - found_funcs)
        | (wanted_methods - found_methods)
    )
    assert not missing, f"could not extract from the contract: {sorted(missing)}"

    return env, UserError


ENV, UserError = load()
_cid_of = ENV["_cid_of"]
_code_from = ENV["_code_from"]
_normalise = ENV["_normalise"]
_flag = ENV["_flag"]
_looks_like_image = ENV["_looks_like_image"]
_abandoned = ENV["_abandoned"]
_return_to_pool = ENV["_return_to_pool"]
_clean_claim_minutes = ENV["_clean_claim_minutes"]
_clean_fixed_code = ENV["_clean_fixed_code"]
CODE_ALPHABET = ENV["CODE_ALPHABET"]
CLAIM_MINUTES = ENV["CLAIM_MINUTES"]
MIN_CLAIM_MINUTES = ENV["MIN_CLAIM_MINUTES"]
MAX_CLAIM_MINUTES = ENV["MAX_CLAIM_MINUTES"]
ZERO_ADDRESS = ENV["ZERO_ADDRESS"]

CID = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"

failures = 0


def check(ok, label, detail=""):
    global failures
    if not ok:
        failures += 1
    print(f"  [{'ok  ' if ok else 'FAIL'}] {label}{(' - ' + str(detail)) if detail else ''}")


def refuses(fn, needle, label):
    try:
        fn()
        check(False, label, "was accepted")
    except UserError as e:
        check(needle in str(e), label, str(e)[:70])


def test_urls():
    print("photograph urls")
    check(_cid_of(f"https://ipfs.io/ipfs/{CID}") == CID, "ipfs.io path form")
    check(_cid_of(f"https://{CID}.ipfs.w3s.link/x.jpg") == CID, "subdomain form")
    check(_cid_of(f"https://dweb.link/ipfs/{CID}") == CID, "another allowed gateway")
    check(
        _cid_of(f"https://gateway.pinata.cloud/ipfs/{CID}?x=1") == CID,
        "query string is ignored",
    )

    refuses(lambda: _cid_of(f"http://ipfs.io/ipfs/{CID}"), "https", "plain http refused")
    refuses(
        lambda: _cid_of(f"https://evil.com/ipfs/{CID}"),
        "content addressed",
        "unknown host refused",
    )
    refuses(
        lambda: _cid_of("https://ipfs.io/ipfs/tooshort"),
        "usable content id",
        "short cid refused",
    )
    refuses(
        lambda: _cid_of("https://ipfs.io/notipfs/" + CID),
        "not an ipfs path",
        "wrong path refused",
    )
    # A lookalike host must not slip through on a suffix match.
    refuses(
        lambda: _cid_of(f"https://notipfs.io/ipfs/{CID}"),
        "content addressed",
        "lookalike host refused",
    )


def test_codes():
    print("\nchallenge codes")
    seen = set()
    for i in range(400):
        code = _code_from(f"{i}|0xabc|2026-08-01T10:00:0{i % 10}")
        seen.add(code)
        if len(code) != 6 or any(c not in CODE_ALPHABET for c in code):
            check(False, "code shape", code)
            return
    check(True, "400 codes are 6 chars from the safe alphabet")
    check(len(seen) > 390, f"codes are well spread ({len(seen)} distinct of 400)")

    for bad in "ILOU01":
        check(bad not in CODE_ALPHABET, f"alphabet excludes {bad!r}")

    a = _code_from("same-seed")
    b = _code_from("same-seed")
    check(a == b, "same seed gives the same code (validators recompute it)")
    check(_code_from("other-seed") != a, "different seed gives a different code")


def test_datetimes():
    print("\ndatetimes")
    check(_normalise("2026-07-27T14:03:11.884Z") == "2026-07-27T14:03:11", "trims ms and Z")
    check(_normalise("2026-07-27 14:03:11") == "2026-07-27T14:03:11", "accepts a space")
    check(
        _normalise("2026-07-27T14:03:11") < _normalise("2026-07-27T14:04:00"),
        "string order matches time order",
    )
    refuses(lambda: _normalise("2026-07-27"), "unreadable datetime", "too short refused")


class FakeTask:
    def __init__(self, status, claim_expires):
        self.status = status
        self.claim_expires = claim_expires


def test_abandoned():
    """A claim that has run out must free the task, whatever state it is in.

    The bug this guards: only `claimed` used to count, so a task that was
    rejected and then abandoned could never return to the pool - nobody could
    claim it and the reward stayed locked.
    """
    print("\nabandoned claims")
    now = "2026-08-08T12:00:00"
    past = "2026-08-08T11:00:00"
    future = "2026-08-08T13:00:00"

    check(_abandoned(FakeTask("claimed", past), now) is True, "claimed and expired")
    check(
        _abandoned(FakeTask("rejected", past), now) is True,
        "REJECTED and expired frees the task",
    )
    check(_abandoned(FakeTask("claimed", future), now) is False, "claimed, still running")
    check(
        _abandoned(FakeTask("rejected", future), now) is False,
        "rejected but still inside the window stays with the worker",
    )
    check(_abandoned(FakeTask("open", ""), now) is False, "an open task is not abandoned")
    check(_abandoned(FakeTask("paid", past), now) is False, "a paid task is never reopened")
    check(
        _abandoned(FakeTask("cancelled", past), now) is False,
        "a cancelled task is never reopened",
    )
    # An empty expiry must never read as "long ago" through string comparison.
    check(
        _abandoned(FakeTask("claimed", ""), now) is False,
        "a blank expiry is not an expired one",
    )


class FakeSettledTask:
    """A task carrying a whole finished attempt, for the release path."""

    def __init__(self):
        self.status = "rejected"
        self.claimed_by = "0xW0RKER"
        self.challenge_code = "K73QXB"
        self.claim_expires = "2026-08-08T11:00:00"
        self.reason = "the code is not legible"
        self.after_url = "https://ipfs.io/ipfs/" + CID
        self.before_url = "https://ipfs.io/ipfs/" + CID
        self.code_visible = False
        self.same_place = True
        self.test_passed = True
        self.graded_at = "2026-08-08T10:30:00"


def test_return_to_pool():
    """An abandoned task must carry nothing of the attempt that failed on it.

    The bug this guards: only the claim fields were cleared, so a task that was
    rejected and then abandoned went back into the pool still holding the
    previous worker's after photograph, their three judgements and a graded_at
    stamp. The site reads exactly those fields, so an open task advertised
    somebody else's failed evidence and a verdict on work that had nothing to do
    with it.
    """
    print("\nreturning an abandoned task to the pool")
    t = FakeSettledTask()
    _return_to_pool(t)

    check(t.status == "open", "status is open again")
    check(t.claimed_by == ZERO_ADDRESS, "the worker is cleared")
    check(t.challenge_code == "", "the code is cleared")
    check(t.claim_expires == "", "the clock is cleared")
    check(t.reason == "", "the rejection reason is cleared")
    check(t.after_url == "", "the previous worker's photograph is dropped")
    check(t.graded_at == "", "the task no longer claims to have been graded")
    check(
        t.code_visible is False and t.same_place is False and t.test_passed is False,
        "all three judgements are cleared",
    )
    # The poster's own frame belongs to the task, not to the attempt, and a
    # task without one is unwinnable.
    check(t.before_url != "", "the poster's before photograph survives")


def test_claim_windows():
    """The poster picks the window, and the contract bounds it at both ends."""
    print("\nclaim windows")
    check(_clean_claim_minutes(0) == CLAIM_MINUTES, "zero means the default")
    check(_clean_claim_minutes(30) == 30, "a chosen window is kept")
    check(
        _clean_claim_minutes(MIN_CLAIM_MINUTES) == MIN_CLAIM_MINUTES,
        "the lower bound itself is allowed",
    )
    check(
        _clean_claim_minutes(MAX_CLAIM_MINUTES) == MAX_CLAIM_MINUTES,
        "the upper bound itself is allowed",
    )
    refuses(
        lambda: _clean_claim_minutes(MIN_CLAIM_MINUTES - 1),
        "leaves no time",
        "a window nobody could reach the place in is refused",
    )
    refuses(
        lambda: _clean_claim_minutes(MAX_CLAIM_MINUTES + 1),
        "away from everyone else",
        "a window long enough to sit on a task is refused",
    )


def test_published_codes():
    """A poster-chosen code has to be one a grader could read off paper."""
    print("\npublished codes")
    check(_clean_fixed_code("") == "", "empty means the issued code")
    check(_clean_fixed_code("  ") == "", "whitespace only means the issued code")
    check(_clean_fixed_code("test42") == "TEST42", "normalised to upper case")
    refuses(
        lambda: _clean_fixed_code("ABC"),
        "exactly six",
        "a short code is refused rather than padded",
    )
    # I, L, O, U, 0 and 1 are out of the alphabet because they are misread in
    # handwriting, which is the only way this code is ever transmitted.
    for bad in ("TEST4O", "TEST4I", "TEST41", "TEST4L"):
        refuses(
            lambda bad=bad: _clean_fixed_code(bad),
            "misread by hand",
            f"{bad} is refused as ambiguous handwriting",
        )


def test_looks_like_image():
    """A 200 from a gateway is not a promise that the bytes are a photograph.

    The bug this guards: a gateway under load answers 200 with an HTML holding
    page. That body is well over the 128 byte floor, so it used to pass through
    to the vision call and come back as INVALID_IMAGE, which the worker was
    shown as "the grader could not read one of the photographs" - when storage
    had simply never sent one.
    """
    print("\nis this actually an image")
    check(_looks_like_image(b"\xff\xd8\xff\xe0" + b"\x00" * 8) is True, "JFIF jpeg")
    # The variant with no JFIF header is still a JPEG here. It is refused later,
    # in the pre-flight, with an instruction to re-save it.
    check(_looks_like_image(b"\xff\xd8\xff\xdb" + b"\x00" * 8) is True, "jpeg without JFIF")
    check(_looks_like_image(b"\x89PNG\r\n\x1a\n" + b"\x00" * 4) is True, "png")
    check(_looks_like_image(b"GIF89a" + b"\x00" * 6) is True, "gif")
    check(_looks_like_image(b"RIFF\x00\x00\x00\x00WEBP") is True, "webp")
    check(_looks_like_image(b"BM" + b"\x00" * 10) is True, "bmp")

    check(_looks_like_image(b"<!DOCTYPE html><html><h") is False, "an html error page")
    check(_looks_like_image(b'{"error":"not found"}\n') is False, "a json error body")
    check(_looks_like_image(b"<html>\n<head><title>50") is False, "a gateway 502 page")
    check(_looks_like_image(b"") is False, "nothing at all")
    # RIFF alone is not enough - a wav file starts the same way.
    check(_looks_like_image(b"RIFF\x00\x00\x00\x00WAVE") is False, "a wav is not an image")


def test_flag():
    print("\nreading a boolean out of a model")
    check(_flag({"a": True}, "a") is True, "real bool")
    check(_flag({"a": False}, "a") is False, "real bool false")
    check(_flag({"a": "true"}, "a") is True, "string true")
    check(_flag({"a": "YES"}, "a") is True, "uppercase yes")
    check(_flag({"a": "false"}, "a") is False, "string false")
    check(_flag({"a": 1}, "a") is True, "number 1")
    check(_flag({"a": 0}, "a") is False, "number 0")
    check(_flag({}, "a") is False, "missing key is false, never true")
    check(_flag({"b": True}, "a", "b") is True, "falls back to an alias")
    # A model that answers with prose must not read as agreement.
    check(_flag({"a": "maybe"}, "a") is False, "unparseable value is false")


def main():
    test_urls()
    test_codes()
    test_datetimes()
    test_abandoned()
    test_return_to_pool()
    test_claim_windows()
    test_published_codes()
    test_looks_like_image()
    test_flag()
    print("\n" + ("all contract logic checks passed" if failures == 0 else f"{failures} FAILURES"))
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
