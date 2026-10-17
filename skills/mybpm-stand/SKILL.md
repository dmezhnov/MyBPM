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

## Is this copy the latest? — once per conversation, first

This copy of the skill is version **1.5.18**. Before the first answer of a conversation:

- the `mybpm-stand` MCP tools connected → nothing to fetch: the server compares itself with the latest
  release, and its first answer (and every `stand_list`) carries a «NOTE for Claude» when a newer one is
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
- Claude Code: `claude plugin marketplace update mybpm`, `claude plugin update mybpm@mybpm`, restart.
- installed with Upload plugin: upload `https://github.com/dmezhnov/MyBPM/releases/latest/download/mybpm-plugin.zip` again.
- this skill uploaded alone: upload `https://github.com/dmezhnov/MyBPM/releases/latest/download/mybpm-stand.zip` again.

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
| a whole system from a spec (CRM by a concept, objects + menu + rights + scripts) | `#### R10 ` |

Then `### 0U.5 Hard rules` and `### 0U.6 Self-check before you say it worked` — both are short, read them
every time. `### 0U.7 Where the rest is` maps the numbered sections behind the cookbook.

## The mybpm-stand MCP server

This plugin also starts an MCP server, `mybpm-stand` (Claude Code and Claude Desktop start it from the plugin).
**Its tools connected (`stand_list`, `import_analyze` …) → use them instead of hand-made calls** for
what they cover, and read `### 0U.8 The mybpm-stand MCP server` first: which tool makes which recipe, that
it holds the stand accounts (do not ask for a password or a token — `stand_list` names every account with its stand and company;
a new account or an expired session → `stand_accounts`, give the user the link to the page where they log in — open their browser
only when they ask; all accounts are equal — several and the user has not
said which → ask, then pass `stand` (name or host) on every call),
that the ✎ tools write and need the user's OK, and how an archive built in a cloud sandbox gets in
(`archive_put`). BOs and composites in the constructor: `bo_create`, `bo_fields_save`, `bo_code_set`, `bo_delete`, `co_build`.
Rights (BO, field, tab, menu item): `rights_read`, `rights_save` (exact subjects, «выборочно» follows).
Records: `records_find`, `record_read`, `record_save` (hooks run unless `scripts: false`), `record_delete`.
Records xlsx: `xlsx_template`, `xlsx_import` (the act first, nothing written until `confirm`; no hook runs), `xlsx_export`.
Scripts: `scripts_read`, `script_write` (guarded, put back when it does not translate), `scripts_wire`, `script_version`.
Processes: `process_read`, `process_edit`, `process_version`, `process_run_ways`, `process_steps`, `process_push`.
For the rest the tools do not cover, `stand_call` sends any method in the envelope of the recipe.

## The stand does otherwise than the document says

On the latest release only (the version check above shows no newer one): search the open reports, then — with
the user's OK, the repository is public — prepare ONE de-identified GitHub issue per fact (placeholders for every host,
company, login and person, no record data). The rule and the prefilled issue URL are in the paragraph
«The stand does something else than this document says» at the top of `MYBPM-UI-API.md`; the MCP server connected →
`platform_report` builds the URL and the user presses «Submit new issue».

**Not connected (no `stand_*` tool among yours) and the task touches a stand → tell the user in your first
reply and give them the install steps — you cannot install it yourself** (the app's own Install dialog, which
the user confirms; in a Desktop or claude.ai chat your code runs in a cloud sandbox). The steps per app are the
first bullet of `### 0U.8 The mybpm-stand MCP server`: Claude Desktop (Chat, Cowork) — Customize → Plugins →
«+ Add» → Add marketplace `dmezhnov/MyBPM` (adds only the catalogue), then Plugins → Discover → «+» on Mybpm →
Continue, then a new chat (or Upload plugin with
`https://github.com/dmezhnov/MyBPM/releases/latest/download/mybpm-plugin.zip` — a fixed version); the account
plugin does not update itself — to a newer release: Customize → Plugins → Yours → Mybpm in the plugin list → ⋯ → Check for updates → the «Update» button becomes active → press it, then restart Desktop for the tools;
Claude Code (also the Desktop Code tab) — `claude plugin marketplace add dmezhnov/MyBPM`,
`claude plugin install mybpm@mybpm`, restart. Meanwhile the recipes of the document as written, where your code
reaches the stand.

## Rules that hold for every task

1. **Ask for the stand URL, the company and the credentials — never assume them** (MCP connected: it holds
   them — confirm with `stand_list` instead, and ask which account when it holds several; a stand it has no account for → `stand_accounts`). The document uses
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
