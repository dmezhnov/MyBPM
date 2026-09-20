# MyBPM platform notes

This repository is **documentation about the MyBPM low-code platform, written for an AI to act on**,
plus the `tools/` that were built while verifying it. It is not tied to any one installation: hosts and
companies appear as placeholders (`<stand>`, `<company-a>` …), and a fact's origin is marked by the date
and the platform build it was confirmed on, never by a customer name.

## Platform knowledge
Everything lives in two documents — read the relevant one before relying on a fact, and write NEW
platform facts into them (marked `[C]` confirmed / `[I]` inferred / `[U]` unverified), not into memory:

- `MYBPM-IMPORTS.md` — everything you FEED a stand, one part per artefact
  format: I the structure archive `.mybpm.zip` (BOs, fields, layout,
  dictionaries, references, access DTOs, import semantics), II Block IDE scripts
  (JSON schema, paste protocol, runtime semantics, business processes), III the
  xlsx of records (sheet format, resolution rules, merge, destructive risks).
  Three independent cookbooks: §0, §0S, §0X.
- `MYBPM-UI-API.md` — the running stand: `/web/v2` API, access rights, menus,
  the routes that deliver those artefacts (structure import §5, records §6),
  kanban, HTML sanitizer, xlsx/Drive tooling, Claude-in-Chrome traps.
  One cookbook: §0U.

Rule of thumb: **format → `MYBPM-IMPORTS.md`, transport → `MYBPM-UI-API.md`.**

`tools/` holds the generators, validators and API clients used to confirm those facts; each file says at
the top what it does and how to run it. The stand host is always passed in — none of them has a default.

## Working copy
Folders of concrete projects built on the platform may sit beside these documents in a working copy.
They are **not part of this repository** (see `.gitignore`): each has its own repository and its own
memory. Nothing project-specific — customer names, stand hosts, record data — belongs in the two
documents above.

The memory of this folder
(`~/.claude/projects/-home-dmezhnov-programming-MyBPM/memory/`) keeps only
decisions, the queue of unverified facts and project status; its index is
imported below. Project decisions and status go into the project's own memory.

@~/.claude/projects/-home-dmezhnov-programming-MyBPM/memory/MEMORY.md
