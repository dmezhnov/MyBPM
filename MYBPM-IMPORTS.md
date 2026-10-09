# MyBPM — what you feed a stand: archives, scripts, records

Every artefact that is BUILT OUTSIDE the stand and then loaded into it, and the exact format of each:

- **Part I — the structure archive `.mybpm.zip`** (§0 cookbook, §1–§8): business objects, fields, form
  layout, dictionaries, references, access rules, the scripts an export carries (§5d) and the sidebar
  menu items (§5e). The SHAPE of things.
- **Part II — Block IDE scripts** (§0S cookbook, §9–§18): the script JSON and the paste protocol. Strictly
  speaking this one is pasted, not imported — it lives here because it is the same kind of job: assemble a
  file by hand, ship it into a stand, verify.
- **Part III — records (instances) as Excel** (§0X cookbook, §19–§20): the xlsx that carries the ROWS of a
  business object. A structure archive never carries records, and an xlsx never carries structure.

The stand itself — API, UI screens, access rights, menus, and the routes that DELIVER all three artefacts
— is the other document, `MYBPM-UI-API.md`. Rule of thumb: **format here, transport there.**

Audience: an agent generating or patching these files. Dense reference, not a tutorial.

**One cookbook per job, and they are independent — read the one you need:** §0 «build me an archive that
creates a BO with fields», §0S «write me a Block IDE script», §0X «fill me a file that loads these records».
Each carries complete literal templates, the naming/id rules, a hard-rules list and a self-check, and each
opens with the stand data you must ASK for (§0.2a / §0X.3) instead of guessing. The numbered sections
behind each cookbook are the evidence and the material for non-trivial cases.

**Placeholders.** This document describes the PLATFORM, not one installation of it, so every host and
company name is replaced by a placeholder: `<stand>` is the host of a MyBPM stand (an archive never
carries it — the user is the only source, §0.2a), `<company-a>` … `<company-d>` are the companies
(tenants) the facts were collected on. Where a fact depends on WHICH installation it came from, the
origin mark carries the date and the platform build instead of a name. Ids, codes and names of the
objects in the examples come from those stands and are examples ONLY — §0.2a says why none of them may
be copied into an archive of your own.

**Evidence base.** MyBPM v4.24, builds `4.24.25.570`, `4.24.25.614` and `S4.24.25.632/C4.24.25.264`;
facts collected from real exports, stand imports and IDE copies.
**Status markers** used throughout: `[C]` confirmed on a stand or in a real export, `[I]` inferred from
structure/behaviour but never isolated, `[U]` unverified — do not build on it without checking.
Everything retracted has been dropped; the mistakes worth not repeating live in *Traps and defects*.

**Reference material** (what the facts below were read off — get the equivalents from your own stand)
- The richest source is a FULL export of a large company on build `.614`: it is the only one here that
  carries `STATIC_TEXT`, `isHeightDynamic`, `gridLayoutPosition` and `AccessStructDto` at once. Older
  `.570` exports of the same company and one-off exports of the other companies fill in the variants —
  and one older export has no `AccessStructDto` at all, so its absence is not a defect.
- The canonical list of field types is the enum `ApiFormFieldType` in the platform's server sources
  (not public); §0.5a below is that list as confirmed on stands, type by type.
- Importer source: only an **old 2022 jar** exists — the `mybpm-api` docker image carries
  `/app/project/mybpm.register-<tenant>-0.0.20.jar` (the slug in the name is the deployment's, not
  yours), decompile with CFR; structure import class
  `…register.impl.reports.structure.StructureMovement`. That build has no BO groups at all and its
  behaviour differs from v4.24 in at least one confirmed place (see *Instance-side note* below).
  **v4.24 sources are not available — a dead end, do not re-open it.**
- Records: the stand's own template/export is the only valid starting point (Part III); the worked
  examples are the record files of the same companies.

---

## 0. COOKBOOK — produce a working archive from this section alone

**Read this section if your job is «make me an archive that creates a BO with fields».** It is
self-contained **for the FORMAT** — every literal value below is copied from an archive that a stand
actually imported — but not for the target: four inputs belong to the stand and must be **asked for**,
see 0.2a. Sections 1–8 explain *why*; this one is *what to type*. Follow it literally, change only what step 2
says you may change, and **never invent a key name** — a key you cannot find in this section does not
belong in the file.

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
  in `0000001.mybpm`. No trailing newline, no JSON, no quotes. Keep N exact. (One mismatch seen
  `[C]`: `objectCount-6` over 5 lines imported and applied cleanly, so a too-HIGH N is not
  checked; a too-low N was never tried `[U]`.)
- `0000001.mybpm` is **JSONL**: one DTO per line, each line a complete JSON object, `\n` between lines
  and one `\n` at the end. It is NOT a JSON array — do not wrap it in `[ ]`, do not pretty-print it.
  Each line must be minified onto a single line.
- Compression may be **STORED (method 0)** — the importer accepts an uncompressed zip, so a builder does
  not need a deflate implementation.
- The outer file name is ignored on import. Real exports are named
  `MyBPM-export-<tenant>-v<build>-<YYYY-MM-DDTHH-MM-SS>.mybpm.zip`; copy that shape for tidiness only.

### 0.2 Algorithm

0. **Ask for the stand data of 0.2a** — group name, taken BO codes, ids/codes of referenced objects.
   Do not start building before the user has answered, or has told you to build without them.
1. **Collect the input**: the display name of the BO, its fields (label + UI type), and the name of the
   BO group **that already exists on the target stand** (ask the user for it — §0.2a; on the reference stand it was `Бизнес-объект`).
2. **Decide the codes** by the naming convention of 0.6a: English, snake_case — `Client_order` for the
   BO, `client_name` for a field, `is_*` for a checkbox, `tabs` / `tab_*` for tabs. At most 30
   characters, shortened by meaning. These are the ONLY values you invent.
3. **Mint the ids** by the rule in 0.7 — one for the group, one for the BO, one per field.
4. **Write line 1** = the group DTO, template 0.3.
5. **Write line 2** = the BO DTO, template 0.4, with one entry of template 0.5 per field inside
   `dynamicFields` — and, if the form also carries «системные поля» or «виджеты», their own maps
   (0.5a `nativeFields`, 0.5b `signatures` / `buttons` / `iframes` / `captcha` / `currentDates` /
   `currentUser`). Those three families never share a map.
6. **Lay the fields out** by the one rule in 0.8 — the `y` counter runs through the widget and system
   fields too, they live on the same grid.
7. If the object is not a plain BO (dictionary / panel / composite / process), apply the diff in 0.9
   **on top of** the same two lines.
7a. If the user also wants the object **in the sidebar menu** (navigation: an item that opens the BO,
   optionally inside a menu group, optionally with extra views such as a kanban), append the menu lines
   of 0.5d AFTER the BO lines — optional, and never added unasked.
8. **Check against 0.10 and 0.11**, then zip as in 0.1 and deliver as in 0.12.

A `CompanyMetadataStructDto` line is **not** needed and must be omitted unless the archive references
the built-in Person / Department / PersonGroup BOs (§1).

### 0.2a Stand data — ASK for it, never invent it

The inputs below **cannot be derived from this document**: they are properties of the target stand, and
every one of them fails SILENTLY when guessed — the archive stays valid, the import reports success, the
damage shows up later. So: **ask the user for them before building.** If the user answers «build without»,
take the fallback of the last column, state in one line which default you took and what it risks, and
build — a guess is allowed only when it has been named out loud and confirmed.

| Ask for | Why guessing fails silently | Fallback if the user declines to supply it |
|---|---|---|
| The **BO group**: the `code`, `name` and `orderIndex` of an existing group (from `load-bo-groups`), or «a new group» + its name | the importer matches groups BY `code`; a line without `code` **renames an existing group**, and a matched line overwrites the group's `name` and `orderIndex` with its own (§0.3, §8) — the customer's group list is destroyed | ask which group; for an existing one copy its `code`, `name` and `orderIndex` verbatim (a group whose `code` is `null` cannot be targeted — say so); for a new one mint a new `code` and say that a group will be CREATED |
| The **BO codes already on the stand** | import MERGES by code: a colliding code edits an EXISTING BO instead of creating a new one, and the report still says success | append a short random suffix to the code (`Demo_bo_p7q2`) so a collision is improbable, and say you did |
| For a `BO` / `CO` field — the target's **`oldRefBoId` + code + name**; for a `DROPDOWN_SINGLE` fed `FROM_BO` — the **dictionary CODE** (a `RADIO_BUTTON_GROUP` cannot take a dictionary at all) | ids and codes live on the stand; a wrong id is a dangling reference, and the analysis only warns («В Составном объекте не достаёт БО») — the warning does **not** block ПРИМЕНИТЬ | do NOT emit the field with an invented id. Either drop it, or degrade it — a dropdown to a local list (`optionSource: "FROM_FIELD"`), a reference to `INPUT_TEXT` — and list every field you dropped or degraded |

**NOT asked: the ids of a business process's `PROCESS_STATUS`** `[C]`. The «Статус процесса» dictionary is
built in with the fixed code `PROCESS_STATUS`, but its id differs between stands (`Q0zI~z9Ra2R7Q3yd` on one,
`0sKQwbF6d25F6DvG` on another). The importer does not care: it resolves the reference by
`boRefStruct.boInfo.code` and the default by the `CREATED` row's unique code in the `DEFAULT_VALUE` line —
an archive carrying another stand's ids, and one carrying made-up ids, both came in with the stand's own
`refBoId` and `CREATED` row id, and records of both processes saved. So mint the two ids like any
archive-internal id (0.7) and use each consistently: the dictionary id in `oldRefBoId` and in the line's
`compositeId`, the row id in `defaultValue` / `defaultValueMap` and in the `compositeId` (§5c). Whether
mismatched ids between the field and the line would still resolve is not checked `[U]`.

**Every id literal printed in this section is `<company-a>`'s, not yours** `[C]`. Copying one out of an
example IS inventing an id — 0.2a forbids it exactly the same way, and it fails in the same silent manner.
Two different kinds of literal appear below: `3H84o9iM@G4jaOL3`, `ca3w3BgmzJGmWO7q`, `WbX5Wa8gcabbVbF1`,
`qmEhH4GnZvawC3R4` are archive-internal ids of the sample — mint your OWN by 0.7 instead of reusing them;
`I1fVTkYPTSg7X8b8` (`<company-a>`'s `Person`), `@feclOAWUnwXFQ8c` (a `<company-a>` composite) and `Q0zI~z9Ra2R7Q3yd`
(`<company-a>`'s «Статус процесса») are **real ids on the `<company-a>` stand** and appear here only to show the
SHAPE. Paste one into an `oldRefBoId` for any other stand and you ship a dangling reference that imports
«successfully» and breaks at runtime.

**A BO defined on ANOTHER LINE OF THE SAME ARCHIVE is not stand data — reference it, do not degrade it**
`[I]` (deduced from the `oldId` → real-id rule of 0.7 and §8; not yet re-checked on a stand). When your
own archive creates the target, you already know its id: you minted it. Write
`"oldRefBoId": "<that BO's own oldId>"` plus `boRefStruct.boInfo = {code, name, boCategory}` copied from
that same line, and put the referenced BO on an EARLIER line than the one pointing at it. The degrade of
the table's last row applies only when the target is NOT in this archive.

**A составной объект needs CODES ONLY — it is NEVER degraded into a plain BO** `[C]` (§5b). This is
the mirror image of the panel, and it has been got wrong the same way: `bos: [{code, name, boCategory}]`
carries **no id at all**, the importer looks the sources up on the stand BY CODE, so «Клиенты и
Поставщики are not on my list of stand ids» is not a reason to degrade anything — there was no id to ask
for.

**Decide first WHERE the sources are.** If you are building them yourself — the usual case for a generic
task like «клиенты и поставщики в одном списке» — **put the source BOs into the SAME archive** and there
is nothing to ask at all: the importer resolves `bos[].code` against the lines of the archive just as
happily as against the stand `[C]` (dry run on `<company-a>`; the order of the lines does not
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
`oldRefBoId` of a BO that already exists on the stand (0.9, §5a). If those ids were not supplied there is
nothing left to degrade — a panel without registries is an empty panel. STOP, deliver no archive, and
report which ids you need.

**The intra-archive rule above is NOT a way out of this**, and this is the trap that has been walked into
twice. «Панель с реестрами Сделки, Клиенты, Задачи» says those objects EXIST; inventing three BOs with
those names so the panel has something to point at is worse than shipping nothing, because import MERGES
BY CODE — your invented `Klienty` silently edits the customer's real «Клиенты». You may put a registry's
BO in the same archive **only when the user explicitly asked for that BO to be created too**. Otherwise:
- **do NOT re-read «панель с реестрами X, Y, Z» as «создай бизнес-объекты X, Y, Z»** — that ships a
  different KIND of object than the one asked for;
- **and do not ship both** — a panel plus three freshly invented registries is the same substitution with
  the panel added on top.

**0.2a covers those four inputs and NOTHING else.** It is not a general licence to replace whatever you
feel unsure about with something simpler. Everything else in this document is buildable from the document
alone: tabs (`TAB_GROUP`), a progress scale (`PROGRESS_BAR`), a questionnaire, a local dropdown, a
multi-file upload need no stand data at all — building section headings «instead of» tabs because
«the tab structure was not supplied» is the same substitution as the panel and the composite above, and
it is the third time it has happened. If the document tells you how to build the thing asked for, build
it; 0.2a applies only when a **stand id or a stand code** is what is missing.

Two more rules that need no asking, they are absolute: `Person` / `Department` / `PersonGroup` are
reserved codes (§6, import dies with «Несоответствие типов объектов»), and an `AccessStructDto` is never
shipped unless the user asked for one (§0.10 rule 10 — it REPLACES the rights set on the stand).

Where the user reads these off a stand (routes in `MYBPM-UI-API.md` §0U, recipe R4): `load-bo-groups` → the group
names, `load-bo-records-by-group-id` → the BOs of a group with their codes and ids,
`load-bo-id-by-code` → an id for a known code, `load-bo-dictionary-list` → the dictionaries. By hand: the
constructor's BO list, and the id sits in the URL `…/business-objects/editing/<boId>/object-editing`.

### 0.3 Line 1 — the BO group (copy verbatim, change `name`, `code`, `orderIndex` and the two ids)

```json
{"@class":"kz.greetgo.mybpm.reg.structure.model.dto.BoGroupStructDto","oldId":"3H84o9iM@G4jaOL3","name":"Проба группа","code":"Probe_group","orderIndex":1110000,"kind":"MANUAL","newId":"ca3w3BgmzJGmWO7q"}
```

- **Every group line carries a `code` — the importer matches groups BY `code`, not by name** `[C]`
  (build S4.24.25.643, §8): a `code` that exists on the stand puts the BOs into that group;
  a `code` the stand does not have CREATES a new group (its id = the line's `newId`, its name = `name`).
  **A matched group still takes the line's `name` AND `orderIndex`** `[C]`: two archives
  with `code` = an existing group's code but `name` = that code and `orderIndex` 1110000 renamed the stand
  group «Тест» to «Group__FMRhhpzx» and moved it from 100000 to the bottom of the list. So for an
  EXISTING group copy all three — `code`, `name`, `orderIndex` — from `load-bo-groups` (0.2a). **A line WITHOUT `code` is written onto one fixed stand group and RENAMES
  it** — whatever `name` says, even the exact name of another existing group. That is the defect that
  destroys the customer's group list (§8). Never ship a group line without `code`.
- To put the BOs into an EXISTING group, copy its `code` from `load-bo-groups` (0.2a). Many stand groups
  have `code: null` — such a group cannot be targeted by an archive; ask the user for a group that has a
  code, or ship a new group with a new code.
- The two ids above are the SAMPLE's, not yours — mint your own by 0.7 (0.2a).
- `oldId` ties this line to the BO line (`BoStructDto.boGroupOldId` repeats it). It is NOT a stand id —
  every export of the same group carries a different one, so any value of the right shape is fine.
- `kind` is always `MANUAL`; `orderIndex` is the group's place in the list — a new group takes it, and
  a matched group is MOVED to it `[C]` (above), so repeat the stand's own value.
- **Several group lines in one archive work** when every one of them has a `code` `[C]` (two groups, one
  existing and one new, each BO landed in its own group). Without codes they collapse into the one fixed
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
  "category": "BO",                         ← BO | BO_DICTIONARY | BO_PANEL | BO_COMPOSITE | BO_PROCESS (0.9)
  "kind": "GENERAL",
  "boGroupOldId": "3H84o9iM@G4jaOL3",       ← = oldId of line 1, character for character
  "instanceViewType": "FORM",               ← FORM = a record opens as a dialog, TAB = as a page tab
  "bos": [],
  "boTabs": {},                             ← card tabs, e.g. {"CHAT": 1, "FILES": 2} — ADDS only, never removes (§2 «BO card tabs»)
  "printForms": [],
  "name":       {"rus": "Демо из кукбука"}, ← display name
  "recordName": {"rus": "Демо из кукбука"}, ← same text (shown nowhere; the constructor keeps it = name)
  "staticValue": {},
  "description": "",
  "orderIndex": 47480000,                   ← the BO's place in its group: give each BO its own number (§2 «BO place in the sidebar»)
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
  "tableColToShow": true,
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
  "gridPosition": {"x": 0, "y": 0, "cols": 15, "rows": 4},   ← layout, rule 0.8
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
that do not carry the key and do not advance it live in OTHER maps — the system fields of 0.5a
(`nativeFields`) and the six widget maps of 0.5b.

**«Widget» in this document means ONLY a member of the six maps of 0.5b** — `SIGNATURE`, `BUTTON`,
`IFRAME`, `CAPTCHA`, `CURRENT_DATE`, `CURRENT_USER`. The palette's «Виджеты» section is a different
thing and is not a guide to the archive: `TAB_GROUP` and `PROGRESS_BAR` stand there, and they are
ORDINARY `dynamicFields` entries. So `STATIC_TEXT`, `TAB_GROUP`, `PROGRESS_BAR`, `QUESTIONNAIRE`,
`FILE_UPLOAD`, `CHECKLIST`, `GEO_POINT` all sit in `dynamicFields`, all carry the full template of this
section, and all take their turn in the `tableColOrderIndex` counter. Anything in `dynamicFields`
without the key is rule 6 of 0.10 — the key is not optional for «non-input» fields.

**To make a field required or unique, write `true` in `isRequired` / `isUnique`. To turn something off,
write `false` — never delete the key** (§8: a dropped key keeps the stand's old value).
`isRequired` and `isReadonly` must never both be `true` — such a record cannot be saved (the constructor
greys the second checkbox out as soon as the first is ticked). Both flags survive an import unchanged
`[C]` and behave on the stand exactly as a constructor-built flag: an empty required field is
refused with «Обязательные поля не заполнены», a duplicate unique one with «Продублировано уникальное
поле». A UI-built BO ALSO carries `tableColToShow: true` on every required/unique field (the constructor
sets it automatically) — copy that if the archive should reproduce a stand-built registry. **But on a
stand with the Elasticsearch sort defect a filled STRING field as a registry column breaks the registry
of a new BO** — see 0.5c «The Elasticsearch sort defect» before setting `tableColToShow: true` on text.
A `DROPDOWN_SINGLE` additionally needs `fieldOptionsStruct` (§5) — a dictionary by CODE, or a local list.

**The ONE documented exception to «never drop a key» is the composite.** A `BO_COMPOSITE` has no form, so
its fields carry no `gridPosition`, no `tableColOrderIndex` and no `removeType` (0.9, §5b) — an archive
built without exactly those three is verified to import `[C]`. Nowhere else may a key of this template be
absent.

Types you may put in `"type"` — this is the WHOLE palette of «Элементы страницы», 23 types, verified
type by type on `<company-a>` (`[C]`: each one was created through the constructor API, exported,
re-generated by `make-probe-archive` and imported back). Four more types exist and are reached
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
| Загрузка файла | `FILE_UPLOAD` | `params.viewType` SINGLE/MULTIPLE/TILE + `params.contentType` ALL/FOR_CAMERA (also IMAGE/DOCUMENT; mobile app only, below) |
| Email / Телефон | `INPUT_EMAIL` / `INPUT_PHONE` | — |
| Мультиязычное текстовое поле | `INPUT_TEXT_LANG` | — |
| Мультиязычный текстовый блок | `TEXTAREA_LANG` | — (the value may be HTML, below) |
| Вложенный объект / Пользователь | `BO` | `oldRefBoId` + `boRefStruct.boInfo` |
| Составной объект | `CO` | `oldRefBoId` + `boRefStruct.boInfo` with `boCategory: "BO_COMPOSITE"` |

The types that need extra keys — every shape copied off a real export of a BO built through the
constructor, then proved by importing the same shape back `[C]`:

- `STATIC_TEXT` — the HTML of the heading goes into `"staticValue": {"rus": "<h2>…</h2>"}`, and the cell
  should be `{"x":0,"y":<y>,"cols":15,"rows":8}`. A heading text **must not repeat any field label of
  the same BO** — that breaks Excel import.
- **A `STATIC_TEXT` also has a per-record value** `[C]`: `staticValue` is only what the
  card shows until a record gets its own. A script writes that value with
  `F-VALUE_IN_LANG-K-DYN-R-D-S-boi_fields` (`language` = Enum const `MybpmLang` `RUS`) on the field
  reference; the card shows it at once, and after saving, only that record shows it. This is how the
  demo BO puts a per-record `<iframe>` map into a «Текст» field (`MYBPM-UI-API.md` §8).
- **HTML instead of plain text** `[C]` (the user): «Текст» (`STATIC_TEXT`), «Текстовый блок»
  (`TEXTAREA`) and «Мультиязычный текстовый блок» (`TEXTAREA_LANG`) render HTML, so anywhere their text
  goes — `staticValue`, a record value written by a script, the API or an xlsx cell — an HTML fragment
  may stand in for the plain string (`<b>`, `<br>`, `<a href>`, `<div style=…>`). What the sanitizer keeps
  is `MYBPM-UI-API.md` §8. «Текстовое поле» (`INPUT_TEXT`) and `INPUT_TEXT_LANG` are single-line inputs
  and show the tags as text `[I]` — this rule is not about them.
  `<script>` makes the server reject the whole value, `srcdoc` is stripped, while `<iframe src>`, `<img>`,
  `<a>` and inline `style` are kept, and an `<iframe>` renders live on the card `[C]`
  (`MYBPM-UI-API.md` §8).
- `BO` (nested object / reference) — add `"oldRefBoId": "<the target BO's id ON THE STAND>"`,
  `"viewType": "TABLE"` (or `SINGLE`), `"isHeightDynamic": true`, and
  `"boRefStruct": {"boInfo": {"code": "<target code>", "name": "<target name>", "boCategory": "BO"}, "fieldRefs": {}}`.
  The target must already exist on the stand and **its id and code must be read off the stand**, never
  guessed — unless this same archive creates it, in which case its `oldId` IS the id (0.2a).
- `CO` — the same, with `"boCategory": "BO_COMPOSITE"` and the composite's id (which itself often starts
  with «@», e.g. `@feclOAWUnwXFQ8c` — parse such a spec from the right).
- `DROPDOWN_SINGLE`, `RADIO_BUTTON_GROUP` — one extra key, `fieldOptionsStruct`, in exactly one of the
  two shapes below — a `RADIO_BUTTON_GROUP` only the first, the local list. Copy the literal; §5 explains them.

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
- `QUESTIONNAIRE` — columns and rows share ONE map, told apart by `isColumn`, keyed by the option's code:
  `"questionnaires": {"column_1": {"questionnaireDto": {"label":"Колонка 1","isColumn":true,"orderIndex":0,"code":"column_1"}, "newId":"<16 chars>"}, "row_1": {…"isColumn":false…}}`
- `PROGRESS_BAR` — `"progressSteps"` is keyed by the step's own **id**, not by its code:
  `{"<16-char id>": {"code":"new","label":"Новый","orderIndex":0}, …}`
- `TAB_GROUP` — its own code is `tabs` (`tabs_*` when the BO has several, 0.6a); `"fieldTabs"` keyed by the tab code (`tab_*`):
  `{"tab_main": {"label":{"rus":"Общее"},"orderIndex":0,"chosenAccessRight":false,"isRight":false,"isDefault":true,"code":"tab_main","newId":"<16 chars>"}}`
  Fields on a tab carry `tabCodePath: {tabGroupCode, tabCode}` — both CODES. **A widget on a tab (an entry of
  any of the six maps of 0.5b) carries the same object under the key `tabCode` instead** `[C]`: the import puts
  it on that tab and the export writes it back the same way, and its `gridPosition.y` counts from the top of
  the tab like a field's. `tabCodePath` on a widget is silently IGNORED `[C]` — the widget lands outside the
  tabs at its `y` in the form's stack, overlapping whatever sits there. **A TAB_GROUP must have a
  code** `[C]`: a group created over the API without a label gets code `""`, and a stand
  export then DROPS the group itself and its tab rules, writing the group's id into its fields'
  `tabGroupCode` (the archive cannot be imported back). Give the group a code before exporting
  (`MYBPM-UI-API.md` «Tabs (`TAB_GROUP`) over the API»). Per-tab locks → §7.
- `FILE_UPLOAD` — `"viewType": "MULTIPLE"` («несколько файлов») and `"params": {"contentType": "ALL"}`
  (`FOR_CAMERA` = «только фото с камеры»). The constructor's «Отображение» radio (Одиночный /
  Множественный / Плиточный) lives in **`params.viewType`** (`MYBPM-UI-API.md` §5i «FILE_UPLOAD display
  mode»). **A photo shows in the field without downloading only with «Плиточный»** (platform team;
  not «Множественный»). «Плиточный» = `params.viewType: "TILE"` `[C]`
  (captured off the constructor's save; the top-level `viewType` stayed `MULTIPLE` and does
  not matter). In both «Множественный» and «Плиточный» a script sees the field's value as `File[]` `[C]` —
  the same script compiled unchanged after the switch, and a script-written PNG then showed as a tile
  thumbnail on the card.
  **«Поведение для MP» = `params.contentType`** `[C]`: the enum is `ALL` / `IMAGE` /
  `DOCUMENT` / `FOR_CAMERA`; the stand stores all four (API and archive), a stand export writes them and a
  copy import brings each back unchanged. The constructor's only control is the checkbox «Только камера»,
  which toggles `FOR_CAMERA` ↔ `ALL` — an `IMAGE` / `DOCUMENT` field shows it unticked, and one click
  overwrites the value. **The setting does nothing on the web**: the record card renders the same
  `<input type=file accept="*">` (no `capture`) for all four values, and the server stored a `.txt` in a
  `FOR_CAMERA`, an `IMAGE` and a `DOCUMENT` field alike. It is read by the mobile app only («MP»); what
  the mobile app does with it is `[U]`. Leave it `ALL` unless the field is for phone-camera shots.
- `CHECKLIST` — **the items are the field's `defaultValue`, NOT `fieldOptionsStruct`** `[C]`
  (build S4.24.25.643, export → edit → import → the items shown on a new record's form): a JSON array
  written as a STRING, `"defaultValue": "[{\"label\":\"Пункт 1\",\"checked\":false},{\"label\":\"Пункт 2\",\"checked\":true}]"`
  (`checked:true` = the item starts ticked and struck through). Set `"isAppendable": true` as well — the
  constructor turns it on together with the first item («можно добавлять пункты» on the record). A
  `fieldOptionsStruct` on a checklist is IGNORED by the import (and even resets the stand field's
  `optionSource` to `null`); the old note «items are not carried by an archive» was wrong — it looked
  for the items in the wrong key.

Cell heights the constructor itself assigns: 4 rows for a plain field, **6** for `BO` / `CO` / `LINK` /
`FILE_UPLOAD` / `CHECKLIST` / `RADIO_BUTTON_GROUP` / `PROGRESS_BAR`, **8** for `STATIC_TEXT` /
`QUESTIONNAIRE` / `TAB_GROUP` / `GEO_POINT`.

### 0.5a System fields — `nativeFields`, NOT `dynamicFields`

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
| `CREATED_BY` | Автор | `BO` | + `viewType: "SINGLE"` and `boRefStruct.boInfo` = `Person` / «Пользователи» / `BO`, 6 rows |
| `LAST_MODIFIED_BY` | Автор последнего изменения | `BO` | same |
| `OPEN_COUNT` | Счетчик открытий | `INPUT_NUMBER` | |
| `IN_MIGRATION_UPDATED_AT` | Дата обновления IN миграции | `FULL_DATE` | |

`PARTICIPANTS` («Участники») is in the enum but **cannot be created**: the palette never offers it and
`generate-business-form-field-by-native` answers with an empty body `[C]`. Each system field may be placed
**once** per BO.

**What travels for a system field** `[C]` (`<stand>`; export of a BO with all six natives,
then a copy imported as a new BO with changed settings):

| key in `nativeFields.<TYPE>` | export writes it | import applies it |
|---|---|---|
| `label` (rename), `hideLabel` | yes | yes |
| `viewType` `TABLE`/`SINGLE` + `boRefStruct.fieldRefs.<code of a «Пользователи» field>.toShow` (`CREATED_BY`, `LAST_MODIFIED_BY` only) | yes, by field CODE (`surname`, `name`, `adGuid`, `Position__Object_`…) | yes |
| `chosenAccessRight` | yes | yes — but see the lock |
| `needUploadToOutTable` | **no** (`false` even when the stand has `true`) | **no** |
| `needLoadFromInTables`, `inMigrationTimezoneMinutes`, `isRequired` | — (the stand never stores them on a native) | no |
| `isReadonly` | — | irrelevant: a native is always read-only |

- **The lock does NOT travel.** The export puts it into the `AccessStructDto` under
  `fieldAccessStructMap.<NATIVE_TYPE>`; the import ignores that entry (also tried keyed by the native's
  `newId` and by `N-<TYPE>` — nothing), while a dynamic field's lock in the same archive is applied. Since
  `chosenAccessRight: true` IS applied, the imported BO shows an orange lock over rights that are «всем».
  So leave `chosenAccessRight: false` on natives in an archive and set native rights over the API after the
  import (`MYBPM-UI-API.md` §5i «System fields (natives) — settings»).
- The constructor offers no settings on `CREATED_AT`, `LAST_MODIFIED_AT`, `OPEN_COUNT`,
  `IN_MIGRATION_UPDATED_AT` beyond the label; `CREATED_BY` / `LAST_MODIFIED_BY` add the view and columns.

### 0.5b Widgets — six maps of their own

«Виджеты» are neither `dynamicFields` nor `nativeFields`: each family has its own map in `BoStructDto`,
keyed by the widget's CODE `[C]` (exported and re-imported):

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

**A button's and an iframe's settings round-trip through an archive** `[C]`. A
probe BO with four buttons and an iframe was exported, re-imported under a new code, and every setting
was read back through the widget controllers. All of them came back: code, `url` and `fieldCodes` of
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
button (`MYBPM-UI-API.md` §5i «A BUTTON runs a script»). On a stand this is `[C]`: wired by `fieldId`
through `save-bo-scripts`, run by a real click. In an archive it is
`fieldScripts: {"<button code>": "<scriptId>"}` (§5d, `tools/add-bo-scripts.bun.ts --bodies` with hook
`field:<button code>`), keyed like any field — `[C]`: a 3-button archive with
RestRequest bodies imported, all three `translate-script` success, each real click wrote its field.

**CURRENT_USER («Текущий пользователь») round-trips through an archive** `[C]`.
The widget was set up in the constructor and over the API, exported, re-imported under a new BO code
with every setting changed, and read back through `v2/widget-current-user` and `load-business-object-by-id`.
Everything came back: the code, `viewType`, the columns and the lock.

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
  `CREATED_BY` / `LAST_MODIFIED_BY` (§0.5a).
- `viewType` is `TABLE` or `SINGLE`, nothing else.
- `fieldRefs` is keyed by the CODES of the «Пользователи» (Person) BO's fields. The export lists all of
  them; hidden ones have `toShow: false` and `orderIndex: 2147483647`. On the stand used,
  «Фамилия» = `surname`, «Имя» = `name`, «Почта» = `email`, «Роль» = `accessLevel`, «Должность» =
  `position`. Codes may differ on another stand: read them from an export of that stand.
- **`fieldRefs: {}` and no `viewType` are safe**: the imported widget came out `TABLE` with
  «Фамилия» + «Имя» shown, the server's own default. **A partial map is enough too**: a generated
  `{"surname": {"toShow": true, "orderIndex": 0}, "accessLevel": {"toShow": true, "orderIndex": 1}}`
  imported as exactly «Фамилия», «Роль», and the 31 unlisted fields hidden.
  `tools/make-probe-archive.bun.ts --widget "CURRENT_USER:<label>:<code>:SINGLE/surname,email"` writes it
  that way. Without the 4th part it writes `TABLE` + `{}`.
- The widget's **lock** travels as a normal `fieldAccessStructMap.<widget code>` entry of the
  `AccessStructDto` (§7). Shipping an `AccessStructDto` replaces the BO's rights (§0.10 rule 10), so do it
  only for a BO the archive creates, or when asked.
- One CURRENT_USER per BO.

**SIGNATURE («ЭЦП / СМС») round-trips through an archive** `[C]`. The widget was
set up over the API and in the constructor, exported, re-imported under a new BO code (new `oldId`, new
`newId`s) and read back through `v2/signature`. A second BO was GENERATED by
`tools/make-probe-archive.bun.ts` and imported. In both cases the code, the signed fields, the mass field,
the phone, the print forms and the lock came back:

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
  **It did NOT survive the import** `[C]`: the copy came back with no mass print forms. Set those on the stand.
- **`signingPhoneCode`** = «Указать номер для подписания», the CODE of an `INPUT_PHONE` field. Leave it out
  for none.
- The **lock** travels as `fieldAccessStructMap.<signature code>` of the `AccessStructDto` (§7), with
  `view.orgUnitIds` like `"D-<department id>"`. The export also adds an `ExportStructInstanceDto` line for each
  group it names. An `AccessStructDto` replaces the BO's rights (§0.10 rule 10).
- On the record card the signing TYPE (ЭЦП or SMS) is chosen by the user per signing. It is not part of the
  archive.
- Generator: `--widget "SIGNATURE:ЭЦП/SMS:signature:text,answer;phone=phone;pf=contract;mass=regions"`.
  The 4th part holds the codes of the fields to sign, then optional `phone=`, `pf=` and `mass=`. The
  validator checks every code against the BO.

**CAPTCHA («Блок captcha») round-trips through an archive — and BLOCKS every save that changes a record**
`[C]`. The widget was added over the API, given a code and a lock, exported,
re-imported as a copy under a new BO code with the captcha code renamed, and read back through
`v2/captcha`. The code and the lock came back.

```text
"captcha": {"captcha": {"label": {"rus": "Блок captcha"},
  "gridPosition": {"x":0,"y":54,"cols":15,"rows":6},
  "code": "captcha", "type": "CAPTCHA", "newId": "<16 chars>"}}
```

- The entry has **no setting of its own** beyond the code. The map key and `code` are the same code.
  Without one the server derives `Blok_captcha` from the label.
- The **lock** (who sees the widget, VIEW only) travels as `fieldAccessStructMap.<captcha code>` of the
  `AccessStructDto` (§7). «Только участники» exported as `"view": {"denyAll": true, "participants": true, …}`.
  An `AccessStructDto` replaces the BO's rights (§0.10 rule 10).
- **The server enforces it.** With a CAPTCHA on the BO, `validate-apply-remove-draft` of a draft that
  CHANGED a value, or of a NEW record, answers `CaptchaNotVerified` («Капча не верифицирована») until the
  captcha of that draft is solved on the card. A draft with no changes still saves. The four-call record
  cycle (`apply-and-remove-draft`) is refused the same way. So **a BO with a
  captcha cannot take records from the record API (`MYBPM-UI-API.md` §6a) or any headless client**.
  Whether Block IDE scripts and the xlsx import are blocked too is `[U]`. Put a captcha only on a BO that
  people fill in by hand.
- `CAPTCHA` may repeat on a BO (the palette keeps offering it). Height 6 rows.

**CURRENT_* date widgets («Текущая дата / день / месяц / день и месяц / год») round-trip through an archive**
`[C]`. All five were added over the API, given codes and locks, exported,
re-imported as a copy (one code renamed, one lock changed in the archive), and also generated by
`tools/make-probe-archive.bun.ts` and imported. Every code and every lock came back as written.

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
  like CAPTCHA and CURRENT_USER. An `AccessStructDto` replaces the BO rights (§0.10 rule 10).
- **The widget stores nothing.** The card shows the server time from when the draft was opened. It is a
  disabled date picker in the format `dd.MM.yyyy` / `dd` / `LLLL` (the month name, «октябрь») / `dd.MM` /
  `yyyy`. `load-field-data` returns that time as an ISO string, a new one for every draft. A value
  written into it over the API is accepted and then ignored. `load-boi-values` does not list the widget at all.
  Do not use it as a «date of creation» field: that is the native `CREATED_AT` (§0.5a).
- The palette offers each type once per BO, but **the server accepts a second widget of the same type**
  (one was added over the API and got its own code). Height 4 rows.
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
- **The import uploads the file anew**: the imported form got a NEW `fileId` and the original name, and it
  worked on the stand. A generated archive needs only an id that ties `printForms[].fileId` to its
  `ExportStructFileDto`. The generator uses 24 upper-case hex characters, which is what the stand writes.
- The code comes from the name if you build the form on the stand («Договор» → `Dogovor`). In an archive
  it is whatever `printFormCode` says.
- Generator: `--print-form "Договор:Dogovor:path/to/template.docx[:PDF|DOCX]"`, repeatable. A minimal
  three-part .docx (`[Content_Types].xml`, `_rels/.rels`, `word/document.xml`) is accepted. Template
  placeholders were not explored `[U]`. The stand-side API for print forms is `MYBPM-UI-API.md` §5i
  «Print forms».

### 0.5c Kanban — the card template travels in the archive `[C]`

A kanban is TWO things, and the archive can carry BOTH:

- the **card template**, which lives ON THE BO in `kanbanCardTemplates`. **Ship it, or the kanban view
  dies with «cardTemplate is null»** — that is the whole of the old «kanban is broken for imported BOs».
  It belongs to the BO, not to any menu item: whatever place shows this BO as a board reads it from here.
  **Give EVERY `DROPDOWN_SINGLE` one, even when nobody asked for a kanban** `[C]`: without it the
  BO's MAP view and the constructor's kanban editor die the same way once a record exists (§2 «BO views»). A
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
    line of the SAME archive does it by code, `boPages.kanbanFieldCode` (0.5d, §5e), or
    `v2/menu-item/save-menu-item-bo-pages` after the import (`MYBPM-UI-API.md` §4). Give the user a menu item
    when the board must be one click away.
  Nowhere else: the constructor offers a `BO` / `CO` reference field only Табличный / Множественный / Одиночный /
  Карточкой and a panel registry only Табличный / Множественный. The client's `viewType` enum also lists
  `KANBAN` / `CALENDAR` / `MAP` / `TIMELINE`, but no screen sets them — never ship them in a field's `viewType`.

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
  a kanban (a BO may carry several — a stand export showed two).
- The inner key is the CODE of the field shown on the card — a key of `dynamicFields` with
  `archetype: "DYNAMIC"`, or a key of `nativeFields` (the native type itself) with `archetype: "NATIVE"`.
  Ids never appear here, exactly like everywhere else in a `BoStructDto`.
- `locationType` is `HEADER` | `CONTENT` | `FOOTER`; `cardOrderIndex` orders the fields inside one
  location and is a plain int (a stand export had 15 and 18 in one template, 0 everywhere in another).
- `tools/make-probe-archive.bun.ts --kanban "Статус:HEADER=Наименование;CONTENT=Исполнитель,CREATED_BY;FOOTER=Комментарий"`
  writes exactly this.

Verified end to end on `<stand>` (`<COMPANY_A>`): archive → apply → `v2/kanban/load-kanban-template` returns a
`cardTemplate` instead of NPE-ing, the board renders its three columns, and `load-bracket-kanban-cards`
returns the card with its header/content/footer values. **But the cards do not appear in the UI yet** —
a second, unrelated defect of every NEW BO on that stand blocks the default sort (`MYBPM-UI-API.md` §7;
what an archive can do about it is the next paragraph).

**The Elasticsearch sort defect — what the archive must do about it** `[C]` (`<stand>`,
build `S4.24.25.632`). On that stand every BO created by the current version (archive AND constructor
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
whole board with its columns straight after ПРИМЕНИТЬ `[C]` (build `S4.24.25.632`, §5e).

### 0.5d Sidebar menu items — `MenuItemStructDto` lines `[C]`

Optional lines AFTER the BO lines (step 7a). A menu item is NAVIGATION: a row in the sidebar that opens
a BO's records (or a folder that holds such rows). Views such as a kanban are an option ON an item, not
the reason for it. One line per menu item; a group and the items inside it are separate lines.
**Everything is referenced BY CODE** — the parent group, the BO, a view's field — and a menu line has
**no id at all**: the stand mints the menu item's id itself. Copy the templates literally and change
only the values marked `←`.

**An item that opens a BO** — the usual case, the list view only, at the root of the sidebar:

```json
{"@class":"kz.greetgo.mybpm.reg.structure.model.dto.MenuItemStructDto",
 "menuItemCode":"Requests",                  ← your code, latin, unique among MENU codes
 "menuItemName":"Заявки",                        ← the text in the sidebar
 "boCode":"Request",                             ← the BO's `code`
 "boName":"Заявки",                              ← the BO's `name.rus`
 "iconName":"man-with-company",
 "orderIndex":950000,                            ← position among its siblings
 "boPages":{"isKanbanEnabled":false,"kanbanIndex":0,
            "isCalendarEnabled":false,"calendarIndex":0,"isTimelineEnabled":false,"timelineIndex":0,
            "isListEnabled":true,"listIndex":1,
            "isMapEnabled":false,"mapIndex":0,"isGroupingEnabled":false,"groupingIndex":0},
 "chosenAccessRight":false,"needCountMenuItem":false,"isPanel":false,"needHideInMobApp":false,
 "bracketFilter":{"boCode":"Request","type":"MENU_ITEM","brackets":{}},
 "menuItemType":"BO"}
```

(This list-only shape is what the stand EXPORTS for such an item, and it IMPORTS as is `[C]` —
applied and read back from `load-nav-items` with exactly these `boPages`.)

**A group** (a folder in the sidebar) — only when the user wants the items grouped:

```json
{"@class":"kz.greetgo.mybpm.reg.structure.model.dto.MenuItemStructDto",
 "menuItemCode":"Probe_menu",            ← your code
 "menuItemName":"Проба меню",          ← the text in the sidebar
 "iconName":"bo-g-draggable",
 "orderIndex":950000,
 "chosenAccessRight":false,"needCountMenuItem":false,"isPanel":false,"needHideInMobApp":false,
 "menuItemType":"GROUP"}
```

To put a BO item inside the group, add `"parentMenuItemCode":"<the GROUP's menuItemCode>"` to the item
(right after `menuItemName`); without the key the item is a root.

**`boPages` = the set of views of that item.** Six views exist; each has an `is*Enabled` flag and an
`*Index` = its tab position, 1-based, counted over the ENABLED views only (disabled ones carry 0). Always
write all twelve keys. What each view needs besides its flag:

| View | Keys | Needs on the BO / on the item | Status |
|------|------|-------------------------------|--------|
| list (registry) | `isListEnabled`, `listIndex` | nothing | `[C]` |
| kanban | `isKanbanEnabled`, `kanbanIndex` | `kanbanFieldCode` = code of a `DROPDOWN_SINGLE` of the BO (the columns) AND that field's card template in the BO's `kanbanCardTemplates` (0.5c) | `[C]` |
| calendar | `isCalendarEnabled`, `calendarIndex` | the BO's `isCalendarEnabled: true` and a date field (`FULL_DATE` with `needShowToCalendar`) — nothing on the item | `[C]` |
| timeline («Диаграмма Ганта») | `isTimelineEnabled`, `timelineIndex` | **`timelineFieldCode`** = code of a `PERIOD` / `PERIOD_TIME` field of the BO (the import resolves it into the item's `timelineFieldId`); the BO needs nothing else — a timeline template exists by itself for every such field | `[C]` |
| map | `isMapEnabled`, `mapIndex` | the BO's `isMapEnabled`, a `GEO_POINT`, and a kanban card template for every dropdown (0.5c) — nothing on the item; an archive item with `isMapEnabled:true, mapIndex:2` came back as shipped and its «Список / Карта» switcher showed the record's marker | `[C]` |
| grouping | `isGroupingEnabled`, `groupingIndex` | nothing works: the registry grouping view is 404 on the server (§2 «BO views») — never enable it | `[C]` dead |

List, kanban, calendar and timeline are proven (calendar and timeline: an item with both views built through
the API, exported, reset to list only, re-imported — both views back and both render).
**Do not switch on a `[U]` view in an archive** — if the user asks for a map or grouping, say it is not
verified and ship the rest. The kanban variant of `boPages` (kanban first tab, list second):

```text
"boPages":{"isKanbanEnabled":true,"kanbanIndex":1,
           "isCalendarEnabled":false,"calendarIndex":0,"isTimelineEnabled":false,"timelineIndex":0,
           "isListEnabled":true,"listIndex":2,
           "isMapEnabled":false,"mapIndex":0,"isGroupingEnabled":false,"groupingIndex":0,
           "kanbanFieldCode":"status"}          ← code of a DROPDOWN of that BO = the columns
```

Rules:

- **A `GROUP` line carries NO `boPages`, NO `bracketFilter`, NO `boCode`/`boName`** — the stand exports
  it exactly like that, and the import accepts it.
- **A `BO` line carries both `boPages` and `bracketFilter`**; `bracketFilter.boCode` repeats `boCode`,
  `brackets: {}` = no record filter (every record is shown); a non-empty filter imports whole `[C]` (shape in §5e).
- `kanbanFieldCode` appears ONLY when the kanban is on. It must be a `DROPDOWN_SINGLE` of that BO and the
  outer key of its `kanbanCardTemplates` — the columns alone give a board the stand cannot draw (0.5c).
- `boCode` may name a BO of THIS archive (the usual case) or a BO that is ALREADY on the stand — then it
  is a stand code, ask for it as in 0.2a (the importer resolves both). The same goes for
  `parentMenuItemCode`: a group of this archive, or the code of an existing group taken off the stand —
  **never guess a stand group's code**, menu codes made in the UI look like `GruppatqrXI0InJC5abW8w`
  (a transliteration plus random characters) and cannot be derived from the name. If the user gives no
  group code, ship your own GROUP line or make the item a root (drop `parentMenuItemCode`).
- `orderIndex`: the built-in root «Системные» is 60000; put your own roots after it (the probe used
  950000), children count inside their parent (the stand's own child had 10000).
- Put the GROUP line BEFORE its children. (A stand export listed a child before its group, so the
  importer probably tolerates any order `[I]` — but the one order proved on import is group first.)
- **Icons** `[C]`: `iconName` takes ANY name of the catalogue in **0.5e**, written with
  its prefix exactly as listed there — `"phosphor:house-line"`, `"menu-item:025-building"`. Without a
  wish from the user keep the defaults: `bo-g-draggable` for a group, `man-with-company` for a BO item,
  `bo-d-draggable` for a dictionary (these three have no prefix). **The importer does not check the
  name**: a name that is not in 0.5e analyses clean, applies (`APPLIED`), is stored verbatim — and the
  sidebar shows an EMPTY place where the icon should be. So every `iconName` must be copied from 0.5e;
  when the user describes an icon by meaning («домик», «деньги», «люди»), pick the closest name from
  0.5e and SAY which one you took. Never compose a name from memory of the Phosphor icon set: the stand
  ships only part of it (`phosphor:seal-check`, `ranking`, `toolbox`, `gavel` do not exist there).
- Menu access rights travel `[C]` (§5e): `chosenAccessRight: true` plus an `accessGroup` key —
  the same shape as `AccessStructDto.boAccessStruct` (`denyAll`, per action `{denyAll, participants,
  fromFields, orgUnitIds:["G-<group id>"]}`, only `view` matters for navigation). Without `accessGroup`
  keep `chosenAccessRight: false`.
- **A `menuItemCode` that already exists on the stand is an EDIT of that item, not a new one** `[C]`
  (§5e): the import overwrites its name, order, views and filter in place, keeping its id. So a menu
  code of your own must be new to the stand — never reuse a code seen on the stand unless the user asked
  to change THAT item. Re-importing your own regenerated archive is safe for the same reason: it updates
  your item instead of adding a second one.
- **A menu-only archive is legal** `[C]`: one `MenuItemStructDto` line and nothing else (no group line,
  no BO line) imports fine when its `boCode` is already on the stand — the way to add or change a sidebar
  item for an existing BO. The `boCode` is then a stand code: ask for it (0.2a).

### 0.5e Menu icons — the whole catalogue `[C]`

Every value `iconName` of a menu line (0.5d) may take besides the three defaults. It is the list the
sidebar's «Изменить иконку» picker offers — 1153 names in two namespaces — and every one of them was
checked to exist on the stand as the file `/assets/icons/<namespace>/<name>.svg` (HTTP 200); the sidebar
draws the icon from that file. Probe that proved the archive route: 0.5d «Icons» and §5e.

How to write a name: `<namespace>:<name>`, e.g. `phosphor:rocket`, `menu-item:025-building`. Names in
«» contain a SPACE, and the space is part of the name (`"menu-item:002-price tag"` — stored and drawn
as is `[C]`, the frontend URL-encodes it). «tab N (head icon X)» is the picker's N-th tab from the left and the picture on its header — it
only helps to find an icon in the UI and means nothing in the archive. The list lives in the stand's
frontend and may grow with a new build: `tools/menu-icons.bun.ts --stand https://<stand> --check --md`
re-reads it from a stand and prints this block again.

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

### 0.6 Codes the stand generates: label → code

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

**`ё` is not in the table — it becomes `_`** `[C]` (`<stand>`: a field «Зелёный счёт» got
`Zel_nyyi_sch_t`, an option «Зелёный» `Zel_nyyi`). Predict `ё` as `_`, never as `e`.

**A code that already exists on the stand may carry a random 14-character tail**
(`issuance_dateAew5UkKutBKvPg`) — that tail is part of the real code. When you patch an EXISTING BO,
read the codes off a fresh export instead of transliterating (§3).

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
  code and every new field, option and tab gets the transliteration of 0.6. Built that way, rename each code
  right after creating it (`MYBPM-UI-API.md` §5j «code» for a BO, `save-business-field-code` for a field;
  an option's code is kept as sent when the field is patched) — before any script, template or menu item
  refers to it.

### 0.7 Ids

Every `oldId` / `newId` is a **16-character** string over the alphabet
`A-Z a-z 0-9 @ ~` (e.g. `WbX5Wa8gcabbVbF1`, `3H84o9iM@G4jaOL3`, `Q0zI~z9Ra2R7Q3yd`). **Those three are
`<company-a>`'s — they show the shape, they are not values to copy** (0.2a).

- **Derive them deterministically from a seed** — e.g. take sha256 of `"bo." + <code>` and map the first
  16 bytes onto the alphabet. Reason: the stand keeps the archive's `oldId` as the BO's REAL id, so a
  re-import of a regenerated archive UPDATES the same BO instead of creating a duplicate. Random ids
  fork the object on every re-import.
- Which ids must be equal:
  - `BoStructDto.boGroupOldId` **=** `BoGroupStructDto.oldId`;
  - `BoProcessVersionsStructDto.oldId` **=** `BoStructDto.oldId` (processes only);
  - everything else is simply unique inside the archive.
- Field ids use `newId` (not `oldId`); the BO and the group use `oldId` (the group also carries a
  `newId`, any unique value).
- **A re-import matches the BO by `oldId` and its fields by `newId`, NOT by code** `[C]`
  (core2). An archive whose BO `oldId` was already imported, but whose field `newId`s were all fresh, was
  analysed with no error and no conflict, and applied. It **added** nine fields to that BO, next to the
  nine it already had, with the **same codes**: two «Текст» with code `Tekst`, two buttons `Plagin`, and so
  on. It also **rewrote the BO's `code` and name** to the archive's. Each imported field takes its `newId` as
  its real `fieldId`. So: keep a field's `newId` fixed between imports of the same BO (derive it from a seed,
  as above). When you copy an archive to make a NEW BO, change the BO's `oldId` as well as its `code`.
  Change the field `newId`s too: what happens when a new BO's `newId` equals a field id of ANOTHER BO is `[U]`.
  A stand export is safe to copy this way, since its ids are freshly minted (§2).

### 0.8 Layout in one rule

The form is a grid **15 columns** wide, and it **compacts vertically** — a hole is eaten and the cells
below float up. The safe layout, which is what the generator emits and what imports predictably:

> Every field: `"x": 0, "cols": 15`. `rows` = **4** for ordinary fields, **6** for `BO` / `LINK` /
> `FILE_UPLOAD`, **8** for `STATIC_TEXT`. The first field starts at `y: 0`, and each next field's `y` =
> the previous `y` + the previous `rows`.

That gives one full-width field per row, in order. Only reach for multi-column layouts (`cols: 5`,
three fields per row) after reading §4 — the compaction rules there are subtle and a wrong `y` silently
reshuffles the form.

### 0.9 The other four kinds — the diff from the plain-BO template

All four are still the SAME two lines of 0.3 + 0.4; only `category` and a few keys change.

| Kind | `category` | What changes |
|---|---|---|
| Бизнес-объект | `BO` | nothing — the template as is |
| Справочник | `BO_DICTIONARY` | the value of `dictionaryFields` **changes** to `["CODE","LABEL"]` (the key itself is on every BO, see below), and `dynamicFields` **starts** with the two REQUIRED system fields below — never drop either (0.10 rule 18); extra fields may follow |
| Панель | `BO_PANEL` | every entry of `dynamicFields` is a `type: "BO"` widget (extra keys in 0.5) with `"isReadonly": true`, `"isKindAddForSelect": true`, `"rows": 6`+ and `boRefStruct.fieldRefs` (the columns, at least one `toShow: true`) — it shows the whole registry; for a list the user fills instead add `"readFromRegistry": false` and drop `isReadonly` (§5a) — each one needs an `oldRefBoId` off the stand, so **with no ids a panel cannot be built at all** (0.2a) |
| Составной объект | `BO_COMPOSITE` | `"bos": [{"code","name","boCategory"}]` = the source BOs **by code — no id exists here, so this kind is never degraded to a plain `BO`** (0.2a). The code is resolved against the lines of THIS archive first and otherwise on the stand, so the sources may travel in the same archive, in any order (§5b). Every field carries `"boFieldCodes": [{"boCode","fieldCode"}]` (one link = простой атрибут, two+ = составной) — **every `fieldCode` must exist in that source BO or the import dies with `INTERNAL_ERROR`** (§5b) — and **no** `gridPosition` / `tableColOrderIndex` / `removeType` |
| Бизнес-процесс | `BO_PROCESS` | a **third line** `BoProcessVersionsStructDto` (§5c) whose `oldId` = the BO's `oldId`; the importer does NOT create `PROCESS_STATUS`, ship that field yourself — it is mandatory on every process (0.10 rule 18) |

**`dictionaryFields` is a key of EVERY BO, not a dictionary-only key.** The template of 0.4 already
carries `"dictionaryFields": []` and it stays there on a plain BO, a panel, a composite and a process.
The row above CHANGES its value, it does not ADD the key — deleting it from a non-dictionary is rule 6
of 0.10 all over again: import merges, a missing key keeps whatever the stand already had.

**`dictionaryFields` is the literal `["CODE","LABEL"]`, in capitals** — it is an enum, not a list of
field codes. The two system fields it refers to have the LOWERCASE codes `code` and `label`. Both
spellings appear, and they are not interchangeable: capitals in `dictionaryFields`, lowercase as the keys
of `dynamicFields`.

A dictionary's two system fields — the template of 0.5 with these values, at `y: 0` and `y: 4`,
`cols: 15`, `rows: 4`, `isSystem: true`:

- `code`: `"type": "INPUT_TEXT"`, `"isUnique": true`, `"isRequired": true`,
  `"label": {"rus":"Код","kaz":"Код","qaz":"Kod","eng":"Code"}`
- `label`: `"type": "INPUT_TEXT_LANG"`, `"isRequired": true`,
  `"label": {"rus":"Значение","kaz":"Мәні","qaz":"Mani","eng":"Value"}`

Dictionary row codes are **case-sensitive** (`MRP` ≠ `mrp`).

**A process and the `PROCESS_STATUS` id.** The importer does not create the status field, so the archive
must ship it (§5c). It is a `type: "BO"` reference to the built-in «Статус процесса» dictionary, and —
unlike any other reference — its ids need not be asked for: the importer resolves the dictionary and its
`CREATED` row BY CODE (0.2a) `[C]`. So:

- ship `PROCESS_STATUS` exactly as §5c prints it, **with `defaultValue` = the `CREATED` row id** and the
  `DEFAULT_VALUE` line for that row; both ids may be your own minted ones, used consistently. Without the
  default no record of the process can be saved (§5c);
- `PROCESS_STATUS` is mandatory on EVERY business process (0.10 rule 18). The importer would take a
  process without it and even run it (§5c) — that is not a licence: such a process is broken (no status,
  no default registry column).
- **Never substitute a local dropdown «Статус» for it** — that is an ordinary field with a similar name,
  nothing on the stand treats it as the process status, and the archive looks complete while it is not.
  And never paste `<company-a>`'s `Q0zI~z9Ra2R7Q3yd`.

### 0.10 Hard rules — violating any one of these breaks the import

1. Every `BoGroupStructDto` carries a `code` — the stand matches groups BY `code`; a line without one
   RENAMES a fixed stand group (0.3, §8). Several group lines are fine when each has its own `code`.
   A line for an EXISTING group repeats that group's `name` and `orderIndex` exactly — the import
   overwrites both (0.3).
2. `objectCount-<N>` in `metadata.mybpm` equals the line count of `0000001.mybpm`.
3. JSONL: one minified JSON object per line; no array wrapper; UTF-8; final newline.
4. Every line carries its `"@class"` with the full package
   `kz.greetgo.mybpm.reg.structure.model.dto.<DtoName>`.
5. `dynamicFields` is an object keyed by field code, and the key equals the field's `code`.
6. Never drop a key to disable something — write `false`. Import MERGES into what is on the stand. The
   only keys ever legitimately absent are `gridPosition` / `tableColOrderIndex` / `removeType` inside a
   `BO_COMPOSITE`, which has no form (0.9, §5b).
7. Codes ≤ 30 characters, latin letters, digits and `_`, named by the convention of 0.6a.
8. Ids are 16 chars over `A-Za-z0-9@~`, deterministic, and the three equalities of 0.7 hold.
9. `isRequired` + `isReadonly` both true = an unsaveable record.
10. Do not ship an `AccessStructDto` unless asked: import APPLIES it and **replaces** the rights set by
    hand on the stand with the archive's (§7, §8). Its `orgUnitIds` are `G-<group id>` of the TARGET
    stand — ids from another stand grant nothing.
11. Records (instance data) do NOT go into this archive — they are an xlsx, **Part III** of this document.
12. A `STATIC_TEXT` heading must not repeat any field label of the same BO (0.5). «Контакты» as a
    heading над полем «Контакты» breaks the Excel import of records (Part III, §19): the header row is
    matched against ALL fields including the headings, and the column becomes ambiguous. Name the
    heading for the SECTION («Контактные данные»), not for the field under it.
13. A field goes into the map that matches its ARCHETYPE: an ordinary field into `dynamicFields`, a
    «системное поле» into `nativeFields` (0.5a), a widget into `signatures` / `buttons` / `iframes` /
    `captcha` / `currentDates` / `currentUser` (0.5b). Putting a widget or a native type into
    `dynamicFields` is not a valid archive.
14. A menu line (0.5d) names its parent, its BO and — only when a kanban is on — its column field BY
    CODE, and carries no id.
    A `GROUP` line has no `boPages` / `bracketFilter`; a `BO` line has both. A `kanbanFieldCode` whose BO
    carries no card template for that field gives a kanban that cannot be drawn (0.5c).
15. **Every BO shows at least one field in its registry** (`tableColToShow: true` on at least one
    field) **and every `BO` / `CO` reference field shows at least one field of its target**
    (`boFieldCodes` / `boFieldRefs` with `toShow: true`). This is a rule from the platform team
   . Without a column the registry answers `AccessDenied` and lists nothing; without a
    shown field the reference renders empty (`MYBPM-UI-API.md` §0U.5 rule 11, traps 48 and 53).
16. **Every `DROPDOWN_SINGLE` of a BO has a kanban card template** — `kanbanCardTemplates.<dropdown code> =
    {"kanbanFields": {"<a field code>": {"cardOrderIndex": 0, "locationType": "HEADER", "archetype": "DYNAMIC"}}}`,
    even when no kanban was asked for. Without it the BO's map, kanban and kanban editor die with «cardTemplate
    is null» once a record exists (0.5c, §2 «BO views», trap 32).
17. **Every BO line has a numeric `orderIndex` of its own** — a missing one lands as `null` (top of the group),
    and the template's 47480000 shared by several BOs makes them impossible to reorder by drag; a re-import also
    MOVES an existing BO to the archive's group and place (§2 «BO place in the sidebar»).
18. **The platform's mandatory system fields are always shipped** — a rule from the platform team
   . Every business process (`BO_PROCESS`) carries `PROCESS_STATUS` (§5c: `type: "BO"`,
    `isSystem`, `isRequired`, `defaultValue` = the `CREATED` row + its `DEFAULT_VALUE` line); every
    dictionary (`BO_DICTIONARY`) carries `code` and `label`, both `isRequired` (0.9). The importer does not
    add them and does not complain when they are missing — the archive looks fine and the object is broken.
    Its ids are resolved by code on import (0.2a), so nothing stops you shipping it — never a process without it.

### 0.11 Self-check before shipping

- [ ] `unzip -l` shows exactly two members, both inside one `data-*/` folder.
- [ ] `unzip -p <zip> 'data-*/metadata.mybpm'` prints `objectCount-<N>`, and
      `unzip -p <zip> 'data-*/0000001.mybpm' | wc -l` prints the same N.
- [ ] Every line parses on its own (`unzip -p <zip> 'data-*/0000001.mybpm' | bun -e 'for (const l of (await
      Bun.stdin.text()).trimEnd().split("\n")) JSON.parse(l)'`). `JSON.parse` of the whole member at once
      MUST fail — that proves it is JSONL.
- [ ] `boGroupOldId` == the group's `oldId`.
- [ ] 0.10 rule 15, on EVERY BO including a process: at least one field has `tableColToShow: true`, and every
      `BO` / `CO` field has a `fieldRefs` entry with `toShow: true`. `tools/validate-archive.bun.ts` reports
      both as `ERROR §0.10/15`.
- [ ] 0.10 rule 18: every `BO_PROCESS` has `PROCESS_STATUS` (required, system, with its `CREATED` default and
      the `DEFAULT_VALUE` line); every `BO_DICTIONARY` has `code` + `label`, both required. The validator
      reports a missing one as `ERROR §0.10/18`; the generator refuses to build without them.
- [ ] Every `dynamicFields` key equals its entry's `code`, and every `newId` is distinct.
- [ ] Every `nativeFields` key equals its `nativeFieldId`, and every widget map key equals that widget's
      `code`; no widget or native type hides in `dynamicFields`.
- [ ] The `y` of each field == previous `y` + previous `rows`.
- [ ] `tableColOrderIndex` runs 0, 1, 2… down `dynamicFields` — not `0` on every field (0.5).
- [ ] Every local list is `"options": {…}` — an OBJECT keyed by the option code, each entry wrapped in
      `fieldOption`, its `label` a plain string (0.5).
- [ ] Every new code follows 0.6a: English snake_case; objects, groups and menu items `Capitalised`, the
      rest lower case; `is_*` on a checkbox, `tabs` / `tabs_*` on a TAB_GROUP, `tab_*` on a tab; ≤ 30 chars.
- [ ] Every group line has a `code`: an existing group's code confirmed by the user, or a new code for a
      group the archive creates (0.2a, 0.3).
- [ ] No `oldRefBoId` / dictionary code in the file was invented; every one came from the stand, or from
      an EARLIER line of this same archive (0.2a).
- [ ] For a `BO_COMPOSITE`: every `bos[].code` is either a BO line of this archive or a code the user
      gave off the stand, and every `boFieldCodes[].fieldCode` really exists in that source BO —
      a missing field code crashes the import with `INTERNAL_ERROR` (0.2a, §5b).
- [ ] No id literal was copied out of this document — the sample's ids are `<company-a>`'s (0.2a).
- [ ] No `STATIC_TEXT` heading repeats a field label of the same BO (0.10 rule 12).
- [ ] Every field's `rows` is tall enough for its content — a heading band, an HTML text, an `<iframe>`, a
      table — so nothing scrolls INSIDE a field on the card (≈29 px per row; a two-line heading needs
      15×4, see §4). After the import, open a record and check it (`MYBPM-UI-API.md` §0U.6).
- [ ] EVERY entry of `dynamicFields` carries `tableColOrderIndex` — including `STATIC_TEXT`,
      `TAB_GROUP`, `PROGRESS_BAR`, `QUESTIONNAIRE`, `FILE_UPLOAD` (0.5; only a `BO_COMPOSITE` is exempt).
- [ ] `dictionaryFields` is present on EVERY BO line — `[]` everywhere, `["CODE","LABEL"]` on a
      dictionary (0.9).
- [ ] Nothing was quietly built INSTEAD of what was asked: no panel turned into a set of plain BOs, no
      составной объект turned into a plain BO because «the ids are unknown» (it takes codes, 0.2a), no
      `TAB_GROUP` replaced by `STATIC_TEXT` headings, no `PROCESS_STATUS` faked as a local dropdown
      (0.2a, 0.9). Only a missing stand id or stand code ever justifies a degrade.
- [ ] Menu lines (0.5d), if any: every `menuItemCode` is NEW to the stand (an existing one is edited in
      place) unless the user asked to change that very item;
      every `parentMenuItemCode` is a GROUP line of this archive or a code the
      user gave off the stand; every `boCode` is a BO line of this archive or a stand code; every
      `kanbanFieldCode` is a `DROPDOWN_SINGLE` of that BO AND a key of its `kanbanCardTemplates`; no
      `GROUP` line carries `boPages` or `bracketFilter`; every `iconName` is one of the three defaults
      or a name copied from 0.5e WITH its prefix (the importer accepts a wrong name silently).

### 0.12 Building and delivering

Ready-made generator, already verified on a live stand — prefer it over writing a new builder.
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

A BO plus a sidebar item that opens it — plain navigation, list view only (0.5d; this output is
byte-identical to the 0.5d template and passes `tools/validate-archive.bun.ts`):

```
bun tools/make-probe-archive.bun.ts --group-code <код группы> --group-name "<имя группы>" --group-order <orderIndex группы> --code Request --name "Заявки" --field "Наименование:INPUT_TEXT!req" \
    --menu "Заявки:BO@Request@Заявки!code=Requests!order=950000"
```

Add `!parent=<GROUP code>` to put the item into a group (plus a `--menu "Имя:GROUP!code=…"` if the group
travels in the same archive), `!kanban=<dropdown code>` for a board, `!icon=<name from 0.5e>` for an
icon (`!icon=phosphor:rocket`, `!icon=menu-item:025-building`). A BO with a kanban and its own
sidebar group, all in one archive — the exact command whose result was applied and drawn on a stand
(0.5c, 0.5d):

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

The generator covers ALL 27 field types, the six system fields and all ten widgets `[C]` (the
archive below was generated, imported through the API and read back field by field):

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

If you must build the zip yourself, STORED entries are enough. Bun has no zip API; `tools/zip.ts` writes a
STORED archive with UTF-8 names (run this as a `*.bun.ts` from the repository root):

```ts
import { zip } from "./tools/zip.ts";
const lines = [line1, line2];               // objects, in order
const d = "data-2026-09-18T10-43-21-715";
const enc = new TextEncoder();
const payload = lines.map((o) => JSON.stringify(o)).join("\n") + "\n";
await Bun.write("out.mybpm.zip", zip([
  { name: `${d}/0000001.mybpm`, data: enc.encode(payload) },
  { name: `${d}/metadata.mybpm`, data: enc.encode(`objectCount-${lines.length}`) },
]));
```

**Delivering it — the minimum** `[C]` (the full transport is `MYBPM-UI-API.md` §5 / R3,
this is enough without it). An import is TWO-PHASE: the upload only ANALYSES, one deliberate step writes.

- **UI**: open `<stand>/settings?settingsOpenPageUrl=import_export&formType=import` (navigate by URL — the
  «Настройки» item sits wherever that company put it in the sidebar), «Импортировать файл», pick the zip.
  A log row «Импорт проанализирован» appears — nothing is written yet. Click the row: «Ошибки» (must be
  empty), one node per object with its pre-apply diff («Добавленные поля» …), and «Описание импорта» —
  **required**, applying without it ends in `DESCRIPTION_ERROR`. Then ПРИМЕНИТЬ → «Импорт выполнен».
- **API**: `bun tools/api-import-structure.bun.ts <archive.mybpm.zip> --stand https://<stand>
  [--token-file PATH] [--apply --description "что и зачем"]` — without `--apply` it stops at the dry run
  (status `ANALYZED`) and prints the errors and the per-object list; `--cancel` drops it. Token = the
  browser's `localStorage.LOCAL_PRIVATE_SwebToken` without its JSON quotes, or `$MYBPM_TOKEN`. The calls
  underneath, all `POST <stand>/web/import-structure/<method>`: `import-file` (multipart, field `file`) →
  `insert-file-data` → `analyze-file-data` → read `load-import-errors` / `load-import-bo-infos` →
  `save-import-description` → `apply-import`. Only ONE import may be open per company at a time.
- **Calling a `/web` endpoint by hand** (the rollback below, the script check of §5d): `POST`, header
  `token: <the token, no quotes>`, `Content-Type: application/json`, and ALWAYS the envelope
  `{"useParamsFromBody": true, "params_Lr1oSgwPR8": {…}, "body_o1nhHUG480": {…}}`. In this document
  `P {…}` means «goes into `params_Lr1oSgwPR8`», `B {…}` «goes into `body_o1nhHUG480`» (send `{}` for
  the other half); a key in the wrong half has answered 200 and done nothing (seen twice). Answer = the bare DTO / string.
- **Rollback**: `import-structure/load-import-rollback-preview` `P {importId}` lists what it would
  delete / restore; `v2/process-indicator/pre-create-process` `P {}` → a fresh `processId`; then
  `import-structure/rollback-import` `P {importId, processId}` → `{"type":"ROLLED_BACK"}` undoes it (BOs
  and menu items alike; the process may finish at 25 %, do not wait for 100). Only the import the stand
  flags `canRollback: true` can be undone, and «latest» is the stand's ranking, not yours — the log keeps
  minutes, and inside one minute the FIRST-applied import counts as the newest. Undoing an import that UPDATED something restores the SNAPSHOT it
  found, silently dropping anything applied after it; undoing a chain is safe only all the way back to
  the import that CREATED the objects. When you may need to undo, leave a minute between applies.

**Always read the analysis result before pressing ПРИМЕНИТЬ** — «В Составном объекте не достаёт БО»
does not block applying. Over the API read `load-import-errors` of the SAME `importId` (it carries the UI
dialog's errors) AND `load-import-data.status` (`INTERNAL_ERROR` = an analyzer crash, no error record).

---

## 1. Zip layout and parsing

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
  (different per company — read them from a stand export). It has **no** stand host/URL, so record the
  stand URL in project memory. Copying another company's CompanyMetadata ids (`<company-b>` → `<company-c>`)
  imported fine. `[C]`
- **`CompanyMetadataStructDto` is OPTIONAL** `[C]`: a hand-made **2-line**
  archive (`BoGroupStructDto` + `BoStructDto`, `objectCount-2`, no access DTO) was analysed with an empty
  error list and applied — the BO was created with both fields. Ship the line only when the archive
  actually references Person/Department/PersonGroup.
- **Group `oldId`/`newId` are generated at EXPORT time, not stable ids** `[C]`: the same `<company-a>` group
  «Тест» carries `ICHLTlIHbLLBzxoI`, `wNARkY1IRHHtHbv9`, `fKsRKOK@JrbB@UM6`, `LEl3hxwYMOiuY7Fa` in four
  exports; «Матрицы» changed between builds too. So `boGroupOldId` only ties the lines of ONE archive
  together, and the importer cannot be matching groups by it — see §8.
- **The stand keeps the archive's `oldId` as the BO's real id** `[C]` (`<company-a>`: the generated
  `oldId: "Zyvu00@DV5VPL69g"` appeared verbatim in the registry URL; confirmed a second time on an
  API-imported BO, whose `oldId "d9OrTqCb7O97FFY4"` came back from
  `v2/business-objects/load-bo-id-by-code`). Deterministic ids therefore address the same BO on every
  re-import — one more reason to seed them, never randomise.
- **A generated archive may be STORED (zip method 0)** `[C]` — the importer accepts it; no compression
  needed. Generator: `tools/make-probe-archive.bun.ts` (Bun, own minimal zip writer, deterministic
  sha256-seeded 16-char ids; `--code`/`--name` mint a new BO, `--with-metadata` adds
  `CompanyMetadataStructDto`). Ship it to a stand with `tools/api-import-structure.bun.ts` — the API
  import route, `MYBPM-UI-API.md` §5.
- Use **deterministic ids** in a generator (e.g. sha256 of a seed) so a re-import updates instead of
  duplicating.

## 2. What an export actually contains

- **Only the objects selected at export time.** A one-BO export holds that BO alone; 17 `<company-b>`
  archives contained no `Model`/`Model_step`; one held only the 21 dictionaries. A tool scanning a folder
  of exports must pick the newest archive that actually contains the wanted BO. `[C]`
- **Structure as of export time only.** After renaming/adding/deleting fields take a fresh export: an
  older export showed no tabs though the user had split fields since; another still held removed
  fields; an earlier dump lacked 17 STATIC_TEXT headers that a later archive had. `[C]`

### What an export carries per BO — the map list `[C]`

A `BoStructDto` of 4.24.25.632 has these keys: `oldId code category kind boGroupOldId instanceViewType
bos boTabs printForms name recordName staticValue description orderIndex dynamicFields nativeFields
dictionaryFields actual isCalendarEnabled isMapEnabled isGroupingEnabled isCodeReadonly
chosenAccessRight isTouchEnabled hideAddButtonFromRegistry kanbanCardTemplates timelineTemplates calendarCardTemplates signatures buttons
iframes currentDates captcha currentUser`. The last six are the widget maps (§0.5b), `nativeFields`
holds the system fields (§0.5a). A key whose value is `null` on the stand is left out: a panel built in
the constructor has no `instanceViewType` at all `[C]` (two stand exports of panels), while one that came in by import carries the `FORM` it was given. Build S4.24.25.643 also writes, after `instanceViewType`, the registry's
default sort **`sortFieldCode`** (a field CODE) + **`sortFieldOrder`** (`ASC`|`DESC`) — absent while the
sort is unset. They travel both ways `[C]` (`Chislo DESC` set through the API came out in the
export; an archive with `Data ASC` set the stand's `load-bo-table-sort` to that field and order). The same
setting orders a nested table of this BO on another card (`MYBPM-UI-API.md` §5i).

### BO header settings in the archive `[C]`

Six BO-level keys of the header and its gear popover, proven on a probe set over the API, exported, imported
as a copy under a new code, then re-imported with every value flipped:

| key | values | what it does |
|---|---|---|
| `name` | `{rus: …}` | the BO's name (sidebar, registry title, the record name when no field has `titleToShow`) |
| `recordName` | `{rus: …}` | stored and exported, shown NOWHERE — not even as the fallback record name; the constructor's name input overwrites it with the name |
| `description` | string | the header text under the name |
| `instanceViewType` | `FORM` \| `TAB` | a record opens as a dialog / as a page tab |
| `isTouchEnabled` | boolean, new BO `true` | «Помечать новые (непросмотренные) записи»; gates the unread-counter option of a menu item `[I]` |
| `hideAddButtonFromRegistry` | boolean, new BO `false` | the registry has no create button (Excel import and the API still create) |

- All six round-trip: the export writes them, a copy import set them, a re-import of the same `oldId` with
  other values UPDATED all of them.
- **A re-import WITHOUT a key resets it** — `isTouchEnabled` → `true`, `hideAddButtonFromRegistry` →
  `false`, `instanceViewType` → `FORM`, `description` → `null`, although the stand had set
  `false`/`true`/`TAB`/text a minute before. Ship every key of §0.4 on every re-import.
- `code`: a re-import of the same `oldId` under another code renames the BO's code (`MYBPM-UI-API.md` «Checking the result of a
  structure import», «Fields are matched by newId») — without the stand's usage analysis, so scripts naming the old code break.
- Stand-side setting of each key: `MYBPM-UI-API.md` §5j.

### BO card tabs in the archive — `boTabs`, `messengerFieldCode`, `whatsAppFieldCode` `[C]`

The record card's right-hand rail (constructor: card editor → `+` on the rail). Proven on a probe set over the
API, exported, imported as a copy, then re-imported four times.

| key | values | what it does |
|---|---|---|
| `boTabs` | a MAP `{"<TYPE>": <orderIndex>}`, types `CHAT` «Чат», `PEOPLE` «Люди», `FILES` «Файлы», `HISTORY` «История», `PRINT_FORM` «Печатные формы», `TELEGRAM`, `WHATSAPP` | one icon per tab on the record card, top to bottom by the number. CHAT = the record's chat with its participants, PEOPLE = its participants, FILES = files attached to the record («Загрузить файл»), HISTORY = the change journal (§3 «Field flags»), PRINT_FORM = the print forms (`printForms`, §0.5b) |
| `messengerFieldCode` | a field code of this BO; absent when unset | the **Telegram** link field — the field whose value (a login for `INPUT_TEXT`, a phone for `INPUT_PHONE`) ties a record to a messenger chat |
| `whatsAppFieldCode` | the same | the **WhatsApp** link field |

- **Export writes, a copy import sets, all three keys** — `{"CHAT":2,"FILES":1,"PRINT_FORM":3,"TELEGRAM":4}` came
  out of an export, and a copy with `{"PEOPLE":1,"WHATSAPP":2,"HISTORY":3}` landed exactly so.
- **A re-import only ADDS tabs and renumbers the listed ones** — it never removes one. Re-importing
  `{"PEOPLE":1}` over `PEOPLE/WHATSAPP/HISTORY` left all three; re-importing `{"HISTORY":1,"PEOPLE":2,"CHAT":3}`
  gave `HISTORY:1, PEOPLE:2, WHATSAPP:2, CHAT:3` (the unlisted tab kept its old number, two tabs now share
  2). There is no `delBoTabs` key in the archive: **a tab is removed only on the stand** (constructor trash
  icon or the API, `MYBPM-UI-API.md` §5k). So a generated archive should list the FULL set with distinct
  numbers, and a removal is a separate stand-side step.
- **The two link keys, one per messenger** — an export of a BO with only the Telegram link writes only
  `messengerFieldCode`, with only the WhatsApp link only `whatsAppFieldCode`, with neither none of them; an import
  sets `tgLinkFieldId` / `waLinkFieldId` from them. **A re-import WITHOUT them, or with `null`, leaves the stand's
  links alone** (unlike the header keys above, which reset) — so an archive cannot clear a link; do that on the
  stand (`MYBPM-UI-API.md` §5k).
- **An export taken seconds after a link change may still carry the OLD link** `[C]` — the stand serves the
  links from a cache that lags a few seconds (an export right after clearing the Telegram link still wrote
  `messengerFieldCode`). Wait ~10 s between changing a link and exporting.
- **`TELEGRAM` / `WHATSAPP` tabs import without any check** — the stand had no messenger connected and the
  BO was not in the company messenger list, yet the tabs landed and show on the card. Without a link field the
  Telegram tab answers «no filed with id =null» on click; with one it is shown disabled. The constructor cannot
  untick such a tab (its checkbox is disabled until the BO is in the company messenger list), so do not ship
  them unless the company uses that messenger.
- Stand side of these keys: `MYBPM-UI-API.md` §5k.

### BO views in the archive — `isCalendarEnabled`, `isMapEnabled`, `isGroupingEnabled`, `groupingInfo` `[C]`

The registry views «Календарь», «Карта», «Группировка» of the BO itself. Proven on probe BOs: switched over the API,
exported, imported as a copy, re-imported with the flags off and on again, and looked at with records.

| key | where | what it does |
|---|---|---|
| `isCalendarEnabled` | BO | «Календарь» in the registry's view chooser; events on the date fields (`needShowToCalendar`, §3) |
| `isMapEnabled` | BO | «Карта» — one marker per record at its `GEO_POINT` value; the marker popup shows the KANBAN card fields |
| `isGroupingEnabled` | BO | «Группировка» — see the warning below |
| `groupingInfo` | each field | `{"nodeTreeActive": true, "nodeTreeLevel": 0}` = a tree level (a `BO`/`CO` field with `viewType` `SINGLE`/`MULTIPLE`), `{"colToShow": true, "colOrderIndex": 0, "nodeTreeActive": false}` = a column; `{}` = not used |

- All four round-trip: the export writes them, a copy import sets them, **a re-import with `false` / `{}` resets
  them** (and with `true` / the map sets them again). Ship the stand's values on every re-import.
- **A map needs a kanban card template for EVERY `DROPDOWN_SINGLE` of the BO** — not only for a kanban. An archive BO
  with a dropdown and an empty `kanbanCardTemplates` loses its map, its kanban view and the constructor's kanban
  editor to «cardTemplate is null» as soon as it holds a record (0.5c). Give each dropdown a template
  (`"<dropdown code>": {"kanbanFields": {"<name field code>": {"cardOrderIndex": 0, "locationType": "HEADER",
  "archetype": "DYNAMIC"}}}`); its fields are what the map popup shows.
- **Grouping renders nothing on this build** — the registry «Группировка» calls server methods that answer 404
  (`MYBPM-UI-API.md` §5l, trap 62). The flag and `groupingInfo` store and travel; do not promise a user a grouping view.
- **The calendar's event-title fields do NOT travel** — no key in the export; a re-import leaves the stand's titles,
  a new BO gets a default. Set them on the stand (`v2/calendar/save-calendar-view-titles`, `MYBPM-UI-API.md` §5l). The
  calendar hover card is `calendarCardTemplates` (travels, `MYBPM-UI-API.md` §5i).
- Nothing checks that a map has a `GEO_POINT` or a grouping a reference field — the flag is accepted either way.
- Generator: `tools/make-probe-archive.bun.ts --calendar --map --grouping`, a level by
  `--field "Связь:BO@<boId>@Code!viewType=SINGLE,groupingInfo.nodeTreeActive=true,groupingInfo.nodeTreeLevel=0"`.
  Stand side: `MYBPM-UI-API.md` §5l.

### BO place in the sidebar — `boGroupOldId`, `orderIndex`; clones and the iframe URL do not travel `[C]`

Where the BO sits in the constructor's left list. Proven on a cloned probe: moved to a group without a code over the
API, exported, the group line pointed at another existing group by `code`, `orderIndex` changed, re-imported; then
re-imported without `orderIndex`.

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
**the BO's own archive carries none of them**: a stand export of a BO that is on every list below (exported with
structure, rights and scripts) has no key for any of them, and a re-import of that BO leaves all of them in place.
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
  field code. The other keys of the payload were exported empty and the import of a `SCRIPT_SETTINGS` line left the
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

Every kind of the settings basket was set on the stand, exported alone, changed on the stand, and the export imported
back; the original state was restored afterwards. A settings line is always
`CompanySettingsStructDto {kind, payloadJson}` (`payloadJson` a JSON STRING); next to it the export puts a
`CompanyMetadataStructDto` line, and for every ORG UNIT a kind names, an `ExportStructInstanceDto` record line of that
unit (`boCode` `Department` / `PersonGroup`, `fieldMap` with `name` and the unique `ID`, `sources [{sourceType:
"SETTINGS", settingsInstanceSource:{settingsKind}}]`). The import of a unit's line found the existing unit — no
duplicate was created. Each kind shows in the analyzer as one item named after its settings page, `structTypes
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
| `TELEPHONY`, `IN_MIGRATION`, `OUT_MIGRATION`, `APPEARANCE` | `telephony*` / `in/outMigrationAllowBoExports` / nothing | not run `[U]`: no telephony provider and no Kafka on the reference stand; APPEARANCE belongs to one company per stand |

Rules that follow:
- **Ship a settings kind only from a fresh export of the TARGET stand's own state, edited** — the replacing kinds
  (OFFLINE, MOBILE, LANGUAGES, SCRIPT_SETTINGS) delete what the archive lacks, and AUDIT_TRAIL hits the first row.
- What never travels and must be set on the target stand by API (`MYBPM-UI-API.md` §5n): the OTP department, the
  Google Maps key, messenger BO / user lists and the chat registry, every audit row but the first.
- Org-unit ids (`D-<id>`, group ids) are stand ids; the record line next to them lets the import find the unit by
  its unique `ID` field — across stands this is `[U]`.
- **No import removes** a physical-removal rule, an OTP row, a navigator row or a migration monitor; and the API
  cannot unset the migration monitor either (`monitorBoId` null / `""` → error). Before importing a kind onto a
  stand that should stay clean, export that kind first so you can put it back.

**Export ids are regenerated on every export** `[C]` — exporting the same BO twice gives different
`oldId` / `newId` / widget ids, and none of them is the stand's real id (the BO whose stand id is
`y5VYjeIOYlfTFjLk` exported as `i6Vrk~4xojztuSlb`, then as `pCzbqJxw1OuEbhvM`). Deterministic ids are
worth deriving in a GENERATED archive (§0.7, so that a re-import updates instead of forking), but never
expect a downloaded export to carry them.

Besides the BO lines an export may carry, per BO, a `BoScriptVersionsStructDto` plus one
`ScriptDefStructDto` per non-empty script (the «Скрипты» checkbox of the export basket, §5d), an
`AccessStructDto` (§7) and `ExportStructInstanceDto` record lines (§5, §5c). Menu items are NOT per BO:
they come from a basket of their own on the export screen and arrive as `MenuItemStructDto` lines (§5e).

An export also starts with a `CompanyMetadataStructDto` line — `{personBoId, departmentBoId,
personGroupBoId}` — which on the reference stand is `I1fVTkYPTSg7X8b8` / `4cQAePlhkxrCGMW6` / `O5d@0F1zrMUmpkUt`
`[C]` (the ids in older exports of this stand differ, so read them off a fresh export).

## 3. `BoStructDto` and `dynamicFields`

- **`dynamicFields` is an OBJECT keyed by field code, not an array.** Iterating it as an array throws
  `{} is not iterable` — use `Object.entries` / `.items()`. Hit several times in practice. `[C]`
- Per field: `code`, `label.rus`, `type`, `isRequired`, `isUnique`, `removeType`, `tabCodePath`, plus
  per-type keys (`staticValue` for STATIC_TEXT, `fieldOptionsStruct` for DROPDOWN_SINGLE,
  `tableColOrderIndex`, …). **Labels can carry leading spaces — always strip.** `[C]`
- **Field-code collision suffix:** a code may carry a random **14-char** tail, e.g.
  `issuance_dateAew5UkKutBKvPg`. That is the real code and generated constants must reproduce it.
  Origin `[I]`: the constructor appends it when a typed code collides. Renaming the code afterwards works
  `[C]`; code generated from an older export keeps the stale code.
- `removeType: STRIKETHROUGH` sits on **all** fields (132/132 on `Request`) — it is **not** a
  "deleted" flag. `[C]`
- `isRequired` is false on every UI-built field except the ones the user ticked. `[C]`

### Field types — the whole enum `[C]` (read off the client bundle, chunk `9839` module `10234`, and probed type by type)

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

Distribution seen in `Request` (132 fields): 75 INPUT_NUMBER, 24 CHECKBOX, 16 DROPDOWN_SINGLE,
9 INPUT_TEXT, 4 DATE, 3 BO, plus 29 STATIC_TEXT in the later dump.

**Superseded**: an earlier version of this document listed `USER_DROPDOWN_MULTI`, `CHECKBOX_GROUP` and
`BUSINESS_OBJECT` as members of the enum. They are only i18n keys left over in the translation
dictionary (`form_field_type_user_dropdown_multi` = «Пользователь/сотрудник»,
`form_field_type_checkbox_group` = «Чек лист», `form_field_type_business_object` = «Бизнес объект») —
the enum of 4.24.25.632 has none of them.

### The three archetypes `[C]`

`boFieldArchetype` (constructor DTO) / `archetype` (archive) tells the three families apart, and each one
has its own generator and its own place in the archive:

| archetype | what it is | constructor endpoint | in the archive |
|---|---|---|---|
| `DYNAMIC` | an ordinary field | `generate-business-form-field {boId, fieldType, fieldBoId?}` | `dynamicFields`, keyed by code |
| `NATIVE` | a system field | `generate-business-form-field-by-native {nativeType}` | `nativeFields`, keyed by the native type (§0.5a) |
| `WIDGET` | a widget | `generate-business-form-widget {widgetType}` | one of six widget maps, keyed by code (§0.5b) |

A widget DTO carries `widgetType` and a **null** `type`; a native one carries `nativeFieldType` plus the
`type` the platform fixed for it. The client resolves a form element as
`nativeFieldType ?? widgetType ?? fieldType`.

### Field flags

`isUnique`, `isRequired`, `isReadonly` (**never required + readonly together** — the record cannot be
saved), `isSystem`, `tableColToShow` (shown as a registry column), `tableColOrderIndex` (**not** an
export switch), `removeType`, `hideLabel`, `chosenAccessRight` (individual rights set),
`isKindAddForSelect`, `isHeightDynamic` (tables), `tableWidth` (registry column width in px; the small
numbers inside nested tables are in unverified units).

**Dates: `dateOnlyPast` / `dateOnlyFuture`** `[C]` — plain booleans on a `DATE`,
`FULL_DATE`, `PERIOD`, `PERIOD_TIME`, `YEAR` or `YEAR_AND_MONTH` field (not `TIME`). The key names what
is ALLOWED: `dateOnlyPast: true` = the constructor's «Будущие даты недоступны для выбора» (the picker offers
today and earlier), `dateOnlyFuture: true` = «Прошедшие даты недоступны для выбора» (today and later). Never
both `true` — the UI cannot produce it. Imported, exported and honoured by the record picker exactly like a
constructor-built field; today and the current month/year stay selectable. **Only the picker enforces it** —
the record API stores any date `[C]`; scripts and an xlsx import presumably too `[I]`. Generator: `--field "Срок:DATE!dateOnlyFuture=true"`.

**Six more gear flags** `[C]` — plain booleans on the field, imported, re-imported
(an existing BO code is updated in place) and exported exactly like the constructor's, and verified on
records of the imported BO:

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
  status by those ids and the calendar colours by them. **The id is the options map KEY**: a new BO got the
  keys as its option ids even with `newOptionId` set to other values `[C]` (probe «Проба ключ статуса»,
  `newOptionId` = «aaaaPLANNEDaaaaa»… → ids PLANNED…), which is why a stand export — keys
  `PLANNED`…, random `newOptionId` — round-trips intact. The key differs from `fieldOption.code` here, the
  only place it does. A stand export shows the wrapper with its
  stand id as `code` (the constructor leaves the wrapper's code empty); any code works. Generator:
  `--field "Срок:DATE!track"` builds all three.
- **A nested `BO` field's table columns** are `boRefStruct.fieldRefs` keyed by the TARGET BO's field codes:
  `{"Strana": {"toShow": true, "orderIndex": 0}, "Gorod": {"toShow": true, "orderIndex": 1}}` (a stand export
  adds each column's `gridPosition`). With `fieldRefs: {}` the importer lists the target's fields with
  `toShow: false` and the table has no columns at all. Generator: `!show=Strana|Gorod`.

**«Поведение» and «Интеграция» of a field** `[C]` — plain keys on the field,
imported and exported exactly as the constructor writes them; the per-type ones verified on records of an
imported BO (probe «Проба поведения архив»):

| key | types | the constructor's control | on the record |
|---|---|---|---|
| `textCase: "UPPER"` / `"LOWER"` (template `"NONE"`) | `INPUT_TEXT` | «Поведение» → «Только заглавные / строчные буквы» | a wrong-case value is NOT converted — the field shows «Недопустимый текстовый регистр» and the card will not save. Digits, spaces, punctuation pass; Cyrillic is checked too |
| `maxLength: <n>` (absent / `0` = no limit) | `INPUT_TEXT`, `INPUT_TEXT_LANG`, `INPUT_NUMBER` (≤ 21), `TEXTAREA`, `TEXTAREA_LANG` | «Поведение» → «Включить ограничение длины» + the number | the input stops at n characters; a longer value (a paste into a `TEXTAREA`, whose editor does not cut) shows «Достигнута максимальная длина символов» and the card will not save. For `INPUT_TEXT_LANG` the limit applies per language |
| `isSeparated: true` | `INPUT_NUMBER` | «Отображение» → «Делить на разряды» | `1234567` shows as `1 234 567` (the stored value stays `"1234567"`) |
| `params: {"enableSequence": "true"}` | `INPUT_NUMBER` | «Поведение» → «Счётчик» | a new record's field is pre-filled with the next number of a per-field counter (1, 2, …). **Every opened draft takes a number, saved or not**, so the numbers have gaps. The value stays editable |
| `params: {"url": "call/plugin/<name>"}` | `LINK` | «Поведение» → «URL» | only a value starting with `call/plugin/` does anything: clicking the link then calls the server plugin (`link/call-plugin`) instead of opening the field's value. Any other `url` is ignored — the link opens its own value `[C from the client code; the plugin call not run]` |
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

**Reference fields (`BO` / `CO`) — their settings in an archive** `[C]` (`<stand>`: exported, then
imported into NEW BOs and re-imported into the same ones, every row checked on records). Every key sits on the
field in `dynamicFields`; the field links are by CODE:

| key in the archive | constructor control | import | on the record `[C]` |
|---|---|---|---|
| `viewType` `"TABLE"` / `"MULTIPLE"` / `"SINGLE"` / `"FIELDS"` | «Вид отображения» | `[C]` | table / chips / one chip / the record's fields as a form. A `SINGLE` field keeps only the FIRST id of a value it is given |
| `isKindAddForSelect: true` | «Только добавление» | `[C]` | «Добавить» creates a referenced record instead of picking one |
| `boRefStruct.linkedFieldCode: "<code>"` (NOT a top-level key) — the code of a field of the REFERENCED BO that points back | «Связь объектов» → «Заполнить поле» | `[C]`, also when the two BOs reference each other inside the same archive (any line order) | adding a record fills its back field with the owner record; removing it clears it. The export writes it on BOTH ends of the pair; one back field serves only ONE field (the constructor greys the others out: «Невозможно - уже существует связь с полем …») |
| `copyFromFieldCode: "<code>"` — another `BO` field of the same BO | «Логика отображения значения» → «Из другого поля» | `[C]` | the field gets a stored copy of that field's value on every save |
| `removeType` `"STRIKETHROUGH"` (template) / `"HIDE"` / `"DISCONNECT"` | «При удалении объектов» | `[C]` | a deleted referenced record is struck through in a table / hidden / on this build struck through too — the id is never removed from the value |
| `needChangeParentBoByLinkedBo` (template `true`, and on EVERY field of an export) | «Изменить / Не изменять бизнес объект» | **`false` is LOST on a field the import CREATES** (stored `true`); a second import of the same archive, which UPDATES the field, stores `false` `[C]` | `true`: adding a record is a change of the owner card (saved with it); `false`: written into the record at once, even if the card is then closed without saving |
| `needMarkNew: true` | «Помечать новые» | `[C]` (kept on a created field, unlike the API) | new rows in bold and on top `[I]` |
| `needAddToParticipants: true` (only for a field referencing a `PERSON` BO) | «Добавлять в участники и уведомлять» | `[C]` | `[U]` |
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

**Reference fields — «С фильтром» and «Зависимость полей» in an archive** (`<stand>`: four probe
BOs region / city / branch / order exported, imported as NEW BOs, then re-imported twice with hand-edited keys):

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
  field ids, and the picker of the imported field showed only the matching records `[C]`. A filter with
  `boiIds` (a filter on a BO field by concrete records) was not tried `[U]` — record ids do not travel.
- **The field relation does NOT travel whole** `[C]`. The export writes only
  `boRefStruct.relMainInnerFieldCode` («Поле зависимого» — a `BO` field of the REFERENCED BO), and that one
  imports. «Зависимость от» (`relFieldId`, a field of THIS BO) and «Внутреннее поле» (`relInnerFieldId`) are not
  exported at all. Hand-written keys: `boRefStruct.relFieldCode` IS read but resolved in the REFERENCED BO, so it
  stores a wrong field (or nothing); `boRefStruct.relInnerFieldCode` and top-level `relFieldCode` /
  `relInnerFieldCode` / `relMainInnerFieldCode` are ignored. **Never write `relFieldCode`; after the import set
  `relFieldId` / `relInnerFieldId` through the API or the constructor** (`MYBPM-UI-API.md` §5h ««С фильтром» and
  «Зависимость полей» of a `BO` field») — and know that on this build the relation does not filter the picker in the UI anyway.

**Per-type settings — checklist, questionnaire, progress bar, tabs, text editor, option colours** `[C]`
(`<stand>`: a probe built through the API and the constructor was exported, and a probe archive with
every key below imported as a NEW BO; records of both checked on the card). Every key travels as written:

| type | key in the field | meaning on a record |
|---|---|---|
| `CHECKLIST` | `defaultValue` (items, 0.5) + `isAppendable` | `true` = «Добавить» on the record; `false` = only the shipped items |
| `CHECKLIST` | `isSelectOnly: true` | the item texts cannot be edited, only ticked. Do not combine with `isAppendable: true` (the constructor allows one or the other) |
| `CHECKLIST` | `isRequired: true` | «Обязателен один пункт» — the server refuses a record with nothing ticked |
| `CHECKLIST` | `isRequiredAll: true` | «Обязательны все пункты» — imported, but **nothing enforces it on this build** (card and server saved records with unticked items); do not rely on it |
| `QUESTIONNAIRE` | `questionnaireIsMultiple` | `false` = one radio mark per row, `true` = checkboxes, several per row |
| `PROGRESS_BAR` | `isProgressBarSticky: true` | the bar stays at the top of the card while the form scrolls. Leave `params` `{}` (`params.isSticky` is not it) |
| `TAB_GROUP` | `params.needDisableTabs: "true"` | the tab strip is hidden — use it with ONE tab (the constructor offers it only then) |
| `TAB_GROUP` | `params.showAsStepper: "true"` | travels, but **changes nothing on a card on this build** |
| `TAB_GROUP` | `fieldTabs.<code>.isRight: true` | the tab sits at the right end of the strip |
| `TEXTAREA`, `TEXTAREA_LANG` | `params.buttonTypes` = JSON TEXT of an array, `"[\"bold\",\"italic\",\"table\",\"codeview\"]"` | the editor toolbar shows exactly those buttons, from `style bold underline italic fontsize color ul ol paragraph table link picture video hr codeview height`; no key = the default ten `bold underline italic fontsize color ul ol table link picture` |
| `DROPDOWN_SINGLE` | `fieldOptionsStruct.options.<code>.fieldOption.color` (`RED`, `GREEN`, `BLUE`, …) | the kanban column colour (the card shows the option uncoloured). On a `RADIO_BUTTON_GROUP` the colour travels too but shows nowhere: a kanban is built only on a `DROPDOWN_SINGLE` |

- `params` values are strings, as everywhere (`"true"`, not `true`).
- The option, questionnaire, step and tab codes in the archive are kept as written by the import (an API ADD,
  by contrast, regenerates option codes from the labels — `MYBPM-UI-API.md` §5h «Per-type settings»).
- A record's progress bar is coloured by step CODE: the value is a map `{"Novyi":"GREEN"}` (`RED GREEN YELLOW
  BLUE ORANGE PURPLE`), set by a script or the record API — the card has no control for it. Give the steps
  stable codes for that reason.
- The generator writes all of these: `--field "Чек:CHECKLIST#Пункт 1|+Пункт 2!isSelectOnly=true,isAppendable=false"`
  (`+` = ticked), `"Вкладки:TAB_GROUP#Шаг 1|>Справа"` (`>` = right), `"Поле:INPUT_TEXT!tab=<код вкладок>/<код
  вкладки>"`, `"Статус:DROPDOWN_SINGLE#Красный=RED|Синий=BLUE"`, `'Текст:TEXTAREA!params.buttonTypes=["bold","table"]'`.

**«Единичный выбор» — `RADIO_BUTTON_GROUP`, and the default option of any list** `[C]` (`<stand>`,
probe «Проба виджетов» + three copies imported from its export, rolled back)

- **A radio group is a LOCAL list only.** Its `fieldOptionsStruct` takes the `FROM_FIELD` shape of 0.5. A
  dictionary (`FROM_BO` + `dictionaryBoInfo`) is useless on it everywhere: the import drops it (the new
  field has `refBoId: null` — the same archive's `DROPDOWN_SINGLE` with the same dictionary was bound
  correctly), the record card shows the label and NO buttons, and the constructor shows an empty local list.
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
  default pointing at nothing. Seen on both `RADIO_BUTTON_GROUP` and `DROPDOWN_SINGLE`. Before importing an
  export, replace each such `defaultValue` with the `newOptionId` of the option it meant (look the option up
  on the source stand by id → its code → the archive option with that key). Re-importing onto the SAME BO
  was not tried `[U]`.
- **Required** (`isRequired: true`): the server refuses a record with no option ticked
  (`validate_required_title`); the card shows the red star. «Уникальное» does not exist for this type.
- **No kanban, no colour.** A kanban column can only be a `DROPDOWN_SINGLE` (the stand lists no radio
  among the kanban fields, and exports `kanbanCardTemplates` only for dropdowns); `fieldOption.color` on a
  radio is stored and travels, and is seen nowhere.
- On the card a radio cannot be cleared once an option is ticked (the client control only sets, bundle).
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
only `CREATE_BOI` and `ADD_PARTICIPANT` of new records. Both keys export and a copy import brought both back,
and its records logged `UPDATE_FIELD` (old → new display value) for the flagged field only. Generator:
`--field "Поле:INPUT_TEXT!isHistoryTracking=true"` plus `--history` (writes `boTabs`); the validator warns about a
flagged field on a BO without `boTabs.HISTORY`.

**«Название записи» — `titleToShow` + `titleOrderIndex`** `[C]` — the record's NAME
(the title of its card, `load-bo-components` → `name`) is the DISPLAY values of the fields with
`titleToShow: true`, joined by single spaces in `titleOrderIndex` order (0, 1, …); an empty field is skipped
(«вкладка снова 5» while the phone was empty, then «+7 (701) 123-45-67 вкладка снова 5» — the phone formatted as on
the card, a `FULL_DATE` as «01.10.2026 14:31»). No field flagged → the name is the BO's `name` — NOT its `recordName` `[C]` (§2 «BO header settings»). Any field
except `TAB_GROUP` and widgets can be a part, a system field (`CREATED_AT`) included. Constructor: the
record-name field chooser in the form header. In the archive both keys sit on the field in `dynamicFields`
(the exporter omits `titleOrderIndex` on fields that are not flagged); a copy import brought the flags and the
order back and its new record was named from them. **A system field is the exception**: the import APPLIES
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
- **Пользователь (Person)** is built in; its unique field is **Email**; it has no patronymic field
  (ФИО = `surname` + `name`). «Подразделения» (Department) and «Рабочая группа» (PersonGroup) are built
  in too.

## 4. Form layout (`gridPosition`)

Every field carries `gridPosition {x, y, cols, rows}` on a form grid **15 columns** wide. `[C]`
**The key names are `cols`/`rows`, not `w`/`h`** — `w`/`h` belong to the BO-level `gridLayoutPosition`
(record window, end of this section). Verified in `.470` and `.614` exports; an earlier note here said
`{x,y,w,h}` and was wrong.

- Cell sizes the constructor itself assigns `[C]`: FULL_DATE / PERIOD 15×4; LINK / FILE_UPLOAD / Person
  ref 15×6; one-line inputs 3 rows; nested tables 9 rows; STATIC_TEXT 15×8; dictionary `code`/`label` 15×4.
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
  field; only `.614` exports have the key). With `isHeightDynamic:true` and a 5-row cell (label + header +
  one row) the empty band under short tables disappears; import applies the flag. `[C]`
- **Sections** = everything between one full-width «Текст» (STATIC_TEXT) field and the next. HTML goes in
  `staticValue.rus` — a FRAGMENT (no doctype / `html` / `head` / `title`), and only what the sanitizer
  lets through `[C]` (observed on an HTML field; the same rules rendered in «Текст» headings, identical
  sanitizing there is `[U]`): `text-transform` and `letter-spacing` are REJECTED; `main`, `header`,
  `section`, `article` are stripped WITH their styles → use only `div` and `span`; drop `clamp()` and
  `aria-label`; `h1`–`h3` lose bold → set `font-weight:700` explicitly; avoid `transform` and
  `conic-gradient` (assumed filtered `[U]`). (Same list: `MYBPM-UI-API.md` §8.) 15×3 showed the platform's own scrollbar inside
  the band for "heading + subheading" → use **15×4** or more. `hideLabel:true` avoids the field label
  duplicating the heading (whether import applies it was never reported `[U]`).
  **A section heading must not repeat any field name of the BO — it breaks Excel import** (`SameBoFieldsLabel`).
- **Tabs**: one `TAB_GROUP` field (code `Vkladki` in exports) with `fieldTabs` (tab codes + labels);
  fields on a tab carry `tabCodePath{tabGroupCode, tabCode}`. `boTabs` can stay `{}` while tabs exist `[C]`.
  Fields outside tabs coexist with a tab group in the same BO. Tab order = `fieldTabs` order; the first
  tab is the default. A tab group whose only tab is a service tab can sit UNDER the ordinary fields
  (`<company-b>` does this with its `system` tab) instead of opening the form.
- **Record window**: `BoStructDto.gridLayoutPosition` `{x,y,w,h,id:"0"}` is the record WINDOW on a
  ~16-column SCREEN grid, not the form; `null` for dictionaries. All four occurrences ever seen:
  `{x:1,w:15,h:21}`, `{x:1,w:15,h:18}` (top-level BOs), `{x:3,w:11,h:18}` / `{x:3,w:10,h:28}` (BOs opened
  only from a parent's table). `h` is not the form's row count (a 37-row form scrolls inside an 18-unit
  window); 28 is the largest ever seen — treat it as a cap and probe before going higher `[U]`.
  Import appears to apply it `[I]`.

## 5. Dictionaries (справочники)

- `category: BO_DICTIONARY`, `dictionaryFields: ["CODE","LABEL"]`, system fields `code` (`INPUT_TEXT`,
  `isSystem`, `isUnique`, `isRequired`) and `label` (`INPUT_TEXT_LANG`, `isSystem`, `isRequired`). **Both are
  mandatory on every dictionary** (0.10 rule 18) — never drop or rename them, whatever extra fields follow.
- A dictionary MAY carry extra fields (`<company-b>` `Tax_base`: `lower_limit`, `fixed_amount`, `rate`,
  `starting_price`); 15 of 21 keep the plain code/label shape.
- **A hand-built dictionary archive imports cleanly** `[C]`: the three keys above
  plus ordinary `dynamicFields` are enough, `nativeFields` stays `{}`, and the stand rebuilds exactly the
  dictionary the constructor would (`isDictionary: true`, `code`/`label` at `y: 0` / `y: 4`). The system
  fields carry `isSystem: true` and their `label` map holds all four languages —
  `{rus:"Код", kaz:"Код", qaz:"Kod", eng:"Code"}` and `{rus:"Значение", kaz:"Мәні", qaz:"Mani",
  eng:"Value"}`. `tools/make-probe-archive.bun.ts --category BO_DICTIONARY` emits it.
- **The caption of `label` varies per BO**: on `Parameter` it is «Значение» and holds the value (the name
  lives in a separate `name` field); on «Шаг скоринга» it is «Наименование». Never assume `label` = name —
  read `dynamicFields`. `[C]`
- Values are `ExportStructInstanceDto` lines, `compositeId` = `<boId>-<instId>`, sources
  `DEFAULT_VALUE{boCode, fieldCode:code}`. The `boId` inside `compositeId`/`oldRefBoId` differs from
  `BoStructDto.oldId` in real exports — normal.
- **A «Выпадающий список» carries `fieldOptionsStruct`** `[C]` (shapes read off a real
  `<company-b>` export AND round-tripped — a hand-built archive with both kinds imported into `<company-a>` and
  came back from the stand exactly as sent). Two kinds:
  - fed by a DICTIONARY — `{"optionSource":"FROM_BO","options":{},"dictionaryBoInfo":{"code":"Dolzh",
    "name":"Должность","boCategory":"BO_DICTIONARY"},"dictionaryOptionSetting":{}}`. **The dictionary is
    named by CODE, never by id** (unlike a nested object, which carries `oldRefBoId`), and the importer
    resolves it — the probe shipped `code: "Dolzh"` and the stand answered `refBoId: kNfvHppcNSR6Wz@B`.
    `options` stays EMPTY: the rows live in the dictionary and the form reads them at runtime.
  - a LOCAL list («Задать вручную») — `{"optionSource":"FROM_FIELD","options":{"<код варианта>":
    {"fieldOption":{"label":"Новый","orderIndex":0,"color":"#00d9ff","code":"Новый→код",
    "hiddenInKanban":false},"newOptionId":"<16 chars>"}},"dictionaryOptionSetting":{}}` — an OBJECT keyed
    by the variant's own transliterated code, `orderIndex` stepping 0, 10000, 20000…, `color` may be null.
    A `FROM_FIELD` field with `options: {}` is simply a dropdown whose list is still empty.
    **An option's `label` is a PLAIN STRING, single-language** `[C]` — no `label: {rus, eng}` map and no
    `labelEng` sibling anywhere in 4.24 exports (an older platform-era prompt claimed
    `label` + `labelEng`; emitting that key is a guess, not a translation).
  `tools/make-probe-archive.bun.ts` emits both: `--field "Должность:DROPDOWN_SINGLE@Dolzh@Должность"` /
  `--field "Статус:DROPDOWN_SINGLE#Новый|В работе|Готово"`.

## 5a. Panels (панели) `[C]`

- `category: "BO_PANEL"`, everything else the shape of a plain BO — no panel-specific key anywhere in
  `BoStructDto` (`dictionaryFields: []`, `nativeFields: []`, `boTabs: []`, `bos: []`).
- **A panel's content lives in `dynamicFields` as `type: "BO"` entries** — registry widgets. Per entry:
  `oldRefBoId` (the target BO), `boRefStruct.boInfo{code,name,boCategory}`, `viewType: "TABLE"`,
  `isKindAddForSelect: true`, `isHeightDynamic: true`, `isReadonly: true`, `gridPosition.rows: 6`+.
  A hand-built archive with just those keys imports and the stand resolves `oldRefBoId` to a live BO
  (`tools/make-probe-archive.bun.ts --category BO_PANEL --field "Метка:BO@<boId>@<boCode>"`).
- What a REAL panel adds on top (`<company-a>` «Главная», `Glavnaya`): `boRefStruct.fieldRefs` — one entry per
  field of the target BO with `toShow` / `orderIndex` / `gridPosition`, i.e. the widget's column layout —
  and `bracketFilter` (`{boCode, fieldCode, brackets{…}}`), which is what turns a registry into «Мои
  встречи»: `nativeFilters{type:"CREATED_BY", isCurrentUser:true}` OR a `dynamicFilters` entry on a
  Person field with `isCurrentUser: true`. A hand-built `fieldRefs` (codes of the target's fields, `toShow`,
  `orderIndex`) imports and gives the widget its columns `[C]`; a `bracketFilter` on a `BO` field
  travels too (§3 «Reference fields — «С фильтром»…» `[C]`), the `isCurrentUser` variant was not re-run `[U]`.
- **`readFromRegistry` — registry or a picked list** `[C]` (`<stand>`: a panel exported, and a
  panel with three widgets imported). Absent / `null` / `true` = the widget shows the WHOLE registry of the
  referenced BO (the default — the export omits the key then); `false` = an ordinary reference table that
  holds only the records put into it, saved in the panel's record, which is per user (its id is the
  viewer's `personId`). The import keeps each of the three values as given. Give every widget
  `boRefStruct.fieldRefs` with at least one `toShow: true` (the generator's `!show=<codes>`): a widget with
  no columns renders empty. Through the constructor the box can be turned OFF but not back ON (a server
  defect) — `MYBPM-UI-API.md` §5h «Читать из реестра».

## 5b. Composite objects (составные объекты) `[C]` (sample `TestComposite.mybpm.zip`)

A composite object unites the records of several BOs into one registry; in an archive it is a single
`BoStructDto`, `category: "BO_COMPOSITE"`, `kind: "GENERAL"`. `TestComposite.mybpm.zip` (`~/Downloads`)
holds exactly 3 objects — `CompanyMetadataStructDto`, one `BoGroupStructDto`, one `BoStructDto` — and no
`AccessStructDto`.

- **`bos: [{code, name, boCategory}]`** — the source BOs, referenced **by CODE only**, no id and no
  nested DTO. The importer looks them up **by code — first among the lines of the archive itself, and
  otherwise on the stand** `[C]` (both import routes; the in-archive case proved by a dry run
  on `<company-a>`) — and writes the real `boId`s into the live `links`. So a composite and the BOs it joins
  can travel in ONE archive, in any line order (composite first also analyses clean).
- **A `boFieldCodes.fieldCode` that no source BO has CRASHES the analyzer** `[C]`. Not a
  readable error — the import goes `status: "INTERNAL_ERROR"` and `load-import-data.error` carries a Java
  stack trace: `Optional.orElseThrow` in `StructureImportAnalyzer.fieldCodeToId` ← `analyzeFieldStructs`
  ← `analyzeCoStruct`. Found by feeding a composite that wanted `Naimenovanie` / `Telefon` / `Email` two
  in-archive sources whose fields were `Familiya` / `Imya` / `Telefon`; with the codes made to match, the
  same archive analysed `ANALYZED`, 0 errors. **Every `fieldCode` of every `boFieldCodes` entry must
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
  - The trap that produced that error here: **a BO code is cut to 30 characters**, so the stand's code
    for «Проба API-конструктор 2026-09-18» is `Proba_API_konstruktor_2026_09_` — with a trailing
    underscore (a name whose transliteration runs past 30 characters). Always READ the source codes off the stand
    (`load-business-object-by-id → code`), never transliterate them by hand.
- **Each entry of `dynamicFields` carries `boFieldCodes: [{boCode, fieldCode}]`** — which field of which
  source BO feeds this composite attribute. One entry = a «простой атрибут», two or more = a «составной
  атрибут» (the live API expresses the same relation as `links: [{boId, fieldId}]`, see
  `MYBPM-UI-API.md` §5e).
- The rest of the field DTO is an ordinary dynamic field (`type: "INPUT_TEXT"`, the full boolean set,
  `boRefStruct.fieldRefs: {}`, `linkedCoSettings: {}`); `nativeFields`, `dictionaryFields`, `boTabs`,
  `printForms` are all empty. There is no layout — a composite has no form: the sample's fields carry no
  `gridPosition`, no `tableColOrderIndex` and no `removeType`, and an archive generated without them
  imports fine `[C]`.
- **Generator**: `tools/make-probe-archive.bun.ts --category BO_COMPOSITE`
  `--source "<код БО>:<Имя>[:<категория>]"` (repeatable) and
  `--co-field "Метка:TYPE=<boCode>.<fieldCode>[+<boCode>.<fieldCode>…]"` (repeatable) — one link makes a
  «простой атрибут», two or more a «составной». It refuses a `--co-field` naming a BO no `--source`
  declares. Both routes verified end to end on `<company-a>` (`MYBPM-UI-API.md` §5e).
- The import dialog labels the node **«Составной объект/<имя>»** and lists the attributes under
  «Добавленные поля» like any other BO; `load-import-bo-infos` returns `boCategory: "BO_COMPOSITE"`.

## 5c. Business processes (бизнес-процессы) `[C]` (sample `MyBPM-export-<company-a>-v4.24.25.430-2026-03-22T17-05-29.mybpm.zip`, both import routes on `<company-a>`)

A business process is **two lines in the archive**: an ordinary `BoStructDto` with
`category: "BO_PROCESS"`, plus a **`BoProcessVersionsStructDto` whose `oldId` is the BO's own `oldId`** —
that field is the only link between them. The `<company-a>` sample carries 7 objects:
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
  `"type"` string, and it also carries `methodScriptIds: []`. **Write your diagram into `workProcess`.**
  An EXPORT of a process that only has a test version (built in the constructor, never put «в работу»)
  has NO `workProcess` key: the diagram sits under `processVersions.<version id>` in the same shape `[C]`
 . **Importing that form works, but gives a TEST-ONLY version** `[C]` (`<stand>`,
  the export imported as is under a new code): `isWork: false, isTest: true` — the process runs on DEV
  (test) records only; an ordinary record gets no process at all (`load-process-steps` stays `[]`).
  A `workProcess` line imports as `isWork+isTest` instead (below). To ship a process that runs on
  ordinary records, move the diagram from `processVersions.<id>` to `workProcess`. Re-importing the
  `processVersions` form again adds version 2 as `isTest` and demotes version 1 to neither.
- **A process with BOTH a work and a separate test version exports both, and the import rebuilds both**
  `[C]`: the work version goes into `workProcess`, the test version into
  `processVersions.<its version id>` — each with its own `ScriptDefStructDto` lines, whose `compositeId`
  is `<that version's id>-<figure id>` (`scriptsDefIds` of each diagram lists its own). A version that
  is neither work nor test (an old one, or a fresh «Копировать») is NOT exported. That export imported
  under a new code came back as version 1 `isWork` (the `workProcess` diagram) + version 2 `isTest` (the
  `processVersions` one), different diagrams kept apart, scripts on both, `validate-def []` on both.
  So `workProcess` = the work version and `processVersions.<id>` = the test version. **A single version
  that is BOTH work and test is exported TWICE** `[C]` — the same diagram under `workProcess`
  and under `processVersions.<its id>` — and that export imports as TWO identical versions, v1 `isWork` +
  v2 `isTest` (not one `isWork+isTest` as a hand-written `workProcess`-only line gives). Harmless; drop
  `processVersions` from a re-used export if one version is wanted.
- `runWayMap` (in `workProcess` and in each `processVersions` entry) holds the process's **run ways** —
  WHEN it starts `[C]` (`<stand>`: built through the API, exported, re-imported under a new
  code, each kind fired on records). Empty = the default: the process runs on a record of ITS OWN BO when
  that record is created (every other probe in this document ran that way). **A run way starts the
  process from ANOTHER BO**: the process BO has a single BO-reference field (`type: "BO"`,
  `viewType: "SINGLE"` or `"FIELDS"` — the only fields the dialog offers) pointing at the target BO, and
  an event on a TARGET record **creates a new record of the process BO** whose reference field points at
  that target record, and runs the process on it. Adding run ways does NOT switch the default off — a
  process record created directly still runs `[C]`. In the ARCHIVE a run way names everything BY CODE (the
  API's ids are re-mapped on import — the process field got the new BO's field id):
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
    covered both a save through the record form AND a record created by the formless API cycle
    (`MYBPM-UI-API.md` §6a — which runs no Block IDE script, yet did start the run way) `[C]`. The other
    members are unexercised: `ON_IN_MIGRATION | ON_UPLOAD_XLSX | ON_CALL_API | ON_MASS_CHANGE` (field
    change only) `| ON_PROCESS_CHANGE | ON_PLUGIN_SAVE | ON_KAFKA_IN_MIGRATION`.
  - `SCHEDULED` — no process field; `schedule = {repeatType (EVERYDAY | EVERY_WEEK | EVERY_MONTH | EVERY_WORKING_DAY | EVERY_LAST_DAY_OF_MONTH | EVERY_LAST_WORKING_DAY_OF_MONTH), repeatUntilType (NO_END_DATE | REPEAT_COUNT | EXPIRATION_DATE), startTime, startRepeatTime, endRepeatTime, repeatCount, interval, daysOfWeek, dayOfMonth}` — **`startTime` is a real UTC instant, `startRepeatTime` is a date** `[C]` (read off the client: the picked local time is shifted to UTC and then printed with the pattern `yyyy-MM-dd'T'HH:mm:ss'Z'`, so the `Z` is literal but the value IS UTC; the date is the local midnight printed the same way, `…T00:00:00Z`; reading back, the dialog uses only the `HH:mm` of `startTime`). The stand ACCEPTS a scheduled run way and stores it as sent, but **it has not been seen to fire** `[U]`: two of them on one work version — `EVERYDAY`, `REPEAT_COUNT` 1, the current day's `startRepeatTime`, `startTime` 2–3 minutes ahead, once as the real UTC time and once shifted by the stand's +5 h in case the server reads it as local — created no record of the process BO and added no step to its existing records — still none 48 minutes after the first time and 35 after the second, across a top of the hour, so not even an hourly tick picked them up; and none within 16 hours, long after both start times (including the +5 h one) had passed: the record count never changed. The client has no call that shows a next run, so there is nothing to read back; on this stand a scheduled run way never fired at all; whether that is the build or the stand's configuration (a scheduler that is switched off) is open — **do not rely on `SCHEDULED`; start such a process from a script or by hand**. Its archive form is not seen yet.
  - `ON_MIGRATION_END` — no process field and no options in the dialog; not exercised `[U]`.
  The target BO must already be on the stand or travel in the same archive (`refBoInfo.code`). Building a
  run way on a stand: `MYBPM-UI-API.md` §5f «Run ways».
- **Figure and arrow ids survive the import unchanged** `[C]` — the stand's def carries the archive's own
  ids, the same determinism as `oldId` → `boId` (re-checked on 6 figures + 5 arrows). The
  **version id does not**: the stand mints its own and re-keys the scripts to it.
- **An imported version comes in as `isWork: true`** («Версия: 1 (Опубликованный)»), and it
  reads `isWork: true, isTest: true` — it runs on test (DEV) AND ordinary records `[C]`.
- **Re-importing the same process code adds a NEW version** `[C]`: version 2 came in as
  `isWork+isTest`, version 1 dropped to `isWork:false, isTest:false`. The BO itself is updated in place.
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
  you write** (0.10 rule 15). An archive gives the field `tableColToShow: true` + a `tableColOrderIndex` (a BO
  reference is a safe column under the sort defect, 0.5c) and `fieldRefs` with at least one field of the
  target, `toShow: true`. A process built without `PROCESS_STATUS` (itself forbidden by 0.10 rule 18; its `label`
  is the default registry column of a process) and with its one reference field in the export's shape comes out
  with NO registry column and a selector showing nothing `[C]`.
- **A whole configured process travels in one archive and runs** `[C]`:
  Enter → Form(«Заявка») → Script → Switch(ЕСЛИ «Заявка».«Одобрить») → Exit «Да» / Exit «Нет», imported
  through the API route (`MYBPM-UI-API.md` §5) — analysis clean, `validate-def []`, both scripts
  `translate-script success`, and both branches reached on DEV records and again on ordinary records
  (`…, Switch PASSED, Exit «Да» PASSED` / `…, Exit «Нет» PASSED`, `scriptRunSuccess: true`). Generator:
  `make-probe-archive.bun.ts --process-spec <spec.json>` — the SAME spec `tools/process-builder.ts` builds
  through the API (`tools/process-probe.spec.json`; a field entry needs `refBoCode` AND `show: [<target
  field codes>]` for the archive — the generator refuses a reference without `show` and any BO without a
  registry column, 0.10 rule 15).
- **`PROCESS_STATUS` is not created by the importer** `[C]`. The constructor gives every process the
  system field `PROCESS_STATUS` («Статус процесса», `type: "BO"`, `isSystem`, `isCodeReadonly`,
  `isRequired`, `viewType: "SINGLE"`, `boRefStruct.boInfo = {code: "PROCESS_STATUS", name: "Статус
  процесса", boCategory: "BO_DICTIONARY"}`, `fieldRefs.label.toShow`, `oldRefBoId` = the stand's
  «Статус процесса» dictionary — `<company-a>` `Q0zI~z9Ra2R7Q3yd`) — an archive must ship that field itself.
  The importer resolves that reference by `boInfo.code`, not by `oldRefBoId` (below).
- **…but the PROCESS runs without it** `[C]`: an archive with no `PROCESS_STATUS`
  line (Enter → Script → Script → Exit, both defs shipped) imported, the BO came in with no status field at
  all (`formFields` / `load-bo-fields-for-drag` list only the archive's own field), `validate-def []`, and
  the process went Enter → Exit on an ordinary record AND on a DEV record. So the status field is what
  the record SHOWS, not what drives the process — shipping without it costs the status, not the run.
  It also costs the registry column: `PROCESS_STATUS` is the column a constructor-built process shows.
  **This is a fact about the importer, not an option** — shipping a process without `PROCESS_STATUS` is
  forbidden (0.10 rule 18).
- **…and it must carry its DEFAULT VALUE, or no record of the process can be saved** `[C]`
  (`<stand>`). The field is required; the constructor defaults it to the dictionary row `CREATED`
  («Только что создан»). Shipped without a default, every `validate-apply-remove-draft` of a process
  record answers 200 with the form command `ALERT_SAVE_BUTTON_NOTIFICATION` «validate_required_title»,
  the record is never created and the process never starts. **The default needs TWO things in the
  archive** `[C]` (`<stand>`, four new-BO imports compared): (1) the key on the field itself,
  `"defaultValue": "[\"<CREATED row id>\"]", "defaultValueMap": {"RUS": "[\"<CREATED row id>\"]"}`,
  AND (2) the export's separate `ExportStructInstanceDto` line for the `CREATED` row with
  `sources:[{sourceType:"DEFAULT_VALUE", defaultValueInstanceSource:{boCode:<this BO>, fieldCode:"PROCESS_STATUS"}}]`
  (its full shape: `tools/make-probe-archive.bun.ts`, `pushStatusDefault`). The line alone left
  `defaultValue "[]"`; the key alone left `"[]"` too; both together took. (An earlier reading «the line is
  ignored, the key is enough» was wrong — every archive that worked happened to carry both.)
  **Both ids are resolved BY CODE on import** `[C]`: the dictionary is built in with the fixed code
  `PROCESS_STATUS`, its id differs between stands (`Q0zI~z9Ra2R7Q3yd` on one, `0sKQwbF6d25F6DvG` on
  another), and its `CREATED` row id differs too — yet an archive carrying the other stand's dictionary id,
  and one carrying a made-up dictionary id AND a made-up row id (the same made-up ids in the field and in
  the line's `compositeId`), both came in with the importing stand's own `refBoId` and `CREATED` row id
  in `defaultValue`, and a record of each process saved (`CLOSE_DIALOG_SAVE`). The line names the row by
  `boCode: "PROCESS_STATUS"` + its unique `code` field `CREATED`, which is what the importer matches. So no
  stand id is needed for a process — mint the two ids (0.2a). **So an EXPORTED
  process never imports runnable as is** `[C]`: the export writes
  `PROCESS_STATUS` with no `defaultValue` key (only the line), the imported copy
  refused every record with «validate_required_title»; adding the key to the field — and nothing
  else — made the same archive run both branches. Patch every exported process before re-importing it.
- The two `ExportStructInstanceDto` in the sample are RECORDS, not structure: one row of the
  `PROCESS_STATUS` dictionary (`CREATED` / «Только что создан»), and a `Coordinate` instance whose
  `sources: [{sourceType: "PROCESS", processInstanceSource: {boCode, isWork}}]` ties it to the process.
  Neither was needed to import a working process.
- **Generator**: `tools/make-probe-archive.bun.ts --category BO_PROCESS` emits both lines; it always puts
  an `Enter` at (100,100) and chains `--process-figure "<Type>[@x,y]"` (repeatable, default a single
  `Exit@440,104`) after it with `main → main` arrows, and always adds the `PROCESS_STATUS` field in the
  export's own shape plus its `defaultValue` and `DEFAULT_VALUE` line, with minted ids (`--process-status
  <refBoId>:<CREATED row id>` overrides them). A CONFIGURED process
  comes from `--process-spec` instead (above). Both routes verified on `<company-a>`
  (`MYBPM-UI-API.md` §5f); the import dialog labels the node **«Бизнес-процесс/<имя>»** and
  `load-import-bo-infos` returns `boCategory: "BO_PROCESS"`.

- **Figure settings as the editor stores them** `[C]` (`<stand>`, read off
  `load-bo-process-def`; the archive's typed structs are assumed to carry the same keys `[I]`):
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
  (as a Form is `FigureFormStruct {fieldCode}`) — `[C]`: imported, the code resolved to the
  new field's `fieldId`, and the Timer fired on an ordinary record. Full write-up: `MYBPM-UI-API.md` §5f
  «Configuring the figures». **Parallel figures and the Terminator in the archive** `[C]`
  (read off an export, then imported and run): `FigureSingleToParallelStruct {x, y, outSlotsCount: N}`,
  `FigureParallelToSingleStruct {x, y, inSlotsCount: N}`, `FigureTerminatorStruct {x, y}` (nothing else —
  the editor's `fieldId:""` does not travel); arrows keep the slot names `in` / `out1…outN` and
  `in1…inN` / `out`. Runs: §16 «Parallel branches» and «A Terminator ends the WHOLE process».
  **A Point** (a bend on an arrow) is `FigurePointStruct {x, y}` `[C]` (read off an export,
  then imported and run); its arrows use the slots `angle_0`, `angle_45` … `angle_315` (degrees, 0 =
  right, 180 = left). §16 «A Point».

## 5d. Scripts inside the archive (`BoScriptVersionsStructDto` + `ScriptDefStructDto`) `[C]` (sample `MyBPM-export-<company-b>-v4.24.25.614-2026-09-15T16-55-04.mybpm.zip`)

Ticking the per-BO checkbox **«Скрипты»** in the export basket (`MYBPM-UI-API.md`, Export tab) adds two
kinds of line per BO — this is the ONLY place where a Block IDE script exists outside the IDE:

- **one `BoScriptVersionsStructDto`** — the wiring: which script id sits on which hook;
- **N `ScriptDefStructDto`** — the bodies, one per non-empty script.

The sample (106 lines) is 69 `ExportStructInstanceDto` + 12 `ScriptDefStructDto` + 10 `BoStructDto` +
7 `AccessStructDto` + 4 `BoGroupStructDto` + 3 `BoScriptVersionsStructDto` + 1 `CompanyMetadataStructDto`:
only 3 of the 10 BOs carried scripts.

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
  the sample wires scripts onto a `BO_DICTIONARY` (`Parameter`) exactly like onto a plain `BO`.
- **`workScripts` = the published version, `testScripts` = the draft.** `testScripts` is OPTIONAL and was
  present on 1 BO of 3; a BO never edited in test mode carries `workScripts` alone. (Same split as a
  process: an imported version arrives as `isWork` — §5c.)
- The four hooks are the UI dialog «Настройка скрипта» → «Запуск скрипта на: Открытие / Сохранение /
  Добавление новой записи / Закрытие» = `onOpenFormScriptId` / `afterSaveScriptId` /
  `onInstanceCreationId` / `onCloseScriptId` `[C]` (each proven by its own marker; when each
  one runs: §15 «When each hook runs»).
- **`fieldScripts` is keyed by FIELD CODE** `[C]` — «На изменение <поля>» of the same dialog
  (`condition`, `calc`, `final_code`, `code` are real `dynamicFields` codes of those BOs).
- **A hook id is always written, a body is not.** All four hook ids appear even when the script is empty;
  `scriptDefIds` lists only the scripts that actually have a `ScriptDefStructDto` line (sample: 4 hooks +
  4 field scripts declared → 6 defs; `afterSaveScriptId` is not among them). An id absent from
  `scriptDefIds` means «hook wired, script empty».
- **Two id shapes, do not mix them**: `workScripts.*ScriptId` and `fieldScripts.*` hold the **bare** 16-char
  script id; `scriptDefIds` and `ScriptDefStructDto.compositeId` hold `<versions id>-<script id>`. The
  prefix is the version's own id and DIFFERS between the two versions — the same body `KDppzVnPAm0m1FIj`
  appears as `soNeVGRXpXjR~D6A-KDppzVnPAm0m1FIj` under `workScripts` and `iRBrFcK7TvONKo~3-…` under
  `testScripts`. Match a def to a hook by the part AFTER the last `-`.
- `methodScriptIds` lists the BO's own (local) methods — it was `[]` in that sample only because those BOs
  had none. **Local methods DO travel** `[C]` (below «Local methods travel»).

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

Every other key matches byte for byte: `downBlockId`, `varName`+`valueExprId`, `leftExprId`+`rightExprId`,
`ifExprId`+`thenBlockId`+`branches{blockId,order,hasExpr}`, `exitType`, `actId`+`argExprIds`+
`canWriteValue`, `funcName`+`args{name,order,exprId}`+`useArgNames`, `opType`+`more`, and the
`ExprValueStruct` keyset `exprValueType varBlockId boCode fieldCode constType value enumBaseType enumValue
optionCode optionInstanceId optionSource objectDescriptor valueTypeStruct isTextMultiline latitude
longitude methodArgs`. Classes seen in the sample: `BlockFixEntryPoint / BlockNewVar / BlockAssign /
BlockIf / BlockExit`, `ExprValue / ExprOp / ExprAct / ExprCall`. Numbers are doubles (`"x":30.0`), as in
`gridPosition`. Def sizes ran 460 B (an empty `ТОЧКА ВХОДА → ВЫЙТИ`) to 29 KB.

**Therefore an export is a way to READ a live script off a stand without touching the IDE** `[C]`: unzip,
take the def whose `compositeId` ends with the wanted script id, swap `@class` back to `type`, wrap it in
the envelope of §0S.3 with `startBlockIds` = the entry point — and it is a normal Part II fragment.

### The reverse works too: an archive CREATES scripts on import `[C]`

Probe: «Проба скрипт архивом» (`Proba_skript_arhiv`, stand id `ZR1XPYi5C3zqho@w`,
fields `Naimenovanie` / `Kod`), a 6-line archive — `CompanyMetadataStructDto` + `BoGroupStructDto` +
`BoStructDto` + `BoScriptVersionsStructDto` + 2 × `ScriptDefStructDto` — built by
`tools/make-probe-archive.bun.ts` and post-processed by `tools/add-bo-scripts.bun.ts`, applied through
`tools/api-import-structure.bun.ts`. The two bodies were LIFTED VERBATIM out of the `<company-b>` export
(`s1BJw7CmFKAU2Cty` = ТОЧКА ВХОДА → ВЫЙТИ, `DlQXUgrNRYPh@IQv` = the 8-block field validator). **The
clipboard is no longer the only write channel** (§14 is about the IDE, not about the platform).

- **The analyser announces them before you apply**: `load-import-bo-infos[].structTypes` is
  `["SCRIPTS","STRUCTURE"]` instead of `["STRUCTURE"]`. Check it on the dry run — it is the cheapest proof
  that the script lines were parsed at all.
- **Every script id you write is kept verbatim** `[C]` — all four `workScripts.*ScriptId`, every
  `fieldScripts` value, and every block / expression id inside the defs. **Only the version id is
  regenerated**: the `compositeId` prefix `fZzGwQ59R@cK9hiz` came back as the stand's
  `boScriptModId` `jwaoUhUialATq7SJ`. So the prefix is a tie-line inside one archive, like `boGroupOldId`
  (§1) — pick any id-shaped string, just use the same one in `scriptDefIds` and in every `compositeId`.
- **`fieldScripts` is keyed by field CODE in the archive and by field ID on the stand** `[C]`: the archive's
  `{"Kod": "DAZ2eokWJRIqYGuf"}` reads back from `v2/bo-scripts-editor/load-bo-scripts` as
  `{"5wzp8xIek35QC@EU": {"afterChangeScriptId": "DAZ2eokWJRIqYGuf"}}`. The importer resolves the code.
- **A re-import does not overwrite a script version — it ADDS one** `[C]`. First import → version «1»
  `isWork`; the same archive again (one act renamed) → version «3», `isWork`, new `boScriptModId`, and
  version 1 stays with `isWork:false`. **Read back the module id AFTER every import** — translating the
  old module shows the old body and looks like the import failed. The check, all `POST
  <stand>/web/v2/…` in the envelope of 0.12 `[C]`: `bo-scripts-editor/load-bo-script-versions` `P {boId}` → take the row with
  `isWork: true`, its `boScriptModId`; then `script/translate-script` `P {scriptModuleId: <that id>,
  scriptId: <an id from your archive — kept verbatim>}` → `{"success":true}` or a
  `diagnosticMessageList`. An import NEVER reports a broken body; this call is the only validator. (The
  full read-back route, tree and wiring included: `MYBPM-UI-API.md` §5g.)
  The first import also produced a version «2» with `isTest:true` carrying the same script ids, although
  the archive had **no `testScripts`** — a test version is created for you.
- **An empty hook stays empty**: a hook id with no `ScriptDefStructDto` translates to «Не определён
  скрипт». The imported ТОЧКА ВХОДА → ВЫЙТИ def translates `{"success":true}`.

#### A body is NOT portable between BOs — `DYN` act ids embed the FIELD CODE `[C]`

The validator def was moved from a BO whose field is `code` onto a BO whose field is `Kod`, byte for byte.
The import reported **no error** (`load-import-errors` empty, status APPLIED), but
`v2/script/translate-script` answered 13 errors headed by

```
exprAct__noDefinitionForActId: Для акта с ИД=`F-code-K-DYN-S-boi_fields` не найдено определение
```

Rewriting that one string to `F-Kod-K-DYN-S-boi_fields` and re-importing left 2 errors instead of 13. So
**`F-<fieldCode>-K-DYN-…-boi_fields` is «the field `<fieldCode>` of this BO»** — the `K-DYN` half of an
`actId` is a per-BO binding by CODE, unlike `K-FIX` acts (`F-isEmpty-K-FIX-T-String`,
`F-addError-K-FIX-T-BoiFieldRefCode`), which are platform-wide and travel unchanged. **Retarget every
`K-DYN` actId when you move a script between BOs**, and translate afterwards: nothing else tells you.

#### Local methods travel — when the archive carries them `[C]`

The 2 errors that survived above are both the missing method the body calls
(`ExprCall{funcName:"is_var"}` → `exprCall_funcName__notFound`, «Не найдена плашка МЕТОД с именем is_var»)
— because the SOURCE export had `methodScriptIds: []`, i.e. that archive simply did not contain the
method. (Earlier this was written up as «methods do not travel»; that was wrong.) A local method is one
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

Proof: a method + an «Открытие» hook calling it (`BlockAssign` whose `leftExprId` is an
`ExprCallStruct{funcName:"perenos_metod", useArgNames:false, args:{}}`) were built through the API, exported,
re-owned onto a NEW BO code and imported — the new BO had the method in `list-local-methods`, the hook wired,
and `translate-script` of the method `success:true`. (The hook itself was not translated after the import:
the one `translate-script` of that hook on the source BO coincided with a ~30-s 502 of the stand, trap 29.)
A method with parameters carries them in `params` of the hat; argument keys at the call site are the
parameter ids (§13), so keep both sides in the same archive.

**Trap — scripts onto an EXISTING BO whose script module is empty** `[C]`: `apply-import` answers
`IllegalStateException` «V7iuUY20Kn :: Нет скриптов для экспорта у БО с кодом: "<code>"» (the import's
rollback snapshot tries to export the BO's current scripts and finds none), the import stays `ANALYZED`
and the `processId` you passed never runs — a poll loop on it spins until its timeout. Seen after the
BO's only local method had been deleted. Import scripts into a NEW BO (or one that already has a script)
and check the `apply-import` answer for `errorType` before polling.

#### Generated bodies on every trigger — the trigger probe `[C]`

The bodies need not be lifted from an export: an archive with **31 GENERATED scripts** — the four hooks
plus a field script on one field of each of the 27 field types — imported cleanly
(`structTypes: ["SCRIPTS","STRUCTURE"]`, no errors) and every one of the 31 translated `{"success":true}`.
Each body was: `#время# = Сейчас.Дата в строку(DD_MM_YYYY_DOT) ◊ " " ◊ Сейчас.Время в строку(HH_MM_COLON)`;
hooks also write `"<hook> " ◊ #время#` into their own marker field; every script appends
`"<tag> " ◊ #время# ◊ "; "` to a shared log field (`'' ◊ ЭТА ИНСТАНЦИЯ.Журнал.#Значение ◊ …`). The runtime
result is §15 «When each hook runs».

- **Tool**: `tools/add-bo-scripts.bun.ts … --bodies <file.json>` takes
  `{"onOpen"|"afterSave"|"onCreate"|"onClose"|"field:<code>": {entry, blocks, expressions}}` in the
  CLIPBOARD form of Part II and rewrites each body into the archive form (`type` → `@class` …`Struct`,
  `valueType` → `valueTypeStruct`). A body is a whole hook script: its `BlockFixEntryPoint` (`x`/`y`), the
  statements, a closing `BlockExit FROM_METHOD`. `canWriteValue`, `isTextMultiline`, `latitude/longitude`
  may be omitted.
- **`fieldScripts` accepts every field type**, `TAB_GROUP`, `PROGRESS_BAR` and `STATIC_TEXT` included —
  although the IDE's «Изменение поля» list hides `TAB_GROUP` and `PROGRESS_BAR`. All three fired.
- `'' ◊ <an empty field>` gives `""`, not `"null"`; a `TEXTAREA` drops the trailing space of `"; "`.
- The same bodies were also written WITHOUT an archive (`save-bo-scripts` + `paste` +
  `apply-update-cmd`, `MYBPM-UI-API.md` §5g) — identical runtime.

#### Company-global methods — `CompanyGlobalMethodsStructDto` `[C]`

«Глобальные методы» (`/settings` → «Глобальные методы») is one script module per company whose methods
every BO and process script of that company can call — a BO field script and a process Script figure
both call it as a plain `ExprCall` by name `[C]`. **A local method with the same name overrides the
global one** `[C]`: with a local `glob_greet` in the BO's work version the record got the local body's
result, and after `delete-local-method` the same call ran the global body again. So a BO that ships a
local method named like a global one silently shadows it — pick distinct names.

**In an archive** — the export basket switch «Глобальные методы» (`struct/change-export-is-global-methods`,
`MYBPM-UI-API.md` §5) adds one `ScriptDefStructDto` per method plus ONE list line:

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
  the archive with the old ids). Ship global methods with their stand ids unchanged.
- Re-importing a stand's own export changes nothing (same `scriptId`, no duplicate).
- **An import does NOT reach the running scripts.** The stand runs a compiled copy of the global module,
  and the import does not refresh it: after an import, records kept running the OLD body — even of a
  method the import had DELETED — until any `apply-update-cmd` on any global method (a `Set` of an
  unchanged value is enough, `MYBPM-UI-API.md` §5g). Only then did the new bodies run (and the call to
  the deleted method failed with a field error). So **after importing global methods, touch one of them
  through the API or the IDE**, then test on a record.
- Without an archive (`MYBPM-UI-API.md` §5g): `POST /web/v2/script/list-company-global-methods {}` →
  `[{scriptId, methodName}]`, `create-company-global-method {methodName}` → `{scriptModuleId, scriptId}`,
  `delete-company-global-method {scriptId}`, the body written by `apply-update-cmd`
  P `{scriptModuleId, scriptId}` (a `Group` of `Set blocks.<id>` / `expressions.<id>`).

## 5e. Sidebar menu items inside the archive (`MenuItemStructDto`) `[C]`

The cookbook templates are 0.5d; this is the evidence behind them. Decoded by EXPORT — the export screen
has a separate «Элементы меню» basket (`MYBPM-UI-API.md` §0U R4a, «Export tab») — of three real items of
`<COMPANY_A>` (a group, a BO item with a `CREATED_BY` record filter, a BO item with a kanban made through
`v2/menu-item`), then proved by a generated archive: BO + card template + menu GROUP + menu BO item with a
kanban, dry-run, ПРИМЕНИТЬ, the board drawn with its three columns, then rolled back.

**The line.** One `MenuItemStructDto` per item, a group and its children as separate lines. Keys, in the
exporter's order: `menuItemCode`, `menuItemName`, `parentMenuItemCode` (absent on a root),
`boCode` + `boName` (BO items only), `iconName`, `orderIndex` (the exporter writes a float, `10000.0`;
an int imports fine), `boPages` (BO items only), `chosenAccessRight`, `needCountMenuItem`, `isPanel`,
`needHideInMobApp`, `bracketFilter` (BO items only), `menuItemType`. The line has **no id of any kind** —
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
  `kanbanFieldCode`**. The importer resolves the code into the real field id: the item came back from
  `load-nav-items` with `kanbanFieldId: "wgKrnYB6fusRjmLr"` = the `newId` of the archive's own `Status`
  field, plus a `timelineFieldId: null` the archive never mentioned.
- `parentMenuItemCode` is resolved the same way: the child came back with `parentId` = the group's new id.
- **A `GROUP` line has no `boPages`, `bracketFilter`, `boCode`, `boName`** — on the stand the group is
  stored with `boPages: null`.
- `bracketFilter` = the item's record filter, `{boCode, type: "MENU_ITEM", brackets}`. **Its shape
  differs from the API's** (`MYBPM-UI-API.md` §0U R6.5, arrays): here `brackets` and the filters inside
  are MAPS keyed by 8-character ids. The one non-empty filter the export showed — «only records I
  created»:

  ```json
  "bracketFilter":{"boCode":"TestSumProcess","type":"MENU_ITEM","brackets":{
    "fx5mBogt":{"parentTreeIds":{},"order":0,"connectionType":"AND","notType":"DEFAULT",
                "dynamicFilters":{},
                "nativeFilters":{"iLWNZjcz":{"type":"CREATED_BY","isCurrentUser":true,
                                            "isEmptyValue":false,"orgUnitIds":{}}}}}}
  ```

  An empty filter (`brackets: {}`) still makes the stand create a bracket-filter record for the item
  (`bracketFilterId` was set after the import). **A NON-empty filter imports whole** `[C]`: the filter above
  plus a `dynamicFilters` entry of the same shape as a field filter (0.5 «A record filter on the field
  TRAVELS»: `{"ajW7xfc8": {"fieldCode": "Tekst", "type": "INPUT_TEXT", "value": "фильтр", "numberFrom": 0,
  "numberTo": 0, "isCurrentUser": false, "isEmptyValue": false, "boiIds": {}, "fromFieldCodes": {}}}`), shipped
  with the BO in one archive, came back from `v2/menu-item/load-bracket-filter` as one bracket ANDing «Текст =
  фильтр» and «Автор = я». `fieldCode` is resolved to the field id of the (new) BO, and the map keys are free
  8-char ids that become the ids of the bracket and of each filter as they are.
- **A menu line may reference a BO that is not in the archive**: the 3-item export carried no BO line of
  its own for the items' BOs (the one BO line in it came from the BO basket). Such a line relies on the
  BO already being on the stand, by `boCode`.
- Line order in an export: a child was listed BEFORE its group (`TestSumProcess` before
  `GruppatqrXI0InJC5abW8w`), so the importer probably tolerates any order `[I]`; a generated archive
  puts the group first, the order proved on import.

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

**A `menuItemCode` that already exists is UPDATED IN PLACE** `[C]`.
Three archives, one code (`Proba_reimport_menu`), applied in turn: A = BO + list-only item
(«Проба повторного импорта», `orderIndex` 950000); B = the same with the item renamed «… — ИЗМЕНЕНО» and
960000; C = the item line ALONE (no group, no BO line), renamed «… — ИЗМЕНЕНО 2», 970000. The dry run of
B and C reported `menuItemState: "UPDATE"` with `oldDisplayName` = the current name and
`changedAspects: ["display_name","order_index","bracket_filter","bo_pages","linked_bo"]` — the last three
listed although they did not change, so `changedAspects` is not a real diff for them. After each apply
`load-nav-items` showed ONE item with the SAME id (`6AgRKDPf0r2Ot4Sm`), the same `bracketFilterId`, the
new name and order; the stand's menu count went 19 → 20 → 20 → 20. So a code clash EDITS the customer's
item — the reason 0.5d forbids reusing a stand menu code unasked. C also proves that a **menu-only
archive** (one line, no `BoGroupStructDto`, no `BoStructDto`) analyses and applies, the BO resolved by
`boCode` off the stand.

**Rollback removes menu items too** `[C]`. `load-import-rollback-preview` listed three `deleteItems`:
the BO (`category: "BUSINESS_OBJECT"`, `code: "Proba_menu_bo#BUSINESS_OBJECT"`) and both menu
lines (`category: "MENU"`, `code: "<menuItemCode>#MENU"`, `structTypes: ["MENU"]`); `rollback-import`
answered `{"type":"ROLLED_BACK"}` and afterwards the BO answered `NoBoWithId`, the group was gone from
the sidebar roots and the stand's list of menu items was back to its 19.

**Icons travel in the archive — any name of the picker, both namespaces** `[C]`
(`<stand>`/`<COMPANY_A>`, build `S4.24.25.632/C4.24.25.264`). One archive: a BO, a GROUP with
`"iconName":"phosphor:rocket"`, and three BO items inside it with `phosphor:house-line`,
`menu-item:025-building` and the made-up `phosphor:no-such-icon-xyz`. The dry run was clean for all four
(`load-import-errors` empty, `conflicts: {}`); after `APPLIED`, `load-nav-items` returned each `iconName`
exactly as shipped, the made-up one included. In the sidebar the rocket, the house and the building were
drawn; the made-up item had NO icon at all. How the frontend draws a name: `<ns>:<name>` is fetched as
`/assets/icons/<ns>/<name>.svg` (read off the network log), so «a valid icon» = «that file exists»: the
made-up name answers 404, while all 1153 names of the picker answer 200 (0.5e). The stand's own items
already used both namespaces (`phosphor:house`, `menu-item:022-presentation`), so the `menu-item:`
set is not a leftover. Rolled back; the stand was left without the probe (BO `No bo with code`, 14 menu
roots as before).

**Rolling back an UPDATE restores a snapshot, and the stand may pick the wrong import as «latest»** `[C]`
— the rules are in 0.12 «Rollback» (the full run: `MYBPM-UI-API.md` §5 «Rollback trap»): the preview of B/C lists `restoreItems` (`action:
"RESTORE"`, the BO and the menu line) and no `deleteItems`; only A's preview had `deleteItems`.

**Menu access rights travel** `[C]`: an item with view limited to one
group exports `chosenAccessRight: true` + `accessGroup` (`{denyAll:true, all:{…}, view:{denyAll:true,
orgUnitIds:["G-<id>"]}, …}` — the `AccessStructDto` action shape) and one `ExportStructInstanceDto` per
group (`boCode:"PersonGroup"`); after the item was reset to «всем» the import put the group back.
**Calendar and timeline views travel** `[C]` (same day): `boPages` in the export carries
`timelineFieldCode` (the `PERIOD` field's CODE) instead of `timelineFieldId`, the import resolves it.

Open `[U]`: where else a kanban can be switched on besides a menu item (0.5c).

## 6. References between BOs

- Type `BO`, `viewType` SINGLE / TABLE / MULTIPLE, `oldRefBoId`, `boRefStruct{boInfo, fieldRefs,
  linkedFieldCode}`. A two-way link is a SINGLE↔TABLE pair joined by `linkedFieldCode`.
- **`oldRefBoId` ≠ the target's `oldId` is NORMAL** (every reference in `<company-b>` mismatches) — not a bug.
- **M:N (TABLE↔TABLE)** has never been seen in any export; how to express it is unknown `[U]`.
- `fieldRefs` = the reference's display config («Выбрать поля для отображения»):
  `{fieldCode: {toShow, orderIndex, gridPosition}}`. In real exports the gridPositions are a flattened
  copy of the TARGET BO's layout; a synthetic non-overlapping stack imports fine. `fieldRefs` does **not**
  resolve Excel references (that goes through the target's unique field) but it **defines the Excel
  sub-columns**.
- How the stand serializes a hand-made linked pair: the SINGLE side lists the linked field in `fieldRefs`
  as `{"gridPosition":{…}}` with no `toShow` and `tableColToShow:false`; the TABLE side does **not** list
  the linked field and has `isKindAddForSelect:false`. `<company-b>`'s SINGLE side additionally carries
  `isReadonly:true, chosenAccessRight:true`. A generated pair differing in exactly these points behaves
  identically on import — proven irrelevant to the Excel link defect. `[C]`
- A hand-made plain TABLE reference (no `linkedFieldCode`) exports with `fieldRefs` of only the toShow fields.

### Person reference

Type `BO`, `boInfo{code:"Person", name:"Пользователи", boCategory:"BO"}`, `oldRefBoId` = the company's
`personBoId`. Platform default for a fresh Person reference `[C]`: `surname`, `name`, `email`,
`personGroup` are `toShow:true`, every other Person field false (phone, position, department, status,
accessLevel, adGuid, ad_employee_id, is_external, is_lang, person_avatar, phoneVerified). To show ФИО
only, write `email` and `personGroup` as explicit `toShow:false` — because import merges (§7).

### Built-in BOs

Codes `Person`, `Department`, `PersonGroup` are taken — a user BO coded `Department` failed import with
«Несоответствие типов объектов» `[C]`. **Never reuse them.** No export (28 checked) contains a
`BoStructDto` for a built-in BO; they appear only as ids in CompanyMetadata. Do not synthesize one (risk
of overwriting built-in fields). To add a field to a built-in BO, do it by hand in the constructor;
exporting its real structure and appending to that DTO is untested `[U]`.

## 7. Access rights inside the archive (`AccessStructDto`)

The API and UI side of rights → `MYBPM-UI-API.md`.

- `boAccessStruct` per action: `all, create, view, edit, delete, archive, export, duplicate, add`. Each
  action carries `denyAll`, `orgUnitIds: ["G-<groupId>", …]`, `authorsField{author, …}`,
  `fromFields{<personFieldCode>: same flags}`, `participants`.
- Field rules: `fieldAccessStructMap[fieldCode]` (only `view` + `edit` are meaningful per field).
  Tab rules: `fieldAccessStructMap[<TAB_GROUP code>].tabAccessStructMap[<tab code>]` — the same nine
  actions, only `view` + `edit` meaningful. **Tab rules round-trip** `[C]`: the
  «Секрет» tab locked to one group for view + edit over the API, exported, copied as a new BO and
  imported — the copy came back with exactly that lock on that tab, the other tab open to all, and
  the field still on its tab. «никому» (`view.denyAll:true`, empty `orgUnitIds`) also imports.
  Both keys are CODES; `validate-archive` checks that they name a real `TAB_GROUP` and its tab.
  Whether the tab is really hidden for a non-admin user was not seen (the stand account is an
  admin and sees the tab either way) `[U]`.
- Semantics, read off `<company-b>` rather than documented `[I]`: `denyAll:false` = «всем»;
  `denyAll:true` + empty `orgUnitIds` + all-false `authorsField` = «никому»; `denyAll:true` + ids and/or
  `author:true` = «только этим». The struct's **top-level** `denyAll` is a "custom rights are set" flag,
  not a global deny (every `<company-b>` BO has it true while its actions stay open).
- `chosenAccessRight:true` marks fields/tabs with individual rights. **It is only the orange lock in the
  constructor** `[C]`: a tab imported with `chosenAccessRight:false` and a «никому» rule
  still got that rule, and the flag came back `false` as written. Write it `true` wherever you ship a
  rule so the constructor shows the lock.
- `participants` and `authorsField.fieldCodes` were never seen filled — semantics unknown `[U]`.
- Stand exports write `fromFields` for EVERY Person-ref field in EVERY action; it is a real setting, not a
  blind default (the stand kept `author=false` where the archive wrote false).
- Rights of subjects are OR-ed: a per-record/per-field grant cannot narrow a group-level grant.
- Keep dictionary `view` open to everyone, otherwise dropdowns bound to it cannot open (design reasoning,
  not tested `[U]`).

## 8. What import does

- **Import MERGES into the BO already on the stand** `[C]`: a key ABSENT from the archive keeps its stand
  value; an explicit flag overwrites it. Evidence: dropping the `code` key from `fieldRefs` left «Код»
  ticked, writing `{"toShow": false}` unticked it. **Rule: to hide or disable something, write the flag
  as `false`; never drop the key. Write field-level flags explicitly on every field.**
- **Nothing is ever deleted by an import** `[C]`: an archive without a
  field that the stand BO has leaves the field in place (the pre-apply diff has only «added» / «changed»
  categories, and the import client has no delete path at all). Remove fields and tabs in the constructor
  or through the API (`deletedFieldIds` of `save-business-object-portion`, `MYBPM-UI-API.md` R1).
  Tabs were not re-probed separately — same mechanism `[I]`.
- Structure import does not touch instance values — belief consistent with everything seen `[I]`.
- **Import APPLIES `AccessStructDto`, group ids included** `[C]`: a BO's
  view given to one group and edit to another through the API, exported with «Права доступа», then reset
  to «всем», then that export imported → both groups were back on their actions. `denyAll`, `author`,
  `fromFields` and field rules arrive too (a tab «Системные» hidden in all 6 BOs). The import does NOT
  clear `orgUnitIds`; ids are `G-<group id>` of the TARGET stand, so an archive built on another stand grants
  nothing to groups.
- **An archive WITHOUT `AccessStructDto` leaves the stand's rights untouched** `[C]` (same day: groups set
  on the BO survived an import of a structure-only archive). So a structure-only archive is the safe way to
  update a BO whose rights were set by hand; an archive WITH the DTO replaces them.
- An export with rights also carries one `ExportStructInstanceDto` per group it mentions
  (`boCode:"PersonGroup"`, `kind:"PERSON_GROUP"`, `fieldMap.name.storedValue` = the group name,
  `sources[].accessRightsInstanceSource`) — the group RECORD, not only its id `[C]`. Whether the import
  creates a missing group from it on another stand is `[U]`.
- Getting group ids for an archive: set probe rights on one BO with a DIFFERENT group per action
  (view/edit/delete/archive/export), export the structure, map ids by action (worked first try); or call
  `load-org-unit-record-list`. Archive ids are `G-<id>`, API ids have no prefix.
- **«APPLIED» does not mean the BO was created** `[C]`: an apply whose process ends
  `hasError: true, errorState: "ONLY_INTERMEDIATE_ERRORS"` still sets the import to `APPLIED`, yet the BO
  may be missing — the case seen: `kanbanCardTemplates` naming a field code the archive no longer has
  («no field with code: …»). `load-import-errors` stays empty; the message is only in
  `v2/process-indicator/load-state {processId}` → `phases.*.errors`. After every apply check the poll's
  `hasError` and load the BO. When you delete a field from an archive, delete it from every
  `kanbanCardTemplates.*.kanbanFields` too.
- BOs created via import carry `kanbanCardTemplates:{}` unless the archive fills it — and an empty one is
  exactly why «kanban does not work for imported BOs», and why their MAP view fails too (§2 «BO views»). Fill it
  for every dropdown: §0.5c, 0.10 rule 16, `MYBPM-UI-API.md` §7.

### BO groups on import — matched by `code` `[C]`

Six probe imports on `<stand>`, each rolled back, the stand's group list compared before and after:

| archive group line | result |
|---|---|
| no `code`, new name | the stand group «Бизнес-объект» was **renamed** to the new name, BO put into it |
| no `code`, new name, unique `orderIndex` | the same group renamed AND moved to that `orderIndex` |
| no `code`, `name` = another existing group («Tests») | the same «Бизнес-объект» renamed to «Tests» — two groups «Tests» |
| two lines, no codes | both BOs in the same renamed group (the name of the LAST line) |
| `code` = an existing group's code, `name` / `orderIndex` = the group's own | BO in that group, nothing renamed |
| `code` = an existing group's code, another `name` / `orderIndex` | BO in that group, the group RENAMED and MOVED to the line's values (two process probes) |
| `code` new to the stand | a NEW group created — id = the line's `newId`, `code` kept |
| two lines, one existing code + one new code | each BO in its own group, one group created, nothing renamed (the existing line carried the group's own name) |

- **Groups are matched by `code`.** A line without `code` is written onto ONE fixed stand group (here
  «Бизнес-объект», the group with the largest `orderIndex`; why that one is `[U]`) — name and
  `orderIndex` are overwritten. The name is NOT a key: the «safe recipe» «copy an existing
  group's name» works only because the name copied was that same fixed group's own name.
- The symptom «two groups → all BOs in «Справочники», renamed» is this same behaviour: group lines
  without `code`.
- **A code-matched line is NOT a safe pointer** — it rewrites the group's `name` and `orderIndex` to its
  own. Only a line that repeats both exactly leaves the group as it was.
- **Rollback deletes the imported BOs and a group the import CREATED, but does NOT undo a rename** — the
  rollback preview lists no `restoreItems` for the group. Repair by hand: `v2/business-objects/
  save-business-object-group` with the group object of `load-bo-groups` and the old `name` / `orderIndex`
  (`MYBPM-UI-API.md` §5).
- Stand groups made in the UI mostly have `code: null` (13 of 14 on `<stand>`); an archive can reach only
  a group that has a code. Giving an existing group a code is `save-business-object-group` with `code`
  (+ `verify-business-object-group-code`) `[I]`, never tried.

---

# Part II — Block IDE scripts

Scripts are delivered as **paste-ready JSON**, not as code: the editor is a Scratch-like block IDE whose
interpreter is written in Java. This part covers the JSON schema, the delivery (paste) protocol, runtime
semantics of the built-in actions, and the business-process specifics.

**If your task is «write me a script», read §0S and nothing else.** It is the script counterpart of §0:
complete literal templates of every block and expression, the `actId` catalogue, the rules that break a
script silently, a whole worked example and a self-check list. §§9–16 are the evidence behind it.

---

## 0S. COOKBOOK — produce a pasteable script from this section alone

**Read this section if your job is «write me a Block IDE method or process script».** It is
self-contained: every literal below is copied out of a script the IDE itself produced and the platform
ran. §§9–16 are the evidence and the material for exotic cases; this one is *what to type*. Follow it
literally, change only what step 2 of the algorithm says you may change, and **never invent a key, an
`actId` or an `opType`** — anything you cannot find in this section does not exist in the language.

### 0S.1 The artefact

You deliver **one JSON file that is put on the clipboard**. The user opens the method (or the process
script) in the Block IDE and presses Ctrl+V; the IDE rebuilds the blocks from the JSON. There is no
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
   returns, and the element of a foreach over a parameter array is untyped (§10 `BlockForeach`); a method cannot be called by a name taken from data; a field cannot be chosen at run time
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
3. **Build two flat maps** — `blocks` and `expressions` — inside the envelope of 0S.3. Nothing nests
   inline: a block names its expressions by id, an expression names its operands by id.
4. **Chain the statements** with `downBlockId` (0S.5), then point `startBlockIds` at the root.
5. **Run the self-check of 0S.11.** It is not optional: the IDE accepts a broken fragment silently.
6. **Strip the hat** if this is the body of an existing method (0S.12).
7. **Put the file on the clipboard** with `wl-copy --type text/plain < file.json` — no other form works.
8. **Tell the user exactly where to paste**, then ask for a copy back and compare (0S.11) — «no red in
   the IDE» proves nothing; it has silently eaten 55 expressions before.

### 0S.2a House style — naming and layout

The platform does not enforce any of this (a `varName` is a free string, 0S.5); it is the convention
every script written for this user follows (set by the user). Apply it to the pseudocode of
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
**collection** (a link-many field read through `.#Значение`) → a foreach. Do not use the counter's value:
its base is unverified.

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
`downBlockId`. **Keep exactly ONE `FROM_METHOD` per method, at the end** (0S.9).

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
`constType` is `BoiRefCode` — copied as the IDE wrote it). `[C]` for the IDE: both come from a copy the
IDE produced; how a script behaves on an `<пусто>` boolean in `ЕСЛИ` is `[U]`.

```json
{"exprValueType":"CONST","valueType":{"baseType":"BoRefCode","type":"Bo","boCode":"Operator"},"constType":"BoRefCode","boCode":"Operator","type":"ExprValue"}
{"exprValueType":"CONST","valueType":{"baseType":"BoiRefCode","type":"Bo","boCode":"MODEL_ERROR_CODE"},"constType":"BoiRefCode","boCode":"MODEL_ERROR_CODE","boiId":"5boPQBYRaVkegMu1","type":"ExprValue"}
{"exprValueType":"CONST","valueType":{"baseType":"SingleSelectRefCode","type":"SingleSelect","boCode":"Operator","fieldCode":"operator_type"},"constType":"SingleSelectRefCode","boCode":"Operator","fieldCode":"operator_type","optionId":"INDEX_BINARY","type":"ExprValue"}
```
A BO **type** (`BoRefCode` — the left operand of create-instance and of `findByFilter`); a concrete
**record / dictionary row** (`BoiRefCode` — `boiId` comes from the user); a **SingleSelect option**
(`optionId` is the option CODE, not its label; an option cannot be stored in a variable).

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
**Run-proven `opType`s** (use these by default): `Plus`, `Minus`, `Mul`, `Div`, `Concat`, `Eq`,
`NotEq`, `More`, `Less`, `And`. The language has seven more — `Or`, `Xor`, `Not` (unary: `leftExprId`
only), `LessEq`, `MoreEq`, and `OrEq` / `AndNotEq` (only inside `more` of an `Eq` / `NotEq`) — which
compile but were never run on a record (§12a); until they are, write disjunction as nested `ЕСЛИ` and
negation as the `ИНАЧЕ` branch. **Never type any other string into `opType`**: a value outside the
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
  НайтиПоФильтру  F-findByFilter-K-FIX-T-BoRefCode
```

This is the run-proven core. **The complete catalogue — 30 text actions (case folding, trim, contains,
last index, cut, JSON, Base64 …), dates with units and patterns, filters, JSON, REST, e-mail, files,
spreadsheets, field meta-attributes and validation errors — is §12a.** An `actId` from §12a compiles;
one that is in neither place does not exist. There is still no `indexOf` (only
`F-returnLastIndex-K-FIX-T-String`), no `ceil`, no «strip trailing zeros».

### 0S.9 Thirteen rules — each of these has silently broken a real script

1. **Never compare numbers with `Eq`/`NotEq`.** They are `BigDecimal.equals` — scale-sensitive, so
   `4/2 = 2` is **false**. Equality = «не меньше и не больше»; a zero guard likewise (`1/(0.5−0.5)` slipped
   through an `Eq 0` guard). `Less`/`More` are safe.
2. **Never test a boolean with `Eq`.** Put the boolean expression straight into `ifExprId` and use the
   plain «ИНАЧЕ» for its complement — `Eq(флаг, Нет)` has failed to fire on the stand. `translate-script`
   says why `[C]`: an act's result is a primitive `boolean`, a «Да/Нет» constant a `Boolean`, and
   `Eq` between them gives `WARN exprOp__equalsDifferentTypes` «Сравниваются значения разных типов: слева
   boolean, справа Boolean - эти значения одинаковыми быть не могут никогда» — with `success:true`, so a
   warning-only result is NOT a clean script. For «= Нет» use `Not` (unary, `leftExprId` only).
3. **Exactly one `FROM_METHOD` per method, at the end.** An early exit from inside an `ЕСЛИ` branch is the
   other suspect of the same defect.
4. **The first block of a body that uses a TEXT parameter must be `Пусть #x# = '' ⊕ <параметр>`.** A body
   paste has no parameter declarations, so the IDE assumes every parameter is a **number**; a bare
   parameter reference typed a variable numeric once and **18 string assignments into it vanished without
   an error**. The `'' Concat` gives it the String type. (Passing a parameter directly as an argument of a
   String action is safe.)
5. **No chained comparison.** `a > b > c` parses as `(a > b) > c`. Use `And` or nested `ЕСЛИ`.
6. **Every expression referenced exactly once** (0S.6) — a shared subtree is a DAG and the IDE rejects it.
7. **Variable names unique within a scope**, loop element names included: no name may be declared again
   where a variable of that name is visible. The IDE checks exactly this, so two copies of one module
   (0S.2a) in two separate `ЕСЛИ` branches may declare the same inner names (stated by the user).
8. **`#Подстрока` with `start >= end` returns the WHOLE string**, not `""`. Always guard:
   `ЕСЛИ конец > начало : x = #Подстрока(…) ИНАЧЕ : x = ""`.
9. **`#Заменить` is literal**; a regex handed to it is matched as text. A *broken* regex in `#Регулярка?`
   returns `Нет` instead of erroring — a wrong pattern looks like «never matches». Inside `[…]` escape
   punctuation (a bare `-` makes a range) but **never backslash a letter** (`\o` is an error, `\d` is a
   digit class): word alternatives go into `^(?:or|and)$`.
10. **Number→text is `BigDecimal.toString()`**: the scale survives (`3.000000000000`) and `0/100` prints
    as `0E-30`. Anything parsing numbers out of text must accept an exponent.
11. **No `while`**: a bounded loop is `ЦИКЛ #i# : "200"` plus `ВЫЙТИ ИЗ ЦИКЛА` on the exit condition.
    Bind the bound to a value that cannot change inside the loop.
12. **Paste callees before callers.** A call emitted while the callee did not exist keeps a synthetic
    parameter id and must be re-pasted afterwards — the IDE's «не определён тип» warning hides it.
13. **Enum-typed keys take only listed values.** `opType`, `exitType`, `exprValueType`, `constType`,
    `type`: a value the server does not know is stored anyway and makes every script of the BO
    unreadable, irreparably through the API (§17 trap 26). Wrong `actId`s and argument names are safe —
    `translate-script` reports them.

### 0S.10 Worked example — a whole file

Method `describe(step: Model_step, formula: Текст) : Текст`, with the parameter ids taken from the user's
copy (`KJC71su~DqnMxD7z` = `step`, `0du0wJobopgISW6H` = `formula`):

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
`tools/follow-cookbook-script.bun.ts` (`DET=1`) rebuilds exactly this JSON.

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
   before you deliver it (§0S.13 lists the checkers already written for one project; ask the user
   whether that project's folder is at hand before writing a new one).
8. **House style** (0S.2a): every name carries its decoration, `#…#` is all lower case, a boolean ends
   in `?`, counters are bare, the header precedes the logic, a module's `ЕСЛИ` holds nothing but `|…|`
   and has no other branch, no `ЭТА ИНСТАНЦИЯ` inside a module, every copy of a module is byte-identical.

### 0S.12 Delivering the file

1. **Body paste** (the normal case — the method already exists): remove the `BlockFixMethod` entry, point
   `startBlockIds` at its `downBlockId`, and copy the hat's `x`/`y` onto that block. A project hat-stripper
   («Tooling that already exists») does exactly this. The stripped body must have exactly one block fewer than the file you built.
2. **Clipboard**: `wl-copy --type text/plain < file.json`. A bare `wl-copy < file.json` advertises
   `application/json` and **the paste is silently ignored**. Verify with `wl-paste -n | md5sum` against the
   file. `wl-copy` daemonises: never end a piped script with it, or the caller hangs.
3. **Order**: paste every method (callees first), and only then copy the process script — **an entry point
   sitting in the clipboard blocks method pastes**. Copy nothing after it.
4. **Tell the user precisely**: which method to open, that the body must be cleared first, and that they
   press Ctrl+V on the canvas. Then ask them to **copy the result back** (`wl-paste -n > live.json`).
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
7. **Headless alternative — no clipboard, no user** `[C]`, when you hold a session token of the
   stand (`/web/` envelope `{useParamsFromBody:true, params_Lr1oSgwPR8:{…}, body_o1nhHUG480:{…}}`, header
   `token`): the target is a pair `{scriptModuleId, scriptId}` (a hook or a method of a BO's script
   version — take a TEST version).
   1. `POST /web/v2/script/paste` params `{scriptModuleId, scriptId}`, body `{copied: <your file>}` → the
      same fragment back as `copied`, every id regenerated. It writes NOTHING.
   2. `POST /web/v2/script/apply-update-cmd`, same params, body `{name:"PASTE", forward:{type:"Group",
      list:[{type:"Set",dotPath:"blocks.<id>",value:<block>} …, {type:"Set",dotPath:"expressions.<id>",
      value:<expr>} …]}, backward:{…the same list as Unset…}}` over the returned `copied`.
   3. `POST /web/v2/script/translate-script`, same params → must be `{"success":true}` (INFO notes are fine).
   4. To take it back: `POST /web/v2/script/undo`, same params — one call undoes the whole step 2.
   Into an EMPTY hook the file goes WITH its entry-point hat (`BlockFixEntryPoint`) and a closing
   `BlockExit FROM_METHOD`. Proven on a 711-block / 1723-expression fragment and 26 small ones.

---

## 9. Script JSON envelope

- A copied/pasted fragment is JSON with `copiedType: "SCRIPT_BLOCKS"`, roots in `startBlockIds`, plus a
  `blocks` map and an `expressions` map, both keyed by id. Several roots in one fragment are syntactically
  possible; a multi-method paste was never tested `[U]`.
- Ids are 16 characters of letters, digits, `@` and `~` (`zngRL2KpAU1YQ4tn`, `CnTkEwA@Ybn4tOeF`,
  `9qzhdpJfhU~cu4Uj`). `[C]`
- **External references are not part of the fragment**: `actId`, `targetArrowId`, `boiId` point outside the
  JSON — a dangling-reference checker must skip them.
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
  a number (`Цикл #i# : текст.#Длина`, or over a numeric CONST `2` / `"200"` — runs on the stand) and a
  **foreach over a collection** (`Цикл #параметр# : ~Параметры~.#Значение`). The counter's base is unknown
  `[U]` — do not rely on the counter's value.
  - **Over an ARRAY PARAMETER of a method** (`params.<id>.type = {"baseType":"String","type":"Text","isArray":true}`)
    the loop compiles, but the Java translation declares the element as `Object` `[C]`: using it where a
    `String` is expected — assigned to a Text variable, as the left side of `#Длина` — fails phase 4 with
    `compile:compiler.err.prob.found.req` «java.lang.Object cannot be converted to java.lang.String». Wrap it
    once: `Пусть #t# = '' ⊕ #el#` (a `Concat` with an empty text) compiles, and `#t#` is a Text from then on.
    A `Bo[]` parameter is reported to fail the same way («… cannot be converted to BoiRef») `[I]`.
- `BlockExit {exitType, circleBlockId?, targetArrowId?}`:
  - `FROM_METHOD` — «Выйти из метода: <значение>», **carries the return value**; a body without it returns
    nothing. An early `FROM_METHOD` inside an IF branch is a suspect of the boolean gate defect (§15).
  - `FROM_CIRCLE` = break, works from inside a branch of the loop it targets `[C]`;
    `FROM_CIRCLE_ITER` = continue (targeting a non-innermost loop was never used `[U]`).
  - `FROM_METHOD_BY_ARROW` + `targetArrowId` — leaves a **process** script by a named arrow (§16).
- `F-CI` (create instance) creates the instance immediately; one never `ADD`ed to a list may stay an
  orphan `[I]`.

## 11. Expressions

### Constants and variable references (`ExprValue`)

Exact encodings from real copies, used in pastes that worked:

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
- opTypes confirmed in IDE copies / live processes: `Eq`, `NotEq`, `More`, `Less`, `Plus`, `Minus`,
  `Mul`, `Div` (**not** `Multiply`/`Divide`), `And`, `Concat`.
- The whole enum has 17 members (§12a): also `Or`, `Xor`, `Not` (unary), `LessEq` (⩽), `MoreEq` (⩾),
  `OrEq`, `AndNotEq` `[C]` compile; runtime `[U]`.
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
#Содержит     F-contains-K-FIX-T-String                        arg fragment — [C] catalogue (§12a)
```

There is **no `indexOf`** in the known String palette (not proven exhaustive).

### Number — `-K-FIX-T-BigDecimal`

Full palette (user screenshot, «Всё, больше ни чего нет»): operators `≥ ≤ ≠ • > = < / - +`;
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

`#Чётное ли?` = `F-isEven-K-FIX-T-BigDecimal` (§12a). Natives accept any BigDecimal (`7,5.#не чётное ли?` was accepted).

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
  field multilingual later means adding that hop in every script. `[C]`
- **Collections (link-many)**: `~Параметры~ = ~Модель заявки~.params`, iterated by `BlockForeach` over
  `<list field>.#Значение` (the list needs the VALUE hop too); the loop source may be a nested act without
  an intermediate variable. Create instance `F-CI-K-DYN-R-C-S-bo_fields` (left = `BoRefCode`),
  add `F-ADD-K-DYN-R-D-S-boi_fields` (arg `adding`), count `F-COUNT-K-DYN-R-D-S-boi_fields`.
- **Checkbox**: the value act used directly as an `Если` condition is accepted and a stand check depending
  on it passed `[I]`; its runtime text form when concatenated was never measured `[U]` (§15).
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

`boCode` = the BO owning the field; **`optionId` = the option CODE given at creation** (the UI shows
labels). An option **cannot be held in a local variable** — carry a numeric code instead `[I]`.

### Dictionary search

`<BoRefCode "Operator">.F-findByFilter-K-FIX-T-BoRefCode` (IDE: «НайтиПоФильтру») returns the rows; loop
over them and read e.g. `#оператор#.Значение.#Значение.Русский`. **Available in METHODS too**, not only in
processes `[C]`.

**Field and dictionary references are compile-time constants** `[I]`: the field actId is a literal and a
dictionary's `boCode` is a CONST inside the expression's `valueType`. Therefore reading "the field named in
a variable" needs one IF per field, and a dictionary whose code is computed at run time cannot be
enumerated (§15).

## 12a. The whole palette — read off the stand's own catalogue API `[C]`

§12 was assembled from copies of real scripts, so it lists only what somebody happened to use. The IDE
builds every list it shows from six calls of `v2/script` (`MYBPM-UI-API.md` §5g «The catalogue
calls»), and those calls were walked exhaustively: every value type → every action on it → the type it
returns → the actions on that, down to the leaves. **This section is therefore the complete language
as of this build; anything not here does not exist.** The raw dumps sit in
`tools/out/ide-catalogue-<date>/` (git-ignored — they contain stand codes).

### The toolbox — what the IDE's left panel really holds `[C]` (screen + bundle module `oe.ngOnInit`)

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
`showPanelWithOldElements:true`; it was `false` here): `BlockSetVar` (`varType` `LocalCreate`/`LocalRef`),
`BlockSetField`, `BlockObject`, `BlockReturn` (or `BlockSwitchExit` in a `SwitchCondition` script),
`ExprConst` (`valueBool`/`valueNumber`/`valueTxt`), `ExprVar`, `ExprField`, `ExprObject`, `ExprNewBoi`,
`ExprBoiFind`, `ExprCreateObject`, `BlockFunc`, `ExprFunc`. **Do not generate them**: `translate-script`
accepts a `BlockFunc` but answers `WARN used_deprecated_blocks` «…оптимизация компиляции отключена» —
the whole script then runs unoptimised. Everything they did is reachable through the modern elements.

### Every `opType` — 17, with the operators each one may be chained with in `more` `[C]`

Read off the client's operator table (module `88612`); all 17 are in `kz.greetgo.script.model.expr.enums.OpType`.

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
`success:true`). Their runtime was not exercised on a record `[U]` — §15's advice to prefer
nested `ЕСЛИ` stands until it is. In the action list of a value an operator appears as a pseudo-action
`K-OP-OP-<opType>`; that id is never written into a script — choosing it produces an `ExprOp`.

**A wrong `opType` string destroys the BO's scripts** — see §17 trap 26 before you write one by hand.

### Value kinds of `ExprValue` — the 15 entries of «выберите значение» `[C]`

`load-const-value-type-list` returns them; the key names are those `load-const-form` binds (`recordIdDotPaths`
/ `updateDotPathMap` / `textDotPath`), and each literal below compiled.

| UI | `exprValueType` / `constType` | keys |
|---|---|---|
| Переменная | `VAR_REF` | `varBlockId` |
| **ЭТА ИНСТАНЦИЯ** (BO script) / ЭТОТ ПРОЦЕСС (process) | `THIS_PROCESS`, `constType:"BoiRefCode"` | — the record the script runs on |
| Текст / Число | `CONST` `String` / `BigDecimal` | `value` (a string) |
| Да/Нет | `CONST` `Boolean` | `value` `"yes"`/`"no"` |
| Дата/время | `CONST` `Date` | `value` (format not captured `[U]`) |
| Гео-координаты | `CONST` `GeoPoint` | `latitude`, `longitude`, `geoPointShowType` (`DEGREES_PARTS`/`DEGREES_MIN_SEC`) |
| Бизнес-объект (тип) / (экземпляр) | `CONST` `BoRefCode` / `BoiRefCode` | `boCode` / `boCode`+`boiId` |
| Одиночный выбор | `CONST` `SingleSelectRefCode` | `boCode`, `fieldCode`, `optionId` |
| **Перечисление** | `CONST` `Enum` | **`enumBaseType`, `enumValue`**; `valueType:{type:"EnumRef",baseType:<enum>,enumNativeName:<enum>}` |
| **Встроенные объекты** | `CONST` `JavaObjectFactories` | **`objectDescriptor`** (table below); `valueType:{type:"Object",baseType:<class>}` |
| Метод скрипта | `CONST` `ScriptMethodRef` | `value` (for a timer / a confirm-form button) |
| Печатная форма | `CONST` `PrintFormRef` | `boCode`, `printFormCode` |
| Аналитика | `CONST` `ReportRefCode` | `reportCode` |

Enum literal that compiled: `{"type":"ExprValue","exprValueType":"CONST","constType":"Enum",
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
`DatePattern` has two labels swapped **on the platform side**: `YY_MM_DD_DASH` is labelled «ГГГГ-ММ-ДД» and
`YYYY_MM_DD_DASH` «ГГ-ММ-ДД». Which output each really gives was not run `[U]` — test before relying on it.

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

Walked on a probe BO holding all 27 field types plus the system fields and widgets.

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

| field type | `#Значение` returns | extra acts on the field reference |
|---|---|---|
| INPUT_TEXT, TEXTAREA, INPUT_PHONE, INPUT_EMAIL, LINK | Text | — |
| INPUT_NUMBER | Number | — |
| CHECKBOX | Bool | — |
| DATE, FULL_DATE, TIME, YEAR, YEAR_AND_MONTH | Date | — |
| PERIOD, PERIOD_TIME | Period | — |
| INPUT_TEXT_LANG, TEXTAREA_LANG, STATIC_TEXT | TextLang | `F-VALUE_IN_LANG-K-DYN-R-D-S-boi_fields (language:EnumRef/MybpmLang)` → Text |
| DROPDOWN_SINGLE, RADIO_BUTTON_GROUP | SingleSelect | — |
| GEO_POINT | GeoPoint | — |
| FILE_UPLOAD | File/MybpmFile | `F-addFile_v2-K-FIX-T-BoiFieldRefCode (file)` |
| BO (link, multiple) / CO | `Bo/BoiRefCode[]` | `F-ADD (adding)`, `F-DELETE (deleting)`, `F-COUNT`, `F-FIRST`, `F-LAST`, `F-VALUE_FROM_LIST` («Значения как в реестре»), all `-K-DYN-R-D-S-boi_fields`; CO also `F-SHOWN_BO_IN_CO_FIELD-K-DYN-R-M-S-boi_fields (boRefCode, orgUnit)` |
| BO (single — e.g. CREATED_BY, LAST_MODIFIED_BY) | `Bo/BoiRefCode` | the same list-acts plus `F-HAS_REF`, **and every field of the target BO directly**: `rec.CREATED_BY.surname` is `F-surname-K-DYN-S-boi_fields` applied to the field reference, no `#Значение` hop |
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

A GET run end to end on core2 `[C]`. The script was
`Пусть #запрос# = Создать Rest-запрос` (`JavaObjectFactories` `BEAN_METHOD-RestExtensions-createJsonDeck`)
→ `#запрос#.адрес = …` → `#запрос#.Метод вызова = GET` (an `Enum` constant `RestRequestMethod`) →
optional `#запрос#.#Заголовок("Referer", …)` (a `BlockAssign` with `leftExprId` only) →
`Пусть #ответ# = #запрос#.#вызвать`. What the run showed:
- **A 4xx does not throw.** The script goes on with `resultCode` 403 or 401 and the error body in
  `resultAsText`.
- **Every non-2xx also raises a notification for the user**: «Ошибка — Возникла ошибка при запросе в
  сервис <full url> причина: Forbidden». **The url is shown whole, query string and `apikey=` included** —
  keep secrets out of the query where you can (put them in a header).
- **Number → text works with `'' ⊕ resultCode`.**
- **`headerText` of a header the response lacks gives an empty string.**

A second script, run on core2 `[C]`, chained three GETs and parsed their JSON. It was a field
script on a button, 57 blocks, and it compiled and ran on the first paste:
- **A Cyrillic and spaced value can go into `адрес` raw** (`"…&geocode=" ⊕ <address field>`). The
  request reached the service correctly encoded. A raw curl URL, by contrast, needs `--data-urlencode`.
- **JSON walk**: `resultAsJsonDeck` → `getAsJsonDeck(name)` … → `getAsJsonArr(name)`. **A
  `BlockForeach` over a `JsonDeck[]` types its element as `JsonDeck`**, so the loop body goes on with
  `getAsJsonDeck` / `getAsText` on the element. Use that for «the first item». `F-first-K-FIX-T-Iterable`
  returns a bare `Object`, which is not verified to take the `JsonDeck` acts.
- **A Rest response into a file field**: `resultAsMybpmByteArray` → `convertToFile(fileName)`, then
  **`BlockAssign` to the FILE_UPLOAD field's `#Значение`, which REPLACES the file**.
  `F-addFile_v2-K-FIX-T-BoiFieldRefCode` on the field reference APPENDS one more file on each run.
  **In «Множественный» mode `#Значение` is `File[]`**, and assigning one file fails `translate-script`
  with `blockAssign_arrayAssignNoArray`. The script language has no array constructor. What works is
  `Пусть #файлы# = (Создать Email).Прикреплённые файлы` (`BEAN_METHOD-ScriptEmailFactory-newScriptEmail`
  → `F-attachments-K-FIX-T-ScriptEmail`, an empty `File[]`), then
  `#файлы#.добавить(<file>)` (`F-add-K-FIX-T-Iterable`, a `BlockAssign` without `rightExprId`), then
  `<field>.#Значение = #файлы#`. That compiled and ran, and it still replaces rather than appends.
- **A TEXTAREA on that build is an HTML editor (summernote)**, so `\n` in a written text collapses into
  a space. Separate lines with `<br>`, which the sanitizer keeps. The same holds for `TEXTAREA_LANG`, and
  a script may write any HTML fragment into either, not only `<br>` `[C]` (the user).
- `F-returnLastIndex-K-FIX-T-String` plus `substring(0, idx)` plus `trim` split `"lon lat"` correctly.
  The lat was taken as `trim(replace(pos, lon, ""))`, so the exact index semantics did not matter.

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
(`BoRefCode`) — of a `BO_PROCESS` BO; on a plain BO's record they are absent, which is why the catalogue
walk above (done in a plain BO's context) missed them. All three take no arguments and return nothing
(use them as `BlockAssign` without `rightExprId`, see above):

```
F-goForProcess-K-FIX-T-BoiRefCode      #Запустить процесс     () → —   start the business process of that record
F-continueProcess-K-FIX-T-BoiRefCode   #Продолжить процесс    () → —   release every wait of that process: a Form
                                                                         it waits on, or a Timer, passes on at once
F-terminateProcess-K-FIX-T-BoiRefCode  #Терминируй процесс    () → —   stop the whole process, all arrows halt
```

A process record also has the field action `F-PROCESS_STATUS-K-DYN-S-boi_fields` (its `PROCESS_STATUS`).
`F-updateTrapDate-K-FIX-T-BoiFieldRefCode` «#Обновить таймер для процесса» `[C]` (read in a
process's own context) is an action on a process FIELD (`BoiFieldRefCode` = `ЭТОТ_ПРОЦЕСС.<field>`, no
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
  generator. `[C]`
- **`ExprCall.args` is keyed by the callee's parameter id** — not by position, not by name. A stale or
  invented key renders «Не передан аргумент `#var_name#` в вызов метода `is_var`» and the IDE adds the real
  slot beside it. Consequences: renaming or reordering a signature cannot change which argument lands
  where; **adding a parameter to a widely called method is not a local change** (prefer a new method);
  **recreating a callee breaks every call site**. `[C]`
- The return type can be changed in place and the parameter ids survive. `[C]`
- Calls between methods work; **recursion is allowed** `[C]` but was never exercised in a working script —
  the engines built so far use counted loops instead.
- **A called method must exist**: a call to a missing one shows «У выражения справа не определён тип», and
  «метода без тела в проекте быть не может» — create a stub with a trivial body for a not-yet-written callee.
- Whether an argument can carry a LIST of instances is `[U]`; a single BO instance is fine.

## 14. Delivery: the paste protocol

### Clipboard (Linux / Wayland)

- **Always `wl-copy --type text/plain < file.json`.** A bare `wl-copy < file` sniffs the content and
  advertises `application/json` first → **the paste is silently ignored**. Verify with
  `wl-paste -n | md5sum` against the file before the user pastes (`wl-paste` without `-n` appends `\n`). `[C]`
- **A script that ends with `wl-copy` hangs its caller**: wl-copy daemonises and inherits stdout/the pipe,
  so `bun run x.bun.ts | tail` never returns (cost two 120 s timeouts). Run it bare, or
  `> log 2>&1 < /dev/null`, or give the script a no-copy flag for dry runs. Killing the wrapper is safe —
  wl-copy keeps the clipboard.
- **Reading a copy back**: the user copies the method/process in the IDE → `wl-paste -n > live.json`.
  Never retype JSON the user pasted into chat. **The IDE is the ONLY source of the current script** —
  nothing is on disk. A user copy overwrites the clipboard, so a patch script that reads the clipboard
  while it holds something else dies with `SyntaxError: JSON Parse error` — copy in the IDE first, then
  run the patch. A copy can also be recovered from a session transcript
  (`~/.claude/projects/<project>/<session>.jsonl`, the user message containing `"copiedType"`).

### Hats and paste order

- **Pasting a method hat NEVER works** `[C]`: a fragment whose `startBlockIds` point at a `BlockFixMethod`
  is silently not pasted, even onto an empty canvas. The `Выйти из метода` block pastes fine inside a body.
- A **process** script WITH its `BlockFixEntryPoint` hat DOES paste. `[C]`
- **An entry point in the clipboard blocks method pastes** `[C]`. So: paste every method first, copy the
  process script LAST, and copy nothing afterwards.

### Protocol

- **New method**: the user creates it by hand (name, params, return type) and copies the empty method out;
  the agent reads the clipboard, feeds the real param ids into the generator, regenerates.
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
  never by id. `[C]` on a 149-block / 337-expression process.
- **Patch the live copy, never a stored older file**: manual IDE edits exist only in the live copy. For the
  same reason **never re-paste a full script "just in case"** — it silently reverts every IDE edit made
  after the dump.
- **Clone from live**: when a verified subtree exists, clone it (remap ids and `varBlockId`, edit only
  `varName`/`actId`) instead of building from constructors. GC unowned expressions and walk removed
  subtrees so no orphans remain.
- **Never re-derive JSON primitives from memory** — that caused an "always 0" bug. Grep session
  transcripts, unescape `\"`, copy real `CONST` / `argExprIds` / `branches`.
- User preferences: ONE request at a time (ask, wait for the copy, take the ids, ask again — no
  checklists); deliver WHOLE scripts/bodies, never fragments to splice by hand.

### Tooling that already exists

These live in a PROJECT repository, not beside this document — ask the user whether that folder is at
hand before you write a checker from scratch: a hat-stripper (drop the method hat, re-point
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
  generator: one body copy LACKED the defaults (521 diffs), a whole process copy ADDED them (554 KB vs
  297 KB, ~1900 phantom lines).
- **CRITICAL — parameter types are lost on a body paste.** The body has no parameter declaration, so the
  IDE assumes the parameter is a number. Real damage: `Пусть #остаток# = <bare param ref>` created a
  NUMERIC variable and **all 18 string assignments into it were silently dropped** (55 expressions lost,
  926 vs 981, no error shown). **Fix (verified): initialise a text variable through a type-giving op —
  `'' Concat param` — as the first block, never a bare param ref.** Using the parameter as an argument of a
  String-typed actId is harmless; a variable typed by something else (e.g. an empty-string CONST) is
  unaffected. For a BO-typed parameter there is no such trick — pass the data another way.
- **Parameter carriers «Переменная №N»**: sometimes the IDE does not bind param refs in place but adds one
  `BlockNewVar` per referenced parameter at the top (`Переменная №N := <param>`) and rewires all uses to
  them. Frequent, not systematic, trigger unknown `[U]`. The №-numbering often runs crossed relative to the
  parameters — **crossed NAMES alone are cosmetic; only the initialiser-vs-use binding matters**. Wrong
  bindings did happen and changed results (`5-3` → `-2`, `4/2` → `0.5`; commutative ops were unaffected).
  Detection: match each carrier's initialiser **by parameter id** (stable) against how the body uses it,
  and always include non-commutative probes (`5-3`, `4/2`, `9^0.5`, `2<3`) in stand checklists — their
  absence once let a swap through. Fixes, both `[C]`: (a) correct the few initialisers at the top (correctly
  bound carriers are harmless); (b) delete the carriers and reconnect refs to the parameters — the next
  copy then has body + hat and no carriers.

### Validator phases — `translate-script` stops at the first failing phase `[C]`

Found by pasting a 750-block / 1848-expression scratch (every catalogue act once) into a hook. The server
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
   Confirmed `[C]` (every `RestRequest` property tested alone, as a write and as a read):

   | object | write-only | read-only | read + write |
   |---|---|---|---|
   | `RestRequest` | `sendingText`, `sendingXmlTag`, `sendingMultipartForm`, `sendingJsonDeck`, `sendingJsonArr`, `address`, `method` | `showHeaders` | `readTimeout`, `connectTimeout`, `writeTimeout`, `callTimeout`, `checkSslCertificate` |
   | `ElectronicTableBoTab` | `cellType` | | |

   So a REST call is written `запрос.адрес = …`, `запрос.Метод вызова = GET`, `запрос.отправляемый … = …`,
   then `#ответ# = запрос.#вызвать`; the request's own address/body cannot be read back. Properties of the
   other objects were only READ in the scratch (all compile); whether they are writable is untested `[U]`.
4. **Java compilation** — the script is translated to `Main.java` and compiled (`compile:compiler.err.*`,
   `sourceMessage` carries the Java line; the `exprId` sits at the TOP level of the diagnostic, not in
   `messageArgs`). **Defect** `[C]`: the catalogue offers `saveBoiChanges` / `updateOpenedBoi` /
   `closeOpenedBoi` (`-K-FIX-T-BoiRefCode`) also on a BO type (`BoRefCode`), a field (`BoiFieldRefCode`)
   and a progress step (`ProgressStepRefCode`); phases 1-3 accept them, the compiler rejects them
   («BoRefCode cannot be converted to BoiRefCode»). Use them only on a record.
   Two `INFO` diagnostics `compile:compiler.note.unchecked.*` («uses unchecked or unsafe operations») come
   with a success and mean nothing.
Undo between attempts: `v2/script/undo {scriptModuleId, scriptId}` reverts the whole paste (one command).

After cutting everything these phases reported, **the rest of the scratch — 711 blocks / 1723 expressions,
454 of the 476 catalogue acts — translates with `{"success":true}`** `[C]`. The 22 acts that
were cut: the 13 `RestRequest` properties (the scratch READ them; 7 are write-only, the other 6 were cut
wholesale and are fine — phase 3's table), `ElectronicTableBoTab.cellType` (write-only), `getPrintForms` (phase 1),
`SHOWN_BO_IN_CO_FIELD`, `addFile_v2`, `sendToUsers` and the four `associateSingle*Ref*` (phase 2 — they
need arguments of a kind this probe BO does not have, not a platform defect). Compiling is not running:
nothing of this was executed on a record.

### Verifying a pasted script

- **"The IDE showed no red" is NOT a check** — it silently ate 55 expressions. Always copy back and compare
  structurally. **Structural equality is not runtime proof either**: a simulator and an identical live copy
  both missed a stand-only defect (§15) — a stand run is a separate step.
- **Counters first**: blocks / expressions / direct param refs of the copy vs body + hat (+ carriers).
  Catches carriers and lost expressions in seconds.
- **Scope sanity check before pasting**: on a stripped body the scope checker must report "variable out of
  scope" for EXACTLY the method's parameter ids and nothing else.
- **Canonical compare** — use the third form, the first two are superseded:
  1. renumber ids in visit order and diff — proven on a 684/1726 process with 0 structural differences, but
     it breaks on ANY structural difference (+2 tail blocks → 657 false lines);
  2. **id-free line pseudocode**: walk from `startBlockIds`, render expressions recursively, resolve
     VAR_REF → `varName`, map `CONST(String,'')`/`None` → `EMPTY`, drop the METHOD header and the defaults
     above, then `diff`. Proven on 152 lines verbatim with one real difference found. For methods with
     parameters: detect carriers on both sides, inline/skip them, try every permutation of parameter roles,
     **match roles by the parameter's ORDER in the signature, never by name**, and READ the per-parameter
     result rather than the "body matches" verdict.
- **Run the test suite against the read-back copy** (swap the live file in for the generated one) — that
  proves behavioural identity; keep the `pasted_<name>.json` copies as the authoritative snapshot. If the
  tests only hit error cases, a green run proves nothing — add a discriminating case.
- A copy proven identical while the stand still behaves the old way → suspect the method was not
  saved/published, or that a different method is called — not the code `[I]`.
- **Checker hygiene**: take every path from argv. A verifier with hard-coded paths once "compared" a file
  with itself and passed.

## 15. Runtime semantics of the built-in actions

### When each hook runs `[C]` (`<stand>`, two probe BOs — one wired by archive, one by API)

Every script wrote a timestamped marker; the record was then driven through the UI and through the
form API (`MYBPM-UI-API.md` §6b), and read back from the database.

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
  + `save-boi-value` + `apply-and-remove-draft`, `MYBPM-UI-API.md` §6a) and an xlsx import run none `[C]`
  for the API, `[I]` for xlsx.
- A **test** script version runs only on test records (`boiState DEV`, the «Тестовые» tab); ordinary
  records run the **work** version. A BO whose only version is a test one runs nothing on ordinary records.
- Field scripts were seen firing on 24 of the 27 types; `FILE_UPLOAD`, `CHECKLIST` and `CO` are `[U]`
  (`MYBPM-UI-API.md` §12).

Most number/string readings were taken THROUGH a formula engine that delegates each operation to a built-in
block and renders results with `'' ⊕ число`; attributing a reading to the platform is an inferred mapping
unless marked otherwise.

### Numbers are Java `BigDecimal`

- **`Eq` is scale-sensitive, `Less`/`More` are not.** `[C]` `Eq` behaves as `BigDecimal.equals()`
  (`2.0` ≠ `2`), `Less`/`More` as `compareTo`. Readings: `2.0 = 2` false, `4/2 = 2` false, `4/2 <> 2` true,
  `4/2 >= 2` true, `1+1.0 = 2` false (`Plus` carries the operand scale), `0.1+0.2 = 0.3` true (same scale).
  A real defect this caused: a divisor guard `Eq 0` let `1 / (0.5 − 0.5)` (= `0.0`) through to native
  division.
  **Rule: never compare numbers with `Eq`.** Equality = «not `l < r` and not `l > r`»; a zero test = not
  less and not more than 0; `>=` = «if `l < r` then false else true», `<=` mirrored via `More`.
  (15/15 on the stand.) Any `Eq` guard inherits the defect: `x = 0` misses `0.0`, `y = intPart(y)` rejects
  `2.0`. An off-stand decimal simulator is scale-insensitive and can NEVER reproduce this — only the stand can.
- **Native division: scale 30** (30 digits after the point), **no exception** on non-terminating quotients
  (`1/3` → `0.333333333333333333333333333333`, `4/2` → `2.000000000000000000000000000000`). `[C]`
- `Div` keeps full precision; what a number FIELD shows is the field's display format (`1/3*1000000` →
  `333333.333`). `[C]`
- Multiplication is exact `[I]`; a negative integer power computed as `1 / pow_int` carries hundreds of
  digits until the division rounds to 30 dp (`1.015^(−240)` worked) `[C]`.
- **`#Округлять дробную часть: N` is `setScale(N)`**: `round(1/3, 2)` → `0.33`; rounding to 12 leaves scale
  12 (`3.000000000000`). `[C]`
- `#Взять целую часть` truncates **toward zero** and normalises the scale (`int(9/2)` → `4`); negative
  inputs were never verified `[U]`.
- **Division by zero: platform behaviour unverified** `[U]` — guard divisors with Less/More.
- Native number actions have no error channel; a blow-up on huge arguments was only ever seen in an off-stand
  simulator — the IDE aborting the calculation is `[I]`.
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
- **`#Подстрока` with `start >= end` does NOT return `""` — it returns the WHOLE string.** `[C]` (Proven by
  reproducing every stand value: `5+5→105`, `1+1→21`, `12+3→153`, `2*3→63`, `(1+2)*3→963`, `2^10→10240`;
  four other candidate semantics reproduced none.) Chopping a tail with `#Подстрока(хвост, 1, #Длина)`
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
  `[C]` (measured with Java 17 and on the stand.)
- Word-shape test that works: `^[A-Za-zА-Яа-яЁё_].*$`. A 21-alternative group worked in a pasted process.
- The `regExp` argument accepts a VARIABLE `[C]`; a method cannot be called inside a regex.

### Booleans and checkboxes

- **Gate defect** `[C]` on stand: `BlockIf (Eq #формула?#, CONST Boolean 'no') → BlockExit FROM_METHOD`
  NEVER fired although the called method returned false (both the simulator and the live copy were
  correct). The suspects were not separated: `Eq` between Bool operands, or an early `FROM_METHOD` exit
  from an IF branch.
  **Rule: test a boolean as `ЕСЛИ #переменная#` (`ifExprId` = VAR_REF, else branch `exprId:null`); keep
  ONE method exit; `FROM_CIRCLE` inside loops is fine.**
- `Or` (and `Not`, `Xor`) compile (§12a) but were never run on a record `[U]` — write disjunction as nested IFs.
- A checkbox's value act is accepted as a bare IF condition and a dependent stand check passed `[I]`; its
  runtime type and its text form when concatenated (`yes`/`Да`/`1`/empty) were never measured `[U]`.
  Fallback: compare against `{constType:"Boolean", value:"yes"}`.

### Control flow and program structure — hard limits

- **`ИНАЧЕ ЕСЛИ` executes exactly ONE branch** of the chain; "try each candidate until one matches" must be
  written as independent sequential `ЕСЛИ` blocks.
- **No while-loop** — counted loop and foreach only; a counted loop with a pass cap guards
  recursion/fixed points (a 50-pass cap answered fast). Whether the bound is re-evaluated each iteration is
  unknown `[U]` — bind it to an immutable value.
- **No arrays** (hence no stack). **No dynamic dispatch**: a method cannot be called by a name taken from
  data `[C]`, a dictionary field cannot hold a script — one explicit branch per operation.
- **No iteration over the fields of an instance, nor over BO codes**: each field read is a compiled
  `ExprAct` with its own actId, so a name → field mapping is written out (one IF per field) and a field
  newly added to a BO is invisible to such code until the code is extended.
- **`findByFilter` reads a dictionary row at runtime** `[C]` (`Parameter` row `code`=`MRP`, `label`=4325 →
  formula result 4326); matching by `code` is case-sensitive.

### Idioms

- **Bounded while**: `ЦИКЛ #i# : "200"` + `Выйти из цикла` on the exit condition. `[C]`
- **Bool as condition**: a Bool variable (or a Bool-returning act such as `isEmpty`,
  `doesItMatchARegularExpression`) directly as `ifExprId`, no `= Да`; its complement is a bare «Иначе», not
  `Eq(x, Нет)` — preferred because of the gate defect.
- A Number 0/1 flag where an "is it set" test is needed inside an elif chain.
- **Substring guard**: `ЕСЛИ конец > начало : target = #Подстрока(src, i, j) ИНАЧЕ : target = ""`.
- `'' Concat <параметр>` as the first block of a body to pin a String type (§14).

## 16. Business-process scripts

- A process script starts with `BlockFixEntryPoint` (the «ТОЧКА ВХОДА» hat). Unlike method hats it pastes
  together with its hat, and it must be the LAST fragment put into the clipboard. `[C]`
- The process record's own fields are reached through `THIS_PROCESS` (IDE: `ЭТОТ_ПРОЦЕСС`), an
  `exprValueType: ExprValue` with `constType:"BoiRefCode"`: `THIS_PROCESS.F-step`, `.F-error_code`,
  `.F-request`, … each via `F-<field>-K-DYN-S-boi_fields`.
- A process script can create a new BO instance and fill its fields (observed in real copies).
- **Failure path**: set an error-code reference (`~Код ошибки~.#Значение = <BoiRefCode>`), then `BlockExit`
  with `exitType: "FROM_METHOD_BY_ARROW"` and the `targetArrowId` of the error arrow.
- A process JSON round-trips paste → copy with only the entry block's x/y changing. `[C]`
- **How a figure's script leaves it** `[C]` (`<stand>`, written headlessly and read back in
  the IDE): a **Script** figure (one outgoing arrow) ends in `{"exitType":"FROM_METHOD","type":"BlockExit"}`
  («Выйти из скрипта»); a **Switch** figure (several NAMED outgoing arrows) ends every path in
  `{"exitType":"FROM_METHOD_BY_ARROW","targetArrowId":"<one of ITS OWN arrows>","type":"BlockExit"}`
  («Выйти из скрипта по стрелке: <name>»). The IDE offers exactly that split — a Switch has no plain exit,
  a Script no exit by arrow. **The validators do not enforce it**: the swapped forms and an arrow of
  another figure pass `translate-script` and `validate-def`; only a missing `targetArrowId` fails
  («Не указан targetArrowId»). Write only what the IDE would offer. The arrow ids of a figure:
  `MYBPM-UI-API.md` §5f `load-exit-variants`; in an archive they are the `arrows` keys of the
  `BoProcessVersionsStructDto` whose `startFigureId` is that Switch.
- **A Switch with a condition** `[C]` (`<stand>`, written headlessly and RUN both ways on
  test records): the process field «Заявка» (`Zayavka`, a BO reference) points at a record with a CHECKBOX
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
  стрелке: Нет`. Three things this proves: a field of the REFERENCED record is reached by applying its
  `F-<code>-K-DYN-S-boi_fields` straight to the reference field (no `#Значение` hop in between, as §12a
  says for a single link); the boolean is tested bare (trap 22); the `ЕСЛИ` has no `downBlockId`, because
  both of its branches are exits. Run: «Одобрить» = Да → Exit «Да», = Нет → Exit «Нет», both with
  `scriptRunSuccess: true` — the condition is evaluated, not ignored. The value read is the one saved at
  the moment the Switch runs (here: the Заявка save that released the Form).
- **Arrow slot names differ per figure** `[C]` (client bundle): Enter/Exit `main`/`top`/`bottom`; Switch
  `up`/`right`/`down`/`left`; Script and Timer `left`/`right`/`top`/`bottom` + the four corners
  (`topLeft`…); Form = Script's without `bottom` plus `timerCreate`/`timerOpenForm`/`timerTouchDraft`;
  Terminator `left`/`right`/`top`/`bottom`; SingleToParallel `in` + `out1…N`, ParallelToSingle `out` +
  `in1…N`. A wrong name on a Switch falls back to `up`, on a Script/Terminator to `top`, on a Form/Timer to
  nothing — use the real names (full table: `MYBPM-UI-API.md` §5f «Slots»).
- **How a process runs** `[C]` (`<stand>`, a probe built in the constructor, run on test
  records): it **starts when a record is first SAVED** (not when the form opens); Enter passes at once;
  a **Form** step stands (status «В ожидании») **until the record held in the Form's BO field is saved**,
  then the process runs on through Script / Switch to the Exit, and the status becomes «Завершён».
  **The Form binds to the record that is in the field WHEN THE STEP BEGINS.** A field filled later is never
  watched, and the step stays stuck. So the design rule is: fill a Form's field before the process gets
  there, either in the record's first save or in a Script placed before the Form. **The save that
  releases a Form must CHANGE a value** of that record `[C]` — opening and saving it
  unchanged (or re-sending the stored value) leaves the step standing. The start is asynchronous: the
  steps can still be empty right after the first save. A test version runs only
  on test records, and their reference fields list only test records `[I]`. The run-time API and the
  manual unstick («Продолжить принудительно» = `push-step-forcibly` on the stuck step's OUTGOING arrow):
  `MYBPM-UI-API.md` §5f «Running a process on a record».
- **A Timer** `[C]` (`<stand>`, probe «Проба БП таймер», Enter → Script → Timer →
  Exit, six runs). The figure watches ONE date field of the process (`FULL_DATE`; the editor stores
  `fieldId`, the archive `archetype:"DYNAMIC", fieldCode`, §5c). When the process ENTERS the Timer it reads
  that field once: a future date → the step stands until then; an EMPTY field or a date in the PAST → it
  passes at once. It fires 10–40 s after the due time (a scheduler tick): the step goes `STAND` →
  `WAITING` (due, not yet fired) → `PASSED`. **Changing the field on the record while the Timer stands
  does NOT move it** — a save setting it into the past left the step standing until the ORIGINAL due time.
  Setting the date in a Script right before the Timer is the pattern:
  `ЭТОТ_ПРОЦЕСС.Пауза.#Значение = Сейчас.увеличить(1, минуты)` →

  ```
  {"<assign>":{"leftExprId":"<Пауза.#Значение>","rightExprId":"<inc>","downBlockId":"<exit>","type":"BlockAssign"}}
  "<now>":  {"exprValueType":"CONST","constType":"JavaObjectFactories","objectDescriptor":"BEAN_METHOD-DateExtensions-now",
             "valueType":{"type":"Object","baseType":"Date"},"type":"ExprValue"}
  "<inc>":  {"leftExprId":"<now>","actId":"F-incDate-K-FIX-T-Date","argExprIds":{"amount":"<1>","unit":"<MINUTES>"},"type":"ExprAct"}
  ```

  (`amount` a `BigDecimal` constant, `unit` a `DateDeltaUnit` enum constant — shapes in §12.) **`#Обновить
  таймер для процесса` is NOT needed before a Timer** — the run above fired without it, contrary to an
  older library's rule «every script before a Timer must call it». What it is for, per the platform's own
  description: after changing the date of a Timer that is ALREADY standing, call it on that field to
  move the schedule — `[C]` (see «An Exit inside one branch» below: a parallel branch set the
  standing Timer's field from now + 6 min to now + 1 min and called it → the Timer fired at ~2.5 min; the
  control run with the same assignment WITHOUT the call fired at the ORIGINAL ~6 min). A script's
  assignment alone does not move a standing Timer, exactly like a save from the form. Calling it right
  before the Timer is harmless (fired on time).
- **Parallel branches** `[C]` (`<stand>`, probe «Проба БП параллель», built through
  the API from `tools/process-parallel.spec.json`: Enter → SingleToParallel → (A: Script sets Пауза = now
  + 1 min → Timer(Пауза) → Script A2) ‖ (B: Script B) → ParallelToSingle → Exit; one DEV run). A
  **SingleToParallel** (`outSlotsCount: N`, exits `out1…outN`) starts EVERY branch at once — both first
  Scripts passed in the same second. A **ParallelToSingle** (`inSlotsCount: N`, entries `in1…inN`, exit
  `out`) is a real join: its step appears as `STAND` as soon as the first branch reaches it and passes only
  when the LAST one arrives — here B was done at 6 s and the join stood until A's Timer fired (~70 s), then
  A2, the join and the Exit passed together. One step per figure, all `PASSED`; a Timer in one branch does
  not hold the others. In the archive they are `FigureSingleToParallelStruct {outSlotsCount}` /
  `FigureParallelToSingleStruct {inSlotsCount}` (§5c) `[C]`.
- **A Terminator ends the WHOLE process, not just its branch** `[C]` (`<stand>`, API probe
  «Проба БП терминатор-2» from `tools/process-terminator2.spec.json` on a DEV record, and the
  same spec through an ARCHIVE — «Проба БП терминатор архив» — on an ordinary record): Enter →
  SingleToParallel → (A: Script sets Пауза = now + 3 min → Timer(Пауза) → Script A2 → Exit) ‖ (B: Script
  sets Пауза B = now + 1 min → Timer(Пауза B) → Terminator). Branch A stood on its Timer while B's Timer
  fired (~65–100 s); the moment B passed the Terminator, **A's standing Timer turned `PASSED` with no next
  step** — A2 and the Exit never ran, not even after A's due time. `load-process-steps` shows nothing
  special: the cut Timer is just `PASSED`, `nextProcessSteps: []`, no diagnostic message. (The
  record's `PROCESS_STATUS` after it is NOT readable this way — `load-boi-values` answers `""` for any
  reference field of a process record, a record ended by an Exit included.) Use it for «stop everything»
  (e.g. a cancel branch); an Exit ends only ITS branch (next point). A first variant with an instant B (`tools/process-terminator.spec.json`:
  Script → Terminator, no Timer) did the same — A's Timer, entered 30 ms after the Terminator, was closed
  at once.
- **An Exit inside one branch ends only that branch** `[C]` (`<stand>`, API probe «Проба БП
  выход в ветке» from `tools/process-exit-branch.spec.json`, two DEV runs): Enter →
  SingleToParallel → (A: Script sets Пауза = now + 6 min → Timer(Пауза) → Script A2 → Exit A) ‖ (B: Script
  sets Пауза B = now + 1 min → Timer(Пауза B) → Script B2 → Exit B). A process may have SEVERAL Exits —
  `validate-def` is clean with two, no join needed. When B passed Exit B (~80–100 s), A's Timer went on
  STANDING; later A2 and Exit A passed as well — so, unlike a Terminator, an Exit closes only the branch
  that reached it, and the other branches run to their own end. B2 was also the reschedule test of «A
  Timer» above: run 1 (B2 = Пауза := now + 1 min + `#Обновить таймер для процесса`) → A's Timer
  `WAITING` at 140 s, `PASSED` at 160 s; run 2 (the same B2 without the call) → A's Timer fired at 377 s,
  the original due time.
- **A Point is a bend on an arrow, nothing more** `[C]` (same probe, API and archive): the
  editor makes it with «Вставить точку» in an arrow's context menu, which CUTS the arrow in two — the old
  arrow now ends at the Point, a new one leads from the Point to the old target. At run time it is a step
  of its own that passes in the same instant (`PASSED`, one prev and one next step, no script, no
  delay): the figure behind it runs as if the arrow were whole. Use it only to route arrows on the
  diagram. Shapes: §5c (archive), `MYBPM-UI-API.md` §5f «Point» (editor).
- **The same three facts through an ARCHIVE** `[C]`: `tools/process-exit-branch.spec.json`
  (with the Point) → `make-probe-archive.bun.ts --process-spec … --process-status …` → import into the
  group «Тест» → one ORDINARY record: Exit B at 68 s with A's Timer still standing, A's Timer
  rescheduled by `#Обновить таймер для процесса` and fired by 149 s (not at 6 min), then A2 → Point →
  Exit A. The act id `F-updateTrapDate-K-FIX-T-BoiFieldRefCode` is FIX, so it travels as is.
- **A configured process from a spec, headlessly** `[C]`: `tools/process-builder.ts` builds
  fields + figures + named arrows + Script/Switch bodies (the JSON above, generated) through the
  constructor API and runs both Switch branches on test records; it passed at the first try. This is the
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
  process on a real record. A mixed checklist gives a false "works" — this was learned after misreading
  card results as process results. Also: a card that composes a pipeline by hand (`f(g(x))`) can pass on
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
9. Built-in codes `Person` / `Department` / `PersonGroup` are reserved; a clash fails the whole import.
10. The form grid compacts vertically — holes are eaten and rows drift.
11. A STATIC_TEXT section heading must not repeat a field name (breaks Excel import).
12. `required + readonly` together makes a record unsavable.

Scripts:
13. `wl-copy` without `--type text/plain` → the paste is silently ignored; a script ending in `wl-copy`
    hangs its caller.
14. A method hat never pastes; an entry point in the clipboard blocks method pastes.
15. A body paste types every parameter as a number — string parameters need `'' Concat param` first, or
    assignments vanish without an error.
16. Parameter carriers «Переменная №N» can bind arguments to the wrong roles; only non-commutative probes
    catch it.
17. The IDE regenerates every id — diff structurally (id-free pseudocode), never by key.
18. "No red in the IDE" proves nothing; structural equality proves nothing about runtime.
19. Never compare numbers with `Eq` (scale-sensitive); `0/100` prints as `0E-30`.
20. `#Подстрока` with `start >= end` returns the whole string.
21. `#Заменить` is literal, not regex; a broken regex silently returns `Нет`; never backslash a letter.
22. Test a boolean as a bare condition, never `Eq <Boolean>` (gate defect), and keep one method exit.
23. Expressions must be a strict TREE, never a DAG (each expression referenced exactly once — the IDE warns
    «…операнд номер 1, который уже ранее использовался»), and a variable name is unique across the whole
    METHOD, foreach element names included.
24. Never re-paste a whole script "just in case" — it reverts every IDE edit made since the dump.
25. Never assume a primitive is missing — ask for a palette screenshot; `#В число` and `#Заменить` were
    both "missing" and both exist. Never guess an actId — have the user build the block and copy the JSON
    (`op_type`, `step_order`, `Multiply`, `Divide` were all wrong guesses). The palette
    need not be guessed at all: §12a is the complete catalogue, read off the stand.
26. **An enum value the server does not know bricks the BO** `[C]` (a probe BO on `<stand>`).
    A script def is stored as sent — `apply-update-cmd` (and, by the same storage, an archive) wrote
    `"opType":"GreaterEq"` without complaint. From then on the server cannot decode the BO's script
    module: `translate-script`, `load-script-def`, `load-bo-scripts` of EVERY version (work included),
    `load-bo-script-versions`, `apply-update-cmd`, `undo`, `delete-local-method` and
    `remove-bo-script-version` all answer `IllegalArgumentException: No enum constant …OpType.GreaterEq`
    — so the bad value cannot be overwritten either. Other BOs' scripts keep working, but the company-wide
    code-usage analysis now fails, so the «Изменение кода» dialog of EVERY BO and field is dead
    (`MYBPM-UI-API.md` trap 59). No API repair was found — deleting the BO leaves its script module behind,
    still broken, and `save-bo-scripts` does not reach the bad def; it needs the vendor (database). Hence: every enum-typed key (`opType`, `exitType`, `exprValueType`,
    `constType`, block/expression `type`, `varType`) takes ONLY a value listed in §10–§12a — a
    string-typed key (`actId`, `enumValue`, `varName`) is safe to get wrong, the validator reports it.
    **A wrong SHAPE is the same trap** `[I]` (reported from another stand, not reproduced on purpose — it is
    unrepairable): `ExprCall.args` written as `{"<paramId>":"<exprId>"}` (a string) instead of
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
    its kanban and the constructor's kanban editor once it holds a record. Ship a template per dropdown (0.5c);
    a re-import with one repairs the BO.
33. **The registry «Группировка» is dead** `[C]` — the server answers 404 to its data calls;
    `isGroupingEnabled` / `groupingInfo` store and travel but nothing renders (§2 «BO views»).
34. **An import of «Выставление сервисов» replaces the whole list; its rollback leaves dead rows** `[C]`
    — §2 «Exposed services».
35. **A BO's first, implicit script version is blind when scripts are written through the API** `[C]` —
    on a BO that never had scripts the one version `load-bo-script-versions` returns has an empty
    `load-bo-def-list`, so every field act fails `translate-script` and the hook cannot be published. Copy the
    version (`copy-bo-script-version`) and write into the copy (`MYBPM-UI-API.md` §5o, trap 68). A BO whose scripts
    came in by archive is not affected.
36. **A service file answer needs a file name with a known extension** `[C]` — `x.xyz` or a bare `x`
    fails with `NoFileMimeType` inside the «Создание» script and the service answers 500; with a known extension
    the response Content-Type is taken from it, not from RESULT_CONTENT_TYPE (§2 «Exposed services»,
    `MYBPM-UI-API.md` §5o, trap 69).
37. **A company-settings import replaces some kinds, merges others and only half-overwrites AUDIT_TRAIL** `[C]`
    — OFFLINE / MOBILE / LANGUAGES / SCRIPT_SETTINGS replace (a language left out of the map is switched
    off), PHYSICAL_REMOVAL upserts and never removes, AUDIT_TRAIL overwrites the FIRST audit row whatever its journal,
    MESSENGER does nothing without a connected messenger. Ship a kind only from a fresh export of the target stand
    (§2 «The other company-settings kinds»).

Records (Excel): the traps of that format live in `MYBPM-UI-API.md` §11 (8 — numeric cells, 9 — header
detection, 10 — never index columns by position, 13 — the SINGLE-side link column) and are not renumbered
here; the rules themselves are §0X.4.

## 18. Open questions

- SIGNATURE: why an import drops `massPrintFormCodes`, and which «same signature type» a
  referenced BO needs for mass signing. The rest of the widget is answered in §0.5b «SIGNATURE round-trips».
- BO groups: what the importer really does with `BoGroupStructDto` (see §8).
- Whether an archive WITHOUT `AccessStructDto` leaves stand rights untouched.
- Whether `fromFields[f]` really opens a record to the person named in that field; fallbacks
  `authorsField.fieldCodes` / `participants` + `needAddToParticipants` are unconfirmed.
- How to express an M:N (TABLE↔TABLE) link.
- Whether import applies `hideLabel` and the real ceiling of `gridLayoutPosition.h`.
- The runtime of `Or` / `Xor` / `Not` / `LessEq` / `MoreEq` / `OrEq` / `AndNotEq` (they compile, §12a).
- Whether a field script fires on `FILE_UPLOAD`, `CHECKLIST` and `CO` (the other 24 types do, §15), and
  whether an xlsx record import runs any hook.
- The storage format of a `Date` constant, and which output each swapped `DatePattern` label really gives.
- The checkbox value's runtime type and its text form when concatenated.
- Whether a counted loop re-evaluates its bound, and the counter's base.
- Whether a method argument can carry a LIST of instances.

---

# Part III — Records (instances) as Excel

Records never travel in a structure archive: a `.mybpm.zip` carries the SHAPE of a business object, an
xlsx carries its ROWS. The transport — the registry kebab «импорт/экспорт xlsx» and the `v2/bo-transfer`
routes — is in `MYBPM-UI-API.md` §6 and §0U R7; **this part is the file itself**.

## 0X. COOKBOOK — produce an importable xlsx from this section alone

**Read this part if your job is «fill me a file that loads these records into BO X».** Like §0 and §0S it
is self-contained for the FORMAT; unlike them it cannot start from a blank page — the file is always a
FILLED-IN TEMPLATE taken off the stand, never a sheet you compose. That is the first thing to ask for.

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
1. **Take a FRESH template** — an export of the registry (registry kebab → «импорт/экспорт xlsx»), or
   `GET <stand>/web/v2/bo-transfer/download-template?businessObjectId=<boId>&selectedFieldIds=<…>`
   (a plain GET with the `token` header, no envelope, `selectedFieldIds` comma-separated → the header rows
   only, no data rows, no table part `[C]`; more in `MYBPM-UI-API.md` §6).
   Columns follow the BO at export time and their positions move between exports.
2. **Build the column map by LABELS, never by position**: the (row-1 block, row-2 field) pair identifies a
   column. Split a row-1 label on the FIRST dot — the prefix is the tab («Системные.Код»).
3. **Fill the rows.** Values: checkbox `Да`/`Нет`; date `dd.mm.yyyy`; date-time `25.10.2025 10:33`; period
   `dd.mm.yyyy - dd.mm.yyyy`; a dropdown is matched by its LABEL; a reference by the target's unique field
   or by an `ID` sub-column. A TABLE nested object = the parent row REPEATED per child. A nested block
   only LINKS: its other sub-columns are never written into the child (19.6) — to change a child, import
   the child's own file.
4. **Order the files** when there is more than one: users → groups → dictionaries → records → link files.
   A reference resolves only against records that were on the stand BEFORE the file — never against rows
   of the same file.
5. **Read the finished xlsx BACK** and rebuild the data model from its cells (labels → codes). This step
   has caught every error before the stand did.
6. Deliver as in 0X.6 — and remember the import is TWO-PHASE: the upload only builds an act.

### 0X.3 Stand data — ASK for it, never invent it

The same contract as §0.2a, with a heavier list, because a record file is mostly stand state:

| Ask for | Why guessing fails | Fallback if the user declines |
|---|---|---|
| **The template or a registry export of the target BO** (the file, not its description) | column layout, merges, freeze rows, styles and the table part all come from it; a hand-composed sheet is rejected at the header | none — stop and ask again. This one has no fallback |
| The BO's **unique field** (or whether the export carries an `ID` column) | no unique field and no `ID` → every import CREATES, so a re-run duplicates instead of updating | say plainly that the file will be create-only and ask for confirmation before shipping it |
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
6. A sub-column that is itself a nested reference must be omitted (`BoFieldNotSpecified`; the 2-level
   header for it is `[U]`).
7. **A blank cell is an ERASE, a missing column is a KEEP** (19.6 `[C]`): on an update, every cell left empty
   clears that field (DATE excepted); a field whose column is absent from the file is left as it was. To
   update only some fields, DELETE the other columns — never blank them.
8. Dictionary codes are case-sensitive (`MRP` ≠ `mrp`).
9. **No holes in the cell addresses**: when you remove columns, re-letter the rest contiguously (A, B, C…)
   in the header AND every data row, and fix `dimension`. A sheet whose header skipped letters misread the
   column after the hole — a filled checkbox came out «Нет» `[C]`.
10. **A nested block links, it never edits and never unlinks** (19.6 `[C]`): only the sub-column holding
    the target's unique field (or `ID`) matters — the other sub-columns are ignored, the child keeps all its
    fields. On an update a filled SINGLE block REPLACES the link, a TABLE block ADDS its children to the
    ones already linked (never removes), and an EMPTY block keeps whatever link was there. To drop a child
    from a collection, use the record card or the API, not a file.

### 0X.5 Self-check before shipping

- [ ] The file opens and every data cell is `inlineStr` (grep the sheet xml for `t="n"` — none).
- [ ] The header rows match the template byte-for-byte; merges and freeze survived the edit.
- [ ] Column map rebuilt FROM THE FINISHED FILE, not from the plan, and it matches the data model.
- [ ] No SINGLE-side link column; no `STATIC_TEXT` hint column (drop those by field TYPE, 19.2).
- [ ] Every dropdown value exists in its dictionary; every reference value exists on the stand.
- [ ] Row count equals what you promised, and the file order is written down for the operator.
- [ ] On an update file: no empty cell in a kept column unless erasing it is the intent; cell addresses
      contiguous (no skipped column letters) in every row.

### 0X.6 Delivering

UI: registry kebab → «импорт/экспорт xlsx». API: `v2/bo-transfer` (`MYBPM-UI-API.md` §6 and §0U R7) —
template, upload, act, apply and export `[C]`. Either way the upload
only builds an **act**: read «создано / обновлено / ошибки» and apply the second step deliberately, and
pull `download-errors` when rows fail — it names the row numbers.

## 19. The Excel format — evidence

### 19.1 Sheet format `[C]` unless noted

- Sheet `Sheet0`. **Every cell is `t="inlineStr"`**, `sharedStrings.xml` is empty, numbers are TEXT.
  **Write numbers as text**: a numeric cell `103` became «103.0» and broke a unique-field lookup.
- Row 1 = the field label, prefixed `«<Вкладка>.»` when the field sits on a tab («Системные.Код»). Headers
  change when tabs change. Split on the FIRST dot; the rest equals `dynamicFields[].label.rus` **after
  strip** (labels can carry leading spaces) — 52 codes mapped with zero unmapped.
- A nested BO spans several columns: row 1 = a merged block caption, row 2 = sub-headers = the referenced
  BO's `fieldRefs` with `toShow` (sub-headers carry the target's own tab prefix, e.g. «Цель.Формулировка»;
  Person: Фамилия, Имя, Email). Other columns are merged A1:A2. A dropdown is one cell. Freeze at A3.
  A sheet without nested blocks has ONE header row and data from row 2.
- **Header detection**: by FROZEN ROWS, else by a DOUBLE bottom border in column A
  (`ExcelSheetBridge.headerLineCount`, class
  `kz.greetgo.mybpm.reg.boi_transfer.model.import1.excel.ExcelSheetBridge`). A plain sheet with neither
  fails with `kD4QsxZrAY` «Система не может отделить строки заголовка от строк данных».
- **A TABLE nested object = the parent repeated on several rows**, one row per child (11 parents → 17
  rows). Writing the parent's scalars on EVERY row is safe.
- Values: checkboxes `Да`/`Нет`; date-time `25.10.2025 10:33`; dates `dd.mm.yyyy`; periods
  `dd.mm.yyyy - dd.mm.yyyy`; dictionary registry columns «Значение», «Код».
- Styles in stand files: nested sheet `s="7"`, last column `s="8"`; flat sheet `s="3"`, last `s="4"`; data
  rows carry thin left/bottom borders. The xlsx also carries an Excel table part `xl/tables/table1.xml`.

### 19.2 Columns missing from / leaking into an export

- **STATIC_TEXT («Текст») fields can leak in as columns** with their plain text repeated in every row.
  28 of 29 did not appear (the user had hidden them); `tableColOrderIndex: 0` is NOT the switch; the real
  switch is unidentified (candidate `tableColToShow` `[U]`). **Drop such hint columns by field TYPE
  (STATIC_TEXT) read from the archive, never by a label pattern.**
- One real field was absent from an export (same value «Всегда» in every row); the explanation «omitted
  because all values are identical» is `[U]`.

### 19.3 Resolution rules

- **Dropdown cells are matched by LABEL, not by code** `[C]` (`NotFoundDictByLabel` «Не найден элемент
  справочника … label = …»). The dictionary values must already exist on the stand.
- **References resolve by the TARGET BO's UNIQUE field** (flag `isUnique`; dictionaries: `code`; Person:
  Email) through the sub-column holding it, **or by an `ID` sub-column** `[C]`. `fieldRefs.toShow` decides
  which sub-columns a template has, and that set changes when the display config changes (one reference's
  sub-columns went `Наименование|Класс модели|Код результата` → `ID` → `Наименование` across three
  exports) — write what the sub-column expects and re-check it on every export.
- **A target without a unique field links only by `ID`** `[C]`: a parent file whose nested block had no
  `ID` sub-column created the parents but the block came back EMPTY. Do not expect matching by a
  non-unique code. Likewise a block whose unique sub-column is EMPTY and only a non-unique one is filled
  («Имя» = an existing child's exact name) creates the parent with no link and reports no error `[C]`.
- **A referenced record that does not exist → `NoUniqueFieldValue`**, that row fails and the rest of the
  file imports `[C]` (12 missing dictionary codes → 12 error rows). **A nested block does NOT create target
  records** in v4.24 — import the referenced BO first. (The 2022 jar did create them; ignore that for v4.24.)
- **A reference resolves only against records that were on the stand BEFORE the file was imported, not
  against rows of the same file** `[C]` → split self-references into a later file. **File ORDER matters**:
  users → groups → dictionaries → records → link files.
- A failed import yields a downloadable «Ошибки при загрузке …» xlsx: row numbers + error codes, roughly
  one error per row.
- `BoFieldNotSpecified` «Не указаны дочерние поля для поля … у бизнес объекта …» (the whole file is
  rejected while reading the header): a sub-column that is itself a nested reference must be expanded into
  its own child columns; the 2-level header format for that is unknown `[U]` — omit such sub-columns.
- `SameBoFieldsLabel` «Встретились одинаковые названия полей в одном бизнес-объекте… X: DROPDOWN_SINGLE vs
  STATIC_TEXT»: header labels are matched against ALL fields of the BO, including «Текст» section headings
  and regardless of tab. **Never name a section or field like another field.**
- Dictionary row codes are case-sensitive (`MRP` ≠ `mrp`).

### 19.4 Linked references (a SINGLE↔TABLE pair) — confirmed defect `[C]`

- **A row whose SINGLE side of a two-way link is filled is silently dropped**: the import reports success
  (e.g. 5 records) and the registry shows «0 из 0» — even with only the code sub-column present.
- Proven NOT to be our file or our structure: the platform's OWN registry export (link set by hand in the
  UI) does not re-import either, and the same happens on a pair of BOs linked by hand in the constructor.
- **Working route: set links from the TABLE side** — import a parent file whose table column lists the
  child codes; the existing child is found by its unique field and its SINGLE field gets filled `[C]`.
  Several children = the parent row repeated.
- Plain (non-linked) SINGLE refs and plain TABLE refs filled from the parent side import fine.
- **Safe practice: do not write columns for the SINGLE sides of links at all.**

### 19.5 Merge / idempotency

- **Match by the `ID` column → OVERRIDE, not duplicate** `[C]`: client-chosen ids
  (`base62(sha256(seed))[:16]`, A-Za-z0-9) were accepted and kept. An API export with `needBoiId:true` adds
  this column itself as the LAST one, headed «Внутренний айди» `[C]`; the UI export has none. Platform ids are 16 chars and their
  alphabet includes `~` and `@` (untested on import — stay in A-Za-z0-9). The id may be an ordinary column,
  e.g. «Системные.ID» (code `ID_`) — keep it in the file.
- **Match by the unique field → UPDATE** `[C]`: adding a unique text field «Код» to the built-in «Рабочая
  группа» made its import idempotent. **A BO with neither an ID column nor a unique field always CREATES.**
- Re-importing a full export with rows APPENDED kept the existing rows and added the new ones. `[C]`
- Built-in «Рабочая группа» registry format: «Имя» + nested «Руководитель» (Email/Фамилия/Имя) + table
  «Пользователи» (Email/Фамилия/Имя); merges A1:A2 / B1:D1 / E1:G1, freeze A3. **Group membership imports
  from the group side (the table).** Users import with the columns Фамилия, Имя, Email `[C]`; the Person
  labels of other fields (position, personGroup) are unknown `[U]`.

### 19.6 Destructive risks — all `[U]`, act defensively

- **A blank cell CLEARS the field on an existing record** `[C]`: an update matched by the ID column or by
  the unique field, with `INPUT_TEXT`, `INPUT_NUMBER`, `CHECKBOX`, `DROPDOWN_SINGLE` and `TEXTAREA` cells
  left empty, stored empty values (text → `""`, the rest → `null`, a checkbox reads «Нет»). It does not
  matter whether the cell is present with empty text (`<is><t></t></is>`) or absent from the row — both
  erase. The act does not warn: it reports the row as «обновлено», 0 errors. **`DATE` is the exception —
  an empty date cell left the stored date untouched** `[C]`.
- **A column MISSING from the file keeps the field** `[C]`: a file without the «Текст», «Число» and
  «Статус» columns updated the other fields and left those three as they were. So the safe way to update a
  few fields is a file with ONLY those columns (plus the key) — not a full file with blanks.
- **Holes in the cell addresses break reading** `[C]`: the same three columns deleted by dropping their
  cells but keeping the other cells' letters (header A, D, E, G, H) imported «успешно», yet the filled
  «Флаг» (D) came out «Нет» on every row; re-lettered contiguously (A–E), the same data imported right.
  Re-letter after removing columns.
- **A nested block never writes into the child** `[C]`: parents with a SINGLE and a TABLE block whose
  sub-columns were «Код» (the child's unique field) and «Имя», filled with a CHANGED name, linked the
  existing children and left them byte-identical — the new «Имя» was ignored, and the child's fields that
  had no sub-column («Заметка», a checkbox) kept their values. Same on create and on update of the parent,
  four imports in a row. The sub-column holding the unique field (or `ID`) is the lookup key; the rest are
  display only. (The 2022 jar's `saveImportInstance` that UPDATED the child does not apply to v4.24.)
- **An EMPTY nested block keeps the link** `[C]` — unlike a blank scalar cell: a parent updated with both
  blocks empty kept its TABLE child, and a blank SINGLE block kept its child too.
- **A filled block on an update** `[C]`: SINGLE → the link is REPLACED (C1 → C2); TABLE → the listed
  children are ADDED to those already linked, nothing is removed (a parent with {C1, C2} imported with only
  C2, then only C1, still had {C1, C2}). A file cannot unlink a child.
- Deleting child records and re-importing them loses the parent's collection binding (the user re-bound
  them by hand) `[I]`.
- Aggregate fields over a collection could be zeroed by importing collection rows without amounts `[I]`.
- A `DROPDOWN_SINGLE` with `optionSource: FROM_FIELD` and an EMPTY option list will reject any value `[I]`.
- Whether the importer writes into `isReadonly` fields is unknown — safe order: import data first, set
  readonly afterwards. Whether it accepts a sub-column for a field hidden in the reference
  (`toShow:false`) is unknown.
- Records have a `removeType` of their own (soft delete): deleted records may keep their codes.

### 19.7 Importer internals (decompiled 2022 jar — v4.24 may differ)

Package `kz.greetgo.mybpm.register.impl.reports.bo_list.import1` in `mybpm.register-<tenant>-0.0.20.jar`
(docker `mybpm-api`). Two phases: `uploadSheet` builds an "act" with a new/updated/error summary, and a
separate `applyAct` creates the instances through kafka in `parallel()`. A BO-ref cell's sub-values run
`saveImportInstance` on the referenced BO: found by the unique field → that instance is UPDATED with the
sub-column values; not found → a new one is created (**v4.24 does NOT create — see `NoUniqueFieldValue`
above**). Treat this jar as a hint about mechanisms only, never as a statement about v4.24.

### 19.8 Techniques that work `[C]`

- **Round-trip instead of guessing**: take a stand export, edit it, import it, export again and read back.
- Editing an export by rewriting only `xl/worksheets/sheet1.xml` (append rows before `</sheetData>`, update
  `dimension ref`) and re-zipping every other member byte-for-byte imports fine — also as a STORED
  (uncompressed) zip.
- Re-importing an unchanged export with its ID column is a no-op update (every row «обновлено», values
  unchanged) `[C]` — a cheap way to restore records after a destructive probe.
- **Before handing a file over, read the xlsx BACK and rebuild the data model from its cells** (labels →
  codes) — this caught every error before the stand did.
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

- Which flag actually controls whether a field becomes an Excel export column (`tableColToShow`?).
- Whether the importer writes into `isReadonly` fields, and whether it accepts sub-columns for fields
  hidden in the reference (`toShow: false`).
- The 2-level header format for a sub-column that is itself a nested reference (`BoFieldNotSpecified`).
- Person field labels beyond Фамилия / Имя / Email in the Excel format.
- Whether any cell value can clear a DATE.
