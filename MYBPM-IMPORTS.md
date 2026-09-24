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
facts collected 2026-08-27 .. 2026-09-22 from real exports, stand imports and IDE copies.
**Status markers** used throughout: `[C]` confirmed on a stand or in a real export, `[I]` inferred from
structure/behaviour but never isolated, `[U]` unverified — do not build on it without checking.
Everything retracted has been dropped; the mistakes worth not repeating live in *Traps and defects*.

**Reference material** (what the facts below were read off — get the equivalents from your own stand)
- The richest source is a FULL export of a large company on build `.614`: it is the only one here that
  carries `STATIC_TEXT`, `isHeightDynamic`, `gridLayoutPosition` and `AccessStructDto` at once. Older
  `.570` exports of the same company and one-off exports of the other companies fill in the variants —
  and one export from 2026-05 has no `AccessStructDto` at all, so its absence is not a defect.
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
actually imported — but not for the target: three inputs belong to the stand and must be **asked for**,
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
  in `0000001.mybpm`. No trailing newline, no JSON, no quotes. Get N wrong and the import fails.
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
2. **Decide the codes.** The BO code and every field code are latin, derived from the label with the
   transliteration table in 0.6. Cut to 30 characters. These are the ONLY values you invent.
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

Three inputs below **cannot be derived from this document**: they are properties of the target stand, and
every one of them fails SILENTLY when guessed — the archive stays valid, the import reports success, the
damage shows up later. So: **ask the user for them before building.** If the user answers «build without»,
take the fallback of the last column, state in one line which default you took and what it risks, and
build — a guess is allowed only when it has been named out loud and confirmed.

| Ask for | Why guessing fails silently | Fallback if the user declines to supply it |
|---|---|---|
| The **BO group name**, character for character, as it stands on the target | the importer matches groups BY NAME; when nothing matches it **renames an existing group** instead of creating one (§8) — the customer's group list is destroyed, and the BOs may not appear at all | ask for an explicit confirmation of the default `Бизнес-объект`; ship exactly ONE group line with the confirmed name and say which name went in |
| The **BO codes already on the stand** | import MERGES by code: a colliding code edits an EXISTING BO instead of creating a new one, and the report still says success | append a short random suffix to the code (`Demo_bo_p7q2`) so a collision is improbable, and say you did |
| For a `BO` / `CO` field — the target's **`oldRefBoId` + code + name**; for a `DROPDOWN_SINGLE` / `RADIO_BUTTON_GROUP` fed `FROM_BO` — the **dictionary CODE** | ids and codes live on the stand; a wrong id is a dangling reference, and the analysis only warns («В Составном объекте не достаёт БО») — the warning does **not** block ПРИМЕНИТЬ | do NOT emit the field with an invented id. Either drop it, or degrade it — a dropdown to a local list (`optionSource: "FROM_FIELD"`), a reference to `INPUT_TEXT` — and list every field you dropped or degraded |

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
happily as against the stand `[C]` (2026-09-18, dry run on `<company-a>`; the order of the lines does not
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

**0.2a covers those three inputs and NOTHING else.** It is not a general licence to replace whatever you
feel unsure about with something simpler. Everything else in this document is buildable from the document
alone: tabs (`TAB_GROUP`), a progress scale (`PROGRESS_BAR`), a questionnaire, a local dropdown, a
multi-file upload need no stand data at all — building section headings «instead of» tabs because
«the tab structure was not supplied» is the same substitution as the panel and the composite above, and
it is the third time it has happened. If the document tells you how to build the thing asked for, build
it; 0.2a applies only when a **stand id or a stand code** is what is missing.

Two more rules that need no asking, they are absolute: `Person` / `Department` / `PersonGroup` are
reserved codes (§6, import dies with «Несоответствие типов объектов»), and an `AccessStructDto` is never
shipped unless the user asked for one (§0.10 rule 10 — it wipes `orgUnitIds`).

Where the user reads these off a stand (routes in `MYBPM-UI-API.md` §0U, recipe R4): `load-bo-groups` → the group
names, `load-bo-records-by-group-id` → the BOs of a group with their codes and ids,
`load-bo-id-by-code` → an id for a known code, `load-bo-dictionary-list` → the dictionaries. By hand: the
constructor's BO list, and the id sits in the URL `…/business-objects/editing/<boId>/object-editing`.

### 0.3 Line 1 — the BO group (copy verbatim, change `name` and the two ids)

```json
{"@class":"kz.greetgo.mybpm.reg.structure.model.dto.BoGroupStructDto","oldId":"3H84o9iM@G4jaOL3","name":"Бизнес-объект","orderIndex":1110000,"kind":"MANUAL","newId":"ca3w3BgmzJGmWO7q"}
```

- `name` **must equal, character for character, a group that already exists on the stand.** The importer
  matches groups by name, and when nothing matches it **renames an existing group** instead of creating
  one — that is a real defect that destroys the customer's group list (§8). Never ship a group name you
  have not seen on the stand.
- The two ids above are the SAMPLE's, not yours — mint your own by 0.7 (0.2a).
- `oldId` ties this line to the BO line (`BoStructDto.boGroupOldId` repeats it). It is NOT a stand id —
  every export of the same group carries a different one, so any value of the right shape is fine.
- `kind` is always `MANUAL`; `orderIndex` may stay `1110000`.
- **One group line per archive.** Multi-group archives are broken (§8).

### 0.4 Line 2 — the business object

Copy this whole object, minify it to one line, and change only the six `←` marked places. Every other
key must be present with exactly this value — the importer MERGES, so a missing key silently keeps
whatever the stand already had, and an unknown key is a guess that can break the analysis (§8).

**The `←` notes in the blocks below are annotations, NOT part of the file.** Strip each `←` and
everything after it on that line — the shipped line must be pure minified JSON.

```text
{
  "@class": "kz.greetgo.mybpm.reg.structure.model.dto.BoStructDto",
  "oldId": "WbX5Wa8gcabbVbF1",              ← id of the BO — MINT YOUR OWN (0.7); becomes its real id on the stand
  "code": "Cookbook_demo",                  ← latin code of the BO, ≤ 30 chars (0.6)
  "category": "BO",                         ← BO | BO_DICTIONARY | BO_PANEL | BO_COMPOSITE | BO_PROCESS (0.9)
  "kind": "GENERAL",
  "boGroupOldId": "3H84o9iM@G4jaOL3",       ← = oldId of line 1, character for character
  "instanceViewType": "FORM",
  "bos": [],
  "boTabs": {},
  "printForms": [],
  "name":       {"rus": "Демо из кукбука"}, ← display name
  "recordName": {"rus": "Демо из кукбука"}, ← same text
  "staticValue": {},
  "description": "",
  "orderIndex": 47480000,
  "dynamicFields": { "<fieldCode>": { …template 0.5… } },   ← one entry per field, keyed by field code
  "nativeFields": {},
  "dictionaryFields": [],
  "actual": true,
  "isCalendarEnabled": false,
  "isMapEnabled": false,
  "isGroupingEnabled": false,
  "isCodeReadonly": false,
  "chosenAccessRight": false,
  "kanbanCardTemplates": {},                ← leave empty UNLESS the BO needs a kanban — then 0.5c
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
  "code": "Naimenovanie",                  ← the field code; must equal the key in dynamicFields
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
`[C]` (2026-09-18) and behave on the stand exactly as a constructor-built flag: an empty required field is
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
type by type on `<company-a>` 2026-09-18 (`[C]`: each one was created through the constructor API, exported,
re-generated by `make-probe-archive` and imported back). Four more types exist and are reached
differently: `BO` / `CO` (dragged out of «Вложенные объекты»), `TAB_GROUP` / `PROGRESS_BAR` (they sit in
the «Виджеты» section of the palette but are ordinary `dynamicFields` entries).

| UI «Тип поля» | `type` | extra keys in the archive |
|---|---|---|
| Текстовое поле | `INPUT_TEXT` | — |
| Текстовый блок | `TEXTAREA` | — |
| Текст (заголовок секции, статический HTML) | `STATIC_TEXT` | `staticValue` |
| Число | `INPUT_NUMBER` | — |
| Чекбокс | `CHECKBOX` | — |
| Дата | `DATE` | — |
| Дата и время | `FULL_DATE` | — |
| Время | `TIME` | — |
| Период / Период со временем | `PERIOD` / `PERIOD_TIME` | — |
| Год / Год и месяц | `YEAR` / `YEAR_AND_MONTH` | — |
| Выпадающий список | `DROPDOWN_SINGLE` | `fieldOptionsStruct` (§5) |
| Единичный выбор | `RADIO_BUTTON_GROUP` | `fieldOptionsStruct`, same two shapes |
| Чек лист | `CHECKLIST` | **none — the items are NOT carried by an archive** (below) |
| Опросник | `QUESTIONNAIRE` | `questionnaires` |
| Прогресс-бар | `PROGRESS_BAR` | `progressSteps` |
| Вкладки | `TAB_GROUP` | `fieldTabs` |
| Карта | `GEO_POINT` | — |
| Ссылка | `LINK` | — |
| Загрузка файла | `FILE_UPLOAD` | `viewType` SINGLE/MULTIPLE + `params.contentType` ALL/FOR_CAMERA |
| Email / Телефон | `INPUT_EMAIL` / `INPUT_PHONE` | — |
| Мультиязычное текстовое поле | `INPUT_TEXT_LANG` | — |
| Мультиязычный текстовый блок | `TEXTAREA_LANG` | — |
| Вложенный объект / Пользователь | `BO` | `oldRefBoId` + `boRefStruct.boInfo` |
| Составной объект | `CO` | `oldRefBoId` + `boRefStruct.boInfo` with `boCategory: "BO_COMPOSITE"` |

The types that need extra keys — every shape copied off a real export of a BO built through the
constructor, then proved by importing the same shape back `[C]` (2026-09-18):

- `STATIC_TEXT` — the HTML of the heading goes into `"staticValue": {"rus": "<h2>…</h2>"}`, and the cell
  should be `{"x":0,"y":<y>,"cols":15,"rows":8}`. A heading text **must not repeat any field label of
  the same BO** — that breaks Excel import.
- `BO` (nested object / reference) — add `"oldRefBoId": "<the target BO's id ON THE STAND>"`,
  `"viewType": "TABLE"` (or `SINGLE`), `"isHeightDynamic": true`, and
  `"boRefStruct": {"boInfo": {"code": "<target code>", "name": "<target name>", "boCategory": "BO"}, "fieldRefs": {}}`.
  The target must already exist on the stand and **its id and code must be read off the stand**, never
  guessed — unless this same archive creates it, in which case its `oldId` IS the id (0.2a).
- `CO` — the same, with `"boCategory": "BO_COMPOSITE"` and the composite's id (which itself often starts
  with «@», e.g. `@feclOAWUnwXFQ8c` — parse such a spec from the right).
- `DROPDOWN_SINGLE`, `RADIO_BUTTON_GROUP` — one extra key, `fieldOptionsStruct`, in exactly one of the
  two shapes below. Copy the literal; §5 explains them.

  A LOCAL list («Задать вручную») — **`options` is an OBJECT keyed by the option's own code, never an
  ARRAY**, and every entry wraps its payload in `fieldOption`:

  ```text
  "fieldOptionsStruct": {"optionSource": "FROM_FIELD", "dictionaryOptionSetting": {}, "options": {
     "Novyyi":   {"fieldOption": {"code": "Novyyi",   "label": "Новый",    "orderIndex": 0,     "color": null, "hiddenInKanban": false}, "newOptionId": "<16 chars>"},
     "V_rabote": {"fieldOption": {"code": "V_rabote", "label": "В работе", "orderIndex": 10000, "color": null, "hiddenInKanban": false}, "newOptionId": "<16 chars>"}}}
  ```

  The map key repeats `fieldOption.code`, the code is the option's label transliterated by 0.6, and
  **`fieldOption.label` is a PLAIN STRING** — not `{"rus": …}`, the one label in the whole file that is
  not a language map. `orderIndex` steps 0, 10000, 20000…; `newOptionId` is a fresh id by 0.7.

  A DICTIONARY — named BY CODE, so it needs no stand id; this is the one cross-object reference 0.2a
  does not block:

  ```text
  "fieldOptionsStruct": {"optionSource": "FROM_BO", "options": {}, "dictionaryOptionSetting": {},
     "dictionaryBoInfo": {"code": "Dolzh", "name": "Должность", "boCategory": "BO_DICTIONARY"}}
  ```

  `options` stays EMPTY here — the rows live in the dictionary and the form reads them at runtime.
- `QUESTIONNAIRE` — columns and rows share ONE map, told apart by `isColumn`, keyed by the option's code:
  `"questionnaires": {"Kolonka_1": {"questionnaireDto": {"label":"Колонка 1","isColumn":true,"orderIndex":0,"code":"Kolonka_1"}, "newId":"<16 chars>"}, "Stroka_1": {…"isColumn":false…}}`
- `PROGRESS_BAR` — `"progressSteps"` is keyed by the step's own **id**, not by its code:
  `{"<16-char id>": {"code":"Novyyi","label":"Новый","orderIndex":0}, …}`
- `TAB_GROUP` — `"fieldTabs"` keyed by the tab code:
  `{"Obschee": {"label":{"rus":"Общее"},"orderIndex":0,"chosenAccessRight":false,"isRight":false,"isDefault":true,"code":"Obschee","newId":"<16 chars>"}}`
- `FILE_UPLOAD` — `"viewType": "MULTIPLE"` («несколько файлов») and `"params": {"contentType": "ALL"}`
  (`FOR_CAMERA` = «только фото с камеры»).
- `CHECKLIST` — **a known gap `[C]`**: the items live on the field (`options` + `optionSource` in the
  constructor DTO), but a structure export writes NO `fieldOptionsStruct` for a checklist and an import
  cannot bring them either. The field arrives empty and the items have to be typed in the constructor.

Cell heights the constructor itself assigns: 4 rows for a plain field, **6** for `BO` / `CO` / `LINK` /
`FILE_UPLOAD` / `CHECKLIST` / `RADIO_BUTTON_GROUP` / `PROGRESS_BAR`, **8** for `STATIC_TEXT` /
`QUESTIONNAIRE` / `TAB_GROUP` / `GEO_POINT`.

### 0.5a System fields — `nativeFields`, NOT `dynamicFields`

«Системные поля» of the palette are a separate archetype and live in their own map of `BoStructDto`,
keyed by the native type, which is also the field's code and its `nativeFieldId` `[C]` (2026-09-18):

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

### 0.5b Widgets — six maps of their own

«Виджеты» are neither `dynamicFields` nor `nativeFields`: each family has its own map in `BoStructDto`,
keyed by the widget's CODE `[C]` (2026-09-18, exported and re-imported):

| widget | UI label | map | extra keys |
|---|---|---|---|
| `SIGNATURE` | ЭЦП / СМС | `signatures` | `fieldCodes`, `massFieldCodes`, `printFormCodes`, `massPrintFormCodes` (all `{}`) |
| `BUTTON` | Кнопка | `buttons` | `url`, `fieldCodes` |
| `IFRAME` | Блок IFrame | `iframes` | `url` |
| `CAPTCHA` | Блок captcha | `captcha` | — |
| `CURRENT_DATE` `CURRENT_DAY` `CURRENT_MONTH` `CURRENT_DAY_AND_MONTH` `CURRENT_YEAR` | Текущая дата / день / месяц / день и месяц / год | `currentDates` | `widgetType` repeats the type |
| `CURRENT_USER` | Текущий пользователь | `currentUser` | `viewType: "TABLE"`, `fieldRefs` |

One entry looks like this — there are no boolean flags at all, unlike a dynamic field:

```text
"buttons": {"knopka": {"label": {"rus": "Кнопка"},
  "gridPosition": {"x":0,"y":<y>,"cols":15,"rows":4},
  "code": "knopka", "type": "BUTTON", "newId": "<16 chars>",
  "url": "https://example.org/hook", "fieldCodes": {}}}
```

Heights: 4 rows for a button and the CURRENT_* widgets, 6 for `SIGNATURE` / `CAPTCHA` / `CURRENT_USER`,
8 for `IFRAME`. A widget's code and url survive an import and can be read back through the widget's own
controller (`MYBPM-UI-API.md` §5i). `SIGNATURE` and every CURRENT_* widget may be placed **once** per BO;
`BUTTON`, `IFRAME` and `CAPTCHA` may repeat.

### 0.5c Kanban — the card template travels in the archive `[C]` (2026-09-19, `<stand>`)

A kanban is TWO things, and since 2026-09-22 the archive can carry BOTH:

- the **card template**, which lives ON THE BO in `kanbanCardTemplates`. **Ship it, or the kanban view
  dies with «cardTemplate is null»** — that is the whole of the old «kanban is broken for imported BOs».
  It belongs to the BO, not to any menu item: whatever place shows this BO as a board reads it from here.
- the **switch that shows the board**, with its column field. The one place verified so far is a SIDEBAR
  MENU ITEM (`boPages.isKanbanEnabled` + the column field) — a menu line of the SAME archive does it by
  code, `boPages.kanbanFieldCode` (0.5d, §5e); the alternative is
  `v2/menu-item/save-menu-item-bo-pages` after the import (`MYBPM-UI-API.md` §4). **Whether a kanban can
  be switched on anywhere else is `[U]`** — never looked at: a registry inside a `BO_PANEL`, a BO / CO
  reference field (its `viewType` key), the BO registry opened outside the menu. Do not claim either way;
  if the user wants a board, a menu item is the proved route.

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

**The Elasticsearch sort defect — what the archive must do about it** `[C]` (2026-09-19/20, `<stand>`,
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
whole board with its columns straight after ПРИМЕНИТЬ `[C]` (2026-09-22, build `S4.24.25.632`, §5e).

### 0.5d Sidebar menu items — `MenuItemStructDto` lines `[C]` (2026-09-22, build `S4.24.25.632`)

Optional lines AFTER the BO lines (step 7a). A menu item is NAVIGATION: a row in the sidebar that opens
a BO's records (or a folder that holds such rows). Views such as a kanban are an option ON an item, not
the reason for it. One line per menu item; a group and the items inside it are separate lines.
**Everything is referenced BY CODE** — the parent group, the BO, a view's field — and a menu line has
**no id at all**: the stand mints the menu item's id itself. Copy the templates literally and change
only the values marked `←`.

**An item that opens a BO** — the usual case, the list view only, at the root of the sidebar:

```json
{"@class":"kz.greetgo.mybpm.reg.structure.model.dto.MenuItemStructDto",
 "menuItemCode":"Zayavki_menu",                  ← your code, latin, unique among MENU codes
 "menuItemName":"Заявки",                        ← the text in the sidebar
 "boCode":"Zayavki",                             ← the BO's `code`
 "boName":"Заявки",                              ← the BO's `name.rus`
 "iconName":"man-with-company",
 "orderIndex":950000,                            ← position among its siblings
 "boPages":{"isKanbanEnabled":false,"kanbanIndex":0,
            "isCalendarEnabled":false,"calendarIndex":0,"isTimelineEnabled":false,"timelineIndex":0,
            "isListEnabled":true,"listIndex":1,
            "isMapEnabled":false,"mapIndex":0,"isGroupingEnabled":false,"groupingIndex":0},
 "chosenAccessRight":false,"needCountMenuItem":false,"isPanel":false,"needHideInMobApp":false,
 "bracketFilter":{"boCode":"Zayavki","type":"MENU_ITEM","brackets":{}},
 "menuItemType":"BO"}
```

(This list-only shape is what the stand EXPORTS for such an item, and it IMPORTS as is `[C]` —
applied on 2026-09-22 and read back from `load-nav-items` with exactly these `boPages`.)

**A group** (a folder in the sidebar) — only when the user wants the items grouped:

```json
{"@class":"kz.greetgo.mybpm.reg.structure.model.dto.MenuItemStructDto",
 "menuItemCode":"Proba_menu_20260922",            ← your code
 "menuItemName":"Проба меню 2026-09-22",          ← the text in the sidebar
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
| calendar | `isCalendarEnabled`, `calendarIndex` | presumably the BO's `isCalendarEnabled` / `calendarCardTemplates` and a date field | `[U]` |
| timeline | `isTimelineEnabled`, `timelineIndex` | presumably the BO's `timelineTemplates`; the applied item came back with a `timelineFieldId: null` the archive never sent, so a field is probably involved | `[U]` |
| map | `isMapEnabled`, `mapIndex` | presumably the BO's `isMapEnabled` and a location field | `[U]` |
| grouping | `isGroupingEnabled`, `groupingIndex` | presumably the BO's `isGroupingEnabled` | `[U]` |

Only list and kanban were ever shipped. **Do not switch on a `[U]` view in an archive** — if the user
asks for a calendar / timeline / map / grouping, say it is not verified and ship the list (plus a kanban
if asked). The kanban variant of `boPages` (kanban first tab, list second):

```text
"boPages":{"isKanbanEnabled":true,"kanbanIndex":1,
           "isCalendarEnabled":false,"calendarIndex":0,"isTimelineEnabled":false,"timelineIndex":0,
           "isListEnabled":true,"listIndex":2,
           "isMapEnabled":false,"mapIndex":0,"isGroupingEnabled":false,"groupingIndex":0,
           "kanbanFieldCode":"Status"}          ← code of a DROPDOWN of that BO = the columns
```

Rules:

- **A `GROUP` line carries NO `boPages`, NO `bracketFilter`, NO `boCode`/`boName`** — the stand exports
  it exactly like that, and the import accepts it.
- **A `BO` line carries both `boPages` and `bracketFilter`**; `bracketFilter.boCode` repeats `boCode`,
  `brackets: {}` = no record filter (every record is shown).
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
- **Icons** `[C]` (2026-09-22): `iconName` takes ANY name of the catalogue in **0.5e**, written with
  its prefix exactly as listed there — `"phosphor:house-line"`, `"menu-item:025-building"`. Without a
  wish from the user keep the defaults: `bo-g-draggable` for a group, `man-with-company` for a BO item,
  `bo-d-draggable` for a dictionary (these three have no prefix). **The importer does not check the
  name**: a name that is not in 0.5e analyses clean, applies (`APPLIED`), is stored verbatim — and the
  sidebar shows an EMPTY place where the icon should be. So every `iconName` must be copied from 0.5e;
  when the user describes an icon by meaning («домик», «деньги», «люди»), pick the closest name from
  0.5e and SAY which one you took. Never compose a name from memory of the Phosphor icon set: the stand
  ships only part of it (`phosphor:seal-check`, `ranking`, `toolbox`, `gavel` do not exist there).
- Do not set `chosenAccessRight: true` — whether menu access rights travel with this line is `[U]` (§5e).
- **A `menuItemCode` that already exists on the stand is an EDIT of that item, not a new one** `[C]`
  (§5e): the import overwrites its name, order, views and filter in place, keeping its id. So a menu
  code of your own must be new to the stand — never reuse a code seen on the stand unless the user asked
  to change THAT item. Re-importing your own regenerated archive is safe for the same reason: it updates
  your item instead of adding a second one.
- **A menu-only archive is legal** `[C]`: one `MenuItemStructDto` line and nothing else (no group line,
  no BO line) imports fine when its `boCode` is already on the stand — the way to add or change a sidebar
  item for an existing BO. The `boCode` is then a stand code: ask for it (0.2a).

### 0.5e Menu icons — the whole catalogue `[C]` (2026-09-22, frontend build `C4.24.25.264`)

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

### 0.6 Codes: label → code

The stand transliterates Russian labels like this; reproduce it so the code matches what a
constructor-built field would get. Per character: lowercase it, map it through the table, then
re-capitalise the first letter if the original was uppercase; latin letters and digits pass through;
**everything else (spaces, punctuation) becomes `_`**; finally cut to **30 characters**.

```
а a   б b   в v   г g   д d   е e   ё e   ж zh  з z   и i   й yi
к k   л l   м m   н n   о o   п p   р r   с s   т t   у u   ф f
х h   ц c   ч ch  ш sh  щ sch ъ —   ы y   ь —   э e   ю yu  я ya
```

**Transliterate the label — never TRANSLATE it and never rename it.** `Название` → `Nazvanie`, not
`Naimenovanie` (that is the transliteration of a different word) and not `Name`. A code is the label's
letters mapped one by one; if a code cannot be read back to the label, it is wrong.

**Transliterate the WHOLE label, every word of it.** The code is not the first word and not an
abbreviation: «Тема обращения» → `Tema_obrascheniya`, «Дата подачи заявления» → `Data_podachi_zayavleniya`,
«ФИО заявителя» → `FIO_zayavitelya`. The only thing that may shorten a code is the 30-character cut, and
it cuts from the right.

**`й` is `yi`, not `y`** `[C]` (2026-09-18, corrected after a generated archive collided with the
stand's own codes): «Текстовый блок» → `Tekstovyyi_blok`, «Загрузка файла» → `Zagruzka_fayila`,
«Единичный выбор» → `Edinichnyyi_vybor`, «Текст статический» → `Tekst_staticheskiyi`.

«Наименование» → `Naimenovanie`, «Сумма» → `Summa`, «Активен» → `Aktiven`,
«Дата и время» → `Data_i_vremya`.

**A code that already exists on the stand may carry a random 14-character tail**
(`issuance_dateAew5UkKutBKvPg`) — that tail is part of the real code. When you patch an EXISTING BO,
read the codes off a fresh export instead of transliterating (§3).

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
| Справочник | `BO_DICTIONARY` | the value of `dictionaryFields` **changes** to `["CODE","LABEL"]` (the key itself is on every BO, see below), and `dynamicFields` **starts** with the two system fields below; extra fields may follow |
| Панель | `BO_PANEL` | every entry of `dynamicFields` is a `type: "BO"` widget (extra keys in 0.5) with `"isReadonly": true`, `"isKindAddForSelect": true`, `"rows": 6`+ — each one needs an `oldRefBoId` off the stand, so **with no ids a panel cannot be built at all** (0.2a) |
| Составной объект | `BO_COMPOSITE` | `"bos": [{"code","name","boCategory"}]` = the source BOs **by code — no id exists here, so this kind is never degraded to a plain `BO`** (0.2a). The code is resolved against the lines of THIS archive first and otherwise on the stand, so the sources may travel in the same archive, in any order (§5b). Every field carries `"boFieldCodes": [{"boCode","fieldCode"}]` (one link = простой атрибут, two+ = составной) — **every `fieldCode` must exist in that source BO or the import dies with `INTERNAL_ERROR`** (§5b) — and **no** `gridPosition` / `tableColOrderIndex` / `removeType` |
| Бизнес-процесс | `BO_PROCESS` | a **third line** `BoProcessVersionsStructDto` (§5c) whose `oldId` = the BO's `oldId`; the importer does NOT create `PROCESS_STATUS`, ship that field yourself |

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
must ship it (§5c) — but that field is a `type: "BO"` reference to the stand's «Статус процесса»
dictionary and needs its `oldRefBoId`, which 0.2a forbids inventing. The two rules do not collide; they
resolve like this:

- the id was supplied → ship `PROCESS_STATUS` exactly as §5c prints it;
- the id was NOT supplied → **ship the process WITHOUT `PROCESS_STATUS`** and say so in one line. The
  archive imports and the process works as a diagram `[C]` (every probe was built that way); the status
  field is then added in the constructor, or the id is read off the stand with `load-bo-dictionary-list`
  (0.2a) and the archive re-shipped.
- **Never substitute a local dropdown «Статус» for it** — that is an ordinary field with a similar name,
  nothing on the stand treats it as the process status, and the archive looks complete while it is not.
  And never paste `<company-a>`'s `Q0zI~z9Ra2R7Q3yd`.

### 0.10 Hard rules — violating any one of these breaks the import

1. **One** `BoGroupStructDto`, its `name` copied verbatim from a group that exists on the stand.
2. `objectCount-<N>` in `metadata.mybpm` equals the line count of `0000001.mybpm`.
3. JSONL: one minified JSON object per line; no array wrapper; UTF-8; final newline.
4. Every line carries its `"@class"` with the full package
   `kz.greetgo.mybpm.reg.structure.model.dto.<DtoName>`.
5. `dynamicFields` is an object keyed by field code, and the key equals the field's `code`.
6. Never drop a key to disable something — write `false`. Import MERGES into what is on the stand. The
   only keys ever legitimately absent are `gridPosition` / `tableColOrderIndex` / `removeType` inside a
   `BO_COMPOSITE`, which has no form (0.9, §5b).
7. Codes ≤ 30 characters, latin, from the table in 0.6.
8. Ids are 16 chars over `A-Za-z0-9@~`, deterministic, and the three equalities of 0.7 hold.
9. `isRequired` + `isReadonly` both true = an unsaveable record.
10. Do not ship an `AccessStructDto` unless asked: import APPLIES it and **wipes `orgUnitIds`**, i.e. it
    erases group rights set by hand on the stand (§7, §8).
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

### 0.11 Self-check before shipping

- [ ] `unzip -l` shows exactly two members, both inside one `data-*/` folder.
- [ ] `unzip -p <zip> 'data-*/metadata.mybpm'` prints `objectCount-<N>`, and
      `unzip -p <zip> 'data-*/0000001.mybpm' | wc -l` prints the same N.
- [ ] Every line parses on its own (`while read l; do echo "$l" | python3 -m json.tool >/dev/null; done`).
      Parsing the whole member at once MUST fail with «Extra data» — that proves it is JSONL.
- [ ] `boGroupOldId` == the group's `oldId`.
- [ ] Every `dynamicFields` key equals its entry's `code`, and every `newId` is distinct.
- [ ] Every `nativeFields` key equals its `nativeFieldId`, and every widget map key equals that widget's
      `code`; no widget or native type hides in `dynamicFields`.
- [ ] The `y` of each field == previous `y` + previous `rows`.
- [ ] `tableColOrderIndex` runs 0, 1, 2… down `dynamicFields` — not `0` on every field (0.5).
- [ ] Every local list is `"options": {…}` — an OBJECT keyed by the option code, each entry wrapped in
      `fieldOption`, its `label` a plain string (0.5).
- [ ] Every code is the WHOLE label transliterated, not its first word (0.6).
- [ ] The group name exists on the target stand — confirmed by the user, not assumed (0.2a).
- [ ] No `oldRefBoId` / dictionary code in the file was invented; every one came from the stand, or from
      an EARLIER line of this same archive (0.2a).
- [ ] For a `BO_COMPOSITE`: every `bos[].code` is either a BO line of this archive or a code the user
      gave off the stand, and every `boFieldCodes[].fieldCode` really exists in that source BO —
      a missing field code crashes the import with `INTERNAL_ERROR` (0.2a, §5b).
- [ ] No id literal was copied out of this document — the sample's ids are `<company-a>`'s (0.2a).
- [ ] No `STATIC_TEXT` heading repeats a field label of the same BO (0.10 rule 12).
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

Ready-made generator, already verified on a live stand — prefer it over writing a new builder:

```
bun tools/make-probe-archive.bun.ts --code Cookbook_demo --name "Демо из кукбука" \
    --field "Наименование:INPUT_TEXT" --field "Сумма:INPUT_NUMBER" --field "Активен:CHECKBOX"
```

(`--category`, `--field "Метка:BO@<boId>@<boCode>"`, `--source` / `--co-field`, `--process-figure`,
`--process-status`, `--kanban`, `--menu`, `--with-metadata`, `--out` — see the file's header comment,
§5a–5c and §5e.)

A BO plus a sidebar item that opens it — plain navigation, list view only (0.5d; this output is
byte-identical to the 0.5d template and passes `tools/validate-archive.bun.ts`):

```
bun tools/make-probe-archive.bun.ts --code Zayavki --name "Заявки" --field "Наименование:INPUT_TEXT!req" \
    --menu "Заявки:BO@Zayavki@Заявки!code=Zayavki_menu!order=950000"
```

Add `!parent=<GROUP code>` to put the item into a group (plus a `--menu "Имя:GROUP!code=…"` if the group
travels in the same archive), `!kanban=<dropdown code>` for a board, `!icon=<name from 0.5e>` for an
icon (`!icon=phosphor:rocket`, `!icon=menu-item:025-building`). A BO with a kanban and its own
sidebar group, all in one archive — the exact command whose result was applied and drawn on a stand
(0.5c, 0.5d):

```
bun tools/make-probe-archive.bun.ts --code Proba_menu_bo_20260922 --name "Проба меню БО 2026-09-22" \
    --field "Наименование:INPUT_TEXT!req" --field "Статус:DROPDOWN_SINGLE#Новый|В работе|Готово" \
    --kanban "Статус:HEADER=Наименование" \
    --menu "Проба меню 2026-09-22:GROUP!code=Proba_menu_20260922!order=950000" \
    --menu "Проба канбана из меню:BO@Proba_menu_bo_20260922@Проба меню БО 2026-09-22!code=Proba_menu_kanban_20260922!parent=Proba_menu_20260922!kanban=Status!order=950100"
```

The generator covers ALL 27 field types, the six system fields and all ten widgets `[C]` (2026-09-18 —
the archive below was generated, imported through the API and read back field by field):

```
bun tools/make-probe-archive.bun.ts --code Proba_vseh_tipov --name "Проба все типы" --with-metadata \
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
    --widget "BUTTON:Кнопка:knopka:https://example.org/hook" \
    --widget "CURRENT_USER:Текущий пользователь:cur_user"
```

`#…` means a different thing per type: options for `DROPDOWN_SINGLE` / `RADIO_BUTTON_GROUP` /
`CHECKLIST`, steps for `PROGRESS_BAR`, tabs for `TAB_GROUP`, the HTML itself for `STATIC_TEXT`, and
«колонки, then rows prefixed with `^`» for `QUESTIONNAIRE`. `!multiple` / `!camera` are the
`FILE_UPLOAD` settings. `--widget "TYPE:Метка[:код][:url]"`, `--native <NATIVE_TYPE>`.

`I1fVTkYPTSg7X8b8` and `@feclOAWUnwXFQ8c` in that command are **ids ON THE `<company-a>` STAND** — `Person` and
one composite there. They are the shape of a `--field ...@<boId>@<boCode>` spec, never values for an
archive aimed at another stand (0.2a).

If you must build the zip yourself and have no zip library, STORED entries are enough; in Python:

```python
import json, zipfile
lines = [line1, line2]                      # dicts, in order
d = "data-2026-09-18T10-43-21-715"
payload = "\n".join(json.dumps(o, ensure_ascii=False, separators=(",", ":")) for o in lines) + "\n"
with zipfile.ZipFile("out.mybpm.zip", "w", zipfile.ZIP_STORED) as z:
    z.writestr(f"{d}/0000001.mybpm", payload.encode("utf-8"))
    z.writestr(f"{d}/metadata.mybpm", f"objectCount-{len(lines)}".encode("utf-8"))
```

**Delivering it — the minimum** `[C]` (2026-09-18/22; the full transport is `MYBPM-UI-API.md` §5 / R3,
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
  flags `canRollback: true` can be undone, and «latest» is the stand's ranking, not yours — same-minute
  applies were ranked out of order. Undoing an import that UPDATED something restores the SNAPSHOT it
  found, silently dropping anything applied after it; undoing a chain is safe only all the way back to
  the import that CREATED the objects. When you may need to undo, leave a minute between applies.

**Always read the analysis result before pressing ПРИМЕНИТЬ** — «В Составном объекте не достаёт БО»
does not block applying, and `load-import-errors` can come back empty while the UI dialog shows an error.

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
  items (`MenuItemStructDto`, §5e) come after the BOs. A one-BO export
  = 3 lines + its `AccessStructDto` if any. `[C]`
- `CompanyMetadataStructDto` carries the company ids `personBoId`, `departmentBoId`, `personGroupBoId`
  (different per company — read them from a stand export). It has **no** stand host/URL, so record the
  stand URL in project memory. Copying another company's CompanyMetadata ids (`<company-b>` → `<company-c>`)
  imported fine. `[C]`
- **`CompanyMetadataStructDto` is OPTIONAL** `[C]` (2026-09-18, `S4.24.25.632`): a hand-made **2-line**
  archive (`BoGroupStructDto` + `BoStructDto`, `objectCount-2`, no access DTO) was analysed with an empty
  error list and applied — the BO was created with both fields. Ship the line only when the archive
  actually references Person/Department/PersonGroup.
- **Group `oldId`/`newId` are generated at EXPORT time, not stable ids** `[C]`: the same `<company-a>` group
  «Тест» carries `ICHLTlIHbLLBzxoI`, `wNARkY1IRHHtHbv9`, `fKsRKOK@JrbB@UM6`, `LEl3hxwYMOiuY7Fa` in four
  exports; «Матрицы» changed between builds too. So `boGroupOldId` only ties the lines of ONE archive
  together, and the importer cannot be matching groups by it — see §8.
- **The stand keeps the archive's `oldId` as the BO's real id** `[C]` (`<company-a>` 2026-09-18: the generated
  `oldId: "Zyvu00@DV5VPL69g"` appeared verbatim in the registry URL; confirmed a second time on the
  API-imported BO `Proba_API_20260918`, whose `oldId "d9OrTqCb7O97FFY4"` came back from
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
- **Structure as of export time only.** After renaming/adding/deleting fields take a fresh export: a
  2026-08-30 export showed no tabs though the user had split fields since; a 09-01 one still held removed
  fields; a 04:54 dump lacked 17 STATIC_TEXT headers that the 13:49 archive had. `[C]`

### What an export carries per BO — the map list `[C]` (2026-09-18)

A `BoStructDto` of 4.24.25.632 has these keys: `oldId code category kind boGroupOldId instanceViewType
bos boTabs printForms name recordName staticValue description orderIndex dynamicFields nativeFields
dictionaryFields actual isCalendarEnabled isMapEnabled isGroupingEnabled isCodeReadonly
chosenAccessRight kanbanCardTemplates timelineTemplates calendarCardTemplates signatures buttons
iframes currentDates captcha currentUser`. The last six are the widget maps (§0.5b), `nativeFields`
holds the system fields (§0.5a).

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
`[C]` (2026-09-18; the ids in older exports of this stand differ, so read them off a fresh export).

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

### Field types — the whole enum `[C]` (2026-09-18, read off the client bundle, chunk `9839` module `10234`, and probed type by type)

`ApiFormFieldType` has exactly these members; the ones marked ✗ are client-side only and
`generate-business-form-field` answers `400 Failed to convert 'fieldType'` for them:

`INPUT_TEXT` `INPUT_PHONE` `INPUT_EMAIL` `INPUT_NUMBER` `TEXTAREA` `TIME` `FULL_DATE` `YEAR_AND_MONTH`
`YEAR` `DATE` `PERIOD` `PERIOD_TIME` `CHECKBOX` `DROPDOWN_SINGLE` `FILE_UPLOAD` `CHECKLIST`
`RADIO_BUTTON_GROUP` `QUESTIONNAIRE` `BO` `CO` `TAB_GROUP` `GEO_POINT` `PROGRESS_BAR` `INPUT_TEXT_LANG`
`TEXTAREA_LANG` `LINK` `STATIC_TEXT` — plus ✗`BUTTON` ✗`RANGE` ✗`MULTIPLE` ✗`SINGLE` ✗`INPUT`.

| UI name | export `type` | note |
|---|---|---|
| Текстовое поле | `INPUT_TEXT` | |
| Текстовый блок | `TEXTAREA` | |
| **Текст** | `STATIC_TEXT` | static HTML in `staticValue.rus`, a section heading — *not* a text input |
| Число | `INPUT_NUMBER` | |
| Чекбокс | `CHECKBOX` | not «Логический» |
| Дата | `DATE` | |
| Дата и время | `FULL_DATE` | no `defaultValue` `[C]`; the client's palette constant is `FULL_DATE`, never `DATE_TIME` |
| Время | `TIME` | |
| Период / Период со временем | `PERIOD` / `PERIOD_TIME` | **«Период» is a field type, not a dictionary** |
| Год / Год и месяц | `YEAR` / `YEAR_AND_MONTH` | |
| Выпадающий список | `DROPDOWN_SINGLE` | `optionSource` FROM_BO (dictionary) or FROM_FIELD (local list) |
| Единичный выбор | `RADIO_BUTTON_GROUP` | the same `fieldOptionsStruct`; renders as chips, read in scripts through `.#Значение` (§12) |
| Чек лист | `CHECKLIST` | items live on the field but are NOT exported/imported (§0.5) |
| Опросник | `QUESTIONNAIRE` | `questionnaires` = columns + rows in one map |
| Прогресс-бар | `PROGRESS_BAR` | `progressSteps`; sits in the «Виджеты» palette section but is a normal field |
| Вкладки | `TAB_GROUP` | `fieldTabs`; also from the «Виджеты» section |
| Карта | `GEO_POINT` | excluded from filters and from a BO-reference's column list by the client |
| Ссылка | `LINK` | URLs — not a text field |
| Загрузка файла | `FILE_UPLOAD` | `viewType` SINGLE / MULTIPLE, `params.contentType` ALL / FOR_CAMERA |
| Мультиязычное текстовое поле | `INPUT_TEXT_LANG` | scripts read it through `.RUS` |
| Мультиязычный текстовый блок | `TEXTAREA_LANG` | |
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
  `isSystem`, `isUnique`) and `label` (`INPUT_TEXT_LANG`).
- A dictionary MAY carry extra fields (`<company-b>` `Tax_base`: `lower_limit`, `fixed_amount`, `rate`,
  `starting_price`); 15 of 21 keep the plain code/label shape.
- **A hand-built dictionary archive imports cleanly** `[C]` (2026-09-18, `<company-a>`): the three keys above
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
- **A «Выпадающий список» carries `fieldOptionsStruct`** `[C]` (2026-09-18: shapes read off a real
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
    `label` + `labelEng`; emitting that key today is a guess, not a translation).
  `tools/make-probe-archive.bun.ts` emits both: `--field "Должность:DROPDOWN_SINGLE@Dolzh@Должность"` /
  `--field "Статус:DROPDOWN_SINGLE#Новый|В работе|Готово"`.

## 5a. Panels (панели) `[C]` (2026-09-18, `<company-a>`)

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
  Person field with `isCurrentUser: true`. Both are `[U]` for hand-built archives — never round-tripped.

## 5b. Composite objects (составные объекты) `[C]` (2026-09-18, sample `TestComposite.mybpm.zip`)

A composite object unites the records of several BOs into one registry; in an archive it is a single
`BoStructDto`, `category: "BO_COMPOSITE"`, `kind: "GENERAL"`. `TestComposite.mybpm.zip` (`~/Downloads`)
holds exactly 3 objects — `CompanyMetadataStructDto`, one `BoGroupStructDto`, one `BoStructDto` — and no
`AccessStructDto`.

- **`bos: [{code, name, boCategory}]`** — the source BOs, referenced **by CODE only**, no id and no
  nested DTO. The importer looks them up **by code — first among the lines of the archive itself, and
  otherwise on the stand** `[C]` (2026-09-18, both import routes; the in-archive case proved by a dry run
  on `<company-a>`) — and writes the real `boId`s into the live `links`. So a composite and the BOs it joins
  can travel in ONE archive, in any line order (composite first also analyses clean).
- **A `boFieldCodes.fieldCode` that no source BO has CRASHES the analyzer** `[C]` (2026-09-18). Not a
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
    **`load-import-errors` DOES report it** `[C]` (2026-09-18, corrected — an earlier probe had read it
    against the wrong import): one record per missing source,
    `{ownerBoInfo:{code,name,boCategory:"BO_COMPOSITE"}, requiredBoInfo:{code,name,boCategory},
    errorType:"CO_UNSATISFIED_DEPENDENCY"}` — `requiredBoInfo.code` names exactly the code to fix.
    So the API route needs no UI dialog to see it (`MYBPM-UI-API.md` §5, the dry-run validator).
  - The trap that produced that error here: **a BO code is cut to 30 characters**, so the stand's code
    for «Проба API-конструктор 2026-09-18» is `Proba_API_konstruktor_2026_09_` — with a trailing
    underscore. Always READ the source codes off the stand
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

## 5c. Business processes (бизнес-процессы) `[C]` (2026-09-18, sample `MyBPM-export-<company-a>-v4.24.25.430-2026-03-22T17-05-29.mybpm.zip`, both import routes on `<company-a>`)

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

- `workProcess` is the **editable version's** diagram, in the same shape `bo-process-editor/load-bo-process-def`
  returns (`MYBPM-UI-API.md` §5f) — except that each figure is a **typed struct**
  `kz.greetgo.mybpm.reg.structure.model.bo.process.figure.Figure<Type>Struct` (`FigureEnterStruct`,
  `FigureExitStruct`, `FigureScriptStruct`, …) instead of a `"type"` string. `processVersions` was `{}`
  in the sample and in both probes — published versions are `[U]`.
- **Figure and arrow ids survive the import unchanged** `[C]` — the stand's def carries the archive's own
  ids, the same determinism as `oldId` → `boId`.
- **An imported version comes in as `isWork: true`** («Версия: 1 (Опубликованный)»), not as the `isTest`
  version the constructor creates `[C]`.
- A `FigureScriptStruct` needs the matching `ScriptDefStructDto` (its `compositeId` is
  `<scriptDefId>-<figureId>`, and the id is repeated in `scriptsDefIds`). The probes stayed
  Enter → Exit, so a script figure shipped WITHOUT its def was never tried `[U]`.
- **`PROCESS_STATUS` is not created by the importer** `[C]`. The constructor gives every process the
  system field `PROCESS_STATUS` («Статус процесса», `type: "BO"`, `isSystem`, `isCodeReadonly`,
  `isRequired`, `viewType: "SINGLE"`, `boRefStruct.boInfo = {code: "PROCESS_STATUS", name: "Статус
  процесса", boCategory: "BO_DICTIONARY"}`, `fieldRefs.label.toShow`, `oldRefBoId` = the stand's
  «Статус процесса» dictionary — `<company-a>` `Q0zI~z9Ra2R7Q3yd`) — an archive must ship that field itself.
- The two `ExportStructInstanceDto` in the sample are RECORDS, not structure: one row of the
  `PROCESS_STATUS` dictionary (`CREATED` / «Только что создан»), and a `Coordinate` instance whose
  `sources: [{sourceType: "PROCESS", processInstanceSource: {boCode, isWork}}]` ties it to the process.
  Neither was needed to import a working process.
- **Generator**: `tools/make-probe-archive.bun.ts --category BO_PROCESS` emits both lines; it always puts
  an `Enter` at (100,100) and chains `--process-figure "<Type>[@x,y]"` (repeatable, default a single
  `Exit@440,104`) after it with `main → main` arrows, and `--process-status <refBoId>` adds the
  `PROCESS_STATUS` field in the export's own shape. Both routes verified on `<company-a>`
  (`MYBPM-UI-API.md` §5f); the import dialog labels the node **«Бизнес-процесс/<имя>»** and
  `load-import-bo-infos` returns `boCategory: "BO_PROCESS"`.

## 5d. Scripts inside the archive (`BoScriptVersionsStructDto` + `ScriptDefStructDto`) `[C]` (2026-09-18, sample `MyBPM-export-<company-b>-v4.24.25.614-2026-09-15T16-55-04.mybpm.zip`)

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
  `onInstanceCreationId` / `onCloseScriptId` `[C]` (2026-09-24 — each proven by its own marker; when each
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
- `methodScriptIds` was `[]` on all three BOs `[U]` — how a BO's own methods («Глобальные методы» are a
  different screen) are listed has never been seen. The import probe below shows the consequence: a body
  that CALLS a local method arrives broken, because the method itself does not travel.

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

### The reverse works too: an archive CREATES scripts on import `[C]` (2026-09-18, `<company-a>`)

Probe: «Проба скрипт архивом 2026-09-18» (`Proba_skript_arhiv_20260918`, stand id `ZR1XPYi5C3zqho@w`,
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

#### Local methods do NOT travel

The 2 errors that survived are both the missing method the body calls
(`ExprCall{funcName:"is_var"}` → `exprCall_funcName__notFound`, «Не найдена плашка МЕТОД с именем is_var»).
`methodScriptIds` was `[]` in the source export and `[]` on the stand after the import — consistent with
the `[U]` above: **an archive carries hook and field scripts, not the BO's own methods**, and a body that
calls one arrives broken. Create the method first (`v2/bo-scripts-editor/create-local-method`, §5g) or
choose a body that calls none.

#### Generated bodies on every trigger — the trigger probe `[C]` (2026-09-24, `<stand>`)

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

## 5e. Sidebar menu items inside the archive (`MenuItemStructDto`) `[C]` (2026-09-22, build `S4.24.25.632/C4.24.25.264`, `<stand>`/`<COMPANY_A>`)

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

- `menuItemType`: `GROUP` | `BO` confirmed; the stand's own items also use `ANALYTIC`, `BO_MANAGER`,
  `COMPANY_MANAGER`, `SETTINGS`, `REPORT`, `OTHER` — never shipped in an archive `[U]`.
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
  (`bracketFilterId` was set after the import). Importing a NON-empty filter was not tried `[U]` — the
  map keys are presumably free 8-char ids `[I]`, and a `dynamicFilters` entry has never been seen in
  this shape at all.
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
  "parentMenuItemCode":"Proba_menu_20260922","boCode":"Proba_menu_bo_20260922",
  "boName":"Проба меню БО 2026-09-22","iconName":"man-with-company","menuItemState":"CREATE",
  "changedAspects":["display_name","linked_bo","parent_menu_item","icon","bracket_filter","bo_pages","order_index"],
  "changeDetails":{"parent_menu_item":"Proba_menu_20260922","linked_bo":"Proba_menu_bo_20260922"}}
```

**A `menuItemCode` that already exists is UPDATED IN PLACE** `[C]` (2026-09-22, `<stand>`/`<COMPANY_A>`).
Three archives, one code (`Proba_reimport_menu_20260922`), applied in turn: A = BO + list-only item
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
the BO (`category: "BUSINESS_OBJECT"`, `code: "Proba_menu_bo_20260922#BUSINESS_OBJECT"`) and both menu
lines (`category: "MENU"`, `code: "<menuItemCode>#MENU"`, `structTypes: ["MENU"]`); `rollback-import`
answered `{"type":"ROLLED_BACK"}` and afterwards the BO answered `NoBoWithId`, the group was gone from
the sidebar roots and the stand's list of menu items was back to its 19.

**Icons travel in the archive — any name of the picker, both namespaces** `[C]` (2026-09-22,
`<stand>`/`<COMPANY_A>`, build `S4.24.25.632/C4.24.25.264`). One archive: a BO, a GROUP with
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

Open `[U]`: whether menu access rights travel —
every exported item had `chosenAccessRight: false`, so the access group of an item with `true` (the
built-in «Системные» is one) has never been seen in an export; a non-empty `bracketFilter` on import;
what the calendar / timeline / map / grouping views of `boPages` need (only list and kanban were ever
shipped, 0.5d); where else a kanban can be switched on besides a menu item (0.5c).

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
  Tab rules: `fieldAccessStructMap["Vkladki"].tabAccessStructMap[tabCode].view`.
- Semantics, read off `<company-b>` rather than documented `[I]`: `denyAll:false` = «всем»;
  `denyAll:true` + empty `orgUnitIds` + all-false `authorsField` = «никому»; `denyAll:true` + ids and/or
  `author:true` = «только этим». The struct's **top-level** `denyAll` is a "custom rights are set" flag,
  not a global deny (every `<company-b>` BO has it true while its actions stay open).
- `chosenAccessRight:true` marks fields/tabs with individual rights; tabs imported with `false` were still
  hidden → probably a UI-only flag `[I]`.
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
- Fields/tabs removed from the archive survive on the stand and must be deleted by hand in the
  constructor — `[I]`, not verified.
- Structure import does not touch instance values — belief consistent with everything seen `[I]`.
- **Import APPLIES `AccessStructDto`** `[C]`: `denyAll`, `author`, `fromFields` and field rules all arrive
  (a tab «Системные» was hidden in all 6 BOs).
- **Import CLEARS `orgUnitIds`** `[C]` — a diff of the shipped archive against a stand export taken right
  after import showed every action and field rule with empty ids, although the archive carried ids of THIS
  stand's groups. Consequences: **group rights cannot be shipped**; after such an import a restricted
  action reads «Выборочно, никто»; and **every re-import of an archive that contains access DTOs re-wipes
  groups set by hand**. Org units / work groups are not carried by the archive at all (no group DTO).
- Whether an archive WITHOUT `AccessStructDto` leaves stand rights untouched is `[U]` (check: set rights,
  re-import, re-read).
- Getting group ids for an archive: set probe rights on one BO with a DIFFERENT group per action
  (view/edit/delete/archive/export), export the structure, map ids by action (worked first try); or call
  `load-org-unit-record-list`. Archive ids are `G-<id>`, API ids have no prefix.
- BOs created via import carry `kanbanCardTemplates:{}` unless the archive fills it — and an empty one is
  exactly why «kanban does not work for imported BOs». Fill it: §0.5c, `MYBPM-UI-API.md` §7.

### BO groups on import — open defect `[C] symptom, [U] cause`

Symptom (`<company-c>`, 2026-09-16): an archive with 2 groups («Цели и задачи» + 6 BOs, «Справочники» + 11
dictionaries, every `boGroupOldId` correct) put **all** BOs into «Справочники» on the stand.

- Every real stand export contains exactly ONE `BoGroupStructDto`; multi-group archives are untested
  territory. Stand group lines may carry a `code` (e.g. `Gruppa__4JQ2dcoS5cuymsOys`).
- Probe (2 groups × 1 BO): A without a group `code`, B with it, C = one group + 1 BO. Importing A and B:
  none of the probe BOs appeared, and the EXISTING group «Справочники» was **renamed** to «Проба А2» (the
  last group of archive A); B apparently did nothing; C was never imported. Probe archives were deleted —
  rebuild from this description if the question is reopened.
- Working hypothesis `[U]`: the importer maps the archive's group onto ONE existing stand group (renaming
  it) instead of creating groups by `oldId`, and with several groups only the last one applies. Why the
  probe BOs were not created is unknown (candidate: they had no `AccessStructDto`).
- **Practical risk: any import may RENAME an existing BO group** — hand-arranged groups can be lost.
- **Does NOT fire for a single group whose `name` equals an existing stand group** `[C]` (`<company-a>`,
  2026-09-18): a 1-group/1-BO archive naming the group «Бизнес-объект» (the group already on the stand)
  created the BO **inside that group**, and the two BOs already there kept their group and its name.
  This is the safe recipe for a probe import: **one** `BoGroupStructDto`, its `name` copied verbatim from
  an existing stand group. Checked afterwards in the constructor (`MYBPM-UI-API.md` §5): all 14 `<company-a>`
  groups kept their names. Combined with the `oldId` instability above, the working hypothesis is now that
  the importer matches groups **by name** and falls back to renaming when no name matches `[I]`.
- To resume: collect the import result messages, the current list of groups, and a fresh stand export.

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
scripts it carries — §5d, verified 2026-09-18. What an archive still cannot deliver is a BO's own
methods, so §0S's «you cannot create a method» stands for this route.)

Four things you cannot do — do not look for a workaround:

1. **You cannot create a method.** A fragment whose root is the method hat (`BlockFixMethod`) is silently
   not pasted. The user creates the empty method by hand (name, parameters, return type), copies it out
   of the IDE, and gives you that copy; you deliver the **body**.
2. **You cannot invent the ids of method parameters** (nor of process arrows, nor of dictionary rows).
   They are generated by the platform and live outside your file — they come from the user's copy.
3. **The language has no `while`, no arrays, no dynamic dispatch**: a counted loop and a foreach are the
   only loops; a method cannot be called by a name taken from data; a field cannot be chosen at run time
   (one `ЕСЛИ` per field). Plan the algorithm inside these limits, not around them.
4. **You cannot run the script.** Nothing you write is verified until the user pastes it and the stand
   executes it; your own verification is structural only (0S.11).

### 0S.2 Algorithm

1. **Write the algorithm as pseudocode first**, in the block language and nothing else:
   `Пусть <имя> = <выражение>` (declare), `<переменная> = <выражение>` (assign),
   `ЕСЛИ <условие> … ИНАЧЕ ЕСЛИ … ИНАЧЕ`, `ЦИКЛ <элемент> : <число или коллекция>`,
   `ВЫЙТИ ИЗ ЦИКЛА`, `ВЕРНУТЬ <выражение>`. If a step of your plan cannot be written in those six forms,
   the plan is wrong, not the language.
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
«Пусть». `varName` is a free string — the `#…#` / `~…~` decoration is part of the name, not syntax, but
**a name must be unique across the whole method**, loop element names included.

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
ИНСТАНЦИЯ» in a BO's form script** (the hooks and field-change scripts) `[C]` (2026-09-24).

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
   plain «ИНАЧЕ» for its complement — `Eq(флаг, Нет)` has failed to fire on the stand.
3. **Exactly one `FROM_METHOD` per method, at the end.** An early exit from inside an `ЕСЛИ` branch is the
   other suspect of the same defect.
4. **The first block of a body that uses a TEXT parameter must be `Пусть #x# = '' ⊕ <параметр>`.** A body
   paste has no parameter declarations, so the IDE assumes every parameter is a **number**; a bare
   parameter reference typed a variable numeric once and **18 string assignments into it vanished without
   an error**. The `'' Concat` gives it the String type. (Passing a parameter directly as an argument of a
   String action is safe.)
5. **No chained comparison.** `a > b > c` parses as `(a > b) > c`. Use `And` or nested `ЕСЛИ`.
6. **Every expression referenced exactly once** (0S.6) — a shared subtree is a DAG and the IDE rejects it.
7. **Variable names unique per method**, loop element names included.
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
Пусть #текст#  = '' ⊕ formula                  ← rule 4: pins the String type
Пусть #код#    = step.code.#Значение           ← two hops
Пусть #ответ#  = ''
ЕСЛИ #текст#.#Пусто?#          : #ответ# = 'пусто'
ИНАЧЕ ЕСЛИ #текст#.#Регулярка?#('^[0-9]+$') : #ответ# = 'число'
ИНАЧЕ                          : #ответ# = 'формула'
Пусть #i# = 0
ЦИКЛ #шаг# : 3
    #i# = #i# + 1
    ЕСЛИ #i# > 2 : ВЫЙТИ ИЗ ЦИКЛА
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
  "id00100000000000":{"varName":"#ответ#","valueExprId":"id00090000000000","downBlockId":"id00270000000000","type":"BlockNewVar"},
  "id00270000000000":{"ifExprId":"id00210000000000","thenBlockId":"id00130000000000","branches":{"id00220000000000":{"blockId":"id00160000000000","order":10,"exprId":"id00250000000000","hasExpr":true},"id00260000000000":{"blockId":"id00190000000000","order":20}},"downBlockId":"id00290000000000","type":"BlockIf"},
  "id00130000000000":{"leftExprId":"id00110000000000","rightExprId":"id00120000000000","type":"BlockAssign"},
  "id00160000000000":{"leftExprId":"id00140000000000","rightExprId":"id00150000000000","type":"BlockAssign"},
  "id00190000000000":{"leftExprId":"id00170000000000","rightExprId":"id00180000000000","type":"BlockAssign"},
  "id00290000000000":{"varName":"#i#","valueExprId":"id00280000000000","downBlockId":"id00300000000000","type":"BlockNewVar"},
  "id00300000000000":{"elementVarName":"#шаг#","srcExprId":"id00410000000000","bodyBlockId":"id00400000000000","downBlockId":"id00470000000000","type":"BlockForeach"},
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
nor `hasExpr`.

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
5. **Unique names**: no two `varName` / `elementVarName` alike within the method.
6. **Ids are 16 characters** — `branches` and `more` keys too.
7. Rules 1–6 are mechanical — encode them once in a checker of your own and run it on every file
   before you deliver it (§0S.13 lists the checkers already written for one project; ask the user
   whether that project's folder is at hand before writing a new one).

### 0S.12 Delivering the file

1. **Body paste** (the normal case — the method already exists): remove the `BlockFixMethod` entry, point
   `startBlockIds` at its `downBlockId`, and copy the hat's `x`/`y` onto that block. `strip_hat.py` does
   exactly this. The stripped body must have exactly one block fewer than the file you built.
2. **Clipboard**: `wl-copy --type text/plain < file.json`. A bare `wl-copy < file.json` advertises
   `application/json` and **the paste is silently ignored**. Verify with `wl-paste -n | md5sum` against the
   file. `wl-copy` daemonises: never end a piped script with it, or the caller hangs.
3. **Order**: paste every method (callees first), and only then copy the process script — **an entry point
   sitting in the clipboard blocks method pastes**. Copy nothing after it.
4. **Tell the user precisely**: which method to open, that the body must be cleared first, and that they
   press Ctrl+V on the canvas. Then ask them to **copy the result back** (`wl-paste -n > live.json`).
5. **Compare the copy with what you sent**: block and expression counts first (the copy of a whole method
   = your body + 1 for the hat, plus one `BlockNewVar` per «Переменная №N» carrier the IDE may insert),
   then an id-free structural diff (`canon.py` / `live_cmp.py`) — **every id is regenerated on paste**, so
   a key-by-key diff is worthless. Serialization noise to ignore: `canWriteValue:false`,
   `isTextMultiline:false`, `latitude/longitude:0`, `methodArgs:{}`, `more:{}`, `branches:{}`,
   `useArgNames:false`, the long `valueType` form with its nulls, and a lost `value` key on an empty
   string.
6. **Patching an existing script**: read the user's fresh copy, modify it, send it back — **never re-paste
   a whole script "just in case"**: it silently reverts every edit the user made in the IDE since your
   dump, and locate anchors by SHAPE (`varName`, branch structure), never by id.
7. **Headless alternative — no clipboard, no user** `[C]` (2026-09-24), when you hold a session token of the
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
  `Переменная №N := …` are. `varName` is a free string: the naming convention (`~ref~`, `#entity#`,
  `|section|`) is literally part of the name, not an encoding.
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
- Boolean: `"constType":"Boolean"`, `value` `"yes"` / `"no"`. Both work `[C]`.
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
  `OrEq`, `AndNotEq` `[C]` compile, 2026-09-24; runtime `[U]`.
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

## 12a. The whole palette — read off the stand's own catalogue API `[C]` (2026-09-24, `<stand>`)

§12 was assembled from copies of real scripts, so it lists only what somebody happened to use. The IDE
builds every list it shows from six calls of `v2/script` (`MYBPM-UI-API.md` §5g «The catalogue
calls»), and those calls were walked exhaustively: every value type → every action on it → the type it
returns → the actions on that, down to the leaves. **This section is therefore the complete language
as of this build; anything not here does not exist.** The raw dumps sit in
`tools/out/ide-catalogue-2026-09-24/` (git-ignored — they contain stand codes).

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
`success:true`, 2026-09-24). Their runtime was not exercised on a record `[U]` — §15's advice to prefer
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
`field.#Добавить ошибку` (2026-09-24). A method call used as a statement is the same shape with an
`ExprCall` on the left.

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
hand before you write a checker from scratch: `strip_hat.py` (drop the method hat, re-point
`startBlockIds`), `check.py` (scope / dangling-reference / duplicate-variable / reachability checker),
`canon.py` + `live_cmp.py` (canonical id-free comparison of a generated fragment against a live copy),
`sim.py` (a formula simulator), `gen5.py` (a script generator built on this section), `canon-compare.bun.ts`.
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

### Validator phases — `translate-script` stops at the first failing phase `[C]` (2026-09-24)

Found by pasting a 750-block / 1848-expression scratch (every catalogue act once) into a hook. The server
checks in phases and **reports only the phase that fails** — an error list is never the whole story, fix and
re-check until `{"success":true}`:
1. **Script structure**: `noEntryPoint` «Нет точки входа» (a hook body needs the `BlockFixEntryPoint` hat in
   the fragment — it pastes fine into a hook) and `blockIf__allBranchMustReturn__orContinueDownWithReturn`
   (a hook must END with `{"type":"BlockExit","exitType":"FROM_METHOD"}` — put it `downBlockId` of the last
   top-level block). A variable whose type has no ext type (`getPrintForms` of a record) fails here too.
2. **Types**, all at once (17 in one list): a scalar added to / searched in a typed array
   (`illegalElementTypeForList`), `Readonly/Required/Shown -K-DYN-R-M-` need a user/department/group ref as
   argument, `SHOWN_BO_IN_CO_FIELD` needs a BO chosen as a CO attribute, `addFile_v2` wants a `File`, a
   filter kind not applicable to the field (`inapplicableFilter`), `sendToUsers` wants Person/PersonGroup/
   Department, the four `associateSingle*Ref*` of a spreadsheet tab need a reference main field.
3. **Read / write access, ONE error per run**: some properties are WRITE-ONLY — they may only stand on the
   left of `=` (`exprAct__readWayIsAbsent` «Нет действия на чтение у акта …») — and some are READ-ONLY
   (`exprAct__writeWayIsAbsent` «Нет действия на запись у акта …» when assigned). The catalogue carries NO
   read/write flag (`load-act-record-list` / `load-act-details` / the IDE bundle) — only this phase tells.
   Confirmed `[C]` (2026-09-24, every `RestRequest` property tested alone, as a write and as a read):

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
454 of the 476 catalogue acts — translates with `{"success":true}`** `[C]` (2026-09-24). The 22 acts that
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

### When each hook runs `[C]` (2026-09-24, `<stand>`, two probe BOs — one wired by archive, one by API)

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
  `2.0`. A Python `Decimal` simulator is scale-insensitive and can NEVER reproduce this — only the stand can.
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
- Native number actions have no error channel; a blow-up on huge arguments was only ever seen in a Python
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
5. Import WIPES `orgUnitIds` — group rights cannot be shipped and are re-wiped on every re-import.
6. Import may RENAME an existing BO group; multi-group archives misplace BOs (open defect).
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
    (`op_type`, `step_order`, `Multiply`, `Divide` were all wrong guesses). Since 2026-09-24 the palette
    need not be guessed at all: §12a is the complete catalogue, read off the stand.
26. **An enum value the server does not know bricks the BO** `[C]` (2026-09-24, a probe BO on `<stand>`).
    A script def is stored as sent — `apply-update-cmd` (and, by the same storage, an archive) wrote
    `"opType":"GreaterEq"` without complaint. From then on the server cannot decode the BO's script
    module: `translate-script`, `load-script-def`, `load-bo-scripts` of EVERY version (work included),
    `load-bo-script-versions`, `apply-update-cmd`, `undo`, `delete-local-method` and
    `remove-bo-script-version` all answer `IllegalArgumentException: No enum constant …OpType.GreaterEq`
    — so the bad value cannot be overwritten either. Other BOs are unaffected. No API repair was found;
    it needs the vendor (database). Hence: every enum-typed key (`opType`, `exitType`, `exprValueType`,
    `constType`, block/expression `type`, `varType`) takes ONLY a value listed in §10–§12a — a
    string-typed key (`actId`, `enumValue`, `varName`) is safe to get wrong, the validator reports it.
27. **A record written through the plain record API runs no script** `[C]` (2026-09-24) — hooks and field
    scripts run only inside the form controllers (`MYBPM-UI-API.md` §6b). Testing a hook with
    `save-boi-value` shows «nothing fired» and proves nothing.
28. **A test script version runs only on test (`DEV`) records** `[C]` — a freshly wired test version looks
    dead on ordinary records until `in-work-bo-script-version`.
29. **«Закрытие» writes into the saved RECORD, not into the draft being discarded** `[C]` — and it does not
    run on save. Do not use it to «undo» the form; do not expect it after СОХРАНИТЬ.

Records (Excel): the traps of that format live in `MYBPM-UI-API.md` §11 (8 — numeric cells, 9 — header
detection, 10 — never index columns by position, 13 — the SINGLE-side link column) and are not renumbered
here; the rules themselves are §0X.4.

## 18. Open questions

- Whether a `CHECKLIST`'s items can travel in an archive at all — an export writes no `fieldOptionsStruct`
  for them and an import brings none (2026-09-18, `MYBPM-UI-API.md` trap 42).
- What a signature's `fieldCodes` / `printFormCodes` and a button's `fieldCodes` bind to.
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
  `dimension` (the openpyxl traps are 19.9).

### 0X.2 Algorithm

0. **Ask for the stand data of 0X.3.** Without the template file itself there is nothing to fill.
1. **Take a FRESH template** — an export of the registry (registry kebab → «импорт/экспорт xlsx»), or
   `GET <stand>/web/v2/bo-transfer/download-template?businessObjectId=<boId>&selectedFieldIds=<…>`
   (a plain GET with the `token` header, no envelope `[I]`; more in `MYBPM-UI-API.md` §6).
   Columns follow the BO at export time and their positions move between exports.
2. **Build the column map by LABELS, never by position**: the (row-1 block, row-2 field) pair identifies a
   column. Split a row-1 label on the FIRST dot — the prefix is the tab («Системные.Код»).
3. **Fill the rows.** Values: checkbox `Да`/`Нет`; date `dd.mm.yyyy`; date-time `25.10.2025 10:33`; period
   `dd.mm.yyyy - dd.mm.yyyy`; a dropdown is matched by its LABEL; a reference by the target's unique field
   or by an `ID` sub-column. A TABLE nested object = the parent row REPEATED per child.
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

Absolute, no asking needed: numbers as text; never index by column position; never re-import a partial
file (blank-cell semantics are an unresolved destructive unknown, 19.6).

### 0X.4 Hard rules

1. Every cell `inlineStr`; no numeric cells, ever.
2. Frozen header rows (or the double bottom border) — else the whole file is rejected.
3. Resolve columns by the (block, field) label pair; a template from another day is a different layout.
4. Never write a column for the SINGLE side of a linked pair.
5. Never name a section heading («Текст») like a field of the same BO — `SameBoFieldsLabel` rejects the
   file while reading the header, and labels are matched across ALL fields regardless of tab.
6. A sub-column that is itself a nested reference must be omitted (`BoFieldNotSpecified`; the 2-level
   header for it is `[U]`).
7. Regenerate COMPLETE files; a missing column may clear the field on existing records (`[U]`, 19.6).
8. Dictionary codes are case-sensitive (`MRP` ≠ `mrp`).

### 0X.5 Self-check before shipping

- [ ] The file opens and every data cell is `inlineStr` (grep the sheet xml for `t="n"` — none).
- [ ] The header rows match the template byte-for-byte; merges and freeze survived the edit.
- [ ] Column map rebuilt FROM THE FINISHED FILE, not from the plan, and it matches the data model.
- [ ] No SINGLE-side link column; no `STATIC_TEXT` hint column (drop those by field TYPE, 19.2).
- [ ] Every dropdown value exists in its dictionary; every reference value exists on the stand.
- [ ] Row count equals what you promised, and the file order is written down for the operator.

### 0X.6 Delivering

UI: registry kebab → «импорт/экспорт xlsx». API: `v2/bo-transfer` (`MYBPM-UI-API.md` §6 and §0U R7,
`[I]` — read off the bundle, never executed; the UI route is the confirmed one). Either way the upload
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
  non-unique code.
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
  (`base62(sha256(seed))[:16]`, A-Za-z0-9) were accepted and kept. Platform ids are 16 chars and their
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

- **Blank-cell semantics are unknown**: a blank cell (or a column missing for a newly added field) may
  CLEAR the field on existing records → regenerate files with every column; an empty link/table cell might
  clear a link set earlier → avoid re-importing files with empty link columns.
- A parent's nested block that maps an existing child (by ID / unique field) may **overwrite the child with
  only the block's sub-columns, wiping the others**. Per the 2022 jar, sub-values run `saveImportInstance`
  on the referenced BO (found → UPDATED). Mitigation used in practice: child file → parent file →
  re-import the child file.
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
  `dimension ref`) and re-zipping every other member byte-for-byte imports fine.
- **Before handing a file over, read the xlsx BACK and rebuild the data model from its cells** (labels →
  codes) — this caught every error before the stand did.
- Hand-made files must reproduce the header format exactly (freeze A3 + merges).

### 19.9 Editing an xlsx with openpyxl — the traps `[C]` (same list: `MYBPM-UI-API.md` §9)

- The Excel table `displayName` must be Latin (`Table1`…) — a Cyrillic one makes Excel offer to «repair».
- `tableColumns` names must match the header cells exactly, else Excel «repairs» the file. When inserting
  columns, rebuild `tableColumns` by header name and extend the table `ref`, the autoFilter and the
  conditional-format `sqref`.
- **openpyxl does not widen an existing table**: after adding or removing rows update BOTH the sheet
  `dimension` and the table `ref` (e.g. `A1:D35`), otherwise Excel reports the table as broken. A
  hand-made sheet without a table part needs only `dimension`.
- openpyxl writes a Python number as a numeric cell (`t="n"` — «103» comes back «103.0» and breaks a
  lookup) and a `str` as a SHARED string, not `inlineStr`. Stand files use `inlineStr` only (0X.4 rule 1);
  whether the importer accepts shared strings was never tried `[U]` — the 19.8 technique (rewrite
  `sheet1.xml` yourself) avoids the question. Grep the sheet xml for `t="n"` before shipping.
- **openpyxl's save DROPS Google's `xl/metadata` part** → if it must survive, patch the XML inside the
  zip instead of loading the workbook (the 19.8 technique).
- Moving rows: move the values AND `row_dimensions[].height` together; `customHeight` has no setter —
  setting `height` is enough.
- Appended rows get no style — copy it from a sample row (stand rows have thin left/bottom borders;
  whether the importer cares about data-row borders was never tested, its header detection uses the
  freeze / double border of 19.1).

## 20. Open questions — records

- Which flag actually controls whether a field becomes an Excel export column (`tableColToShow`?).
- Blank-cell semantics on import (clear vs keep) — the single biggest destructive unknown.
- Whether a nested block overwrites the other fields of an existing child.
- Whether the importer writes into `isReadonly` fields, and whether it accepts sub-columns for fields
  hidden in the reference (`toShow: false`).
- The 2-level header format for a sub-column that is itself a nested reference (`BoFieldNotSpecified`).
- Person field labels beyond Фамилия / Имя / Email in the Excel format.
- The `v2/bo-transfer` cycle itself is unexecuted — only the UI route is confirmed (`MYBPM-UI-API.md` §6).
