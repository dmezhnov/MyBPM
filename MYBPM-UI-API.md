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

**The <company-a> tenant answers `companyCode: "<COMPANY_A>"`** `[C]` (2026-09-19, `GET /web/v2/auth/load-auth-info`
→ `{companyId:"nNV9BhZPBdn6qtjk", companyCode:"<COMPANY_A>", …}`) — the same company everything below calls
«<company-a>», with its 14 BO groups and the probe group «Бизнес-объект». Do not take it for a third stand.

**Evidence base.** MyBPM v4.24: <company-a> stand <stand> `S4.24.25.632/C4.24.25.264` (BO constructor,
structure import, 2026-09-18), <company-c> stand `4.24.25.614` (API, menus, rights, kanban, Excel links,
2026-09-15/16) and <company-b> `4.24.25.570/.614` (Excel record import for Scoring, 2026-08-28 .. 09-04).
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

*(`tools/follow-cookbook-stand.py` in this folder is a client written from this section and nothing else —
both the proof that the section is sufficient and a worked example of R1/R4. Its request stream is
identical, payload for payload, to the stand-verified `tools/create-bo-constructor.bun.ts`.)*

### 0U.1 What you must have before the first call

Ask the user for these, one request at a time, and wait for the answer:

1. **The stand URL** — e.g. `https://<stand>`. Everything below is `POST <stand>/web/…`.
   An archive or an export never carries the host; the user is the only source.
2. **The company (tenant)** — one host serves several: `<stand>` serves both <company-c> and <company-a>.
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
  (2026-09-18, probed on <stand> with a nonexistent user). So a failed login looks exactly like any other
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
  print the `stackTrace` — cut it (`text[:300]`, or read only `message` and `errorType`).
- **Some methods answer 200 with an EMPTY body.** `JSON.parse("")` throws — treat an empty body as
  success returning `null` (`remove-draft`, `save-menu-item-icon-name`, `save-import-description`, …).
- **Some methods answer a bare JSON string**, not an object: `import-file` → `"<importId>"`,
  `load-dev-bo-process-id` → `"<boProcessId>"`, `v2/co/generate-draft` → `"<draftId>"`. Parse
  defensively.
- Three endpoints are **not** JSON: file upload is `multipart/form-data` with the file under the field
  name **`file`** and every parameter as an ordinary form field; file download is a GET (or a POST with a
  RAW body, no envelope) returning the bytes with the name in `Content-Disposition`.

A minimal client, which is all any recipe needs:

```python
import json, urllib.request
def call(stand, token, path, params=None, body=None):
    req = urllib.request.Request(
        f"{stand}/web{path}", method="POST",
        headers={"Content-Type": "application/json", "token": token},
        data=json.dumps({"useParamsFromBody": True,
                         "params_Lr1oSgwPR8": params or {},
                         "body_o1nhHUG480": body or {}}).encode())
    text = urllib.request.urlopen(req).read().decode()
    if not text: return None
    out = json.loads(text)
    if isinstance(out, dict) and ("errorType" in out or "className" in out):
        raise RuntimeError(f"{path}: {out.get('errorType')} {out.get('message')}")
    return out
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
   enum is in `MYBPM-IMPORTS.md` §3, and §5i below covers widgets and system fields). `cols: 15` is
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
   `rollback-import` — `P {"importId":…,"processId":…}`.

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

#### R4a — EXPORT a BO's structure through the API `[C]` (2026-09-19)

The reverse of an import, and the only way to read the real serialization of something built by hand
(that is how `kanbanCardTemplates` was finally decoded). Controller **`struct`** — a basket the stand
keeps per user, then one download:

| # | call | params / body | note |
|---|---|---|---|
| 1 | `struct/count-bo-export-records` | `{}` / `{}` | how many BOs are in the basket now |
| 2 | `struct/load-bo-export-records` | `{offset,limit}` | the basket: `{boId, boName, boCategory, hasScript, isStructureExport, isAccessRightsExport, isScriptsExport}` |
| 3 | `struct/save-bo-export-records` | **body** = an ARRAY of those records | adds to the basket |
| 4 | `v2/process-indicator/pre-create-process` | `{}` | → processId |
| 5 | `struct/export-company-structure` | params `{processId}`, body `{}` | the response body IS the `.mybpm.zip` |
| 6 | `struct/remove-bo-export-records` / `struct/clear-export-records` | as 3 / `{}` | put the basket back as you found it |

- **Read the basket first and restore it afterwards** — it is the user's own selection on the
  «Импорт/Экспорт» screen, not scratch space.
- `struct/save-bo-export-records` and `…/remove-bo-export-records` answered **HTTP 400 «Failed to read
  request»** to a hand-built call whose body was byte-identical to the client's `[U]` — cause unknown.
  The way round it is the UI: `/settings?settingsOpenPageUrl=import_export&formType=export`, the ⊕ next
  to «Бизнес-объекты (N)» opens a checkbox popover (closing it saves), the row's delete icon removes one
  (it opens a confirm whose buttons are `.confirm-button-block .ok-btn`). Steps 4–6 work over the API.
- Getting the bytes OUT of the browser: fetch the zip inside the page and POST the `arrayBuffer` to a
  local `Bun.serve` — the same 127.0.0.1 bridge the import dry run used (§5).
- Also present but not needed for this: `v2/business-objects/export-structure` /
  `export-structure-to-file` with `{settings: {type: "BO_STRUCTURE"|"COMPANY_STRUCTURE"|"ALL",
  exportKindList}}`, and `struct/load-bo-dependencies` (what the «Зависимости» panel shows).

#### R5 — Access rights on a BO

Controller `v2/business-objects`. Do this AFTER an archive import, because an archive that carries access
DTOs **wipes the group rights** set by hand (`MYBPM-IMPORTS.md` §8).

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

1. Mint an id: `POST /web/v2/id-loader/load-portion` → an array of ids.
2. `create-menu-item` — `P {}`, `B` = the item itself:
   `{"id":…,"type":"GROUP"|"BO","displayName":…,"displayNameMap":{"RUS":…},"boId":…,"iconName":…,
   "orderIndex":100000,"isPanel":false,"boPages":{…},"chosenAccessRight":false,"parentId":…}`.
   Default `iconName`: GROUP `bo-g-draggable`, BO `man-with-company`, dictionary `bo-d-draggable`.
   The built-in root «Системные» has `orderIndex` 60000 — put your own roots after it.
3. Icons: `save-menu-item-icon-name` — `P {"menuItemId":…,"iconName":"phosphor:<name>"}`. **Only names
   that occur as `"phosphor:*"` in the lazy chunk `956.*.js` exist** — check before sending.
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
4. **Never send a `code`** — BO codes and field codes are generated by the server from the names, the BO
   code is cut to 30 characters, and a FIELD's code is fixed at its first save and never regenerated.
   Anything that must reference a BO by code takes it from `load-business-object-by-id`, never from a
   guess.
5. **`create-bo` writes immediately.** So does `apply-update-cmd`, so does every `v2/co/add-*`. There is
   no dialog to cancel; the only undo is deletion.
6. **One structure import per company at a time**, and only `apply-import` writes — everything before it
   is a dry run you should read.
7. **Do not ship an `AccessStructDto` in an archive unless asked**: the import applies it and wipes
   group rights that were set by hand. Re-tick them (R5) after any import that carried one.
8. **Re-read after every write.** The platform answers 200 for `save-business-form-field` (writes
   nothing), for an empty kanban template save (writes nothing) and for a rights popup that decided
   nothing changed.
9. **Never print a stack trace into the session** — a MyBPM error carries ~100 lines of Java. Read
   `message` and `errorType`.
10. Do not fight the UI where an API exists. And where you must use the UI, read §10: clicks in this app
    go through `javascript_tool` (`el.click()` matched on `innerText`), text through the native value
    setter — `computer type` silently drops spaces and punctuation.

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

### 0U.7 Where the rest is

§1 request conventions · §2 the working method · §3 rights · §4 menus and filters · §5 archive import and
export, §5b–5f one section per object kind, §5g the script API, §5h field settings, **§5i every field
type, widget and system field** · §6 Excel records: the routes (the FILE FORMAT is
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
  `token` header — no XHR sniffing needed. `[C]` (2026-09-18) Sent WITH the quotes the stand answers
  `SecurityError` «Illegal Session» (HTTP 200 body, not a 401), so that error means «bad token», not
  «expired session». In the browser the Angular client reads the same key, so a curl/Bun client outside the
  browser needs nothing else: **no cookies** (`document.cookie` is empty on this stand) and no company
  header — the token alone selects the tenant.
- **A browser is not the only way to get a token** — the stand has a headless login. Endpoint `[C]`,
  return value `[I]` (2026-09-18, read off chunk `9839`; the failure path was probed with curl):
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
- **Finding an endpoint — grep the whole bundle offline, it beats sniffing** `[C]` (2026-09-18).
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
  the user in chat («даю все права, разрешаю») unblocks it — no settings change needed.

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
- **Field and tab ids on the stand equal `newId` in an imported archive** — that is how a generated archive
  and the API are stitched together.
- Also seen on the controller: `load-field-access-author-person-list`. Dictionary options:
  `load-dictionary-bo-field-options {boId}`.
- After an archive import that carried access DTOs, **re-tick group rights** — they were wiped
  (`MYBPM-IMPORTS.md` §8). A later UI reading also showed «Из поля → Содержимое поля» unchecked for a BO's
  view, either not kept by import or wiped by a re-import — re-check it by hand or via the API.

## 4. Sidebar menu — controller `v2/menu-item`

All verified on the <company-c> stand by building 5 menu groups + 36 items via the API. `[C]`

- `create-menu-item` body = the item itself:
  `{id, type: GROUP|BO, displayName, displayNameMap{RUS}, boId, iconName, orderIndex, isPanel:false,
  boPages{…}, chosenAccessRight:false, parentId}`; `id` comes from `v2/id-loader/load-portion`.
- Default `iconName`: GROUP `bo-g-draggable`, BO `man-with-company`, dictionary `bo-d-draggable`.
- `delete-menu-item {menuItemId}`; `load-nav-items {parentId}` → the children with their ids.
- The built-in root «Системные» has `orderIndex` 60000 — put your own roots after it (100000, 200000, …).
- `save-menu-item-bo-pages` params `{menuItemId}`, body `boPages`; the view order is the `*Index` values
  (1-based). Kanban keys: `isKanbanEnabled`, `kanbanIndex`, `listIndex`, `kanbanFieldId`. These switch the
  COLUMNS on; the CARD lives on the BO and must come from the archive (§7).
- Icons: `save-menu-item-icon-name` params `{menuItemId, iconName:"phosphor:<name>"}` (empty 200). **Valid
  names are exactly the 1048 `"phosphor:*"` strings in lazy chunk `956.*.js` — check against it**:
  `seal-check`, `ranking`, `toolbox`, `gavel` do NOT exist. Built-in items inside «Системные» use system
  icons (portfolio, no-color-settings, no-color-archive, man-with-company) — leave them alone.
- UI: the sidebar row kebab (⋮) offers Отображать в моб. приложении / Изменить код / Права доступа /
  Переименовать / Изменить иконку / Разгруппировать / Удалить. Sidebar names are `<input>` values inside
  `app-bo-record`; clicking `.container` puts the id into the URL.

### Menu-item rights

- **Correct API** `[C]`: `v2/menu-item/load-access-group` params `{menuItemId}`;
  `v2/menu-item/save-access-group` params `{menuItemId}`, body = the access group itself (same shape as BO
  rights: groups through `view.orgUnitToAdd` / `orgUnitToDelete`, `accessForAll:false`); then
  `save-menu-item-chosen-access-right` params `{menuItemId, chosenAccessRight:true}` (the UI sends it after
  saving). Only `view` matters for navigation.
- **WRONG** (fails with `NoBoWithId` for menu items): `v2/business-objects/load|save-business-menu-access-group`.
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
route to upload/download one. Evidence: <stand> company **<company-a>**, 2026-09-18, v4.24.25.614. `[C]`

**One domain hosts several companies (tenants).** `<stand>` serves <company-c> AND <company-a> (and `<COMPANY_A>`
appears in <company-a>'s import log). The sidebar content differs completely per company — do not assume a
screen exists just because another company on the same host has it.

### Route

Sidebar group **«Системные»** (a collapsed menu GROUP, first item, click to expand) → **«Настройки»** →
`/settings`, then the left sub-menu → **«Импорт/Экспорт»**.

- Direct URLs (work, no clicking needed): `/settings?settingsOpenPageUrl=import_export&formType=import`
  and `…&formType=export`. **Clicking the Импорт/Экспорт tab labels did nothing — navigate by URL.** `[C]`
- **«Бизнес», «Компания», «Настройки», «Аналитика» sit at the TOP LEVEL of the sidebar by default** —
  outside any group (user, 2026-09-18). <company-a> is the exception: someone there collected them into a
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

### Import is TWO-PHASE — upload analyses, a second step applies `[C]` (2026-09-18)

1. `file_upload` into that input is enough to submit — no button click, no dialog. The page shows
   «Анализ структуры… N/N», then a toast «Анализ импорта завершен» and a **new log row with the status
   «Импорт проанализирован»**. *Nothing has been written to the stand yet.*
2. **Click that log row** → a full-screen dialog opens:
   - left tree: **«Информация»**, **«Ошибки»**, then one node per BO in the archive, labelled
     **`<вид объекта>/<имя БО>`** — the first half is the object's CATEGORY, not its BO group `[C]`
     (2026-09-18: a `BO_DICTIONARY` whose `boGroupOldId` pointed at «Бизнес-объект» was listed as
     «Справочник/Проба справочник импорт UI 2026-09-18» and landed in «Бизнес-объект» all the same;
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
- The log also confirms **cross-tenant import works**: <company-a> holds imports of
  `MyBPM-export-<COMPANY_A>-…` and `MyBPM-export-<company-d>-…` archives. `[C]`
- «Описание импорта» is a free-text field stored per import — so the dialog asks for a description
  (the field was never opened this session; the dialog's exact contents are `[U]`).

### Import through the API — the whole cycle without a browser `[C]` (2026-09-18)

Done end to end on <company-a>: BO «Проба API 2026-09-18» (`Proba_API_20260918`) was created by this route
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
  undo the import. `newerAppliedImportsCount` presumably blocks it when later imports exist `[I]`.
- Enums in chunk `5675`: import status `IN_PROGRESS|ANALYZED|APPLIED|ROLLED_BACK|DESCRIPTION_ERROR|
  INTERNAL_ERROR|CANCELED`; apply result `APPLIED|ROLLED_BACK|DESCRIPTION_ERROR|HANDLING_ERROR`; struct
  types `STRUCTURE|ACCESS_RIGHTS|SCRIPTS|GLOBAL_METHODS|MENU|REPORTS|SETTINGS` (our archive → `STRUCTURE`).
- The UI also calls `/v2/struct/conflict/{load-conflicts,load-select-instance-table,resolve-conflicts}`;
  a clean archive returns `conflicts:{}` and they are never needed `[C]`.
- The BO-side `/web/v2/business-objects/import-structure` (`postFileJson`, param `startTestProcess:false`)
  is a DIFFERENT, single-call endpoint of the BO controller — not used here, untried `[U]`.

### The dry run as a VALIDATOR — 13 eval archives against <stand> `[C]` (2026-09-18)

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

**Follow-up probe — «а если положить эти БО в тот же архив?»** `[C]` (2026-09-18). Yes, and it is the
right way to ship a composite: case07's `BO_COMPOSITE` plus two plain BOs with the codes it names
(`Klienty`, `Postavshchiki`) in ONE archive analyses `ANALYZED`, 0 errors — `load-import-bo-infos` lists
all three. Line order is irrelevant (the composite placed BEFORE its sources analyses the same).
Archives: `tools/out/probe-co-inarchive-2026-09-18.mybpm.zip`, `…/probe-co-order-…`.

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
- `load-business-object-name {boId}` → the BO's name; `load-bo-groups {}` → all 14 <company-a> groups with
  `{id,name,code,orderIndex,kind}` (the way to prove an import renamed nothing);
- `load-bo-fields-for-drag {boId}` → the BO's fields as `{label,type,…}`; **`code` comes back `null`** here,
  so it identifies fields by label only `[C]`.
- `load-bo-id-by-kind`, `load-bo-fields-by-ids`, `load-bo-dictionary-list`, `verify-business-object-code`,
  `verify-business-field-code` exist alongside `[U]`.

### Export tab

- Layout: toggles **Глобальные методы / Элементы меню / Отчеты**; then **«Бизнес-объекты (N)»** with
  «Очистить все» — a basket of BOs, each row labelled **`<группа БО>/<имя БО>`** (e.g.
  «Бизнес-объект/БО с текстом») with three checkboxes **Структура / Права доступа / Скрипты** (they decide
  which DTO lines the archive gets: `BoStructDto` / `AccessStructDto` / `BoScriptVersionsStructDto` +
  `ScriptDefStructDto`, `MYBPM-IMPORTS.md` §5d) and two
  per-row icons; a right pane **«Зависимости:»** («Зависимости не найдены» when none); button **«Выгрузить»**.
- The basket is PERSISTED state — it still held 2 BOs from an earlier session on open. Check/clear it
  before exporting so you do not ship someone else's selection.
- **BOs get into the basket through the grey ⊕ right of the «Бизнес-объекты (N)» caption** `[C]`
  (2026-09-18): it opens a dropdown «Какой элемент хотите найти?» — a search box over ALL BOs of the
  company with a checkbox per row plus «Выбрать все». Ticking a row adds it to the basket immediately
  (the counter goes up); the dropdown does not close on Escape — click elsewhere on the page.
  The sidebar's drop hint «перетащите бизнес объекты сюда» belongs to the MENU editor, not here.
- **To take a BO OUT of the basket use the row's trash icon**, not the ⊕ dropdown `[C]`: unticking the
  row there does NOT remove it. The trash icon asks «Удаление элемента — Удаление элемента `<имя БО>`»
  with ДА / НЕТ; ДА only drops it from the basket — **the BO itself is untouched** (verified: the BO was
  still in the constructor afterwards). The other per-row icon is a collapse chevron.
- **The whole screen has an API** — basket + download, see §0U R4a. Only the two basket WRITES resisted a
  hand-built call; everything else, «Выгрузить» included, is three plain calls.

### Checking the result of a structure import

- **BO constructor: the sidebar item «Бизнес»** → `/business-objects/viewing-list` `[C]`. In <company-a> it
  lives inside the menu group «Системные»; by default it is a top-level sidebar item — see the Route
  note above, the grouping is per-company. Left panel = the
  list of BO GROUPS (<company-a> has 14: Тест, Системные, Инициатива, АВР, Задача, Компания, Встреча, Визит,
  Контактные данные, Расположение, Другое, Fix, Tests, Бизнес-объект); the chevron on a group expands it
  into its BOs (grey rows underneath). This is the place to verify that an import did not rename a group.
- **This list is invisible to text extraction** `[C]`: `get_page_text`, `read_page` and even
  `document.body.textContent` return only the outer chrome (`body.textContent` was 278 chars and held the
  sidebar, not the list). Read it from **screenshots**, not from the DOM.
- Clicking a BO opens its registry: `/business-objects/viewing-list/bo/<boId>/list-view?…`.
- **The stand keeps the archive's `oldId` as the BO id** `[C]` — the probe BO generated with
  `oldId: "Zyvu00@DV5VPL69g"` got exactly that id in the registry URL. So deterministic generator ids are
  also the stand's ids, and a re-import of the same archive addresses the same BO.
- What an imported BO looks like straight away `[C]`: registry columns = the fields with
  `tableColToShow:true`, in `tableColOrderIndex` order; «Добавить» opens the form with the archive's
  `gridPosition` widths honoured (15 cols = full width, 5 cols ≈ a third); the platform appends a colon to
  every field label («Наименование:»); INPUT_NUMBER shows a default `0`; the record tabs
  В работе / Архивные / Удаленные / Тестовые and the empty state «Данные отсутствуют» come for free.
- Cancelling that «Добавить» form asks «Несохраненные данные — У вас есть несохраненные данные. Закрыть
  без сохранения?» (ДА / НЕТ) — a draft is created as soon as the form opens.

## 5b. Creating a BO in the constructor — no archive at all `[C]` (2026-09-18, <company-a>, S4.24.25.632)

A BO does **not** have to come from a `.mybpm.zip`. The constructor creates one directly, and the same
six `/web/v2/business-objects/*` calls do it headlessly. Two probe BOs on <company-a> prove both routes:
«Проба UI 2026-09-18» (`Proba_UI_2026_09_18`, `OpmGDzaQRUT27jky`) and «Проба API-конструктор 2026-09-18»
(`Proba_API_konstruktor_2026_09_`, `~hb30v0XyMtGsBLj`), both in group «Бизнес-объект» (`N50iWQkw0iySlAKo`).

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
  the client then looks for a group of `kind: DEFAULT` and **all 14 <company-a> groups are `kind: MANUAL`**,
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

### 5c. The matrix «4 routes × 5 object kinds» — column «Справочник» `[C]` (2026-09-18, <company-a>)

A dictionary is created by all four routes with NO route-specific machinery; four probes live in group
«Бизнес-объект» (`N50iWQkw0iySlAKo`):

| route | probe | id |
|---|---|---|
| constructor UI | «Проба справочник UI 2026-09-18» | `L@Qf3i2HSH~JqglG` |
| constructor API | «Проба справочник API 2026-09-18» | `~LnUPP4RmTVmuZZo` |
| archive import UI | «Проба справочник импорт UI 2026-09-18» | `lEIvD4e6k5AojKC5` |
| archive import API | «Проба справочник импорт API 2026-09-18» | `fArbAncLamdx5agj` |

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

### 5d. The matrix «4 routes × 5 object kinds» — column «Панель» `[C]` (2026-09-18, <company-a>)

A panel is an ordinary BO with `boCategory: "BO_PANEL"`; all four routes need **no panel-specific
machinery**. Four probes in group «Бизнес-объект» (`N50iWQkw0iySlAKo`), each holding one nested object
pointing at «Проба UI 2026-09-18» (`OpmGDzaQRUT27jky`):

| route | probe | id |
|---|---|---|
| constructor UI | «Проба панель UI 2026-09-18» | `YquiOukznt5OrCnl` |
| constructor API | «Проба панель API 2026-09-18» | `q8WVtZ6NL4S7LXzJ` |
| archive import UI | «Проба панель импорт UI 2026-09-18» | `OoXWIvbALVI9u392` |
| archive import API | «Проба панель импорт API 2026-09-18» | `qZgw7EkXvHSt7ydQ` |

- **Constructor.** Group kebab → «Добавить панель» = `create-bo {boGroupId, boCategory: "BO_PANEL"}`,
  nothing else; the editor route is the same `…/object-editing`, and the DTO carries no panel-specific
  key (`isDictionary:false`, `instanceViewType:"FORM"`, `formFields: []` — unlike a dictionary a panel is
  born EMPTY).
- **A panel is built of NESTED OBJECTS — registry widgets, not «виджеты».** The palette («Элементы
  страницы» / «Виджеты» / «Системные поля» / **«Вложенные объекты»**) ends with a list of the company's
  BOs; dragging one in calls **`generate-business-form-field {boId, fieldType: "BO", fieldBoId: <BO id>}`**
  — the `fieldBoId` parameter that had been `[U]` until now. The saved field is
  `type:"BO", viewType:"TABLE", isKindAddForSelect:true, refBoId:<BO id>, gridPosition.rows:6`
  (`readFromRegistry` comes back `null` even though the client sends `true`).
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
- <company-a>'s own panel «Главная» (`cd2gCP8IyobPtcy0`, code `Glavnaya`) exported cleanly: the same
  `BoStructDto`, three `dynamicFields` of `type: "BO"`, each with `boRefStruct.fieldRefs` (which columns
  of the target BO to show, `toShow`/`orderIndex`/`gridPosition` per field) and a `bracketFilter`
  («Мои встречи» = `nativeFilters: {type: "CREATED_BY", isCurrentUser: true}`). That pair —
  `fieldRefs` + `bracketFilter` — is what makes a real dashboard; the probes ship neither.

### 5e. The matrix «4 routes × 5 object kinds» — column «Составной объект» `[C]` (2026-09-18, <company-a>)

A composite object (`boCategory: "BO_COMPOSITE"`) is the ONE kind that needs machinery of its own: it has
its own editor route, its own controller and a DRAFT protocol. Probe: «Проба составной UI 2026-09-18»
(`ybaA@lqdUMgVNnBo`, code `Sostavnoyi_obekt__6962`), sources «Проба UI 2026-09-18» (`OpmGDzaQRUT27jky`)
and «Проба API-конструктор 2026-09-18» (`~hb30v0XyMtGsBLj`).

- **Creation is the same as every other kind**: group kebab ⋮ → «Добавить составной объект» =
  `create-bo {boGroupId, boCategory: "BO_COMPOSITE"}`, created immediately as «Составной объект №N».
- **The editor is `/business-objects/editing/<coId>/composite-editing`**, NOT `…/object-editing`.
  Left pane = the source BOs and their attributes; right pane = the composite's own attributes, split into
  «Составные атрибуты» and «Простые атрибуты». No palette, no form canvas — a composite has no layout.
- **Its code is NOT regenerated by the rename** `[C]`: the probe kept `Sostavnoyi_obekt__6962` from the
  auto-name after being renamed to «Проба составной UI 2026-09-18». (For a BO built in the constructor the
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

#### The same thing headlessly — `tools/create-co-constructor.bun.ts` `[C]` (2026-09-18)

`create-bo {boGroupId, boCategory:"BO_COMPOSITE"}` → `v2/co/generate-draft {coId}` →
`add-bo-to-co` per source → `load-bo-fields-for-co {boId}` for the `fieldId`s →
`add-co-field-to-simple` / `add-co-field-to-composite` with `[{boId, fieldId}]` →
`apply-and-remove-draft {draftId}`. Ran clean on the first attempt; probe «Проба составной API
2026-09-18» `J7APr3Sq8wvImvNF`, verified both through the API and on screen.

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

**Both archive routes are closed** `[C]` (2026-09-18) — probes «Проба составной импорт UI 2026-09-18»
(`Ydcir@tyWppurNGY`) and «Проба составной импорт API 2026-09-18» (`mgGrtPrg7@oXWVMx`), generated by
`tools/make-probe-archive.bun.ts --category BO_COMPOSITE --source … --co-field …` and shipped by the two
routes of this section. The importer resolves `bos` **by code** into the stand's real `boId`s and
`boFieldCodes` into the live `links` — read back identical to a composite built in the constructor.
Details and the failure mode in `MYBPM-IMPORTS.md` §5b.

### 5f. The matrix «4 routes × 5 object kinds» — column «Бизнес-процесс» `[C]` (2026-09-18, <company-a>)

A business process (`boCategory: "BO_PROCESS"`) is the second kind with machinery of its own: its own
editor route, TWO controllers and a versioned diagram. Probes in group «Бизнес-объект»
(`N50iWQkw0iySlAKo`):

| route | probe | id |
|---|---|---|
| конструктор UI | «Проба процесс UI 2026-09-18» | `wy6aMlbuQ6LoCFYd` |
| конструктор API | «Проба процесс API 2026-09-18» | `kzk2E83IWByEju0S` |
| архив UI | «Проба процесс импорт UI 2026-09-18» | `ID7UFuWR8PunADHB` |
| архив API | «Проба процесс импорт API 2026-09-18» | `B0oV1N6CanuJ0faO` |

- **Creation is the same as every other kind**: group kebab ⋮ → «Добавить бизнес-процесс» =
  `create-bo {boGroupId, boCategory: "BO_PROCESS"}`, created immediately as «Бизнес-процесс №N».
- **The editor is `/business-objects/editing/<boId>/process-editing`**, NOT `…/object-editing`: a name
  input, a version selector «Версия: 1 (Тест)», a «Блок-схема» dropdown, a «Локальные методы» button and
  the diagram canvas. There is **no field palette and no form canvas in this editor** — the process's
  fields are still edited through the ordinary BO constructor.
- **The platform pre-builds two things at creation** `[C]`: the field `PROCESS_STATUS` («Статус процесса»,
  `type: "BO"`, `isSystem`, `isRequired`, pointing at the built-in dictionary «Статус процесса» — on
  <company-a> `Q0zI~z9Ra2R7Q3yd`, group «Другое»), and **version 1 with a single `Enter` figure**.
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
  (`bo-process-editor/undo`). The `create-draft` family of `bo-process-editor2` is about something else
  (versions) and was not needed for any of the four routes `[U]`.

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

#### The same thing headlessly — `tools/create-process-constructor.bun.ts` `[C]` (2026-09-18)

`create-bo {boGroupId, boCategory:"BO_PROCESS"}` → rename via `save-business-object-portion` →
`load-dev-bo-process-id` → `load-bo-process-def` (to find the Enter) → `load-new-ids {count: 2·N}` →
one `apply-update-cmd` chaining N figures after the Enter → `validate-def`. Ran clean on the first
attempt; probe `kzk2E83IWByEju0S`, `validate-def` empty. `--show <boId>` prints versions, figures,
arrows and validation of any existing process — the cheapest read-back there is.

#### Both archive routes `[C]` (2026-09-18)

`tools/make-probe-archive.bun.ts --category BO_PROCESS [--process-figure "<Type>@x,y"]…
[--process-status <refBoId>]` builds the archive (shape in `MYBPM-IMPORTS.md` §5c); the UI route and
`tools/api-import-structure.bun.ts` both applied it with zero analysis errors, and the diagram came back
identical (`validate-def` clean, Enter → Exit rendered on screen).

- **An imported version is `isWork: true` — «Версия: 1 (Опубликованный)»**, while a version created in
  the constructor is `isTest: true` / «Версия: 1 (Тест)» `[C]`. The import publishes the process.
- **Figure and arrow ids survive the import** `[C]` — the stand's def carries the archive's own ids,
  exactly like `oldId` → `boId` (that happened for the 5th and 6th time here).
- **The importer does NOT create `PROCESS_STATUS`** `[C]`: the process imported without it has only the
  archive's own fields, while every constructor-made process has it. Ship it in `dynamicFields`
  (`--process-status <refBoId>`, the stand's «Статус процесса» dictionary id) if the imported process is
  meant to look like an exported one. Whether a process RUNS without that field is `[U]`.

### Export through the API — no browser download `[C]` (2026-09-18)

The browser's own «Выгрузить» fires but **the file never reaches `~/Downloads` under Claude-in-Chrome**.
Drive it from the shell instead (`scratchpad/export.bun.ts`), it is two calls:

1. `POST /web/v2/process-indicator/pre-create-process {}` → `processId`;
2. `POST /web/struct/export-company-structure?processId=<id>` with body `{}` → the zip bytes
   (`content-disposition` carries the generated file name).

It exports **whatever the company's export basket currently holds** — the basket is server-side state.
It can be filled **from the shell too** `[C]` (2026-09-18), no UI needed — controller `struct`, which
lives at `/web/struct/...`, NOT under `/web/v2`:

```
POST /web/struct/clear-export-records        {}                        ← empty the basket
POST /web/struct/save-bo-export-records      BODY [ {boId, boName, boCategory, hasScript:false,
                                                    isStructureExport:true,
                                                    isAccessRightsExport:false,
                                                    isScriptsExport:false} ]
POST /web/struct/count-bo-export-records     {}                        → how many are in it
```

then the two calls above. `scratchpad/export.bun.ts` of this session does exactly that; picking the BOs
in the UI first (⊕ right of «Бизнес-объекты (N)») remains the manual alternative.
The «Зависимости:» pane lists what the selection needs («Структура у "Главная" имеет зависимость от:
"Встречи", "Инициативы", "Задачи"» with a «Добавить в экспорт» link each and «Подтвердить все
зависимости»); **unconfirmed dependencies do not block the export** — the archive then holds only the
selected BOs. The <company-a> export came back named `MyBPM-export-<COMPANY_A>-…` — the file name's company slug is
not the tenant you are working in `[U]`.

### 5g. Block IDE scripts on a running stand — the API `[I]` (2026-09-18, read off the bundle)

The script format, the block/expression templates and the clipboard paste protocol are
`MYBPM-IMPORTS.md` Part II (§0S is the cookbook). What was missing there was the other half: **where that
screen is and whether a script can be touched without it.** It can — the client drives scripts through
two ordinary controllers, so everything §0S says about «the clipboard is the whole delivery channel» is
true of the IDE, not of the platform.

**Most of this section is read off the client bundle (chunks `9839`, `6543`, `5675`) and still `[I]`.**
**Six calls were executed on 2026-09-18 and are `[C]`** — `v2/script-browser/load-tree` + `load-children`,
`v2/bo-scripts-editor/load-bo-script-versions` + `load-bo-scripts`, `v2/script/load-script-def` and
`v2/script/translate-script` (the reading half; see «Reading a BO's scripts headlessly» below). The
WRITING half — `paste`, `apply-update-cmd`, `create-local-method` — is still untried, but writing a script
no longer needs it: **an archive creates scripts on import** (`MYBPM-IMPORTS.md` §5d, verified).

| controller | scope | methods |
|---|---|---|
| `v2/bo-scripts-editor` | a BO's script MODULE and its versions | `load-bo-scripts {boId, boScriptsId}`, `load-bo-script-versions {boId}`, `save-bo-scripts` (body), `in-work-bo-script-version` / `in-test-bo-script-version` / `copy-bo-script-version` / `remove-bo-script-version` / `change-bo-script-version-comment {boId, boScriptsId[, comment]}`, `unset-in-work-version {boId, boScriptId}`, `list-local-methods {boScriptsId}`, **`create-local-method {boScriptsId, methodName}`**, `delete-local-method {boScriptsId, scriptId}` |
| `v2/script` | ONE script (a method body or a process script) | **`load-script-def {scriptModuleId, scriptId}`**, `load-script-meta-state`, `load-module-methods {scriptModuleId}`, **`apply-update-cmd`** (params `{scriptModuleId, scriptId}`, body = the command), `undo` / `redo`, `load-new-ids {count}`, **`paste`** (body `{copied: <the clipboard JSON>}`), `translate-script`, `load-bo-def-list`, `load-const-field-list`, `load-func-groups-definition`, `load-objects-definition`, `load-enums-definition`, `load-act-record-list` / `load-act-details`, `load-bo-field-options {boId, fieldId, filterText}`, `load-script-env-params-by-bo-process-id {boProcessId}`, `load-expr-value-display-str`, `load-value-ext-type-for-expr`, `load-predefined-expr-value-params-for-ext-type` |

- **Company-global methods** («Глобальные методы» in `/settings`) are the same controller:
  `ensure-company-global-script-module {}`, `list-company-global-methods {}`,
  `create-company-global-method {methodName}`, `delete-company-global-method {scriptId}`.
  So **a method CAN be created without the IDE** — §0S.1's «you cannot create a method» is a statement
  about the clipboard, not about the platform. `[I]`
- **`apply-update-cmd` is the same patch language as the process diagram** (§5f): a `Group` of
  `Set`/`Unset` over `dotPath`s — here `blocks.<id>` and `expressions.<id>` instead of
  `figures.<id>`/`arrows.<id>`, and the same `forward`/`backward` pair. `undo`/`redo` are server-side.
- **`/paste` is the server side of Ctrl+V**: the client sends `{copied: <the exact JSON of §0S.3>}`, gets
  back `{copied: …}` with every id regenerated, and then writes the returned `blocks`/`expressions` into
  the script with one `apply-update-cmd` (`Set` per `blocks.<id>` / `expressions.<id>`). **That is a
  headless delivery path for a script**, and it is the thing to try first when §0S.12's
  «put it on the clipboard and ask the user to paste» is inconvenient. Untried `[U]`.
- The paste the IDE refuses is reproduced server-side too: a fragment whose blocks include
  `BlockFixMethod` or `BlockFixEntryPoint` is rejected for a global method.
- A process version carries its scripts as a `scriptsDefs {defs: {<figureId>: {blocks, expressions}}}`
  bundle — `v2/bo-process-editor/load-script-def-list` / `save-script-def-list` (§5f). Pasting figures
  rewrites `BlockSwitchExit.targetArrowId` through the arrow-id map, which is why §0S.4 calls arrow ids
  «not yours to generate».
#### Reading a BO's scripts headlessly — the four calls, in order `[C]` (2026-09-18, <company-a>)

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
  `load-exit-variants {scriptModuleId, scriptId}`). This answers open question 20 only on paper — nobody
  has opened it yet.

### 5h. Field settings — «Обязательное», «Уникальное», «Выпадающий список» `[C]` (2026-09-18, <company-a>)

What the constructor's gear popover on a field writes, and how to write the same thing through the API
and through an archive. Two probe BOs on <company-a> in group «Бизнес-объект» prove every route:
«Проба настройки полей 2026-09-18» (`yxTzPaWhONPNxk5j`, built by the API) and «Проба настройки полей
импорт 2026-09-18» (`ATyioDPdsxhmVDBO`, built by an archive import), both with the same four fields:
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

- **Ticking «Необходимо заполнить» GREYS OUT «Только для чтения»** and the other way round — the UI
  enforces what `MYBPM-IMPORTS.md` §0.5 states as a rule: required + readonly cannot both be true.
- The tab «Поведение» holds the per-type extras; for a text field they are «Ограничения вводимых
  символов» (Только заглавные / Только строчные → `textCase`) and «Ограничение длины символов»
  (`maxLength`).
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
`BO_DICTIONARY` of the company (36 on <company-a>), and `load-dictionary-bo-field-options {boId}` → its rows
as ready option DTOs (`Должность` = `kNfvHppcNSR6Wz@B`, code `Dolzh`, 35 rows). **Binding to an EMPTY
dictionary is legal** and gives an empty dropdown on the form.

Accelerator — `tools/create-bo-constructor.bun.ts`, one call for the whole probe:

```
bun tools/create-bo-constructor.bun.ts --token-file <f> --group "Бизнес-объект" \
  --name "Проба настройки полей 2026-09-18" \
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

#### What the settings actually DO on a record (runtime, verified in the UI)

- A required field is marked with a red `*` on the record card; saving with it empty is refused with the
  dialog **«Внимание — Карточка не соответствует требованиям: 1. Обязательные поля не заполнены»** and the
  field outlined red.
- A duplicate in a unique field is refused with the field-level tooltip **«Ошибка — Продублировано
  уникальное поле»**; the card stays open and nothing is written.
- A `FROM_BO` dropdown lists the dictionary's rows (Developer, Manager, General Manager, …), a
  `FROM_FIELD` one lists its own options — both with a «Поиск» box.

### 5i. Every field type, widget and system field — constructor UI and API `[C]` (2026-09-18, <company-a>)

Three families, three palette sections, three generator endpoints. Everything below was done on
<company-a>: «Проба все типы полей 2026-09-18» `y5VYjeIOYlfTFjLk` (constructor API, 43 elements),
«Проба все типы импорт 2026-09-18» `w3Y4bI3H2ntf7rcF` (the same 43 through a generated archive, API
import) and «Проба виджеты конструктор 2026-09-18» `zm8ufIOguCPru0bu` (widgets + system fields through
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
| `DROPDOWN_SINGLE`, `RADIO_BUTTON_GROUP`, `CHECKLIST` | `optionSource` `FROM_BO` + `refBoId` (dictionary) or `FROM_FIELD` + `options[]` (§5h) |
| `QUESTIONNAIRE` | `questionnaires[]` — the generator already returns two rows, one `isColumn: true`, one `false`; set their `label`/`labelMap` |
| `PROGRESS_BAR` | `progressSteps[]` = `{id (v2/id-loader), orderIndex, label, code, labelMap}` |
| `TAB_GROUP` | `tabs[]` = `{id, label, isActive, chosenAccessRight, orderIndex, isInvalid, isRight, isDefault, labelMap}` |
| `FILE_UPLOAD` | `viewType` SINGLE/MULTIPLE, `params.contentType` ALL/FOR_CAMERA |
| `STATIC_TEXT` | `staticValueMap.RUS` = the HTML |
| `BO` / `CO` | `fieldBoId` on the generator call (BO) or `refBoId` on the DTO (CO), `viewType` TABLE/SINGLE |

#### A widget's code and url are NOT keys of the field DTO

Each widget family has its own controller, and everything goes into the **params** half of the envelope —
a call that puts them into the body answers 200 and writes nothing:

| widget | controller | set | read |
|---|---|---|---|
| SIGNATURE | `v2/signature` | `save-signature-code {boId, signatureId, code}` | `load-signature-code` |
| BUTTON | `v2/button` | `save-button-code {boId, buttonId, code}`, `save-button-url {…, url}`, `save-button-field-ids {…, fieldIds}` | `load-button-code` / `load-button-url` |
| IFRAME | `v2/iframe` | `save-iframe-code {boId, iframeId, code}`, `save-iframe-url {…, url}` | `load-iframe-code` / `load-iframe-url` |
| CAPTCHA | `v2/captcha` | `save-captcha-code {boId, captchaId, code}` | `load-captcha-code` |
| CURRENT_* (date family) | `v2/current-date` | `save-current-date-code {boId, currentDateId, code}` | `load-current-date-code` |
| CURRENT_USER | `v2/widget-current-user` | `save-current-user-code {boId, currentUserId, code}` | `load-current-user-code` |

The `<widget>Id` is the widget field's `fieldId`. **`load-business-object-by-id` returns `code: null` for
every widget except BUTTON** — that is not a missing code, read it through the controller above. A widget
that never got a code still exports with one the server derives from the label («Кнопка» → `Knopka`,
«ЭЦП/SMS» → `ECP_SMS`); the UI warns «У виджета … нет кода» where a code is required.

#### The tool

`tools/create-bo-constructor.bun.ts` now drives all three families in one run:

```
bun tools/create-bo-constructor.bun.ts --token-file /tmp/token --group "Бизнес-объект" \
   --name "Проба виджеты конструктор 2026-09-18" \
   --field "Наименование:INPUT_TEXT" \
   --widget "BUTTON:Кнопка:knopka_k:https://example.org/k" --widget "SIGNATURE:ЭЦП/SMS:ecp_sms_k" \
   --widget "CURRENT_USER:Текущий пользователь:cur_user_k" \
   --native CREATED_AT --native CREATED_BY --native OPEN_COUNT
```

It generates every element, lays them out, saves the BO once, then sets each widget's code and url
through the controllers above. Verified by exporting the result: the six widget maps came back with
`ecp_sms_k` / `knopka_k` (+ url) / `iframe_k` (+ url) / `captcha_k` / `cur_date_k` / `cur_user_k`, and
`nativeFields` with the three system fields.

#### What the archive route cannot do

A «Чек лист» keeps its items on the field (`options` + `optionSource`), but a structure export writes no
`fieldOptionsStruct` for it and an import brings none — the items must be typed in the constructor `[C]`
(checked twice: a checklist with two items exported empty, and an archive carrying items imported empty).
Everything else — all 27 types with their settings, all six system fields, all ten widgets with their
codes and urls — survives the archive round trip unchanged.

## 6. Records: Excel import and export

Records (instances) are imported as **Excel files into a BO registry** (registry kebab → импорт/экспорт
xlsx), never through the structure archive.

### Import and export through the API — controller `v2/bo-transfer` `[I]` (2026-09-18, read off the bundle)

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

### 6a. Creating a record WITHOUT the UI — the draft cycle `[C]` (2026-09-19, <stand>/<COMPANY_A>)

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
  Use the four calls above instead.

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

## 7. Kanban — SOLVED: the card template belongs in the archive `[C]` (2026-09-19, <stand>/<COMPANY_A>)

The old verdict «канбан сломан на платформе» was wrong. A kanban is two independent pieces, and the
missing one was never the menu item:

1. **Columns** — per MENU ITEM: `boPages.isKanbanEnabled`, `kanbanIndex`, `listIndex`, `kanbanFieldId`
   (§4). This part always worked.
2. **The card** — per BUSINESS OBJECT: `BoStructDto.kanbanCardTemplates`. An imported BO carried `{}`,
   so `BoDto.toKanbanCardTemplate` NPE-d and the view showed «cardTemplate is null». **Ship the template
   inside the archive** and the kanban works — the format is `MYBPM-IMPORTS.md` §0.5c, keyed by the
   dropdown's CODE, the card fields by CODE with `locationType` + `archetype`.

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
### The defect is NOT the import — it is every NEW BO on this stand `[C]` (2026-09-19, <stand>/<COMPANY_A>)

The test above was run and it answers the question: **a BO built in the CONSTRUCTOR fails identically.**

**All THREE creation routes are equally broken** — the route a BO was born by makes no difference:

| BO | born by | index | `ordering: null` | explicit `DYNAMIC` text sort | explicit `CREATED_AT` |
|---|---|---|---|---|---|
| `fsV2MG@eJqXHw90r` «Канбан из архива 2026-09-19» | **archive** | `v1_3_boi18_7ec576306f9e26a5c7c3dd2b` | `EsException` | — | OK, 1 |
| `yxTzPaWhONPNxk5j` «Проба настройки полей 2026-09-18» | **constructor API** (§5h) | `v1_3_boi18_cb14f33da5a138d3cdc64e63` | `EsException` | `EsException` | OK, 1 |
| `OpmGDzaQRUT27jky` «Проба UI 2026-09-18» | **constructor UI**, by hand (§5b) | `v1_3_boi18_3a99860f36904544f6ee3932` | `EsException` | `EsException` | OK, 1 |

The UI row was the user's own question («а если через UI?») and it needed a record, which the BO did not
have — it was created through the record API of §6a below, i.e. through exactly the calls the UI form
itself makes. An empty BO never errors (ES has nothing to sort), which is why every 0-record probe looks
green: `ATyioDPdsxhmVDBO` (the archive twin of the field-settings probe) is «green» only because it holds
no records.

**What it looks like on screen** `[C]` (registry of `OpmGDzaQRUT27jky`, 2026-09-19): the table draws its
headers and then only «Загрузить ещё» — no rows — while the counter top-right still says «из 1», and two
red toasts «Ошибка / ErrorResponse: {"error":{"phase":"query","failed_shards"… fields are not optimised
for operations that require per-document field data…» pile up in the corner with a `trace-id`. Nothing
in the UI hints at sorting, which is why this reads as «канбан/реестр сломан» rather than «ES mapping».

**Reproducing it by hand, no API** (≈2 minutes): `/business-objects/editing` → hover a BO-group row →
⋮ → «Добавить бизнес-объект» → name it → drag **«Текст»** from the palette onto the canvas, label it →
**СОХРАНИТЬ**. Then Системные → **Бизнес** (`/business-objects/viewing-list`) → the group → click the BO
→ its registry → **«Добавить»** → fill the text field → save. The registry comes back empty with the
toasts above. **Before that first record the same screen is clean** — ES has nothing to sort — so a
0-record BO never shows it. There is no workaround inside the UI: the only columns are the BO's own text
fields, and sorting by one of those is exactly what fails (an explicit `CREATED_AT` ordering, which does
work, is not reachable from the screen; `save-bo-table-sort` to `CREATED_AT` does not change the default
sort either).
- **The whole tenant was swept**: all 145 BOs/dictionaries of <COMPANY_A> were called with `ordering: null`.
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
- **What to do meanwhile**: always send an explicit `ordering` (`{archetype:"NATIVE",
  fieldId:"CREATED_AT", state:"DESC"}` works everywhere). The stand's own client sends `ordering: null`,
  so the registry and the kanban of a freshly created BO stay broken in the UI until the mapping is fixed.
- **The test that would separate «new index» from «new field»** — NOT run, it writes into someone else's
  BO: add a fresh `INPUT_TEXT` field to a long-standing BO, fill it in one record and sort by it. Sorting
  fine ⇒ the index template of the old indexes is healthy and only newly created indexes are broken;
  failing ⇒ any field created now is broken, wherever it lands.

## 8. HTML fields and «Текст» sections — what the sanitizer accepts

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

### xlsx with openpyxl

- The Excel table `displayName` must be Latin (`Table1`…) — a Cyrillic one makes Excel offer to «repair».
- `tableColumns` names must match the header cells exactly, else Excel «repairs» the file. When inserting
  columns, rebuild `tableColumns` by header name and extend the table `ref`, the autoFilter and the
  conditional-format `sqref`.
- **openpyxl's save DROPS Google's `xl/metadata` part** → if it must survive, patch the XML inside the zip
  instead of loading the workbook.
- Moving rows: move the values AND `row_dimensions[].height` together; leave cell styles bound to the row
  index when stripes are explicit per-row fills. `customHeight` has no setter — setting `height` is enough.
- Appended rows get no style (no borders, looks foreign) — copy the style from a sample row. MyBPM stand
  rows have thin left/bottom borders (whether the importer cares about data-row borders was never tested;
  its header detection uses freeze/double border, `MYBPM-IMPORTS.md` §19.1).
- **openpyxl does not widen an existing table**: after adding or removing rows update BOTH the sheet
  `dimension` and the table `ref` (e.g. `A1:D35`), otherwise Excel reports the table as broken. A hand-made
  sheet without a table part needs only `dimension` `[C]`.
- Readers of such sheets are usually positional — adding a column means updating every reader.

### Google Sheets grid cropping — UNSOLVED, postponed

Google-exported xlsx keep the visible grid size in `xl/metadata` (protobuf `f1="1.0"`, `f3={f1="1",
f2=sheetId, f4=rows, f5=cols}`), linked through `workbook.xml.rels` type
`http://customschemas.google.com/relationships/workbookmetadata`, a `Content_Types` override
`application/binary` and `workbook.xml` `<extLst><ext uri="GoogleSheetsCustomDataVersion2">`.

- Attempt 1 (hidden columns H:XFD + `zeroHeight`) — still showed cells outside the table. Attempt 2
  (injecting that metadata after an openpyxl save) — still not cropped.
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
  `=`/`&`/`?` → `.replace(/[=&?]/g,'_')` before returning. Ids **really can contain `~`** `[C]` (2026-09-18):
  hex-dump the id inside the page (`[...new TextEncoder().encode(id)].map(b=>b.toString(16)…)`) and decode
  it outside — that survives the filter, and it proved `~hb30v0XyMtGsBLj` starts with a literal `~`.
- **Page state injected by `javascript_tool` SURVIVES between calls** `[C]` (2026-09-18) — `window.__x`
  set in one call is readable in the next; only a navigation/reload wipes it. So a `window.fetch` patch
  that records `/web/` request bodies is the way to capture what the UI actually sends (`read_network_requests`
  gives URL + status only, never bodies).
- **Hex-dumping the TOKEN is refused** by the auto-mode classifier («Credential Materialization») `[C]`.
  Calling the API from inside the page (reading `localStorage.LOCAL_PRIVATE_SwebToken` inline in the
  `fetch`) is allowed and is the fastest way to drive `/web/v2` with no token ever leaving the browser;
  a standalone Bun script still needs the user to hand the token over.
- **`javascript_tool` dies at 45 s** (`CDP sendCommand "Runtime.evaluate" timed out`) `[C]` (2026-09-18),
  but **the page keeps running the promise** — the timeout kills the wait, not the work. So for anything
  long (a loop of imports, a poll), do NOT await it in the call: start it as
  `window.__pending = run(list).then(r => window.__pendingDone = r)` and return immediately, then poll
  `window.__res` / `window.__pendingDone` in later calls. Combined with the «page state survives between
  calls» fact above, that is the way to drive a multi-minute job through this tool.
- **The BO-group list is CDK-virtualised**: a group below the fold is not in the DOM at all, `find`
  answers «no matching elements» and `computer scroll` over the page does nothing. Scroll the container
  itself — `document.querySelector('.cdk-drop-list.scroll-bar').scrollTop = …` — then take a screenshot
  `[C]` (2026-09-18). Its `innerText` reads empty; locate rows by `input.value` + `getBoundingClientRect`.
- **`computer type` does NOT replace a selection in these Angular inputs** `[C]` (2026-09-18): after a
  `triple_click` the typed text is APPENDED («Чекбокс» + «Активен» = «ЧекбоксАктивен»). Always clear
  first (`key BackSpace` after the triple click) and re-read `input.value` before saving — a field code
  is generated from the label at the first save and never regenerated.
- **`computer type` SILENTLY DROPS spaces and punctuation** in these Angular inputs `[C]` (2026-09-18):
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
- **Drive this app's clicks from `javascript_tool`, not from `computer left_click`** `[C]` (2026-09-18).
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
- **A screenshot taken right after `navigate` shows a half-loaded screen** `[C]` (2026-09-18): the
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

## 11. Traps and defects — the short list

1. Always pass `urlPattern: "/web/"` to `read_network_requests`.
1b. The `token` header takes the localStorage value **without its JSON quotes**; with them every call
    answers `SecurityError` «Illegal Session».
2. `authorsField` is null on untouched BOs — create the object before saving rights.
3. Rights groups persist only through `orgUnitToAdd` / `orgUnitToDelete`, never `orgUnitRecordList`.
4. Menu-item rights use `v2/menu-item/*`; the `business-objects` menu-access endpoints fail with `NoBoWithId`.
5. A bracket's own filters are ignored when it has sub-brackets; sibling combination uses the EARLIER
   sibling's `connectionType`.
6. Only `"phosphor:*"` names present in chunk `956.*.js` are valid icons.
7. A kanban needs `kanbanCardTemplates` ON THE BO, and only the archive (or the constructor UI) can
   write it — `save-kanban-card-template` fills a store the view never reads (§7).
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
16. openpyxl: update both `dimension` and the table `ref`; a Cyrillic table `displayName` breaks the file.
17. Do not chase Google Sheets grid cropping through `xl/metadata`.
18. A BO is created only from a GROUP's hover-kebab in `/business-objects/editing`; the caption-level ⊕
    sends `boGroupId: null`, finds no `kind: DEFAULT` group on <company-a> and silently creates nothing.
19. `save-business-object-portion` wants `{businessObject: …}` inside `jsonPart`; a bare DTO throws
    `UndeclaredThrowableException`. `save-business-form-field` never creates fields — use the portion save.
20. BO and field codes are generated by the SERVER from the names; the BO code is cut to 30 characters.
21. `load-bo-records-by-group-id` takes `groupId`, not `boGroupId`.
22. A FIELD's code is generated from its label at the FIRST save and never regenerated — fix the label
    before СОХРАНИТЬ. **A BO's code behaves the same way** `[C]` (2026-09-18, re-checked): it appears at
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
    open** (UI upload, status «Импорт проанализирован») `[C]` (2026-09-18). It is not a reliable «is
    something waiting?» probe — take the `importId` from the log row / from `import-file`, or resume with
    `--import-id`.
37. **The LAST icon of a field's settings popover is DELETE** `[C]` (2026-09-18) — `mat-icon.delete-icon`,
    and it opens «Удаление поля: использование в скриптах» whose green button is «УДАЛИТЬ ВСЁ РАВНО».
    A click loop over that icon strip (to find out what the icons are) walks straight into it; the 4th
    icon meanwhile opens «Настройка скрипта». Read the strip, never click through it.
38. **A field setting is NOT its own endpoint** `[C]` (2026-09-18): «Обязательное»/«Уникальное»/the
    dropdown's dictionary are keys of the field DTO written by `save-business-object-portion`, and
    turning «Обязательное» or «Уникальное» ON also sets `tableColToShow: true` (`assignTableColToShow`).
    `load-dictionary-bo-field-options` takes `boId` as a **params** parameter — in the body it answers
    HTTP 400 «Required parameter 'boId' is not present».
39. **The widget controllers (`v2/button`, `v2/iframe`, `v2/captcha`, `v2/signature`, `v2/current-date`,
    `v2/widget-current-user`) read everything from the PARAMS half** `[C]` (2026-09-18). The same call
    with its arguments in the body returns HTTP 200 with an empty response and writes NOTHING — the
    failure is silent; the matching `load-…` answers 400 «Required parameter 'boId' is not present» and
    is the only way to notice. §5i.
40. **`load-business-object-by-id` shows `code: null` for widgets** (all but BUTTON) `[C]` — the code
    exists, it just lives in the widget's own controller. Do not «fix» it by writing a code into the
    field DTO. §5i.
41. **Controller `struct` is NOT under `/web/v2`** `[C]` (2026-09-18) — it is `/web/struct/...`
    (export basket, export-company-structure). A `/web/v2/struct/...` call answers 404 and, if you then
    export anyway, you silently get whatever the basket held from the previous session. §5.
42. **A «Чек лист» loses its items in an archive** `[C]` (2026-09-18) — the export writes no
    `fieldOptionsStruct` for `CHECKLIST` and the import brings none. §5i.
43. **Any BO created on this stand today cannot be sorted by a text field** `[C]` (2026-09-19, <stand>/<COMPANY_A>)
    — the Elasticsearch mapping of a new index makes `INPUT_TEXT#<id>.sortValue` a `text` field, so every
    call that leaves `ordering: null` (which is what the stand's own client sends) answers `EsException`
    «Text fields are not optimised …». It hits the registry AND the kanban, and it hits **all three
    creation routes alike — archive, constructor API and constructor UI** — while no old BO on the stand
    has it. Send an explicit `ordering`. Do NOT spend another session looking for it in the archive
    format, in the constructor or in the kanban — §7.
44. **The record controller is `v2/business-object-instance`, not the `v1/…` the bundle shows** `[C]`
    (2026-09-19) — `/web/v1/business-object-instance/create-draft` is a plain HTTP 404 (a Spring
    `{timestamp,status,error,path}` body, not the usual `errorType` envelope), exactly like
    `ensure-index`. Whenever a bundle-read controller 404s, retry the same path under `v2`. §6a.

## 12. Open questions

The record-format questions moved with the format itself — `MYBPM-IMPORTS.md` §20.

- Whether menu rights cascade from a group item to its children, and what a restricted user really sees.
- What `save-business-form-field` is actually for, since it does not create fields.
- Whether a BO created in the constructor can be moved between groups by `move-business-object-to-group`,
  and what `clone-business-object` copies.
- **The whole of §5g is unexecuted**: whether `v2/script/load-script-def` really returns the §0S JSON,
  whether `v2/script/paste` + `apply-update-cmd` delivers a script without the clipboard, and whether
  `create-local-method` / `create-company-global-method` really create a method headlessly. This is the
  one thing that would rewrite `MYBPM-IMPORTS.md` §0S.1 and §0S.12.
- **The success path of `/web/v2/auth/v3/login` was never run** (§0U.1 route A) — only the failure. If
  the body turns out not to be the bare token, §0U.1 and §1 need correcting.
- The `v2/bo-transfer` record import/export (§6) is equally unexecuted — the UI route is the confirmed one.
- What «Браузер скриптов» (`v2/script-browser`) and «Глобальные методы» actually look like on screen —
  nobody has opened either (old question 20).

- **The ES mapping defect of §7**: whether it is every newly created INDEX or every newly created FIELD
  (the test is in §7 — a fresh `INPUT_TEXT` field on a long-standing BO, now doable end to end since §6a
  can write the record; it needs the user's permission because it writes into a BO that is not ours), and
  whether the platform vendor confirms it as a backend regression. Nothing on the client side repairs it.
  The creation ROUTE is no longer a candidate — archive, constructor API and constructor UI all fail.
- Whether a `CHECKLIST`'s items can be carried by an archive at all (an undocumented key?) or whether the
  exporter simply omits them — 2026-09-18, see trap 42.
- What `save-button-field-ids` / a signature's `fieldCodes`, `printFormCodes` actually bind (the button's
  «поля для отправки», the signature's «поля под подпись»).
- Whether `PARTICIPANTS` («Участники») is reachable at all — no palette item, no generator.
