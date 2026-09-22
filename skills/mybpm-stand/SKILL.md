---
name: mybpm-stand
description: MUST be loaded for any task on a MyBPM stand — its API and UI are not in your training data, never answer about them from memory. Drive a RUNNING MyBPM low-code stand through its /web/v2 REST API or browser UI — log in or take the token, create a business object / БО of any kind in the constructor, import a structure archive .mybpm.zip (analyze, apply, rollback), export structure, grant access rights / права, build the sidebar menu / меню, set up a kanban / канбан, import or export records from Excel, and work around the stand's known defects (Elasticsearch sort in a new BO's registry, HTML sanitizer, browser-automation traps). Use when the user asks to do something ON a MyBPM stand or asks why the stand behaves oddly. Building the files themselves (archive, script, xlsx) is the mybpm-imports skill.
---

# MyBPM — driving a running stand

All knowledge is in **`MYBPM-UI-API.md`**. Look for it next to this file (`./MYBPM-UI-API.md`); in a checkout of the
MyBPM repository it sits at the repository root instead (`../../MYBPM-UI-API.md`, relative to this skill's
folder). It is ~60k tokens: **never read it whole.** Locate the heading you need and read only from
that line to the next heading of the same level — with a shell, `grep -n '^#### R3 ' MYBPM-UI-API.md` gives the line;
without one, search the file for the heading text.

## Start here

**Open the document before your first reply** — even the questions you must ask the user are listed
there, and an answer from general knowledge is wrong for this platform.

Read `## 0U. COOKBOOK` down to `### 0U.4 Recipes` first — before the first call. It says what to ask the
user for (`### 0U.1 What you must have before the first call`: stand URL, company, authentication) and
what a success and an error look like (`### 0U.2 One complete call`). Then read only the recipe you need:

| Task | Heading starts with |
|---|---|
| create a BO with fields in the constructor | `#### R1 ` |
| a dictionary, panel, composite object or business process | `#### R2 ` |
| import a structure archive | `#### R3 ` |
| read anything back (verification) | `#### R4 ` |
| export a BO's structure or menu items | `#### R4a ` |
| access rights on a BO | `#### R5 ` |
| a sidebar menu item and a record filter | `#### R6 ` |
| records from Excel | `#### R7 ` |
| export the structure of a company | `#### R8 ` |

Then `### 0U.5 Hard rules` and `### 0U.6 Self-check before you say it worked` — both are short, read them
every time. `### 0U.7 Where the rest is` maps the numbered sections behind the cookbook.

## Rules that hold for every task

1. **Ask for the stand URL, the company and the credentials — never assume them.** The document uses
   placeholders (`<stand>`, `<company-a>` …); ids and codes in its examples belong to other stands.
2. **HTTP 200 proves nothing.** Detect errors by `errorType` in the body, and read every write back.
3. **Writes are immediate and have no undo but deletion** (`create-bo`, `apply-import`, `v2/co/add-*`).
   Confirm with the user before any write to a stand they did not call a sandbox.
4. When the stand behaves impossibly, read `## 11. Traps and defects` before guessing; before driving the UI
   through a browser-automation tool read `## 10. Claude-in-Chrome traps` first (they apply to any such tool).
5. `[C]` confirmed, `[I]` inferred, `[U]` unverified — say so when you rely on `[I]`/`[U]`.

## Tools (only when the repository is at hand)

With a checkout of the MyBPM repository, its `tools/` sits at `../../tools/` (run with Bun). Every tool takes the stand
host as `--stand` and has no default; each file's header says how to run it. The main ones:
`api-import-structure.bun.ts` (the whole import cycle; dry run unless `--apply`),
`create-bo-constructor.bun.ts`, `create-co-constructor.bun.ts`, `create-process-constructor.bun.ts`.
Everything is also doable with plain HTTP — the cookbook's payloads are literal.
