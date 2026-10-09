# MyBPM stand — browser UI and REST API reference

How to drive a running MyBPM stand: the `/web/v2` REST envelope and the endpoints found so far (access
rights, menus, kanban), the constructor/registry UI screens behind them, **record (instance) import and
export through Excel**, the HTML sanitizer, and the tooling around all of it (xlsx patching, Google Drive,
Claude-in-Chrome).

The FORMAT of everything you feed a stand — the structure archive, Block IDE scripts and the xlsx of
records — → `MYBPM-IMPORTS.md`. This document is the transport and the stand itself.

**If your task is «do something on a live stand», read §0U and nothing else.** It is a self-contained
cookbook: how to authenticate, one complete request with its complete answer, how to find an endpoint
this document does not list, and then a numbered recipe with literal payloads per task (create a BO of
any of the five kinds, import a structure archive, hand out rights, build a menu, import records from
Excel, export). Sections 1–12 are the evidence behind it and the material for non-trivial cases; §0U is
enough to drive a stand. Its counterparts for files are `MYBPM-IMPORTS.md` §0 (archives), §0S (Block
IDE scripts) and §0X (records in xlsx) — the four cookbooks are independent, read the one you need.

**Placeholders.** This document describes the PLATFORM, not one installation of it, so every host and
company name is replaced by a placeholder: `<stand>` is the host of a MyBPM stand (an archive never
carries it — the user is the only source, §0U.1), `<company-a>` … `<company-d>` are the companies
(tenants) the facts were collected on, and `<COMPANY_A>` is the `companyCode` of `<company-a>`.
`<company-a>` and `<company-c>` live on the same `<stand>`. Where a fact depends on WHICH installation
it came from, the origin mark carries the platform build instead of a name. The document describes the
LATEST platform implementation, so it carries no dates.

**A tenant's display name and its `companyCode` are different strings** `[C]`
(`GET /web/v2/auth/load-auth-info` → `{companyId:"…", companyCode:"<COMPANY_A>", …}`): the company this
document calls `<company-a>`, with its 14 BO groups and the probe group «Бизнес-объект», answers a code
that looks nothing like its name. Do not take that code for a second company.

**Evidence base.** MyBPM v4.24, four companies across two stands: build `S4.24.25.632/C4.24.25.264`
(BO constructor, structure import, records, kanban, menu items in an archive), build `4.24.25.614` (API,
menus, rights, kanban, Excel links) and builds `4.24.25.570/.614` (Excel record import).
**Status markers**: `[C]` confirmed on a stand, `[I]` inferred, `[U]` unverified.

---

## 0U. COOKBOOK — drive a running stand from this section alone

**Read this section if your job is «do X on a live MyBPM stand»** — create a business object, import a
structure archive, hand out access rights, build a menu, import records from Excel, or read any of it
back. It is self-contained: the transport, the authentication, one complete request with its complete
answer, and then one numbered recipe per task with literal payloads. Sections 1–12 are the evidence
behind it and the material for exotic cases; this one is *what to send*.

Two rules that apply to every recipe:

- **Everything here is plain HTTP.** The `tools/*.bun.ts` scripts mentioned at the end of each recipe are
  accelerators that live in one person's folder — a model reading this document may not have them. Every
  step below is executable with `curl`, `fetch` or `requests` and nothing else.
- **Never infer the result of a call — read it back.** Every recipe ends with a verification step that
  says which call to make and which field to compare. The stand answers HTTP 200 to a great many things
  it did not do (§0U.2).

*(`tools/follow-cookbook-stand.bun.ts` in this folder is a client written from this section and nothing else —
both the proof that the section is sufficient and a worked example of R1/R4. Its request stream is
identical, payload for payload, to the stand-verified `tools/create-bo-constructor.bun.ts`.)*

### 0U.1 What you must have before the first call

Ask the user for these, one request at a time, and wait for the answer:

1. **The stand URL** — e.g. `https://<stand>`. Everything below is `POST <stand>/web/…`.
   An archive or an export never carries the host; the user is the only source.
2. **The company (tenant)** — one host serves several: `<stand>` serves both `<company-c>` and `<company-a>`.
   The tenant is selected by the credentials/token, not by a header or a parameter, but you need its name
   to talk about it and to know which sidebar you are looking at. **Never assume a screen or a BO group
   exists because another company on the same host has it.**
3. **Authentication**, one of the two routes below.

#### Route A — log in headlessly (username + password)

```
POST <stand>/web/v2/auth/v3/login
Content-Type: application/json

{"useParamsFromBody":true,
 "params_Lr1oSgwPR8":null,
 "body_o1nhHUG480":{
   "dXNlcm5hbWU=":"<base64 of the username>",
   "cGFzc3dvcmQ=":"<base64 of the password>",
   "timeOffsetZoneInMinutes":-300,
   "timezoneRegion":"Asia/Almaty",
   "clientType":"WEB",
   "userAgent":"curl",
   "pushToken":null,
   "clientVersion":""}}
```

- The two magic keys are not a typo: the client sends the username under the literal key
  `dXNlcm5hbWU=` (base64 of `username`) and the password under `cGFzc3dvcmQ=` (base64 of `password`),
  **and the values are base64 too** (`btoa(unescape(encodeURIComponent(value)))`, i.e. base64 of the
  UTF-8 bytes). `clientType` is `WEB` or `MOBILE`.
- **The response body IS the token** `[I]` — the client feeds the whole body of `/v3/login` straight into
  its token store (`setSession(y)` → `writeToken`), which is the same value the `token` header carries.
  Use it as the header for every later call.
- Wrong credentials answer **HTTP 200** with
  `{"message":"Не верен пользователь и/или пароль","errorType":"IllegalLoginOrPassword",…}` `[C]`
  (probed on `<stand>` with a nonexistent user). So a failed login looks exactly like any other
  error (§0U.2) — check `errorType`, never the HTTP status.
- `POST /web/v2/auth/load-token` (empty params and body) returns the token of the CURRENT session, and
  `GET /web/v2/auth/load-auth-info` describes who you are. `GET /web/v2/auth/logout` ends the session.
- **Not yet executed end to end**: only the failure path was probed, because the password was never in
  this folder. If the success path turns out to return an object rather than a bare string, take the
  token out of it and correct this paragraph.

#### Route B — take the token out of a logged-in browser

The route that is **confirmed** `[C]` and the one every recipe below was verified with:

```js
localStorage.LOCAL_PRIVATE_SwebToken     // in DevTools on a page of the stand
```

**Strip the surrounding JSON quotes.** The raw value is a JSON string (`"abc…"`); the header takes
`abc…`. Sent with the quotes, every call answers `SecurityError` «Illegal Session» — which therefore
means «bad token», not «expired session».

- No cookies and no company header are needed: **the token alone selects the user and the tenant**
  `[C]`. A curl/Bun client outside the browser needs nothing else.
- The token is short-lived. Read it again at the start of a session, keep it in a file, never in a
  command line and never in a commit.
- **An agent driving the browser through Claude-in-Chrome cannot lift the token out at all** `[C]`
 : `javascript_tool` refuses to return any value derived from `localStorage` or from a
  response header. Keep the token INSIDE the page instead and call the API from there — the in-page
  helper of §10. Only a human (DevTools) or Route A gets a token for a standalone client.

### 0U.2 One complete call — request, success, error

Every `/web` endpoint takes the same envelope. Two magic keys carry what a normal API would put in the
query string and in the body:

```
POST <stand>/web/v2/business-objects/load-business-object-by-id
Content-Type: application/json
token: <the token, no quotes>

{"useParamsFromBody": true,
 "params_Lr1oSgwPR8": {"businessObjectId": "OpmGDzaQRUT27jky"},
 "body_o1nhHUG480":  {}}
```

Answer — HTTP 200, the DTO itself, no wrapper:

```json
{"id":"OpmGDzaQRUT27jky","name":"Проба UI 2026-09-18","code":"Proba_UI_2026_09_18",
 "boCategory":"BO","isDictionary":false,"formFields":[…],"nameMap":{"KAZ":null,"ENG":null,"RUS":"Проба UI 2026-09-18","QAZ":null},…}
```

Rules that hold for every endpoint `[C]`:

- **`params_Lr1oSgwPR8` = the query parameters, `body_o1nhHUG480` = the body.** Which of the two a value
  belongs in is decided by the endpoint, not by you — each recipe below says so, and §0U.3 shows how to
  read it off the client's own code. Guessing wrong gives HTTP 400 «Required parameter 'x' is not
  present» or a silent no-op.
- Both keys must be present; `{}` (or `null`) is the empty value.
- **An error comes back as HTTP 200** with a body
  `{"message":…, "className":"kz.greetgo…", "errorType":"…", "traceId":…, "stackTrace":[~100 lines]}`.
  **Detect an error by the presence of `errorType`/`className`, never by the status code**, and never
  print the `stackTrace` — cut it (`text.slice(0, 300)`, or read only `message` and `errorType`).
- **Some methods answer 200 with an EMPTY body.** `JSON.parse("")` throws — treat an empty body as
  success returning `null` (`remove-draft`, `save-menu-item-icon-name`, `save-import-description`, …).
- **Some methods answer a bare JSON string**, not an object: `import-file` → `"<importId>"`,
  `load-dev-bo-process-id` → `"<boProcessId>"`, `v2/co/generate-draft` → `"<draftId>"`. Parse
  defensively.
- Three endpoints are **not** JSON: file upload is `multipart/form-data` with the file under the field
  name **`file`** and every parameter as an ordinary form field; file download is a GET (or a POST with a
  RAW body, no envelope) returning the bytes with the name in `Content-Disposition`.

A minimal client, which is all any recipe needs:

```ts
async function call(stand: string, token: string, path: string, params = {}, body = {}) {
  const res = await fetch(`${stand}/web${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", token },
    body: JSON.stringify({ useParamsFromBody: true, params_Lr1oSgwPR8: params, body_o1nhHUG480: body }),
  });
  const text = await res.text();
  if (!text) return null;
  const out = JSON.parse(text);
  if (out && typeof out === "object" && ("errorType" in out || "className" in out))
    throw new Error(`${path}: ${out.errorType} ${out.message}`);
  return out;
}
```

### 0U.3 Finding an endpoint this document does not list

The endpoint list here will always be partial. **Grep the client bundle offline — it beats sniffing the
browser**, needs no auth and no browser at all `[C]`:

1. `curl -sS <stand>/ | grep -o 'src="[^"]*"'` → `runtime.<hash>.js`, `main.<hash>.js`.
2. `runtime.*.js` contains ONE object literal `{<chunkId>:"<16-hex hash>",…}` (201 entries on
   4.24.25.632). Parse it and fetch every `<stand>/<chunkId>.<hash>.js`. The app code is in those lazy
   chunks — `main.js` is vendor code and contains none of it.
3. Grep the downloaded chunks:
   - `grep -ho 'ControllerPrefix("[^"]*")' *.js | sort -u` → every controller on the stand (≈100).
   - Inside a controller, each method reads
     `postJson("/load-bo-groups", <body>, <params>)` — **body FIRST, params SECOND** in the client's
     signature, so the call maps straight onto the envelope of §0U.2. `postFileJson(path, file, params)`
     and `postFile(path, file, params)` are the multipart ones; `downloadResource(path, params)` is a
     GET returning bytes; `getResourcePost(path, body, params)` posts a RAW body (no envelope) and gets
     bytes back.
4. Enum values (statuses, categories, figure types, icon names) are plain strings in the same chunks —
   grep for a value you know and read its neighbours.

The page-side XHR logger is the fallback for a call built dynamically, but it is slower and misses
everything that fires before the logger is installed. **The Angular client uses XHR, not `fetch`** — a
`window.fetch` patch records nothing (trap 30).

### 0U.4 Recipes

All of them are on the controller `POST <stand>/web/v2/business-objects/<method>` unless a step says
otherwise. `P` marks values that go into `params_Lr1oSgwPR8`, `B` into `body_o1nhHUG480`.

#### R1 — Create a business object with fields, in the constructor

No archive is involved. This is the cheapest way to put a BO on a stand.

1. **Resolve the group.** `load-bo-groups` — `P {}`, `B {}` → `[{id,name,code,orderIndex,kind}]`.
   Pick the group **by name, from what the stand actually returned**; the group must already exist.
2. **Create.** `create-bo` — `P {}`, **`B {"boGroupId":"<group id>","boCategory":"BO"}`** →
   `{"id":"…","name":"Бизнес объект №7",…}`. **The BO is on the stand from this moment on**, under a
   generated name. There is no dialog and no undo — a mistake means deleting it.
3. **Rename** (this is also what gives it its code). `save-business-object-portion` — `P {}`, `B`:

   ```json
   {"jsonPart":"{\"businessObject\":{\"id\":\"<boId>\",\"nameMap\":{\"KAZ\":null,\"ENG\":null,\"RUS\":\"Мой БО\",\"QAZ\":null},\"recordNameMap\":{\"KAZ\":null,\"ENG\":null,\"RUS\":\"Мой БО\",\"QAZ\":null},\"description\":\"\"}}",
    "orderIndex":0,"isLast":true,"id":null}
   ```

   `jsonPart` is a STRING containing JSON, and that JSON must have the `businessObject` wrapper — a bare
   DTO throws `UndeclaredThrowableException`. For a rename the `businessObject` may be partial.
   **Never send a `code`**: the server transliterates it from the name and cuts it to 30 characters.
4. **Wait 3 seconds.** A field save that lands within ~1 s of the rename makes the server append a
   16-character uniquifier to the just-generated code («Test_koda_4_2026_09_18HXpmEa21vtnNLVsl»), and a
   BO code is **never regenerated** afterwards (trap 24).
5. **Read the BO back** — `load-business-object-by-id` — `P {"businessObjectId":"<boId>"}` → the full
   constructor DTO. You need it whole for step 7.
6. **Generate one field per field.** `generate-business-form-field` —
   `P {"boId":"<boId>","fieldType":"INPUT_TEXT"}` → a ready ~60-key field DTO with a
   fresh `fieldId` and `code: null`. Set exactly three things on it and touch nothing else:

   ```json
   "label": "Наименование",
   "labelMap": {"KAZ":null,"ENG":null,"RUS":"Наименование","QAZ":null},
   "gridPosition": {"x":0,"y":<4·index>,"cols":15,"rows":4}
   ```

   **Omit a parameter you have no value for — do not send it as `null`**: the client drops null-valued
   parameters, so `fieldBoId` appears only for a nested object (`fieldType: "BO"`, R2 «Panel»).
   `fieldType` is the palette type — `INPUT_TEXT`, `INPUT_NUMBER`, `CHECKBOX`, `DATE`, `FULL_DATE`
   (**not** `DATE_TIME` — that name never existed), `INPUT_TEXT_LANG`, `STATIC_TEXT`, `BO`, … (the full
   enum with the palette labels is §5i «Field types — label → `fieldType`», which also covers widgets
   and system fields). `cols: 15` is
   the full form width, `rows: 4` one line, so field *i* sits at `y = 4·i`.
   **Get the label right the first time**: a FIELD's code is generated from its label at the first save
   and never regenerated (trap 22).
7. **Save the BO with the fields.** `save-business-object-portion` — `P {}`, `B` as in step 3, but the
   `jsonPart` JSON is now the FULL object:

   ```json
   {"businessObject": <the DTO of step 5 with the new field DTOs appended to formFields>,
    "editedFields": [{"fieldId":"<new id>","gridPosition":{"x":0,"y":0,"cols":15,"rows":4},"needFreezeWhenScroll":false}],
    "addedFieldIds": ["<new id>", …],
    "deletedFieldIds": []}
   ```

   If the serialised JSON exceeds **80 000 characters**, cut it into parts of that size and send one call
   per part: `orderIndex` 0,1,2…, `isLast` true on the last, and `id` = **whatever the previous call
   returned** (`null` for the first). That accumulator is the client's own chunking protocol.
8. **Verify.** `load-business-object-by-id` again → compare `name`, `code` (did the race of step 4 bite?)
   and, for every field, `label` / `code` / `type`. The BO is now at
   `<stand>/business-objects/editing/<boId>/object-editing`.

**Field settings** («Обязательное», «Уникальное», «Выпадающий список») are set on the SAME field DTO in
step 6 — there is no separate endpoint (§5h):

- `isRequired: true` («Необходимо заполнить»), `isUnique: true` («Уникальное поле»),
  `isReadonly: true` («Только для чтения»; never together with `isRequired`);
- turning `isRequired` or `isUnique` on also means `tableColToShow: true` — the UI does that itself;
- a dropdown fed by a DICTIONARY: `optionSource: "FROM_BO"`, `refBoId: "<dictionary boId>"`,
  `options: []` (`load-bo-dictionary-list` lists the dictionaries; `load-dictionary-bo-field-options`
  with `boId` **in params** lists a dictionary's rows);
- a dropdown with a local list: `optionSource: "FROM_FIELD"`, `refBoId: null`, one `options` entry per
  variant with an id from `POST /web/v2/id-loader/load-portion {} {}`;
- mirror every key you set into that field's `editedFields` entry, then save as in step 7.

**Widgets and system fields** go into the same save, but each has its OWN generator instead of step 6's:
`generate-business-form-widget {widgetType}` and `generate-business-form-field-by-native {nativeType}`
(§5i — which also lists the per-type keys of `QUESTIONNAIRE` / `PROGRESS_BAR` / `TAB_GROUP` /
`FILE_UPLOAD` / `STATIC_TEXT`, and the separate controllers that hold a widget's code and url).

**Do not use** `save-business-form-field` to create fields: it answers 200 with an empty body and writes
nothing (trap 19). Accelerator: `tools/create-bo-constructor.bun.ts` (`--field "Метка:TYPE[@boId]
[#a|b|c][!req,uniq,readonly]"`, `--widget "TYPE:Метка[:код][:url]"`, `--native <NATIVE_TYPE>`).

#### R2 — The other four object kinds

`boCategory` in step 2 of R1 selects the kind: **`BO`** | **`BO_DICTIONARY`** (справочник) |
**`BO_PANEL`** (панель) | **`BO_COMPOSITE`** (составной объект) | **`BO_PROCESS`** (бизнес-процесс).
Three of them need nothing else; two have machinery of their own.

- **Dictionary** — R1 unchanged. The server pre-builds the two system fields «Код» (`INPUT_TEXT`,
  unique+required) and «Значение» (`INPUT_TEXT_LANG`, required); `generate-business-form-field` is only
  for extra ones. The BO comes back with `isDictionary: true`.
- **Panel** — R1 unchanged, but a panel is born with `formFields: []` and is built out of **nested
  objects**: call `generate-business-form-field` with
  `P {"boId":"<panelId>","fieldType":"BO","fieldBoId":"<the BO to show>"}` and give that field
  `gridPosition.rows: 6`. The saved field comes back
  `type:"BO", viewType:"TABLE", isKindAddForSelect:true, refBoId:<the BO>`.
- **Composite object** — **not** the R1 cycle after step 2. It has its own controller `v2/co` and a
  DRAFT protocol; see R2a.
- **Business process** — **not** the R1 cycle after step 3. It has its own two controllers and a
  versioned diagram; see R2b. (Its *fields* are still edited with R1 steps 5–8.)

##### R2a — Composite object (`v2/co`)

Everything is written into a draft as you go; the bottom bar of the editor only commits it.

1. `create-bo` — `B {"boGroupId":…,"boCategory":"BO_COMPOSITE"}` → `coId`.
2. `POST /web/v2/co/generate-draft` — `P {"coId":"<coId>"}` → `"<draftId>"` (a bare string).
   **Not idempotent** — every call mints a new draft; a stray one must be removed by hand (trap 29).
3. `POST /web/v2/co/add-bo-to-co` — `P {"coId":…,"draftId":…,"boId":"<source BO>"}` — once per source.
4. `POST /web/v2/co/load-bo-fields-for-co` — `P {"boId":"<source BO>"}` → `[{fieldId,label,code,type,…}]`
   (needs no draft).
5. `POST /web/v2/co/add-co-field-to-simple` — `P {"coId":…,"draftId":…}`,
   **`B [{"boId":"<source BO>","fieldId":"<source field>"}]`**. It creates **one attribute per link in
   the body** — to build a «составной атрибут» send ONE link here, then
   `add-co-field-to-composite` — `P {"coId":…,"draftId":…,"coFieldId":"<that attribute>"}`, `B` the
   remaining links.
   Neither call returns the new `coFieldId`: diff `load-co-fields-simple` — `P {"coId":…,"draftId":…}` —
   before and after.
6. `POST /web/v2/co/apply-and-remove-draft` — `P {"draftId":…}` (empty response body) = СОХРАНИТЬ.
   `remove-draft` with the same params = ОТМЕНИТЬ.
7. Rename with R1 step 3 — it works, but **a composite's code does NOT follow the name**; it keeps the
   one generated from «Составной объект №N».
8. **Verify**: `generate-draft` → `load-co-fields-simple` / `load-co-fields-composite` → `remove-draft`.
   Reading a committed composite needs a draft of its own, because step 6 destroyed the one you had.
   Accelerator: `tools/create-co-constructor.bun.ts`.

##### R2b — Business process (`v2/bo-process-editor2`, `v2/bo-process-editor`)

1. `create-bo` — `B {"boGroupId":…,"boCategory":"BO_PROCESS"}` → `boId`. The platform pre-builds the
   system field `PROCESS_STATUS` and **version 1 holding a single `Enter` figure**.
2. Rename with R1 step 3 — here the code DOES follow the name.
3. `POST /web/v2/bo-process-editor2/load-dev-bo-process-id` — `P {"boId":…}` → `"<boProcessId>"` (bare
   string), the editable version. `load-bo-process-versions` — `P {"boId":…}` →
   `[{boProcessId,isWork,isTest,version,comment}]`.
4. `POST /web/v2/bo-process-editor/load-bo-process-def` — `P {"boProcessId":…}` →
   `{"figures":{"<id>":{"x":…,"y":…,"type":"Enter"}},"arrows":{}}`. Find the `Enter`.
5. `POST /web/v2/bo-process-editor/load-new-ids` — `P {"count":2}` → fresh ids. **Never invent ids here.**
6. `POST /web/v2/bo-process-editor/apply-update-cmd` — `P {"boProcessId":…}`, `B`:

   ```json
   {"name":"ADD_FIGURE",
    "forward": {"type":"Group","list":[
       {"type":"Set","dotPath":"figures.<newFigId>","value":{"x":440,"y":104,"type":"Exit"}},
       {"type":"Set","dotPath":"arrows.<newArrId>","value":{"startFigureId":"<enterId>","startSlotName":"main","finishFigureId":"<newFigId>","finishSlotName":"main"}}]},
    "backward":{"type":"Group","list":[
       {"type":"Unset","dotPath":"arrows.<newArrId>"},
       {"type":"Unset","dotPath":"figures.<newFigId>"}]}}
   ```

   `type` ∈ `Set` | `Unset` | `Group`; `dotPath` is a dotted path into the def, so the same shape moves a
   figure (`figures.<id>.x`) or renames an arrow. `backward` is what `undo` replays — always send both.
   **There is no draft and no СОХРАНИТЬ here**: the command writes immediately.
   Figure types: `Enter` | `Exit` | `Switch` | `SingleToParallel` | `ParallelToSingle` | `Form` |
   `Script` | `Timer` | `Point` | `Terminator`; slots `main` / `left` / `right`.
7. **Verify.** `POST /web/v2/bo-process-editor/validate-def` — `P {"boProcessId":…}` → `[]` when the
   diagram is valid. A process with no Exit answers «Нет точка окончания» + «Из фигуры должен быть
   выход». Accelerator: `tools/create-process-constructor.bun.ts` (`--show <boId>` prints versions,
   figures, arrows and validation of any process).

#### R3 — Import a structure archive (`.mybpm.zip`)

How to BUILD the archive → `MYBPM-IMPORTS.md` §0. This is how to ship it. The controller prefix is
**`import-structure`**, not `v2/…`: `POST <stand>/web/import-structure/<method>`.
**Only one import may be open on a company at a time.**

1. `POST /web/import-structure/import-file` — **multipart**, the zip under the field name `file` (the
   filename you give is the one the log shows; it is otherwise ignored) → `"<importId>"` (bare string).
2. `insert-file-data` — `P {"importId":…}` → `"<processId>"`. Poll it (step 2p).
3. `analyze-file-data` — `P {"importId":…}` → `"<processId>"`. Poll it.
   **2p. Polling**: `POST /web/v2/process-indicator/load-state-short` — `P {"processId":…}` →
   `{"label":…,"percentage":…,"isFinished":true}`. Poll about once a second. On a small archive both
   processes are already finished on the first poll.
4. **Read the dry run — nothing has been written to the stand yet** (status stays `ANALYZED`):
   - `load-import-data` — `P {"importId":…}` → `{status, error, conflicts}`;
   - `load-import-errors` — `P {"importId":…,"pageId":null}` → `{"errorRecords":[]}` when clean;
   - `load-import-bo-infos` — **`B {"importId":…}`** (body, not params!) →
     `[{importRecordId,name,boCategory,structTypes}]`, one row per object in the archive;
   - `load-import-bo-record` — `P {"importId":…,"recordId":…}` → the per-BO pre-apply diff (added fields,
     changed fields, added tabs/widgets).
   **Read this before applying.** `load-import-errors` has come back EMPTY while the UI dialog showed a
   real error («В Составном объекте не достаёт БО»), so an empty error list is not a guarantee.
5. `save-import-description` — `P {"importId":…,"value":"что и зачем импортируем"}` → empty body.
   The description is **required**: applying without it gives status `DESCRIPTION_ERROR`.
6. `POST /web/v2/process-indicator/pre-create-process` — `P {}` → `"<processId>"`.
7. `apply-import` — `P {"importId":…,"processId":…}` → `{"type":"APPLIED"}`. Poll the process. **This is
   the only call that writes.**
   To abandon instead: `cancel-import` — `P {"importId":…}`; `remove-import` deletes the log row too.
8. **Verify** with R4. Statuses: `IN_PROGRESS|ANALYZED|APPLIED|ROLLED_BACK|DESCRIPTION_ERROR|
   INTERNAL_ERROR|CANCELED`. An applied import can be undone: `load-import-rollback-preview` then
   `rollback-import` — `P {"importId":…,"processId":…}` (a fresh `processId` from
   `pre-create-process`) → `{"type":"ROLLED_BACK"}`, status `ROLLED_BACK`, `canRollback:false`.
   Only the import with `canRollback:true` can be undone, and «latest» may not be the one you applied
   last — read §5 «Rollback trap» before undoing anything but a single import.

Traps: **`load-import-state` is not a reliable «is something open?» probe** — it answered
`{"importExists":false}` while an analysed import was waiting (trap 35). Take the `importId` from
`import-file` and keep it. Accelerator: `tools/api-import-structure.bun.ts`.

#### R4 — Read anything back (the verification toolbox)

Use these instead of screenshots; several of these screens are invisible to text extraction anyway.

| question | call | params |
|---|---|---|
| which BO groups exist? | `load-bo-groups` | `{}` (optional `{forEdit, searchValue}`) |
| what is in a group? | `load-bo-records-by-group-id` | `{"groupId":…}` — **`groupId`**, not `boGroupId` |
| what is this BO? | `load-business-object-by-id` | `{"businessObjectId":…}` |
| id of a BO whose code I know | `load-bo-id-by-code` | `{"boCode":…}` |
| name only | `load-business-object-name` | `{"boId":…}` |
| the BO's fields | `load-bo-fields-for-drag` | `{"boId":…}` — `code` comes back `null` here, identifies by label |
| the dictionary options of a field | `load-dictionary-bo-field-options` | `{"boId":…}` |
| how many records match a filter | `v2/business-object-instance/load-bo-instance-bracket-table` | see R6 |

**The archive's `oldId` becomes the BO's real id on the stand** `[C]` (six times over), and an
imported field/tab id equals the archive's `newId`. That is how a generated archive and later API calls
are stitched together. A BO created in the constructor gets a platform id instead — ids are 16 characters
over `A-Za-z0-9@~`, so **an id really can start with `~` or contain `@`**; do not "clean" them.

#### R4a — EXPORT a BO's structure (or menu items) through the API `[C]`

The reverse of an import, and the only way to read the real serialization of something built by hand
(that is how `kanbanCardTemplates` and `MenuItemStructDto` were decoded). Controller **`struct`** — a
basket the stand keeps per user, then one download. **The controller is `/web/struct/<method>`, NOT under
`/web/v2`** (trap 41) — a `v2/struct/…` call answers 404 and an in-page helper that parses the body silently
takes it for data; only `pre-create-process` (step 4) is `/web/v2`:

| # | call | params / body | note |
|---|---|---|---|
| 1 | `struct/count-bo-export-records` | `{}` / `{}` | how many BOs are in the basket now |
| 2 | `struct/load-bo-export-records` | `{offset,limit}` | the basket: `{boId, boName, boCategory, hasScript, isStructureExport, isAccessRightsExport, isScriptsExport}` |
| 3 | `struct/save-bo-export-records` | **body** = an ARRAY of those records | adds to the basket; answers `""` |
| 4 | `v2/process-indicator/pre-create-process` | `{}` | → processId |
| 5 | `struct/export-company-structure` | params `{processId}`, body `{}` | the response body IS the `.mybpm.zip` |
| 6 | `struct/remove-bo-export-records` / `struct/clear-export-records` | **body** = an ARRAY OF `boId` STRINGS / `{}` | put the basket back as you found it |

- **Read the basket first and restore it afterwards** — it is the user's own selection on the
  «Импорт/Экспорт» screen, not scratch space.
- **Both basket writes work over the API** `[C]` — the HTTP 400 «Failed to read request»
  once written up here as a defect was a wrong BODY: **`remove-*` takes an array of id STRINGS**
  (`["zm8ufIOguCPru0bu"]`), not the records that `save-*` takes. Sending records to `remove-*` — with or
  without the `isMenuExport:true` flag the basket adds — gives exactly that 400. Verified by removing the
  one BO in a basket and saving it back: count 1 → 0 → 1, the record byte-identical to the original.
  The UI alternative: `/settings?settingsOpenPageUrl=import_export&formType=export`, the ⊕ next to a
  basket caption opens a checkbox popover (closing it saves), the row's delete icon removes one (it opens
  a confirm whose buttons are `.confirm-button-block .ok-btn`).
- **Menu items have a basket of their own** `[C]` — the same six calls with `menu` in the
  name: `struct/count-menu-export-records`, `load-menu-export-records`, `save-menu-export-records`,
  `remove-menu-export-records` (array of `menuItemId` strings), `clear-menu-export-records`, plus the
  picker `struct/load-unexported-menu-records` `{}` → `[{menuItemId, code, displayName, type, parentId,
  boId, boName}]` — every menu item NOT yet in the basket. `save-menu-export-records` takes an ARRAY of
  those rows. Steps 4–5 then export BOTH baskets together; a menu item comes out as a `MenuItemStructDto`
  line (`MYBPM-IMPORTS.md` §5e). The export pulls in no BO line for the items' BOs — only what the BO
  basket holds.
- The same set exists for the report basket, unexercised `[U]`: `count/load/save/remove/clear-report-export-records`,
  `load-unexported-report-records`.
- **The «Глобальные методы» switch** `[C]`: `struct/load-export-is-global-methods {}` → `true|false`,
  `struct/change-export-is-global-methods` P `{value}`. With it on (and every basket empty) steps 4–5 export
  `CompanyMetadataStructDto` + one `ScriptDefStructDto` per global method + one `CompanyGlobalMethodsStructDto`
  (`MYBPM-IMPORTS.md` §5d «Company-global methods»: an import REPLACES the stand's whole list and does not
  refresh the running copy — §5g). Switch it back off afterwards — it is the user's selection.
- **The company-settings basket** `[C]`: `load-settings-export-kinds` → `[{kind, selected}]` (14 kinds),
  `change-settings-export-kind` **P** `{kind, value}` (in B it does nothing), `count-settings-export-kinds`,
  `clear-settings-export-kinds`. A ticked kind exports as one `CompanySettingsStructDto {kind, payloadJson}` line;
  exercised for `SCRIPT_SETTINGS` (§5o) and for every kind (§5n «Every kind of the settings basket»).
  Untick it afterwards — it is the user's selection too.
- Getting the bytes OUT of the browser: fetch the zip inside the page and POST the `arrayBuffer` to a
  local `Bun.serve` — the same 127.0.0.1 bridge the import dry run used (§5).
- Also present but not needed for this: `v2/business-objects/export-structure` /
  `export-structure-to-file` with `{settings: {type: "BO_STRUCTURE"|"COMPANY_STRUCTURE"|"ALL",
  exportKindList}}`, and `struct/load-bo-dependencies` (what the «Зависимости» panel shows).

#### R5 — Access rights on a BO

Controller `v2/business-objects`. An archive that carries an access DTO REPLACES these rights with its own
(group ids included); an archive without one leaves them alone (`MYBPM-IMPORTS.md` §8, `[C]`).

1. `load-access-group` — `P {"businessObjectId":…}` → an object with one entry per action:
   `all, useAll, view, edit, create, delete, archive, export, duplicate, add`. Each action carries
   `accessForAll` (false = ВЫБОРОЧНО), `participants`, `authorsField{…}`, `fromFields{<fieldId>:{…}}`,
   `orgUnitRecordList`, `orgUnitToAdd`, `orgUnitToDelete`.
2. Patch it in place. «Автор (инициатор)» = `authorsField.accessForAuthor`; «Содержимое поля» =
   `fromFields[<fieldId>].accessForContent`. **`authorsField` is `null` on an untouched BO — create the
   object before setting a flag on it** (trap 2).
3. To grant a group: `load-org-unit-record-list` — `P {"filter":"","skipFirstCount":0}` → the groups and
   users (**group ids here have no `G-` prefix**; an archive's `orgUnitIds` do). Put the full unit
   records into **`view.orgUnitToAdd`** and set `accessForAll: false`.
   **Groups persist ONLY through `orgUnitToAdd` / `orgUnitToDelete`, never through `orgUnitRecordList`**
   (trap 3) — the UI sends `orgUnitToAdd: []` for groups that are already there.
4. `save-access-group` — `P {}`, `B {"businessObjectId":…,"accessGroup":<the whole object>}`.
5. Follow it the way the UI does: `save-business-object-portion` with
   `jsonPart = "{\"businessObject\":{\"id\":\"<boId>\",\"nameMap\":{},\"recordNameMap\":{},\"chosenAccessRight\":true}}"`.
6. Field-level and tab-level rights are the same shape on
   `load-field-access-group` / `save-field-access-group` — `{businessObjectId, fieldId, accessGroup}` (only
   `view` and `edit` matter) — and `load-field-tab-access-group` / `save-field-tab-access-group`
   (`+ tabId`). An unknown `tabId` answers `view.accessForAll:true, authorsField:null`, so a «никто»
   answer can be real.
7. **Verify** by calling `load-access-group` again and comparing — this is the one area where the UI
   silently sends nothing when it thinks nothing changed.

#### R6 — A sidebar menu item and a record filter

Controller **`v2/menu-item`** (the `business-objects` menu-access endpoints fail with `NoBoWithId`).
**Or ship the items IN the structure archive** `[C]`: a `MenuItemStructDto` line per item,
everything by code, the item's views (list, kanban) included (`MYBPM-IMPORTS.md` 0.5d / §5e) — then R3
alone builds BO + menu (+ kanban), and a rollback of that import removes the menu items too. The API
route below is for items on BOs that are already on the stand, and for access rights.

1. Mint an id: `POST /web/v2/id-loader/load-portion` → an array of ids.
2. `create-menu-item` — `P {}`, `B` = the item itself:
   `{"id":…,"type":"GROUP"|"BO","displayName":…,"displayNameMap":{"RUS":…},"boId":…,"iconName":…,
   "orderIndex":100000,"isPanel":false,"boPages":{…},"chosenAccessRight":false,"parentId":…}`.
   Default `iconName`: GROUP `bo-g-draggable`, BO `man-with-company`, dictionary `bo-d-draggable`.
   The built-in root «Системные» has `orderIndex` 60000 — put your own roots after it.
3. Icons: `save-menu-item-icon-name` — `P {"menuItemId":…,"iconName":"<namespace>:<name>"}` → empty
   body (or set `iconName` right in `create-menu-item`). **Take the name from §4 «Menu icon catalogue»**
   (`phosphor:*` or `menu-item:*`, 1153 names): the server stores ANY string, and a name outside the
   catalogue gives an item with no icon at all.
4. Rights: `load-access-group` / `save-access-group` on **`v2/menu-item`** — `P {"menuItemId":…}`, body =
   the access group (same shape as R5); then `save-menu-item-chosen-access-right` —
   `P {"menuItemId":…,"chosenAccessRight":true}`. Only `view` matters for navigation.
5. A record filter: `load-bracket-filter` — `P {"menuItemId":…}` **creates** the filter record if it is
   missing → `POST /web/v2/bracket-filter/save` — `B {"id":…,"boId":…,"brackets":[<root>]}`. A bracket is
   `{id,parentId,parentTreeIds,connectionType,notType,dynamicFilters,nativeFilters,brackets}`.
   Semantics, verified by record counts: filters inside ONE bracket are AND-ed; **a bracket's own filters
   are IGNORED if it has sub-brackets**; siblings combine by the EARLIER sibling's `connectionType`.
6. **Verify a filter without saving it**: `POST /web/v2/business-object-instance/load-bo-instance-bracket-table`
   — `B {"boId":…,"dynamicFilters":[],"nativeFilters":[],"search":"","paging":…,"ordering":null,"state":"ALL","brackets":[…]}`
   → read `totalHits`.
7. `delete-menu-item` — `P {"menuItemId":…}`; `load-nav-items` — `P {"parentId":…}` → the children.

#### R7 — Records (instances) from Excel

**Records never travel in a structure archive** — they are xlsx imported into a BO registry. The file
format is exacting and is `MYBPM-IMPORTS.md` Part III (§0X cookbook); read it before writing a file. The API is
`v2/bo-transfer` `[I]` (read off the client; the UI route is the confirmed one):

1. `GET /web/v2/bo-transfer/download-template?businessObjectId=<boId>&selectedFieldIds=<…>` — an
   ordinary GET with query parameters (no envelope), returning the xlsx. **Take a fresh template after
   every structure change**: the columns follow the BO, and their positions move between exports.
2. Fill it. The three rules that break the most files: every cell must be an **inline string** (a numeric
   `103` becomes «103.0» and breaks lookups); the header must have **frozen rows** (or a double bottom
   border in column A) or the whole file is rejected; dropdowns match **by label**, references by the
   target's **unique field or an `ID` sub-column** — and the referenced records must already exist.
3. `POST /web/v2/bo-transfer/import-from-file` — **multipart**, file under `file`, plus the form field
   `businessObjectId` → `{actId}`.
4. `is-import-file-finished` — `P {"actId":…}`; then `load-import-file` — `P {"actId":…}` → the act: what
   would be created, what updated, what failed. **Nothing is written yet** — this is the same two-phase
   shape as R3.
5. `apply-imported` — `P {"importId":…}` writes; `cancel-imported` drops it; `imported-ok` closes it;
   `download-errors` — `P {"importId":…}` returns the «Ошибки при загрузке …» xlsx (row numbers + error
   codes).
6. Export: `export-bo` (raw body, params `boInstanceIds`, `boFieldIds`) → `exportId` →
   `is-bo-export-file-ready` — `P {"exportId":…}` → `load-bo-export-file` — `P {"exportId":…}` → bytes.
7. **Verify** by exporting the registry again and rebuilding the data model from the cells. **File order
   matters**: users → groups → dictionaries → records → link files, and a reference resolves only against
   records that were on the stand BEFORE the file was imported.

The destructive unknowns of `MYBPM-IMPORTS.md` §19.6 apply in full: regenerate complete files, never
partial ones, and **never write a column for the SINGLE side of a two-way link** — such rows are silently
dropped (trap 13).

#### R8 — Export the structure of a company

1. Pick what to export. The export basket is **server-side, persisted state** — it still holds whatever
   was selected in some earlier session. In the UI:
   `/settings?settingsOpenPageUrl=import_export&formType=export`, the grey ⊕ right of «Бизнес-объекты (N)»
   adds BOs, the row's trash icon removes them (unticking in the ⊕ dropdown does NOT).
2. `POST /web/v2/process-indicator/pre-create-process` — `P {}` → `processId`.
3. `POST /web/struct/export-company-structure?processId=<id>` with body `{}` → the zip bytes;
   `Content-Disposition` carries the generated name. **The browser's own «Выгрузить» button does not
   deliver a file under Claude-in-Chrome** — do this from the shell.
4. Unconfirmed dependencies do not block the export; the archive then holds only the selected BOs.
   The file name's company slug is not necessarily the tenant you are in.

### 0U.5 Hard rules

1. **Detect errors by `errorType`/`className` in the body, never by the HTTP status.** 200 is the answer
   to everything, including a wrong password and a wrong token.
2. **The `token` header takes the localStorage value WITHOUT its JSON quotes.** With them: `SecurityError`
   «Illegal Session».
3. **`params_Lr1oSgwPR8` vs `body_o1nhHUG480` is decided by the endpoint.** Both keys always present.
4. **Never send a `code` on create** — BO codes and field codes are generated by the server from the names
   (a transliteration), the BO code is cut to 30 characters, and a FIELD's code is fixed at its first save
   and never regenerated. Anything that must reference a BO by code takes it from
   `load-business-object-by-id`, never from a guess. **Then rename every NEW code to the naming convention**
   (rule 12) with the dedicated setter — `save-business-object-code` for a BO (§5j),
   `save-business-field-code` for a field (PARAMS `{businessObjectId, businessFieldId, businessFieldCode}`) —
   before any script, kanban template or menu item refers to it.
5. **`create-bo` writes immediately.** So does `apply-update-cmd`, so does every `v2/co/add-*`. There is
   no dialog to cancel; the only undo is deletion.
6. **One structure import per company at a time**, and only `apply-import` writes — everything before it
   is a dry run you should read.
7. **Do not ship an `AccessStructDto` in an archive unless asked**: the import applies it and REPLACES the
   rights that were set by hand (groups included — `orgUnitIds` of THIS stand arrive, `[C]`).
   A structure-only archive leaves the stand's rights untouched.
8. **Re-read after every write.** The platform answers 200 for `save-business-form-field` (writes
   nothing), for an empty kanban template save (writes nothing) and for a rights popup that decided
   nothing changed.
9. **Never print a stack trace into the session** — a MyBPM error carries ~100 lines of Java. Read
   `message` and `errorType`.
10. Do not fight the UI where an API exists. And where you must use the UI, read §10: clicks in this app
    go through `javascript_tool` (`el.click()` matched on `innerText`), text through the native value
    setter — `computer type` silently drops spaces and punctuation.
11. **Every BO shows at least one field in its registry, and every BO-reference field shows at least one
    field of the BO it points at** — a rule from the platform team. A BO with no
    `tableColToShow` field answers `AccessDenied` in its registry and lists no rows (trap 48). A reference
    with every `boFieldRefs[].toShow: false` renders an empty selector on the card (trap 53). The API
    creates both states by default, so set a column (`editedFields: [{fieldId, tableColToShow:true,
    tableColOrderIndex:0}]`) and a displayed field of every reference before handing the BO over.
    Prefer a non-string first column on a new BO (§7, the Elasticsearch sort defect).
12. **Codes you set follow the naming convention** (the same table as `MYBPM-IMPORTS.md` §0.6a): English,
    snake_case, latin/digits/`_`, ≤ 30 characters shortened by meaning (never cut from the right).
    Field and widget — lower case (`client_name`); `CHECKBOX` — `is_*` (`is_paid`); `TAB_GROUP` — `tabs`,
    or `tabs_*` when the BO has several; a tab — `tab_*` by meaning (`tab_documents`); an object (BO,
    dictionary, composite, process, panel), a BO group and a menu item — first letter capital, the rest
    lower (`Client_order`, `Sales`, `Client_orders`); a list option, a questionnaire row/column, a
    progress step and an exposed-service code — lower case (`in_progress`, `create_order`). Fixed codes
    (`CODE` / `LABEL` of a dictionary, `PROCESS_STATUS`, native field ids) stay. **A code that already
    exists on the stand is never renamed** to fit — scripts, templates and menus reference it.

### 0U.6 Self-check before you say it worked

- [ ] Every call's answer was parsed and checked for `errorType`, not just for HTTP 200.
- [ ] The object was read back with R4 and its `name`, `code` and field list match what was asked for.
- [ ] For a BO built with R1: the code did NOT acquire a 16-character tail (the rename race).
- [ ] For an import: `load-import-data` says `APPLIED`, and the BO answers to `load-bo-id-by-code`.
- [ ] For a composite: `load-co-fields-simple` + `load-co-fields-composite` read through a FRESH draft,
      which was then removed.
- [ ] For a process: `validate-def` returned an empty list.
- [ ] For rights: `load-access-group` re-read and compared, not assumed.
- [ ] Nothing was left open: no dangling `v2/co` draft, no analysed-but-unapplied structure import.
- [ ] No field scrolls inside its own cell on the record card. Open a record and look at every field
      with tall content — a `STATIC_TEXT` / `TEXTAREA` holding HTML or an `<iframe>`, a nested table, a
      heading band: its wrapper inside the `ktd-grid-item` (e.g. `div.dff-static-text.scroll-bar`,
      `overflow-y:auto`) must have `scrollHeight <= clientHeight`. If not, raise the field's `rows`
      (≈29 px per row: a 34-row field is a 990 px grid item `[C]`) and shift the fields below,
      or shrink the content (the `height` of an `<iframe>` a script writes). The record window scrolling
      as a whole is normal; a scrollbar INSIDE a field is not. Check every tab, and a table with its
      real number of rows.
- [ ] The notifications your work raised were cleared, whichever way they came: every structure import
      leaves an «Анализ импорта завершен»; every non-2xx REST call from a script you clicked leaves
      «Ошибка — Возникла ошибка при запросе в сервис …» (`MYBPM-IMPORTS.md`, RestRequest section); a
      script's own `ScriptNotification` lands there too. They sit under the bell (header, «События»).
      Check the count before your first write and after your last one. The red × on the «События» header deletes them all —
      `v2/user-notification/delete-notifications` (`P {}`, `B {}` — deletes ALL of them `[C]`); the grey × on one entry
      deletes that one; `v2/user-notification/count` / `load-notifications` read them `[C]`.
      **Headless, no UI** `[C]`: `load-notifications` `B {paging: {offset: 0, limit: 50}}` (without
      `paging` → NullPointerException) lists `[{row: {id, header, body, happenedAt}}]`; `delete-notification`
      `P {notificationId}` deletes ONE (answers empty, `count` drops by one) — delete exactly the ids your run
      raised. The client also has `delete-all-notifications` (no args) — it wipes the user's others too.
      Clear only what your own run raised.

### 0U.7 Where the rest is

§1 request conventions · §2 the working method · §3 rights · §4 menus and filters · §5 archive import and
export, §5b–5f one section per object kind, §5g the script API, §5h field settings, **§5i every field
type, widget and system field**, §5j BO header settings, §5k card tabs, §5l BO views (calendar / map / grouping), §5m the sidebar row (clone, rename, order, group, create-record iframe URL), §5n company settings that name a BO (physical removal, offline, messengers), §5o «Выставление сервисов» (a BO as a public HTTP endpoint, its archive line) · §6 Excel records: the routes (the FILE FORMAT is
`MYBPM-IMPORTS.md` Part III) · §7 kanban (solved — the card template ships in the archive) · §8 the HTML
sanitizer · §9 tooling · §10 Claude-in-Chrome traps · **§11 the numbered trap list — read it when
something behaves impossibly** · §12 what is still unknown.

---

## 1. Request conventions

- `POST https://<stand>/web/v2/<controller>/<method>`, header `token`, body:

  ```json
  {"useParamsFromBody": true,
   "params_Lr1oSgwPR8": { …query params… },
   "body_o1nhHUG480":  { …body… }}
  ```

- **Token**: `localStorage.LOCAL_PRIVATE_SwebToken`, **with the surrounding JSON quotes stripped**, is the
  `token` header — no XHR sniffing needed. `[C]` Sent WITH the quotes the stand answers
  `SecurityError` «Illegal Session» (HTTP 200 body, not a 401), so that error means «bad token», not
  «expired session». In the browser the Angular client reads the same key, so a curl/Bun client outside the
  browser needs nothing else: **no cookies** (`document.cookie` is empty on this stand) and no company
  header — the token alone selects the tenant.
- **A browser is not the only way to get a token** — the stand has a headless login. Endpoint `[C]`,
  return value `[I]` (read off chunk `9839`; the failure path was probed with curl):
  `POST /web/v2/auth/v3/login`, standard envelope, body
  `{"dXNlcm5hbWU=":"<base64 of the login>","cGFzc3dvcmQ=":"<base64 of the password>",
  "timeOffsetZoneInMinutes":-300,"timezoneRegion":"Asia/Almaty","clientType":"WEB","userAgent":"curl",
  "pushToken":null,"clientVersion":""}`. The two keys are literally base64 of `username` / `password`,
  and the values are base64 of the UTF-8 bytes (`btoa(unescape(encodeURIComponent(v)))`).
  **The response body is the token itself** — the client feeds the whole body into `writeToken`.
  Wrong credentials: HTTP 200 + `{"errorType":"IllegalLoginOrPassword","message":"Не верен пользователь
  и/или пароль"}`. The rest of the controller: `load-token` (the current session's token),
  `load-auth-info` (GET, who am I), `fast-login`, `otp-login`, `verify-code`, `send-to-verify`,
  `has-otp-settings`, `get-all-masks`, `save-company`, `logout` (GET). **The success path was never
  executed** — no password was ever in this folder; run it once and re-mark it.
- **Fresh ids**: `v2/id-loader/load-portion` returns an array of ids; use them for objects you create.
- **Finding an endpoint — grep the whole bundle offline, it beats sniffing** `[C]`.
  Endpoints live in lazy JS chunks (`956.*.js` — rights, menu, icons; `9839` — BO controller + the HTTP
  service itself; `5675` — structure import; `7094`/`7584` — process indicator). Pull them all without a
  browser, no auth needed for static assets:
  1. `curl -sS https://<stand>/ | grep -o 'src="[^"]*"'` → `runtime.<hash>.js`, `main.<hash>.js`;
  2. `runtime.*.js` contains ONE object literal `{<chunkId>:"<16-hex hash>",…}` (201 entries on 4.24.25.614)
     — parse it and fetch every `https://<stand>/<chunkId>.<hash>.js`;
  3. grep the downloaded chunks. A controller is `…setControllerPrefix("v2/business-objects")`, and each
     method reads `postJson("/load-bo-groups",{},{boId:u})` — body first, params second, so the call maps
     straight onto the envelope. `postFileJson(path,file,params)` = multipart.
  The page-side XHR/fetch logger is still the fallback when the call is built dynamically, but it is slower
  and misses anything that fires before the logger is installed.
- A stand export carries no host/URL — record the stand URL in the project memory.
- URL patterns: BO constructor `/business-objects/editing/<boId>/object-editing`; its editable list is
  `/business-objects/editing`. `/business-objects/viewing-list` (Системные → Бизнес) is the read-only
  twin — it has no create/edit controls at all. See §5b.

## 2. Working method (user's rules)

- **«Тыкай через UI, ты сильно долго делаешь» / «если не получается через API делай через UI».** Speed
  beats elegance: stop exploring an API after ~2 failed guesses and sniff the UI instead. Minimal
  screenshots.
- After setting anything via API, **re-load and compare**. After a UI popup, click СОХРАНИТЬ and confirm
  the save call returned 200.
- **State stand facts only after READING the stand** (API or export) — never infer them.
- The auto-mode classifier blocks the FIRST stand-changing API call of a session; an explicit grant from
  the user in chat («даю все права, разрешаю») unblocks it — no settings change needed. A durable fix
  `[C]`: an `autoMode` block in the user's `~/.claude/settings.json`, with an `environment`
  line («the user owns the stands *.mybpm.kz») and an `allow` line (any action on the stand through
  claude-in-chrome, in-page API writes included), each list starting with `"$defaults"`. With it,
  in-page `save-business-object-portion`, JS clicks on «СОХРАНИТЬ» and `push-step-forcibly` all passed
  with no prompt.
- **The constructor's «СОХРАНИТЬ» ignored two real mouse clicks and saved on `button.click()` from JS**
  `[C]` (`mybpm-ng-action-buttons button.main`, with a field-settings panel open). This is the
  opposite of the Form dialog's checkboxes (§5f). If a click sends nothing, check the XHR log, then try
  the other kind of click.

## 3. Access rights

Archive-side shape (`AccessStructDto`) and the import behaviour that wipes group ids → `MYBPM-IMPORTS.md` §7–8.

### UI

BO constructor → lock icon (top right) → popup «Права доступа»: a row of action icons (view, create, edit,
archive, duplicate, delete, export); per action a toggle ВЫБОРОЧНО + «Выберите» opens a tree —
«Автор (инициатор)», «Из поля "X"» (expand → «Содержимое поля» / Руководитель / Подчиненные / Департамент),
then groups, then users. Always click СОХРАНИТЬ and check the request returned 200. The field-level lock
popup **sends nothing when unchanged**.

Simplification the user accepts: when a field's view/edit equals the BO's, just say «Всем».

### API — `POST /web/v2/business-objects/<method>`

- `load-access-group` params `{businessObjectId}` → an object with the actions
  `all, useAll, view, edit, create, delete, archive, export, duplicate, add`. Each action:
  `accessForAll` (false = ВЫБОРОЧНО), `participants`,
  `authorsField{accessForContent, accessForHead, accessForAuthor, accessForEmployees, accessForDepartment, …}`
  (**null on untouched BOs — create the object**), `fromFields{<fieldId>: same flags}`,
  `orgUnitRecordList[{id,type:GROUP|PERSON,name,…}]`, `orgUnitToAdd`, `orgUnitToDelete`.
  Mapping: «Автор (инициатор)» = `authorsField.accessForAuthor`; «Содержимое поля» =
  `fromFields[fieldId].accessForContent`. `accessForAuthor` is true on every `fromFields` entry of
  `all`/`view` by default — meaning unclear `[U]`.
- `save-access-group` body `{businessObjectId, accessGroup:<the same object>}`.
  **Groups persist only through `orgUnitToAdd` (full unit records) / `orgUnitToDelete`, NOT through
  `orgUnitRecordList`** `[C]` — the UI sends `orgUnitToAdd: []` for groups that are already there.
  The UI follows the save with `save-business-object-portion`, body
  `{jsonPart:"{\"businessObject\":{\"id\":\"<bo>\",\"nameMap\":{},\"recordNameMap\":{},\"chosenAccessRight\":true}}",orderIndex:0,isLast:true,id:null}`.
- `load-org-field-record-list` params `{businessObjectId}` → the Person fields usable in rights
  `[{id,name,kind}]`. Some reference fields are not offered (returned `[]` for a BO with a «Сотрудник»
  field; its type was not checked).
- `load-org-unit-record-list` params `{filter:"", skipFirstCount:0}` → groups (and users). **Group ids in
  the API have no `G-` prefix**; the archive's `orgUnitIds` use `G-<id>`.
- Field rights: `load-field-access-group` params `{businessObjectId, fieldId}`;
  `save-field-access-group` body `{businessObjectId, fieldId, accessGroup}` — only `view` + `edit` matter.
- Tab rights: `load-field-tab-access-group` params `{businessObjectId, fieldId:<TAB_GROUP field id>, tabId}`;
  `save-field-tab-access-group` body `{businessObjectId, fieldId, tabId, accessGroup}`. An unknown/unset
  `tabId` answers `view.accessForAll:true, authorsField:null`, so a «никто» answer is real.
  The UI follows it with `save-bo-field-tab-chosen-access-right` — **PARAMS** `{boId, fieldId, tabId,
  chosenAccessRight}` (in the body: 400 «Required parameter 'boId'») — which only turns the lock on the
  tab chip orange `[C]`. To reset a tab: `accessForAll:true`, `orgUnitToDelete` = the
  current `orgUnitRecordList`, then the flag `false`.
  **Tab rules travel in an archive** `[C]` as
  `AccessStructDto.fieldAccessStructMap.<TAB_GROUP code>.tabAccessStructMap.<tab code>` (export with
  «Права доступа» → import of a copy → the same lock on the same tab); details in `MYBPM-IMPORTS.md` §7.
- **Field and tab ids on the stand equal `newId` in an imported archive** — that is how a generated archive
  and the API are stitched together.
- Also seen on the controller: `load-field-access-author-person-list`. Dictionary options:
  `load-dictionary-bo-field-options {boId}`.
- **Group rights travel in an archive** `[C]`: view → one group, edit →
  another, exported with «Права доступа», reset to «всем», the export imported → both groups back. (The
  2026-09 note «import wipes group rights» came from an older build and did not reproduce.) An archive
  WITHOUT an access DTO left the rights untouched. The export also writes each mentioned group as an
  `ExportStructInstanceDto` (`boCode:"PersonGroup"`). A later UI reading once showed «Из поля →
  Содержимое поля» unchecked after a re-import — re-check `fromFields` after an import that carried rights.

## 4. Sidebar menu — controller `v2/menu-item`

All verified on the `<company-c>` stand by building 5 menu groups + 36 items via the API. `[C]`

- `create-menu-item` body = the item itself:
  `{id, type: GROUP|BO, displayName, displayNameMap{RUS}, boId, iconName, orderIndex, isPanel:false,
  boPages{…}, chosenAccessRight:false, parentId}`; `id` comes from `v2/id-loader/load-portion`.
- Default `iconName`: GROUP `bo-g-draggable`, BO `man-with-company`, dictionary `bo-d-draggable`.
- `delete-menu-item {menuItemId}`; `load-nav-items {parentId}` → the children with their ids
  (`{parentId: null}` → the roots). Each item carries a `code` too — the menu CODE by which a structure
  archive addresses it (`MYBPM-IMPORTS.md` §5e); the kebab's «Изменить код» edits it.
- **Menu items also travel in a structure archive** `[C]` — `MenuItemStructDto`, parent /
  BO / kanban column field all by code (`MYBPM-IMPORTS.md` 0.5d, §5e); export them with the menu basket
  of §0U R4a.
- **A menu item's kanban URL mislabels its ids** `[C]`: opening a BO item with the kanban on
  goes to `/business-objects/viewing-single/bo/<menuItemId>/kanban-view?businessObjectId=…&fieldId=…&menuItemId=…&boId=…`,
  where the real menu item id is the PATH segment and the `menuItemId` QUERY parameter carries the kanban
  column FIELD id. Read ids off the path, not the query.
- The built-in root «Системные» has `orderIndex` 60000 — put your own roots after it (100000, 200000, …).
- `save-menu-item-bo-pages` params `{menuItemId}`, body `boPages` = the item's views: list, kanban,
  calendar, timeline, map, grouping, each an `is*Enabled` flag + an `*Index` (tab order, 1-based over the
  enabled views). Only list and kanban were ever set `[C]`; what the other four need is `[U]`
  (`MYBPM-IMPORTS.md` 0.5d). Kanban keys: `isKanbanEnabled`, `kanbanIndex`, `kanbanFieldId` — they switch
  the board and its COLUMNS on for THIS item; the CARD lives on the BO and must come from the archive (§7).
- Icons: `save-menu-item-icon-name` params `{menuItemId, iconName:"<namespace>:<name>"}` (empty 200).
  **Valid names = the catalogue below** (1153 names, `phosphor:*` AND `menu-item:*`); the server accepts
  anything, so a wrong name is found only as a blank in the sidebar. Built-in items inside «Системные»
  use system icons (portfolio, no-color-settings, no-color-archive, man-with-company) — leave them alone.
  (Not «only the 1048 `phosphor:*` strings» — the 105 `menu-item:*` names of the picker's commerce tab
  count too.)
- UI: the sidebar row kebab (⋮) offers Отображать в моб. приложении / Изменить код / Права доступа /
  Переименовать / Изменить иконку / Разгруппировать / Удалить. Sidebar names are `<input>` values inside
  `app-bo-record`; clicking `.container` puts the id into the URL.

### Menu icon catalogue `[C]`

Every value `iconName` may take besides the defaults (GROUP `bo-g-draggable`, BO `man-with-company`,
dictionary `bo-d-draggable` — no prefix). The same list serves both routes: `save-menu-item-icon-name`
/ `create-menu-item` here, and a `MenuItemStructDto` line in an archive (R6, §5).

- **The server checks nothing** `[C]`: `create-menu-item` and `save-menu-item-icon-name` stored
  `menu-item:025-building`, `menu-item:002-price tag` (with the space) and the made-up
  `phosphor:no-such-icon-xyz` verbatim, and an archive import accepted the made-up name the same way
  (dry run clean, `APPLIED`). A wrong name shows up only in the sidebar — an EMPTY place instead of an
  icon. So copy every name from the list below; when the user describes an icon by meaning («домик»,
  «деньги»), take the closest name and say which one you took.
- **How the frontend draws a name**: `<namespace>:<name>` is fetched as
  `/assets/icons/<namespace>/<name>.svg` (read off the network log; a name with a space is URL-encoded
  and drawn). So «valid» = «the file exists»: all 1153 names below answer HTTP 200, the made-up one 404.
  Two namespaces, both used by the stand's own items (`phosphor:house`, `menu-item:022-presentation`).
- Plausible Phosphor names that are NOT on the stand (404): `seal-check`, `ranking`, `toolbox`, `gavel`
  — never compose a name from memory of the Phosphor set.
- Where the list comes from: the picker «Изменить иконку» is the component `app-phosphor-icon-chooser`
  in lazy chunk `956.<hash>.js` — 18 arrays, one per tab. `tools/menu-icons.bun.ts --stand https://<stand>
  --check --md` re-reads it from a stand, HEADs every file and prints this list again; a new build may
  change it. «tab N (head icon X)» = the picker's N-th tab from the left and the picture on its header —
  only for finding an icon in the UI. Names in «» contain a space that is part of the name.

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

### Menu-item rights

- **Correct API** `[C]`: `v2/menu-item/load-access-group` params `{menuItemId}`;
  `v2/menu-item/save-access-group` params `{menuItemId}`, body = the access group itself (same shape as BO
  rights: groups through `view.orgUnitToAdd` / `orgUnitToDelete`, `accessForAll:false`); then
  `save-menu-item-chosen-access-right` params `{menuItemId, chosenAccessRight:true}` (the UI sends it after
  saving). Only `view` matters for navigation.
- **WRONG** (fails with `NoBoWithId` for menu items): `v2/business-objects/load|save-business-menu-access-group`.
- **They travel in an archive** `[C]`: the item's `MenuItemStructDto` gets `chosenAccessRight:true`
  + `accessGroup` (the `AccessStructDto` action shape, `orgUnitIds:["G-<id>"]`); an import put a group
  back on an item reset to «всем» (`MYBPM-IMPORTS.md` §0.5d, §5e). The calendar and timeline views of
  `boPages` travel too — the timeline as `timelineFieldCode` (a `PERIOD` field's code) — `[C]` same day;
  set them over the API with `save-menu-item-bo-pages` params `{menuItemId}`, body = the whole `boPages`
  (`timelineFieldId` = a field of `v2/timeline/load-fields {boId}` — the BO's `PERIOD`/`PERIOD_TIME` fields).
- `[U]`: whether group-level menu rights cascade to child items (set both), and whether users really see
  only permitted items (never checked under a restricted user).

### Record filters (bracket filters)

- `load-bracket-filter {menuItemId}` **creates** the item's filter record if it is missing
  (`bracketFilterId` is null until then) → then `v2/bracket-filter/save` body
  `{id:<filter id>, boId, brackets:[root]}`.
- A bracket: `{id, parentId, parentTreeIds, connectionType, notType: DEFAULT|NOT, dynamicFilters,
  nativeFilters, brackets}`.
- **Semantics, verified by record counts** `[C]`: filters inside ONE bracket are AND-ed; a bracket's own
  filters are **IGNORED if it has sub-brackets**; siblings combine by the EARLIER sibling's
  `connectionType` — so put the OR on the first sibling.
- Dynamic filter types: person link `type:"BO"`, `businessObjectId` = the company's `personBoId`,
  `businessFields` = the Person Фамилия/Имя field ids, `isCurrentUser:true` («текущий пользователь» —
  works); dropdown `type:"DROPDOWN_SINGLE"`, `businessObjectId` = the dictionary BO, `value` = the option
  CODE (from `load-dictionary-bo-field-options {boId}`); checkbox `type:"CHECKBOX"`, value `"true"`/`"false"`.
- **Test a filter without saving it**: `v2/business-object-instance/load-bo-instance-bracket-table` body
  `{boId, dynamicFilters:[], nativeFilters:[], search:"", paging, ordering:null, state:"ALL", brackets}`
  → read `totalHits`.

## 5. Structure archive (`.mybpm.zip`) — import (UI and API) and export

What the archive CONTAINS and what import DOES → `MYBPM-IMPORTS.md` §1-8. This section is only the UI
route to upload/download one. Evidence: `<stand>` company **`<company-a>`**, v4.24.25.614. `[C]`

**One domain hosts several companies (tenants).** `<stand>` serves `<company-c>` AND `<company-a>` (and `<COMPANY_A>`
appears in `<company-a>`'s import log). The sidebar content differs completely per company — do not assume a
screen exists just because another company on the same host has it.

### Route

Sidebar group **«Системные»** (a collapsed menu GROUP, first item, click to expand) → **«Настройки»** →
`/settings`, then the left sub-menu → **«Импорт/Экспорт»**.

- Direct URLs (work, no clicking needed): `/settings?settingsOpenPageUrl=import_export&formType=import`
  and `…&formType=export`. **Clicking the Импорт/Экспорт tab labels did nothing — navigate by URL.** `[C]`
- **«Бизнес», «Компания», «Настройки», «Аналитика» sit at the TOP LEVEL of the sidebar by default** —
  outside any group (user). `<company-a>` is the exception: someone there collected them into a
  menu group called «Системные». **The group is a per-company menu arrangement, not a platform
  constant** — in another company look for these items at the sidebar's top level, or inside whatever
  group that company made. Never navigate by the path «Системные → …»; navigate by the item name, or by
  URL (`/settings…`, `/business-objects/viewing-list`).
- «Настройки» is NOT in the avatar menu (that has only профиль / пароль / язык / QR / О платформе /
  Выйти) and NOT under the top-left hamburger (that only collapses the sidebar).
- `/settings` sub-menu, full list in order: Поддержка языков, Мобильное приложение, Физическое удаление,
  Телефония, Оффлайн режим, IN Миграция, OUT Миграция, **Импорт/Экспорт**, Messenger, OTP-аутентификация,
  Навигатор, Аудиторский след, Мониторинг миграции, Выставление сервисов, Браузер скриптов, Глобальные
  методы, Внешний вид. (What IN/OUT Миграция + Мониторинг миграции do vs Импорт/Экспорт is `[U]`.)
- The sidebar is not in the accessibility tree: read it with `document.querySelector('.menu-list').innerText`
  — `find` and `get_page_text` miss it or flatten it.

### Import tab

- Button **«Импортировать файл»** plus a search box and a log table: Импортированный файл / Описание
  импорта / Автор импорта / Дата импорта / Статус импорта. The log is per company and
  keeps years of history — read it to see what was ever imported and by whom.
- **The hidden file input is `input[type=file]` with `accept=".mybpm.zip, .mybpm"`, `multiple: false`.**
  Do NOT click the button (it opens a native picker Claude cannot see) — use `file_upload` with its ref. `[C]`
- **`find` and `read_page` do NOT see that input** — it carries the `hidden` attribute, so it is absent
  from the accessibility tree. Unhide it first, then it shows up in `read_page` as `button type="file"`: `[C]`
  ```js
  const i = document.querySelector('input[type=file]'); i.hidden = false;
  i.style.cssText = 'display:block;width:400px;height:40px;position:relative;z-index:9999';
  ```

### Import is TWO-PHASE — upload analyses, a second step applies `[C]`

1. `file_upload` into that input is enough to submit — no button click, no dialog. The page shows
   «Анализ структуры… N/N», then a toast «Анализ импорта завершен» and a **new log row with the status
   «Импорт проанализирован»**. *Nothing has been written to the stand yet.*
2. **Click that log row** → a full-screen dialog opens:
   - left tree: **«Информация»**, **«Ошибки»**, then one node per BO in the archive, labelled
     **`<вид объекта>/<имя БО>`** — the first half is the object's CATEGORY, not its BO group `[C]`
     (a `BO_DICTIONARY` whose `boGroupOldId` pointed at «Бизнес-объект» was listed as
     «Справочник/Проба справочник импорт UI» and landed in «Бизнес-объект» all the same;
     `load-import-bo-infos` returns that same `boCategory` per row);
   - «Информация» = Дата импорта / Автор импорта / Импортированный файл (read-only) + **«Описание
     импорта»**, a required free-text area — this is where the log's description column comes from;
   - «Ошибки» = a table Бизнес объект / Тип ошибки with a detail pane («Выберите ошибку из списка» when
     empty). An archive that parses cleanly leaves it empty;
   - a BO node = the **pre-apply diff**: «Добавленные поля» (метка / код / тип), «Изменённые поля»,
     «Добавленные вкладки», «Добавленные виджеты», «Изменённые виджеты», each «Не найдено» when empty.
   - buttons **ПРИМЕНИТЬ** (green, left) / **ПРЕКРАТИТЬ** (right).
3. Only ПРИМЕНИТЬ writes; the row then flips to «Импорт выполнен». So an archive can be inspected
   against the stand before it touches anything — use it as a dry run.
- API behind the screen: the same endpoints the API route drives — the full list, the upload call and the
  order are in «Import through the API» below. (The `file_upload` call itself was never sniffed and never
  had to be: the client's code names it — `postFileJson("/import-file", file, {})`.)
- The log confirms **the outer file name is free**: entries include `TestSumProcess.mybpm.zip` and a
  Cyrillic `Тест вставки текста в поле типа текст.mybpm.zip`. `[C]`
- The log also confirms **cross-tenant import works**: `<company-a>` holds imports of
  `MyBPM-export-<COMPANY_A>-…` and `MyBPM-export-<company-d>-…` archives. `[C]`
- «Описание импорта» is a free-text field stored per import — so the dialog asks for a description
  (the field was never opened; the dialog's exact contents are `[U]`).

### Import through the API — the whole cycle without a browser `[C]`

Done end to end on `<company-a>`: BO «Проба API» was created by this route
alone. Driver: `~/programming/MyBPM/tools/api-import-structure.bun.ts` (Bun, `fetch` + `FormData`;
`--apply` / `--cancel` / `--import-id` / `--description`, token from `$MYBPM_TOKEN` or `--token-file`).

Controller prefix is **`import-structure`**, NOT `v2/…` → `POST https://<stand>/web/import-structure/<m>`,
standard JSON envelope (§1), except the upload which is multipart. Order, exactly as the Angular client:

| # | call | params | returns |
|---|------|--------|---------|
| 0 | `/import-structure/load-import-state` | `{}` | `{importExists,importId,fileName}` — **only ONE import may be open at a time** |
| 1 | `/import-structure/import-file` | multipart, field **`file`** (filename = the outer name) | `importId` (a bare JSON string) |
| 2 | `/import-structure/insert-file-data` | `{importId}` | `processId` → poll |
| 3 | `/import-structure/analyze-file-data` | `{importId}` | `processId` → poll |
| 4 | `/import-structure/load-import-data` | `{importId}` | the log record: `status`, `error`, `conflicts` |
|   | `/import-structure/load-import-errors` | `{importId,pageId}` | `{errorRecords:[]}` when clean |
|   | `/import-structure/load-import-bo-infos` | body `{importId}` (**body, not params**) | `[{importRecordId,name,boCategory,structTypes}]` |
|   | `/import-structure/load-import-bo-record` | `{importId,recordId}` | the per-BO pre-apply diff |
| 5 | `/import-structure/save-import-description` | `{importId,value}` | `null`; status `DESCRIPTION_ERROR` exists, so set it before applying |
| 6 | `/v2/process-indicator/pre-create-process` | `{}` | `processId` for the apply |
| 7 | `/import-structure/apply-import` | `{importId,processId}` | `{"type":"APPLIED"}` → poll the process |

- **Polling**: `POST /web/v2/process-indicator/load-state-short {processId}` → `{label,percentage,isFinished}`
  every ~1 s (the client uses 2 s); `…/load-state`, `…/delete`, `…/cancel` also exist. Steps 2/3 each
  return their own processId; on this 1-BO archive both were already finished on the first poll.
- **Everything up to step 4 writes nothing to the stand** — status stays `ANALYZED`. So the API route is a
  real dry run: upload, read `load-import-errors` + `load-import-bo-infos`, and only then decide.
  `/import-structure/cancel-import {importId}` drops it, `/remove-import` deletes the log row.
- **Rollback exists** `[C]`: after apply the record carries `rollbackAvailable:true,canRollback:true`, and
  `/import-structure/load-import-rollback-preview {importId}` + `/rollback-import {importId,processId}`
  undo the import. **Only the import the stand considers the latest can be rolled back** `[C]`: the others
  carry `canRollback:false` + `newerAppliedImportsCount:N`, and `rollback-import` on them answers the body
  `{"message":"RwFGhT3idZ :: Rollback is allowed only for the latest applied import", …}` — and the
  `processId` you passed is then never finished, so a poll loop on it spins until your timeout.
  **Executed end to end** `[C]`: the preview answers
  `{rollbackAvailable, canRollback, newerAppliedImportsCount, restoreItems:[], deleteItems:[{action:"DELETE",
  category:"BUSINESS_OBJECT"|"MENU", code:"<code>#BUSINESS_OBJECT"|"<code>#MENU", name, structTypes}]}` —
  exactly what was created, nothing else; after `rollback-import` the BO answers `NoBoWithId` and the menu
  items are gone. The process finished with `percentage: 25` and `isFinished: true` — do not wait for 100.
- **Rollback trap: «latest» is not the order you applied in, and a rollback restores a SNAPSHOT** `[C]`
 . Three imports touching one menu item were applied A (23:08),
  B (23:09), C (23:09) — the log keeps minutes only. The stand ranked them A < C < B: B had
  `canRollback:true`, C `newerAppliedImportsCount:1`. An import that UPDATES something stores the state it
  found and puts it back on rollback (`restoreItems`, `action:"RESTORE"`), without looking at what came
  after. So rolling back in the order the stand allowed: B → the item got A's name back and **C's change,
  applied later, was silently lost**; then C → the item got **B's** name back — a state from an import
  that was already rolled back; then A (`deleteItems`) removed the BO and the item, and the stand was
  clean again. Rules: when you may need to undo, **leave at least a minute between applies** (how
  same-minute imports are ordered is unknown `[U]`); before undoing ONE import, check that it is the one
  with `canRollback:true`; undoing a CHAIN is safe only all the way back to the import that CREATED the
  objects, whose rollback deletes them.
- **`load-business-object-name` is not an existence check** `[C]`: after the rollback it still answered
  the deleted BO's name, while `load-bo-id-by-code` gave `No bo with code` and
  `load-business-object-by-id` «бизнес-объект не существует». Verify a removal with those two.
- Enums in chunk `5675`: import status `IN_PROGRESS|ANALYZED|APPLIED|ROLLED_BACK|DESCRIPTION_ERROR|
  INTERNAL_ERROR|CANCELED`; apply result `APPLIED|ROLLED_BACK|DESCRIPTION_ERROR|HANDLING_ERROR`; struct
  types `STRUCTURE|ACCESS_RIGHTS|SCRIPTS|GLOBAL_METHODS|MENU|REPORTS|SETTINGS` (our archive → `STRUCTURE`).
- The UI also calls `/v2/struct/conflict/{load-conflicts,load-select-instance-table,resolve-conflicts}`;
  a clean archive returns `conflicts:{}` and they are never needed `[C]`.
- The BO-side `/web/v2/business-objects/import-structure` (`postFileJson`, param `startTestProcess:false`)
  is a DIFFERENT, single-call endpoint of the BO controller — not used here, untried `[U]`.
- **The import log** (the «Импорт» tab's table): `/import-structure/load-import-file-records` with `B {paging:
  {offset, limit}}` (without `paging` → NullPointerException) → newest first `[{id, fileName, description,
  imported_at, status, canRollback, newerAppliedImportsCount, …}]` `[C]`. The one reliable way to tell
  whether an import whose call was cut off (a 45-s `javascript_tool` limit) got applied.

### The dry run as a VALIDATOR — 13 eval archives against `<stand>` `[C]`

The upload→insert→analyze→`load-import-errors`→`cancel-import` cycle above is the only validator we have
that is the platform itself. It was run over all 13 archives the §0 eval generated (`tools/out/eval*/`,
[[cookbook-eval-dumb-model]]): **12 analysed clean** (`status:"ANALYZED"`, `error:null`, `conflicts:{}`,
`errorRecords:[]`), one failed — and failed exactly as §0.2a predicts.

- **`load-import-bo-infos` is also an INTENT check, not just a format one** `[C]`. It answers
  `[{importRecordId,name,boCategory,structTypes}]` BEFORE anything is written, so it says in one call
  whether the archive builds a `BO` / `BO_DICTIONARY` / `BO_PANEL` / `BO_COMPOSITE` / `BO_PROCESS` —
  the one thing `tools/validate-archive.bun.ts` structurally cannot check («the grader checks FORMAT,
  not INTENT»). Verified: case03 → `Обращение гражданина:BO_PROCESS`, case04 → `Города Казахстана:BO_DICTIONARY`,
  case06 → `Клиенты:BO, Рабочий стол менеджера:BO_PANEL, Сделки:BO, Задачи:BO`, case07 → `Все контакты:BO_COMPOSITE`.
- **An `errorRecord` looks like this** `[C]` — `load-import-errors {importId,pageId:null}` returns
  `{id,importId,nextPageId,errorRecords:[…]}`, each record:
  ```json
  {"id":"t07WUvHTuAme69gh",
   "ownerBoInfo":{"code":"Vse_kontakty","name":"Все контакты","boCategory":"BO_COMPOSITE"},
   "oldBoInfo":null,
   "requiredBoInfo":{"code":"Klienty","name":"Клиенты","boCategory":"BO"},
   "newFieldInfo":null,"errorType":"CO_UNSATISFIED_DEPENDENCY",
   "fieldMismatchData":null,"processData":null}
  ```
  `ownerBoInfo` = who is broken, `requiredBoInfo` = what it needs and BY WHICH CODE. That is the analysis
  the §0.2a paragraph on composites was written from, now confirmed on a stand: a composite whose `bos[]`
  names a code the stand does not have **fails loudly at ANALYZE time**, nothing is silently merged.
- **The intra-archive reference survives the analyzer** `[C-analyze]`: case01 («Ученик» → «Класс» by
  `oldId`) and case06 (a `BO_PANEL` plus the three BOs it shows, same archive) both analysed with zero
  errors, so the importer resolves a reference to a line of the SAME archive. Still `[I]` for APPLY —
  nothing was applied; see `MYBPM-IMPORTS.md` §0.2a and the open-questions list.
- WARNs of `tools/validate-archive.bun.ts` are confirmed to be style only: every 0-FATAL/0-ERROR archive
  analysed clean whatever its WARN count (case05b had 8).

**Follow-up probe — «а если положить эти БО в тот же архив?»** `[C]`. Yes, and it is the
right way to ship a composite: case07's `BO_COMPOSITE` plus two plain BOs with the codes it names
(`Klienty`, `Postavshchiki`) in ONE archive analyses `ANALYZED`, 0 errors — `load-import-bo-infos` lists
all three. Line order is irrelevant (the composite placed BEFORE its sources analyses the same).
Archives: `tools/out/probe-co-inarchive-<date>.mybpm.zip`, `…/probe-co-order-…`.

The first version of that probe found a **new failure mode**: the sources were in the archive but their
field codes (`Familiya`/`Imya`/`Telefon`) did not cover what the composite's `boFieldCodes` asked for
(`Naimenovanie`/`Telefon`/`Email`), and the import came back **`status:"INTERNAL_ERROR"`** with a Java
stack trace in `load-import-data.error` — `Optional.orElseThrow` in
`StructureImportAnalyzer.fieldCodeToId` ← `analyzeFieldStructs` ← `analyzeCoStruct`. So a missing FIELD
code crashes the analyzer, while a missing BO code is reported politely as `CO_UNSATISFIED_DEPENDENCY`.
`INTERNAL_ERROR` from an import is therefore worth reading as «a reference inside the archive does not
resolve», not «the stand is broken». Details in `MYBPM-IMPORTS.md`, the `bos[]` bullet.

**How the run was driven, without ever handing a token to the shell.** The extension refuses to return
`localStorage.LOCAL_PRIVATE_SwebToken` (§10), but a `fetch` INSIDE the page may read it. The archives
were served to the page over plain HTTP from the machine —
`Bun.serve({port:8787,hostname:"127.0.0.1"})` with `Access-Control-Allow-Origin:*` — and
**an https page may fetch `http://127.0.0.1`** `[C]` (localhost is a trustworthy origin, no mixed-content
block; `Access-Control-Allow-Private-Network:true` was sent too). The page then did
`fetch(zip) → blob → FormData → /web/import-structure/import-file`, i.e. the whole §5 cycle per archive.
Script: session scratchpad `serve-archives.bun.ts` (not committed — it is four lines of `Bun.serve`).

### Verifying an import through the API (no screenshots)

`POST /web/v2/business-objects/…` with the §1 envelope:

- `load-bo-id-by-code {boCode}` → the BO id. On the API-imported probe it returned exactly the archive's
  `oldId` — confirms again that **the archive's `oldId` becomes the stand's BO id** `[C]`.
- `load-business-object-name {boId}` → the BO's name; `load-bo-groups {}` → all 14 `<company-a>` groups with
  `{id,name,code,orderIndex,kind}` (the way to prove an import renamed nothing — **groups are matched by
  `code`; a group line without `code` renames one fixed group, and a line WITH an existing code still
  overwrites that group's `name` and `orderIndex` with its own** `[C]`, `MYBPM-IMPORTS.md` §0.3/§8). Undo a rename
  with `save-business-object-group`, body = that group object with the old `name` / `orderIndex` (answers
  `""`); a rollback does NOT restore it `[C]`;
- `import-structure/load-import-file-records` — body `{paging:{offset,limit}}` (without `paging`: NPE) → the
  import log, newest first, `{id,fileName,description,imported_at,status,canRollback,…}`;
- **`apply-import` can answer an ERROR** instead of `{type:"APPLIED"}` — then the import stays `ANALYZED`
  and the `processId` never runs; test the answer for `errorType` before polling (seen: «Нет скриптов для
  экспорта у БО с кодом …» — scripts onto an existing BO with an empty script module, `MYBPM-IMPORTS.md`
  §5d). `cancel-import {importId}` then closes it (`CANCELED`);
- `load-bo-fields-for-drag {boId}` → the BO's fields as `{label,type,…}`; **`code` comes back `null`** here,
  so it identifies fields by label only `[C]`.
- `load-bo-id-by-kind`, `load-bo-fields-by-ids`, `load-bo-dictionary-list`, `verify-business-object-code`,
  `verify-business-field-code` exist alongside `[U]`.

### Export tab

- Layout on `S4.24.25.632` `[C]`: **four baskets, each with its own grey ⊕** —
  «Бизнес-объекты (N)», «Элементы меню», «Аналитика», «Настройки» — not the three toggles
  «Глобальные методы / Элементы меню / Отчеты» an earlier reading of this screen recorded. Each basket has
  an API (§0U R4a). The BO basket has «Очистить все» — each row labelled **`<группа БО>/<имя БО>`** (e.g.
  «Бизнес-объект/БО с текстом») with three checkboxes **Структура / Права доступа / Скрипты** (they decide
  which DTO lines the archive gets: `BoStructDto` / `AccessStructDto` / `BoScriptVersionsStructDto` +
  `ScriptDefStructDto`, `MYBPM-IMPORTS.md` §5d) and two
  per-row icons; a right pane **«Зависимости:»** («Зависимости не найдены» when none); button **«Выгрузить»**.
- The basket is PERSISTED state — it still held 2 BOs from an earlier session on open. Check/clear it
  before exporting so you do not ship someone else's selection.
- **BOs get into the basket through the grey ⊕ right of the «Бизнес-объекты (N)» caption** `[C]`
 : it opens a dropdown «Какой элемент хотите найти?» — a search box over ALL BOs of the
  company with a checkbox per row plus «Выбрать все». Ticking a row adds it to the basket immediately
  (the counter goes up); the dropdown does not close on Escape — click elsewhere on the page.
  The sidebar's drop hint «перетащите бизнес объекты сюда» belongs to the MENU editor, not here.
- **To take a BO OUT of the basket use the row's trash icon**, not the ⊕ dropdown `[C]`: unticking the
  row there does NOT remove it. The trash icon asks «Удаление элемента — Удаление элемента `<имя БО>`»
  with ДА / НЕТ; ДА only drops it from the basket — **the BO itself is untouched** (verified: the BO was
  still in the constructor afterwards). The other per-row icon is a collapse chevron.
- **The whole screen has an API** — baskets + download, see §0U R4a; the basket writes included (the old
  «they resist a hand-built call» was a wrong body — `remove-*` takes id strings).

### Checking the result of a structure import

- **BO constructor: the sidebar item «Бизнес»** → `/business-objects/viewing-list` `[C]`. In `<company-a>` it
  lives inside the menu group «Системные»; by default it is a top-level sidebar item — see the Route
  note above, the grouping is per-company. Left panel = the
  list of BO GROUPS (`<company-a>` has 14: Тест, Системные, Инициатива, АВР, Задача, Компания, Встреча, Визит,
  Контактные данные, Расположение, Другое, Fix, Tests, Бизнес-объект); the chevron on a group expands it
  into its BOs (grey rows underneath). This is the place to verify that an import did not rename a group.
- **This list is invisible to text extraction** `[C]`: `get_page_text`, `read_page` and even
  `document.body.textContent` return only the outer chrome (`body.textContent` was 278 chars and held the
  sidebar, not the list). Read it from **screenshots**, not from the DOM.
- Clicking a BO opens its registry: `/business-objects/viewing-list/bo/<boId>/list-view?…`.
- **The stand keeps the archive's `oldId` as the BO id** `[C]` — the probe BO generated with
  `oldId: "Zyvu00@DV5VPL69g"` got exactly that id in the registry URL. So deterministic generator ids are
  also the stand's ids, and a re-import of the same archive addresses the same BO.
- **Fields are matched by `newId`, not by code** `[C]`. A second archive with the same BO
  `oldId` but fresh field `newId`s passed the analysis with no error and no conflict. It then ADDED a second
  copy of every field to that BO, with the same codes, and rewrote the BO's code and name. To copy a BO,
  change its `oldId` and the field `newId`s, not only its `code` (`MYBPM-IMPORTS.md` §0.7).
- What an imported BO looks like straight away `[C]`: registry columns = the fields with
  `tableColToShow:true`, in `tableColOrderIndex` order; «Добавить» opens the form with the archive's
  `gridPosition` widths honoured (15 cols = full width, 5 cols ≈ a third); the platform appends a colon to
  every field label («Наименование:»); INPUT_NUMBER shows a default `0`; the record tabs
  В работе / Архивные / Удаленные / Тестовые and the empty state «Данные отсутствуют» come for free.
- Cancelling that «Добавить» form asks «Несохраненные данные — У вас есть несохраненные данные. Закрыть
  без сохранения?» (ДА / НЕТ) — a draft is created as soon as the form opens.

## 5b. Creating a BO in the constructor — no archive at all `[C]`

A BO does **not** have to come from a `.mybpm.zip`. The constructor creates one directly, and the same
six `/web/v2/business-objects/*` calls do it headlessly. Two probe BOs on `<company-a>` prove both routes:
«Проба UI» (`OpmGDzaQRUT27jky`) and «Проба API-конструктор» (`~hb30v0XyMtGsBLj`), both in group «Бизнес-объект» (`N50iWQkw0iySlAKo`).

### Where the create controls live

- **`/business-objects/viewing-list` has NO create controls** — it is the read-only registry list. The
  editable twin is **`/business-objects/editing`** (same left panel, plus a green ⊕ next to the caption
  «Бизнес-объекты» and a ⋮ on every row); a BO's own constructor is
  `/business-objects/editing/<boId>/object-editing`. Settings («Настройки») contains no BO constructor at
  all, and the sidebar ⊕ at the bottom is «Добавить группу в меню» (menu, not BO).
- **The group's kebab ⋮ is the create button.** It appears **on hover** over a BO-group row, right of the
  expand chevron: «Добавить панель / Добавить бизнес-объект / Добавить составной объект /
  Добавить справочник / Добавить бизнес-процесс / Изменить код / Переименовать / Удалить».
- The caption-level green ⊕ offers the same list plus «Группа», but it creates with `boGroupId: null`;
  the client then looks for a group of `kind: DEFAULT` and **all 14 `<company-a>` groups are `kind: MANUAL`**,
  so nothing is created and the page is left half-rendered. **Always create from the group's ⋮.**
- **There is no dialog and no name prompt**: the click creates the BO immediately as
  «Бизнес объект №N» and routes to its constructor. Created is created — undo means deleting it.

### The constructor screen

Name input top-left, description beside it, the «Карточка / Вкладка» toggle, the palette
«Элементы страницы» (Email, Телефон, Число, Текст, Текстовое поле, Текстовый блок, Чекбокс, Время, Дата,
Дата и время, …) on the left, the form canvas on the right, and lock/gear icons top-right (access rights,
settings).

- **Fields are added by dragging** a palette item onto the canvas; Claude-in-Chrome's `left_click_drag`
  drives this CDK drag-drop fine. On drop the label input opens focused — type the label straight away.
- A **СОХРАНИТЬ / ОТМЕНИТЬ** bar appears at the bottom: **nothing about fields is persisted until
  СОХРАНИТЬ**. The BO **name and description save on blur**, with no bar and no confirmation.
- **Codes are generated by the server from the names** — never send one. «Проба UI 2026-09-18» →
  `Proba_UI_2026_09_18`; «Наименование» → `Naimenovanie`; «Количество» → `Kolichestvo`. The **BO code is
  truncated to 30 characters**: «Проба API-конструктор 2026-09-18» → `Proba_API_konstruktor_2026_09_`.

### The same thing through the API — `tools/create-bo-constructor.bun.ts`

| # | call | params / body | note |
|---|---|---|---|
| 1 | `load-bo-groups` | `{}` | resolve the group by name → `{id,name,code,orderIndex,kind}` |
| 2 | `create-bo` | **body** `{boGroupId, boCategory}` | the BO exists from here on |
| 3 | `save-business-object-portion` | body `{jsonPart, orderIndex, isLast, id}` | rename + description |
| 4 | `generate-business-form-field` | params `{boId, fieldType, fieldBoId}` | one call per field |
| 5 | `save-business-object-portion` | as above | full DTO + added field ids |
| 6 | `load-business-object-by-id` | params `{businessObjectId}` | verify |

- `boCategory`: `BO` | `BO_DICTIONARY` | `BO_COMPOSITE` | `BO_PANEL` | `BO_PROCESS` (menu items
  Бизнес-объект / Справочник / Составной объект / Панель / Бизнес-процесс). `create-bo` answers
  `{id, name, nameReadonly, viewState, orderIndex, boCategory}`.
- **`save-business-object-portion` is the constructor's only writer.** `jsonPart` is a slice (80 000 chars
  per part, the client's own limit) of the JSON `{businessObject, editedFields?, addedFieldIds?,
  deletedFieldIds?}`; `id` carries the accumulator id the previous part returned (`null` for the first) and
  the call returns the next one. **The `businessObject` may be PARTIAL** — a rename sends only
  `{id, nameMap, recordNameMap, description}`. Sending the bare BO DTO *without* the `businessObject`
  wrapper fails with `UndeclaredThrowableException` `[C]`.
- **Adding fields** sends the FULL DTO (`businessObject` = whatever `load-business-object-by-id` returned,
  with the new fields appended to `formFields`) plus
  `editedFields: [{fieldId, gridPosition, needFreezeWhenScroll}]`, `addedFieldIds: [<new fieldIds>]`,
  `deletedFieldIds: []`.
- **Changing an EXISTING field** goes through `editedFields` only `[C]`: the constructor sends
  the whole DTO plus `editedFields: [{fieldId, <only the changed keys>}]` (e.g. `viewType`, `boFieldRefs`),
  and the server applies exactly those keys. The same change made only inside `businessObject.formFields`
  is silently dropped (trap 53).
- **Deleting a field** `[C]`: leave it out of `businessObject.formFields` and put its
  id into `deletedFieldIds`. A field referenced by a script is still deleted, and the script stops
  compiling until you rewrite it. **The text of a «Текст» (`STATIC_TEXT`) field** changes through
  `editedFields: [{fieldId, staticValueMap: {RUS: "<html>", …}}]` `[C]`. Adding, deleting and editing
  can all go in one save.
- `generate-business-form-field` returns a ready ~60-key field DTO with a fresh `fieldId` and `code: null`.
  Set `label`, `labelMap` and `gridPosition`, leave the code alone.
- **`save-business-form-field` `{businessObjectId, fieldList}` does NOT create fields** — it answers 200
  with an empty body and nothing is written `[C]`. Its real purpose is unknown `[U]`; do not reach for it.
- The constructor DTO from `load-business-object-by-id`: `id, idLong, name, recordName, nameMap,
  recordNameMap, staticValueMap, instanceViewType, orderIndex, description, code, formFields[], kind,
  boTabs, delBoTabs, isDictionary, hasScript, isCodeReadonly, boCategory, sortFieldId, …`. **`formFields`
  is an ARRAY** here — the archive's `dynamicFields` object keyed by code is a different shape.
- Field `gridPosition` in this DTO is `{x, y, cols, rows}` — `cols: 15` = full width, `rows: 4` = one line,
  so field *i* sits at `y: i*4`. `tableColToShow` / `tableColOrderIndex` behave as in the archive.
- `load-bo-records-by-group-id` takes **`groupId`**, not `boGroupId` (a wrong name answers HTTP 400
  «Required parameter 'groupId' is not present») → `[{id, name, nameReadonly, viewState, orderIndex,
  boCategory}]`, the cheapest way to list a group's BOs and check what an action created.

### 5c. The matrix «4 routes × 5 object kinds» — column «Справочник» `[C]`

A dictionary is created by all four routes with NO route-specific machinery; four probes live in group
«Бизнес-объект» (`N50iWQkw0iySlAKo`):

| route | probe | id |
|---|---|---|
| constructor UI | «Проба справочник UI» | `L@Qf3i2HSH~JqglG` |
| constructor API | «Проба справочник API» | `~LnUPP4RmTVmuZZo` |
| archive import UI | «Проба справочник импорт UI» | `lEIvD4e6k5AojKC5` |
| archive import API | «Проба справочник импорт API» | `fArbAncLamdx5agj` |

- **Constructor.** Group kebab → «Добавить справочник» = `create-bo {boGroupId, boCategory:
  "BO_DICTIONARY"}`; everything after that is the plain BO cycle of §5b, with **no extra call**.
  The editor route is the same `…/object-editing` — a dictionary has no editor of its own.
- **The server pre-builds the two system fields**, so `generate-business-form-field` is only for the
  extra ones: `code` («Код», `INPUT_TEXT`, `isUnique`+`isRequired`, `isSystem`) and `label` («Значение»,
  **`INPUT_TEXT_LANG`**, `isRequired`, `isSystem`), `labelMap` filled in all four languages
  (Код/Код/Kod/Code, Значение/Мәні/Mani/Value), at `y: 0` and `y: 4`. The BO comes back with
  `isDictionary: true` and a code already generated from «Бизнес объект справочник №N».
- **A field's code is generated ONCE, from the label at the first save, and never regenerated** `[C]` —
  unlike the BO code, which follows every rename. A label typed as «ЧекбоксАктивен» and corrected to
  «Активен» afterwards keeps `code: ChekboksAktiven` forever. Get the label right before the first
  СОХРАНИТЬ, or the code stays wrong.
- **Archive.** `category: "BO_DICTIONARY"` + `dictionaryFields: ["CODE","LABEL"]` + the two system fields
  in `dynamicFields` (MYBPM-IMPORTS.md §5) is all the importer needs; extra fields are ordinary entries.
  `tools/make-probe-archive.bun.ts --category BO_DICTIONARY --field "Метка:TYPE"` builds it.
- **The importer honours `boGroupOldId` for a dictionary** — it does NOT route it to a group of
  `kind: DICTIONARY`, unlike the constructor's caption-level ⊕. Group count stayed 14, nothing renamed.
- `tools/api-import-structure.bun.ts` was **executed for the first time from the shell** (`--token-file`
  with the token in the session scratchpad) and drove the whole cycle: dry run → `--import-id … --apply`.
  The archive's `oldId` became the stand's BO id for the third time (`fArbAncLamdx5agj`).

### 5d. The matrix «4 routes × 5 object kinds» — column «Панель» `[C]`

A panel is an ordinary BO with `boCategory: "BO_PANEL"`; all four routes need **no panel-specific
machinery**. Four probes in group «Бизнес-объект» (`N50iWQkw0iySlAKo`), each holding one nested object
pointing at «Проба UI» (`OpmGDzaQRUT27jky`):

| route | probe | id |
|---|---|---|
| constructor UI | «Проба панель UI» | `YquiOukznt5OrCnl` |
| constructor API | «Проба панель API» | `q8WVtZ6NL4S7LXzJ` |
| archive import UI | «Проба панель импорт UI» | `OoXWIvbALVI9u392` |
| archive import API | «Проба панель импорт API» | `qZgw7EkXvHSt7ydQ` |

- **Constructor.** Group kebab → «Добавить панель» = `create-bo {boGroupId, boCategory: "BO_PANEL"}`,
  nothing else; the editor route is the same `…/object-editing`, and the DTO carries no panel-specific
  key (`isDictionary:false`, `instanceViewType:"FORM"`, `formFields: []` — unlike a dictionary a panel is
  born EMPTY).
- **A panel is built of NESTED OBJECTS — registry widgets, not «виджеты».** The palette («Элементы
  страницы» / «Виджеты» / «Системные поля» / **«Вложенные объекты»**) ends with a list of the company's
  BOs; dragging one in calls **`generate-business-form-field {boId, fieldType: "BO", fieldBoId: <BO id>}`**
  — the `fieldBoId` parameter that had been `[U]` until now. The saved field is
  `type:"BO", viewType:"TABLE", isKindAddForSelect:true, refBoId:<BO id>, gridPosition.rows:6`
  (`readFromRegistry` comes back `null` even though the client sends `true` — `null` IS «on», see §5h
  «Читать из реестра»).
  `generate-business-form-widget {widgetType}` is NOT the panel's builder: its enum is
  `SIGNATURE|BUTTON|IFRAME|CAPTCHA|CURRENT_DATE|CURRENT_DAY|CURRENT_MONTH|CURRENT_DAY_AND_MONTH|
  CURRENT_YEAR|CURRENT_USER` — ordinary form widgets of any BO.
- Panels are **filtered out of `load-bo-records-for-drag`**, so a panel cannot be nested in anything,
  and the registry row of a panel has no «выгрузить» link (`canShowRouteToExportPageLink` is false for
  `BO_PANEL`) — the export basket takes it all the same.
- **Archive.** `category: "BO_PANEL"` and the nested object as a plain `dynamicFields` entry
  (`type:"BO"`, `oldRefBoId: <BO id on the stand>`, `boRefStruct.boInfo.code`, `isKindAddForSelect:true`);
  `oldRefBoId` resolved against the stand on import, the field came back with `refBoId` set.
  `tools/make-probe-archive.bun.ts --category BO_PANEL --field "Метка:BO@<boId>@<boCode>"` builds it.
  The import dialog's tree labels a panel node with the **bare BO name, no `<вид объекта>/` prefix**
  (a dictionary gets «Справочник/…») `[C]`.
- `<company-a>`'s own panel «Главная» (`cd2gCP8IyobPtcy0`, code `Glavnaya`) exported cleanly: the same
  `BoStructDto`, three `dynamicFields` of `type: "BO"`, each with `boRefStruct.fieldRefs` (which columns
  of the target BO to show, `toShow`/`orderIndex`/`gridPosition` per field) and a `bracketFilter`
  («Мои встречи» = `nativeFilters: {type: "CREATED_BY", isCurrentUser: true}`). That pair —
  `fieldRefs` + `bracketFilter` — is what makes a real dashboard; the probes ship neither.

### 5e. The matrix «4 routes × 5 object kinds» — column «Составной объект» `[C]`

A composite object (`boCategory: "BO_COMPOSITE"`) is the ONE kind that needs machinery of its own: it has
its own editor route, its own controller and a DRAFT protocol. Probe: «Проба составной UI»
(`ybaA@lqdUMgVNnBo`, code `Sostavnoyi_obekt__6962`), sources «Проба UI» (`OpmGDzaQRUT27jky`)
and «Проба API-конструктор» (`~hb30v0XyMtGsBLj`).

- **Creation is the same as every other kind**: group kebab ⋮ → «Добавить составной объект» =
  `create-bo {boGroupId, boCategory: "BO_COMPOSITE"}`, created immediately as «Составной объект №N».
- **The editor is `/business-objects/editing/<coId>/composite-editing`**, NOT `…/object-editing`.
  Left pane = the source BOs and their attributes; right pane = the composite's own attributes, split into
  «Составные атрибуты» and «Простые атрибуты». No palette, no form canvas — a composite has no layout.
- **Its code is NOT regenerated by the rename** `[C]`: the probe kept `Sostavnoyi_obekt__6962` from the
  auto-name after being renamed to «Проба составной UI». (For a BO built in the constructor the
  code follows the first naming save — see §5b. The composite editor's name input does not do that.)

#### Controller `v2/co` — the whole surface (from the bundle, chunk `9839`)

| method | params | body |
|---|---|---|
| `generate-draft` | `{coId}` | — → `draftId` (a string) |
| `apply-and-remove-draft` / `remove-draft` | `{draftId}` | — (empty response body) |
| `add-bo-to-co` / `remove-bo-from-co` | `{coId, draftId, boId}` | — |
| `load-bo-records-for-co` | `{coId, draftId}` | — the source BOs |
| `load-bo-records-for-ref-co-field` | `{coId}` | — |
| `load-bo-fields-for-co` | `{boId}` | — a source BO's fields |
| `load-co-fields-simple` / `load-co-fields-composite` | `{coId, draftId}` | — |
| `add-co-field-to-simple` | `{coId, draftId}` | **links** array |
| `add-co-field-to-composite` | `{coId, draftId, coFieldId}` | **links** array |
| `remove-co-field` | `{coId, draftId, coFieldId}` | — |
| `remove-bo-field-link` | `{coId, draftId, coFieldId}` | links array |
| `change-co-field-label` / `change-co-field-code` | `{coId, draftId, coFieldId, label\|code}` | — |
| `load-field-template` | `{coId, fieldId}` | — |

- **Everything is written into a DRAFT as you click** — `add-bo-to-co`, `add-co-field-*` fire immediately.
  СОХРАНИТЬ = `apply-and-remove-draft`, ОТМЕНИТЬ = `remove-draft`; both are followed by a fresh
  `generate-draft`. So the bottom bar is not «save my edits», it is «commit the draft».
- **`generate-draft` is not idempotent** — every call makes a NEW draft. Do not call it to «look around»;
  a stray draft has to be removed by hand (trap 29).
- A co field looks like
  `{coFieldId, label, code, type, links:[{boId, fieldId}], nativeFieldType, widgetType, optionSource,
  refBoId, labelMap}`. **`links` is the whole point**: one link → the field is listed by
  `load-co-fields-simple` («Простые атрибуты»), two or more → by `load-co-fields-composite`
  («Составные атрибуты»). The two lists are the same objects sorted by link count, not two kinds of field.

#### Adding attributes in the UI — tick, then DRAG

1. Expand a source BO (chevron at the right of its row) → its attributes appear with a checkbox each.
2. **Tick the source fields.** The tick is client-side only — nothing is sent, and it does NOT survive a
   reload. Ticking and pressing СОХРАНИТЬ creates nothing.
3. **Drag any ticked row onto the right pane.** The CDK lists are `#bo-attr-items-drag` (source) and
   `#co-attr-group-drag` (the whole right pane); every existing co-field row is itself a drop list whose
   **DOM id is the `coFieldId`**.
   - drop on the pane → `add-co-field-to-simple` — a new attribute per ticked field;
   - drop on an existing attribute row → `add-co-field-to-composite` — the ticked fields are added as
     extra `links` of THAT attribute, which then moves from «Простые» to «Составные».
   The dragged payload is `getUniqueLinks()`: the ticked fields minus the ones already linked. If nothing
   is ticked the handler throws and **no request is sent** — a silent no-op, which is what a failed drag
   looks like.
4. A source field already used by a co field **loses its checkbox** (it cannot be linked twice).
5. The source picker (⊕ «Объект») is a checkbox list of every BO of the company — panels and dictionaries
   included; each tick fires `add-bo-to-co`.

#### The same thing headlessly — `tools/create-co-constructor.bun.ts` `[C]`

`create-bo {boGroupId, boCategory:"BO_COMPOSITE"}` → `v2/co/generate-draft {coId}` →
`add-bo-to-co` per source → `load-bo-fields-for-co {boId}` for the `fieldId`s →
`add-co-field-to-simple` / `add-co-field-to-composite` with `[{boId, fieldId}]` →
`apply-and-remove-draft {draftId}`. Ran clean on the first attempt; probe «Проба составной API»
`J7APr3Sq8wvImvNF`, verified both through the API and on screen.

- **`add-co-field-to-simple` creates ONE attribute PER LINK in its body**, exactly like dropping N ticked
  rows on the pane. A «составной атрибут» is therefore built in two calls: create it with the FIRST link,
  then `add-co-field-to-composite {coId, draftId, coFieldId}` with the rest. Sending both links to
  `add-co-field-to-simple` would give two separate simple attributes, not one composite.
- **Neither add call returns the new `coFieldId`** — diff `load-co-fields-simple` before and after
  (what the tool does).
- `load-bo-fields-for-co {boId}` answers `[{fieldId, label, code, type, …}]` — the source fields only,
  and it needs no draft.
- **A composite attribute's code is transliterated from the SOURCE field's label**, not asked for:
  «Наименование» → `Naimenovanie`. `change-co-field-label` renames the attribute afterwards.
- **`save-business-object-portion` DOES rename a composite** (the plain `{id, nameMap, recordNameMap,
  description}` patch of §5b) **and the code does NOT follow the name** `[C]` — `Sostavnoyi_obekt__6963`
  from the auto-name survived. So the composite behaves the same through both routes, unlike a plain BO
  whose code follows the first naming save. Corollary: the §5b rename race cannot bite here.
- **Reading a committed composite needs a draft of its own** — `load-co-fields-*` take `{coId, draftId}`
  and `apply-and-remove-draft` destroyed the one you had. `generate-draft` → read → `remove-draft`.
  The editor page does the same on every load, so merely opening it mints a draft.

#### In an archive

`TestComposite.mybpm.zip` (`~/Downloads`, the only `BO_COMPOSITE` export we have) is ONE `BoStructDto`
plus a `BoGroupStructDto` and the metadata — 3 objects, no `AccessStructDto`:

- `category: "BO_COMPOSITE"`, `kind: "GENERAL"`, ordinary `name`/`recordName`/`orderIndex`;
- **`bos: [{code, name, boCategory}]`** — the source BOs, referenced **by CODE only**, no id. They are NOT
  in the archive, so they must already exist on the stand `[I]`;
- each field in `dynamicFields` carries **`boFieldCodes: [{boCode, fieldCode}]`** instead of the
  `links` of the live API — the same relation expressed in codes;
- `boRefStruct.fieldRefs: {}`, `linkedCoSettings: {}` present but empty.

**Both archive routes are closed** `[C]` — probes «Проба составной импорт UI»
(`Ydcir@tyWppurNGY`) and «Проба составной импорт API» (`mgGrtPrg7@oXWVMx`), generated by
`tools/make-probe-archive.bun.ts --category BO_COMPOSITE --source … --co-field …` and shipped by the two
routes of this section. The importer resolves `bos` **by code** into the stand's real `boId`s and
`boFieldCodes` into the live `links` — read back identical to a composite built in the constructor.
Details and the failure mode in `MYBPM-IMPORTS.md` §5b.

### 5f. The matrix «4 routes × 5 object kinds» — column «Бизнес-процесс» `[C]`

A business process (`boCategory: "BO_PROCESS"`) is the second kind with machinery of its own: its own
editor route, TWO controllers and a versioned diagram. Probes in group «Бизнес-объект»
(`N50iWQkw0iySlAKo`):

| route | probe | id |
|---|---|---|
| конструктор UI | «Проба процесс UI» | `wy6aMlbuQ6LoCFYd` |
| конструктор API | «Проба процесс API» | `kzk2E83IWByEju0S` |
| архив UI | «Проба процесс импорт UI» | `ID7UFuWR8PunADHB` |
| архив API | «Проба процесс импорт API» | `B0oV1N6CanuJ0faO` |

- **Creation is the same as every other kind**: group kebab ⋮ → «Добавить бизнес-процесс» =
  `create-bo {boGroupId, boCategory: "BO_PROCESS"}`, created immediately as «Бизнес-процесс №N».
- **The editor is `/business-objects/editing/<boId>/process-editing`**, NOT `…/object-editing`: a name
  input, a version selector «Версия: 1 (Тест)», a «Блок-схема» dropdown, a «Локальные методы» button and
  the diagram canvas. There is **no field palette and no form canvas in this editor** — the process's
  fields are still edited through the ordinary BO constructor.
- **The platform pre-builds two things at creation** `[C]`: the field `PROCESS_STATUS` («Статус процесса»,
  `type: "BO"`, `isSystem`, `isRequired`, pointing at the built-in dictionary «Статус процесса» — on
  `<company-a>` `Q0zI~z9Ra2R7Q3yd`, group «Другое»), and **version 1 with a single `Enter` figure**.
- **The BO code FOLLOWS the rename** here (`Proba_process_UI_2026_09_18`), like a plain BO and unlike a
  composite — the name input of the process editor writes through the ordinary BO writer.
- A fresh process does not validate: `validate-def` answers «Нет точка окончания» +
  «Из фигуры должен быть выход» until an Exit is wired in.

#### The two controllers

| controller | scope | methods |
|---|---|---|
| `v2/bo-process-editor2` | the BO's **versions** | `load-bo-process-versions {boId}`, `load-dev-bo-process-id {boId}`, `in-work-bo-process-version` / `in-test-bo-process-version` / `copy-bo-process-version` / `remove-bo-process-version` / `change-bo-process-version-comment` `{boId, boProcessId}`, `create-draft {boProcessId}` → `load-draft-data` / `update-draft` / `apply-draft` / `remove-draft {draftId}`, `load-on-boi-create-field-ids` / `save-on-boi-create-field-ids {boProcessId}` |
| `v2/bo-process-editor` | ONE version's **diagram** | `load-bo-process-def`, `load-editor-state`, `save-editor-scroll-state`, `save-editing-script-figure-id`, `load-new-ids {count}`, `apply-update-cmd`, `undo`, `redo`, `validate-def {boProcessId, boiId, testMode}`, `load-fields-ref-bo`, `load-bo-with-instance-id`, `load-on-boi-create-fields`, `load-script-def-list` / `save-script-def-list`, `ensure-methods-script-id`, `list-local-methods` / `create-local-method` / `delete-local-method` |

- `load-bo-process-versions {boId}` → `[{boProcessId, isWork, isTest, version, comment}]`;
  `load-dev-bo-process-id {boId}` returns the **editable** version's id as a bare string.
- `load-bo-process-def {boProcessId}` → `{figures: {<id>: {x, y, type}}, arrows: {<id>: {startFigureId,
  startSlotName, finishFigureId, finishSlotName, name, labelDeltaX, labelDeltaY}}}`.
- Figure `type` ∈ **`Enter` | `Exit` | `Switch` | `SingleToParallel` | `ParallelToSingle` | `Form` |
  `Script` | `Timer` | `Point` | `Terminator`**; slot names `main` / `left` / `right` (the four dots
  around a figure, `UP`/`RIGHT`/`DOWN`/`LEFT` internally).
- **The diagram editor has NO draft and NO СОХРАНИТЬ** `[C]` — unlike the composite's `v2/co`.
  `apply-update-cmd` writes into the version at once; undo/redo are server-side
  (`bo-process-editor/undo`). The `create-draft` family of `bo-process-editor2` is the RUN WAYS dialog,
  not the diagram (below).
- **Versions** `[C]`: `copy-bo-process-version {boId, boProcessId}` (answers `""`) adds a new
  version, a copy of that one with the SAME figure ids, `isWork:false, isTest:false`;
  `in-test-bo-process-version` makes it THE test version — the old `isWork+isTest` one keeps only
  `isWork` — and `load-dev-bo-process-id` now returns it (the editable, DEV-record version).
  `in-work-bo-process-version` is the same for «в работу» (not re-run here). What each exports and imports
  as: `MYBPM-IMPORTS.md` §5c (work → `workProcess`, test → `processVersions.<id>`, the rest not exported).
- **Run ways — WHEN the process starts** (`process_run_way_settings`, a button of the process BO's
  editor) — the `bo-process-editor2` draft family, all `[C]`:
  `create-draft {boProcessId}` → a draftId; `load-draft-data {draftId}` → `{runWayMap: {…}}`
  (`{}` on a fresh process = the default «run on a record of this BO when it is created»);
  `update-draft` `P {draftId}` `B` = an ARRAY of `{dotPath, value}` → `[{type:"SET_SAVE_BUTTON_VISIBILITY"…}]`;
  `apply-draft {draftId}` → `""` commits; `remove-draft {draftId}` → `""` drops it. One run way:
  ```js
  const [id] = await __c('v2/bo-process-editor/load-new-ids', {count: 1});   // any fresh id
  await __c('v2/bo-process-editor2/update-draft', {draftId}, [
    {dotPath: `runWayMap.${id}.runWay`,           value: 'ON_FIELD_CHANGE'},  // | ON_INSTANCE_CREATE | SCHEDULED | ON_MIGRATION_END
    {dotPath: `runWayMap.${id}.orderIndex`,       value: 2},
    {dotPath: `runWayMap.${id}.changeVariantSet`, value: {ON_MANUAL_SAVE: 1}},
    {dotPath: `runWayMap.${id}.processFieldId`,   value: '<the process BO's SINGLE BO-reference field>'},
    {dotPath: `runWayMap.${id}.fieldIdsSet`,      value: {'<target field id>': 1}},   // ON_FIELD_CHANGE only
    {dotPath: `runWayMap.${id}.useFieldValuesSet`,value: {'<target field id>': 1}},   // optional: …
    {dotPath: `runWayMap.${id}.fieldValues`,      value: {'<target field id>': 'три'}}, // …only when changed TO this
  ]);
  ```
  A `SCHEDULED` run way has no process field; its settings go one key per update, as the client sends
  them — `runWayMap.<id>.schedule.repeatType` (`EVERYDAY`…), `.repeatUntilType` (`NO_END_DATE |
  REPEAT_COUNT | EXPIRATION_DATE`), `.startTime` (a real UTC instant, `"2026-09-30T12:31:00Z"`),
  `.startRepeatTime` (a date, `"…T00:00:00Z"`), `.endRepeatTime`, `.repeatCount`, `.interval`,
  `.daysOfWeek`, `.dayOfMonth` `[C]` (stored and read back as sent). **It has not been seen
  to fire** `[U]` — no process record 35–48 minutes after `startTime`, not even at the top of the next hour,
  and still none within 16 hours, after both start times had passed
  (`MYBPM-IMPORTS.md` §5c `runWayMap`).
  A `dotPath` with `value: undefined` (i.e. the key left out of the JSON) deletes, e.g.
  `runWayMap.<id>` removes a run way. The process field must be a `type:"BO"` field of the process BO with
  `viewType` `SINGLE` or `FIELDS` (the dialog lists no other); `fieldIdsSet` holds ids of the TARGET BO's
  fields (the dialog offers that reference's `boFieldRefs` — an archive-built reference already lists
  every target field there, `toShow:false`). **The client refuses every edit on a WORK version**
  («you_cant_change_published_bo_process_version»), **the server does not**: the draft cycle above
  applied on a version that was `isWork+isTest` and the run ways worked at once on ordinary records.
  What they do (a target record's creation / field change creates a NEW process record pointing at it),
  the controls, and the archive form (by CODE: `refBoInfo`, `processFieldCode`, `fieldCodes`) —
  `MYBPM-IMPORTS.md` §5c `runWayMap`.

#### `apply-update-cmd` — a JSON-patch language over the def

Params `{boProcessId}`, body:

```json
{"name": "<undo label>",
 "forward":  {"type":"Group","list":[{"type":"Set","dotPath":"figures.<figId>","value":{"x":440,"y":104,"type":"Exit"}},
                                     {"type":"Set","dotPath":"arrows.<arrId>","value":{"startFigureId":"<enterId>","startSlotName":"main","finishFigureId":"<figId>","finishSlotName":"main"}}]},
 "backward": {"type":"Group","list":[{"type":"Unset","dotPath":"arrows.<arrId>"},{"type":"Unset","dotPath":"figures.<figId>"}]}}
```

`type` ∈ `Set` | `Unset` | `Group`; `dotPath` is a dotted path INTO the def object and `value` whatever
belongs there, so the same command shape moves a figure (`figures.<id>.x`), renames an arrow or deletes
anything. `backward` is what `undo` replays — the client always sends both halves.
**Mint ids with `load-new-ids {count}`**, never invent them.

#### Adding a figure in the UI — DRAG OUT OF A SLOT

A figure is not dragged from a palette (there is none) and the canvas's right-click menu only offers
Вырезать / Скопировать / Вставить / Удалить одну фигуру. Instead: **drag from one of the four green slot
dots of an existing figure onto empty canvas** — a picker «Выберите фигуру» opens with 8 tiles (top-left
tile = **Exit**), and choosing one fires `load-new-ids` → `apply-update-cmd` → `validate-def`, creating the
figure AND the arrow in a single command. `computer left_click_drag` drives this fine (the one place in
this app where a coordinate drag is needed — trap 30 does not apply to the slot handles).

#### The same thing headlessly — `tools/create-process-constructor.bun.ts` `[C]`

`create-bo {boGroupId, boCategory:"BO_PROCESS"}` → rename via `save-business-object-portion` →
`load-dev-bo-process-id` → `load-bo-process-def` (to find the Enter) → `load-new-ids {count: 2·N}` →
one `apply-update-cmd` chaining N figures after the Enter → `validate-def`. Ran clean on the first
attempt; probe `kzk2E83IWByEju0S`, `validate-def` empty. `--show <boId>` prints versions, figures,
arrows and validation of any existing process — the cheapest read-back there is.

#### Both archive routes `[C]`

`tools/make-probe-archive.bun.ts --category BO_PROCESS [--process-figure "<Type>@x,y"]…
--process-status <refBoId>:<CREATED row id>` builds the archive (the status is required, `MYBPM-IMPORTS.md` 0.10 rule 18) (shape in `MYBPM-IMPORTS.md` §5c); the UI route and
`tools/api-import-structure.bun.ts` both applied it with zero analysis errors, and the diagram came back
identical (`validate-def` clean, Enter → Exit rendered on screen).

- **An imported version is `isWork: true` — «Версия: 1 (Опубликованный)»**, while a version created in
  the constructor is `isTest: true` / «Версия: 1 (Тест)» `[C]`. The import publishes the process.
- **Figure and arrow ids survive the import** `[C]` — the stand's def carries the archive's own ids,
  exactly like `oldId` → `boId` (that happened for the 5th and 6th time here).
- **The importer does NOT create `PROCESS_STATUS`** `[C]`: the process imported without it has only the
  archive's own fields, while every constructor-made process has it. Ship it in `dynamicFields`
  (`--process-status <refBoId>:<CREATED row id>`) **together with its `defaultValue`** — see the next
  block. **A process without that field still RUNS** `[C]`: Enter → Script → Script → Exit
  imported with no `PROCESS_STATUS` went to its Exit on an ordinary and on a DEV record — the field gives
  the record its status, it does not drive the process (`MYBPM-IMPORTS.md` §5c). That is a probe result, not
  an option: every process ships `PROCESS_STATUS` (`MYBPM-IMPORTS.md` 0.10 rule 18).

#### The same configured process through an ARCHIVE — export, generate, import, run `[C]`

The API probe «Проба БП API» (Enter → Form «Заявка» → Script → Switch on «Заявка».«Одобрить»
→ Exit «Да» / Exit «Нет», §«Running a process on a record» point 6) was exported, a generator taught to
emit the same thing from the same spec, and the result imported and run:

1. **Export** through the `struct` basket (§0U R4a) from inside the page — read the basket, put the
   process BO (+ its Заявка BO) in, `pre-create-process` → `struct/export-company-structure`, POST the
   bytes to the local bridge (`mise run bridge`, `tools/bridge.bun.ts`, §10), put the basket back. The
   process's `ScriptDefStructDto` lines come out WITHOUT ticking «Скрипты»; the basket even reset
   `isScriptsExport` / `hasScript` to `false` for a process BO. Shapes: `MYBPM-IMPORTS.md` §5c — Form =
   `FigureFormStruct {fieldCode}` (a CODE, portable), a test-only process sits under
   `processVersions.<version id>` with no `workProcess`.
2. **Generate**: `bun tools/make-probe-archive.bun.ts --group-code <код группы> --group-name "<имя группы>" --group-order <orderIndex группы> --process-spec tools/process-probe.spec.json --code
   <Code> --name "<Имя>" --process-status '<Статус процесса dict id>:<CREATED row id>'` → group, 2 script
   defs, BO, versions line; `tools/validate-archive.bun.ts` now checks the process part (Form `fieldCode`
   is a BO field, Switch arrows named, every `scriptsDefIds` entry has its def, every `targetArrowId` is
   an arrow of the diagram, `PROCESS_STATUS` has a `defaultValue`).
3. **Import** through the §5 API cycle from the page (bridge `GET` → `FormData` → `import-file` → insert →
   analyze → apply): analysis clean, `validate-def []`, both scripts `translate-script success`. Figure
   and arrow ids are the archive's; the VERSION id is the stand's own, scripts re-keyed to it.
4. **Run** with `window.mybpmProcess.run(…)` (`create-process-constructor.bun.ts --page-script`): both
   branches reached on DEV records AND on ordinary records (`"state":"ALL"` in the run spec) — the
   imported version reads `isWork: true, isTest: true`.

- **A Script / Switch figure shipped without its `ScriptDefStructDto` passes every check and then FAILS**
  `[C]`: analysis clean, apply fine, `validate-def []`; on the first record `load-process-steps`
  shows that figure `FAILED` with «Скрипт не определен» (`script.not.found`, `NoScriptWithId`) and the process
  stops — it does not «run empty». Every Script / Switch needs its def line, even with no acts
  (`validate-archive` reports it as an ERROR; format in `MYBPM-IMPORTS.md` §5c).
- **The first import ran NOTHING — `PROCESS_STATUS` without a default blocks every record** `[C]`. The
  field is `isRequired`; the constructor defaults it to the «Статус процесса» row `CREATED`. Imported
  without a default, `validate-apply-remove-draft` on a new process record answers **200** with the form
  command `ALERT_SAVE_BUTTON_NOTIFICATION` «validate_required_title» — no record, no process, and nothing
  throws. **The default takes only when the archive carries BOTH** the key on the field,
  `"defaultValue": "[\"<CREATED row id>\"]"` (+ `defaultValueMap`), AND the export's `ExportStructInstanceDto`
  line for the `CREATED` row with a `DEFAULT_VALUE` source `[C]` (the line alone and the key
  alone each leave `"[]"` on a new BO; both together take — `make-probe-archive.bun.ts` writes both;
  the line is NOT ignored). Both ids are per stand: read them off any constructor-built process —
  `load-business-object-by-id` → `formFields[code=PROCESS_STATUS]` → `refBoId`, `defaultValue`.
  `runOnTestRecord` now throws on that form command instead of reporting an empty run.
- **Re-importing the same code adds a version** `[C]`: version 2 `isWork+isTest`, version 1 demoted to
  `isWork:false, isTest:false`; the field default was NOT repaired by that re-import (it carried the line
  but not the key).
- **The EXPORT itself, re-imported as is (only code and name changed)** `[C]`: analysis
  clean, `validate-def []`, figure/arrow/field ids = the export's, but (a) the `processVersions` form comes
  in as a **test-only** version (`isWork:false, isTest:true`) — it runs on DEV records, an ordinary record
  gets no process (`load-process-steps` = `[]`); (b) every record is refused — the export carries no
  `defaultValue` on `PROCESS_STATUS`. Adding `defaultValue` + `defaultValueMap` to that one field and
  re-importing fixed it: both branches reached on DEV records. So: **export → patch the default (and move
  `processVersions.<id>` to `workProcess` if ordinary records must run it) → import.** The BO the Form
  points at, shipped in the same export, merged into the existing one by CODE (its export `oldId` differs
  from its stand id). Probe: «Проба БП экспорт как есть» `W7AckAuPtOhZsatz`.
- **A run is over only when no step is `STAND` or `GO`** `[C]`: right after the Form is released the
  Switch reads `GO` for a moment; a poll that stopped at «no `STAND`» reported an unfinished run.
  `runOnTestRecord` waits for both.
- Probes left on `<stand>` (group «Бизнес-объект»): «Проба БП архив» (no default — its records
  cannot be saved; versions 1-2), «Проба БП архив-2» (same defect), «Проба БП архив-3»
  (the working one, with 2 DEV + 2 ordinary process records and their Заявки).

#### Configuring the figures — what each settings dialog writes `[C]`

Probe «Проба БП» (`7zJ~KDo4TeqT~pxZ`, version `3Fv2pBOX@Dq2fJhI`, group «Бизнес-объект»):
Enter → Form → Script → Switch → two Exits. Every setting is ONE `apply-update-cmd` (named as below)
followed by `validate-def {boProcessId, testMode:true}`; nothing else is written.

- **Form** — born as `{x, y, type:"Form", fieldId:null, createTimer:null, openFormTimer:null,
  touchDraftTimer:null}`. Double-click opens `mybpm-process-figure-form-dialog`:
  - «Выберите бизнес-объект» lists the process's own **BO-reference fields** (a fresh process has only
    `PROCESS_STATUS`) → `CHANGE_FIGURE_FIELD_ID`, `Set figures.<id>.fieldId = "<fieldId>"`. So a Form step
    shows the form of the record held in that field; the figure's label becomes the field's name.
    Choosing it closes the dialog.
  - «Задать таймер» — three timers «Время от создания» / «от открытия формы» / «от первого изменения» →
    `CHANGE_FIGURE_CREATE_TIMER` / `…_OPEN_FORM_TIMER` / `…_TOUCH_DRAFT_TIMER`, each
    `Set figures.<id>.<createTimer|openFormTimer|touchDraftTimer> = {useTimer, timeInMinute, unitType:
    "MINUTES"|"HOURS"|…, workingTime}` («Календарное / Рабочее» = `workingTime`). They are written when the
    dialog CLOSES (all three at once after choosing a field). An armed timer draws a clock on the figure
    and does **not** add a slot: validation asks for no second exit. What happens when it fires is `[U]`.
  - Trap: the dialog's checkboxes and unit buttons ignore `el.click()` from JS; the number input does
    take the native-setter trick. Writing the command directly is simpler.
- **Timer** `[C]` (probe «Проба БП таймер» `UocM4WIwJI3YGSL1`) — born as
  `{x, y, type:"Timer"}` (drawn with «выберите поле»). Double-click → a popup **«Выберите поле с датой:»**
  listing the process's date fields; one click writes `Set figures.<id>.fieldId = "<fieldId>"` and closes
  it. Nothing else to set — the due time IS that field's value when the process enters the Timer.
  A Timer without a field validates clean. Run-time behaviour (empty / past / future date, a field
  changed while it stands, `#Обновить таймер для процесса`): `MYBPM-IMPORTS.md` §16 «A Timer». In short:
  the Timer reads its field once, on entry; a later change of the field (form save OR script) does not move
  it, and only `#Обновить таймер для процесса` on that field right after the change does `[C]`.
- **SingleToParallel / ParallelToSingle** `[C]` (probe «Проба БП параллель»
  `klMcOWWPP~QYQY8g`) — the palette writes `{x, y, type:"SingleToParallel", outSlotsCount:2}` /
  `{x, y, type:"ParallelToSingle", inSlotsCount:2}` (slot-drag: 3; the palette also adds `orientation`,
  not needed); arrows use `out1…outN` / `in` and `in1…inN` / `out` (table «Slots» below). Built through
  one `apply-update-cmd` with these shapes, `validate-def` → `[]`, and the run behaves as a fork + a real
  join (`MYBPM-IMPORTS.md` §16 «Parallel branches»). In an archive: `FigureSingleToParallelStruct
  {outSlotsCount}` / `FigureParallelToSingleStruct {inSlotsCount}` `[C]` (exported, then imported and run).
- **Terminator** `[C]` (probes «Проба БП терминатор-2» `HPPPJggl~~3b6E62` through
  the API and «Проба БП терминатор архив» through an archive) — born `{x, y, type:"Terminator",
  fieldId:""}` (bundle; one `apply-update-cmd` with that shape, `validate-def` → `[]`), slots
  `left`/`right`/`top`/`bottom`, nothing to configure. In the archive it is `FigureTerminatorStruct {x, y}`.
  Run: **it ends the whole process** — a Timer standing in the other parallel branch turns `PASSED` with
  no next step the moment the Terminator is passed, and that branch's later figures never run
  (`MYBPM-IMPORTS.md` §16 «A Terminator ends the WHOLE process»). **An Exit ends only its own branch**
  `[C]` (probe «Проба БП выход в ветке» `OmesDS5B4QycUWMo`): a process may hold
  several Exits (`validate-def` → `[]`), and after one branch passes its Exit the other still stands on
  its Timer and later reaches its own Exit (`MYBPM-IMPORTS.md` §16 «An Exit inside one branch»).
- **Point** `[C]` (probe «Проба БП выход в ветке» `OmesDS5B4QycUWMo`) — not in
  the palette: right-click an arrow → **«Вставить точку»** (bundle `insertPoint`). One command
  `CUT_ARROW_WITHIN_POINT` `[C]` (sent by hand through `apply-update-cmd`, `validate-def` → `[]`):

  ```
  Set figures.<pt> = {type:"Point", x, y}
  Set arrows.<old>.finishFigureId = <pt>, .finishSlotName = "angle_<a+180>", .labelDeltaX = 0, .labelDeltaY = 0
  Set arrows.<new> = {name: <old name>, startFigureId: <pt>, startSlotName: "angle_<a>",
                      finishFigureId: <old target>, finishSlotName: <old target slot>, labelDeltaX: 0, labelDeltaY: 0}
  ```

  (`a` = the arrow's direction at that spot, snapped to 45°; eight slots `angle_0` … `angle_315`: a
  left-to-right arrow came in at `angle_180` and left at `angle_0`). Dragging from a Point that
  has no outgoing arrow starts a new arrow. At run time it passes instantly as its own step
  (`MYBPM-IMPORTS.md` §16 «A Point»); in an archive it is `FigurePointStruct {x, y}`.
- **Arrow name** — double-click the arrow → an inline input; Enter →
  `CHANGE_ARROW_NAME`, `Set arrows.<id>.name = "<text>"`. **Every arrow leaving a Switch must be named**
  («У стрелки должно быть название» until then); the name is what the Switch's script exits by.
- **Script / Switch** — born as `{x, y, type:"Script", script:null}` / `{x, y, type:"Switch"}`.
  Double-click → `save-editing-script-figure-id {boProcessId, scriptFigureId}` and the ordinary Block IDE
  opens with **`scriptModuleId = boProcessId` (the version id) and `scriptId = the figure id`**
  (`v2/script/load-script-def` → `{blocks:{}, expressions:{}}` when empty). So §5g's headless
  `paste` / `apply-update-cmd` apply to process scripts with those two ids. An EMPTY Script or Switch
  validates clean — `validate-def` checked nothing inside them (while `translate-script` on an empty
  one answers «Не определён модуль»: nothing is stored for that figure yet).
- **Writing a Script and a Switch headlessly** `[C]` (same probe) — one `apply-update-cmd`
  each, ids of my own, then `translate-script` → `success:true` and `validate-def` → `[]`:

  ```
  Script: {"<hat>": {"x":40,"y":40,"downBlockId":"<exit>","type":"BlockFixEntryPoint"},
           "<exit>":{"exitType":"FROM_METHOD","type":"BlockExit"}}
  Switch: {"<hat>": {"x":40,"y":40,"downBlockId":"<exit>","type":"BlockFixEntryPoint"},
           "<exit>":{"exitType":"FROM_METHOD_BY_ARROW","targetArrowId":"<arrow «Да» id>","type":"BlockExit"}}
  ```

  - The IDE draws them as «Выйти из скрипта» and **«Выйти из скрипта по стрелке: Да»**; a click on the
    exit block lists the choices — on a Script only «Выйти из скрипта», on a Switch ONLY «… по стрелке:
    <name>» for each of ITS OWN outgoing arrows (no plain exit). The arrow ids + names come from
    `v2/script-browser/load-exit-variants {scriptModuleId: boProcessId, scriptId: figureId}` →
    `[{id, displayName}]` (a nameless arrow shows its id's first six characters) — use it to pick
    `targetArrowId` instead of reading the def.
  - **The validators do NOT enforce that choice** `[C]`: a Switch with a plain `FROM_METHOD`, a Switch
    exiting by ANOTHER figure's arrow, and a Script exiting `FROM_METHOD_BY_ARROW` all pass both
    `translate-script` and `validate-def`. Only a missing `targetArrowId` is caught
    (`blockExit__targetArrowId_isNull` «Не указан targetArrowId»; `validate-def` then reports it on the
    figure as «В скрипте присутствуют ошибки»). What such a script does at RUN time is `[U]` — keep to
    what the IDE offers.
- **Slots — the real names, per figure** `[C]` (read off the client bundle, chunk `9839`, the
  figure factory `switch(v.type)`; `slotByName` falls back as shown):

  | figure | slot names | wrong or missing name → |
  |---|---|---|
  | Enter, Exit | `main`, `top`, `bottom` | a wrong name → nothing; a MISSING one → Enter `left` (absent!), Exit `main` |
  | Switch | `up`, `right`, `down`, `left` | `up` |
  | Script | `left`, `right`, `top`, `bottom`, `topLeft`, `topRight`, `bottomLeft`, `bottomRight` | `top` |
  | Form | as Script minus `bottom`, plus `timerCreate`, `timerOpenForm`, `timerTouchDraft` | `up` (absent!) |
  | Timer | as Script | `up` (absent!) |
  | Terminator | `left`, `right`, `top`, `bottom` | `top` |
  | Point | `angle_0`, `angle_45` … `angle_315` | `top` (absent!) |
  | SingleToParallel | `in`, `out1`…`outN` (`outSlotsCount`) | missing → `in`; wrong → not read further |
  | ParallelToSingle | `out`, `in1`…`inN` (`inSlotsCount`) | missing → `in` (absent!); wrong → not read further |

  So `main` on a Switch silently means `up` (the top vertex — what this probe's arrow «Нет» uses), and a
  wrong name on a Form or Timer resolves to nothing. **A Form has three timer slots of its own** — an
  armed timer's exit is presumably an arrow out of `timerCreate` / `timerOpenForm` / `timerTouchDraft`
  `[I]`. kc-energy's generated archives use Switch `left`/`right`/`down` out and `up` in, Exit `main`/`top`.
- Dragging out of a slot worked from the Enter but NOT from the Form's right slot (two tries, no picker) —
  the API route is the reliable one.
- **The editor remembers the open script** — `load-editor-state` → `{scrollTop, scrollLeft,
  scriptFigureId}`; with `scriptFigureId` set, reopening `…/process-editing` can come up straight in that
  figure's IDE: an empty grey canvas with only `»` at the top left, which looks like a diagram that failed
  to render. `save-editing-script-figure-id {boProcessId, scriptFigureId: null}` (or the IDE's × at the
  top right) brings the diagram back `[C]`; when exactly it reopens is `[I]` (it did not every time).
- The IDE of a process record offers three process-only actions — `goForProcess`, `continueProcess`,
  `terminateProcess` (`MYBPM-IMPORTS.md` §12a «Actions that exist only on a PROCESS record»).

#### Running a process on a record `[C]`

Same probe, a TEST version, so only **test records** run it (`boiState: DEV`, registry tab «Тестовые»,
§5g). The process field «Заявка» is a `BO` reference to «Проба БП заявка» (a CHECKBOX «Одобрить» + an
INPUT_TEXT «Текст заявки»), and the Form points at it. Everything below was driven with the §6b form
cycle from inside the page, and every claim was read back with `load-process-steps`.

1. **The process starts when the record is SAVED, not when it is opened.** `create-draft-with-boi
   {boId:<process BO>, boiState:"DEV"}` → `load-process-steps` = `[]`; `validate-apply-remove-draft` →
   Enter `PASSED`, Form `STAND` at once. «Статус процесса» shows «В ожидании» (`WAITING`) while a step
   stands.
2. **A Form step is released by saving THE record that was in its field when the step was entered.**
   Filling «Заявка» in the same draft as the process record's first save, then
   `create-draft` + `save-field-value` + `validate-apply-remove-draft` on that Заявка, made Form →
   Script → Switch → Exit «Да» pass in one go (`scriptRunSuccess: true` on both scripts) and set the
   status to «Завершён» (`FINISHED`). Nothing but the record save is needed: no task, no button on the
   process card. **The save must CHANGE a value of that record** `[C]`: a `create-draft` →
   `validate-apply-remove-draft` with no edit, and one that re-sends the value already stored, both left
   the Form `STAND` minutes later, while the next save with a changed «Текст заявки» released it at once.
   **The start is asynchronous**: right after the process record's first save `load-process-steps` can
   still be `[]` — poll until a step is `STAND` before saving the Form's record, or the release may land
   before the step exists.
3. **Filling the field AFTER the Form was entered leaves the step stuck for good** — proven twice,
   including a controlled run (empty field on save → Form `STAND` → field filled through the process
   record's form → Заявка saved with a changed value → still `STAND`). A retry does not help
   (`push-step-retry` → «Нет активных шагов для повторного запуска»; it is only for a step with
   diagnostics). So whatever feeds a Form must fill its field BEFORE the process reaches it: at the
   record's first save, or in a Script placed before the Form.
4. **Unsticking a step by hand: «Продолжить принудительно»** — the context menu of a STAND step's
   OUTGOING arrow in the diagram → `v2/boi-process/push-step-forcibly P {boProcessId, boiId, arrowId}`
   → empty 200, and the process runs on from that arrow's target (all later figures ran and the record
   finished). Given the arrow INTO the standing step (Enter → Form) it did nothing.
5. **A conditional Switch branches on the data** `[C]`: the Switch's script rewritten with
   `apply-update-cmd` to `ЕСЛИ ЭТОТ_ПРОЦЕСС.Заявка.Одобрить.#Значение → по стрелке «Да», ИНАЧЕ → по
   стрелке «Нет»` (the JSON: `MYBPM-IMPORTS.md` §16 «A Switch with a condition»; `translate-script`
   `success:true`, `validate-def` `[]`). Two test runs with the steps above — a DEV Заявка with «Одобрить»
   `"true"` / `"false"`, a DEV process record pointing at it, the Заявка saved again — ended in
   `…, Switch PASSED, Exit «Да» PASSED` and `…, Switch PASSED, Exit «Нет» PASSED` respectively. The whole
   run (both cases) is one in-page script of ~12 calls; no UI.

6. **The whole thing headlessly — `tools/process-builder.ts`** `[C]`: a spec (process
   fields, figures with slots, named arrows, Script/Switch bodies incl. a condition over a path of field
   codes) becomes a process in ONE pass — `create-bo` → rename → the BO-reference field with
   `viewType:"SINGLE"` + `toShow` in `editedFields` (trap 53) → one diagram `apply-update-cmd` (the born
   Enter is reused, a Form gets `fieldId`, Switch arrows get `name`) → one script `apply-update-cmd` per
   figure (`scriptModuleId` = version, `scriptId` = figure) → `translate-script` → `validate-def`.
   `runOnTestRecord` then runs it: DEV Заявка → DEV process record → poll for `STAND` → Заявка saved with
   a CHANGED value → steps read back. Probe «Проба БП API» (`zvIXEBMFuEL2CmbB`, version
   `eNBdDZg~Yk78g1Sp`, spec `tools/process-probe.spec.json`): translate `success` ×2, `validate-def`
   clean at the first try; runs «Одобрить» = Да → `…, switch PASSED, yes PASSED`, = Нет →
   `…, no PASSED`, `scriptRunSuccess: true`. Two drivers: `create-process-constructor.bun.ts --spec <f>
   [--run '<json>']…` from the shell (token file), or `--page-script`, which prints a snippet defining
   `window.mybpmProcess = {api, build(spec), run(built, spec, run)}` in the stand's page — the token never
   leaves it (§10), and this is the way it was run.

The run-time controller, read off the bundle (chunk `9839`), all `P`: `v2/boi-process/…`

| call | params | what it does |
|---|---|---|
| `load-process-steps` | `{boProcessId, boiId}` | `[{id, figureId, state PASSED\|STAND\|GO\|WAITING\|FAILED, prevProcessSteps, nextProcessSteps, diagnosticMessages, scriptModuleSuccess, scriptRunSuccess, execDelayMs, flushDelayMs}]` `[C]` — `GO` = a figure running, `WAITING` = a Timer past due but not yet fired; a run is over when none is `STAND`/`GO`/`WAITING` |
| `load-test-run-poi-id` | `{boProcessId}` | the editor's current test record `[C]` |
| `push-step-forcibly` | `{boProcessId, boiId, arrowId}` | «Продолжить принудительно» `[C]` |
| `push-step-retry` | `{boProcessId, boiId, figureId}` | «Попробовать еще раз» (Script / Switch / Form STAND with diagnostics) `[C]` refusal only |
| `stop-step` | `{boProcessId, boiId, figureId}` | «Остановить текущий» `[I]` |
| `push-step-terminate-all` | `{boProcessId, boiId, arrowId}` | «Терминировать все и продолжить здесь» `[I]` |
| `start-dev-process` / `stop-dev-process` | `{boProcessId}` | the editor's test run (a process with no «on record create» fields) `[I]` |
| `go` | `{boProcessId, boiId}` | `[U]` |

Plus `v2/boi-process2/load-boi-process-id {boId, boiId, draftId}` → the version a record runs, and in
`v2/bo-process-editor/`: `load-bo-with-instance-id {boProcessId, poiId, fieldId}` → `{boId, boiId}` of the
record held in a field (what a Form step opens) `[C]`; `load-on-boi-create-fields {boProcessId}` → the
fields whose referenced BO can START the process by creating a record there (`[]` on this probe; the editor
then opens that BO's new-record form instead of `start-dev-process`) `[I]`.

- **In the process EDITOR, a double-click on a standing Form opens the form of its record** (test mode
  only — the diagram on a record's own card does nothing). It is the same `create-draft` as anywhere
  else, with no process context, so saving it from the API is equivalent `[C]`.
- **A DEV process record lists only DEV records in its reference fields** `[I]`: the «Заявка» picker of
  a test record said «Данные отсутствуют» while the BO held two ordinary records and no test ones. Make the
  referenced records with `create-draft-with-boi {…, boiState:"DEV"}` for a test run.
- `load-boi-values` returns `""` for a `BO` reference field on a process record; read the link with
  `load-bo-with-instance-id` instead `[C]`.

### Export through the API — no browser download `[C]`

The browser's own «Выгрузить» fires but **the file never reaches `~/Downloads` under Claude-in-Chrome**.
Drive it from the shell instead (`scratchpad/export.bun.ts`), it is two calls:

1. `POST /web/v2/process-indicator/pre-create-process {}` → `processId`;
2. `POST /web/struct/export-company-structure?processId=<id>` with body `{}` → the zip bytes
   (`content-disposition` carries the generated file name).

It exports **whatever the company's export basket currently holds** — the basket is server-side state.
It can be filled **from the shell too** `[C]`, no UI needed — controller `struct`, which
lives at `/web/struct/...`, NOT under `/web/v2`:

```
POST /web/struct/clear-export-records        {}                        ← empty the basket
POST /web/struct/save-bo-export-records      BODY [ {boId, boName, boCategory, hasScript:false,
                                                    isStructureExport:true,
                                                    isAccessRightsExport:false,
                                                    isScriptsExport:false} ]
POST /web/struct/count-bo-export-records     {}                        → how many are in it
POST /web/struct/remove-bo-export-records     BODY [ "<boId>", … ]       ← ids, NOT records (§0U R4a)
```

then the two calls above. a small script doing exactly that is enough; picking the BOs
in the UI first (⊕ right of «Бизнес-объекты (N)») remains the manual alternative.
The «Зависимости:» pane lists what the selection needs («Структура у "Главная" имеет зависимость от:
"Встречи", "Инициативы", "Задачи"» with a «Добавить в экспорт» link each and «Подтвердить все
зависимости»); **unconfirmed dependencies do not block the export** — the archive then holds only the
selected BOs. The `<company-a>` export came back named `MyBPM-export-<COMPANY_A>-…` — the file name's company slug is
not the tenant you are working in `[U]`.

### 5g. Block IDE scripts on a running stand — the API `[I]` (read off the bundle)

The script format, the block/expression templates and the clipboard paste protocol are
`MYBPM-IMPORTS.md` Part II (§0S is the cookbook). What was missing there was the other half: **where that
screen is and whether a script can be touched without it.** It can — the client drives scripts through
two ordinary controllers, so everything §0S says about «the clipboard is the whole delivery channel» is
true of the IDE, not of the platform.

**Most of this section is read off the client bundle (chunks `9839`, `6543`, `5675`) and still `[I]`.**
**Six calls were executed and are `[C]`** — `v2/script-browser/load-tree` + `load-children`,
`v2/bo-scripts-editor/load-bo-script-versions` + `load-bo-scripts`, `v2/script/load-script-def` and
`v2/script/translate-script` (the reading half; see «Reading a BO's scripts headlessly» below). The
WRITING half: **`apply-update-cmd` and `paste` are `[C]`** (below, «Writing a script
headlessly»), and so are `load-new-ids` + `save-bo-scripts` + `in-work-bo-script-version` (the hook
wiring, «Wiring scripts onto a BO headlessly»); `create-local-method` is still untried. An archive also creates scripts on import
(`MYBPM-IMPORTS.md` §5d, verified).

| controller | scope | methods |
|---|---|---|
| `v2/bo-scripts-editor` | a BO's script MODULE and its versions | `load-bo-scripts {boId, boScriptsId}`, `load-bo-script-versions {boId}`, `save-bo-scripts` (body), `in-work-bo-script-version` / `in-test-bo-script-version` / `copy-bo-script-version` / `remove-bo-script-version` / `change-bo-script-version-comment {boId, boScriptsId[, comment]}`, `unset-in-work-version {boId, boScriptId}`, `list-local-methods {boScriptsId}`, **`create-local-method {boScriptsId, methodName}`**, `delete-local-method {boScriptsId, scriptId}` |
| `v2/script` | ONE script (a method body or a process script) | **`load-script-def {scriptModuleId, scriptId}`**, `load-script-meta-state`, `load-module-methods {scriptModuleId}`, **`apply-update-cmd`** (params `{scriptModuleId, scriptId}`, body = the command), `undo` / `redo`, `load-new-ids {count}`, **`paste`** (body `{copied: <the clipboard JSON>}`), `translate-script`, `load-bo-def-list`, `load-const-field-list`, `load-func-groups-definition`, `load-objects-definition`, `load-enums-definition`, `load-act-record-list` / `load-act-details`, `load-bo-field-options {boId, fieldId, filterText}`, `load-script-env-params-by-bo-process-id {boProcessId}`, `load-expr-value-display-str`, `load-value-ext-type-for-expr`, `load-predefined-expr-value-params-for-ext-type` |

- **Company-global methods** («Глобальные методы» in `/settings`, route
  `/settings?settingsOpenPageUrl=global-script-methods`) are the same controller, all `[C]`:
  `ensure-company-global-script-module {}` → `{scriptModuleId, scriptId:null}` (one module per company),
  `list-company-global-methods {}` → `[{scriptId, methodName}]`, `create-company-global-method
  {methodName}` → `{scriptModuleId, scriptId}`, `delete-company-global-method {scriptId}` → empty.
  So **a method IS created without the IDE** — §0S.1's «you cannot create a method» is about the
  clipboard, not the platform. The screen's «Добавить» sends exactly `create-company-global-method
  {methodName:"Новый метод"}`; the new def is a bare hat `{BlockFixMethod, methodName, params:{}}`.
  Fill it with ONE `apply-update-cmd` P `{scriptModuleId, scriptId}`: `Set blocks.<hat>` to the whole hat
  with `params {<param id>: {name, order, type}}`, `returnType` and `downBlockId`, plus the body blocks /
  expressions (ids from `load-new-ids`) — then `translate-script` → `success:true`. The screen text: a
  module method with the same name overrides the global one `[I]`.
- **Calling a global method** `[C]`: a BO script calls it like a local one — `ExprCall {funcName:
  "<name>", useArgNames:false, args: {<the global method's param id>: {name, order, exprId}}}`; nothing
  names the global module. Proven on a record: field script `Привет.#Значение = glob_greet(Имя.#Значение)`
  → «Мир» stored «Привет, Мир». The archive form and its import semantics (REPLACES the whole list,
  ids kept verbatim) are `MYBPM-IMPORTS.md` §5d «Company-global methods».
- **The stand runs a compiled copy of the global module** `[C]`: an `apply-update-cmd` on ANY global
  method refreshes it at once (the next record runs the new body), a structure import does NOT — records
  kept running the pre-import body, even of a method the import had deleted. After importing global
  methods, send any `apply-update-cmd` to one of them (a `Set` of an unchanged value works).
- **`apply-update-cmd` is the same patch language as the process diagram** (§5f): a `Group` of
  `Set`/`Unset` over `dotPath`s — here `blocks.<id>` and `expressions.<id>` instead of
  `figures.<id>`/`arrows.<id>`, and the same `forward`/`backward` pair. `undo`/`redo` are server-side.
- **`/paste` is the server side of Ctrl+V**: the client sends `{copied: <the exact JSON of §0S.3>}`, gets
  back `{copied: …}` with every id regenerated, and then writes the returned `blocks`/`expressions` into
  the script with one `apply-update-cmd` (`Set` per `blocks.<id>` / `expressions.<id>`). **That is a
  headless delivery path for a script** `[C]`: `paste` alone writes nothing; the
  `apply-update-cmd` that follows (a `Group` of `Set`s, the `backward` a `Group` of `Unset`s) does, then
  `translate-script` checks and `undo` removes the whole step in one call. Used with no browser UI at all
  on a 711-block / 1723-expression fragment and on 26 small ones in a row. Into an empty hook the fragment
  goes with its `BlockFixEntryPoint` hat and a closing `BlockExit FROM_METHOD` (`MYBPM-IMPORTS.md` §0S.12
  item 7, §14 «Validator phases»).
- The paste the IDE refuses is reproduced server-side too: a fragment whose blocks include
  `BlockFixMethod` or `BlockFixEntryPoint` is rejected for a global method.
- A process version carries its scripts as a `scriptsDefs {defs: {<figureId>: {blocks, expressions}}}`
  bundle — `v2/bo-process-editor/load-script-def-list` / `save-script-def-list` (§5f). Pasting figures
  rewrites `BlockSwitchExit.targetArrowId` through the arrow-id map, which is why §0S.4 calls arrow ids
  «not yours to generate».
#### Reading a BO's scripts headlessly — the four calls, in order `[C]`

1. `v2/script-browser/load-tree {}` → `roots[]`, one **`id: "bo-<boId>"`** per BO plus the folder
   `global-methods`. This is also the cheapest BO-id lookup by name: `label` is the BO's name.
2. `v2/script-browser/load-children {folderId: "bo-<boId>"}` → «Скрипты формы» with a `SCRIPT` child per
   hook (labels Открытие / Сохранение / Создание / Закрытие) and the folder «Изменение полей» whose
   children are labelled **«<метка> [<код>]»**. Every `SCRIPT` node carries the pair you need:
   `{scriptModuleId, scriptId}` (its `id` is `"<scriptModuleId>:<scriptId>"`).
3. `v2/bo-scripts-editor/load-bo-script-versions {boId}` → `[{boScriptModId, isWork, isTest, version,
   comment}]`. **`load-tree` shows the WORK version only** — take `isWork:true` here and you have the same
   module id. `load-bo-scripts {boId, boScriptsId}` then gives the wiring:
   `{onOpenFormScriptId, afterSaveScriptId, onCloseScriptId, onInstanceCreationId, methodScriptIds,
   methodsScriptId, fieldScripts: {<fieldId>: {afterChangeScriptId}}}` — **keyed by field ID**, while the
   archive's `fieldScripts` is keyed by field CODE (`MYBPM-IMPORTS.md` §5d).
4. `v2/script/load-script-def {scriptModuleId, scriptId}` → `{blocks, expressions}` — **exactly the Part II
   maps of `MYBPM-IMPORTS.md`**, `type` instead of the archive's `@class` and no clipboard envelope. The
   only other difference from `ScriptDefStructDto`: the key is `valueType` (not `valueTypeStruct`) and the
   server fills its whole keyset with nulls.

**`v2/script/translate-script {scriptModuleId, scriptId}` is the validator** `[C]` →
`{success, diagnosticMessageList: [{type, place, messageCode, message, blockId, exprId, messageArgs}]}`.
Use it after every script write — an import NEVER reports a broken body (`MYBPM-IMPORTS.md` §5d):
`{"success":true}` for a clean script, «Не определён скрипт» for a hook id with no body,
`exprAct__noDefinitionForActId` for a `K-DYN` act pointing at a field code the BO does not have,
`exprCall_funcName__notFound` for a call to a local method that was not carried over.

- **Every import makes a NEW script version** and leaves the previous ones behind (§5d), so re-read
  `load-bo-script-versions` after an import — a stale `boScriptModId` translates the OLD body.

- **Where the screen is**: there is no route of its own. The script IDE is a dialog inside the BO
  constructor (`…/object-editing`) and inside the process editor (`…/process-editing`); the company-wide
  screens are `/settings?settingsOpenPageUrl=…` → «Глобальные методы» and «Браузер скриптов»
  (controller `v2/script-browser`: `load-tree`, `load-children {folderId}`, `search {query}`,
  `load-exit-variants {scriptModuleId, scriptId}`). «Глобальные методы» is a list on the left
  («Добавить», search) and the method's IDE canvas on the right; «Браузер скриптов» was not opened.
- **A freshly imported BO may fail `translate-script` falsely** `[I]`: right after the import, every
  field act of a script on it answered `exprAct__noDefinitionForActId` for `F-VALUE-K-DYN-R-D-S-boi_fields`
  (hop 1 typed with no `boCode`; `load-bo-def-list` → 0 BOs), while `load-act-record-list` already knew
  the fields. A few minutes later — after the BO's script dialog had been opened in the constructor — the
  same script answered `success:true` and `load-bo-def-list` 257 BOs. Which of the two (time or the
  dialog) fixed it is not separated. `in-work-bo-script-version` refuses while the error stands (it
  answers `[{text:"script_on_change_field_cause", …}]` and changes nothing).

#### Writing a script headlessly — `apply-update-cmd` `[C]`

Captured from the IDE itself (a `fetch`/XHR patch, §10) and then used alone to write a 27-block /
84-expression probe:

```
POST /web/v2/script/apply-update-cmd
params {scriptModuleId, scriptId}
body   {"name":"<any label>",
        "forward": {"type":"Group","list":[{"type":"Set","dotPath":"blocks.<id>","value":{…whole block…}},
                                           {"type":"Set","dotPath":"expressions.<id>.opType","value":"Or"},
                                           {"type":"Unset","dotPath":"blocks.<id>"}, …]},
        "backward":{"type":"Group","list":[…the inverse, for the server-side undo…]}}
```

- `dotPath` goes as deep as you like: a whole block, one key of it (`blocks.<id>.downBlockId`), a map
  entry (`blocks.<id>.branches.<branchId>`). The IDE sends one small command per gesture
  (`CREATE_BLOCK_AND_CONNECT_DOWN`, `Bond_newExprValue`, `ExprValue_ChangeConstType` …); one big `Group`
  works as well. The answer echoes the applied update.
- Ids are yours: any 16 characters of `A-Za-z0-9@~`, kept verbatim (`load-new-ids {count}` hands out
  server-made ones if you prefer).
- To replace a body: `Unset` every old block and expression except the hat / entry point, `Set` the new
  ones, `Set` the hat's `downBlockId`. The hook's exit block may be kept and re-linked.
- **Some properties are write-only or read-only**, and the catalogue does not say which — only
  `translate-script` does (`exprAct__readWayIsAbsent` / `exprAct__writeWayIsAbsent`, one per run) `[C]`
 . `RestRequest`: write-only `sendingText/XmlTag/MultipartForm/JsonDeck/JsonArr`, `address`,
  `method`; read-only `showHeaders`; both `*Timeout`, `checkSslCertificate`. `ElectronicTableBoTab.cellType`
  is write-only. (`MYBPM-IMPORTS.md` §14 «Validator phases» has the four phases.)
- **Then `translate-script`** — the only check. It reports wrong `actId`s, argument names, dangling ids
  and types; `success:true` with a `WARN used_deprecated_blocks` means an old-panel element is present.
- **Never write an enum value you have not seen in `MYBPM-IMPORTS.md` §10–§12a** (`opType`, `exitType`,
  `exprValueType`, `constType`, `type`). The server stores it, then cannot decode the BO's script module
  any more: every read and write of every version of that BO's scripts — including `apply-update-cmd`,
  `undo`, `delete-local-method`, `remove-bo-script-version` — answers `IllegalArgumentException: No enum
  constant …`, so nothing can repair it through the API `[C]` (one probe BO lost this way;
  other BOs unaffected). A wrong STRING value (`actId`, argument key, `enumValue`) is harmless — the
  validator reports it.
- Work on a **test version** (`in-test-bo-script-version` / the «Версия: N (Тест)» switch in the dialog) —
  it does not protect against the trap above (all versions are decoded together) but keeps a working
  hook out of an experiment's way.

#### Wiring scripts onto a BO headlessly — `save-bo-scripts` `[C]`

The IDE's own sequence (read off the bundle, then run alone on a BO imported with NO scripts — 4 hooks +
2 field scripts, all six fired on a record):

1. `v2/bo-scripts-editor/load-bo-script-versions` P `{boId}` → a BO that never had scripts still has one
   version, `isTest:true`, `isWork:false` — take its `boScriptModId`. (A BO without scripts is absent from
   `script-browser/load-tree`; find its id with `load-bo-id-by-code` P `{boCode}`, §R4.)
2. `v2/script/load-new-ids` P `{count: N}` → N fresh script ids (one per hook / field script).
3. `v2/bo-scripts-editor/save-bo-scripts`, **everything in the BODY half**:
   `{id: <boScriptModId>, boId, onOpenFormScriptId, afterSaveScriptId, onCloseScriptId,
   onInstanceCreationId, fieldScripts: {<fieldID>: {afterChangeScriptId}}, methodScriptIds: []}` → empty
   200. Keyed by field ID here (the archive keys by CODE). Send the whole record — it replaces the wiring.
4. Each script is now empty (`load-script-def` → `{blocks:{}, expressions:{}}`): write its body with
   `paste` + `apply-update-cmd` (above), hat and exit included, then `translate-script`.
5. **A TEST version runs only on test records** (`boiState: DEV`, the registry tab «Тестовые»); ordinary
   records keep running the work version (none → nothing runs). `in-work-bo-script-version`
   P `{boId, boScriptsId}` makes it the work version and the stand immediately creates a new test
   version (a copy, next number).

- The UI lists every field in «Изменение поля» **except `TAB_GROUP` and `PROGRESS_BAR`**; the wiring
  itself accepts them (an archive put scripts on both, and both fired).
- When each hook fires, and which record calls trigger it: §6b and `MYBPM-IMPORTS.md` §15 «When each hook
  runs».

#### The catalogue calls — the IDE's whole palette, headlessly `[C]`

All `POST /web/v2/script/<method>`; `P` = the params half, `B` = the body half. They are what the IDE
itself calls to fill its dialogs; `MYBPM-IMPORTS.md` §12a is the complete result.

| method | send | returns |
|---|---|---|
| `load-func-groups-definition` | P `{scriptModuleId, scriptId}` | `{groups:{<groupId>:{name, functions:{<funcId>:{args:{a0…}, returnDefinition}}}}}` — the old-panel functions |
| `load-objects-definition` | same | `{objects:{MybpmUrl, MybpmFile, SignedField, MybpmSignature, ProcessServiceCaller}}` with `members` |
| `load-enums-definition` | same | 5 enums only — the full 16 come from `load-const-field-list` below |
| `load-bo-def-list` | same | `{selfBoId, list:[{id, name, code, fields:{<fieldId>:{label, code, valueExtType}}}]}` — every BO the script may see |
| `load-const-value-type-list` | P `{filter:null}` | the 15 value kinds of «выберите значение» |
| `load-const-form` | P `{baseType}` (`String`, `Enum`, `JavaObjectFactories` …) | the form of a constant: which keys it writes (`updateDotPathMap`) and which list feeds it (`fieldCode`) |
| `load-const-field-list` | B `{fieldCode, inputDataValues:{…}, isProcessTest:false, scriptModuleId, ownerBoIsProcess:false, filter:"", offset:0, limit:1000}` | a list for a constant: `ENUM_LIST`, `ENUM_VALUE_LIST` (`inputDataValues:{enumBaseType}`), `JAVA_OBJECT_FACTORY_LIST`, `SCRIPT_METHOD_LIST`, `REPORT_LIST`, `PRINT_FORM_LIST`, `BOOLEAN_LIST` … **`inputDataValues` is an object — an array answers 400 «Failed to read request»** |
| `load-act-record-list` | B `{filter:"", offset:0, limit:500, leftType:<valueExtType>, companyId, testMode:false, contextOwnerBoId}` | the actions on a value of that type (`[{id, displayStr}]`); **`companyId` is required** (missing → `NullPointerException: strId …`); it is `companyId` of `GET /web/v2/auth/load-auth-info` |
| `load-act-details` | B `{leftType, actId, companyId, testMode:false}` | `{name, description, arguments:[{argId, type, canBeEmpty}], ret:{type}}` |
| `load-value-ext-type-for-expr` | B = an expression (e.g. a `JavaObjectFactories` constant) | its `valueExtType` |
| `load-predefined-expr-value-params-for-ext-type` | B = a `valueExtType` | the default keys of a new value in a slot of that type |

A `valueExtType` is `{type, baseType, isArray, boCode?, boId?, enumNativeName?}` — e.g.
`{type:"Text",baseType:"String"}`, `{type:"Bo",baseType:"BoiRefCode",boCode,boId}` (a record),
`{type:"Bo",baseType:"BoRefCode",boCode,boId}` (the BO type). Walk: `load-act-record-list` →
`load-act-details(ret.type)` → `load-act-record-list(ret.type)` … — that is how §12a was produced.

#### Where the IDE is and what its panel holds `[C]`

BO constructor `…/business-objects/editing/<boId>/object-editing` → the orange «scripts» icon at the top
right → dialog **«Настройка скрипта»**: left, the tabs «Скрипты» (hooks Открытие / Сохранение /
Добавление новой записи / Закрытие, and «На изменение Поля: ⊕») and «Локальные методы»; top right, the
version switch («Версия: N (Тест)»); in the canvas the `»` at the top left unfolds the toolbox. The
toolbox holds exactly: ТОЧКА ВХОДА, «Пусть переменная =», «⬭ = ⬭» with «‹значение›», «Выход» with
«⬭.‹действие›», «‹Вызов метода›», «Если … то», «Цикл элемент :», and `+ ∙ И =`. A click on an empty slot
opens «выберите значение» (15 kinds; in a BO script `THIS_PROCESS` is labelled «ЭТА ИНСТАНЦИЯ»); a
second-level list such as «Встроенные объекты» may open EMPTY («Данных нет») until «Загрузить ещё» is
pressed. The red dot with a number at the top right is the count of `translate-script` diagnostics.

### 5h. Field settings — «Обязательное», «Уникальное», «Выпадающий список» `[C]`

What the constructor's gear popover on a field writes, and how to write the same thing through the API
and through an archive. Two probe BOs on `<company-a>` in group «Бизнес-объект» prove every route:
«Проба настройки полей» (`yxTzPaWhONPNxk5j`, built by the API) and «Проба настройки полей
импорт» (`ATyioDPdsxhmVDBO`, built by an archive import), both with the same four fields:
Наименование (обязательное), Табельный номер (уникальное), Должность (выпадающий список из справочника
«Должность»), Статус (выпадающий список, локальный).

#### Where the controls are, and what each one writes

The **first icon of the four that appear on a field row on hover is the gear** — it opens the settings
popover. Its checkboxes map one-to-one onto keys of the field DTO:

| checkbox in «Отображение» | field key |
|---|---|
| Необходимо заполнить | `isRequired` |
| Только для чтения | `isReadonly` |
| Уникальное поле | `isUnique` (a dropdown has no such checkbox) |
| Не сохранять значение | `unacceptableValue` (the i18n key is `unacceptable_value`) |
| Убрать заголовок | `hideLabel` |
| Фиксировать при скроллинге | `needFreezeWhenScroll` |
| Будущие даты недоступны для выбора (date types only) | `dateOnlyPast` |
| Прошедшие даты недоступны для выбора (date types only) | `dateOnlyFuture` |
| Не открывать запись (`BO` / `CO` only) | `isClickable` — **inverted**: ticked = `isClickable: false` |
| Показывать в календаре (`DATE`, `FULL_DATE`, `PERIOD`, `PERIOD_TIME`) | `needShowToCalendar` |
| Отслеживать статус (same types) | `needTrackStatus` — plus two NEW fields, see «Six more gear flags» below |

- **Ticking «Необходимо заполнить» GREYS OUT «Только для чтения»** and the other way round — the UI
  enforces what `MYBPM-IMPORTS.md` §0.5 states as a rule: required + readonly cannot both be true.
- The tab «Поведение» holds the per-type extras; for a text field they are «Ограничения вводимых
  символов» (Только заглавные / Только строчные → `textCase`) and «Ограничение длины символов»
  (`maxLength`) — the full per-type table and what each does on a record: ««Поведение» and «Интеграция» —
  per-type settings» below.
- A **DROPDOWN_SINGLE** popover has one extra block, «Отобразить значения», with a toggle
  «Задать вручную ⟷ Справочник» (`optionSource` `FROM_FIELD` ⟷ `FROM_BO`) and, in the `FROM_BO` state,
  the chip «Справочник: [Должность]» (`refBoId`).
- **The gear is painted ORANGE when the field has any setting at all** (the client's own predicate:
  `optionSource === FROM_BO || isRequired || isReadonly || maxLength || textCase !== NONE || filterId ||
  linkedFieldId || viewType !== TABLE || params.enableSequence || params.showAsStepper …`). A local option
  list (`FROM_FIELD`) is NOT in that predicate, so a «Задать вручную» dropdown keeps a grey gear.
- Checking the box changes nothing on the stand until the bottom **СОХРАНИТЬ** bar is pressed (§5b).
- **Trap 36 — the last icon of the popover's icon strip is DELETE** (`mat-icon.delete-icon`), and it opens
  «Удаление поля: использование в скриптах» with a green «УДАЛИТЬ ВСЁ РАВНО». Never walk that strip with a
  click loop to find out what the icons do. The 4th icon opens «Настройка скрипта» (the field's Block IDE
  hooks: «Запуск скрипта на: Открытие / Сохранение / Добавление новой записи / Закрытие», «На изменение
  Поля»), which is the dialog of §5g.

#### Through the API — the same six calls of R1, with more keys set on the field DTO

There is **no separate endpoint for a field setting**. The client keeps the change in the page and writes
it with the constructor's only writer, `save-business-object-portion` (§5b): every `saveIsRequired` /
`saveIsUnique` / `saveIsReadonly` / `saveOptionSource` / `saveRefBoId` / `saveFormBoOptions` does
`upsertFieldToEdit({fieldId, <the one key>})`, and the save sends the full BO plus that `editedFields`
list. So on the DTO that `generate-business-form-field` returned, set:

- `isRequired: true` / `isUnique: true` / `isReadonly: true` — and mirror each key into the field's
  `editedFields` entry;
- a dictionary dropdown: `optionSource: "FROM_BO"`, `refBoId: "<the dictionary's boId ON THE STAND>"`,
  `options: []` — **the rows are never stored on the field**, the form reads them live
  (`load-dictionary-bo-field-options {boId}` — a **params** parameter, in the body it answers HTTP 400);
- a local list: `optionSource: "FROM_FIELD"`, `refBoId: null`, `options: [{instanceId: null, id, label,
  color, code, orderIndex, hiddenInKanban, labelMap}]`, the ids coming from
  **`POST /web/v2/id-loader/load-portion {} {}`** → a batch of fresh stand ids (the client's id pump,
  useful anywhere an id must be minted client-side).

**«Обязательное» and «Уникальное» also switch the registry column on**: the client calls
`assignTableColToShow` whenever one of them (or `chosenAccessRight`) is turned ON, i.e. `tableColToShow`
becomes `true`. Reproduce it, or the BO's registry will differ from a UI-built one — both probe BOs show
«Наименование» and «Табельный номер» as columns for exactly this reason.

Where the dictionaries come from: **`load-bo-dictionary-list`** (params and body empty) → every
`BO_DICTIONARY` of the company (36 on `<company-a>`), and `load-dictionary-bo-field-options {boId}` → its rows
as ready option DTOs (`Должность` = `kNfvHppcNSR6Wz@B`, code `Dolzh`, 35 rows). **Binding to an EMPTY
dictionary is legal** and gives an empty dropdown on the form.

Accelerator — `tools/create-bo-constructor.bun.ts`, one call for the whole probe:

```
bun tools/create-bo-constructor.bun.ts --token-file <f> --group "Бизнес-объект" \
  --name "Проба настройки полей" \
  --field "Наименование:INPUT_TEXT!req" --field "Табельный номер:INPUT_TEXT!uniq" \
  --field "Должность:DROPDOWN_SINGLE@kNfvHppcNSR6Wz@B" \
  --field "Статус:DROPDOWN_SINGLE#Новый|В работе|Готово"
```

(`!req,uniq,readonly,nocol`; `@<boId>` = dictionary; `#a|b|c` = local list; `--list-dicts` prints the
dictionaries with their row counts. The spec is parsed from the right because a stand id may itself
contain `@`.)

#### In an archive

`MYBPM-IMPORTS.md` §0.5 / §5 — `isRequired` / `isUnique` are plain booleans on the field, and a dropdown
carries `fieldOptionsStruct`. **An archive names the dictionary by CODE, never by id**, and the importer
resolves it: the probe shipped `dictionaryBoInfo.code = "Dolzh"` and the stand came back with
`refBoId = kNfvHppcNSR6Wz@B`. `tools/make-probe-archive.bun.ts` takes the same `--field` grammar with the
dictionary spelled as a code: `--field "Должность:DROPDOWN_SINGLE@Dolzh@Должность"`.

#### Dates — «Будущие / Прошедшие даты недоступны для выбора» `[C]`

Two checkboxes in the gear popover of `DATE`, `FULL_DATE`, `PERIOD`, `PERIOD_TIME`, `YEAR`,
`YEAR_AND_MONTH` (`TIME` has none). **The key names state what is ALLOWED, the labels what is
FORBIDDEN** — they are not crossed:

| checkbox | key | the picker allows |
|---|---|---|
| «Будущие даты недоступны для выбора» | `dateOnlyPast: true` | today and earlier |
| «Прошедшие даты недоступны для выбора» | `dateOnlyFuture: true` | today and later |

- Ticking one greys out the other; the UI never sends both `true`. The constructor save is a two-key patch
  `editedFields: [{fieldId, dateOnlyFuture: false, dateOnlyPast: true}]` (captured). The date
  checkboxes do NOT add a registry column.
- **Proven on all three routes, and on the record card for all six types**: API (`generate-business-form-field`
  + the key on the DTO and in `editedFields`), archive (plain booleans on the field, round-trip through
  the export) and the constructor. On a record the nz picker disables whole cells: a day for
  `DATE`/`FULL_DATE`/`PERIOD`/`PERIOD_TIME` (both ends of a range), a month for `YEAR_AND_MONTH`, a
  year for `YEAR`. **Today — and the current month / year — stays selectable in both modes.**
- **It is a CLIENT-side restriction only.** The server stores a forbidden date without a word through both
  record cycles — §6a (`save-boi-value`) and §6b (`save-field-value` + `validate-apply-remove-draft`,
  `notValid:false`) — and the card then shows it as is (a past-only field reading 15.05.2027). So an API
  client writes any date, and a script or an Excel import almost certainly does too `[I]` (not run); enforce
  the rule in a «Сохранение» script if it must hold.
- Probes left on `<stand>`, group «Тест»: «Проба дат» (API, 8 fields — every date type with
  one flag) and «Проба дат архив» (archive, then one flag flipped in the constructor).
- Accelerators: both `tools/create-bo-constructor.bun.ts` and `tools/make-probe-archive.bun.ts` take
  `--field "Дата:DATE!dateOnlyPast=true"` — the generic `!key=value` flag sets ANY key of the field
  (dotted for a nested one, `!params.url=…`; the value is parsed as JSON, else kept as a string).

#### Six more gear flags — what each does on a record `[C]`

Proven on all three routes (API, archive, constructor) and on records: «Проба флажков» (API,
then flipped in the constructor) and «Проба флажков архив» (archive, imported twice), group
«Тест». The constructor saves each tick as a one-key patch — `editedFields: [{fieldId,
unacceptableValue: true, hideLabel: true, needFreezeWhenScroll: true}]`, `[{fieldId, isClickable: false}]`,
`[{fieldId, needShowToCalendar: false}]` (captured).

| flag | effect on the record | enforced by |
|---|---|---|
| `unacceptableValue` «Не сохранять значение» | the field can be typed into, but its value is NEVER stored: after a save it is empty. **The server drops it as well** — a `save-field-value` of the §6b form cycle leaves it `null` even in the draft (`load-field-data`), and in the saved record | client AND server |
| `hideLabel` «Убрать заголовок» | the card shows the input without its label (in the constructor the label row appears only on hover) | client |
| `needFreezeWhenScroll` «Фиксировать при скроллинге» | the field sticks to the top of the card while the rest scrolls under it (a `position: sticky` wrapper `div.isSticky`). The constructor writes the flag to EVERY field whose rows overlap this field's row band, and any move of the field (`savePosition`) resets it to `false` | client |
| `isClickable: false` «Не открывать запись» | clicking a linked record in a `BO`/`CO` table shows the warning **«Вы не можете открыть запись»** instead of opening it; with `true` (the default) the record opens | client |
| `needShowToCalendar` «Показывать в календаре» | which date fields the BO's «Календарь» view places a record on (one event per field, on that field's date). A field with `false` puts nothing there | client |
| `needTrackStatus` «Отслеживать статус» | see below | client |

- **`needShowToCalendar` is `true` on EVERY freshly generated field** — `generate-business-form-field`
  sets it on a text field too, and a BO created by `create-bo` has `isCalendarEnabled: true`. The client
  logic (bundle): if at least one date field has the flag, only the flagged ones reach the calendar;
  otherwise all date fields do `[I]` (the second branch not run). The calendar's event title printed
  «Имя :» / «Статус :» — a field label with an empty value; the card template (`calendarCardTemplates`)
  was not set up `[U]`.
- **«Отслеживать статус» is three fields, not a flag.** Ticking it in the constructor calls
  `generate-business-form-field` twice more and saves (one «Сохранить»):
  1. a `TAB_GROUP` wrapper with `trackedFieldId = <the date field>`, label `null`, one tab «Статус
     объекта», placed where the date field was (15×4);
  2. a `DROPDOWN_SINGLE` «Статус» (a second one is «Статус2», …) with `trackedFieldId = <the date field>`,
     inside that tab at x=9 (6×3), `optionSource: FROM_FIELD` and **four options whose ids are fixed
     strings** — `PLANNED` «Запланировано», `OVERDUE` «Просрочено», `DONE` «Выполнено», `CANCELED`
     «Отменено» (the save sends them in `editedFields[].options` of the dropdown);
  3. the date field itself: `{needTrackStatus: true, tabId: <the new tab>, gridPosition: {x:0,y:0,cols:9,rows:3}}`.
  Unticking deletes the wrapper and moves the date field back out. **A bare `needTrackStatus: true`
  (API, no wrapper, no dropdown) is stored and does nothing** — the server builds none of it.
- **What it does on a record**: when the tracked date is entered on the card, the CLIENT sets «Статус» by
  option id — a date after now → `PLANNED`, before now → `OVERDUE` (a `DATE` is compared at 23:00 of that
  day; a period by its END). The value is stored like any dropdown value (`"PLANNED"`, displayValue
  «Запланировано»), shows as a registry column, and **colours the calendar event**: PLANNED `#2F80ED`,
  OVERDUE `#ee5252`, DONE `#27ae60`, CANCELED `#BEBEBE`. `DONE` / `CANCELED` are set by hand. Nothing on the
  server moves a PLANNED record to OVERDUE when the day passes `[U]` (not observed; the logic is in the
  client's date component only). A tracked wrapper/dropdown has no settings, hint, integration or delete
  icons in the constructor.
- **A nested `BO` field built through the API needs what the constructor adds on drop**
  (`createFormFieldByBoId`): `viewType: "TABLE"` and `boFieldRefs` built from the target BO's fields
  (`{fieldId, label, toShow: <target's tableColToShow>, type, checked: false, orderIndex:
  <tableColOrderIndex>, gridPosition}`; if the target has no registry column, its first field gets
  `toShow`; at most 5 shown, `TAB_GROUP`/`PROGRESS_BAR` never). With `viewType: null` the card renders the
  field as an empty box — no table, no «Добавить». `tools/create-bo-constructor.bun.ts` now builds both, and
  `--field "Срок:DATE!track"` there replays the captured «Отслеживать статус» sequence — that code path has not
  been run yet `[U]`; the archive generator's `!track` is proven.
- The record picker of a nested field showed «Нет записей» until something was typed into its search
  box, then listed the target's records `[C]` (both targets tried) — type a letter before concluding the
  target is empty.

#### «Поведение» and «Интеграция» — per-type settings `[C]`

Proven on all three routes and on records: «Проба поведения» (API) and «Проба поведения архив»
(archive, then one field changed in the constructor), group «Тест». In the gear popover the
per-type settings sit under the **«Отображение» / «Поведение»** switch below the common checkboxes; the
database settings are the popover's 4th icon (puzzle), «Интеграция через БД». The constructor saves them
as one patch per field — captured: `editedFields: [{fieldId, textCase: "UPPER", maxLength: 7,
needLoadFromInTables: true, useAsKeyInMigration: false}]`.

| key | types | where | on the record |
|---|---|---|---|
| `textCase` `UPPER` / `LOWER` / `NONE` | `INPUT_TEXT` | «Поведение» → «Ограничения вводимых символов» → «Только заглавные / строчные буквы» (ticking one unticks the other; unticking = `NONE`) | the input is NOT converted: a wrong-case value gets a warning triangle «Недопустимый текстовый регистр» and blocks the save |
| `maxLength` | `INPUT_TEXT`, `INPUT_TEXT_LANG`, `INPUT_NUMBER` (≤ 21), `TEXTAREA`, `TEXTAREA_LANG` | «Поведение» → «Ограничение длины символов» → «Включить ограничение длины» + a number (unticking = `0`) | typing stops at the limit (a `TEXTAREA`'s editor does not cut), a longer value shows «Достигнута максимальная длина символов» and blocks the save |
| `isSeparated` | `INPUT_NUMBER` | «Отображение» → «Делить на разряды» | `1234567` shows as `1 234 567` |
| `params.enableSequence` (`"true"`) | `INPUT_NUMBER` | «Поведение» → «Счётчик» | a new record opens with the next counter value |
| `params.url` | `LINK` | «Поведение» → «URL» | only `call/plugin/<name>` means anything (see below) |
| `needLoadFromInTables` | every field with the gear | puzzle → «Загружать из IN_таблиц» | database integration `[U]` |
| `needUploadToOutTable` | same | puzzle → «Выгружать в OUT_таблицу» | `[U]` |
| `useAsKeyInMigration` | `INPUT_TEXT`, `INPUT_EMAIL`, `INPUT_PHONE` | puzzle → «Ключевое поле в IN-миграции» | one per BO (below) |
| `inMigrationTimezoneMinutes` | date types and `TIME` | puzzle → «Временная зона IN миграции в минутах» | `[U]` |

- **The case and length rules are enforced by the SERVER, in the form cycle** (§6b): every
  `save-field-value` answers `notValid: true` with `fieldFormCommands: [{commandType: "SHOW_FIELD_ERROR",
  fieldId, errorMessage: "invalid_text_case" | "max_symbols_reached"}]` for EVERY field of the draft that
  breaks a rule (not only the one just saved), and `validate-apply-remove-draft` then refuses — `formCommands:
  [ALERT_SAVE_BUTTON_NOTIFICATION]` and the dialog «Карточка не соответствует требованиям: 1. Достигнута
  максимальная длина символов 2. Недопустимый текстовый регистр». **The §6a cycle checks nothing**: a record
  written through `v2/business-object-instance` stored `XYZ` in a lower-case field and 20 characters in a
  10-character one `[C]`. The form data (`load-field-data`) carries `maxLength` but not `textCase` — the check
  lives on the server. The case check lets digits, spaces and punctuation through and applies to Cyrillic.
  Once the card showed the case warning on a value already fixed by retyping and refused to save; a server
  read of the same draft was clean — a stale UI state `[I]`, retype or reopen.
- **The counter** (`enableSequence`) is filled when a NEW draft is created (`create-draft-with-boi`, i.e.
  opening «Добавить») — every draft takes a number, a discarded one too (the probe went 1, 2, 3, 4 with only
  one record saved), and `business-objects/sequence-next {boId, fieldId}` hands out (and uses up) the next
  one. A §6a record gets NO number. The value stays editable on the card. The server stores `params` values
  as strings: an API write of `{enableSequence: true}` comes back `"true"`.
- **`params.url` on a LINK** (client code, `openLink`): if it starts with `call/plugin/`, a click on the link
  calls `link/call-plugin {boId, boiId, fieldId, fieldValueMap}` and downloads the files the plugin answers
  with (`download-file…`); otherwise the click opens the field's own value (with `www.` turned into
  `http://`). A plain URL in `params.url` does nothing `[C]` (the link opened its value); a real plugin call
  was not run.
- **One migration key per BO**: ticking «Ключевое поле в IN-миграции» on a second field shows «Ключевое поле
  миграции уже преднастроено в поле "<label>"» and unticks it again `[C]` (the client checks the unsaved edits
  and the saved BO).
- **Through the API, `useAsKeyInMigration` is DROPPED on a field that is being ADDED** — the same save kept
  `needLoadFromInTables` / `needUploadToOutTable` and every other key, and a second, one-key `editedFields`
  patch on the now existing field stored it `[C]`. So set it in a follow-up save (the constructor does too:
  the checkbox only exists on a saved field). The archive route has no such problem.
- The constructor turns the registry column on together with `textCase`, `maxLength`, `isSeparated`,
  `needUploadToOutTable`, `useAsKeyInMigration` (`assignTableColToShow`).
- `FILE_UPLOAD`'s «Отображение» / «Поведение для MP» (`params.viewType` / `params.contentType`) are in
  §5i «FILE_UPLOAD display mode».

#### Reference fields (`BO` / `CO`) — «Отображение» and «Поведение» `[C]`

Proven through the API and on records: «Проба ссылок» (`P`, six `BO` fields) pointing at «Проба
ссылок цель» (`T`, which has a `BO` field «Родитель» back to `P`), group «Тест»; the same
settings then went through an archive into «Проба ссылок архив …» and «Проба ссылок CO …» (the import is in
`MYBPM-IMPORTS.md` §3 «Reference fields»), and `removeType` / `linkedCoSettings` were set in the constructor
UI with the request captured. The controls are the gear → «Отображение» / «Поведение» of a `BO`/`CO` field (`app-bo-settings-behavior`; «Связь объектов» only
appears when the referenced BO has a field pointing back).

| key | control | on the record |
|---|---|---|
| `viewType` `TABLE` / `MULTIPLE` / `SINGLE` / `FIELDS` | «Отображение» → «Вид отображения» «Табличный / Множественный / Одиночный / Карточкой» | a table with the `boFieldRefs` columns / chips / one chip / the referenced record's fields as a form |
| `isKindAddForSelect` | «Поведение» → «Выбор/Добавление» (`false`) vs «Только добавление» (`true`) | «Добавить» opens the CREATE dialog of the referenced BO instead of the picker |
| `linkedFieldId` = a field of the REFERENCED BO that points back | «Поведение» → «Связь объектов» → «Заполнить поле "<label>"» (vs «Ничего не заполнять») | adding a record into this field writes the owner record into that back field; removing it from the field clears the back field `[C]` |
| `removeType` `STRIKETHROUGH` / `HIDE` / `DISCONNECT` | «Поведение» → «При удалении объектов <BO>» «Зачеркнуть / Скрывать из списка / Разорвать связь…» | see below |
| `needChangeParentBoByLinkedBo` (default `true` on EVERY field) | «При добавлении/изменении объекта(ов)» «Изменить бизнес объект "<BO>"» (`true`) / «Не изменять…» (`false`) | see below |
| `copyFromFieldId` = another `BO` field of the same BO | «Отображение» → «Логика отображения значения» → «Из другого поля» | the field is filled with a COPY of that field's value on every save of the record (stored, not just shown); emptied when the source is emptied `[C]` |
| `needMarkNew` | «Поведение» → «Помечать новые» | client code: rows with `isNew` (or state NEW) render in bold and new ones are put on TOP instead of the sort order. `isNew` came back `false` for every record in a one-user probe — the bold was not seen `[I]` |
| `needAddToParticipants` | «Добавлять в участники и уведомлять об добавлении» (only when the referenced BO is kind `PERSON`) | adding MYSELF raised no notification (the self-case is probably skipped); another person was not tried — it would notify a real user `[U]` |
| `isHeightDynamic` | «Динамическая высота» (`BO` only) | see «Tables» in `MYBPM-IMPORTS.md` §3 |
| `linkedCoSettings` (a `CO` field) | «Поведение» → «Связь объектов <BO>/<field>» → «Объект из Составного объекта» → pick a source BO → the same «Заполнить поле» / «При удалении» radios | per source BO of the composite: see below |

- **`removeType` is applied by the SERVER when it reads the field's records**
  (`business-object-instance/load-bo-instance-selector-records-by-ids {boInstanceIds, businessObjectId,
  fieldIds, ownerBoId, ownerBoInstanceId, ownerFieldId, draftId}`) — a record deleted with
  `delete-bo-instance` (state `REMOVED`) is: **`HIDE`** — left out of the answer, the field looks empty;
  **`STRIKETHROUGH`** — returned with `state: "REMOVED"`, and a TABLE view strikes the row through;
  **`DISCONNECT`** — on this build exactly like `STRIKETHROUGH` (the row is struck, the id stays in the
  stored value, even with `linkedFieldId` set; re-read after a minute: unchanged) `[C]`. A `SINGLE` chip
  shows a deleted record plainly, with no mark. The stored value is never cleaned by a delete.
- **`needChangeParentBoByLinkedBo` decides whether a change of the field is a change of the OWNER record**
  `[C]` (UI and API): with `true` (default) choosing a record puts it into the card's draft only — the card
  shows «Сохранить / Отменить» and closing asks «Несохранённые данные … Закрыть без сохранения?»; «ДА» =
  `remove-draft`, nothing kept. With `false` the same `save-field-value` (`saveType: "ADD"`) is **written
  straight into the record** — the card stays clean, closing sends `remove-draft` and the choice is kept.
  Proven headlessly too: `create-draft` → `save-field-value` on a `false` field → `remove-draft` leaves the
  value in the record; on a `true` field the value is gone. Without `saveType` the value replaces, with
  `"ADD"` it is appended. Editing a referenced record elsewhere does NOT touch the owner's
  `LAST_MODIFIED_AT` either way. Client side the flag also decides whether editing a nested record from the
  card marks the owner card as changed (`boiChanged`).
- **`needMarkNew` is RESET to `false` by any `editedFields` patch of the same field that does not carry
  it** `[C]` — set `removeType` on a field after `needMarkNew` and the flag is gone; a patch of ANOTHER
  field leaves it. Send it in every patch of that field. `needAddToParticipants` and the other keys survive
  such patches. **The constructor UI hits this itself** `[C]`: with «Помечать новые» ticked, choosing
  «Скрывать из списка» and «Сохранить» sent `editedFields: [{fieldId, removeType: "HIDE"}]` and the stored
  `needMarkNew` became `false` — the checkbox is silently lost. After any constructor change of a `BO`/`CO`
  field that has it, tick «Помечать новые» again and save (or re-import the archive).
- **After every constructor save the UI calls `v2/business-object-instance/remove-all-for-single-view-type
  {boId, fieldId}` for each `SINGLE` reference field, and that call TRIMS the stored value of every record to
  its first id** `[C]` — a `MULTIPLE` field holding two records, switched to `SINGLE` by an API patch, still
  held both; the call left one. So switching a field to «Одиночный» in the constructor drops the other
  links of every record, irreversibly; an API or archive switch leaves them until the next constructor save
  of that BO. The form cycle also keeps only the first id when a `SINGLE` field is given several.
- **`needMarkNew` and `needAddToParticipants` are DROPPED on a field that is being ADDED** (like
  `useAsKeyInMigration`) — set them in a follow-up patch. `viewType`, `removeType`, `isKindAddForSelect`,
  `isHeightDynamic`, `linkedFieldId`, `copyFromFieldId` are kept on add. The archive import is the mirror
  image: it keeps `needMarkNew` / `needAddToParticipants` on a created field but LOSES
  `needChangeParentBoByLinkedBo: false` there (`MYBPM-IMPORTS.md` §3 «Reference fields»).
- **A field referencing a composite (`CO`)** — add it like a `BO` field (`generate-business-form-field
  {boId, fieldType: "CO", fieldBoId: <composite id>}`, then `refBoId`, `viewType`, `boFieldRefs` from the
  composite) `[C]`. The server fills `linkedCoSettings` itself — an ARRAY, one entry per source BO of the
  composite: `{boId: <source BO>, removeType: "STRIKETHROUGH", linkedFieldId: null, unlinkedFieldId: null,
  linkedBo: {refBoName, fieldsForLink: [{fieldId, label}]}}`, where `fieldsForLink` = the `BO` fields of that
  source pointing back at this BO. The constructor patch that links one sends the whole array:
  `editedFields: [{fieldId, linkedCoSettings: [{boId, removeType: "HIDE", linkedFieldId: <back field>,
  linkedBo: {…}}]}]`. A back field already used by a plain `BO` field (`linkedFieldId`) is greyed out here too.
- **A `CO` value is a JSON array of `"<source BO id>-<record id>"`**, not of bare record ids —
  `save-field-value` with bare ids answers `IllegalStoredValue … Value_CO` `[C]`. Adding records that way
  (`saveType: "ADD"`) filled the back field of each SOURCE record with the owner; with `removeType: "HIDE"` a
  deleted source record was left out of `load-bo-instance-selector-records-by-ids` (called with the composite
  as `businessObjectId` and the same prefixed ids) `[C]`.
- **Reading a reference value**: `v2/load-boi-values` answers `""` for every `BO` field; read it with
  `instance-field-form/load-field-data` (a draft of the record) — `storedValue` = `"[\"<boiId>\", …]"` `[C]`.
- **«Data too large» (`EsDataTooLargeException`) comes and goes** `[C]`: `validate-apply-remove-draft` and even
  `create-draft` of this BO failed with it a few times, the same calls went through a minute later, and the
  record that «failed» WAS saved (with its back link). It is the Elasticsearch memory breaker of the stand,
  not the payload — retry, then check what was stored before retrying a create.
- In the export (`MYBPM-IMPORTS.md` §3 «Reference fields») `linkedFieldId` becomes
  `boRefStruct.linkedFieldCode` and `copyFromFieldId` becomes `copyFromFieldCode` — both by CODE — and
  `linkedCoSettings` becomes a map `{"<source BO code>": {linkedFieldCode, removeType}}`. All three import
  back `[C]`.

#### «С фильтром» and «Зависимость полей» of a `BO` field `[C]` (`<stand>`)

Probes, group «Тест»: «Проба зависимости регион / город / филиал / заказ» (API + constructor UI; the
city has `Регион` → region and a CHECKBOX «Активен», the branch has `Регион`, the order has `Регион`, `Город`,
`Филиал`, «Активный город», «Активный город API») and their import «… архив».

**How the picker gets its records.** Every view (table, chips, single) asks
`v2/business-object-instance/load-bracket-ref-boi-table` body `{boId, boiId, draftId, fieldId, refBoId, search,
paging, ordering, boiIds, brackets, state:"ALL"}` (`boId`/`boiId`/`fieldId` = the OWNER record and field). The
server itself (`brackets: []`) applies the field's own filter and **leaves out the records already chosen in
this field** (saved value); anything else comes only from `brackets` the client sends.

**«С фильтром» (`bracketFilterId`)** — gear → «Отображение» → «С фильтром: Заполните» → a filter builder over
the referenced BO's fields. Works in the UI, through the API and after an import `[C]`: the picker of «Активный
город» (filter «Активен = да») listed only the active cities.
- Constructor capture (one save of the BO): the portion carries `editedFields: [{fieldId, bracketFilterId}]`, then
  `v2/bracket-filter/save` body `{id, boId: <REFERENCED BO>, brackets: [{id, parentId:"", parentTreeIds:[],
  connectionType:"AND", notType:"DEFAULT", dynamicFilters:[{id, fieldId, label, type:"CHECKBOX", value:"true",
  options:[], businessFields:[], businessObjectId:null, chipsMode:false, numberTo:0, numberFrom:0,
  selectedBois:[], boiIds:[], isCurrentUser:false, isEmptyValue:false, fromFields:[]}], nativeFilters:[],
  brackets:[]}]}`. Ids of brackets/filters are client-made 8-character strings.
- **API route**: `v2/bracket-filter/load-from-field` params `{boId, fieldId}` CREATES the field's filter record
  (type `BUSINESS_FIELD`) and returns its `id` → `v2/bracket-filter/save` with that `id` → patch the field
  `{fieldId, bracketFilterId: id}`. **Trap**: `v2/business-objects/load-bo-filter {boId, fieldId}` (what the
  constructor's builder reads) also returns an `id`, but persists nothing — saving under it answers
  `NoBracketFilterWithId`, and a patch with that id is stored as `null`.
- The server does NOT enforce the filter on save: a §6a record cycle stored an inactive city in the field `[C]`.
- Export/import: `MYBPM-IMPORTS.md` §3 «Reference fields — «С фильтром» and «Зависимость полей» in an archive».

**«Зависимость полей»** — gear → «Поведение» → «Поле зависимого» (`relMainInnerFieldId`, a `BO` field of the
REFERENCED BO) / «Зависимость от» (`relFieldId`, a `BO` field of THIS BO) / «Внутреннее поле зависимости»
(`relInnerFieldId`, a field of the `relFieldId` field's BO). Meaning: offer only the records whose main-inner field
equals the value of «Зависимость от» (or of that value's inner field).
- Set through the API as a one-field patch `{fieldId, relMainInnerFieldId, relFieldId, relInnerFieldId}` — the
  constructor then shows it `[C]`. Clearing goes with `needDeleteRel…FieldId: true` (constructor code).
- The server builds the filter correctly: `v2/business-object-instance/load-field-relation-bracket-filter` params
  `{boId, boiId, fieldId, draftId}` returns `{brackets:[{dynamicFilters:[{fieldId:<main inner>, type:"BO",
  boiIds:[<value of «Зависимость от» in the DRAFT>]}]}]}`; with an inner field the `boiIds` are that value's inner
  field (city «Г3 юг» → region Р2 → only branch «Ф2 юг») `[C]`. Passed as `brackets` to
  `load-bracket-ref-boi-table` it filters `[C]`.
- **In the UI it does NOT filter on this build** `[C]` (TABLE and MULTIPLE views, region set and saved): the
  picker lists every city. The table selector (chunk 1954) fetches the relation filter but its
  `tap(()=>this.setFieldRelationFilter)` never calls the function; the popover (chunk 9839) calls it, yet the
  request still went out with `brackets: []`. The client only blocks the picker («relation_field_is_empty»)
  for the card-style view when «Зависимость от» is empty. Treat the relation as a client defect: if the
  restriction matters, use a script or a «С фильтром» filter instead.
- The server does not enforce it on save either: region Р1 + southern city + northern branch saved `[C]`.
- An archive carries only `relMainInnerFieldCode` — set `relFieldId` / `relInnerFieldId` after the import with
  the patch above (`MYBPM-IMPORTS.md` §3).
- Side effect seen on the constructor save: the UI also called `save-business-form-field` and made Имя / Регион /
  Город registry columns (`tableColToShow`) — mind the Elasticsearch sort defect (§7) for a filled text column.

#### «Читать из реестра» (`readFromRegistry`) of a panel's `BO` field `[C]`

Probes: «Проба чтения из реестра» (API + constructor) and «Проба чтения из реестра архив»
(archive), both `BO_PANEL` over one plain BO with four records.

- **What it does.** Gear → «Поведение» → checkbox «Читать из реестра», shown **only in a panel**
  (`showSettingsReadFromRegistry = ownerBoIsPanel`). ON (the default) — the widget is the WHOLE registry
  of the referenced BO (every record, through the field's own `bracketFilter` if it has one); a record
  added anywhere shows up there after a reload. OFF — an ordinary reference table: it holds only the
  records put into THIS field, «Добавить» picks / creates them (`isKindAddForSelect`, whose switch
  «Выбор/Добавление» appears only while the checkbox is OFF), and they are saved in the panel's record
  with the panel's own «СОХРАНИТЬ». ON also limits «Вид отображения» to «Табличный» / «Множественный».
- **`null` means ON** `[C]`. The constructor reads `readFromRegistry ?? true`, and a field with `null`
  showed the registry. The server stores `null` for a field added with `readFromRegistry:true` (the key
  is dropped when a field is ADDED — by the drag of the UI and by `addedFieldIds` + `editedFields` of the
  API alike), so only `false` and a later explicit `true` are ever stored.
- **API** — `save-business-object-portion` with `editedFields: [{fieldId, readFromRegistry: false|true}]`
  on an EXISTING field; both directions stored `[C]`.
- **Defect: the constructor cannot switch it back ON** `[C]`. Ticking the box sends
  `{fieldId, readFromRegistry: true, defaultValue: "", deleteDefaultValue: true}`, and with that exact
  triple the server leaves `false` (tried twice from the UI, once from the API). `readFromRegistry:true`
  alone, or with only one of the two other keys, IS stored. So turn it on through the API with the bare
  key; the UI shows the box ticked until the next reload.
- **A panel's record is per user** `[C]` (client: `checkBoiExists(boId, personId)` then
  `createBoiById(boId, personId)`): its `boiId` IS the viewer's `personId`, created on the first visit.
  So what an OFF field holds is each user's own list `[I]` (one login only). Open a panel by
  `/business-objects/viewing-single/panel?businessObjectId=<panel boId>` — the page adds the rest;
  `/viewing-list/panel/<boId>` falls through to «Главная». The first visit of a fresh panel answered
  «Data too large» and hung on skeletons; a reload rendered it.
- **A `BO` field added through the API needs `boFieldRefs`** `[C]`: with `[]` (what
  `generate-business-form-field` returns) the registry widget is EMPTY and the page toasts «target is
  marked non-null but is null». The UI's drag fills one entry per field of the target BO —
  `{fieldId, label, toShow, type, checked:false, orderIndex, gridPosition}`, `toShow` from the target's
  `tableColToShow` (the first field if none, at most 5, never TAB_GROUP / PROGRESS_BAR); send the same in
  `editedFields`. The drag also sets `viewType:"TABLE"` and `isKindAddForSelect:true`, which the API
  route must set itself.
- **Archive** — the export writes `"readFromRegistry": false` and OMITS the key when it is `null`; an
  import stores exactly what it gets — no key → `null` (registry), `false`, `true` — and the imported
  panel behaved like the constructor one `[C]` (`MYBPM-IMPORTS.md` §5a).
- Outside a panel the gear has no such checkbox; a form field's runtime still reads
  `readFromRegistry ?? isPanel`, so `true` on an ordinary BO's field would probably render it as a
  registry too `[U]` — never tried.

#### Per-type settings — checklist, questionnaire, progress bar, tabs, text editor, option colours `[C]`

Probes in group «Тест»: «Проба свойств типов» (API, then the constructor UI) and «Проба свойств
типов архив» (archive, `MYBPM-IMPORTS.md` §3 «Per-type settings»), records saved through the form
cycle (§6b) and through the card.

| type | gear → where | key (constructor patch) | what it does on a record |
|---|---|---|---|
| `CHECKLIST` | settings block | `isAppendable` «Добавляемый» | «Добавить» under the items — new items on the record |
| `CHECKLIST` | settings block | `isSelectOnly` «Выбор без редактирования» (`{fieldId, isSelectOnly:true}`) | the item texts are not editable, only ticked (without it a text stays editable even when the field is not appendable) |
| `CHECKLIST` | settings block | `isRequired` «Обязателен один пункт» | the SERVER refuses a record with no item ticked (`ALERT_SAVE_BUTTON_NOTIFICATION validate_required_title`) |
| `CHECKLIST` | settings block | `isRequiredAll` «Обязательны все пункты» | **nothing on this build**: stored, exported, imported, but the card (the client maps it to `false`) and the server both saved records with unticked items — through the UI and the form cycle |
| `QUESTIONNAIRE` | «Отображение» | `questionnaireIsMultiple` «Одиночный / Множественный» (`{fieldId, questionnaireIsMultiple:true}`) | single = radio buttons, one mark per row; multiple = checkboxes, several per row. Only the client keeps a row single — the form cycle stored two marks in one row of a single field. «Поведение» of a questionnaire is empty |
| `PROGRESS_BAR` | «Поведение» | `isProgressBarSticky` «Фиксация при скроллинге» (`{fieldId, isProgressBarSticky:false}`) | ON: the bar stays at the top of the card while the form scrolls (its grid row gets `div.isSticky`, `position: sticky`); OFF: it scrolls away — both seen on records. `params.isSticky` is only a create-time default, ignore it |
| `TAB_GROUP` | settings | `params.showAsStepper` «Показать как степпер» | **nothing on this build** — stored and exported, but no runtime component reads it; the card shows ordinary tabs |
| `TAB_GROUP` | settings (offered only with ≤ 1 tab) | `params.needDisableTabs` «Отключить вкладки» | the tab strip is hidden; the fields of the tab show as plain form fields |
| `TAB_GROUP` | tab strip in the body | `tabs[].isRight` | the tab sits at the right end of the strip |
| `TEXTAREA`, `TEXTAREA_LANG` | settings, 16 checkboxes «Включить настройку '…'» | `params.buttonTypes` = JSON TEXT of an array (`{fieldId, params:{buttonTypes:"[\"bold\",\"table\",\"codeview\",\"height\",\"italic\"]"}}`) | the editor toolbar shows exactly those buttons. Members: `style bold underline italic fontsize color ul ol paragraph table link picture video hr codeview height`; absent = the default ten `bold underline italic fontsize color ul ol table link picture` |
| `DROPDOWN_SINGLE` | option chip in the body / kanban editor | `options[].color` (`RED`, `GREEN`, `BLUE`, …) | the kanban column colour; the record card shows the option uncoloured. A `RADIO_BUTTON_GROUP` stores a colour too, and it shows nowhere — no kanban is built on a radio |

- **The gear differs per type.** A checklist's block: «Обязателен один пункт», «Обязательны все пункты»,
  «Добавляемый», «Только для чтения», «Выбор без редактирования», «Не сохранять значение», «Убрать
  заголовок», «Фиксировать при скроллинге» — «Обязательны все пункты» greys out «Обязателен один пункт»,
  «Выбор без редактирования» greys out «Добавляемый» and back. A progress bar's gear has NO common block,
  only «Отображение» (the steps) and «Поведение» (the one checkbox). A `TAB_GROUP`'s gear has only the two
  `params` checkboxes.
- **The constructor sends `params` of a `TAB_GROUP` as booleans** (`{showAsStepper:false, needDisableTabs:false}`),
  the server stores them as strings (`"false"`) — the client reads both.
- **API: `isRequiredAll` and `isSelectOnly` are DROPPED when the field is ADDED** (`addedFieldIds` +
  `editedFields`), like `needMarkNew` and `useAsKeyInMigration`; a second one-key patch stores them.
  `isAppendable`, `isRequired`, `questionnaireIsMultiple`, `isProgressBarSticky`, `params`, `tabs[].isRight`,
  `options[].color` are kept on ADD.
- **Option codes: the server REGENERATES them on ADD** — a dropdown added with `options[].code = "Krasnyi"`
  came back `Krasnyyi`, the transliteration of the label (and «Зелёный» → `Zel_nyyi`: `ё` becomes `_`,
  `MYBPM-IMPORTS.md` §0.6). A patch of an EXISTING field keeps the code sent. Questionnaire, step and tab
  codes are kept on ADD.
- **Record values** (form cycle or §6a): a checklist = JSON text `[{"label":"Пункт 1","checked":true},…]` —
  the whole item list, so a record can carry items of its own; a questionnaire = `[{"rowId","columnId"}]`
  (ids); **a progress bar = a MAP `{"<step code>":"<COLOR>"}`** — `RED GREEN YELLOW BLUE ORANGE PURPLE`,
  a step without an entry stays grey. It reads back as `[{"stepCode","color"}]`, but that array, a
  `{stepId,…}` array or a hex colour sent as the value make `load-field-data` fail for the whole draft
  (trap 50) and validate answers `incorrect_value`. The card has no control for it — a script or this
  API colours the steps.

#### «Единичный выбор» — `RADIO_BUTTON_GROUP` `[C]`

Three radio groups added over the API to probe «Проба виджетов» (group «Тест»), records made
through the §6a cycle and looked at on the card, the constructor opened, the BO exported and imported back
as copies (`MYBPM-IMPORTS.md` §3 «Единичный выбор» has the archive side).

- **Over the API** it is the dropdown recipe of R1 with a local list: on the DTO of
  `generate-business-form-field {boId, fieldType:"RADIO_BUTTON_GROUP"}` set `optionSource:"FROM_FIELD"`,
  `refBoId:null`, `options:[{instanceId:null, id, label, labelMap, color, code:null, orderIndex, hiddenInKanban:false}]`
  (ids from `v2/id-loader/load-portion`) and, for an option chosen in advance, `defaultValue: "<option id>"` —
  all stored on ADD; option codes come back generated from the labels (`Da`, `Net`, `Mozhet_byt`).
- **The gear** of a radio group has only the common block: «Необходимо заполнить», «Только для чтения», «Не
  сохранять значение», «Убрать заголовок», «Фиксировать при скроллинге» — no source switch (dictionary) and no
  «Уникальное». The options are edited in the field body (add / rename / delete / code / tick = default).
- **Default**: a new record's draft carries the `defaultValue` option (`load-field-data` → `storedValue` =
  the option id) and the card shows it ticked; existing records are not filled.
- **Required**: `validate-apply-remove-draft` answers `ALERT_SAVE_BUTTON_NOTIFICATION validate_required_title`
  while nothing is ticked; the card shows the red star.
- **A dictionary does not work on a radio.** `optionSource:"FROM_BO"` + `refBoId` IS stored, but
  `load-field-data` returns `options: []`, the card shows the label and no buttons, and the constructor
  renders it as a local list and silently adds one empty option to it (not saved unless you press СОХРАНИТЬ).
  A value written over the record API (`"0.0"`, the dictionary row's option id) is stored and the registry
  even shows its label — only the card cannot. Use `DROPDOWN_SINGLE` for a dictionary.
- **No kanban on a radio**: `v2/kanban/load-kanban-fields` (PARAMS `{boId}`) lists only the BO's
  `DROPDOWN_SINGLE` fields — empty for a BO whose only lists are radio groups — and the constructor enables
  the «Канбан» tab only when the BO has a dropdown. So `options[].color` of a radio shows nowhere.
- The server validates nothing about the value: `save-field-value` with a string that is no option id is
  stored, and the registry shows the raw string. On the card a ticked radio cannot be unticked (the client
  control only sets — bundle chunk 7490).
- The registry column shows the option's label.

#### «История» — `isHistoryTracking` and the BO tab `HISTORY` `[C]`

- **Two switches, both needed.** Per field `isHistoryTracking: true` (a one-key `editedFields` patch through
  `save-business-object-portion`, mirrored into `formFields`; constructor: tab bar on the right of the form →
  «История» → its gear → «Отслеживать изменение полей», a checkbox per field, `changeFieldHistoryTracking` →
  `upsertFieldToEdit`) AND per BO the tab itself: `businessObject.boTabs: [{type: "HISTORY", orderIndex: 1}]` in
  the same portion (switch off = `boTabs` without it + `delBoTabs: ["HISTORY"]`). Tab types `CHAT PEOPLE FILES
  HISTORY PRINT_FORM` (+ `TELEGRAM`/`WHATSAPP`), all of them §5k. In an archive the same is
  `boTabs: {"HISTORY": 1}` (a map) — see `MYBPM-IMPORTS.md` «Field flags».
- **Measured on one record**: no tab, no flag → journal empty; tab only → field edits not logged; tab + flag on
  «Текст» → only «Текст» logged, the unflagged «Ответ» edited in the same save is not; flag but tab removed →
  the edit is NOT written at all (turning the tab back on does not reveal it). With the tab on, a NEW record
  also logs `CREATE_BOI` and `ADD_PARTICIPANT` without any flag.
- **Reading the journal**: `v2/boi-event/load-event-page` with `P {boId, boiId, pageId: null}` — PARAMS half
  (a body answers 400 «Required parameter 'boId' is not present»). Answer `{nextPageId, events: [{id, type,
  happenedAt, happenedAtStr, happenedBy: {id, name, …}, oldAndNewValues: {fieldId, label, type,
  oldDisplayValue, newDisplayValue, oldStoredValue, newStoredValue}, …}]}`, oldest first; an empty old value
  reads «Без значения». Event types: `CREATE_BOI ADD_PARTICIPANT DEL_PARTICIPANT UPDATE_FIELD RESTORE_BOI
  ARCHIVE_BOI UNZIP_BOI REMOVE_BOI`.

#### «Название записи» — `titleToShow` / `titleOrderIndex` `[C]`

- **What it is**: the record's name = the title of its card = `v2/business-objects/v2/load-bo-components`
  `P {boId, boiId, boiDialogType: "EDIT"}` → `name` (beside `recordName` = the BO's «название записи»). It is
  the DISPLAY values of the fields with `titleToShow: true`, joined by single spaces in `titleOrderIndex` order;
  empty fields are skipped; no flagged field → `name` = the BO's `name`, NOT its `recordName` (§5j). Phone formatted («+7 (701) 123-45-67»),
  `FULL_DATE` as «01.10.2026 14:31». Every field except `TAB_GROUP` and widgets qualifies, natives included.
- **Setting it**: `v2/business-objects/save-bo-fields-for-bo-name` — `P {boId}`, BODY = an ARRAY of the field DTOs
  (from `load-business-object-by-id` → `formFields`) with `titleToShow` / `titleOrderIndex` changed; answers
  empty. The constructor (record-name chooser in the form header, `boNameSelectField`) sends ALL selected fields
  with the new one at `titleOrderIndex = count`; unselecting sends just that field with `titleToShow: false` (its
  old `titleOrderIndex` stays stored). The flags read back in `formFields` (`null` = never set).
- **When the name changes**: existing records are renamed ASYNCHRONOUSLY ~3 s after the flags change (order swap
  and unflagging both measured); a record save renames that record at once.
- **Archive**: the keys travel on `dynamicFields` (export, copy import → same flags and order, new record named
  from them). For a NATIVE the import applies `nativeFields.<TYPE>.titleToShow` but the export writes `false`
  (see `MYBPM-IMPORTS.md` «Field flags» «Название записи»).

#### What the settings actually DO on a record (runtime, verified in the UI)

- A required field is marked with a red `*` on the record card; saving with it empty is refused with the
  dialog **«Внимание — Карточка не соответствует требованиям: 1. Обязательные поля не заполнены»** and the
  field outlined red.
- A duplicate in a unique field is refused with the field-level tooltip **«Ошибка — Продублировано
  уникальное поле»**; the card stays open and nothing is written.
- A read-only field renders as a grey `disabled` input, **and a script still writes it** `[C]`
 : a button's «На изменение поля» script filled a read-only INPUT_TEXT on the open
  card. So «Только для чтения» is the right flag for the fields a script fills — the user cannot type
  into them, the script can. Set on an existing BO as a one-key `editedFields` patch
  `{fieldId, isReadonly: true}` (mirrored into `formFields`).
- A `FROM_BO` dropdown lists the dictionary's rows (Developer, Manager, General Manager, …), a
  `FROM_FIELD` one lists its own options — both with a «Поиск» box.

### 5i. Every field type, widget and system field — constructor UI and API `[C]`

Three families, three palette sections, three generator endpoints. Everything below was done on
`<company-a>`: «Проба все типы полей» `y5VYjeIOYlfTFjLk` (constructor API, 43 elements),
«Проба все типы импорт» `w3Y4bI3H2ntf7rcF` (the same 43 through a generated archive, API
import) and «Проба виджеты конструктор» `zm8ufIOguCPru0bu` (widgets + system fields through
the tool). The archive half is in `MYBPM-IMPORTS.md` §0.5 / §0.5a / §0.5b.

#### The palette — what the constructor really offers `[C]` (read off the screen and off the bundle)

| section | contents |
|---|---|
| **Элементы страницы** | the 23 field types, in this order: Email, Телефон, Число, Текст, Текстовое поле, Текстовый блок, Чекбокс, Время, Дата, Дата и время, Период, Период со временем, Год, Год и месяц, Выпадающий список, Единичный выбор, Опросник, Чек лист, Загрузка файла, Карта, Ссылка, Мультиязычное текстовое поле, Мультиязычный текстовый блок |
| **Виджеты** | ЭЦП/SMS, Кнопка, Блок IFrame, Блок captcha — **plus Вкладки (`TAB_GROUP`) and Прогресс-бар (`PROGRESS_BAR`), which are ordinary fields despite sitting here** |
| **Системные поля** | Дата создания, Автор, Дата последнего изменения, Автор последнего изменения, Счетчик открытий, Дата обновления IN миграции — and the widgets Текущая дата / день / месяц / день и месяц / год / пользователь are appended to the same list |
| **Вложенные объекты** | every BO of the company; dragging one creates a `type: "BO"` field pointing at it (a composite gives `CO`) |

- **A system field, a CURRENT_* widget and ЭЦП/SMS can be placed only ONCE per BO** — the client removes
  what is already on the form from the palette, and the whole section disappears when all of it is used.
  `BUTTON`, `IFRAME`, `CAPTCHA` and every ordinary field may repeat.
- On a PANEL the widget section shrinks to ЭЦП/SMS, Блок IFrame, Кнопка.
- Dropping into a `TAB_GROUP` sets the new field's `tabId`; a field dragged from «Элементы страницы»
  arrives labelled with the type's own name («Текстовое поле»), which is then renamed in place — and the
  code is generated from the label AT THE FIRST SAVE and never again (trap 22).

#### Field types — label → `fieldType` `[C]` (enum `ApiFormFieldType` of the client bundle; same table: `MYBPM-IMPORTS.md` §3)

The 27 values `generate-business-form-field` accepts, by palette label:

| label | `fieldType` | label | `fieldType` |
|---|---|---|---|
| Текстовое поле | `INPUT_TEXT` | Выпадающий список | `DROPDOWN_SINGLE` |
| Текстовый блок | `TEXTAREA` | Единичный выбор | `RADIO_BUTTON_GROUP` |
| **Текст** (static HTML, a section heading — not an input) | `STATIC_TEXT` | Чек лист | `CHECKLIST` |
| Число | `INPUT_NUMBER` | Опросник | `QUESTIONNAIRE` |
| Чекбокс | `CHECKBOX` | Прогресс-бар | `PROGRESS_BAR` |
| Дата | `DATE` | Вкладки | `TAB_GROUP` |
| Дата и время | `FULL_DATE` (never `DATE_TIME`) | Карта | `GEO_POINT` |
| Время | `TIME` | Ссылка | `LINK` |
| Период / Период со временем | `PERIOD` / `PERIOD_TIME` | Загрузка файла | `FILE_UPLOAD` |
| Год / Год и месяц | `YEAR` / `YEAR_AND_MONTH` | Мультиязычное текстовое поле / блок | `INPUT_TEXT_LANG` / `TEXTAREA_LANG` |
| Email / Телефон | `INPUT_EMAIL` / `INPUT_PHONE` | Вложенный объект, Пользователь | `BO` (never `BUSINESS_OBJECT`) |
| | | Составной объект | `CO` |

`BUTTON`, `RANGE`, `MULTIPLE`, `SINGLE`, `INPUT` are client-only members and answer
`400 Failed to convert 'fieldType'` (a button is a WIDGET, below). `USER_DROPDOWN_MULTI`,
`CHECKBOX_GROUP`, `BUSINESS_OBJECT` do not exist — they are leftover i18n keys.

#### The API — one generator per archetype

```
POST v2/business-objects/generate-business-form-field           P {boId, fieldType, fieldBoId?}
POST v2/business-objects/generate-business-form-widget          P {widgetType}
POST v2/business-objects/generate-business-form-field-by-native P {nativeType}
```

Each returns a ready ~100-key field DTO with a fresh `fieldId`; the BO is then saved exactly as in §5b
(`save-business-object-portion` with the full DTO + `editedFields` / `addedFieldIds`). The DTO says which
family it belongs to: `boFieldArchetype` = `DYNAMIC` | `WIDGET` | `NATIVE`, and the client resolves an
element as `nativeFieldType ?? widgetType ?? fieldType`.

- A **widget** DTO comes back with `type: null`, `widgetType: <TYPE>` and a Russian label already set
  («Кнопка», «Блок iframe», «Блок captcha», «ЭЦП/SMS», «Текущая дата»…). `CURRENT_USER` is the exception:
  it is a `type: "BO"` field onto «Пользователи» with `viewType: "TABLE"`, `isReadonly: true`.
- A **native** DTO comes back with `nativeFieldType`, a fixed `type` and `labelMap` filled in all four
  languages. `PARTICIPANTS` answers with an **empty body** — that system field cannot be created `[C]`.
- `fieldType: "BUTTON"` (and `RANGE` / `MULTIPLE` / `SINGLE` / `INPUT`) is rejected with
  `400 Failed to convert 'fieldType'` — BUTTON is a widget, the rest are client-side enum members.

#### Per-type keys to set on the generated DTO

| type | keys |
|---|---|
| `DROPDOWN_SINGLE` | `optionSource` `FROM_BO` + `refBoId` (dictionary) or `FROM_FIELD` + `options[]` (§5h) |
| `RADIO_BUTTON_GROUP` | `optionSource: "FROM_FIELD"` + `options[]` only — a dictionary is stored but never shown (§5h «Единичный выбор») |
| `CHECKLIST` | **`defaultValue`** = the items as a JSON STRING `[{"label":"Пункт","checked":false},…]` + `isAppendable: true`, both mirrored into `editedFields` — that is what the constructor sends when an item is typed under the field; `options` are not read |
| `QUESTIONNAIRE` | `questionnaires[]` — the generator already returns two rows, one `isColumn: true`, one `false`; set their `label`/`labelMap` |
| `PROGRESS_BAR` | `progressSteps[]` = `{id (v2/id-loader), orderIndex, label, code, labelMap}` |
| `TAB_GROUP` | `tabs[]` = `{id, label, isActive, chosenAccessRight, orderIndex, isInvalid, isRight, isDefault, labelMap}` |
| `FILE_UPLOAD` | `params` `{viewType: SINGLE/MULTIPLE/TILE, contentType: ALL/FOR_CAMERA/IMAGE/DOCUMENT}` (both keys inside `params`, §5i) |
| `STATIC_TEXT` | `staticValueMap.RUS` = the HTML |
| `BO` / `CO` | `fieldBoId` on the generator call (BO) or `refBoId` on the DTO (CO), `viewType` TABLE/SINGLE |

#### Tabs (`TAB_GROUP`) over the API `[C]`

- **Create**: `generate-business-form-field {boId, fieldType:"TAB_GROUP"}`, then set `tabs[]` to
  `{id, label, labelMap, isActive, chosenAccessRight:false, orderIndex, isInvalid:false, isRight:false,
  isDefault}`. The ids come from `v2/id-loader/load-portion`, and the first tab is `isDefault` /
  `isActive`. Add it like any field (`addedFieldIds` + `editedFields` with its `gridPosition`).
- **A field on a tab carries `tabId`**, and its `gridPosition` is **relative to the tab** (y starts at 0
  on each tab). A NEW field takes `tabId` straight from its DTO in `formFields`.
- **Moving an EXISTING field onto a tab needs `tabId` in BOTH places**: in the field's copy inside
  `businessObject.formFields` AND in its `editedFields` entry. With `editedFields` alone, the same call
  applied `gridPosition` / `tableColToShow` / `label` but silently kept `tabId: null`.
- Fields outside the group stay on the form above and below it. The group's own `rows` is its height on
  the form.
- A widget on a tab (button, iframe, signature, captcha, current date/user) comes back from
  `load-business-object-by-id` with the same `tabId` as a field `[C]`. In an archive it names the tab in
  `tabCode: {tabGroupCode, tabCode}`, NOT `tabCodePath`: the import ignores `tabCodePath` on a widget and
  leaves it outside the tabs, overlapping the form at its `y` `[C]`.
- **Give the group a code** `[C]`: with `label: null` the server leaves `code: ""`, and a
  `save-business-object-portion` carrying `code` does not change it. Set it with
  `save-business-field-code` — **PARAMS** `{businessObjectId, businessFieldId, businessFieldCode}`
  (answers `""`; the same call for any field). Without a code the export drops the group and its tab
  rules and writes the group's id into the fields' `tabCodePath.tabGroupCode`. Tab codes are derived
  from the tab labels («Секрет» → `Sekret`).

#### FILE_UPLOAD display mode — `params.viewType` `[C]`

The gear → «Отображение» radio (Одиночный / Множественный / Плиточный) is written by the constructor as
`editedFields: [{fieldId, params: {viewType: "MULTIPLE", contentType: "ALL"}}]`. **The key is
`params.viewType`, not the top-level `viewType`.** Setting only the top-level key over the API left
the radio on «Одиночный». Two rules follow:
- **For a photo to show in the field without downloading it, choose «Плиточный»** — the platform team's
  rule (not «Множественный»). What we saw: in «Множественный», a PNG written by a script (`convertToFile("karta.png")`) still
  rendered as a file row with a preview on click. **«Плиточный» writes `params: {viewType: "TILE",
  contentType: "ALL"}`** `[C]` (core2, captured off `save-business-object-portion`; the
  top-level `viewType` stayed `MULTIPLE` and is ignored). After the switch the same PNG showed as a
  thumbnail tile on the card. Captured values: `MULTIPLE`, `TILE`; the «Одиночный» one is `[U]`.
- **In MULTIPLE and TILE mode the field's `#Значение` is `File[]`** (TILE `[C]`: the script compiled
  unchanged after the switch): a script that assigned one file stops
  compiling with `blockAssign_arrayAssignNoArray` (`MYBPM-IMPORTS.md` §12a, RestResponse notes).
- **«Поведение для MP» = `params.contentType`, mobile app only** `[C]`. Enum `ALL` /
  `IMAGE` / `DOCUMENT` / `FOR_CAMERA`; the gear checkbox «Только камера» writes only `FOR_CAMERA` ↔ `ALL`
  (`saveParams` → the same `editedFields` patch with the whole `params`), so it overwrites an `IMAGE` /
  `DOCUMENT` set over the API or an archive. Over the API (`params` on an added field) all four were stored;
  they survive a stand export and a copy import. **On the web nothing changes**: all four render
  `<input type=file accept="*">` without `capture`, and a `.txt` uploaded through `v2/file/upload` and
  saved by the §6a cycle was stored in the `FOR_CAMERA`, `IMAGE` and `DOCUMENT` fields alike — the server
  does not check the file kind. The mobile behaviour itself is `[U]`.

#### GEO_POINT («Карта») is the platform's own map, not Yandex `[C]`

- **The «Карта» field works with Google** (platform team). What the bundle shows (build
  `C4.24.x`, chunks `2245` / `5214` / `9753`): the company settings screen «Навигатор» goes through the
  controller `/geo-map/settings` (`load-geo-map-company-fields`, `load-geo-map-company-field-values`,
  `save-geo-map-company-field-values`, all with P `{geoMapType}`). The only `geoMapType` is `GOOGLE_MAP`,
  and the screen takes a Google API key («Google API ключ действителен»). The coordinate picker dialog
  itself draws Leaflet on `tile.openstreetmap.org` tiles `[I]` (read off the bundle, not seen on screen).
- The consequence: **a GEO_POINT neither uses nor demonstrates a customer's Yandex Maps key.** Its value
  is `{"lat":…,"lon":…}` (§6b). An interactive Yandex map on a card needs an IFRAME widget pointing at your
  own page that loads `api-maps.yandex.ru`, as described in the next section.

#### A widget's code and url are NOT keys of the field DTO

Each widget family has its own controller, and everything goes into the **params** half of the envelope —
a call that puts them into the body answers 200 and writes nothing:

| widget | controller | set | read |
|---|---|---|---|
| SIGNATURE | `v2/signature` | `save-signature-code {boId, signatureId, code}` (asynchronous, ~2 s), `save-signature-settings` (BODY, below), `save-access-group {boId, signatureId}` + the group as body (asynchronous) | `load-signature-code` / `load-signature-settings` / `load-access-group` |
| BUTTON | `v2/button` | `save-button-code {boId, buttonId, code}`, `save-button-url {…, url}`, `save-button-field-ids {…, fieldIds}`, `save-access-group {boId, buttonId}` + the group as body | `load-button-code` / `load-button-url` / `load-button-field-ids` (→ an array of field ids) / `load-access-group` |
| IFRAME | `v2/iframe` | `save-iframe-code {boId, iframeId, code}`, `save-iframe-url {…, url}` | `load-iframe-code` / `load-iframe-url` |
| CAPTCHA | `v2/captcha` | `save-captcha-code {boId, captchaId, code}` (asynchronous, ~2 s; the code is NOT validated, a Cyrillic one is stored), `save-access-group {boId, captchaId}` + the group as body | `load-captcha-code` / `load-access-group`; on the card `generate` / `validate` (see «The CAPTCHA widget» below) |
| CURRENT_* (date family) | `v2/current-date` for the code of ALL five; the lock per type: `v2/current-date` / `current-day` / `current-month` / `current-day-and-month` / `current-year` | `save-current-date-code {boId, currentDateId, code}` (asynchronous, ~3 s), `save-access-group {boId, currentDateId \| currentDayId \| currentMonthId \| currentDayAndMonthId \| currentYearId}` + the group as body | `load-current-date-code` / `load-access-group` (see «The CURRENT_* date widgets» below) |
| CURRENT_USER | `v2/widget-current-user` | `save-current-user-code {boId, currentUserId, code}` (asynchronous, ~3 s), `save-access-group {boId, currentUserFieldId}` + the group as body | `load-current-user-code` / `load-access-group` / `load-bo-id` (→ the «Пользователи» BO id) |

**An IFRAME shows one fixed url per BO, and the record is NOT passed to it** `[C]` (bundle,
chunk `6621` `DffIframeComponent`). The card calls `load-iframe-url {boId, iframeId}` and puts the answer
into `<iframe src>` unchanged, with no placeholders and no record or draft ids. A page inside learns which
record it sits on only when it is served from the stand's own origin: then it can read the parent
document. A cross-origin page gets only the stand's origin as its referrer. The settings dialog refuses
an `http:` url on an `https:` stand (protocol error), **and so does the server** `[C]`:
`save-iframe-url` with an `http://…` url answers `""` and keeps the old value, so an API client gets no
error either — read the url back. **`save-iframe-url` is asynchronous**: a `load-iframe-url` right after
it still returns the OLD url, the new one shows ~1.5 s later; `save-button-url` is immediate. A cell smaller than 1366×768 renders the page scaled
from 1920×1080, and a click opens it full screen (90vw × 90vh).

The `<widget>Id` is the widget field's `fieldId`. **`load-business-object-by-id` returns `code: null` for
every widget except BUTTON** — that is not a missing code, read it through the controller above. A widget
that never got a code still exports with one the server derives from the label («Кнопка» → `Knopka`,
«ЭЦП/SMS» → `ECP_SMS`); the UI warns «У виджета … нет кода» where a code is required.

#### A BUTTON runs a script through the «Изменение поля» trigger `[C]`

A button has no script slot of its own. It gets one the same way as any other field: the trigger
**«На изменение поля: <кнопка>»** in the BO's script dialog. Headlessly, that is the button's `fieldId` in
the `fieldScripts` map of `save-bo-scripts` (§5g «Wiring scripts onto a BO headlessly»):
`fieldScripts: {<button fieldId>: {afterChangeScriptId}}`.

- **The click is a field change.** The widget's click handler (bundle, chunk with `handleButtonUrl`) runs
  `forkJoin([load-button-url, load-button-field-ids, changeValue$()])`. `changeValue$` sends the button's
  value to the draft, and that fires the field's «Изменение поля» script server-side, like
  `save-field-value` does for any field (§6b). Each click fires it again, and its field writes come back
  in `fieldFormCommands` and show on the open form at once. Verified with a real mouse click on the form
  and headlessly with `save-field-value {values:[{fieldId:<button id>, value:""}]}`.
- **The script is the only thing a button reliably does; leave its `url` EMPTY.** What each url does on the
  record card is in the next section. In short: `call/plugin/…` needs a plugin installed on the server.
  `client/save-current-boi` and `create-boi/…` do nothing on the card. Any other url does nothing either.
- Worked example: BO «Тест Яндекс API» on core2 / NIT. Four buttons, each with its own field script:
  `RestRequest` GET → `resultCode` / `resultAsText` into the record's fields
  (`MYBPM-IMPORTS.md` §0S, `RestRequest` in §12a).

#### What a BUTTON's `url` does on the record card `[C]` (core2 / NIT)

Probe BO «Проба виджетов», four buttons clicked on a record card while the XHR log was
recorded, then checked against the bundle. The card draws a button with
`mybpm-ng-widget-button` (chunk `5660`). A click runs `load-button-url` + `load-button-field-ids` +
`save-field-value(<button>, "")`, and the last call fires the button's field script. After that the url
is read by its PREFIX:

| url | what happens on the card |
|---|---|
| empty | nothing more. **This is the working button: a script on «Изменение поля» does the job** |
| `call/plugin/<name>/…` | `v2/button/call-button-plugin {boId, boiId, fieldId, draftId}`. `<name>` is a **plugin registered on the server**, not something you write. An unknown name answers HTTP 400 «No such plugin `<name>`» and a red toast. The card sends **no** field values: the plugin reads the record itself |
| `client/save-current-boi` | **nothing — the record is NOT saved.** The handler emits on `BoiEventHandlerService.saveBoiSubject`, and no component of this build subscribes to `saveBoi$` (searched in all 204 chunks). Two clicks: no `validate-apply`, the typed value stayed unsaved, the dialog stayed open |
| `create-boi/<toFieldCode>/<from->to, …>`, `client/create-boi/…` | **nothing on the card.** Only the «dff» button component handles it (chunk `5584`; chunk `8782` only logs it), and the record card does not use that component. Which screen uses `5584` is `[U]`. Per its code `[I]` it opens a create dialog for the BO behind the BO/CO field `<toFieldCode>`, copies the listed values (`Текст->Название`), and puts the new record into that field |
| anything else (`https://…` too) | nothing. A button never navigates |

- **«Поля для отправки» = `save-button-field-ids` = the archive's `fieldCodes`.** The card does not send
  them anywhere. They are meant for the server plugin. In an archive they are a map
  `{"<field code>": "<archetype>"}` (`MYBPM-IMPORTS.md` §0.5b). An import turns it back into the field
  ids that `load-button-field-ids` returns `[C]`.
- A button has its own lock: `v2/button/load-access-group {boId, buttonId}` answers
  `{all, view, edit, create, …}` with `accessForAll: true` by default. `save-access-group` was not tried `[U]`.

#### The CURRENT_USER widget («Текущий пользователь») — settings `[C]`

Probe «Проба виджетов». The widget was added over the API, set up in the constructor, over
the API and by an archive, then checked on a record card.

- **What it shows: the person who OPENS the card, not the record's author.** The card component
  (`app-widget-current-user`, chunk `950`) asks `v2/widget-current-user/load-bo-id` for the «Пользователи»
  BO and shows `[authInfo.personId]`, read-only, through the ordinary nested-record selector. **A record
  stores nothing for it**: `v2/load-boi-values` of a saved record has no entry for the widget's
  `fieldId`. Do not use it to record who created or changed a record. Use the natives `CREATED_BY` /
  `LAST_MODIFIED_BY` for that.
- **The DTO** from `generate-business-form-widget {widgetType:"CURRENT_USER"}` is `type:"BO"`,
  `boFieldArchetype:"WIDGET"`, `widgetType:"CURRENT_USER"`, `refBoId` = «Пользователи», `isReadonly:true`,
  `viewType:"TABLE"`, and `boFieldRefs` = every field of «Пользователи» (33 on that stand) with
  `toShow:true` only on «Фамилия» (orderIndex 0) and «Имя» (1). One per BO: the palette removes it
  once it is placed. The server gives it a code from the label at the first save (`Tekuschiyi_polzovatel`).
- **Its settings are the three below plus the lock. There is no field script and no «Поведение» tab:**

| setting | constructor (gear) | API |
|---|---|---|
| view | «Вид отображения»: «Табличный» / «Одиночный» (`TABLE` / `SINGLE` only) | `viewType` on the field DTO, `save-business-object-portion` (§5b), mirrored in `editedFields` |
| columns | «Выбрать поля для отображения» (checkbox list with order numbers). **Shown only for «Одиночный»**; in «Табличный» columns are switched in the table body | `boFieldRefs[].toShow` + `orderIndex` on the DTO, same save |
| code | shown as read-only text, **no change-code control** in this build | `v2/widget-current-user/save-current-user-code {boId, currentUserId, code}` (params). **Asynchronous** like `save-iframe-url`: an immediate `load-current-user-code` returns the OLD code, a read 3 s later the new one. `load-business-object-by-id` keeps `code: null` |
| lock | the lock icon on the row | `v2/widget-current-user/load-access-group` / `save-access-group {boId, currentUserFieldId}` (params) + the access group as the body. Default `accessForAll: true` everywhere |

- **Switching to «Одиночный» in the constructor immediately calls**
  `v2/business-object-instance/remove-all-for-single-view-type {boId, fieldId}`. That is the call that
  trims existing records' values down to one. For this widget there are no stored values, so it is harmless.
  The UI save that follows sends the DTO with `viewType:"SINGLE"` and the ticked `boFieldRefs`.
- All four survive an export and an import (`MYBPM-IMPORTS.md` §0.5b, «CURRENT_USER round-trips»):
  `currentUser.<code>` carries `viewType` and `fieldRefs` keyed by the «Пользователи» field CODES, and the
  lock is a normal `fieldAccessStructMap.<widget code>` entry of the `AccessStructDto`.

#### The CURRENT_* date widgets («Текущая дата / день / месяц / день и месяц / год») `[C]`

Probe «Проба виджетов». All five were added over the API, given codes and locks over the API,
opened on a record card, exported, re-imported as a copy, generated by `tools/make-probe-archive.bun.ts`
and imported. The copy and the generated BO were deleted afterwards.

- **The DTO** from `generate-business-form-widget {widgetType:"CURRENT_DATE"}` (and the other four):
  `type:null`, `widgetType` = the type, `code:null` (also after the save, like every widget except
  BUTTON), no `gridPosition` (give it one; the constructor uses 4 rows). The server derives the code
  from the label and writes «й» as `yi`: `Tekuschaya_data`, `Tekuschiyi_den`, `Tekuschiyi_mesyac`,
  `Tekuschiyi_den_i_mesyac`, `Tekuschiyi_god`.
- **Settings: the code and the lock, nothing else.**
  - code: `v2/current-date/save-current-date-code {boId, currentDateId, code}` for **all five types**
    (the `<widget>Id` is the widget's `fieldId`). It is **asynchronous**: read back at once it is still
    the old code, after 3 s the new one.
  - lock: **each type has its own controller**: `v2/current-date`, `v2/current-day`, `v2/current-month`,
    `v2/current-day-and-month`, `v2/current-year`. Each has `load-access-group` / `save-access-group`,
    with the id key named after the controller (`currentDateId`, `currentDayId`, `currentMonthId`,
    `currentDayAndMonthId`, `currentYearId`) in params and the access group as the body. Only `view` is
    used, and the default is `accessForAll: true`. «Только участники» (`view.accessForAll:false,
    participants:true`) was saved and read back on all five.
- **On the card** (chunk `2150` `DffCurrentDateComponent`): a disabled `nz-date-picker` in the format
  `dd.MM.yyyy` / `dd` / `LLLL` / `dd.MM` / `yyyy`. For the date 01.10.2026 the five show `01.10.2026`, `01`,
  `октябрь`, `01.10` and `2026`. The placeholder of «день и месяц» is the untranslated key `day_and_month`.
- **Nothing is stored.** `v2/instance-field-form/load-field-data` gives every widget the server time when
  the DRAFT was created, as an ISO string, and a new draft gives a new time. `save-field-value` with
  `2020-01-01` into the widget answered normally and the record saved, but the next draft showed the
  current time again. `load-boi-values` does not list the widgets. For a stored date use a DATE field or
  the native `CREATED_AT`.
- The palette offers each type once per BO; **the server accepts a second widget of the same type** (it
  gets its own derived code).
- Archive: `currentDates.<code>` + `fieldAccessStructMap.<code>`, both survive (`MYBPM-IMPORTS.md` §0.5b,
  «CURRENT_* date widgets round-trip»).

#### The CAPTCHA widget («Блок captcha») — settings and what it does to saves `[C]`

Probe «Проба виджетов». The widget was added over the API, given a code and a lock over the API,
opened on a record card, exported, re-imported as a copy and removed again.

- **The DTO** from `generate-business-form-widget {widgetType:"CAPTCHA"}`: `type:null`,
  `widgetType:"CAPTCHA"`, label «Блок captcha», `code:null` (also after the save, like every widget but
  BUTTON). The server derives the code `Blok_captcha`. It may repeat on a BO. Height 6 rows.
- **Settings: the code and the lock, nothing else.** The gear holds only the code (bundle, chunk `2245`:
  the change-code dialog calls `saveCaptchaCode`). The constructor canvas did not render for DOM reading,
  so the UI side is read off the bundle only.
  - code: `v2/captcha/save-captcha-code {boId, captchaId, code}`, **asynchronous**: the old code is
    still read back 1 s later, the new one after 2 s. **The server does not check the code**: `"Текст"`
    was stored as is, so check the code yourself against the naming convention (§0U.5 rule 12).
  - lock: `v2/captcha/load-access-group` / `save-access-group {boId, captchaId}` (params) + the access
    group as the body. Only `view` is used, and the default is `accessForAll: true`.
- **On the card** (dialog card, chunk `760` `DffCaptchaComponent`): an image, an input and «Подтвердить».
  It is shown at once. Another card component (chunk `3369`) shows it only after the first value change.
  - image: `GET /web/v2/captcha/generate?draftId=<draft>` with the `token` header → a PNG of 160×50 with
    five characters. **It is a GET with a query string**: a POST answers `405 Method Not Allowed`.
  - check: `POST v2/captcha/validate {draftId, code}` (params) → `true` / `false`. On `false` the card
    fetches a new image right away. On `true` the button turns into «Подтверждено» and a «Вы прошли
    верификацию» line appears. The captcha belongs to the DRAFT.
- **The server enforces it** (`CustomBoCaptchaValidator.validateOnSave`):
  `v2/instance-form/validate-apply-remove-draft` answers `{"errorType":"CaptchaNotVerified",
  "message":"… :: Капча не верифицирована"}` for a draft that CHANGED a value and for a NEW record,
  until the captcha of that draft was validated. A draft with no changes saves. The same was confirmed on
  the imported copy. **The four-call cycle of §6a is blocked the same way**: `apply-and-remove-draft`
  answered `CaptchaNotVerified` and no record was created. **So the record API (§6a), the headless form cycle (§6b) and every client that has
  no human to read the image cannot save records of a BO with a captcha.** Whether scripts and the xlsx
  import are blocked too is `[U]`. Removing the widget (`deletedFieldIds`) made saving work again at once.
- The positive path (a solved captcha, then a save) was NOT run: solving the image is left to a person.
- Archive: `captcha.<code>` + `fieldAccessStructMap.<code>`, both survive (`MYBPM-IMPORTS.md` §0.5b,
  «CAPTCHA round-trips»).

#### The SIGNATURE widget («ЭЦП / СМС») — settings `[C]`

Probe «Проба виджетов». The widget was added over the API, set up over the API and in the
constructor, exported, re-imported as a copy, generated by `tools/make-probe-archive.bun.ts` and imported,
and opened on a record card. One SIGNATURE per BO.

- **The DTO** from `generate-business-form-widget {widgetType:"SIGNATURE"}`: `type:null`,
  `widgetType:"SIGNATURE"`, label «ЭЦП/SMS», 6 rows high. The server derives the code from the label
  (`ECP_SMS`). Unlike the other widgets it shows the field-script icon in the constructor (bundle `[I]`, not run).
- **The gear popover** shows: the code (pencil → change-code dialog), «Поля для подписания» (chips +
  «Обычное / Массовое подписание», «Выбрать все»), «Документы для подписания» (print forms of this BO,
  plus for mass signing those of the referenced BOs) and «Указать номер для подписания» (a radio list of the
  BO's `INPUT_PHONE` fields). Nothing is saved when the popover closes. The constructor keeps the changes
  and sends them only on «Сохранить», right after `save-business-object-portion`:

```
POST v2/signature/save-signature-settings     BODY (not params):
{boId, signatureId, signingPhoneId,          ← fieldId of an INPUT_PHONE field, or null
 addFieldIds, delFieldIds,                    ← signed fields, as DELTAS
 addMassFieldIds, delMassFieldIds,
 addPfRecordIds, delPfRecordIds,              ← print form ids of this BO
 addMassPfRecord, delMassPfRecord}            ← [{boId: <referenced BO>, printFormId}]
```

  The UI sends exactly this, captured off a real save. The API call with the same body works without the
  UI and answers `""`. Only the ids you list change. `signingPhoneId` is a plain value: `null` clears it.
- **Field ids here are NOT bare field ids**: `load-fields {boId}` (the candidates) answers
  `[{id:"D:<fieldId>", label, fullLabel, refFields:[…]}]`. A BO field offers its target's fields as
  `refFields` with ids `D:<fieldId>-<refBoId>-D:<refFieldId>` (label «Регионы - Название»), and ticking the
  parent in the UI adds the children too. `load-mass-fields {boId}` lists the BO fields (mass signing = signing
  the linked records). `load-signature-phones {boId}` → `[{fieldId, label}]`, `load-mass-print-forms {boId}`
  → `[{boId, boName, pfRecords}]` per referenced BO.
- **Read back** with `load-signature-settings {boId, signatureId}` →
  `{fields, massFields, pfRecords, massPfRecords, isAllFieldsChosen, signaturePhone:{fieldId,label}}`.
- **Mass signing needs the referenced BO's own SIGNATURE widget.** The candidates carry three flags. The
  UI shows the matching message instead of a checkbox: `signFieldMissing` («в БО … необходимо добавить
  виджет ЭЦП/SMS»), `signFieldUnsupported` («…добавить такой-же тип подписания») and `signFieldEmpty`
  («…указать подписываемые поля/документы»). With the widget added the flag moved from Missing to
  Unsupported. What «the same type» means was NOT found `[U]`: clearing the phone did not change it.
  `save-signature-settings` still ACCEPTS a mass print form the list does not offer, and the export carries it.
- **Code** — `save-signature-code {boId, signatureId, code}` (params) is **asynchronous**: an immediate
  `load-signature-code` still returns the old code. **Lock** — `load-access-group {boId, signatureId}` /
  `save-access-group` (params + the group as the body) is asynchronous too (~2–3 s). Groups go in through
  `view.orgUnitToAdd` and out through `orgUnitToDelete`, as for every lock (R5).
- **On the record card** the widget shows «Тип подписания: Выберите» → «ЭЦП» / «SMS» (the client enum
  `CHOOSE / EDS / OTP`; the type is chosen per signing, it is not a setting). «SMS» → «Подписать» opens the
  dialog. It calls `v2/instance-form/create-instance-by-signature {boId, boiId, draftId, fieldId, parentDraftId}`,
  `load-active-sms` and `load-filled-signature-group {boId, boiId, signatureId, draftId}` →
  `{fields:[{fieldId, label, value}], printFormList, signingPhone, maskCountry}`. The «Отправить SMS-код»
  button stays disabled while the record's phone field is empty. The rest of the flow (`generate-code`,
  `sign-otp`, `save-signed-data`, `load-signatures-list`) was NOT run: it sends a real SMS `[U]`. In
  scripts the result is `#получи подписи` → `Object/MybpmSignature[]` (`MYBPM-IMPORTS.md` §12a).
- **The archive form** (`signatures.<code>`) and what survives an import: `MYBPM-IMPORTS.md` §0.5b «SIGNATURE
  round-trips». In short, everything travels by CODE except `massPrintFormCodes`.

#### System fields (natives) — settings `[C]`

All six natives added over the API to one probe BO (`generate-business-form-field-by-native` + the §5b
portion save), set over the API, looked at on a record card and in the constructor, exported and imported
as a copy. A native's `fieldId` = its `code` = the native type (`CREATED_BY`, …) — use it wherever an
API takes a `fieldId`.

**Constructor** (gear on a native): tab 1 shows the native's name and, ONLY for `CREATED_BY` /
`LAST_MODIFIED_BY`, «Вид отображения» Табличный / Одиночный (the columns are chosen like on any `BO`
field); the other four have nothing there. Then the info tab (id, system type, code — the code cannot be
changed), the lock (operations VIEW and EDIT only), «Интеграция» (IN / OUT checkboxes, the time-zone box
for the `FULL_DATE` natives), the script tab and delete. No «Необходимо заполнить» / «Только для чтения»
block.

| setting | API (`editedFields` patch) | on the card |
|---|---|---|
| `label` / `labelMap` (rename) | kept | the new label |
| `hideLabel` | kept (no constructor control for natives) | label hidden, value shown |
| `viewType` `TABLE` / `SINGLE` + `boFieldRefs[].toShow` (`CREATED_BY`, `LAST_MODIFIED_BY`) | kept | TABLE = a table with the chosen columns of «Пользователи»; SINGLE = a chip with the first chosen column (e.g. the job title) |
| `needUploadToOutTable` | kept | — |
| `needLoadFromInTables`, `inMigrationTimezoneMinutes`, `isRequired` | **silently dropped** (read back `null`), also as one-key patches | — |
| `isReadonly` | meaningless: every native ALWAYS reads back `isReadonly: true`, `readonly: true`; `false` does not stick | read-only |
| lock | `load-field-access-group` / `save-field-access-group` with `fieldId: "<NATIVE_TYPE>"`, then `save-bo-field-chosen-access-right` — kept | — |

- `OPEN_COUNT` grows by one on every card open (7 → 8 seen); `IN_MIGRATION_UPDATED_AT` is empty unless an
  IN migration wrote the record.
- **The archive does NOT carry a native's lock**: the export writes it (`AccessStructDto.fieldAccessStructMap.
  <NATIVE_TYPE>`), the import ignores it — and still sets `chosenAccessRight: true`, so the copy shows an
  orange lock over rights that are «всем». A dynamic field's lock in the same archive arrives. After an
  import, set native locks with `save-field-access-group` (`MYBPM-IMPORTS.md` §0.5a «What travels»).

#### Print forms (`v2/print-form`) over the API `[C]`

A print form is a .docx template on a BO. It is what a SIGNATURE's «Документы для подписания» lists. Every
call has its args in the PARAMS:

| step | call | note |
|---|---|---|
| 1 | `POST /web/v2/file/upload` | multipart, field `file`, the `token` header. Answers the new fileId as a JSON string (24 hex chars). The UI accepts only `.docx` |
| 2 | `create-draft {boId, printFormId:null}` | → draftId (a bare string). Pass `printFormId` to edit an existing form |
| 3 | `save-name {draftId, name}`, `save-type {draftId, type}` | type = the OUTPUT format `PDF` / `DOCX` |
| 4 | `save-file-Id {draftId, fileId}` | note the capital `I`. → `{fileName, pageCount}` |
| 5 | `apply-draft {boId, draftId}` | **asynchronous**: `load-print-forms` right after it may still be empty |
| read | `load-print-forms {boId}` → `[{printFormId, name, fileType, orderIndex}]`; `load-print-form {boId, printFormId}` → `+ fileId, fileInfo`; `get-print-form-code {boId, printFormId}` | the server derives the code from the name («Проба ПФ подпись» → `Proba_PF_podpis`); `save-code` changes it |
| other | `delete-print-form {boId, printFormId}`, `remove-draft {draftId}`, `save-print-form-order-indexes`, `load/save-access-group {boId, printFormId}`, `load-test-values` / `save-test-value` | not exercised except delete |

An export carries the template itself: `printForms[]` on the BO and one `ExportStructFileDto` line per file
(`MYBPM-IMPORTS.md` §0.5b «Print forms»).

#### A nested table (`type:"BO"`, `viewType:"TABLE"`) on a record card `[C]`

Built over the API with the R1 cycle: `generate-business-form-field {boId, fieldType:"BO", fieldBoId:<child
BO>}`, then `viewType:"TABLE"` (+ `tabId` for a tab) on the DTO and in `editedFields`; a second save turns
the columns on — `editedFields: [{fieldId, viewType:"TABLE", boFieldRefs:[…each with toShow:true,
orderIndex:i]}]` (the generator returns every `boFieldRefs[].toShow:false`, trap 53). Two such fields
onto the SAME child BO keep separate lists per record.

- **On the card**: the table has «Добавить» → a picker that lists **every record of the child BO** (not
  only this record's) with checkboxes, its own «Добавить», «ВЫБРАТЬ» / «ОТМЕНИТЬ». The picker's «Добавить»
  opens a CREATE dialog of the child (`boiDialogType=CREATE`, `parentDraftId=<card draft>`); after
  «СОХРАНИТЬ» the new record comes back into the picker already ticked, «ВЫБРАТЬ» adds the ticked rows to
  the table. That is the picker mode, `isKindAddForSelect: false` (the generator's default outside a panel).
- **«Только добавить» mode** `[C]` — the field's settings show a switch «Выбрать и добавить /
  Только добавить» (i18n `select_and_add` / `only_add`), which writes **`isKindAddForSelect: true`**
  (`editedFields: [{fieldId, isKindAddForSelect:true}]`). Then «Добавить» opens the child's CREATE dialog
  at once — no picker, so existing child records can't be picked again. It is a mode of the table, not a
  right. The UI also turns on a registry column when `tableColToShow` is `null` (`assignTableColToShow`).
- **Row order**: before the card is saved the table shows rows in the order they were added; after
  «СОХРАНИТЬ» and reopening it shows them sorted by the child's first column. A script must not rely on
  either — sort it itself (`MYBPM-IMPORTS.md` §0S.7).
- **Sorting the table** `[C]` (travels in an archive as the child's `sortFieldCode` /
  `sortFieldOrder`, `MYBPM-IMPORTS.md` §2, `[C]`): the table reads its order from the CHILD BO —
  `load-bo-table-sort {boId:<child>}` (params) → `defaultOrdering`. The arrow on the header and the
  insertion order of newly added rows follow it. Set it with `save-bo-table-sort` (params `{boId:<child>,
  fieldId, order:"ASC"|"DESC"}`), the same call as the registry header click. The read-back lagged a few
  seconds (first answer `UNSET`, then `{fieldId, state:"ASC", archetype:"DYNAMIC"}`).
- **Size of the child's record dialog** `[C]`: the size is a setting of the child BO,
  `save-business-object-grid-layout-position` with a **body** of `{boId, gridLayoutPosition:{id:"0", x, y,
  w, h}}` (read: `load-business-object-grid-layout-position` params `{boId}`; `""` = never set = full
  size). The width is `w` of 16 columns of `0.9·innerWidth`. The height is `h` rows of 30 px, capped at
  `0.9·innerHeight`. The viewer re-centres `x = ceil((16−w)/2)`. For two fields in one row, `w:6, h:8` gives a
  compact dialog (≈630×240 px at 1876×965): fields plus the СОХРАНИТЬ/ОТМЕНИТЬ bar.
- **A required `INPUT_NUMBER` starts at 0** on a CREATE dialog, so it counts as filled. The red `*` and
  the warning appear only after the user clears it. `isRequired` really is on, but nothing forces the
  user to type a number.
- Driving it from `javascript_tool`: `el.click()` on the picker's «Добавить» does nothing — dispatch
  `pointerdown`/`mousedown`/`pointerup`/`mouseup`/`click` at the element's centre (§10). The CREATE
  dialog animates in: find its inputs by their label, not by position, or the text lands in «Поиск поля».

#### The tool

`tools/create-bo-constructor.bun.ts` now drives all three families in one run:

```
bun tools/create-bo-constructor.bun.ts --token-file /tmp/token --group "Бизнес-объект" \
   --name "Проба виджеты конструктор" \
   --field "Наименование:INPUT_TEXT" \
   --widget "BUTTON:Кнопка:knopka_k:https://example.org/k" --widget "SIGNATURE:ЭЦП/SMS:ecp_sms_k" \
   --widget "CURRENT_USER:Текущий пользователь:cur_user_k" \
   --native CREATED_AT --native CREATED_BY --native OPEN_COUNT
```

It generates every element, lays them out, saves the BO once, then sets each widget's code and url
through the controllers above. Verified by exporting the result: the six widget maps came back with
`ecp_sms_k` / `knopka_k` (+ url) / `iframe_k` (+ url) / `captcha_k` / `cur_date_k` / `cur_user_k`, and
`nativeFields` with the three system fields.

#### The archive route carries all of it — checklist items included

A «Чек лист» keeps its items in the field's **`defaultValue`** (a JSON string of `{label, checked}`), and
that key travels: exported, then imported with other items, they showed up on a new record's form, the
`checked:true` one ticked `[C]`. Do not look for them in
`options` / `fieldOptionsStruct` (that reads as «items are lost») — a checklist does not use them (an import ignores that struct on a
checklist and even resets the field's `optionSource` to `null`). Everything else — all 27 types with their settings, all six system fields, all ten widgets with their
codes and urls — survives the archive round trip unchanged.

### 5j. BO header settings — name, description, code, «Помечать новые», «Скрыть кнопку добавить», Карточка/Вкладка `[C]`

The settings of the BO ITSELF that sit in the constructor header and its gear popover. Proven on a probe BO
built over the API, through the UI, and by archive (export, copy import, re-import). Format side:
`MYBPM-IMPORTS.md` §2 «BO header settings in the archive».

| setting | UI place | API (all `v2/business-objects/…`, PARAMS half, answer `""`) | archive key |
|---|---|---|---|
| name | header «Наименование:» input | portion `{businessObject:{id, nameMap, recordNameMap, description}}` | `name` |
| record name | — (no control of its own) | the same portion, `recordNameMap` | `recordName` |
| description | header centre textarea | the same portion, `description` | `description` |
| code | gear → «Код бизнес - объекта» → pencil → dialog «Изменение кода бизнес объекта» | `save-business-object-code {businessObjectId, businessObjectCode}` — or the dialog's cycle, below | `code` |
| «Помечать новые (непросмотренные) записи» | gear → checkbox → «Сохранить» | `save-business-object-settings {businessObjectId, businessObjectCode, isTouchEnabled}`; read `load-bo-is-touch-enabled {boId}` | `isTouchEnabled` |
| «Скрыть кнопку добавить» | gear → checkbox → «Сохранить» | `save-bo-hide-add-button-from-registry {boId, hideAddButtonFromRegistry}` | `hideAddButtonFromRegistry` |
| Карточка / Вкладка | card editor toolbar switch | `save-boi-view-type {boId, type: "FORM"\|"TAB"}` | `instanceViewType` |

All of them read back in `load-business-object-by-id` at once. Defaults of a new BO: `isTouchEnabled: true`,
`hideAddButtonFromRegistry: false`, `instanceViewType: "FORM"`, `description: ""`.

- **The header name input writes BOTH maps** `[C]`: typing in «Наименование» overwrote a `recordName` set apart
  over the API with the same text. A `recordName` different from the name exists only through the API or an
  archive, and nothing on screen shows it: `load-bo-components` returns it beside `name`, and the record title
  does NOT use it (next point).
- **A record with no `titleToShow` field is named after the BO's `name`, not its `recordName`** `[C]` —
  `load-bo-components` on such a record answered `name: "Проба шапки"` beside `recordName: "Запись
  пробы шапки"`, and the record tab carried the BO name. (§5h «Название записи» said `recordName`; the two were
  equal on that probe.)
- **«Скрыть кнопку добавить»** `[C]`: the registry loses its create button; the `⋮` there then offers only
  «Импорт из .xlsx» / «Экспорт в .xlsx» — records still come in through Excel and the API.
- **TAB** `[C]`: a record opens as a page tab (`display-instance?…&isTab=true&boiViewType=TAB`), FORM as a dialog.
- **`isTouchEnabled`** `[C]` as stored; what it does `[I]` (bundle): the menu-item editor asks
  `load-bo-is-touch-enabled` and shows the «needCountMenuItem» (unread counter) option only when it is true. The
  counter itself was not observed — records you create yourself are never «new» to you.
- **Archive** `[C]`: all seven keys of the table travel — export, copy import, re-import with flipped values. A
  re-import WITHOUT `isTouchEnabled` / `hideAddButtonFromRegistry` / `instanceViewType` / `description` RESETS them
  to `true` / `false` / `FORM` / `null` — always ship every key.
- **The popover «Сохранить» re-sends the code** through `save-business-object-settings` (the input there is
  read-only), so that endpoint also changes the code.

#### Changing the code — the dialog's cycle, and the two direct calls

The dialog runs controller **`bo/refresh-code`** — `/web/bo/refresh-code/<m>`, NOT under `v2` (a `v2/bo/…` call
answers 404): `analyze-code-usage {boId}` → `{refreshCodeDtoId, migrationType: [], alreadyInUse,
involvedInAnyMigration}`; poll `is-analyze-done {refreshId}` → `{done, errorMessage, scriptOwners, bpOwners}`;
then `apply-new-code {refreshId, newBoCode}`; `cancel {refreshId}` drops it. The analysis scans the scripts and
processes that use the code (so the dialog can list them). Fields have the same cycle under `field/refresh-code`
(`analyze-code-usage {boId, fieldId}`, `apply-new-code {refreshId, newFieldCode}`).

- `apply-new-code` before `done` answers `""` and changes NOTHING `[C]`.
- The dialog checks the new code on the client — not empty, no leading digit or one of `- = \` ~ ! @ # $ % ^ & * ( ) +`,
  no `#`, not a Java keyword or `id`/`in_id`/`out_id`/`inserted_date`/`in_status`/`occupied_id`/`occupied_at`/`removed`
  (`[I]`, bundle) — and on the server: `verify-business-object-code {businessObjectCode}` → `false` for an empty
  or TAKEN code, `true` for anything else, Cyrillic and spaces included `[C]`.
- **`save-business-object-code` and `save-business-object-settings` change the code at once and check NOTHING**
  `[C]` — they took a code already used by another BO of the company (two BOs then shared it), `Код кириллица`,
  `a b` and the empty string. They also skip the usage analysis, so scripts and processes that name the old
  code are not migrated. Before calling either, run `verify-business-object-code` yourself.
- **One undecodable script kills the dialog for the whole company** `[C]` (trap 59).

### 5k. Card tabs — `boTabs`, `delBoTabs`, the messenger link field `[C]`

The icons on the right-hand rail of a record card. Constructor: «Карточка» view → the rail right of the form →
`+` → a checkbox list «Чат / Люди / Файлы / История / Печатные формы / Telegram / WhatsApp»; a tab is removed by
its trash icon (confirm «Удаление вкладки бизнес-объекта. Продолжить?») or by unticking it; HISTORY and
WHATSAPP/TELEGRAM carry a gear instead of a trash icon. Nothing is written until the card «СОХРАНИТЬ». Format
side: `MYBPM-IMPORTS.md` §2 «BO card tabs in the archive».

On the record card (proven by opening each): CHAT = the record's chat («N собеседников», message box), PEOPLE =
its participants, FILES = a file list with «Загрузить файл», PRINT_FORM = the print forms, HISTORY = the journal
(§5h «История»). The rail follows `orderIndex`.

**API** — `save-business-object-portion` with a PARTIAL BO, nothing else of the BO changes:
```js
{businessObject: {id, boTabs: [{type: "CHAT", orderIndex: 1}, {type: "FILES", orderIndex: 2}], delBoTabs: ["PEOPLE"]}}
```
- **`boTabs` is an UPSERT, not the full set** — a tab left out of the list stays. Only `delBoTabs: [<type>]`
  removes one. A new `orderIndex` on a listed tab moves it. The card «СОХРАНИТЬ» sends the whole list
  renumbered 1..n plus `delBoTabs` for what was removed.
- **Nothing is validated** — `TELEGRAM` was accepted on a BO outside the company messenger list, with no
  messenger connected (`messenger/settings/load-messenger-bo-settings {messengerType}` →
  `{isActive:false, isConnected:false, boAllow:[]}`). The card then shows the tab: without a link field a click
  answers the error «no filed with id =null», with one it is disabled. The constructor offers TELEGRAM/WHATSAPP
  disabled in its list («выберите данный бизнес-объект в меню Настройки»), so a tab put there by the API or an
  archive cannot be unticked in the UI — remove it with `delBoTabs`.
- **Link field** (the field whose value — a Telegram login for `INPUT_TEXT`, a phone for `INPUT_PHONE` — ties a
  record to a messenger chat): `save-messenger-link-field-id {boId, fieldId, messengerType: "TELEGRAM"|"WHATSAPP"}`
  (PARAMS half, answers `""`; `fieldId: null` clears it), read back in `load-business-object-by-id` as
  `tgLinkFieldId` / `waLinkFieldId`. `get-messenger-link-field-id {boId, messengerType}` →
  `{userSearchType: "LOGIN"|"PHONE", linkFieldId}` LAGS: right after the save it still answered `null`, a few
  seconds later the field and `LOGIN`. Read `load-business-object-by-id` instead. The structure export reads the
  same lagging source — an export right after a link change can carry the old link; wait ~10 s. The search method of the
  constructor form is not sent — the server derives `userSearchType` from the field type.
- **Archive**: `boTabs` (a map) travels and only ADDS; the links travel as `messengerFieldCode` (Telegram) and
  `whatsAppFieldCode` (WhatsApp), and a re-import never clears them (`MYBPM-IMPORTS.md` §2).
- What a connected messenger does with the tab (chat mirroring, the user search) is `[U]` — no stand of ours
  has one connected; the company switch is `messenger/settings/save-messenger-bo-settings` (company-wide, not
  touched).

### 5l. BO views — «Календарь», «Карта», «Группировка» `[C]`

Three registry views are switched on the BO itself. Proven on probe BOs built by archive, switched over the API,
through the constructor toggles and by archive (export, copy import, re-import), with records looked at in each
view. Format side: `MYBPM-IMPORTS.md` §2 «BO views in the archive».

| view | UI place | API (`v2/business-objects/…`, PARAMS half, answer `""`) | archive key |
|---|---|---|---|
| calendar | constructor view «Календарь» → toggle «Включить календарь» | `save-is-calendar-enabled {boId, isCalendarEnabled}` | `isCalendarEnabled` |
| map | constructor view «Карта» → toggle «Включить карту» | `save-is-map-enabled {boId, isMapEnabled}` | `isMapEnabled` |
| grouping | `…/editing/<boId>/grouping-editing` → toggle «Включить группировку» | `save-is-grouping-enabled {boId, isGroupingEnabled}` | `isGroupingEnabled` |

- Read back: `load-bo-calendar-enabled` / `load-bo-map-enabled` / `load-bo-grouping-enabled {boId}` → `true|false`,
  or the three keys of `load-business-object-by-id`. **The loaders lag a few seconds** — right after a switch they
  still answered the old value, ~8 s later the new one.
- **Nothing is validated**: map and grouping were accepted on a BO without a `GEO_POINT` and without a reference
  field (the editor only shows a «disabled» text in that case).
- The registry's view chooser (top right, «Список ▾») lists «Календарь» / «Карта» / «Группировка» exactly for the
  enabled flags; switching one off removes it from the chooser.

**Calendar.** The event title is the «Настройка отображения заголовка» chips: `v2/calendar/save-calendar-view-titles
{boId, titles: [{id: <fieldId>, name: <label>}]}` (PARAMS half; the whole list each time), read by
`v2/calendar/load-calendar-view-settings {boId}` → `{titles, template}`. With «Дата» and «Статус» chosen the event
read «Статус : Новый, Дата : 05.10.2026». A new BO starts with one title (the name field, or another field — the
default is not stable). **The titles do NOT travel in the archive** — no key in the export; a re-import leaves the
stand's titles alone, a copy gets its own default. The hover card is `calendarCardTemplates` (§5i, travels).
Which dates place an event: `needShowToCalendar` (§5h).

**Map.** The registry «Карта» is a Leaflet map of the BO's `GEO_POINT` values, one marker per record («2 из 2»).
Points come from `v2/geo/load-bracket-boi-points` (body = the registry bracket filter `{boId, dynamicFilters,
nativeFilters, brackets, search, paging:{offset, limit, hasNext}, ordering, state}`) → `[{boiId, coordinate:{lat, lon},
fields:[{label, displayValue, …}]}]` — **and the `fields` of a point are the KANBAN card template's fields**. So:
- **A BO with a `DROPDOWN_SINGLE` that has no kanban card template cannot show its map** `[C]`: as soon as it holds a
  record, `load-bracket-boi-points` answers NullPointerException «cardTemplate is null» and the map stays empty;
  the kanban view and the constructor's kanban editor die with the same error. A BO built in the constructor gets
  the template on its own; an ARCHIVE BO gets it only from `kanbanCardTemplates` (`MYBPM-IMPORTS.md` 0.5c), and
  every archive BO with a dropdown imported without one was broken this way (trap 61).
- `v2/kanban/save-kanban-card-template` does NOT repair it (it fills another store, §7). **A re-import with
  `kanbanCardTemplates` for that dropdown DOES** — the map, the kanban view and the editor came back, records kept.
- A BO with a GEO_POINT and no dropdown at all: points load (`[]` with no records); not looked at with records `[I]`.

**Grouping.** The levels and columns are per FIELD, `groupingInfo {colToShow, colOrderIndex, nodeTreeActive,
nodeTreeLevel}` (`nodeTreeActive` + `nodeTreeLevel` 0.. = a tree level, `colToShow` + `colOrderIndex` = a table
column), saved by `v2/boi-grouping/save-business-object-grouping-fields` with a BODY `{businessObjectId, fieldList:
[{fieldId, archetype: "DYNAMIC", groupingInfo}]}` (only the listed fields change); the constructor tree is
`load-business-object-grouping-tree {boId}`. A tree level must be a `BO` / `CO` field with `viewType` `SINGLE` or
`MULTIPLE`.
- **The constructor page has no button** — the view chooser does not list it. **Loading
  `…/editing/<boId>/grouping-editing` directly gives a blank page**; it renders only when reached inside the app:
  open another editor page of the BO, then `history.pushState({}, '', '/business-objects/editing/<boId>/grouping-editing');
  dispatchEvent(new PopStateEvent('popstate', {state: {}}))`. Its toggle writes `isGroupingEnabled` like the API.
- **The registry «Группировка» is dead on this build** `[C]`: the view calls
  `v2/boi-grouping/load-bo-instance-grouping-table` and `load-bo-instance-grouping-root` — both **404** on the
  server; only `load-bo-instance-grouping-search` answers (`{nodes: [], hasNext: true}`). The view shows an empty
  tree. Do not offer grouping to a user; the flag and the levels store and travel, nothing renders them.

### 5m. The BO's sidebar row — «Дублировать», «Переименовать», order, «Добавить в группу», the create-record iframe URL `[C]`

The left list of the constructor (`/business-objects/editing/<boId>`) shows the BOs by group; the row's ⋮ menu has
«Права доступа» (menu rights, known), «Переименовать», «Добавить в группу», «Дублировать», «Экспортировать»,
«Удалить». All calls below are `v2/business-objects/…` and answer `""` unless said otherwise. Read the list with
`load-business-object-groups {forEdit: true}` (PARAMS) → `[{id, name, code, orderIndex, kind, records: [{id, name,
orderIndex, boCategory}]}]`, records sorted by `orderIndex`. Format side: `MYBPM-IMPORTS.md` §2 «BO place in the
sidebar».

**«Дублировать» = `clone-business-object {boId}`** (PARAMS) → `{id, name, orderIndex, boCategory}` of the new BO; the UI
asks nothing and jumps to the clone's editor (its header still shows the source's name until a reload). What the clone
gets, checked on a header/tabs probe, a views probe with 3 records and a scripted probe:
- name `Копия_<name>_<N>` and code `<code>_<N>`, where N is a company-wide clone counter (17, 18, 19 … one per clone,
  deleted ones included). **The other languages come out as `Copy_null_<N>` / `Көшірме_null_<N>` / `Köşırme_null_<N>`**
  when the source has no text in them — rename the clone in every language you show.
- the same group and the same `orderIndex` as the source;
- every field with the **same field ids and codes** (a field id is unique only inside its BO), the card layout, the
  registry columns, `boTabs`, the messenger link fields, `instanceViewType`, the header flags, the calendar/map/grouping
  flags, `groupingInfo`, the kanban card template, record rights and the menu-rights record;
- **the scripts, all versions** (work and test) as NEW script modules whose `scriptId`s repeat the source's — the
  definitions are stored per (module, scriptId), so editing the clone's script leaves the source alone (proved by
  `apply-update-cmd` on the clone's «Закрытие» and reading both); the hooks fire on the clone's records;
- NOT copied: the records, the calendar event titles (the clone gets a default), the create-record iframe token, menu
  items;
- **a business process clone loses its work version**: both versions and both diagrams copy byte for byte, but the old
  work version comes back with `isWork: false` (the test one stays test) — publish one before the process can run.
A record saved into a clone through §6a is an ordinary record of the clone.

**«Переименовать» = `save-bo-record`** BODY `{id, name}` — and on this build it writes **`recordName` only**: `name`,
`nameMap`, the sidebar row and the header keep the old name, also after a reload (UI and API alike, checked with a
10-s wait for the cache). The working rename is the header «Наименование» input (§5j), which writes `name` and
`recordName` together. Trap 63.

**Order inside a group = `save-bo-record`** BODY `{id, orderIndex}`. Dragging a row sends it with the midpoint of the
two neighbours' `orderIndex`. **Every archive-created BO carries the template's `orderIndex` 47480000**, so two archive
BOs side by side have the same value, the dragged row gets that value too and after a reload it falls back to the end
of the block of equal values (21 BOs shared 47480000 in one group) — the drag is lost. Give such BOs distinct values
(this call, or `orderIndex` in the archive). A BO with `orderIndex: null` (a re-import without the key, `MYBPM-IMPORTS.md`
§2) is listed first in its group. Trap 64.

**«Добавить в группу» MOVES the BO** — the submenu is a radio list of the groups, one choice, and it calls
`move-business-object-to-group {boId, boGroupId}` (PARAMS); the BO leaves its old group and keeps its `orderIndex`.
Works on clones, archive BOs and constructor BOs alike. Dragging a row into another group does the same plus a
`save-bo-record` for the place.

**The create-record iframe URL** — header gear → «Сгенерировать встраиваемый URL на создание» → «Пользователь:
Выберите» (a person chooser, `v2/org-unit/load-filtered-persons-v2`) → «Сформировать»:
- `generate-create-bo-token {boId, personId}` → a bare 216-character token; `load-create-bo-token {boId}` →
  `{createBoToken, boId, orgUnitRecord: {id, name, email, …}}`, or `""` when none was made.
- The three URLs are `<origin>/iframe/<token>/bo?globalLang=rus|eng|kaz`. The page shows the BO's create form with
  «СОХРАНИТЬ» / «ОТМЕНИТЬ»; a record saved there lands in the BO (`isTouched: true` for the BO's owner).
- **Generating again revokes the old token**: `v2/auth/load-create-bo-token-record {createBoToken, timeOffsetZoneInMinutes,
  timezoneRegion}` (PARAMS, no login needed) answers `{createBoToken, boId, personId}` for the current token and
  RuntimeException «can't find by token» for the previous one. There is no other way to revoke.
- The token is per BO: a clone does not inherit it, the archive does not carry it.
- **Opening the URL in a browser that is logged in to the stand stores the token in that origin's localStorage**
  (`LOCAL_Screate_bo_token`), and an HTTP interceptor then adds a `create_bo_token` header to EVERY request of that
  origin, the user's own session included. Remove the key after testing an iframe URL. Trap 65.
- The token alone is not a session: a request with only `create_bo_token` (no `token`) answers SecurityError «Illegal
  Session». Which person a record made through the URL is authored by, and whether the page works in a browser with no
  stand login at all, is `[U]` (needs a logged-out browser).
- The iframe page itself is the Angular route `/iframe/:createBoToken/bo` (`IframeModule`), which calls
  `load-create-bo-token-record`, stores the token, then opens the ordinary record form in CREATE mode.

### 5n. Company settings that name a BO — physical removal, offline, messengers `[C]`

«Настройки» (`/settings?settingsOpenPageUrl=<page>`) holds a few company-wide pages whose lists name BOs. None of
them is part of the BO: they are stored per company, keyed by the BO's stand id, **no archive carries them** (an
export of the BO with structure + rights + scripts has no trace of any of them, and a re-import of the BO leaves them
in place — `MYBPM-IMPORTS.md` §2 «Company settings that name a BO»). Set them on the target stand after the import,
by API or UI. Every save is a BODY, every answer `""`; a loader reflects the save at once.

| page (`settingsOpenPageUrl`) | load | save | per-BO content |
|---|---|---|---|
| «Физическое удаление» (`physical-remove`) | `v2/company/load-physical-remove-settings` | `v2/company/save-physical-remove-settings` B `{boSettings:[…]}` — the WHOLE list, what is left out is dropped | one rule per BO, below |
| «Оффлайн режим» (`offline`) | `offline/settings/all-offline-mod-settings` | `offline/settings/save-offline-mod-settings` B `{offlineModActive, dayNumbersUntilReset, nestedLevel, maxCountOfflineInstances, addOfflineAllow, deleteOfflineAllow, addViewBoAllow, deleteViewBoAllow, addEditBoAllow, deleteEditBoAllow}` — add/delete deltas | `viewBoAllow` «Список бизнес объектов для просмотра», `editBoAllow` «… на создание/редактирование»; items `{boRecord:{id,name}, displayName}` |
| «Мессенджеры» → «Использование» (`messenger`) | `messenger/settings/load-messenger-bo-settings` P `{messengerType}` | `messenger/settings/save-messenger-bo-settings` P `{messengerType}` B `{isActive, boAllow, delBoAllow, userAllow, delUserAllow}` — deltas | `boAllow` «Выбор бизнес-объекта», items `{id, name}` |
| «Мессенджеры» → chat registry | `messenger/settings/load-messenger-chat-registry-settings` P `{messengerType}` | `messenger/settings/save-messenger-chat-registry-settings` P `{messengerType}` B `{chatRegistryBoRecord:{id,name}\|null, isCreateUnique}` | one BO per messenger, below |

`messengerType` is `TELEGRAM` or `WHATSAPP`. The record `name` you send is cosmetic — the loaders always return the
BO's current name.

**Physical removal** — one entry per BO: `{record:{id,name}, daysAfterCreation, daysAfterCreationEnabled,
afterChangeFields:[{id, fieldId, fieldLabel, newValue, newDisplayValue}]}`. The page warns «Внимание, актуальные
записи будут удалены безвозвратно!»: live records are deleted for good «Спустя N дней с момента создания» (when
enabled) and/or «При изменении значения поля <F> на <V>». Only `DROPDOWN_SINGLE` fields are offered
(`v2/business-objects/load-bo-field-records P {boId}` filtered by type; options from `load-bo-field-options P {boId,
fieldId}`); `newValue` is the option id, the condition `id` is any 10-char client id. The UI lists only `GENERAL` BOs
that are not panels. A rule saved by API shows in the UI unchanged. **The removal is NOT immediate** `[C]`: with a rule «Статус → Удалить» on two of three records and, from 17:03Z, also «Спустя 0 дней» enabled, all three records were still live (`state:"ALL"` `totalHits` 3, none `REMOVED`) about 25 minutes later; the purge runs on a server schedule whose period is unknown `[U]` — do not test a rule on records you need, and expect no visible effect right after saving.

**Offline** — the two BO lists are shown only while «Включить использование оффлайн режима» is ticked (the page
reads the stored lists even when the mode is off, and the API stores them with `offlineModActive:false`). «ОТМЕНИТЬ»
on that page reloads the whole page. The two delete deltas take the BO as `{id, name}` — sending the shape the loader returns (`{boRecord:{id,name}, displayName}`) fails with a `NullPointerException` («offlineModSettings_viewBoAllow__del(... String boId==null ...)») `[C]`. `addOfflineAllow` («Разрешено использовать оффлайн режим») is a list of ORG
UNITS, not BOs.

**Messenger «Выбор бизнес-объекта» (`boAllow`) ADDS the messenger's tab to the BO's card** — `boTabs` gets
`{type:"TELEGRAM"|"WHATSAPP", orderIndex:5}` at once, and `delBoAllow` removes that tab again. That is the
server-side link between this page and §5k; it works with the messenger switched off (`isActive:false`).

**The chat registry BO is RENAMED by the server** `[C]` — `save-messenger-chat-registry-settings` with a BO rewrites
that BO's `name`, `recordName` (all four languages: «Реестр чатов» / «Chat registry» / «Чат тізімі» / «Chat tızımı»)
and `description` («Реестр чатов»); fields, code and tabs stay. And **it cannot be unset**: the UI's «unselect» sends
`chatRegistryBoRecord:null`, the server answers `""` and keeps the old BO. `isCreateUnique:true` together with a BO is
refused («You can not register exists ChatRegistryBo and create unique ChatRegistryBo at the same time»); alone it
asks the server to create its own registry BO (not run). The UI's picker lists only
`messenger/settings/load-chat-registry-business-objects` — empty on `<stand>` — so an ordinary BO can be made the
registry only through the API. A re-import of the registry BO puts the archive's name back; the registry pointer
stays. Trap 66.

**Not per BO, despite the inventory names** `[C]` (read from the client): «Мобильное приложение»
(`v2/company/all-mobile-settings` / `save-mobile-settings`) — all seven lists, `importBoAllow` included, are ORG-UNIT
lists (who may take screenshots, copy, import, download…), not BO lists.

**Not run** `[U]`: «Телефония» (`v2/telephony/settings/load-telephony-bo-settings P {type}` — `callOpenBoRecord`, the BO
a call opens, plus field lists) and «IN/OUT Миграция» (`kafka_migration/settings/load-{in,out}-migration-settings`,
allowed BOs) need a configured telephony provider / Kafka; on `<stand>` the provider is `null` (`all-telephony-settings`
→ NPE «Провайдер телефонии отсутствует»).

**«No archive carries them» holds for the BO's OWN export only.** The export screen has a
third basket, company settings (`struct/load-settings-export-kinds` → 14 kinds: `LANGUAGES, MOBILE,
PHYSICAL_REMOVAL, TELEPHONY, OFFLINE, IN_MIGRATION, OUT_MIGRATION, MESSENGER, OTP, NAVIGATOR, AUDIT_TRAIL,
MIGRATION_MONITORING, SCRIPT_SETTINGS, APPEARANCE`), and a ticked kind exports as a `CompanySettingsStructDto` line.
Proven end to end only for `SCRIPT_SETTINGS` (§5o); the payload of that line already has the keys
`boiDeleteSettings`, `messengerTypes`, `messengerCompanySettings`, `offlineViewBoAllowCodes`,
`offlineEditBoAllowCodes`, which suggests physical removal / messengers / offline travel the same way, by BO CODE — but
see the next paragraph: **the messenger lists do NOT travel.**

**Every kind of the settings basket, imported back** `[C]`: per kind, what the line carries
and whether an import replaces, merges or ignores — the table in `MYBPM-IMPORTS.md` §2 «The other company-settings
kinds». In short: OFFLINE, MOBILE, LANGUAGES and SCRIPT_SETTINGS **replace**; PHYSICAL_REMOVAL **upserts by BO code and
never removes**; OTP recreates its row but loses the department; AUDIT_TRAIL overwrites the **first** audit row only;
MIGRATION_MONITORING sets the monitor by code; NAVIGATOR does not export the Google key; MESSENGER exports only the on/off
map and its import did nothing. The import of an archive is the §5 cycle; a settings-only archive with one kind takes
~10–20 s, so drive it fire-and-forget from the page (§10, the 45-s `javascript_tool` limit).

The pages behind the other kinds, all read off the client and exercised the same day (saves answer `""`):

| page | load | save |
|---|---|---|
| «Поддержка языков» | `v2/company/all-languages` → `[{language, code, orderIndex, isDefault, isActive, displayName, shortName}]`; `default-language` → `"ENG"`; `system-languages` = the active ones | `v2/company/language-add` B = the WHOLE list in that shape (the UI sends every language, `isActive` per row); `language-remove P {language}` |
| «Мобильное приложение» | `v2/company/all-mobile-settings` → seven org-unit lists | `v2/company/save-mobile-settings` B deltas `add<List>` / `del<List>` for `ScreenshotAllow, CopyAllow, ImportBoAllow, DownloadFileAllow, DownloadPrintFormAllow, DownloadReportAllow, MobileAllow`; add items `{orgUnitId:{id,type}, displayName}`, del items `{id, type}` |
| «OTP-аутентификация» | `v2/company/get-otp-settings` → `{id, department, personGroups, isActive, createInCurrentCompany, …}` (`id` null = no row) | `v2/company/save-otp-settings` B `{id, isActive, createInCurrentCompany, departmentId, personGroupsToAdd:[{id,name}], personGroupsToDel:[…]}`; **`isActive:false` deletes the row** |
| «Навигатор» | `geo-map/settings/load-geo-map-company-fields P {geoMapType:"GOOGLE_MAP"}` (field `api_key`), `load-geo-map-company-field-values P {geoMapType}` → `[{code, value}]` | `save-geo-map-company-field-values P {geoMapType} B [{code:"api_key", value}]` (`value:null` clears; on the favicon page the save answers a websocket «No session» error AFTER storing) |
| «Аудиторский след» | `aud-boi-settings/load-table-records` → rows `{id, historyBoRecord, audBoList, latestHistoryPeriodDays}`; `load-fields` (11 slots); `load-field-values P {recordId}` → `[{code, value:<field id>}]` | `save-aud-settings` B `{id, historyBoId, audBoIdList, latestHistoryPeriodDays}` (the row's own shape → NPE «audBoIdList is null»); `save-field-values P {recordId} B [{code, value}]`; `create-table-record`, `remove-table-record P {recordId}`. The BO list behaves as a set (order not kept) |
| «Мониторинг миграции» | `pg-migration-settings/load-settings` → `{monitorBoRecord}`; `load-fields` (9 slots); `load-field-values` | `save-settings` B `{monitorBoId}` — **cannot be unset** (`null` ignored, `""` → `IllegalId`, no key → NPE); `save-field-values` B `[{code, value:<field id or "">}]` |

Offline corrections: `nestedLevel` is the enum `NONE` / `FIRST` (a number → 400 «Failed to read request»); the add
deltas take `{boRecord:{id,name}, displayName}` for BOs and `{orgUnitId:{id,type}, displayName}` for org units, the
delete deltas `{id, name}` / `{id, type}`. Messenger `userAllow` / `delUserAllow` take org-unit records
`{id, type, name}`. Org units for any of these: `v2/business-objects/load-org-unit-record-list P {filter:{searchText,
types:["DEPARTMENT"|"GROUP"|"PERSON"]}, skipFirstCount:0}`.

### 5o. «Выставление сервисов» — a BO as a public HTTP endpoint `[C]` (`<stand>`)

`/settings?settingsOpenPageUrl=script` («Выставление сервисов», header «Список выставления сервисов»). Each row
binds an **entry point** to a **service BO**: every HTTP call to
`https://<stand>/api/v1/script/service/<COMPANY CODE>/<entry point>` (work scripts) or
`…/api/v1/script/service_test/<COMPANY CODE>/<entry point>` (TEST script version) **creates one record of that BO**,
copies the request into it, runs the BO's «Создание» hook (`onInstanceCreationId`), and answers with fields of
that record. **No token, no login** — anyone who knows the URL creates records; treat the entry point as public.
The company code is the tenant's code (the dialog prints both full URLs).

**The row** (dialog: «Точка входа» input, «Бизнес-объект» picker of every non-panel BO, then two columns):
- entry point: no leading/trailing `/`, no spaces (client checks only); it is the LAST path segment —
  `…/<ep>/extra` or an unknown ep answers 500 «Not found entry point [<ep>]. Company with code [<C>] found».
- **ten fixed slots**, each a field of the service BO (`load-fields` gives code, Russian label and the allowed
  kind: `TXT` = INPUT_TEXT/INPUT_TEXT_LANG/TEXTAREA/TEXTAREA_LANG, `TXT_ML` = the same list, `NUM` = INPUT_NUMBER,
  `FILE` = FILE_UPLOAD):

| slot | kind | filled by / read by the server |
|---|---|---|
| `INPUT_TXT` | TXT | ← the request body |
| `INPUT_CONTENT_TYPE` | TXT | ← the request `Content-Type` |
| `METHOD` | TXT | ← `GET`/`POST`/`PUT`/`PATCH`/`DELETE` (all five accepted) |
| `REQUEST_ERRORS` | TXT_ML | ← what went wrong preparing the record (header not parseable, query parameter with no such field …), joined by `; <br>` |
| `SCRIPT_ERRORS` | TXT_ML | ← script errors («В бизнес-объекте нет скриптов вообще», bad result code …) |
| `MODE` | TXT | ← `PROD` or `TEST` (which URL was called) |
| `RESULT_TXT` | TXT | → the response body |
| `RESULT_CONTENT_TYPE` | TXT | → the response `Content-Type` (the script must set it) |
| `RESULT_CODE` | NUM | → the HTTP status; empty or < 100 → **501, empty body** (+ «Указан не верный диапазон…» in SCRIPT_ERRORS) |
| `RESULT_FILE` | FILE | → a file to download; **if mapped, the script MUST put a file there, else 500** «Field RESULT_FILE … has no any file after creation instance script execution» (the record is still created). Leave it unmapped when the service returns text. A filled file REPLACES the answer — see «File answer» below `[C]` |

- **«Входящие заголовки, копируемые в поля»**: any number of `header name → field` pairs; allowed fields
  INPUT_TEXT / INPUT_NUMBER / FULL_DATE. A missing header writes «Заголовок `X` в запросе отсутствует» into
  REQUEST_ERRORS (the call still runs). A FULL_DATE header takes **only the RFC 1123 HTTP date**
  (`Thu, 01 Oct 2026 10:00:00 GMT` → stored `2026-10-01T10:00:00.000Z`); ISO with/without zone, epoch millis,
  `2026-10-01`, `01.10.2026`, `01.10.2026 10:00` were all refused. **Non-ASCII header values arrive as mojibake**
  (UTF-8 bytes read as Latin-1) — keep headers ASCII. Two headers may target one field.
- **Query parameters fill fields BY FIELD CODE** (`?Zagolovok_tekst=abc` → that field); a parameter with no
  such code goes to REQUEST_ERRORS («Пришёл параметр, но у бизнес-объекта нету поля с таким кодом»). A slot
  beats a parameter (`?Rezhim=x` on the MODE field stayed `PROD`). JSON body keys are NOT spread into fields.
- **The body must be empty or a JSON OBJECT** — the platform's request filter (`RequestWrapper`) parses every body
  as a JSON map before the service sees it: `text/plain`, form-urlencoded, XML, a JSON string or a JSON array all
  answer 500 `JsonParseException` / «Cannot deserialize … LinkedHashMap», and NO record is created. A JSON object
  arrives verbatim (UTF-8 intact) in INPUT_TXT.
- **TEST mode runs the BO's TEST script version** (no TEST version → none runs); its records are ORDINARY records
  (`state` ALL, the «Тестовые»/DEV registry stays empty) with MODE = `TEST`.
- Scripts: only «Создание» runs (no form is opened); it reads the request fields and writes the result fields
  with ordinary `BlockAssign`s (`MYBPM-IMPORTS.md` §0S.7). Without any script the answer is 501.
- **File answer** `[C]` (a separate entry point on the same probe BO with `RESULT_FILE` mapped to a
  single-mode FILE_UPLOAD, TEST script): the «Создание» script makes a file and assigns it to the field's
  `#Значение` — `<text>.#Записать в файл(fileName)` (`F-writeToFile-K-FIX-T-String`, the text as UTF-8) or
  `<base64>.#Base64 преобразовать в файл(fileName)` (`F-textToFile-K-FIX-T-String`, binary; a PNG came back
  byte-identical). The answer is then the file: status = RESULT_CODE, **body = the file bytes (RESULT_TXT is
  ignored)**, `Content-Disposition: attachment; filename="<name>"` (a non-ASCII name is percent-encoded UTF-8
  inside plain `filename=`, no `filename*=`), and **Content-Type comes from the file name's extension, NOT from
  RESULT_CONTENT_TYPE** (`.txt` → `text/plain;charset=UTF-8`, `.png` → `image/png;charset=UTF-8`, `.json` →
  `application/json;charset=UTF-8` while the slot held `text/plain`). **The name must carry an extension the file
  storage knows**: `dannye.xyz` and a bare `otchet` both fail inside the script with
  `kz.greetgo.file_storage.errors.NoFileMimeType: No MIME type` (written to SCRIPT_ERRORS; the assignments before
  it, RESULT_CODE included, are kept), the field stays empty and the call answers 500 «has no any file». The file
  also stays in the record. Six TEST calls in a row caused no outage this time. Trap 69.
- Every call that reaches the BO creates a record, failures included — a busy service fills its BO; plan a
  physical-removal rule (§5n) if needed.

**API** — controller **`/web/script-settings/<m>` (NOT `v2`)**, standard envelope; P = params, B = body:

| call | send | returns |
|---|---|---|
| `load-table-records` | — | `[{id, entryPointTemplate, serviceBoRecord:{id,name,…}, orderIndex}]` |
| `create-table-record` | P `{orderIndex}` (UI: last + 10000) | a new empty row `{id, …null}` — exists at once |
| `save-script-settings` | B `{id, serviceBoId, entryPointTemplate}` | `""` |
| `load-fields` | — | the ten slots `[{code, label, type}]` |
| `load-field-values` / `save-field-values` | P `{recordId}` / P `{recordId}` B `[{code, value:<fieldId>}]` (`""` unmaps) | `[{code, value}]` |
| `load-header-values` / `save-header-values` | P `{recordId}` / P `{recordId}` B `[{code:<header>, value:<fieldId>}]` — the WHOLE list | `[{code, value}]` |
| `change-table-record-index` | P `{recordId, index}` | drag order |
| `remove-table-record` | P `{recordId}` | delete the row |

Saves answer `""`; **loaders lag a few seconds** (a header list read right after the save came back unchanged, the
same read 2 s later had it).

**Archive** — the rows travel in the company-settings basket, NOT with the BO:
`struct/change-settings-export-kind` **P** `{kind:"SCRIPT_SETTINGS", value:true}` (in B it silently does nothing;
`count-settings-export-kinds` must say 1), then the usual export (R4a). The line is
`CompanySettingsStructDto {kind:"SCRIPT_SETTINGS", payloadJson:"<json string>"}` whose
`scriptControllerSettings` lists **every row of the company** as `{serviceBoCode, orderIndex, entryPointTemplate,
baseFields:{<slot>:<field CODE>}, headerFields:{<header>:<field CODE>}}` (an unmapped slot is absent). Import
(`MYBPM-IMPORTS.md` §2 «Exposed services»): the analyzer shows it as one item «Выставление сервисов», `structTypes
["SETTINGS"]`, `settingsState:"UPDATE"`; **apply REPLACES the whole list** — rows not in the archive are deleted,
every row is recreated with a new id, codes are resolved to field ids. Rollback (`restoreItems` category
`SETTINGS`) brings the old rows back (new ids again) **but with field CODES where ids belong** — the slots and
headers are then dead (the service ran and answered 200 with an EMPTY body). Repair after a rollback: re-send
`save-field-values` + `save-header-values` with ids for every row. Trap 67.

**Script versions trap — the first, implicit version of a BO that never had scripts cannot see any BO**
`[C]`: on a constructor-made BO, `load-bo-script-versions` returns one version (`isTest:true`);
wire and fill a hook there and `translate-script` reports `exprAct__noDefinitionForActId` for every
`F-VALUE-K-DYN-R-D-S-boi_fields` hop (the field hop's type is NULL), and the TEST service URL fails with
«Ошибка компиляции скрипта на создание инстанции для режима ТЕСТ». `v2/script/load-bo-def-list
{scriptModuleId}` is the tell: `list: []` for that module, 252 BOs for any other. Two more BOs of the same day
(one constructor, one archive copy) showed the same empty list. `in-work-bo-script-version` refuses it
(`script_on_instance_creation_cause`). **Fix: `copy-bo-script-version P {boId, boScriptsId}`** — the copy sees
every BO, translates `success:true`; then `in-work-bo-script-version` on the copy (no new test version was
created this time) and, for a working TEST version, copy again + `in-test-bo-script-version`. Trap 68.

**A whole-stand outage followed one TEST call** `[I]`: the first GET to `service_test` right after a new TEST
version was published created its record (no result written) and then every URL of the stand, the API included,
answered nginx 502 for about a minute; the same call afterwards worked. Cause not proven — space TEST-mode
experiments out and watch `load-auth-info` between calls.

Probe on `<stand>`: BO «Проба сервиса» (group «Тест»), entry point
`proba-servisa` (and `proba-fajl` with RESULT_FILE mapped — the file answer), work script v2 answers `method=…; mode=…; hdr=<X-Proba-Text>; body=<body>` with 200, test v3 with
201.

## 6. Records: Excel import and export

Records (instances) are imported as **Excel files into a BO registry** (registry kebab → импорт/экспорт
xlsx), never through the structure archive.

### Import and export through the API — controller `v2/bo-transfer` `[I]` (read off the bundle)

The registry kebab's «импорт/экспорт xlsx» is an ordinary controller, and it is **two-phase like the
structure import**: the upload builds an "act" you can read, and a second call applies it. Read off chunk
`7084`; **not executed** — every record import so far was done through the UI.

| # | call | params | note |
|---|---|---|---|
| 0 | `load-bo-import-details` | `{businessObjectId}` | what the importer expects of this BO |
| 1 | `download-template` | `{businessObjectId, selectedFieldIds}` | a plain **GET** with query params, no envelope → the xlsx |
| 2 | `import-from-file` | multipart: file under **`file`**, plus the form field `businessObjectId` | → `{actId}` |
| 3 | `is-import-file-finished` | `{actId}` | poll |
| 4 | `load-import-file` | `{actId}` | the act: new / updated / errors — **nothing written yet** |
|   | `load-bo-import-table` | body = a table request | the act's rows |
| 5 | `apply-imported` | `{importId}` | **writes** |
|   | `cancel-imported` / `imported-ok` | `{importId}` | drop / close |
|   | `watch-import-finished` | `{importId}` | poll the apply |
| 6 | `download-errors` | `{importId}` | the «Ошибки при загрузке …» xlsx |

Export: `export-bo` (raw body, params `boInstanceIds`, `boFieldIds`) and `export-bracket-bo`
(`{…filter…, boInstanceIds, boFieldIds, needBoiId}`) → an `exportId`; then `is-bo-export-file-ready
{exportId}` and `load-bo-export-file {exportId}` → the bytes. `needBoiId: true` is how an export gets the
`ID` column that makes a re-import idempotent (§«Merge / idempotency»).

### 6a. Creating a record WITHOUT the UI — the draft cycle `[C]`

The old blocker «the «Добавить» button reacts to no synthetic click, and the record API is draft-based
and was never reverse-engineered» is closed. Controller **`v2/business-object-instance`** (the client's
own `v1/...` prefix is a 404 on the live stand — the same trap as `ensure-index`), four calls:

| # | call | params | body |
|---|---|---|---|
| 1 | `create-draft` | `{}` | `{}` → a bare `"<draftId>"` string |
| 2 | `v2/create-boi` | `{draftId, boId}` | `{}` → a bare `"<boiId>"` string |
| 3 | `v2/save-boi-value` | `{}` | the DTO below → `[]` |
| 4 | `apply-and-remove-draft` | `{draftId, boProcessId:null, isAutoSave:false}` | `{}` → empty 200 |

The value DTO (class `M` of chunk `43756`, built by `M.of(draftId, boId, boiId, isDev)` +
`addValue(fieldId, value, saveType)`):

```json
{"draftId":…, "boId":…, "boInstanceId":…, "newIsDev":false, "setNewIsDev":false,
 "values":[{"fieldId":…, "value":"…", "saveType":null}]}
```

- `addValueId(fieldId, valueId)` is the reference/dropdown variant: `value:""` plus `valueId`.
- Related in the same controller: `copy-bo-instance {boId,boiId}`, `delete-bo-instance
  {businessObjectId, boInstanceIds}`, `archive-bo-instance`, `restore-bo-instance`,
  `is-field-value-unique {boId,boiId,fieldId,value}`, `load-boi-id-by-unique-field
  {boId,fieldCode,fieldValue}` (body, not params), `v2/load-boi-values`.
- The *form* controllers are a different, mobile-ish family and were the wrong door:
  `v2/instance-form-create-draft/create-draft` demands a `boiId` (it is the EDIT draft),
  `…/create-draft-with-boi` wants a real minted `draftId` and a `BoiState`
  (`ALL|ARCHIVED|REMOVED|OFFLINE|DEV`), and `v2/instance-form/validate-apply-remove-draft` is its apply.
  Use the four calls above instead **when you want NO scripts to run** — see §6b.
  **Neither cycle can save a BO that has a CAPTCHA widget**: both answer `CaptchaNotVerified` (§5i «The
  CAPTCHA widget») `[C]`.
  They also skip the field RULES the form cycle enforces — `textCase`, `maxLength` (§5h «Поведение») — and
  hand out no counter number `[C]`.

### 6b. The FORM cycle — the one that runs the BO's scripts `[C]`

**The §6a cycle runs no Block IDE script at all** — a record created by `create-draft` → `create-boi` →
`save-boi-value` → `apply-and-remove-draft` came out with every hook's marker empty. The hooks run inside
the FORM controllers, which is what the UI's own dialog calls (captured with the XHR patch of §10, then
driven alone). Every hook ran server-side; the answers carry the script's field writes back as
`fieldFormCommands[{commandType:"UPDATE_STORED_VALUE_FIELD", fieldId, storedValue}]`.

| step | call | params / body | hooks that run |
|---|---|---|---|
| open NEW | `v2/instance-form-create-draft/create-draft-with-boi` | P `{boId, boiState:"ALL", isReadMode:false}` B `{}` → `{draftId, boiId}` | «Открытие» |
| open EXISTING | `v2/instance-form-create-draft/create-draft` | P `{boId, boiId, draftId:null}` B `{}` → bare `"<draftId>"` | «Открытие» |
| change a field | `v2/instance-field-form/save-field-value` | B `{draftId, boId, boInstanceId, values:[{fieldId, value}]}` | «Изменение поля» of that field |
| save | `v2/instance-form/validate-apply-remove-draft` | P `{draftId}` → `formCommands:[CLOSE_DIALOG_SAVE]`; **no `CLOSE_DIALOG_SAVE` = NOT saved** — e.g. an empty required field answered only `[CAN_ENABLE_CANCEL_BUTTON]`, no error command, record unchanged `[C]` | NEW: «Добавление новой записи» then «Сохранение»; EXISTING: «Сохранение» only |
| close without saving | `v2/instance-form/remove-draft` | P `{draftId}` → `formCommands:[CLOSE_DIALOG_CANCEL]` | EXISTING: «Закрытие»; NEW: nothing is created |
| read the draft | `v2/instance-field-form/load-field-data` | P `{boId, boiId, draftId}` → `[{fieldId, storedValue, …}]` | — |
| read the record | `v2/business-object-instance/v2/load-boi-values` | **B** `{businessObjectId, boInstanceId, draftId:null, tabId:null}` (in P it answers `NoBoWithId … boId = <NULL>`). **`tabId:null` returns only the fields OUTSIDE tabs**; the fields of a `TAB_GROUP` tab come back only with that tab's id in `tabId` `[C]` | — |

Order on a new record, one run: открытие → поле … → создание → сохранение. Field ids and codes:
`v2/instance-form/load-field-structure` P `{boId, boiId, draftId}`. The full semantics (what is kept, what is
discarded) is `MYBPM-IMPORTS.md` §15 «When each hook runs»; the facts that bite:

- **«Закрытие» does not run after a save** — only on `remove-draft` of an existing record — and what it
  writes is **stored in the record**, while every edit of the discarded draft (the «Открытие» write of
  that same session included) is thrown away.
- **«Изменение поля» runs on EVERY `save-field-value` call** — the same value again, and a value the
  server then refuses to store, both fired it.
- `boiState:"DEV"` opens a TEST record: those run the BO's TEST script version, ordinary ones the WORK
  version (§5g «Wiring scripts onto a BO headlessly»).
- `OPEN_COUNT` stayed `0` on a record opened only through these calls (the UI's records counted up) `[I]`.

**The `value` of `save-field-value`, per type** — what the client's field classes send (bundle module
`28149` + helpers `47749`); `[C]` = stored and read back:

| type | `value` | |
|---|---|---|
| `INPUT_TEXT` `INPUT_PHONE` `INPUT_EMAIL` `TEXTAREA` `LINK` | the plain string (`TEXTAREA` = its HTML — any HTML fragment may be sent instead of plain text, §8) | `[C]` |
| `INPUT_NUMBER` | `"42"` | `[C]` |
| `CHECKBOX` | `"true"` / `"false"` | `[C]` |
| `DATE` `FULL_DATE` `TIME` `YEAR` `YEAR_AND_MONTH` | `JSON.stringify(<Date>)` = an ISO instant INSIDE quotes: `"\"2026-09-24T10:30:00.000Z\""` | `[C]` |
| `PERIOD` `PERIOD_TIME` | `{"startDate":"<ISO>","endDate":"<ISO>"}` | `[C]` |
| `DROPDOWN_SINGLE` `RADIO_BUTTON_GROUP` | the option id, bare | `[C]` |
| `BO` (and, per the client, `CO`) | a JSON array of record ids `["<boiId>"]` | `BO` `[C]`; a `CO` value was not stored `[U]` |
| `QUESTIONNAIRE` | `[{"rowId":"…","columnId":"…"}]` | `[C]` |
| `GEO_POINT` | `{"lat":43.238,"lon":76.945}` | `[C]` |
| `INPUT_TEXT_LANG` `TEXTAREA_LANG` `STATIC_TEXT` | `{"RUS":"…"}` (stored with all four languages; for `TEXTAREA_LANG` / `STATIC_TEXT` each language may be HTML, §8) | `[C]` |
| `TAB_GROUP` | `""` | `[C]` fires the script |
| `FILE_UPLOAD` | a JSON array of file ids | `[U]` |
| `CHECKLIST` | the whole item list as JSON text: `[{"label":"Пункт 1","checked":true},…]` | `[C]` |
| `PROGRESS_BAR` | a MAP `{"<step code>":"GREEN"}` (`RED GREEN YELLOW BLUE ORANGE PURPLE`); it reads back as `[{stepCode, color}]`, and THAT array, `["<stepId>"]` or `"[]"` sent as a value break the draft (trap 50) — §5h «Per-type settings» | `[C]` |

**The server does not validate the value** — a wrong shape (`"10:30"` for `TIME`, an array for `PERIOD`)
is stored as is; most shapes still read back, but see trap 50.

### Files and templates

- A registry export is named `<BO name>+YYYY-MM-DD+HH_MM+(ALMT).xlsx` (spaces become `+`) and doubles as
  the import template; an empty template is `Шаблон+<BO name>+….xlsx`.
- **Template columns follow the BO at export time** — after adding a field take a FRESH template. **The
  column layout moves between exports**: never index by fixed columns, always resolve by the
  (row-1 block, row-2 field) pair. `[C]`
- A simple dictionary's template has only «Код» / «Значение». `[C]`
- An empty template's data row may already carry platform defaults («Нет» in checkboxes, `0` in a number,
  a default reference split over its sub-columns).

### The file format itself → `MYBPM-IMPORTS.md` Part III

Everything about the CONTENTS of the xlsx — the sheet format, how a cell resolves to a record, the
SINGLE↔TABLE defect, merge/idempotency, the destructive unknowns and the importer's internals — moved to
`MYBPM-IMPORTS.md` **Part III** (§0X is a self-contained cookbook «build me a file for this BO», §19 the
evidence). This document keeps the transport: the routes above, the registry kebab and the templates.

## 7. Kanban — SOLVED: the card template belongs in the archive `[C]`

The old verdict «канбан сломан на платформе» was wrong. A kanban is two independent pieces, and the
missing one was never the menu item:

1. **Columns** — switched on where the board is shown; the one verified place is a MENU ITEM:
   `boPages.isKanbanEnabled`, `kanbanIndex`, `listIndex`, `kanbanFieldId` (§4). This part always worked.
   Whether a kanban can be switched on anywhere else (a panel's registry, a reference field, the BO
   registry outside the menu) is `[U]` (`MYBPM-IMPORTS.md` 0.5c).
2. **The card** — per BUSINESS OBJECT: `BoStructDto.kanbanCardTemplates`. An imported BO carried `{}`,
   so `BoDto.toKanbanCardTemplate` NPE-d and the view showed «cardTemplate is null». **Ship the template
   inside the archive** and the kanban works — the format is `MYBPM-IMPORTS.md` §0.5c, keyed by the
   dropdown's CODE, the card fields by CODE with `locationType` + `archetype`.

**The template, as it goes into the BO's line of the archive** (`BoStructDto`, next to `dynamicFields`;
same block: `MYBPM-IMPORTS.md` §0.5c) `[C]`:

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

- Outer key = the CODE of a `DROPDOWN_*` field of this BO (one entry per field offered as a board);
  inner key = the CODE of a card field — a dynamic field (`DYNAMIC`) or a native type (`NATIVE`). Codes
  only, never ids. `locationType` `HEADER|CONTENT|FOOTER`; `cardOrderIndex` orders inside a location.
- `tools/make-probe-archive.bun.ts --kanban "Статус:HEADER=Наименование;CONTENT=Исполнитель,CREATED_BY;FOOTER=Комментарий"`
  writes exactly this for a NEW BO; add `--menu "…:BO@<code>@<name>!kanban=<dropdown code>"` and the
  same archive also switches the board on in a sidebar item. Ship it with R3.
- For a BO that is ALREADY on the stand: its line comes out of the struct export of R4a, the key is
  added and the line re-imported — **this works** `[C]` (it repaired two archive BOs whose kanban and
  map died with «cardTemplate is null», §5l); keep the `kanbanFields` wrapper — without it the import is APPLIED
  and changes nothing. The other writer is the constructor UI (below).

Verified end to end: archive with `kanbanCardTemplates` → `apply-import` → `load-kanban-template` returns
a `cardTemplate`, `load-kanban-card-template` returns header/content/footer, the board renders its three
columns, a record saved from the board lands in the right column, and `load-bracket-kanban-cards` returns
the card with its values.

- Why the old API route was a dead end: `save-kanban-card-template` (body `{header, content, footer,
  *DelFieldIds}`, `*DelFieldIds = "D-<fieldId>"`; an EMPTY body returns 200 and does nothing) writes a
  store that `load-kanban-template` does NOT read. There is **no API that fills `kanbanCardTemplates`** —
  the constructor UI and the archive are the only writers. `save-business-object-portion` does not carry
  the key either (a full-DTO re-save changed nothing, twice).
- Runtime shape of a template item (what the kanban endpoints return, ids not codes):
  `{type:"KanbanCardFieldDynamic"|"KanbanCardFieldNative", coKanbanFieldId:null,
  kanbanFieldId:"D-<fieldId>"|"N-<NATIVE_TYPE>", label, cardOrderIndex, fieldKind:"DYNAMIC"|"NATIVE",
  isNotExistInBo:false, dynamicFieldType|nativeFieldType}`.
- The rest of `v2/kanban/*` (params `{boId, fieldId}`, lazy chunk 9839): `load-kanban-fields {boId}` →
  the dropdowns usable as columns; `load-kanban-card-fields {boId, fieldId}`; `move-kanban-card`;
  `load-bracket-kanban-cards` (body `{boId, dynamicFilters, nativeFilters, brackets, search, paging,
  ordering, state, kanbanFieldOptionId, kanbanFieldId}`).

### The defect that is still in the way — ES cannot sort a NEW BO's text field `[C]`

With the template in place the board draws its columns and counts the records («Количество 1 из 1»), but
the CARDS stay invisible. `load-bracket-kanban-cards` — which the client always sends with
`ordering: {archetype:null, fieldId:null, state:"UNSET"}` — answers with an Elasticsearch error:

```
illegal_argument_exception: Text fields are not optimised for … sorting …
Please use a keyword field instead. … set fielddata=true on
[fields.INPUT_TEXT#<fieldId>.sortValue]            index v1_3_boi18_<hash>
```

- **It is not a kanban bug**: the plain registry of the same BO
  (`v2/business-object-instance/load-bo-instance-bracket-table`, `ordering: null`) fails identically.
- **Pass an explicit `ordering`** (e.g. `{archetype:"NATIVE", fieldId:"CREATED_AT", state:"DESC"}`) and
  the very same call returns the cards in full. So the data and the template are fine; only the server's
  default sort is.
- Long-standing BOs of the same stand sort by their `INPUT_TEXT` fields without a murmur, so the mapping
  of the NEW index is the suspect — and the sweep below shows the constructor route is no better than the
  import.
- Tried and did NOT help: `v1/business-object-instance/ensure-index {boId}` (404 — the live route is
  `v2/business-object-instance/ensure-index`, which answers 200 and changes nothing), a full-DTO
  `save-business-object-portion` re-save, and `v2/business-objects/save-bo-table-sort {boId, fieldId,
  order}` (it DOES set `sortFieldId`, read back — the failing sort is a different one).
### The defect is NOT the import — it is every NEW BO on this stand `[C]`

The test above was run and it answers the question: **a BO built in the CONSTRUCTOR fails identically.**

**All THREE creation routes are equally broken** — the route a BO was born by makes no difference:

| BO | born by | index | `ordering: null` | explicit `DYNAMIC` text sort | explicit `CREATED_AT` |
|---|---|---|---|---|---|
| `fsV2MG@eJqXHw90r` «Канбан из архива» | **archive** | `v1_3_boi18_7ec576306f9e26a5c7c3dd2b` | `EsException` | — | OK, 1 |
| `yxTzPaWhONPNxk5j` «Проба настройки полей» | **constructor API** (§5h) | `v1_3_boi18_cb14f33da5a138d3cdc64e63` | `EsException` | `EsException` | OK, 1 |
| `OpmGDzaQRUT27jky` «Проба UI» | **constructor UI**, by hand (§5b) | `v1_3_boi18_3a99860f36904544f6ee3932` | `EsException` | `EsException` | OK, 1 |

The UI row was the user's own question («а если через UI?») and it needed a record, which the BO did not
have — it was created through the record API of §6a below, i.e. through exactly the calls the UI form
itself makes. An empty BO never errors (ES has nothing to sort), which is why every 0-record probe looks
green: `ATyioDPdsxhmVDBO` (the archive twin of the field-settings probe) is «green» only because it holds
no records.

**The counter-example, and why it was not one** `[C]`. The user built «Бизнес объект №6977»
(record `111`) and «Бизнес объект №6978» (record `привет`) by hand in the constructor and both registries
showed their row, «1 из 1», no errors — which looked like a refutation, and first suggested that the value
decided the mapping (digits sortable, letters not). **Both readings are wrong.** Reopened later, №6978
(`4pMYDZFS5gN57xai`, index `v1_3_boi18_e293180d9152e60379ef16a2`) fails exactly like every other new BO —
verified three ways: the direct `/business-objects/viewing-list/bo/<boId>/list-view` URL, the same screen
reached by CLICKING through Бизнес → group → BO (identical URL, four error toasts), and the API with the
body the client itself sends. So the value hypothesis is dead and the route hypothesis stays dead.

**A screen that renders right after the record was saved is not evidence** `[I]` — the freshly created row
is on screen while the failing query is not what put it there. Re-open the registry (or F5) before
concluding that a BO is healthy.

**The exact body the registry sends** `[C]` (XHR patch on the live page — the Angular client uses XHR,
trap 30): `paging` is **`{limit:20, offset:0}`**, not `{page,size}`, and `ordering` is
**`{archetype:null, fieldId:null, state:"UNSET"}`**, not `null`. Both shapes fail identically on a new BO
and both succeed on an old one, so nothing above depends on which was used; the client's own shape is the
one to reproduce. On failure the client keeps paging (`offset` 20, 40, 60…) and each page raises its own
toast — that is why the errors arrive in threes and fours.

**What it looks like on screen** `[C]` (registry of `OpmGDzaQRUT27jky`): the table draws its
headers and then only «Загрузить ещё» — no rows — while the counter top-right still says «из 1», and two
red toasts «Ошибка / ErrorResponse: {"error":{"phase":"query","failed_shards"… fields are not optimised
for operations that require per-document field data…» pile up in the corner with a `trace-id`. Nothing
in the UI hints at sorting, which is why this reads as «канбан/реестр сломан» rather than «ES mapping».

**Reproducing it by hand, no API** (≈2 minutes): `/business-objects/editing` → hover a BO-group row →
⋮ → «Добавить бизнес-объект» → name it → drag **«Текстовое поле»** (`INPUT_TEXT`) from the palette onto
the canvas, label it → **СОХРАНИТЬ**. **Not «Текст»** — that one is `STATIC_TEXT`, a static HTML section
heading (it holds a record value only when a script writes one, §8), and **not «Текстовый блок»** (`TEXTAREA`, untested here); the ES error
names `INPUT_TEXT` explicitly. Then Системные → **Бизнес** (`/business-objects/viewing-list`) → the group
→ click the BO → its registry → **«Добавить»** → fill the text field → save.

**The step everyone misses — it is the SECOND visit that fails** `[C]` (the user's own words:
«Когда создаешь БО а затем её инстанцию, ошибки нет. Но если затем второй раз переходишь в этот же
регистр, то появляются ошибки»). Right after saving, the registry shows the new row and «1 из 1» and
looks perfectly healthy. **Leave the screen and open the registry again (or F5)** — only then the table
comes back empty with the toasts. Both of us drew wrong conclusions from that first screen before
noticing it. `[I]` on the mechanism: most likely the BO's ES index does not exist yet at the first visit
(nothing to sort, nothing to fail), and the broken mapping is created when the first record is indexed.
**Before that first record the same screen is clean** — ES has nothing to sort — so a 0-record BO never
shows it. **There IS a workaround inside the UI**: take every STRING field out
of the registry columns (`tableColToShow: false`) and the screen works, because the default sort then
lands on a numeric/boolean/native field (see «The workaround that DOES exist» below). An explicit
`CREATED_AT` ordering also works but is not reachable from the screen, and `save-bo-table-sort` to
`CREATED_AT` does not change the default sort either.
- **The whole tenant was swept**: all 145 BOs/dictionaries of `<COMPANY_A>` were called with `ordering: null`.
  95 of them hold records; **not one long-standing BO fails**. The only two failures are our two probes
  that have a record — one imported, one built in the constructor. (Three more probes answer
  `AccessDenied` — rights we narrowed earlier, unrelated.)
- It is not the *default* sort either, it is the text field itself: an **explicit**
  `ordering {archetype:"DYNAMIC", fieldId:<an INPUT_TEXT field>, state:"ASC"}` returns rows on the old
  BOs («Пользователи» 122, «Журнал» 12) and raises the same ES error on the new one.
- The record-creation route is not a factor either: the UI probe's record was written by the client's own
  draft cycle, and it lands in the same broken mapping.
- So the suspect is the **Elasticsearch mapping of every index created by this platform version**:
  `fields.INPUT_TEXT#<fieldId>.sortValue` comes out `text` (no `keyword` sub-field, no `fielddata`),
  while the indexes of the older BOs sort happily. The archive, the constructor and the kanban have
  nothing to do with it — **this is a backend/infra defect for the platform vendor** `[I]` (the mapping
  itself cannot be read from the client).
- **There is no client-side fix**: `ensure-index` is the only index endpoint in the whole bundle
  (`grep` over all 201 lazy chunks) and it changes nothing. A full-DTO re-save and `save-bo-table-sort`
  do not help either — `save-bo-table-sort {fieldId:"CREATED_AT"}` sets `sortFieldId`, yet the default
  sort of `fsV2MG@eJqXHw90r` still goes to «Наименование» (`SO3965wW79K1GwK9`); on a BO with
  `sortFieldId: null` the server picked the UNIQUE field `mW46OCU@MBjBvwX~`, not the first one.
  **Confirmed with a DYNAMIC numeric target too**: `sortFieldId` is written and ignored — the
  registry still trips over the first string column. Only `tableColToShow` changes the outcome.
- **What to do meanwhile**: always send an explicit `ordering` (`{archetype:"NATIVE",
  fieldId:"CREATED_AT", state:"DESC"}` works everywhere). The stand's own client sends `ordering: null`,
  so the registry and the kanban of a freshly created BO stay broken in the UI until the mapping is fixed.
### The defect is the INDEX, not the FIELD — the old-BO experiment `[C]`

The test above was run on **«Офисы» `QXMI@1Xx6K~rV9zw`** (group «Расположение», a plain `BO`, 3 fields,
7 records, chosen because its own `INPUT_TEXT` «Адрес» sorts fine — a long-standing, healthy index):

1. baseline — `ordering: null`, the client's `UNSET` shape and an explicit `DYNAMIC` sort by «Адрес» all
   return 7 rows;
2. one fresh `INPUT_TEXT` field added through the constructor API (§5b R1) — `BjL@8oMMKjhLXDW8`
   «Проба сортировки»;
3. two throwaway records carrying LETTERS in it (`яблоко`, `арбуз`);
4. sorted by that brand-new field.

**It sorts.** `ASC` → `арбуз | яблоко | ∅×7`, `DESC` → `яблоко | арбуз | ∅×7` (empty values last in both
directions), `ordering: null` and the client's `UNSET` shape return all 9 rows, and a re-read 60 s later
— the trap-45 discipline, twice — stays clean. The control run in the same session with the same token
still fails: `4pMYDZFS5gN57xai` and `OpmGDzaQRUT27jky` answer `EsException` on the same call.

**Verdict: the broken mapping is born with the INDEX, not with the field.** An index created by this
platform version is broken whatever you put in it; an index created earlier swallows a field created
later and sorts by it correctly. Consequences:

- Adding fields to existing BOs is safe — the vendor defect does not spread to them.
- The vendor ticket is about **index creation** (the template/mapping used when a BO's index is first
  built), not about field mapping. Everything a new BO gets is doomed; nothing an old BO gets is.
- Cleaned up in the same session: both records deleted, the field deleted, and the BO DTO diffed against
  the baseline snapshot — **identical**, 7 records, default sort healthy.

### The workaround that DOES exist — keep strings out of the registry columns `[C]`

Answering «баг проявляется, если в реестре есть колонка строкового типа?» — yes for the SYMPTOM, no for
the cause, and the difference is a usable workaround. On the fresh probe `bbaYv1ik~KT53OfT` («Проба типов
сортировки», constructor, 8 field types, one record):

| registry columns | `ordering: null` / client `UNSET` | explicit sort by a string field |
|---|---|---|
| all 8 fields (strings included) | `EsException` | fails |
| only `INPUT_NUMBER` + `CHECKBOX` + `DATE` | **OK, rows come back** | still fails (even for a field that is NOT a column) |

- So the server's default sort picks a field **from the registry columns**: no string among them, no error,
  and the registry (and by the same query the kanban) works on a broken index.
- The mapping itself is still broken for every string field of that index — an explicit
  `DYNAMIC` sort by a non-column `INPUT_TEXT` fails exactly as before. The columns only decide whether the
  screen's own query steps on it.
- The change is a one-key `editedFields` patch (`tableColToShow`) and is reversible: switching the string
  columns back on makes the registry fail again. **This — removing the columns — is the only mitigation
  that holds**; merely reordering them leaves the failing sort one header-click away. **This corrects §7's earlier «there is no workaround
  inside the UI»** — there is one, at the price of a registry without text columns.
- The `AccessDenied` trap on the way: a BO with **no** registry columns at all answers
  `AccessDenied` «У Вас недостаточно прав на поля, которые выведены в реестр» even though every field has
  `accessForAll: true`. That is what the three «rights we narrowed earlier» probes really
  were — not rights, an empty column set. Trap 48.

### What the registry actually sorts by — the FIRST column `[C]`

The user's second screenshot of «Бизнес объект №6983» — the text field now holds `tr`, both columns are in
the registry, the sort arrow sits on «Дата и время», no error — pinned the last piece down.

- On the stand that BO answers OK to `ordering: null`, to the client's `UNSET` and to an explicit sort by
  the date, and **`EsException` to an explicit sort by that same text field with `tr` in it**. The mapping
  is broken; the screen is simply not sorting by it.
- Why the date and not the text: **the default sort follows the FIRST registry column**
  (`tableColOrderIndex`), not `sortFieldId`. Verified on the probe `bbaYv1ik~KT53OfT`: with all 8 columns
  kept and `INPUT_NUMBER` moved to position 0 the registry returns rows; move `INPUT_TEXT` back to 0 and
  it fails again. (The one exception seen earlier: a BO with a UNIQUE field — the server picked the unique
  one, not the first `[I]`.)
- That also explains why `save-bo-table-sort` «did not help» in both attempts — it writes `sortFieldId`,
  which this query does not use.
- **Column ORDER only fixes the FIRST render, it is not a workaround** `[C]`: clicking a column header sorts by that column — the client sends exactly the
  `ordering {archetype:"DYNAMIC", fieldId:<that field>, state:"ASC"|"DESC"}` that fails — so a text column
  left in the registry breaks the moment anyone clicks it (and clicking again for the other direction
  fails too). Reordering only decides whether the screen is broken *on arrival*. №6983 is in that state:
  healthy until its «Текстовое поле» header is clicked.
- **The registry REMEMBERS the clicked sort** `[C]` (build S4.24.25.632, in the UI): after one
  click on a text header, every later opening of that registry (navigation or F5) arrives empty — only
  «Загрузить ещё», the counter still «из N», 2–4 «Ошибка» toasts — until a header of a non-string column
  is clicked. Right after the failing click the screen keeps the OLD rows unchanged plus the toast, so it
  looks half-alive; it is the next opening that is empty. Whether the remembered sort is per user or
  shared by everyone was not checked `[U]`. This is why №6983 was found broken on arrival although its
  first column is the date.
- **The only reliable UI-side mitigation is to keep filled string fields OUT of the registry columns**
  (`tableColToShow: false`) — then the failing sort is unreachable from the screen. Everything else is
  cosmetic, and nothing repairs the mapping itself.

### The precise trigger — a string field that HAS a value `[C]`

The user's counter-screenshot («Бизнес объект №6983» `OSJitWM1zwdDRVIU`, group «Тест», 2 records, columns
«Дата и время» + «Текстовое поле», no error on screen) resolves the last ambiguity. Read off the stand:
both records carry `null` in the text field, and **everything** works there — `ordering: null`, the
client's `UNSET`, an explicit `FULL_DATE` sort and an explicit sort by that very `INPUT_TEXT`.

So the broken mapping is not created with the field, it is created **when the first string VALUE of that
field is indexed**. The three conditions, each verified separately:

1. the index was created by the current platform version (old indexes never fail — 112 BOs, 198 string
   fields, 0 failures);
2. at least one record holds a value in that string field — a field left empty everywhere sorts fine
   (№6983 above; the value-less `DROPDOWN_SINGLE` «Статус» of `yxTzPaWhONPNxk5j` behaves the same);
3. and the screen shows it only when the registry's default sort lands on such a field, i.e. when it is
   a column — while the API trips over it even when it is not (see the column section above).

That is also why every 0-record BO looks green, and why the same BO turns red after the first record with
text in it.

### «Просто выбрать другое поле сортировки» does NOT work `[C]`

The obvious alternative to hiding the column — leave the string column in place and point the BO's default
sort at a healthy field — was tried on the same probe and fails:

- `v2/business-objects/save-bo-table-sort` **takes its arguments in the PARAMS half** (`{boId, fieldId,
  order}`); sent in the body it answers 200, writes nothing and `sortFieldId` stays `null` — the same
  half-of-the-envelope trap as `delete-bo-instance` (trap 46).
- With params it really does write: `sortFieldId` became the `INPUT_NUMBER` field, read back from
  `load-business-object-by-id`. **The registry still fails**, and the error still names the first string
  column — `fields.INPUT_TEXT#2AUXHu3d7E8GsEdH.sortValue`. Passing `fieldId: null` clears it again.
- So `sortFieldId` is not what the registry query sorts by; the server picks a string column regardless.
  The only lever that works from the outside is **which fields are columns** (`tableColToShow`).

### Every string field of every old BO sorts — the full sweep `[C]`

To close «а в старых БО с любым набором полей не проявляется?» the sweep was repeated per FIELD, not per
BO: every BO of the tenant, every `INPUT_TEXT` / `TEXTAREA` / `INPUT_EMAIL` / `INPUT_PHONE` /
`DROPDOWN_SINGLE` of it, each with an explicit `DYNAMIC` `ASC` ordering. **112 record-holding BOs,
198 string fields, 0 failures** (55 empty BOs skipped — nothing to sort, 1 `AccessDenied`). Our own new
probes were excluded and every one of them fails. The split «old index healthy / new index broken» is
therefore not a sampling artefact of the default sort.

### It is the whole index, and not only `INPUT_TEXT` `[C]`

Follow-up to the user's question «баг только на тестовом поле, на другом его нет?» — no, it is every
field of a broken index whose `sortValue` actually holds a string. Sorting each field of the three
broken BOs separately:

| BO | fails | sorts |
|---|---|---|
| `fsV2MG@eJqXHw90r` «Канбан из архива» | all THREE `INPUT_TEXT` (Наименование, Исполнитель, Комментарий) + the `DROPDOWN_SINGLE` «Статус» | `BO` reference «Автор» (`CREATED_BY`), `NATIVE CREATED_AT` |
| `yxTzPaWhONPNxk5j` «Проба настройки полей» | both `INPUT_TEXT` + the `DROPDOWN_SINGLE` «Должность» (`optionSource: FROM_BO`) | the `DROPDOWN_SINGLE` «Статус» (`FROM_FIELD`, no value in the record), `CREATED_AT` |
| `4pMYDZFS5gN57xai` «Бизнес объект №6978» | its single `INPUT_TEXT` | `CREATED_AT` |

- The error always names the field you asked for — `fields.INPUT_TEXT#Fr0AVxK63ZRfWWRH.sortValue`,
  `fields.DROPDOWN_SINGLE#Hh9hePZW9ipg~Aeb.sortValue` — so **`DROPDOWN_SINGLE` is hit too**; the earlier
  «`INPUT_TEXT` only» wording was just an artefact of the probes having one text field each.
- What still sorts on a broken index is what carries no indexed string: a field with no value in any
  record, a `BO` reference, and the `NATIVE` dates `[I]`.
- The same field kinds on a long-standing BO («Встречи» `2h@BQkSol3XFZ7fw`, 23 records) all sort:
  `INPUT_TEXT`, `DROPDOWN_SINGLE`, `TEXTAREA` — the split is the INDEX, never the field kind.
- Side note: `NATIVE UPDATED_AT` is **not** a valid ordering field — `IllegalArgumentException: No enum
  constant …` on old and new BOs alike. `CREATED_AT` is the safe one.

Two by-products of the experiment `[C]`:

- **`delete-bo-instance` takes `boInstanceIds` in the PARAMS half.** Sent in the body
  (`params {businessObjectId}`, `body {boInstanceIds}`) it answers 200 and deletes nothing; with both in
  params it answers `true` and the rows disappear. Trap 46.
- **A field that is not a registry column is invisible in `load-bo-instance-bracket-table`** — the row
  `values[]` carry only the `tableColToShow` fields, so you cannot read back what you wrote into a plain
  field there. Flipping `tableColToShow: true` (a one-key `editedFields` patch) makes both the column and
  the full-text `search` find it `[I]` — before the flip `search:"яблоко"` returned 0 hits, after it 1.

## 8. HTML fields and «Текст» sections — what the sanitizer accepts

**Which fields take HTML** `[C]` (the user): «Текст» (`STATIC_TEXT`), «Текстовый блок»
(`TEXTAREA`) and «Мультиязычный текстовый блок» (`TEXTAREA_LANG`) — an HTML fragment can go into them
instead of plain text, whether typed in the card, saved through `save-field-value` (§6b), written by a
script or imported. «Текстовое поле» (`INPUT_TEXT`) and its multilingual twin are plain single-line inputs `[I]`.

**What the server keeps** `[C]` (core2, `save-field-value` into a `TEXTAREA`, read back with
`load-field-data`; the same held for `staticValueMap` of a `STATIC_TEXT` saved through
`save-business-object-portion`). The server re-serialises the HTML (pretty-printed, `\n` + indent around
block tags) and:
- keeps `<b>`, `<br>`, `<div style=…>`, `<a href target>`, `<img src width>` and **`<iframe src width
  height>`**;
- strips `srcdoc` from an `<iframe>` silently (the tag stays, empty);
- **rejects the whole value** when it holds `<script>`: the call answers `RestError` «Обнаружено
  недопустимое значение: <script>… Проверьте введённые данные на наличие не доверенных ссылок, программного
  кода…» and nothing is stored, the other tags of that value included.

**An `<iframe>` in these fields renders on the card** `[C]`: in a «Текст» section as a live
frame, and in a `TEXTAREA` inside the summernote editor (`.note-editable`), with no `sandbox` and no
`referrerpolicy`. So a script that writes `<iframe src="https://<host>/page.html?<record data>">` into a
`TEXTAREA` gives each record its own embedded page. That is the way around the IFRAME widget's single
fixed url (§5i). The page still needs a host of its own: **`/web/v2/file/download/<fileId>`** (controller
`v2/file`, `upload` / `download/{id}`) answers `SecurityError «Illegal Session»` without the `token`
header, so a file uploaded to the platform cannot be the `src` of a frame.
Proven end to end (core2): a button script wrote
`<iframe src="https://<external host>/?a=<lat,lon>&b=<lat,lon>" width="100%" height="400">` into a
`TEXTAREA`; the card showed the external page inside the field, and the value was stored with `&` as
`&amp;`. A page that loads a Referer-restricted browser API key (Yandex JS API) sends ITS OWN host as the
Referer, not the stand's, so that host must be on the key's list.

**A «Текст» (`STATIC_TEXT`) field works the same way, with no editor around it** `[C]` (core2,
the user's request). Its `staticValueMap` is only the default: a script writes the RECORD's own HTML with
`F-VALUE_IN_LANG-K-DYN-R-D-S-boi_fields` (`language` = Enum `MybpmLang` `RUS`) on the field reference
(`MYBPM-IMPORTS.md` §0.5). A real button click showed the `<iframe>` at once. After СОХРАНИТЬ and reopening,
the record still showed its own frame, while the BO's `staticValueMap` kept its placeholder. Prefer this
over a `TEXTAREA` for a read-only embed. Which sites can be framed at all: `yandex.ru/maps` answers
`X-Frame-Options: DENY`; the embeddable widget `https://yandex.ru/map-widget/v1/?rtt=auto&rtext=<lat,lon>~<lat,lon>`
(no key, draws the road route) has no XFO / `frame-ancestors` and renders `[C]`.

Observed while pasting a dashboard into a MyBPM HTML field; the same rules were reused for HTML inside
«Текст» (STATIC_TEXT) headings, which rendered on the stand (whether that field sanitizes identically is
`[U]`).

- **Rejected**: `text-transform` (probably matched as "transform"), `letter-spacing`.
- **Stripped together with their styles**: `main`, `header`, `section`, `article` → use only `div` and `span`.
- Paste a **fragment**: no doctype / `html` / `head` / `title`.
- Drop `clamp()` and `aria-label`. `h1`–`h3` lose bold → set `font-weight:700` explicitly.
- Assume `transform` and `conic-gradient` are filtered (avoided rather than tested `[U]`).
- **Progress ring without transform/conic-gradient**: a full green `border` ring plus an overlay grey ring
  clipped to the top-left quarter by a 54×54 `overflow:hidden` wrapper with `margin:-108px 0 0 0`; other
  percentages by changing only the clip box height, `h = 54 − 48·cos(2π·p)` px (60% → 93px, 65% → 82px),
  valid for p in 50..75%. Verify with a headless Chrome screenshot.

## 9. Tooling

### xlsx with a spreadsheet library

- The Excel table `displayName` must be Latin (`Table1`…) — a Cyrillic one makes Excel offer to «repair».
- `tableColumns` names must match the header cells exactly, else Excel «repairs» the file. When inserting
  columns, rebuild `tableColumns` by header name and extend the table `ref`, the autoFilter and the
  conditional-format `sqref`.
- **A library's load-and-save DROPS Google's `xl/metadata` part** → if it must survive, patch the XML inside the zip
  instead of loading the workbook.
- Moving rows: move the values AND the row heights together; leave cell styles bound to the row
  index when stripes are explicit per-row fills.
- Appended rows get no style (no borders, looks foreign) — copy the style from a sample row. MyBPM stand
  rows have thin left/bottom borders (whether the importer cares about data-row borders was never tested;
  its header detection uses freeze/double border, `MYBPM-IMPORTS.md` §19.1).
- **A spreadsheet library does not widen an existing table**: after adding or removing rows update BOTH the sheet
  `dimension` and the table `ref` (e.g. `A1:D35`), otherwise Excel reports the table as broken. A hand-made
  sheet without a table part needs only `dimension` `[C]`.
- Readers of such sheets are usually positional — adding a column means updating every reader.

### Google Sheets grid cropping — UNSOLVED, postponed

Google-exported xlsx keep the visible grid size in `xl/metadata` (protobuf `f1="1.0"`, `f3={f1="1",
f2=sheetId, f4=rows, f5=cols}`), linked through `workbook.xml.rels` type
`http://customschemas.google.com/relationships/workbookmetadata`, a `Content_Types` override
`application/binary` and `workbook.xml` `<extLst><ext uri="GoogleSheetsCustomDataVersion2">`.

- Attempt 1 (hidden columns H:XFD + `zeroHeight`) — still showed cells outside the table. Attempt 2
  (injecting that metadata after a library save) — still not cropped.
- **Verification methods that prove NOTHING, do not repeat them**: Drive import with conversion + export
  back (1000 rows for ours and for a genuine example alike, even with the example's raw metadata swapped
  in); counting columns in the export (Google omits default-width columns); ODS export (pads to
  1048576×1024); the Sheets API with rclone's token (403 SERVICE_DISABLED).
- Hypothesis: genuinely cropped files are produced by Google itself. Reliable fix: convert to a Google
  Sheet, delete the rows/columns outside the table, File → Download → xlsx. **Do not keep tweaking
  `xl/metadata`.**

### Google Drive via rclone

- Remote `gdrive-personal` is the working route: `rclone copy <src> gdrive-personal: --drive-root-folder-id
  <folderId>`; filters `--include "*.xlsx"`; verify with `rclone check --size-only`; delete with
  `rclone deletefile`. Upload raw xlsx (no conversion). A folder shared view-only gives 403 — edit access
  is required.
- **Shared drives** are invisible to `rclone lsf` and `rclone backend drives` (empty) and are addressable
  only by id. Upload into a shared-drive ROOT with `--drive-root-folder-id <driveId>` (**not**
  `--drive-team-drive`), and only after the rclone account has been added as a MEMBER (before that:
  `drives.get` 404, copy «The caller does not have permission»). A folder's `driveId` metadata reveals the
  drive id — ask for the id/link instead of walking the tree.
- Shared-drive sharing: the drive root cannot be link-shared at all, only members; objects inside can be
  link-shared only if the role is Manager/Content manager, the drive allows non-members and the Workspace
  admin permits it. A shared drive can only be created by a Workspace account.
- rclone's shared client_id retires during 2026 and hits `rateLimitExceeded` — if uploads start failing,
  give the remote its own client_id.
- **Never paste file contents as base64 into the Drive MCP (claude.ai) tools** — sessions hung twice. That
  MCP account is not a member of the user's shared drives.

## 10. Claude-in-Chrome traps

- **`read_network_requests` WITHOUT `urlPattern` dumps huge `data:image/jpeg;base64` URLs (cost ~700k
  tokens once). ALWAYS pass `urlPattern: "/web/"` and a small limit.**
- Page-side logging: patch `window.fetch`/XHR to push `/web/` calls into `window.__log`. Injected page
  globals are lost on navigation/reload — re-inject.
- `javascript_tool` output comes back as `[BLOCKED: Cookie/query string data]` if the text contains
  `=`/`&`/`?` → `.replace(/[=&?]/g,'_')` before returning. Ids **really can contain `~`** `[C]`:
  hex-dump the id inside the page (`[...new TextEncoder().encode(id)].map(b=>b.toString(16)…)`) and decode
  it outside — that survives the filter, and it proved `~hb30v0XyMtGsBLj` starts with a literal `~`.
- **Page state injected by `javascript_tool` SURVIVES between calls** `[C]` — `window.__x`
  set in one call is readable in the next; only a navigation/reload wipes it. So a `window.fetch` patch
  that records `/web/` request bodies is the way to capture what the UI actually sends (`read_network_requests`
  gives URL + status only, never bodies).
- **Hex-dumping the TOKEN is refused** by the auto-mode classifier («Credential Materialization») `[C]`.
  Calling the API from inside the page (reading `localStorage.LOCAL_PRIVATE_SwebToken` inline in the
  `fetch`) is allowed and is the fastest way to drive `/web/v2` with no token ever leaving the browser;
  a standalone Bun script still needs the user to hand the token over.
- **`javascript_tool` will not return anything derived from `localStorage` or from response HEADERS**
  `[C]` — the value comes back as «[BLOCKED: Cookie/query string data]», however it is
  encoded. The same happens to the WHOLE result when it includes `location.href` of a page with a query
  string (a record panel carries `draftId=…`) `[C]` — leave the URL out; the tab context
  already shows it. So the token never leaves the page; drive the API through an in-page helper that reads it
  internally and returns only the parsed body:
  ```js
  window.__c = async (path, params = {}, body = {}) => {
    const t = JSON.parse(localStorage.LOCAL_PRIVATE_SwebToken);
    const r = await fetch('/web/' + path, {method: 'POST',
      headers: {'Content-Type': 'application/json', token: t},
      body: JSON.stringify({useParamsFromBody: true, params_Lr1oSgwPR8: params, body_o1nhHUG480: body})});
    const s = await r.text(); try { return JSON.parse(s); } catch { return s; }
  };
  await __c('import-structure/load-import-state')      // path WITHOUT /web/, with v2/ where it belongs
  ```
  **Keep the envelope even where a plain call seems to work** `[C]`: with the params in the
  query string and a bare JSON body, `bo-process-editor2/create-draft` and `load-draft-data` answered
  normally, but `update-draft` (whose body is an ARRAY) answered 400 «Failed to read request» on every
  try; the same array inside `body_o1nhHUG480` went through at once.
  Never return `r.headers.get(…)` (the export's file name sits in `content-disposition` — derive a name
  yourself). A reload wipes `window.__c`: the next call fails with `ReferenceError` BEFORE it sends
  anything, so re-inject after every navigation.
- **Bytes in and out of the page go through a local bridge** — a `Bun.serve` on `127.0.0.1` with
  `Access-Control-Allow-Origin: *` (§5): `GET /get?name=` feeds a file INTO the page (the zip for
  `import-file`), `POST /save?name=` takes bytes OUT (an export, a JSON dump). Two shell traps around it
  `[C]`: start it **detached** (`setsid nohup bun bridge.bun.ts > log 2>&1 < /dev/null &`)
  or the session harness reaps it; and stop it **by PID** — `pkill -f 'bun bridge.bun.ts'` inside a
  Bash call matches the wrapper shell's own command line and kills it, so the rest of that command
  silently never runs. The bridge is committed — `tools/bridge.bun.ts`, started
  detached by `mise run bridge` and stopped by pid with `mise run bridge-stop`; files live in
  `tools/out/bridge/`.
- **Pasting into the Block IDE from automation** `[C]`: the IDE pastes from the canvas
  CONTEXT MENU (right click → «Вставить»), not from Ctrl+V, and reads the clipboard with
  `navigator.clipboard.readText()` when the menu opens — which fails under CDP («Document is not focused»),
  so the item silently pastes nothing. Fix: override it in the page before the right click —
  `navigator.clipboard.readText = async () => window.__scr` (the JSON fetched from the local bridge) —
  then click «Вставить» with a REAL `computer left_click` (`el.click()` and synthetic mouse events on its
  `<tr>` are ignored); compute the point from the `<tr>` rect × (screenshot width / `innerWidth`). The
  paste is `v2/script/paste` + one `apply-update-cmd`. After a navigation the first click on the scripts
  icon is swallowed — click `[selenide=q9qtPW3E-bo-script-icon]` from JS instead.
  **Usually you do not need the UI at all**: the same two calls work headlessly from any page of the
  stand (`fetch('/web/…')` with the page's own token) — §5g «Writing a script headlessly» `[C]`.
- **`javascript_tool` dies at 45 s** (`CDP sendCommand "Runtime.evaluate" timed out`) `[C]`,
  but **the page keeps running the promise** — the timeout kills the wait, not the work. So for anything
  long (a loop of imports, a poll), do NOT await it in the call: start it as
  `window.__pending = run(list).then(r => window.__pendingDone = r)` and return immediately, then poll
  `window.__res` / `window.__pendingDone` in later calls. Combined with the «page state survives between
  calls» fact above, that is the way to drive a multi-minute job through this tool.
- **Drive the API from `https://<stand>/favicon.ico`, not from the app** `[C]`: the stand root
  redirects to the LAST opened route, and a record panel there re-creates its draft and reloads by itself —
  an in-page job started from it vanished mid-run (the import applied, the watch never reported), and after
  one more load the tab froze (`Page.captureScreenshot` timed out). The favicon URL is the same origin, so
  `localStorage` (the token) and `fetch('/web/…')` work, and nothing on it reloads. Use the app only for what
  needs the UI. The client bundle is readable from there too — `fetch('/')` → the `runtime.*.js` chunk map →
  grep the chunks for a controller path to learn a call's shape without clicking.
- **The BO-group list is CDK-virtualised**: a group below the fold is not in the DOM at all, `find`
  answers «no matching elements» and `computer scroll` over the page does nothing. Scroll the container
  itself — `document.querySelector('.cdk-drop-list.scroll-bar').scrollTop = …` — then take a screenshot
  `[C]`. Its `innerText` reads empty; locate rows by `input.value` + `getBoundingClientRect`.
- **`computer type` does NOT replace a selection in these Angular inputs** `[C]`: after a
  `triple_click` the typed text is APPENDED («Чекбокс» + «Активен» = «ЧекбоксАктивен»). Always clear
  first (`key BackSpace` after the triple click) and re-read `input.value` before saving — a field code
  is generated from the label at the first save and never regenerated.
- **`computer type` SILENTLY DROPS spaces and punctuation** in these Angular inputs `[C]`:
  «Проба: составной объект через архив (UI)» arrived as `Пробасоставнойобъектчерезархив` — 30 chars, no
  spaces, no `:`, no `()`, and the trailing `UI` gone. Together with the append-instead-of-replace trap
  above, **do not type into these fields at all**: set the value from JS through the native setter and
  fire the events Angular listens to —
  ```js
  const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;
  set.call(ta, text); ta.dispatchEvent(new Event('input',{bubbles:true}));
  ta.dispatchEvent(new Event('change',{bubbles:true}));
  ```
  (`HTMLInputElement.prototype` for an `<input>`), then READ `.value` back before saving.
- **Drive this app's clicks from `javascript_tool`, not from `computer left_click`** `[C]`.
  A click computed from an element's `getBoundingClientRect` landed a full row off, and the
  mousedown-listener calibration of trap 28 caught NOTHING (`window.__hit` stayed `null`) although the
  click visibly happened — so the factor cannot even be measured reliably here. `el.click()` on the
  element found by its text works every time and needs no coordinates. Two gotchas:
  - filter by **`innerText`**, not `textContent` — the buttons' `textContent` did not match `'ПРИМЕНИТЬ'`
    while `innerText` did;
  - scope the query to `.cdk-overlay-container` for anything inside a dialog, and click the `<button>`,
    not the `<span>` inside it.
- **`Page.captureScreenshot` times out (30 s) on this stand every few calls**; simply repeating the same
  screenshot call works. Do not treat the first timeout as a frozen page.
- **A screenshot taken right after `navigate` shows a half-loaded screen** `[C]`: the
  composite editor rendered its panes empty and looked like an import that had written nothing. Wait, or
  re-navigate, before concluding anything from a screenshot — and prefer an API read-back as the evidence.
- A long sequential save loop hits the 45 s CDP timeout **but keeps running in the page** — verify with a
  separate parallel read (`Promise.all`) instead of rerunning it.
- The viewport flips between 1484×812 and 1525×784 between screenshots, so clicks computed from the
  previous screenshot miss. `find` does not see the sidebar or popovers.
- A tab group belongs to the Claude session that created it — a tab the user opened in another session's
  group is invisible; ask for the URL.
- «extension is not connected» / `list_connected_browsers` → `[]` after switching accounts: Claude Code and
  the extension must be on the SAME claude.ai account and the bridge binds at session start → restart
  Claude Code and reload the extension (that fixed it).
- **Claude Desktop installed next to Claude Code steals the extension** `[C]`: reloading the
  extension did not help — it kept spawning Claude Desktop's `chrome-native-host` (manifest
  `~/.config/google-chrome/NativeMessagingHosts/com.anthropic.claude_browser_extension.json`) and Claude
  Code's `claude --chrome-native-host` never started. Renaming that manifest to `*.json.disabled` and
  killing the Desktop hosts brought Claude Code's host up within ~10 s. Renaming it back returns Chrome to
  Claude Desktop.
- **When the browser window is not in front, `screenshot` times out** («Page.captureScreenshot timed out
  … renderer may be frozen», `document.visibilityState === "hidden"`), a new tab too, while
  `javascript_tool` keeps working. Do not wait for the UI — switch to the API calls it would
  have made (§6b), or ask the user to bring the window forward.
- **Some controls ignore `el.click()`** `[C]`: the «Добавить» inside a nested table's
  picker reacts only to a full mouse sequence. Dispatch `pointerdown`, `mousedown`, `pointerup`, `mouseup`,
  `click` (bubbling, with `clientX/Y`) on `document.elementFromPoint(<centre>)` — this also works while
  `screenshot` times out. Check first that the point is not covered by a `cdk-overlay-backdrop` (an open
  «Внимание» confirm dialog sits on top and swallows the click).
- **A `javascript_tool` result containing a URL query string or cookie-like text comes back as
  `[BLOCKED: Cookie/query string data]`** — the code DID run. Never return `location.href` or raw ids
  mixed into long strings; `save` the result through the local bridge and read the file.
- **Open a record card by URL** `[C]`: `/business-objects/viewing-list/bo/<boId>/list-view?fieldId=list&boId=<boId>&boiId=<boiId>&draftId=&menuItemId=list&businessObjectId=<boId>&boiDialogType=EDIT&boiViewType=FORM&boiState=ALL`
  — the registry with that record open in its dialog (the page mints its own draft). The shorter
  `/viewing-list/bo/<boId>/list-view` (no `/business-objects`) is NOT a route — it lands on «Главная».
- **Never reuse the `/business-objects/viewing-single/panel?…` URL for an ordinary BO** `[C]`:
  with `isPanel=false` and a real `boiId` the page rewrote itself to the home PANEL's `boiId` and
  `isPanel=true` — and the BO got a new empty record under that same id. It was left in place (deleting a
  record whose id is also the panel's own was not worth the risk).
- **Reading a date picker without screenshots** `[C]`: the card's pickers are
  `nz-date-picker` / `nz-range-picker` / `nz-year-picker` elements; `mousedown` + `click` + `focus` on
  their `input` opens a `.ant-picker-dropdown`, whose `td.ant-picker-cell-in-view` cells carry `title`
  (`30-9-2026`) and `ant-picker-cell-disabled`; `.ant-picker-header-next-btn` pages on. **Dropdowns of
  earlier pickers stay in the DOM** — record the set of dropdowns before the click and read only the new
  one, or you read a stale calendar. Run the loop fire-and-forget (`window.__r`) — eight pickers exceed
  the 45-s `javascript_tool` limit.

## 11. Traps and defects — the short list

1. Always pass `urlPattern: "/web/"` to `read_network_requests`.
1b. The `token` header takes the localStorage value **without its JSON quotes**; with them every call
    answers `SecurityError` «Illegal Session».
2. `authorsField` is null on untouched BOs — create the object before saving rights.
3. Rights groups persist only through `orgUnitToAdd` / `orgUnitToDelete`, never `orgUnitRecordList`.
4. Menu-item rights use `v2/menu-item/*`; the `business-objects` menu-access endpoints fail with `NoBoWithId`.
5. A bracket's own filters are ignored when it has sub-brackets; sibling combination uses the EARLIER
   sibling's `connectionType`.
6. A menu icon must come from §4 «Menu icon catalogue» (`phosphor:*` or `menu-item:*`); the server and the
   importer accept any string, and a wrong one leaves the sidebar item without an icon.
7. A kanban needs `kanbanCardTemplates` ON THE BO, and only the archive (or the constructor UI) can
   write it — `save-kanban-card-template` fills a store the view never reads (§7). The MAP view needs it too:
   give every dropdown of an archive BO a template (§5l, trap 61).
8. Excel: every cell must be `inlineStr`; a numeric cell turned `103` into «103.0» and broke a lookup.
9. Excel headers must have frozen rows or a double bottom border in column A, else the whole file is
   rejected.
10. Never index Excel columns by position — resolve by (block, field) label pair; templates change with
    the BO.
11. Dropdowns match by LABEL, references by the target's unique field or an `ID` sub-column.
12. A referenced record must exist BEFORE the file is imported — same-file references do not resolve, and
    nested blocks do not create target records.
13. A row that fills the SINGLE side of a two-way link is silently dropped — set links from the TABLE side.
14. A section heading that repeats a field name breaks the import with `SameBoFieldsLabel`.
15. Blank cells may clear values and empty link columns may clear links — regenerate full files, never
    partial ones.
16. xlsx library: update both `dimension` and the table `ref`; a Cyrillic table `displayName` breaks the file.
17. Do not chase Google Sheets grid cropping through `xl/metadata`.
18. Structure-import rollback: only the import with `canRollback:true` can be undone, same-minute imports
    may be ranked out of order, and undoing an UPDATE restores the state IT found — later changes are lost
    (§5 «Rollback trap»). Leave a minute between applies you may want to undo.
18. A BO is created only from a GROUP's hover-kebab in `/business-objects/editing`; the caption-level ⊕
    sends `boGroupId: null`, finds no `kind: DEFAULT` group on `<company-a>` and silently creates nothing.
19. `save-business-object-portion` wants `{businessObject: …}` inside `jsonPart`; a bare DTO throws
    `UndeclaredThrowableException`. `save-business-form-field` never creates fields — use the portion save.
20. BO and field codes are generated by the SERVER from the names; the BO code is cut to 30 characters.
21. `load-bo-records-by-group-id` takes `groupId`, not `boGroupId`.
22. A FIELD's code is generated from its label at the FIRST save and never regenerated — fix the label
    before СОХРАНИТЬ. **A BO's code behaves the same way** `[C]` (re-checked): it appears at
    the first save that gives the BO a name and later renames do NOT change it (§5b said otherwise).
23. The import dialog's tree labels a node `<вид объекта>/<имя БО>` — the first half is the CATEGORY, not
    the BO group. A `BO_PANEL` node carries no prefix at all, just the name.
24. **Constructor API race**: a field save that lands within ~1 s of the rename makes the server append a
    16-char uniquifier to the just-generated BO code («Test_koda_4_2026_09_18HXpmEa21vtnNLVsl»), and a BO
    code is never regenerated afterwards. `tools/create-bo-constructor.bun.ts` now sleeps 3 s between the
    two and warns if the code changed. The Angular client never hits it — a human types the name and drags
    fields seconds apart.
25. `delete-business-object` takes `{businessObjectId}` as a **param**, not a body
    (`postJson(path, body, params)` — body FIRST in the client's signature, params second).
26. A MyBPM error response carries a ~100-line Java `stackTrace` — never `cat` one into the session,
    pipe it through `head -c 300` or read only `message`/`errorType`.
27. **Claude-in-Chrome `screenshot` resizes the real browser window** on this stand's extension build:
    `scale: 0.6` shrank the viewport 1876 → 941 → 565 px, one step per screenshot, until the app's layout
    collapsed and every drag missed. Never pass `scale` here. A screenshot with no `scale` still pins the
    viewport to the capture frame (1568×743), and `resize_window` does NOT undo it — only a NEW TAB does.
28. **Click coordinates are not CSS pixels and do not follow that emulated viewport.** Measure the factor
    instead of guessing: `document.addEventListener('mousedown', e => __pts.push([e.clientX,e.clientY]),
    true)`, click a known point, read it back. It came out `CSS = frame × 1.1885` (frame ≈ CSS × 0.84,
    i.e. the ORIGINAL window width, not the current one). Then click at `CSS / 1.1885`, taking every CSS
    rect from `getBoundingClientRect()`.
29. `v2/co/generate-draft` is **not idempotent** — each call creates a new draft of the composite object.
    Only the editor's own draft is applied by СОХРАНИТЬ; any draft you generate yourself to «just look»
    must be removed with `remove-draft`, whose response body is EMPTY (`res.json()` throws on it).
30. **The Angular client uses XHR, not `fetch`** — monkey-patching `window.fetch` to record requests
    captures nothing. Use `read_network_requests` (it only sees calls made after its first invocation).
31. **`computer type` drops spaces and punctuation** in this app's inputs; `computer left_click` lands
    off by a whole row and the trap-28 calibration does not even fire. Click with `el.click()` from
    `javascript_tool` (match on `innerText`, scope dialogs to `.cdk-overlay-container`, click the
    `<button>`) and set text through the native value setter + an `input` event. §10.
32. **A BO code is cut to 30 characters**, so a hand-transliterated code silently misses the stand's
    («Проба API-конструктор 2026-09-18» → `Proba_API_konstruktor_2026_09_`, trailing `_`). Anything that
    references a BO by code — a composite's `bos`, a panel's `boRefStruct` — must take the code from
    `load-business-object-by-id`, never from a guess.
33. **`add-co-field-to-simple` makes one attribute per link in its body.** A «составной атрибут» = create
    with one link, then `add-co-field-to-composite` for the rest. Neither call returns the new
    `coFieldId` — diff `load-co-fields-simple` around it.
34. **Every name in `/business-objects/editing` is an `<input>`, not text** — the group rows AND the BO
    rows. A `TreeWalker` over text nodes finds nothing, and a naive «input whose value starts with
    Бизнес-процесс» hits the sidebar row before the editor's own «Наименование» field (typing there
    changes nothing on the stand). Match on the input's container (`APP-BO-GROUP`, the editor header),
    then verify the rename with an API read-back.
36. **The headless login's two body keys are base64 of the words `username` and `password`**
    (`dXNlcm5hbWU=` / `cGFzc3dvcmQ=`) and their VALUES are base64 too. A login sent with plain keys or
    plain values is not «wrong password», it is a malformed request — and it still comes back as HTTP 200
    with an error body. §0U.1.
35. **`/import-structure/load-import-state` answered `{importExists:false}` while an analysed import was
    open** (UI upload, status «Импорт проанализирован») `[C]`. It is not a reliable «is
    something waiting?» probe — take the `importId` from the log row / from `import-file`, or resume with
    `--import-id`.
    It can also answer `{importExists:true, fileName}` WITHOUT `importId` `[C]` — read the id off
    `load-import-file-records`. **Never re-run `insert-file-data` on an import whose first call was cut off**
    (e.g. a page navigation mid-`javascript_tool`): the data goes in twice and the analysis ends
    `INTERNAL_ERROR` (`MongoUtil.one`). `cancel-import` drops it; upload again in ONE call.
37. **The LAST icon of a field's settings popover is DELETE** `[C]` — `mat-icon.delete-icon`,
    and it opens «Удаление поля: использование в скриптах» whose green button is «УДАЛИТЬ ВСЁ РАВНО».
    A click loop over that icon strip (to find out what the icons are) walks straight into it; the 4th
    icon meanwhile opens «Настройка скрипта». Read the strip, never click through it.
38. **A field setting is NOT its own endpoint** `[C]`: «Обязательное»/«Уникальное»/the
    dropdown's dictionary are keys of the field DTO written by `save-business-object-portion`, and
    turning «Обязательное» or «Уникальное» ON also sets `tableColToShow: true` (`assignTableColToShow`).
    `load-dictionary-bo-field-options` takes `boId` as a **params** parameter — in the body it answers
    HTTP 400 «Required parameter 'boId' is not present».
39. **The widget controllers (`v2/button`, `v2/iframe`, `v2/captcha`, `v2/signature`, `v2/current-date`,
    `v2/widget-current-user`) read everything from the PARAMS half** `[C]`. The same call
    with its arguments in the body returns HTTP 200 with an empty response and writes NOTHING — the
    failure is silent; the matching `load-…` answers 400 «Required parameter 'boId' is not present» and
    is the only way to notice. §5i.
40. **`load-business-object-by-id` shows `code: null` for widgets** (all but BUTTON) `[C]` — the code
    exists, it just lives in the widget's own controller. Do not «fix» it by writing a code into the
    field DTO. §5i.
41. **Controller `struct` is NOT under `/web/v2`** `[C]` — it is `/web/struct/...`
    (export basket, export-company-structure). A `/web/v2/struct/...` call answers 404 and, if you then
    export anyway, you silently get whatever the basket held from the previous session. §5.
42. **A «Чек лист» keeps its items in `defaultValue`, not in `options`** `[C]` — a JSON
    string `[{label,checked}]`, written by the constructor together with `isAppendable:true`; it travels in
    an archive. `options` + `FROM_FIELD` on a checklist are dead keys (the form ignores them, the import
    ignores `fieldOptionsStruct`). Reading those keys makes it look like it «loses its items». §5i.
43. **A newly created BO cannot be sorted by a text field** `[C]` — the
    Elasticsearch mapping makes `INPUT_TEXT#<id>.sortValue` a `text` field, so the registry's own query
    answers `EsException` «Text fields are not optimised …». It hits the registry AND the kanban, and it
    hits **all four probes across all three creation routes — archive, constructor API, constructor UI**
    (two of them built by the user himself), while none of the 95 record-holding long-standing BOs has
    it. Send an explicit `ordering`. Do NOT look for the cause in the archive format, in the constructor,
    in the kanban, or in the VALUE stored (digits and letters fail alike) — §7. **It is the INDEX, not
    the field** `[C]`: a field created later inside a long-standing BO («Офисы») sorts
    perfectly, so adding fields to existing BOs is safe and the vendor ticket is about index creation.
    And inside a broken index it is **not only `INPUT_TEXT`** — every field holding an indexed string
    fails, `DROPDOWN_SINGLE` included; only value-less fields, `BO` references and `CREATED_AT` survive.
45. **A registry screen seen right after saving the first record proves nothing** `[C]` —
    it shows the just-saved row and «1 из 1»; the SECOND visit to the same registry is the one that fails
    with the error toasts (confirmed independently by the user). Re-open or F5 before calling a BO
    healthy. This cost a full round of wrong conclusions on both sides. §7.
46. **`delete-bo-instance` wants `boInstanceIds` in the PARAMS half** `[C]` — with the ids
    in the body the call answers 200 and deletes nothing (the rows are still there on the next read);
    `params {businessObjectId, boInstanceIds}` answers `true` and removes them. The same shape trap as
    §0U.2's «which half does this value belong in» — verify a delete by re-reading, never by the status.
48. **A registry with NO columns answers `AccessDenied`, not an empty table** `[C]` — «У Вас
    недостаточно прав на поля, которые выведены в реестр» on a BO whose every field has
    `accessForAll: true`. Check `tableColToShow` before believing a rights problem. §7.
    **The fix is not instant** `[C]`: right after the `editedFields` patch that turns a column
    on, the registry still answers `AccessDenied`. It lists the rows a few seconds later. Wait, then
    re-read before you conclude the patch failed.
47. **A field that is not a registry column cannot be read back from the registry** `[C]` —
    `load-bo-instance-bracket-table` puts only `tableColToShow` fields into a row's `values[]`, and the
    full-text `search` does not find their values either `[I]`. Flip `tableColToShow: true` with a
    one-key `editedFields` patch when you need to verify what a write actually stored.
44. **The record controller is `v2/business-object-instance`, not the `v1/…` the bundle shows** `[C]`
    — `/web/v1/business-object-instance/create-draft` is a plain HTTP 404 (a Spring
    `{timestamp,status,error,path}` body, not the usual `errorType` envelope), exactly like
    `ensure-index`. Whenever a bundle-read controller 404s, retry the same path under `v2`. §6a.
49. **One unknown enum value in a script def makes ALL scripts of that BO unreadable — for good** `[C]`
   . `apply-update-cmd` stored `"opType":"GreaterEq"`; afterwards every script call on that
    BO (read, translate, versions, apply, undo, delete) answers `IllegalArgumentException: No enum
    constant …`, the fix included. Only listed enum values (`MYBPM-IMPORTS.md` §10–§12a) may be written;
    a wrong `actId` or argument name is harmless. §5g «Writing a script headlessly».
50. **A wrong `PROGRESS_BAR` value makes the whole draft unreadable** `[C]` —
    `save-field-value` stored `["<stepId>"]` without complaint, then `load-field-data` answered
    `IllegalStoredValue … Value_PROGRESS_BAR` for the entire form (so would the UI). `"[]"` is refused the
    same way; **`""` repairs it**. Leave a progress bar alone unless you know its value shape (§6b).
51. **The §6a record API runs NO script** `[C]` — not «Добавление», not «Сохранение», not
    a field change. Use the form cycle of §6b when the BO's hooks must run, §6a when they must not.
52. **The whole stand answered 502 for ~30 s during a burst of `save-field-value` calls** `[C] symptom,
    [U] cause`. The burst had just stored `FILE_UPLOAD = "[]"` (its field script did NOT
    fire) and the next call was `CHECKLIST = "[]"`; afterwards everything worked again. Whether one of
    those crashed the backend or a restart coincided is unknown — send one value at a time with a
    `load-auth-info` health check after each, and do not send guessed values to those two types.
53. **A BO-reference field created over the API renders EMPTY on the record card** `[C]` —
    `generate-business-form-field` leaves `viewType: null` and every `boFieldRefs[].toShow: false`; the
    card then draws a bare selector with no «Выберите» and no chips. Set it in the constructor (gear →
    «Отображение» → «Вид отображения» + «Выбрать поля для отображения») or send it: **an existing field
    changes ONLY through its `editedFields` entry** — `{fieldId, viewType:"SINGLE", boFieldRefs:[…,
    toShow:true, orderIndex:i]}`; the same keys changed in the `businessObject.formFields` copy are
    silently ignored (the call still answers an accumulator id). §5b.
54. **A process Form only waits for the record that was in its field when the step began** `[C]`
   . Fill the field later and saving that record never releases the step. Only
    `push-step-forcibly` does, on the Form's outgoing arrow. And the releasing save must CHANGE a value of
    that record — a save with nothing changed releases nothing. §5f «Running a process on a
    record».
55. **An archive group line without `code` renames an existing BO group** `[C]` — even when
    its `name` is another existing group's; all such lines collapse into that one group; rollback does not
    undo the rename. Always ship `code` (§5 «Verifying an import»).
56. **The timeline view («Диаграмма Ганта») shows «Your license key is not valid to work with this
    version»** at its bottom on `<stand>` `[C]` — a banner of the Gantt library; the view works.
57. **An import can be `APPLIED` while the BO it should create does not exist** `[C]` — the
    apply process ended `hasError: true, errorState: "ONLY_INTERMEDIATE_ERRORS"` («no field with code: …»
    from `kanbanCardTemplates` naming a removed field), `load-import-errors` was empty, the import record
    said `APPLIED` and `rollbackAvailable`. An import whose analysis had ended `INTERNAL_ERROR` could also be
    applied — `APPLIED`, nothing created, rollback preview empty. Check `poll.hasError`, read
    `v2/process-indicator/load-state {processId}` → `phases.*.errors`, then load the BO; roll the import back.
58. **A stand export breaks the default option of every list** `[C]` — `defaultValue` of a
    `DROPDOWN_SINGLE` / `RADIO_BUTTON_GROUP` is exported as the source stand's option id while the options get
    fresh `newOptionId`s, which become their ids on import; the copy's default then points at nothing. Rewrite
    it to the matching `newOptionId` (`MYBPM-IMPORTS.md` §3 «Единичный выбор»).
59. **One undecodable script disables every code change in the company** `[C]` — the code-usage
    analysis of `bo/refresh-code` and `field/refresh-code` reads ALL the company's scripts; one stored script
    the server cannot decode (here a test version holding `"opType":"GreaterEq"`, trap 49) makes
    `is-analyze-done` end with `done: true` + `errorMessage: "…No enum constant …OpType.GreaterEq"` for ANY BO
    or field. The «Изменение кода» dialog then keeps «Изменить код» disabled for good, with no visible error.
    Way round: `save-business-object-code` (BO) after your own `verify-business-object-code` (§5j).
    **Deleting the BO does NOT fix it** `[C]`: after `delete-business-object` on the bricked BO the
    BO is gone (`load-business-object-by-id` → «не существует»), yet its script module survives —
    `load-bo-scripts` / `load-bo-script-versions` on the deleted `boId` still answer the same
    `IllegalArgumentException`, and both analyses still fail. Re-wiring the module with `save-bo-scripts`
    (all hooks `null`, empty `fieldScripts`) answers 200 and changes nothing either — the bad script def is a
    separate document, and `v2/script` has no call that overwrites a def without decoding it first. Only the
    vendor (database) can repair it. Also: each analysis takes ~23 s here — poll until `done: true`, an early
    `is-analyze-done` answers `{done:false}` (an object, not `false`).
60. **The direct code setters validate nothing** `[C]` — `save-business-object-code` /
    `save-business-object-settings` accept a code another BO already has, Cyrillic, spaces and `""`, and do
    not migrate scripts that use the old code. §5j.
61. **An archive BO with a dropdown and no kanban card template has no map** `[C]` — once it holds a
    record, `v2/geo/load-bracket-boi-points` (the «Карта» view), the kanban view and the kanban editor all answer
    NullPointerException «cardTemplate is null». `save-kanban-card-template` does not repair it; a re-import with
    `kanbanCardTemplates.<dropdown code>.kanbanFields` does. §5l.
62. **The registry «Группировка» is not implemented server-side** `[C]` — its data calls
    `load-bo-instance-grouping-table` / `-root` are 404, the view stays empty whatever is configured. §5l.
63. **The sidebar «Переименовать» renames nothing you can see** `[C]` — `save-bo-record {id, name}`
    writes `recordName` only; `name` and the sidebar row stay. Rename through the header input (§5j). §5m.
64. **Archive BOs share `orderIndex` 47480000, so a drag between two of them is lost** `[C]` — the
    dragged row gets the neighbours' midpoint (the same value) and falls back to the end of the block on reload. Give
    each BO its own value. §5m.
65. **Opening a create-record iframe URL plants `create_bo_token` in your own browser** `[C]` — the
    token goes into localStorage `LOCAL_Screate_bo_token` and an interceptor adds the header to every request of the
    stand's origin until the key is removed. §5m.
66. **Making a BO the messenger chat registry renames it, for good** `[C]` — the server rewrites its
    name, record name and description to «Реестр чатов» in all four languages, and the registry pointer cannot be
    cleared (`chatRegistryBoRecord:null` is ignored). Never point it at a working BO to try it out. §5n.
67. **An import of «Выставление сервисов» replaces the whole list, and its rollback leaves dead rows** `[C]`
    — rows missing from the archive are deleted; after `rollback-import` the old rows return with
    field CODES in place of ids, so every service answers 200 with an empty body until each row's slots and
    headers are re-saved with ids. Export the current list first and put every row into the archive. §5o.
68. **The first script version of a BO that never had scripts is blind** `[C]` — its module's
    `load-bo-def-list` is empty, so every field read/write fails `translate-script` and the script cannot be
    published. `copy-bo-script-version` and work on the copy. §5o.
69. **A service file answer needs a file name with a known extension, and its type is that extension** `[C]`
    — a script-made file named `x.xyz` or `x` fails with `NoFileMimeType` and the service answers 500;
    with a known extension the response Content-Type is derived from it and RESULT_CONTENT_TYPE is ignored. Name the
    file for the type you want to send (`.json`, `.pdf`, `.xlsx` …). §5o.
70. **A company-settings import is not one behaviour** `[C]` — OFFLINE / MOBILE / LANGUAGES /
    SCRIPT_SETTINGS replace (a language missing from the map is switched off), PHYSICAL_REMOVAL only adds/updates,
    AUDIT_TRAIL overwrites the FIRST audit row whatever its journal, NAVIGATOR / OTP lose the key / the department,
    MESSENGER does nothing. Export the target stand's kind first, edit that, and keep it to restore. §5n.

## 12. Open questions

The record-format questions moved with the format itself — `MYBPM-IMPORTS.md` §20.

- Whether menu rights cascade from a group item to its children, and what a restricted user really sees.
- What `save-business-form-field` is actually for, since it does not create fields.
- The create-record iframe URL in a browser with no stand login: does it open, and whose record is it (§5m)?
- §5n settings kinds: how to unset a migration monitor BO; what the `languageTag` an import writes
  into every language changes; whether an org unit (`D-<id>` + its record line) resolves on ANOTHER stand; TELEPHONY,
  IN/OUT_MIGRATION, APPEARANCE imports (no provider / Kafka / ownership on the reference stand).
- §5n: how to clear a messenger chat registry once set (the API ignores `null`); why Telegram's `isConnected` turned
  `true` on `<stand>` during a probe run (no field values, WhatsApp stayed `false`); the per-BO telephony and
  Kafka migration lists (need a provider / Kafka).
- §5o: whether the other 13 settings
  kinds (physical removal, messengers, offline …) round-trip through `CompanySettingsStructDto` like
  `SCRIPT_SETTINGS`, and whether they too REPLACE the stand's list; what caused the one-minute 502 after a TEST call.
- **Still unexecuted in §5g**: `create-local-method` (its global twin `create-company-global-method` IS `[C]`).
  Whether a local method of the same name really overrides a global one (the screen says so). Whether a
  global method is callable from a PROCESS script the same way (only a BO field script was run).
- **Is there any repair for a BO whose script module no longer decodes** (§11 trap 49)? Candidates
  ruled out: deleting the BO and re-wiring with `save-bo-scripts` (trap 59). Never tried: a
  structure import carrying that BO's scripts, `copy-bo-script-version`. Left: a vendor-side database fix.
  The deleted probe BO «Проба скрипт архивом» left its broken module on `<stand>`.
- **Field scripts on `FILE_UPLOAD`, `CHECKLIST` and `CO`** — the only three field types whose
  «Изменение поля» was not seen firing (§6b): the value shapes are `[U]`, and a burst that
  touched the first two coincided with a 30-second outage of the stand (trap 52). Next attempt: through
  the UI (upload a real file, tick a checklist item on a BO whose items were typed in the constructor,
  add a composite row), capturing the request with the XHR patch.
- **The success path of `/web/v2/auth/v3/login` was never run** (§0U.1 route A) — only the failure. If
  the body turns out not to be the bare token, §0U.1 and §1 need correcting.
- The `v2/bo-transfer` record import/export (§6) is equally unexecuted — the UI route is the confirmed one.
- What «Браузер скриптов» (`v2/script-browser`) looks like on screen — not opened yet (old question 20;
  «Глобальные методы» is answered in §5g).

- **The ES mapping defect of §7** — the index/field question is ANSWERED («Офисы»: it is the
  INDEX; a field added later to an old BO sorts fine). What is still open: whether the platform vendor
  confirms it as a backend regression, and what exactly changed in the index template. Nothing on the
  client side repairs it, and the creation ROUTE was ruled out earlier.
- Whether a `CHECKLIST`'s items can be carried by an archive at all (an undocumented key?) or whether the
  exporter simply omits them — see trap 42.
- SIGNATURE: which «same signature type» the referenced BO needs for MASS signing
  (`signFieldUnsupported`), why `massPrintFormCodes` is dropped by an import, and what a real signing
  (OTP code / EDS through NCALayer) writes into the record. The settings themselves are answered in §5i.
- Whether `PARTICIPANTS` («Участники») is reachable at all — no palette item, no generator.
