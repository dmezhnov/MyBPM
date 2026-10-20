# MyBPM — what you feed a stand: archives, scripts, records

**STOP — read before you write a single line.** This file is about 6000 lines and the user's spec may be
several pages. A file built after reading the first few hundred lines is filled in from memory, and memory
gets the names wrong: the importer then rejects the file or silently drops what it does not know.

1. **Read the user's spec in full** — every page, every table. An object or field you did not read is a
   missing row of the build. A PDF read by page ranges: keep calling until the last page — «pages 1–5» of
   a 7-page file is not the spec. **Already opened the spec together with this file, before you saw this
   line?** Then you stopped at the range you guessed: call the reader again for the NEXT pages (e.g. «6–20»)
   until it returns nothing new — the last sections (work path, automations, reports, roles) are the ones lost.
2. **Read the whole core of your cookbook BEFORE building anything — and before asking anything**: an
   archive → the first ~1300 lines, from the top down to and including «0.11 Building the zip» — every
   template a typical system needs (BO, fields, links between BOs, dictionaries, kanban, menu), then ids,
   layout, hard rules, self-check, all inside that range; a script → §0S down to and including «0S.12
   Delivering the file»; records → §0X down to and including «0X.6 Handing the file over». **If you read
   in chunks (a `limit` of a few hundred lines), ONE chunk is never enough: call the reader again with `offset` = the line after the last one you got, and again, until the
   closing heading has scrolled past** — for an archive three calls of 500 lines. The 0.2a questions come
   out of that reading too — asking them after the first chunk is building from memory.
3. **Copy, never compose.** Every `@class`, every key and every `type` value in your file is printed in
   this document — find it there and copy it. A name that merely looks right is invented.
4. **An archive for a whole system (a CRM, a spec of several objects) is not done without EVERY item
   below.** Each has its template in the core; the ones past line ~600 are the ones a single read misses —
   jump to them by heading (with a shell: `grep -n '^### 0\.' MYBPM-IMPORTS.md` prints the line of each).
   - [ ] the group line and one BO line per object — 0.3, 0.4, 0.5;
   - [ ] every header–lines / parent–child link as a `SINGLE`↔`TABLE` pair, a line BO separate from the
     catalogue it points at — **0.5a**, 0.2c;
   - [ ] a `BO_DICTIONARY` line per open reference list; statuses and short fixed lists as LOCAL dropdowns — **0.5b**, 0.2c;
   - [ ] one kanban card template per `DROPDOWN_SINGLE` of a BO — **0.5c**;
   - [ ] the sidebar menu: a `GROUP` per theme + one item per user JOB (0.2c step 9), kanban on the status dropdown, every line
     with an icon BY ITS OWN MEANING — each group by its theme, each dictionary by what it lists, no two
     `GROUP` lines and no three siblings with one icon, never the generic default — **0.5d**, 0.2b step 4;
   - [ ] ids: what the given archive (or your own earlier archive of this chat) already holds keeps its ids and
     codes; everything new is hashed from a seed per object kind + this build's salt, distinct across the file — **0.7**;
   - [ ] the layout (tabs over 12 fields, `y` chain, window size) — **0.8a**;
   - [ ] the hard rules and the self-check, then the zip and the report — **0.9, 0.10, 0.11**.
5. **The defects a build most often ships while the text says otherwise** — check each one in your file:
   - a `BO` `SINGLE` is **3 rows** and may share a row — never 6 rows, never alone at full width (0.5a, 0.8);
   - short fields go 2–3 per row by meaning; a short field left alone is **`x 0, cols 8`**, never cols 15, and at most 2 such per form — every field alone at cols 8 is still «one per row»; a build script takes the rows as lists of field codes, never one field per row (0.8);
   - over 12 visible fields → tabs (also on a `TAB` record), over 8 → tabs or group headings; the registry shows the name + at most 5 key values, never every field (0.8a, 0.5);
   - **every** `TEXTAREA` / `TEXTAREA_LANG` has `params.buttonTypes` chosen by meaning, `"[]"` for a comment (0.5);
   - a photo field is `params.viewType: "TILE"` (0.19); a dictionary's «Код» and «Значение» are both `x 0, cols 15` (0.5b);
   - a tab holds at least 2 fields and is named by ITS content — never the same «Общее / Технические данные / Финансы»
     copied onto every BO (0.8a step 3);
   - every computed value / total of the spec is a hook script and every approval path a process, **built in
     the same archive** — or its own «not built» row with a reason from the closed list of 0.2b step 5, never a
     blanket «это пока структурная основа» (0.2b step 6, 0.2c step 7, 0.18);
   - each Route cell of the coverage table is copied literally: no «где это поддерживается форматом», no
     «настройка на стенде», no «требует серверной логики» (0.2b);
   - **the reply ends with the coverage table printed again**, each row marked «сделано» or «не сделано» + its
     reason; an item not built (a numbering, a computed value, a reminder) is a row of its own — never folded
     into a row marked «сделано», never only in a paragraph of limitations (0.2b step 6);
   - **run the form lint of 0.10 (a plain JavaScript function; no JavaScript engine → port it to your
     language) and paste its output** — a reply without that output is unfinished; the report names the build salt and the list of checks
     run (0.10 «The report»). **A file the lint still flags is not handed over** — fix and rerun until only
     answered `REMINDER` lines are left; «архив сформирован, но требует исправления», «не рекомендую считать
     завершённой» is no reply. Cannot fix a line → no file: name the line and what blocks it.

What a model invents when it skips the reading, by class of mistake. Each class holds for ANY spec — the
examples are only examples; each broken row breaks the import or is silently dropped. A script has its own
table at the top of §0S, records at the top of §0X.

| Class | Invented | Real | Where |
|---|---|---|---|
| Names | any `@class`, key, `type` or enum not printed here: `TEXT_AREA`, `NUMBER`, `DATETIME`, `SidebarMenuItemStructDto`, `menuItemType: "BO_REGISTRY"`, a parent menu by id | copied from a template: `TEXTAREA`, `INPUT_NUMBER`, `FULL_DATE`, `MenuItemStructDto` + `menuItemType: "BO"` + `parentMenuItemCode` | 0.5, 0.5d |
| Field type | a number, sum or date typed as a dropdown; a link to another object typed as text | the type of the VALUE (`INPUT_NUMBER`, `DATE` …); another object = a `BO` field | 0.5, 0.5a |
| Ids | random ids (even from a seeded generator); any length but 16; one seed for two objects (a field seed from the field code alone gives every BO's `status` the same id); a fresh salt or a renamed code for an object that is being AMENDED (a duplicate field, the old one stays); the salt of an earlier build for a build from scratch (the stand revives the old deleted BO with its old fields) | 16 chars over `A-Za-z0-9@~`, hashed from a seed per object kind + the build salt (field = salt + BO code + field code), distinct across the whole file; an amendment keeps every existing id and code | 0.7 |
| References | a `BO` field with `fieldRefs: {}`, no `boInfo`, no `oldRefBoId`; a `linkedFieldCode` naming a field the other BO lacks; header and lines with no back link | `oldRefBoId` + `boInfo` + at least one `toShow: true`; header–lines and child documents = a `SINGLE`↔`TABLE` pair naming each other | 0.5a |
| Stand data | a reference left out «because it needs a stand id»; a `Person` field dropped or asked for `personBoId` | a reference between the BOs of your own file uses the id you minted; a `Person` reference is resolved by `boInfo.code` (`oldRefBoId: ""`) — build both | 0.2c step 8, 0.5a, §6 «Person reference» |
| Lists and kanban | dropdown options as an array; a dropdown with no options; `kanbanCardTemplates: {}` beside a dropdown; a template keyed by a text or `BO` field | `fieldOptionsStruct.options` = a map, at least one option; one template per `DROPDOWN_SINGLE`, `{}` when the BO has none; a BO with a `status` opens its kanban by it | 0.5, 0.5c |
| Dictionaries | a dictionary as `category: "BO"` with no `code` / `label`; a dictionary shipped with no rows while the spec names its values (every dropdown on it opens empty); a status path or a short fixed list as a dictionary; a `FROM_BO` dropdown naming a code that is no `BO_DICTIONARY` line of the file; a dictionary picked through a `BO` reference field (draws a «Выберите» link, not a dropdown); a dictionary no field uses; a local list repeating a dictionary's rows; or a catalogue with its own fields (price list, stock) | `BO_DICTIONARY` + the two system fields + one row line per value (0.5b); statuses and short lists = a local list `FROM_FIELD` with the spec's values; a catalogue = a `BO` + a `BO` field to it | 0.5b, 0.2c steps 5–6 |
| Layout | `y = index × 3` while a `BO` table and a `TEXTAREA` are 6 rows (fields overlap); every field full width — a builder loop giving each field `x 0, cols 15`, `y += rows`; every field alone at `cols 8` («one per row»); `w: 10` and no tabs on every window; `tableColToShow: true` on every field | rows of 2–3 short fields (same `y`, `cols` sum 15), next `y` = `y` + `rows` — a builder takes the rows as lists of codes; at most 2 lone short fields per form; the status beside the title in the header row, never in a tab; over 12 visible fields → tabs, over 8 → tabs or group headings; registry ≤ 6 columns; `w` / `h` by 0.8a | 0.5, 0.8, 0.8a |
| Scope | a spec item left «for stage 2», «optional», «needs checking on the stand» | built in the same reply, or a row of the coverage table with a reason from 0.2b step 5 | 0.2b |

Every artefact that is BUILT OUTSIDE the stand and then loaded into it, and the exact format of each:

- **Part I — the structure archive `.mybpm.zip`** (§0 cookbook, §1–§8): business objects, fields, form
  layout, dictionaries, references, access rules, scripts, processes and sidebar menu items.
- **Part II — Block IDE scripts** (§0S cookbook, §9–§18): the script JSON that is pasted into the editor.
- **Part III — records (instances) as Excel** (§0X cookbook, §19–§20): the xlsx that carries the ROWS of a
  business object. A structure archive never carries records, and an xlsx never carries structure.

**Read your cookbook (§0, §0S or §0X), not the whole file.** The reference sections behind them are opened by
pointer only, and the biggest say at their top when: §2 (export inventory), §12a (the script palette — a lookup
table), §19 (Excel evidence).

This document says how to BUILD the three files. Loading them into a stand (its API and screens) is the
other document, `MYBPM-UI-API.md`, or the user does it. **Tools are optional**: everything here can be done
by hand from the text alone; the repository's `tools/*.bun.ts` (generator, validator), if present, apply the
same rules and are named next to the manual recipe, never instead of it.

**Placeholders.** `<stand>` is the host of a MyBPM stand, `<company-a>` … `<company-d>` are example
companies. Ids, codes and names in the examples are examples ONLY — 0.2a says why none may be copied.
**Platform version** MyBPM v4.24. **Status markers**: `[C]` confirmed on a stand or in a real export, `[I]`
inferred, `[U]` unverified — do not build on it without checking.

**The stand does something else than this document says → report it.** Only on the latest release (the
plugin version — the SKILL.md beside this file names it, so does the MCP server — equals `version` of `.claude-plugin/plugin.json` on `main` of `dmezhnov/MyBPM`;
an older copy → update and re-check first, the fact may be fixed). Search the open reports first
(`https://github.com/dmezhnov/MyBPM/issues?q=is:issue+label:platform-discrepancy`) — a known one gets a comment,
not a twin. One fact per issue, de-identified: placeholders (`<stand>`, `<company-a>`, `<user>`) for every host,
company, login and person, no record data. Show the user the text and get their OK — the repository is public.
The issue form takes its fields from the URL: `https://github.com/dmezhnov/MyBPM/issues/new?template=platform-discrepancy.yml`
`&title=…&document=MYBPM-IMPORTS.md&heading=…&mark=[C]|[I]|[U]|none&doc_says=…&stand_did=…&repro=…&version=…`
(URL-encoded, under ~7 500 characters); the user opens it and presses «Submit new issue» under their own GitHub
account. The `mybpm-stand` MCP server's `platform_report` builds that URL and refuses a text that names the
user's own stands or accounts.

---

## 0. COOKBOOK — produce a working archive from this section alone

**Read this section if your job is «make me an archive».** It is self-contained **for the FORMAT** but
not for the target: the inputs of 0.2a belong to the stand and must be **asked for**. Sections 1–8 explain
*why*; this one is *what to type*. Follow it literally and **never invent a key name** — a key you cannot
find in this section does not belong in the file.

**How to read it.** The core runs from here to «0.11 Building the zip» — read ALL of it, every archive
needs it. Behind it, read ONLY the optional blocks your task names: system fields 0.12; widgets 0.13;
kanban views and the Elasticsearch sort defect 0.14; more menu options (views, icons, rights) 0.15–0.16;
a panel, a composite or a process 0.17–0.18; the rarer field types (questionnaire, progress bar, file,
checklist, HTML text) 0.19; predicting a code the stand made itself 0.20.

### 0.1 The artefact

A file `<any-name>.mybpm.zip` — an ordinary zip holding exactly **two members inside one folder**:

```
data-2026-09-18T10-43-21-715/0000001.mybpm    ← the payload, JSONL, UTF-8
data-2026-09-18T10-43-21-715/metadata.mybpm   ← literally: objectCount-2
```

Rules, all `[C]`:

- The folder name is `data-<timestamp>`: the four characters **`data-` are a literal prefix and part of
  the name** — `data-2026-09-18T10-43-21-715/`, not `2026-09-18T10-43-21-715/`. Drop the prefix and the
  import fails. The timestamp after it is free-form (`YYYY-MM-DDTHH-MM-SS-mmm` is what real exports use;
  any value is fine — it is not read). The **folder must exist**: the two members cannot sit at the zip
  root.
- The member names `0000001.mybpm` and `metadata.mybpm` are fixed.
- `metadata.mybpm` contains the single ASCII string `objectCount-<N>` where **N = the number of lines**
  in `0000001.mybpm`. No trailing newline, no JSON, no quotes. Keep N exact. (A too-HIGH N is not
  checked `[C]`; a too-low N is `[U]`.)
- `0000001.mybpm` is **JSONL**: one DTO per line, each line a complete JSON object, `\n` between lines
  and one `\n` at the end. It is NOT a JSON array — do not wrap it in `[ ]`, do not pretty-print it.
  Each line must be minified onto a single line.
- Compression may be **STORED (method 0)** — the importer accepts an uncompressed zip, so a builder does
  not need a deflate implementation.
- The outer file name **must end in `.mybpm.zip` or `.mybpm`** — the upload rejects any other name
  («Расширение файла должно быть…») `[C]`; the rest of the name is free. Real exports are named
  `MyBPM-export-<tenant>-v<build>-<YYYY-MM-DDTHH-MM-SS>.mybpm.zip`.

### 0.2 Algorithm

0. **Ask for the stand data of 0.2a** — group name, taken BO codes, ids/codes of referenced objects.
   Do not start building before the user has answered, or has told you to build without them. Ask ONLY
   what the request has not already answered: «пустой стенд», «новая компания», «a fresh stand» answers
   the groups (NEW ones — you name them yourself, by theme, step 1) and the taken codes (none) — never ask
   those again, not even «как назвать группу».
   For a system built from a spec (0.2b) that does not say the stand is empty, ask exactly this, in the
   same reply as the coverage table, and nothing else: «Стенд пустой (новая компания)? Если нет:
   (1) куда положить новые БО (группы — разделы конструктора): в новые группы по темам (назову их сам) или все
   в одну существующую (тогда пришлите экспорт структуры любого БО из неё — группу возьму из него); (2) чтобы коды новых БО не совпали с уже существующими, пришлите экспорт структуры всех БО
   компании — или скажите «без экспорта», и я добавлю к кодам короткий случайный суффикс.» Ask for FILES
   only — never for access to the stand, and never for «the export of a group»: an export is of the
   company's BOs that were picked for it, there is no per-group export, and BO codes are unique across
   the whole company. A `Person` id is never asked (0.2c step 8).
   **Reading the export the user sends** `[C]`: it holds a `BoGroupStructDto` line only for the groups of
   the exported BOs (`BoStructDto.boGroupOldId` = the group's `oldId`) — copy that line's `code`, `name`
   and `orderIndex` verbatim; the taken codes are the `code` of every `BoStructDto` line. **A group line
   without `code`** is an old group that has none — an archive cannot target it (a code-less line renames
   a fixed group, 0.9 rule 1): put the new BOs into a NEW group and say why. A group that has a code
   carries it in the export `[I]`.
1. **Collect the input**: the display name of the BO, its fields (label + UI type), and its BO group —
   an EXISTING one the user named (§0.2a), or new ones you name yourself. **New groups go by theme**: a
   system of more than ~6 BOs is split into 2–4 groups by meaning (автосервис: «Клиенты и автомобили»,
   «Заказы и работы», «Склад и закупки»), each group at least 2 BOs; fewer BOs stay in one
   group named after the system. Each group is its own line of 0.3 with its own `code` (several group lines
   work, 0.3), and each BO's `boGroupOldId` names the `oldId` of its theme's line. A dictionary goes to the
   theme whose BOs pick from it (марки → «Клиенты и автомобили»), never into a group of all dictionaries.
2. **Decide the codes** by the naming convention of 0.6a: English, snake_case — `Client_order` for the
   BO, `client_name` for a field, `is_*` for a checkbox, `tabs` / `tab_*` for tabs. At most 30
   characters, shortened by meaning. These are the ONLY values you invent.
3. **Mint the ids** by the rule in 0.7 — one per group, one for the BO, one per field. First decide «new build or
   amendment» (0.7 «Which ids: a new build or an amendment»): what already exists keeps its ids, only the new
   gets fresh ones from this build's salt.
4. **Write the group lines first** = one group DTO per group, template 0.3.
5. **Write line 2** = the BO DTO, template 0.4, with one entry of template 0.5 per field inside
   `dynamicFields` — and, if the form also carries «системные поля» or «виджеты», their own maps
   (0.12 `nativeFields`, 0.13 `signatures` / `buttons` / `iframes` / `captcha` / `currentDates` /
   `currentUser`). Those three families never share a map.
6. **Lay the fields out** by the one rule in 0.8 — the `y` counter runs through the widget and system
   fields too, they live on the same grid.
6a. **Make it look right** by 0.8a — tabs over 12 visible fields, group headings, the hidden «Системные»
   tab for technical fields (plus its `AccessStructDto` line), the tab group and window heights, the window size.
7. If the object is not a plain BO (dictionary / panel / composite / process), apply 0.5b (a dictionary) or 0.17 (panel, composite, process)
   **on top of** the same two lines.
7a. If the user also wants the object **in the sidebar menu** (navigation: an item that opens the BO,
   optionally inside a menu group, optionally with extra views such as a kanban), append the menu lines
   of 0.5d AFTER the BO lines — optional, and never added unasked for single objects; for a whole system
   built from a spec the menu counts as asked (0.2b step 4).
8. **Check against 0.9 and 0.10**, then zip as in 0.1 and hand it over as in 0.11.

A `CompanyMetadataStructDto` line is **not** needed — omit it. A reference to the built-in `Person` is
resolved by its code, not by an id (§6 «Person reference»).

### 0.2a Stand data — ASK for it, never invent it

The inputs below **cannot be derived from this document**: they are properties of the target stand, and
every one of them fails SILENTLY when guessed — the archive stays valid, the import reports success, the
damage shows up later. So: **ask the user for them before building.** If the user answers «build without»,
take the fallback of the last column, state in one line which default you took and what it risks, and
build — a guess is allowed only when it has been named out loud and confirmed.

**Decide FIRST, object by object: does the request say it already EXISTS on the stand?** This one
question settles every case below. **An empty stand** («пустой стенд», «новая компания») settles the first
two rows of the table without asking: the group is NEW and the codes are free. A `Person` field needs no
stand id either — it is resolved by `boInfo.code` (§6 «Person reference»), so it is built, never asked for.

- **Not said to exist → it is NEW, and you build it in THIS archive** — together with every supporting
  object it needs. «Каталог товаров, категория выбирается из справочника категорий» = build the
  dictionary «Категории» AND the catalogue, the dropdown pointing at the dictionary by code (0.5).
  «Процесс согласования договора» = build the process AND, if its Form step needs a record to show, the
  BO it points at (intra-archive reference, below). «Мини-CRM» = all of its BOs, wired to each other.
  Say in one line which supporting objects you added and that each one merges into an existing object
  of the same code if the stand already has one (hence the code suffix of the table below).
- **Said to exist** («на стенде есть…», «у нас уже есть…», «панель с реестрами X, Y» — a registry is
  always of something that exists, «добавь в БО X…») → it is STAND DATA: ask for its id / code by the
  table below and never build a stand-in for it.
- **Never degrade a NEW object** into a text field or a local list «because its code is unknown» — you
  are the one choosing its code. A degrade (the last column of the table) is for an object that EXISTS
  and whose id or code the user did not give.

| Ask for | Why guessing fails silently | Fallback if the user declines to supply it |
|---|---|---|
| The **BO group**: the `code`, `name` and `orderIndex` of an existing group (its `BoGroupStructDto` line in an export of any BO of that group, 0.2 step 0), or «a new group» + its name | the importer matches groups BY `code`; a line without `code` **renames an existing group**, and a matched line overwrites the group's `name` and `orderIndex` with its own (§0.3, §8) — the customer's group list is destroyed | ask which group; for an existing one copy its `code`, `name` and `orderIndex` verbatim from the export (a group whose `code` is `null` — no `code` in its export line — cannot be targeted until it is given one; without that, build a new group and say why — `save-business-object-group` with a new `code`, §8 «After the import — the stand-side calls»; that is a stand write and one-way, a code never goes back to `null`, so ask before doing it); for a new one mint a new `code` and say that a group will be CREATED |
| The **BO codes already on the stand** — the `code` of every `BoStructDto` line of an export of all the company's BOs (0.2 step 0) | import MERGES by code: a colliding code edits an EXISTING BO instead of creating a new one, and the report still says success | append a short random suffix to the code (`Demo_bo_p7q2`) so a collision is improbable, and say you did |
| For a `BO` / `CO` field to a BO that EXISTS on the stand — the target's **`oldRefBoId` + code + name** (not for `Person`: it resolves by code, §6 «Person reference»); for a `DROPDOWN_SINGLE` fed `FROM_BO` — the **dictionary CODE** (a `RADIO_BUTTON_GROUP` cannot take a dictionary at all) | ids and codes live on the stand; a wrong id is a dangling reference, and the analysis only warns («В Составном объекте не достаёт БО») — the warning does **not** block ПРИМЕНИТЬ | do NOT emit the field with an invented id. Either drop it, or degrade it — a dropdown to a local list (`optionSource: "FROM_FIELD"`), a reference to `INPUT_TEXT` — and list every field you dropped or degraded |
| To CHANGE a BO that already exists (add a field, rename, re-lay the form) — a **fresh export of that BO** (its `BoStructDto` line as the stand wrote it), or your own last archive of THIS conversation if the BO was imported from it and not changed on the stand since (0.7 case 2) | the importer matches the BO by `oldId` and its fields by `newId` (0.7); a BO line rebuilt from the template of 0.4 RESETS every header setting the template carries (`isTouchEnabled`, `description`, `instanceViewType`, views, `orderIndex` — the BO moves in the sidebar) and lays the new field over the existing ones, and the report still says success | build NOTHING: no archive. Say that a change to an existing BO is made on its export — take the line, ADD the new field entry (new `newId`, `y` = below the last field, next `tableColOrderIndex`), keep every other key and value as exported — and ask for the export — unless your own last archive of this conversation is that BO (0.7 case 2): then edit it the same way. **Deleting a field, a tab or an option is impossible by import** (§8: an import never deletes) — say so and name the route: the constructor, or `deletedFieldIds` of `save-business-object-portion` (`MYBPM-UI-API.md` R1) |



**A BO defined on ANOTHER LINE OF THE SAME ARCHIVE is not stand data — reference it, do not degrade it**
`[C]` (the stand keeps the target's `oldId` as its id). When your own archive creates the target, you
already know its id: you minted it. Write `"oldRefBoId": "<that BO's own oldId>"` plus
`boRefStruct.boInfo = {code, name, boCategory}` copied from that same line (0.5a). **Mint every BO's `oldId`
from its seed (0.7) BEFORE writing any field**: a header's `TABLE` names its line BO, which sits LATER in the
file — compute that id from `"bo." + code`, never look it up in a map filled while the lines are built (that
leaves every forward `TABLE` with `oldRefBoId: ""` and an empty `boInfo`). The degrade of the table's third row applies only when the
target is NOT in this archive.

**Every id literal printed in this document is `<company-a>`'s, not yours** `[C]` — copying one out of an
example IS inventing an id. Mint your own by 0.7.

**0.2a covers the rows of its table and NOTHING else.** It is not a licence to replace whatever you feel
unsure about with something simpler: tabs, a local dropdown, a dictionary, a link between two BOs of this
archive, a menu need no stand data at all. If the document tells you how to build the thing asked for,
build it; 0.2a applies only when a **stand id or a stand code** is what is missing. A panel, a composite
and a process have rules of their own — 0.17.

Two more rules that need no asking, they are absolute: `Person` / `Department` / `PersonGroup` are
reserved codes (§6, import dies with «Несоответствие типов объектов»); never use `Company` either — it is the «Аккаунт» BO, invisible to every login but `root`, and whether a BO of that code clashes is `[U]`, and an `AccessStructDto` is never
shipped unless the user asked for one (0.9 rule 10 — it REPLACES the rights set on the stand). The user
reads ids and codes off the stand (`MYBPM-UI-API.md` R4); an id may start with `~` or contain `@` — copy it
as is.

### 0.2b A whole system from a spec — build everything the archive can carry

**When this applies:** the request is a SYSTEM, not one object — «реализуй CRM по этой концепции», «создай
архив для всей системы», a spec with sections on objects, a work path, automations, reports, roles. The
job is then the whole spec, not «the BOs the spec names». Do these steps in this order:

1. **Print the coverage table FIRST — in your reply, before any file is written.** One row per requirement
   of the spec (an object, a list of values, a status path, a link between objects, an automation, a
   calculation, a report, a role, a notification), columns «spec item | route | built by». Each
   automation, report and role is a row of its own — never one row for «rights, reports and notifications».
   A calculation or automation stated inside an object's description (a number given automatically, a value
   recomputed on save, a date derived from another) is a row of its own too — the object's «an archive line»
   row does not cover it.
   Each row gets exactly ONE route from the table below, written as the literal text of its «Route» cell;
   «where the format supports it», «if possible», «partly», «если поддерживается», «где это поддерживается
   форматом», «требует серверной логики», «внешняя настройка», «настройка на стенде» and two routes joined by
   «или» are no route — an
   item that fits none is «not expressible» with its row of 0.2d:

   | Route | What goes there | Built by |
   |---|---|---|
   | an archive line | BOs, dictionaries AND their values, fields, links between BOs, tabs and layout, kanban card templates, the menu | 0.3–0.5d, 0.2c |
   | a hook script in the archive | computed fields and totals (stock, reserve, balance = a sum over lines), auto-fill, «when X is saved, set Y» | 0.2c step 7, §5d, Part II |
   | a business process in the archive | a path someone RUNS step by step, with forms and branches (approval) | 0.18, §5c |
   | an xlsx after the import | initial records of working BOs (clients, cars, stock) | Part III, 0.2d |
   | stand-only | rights by role, users and groups, a field on a built-in BO | 0.2d |
   | not expressible | reports and dashboards, SMS / telephony, anything 0.2d lists | 0.2d |

2. **Model the objects by 0.2c** — every link between two objects of the spec becomes a `BO` field (0.5a),
   never a text field; every list of values becomes a dictionary (0.5b) or a local list (0.5).
3. **Build every row routed to an archive line, a hook script or a process — in this reply, in one
   archive**, in this line order: group lines (by theme, 0.2 step 1), dictionaries, BOs (every BO `oldId` minted from its seed
   up front, so a `TABLE` can name a BO written after it, 0.2a), script lines, process lines, menu lines last. Never «the structure now, the scripts later».
4. **The menu counts as ASKED** (0.5d). One item per user job (0.2c step 9). Up to ~5 items → all at
   the root, no group. More → one menu `GROUP` per theme (the same themes as the BO groups, 0.2 step 1),
   each holding its items — never one group holding everything. On the item of every BO with a status
   path switch the kanban on by its status dropdown; every line carries an icon by ITS OWN meaning — every group a different one, every dictionary by what it
   lists (0.5d «Icons by meaning»). The «never added
   unasked» of 0.2 step 7a is about a request for single objects.
5. **A row you do not build needs a reason from this closed list — nothing else is a reason:**
   - a stand id or code is missing (0.2a) — name it, and ask;
   - the archive cannot carry it — name its row of 0.2d;
   - its only route is `[U]` — name the section that marks it.

   «Cannot be verified offline», «out of scope», «too large», «better done by hand», «отмечается вручную» for a
   status path with an approval stage, «an archive has no
   computed field type» are NOT reasons. Nothing in this document is verified offline — the user runs the
   import analysis and it reports what is wrong; scope is what the spec says; a computed field is a plain
   field plus a hook (0.2c step 7).
6. **Run 0.10 and report by 0.10 «The report»** — the coverage table again, each row now marked built /
   not built + the reason / to do after the import — **printed as the table, at the end of the reply**; a prose
   «Что включено» / «Ограничения» instead is no report. A row is built only when all it names is in the file;
   a part that is not is split off into a row of its own, not built + its reason — every limitation the reply
   names («вводится вручную», «не вычисляется автоматически») is such a row. **Every row routed to «a hook script in the archive» or
   «a business process in the archive» is in the file** (a `ScriptDefStructDto` / `BO_PROCESS` line you can
   name), or it is marked «not built» in its own row with a reason from step 5. A blanket line instead —
   «это пока структурная основа», «скрипты и процесс не включены», «будут добавлены позже» — breaks step 3
   and is no report.

### 0.2c Modelling patterns — how a spec becomes BOs and links

Walk the spec through these nine questions, in order; each answer is a line or a field of the archive.

1. **Header and lines?** (заказ-наряд → работы и запчасти, заказ поставщику → позиции, счёт → строки) →
   a separate LINE BO; the line BO carries a `SINGLE` `BO` field to the header, the header a `TABLE` `BO`
   field to the line BO, each naming the other in `boRefStruct.linkedFieldCode` — the pair of 0.5a, both
   ends in this archive. A `TABLE` without the back link leaves every line an orphan in one global
   registry: no line knows its header, and the lines of one header cannot be listed or summed. Never a
   `TEXTAREA` «работы» instead of line records. **The line BO is never the catalogue**: «запчасти в
   заказе» is `Order_part` (`work_order` → the header, `spare_part` → the catalogue, quantity, price), and
   «запчасти на складе» is `Spare_part` (article, name, stock) with no link to any order — one BO for both
   makes every stock item belong to one order.
2. **A child document?** (оплаты по заказу, записи → клиент, автомобили → владелец) → the same
   `SINGLE`↔`TABLE` pair, so the children show on the parent's card. A child's `SINGLE` without the
   parent's `TABLE` back makes the children invisible on the parent.
3. **One stage growing out of another?** (запись → заказ-наряд, лид → сделка) → a `SINGLE` on the later
   record to the one it came from, and the `TABLE` (or a linked `SINGLE`) back — navigable both ways.
4. **Many-to-many?** (мастера ↔ заказы) → two `TABLE` fields naming each other (§6 «M:N»).
5. **A list of values?** Values users will add to over time, or that more than one BO picks from (марки,
   виды работ, категории запчастей) → a dictionary (`BO_DICTIONARY`, 0.5b) + `DROPDOWN_SINGLE` `FROM_BO`.
   A catalogue whose rows carry more than a name — a price, a duration (работы, запчасти с ценой) — is a
   plain `BO` with those fields that the lines reference (step 1). A short fixed list owned by one field
   (способ оплаты: наличные / карта / перевод) → a local list (`FROM_FIELD`, 0.5). Both TRAVEL in the
   archive: a local list's options inside the field, a dictionary's values as its row lines (0.5b). **No
   dropdown opens empty**: every value the spec names or implies (марки, категории, типы КПП, виды топлива,
   посты) is shipped — a dictionary with no row lines only when its values are truly the user's own data
   and the spec gives none, and then the report says «заполнить после импорта».
6. **A status path?** A record's lifecycle (Новый → В работе → Готов → Выдан) → a `DROPDOWN_SINGLE`
   `status` with a LOCAL list (`FROM_FIELD`) holding the spec's stages as options, its kanban card template
   (0.5c), and in a system build its menu item shows the kanban by it (0.2b step 4). Never a dictionary for
   statuses: the stages belong to one field, and the local list fixes their order and colours. A `BO_PROCESS` is for a path someone RUNS figure by figure — forms, a script, a branch
   (approval, 0.18). Do not turn every status into a process, and never fake `PROCESS_STATUS` with a
   dropdown.
7. **A computed value?** (сумма заказа = сумма строк, остаток = сумма − оплачено, дата готовности = приём
   + срок) → a plain field (`INPUT_NUMBER`, `DATE` …) plus the owner BO's `afterSaveScriptId` hook that
   fills it (§5d «Generated bodies on every trigger», the body by 0S). A total over lines: `BlockForeach`
   over the header's `TABLE` `.#Значение`, read each line's number with the two hops, add it to a
   variable, assign the variable to the header's field (0S.7 «A nested table», «Writing a field»). The whole
   sum hook is `[C]` and READY — §5d «A ready sum hook»: copy it, rename the five field codes; it also
   writes each line's own sum (часы × цена) in the same loop, and an empty number reads as 0 `[C]`. It recomputes when the HEADER is saved; a line
   edited in its own card does not run the header's hook `[I]`.
8. **A responsible person?** (мастер, менеджер, автор записи) → a `BO` field to the built-in `Person` (§6
   «Person reference»): `"oldRefBoId": ""`, `boInfo {code:"Person", name:"Пользователи", boCategory:"BO"}`
   — the stand resolves it by that code, so it needs no stand id and is ALWAYS built. Or the current-user
   widget / the system «Автор» (0.12, 0.13) when the person is simply who created the record.
9. **Which BO gets a menu item, and how many?** One item per JOB a user does with the records — there is no
   count per BO. A BO a user opens as a working list (клиенты, автомобили, заказы, записи, оплаты,
   поставщики, заказы поставщикам) usually has one. NONE for the line BOs — they are edited inside the
   header's table — and none for a service BO nobody opens by hand. SEVERAL when another view or another
   filter serves a different job of the spec: «Мои заказы» (records I created), «Заказы в работе» (status
   = a value), «Запись на сервис» as a calendar beside the list (its BO `isCalendarEnabled: true`, §2 «BO views») — each its own item with its own name, view
   and `bracketFilter` (0.15 «One BO, several items»). Never add an item to reach a quota, never one per
   view the BO merely supports. A dictionary or a catalogue BO (прайс работ, номенклатура) gets its item in the menu group of the
   theme whose BOs pick from it, next to them (марки авто → «Клиенты и автомобили», статьи расходов → beside
   «Оплаты»); one used by several themes goes to the theme it belongs to most, or gets no item (it stays
   reachable under «Бизнес-объекты»). **Never one group collecting all dictionaries** — group by meaning, not
   by object kind. A `BO_PROCESS` started by a run way
   (0.18) gets an item only when users need the list of running approvals; otherwise none.

### 0.2d What never travels in an archive

Name the row of this table for every spec item you do not build (0.2b step 5) — do not invent a reason of
your own.

| Spec item | Why the archive cannot carry it | What to do instead |
|---|---|---|
| Rights by role («мастер видит только свои заказы») | an `AccessStructDto` names `G-<group id>` of the TARGET stand's groups, and it REPLACES the rights set there (0.9 rule 10) | ask for the group ids (0.2a); without them list the rights matrix in the report as a stand-side step (`MYBPM-UI-API.md` R5) |
| Initial records of working BOs (clients, cars, stock) | records are an xlsx (0.9 rule 11); only a dictionary's values travel as row lines (0.5b) | put them into the report as a table and load them by Part III after the import |
| Reports, dashboards, analytics | operative reports have their own export basket (`menuItemType` `REPORT`, §5e); none was shipped in an archive `[U]` | not built — say so; a registry with its columns, grouping (§2 «BO views») or a kanban covers a simple list report |
| SMS, telephony, calls, a messenger bot | external services configured on the stand, not structure | not built — say so. Only the link FIELD of a record to Telegram / WhatsApp travels (`messengerFieldCode`, `whatsAppFieldCode`, §2 «BO card tabs») |
| E-mail / push notifications from a script | the script palette has the actions (§12a «Built-in objects», `alert`); their delivery was never checked `[U]` | build them only if asked and say they are `[U]` |
| A time-driven automation («напомнить через 3 дня») | a `SCHEDULED` process start has never been seen to fire `[U]` (§5c) | not built — say so; a hook on save or a manually started process is the working route |
| A guard: forbid a save or a status change until a condition («без согласования нельзя начать работы») | no hook that refuses a save or rolls a status back is known `[U]` (§5d) | a path someone RUNS step by step → a business process with an approval branch (0.18); a value that must be there → «Обязательное» (`isRequired`, 0.5); otherwise not built — say so |
| Users, departments, groups, companies | they are RECORDS of the built-in BOs `Person` / `Department` / `PersonGroup` / `Company` (reserved codes, 0.2a; `Company` only for the `root` login), not structure; an archive carries an org unit only as an `ExportStructInstanceDto` next to the rights or settings that name it; it never CREATES a unit — an unknown one must be mapped onto an existing unit before the apply, and the import writes the archive's name onto that unit (§8) `[C]` | records: an xlsx of records (Part III; group membership from the group side) or the stand by hand; a new user e-mails an invitation (§3) |
| A field on a built-in BO (`Person`) | untested `[U]` (§6 «Built-in BOs») | the constructor, by hand |
| Deleting a field, a tab or an option | an import never deletes (§8) | the constructor or the API (`MYBPM-UI-API.md` R1) |

### 0.3 Line 1 — the BO group (copy verbatim, change `name`, `code`, `orderIndex` and the two ids)

```json
{"@class":"kz.greetgo.mybpm.reg.structure.model.dto.BoGroupStructDto","oldId":"3H84o9iM@G4jaOL3","name":"Проба группа","code":"Probe_group","orderIndex":1110000,"kind":"MANUAL","newId":"ca3w3BgmzJGmWO7q"}
```

- **Every group line carries a `code` — the importer matches groups BY `code`, not by name** `[C]`
  (§8): a `code` that exists on the stand puts the BOs into that group;
  a `code` the stand does not have CREATES a new group (its id = the line's `newId`, its name = `name`).
  **A matched group still takes the line's `name` AND `orderIndex`** `[C]` — it is renamed and moved. So for an
  EXISTING group copy all four — `code`, `name`, `orderIndex`, `kind` — from `load-bo-groups` (0.2a). **A line WITHOUT `code` is written onto one fixed stand group and RENAMES
  it** — whatever `name` says, even the exact name of another existing group. That is the defect that
  destroys the customer's group list (§8). Never ship a group line without `code`.
- To put the BOs into an EXISTING group, copy its `code` from `load-bo-groups` (0.2a). Old stand groups
  often have `code: null` — such a group cannot be targeted by an archive; ask the user for a group that has a
  code, ship a new group with a new code, or (with the user's yes — it is one-way) give that group a code
  first with `save-business-object-group` (§8 «After the import — the stand-side calls»). A group created on a stand now always
  gets a code (`Gruppa__N`). Read the list with `load-bo-groups {forEdit: true}` — without it the empty
  groups are left out.
- The two ids above are the SAMPLE's, not yours — mint your own by 0.7 (0.2a).
- `oldId` ties this line to the BO line (`BoStructDto.boGroupOldId` repeats it). It is NOT a stand id —
  every export of the same group carries a different one, so any value of the right shape is fine.
- `kind` is `MANUAL` — for a NEW group and for an existing `MANUAL` one. **The one exception is the company's
  general group «Общее»** (`load-bo-groups`: `kind: DEFAULT`, `isGeneral: true`, code `General`): a line that
  targets it repeats `"kind": "DEFAULT"`. **A matched general group takes the line's `kind` like its `name`
  and `orderIndex`** `[C]`: `MANUAL` demotes it, the company is left with no general group, and every BO in no
  group — the built-in «Пользователи», «Департамент», «Рабочая группа», «Аккаунт» — vanishes from the BO list
  and from `load-bo-groups`. Rolling back that import gives the group `DEFAULT` back and the built-in BOs
  reappear `[C]`; other repairs: `[U]`.
- **Never send `"kind": "DEFAULT"` on any other line** (a new group, or one whose code the stand gives another
  kind): a group CREATED by import with `kind: DEFAULT` becomes a general group of the company, which cannot be
  deleted — not by `delete-business-object-group`, not by the rollback of that import («Can not delete general
  group»), and saving it as `MANUAL` is ignored. It then lists every BO of the company that is in no group `[C]`.
  So `General` + `DEFAULT` goes only to a stand whose `load-bo-groups` shows exactly that group.
  `orderIndex` is the group's place in the list — a new group takes it, and
  a matched group is MOVED to it `[C]` (above), so repeat the stand's own value.
- **Several group lines in one archive work** when every one of them has a `code` `[C]`. Without codes they collapse into the one fixed
  group (§8).

### 0.4 Line 2 — the business object

Copy this whole object, minify it to one line, and change only the six `←` marked places. Every other
key must be present with exactly this value — a missing key is NOT «keep what the stand has»: a re-import
without `isTouchEnabled`, `hideAddButtonFromRegistry`, `instanceViewType` and `description` RESET them to
`true` / `false` / `FORM` / `null` `[C]` (§2 «BO header settings»), and an unknown key is a guess
that can break the analysis (§8).

**The `←` notes in the blocks below are annotations, NOT part of the file.** Strip each `←` and
everything after it on that line — the shipped line must be pure minified JSON.

```text
{
  "@class": "kz.greetgo.mybpm.reg.structure.model.dto.BoStructDto",
  "oldId": "WbX5Wa8gcabbVbF1",              ← id of the BO — MINT YOUR OWN (0.7); becomes its real id on the stand
  "code": "Cookbook_demo",                  ← code of the BO: English, first letter capital, snake_case, ≤ 30 chars (0.6a)
  "category": "BO",                         ← BO | BO_DICTIONARY | BO_PANEL | BO_COMPOSITE | BO_PROCESS (0.17)
  "kind": "GENERAL",
  "boGroupOldId": "3H84o9iM@G4jaOL3",       ← = oldId of line 1, character for character
  "instanceViewType": "FORM",               ← FORM = a record opens as a dialog, TAB = as a page tab (0.8a decides)
  "gridLayoutPosition": {"x": 3, "y": 0, "w": 10, "h": 26, "id": "0"},   ← the record WINDOW, sized by 0.8a — a dictionary too (0.5b)
  "bos": [],
  "boTabs": {},                             ← card tabs, e.g. {"CHAT": 1, "FILES": 2} — ADDS only, never removes (§2 «BO card tabs»)
  "printForms": [],
  "name":       {"rus": "Демо из кукбука"}, ← display name
  "recordName": {"rus": "Демо из кукбука"}, ← same text (shown nowhere; the constructor keeps it = name)
  "staticValue": {},
  "description": "",
  "orderIndex": 47480000,                   ← CHANGE IT: the BO's place in its group, a DIFFERENT number per BO — e.g. 100000, 200000, 300000 for three BOs; 47480000 is the sample's (0.9 rule 17)
  "dynamicFields": { "<fieldCode>": { …template 0.5… } },   ← one entry per field, keyed by field code
  "nativeFields": {},
  "dictionaryFields": [],
  "actual": true,
  "isCalendarEnabled": false,              ← registry views (§2 «BO views»); a map also needs the
  "isMapEnabled": false,                     kanban card template of every dropdown, grouping renders nothing
  "isGroupingEnabled": false,
  "isCodeReadonly": false,
  "chosenAccessRight": false,
  "isTouchEnabled": true,                  ← «Помечать новые (непросмотренные) записи»
  "hideAddButtonFromRegistry": false,      ← true = no create button in the registry
  "kanbanCardTemplates": {},                ← empty ONLY when the BO has no DROPDOWN_SINGLE; otherwise one
                                              template per dropdown (0.5c), or kanban AND map die
  "timelineTemplates": {},
  "calendarCardTemplates": {"header":{},"content":{},"footer":{},"headerDelFieldCodes":{},"contentFieldCodes":{},"footerDelFieldCodes":{}},
  "signatures": {},
  "buttons": {},
  "iframes": {},
  "currentDates": {},
  "captcha": {},
  "currentUser": {}
}
```

**`dynamicFields` is an OBJECT keyed by field code, never an array.** The key repeats the field's own
`code`.

> **Reading in chunks? You are NOT done.** The cookbook core runs on to «0.11 Building the zip»
> (≈ 700 more lines): the field template right below, links 0.5a, dictionary 0.5b, kanban 0.5c, menu 0.5d,
> ids 0.7, layout 0.8a, hard rules 0.9, self-check
> 0.10. Call the reader again with the next offset before you ask, plan or write anything.

### 0.5 The field template — one copy per field

Paste this once per field inside `dynamicFields`. **Only the `←` lines change**; the long boolean
block is the exact set a stand-built field carries and is copied as is.

**The `←` notes in the blocks below are annotations, NOT part of the file.** Strip each `←` and
everything after it on that line — the shipped line must be pure minified JSON.

```text
{
  "code": "name",                          ← the field code (0.6a: English lower snake_case); must equal the key in dynamicFields
  "newId": "qmEhH4GnZvawC3R4",             ← id of the field — MINT YOUR OWN (0.7), unique inside the archive
  "archetype": "DYNAMIC",
  "kind": "GENERAL",
  "boRefStruct": {"fieldRefs": {}},
  "label": {"rus": "Наименование"},        ← the label the user sees (no leading spaces)
  "staticValue": {},
  "isUnique": false,                       ← «Уникальное»
  "isRequired": false,                     ← «Обязательное»
  "isAppendable": false,
  "isRequiredAll": false,
  "isReadonly": false,
  "isClickable": true,
  "isSelectOnly": false,
  "isSeparated": false,
  "needAddToParticipants": false,
  "needShowToCalendar": true,
  "dateOnlyFuture": false,
  "dateOnlyPast": false,
  "needTrackStatus": false,
  "tableColToShow": false,                 ← true only on a registry column: the name + at most 5 key values (below)
  "isHistoryTracking": false,
  "isKindAddForSelect": false,
  "titleToShow": false,
  "questionnaireIsMultiple": false,
  "isProgressBarSticky": false,
  "hideLabel": false,
  "chosenAccessRight": false,
  "unacceptableValue": false,
  "isSystem": false,
  "isCodeReadonly": false,
  "needLoadFromInTables": false,
  "useAsKeyInMigration": false,
  "needUploadToOutTable": false,
  "needChangeParentBoByLinkedBo": true,
  "needFreezeWhenScroll": false,
  "needMarkNew": false,
  "textCase": "NONE",
  "inMigrationTimezoneMinutes": 0,
  "type": "INPUT_TEXT",                    ← the field type, table below
  "groupingInfo": {},
  "fieldTabs": {},
  "tableColOrderIndex": 0,                 ← the field's POSITION: 0 for the 1st field, 1 for the 2nd, 2 for the 3rd … — NOT 0 on every field
  "gridPosition": {"x": 0, "y": 0, "cols": 15, "rows": 3},   ← layout, rules 0.8 and 0.8a (3 = a one-line input)
  "removeType": "STRIKETHROUGH",
  "gantTableLocations": {},
  "boFieldCodes": [],
  "linkedCoSettings": {},
  "questionnaires": {},
  "progressSteps": {},
  "params": {}
}
```

**`tableColOrderIndex` is a counter, not a constant.** The literal `0` in the template belongs to the
FIRST field only: the second field carries `1`, the third `2`, and so on, in the order the entries sit in
`dynamicFields` — that order is the registry's column order. Leaving `0` on every field leaves the column
order undefined. The counter runs over **every entry of `dynamicFields`, with no exceptions**; the things
that do not carry the key and do not advance it live in OTHER maps — the system fields of 0.12
(`nativeFields`) and the six widget maps of 0.13.

**«Widget» in this document means ONLY a member of the six maps of 0.13** — `SIGNATURE`, `BUTTON`,
`IFRAME`, `CAPTCHA`, `CURRENT_DATE`, `CURRENT_USER`. The palette's «Виджеты» section is a different
thing and is not a guide to the archive: `TAB_GROUP` and `PROGRESS_BAR` stand there, and they are
ORDINARY `dynamicFields` entries. So `STATIC_TEXT`, `TAB_GROUP`, `PROGRESS_BAR`, `QUESTIONNAIRE`,
`FILE_UPLOAD`, `CHECKLIST`, `GEO_POINT` all sit in `dynamicFields`, all carry the full template of this
section, and all take their turn in the `tableColOrderIndex` counter. Anything in `dynamicFields`
without the key is rule 6 of 0.9 — the key is not optional for «non-input» fields.

**To make a field required or unique, write `true` in `isRequired` / `isUnique`. To turn something off,
write `false` — never delete the key** (§8: a dropped key keeps the stand's old value).
`isRequired` and `isReadonly` must never both be `true` — such a record cannot be saved (the constructor
greys the second checkbox out as soon as the first is ticked). Both flags survive an import unchanged
`[C]` and behave on the stand exactly as a constructor-built flag: an empty required field is
refused with «Обязательные поля не заполнены», a duplicate unique one with «Продублировано уникальное
поле». A UI-built BO ALSO carries `tableColToShow: true` on every required/unique field (the constructor
sets it automatically) — copy that if the archive should reproduce a stand-built registry.

**Which fields are registry columns — the default.** `tableColToShow: true` on the fields a user scans the
list by: the name / title / ФИО field (a string — that is fine), plus **at most 5** key values (status, date,
amount, the main reference) — **6 columns at most**; a 13-column registry cuts every header to «Мар…», «К…».
The template above carries `false`: switch it on per field, never copy `true` onto every field. Put the name field FIRST in `dynamicFields`, so it gets `tableColOrderIndex`
0 and `y: 0`. The counter follows the ORDER OF ENTRIES, the form follows `y` — they are independent: a
`PROGRESS_BAR`, heading or `TAB_GROUP` on top of the form takes `y: 0` and the name field moves down, yet it
still stands AFTER the name field in `dynamicFields` and takes the next counter value. Long texts (`TEXTAREA`), headings, files, tabs and checklists are `false`. Do NOT hide
string fields from the registry and do NOT move a number or a date to the front «to be safe»: that
workaround exists for ONE stand defect and is applied **only when the user says the target stand has
it** (0.14 «The Elasticsearch sort defect»). Without such a statement, ignore that paragraph.
A `DROPDOWN_SINGLE` additionally needs `fieldOptionsStruct` (§5) — a dictionary by CODE, or a local list.

**The documented exceptions to «never drop a key»: the composite, and `PROCESS_STATUS` (0.18).** A `BO_COMPOSITE` has no form, so
its fields carry no `gridPosition`, no `tableColOrderIndex` and no `removeType` (0.17, §5b) — an archive
built without exactly those three imports `[C]`. Nowhere else may a key of this template be
absent.

Types you may put in `"type"` — this is the WHOLE palette of «Элементы страницы», 23 types `[C]`. Four more types exist and are reached
differently: `BO` / `CO` (dragged out of «Вложенные объекты»), `TAB_GROUP` / `PROGRESS_BAR` (they sit in
the «Виджеты» section of the palette but are ordinary `dynamicFields` entries).

| UI «Тип поля» | `type` | extra keys in the archive |
|---|---|---|
| Текстовое поле | `INPUT_TEXT` | — |
| Текстовый блок | `TEXTAREA` | — (the value may be HTML, below) |
| Текст (заголовок секции, статический HTML) | `STATIC_TEXT` | `staticValue` |
| Число | `INPUT_NUMBER` | — |
| Чекбокс | `CHECKBOX` | — |
| Дата | `DATE` | — |
| Дата и время | `FULL_DATE` | — |
| Время | `TIME` | — |
| Период / Период со временем | `PERIOD` / `PERIOD_TIME` | — |
| Год / Год и месяц | `YEAR` / `YEAR_AND_MONTH` | — |
| Выпадающий список | `DROPDOWN_SINGLE` | `fieldOptionsStruct` (§5) |
| Единичный выбор | `RADIO_BUTTON_GROUP` | `fieldOptionsStruct` — the LOCAL shape only (a dictionary is lost on import, §3 «Единичный выбор») |
| Чек лист | `CHECKLIST` | **`defaultValue`** = the items as a JSON string, + `isAppendable: true` (below) |
| Опросник | `QUESTIONNAIRE` | `questionnaires` |
| Прогресс-бар | `PROGRESS_BAR` | `progressSteps` |
| Вкладки | `TAB_GROUP` | `fieldTabs` |
| Карта | `GEO_POINT` | — |
| Ссылка | `LINK` | — |
| Загрузка файла | `FILE_UPLOAD` | `params.viewType` SINGLE/MULTIPLE/TILE + `params.contentType` ALL/FOR_CAMERA (also IMAGE/DOCUMENT; mobile app only, below); **a field for photos (фото, снимки, photo) → `params.viewType: "TILE"`** — MULTIPLE shows only «Прикрепите файл», no pictures (0.19) |
| Email / Телефон | `INPUT_EMAIL` / `INPUT_PHONE` | — |
| Мультиязычное текстовое поле | `INPUT_TEXT_LANG` | — |
| Мультиязычный текстовый блок | `TEXTAREA_LANG` | — (the value may be HTML, below) |
| Вложенный объект / Пользователь | `BO` | `oldRefBoId` + `boRefStruct.boInfo` |
| Составной объект | `CO` | `oldRefBoId` + `boRefStruct.boInfo` with `boCategory: "BO_COMPOSITE"` |

The types that need extra keys — every shape `[C]`:

- `STATIC_TEXT` — the HTML of the heading goes into `"staticValue": {"rus": "<div style=\"font-size:18px;font-weight:700;color:#1f2d3d;border-bottom:1px solid #d9dee5;padding-bottom:6px\">…</div>"}` (a bare `<h3><b>` renders as a small bold label — the sanitizer strips the size of `h1`–`h3` `[C]`), with
  `"hideLabel": true`, `"tableColToShow": false` and the cell `{"x":0,"y":<y>,"cols":15,"rows":3}` — a
  one-line group heading (0.8a). A heading text **must not repeat any field label of the same BO** — that
  breaks Excel import.
- `TEXTAREA` / `TEXTAREA_LANG` — **choose the editor toolbar by meaning, unasked**: `params.buttonTypes` is
  the JSON TEXT of an array of buttons (§3 «Per-type settings»). A comment, a note, a reason, an address,
  a complaint → `"params": {"buttonTypes": "[]"}` — no buttons at all (a thin empty strip stays) `[C]`. A
  description a user may format → `"[\"bold\",\"italic\",\"ul\",\"ol\"]"`. No key (the default ten,
  with tables, links and pictures) only for rich content — a letter, an article, an instruction.
- `BO` (nested object / reference) — add `"oldRefBoId": "<the target BO's id ON THE STAND>"`,
  `"viewType": "TABLE"` (or `SINGLE`, 3 rows — 0.8), `"isHeightDynamic": true`, and
  `"boRefStruct": {"boInfo": {"code": "<target code>", "name": "<target name>", "boCategory": "BO"}, "fieldRefs": {}}`.
  The target must already exist on the stand and **its id and code must be read off the stand**, never
  guessed — unless this same archive creates it, in which case its `oldId` IS the id (0.2a), or it is the
  built-in `Person`, which needs `"oldRefBoId": ""` and `boInfo.code: "Person"` only (§6 «Person reference»).
- `CO` — the same, with `"boCategory": "BO_COMPOSITE"` and the composite's id (which itself often starts
  with «@», e.g. `@feclOAWUnwXFQ8c` — parse such a spec from the right).
- `DROPDOWN_SINGLE`, `RADIO_BUTTON_GROUP` — one extra key, `fieldOptionsStruct`, in exactly one of the
  two shapes below — a `RADIO_BUTTON_GROUP` only the first, the local list. Copy the literal.

  A LOCAL list («Задать вручную») — **`options` is an OBJECT keyed by the option's own code, never an
  ARRAY**, and every entry wraps its payload in `fieldOption`:

  ```text
  "fieldOptionsStruct": {"optionSource": "FROM_FIELD", "dictionaryOptionSetting": {}, "options": {
     "new":         {"fieldOption": {"code": "new",         "label": "Новый",    "orderIndex": 0,     "color": null, "hiddenInKanban": false}, "newOptionId": "<16 chars>"},
     "in_progress": {"fieldOption": {"code": "in_progress", "label": "В работе", "orderIndex": 10000, "color": null, "hiddenInKanban": false}, "newOptionId": "<16 chars>"}}}
  ```

  The map key repeats `fieldOption.code`, the code follows 0.6a (English lower snake_case), and
  **`fieldOption.label` is a PLAIN STRING** — not `{"rus": …}`, the one label in the whole file that is
  not a language map. `orderIndex` steps 0, 10000, 20000…; `newOptionId` is a fresh id by 0.7.
  **`newOptionId` becomes the option's id on the stand**, so an option chosen in advance — the field's
  `defaultValue` — is written as that `newOptionId`: `"defaultValue": "<the newOptionId of «В работе»>"`.
  Not the code, not an id copied from a stand export — both are stored as they are and point at nothing
  (§3 «Единичный выбор»).

  A DICTIONARY — named BY CODE, so it needs no stand id; this is the one cross-object reference 0.2a
  does not block:

  ```text
  "fieldOptionsStruct": {"optionSource": "FROM_BO", "options": {}, "dictionaryOptionSetting": {},
     "dictionaryBoInfo": {"code": "Dolzh", "name": "Должность", "boCategory": "BO_DICTIONARY"}}
  ```

  `options` stays EMPTY here — the rows live in the dictionary and the form reads them at runtime.
- `TAB_GROUP` — its own code is `tabs` (`tabs_*` when the BO has several, 0.6a); `"fieldTabs"` keyed by the tab code (`tab_*`):
  `{"tab_main": {"label":{"rus":"Общее"},"orderIndex":0,"chosenAccessRight":false,"isRight":false,"isDefault":true,"code":"tab_main","newId":"<16 chars>"}}`
  Fields on a tab carry `tabCodePath: {tabGroupCode, tabCode}` — both CODES. **A widget on a tab (an entry of
  any of the six maps of 0.13) carries the same object under the key `tabCode` instead** `[C]`: the import puts
  it on that tab and the export writes it back the same way, and its `gridPosition.y` counts from the top of
  the tab like a field's. `tabCodePath` on a widget is silently IGNORED `[C]` — the widget lands outside the
  tabs at its `y` in the form's stack, overlapping whatever sits there. **A TAB_GROUP must have a
  code** `[C]`: a group created over the API without a label gets code `""`, and a stand
  export then DROPS the group itself and its tab rules, writing the group's id into its fields'
  `tabGroupCode` (the archive cannot be imported back). Give the group a code before exporting
  with `save-business-field-code` (§8 «After the import — the stand-side calls»). Per-tab locks → §7.

Cell heights the constructor itself assigns: 3 rows for a one-line input, 4 for other plain fields, **6** for
`BO` / `CO` / `LINK` / `FILE_UPLOAD` / `CHECKLIST` / `RADIO_BUTTON_GROUP` / `PROGRESS_BAR`, **8** for
`STATIC_TEXT` / `QUESTIONNAIRE` / `TAB_GROUP` / `GEO_POINT`. These are defaults, not targets: a heading
and a `SINGLE` reference need 3, a `TEXTAREA` 6, a `TAB_GROUP` its tallest tab + 3 (+ 6 on a `TAB` page) — write the heights of
0.8 and 0.8a.

> **Your first read most likely ended near here — the core is only half read.** Still ahead, and every
> system needs them: links 0.5a (right below), dictionary 0.5b, kanban 0.5c, **menu 0.5d**, ids 0.7, layout
> 0.8a, hard rules 0.9, self-check 0.10, zip 0.11. Call the reader again NOW with `offset` = the line after
> the last one you got and `limit` 400 (a larger limit may be refused as too big), and repeat until «0.11
> Building the zip» has scrolled past. Do not ask, plan or write before that.

### 0.5a A link between two BOs — the `SINGLE`↔`TABLE` pair

Header–lines, parent–child and stage chains (0.2c steps 1–3) are ONE pattern: two `BO` fields, one on each
BO, naming each other. Both are the full template of 0.5 with these keys changed — the keys `[C]`, the pair
printed whole `[I]`. Example: `Work_order` (header, `oldId` `<WO>`) and `Order_work` (its lines, `oldId`
`<OW>`), both in this archive:

```text
on Work_order, in dynamicFields:                       ← the header's TABLE of its lines
"works": { …template 0.5…,
  "code": "works", "label": {"rus": "Работы"}, "type": "BO",
  "oldRefBoId": "<OW>",                                 ← the LINE BO's oldId (minted by you, 0.7)
  "viewType": "TABLE", "isHeightDynamic": true,
  "isKindAddForSelect": true,                           ← «Добавить» creates a new line; false = pick an existing record
  "tableColToShow": false,
  "boRefStruct": {"boInfo": {"code": "Order_work", "name": "Работы заказа", "boCategory": "BO"},
                  "fieldRefs": {"work": {"toShow": true, "orderIndex": 0},
                                "price": {"toShow": true, "orderIndex": 1}},   ← columns: codes of Order_work fields
                  "linkedFieldCode": "work_order"},     ← the code of the back field on Order_work
  "gridPosition": {"x": 0, "y": <y>, "cols": 15, "rows": 6} }

on Order_work, in dynamicFields:                       ← the line's SINGLE back to its header
"work_order": { …template 0.5…,
  "code": "work_order", "label": {"rus": "Заказ-наряд"}, "type": "BO",
  "oldRefBoId": "<WO>",                                 ← the HEADER's oldId
  "viewType": "SINGLE", "isHeightDynamic": true,
  "tableColToShow": true,
  "boRefStruct": {"boInfo": {"code": "Work_order", "name": "Заказ-наряд", "boCategory": "BO"},
                  "fieldRefs": {"number": {"toShow": true, "orderIndex": 0}},  ← what the chip shows: a Work_order field
                  "linkedFieldCode": "works"},          ← the code of the TABLE on Work_order
  "gridPosition": {"x": 0, "y": <y>, "cols": 15, "rows": 3} }   ← a SINGLE is one line: 3 rows; it may share a row (0.8)
```

- **Every `BO` field carries all three**: `oldRefBoId` (the target), `boRefStruct.boInfo` (the target's
  code, name, category) and at least one `fieldRefs` entry with `toShow: true`. A helper that writes
  `"boRefStruct": {"fieldRefs": {}}` for every reference ships references that point at nothing or render empty.
- **`linkedFieldCode` sits INSIDE `boRefStruct`**, never at the top level, and each end names the OTHER
  end's field code — a field that EXISTS on the other BO and names this one back. `Automobile.history`
  `TABLE` with `linkedFieldCode: "automobile"` needs a field `automobile` on `Work_order` whose own
  `linkedFieldCode` is `"history"`. One back field serves only one field.
- `fieldRefs` keys are field CODES of the TARGET BO; at least one `toShow: true` (0.9 rule 15) — without it
  the reference renders empty.
- **Columns by meaning, unasked.** A `TABLE` shows **2–5** columns, `orderIndex` 0, 1, 2 …: what the line
  is (работа, запчасть, автомобиль), then the values a user checks at a glance — количество, цена, сумма,
  дата, статус. A table of one column is a defect. A `SINGLE` chip shows the name, plus one field that
  tells two records apart (номер, дата, госномер) when the name alone does not.
- **Line order**: for a pair that points both ways the order does not matter `[C]` — so mint ALL BO `oldId`s
  from their seeds (0.7) before building any field, and fill both ends from those ids. A builder that
  records ids only as it emits lines writes the header's `TABLE` before its line BO exists → `oldRefBoId: ""`.
- A one-way reference (a lookup with no back list: a record → its dictionary-like catalogue entry) is the
  `SINGLE` field alone, without `linkedFieldCode`.
- A target that is NOT in this archive (it already exists on the stand) needs its stand id and code — 0.2a.
  Settings beyond these (`removeType`, `copyFromFieldCode`, filters): §3 «Reference fields».

### 0.5b A dictionary — `BO_DICTIONARY`

A dictionary is the same two lines of 0.3 + 0.4 with `"category": "BO_DICTIONARY"`, `"gridLayoutPosition":
{"x": 4, "y": 0, "w": 8, "h": 11, "id": "0"}` (the window of a row's card, sized like any form by 0.8a step 7: the
two system fields below are 6 rows, so `h` 11 — every extra field row adds its rows; with `null` a two-field
card opens at 90 % × 90 % of the screen `[C]`), `"dictionaryFields": ["CODE","LABEL"]` and these two REQUIRED system fields as the first entries of
`dynamicFields` (0.9 rule 18 — the importer does not add them and a dictionary without them is broken).
A dropdown on another BO points at it BY CODE (0.5, the `FROM_BO` shape). Its values travel as row lines —
«The values» below.

**`dictionaryFields` is a key of EVERY BO, not a dictionary-only key.** The template of 0.4 already
carries `"dictionaryFields": []` and it stays there on a plain BO, a panel, a composite and a process.
The row above CHANGES its value, it does not ADD the key — deleting it from a non-dictionary is rule 6
of 0.9 all over again: import merges, a missing key keeps whatever the stand already had.

**`dictionaryFields` is the literal `["CODE","LABEL"]`, in capitals** — it is an enum, not a list of
field codes. The two system fields it refers to have the LOWERCASE codes `code` and `label`. Both
spellings appear, and they are not interchangeable: capitals in `dictionaryFields`, lowercase as the keys
of `dynamicFields`.

A dictionary's two system fields — the template of 0.5 with these values, at `y: 0` and `y: 3`,
`cols: 15`, `rows: 3`, `tableColOrderIndex` 0 and 1, `isSystem: true`:

- `code`: `"type": "INPUT_TEXT"`, `"isUnique": true`, `"isRequired": true`,
  `"label": {"rus":"Код","kaz":"Код","qaz":"Kod","eng":"Code"}`
- `label`: `"type": "INPUT_TEXT_LANG"`, `"isRequired": true`,
  `"label": {"rus":"Значение","kaz":"Мәні","qaz":"Mani","eng":"Value"}`

Dictionary row codes are **case-sensitive** (`MRP` ≠ `mrp`).

**The values — one `ExportStructInstanceDto` line per row** `[C]`. Ship every value the spec names or
implies (0.2c step 5); a dictionary without row lines opens every dropdown on it empty. Copy the line,
change the `←` values, one line per row, minified to ONE line (0.9 rule 3), placed right AFTER the
dictionary's BO line:

```text
{"@class":"kz.greetgo.mybpm.reg.structure.model.dto.ExportStructInstanceDto",
 "compositeId":"<D>-<R>",                       ← <D> = the dictionary's oldId, <R> = the row id (0.7, seed = salt + dictionary code + row code)
 "boCode":"Car_brand",                          ← the dictionary's code
 "kind":"GENERAL",
 "fieldMap":{
   "code":{"type":"INPUT_TEXT","storedValue":"toyota","isUnique":true,"showTable":true,"orderIndex":2147483647,"kind":"GENERAL"},      ← the row code (0.6a)
   "label":{"type":"INPUT_TEXT_LANG","storedValue":"{\"RUS\":\"Toyota\"}","isUnique":false,"showTable":true,"orderIndex":2147483647,"kind":"GENERAL"}}}   ← the text the dropdown shows: a JSON STRING, key RUS in capitals
```

- The stand keeps `<R>` as the record id `[C]`, the registry shows `code` and `label` as sent, and every
  `FROM_BO` dropdown on the dictionary lists the row at once. A rollback of the import deletes the rows `[C]`.
- `sources` is not needed — a row line with no `sources` key, with `[]` and with a `DEFAULT_VALUE` source all
  land the same `[C]`. Count every row line in `objectCount`.
- `label.storedValue` is the language map as a JSON TEXT (`"{\"RUS\":\"…\"}"`), not an object; `code.storedValue`
  a plain string. An extra field of the dictionary goes into `fieldMap` under its code with its own `type` `[I]`.
- **The dropdown does not keep the file order** `[C]` — the rows come out in the stand's own order; there is
  no known key that sets it `[U]`.
- **A dropdown default on a dictionary row does not work** `[C]`: `"defaultValue": "<R>"` on a `FROM_BO`
  field is stored, but the create form does not preselect it. Do not ship one; a field that needs a preset
  value gets it from a hook (§5d) or is a local list with its `defaultValue` (0.5).
- Rows only for a dictionary THIS archive creates. The values of a dictionary already on the stand are
  records — the xlsx of Part III.


### 0.5c Kanban card template — one per dropdown

**Every `DROPDOWN_SINGLE` of a BO gets an entry in that BO's `kanbanCardTemplates`, even when nobody asked
for a kanban** `[C]` (0.9 rule 16): without it the BO's kanban, map and kanban editor die with
«cardTemplate is null» once a record exists. The outer key is the dropdown's code (its options become the
columns), the inner keys are the fields shown on the card:

```text
"kanbanCardTemplates": {
  "Status": {                          ← CODE of the DROPDOWN whose options become the columns
    "kanbanFields": {
      "Naimenovanie": {"cardOrderIndex": 0, "locationType": "HEADER",  "archetype": "DYNAMIC"},
      "Ispolnitel":   {"cardOrderIndex": 0, "locationType": "CONTENT", "archetype": "DYNAMIC"},
      "CREATED_BY":   {"cardOrderIndex": 1, "locationType": "CONTENT", "archetype": "NATIVE"},
      "Kommentariyi": {"cardOrderIndex": 0, "locationType": "FOOTER",  "archetype": "DYNAMIC"}
    }
  }
}
```

- The outer key is the code of a `DROPDOWN_*` field of THIS BO; one entry per field you want to offer as
  a kanban (a BO may carry several). Never a text, number or `BO` field — and a BO with no dropdown keeps
  `"kanbanCardTemplates": {}`.
- A constructor-made BO exports `kanbanCardTemplates.<dropdown code> = {kanbanFields:{}}` — an empty card; fill
  `kanbanFields` in that line and re-import the one-BO archive: the BO is updated in place (same id, records kept) `[C]`.
- The inner key is the CODE of the field shown on the card — a key of `dynamicFields` with
  `archetype: "DYNAMIC"`, or a key of `nativeFields` (the native type itself) with `archetype: "NATIVE"`.
  Ids never appear here, exactly like everywhere else in a `BoStructDto`.
- `locationType` is `HEADER` | `CONTENT` | `FOOTER`; `cardOrderIndex` orders the fields inside one
  location and is a plain int.
- **Column colours live on the dropdown, not here**: each option's `fieldOption.color` (0.5) — a CSS colour
  name in any case (`RED`, `green`) or hex (`#0048ff`, `#0f0`) `[C]` — colours that column's title and bar;
  `null` = black title, default blue bar. Give statuses colours when the spec names them or implies them
  (new = blue, done = green, cancelled = grey `#9e9e9e`); avoid light ones (`YELLOW`), they are unreadable on white.
- `tools/make-probe-archive.bun.ts --kanban "Статус:HEADER=Наименование;CONTENT=Исполнитель,CREATED_BY;FOOTER=Комментарий"`
  writes exactly this.

The smallest valid template is one `HEADER` field — the BO's name field. Where the board is shown (the
BO's own registry offers it by itself; a menu item needs `kanbanFieldCode`, 0.5d) and the rest: 0.14.

### 0.5d Sidebar menu lines — `MenuItemStructDto`

Lines AFTER the BO lines. A menu item is NAVIGATION: a row in the sidebar that opens a BO's records, or a
folder (`GROUP`) holding such rows. One line per item; a group and the items inside it are separate lines.
**Everything is referenced BY CODE** — the parent group, the BO, the kanban field — and a menu line has
**no id at all**. Copy the templates literally and change only the values marked `←`. (`@class` is
`…model.dto.MenuItemStructDto` — there is no «Sidebar» class, and `menuItemType` is `BO` or `GROUP`.)

**An item that opens a BO** — the list view only, at the root of the sidebar `[C]`:

```json
{"@class":"kz.greetgo.mybpm.reg.structure.model.dto.MenuItemStructDto",
 "menuItemCode":"Requests",                  ← your code, latin, unique among MENU codes
 "menuItemName":"Заявки",                        ← the text in the sidebar
 "boCode":"Request",                             ← the BO's `code`
 "boName":"Заявки",                              ← the BO's `name.rus`
 "iconName":"phosphor:clipboard-text",          ← an icon BY MEANING, 0.5d «Icons by meaning»
 "orderIndex":950000,                            ← position among its siblings
 "boPages":{"isKanbanEnabled":false,"kanbanIndex":0,
            "isCalendarEnabled":false,"calendarIndex":0,"isTimelineEnabled":false,"timelineIndex":0,
            "isListEnabled":true,"listIndex":1,
            "isMapEnabled":false,"mapIndex":0,"isGroupingEnabled":false,"groupingIndex":0},
 "chosenAccessRight":false,"needCountMenuItem":false,"isPanel":false,"needHideInMobApp":false,
 "bracketFilter":{"boCode":"Request","type":"MENU_ITEM","brackets":{}},
 "menuItemType":"BO"}
```

(This list-only shape is what the stand EXPORTS for such an item, and it IMPORTS as is `[C]`.)

**A group** (a folder in the sidebar) — in a system build of more than ~5 items, one per theme (0.2b step 4); otherwise when the user wants the items grouped:

```json
{"@class":"kz.greetgo.mybpm.reg.structure.model.dto.MenuItemStructDto",
 "menuItemCode":"Probe_menu",            ← your code
 "menuItemName":"Проба меню",          ← the text in the sidebar
 "iconName":"phosphor:folder",        ← an icon BY MEANING, 0.5d «Icons by meaning»
 "orderIndex":950000,
 "chosenAccessRight":false,"needCountMenuItem":false,"isPanel":false,"needHideInMobApp":false,
 "menuItemType":"GROUP"}
```

To put a BO item inside the group, add `"parentMenuItemCode":"<the GROUP's menuItemCode>"` to the item
(right after `menuItemName`); without the key the item is a root.

**`boPages` = the views of the item**: all twelve keys always written; `*Index` = the tab position,
1-based, over the ENABLED views only. The kanban variant (kanban first tab, list second) `[C]`:

```text
"boPages":{"isKanbanEnabled":true,"kanbanIndex":1,
           "isCalendarEnabled":false,"calendarIndex":0,"isTimelineEnabled":false,"timelineIndex":0,
           "isListEnabled":true,"listIndex":2,
           "isMapEnabled":false,"mapIndex":0,"isGroupingEnabled":false,"groupingIndex":0,
           "kanbanFieldCode":"status"}          ← code of a DROPDOWN of that BO = the columns
```

Rules `[C]`:

- **A `GROUP` line carries NO `boPages`, NO `bracketFilter`, NO `boCode` / `boName`.** A `BO` line carries
  both `boPages` and `bracketFilter`; `bracketFilter.boCode` repeats `boCode`, `brackets: {}` = every record.
- `kanbanFieldCode` appears ONLY when the kanban is on; it is a `DROPDOWN_SINGLE` of that BO AND a key of
  its `kanbanCardTemplates` (0.5c). **A BO with a `status` dropdown opens its kanban by `status`** — another
  dropdown (a service type, a category) only on a SECOND item of the same BO beside the status one.
- `boCode` names a BO of THIS archive, or a BO already on the stand (a stand code — ask, 0.2a). The same for
  `parentMenuItemCode`: a `GROUP` line of this archive, or a group code given by the user — never guessed.
- Put the `GROUP` line BEFORE its children. `orderIndex`: the built-in root «Системные» is 60000 — put
  your roots after it (950000), children count inside their parent (10000, 20000 …).
- `iconName`: **every line gets an icon BY MEANING, without being asked** — each group by ITS OWN theme
  (Клиенты и авто → `phosphor:address-book`, Работы → `phosphor:briefcase`, Склад → `phosphor:archive`), never the one icon
  of the whole system on every group; each item by what its records are (клиенты → `phosphor:users`,
  заказ-наряды → `phosphor:wrench`, оплаты → `phosphor:money`); each dictionary by what it LISTS (марки →
  `phosphor:car`, посты/боксы → `phosphor:buildings`, виды топлива → `phosphor:gas-pump`, причины отказа →
  `phosphor:warning`, единицы → `phosphor:ruler`), `phosphor:book` only when nothing in the table fits.
  **Two `GROUP` lines never share an icon, a `GROUP` never takes the icon of one of its own items, and three or
  more siblings with one icon is a defect** (the lint of 0.10 reports all three, and checks every name against
  0.16 when it is given this document). Take the name from the table below (or from 0.16) WITH its prefix; never compose
  one from memory — the importer accepts any string and the sidebar shows an EMPTY place for a wrong one.
  Two items of one group should differ. In the report list «item → icon» so the user can change them. The
  generic defaults `bo-g-draggable` (group), `man-with-company` (BO), `bo-d-draggable` (dictionary) only
  when the user asked for no icons.

  **Icons by meaning** `[C]` — all names exist on the stand (0.16 has the full 1153):

  | Meaning | `iconName` |
  |---|---|
  | people, clients, contacts, staff | `phosphor:users`, `phosphor:user`, `phosphor:user-circle`, `phosphor:address-book`, `phosphor:identification-card`, `phosphor:handshake` |
  | vehicles, transport, delivery | `phosphor:car`, `phosphor:truck`, `phosphor:bus`, `phosphor:airplane`, `phosphor:gas-pump` |
  | work, service, repair, tasks | `phosphor:wrench`, `phosphor:gear`, `phosphor:clipboard-text`, `phosphor:list-checks`, `phosphor:kanban`, `phosphor:note-pencil` |
  | money, payments, invoices | `phosphor:money`, `phosphor:wallet`, `phosphor:credit-card`, `phosphor:receipt`, `phosphor:coins`, `phosphor:currency-rub`, `phosphor:bank`, `phosphor:calculator` |
  | goods, stock, purchases, suppliers | `phosphor:package`, `phosphor:shopping-cart`, `phosphor:storefront`, `phosphor:archive-box`, `phosphor:barcode`, `phosphor:tag`, `phosphor:factory` |
  | documents, contracts, folders | `phosphor:file-text`, `phosphor:files`, `phosphor:folder`, `phosphor:folder-open`, `phosphor:briefcase`, `phosphor:notebook` |
  | dictionaries, catalogues | `phosphor:book`, `phosphor:books`, `phosphor:list-bullets` |
  | schedule, appointments, time | `phosphor:calendar`, `phosphor:calendar-check`, `phosphor:clock`, `phosphor:timer` |
  | places, branches, objects | `phosphor:house`, `phosphor:buildings`, `phosphor:map-pin`, `phosphor:globe` |
  | calls, mail, chats, campaigns | `phosphor:phone`, `phosphor:envelope`, `phosphor:chat`, `phosphor:megaphone` |
  | reports, analytics | `phosphor:chart-bar`, `phosphor:chart-pie`, `phosphor:chart-line-up`, `phosphor:trend-up` |
  | medicine, education, food, hotel | `phosphor:first-aid`, `phosphor:heartbeat`, `phosphor:pill`, `phosphor:graduation-cap`, `phosphor:student`, `phosphor:fork-knife`, `phosphor:bed` |
  | IT, equipment, quality, risks | `phosphor:desktop`, `phosphor:database`, `phosphor:shield-check`, `phosphor:star`, `phosphor:warning` |
- **A `menuItemCode` that already exists on the stand is an EDIT of that item** `[C]`: the import overwrites
  its name, order, views and filter in place, keeping its id. Your codes must be new to the stand — never
  reuse a code seen there unless the user asked to change THAT item; a re-import of your own archive
  updates your items instead of adding second ones.
- Calendar, timeline and map views, menu rights, a menu-only archive: 0.15.

### 0.6a Naming convention for new codes

Every code you write yourself — in an archive, in `!code=`, in a «Изменить код» rename — is **English**
(translate the meaning, do not transliterate), `snake_case`, latin letters, digits and `_` only:

| What | Rule | Example |
|---|---|---|
| Field, widget (`dynamicFields`, `signatures`, `buttons`, `iframes`, `captcha`, `currentDates`, `currentUser`) | lower case | `client_name`, `sign_contract` |
| `CHECKBOX` field | `is_*` | `is_active`, `is_paid` |
| `TAB_GROUP` widget | `tabs` when the BO has one, `tabs_*` when it has several | `tabs`, `tabs_finance` |
| Tab (`fieldTabs` key, `tabCodePath.tabCode`) | `tab_*` by meaning, not by number | `tab_main`, `tab_documents` |
| Object — BO, dictionary, composite, process, panel | first letter capital, the rest lower | `Client_order` |
| Option of `DROPDOWN_SINGLE` / `RADIO_BUTTON_GROUP`, `QUESTIONNAIRE` row / column, `PROGRESS_BAR` step | lower case, like a field | `in_progress`, `has_car`, `draft` |
| BO group (`BoGroupStructDto.code`) | like an object | `Sales` |
| Menu item (`menuItemCode`) | like an object | `Client_orders` |
| Exposed-service code (the URL part) | lower case, like a field | `create_order` |

- **At most 30 characters.** Shorten a longer code by meaning (`contract_signing_date_planned` →
  `planned_signing_date`), never by cutting it from the right as the stand does.
- **Codes the platform fixes stay as they are**: `CODE` / `LABEL` of a dictionary, `PROCESS_STATUS`, the
  `nativeFields` ids, and a `CHECKLIST` item has no code at all (`defaultValue` `[{label,checked}]`).
- **Codes that already exist on a stand are never renamed** to fit the convention: scripts, kanban
  templates, menu items, composites and `tabCodePath` reference them by code. The convention is for NEW
  codes only; a reference to an existing object uses its real code, whatever it looks like.
- **An archive applies the convention at once.** The constructor and the API do not: `create-bo` takes no
  code and every new field, option and tab gets the transliteration of 0.20. Built that way, rename each code
  right after creating it (`MYBPM-UI-API.md` §5j «code» for a BO, `save-business-field-code` for a field;
  an option's code is kept as sent when the field is patched) — before any script, template or menu item
  refers to it.

### 0.7 Ids

Every `oldId` / `newId` is a **16-character** string over the alphabet
`A-Z a-z 0-9 @ ~` (e.g. `WbX5Wa8gcabbVbF1`, `3H84o9iM@G4jaOL3`, `Q0zI~z9Ra2R7Q3yd`). **Those three are
`<company-a>`'s — they show the shape, they are not values to copy** (0.2a).

- **Derive them deterministically from a seed** — take sha256 of the seed and map the first 16 bytes onto
  the alphabet (byte % 64 → `A-Za-z0-9@~`). Reason: the stand keeps the archive's `oldId` as the BO's REAL
  id, so a re-import of a regenerated archive UPDATES the same BO instead of creating a duplicate. Random ids
  fork the object on every re-import.
- **Every seed starts with the build salt** — a short random string (e.g. `k7f2`) you pick ONCE at the
  start of a new build and reuse for every later build of the same system in the same conversation. Without
  it the code alone decides the id, and every build from scratch of a «Client» mints the SAME id — which the
  stand still remembers after a rollback or a deletion (§8 «A deleted BO comes back»).
- **One seed per id, unique across the WHOLE file** — the seed names everything that makes the id
  unique, never the code alone (field and option codes repeat between BOs: `work_order`, `status`):

  | Id | Seed |
  |---|---|
  | group `oldId` / `newId` | `salt + ".group." + code` / `salt + ".group-new." + code` |
  | BO `oldId` | `salt + ".bo." + BO code` |
  | field `newId` | `salt + ".field." + BO code + "." + field code` |
  | option `newOptionId` | `salt + ".opt." + BO code + "." + field code + "." + option code` |
  | tab `newId` | `salt + ".tab." + BO code + "." + tab code` |
  | dictionary row `<R>` (0.5b) | `salt + ".row." + dictionary code + "." + row code` |
- **Which ids: a new build or an amendment** — decide before minting anything:
  1. **An archive or a stand export is attached** and the user asks to change or extend it → it is an
     amendment. Every object already in that file — group, BO, field, option, tab, dictionary row — keeps its
     id AND its code exactly as the file has them, whoever built the file and whatever its ids look like.
     Edit that file's lines; never rebuild an existing object from memory (a single mistyped id makes a
     duplicate instead of an update). Only what is NEW gets ids, from a fresh salt of this build.
  2. **Nothing is attached, but you built the archive earlier in THIS conversation** and the user asks to
     change it → also an amendment: take your own last archive (the file you produced) and edit it as in 1.
     If that file is gone, regenerate with the SAME salt you reported (0.11) and the SAME codes — the
     formula then gives every unchanged object its old id.
  3. **The user asks to amend, but there is neither a file nor a salt of yours in the conversation** → ask
     for the last archive or a stand export of those BOs. Never start over with a new salt silently: every
     object would come in as a duplicate.
  4. **A build from scratch** (the first build of the conversation, or the user says «заново», «с нуля»)
     → a NEW salt, even when an earlier attempt of the same system was imported and rolled back or deleted.
  In an amendment never rename the code of an existing field or BO: a new code is a new seed, a new id,
  and the old field stays on the stand beside the new one.
- Which ids must be equal:
  - `BoStructDto.boGroupOldId` **=** `BoGroupStructDto.oldId`;
  - `BoProcessVersionsStructDto.oldId` **=** `BoStructDto.oldId` (processes only);
  - everything else is simply unique inside the archive.
- Field ids use `newId` (not `oldId`); the BO and the group use `oldId` (the group also carries a
  `newId`, any unique value).
- **A re-import matches the BO by `oldId` and its fields by `newId`, NOT by code** `[C]` — keep both fixed
  between builds of the same object (the same salt and code, or the ids of the given file, as above). What a
  re-import does to an existing BO, and to one that was rolled back or deleted: §8 «Re-import of the same ids».

### 0.8 Layout in one rule

The form is a grid **15 columns** wide, and it **compacts vertically** — a hole is eaten and the cells
below float up. Lay the form out in ROWS `[C]`:

> A row is one or more cells side by side with the SAME `y` and the SAME `rows`. The first cell has
> `x: 0`, each next one `x` = the previous `x` + the previous `cols`, and the `cols` of a row sum to
> **15**. The first row starts at `y: 0`, the next row's `y` = this row's `y` + its `rows`. Fields on a tab
> count `y` from 0 again, separately per tab (0.5 `TAB_GROUP`).
>
> `rows` = **3** for a one-line input (`INPUT_*`, the date and time types, `DROPDOWN_SINGLE`, `CHECKBOX`),
> a one-line `STATIC_TEXT` heading and a `BO` / `CO` `SINGLE` reference; **6** for `TEXTAREA` /
> `TEXTAREA_LANG` (4 shows only about two lines of text), a `BO` `TABLE`, `LINK`, `FILE_UPLOAD`, `CHECKLIST`,
> `RADIO_BUTTON_GROUP`, `PROGRESS_BAR`; **8** for `QUESTIONNAIRE` / `GEO_POINT`; a `TAB_GROUP` = its
> tallest tab + 3, + 5 on `instanceViewType: "TAB"` (0.8a).

A dictionary's two system fields «Код» and «Значение» are the exception to everything below: each alone
in its row at `x 0, cols 15` (0.5b), so the two boxes have one width — never «Код» at cols 8 under a cols-15 «Значение».

**Which fields share a row — decide it by meaning, unasked.** Short one-line fields that belong together
stand 2 per row (`cols` 8 + 7) or 3 per row (5 + 5 + 5): телефон + email, марка + модель + год, дата +
сумма + оплачено, a `SINGLE` reference + a dropdown. A form whose every field is full width is a defect —
each box stretches over 1000+ px for a 20-character value. **Full width, alone in the row:** `TEXTAREA` /
`TEXTAREA_LANG`, a `BO` `TABLE`, a `STATIC_TEXT` heading, a `TAB_GROUP`, `CHECKLIST`, `QUESTIONNAIRE`,
`GEO_POINT`, `PROGRESS_BAR`.

**Building the file with a script? Give it the layout as a list of ROWS, never as a list of fields.** Per
form (and per tab) write the rows you decided by meaning — e.g. `[["phone", "email"], ["make", "model",
"year"], ["notes"]]` — and let the script derive `x`, `cols` and `y` from them: one code → `cols 15` (a short
field alone → `x 0, cols 8`), two → 8 + 7, three → 5 + 5 + 5, the next row's `y` = this `y` + its `rows`. A
loop over the fields that gives each one `x 0, cols 15` and `y += rows` builds exactly the «every field full
width» defect, however the rows were planned.

- **A short field with no partner by meaning stands alone at `x: 0`, `cols: 8`** — never stretched to 15; the
  right half stays empty and the row is the one exception to «cols sum to 15». It is an EXCEPTION: **at most 2
  lone short fields per form (per tab)**. Three or more is the «one field per row» defect, cols 8 or not —
  find their partners by meaning (контакты, суммы, даты, техданные). The hole is safe only while no
  cell of the NEXT row fits wholly into columns 8–14: such a cell floats up beside the lone field, and the rest
  of the form follows it `[C]` (§4 «The grid compacts VERTICALLY» — a cell stops at the first cell above in its
  own columns). So right below a lone field put a full-width row, or a pair split **7 + 8** (its right cell
  starts at `x: 7` and touches the lone field's columns), or nothing (the last row of the form or the tab);
  never an 8 + 7 pair or a 5 + 5 + 5 row there.
- **Never mix heights inside a row**: a 3-row cell beside a 6-row one leaves a hole under the short cell,
  and the next row floats up into it (§4 «The grid compacts VERTICALLY»). Pair only cells of equal `rows`.
- A `CHECKBOX` in a row draws its toggle at the TOP of its cell, a little higher than the neighbouring
  input boxes — acceptable; §4 «Checkbox alignment» has the fix if the user asks.
- A row of 2–3 fields wants a wider window: `w: 12` (0.8a step 7).

### 0.8a Layout that looks right — tabs, groups, the window, the system tab

Apply this to EVERY BO with a form, unasked. The goal: no field stretched over empty space, no wasted
band, and **no scroll inside a scroll** — the window does not scroll, a tab group does not scroll inside
the window, a field does not scroll inside itself. «Visible field» below = a field a user of the form
sees, not counting headings, the `TAB_GROUP` itself and the system fields of step 1.

1. **System fields go to the hidden tab «Системные».** A field that only a script, a process or an
   integration reads or writes (an external id, a technical flag, a service sum) is a system field. Put
   every one on a tab with code `tab_system`, label «Системные», the LAST tab of the form's top-level
   `TAB_GROUP` (`isDefault: false`, `chosenAccessRight: true`), and ship the tab rule «никому» (step 6).
   A form with no other tabs gets a `TAB_GROUP` holding only that tab, placed UNDER the ordinary fields.
   A non-admin does not get such a lone group at all — the form drops a `TAB_GROUP` none of whose tabs
   they may see `[C]`; the window keeps the `h` that counts it (admins see the group), so they see an empty
   band of the group's height under the fields `[I]` — keep the system tab short. Never put a field a user
   must fill there.
2. **Groups.** When the visible fields fall into two or more themes, open each theme with a heading: a
   `STATIC_TEXT` with `"staticValue": {"rus": "<div style=\"font-size:18px;font-weight:700;color:#1f2d3d;border-bottom:1px solid #d9dee5;padding-bottom:6px\">Тема</div>"}` (0.5), `hideLabel: true`,
   `tableColToShow: false` (else every heading is an empty registry column) and `rows: 3` `[C]` (2 rows
   scrolls inside itself; a heading WITH a subheading line needs 4). A group = its heading and the
   fields under it, up to the next heading or the end of the form / tab. The heading text names the
   SECTION, never a field label of the BO (0.9 rule 12). **One heading over the whole form (or tab) groups
   nothing** — it only repeats the window title: two or more headings, or none. **Every heading has at least one
   field under it** before the next heading or the end of the form / tab — a heading with nothing below it is
   not a group, never add one to reach «two headings».
3. **Tabs** when the form has **more than 12 visible fields**, or is taller than one window (step 5:
   more than ~23 rows) — **also on `instanceViewType: "TAB"`**: a page tab does not replace tabs inside the
   form. Split by meaning — «Общее», «Финансы», «Документы» — each tab ≤ 12 visible fields,
   and **balance the tabs**: the group is as tall as its TALLEST tab `[C]`, so a short tab shows an empty
   band under its fields. Keep the name field (and what a user scans first) outside the tabs, above the
   group, or on the first, default tab. **The status dropdown sits in the header row beside the title field**
   (number + status, same `y`), never inside a tab. Tab codes `tab_*`, group code `tabs` (0.6a). **A tab holds at least
   2 fields** — one field is a group heading's job, not a tab's; and **name each tab by what IT holds** on
   THIS BO («Работы», «Запчасти», «Оплаты»), never one label set copied onto every BO.
4. **Nested tabs — rarely.** Only when ONE tab still holds more than 12 visible fields AND at least
   3 groups: turn its groups into the tabs of a second `TAB_GROUP` placed on that tab (its own
   `tabCodePath`; its tabs are drawn as a vertical list on the left). Otherwise use groups (step 2).
5. **Heights** `[C]` (one grid row = 30 px):
   - one-line input: 3 rows (label + box = 58 px; 4 rows leaves a band); heading: 3 rows (step 2);
   - top-level `TAB_GROUP`: `rows` = (rows of its tallest tab) + **3** in a dialog (`FORM`), + **6** on a page
     tab (`instanceViewType: "TAB"`) — a tab of `n` rows needs `n·30 + 28` px (a `TEXTAREA` counts its rows,
     nothing extra), and the group's box is `rows·30 − 61` px in a dialog but `(rows − 1)·30 − 111` on a page tab
     (+ 5 scrolls there); one row less scrolls inside the group;
   - nested `TAB_GROUP` (on a tab of another group): `rows` = (its tallest tab) + **2**;
   - «rows of a tab» = the bottom of its lowest cell (`max(y + rows)` of the fields on it).
6. **The system tab rule.** A tab carries ONE right only — VIEW (`[C]`; edit follows from it) — and «никому»
   (`view.denyAll: true`, empty `orgUnitIds`) hides the tab AND its fields' registry columns from every
   non-admin user; a non-admin who edits and saves the record keeps the hidden values `[C]`. **Hidden is not secret** `[C]`: the rule only filters what the form and the registry draw —
   a non-admin still reads the tab's values through the API by its tab id (`v2/business-object-instance/v2/load-boi-values` with `tabId`, `v2/instance-form/load-field-structure-tab` + `v2/instance-field-form/load-field-data-tab`). Never put a password, a key or a personal secret on «Системные». **An admin
   always sees the tab** `[C]` — admins bypass rights; say so to the user, «hidden from everyone» cannot
   cover admins. The rule travels in an `AccessStructDto` (§7), and an `AccessStructDto` REPLACES the
   BO's whole rights (0.9 rule 10), so:
   - **a NEW BO** — ship one `AccessStructDto`: every action of `boAccessStruct` open and the tab rule,
     the line printed below `[C]`;
   - **an EXISTING BO** — take its `AccessStructDto` line from a FRESH export of the stand and add only
     `fieldAccessStructMap.<tabs code>.tabAccessStructMap.tab_system` to it; never rebuild it from the
     template (that opens what the stand had locked).
7. **The record window** (`gridLayoutPosition`, 0.4) `[C]`: the dialog is exactly `h·30` px tall and
   `w/16` of 90 % of the browser width; its title and buttons take 99 px, so **`h` = form rows + 5**
   (form rows = `max(y + rows)` of the top-level cells, a `TAB_GROUP` counted with its own `rows`). The
   dialog is capped at 90 % of the screen height — about 28 units on a 1080p screen — so a form of more than
   ~23 rows cannot fit: cut it with tabs (step 3). Without `gridLayoutPosition` the dialog opens at
   90 % × 90 % of the screen with a band of empty space. A dictionary has a window too (0.5b): two system
   fields → `w: 8`, `h: 11`.
   **Width**: a text input FILLS its cell (§4), so a 15-column field in a full-screen window is a
   1600 px box for a 20-character value. A form of one-line fields: `w: 10` (≈ 1050 px on a 1080p screen).
   `w: 12`–`15` only for a form that carries tables or several fields per row. Centre it:
   `x = ceil((16 − w) / 2)`.
   **A child window is smaller than its parent**: a BO opened from another BO's reference or table gets
   `w` at least 2 less than the parent's and its own `h` by the same formula. This holds between two `FORM`
   dialogs only; a `TAB` record (step 8) has no window.
8. **Page tab instead of a dialog**: `instanceViewType: "TAB"` when the record has a lot of content — several
   tables, or still more than ~23 rows after tabs — then the record opens as a page tab of the browser
   window; otherwise `FORM` with the window of step 7. It is a property of the BO: a record opens as a tab
   everywhere, also when it is added or opened from another record's table `[C]`. So a big document (заказ-
   наряд with works and parts) is `TAB` and keeps its «Добавить» on the parent's table; in a chain of 3–4
   levels where each dialog cannot be narrower than the one before, the biggest level is `TAB`.

The `AccessStructDto` of step 6 for a NEW BO — one line; `<O>` is the OPEN action and `<N>` the «никому»
action, write them out in full (the `@class` package is `model.access`, not `model.dto`):

```text
<O> = {"denyAll":false,"participants":false,"authorsField":{"content":false,"head":false,"author":false,"employees":false,"department":false,"parentDepartment":false,"childDepartment":false,"fieldCodes":[]},"fromFields":{},"orgUnitIds":[]}
<N> = the same with "denyAll":true

{"@class":"kz.greetgo.mybpm.reg.structure.model.access.AccessStructDto","boCode":"<BO code>","boName":"<BO name>","boCategory":"BO",
 "boAccessStruct":{"denyAll":false,"all":<O>,"create":<O>,"view":<O>,"edit":<O>,"delete":<O>,"archive":<O>,"export":<O>,"duplicate":<O>,"add":<O>},
 "fieldAccessStructMap":{"tabs":{"tabAccessStructMap":{"tab_system":{"denyAll":true,"all":<O>,"create":<O>,"view":<N>,"edit":<O>,"delete":<O>,"archive":<O>,"export":<O>,"duplicate":<O>,"add":<O>}}}}}
```

Minify it to one line like every other line (0.9 rule 3); `"tabs"` is the `TAB_GROUP` code, `boCategory`
the BO's category. Count it in `objectCount`.

### 0.9 Hard rules — violating any one of these breaks the import

1. Every `BoGroupStructDto` carries a `code` — the stand matches groups BY `code`; a line without one
   RENAMES a fixed stand group (0.3, §8). Several group lines are fine when each has its own `code`.
   A line for an EXISTING group repeats that group's `name` and `orderIndex` exactly — the import
   overwrites both (0.3). `kind` is `MANUAL`: a `DEFAULT` group created by import can never be deleted (0.3).
   The exception is the stand's general group «Общее» (code `General`, `kind: DEFAULT`): its line repeats
   `DEFAULT` — `MANUAL` demotes it and the built-in BOs vanish from the BO list (0.3).
2. `objectCount-<N>` in `metadata.mybpm` equals the line count of `0000001.mybpm`.
3. JSONL: one minified JSON object per line; no array wrapper; UTF-8; final newline.
4. Every line carries its `"@class"` with the full package
   `kz.greetgo.mybpm.reg.structure.model.dto.<DtoName>` — except `AccessStructDto`, which lives in
   `kz.greetgo.mybpm.reg.structure.model.access` `[C]`.
5. `dynamicFields` is an object keyed by field code, and the key equals the field's `code`. Every key the
   BO template (0.4) writes as `{}` stays an OBJECT — `boTabs`, `nativeFields`, `kanbanCardTemplates`,
   `staticValue`, the widget maps — never `[]`; only `bos`, `printForms`, `dictionaryFields` are lists. A
   `[]` in place of `{}` makes the stand drop the whole BO with no error of its own: the analysis shows only
   «Не найден бизнес-объект для пункта меню» on the menu items that open it `[C]`.
6. Never drop a key to disable something — write `false`. Import MERGES into what is on the stand. The
   only keys ever legitimately absent are `gridPosition` / `tableColOrderIndex` / `removeType` inside a
   `BO_COMPOSITE`, which has no form (0.17, §5b), and `tableColOrderIndex` / `removeType` on a process's
   `PROCESS_STATUS`, copied as 0.18 prints it.
7. Codes ≤ 30 characters, latin letters, digits and `_`, named by the convention of 0.6a.
8. Ids are 16 chars over `A-Za-z0-9@~`, deterministic, and the three equalities of 0.7 hold.
9. `isRequired` + `isReadonly` both true = an unsaveable record.
10. Do not ship an `AccessStructDto` unless asked: import APPLIES it and **replaces** the rights set by
    hand on the stand with the archive's (§7, §8). Its `orgUnitIds` are `G-<group id>` of the TARGET
    stand — ids from another stand grant nothing. **The one exception is the hidden system tab of 0.8a
    step 6**: a new BO ships the all-open line printed there, an existing BO its freshly exported line plus
    the `tab_system` rule.
11. Records (instance data) do NOT go into this archive — they are an xlsx, **Part III** of this document.
    The one exception is the values of a dictionary this archive creates: they travel as its row lines (0.5b).
12. A `STATIC_TEXT` heading must not repeat any field label of the same BO (0.5). «Контакты» as a
    heading над полем «Контакты» breaks the Excel import of records (Part III, §19): the header row is
    matched against ALL fields including the headings, and the column becomes ambiguous. Name the
    heading for the SECTION («Контактные данные»), not for the field under it.
13. A field goes into the map that matches its ARCHETYPE: an ordinary field into `dynamicFields`, a
    «системное поле» into `nativeFields` (0.12), a widget into `signatures` / `buttons` / `iframes` /
    `captcha` / `currentDates` / `currentUser` (0.13). Putting a widget or a native type into
    `dynamicFields` is not a valid archive.
14. A menu line (0.5d) names its parent, its BO and — only when a kanban is on — its column field BY
    CODE, and carries no id.
    A `GROUP` line has no `boPages` / `bracketFilter`; a `BO` line has both. A `kanbanFieldCode` whose BO
    carries no card template for that field gives a kanban that cannot be drawn (0.5c).
15. **Every BO shows at least one field in its registry** (`tableColToShow: true` on at least one
    field) **and every `BO` / `CO` reference field shows at least one field of its target**
    (`boFieldCodes` / `boFieldRefs` with `toShow: true`). Without a column the registry answers `AccessDenied` and lists nothing; without a
    shown field the reference renders empty (`MYBPM-UI-API.md` §0U.5 rule 11, traps 48 and 53).
16. **Every `DROPDOWN_SINGLE` of a BO has a kanban card template** — `kanbanCardTemplates.<dropdown code> =
    {"kanbanFields": {"<a field code>": {"cardOrderIndex": 0, "locationType": "HEADER", "archetype": "DYNAMIC"}}}`,
    even when no kanban was asked for. Without it the BO's map, kanban and kanban editor die with «cardTemplate
    is null» once a record exists (0.5c, 0.14, §2 «BO views», trap 32).
17. **Every BO line has a numeric `orderIndex` of its own** — a missing one lands as `null` (top of the group),
    and the template's 47480000 shared by several BOs makes them impossible to reorder by drag; a re-import also
    MOVES an existing BO to the archive's group and place (§2 «BO place in the sidebar»).
18. **The platform's mandatory system fields are always shipped.** Every business process (`BO_PROCESS`) carries `PROCESS_STATUS` (§5c: `type: "BO"`,
    `isSystem`, `isRequired`, `defaultValue` = the `CREATED` row + its `DEFAULT_VALUE` line); every
    dictionary (`BO_DICTIONARY`) carries `code` and `label`, both `isRequired` (0.5b). The importer does not
    add them and does not complain when they are missing — the archive looks fine and the object is broken.
    Its ids are resolved by code on import (0.2a), so nothing stops you shipping it — never a process without it.
19. **A BO that already exists on the stand is changed only through its fresh export line**, never through a
    line rebuilt from the template of 0.4 — that resets its header settings and moves it (0.2a, last row; how to
    take the export: §2 «Taking a fresh export — the minimum»). An import never deletes a field, tab or option (§8).

> **Reading in chunks? Keep going** to «0.11 Building the zip» — the self-check and the zip
> steps below are part of the core.

### 0.10 Self-check before shipping

- [ ] `unzip -l` shows exactly two members, both inside one `data-*/` folder.
- [ ] `unzip -p <zip> 'data-*/metadata.mybpm'` prints `objectCount-<N>`, and
      `unzip -p <zip> 'data-*/0000001.mybpm' | wc -l` prints the same N.
- [ ] Every line parses on its own — in JavaScript `jsonl.trimEnd().split("\n").forEach((l) => JSON.parse(l))`
      with `jsonl` = the text of `data-*/0000001.mybpm`. `JSON.parse` of the whole member at once MUST fail —
      that proves it is JSONL.
- [ ] **Run the form lint below and paste its output into the report.** It prints every defect of the hard
      rules (0.9), the ids (0.7), the templates (0.5–0.5d), the layout (0.8, 0.8a) and the process diagram (0.18)
      that a check can see — the list is under the function — one line each, and `form lint: OK` when there is
      none; fix every line it prints and run it again — a file with a non-`REMINDER` line left is never handed
      over, not even «с замечаниями». A `REMINDER` line is not a defect by itself: it names ONE
      number field that looks computed (итого, остаток, резерв, баланс, к оплате; «сумма» on a line BO that has a
      quantity and a price) while NO script of the file writes THAT field (a `BlockAssign` to it — a hook on the
      same BO that writes other fields does not count; мин / макс / порог / лимит / норма are thresholds, never
      computed), or looks like an approval (согласовано, утверждено) while no process of the file has a script
      that writes a field, or a BO of visits (запись, визит, приём) has a `FULL_DATE` and no calendar.
      Such fields in a file with NO script and NO process at all is a defect line, not a REMINDER; so is an
      approval field on a BO whose status list holds an approval stage (согласование …) with no process — the
      stage path is in the spec, «отмечается вручную» does not answer it. Answer each BY NAME in the report —
      «built» (the hook / process you added) or «вводится вручную, потому что …»; a task that needs no script or
      process stays without one. The prose
      checks below stay mandatory — the lint does not replace them.
      **How to run it:** the function is plain JavaScript — call `lintArchive(<the text of
      data-*/0000001.mybpm>, <the whole text of this document>)` (the second argument checks every `iconName` against 0.16) in any JavaScript engine your sandbox has and print what it returns. **No
      JavaScript engine?** Port the function line by line to the language you build in and run the port on the
      built file. Skipping it is not an option, and checks of your own builder do not replace it; a lint you
      could not run is reported as «form lint: NOT RUN» with the reason — never as «проверено».

```js
function lintArchive(jsonl, doc) { // jsonl = the whole text of data-*/0000001.mybpm, doc = the whole text of THIS document
const L = jsonl.trimEnd().split("\n").map((l) => JSON.parse(l)), out = [], err = (s) => out.push(s);
const cls = (o) => String(o["@class"]).split(".").pop(), of = (c) => L.filter((o) => cls(o) === c);
const all = (o) => Object.entries(o ?? {}), vals = (o) => Object.values(o ?? {}), bos = of("BoStructDto");
const low = (s) => String(s).replace(/<[^>]*>/g, "").trim().toLowerCase(), isRef = (f) => f.type === "BO" || f.type === "CO";
const ID = /^[A-Za-z0-9@~]{16}$/, CODE = /^[A-Za-z0-9_]{1,30}$/, ids = new Map();
const id = (t, v) => !ID.test(String(v)) ? err(`${t}: id "${v}" is not 16 of A-Za-z0-9@~ (0.7)`)
  : ids.has(v) ? err(`${t}: id ${v} repeats ${ids.get(v)} (0.7)`) : ids.set(v, t);
const W = ["signatures", "buttons", "iframes", "captcha", "currentDates", "currentUser"];
L.forEach((o, i) => /^kz\.greetgo\.mybpm\.reg\.structure\.model\.(dto\.\w+|access\.AccessStructDto)$/.test(o["@class"])
  || err(`line ${i + 1}: @class ${o["@class"]} — copy it from its template (0.9 rule 4)`));
const groups = of("BoGroupStructDto"), order = new Set();
for (const g of groups) {
  if (!g.code) err(`group «${g.name}»: no code (0.9 rule 1)`);
  if (g.kind !== (g.code === "General" ? "DEFAULT" : "MANUAL")) err(g.code === "General" ? `group General: kind ${g.kind} — the general group «Общее» keeps DEFAULT, MANUAL demotes it (0.3)` : `group ${g.code}: kind ${g.kind}, must be MANUAL (0.9 rule 1)`);
  id(`group ${g.code}`, g.oldId); id(`group ${g.code} newId`, g.newId);
}
if (bos.length > 6 && groups.length < 2) err(`${bos.length} BOs in one group — 2–4 groups by theme (0.2 step 1)`);
const NOT_DYN = /^(BUTTON|IFRAME|CAPTCHA|SIGNATURE|CURRENT_.*|CREATED_.*|LAST_MODIFIED_.*|OPEN_COUNT|PARTICIPANTS)$/;
const SYS = { BO_DICTIONARY: [["code", "INPUT_TEXT", "0.5b"], ["label", "INPUT_TEXT_LANG", "0.5b"]], BO_PROCESS: [["PROCESS_STATUS", "BO", "0.18"]] };
for (const bo of bos) {
  const b = bo.code, cat = bo.category, df = bo.dynamicFields ?? {}, fs = all(df), place = `${bo.boGroupOldId} ${bo.orderIndex}`;
  if (!CODE.test(b ?? "")) err(`${b}: BO code — at most 30 of A-Za-z0-9_ (0.9 rule 7)`);
  id(b, bo.oldId);
  for (const k of ["bos", "printForms", "dictionaryFields"]) if (!Array.isArray(bo[k])) err(`${b}.${k}: must be a list [] (0.9 rule 5)`);
  for (const k of ["name", "recordName", "staticValue", "boTabs", "dynamicFields", "nativeFields", "kanbanCardTemplates", "timelineTemplates", "calendarCardTemplates", ...W])
    if (!bo[k] || typeof bo[k] !== "object" || Array.isArray(bo[k])) err(`${b}.${k}: must be an object {}, not ${JSON.stringify(bo[k])} — the stand drops the whole BO (0.9 rule 5)`);
  if (!groups.some((g) => g.oldId === bo.boGroupOldId)) err(`${b}: boGroupOldId names no group line (0.7)`);
  if (typeof bo.orderIndex !== "number" || order.has(place)) err(`${b}: orderIndex ${bo.orderIndex} — one number per BO in its group (0.9 rule 17)`);
  order.add(place);
  const want = cat === "BO_DICTIONARY" ? '["CODE","LABEL"]' : "[]";
  if (JSON.stringify(bo.dictionaryFields) !== want) err(`${b}: dictionaryFields must be ${want} (0.5b)`);
  for (const [c, ty, s] of SYS[cat] ?? [])
    if (!(df[c]?.type === ty && df[c].isSystem && df[c].isRequired)) err(`${b}: ${c} missing or not ${ty} + isSystem + isRequired (${s}, 0.9 rule 18)`);
  if (cat !== "BO_COMPOSITE" && ![...vals(df), ...vals(bo.nativeFields)].some((f) => f.tableColToShow === true))
    err(`${b}: no field has tableColToShow: true (0.9 rule 15)`);
  for (const m of ["nativeFields", ...W]) for (const [k, w] of all(bo[m]))
    if (k !== (w.code ?? w.nativeFieldId)) err(`${b}.${k}: ${m} key differs from its code (0.9 rule 5)`);
  const labels = new Set(fs.filter(([, f]) => f.type !== "STATIC_TEXT").map(([, f]) => low(f.label?.rus)));
  const tci = fs.filter(([k]) => k !== "PROCESS_STATUS").map(([, f]) => f.tableColOrderIndex);
  if (cat !== "BO_COMPOSITE" && (tci.some((v) => typeof v !== "number") || new Set(tci).size < tci.length))
    err(`${b}: tableColOrderIndex missing or repeated — 0, 1, 2… (0.5)`);
  if (fs.some(([, f]) => f.fieldTabs?.tab_system) && !of("AccessStructDto").some((o) => o.boCode === b))
    err(`${b}: tab_system without its AccessStructDto line (0.8a step 6)`);
  for (const [k, f] of fs) {
    const t = `${b}.${k}`, ty = f.type, op = f.fieldOptionsStruct?.options, bi = f.boRefStruct?.boInfo;
    if (k !== f.code) err(`${t}: key differs from code "${f.code}" (0.9 rule 5)`);
    if (!CODE.test(k)) err(`${t}: field code — at most 30 of A-Za-z0-9_ (0.9 rule 7)`);
    id(t, f.newId);
    if (NOT_DYN.test(ty)) err(`${t}: ${ty} is a widget or system field — its own map (0.9 rule 13)`);
    if (f.isRequired && f.isReadonly) err(`${t}: isRequired + isReadonly — never saves (0.9 rule 9)`);
    if (ty === "STATIC_TEXT" && f.tableColToShow) err(`${t}: STATIC_TEXT as a registry column (0.8a step 2)`);
    if (ty === "STATIC_TEXT" && labels.has(low(f.staticValue?.rus))) err(`${t}: heading repeats a field label (0.9 rule 12)`);
    if (ty === "STATIC_TEXT" && /^\s*<(h\d|b|strong)>/i.test(f.staticValue?.rus ?? "")) err(`${t}: a bare <h3>/<b> heading renders as a small bold label — the styled <div> of 0.5`);
    if (op !== undefined && (Array.isArray(op) || all(op).some(([c, o]) => o.fieldOption?.code !== c || typeof o.fieldOption?.label !== "string")))
      err(`${t}: options — {<code>: {"fieldOption": {"code", "label": "<string>"…}, "newOptionId"}} (0.5)`);
    else for (const [c, o] of all(op)) id(`${t}.${c}`, o.newOptionId);
    if (ty === "QUESTIONNAIRE" && [true, false].some((col) => !vals(f.questionnaires).some((q) => q.questionnaireDto?.isColumn === col) || vals(f.questionnaires).some((q) => q.questionnaireDto?.isColumn === col && !q.questionnaireDto?.label?.trim())))
      err(`${t}: a questionnaire needs ≥1 row and ≥1 column, each with a label — an empty one blocks the constructor save (0.5)`);
    if (ty === "DROPDOWN_SINGLE" && f.fieldOptionsStruct?.optionSource === "FROM_FIELD" && !all(op).length) err(`${t}: a local list with no options (0.5)`);
    if (ty === "DROPDOWN_SINGLE" && !bo.kanbanCardTemplates?.[k]?.kanbanFields) err(`${t}: no kanbanCardTemplates.${k}.kanbanFields (0.9 rule 16)`);
    for (const [c, tb] of all(f.fieldTabs)) id(`${t}.${c}`, tb.newId);
    if (ty === "TAB_GROUP" && f.gridPosition) {
      const tall = Math.max(0, ...fs.filter(([, x]) => x.tabCodePath?.tabGroupCode === k && x.gridPosition).map(([, x]) => x.gridPosition.y + x.gridPosition.rows));
      const need = tall + (f.tabCodePath?.tabCode ? 2 : bo.instanceViewType === "TAB" ? 6 : 3);
      if (tall && f.gridPosition.rows !== need) err(`${t}: rows ${f.gridPosition.rows}, tallest tab ${tall} + ${need - tall} = ${need} (0.8a step 5)`);
    }
    for (const c of Object.keys(f.fieldTabs ?? {}).filter((c) => c !== "tab_system")) {
      const n = fs.filter(([, x]) => x.tabCodePath?.tabCode === c && x.type !== "STATIC_TEXT").length;
      if (n < 2) err(`${t}.${c}: a tab with ${n} field(s) — at least 2, else a heading (0.8a step 3)`);
    }
    if (ty === "DROPDOWN_SINGLE" && f.tabCodePath?.tabCode && (k === "status" || low(f.label?.rus) === "статус")) err(`${t}: the status inside tab ${f.tabCodePath.tabCode} — the header row beside the title field, seen on every tab (0.8a step 3)`);
    if (ty === "FILE_UPLOAD" && /фото|снимк|снимок|photo/i.test(`${k} ${f.label?.rus}`) && f.params?.viewType !== "TILE") err(`${t}: a photo field without params.viewType TILE shows no pictures (0.19)`);
    if (cat === "BO_DICTIONARY" && (k === "code" || k === "label") && f.gridPosition && (f.gridPosition.x !== 0 || f.gridPosition.cols !== 15)) err(`${t}: a dictionary's Код / Значение — x 0, cols 15 each, one width (0.5b, 0.8)`);
    if (!isRef(f)) continue;
    if (!bi?.code) err(`${t}: no boRefStruct.boInfo.code (0.5a)`);
    if (k !== "PROCESS_STATUS" && bi?.boCategory === "BO_DICTIONARY") err(`${t}: dictionary ${bi.code} as a BO reference draws a «Выберите» link — DROPDOWN_SINGLE FROM_BO (0.5)`);
    if (f.oldRefBoId ? !ID.test(f.oldRefBoId) : !["Person", "Department", "PersonGroup"].includes(bi?.code))
      err(`${t}: oldRefBoId "${f.oldRefBoId}" — the target's oldId, "" only for Person (0.5a)`);
    if (cat !== "BO_PANEL" && bi?.code !== "Person" && !vals(f.boRefStruct?.fieldRefs).some((r) => r.toShow))
      err(`${t}: no fieldRefs entry with toShow: true (0.9 rule 15)`);
    const tg = bos.find((x) => x.oldId === f.oldRefBoId);
    if (f.linkedFieldCode && tg && tg.dynamicFields?.[f.linkedFieldCode]?.linkedFieldCode !== k)
      err(`${t}: linkedFieldCode — ${tg.code}.${f.linkedFieldCode} does not name ${k} back (0.5a)`);
  }
}
const mc = new Set(), MENU = ["menuItemName", "iconName", "orderIndex", "chosenAccessRight", "needCountMenuItem", "isPanel", "needHideInMobApp", "menuItemType"];
for (const m of of("MenuItemStructDto")) {
  const t = `menu ${m.menuItemCode}`, grp = m.menuItemType === "GROUP", bo = bos.find((x) => x.code === m.boCode), kf = m.boPages?.kanbanFieldCode;
  if (!CODE.test(m.menuItemCode ?? "") || mc.has(m.menuItemCode)) err(`${t}: menuItemCode — unique, at most 30 of A-Za-z0-9_ (0.5d)`);
  mc.add(m.menuItemCode);
  for (const k of MENU) if (!(k in m)) err(`${t}: key ${k} missing (0.5d)`);
  for (const k of ["oldId", "newId", "id", "boId", "parentId"]) if (k in m) err(`${t}: carries ${k} — name by code (0.9 rule 14)`);
  for (const k of grp ? ["boPages", "bracketFilter"] : ["boCode", "boName", "boPages", "bracketFilter"])
    if ((k in m) === grp) err(`${t}: ${grp ? "a GROUP line carries" : "a BO line needs"} ${k} (0.9 rule 14)`);
  if (kf && bo && !(bo.dynamicFields?.[kf]?.type === "DROPDOWN_SINGLE" && bo.kanbanCardTemplates?.[kf]))
    err(`${t}: kanbanFieldCode ${kf} is no DROPDOWN_SINGLE of ${bo.code} with a card template (0.9 rule 14)`);
  if (kf && bo?.dynamicFields?.status?.type === "DROPDOWN_SINGLE" && !of("MenuItemStructDto").some((x) => x.boCode === m.boCode && x.boPages?.kanbanFieldCode === "status")) err(`${t}: the kanban opens by ${kf} while ${bo.code} has a status — kanbanFieldCode status (0.15)`);
}
const by = (a, f) => a.reduce((m, x) => ((m[f(x)] ??= []).push(x), m), {});
const menu = of("MenuItemStructDto"), icon = (ms) => Object.entries(by(ms, (m) => m.iconName ?? ""));
for (const [ic, ms] of icon(menu.filter((m) => m.menuItemType === "GROUP"))) if (ms.length > 1) err(`menu ${ms.map((m) => m.menuItemCode).join(", ")}: groups share icon ${ic} — each group by its own theme (0.5d)`);
for (const g of menu.filter((m) => m.menuItemType === "GROUP")) for (const c of menu.filter((m) => m.parentMenuItemCode === g.menuItemCode && m.iconName === g.iconName))
  err(`menu ${g.menuItemCode}: group icon ${g.iconName} repeats its item ${c.menuItemCode} — the group by its theme, the item by its records (0.5d)`);
const cat = String(doc ?? "").split("\n### 0.16 Menu icons")[1]?.split("\n### ")[0];
if (!cat) err(`iconName not checked — call lintArchive(<the archive text>, <the text of this document>) (0.16)`);
else for (const m of menu) {
  const [ns, ...rest] = String(m.iconName ?? "").split(":"), n = rest.join(":");
  const known = ["bo-g-draggable", "man-with-company", "bo-d-draggable"].includes(m.iconName)
    || (/^(phosphor|menu-item)$/.test(ns) && (cat.includes(` ${n} `) || cat.includes(` ${n}\n`) || cat.includes(`«${n}»`) || cat.includes(`: ${n} `)));
  if (!known) err(`menu ${m.menuItemCode}: iconName "${m.iconName}" is not in 0.16 — the sidebar draws an empty place; pick one from 0.5d «Icons by meaning» (0.16)`);
}
for (const sib of Object.values(by(menu.filter((m) => m.menuItemType !== "GROUP"), (m) => m.parentMenuItemCode ?? "")))
  for (const [ic, ms] of icon(sib)) if (ms.length >= 3) err(`menu ${ms.map((m) => m.menuItemCode).join(", ")}: ${ms.length} siblings with icon ${ic} — each by what it lists (0.5d)`);
const R3 = /^(INPUT_(TEXT|TEXT_LANG|PHONE|EMAIL|NUMBER)|TIME|FULL_DATE|YEAR_AND_MONTH|YEAR|DATE|PERIOD|PERIOD_TIME|CHECKBOX|DROPDOWN_SINGLE)$/;
for (const bo of bos.filter((b) => b.category !== "BO_COMPOSITE")) {
  const fs = vals(bo.dynamicFields), forms = new Map(), put = (tab, c) => forms.set(tab ?? "", [...(forms.get(tab ?? "") ?? []), c]);
  for (const f of fs) {
    const t = `${bo.code}.${f.code}`, g = f.gridPosition, text = /^TEXTAREA/.test(f.type);
    const short = isRef(f) ? f.viewType === "SINGLE" : R3.test(f.type), table = isRef(f) && f.viewType === "TABLE";
    if (f.archetype !== "DYNAMIC" || !f.kind) err(`${t}: no "archetype": "DYNAMIC" + "kind": "GENERAL" (0.5)`);
    if (text && f.params?.buttonTypes === undefined) err(`${t}: TEXTAREA without params.buttonTypes (0.5)`);
    if (table && vals(f.boRefStruct?.fieldRefs).filter((r) => r.toShow).length < 2) err(`${t}: TABLE shows fewer than 2 columns (0.5a)`);
    if (!g || f.trackedFieldCode) continue;
    if (f.code === "PROCESS_STATUS") { put(f.tabCodePath?.tabCode, { t, g, box: true }); continue; } // its own box, but its rows stack (0.8)
    if (short && g.rows !== 3) err(`${t}: rows ${g.rows}, must be 3 (0.8)`);
    if ((table || text) && g.rows < 6) err(`${t}: rows ${g.rows}, must be 6 (0.8)`);
    put(f.tabCodePath?.tabCode, { t, g, short, head: f.type === "STATIC_TEXT" });
  }
  for (const w of [...W.flatMap((m) => vals(bo[m])), ...vals(bo.nativeFields)])
    if (w.gridPosition) put((w.tabCode ?? w.tabCodePath)?.tabCode, { t: `${bo.code}.${w.code ?? w.nativeFieldId}`, g: w.gridPosition, box: true });
  for (const [tab, cells] of forms) {
    let next = 0, edge = 15, lone = 0;
    for (const y of [...new Set(cells.map((c) => c.g.y))].sort((a, b) => a - b)) {
      const row = cells.filter((c) => c.g.y === y).sort((a, b) => a.g.x - b.g.x), r = row[0].t;
      if (y !== next) err(`${r}: y ${y}, expected ${next} (0.8)`);
      let x = 0;
      for (const c of row) {
        if (c.g.x < x) err(`${c.t}: overlaps the cell before it in row y ${y} (0.10)`);
        if (!c.box && c.g.x >= edge) err(`${c.t}: x ${c.g.x} in the free columns ${edge}–14 above — floats up (0.8)`);
        x = Math.max(x, c.g.x + c.g.cols);
      }
      if (row.length > 1 && x !== 15) err(`${r}: row y ${y} spans ${x} of 15 columns (0.8)`);
      if (new Set(row.map((c) => c.g.rows)).size > 1) err(`${r}: row y ${y} mixes heights (0.8)`);
      if (row.length === 1 && row[0].short) {
        lone++;
        if (row[0].g.cols === 15 && bo.category !== "BO_DICTIONARY") err(`${r}: a short field alone at full width — pair it or x 0, cols 8 (0.8)`);
      }
      next = y + Math.max(...row.map((c) => c.g.rows));
      edge = row.some((c) => c.box) ? 15 : x;
    }
    const heads = cells.filter((c) => c.head);
    for (const h of heads) {
      const below = cells.filter((c) => c.g.y > h.g.y), y = Math.min(...below.map((c) => c.g.y));
      if (!below.length || below.some((c) => c.g.y === y && c.head)) err(`${h.t}: heading with no field under it — not a group (0.8a step 2)`);
    }
    if (heads.length === 1 && cells.length > 1 && heads[0].g.y === Math.min(...cells.map((c) => c.g.y)))
      err(`${heads[0].t}: the only heading, on top of the whole ${tab ? "tab" : "form"} — groups nothing; ≥ 2 headings or none (0.8a step 2)`);
    if (lone >= 3 && bo.category !== "BO_DICTIONARY")
      err(`${bo.code}${tab ? " tab " + tab : ""}: ${lone} rows hold one short field each — 2–3 per row, a lone field at most 2 per form (0.8)`);
  }
  if (bo.category === "BO_DICTIONARY" || bo.category === "BO_PROCESS") continue;
  const seen = fs.filter((f) => !f.trackedFieldCode && f.type !== "STATIC_TEXT" && f.type !== "TAB_GROUP" && f.tabCodePath?.tabCode !== "tab_system").length;
  const tabs = fs.some((f) => f.type === "TAB_GROUP" && Object.keys(f.fieldTabs ?? {}).some((k) => k !== "tab_system"));
  const cols = fs.filter((f) => f.tableColToShow === true).length;
  if (seen > 12 && !tabs) err(`${bo.code}: ${seen} visible fields and no tabs — tabs of ≤ 12 fields, also on instanceViewType TAB (0.8a step 3)`);
  else if (seen > 8 && !tabs && !fs.some((f) => f.type === "STATIC_TEXT")) err(`${bo.code}: ${seen} visible fields, no heading and no tabs (0.8a step 2)`);
  if (cols > 6) err(`${bo.code}: ${cols} registry columns — the name + at most 5 (0.5)`);
}
const tl = by(bos.flatMap((bo) => vals(bo.dynamicFields).filter((f) => f.type === "TAB_GROUP")
  .flatMap((f) => vals(f.fieldTabs).filter((x) => x.code !== "tab_system" && !x.isDefault).map((x) => ({ bo: bo.code, k: low(x.label?.rus) })))), (s) => s.k);
for (const [k, s] of Object.entries(tl)) if (k && new Set(s.map((x) => x.bo)).size >= 3) err(`${[...new Set(s.map((x) => x.bo))].join(", ")}: tab «${k}» copied onto every BO — name each tab by what it holds (0.8a step 3)`);
for (const bo of bos.filter((b) => b.instanceViewType !== "TAB" && /^BO(_PROCESS|_DICTIONARY)?$/.test(b.category))) {
  const g = bo.gridLayoutPosition, fs = vals(bo.dynamicFields);
  if (!g) { err(`${bo.code}: no gridLayoutPosition — the record opens at 90 % × 90 % of the screen (0.8a step 7)`); continue; }
  const rows = Math.max(0, ...fs.filter((f) => f.gridPosition && !f.tabCodePath?.tabCode && !f.trackedFieldCode).map((f) => f.gridPosition.y + f.gridPosition.rows));
  if (g.h > 28) err(`${bo.code}: FORM window h ${g.h} > 28 — tabs or instanceViewType TAB (0.8a steps 3, 8)`);
  else if (g.h < rows + 5) err(`${bo.code}: FORM window h ${g.h} scrolls ${rows} form rows — h ${rows + 5} (0.8a step 7)`);
  for (const f of fs.filter((f) => f.type === "BO" && f.viewType === "TABLE")) {
    const c = bos.find((b) => b.oldId === f.oldRefBoId);
    if (c && c.instanceViewType !== "TAB" && c.gridLayoutPosition?.w >= g.w && !vals(c.dynamicFields).some((x) => x.viewType === "TABLE" && x.oldRefBoId === bo.oldId))
      err(`${bo.code}.${f.code}: child ${c.code} window w ${c.gridLayoutPosition.w} ≥ ${g.w} — narrower or TAB (0.8a steps 7–8)`);
  }
}
const SZ = { Enter: [30, 30], Exit: [30, 30], Point: [20, 20], Terminator: [40, 40], Script: [80, 50], Timer: [80, 50],
  Form: [100, 50], Switch: [60, 60], SingleToParallel: [39, 64], ParallelToSingle: [39, 64] };
const hit = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
for (const pv of of("BoProcessVersionsStructDto")) {
  const pc = bos.find((b) => b.oldId === pv.oldId)?.code ?? pv.oldId;
  for (const v of [pv.workProcess, ...vals(pv.processVersions)].filter(Boolean)) {
    const F = Object.fromEntries(all(v.figureStructs).map(([id, f]) => {
      const t = cls(f).replace(/^Figure|Struct$/g, ""), [w, h] = SZ[t] ?? [80, 50];
      return [id, { t, x: f.x, y: f.y, b: [f.x - w / 2, f.y - h / 2, f.x + w / 2, f.y + h / 2] }];
    }));
    for (const [fid, f] of all(F)) if (/^(Script|Switch)$/.test(f.t) && !of("ScriptDefStructDto").some((s) => String(s.compositeId).endsWith(`-${fid}`)))
      err(`${pc}: ${f.t} ${fid} has no ScriptDefStructDto "<version>-${fid}" — on a record the figure FAILS «Скрипт не определен» (0.18)`);
    const at = (f, s) => s === "main" ? [f.t === "Enter" ? f.b[2] : f.b[0], f.y] : s === "left" ? [f.b[0], f.y]
      : s === "right" ? [f.b[2], f.y] : /^(top|up)$/.test(s) ? [f.x, f.b[1]] : /^(bottom|down)$/.test(s) ? [f.x, f.b[3]] : [f.x, f.y];
    const labs = [];
    for (const a of vals(v.arrows)) {
      const st = F[a.startFigureId], fi = F[a.finishFigureId];
      if (!st || !fi) continue;
      const [x1, y1] = at(st, a.startSlotName), [x2, y2] = at(fi, a.finishSlotName), n = [...(a.name ?? "")].length;
      const t = `${pc} arrow «${a.name ?? ""}»`, dx = Math.abs(x2 - x1), dy = Math.abs(y2 - y1);
      if (st.t !== "Point" && fi.t !== "Point" && dx && dy) err(`${t}: not straight — both slots on one y or one x (0.18)`);
      if (n > 12) err(`${t}: name longer than 12 characters (0.18)`);
      if (!dy && dx < 15 * n + 20) err(`${t}: gap ${dx} px, needs ${15 * n + 20} (0.18)`);
      if (!dx && dy < 50) err(`${t}: vertical gap ${dy} px, needs 50 (0.18)`);
      if (n) labs.push({ t, b: [(x1 + x2) / 2, (y1 + y2) / 2, (x1 + x2) / 2 + 7.5 * n, (y1 + y2) / 2 + 18] });
    }
    for (const [i, l] of labs.entries()) {
      for (const f of vals(F)) if (hit(l.b, f.b)) err(`${l.t}: label overlaps a ${f.t} figure (0.18)`);
      for (const m of labs.slice(i + 1)) if (hit(l.b, m.b)) err(`${l.t}: label overlaps ${m.t} (0.18)`);
      if (l.b[2] > 1200) err(`${l.t}: label ends at x ${Math.round(l.b[2])}, beyond 1200 (0.18)`);
    }
    if (!all(v.runWayMap).length) err(`${pc}: empty runWayMap — nothing starts the process (0.18)`);
  }
}
for (const bo of bos.filter((b) => b.dynamicFields?.PROCESS_STATUS)) {
  const dv = bo.dynamicFields.PROCESS_STATUS.defaultValue;
  if (!dv || dv === "[]") err(`${bo.code}.PROCESS_STATUS: no defaultValue (the CREATED row) — every record is refused on save (0.17)`);
  if (!of("ExportStructInstanceDto").some((r) => (r.sources ?? []).some((x) => x.sourceType === "DEFAULT_VALUE"
    && x.defaultValueInstanceSource?.boCode === bo.code && x.defaultValueInstanceSource?.fieldCode === "PROCESS_STATUS")))
    err(`${bo.code}.PROCESS_STATUS: no PROCESS_STATUS row line with sources DEFAULT_VALUE {boCode: "${bo.code}", fieldCode: "PROCESS_STATUS"} — the default does not take, every record is refused on save (0.17, 0.18)`);
}
const fields = bos.flatMap((b) => vals(b.dynamicFields)), rows = of("ExportStructInstanceDto");
const lab = (r) => { try { return low(JSON.parse(r.fieldMap?.label?.storedValue ?? "{}").RUS); } catch { return ""; } };
for (const d of bos.filter((b) => b.category === "BO_DICTIONARY" && b.code !== "PROCESS_STATUS")) {
  const used = fields.some((f) => f.fieldOptionsStruct?.dictionaryBoInfo?.code === d.code || f.boRefStruct?.boInfo?.code === d.code);
  if (!used && bos.some((b) => b.category !== "BO_DICTIONARY")) err(`${d.code}: dictionary no field uses — a DROPDOWN_SINGLE FROM_BO on it, or drop it (0.5b)`);
  const dl = new Set(rows.filter((r) => r.boCode === d.code).map(lab).filter(Boolean));
  for (const bo of bos) for (const f of vals(bo.dynamicFields)) {
    const same = vals(f.fieldOptionsStruct?.options).filter((o) => dl.has(low(o.fieldOption?.label))).length;
    if (f.fieldOptionsStruct?.optionSource === "FROM_FIELD" && same >= 2) err(`${bo.code}.${f.code}: local list repeats ${same} rows of dictionary ${d.code} — FROM_BO on it (0.5)`);
  }
}
for (const s of of("ScriptDefStructDto"))
  if (vals(s.blocks).every((x) => /Block(FixEntryPoint|Exit)Struct$/.test(x["@class"] ?? x.type ?? ""))) err(`script ${s.compositeId}: only entry → exit — does nothing; give it the step's work or drop it (0.18)`);
const owner = new Map(), written = new Set(); // "<BO>.<field>" some script assigns: <x>.<field>.#Значение = …
for (const v of of("BoScriptVersionsStructDto")) for (const c of v.workScripts?.scriptDefIds ?? []) owner.set(c, v.ownerBoInfo?.code);
for (const pv of of("BoProcessVersionsStructDto")) for (const v of [pv.workProcess, ...vals(pv.processVersions)]) for (const c of v?.scriptsDefIds ?? []) owner.set(c, bos.find((b) => b.oldId === pv.oldId)?.code);
for (const s of of("ScriptDefStructDto")) {
  const X = s.expressions ?? {}, B = s.blocks ?? {}, fld = (e) => /^F-(\w+)-K-/.exec(e?.actId ?? "")?.[1];
  const boOf = (e, d = 0) => { // the BO whose records the expression yields
    if (!e || d > 20) return;
    if (e.exprValueType === "THIS_PROCESS") return owner.get(s.compositeId);
    if (e.exprValueType === "VAR_REF") { const b = B[e.varBlockId]; return boOf(X[b?.srcExprId ?? b?.valueExprId], d + 1); }
    let a = e; while (a && /^F-VALUE-/.test(a.actId ?? "")) a = X[a.leftExprId];
    const f = fld(a), host = f && boOf(X[a.leftExprId], d + 1);
    return bos.find((b) => b.code === host)?.dynamicFields?.[f]?.boRefStruct?.boInfo?.code;
  };
  for (const b of vals(B).filter((x) => /BlockAssign/.test(x["@class"] ?? ""))) {
    let e = X[b.leftExprId]; while (e && /^F-VALUE-/.test(e.actId ?? "")) e = X[e.leftExprId];
    if (fld(e)) written.add(`${boOf(X[e.leftExprId]) ?? "*"}.${fld(e)}`);
  }
}
const noProcess = !of("BoProcessVersionsStructDto").some((pv) => [pv.workProcess, ...vals(pv.processVersions)].some((v) => (v?.scriptsDefIds ?? []).some((c) => /BlockAssign/.test(JSON.stringify(of("ScriptDefStructDto").find((s) => s.compositeId === c)?.blocks)))));
for (const bo of bos.filter((b) => b.category !== "BO_DICTIONARY")) for (const f of vals(bo.dynamicFields)) {
  const l = f.label?.rus ?? "", t = `REMINDER ${bo.code}.${f.code} «${l}»`, nums = vals(bo.dynamicFields).filter((x) => x.type === "INPUT_NUMBER").map((x) => low(x.label?.rus));
  const line = /сумм/i.test(l) && nums.some((x) => /кол|час|объ[её]м|вес/.test(x)) && nums.some((x) => /цен|тариф|ставк/.test(x)); // qty ∙ price
  if (!written.has(`${bo.code}.${f.code}`) && !written.has(`*.${f.code}`) && f.type === "INPUT_NUMBER" && !/мин|макс|порог|лимит|норм/i.test(l) && (line || /итого|остат|резерв|баланс|к оплате/i.test(l)))
    err(`${t} looks computed and no script writes it — a hook (0.2c step 7, §5d «A ready sum hook»), or report «вводится вручную, потому что …»`);
  if (noProcess && /^(CHECKBOX|DROPDOWN_SINGLE)$/.test(f.type) && /согласован|утвержд/i.test(l)) {
    const stage = vals(bo.dynamicFields).some((x) => x !== f && vals(x.fieldOptionsStruct?.options).some((o) => /согласов|утвержд/i.test(o.fieldOption?.label ?? "")));
    if (stage) err(`${bo.code}.${f.code} «${l}»: an approval field AND an approval stage in the status list, and no process links them — the BO_PROCESS that moves the status when it is approved (0.18 «A writing Script, literally»); «отмечается вручную» does not answer a stage path`);
    else err(`${t} looks like an approval and no process changes anything — a BO_PROCESS that writes (0.18), or report «отмечается вручную, потому что …»`);
  }
}
for (const bo of bos.filter((b) => b.category === "BO" && !b.isCalendarEnabled && /запис|визит|встреч|при[её]м|брон/i.test(b.name?.rus ?? "")))
  if (vals(bo.dynamicFields).some((f) => f.type === "FULL_DATE")) err(`REMINDER ${bo.code} «${bo.name.rus}»: visits with a date and time but no calendar — isCalendarEnabled + a calendar menu item (§2 «BO views»), or report why not`);
const asks = out.filter((s) => /^REMINDER .* (looks computed|looks like an approval)/.test(s)).length;
if (asks && !of("ScriptDefStructDto").length && !of("BoProcessVersionsStructDto").length)
  err(`${asks} fields look computed or like an approval and the file has NO script and NO process — a blanket «пока не реализовано» is no reason (0.2b step 5): the ready sum hook (§5d «A ready sum hook»), the writing Script (0.18)`);
return out.length ? out.join("\n") : "form lint: OK";
}
```

- [ ] **What the lint checks is not repeated here — its output is the proof**; the function itself is the list.
      `tools/validate-archive.bun.ts`, if present, checks the same and more.
- [ ] **`form lint: OK` does not mean every rule of this document holds** — it sees the file, not the spec.
      It does NOT see: (a) the coverage table — every row routed to «a hook script» or «a business process»
      needs a script / process in THIS file that does that row's work (writes that field, moves that status);
      a row not built is «не сделано» + its reason in its OWN row of the table AND in the reply, never «требует уточнения» or
      «настроить на стенде»; (b) every check below this one. The report names each of them as done, after the
      lint output — «lint OK» alone is not «проверено».
- [ ] Every new code follows 0.6a by MEANING: English snake_case; objects, groups and menu items `Capitalised`,
      the rest lower case; `is_*` on a checkbox, `tabs` / `tabs_*` on a TAB_GROUP, `tab_*` on a tab.
- [ ] Every group code is an existing group's code confirmed by the user, or a new code for a group the
      archive creates (0.2a, 0.3).
- [ ] No `oldRefBoId` / dictionary code in the file was invented; every one came from the stand, or is the
      `oldId` of a BO line of this same archive — earlier OR later in the file (0.2a).
- [ ] For a `BO_COMPOSITE`: every `bos[].code` is either a BO line of this archive or a code the user
      gave off the stand, and every `boFieldCodes[].fieldCode` really exists in that source BO —
      a missing field code crashes the import with `INTERNAL_ERROR` (0.2a, §5b).
- [ ] No id literal was copied out of this document — the sample's ids are `<company-a>`'s (0.2a).
- [ ] Ids by 0.7 «Which ids»: an amendment keeps every id and code of the given (or your own earlier) archive;
      a build from scratch used a NEW salt, and the report names it.
- [ ] 0.8a by meaning: tabs split by theme and balanced; system fields on `tab_system` «Системные»; a big
      document is `instanceViewType: "TAB"` (step 8).
- [ ] Every field's `rows` is tall enough for its content — a heading band, an HTML text, an `<iframe>`, a
      table — so nothing scrolls INSIDE a field on the card (≈29 px per row; a two-line heading needs
      15×4, see §4). After the import, open a record and check it (`MYBPM-UI-API.md` §0U.6).
- [ ] For every object the request names: if it was NOT said to exist on the stand, it is BUILT in this
      archive (a dictionary for a «из справочника» dropdown, the target BO of a reference) — not degraded to
      text or a local list; if it WAS said to exist, its id / code came from the user (0.2a «Decide FIRST»).
- [ ] Registry columns are the default of 0.5: the name field first and visible. String fields were hidden
      only if the user said the stand has the Elasticsearch sort defect (0.14).
- [ ] Nothing was quietly built INSTEAD of what was asked: no panel turned into a set of plain BOs, no
      составной объект turned into a plain BO because «the ids are unknown» (it takes codes, 0.2a), no
      `TAB_GROUP` replaced by `STATIC_TEXT` headings, no `PROCESS_STATUS` faked as a local dropdown
      (0.2a, 0.17). Only a missing stand id or stand code ever justifies a degrade.
- [ ] Menu lines (0.5d), if any: every `menuItemCode` is NEW to the stand (an existing one is edited in
      place) unless the user asked to change that very item; every `parentMenuItemCode` is a GROUP line of
      this archive or a code the user gave off the stand; every `boCode` is a BO line of this archive or a
      stand code; every `iconName` is an icon BY MEANING copied from 0.5d «Icons by meaning» or 0.16 WITH its
      prefix (the importer accepts a wrong name silently) — the generic defaults only when the user asked for
      no icons.
- [ ] A whole system from a spec (0.2b): every spec item has a row of the coverage table; every row routed
      to an archive line, a hook script or a process IS in the file; every row left out carries a reason from
      the closed list of 0.2b step 5; the menu items are there — at the root up to ~5, else one `GROUP` per theme (0.2b step 4); every header–lines and
      parent–child pair is a `SINGLE`↔`TABLE` joined by `linkedFieldCode` (0.2c).
- [ ] **Omissions — a system build that fails any of these is not done** (0.2b, 0.2c):
      at least one `type: "BO"` field whenever the spec has two objects that refer to each other — no
      «клиент», «поставщик», «заказ» typed as `INPUT_TEXT`; every header has its line BO with the 0.5a pair,
      not a `TEXTAREA` list; a `MenuItemStructDto` item per user job (0.2c step 9), grouped by theme when there are more than ~5 (0.2b step 4); every
      dictionary whose values the spec names or implies has its row lines (0.5b) and is a `BO_DICTIONARY`;
      no number, sum or date typed as a dropdown; every computed value of the spec has its hook line or a
      closed-list reason; every child document (payments, records of a stage) that points at a header with a
      `SINGLE` has the header's `TABLE` back (0.2c step 2).

#### The report — what you tell the user along with the archive

- **List the contents FROM THE BUILT FILE, never from your plan.** Print the payload and report exactly what
  it holds — e.g. in JavaScript, with `jsonl` = the text of `data-*/0000001.mybpm`:
  `jsonl.trimEnd().split("\n").map((l) => { const o = JSON.parse(l); return [o["@class"].split(".").pop(),
  o.code ?? o.menuItemCode ?? o.ownerBoInfo?.code ?? o.compositeId ?? "", o.category ?? o.menuItemType ?? ""]
  .join(" "); }).join("\n")` (no JavaScript engine → the same in your language) — groups, BOs by category, scripts by owner and hook, the process, the menu items. An object the file does
  not contain is never named: «составной объект для поставщиков» with no `BO_COMPOSITE` line is a false report.
- **Name the build salt in one line** — «Соль сборки: `k7f2`» — so a later amendment in this conversation
  mints the same ids (0.7 case 2).
- **Name each 0.10 check you ran and how** (the validator, by hand). Asserts inside your own builder are not
  0.10; «проверено» without the list of checks is not a report. **Paste the output of the 0.10 form lint**
  as it printed — `form lint: OK`, or each `REMINDER` line with its answer by field name: built, or entered by
  hand and why. A check
  you did not run is named as not run, never folded into «проверка архива».
- **For a system build: the coverage table of 0.2b** — every spec item, its route, built / not built + the
  reason from the closed list / to do after the import — printed as a table at the end of the reply; an item
  not built is a row of its own, never inside a row marked built, never only in a list of limitations.
- **The steps after the import**: import the archive — analysis first, then apply (0.11 «What the user does with it»), load the initial records
  by xlsx (Part III), set the rights on the stand if no group ids were given (0.2d).


### 0.11 Building the zip

**By hand — always possible.** Write the lines by 0.3–0.8a (plus 0.12–0.19 where your task needs them), one
minified JSON object per line, and zip them as 0.1 says — «Zipping by hand» below. Run the self-check 0.10
yourself.

**With the repository's `tools/`, if they are available — preferred.** `tools/validate-archive.bun.ts <zip>`
checks a finished archive (hand-built or generated) against 0.9 / 0.10 / 0.8a: `FATAL` and `ERROR` must be
zero, `WARN` is style. The generator `tools/make-probe-archive.bun.ts` writes the same lines from a short
command line (0.21); it names fields the way the STAND does (0.20), so rename them to 0.6a for a real
archive. Neither is required.

**Zipping by hand.** Any zip tool will do; the importer takes STORED and DEFLATED entries alike. With the
`zip` command, run it in the folder that CONTAINS `data-…/`, so the folder is part of the member names:

```
zip -r -X <name>.mybpm.zip data-2026-09-18T10-43-21-715
```

`metadata.mybpm` has no trailing newline — write it with `printf 'objectCount-%d' N`, not `echo`. Where
there is no zip tool, this plain JavaScript function (no imports) returns the bytes of a STORED archive with
UTF-8 names — call it with your objects in order and save the bytes as `<name>.mybpm.zip` with whatever
writes a file in your environment:

```js
function zipArchive(lines, d = "data-2026-09-18T10-43-21-715") { // lines = your objects, in order
const enc = new TextEncoder();
const files = [
  { name: `${d}/0000001.mybpm`, data: enc.encode(lines.map(o => JSON.stringify(o)).join("\n") + "\n") },
  { name: `${d}/metadata.mybpm`, data: enc.encode(`objectCount-${lines.length}`) },
];
const T = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = T[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const parts = [], central = [];
let off = 0;
for (const f of files) {
  const n = enc.encode(f.name), c = crc(f.data), L = f.data.length;
  const lh = new DataView(new ArrayBuffer(30));
  [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [14, c, 4], [18, L, 4], [22, L, 4], [26, n.length, 2]]
    .forEach(([o, v, w]) => w === 4 ? lh.setUint32(o, v, true) : lh.setUint16(o, v, true));
  parts.push(new Uint8Array(lh.buffer), n, f.data);
  const ch = new DataView(new ArrayBuffer(46));
  [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [16, c, 4], [20, L, 4], [24, L, 4], [28, n.length, 2], [42, off, 4]]
    .forEach(([o, v, w]) => w === 4 ? ch.setUint32(o, v, true) : ch.setUint16(o, v, true));
  central.push(new Uint8Array(ch.buffer), n);
  off += 30 + n.length + L;
}
const size = central.reduce((a, b) => a + b.length, 0), e = new DataView(new ArrayBuffer(22));
e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
e.setUint32(12, size, true); e.setUint32(16, off, true);
const all = [...parts, ...central, new Uint8Array(e.buffer)], out = new Uint8Array(off + size + 22);
let at = 0; for (const b of all) { out.set(b, at); at += b.length; }
return out;
}
```

Check the result with `unzip -l <name>.mybpm.zip`: exactly two members, both under `data-…/` (0.10).
With Python, `zipfile.ZipFile(name, "w")` + `writestr("data-…/0000001.mybpm", …)` and
`writestr("data-…/metadata.mybpm", …)` does the same.

**No way to hand over a file at all** (a chat that cannot run code or attach files): the archive is still
yours to build — print the two members as two code blocks, the full `0000001.mybpm` (one line per object)
and `metadata.mybpm`, with the folder name and the `zip -r -X` command above, so the user saves and zips
them. Never replace the archive with a description of what to click in the constructor.


**What the user does with it.** An import is TWO-PHASE: the upload only ANALYSES, then one deliberate
«ПРИМЕНИТЬ» writes. Tell the user to read the analysis errors before applying — «В Составном объекте не
достаёт БО» does not block applying — and that the import needs a description. «Не найден бизнес-объект
для пункта меню» on a BO of the SAME archive means that BO line was dropped — a `[]` where the template
has `{}` (0.9 rule 5); fix the archive, do not apply. Loading it yourself (API,
UI, rollback) is `MYBPM-UI-API.md` §5 / R3, not this document.

---

**Optional blocks, 0.12–0.21.** Read only the block your task needs (the list is at the top of §0); the
core 0.1–0.11 above applies to every one of them.

### 0.12 System fields — `nativeFields`, NOT `dynamicFields`

«Системные поля» of the palette are a separate archetype and live in their own map of `BoStructDto`,
keyed by the native type, which is also the field's code and its `nativeFieldId` `[C]`:

```text
"nativeFields": {
  "CREATED_AT": {
    "newId": "<16 chars>", "nativeFieldId": "CREATED_AT", "archetype": "NATIVE",
    "boRefStruct": {"fieldRefs": {}},
    "label": {"rus": "Дата создания", "kaz": "Құрылған күні", "qaz": "Qurylǵan kúni", "eng": "Date of creation"},
    "staticValue": {}, "chosenAccessRight": false, "unacceptableValue": false, "isSystem": false,
    "isCodeReadonly": false, "needLoadFromInTables": false, "useAsKeyInMigration": false,
    "needUploadToOutTable": false, "needChangeParentBoByLinkedBo": false, "needFreezeWhenScroll": false,
    "needMarkNew": false,
    "type": "FULL_DATE",                                   ← fixed by the platform, see the table
    "groupingInfo": {}, "gridPosition": {"x":0,"y":<y>,"cols":15,"rows":4},
    "fieldTabs": {}, "gantTableLocations": {}, "boFieldCodes": [], "linkedCoSettings": {},
    "questionnaires": {}, "progressSteps": {}, "params": {}
  }
}
```

| native type | UI label | `type` | note |
|---|---|---|---|
| `CREATED_AT` | Дата создания | `FULL_DATE` | |
| `LAST_MODIFIED_AT` | Дата последнего изменения | `FULL_DATE` | |
| `CREATED_BY` | Автор | `BO` | + `viewType: "SINGLE"` and `boRefStruct.boInfo` = `Person` / «Пользователи» / `BO`, 6 rows; **no `oldRefBoId`** — the target is resolved by that code, so no stand id is needed `[C]` |
| `LAST_MODIFIED_BY` | Автор последнего изменения | `BO` | same |
| `OPEN_COUNT` | Счетчик открытий | `INPUT_NUMBER` | |
| `IN_MIGRATION_UPDATED_AT` | Дата обновления IN миграции | `FULL_DATE` | |

`PARTICIPANTS` («Участники») is in the enum but **cannot be created**: the palette never offers it and
`generate-business-form-field-by-native` answers with an empty body `[C]`. Each system field may be placed
**once** per BO.

**What travels for a system field** `[C]`:

| key in `nativeFields.<TYPE>` | export writes it | import applies it |
|---|---|---|
| `label` (rename), `hideLabel` | yes | yes |
| `viewType` `TABLE`/`SINGLE` + `boRefStruct.fieldRefs.<code of a «Пользователи» field>.toShow` (`CREATED_BY`, `LAST_MODIFIED_BY` only) | yes, by field CODE (`surname`, `name`, `adGuid`, `Position__Object_`…) | yes |
| `chosenAccessRight` | yes | yes — but see the lock |
| `needUploadToOutTable` | **no** (`false` even when the stand has `true`) | **no** |
| `needLoadFromInTables`, `inMigrationTimezoneMinutes`, `isRequired` | — (the stand never stores them on a native) | no |
| `isReadonly` | — | irrelevant: a native is always read-only |

- **The lock does NOT travel.** The export puts it into the `AccessStructDto` under
  `fieldAccessStructMap.<NATIVE_TYPE>`; the import ignores that entry (keying it by the native's
  `newId` or by `N-<TYPE>` does not work either), while a dynamic field's lock in the same archive is applied. Since
  `chosenAccessRight: true` IS applied, the imported BO shows an orange lock over rights that are «всем».
  So leave `chosenAccessRight: false` on natives in an archive and set native rights over the API after the
  import (§8 «After the import — the stand-side calls»).
- The constructor offers no settings on `CREATED_AT`, `LAST_MODIFIED_AT`, `OPEN_COUNT`,
  `IN_MIGRATION_UPDATED_AT` beyond the label; `CREATED_BY` / `LAST_MODIFIED_BY` add the view and columns.

### 0.13 Widgets — six maps of their own

«Виджеты» are neither `dynamicFields` nor `nativeFields`: each family has its own map in `BoStructDto`,
keyed by the widget's CODE `[C]`:

| widget | UI label | map | extra keys |
|---|---|---|---|
| `SIGNATURE` | ЭЦП / СМС | `signatures` | `fieldCodes`, `massFieldCodes`, `printFormCodes`, `massPrintFormCodes` (all may be `{}`), `signingPhoneCode` — see «SIGNATURE round-trips» below |
| `BUTTON` | Кнопка | `buttons` | `url`, `fieldCodes` (`{"<field code>": "<archetype>"}`) |
| `IFRAME` | Блок IFrame | `iframes` | `url` |
| `CAPTCHA` | Блок captcha | `captcha` | — (code only; a captcha blocks API saves, see «CAPTCHA round-trips» below) |
| `CURRENT_DATE` `CURRENT_DAY` `CURRENT_MONTH` `CURRENT_DAY_AND_MONTH` `CURRENT_YEAR` | Текущая дата / день / месяц / день и месяц / год | `currentDates` | `widgetType` repeats the type (code only; the value is never stored, see «CURRENT_* date widgets round-trip» below) |
| `CURRENT_USER` | Текущий пользователь | `currentUser` | `viewType: "TABLE"`, `fieldRefs` |

One entry looks like this — there are no boolean flags at all, unlike a dynamic field:

```text
"buttons": {"button": {"label": {"rus": "Кнопка"},
  "gridPosition": {"x":0,"y":<y>,"cols":15,"rows":4},
  "code": "button", "type": "BUTTON", "newId": "<16 chars>",
  "url": "", "fieldCodes": {}}}
```

Heights: 4 rows for a button and the CURRENT_* widgets, 6 for `SIGNATURE` / `CAPTCHA` / `CURRENT_USER`,
8 for `IFRAME`. A widget's code and url survive an import and can be read back through the widget's own
controller (`MYBPM-UI-API.md` §5i). `SIGNATURE` and every CURRENT_* widget may be placed **once** per BO;
`BUTTON`, `IFRAME` and `CAPTCHA` may repeat.

**A button's and an iframe's settings round-trip through an archive** `[C]`: code, `url` and `fieldCodes` of
every button, and the iframe's code and `url`. A button's `fieldCodes` is its «Поля для отправки»: a
map from field CODE to that field's archetype:

```text
"buttons": {"plugin": {"label": {"rus": "Плагин"}, "gridPosition": {"x":0,"y":22,"cols":15,"rows":4},
  "code": "plugin", "type": "BUTTON", "newId": "<16 chars>",
  "url": "call/plugin/<plugin name>/<anything>", "fieldCodes": {"text": "DYNAMIC", "answer": "DYNAMIC"}}}
```

The import turns the codes back into the ids of the copy's own fields. What a url does on the record
card `[C]`:

- **empty** — nothing besides the button's field script. **This is the button to build**: put the logic
  into a script on «Изменение поля» (below).
- `call/plugin/<name>/…` — calls a plugin installed on the SERVER under `<name>`. An unknown name gives
  «No such plugin». `fieldCodes` only matters to such a plugin.
- `client/save-current-boi` — **does nothing, the record is not saved** (no component of the client
  listens to that event).
- `create-boi/<field code>/<from->to, …>` — **does nothing on the record card** (only another, unused
  form handles it).
- anything else, `https://…` included — nothing. A button never navigates.

An iframe `url` must be `https:`. The stand silently drops an `http:` url, both from the settings
dialog and over the API. The iframe shows the same fixed url on every record, and it is not told which
record it is on.

**A script on a button = a field script on the button's code** — the ordinary «На изменение поля»
trigger. A click fires it, and each further click fires it again; leave `url` empty for a script-only
button (`MYBPM-UI-API.md` §5i «A BUTTON runs a script»). On a stand it is wired by `fieldId`
through `save-bo-scripts` `[C]`. In an archive it is
`fieldScripts: {"<button code>": "<scriptId>"}` (§5d, `tools/add-bo-scripts.bun.ts --bodies` with hook
`field:<button code>`), keyed like any field `[C]`.

**CURRENT_USER («Текущий пользователь») round-trips through an archive** `[C]`:
the code, `viewType`, the columns and the lock.

```text
"currentUser": {"current_user": {"label": {"rus": "Текущий пользователь"},
  "gridPosition": {"x":0,"y":38,"cols":15,"rows":6},
  "code": "current_user", "type": "CURRENT_USER", "newId": "<16 chars>",
  "viewType": "SINGLE",
  "fieldRefs": {"surname": {"toShow": true, "orderIndex": 0},
                "email":   {"toShow": true, "orderIndex": 1},
                "name":    {"toShow": false, "orderIndex": 2147483647}, …}}}
```

- **What the widget is**: on a record card it shows the person who OPENS the card, never the author. A
  record stores no value for it. To record who created or changed a record, use the system fields
  `CREATED_BY` / `LAST_MODIFIED_BY` (§0.12).
- `viewType` is `TABLE` or `SINGLE`, nothing else.
- `fieldRefs` is keyed by the CODES of the «Пользователи» (Person) BO's fields. The export lists all of
  them; hidden ones have `toShow: false` and `orderIndex: 2147483647`. Codes on one stand:
  «Фамилия» = `surname`, «Имя» = `name`, «Почта» = `email`, «Роль» = `accessLevel`, «Должность» =
  `position`. Codes may differ on another stand: read them from an export of that stand.
- **`fieldRefs: {}` and no `viewType` are safe**: the imported widget is `TABLE` with
  «Фамилия» + «Имя» shown, the server's own default. **A partial map is enough too**:
  `{"surname": {"toShow": true, "orderIndex": 0}, "accessLevel": {"toShow": true, "orderIndex": 1}}`
  imports as exactly «Фамилия», «Роль», with every unlisted field hidden.
  `tools/make-probe-archive.bun.ts --widget "CURRENT_USER:<label>:<code>:SINGLE/surname,email"` writes it
  that way. Without the 4th part it writes `TABLE` + `{}`.
- The widget's **lock** travels as a normal `fieldAccessStructMap.<widget code>` entry of the
  `AccessStructDto` (§7). Shipping an `AccessStructDto` replaces the BO's rights (§0.9 rule 10), so do it
  only for a BO the archive creates, or when asked.
- One CURRENT_USER per BO.

**SIGNATURE («ЭЦП / СМС») round-trips through an archive** `[C]`, both as a copy under a new BO code
(new `oldId`, new `newId`s) and as an archive generated by `tools/make-probe-archive.bun.ts`: the code,
the signed fields, the mass field, the phone, the print forms and the lock come back (re-importing onto
the SAME BO behaves differently — see `signingPhoneCode` and «Print forms» below):

```text
"signatures": {"signature": {"label": {"rus": "ЭЦП/SMS"},
  "gridPosition": {"x":0,"y":48,"cols":15,"rows":6},
  "code": "signature", "type": "SIGNATURE", "newId": "<16 chars>",
  "fieldCodes": {"text":   {"ownerFieldArchetype": "DYNAMIC", "fieldCodes": []},
                 "regions": {"boRefCode": "<code of the linked BO>", "ownerFieldArchetype": "DYNAMIC",
                             "fieldCodes": [{"fieldCode": "regions", "refBoCode": "<code of the linked BO>",
                                             "refFieldCode": {"fieldCode": "name", "archetype": "DYNAMIC"},
                                             "archetype": "DYNAMIC"}]}},
  "massFieldCodes": {"regions": {"ownerFieldArchetype": "DYNAMIC", "fieldCodes": []}},
  "printFormCodes": {"Dogovor": 1},
  "massPrintFormCodes": {"<code of the linked BO>": {"<its print form code>": 1}},
  "signingPhoneCode": "Telefon"}}
```

- **`fieldCodes`** = «Поля для подписания», keyed by this BO's field CODE. A plain field is
  `{"ownerFieldArchetype": "DYNAMIC", "fieldCodes": []}`. For a BO field the inner `fieldCodes` lists the
  linked BO's fields to sign («Регионы - Название»). After the import `load-signature-settings` returned only the listed child,
  not the BO field itself (the constructor still drew both chips), so list the child you want.
- **`massFieldCodes`** = the BO fields whose LINKED records are signed in bulk. Each must be a `BO` field.
  On the stand the bulk documents can only be chosen when the linked BO has its OWN SIGNATURE widget with
  something to sign (`MYBPM-UI-API.md` §5i).
- **`printFormCodes`** = «Документы для подписания», `{<print form code of THIS BO>: 1}`. The code must be in
  the BO's `printForms` (below). **`massPrintFormCodes`** = `{<linked BO code>: {<its print form code>: 1}}`.
  **It never survives an import** `[C]`: not as a copy, not re-imported onto the same BO, and not when the
  linked BO and that print form travel in the SAME archive. Cause `[I]`: the stand never offers a linked BO's print form for mass signing
  (`signFieldUnsupported`, `MYBPM-UI-API.md` §5i). After the import set it over the API: `save-signature-settings` with
  `addMassPfRecord: [{boId, printFormId}]` is accepted (§8 «After the import — the stand-side calls»).
- **`signingPhoneCode`** = «Указать номер для подписания», the CODE of an `INPUT_PHONE` field. Leave it out
  for none. A copy (a new BO) gets it, but **re-importing onto the SAME BO clears the phone** `[C]`. Set it again with `save-signature-settings {signingPhoneId}`.
- The **lock** travels as `fieldAccessStructMap.<signature code>` of the `AccessStructDto` (§7), with
  `view.orgUnitIds` like `"D-<department id>"`. The export also adds an `ExportStructInstanceDto` line for each
  group it names. An `AccessStructDto` replaces the BO's rights (§0.9 rule 10).
- On the record card the signing TYPE (ЭЦП or SMS) is chosen by the user per signing. It is not part of the
  archive.
- Generator: `--widget "SIGNATURE:ЭЦП/SMS:signature:text,answer;phone=phone;pf=contract;mass=regions"`.
  The 4th part holds the codes of the fields to sign, then optional `phone=`, `pf=` and `mass=`. The
  validator checks every code against the BO.

**CAPTCHA («Блок captcha») round-trips through an archive — and BLOCKS every save that changes a record**
`[C]`: the code (renamed in the archive too) and the lock come back.

```text
"captcha": {"captcha": {"label": {"rus": "Блок captcha"},
  "gridPosition": {"x":0,"y":54,"cols":15,"rows":6},
  "code": "captcha", "type": "CAPTCHA", "newId": "<16 chars>"}}
```

- The entry has **no setting of its own** beyond the code. The map key and `code` are the same code.
  Without one the server derives `Blok_captcha` from the label.
- The **lock** (who sees the widget, VIEW only) travels as `fieldAccessStructMap.<captcha code>` of the
  `AccessStructDto` (§7). «Только участники» exported as `"view": {"denyAll": true, "participants": true, …}`.
  An `AccessStructDto` replaces the BO's rights (§0.9 rule 10).
- **The server enforces it.** With a CAPTCHA on the BO, `validate-apply-remove-draft` of a draft that
  CHANGED a value, or of a NEW record, answers `CaptchaNotVerified` («Капча не верифицирована») until the
  captcha of that draft is solved on the card. A draft with no changes still saves. The four-call record
  cycle (`apply-and-remove-draft`) is refused the same way. So **a BO with a
  captcha cannot take records from the record API (`MYBPM-UI-API.md` §6a) or any headless client**.
  Whether Block IDE scripts and the xlsx import are blocked too is `[U]`. Put a captcha only on a BO that
  people fill in by hand.
- `CAPTCHA` may repeat on a BO (the palette keeps offering it). Height 6 rows.

**CURRENT_* date widgets («Текущая дата / день / месяц / день и месяц / год») round-trip through an archive**
`[C]`: every code and every lock comes back as written, in a copy and in a generated archive.

```text
"currentDates": {"current_date": {"label": {"rus": "Текущая дата"},
  "gridPosition": {"x":0,"y":60,"cols":15,"rows":4},
  "code": "current_date", "type": "CURRENT_DATE", "newId": "<16 chars>", "widgetType": "CURRENT_DATE"}}
```

- **All five types share ONE map**, `currentDates`, keyed by the widget code. `type` and `widgetType`
  both carry the type. There is no other setting: the gear holds only the code.
- Without a code the server derives one from the label, transliterating «й» as `yi`: «Текущая дата» →
  `Tekuschaya_data`, «Текущий день и месяц» → `Tekuschiyi_den_i_mesyac`.
- The **lock** (VIEW only) travels as `fieldAccessStructMap.<widget code>` of the `AccessStructDto` (§7),
  like CAPTCHA and CURRENT_USER. An `AccessStructDto` replaces the BO rights (§0.9 rule 10).
- **The widget stores nothing.** The card shows the server time from when the draft was opened. It is a
  disabled date picker in the format `dd.MM.yyyy` / `dd` / `LLLL` (the month name, «октябрь») / `dd.MM` /
  `yyyy`. `load-field-data` returns that time as an ISO string, a new one for every draft. A value
  written into it over the API is accepted and then ignored. `load-boi-values` does not list the widget at all.
  Do not use it as a «date of creation» field: that is the native `CREATED_AT` (§0.12).
- The palette offers each type once per BO, but **the server accepts a second widget of the same type**
  over the API, with its own code. Height 4 rows.
- Generator: `--widget "CURRENT_DATE:Сегодня:Segodnya"` (any of the five types). The validator checks
  that `widgetType` equals `type`.

**Print forms (`printForms`) travel WITH their .docx template** `[C]`. A BO lists
them as

```text
"printForms": [{"name": "Договор", "printFormCode": "Dogovor", "fileId": "<24 hex>",
                "fileType": "PDF", "orderIndex": 0, "newId": "<16 chars>"}]
```

and the archive carries the file itself in a separate line, placed BEFORE the `BoStructDto` in an export:

```text
{"@class": "kz.greetgo.mybpm.reg.structure.model.dto.ExportStructFileDto", "fileId": "<the same 24 hex>",
 "name": "dogovor.docx", "content": "<the .docx, base64>",
 "mimeType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}
```

- `fileType` is the OUTPUT format, `PDF` or `DOCX`. The template is always a .docx.
- **The import uploads the file anew**: the imported form gets a NEW `fileId` and keeps the original name. A generated archive needs only an id that ties `printForms[].fileId` to its
  `ExportStructFileDto`. The generator uses 24 upper-case hex characters, which is what the stand writes.
- The code comes from the name if you build the form on the stand («Договор» → `Dogovor`). In an archive
  it is whatever `printFormCode` says. **The code is not unique**: two forms of one BO with the same name
  both get the same code (`PF_regiona`) `[C]`.
- **A re-import matches print forms by `newId`, NOT by `printFormCode`** `[C]`. The same archive applied
  twice updates its form in place. A fresh stand EXPORT of the same BO gives every form a new `newId`, so
  re-importing it onto that BO ADDS a copy of each form (same name, same code), and a SIGNATURE that lists
  the code picks up the copy too. **A rollback does not remove such copies — it adds one more** of each
  (`MYBPM-UI-API.md` §5 «Rollback trap»). Before re-importing an export onto the BO it came from, drop its `printForms` (and their
  `ExportStructFileDto` lines) unless the forms changed; delete stray copies with `delete-print-form`
  (§8 «After the import — the stand-side calls»).
- Generator: `--print-form "Договор:Dogovor:path/to/template.docx[:PDF|DOCX]"`, repeatable. A minimal
  three-part .docx (`[Content_Types].xml`, `_rels/.rels`, `word/document.xml`) is accepted. Template
  placeholders were not explored `[U]`. The stand-side API for print forms is `MYBPM-UI-API.md` §5i
  «Print forms».

### 0.14 Kanban — the card template travels in the archive `[C]`

A kanban is TWO things, and the archive can carry BOTH:

- the **card template**, ON THE BO in `kanbanCardTemplates` — one per `DROPDOWN_SINGLE`, even unasked, its
  shape and the «cardTemplate is null» failure: 0.5c (the MAP view dies the same way, §2 «BO views»). It
  belongs to the BO, not to any menu item: whatever place shows this BO as a board reads it from here. A
  BO already broken so is repaired by re-importing its line with the template (keep the `kanbanFields` wrapper —
  without it the import is APPLIED and changes nothing); `save-kanban-card-template` does not repair it.
- the **place that shows the board**, with its column field `[C]`. Two exist:
  - the **BO's own registry** (opened from «Бизнес-объекты», not from a menu) needs NO switch: its view chooser
    lists «Канбан по полю: <label>» for every `DROPDOWN_SINGLE` of the BO by itself, and the board renders
    (columns = the options, cards = the template). **A local list («Задать вручную», `FROM_FIELD`) qualifies
    exactly like a dictionary (`FROM_BO`)** `[C]`: `v2/kanban/load-kanban-fields` lists both kinds and the
    board of a local list shows its options as columns — whatever an editor's empty-state text says about
    «выпадающий список типа СПРАВОЧНИК»;
  - a **SIDEBAR MENU ITEM** shows it only when switched on — `boPages.isKanbanEnabled` + the column field; a menu
    line of the SAME archive does it by code, `boPages.kanbanFieldCode` (0.15, §5e), or
    `v2/menu-item/save-menu-item-bo-pages` after the import (`MYBPM-UI-API.md` §4). Give the user a menu item
    when the board must be one click away.
  Nowhere else: the constructor offers a `BO` / `CO` reference field only Табличный / Множественный / Одиночный /
  Карточкой and a panel registry only Табличный / Множественный. The client's `viewType` enum also lists
  `KANBAN` / `CALENDAR` / `MAP` / `TIMELINE`, but no screen sets them — never ship them in a field's `viewType`.

With the template shipped, `v2/kanban/load-kanban-template` returns a `cardTemplate` instead of NPE-ing,
the board renders its columns, and `load-bracket-kanban-cards` returns the cards with their
header/content/footer values `[C]`. **On a stand with the sort defect the cards still do not appear in
the UI** — a second, unrelated defect of every NEW BO there blocks the default sort (`MYBPM-UI-API.md` §7;
what an archive can do about it is the next paragraph).

**The Elasticsearch sort defect — what the archive must do about it, ONLY on a stand known to have it**
`[C]`. **Apply this paragraph only when the user says the target stand
has the defect** (or you saw a new BO's registry there show «из N» over an empty table). Otherwise build
the default registry of 0.5 — name field first and visible — and do not mention the defect. On such a stand every BO created by the current version (archive AND constructor
alike) gets an index in which a string field cannot be sorted once any record holds a value in it. The
registry sorts by default by its FIRST column, and clicking any column header sorts by that column —
so a registry (and a kanban, same query) whose columns include a FILLED string field shows «из N» with an
empty table and invisible cards. Old BOs never fail; a field left empty everywhere sorts fine. **Nothing
repairs the index; the only measure that holds is to keep string fields that will hold values OUT of the
registry columns**: `tableColToShow: false` on them. Seen failing: `INPUT_TEXT` and `DROPDOWN_SINGLE`;
assume every field whose value is a string does (`TEXTAREA`, `INPUT_EMAIL`, `INPUT_PHONE`, `LINK`,
`*_LANG` `[I]`). Seen safe as columns: `INPUT_NUMBER`, `CHECKBOX`, `DATE`, a `BO` reference,
`CREATED_AT` — put one of them first (`tableColOrderIndex` 0). Reordering alone is NOT enough — the text column breaks the
moment someone clicks its header. Two limits: `sortFieldId` changes nothing, and a BO with **no**
registry column at all answers «У Вас недостаточно прав на поля, которые выведены в реестр» — keep at
least one safe column. Whether another stand has the defect is unknown `[U]`: if a new BO's registry
there shows rows with text columns on, ignore this paragraph.
One archive with the BO + its card template + a menu group + a menu item with `kanbanFieldCode` renders the
whole board with its columns straight after ПРИМЕНИТЬ `[C]` (§5e).

### 0.15 Sidebar menu items — `MenuItemStructDto` lines `[C]`

The line, its `BO` / `GROUP` templates, `boPages` with the kanban variant and the basic rules are 0.5d. Views
such as a kanban are an option ON an item, not the reason for it. Six views exist; what each needs besides
its flag:

| View | Keys | Needs on the BO / on the item | Status |
|------|------|-------------------------------|--------|
| list (registry) | `isListEnabled`, `listIndex` | nothing | `[C]` |
| kanban | `isKanbanEnabled`, `kanbanIndex` | `kanbanFieldCode` = code of a `DROPDOWN_SINGLE` of the BO (the columns) AND that field's card template in the BO's `kanbanCardTemplates` (0.14) | `[C]` |
| calendar | `isCalendarEnabled`, `calendarIndex` | the BO's `isCalendarEnabled: true` and a date field (`FULL_DATE` with `needShowToCalendar`) — nothing on the item | `[C]` |
| timeline («Диаграмма Ганта») | `isTimelineEnabled`, `timelineIndex` | **`timelineFieldCode`** = code of a `PERIOD` / `PERIOD_TIME` field of the BO (the import resolves it into the item's `timelineFieldId`); the BO needs nothing else — a timeline template exists by itself for every such field | `[C]` |
| map | `isMapEnabled`, `mapIndex` | the BO's `isMapEnabled`, a `GEO_POINT`, and a kanban card template for every dropdown (0.14) — nothing on the item | `[C]` |
| grouping | `isGroupingEnabled`, `groupingIndex` | nothing works: the registry grouping view is 404 on the server (§2 «BO views») — never enable it | `[C]` dead |

**Do not switch on grouping (or any view not marked `[C]` above) in an archive** — if the user asks for it, say it
does not work and ship the rest.

More rules `[C]`:

- **Icons**: the rules are 0.5d `iconName`. When the user describes an icon by meaning («домик», «деньги»,
  «люди»), pick the closest name of 0.16 and SAY which one you took; the stand ships only part of the
  Phosphor set (`phosphor:seal-check`, `ranking`, `toolbox`, `gavel` do not exist there).
- Menu access rights travel `[C]` (§5e): `chosenAccessRight: true` plus an `accessGroup` key —
  the same shape as `AccessStructDto.boAccessStruct` (`denyAll`, per action `{denyAll, participants,
  fromFields, orgUnitIds:["G-<group id>"]}`, only `view` matters for navigation). Without `accessGroup`
  keep `chosenAccessRight: false`. **Menu rights do not cascade** `[C]`: a closed GROUP item only drops out of
  the sidebar root, every item is filtered by its own `view` — put the rule on each item that must be
  hidden. Menu rights hide a SCREEN, never records: a user with an open item but no BO `view` gets an empty
  registry, and the reverse — records stay reachable whatever the menu says — is why the BO's own rights
  (§7) are the protection.
- **One BO, several items** `[C]` (0.2c step 9): each item is its own line with its own `menuItemCode`,
  `menuItemName`, `boPages` and `bracketFilter`; `boCode` is the same. Filters an archive carries `[C]`:
  records I created (`nativeFilters` `CREATED_BY` + `isCurrentUser: true`), a checkbox value
  (`type: "CHECKBOX"`, `value: "true"`), a text value (`INPUT_TEXT`), a dictionary dropdown value
  (`type: "DROPDOWN_SINGLE"`, `value` = the dictionary ROW `code`, 0.5b). A local-list dropdown value and a
  `Person` field with `isCurrentUser` are `[U]` — prefer `CREATED_BY`. The brackets shape is §5e; a status
  filter entry:
  ```json
  "bracketFilter":{"boCode":"Work_order","type":"MENU_ITEM","brackets":{"aB3dE5gH":{"parentTreeIds":{},
    "order":0,"connectionType":"AND","notType":"DEFAULT","nativeFilters":{},"dynamicFilters":{"kL7mN9pQ":{
    "fieldCode":"status","type":"DROPDOWN_SINGLE","value":"in_work","numberFrom":0,"numberTo":0,
    "isCurrentUser":false,"isEmptyValue":false,"boiIds":{},"fromFieldCodes":{}}}}}}
  ```
- **A menu-only archive is legal** `[C]`: one `MenuItemStructDto` line and nothing else (no group line,
  no BO line) imports fine when its `boCode` is already on the stand — the way to add or change a sidebar
  item for an existing BO. The `boCode` is then a stand code: ask for it (0.2a).

### 0.16 Menu icons — the whole catalogue `[C]`

Every value `iconName` of a menu line (0.15) may take besides the three defaults. It is the list the
sidebar's «Изменить иконку» picker offers — 1153 names in two namespaces — and every one of them exists
on the stand as the file `/assets/icons/<namespace>/<name>.svg`; the sidebar
draws the icon from that file. The archive route: 0.5d `iconName` and §5e.

How to write a name: `<namespace>:<name>`, e.g. `phosphor:rocket`, `menu-item:025-building`. Names in
«» contain a SPACE, and the space is part of the name (`"menu-item:002-price tag"` — stored and drawn
as is `[C]`, the frontend URL-encodes it). «tab N (head icon X)» is the picker's N-th tab from the left and the picture on its header — it
only helps to find an icon in the UI and means nothing in the archive. The list lives in the stand's
frontend and may grow with a new build; if `tools/` is available, `tools/menu-icons.bun.ts --stand
https://<stand> --check --md` re-reads it from a stand and prints this block again.

`phosphor:` —
- tab 1 (head icon `recycle`, 111): arrow-arc-left arrow-arc-right arrow-bend-double-up-left arrow-bend-double-up-right arrow-bend-down-left arrow-bend-down-right arrow-bend-left-down arrow-bend-left-up arrow-bend-right-down arrow-bend-right-up arrow-bend-up-left arrow-bend-up-right arrow-circle-down arrow-circle-down-left arrow-circle-down-right arrow-circle-left arrow-circle-right arrow-circle-up arrow-circle-up-left arrow-circle-up-right arrow-clockwise arrow-counter-clockwise arrow-down arrow-down-left arrow-down-right arrow-elbow-down-left arrow-elbow-down-right arrow-elbow-left arrow-elbow-left-down arrow-elbow-left-up arrow-elbow-right arrow-elbow-right-down arrow-elbow-right-up arrow-elbow-up-left arrow-elbow-up-right arrow-fat-down arrow-fat-left arrow-fat-line-down arrow-fat-line-left arrow-fat-line-right arrow-fat-line-up arrow-fat-lines-down arrow-fat-lines-left arrow-fat-lines-right arrow-fat-lines-up arrow-fat-right arrow-fat-up arrow-left arrow-line-down arrow-line-down-left arrow-line-down-right arrow-line-left arrow-line-right arrow-line-up arrow-line-up-left arrow-line-up-right arrow-right arrow-square-down arrow-square-down-left arrow-square-down-right arrow-square-in arrow-square-left arrow-square-out arrow-square-right arrow-square-up arrow-square-up-left arrow-square-up-right arrow-u-down-left arrow-u-down-right arrow-u-left-down arrow-u-left-up arrow-u-right-down arrow-u-right-up arrow-u-up-left arrow-u-up-right arrow-up arrow-up-left arrow-up-right arrows-clockwise arrows-counter-clockwise arrows-down-up arrows-horizontal arrows-in arrows-in-cardinal arrows-in-line-horizontal arrows-in-line-vertical arrows-in-simple arrows-left-right arrows-out arrows-out-cardinal arrows-out-line-horizontal arrows-out-line-vertical arrows-out-simple arrows-vertical caret-circle-double-down caret-circle-double-left caret-circle-double-right caret-circle-double-up caret-circle-down caret-circle-left caret-circle-right caret-circle-up caret-double-down caret-double-left caret-double-right caret-double-up caret-down caret-left caret-right caret-up recycle
- tab 2 (head icon `radio`, 54): address-book asterisk asterisk-simple at broadcast chat chat-centered chat-centered-dots chat-centered-text chat-circle chat-circle-dots chat-circle-text chat-dots chat-teardrop chat-teardrop-dots chat-teardrop-text chat-text chats chats-circle chats-teardrop envelope envelope-open envelope-simple envelope-simple-open export hash hash-straight megaphone megaphone-simple paper-plane paper-plane-right paper-plane-tilt peace phone phone-call phone-disconnect phone-incoming phone-outgoing phone-slash phone-x quotes radio rss rss-simple share share-network star star-half sticker thumbs-down thumbs-up translate voicemail yin-yang
- tab 3 (head icon `game-controller`, 42): alien baseball basketball club confetti crown crown-simple diamond dice-five dice-four dice-one dice-six dice-three dice-two finn-the-human flying-saucer football game-controller ghost heart heart-break heart-straight heart-straight-break horse mask-happy mask-sad medal parachute pinwheel poker-chip puzzle-piece scroll skull soccer-ball spade spiral strategy sword target tennis-ball trophy volleyball
- tab 4 (head icon `microphone-stage`, 86): airplay aperture article article-medium article-ny-times camera camera-rotate camera-slash closed-captioning copyleft copyright corners-in corners-out disc ear ear-slash eject eject-simple equalizer faders faders-horizontal fast-forward fast-forward-circle film-script film-slate film-strip frame-corners gif headphones headset image image-square microphone microphone-slash microphone-stage music-note music-note-simple music-notes music-notes-plus music-notes-simple newspaper newspaper-clipping pause pause-circle piano-keys picture-in-picture play play-circle playlist queue record repeat repeat-once rewind rewind-circle screencast shuffle shuffle-angular shuffle-simple skip-back skip-back-circle skip-forward skip-forward-circle sliders sliders-horizontal speaker-high speaker-low speaker-none speaker-simple-high speaker-simple-low speaker-simple-none speaker-simple-slash speaker-simple-x speaker-slash speaker-x stop stop-circle television television-simple video-camera video-camera-slash wave-sawtooth wave-sine wave-square wave-triangle webcam
- tab 5 (head icon `lock-key`, 35): circle-wavy circle-wavy-check circle-wavy-question circle-wavy-warning detective fingerprint fingerprint-simple info key keyhole lock lock-key lock-key-open lock-laminated lock-laminated-open lock-open lock-simple lock-simple-open password prohibit prohibit-inset question shield shield-check shield-checkered shield-chevron shield-plus shield-slash shield-star shield-warning vault wall warning warning-circle warning-octagon
- tab 6 (head icon `google-chrome-logo`, 48): android-logo angular-logo app-store-logo apple-logo apple-podcasts-logo behance-logo codepen-logo codesandbox-logo discord-logo dribbble-logo facebook-logo figma-logo framer-logo github-logo gitlab-logo gitlab-logo-simple google-chrome-logo google-logo google-photos-logo google-play-logo google-podcasts-logo instagram-logo linkedin-logo linux-logo medium-logo messenger-logo microsoft-excel-logo microsoft-powerpoint-logo microsoft-teams-logo microsoft-word-logo ny-times-logo phosphor-logo pinterest-logo reddit-logo sketch-logo slack-logo snapchat-logo spotify-logo square-logo stack-overflow-logo stripe-logo telegram-logo tiktok-logo twitch-logo twitter-logo whatsapp-logo windows-logo youtube-logo
- tab 7 (head icon `palette`, 88): align-bottom align-bottom-simple align-center-horizontal align-center-horizontal-simple align-center-vertical align-center-vertical-simple align-left align-left-simple align-right align-right-simple align-top align-top-simple bezier-curve bounding-box circle circle-dashed circle-half circle-half-tilt circle-notch circles-four circles-three circles-three-plus columns crop cube cylinder diamonds-four drop-half drop-half-bottom eraser eye eye-closed eye-slash eyedropper eyedropper-sample flow-arrow gradient grid-four hexagon highlighter-circle intersect layout line-segment line-segments magic-wand marker-circle octagon paint-brush paint-brush-broad paint-brush-household paint-bucket paint-roller palette pen pen-nib pen-nib-straight pencil pencil-circle pencil-line pencil-simple pencil-simple-line perspective placeholder polygon rectangle rows ruler scissors scribble-loop selection selection-all selection-background selection-foreground selection-inverse selection-plus selection-slash sidebar sidebar-simple square square-half square-half-bottom squares-four stack stack-simple stamp swatches triangle vignette
- tab 8 (head icon `heartbeat`, 18): activity bandaids barbell bed brain face-mask first-aid first-aid-kit flask hand-soap heartbeat lifebuoy pill prescription syringe test-tube toilet toilet-paper
- tab 9 (head icon `paperclip`, 115): archive archive-box archive-tray briefcase briefcase-metal cards clipboard clipboard-text copy copy-simple cursor-text file file-arrow-down file-arrow-up file-audio file-cloud file-code file-css file-csv file-doc file-dotted file-html file-image file-jpg file-js file-jsx file-lock file-minus file-pdf file-plus file-png file-ppt file-rs file-search file-text file-ts file-tsx file-video file-vue file-x file-xls file-zip files floppy-disk floppy-disk-back folder folder-dotted folder-lock folder-minus folder-notch folder-notch-minus folder-notch-open folder-notch-plus folder-open folder-plus folder-simple folder-simple-dotted folder-simple-lock folder-simple-minus folder-simple-plus folder-simple-star folder-simple-user folder-star folder-user folders funnel funnel-simple kanban list list-bullets list-checks list-dashes list-numbers list-plus note note-blank note-pencil notebook notepad paperclip paperclip-horizontal presentation presentation-chart printer projector-screen projector-screen-chart push-pin push-pin-simple push-pin-simple-slash push-pin-slash sort-ascending sort-descending text-aa text-align-center text-align-justify text-align-left text-align-right text-bolder text-h text-h-five text-h-four text-h-one text-h-six text-h-three text-h-two text-indent text-italic text-outdent text-strikethrough text-t text-underline textbox trash trash-simple tray
- tab 10 (head icon `desktop-tower`, 119): app-window backspace battery-charging battery-charging-vertical battery-empty battery-full battery-high battery-low battery-medium battery-plus battery-warning battery-warning-vertical bell bell-ringing bell-simple bell-simple-ringing bell-simple-slash bell-simple-z bell-slash bell-z bluetooth bluetooth-connected bluetooth-slash bluetooth-x browser browsers cell-signal-full cell-signal-high cell-signal-low cell-signal-medium cell-signal-none cell-signal-slash cell-signal-x check check-circle check-square check-square-offset checks cloud-arrow-down cloud-arrow-up cloud-check cloud-slash command computer-tower cursor desktop desktop-tower device-mobile device-mobile-camera device-mobile-speaker device-tablet device-tablet-camera device-tablet-speaker dots-nine dots-six dots-six-vertical dots-three dots-three-circle dots-three-circle-vertical dots-three-outline dots-three-outline-vertical dots-three-vertical download download-simple flashlight gauge gear gear-six hard-drive hard-drives key-return keyboard laptop lightbulb lightbulb-filament lightning lightning-slash link link-break link-simple link-simple-break link-simple-horizontal link-simple-horizontal-break magnifying-glass magnifying-glass-minus magnifying-glass-plus monitor monitor-play mouse mouse-simple notification nut option plug plugs plugs-connected power qr-code radio-button scan sign-in sign-out sim-card spinner spinner-gap swap tabs toggle-left toggle-right upload upload-simple vibrate wifi-high wifi-low wifi-medium wifi-none wifi-slash wifi-x wrench
- tab 11 (head icon `currency-dollar`, 74): armchair backpack bag bag-simple balloon barcode bathtub beer-bottle binoculars brandy buildings cake cardholder coat-hanger coffee coin coin-vertical coins cookie cooking-pot credit-card currency-btc currency-circle-dollar currency-cny currency-dollar currency-dollar-simple currency-eth currency-eur currency-gbp currency-inr currency-jpy currency-krw currency-kzt currency-ngn currency-rub egg egg-crack eyeglasses factory fork-knife gift hamburger handbag handbag-simple knife ladder ladder-simple lamp martini money needle package pizza popcorn receipt rug scales shopping-bag shopping-bag-open shopping-cart shopping-cart-simple shower storefront sunglasses t-shirt tag tag-chevron tag-simple ticket tote tote-simple trademark-registered wallet wine
- tab 12 (head icon `code`, 23): brackets-angle brackets-curly brackets-round brackets-square bug bug-beetle bug-droid code code-simple cpu database git-branch git-commit git-diff git-fork git-merge git-pull-request magnet magnet-straight robot terminal terminal-window tree-structure
- tab 13 (head icon `map-pin-line`, 50): airplane airplane-in-flight airplane-landing airplane-takeoff airplane-tilt anchor anchor-simple barricade bicycle boat bus car car-simple compass crosshair crosshair-simple door flag flag-banner flag-checkered gas-pump globe globe-hemisphere-east globe-hemisphere-west globe-simple globe-stand headlights house house-line house-simple jeep map-pin map-pin-line map-trifold navigation-arrow path police-car rocket rocket-launch signpost suitcase suitcase-simple taxi traffic-cone traffic-sign traffic-signal train train-regional train-simple truck
- tab 14 (head icon `person`, 47): baby gender-female gender-intersex gender-male gender-neuter gender-nonbinary gender-transgender hand hand-eye hand-fist hand-grabbing hand-palm hand-pointing hand-waving hands-clapping handshake identification-badge identification-card person person-simple person-simple-run person-simple-walk smiley smiley-blank smiley-meh smiley-nervous smiley-sad smiley-sticker smiley-wink smiley-x-eyes user user-circle user-circle-gear user-circle-minus user-circle-plus user-focus user-gear user-list user-minus user-plus user-rectangle user-square user-switch users users-four users-three wheelchair
- tab 15 (head icon `alarm`, 20): alarm calendar calendar-blank calendar-check calendar-plus calendar-x clock clock-afternoon clock-clockwise clock-counter-clockwise hourglass hourglass-high hourglass-low hourglass-medium hourglass-simple hourglass-simple-high hourglass-simple-low hourglass-simple-medium timer watch
- tab 16 (head icon `graduation-cap`, 14): book book-bookmark book-open bookmark bookmark-simple bookmarks bookmarks-simple books chalkboard chalkboard-simple chalkboard-teacher exam graduation-cap student
- tab 17 (head icon `calculator`, 57): bank calculator chart-bar chart-bar-horizontal chart-line chart-line-up chart-pie chart-pie-slice divide equals function graph infinity math-operations minus minus-circle number-circle-eight number-circle-five number-circle-four number-circle-nine number-circle-one number-circle-seven number-circle-six number-circle-three number-circle-two number-circle-zero number-eight number-five number-four number-nine number-one number-seven number-six number-square-eight number-square-five number-square-four number-square-nine number-square-one number-square-seven number-square-six number-square-three number-square-two number-square-zero number-three number-two number-zero percent plus plus-circle plus-minus radical table trend-down trend-up x x-circle x-square
- tab 18 (head icon `bird`, 46): atom bird butterfly cactus campfire cat cloud cloud-fog cloud-lightning cloud-moon cloud-rain cloud-snow cloud-sun dog drop fire fire-simple fish fish-simple flame flower flower-lotus leaf moon moon-stars mountains paw-print planet rainbow rainbow-cloud snowflake sparkle star-four sun sun-dim sun-horizon thermometer thermometer-cold thermometer-hot thermometer-simple tree tree-evergreen umbrella umbrella-simple waves wind
- not in any tab, file exists: pause-slash

`menu-item:` —
- tab 11 (head icon `currency-dollar`, 105): 001-dollar 001-notebook 002-credit-card «002-price tag» 003-auction 003-banknote 004-calculator «004-speech bubble» «005-asset management» 005-diamond «006-bar graph» 006-dollar-symbol 007-coin 007-euro 008-bank 008-bitcoin 009-worker 009-yen 010-partners 010-pound 011-piggy-bank «011-return of investment» 012-balance 012-money-bag 013-balance 013-recruitment 014-atm «014-income statement» 015-percent 015-startup 016-presentation 016-wallet 017-money-exchange 017-salary 018-briefcase «018-credit card» 019-briefcase 019-search 020-contract 020-idea 021-badges «021-pie chart» 022-growth 022-presentation 023-money 023-profits 024-oil 024-smartphone 025-building 025-profit 026-moneybox 026-notes 027-finance 027-safebox 028-gold-ingots 028-success 029-euro 029-vision 030-credit-card-1 030-exchange «031-id card» 031-target 032-manager 032-planning 033-clipboard 033-pyramid-chart 034-envelope «034-flow chart» 035-employee 035-pie-chart 036-bank 036-calculator 037-light-bulb 037-target 038-check 038-deadline «039-digital currency» 039-income «040-hierarchical structure» 040-point-of-service «041-bar graph» 041-currency 042-funnel 042-wallet 043-ipo 043-smartphone 044-analytics 044-certificate 045-businessman 045-ruby «046-atm machine» 046-umbrella 047-abacus 047-contract «048-chinese yuan» «049-gold bar» 049-key 050-security 050-tax clipboard office-building planning task to-do-list to-do

### 0.17 The other four kinds — the diff from the plain-BO template

All four are still the SAME two lines of 0.3 + 0.4; only `category` and a few keys change.

| Kind | `category` | What changes |
|---|---|---|
| Бизнес-объект | `BO` | nothing — the template as is |
| Справочник | `BO_DICTIONARY` | the value of `dictionaryFields` **changes** to `["CODE","LABEL"]` (the key itself is on every BO, see below), and `dynamicFields` **starts** with the two REQUIRED system fields below — never drop either (0.9 rule 18); extra fields may follow |
| Панель | `BO_PANEL` | every entry of `dynamicFields` is a `type: "BO"` widget (extra keys in 0.5) with `"isReadonly": true`, `"isKindAddForSelect": true`, `"rows": 6`+ and `boRefStruct.fieldRefs` (the columns, at least one `toShow: true`) — it shows the whole registry; for a list the user fills instead add `"readFromRegistry": false` and drop `isReadonly` (§5a) — each one needs an `oldRefBoId` off the stand, so **with no ids a panel cannot be built at all** (0.2a) |
| Составной объект | `BO_COMPOSITE` | `"bos": [{"code","name","boCategory"}]` = the source BOs **by code — no id exists here, so this kind is never degraded to a plain `BO`** (0.2a). The code is resolved against the lines of THIS archive first and otherwise on the stand, so the sources may travel in the same archive, in any order (§5b). Every field carries `"boFieldCodes": [{"boCode","fieldCode"}]` (one link = простой атрибут, two+ = составной) — **every `fieldCode` must exist in that source BO or the import dies with `INTERNAL_ERROR`** (§5b) — and **no** `gridPosition` / `tableColOrderIndex` / `removeType` |
| Бизнес-процесс | `BO_PROCESS` | **copy the whole literal of 0.18** — a **third line** `BoProcessVersionsStructDto` (§5c) whose `oldId` = the BO's `oldId`; the importer does NOT create `PROCESS_STATUS`, ship that field yourself — it is mandatory on every process (0.9 rule 18) |


A dictionary — the two system fields and `dictionaryFields`: 0.5b.

**A составной объект needs CODES ONLY — it is NEVER degraded into a plain BO** `[C]` (§5b). This is
the mirror image of the panel: `bos: [{code, name, boCategory}]`
carries **no id at all**, the importer looks the sources up on the stand BY CODE, so «Клиенты и
Поставщики are not on my list of stand ids» is not a reason to degrade anything — there was no id to ask
for.

**Decide first WHERE the sources are.** If you are building them yourself — the usual case for a generic
task like «клиенты и поставщики в одном списке» — **put the source BOs into the SAME archive** and there
is nothing to ask at all: the importer resolves `bos[].code` against the lines of the archive just as
happily as against the stand `[C]` (the order of the lines does not
matter — the composite may come before its sources). A self-contained composite archive is the answer,
not a degrade. Only when the sources ALREADY live on the stand do you need their codes: ask for them
(they are cut to 30 chars on the stand and are not always what you would transliterate, §5b); if the
user declines, ship the composite with your own transliterated codes and say in one line that each
`bos[].code` must be checked against the stand. A wrong code is the one
case that is NOT silent: the analysis says «В Составном объекте не достаёт БО», the user sees it and
drops the import. Building a `BO` instead of the `BO_COMPOSITE` that was asked for, on the other hand,
is silent AND merges by code into whatever it hits.

**A панель cannot be built at all without stand ids — say that, build nothing else.** Every
`dynamicFields` entry of a `BO_PANEL` is a `type: "BO"` registry widget and each one needs the
`oldRefBoId` of a BO that already exists on the stand (0.17, §5a). If those ids were not supplied there is
nothing left to degrade — a panel without registries is an empty panel. STOP, deliver no archive, and
report which ids you need.

**The intra-archive rule of 0.2a is NOT a way out of this.** «Панель с реестрами Сделки, Клиенты, Задачи» says those objects EXIST; inventing three BOs with
those names so the panel has something to point at is worse than shipping nothing, because import MERGES
BY CODE — your invented `Klienty` silently edits the customer's real «Клиенты». You may put a registry's
BO in the same archive **only when the user explicitly asked for that BO to be created too**. Otherwise:
- **do NOT re-read «панель с реестрами X, Y, Z» as «создай бизнес-объекты X, Y, Z»** — that ships a
  different KIND of object than the one asked for;
- **and do not ship both** — a panel plus three freshly invented registries is the same substitution with
  the panel added on top.

**A process and the `PROCESS_STATUS` id.** The importer does not create the status field, so the archive
must ship it (§5c). It is a `type: "BO"` reference to the built-in «Статус процесса» dictionary, and —
unlike any other reference — its ids need not be asked for: the importer resolves the dictionary and its
`CREATED` row BY CODE (0.2a) `[C]`. So:

- ship `PROCESS_STATUS` exactly as §5c prints it, **with `defaultValue` = the `CREATED` row id** and the
  `DEFAULT_VALUE` line for that row; both ids may be your own minted ones, used consistently. Without the
  default no record of the process can be saved (§5c);
- **the dictionary must already exist in the company** — it appears with the company's first process made
  in the constructor, never by import. On an empty company (or when the user does not know) say in the
  report: «если импорт покажет у поля `PROCESS_STATUS` ошибку „В системе не найден бизнес объект“ — создайте
  в конструкторе любой процесс и удалите его (справочник останется), затем импортируйте снова» (§5c) `[C]`;
- `PROCESS_STATUS` is mandatory on EVERY business process (0.9 rule 18). The importer would take a
  process without it and even run it (§5c) — that is not a licence: such a process is broken (no status,
  no default registry column).
- **Never substitute a local dropdown «Статус» for it** — that is an ordinary field with a similar name,
  nothing on the stand treats it as the process status, and the archive looks complete while it is not.
  And never paste `<company-a>`'s `Q0zI~z9Ra2R7Q3yd`.

### 0.18 A business process — the whole archive, literally `[C]`

The archive below is what the generator writes for the process «согласование заявки»:
Enter → Form (the request record) → Script → Switch (ЕСЛИ the request's «Одобрено») → Exit «Да» / Exit
«Нет». It imports and runs both branches (§5c «A whole configured process travels in one archive and
runs»). Build every approval-like process on this skeleton: change the codes, names and ids, keep the
shapes. **Seven lines, in this order:**

1. `BoGroupStructDto` — 0.3.
2. The BO the Form step shows (here `Request`: `request_text` INPUT_TEXT, `is_approved` CHECKBOX) — an
   ordinary BO of 0.4/0.5. Not said to exist → build it in this archive (0.2a «Decide FIRST»); said to
   exist → leave this line out and ask for its id and code.
3. and 4. one `ScriptDefStructDto` per Script / Switch figure (below).
5. The process `BoStructDto` — 0.4 with `"category": "BO_PROCESS"` and exactly two `dynamicFields`
   entries (below), plus any fields of your own after them.
6. The `ExportStructInstanceDto` of the `CREATED` row (below) — without it no process record saves.
7. `BoProcessVersionsStructDto` (below).

Placeholders: `<P>` = the process BO's `oldId`; `<T>` = the target BO's `oldId` (line 2); `<V>` = a
version id you mint (it only ties lines 3, 4, 7 together); `<S>` / `<C>` = the «Статус процесса»
dictionary id and its `CREATED` row id — mint both, the importer re-resolves them by code (0.2a);
`<fEnter> <fForm> <fScript> <fSwitch> <fYes> <fNo>` = figure ids, `<a1>`…`<aNo>` = arrow ids; every
other `<16 chars>` = any fresh id. All by 0.7.

**Line 5, the two fields** — the 0.5 template with these values (only the differing keys shown; every
other key of 0.5 stays):

```text
"request": {"code": "request", "archetype": "DYNAMIC", "kind": "GENERAL", "type": "BO", "viewType": "SINGLE",                 ← the Form step's field: a SINGLE reference
  "oldRefBoId": "<T>",
  "boRefStruct": {"boInfo": {"code": "Request", "name": "Заявка", "boCategory": "BO"},
                  "fieldRefs": {"request_text": {"toShow": true, "orderIndex": 0},
                                "is_approved":  {"toShow": true, "orderIndex": 1}}},
  "label": {"rus": "Заявка"}, "tableColToShow": true, "tableColOrderIndex": 0,
  "gridPosition": {"x": 0, "y": 0, "cols": 15, "rows": 6}, …the rest of 0.5…},
"PROCESS_STATUS": {"code": "PROCESS_STATUS", "newId": "<16 chars>", "archetype": "DYNAMIC", "kind": "GENERAL", "type": "BO", "viewType": "SINGLE",
  "oldRefBoId": "<S>",
  "boRefStruct": {"boInfo": {"code": "PROCESS_STATUS", "name": "Статус процесса", "boCategory": "BO_DICTIONARY"},
                  "fieldRefs": {"label": {"toShow": true, "orderIndex": 2147483647}}},
  "label": {"rus": "Статус процесса", "kaz": "Процестің мәртебесі", "qaz": "Procestiń märtbesi", "eng": "Process status"},
  "isRequired": true, "isSystem": true, "isCodeReadonly": true, "needShowToCalendar": false, "tableColToShow": true,
  "defaultValue": "[\"<C>\"]", "defaultValueMap": {"RUS": "[\"<C>\"]"},
  "gridPosition": {"x": 0, "y": 6, "cols": 8, "rows": 4}, …the rest of 0.5 WITHOUT tableColOrderIndex and removeType…}
```

(`PROCESS_STATUS` is copied as the generator writes it — this exact shape is the one that imported and
saved records; do not «complete» it.) `defaultValue` is a JSON array written as a STRING.

**Line 6, the `CREATED` row** — copy verbatim, change only `<S>`, `<C>` and the process code:

```text
{"@class":"kz.greetgo.mybpm.reg.structure.model.dto.ExportStructInstanceDto","compositeId":"<S>-<C>","boCode":"PROCESS_STATUS","kind":"GENERAL","fieldMap":{"code":{"type":"INPUT_TEXT","storedValue":"CREATED","isUnique":true,"showTable":true,"orderIndex":2147483647,"kind":"GENERAL"},"label":{"type":"INPUT_TEXT_LANG","storedValue":"{\"ENG\":\"Just created\",\"KAZ\":\"Жақында жасалды\",\"QAZ\":\"Zhaqynda zhasaldy\",\"RUS\":\"Только что создан\"}","isUnique":false,"showTable":true,"orderIndex":2147483647,"kind":"GENERAL"}},"sources":[{"sourceType":"DEFAULT_VALUE","defaultValueInstanceSource":{"boCode":"Request_approval","fieldCode":"PROCESS_STATUS"}}]}
```

**Line 7, the diagram.** `@class` prefix of every figure: `kz.greetgo.mybpm.reg.structure.model.bo.process.figure.`
Slot names are FIXED per figure — Enter/Exit `main`/`top`/`bottom`; Form `left`/`right`/`top`; Script
`left`/`right`/`top`/`bottom`; Switch `up`/`right`/`down`/`left` — any other name silently breaks the
arrow. Every arrow leaving a Switch has a `name` (the branch label); a Script has exactly ONE outgoing
arrow. **A Form shows the label of its reference field inside the figure and a Timer the label of its date
field; no other figure has a caption — an arrow `name` is the rest of the text on a diagram** `[C]`, so name
every arrow that enters a Script / Switch / Form / Timer with what that step does (`«Проверка»`, `«Расчёт»`) —
that label is how a person finds the step in the editor.

**Lay the diagram out so no label overlaps** `[C]`. A figure's `x`,`y` is its CENTRE; sizes w×h: Enter / Exit
30×30, Point 20×20, Terminator 40×40, Script / Timer 80×50, Form 100×50, Switch 60×60, SingleToParallel /
ParallelToSingle 39×64. A slot sits on the figure's edge (`left` / `right` at mid-height, `top` / `up` /
`bottom` / `down` at mid-width; Enter's `main` is its right edge, Exit's its left). An arrow's label is 14 px
text, ≈ 7.5 px per character and 18 px high, with its TOP-LEFT corner at the midpoint of the straight line
between the two slots, running right and down — it never wraps, except that a label crossing the visible
editor's right edge folds into a column of one word per line. So:
- **the flow runs left to right in ONE row**: every figure of the main path on the same `y`, every arrow
  straight — a horizontal hop between figures of one `y`, a branch straight down from a Switch's `down`
  slot to a figure with the Switch's `x`, then on to the right. No second row reached by a diagonal or curved
  arrow, no top-down chain;
- **an arrow name is at most 12 characters** (`«Да»`, `«Смета»`, `«В работу»`) — the step's meaning goes into
  its name, not a sentence;
- **the gap between the two facing slots of a horizontal arrow is ≥ 15 px × the name's length + 20**
  (`«Проверка»` = 8 chars → 140 px); a vertical branch needs ≥ 50 px between the slots;
- **the whole diagram stays within 1200 px** in `x`.
The coordinates below follow these rules; keep them when you rename, recompute them when you add figures,
and run the diagram check of 0.10.

```text
{"@class":"kz.greetgo.mybpm.reg.structure.model.dto.BoProcessVersionsStructDto","oldId":"<P>",
 "workProcess":{"figureStructs":{
   "<fEnter>": {"@class":"…figure.FigureEnterStruct","x":60,"y":100},
   "<fForm>":  {"@class":"…figure.FigureFormStruct","x":235,"y":100,"fieldCode":"request"},   ← code of the SINGLE reference field
   "<fScript>":{"@class":"…figure.FigureScriptStruct","x":465,"y":100},
   "<fSwitch>":{"@class":"…figure.FigureSwitchStruct","x":690,"y":100},
   "<fYes>":   {"@class":"…figure.FigureExitStruct","x":785,"y":100},
   "<fNo>":    {"@class":"…figure.FigureExitStruct","x":690,"y":200}},
  "scriptsDefIds":["<V>-<fScript>","<V>-<fSwitch>"],
  "methodScriptIds":[],
  "arrows":{
   "<a1>": {"name":"Заявка","startFigureId":"<fEnter>","startSlotName":"main","finishFigureId":"<fForm>","finishSlotName":"left"},
   "<a2>": {"name":"Проверка","startFigureId":"<fForm>","startSlotName":"right","finishFigureId":"<fScript>","finishSlotName":"left"},
   "<a3>": {"name":"Одобрено?","startFigureId":"<fScript>","startSlotName":"right","finishFigureId":"<fSwitch>","finishSlotName":"left"},
   "<aYes>":{"name":"Да","startFigureId":"<fSwitch>","startSlotName":"right","finishFigureId":"<fYes>","finishSlotName":"main"},
   "<aNo>": {"name":"Нет","startFigureId":"<fSwitch>","startSlotName":"down","finishFigureId":"<fNo>","finishSlotName":"top"}},
  "runWayMap":{"<16 chars>":{"runWay":"ON_INSTANCE_CREATE","orderIndex":1,
    "refBoInfo":{"code":"Request","name":"Заявка","boCategory":"BO"},"processFieldCode":"request",
    "fieldCodes":[],"useFieldValues":[],"fieldValues":{},"changeVariantSet":{"ON_MANUAL_SAVE":1}}}},
 "processVersions":{}}
```

Write `…figure.` out in full (`kz.greetgo.mybpm.reg.structure.model.bo.process.figure.FigureEnterStruct`).

**`runWayMap` decides WHEN the process starts — never leave it empty in a build** (here: every new `Request`
starts an approval). Empty, the process starts
only when someone creates a record in the PROCESS's own registry by hand. A process of a spec starts from
the document it serves: one run way (§5c «`runWayMap`») — `ON_INSTANCE_CREATE` of the target BO, or
`ON_FIELD_CHANGE` of its status to the stage that needs approval («на согласовании») — with
`processFieldCode` = the reference field the Form shows (here `request`). The run way fills that field when
it creates the process record, so the Form has its record. Then set `"hideAddButtonFromRegistry": true` on the
process BO: nobody creates its records by hand, and a run way still starts it `[C]`. A menu item for the
process: 0.2c step 9.

**Lines 3 and 4, the two scripts.** `@class` prefixes: blocks
`kz.greetgo.mybpm.reg.structure.model.bo.process.block.`, expressions
`kz.greetgo.mybpm.reg.structure.model.bo.process.expr.`. Every Script / Switch figure needs its line —
a figure without one fails on the first record («Скрипт не определен», §5c).

```text
{"@class":"kz.greetgo.mybpm.reg.structure.model.dto.ScriptDefStructDto","compositeId":"<V>-<fScript>",
 "blocks":{"<b1>":{"@class":"…block.BlockFixEntryPointStruct","x":40,"y":40,"downBlockId":"<b2>"},
           "<b2>":{"@class":"…block.BlockExitStruct","exitType":"FROM_METHOD"}},
 "expressions":{}}
{"@class":"kz.greetgo.mybpm.reg.structure.model.dto.ScriptDefStructDto","compositeId":"<V>-<fSwitch>",
 "blocks":{"<b1>":{"@class":"…block.BlockFixEntryPointStruct","x":40,"y":40,"downBlockId":"<bIf>"},
           "<bIf>":{"@class":"…block.BlockIfStruct","ifExprId":"<e4>","thenBlockId":"<bYes>",
                    "branches":{"<16 chars>":{"blockId":"<bNo>","order":10,"hasExpr":false}}},
           "<bYes>":{"@class":"…block.BlockExitStruct","exitType":"FROM_METHOD_BY_ARROW","targetArrowId":"<aYes>"},
           "<bNo>": {"@class":"…block.BlockExitStruct","exitType":"FROM_METHOD_BY_ARROW","targetArrowId":"<aNo>"}},
 "expressions":{
   "<e1>":{"@class":"…expr.ExprValueStruct","exprValueType":"THIS_PROCESS","constType":"BoiRefCode","isTextMultiline":false,"latitude":0,"longitude":0,"methodArgs":{}},
   "<e2>":{"@class":"…expr.ExprActStruct","leftExprId":"<e1>","actId":"F-request-K-DYN-S-boi_fields","canWriteValue":false},       ← the process's reference field
   "<e3>":{"@class":"…expr.ExprActStruct","leftExprId":"<e2>","actId":"F-is_approved-K-DYN-S-boi_fields","canWriteValue":false},   ← the target's checkbox
   "<e4>":{"@class":"…expr.ExprActStruct","leftExprId":"<e3>","actId":"F-VALUE-K-DYN-R-D-S-boi_fields","canWriteValue":false}}}
```

That Switch reads `ЕСЛИ ЭТОТ_ПРОЦЕСС.Заявка.Одобрено.#Значение ТО выйти по стрелке «Да» ИНАЧЕ «Нет»`. In an
act id the middle part is a FIELD CODE (`F-<field code>-K-DYN-S-boi_fields`), so rename it together with
the field. Other conditions, loops and writes: Part II (§16 «Business-process scripts», §12a).

**A process must change something — the skeleton is only its frame.** The `<fScript>` body above is entry → exit:
it runs and does nothing, so the skeleton copied as is shows the Form, reads the checkbox and ends without a trace.
Give every Script figure the work of its step — write the document's status, a date or a sum (§16, 0S.7), e.g. a
Script on the «Да» branch before its Exit that sets the document to «Согласовано» — and never ship an entry → exit
body (the lint of 0.10 flags it). The report names, step by step, what each Script / Form changes; a process whose
steps change nothing is reported as not built.

**A writing Script, literally** `[C]` — put a Script figure on the «Да» branch (Enter → Form → Switch → «Да» Script
→ Exit, «Нет» → Exit; the skeleton's `<fScript>` before the Switch goes) and give it this body: it sets the
target's status dropdown `status` to its option `approved` — `ЭТОТ_ПРОЦЕСС.request.status.#Значение = <option>`.
The write lands in the record at once, without `#Сохранить` and without anyone saving the card.

```text
{"@class":"kz.greetgo.mybpm.reg.structure.model.dto.ScriptDefStructDto","compositeId":"<V>-<fScript>",
 "blocks":{"<b1>":{"@class":"…block.BlockFixEntryPointStruct","x":40,"y":40,"downBlockId":"<b2>"},
           "<b2>":{"@class":"…block.BlockAssignStruct","leftExprId":"<e4>","rightExprId":"<e5>","downBlockId":"<b3>"},
           "<b3>":{"@class":"…block.BlockExitStruct","exitType":"FROM_METHOD"}},
 "expressions":{
   "<e1>":{"@class":"…expr.ExprValueStruct","exprValueType":"THIS_PROCESS","constType":"BoiRefCode","isTextMultiline":false,"latitude":0,"longitude":0,"methodArgs":{}},
   "<e2>":{"@class":"…expr.ExprActStruct","leftExprId":"<e1>","actId":"F-request-K-DYN-S-boi_fields","canWriteValue":false},
   "<e3>":{"@class":"…expr.ExprActStruct","leftExprId":"<e2>","actId":"F-status-K-DYN-S-boi_fields","canWriteValue":false},
   "<e4>":{"@class":"…expr.ExprActStruct","leftExprId":"<e3>","actId":"F-VALUE-K-DYN-R-D-S-boi_fields","canWriteValue":false},
   "<e5>":{"@class":"…expr.ExprValueStruct","exprValueType":"CONST","constType":"SingleSelectRefCode",
           "boCode":"Request","fieldCode":"status","optionCode":"approved",                       ← the option CODE; never optionId here
           "valueTypeStruct":{"isArray":false,"type":"SingleSelect","baseType":"SingleSelectRefCode","boCode":"Request","fieldCode":"status"},
           "isTextMultiline":false,"latitude":0,"longitude":0,"methodArgs":{}}}}
```

The same shape writes any field: `<e5>` becomes a number, a text or a date constant (§11, 0S.7). A Switch that
the arrow «Да» leaves needs its `<aYes>` to finish on `<fScript>` and a new arrow `<fScript>` → `<fYes>`.

**A save hook on the target BO that writes a field releases the Form at once** `[C]`: an `ON_INSTANCE_CREATE`
process starts asynchronously after the record's first save, and the target's own `afterSave` write (a total,
0.2c step 7) counts as a save of the Form's record — the Switch then reads an unticked checkbox and goes «Нет»
before anyone opened the card. When the target has such a hook, start the approval by `ON_FIELD_CHANGE` of the
approval checkbox or of the status (§5c «`runWayMap`»), or drop the Form (Enter → Switch → Script → Exit).

---

### 0.19 The rarer field types — their extra keys `[C]`

The core template of 0.5 plus these keys; the type table of 0.5 says which type needs which.

- **A `STATIC_TEXT` also has a per-record value** `[C]`: `staticValue` is only what the
  card shows until a record gets its own. A script writes that value with
  `F-VALUE_IN_LANG-K-DYN-R-D-S-boi_fields` (`language` = Enum const `MybpmLang` `RUS`) on the field
  reference; the card shows it at once, and after saving, only that record shows it. This is how a
  per-record `<iframe>` map is put into a «Текст» field (`MYBPM-UI-API.md` §8).
- **HTML instead of plain text** `[C]`: «Текст» (`STATIC_TEXT`), «Текстовый блок»
  (`TEXTAREA`) and «Мультиязычный текстовый блок» (`TEXTAREA_LANG`) render HTML, so anywhere their text
  goes — `staticValue`, a record value written by a script, the API or an xlsx cell — an HTML fragment
  may stand in for the plain string (`<b>`, `<br>`, `<a href>`, `<div style=…>`). What the sanitizer keeps
  is `MYBPM-UI-API.md` §8. «Текстовое поле» (`INPUT_TEXT`) and `INPUT_TEXT_LANG` are single-line inputs
  and show the tags as text `[I]` — this rule is not about them.
  `<script>` makes the server reject the whole value, `srcdoc` is stripped, while `<iframe src>`, `<img>`,
  `<a>` and inline `style` are kept, and an `<iframe>` renders live on the card `[C]`
  (`MYBPM-UI-API.md` §8).
- `QUESTIONNAIRE` — columns and rows share ONE map, told apart by `isColumn`, keyed by the option's code; at least
  one row and one column, each with a non-empty `label` (an empty one leaves the BO unsavable in the constructor):
  `"questionnaires": {"column_1": {"questionnaireDto": {"label":"Колонка 1","isColumn":true,"orderIndex":0,"code":"column_1"}, "newId":"<16 chars>"}, "row_1": {…"isColumn":false…}}`
- `PROGRESS_BAR` — `"progressSteps"` is keyed by the step's own **id**, not by its code:
  `{"<16-char id>": {"code":"new","label":"Новый","orderIndex":0}, …}`
- `FILE_UPLOAD` — `"viewType": "MULTIPLE"` («несколько файлов») and `"params": {"contentType": "ALL"}`
  (`FOR_CAMERA` = «только фото с камеры»). The constructor's «Отображение» radio (Одиночный /
  Множественный / Плиточный) lives in **`params.viewType`** (`MYBPM-UI-API.md` §5i «FILE_UPLOAD display
  mode»). **A photo shows in the field without downloading only with «Плиточный»** (not
  «Множественный») — so **every field meant for photos (label or code says фото / снимок / photo) gets
  `params.viewType: "TILE"`, unasked**; the lint of 0.10 flags one without it. «Плиточный» = `params.viewType: "TILE"` `[C]`
  (the top-level `viewType` does not matter). In both «Множественный» and «Плиточный» a script sees the field's value as `File[]` `[C]`;
  a script-written PNG shows as a tile thumbnail on the card.
  **«Поведение для MP» = `params.contentType`** `[C]`: the enum is `ALL` / `IMAGE` /
  `DOCUMENT` / `FOR_CAMERA`; the stand stores all four (API and archive), a stand export writes them and a
  copy import brings each back unchanged. The constructor's only control is the checkbox «Только камера»,
  which toggles `FOR_CAMERA` ↔ `ALL` — an `IMAGE` / `DOCUMENT` field shows it unticked, and one click
  overwrites the value. **The setting does nothing on the web**: the record card renders the same
  `<input type=file accept="*">` (no `capture`) for all four values, and the server stores a `.txt` under
  `FOR_CAMERA`, `IMAGE` and `DOCUMENT` alike. It is read by the mobile app only («MP»); what
  the mobile app does with it is `[U]`. Leave it `ALL` unless the field is for phone-camera shots.
- `CHECKLIST` — **the items are the field's `defaultValue`, NOT `fieldOptionsStruct`** `[C]`: a JSON array
  written as a STRING, `"defaultValue": "[{\"label\":\"Пункт 1\",\"checked\":false},{\"label\":\"Пункт 2\",\"checked\":true}]"`
  (`checked:true` = the item starts ticked and struck through). Set `"isAppendable": true` as well — the
  constructor turns it on together with the first item («можно добавлять пункты» on the record). A
  `fieldOptionsStruct` on a checklist is IGNORED by the import (and even resets the stand field's
  `optionSource` to `null`).


### 0.20 Codes the stand generates: label → code

**This is the platform's DEFAULT, not the naming rule.** The constructor and the API give every new BO,
field, option and tab a code transliterated from its label, as below. Codes YOU write follow the
convention of 0.6a. Use this table only to PREDICT a code the stand made by itself — a field built by hand
in the UI, a source BO of a composite that already lives on the stand. Per character: lowercase it, map it through the table, then
re-capitalise the first letter if the original was uppercase; latin letters and digits pass through;
**everything else (spaces, punctuation) becomes `_`**; finally cut to **30 characters**.

```
а a   б b   в v   г g   д d   е e   ё _   ж zh  з z   и i   й yi
к k   л l   м m   н n   о o   п p   р r   с s   т t   у u   ф f
х h   ц c   ч ch  ш sh  щ sch ъ —   ы y   ь —   э e   ю yu  я ya
```

**The stand transliterates the label — it never translates it.** `Название` → `Nazvanie`, not
`Naimenovanie` (that is the transliteration of a different word) and not `Name`. A code is the label's
letters mapped one by one.

**The WHOLE label is transliterated, every word of it.** The code is not the first word and not an
abbreviation: «Тема обращения» → `Tema_obrascheniya`, «Дата подачи заявления» → `Data_podachi_zayavleniya`,
«ФИО заявителя» → `FIO_zayavitelya`. The only thing that may shorten a code is the 30-character cut, and
it cuts from the right.

**`й` is `yi`, not `y`** `[C]` (predicting `y` makes a generated archive collide with the
stand's own codes): «Текстовый блок» → `Tekstovyyi_blok`, «Загрузка файла» → `Zagruzka_fayila`,
«Единичный выбор» → `Edinichnyyi_vybor`, «Текст статический» → `Tekst_staticheskiyi`.

«Наименование» → `Naimenovanie`, «Сумма» → `Summa`, «Активен» → `Aktiven`,
«Дата и время» → `Data_i_vremya`.

**`ё` is not in the table — it becomes `_`** `[C]`: «Зелёный счёт» →
`Zel_nyyi_sch_t`, «Зелёный» → `Zel_nyyi`. Predict `ё` as `_`, never as `e`.

**A code that already exists on the stand may carry a random 14-character tail**
(`issuance_dateAew5UkKutBKvPg`) — that tail is part of the real code. When you patch an EXISTING BO,
read the codes off a fresh export instead of transliterating (§3).


### 0.21 The generator — more commands (optional, `tools/` only)

`--group-code`, `--group-name` and `--group-order` are required (0.3): for an existing group copy its
`code`, `name` and `orderIndex` from `load-bo-groups` (the import overwrites the last two), for a new
group choose a new code, a name and a place:

```
bun tools/make-probe-archive.bun.ts --group-code <код группы> --group-name "<имя группы>" --group-order <orderIndex группы> --code Cookbook_demo --name "Демо из кукбука" \
    --field "Наименование:INPUT_TEXT" --field "Сумма:INPUT_NUMBER" --field "Активен:CHECKBOX"
```

(`--category`, `--field "Метка:BO@<boId>@<boCode>"`, `--source` / `--co-field`, `--process-figure`,
`--process-status`, `--kanban`, `--menu`, `--with-metadata`, `--out` — see the file's header comment,
§5a–5c and §5e.)

A BO plus a sidebar item that opens it — plain navigation, list view only (0.15; this output is
byte-identical to the 0.15 template and passes `tools/validate-archive.bun.ts`):

```
bun tools/make-probe-archive.bun.ts --group-code <код группы> --group-name "<имя группы>" --group-order <orderIndex группы> --code Request --name "Заявки" --field "Наименование:INPUT_TEXT!req" \
    --menu "Заявки:BO@Request@Заявки!code=Requests!order=950000"
```

Add `!parent=<GROUP code>` to put the item into a group (plus a `--menu "Имя:GROUP!code=…"` if the group
travels in the same archive), `!kanban=<dropdown code>` for a board, `!icon=<name from 0.16>` for an
icon (`!icon=phosphor:rocket`, `!icon=menu-item:025-building`). A BO with a kanban and its own
sidebar group, all in one archive (0.14, 0.15):

```
bun tools/make-probe-archive.bun.ts --group-code <код группы> --group-name "<имя группы>" --group-order <orderIndex группы> --code Proba_menu_bo --name "Проба меню БО" \
    --field "Наименование:INPUT_TEXT!req" --field "Статус:DROPDOWN_SINGLE#Новый|В работе|Готово" \
    --kanban "Статус:HEADER=Наименование" \
    --menu "Проба меню:GROUP!code=Proba_menu!order=950000" \
    --menu "Проба канбана из меню:BO@Proba_menu_bo@Проба меню БО!code=Proba_menu_kanban!parent=Proba_menu!kanban=Status!order=950100"
```

The generator names fields, options and tabs the way the STAND does (0.6 transliteration), not by 0.6a:
it is a probe tool. For a real archive rename them to the convention (the BO code is `--code`, a menu code
`!code=`).

The generator covers ALL 27 field types, the six system fields and all ten widgets `[C]`:

```
bun tools/make-probe-archive.bun.ts --group-code <код группы> --group-name "<имя группы>" --group-order <orderIndex группы> --code Proba_vseh_tipov --name "Проба все типы" --with-metadata \
    --field "Выпадающий список:DROPDOWN_SINGLE@Dolzh@Должность" \
    --field "Единичный выбор:RADIO_BUTTON_GROUP#Да|Нет" \
    --field "Опросник:QUESTIONNAIRE#Колонка 1|^Строка 1" \
    --field "Прогресс-бар:PROGRESS_BAR#Новый|В работе|Готово" \
    --field "Вкладки:TAB_GROUP#Общее|Документы" \
    --field "Загрузка файла:FILE_UPLOAD!multiple" \
    --field "Текст:STATIC_TEXT#<h2>Заголовок секции</h2>" \
    --field "Вложенный объект:BO@I1fVTkYPTSg7X8b8@Person" \
    --field "Составной объект:CO@@feclOAWUnwXFQ8c@Sostavnoyi_obekt__4046" \
    --native CREATED_AT --native CREATED_BY --native OPEN_COUNT \
    --widget "BUTTON:Кнопка:button:https://example.org/hook" \
    --widget "CURRENT_USER:Текущий пользователь:cur_user"
```

`#…` means a different thing per type: options for `DROPDOWN_SINGLE` / `RADIO_BUTTON_GROUP` /
`CHECKLIST`, steps for `PROGRESS_BAR`, tabs for `TAB_GROUP`, the HTML itself for `STATIC_TEXT`, and
«колонки, then rows prefixed with `^`» for `QUESTIONNAIRE`. `!multiple` / `!tile` / `!camera` are the
`FILE_UPLOAD` settings (`params.viewType` MULTIPLE / TILE, `params.contentType` FOR_CAMERA). `--widget "TYPE:Метка[:код][:url]"`, `--native <NATIVE_TYPE>`.

`I1fVTkYPTSg7X8b8` and `@feclOAWUnwXFQ8c` in that command are **ids ON THE `<company-a>` STAND** — `Person` and
one composite there. They are the shape of a `--field ...@<boId>@<boCode>` spec, never values for an
archive aimed at another stand (0.2a).

## 1. Zip layout and parsing

**§1–§8 are the reference behind §0 — open one only when a §0 step names it or your case is not in §0.** A build
from a spec reads §0 and nothing else of Part I.

- File name `MyBPM-export-<tenant>-v<build>-<YYYY-MM-DDTHH-MM-SS>.mybpm.zip` (timestamp ALMT). The outer
  name is free on import. `[C]`
- Members: `data-<ts>/0000001.mybpm` and `data-<ts>/metadata.mybpm` (= `objectCount-N`). The inner
  `data-<ts>` folder name is part of the format. `[C]`
- `0000001.mybpm` is **JSONL — one DTO per line**. `JSON.parse` / `json.loads` of the whole member fails
  («Extra data»). Recipe: `unzip -p <zip> 'data-*/0000001.mybpm'`, parse line by line, select the line
  whose `code` is the wanted BO (`BoStructDto`, display name in `name.rus`). `[C]`
- Line order: `CompanyMetadataStructDto`; then each `BoGroupStructDto` followed by its `BoStructDto`(s);
  `AccessStructDto` / `ScriptDef` optional (absence of the access DTO = default access); sidebar menu
  items (`MenuItemStructDto`, §5e) come after the BOs; company-global methods are their
  `ScriptDefStructDto`s followed by one `CompanyGlobalMethodsStructDto` (§5d «Company-global methods» —
  importing it REPLACES the stand's whole list). A one-BO export
  = 3 lines + its `AccessStructDto` if any. `[C]`
- `CompanyMetadataStructDto` carries the company ids `personBoId`, `departmentBoId`, `personGroupBoId`
  (different per company). It has **no** stand host/URL, so record the stand URL in project memory.
  CompanyMetadata ids copied from another company import fine, and the line can be left out. `[C]`
- **`CompanyMetadataStructDto` is OPTIONAL** `[C]`: a **2-line**
  archive (`BoGroupStructDto` + `BoStructDto`, `objectCount-2`, no access DTO) analyses with an empty
  error list and applies. A `Person` reference does not need it either — it resolves by `boInfo.code`
  (§6 «Person reference»). `[C]`
- **Group `oldId`/`newId` are generated at EXPORT time, not stable ids** `[C]`: the same group carries a different
  `oldId` in every export. So `boGroupOldId` only ties the lines of ONE archive together, and the importer
  does not match groups by it — see §8.
- **The stand keeps the archive's `oldId` as the BO's real id** `[C]` — it appears verbatim in the
  registry URL and comes back from `v2/business-objects/load-bo-id-by-code`. Deterministic ids therefore address the same BO on every
  re-import — one more reason to seed them, never randomise; the build salt of 0.7 keeps two builds from scratch apart.
- **A generated archive may be STORED (zip method 0)** `[C]` — the importer accepts it; no compression
  needed (a self-contained writer: 0.11 «Zipping by hand»). Optional accelerators if `tools/` is available:
  `tools/make-probe-archive.bun.ts` builds it (deterministic sha256-seeded ids, `--with-metadata` adds
  `CompanyMetadataStructDto`), `tools/api-import-structure.bun.ts` ships it (the calls: `MYBPM-UI-API.md` §5).
- Use **deterministic ids** in a generator (e.g. sha256 of a seed) so a re-import updates instead of
  duplicating.

## 2. What an export actually contains

**Read this section only when** you start from the user's export, or the spec asks for a BO-level setting (card
tabs, calendar / map / grouping views, sidebar place, company settings, exposed services) — jump to its
subheading. A build from a spec skips it.

- **Only the objects selected at export time.** A one-BO export holds that BO alone. A tool scanning a folder
  of exports must pick the newest archive that actually contains the wanted BO. `[C]`
- **Structure as of export time only.** After renaming/adding/deleting fields take a fresh export: an
  older export lacks the tabs and headings added since and still holds removed fields. `[C]`

#### Taking a fresh export — the minimum `[C]`

Taking an export is a stand operation (`MYBPM-UI-API.md` §5 «Export tab», R4a). For the file it means: the
export page has four baskets — «Бизнес-объекты», «Элементы меню», «Аналитика», «Настройки» — and each BO row
three checkboxes **Структура / Права доступа / Скрипты** = the `BoStructDto` / `AccessStructDto` /
`BoScriptVersionsStructDto` + `ScriptDefStructDto` lines. An export pulls in no BO line for menu items'
BOs, and unconfirmed dependencies do not block it — the archive holds only what the baskets hold.

### What an export carries per BO — the map list `[C]`

A `BoStructDto` has these keys: `oldId code category kind boGroupOldId instanceViewType
bos boTabs printForms name recordName staticValue description orderIndex dynamicFields nativeFields
dictionaryFields actual isCalendarEnabled isMapEnabled isGroupingEnabled isCodeReadonly
chosenAccessRight isTouchEnabled hideAddButtonFromRegistry kanbanCardTemplates timelineTemplates calendarCardTemplates signatures buttons
iframes currentDates captcha currentUser`. The last six are the widget maps (§0.13), `nativeFields`
holds the system fields (§0.12). A key whose value is `null` on the stand is left out: a panel built in
the constructor has no `instanceViewType` at all `[C]`, while one that came in by import carries the `FORM` it was given. The export also writes, after `instanceViewType`, the registry's
default sort **`sortFieldCode`** (a field CODE) + **`sortFieldOrder`** (`ASC`|`DESC`) — absent while the
sort is unset. They travel both ways `[C]`: the export writes the stand's sort, and an archive's pair sets the
stand's `load-bo-table-sort` to that field and order. The same
setting orders a nested table of this BO on another card (`MYBPM-UI-API.md` §5i).

### BO header settings in the archive `[C]`

Six BO-level keys of the header and its gear popover:

| key | values | what it does |
|---|---|---|
| `name` | `{rus: …}` | the BO's name (sidebar, registry title, the record name when no field has `titleToShow`) |
| `recordName` | `{rus: …}` | stored and exported, shown NOWHERE — not even as the fallback record name; the constructor's name input overwrites it with the name |
| `description` | string | the header text under the name |
| `instanceViewType` | `FORM` \| `TAB` | a record opens as a dialog / as a page tab |
| `isTouchEnabled` | boolean, new BO `true` | «Помечать новые (непросмотренные) записи»; gates the unread-counter option of a menu item `[I]` |
| `hideAddButtonFromRegistry` | boolean, new BO `false` | the registry has no create button (Excel import and the API still create) |

- All six round-trip: the export writes them, an import sets them, a re-import of the same `oldId` with
  other values UPDATES all of them.
- **A re-import WITHOUT a key resets it** — `isTouchEnabled` → `true`, `hideAddButtonFromRegistry` →
  `false`, `instanceViewType` → `FORM`, `description` → `null`, whatever the stand had set. Ship every key of §0.4 on every re-import.
- `code`: a re-import of the same `oldId` under another code renames the BO's code (`MYBPM-UI-API.md` «Checking the result of a
  structure import», «Fields are matched by newId») — without the stand's usage analysis, so scripts naming the old code break.
- Stand-side setting of each key: `MYBPM-UI-API.md` §5j.

### BO card tabs in the archive — `boTabs`, `messengerFieldCode`, `whatsAppFieldCode` `[C]`

The record card's right-hand rail (constructor: card editor → `+` on the rail).

| key | values | what it does |
|---|---|---|
| `boTabs` | a MAP `{"<TYPE>": <orderIndex>}`, types `CHAT` «Чат», `PEOPLE` «Люди», `FILES` «Файлы», `HISTORY` «История», `PRINT_FORM` «Печатные формы», `TELEGRAM`, `WHATSAPP` | one icon per tab on the record card, top to bottom by the number. CHAT = the record's chat with its participants, PEOPLE = its participants, FILES = files attached to the record («Загрузить файл»), HISTORY = the change journal (§3 «Field flags»), PRINT_FORM = the print forms (`printForms`, §0.13) |
| `messengerFieldCode` | a field code of this BO; absent when unset | the **Telegram** link field — the field whose value (a login for `INPUT_TEXT`, a phone for `INPUT_PHONE`) ties a record to a messenger chat |
| `whatsAppFieldCode` | the same | the **WhatsApp** link field |

- **Export writes, a copy import sets, all three keys**.
- **A re-import only ADDS tabs and renumbers the listed ones** — it never removes one. An unlisted tab keeps its old
  number, so two tabs may end up sharing one. There is no `delBoTabs` key in the archive: **a tab is removed only on the stand** (constructor trash
  icon or the API, §8 «After the import — the stand-side calls»). So a generated archive should list the FULL set with distinct
  numbers, and a removal is a separate stand-side step.
- **The two link keys, one per messenger** — an export of a BO with only the Telegram link writes only
  `messengerFieldCode`, with only the WhatsApp link only `whatsAppFieldCode`, with neither none of them; an import
  sets `tgLinkFieldId` / `waLinkFieldId` from them. **A re-import WITHOUT them, or with `null`, leaves the stand's
  links alone** (unlike the header keys above, which reset) — so an archive cannot clear a link; do that on the
  stand (§8 «After the import — the stand-side calls»).
- **An export taken seconds after a link change may still carry the OLD link** `[C]` — the stand serves the
  links from a cache that lags a few seconds. Wait ~10 s between changing a link and exporting.
- **`TELEGRAM` / `WHATSAPP` tabs import without any check** — even with no messenger connected and the
  BO not in the company messenger list, the tabs land and show on the card. Without a link field the
  Telegram tab answers «no filed with id =null» on click; with one it is shown disabled. The constructor cannot
  untick such a tab (its checkbox is disabled until the BO is in the company messenger list), so do not ship
  them unless the company uses that messenger.
- Stand side of these keys: `MYBPM-UI-API.md` §5k.

### BO views in the archive — `isCalendarEnabled`, `isMapEnabled`, `isGroupingEnabled`, `groupingInfo` `[C]`

The registry views «Календарь», «Карта», «Группировка» of the BO itself.

| key | where | what it does |
|---|---|---|
| `isCalendarEnabled` | BO | «Календарь» in the registry's view chooser; events on the date fields (`needShowToCalendar`, §3). **Unasked on a BO of visits / appointments / bookings** (запись, визит, встреча, приём, бронь) with a `FULL_DATE`: `true`, plus a calendar menu item beside its list (0.15 «One BO, several items»); the lint of 0.10 reminds of it |
| `isMapEnabled` | BO | «Карта» — one marker per record at its `GEO_POINT` value; the marker popup shows the KANBAN card fields |
| `isGroupingEnabled` | BO | «Группировка» — see the warning below |
| `groupingInfo` | each field | `{"nodeTreeActive": true, "nodeTreeLevel": 0}` = a tree level (a `BO`/`CO` field with `viewType` `SINGLE`/`MULTIPLE`), `{"colToShow": true, "colOrderIndex": 0, "nodeTreeActive": false}` = a column; `{}` = not used |

- All four round-trip: the export writes them, a copy import sets them, **a re-import with `false` / `{}` resets
  them** (and with `true` / the map sets them again). Ship the stand's values on every re-import.
- **A map needs a kanban card template for EVERY `DROPDOWN_SINGLE` of the BO** — not only for a kanban. An archive BO
  with a dropdown and an empty `kanbanCardTemplates` loses its map, its kanban view and the constructor's kanban
  editor to «cardTemplate is null» as soon as it holds a record (0.14). Give each dropdown a template
  (`"<dropdown code>": {"kanbanFields": {"<name field code>": {"cardOrderIndex": 0, "locationType": "HEADER",
  "archetype": "DYNAMIC"}}}`); its fields are what the map popup shows.
- **Grouping renders nothing on this build** — the registry «Группировка» calls server methods that answer 404
  (`MYBPM-UI-API.md` §5l, trap 62). The flag and `groupingInfo` store and travel; do not promise a user a grouping view.
- **The calendar's event-title fields do NOT travel** — no key in the export; a re-import leaves the stand's titles,
  a new BO gets a default. Set them on the stand (`v2/calendar/save-calendar-view-titles`, §8 «After the import — the stand-side calls»). The
  calendar hover card is `calendarCardTemplates` (travels; its shape beyond the empty template of 0.4 and its effect
  are not known yet `[U]` — §18, as are those of `timelineTemplates`; ship both as 0.4 prints them).
- Nothing checks that a map has a `GEO_POINT` or a grouping a reference field — the flag is accepted either way.
- Generator: `tools/make-probe-archive.bun.ts --calendar --map --grouping`, a level by
  `--field "Связь:BO@<boId>@Code!viewType=SINGLE,groupingInfo.nodeTreeActive=true,groupingInfo.nodeTreeLevel=0"`.
  Stand side: `MYBPM-UI-API.md` §5l.

### BO place in the sidebar — `boGroupOldId`, `orderIndex`; clones and the iframe URL do not travel `[C]`

Where the BO sits in the constructor's left list.

| key | what it does |
|---|---|
| `boGroupOldId` | the group line this BO belongs to (§0.3); the group is matched by its `code` |
| `orderIndex` | the BO's place inside its group, ascending |

- **A re-import MOVES an existing BO** into the archive's group and to the archive's `orderIndex` — the BO left the
  group it was in on the stand.
- **A re-import WITHOUT `orderIndex` writes `null`** — the BO jumps to the top of its group. Always ship a number.
- **The §0.4 template value 47480000 is shared by every archive BO.** BOs with equal values cannot be reordered
  between each other in the sidebar (the drag sends the neighbours' midpoint — the same number — and the row falls back
  on reload; `MYBPM-UI-API.md` trap 64). Give each BO its own value: one above the last BO of the target group
  (`load-business-object-groups {forEdit: true}` lists them with their `orderIndex`), e.g. +1000 per BO.
  Generator: `tools/make-probe-archive.bun.ts --bo-order <n>`; the validator warns on 47480000 and fails on `null`.
- **A stand export of a BO from a group WITHOUT a code writes a group line WITHOUT `code`** (e.g. «Другое»
  `code: null`). Re-importing that export as is would rename one fixed stand group (§0.3, §8) — the validator stops it
  (FATAL). Point the line at a group that has a code before re-importing.
- **Not in the archive** (stand-only, `MYBPM-UI-API.md` §5m): the create-record iframe token (no key; a copy has
  none), and «Дублировать» — the stand's clone is a separate call; an archive copy is the archive route to the same
  result (copy the export, new `code` and `name`, fresh `oldId`/`newId`s).

### Company settings that name a BO — none travel WITH THE BO `[C]`

Some company-wide «Настройки» pages keep lists of BOs. They are stored per company, keyed by the BO's STAND id, and
**the BO's own archive carries none of them**: a stand export of a BO that is on every list below (with structure, rights and scripts) has no key for any of them, and a re-import of that BO leaves all of them in place.
**But they may travel as a company-settings line** — see «Exposed services» below: the export screen has a
settings basket whose ticked kinds export as `CompanySettingsStructDto` lines, and that line's payload has keys for
physical removal (`boiDeleteSettings`), messengers and offline (`offlineViewBoAllowCodes`, by BO code). Run for every
kind — physical removal and offline travel by BO code, the messenger lists do NOT: see «The other
company-settings kinds» below.

| setting | what it does to the BO |
|---|---|
| «Физическое удаление» | a rule that deletes the BO's live records for good, N days after creation and/or when a dropdown field changes to a value |
| «Оффлайн режим» — view / edit lists | the BO is available in the mobile offline mode |
| «Мессенджеры» → «Выбор бизнес-объекта» (Telegram / WhatsApp) | adds the messenger's tab to the record card (`boTabs`) |
| «Мессенджеры» → chat registry | the BO becomes the chat registry and **is renamed «Реестр чатов» by the server** |

So after importing BOs that need any of these, set them on the target stand — `MYBPM-UI-API.md` §5n has the calls;
the BO ids come from the stand after the import (§0.2a). Two side effects cross back into the archive's world:
- a BO allowed for a messenger gets its TELEGRAM / WHATSAPP tab on the stand, and the next export of that BO carries
  it in `boTabs` (§2 «BO card tabs») — so a re-import of that export re-adds the tab even where the messenger list
  does not name the BO;
- the chat registry rename lands in the next export's `name` / `recordName` / `description`; conversely a re-import
  of the BO's own archive puts the archive's name back while the BO stays the registry.

«Мобильное приложение» looks like it has a BO list (`importBoAllow`) but all its lists are org units, not BOs. They travel as the `MOBILE` kind (below).

### Exposed services («Выставление сервисов») — a `CompanySettingsStructDto` line `[C]`

«Настройки → Выставление сервисов» turns a BO into a public HTTP endpoint: a call to
`https://<stand>/api/v1/script/service/<COMPANY CODE>/<entry point>` (or `…/service_test/…` for the TEST script
version) needs NO token, creates one record of the service BO, copies the request into mapped fields, runs the BO's
«Создание» hook, and answers with the record's result fields. Runtime, slots, headers, the API and the traps:
`MYBPM-UI-API.md` §5o. The essentials for building one:
- the service BO needs text fields for the request (body, content type, method, mode, two error fields) and for the
  answer (text, content type), an `INPUT_NUMBER` for the status code, and a «Создание» script that sets at least the
  status code (≥ 100; empty → 501) and the answer text / content type (plain `BlockAssign`s, §0S.7);
- do NOT map the file slot unless the script always produces a file (mapped and empty → 500);
- a FILE answer `[C]`: map RESULT_FILE to a single-mode FILE_UPLOAD and assign to its `#Значение`
  `F-writeToFile-K-FIX-T-String` (text) or `F-textToFile-K-FIX-T-String` (Base64 → binary), both with
  `argExprIds:{fileName}`; the body is then the file (RESULT_TXT ignored), sent as an attachment whose Content-Type
  comes from the file NAME's extension (RESULT_CONTENT_TYPE ignored) — a name without a known extension (`x.xyz`,
  `x`) fails with `NoFileMimeType` → 500 (trap 36);
- the request body must be empty or a JSON object (anything else → 500 before a record exists); query parameters
  fill fields by field CODE; a FULL_DATE header takes only the RFC 1123 HTTP date; header values must be ASCII.

**In an archive** the rows are NOT part of the BO line. They come from the export screen's company-settings basket
(kind `SCRIPT_SETTINGS`) as one line holding **every row of the company**:

```json
{"@class":"kz.greetgo.mybpm.reg.structure.model.dto.CompanySettingsStructDto","kind":"SCRIPT_SETTINGS",
 "payloadJson":"{\"boiDeleteSettings\":[],\"telephonyIsActive\":false,\"telephonyCompanySettings\":[],\"messengerTypes\":{},\"messengerCompanySettings\":[],\"otpAuthSettings\":[],\"geoMapTypes\":{},\"geoMapCompanySettings\":[],\"scriptControllerSettings\":[{\"serviceBoCode\":\"Proba_servisa_2026_10_01\",\"orderIndex\":20000.0,\"entryPointTemplate\":\"proba-servisa\",\"baseFields\":{\"INPUT_TXT\":\"Vhodyaschiyi_tekst\",\"INPUT_CONTENT_TYPE\":\"Tip_vhodyaschego\",\"METHOD\":\"Metod\",\"MODE\":\"Rezhim\",\"REQUEST_ERRORS\":\"Oshibki_zaprosa\",\"SCRIPT_ERRORS\":\"Oshibki_skripta\",\"RESULT_TXT\":\"Tekst_rezultata\",\"RESULT_CONTENT_TYPE\":\"Tip_rezultata\",\"RESULT_CODE\":\"Kod_rezultata\"},\"headerFields\":{\"X-Proba-Text\":\"Zagolovok_tekst\"}}],\"inMigrationAllowBoExports\":[],\"outMigrationAllowBoExports\":[],\"offlineViewBoAllowCodes\":{},\"offlineEditBoAllowCodes\":{}}"}
```

- `payloadJson` is a JSON **string**. Everything is by CODE: `serviceBoCode` = the BO code, `baseFields` = slot →
  field code (slots: `INPUT_TXT, INPUT_CONTENT_TYPE, METHOD, MODE, REQUEST_ERRORS, SCRIPT_ERRORS, RESULT_TXT,
  RESULT_FILE, RESULT_CONTENT_TYPE, RESULT_CODE`; an unmapped slot is left out), `headerFields` = header name →
  field code. The other keys of the payload export empty, and the import of a `SCRIPT_SETTINGS` line leaves the
  stand's other settings alone.
- A settings-only archive (this one line + `metadata.mybpm` `objectCount-1`) imports: the analyzer shows one item
  «Выставление сервисов», `structTypes ["SETTINGS"]`, `settingsState "UPDATE"`; the BO may come in the same archive
  or already be on the stand.
- **Apply REPLACES the stand's whole list** — a row the archive does not list is DELETED, and every row is recreated
  under a new id. So start from a fresh stand export of this kind and add/edit rows in it; never ship only your own row
  to a stand that already exposes services.
- **Do not count on rollback**: it brings the old rows back, but with field codes where field ids belong — every
  restored service then answers 200 with an empty body until its slots and headers are re-saved through the API
  (`MYBPM-UI-API.md` §5o, trap 67).

### The other company-settings kinds — what each line carries and what its import does `[C]`

A settings line is always
`CompanySettingsStructDto {kind, payloadJson}` (`payloadJson` a JSON STRING); next to it the export puts a
`CompanyMetadataStructDto` line, and for every ORG UNIT a kind names, an `ExportStructInstanceDto` record line of that
unit (`boCode` `Department` / `PersonGroup`, `fieldMap` with `name` and the unique `ID`, `sources [{sourceType:
"SETTINGS", settingsInstanceSource:{settingsKind}}]`). The import of a unit's line finds the existing unit — no
duplicate is created. Each kind shows in the analyzer as one item named after its settings page, `structTypes
["SETTINGS"]`. **How an import treats what the stand already has differs per kind** — read the row before shipping:

| kind | payload key(s) (only what the kind fills) | import does |
|---|---|---|
| `PHYSICAL_REMOVAL` | `boiDeleteSettings: [{boCode, liveTimeEnabled, liveTimeDays, settings: {<condition id>: {fieldId: <FIELD CODE>, onFieldStoredValue: <option id>, fieldType: "DROPDOWN_SINGLE"}}}]` | **upsert by BO code**: updates the days / flag / conditions of a listed BO, adds a new one, **never removes** — a rule on a BO the archive lacks survives, an empty list changes nothing |
| `OFFLINE` | `offlineModSettings {isActive, dayNumbersUntilReset, maxCountOfflineInstances, nestedLevel: "NONE"\|"FIRST", offlineModAllow: {"D-<dept id>": {displayName}}, viewBoAllow / editBoAllow: {<BO id>: 1}}`, `offlineViewBoAllowCodes` / `offlineEditBoAllowCodes: {<BO code>: 1}` | **replaces**: both BO lists, the org-unit list and the numbers become the archive's. BOs are resolved by the `*Codes` maps — the id maps are ignored, an unknown code is silently dropped |
| `MOBILE` | `mobileSettings {screenshotAllow: {"D-<id>": {displayName}}, …}` — only the non-empty lists of the seven (all org units); an all-empty kind exports `{}` | **replaces** the lists (a unit on another list of the stand was removed) |
| `OTP` | `otpAuthSettings: [{isActive, actual, canChange, createInCurrentCompany, personGroupIds: {<group id>: <name>}}]` — **the department is NOT exported** | recreates the OTP row (new id), restores the groups; an empty list does NOT switch OTP off |
| `LANGUAGES` | `languageMap {<LANG>: {code, displayName, shortName, orderIndex, isActive, isDefault}}` | **replaces**: names, order, active flags and the default language become the archive's; **a language the map lacks is switched OFF** — never ship a partial map. The import also writes a `languageTag` (`en-US`, `ru-KZ`, `kk-KZ`) into every language, and later exports carry it |
| `AUDIT_TRAIL` | `audBoiSettings {audBoCode, actual, audFieldIds: {<slot>: <FIELD CODE of the journal BO>}, loggingBoCodes: [<BO code>…], retentionDays}` — ONE object | **overwrites the FIRST row** of «Аудиторский след» whatever its journal is; the stand may hold several rows (the export carries only the first, the others neither travel nor are touched). A slot the archive lacks keeps its old field id — so an archive for another journal BO leaves the first row half-pointing at the old journal |
| `MIGRATION_MONITORING` | `pgMigrationSettings {actual, monitorBoCode, fieldMap: {<slot>: <FIELD CODE>}}` | sets the monitor BO and the slots by code (switches the BO); an archive without `monitorBoCode` leaves the stand's monitor in place |
| `NAVIGATOR` | `geoMapTypes {GOOGLE_MAP: 1}`, `geoMapCompanySettings [{id: "GOOGLE_MAP-<company id>", fieldValues: {}}]` — **the API key is NOT exported** | applies `fieldValues` when they are there (a key typed into the archive by hand was applied), leaves the stand's key alone when they are empty |
| `MESSENGER` | `messengerTypes {TELEGRAM: 1}` = which messengers are switched on; `boAllow` / `userAllow` and the chat registry are NOT exported | **nothing** on a stand without a connected messenger (`messengerCompanySettings` empty): it neither switched Telegram on nor an empty map switched WhatsApp off |
| `SCRIPT_SETTINGS` | `scriptControllerSettings` | replaces the whole list — «Exposed services» above |
| `TELEPHONY`, `IN_MIGRATION`, `OUT_MIGRATION`, `APPEARANCE` | `telephony*` / `in/outMigrationAllowBoExports` / nothing | unverified `[U]` (needs a telephony provider / Kafka); APPEARANCE belongs to one company per stand |

Rules that follow:
- **Ship a settings kind only from a fresh export of the TARGET stand's own state, edited** (the «Настройки» basket,
  §2 «Taking a fresh export — the minimum») — the replacing kinds
  (OFFLINE, MOBILE, LANGUAGES, SCRIPT_SETTINGS) delete what the archive lacks, and AUDIT_TRAIL hits the first row.
- What never travels and must be set on the target stand by API (`MYBPM-UI-API.md` §5n): the OTP department, the
  Google Maps key, messenger BO / user lists and the chat registry, every audit row but the first.
- Org-unit ids (`D-<id>`, group ids) are stand ids; the record line next to them lets the import find the unit by
  its unique `ID` field — across stands this is `[U]`.
- **No import removes** a physical-removal rule, an OTP row, a navigator row or a migration monitor; and the API
  cannot unset the migration monitor either (`monitorBoId` null / `""` → error). Before importing a kind onto a
  stand that should stay clean, export that kind first so you can put it back.

**Export ids are regenerated on every export** `[C]` — exporting the same BO twice gives different
`oldId` / `newId` / widget ids, and none of them is the stand's real id. Deterministic ids are
worth deriving in a GENERATED archive (§0.7, so that a re-import updates instead of forking), but never
expect a downloaded export to carry them.

Besides the BO lines an export may carry, per BO, a `BoScriptVersionsStructDto` plus one
`ScriptDefStructDto` per non-empty script (the «Скрипты» checkbox of the export basket, §5d), an
`AccessStructDto` (§7) and `ExportStructInstanceDto` record lines (§5, §5c). Menu items are NOT per BO:
they come from a basket of their own on the export screen and arrive as `MenuItemStructDto` lines (§5e).

An export also starts with a `CompanyMetadataStructDto` line — `{personBoId, departmentBoId,
personGroupBoId}` — stand ids that differ per stand and over time
`[C]`, so read them off a fresh export.

## 3. `BoStructDto` and `dynamicFields`

- **`dynamicFields` is an OBJECT keyed by field code, not an array.** Iterating it as an array throws
  `{} is not iterable` — use `Object.entries` / `.items()`. `[C]`
- Per field: `code`, `label.rus`, `type`, `isRequired`, `isUnique`, `removeType`, `tabCodePath`, plus
  per-type keys (`staticValue` for STATIC_TEXT, `fieldOptionsStruct` for DROPDOWN_SINGLE,
  `tableColOrderIndex`, …). **Labels can carry leading spaces — always strip.** `[C]`
- **Field-code collision suffix:** a code may carry a random **14-char** tail, e.g.
  `issuance_dateAew5UkKutBKvPg`. That is the real code and generated constants must reproduce it.
  Origin `[I]`: the constructor appends it when a typed code collides. Renaming the code afterwards works
  `[C]`; code generated from an older export keeps the stale code.
- `removeType: STRIKETHROUGH` sits on **all** fields — it is **not** a
  "deleted" flag. `[C]`
- `isRequired` is false on every UI-built field except the ones the user ticked. `[C]`

### Field types — the whole enum `[C]`

`ApiFormFieldType` has exactly these members; the ones marked ✗ are client-side only and
`generate-business-form-field` answers `400 Failed to convert 'fieldType'` for them:

`INPUT_TEXT` `INPUT_PHONE` `INPUT_EMAIL` `INPUT_NUMBER` `TEXTAREA` `TIME` `FULL_DATE` `YEAR_AND_MONTH`
`YEAR` `DATE` `PERIOD` `PERIOD_TIME` `CHECKBOX` `DROPDOWN_SINGLE` `FILE_UPLOAD` `CHECKLIST`
`RADIO_BUTTON_GROUP` `QUESTIONNAIRE` `BO` `CO` `TAB_GROUP` `GEO_POINT` `PROGRESS_BAR` `INPUT_TEXT_LANG`
`TEXTAREA_LANG` `LINK` `STATIC_TEXT` — plus ✗`BUTTON` ✗`RANGE` ✗`MULTIPLE` ✗`SINGLE` ✗`INPUT`.

| UI name | export `type` | note |
|---|---|---|
| Текстовое поле | `INPUT_TEXT` | |
| Текстовый блок | `TEXTAREA` | the value may be HTML (§0.5 «HTML instead of plain text») |
| **Текст** | `STATIC_TEXT` | static HTML in `staticValue.rus`, a section heading — *not* a text input; a script may still write a per-record HTML value (§0.5) |
| Число | `INPUT_NUMBER` | |
| Чекбокс | `CHECKBOX` | not «Логический» |
| Дата | `DATE` | |
| Дата и время | `FULL_DATE` | no `defaultValue` `[C]`; the client's palette constant is `FULL_DATE`, never `DATE_TIME` |
| Время | `TIME` | |
| Период / Период со временем | `PERIOD` / `PERIOD_TIME` | **«Период» is a field type, not a dictionary** |
| Год / Год и месяц | `YEAR` / `YEAR_AND_MONTH` | |
| Выпадающий список | `DROPDOWN_SINGLE` | `optionSource` FROM_BO (dictionary) or FROM_FIELD (local list) |
| Единичный выбор | `RADIO_BUTTON_GROUP` | a LOCAL `fieldOptionsStruct` only (no dictionary); renders as radio buttons, read in scripts through `.#Значение` (§12) |
| Чек лист | `CHECKLIST` | items = the field's `defaultValue` (a JSON string `[{label,checked}]`), exported and imported `[C]` (§0.5) |
| Опросник | `QUESTIONNAIRE` | `questionnaires` = columns + rows in one map |
| Прогресс-бар | `PROGRESS_BAR` | `progressSteps`; sits in the «Виджеты» palette section but is a normal field |
| Вкладки | `TAB_GROUP` | `fieldTabs`; also from the «Виджеты» section |
| Карта | `GEO_POINT` | excluded from filters and from a BO-reference's column list by the client; the platform's own map (Google, platform team), so a Yandex Maps key is not used — `MYBPM-UI-API.md` §5i |
| Ссылка | `LINK` | URLs — not a text field |
| Загрузка файла | `FILE_UPLOAD` | `params.viewType` SINGLE / MULTIPLE / TILE, `params.contentType` ALL / FOR_CAMERA / IMAGE / DOCUMENT (mobile app only, §0.5) |
| Мультиязычное текстовое поле | `INPUT_TEXT_LANG` | scripts read it through `.RUS` |
| Мультиязычный текстовый блок | `TEXTAREA_LANG` | the value may be HTML, per language |
| Вложенный объект, Пользователь | `BO` | **not** `BUSINESS_OBJECT` |
| Составной объект | `CO` | points at a `BO_COMPOSITE` |
| Email / Телефон | `INPUT_EMAIL` / `INPUT_PHONE` | |

`USER_DROPDOWN_MULTI`, `CHECKBOX_GROUP` and `BUSINESS_OBJECT` are NOT members of the enum. They are only
i18n keys left over in the translation dictionary (`form_field_type_user_dropdown_multi` = «Пользователь/сотрудник»,
`form_field_type_checkbox_group` = «Чек лист», `form_field_type_business_object` = «Бизнес объект»).

### The three archetypes `[C]`

`boFieldArchetype` (constructor DTO) / `archetype` (archive) tells the three families apart, and each one
has its own generator and its own place in the archive:

| archetype | what it is | constructor endpoint | in the archive |
|---|---|---|---|
| `DYNAMIC` | an ordinary field | `generate-business-form-field {boId, fieldType, fieldBoId?}` | `dynamicFields`, keyed by code |
| `NATIVE` | a system field | `generate-business-form-field-by-native {nativeType}` | `nativeFields`, keyed by the native type (§0.12) |
| `WIDGET` | a widget | `generate-business-form-widget {widgetType}` | one of six widget maps, keyed by code (§0.13) |

A widget DTO carries `widgetType` and a **null** `type`; a native one carries `nativeFieldType` plus the
`type` the platform fixed for it. The client resolves a form element as
`nativeFieldType ?? widgetType ?? fieldType`.

### Field flags

`isUnique`, `isRequired`, `isReadonly` (**never required + readonly together** — the record cannot be
saved), `isSystem`, `tableColToShow` (shown as a registry column), `tableColOrderIndex` (**not** an
export switch), `removeType`, `hideLabel`, `chosenAccessRight` (individual rights set),
`isKindAddForSelect`, `isHeightDynamic` (tables), `tableWidth` (registry column width in px; the small
numbers inside nested tables are in unverified units; whether an import applies `tableWidth` is not known yet
`[U]` — §18). A SCALAR field's default value (`defaultValue` / `defaultValueMap` on a text, number, date or
checkbox field) is not known to travel yet `[U]` — §18; the list default and the `CHECKLIST` items are `[C]` (below, 0.5).

**Dates: `dateOnlyPast` / `dateOnlyFuture`** `[C]` — plain booleans on a `DATE`,
`FULL_DATE`, `PERIOD`, `PERIOD_TIME`, `YEAR` or `YEAR_AND_MONTH` field (not `TIME`). The key names what
is ALLOWED: `dateOnlyPast: true` = the constructor's «Будущие даты недоступны для выбора» (the picker offers
today and earlier), `dateOnlyFuture: true` = «Прошедшие даты недоступны для выбора» (today and later). Never
both `true` — the UI cannot produce it. Imported, exported and honoured by the record picker exactly like a
constructor-built field; today and the current month/year stay selectable. **Only the picker enforces it** —
the record API stores any date `[C]`; scripts and an xlsx import presumably too `[I]`. No xlsx cell can clear
a date (19.6 `[C]`). Generator: `--field "Срок:DATE!dateOnlyFuture=true"`.

**Six more gear flags** `[C]` — plain booleans on the field, imported, re-imported
(an existing BO code is updated in place) and exported exactly like the constructor's:

| key | the constructor's checkbox | on the record |
|---|---|---|
| `unacceptableValue: true` | «Не сохранять значение» | the value is never stored — the SERVER drops it too, so the field stays empty whatever writes it through the form cycle |
| `hideLabel: true` | «Убрать заголовок» | the input without its label |
| `needFreezeWhenScroll: true` | «Фиксировать при скроллинге» | the field sticks to the top of the card while it scrolls |
| `isClickable: false` (`BO`/`CO` only; the template's default is `true`) | «Не открывать запись» | clicking a linked record warns «Вы не можете открыть запись» instead of opening it |
| `needShowToCalendar` (date types; the template's default is `true`) | «Показывать в календаре» | `false` keeps that date field off the BO's calendar view |
| `needTrackStatus: true` | «Отслеживать статус» | ONLY together with the two companion fields below |

- **The calendar view itself is a BO-level switch**: `isCalendarEnabled: true` on the `BoStructDto`. The
  archive template has `false` (a BO made by the constructor or `create-bo` gets `true`), so an archive
  BO has no «Календарь» view until you set it. Generator: `--calendar`.
- **«Отслеживать статус» = three fields**, written BY CODE the way a stand export writes them:
  ```jsonc
  "Srok": { "type": "DATE", "needTrackStatus": true,
            "tabCodePath": {"tabGroupCode": "Srok_status", "tabCode": "Status_obekta"},
            "gridPosition": {"x": 0, "y": 0, "cols": 9, "rows": 3}, … },
  "Srok_status": { "type": "TAB_GROUP", "label": {}, "trackedFieldCode": "Srok", "tableColToShow": false,
            "fieldTabs": {"Status_obekta": {"label": {"rus": "Статус объекта"}, "orderIndex": 0, "code": "Status_obekta",
                          "chosenAccessRight": false, "isRight": false, "isDefault": false, "newId": "<16 chars>"}},
            "gridPosition": {"x": 0, "y": <where the date was>, "cols": 15, "rows": 4}, … },
  "Status_Srok": { "type": "DROPDOWN_SINGLE", "label": {"rus": "Статус"}, "trackedFieldCode": "Srok",
            "tabCodePath": {"tabGroupCode": "Srok_status", "tabCode": "Status_obekta"},
            "gridPosition": {"x": 9, "y": 0, "cols": 6, "rows": 3},
            "fieldOptionsStruct": {"optionSource": "FROM_FIELD", "dictionaryOptionSetting": {}, "options": {
              "PLANNED":  {"fieldOption": {"label": "Запланировано", "code": "Zaplanirovano", "orderIndex": 0, "color": "#0048ff", "hiddenInKanban": false}, "newOptionId": "PLANNED"},
              "OVERDUE":  {"fieldOption": {"label": "Просрочено",    "code": "Prosrocheno",   …}, "newOptionId": "OVERDUE"},
              "DONE":     {"fieldOption": {"label": "Выполнено",     "code": "Vypolneno",     …}, "newOptionId": "DONE"},
              "CANCELED": {"fieldOption": {"label": "Отменено",      "code": "Otmeneno",      …}, "newOptionId": "CANCELED"}}}, … }
  ```
  **The option ids must be exactly `PLANNED` / `OVERDUE` / `DONE` / `CANCELED`** — the record card sets the
  status by those ids and the calendar colours by them. **The id is the options map KEY**: a new BO takes the
  keys as its option ids even when `newOptionId` holds other values `[C]`, which is why a stand export — keys
  `PLANNED`…, random `newOptionId` — round-trips intact. The key differs from `fieldOption.code` here, the
  only place it does. A stand export shows the wrapper with its
  stand id as `code` (the constructor leaves the wrapper's code empty); any code works. Generator:
  `--field "Срок:DATE!track"` builds all three.
- **A nested `BO` field's table columns** are `boRefStruct.fieldRefs` keyed by the TARGET BO's field codes:
  `{"Strana": {"toShow": true, "orderIndex": 0}, "Gorod": {"toShow": true, "orderIndex": 1}}` (a stand export
  adds each column's `gridPosition`). With `fieldRefs: {}` the importer lists the target's fields with
  `toShow: false` and the table has no columns at all. Generator: `!show=Strana|Gorod`.

**«Поведение» and «Интеграция» of a field** `[C]` — plain keys on the field,
imported and exported exactly as the constructor writes them:

| key | types | the constructor's control | on the record |
|---|---|---|---|
| `textCase: "UPPER"` / `"LOWER"` (template `"NONE"`) | `INPUT_TEXT` | «Поведение» → «Только заглавные / строчные буквы» | a wrong-case value is NOT converted — the field shows «Недопустимый текстовый регистр» and the card will not save. Digits, spaces, punctuation pass; Cyrillic is checked too |
| `maxLength: <n>` (absent / `0` = no limit) | `INPUT_TEXT`, `INPUT_TEXT_LANG`, `INPUT_NUMBER` (≤ 21), `TEXTAREA`, `TEXTAREA_LANG` | «Поведение» → «Включить ограничение длины» + the number | the input stops at n characters; a longer value (a paste into a `TEXTAREA`, whose editor does not cut) shows «Достигнута максимальная длина символов» and the card will not save. For `INPUT_TEXT_LANG` the limit applies per language |
| `isSeparated: true` | `INPUT_NUMBER` | «Отображение» → «Делить на разряды» | `1234567` shows as `1 234 567` (the stored value stays `"1234567"`) |
| `params: {"enableSequence": "true"}` | `INPUT_NUMBER` | «Поведение» → «Счётчик» | a new record's field is pre-filled with the next number of a per-field counter (1, 2, …). **Every opened draft takes a number, saved or not**, so the numbers have gaps. The value stays editable |
| `params: {"url": "call/plugin/<name>"}` | `LINK` | «Поведение» → «URL» | only a value starting with `call/plugin/` does anything: clicking the link then calls the server plugin (`link/call-plugin`) instead of opening the field's value. Any other `url` is ignored — the link opens its own value `[C]` (the plugin call itself `[U]`) |
| `needLoadFromInTables: true` | every type with the gear | «Интеграция» (puzzle icon) → «Загружать из IN_таблиц» | database integration; no effect visible on a card `[U]` (needs the stand's IN tables) |
| `needUploadToOutTable: true` | same | «Выгружать в OUT_таблицу» | same `[U]` |
| `useAsKeyInMigration: true` | `INPUT_TEXT`, `INPUT_EMAIL`, `INPUT_PHONE` | «Ключевое поле в IN-миграции» | **at most ONE field per BO** — the constructor refuses a second one («Ключевое поле миграции уже преднастроено в поле …») `[C]`; the importer does not check it `[I]` |
| `inMigrationTimezoneMinutes: <n>` (template `0`) | `DATE`, `FULL_DATE`, `TIME`, `YEAR`, `YEAR_AND_MONTH` | «Временная зона IN миграции в минутах» | used by the IN migration `[U]` |

- **All `params` values are STRINGS on the stand** — `"enableSequence": "true"`, not `true`. The server
  turns a JSON `true` sent through the API into `"true"`, and an export writes the string; write the string.
- The case and length rules are checked by the **server's form cycle** (the one the card uses), so a
  script-free API write through `v2/business-object-instance` (`MYBPM-UI-API.md` §6a) stores a wrong-case or
  too-long value without a word `[C]`; an xlsx import presumably does too `[I]`.
- The constructor turns on the registry column when it sets `textCase`, `maxLength`, `isSeparated`,
  `needUploadToOutTable` or `useAsKeyInMigration` (`tableColToShow: true`); set it yourself if the
  registry should match.
- Generator: every key above goes through `!key=value` —
  `--field 'Код:INPUT_TEXT!textCase=UPPER,maxLength=5'`, `--field 'Номер:INPUT_NUMBER!params.enableSequence="true"'`.
  `FILE_UPLOAD`'s «Отображение» (`params.viewType`) and «Поведение для MP» (`params.contentType`) are in §0.5.

**Reference fields (`BO` / `CO`) — their settings in an archive** `[C]`. Every key sits on the
field in `dynamicFields`; the field links are by CODE:

| key in the archive | constructor control | import | on the record `[C]` |
|---|---|---|---|
| `viewType` `"TABLE"` / `"MULTIPLE"` / `"SINGLE"` / `"FIELDS"` | «Вид отображения» | `[C]` | table / chips / one chip / the record's fields as a form. A `SINGLE` field keeps only the FIRST id of a value it is given |
| `isKindAddForSelect: true` | «Только добавление» | `[C]` | «Добавить» creates a referenced record instead of picking one |
| `boRefStruct.linkedFieldCode: "<code>"` (NOT a top-level key) — the code of a field of the REFERENCED BO that points back | «Связь объектов» → «Заполнить поле» | `[C]`, also when the two BOs reference each other inside the same archive (any line order) | adding a record fills its back field with the owner record; removing it clears it. Two `TABLE` fields naming each other make an M:N link (§6 «M:N») — there adding appends to the back field, but removing is not mirrored cleanly. The export writes it on BOTH ends of the pair; one back field serves only ONE field (the constructor greys the others out: «Невозможно - уже существует связь с полем …») |
| `copyFromFieldCode: "<code>"` — another `BO` field of the same BO | «Логика отображения значения» → «Из другого поля» | `[C]` | the field gets a stored copy of that field's value on every save |
| `removeType` `"STRIKETHROUGH"` (template) / `"HIDE"` / `"DISCONNECT"` | «При удалении объектов» | `[C]` | a deleted referenced record is struck through in a table / hidden / on this build struck through too — the id is never removed from the value |
| `needChangeParentBoByLinkedBo` (template `true`, and on EVERY field of an export) | «Изменить / Не изменять бизнес объект» | **`false` is LOST on a field the import CREATES** (stored `true`); a second import of the same archive, which UPDATES the field, stores `false` `[C]` | `true`: adding a record is a change of the owner card (saved with it); `false`: written into the record at once, even if the card is then closed without saving |
| `needMarkNew: true` | «Помечать новые» | `[C]` (kept on a created field, unlike the API) | new rows in bold and on top `[I]` |
| `needAddToParticipants: true` (only for a field referencing a `PERSON` BO) | «Добавлять в участники и уведомлять» | `[C]` | the person put into the field becomes a PARTICIPANT of the record (bell event «Вас добавили») `[C]`, so `participants:true` in the BO's rights (§7) opens the record to them |
| `isHeightDynamic: true` (exported only when true) | «Динамическая высота» | `[C]` | see «Tables» below |
| `linkedCoSettings` — on a `CO` field only, see below | «Связь объектов» → «Объект из Составного объекта» | `[C]` | as `linkedFieldCode` / `removeType`, per source BO of the composite |

- **Need `needChangeParentBoByLinkedBo: false`? Import the archive TWICE** — the first import creates the field
  with `true`, the second one (same file, nothing changed) updates it to `false`. Or set it afterwards in the
  constructor / through the API (`MYBPM-UI-API.md` §5h «Reference fields»).
- **A field referencing a composite (`type: "CO"`)** carries `linkedCoSettings` as a MAP keyed by the CODE of a
  source BO of that composite, one entry per source you link:
  ```json
  "linkedCoSettings": {"<source BO code>": {"linkedFieldCode": "<back field of that source BO>", "removeType": "HIDE"}}
  ```
  The back field (a `BO` field of the source BO pointing at THIS BO) carries `boRefStruct.linkedFieldCode` = the
  code of the `CO` field. A plain `BO` field has `linkedCoSettings: {}`. Adding a composite record to the field
  fills the back field of the SOURCE record; `HIDE` hid a deleted source record `[C]`. The three lines —
  source BO, composite, owner BO — can travel in one archive (source first, then composite, then owner).
- A `CO` field's `fieldRefs` entries carry only `toShow` (no `gridPosition`).
- Details, the API/constructor traps (`needMarkNew` reset by a patch that omits it — the constructor itself does
  this — keys dropped on an added field, `remove-all-for-single-view-type`) and the «Data too large» toast:
  `MYBPM-UI-API.md` §5h «Reference fields».

**Reference fields — «С фильтром» and «Зависимость полей» in an archive**:

- **A record filter on the field TRAVELS** `[C]`. Key `bracketFilter` on the field (absent when there is none):
  ```json
  "bracketFilter": {"boCode": "<code of the REFERENCED BO>", "fieldCode": "<this field's code>",
    "brackets": {"vjFiE0eJ": {"parentTreeIds": {}, "order": 0, "connectionType": "AND", "notType": "DEFAULT",
      "dynamicFilters": {"ajW7xfc8": {"fieldCode": "Aktiven", "type": "CHECKBOX", "value": "true",
        "numberFrom": 0, "numberTo": 0, "isCurrentUser": false, "isEmptyValue": false, "boiIds": {}, "fromFieldCodes": {}}},
      "nativeFilters": {}}}}
  ```
  Maps keyed by 8-character ids (the same shape as a menu item's `bracketFilter`, §5e); a filter's `fieldCode` is
  a field of the REFERENCED BO. The import creates a new filter record with the codes resolved to the new BO's
  field ids, and the picker of the imported field shows only the matching records `[C]`. A filter with
  `boiIds` (a filter on a BO field by concrete records) is unverified `[U]` — record ids do not travel.
- **The field relation does NOT travel whole** `[C]`. The export writes only
  `boRefStruct.relMainInnerFieldCode` («Поле зависимого» — a `BO` field of the REFERENCED BO), and that one
  imports. «Зависимость от» (`relFieldId`, a field of THIS BO) and «Внутреннее поле» (`relInnerFieldId`) are not
  exported at all. Hand-written keys: `boRefStruct.relFieldCode` IS read but resolved in the REFERENCED BO, so it
  stores a wrong field (or nothing); `boRefStruct.relInnerFieldCode` and top-level `relFieldCode` /
  `relInnerFieldCode` / `relMainInnerFieldCode` are ignored. **Never write `relFieldCode`; after the import set
  `relFieldId` / `relInnerFieldId` through the API or the constructor** (§8 «After the import — the stand-side calls»; more: `MYBPM-UI-API.md` §5h ««С фильтром» and
  «Зависимость полей» of a `BO` field») — and know that on this build the relation does not filter the picker in the UI anyway.

**Per-type settings — checklist, questionnaire, progress bar, tabs, text editor, option colours** `[C]`. Every key travels as written:

| type | key in the field | meaning on a record |
|---|---|---|
| `CHECKLIST` | `defaultValue` (items, 0.5) + `isAppendable` | `true` = «Добавить» on the record; `false` = only the shipped items |
| `CHECKLIST` | `isSelectOnly: true` | the item texts cannot be edited, only ticked. Do not combine with `isAppendable: true` (the constructor allows one or the other) |
| `CHECKLIST` | `isRequired: true` | «Обязателен один пункт» — the server refuses a record with nothing ticked |
| `CHECKLIST` | `isRequiredAll: true` | «Обязательны все пункты» — imported, but **nothing enforces it on this build**; do not rely on it |
| `QUESTIONNAIRE` | `questionnaireIsMultiple` | `false` = one radio mark per row, `true` = checkboxes, several per row |
| `PROGRESS_BAR` | `isProgressBarSticky: true` | the bar stays at the top of the card while the form scrolls. Leave `params` `{}` (`params.isSticky` is not it) |
| `TAB_GROUP` | `params.needDisableTabs: "true"` | the tab strip is hidden — use it with ONE tab (the constructor offers it only then) |
| `TAB_GROUP` | `params.showAsStepper: "true"` | travels, but **changes nothing on a card on this build** |
| `TAB_GROUP` | `fieldTabs.<code>.isRight: true` | the tab sits at the right end of the strip |
| `TEXTAREA`, `TEXTAREA_LANG` | `params.buttonTypes` = JSON TEXT of an array, `"[\"bold\",\"italic\",\"table\",\"codeview\"]"` | the editor toolbar shows exactly those buttons, from `style bold underline italic fontsize color ul ol paragraph table link picture video hr codeview height`; no key = the default ten `bold underline italic fontsize color ul ol table link picture` |
| `DROPDOWN_SINGLE` | `fieldOptionsStruct.options.<code>.fieldOption.color` = any CSS colour string — a colour name in any case (`RED`, `green`, `PURPLE`, `PINK`…) or hex (`#0048ff`, `#0f0`); `null` = no colour | the kanban column colour: the column title text and the bar under it take the colour, `null` leaves a black title over the default blue bar (the record card shows the option uncoloured). A light colour (`YELLOW`, `PINK`) makes the title hard to read on white — prefer a darker hex such as `#c99a00`. On a `RADIO_BUTTON_GROUP` the colour travels too but shows nowhere: a kanban is built only on a `DROPDOWN_SINGLE` |

- `params` values are strings, as everywhere (`"true"`, not `true`).
- The option, questionnaire, step and tab codes in the archive are kept as written by the import (an API ADD,
  by contrast, regenerates option codes from the labels — `MYBPM-UI-API.md` §5h «Per-type settings»).
- A record's progress bar is coloured by step CODE: the value is a map `{"Novyi":"GREEN"}` (`RED GREEN YELLOW
  BLUE ORANGE PURPLE`), set by a script or the record API — the card has no control for it. Give the steps
  stable codes for that reason.
- The generator writes all of these: `--field "Чек:CHECKLIST#Пункт 1|+Пункт 2!isSelectOnly=true,isAppendable=false"`
  (`+` = ticked), `"Вкладки:TAB_GROUP#Шаг 1|>Справа"` (`>` = right), `"Поле:INPUT_TEXT!tab=<код вкладок>/<код
  вкладки>"`, `"Статус:DROPDOWN_SINGLE#Красный=RED|Синий=BLUE"`, `'Текст:TEXTAREA!params.buttonTypes=["bold","table"]'`.

**«Единичный выбор» — `RADIO_BUTTON_GROUP`, and the default option of any list** `[C]`

- **A radio group is a LOCAL list only.** Its `fieldOptionsStruct` takes the `FROM_FIELD` shape of 0.5. A
  dictionary (`FROM_BO` + `dictionaryBoInfo`) is useless on it everywhere: the import drops it (the new
  field has `refBoId: null`), the record card shows the label and NO buttons, and the constructor shows an empty local list.
  Worse, the stand then exports that field WITHOUT `fieldOptionsStruct`, and **such a line crashes the
  analysis** — `status: "INTERNAL_ERROR"`, «Cannot read field "options" because "fieldStruct.fieldOptionsStruct"
  is null» in `analyzeRadioButtonGroupField`. Need a dictionary as the source? Use `DROPDOWN_SINGLE`.
- **The default option** is the field's `defaultValue` = an option ID, i.e. the option's `newOptionId` in an
  archive. The import copies `defaultValue` as it is — it never translates a code or an old id. On a new
  record's draft the field then holds exactly that string: the right `newOptionId` → the option is ticked;
  the code (`"Net"`) or a foreign id → a value that matches no option. The default fills only NEW records;
  existing ones stay empty.
- **A stand export breaks every list default.** It writes `defaultValue` as the option's id ON THE SOURCE
  STAND, but gives the options fresh random `newOptionId`s — so importing an export as a new BO leaves the
  default pointing at nothing. Applies to both `RADIO_BUTTON_GROUP` and `DROPDOWN_SINGLE`. Before importing an
  export, replace each such `defaultValue` with the `newOptionId` of the option it meant (look the option up
  on the source stand by id → its code → the archive option with that key). **Re-importing onto the SAME BO
  is safe** `[C]`: the options are matched by code and keep their ids, so the exported `defaultValue` still
  points at the right option.
- **Required** (`isRequired: true`): the server refuses a record with no option ticked
  (`validate_required_title`); the card shows the red star. «Уникальное» does not exist for this type.
- **No kanban, no colour.** A kanban column can only be a `DROPDOWN_SINGLE` (`kanbanCardTemplates` export only for dropdowns); `fieldOption.color` on a
  radio is stored and travels, and is seen nowhere.
- On the card a radio cannot be cleared once an option is ticked (the client control only sets).
  The server itself checks nothing: a record API value that is no option id is stored and shown raw.
- `isRequiredAll` is written `false` by the constructor the moment an empty radio group appears on the
  canvas (it auto-adds one empty option) — harmless, ignore it.

**«История» — `isHistoryTracking` + the BO's `boTabs.HISTORY`** `[C]` — the record
card's «История» tab logs a change of a field ONLY when BOTH are set: the field's `isHistoryTracking: true`
(constructor: BO tab bar → «История» → gear → «Отслеживать изменение полей», one checkbox per field, every type
except `TAB_GROUP`) AND the BO-level tab switched on — in the archive `"boTabs": {"HISTORY": 1}` on the
`BoStructDto` (a MAP tab type → order index; the other types are `CHAT`, `PEOPLE`, `FILES`, `PRINT_FORM`;
`{}` = no tabs). A flagged field on a BO without the tab logs NOTHING — the change is not stored hidden, it is
never written (turning the tab on later shows no event for it). The tab without flags logs no field changes,
only `CREATE_BOI` and `ADD_PARTICIPANT` of new records. Both keys export and import;
only a flagged field's change is logged as `UPDATE_FIELD` (old → new display value). Generator:
`--field "Поле:INPUT_TEXT!isHistoryTracking=true"` plus `--history` (writes `boTabs`); the validator warns about a
flagged field on a BO without `boTabs.HISTORY`.

**«Название записи» — `titleToShow` + `titleOrderIndex`** `[C]` — the record's NAME
(the title of its card, `load-bo-components` → `name`) is the DISPLAY values of the fields with
`titleToShow: true`, joined by single spaces in `titleOrderIndex` order (0, 1, …); an empty field is skipped;
each value is formatted as on the card (a phone as «+7 (701) 123-45-67», a `FULL_DATE` as «01.10.2026 14:31»). No field flagged → the name is the BO's `name` — NOT its `recordName` `[C]` (§2 «BO header settings»). Any field
except `TAB_GROUP` and widgets can be a part, a system field (`CREATED_AT`) included. Constructor: the
record-name field chooser in the form header. In the archive both keys sit on the field in `dynamicFields`
(the exporter omits `titleOrderIndex` on fields that are not flagged); a copy import restores the flags and the
order. **A system field is the exception**: the import APPLIES
`nativeFields.<TYPE>.titleToShow: true` (+ `titleOrderIndex`), but the EXPORT writes `titleToShow: false` and no
order for it even when it is on — a re-exported archive loses it, so set it in the archive by hand. Changing the
flags renames the EXISTING records asynchronously (~3 s); editing a record renames it at once. Generator:
`--field "Номер:INPUT_TEXT!titleToShow=true,titleOrderIndex=0"`; the validator warns about a flag without an
order, a shared order, and a flag on a `TAB_GROUP`.

### Platform concepts an archive encodes

- **BO = class, instance (инстанция / запись) = object.** A link/collection field holds instances of
  another BO.
- **Справочник** = a BO with `category: BO_DICTIONARY`; it always has `code` + `label` and may carry
  extra fields; usable as a «Выпадающий список» source. Dictionary row codes are **case-sensitive**
  (`MRP` ≠ `mrp`) `[C]`.
- **No list-valued field exists** — a "comma-separated list" cannot be modelled; a list of structured
  values needs a separate BO linked from the owner.
- **Change history / audit is a standard platform mechanism** — never model it as fields or an
  «История изменений» BO. Reason/comment fields are data and stay.
- **Пользователь (Person)** is built in; its unique field is **Email**; it has no built-in patronymic field
  (ФИО = `surname` + `name`) — a company may add one to it, as any other field. «Подразделения» (Department) and «Рабочая группа» (PersonGroup) are built
  in too. All three are ordinary BOs with ordinary records `[C]` — users, groups (members = the group's table
  «Пользователи») and departments are records (an xlsx of records, Part III). **A new «Пользователи» record e-mails an invitation** to its Email `[C]` (created in the UI or over
  the API with scripts; an xlsx `[U]`): the person sets a password from the link and can log in — never put a real person's address
  into test users. Their built-in fields `[C]`: Person `surname` `name` `phone` `email` `department` (→ Department)
  `position` `status` (option ids `ACTIVE` / `INACTIVE` / `FIRED`) `accessLevel` (the role: `ACCESS_ALLOWED`
  «Пользователь», `ACCESS_ALLOWED_CONTROL_BO` «Администратор объектов», `ACCESS_ALLOWED_CONTROL_PERSON` «Администратор
  пользователей», `ADMIN` «Суперадмин») `personGroup` (→ PersonGroup, TABLE) `is_lang` (`RUS` `ENG` `KAZ` `QAZ`);
  PersonGroup `name` `header` (→ Person) `users` (→ Person, TABLE); Department `name` `header` `parent` (→ Department)
  `person` (→ Person, TABLE). Tell them by code, not by name — the name is the company's own («Подразделения» /
  «Департамент»). A fourth built-in BO, «Аккаунт» (code `Company`), lists the companies (tenants) of the domain — a
  record's id is the company's `companyId`; fields `code` `name` `company_email` (the admin's mail)
  `company_user_role` (`ADMIN` / `ACCESS_ALLOWED`) `company_enabled` (`true` / `false`) `link`. Only the special
  login `root` sees and edits it; for any other account it does not exist, even by code `[C]`. A new record of it
  creates a company and e-mails its admin (`company_email`) an invitation link where they enter a surname, a name and a password `[C]`. Details:
  `MYBPM-UI-API.md` §3.

## 4. Form layout (`gridPosition`)

Every field carries `gridPosition {x, y, cols, rows}` on a form grid **15 columns** wide. `[C]`
**The key names are `cols`/`rows`, not `w`/`h`** — `w`/`h` belong to the BO-level `gridLayoutPosition`
(record window, end of this section).

- Cell sizes the constructor itself assigns `[C]`: FULL_DATE / PERIOD 15×4; LINK / FILE_UPLOAD / Person
  ref 15×6; one-line inputs 3 rows; nested tables 9 rows; STATIC_TEXT 15×8; dictionary `code`/`label` 15×4.
- **Heights** `[C]` (one grid row = 30 px; the rows to write: 0.8, `TAB_GROUP` 0.8a step 5): a one-line input
  is label + box = 58 px, so 4 rows leave an empty band; a heading (0.5 template) with `hideLabel` needs
  46 px (2 rows scroll inside the cell); a `SINGLE` chip with a chosen record fits 3 rows too `[I]`. Rows of
  2 and 3 fields are drawn exactly as written, no overlap.
- **Widget widths** `[C]`: a text input FILLS its cell (a wide cell = a wide empty box); reference/select
  boxes shrink to fit; the «Период» box is FIXED at ~3 columns, so a 10-column cell is 2/3 empty.
  A good rhythm is 5 columns per compact field (three per row); a ~46-char checkbox label still fits
  in 5 columns (~500 px of a 1500 px form). One grid row = the height of one field LABEL line.
- **Checkbox alignment** `[C]`: the label sits to the RIGHT of the toggle and the widget is one line high
  at the TOP of its cell, while an input cell is label + box — so in a mixed row the toggle floats one
  label-height above the inputs. Fix that works: shift the checkbox cell `y+1, h−1` and grow the cell
  directly above it by +1 row.
- **The grid compacts VERTICALLY** `[C]` — like react-grid-layout `compactType:'vertical'`: every cell
  floats up until it hits the cell above *in its own columns*; a hole in a column is eaten and everything
  below it moves up. Rules: keep columns contiguous, never leave space mid-form; to start a cell lower
  than its row-mates, stretch the cell directly ABOVE it (same `x`, same `w`) by +1 row. Impossible when
  the cell above spans other columns (full-width table/section) or at the first row of a form (an empty
  first row is pulled back up).
- **Tables**: constructor checkbox «Динамическая высота» = field flag **`isHeightDynamic`** (optional per
  field). With `isHeightDynamic:true` and a 5-row cell (label + header +
  one row) the empty band under short tables disappears; import applies the flag. `[C]`
- **Sections** = everything between one full-width «Текст» (STATIC_TEXT) field and the next. HTML goes in
  `staticValue.rus` — a FRAGMENT (no doctype / `html` / `head` / `title`), and only what the sanitizer
  lets through `[C]` (identical sanitizing in «Текст» headings is `[U]`): `text-transform` and `letter-spacing` are REJECTED; `main`, `header`,
  `section`, `article` are stripped WITH their styles → use only `div` and `span`; drop `clamp()` and
  `aria-label`; `h1`–`h3` lose bold → set `font-weight:700` explicitly; avoid `transform` and
  `conic-gradient` (assumed filtered `[U]`). (Same list: `MYBPM-UI-API.md` §8.) 15×3 showed the platform's own scrollbar inside
  the band for "heading + subheading" → use **15×4** or more. `hideLabel:true` avoids the field label
  duplicating the heading — import applies it on a «Текст» field too `[C]`: the card shows only the
  HTML, no label row.
  **A section heading must not repeat any field name of the BO — it breaks Excel import** (`SameBoFieldsLabel`).
- **Tabs**: one `TAB_GROUP` field (code `Vkladki` in exports) with `fieldTabs` (tab codes + labels);
  fields on a tab carry `tabCodePath{tabGroupCode, tabCode}`. `boTabs` can stay `{}` while tabs exist `[C]`.
  Fields outside tabs coexist with a tab group in the same BO. Tab order = `fieldTabs` order; the first
  tab is the default. A tab group whose only tab is a service tab can sit UNDER the ordinary fields instead of opening the form.
- **Record window**: `BoStructDto.gridLayoutPosition` `{x,y,w,h,id:"0"}` is the record WINDOW on a
  16-column SCREEN grid, not the form; a dictionary has one too — its row card is the same dialog (the two
  system fields alone: `{x:4,w:8,h:11}`) `[C]`. The dialog is exactly `h·30` px tall and
  `w/16` of 90 % of the browser width (`w: 10` = 1055 px on a 1876 px window); its title and button bar
  take 99 px and the body pads 28, so a form of `R` rows fits without a scroll at **`h = R + 5`** `[C]` (0.8a step 7).
  Without `gridLayoutPosition` the dialog opens at 90 % × 90 % of the screen `[C]`. Known values:
  `{x:1,w:15,h:21}`, `{x:1,w:15,h:18}` (top-level BOs), `{x:3,w:11,h:18}` / `{x:3,w:10,h:28}` (BOs opened
  only from a parent's table). Import applies it `[C]` (read back with `load-business-object-grid-layout-position`), and the
  server stores any `h` `[C]`. The ceiling is the CLIENT's: one unit
  is 30 px and the dialog is capped at `0.9·innerHeight` (`MYBPM-UI-API.md`, «Size of the child's record
  dialog» under «A nested table … on a record card»), so `h:200` opens exactly as tall as `h:40` — about 28 units on a 965 px window. A larger `h`
  only means «as tall as the screen allows».

## 5. Dictionaries (справочники)

The dictionary line, its two system fields `code` / `label` (0.9 rule 18), its row lines and both dropdown
shapes are 0.5b and 0.5 — copy them from there. What else holds:

- A dictionary MAY carry extra fields (e.g. `lower_limit`, `fixed_amount`, `rate`, `starting_price`).
- **A hand-built dictionary archive imports cleanly** `[C]`: `nativeFields` stays `{}`, and the stand rebuilds
  exactly the dictionary the constructor would (`isDictionary: true`; the constructor itself puts
  `code`/`label` at `y: 0` / `y: 4`). `tools/make-probe-archive.bun.ts --category BO_DICTIONARY` emits it.
- **The caption of `label` varies per BO**: on `Parameter` it is «Значение» and holds the value (the name
  lives in a separate `name` field); on «Шаг скоринга» it is «Наименование». Never assume `label` = name —
  read `dynamicFields`. `[C]`
- Row lines of real exports carry `sources` `DEFAULT_VALUE{boCode, fieldCode:code}`, and the `boId` inside
  `compositeId`/`oldRefBoId` differs from `BoStructDto.oldId` — normal. The rows of a dictionary already on
  the stand are filled by the records xlsx (Part III, «Код» / «Значение»).
- **Both dropdown shapes round-trip through an import exactly as sent** `[C]`. The dictionary is named by
  CODE (unlike a nested object, which carries `oldRefBoId`) and the importer resolves it to the stand's
  `refBoId`. A `FROM_FIELD` field with `options: {}` is simply a dropdown whose list is still empty; an
  option's `color` = a CSS colour name or hex, or null (§3 «Per-type settings»).
  `tools/make-probe-archive.bun.ts` emits both: `--field "Должность:DROPDOWN_SINGLE@Dolzh@Должность"` /
  `--field "Статус:DROPDOWN_SINGLE#Новый|В работе|Готово"`.

## 5a. Panels (панели) `[C]`

- `category: "BO_PANEL"`, everything else the shape of a plain BO — no panel-specific key anywhere in
  `BoStructDto` (`dictionaryFields: []`, `nativeFields: {}`, `boTabs: {}`, `bos: []`).
- **A panel's content lives in `dynamicFields` as `type: "BO"` entries** — registry widgets. Per entry:
  `oldRefBoId` (the target BO), `boRefStruct.boInfo{code,name,boCategory}`, `viewType: "TABLE"`,
  `isKindAddForSelect: true`, `isHeightDynamic: true`, `isReadonly: true`, `gridPosition.rows: 6`+.
  A hand-built archive with just those keys imports and the stand resolves `oldRefBoId` to a live BO
  (`tools/make-probe-archive.bun.ts --category BO_PANEL --field "Метка:BO@<boId>@<boCode>"`).
- What a REAL panel adds on top: `boRefStruct.fieldRefs` — one entry per
  field of the target BO with `toShow` / `orderIndex` / `gridPosition`, i.e. the widget's column layout —
  and `bracketFilter` (`{boCode, fieldCode, brackets{…}}`), which is what turns a registry into «Мои
  встречи»: `nativeFilters{type:"CREATED_BY", isCurrentUser:true}` OR a `dynamicFilters` entry on a
  Person field with `isCurrentUser: true`. A hand-built `fieldRefs` (codes of the target's fields, `toShow`,
  `orderIndex`) imports and gives the widget its columns `[C]`; a `bracketFilter` on a `BO` field
  travels too (§3 «Reference fields — «С фильтром»…» `[C]`), the `isCurrentUser` variant is unverified `[U]`.
- **`readFromRegistry` — registry or a picked list** `[C]`. Absent / `null` / `true` = the widget shows the WHOLE registry of the
  referenced BO (the default — the export omits the key then); `false` = an ordinary reference table that
  holds only the records put into it, saved in the panel's record, which is per user (its id is the
  viewer's `personId`). The import keeps each of the three values as given. Give every widget
  `boRefStruct.fieldRefs` with at least one `toShow: true` (the generator's `!show=<codes>`): a widget with
  no columns renders empty. Through the constructor the box can be turned OFF but not back ON (a server
  defect) — `MYBPM-UI-API.md` §5h «Читать из реестра».

## 5b. Composite objects (составные объекты) `[C]`

A composite object unites the records of several BOs into one registry; in an archive it is a single
`BoStructDto`, `category: "BO_COMPOSITE"`, `kind: "GENERAL"`. An export of one composite
holds exactly 3 objects — `CompanyMetadataStructDto`, one `BoGroupStructDto`, one `BoStructDto` — and no
`AccessStructDto`.

- **`bos: [{code, name, boCategory}]`** — the source BOs, referenced **by CODE only**, no id and no
  nested DTO. The importer looks them up **by code — first among the lines of the archive itself, and
  otherwise on the stand** `[C]` (both import routes) — and writes the real `boId`s into the live `links`. So a composite and the BOs it joins
  can travel in ONE archive, in any line order (composite first also analyses clean).
- **A `boFieldCodes.fieldCode` that no source BO has CRASHES the analyzer** `[C]`. Not a
  readable error — the import goes `status: "INTERNAL_ERROR"` and `load-import-data.error` carries a Java
  stack trace: `Optional.orElseThrow` in `StructureImportAnalyzer.fieldCodeToId` ← `analyzeFieldStructs`
  ← `analyzeCoStruct`. **Every `fieldCode` of every `boFieldCodes` entry must
  exist in that source BO** — check it before shipping, the platform will not tell you which one is
  missing. Presumably the same crash when the source is on the stand and the code is wrong `[I]`.
  - **`name` is not used for matching** — only `code` is. A code that matches nothing makes the analysis
    fail with **«В Составном объекте не достаёт БО»** in the «Ошибки» tab, and **ПРИМЕНИТЬ is not
    blocked by it**; drop the import instead of applying a composite with a missing source.
    **`load-import-errors` DOES report it** `[C]` (read it against the right import — another
    import's errors look empty): one record per missing source,
    `{ownerBoInfo:{code,name,boCategory:"BO_COMPOSITE"}, requiredBoInfo:{code,name,boCategory},
    errorType:"CO_UNSATISFIED_DEPENDENCY"}` — `requiredBoInfo.code` names exactly the code to fix.
    So the API route needs no UI dialog to see it (`MYBPM-UI-API.md` §5, the dry-run validator).
  - One cause of that error: **a BO code is cut to 30 characters**, so a name whose transliteration
    runs past 30 characters gets a truncated code, possibly with a trailing underscore. Always READ the source codes off the stand
    (`load-business-object-by-id → code`), never transliterate them by hand.
- **Each entry of `dynamicFields` carries `boFieldCodes: [{boCode, fieldCode}]`** — which field of which
  source BO feeds this composite attribute. One entry = a «простой атрибут», two or more = a «составной
  атрибут» (the live API expresses the same relation as `links: [{boId, fieldId}]`, see
  `MYBPM-UI-API.md` §5e).
- The rest of the field DTO is an ordinary dynamic field (`type: "INPUT_TEXT"`, the full boolean set,
  `boRefStruct.fieldRefs: {}`, `linkedCoSettings: {}`); `nativeFields`, `dictionaryFields`, `boTabs`,
  `printForms` are all empty. There is no layout — a composite has no form: its fields carry no
  `gridPosition`, no `tableColOrderIndex` and no `removeType`, and an archive generated without them
  imports fine `[C]`.
- **An attribute may be of any field type** `[C]` — every field type except `CO` itself, which was not tried
  as an attribute `[U]`; the import keeps the type. Give a typed attribute the per-type settings of its
  FIRST source field, copied — options with fresh ids (`fieldOptionsStruct`), `oldRefBoId` + `boRefStruct` of a
  reference, `questionnaires`, `progressSteps`, `fieldTabs`, a checklist's `defaultValue`, `params`; the stand keeps
  that payload as given. **It does not drive what the registry shows**: each cell of the composite's registry
  comes from the SOURCE record's own field, so a dropdown, radio or checklist shows the option of its source even
  when the attribute's option list lacks it. Different option sets per source are therefore harmless. An attribute
  merging fields of DIFFERENT types is not known yet `[U]` — keep one type per attribute.
- **The registry columns are all attributes except `STATIC_TEXT` and `TAB_GROUP`** `[C]` — those two may be
  attributes but are never shown. A source not linked to an attribute leaves its cell empty.
- **An export of a composite gives every attribute a fresh `newId`** `[C]` — the payload is otherwise the archive
  as imported (`boRefStruct.boInfo.name` becomes the target BO's name). Never match export ids against stand ids.
- **A plain BO holds composite rows through a `CO` field** (`refBoId`/`oldRefBoId` = the composite) `[C]`; its
  table shows the composite's attributes and may hold rows of any source; through the API its value is
  `["<source boId>-<boiId>", …]` (`MYBPM-UI-API.md` §5e, §6b).
- **Generator**: `tools/make-probe-archive.bun.ts --category BO_COMPOSITE`
  `--source "<код БО>:<Имя>[:<категория>]"` (repeatable) and
  `--co-field "Метка:TYPE=<boCode>.<fieldCode>[+<boCode>.<fieldCode>…]"` (repeatable) — one link makes a
  «простой атрибут», two or more a «составной». It refuses a `--co-field` naming a BO no `--source`
  declares. Both import routes work end to end `[C]` (`MYBPM-UI-API.md` §5e).
- The import dialog labels the node **«Составной объект/<имя>»** and lists the attributes under
  «Добавленные поля» like any other BO; `load-import-bo-infos` returns `boCategory: "BO_COMPOSITE"`.
- What a re-import of a composite does to an attribute it relabels or no longer lists, or to a source it drops, is
  not known yet `[U]` — §18 (an import never deletes, §8, so a dropped attribute most likely stays `[I]`).

## 5c. Business processes (бизнес-процессы) `[C]`

A business process is **two lines in the archive**: an ordinary `BoStructDto` with
`category: "BO_PROCESS"`, plus a **`BoProcessVersionsStructDto` whose `oldId` is the BO's own `oldId`** —
that field is the only link between them. An export of one process carries 7 objects:
`CompanyMetadataStructDto`, `BoGroupStructDto`, `ScriptDefStructDto`, `BoProcessVersionsStructDto`,
`BoStructDto`, and two `ExportStructInstanceDto` (records, see below).

```json
{"@class":"…dto.BoProcessVersionsStructDto","oldId":"<= BoStructDto.oldId>",
 "workProcess":{"figureStructs":{"<figId>":{"@class":"…bo.process.figure.FigureEnterStruct","x":100,"y":100},
                                 "<figId>":{"@class":"…bo.process.figure.FigureExitStruct","x":328,"y":110}},
                "scriptsDefIds":["<ScriptDefStructDto.compositeId>"],
                "arrows":{"<arrId>":{"startFigureId":"…","startSlotName":"right",
                                     "finishFigureId":"…","finishSlotName":"main"}},
                "runWayMap":{}},
 "processVersions":{}}
```

- `workProcess` is a diagram in the same shape `bo-process-editor/load-bo-process-def` returns
  (`MYBPM-UI-API.md` §5f) — except that each figure is a **typed struct**
  `kz.greetgo.mybpm.reg.structure.model.bo.process.figure.Figure<Type>Struct` (`FigureEnterStruct`,
  `FigureExitStruct`, `FigureFormStruct`, `FigureScriptStruct`, `FigureSwitchStruct`, …) instead of a
  `"type"` string, and it also carries `methodScriptIds: []` (whether a process's local methods travel in it is
  not known yet `[U]` — §18). **Write your diagram into `workProcess`.**
  An EXPORT of a process that only has a test version (built in the constructor, never put «в работу»)
  has NO `workProcess` key: the diagram sits under `processVersions.<version id>` in the same shape `[C]`.
  **Importing that form works, but gives a TEST-ONLY version** `[C]`: `isWork: false, isTest: true` — the process runs on DEV
  (test) records only; an ordinary record gets no process at all (`load-process-steps` stays `[]`).
  A `workProcess` line imports as `isWork+isTest` instead (below). To ship a process that runs on
  ordinary records, move the diagram from `processVersions.<id>` to `workProcess`. Re-importing the
  `processVersions` form again adds version 2 as `isTest` and demotes version 1 to neither.
- **A process with BOTH a work and a separate test version exports both, and the import rebuilds both**
  `[C]`: the work version goes into `workProcess`, the test version into
  `processVersions.<its version id>` — each with its own `ScriptDefStructDto` lines, whose `compositeId`
  is `<that version's id>-<figure id>` (`scriptsDefIds` of each diagram lists its own). A version that
  is neither work nor test (an old one, or a fresh «Копировать») is NOT exported. On import the
  `workProcess` diagram becomes version 1 `isWork` and the `processVersions` one version 2 `isTest`, each
  with its own scripts. So `workProcess` = the work version and `processVersions.<id>` = the test version. **A single version
  that is BOTH work and test is exported TWICE** `[C]` — the same diagram under `workProcess`
  and under `processVersions.<its id>` — and that export imports as TWO identical versions, v1 `isWork` +
  v2 `isTest` (not one `isWork+isTest` as a hand-written `workProcess`-only line gives). Harmless; drop
  `processVersions` from a re-used export if one version is wanted.
- `runWayMap` (in `workProcess` and in each `processVersions` entry) holds the process's **run ways** —
  WHEN it starts `[C]`. Empty = the default: the process runs on a record of ITS OWN BO when
  that record is created. **A run way starts the
  process from ANOTHER BO**: the process BO has a single BO-reference field (`type: "BO"`,
  `viewType: "SINGLE"` or `"FIELDS"` — the only fields the dialog offers) pointing at the target BO, and
  an event on a TARGET record **creates a new record of the process BO** whose reference field points at
  that target record, and runs the process on it. Adding run ways does NOT switch the default off — a
  process record created directly still runs `[C]`. In the ARCHIVE a run way names everything BY CODE (the
  API's ids are re-mapped on import):
  ```json
  "runWayMap": {
    "<any id>": {"runWay": "ON_INSTANCE_CREATE", "orderIndex": 1,
                 "refBoInfo": {"code": "<target BO code>", "name": "<target BO name>", "boCategory": "BO"},
                 "processFieldCode": "<code of the process BO's reference field>",
                 "fieldCodes": [], "useFieldValues": [], "fieldValues": {},
                 "changeVariantSet": {"ON_MANUAL_SAVE": 1}},
    "<any id>": {"runWay": "ON_FIELD_CHANGE", "orderIndex": 2,
                 "refBoInfo": {"code": "<target BO code>", "name": "<target BO name>", "boCategory": "BO"},
                 "processFieldCode": "<code of the process BO's reference field>",
                 "fieldCodes": ["<target field code>"],
                 "useFieldValues": ["<target field code>"],
                 "fieldValues": {"<target field code>": "<value>"},
                 "changeVariantSet": {"ON_MANUAL_SAVE": 1}}}
  ```
  - `ON_INSTANCE_CREATE` — a new target record → a new process record `[C]`.
  - `ON_FIELD_CHANGE` — a saved change of one of `fieldCodes` (target fields) on a target record → a new
    process record each time `[C]`; saving with no change, or with the SAME value again, starts nothing
    `[C]` (unlike the script hook «Изменение поля», which fires on every `save-field-value`). A code listed
    in `useFieldValues` must also be changed TO its `fieldValues` value (`"три"`: «четыре» → nothing,
    «три» → a run) `[C]`; the value of an `INPUT_TEXT` is the plain string, other types `[U]`.
  - `changeVariantSet` — WHICH kind of save counts. `ON_MANUAL_SAVE` (what the dialog sets by default)
    covers both a save through the record form AND a record created by the formless API cycle
    (`MYBPM-UI-API.md` §6a — which runs no Block IDE script, yet starts the run way) `[C]`.
    `ON_UPLOAD_XLSX` — a record created by an xlsx records import (Part III) starts the `ON_INSTANCE_CREATE`
    run way `[C]`, though the import runs no Block IDE script; a run way that must also catch records loaded
    from a file lists it beside `ON_MANUAL_SAVE`. The other members are unverified `[U]`:
    `ON_IN_MIGRATION | ON_CALL_API | ON_MASS_CHANGE` (field change only)
    `| ON_PROCESS_CHANGE | ON_PLUGIN_SAVE | ON_KAFKA_IN_MIGRATION`.
  - `SCHEDULED` — no process field; `schedule = {repeatType (EVERYDAY | EVERY_WEEK | EVERY_MONTH | EVERY_WORKING_DAY | EVERY_LAST_DAY_OF_MONTH | EVERY_LAST_WORKING_DAY_OF_MONTH), repeatUntilType (NO_END_DATE | REPEAT_COUNT | EXPIRATION_DATE), startTime, startRepeatTime, endRepeatTime, repeatCount, interval, daysOfWeek, dayOfMonth}` — **`startTime` is a real UTC instant, `startRepeatTime` is a date** `[C]` (the picked local time is shifted to UTC and then printed with the pattern `yyyy-MM-dd'T'HH:mm:ss'Z'`, so the `Z` is literal but the value IS UTC; the date is the local midnight printed the same way, `…T00:00:00Z`; reading back, the dialog uses only the `HH:mm` of `startTime`). The stand ACCEPTS a scheduled run way and stores it as sent, but **it has not been seen to fire** `[U]`. The client has no call that shows a next run, so there is nothing to read back; whether the build or a switched-off scheduler is the cause is open — **do not rely on `SCHEDULED`; start such a process from a script or by hand**. Its archive form is unverified `[U]`.
  - `ON_MIGRATION_END` — no process field and no options in the dialog; not exercised `[U]`.
  The target BO must already be on the stand or travel in the same archive (`refBoInfo.code`). Building a
  run way on a stand: `MYBPM-UI-API.md` §5f «Run ways».
- **Figure and arrow ids survive the import unchanged** `[C]` — the stand's def carries the archive's own
  ids, the same determinism as `oldId` → `boId`. The
  **version id does not**: the stand mints its own and re-keys the scripts to it.
- **An imported version comes in as `isWork: true`** («Версия: 1 (Опубликованный)»), and it
  reads `isWork: true, isTest: true` — it runs on test (DEV) AND ordinary records `[C]`.
- **Re-importing the same process code adds a NEW version** `[C]`: version 2 came in as
  `isWork+isTest`, version 1 dropped to `isWork:false, isTest:false`. The BO itself is updated in place.
  Records started on version 1 STAY on it — they keep running the old scripts; only new records take the new version.
- **Scripts of Script / Switch figures** — one `ScriptDefStructDto` per figure, `compositeId =
  "<version id>-<figure id>"`, the same string repeated in `workProcess.scriptsDefIds`. For `workProcess`
  the version id is any id you mint — it only ties the lines together (the stand re-keys it, see above).
  Blocks and expressions are the IDE JSON (§16) with `@class` instead of `type`:
  `…bo.process.block.Block<Name>Struct` / `…bo.process.expr.Expr<Name>Struct`; an export also writes
  `canWriteValue:false` on every `ExprAct`, `isTextMultiline:false, latitude:0, longitude:0,
  methodArgs:{}` on every `ExprValue`, `hasExpr:false` on an ИНАЧЕ branch. Acts are named by their CODE
  (`F-Zayavka-K-DYN-S-boi_fields`), so the body is portable; `targetArrowId` is an `arrows` key of the
  same line. Ticking «Скрипты» in the export basket is NOT needed — the process's script defs come out
  with the structure `[C]`.
- **Explaining what an existing process does — walk the arrows, not the scripts** `[C]`: a run starts at
  the `FigureEnterStruct` and moves ONLY along `arrows` (`startFigureId` → `finishFigureId`). Build the
  graph from `arrows`, list the figures reachable from the Enter, and describe only those, in arrow order.
  **A figure no arrow leads to never runs** — its `ScriptDefStructDto` (`compositeId` `<version>-<figure
  id>`) still travels in the archive and may look like the core logic, but it is dead: leave it out of
  the logic and name it separately as «не подключена к схеме, не выполняется». Figures have no captions,
  and a person sees neither figure ids nor coordinates, so **point to a step by its ordinal on the path
  from the Enter plus the labels of BOTH its arrows**: «3-й шаг от «Входа» — скрипт; входящая стрелка без
  подписи, исходящая «Оповещение пользователя»» (a Switch: every outgoing label). Several arrows may carry
  the same `name`, and many carry none — then the ordinal is what tells the steps apart; never refer to a
  step by figure id or x/y. Every such pointer starts with the process itself — its `name` and `code`
  («процесс «<name>» (`<code>`), 3-й шаг…») — so a person looking at another process notices the mismatch.
- **Check what the person says against the archive before agreeing** `[C]`: when the person describes a
  figure by its arrows («входящая «X», исходящая без подписи»), find the figures whose `arrows`
  (`finishFigureId` = it / `startFigureId` = it) carry exactly those labels. If that is a different step
  from the one discussed, say which step it is; if no figure matches, or the person quotes captions or
  shows a diagram that the archive does not contain, they are looking at another process or a newer
  version than the export — say so and ask for the export of what they see. **Never retract a fact the
  archive proves** because a pasted fragment or screenshot does not fit it: compare first (a copy-buffer
  fragment, §9, is matched to an archive script by its act codes and variable names, never by block ids).
- **A Script / Switch figure WITHOUT its `ScriptDefStructDto` is a silent trap** `[C]`:
  the analysis reports nothing, the import applies, `validate-def` answers `[]` — and on the first record the
  figure turns `FAILED` with «Скрипт не определен» (`script.not.found`, `NoScriptWithId ScriptId=<figure id>`),
  the process stops there and never reaches its Exit. It does NOT run empty. Every Script / Switch figure
  needs its def line, even a one-exit figure with no acts (`tools/validate-archive.bun.ts` flags it as an
  ERROR).
- **A Form step names its record field by CODE**: `FigureFormStruct {x, y, fieldCode: "<code of a
  BO-reference field of this process>"}` — the stand resolves it to the field's id (`fieldId` in the
  editor) `[C]`. Such a field is exported as a single picker: `type: "BO"`, `viewType: "SINGLE"`,
  `isKindAddForSelect: false`, `tableColToShow: false`, no `tableColOrderIndex`, `oldRefBoId` = the
  target BO's stand id, `boRefStruct.boInfo = {code, name, boCategory}` of the target, `fieldRefs: {}`.
  **That is the EXPORT's shape — never copy its `tableColToShow: false` and empty `fieldRefs` into an archive
  you write** (0.9 rule 15). An archive gives the field `tableColToShow: true` + a `tableColOrderIndex` (a BO
  reference is a safe column under the sort defect, 0.14) and `fieldRefs` with at least one field of the
  target, `toShow: true`. A process built without `PROCESS_STATUS` (itself forbidden by 0.9 rule 18; its `label`
  is the default registry column of a process) and with its one reference field in the export's shape comes out
  with NO registry column and a selector showing nothing `[C]`.
- **A whole configured process travels in one archive and runs** `[C]` both branches on DEV and ordinary
  records — the archive of 0.18. Optional accelerator: `tools/make-probe-archive.bun.ts --process-spec
  <spec.json>` (a field entry needs `refBoCode` AND `show: [<target field codes>]`, 0.9 rule 15).
- **`PROCESS_STATUS` is not created by the importer** `[C]`. The constructor gives every process the
  system field `PROCESS_STATUS` («Статус процесса», `type: "BO"`, `isSystem`, `isCodeReadonly`,
  `isRequired`, `viewType: "SINGLE"`, `boRefStruct.boInfo = {code: "PROCESS_STATUS", name: "Статус
  процесса", boCategory: "BO_DICTIONARY"}`, `fieldRefs.label.toShow`, `oldRefBoId` = the stand's
  «Статус процесса» dictionary) — an archive must ship that field itself.
  The importer resolves that reference by `boInfo.code`, not by `oldRefBoId` (below).
- **…but the PROCESS runs without it** `[C]` (ordinary and DEV records): the field is what the record SHOWS
  and the registry column a constructor-built process has, not what drives the run. A fact about the
  importer, not an option — shipping without it is forbidden (0.9 rule 18).
- **…and it must carry its DEFAULT VALUE, or no record of the process can be saved** `[C]`.
  The field is required; the constructor defaults it to the dictionary row `CREATED`
  («Только что создан»). Shipped without a default, every `validate-apply-remove-draft` of a process
  record answers 200 with the form command `ALERT_SAVE_BUTTON_NOTIFICATION` «validate_required_title»,
  the record is never created and the process never starts. **The default needs TWO things in the
  archive** `[C]`: (1) the key on the field itself,
  `"defaultValue": "[\"<CREATED row id>\"]", "defaultValueMap": {"RUS": "[\"<CREATED row id>\"]"}`,
  AND (2) the export's separate `ExportStructInstanceDto` line for the `CREATED` row with
  `sources:[{sourceType:"DEFAULT_VALUE", defaultValueInstanceSource:{boCode:<this BO>, fieldCode:"PROCESS_STATUS"}}]`
  (its full shape: 0.18 «Line 6, the `CREATED` row»). Either one alone leaves
  `defaultValue "[]"`.
  **Both ids are resolved BY CODE on import** `[C]`: the dictionary is built in with the fixed code
  `PROCESS_STATUS`, its id and its `CREATED` row id differ between stands, and an archive carrying another
  stand's ids or made-up ones (the same made-up ids in the field and in the line's `compositeId`) comes in
  pointing at the importing stand's own dictionary. The line names the row by
  `boCode: "PROCESS_STATUS"` + its unique `code` field `CREATED`, which is what the importer matches. So no
  stand id is needed for a process — mint the two ids (0.2a). Whether `defaultValue` is rewritten to the
  stand's own `CREATED` row id varies — it may keep the minted id — and the process records save and run
  either way: the engine sets the status itself `[C]`.
  **The dictionary exists in a company only after its FIRST process was created in the constructor** `[C]`:
  the importer resolves it by code but never creates it, so on a company that has never had a process the
  analysis reports the process's `PROCESS_STATUS` field: «В системе не найден бизнес объект, на который
  ссылается поле» (required BO code `PROCESS_STATUS`). The fix: create any process in the constructor and
  delete it — the dictionary stays — then import again (`MYBPM-UI-API.md` §5f) `[C]`. Shipping the dictionary
  itself in the archive (its `BoStructDto` copied from an export + all five rows `CREATED` / `EXECUTING` /
  `WAITING` / `FINISHED` / `FINISHED_WITH_ERROR`) is harmless on a company that has it — it merges by code
  into the stand's dictionary, ids, rows and old processes unchanged `[C]` — but whether such a copy works as
  the system dictionary on a company that has none is `[U]`. **So an EXPORTED
  process never imports runnable as is** `[C]`: the export writes
  `PROCESS_STATUS` with no `defaultValue` key (only the line), so the imported copy
  refuses every record with «validate_required_title»; adding the key to the field — and nothing
  else — makes it run. Patch every exported process before re-importing it.
- The two `ExportStructInstanceDto` of a process export are RECORDS, not structure: one row of the
  `PROCESS_STATUS` dictionary (`CREATED` / «Только что создан»), and a record instance whose
  `sources: [{sourceType: "PROCESS", processInstanceSource: {boCode, isWork}}]` ties it to the process.
  Neither was needed to import a working process.
- **Generator**: `tools/make-probe-archive.bun.ts --category BO_PROCESS` emits both lines; it always puts
  an `Enter` at (100,100) and chains `--process-figure "<Type>[@x,y]"` (repeatable, default a single
  `Exit@440,104`) after it with `main → main` arrows, and always adds the `PROCESS_STATUS` field in the
  export's own shape plus its `defaultValue` and `DEFAULT_VALUE` line, with minted ids (`--process-status
  <refBoId>:<CREATED row id>` overrides them). A CONFIGURED process
  comes from `--process-spec` instead (above). Both import routes work `[C]`
  (`MYBPM-UI-API.md` §5f); the import dialog labels the node **«Бизнес-процесс/<имя>»** and
  `load-import-bo-infos` returns `boCategory: "BO_PROCESS"`.

- **Figure settings as the editor stores them** `[C]` (as
  `load-bo-process-def` returns them; the archive's typed structs are assumed to carry the same keys `[I]`, and
  whether a Form timer fires is not known yet `[U]` — §18):
  Form = `{fieldId, createTimer, openFormTimer, touchDraftTimer}` — `fieldId` is one of the process's own
  BO-reference fields (the record whose form the step shows), each timer is
  `{useTimer, timeInMinute, unitType:"MINUTES"|"HOURS"|…, workingTime}` and adds no slot; Script =
  `{script:null}` until its IDE is opened, the script itself lives under `scriptModuleId = <version id>`,
  `scriptId = <figure id>`; **every arrow leaving a Switch needs a `name`** or validation fails, while a
  **Script figure takes exactly ONE outgoing arrow** — a second one fails `validate-def` on BOTH arrows with
  «Из фигуры выходить может только одна стрелка» (`t9KI1UvhI2`) `[C]`; branch in a Switch, not in a
  Script, and an arrow that is the only exit of its figure needs no name `[C]`; Timer =
  `{fieldId}` of a date field of the process (a Timer with no field still validates clean). **In the
  archive** a Timer is `FigureTimerStruct {x, y, archetype:"DYNAMIC", fieldCode:"<the date field's code>"}`
  (as a Form is `FigureFormStruct {fieldCode}`) — `[C]`: the importer resolves the code to the
  field's `fieldId`, and the Timer fires. Full write-up: `MYBPM-UI-API.md` §5f
  «Configuring the figures». **Parallel figures and the Terminator in the archive** `[C]`:
  `FigureSingleToParallelStruct {x, y, outSlotsCount: N}`,
  `FigureParallelToSingleStruct {x, y, inSlotsCount: N}`, `FigureTerminatorStruct {x, y}` (nothing else —
  the editor's `fieldId:""` does not travel); arrows keep the slot names `in` / `out1…outN` and
  `in1…inN` / `out`. Runs: §16 «Parallel branches» and «A Terminator ends the WHOLE process».
  **A Point** (a bend on an arrow) is `FigurePointStruct {x, y}` `[C]`; its arrows use the slots `angle_0`, `angle_45` … `angle_315` (degrees, 0 =
  right, 180 = left). §16 «A Point».

## 5d. Scripts inside the archive (`BoScriptVersionsStructDto` + `ScriptDefStructDto`) `[C]`

Ticking the per-BO checkbox **«Скрипты»** in the export basket (§2 «Taking a fresh export — the minimum») adds two
kinds of line per BO — this is the ONLY place where a Block IDE script exists outside the IDE:

- **one `BoScriptVersionsStructDto`** — the wiring: which script id sits on which hook;
- **N `ScriptDefStructDto`** — the bodies, one per non-empty script.

```json
{"@class":"…dto.BoScriptVersionsStructDto",
 "ownerBoInfo":{"code":"Model_step","name":"Шаг скоринга","boCategory":"BO"},
 "workScripts":{"onOpenFormScriptId":"cds5Bf2evKhr2aFP","afterSaveScriptId":"vU41J7OAjJwZYI2E",
                "onCloseScriptId":"s1BJw7CmFKAU2Cty","onInstanceCreationId":"BBisvpwrxnArOqD6",
                "methodScriptIds":[],
                "fieldScripts":{"condition":"gAipOTVO0617f7nT","code":"DlQXUgrNRYPh@IQv",
                                "condition_predicat":"6ZE4M2S9bV5dXQ5y","calc":"CkGbRqW3T549boSv"},
                "scriptDefIds":["@VuHX@peh8MAMcjj-s1BJw7CmFKAU2Cty","@VuHX@peh8MAMcjj-cds5Bf2evKhr2aFP",
                                "@VuHX@peh8MAMcjj-gAipOTVO0617f7nT","@VuHX@peh8MAMcjj-6ZE4M2S9bV5dXQ5y",
                                "@VuHX@peh8MAMcjj-DlQXUgrNRYPh@IQv","@VuHX@peh8MAMcjj-CkGbRqW3T549boSv"]},
 "testScripts":{"…same shape…"}}
```

- **The owner is named BY CODE** (`ownerBoInfo`, the `{code,name,boCategory}` triple used everywhere —
  §5's dictionary reference, §6's `boInfo`), never by `oldId`. `boCategory` is the owner's own category:
  scripts are wired onto a `BO_DICTIONARY` exactly like onto a plain `BO`.
- **`workScripts` = the published version, `testScripts` = the draft.** `testScripts` is OPTIONAL;
  a BO never edited in test mode carries `workScripts` alone. (Same split as a
  process: an imported version arrives as `isWork` — §5c.)
- The four hooks are the UI dialog «Настройка скрипта» → «Запуск скрипта на: Открытие / Сохранение /
  Добавление новой записи / Закрытие» = `onOpenFormScriptId` / `afterSaveScriptId` /
  `onInstanceCreationId` / `onCloseScriptId` `[C]` (when each
  one runs: §15 «When each hook runs»).
- **`fieldScripts` is keyed by FIELD CODE** `[C]` — «На изменение <поля>» of the same dialog.
- **A hook id is always written, a body is not.** All four hook ids appear even when the script is empty;
  `scriptDefIds` lists only the scripts that actually have a `ScriptDefStructDto` line. An id absent from
  `scriptDefIds` means «hook wired, script empty».
- **Two id shapes, do not mix them**: `workScripts.*ScriptId` and `fieldScripts.*` hold the **bare** 16-char
  script id; `scriptDefIds` and `ScriptDefStructDto.compositeId` hold `<versions id>-<script id>`. The
  prefix is the version's own id and DIFFERS between the two versions — the same body `KDppzVnPAm0m1FIj`
  appears as `soNeVGRXpXjR~D6A-KDppzVnPAm0m1FIj` under `workScripts` and `iRBrFcK7TvONKo~3-…` under
  `testScripts`. Match a def to a hook by the part AFTER the last `-`.
- `methodScriptIds` lists the BO's own (local) methods (`[]` when the BO has none). **Local methods DO travel** `[C]` (below «Local methods travel»).
  Whether a re-import that omits / nulls a hook UNWIRES it, or that drops a method from `methodScriptIds` removes
  it, is not known yet `[U]` — §18. On the stand a field script is unwired by `save-bo-scripts` without it, a hook
  cannot be unwired at all (make it «entry → `BlockExit FROM_METHOD`»: an EMPTIED hook body fails every form save),
  and a local method belongs to every script version — delete it from each (`MYBPM-UI-API.md` §5g, traps 68a/68b) `[C]`.

### `ScriptDefStructDto` = a Part II script minus the clipboard envelope

```json
{"@class":"…dto.ScriptDefStructDto","compositeId":"iRBrFcK7TvONKo~3-KDppzVnPAm0m1FIj",
 "blocks":{"65c4iuRVsnzusAmN":{"@class":"…bo.process.block.BlockExitStruct","exitType":"FROM_METHOD"},
           "3CXZxkG0ieO1pZV5":{"@class":"…bo.process.block.BlockFixEntryPointStruct",
                               "x":30.0,"y":40.0,"downBlockId":"65c4iuRVsnzusAmN"}},
 "expressions":{}}
```

The `blocks` / `expressions` maps are **the very maps Part II documents** (§§9–13), with exactly two
differences `[C]`:

1. the clipboard's `"type":"BlockNewVar"` becomes a fully qualified
   `"@class":"kz.greetgo.mybpm.reg.structure.model.bo.process.block.BlockNewVarStruct"` — append `Struct`,
   prepend `…bo.process.block.` for a block and `…bo.process.expr.` for an expression (`ExprValue` →
   `ExprValueStruct`);
2. there is **no envelope**: no `copiedType`, no `mouseX`/`mouseY`, no `startBlockIds`. The root is found
   by class — a hook/field script starts at its `BlockFixEntryPointStruct` (the only block with `x`/`y`).

   Inside an `ExprValue`, the clipboard key `valueType` is written `valueTypeStruct` (same object).

Every other key matches byte for byte: `downBlockId`, `varName`+`valueExprId`, `leftExprId`+`rightExprId`,
`ifExprId`+`thenBlockId`+`branches{blockId,order,hasExpr}`, `exitType`, `actId`+`argExprIds`+
`canWriteValue`, `funcName`+`args{name,order,exprId}`+`useArgNames`, `opType`+`more`, and the
`ExprValueStruct` keyset `exprValueType varBlockId boCode fieldCode constType value enumBaseType enumValue
optionCode optionInstanceId optionSource objectDescriptor valueTypeStruct isTextMultiline latitude
longitude methodArgs`. Classes include: `BlockFixEntryPoint / BlockNewVar / BlockAssign /
BlockIf / BlockExit`, `ExprValue / ExprOp / ExprAct / ExprCall`. Numbers are doubles (`"x":30.0`), as in
`gridPosition`.

**Therefore an export is a way to READ a live script off a stand without touching the IDE** `[C]`: unzip,
take the def whose `compositeId` ends with the wanted script id, swap `@class` back to `type`, wrap it in
the envelope of §0S.3 with `startBlockIds` = the entry point — and it is a normal Part II fragment.

### The reverse works too: an archive CREATES scripts on import `[C]`

Such an archive — `CompanyMetadataStructDto` + `BoGroupStructDto` + `BoStructDto` +
`BoScriptVersionsStructDto` + N × `ScriptDefStructDto` — is built by hand from the two shapes above (a body is
a Part II script converted by the rules of «`ScriptDefStructDto` = a Part II script minus the clipboard
envelope») and imported like any archive; bodies may be lifted verbatim out of an export. Optional accelerators:
`tools/make-probe-archive.bun.ts` + `tools/add-bo-scripts.bun.ts` (below). **The clipboard is not the only write channel** (§14 is
about the IDE, not about the platform).

- **The analyser announces them before you apply**: `load-import-bo-infos[].structTypes` is
  `["SCRIPTS","STRUCTURE"]` instead of `["STRUCTURE"]`. Check it on the dry run — it is the cheapest proof
  that the script lines were parsed at all.
- **Every script id you write is kept verbatim** `[C]` — all four `workScripts.*ScriptId`, every
  `fieldScripts` value, and every block / expression id inside the defs. **Only the version id is
  regenerated**: the `compositeId` prefix is replaced by the stand's own
  `boScriptModId`. So the prefix is a tie-line inside one archive, like `boGroupOldId`
  (§1) — pick any id-shaped string, just use the same one in `scriptDefIds` and in every `compositeId`.
- **`fieldScripts` is keyed by field CODE in the archive and by field ID on the stand** `[C]`: the archive's
  `{"Kod": "DAZ2eokWJRIqYGuf"}` reads back from `v2/bo-scripts-editor/load-bo-scripts` as
  `{"5wzp8xIek35QC@EU": {"afterChangeScriptId": "DAZ2eokWJRIqYGuf"}}`. The importer resolves the code.
- **A re-import does not overwrite a script version — it ADDS one** `[C]`. Every import adds a new
  `isWork` version with a new `boScriptModId`, and the previous work version stays with `isWork:false`.
  **Read back the module id AFTER every import** — translating the
  old module shows the old body and looks like the import failed. An import NEVER reports a broken body: `translate-script` on the
  NEW work version (script ids from your archive are kept verbatim) is the only validator — the calls are
  `MYBPM-UI-API.md` §5g «Reading a BO's scripts headlessly».
  The first import also produces a version with `isTest:true` carrying the same script ids, even when
  the archive has **no `testScripts`** — a test version is created for you.
- **No archive updates an existing version** `[C]`: with the `compositeId` prefix set to the CURRENT work
  version's `boScriptModId` the import still added a new work version with its own id; the old one kept
  its body and dropped to `isWork:false, isTest:false`, and the test version kept its OLD body. After a
  re-import, refresh the test version yourself if you test there. Dead versions are removed with
  `v2/bo-scripts-editor/remove-bo-script-version` `P {boId, boScriptsId}` (`MYBPM-UI-API.md` §5g) — **it
  removes the WORK version too, without a warning**, after which ordinary records run nothing; take the
  id from a row with `isWork:false, isTest:false`.
- **An empty hook stays empty**: a hook id with no `ScriptDefStructDto` translates to «Не определён
  скрипт». The imported ТОЧКА ВХОДА → ВЫЙТИ def translates `{"success":true}`.

#### A body is NOT portable between BOs — `DYN` act ids embed the FIELD CODE `[C]`

A body moved byte for byte onto a BO whose field codes differ imports with **no error**
(`load-import-errors` empty, status APPLIED), but `v2/script/translate-script` answers errors such as

```
exprAct__noDefinitionForActId: Для акта с ИД=`F-code-K-DYN-S-boi_fields` не найдено определение
```

**`F-<fieldCode>-K-DYN-…-boi_fields` is «the field `<fieldCode>` of this BO»** — the `K-DYN` half of an
`actId` is a per-BO binding by CODE, unlike `K-FIX` acts (`F-isEmpty-K-FIX-T-String`,
`F-addError-K-FIX-T-BoiFieldRefCode`), which are platform-wide and travel unchanged. **Retarget every
`K-DYN` actId when you move a script between BOs**, and translate afterwards: nothing else tells you.

#### Local methods travel — when the archive carries them `[C]`

A body that calls a local method the archive does not carry fails `translate-script`
(`ExprCall{funcName:"is_var"}` → `exprCall_funcName__notFound`, «Не найдена плашка МЕТОД с именем is_var»).
Ship the method in the same archive. A local method is one
more script of the version: its id goes into `methodScriptIds`, its body into a `ScriptDefStructDto` like
any hook, and its def starts with a `BlockFixMethodStruct` instead of the entry point:

```json
{"@class":"…dto.ScriptDefStructDto","compositeId":"<ver>-<methodId>","blocks":{
  "<hat>":{"@class":"…process.block.BlockFixMethodStruct","x":20.0,"y":20.0,"methodName":"perenos_metod","downBlockId":"<exit>","params":{}},
  "<exit>":{"@class":"…process.block.BlockExitStruct","exitType":"FROM_METHOD"}},"expressions":{}}
{"@class":"…dto.BoScriptVersionsStructDto","ownerBoInfo":{"code":"…","name":"…","boCategory":"BO"},
 "testScripts":{"onOpenFormScriptId":"<hookId>","methodScriptIds":["<methodId>"],"fieldScripts":{},
                "scriptDefIds":["<ver>-<hookId>","<ver>-<methodId>"]}}
```

A method with parameters carries them in `params` of the hat; argument keys at the call site are the
parameter ids (§13), so keep both sides in the same archive.

**Trap — scripts onto an EXISTING BO whose script module is empty** `[C]`: `apply-import` answers
`IllegalStateException` «V7iuUY20Kn :: Нет скриптов для экспорта у БО с кодом: "<code>"» (the import's
rollback snapshot tries to export the BO's current scripts and finds none), the import stays `ANALYZED`
and the `processId` you passed never runs — a poll loop on it spins until its timeout. It happens e.g. after the
BO's only local method has been deleted. Import scripts into a NEW BO (or one that already has a script)
and check the `apply-import` answer for `errorType` before polling.

#### Generated bodies on every trigger — the trigger probe `[C]`

The bodies need not be lifted from an export: **GENERATED scripts** on the four hooks and on a field
of each of the 27 field types import cleanly (`structTypes: ["SCRIPTS","STRUCTURE"]`, no errors) and
translate `{"success":true}`. The runtime result is §15 «When each hook runs».

- **By hand**: write each body in the CLIPBOARD form of Part II, convert it by the rules of
  «`ScriptDefStructDto` = a Part II script minus the clipboard envelope», give it a `ScriptDefStructDto` line
  and wire its id into `BoScriptVersionsStructDto` (hook id / `fieldScripts.<code>` / `methodScriptIds` +
  `scriptDefIds`). **Optional accelerator**: `tools/add-bo-scripts.bun.ts … --bodies <file.json>` takes
  `{"onOpen"|"afterSave"|"onCreate"|"onClose"|"field:<code>"|"method:<name>": {entry, blocks, expressions}}` in the
  CLIPBOARD form of Part II and rewrites each body into the archive form (`type` → `@class` …`Struct`,
  `valueType` → `valueTypeStruct`) — the same conversion, automated. A body is a whole hook script: its `BlockFixEntryPoint` (`x`/`y`), the
  statements, a closing `BlockExit FROM_METHOD`. `canWriteValue`, `isTextMultiline`, `latitude/longitude`
  may be omitted. A `method:<name>` body is a local method: its hat is the `BlockFixMethod` (with `params`,
  `returnType`), its id joins `methodScriptIds`, and the param ids you minted stay as written, so the hooks of
  the same file may call it `[C]`.
- **`fieldScripts` accepts every field type**, `TAB_GROUP`, `PROGRESS_BAR` and `STATIC_TEXT` included —
  although the IDE's «Изменение поля» list hides `TAB_GROUP` and `PROGRESS_BAR`. All three fire.
- `'' ◊ <an empty field>` gives `""`, not `"null"`; a `TEXTAREA` drops the trailing space of an appended `"; "`.
- The same bodies written WITHOUT an archive (`save-bo-scripts` + `paste` +
  `apply-update-cmd`, `MYBPM-UI-API.md` §5g) run identically.

#### A ready sum hook — a header total over its lines `[C]`

The `afterSave` hook of a header `Work_order` whose `TABLE` `works` points at the line BO `Order_work`
(`hours`, `hour_price`, `line_total` — all `INPUT_NUMBER`) and whose `works_total` is the total:

```text
Пусть #сумма# = 0
ЦИКЛ #строка# : ЭТА ИНСТАНЦИЯ.works.#Значение
    #строка#.line_total.#Значение = #строка#.hours.#Значение ∙ #строка#.hour_price.#Значение
    #сумма# = #сумма# + #строка#.line_total.#Значение
ЭТА ИНСТАНЦИЯ.works_total.#Значение = #сумма#
```

Saving a header with two lines (2 h × 6000, 1 h × 10000) writes 12000 and 10000 into the lines and 22000 into
the header — the lines' writes land without `#Сохранить`; an empty number reads as 0. Literally, with
`<H>` = the scripts-version id you mint and `<A>` = the bare `afterSaveScriptId` (§5d «Two id shapes»):

```text
{"@class":"kz.greetgo.mybpm.reg.structure.model.dto.ScriptDefStructDto","compositeId":"<H>-<A>",
 "blocks":{
  "<b1>":{"@class":"…block.BlockExitStruct","exitType":"FROM_METHOD"},
  "<b2>":{"@class":"…block.BlockAssignStruct","leftExprId":"<e23>","rightExprId":"<e24>","downBlockId":"<b1>"},
  "<b3>":{"@class":"…block.BlockForeachStruct","elementVarName":"#строка#","srcExprId":"<e3>","downBlockId":"<b2>","bodyBlockId":"<b6>"},
  "<b4>":{"@class":"…block.BlockNewVarStruct","varName":"#сумма#","valueExprId":"<e4>","downBlockId":"<b3>"},
  "<b5>":{"@class":"…block.BlockAssignStruct","leftExprId":"<e5>","rightExprId":"<e10>"},
  "<b6>":{"@class":"…block.BlockAssignStruct","leftExprId":"<e13>","rightExprId":"<e20>","downBlockId":"<b5>"},
  "<b7>":{"@class":"…block.BlockFixEntryPointStruct","x":30,"y":40,"downBlockId":"<b4>"}},
 "expressions":{
  "<e1>":{"@class":"…expr.ExprValueStruct","exprValueType":"THIS_PROCESS","constType":"BoiRefCode"},
  "<e2>":{"@class":"…expr.ExprActStruct","leftExprId":"<e1>","actId":"F-works-K-DYN-S-boi_fields"},
  "<e3>":{"@class":"…expr.ExprActStruct","actId":"F-VALUE-K-DYN-R-D-S-boi_fields","leftExprId":"<e2>"},
  "<e4>":{"@class":"…expr.ExprValueStruct","exprValueType":"CONST","constType":"BigDecimal","value":"0","valueTypeStruct":{"isArray":false,"type":"Number","baseType":"BigDecimal"}},
  "<e5>":{"@class":"…expr.ExprValueStruct","exprValueType":"VAR_REF","varBlockId":"<b4>"},
  "<e6>":{"@class":"…expr.ExprValueStruct","exprValueType":"VAR_REF","varBlockId":"<b4>"},
  "<e7>":{"@class":"…expr.ExprValueStruct","exprValueType":"VAR_REF","varBlockId":"<b3>"},
  "<e8>":{"@class":"…expr.ExprActStruct","leftExprId":"<e7>","actId":"F-line_total-K-DYN-S-boi_fields"},
  "<e9>":{"@class":"…expr.ExprActStruct","actId":"F-VALUE-K-DYN-R-D-S-boi_fields","leftExprId":"<e8>"},
  "<e10>":{"@class":"…expr.ExprOpStruct","opType":"Plus","leftExprId":"<e6>","rightExprId":"<e9>"},
  "<e11>":{"@class":"…expr.ExprValueStruct","exprValueType":"VAR_REF","varBlockId":"<b3>"},
  "<e12>":{"@class":"…expr.ExprActStruct","leftExprId":"<e11>","actId":"F-line_total-K-DYN-S-boi_fields"},
  "<e13>":{"@class":"…expr.ExprActStruct","actId":"F-VALUE-K-DYN-R-D-S-boi_fields","leftExprId":"<e12>"},
  "<e14>":{"@class":"…expr.ExprValueStruct","exprValueType":"VAR_REF","varBlockId":"<b3>"},
  "<e15>":{"@class":"…expr.ExprActStruct","leftExprId":"<e14>","actId":"F-hours-K-DYN-S-boi_fields"},
  "<e16>":{"@class":"…expr.ExprActStruct","actId":"F-VALUE-K-DYN-R-D-S-boi_fields","leftExprId":"<e15>"},
  "<e17>":{"@class":"…expr.ExprValueStruct","exprValueType":"VAR_REF","varBlockId":"<b3>"},
  "<e18>":{"@class":"…expr.ExprActStruct","leftExprId":"<e17>","actId":"F-hour_price-K-DYN-S-boi_fields"},
  "<e19>":{"@class":"…expr.ExprActStruct","actId":"F-VALUE-K-DYN-R-D-S-boi_fields","leftExprId":"<e18>"},
  "<e20>":{"@class":"…expr.ExprOpStruct","opType":"Mul","leftExprId":"<e16>","rightExprId":"<e19>"},
  "<e21>":{"@class":"…expr.ExprValueStruct","exprValueType":"THIS_PROCESS","constType":"BoiRefCode"},
  "<e22>":{"@class":"…expr.ExprActStruct","leftExprId":"<e21>","actId":"F-works_total-K-DYN-S-boi_fields"},
  "<e23>":{"@class":"…expr.ExprActStruct","actId":"F-VALUE-K-DYN-R-D-S-boi_fields","leftExprId":"<e22>"},
  "<e24>":{"@class":"…expr.ExprValueStruct","exprValueType":"VAR_REF","varBlockId":"<b4>"}}}
```

Write `…` out in full (`kz.greetgo.mybpm.reg.structure.model.bo.process.`). Wire it: the header's
`BoScriptVersionsStructDto` gets `"afterSaveScriptId":"<A>"` and `"scriptDefIds":["<H>-<A>"]` (the other
three hook ids minted, bodiless). Rename the five codes inside the `actId`s together with the fields — a
`DYN` act embeds the FIELD CODE (below «A body is NOT portable»). A total of several tables: one loop per
table into the same variable. `ЭТА ИНСТАНЦИЯ` is `THIS_PROCESS` — on a hook it means the saved record.

#### Company-global methods — `CompanyGlobalMethodsStructDto` `[C]`

«Глобальные методы» (`/settings` → «Глобальные методы») is one script module per company whose methods
every BO and process script of that company can call — a BO field script and a process Script figure
both call it as a plain `ExprCall` by name `[C]`. **A local method with the same name overrides the
global one** `[C]`; after `delete-local-method` the same call runs the global body again. So a BO that ships a
local method named like a global one silently shadows it — pick distinct names.

**In an archive** — the export basket switch «Глобальные методы» (`struct/change-export-is-global-methods`,
§2 «Taking a fresh export — the minimum») adds one `ScriptDefStructDto` per method plus ONE list line:

```json
{"@class":"…dto.ScriptDefStructDto","compositeId":"<global module id>-<scriptId>","blocks":{
  "<hat>":{"@class":"…process.block.BlockFixMethodStruct","x":20.0,"y":20.0,"methodName":"glob_greet","downBlockId":"<exit>",
           "params":{"<param id>":{"name":"imya","order":1,"type":{"baseType":"String","type":"Text","isArray":false}}},
           "returnType":{"baseType":"String","type":"Text","isArray":false}},
  "<exit>":{"@class":"…process.block.BlockExitStruct","exitType":"FROM_METHOD","returnExprId":"<expr>"}},"expressions":{…}}
{"@class":"kz.greetgo.mybpm.reg.structure.model.dto.CompanyGlobalMethodsStructDto","scriptDefIds":["<global module id>-<scriptId>", …]}
```

The body is the same Part II def as a local method (§«Local methods travel»): a `BlockFixMethodStruct` hat
with `params` and `returnType`, one `FROM_METHOD` exit carrying the return value. An archive may hold ONLY
these lines (plus `CompanyMetadataStructDto`) — no group, no BO; the analysis shows one row «Глобальные
методы», `structTypes: ["GLOBAL_METHODS"]`. Import semantics, all `[C]`:

- **The import REPLACES the company's whole list.** A method on the stand that the archive does not
  carry is DELETED (its def comes back empty); an archive with one method leaves exactly one.
- **The module part of `compositeId` is free** — a foreign module id lands in the stand's own module.
  **`scriptId` and every block / expression / parameter id are kept verbatim**, so a method re-imported
  with new ids is a NEW script, and a BO call written against the old one breaks (next bullet).
- A call site is an ordinary `ExprCall` by `funcName` (§13) — nothing in it names the global module — and
  its **`args` are keyed by the callee's parameter id** (§13). After a global method's param ids change,
  `translate-script` of the caller says «Не передан аргумент `imya` в вызов метода `glob_greet`»; after
  the method disappears, «У выражения справа не определён тип». Repair = re-key the args (or re-import
  the archive with the old ids). Ship global methods with their stand ids unchanged. Whether a RENAMED method
  (same `scriptId`, new `methodName`) keeps its callers translating is not known yet `[U]` — §18.
- Re-importing a stand's own export changes nothing (same `scriptId`, no duplicate).
- **An import does NOT reach the running scripts.** The stand runs a compiled copy of the global module,
  and the import does not refresh it: after an import, records kept running the OLD body — even of a
  method the import had DELETED — until any `apply-update-cmd` on any global method (a `Set` of an
  unchanged value is enough, `MYBPM-UI-API.md` §5g). Only then did the new bodies run (and the call to
  the deleted method failed with a field error). So **after importing global methods, touch one of them
  through the API or the IDE**, then test on a record.
  The API touch: `MYBPM-UI-API.md` §5g. The IDE route: «Настройки → Глобальные методы»
  (`/settings?settingsOpenPageUrl=global-script-methods`).
- Without an archive: `MYBPM-UI-API.md` §5g.

## 5e. Sidebar menu items inside the archive (`MenuItemStructDto`) `[C]`

The cookbook templates and rules are 0.5d and 0.15. The export screen has a separate «Элементы меню» basket
(§2 «Taking a fresh export — the minimum»).

**The line.** One `MenuItemStructDto` per item, a group and its children as separate lines. Keys, in the
exporter's order: `menuItemCode`, `menuItemName`, `parentMenuItemCode` (absent on a root),
`boCode` + `boName` (BO items only), `iconName`, `orderIndex` (the exporter writes a float, `10000.0`;
an int imports fine), `boPages` (BO items only), `chosenAccessRight`, `needCountMenuItem`, `isPanel`,
`needHideInMobApp`, `bracketFilter` (BO items only), `menuItemType` (what `needHideInMobApp` / `needCountMenuItem`
`true` do is not known yet `[U]` — §18; ship `false`). The line has **no id of any kind** —
not the menu item's own, not the BO's, not the parent's.

- `menuItemType`: `GROUP` | `BO` confirmed. The client enum is `BO_MANAGER COMPANY_MANAGER BO SETTINGS
  ANALYTIC REPORT GROUP PROCEDURES` (there is no `OTHER`). The UI itself creates only `BO` and `GROUP`
  items; `ANALYTIC`, `BO_MANAGER`, `COMPANY_MANAGER`, `SETTINGS` are the built-in items, one of each per
  company; `REPORT` belongs to operative reports, which have their own export basket
  (`MYBPM-UI-API.md` R4a). None of those was shipped in an archive `[U]`.
- `menuItemCode` is the menu item's `code` on the stand (`v2/menu-item/load-nav-items` returns it as
  `code`; the sidebar kebab «Изменить код» edits it). Items made in the UI get a transliteration plus a
  random tail (`GruppatqrXI0InJC5abW8w`) or the transliteration alone (`Kanban_iz_arhiva__proba_`), so a
  stand code is read off the stand, never derived.
- `boPages` is the API's `boPages` (`MYBPM-UI-API.md` §4) **with `kanbanFieldId` replaced by
  `kanbanFieldCode`**. The importer resolves the code into the real field id (the `newId` of the archive's own
  field) and adds `timelineFieldId: null` if the archive does not mention it.
- `parentMenuItemCode` is resolved the same way: the child gets `parentId` = the group's new id. Whether a
  re-import with ANOTHER `parentMenuItemCode` moves an existing item is not known yet `[U]` — §18.
- A `GROUP` line (no `boPages`, `bracketFilter`, `boCode`, `boName`, 0.5d) is stored with `boPages: null`.
- `bracketFilter` = the item's record filter, `{boCode, type: "MENU_ITEM", brackets}`. **Its shape
  differs from the API's** (`MYBPM-UI-API.md` §0U R6.5, arrays): here `brackets` and the filters inside
  are MAPS keyed by 8-character ids. A non-empty filter — «only records I created»:

  ```json
  "bracketFilter":{"boCode":"TestSumProcess","type":"MENU_ITEM","brackets":{
    "fx5mBogt":{"parentTreeIds":{},"order":0,"connectionType":"AND","notType":"DEFAULT",
                "dynamicFilters":{},
                "nativeFilters":{"iLWNZjcz":{"type":"CREATED_BY","isCurrentUser":true,
                                            "isEmptyValue":false,"orgUnitIds":{}}}}}}
  ```

  An empty filter (`brackets: {}`) still makes the stand create a bracket-filter record for the item
  (`bracketFilterId` is set). **A NON-empty filter imports whole** `[C]`, `dynamicFilters` included — an
  entry has the same shape as a field filter (0.5 «A record filter on the field
  TRAVELS»: `{"ajW7xfc8": {"fieldCode": "Tekst", "type": "INPUT_TEXT", "value": "фильтр", "numberFrom": 0,
  "numberTo": 0, "isCurrentUser": false, "isEmptyValue": false, "boiIds": {}, "fromFieldCodes": {}}}`); the
  BO may ship in the same archive, and `v2/menu-item/load-bracket-filter` returns the bracket ANDing its
  filters. A `DROPDOWN_SINGLE` entry on a dictionary field takes `value` = the dictionary row's `code` and the
  item's registry shows only those records `[C]` (example in 0.15 «One BO, several items»). `fieldCode` is resolved to the field id of the (new) BO, and the map keys are free
  8-char ids that become the ids of the bracket and of each filter as they are.
- **A menu line may reference a BO that is not in the archive**: an export of menu items carries no BO
  line for the items' BOs. Such a line relies on the BO already being on the stand, by `boCode`.
- Line order: an export may list a child BEFORE its group, so the importer probably tolerates any order
  `[I]`; a generated archive puts the group first, the order proved on import.

**The analysis step sees menu lines** `[C]`. `load-import-bo-infos` lists each one next to the BOs, with
`boCategory: null` and `structTypes: ["MENU"]` (the BO line: `["STRUCTURE"]`). `load-import-bo-record`
fills `menuInfo` instead of `structureInfo`:

```json
"menuInfo":{"type":"BO","displayName":"Проба канбана из меню","oldDisplayName":null,
  "parentMenuItemCode":"Proba_menu","boCode":"Proba_menu_bo",
  "boName":"Проба меню БО","iconName":"man-with-company","menuItemState":"CREATE",
  "changedAspects":["display_name","linked_bo","parent_menu_item","icon","bracket_filter","bo_pages","order_index"],
  "changeDetails":{"parent_menu_item":"Proba_menu","linked_bo":"Proba_menu_bo"}}
```

**A `menuItemCode` that already exists is UPDATED IN PLACE** `[C]`: the item keeps its id and its
`bracketFilterId` and takes the line's name and order; no second item is created. The dry run reports
`menuItemState: "UPDATE"` with `oldDisplayName` = the current name and
`changedAspects: ["display_name","order_index","bracket_filter","bo_pages","linked_bo"]` — the last three
listed even when they did not change, so `changedAspects` is not a real diff for them (why a stand code is
never reused: 0.5d).

**Rollback removes menu items too** `[C]`. `load-import-rollback-preview` lists in `deleteItems` the BO
(`category: "BUSINESS_OBJECT"`, `code: "<boCode>#BUSINESS_OBJECT"`) and every menu line
(`category: "MENU"`, `code: "<menuItemCode>#MENU"`, `structTypes: ["MENU"]`); `rollback-import`
answers `{"type":"ROLLED_BACK"}` and the BO and the menu items are gone.

**Icons** `[C]`: `iconName` is stored exactly as shipped and never validated (0.5d) — a made-up name passes
the dry run clean. The frontend fetches `<ns>:<name>` as `/assets/icons/<ns>/<name>.svg`, so «a valid
icon» = «that file exists»: all 1153 names of 0.16 answer 200. Both namespaces are in live use
(`phosphor:house`, `menu-item:022-presentation`).

**Rolling back an UPDATE restores a snapshot, and the stand may pick the wrong import as «latest»** `[C]`
— the rules: `MYBPM-UI-API.md` §5 «Rollback trap». The preview of an import that UPDATED a menu item lists
`restoreItems` (`action: "RESTORE"`, the BO and the menu line) and no `deleteItems`; only the import that
created them lists `deleteItems`.

**Menu access rights travel** `[C]`: an item with view limited to one
group exports `chosenAccessRight: true` + `accessGroup` (`{denyAll:true, all:{…}, view:{denyAll:true,
orgUnitIds:["G-<id>"]}, …}` — the `AccessStructDto` action shape) and one `ExportStructInstanceDto` per
group (`boCode:"PersonGroup"`); the import applies it (an item reset to «всем» gets the group back).
Calendar and timeline views: the 0.15 table.

## 6. References between BOs

- Type `BO`, `viewType` SINGLE / TABLE / MULTIPLE, `oldRefBoId`, `boRefStruct{boInfo, fieldRefs,
  linkedFieldCode}`. A two-way link is a SINGLE↔TABLE pair joined by `linkedFieldCode`.
- **`oldRefBoId` ≠ the target's `oldId` is NORMAL** — not a bug.
- **M:N = two `TABLE` fields, each naming the other in `boRefStruct.linkedFieldCode`** `[C]`: BO A
  with `TABLE` → B (`linkedFieldCode` = B's field), BO B with `TABLE` → A (`linkedFieldCode`
  = A's field), both may be in ONE archive, `isKindAddForSelect:false`, `fieldRefs` = the other BO's unique
  «Код». The stand stores `linkedFieldId` on both ends (and lists the `TABLE` field in the
  constructor's `linkedBo.fieldsForLink`); its own export of the pair carries exactly these keys.
  On records:
  - **Adding is mirrored and APPENDS** `[C]` — linking A to B adds A to B's back field, and the
    back field keeps the records it already had. The same through the form cycle (UI) and the script-less
    `save-boi-value` cycle, from either side.
  - **Removing through the form/UI is NOT mirrored** `[C]` — the row's ⊖ in the card (it sends
    `saveType:"REMOVE"`) and a replace without the id both leave the owner in the removed record's back
    field. The two sides drift apart; remove on BOTH sides yourself.
  - **Removing through `save-boi-value` (MYBPM-UI-API.md §6a) EMPTIES the removed record's whole back field**
    `[C]` — its links to every other record are lost too.
    Never remove from an M:N field with `save-boi-value`.
  - The xlsx route is untested for M:N `[U]`.
- `fieldRefs` = the reference's display config («Выбрать поля для отображения»):
  `{fieldCode: {toShow, orderIndex, gridPosition}}`. In real exports the gridPositions are a flattened
  copy of the TARGET BO's layout; a synthetic non-overlapping stack imports fine. `fieldRefs` does **not**
  resolve Excel references (that goes through the target's unique field) but it **defines the Excel
  sub-columns**.
- How the stand serializes a hand-made linked pair: the SINGLE side lists the linked field in `fieldRefs`
  as `{"gridPosition":{…}}` with no `toShow` and `tableColToShow:false`; the TABLE side does **not** list
  the linked field and has `isKindAddForSelect:false`. A stand's SINGLE side may additionally carry
  `isReadonly:true, chosenAccessRight:true`. A generated pair differing in exactly these points behaves
  identically on import — irrelevant to the Excel link defect. `[C]`
- A hand-made plain TABLE reference (no `linkedFieldCode`) exports with `fieldRefs` of only the toShow fields.

### Person reference

Type `BO`, `boInfo{code:"Person", name:"Пользователи", boCategory:"BO"}`, `"oldRefBoId": ""`.
**The stand resolves a reference to `Person` by `boInfo.code`, not by `oldRefBoId`** `[C]`: `""`, the
source company's `personBoId` (an export from another company, with or without its `CompanyMetadataStructDto`
line) and the target's own id all import into a field that points at the TARGET company's `Person` and picks
its users; a re-export writes the target's `personBoId`. So a `Person` reference is never stand data — build
it without asking. **`boInfo` is mandatory on every `BO` field**: a `BO` field without it fails the analysis
with `INTERNAL_ERROR` «fieldStruct with type BO don't have boRef» `[C]`. `Department` / `PersonGroup`
references resolve the same way `[I]`. Platform default for a fresh Person reference `[C]`: `surname`, `name`, `email`,
`personGroup` are `toShow:true`, every other Person field false (phone, position, department, status,
accessLevel, adGuid, ad_employee_id, is_external, is_lang, person_avatar, phoneVerified). To show ФИО
only, write `email` and `personGroup` as explicit `toShow:false` — because import merges (§7).

### Built-in BOs

Codes `Person`, `Department`, `PersonGroup` are taken — a user BO coded `Department` failed import with
«Несоответствие типов объектов» `[C]`. **Never reuse them.** No export contains a
`BoStructDto` for a built-in BO; they appear only as ids in CompanyMetadata. Do not synthesize one (risk
of overwriting built-in fields). To add a field to a built-in BO, do it by hand in the constructor;
exporting its real structure and appending to that DTO is untested `[U]` — §18.

## 7. Access rights inside the archive (`AccessStructDto`)

The API and UI side of rights → `MYBPM-UI-API.md`.

- `boAccessStruct` per action: `all, create, view, edit, delete, archive, export, duplicate, add`. Each
  action carries `denyAll`, `orgUnitIds: ["G-<groupId>", …]`, `authorsField{author, …}`,
  `fromFields{<personFieldCode>: same flags}`, `participants`.
- Field rules: `fieldAccessStructMap[fieldCode]` (only `view` + `edit` are meaningful per field).
  Tab rules: `fieldAccessStructMap[<TAB_GROUP code>].tabAccessStructMap[<tab code>]` — the same nine
  actions, only `view` + `edit` meaningful. **Tab rules round-trip** `[C]`: a tab
  rule (e.g. view + edit locked to one group) exported and imported — also as a copy under a new BO
  code — arrives with exactly that lock on that tab, the other tabs untouched, and the field still on its
  tab. «никому» (`view.denyAll:true`, empty `orgUnitIds`) also imports.
  Both keys are CODES; `validate-archive` checks that they name a real `TAB_GROUP` and its tab.
  **A tab has only the VIEW right** `[C]` (the constructor offers no other; `edit` in the struct is not
  applied separately). «никому» on VIEW hides the tab from every non-admin user — the tab disappears from
  the card AND its fields disappear from the registry columns, and a non-admin who edits and saves the
  record keeps the hidden fields' values `[C]`. **An admin always sees the tab and its columns** `[C]`.
  A `TAB_GROUP` all of whose tabs a user may not see is dropped from that user's form `[C]`. **Hidden is not secret** `[C]`: the rule only filters what the form and the registry draw — a non-admin still reads the tab's values through the API by its tab id (`v2/business-object-instance/v2/load-boi-values` with `tabId`, `v2/instance-form/load-field-structure-tab` + `v2/instance-field-form/load-field-data-tab`). Never put a password, a key or a personal secret on «Системные».
  This is the hidden system tab of 0.8a step 6.
- Semantics `[I]`: `denyAll:false` = «всем»;
  `denyAll:true` + empty `orgUnitIds` + all-false `authorsField` = «никому»; `denyAll:true` + ids and/or
  `author:true` = «только этим». The struct's **top-level** `denyAll` is a "custom rights are set" flag,
  not a global deny (BOs carry it true while their actions stay open).
- `chosenAccessRight:true` marks fields/tabs with individual rights. **It is only the orange lock in the
  constructor** `[C]`: a tab imported with `chosenAccessRight:false` and a «никому» rule
  still gets that rule, and the flag stays `false` as written. Write it `true` wherever you ship a
  rule so the constructor shows the lock.
- **What each subject opens** `[C]` (for a non-admin user, `view` restricted to ONE subject): `fromFields.<Person field code>` with «Содержимое поля» → exactly the records whose
  field names that user; `authorsField` «Автор» → exactly the records they created; `participants:true`
  («Участники») → the records they are a participant of. The author is a participant from the start; a
  Person field with `needAddToParticipants:true` (§3 «Reference fields») adds the person put into it, with a
  bell event «Вас добавили». `authorsField`'s «Содержимое поля» flag alone and a `fromFields` entry's
  «Автор» flag alone open NOTHING (the latter is `true` by default on every exported entry — harmless).
  Head / employees / department flags are `[U]` (§18). `authorsField.fieldCodes` `[I]` = the Person
  fields of the AUTHOR's own record (`Преемник`, `Предшественник`): «the author's successor sees it too».
  So for «a record is visible to the person in field X» write `fromFields.X` with «Содержимое поля» — that is
  enough on its own; add «Автор» if the creator must keep seeing it. The API names and the measurements →
  `MYBPM-UI-API.md` §3 «What each subject opens».
- Stand exports write `fromFields` for EVERY Person-ref field in EVERY action; it is a real setting, not a
  blind default.
- Rights of subjects are OR-ed: a per-record/per-field grant cannot narrow a group-level grant.
- Keep dictionary `view` open to everyone, otherwise dropdowns bound to it cannot open `[U]`.

## 8. What import does

- **Import MERGES into the BO already on the stand** `[C]`: a key ABSENT from the archive keeps its stand
  value; an explicit flag overwrites it. **Rule: to hide or disable something, write the flag
  as `false`; never drop the key. Write field-level flags explicitly on every field.**
- **Nothing is ever deleted by an import** `[C]`: an archive without a
  field that the stand BO has leaves the field in place (the pre-apply diff has only «added» / «changed»
  categories, and the import client has no delete path at all). Tabs too `[C]`: an archive that drops
  a TAB_GROUP or a tab leaves the group, the tab (same id) and the fields on it (same `tabId`) in place;
  the diff lists the kept fields as «changed» and the apply is clean. Remove fields and tabs in the constructor
  or through the API (`deletedFieldIds` of `save-business-object-portion`, `MYBPM-UI-API.md` R1).
- Structure import does not touch instance values — belief consistent with everything seen `[I]`.
- **Import APPLIES `AccessStructDto`, group ids included** `[C]`: rights
  reset on the stand come back from an export taken with «Права доступа» — every group on its action.
  `denyAll`, `author`, `fromFields`, field rules and tab rules arrive too. The import does NOT
  clear `orgUnitIds`; ids are `G-<group id>` of the TARGET stand: an archive built on another stand names groups the
  target does not know, and each must be mapped onto an existing group before the apply (below).
- **An archive WITHOUT `AccessStructDto` leaves the stand's rights untouched** `[C]`. So a structure-only archive is the safe way to
  update a BO whose rights were set by hand; an archive WITH the DTO replaces them.
- An export with rights also carries one `ExportStructInstanceDto` per group it mentions
  (`boCode:"PersonGroup"`, `kind:"PERSON_GROUP"`, `fieldMap.name.storedValue` = the group name,
  `sources[].accessRightsInstanceSource`) — the group RECORD, not only its id `[C]`: `compositeId` =
  `<personGroupBoId>-<group record id>`, and the `G-<id>` of `orgUnitIds` is that same record id.
- **The import never creates a group (or department) from such a line** `[C]`. A line whose id the target
  does not know makes the analysis report a `SELECT_INSTANCE` conflict (`exportedOrgUnitName`, `selectFromIds`
  = the candidates), and the apply is refused («Conflicts have to be resolved before applying») until the
  conflict is mapped onto an EXISTING group (the UI's conflict dialog, `MYBPM-UI-API.md` §5). So create the
  groups on the target first (records of `PersonGroup`, §3), then import and map each conflict.
- **Trap: the import writes the archive's group name onto the stand's group** `[C]` — onto the group the
  line's id matches (no conflict), and onto the group a conflict was mapped to. An old export re-imported
  reverts a group renamed since; an archive from another stand renames the groups it is mapped onto. Set
  `fieldMap.name.storedValue` to the TARGET group's current name before importing.
- Getting group ids for an archive: set probe rights on one BO with a DIFFERENT group per action
  (view/edit/delete/archive/export), export the structure, map ids by action; or call
  `load-org-unit-record-list`. Archive ids are `G-<id>`, API ids have no prefix.
- **«APPLIED» does not mean the BO was created** `[C]`: an apply whose process ends
  `hasError: true, errorState: "ONLY_INTERMEDIATE_ERRORS"` still sets the import to `APPLIED`, yet the BO
  may be missing — e.g. `kanbanCardTemplates` naming a field code the archive no longer has
  («no field with code: …»). `load-import-errors` stays empty; the message is only in
  `v2/process-indicator/load-state {processId}` → `phases.*.errors`. After every apply check the poll's
  `hasError` and load the BO. When you delete a field from an archive, delete it from every
  `kanbanCardTemplates.*.kanbanFields` too.
- BOs created via import carry `kanbanCardTemplates:{}` unless the archive fills it — the cause of «kanban
  does not work for imported BOs» and of a dead MAP view; fill it per dropdown (0.5c).


### Re-import of the same ids — matched by `oldId` / `newId` `[C]`

- **A re-import matches the BO by `oldId` and its fields by `newId`, NOT by code** `[C]`. What a re-import does
  to an existing field's `type` or `code` (same `newId`, new value), or to a BO's `category` (same `oldId`), is
  not known yet `[U]` — §18; change those in the constructor.
  An archive whose BO `oldId` was already imported, but whose field `newId`s are all fresh, analyses with
  no error and no conflict and applies: it **adds** its fields to that BO next to the ones it already has,
  with the **same codes** (two «Текст» with code `Tekst`, two buttons `Plagin`, and so on). It also
  **rewrites the BO's `code` and name** to the archive's. Each imported field takes its `newId` as
  its real `fieldId`. So: keep a field's `newId` fixed between imports of the same BO (derive it from a seed,
  as above). When you copy an archive to make a NEW BO, change the BO's `oldId` as well as its `code`.
  Change the field `newId`s too: what happens when a new BO's `newId` equals a field id of ANOTHER BO is `[U]`.
  A stand export is safe to copy this way, since its ids are freshly minted (§2).
- **A deleted BO comes back — with ALL its old fields** `[C]`. Both a rollback of the import and
  `delete-business-object` delete a BO SOFTLY: it is gone by code (`load-bo-id-by-code` → «No bo with code»,
  out of the sidebar), but its id still holds the BO with every field. An archive that carries the same
  `oldId` again brings it back with all its OLD fields beside the new ones — fields the new archive does not
  name stay, each with its old `gridPosition`, so they overlap the new layout. The analysis diff lists only
  the new fields as «added» and warns about nothing `[C]`. A revived `BO` field that pointed at a
  dictionary removed by a ROLLBACK keeps the dead id: opening its options answers «… данный бизнес-объект не
  существует» `[C]`; a dictionary removed by `delete-business-object` stays resolvable and the options
  are simply empty `[C]`. Why the two removals differ is `[I]` (rollback deletes the dictionary hard).
  **So a new attempt of a rolled-back or deleted system needs NEW ids** — a new salt (0.7 case 4), never the
  seeds of the earlier attempt; to reuse a revived BO instead, delete its stale fields (`deletedFieldIds`,
  `MYBPM-UI-API.md` R1).

### BO groups on import — matched by `code` `[C]`

What a group line of the archive does to the stand's groups:

| archive group line | result |
|---|---|
| no `code`, new name | the stand group «Бизнес-объект» was **renamed** to the new name, BO put into it |
| no `code`, new name, unique `orderIndex` | the same group renamed AND moved to that `orderIndex` |
| no `code`, `name` = another existing group («Tests») | the same «Бизнес-объект» renamed to «Tests» — two groups «Tests» |
| two lines, no codes | both BOs in the same renamed group (the name of the LAST line) |
| `code` = an existing group's code, `name` / `orderIndex` = the group's own | BO in that group, nothing renamed |
| `code` = an existing group's code, another `name` / `orderIndex` | BO in that group, the group RENAMED and MOVED to the line's values |
| `code` new to the stand | a NEW group created — id = the line's `newId`, `code` kept |
| two lines, one existing code + one new code | each BO in its own group, one group created, nothing renamed (the existing line carried the group's own name) |

- **Groups are matched by `code`.** A line without `code` is written onto ONE fixed stand group (here
  «Бизнес-объект»; NOT the group with the largest `orderIndex`; why that one is `[U]` — do not re-probe
  it, a new group always gets a code) — name and
  `orderIndex` are overwritten. The name is NOT a key: the «safe recipe» «copy an existing
  group's name» works only because the name copied was that same fixed group's own name.
- The symptom «two groups → all BOs in «Справочники», renamed» is this same behaviour: group lines
  without `code`.
- **A code-matched line is NOT a safe pointer** — it rewrites the group's `name` and `orderIndex` to its
  own. Only a line that repeats both exactly leaves the group as it was.
- **Rollback deletes the imported BOs and a group the import CREATED, but does NOT undo a rename** — the
  rollback preview lists no `restoreItems` for the group. Repair by hand: `v2/business-objects/
  save-business-object-group` with the group object of `load-bo-groups` and the old `name` / `orderIndex`
  («After the import — the stand-side calls» below).
- Stand groups made in the UI mostly have `code: null`; an archive can reach only
  a group that has a code. Giving an existing group a code is `save-business-object-group` with `code`
  (`verify-business-object-group-code` checks only that it is free) `[C]`: an archive with that code then puts
  its BO into the group. It is one-way — `code: null` is refused, so the group can never
  be code-less again. A group created now always gets a code `Gruppa__N`.
- **An import never deletes a group** `[I]` (the import client has no delete path, above): an archive without
  a group's line leaves it in place; only a rollback removes a group, and only one that import CREATED.

#### After the import — the stand-side calls `[C]`

These settings do not travel (or travel only one way) and are set on the stand after the import — the calls
are in `MYBPM-UI-API.md`: a code for a code-less BO group or undoing a group rename (§5 «Verifying an import
through the API»); a code for a `TAB_GROUP` or any field (`save-business-field-code`, §5i «Tabs»); a lock on
a system field (§5i «System fields»); a SIGNATURE's phone and mass print form (§5i «The SIGNATURE widget»);
deleting a stray print-form copy (§5i «Print forms»); removing a card tab — `boTabs` only adds (§5k);
clearing a messenger link field (§5k); calendar event titles (§5l); «Зависимость от» / «Внутреннее поле» of a
`BO` field (§5h «С фильтром» и «Зависимость полей»). Deleting a field or a tab is the constructor's job
(R1); company settings that never travel (OTP department, Google Maps key, messenger BO / user lists) are set
on their «Настройки» pages (§5n).

---

# Part II — Block IDE scripts

Scripts are delivered as **paste-ready JSON**, not as code: the editor is a Scratch-like block IDE whose
interpreter is written in Java. This part covers the JSON schema, the delivery (paste) protocol, runtime
semantics of the built-in actions, and the business-process specifics.

**If your task is «write me a script», read §0S and nothing else.** It is the script counterpart of §0:
complete literal templates of every block and expression, the `actId` catalogue, the rules that break a
script silently, a whole worked example and a self-check list. §§9–16 are the reference material behind it;
§12a is a lookup table, opened only for a name 0S does not print.

---

## 0S. COOKBOOK — produce a pasteable script from this section alone

**Read this section if your job is «write me a Block IDE method or process script».** It is
self-contained: every literal below is in the form the IDE itself produces and the platform runs.
§§9–16 are the material for exotic cases; this one is *what to type*. Follow it
literally, change only what step 2 of the algorithm says you may change, and **never invent a key, an
`actId` or an `opType`** — anything you cannot find in this section does not exist in the language.

What a model invents when it skips the reading, by class — each one breaks a script, often silently:

| Class | Invented | Real | Where |
|---|---|---|---|
| Names | an `actId`, `opType`, block `type` or key not printed here (an `indexOf`, a `While` block) | only 0S.5–0S.8 and §12a; an unknown enum value bricks every script of the BO | 0S.8, 0S.9 rule 13 |
| Ids | method parameter ids, process arrow ids or dictionary row ids made up; an id repeated; any length but 16 | those three are copied from the user's copy byte for byte; your own ids are 16 chars, unique in the file | 0S.4 |
| Delivery | a whole method with its hat for the clipboard; a file without the copy of the empty method | the body only; no copy → pseudocode and a request, no file | 0S.1, 0S.2 step 2 |
| Structure | expressions nested inline; one expression used in two places | two flat maps linked by id; every expression referenced once | 0S.3, 0S.9 rule 6 |
| Language | `while`, an array literal, a field chosen at run time | a counted loop + «ВЫЙТИ ИЗ ЦИКЛА»; one `ЕСЛИ` per field | 0S.1 item 3, 0S.9 rule 11 |
| Comparisons | `Eq` on numbers or on a boolean; `a > b > c` | «не меньше и не больше»; the boolean itself or `Not`; `And` | 0S.9 rules 1, 2, 5 |
| Checking | «no red in the IDE» taken as «works» | the 0S.11 self-check and a copy back from the IDE | 0S.2 step 8, 0S.11 |

### 0S.1 The artefact

You deliver **one JSON file that is put on the clipboard**. The user opens the method (or the process
script) in the Block IDE, right-clicks the canvas and picks «Вставить» in its context menu `[C]` (whether Ctrl+V
works too is `[U]`); the IDE rebuilds the blocks from the JSON. There is no
source file on the platform side, no compiler, no CLI — **for the IDE route the clipboard is the whole
delivery channel**. (Both directions also exist outside the IDE: a structure export taken with the
«Скрипты» checkbox carries every script of the BO as `ScriptDefStructDto`, and an import CREATES the
scripts it carries — §5d, local methods and company-global methods included. Over the API a method
is created by name with no IDE — `MYBPM-UI-API.md` §5g. «You cannot create a method» below is about
the clipboard route only.)

Four things you cannot do — do not look for a workaround:

1. **You cannot create a method.** A fragment whose root is the method hat (`BlockFixMethod`) is silently
   not pasted. The user creates the empty method by hand (name, parameters, return type), copies it out
   of the IDE, and gives you that copy; you deliver the **body**.
2. **You cannot invent the ids of method parameters** (nor of process arrows, nor of dictionary rows).
   They are generated by the platform and live outside your file — they come from the user's copy.
3. **The language has no `while`, no array literals, no dynamic dispatch**: a counted loop and a foreach are the
   only loops; an array exists only as a method PARAMETER type (`isArray:true`) or as a collection an act
   returns, and the element of a foreach over a `Текст[]` parameter is untyped (§10 `BlockForeach`; a `Bo[]` element reads fields fine); a method cannot be called by a name taken from data; a field cannot be chosen at run time
   (one `ЕСЛИ` per field). Plan the algorithm inside these limits, not around them.
4. **You cannot run the script.** Nothing you write is verified until the user pastes it and the stand
   executes it; your own verification is structural only (0S.11).

### 0S.2 Algorithm

1. **Write the algorithm as pseudocode first**, in the block language and nothing else:
   `Пусть <имя> = <выражение>` (declare), `<переменная> = <выражение>` (assign),
   `ЕСЛИ <условие> … ИНАЧЕ ЕСЛИ … ИНАЧЕ`, `ЦИКЛ <элемент> : <число или коллекция>`,
   `ВЫЙТИ ИЗ ЦИКЛА`, `ВЕРНУТЬ <выражение>`. If a step of your plan cannot be written in those six forms,
   the plan is wrong, not the language. Name and lay it out by the house style of 0S.2a (header of
   declarations first, decorated Russian names, modules).
2. **Ask the user for everything you cannot know**, one request at a time, and wait for the answer:
   - the **copy of the empty method** (gives the real `methodName`, the parameter **ids**, their order
     and types, the return type) — needed before you emit a single line;
   - the **exact field codes** of every BO you read or write (case-sensitive: `Argument` ≠ `argument`);
   - for a dictionary row constant — the dictionary's `boCode` and the row's `boiId`;
   - for a process script — the `targetArrowId` of every outgoing arrow you exit by.

   **The user does not give the method copy → deliver no file.** The parameter ids cannot be guessed, and a
   body whose `VAR_REF`s name ids the method does not have reads nothing. Write the pseudocode of step 1,
   say exactly what you need (the copy of the empty method with its name, parameters and return type) and
   stop. A method WITHOUT parameters still needs the copy: it names the method the body goes into. Field
   codes, `boiId`s and arrow ids are the same — never invented, asked for.
3. **Build two flat maps** — `blocks` and `expressions` — inside the envelope of 0S.3. Nothing nests
   inline: a block names its expressions by id, an expression names its operands by id.
4. **Chain the statements** with `downBlockId` (0S.5), then point `startBlockIds` at the root.
5. **Run the self-check of 0S.11.** It is not optional: the IDE accepts a broken fragment silently.
6. **Strip the hat** if this is the body of an existing method (0S.12).
7. **Put the file on the clipboard** with `wl-copy --type text/plain < file.json` — no other form works.
8. **Tell the user exactly where to paste**, then ask for a copy back and compare (0S.11) — «no red in
   the IDE» proves nothing; it silently drops broken expressions.

### 0S.2a House style — naming and layout

The platform does not enforce any of this (a `varName` is a free string, 0S.5); it is the convention
every script written for this user follows. Apply it to the pseudocode of
step 1 and carry the names into the JSON unchanged.

**Language.** Variable and module names are in **Russian**. The exceptions: method **parameters** are
English `snake_case` with no decoration (`step`, `formula`, `model_step`), and loop **counters** are bare
`i`, `j`, `k`.

**Decoration — what the variable holds decides the wrapper:**

| holds | wrapper | case | example |
|---|---|---|---|
| a field reference — anything that has `.#Значение` (hop 1 of 0S.7, no VALUE) | `~…~` | first letter capital | `~Статус~`, `~Шаги~` |
| a BO type (the `BoRefCode` constant) | `%…%` | the BO's **display name** as shown, not its code | `%Шаг модели%` |
| a collection of ONE element by design | `[…]` around the element's own name | element style | `[#ответственный#]`, `[~Ссылка~]` |
| a collection that may hold MORE than one | `<…>` around the element's own name | element style | `<#шаг#>`, `<~Ссылка~>` |
| everything else — text, number, date, a **record (instance)** | `#…#` | **all** letters lower case | `#сумма ндс#`, `#заявка#` |
| a module (below) | `\|…\|` | free | `\|Проверка ИНН\|` |
| a loop counter | none | — | `i`, `j` |

- A **record is `#…#`**, the **field that holds records is `~…~`**: `~Шаги~` is the field, its
  `.#Значение` is `<#шаг#>`, one element of it is `#шаг#`. A field with a plain value is `~…~` too
  (`~Статус~` = `#заявка#.Статус`).
- `[…]` vs `<…>` is decided **by design when writing the code**, not by the run-time count. The element
  inside is written in the singular, in its own style (an element that is itself an array keeps its own
  brackets).
- **A boolean ends in `?` inside the wrapper**: `#найдено?#`, `~Активен?~`. Modules are the exception —
  they are booleans but take no `?`.
- **A trailing `*` marks the inner twin of an outer variable**: when a nested scope (an inner loop, a
  branch) needs its own variable for the same thing an outer one already names, the outer keeps the plain
  name and the inner gets `*` before the closing wrapper — `~Человек~` in the parent loop, `~Человек*~`
  in the child; `~Объем~` of a row, `~Объем*~` of the record created from it. The `*` is part of the convention, not a
  defect: never flag it in a review.

**Layout — declarations first.** A script (and every module, 0S.2a «Modules») opens with a header of
`Пусть` blocks; the logic comes after it, and below the header there is only assignment and logic (loop
elements are declared by their loop and stay where the loop is). A header line either declares the
variable empty or initialises it at once when its value is already known:

| kind | empty declaration | IDE shows |
|---|---|---|
| text | `Пусть #текст# = ''` | `''` |
| number | `Пусть #сумма# = 0` | `0` |
| boolean | `Пусть #найдено?# = <пусто>` — a `Bool` CONST **without `value`** | `<пусто>` |
| record | `Пусть #шаг# = %Шаг модели%.<пусто>` — a `BoiRefCode` CONST with `boCode`, **without `boiId`** | `БО/<name>.<пусто>` |
| field reference | — none; initialise: `Пусть ~Статус~ = #заявка#.Статус` | |

The two empty constants are in 0S.6. Text and number have no empty form — they always take a value.

**Modules.** A module is a **boolean variable** `|Имя|` whose name is unique within the Company, used
**only** as the sole condition of an `ЕСЛИ` that has **no `ИНАЧЕ ЕСЛИ` and no `ИНАЧЕ`**:

```text
Пусть |Проверка ИНН| = Да            ← header: Да / Нет / <пусто>
…
|Проверка ИНН| = Нет                 ← any assignment on the way switches it off (or on)
ЕСЛИ |Проверка ИНН|
    Пусть #инн# = ''                  ← the module's own header
    Пусть #инн верен?# = <пусто>
    …                                 ← the module's logic
```

- **The body of a module is the same code everywhere in the Company** — every use of `|Проверка ИНН|`,
  in any script, carries a byte-identical body. Change one, change all.
- **No `ЭТА ИНСТАНЦИЯ` / `ЭТОТ ПРОЦЕСС` inside a module.** The record comes in as an outer variable.
- A module uses its **own** variables (declared in its header) and **outer** ones — declared outside it.
  Every place the module is used must therefore have, in scope, variables with exactly those names and
  types (the module's inputs).
- **Modules nest** (a module inside a module; where the inner module's `|…|` is declared — the outer
  module's header or outside — does not matter) and **one module may be used more than once** in a script
  or in another module. Two copies live in two separate `ЕСЛИ` bodies, so their inner names do not clash
  (rule 7 of 0S.9 is per scope).
- **Compose anything but a trivial script out of modules.**

**Templates (pseudo-metaprogramming).** A name may embed another variable's name: `#пароход ${#имя
парохода#}#` reads «the пароход whose name is in `#имя парохода#`». The template stays in the `varName`
**literally**, `${…}` included — it is a note on where the value comes from, nothing substitutes it.

### 0S.3 The envelope

Exactly these five keys, in any order. `mouseX`/`mouseY` are the paste anchor and are irrelevant —
copy the numbers below.

```json
{"copiedType":"SCRIPT_BLOCKS","mouseX":202,"mouseY":62,
 "startBlockIds":["<id of the root block>"],
 "blocks":{},
 "expressions":{}}
```

- `blocks` — `{"<block id>": {block}}`; `expressions` — `{"<expression id>": {expression}}`.
- `startBlockIds` holds ONE id: the method hat for a full method, the first body block for a body paste,
  the `BlockFixEntryPoint` for a process script.
- Every block and every expression carries its own `"type"` key (`"BlockNewVar"`, `"ExprOp"`, …). That
  key is what the reader dispatches on — never omit it.
- **The delivered file is pure ASCII: every non-ASCII character is a JSON `\uXXXX` escape** `[C]` —
  `"#подписант#"` ships as `"#\u043f\u043e\u0434\u043f\u0438\u0441\u0430\u043d\u0442#"`, and the paste turns it back
  into `#подписант#`. Raw Cyrillic read on its way to the IDE in another code page (Mac Roman, Windows-1251 …)
  is pasted as broken names like `#–ø–æ–¥‚Ä¶#`, and nothing warns. Codes: `А`–`Я` = `0410`–`042F`, `а`–`я` =
  `0430`–`044F`, `Ё` = `0401`, `ё` = `0451`, `№` = `2116`, `«` `»` = `00AB` `00BB`, `—` = `2014`. With code at hand,
  after `JSON.stringify`: `.replace(/[^\x00-\x7f]/g, c => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"))`.
  The examples of this Part show Cyrillic as is for reading; the file you hand over escapes it.

### 0S.4 Ids

- An id is **exactly 16 characters** from `A-Za-z0-9@~` (`zngRL2KpAU1YQ4tn`, `CnTkEwA@Ybn4tOeF`). Any
  16-character string from that alphabet works — the IDE regenerates every id on paste anyway.
- **Unique across the whole file**: block ids, expression ids and the keys of `branches` and of `more`
  share one namespace in practice — never repeat a string.
- **Three kinds of id are NOT yours to generate** (they point outside the file and must be reproduced
  byte for byte): method **parameter ids** (keys of `params`, and the `varBlockId` of every reference to
  a parameter), process **arrow ids** (`targetArrowId`), and dictionary **row ids** (`boiId`).

### 0S.5 Statements — one template per block

Sequencing: a statement points at the next one with `downBlockId`; the **last statement of a chain has no
`downBlockId`**. A nested chain (the `То` branch, an `ИНАЧЕ` branch, a loop body) is a chain of its own:
its last block has no `downBlockId`, and execution continues at the parent block's `downBlockId`.

```json
{"varName":"#текст#","valueExprId":"<expr>","downBlockId":"<next>","type":"BlockNewVar"}
```
«Пусть». `varName` is a free string — the `#…#` / `~…~` / `%…%` / `[…]` / `<…>` / `|…|` decoration is
part of the name, not syntax (which decoration to use is the house style of 0S.2a), but **a name must be
unique within its scope** (rule 7 of 0S.9), loop element names included.

```json
{"leftExprId":"<expr>","rightExprId":"<expr>","downBlockId":"<next>","type":"BlockAssign"}
```
Assignment. `leftExprId` is a `VAR_REF` for a local variable, or the `.#Значение` act for a field (0S.7).

```json
{"ifExprId":"<expr>","thenBlockId":"<first block of То>",
 "branches":{"<id>":{"blockId":"<first block>","order":10,"exprId":"<expr>","hasExpr":true},
             "<id>":{"blockId":"<first block>","order":20}},
 "downBlockId":"<next>","type":"BlockIf"}
```
`branches` are evaluated in `order` (10, 20, …). A branch with `exprId` + `hasExpr:true` is «ИНАЧЕ ЕСЛИ»;
a branch without them is the plain «ИНАЧЕ». Both keys may be dropped for the plain else — the IDE itself
writes `{"blockId":…,"order":20}`. `branches` may be `{}` or absent; `thenBlockId` may be absent (an empty
`То` slot is legal). **Exactly one branch of the chain runs** — for «try every candidate» write
independent `ЕСЛИ` blocks one after another.

```json
{"elementVarName":"#шаг#","srcExprId":"<expr>","bodyBlockId":"<first block>",
 "downBlockId":"<next>","type":"BlockForeach"}
```
Two uses, same block: `srcExprId` a **number** → a counted loop (that many passes); `srcExprId` a
**collection** (a link-many field read through `.#Значение`) → a foreach. The counter runs from **1** to the bound,
and the bound is evaluated ONCE on entry — reassigning its variable inside the body changes nothing `[C]`.

```json
{"exitType":"FROM_METHOD","returnExprId":"<expr>","type":"BlockExit"}
{"exitType":"FROM_CIRCLE","circleBlockId":"<BlockForeach id>","type":"BlockExit"}
{"exitType":"FROM_CIRCLE_ITER","circleBlockId":"<BlockForeach id>","type":"BlockExit"}
{"exitType":"FROM_METHOD_BY_ARROW","targetArrowId":"<arrow id from the user>","type":"BlockExit"}
```
`FROM_METHOD` = «Выйти из метода», and it **carries the return value** — a body without it returns
nothing. `FROM_CIRCLE` = break, `FROM_CIRCLE_ITER` = continue (both name their loop block; `FROM_CIRCLE` is the
one that is exercised — prefer a guard `ЕСЛИ` over continue).
`FROM_METHOD_BY_ARROW` leaves a **process** script through a named arrow. An exit block never has a
`downBlockId`. **A process script ends by the figure it sits in** `[C]`: a **Script** figure (exactly ONE
outgoing arrow) ends in a plain `{"exitType":"FROM_METHOD","type":"BlockExit"}` with no return value; a
**Switch** figure (several named outgoing arrows) ends EVERY path in `FROM_METHOD_BY_ARROW` with one of ITS
OWN arrow ids and has no plain exit. «A script with two outgoing arrows» is a Switch. No validator catches
the swapped form — write only these two. **Keep exactly ONE `FROM_METHOD` per method, at the end** (0S.9).

```json
{"x":55,"y":44,"methodName":"describe",
 "params":{"<param id>":{"name":"step","order":1,
                         "type":{"baseType":"BoiRefCode","boCode":"Model_step","isArray":false,"type":"Bo"}},
           "<param id>":{"name":"formula","order":2,
                         "type":{"baseType":"String","isArray":false,"type":"Text"}}},
 "returnType":{"baseType":"String","isArray":false,"type":"Text"},
 "downBlockId":"<first body block>","type":"BlockFixMethod"}
```
The method hat. **Copy it from the user's copy, do not compose it** — the parameter ids and types must be
the live ones. It never pastes; it exists in your file only so the self-check can see the parameters, and
0S.12 strips it. Type literals: Текст `{"baseType":"String","isArray":false,"type":"Text"}`, Число
`{"baseType":"BigDecimal","isArray":false,"type":"Number"}`, Логическое
`{"baseType":"Boolean","isArray":false,"type":"Bool"}`, экземпляр БО
`{"baseType":"BoiRefCode","boCode":"<BO code>","isArray":false,"type":"Bo"}`.

```json
{"x":56,"y":65,"downBlockId":"<first block>","type":"BlockFixEntryPoint"}
```
The «ТОЧКА ВХОДА» hat of a **process** script. Unlike a method hat this one **does** paste, and it must
be in the fragment.

### 0S.6 Expressions — one template per kind

Two rules before the templates:

- **An expression id is referenced EXACTLY ONCE.** The expression graph must be a strict tree: if the
  same value is needed twice, emit two independent copies of the subtree. Reusing an id makes the IDE
  complain «…операнд номер 1, который уже ранее использовался».
- **`value` is always a string**, for numbers and booleans too (`"0"`, `"yes"`).

```json
{"exprValueType":"CONST","valueType":{"baseType":"String","type":"Text"},"constType":"String","value":"текст","type":"ExprValue"}
{"exprValueType":"CONST","valueType":{"baseType":"BigDecimal","type":"Number"},"constType":"BigDecimal","value":"42","type":"ExprValue"}
{"exprValueType":"CONST","valueType":{"type":"Bool"},"constType":"Boolean","value":"yes","type":"ExprValue"}
```
Text / number / boolean constants (`"yes"` / `"no"`). An empty text constant is `"value":""` — and note
that a copy coming back from the IDE has **no `value` key at all** for it.

```json
{"exprValueType":"CONST","valueType":{"type":"Bool"},"constType":"Boolean","type":"ExprValue"}
{"exprValueType":"CONST","valueType":{"baseType":"BoRefCode","type":"Bo","isArray":false},"constType":"BoiRefCode","boCode":"<BO code>","type":"ExprValue"}
```
The two **empty** constants of a header (0S.2a): a boolean without `value` (IDE `<пусто>`) and a record of
a given BO without `boiId` (IDE `БО/<name>.<пусто>`; note `valueType.baseType` is `BoRefCode` while
`constType` is `BoiRefCode` — copied as the IDE wrote it). `[C]` for the IDE; how a script behaves on an `<пусто>` boolean in `ЕСЛИ` is `[U]`.

```json
{"exprValueType":"CONST","valueType":{"baseType":"BoRefCode","type":"Bo","boCode":"Operator"},"constType":"BoRefCode","boCode":"Operator","type":"ExprValue"}
{"exprValueType":"CONST","valueType":{"baseType":"BoiRefCode","type":"Bo","boCode":"MODEL_ERROR_CODE"},"constType":"BoiRefCode","boCode":"MODEL_ERROR_CODE","boiId":"5boPQBYRaVkegMu1","type":"ExprValue"}
{"exprValueType":"CONST","valueType":{"baseType":"SingleSelectRefCode","type":"SingleSelect","boCode":"Operator","fieldCode":"operator_type"},"constType":"SingleSelectRefCode","boCode":"Operator","fieldCode":"operator_type","optionId":"INDEX_BINARY","type":"ExprValue"}
```
A BO **type** (`BoRefCode` — the left operand of create-instance and of `findByFilter`); a concrete
**record / dictionary row** (`BoiRefCode` — `boiId` comes from the user); a **SingleSelect option**
(an option cannot be stored in a variable). **The key differs by form** `[C]`: in an ARCHIVE
(`ScriptDefStructDto`, §5d) it is **`optionCode` = the option's CODE**, and an `optionId` there is dropped
silently — the script translates and then writes an EMPTY option; in the clipboard / on the stand
(`load-script-def`, `apply-update-cmd`) it is `optionId` = the option's stand id (`v2/script/load-bo-field-options`)
— whether a clipboard paste also takes the code is `[U]`.

```json
{"exprValueType":"VAR_REF","varBlockId":"<BlockNewVar | BlockForeach | parameter id>","type":"ExprValue"}
{"exprValueType":"THIS_PROCESS","constType":"BoiRefCode","type":"ExprValue"}
```
A variable reference names the block that declared it (or the parameter id for a parameter).
`THIS_PROCESS` is the record the script runs on: IDE «ЭТОТ ПРОЦЕСС» in a process script, **«ЭТА
ИНСТАНЦИЯ» in a BO's form script** (the hooks and field-change scripts) `[C]`.

```json
{"opType":"Concat","leftExprId":"<expr>","rightExprId":"<expr>","type":"ExprOp"}
{"opType":"Concat","leftExprId":"<expr>","rightExprId":"<expr>",
 "more":{"<id>":{"opType":"Concat","order":10,"exprId":"<expr>"}},"type":"ExprOp"}
```
Binary operator; a third and further operand go into `more`, applied after left/right in `order`.
**Run-proven `opType`s — all 17**: `Plus`, `Minus`, `Mul`, `Div`, `Concat`, `Eq`,
`NotEq`, `More`, `Less`, `And`, and also `Or`, `Xor`, `Not` (unary: `leftExprId` only), `LessEq`,
`MoreEq`, and `OrEq` / `AndNotEq` (only inside `more` of an `Eq` / `NotEq`) (§12a). **Never type any other string into `opType`**: a value outside the
server's enum is stored as is and then makes EVERY script of the BO unreadable, with no way back
through the API (§17 trap 26).

```json
{"leftExprId":"<expr>","actId":"F-length-K-FIX-T-String","type":"ExprAct"}
{"leftExprId":"<expr>","actId":"F-substring-K-FIX-T-String","argExprIds":{"startIndex":"<expr>","endIndex":"<expr>"},"type":"ExprAct"}
```
A built-in action applied to the value in `leftExprId`. `argExprIds` is keyed by the **argument name**
from the table in 0S.8; an action without arguments has no `argExprIds` key.

```json
{"funcName":"is_formula","args":{"<callee parameter id>":{"name":"#текст#","order":1,"exprId":"<expr>"}},"type":"ExprCall"}
```
A call of another method in the same project. **`args` is keyed by the CALLEE's parameter id** — not by
name, not by position; `name` and `order` are cosmetic. A wrong key renders «Не передан аргумент». The
callee must already exist (a stub with a trivial body is enough), and callees are pasted before callers.

### 0S.7 Reading and writing data

**Every value read is two hops**, and each hop is one `ExprAct`:

```text
hop 1  field      {"leftExprId":<the object>, "actId":"F-<field code>-K-DYN-S-boi_fields"}
hop 2  its value  {"leftExprId":<hop 1>,      "actId":"F-VALUE-K-DYN-R-D-S-boi_fields"}
```

- `<the object>` is a `VAR_REF` to a BO-typed variable or parameter, or `THIS_PROCESS` in a process.
- The field actId is built **from the field code alone** (`Argument` → `F-Argument-K-DYN-S-boi_fields`),
  so the same code in another BO gives the same actId. Case must match the BO exactly.
- **Without hop 2 you get a reference, not a value** — it compares as if dereferenced but concatenates as
  garbage. Rule: every read ends with `F-VALUE-K-DYN-R-D-S-boi_fields`.
- **A multilingual field (`INPUT_TEXT_LANG`) takes a third hop**: `F-RUS-K-DYN-S-TextLang` (IDE
  `#На русском#`). The system `label` of every dictionary row is multilingual — `label` → `VALUE` → `RUS`.
  Plain text fields (`code`, `name`, `description`) do NOT take that hop.
- **Writing a field** = `BlockAssign` whose `leftExprId` is the **hop-2 act** of that field.
- **Writing ONE language of a multilingual field** (`INPUT_TEXT_LANG`, `TEXTAREA_LANG`, `STATIC_TEXT`) `[C]`:
  `~Поле~.#Значение на языке(Язык.RUS) = #текст#` — `F-VALUE_IN_LANG-K-DYN-R-D-S-boi_fields` on the FIELD
  reference (hop 1), arg `language` = Enum const `MybpmLang` `RUS`. **Assigning to the hop-3 getter
  (`~Поле~.#Значение.Значение на языке Русский = …`) compiles and does nothing** — it changes a copy of the
  value, the field stays as it was. The hop-3 chain is for reading only.
- **Clearing a field has no confirmed form** `[U]`: no empty constant of a date, a number or an option is
  known to empty a field. Do not invent one (`constType:"Date"` without `value` is a guess, not the IDE's
  `<пусто>`). Write the rest of the script, leave the clearing out, and tell the user it must be done by
  hand or confirmed on the stand.
- **A link-many field** read through both hops is a collection: put it in `srcExprId` of a
  `BlockForeach`. Add to it with `F-ADD-K-DYN-R-D-S-boi_fields` (`argExprIds:{"adding":<expr>}`), count
  with `F-COUNT-K-DYN-R-D-S-boi_fields`, create a new instance with
  `F-CI-K-DYN-R-C-S-bo_fields` applied to a `BoRefCode` constant.
- **A nested table** (`type:"BO"`, TABLE) is such a collection `[C]`: `BlockForeach` over
  `ЭТА ИНСТАНЦИЯ.<table>.#Значение` gives one child record per pass, and its fields are read with the same
  two hops on the loop variable (`VAR_REF(<foreach>)` → `F-<child field>-K-DYN-S-boi_fields` → VALUE).
  `F-COUNT-K-DYN-R-D-S-boi_fields` applied to the field REFERENCE (hop 1, no VALUE) gives the row count,
  usable as a counted loop's `srcExprId`. **Row order is not a contract** — to walk rows by a number
  column, do a selection pass: `ЦИКЛ COUNT раз { лучший = 10⁹; foreach строка: ЕСЛИ номер > пред И номер
  < лучший → лучший = номер …; ЕСЛИ лучший < 10⁹ → пред = лучший; обработать }` (only `More`/`Less`/`And`,
  rule 1). A whole number read from `INPUT_NUMBER` concatenated as `1`, not `1.000`.
- **`.#Значения как в реестре`** (`F-VALUE_FROM_LIST-K-DYN-R-D-S-boi_fields`, on the field reference instead
  of `.#Значение`) `[C]`: the same `Bo/BoiRefCode[]` of the records held in the field, but **sorted the way
  the target BO's registry sorts** (registry sorted by X descending → the array is too) and **without draft
  records** (not yet saved). `.#Значение` guarantees no order and may include drafts. To walk rows in a
  stable order, sort the registry by the wanted column and use `#Значения как в реестре` instead of the
  selection pass above; to skip a just-created unsaved child, use it as well. (`findByFilter` returns no
  drafts either — §12a «Searching records».)
- **The view of a `BO` field decides its script type** `[C]`: `TABLE` and `MULTIPLE` read the same —
  `.#Значение` is `Bo/BoiRefCode[]`, so foreach, `F-COUNT`, `F-ADD` work identically on both. **`SINGLE` is
  NOT an array**: `.#Значение` is ONE record (`Bo/BoiRefCode`), its field reference offers the child's
  fields directly (`ЭТА ИНСТАНЦИЯ.<single>.Kod.#Значение` = `….<single>.#Значение.Kod.#Значение`), `F-COUNT`
  (0/1) and `F-HAS_REF`, but **no `F-ADD` / `F-DELETE`** — `F-ADD` on it fails `translate-script` with
  `exprAct__noDefinitionForActId`. Put a record into it by assignment: `ЭТА ИНСТАНЦИЯ.<single>.#Значение =
  #запись#` (replaces the link). A foreach over a SINGLE's `.#Значение` compiles and makes one pass. So a
  script written for a MULTIPLE field stops compiling when the field is switched to SINGLE only where it
  uses `F-ADD`/`F-DELETE`.
- **A composite (`CO`) field** `[C]`: `.#Значение` is an array of records of the COMPOSITE
  (`Bo/BoiRefCode[]`, `boCode` = the composite's code) holding rows of every source BO; its field reference
  offers `F-ADD`, `F-DELETE`, `F-COUNT`, `F-FIRST`, `F-LAST`. **An element's fields are the composite's
  ATTRIBUTES, with a different actId**: `CO_CODE-<composite code>-F-<attribute code>-K-DYN-S-boi_fields`, then
  `F-VALUE-K-DYN-R-D-S-boi_fields` as usual — the plain `F-<code>-K-DYN-S-boi_fields` does not exist on a CO
  element. An attribute that a row's source BO does not feed reads `''` (no error); assigning it does
  nothing for that row. `F-ADD` takes a record of any source BO (a child-BO record created by `F-CI` was
  added and stored as `<source BO id>-<boiId>`); `#Сохранить` is offered on an element.
- **Writing a child's field** (`#строка#.Имя.#Значение = …` inside a foreach, `<single>.Число.#Значение =
  …`, a CO attribute) `[C]`: the write goes into the parent's form session and **reaches the child record
  only when the parent is SAVED** — on `remove-draft` (ОТМЕНИТЬ) it is lost, with no `#Сохранить` needed for
  the save case. **`#Сохранить` (`F-saveBoiChanges-K-FIX-T-BoiRefCode`) applied to the child record — a
  `BlockAssign` with that act as `leftExprId` and no `rightExprId` — stores the child at once, even if the
  parent form is then cancelled.** A CO attribute written on an element writes the source record's field
  that feeds it. A record made by `F-CI` and filled in the same script was stored with its fields when the
  parent was saved (no `#Сохранить`).
- **In a business process the writes are stored when the step ends** `[C]`: a Script / Switch figure's
  changes (to `ЭТОТ_ПРОЦЕСС`, to records it reaches, to records made by `F-CI`) are saved when the script
  leaves the figure — the exit block / the figure's outgoing arrow. No card session, no `#Сохранить` needed.
  (In a FORM hook, by contrast, they wait for the card's save — above and §15.)
- **On a test (`DEV`) record the script sees only test records in its link fields** `[C]`: a DEV parent
  whose links point at ordinary records reads every `BO`/`CO` collection as empty (`F-COUNT` = 0, foreach
  makes no pass); a DEV child in the same field is seen. Test a script on DEV only with DEV children, or
  promote the version to work and test on an ordinary record (§15).
- **Reading a dictionary at run time**: `F-findByFilter-K-FIX-T-BoRefCode` applied to a `BoRefCode`
  constant returns the rows — loop over them and compare a field (`code` matching is case-sensitive).

### 0S.8 The `actId` catalogue — use these, invent nothing

```text
String  (leftExprId must be a text value)
  #Длина          F-length-K-FIX-T-String
  #Пусто?         F-isEmpty-K-FIX-T-String
  #Подстрока      F-substring-K-FIX-T-String                      args: startIndex, endIndex  (0-based, end exclusive)
  #Заменить       F-replaceByTemplate-K-FIX-T-String              args: target, replacement, needReplaceAll  (LITERAL, not regex)
  #Регулярка?     F-doesItMatchARegularExpression-K-FIX-T-String   arg: regExp  (java.util.regex; anchor ^…$)
  #В число        F-convertToBigDecimal-K-FIX-T-String
Number  (leftExprId must be a number value)
  #Взять целую часть      F-intPart-K-FIX-T-BigDecimal
  #Взять дробную часть    F-fractionPart-K-FIX-T-BigDecimal
  #Модуль                 F-abs-K-FIX-T-BigDecimal
  #Округлить до целого    F-round-K-FIX-T-BigDecimal
  #Округлять дробную…     F-roundFractionPart-K-FIX-T-BigDecimal   arg: value   (= setScale(N))
  #не чётное ли?          F-isOdd-K-FIX-T-BigDecimal
Fields and collections
  <поле>          F-<field code>-K-DYN-S-boi_fields
  #Значение       F-VALUE-K-DYN-R-D-S-boi_fields
  #На русском#    F-RUS-K-DYN-S-TextLang
  добавить        F-ADD-K-DYN-R-D-S-boi_fields          arg: adding
  количество      F-COUNT-K-DYN-R-D-S-boi_fields
  создать         F-CI-K-DYN-R-C-S-bo_fields
  #Сохранить      F-saveBoiChanges-K-FIX-T-BoiRefCode   (on a record: stores it at once)
  CO attribute    CO_CODE-<composite code>-F-<attribute code>-K-DYN-S-boi_fields   (field of a CO element)
  НайтиПоФильтру  F-findByFilter-K-FIX-T-BoRefCode
```

This is the core. **The complete catalogue — 30 text actions (case folding, trim, contains,
last index, cut, JSON, Base64 …), dates with units and patterns, filters, JSON, REST, e-mail, files,
spreadsheets, field meta-attributes and validation errors — is §12a.** An `actId` from §12a compiles;
one that is in neither place does not exist. There is still no `indexOf` (only
`F-returnLastIndex-K-FIX-T-String`), no `ceil`, no «strip trailing zeros».

### 0S.9 Thirteen rules — each of these has silently broken a real script

1. **Never compare numbers with `Eq`/`NotEq`.** They are `BigDecimal.equals` — scale-sensitive, so
   `4/2 = 2` is **false**. Equality = «не меньше и не больше»; a zero guard likewise (`Eq 0` does not catch `0.5−0.5`). `Less`/`More` are safe.
2. **Never test a boolean with `Eq`.** Put the boolean expression straight into `ifExprId` and use the
   plain «ИНАЧЕ» for its complement. `translate-script`
   says why `[C]`: an act's result is a primitive `boolean`, a «Да/Нет» constant a `Boolean`, and
   `Eq` between them gives `WARN exprOp__equalsDifferentTypes` «Сравниваются значения разных типов: слева
   boolean, справа Boolean - эти значения одинаковыми быть не могут никогда» — with `success:true`, so a
   warning-only result is NOT a clean script. For «= Нет» use `Not` (unary, `leftExprId` only).
3. **Exactly one `FROM_METHOD` per method, at the end.** An early exit from inside an `ЕСЛИ` branch is the
   other suspect of the same defect.
4. **The first block of a body that uses a TEXT parameter must be `Пусть #x# = '' ⊕ <параметр>`.** A body
   paste has no parameter declarations, so the IDE assumes every parameter is a **number**; a bare
   parameter reference types a variable numeric and **string assignments into it vanish without
   an error**. The `'' Concat` gives it the String type. (Passing a parameter directly as an argument of a
   String action is safe.) **A BO-typed parameter has no such trick**: a body that reads the fields of a
   `Bo` parameter does not go through the clipboard — write it through the stand API (`MYBPM-UI-API.md` §5g, the hat is
   sent with it) or inside a structure archive (§5d, the importer keeps the hat and its parameter ids), and
   tell the user so instead of handing over a clipboard file.
5. **No chained comparison.** `a > b > c` parses as `(a > b) > c`. Use `And` or nested `ЕСЛИ`.
6. **Every expression referenced exactly once** (0S.6) — a shared subtree is a DAG and the IDE rejects it.
7. **Variable names unique within a scope**, loop element names included: no name may be declared again
   where a variable of that name is visible. The IDE checks exactly this, so two copies of one module
   (0S.2a) in two separate `ЕСЛИ` branches may declare the same inner names.
8. **`#Подстрока` with `start >= end` returns the WHOLE string**, not `""`. Always guard:
   `ЕСЛИ конец > начало : x = #Подстрока(…) ИНАЧЕ : x = ""`.
9. **`#Заменить` is literal**; a regex handed to it is matched as text. A *broken* regex in `#Регулярка?`
   returns `Нет` instead of erroring — a wrong pattern looks like «never matches». Inside `[…]` escape
   punctuation (a bare `-` makes a range) but **never backslash a letter** (`\o` is an error, `\d` is a
   digit class): word alternatives go into `^(?:or|and)$`.
10. **Number→text is `BigDecimal.toString()`**: the scale survives (`3.000000000000`) and `0/100` prints
    as `0E-30`. Anything parsing numbers out of text must accept an exponent.
11. **No `while`**: a bounded loop is `ЦИКЛ i : "200"` plus `ВЫЙТИ ИЗ ЦИКЛА` on the exit condition.
    Bind the bound to a value that cannot change inside the loop.
12. **Paste callees before callers.** A call emitted while the callee did not exist keeps a synthetic
    parameter id and must be re-pasted afterwards — the IDE's «не определён тип» warning hides it.
13. **Enum-typed keys take only listed values.** `opType`, `exitType`, `exprValueType`, `constType`,
    `type`: a value the server does not know is stored anyway and makes every script of the BO
    unreadable, irreparably through the API (§17 trap 26). Wrong `actId`s and argument names are safe —
    `translate-script` reports them.

### 0S.10 Worked example — a whole file

Method `describe(step: Model_step, formula: Текст) : Текст`, with the parameter ids of the method
(`KJC71su~DqnMxD7z` = `step`, `0du0wJobopgISW6H` = `formula`):

```text
Пусть #текст#   = '' ⊕ formula                 ← rule 4: pins the String type
Пусть #код#     = step.code.#Значение          ← two hops
Пусть #ответ#   = ''
Пусть #счётчик# = 0                            ← the header ends here (0S.2a)
ЕСЛИ #текст#.#Пусто?#          : #ответ# = 'пусто'
ИНАЧЕ ЕСЛИ #текст#.#Регулярка?#('^[0-9]+$') : #ответ# = 'число'
ИНАЧЕ                          : #ответ# = 'формула'
ЦИКЛ i : 3
    #счётчик# = #счётчик# + 1
    ЕСЛИ #счётчик# > 2 : ВЫЙТИ ИЗ ЦИКЛА
ВЕРНУТЬ #код# ⊕ ':' ⊕ #ответ#
```

The ids below are readable on purpose (`id0001…`); any 16-character strings from the 0S.4 alphabet do.

```json
{"copiedType":"SCRIPT_BLOCKS","mouseX":202,"mouseY":62,
 "startBlockIds":["id00480000000000"],
 "blocks":{
  "id00480000000000":{"x":55,"y":44,"methodName":"describe","params":{"KJC71su~DqnMxD7z":{"name":"step","order":1,"type":{"baseType":"BoiRefCode","boCode":"Model_step","isArray":false,"type":"Bo"}},"0du0wJobopgISW6H":{"name":"formula","order":2,"type":{"baseType":"String","isArray":false,"type":"Text"}}},"returnType":{"baseType":"String","isArray":false,"type":"Text"},"downBlockId":"id00040000000000","type":"BlockFixMethod"},
  "id00040000000000":{"varName":"#текст#","valueExprId":"id00030000000000","downBlockId":"id00080000000000","type":"BlockNewVar"},
  "id00080000000000":{"varName":"#код#","valueExprId":"id00070000000000","downBlockId":"id00100000000000","type":"BlockNewVar"},
  "id00100000000000":{"varName":"#ответ#","valueExprId":"id00090000000000","downBlockId":"id00290000000000","type":"BlockNewVar"},
  "id00270000000000":{"ifExprId":"id00210000000000","thenBlockId":"id00130000000000","branches":{"id00220000000000":{"blockId":"id00160000000000","order":10,"exprId":"id00250000000000","hasExpr":true},"id00260000000000":{"blockId":"id00190000000000","order":20}},"downBlockId":"id00300000000000","type":"BlockIf"},
  "id00130000000000":{"leftExprId":"id00110000000000","rightExprId":"id00120000000000","type":"BlockAssign"},
  "id00160000000000":{"leftExprId":"id00140000000000","rightExprId":"id00150000000000","type":"BlockAssign"},
  "id00190000000000":{"leftExprId":"id00170000000000","rightExprId":"id00180000000000","type":"BlockAssign"},
  "id00290000000000":{"varName":"#счётчик#","valueExprId":"id00280000000000","downBlockId":"id00270000000000","type":"BlockNewVar"},
  "id00300000000000":{"elementVarName":"i","srcExprId":"id00410000000000","bodyBlockId":"id00400000000000","downBlockId":"id00470000000000","type":"BlockForeach"},
  "id00400000000000":{"leftExprId":"id00360000000000","rightExprId":"id00390000000000","downBlockId":"id00350000000000","type":"BlockAssign"},
  "id00350000000000":{"ifExprId":"id00340000000000","thenBlockId":"id00310000000000","type":"BlockIf"},
  "id00310000000000":{"exitType":"FROM_CIRCLE","circleBlockId":"id00300000000000","type":"BlockExit"},
  "id00470000000000":{"exitType":"FROM_METHOD","returnExprId":"id00460000000000","type":"BlockExit"}},
 "expressions":{
  "id00010000000000":{"exprValueType":"CONST","valueType":{"baseType":"String","type":"Text"},"constType":"String","value":"","type":"ExprValue"},
  "id00020000000000":{"exprValueType":"VAR_REF","varBlockId":"0du0wJobopgISW6H","type":"ExprValue"},
  "id00030000000000":{"opType":"Concat","leftExprId":"id00010000000000","rightExprId":"id00020000000000","type":"ExprOp"},
  "id00050000000000":{"exprValueType":"VAR_REF","varBlockId":"KJC71su~DqnMxD7z","type":"ExprValue"},
  "id00060000000000":{"leftExprId":"id00050000000000","actId":"F-code-K-DYN-S-boi_fields","type":"ExprAct"},
  "id00070000000000":{"leftExprId":"id00060000000000","actId":"F-VALUE-K-DYN-R-D-S-boi_fields","type":"ExprAct"},
  "id00090000000000":{"exprValueType":"CONST","valueType":{"baseType":"String","type":"Text"},"constType":"String","value":"","type":"ExprValue"},
  "id00110000000000":{"exprValueType":"VAR_REF","varBlockId":"id00100000000000","type":"ExprValue"},
  "id00120000000000":{"exprValueType":"CONST","valueType":{"baseType":"String","type":"Text"},"constType":"String","value":"пусто","type":"ExprValue"},
  "id00140000000000":{"exprValueType":"VAR_REF","varBlockId":"id00100000000000","type":"ExprValue"},
  "id00150000000000":{"exprValueType":"CONST","valueType":{"baseType":"String","type":"Text"},"constType":"String","value":"число","type":"ExprValue"},
  "id00170000000000":{"exprValueType":"VAR_REF","varBlockId":"id00100000000000","type":"ExprValue"},
  "id00180000000000":{"exprValueType":"CONST","valueType":{"baseType":"String","type":"Text"},"constType":"String","value":"формула","type":"ExprValue"},
  "id00200000000000":{"exprValueType":"VAR_REF","varBlockId":"id00040000000000","type":"ExprValue"},
  "id00210000000000":{"leftExprId":"id00200000000000","actId":"F-isEmpty-K-FIX-T-String","type":"ExprAct"},
  "id00230000000000":{"exprValueType":"VAR_REF","varBlockId":"id00040000000000","type":"ExprValue"},
  "id00240000000000":{"exprValueType":"CONST","valueType":{"baseType":"String","type":"Text"},"constType":"String","value":"^[0-9]+$","type":"ExprValue"},
  "id00250000000000":{"leftExprId":"id00230000000000","actId":"F-doesItMatchARegularExpression-K-FIX-T-String","argExprIds":{"regExp":"id00240000000000"},"type":"ExprAct"},
  "id00280000000000":{"exprValueType":"CONST","valueType":{"baseType":"BigDecimal","type":"Number"},"constType":"BigDecimal","value":"0","type":"ExprValue"},
  "id00320000000000":{"exprValueType":"VAR_REF","varBlockId":"id00290000000000","type":"ExprValue"},
  "id00330000000000":{"exprValueType":"CONST","valueType":{"baseType":"BigDecimal","type":"Number"},"constType":"BigDecimal","value":"2","type":"ExprValue"},
  "id00340000000000":{"opType":"More","leftExprId":"id00320000000000","rightExprId":"id00330000000000","type":"ExprOp"},
  "id00360000000000":{"exprValueType":"VAR_REF","varBlockId":"id00290000000000","type":"ExprValue"},
  "id00370000000000":{"exprValueType":"VAR_REF","varBlockId":"id00290000000000","type":"ExprValue"},
  "id00380000000000":{"exprValueType":"CONST","valueType":{"baseType":"BigDecimal","type":"Number"},"constType":"BigDecimal","value":"1","type":"ExprValue"},
  "id00390000000000":{"opType":"Plus","leftExprId":"id00370000000000","rightExprId":"id00380000000000","type":"ExprOp"},
  "id00410000000000":{"exprValueType":"CONST","valueType":{"baseType":"BigDecimal","type":"Number"},"constType":"BigDecimal","value":"3","type":"ExprValue"},
  "id00420000000000":{"exprValueType":"VAR_REF","varBlockId":"id00080000000000","type":"ExprValue"},
  "id00430000000000":{"exprValueType":"CONST","valueType":{"baseType":"String","type":"Text"},"constType":"String","value":":","type":"ExprValue"},
  "id00440000000000":{"exprValueType":"VAR_REF","varBlockId":"id00100000000000","type":"ExprValue"},
  "id00460000000000":{"opType":"Concat","leftExprId":"id00420000000000","rightExprId":"id00430000000000","more":{"id00450000000000":{"opType":"Concat","order":10,"exprId":"id00440000000000"}},"type":"ExprOp"}}}
```

14 blocks, 31 expressions. Note what the example does NOT do: no `Eq` between numbers, one `FROM_METHOD`,
no reused expression id, a `'' ⊕ параметр` first block, and the `ИНАЧЕ` branch carries neither `exprId`
nor `hasExpr`. And what it does by the 0S.2a house style: every variable is declared in the header before
the first statement that uses one, the counter `i` is bare, the parameters are English snake_case.

This body, written into an empty method `describe` through the stand API (`MYBPM-UI-API.md` §5g), translates clean and runs `[C]`. The
parameter ids can be shipped in the method hat of the archive (the importer keeps them, §5d).

### 0S.11 Self-check before shipping

Run all of it — the IDE will not tell you about any of these:

1. **Walk from `startBlockIds`** following `downBlockId` / `thenBlockId` / `bodyBlockId` /
   `branches[*].blockId`: every block must be reached **exactly once**, and every block in the map must be
   reached. An unreachable block is a bug in your chaining.
2. **No dangling ids**: every `*ExprId`, `exprId`, `argExprIds` value, `blockId`, `circleBlockId` must
   exist in the right map. `actId`, `targetArrowId`, `boiId` and parameter ids are external — skip them.
3. **Every expression referenced exactly once**; none referenced zero times (an orphan means you edited a
   subtree and left the old one behind).
4. **Scope**: every `VAR_REF.varBlockId` is either a parameter id of the hat or a `BlockNewVar` /
   `BlockForeach` that is an ancestor-or-earlier statement on the path to the use. On a **stripped body**
   this check must report exactly the method's parameter ids as out of scope and nothing else.
5. **Unique names**: no `varName` / `elementVarName` declared again where a variable of that name is
   still in scope (rule 7).
6. **Ids are 16 characters** — `branches` and `more` keys too.
7. Rules 1–6 are mechanical — encode them once in a checker of your own and run it on every file
   before you deliver it (§14 «Tooling that already exists» lists the checkers already written for one project; ask the user
   whether that project's folder is at hand before writing a new one).
8. **House style** (0S.2a): every name carries its decoration, `#…#` is all lower case, an inner twin of an
   outer variable ends in `*`, a boolean ends in `?`, counters are bare, the header precedes the logic, a module's `ЕСЛИ` holds nothing but `|…|`
   and has no other branch, no `ЭТА ИНСТАНЦИЯ` inside a module, every copy of a module is byte-identical.
9. **Pure ASCII** (0S.3): not one character outside ASCII is left in the file — Cyrillic, `«»`, `—`, `№` are all
   `\uXXXX` escapes.

### 0S.12 Delivering the file

1. **Body paste** (the normal case — the method already exists; NOT for a body that reads the fields of a
   `Bo` parameter, rule 4 of 0S.9 → item 7): remove the `BlockFixMethod` entry, point
   `startBlockIds` at its `downBlockId`, and copy the hat's `x`/`y` onto that block. A project hat-stripper
   («Tooling that already exists») does exactly this. The stripped body must have exactly one block fewer than the file you built.
2. **Clipboard**: `wl-copy --type text/plain < file.json`. A bare `wl-copy < file.json` advertises
   `application/json` and **the paste is silently ignored**. Verify with `wl-paste -n | md5sum` against the
   file. `wl-copy` daemonises: never end a piped script with it, or the caller hangs.
3. **Order**: paste every method (callees first), and only then copy the process script — **an entry point
   sitting in the clipboard blocks method pastes**. Copy nothing after it.
4. **Tell the user precisely**: which method to open, that the body must be cleared first, and that they
   right-click the canvas and pick «Вставить» in the context menu `[C]` (Ctrl+V is `[U]`). Then ask them to
   **copy the result back** (`wl-paste -n > live.json`).
5. **Compare the copy with what you sent**: block and expression counts first (the copy of a whole method
   = your body + 1 for the hat, plus one `BlockNewVar` per «Переменная №N» carrier the IDE may insert),
   then an id-free structural diff (the project's canonical comparer) — **every id is regenerated on paste**, so
   a key-by-key diff is worthless. Serialization noise to ignore: `canWriteValue:false`,
   `isTextMultiline:false`, `latitude/longitude:0`, `methodArgs:{}`, `more:{}`, `branches:{}`,
   `useArgNames:false`, the long `valueType` form with its nulls, and a lost `value` key on an empty
   string.
6. **Patching an existing script**: read the user's fresh copy, modify it, send it back — **never re-paste
   a whole script "just in case"**: it silently reverts every edit the user made in the IDE since your
   dump, and locate anchors by SHAPE (`varName`, branch structure), never by id.
7. **Without the clipboard** — writing the file straight into the stand through its API (`paste` +
   `apply-update-cmd`, a method body that reads its parameters, the `undo` trap, wiring a hook, creating a
   method, a process figure's script, versions) is a stand operation: `MYBPM-UI-API.md` §5g.

---

## 9. Script JSON envelope

- A copied/pasted fragment is JSON with `copiedType: "SCRIPT_BLOCKS"`, roots in `startBlockIds`, plus a
  `blocks` map and an `expressions` map, both keyed by id. Several roots in one fragment are syntactically
  possible; a multi-method paste was never tested `[U]`.
- Ids are 16 characters of letters, digits, `@` and `~` (`zngRL2KpAU1YQ4tn`, `CnTkEwA@Ybn4tOeF`,
  `9qzhdpJfhU~cu4Uj`). `[C]`
- **External references are not part of the fragment**: `actId`, `targetArrowId`, `boiId` point outside the
  JSON — a dangling-reference checker must skip them.
- **A copied fragment gets fresh block and expression ids** on every copy, so its ids match nothing in an
  export. To tell which script of an archive it came from, compare the act codes (`F-…-K-…` names in
  `ExprAct`), variable names and constant texts with each `ScriptDefStructDto`. Nothing in common = the
  fragment is from another process, or from a version on the stand that differs from the export (an export
  is a snapshot); say that, and keep what the archive proves (§5c «Check what the person says»). `[I]`
- A process script is the same shape plus `startBlockIds` holding entry points and other top-level keys a
  block patch must not touch. Size reference: 684 blocks / 1726 expressions ≈ 554 KB.
- **The same two maps ride inside a structure archive** as `ScriptDefStructDto.blocks` / `.expressions`,
  with `"@class": "…bo.process.block.BlockNewVarStruct"` in place of `"type": "BlockNewVar"` and no
  envelope at all — §5d, which is also how to read a live script off a stand without the IDE. `[C]`

## 10. Blocks

Sequencing: blocks chain through `downBlockId` (the tail has none); appending = set the old tail's
`downBlockId`. A branch or loop body is a chain started by `thenBlockId` / `bodyBlockId` / a branch's
`blockId`; its last block has no `downBlockId` and execution continues at the parent's `downBlockId`. `[C]`

- `BlockFixMethod {x, y, methodName, params, downBlockId}` — the method **hat**. A method copied out of the
  IDE includes it (block count = body + 1). **Hats never paste** → §14.
- `BlockFixEntryPoint {x, y, downBlockId}` — the «ТОЧКА ВХОДА» hat of a **process** script (§16).
- `BlockNewVar {varName, valueExprId, downBlockId}` — «Пусть»; also what the IDE's parameter carriers
  `Переменная №N := …` are. `varName` is a free string: the naming convention (`~Ссылка~`, `#значение#`,
  `%Имя БО%`, `[…]` / `<…>`, `|модуль|` — §0S.2a) is literally part of the name, not an encoding.
  `valueExprId` may point to an empty CONST (a `Bool` without `value`, a `BoiRefCode` without `boiId`)
  — that is how a header declares a variable without a value (§0S.6).
- `BlockAssign {leftExprId, rightExprId, downBlockId}`. A writable field is assigned **through its value
  reference**: in `~Код следа~.#Значение = …` the `leftExprId` is the `.#Значение` ExprAct, not a VAR_REF.
- `BlockIf {ifExprId, thenBlockId?, downBlockId, branches}`:
  - `branches: {"<id>": {blockId, order, exprId?, hasExpr?}}`, evaluated by `order` (seen 5/10/20 with 20
    = else; a lone else at 10). A branch with `exprId` + `hasExpr:true` is «иначе если»; without a
    condition (`exprId:null, hasExpr:false`, or the keys absent — the IDE drops them) it is plain «Иначе».
  - **Plain «Иначе» exists, the IDE writes it itself, it pastes and runs.** `[C]`
  - **`thenBlockId` may be absent** (empty «То» slot) — the IDE emits it and it runs. `[C]`
  - Only ONE branch of an if/elif chain executes (§15).
- `BlockForeach {elementVarName, srcExprId, bodyBlockId, downBlockId}` — two uses: a **counted loop** over
  a number (`Цикл i : текст.#Длина`, or over a numeric CONST `2` / `"200"` — runs on the stand) and a
  **foreach over a collection** (`Цикл #параметр# : ~Параметры~.#Значение`). The counter runs `1, 2, …, n`, and
  `n` is evaluated once on entry: changing the bound variable inside the body does not change the number
  of passes `[C]`.
  - **Over an ARRAY PARAMETER of a method** (`params.<id>.type = {"baseType":"String","type":"Text","isArray":true}`)
    the loop compiles, but the Java translation declares the element as `Object` `[C]`: using it where a
    `String` is expected — assigned to a Text variable, as the left side of `#Длина` — fails phase 4 with
    `compile:compiler.err.prob.found.req` «java.lang.Object cannot be converted to java.lang.String». Wrap it
    once: `Пусть #t# = '' ⊕ #el#` (a `Concat` with an empty text) compiles, and `#t#` is a Text from then on.
    A `Bo[]` parameter (`{"baseType":"BoiRefCode","boCode":"<BO code>","type":"Bo","isArray":true}`) needs no
    wrap for field reads: `VAR_REF(<foreach>)` → `F-<field>-K-DYN-S-boi_fields` → `F-VALUE-K-DYN-R-D-S-boi_fields`
    on its element translates and runs `[C]`; assigning the element to a typed variable was not tried.
- `BlockExit {exitType, circleBlockId?, targetArrowId?}`:
  - `FROM_METHOD` — «Выйти из метода: <значение>», **carries the return value**; a body without it returns
    nothing. An early `FROM_METHOD` inside an IF branch works — the blocks after the IF did not run `[C]` (§15).
  - `FROM_CIRCLE` = break, works from inside a branch of the loop it targets `[C]`;
    `FROM_CIRCLE_ITER` = continue (targeting a non-innermost loop was never used `[U]`).
  - `FROM_METHOD_BY_ARROW` + `targetArrowId` — leaves a **process** script by a named arrow (§16).
- `F-CI` (create instance) creates the instance immediately; one never `ADD`ed to a list may stay an
  orphan `[I]`.

## 11. Expressions

### Constants and variable references (`ExprValue`)

Exact encodings:

- Text: `{"type":"ExprValue","exprValueType":"CONST","constType":"String","valueType":{"type":"Text","baseType":"String","isArray":false,"isNative":false,"isPersonBo":false,"long":false},"value":"…"}`.
  An **empty-string CONST comes back without the `value` key** — readers must treat missing as `''`.
- Number: `"constType":"BigDecimal","valueType":{"type":"Number"}` — the IDE writes this short form; the
  full form is accepted too. `[C]`
- Boolean: `"constType":"Boolean"`, `value` `"yes"` / `"no"`. Both work `[C]`. Without `value` it is the
  IDE's `<пусто>` (§0S.6); likewise a `BoiRefCode` without `boiId` is `БО/<name>.<пусто>` `[C]` (IDE copy;
  runtime `[U]`).
- Record of a BO / dictionary row: `"constType":"BoiRefCode"` with `boCode` + `boiId`, assigned as
  `~Код ошибки~.#Значение = <BoiRefCode>`. A BO **type** (left side of create-instance and of
  `findByFilter`): `"constType":"BoRefCode"`.
- SingleSelect option: `SingleSelectRefCode` (§13).
- `VAR_REF` carries `varBlockId` → the declaring `BlockNewVar` / `BlockForeach`. Resolve
  VAR_REF → `varBlockId` → `varName` to analyse a script independently of ids; cloning a subtree must
  remap `varBlockId` together with the block ids.

### Operators (`ExprOp`)

- `{opType, leftExprId, rightExprId, more?}`. Extra operands live in
  `"more":{"<id>":{"opType":"Concat","order":10,"exprId":"…"}}`, evaluated after left/right by `order`.
  **Every validator must walk `more`.**
- **Never write chained comparisons**: `a > b > c` parses as `(a > b) > c` (a Bool compared with a number).
  Use `И` or nested `Если`.
- opTypes: `Eq`, `NotEq`, `More`, `Less`, `Plus`, `Minus`,
  `Mul`, `Div` (**not** `Multiply`/`Divide`), `And`, `Concat`.
- The whole enum has 17 members (§12a): also `Or`, `Xor`, `Not` (unary), `LessEq` (⩽), `MoreEq` (⩾),
  `OrEq`, `AndNotEq` `[C]` compile AND run correctly on a record `[C]` (§12a).
- `Concat` accepts a BigDecimal on either side (`"" Concat число` = number→text; concat with `""` is a
  no-op on strings).
- Arithmetic is `ExprOp`, not calls into a directory.

### Actions (`ExprAct`)

`{leftExprId, actId, argExprIds}` — `argExprIds` is keyed by argument name; field access has none. The IDE
omits `canWriteValue`; `"canWriteValue": false` is accepted. Acts nest at least three deep.

actId suffix meaning `[I]`: `-K-FIX-T-<Type>` = a built-in method of that type; `-K-DYN-S-boi_fields` = a
dynamic field access — the access KIND for every field including system ones, **not** a tab id (so moving
a field between form tabs needs no script patch).

### Method calls (`ExprCall`)

```
"type":"ExprCall","funcName":"is_formula","useArgNames":false,
"args":{"<callee param id>":{"name":"#текст#","order":1,"exprId":"<expr>"}}
```

`name`/`order` are cosmetic (the IDE may write only `exprId`); `useArgNames` may be absent.
**`args` is keyed by the callee's PARAMETER ID** — see §14.

## 12. actIds

### String — `-K-FIX-T-String` `[C]` unless marked

```
#Регулярка?   F-doesItMatchARegularExpression-K-FIX-T-String   arg regExp (accepts a VAR_REF)
#Подстрока    F-substring-K-FIX-T-String                       args startIndex, endIndex
#Длина        F-length-K-FIX-T-String
#Пусто?       F-isEmpty-K-FIX-T-String
#Заменить     F-replaceByTemplate-K-FIX-T-String               args target, replacement, needReplaceAll
#В число      F-convertToBigDecimal-K-FIX-T-String
#Содержит     F-contains-K-FIX-T-String                        arg fragment — runs: 'abc' ∋ 'b' → Да, 'z' → Нет
```

There is **no `indexOf`** in the known String palette (not proven exhaustive).

### Number — `-K-FIX-T-BigDecimal`

Full palette: operators `≥ ≤ ≠ • > = < / - +`;
`#не чётное ли?`, `#Чётное ли?`, `#Пусто?`, `#Превратить в русскую пропись`, `#Превратить в казахскую
пропись`, `#Превратить в дату`, `#Округлять дробную часть: <N>`, `#Округлить до целого`, `#Модуль`,
`#Взять целую часть`, `#Взять дробную часть`. **No `ceil`.**

```
#Взять целую часть        F-intPart-K-FIX-T-BigDecimal
#Взять дробную часть      F-fractionPart-K-FIX-T-BigDecimal
#Модуль                   F-abs-K-FIX-T-BigDecimal
#не чётное ли?            F-isOdd-K-FIX-T-BigDecimal
#Округлить до целого      F-round-K-FIX-T-BigDecimal
#Округлять дробную часть  F-roundFractionPart-K-FIX-T-BigDecimal   arg value
```

`#Чётное ли?` = `F-isEven-K-FIX-T-BigDecimal` (§12a) — runs: `4` → Да, `3` → Нет `[C]`. Natives accept any BigDecimal.

### Field access (DYN)

- **Field**: `F-<field code>-K-DYN-S-boi_fields`, an `ExprAct` without args. Built from the FIELD CODE
  only, so two BOs with the same field codes get identical actIds, and case is preserved (`Argument` →
  `F-Argument-…`). **A field created in a BO therefore needs no id exchange with the IDE** (unlike method
  parameter ids), but the code must be EXACT — the IDE marks an absent code red. `[C]`
- **Value**: `.#Значение` = `F-VALUE-K-DYN-R-D-S-boi_fields` — the ONLY generic value accessor
  (checkbox/number/text/lists all go through it). The field act returns a **reference**, so
  **reading a value is two hops**:

  ```
  field  ExprAct{ leftExprId: VAR_REF(<object var>), actId: "F-<code>-K-DYN-S-boi_fields" }
  value  ExprAct{ leftExprId: <field>,               actId: "F-VALUE-K-DYN-R-D-S-boi_fields" }
  .RUS   ExprAct{ leftExprId: <value>,               actId: "F-RUS-K-DYN-S-TextLang" }   // multilingual only
  ```

  Without `VALUE` a variable receives a REFERENCE. Comparison seems to dereference `[I]`; **Concat does
  not** (the reference lands in the string). **Rule: every value read goes through `.#Значение`.** `[C]`
- **Multilingual (`INPUT_TEXT_LANG`) = three hops**: `.Значение на языке Русский` = `F-RUS-K-DYN-S-TextLang`
  (IDE: `#На русском#`). The system `label` of every dictionary is TextLang → `label.VALUE.RUS`. Plain
  `INPUT_TEXT`/`TEXTAREA` fields (`code`, `name`, `description`) are read WITHOUT the RUS hop. Making a
  field multilingual later means adding that hop in every script. `[C]` **Writing** one language goes the
  other way: `F-VALUE_IN_LANG-K-DYN-R-D-S-boi_fields` (`language` = `MybpmLang` `RUS`) on the field
  reference, `~Поле~.#Значение на языке(Язык.RUS) = …`; assigning to `.#Значение.Значение на языке Русский`
  is a silent no-op. `[C]`
- **Collections (link-many)**: `~Параметры~ = ~Модель заявки~.params`, iterated by `BlockForeach` over
  `<list field>.#Значение` (the list needs the VALUE hop too); the loop source may be a nested act without
  an intermediate variable. Create instance `F-CI-K-DYN-R-C-S-bo_fields` (left = `BoRefCode`),
  add `F-ADD-K-DYN-R-D-S-boi_fields` (arg `adding`), count `F-COUNT-K-DYN-R-D-S-boi_fields`.
- **Checkbox**: the value act used directly as an `Если` condition works both ways `[C]`; concatenated into a text it reads `true` / `false` (English, lower case) `[C]` (§15).
- **Process record**: `ЭТОТ_ПРОЦЕСС.F-<code>-K-DYN-S-boi_fields` (§16).

### SingleSelect («Единичный выбор»)

Not a reference to a dictionary — in a card it renders as a chip that looks like a link. Read in two hops
(`.<поле>` → `.#Значение`, no RUS) and compare against an option constant, never against text:

```json
{"actId":"F-operator_type-K-DYN-S-boi_fields"}
{"actId":"F-VALUE-K-DYN-R-D-S-boi_fields"}
{"exprValueType":"CONST","constType":"SingleSelectRefCode","boCode":"Operator",
 "fieldCode":"operator_type","optionId":"INDEX_BINARY",
 "valueType":{"type":"SingleSelect","baseType":"SingleSelectRefCode",
              "boCode":"Operator","fieldCode":"operator_type"}}
```

`boCode` = the BO owning the field; **in an archive the key is `optionCode` = the option CODE given at
creation; on the stand / clipboard it is `optionId` = the option's stand id** `[C]` (an archive `optionId` is
dropped silently and the assignment writes an empty option). An option **cannot be held in a local variable** — carry a numeric code instead `[I]`.

### Dictionary search

`<BoRefCode "Operator">.F-findByFilter-K-FIX-T-BoRefCode` (IDE: «НайтиПоФильтру») returns the rows; loop
over them and read e.g. `#оператор#.Значение.#Значение.Русский`. **Available in METHODS too**, not only in
processes `[C]`.

**Field and dictionary references are compile-time constants** `[I]`: the field actId is a literal and a
dictionary's `boCode` is a CONST inside the expression's `valueType`. Therefore reading "the field named in
a variable" needs one IF per field, and a dictionary whose code is computed at run time cannot be
enumerated (§15).

## 12a. The whole palette — read off the stand's own catalogue API `[C]`

**A lookup table, never read top to bottom:** open it only when a script needs an action, function or object
that 0S.5–0S.8 do not show, and jump to its subheading («Searching records», «Built-in objects» …).

The IDE builds every list it shows from six calls of `v2/script` (`MYBPM-UI-API.md` §5g «The catalogue
calls»). **This section is the complete language; anything not here does not exist.**

### The toolbox — what the IDE's left panel really holds `[C]`

| panel row | creates | JSON |
|---|---|---|
| ТОЧКА ВХОДА / method hat | `BlockFixEntryPoint` (hook, process) or `BlockFixMethod` (local method) | §10 |
| «Пусть переменная = ⬭» | `BlockNewVar` | §10 |
| «⬭ = ⬭» + «‹значение›» | `BlockAssign` + an empty `ExprValue` | §10 |
| «Выход» + «⬭.‹действие›» | `BlockExit` + an empty `ExprAct` | §10 |
| «‹Вызов метода›» | `ExprCall` | §11 |
| «Если ⬡ то» / «Цикл элемент :» | `BlockIf` / `BlockForeach` | §10 |
| `+` `∙` `И` `=` | `ExprOp` Plus / Mul / And / Eq — the operator is changed afterwards from the value's action list | §11 |

A **hidden «old elements» panel** exists (shown only when `load-script-meta-state` answers
`showPanelWithOldElements:true`): `BlockSetVar` (`varType` `LocalCreate`/`LocalRef`),
`BlockSetField`, `BlockObject`, `BlockReturn` (or `BlockSwitchExit` in a `SwitchCondition` script),
`ExprConst` (`valueBool`/`valueNumber`/`valueTxt`), `ExprVar`, `ExprField`, `ExprObject`, `ExprNewBoi`,
`ExprBoiFind`, `ExprCreateObject`, `BlockFunc`, `ExprFunc`. **Do not generate them**: `translate-script`
accepts a `BlockFunc` but answers `WARN used_deprecated_blocks` «…оптимизация компиляции отключена» —
the whole script then runs unoptimised. Everything they did is reachable through the modern elements.

### Every `opType` — 17, with the operators each one may be chained with in `more` `[C]`

All 17 are in `kz.greetgo.script.model.expr.enums.OpType`.

| `opType` | sign | result | may continue in `more` with |
|---|---|---|---|
| `Concat` | ◊ | Text | Concat |
| `Plus` `Minus` `Mul` `Div` | + - ∙ / | Number | Plus Minus Mul Div |
| `And` `Or` `Xor` | И ИЛИ ИЛИ-ИЛИ | Bool | And Or Xor |
| `Not` | НЕ | Bool | — (**unary: `leftExprId` only**) |
| `Less` `LessEq` `More` `MoreEq` | < ⩽ > ⩾ | Bool | Less LessEq More MoreEq |
| `Eq` | = | Bool | `OrEq` («или =»: `a = x или = y`) |
| `NotEq` | ≠ | Bool | `AndNotEq` («и ≠») |

`Or`, `Not`, `Xor`, `LessEq`, `MoreEq`, `OrEq` and `AndNotEq` all **compile** (`translate-script`
`success:true`) and **run correctly on a record** `[C]`; so do `#Содержит` and `#Чётное ли?`. In the action list of a value an operator appears as a pseudo-action
`K-OP-OP-<opType>`; that id is never written into a script — choosing it produces an `ExprOp`.

**A wrong `opType` string destroys the BO's scripts** — see §17 trap 26 before you write one by hand.

### Value kinds of `ExprValue` — the 15 entries of «выберите значение» `[C]`

`load-const-value-type-list` returns them; the key names are those `load-const-form` binds (`recordIdDotPaths`
/ `updateDotPathMap` / `textDotPath`).

| UI | `exprValueType` / `constType` | keys |
|---|---|---|
| Переменная | `VAR_REF` | `varBlockId` |
| **ЭТА ИНСТАНЦИЯ** (BO script) / ЭТОТ ПРОЦЕСС (process) | `THIS_PROCESS`, `constType:"BoiRefCode"` | — the record the script runs on |
| Текст / Число | `CONST` `String` / `BigDecimal` | `value` (a string) |
| Да/Нет | `CONST` `Boolean` | `value` `"yes"`/`"no"` |
| Дата/время | `CONST` `Date` | `value` (format not captured `[U]`) |
| Гео-координаты | `CONST` `GeoPoint` | `latitude`, `longitude`, `geoPointShowType` (`DEGREES_PARTS`/`DEGREES_MIN_SEC`) |
| Бизнес-объект (тип) / (экземпляр) | `CONST` `BoRefCode` / `BoiRefCode` | `boCode` / `boCode`+`boiId` |
| Одиночный выбор | `CONST` `SingleSelectRefCode` | `boCode`, `fieldCode`, `optionId` (stand id; in an archive `optionCode` = the code) |
| **Перечисление** | `CONST` `Enum` | **`enumBaseType`, `enumValue`**; `valueType:{type:"EnumRef",baseType:<enum>,enumNativeName:<enum>}` |
| **Встроенные объекты** | `CONST` `JavaObjectFactories` | **`objectDescriptor`** (table below); `valueType:{type:"Object",baseType:<class>}` |
| Метод скрипта | `CONST` `ScriptMethodRef` | `value` (for a timer / a confirm-form button) |
| Печатная форма | `CONST` `PrintFormRef` | `boCode`, `printFormCode` |
| Аналитика | `CONST` `ReportRefCode` | `reportCode` |

Enum literal: `{"type":"ExprValue","exprValueType":"CONST","constType":"Enum",
"valueType":{"type":"EnumRef","baseType":"DateDeltaUnit","enumNativeName":"DateDeltaUnit"},
"enumBaseType":"DateDeltaUnit","enumValue":"DAYS"}`.

### Enumerations — the 16 that exist `[C]`

| enum | values (`enumValue` → label) |
|---|---|
| `EdsSignerType` | `PHYSICAL` PHYSICAL, `LEGAL` LEGAL |
| `MybpmSignatureType` | `EDS` EDS, `OTP` OTP |
| `AlignmentVertical` | `TOP` К ВЕРХНЕМУ КРАЮ, `CENTER` ПО СЕРЕДИНЕ, `BOTTOM` К НИЖНЕМУ КРАЮ, `JUSTIFY` JUSTIFY, `DISTRIBUTED` DISTRIBUTED |
| `AlignmentHorizontal` | `GENERAL` ПО УМОЛЧАНИЮ, `LEFT` К ЛЕВОМУ КРАЮ, `CENTER` ПО ЦЕНТРУ, `RIGHT` К ПРАВОМУ КРАЮ, `FILL` ЗАПОЛНИТЬ ВСЮ ШИРИНУ, `JUSTIFY` ЗАПОЛНИТЬ ВСЮ ШИРИНУ КРОМЕ ПОСЛЕДНЕЙ, `CENTER_SELECTION` CENTER_SELECTION, `DISTRIBUTED` DISTRIBUTED |
| `DateDeltaUnit` | `MILLI_SECONDS` миллисекунды, `SECONDS` секунды, `MINUTES` минуты, `HOURS` часы, `DAYS` дни, `MONTHS` месяцы, `YEARS` годы |
| `RestRequestMethod` | `GET` GET, `POST` POST, `PUT` PUT |
| `TimePattern` | `HH_MM_COLON` ЧЧ:ММ |
| `DatePattern` | `DD_MM_YYYY_DOT` ДД.ММ.ГГГГ, `DD_MM_YY_DOT` ДД.ММ.ГГ, `DD_MM_YYYY_SLASH` ДД/ММ/ГГГГ, `DD_MM_YY_SLASH` ДД/ММ/ГГ, `DD_MM_YYYY_DASH` ДД-ММ-ГГГГ, `DD_MM_YY_DASH` ДД-ММ-ГГ, `YYYY_MM_DD_DOT` ГГГГ.ММ.ДД, `YY_MM_DD_DOT` ГГ.ММ.ДД, `YYYY_MM_DD_SLASH` ГГГГ/ММ/ДД, `YY_MM_DD_SLASH` ГГ/ММ/ДД, `YY_MM_DD_DASH` ГГГГ-ММ-ДД, `YYYY_MM_DD_DASH` ГГ-ММ-ДД |
| `ReportFilterSortType` | `ASC` По возрастанию, `DESC` По убыванию |
| `ElectronicBorderStyle` | `NONE` НЕТ ГРАНИЦЫ, `THIN` ЛИНИЯ ТОНКАЯ, `MEDIUM` ЛИНИЯ СРЕДНЕЙ ТОЛЩИНЫ, `THICK` ЛИНИЯ ТОЛСТАЯ, `HAIR` ЛИНИЯ ОЧЕНЬ ТОНКАЯ, `DASHED` ЧЁРТОЧКАМИ ТОНКИМИ, `MEDIUM_DASHED` ЧЁРТОЧКАМИ СРЕДНЕЙ ТОЛЩИНЫ, `DOTTED` ТОЧЕЧКАМИ ТОНКИМИ, `DOUBLE` ДВОЙНАЯ ЛИНИЯ, `DASH_DOT` ЧЕРТА ТОЧКА ТОНКАЯ, `MEDIUM_DASH_DOT` ЧЕРТА ТОЧКА СРЕДНЕЙ ТОЛЩИНЫ, `DASH_DOT_DOT` ЧЕРТА ТОЧКА ТОЧКА ТОНКАЯ, `MEDIUM_DASH_DOT_DOT` ЧЕРТА ТОЧКА ТОЧКА СРЕДНЕЙ ТОЛЩИНЫ, `SLANTED_DASH_DOT` НАКЛОННАЯ ЧЕРТА ТОЧКА |
| `ElectronicUnderline` | `SINGLE` ЛИНИЯ, `DOUBLE` ДВОЙНАЯ ЛИНИЯ, `NONE` НЕТ ПОДЧЁРКИВАНИЯ |
| `MybpmFileType` | `PDF` PDF, `DOC` DOC, `UNKNOWN` UNKNOWN |
| `MybpmUrlType` | `OPEN_BOI_CREATE` Открыть создание экземпляра, `OPEN_BOI_EDIT` Открыть экземпляр на изменение, `SET_NEW_PASS` Получение ссылки на установку пароля |
| `ElectronicCellType` | `TEXT` Текст, `NUMBER` Число, `DATE` Дата, `BOOL` Да/Нет, `FORMULA` Формула |
| `Color` | `RED` красный, `GREEN` зеленый, `YELLOW` желтый, `BLUE` синий, `ORANGE` оранжевый, `PURPLE` фиолетовый |
| `MybpmLang` | `RUS` RUS, `ENG` ENG, `KAZ` KAZ, `QAZ` QAZ |
`DatePattern`: two CODES are swapped **on the platform side**, the labels tell the truth `[C]` — `YY_MM_DD_DASH`
(label «ГГГГ-ММ-ДД») prints `2026-10-01`, `YYYY_MM_DD_DASH` (label «ГГ-ММ-ДД») prints `26-10-01`. The others print
what their names say (`DD_MM_YYYY_DOT` 01.10.2026, `DD_MM_YY_SLASH` 01/10/26, `YY_MM_DD_DOT` 26.10.01). For an ISO date
write `YY_MM_DD_DASH`.

**Enum arguments run** `[C]`: an `Enum` CONST in `argExprIds` works — `dateToString(pattern)`,
`convertToDate(datePattern)`, `incDate(amount, unit)` (`MONTHS` +1 → next month, `HOURS` 36 → next day+12h),
`diff`, `equals`; and an enum may be held in a variable (`Пусть #u# = HOURS`, then `unit: VAR_REF`). Semantics:
`a.diff(b, DAYS)` = **b − a** (`(d+3 дня).diff(d)` = −3); `a.equals(b, unit)` compares truncated to
the unit (d+5 h equals d by `DAYS` = Да, by `HOURS` = Нет).

### Built-in objects («Встроенные объекты») — the 22 factories `[C]`

`load-value-ext-type-for-expr` gives the type each returns; a factory is an `ExprValue` constant, so it is
written wherever a value is expected (usually `Пусть #x# = <factory>`).

| `objectDescriptor` | UI | returns |
|---|---|---|
| `BEAN_METHOD-GeoMapExtensions-geoMap` | Карта | `Object/GeoMap` |
| `BEAN_METHOD-DateExtensions-now` | Сейчас | `Date` |
| `BEAN_METHOD-MybpmSystemFactory-newMybpmSystem` | Система | `Object/MybpmSystem` |
| `BEAN_METHOD-MybpmLangFactory-getSystemDefaultLanguage` | Системный язык | `EnumRef/MybpmLang` |
| `BEAN_METHOD-ScriptEmailFactory-newScriptEmail` | Создать Email | `Object/ScriptEmail` |
| `BEAN_METHOD-JsonExtensions-createJsonArr` | Создать Json [] массив | `Object/JsonDeck[]` |
| `BEAN_METHOD-JsonExtensions-createJsonDeck` | Создать Json {} объект | `Object/JsonDeck` |
| `BEAN_METHOD-JsonExtensions-createScriptMultipartForm` | Создать Multipart Form | `Object/ScriptMultipartForm` |
| `BEAN_METHOD-RestExtensions-createJsonDeck` | Создать Rest-запрос | `Object/RestRequest` |
| `BEAN_METHOD-ScriptSmsFactory-newScriptSms` | Создать Sms | `Object/ScriptSms` |
| `BEAN_METHOD-UuidExtension-createManagerUUID` | Создать UUID-менеджер | `Object/ManagerUUID` |
| `BEAN_METHOD-MybpmFileExtensions-createArchiveManager` | Создать Архивариус | `Object/ArchiveManager` |
| `BEAN_METHOD-MybpmSignatureFactory-newSignedField` | Создать Подписанное поле | `Object/SignedField` |
| `BEAN_METHOD-MybpmSignatureFactory-newScriptEmail` | Создать Подпись | `Object/MybpmSignature` |
| `BEAN_METHOD-XmlExtensions-createScriptXmlManager` | Создать конструктор XML/JSON | `Object/ScriptXmlManager` |
| `BEAN_METHOD-MybpmUrlFactory-create` | Создать конструктор ссылок | `Object/MybpmUrl` |
| `BEAN_METHOD-ScriptMultiLangTextFactory-newMultiLangText` | Создать мультиязычный текст | `Object/ScriptMultiLangText` |
| `BEAN_METHOD-ScriptNotificationFactory-newScriptNotification` | Создать оповещение | `Object/ScriptNotification` |
| `BEAN_METHOD-ScriptMethodTimerFactory-newScriptMethodTimer` | Создать таймер | `Object/ScriptMethodTimerPlaque` |
| `BEAN_METHOD-ConfirmFormFactory-newConfirmForm` | Создать форму подтверждения | `Object/ConfirmForm` |
| `BEAN_METHOD-ElectronicTableExtensions-newElectronicColorWrapper` | Создать цветовую палитру | `Object/ElectronicColorPalette` |
| `BEAN_METHOD-ElectronicTableExtensions-createElectronicTableBo` | Создать электронную таблицу | `Object/ElectronicTableBo` |
### Actions on the basic value types `[C]`

`argExprIds` keys are the `argId`s below; `?` marks an argument the IDE lets you leave empty. Every type
also offers the operators its row in the `opType` table allows.

**Текст `Text/String`**

```text
F-toBase64-K-FIX-T-String                            -> Base64                                () → Text/String
F-isBigDecimal-K-FIX-T-String                        #Число ли?                               () → Bool/boolean
F-killSides-K-FIX-T-String                           #Убрать по краям                         (countLeft:Number/BigDecimal?, countRight:Number/BigDecimal?) → Text/String
F-trim-K-FIX-T-String                                #Убрать все пробелы по бокам             () → Text/String
F-doesItMatchARegularExpression-K-FIX-T-String       #Соответствует ли регулярному выражению  (regExp:Text/String?) → Bool/boolean
F-contains-K-FIX-T-String                            #Содержит ли                             (fragment:Text/String?) → Bool/boolean
F-isEmpty-K-FIX-T-String                             #Пусто?                                  () → Bool/boolean
F-strToJsonDeck-K-FIX-T-String                       #Преобразовать в Json {} объект          () → Object/JsonDeck
F-strToJsonArr-K-FIX-T-String                        #Преобразовать в Json [] массив          () → Object/JsonDeck[]
F-substring-K-FIX-T-String                           #Подстрока,                              (startIndex:Number/BigDecimal?, endIndex:Number/BigDecimal?) → Text/String
F-cutRight-K-FIX-T-String                            #Отрезать справа                         (count:Number/BigDecimal) → Text/String
F-cutLeft-K-FIX-T-String                             #Отрезать слева                          (count:Number/BigDecimal) → Text/String
F-cutMiddle-K-FIX-T-String                           #Отрезать по середине                    (count:Number/BigDecimal, skipCount:Number/BigDecimal, skipLeft:Bool/Boolean) → Text/String
F-remove-K-FIX-T-String                              #Исключить из строки                     (regex:Text/String?) → Text/String
F-returnLastIndex-K-FIX-T-String                     #Индекс конца последней подстроки        (indexStr:Text/String?) → Number/BigDecimal
F-writeToFile-K-FIX-T-String                         #Записать в файл                         (fileName:Text/String) → File/MybpmFile
F-replaceByIndexes-K-FIX-T-String                    #Заменить текст по индексу               (startIndex:Number/BigDecimal?, endIndex:Number/BigDecimal?, fragment:Text/String?) → Text/String
F-replaceByTemplate-K-FIX-T-String                   #Заменить                                (target:Text/String?, replacement:Text/String?, needReplaceAll:Bool/boolean) → Text/String
F-isDefined-K-FIX-T-String                           #Есть символ(ы)?                         () → Bool/boolean
F-length-K-FIX-T-String                              #Длина                                   () → Number/BigDecimal
F-partAfter-K-FIX-T-String                           #Всё правее                              (index:Number/BigDecimal?) → Text/String
F-concat-K-FIX-T-String                              #Вставить подстроку                      (sharedString:Text/String?, index:Number/BigDecimal?) → Text/String
F-convertToBigDecimal-K-FIX-T-String                 #В число                                 () → Number/BigDecimal
F-convertToLowerCase-K-FIX-T-String                  #В нижний регистр                        () → Text/String
F-convertToDate-K-FIX-T-String                       #В дату                                  (datePattern:EnumRef/DatePattern) → Date
F-convertToUpperCase-K-FIX-T-String                  #В верхний регистр                       () → Text/String
F-contentType_to_fileExtension-K-FIX-T-String        #Content-Type конвертировать в расширение файла () → Text/String
F-textToFile-K-FIX-T-String                          #Base64 преобразовать в файл             (fileName:Text/String) → File/MybpmFile
operators: Concat NotEq Eq
```

**Число `Number/BigDecimal`**

```text
F-isOdd-K-FIX-T-BigDecimal                           #не чётное ли?                           () → Bool/boolean
F-isEven-K-FIX-T-BigDecimal                          #Чётное ли?                              () → Bool/boolean
F-isNull-K-FIX-T-BigDecimal                          #Пусто?                                  () → Bool/boolean
F-numberToWordsRU-K-FIX-T-BigDecimal                 #Превратить в русскую пропись            () → Text/String
F-numberToWordsKZ-K-FIX-T-BigDecimal                 #Превратить в казахскую пропись          () → Text/String
F-toDate-K-FIX-T-BigDecimal                          #Превратить в дату                       () → Date
F-roundFractionPart-K-FIX-T-BigDecimal               #Округлять дробную часть:                (value:Number/BigDecimal?) → Number/BigDecimal
F-round-K-FIX-T-BigDecimal                           #Округлить до целого                     () → Number/BigDecimal
F-abs-K-FIX-T-BigDecimal                             #Модуль                                  () → Number/BigDecimal
F-intPart-K-FIX-T-BigDecimal                         #Взять целую часть                       () → Number/BigDecimal
F-fractionPart-K-FIX-T-BigDecimal                    #Взять дробную часть                     () → Number/BigDecimal
operators: MoreEq LessEq NotEq Mul More Eq Less Div Minus Plus
```

**Да/Нет `Bool/Boolean`**

```text
operators: NotEq Not Xor Or And Eq
```

**Дата `Date` (DATE, FULL_DATE, TIME, YEAR, YEAR_AND_MONTH)**

```text
F-incWorkingDate-K-FIX-T-Date                        увеличить (рабочие)                      (amount:Number/BigDecimal, unit:EnumRef/DateDeltaUnit, irgUnit:Bo/BoiRefCode) → Date
F-incDate-K-FIX-T-Date                               увеличить                                (amount:Number/BigDecimal, unit:EnumRef/DateDeltaUnit) → Date
F-isEquals_GMD-K-FIX-T-Date                          сравнить (ГМД)                           (anotherDate:Date) → Bool/boolean
F-changeTime-K-FIX-T-Date                            сменить время                            (time:Date?) → Date
F-diffWorkingDate-K-FIX-T-Date                       разница (рабочие)                        (anotherDate:Date, unit:EnumRef/DateDeltaUnit) → Number/BigDecimal
F-diff-K-FIX-T-Date                                  разница                                  (anotherDate:Date, unit:EnumRef/DateDeltaUnit) → Number/BigDecimal
F-equals-K-FIX-T-Date                                равно                                    (anotherDate:Date, unit:EnumRef/DateDeltaUnit) → Bool/boolean
F-isDayOff-K-FIX-T-Date                              праздничный или выходной день            () → Bool/boolean
F-extractMonth-K-FIX-T-Date                          получить месяц (1-12)                    () → Number/BigDecimal
F-extractYear-K-FIX-T-Date                           получить год                             () → Number/BigDecimal
F-toPeriod-K-FIX-T-Date                              период                                   (to:Date?) → Object/Period
F-notEquals-K-FIX-T-Date                             не равно                                 (anotherDate:Date, unit:EnumRef/DateDeltaUnit) → Bool/boolean
F-lessEq-K-FIX-T-Date                                меньше или равно                         (anotherDate:Date, unit:EnumRef/DateDeltaUnit) → Bool/boolean
F-less-K-FIX-T-Date                                  меньше                                   (anotherDate:Date, unit:EnumRef/DateDeltaUnit) → Bool/boolean
F-extractDayOfMonth-K-FIX-T-Date                     изъять день месяца                       () → Number/BigDecimal
F-isDefined-K-FIX-T-Date                             заполнена?                               () → Bool/boolean
F-moreEq-K-FIX-T-Date                                больше или равно                         (anotherDate:Date, unit:EnumRef/DateDeltaUnit) → Bool/boolean
F-more-K-FIX-T-Date                                  больше                                   (anotherDate:Date, unit:EnumRef/DateDeltaUnit) → Bool/boolean
F-extractDayWeek-K-FIX-T-Date                        Получить день недели                     () → Number/BigDecimal
F-dateToString-K-FIX-T-Date                          Дата в строку                            (pattern:EnumRef/DatePattern) → Text/String
F-timeToString-K-FIX-T-Date                          Время в строку                           (pattern:EnumRef/TimePattern) → Text/String
operators: NotEq Eq
```

**Период `Period` (PERIOD, PERIOD_TIME)**

```text
F-diffPeriod-K-FIX-T-Period                          разница                                  (unit:EnumRef/DateDeltaUnit) → Number/BigDecimal
F-first-K-FIX-T-Period                               первая дата-время                        () → Date
F-second-K-FIX-T-Period                              вторая дата-время                        () → Date
operators: NotEq Eq
```

**Мультиязычный текст `TextLang`**

```text
F-KAZ-K-DYN-S-TextLang                               Значение на языке Қазақша                () → Text/String
F-RUS-K-DYN-S-TextLang                               Значение на языке Русский                () → Text/String
F-QAZ-K-DYN-S-TextLang                               Значение на языке Qazaqsha               () → Text/String
F-ENG-K-DYN-S-TextLang                               Значение на языке English                () → Text/String
operators: NotEq Eq
```

**Гео-точка `GeoPoint`**

```text
F-getLatitude-K-FIX-T-GeoPoint                       #широта                                  () → Number/BigDecimal
F-getLongitude-K-FIX-T-GeoPoint                      #долгота                                 () → Number/BigDecimal
operators: NotEq Eq
```

**Одиночный выбор `SingleSelect/SingleSelectRefCode` (DROPDOWN_SINGLE, RADIO_BUTTON_GROUP)**

```text
F-isEmpty-K-FIX-T-SingleSelectRefCode                пусто?                                   () → Bool/boolean
F-getBoiFieldOptionValue-K-FIX-T-SingleSelectRefCode Текст                                    () → Text/String
F-getBoiFieldOptionShown-K-FIX-T-SingleSelectRefCode Получить видимость                       (boiRefCode:Bo/BoiRefCode, boiRefCodeOrgUnit:Bo/BoiRefCode?) → Bool/boolean
F-extractBoCode-K-FIX-T-SingleSelectRefCode          Код БО                                   () → Text/String
F-replaceByLabel-K-FIX-T-SingleSelectRefCode         Заменить по тексту                       (text:Text/String) → SingleSelect/SingleSelectRefCode
F-setBoiFieldOptionShown-K-FIX-T-SingleSelectRefCode Видимость                                (boiRef:Bo/BoiRefCode, boiRefOrgUnit:Bo/BoiRefCode?, value:Bool/boolean) → —
operators: NotEq Eq
```

**Любой массив `…[]` (`-K-FIX-T-Iterable`)**

```text
F-contains-K-FIX-T-Iterable                          содержит ли                              (element:Object) → Bool/boolean
F-count-K-FIX-T-Iterable                             размер                                   () → Number/BigDecimal
F-isEmpty-K-FIX-T-Iterable                           пустой?                                  () → Bool/boolean
F-last-K-FIX-T-Iterable                              последний                                () → Object
F-first-K-FIX-T-Iterable                             первый                                   () → Object
F-add-K-FIX-T-Iterable                               добавить                                 (element:Object?) → —
F-get-K-FIX-T-Iterable                               взять                                    (index:Number/BigDecimal) → Object
operators: 
```

**`Bo/BoiRef` (ссылка без кода; из функций)**

```text
F-boiRef_to_boiRefCode-K-FIX-T-BoiRef                #С кодом                                 () → Bo/BoiRefCode
F-boiRef_to_boCode-K-FIX-T-BoiRef                    #Дай код БО                              () → Text/String
F-boiRef_to_boiId-K-FIX-T-BoiRef                     #Дай идентификатор инстанции БО          () → Text/String
F-boiRef_to_boId-K-FIX-T-BoiRef                      #Дай идентификатор БО                    () → Text/String
operators: NotEq Eq
```

**`BoField/BoiFieldRef`**

```text
F-boiFieldRef_to_BoiFieldRefCode-K-FIX-T-BoiFieldRef #С кодом                                 () → BoField/BoiFieldRefCode
F-boiFieldRef_to_fieldCode-K-FIX-T-BoiFieldRef       #Дай код поля БО                         () → Text/String
F-boiFieldRef_to_boCode-K-FIX-T-BoiFieldRef          #Дай код БО                              () → Text/String
F-boiFieldRef_to_fieldId-K-FIX-T-BoiFieldRef         #Дай идентификатор поля БО               () → Text/String
F-boiFieldRef_to_boiId-K-FIX-T-BoiFieldRef           #Дай идентификатор инстанции БО          () → Text/String
F-boiFieldRef_to_boId-K-FIX-T-BoiFieldRef            #Дай идентификатор БО                    () → Text/String
operators: NotEq Eq
```

**Подпись `Object/MybpmSignature`**

```text
F-type-K-FIX-T-MybpmSignature                        Тип подписи (MybpmSignatureType)         () → EnumRef/MybpmSignatureType
F-extendedKeyUsages-K-FIX-T-MybpmSignature           Список кодов использования сертификата   () → Text/String[]
F-serialNumber-K-FIX-T-MybpmSignature                Серийный номер сертификата               () → Text/String
F-mail-K-FIX-T-MybpmSignature                        Почта получателя сертификата             () → Text/String
F-fullName-K-FIX-T-MybpmSignature                    Полное имя                               () → Text/String
F-signedFields-K-FIX-T-MybpmSignature                Подписанные поля                         () → Object/SignedField[]
F-signedFiles-K-FIX-T-MybpmSignature                 Подписанные документы                    () → File/MybpmFile[]
F-getPersonBoiRefCode-K-FIX-T-MybpmSignature         Подписавший пользователь                 () → Bo/BoiRefCode
F-phoneNumber-K-FIX-T-MybpmSignature                 Номер телефона                           () → Text/String
F-organizationName-K-FIX-T-MybpmSignature            Наименование организации и форма         () → Text/String
F-edsSignerType-K-FIX-T-MybpmSignature               Категория подписи (EdsSignerType)        () → EnumRef/EdsSignerType
F-iin-K-FIX-T-MybpmSignature                         ИИН из сертификата                       () → Text/String
F-signedAt-K-FIX-T-MybpmSignature                    Дата подписи                             () → Date
F-certificateEndDate-K-FIX-T-MybpmSignature          Дата окончания сертификата               () → Date
F-certificateStartDate-K-FIX-T-MybpmSignature        Дата начала сертификата                  () → Date
F-organizationBin-K-FIX-T-MybpmSignature             БИН организации из сертификата           () → Text/String
F-removeMybpmSignature-K-FIX-T-MybpmSignature        #удалить                                 () → —
operators: NotEq Eq
```
### A field of a record — `<record>.<field>` returns `Bo/BoiFieldRefCode` `[C]`

Every field reference offers:

```text
F-VALUE-K-DYN-R-D-S-boi_fields                    #Значение                  → the value type (table below)
F-Readonly-K-DYN-R-M-S-boi_fields                 #Только для чтения (orgUnit?) → Bool   — ASSIGNABLE: `поле.#Только для чтения = Да`
F-Required-K-DYN-R-M-S-boi_fields                 #Обязателен для заполнения (orgUnit?) → Bool — assignable
F-Shown-K-DYN-R-M-S-boi_fields                    #Видимость (orgUnit?) → Bool           — assignable
F-addError-K-FIX-T-BoiFieldRefCode                #Добавить ошибку (scriptMultiLangText:Object/ScriptMultiLangText)
F-removeError-K-FIX-T-BoiFieldRefCode             #Удалить ошибку
F-isPresent-K-FIX-T-BoiFieldRefCode               #Существует? → Bool
F-reloadDisplayValue-K-FIX-T-BoiFieldRefCode      #Обновить из базы
F-boiFieldRefCode_to_{boCode,boId,boiId,fieldCode,fieldId}-K-FIX-T-BoiFieldRefCode → Text
F-saveBoiChanges / F-closeOpenedBoi / F-updateOpenedBoi(target)  -K-FIX-T-BoiRefCode  (act on the owning record)
```

(`-K-DYN-R-M-` = a field **meta** attribute; the `-R-D-` acts are the field's **data**.) The same three
meta acts exist for widgets as `…-K-DYN-R-M-S-boi_widgets`.

**Meta assign and field errors at run time** `[C]` (field hook in the form cycle):
- `поле.#Только для чтения = Да`, `#Обязателен = Да`, `#Видимость = Нет` take effect at once and read back in the
  same script (`Да`/`Нет`). They reach the client as `fieldFormCommandsSometimes` `READONLY` / `REQUIRED` /
  `HIDE_FIELD` (`commandB`), the reverse `= Нет`/`= Да` as the same commands with `false` (+ `LOAD_FIELD` for a
  field made visible again). They are **form state, not rules**: a `save-field-value` into a field the script
  made read-only is STORED all the same, and the record saved with it — read-only is the client's job.
- `#Добавить ошибку(<ScriptMultiLangText>)` — build the text with `Создать мультиязычный текст` +
  `.Добавить(text, RUS)` (both statements = `BlockAssign` without right) — answers `SHOW_FIELD_ERROR` with the RUS
  text under the field, `ALERT_SAVE_BUTTON_NOTIFICATION` with the same text, `notValid:true`, and **blocks the
  save**: `validate-apply-remove-draft` answers no `CLOSE_DIALOG_SAVE` (the error is repeated) until a script
  runs `#Удалить ошибку` on that field — then `CAN_ENABLE_SAVE_BUTTON`, `notValid:false`, and the save goes through.
  This is the way to veto a save from a script.

| field type | `#Значение` returns | extra acts on the field reference |
|---|---|---|
| INPUT_TEXT, TEXTAREA, INPUT_PHONE, INPUT_EMAIL, LINK | Text | — |
| INPUT_NUMBER | Number | — |
| CHECKBOX | Bool | — |
| DATE, FULL_DATE, TIME, YEAR, YEAR_AND_MONTH | Date | — |
| PERIOD, PERIOD_TIME | Period | — |
| INPUT_TEXT_LANG, TEXTAREA_LANG, STATIC_TEXT | TextLang | `F-VALUE_IN_LANG-K-DYN-R-D-S-boi_fields (language:EnumRef/MybpmLang)` → Text — readable AND assignable (`поле.#Значение на языке(Язык.RUS) = …`), the only way to write one language; `.#Значение.<язык> = …` is a no-op `[C]` |
| DROPDOWN_SINGLE, RADIO_BUTTON_GROUP | SingleSelect | — |
| GEO_POINT | GeoPoint | — |
| FILE_UPLOAD | File/MybpmFile | `F-addFile_v2-K-FIX-T-BoiFieldRefCode (file)` |
| BO (view TABLE or MULTIPLE) / CO | `Bo/BoiRefCode[]` (CO: records of the composite, `boCode` = its code) | `F-ADD (adding)`, `F-DELETE (deleting)`, `F-COUNT`, `F-FIRST`, `F-LAST`, `F-VALUE_FROM_LIST` («Значения как в реестре» — the same records in the registry's sort order, drafts excluded; `#Значение` has no order and keeps drafts), all `-K-DYN-R-D-S-boi_fields`; CO also `F-SHOWN_BO_IN_CO_FIELD-K-DYN-R-M-S-boi_fields (boRefCode, orgUnit)`; a CO element reads its attributes by `CO_CODE-<composite code>-F-<attr>-K-DYN-S-boi_fields` (0S.7) `[C]` |
| BO (view SINGLE, and the natives CREATED_BY, LAST_MODIFIED_BY) | `Bo/BoiRefCode` | `F-COUNT`, `F-FIRST`, `F-LAST`, `F-VALUE_FROM_LIST`, `F-HAS_REF`, all `-K-DYN-R-D-S-boi_fields` — **no `F-ADD` / `F-DELETE`** `[C]` — **and every field of the target BO directly**: `rec.CREATED_BY.surname` is `F-surname-K-DYN-S-boi_fields` applied to the field reference, no `#Значение` hop |
| PROGRESS_BAR | — (no `#Значение`) | one act per step: `F-<field>-K-DYN-PS-<stepCode>-S-boi_fields` → `ProgressBar/ProgressStepRefCode` |
| CHECKLIST, QUESTIONNAIRE | — (**`#Значение` has no type** — not readable from a script) | — |

Other members of a record (`<record>.` on `Bo/BoiRefCode`):

- widgets `F-<widgetCode>-K-DYN-S-boi_widgets` (current user / date / day / month / year, button, iframe,
  captcha, signature) — the current-user widget behaves like a BO-link field; the signature widget adds
  `F-signFields` / `F-signDocs` / `F-signList` / `F-signCount` (`-K-DYN-S-boi_widgets`);
- tabs `F-TAB_<code>_<id>-K-DYN-S-boi_tabs` with `F-COLOR-K-DYN-R-C-S-boi_tabs (color:EnumRef/Color)`;
- the record-level actions:

```text
F-count-K-FIX-T-BoiRefCode                           размер                                   () → Number/BigDecimal
F-isEmpty-K-FIX-T-BoiRefCode                         пустой?                                  () → Bool/boolean
F-last-K-FIX-T-BoiRefCode                            последний                                () → Bo/BoiRefCode
F-first-K-FIX-T-BoiRefCode                           первый                                   () → Bo/BoiRefCode
F-getPrintForms-K-FIX-T-BoiRefCode                   Печатные формы                           () → Object/BoiPrintFormsRefCode
F-readSignatures-K-FIX-T-BoiRefCode                  #получи подписи                          () → Object/MybpmSignature[]
F-deleteBoi-K-FIX-T-BoiRefCode                       #Удалить                                 () → —
F-showFormDel-K-FIX-T-BoiRefCode                     #Убрать форму                            (for:Bo/BoiRefCode?) → —
F-setFormMetadataAccess-K-FIX-T-BoiRefCode           #Только для чтения инстанции             (for:Bo/BoiRefCode?, value:Bool/boolean) → —
F-saveBoiChanges-K-FIX-T-BoiRefCode                  #Сохранить                               () → —
F-showForm-K-FIX-T-BoiRefCode                        #Отобразить форму                        (for:Bo/BoiRefCode?) → —
F-updateOpenedBoi-K-FIX-T-BoiRefCode                 #Обновить из базы открытую инстанцию     (target:Bo/BoiRefCode) → —
F-closeOpenedBoi-K-FIX-T-BoiRefCode                  #Закрыть                                 () → —
F-duplicate-K-FIX-T-BoiRefCode                       #Дублировать                             () → Bo/BoiRefCode
F-boiRefCode_to_boCode-K-FIX-T-BoiRefCode            #Дай код БО                              () → Text/String
F-boiRefCode_to_boiId-K-FIX-T-BoiRefCode             #Дай идентификатор инстанции БО          () → Text/String
F-boiRefCode_to_boId-K-FIX-T-BoiRefCode              #Дай идентификатор БО                    () → Text/String
F-restoreBoi-K-FIX-T-BoiRefCode                      #Восстановить                            () → —
F-archiveBoi-K-FIX-T-BoiRefCode                      #Архивировать                            () → —
```
What `#Удалить`, `#Архивировать`, `#Восстановить` and `#Дублировать` do to the record at run time is not known yet
`[U]` — §18; they are palette entries, not tested runs.
The BO **type** (`BoRefCode` constant) offers `F-<field>-K-DYN-S-bo_fields` (a field of the TYPE, not of a
record → `Bo/BoFieldRefCode`), `F-findByFilter-K-FIX-T-BoRefCode (filter:Filter/AbstractFilter?)` →
`Bo/BoiRefCode[]`, and `F-CI-K-DYN-R-C-S-bo_fields` (create a record).

### Searching records — filters `[C]`

A filter is built on a field of the BO **type** and fed to `findByFilter`:

```text
<BoRefCode>.F-<field>-K-DYN-S-bo_fields                      → Bo/BoFieldRefCode
   .F-find-K-FIX-T-BoFieldRefCode (fieldValue)               → Bo/BoiRefCode[]   (also findSmall / findArchived / findRemoved)
   .F-create…Filter-K-FIX-T-BoFieldRefCode (…)               → Filter/AbstractFilter
<filter>.F-createAndFilter / F-createOrFilter (rightFilter) / F-createNotFilter  -K-FIX-T-AbstractFilter
<BoRefCode>.F-findByFilter-K-FIX-T-BoRefCode (filter)       → Bo/BoiRefCode[]
```

Which filter constructors a field offers depends on its type:

| field type | filter constructors (`F-create<X>Filter-K-FIX-T-BoFieldRefCode`) |
|---|---|
| text kinds (INPUT_TEXT, TEXTAREA, PHONE, EMAIL, LINK) | `ExactEquality (value)`, `ExactInequality (value)`, `ContainsText`, `ContainsPhraseText`, `StartsWithText`, `EndsWithText` (value:Text) |
| NUMBER, all dates, CREATED_AT … | `ExactEquality`, `ExactInequality`, `GreaterThan`, `LessThan`, `GreaterThanOrEqual`, `LessThanOrEqual` (value); `GreaterThanButLessThan`, `GreaterThanOrEqualButLessThan`, `GreaterThanButLessThanOrEqual`, `GreaterThanOrEqualButLessThanOrEqual` (from, to) |
| CHECKBOX, DROPDOWN_SINGLE, RADIO_BUTTON_GROUP, single BO link | `ExactEquality`, `ExactInequality` (value) |
| BO link (multiple) | `ExactEquality`, `ExactInequality`, `ContainsAny (value:Iterable[])`, `ExactEmpty ()` |
| CO | `ContainsAny`, `ExactEmpty` |
| TextLang kinds, PERIOD*, GEO_POINT, FILE_UPLOAD, CHECKLIST, QUESTIONNAIRE, PROGRESS_BAR | none — only `find*` |

**`findByFilter` never returns draft records** `[C]` — only saved ones, whatever the filter (an unsaved
new record, a child made by `F-CI` before the save, are not found). A save hook of a NEW record runs while
the record is still a draft, so that hook never finds the record itself `[C]`.
**`findByFilter` searches the Elasticsearch index** `[C]`; the index lags a save only slightly — a person
working in the UI never notices it `[C]`. Whether hooks and process runs of one BO run one at a time is
`[U]` — assume runs started at the same moment race `[I]`. So a search sees every record a person saved
before it, while runs started at the same moment (one xlsx file, an API loop) can read the same state `[I]`. The result has a cap — its size is unknown, far above 10 000 records `[I]` — so a scan
with no filter is complete at ordinary volumes.
**A duplicate in a unique field under a process:** a process that creates a dictionary row whose `code`
already exists fails `[C]`; whether writing a duplicate into any BO's `isUnique` field fails the process the
same way is `[U]`.

**Runtime semantics** `[C]` (counts below are for records a1/1/Да, b2/2/Нет, c3/3/Нет; hook «Открытие» of a NEW record): `ExactEquality`/`ExactInequality` on text and number, `StartsWithText «c»` → 1,
`EndsWithText «1»` → 1, `ContainsPhraseText «b2»` → 1, but **`ContainsText «2»` → 0** — it is a word/token match,
not a substring one (use `EndsWith`/`StartsWith`, or `#Содержит` on the value in a loop, for a true substring);
`GreaterThan 1` → 2, `GreaterThanOrEqual 2` → 2, `LessThan 2` → 1, `LessThanOrEqual 2` → 2, `GreaterThanButLessThan
(1,3)` → 1 and `GreaterThanOrEqualButLessThanOrEqual (1,3)` → 3 (bounds exclusive/inclusive as named);
`CHECKBOX ExactEquality Да` → 1; `And` → 1, `Or` → 2, `Not` → 2; **`findByFilter` with no filter = every
record** (3); `find` / `findSmall` by a value → 1. A `BlockForeach` over the result types its element as a
record and reads its fields (`#r#.Kod.#Значение`).

### Built-in functions (`ExprFunc` / `BlockFunc` — old panel only) `[C]`

`{"type":"ExprFunc","groupId":"<group>","funcId":"<func>","args":{"a0":{"exprId":…},…}}`; `BlockFunc` the
same as a statement. They are listed because old scripts contain them; each has a modern equivalent
(an action or a built-in object) and a `BlockFunc` switches compile optimisation off.

| group | functions |
|---|---|
| `str` Работа со строками | `contains`(a0:Text/String, a1:Text/String)→Bool/Boolean |
| `print` Работа с печатными формами | `getPrintForm`(a0:Bo/BoiRef, a1:Text/String)→File/MybpmFile[] |
| `signature` Работа с подписями | `readSignatures`(a0:Bo/BoiRef)→Object/MybpmSignature[]; `removeSignature`(a0:Object/MybpmSignature)→— |
| `fieldMetaData` Работа с полями | `readBoiFieldMeta`(a0:BoField/BoiFieldRef, a1:Bo/BoiRef, a2:EnumRef/FieldMetaType)→Bool/Boolean; `getBoiActualRecord`(a0:Bo/BoiRef)→Bool/Boolean; `writeBoiFormMetaReadonly`(a0:Bo/BoiRef, a1:Bo/BoiRef, a2:Bool/Boolean)→—; `writeBoiFieldOptionShown`(a0:Bo/BoiRef, a1:SingleSelect/SingleSelectRef, a2:Bo/BoiRef, a3:Bool/Boolean)→—; `writeBoiFieldMeta`(a0:BoField/BoiFieldRef, a1:Bo/BoiRef, a2:EnumRef/FieldMetaType, a3:Bool/Boolean)→— |
| `alert` Оповещения | `sendEmail`(a0:Text/String, a1:Text/String, a2:Text/String, a3:File/MybpmFile[])→—; `sendNavigableMultiLangPushNotificationToManyRecipients`(a0:Bo/BoiRef[], a1:TextLang, a2:TextLang, a3:Text/String, a4:Bool/Boolean, a5:Bool/Boolean, a6:Number/BigDecimal)→—; `sendNavigablePushNotification`(a0:Bo/BoiRef, a1:Text/String, a2:Text/String, a3:Text/String, a4:Bool/Boolean, a5:Bool/Boolean, a6:Number/BigDecimal)→—; `sendEmailToUsers`(a0:Bo/BoiRef, a1:Text/String, a2:Text/String, a3:File/MybpmFile[])→—; `sendPushNotification`(a0:Bo/BoiRef, a1:Text/String, a2:Text/String, a3:Text/String, a4:Bool/Boolean, a5:Number/BigDecimal, a6:Text/String, a7:Text/String)→—; `sendNavigableMultiLangPushNotification`(a0:Bo/BoiRef, a1:TextLang, a2:TextLang, a3:Text/String, a4:Bool/Boolean, a5:Bool/Boolean, a6:Number/BigDecimal)→— |
| `boProcess` Работа с бизнес-процессами | `go`(a0:Bo/BoiRef)→— |
| `self` Работа с текущим процессом | `getCurrentBoiProcess`()→Bo/BoiRef |
| `dates` Работа с датами | `incWorkingDateMillis`(a0:Bo/BoiRef, a1:Date, a2:Number/BigDecimal)→Date; `diffHours`(a0:Date, a1:Date)→Number/BigDecimal; `incDateYears`(a0:Date, a1:Number/BigDecimal)→Date; `secondDateFromPeriod`(a0:Period)→Date; `incDateMinutes`(a0:Date, a1:Number/BigDecimal)→Date; `currentMonth`()→Number/BigDecimal; `incWorkingDateHours`(a0:Bo/BoiRef, a1:Date, a2:Number/BigDecimal)→Date; `currentYear`()→Number/BigDecimal; `checkDateRange`(a0:Date, a1:Date, a2:Date)→Bool/Boolean; `eqDateYMD`(a0:Date, a1:Date)→Bool/Boolean; `getDayOfWeek`(a0:Date)→Number/BigDecimal; `diffDays`(a0:Date, a1:Date)→Number/BigDecimal; `now`()→Date; `getMonth`(a0:Date)→Number/BigDecimal; `incWorkingDateDays`(a0:Bo/BoiRef, a1:Date, a2:Number/BigDecimal)→Date; `incDateHours`(a0:Date, a1:Number/BigDecimal)→Date; `incWorkingDateSeconds`(a0:Bo/BoiRef, a1:Date, a2:Number/BigDecimal)→Date; `assembleDateWithTime`(a0:Date, a1:Date)→Date; `incDateDays`(a0:Date, a1:Number/BigDecimal)→Date; `incDateMillis`(a0:Date, a1:Number/BigDecimal)→Date; `diffYears`(a0:Date, a1:Date)→Number/BigDecimal; `incWorkingDateMonths`(a0:Bo/BoiRef, a1:Date, a2:Number/BigDecimal)→Date; `diffMonth`(a0:Date, a1:Date)→Number/BigDecimal; `checkDate`(a0:Date)→Bool/Boolean; `getDay`(a0:Date)→Number/BigDecimal; `firstDateFromPeriod`(a0:Period)→Date; `incWorkingDateMinutes`(a0:Bo/BoiRef, a1:Date, a2:Number/BigDecimal)→Date; `getYear`(a0:Date)→Number/BigDecimal; `currentDay`()→Number/BigDecimal; `incDateMonths`(a0:Date, a1:Number/BigDecimal)→Date; `diffMinutes`(a0:Date, a1:Date)→Number/BigDecimal; `incDateSeconds`(a0:Date, a1:Number/BigDecimal)→Date; `incWorkingDateYears`(a0:Bo/BoiRef, a1:Date, a2:Number/BigDecimal)→Date |
| `terminator` Другое | `renameFile`(a0:File/MybpmFile[], a1:Text/String)→—; `terminate`(a0:Bo/BoiRef)→— |
| `bo` Работа с бизнес-объектами | `restoreBoi`(a0:Bo/BoiRef)→—; `addRefToField`(a0:BoField/BoiFieldRef, a1:Bo/BoiRef)→—; `removeBoi`(a0:Bo/BoiRef)→—; `delFileFromField`(a0:BoField/BoiFieldRef, a1:File/MybpmFile[])→—; `delRefToField`(a0:BoField/BoiFieldRef, a1:Bo/BoiRef)→—; `addFileToField`(a0:BoField/BoiFieldRef, a1:File/MybpmFile[])→—; `archiveBoi`(a0:Bo/BoiRef)→— |
### The objects the factories return — their actions `[C]`

Property-like actions (no arguments, a value type) are **assignable** (`BlockAssign`, left = the act):
`email.«Заголовок письма» = "…"`, `rest.«адрес» = "…"`, `confirm.«метод Да» = <ScriptMethodRef>`.
Actions that return nothing are written as a statement: `BlockAssign` with `leftExprId` only (below).

`Object/GeoMap`
```text
F-geoPointAddresses-K-FIX-T-GeoMap                         Указать точки                          (originGeoPoint:GeoPoint, destinationGeoPoint:GeoPoint) → —
F-strAddresses-K-FIX-T-GeoMap                              Указать адреса                         (originStr:Text/String, destinationStr:Text/String) → —
F-getDistance-K-FIX-T-GeoMap                               Получить расстояние                    () → Number/BigDecimal
F-getGeoPointFromAddress-K-FIX-T-GeoMap                    Получить геолокацию по адресу          (address:Text/String) → GeoPoint
F-openRoute-K-FIX-T-GeoMap                                 Открыть маршрут                        () → Text/String
F-myGeolocation-K-FIX-T-GeoMap                             Моя геолокация                         () → GeoPoint
```

`Object/MybpmSystem`
```text
F-download-K-FIX-T-MybpmSystem                             Скачать файлы                          (field:BoField/BoiFieldRefCode?) → —
F-getSystemUser-K-FIX-T-MybpmSystem                        Системный пользователь                 () → Bo/BoiRefCode
F-refreshBrowserPage-K-FIX-T-MybpmSystem                   Перезагрузить страницу                 () → —
```

`Object/ScriptEmail`
```text
F-sendToUsers-K-FIX-T-ScriptEmail                          послать пользователям                  (whom:Bo/BoiRefCode?) → —
F-body-K-FIX-T-ScriptEmail                                 Текст содержимого                      () → Text/String
F-attachments-K-FIX-T-ScriptEmail                          Прикреплённые файлы                    () → File/MybpmFile[]
F-sendToAddress-K-FIX-T-ScriptEmail                        Отправить на Email-адрес               (email:Text/String?) → —
F-topic-K-FIX-T-ScriptEmail                                Заголовок письма                       () → Text/String
```

`Object/ScriptMultipartForm`
```text
F-addFile-K-FIX-T-ScriptMultipartForm                      добавить файл:                         (name:Text/String, file:File/MybpmFile?) → —
F-addParam-K-FIX-T-ScriptMultipartForm                     добавить параметр:                     (name:Text/String, value:Text/String?) → —
```

`Object/RestRequest`
```text
F-sendingText-K-FIX-T-RestRequest                          отправляемый текст                     () → Text/String
F-sendingXmlTag-K-FIX-T-RestRequest                        отправляемый XML                       () → Object/XmlTag
F-sendingMultipartForm-K-FIX-T-RestRequest                 отправляемый Multipart Form            () → Object/ScriptMultipartForm
F-sendingJsonDeck-K-FIX-T-RestRequest                      отправляемый Json {} объект            () → Object/JsonDeck
F-sendingJsonArr-K-FIX-T-RestRequest                       отправляемый Json [] массив            () → Object/JsonDeck[]
F-address-K-FIX-T-RestRequest                              адрес                                  () → Text/String
F-showHeaders-K-FIX-T-RestRequest                          Получить заголовки                     () → Text/String
F-method-K-FIX-T-RestRequest                               Метод вызова                           () → EnumRef/RestRequestMethod
F-readTimeout-K-FIX-T-RestRequest                          #тайм-аут чтения                       () → Number/BigDecimal
F-connectTimeout-K-FIX-T-RestRequest                       #тайм-аут подключения                  () → Number/BigDecimal
F-writeTimeout-K-FIX-T-RestRequest                         #тайм-аут записи                       () → Number/BigDecimal
F-callTimeout-K-FIX-T-RestRequest                          #тайм-аут вызова                       () → Number/BigDecimal
F-checkSslCertificate-K-FIX-T-RestRequest                  #проверять сертификат                  () → Bool/boolean
F-call-K-FIX-T-RestRequest                                 #вызвать                               () → Object/RestResponse
F-setHeader-K-FIX-T-RestRequest                            #Заголовок                             (name:Text/String, value:Text/String) → —
```

`Object/ScriptSms`
```text
F-message-K-FIX-T-ScriptSms                                Текст содержимого                      () → Text/String
F-sendToPhone-K-FIX-T-ScriptSms                            Отправить по номеру                    (phone:Text/String?) → —
```

`Object/ManagerUUID`
```text
F-textToUUID-K-FIX-T-ManagerUUID                           #преобразовать в UUID                  (text:Text/String) → Object/UUID
F-createLicenceNumber-K-FIX-T-ManagerUUID                  #Сгенерировать случайный лицензионный ключ () → Text/String
F-createRandom-K-FIX-T-ManagerUUID                         #Сгенерировать случайный               () → Object/UUID
```

`Object/ArchiveManager`
```text
F-addFile-K-FIX-T-ArchiveManager                           Добавить файл                          (archiveFile:File/MybpmFile) → —
F-archiveFiles-K-FIX-T-ArchiveManager                      #архивировать                          (text:Text/String?) → File/MybpmFile
```

`Object/ScriptXmlManager`
```text
F-putVarValue-K-FIX-T-ScriptXmlManager                     установить переменную шаблона          (name:Text/String, value:Text/String) → —
F-createXmlTagWithNamespace-K-FIX-T-ScriptXmlManager       создать тег XML в пространстве имён    (namespaceUri:Text/String, tagName:Text/String) → Object/XmlTag
F-createXmlTag-K-FIX-T-ScriptXmlManager                    создать тег XML                        (tagName:Text/String) → Object/XmlTag
F-convertToXmlTag-K-FIX-T-ScriptXmlManager                 преобразовать в XML                    (xmlText:Text/String) → Object/XmlTag
F-convertToJsonObject-K-FIX-T-ScriptXmlManager             преобразовать в JSON {} объект         (text:Text/String) → Object/JsonDeck
F-convertToJsonArray-K-FIX-T-ScriptXmlManager              преобразовать в JSON [] массив         (text:Text/String) → Object/JsonDeck[]
```

`Object/ScriptNotification`
```text
F-body-K-FIX-T-ScriptNotification                          тело                                   () → Text/String
F-url-K-FIX-T-ScriptNotification                           ссылка                                 () → Text/String
F-sendToManyRecipients-K-FIX-T-ScriptNotification          послать множеству получателей          (target:Bo/BoiRefCode[]) → —
F-send-K-FIX-T-ScriptNotification                          послать                                (target:Bo/BoiRefCode) → —
F-openUrlOnInit-K-FIX-T-ScriptNotification                 открыть ссылку?                        () → Bool/boolean
F-topicMultiLang-K-FIX-T-ScriptNotification                мультиязычный заголовок                () → TextLang
F-bodyMultiLang-K-FIX-T-ScriptNotification                 мультиязычное тело                     () → TextLang
F-topic-K-FIX-T-ScriptNotification                         заголовок                              () → Text/String
F-duration-K-FIX-T-ScriptNotification                      длительность (секунд)                  () → Number/BigDecimal
F-needAudio-K-FIX-T-ScriptNotification                     аудио                                  () → Bool/boolean
```

`Object/ScriptMethodTimerPlaque`
```text
F-scheduleMethod-K-FIX-T-ScriptMethodTimerPlaque           Запланировать вызов                    (method:Object/ScriptMethodRef?, executeAt:Date?) → —
```

`Object/ConfirmForm`
```text
F-noButtonText-K-FIX-T-ConfirmForm                         текст кнопки Нет                       () → Text/String
F-yesButtonText-K-FIX-T-ConfirmForm                        текст кнопки Да                        () → Text/String
F-text-K-FIX-T-ConfirmForm                                 текст                                  () → Text/String
F-show-K-FIX-T-ConfirmForm                                 показать                               () → —
F-noMethod-K-FIX-T-ConfirmForm                             метод Нет                              () → Object/ScriptMethodRef
F-yesMethod-K-FIX-T-ConfirmForm                            метод Да                               () → Object/ScriptMethodRef
F-title-K-FIX-T-ConfirmForm                                заголовок                              () → Text/String
```

`Object/ElectronicColorPalette`
```text
F-blue-K-FIX-T-ElectronicColorPalette                      Синий (0..255)                         () → Number/BigDecimal
F-alpha-K-FIX-T-ElectronicColorPalette                     Синий (0..255)                         () → Number/BigDecimal
F-isAbsent-K-FIX-T-ElectronicColorPalette                  Отсутствует цвет?                      () → Bool/boolean
F-red-K-FIX-T-ElectronicColorPalette                       Красный (0..255)                       () → Number/BigDecimal
F-green-K-FIX-T-ElectronicColorPalette                     Зелёный (0..255)                       () → Number/BigDecimal
F-setRGB-K-FIX-T-ElectronicColorPalette                    Задать RGB                             (r:Number/BigDecimal?, g:Number/BigDecimal?, b:Number/BigDecimal?) → Object/ElectronicColorPalette
F-setARGB-K-FIX-T-ElectronicColorPalette                   Задать ARGB                            (a:Number/BigDecimal?, r:Number/BigDecimal?, g:Number/BigDecimal?, b:Number/BigDecimal?) → Object/ElectronicColorPalette
F-isDefined-K-FIX-T-ElectronicColorPalette                 Задан цвет?                            () → Bool/boolean
F-copy-K-FIX-T-ElectronicColorPalette                      #Скопировать                           () → Object/ElectronicColorPalette
F-makeTeal-K-FIX-T-ElectronicColorPalette                  #Сделать цветом МОРСКОЙ ВОЛНЫ          () → Object/ElectronicColorPalette
F-makeIndigo-K-FIX-T-ElectronicColorPalette                #Сделать цветом ИНДИГО                 () → Object/ElectronicColorPalette
F-makeAmber-K-FIX-T-ElectronicColorPalette                 #Сделать ЯНТАРНЫМ                      () → Object/ElectronicColorPalette
F-makeBlack-K-FIX-T-ElectronicColorPalette                 #Сделать ЧЁРНЫМ                        () → Object/ElectronicColorPalette
F-makePurple-K-FIX-T-ElectronicColorPalette                #Сделать ФИОЛЕТОВЫМ                    () → Object/ElectronicColorPalette
F-makeNavyBlue-K-FIX-T-ElectronicColorPalette              #Сделать ТЁМНО-СИНИМ                   () → Object/ElectronicColorPalette
F-makeBlue-K-FIX-T-ElectronicColorPalette                  #Сделать СИНИМ                         () → Object/ElectronicColorPalette
F-makeGray-K-FIX-T-ElectronicColorPalette                  #Сделать СЕРЫМ                         () → Object/ElectronicColorPalette
F-makeLightSteelBlue-K-FIX-T-ElectronicColorPalette        #Сделать СЕРО-ГОЛУБЫМ                  () → Object/ElectronicColorPalette
F-makeLightGray-K-FIX-T-ElectronicColorPalette             #Сделать СВЕТЛО-СЕРЫМ                  () → Object/ElectronicColorPalette
F-makeLightGreen-K-FIX-T-ElectronicColorPalette            #Сделать СВЕТЛО-ЗЕЛЁНЫМ                () → Object/ElectronicColorPalette
F-makeLightBlue-K-FIX-T-ElectronicColorPalette             #Сделать СВЕТЛО-ГОЛУБЫМ                () → Object/ElectronicColorPalette
F-makeLimeLightGreen-K-FIX-T-ElectronicColorPalette        #Сделать САЛАТОВЫМ                     () → Object/ElectronicColorPalette
F-makePink-K-FIX-T-ElectronicColorPalette                  #Сделать РОЗОВЫМ                       () → Object/ElectronicColorPalette
F-makeMagenta-K-FIX-T-ElectronicColorPalette               #Сделать ПУРПУРНЫМ                     () → Object/ElectronicColorPalette
F-makeOrange-K-FIX-T-ElectronicColorPalette                #Сделать ОРАНЖЕВЫМ                     () → Object/ElectronicColorPalette
F-makeOlive-K-FIX-T-ElectronicColorPalette                 #Сделать ОЛИВКОВЫМ                     () → Object/ElectronicColorPalette
F-makeRed-K-FIX-T-ElectronicColorPalette                   #Сделать КРАСНЫМ                       () → Object/ElectronicColorPalette
F-makeBrown-K-FIX-T-ElectronicColorPalette                 #Сделать КОРИЧНЕВЫМ                    () → Object/ElectronicColorPalette
F-makeGold-K-FIX-T-ElectronicColorPalette                  #Сделать ЗОЛОТЫМ                       () → Object/ElectronicColorPalette
F-makeGreen-K-FIX-T-ElectronicColorPalette                 #Сделать ЗЕЛЁНЫМ                       () → Object/ElectronicColorPalette
F-makeYellow-K-FIX-T-ElectronicColorPalette                #Сделать ЖЁЛТЫМ                        () → Object/ElectronicColorPalette
F-makeDeepPurple-K-FIX-T-ElectronicColorPalette            #Сделать ГЛУБОКИМ ФИОЛЕТОВЫМ           () → Object/ElectronicColorPalette
F-makeDeepOrange-K-FIX-T-ElectronicColorPalette            #Сделать ГЛУБОКИМ ОРАНЖЕВЫМ            () → Object/ElectronicColorPalette
F-makeCyan-K-FIX-T-ElectronicColorPalette                  #Сделать БИРЮЗОВЫМ                     () → Object/ElectronicColorPalette
F-makeWhite-K-FIX-T-ElectronicColorPalette                 #Сделать БЕЛЫМ                         () → Object/ElectronicColorPalette
F-clear-K-FIX-T-ElectronicColorPalette                     #Очистить цвет                         () → Object/ElectronicColorPalette
```

`Object/ElectronicTableBo`
```text
F-createTab-K-FIX-T-ElectronicTableBo                      #Создать новый лист                    (tabTitle:Text/String) → Object/ElectronicTableBoTab
F-convertToMybpmFileXlsx-K-FIX-T-ElectronicTableBo         #Преобразовать в файл XLSX             (fileName:Text/String?) → File/MybpmFile
F-convertToMybpmFilePdf-K-FIX-T-ElectronicTableBo          #Преобразовать в файл PDF              (fileName:Text/String?) → File/MybpmFile
F-firstTab-K-FIX-T-ElectronicTableBo                       #Первый лист                           () → Object/ElectronicTableBoTab
F-tabCount-K-FIX-T-ElectronicTableBo                       #Количество листов                     () → Number/BigInteger
F-isTabWithTitle-K-FIX-T-ElectronicTableBo                 #Есть ли лист с названием              (title:Text/String) → Bool/boolean
F-appendFromFileXlsx-K-FIX-T-ElectronicTableBo             #Добавить листы из файла               (file:Object) → —
F-tabByTitle-K-FIX-T-ElectronicTableBo                     #Дай лист по названию                  (title:Text/String) → Object/ElectronicTableBoTab
F-tabByIndex-K-FIX-T-ElectronicTableBo                     #Дай лист по индексу                   (tabIndex:Number/int) → Object/ElectronicTableBoTab
```

`Object/XmlTag`
```text
F-setInnerText-K-FIX-T-XmlTag                              установить текст внутри                (text:Text/String) → —
F-putNamespaceUriPrefix-K-FIX-T-XmlTag                     установить префикс                     (paramName:Text/String, namespaceUri:Text/String) → —
F-createChild-K-FIX-T-XmlTag                               создать дочерний тег                   (tagName:Text/String) → Object/XmlTag
F-getInnerText-K-FIX-T-XmlTag                              получить текст внутри                  () → Text/String
F-getAttrAsText-K-FIX-T-XmlTag                             получить текст атрибута                (attrName:Text/String) → Text/String
F-getInnerDate-K-FIX-T-XmlTag                              получить дату внутри                   () → Date
F-gotoTag-K-FIX-T-XmlTag                                   перейти                                (qNamePath:Text/String) → Object/XmlTag
F-tagName-K-FIX-T-XmlTag                                   имя тега                               () → Text/String
F-setAttrAsText-K-FIX-T-XmlTag                             задать атрибут                         (attrName:Text/String, attrValue:Text/String) → —
F-children-K-FIX-T-XmlTag                                  внутренние XML теги                    () → Object/XmlTag[]
F-outerToXml-K-FIX-T-XmlTag                                XML в текст                            (pretty:Bool/boolean) → Text/String
```

`Object/RestResponse`
```text
F-resultAsText-K-FIX-T-RestResponse                        результат как текст                    () → Text/String
F-resultAsMybpmByteArray-K-FIX-T-RestResponse              результат как массив байтов            () → Object/MybpmByteArray
F-resultAsXml-K-FIX-T-RestResponse                         результат как XML                      () → Object/XmlTag
F-resultAsJsonDeck-K-FIX-T-RestResponse                    результат как Json {} объект           () → Object/JsonDeck
F-resultAsJsonArr-K-FIX-T-RestResponse                     результат как Json [] массив           () → Object/JsonDeck[]
F-resultCode-K-FIX-T-RestResponse                          код статуса вызова                     () → Number/BigDecimal
F-headers-K-FIX-T-RestResponse                             имена заголовков                       () → Text/String[]
F-headerNumber-K-FIX-T-RestResponse                        заголовок как число                    (headerName:Text/String) → Number/BigDecimal
F-headerText-K-FIX-T-RestResponse                          заголовок как текст                    (headerName:Text/String) → Text/String
F-headerDate-K-FIX-T-RestResponse                          заголовок как дата/время               (headerName:Text/String) → Date
```

A GET request `[C]`:
`Пусть #запрос# = Создать Rest-запрос` (`JavaObjectFactories` `BEAN_METHOD-RestExtensions-createJsonDeck`)
→ `#запрос#.адрес = …` → `#запрос#.Метод вызова = GET` (an `Enum` constant `RestRequestMethod`) →
optional `#запрос#.#Заголовок("Referer", …)` (a `BlockAssign` with `leftExprId` only) →
`Пусть #ответ# = #запрос#.#вызвать`.
- **A 4xx does not throw.** The script goes on with `resultCode` 403 or 401 and the error body in
  `resultAsText`.
- **Every non-2xx also raises a notification for the user**: «Ошибка — Возникла ошибка при запросе в
  сервис <full url> причина: Forbidden». **The url is shown whole, query string and `apikey=` included** —
  keep secrets out of the query where you can (put them in a header).
- **Number → text works with `'' ⊕ resultCode`.**
- **`headerText` of a header the response lacks gives an empty string.**

Chained requests and JSON parsing `[C]`:
- **A Cyrillic and spaced value can go into `адрес` raw** (`"…&geocode=" ⊕ <address field>`). The
  platform encodes it correctly. A raw curl URL, by contrast, needs `--data-urlencode`.
- **JSON walk**: `resultAsJsonDeck` → `getAsJsonDeck(name)` … → `getAsJsonArr(name)`. **A
  `BlockForeach` over a `JsonDeck[]` types its element as `JsonDeck`**, so the loop body goes on with
  `getAsJsonDeck` / `getAsText` on the element. Use that for «the first item». `F-first-K-FIX-T-Iterable`
  returns a bare `Object`, which is not verified to take the `JsonDeck` acts.
- **JSON without a request** `[C]`: `Создать Json {} объект` + `.установить(name, value)` for a
  text, a number and a Bool, then `#превратить json в текст` → `{"a":"x","n":5,"b":true}` (typed, in insertion
  order); `#Преобразовать в Json {} объект` on a text, then `getAsText` / `getAsNumber` (`2.5`), `isNumber` /
  `isText` / `isJsonDeck` / `isJsonArr` (right answers, `isNumber` on a text key = Нет), a nested `getAsJsonDeck`,
  and a foreach over `getAsJsonArr`; `#Преобразовать в Json [] массив` of `[1,2,3]` → `размер` 3. **A missing key
  is not an error**: `getAsText("nope")` returns the empty text and the script goes on.
- **A Rest response into a file field**: `resultAsMybpmByteArray` → `convertToFile(fileName)`, then
  **`BlockAssign` to the FILE_UPLOAD field's `#Значение`, which REPLACES the file**.
  `F-addFile_v2-K-FIX-T-BoiFieldRefCode` on the field reference APPENDS one more file on each run.
  **In «Множественный» mode `#Значение` is `File[]`**, and assigning one file fails `translate-script`
  with `blockAssign_arrayAssignNoArray`. The script language has no array constructor. What works is
  `Пусть #файлы# = (Создать Email).Прикреплённые файлы` (`BEAN_METHOD-ScriptEmailFactory-newScriptEmail`
  → `F-attachments-K-FIX-T-ScriptEmail`, an empty `File[]`), then
  `#файлы#.добавить(<file>)` (`F-add-K-FIX-T-Iterable`, a `BlockAssign` without `rightExprId`), then
  `<field>.#Значение = #файлы#`. This works, and it still replaces rather than appends.
- **A TEXTAREA is an HTML editor (summernote)**, so `\n` in a written text collapses into
  a space. Separate lines with `<br>`, which the sanitizer keeps. The same holds for `TEXTAREA_LANG`, and
  a script may write any HTML fragment into either, not only `<br>` `[C]`.
- `F-returnLastIndex-K-FIX-T-String` plus `substring(0, idx)` plus `trim` split `"lon lat"` correctly.
  Take the lat as `trim(replace(pos, lon, ""))`, which does not depend on the exact index semantics.

`Object/UUID`
```text
F-uuidToString-K-FIX-T-UUID                                #В текст                               () → Text/String
```

`Object/ElectronicTableBoTab`
```text
F-maxBatchSize-K-FIX-T-ElectronicTableBoTab                максимальный размер порции данных      () → Number/int
F-currentRowIndex-K-FIX-T-ElectronicTableBoTab             индекс строки загрузки/выгрузки        () → Number/int
F-colWidth-K-FIX-T-ElectronicTableBoTab                    Ширина колонки                         (colIndex:Number/int) → Number/BigDecimal
F-cellType-K-FIX-T-ElectronicTableBoTab                    Тип ячейки                             (rowIndex:Number/int, colIndex:Number/int) → EnumRef/ElectronicCellType
F-cellText-K-FIX-T-ElectronicTableBoTab                    Текст ячейки                           (rowIndex:Number/int, colIndex:Number/int) → Text/String
F-cellStyle-K-FIX-T-ElectronicTableBoTab                   Стиль ячейки:                          (rowIndex:Number/int, colIndex:Number/int) → Object/ElectronicCellStyle
F-title-K-FIX-T-ElectronicTableBoTab                       Имя листа                              () → Text/String
F-rowHeight-K-FIX-T-ElectronicTableBoTab                   Высота строки                          (rowIndex:Number/int) → Number/BigDecimal
F-removeThisTab-K-FIX-T-ElectronicTableBoTab               #Удалить этот лист                     () → —
F-putErrorsIntoKeyColumn-K-FIX-T-ElectronicTableBoTab      #Ошибки помещать в колонку с индексом  (field:Number/int) → —
F-clearAssociations-K-FIX-T-ElectronicTableBoTab           #Очистить ассоциации                   () → —
F-countRows-K-FIX-T-ElectronicTableBoTab                   #Количество строк                      () → Number/int
F-countCols-K-FIX-T-ElectronicTableBoTab                   #Количество колонок                    () → Number/int
F-associateSingleUniqueRefCO-K-FIX-T-ElectronicTableBoTab  #Ассоциировать ссылку на композитный объект (КЛЮЧ) (field1:Object/BoFieldRefCode, field2:Object/BoFieldRefCode, colIndexFld:Number/int, colIndexType:Number/int, createIfNotFound:Bool/Boolean?) → —
F-associateSingleRefCO-K-FIX-T-ElectronicTableBoTab        #Ассоциировать ссылку на композитный объект (field1:Object/BoFieldRefCode, field2:Object/BoFieldRefCode, colIndexFld:Number/int, colIndexType:Number/int) → —
F-associateSingleUniqueRefBO-K-FIX-T-ElectronicTableBoTab  #Ассоциировать ссылку на бизнес-объект (КЛЮЧ) (field1:Object/BoFieldRefCode, field2:Object/BoFieldRefCode, colIndexFld:Number/int, createIfNotFound:Bool/Boolean?) → —
F-associateSingleRefBO-K-FIX-T-ElectronicTableBoTab        #Ассоциировать ссылку на бизнес-объект (field1:Object/BoFieldRefCode, field2:Object/BoFieldRefCode, colIndexFld:Number/int) → —
F-associateFieldByColIndex-K-FIX-T-ElectronicTableBoTab    #Ассоциировать поле                    (field:Object/BoFieldRefCode, colIndex:Number/int) → —
F-associateKeyFieldByColIndex-K-FIX-T-ElectronicTableBoTab #Ассоциировать УНИКАЛЬНОЕ поле         (field:Object/BoFieldRefCode, colIndex:Number/int) → —
F-copyFromTableToBo_colEqText-K-FIX-T-ElectronicTableBoTab # СКОПИРОВАТЬ: Электронная Таблица ➔ Бизнес-объект по условию (colIndex:Number/int, text:Text/String) → —
F-copyFromTableToBo-K-FIX-T-ElectronicTableBoTab           # СКОПИРОВАТЬ: Электронная Таблица ➔ Бизнес-объект () → —
F-copyFromBoToTable-K-FIX-T-ElectronicTableBoTab           # СКОПИРОВАТЬ: Бизнес-объект ➔ Электронная Таблица (filter:Filter/AbstractFilter?, sortField:Object/BoFieldRefCode?, ascending:Bool/Boolean?) → —
```

`Object/ElectronicCellStyle`
```text
F-font-K-FIX-T-ElectronicCellStyle                         Стиль текста                           () → Object/ElectronicFontWrapper
F-borderRight-K-FIX-T-ElectronicCellStyle                  Граница справа                         () → Object/ElectronicCellBorder
F-borderBottom-K-FIX-T-ElectronicCellStyle                 Граница снизу                          () → Object/ElectronicCellBorder
F-borderLeft-K-FIX-T-ElectronicCellStyle                   Граница слева                          () → Object/ElectronicCellBorder
F-borderTop-K-FIX-T-ElectronicCellStyle                    Граница сверху                         () → Object/ElectronicCellBorder
F-alignmentHorizontal-K-FIX-T-ElectronicCellStyle          Выравнивание по горизонтали            () → EnumRef/AlignmentHorizontal
F-alignmentVertical-K-FIX-T-ElectronicCellStyle            Выравнивание по вертикали              () → EnumRef/AlignmentVertical
F-borders_setColor-K-FIX-T-ElectronicCellStyle             #Установить цвет сразу всем границам   (color:Object/ElectronicColorPalette) → —
F-borders_setStyle-K-FIX-T-ElectronicCellStyle             #Установить стиль сразу всем границам  (color:EnumRef/ElectronicBorderStyle?) → —
F-copyFrom-K-FIX-T-ElectronicCellStyle                     #Скопировать сюда все стили из         (acs:Object/ElectronicCellStyle) → —
```

`Object/BoFieldRefCode`
```text
F-findRemoved-K-FIX-T-BoFieldRefCode                       Найти по этому полю в удаленных        (fieldValue:Object?) → Bo/BoiRefCode[]
F-findArchived-K-FIX-T-BoFieldRefCode                      Найти по этому полю в архивных         (fieldValue:Object?) → Bo/BoiRefCode[]
F-findSmall-K-FIX-T-BoFieldRefCode                         Найти по этому полю (мало данных)      (fieldValue:Object?) → Bo/BoiRefCode[]
F-find-K-FIX-T-BoFieldRefCode                              Найти по этому полю                    (fieldValue:Object?) → Bo/BoiRefCode[]
```

`Object/ElectronicFontWrapper`
```text
F-bgColor-K-FIX-T-ElectronicFontWrapper                    Цвет фона                              () → Object/ElectronicColorPalette
F-fontColor-K-FIX-T-ElectronicFontWrapper                  Цвет текста                            () → Object/ElectronicColorPalette
F-fontHeight-K-FIX-T-ElectronicFontWrapper                 Размер шрифта                          () → Number/BigDecimal
F-fontUnderline-K-FIX-T-ElectronicFontWrapper              Подчёркивание                          () → EnumRef/ElectronicUnderline
F-italic-K-FIX-T-ElectronicFontWrapper                     Наклонность                            () → Bool/boolean
F-fontName-K-FIX-T-ElectronicFontWrapper                   Имя шрифта                             () → Text/String
F-strikeout-K-FIX-T-ElectronicFontWrapper                  Зачёркнутость                          () → Bool/boolean
F-bold-K-FIX-T-ElectronicFontWrapper                       Жирность                               () → Bool/boolean
```

`Object/ElectronicCellBorder`
```text
F-color-K-FIX-T-ElectronicCellBorder                       Цвет                                   () → Object/ElectronicColorPalette
F-style-K-FIX-T-ElectronicCellBorder                       Стиль                                  () → EnumRef/ElectronicBorderStyle
```

`Object/JsonDeck`
```text
F-put-K-FIX-T-JsonDeck                                     установить                             (paramName:Text/String, value:Object) → —
F-toTextPretty-K-FIX-T-JsonDeck                            #превратить json в текст (красиво)     () → Text/String
F-toText-K-FIX-T-JsonDeck                                  #превратить json в текст               () → Text/String
F-isNumber-K-FIX-T-JsonDeck                                #Число ли?                             (paramName:Text/String) → Bool/boolean
F-isText-K-FIX-T-JsonDeck                                  #Текст ли?                             (paramName:Text/String) → Bool/boolean
F-isDate-K-FIX-T-JsonDeck                                  #Дата/время ли?                        (paramName:Text/String) → Bool/boolean
F-isBool-K-FIX-T-JsonDeck                                  #Да/Нет ли?                            (paramName:Text/String) → Bool/boolean
F-getAsNumber-K-FIX-T-JsonDeck                             #Взять число                           (paramName:Text/String) → Number/BigDecimal
F-getAsText-K-FIX-T-JsonDeck                               #Взять текст                           (paramName:Text/String) → Text/String
F-getAsDate-K-FIX-T-JsonDeck                               #Взять дату/время                      (paramName:Text/String) → Date
F-getAsBool-K-FIX-T-JsonDeck                               #Взять Да/Нет                          (paramName:Text/String) → Bool/boolean
F-getAsJsonDeck-K-FIX-T-JsonDeck                           #Взять Json {} объект                  (paramName:Text/String) → Object/JsonDeck
F-getAsJsonArr-K-FIX-T-JsonDeck                            #Взять Json [] массив                  (paramName:Text/String) → Object/JsonDeck[]
F-isJsonDeck-K-FIX-T-JsonDeck                              #Json {} объект ли?                    (paramName:Text/String) → Bool/boolean
F-isJsonArr-K-FIX-T-JsonDeck                               #Json [] массив ли?                    (paramName:Text/String) → Bool/boolean
```

`Filter/AbstractFilter`
```text
F-createNotFilter-K-FIX-T-AbstractFilter                   НЕ                                     () → Filter/AbstractFilter
F-createOrFilter-K-FIX-T-AbstractFilter                    ИЛИ                                    (rightFilter:Filter/AbstractFilter) → Filter/AbstractFilter
F-createAndFilter-K-FIX-T-AbstractFilter                   И                                      (rightFilter:Filter/AbstractFilter) → Filter/AbstractFilter
```

`Object/ScriptMultiLangText`
```text
F-addText-K-FIX-T-ScriptMultiLangText                      Добавить                               (text:Text/String, lang:EnumRef/MybpmLang) → —
```

`File/MybpmFile`
```text
F-isEmpty-K-FIX-T-MybpmFile                                пусто?                                 () → Bool/boolean
F-type-K-FIX-T-MybpmFile                                   Тип файла                              () → EnumRef/MybpmFileType
F-createdAt-K-FIX-T-MybpmFile                              Когда создали                          () → Date
F-name-K-FIX-T-MybpmFile                                   Имя                                    () → Text/String
F-unzipFile-K-FIX-T-MybpmFile                              #разархивировать                       () → Object/File[]
F-toMybpmByteArray-K-FIX-T-MybpmFile                       #преобразовать в массив байтов         () → Object/MybpmByteArray
F-extractFileExtension-K-FIX-T-MybpmFile                   #Скачать и преобразовать в Java-файл   () → Object/File
F-loadFromFile-K-FIX-T-MybpmFile                           #Превратить в электронную таблицу      () → Object/ElectronicTableBo
```

`Object/MybpmByteArray`
```text
F-convertToFile-K-FIX-T-MybpmByteArray                     конвертировать в файл                  (fileName:Text/String) → File/MybpmFile
F-toBase64-K-FIX-T-MybpmByteArray                          #преобразовать в текст Base64          () → Text/String
```

`Object/MybpmUrl`
```text
F-boiRefCode-K-FIX-T-MybpmUrl                              Экземпляр БО                           () → Bo/BoiRefCode
F-type-K-FIX-T-MybpmUrl                                    Тип ссылки                             () → EnumRef/MybpmUrlType
F-personRefCode-K-FIX-T-MybpmUrl                           Ссылка на пользователя                 () → Bo/BoiRefCode
F-fieldRefCode-K-FIX-T-MybpmUrl                            Поле экземпляра БО                     () → BoField/BoiFieldRefCode
F-isExternal-K-FIX-T-MybpmUrl                              Внешняя ссылка                         () → Bool/boolean
F-generate-K-FIX-T-MybpmUrl                                #Сформировать                          () → Text/String
```

`Object/SignedField`
```text
F-fieldId-K-FIX-T-SignedField                              Идентификатор поля                     () → Text/String
F-boId-K-FIX-T-SignedField                                 Идентификатор БО                       () → Text/String
F-mybpmFiles-K-FIX-T-SignedField                           Документы                              () → File/MybpmFile[]
```

`ProgressBar/ProgressStepRefCode`
```text
F-getColor-K-FIX-T-ProgressStepRefCode                     #получить цвет                         () → EnumRef/Color
F-setColorUntil-K-FIX-T-ProgressStepRefCode                #покрасить предыдущие в                (color:EnumRef/Color) → —
F-setColor-K-FIX-T-ProgressStepRefCode                     #покрасить в                           (color:EnumRef/Color) → —
F-clearAfter-K-FIX-T-ProgressStepRefCode                   #очистить последующие                  () → —
F-clear-K-FIX-T-ProgressStepRefCode                        #очистить                              () → —
F-hasColor-K-FIX-T-ProgressStepRefCode                     #есть цвет?                            () → Bool/boolean
F-saveBoiChanges-K-FIX-T-BoiRefCode                        #Сохранить                             () → —
F-updateOpenedBoi-K-FIX-T-BoiRefCode                       #Обновить из базы открытую инстанцию   (target:Bo/BoiRefCode) → —
F-closeOpenedBoi-K-FIX-T-BoiRefCode                        #Закрыть                               () → —
```
### Calling an action that returns nothing — `BlockAssign` without `rightExprId` `[C]`

`{"type":"BlockAssign","leftExprId":"<ExprAct of a void action>"}` — no `rightExprId`. The IDE draws it
with the right slot hidden (`scriptMetaState.blockAssignStates[<blockId>].hideRightExpr`, UI state only,
not part of the def). Compiled for `JsonDeck.put`, `ScriptMultiLangText.addText` and
`field.#Добавить ошибку`. A method call used as a statement is the same shape with an
`ExprCall` on the left.

### Actions that exist only on a PROCESS record `[C]`

`load-act-record-list` offers these three ONLY when `leftType` is a record (`BoiRefCode`) — or the type
(`BoRefCode`) — of a `BO_PROCESS` BO; on a plain BO's record they are absent. All three take no arguments and return nothing
(use them as `BlockAssign` without `rightExprId`, see above):

```
F-goForProcess-K-FIX-T-BoiRefCode      #Запустить процесс     () → —   start the business process of that record
F-continueProcess-K-FIX-T-BoiRefCode   #Продолжить процесс    () → —   release every wait of that process: a Form
                                                                         it waits on, or a Timer, passes on at once
F-terminateProcess-K-FIX-T-BoiRefCode  #Терминируй процесс    () → —   stop the whole process, all arrows halt
```

A process record also has the field action `F-PROCESS_STATUS-K-DYN-S-boi_fields` (its `PROCESS_STATUS`).
`F-updateTrapDate-K-FIX-T-BoiFieldRefCode` «#Обновить таймер для процесса» `[C]` is an action on a process FIELD (`BoiFieldRefCode` = `ЭТОТ_ПРОЦЕСС.<field>`, no
`#Значение` hop), no arguments, returns nothing — a `BlockAssign` with only `leftExprId`. Platform's
description: «a Timer's schedule is not updated automatically when its field changes; to move it, change
the field and then call this». The same list on a process field also offers `#Удалить ошибку`,
`#Добавить ошибку`, `#Существует?`, `#Обновить из базы`, `#Дай код поля БО` / `#Дай код БО` /
`#Дай идентификатор …`, and the three record actions above. When it is (not) needed: §16 «A Timer».

## 13. Methods

- Methods take parameters and return values; the header renders `is_formula(#текст) : Bool`. In the stored
  header the parameter `name` has no «решётки» (`символ`, not `#символ#`). Parameter types seen: Текст,
  Число, BO types (`step: Model_step`); return types Логическое / Текст / Число.
- **Method id and parameter ids are random 16-char ids generated by the IDE.** A generator cannot invent
  them: **the user creates the EMPTY method in the IDE and copies it back**, and the real ids go into the
  script you build. `[C]`
- **`ExprCall.args` is keyed by the callee's parameter id** — not by position, not by name. A stale or
  invented key renders «Не передан аргумент `#var_name#` в вызов метода `is_var`» and the IDE adds the real
  slot beside it. Consequences: renaming or reordering a signature cannot change which argument lands
  where; **adding a parameter to a widely called method is not a local change** (prefer a new method);
  **recreating a callee breaks every call site**. `[C]`
- The return type can be changed in place and the parameter ids survive. `[C]`
- Calls between methods work; **recursion is allowed** `[C]`, but never exercised in a working
  script — counted loops are the tested route.
- **A called method must exist**: a call to a missing one shows «У выражения справа не определён тип», and
  «метода без тела в проекте быть не может» — create a stub with a trivial body for a not-yet-written callee.
- **An argument can carry a LIST of instances** `[C]`: declare the parameter `Bo` with `isArray:true`
  (§10 `BlockForeach`) and pass a link-many field's value — `ЭТА ИНСТАНЦИЯ.<TABLE field>.#Значение` (both
  hops) as the `exprId` of the call's argument. Inside, a `BlockForeach` over the parameter makes one pass per
  linked record and reads its fields; an empty field gives zero passes, no error. A single BO instance is fine too.
- A method with no parameters is called with `args: {}` `[C]`.

## 14. Delivery: the paste protocol

### Clipboard (Linux / Wayland)

- **Always `wl-copy --type text/plain < file.json`.** A bare `wl-copy < file` sniffs the content and
  advertises `application/json` first → **the paste is silently ignored**. Verify with
  `wl-paste -n | md5sum` against the file before the user pastes (`wl-paste` without `-n` appends `\n`). `[C]`
- **A script that ends with `wl-copy` hangs its caller**: wl-copy daemonises and inherits stdout/the pipe,
  so `bun run x.bun.ts | tail` never returns. Run it bare, or
  `> log 2>&1 < /dev/null`, or give the script a no-copy flag for dry runs. Killing the wrapper is safe —
  wl-copy keeps the clipboard.
- **Reading a copy back**: the user copies the method/process in the IDE → `wl-paste -n > live.json`.
  Never retype JSON the user pasted into chat. **The IDE is the ONLY source of the current script** —
  nothing is on disk. A user copy overwrites the clipboard, so a patch script that reads the clipboard
  while it holds something else dies with `SyntaxError: JSON Parse error` — copy in the IDE first, then
  run the patch. A copy the user pasted into a chat can be recovered from that chat's saved transcript
  (the message containing `"copiedType"`).
- **Pasting from browser automation** `[C]`: the IDE pastes from the canvas CONTEXT MENU (right click →
  «Вставить») and reads the clipboard with `navigator.clipboard.readText()` when the menu opens — in a page driven by
  automation that fails («Document is not focused») and the item silently pastes nothing. Override it in the page first
  (`navigator.clipboard.readText = async () => <the JSON as a string>`), then click «Вставить» with a REAL
  mouse click (`el.click()` and synthetic mouse events on its `<tr>` are ignored). After a navigation the first
  click on the scripts icon is swallowed — click `[selenide=q9qtPW3E-bo-script-icon]` from JS. The menu's
  paste is `v2/script/paste` + one `apply-update-cmd`, so the API does the same with no UI at all (`MYBPM-UI-API.md` §5g).

### Hats and paste order

- **Pasting a method hat NEVER works** `[C]`: a fragment whose `startBlockIds` point at a `BlockFixMethod`
  is silently not pasted, even onto an empty canvas. The `Выйти из метода` block pastes fine inside a body.
- A **process** script WITH its `BlockFixEntryPoint` hat DOES paste. `[C]`
- **An entry point in the clipboard blocks method pastes** `[C]`. So: paste every method first, copy the
  process script LAST, and copy nothing afterwards.

### Protocol

- **New method**: the user creates it by hand (name, params, return type) and copies the empty method out;
  the agent reads the clipboard, puts the real param ids into the script, rebuilds it.
- **Body of an existing method**: strip the hat (drop `BlockFixMethod`, re-point `startBlockIds` at its
  `downBlockId`; stripped body = generated blocks − 1); the user opens the method, clears the body, pastes.
  The param VAR_REF ids in the fragment must be the method's live param ids.
- **Paste leaves first** (callees before callers). A method pasted before its callee exists keeps a
  synthetic param id in its `ExprCall` and **must be re-pasted** after the callee is created — the
  «не определён тип» warning at the time hides this.
- **Fields before pasting is not required**: a body reading a not-yet-created field drew the raw actId with
  a warning, and after the field was created the binding **resolved by itself, no re-paste**. `[C]`
- **Large scripts — deliver a PATCH PROGRAM**, not re-emitted JSON: read the clipboard → modify → write
  clipboard + file; assert all anchor ids first, walk from `startBlockIds`, refuse to write if any
  reference dangles or anything is unreachable. **Locate anchors by SHAPE** (varName, branch structure),
  never by id. `[C]`
- **Patch the live copy, never a stored older file**: manual IDE edits exist only in the live copy. For the
  same reason **never re-paste a full script "just in case"** — it silently reverts every IDE edit made
  after the dump.
- **Clone from live**: when a verified subtree exists, clone it (remap ids and `varBlockId`, edit only
  `varName`/`actId`) instead of building from constructors. GC unowned expressions and walk removed
  subtrees so no orphans remain.
- **Never re-derive JSON primitives from memory**. Grep session
  transcripts, unescape `\"`, copy real `CONST` / `argExprIds` / `branches`.
- User preferences: ONE request at a time (ask, wait for the copy, take the ids, ask again — no
  checklists); deliver WHOLE scripts/bodies, never fragments to splice by hand.

### Tooling that already exists

None of them is needed — every rule they apply is written in this section. They live in a PROJECT repository,
not beside this document; if the user has that folder at hand, prefer them over a checker written from scratch: a hat-stripper (drop the method hat, re-point
`startBlockIds`), a scope / dangling-reference / duplicate-variable / reachability checker, a canonical
id-free comparison of a generated fragment against a live copy (`canon-compare.bun.ts`), a formula
simulator and a script generator built on this section.
Every rule in this section is already encoded in one of them.

### Paste size — no limit found

Bodies up to 352 blocks / 791 expressions / 298 KB; processes up to 684 blocks / 1726 expressions / 554 KB,
all pasted without loss where read back. If a paste ever chokes, split into method + helper.

### What the IDE rewrites on paste

- **Every block and expression id is regenerated** (the start block id too) — a copy never matches the file
  by md5 and a key-by-key diff is worthless. `[C]` Exception: an out-of-fragment VAR_REF to a METHOD
  PARAMETER keeps its id on a body paste, unless carriers appear.
- **Serialization defaults differ** and are semantically irrelevant — normalise both sides before diffing:
  `canWriteValue:false`, `isTextMultiline:false`, `latitude/longitude:0`, `methodArgs:{}`, `more:{}`,
  `branches:{}`, `useArgNames:false`, long vs short `valueType` form, `baseType:null` vs absent. In
  `branches` the IDE drops `exprId:null` / `hasExpr:false`. An empty-string CONST loses its `value` key.
  Parameter display names differ (`text` vs `#текст#`); block x/y change. Direction depends on the
  generator: a body copy LACKED the defaults, a whole-process copy ADDED them.
- **CRITICAL — parameter types are lost on a body paste.** The body has no parameter declaration, so the
  IDE assumes the parameter is a number: `Пусть #остаток# = <bare param ref>` creates a
  NUMERIC variable and **every string assignment into it is silently dropped** (no error shown).
  **Fix `[C]`: initialise a text variable through a type-giving op —
  `'' Concat param` — as the first block, never a bare param ref.** Using the parameter as an argument of a
  String-typed actId is harmless; a variable typed by something else (e.g. an empty-string CONST) is
  unaffected. For a BO-typed parameter there is no such trick — pass the data another way.
- **Parameter carriers «Переменная №N»**: sometimes the IDE does not bind param refs in place but adds one
  `BlockNewVar` per referenced parameter at the top (`Переменная №N := <param>`) and rewires all uses to
  them. Frequent, not systematic in IDE pastes, trigger unknown `[U]`. **The server half is deterministic**
  `[C]`: `v2/script/paste` receives only `{copied}` — no target script — and for a body or a whole
  method with its hat it turns each VAR_REF to a method parameter into a DETACHED carrier
  `BlockFixEmpty → BlockNewVar «Переменная №N» = 0` (a Number CONST, not the parameter), and returns the
  body itself under a third `BlockFixEmpty`, not hung under the hat. Written as returned, that method
  computes with zeros. So for a method body that reads its parameters, **do not route it through `paste`**:
  write it with `apply-update-cmd` directly (`MYBPM-UI-API.md` §5g). The №-numbering often runs crossed relative to the
  parameters — **crossed NAMES alone are cosmetic; only the initialiser-vs-use binding matters**. Wrong
  bindings change the results of non-commutative ops (`5-3` → `-2`, `4/2` → `0.5`).
  Detection: match each carrier's initialiser **by parameter id** (stable) against how the body uses it,
  and always include non-commutative probes (`5-3`, `4/2`, `9^0.5`, `2<3`) in stand checklists. Fixes, both `[C]`: (a) correct the few initialisers at the top (correctly
  bound carriers are harmless); (b) delete the carriers and reconnect refs to the parameters — the next
  copy then has body + hat and no carriers.

### Validator phases — `translate-script` stops at the first failing phase `[C]`

The server
checks in phases and **reports only the phase that fails** — an error list is never the whole story, fix and
re-check until `{"success":true}`:
1. **Script structure**: `noEntryPoint` «Нет точки входа» (a hook body needs the `BlockFixEntryPoint` hat in
   the fragment — it pastes fine into a hook) and `blockIf__allBranchMustReturn__orContinueDownWithReturn`
   (a hook must END with `{"type":"BlockExit","exitType":"FROM_METHOD"}` — put it `downBlockId` of the last
   top-level block). A variable whose type has no ext type (`getPrintForms` of a record) fails here too.
   A binary `ExprOp` without `rightExprId` fails here as `exprOp_operandIdIsNull` «Не задан операнд номер 2
   в операции Plus», and the variable it initialises additionally as «Не указан расширенный тип
   (valueExtType == null)» `[C]`.
2. **Types**, all at once (17 in one list): a scalar added to / searched in a typed array
   (`illegalElementTypeForList`), `Readonly/Required/Shown -K-DYN-R-M-` need a user/department/group ref as
   argument, `SHOWN_BO_IN_CO_FIELD` needs a BO chosen as a CO attribute, `addFile_v2` wants a `File`, a
   filter kind not applicable to the field (`inapplicableFilter`), `sendToUsers` wants Person/PersonGroup/
   Department, the four `associateSingle*Ref*` of a spreadsheet tab need a reference main field.
3. **Read / write access, ONE error per run**: some properties are WRITE-ONLY — they may only stand on the
   left of `=` (`exprAct__readWayIsAbsent` «Нет действия на чтение у акта …») — and some are READ-ONLY
   (`exprAct__writeWayIsAbsent` «Нет действия на запись у акта …» when assigned). The catalogue carries NO
   read/write flag (`load-act-record-list` / `load-act-details` / the IDE bundle) — only this phase tells.
   `[C]`:

   | object | write-only | read-only | read + write |
   |---|---|---|---|
   | `RestRequest` | `sendingText`, `sendingXmlTag`, `sendingMultipartForm`, `sendingJsonDeck`, `sendingJsonArr`, `address`, `method` | `showHeaders` | `readTimeout`, `connectTimeout`, `writeTimeout`, `callTimeout`, `checkSslCertificate` |
   | `ElectronicTableBoTab` | `cellType` | | |

   So a REST call is written `запрос.адрес = …`, `запрос.Метод вызова = GET`, `запрос.отправляемый … = …`,
   then `#ответ# = запрос.#вызвать`; the request's own address/body cannot be read back. Properties of the
   other objects compile when READ; whether they are writable is unknown `[U]`.
4. **Java compilation** — the script is translated to `Main.java` and compiled (`compile:compiler.err.*`,
   `sourceMessage` carries the Java line; the `exprId` sits at the TOP level of the diagnostic, not in
   `messageArgs`). **Defect** `[C]`: the catalogue offers `saveBoiChanges` / `updateOpenedBoi` /
   `closeOpenedBoi` (`-K-FIX-T-BoiRefCode`) also on a BO type (`BoRefCode`), a field (`BoiFieldRefCode`)
   and a progress step (`ProgressStepRefCode`); phases 1-3 accept them, the compiler rejects them
   («BoRefCode cannot be converted to BoiRefCode»). Use them only on a record.
   Two `INFO` diagnostics `compile:compiler.note.unchecked.*` («uses unchecked or unsafe operations») come
   with a success and mean nothing.
Undo between attempts: `v2/script/undo {scriptModuleId, scriptId}` reverts the whole paste (one command).

**Every other catalogue act (454 of the 476) translates with `{"success":true}`** `[C]`; the rest are the
cases above — the `RestRequest` properties (phase 3's table), `ElectronicTableBoTab.cellType` (write-only),
`getPrintForms` (phase 1), `SHOWN_BO_IN_CO_FIELD`, `addFile_v2`, `sendToUsers` and the four
`associateSingle*Ref*` (phase 2 — they need arguments of the right kind, not a platform defect). Compiling
is not running: these translations say nothing about execution on a record.

### Verifying a pasted script

- **"The IDE showed no red" is NOT a check** — the IDE can silently drop expressions. Always copy back and compare
  structurally. **Structural equality is not runtime proof either**: some defects show only on the stand
  (§15) — a stand run is a separate step.
- **Counters first**: blocks / expressions / direct param refs of the copy vs body + hat (+ carriers).
  Catches carriers and lost expressions in seconds.
- **Scope sanity check before pasting**: on a stripped body the scope checker must report "variable out of
  scope" for EXACTLY the method's parameter ids and nothing else.
- **Canonical compare** — use the third form, the first two are superseded:
  1. renumber ids in visit order and diff — it breaks on ANY structural difference (a small insertion
     floods the diff with false lines);
  2. **id-free line pseudocode**: walk from `startBlockIds`, render expressions recursively, resolve
     VAR_REF → `varName`, map `CONST(String,'')`/`None` → `EMPTY`, drop the METHOD header and the defaults
     above, then `diff`. For methods with
     parameters: detect carriers on both sides, inline/skip them, try every permutation of parameter roles,
     **match roles by the parameter's ORDER in the signature, never by name**, and READ the per-parameter
     result rather than the "body matches" verdict.
- **Run the test suite against the read-back copy** (swap the live file in for the generated one) — that
  proves behavioural identity; keep the `pasted_<name>.json` copies as the authoritative snapshot. If the
  tests only hit error cases, a green run proves nothing — add a discriminating case.
- A copy proven identical while the stand still behaves the old way → suspect the method was not
  saved/published, or that a different method is called — not the code `[I]`.
- **Checker hygiene**: take every path from argv — a verifier with hard-coded paths can compare a file
  with itself and pass.

## 15. Runtime semantics of the built-in actions

### When each hook runs `[C]`

| action on the record | hooks that ran, in order | what is kept |
|---|---|---|
| open a NEW record | Открытие | written into the draft |
| change a field | Изменение поля (that field) — on EVERY change call, even the same value again or one the server then refuses | draft |
| save a NEW record | Добавление новой записи → Сохранение | draft + both writes land in the record |
| open an EXISTING record | Открытие | draft |
| save an EXISTING record | Сохранение (NOT «Добавление») | record |
| close/cancel an EXISTING record without saving | Закрытие | **its writes go straight into the RECORD**, while the discarded draft's edits — the «Открытие» write of the same session included — are lost |
| cancel a NEW record | — | nothing is created |
| save and close | no «Закрытие» | — |

- `onOpenFormScriptId` = Открытие, `onInstanceCreationId` = Добавление новой записи (runs at the first
  SAVE, not when the empty form opens), `afterSaveScriptId` = Сохранение, `onCloseScriptId` = Закрытие.
- **Only the FORM controllers run scripts** — `POST /web/v2/instance-form-create-draft/create-draft-with-boi`
  (new) / `…/create-draft` (existing), `v2/instance-field-form/save-field-value`,
  `v2/instance-form/validate-apply-remove-draft`, `v2/instance-form/remove-draft`; bodies and value
  formats: `MYBPM-UI-API.md` §6b. A record created through the plain record API (`create-draft`
  + `save-boi-value` + `apply-and-remove-draft`, `MYBPM-UI-API.md` §6a) runs none `[C]`, and **neither does
  an xlsx record import** `[C]` — neither for a created record nor for an existing one it updates (matched
  by its unique field): no «Добавление», no «Сохранение», no field script, every marker empty.
- A **test** script version runs only on test records (`boiState DEV`, the «Тестовые» tab); ordinary
  records run the **work** version. A BO whose only version is a test one runs nothing on ordinary records.
- **A field script fires on all 27 field types** `[C]` — `FILE_UPLOAD` (a real uploaded file),
  `CHECKLIST` (the item list) and `CO` (a composite row) included; value shapes: `MYBPM-UI-API.md` §6b.
- **Cancelling a NEW record headlessly = `delete-boi` then `remove-draft`** `[C]` — what the UI sends. A bare
  `remove-draft` of a new draft on a BO with a «Закрытие» script fails `RuntimeException … No boi with id`
  and leaves the draft behind (`MYBPM-UI-API.md` §6b).

Number/string facts below without a marker are `[I]`.

### Numbers are Java `BigDecimal`

- **`Eq` is scale-sensitive, `Less`/`More` are not.** `[C]` `Eq` behaves as `BigDecimal.equals()`
  (`2.0` ≠ `2`), `Less`/`More` as `compareTo`. Readings: `2.0 = 2` false, `4/2 = 2` false, `4/2 <> 2` true,
  `4/2 >= 2` true, `1+1.0 = 2` false (`Plus` carries the operand scale), `0.1+0.2 = 0.3` true (same scale).
  A divisor guard `Eq 0` lets `1 / (0.5 − 0.5)` (= `0.0`) through to native division.
  **Rule: never compare numbers with `Eq`.** Equality = «not `l < r` and not `l > r`»; a zero test = not
  less and not more than 0; `>=` = «if `l < r` then false else true», `<=` mirrored via `More`.
  Any `Eq` guard inherits the defect: `x = 0` misses `0.0`, `y = intPart(y)` rejects
  `2.0`. An off-stand decimal simulator is scale-insensitive and can NEVER reproduce this — only the stand can.
- **Native division: scale 30** (30 digits after the point), **no exception** on non-terminating quotients
  (`1/3` → `0.333333333333333333333333333333`, `4/2` → `2.000000000000000000000000000000`). `[C]`
- `Div` keeps full precision; what a number FIELD shows is the field's display format (`1/3*1000000` →
  `333333.333`). `[C]`
- Multiplication is exact `[I]`; a negative integer power computed as `1 / pow_int` carries hundreds of
  digits until the division rounds to 30 dp (`1.015^(−240)` worked) `[C]`.
- **`#Округлять дробную часть: N` is `setScale(N)`**: `round(1/3, 2)` → `0.33`; rounding to 12 leaves scale
  12 (`3.000000000000`). `[C]`
- `#Взять целую часть` truncates **toward zero** and normalises the scale (`int(9/2)` → `4`); behaviour on
  negative inputs is unknown `[U]`.
- **Division by zero: platform behaviour unverified** `[U]` — guard divisors with Less/More.
- Native number actions have no error channel; on huge arguments the IDE aborting the calculation is `[I]`.
- `Less`/`More` on a TEXT value would compare lexicographically (`"10" < "9"`) `[I]` — wrap both sides in
  `#В число`.

### Number ↔ text

- **`'' ⊕ число` is Java `BigDecimal.toString()`**: it keeps the scale (`3.000000000000`) and switches to
  scientific notation when the adjusted exponent < −6 — `0 / 100` → **`0E-30`**. `[C]` Any code parsing
  numbers out of text must accept an exponent
  (`^[-+]?[0-9]+(?:\.[0-9]+)?(?:[Ee][-+]?[0-9]+)?$`) or normalise zero.
- **No native "strip trailing zeros" is known** `[U]`. Working trim: guard `^[-+]?[0-9]+\.[0-9]+$` (a dot
  must be present, else `10` → `1`), strip zeros, drop a dangling `.` `[C]`.
- `#В число` parses `3.000000000000` fine. Strictness on spaces/empty strings is modelled as Java
  `new BigDecimal(String)` `[I]`; the decimal separator must be a DOT (`1,5` not recognised) `[U]`.

### Strings

- **`#Заменить(что, чем, всё)` replaces LITERALLY, not by regex**: `"a1b2".#Заменить("[0-9]","")` → `a1b2`.
  `[C]` A naive per-name replace corrupts longer names (parameter `n` inside `min`).
- **`#Подстрока` indices are 0-based**, end exclusive (Java-style `[I]`).
- **`#Подстрока` with `start >= end` does NOT return `""` — it returns the WHOLE string.** `[C]` Chopping a tail with `#Подстрока(хвост, 1, #Длина)`
  leaves a 1-char tail unchanged. **Guard: `ЕСЛИ конец > начало : … ИНАЧЕ : target = ""`.**
- **String `Eq` is case-sensitive** and nothing folds case (`Parameter.MRP+1` → 4326, `Parameter.mrp+1` →
  error). `[C]`
- Idiom: `('' ⊕ #код#) Eq #токен#` forces a text comparison when the operand type is unknown.

### Regex = `java.util.regex`

- No recursion `(?&name)`, no `(?(DEFINE))`; regex101 in PCRE2 only for experiments. Case-sensitive, no
  flags used. **Always anchor `^…$`** — whether `#Регулярка?` is matches- or find-semantics is unknown `[U]`.
- **A `PatternSyntaxException` is SWALLOWED**: the block returns `Нет` instead of erroring, so a broken
  pattern looks like "never matches". `[C]`
- Building a character class from data: inside `[…]` a `-` between two chars is a RANGE (`+-*` → `bad
  character range`; same risk for `]`, `^`, `\`), so escape punctuation — `"\" ⊕ #символ#` gives
  `^[^\+\-\*\/() ]$` for any order. **But never backslash a LETTER**: `\o` → `Illegal/unsupported escape
  sequence`, `\a` = BEL, `\d` = digit class — word operators (`or`, `and`) broke a method that way. The fix
  splits symbols by shape: single punctuation → escaped class member, words → alternation `^(?:A|B|…)$`.
  `[C]`
- Word-shape test that works: `^[A-Za-zА-Яа-яЁё_].*$`. A 21-alternative group worked in a pasted process.
- The `regExp` argument accepts a VARIABLE `[C]`; a method cannot be called inside a regex.

### Booleans and checkboxes

- **`Eq` between Bools answers right in every form** `[C]`: a computed Bool variable (`Пусть #ложь# = 1 > 2`)
  against `CONST no` / `yes`, two constants, a CALLED METHOD's Bool return value against `CONST no` / `yes`
  (directly and through a variable), and the gate `ЕСЛИ (Eq <метод>(), Нет) → Выйти из метода` — it fires and
  the statements after it do not run.
  **Style: test a boolean as `ЕСЛИ #переменная#` (`ifExprId` = VAR_REF or the call itself, else branch
  `exprId:null`)** — shorter than `Eq` against `Да`/`Нет`; an early exit from a branch and `FROM_CIRCLE`
  inside loops are fine.
- `Or`, `Xor`, `Not`, `LessEq`, `MoreEq`, `OrEq`, `AndNotEq` run correctly on a record `[C]` (§12a) — no need
  for nested IFs.
- A checkbox's value act as a bare IF condition fires both ways `[C]`. Concatenated into a text it gives `true` / `false` `[C]` — the same as a
  computed Bool (`'' ⊕ (Да Or Нет)` → `true`); not `yes`, `Да` or `1`.

### Control flow and program structure — hard limits

- **`ИНАЧЕ ЕСЛИ` executes exactly ONE branch** of the chain; "try each candidate until one matches" must be
  written as independent sequential `ЕСЛИ` blocks.
- **No while-loop** — counted loop and foreach only; a counted loop with a pass cap guards
  recursion/fixed points. The bound is evaluated once on entry and the
  counter runs from 1 `[C]` (§12): changing the bound's variable inside the body does not shorten the loop —
  leave it with `Выйти из цикла`.
- **No arrays** (hence no stack). **No dynamic dispatch**: a method cannot be called by a name taken from
  data `[C]`, a dictionary field cannot hold a script — one explicit branch per operation.
- **No iteration over the fields of an instance, nor over BO codes**: each field read is a compiled
  `ExprAct` with its own actId, so a name → field mapping is written out (one IF per field) and a field
  newly added to a BO is invisible to such code until the code is extended.
- **`findByFilter` reads a dictionary row at runtime** `[C]`; matching by `code` is case-sensitive.

### Idioms

- **Bounded while**: `ЦИКЛ i : "200"` + `Выйти из цикла` on the exit condition. `[C]`
- **Bool as condition**: a Bool variable (or a Bool-returning act such as `isEmpty`,
  `doesItMatchARegularExpression`) directly as `ifExprId`, no `= Да`; its complement is a bare «Иначе», not
  `Eq(x, Нет)` — shorter, and `Eq` on Bools works too (§15).
- A Number 0/1 flag where an "is it set" test is needed inside an elif chain.
- **Substring guard**: `ЕСЛИ конец > начало : target = #Подстрока(src, i, j) ИНАЧЕ : target = ""`.
- `'' Concat <параметр>` as the first block of a body to pin a String type (§14).

## 16. Business-process scripts

- A process script starts with `BlockFixEntryPoint` (the «ТОЧКА ВХОДА» hat). Unlike method hats it pastes
  together with its hat, and it must be the LAST fragment put into the clipboard. `[C]`
- The process record's own fields are reached through `THIS_PROCESS` (IDE: `ЭТОТ_ПРОЦЕСС`), an
  `exprValueType: ExprValue` with `constType:"BoiRefCode"`: `THIS_PROCESS.F-step`, `.F-error_code`,
  `.F-request`, … each via `F-<field>-K-DYN-S-boi_fields`.
- A process script can create a new BO instance and fill its fields.
- **Failure path**: set an error-code reference (`~Код ошибки~.#Значение = <BoiRefCode>`), then `BlockExit`
  with `exitType: "FROM_METHOD_BY_ARROW"` and the `targetArrowId` of the error arrow.
- A process JSON round-trips paste → copy with only the entry block's x/y changing. `[C]`
- **How a figure's script leaves it** `[C]`: a **Script** figure (one outgoing arrow) ends in `{"exitType":"FROM_METHOD","type":"BlockExit"}`
  («Выйти из скрипта»); a **Switch** figure (several NAMED outgoing arrows) ends every path in
  `{"exitType":"FROM_METHOD_BY_ARROW","targetArrowId":"<one of ITS OWN arrows>","type":"BlockExit"}`
  («Выйти из скрипта по стрелке: <name>»). The IDE offers exactly that split — a Switch has no plain exit,
  a Script no exit by arrow. **The validators do not enforce it**: the swapped forms and an arrow of
  another figure pass `translate-script` and `validate-def`; only a missing `targetArrowId` fails
  («Не указан targetArrowId»). Write only what the IDE would offer. The arrow ids of a figure:
  `v2/script-browser/load-exit-variants` (`MYBPM-UI-API.md` §5g); in an archive they are the `arrows` keys of the
  `BoProcessVersionsStructDto` whose `startFigureId` is that Switch.
- **A Switch with a condition** `[C]`: the process field «Заявка» (`Zayavka`, a BO reference) points at a record with a CHECKBOX
  «Одобрить» (`Odobrit`); the Switch reads it and leaves by one of its two arrows:

  ```json
  "blocks": {
   "<hat>":  {"x":40,"y":40,"downBlockId":"<if>","type":"BlockFixEntryPoint"},
   "<if>":   {"ifExprId":"<e4>","thenBlockId":"<exitYes>",
              "branches":{"<br>":{"blockId":"<exitNo>","order":10}},"type":"BlockIf"},
   "<exitYes>":{"exitType":"FROM_METHOD_BY_ARROW","targetArrowId":"<arrow «Да»>","type":"BlockExit"},
   "<exitNo>": {"exitType":"FROM_METHOD_BY_ARROW","targetArrowId":"<arrow «Нет»>","type":"BlockExit"}},
  "expressions": {
   "<e1>":{"exprValueType":"THIS_PROCESS","constType":"BoiRefCode","type":"ExprValue"},
   "<e2>":{"leftExprId":"<e1>","actId":"F-Zayavka-K-DYN-S-boi_fields","type":"ExprAct"},
   "<e3>":{"leftExprId":"<e2>","actId":"F-Odobrit-K-DYN-S-boi_fields","type":"ExprAct"},
   "<e4>":{"leftExprId":"<e3>","actId":"F-VALUE-K-DYN-R-D-S-boi_fields","type":"ExprAct"}}
  ```

  IDE reading: `ЕСЛИ ЭТОТ_ПРОЦЕСС.Заявка.Одобрить.#Значение ТО выйти по стрелке: Да ИНАЧЕ выйти по
  стрелке: Нет`. A field of the REFERENCED record is reached by applying its
  `F-<code>-K-DYN-S-boi_fields` straight to the reference field (no `#Значение` hop in between, as §12a
  says for a single link); the boolean is tested bare (trap 22); the `ЕСЛИ` has no `downBlockId`, because
  both of its branches are exits. The condition is evaluated at run time («Одобрить» = Да → Exit «Да»,
  = Нет → Exit «Нет»). The value read is the one saved at the moment the Switch runs.
- **Arrow slot names differ per figure** `[C]`: Enter/Exit `main`/`top`/`bottom`; Switch
  `up`/`right`/`down`/`left`; Script and Timer `left`/`right`/`top`/`bottom` + the four corners
  (`topLeft`…); Form = Script's without `bottom` plus `timerCreate`/`timerOpenForm`/`timerTouchDraft`;
  Terminator `left`/`right`/`top`/`bottom`; SingleToParallel `in` + `out1…N`, ParallelToSingle `out` +
  `in1…N`. A wrong name on a Switch falls back to `up`, on a Script/Terminator to `top`, on a Form/Timer to
  nothing — use the real names (full table: `MYBPM-UI-API.md` §5f «Slots»).
- **How a process runs** `[C]`: it **starts when a record is first SAVED** (not when the form opens); Enter passes at once;
  a **Form** step stands (status «В ожидании») **until the record held in the Form's BO field is saved**,
  then the process runs on through Script / Switch to the Exit, and the status becomes «Завершён».
  **What a Script / Switch figure writes is saved when the figure is left** (its exit block) `[C]` — no
  `#Сохранить`, no card save. **A card that is open does not show such a write** until it is reopened — the
  client never refreshes a record by itself `[C]`; a process can push a refresh of one record to one user
  with a dedicated method `[C]` (its name `[U]`).
  **The Form binds to the record that is in the field WHEN THE STEP BEGINS.** A field filled later is never
  watched, and the step stays stuck. So the design rule is: fill a Form's field before the process gets
  there, either in the record's first save or in a Script placed before the Form. **The save that
  releases a Form must CHANGE a value** of that record `[C]` — opening and saving it
  unchanged (or re-sending the stored value) leaves the step standing. The start is asynchronous: the
  steps can still be empty right after the first save. A test version runs only
  on test records, and their reference fields list only test records `[I]`. The run-time API and the
  manual unstick («Продолжить принудительно» = `push-step-forcibly` on the stuck step's OUTGOING arrow):
  `MYBPM-UI-API.md` §5f «Running a process on a record».
- **A Timer** `[C]`. The figure watches ONE date field of the process (`FULL_DATE`; the editor stores
  `fieldId`, the archive `archetype:"DYNAMIC", fieldCode`, §5c). When the process ENTERS the Timer it reads
  that field once: a future date → the step stands until then; an EMPTY field or a date in the PAST → it
  passes at once. It fires 10–40 s after the due time (a scheduler tick): the step goes `STAND` →
  `WAITING` (due, not yet fired) → `PASSED`. **Changing the field on the record while the Timer stands
  does NOT move it** — a save setting it into the past leaves the step standing until the ORIGINAL due time.
  Setting the date in a Script right before the Timer is the pattern:
  `ЭТОТ_ПРОЦЕСС.Пауза.#Значение = Сейчас.увеличить(1, минуты)` →

  ```
  {"<assign>":{"leftExprId":"<Пауза.#Значение>","rightExprId":"<inc>","downBlockId":"<exit>","type":"BlockAssign"}}
  "<now>":  {"exprValueType":"CONST","constType":"JavaObjectFactories","objectDescriptor":"BEAN_METHOD-DateExtensions-now",
             "valueType":{"type":"Object","baseType":"Date"},"type":"ExprValue"}
  "<inc>":  {"leftExprId":"<now>","actId":"F-incDate-K-FIX-T-Date","argExprIds":{"amount":"<1>","unit":"<MINUTES>"},"type":"ExprAct"}
  ```

  (`amount` a `BigDecimal` constant, `unit` a `DateDeltaUnit` enum constant — shapes in §12.) **`#Обновить
  таймер для процесса` is NOT needed before a Timer** — the Timer fires without it. What it is for, per
  the platform's own description: after changing the date of a Timer that is ALREADY standing, call it on
  that field to move the schedule — `[C]` (e.g. from a parallel branch). A script's
  assignment alone does not move a standing Timer, exactly like a save from the form. Calling it right
  before the Timer is harmless (it fires on time).
- **Parallel branches** `[C]`. A
  **SingleToParallel** (`outSlotsCount: N`, exits `out1…outN`) starts EVERY branch at once. A
  **ParallelToSingle** (`inSlotsCount: N`, entries `in1…inN`, exit
  `out`) is a real join: its step appears as `STAND` as soon as the first branch reaches it and passes only
  when the LAST one arrives. One step per figure, all `PASSED`; a Timer in one branch does
  not hold the others. In the archive they are `FigureSingleToParallelStruct {outSlotsCount}` /
  `FigureParallelToSingleStruct {inSlotsCount}` (§5c) `[C]`.
- **A Terminator ends the WHOLE process, not just its branch** `[C]` (API and archive): the moment one branch
  passes a Terminator, **a step standing in another branch (e.g. a Timer) turns `PASSED` with no next
  step** — the figures after it never run, not even after the Timer's due time; a step entered right after
  the Terminator is closed at once. `load-process-steps` shows nothing
  special: the cut Timer is just `PASSED`, `nextProcessSteps: []`, no diagnostic message. (The
  record's `PROCESS_STATUS` after it is NOT readable this way — `load-boi-values` answers `""` for any
  reference field of a process record, a record ended by an Exit included.) Use it for «stop everything»
  (e.g. a cancel branch); an Exit ends only ITS branch (next point).
- **An Exit inside one branch ends only that branch** `[C]`. A process may have SEVERAL Exits —
  `validate-def` is clean with two, no join needed. Unlike a Terminator, an Exit closes only the branch
  that reached it, and the other branches run to their own end.
- **A Point is a bend on an arrow, nothing more** `[C]` (API and archive): the
  editor makes it with «Вставить точку» in an arrow's context menu, which CUTS the arrow in two — the old
  arrow now ends at the Point, a new one leads from the Point to the old target. At run time it is a step
  of its own that passes in the same instant (`PASSED`, one prev and one next step, no script, no
  delay): the figure behind it runs as if the arrow were whole. Use it only to route arrows on the
  diagram. Shapes: §5c (archive), `MYBPM-UI-API.md` §5f «Point» (editor).
- **The same three facts through an ARCHIVE** `[C]`: `tools/process-exit-branch.spec.json`
  (with the Point) → `make-probe-archive.bun.ts --process-spec … --process-status …` → import → on an
  ORDINARY record an Exit in one branch leaves the other branch's Timer standing, `#Обновить таймер для
  процесса` reschedules that Timer, and a Point passes through. The act id `F-updateTrapDate-K-FIX-T-BoiFieldRefCode` is FIX, so it travels as is.
- **A configured process from a spec, headlessly** `[C]`: `tools/process-builder.ts` builds
  fields + figures + named arrows + Script/Switch bodies (the JSON above, generated) through the
  constructor API and runs both Switch branches on test records. This is the
  API route (`MYBPM-UI-API.md` §5f point 6). **The archive route for the same spec is `[C]` too**
 : `make-probe-archive.bun.ts --process-spec` → import → both branches on DEV and ordinary
  records — the script bodies above travel as `ScriptDefStructDto` with `@class` names, and the one trap
  is `PROCESS_STATUS`'s `defaultValue` (§5c).

### Verifying on the stand

- **Test card**: a BO card with an input field, an output field and a button whose script calls the methods
  (e.g. fields «Формула» / «Ответ», button «Вычисление», script
  `Ответ.#Значение = calculate(formula: Формула.#Значение)`) runs any method on the stand without the
  process. `[C]`
- **Split every checklist by ENTRY POINT.** A test card exercises ONLY the methods its button calls;
  anything the process does in its own context (variable substitution from process collections, step loops,
  process-level branches, error codes, reads of the record's fields) is verified ONLY by running the
  process on a real record. A mixed checklist gives a false "works". Also: a card that composes a pipeline by hand (`f(g(x))`) can pass on
  old code — keep the card wired to the bare entry point under test.
- **Proving a step condition is evaluated**: run the same step with the condition and with its opposite; a
  difference in whether the step executes proves evaluation (identical outcomes mean the condition is
  ignored).

---

## 17. Traps and defects — the short list

Archive:
1. `dynamicFields` is an object, not an array.
2. `0000001.mybpm` is JSONL — never parse the whole member.
3. An export contains only what was selected, and only as of that moment.
4. Import MERGES: to unset something write the flag `false`, never drop the key.
5. An `AccessStructDto` REPLACES the stand rights, group ids included (`G-<id>` of the target stand); an
   archive without it leaves them alone, it does not wipe `orgUnitIds` (§8).
6. A group line WITHOUT `code` renames one fixed stand group and all BOs land there; groups are matched
   by `code`, never by name (§0.3, §8). Rollback does not undo the rename.
7. `removeType: STRIKETHROUGH` is on every field and means nothing.
8. `oldRefBoId` never equals the target's `oldId` — not a bug.
9. Built-in codes `Person` / `Department` / `PersonGroup` are reserved; a clash fails the whole import (`Company` — the
   «Аккаунт» BO, invisible to every login but `root` — never use it either; whether it clashes is `[U]`).
10. The form grid compacts vertically — holes are eaten and rows drift.
11. A STATIC_TEXT section heading must not repeat a field name (breaks Excel import).
12. `required + readonly` together makes a record unsavable.

Scripts:
13. `wl-copy` without `--type text/plain` → the paste is silently ignored; a script ending in `wl-copy`
    hangs its caller.
14. A method hat never pastes; an entry point in the clipboard blocks method pastes.
15. A body paste types every parameter as a number — string parameters need `'' Concat param` first, or
    assignments vanish without an error.
16. Parameter carriers «Переменная №N» can bind arguments to the wrong roles (only non-commutative probes
    catch it); the server `paste` always makes them, initialised to 0 — write a method body that reads its
    parameters by `apply-update-cmd` instead (`MYBPM-UI-API.md` §5g).
17. The IDE regenerates every id — diff structurally (id-free pseudocode), never by key.
18. "No red in the IDE" proves nothing; structural equality proves nothing about runtime.
19. Never compare numbers with `Eq` (scale-sensitive); `0/100` prints as `0E-30`.
20. `#Подстрока` with `start >= end` returns the whole string.
21. `#Заменить` is literal, not regex; a broken regex silently returns `Нет`; never backslash a letter.
22. Test a boolean as a bare condition — shorter than `Eq <Boolean>` (which also works, §15).
23. Expressions must be a strict TREE, never a DAG (each expression referenced exactly once — the IDE warns
    «…операнд номер 1, который уже ранее использовался»), and a variable name is unique across the whole
    METHOD, foreach element names included.
24. Never re-paste a whole script "just in case" — it reverts every IDE edit made since the dump.
25. Never assume a primitive is missing — ask for a palette screenshot. Never guess an actId — have the
    user build the block and copy the JSON. The palette
    need not be guessed at all: §12a is the complete catalogue, read off the stand.
26. **An enum value the server does not know bricks the BO** `[C]`.
    A script def is stored as sent — `apply-update-cmd` (and, by the same storage, an archive) writes
    e.g. `"opType":"GreaterEq"` without complaint. From then on the server cannot decode the BO's script
    module: `translate-script`, `load-script-def`, `load-bo-scripts` of EVERY version (work included),
    `load-bo-script-versions`, `apply-update-cmd`, `undo`, `delete-local-method` and
    `remove-bo-script-version` all answer `IllegalArgumentException: No enum constant …OpType.GreaterEq`
    — so the bad value cannot be overwritten either. Other BOs' scripts keep working. No API or import repair exists — deleting the BO leaves its script module behind,
    still broken; `save-bo-scripts`, `copy-bo-script-version`, `unset-in-work-version` and a blind
    `apply-update-cmd` that `Set`s `blocks`/`expressions` to `{}` all decode first and fail; a structure import
    carrying the BO's scripts is refused at `apply-import` with the same 500 while the BO exists (import status
    stays `ANALYZED`; a structure-only archive of the same BO applies), and after deletion it applies — the BO
    comes back under its old id with a new script version — yet the versions still do not decode, and on that live BO the re-wiring calls and an archive with the broken module id as prefix fail the same. It needs
    the vendor (database): the defs are embedded in the ONE MongoDB document of the script module, and changing that
    `opType` value in that document (`GreaterEq` → `MoreEq`) repairs it `[C]` (`MYBPM-UI-API.md` trap 49). Hence: every enum-typed key (`opType`, `exitType`, `exprValueType`,
    `constType`, block/expression `type`, `varType`) takes ONLY a value listed in §10–§12a — a
    string-typed key (`actId`, `enumValue`, `varName`) is safe to get wrong, the validator reports it.
    **A wrong SHAPE is the same trap** `[I]` (not reproduced on purpose — it is unrepairable):
    `ExprCall.args` written as `{"<paramId>":"<exprId>"}` (a string) instead of
    `{"<paramId>":{"exprId":"<exprId>"}}` in a COMPANY-GLOBAL method left the global module undecodable
    («Failed to decode 'ScriptModuleDto'») — the «Глобальные методы» list stopped loading, every process's
    `validate-def` failed and figure scripts could no longer be edited. Copy every object-valued key
    (`args`, `argExprIds`, `branches`, `more`, `params`, `valueType`) from §10–§11 exactly.
27. **A record written through the plain record API runs no script** `[C]` — hooks and field
    scripts run only inside the form controllers (`MYBPM-UI-API.md` §6b). Testing a hook with
    `save-boi-value` shows «nothing fired» and proves nothing.
28. **A test script version runs only on test (`DEV`) records** `[C]` — a freshly wired test version looks
    dead on ordinary records until `in-work-bo-script-version`.
29. **«Закрытие» writes into the saved RECORD, not into the draft being discarded** `[C]` — and it does not
    run on save. Do not use it to «undo» the form; do not expect it after СОХРАНИТЬ.
30. **An import of scripts onto an existing BO with an EMPTY script module fails** `[C]` — `apply-import`
    answers «Нет скриптов для экспорта у БО с кодом …», the import stays `ANALYZED`, its process never
    runs (§5d «Local methods travel»). Check the `apply-import` answer before polling.
31. **One `translate-script` coincided with a ~30-s 502 of the whole stand** `[U]` cause (a
    hook whose only statement calls a local method, `BlockAssign` + `ExprCall`, args `{}`). Not repeated.
32. **A `DROPDOWN_SINGLE` without a kanban card template kills the map and the kanban** `[C]` — an
    archive BO with `kanbanCardTemplates: {}` and a dropdown answers «cardTemplate is null» in its «Карта» view,
    its kanban and the constructor's kanban editor once it holds a record. Ship a template per dropdown (0.14);
    a re-import with one repairs the BO.
33. **The registry «Группировка» is dead** `[C]` — the server answers 404 to its data calls;
    `isGroupingEnabled` / `groupingInfo` store and travel but nothing renders (§2 «BO views»).
34. **An import of «Выставление сервисов» replaces the whole list; its rollback leaves dead rows** `[C]`
    — §2 «Exposed services».
35. **A freshly created BO's first script version is blind for a few seconds** `[C]` — right after the BO is
    created, the one version `load-bo-script-versions` returns has an empty `load-bo-def-list`, so every field act
    written then fails `translate-script` and the hook cannot be published. Wait until the list fills, then write
    (or re-translate) in that same version (`MYBPM-UI-API.md` §5o, trap 68). A BO whose scripts came in by archive
    is not affected.
36. **A service file answer needs a file name with a known extension** `[C]` — `x.xyz` or a bare `x`
    fails with `NoFileMimeType` inside the «Создание» script and the service answers 500; with a known extension
    the response Content-Type is taken from it, not from RESULT_CONTENT_TYPE (§2 «Exposed services»,
    `MYBPM-UI-API.md` §5o, trap 69).
37. **A company-settings import replaces some kinds, merges others and only half-overwrites AUDIT_TRAIL** `[C]`
    — OFFLINE / MOBILE / LANGUAGES / SCRIPT_SETTINGS replace (a language left out of the map is switched
    off), PHYSICAL_REMOVAL upserts and never removes, AUDIT_TRAIL overwrites the FIRST audit row whatever its journal,
    MESSENGER does nothing without a connected messenger. Ship a kind only from a fresh export of the target stand
    (§2 «The other company-settings kinds»).
38. **On a test (`DEV`) record a script's link fields hide every ordinary record** `[C]` — `BO` and `CO`
    collections read empty (`F-COUNT` 0), only DEV children are seen; a script that «finds nothing» on a test
    record may be right. Test link logic with DEV children or on an ordinary record under the work version (0S.7).
39. **A child's field written by a script is lost when the parent form is cancelled** `[C]` — it is stored
    only with the parent's save, unless the script calls `#Сохранить` on the child, which stores it at once,
    cancel or not (0S.7).
40. **Re-importing a stand export onto the BO it came from is not a no-op** `[C]` — it ADDS a copy of every
    print form (forms are matched by `newId`, which every export renews), clears a SIGNATURE's phone and never
    brings back `massPrintFormCodes`; a rollback of it adds yet another print-form copy (0.13 «SIGNATURE
    round-trips», «Print forms»; `MYBPM-UI-API.md` §5 «Rollback trap»).

Records (Excel): the traps of that format live in `MYBPM-UI-API.md` §11 (8 — numeric cells, 9 — header
detection, 10 — never index columns by position, 13 — the SINGLE-side link column) and are not renumbered
here; the rules themselves are §0X.4.

## 18. Open questions

- SIGNATURE: what clears `signFieldUnsupported` («такой-же тип подписания») on a referenced BO — nothing on
  the stand does (`MYBPM-UI-API.md` §5i), so only the vendor can answer; until then `massPrintFormCodes`
  never survives an import (§0.13 «SIGNATURE round-trips»).
- `[U]` Whether a reference to an ordinary user BO of the stand also resolves by `boInfo.code` with a foreign or
  empty `oldRefBoId`, as a `Person` reference does (§6) — check: export a BO with such a reference from one company,
  import it into another that has a BO of the target's code, read the field's `refBoId`.
- The storage format of a `Date` constant, and which output each swapped `DatePattern` label really gives.
- Whether a CO element's `#Сохранить` stores the SOURCE record, and whether `F-ADD` on a CO field accepts
  a record of a BO that is not one of the composite's sources.
- `[U]` A re-import of a fresh export with one field's `type` or `code` changed (same `newId`), or the BO's
  `category` changed (same `oldId`) — check: import it, read `load-business-object-by-id` `formFields[]` / `boCategory`.
- `[U]` A composite re-import with one attribute relabelled and one dropped, or a source dropped — check: import,
  read the composite's fields in `load-business-object-by-id`.
- `[U]` Whether an import applies `tableWidth` — check: change it in an export, import, read the field back.
- `[U]` Scalar `defaultValue` / `defaultValueMap` (text, number, date, checkbox) — check: set one in the
  constructor, export, re-import onto a copy, open «Добавить» and read the draft value.
- `[U]` The shape and effect of `calendarCardTemplates` and `timelineTemplates` — check: set each in the
  constructor («Календарь» hover card, «Диаграмма Ганта» columns), export, re-import onto a copy.
- `[U]` A field added to a built-in BO (Person) through its archive line — check: on a scratch field, export
  Person's structure if the basket offers it, append a field, import, read `load-business-object-by-id`.
- `[U]` A key that sets the order of dictionary rows in a dropdown (0.5b) — check: ship rows with an `orderIndex`
  at the line level, open the dropdown.
- `[U]` Whether a re-import UNWIRES a hook it omits / nulls in `workScripts`, or REMOVES a local method it
  drops from `methodScriptIds` — check: re-import so, read `load-bo-scripts` and `list-local-methods`.
- `[U]` A process's local methods in `methodScriptIds` of `BoProcessVersionsStructDto` — check: create one with
  `bo-process-editor/create-local-method` `P {boProcessId, methodName}`, call it from a Script figure, export.
- `[U]` Form timers: whether they fire, and their keys in the typed struct — check: arm `createTimer` 1 min on a
  DEV process, watch `load-process-steps`; export and read the `FigureFormStruct`.
- `[U]` Renaming a global or local method (same `scriptId`, new `methodName`) — check: re-import so, run
  `translate-script` on a caller.
- `[U]` Whether a re-import with another `parentMenuItemCode` moves an existing menu item, and what
  `needHideInMobApp` / `needCountMenuItem` `true` do — check: re-import so, read `v2/menu-item/load-nav-items`
  and the sidebar on the web and mobile clients.
- `[U]` Rights flags head / employees / department / parent-child department (§7) — check: a second non-admin
  login, one flag at a time, count the records it sees.
- `[U]` Settings kinds `TELEPHONY`, `IN_MIGRATION`, `OUT_MIGRATION`, `APPEARANCE` (§2) — check: needs a stand with
  a telephony provider / Kafka; export, re-import, read the settings page.
- `[U]` Run time of `#Удалить` / `#Архивировать` / `#Восстановить` / `#Дублировать` (§12a) — check: a BUTTON
  script on a probe BO calling each, then read the record's state in the registry filters.
- `[U]` «ПРЕКРАТИТЬ» in the import dialog — which status it leaves (`MYBPM-UI-API.md` §5) — check: press it on a dry run, read
  `load-import-file-records`.

---

# Part III — Records (instances) as Excel

Records never travel in a structure archive: a `.mybpm.zip` carries the SHAPE of a business object, an
xlsx carries its ROWS. The transport — the registry kebab «импорт/экспорт xlsx» and the `v2/bo-transfer`
routes — is in `MYBPM-UI-API.md` §6 and §0U R7; **this part is the file itself**.

## 0X. COOKBOOK — produce an importable xlsx from this section alone

**Read this part if your job is «fill me a file that loads these records into BO X».** Like §0 and §0S it
is self-contained for the FORMAT; unlike them it cannot start from a blank page — the file is always a
FILLED-IN TEMPLATE taken off the stand, never a sheet you compose. That is the first thing to ask for.

What a model invents when it skips the reading, by class — each one fails rows or the whole file:

| Class | Invented | Real | Where |
|---|---|---|---|
| Source | a sheet composed from scratch | the stand's own template or export, filled in | 0X.1, 0X.3 |
| Cells | numeric or shared-string cells | every cell `inlineStr`, numbers and dates as text | 0X.4 rule 1 |
| Columns | columns by position; a bare sub-header («Почта») | the (block, field) label pair; the target's label with its tab prefix | 0X.4 rules 3, 11 |
| Values | a dropdown by code or by a value the dictionary lacks; a reference to a row of the same file | the label of an existing value; targets already on the stand | 0X.2 steps 3–4, 0X.3 |
| Links | a column for the SINGLE side of a linked pair; a child edited through a nested block | the TABLE side; the child's own file | 0X.4 rules 4, 10 |
| Updates | a blank cell meaning «leave as is» | a blank cell erases; drop the column to keep the field | 0X.4 rule 7 |
| Stand data | the unique field or the dictionary values guessed | asked for (0X.3) | 0X.3 |

### 0X.1 The artefact

An `.xlsx` whose bytes come from the stand's own template or export, with data rows appended:

- one sheet, `Sheet0`; **every cell `t="inlineStr"`**, `sharedStrings.xml` empty — numbers, dates and
  codes are all TEXT (a numeric `103` comes back «103.0» and breaks a unique-field lookup);
- the header is row 1, or rows 1–2 when the BO has a nested object (block caption over sub-headers), and
  the importer finds it **by the frozen rows** (A2 / A3) or by a double bottom border in column A —
  a sheet with neither dies with `kD4QsxZrAY` «Система не может отделить строки заголовка от строк данных»;
- an Excel table part `xl/tables/table1.xml` rides along in stand files; keep it consistent with
  `dimension` (the xlsx-library traps are 19.9).

### 0X.2 Algorithm

0. **Ask for the stand data of 0X.3.** Without the template file itself there is nothing to fill.
1. **Take a FRESH template** — an export of the registry (registry kebab → «импорт/экспорт xlsx»); the
   API route is `MYBPM-UI-API.md` §0U R7.
   Columns follow the BO at export time and their positions move between exports.
2. **Build the column map by LABELS, never by position**: the (row-1 block, row-2 field) pair identifies a
   column. Split a row-1 label on the FIRST dot — the prefix is the tab («Системные.Код»).
3. **Fill the rows.** Values: checkbox `Да`/`Нет`; date `dd.mm.yyyy` with a four-digit year (parsed leniently —
   `31.02.2026` silently becomes 03.03.2026, 19.6 `[C]`); date-time `25.10.2025 10:33`; period
   `dd.mm.yyyy - dd.mm.yyyy`; a dropdown is matched by its LABEL; a reference by the target's unique field
   or by an `ID` sub-column. A TABLE nested object = the parent row REPEATED per child. A nested block
   only LINKS: its other sub-columns are never written into the child (19.6) — to change a child, import
   the child's own file.
4. **Order the files** when there is more than one: users → groups → dictionaries → records → link files.
   A reference resolves only against records that were on the stand BEFORE the file — never against rows
   of the same file.
5. **Read the finished xlsx BACK** and rebuild the data model from its cells (labels → codes).
6. Hand it over as in 0X.6 — and remember the import is TWO-PHASE: the upload only builds an act.

### 0X.3 Stand data — ASK for it, never invent it

The same contract as §0.2a, with a heavier list, because a record file is mostly stand state:

| Ask for | Why guessing fails | Fallback if the user declines |
|---|---|---|
| **The template or a registry export of the target BO** (the file, not its description) | column layout, merges, freeze rows, styles and the table part all come from it; a hand-composed sheet is rejected at the header | none — stop and ask again. This one has no fallback |
| The BO's **unique field** (or a field of its own labelled `ID`) | no unique field and no `ID` → every import CREATES, so a re-run duplicates instead of updating — the export's «Внутренний айди» column does NOT prevent it (19.5) | say plainly that the file will be create-only and ask for confirmation before shipping it |
| **The dictionary values that already exist** on the stand, for every dropdown column | dropdowns match by LABEL and the value must already be there — otherwise `NotFoundDictByLabel`, that row fails | fill only the dropdowns whose labels the user gave, leave the rest empty, and list them |
| For every reference column — **the referenced records must already exist** | v4.24 does NOT create targets from a nested block (`NoUniqueFieldValue`, the row fails) | build the child file first and say the import order |
| Whether any column is the **SINGLE side of a two-way link** | such rows are SILENTLY dropped: «успешно, 5 записей» and the registry shows «0 из 0» | never write that column; set the link from the TABLE side (19.4) |

Absolute, no asking needed: numbers as text; never index by column position; **a blank cell CLEARS the
field on an existing record** (19.6) — on an update file every cell you leave empty is an erase, so fill
every column you keep or drop the column entirely.

### 0X.4 Hard rules

1. Every cell `inlineStr`; no numeric cells, ever.
2. Frozen header rows (or the double bottom border) — else the whole file is rejected.
3. Resolve columns by the (block, field) label pair; a template from another day is a different layout.
4. Never write a column for the SINGLE side of a linked pair.
5. Never name a section heading («Текст») like a field of the same BO — `SameBoFieldsLabel` rejects the
   file while reading the header, and labels are matched across ALL fields regardless of tab.
6. A sub-column that is itself a nested reference must be omitted — the stand's own template and export
   leave it out too (19.3 `[C]`). Under the 2-row header it rejects the whole file (`BoFieldNotSpecified`); a
   3-row header that expands it is accepted but its values are ignored, so it buys nothing.
7. **A blank cell is an ERASE, a missing column is a KEEP** (19.6 `[C]`): on an update, every cell left empty
   clears that field (DATE excepted); a field whose column is absent from the file is left as it was. To
   update only some fields, DELETE the other columns — never blank them. **No cell value clears a `DATE`**
   (19.6 `[C]`) — to empty a date use the record API (`MYBPM-UI-API.md` §6a, `value: null`).
8. Dictionary codes are case-sensitive (`MRP` ≠ `mrp`).
9. **No holes in the cell addresses**: when you remove columns, re-letter the rest contiguously (A, B, C…)
   in the header AND every data row, and fix `dimension`. A sheet whose header skipped letters misread the
   column after the hole — a filled checkbox came out «Нет» `[C]`.
10. **A nested block links, it never edits and never unlinks** (19.6 `[C]`): only the sub-column holding
    the target's unique field (or `ID`) matters — the other sub-columns are ignored, the child keeps all its
    fields. On an update a filled SINGLE block REPLACES the link, a TABLE block ADDS its children to the
    ones already linked (never removes), and an EMPTY block keeps whatever link was there. To drop a child
    from a collection, use the record card or the API, not a file.
11. **A sub-header is the TARGET's own field label with the target's tab prefix**, exactly as the
    template writes it («Пользователь.Почта», «Пользователь.Фамилия» on a stand whose Person fields sit on a
    tab «Пользователь»). A bare «Почта» or «Email» there rejects the whole file (`NoFieldWithLabel` «Нет поля с
    именем …») `[C]`. Any field of the target may be a sub-column, also one the reference HIDES
    (`toShow:false`), so when a block shows no key, ADD the sub-column of the target's unique field — the
    link then resolves through it (19.3 `[C]`).
12. **`isReadonly` does not protect a field from a file** (19.6 `[C]`): the import writes read-only fields on
    create and on update, and a blank cell clears them like any other. Leave such columns out unless you mean
    to overwrite them.

### 0X.5 Self-check before shipping

- [ ] The file opens and every data cell is `inlineStr` (grep the sheet xml for `t="n"` — none).
- [ ] The header rows match the template byte-for-byte; merges and freeze survived the edit.
- [ ] Column map rebuilt FROM THE FINISHED FILE, not from the plan, and it matches the data model.
- [ ] No SINGLE-side link column; no `STATIC_TEXT` hint column (drop those by field TYPE, 19.2).
- [ ] Every dropdown value exists in its dictionary; every reference value exists on the stand.
- [ ] Row count equals what you promised, and the file order is written down for the operator.
- [ ] On an update file: no empty cell in a kept column unless erasing it is the intent; cell addresses
      contiguous (no skipped column letters) in every row.

### 0X.6 Handing the file over

The user loads it: registry kebab → «импорт/экспорт xlsx». The upload only builds an **act** — read «создано /
обновлено / ошибки» and the failing rows, then apply the second step deliberately. A blank cell shows only as
«updated». Loading it yourself (API: template, upload, act, apply, export) is `MYBPM-UI-API.md` §0U R7 and §6.
Emptying a `DATE` is not possible from a cell (19.6) — it is a record-API write, `MYBPM-UI-API.md` §6a.

## 19. The Excel format — evidence

**Read this section only when** an xlsx import failed or your case is not in §0X — §0X holds every rule a build
needs.

### 19.1 Sheet format `[C]` unless noted

- Sheet `Sheet0`. **Every cell is `t="inlineStr"`**, `sharedStrings.xml` is empty, numbers are TEXT.
  **Write numbers as text**: a numeric cell `103` became «103.0» and broke a unique-field lookup.
- Row 1 = the field label, prefixed `«<Вкладка>.»` when the field sits on a tab («Системные.Код»). Headers
  change when tabs change. Split on the FIRST dot; the rest equals `dynamicFields[].label.rus` **after
  strip** (labels can carry leading spaces).
- A nested BO spans several columns: row 1 = a merged block caption, row 2 = sub-headers = the referenced
  BO's `fieldRefs` with `toShow` (sub-headers carry the target's own tab prefix, e.g. «Цель.Формулировка»;
  Person: its own labels with its tab prefix, e.g. «Пользователь.Фамилия», «Пользователь.Почта» — 0X.4
  rule 11). Other columns are merged A1:A2. A dropdown is one cell. Freeze at A3.
  A sheet without nested blocks has ONE header row and data from row 2.
- **Header detection**: by FROZEN ROWS, else by a DOUBLE bottom border in column A
  (`ExcelSheetBridge.headerLineCount`, class
  `kz.greetgo.mybpm.reg.boi_transfer.model.import1.excel.ExcelSheetBridge`). A plain sheet with neither
  fails with `kD4QsxZrAY` «Система не может отделить строки заголовка от строк данных».
- **A TABLE nested object = the parent repeated on several rows**, one row per child. Writing the
  parent's scalars on EVERY row is safe. An export writes it the same way — scalars and SINGLE blocks on
  every row, no merges in the data rows; tell its records apart by «Внутренний айди» or the unique field.
- Values: checkboxes `Да`/`Нет`; date-time `25.10.2025 10:33`; dates `dd.mm.yyyy`; periods
  `dd.mm.yyyy - dd.mm.yyyy`; dictionary registry columns «Значение», «Код».
- Not known yet `[U]` — §20: the cell format of `TIME`, `YEAR`, `YEAR_AND_MONTH`, `PERIOD_TIME`, `CO`, `CHECKLIST`,
  `FILE_UPLOAD`, a `*_LANG` text, an HTML `TEXTAREA`, `QUESTIONNAIRE`, `GEO_POINT`, `PROGRESS_BAR`; whether a file
  can delete or archive records, create DEV (test) records or set a record's participants. Do not ship such
  columns until §20 answers them; set those values on the stand instead (the card, or the record API).
- Styles in stand files: nested sheet `s="7"`, last column `s="8"`; flat sheet `s="3"`, last `s="4"`; data
  rows carry thin left/bottom borders. The xlsx also carries an Excel table part `xl/tables/table1.xml`.
  Styles do not matter to the import: data rows with no `s` attribute import alike.

### 19.2 Columns missing from / leaking into an export

- **No field flag decides the export columns — the export request does** `[C]`. `export-bracket-bo`
  carries `boFieldIds`: a non-empty list gives exactly those fields, in that order; an EMPTY list gives
  every field of the BO except `TAB_GROUP` — `STATIC_TEXT` included and `tableColToShow: false` fields
  included. The UI's «Экспорт в .xlsx» is a field chooser over all fields but `TAB_GROUP`, pre-ticked with
  the registry columns (`tableColToShow`, numbered in their order); the user ticks or unticks any field, and
  the ticked list is sent. `tableColToShow` therefore only sets the UI's default, and `tableColOrderIndex`
  only its order.
- **An EMPTY `boFieldIds` exports the nested blocks EMPTY** `[C]`: caption and sub-headers are written, but
  every sub-cell is blank and a TABLE reference is not expanded into repeated rows, although the links
  exist. A file meant to show or carry links must come from an export that LISTS the fields (the UI
  always does).
- **So STATIC_TEXT («Текст») fields appear as columns** — their plain text repeated in every row — when an
  export sent an empty list or the user ticked them. **Drop such hint columns by field TYPE (STATIC_TEXT)
  read from the archive, never by a label pattern.** For the same reason a real field can be absent from a
  user's export (it was not ticked) — never conclude from one export that a field does not exist.

### 19.3 Resolution rules

- **Dropdown cells are matched by LABEL, not by code** `[C]` (`NotFoundDictByLabel` «Не найден элемент
  справочника … label = …»). The dictionary values must already exist on the stand.
- **References resolve by the TARGET BO's UNIQUE field** (flag `isUnique`; dictionaries: `code`; Person:
  Email) through the sub-column holding it, **or by an `ID` sub-column** `[C]`. `fieldRefs.toShow` decides
  which sub-columns a template has, and that set changes when the display config changes — write what
  the sub-column expects and re-check it on every export.
- **A sub-column may name a field the reference HIDES** `[C]`: when a SINGLE reference shows only a non-unique
  field of the child and hides its unique field (`toShow:false`), a block that adds the hidden unique
  sub-column is accepted and links by it; a hidden non-key sub-column is accepted too and ignored (the
  child keeps its value). A block with only the shown non-unique sub-column creates the record with no
  link. So the export of such a block cannot restore its links — add the key sub-column by hand. The
  sub-header is the target's label with its tab prefix (0X.4 rule 11).
- **A target without a unique field links only by `ID`** `[C]`: a parent file whose nested block had no
  `ID` sub-column created the parents but the block came back EMPTY. Do not expect matching by a
  non-unique code. Likewise a block whose unique sub-column is EMPTY and only a non-unique one is filled
  («Имя» = an existing child's exact name) creates the parent with no link and reports no error `[C]`.
- **A referenced record that does not exist → `NoUniqueFieldValue`**, that row fails and the rest of the
  file imports `[C]`. **A nested block does NOT create target records** in v4.24 — import the referenced
  BO first.
- **A reference resolves only against records that were on the stand BEFORE the file was imported, not
  against rows of the same file** `[C]` → split self-references into a later file. **File ORDER matters**:
  users → groups → dictionaries → records → link files.
- A failed import yields a downloadable «Ошибки при загрузке …» xlsx: row numbers + error codes, roughly
  one error per row.
- **A sub-column that is itself a reference** (BO «Внук» → «Родитель» shown with its own reference «Ребёнок»)
  `[C]`: the stand's `download-template` and its export both DROP that sub-column — the block holds only the
  target's plain sub-columns. Written by hand under the usual 2-row header, the file is rejected while
  reading the header with `BoFieldNotSpecified` «Не указаны дочерние поля для поля `Ребёнок` у бизнес
  объекта `Проба родитель`»; a sub-header «Ребёнок.Код» answers «Нет поля с именем 'Ребёнок.Код'». The
  importer does read a **3-row header** — row 1 the block caption (merged over its columns), row 2 the
  sub-headers with «Ребёнок» over its own columns, row 3 the grandchild's sub-headers («Код»), every other
  header cell merged down to row 3, frozen at A4 — but the third level only parses: its codes are neither
  written into the middle record nor checked for existence. Since a block only links (19.6), a deeper
  level can never change anything — **omit
  such sub-columns** and keep the template's 2-row header.
- `SameBoFieldsLabel` «Встретились одинаковые названия полей в одном бизнес-объекте… X: DROPDOWN_SINGLE vs
  STATIC_TEXT»: header labels are matched against ALL fields of the BO, including «Текст» section headings
  and regardless of tab. **Never name a section or field like another field.**
- Dictionary row codes are case-sensitive (`MRP` ≠ `mrp`).

### 19.4 Linked references (a SINGLE↔TABLE pair) — confirmed defect `[C]`

- **A row whose SINGLE side of a two-way link is filled is silently dropped**: the import reports success
  (e.g. 5 records) and the registry shows «0 из 0» — even with only the code sub-column present.
- The defect is the platform's, not the file's: do not retry with the platform's own registry export of a
  hand-set link or with a pair of BOs linked by hand in the constructor — both fail the same way.
- **Working route: set links from the TABLE side** — import a parent file whose table column lists the
  child codes; the existing child is found by its unique field and its SINGLE field gets filled `[C]`.
  Several children = the parent row repeated.
- Plain (non-linked) SINGLE refs and plain TABLE refs filled from the parent side import fine.
- **Safe practice: do not write columns for the SINGLE sides of links at all.**

### 19.5 Merge / idempotency

- **Match by the BO's own `ID` field → OVERRIDE, not duplicate** `[C]`: an ordinary field labelled «ID»
  (e.g. «Системные.ID», code `ID_`) — client-chosen ids (`base62(sha256(seed))[:16]`, A-Za-z0-9) were
  accepted and kept. Keep it in the file. A BO without such a field has no `ID` header: «ID» or «ID_» there
  is rejected `NoFieldWithLabel`.
- **The export's «Внутренний айди» column does NOT match** `[C]`. An API export with `needBoiId:true` adds it
  as the LAST column (in the UI: the «Внутренний айди» checkbox of «Экспорт в .xlsx», administrators only,
  off by default); the importer reads the header without complaint and then ignores the value: without a
  unique field a re-import of the export DUPLICATES the record, and with one the row is matched by the
  unique value only (a row with the record's id but a new unique value counts «новая»). Updates go by the unique field (next bullet) — drop the column or leave it, it
  changes nothing.
- **Match by the unique field → UPDATE** `[C]`: adding a unique text field «Код» to the built-in «Рабочая
  группа» made its import idempotent. **A BO with neither an ID column nor a unique field always CREATES.**
- **An xlsx import runs none of the BO's scripts** `[C]` — no hook and no field script, on a created record or
  an updated one (§15). Values a script would compute must be in the file or filled later through the form.
  A process does start: an `ON_INSTANCE_CREATE` run way whose `changeVariantSet` lists `ON_UPLOAD_XLSX`
  runs on every record the file creates `[C]` (§5c «`runWayMap`») — the way to compute on imported records.
- Re-importing a full export with rows APPENDED kept the existing rows and added the new ones. `[C]`
- Built-in «Рабочая группа» registry format: «Имя» + nested «Руководитель» (Email/Фамилия/Имя) + table
  «Пользователи» (Email/Фамилия/Имя); merges A1:A2 / B1:D1 / E1:G1, freeze A3. **Group membership imports
  from the group side (the table).** Users import with the columns Фамилия, Имя, Email `[C]` (that stand's labels).
  **A Person block's sub-headers are the «Пользователи» BO's own labels with its tab prefix**, whatever the
  field `[C]`: when the Person fields sit on a tab «Пользователь», a reference showing
  surname/name/email/Отчество/phone/position/accessLevel/ad_employee_id gives the template (and the export)
  «Пользователь.Фамилия», «.Имя», «.Почта», «.Отчество», «.Телефон», «.Должность», «.Роль», «.Табельный
  номер»; the export writes the role as its option label («Пользователь»). A block with only «Пользователь.Почта»
  links the person; «Почта» and «Email» without the prefix are refused (`NoFieldWithLabel`). Labels and the
  tab differ per stand — take them from that stand's template.

### 19.6 Destructive risks — all `[U]`, act defensively

- **A blank cell CLEARS the field on an existing record** `[C]`: an update matched by the unique field,
  with `INPUT_TEXT`, `INPUT_NUMBER`, `CHECKBOX`, `DROPDOWN_SINGLE` and `TEXTAREA` cells
  left empty, stored empty values (text → `""`, the rest → `null`, a checkbox reads «Нет»). It does not
  matter whether the cell is present with empty text (`<is><t></t></is>`) or absent from the row — both
  erase. The act does not warn: it reports the row as «обновлено», 0 errors. **`DATE` is the exception —
  no cell value clears it** `[C]`: an empty cell (`<t></t>`, `<c t="inlineStr"/>` with no text, or no cell)
  and a cell of spaces leave the stored date untouched; `-`, `null`, `0` fail the row («Дата: неверный формат
  значения в колонке `Дата`, укажите формат: DD.MM.YYYY, имеющееся неверное значение `-`»). To empty a
  date, use the record API: `save-boi-value` with `value: null` (or `""`) clears it (`MYBPM-UI-API.md` §6a) `[C]`.
- **A date cell is parsed LENIENTLY** `[C]` — a wrong date becomes another real date with no error:
  `31.02.2026` → 03.03.2026, `00.00.0000` → 30.11.0002, `1.1.26` → 01.01.0026 (the year is taken
  literally); `2026-10-01` is accepted as 01.10.2026. Write `dd.mm.yyyy` with a four-digit year and
  check the act's rows (`load-bo-import-table`, `MYBPM-UI-API.md` §6) before applying.
- **A column MISSING from the file keeps the field** `[C]`: the fields whose columns are absent are left
  as they were. So the safe way to update a few fields is a file with ONLY those columns (plus the key) —
  not a full file with blanks.
- **Holes in the cell addresses break reading** `[C]`: columns removed by dropping their cells but
  keeping the other cells' letters import «успешно», yet the column after a hole is misread (a filled
  checkbox comes out «Нет» on every row); re-lettered contiguously, the same data imports right.
  Re-letter after removing columns.
- **A nested block never writes into the child** `[C]`: a SINGLE or a TABLE block links the existing
  child and leaves it unchanged — a changed value in a non-key sub-column is ignored, and the child's
  fields without a sub-column keep their values. Same on create and on update of the parent. The
  sub-column holding the unique field (or `ID`) is the lookup key; the rest are display only.
- **An EMPTY nested block keeps the link** `[C]` — unlike a blank scalar cell: on an update an empty
  SINGLE or TABLE block leaves the existing links as they were.
- **A filled block on an update** `[C]`: SINGLE → the link is REPLACED (C1 → C2); TABLE → the listed
  children are ADDED to those already linked, nothing is removed. A file cannot unlink a child.
- Deleting child records and re-importing them loses the parent's collection binding — re-bind by hand `[I]`.
- Aggregate fields over a collection could be zeroed by importing collection rows without amounts `[I]`.
- A `DROPDOWN_SINGLE` with `optionSource: FROM_FIELD` and an EMPTY option list will reject any value `[I]`.
- **The importer writes into `isReadonly` fields** `[C]`: INPUT_TEXT, INPUT_NUMBER and CHECKBOX fields flagged
  «Только для чтения» take the file's values on create, are overwritten on update, and blank cells clear
  them. Read-only guards the card, not the import.
- **An empty `INPUT_NUMBER` exports as «0»** `[C]`: a record whose number was never set came out «0» in the
  export, so re-importing that export writes 0 where there was nothing.
- Records have a `removeType` of their own (soft delete): deleted records may keep their codes.

### 19.7 Importer internals

Two phases: `uploadSheet` builds an "act" with a new/updated/error summary, and a separate `applyAct`
creates the instances through kafka in `parallel()` (read off a decompiled older build — v4.24 may differ).
The act counts ROWS, not records `[C]`: a new record on two rows (a TABLE block with two links) is 2 new
rows, and one record is created with both links. A hint about mechanisms only: in v4.24 a
BO-ref cell neither creates the referenced record (`NoUniqueFieldValue`, 19.3) nor updates it (19.6).

### 19.8 Techniques that work `[C]`

- **Round-trip instead of guessing**: take a stand export, edit it, import it, export again and read back.
- Editing an export by rewriting only `xl/worksheets/sheet1.xml` (append rows before `</sheetData>`, update
  `dimension ref`) and re-zipping every other member byte-for-byte imports fine — also as a STORED
  (uncompressed) zip.
- Re-importing an unchanged export of a BO with a unique field is a no-op update (every row «обновлено», values
  unchanged) `[C]` — a cheap way to restore records after a destructive probe.
- **Before handing a file over, read the xlsx BACK and rebuild the data model from its cells** (labels →
  codes).
- Hand-made files must reproduce the header format exactly (freeze A3 + merges).

### 19.9 Editing an xlsx with a spreadsheet library — the traps `[C]` (same list: `MYBPM-UI-API.md` §9)

- The Excel table `displayName` must be Latin (`Table1`…) — a Cyrillic one makes Excel offer to «repair».
- `tableColumns` names must match the header cells exactly, else Excel «repairs» the file. When inserting
  columns, rebuild `tableColumns` by header name and extend the table `ref`, the autoFilter and the
  conditional-format `sqref`.
- **A spreadsheet library does not widen an existing table**: after adding or removing rows update BOTH the sheet
  `dimension` and the table `ref` (e.g. `A1:D35`), otherwise Excel reports the table as broken. A
  hand-made sheet without a table part needs only `dimension`.
- A spreadsheet library writes a number as a numeric cell (`t="n"` — «103» comes back «103.0» and breaks a
  lookup) and a string as a SHARED string, not `inlineStr`. Stand files use `inlineStr` only (0X.4 rule 1);
  whether the importer accepts shared strings was never tried `[U]` — the 19.8 technique (rewrite
  `sheet1.xml` yourself) avoids the question. Grep the sheet xml for `t="n"` before shipping.
- **A library's load-and-save DROPS Google's `xl/metadata` part** → if it must survive, patch the XML inside the
  zip instead of loading the workbook (the 19.8 technique).
- Moving rows: move the values AND the row heights together.
- Appended rows get no style — the importer does not need one: data rows with no `s` attribute at all
  imported fine `[C]` (header detection uses the freeze / double border of 19.1). Copy a sample row's style
  only to make the file look like a stand file.

## 20. Open questions — records

Every record-import behaviour this part relies on is `[C]`; these are open and NOT relied on:

- `[U]` Cell formats of `TIME`, `YEAR`, `YEAR_AND_MONTH`, `PERIOD_TIME`, `CO`, `CHECKLIST`, `FILE_UPLOAD`, a
  `*_LANG` text, an HTML `TEXTAREA`, `QUESTIONNAIRE`, `GEO_POINT`, `PROGRESS_BAR` (19.1) — check: set each on one
  record on the stand, export with listed `boFieldIds`, re-import the edited export, read back.
- `[U]` Whether a file can delete or archive records — check: look for a state column in the template and in
  `load-bo-import-details`.
- `[U]` Whether a file can create DEV (test) records — check: look for an import in the «Тестовые» registry.
- `[U]` Whether a file sets a record's participants — check: look for such a column in the template.
- `[U]` A rollback of an APPLIED records import (`MYBPM-UI-API.md` §0U R7) — check: look for a `bo-transfer` rollback call and
  a rollback control in the import log, try it on a probe BO.
