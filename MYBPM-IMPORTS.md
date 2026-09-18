# MyBPM — what you feed a stand: archives, scripts, records

Every artefact that is BUILT OUTSIDE the stand and then loaded into it, and the exact format of each:

- **Part I — the structure archive `.mybpm.zip`** (§0 cookbook, §1–§8): business objects, fields, form
  layout, dictionaries, references, access rules, and the scripts an export carries (§5d). The SHAPE
  of things.
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

**Evidence base.** MyBPM v4.24, builds `4.24.25.570` (tenant <company-b>) and `4.24.25.614` (<company-c>
stand); facts collected 2026-08-27 .. 2026-09-16 from real exports, stand imports and IDE copies.
**Status markers** used throughout: `[C]` confirmed on a stand or in a real export, `[I]` inferred from
structure/behaviour but never isolated, `[U]` unverified — do not build on it without checking.
Everything retracted has been dropped; the mistakes worth not repeating live in *Traps and defects*.

**Reference material**
- Richest export: `<project>/MyBPM-export-<company-b>-v4.24.25.614-2026-09-15T16-55-04.mybpm.zip`
  (STATIC_TEXT, `isHeightDynamic`, `gridLayoutPosition`, `AccessStructDto`); older `.570` ones beside it;
  <company-a> exports in `~/Downloads` (the 05-29 one has no `AccessStructDto`); <company-c> stand exports in
  `<company-c>/Со стенда/`.
- In-house generator `~/programming/devhub/mybpm-core/cli/generate-mybpm-export.bun.ts`
  (FULL_DATE / FILE_UPLOAD shapes); type enum `ApiFormFieldType` in `the platform server sources`.
- Importer source: only an **old 2022 jar** exists — local docker `mybpm-api`,
  `/app/project/mybpm.register-<tenant>-0.0.20.jar`, decompile with CFR; structure import class
  `…register.impl.reports.structure.StructureMovement`. That build has no BO groups at all and its
  behaviour differs from v4.24 in at least one confirmed place (see *Instance-side note* below).
  **v4.24 sources are not available — a dead end, do not re-open it.**
- Records: the stand's own template/export is the only valid starting point (Part III); the <company-b>
  Scoring files and the <company-c> stand exports beside them are the worked examples.

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

- The folder name is `data-<timestamp>`; the timestamp is free-form (`YYYY-MM-DDTHH-MM-SS-mmm` is what
  real exports use). The **folder must exist** — the two members cannot sit at the zip root.
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
   BO group **that already exists on the target stand** (on <company-a> <stand> use `Бизнес-объект`).
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

**Every id literal printed in this section is <company-a>'s, not yours** `[C]`. Copying one out of an
example IS inventing an id — 0.2a forbids it exactly the same way, and it fails in the same silent manner.
Two different kinds of literal appear below: `3H84o9iM@G4jaOL3`, `ca3w3BgmzJGmWO7q`, `WbX5Wa8gcabbVbF1`,
`qmEhH4GnZvawC3R4` are archive-internal ids of the sample — mint your OWN by 0.7 instead of reusing them;
`I1fVTkYPTSg7X8b8` (<company-a>'s `Person`), `@feclOAWUnwXFQ8c` (a <company-a> composite) and `Q0zI~z9Ra2R7Q3yd`
(<company-a>'s «Статус процесса») are **real ids on the <company-a> stand** and appear here only to show the
SHAPE. Paste one into an `oldRefBoId` for any other stand and you ship a dangling reference that imports
«successfully» and breaks at runtime.

**A BO defined on ANOTHER LINE OF THE SAME ARCHIVE is not stand data — reference it, do not degrade it**
`[I]` (deduced from the `oldId` → real-id rule of 0.7 and §8; not yet re-checked on a stand). When your
own archive creates the target, you already know its id: you minted it. Write
`"oldRefBoId": "<that BO's own oldId>"` plus `boRefStruct.boInfo = {code, name, boCategory}` copied from
that same line, and put the referenced BO on an EARLIER line than the one pointing at it. The degrade of
the table's last row applies only when the target is NOT in this archive.

**A панель cannot be built at all without stand ids — say that, build nothing else.** Every
`dynamicFields` entry of a `BO_PANEL` is a `type: "BO"` registry widget and each one needs the
`oldRefBoId` of a BO that already exists on the stand (0.9, §5a). If those ids were not supplied and the
registries are not created by this same archive (rule above), there is nothing left to degrade — a panel
without registries is an empty panel. STOP, deliver no archive, and report which ids you need. In
particular **do NOT re-read «панель с реестрами X, Y, Z» as «создай бизнес-объекты X, Y, Z»**: that ships
a different KIND of object than the one asked for, and nothing in the file marks it as a substitution.

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
  "kanbanCardTemplates": {},
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
order undefined. The counter runs over `dynamicFields` alone; system fields (0.5a) and widgets (0.5b) do
not carry the key and do not advance it.

**To make a field required or unique, write `true` in `isRequired` / `isUnique`. To turn something off,
write `false` — never delete the key** (§8: a dropped key keeps the stand's old value).
`isRequired` and `isReadonly` must never both be `true` — such a record cannot be saved (the constructor
greys the second checkbox out as soon as the first is ticked). Both flags survive an import unchanged
`[C]` (2026-09-18) and behave on the stand exactly as a constructor-built flag: an empty required field is
refused with «Обязательные поля не заполнены», a duplicate unique one with «Продублировано уникальное
поле». A UI-built BO ALSO carries `tableColToShow: true` on every required/unique field (the constructor
sets it automatically) — copy that if the archive should reproduce a stand-built registry.
A `DROPDOWN_SINGLE` additionally needs `fieldOptionsStruct` (§5) — a dictionary by CODE, or a local list.

**The ONE documented exception to «never drop a key» is the composite.** A `BO_COMPOSITE` has no form, so
its fields carry no `gridPosition`, no `tableColOrderIndex` and no `removeType` (0.9, §5b) — an archive
built without exactly those three is verified to import `[C]`. Nowhere else may a key of this template be
absent.

Types you may put in `"type"` — this is the WHOLE palette of «Элементы страницы», 23 types, verified
type by type on <company-a> 2026-09-18 (`[C]`: each one was created through the constructor API, exported,
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
<company-a>'s — they show the shape, they are not values to copy** (0.2a).

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
| Справочник | `BO_DICTIONARY` | `"dictionaryFields": ["CODE","LABEL"]`, and `dynamicFields` **starts** with the two system fields below; extra fields may follow |
| Панель | `BO_PANEL` | every entry of `dynamicFields` is a `type: "BO"` widget (extra keys in 0.5) with `"isReadonly": true`, `"isKindAddForSelect": true`, `"rows": 6`+ — each one needs an `oldRefBoId` off the stand, so **with no ids a panel cannot be built at all** (0.2a) |
| Составной объект | `BO_COMPOSITE` | `"bos": [{"code","name","boCategory"}]` = the source BOs **by code, read off the stand**; every field carries `"boFieldCodes": [{"boCode","fieldCode"}]` (one link = простой атрибут, two+ = составной) and **no** `gridPosition` / `tableColOrderIndex` / `removeType` |
| Бизнес-процесс | `BO_PROCESS` | a **third line** `BoProcessVersionsStructDto` (§5c) whose `oldId` = the BO's `oldId`; the importer does NOT create `PROCESS_STATUS`, ship that field yourself |

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
  And never paste <company-a>'s `Q0zI~z9Ra2R7Q3yd`.

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
12. A field goes into the map that matches its ARCHETYPE: an ordinary field into `dynamicFields`, a
    «системное поле» into `nativeFields` (0.5a), a widget into `signatures` / `buttons` / `iframes` /
    `captcha` / `currentDates` / `currentUser` (0.5b). Putting a widget or a native type into
    `dynamicFields` is not a valid archive.

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
- [ ] No id literal was copied out of this document — the sample's ids are <company-a>'s (0.2a).
- [ ] Nothing was quietly built INSTEAD of what was asked: no panel turned into a set of plain BOs, no
      `PROCESS_STATUS` faked as a local dropdown (0.2a, 0.9).

### 0.12 Building and delivering

Ready-made generator, already verified on a live stand — prefer it over writing a new builder:

```
bun tools/make-probe-archive.bun.ts --code Cookbook_demo --name "Демо из кукбука" \
    --field "Наименование:INPUT_TEXT" --field "Сумма:INPUT_NUMBER" --field "Активен:CHECKBOX"
```

(`--category`, `--field "Метка:BO@<boId>@<boCode>"`, `--source` / `--co-field`, `--process-figure`,
`--process-status`, `--with-metadata`, `--out` — see the file's header comment and §5a–5c.)

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

`I1fVTkYPTSg7X8b8` and `@feclOAWUnwXFQ8c` in that command are **ids ON THE <company-a> STAND** — `Person` and
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

Ship it to a stand through the UI or the `/web/import-structure/*` API — routes, the analysis step and
the error dialogs are in `MYBPM-UI-API.md` §5; `tools/api-import-structure.bun.ts` does the API route.
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
  `AccessStructDto` / `ScriptDef` optional (absence of the access DTO = default access). A one-BO export
  = 3 lines + its `AccessStructDto` if any. `[C]`
- `CompanyMetadataStructDto` carries the company ids `personBoId`, `departmentBoId`, `personGroupBoId`
  (different per company — read them from a stand export). It has **no** stand host/URL, so record the
  stand URL in project memory. Copying another company's CompanyMetadata ids (<company-b> → <company-c>)
  imported fine. `[C]`
- **`CompanyMetadataStructDto` is OPTIONAL** `[C]` (<company-a> <stand>, 2026-09-18): a hand-made **2-line**
  archive (`BoGroupStructDto` + `BoStructDto`, `objectCount-2`, no access DTO) was analysed with an empty
  error list and applied — the BO was created with both fields. Ship the line only when the archive
  actually references Person/Department/PersonGroup.
- **Group `oldId`/`newId` are generated at EXPORT time, not stable ids** `[C]`: the same <company-a> group
  «Тест» carries `ICHLTlIHbLLBzxoI`, `wNARkY1IRHHtHbv9`, `fKsRKOK@JrbB@UM6`, `LEl3hxwYMOiuY7Fa` in four
  exports; «Матрицы» changed between builds too. So `boGroupOldId` only ties the lines of ONE archive
  together, and the importer cannot be matching groups by it — see §8.
- **The stand keeps the archive's `oldId` as the BO's real id** `[C]` (<company-a> 2026-09-18: the generated
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

- **Only the objects selected at export time.** A one-BO export holds that BO alone; 17 <company-b>
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
`AccessStructDto` (§7) and `ExportStructInstanceDto` record lines (§5, §5c).

An export also starts with a `CompanyMetadataStructDto` line — `{personBoId, departmentBoId,
personGroupBoId}` — which on <company-a> is `I1fVTkYPTSg7X8b8` / `4cQAePlhkxrCGMW6` / `O5d@0F1zrMUmpkUt`
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
  `staticValue.rus` (sanitizer rules → `MYBPM-UI-API.md`). 15×3 showed the platform's own scrollbar inside
  the band for "heading + subheading" → use **15×4** or more. `hideLabel:true` avoids the field label
  duplicating the heading (whether import applies it was never reported `[U]`).
  **A section heading must not repeat any field name of the BO — it breaks Excel import** (`SameBoFieldsLabel`).
- **Tabs**: one `TAB_GROUP` field (code `Vkladki` in exports) with `fieldTabs` (tab codes + labels);
  fields on a tab carry `tabCodePath{tabGroupCode, tabCode}`. `boTabs` can stay `{}` while tabs exist `[C]`.
  Fields outside tabs coexist with a tab group in the same BO. Tab order = `fieldTabs` order; the first
  tab is the default. A tab group whose only tab is a service tab can sit UNDER the ordinary fields
  (<company-b> does this with its `system` tab) instead of opening the form.
- **Record window**: `BoStructDto.gridLayoutPosition` `{x,y,w,h,id:"0"}` is the record WINDOW on a
  ~16-column SCREEN grid, not the form; `null` for dictionaries. All four occurrences ever seen:
  `{x:1,w:15,h:21}`, `{x:1,w:15,h:18}` (top-level BOs), `{x:3,w:11,h:18}` / `{x:3,w:10,h:28}` (BOs opened
  only from a parent's table). `h` is not the form's row count (a 37-row form scrolls inside an 18-unit
  window); 28 is the largest ever seen — treat it as a cap and probe before going higher `[U]`.
  Import appears to apply it `[I]`.

## 5. Dictionaries (справочники)

- `category: BO_DICTIONARY`, `dictionaryFields: ["CODE","LABEL"]`, system fields `code` (`INPUT_TEXT`,
  `isSystem`, `isUnique`) and `label` (`INPUT_TEXT_LANG`).
- A dictionary MAY carry extra fields (<company-b> `Tax_base`: `lower_limit`, `fixed_amount`, `rate`,
  `starting_price`); 15 of 21 keep the plain code/label shape.
- **A hand-built dictionary archive imports cleanly** `[C]` (2026-09-18, <company-a>): the three keys above
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
  <company-b> export AND round-tripped — a hand-built archive with both kinds imported into <company-a> and
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

## 5a. Panels (панели) `[C]` (2026-09-18, <company-a>)

- `category: "BO_PANEL"`, everything else the shape of a plain BO — no panel-specific key anywhere in
  `BoStructDto` (`dictionaryFields: []`, `nativeFields: []`, `boTabs: []`, `bos: []`).
- **A panel's content lives in `dynamicFields` as `type: "BO"` entries** — registry widgets. Per entry:
  `oldRefBoId` (the target BO), `boRefStruct.boInfo{code,name,boCategory}`, `viewType: "TABLE"`,
  `isKindAddForSelect: true`, `isHeightDynamic: true`, `isReadonly: true`, `gridPosition.rows: 6`+.
  A hand-built archive with just those keys imports and the stand resolves `oldRefBoId` to a live BO
  (`tools/make-probe-archive.bun.ts --category BO_PANEL --field "Метка:BO@<boId>@<boCode>"`).
- What a REAL panel adds on top (<company-a> «Главная», `Glavnaya`): `boRefStruct.fieldRefs` — one entry per
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
  nested DTO. They are not carried in the archive: the importer looks them up **on the stand, by code**
  `[C]` (2026-09-18, both import routes) and writes the real `boId`s into the live `links`.
  - **`name` is not used for matching** — only `code` is. A code that matches nothing makes the analysis
    fail with **«В Составном объекте не достаёт БО»** in the «Ошибки» tab (`load-import-errors` is empty
    for it in the API route — the error surfaces only in the UI dialog `[U]`), and **ПРИМЕНИТЬ is not
    blocked by it**; drop the import instead of applying a composite with a missing source.
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
  declares. Both routes verified end to end on <company-a> (`MYBPM-UI-API.md` §5e).
- The import dialog labels the node **«Составной объект/<имя>»** and lists the attributes under
  «Добавленные поля» like any other BO; `load-import-bo-infos` returns `boCategory: "BO_COMPOSITE"`.

## 5c. Business processes (бизнес-процессы) `[C]` (2026-09-18, sample `MyBPM-export-<company-a>-v4.24.25.430-2026-03-22T17-05-29.mybpm.zip`, both import routes on <company-a>)

A business process is **two lines in the archive**: an ordinary `BoStructDto` with
`category: "BO_PROCESS"`, plus a **`BoProcessVersionsStructDto` whose `oldId` is the BO's own `oldId`** —
that field is the only link between them. The <company-a> sample carries 7 objects:
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
  «Статус процесса» dictionary — <company-a> `Q0zI~z9Ra2R7Q3yd`) — an archive must ship that field itself.
- The two `ExportStructInstanceDto` in the sample are RECORDS, not structure: one row of the
  `PROCESS_STATUS` dictionary (`CREATED` / «Только что создан»), and a `Coordinate` instance whose
  `sources: [{sourceType: "PROCESS", processInstanceSource: {boCode, isWork}}]` ties it to the process.
  Neither was needed to import a working process.
- **Generator**: `tools/make-probe-archive.bun.ts --category BO_PROCESS` emits both lines; it always puts
  an `Enter` at (100,100) and chains `--process-figure "<Type>[@x,y]"` (repeatable, default a single
  `Exit@440,104`) after it with `main → main` arrows, and `--process-status <refBoId>` adds the
  `PROCESS_STATUS` field in the export's own shape. Both routes verified on <company-a>
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
  Добавление новой записи / Закрытие» `[I]` for the name↔label mapping,
  `onOpenFormScriptId` / `afterSaveScriptId` / `onInstanceCreationId` / `onCloseScriptId`.
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

### The reverse works too: an archive CREATES scripts on import `[C]` (2026-09-18, <company-a>)

Probe: «Проба скрипт архивом 2026-09-18» (`Proba_skript_arhiv_20260918`, stand id `ZR1XPYi5C3zqho@w`,
fields `Naimenovanie` / `Kod`), a 6-line archive — `CompanyMetadataStructDto` + `BoGroupStructDto` +
`BoStructDto` + `BoScriptVersionsStructDto` + 2 × `ScriptDefStructDto` — built by
`tools/make-probe-archive.bun.ts` and post-processed by `tools/add-bo-scripts.bun.ts`, applied through
`tools/api-import-structure.bun.ts`. The two bodies were LIFTED VERBATIM out of the <company-b> export
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
  version 1 stays with `isWork:false`. **Read back the module id AFTER every import** (§5g of
  `MYBPM-UI-API.md`) — translating the old module shows the old body and looks like the import failed.
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

## 6. References between BOs

- Type `BO`, `viewType` SINGLE / TABLE / MULTIPLE, `oldRefBoId`, `boRefStruct{boInfo, fieldRefs,
  linkedFieldCode}`. A two-way link is a SINGLE↔TABLE pair joined by `linkedFieldCode`.
- **`oldRefBoId` ≠ the target's `oldId` is NORMAL** (every reference in <company-b> mismatches) — not a bug.
- **M:N (TABLE↔TABLE)** has never been seen in any export; how to express it is unknown `[U]`.
- `fieldRefs` = the reference's display config («Выбрать поля для отображения»):
  `{fieldCode: {toShow, orderIndex, gridPosition}}`. In real exports the gridPositions are a flattened
  copy of the TARGET BO's layout; a synthetic non-overlapping stack imports fine. `fieldRefs` does **not**
  resolve Excel references (that goes through the target's unique field) but it **defines the Excel
  sub-columns**.
- How the stand serializes a hand-made linked pair: the SINGLE side lists the linked field in `fieldRefs`
  as `{"gridPosition":{…}}` with no `toShow` and `tableColToShow:false`; the TABLE side does **not** list
  the linked field and has `isKindAddForSelect:false`. <company-b>'s SINGLE side additionally carries
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
- Semantics, read off <company-b> rather than documented `[I]`: `denyAll:false` = «всем»;
  `denyAll:true` + empty `orgUnitIds` + all-false `authorsField` = «никому»; `denyAll:true` + ids and/or
  `author:true` = «только этим». The struct's **top-level** `denyAll` is a "custom rights are set" flag,
  not a global deny (every <company-b> BO has it true while its actions stay open).
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
- BOs created via import carry `kanbanCardTemplates:{}`; a BO built by hand with a kanban has entries —
  and kanban is broken for imported BOs (`MYBPM-UI-API.md`).

### BO groups on import — open defect `[C] symptom, [U] cause`

Symptom (<company-c>, 2026-09-16): an archive with 2 groups («Цели и задачи» + 6 BOs, «Справочники» + 11
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
- **Does NOT fire for a single group whose `name` equals an existing stand group** `[C]` (<company-a>,
  2026-09-18): a 1-group/1-BO archive naming the group «Бизнес-объект» (the group already on the stand)
  created the BO **inside that group**, and the two BOs already there kept their group and its name.
  This is the safe recipe for a probe import: **one** `BoGroupStructDto`, its `name` copied verbatim from
  an existing stand group. Checked afterwards in the constructor (`MYBPM-UI-API.md` §5): all 14 <company-a>
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
`THIS_PROCESS` (IDE: `ЭТОТ_ПРОЦЕСС`) is the process's own record — only in a process script.

```json
{"opType":"Concat","leftExprId":"<expr>","rightExprId":"<expr>","type":"ExprOp"}
{"opType":"Concat","leftExprId":"<expr>","rightExprId":"<expr>",
 "more":{"<id>":{"opType":"Concat","order":10,"exprId":"<expr>"}},"type":"ExprOp"}
```
Binary operator; a third and further operand go into `more`, applied after left/right in `order`.
**Allowed `opType`s — there are no others you may use**: `Plus`, `Minus`, `Mul`, `Div`, `Concat`, `Eq`,
`NotEq`, `More`, `Less`, `And`. (`Or` and `Not` exist in the IDE palette but their names were never
captured — write disjunction as nested `ЕСЛИ`, negation as the `ИНАЧЕ` branch. There is no `>=`/`<=`:
`a >= b` is «ЕСЛИ a < b : нет ИНАЧЕ : да».)

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

There is no `indexOf`, no `ceil`, no «strip trailing zeros», no string→case folding. If the algorithm
needs one of those, build it out of the actions above.

### 0S.9 Twelve rules — each of these has silently broken a real script

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
7. Ready-made checker (it encodes 1–6, in Russian):
   `python3 "<project>/block-ide-v5/генератор/check.py" <file.json>` → `проблем 0`. Beside it:
   `strip_hat.py` (0S.12), `canon.py` + `live_cmp.py` (id-free comparison of your file with the copy the
   user sends back), `sim.py` (the Scoring formula simulator). Reuse them instead of writing new ones.

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
- `Or`, `Not`, `≥`, `≤` exist in the IDE palette (user screenshots) but their opType names were never
  captured `[U]` — generated code uses nested IFs / else branches instead.
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
#Содержит     F-contains-K-FIX-T-String                        arg fragment — [U], never seen in a copy
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

`#Чётное ли?` was never captured. Natives accept any BigDecimal (`7,5.#не чётное ли?` was accepted).

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

Under `~/programming/MyBPM/<project>/block-ide-v5/генератор/` (written for that project, reusable):
`strip_hat.py` (drop the method hat, re-point `startBlockIds`), `check.py` (scope / dangling-reference /
duplicate-variable / reachability checker), `canon.py` + `live_cmp.py` (canonical id-free comparison of a
generated fragment against a live copy), `sim.py` (the formula simulator), `gen5.py` (the script generator
of the Scoring engine); `canon-compare.bun.ts` sits one level up in `<project>/`. Reuse them before writing
a new checker — every rule in this section is already encoded in one of them.

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
- `Or` was never seen working `[U]` — write disjunction as nested IFs.
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
    (`op_type`, `step_order`, `Multiply`, `Divide` were all wrong guesses).

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
- opType names for `Or`, `Not`, `≥`, `≤`; the `#Содержит` and `#Чётное ли?` actIds.
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
  `dimension` (§9 of `MYBPM-UI-API.md` has the openpyxl traps).

### 0X.2 Algorithm

0. **Ask for the stand data of 0X.3.** Without the template file itself there is nothing to fill.
1. **Take a FRESH template** (`download-template`, or an export of the registry — `MYBPM-UI-API.md` §6).
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

## 20. Open questions — records

- Which flag actually controls whether a field becomes an Excel export column (`tableColToShow`?).
- Blank-cell semantics on import (clear vs keep) — the single biggest destructive unknown.
- Whether a nested block overwrites the other fields of an existing child.
- Whether the importer writes into `isReadonly` fields, and whether it accepts sub-columns for fields
  hidden in the reference (`toShow: false`).
- The 2-level header format for a sub-column that is itself a nested reference (`BoFieldNotSpecified`).
- Person field labels beyond Фамилия / Имя / Email in the Excel format.
- The `v2/bo-transfer` cycle itself is unexecuted — only the UI route is confirmed (`MYBPM-UI-API.md` §6).
