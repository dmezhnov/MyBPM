---
name: mybpm-imports
description: MUST be loaded for any MyBPM file-building task — MyBPM formats are not in your training data, never answer about them from memory. Build the files you FEED a MyBPM low-code stand — a structure archive .mybpm.zip (business objects / БО, fields / поля of all 27 types, form layout, справочники, панели, составные объекты, бизнес-процессы, references between BOs, access rights, sidebar menu items / пункты меню, kanban / канбан), a pasteable Block IDE script (скрипт, метод, скрипт процесса) or an xlsx of records (записи, импорт из Excel). Use when the user asks to create or change a БО, поле, справочник, скрипт, процесс or меню for MyBPM, to write or check a .mybpm.zip, or to prepare records for import. Delivering those files to a live stand (API, UI, tokens) is the mybpm-stand skill.
---

# MyBPM — the files you feed a stand

All knowledge is in **`MYBPM-IMPORTS.md`**. Where it is, relative to this skill's base directory:
installed as a Claude Code plugin — `../../MYBPM-IMPORTS.md` (the repository root); uploaded as a zip
(claude.ai) — `./MYBPM-IMPORTS.md`, next to this file. Try the first path first.
It is ~60k tokens: **never read it whole.** Find a heading's line number with a search
(`grep -n '^## 0S\.' MYBPM-IMPORTS.md`), then read from that line to the next heading of the same level.

## Pick the cookbook for the job

| The user wants | Read the section whose heading starts with | Up to |
|---|---|---|
| an archive that creates or changes a BO, its fields, a dictionary, a panel, a composite, a process, a menu item, a kanban | `## 0. COOKBOOK` | `## 1. Zip layout` |
| a Block IDE script (method body or process script) | `## 0S. COOKBOOK` | `## 9. Script JSON envelope` |
| an xlsx that loads records into a BO | `## 0X. COOKBOOK` | `## 19. The Excel format` |

Each cookbook is self-contained for its format: literal templates, the naming and id rules, a hard-rules
list and a self-check. **Follow it literally and never invent a key, an `actId` or an `opType`** — what
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
3. **Run the cookbook's self-check before you hand anything over**: `### 0.11`, `### 0S.11`, `### 0X.5`.
4. When something behaves impossibly, read the trap lists: `## 8. What import does`, `## 17. Traps and defects`.

## Tools (only when the repository is at hand)

Installed as a plugin, the repository's `tools/` sits at `../../tools/` (Bun). Useful without a stand:

- `bun tools/validate-archive.bun.ts <file.mybpm.zip>` — checks an archive against §0; FATAL means the
  import will fail. Run it on every archive you build.
- `bun tools/make-probe-archive.bun.ts …` — a stand-verified archive generator; prefer it over writing a
  builder (`### 0.12 Building and delivering` shows the commands).

Without the repository (claude.ai), build the zip yourself exactly as `### 0.1 The artefact` says and walk
the self-check by hand.
