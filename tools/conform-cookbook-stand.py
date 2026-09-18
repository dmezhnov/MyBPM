#!/usr/bin/env python3
"""Conformance check for §0U of MYBPM-UI-API.md: every endpoint name and every payload key the cookbook
mentions must occur literally in the stand's own client bundle — nothing invented.

Download the bundle first (§0U.3): fetch `runtime.<hash>.js`, parse its chunk map, fetch every chunk into
`chunks/`, then run this from that directory.
"""
import re, glob, sys
doc = open("/home/dmezhnov/programming/MyBPM/MYBPM-UI-API.md", encoding="utf-8").read()
# §0U only
start = doc.index("## 0U. COOKBOOK"); end = doc.index("## 1. Request conventions")
sec = doc[start:end]

blob = "".join(open(f, encoding="utf-8", errors="replace").read() for f in glob.glob("chunks/*.js"))

# endpoint method names: `<name>` tokens that look like kebab-case api methods, plus /web/... paths
names = set()
for m in re.finditer(r'`([a-z0-9]+(?:-[a-z0-9]+){1,})`', sec):
    names.add(m.group(1))
for m in re.finditer(r'/web/(v2/[a-z0-9\-/]+|[a-z\-]+/[a-z0-9\-/]+)', sec):
    names.add(m.group(1).split("/")[-1])
# keys used in payloads
keys = set(re.findall(r'"([a-zA-Z_][a-zA-Z0-9_]{2,})"\s*:', sec))

skip_names = {"mybpm-zip","claude-in-chrome","load-state-short"}  # handled separately
bad = []
for n in sorted(names):
    if n in skip_names: continue
    if '"/%s"' % n in blob or '"/'+n in blob or n in blob: continue
    bad.append(n)
print("endpoint-ish tokens in §0U:", len(names), "| not found in bundle:", bad)

badk = [k for k in sorted(keys) if k not in blob]
print("payload keys:", len(keys), "| not found in bundle:", badk)
