---
name: mybpm-imports
description: MUST be loaded for any MyBPM file-building task — MyBPM formats are not in your training data, never answer about them from memory. Build the files you FEED a MyBPM low-code stand — a structure archive .mybpm.zip (business objects / БО, fields / поля of all 27 types, form layout, справочники, панели, составные объекты, бизнес-процессы, references between BOs, access rights, sidebar menu items / пункты меню, kanban / канбан), a pasteable Block IDE script (скрипт, метод, скрипт процесса) or an xlsx of records (записи, импорт из Excel). Use when the user asks to create or change a БО, поле, справочник, скрипт, процесс or меню for MyBPM, to write, check or explain a .mybpm.zip (what a business process in an export does), or to prepare records for import. Delivering those files to a live stand (API, UI, tokens) is the mybpm-stand skill.
---

# MyBPM — the files you feed a stand

All knowledge is in **`MYBPM-IMPORTS.md`**. Look for it next to this file (`./MYBPM-IMPORTS.md`); in a checkout of the
MyBPM repository it sits at the repository root instead (`../../MYBPM-IMPORTS.md`, relative to this skill's
folder). It is ~60k tokens: **never read it whole.** Locate the heading you need and read only from
that line to the next heading of the same level — with a shell, `grep -n '^## 0S\.' MYBPM-IMPORTS.md` gives the line;
without one, search the file for the heading text.

**Nothing in this skill has to run for you to do the task.** The archive, the script JSON and the xlsx are
text and zip you write yourself; `scripts/lint-archive.js` only speeds up one check. Your chat cannot run it
(no code execution, or no JavaScript) → still build the file: port the lint to the language you have, or
report «form lint: NOT RUN» with the reason, and hand the file over. Never answer with a description to
rebuild by hand in the constructor instead of the file.

## Is this copy the latest? — once per conversation, first

This copy of the skill is version **1.5.33**. Before the first answer of a conversation:

- the `mybpm-stand` MCP tools connected → nothing to fetch: the server compares itself with the latest
  release, and its first answer (and every `stand_list`) carries a «NOTE for the assistant» when a newer one is
  out — pass it on with the update steps it names.
- not connected, and you can fetch a URL (a web fetch tool, or a shell with network) → read
  `https://raw.githubusercontent.com/dmezhnov/MyBPM/main/.claude-plugin/plugin.json`; its `version` higher
  than this copy's → tell the user before the task, with the update steps of their install below.
- the URL out of reach → go on silently. Never hold the task back for this check.

Show it as a warning block at the very top of your reply, in the user's language, then the answer:

    > ⚠️ **A new version of the MyBPM plugin is out: <new>** (you have <old>).
    > To update: <the steps of their install>.

Update steps by how it was installed (unsure → give the user the first two):

- Claude Desktop / claude.ai, plugin from the marketplace (it does not update by itself): Customize → Plugins → Yours → Mybpm in the plugin list → ⋯ → Check for updates → the «Update» button becomes active → press it — the skills are new at once; restart Desktop so the server's tools run the new code too.
- Claude Code in a terminal or an IDE: `claude plugin marketplace update mybpm`, `claude plugin update mybpm@mybpm`, restart Claude Code.
- Claude Desktop in Code mode (it uses the same plugins of the computer): run those two commands in any terminal, then quit Desktop fully and start it again — word the steps for Desktop, not for Claude Code.
- installed with Upload plugin: upload `https://github.com/dmezhnov/MyBPM/releases/latest/download/mybpm-plugin.zip` again.
- this skill uploaded alone: upload `https://github.com/dmezhnov/MyBPM/releases/latest/download/mybpm-imports.zip` again.
- the server in another MCP client (Codex, ChatGPT through a tunnel, Cursor, VS Code …): a checkout → `git pull`; unzipped from `mybpm-stand.mcpb` → download it again and unzip over the same folder; then restart that client.

## Pick the cookbook for the job

**Open the document before your first reply** — even the questions you must ask the user are listed
there, and an answer from general knowledge is wrong for this platform.

| The user wants | Read the section whose heading starts with | Up to |
|---|---|---|
| an archive that creates or changes a BO, its fields, a dictionary, a panel, a composite, a process, a menu item, a kanban | `## 0. COOKBOOK` | `## 1. Zip layout` |
| a whole SYSTEM from a spec (CRM by a concept, several objects, a work path, automations, roles) | `### 0.2b A whole system from a spec`, then the rest of `## 0. COOKBOOK` | `## 1. Zip layout` |
| a Block IDE script (method body or process script) | `## 0S. COOKBOOK` | `## 9. Script JSON envelope` |
| an xlsx that loads records into a BO | `## 0X. COOKBOOK` | `## 19. The Excel format` |
| to explain what an existing process in an export does | `## 5c. Business processes` | `## 5d. Scripts inside the archive` |

Each cookbook is self-contained for its format: literal templates, the naming and id rules, a hard-rules
list and a self-check. The archive cookbook is long: read its core (`### 0.1` … `### 0.11`) in parts,
then only the optional blocks 0.12–0.18 its «How to read it» list names for your task. **Follow it literally and never invent a key, an `actId` or an `opType`, nor move a key out of the place `### 0.4b Where each key sits` gives it** — what
the cookbook does not show does not belong in the file. Go into the numbered sections (§1–§20) only when
the cookbook sends you there or the case is exotic.

## Rules that hold for all three

1. **Ask first, build second.** Every cookbook opens with the stand data only the user has — the BO
   group name, BO codes already taken, ids of referenced objects (`### 0.2a`); the empty-method copy and
   field codes for a script (`### 0S.2`); the stand's own template for records (`### 0X.3`). Ask, one
   request at a time, and wait. Ids and codes in the document's examples belong to other stands — never
   copy them.
2. **Status markers matter.** `[C]` is confirmed on a stand, `[I]` inferred, `[U]` unverified — do not
   build on `[U]` without telling the user.
3. **Run the cookbook's self-check before you hand anything over**: `### 0.10`, `### 0S.11`, `### 0X.5`.
   For an archive, the form lint of 0.10 ships ready to run with this skill — see «The form lint» below.
4. When something behaves impossibly, read the trap lists: `## 8. What import does`, `## 17. Traps and defects`.

## The form lint (ships with this skill)

`scripts/lint-archive.js` in this skill's folder IS the `lintArchive` function of `### 0.10` with a
command line around it — do not copy the function out of the document, run the file:

    node scripts/lint-archive.js <file.mybpm.zip>        # or: bun scripts/lint-archive.js …
    node scripts/lint-archive.js <file.mybpm.zip> --source <the export it amends>

It finds `MYBPM-IMPORTS.md` itself (pass its path as a second argument if it does not), prints the lint
output and exits 1 while a defect line is left. `--source` only on an amendment of a given export: what
the export carries unchanged becomes one `REMINDER`, not defects. Paste that output into the report and follow 0.10 for it:
fix every defect line and rerun, answer every `REMINDER` by name, and still walk the prose checks of 0.10.
No Node or Bun in your sandbox → «How to run it» in `### 0.10` (any JavaScript engine, or a port to the
language you build in, e.g. Python); you cannot run code at all → walk 0.10 by hand and report the lint as
NOT RUN. Either way the archive is still built and handed over (`### 0.11 Building the zip`).

## Handing an archive to the stand MCP

The `mybpm-stand` MCP server connected (tools `archive_put`, `import_analyze` …) and your code runs where
the user's disk is not (a web or desktop chat — claude.ai, Claude Desktop, ChatGPT): **do not zip the archive in your sandbox** —
the server cannot read it there. Send the JSONL lines of `0000001.mybpm` (`### 0.1 The artefact`) to
`archive_put` in parts of up to ~100 KB (`part: 1, 2 …`, `last: true` on the final one): the server zips
them on the user's machine and runs this same lint; then `import_analyze` with the same `name`. With a
local disk (Claude Code, Codex) write the zip as usual and pass its `path`. A Block IDE script goes onto a stand by
`script_write` (a hook, field script, method or process figure), a process diagram by `process_edit`. Delivering it is the mybpm-stand
skill — not connected and the user wants the archive on a stand: its skill says how the user installs the
server.

## The stand does otherwise than the document says

On the latest release only (the version check above shows no newer one): search the open reports, then — with
the user's OK, the repository is public — prepare ONE de-identified GitHub issue per fact (placeholders for every host,
company, login and person, no record data). The rule and the prefilled issue URL are in the paragraph
«The stand does something else than this document says» at the top of `MYBPM-IMPORTS.md`; the MCP server connected →
`platform_report` builds the URL and the user presses «Submit new issue».

## Tools (only when the repository is at hand)

With a checkout of the MyBPM repository, its `tools/` sits at `../../tools/` (run with Bun). Useful without a stand:

- `bun tools/validate-archive.bun.ts <file.mybpm.zip> [--source <export>]` — the 0.10 form lint graded
  FATAL / ERROR / WARN (= REMINDER); FATAL means the import will fail. Run it on every archive you build.
- `bun tools/make-probe-archive.bun.ts …` — a stand-verified archive generator; prefer it over writing a
  builder (`### 0.11 Building the zip` shows the commands).

Without the repository, build the zip yourself exactly as `### 0.1 The artefact` says and walk
the self-check by hand.
