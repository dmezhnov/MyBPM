# MyBPM workspace

Umbrella folder for work on the MyBPM low-code platform. Each subfolder is one
project built on it:

- `<company-c>/` — the <company-c> test task (stand <stand>).
- `<project>/` — the credit-scoring models and formula engine in Block IDE
  (stand tenant <company-b>).

## Platform knowledge
General platform facts live in two documents in this folder — read the relevant
one before relying on a fact, and write NEW platform facts into them (marked
`[C]` confirmed / `[I]` inferred / `[U]` unverified), not into memory:

- `MYBPM-IMPORTS.md` — everything you FEED a stand, one part per artefact
  format: I the structure archive `.mybpm.zip` (BOs, fields, layout,
  dictionaries, references, access DTOs, import semantics), II Block IDE scripts
  (JSON schema, paste protocol, runtime semantics, business processes), III the
  xlsx of records (sheet format, resolution rules, merge, destructive risks).
  Three independent cookbooks: §0, §0S, §0X.
- `MYBPM-UI-API.md` — the running stand: `/web/v2` API, access rights, menus,
  the routes that deliver those artefacts (structure import §5, records §6),
  kanban, HTML sanitizer, xlsx/Drive tooling, Claude-in-Chrome traps.

Rule of thumb: **format → `MYBPM-IMPORTS.md`, transport → `MYBPM-UI-API.md`.**

The memory of this umbrella folder
(`~/.claude/projects/-home-dmezhnov-programming-MyBPM/memory/`) now keeps only
decisions, the queue of unverified facts and project status; its index is
imported below. Project decisions and status go into the project's own memory.

@~/.claude/projects/-home-dmezhnov-programming-MyBPM/memory/MEMORY.md
