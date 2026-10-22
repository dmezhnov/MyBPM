#!/usr/bin/env python3
# The Python side of tools/lint-parity.bun.ts: imports skills/mybpm-imports/scripts/lint_archive.py, reads
# one case per stdin line {"jsonl", "meta"?, "source"?} (a missing key = JS undefined) and prints one line
# per case: {"out": <lint text>} or {"err": <exception>}. Not run by hand.
#   python3 tools/lint-parity-runner.py <MYBPM-IMPORTS.md>  < cases.jsonl
import json
import os
import sys

sys.dont_write_bytecode = True  # no __pycache__ inside the skill folder: skills-zip packs every file there
sys.path.insert(0,os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "skills", "mybpm-imports", "scripts"))
import lint_archive as la  # noqa: E402

sys.setrecursionlimit(20000)
doc = open(sys.argv[1], encoding="utf-8").read()
for line in sys.stdin:
    c = json.loads(line)
    try:
        res = {"out": la.lint_archive(c["jsonl"], doc, c.get("meta", la.U), c.get("source", la.U))}
    except Exception as e:  # noqa: BLE001 — any crash is a parity failure the harness reports
        res = {"err": f"{type(e).__name__}: {e}"}
    sys.stdout.write(json.dumps(res) + "\n")
    sys.stdout.flush()
