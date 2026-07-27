# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *

import hashlib


class Contract(gl.Contract):
    last_answer: str
    last_hash: str

    def __init__(self):
        self.last_answer = ""
        self.last_hash = ""

    @gl.public.write
    def describe(self, image_url: str) -> str:
        def leader_fn():
            res = gl.nondet.web.request(image_url, method="GET")
            body = res.body
            if body is None:
                raise gl.vm.UserError("image could not be fetched")
            out = gl.nondet.exec_prompt(
                "One photograph is attached. Answer only from what you can see.\n"
                'Return json: {"is_image":true|false,"subject":"max 8 words",'
                '"dominant_colour":"one word"}',
                images=[body],
                response_format="json",
            )
            return {
                "is_image": bool(out.get("is_image")),
                "subject": str(out.get("subject", ""))[:80],
                "dominant_colour": str(out.get("dominant_colour", ""))[:24],
                "content_hash": hashlib.sha256(body).hexdigest(),
            }

        def validator_fn(leader_res) -> bool:
            if not isinstance(leader_res, gl.vm.Return):
                return False
            mine = leader_fn()
            theirs = leader_res.calldata
            # Only the byte hash has to match. Two vision models will describe
            # the same photograph in different words, which is the whole reason
            # Fieldwork compares coarse booleans rather than prose.
            return mine["content_hash"] == theirs["content_hash"]

        v = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)

        self.last_hash = str(v["content_hash"])
        self.last_answer = (
            str(v["subject"]) + " | " + str(v["dominant_colour"])
        )
        return self.last_answer

    @gl.public.view
    def answer(self) -> str:
        return self.last_answer

    @gl.public.view
    def content_hash(self) -> str:
        return self.last_hash
