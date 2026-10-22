# MyBPM stand — browser UI and REST API reference

**STOP — read before you act.** This file is about 5000 lines and the user's spec may be several pages. Read
the spec in full — every page, every table — and the whole of §0U down to and including «0U.6 Self-check
before you say it worked» BEFORE the first call — and before asking anything. **If you read in chunks (a
`limit` of a few hundred lines), ONE chunk is never enough:** call the reader again with `offset` = the line
after the last one you got, until that heading has scrolled past. A PDF read by page ranges: up to its last page. Every endpoint, payload key and enum value you
send is printed in this document (or found by 0U.3) — copy it; a name that merely looks right is invented,
and the stand answers it with an error or silently ignores it.

How to drive a running MyBPM stand: the `/web/v2` REST envelope and the endpoints found so far (access
rights, menus, kanban), the constructor/registry UI screens behind them, **record (instance) import and
export through Excel**, the HTML sanitizer, and the tooling around all of it (xlsx patching, Google Drive,
browser automation).

The FORMAT of everything you feed a stand — the structure archive, Block IDE scripts and the xlsx of
records — → `MYBPM-IMPORTS.md`. This document is the transport and the stand itself.

**If your task is «do something on a live stand», read §0U and nothing else.** It is a self-contained
cookbook: how to authenticate, one complete request with its complete answer, how to find an endpoint
this document does not list, and then a numbered recipe with literal payloads per task (create a BO of
any of the five kinds, import a structure archive, hand out rights, build a menu, import records from
Excel, export). Sections 1–12 are the material for non-trivial cases; §0U is
enough to drive a stand. Its counterparts for files are `MYBPM-IMPORTS.md` §0 (archives), §0S (Block
IDE scripts) and §0X (records in xlsx) — the four cookbooks are independent, read the one you need.

**Placeholders.** This document describes the PLATFORM, not one installation of it, so every host and
company name is replaced by a placeholder: `<stand>` is the host of a MyBPM stand (an archive never
carries it — the user is the only source, §0U.1), `<company-a>` … `<company-d>` are companies
(tenants), and `<COMPANY_A>` is the `companyCode` of `<company-a>`.
`<company-a>` and `<company-c>` live on the same `<stand>`. Where a fact depends on WHICH installation
it came from, the origin mark carries the platform build instead of a name. The document describes the
LATEST platform implementation, so it carries no dates.

**A tenant's display name and its `companyCode` are different strings** `[C]`
(`GET /web/v2/auth/load-auth-info` → `{companyId:"…", companyCode:"<COMPANY_A>", …}`): a company
answers a code that may look nothing like its name. Do not take that code for a second company.

**Status markers**: `[C]` confirmed on a stand, `[I]` inferred, `[U]` unverified.

**The stand does something else than this document says → report it.** Only on the latest release (the
plugin version — the SKILL.md beside this file names it, so does the MCP server — equals `version` of `.claude-plugin/plugin.json` on `main` of `dmezhnov/MyBPM`;
an older copy → update and re-check first, the fact may be fixed). Search the open reports first
(`https://github.com/dmezhnov/MyBPM/issues?q=is:issue+label:platform-discrepancy`) — a known one gets a comment,
not a twin. One fact per issue, de-identified: placeholders (`<stand>`, `<company-a>`, `<user>`) for every host,
company, login and person, no record data. Show the user the text and get their OK — the repository is public.
The issue form takes its fields from the URL: `https://github.com/dmezhnov/MyBPM/issues/new?template=platform-discrepancy.yml`
`&title=…&document=MYBPM-UI-API.md&heading=…&mark=[C]|[I]|[U]|none&doc_says=…&stand_did=…&repro=…&version=…`
(URL-encoded, under ~7 500 characters); the user opens it and presses «Submit new issue» under their own GitHub
account. The `mybpm-stand` MCP server's `platform_report` builds that URL and refuses a text that names the
user's own stands or accounts.

---

## 0U. COOKBOOK — drive a running stand from this section alone

**Read this section if your job is «do X on a live MyBPM stand»** — create a business object, import a
structure archive, hand out access rights, build a menu, import records from Excel, or read any of it
back. It is self-contained: the transport, the authentication, one complete request with its complete
answer, and then one numbered recipe per task with literal payloads. Sections 1–12 are the material
for exotic cases; this one is *what to send*.

Two rules that apply to every recipe:

- **Everything here is plain HTTP; tools are optional.** Every step below is executable with `curl` or
  `fetch` and nothing else. The `tools/*.bun.ts` scripts named next to a recipe come from the repository this
  document belongs to and are NOT shipped with it. **If they are available, prefer them** — they make exactly
  these calls and check the answers; if not, follow the text — the result is the same. The same holds for
  the **`mybpm-stand` MCP server**: its tools connected → §0U.8 says which recipe each one makes.
- **Never infer the result of a call — read it back.** Every recipe ends with a verification step that
  says which call to make and which field to compare. The stand answers HTTP 200 to a great many things
  it did not do (§0U.2).


### 0U.1 What you must have before the first call

Ask the user for these, one request at a time, and wait for the answer:

1. **The stand URL** — e.g. `https://<stand>`. Everything below is `POST <stand>/web/…`.
   An archive or an export never carries the host; the user is the only source.
2. **The company (tenant)** — one host serves several: `<stand>` serves both `<company-c>` and `<company-a>`.
   The tenant is selected by the credentials/token, not by a header or a parameter, but you need its name
   to talk about it and to know which sidebar you are looking at. **Never assume a screen or a BO group
   exists because another company on the same host has it.**
3. **Authentication**, one of the two routes below. With the `mybpm-stand` MCP server connected there is
   nothing to ask: it holds the accounts (§0U.8) — `stand_list` names each account with its stand and company; an account
   it does not hold yet is added by the user on its accounts page (`stand_accounts`), never through the chat
   (a local stand — `localhost` — may also be added with `stand_account_save`, which takes the password).

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
- **The response body IS the token** `[C]` — a JSON string (`"abc…"`, ~236 bytes with the quotes); **strip the
  quotes** and send the rest as the `token` header of every later call (with the quotes: `SecurityError`
  «Illegal Session», as in route B). `GET /web/v2/auth/load-auth-info` with that header names the user
  and lists their `functionCodes` — the quickest check that the login landed on the intended account.
- Wrong credentials answer **HTTP 200** with
  `{"message":"Не верен пользователь и/или пароль","errorType":"IllegalLoginOrPassword",…}` `[C]`.
  So a failed login looks exactly like any other
  error (§0U.2) — check `errorType`, never the HTTP status.
- `POST /web/v2/auth/load-token` (empty params and body) returns the token of the CURRENT session, and
  `GET /web/v2/auth/load-auth-info` describes who you are. `GET /web/v2/auth/logout` ends the session.

#### Route B — take the token out of a logged-in browser

The **confirmed** route `[C]`:

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
- **A browser-automation tool may refuse to return the token** — some refuse any value derived from
  `localStorage` or from a response header (§10). Then keep the token INSIDE the page and call the API
  from there — the in-page helper of §10; a human (DevTools) or Route A gets a token for a standalone client.

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
{"id":"OpmGDzaQRUT27jky","name":"Проба UI","code":"Proba_UI",
 "boCategory":"BO","isDictionary":false,"formFields":[…],"nameMap":{"KAZ":null,"ENG":null,"RUS":"Проба UI","QAZ":null},…}
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
2. `runtime.*.js` contains ONE object literal `{<chunkId>:"<16-hex hash>",…}`. Parse it and fetch every `<stand>/<chunkId>.<hash>.js`. The app code is in those lazy
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

1. **Resolve the group.** `load-bo-groups` — `P {"forEdit":true}`, `B {}` → `[{id,name,code,orderIndex,kind}]`
   (without `forEdit` the groups that hold no BO are left out `[C]`).
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
   16-character uniquifier to the just-generated code («Test_koda_4HXpmEa21vtnNLVsl»), and a
   BO code is **never regenerated** afterwards (trap 24).
5. **Read the BO back** — `load-business-object-by-id` — `P {"businessObjectId":"<boId>"}` → the full
   constructor DTO. You need it whole for step 7.
6. **Generate one field per field.** `generate-business-form-field` —
   `P {"boId":"<boId>","fieldType":"INPUT_TEXT"}` → a ready ~60-key field DTO with a
   fresh `fieldId` and `code: null`. Set exactly three things on it and touch nothing else:

   ```json
   "label": "Наименование",
   "labelMap": {"KAZ":null,"ENG":null,"RUS":"Наименование","QAZ":null},
   "gridPosition": {"x":0,"y":<3·index>,"cols":15,"rows":3}
   ```

   **Omit a parameter you have no value for — do not send it as `null`**: the client drops null-valued
   parameters, so `fieldBoId` appears only for a nested object (`fieldType: "BO"`, R2 «Panel»).
   `fieldType` is the palette type — `INPUT_TEXT`, `INPUT_NUMBER`, `CHECKBOX`, `DATE`, `FULL_DATE`
   (**not** `DATE_TIME` — that name never existed), `INPUT_TEXT_LANG`, `STATIC_TEXT`, `BO`, … (the full
   enum with the palette labels is §5i «Field types — label → `fieldType`», which also covers widgets
   and system fields). `cols: 15` is
   the full form width, `rows: 3` one line (what the constructor itself assigns `[C]`; 4 leaves an empty band);
   short fields share a row (same `y`, `cols` 8 + 7 or 5 + 5 + 5), other types take other heights — see
   «Layout» below.
   **Get the label right the first time**: a FIELD's code is generated from its label at the first save
   and never regenerated (trap 22).
7. **Save the BO with the fields.** `save-business-object-portion` — `P {}`, `B` as in step 3, but the
   `jsonPart` JSON is now the FULL object:

   ```json
   {"businessObject": <the DTO of step 5 with the new field DTOs appended to formFields>,
    "editedFields": [{"fieldId":"<new id>","gridPosition":{"x":0,"y":0,"cols":15,"rows":3},"needFreezeWhenScroll":false}],
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
nothing (trap 19) — it is the registry-column writer (§5b). Accelerator: `tools/create-bo-constructor.bun.ts` (`--field "Метка:TYPE[@boId]
[#a|b|c][!req,uniq,readonly]"`, `--widget "TYPE:Метка[:код][:url]"`, `--native <NATIVE_TYPE>`).

**Layout — apply to every BO with a form, unasked** (same rules as `MYBPM-IMPORTS.md` 0.8 / 0.8a; there they
are archive keys, here they are keys of the field DTO and the calls named). Goal: no field stretched over
empty space, no wasted band, **no scroll inside a scroll**. «Visible field» = one a user of the form sees,
not counting headings, the `TAB_GROUP` and the system fields.

- **Heights** `[C]` (one grid row = 30 px): `rows` = **3** for a one-line input (`INPUT_*`, the date and time
  types, `DROPDOWN_SINGLE`, `CHECKBOX`), a one-line heading (4 rows leaves a band) and a `BO` / `CO` `SINGLE`
  reference (one line, no band); **6** for `TEXTAREA` / `TEXTAREA_LANG` (4 shows only about two lines of text),
  a `BO` `TABLE`, `LINK`, `FILE_UPLOAD`, `CHECKLIST`, `RADIO_BUTTON_GROUP`, `PROGRESS_BAR`; **8** for
  `QUESTIONNAIRE` / `GEO_POINT`.
- **Rows** `[C]`: a row is one or more cells with the SAME `y` and the SAME `rows`; `x` runs 0, 0 + cols …, and
  the `cols` of a row sum to 15; the next row's `y` = this `y` + this `rows` (a field on a tab counts `y` from 0
  on its tab). Short one-line fields that belong together stand 2 per row (8 + 7) or 3 (5 + 5 + 5) — телефон +
  email, дата + сумма, a `SINGLE` reference + a dropdown; a form of nothing but full-width fields is a defect.
  Alone at full width: `TEXTAREA`, a `TABLE`, a heading, a `TAB_GROUP`, `CHECKLIST`, `QUESTIONNAIRE`,
  `GEO_POINT`, `PROGRESS_BAR`. A short field with no partner stands alone at `x 0`, `cols 8`, never stretched — an exception, at most 2 per
  form (per tab): every field alone at `cols 8` is still the «one per row» defect;
  no cell of the row below may fit wholly into its free columns 8–14 — it would float up beside it — so under
  it goes a full-width row, a pair split 7 + 8, or nothing. Never mix heights in one row — the next row floats into the hole (§4 of
  `MYBPM-IMPORTS.md`). A `CHECKBOX` toggle sits a little higher than its row-mates' boxes — acceptable.
- **Registry columns**: `tableColToShow: true` on the name + at most 5 key values (status, date, amount, the main
  reference) — **6 columns at most**; every field as a column cuts each header to «Мар…». Turning `isRequired` /
  `isUnique` on switches the column on by itself — switch it off again if it would make a seventh.
- **Editor toolbar of a `TEXTAREA`, by meaning** `[C]`: `params.buttonTypes` (§5i «Per-type settings»); a
  comment, a note, a reason → `"[]"` — no buttons (a thin empty strip stays); a description a user formats →
  `["bold","italic","ul","ol"]`; the default ten only for rich content (a letter, an instruction).
- **Columns of a `TABLE`, by meaning**: 2–5 fields of the line BO with `toShow: true` — what the line is, then
  количество, цена, сумма, дата, статус; never one column. A `SINGLE` chip: the name, plus a field that tells
  records apart (номер, госномер) when the name alone does not.
- **Groups**: when the visible fields fall into two or more themes, open each with a heading — a `STATIC_TEXT`
  with `staticValueMap: {RUS: '<div style="font-size:18px;font-weight:700;color:#1f2d3d;border-bottom:1px solid #d9dee5;padding-bottom:6px">Тема</div>'}` (a bare `<h3><b>` renders as a small bold label, §8), `hideLabel: true`, `tableColToShow: false`, `rows: 3`
  `[C]` (2 scrolls inside itself; heading + subheading line = 4). The heading names the SECTION, never a field
  label of the BO (`SameBoFieldsLabel`, trap 14); every heading has at least one field under it, and one heading
  over the whole form groups nothing.
- **Tabs** (§5i «Tabs (`TAB_GROUP`) over the API») when the form has **more than 12 visible fields** or more than
  ~23 rows — also on a record opened as a page tab (`instanceViewType: "TAB"`); over 8 visible fields at least
  group headings: split by meaning, each tab ≤ 12 visible fields, **balance the tabs** — the group is as tall as its
  TALLEST tab `[C]`. Keep the name field above the group or on the first (default) tab. Codes `tabs`, `tab_*`
  (0U.5 rule 12). Nested tabs (a second `TAB_GROUP` on a tab) only when one tab still holds > 12 visible fields
  AND ≥ 3 groups. Group `rows` `[C]`: top-level = tallest tab + **3** (+ **6** on a page tab `instanceViewType: "TAB"`: there the group's box is `(rows − 1)·30 − 111` px, + 5 scrolls), nested =
  tallest tab + **2** («rows of a
  tab» = `max(y + rows)` of its fields); one row less scrolls inside the group.
- **System fields → the hidden tab «Системные»**: every field only a script, process or integration reads or
  writes goes on a tab with code `tab_system`, label «Системные», the LAST tab of the top-level `TAB_GROUP`
  (`isDefault: false`); a form with no other tabs gets a `TAB_GROUP` holding only that tab, placed UNDER the
  ordinary fields. Close the tab with VIEW «никому» (R5 step 6: `save-field-tab-access-group`, `view.accessForAll:
  false`, no units; then `save-bo-field-tab-chosen-access-right` `chosenAccessRight:true`). A non-admin does not
  get a lone group whose every tab is hidden `[C]`; the window keeps the `h` that counts it, so they see an empty
  band `[I]` — keep the system tab short. Never put a field a user must fill there; hidden is not secret (R5 step 6).
- **The record window** `[C]`: `save-business-object-grid-layout-position` BODY `{boId, gridLayoutPosition:{id:"0",
  x, y, w, h}}` (§5i «Size of the child's record dialog»). **`h` = form rows + 5** (form rows = `max(y + rows)` of
  the top-level cells, a `TAB_GROUP` counted with its own `rows`); the dialog is capped at 90 % of the screen
  (~28 units on 1080p), so > ~23 rows needs tabs. `w: 10` for a form of one-line fields, 12–15 only for tables or
  several fields per row; `x = ceil((16 − w) / 2)`. A BO opened from another BO's reference/table gets `w` at least
  2 less than its parent. With a lot of content (several tables, still > ~23 rows after tabs) open the record as a
  page tab instead (§5j «Карточка/Вкладка», `instanceViewType: "TAB"`).

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

How to BUILD the archive → `MYBPM-IMPORTS.md` §0. This is how to ship it. MCP connected → `import_analyze`
(steps 1–4), `import_apply` (5–7), `import_rollback` (§0U.8). The controller prefix is
**`import-structure`**, not `v2/…`: `POST <stand>/web/import-structure/<method>`.
**Only one import may be open on a company at a time.**
**Any user of the company may run it** `[C]`: the API checks no rights — only the UI hides the import page from a non-admin.

1. `POST /web/import-structure/import-file` — **multipart**, the zip under the field name `file` → `"<importId>"` (bare string).
   **The filename must end in `.mybpm.zip` or `.mybpm`** — any other name is rejected with «Расширение файла
   должно быть…» `[C]`; beyond that it is only what the import log shows.
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
   **Read this before applying — all three, an empty `errorRecords` alone is not a guarantee.** The analysis
   errors of the UI «Ошибки» tab come back in `load-import-errors` of the SAME `importId` `[C]` (another
   import's errors look empty); an analyzer crash is not an error
   record but `load-import-data` → `status:"INTERNAL_ERROR"` + a Java stack in `error`; and errors raised
   only while APPLYING never reach either — they are in the apply process (trap 57).
   **A process's `PROCESS_STATUS` field reported «В системе не найден бизнес объект, на который ссылается
   поле»** = the company has never had a process, so the «Статус процесса» dictionary does not exist yet:
   cancel, create any process with `create-bo {boGroupId, boCategory:"BO_PROCESS"}` (R2), delete it with
   `delete-business-object` — the dictionary stays — and import again (§5f) `[C]`.
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
   last — read §5 «Rollback trap» before undoing anything but a single import. A rolled-back BO is deleted
   SOFTLY: an archive with the same `oldId` revives it with all its old fields (§5 «A deleted BO comes back»).

Traps: **`load-import-state` is not a reliable «is something open?» probe** — it answered
`{"importExists":false}` while an analysed import was waiting (trap 35). Take the `importId` from
`import-file` and keep it. Accelerator: `tools/api-import-structure.bun.ts`.

#### R4 — Read anything back (the verification toolbox)

Use these instead of screenshots; several of these screens are invisible to text extraction anyway.

All of these but the last are `POST /web/v2/business-objects/<call>` (envelope §10) `[C]`; without the
`v2/business-objects/` prefix they answer 404.

| question | call | params |
|---|---|---|
| which BO groups exist? | `load-bo-groups` | `{"forEdit":true}` — **without it the empty groups are missing** `[C]` (optional `searchValue`) |
| what is in a group? | `load-bo-records-by-group-id` | `{"groupId":…}` — **`groupId`**, not `boGroupId` |
| what is this BO? | `load-business-object-by-id` | `{"businessObjectId":…}` |
| id of a BO whose code I know | `load-bo-id-by-code` | `{"boCode":…}` |
| name only | `load-business-object-name` | `{"boId":…}` |
| the BO's fields | `load-bo-fields-for-drag` | `{"boId":…}` — `code` comes back `null` here, identifies by label |
| the dictionary options of a field | `load-dictionary-bo-field-options` | `{"boId":…}` |
| how many records match a filter | `v2/business-object-instance/load-bo-instance-bracket-table` | see R6 |

**The archive's `oldId` becomes the BO's real id on the stand** `[C]`, and an
imported field/tab id equals the archive's `newId`. That is how a generated archive and later API calls
are stitched together. A BO created in the constructor gets a platform id instead — ids are 16 characters
over `A-Za-z0-9@~`, so **an id really can start with `~` or contain `@`**; do not "clean" them.

#### R4a — EXPORT a BO's structure (or menu items) through the API `[C]`

The reverse of an import, and the only way to read the real serialization of something built by hand
(`kanbanCardTemplates`, `MenuItemStructDto`). Controller **`struct`** — a
basket the stand keeps per user, then one download (MCP connected → `structure_export`, §0U.8). **The controller is `/web/struct/<method>`, NOT under
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

- **An export taken right after a rights write may come out without the `AccessStructDto`** `[I]` (the same
  late write as R5's read-back): check the DTO tally and export again.
- **Read the basket first and restore it afterwards** — it is the user's own selection on the
  «Импорт/Экспорт» screen, not scratch space.
- **Both basket writes work over the API** `[C]`: **`remove-*` takes an array of id STRINGS**
  (`["zm8ufIOguCPru0bu"]`), not the records that `save-*` takes. Sending records to `remove-*` — with or
  without the `isMenuExport:true` flag the basket adds — gives HTTP 400 «Failed to read request».
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
  see §5o (`SCRIPT_SETTINGS`) and §5n «Every kind of the settings basket».
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
   **A BO's lock only turns ON** `[C]`: the same portion with `false` is ignored and no other call turns it off
   (the UI never sends `false`) — after a reset to «все» the BO keeps the lock; it marks the BO, the actions decide.
   **A read right after a save may still answer the old rights** `[C]` — read again after a second or two before
   calling a save lost.
6. Field-level and tab-level rights are the same shape on
   `load-field-access-group` / `save-field-access-group` — `{businessObjectId, fieldId, accessGroup}` (only
   `view` and `edit` matter) — and `load-field-tab-access-group` / `save-field-tab-access-group`
   (`+ tabId`). An unknown `tabId` answers `view.accessForAll:true, authorsField:null`, so a «никто»
   answer can be real. **A tab has only the VIEW right** `[C]`: VIEW «никто» on a tab hides the tab from
   every non-admin AND drops its fields from their registry columns; a non-admin's save keeps the hidden
   values; **an admin still sees the tab and its columns** `[C]`. The form learns it per user: the
   `TAB_GROUP` entry of `v2/instance-field-form/load-field-data` lists in `tabs[]` only the tabs that user may see
   (`load-field-structure` still lists every id in `tabIds`), and a group with no visible tab is missing from
   `v2/instance-form/load-field-structure` altogether `[C]`. **Hidden is not secret** `[C]`: the rule only filters what the form and the registry draw — a non-admin still reads the tab's values through the API by its tab id (`v2/business-object-instance/v2/load-boi-values` with `tabId`, `v2/instance-form/load-field-structure-tab` + `v2/instance-field-form/load-field-data-tab`). Never put a password, a key or a personal secret on «Системные». That is the hidden system tab «Системные»
   (`tab_system`) every form gets for its technical fields (`MYBPM-IMPORTS.md` §0.8a step 6).
7. **Verify** by calling `load-access-group` again and comparing — this is the one area where the UI
   silently sends nothing when it thinks nothing changed. What each subject really opens (field content,
   author, participants) is the table in §3 «What each subject opens» `[C]`; checking it needs a second,
   NON-admin login (§0U.1 route A) — an admin sees every record whatever the rights say.

#### R6 — A sidebar menu item and a record filter

Controller **`v2/menu-item`** (the `business-objects` menu-access endpoints fail with `NoBoWithId`).
**Or ship the items IN the structure archive** `[C]`: a `MenuItemStructDto` line per item,
everything by code, the item's views (list, kanban) included (`MYBPM-IMPORTS.md` 0.5d, 0.15 / §5e) — then R3
alone builds BO + menu (+ kanban), and a rollback of that import removes the menu items too. The API
route below is for items on BOs that are already on the stand, and for access rights.

1. Mint an id: `POST /web/v2/id-loader/load-portion` → an array of ids.
2. `create-menu-item` — `P {}`, `B` = the item itself:
   `{"id":…,"type":"GROUP"|"BO","displayName":…,"displayNameMap":{"RUS":…},"boId":…,"iconName":…,
   "orderIndex":100000,"isPanel":false,"boPages":{…},"chosenAccessRight":false,"parentId":…}`.
   `iconName`: an icon BY MEANING for every item, unasked (§4 «Icons by meaning»); the generic defaults
   GROUP `bo-g-draggable`, BO `man-with-company`, dictionary `bo-d-draggable` only when the user wants no icons.
   The built-in root «Системные» has `orderIndex` 60000 — put your own roots after it.
3. Icons: `save-menu-item-icon-name` — `P {"menuItemId":…,"iconName":"<namespace>:<name>"}` → empty
   body (or set `iconName` right in `create-menu-item`). **Take the name from §4 «Menu icon catalogue»**
   (`phosphor:*` or `menu-item:*`, 1153 names): the server stores ANY string, and a name outside the
   catalogue gives an item with no icon at all.
4. Rights: `load-access-group` / `save-access-group` on **`v2/menu-item`** — `P {"menuItemId":…}`, body =
   the access group (same shape as R5); then `save-menu-item-chosen-access-right` —
   `P {"menuItemId":…,"chosenAccessRight":true}`. Only `view` matters for navigation. **Rights do not
   cascade** `[C]`: each item is filtered by its OWN rights — set them on every item you want hidden
   (§4 «Menu-item rights»).
5. A record filter: `load-bracket-filter` — `P {"menuItemId":…}` **creates** the filter record if it is
   missing → `POST /web/v2/bracket-filter/save` — `B {"id":…,"boId":…,"brackets":[<root>]}`. A bracket is
   `{id,parentId,parentTreeIds,connectionType,notType,dynamicFilters,nativeFilters,brackets}`.
   Semantics: filters inside ONE bracket are AND-ed; **a bracket's own filters
   are IGNORED if it has sub-brackets**; siblings combine by the EARLIER sibling's `connectionType`. The
   value of each filter type (a local dropdown takes the option ID, a user field takes field REFS) and «пусто
   does not filter»: §4 «Record filters».
6. **Verify a filter without saving it**: `POST /web/v2/business-object-instance/load-bo-instance-bracket-table`
   — `B {"boId":…,"dynamicFilters":[],"nativeFilters":[],"search":"","paging":…,"ordering":null,"state":"ALL","brackets":[…]}`
   → read `totalHits`. `state` takes the `BoiState` values `ALL|ARCHIVED|REMOVED|OFFLINE|DEV` (the registry tabs) `[I]`.
7. `delete-menu-item` — `P {"menuItemId":…}`; `load-nav-items` — `P {"parentId":…}` → the children.

#### R7 — Records (instances) from Excel

**Records never travel in a structure archive** — they are xlsx imported into a BO registry. The file
format is exacting: step 2 below carries what a template fill needs (the full format, same rules, is
`MYBPM-IMPORTS.md` Part III, §0X cookbook). The API is
`v2/bo-transfer` — template, upload, act, apply and export `[C]` (driven from a page of the stand, §10):

1. `GET /web/v2/bo-transfer/download-template?businessObjectId=<boId>&selectedFieldIds=<id>&selectedFieldIds=<id>…` — an
   ordinary GET with query parameters and the `token` header (no envelope) — **one `selectedFieldIds` per
   field**; a comma-separated list fails `NullPointerException … colHeader is null` — returning the xlsx `[C]`: the
   header rows only (one row, or two with merged nested blocks and freeze at A3), no data rows, no table
   part. Field ids come from `load-business-object-by-id` → `formFields[].fieldId`. The columns follow the order
   of the `selectedFieldIds`; a selection the stand cannot parse gives every field in form order `[C]`. **Take a fresh template after
   every structure change**: the columns follow the BO, and their positions move between exports.
2. Fill it. The three rules that break the most files: every cell must be an **inline string** (a numeric
   `103` becomes «103.0» and breaks lookups); the header must have **frozen rows** (or a double bottom
   border in column A) or the whole file is rejected; dropdowns match **by label**, references by the
   target's **unique field or an `ID` sub-column** — and the referenced records must already exist.
   A sub-header is the target's own label WITH its tab prefix, as the template writes it
   («Пользователь.Почта» for a Person block on a stand whose Person fields sit on a tab; a bare «Почта» or
   «Email» rejects the file with `NoFieldWithLabel`) `[C]`. A sub-column may name a field the reference
   hides (`toShow:false`): a block showing only a non-unique field links once you add the unique field's
   sub-column by hand — its template and export never carry it `[C]`. A Person block links by its e-mail
   sub-column alone `[C]`. **`isReadonly` fields are written**
   on create and update and cleared by a blank cell `[C]` — drop their columns unless you mean to overwrite.
   The rest of the format a template fill needs (same rules as `MYBPM-IMPORTS.md` 0X.2–0X.4) `[C]`:
   - **Ask the user first** for the template (or a registry export) of the target BO, its **unique field** (or an
     own field labelled `ID`) — without one every row CREATES and a re-run duplicates, so say the file is
     create-only and get a yes — and the existing dictionary values of every dropdown column.
   - **Layout**: one sheet `Sheet0`, `sharedStrings.xml` empty; header row 1, or rows 1–2 when the BO has a nested
     object (row 1 a merged block caption, row 2 the target's sub-headers; other columns merged A1:A2; freeze at
     A3); a sheet with neither freeze nor double border dies with `kD4QsxZrAY` «Система не может отделить строки
     заголовка от строк данных». Keep the table part `xl/tables/table1.xml` consistent with `dimension` (§9).
   - **Map columns by LABEL, never by position**: a column is the (row-1 block, row-2 field) pair; split a row-1
     label on the FIRST dot — the prefix is the tab («Системные.Код»), the rest is the field label after strip.
   - **Values**: checkbox `Да`/`Нет`; date `dd.mm.yyyy` with a four-digit year (parsed leniently, §6);
     date-time `25.10.2025 10:33`; period `dd.mm.yyyy - dd.mm.yyyy`; numbers and codes as text; a dropdown by its
     LABEL (`NotFoundDictByLabel` when the value is not on the stand); dictionary codes are case-sensitive
     (`MRP` ≠ `mrp`).
   - **A TABLE nested object = the parent row REPEATED**, one row per child (the parent's scalars on every row is
     safe). A target with no unique field links only by an `ID` sub-column; a missing target fails the row with
     `NoUniqueFieldValue` (the rest imports) — **a nested block never creates targets**, and never resolves
     against rows of the same file: split self-references into a later file.
   - **No label may repeat another field's label** — a «Текст» heading named like a field rejects the file with
     `SameBoFieldsLabel` (labels are matched across ALL fields, any tab).
   - **Read the finished file back** and rebuild the data model from its cells before uploading.
3. `POST /web/v2/bo-transfer/import-from-file` — **multipart**, file under `file`, plus the form field
   `businessObjectId` → a bare `"<actId>"` string (no envelope on this call: plain multipart, `token`
   header).
4. `is-import-file-finished` — `P {"actId":…}` → `true` when done; then `load-import-file` — `P {"actId":…}` →
   `{importId, total, newRecords, updatedRecords, errorRecords, fileError}` (`importId` = the actId). **Nothing
   is written yet** — this is the same two-phase shape as R3. **The counts are ROWS, not records** `[C]`: a new
   record on two rows (a TABLE block with two links) counts 2 in `newRecords` and is created once, with both links.
   **A header error comes back from `is-import-file-finished` itself** `[C]`: instead of `true`/`false` it
   answers an error object whose `message` is the reason («qy7G90BqN7 :: Ошибка при импорте данных: Нет поля с
   именем 'Почта' в бизнес-объекте 'Пользователи'») — stop polling on anything that is not a boolean, or the
   loop spins forever.
5. `apply-imported` — `P {"importId":…}` writes (answers `""`); poll `watch-import-finished` — `P {"importId":…}`
   → `true`; `cancel-imported` drops it; `imported-ok` closes it;
   Before applying, read each row's error with `load-bo-import-table` — `B {"importId":…, "paging":{"offset":0,"limit":10}}`
   → `{heads, records:[{hasError, errorText, values}], emptyExplain}` `[C]` (params instead of body → NPE): `heads` are the
   column captions as strings, `values` align with them. A dropdown label not on the stand fails its row with
   «Не найдено значение `X` в поле `Статус`. Это поле должно содержать одно из следующих значений: …», the rest
   imports. `emptyExplain` («Поле не заполнено, потому что не найдено уникального значения для связанного
   объекта …») lists every sub-column of a block even when the link resolved — not an error. `cancel-imported`
   and `apply-imported` answer `""` `[C]`. `download-errors` is a
   GET `?importId=` (POST → 405); after an apply it returned the header only, no rows `[C]` — do not rely on it.
6. Export: `export-bracket-bo` — **B** = the registry filter plus the selection:
   `{boId, dynamicFilters:[], nativeFilters:[], brackets:[], search:"", paging:{offset:0,limit:50},
   ordering:{fieldId:"",state:"UNSET",archetype:null}, state:"ALL", boInstanceIds:[…], boFieldIds:[…],
   needBoiId:true}` → a bare `"<exportId>"`; `is-bo-export-file-ready` — `P {"exportId":…}` → `true`;
   `load-bo-export-file` — `P {"exportId":…}` (envelope) → the xlsx bytes. **`paging` is ignored** — every
   record of the filter goes into the file; `boInstanceIds` and `search` do filter `[C]`. A TABLE block in the
   file = the record REPEATED, one row per link, its scalars and SINGLE blocks on every row and no merges in the
   data rows `[C]` — rebuild the records by «Внутренний айди» (or the unique field). **`needBoiId:true` adds a last
   column «Внутренний айди»** holding each record's id — **a re-import does NOT match rows by it** `[C]`:
   the header is accepted and the value ignored; re-importing its own export into a BO with no unique field
   creates a duplicate record. Rows match by the unique field only (`MYBPM-IMPORTS.md` §19.5). In the UI it
   is the «Внутренний айди» checkbox of «Экспорт в .xlsx» — administrators only, off by default.
   **`boFieldIds` decides the columns** `[C]`: a non-empty list = exactly those fields in that order; an
   EMPTY list = every field except `TAB_GROUP`, including `STATIC_TEXT` (its text in every row) and fields
   with `tableColToShow: false`. The UI's «Экспорт в .xlsx» (registry kebab; under browser automation its
   download may not reach a readable folder, as with the structure export — use these calls, §10) is a chooser over the same
   fields, pre-ticked with the registry columns; it sends what is ticked, in ticking order. No field flag
   hides a field from an API export — list the fields you want. **An EMPTY list exports the nested blocks
   EMPTY** `[C]`: their caption and sub-headers are there, every sub-cell is blank and a TABLE reference is
   not expanded into repeated rows, although the links exist. To read links back from a file, always list the fields.
   A sub-column that is itself a reference (a nested reference inside the target) is in no template and
   no export: the stand drops it from the block (`MYBPM-IMPORTS.md` 0X.4 rule 6).
7. **Verify** by exporting the registry again and rebuilding the data model from the cells. **File order
   matters**: users → groups → dictionaries → records → link files, and a reference resolves only against
   records that were on the stand BEFORE the file was imported.

**A blank cell CLEARS the field** on an existing record (text, number, checkbox, dropdown, textarea —
   `DATE` excepted — no cell value clears a date: blank or spaces keep it, `-`/`null`/`0` fail the row, so empty a date with §6a `value: null`), whether the cell is empty or absent from the row, and the act still says «обновлено»
   with 0 errors; **a column missing from the file KEEPS the field**. To update a few fields, ship only
   those columns plus the key. After removing columns re-letter the cells contiguously — a header with
   skipped letters misread the next column `[C]` (`MYBPM-IMPORTS.md` §19.6).
**A nested block links, it never edits and never unlinks** `[C]`: only the unique (or `ID`) sub-column is
   read, the other sub-columns are NOT written into the child and the child's other fields stay intact; an
   EMPTY block keeps the existing link (unlike a blank scalar cell); on an update a SINGLE block replaces
   the link and a TABLE block only ADDS children. A child found by a non-unique sub-column alone is not
   linked, with no error.
**Never write a column for the SINGLE side of a two-way link** — such rows are silently dropped (trap 13).
**An xlsx import runs none of the BO's scripts** `[C]` — no hook, no field script, on a created record or an
   updated one (trap 51); what a script would compute must be in the file, or go through the form cycle (§6b).
   A process does start: an `ON_INSTANCE_CREATE` run way with `ON_UPLOAD_XLSX` in `changeVariantSet` runs on
   every record the file creates `[C]` (§5f «Run ways»).

#### R8 — Export the structure of a company

MCP connected → `structure_export` (§0U.8) does steps 1–3 for the BOs you name and puts the user's basket back.

1. Pick what to export. The export basket is **server-side, persisted state** — it still holds whatever
   was selected in some earlier session. In the UI:
   `/settings?settingsOpenPageUrl=import_export&formType=export`, the grey ⊕ right of «Бизнес-объекты (N)»
   adds BOs, the row's trash icon removes them (unticking in the ⊕ dropdown does NOT).
2. `POST /web/v2/process-indicator/pre-create-process` — `P {}` → `processId`.
3. `POST /web/struct/export-company-structure?processId=<id>` with body `{}` → the zip bytes;
   `Content-Disposition` carries the generated name. **Under browser automation the «Выгрузить» button's
   download may not reach a readable folder** (§10) — do this from the shell.
4. Unconfirmed dependencies do not block the export; the archive then holds only the selected BOs.
   The file name's company slug is not necessarily the tenant you are in.

#### R9 — One record by hand (UI), and the same without the UI

1. **UI** `[C]`: Системные → **«Бизнес»** (`/business-objects/viewing-list`) → the group → the BO → its
   registry → **«Добавить»** → fill the fields → **СОХРАНИТЬ**. A draft is created as soon as the form opens;
   closing it unsaved asks «Несохраненные данные — … Закрыть без сохранения?» → ДА drops it. An existing
   record: click its row, edit, СОХРАНИТЬ. The registry tabs В работе / Архивные / Удаленные / Тестовые
   are the record states. A registry column header's sort icon sets the BO's default sort
   (`save-bo-table-sort`, §5b «The rest of the constructor's controls»).
2. **API, scripts run** — the form cycle of §6b (what the UI's own dialog sends). **API, no script runs** —
   the draft cycle of §6a. Read back with `load-boi-values` (§6b table) or `load-bo-instance-bracket-table` (R6
   step 6; its `state` is the `BoiState` `ALL|ARCHIVED|REMOVED|OFFLINE|DEV` — the registry tab `[I]`).
3. **A dictionary row is an ordinary record of the dictionary BO** `[C]`: created, edited and deleted by the same
   cycles; the system fields are `code` («Код») and `label` («Значение», `INPUT_TEXT_LANG`, a value
   `{"RUS": "…"}` `[I]`); its xlsx template has the columns «Код» / «Значение» (§6).
4. **Moving a kanban card = changing the record's column dropdown** `[C]`: §6b `save-field-value` with the
   new option id, then save — it runs the dropdown's «Изменение поля» hook like any form change. The board's
   own drag is `v2/kanban/move-kanban-card` P `{boId, fieldId, optionId, instanceId}` `[C]` (§7); whether it runs
   that hook is not checked `[U]` (§12).
5. **Delete / archive / restore / duplicate a record**: the API calls are named in §6a «Related in the same
   controller» (`delete-bo-instance` with `{businessObjectId, boInstanceIds}` in the PARAMS `[C]`, trap 46); the UI controls and the params
   of `archive-bo-instance` / `restore-bo-instance` / `copy-bo-instance` are not known yet `[U]` (§12).

#### R10 — A whole system from a spec — build everything the stand can take

**When:** the request is a SYSTEM, not one object — «реализуй CRM по этой концепции», a spec with objects, a
work path, automations, reports, roles. The job is the whole spec, not «the BOs it names»; shipping the BOs
and dropping the rest «for scope» is a fraction reported as done.

0. **Stand data — read it yourself, ask only for the group.** Unless the request says the stand is empty
   («пустой стенд», «новая компания»), ask one thing: «куда положить новые БО (группы — разделы конструктора): в новые
   группы по темам (назову их сам) или все в одну существующую (какую)?». When the stand is empty never ask
   the group name — name the groups yourself. **New groups go by theme**: more than ~6 BOs → 2–4 groups by
   meaning (автосервис: «Клиенты и автомобили», «Заказы и работы», «Склад и закупки»; a dictionary joins the
   theme whose BOs pick from it), each
   at least 2 BOs; fewer stay in one group named after the system. Then read
   the rest: the group's `code`, `name`, `orderIndex` by `load-bo-groups {"forEdit":true}` (R4) — copy them
   verbatim into the archive; a group whose `code` is `null` cannot be targeted by an archive — build a new
   group and say why, or give it a code (`save-business-object-group`, §«Verifying an import through the
   API» — one-way, ask first). Taken BO codes: `load-bo-id-by-code` for every code you plan — a free code
   finds no BO `[I]`; an export of all BOs (R8) lists them all. **Without stand access** (the user only
   hands files over) ask exactly the question of `MYBPM-IMPORTS.md` 0.2 step 0: «Стенд пустой (новая
   компания)? Если нет: (1) куда положить новые БО (группы — разделы конструктора): в новые группы по темам
   (назову их сам) или все в одну существующую (тогда пришлите экспорт структуры любого БО из неё — группу
   возьму из него); (2) чтобы коды
   новых БО не совпали с уже существующими, пришлите экспорт структуры всех БО компании — или скажите «без
   экспорта», и я добавлю к кодам короткий случайный суффикс.» An export holds a `BoGroupStructDto` line only
   for the groups of the exported BOs `[C]`; a line without `code` is a code-less old group. There is no
   per-group export, and BO codes are unique across the company.

1. **Decompose the spec into a coverage table BEFORE the first write** — one row per requirement (an object,
   a list of values, a status path, an automation, a calculation, a report, a role, a notification) — each
   automation, report and role a row of its own, and so is a calculation or automation stated inside an
   object's description (a number given automatically, a value recomputed on save) —, each row given exactly ONE route from this table, written
   as the literal text of its «Route» cell («where possible», «partly», «если поддерживается», «требует
   серверной логики», «внешняя настройка», «настройка на стенде» and two routes joined by «или» are no route —
   an item that fits none is «not doable» with its row of the last table):

   | Route | What goes there | Recipe |
   |---|---|---|
   | structure | BOs, dictionaries AND their values, fields, links, layout, kanban card templates — by an archive (`MYBPM-IMPORTS.md` §0, dictionary values as row lines 0.5b) or the constructor | R3, or R1 / R2 |
   | a hook script | computed fields and totals (stock, reserve, balance = a sum over lines), auto-fill, «when X is saved, set Y» | §5g |
   | a business process | a path someone RUNS figure by figure, with forms and branches (approval) | R2 / §5f |
   | the menu | one item per user job (none for line BOs, several for different views or filters) — at the root up to ~5, else one group per theme; a kanban only on the item of a BO with a status path, by `status` — a type, category, source or priority dropdown opens no board unless the user asked for that board (its card template is no request); an icon by meaning on every line | R6 |
   | rights by role | read the stand's groups, then write the rules | R5 |
   | records | initial records of working BOs; values of a dictionary already on the stand | R7 or R9 |
   | not doable | the last table of this recipe | — |

2. **Do every row that has a recipe — in this task.** On a live stand even rights and dictionary values are
   doable (the group ids are readable here, R5; a dictionary row is an ordinary record, R9 step 3). Never
   «the structure now, the rest later».
3. **The menu counts as ASKED** — a system the user has to dig out of «Бизнес-объекты» is not delivered. One
   item per user job — up to ~5 at the root, more in one menu group per theme (the themes of the BO groups),
   never one group holding everything; the kanban on the item of every BO with a
   status dropdown; an icon BY MEANING on every line, unasked (R6 step 3, §4 «Icons by meaning»).
4. **A row you do not do needs a reason from this closed list — nothing else is a reason:** a stand input
   is missing (0U.1, the user has it — ask); the platform cannot do it (name its row of the last table); its
   only route is `[U]` (name the section that marks it). «Out of scope», «too large», «better by hand», «there
   is no computed field type» are NOT reasons.
5. **The report** (0U.6): the contents READ BACK from the stand (R4), never from your plan — groups, BOs by
   category, scripts by owner and hook, processes, menu items, rights; plus the coverage table — every spec
   item, its route, done / not done + the reason — printed as a table at the end of the reply; an item not
   done is a row of its own, never inside a row marked done, never only in a list of limitations.

**Modelling patterns** — how a spec becomes BOs and links:

- **Header and lines** (заказ-наряд → работы и запчасти, заказ поставщику → позиции): the line BO has a `SINGLE`
  `BO` field to the header, the header a `TABLE` field to the line BO, and **each names the other as its linked
  field** — `boRefStruct.linkedFieldCode` in an archive, «Поведение» → «Связь объектов» → «Заполнить поле
  "<label>"» (`linkedFieldId`) in the constructor; that control appears only once the back field exists, so
  create both fields first (§5h «Reference fields») `[C]`. A `TABLE` without the back link leaves every line
  an orphan in one global registry: no line knows its header, and the lines of one header cannot be listed or
  summed from the line side. **The line BO is never the catalogue**: «запчасти в заказе» is a line BO (header,
  a reference to the catalogue, quantity, price), «запчасти на складе» a catalogue BO (article, name, stock)
  linked to no order.
- **Child documents** (оплаты по заказу, автомобили → владелец, записи → клиент): the same `SINGLE`↔`TABLE`
  pair, so the children show on the parent's card. A child's `SINGLE` without the parent's `TABLE` back makes
  them invisible there.
- **One stage growing out of another** (запись → заказ-наряд, лид → сделка): link the later record to the one
  it came from, so the chain is navigable both ways. **Many-to-many**: two `TABLE` fields naming each other.
- **Dictionary or local list**: values users add to over time, or that several BOs pick from → a dictionary +
  a «Выпадающий список» «из справочника»; a short fixed list owned by one field (способ оплаты) → a local list
  («Задать вручную»). **No dropdown opens empty**: every value the spec names or implies (марки, типы КПП,
  посты) is filled — by the archive's row lines (`MYBPM-IMPORTS.md` 0.5b) or as dictionary records (R9).
- **Status**: a record's lifecycle is a dropdown `status` with a LOCAL list of the spec's stages («Задать
  вручную») and its kanban card template (§7) — never a dictionary: the stages belong to one field, and the local list fixes their order
  and colours; a business
  process is for a path someone runs step by step. Do not turn every status into a process.
- **Computed values** (сумма заказа = сумма строк, остаток = сумма − оплачено): a plain field plus the owner BO's
  «Сохранение» hook that fills it (§5g); a total = a foreach over the header's `TABLE` value, add each line's
  number, assign the sum to the header's field. Each step `[C]`, the whole recipe `[I]`; it recomputes when
  the HEADER is saved, not when a line is edited in its own card `[I]`.
- **Which BO gets a menu item**: every working list (клиенты, автомобили, заказы, записи, оплаты, поставщики);
  NOT the line BOs (edited inside the header's table). A dictionary or catalogue BO goes into the menu group
  of the theme whose BOs pick from it, or gets no item — never one group of all dictionaries.

**What the platform cannot do** — name the row for every spec item you skip:

| Spec item | Why | Instead |
|---|---|---|
| Reports, dashboards, analytics | operative reports are their own module (menu type `REPORT`, R4a); not mapped here `[U]` | not done — say so; a registry with its columns, grouping (§5l) or a kanban covers a simple list report |
| SMS, telephony, calls, a messenger bot | external services configured by the stand's admin | not done — say so; only a record's Telegram / WhatsApp link field exists (§5k) |
| E-mail / push notifications from a script | the script palette has the actions; their delivery was never checked `[U]` | only if asked, marked `[U]` |
| A time-driven automation («напомнить через 3 дня») | a `SCHEDULED` process start has never been seen to fire `[U]` (§5f) | a hook on save, or a process started by hand |
| A guard: forbid a save or a status change until a condition («без согласования нельзя начать работы») | no hook that refuses a save or rolls a status back is known `[U]` (§5g) | a path someone RUNS step by step → a business process with an approval branch (§5f); a value that must be there → «Обязательное» (§5h); otherwise not done — say so |
| Deleting a field, a tab or an option by an archive | an import never deletes | the constructor or `deletedFieldIds` (R1) |

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
   before any script, kanban template or menu item refers to it. **A setter called right after the portion save
   that added the field may not see it yet** `[C]`: `NoBoFieldWithId … «Данное поле не сохранено в бизнес-объекте»`
   for about a second, then the same call passes — retry it every 0.5 s on exactly that error (the widget code
   and url setters the same `[I]`).
5. **`create-bo` writes immediately.** So does `apply-update-cmd`, so does every `v2/co/add-*`. There is
   no dialog to cancel; the only undo is deletion.
6. **One structure import per company at a time**, and only `apply-import` writes — everything before it
   is a dry run you should read.
7. **An `AccessStructDto` in an archive REPLACES the BO's rights** set by hand (groups included —
   `orgUnitIds` of THIS stand arrive, `[C]`); a structure-only archive leaves them untouched. So the line
   travels by case (`MYBPM-IMPORTS.md` §0.9 rule 10): an amendment of an export carries the exported line,
   changed only where asked; a blind update (no export with «Права доступа») ships none unless the user asks to
   change rights — then the whole wanted set; a NEW BO always carries one — the rights the task defines, else
   the all-open line with the «никому» rule of the hidden system tab `tab_system` (§0.8a step 6). Group and
   department ids come only from the user.
8. **Re-read after every write.** The platform answers 200 for `save-business-form-field` used to create
   a field (creates nothing), for an empty kanban template save (writes nothing) and for a rights popup that decided
   nothing changed.
9. **Never print a stack trace into the session** — a MyBPM error carries ~100 lines of Java. Read
   `message` and `errorType`.
10. Do not fight the UI where an API exists. And where you must use the UI, read §10: clicks in this app
    go through an in-page script (`el.click()` matched on `innerText`), text through the native value
    setter — simulated typing silently drops spaces and punctuation.
11. **Every BO shows at least one field in its registry, and every BO-reference field shows at least one
    field of the BO it points at**. A BO with no
    `tableColToShow` field answers `AccessDenied` in its registry and lists no rows (trap 48). A reference
    with every `boFieldRefs[].toShow: false` renders an empty selector on the card (trap 53). The API
    creates both states by default, so set a column (`editedFields: [{fieldId, tableColToShow:true,
    tableColOrderIndex:0}]`) and a displayed field of every reference before handing the BO over.
    The default column is the name field, first.
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
- [ ] The report lists what was READ BACK (R4), never the plan, and names no object the stand does not
      have; for a whole system (R10) it carries the coverage table — every spec item, its route, done / not
      done + a reason from R10's closed list, an item not done in a row of its own.
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
      as a whole is a sign the window is too low; a scrollbar INSIDE a field is a defect. Check every tab, and
      a table with its real number of rows.
- [ ] The layout heights hold `[C]` (one grid row = 30 px): one-line input 3 rows, a styled heading 3, a
      top-level `TAB_GROUP` = its tallest tab + 3 (+ 6 on a `TAB` page; nested group + 2), and the record window
      `gridLayoutPosition.h` = form rows + 5 (the dialog is `h·30` px tall, 99 px of it title and buttons).
      Fix a scrolling tab group or window at its source: an archive-built BO in the archive
      (`MYBPM-IMPORTS.md` §0.8a), a constructor-built one by the R1 «Layout» calls (field `gridPosition` in the
      portion save, `save-business-object-grid-layout-position` for the window).
- [ ] The notifications your work raised were cleared, whichever way they came: every structure import
      leaves an «Анализ импорта завершен»; every non-2xx REST call from a script you clicked leaves
      «Ошибка — Возникла ошибка при запросе в сервис …» (`MYBPM-IMPORTS.md`, RestRequest section); a
      script's own `ScriptNotification` lands there too. They sit under the bell (header, «События»). Every notice pops up
      as a short-lived toast on the screen; the bell entries are the ones that are also KEPT. Some are toast-only — system
      errors, «the registration link was sent» — and never reach the bell `[C]`: nothing to clear, and no API call reads them.
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
sanitizer · §9 tooling · §10 browser-automation traps · **§11 the numbered trap list — read it when
something behaves impossibly** · §12 what is still unknown · §0U.8 the `mybpm-stand` MCP server.

### 0U.8 The mybpm-stand MCP server — the recipes as tools

This document ships with a local MCP server, **`mybpm-stand`**: one JavaScript file, `mybpm-stand.cjs`,
that any MCP client starts as a **stdio** server (`node mybpm-stand.cjs`, Node ≥ 18 or Bun; no arguments, no
environment, no port). It runs on the user's machine, talks to the stand itself and makes exactly the calls of
the recipes it names below. **Its tools connected (`stand_list`, `import_analyze` …) → use them for what they
cover; not connected → the recipes as written.** This document stays the spec either way: what a tool cannot
do is plain HTTP by §0U.4.

- **Not connected (no `stand_*` tool among yours) and the task touches a stand → say so in your first reply
  and give the user the install steps for their client; do not work around it silently.** You cannot install
  it yourself: every install is the client's own dialog or config the user confirms, and in a web or desktop
  chat your code runs in a cloud sandbox, not on their machine. Give the steps for the client you run in.
  **The server file, for any client** — two ways to get it [C]:
  - a checkout: `git clone https://github.com/dmezhnov/MyBPM` → the server is `<checkout>/mcp/mybpm-stand.cjs`;
    a newer release = `git pull`;
  - without git: download `https://github.com/dmezhnov/MyBPM/releases/latest/download/mybpm-stand.mcpb` — a
    zip, whatever the extension says — and unzip it into a folder of its own → the server is
    `<folder>/server/mybpm-stand.cjs`; a newer release = download and unzip again over the same folder.

  Keep the file where it is: it reads the archive lint beside it (`../skills/…` in a checkout, the same in
  the unzipped folder). The client needs the **absolute** path of that file. Then, by client:
  - **Claude Desktop (Chat tab, Cowork):** the plugin `mybpm` (both skills + the server) goes on the user's
    claude.ai account, in two steps [C]: Customize → Plugins → «+ Add» → **Add marketplace** → `dmezhnov/MyBPM`
    → «Sync» — this adds only the catalogue, nothing is installed yet; then Plugins → **Discover** → «+» on
    **Mybpm** → «Continue» in the dialog «This plugin includes local MCP servers». It shows under Plugins →
    Yours, Desktop starts the server itself and the Chat tab gets the tools in a new chat [C]; Cowork the same
    [I]. **The account marketplace is pinned to one commit and does not follow the releases by itself** [C]:
    «+ Add» → **Manage marketplaces** shows `MyBPM · Synced · Synced commit: <sha>`, and its switch «Sync
    automatically — Re-syncs on GitHub changes», on by default, does not move it to a newer release [C]; the
    periodic 20-min sync is a quick one that leaves user-installed plugins as they are [C]. A user on an old
    version (the version is on the plugin's page: `from MyBPM · <version>`): Customize → Plugins → **Yours** →
    **Mybpm** in the plugin list → ⋯ → **Check for updates** → the «Update» button beside ⋯ becomes active →
    press it → the page shows the new version and Desktop
    replaces its local copy at once, no restart [C]: the skills are new in the next chat [I]. The server process
    Desktop already started keeps running the old code [C] — restart Desktop (it starts the server anew) for
    the tools [I]. The same through «+ Add» → Manage marketplaces → ⋯ on MyBPM → Check for updates moves the
    commit; then a restart downloads the new copy [C]. A second Add marketplace of the same repository answers «This marketplace
    is already added» — go to Discover. The Code tab's own Add marketplace is a different thing: it writes the
    machine's Claude Code registry, not the account [C]. Without the marketplace: «+ Add» → **Upload plugin** →
    `https://github.com/dmezhnov/MyBPM/releases/latest/download/mybpm-plugin.zip` → «Continue» — same result
    [C], but that version stays until the user uploads a newer one [I]; never both at once. Fallback without the plugin, the tools alone: `https://github.com/dmezhnov/MyBPM/releases/latest/download/mybpm-stand.mcpb`,
    open the file, «Install», then a new chat [I]; an extension left disabled shows «—» under Customize →
    Connectors [C].
  - **Claude Code** (the terminal, an IDE, the Code tab of Claude Desktop) reads plugins from the machine, not
    from the account [C]: `claude plugin marketplace add dmezhnov/MyBPM`, `claude plugin install mybpm@mybpm`,
    then restart Claude Code — tools appear only in a session started after the install [C].
  - **claude.ai in a browser or the mobile app:** a local server cannot run there [I] — the Desktop app or
    Claude Code is the way to the tools.
  - **Codex** (the CLI, the IDE extension and the Codex app share one config) [I]:
    `codex mcp add mybpm-stand -- node <absolute path>/mybpm-stand.cjs`, or by hand in `~/.codex/config.toml`:
    `[mcp_servers.mybpm-stand]` with `command = "node"`, `args = ["<absolute path>/mybpm-stand.cjs"]` and
    `tool_timeout_sec = 300` (an import waits for the stand longer than the default 60 s); in the app or the
    extension: ⚙ → MCP servers → name, **STDIO**, the same command → Save → Restart. `/mcp` in the CLI lists it.
  - **ChatGPT** (web, desktop, mobile) never starts a program on the user's machine: it reaches only an MCP
    server over HTTPS, as a custom connector in **developer mode** — a workspace feature (Business,
    Enterprise, Edu; the admin turns it on), not on the Free plan [I]. A server on the user's machine gets
    there through OpenAI's **Secure MCP Tunnel**: the `tunnel-client` daemon (github.com/openai/tunnel-client)
    starts the stdio server itself and keeps an outbound connection to OpenAI — `tunnel-client init --sample
    sample_mcp_stdio_local --profile mybpm --tunnel-id <tunnel_…> --mcp-command "node <absolute
    path>/mybpm-stand.cjs"`, `tunnel-client doctor --profile mybpm --explain`, `tunnel-client run --profile
    mybpm` (with `CONTROL_PLANE_API_KEY` = a runtime key of the OpenAI Platform organisation the tunnel
    belongs to); then in ChatGPT Plugins → «+» → add a custom MCP server → Connection: **Tunnel** → that
    tunnel [I]. The daemon must keep running for every call. No developer mode → no tools in ChatGPT: the
    skill and the recipes as written, the user carries the files (§5 for the archive, §6 for the xlsx),
    or Codex on the same machine is the way to the tools.
  - **Any other MCP client** (Cursor, VS Code, Windsurf, Gemini CLI, …) [I]: a stdio server entry with
    `command` `node` and `args` `["<absolute path>/mybpm-stand.cjs"]` — e.g. `~/.cursor/mcp.json`:
    `{"mcpServers": {"mybpm-stand": {"command": "node", "args": ["<absolute path>/mybpm-stand.cjs"]}}}`;
    VS Code `.vscode/mcp.json` names the list `servers` and adds `"type": "stdio"`. Restart the client.
  - Stand accounts are the same for every client: the server's own page (`stand_accounts` below) opens on the
    machine the server runs on; the CLI form `node mybpm-stand.cjs stand_accounts` holds it until Ctrl+C.

  Until the user installs it, the recipes as written work wherever your code reaches the stand; a cloud
  sandbox usually does not reach a customer stand — then the install is the way, say so.

- **The same tools from a terminal, without an assistant:** in a checkout of the repository `mise run stand` lists
  them, `mise run stand <tool> help` shows a tool's arguments, `mise run stand <tool> --<arg> <value> …` runs
  it on the same accounts (kebab-case flags: `--bo-id`, `--dry-run`; a repeated flag adds to a list; a JSON
  value for an object; `--<arg>-file <path>` reads a value from a file; a `{json}` word passes several). The
  plugin's server file does the same: `node mybpm-stand.cjs <tool> …`. A ✎ tool writes at once — there is no
  assistant to ask first.

- **A newer release: the server says so.** At start it reads `version` of `.claude-plugin/plugin.json` on
  `main` of `dmezhnov/MyBPM` (`main` moves only on a green release); newer than its own → its first answer and
  every `stand_list` end with an extra text «NOTE for the assistant: the mybpm plugin <new> is out, this copy is
  <old> …» naming the update steps of the way it was installed (Desktop account plugin, Upload plugin, `.mcpb`,
  Claude Code, the Code mode of Claude Desktop — worded for Desktop, told apart by `CLAUDE_CODE_ENTRYPOINT=claude-desktop` [I] —,
  a checkout, an unzipped `.mcpb`; the new version already installed on the computer → only the restart) and the warning block to open the reply with — `> ⚠️ **A new version of the MyBPM plugin is out:
  <new>** (you have <old>).` + `> To update: …`, in the user's language [C]. Show it, then go on with the task; GitHub out of reach →
  no note, nothing else changes [C].

- **Accounts stay with the server, never in the chat.** An account = a login on a stand host; the server keeps
  several, **all equal — none is the default**. `stand_list` asks each one live: name, host, login, `alive` or
  the error, fio, e-mail, companyCode, companyId, personId, the Person BO id (`functions: true` adds the
  functionCodes). Every tool takes `stand` — an account's name or its host; one account → it goes there
  without it; several → a call without `stand` is refused: **ask the user which account** (unless they said it
  in this conversation) and pass `stand` on every call; before a ✎ write name account, stand and company in
  the question. **A new account, a rename, another login, a re-login go through `stand_accounts`:** it
  returns the URL of a local page of the server — give it to the user as a link; the page opens in their
  browser only with `open: true`, which you pass only when the user asked to open it or to add / re-log an
  account, never because a question found no account — where they type the stand, the login and the password; the password goes from that page to the stand, the server
  keeps the session token (`~/.config/mybpm/tokens/<host>/<login>.token`, the same file
  `mise run stand-login <host> <login>` writes). **«Запомнить пароль»** on that page (on by default) also keeps
  the password in the OS secret store — Linux Secret Service (`secret-tool`, service `mybpm-stand`), macOS
  Keychain, Windows DPAPI (`~/.config/mybpm/secrets/<host>/<login>.dpapi`); never in a plain file; the store
  missing → the account is saved without it and the page says so. Then wait for the user and call
  `stand_list` (`passwordRemembered` per account). `stand_remove` ✎ ends the session on the stand and deletes
  the token and the remembered password. **An expired session of a remembered account renews itself:** the
  server logs in again with the kept password and repeats the call (`stand_list` marks it `relogged`).
  Otherwise — or when the kept password no longer logs in — it surfaces as an error naming the account: send
  the user to `stand_accounts` («Изменить», log in again) — a missing right comes back as the stand's own
  `SecurityError`. **A local stand** (host `localhost`, `127.x`, `[::1]`) may instead be added, changed or
  logged in again by `stand_account_save` ✎, which takes the password as an argument (`remember` default
  true; `was` = the account to change; a bare host means `http://`); any other host is refused. With the
  server connected, never ask for a password or a token of a non-local stand (§0U.1 item 3 is answered). Item 2 still holds: **`stand_list` first** — it names
  the company each account selects.
- **Writes are marked.** `import_apply`, `import_cancel`, `import_rollback`, `bo_create`, `bo_fields_save`, `bo_code_set`,
  `bo_delete`, `co_build`, `rights_save`, `menu_save`, `menu_delete`, `filter_save`, `kanban_card_save`, `record_save`, `record_delete`, `record_participants`, `person_invite`, `xlsx_import` with `confirm`, `script_write`, `scripts_wire`, `script_version`, `process_edit`, `process_version`, `process_run_ways`, `process_push`, `notifications_clear`, `stand_call` change the stand, `stand_remove` deletes a saved account, `stand_account_save` adds or changes a local one — §0U.5 applies to them as to a hand-made call: say what it changes, get the user's OK.
  `import_rollback`, `bo_delete`, `menu_delete` and `record_delete` without `confirm: true` only return the preview.
- **The constructor tools make R1 / R2a whole.** `bo_create` takes the fields as a list (label, type, code,
  ref, options, required / unique, `cols`, `tab`) and does R1 steps 1–8 with «Layout»: pairs in one row, one
  `TAB_GROUP` `tabs` for the tabbed fields, the first field the registry column, the record window, then every
  code by its setter (rule 4 + 12) and a read-back; a BO code the rename race overwrote (trap 24) is set again.
  Tab codes stay derived from the labels (§5k by hand); a «Системные» tab is closed with VIEW «никому» (R5 step 6). Option codes (`options[].code`, `bo_fields_save` edit
  `optionCodes`) are set by a later EDIT of `options` and read back, because the stand regenerates them after
  the add (§5h «Единичный выбор»). `co_build` runs the R2a draft cycle and removes the draft on any failure, so
  nothing half-built stays.
- **The rights tools make R5 whole.** `rights_read` / `rights_save` take one target — a BO, a field, a tab, a
  menu item (by id, code or name) — and read every action as `"all"`, `"nobody"` or its subjects (groups,
  persons, author, participants, Person fields). `rights_save` sets the actions you pass to EXACTLY the subjects
  given: groups and users go in through `orgUnitToAdd` / `orgUnitToDelete` (trap 3), the null author block is
  built (trap 2), users are found by e-mail, name or id, «выборочно» follows, the rights are read back with a
  retry and compared (`mismatch`). A BO's lock stays on once set (R5 step 5).
- **The menu tools make R6 whole.** `menu_read` gives the whole sidebar tree (every GROUP level): id, code, type,
  name, icon, BO, parent, order, the views on (`kanban` / `timeline` by the field's CODE), whether the item is
  selective and carries a filter. `menu_save` creates GROUP / BO items (an icon by meaning is required and checked
  against the catalogue — `menu_icons` lists the meaning table or searches the 1153 names; a parent may be an item
  of the same call) and changes an item's icon or views (merged; `false` switches one off; a kanban without the
  BO's card template comes back as a note — `kanban_card_save` sets it, §7). Rename, move and the item code are not
  offered (§4: the code is the stand's own transliteration). `menu_delete` deletes a BO / GROUP item you made — a
  GROUP with items inside is refused; built-in items always. `filter_try` counts a BO's records under a filter
  without saving it — `{field, eq}` / `{field, currentUser: true}` / `{native: "CREATED_BY", currentUser: true}`,
  groups `{all | any: […], not?}` nested, each value sent in the shape of §4 «Record filters» (an «пусто»
  condition is refused: the stand ignores it); `filter_save` stores the same filter on a BO menu item and reads back
  the count, `clear: true` removes it. Menu rights: `rights_save {menu}`.
- **Kanban card, participants, invitation, import conflicts.** `kanban_card_save` sets a BO's card for one
  `DROPDOWN_SINGLE` by field codes (header / content / footer; a system field by its type, e.g. `CREATED_BY`):
  the archive route of §7 — export, the key set in the BO's line, a one-BO import (it leaves a log row, a bell
  entry and can be rolled back), `load-kanban-template` read back; `dryRun` cancels the import after the
  analysis. `record_participants` reads, adds and removes a record's participants (§3 «Participants»), users by
  e-mail, name or id. `person_invite` e-mails a user the invitation again (§3) — a REAL letter to the address
  of that «Пользователи» record: name the person and the address when asking. Conflicts (§5 «Conflicts»):
  `import_analyze` / `import_report` give one row per unknown org unit — `conflictId`, type, the archive's
  name and id, `candidates` `[{id, text, removed}]`; `import_apply {resolve: {<conflictId>: <unit id or its
  name>}}` maps them and is refused while one is open. The apply writes the archive's name onto the chosen
  unit; `removed: true` = a deleted group the stand still offers — never map onto it.
- **The record tools make §6a / §6b whole.** `record_save` takes values by field code, fieldId or label in
  plain form (text, number, `true`/`false`, an ISO date, the option label or code, a record id or an array of
  them, `{RUS, KAZ, ENG}` …) and converts each by the §6b value table. `scripts: true` (the default) = the
  §6b form cycle — the BO's hooks run as in the UI dialog, the record counts as saved only on
  `CLOSE_DIALOG_SAVE`, otherwise the field errors come back and nothing is kept; `scripts: false` = the §6a
  draft cycle (no hook, no field rules, no counter number, no `DROPDOWN_SINGLE`). A kanban card move (R9
  step 4) is a `record_save` of its status field. «Data too large» (trap 73) is retried for a minute; a save
  whose apply never got an answer returns `saved: "unknown"` and is NOT deleted — `record_read` it later
  (§5b «Data too large»). `records_find` gives the registry COLUMNS only (trap 47), `where` matches a code
  exactly over up to 2000 records; `record_read` gives every field, tabs included, and the `BO` / `CO` values
  through a bare draft (§6a «Reading an existing record»). `record_delete` is soft: state `REMOVED`.
- **The xlsx tools make R7 whole.** `xlsx_template` saves the stand's template on the user's disk and names each
  column (caption, sub-header, field code, type) and the BO's key field. `xlsx_import` is two-phase like R3: `path`
  (a filled template or an export) or `rows` (plain values by field code or label — the file is built on a fresh
  template by the step 2 rules: TABLE children on repeated rows, a block by the target's unique field or a Person's
  e-mail, or by `{"<sub-header>": value}`) → upload → the act: rows new / updated / failing with each reason, and
  warnings for what the stand does silently (no key → every row creates, a blank cell clears, a TABLE block only
  adds, `isReadonly` written). Nothing is written until `importId` + `confirm: true`; `cancel: true` drops the act.
  An xlsx import runs none of the BO's scripts (trap 51) — `record_save` does. `xlsx_export` saves the file and
  reads it back as records keyed by field code, a TABLE block folded into a list by the id column.
- **The script tools make §5g whole.** `scripts_read` gives a BO's script versions, the wiring of one (the four
  hooks, the field scripts by field CODE, the local methods) and per script whether it translates (`defs: true` —
  the def); `global: true` — the company-global methods. `script_write` writes ONE body (a hook, a field script, a
  local or global method, a process figure) in one `apply-update-cmd` after a guard that refuses what would brick
  the module (trap 49: an unknown type, a dangling or reused id, a method without its hat); a def that does not
  translate is put back by its own backward command (never the server `undo`) unless `keep`; `dryRun` only
  checks. `scripts_wire` wires hooks, field scripts and local / global methods and returns their ids; it waits out
  a blind first version (trap 68), unwires a field by leaving it out, and «unwires» a hook by the body «entry →
  exit» (trap 68b); a removed local method is removed from every version (trap 68a). `script_version`: list, work,
  test, copy, remove (not the work / test one), comment.
- **The process tools make §5f whole.** `process_read` gives the versions and one version's figures and named
  arrows in walk order from the Enter (an unreached figure is «не подключена»), validate-def, each Script /
  Switch's exits and translate, the run ways with field codes. `process_edit` adds, changes and removes figures
  and arrows in ONE `apply-update-cmd` with a backward (no draft, written at once), refuses slot names off the
  §5f table, gives every new Script a body «entry → exit» and every new Switch an exit by its first outgoing arrow,
  then validate-def. `process_version` as `script_version` (work on the test version makes a new test one).
  `process_run_ways` sets / removes run ways in one draft. `process_steps` shows where a record is (STAND / GO /
  WAITING / FAILED per figure); `process_push` ✎ moves a stuck one on (forward along an outgoing arrow, retry a
  failed step).
- **The stand contradicts a document → `platform_report`** (the rule at the top of this document): it returns
  the prefilled issue URL and a search URL, refuses on an outdated copy and on a text naming the user's own
  stands, logins, people or companies. Ask the user before giving them the link to submit.
- **An archive built where the stand is unreachable goes in through `archive_put`.** In a claude.ai or Claude
  Desktop chat your code runs in a cloud sandbox: the server cannot read a file there. Do not zip it there —
  send the JSONL lines of `0000001.mybpm` (`MYBPM-IMPORTS.md` §0.1) to `archive_put` in parts of up to
  ~100 KB (`part: 1, 2 …`, `last: true` on the final one); the server zips them on the user's machine and
  lints them. Code on the user's machine (Claude Code) → `import_analyze {path}` straight away.
- **`import_analyze` lints first** — the form lint of `MYBPM-IMPORTS.md` §0.10 — and does not upload while a
  defect line is left; the lint does not replace the rest of the self-check there. On an amendment of a given
  export pass its path as `source` (`archive_lint` too): what the export carries unchanged becomes one
  `REMINDER` instead of defects.
- **Finish with the bell:** `notifications_read` flags `newThisSession` what appeared after the server's
  first stand call — the entries your work raised (every analysis leaves one); `notifications_clear` those ids.

| Tool | What it does | Recipe / route |
|---|---|---|
| `stand_list` | every account, each asked live: alive, fio, e-mail, companyCode, companyId, personId, the Person BO id | §0U.1 item 2; `GET v2/auth/load-auth-info`, `load-bo-id-by-kind {kind: PERSON}` |
| `stand_accounts` | the accounts page URL (`open: true` opens it — only on the user's ask): add, edit, log in again, remove | — |
| `stand_remove` ✎ | ends an account's session on the stand, deletes its token and remembered password | `GET v2/auth/logout` |
| `stand_account_save` ✎ | adds, changes or logs in again an account of a LOCAL stand (localhost) with the password as an argument; `remember` keeps it in the OS secret store | `POST v2/auth/v3/login` (Route A) |
| `bo_groups` | every BO group with its BOs | R4; `load-bo-groups {forEdit}`, `load-bo-records-by-group-id` |
| `bo_find` | a BO by `code` (`exists: false` when absent) or by a piece of its name | R4; `load-bo-id-by-code` |
| `bo_read` | one BO: header + a row per field (type, tab, grid, ref, required, column); `raw` = the DTO | R4; `load-business-object-by-id` |
| `persons_find` | users by a piece of name or e-mail (the stand's search does not match an e-mail `[C]` — with «@» the tool reads the whole list): the ids a Person field or a rights subject takes | `v2/org-unit/load-filtered-persons-v2` |
| `archive_put` | builds a `.mybpm.zip` on the user's machine from JSONL parts, lints it | `MYBPM-IMPORTS.md` §0.1, §0.10 |
| `archive_lint` | the form lint of `MYBPM-IMPORTS.md` §0.10 + what the archive holds | — |
| `import_analyze` | lint, upload, insert, analyze — nothing written, the import stays ANALYZED | R3 steps 1–4 |
| `import_report` | status, errors, conflicts, BOs; with `recordId` the per-BO diff | R3; `load-import-bo-record` |
| `import_apply` ✎ | description, apply, waits, reads the log row back; `resolve` maps the conflicts first | R3 steps 5–7, §5 «Conflicts» |
| `import_cancel` ✎ | drops an analysed import; `remove` also deletes its log row | §5 «Import through the API» |
| `import_rollback` ✎ | the rollback preview; with `confirm` the rollback | §5 «Rollback trap» |
| `import_log` | the import log and the open import | `load-import-file-records`, `load-import-state` |
| `structure_export` | exactly these BOs into the export basket, the file to the user's disk, the user's basket put back | R4a, R8 |
| `bo_create` ✎ | a BO / dictionary / panel / process BO with its fields laid out, coded, window set, read back | R1 steps 1–8 + «Layout», rule 4 + 12 |
| `bo_fields_save` ✎ | add, edit (any field key), delete fields of an existing BO in one save | R1 step 7, §5h |
| `bo_code_set` ✎ | a BO's or a field's code (widgets by their own controller) | rule 4 + 12, §5j |
| `bo_delete` ✎ | the preview (script usages, menu items, referencing BOs); with `confirm` the delete | «Delete a BO» in §5b |
| `co_build` ✎ | a composite: sources, simple and composite attributes, codes; or extends one by `coId` | R2a, §5e |
| `rights_read` | who may do what on a BO, a field, a tab or a menu item; `subjects` = groups, users, Person fields | R5; `load-access-group`, `load-field-access-group`, `load-field-tab-access-group`, `v2/menu-item/load-access-group` |
| `rights_save` ✎ | the actions passed → exactly these subjects (or all / nobody), «выборочно» follows, read back | R5 steps 1–6, R6 rights |
| `menu_read` | the sidebar tree: items, icons, BOs, views (kanban / timeline by field code), selective, filter | R6; `load-nav-items` per level |
| `menu_save` ✎ | create GROUP / BO items (icon by meaning, checked), change an item's icon or views | R6 steps 1–3; `create-menu-item`, `save-menu-item-icon-name`, `save-menu-item-bo-pages` |
| `menu_delete` ✎ | the preview; with `confirm` the delete (a GROUP with items refused) | R6 step 7 |
| `menu_icons` | the «Icons by meaning» table, or catalogue names holding a piece | §4 «Menu icon catalogue» |
| `filter_try` | a BO's records under a filter, not saved: the count, the first rows, the built brackets | R6 step 6, §4 «Record filters» |
| `filter_save` ✎ | a record filter on a BO menu item (or `clear`), read back with the count | R6 step 5 |
| `kanban_card_save` ✎ | a BO's kanban card for one dropdown, by field codes, through a one-BO archive; read back | §7 «The template» |
| `records_find` | records of a BO: id, state, the registry columns; `search`, `where` by code, `state` | §6a; `load-bo-instance-bracket-table` |
| `record_read` | one record, every field (tabs, `BO` / `CO` ids), `{value, display}` where they differ | §6b «read the record», §6a |
| `record_save` ✎ | create or change a record from plain values; `scripts` = form cycle or draft cycle | §6b, §6a; R9 step 4 |
| `record_delete` ✎ | the preview (each record's values); with `confirm` the soft delete | `delete-bo-instance` (trap 46) |
| `record_participants` ✎ | a record's participants: read, add, remove, read back | §3 «Participants» |
| `person_invite` ✎ | the invitation e-mailed again to a user (a real letter) | §3 «Выслать приглашение» |
| `xlsx_template` | the BO's xlsx template on the user's disk; what each column is; the key field | R7 step 1 |
| `xlsx_import` ✎ | `path` or `rows` → the act (counts, failing rows, warnings); with `importId` + `confirm` the apply, `cancel` drops it | R7 steps 2–5 |
| `xlsx_export` | the records to an xlsx on the user's disk, read back by field code | R7 step 6 |
| `scripts_read` | a BO's script versions, the wiring (hooks, field scripts by code, local methods), translate per script, defs; or the global methods | §5g «Reading a BO's scripts headlessly» |
| `script_write` ✎ | ONE script body after a guard, one `apply-update-cmd`, translate, put back if it fails | §5g writing, trap 49 |
| `scripts_wire` ✎ | wire / unwire hooks and field scripts, create / remove local and global methods | §5g «Wiring scripts onto a BO headlessly», traps 68/68a/68b |
| `script_version` ✎ | a BO's script versions: list, work, test, copy, remove, comment | §5g, `bo-scripts-editor` |
| `process_read` | a process: versions, figures and arrows in walk order, validate, exits, translate, run ways | §5f |
| `process_edit` ✎ | add / change / remove figures and arrows in one command, minimal bodies, validate | §5f diagram |
| `process_version` ✎ | a process's versions: list, work, test, copy, remove, comment | §5f «Versions» |
| `process_run_ways` ✎ | WHEN the process starts: set / remove run ways in one draft | §5f «Run ways» |
| `process_steps` | where a process record is: each step's figure and state | §5f run-time controller |
| `process_push` ✎ | a stuck record on: forward along an arrow, retry a failed step | §5f run-time controller |
| `platform_report` | a prefilled GitHub issue for a discrepancy with the documents (nothing is sent) | the rule at the top |
| `notifications_read` / `notifications_clear` ✎ | the bell, by id | `v2/user-notification/*` |
| `stand_read` | any read method (`load-` `count-` `verify-` `get-` `find-` `search-`) in the envelope of §0U.2 | §0U.3 |
| `stand_call` ✎ | any method, writes included, for the recipes no tool covers (R2 panels, R10, company settings) | §0U.4 |

✎ = writes. Neither `stand_read` nor `stand_call` takes the login methods: a session token never passes through
the model.

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
  browser needs nothing else: **no cookies** (`document.cookie` is empty) and no company
  header — the token alone selects the tenant.
- **A browser is not the only way to get a token** — the stand has a headless login `[C]`:
  `POST /web/v2/auth/v3/login`, standard envelope, body
  `{"dXNlcm5hbWU=":"<base64 of the login>","cGFzc3dvcmQ=":"<base64 of the password>",
  "timeOffsetZoneInMinutes":-300,"timezoneRegion":"Asia/Almaty","clientType":"WEB","userAgent":"curl",
  "pushToken":null,"clientVersion":""}`. The two keys are literally base64 of `username` / `password`,
  and the values are base64 of the UTF-8 bytes (`btoa(unescape(encodeURIComponent(v)))`).
  **The response body is the token itself**, as a JSON string — strip the quotes.
  Wrong credentials: HTTP 200 + `{"errorType":"IllegalLoginOrPassword","message":"Не верен пользователь
  и/или пароль"}`. The rest of the controller: `load-token` (the current session's token),
  `load-auth-info` (GET, who am I), `fast-login`, `otp-login`, `verify-code`, `send-to-verify`,
  `has-otp-settings`, `get-all-masks`, `save-company`, `logout` (GET). A second, non-admin login is how
  rights are verified (§3 «What each subject opens») — the admin token sees everything.
- **Fresh ids**: `v2/id-loader/load-portion` returns an array of ids; use them for objects you create.
- **Finding an endpoint — grep the whole bundle offline, it beats sniffing** `[C]`.
  Endpoints live in lazy JS chunks (`956.*.js` — rights, menu, icons; `9839` — BO controller + the HTTP
  service itself; `5675` — structure import; `7094`/`7584` — process indicator). Pull them all without a
  browser, no auth needed for static assets:
  1. `curl -sS https://<stand>/ | grep -o 'src="[^"]*"'` → `runtime.<hash>.js`, `main.<hash>.js`;
  2. `runtime.*.js` contains ONE object literal `{<chunkId>:"<16-hex hash>",…}`
     — parse it and fetch every `https://<stand>/<chunkId>.<hash>.js`;
  3. grep the downloaded chunks. A controller is `…setControllerPrefix("v2/business-objects")`, and each
     method reads `postJson("/load-bo-groups",{},{boId:u})` — body first, params second, so the call maps
     straight onto the envelope. `postFileJson(path,file,params)` = multipart.
  The page-side XHR/fetch logger is still the fallback when the call is built dynamically, but it is slower
  and misses anything that fires before the logger is installed.
- A stand export carries no host/URL — record the stand URL in the project memory.
- URL patterns: BO constructor `/business-objects/editing/<boId>/object-editing`; its editable list is
  `/business-objects/editing`. `/business-objects/viewing-list` (sidebar «Бизнес») is the read-only
  twin — it has no create/edit controls at all. See §5b.

## 2. Working method (user's rules)

- **«Тыкай через UI, ты сильно долго делаешь» / «если не получается через API делай через UI».** Speed
  beats elegance: stop exploring an API after ~2 failed guesses and sniff the UI instead. Minimal
  screenshots.
- After setting anything via API, **re-load and compare**. After a UI popup, click СОХРАНИТЬ and confirm
  the save call returned 200.
- **State stand facts only after READING the stand** (API or export) — never infer them.
- **The constructor's «СОХРАНИТЬ» ignores real mouse clicks and saves on `button.click()` from JS**
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

**Users, groups and departments are ordinary BOs with ordinary records** `[C]`: «Пользователи» (`Person`, the
company's `personBoId`; a user's record id IS their `personId`), «Рабочая группа» (`PersonGroup`,
`personGroupBoId`; members = its table «Пользователи», head = «Руководитель») and «Подразделения» /
«Департамент» (`Department`, `departmentBoId`) are created, changed and deleted like any record (R9, §6, xlsx R7). One exception — **a new
«Пользователи» record sends an invitation** `[C]`: creating it in the UI e-mails a link to the address in its
Email field; the person opens it, sets a password and can log in from then on. A record created over the API by
the §6b form cycle (`record_save` with scripts) sends it too `[C]` — the answer carries the notification
`person_invitation_is_send`; the §6a draft cycle and an xlsx: `[U]` — §12. So never create a user with a real person's address as
test data. **A structure archive never creates a group or department** `[C]`: one it names that the stand lacks
stops the apply until mapped onto an existing unit, and the import renames that unit to the archive's name (§5
«Conflicts»).

The built-in BOs are told apart by the BO `kind` (`PERSON`, `PERSON_GROUP`, `DEPARTMENT`, `COMPANY`), never by name:
the name is the company's own («Подразделения» in one company, «Департамент» in another) `[C]`. Their built-in fields
are `isSystem` and carry a field `kind` of their own (a company's added fields have `kind: GENERAL`) `[C]`:

| BO | field code — kind (type) |
|---|---|
| `Person` | `surname` PERSON_SURNAME, `name` PERSON_NAME, `phone` PERSON_PHONE, `email` PERSON_EMAIL (required, unique), `phoneVerified` / `is_external` (CHECKBOX), `department` PERSON_DEPARTMENT (BO SINGLE → Department), `position` PERSON_POSITION (dropdown), `status` PERSON_STATUS (option ids `ACTIVE` / `INACTIVE` / `FIRED`), `accessLevel` PERSON_ACCESS_LEVEL — the role, option ids `ACCESS_ALLOWED` «Пользователь», `ACCESS_ALLOWED_CONTROL_BO` «Администратор объектов», `ACCESS_ALLOWED_CONTROL_PERSON` «Администратор пользователей», `ADMIN` «Суперадмин»; `personGroup` PERSON_PERSON_GROUP (BO TABLE → PersonGroup), `person_avatar` (FILE_UPLOAD), `adGuid` / `ad_employee_id` (AD sync), `is_lang` PERSON_IS_LANG (option ids `RUS` `ENG` `KAZ` `QAZ`) |
| `PersonGroup` | `name` PERSON_GROUP_NAME, `header` PERSON_GROUP_HEADER (BO SINGLE → Person), `users` PERSON_GROUP_PERSON (BO TABLE → Person) |
| `Department` | `name` DEPARTMENT_NAME, `header` DEPARTMENT_HEADER (BO SINGLE → Person), `parent` DEPARTMENT_PARENT (BO SINGLE → Department), `person` DEPARTMENT_PERSON (BO TABLE → Person) |
| `Company` | `code` COMPANY_CODE (required, unique), `name` COMPANY_NAME (required, unique), `company_email` COMPANY_EMAIL «Почта админа» (required, unique), `company_user_role` COMPANY_USER_ROLE (option ids `ADMIN` «Администратор» — the default — / `ACCESS_ALLOWED` «Пользователь»), `company_enabled` COMPANY_ENABLED «Активный» (option ids `true` / `false`, default `true`), `link` «Ссылка» (BO SINGLE → `Company` itself, kind GENERAL) |

A company may hang hooks on these BOs like on any other (`hasScript`), so a test record of them runs the company's
own scripts.

**A fourth built-in BO — «Аккаунт» (code `Company`, BO kind `COMPANY`)** `[C]`: the list of the COMPANIES (tenants)
of one domain — a stand may hold several, each a record of it, and **a record's id IS that company's `companyId`**
(the one `stand_list` / the session gives). Only the special account with the login `root` sees and edits this BO;
for an ordinary admin of a company it does not exist at all — not in the BO groups, and `load-bo-id-by-code`
`Company` answers «not found» — although its own rights (R5 `load-access-group`) say VIEW «всем»: it is hidden by
the login, not by the rights model. `root` sees it in the general group «Общее» (`kind: DEFAULT`) next to the other built-in BOs: they sit in no group, and only the general group lists them `[C]`. Its
Email field (`company_email`, kind `COMPANY_EMAIL`) carries the «Выслать приглашение» link to that company's admin
(below). A change on a record of it changes a live tenant — never touch an existing company's record as a test.

**A new «Аккаунт» record creates a company and invites its admin** `[C]`: `root` saves it through the §6b form cycle
(`record_save` on `Company`: `code`, `name`, `company_email`, `company_user_role`, `company_enabled`) — the answer
carries the notification `company_invitation_is_send`, and the address in `company_email` gets «MyBPM - приглашение
на регистрацию»: the login (= that address) and a link `https://<stand>/set-new-admin?invitationId=<id>` where the
admin enters a surname, a name and a password `[C]`. The new tenant starts with one BO group «Общее» (code `General`, kind `DEFAULT`) holding only «Пользователи»,
«Департамент» and «Рабочая группа», and one user — the admin, named by what they entered on that page `[C]`. Its users, BOs and menu are reached by logging in as that
admin `[C]`; the admin does not see «Аккаунт».

**«Выслать приглашение»** sends the invitation again. It is NOT a `BUTTON` widget: it is part of the Email field
itself (field kind `PERSON_EMAIL`, the `dff-input-email` component), drawn only on an existing record's card
(never in the create dialog) and only for a user with the right `SEND_invitation` `[C]`. The call:
`POST /web/v2/invitation/send-to-person` P `{personId:<the record id>}` → `null` `[C]`. The UI then shows a short-lived toast that the link was sent; that one is toast-only and never kept in the bell `[C]`, so a
headless call has no trace of it — the person's mailbox is the proof. The rest of `v2/invitation` `[I]`:
`check-person {invitationId}` and `v2/complete-person` (the invited person sets the password),
`send-to-person-password` / `v2/send-to-person-password {email, clientType}` (password reset),
`send-to-admin {companyId}` — the same link on a company card's Email of kind `COMPANY_EMAIL`.

The head / employees / department flags of «Из поля»: not known yet `[U]` — §12.

### API — `POST /web/v2/business-objects/<method>`

- `load-access-group` params `{businessObjectId}` → an object with the actions
  `all, useAll, view, edit, create, delete, archive, export, duplicate, add`. Each action:
  `accessForAll` (false = ВЫБОРОЧНО), `participants`,
  `authorsField{accessForContent, accessForHead, accessForAuthor, accessForEmployees, accessForDepartment, …}`
  (**null on untouched BOs — create the object**), `fromFields{<fieldId>: same flags}`,
  `orgUnitRecordList[{id,type:GROUP|PERSON,name,…}]`, `orgUnitToAdd`, `orgUnitToDelete`.
  Mapping: «Автор (инициатор)» = `authorsField.accessForAuthor`; «Содержимое поля» =
  `fromFields[fieldId].accessForContent`. `accessForAuthor` is true on every `fromFields` entry of
  `all`/`view` by default, and it opens nothing (below).
- **What each subject opens** `[C]` — for a non-admin user reading the registry
  (`load-bo-instance-bracket-table` → `totalHits`), `view` set to `accessForAll:false` plus ONE subject:

  | subject (`view`) | the user sees |
  |---|---|
  | nothing at all | no record |
  | `fromFields[<Person field>].accessForContent` («Из поля → Содержимое поля») | exactly the records whose field holds them |
  | `authorsField.accessForAuthor` («Автор (инициатор)») | exactly the records they created |
  | `participants:true` («Участники») | the records they are a participant of |
  | `authorsField.accessForContent` alone | no record |
  | `fromFields[<field>].accessForAuthor` alone | no record — the default `true` there is inert |

  **Participants**: the author of a record is its participant from the start (so `participants:true`
  also shows a user their own records); `v2/business-object-instance/members-of-instance` —
  `P {businessObjectId, boInstanceId, draftId:null}` → `[{id, type:"PERSON", name, email, …}]` reads them;
  `add-members-to-instance` (same params, **B** = an array of org units `[{id,type:"PERSON",name}]`, → `""`)
  and `delete-members-from-instance` (same params, the same array of the units to drop, → `""`) change them `[C]`. A Person field with `needAddToParticipants:true` adds the
  person put into it — even through the script-less draft cycle (§6a). Each addition raises a bell event
  «Вас добавили» (`type:"ADD_PARTICIPANTS"`) for the added person (`v2/user-notification/count` →
  `events`). A user named in the field of a record they are NOT a participant of does not see it under
  `participants:true` alone.
  Not measured `[U]`: `accessForHead` / `accessForEmployees` / `accessForDepartment` / `…ParentDepartment` /
  `…ChildDepartment` and `authorsField.fieldIds`. The latter is
  `[I]` the Person fields of the AUTHOR's own record — `load-org-field-record-list` lists, under each Person
  field, the Person BO's own Person fields (`Преемник`, `Предшественник`), and `load-field-access-author-person-list
  {name:"Сотрудник"}` serves the author row the same way.
  **Re-sending `fromFields:{}` does NOT remove a field entry** — the server keeps it; set its flags to
  `false` instead. Treat the visibility of a record created right after a rights save as unreliable for a
  minute — it may show although no subject covers it; re-check after a re-save.
- `save-access-group` body `{businessObjectId, accessGroup:<the same object>}`.
  **Groups persist only through `orgUnitToAdd` (full unit records) / `orgUnitToDelete`, NOT through
  `orgUnitRecordList`** `[C]` — the UI sends `orgUnitToAdd: []` for groups that are already there.
  The UI follows the save with `save-business-object-portion`, body
  `{jsonPart:"{\"businessObject\":{\"id\":\"<bo>\",\"nameMap\":{},\"recordNameMap\":{},\"chosenAccessRight\":true}}",orderIndex:0,isLast:true,id:null}`.
- `load-org-field-record-list` params `{businessObjectId}` → the Person fields usable in rights
  `[{id,name,kind}]`. Some reference fields are not offered (a «Сотрудник» field may come back `[]`).
- `load-org-unit-record-list` params `{filter:"", skipFirstCount:0}` → groups (and users). **Group ids in
  the API have no `G-` prefix**; the archive's `orgUnitIds` use `G-<id>`. A group's id is its `PersonGroup`
  record id `[C]`.
- Field rights: `load-field-access-group` params `{businessObjectId, fieldId}`;
  `save-field-access-group` body `{businessObjectId, fieldId, accessGroup}` — only `view` + `edit` matter.
  The UI follows it with `save-bo-field-chosen-access-right` — **PARAMS** `{boId, fieldId, chosenAccessRight}`
  (`true` while any action is not «все», `false` turns the field's lock off) `[C]`; a flag written right after
  the rights can be overtaken by a late earlier write — read the field's `chosenAccessRight` back `[C]`.
- Tab rights: `load-field-tab-access-group` params `{businessObjectId, fieldId:<TAB_GROUP field id>, tabId}`;
  `save-field-tab-access-group` body `{businessObjectId, fieldId, tabId, accessGroup}`. An unknown/unset
  `tabId` answers `view.accessForAll:true, authorsField:null`, so a «никто» answer is real.
  The UI follows it with `save-bo-field-tab-chosen-access-right` — **PARAMS** `{boId, fieldId, tabId,
  chosenAccessRight}` (in the body: 400 «Required parameter 'boId'») — which only turns the lock on the
  tab chip orange `[C]`. Both live on `v2/business-objects`, not on `v2/access`. A tab carries only VIEW;
  «никто» hides the tab and its registry columns from non-admins, never from an admin `[C]` (R5 step 6). To reset a tab: `accessForAll:true`, `orgUnitToDelete` = the
  current `orgUnitRecordList`, then the flag `false`.
  **Tab rules travel in an archive** `[C]` as
  `AccessStructDto.fieldAccessStructMap.<TAB_GROUP code>.tabAccessStructMap.<tab code>`; details in
  `MYBPM-IMPORTS.md` §7.
- **Field and tab ids on the stand equal `newId` in an imported archive** — that is how a generated archive
  and the API are stitched together.
- Also seen on the controller: `load-field-access-author-person-list`. Dictionary options:
  `load-dictionary-bo-field-options {boId}`.
- **Group rights travel in an archive** `[C]` (export with «Права доступа»; the import puts the groups
  back). An archive WITHOUT an access DTO leaves the rights untouched. The export also writes each mentioned
  group as an `ExportStructInstanceDto` (`boCode:"PersonGroup"`). «Из поля → Содержимое поля» may come back
  unchecked after a re-import — re-check `fromFields` after an import that carried rights.

## 4. Sidebar menu — controller `v2/menu-item`

Everything in this section is `[C]`.

- `create-menu-item` body = the item itself:
  `{id, type: GROUP|BO, displayName, displayNameMap{RUS}, boId, iconName, orderIndex, isPanel:false,
  boPages{…}, chosenAccessRight:false, parentId}`; `id` comes from `v2/id-loader/load-portion`. It answers
  `null` and keeps that id `[C]`; the `boPages` of the body hold — list, kanban and timeline come on at once, no
  `save-menu-item-bo-pages` after it `[C]`.
- **The stand makes the item's CODE itself, by transliterating the name** `[C]`: «MCP группа» → `MCP_gruppa`
  — not rule 12. The API call behind «Изменить код» is not known `[U]`; an item with a code of your own comes
  through the archive (`MenuItemStructDto.code`, `MYBPM-IMPORTS.md` §5e).
- **The UI creates only `BO` and `GROUP` items** `[C]`. The client enum also has `ANALYTIC`,
  `BO_MANAGER`, `COMPANY_MANAGER`, `SETTINGS` (the built-in items, one of each per company), `REPORT`
  (operative reports, their own export basket, R4a) and `PROCEDURES` — none is created by hand.
- `iconName`: **every item you create gets an icon BY MEANING, without being asked** — each group by ITS
  OWN theme (Клиенты → `phosphor:address-book`, Работы → `phosphor:briefcase`, Склад → `phosphor:archive`; two groups never
  share an icon, a group never takes one of its items' icons), each item by what its records are (клиенты → `phosphor:users`, заказ-наряды →
  `phosphor:wrench`, оплаты → `phosphor:money`), each dictionary by what it lists (марки → `phosphor:car`, посты →
  `phosphor:buildings`, причины → `phosphor:warning`; `phosphor:book` only when nothing fits); items of one group differ; the report lists «item → icon». The generic defaults GROUP `bo-g-draggable`, BO
  `man-with-company`, dictionary `bo-d-draggable` (no prefix) only when the user wants no icons.
- **Icons by meaning** `[C]` — a short list, all names exist on the stand (the full 1153: «Menu icon catalogue» below):

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
- `delete-menu-item {menuItemId}` → `null`, the item leaves `load-nav-items` `[C]`; `load-nav-items {parentId}` → the children with their ids
  (`{parentId: null}` → the roots). Each item carries a `code` too — the menu CODE by which a structure
  archive addresses it (`MYBPM-IMPORTS.md` §5e); the kebab's «Изменить код» edits it.
- **Menu items also travel in a structure archive** `[C]` — `MenuItemStructDto`, parent /
  BO / kanban column field all by code (`MYBPM-IMPORTS.md` 0.5d, 0.15, §5e); export them with the menu basket
  of §0U R4a.
- **A menu item's kanban URL mislabels its ids** `[C]`: opening a BO item with the kanban on
  goes to `/business-objects/viewing-single/bo/<menuItemId>/kanban-view?businessObjectId=…&fieldId=…&menuItemId=…&boId=…`,
  where the real menu item id is the PATH segment and the `menuItemId` QUERY parameter carries the kanban
  column FIELD id. Read ids off the path, not the query.
- The built-in root «Системные» has `orderIndex` 60000 — put your own roots after it (100000, 200000, …).
- `save-menu-item-bo-pages` params `{menuItemId}`, body `boPages` = the item's views: list, kanban,
  calendar, timeline, map, grouping, each an `is*Enabled` flag + an `*Index` (tab order, 1-based over the
  enabled views; always send all twelve keys, disabled ones with index 0). What each view needs `[C]`:
  list — nothing; kanban — `kanbanFieldId` = a `DROPDOWN_SINGLE` of the BO AND that field's card template on
  the BO (§7); calendar — the BO's `isCalendarEnabled` (§5l) and a `FULL_DATE` with `needShowToCalendar` (§5h),
  nothing on the item; timeline — `timelineFieldId` = a `PERIOD` / `PERIOD_TIME` field (`v2/timeline/load-fields`,
  «Menu-item rights» below), nothing else; map — the BO's `isMapEnabled`, a `GEO_POINT`, and a kanban card
  template for every dropdown (§5l); grouping — dead server-side, never enable it. Kanban keys: `isKanbanEnabled`, `kanbanIndex`, `kanbanFieldId` — they switch
  the board and its COLUMNS on for THIS item; the CARD lives on the BO and must come from the archive (§7).
- Icons: `save-menu-item-icon-name` params `{menuItemId, iconName:"<namespace>:<name>"}` (empty 200).
  **Valid names = the catalogue below** (1153 names, `phosphor:*` AND `menu-item:*`); the server accepts
  anything, so a wrong name is found only as a blank in the sidebar. Built-in items inside «Системные»
  use system icons (portfolio, no-color-settings, no-color-archive, man-with-company) — leave them alone.
- UI: the sidebar row kebab (⋮) offers Отображать в моб. приложении / Изменить код / Права доступа /
  Переименовать / Изменить иконку / Разгруппировать / Удалить. Sidebar names are `<input>` values inside
  `app-bo-record`; clicking `.container` puts the id into the URL. The calls behind «Переименовать», a
  reorder / move into another group, «Изменить код» and «Отображать в моб. приложении» (`needHideInMobApp`,
  `needCountMenuItem`), and where a menu item's views are switched in the UI: not known yet `[U]` — §12.

### Menu icon catalogue `[C]`

Every value `iconName` may take besides the defaults (GROUP `bo-g-draggable`, BO `man-with-company`,
dictionary `bo-d-draggable` — no prefix). The same list serves both routes: `save-menu-item-icon-name`
/ `create-menu-item` here, and a `MenuItemStructDto` line in an archive (R6, §5).

- **The server checks nothing** `[C]`: `create-menu-item`, `save-menu-item-icon-name` and an archive
  import store any name verbatim — a name with a space, a made-up name — and the dry run stays clean and applies (`APPLIED`).
  A wrong name shows up only in the sidebar — an EMPTY place instead of an
  icon. So copy every name from the list below; when the user describes an icon by meaning («домик»,
  «деньги»), take the closest name and say which one you took.
- **How the frontend draws a name**: `<namespace>:<name>` is fetched as
  `/assets/icons/<namespace>/<name>.svg` (a name with a space is URL-encoded
  and drawn). So «valid» = «the file exists»: all 1153 names below answer HTTP 200, a made-up one 404.
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
  + `accessGroup` (the `AccessStructDto` action shape, `orgUnitIds:["G-<id>"]`)
  (`MYBPM-IMPORTS.md` §0.5d, §0.15, §5e). The calendar and timeline views of
  `boPages` travel too — the timeline as `timelineFieldCode` (a `PERIOD` field's code) — `[C]`;
  set them over the API with `save-menu-item-bo-pages` params `{menuItemId}`, body = the whole `boPages`
  (`timelineFieldId` = a field of `v2/timeline/load-fields {boId}` — the BO's `PERIOD`/`PERIOD_TIME` fields).
- **No cascade; each item is filtered by its own `view`** `[C]` (a non-admin user's `load-nav-items`, the
  call the sidebar makes): a GROUP closed to them («ВЫБОРОЧНО», nobody) disappears from the root, but
  `load-nav-items {parentId:<that group>}` still returns its open children — they are only unreachable in
  the sidebar. With the group open and one child closed, only the other child comes back; that child
  reappears once the user is put into its `view.orgUnitToAdd` (a PERSON unit works as well as a group).
- **Menu rights and BO rights are independent** `[C]`: an item open to the user stays in their sidebar while
  the BO's own `view` shows them nothing — the registry then opens empty. Hide a screen with the menu
  rights, protect the records with the BO rights (§3).

### Record filters (bracket filters)

- `load-bracket-filter {menuItemId}` **creates** the item's filter record if it is missing
  (`bracketFilterId` is null until then) and answers it whole: `{id, companyId, boId, fieldId:null, type:"MENU_ITEM",
  actual, brackets}` `[C]` → then `v2/bracket-filter/save` body `{id:<filter id>, boId, brackets:[root]}` → `null`
  `[C]`. `brackets: []` clears the conditions — the item lists every record again `[C]`.
- **An archive can carry the filter instead** `[C]`: a menu line's `bracketFilter.brackets` (maps keyed by
  8-char ids, `fieldCode` instead of `fieldId`) imports whole — `MYBPM-IMPORTS.md` §5e; a dictionary
  dropdown entry there takes `value` = the row's `code`, no `businessObjectId` `[C]`. One BO may have several
  items, one per user job (a list of all, «Мои …», «… в работе»), each with its own filter.
- A bracket: `{id, parentId, parentTreeIds, connectionType, notType: DEFAULT|NOT, dynamicFilters,
  nativeFilters, brackets}`.
- **Semantics** `[C]`: filters inside ONE bracket are AND-ed; a bracket's own
  filters are **IGNORED if it has sub-brackets**; siblings combine by the EARLIER sibling's
  `connectionType` — so put the OR on the first sibling.
- A dynamic filter: `{id (8 chars), fieldId, label, type, value, options:[], businessFields:[], businessObjectId:null,
  chipsMode:false, numberFrom:0, numberTo:0, selectedBois:[], boiIds:[], isCurrentUser:false, isEmptyValue:false,
  fromFields:[]}`. By type `[C]`:
  - a user field (`BO` → Person) «текущий пользователь»: `type:"BO"`, `businessObjectId` = the company's
    `personBoId`, `isCurrentUser:true`, `businessFields` = REFS of the Person Фамилия / Имя fields
    `{fieldId, orderIndex, label, toShow:true, type}` — bare field ids answer HTTP 400 «Failed to read request»;
  - a LOCAL dropdown (`DROPDOWN_SINGLE`, options on the field): `value` = the option's ID — its code matches nothing;
  - a DICTIONARY dropdown: `businessObjectId` = the dictionary BO, `value` = the option CODE (from
    `load-dictionary-bo-field-options {boId}`);
  - `CHECKBOX`: `value` `"true"` / `"false"`; `INPUT_TEXT`: `value` = the exact text;
  - the records the viewer created: `nativeFilters: [{type:"CREATED_BY", isCurrentUser:true}]`;
  - other types: the value shape is not known `[U]`.
- **«Пусто» does not filter** `[C]`: `isEmptyValue:true` is IGNORED by `load-bo-instance-bracket-table` —
  every record matches (BO, INPUT_TEXT, DROPDOWN alike), and its NOT matches none. Whether a SAVED filter honours
  it `[U]`. A `notType:"NOT"` bracket and an OR between sibling brackets work `[C]`.
- **Test a filter without saving it**: `v2/business-object-instance/load-bo-instance-bracket-table` body
  `{boId, dynamicFilters:[], nativeFilters:[], search:"", paging, ordering:null, state:"ALL", brackets}`
  → read `totalHits`.

## 5. Structure archive (`.mybpm.zip`) — import (UI and API) and export

What the archive CONTAINS and what import DOES → `MYBPM-IMPORTS.md` §1-8. This section is only the UI
route to upload/download one. `[C]`

**One domain hosts several companies (tenants).** The sidebar content differs completely per company — do not assume a
screen exists just because another company on the same host has it.

### Route

Sidebar item **«Настройки»** (top level by default, or inside the company's own menu group — see below) →
`/settings`, then the left sub-menu → **«Импорт/Экспорт»**.

- Direct URLs (work, no clicking needed): `/settings?settingsOpenPageUrl=import_export&formType=import`
  and `…&formType=export`. **Clicking the Импорт/Экспорт tab labels did nothing — navigate by URL.** `[C]`
- **«Бизнес», «Компания», «Настройки», «Аналитика» sit at the TOP LEVEL of the sidebar by default** —
  outside any group. A company may collect them into a menu group (e.g. «Системные»).
  **The group is a per-company menu arrangement, not a platform
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
  — an automation tool's element search and page-text extraction miss it or flatten it.

### Import tab

- Button **«Импортировать файл»** plus a search box and a log table: Импортированный файл / Описание
  импорта / Автор импорта / Дата импорта / Статус импорта. The log is per company and
  keeps years of history — read it to see what was ever imported and by whom.
- **The hidden file input is `input[type=file]` with `accept=".mybpm.zip, .mybpm"`, `multiple: false`.**
  Do NOT click the button (it opens the operating system's file picker, which automation cannot fill) —
  set the input's files with the tool's file-upload call (CDP `DOM.setFileInputFiles`, Playwright
  `setInputFiles`). `[C]`
- **The accessibility tree does NOT see that input** — it carries the `hidden` attribute. A tool that picks
  the target from the tree needs it unhidden first, then it shows up as `button type="file"`: `[C]`
  ```js
  const i = document.querySelector('input[type=file]'); i.hidden = false;
  i.style.cssText = 'display:block;width:400px;height:40px;position:relative;z-index:9999';
  ```

### Import is TWO-PHASE — upload analyses, a second step applies `[C]`

1. Setting the files of that input is enough to submit — no button click, no dialog. The page shows
   «Анализ структуры… N/N», then a toast «Анализ импорта завершен» and a **new log row with the status
   «Импорт проанализирован»**. *Nothing has been written to the stand yet.*
2. **Click that log row** → a full-screen dialog opens:
   - left tree: **«Информация»**, **«Ошибки»**, then one node per BO in the archive, labelled
     **`<вид объекта>/<имя БО>`** — the first half is the object's CATEGORY (a `BO_DICTIONARY` is
     «Справочник/…» whatever its `boGroupOldId`), not its BO group `[C]`;
     `load-import-bo-infos` returns that same `boCategory` per row;
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
  order are in «Import through the API» below. The upload is `postFileJson("/import-file", file, {})`.
- **The outer file name is free** — Cyrillic and spaces included. `[C]`
- **Cross-tenant import works**: an archive exported from one company imports into another. `[C]`
- «Описание импорта» is a free-text field stored per import — so the dialog asks for a description
  (the field was never opened; the dialog's exact contents are `[U]`).

### Import through the API — the whole cycle without a browser `[C]`

Optional accelerator, if `tools/` is available: `tools/api-import-structure.bun.ts` (`--apply` / `--cancel` /
`--import-id` / `--description`, token from `$MYBPM_TOKEN` or `--token-file`) makes the calls below.

Controller prefix is **`import-structure`**, NOT `v2/…` → `POST https://<stand>/web/import-structure/<m>`,
standard JSON envelope (§1), except the upload which is multipart. Order, exactly as the Angular client:

| # | call | params | returns |
|---|------|--------|---------|
| 0 | `/import-structure/load-import-state` | `{}` | `{importExists,importId,fileName}` — **only ONE import may be open at a time** |
| 1 | `/import-structure/import-file` | multipart, field **`file`** (filename = the outer name) | `importId` (a bare JSON string) |
| 2 | `/import-structure/insert-file-data` | `{importId}` | `processId` → poll |
| 3 | `/import-structure/analyze-file-data` | `{importId}` | `processId` → poll |
| 4 | `/import-structure/load-import-data` | `{importId}` | the log record: `status`, `error`, `conflicts` |
|   | `/import-structure/load-import-errors` | `{importId,pageId}` — first page: OMIT `pageId` (`pageId: 0` answers `IllegalId` «strId = `0`») `[C]`, then the `nextPageId` it returns | `{errorRecords:[]}` when clean |
|   | `/import-structure/load-import-bo-infos` | body `{importId}` (**body, not params**) | `[{importRecordId,name,boCategory,structTypes}]` |
|   | `/import-structure/load-import-bo-record` | `{importId,recordId}` | the per-BO pre-apply diff |
| 5 | `/import-structure/save-import-description` | `{importId,value}` | `null`; status `DESCRIPTION_ERROR` exists, so set it before applying |
| 6 | `/v2/process-indicator/pre-create-process` | `{}` | `processId` for the apply |
| 7 | `/import-structure/apply-import` | `{importId,processId}` | `{"type":"APPLIED"}` → poll the process |

- **Polling**: `POST /web/v2/process-indicator/load-state-short {processId}` → `{label,percentage,isFinished}`
  every ~1 s (the client uses 2 s); `…/load-state`, `…/delete`, `…/cancel` also exist. Steps 2/3 each
  return their own processId.
- **Everything up to step 4 writes nothing to the stand** — status stays `ANALYZED`. So the API route is a
  real dry run: upload, read `load-import-errors` + `load-import-bo-infos`, and only then decide.
  `/import-structure/cancel-import {importId}` drops it, `/remove-import` deletes the log row.
- **Rollback exists** `[C]`: after apply the record carries `rollbackAvailable:true,canRollback:true`, and
  `/import-structure/load-import-rollback-preview {importId}` + `/rollback-import {importId,processId}`
  undo the import (a rollback control in the UI import log: not known yet `[U]` — §12). **Only the import the
  stand considers the latest can be rolled back** `[C]`: the others
  carry `canRollback:false` + `newerAppliedImportsCount:N`, and `rollback-import` on them answers the body
  `{"message":"RwFGhT3idZ :: Rollback is allowed only for the latest applied import", …}` — and the
  `processId` you passed is then never finished, so a poll loop on it spins until your timeout.
  The preview answers `[C]`
  `{rollbackAvailable, canRollback, newerAppliedImportsCount, restoreItems:[], deleteItems:[{action:"DELETE",
  category:"BUSINESS_OBJECT"|"MENU", code:"<code>#BUSINESS_OBJECT"|"<code>#MENU", name, structTypes}]}` —
  exactly what was created, nothing else; after `rollback-import` the BO answers `NoBoWithId` and the menu
  items are gone. The process finishes with `percentage: 25` and `isFinished: true` — do not wait for 100.
- **An import never deletes** `[C]` (`MYBPM-IMPORTS.md` §8): fields, TAB_GROUPs and single tabs that a
  re-imported archive no longer carries stay on the BO with the same ids, and the fields on a dropped tab
  keep their `tabId`. Delete them with `deletedFieldIds` of `save-business-object-portion` (R1).
- **Rollback trap: «latest» is not the order you applied in, and a rollback restores a SNAPSHOT** `[C]`.
  An import that UPDATES something stores the state it
  found and puts it back on rollback (`restoreItems`, `action:"RESTORE"`), without looking at what came
  after: a later import's change to the same object is **silently lost**, and rolling back the next import
  may restore a state from an import that was already rolled back; the rollback of the import that
  CREATED the objects (`deleteItems`) removes them. **The ranking rule** `[C]`: imports are ordered by the
  MINUTE of `imported_at` (the upload time, minute precision), and **inside one minute the order is
  REVERSED — the import applied FIRST counts as the newest** (`canRollback` on it); an import applied the
  next minute ranks above all of them. Rules: when you may need to undo, **leave at least a minute between
  applies**; undoing a same-minute batch goes FIRST-applied first. Before undoing ONE import, check that it is the one
  with `canRollback:true`; undoing a CHAIN is safe only all the way back to the import that CREATED the
  objects, whose rollback deletes them. A rollback works as a re-import of that snapshot and inherits the import's
  defects `[I]`: undoing a re-import of an existing BO did NOT bring back a SIGNATURE phone or a radio's
  dictionary, and it ADDED one more copy of every print form instead of removing the copies `[C]`. Check
  those by hand after an undo.
- **A group line with `kind: "DEFAULT"` is permanent** `[C]`: a group CREATED by import with the kind copied
  from an export's «Общее» becomes the company's general group — `delete-business-object-group` and the
  rollback of that import both fail «Can not delete general group» (the rollback deletes the BOs, then stops,
  and the import stays `APPLIED`), `save-business-object-group` with `kind: MANUAL` is ignored, and the group
  now lists every BO that is in no group. An archive's group line carries `kind: "MANUAL"`
  (`MYBPM-IMPORTS.md` 0.3).
- **…except a line for the general group itself** `[C]`: a matched group takes the line's `kind`, so a line
  with code `General` and `kind: "MANUAL"` demotes the company's «Общее» (`DEFAULT` → `MANUAL`, `isGeneral:
  false`). The company then has no general group: the built-in «Пользователи», «Департамент», «Рабочая
  группа», «Аккаунт» (they sit in no group) vanish from the BO list and from `load-bo-groups`, and the
  caption-level ⊕ of the constructor creates nothing (§5b). Rolling back that import restores `DEFAULT` and the
  built-in BOs `[C]`; other repairs `[U]`. A line for «Общее» repeats `"kind": "DEFAULT"` as
  `load-bo-groups` gives it.
- **A reference to the built-in `Person` in an archive resolves by `boInfo.code`** `[C]`: `oldRefBoId` may be
  `""` or another company's `personBoId`, with or without the `CompanyMetadataStructDto` line — the imported
  field points at THIS company's `Person` and picks its users. No `personBoId` needs to be read off the stand
  for an archive; `boInfo` itself is mandatory (without it the analysis ends `INTERNAL_ERROR` «fieldStruct with
  type BO don't have boRef»). In the constructor (R1) the field still takes the company's `personBoId` as
  `fieldBoId`.
- **`load-business-object-name` is not an existence check** `[C]`: after a rollback it still answers
  the deleted BO's name, while `load-bo-id-by-code` gives `No bo with code` and
  `load-business-object-by-id` «бизнес-объект не существует». Verify a removal with those two.
- **A deleted BO comes back — with ALL its old fields** `[C]`. A rollback and `delete-business-object` both
  delete a BO SOFTLY: gone by code (`load-bo-id-by-code` → «No bo with code», out of the sidebar, an emptied
  group created by the import vanishes), while its id still holds the BO with every field
  (`load-business-object-name`, `load-bo-fields-for-drag` by id answer). An archive that carries the same
  `oldId` again brings it back with all its OLD fields beside the new ones; the old fields keep their
  `gridPosition` and overlap the new layout, and the analysis diff lists only the new fields as «added», with
  no warning `[C]`. A revived `BO` field whose dictionary was removed by a ROLLBACK keeps the dead id:
  `v2/script/load-bo-field-options` (opening the dropdown on a record) answers «Cgf5V16VU4 :: … данный
  бизнес-объект не существует» `[C]`; a dictionary removed by `delete-business-object` stays resolvable
  and the options are empty `[C]` (why the two differ — `[I]`: the rollback deletes a dictionary hard).
  Deleting instead of rolling back does not help. **A new attempt of a rolled-back or deleted system needs
  NEW ids** — a new build salt (`MYBPM-IMPORTS.md` 0.7 «Which ids», case 4); to keep a revived BO, delete its
  stale fields with `deletedFieldIds` (R1). Ids seeded from the code alone repeat across attempts — every
  build of a «Client» mints the same `oldId`.
- Enums in chunk `5675`: import status `IN_PROGRESS|ANALYZED|APPLIED|ROLLED_BACK|DESCRIPTION_ERROR|
  INTERNAL_ERROR|CANCELED`; apply result `APPLIED|ROLLED_BACK|DESCRIPTION_ERROR|HANDLING_ERROR`; struct
  types `STRUCTURE|ACCESS_RIGHTS|SCRIPTS|GLOBAL_METHODS|MENU|REPORTS|SETTINGS` (our archive → `STRUCTURE`).
- **Conflicts** (`/v2/struct/conflict/*`): a clean archive returns `conflicts:{}` `[C]`. The one kind is
  `SELECT_INSTANCE` — an org unit of the archive (`ExportStructInstanceDto` of a group named in its rights) whose
  id the stand does not know: `{selectInstance:{boId, exportedOrgUnitType, exportedOrgUnitName,
  exportedOrgUnitId, selectFromIds}, isResolved, sourceMap}` `[C]`. `apply-import` refuses while one is open
  («Conflicts have to be resolved before applying») `[C]`; the UI opens its conflict dialog right after the
  analysis, and cancelling it closes the import. Candidates: `load-select-instance-table` B `{importId,
  conflictId, searchValue:"", paging:{limit:20, offset:0}}` → the unit BO's registry rows `{businessObjectId, heads, records:[{instanceId,
  values:[{fieldId, value, displayValue}], state}], totalHits}` — the shown name is `values[].displayValue`, and DELETED
  units are listed too, with `state:"REMOVED"` (do not map onto one) `[C]`. Resolve: `resolve-conflicts` P `{importId}` B `[{conflictId, selectInstance:{selectedBoiId}}]` →
  `isResolved:true` `[C]`. There is NO «create» choice — the import never creates a group; and **the apply
  writes the archive's name onto the chosen group** (also onto a group whose id matches) `[C]`
  (`MYBPM-IMPORTS.md` §8).
- The BO-side `/web/v2/business-objects/import-structure` (`postFileJson`, param `startTestProcess:false`)
  is a DIFFERENT, single-call endpoint of the BO controller — not used here, untried `[U]`.
- **The import log** (the «Импорт» tab's table): `/import-structure/load-import-file-records` with `B {paging:
  {offset, limit}}` (without `paging` → NullPointerException) → newest first `[{id, fileName, description,
  imported_at, status, canRollback, newerAppliedImportsCount, …}]` `[C]`. The one reliable way to tell
  whether an import whose call was cut off (an in-page call cut by the tool's time limit, §10) got applied.

### The dry run as a VALIDATOR

The upload→insert→analyze→`load-import-errors`→`cancel-import` cycle above is the only validator
that is the platform itself `[C]`. A clean archive analyses as `status:"ANALYZED"`, `error:null`,
`conflicts:{}`, `errorRecords:[]`; a composite whose source BOs are missing fails as §0.2a predicts (below).

- **`load-import-bo-infos` is also an INTENT check, not just a format one** `[C]`. It answers
  `[{importRecordId,name,boCategory,structTypes}]` BEFORE anything is written, so it says in one call
  whether the archive builds a `BO` / `BO_DICTIONARY` / `BO_PANEL` / `BO_COMPOSITE` / `BO_PROCESS` —
  the one thing the form lint (`MYBPM-IMPORTS.md` 0.10) structurally cannot check («the grader checks FORMAT,
  not INTENT»).
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
  `ownerBoInfo` = who is broken, `requiredBoInfo` = what it needs and BY WHICH CODE. A composite whose `bos[]`
  names a code the stand does not have **fails loudly at ANALYZE time**, nothing is silently merged.
- **«Не найден бизнес-объект для пункта меню» on a BO the archive itself carries** `[C]` = the stand dropped
  that BO line silently, its menu item has nothing to open. Cause: a BO map key written as `[]` instead of `{}`
  (`boTabs`, `nativeFields`, `kanbanCardTemplates` …; only `bos`, `printForms`, `dictionaryFields` are lists —
  `MYBPM-IMPORTS.md` 0.9 rule 5). Cancel the import, fix the archive, re-upload.
- **The intra-archive reference survives the analyzer and the apply** `[C]`: the importer resolves a
  reference (by `oldId`, or a `BO_PANEL` plus the BOs it shows) to a line of the SAME archive. APPLY `[C]` too: a TABLE field
  pointing at a BO on an earlier line of its archive applied clean, the target kept its `oldId` as its id and
  the field's `refBoId` read back as that id (`MYBPM-IMPORTS.md` §0.2a).
- `REMINDER` lines of the form lint (`MYBPM-IMPORTS.md` 0.10; `WARN` in `tools/validate-archive.bun.ts`) are
  not import errors `[I]`: an archive with no other line analyses clean whatever their count.

**A composite's sources may travel in the same archive** `[C]`, and it is the
right way to ship a composite: a `BO_COMPOSITE` plus the plain BOs with the codes it names
in ONE archive analyses `ANALYZED`, 0 errors — `load-import-bo-infos` lists
all of them. Line order is irrelevant (the composite placed BEFORE its sources analyses the same).

**A missing FIELD code crashes the analyzer** `[C]`: when the sources are in the archive but their
field codes do not cover what the composite's `boFieldCodes` asks for, the import comes back
**`status:"INTERNAL_ERROR"`** with a Java
stack trace in `load-import-data.error` — `Optional.orElseThrow` in
`StructureImportAnalyzer.fieldCodeToId` ← `analyzeFieldStructs` ← `analyzeCoStruct` — while a missing BO
code is reported politely as `CO_UNSATISFIED_DEPENDENCY`.
Read `INTERNAL_ERROR` from an import as «a reference inside the archive does not
resolve», not «the stand is broken». Details in `MYBPM-IMPORTS.md`, the `bos[]` bullet.

**Driving the cycle from the page, without handing a token to the shell.** The extension refuses to return
`localStorage.LOCAL_PRIVATE_SwebToken` (§10), but a `fetch` INSIDE the page may read it. Serve the archives
to the page over plain HTTP from the machine —
`Bun.serve({port:8787,hostname:"127.0.0.1"})` with `Access-Control-Allow-Origin:*` and
`Access-Control-Allow-Private-Network:true` —
**an https page may fetch `http://127.0.0.1`** `[C]` (localhost is a trustworthy origin, no mixed-content
block). The page then does
`fetch(zip) → blob → FormData → /web/import-structure/import-file`, i.e. the whole §5 cycle per archive.

### Verifying an import through the API (no screenshots)

`POST /web/v2/business-objects/…` with the §1 envelope:

- `load-bo-id-by-code {boCode}` → the BO id. It returns exactly the archive's
  `oldId` — **the archive's `oldId` becomes the stand's BO id** `[C]`.
- `load-business-object-name {boId}` → the BO's name; `load-bo-groups {forEdit: true}` (PARAMS) → every group
  with `{id,name,code,orderIndex,kind}` — **without `forEdit` the groups that hold no BO are silently left out**
  `[C]`, so a before/after snapshot must take `forEdit: true`
  (the way to prove an import renamed nothing — **groups are matched by
  `code`; a group line without `code` renames one fixed group, and a line WITH an existing code still
  overwrites that group's `name` and `orderIndex` with its own** `[C]`, `MYBPM-IMPORTS.md` §0.3/§8). Undo a rename
  with `save-business-object-group`, body = that group object with the old `name` / `orderIndex` (answers
  `""`); a rollback does NOT restore it `[C]`;
- **The group lifecycle** (all `v2/business-objects/…`, PARAMS unless said) `[C]`:
  `create-business-object-group {orderIndex, kind: "MANUAL"}` → the group object, named «Группа №N» and
  **already carrying a code `Gruppa__N`** — a new group always has a code, only old groups have `null`;
  `save-business-object-group` BODY = the whole group object → `""` — renames, moves (`orderIndex`) and
  **changes the code**; a code already taken or `null` is refused with `IllegalArgumentException` «Bo group
  code is not valid or already exists» (re-saving a group whose code IS `null` with `code: null` passes —
  that is the rename repair above), so **giving a code-less group a code is one-way**: it can never go back
  to `null`. `verify-business-object-group-code {boGroupId, boGroupCode}` → `true` when the code is free —
  it checks only uniqueness (`"плохой код"` with a space answered `true`). `delete-business-object-group
  {boGroupId}` → `""` deletes an empty group. A code given by `save-business-object-group` is matched by
  the next archive like any other: the BO landed in that group, no group changed;
- `import-structure/load-import-file-records` — body `{paging:{offset,limit}}` (without `paging`: NPE) → the
  import log, newest first, `{id,fileName,description,imported_at,status,canRollback,…}`;
- **`apply-import` can answer an ERROR** instead of `{type:"APPLIED"}` — then the import stays `ANALYZED`
  and the `processId` never runs; test the answer for `errorType` before polling (e.g. «Нет скриптов для
  экспорта у БО с кодом …» — scripts onto an existing BO with an empty script module, `MYBPM-IMPORTS.md`
  §5d). `cancel-import {importId}` then closes it (`CANCELED`);
- `load-bo-fields-for-drag {boId}` → the BO's fields as `{label,type,…}`; **`code` comes back `null`** here,
  so it identifies fields by label only `[C]`.
- `load-bo-id-by-kind`, `load-bo-fields-by-ids`, `load-bo-dictionary-list`, `verify-business-object-code`,
  `verify-business-field-code` exist alongside `[U]`.

### Export tab

- Layout `[C]`: **four baskets, each with its own grey ⊕** —
  «Бизнес-объекты (N)», «Элементы меню», «Аналитика», «Настройки». Each basket has
  an API (§0U R4a). The BO basket has «Очистить все» — each row labelled **`<группа БО>/<имя БО>`** (e.g.
  «Бизнес-объект/БО с текстом») with three checkboxes **Структура / Права доступа / Скрипты** (they decide
  which DTO lines the archive gets: `BoStructDto` / `AccessStructDto` / `BoScriptVersionsStructDto` +
  `ScriptDefStructDto`, `MYBPM-IMPORTS.md` §5d) and two
  per-row icons; a right pane **«Зависимости:»** («Зависимости не найдены» when none); button **«Выгрузить»**.
- The basket is PERSISTED state — it keeps a selection from an earlier session. Check/clear it
  before exporting so you do not ship someone else's selection.
- **BOs get into the basket through the grey ⊕ right of the «Бизнес-объекты (N)» caption** `[C]`
 : it opens a dropdown «Какой элемент хотите найти?» — a search box over ALL BOs of the
  company with a checkbox per row plus «Выбрать все». Ticking a row adds it to the basket immediately
  (the counter goes up); the dropdown does not close on Escape — click elsewhere on the page.
  The sidebar's drop hint «перетащите бизнес объекты сюда» belongs to the MENU editor, not here.
- **To take a BO OUT of the basket use the row's trash icon**, not the ⊕ dropdown `[C]`: unticking the
  row there does NOT remove it. The trash icon asks «Удаление элемента — Удаление элемента `<имя БО>`»
  with ДА / НЕТ; ДА only drops it from the basket — **the BO itself is untouched**. The other per-row icon is a collapse chevron.
- **The whole screen has an API** — baskets + download, see §0U R4a; the basket writes included (`remove-*` takes id strings).

### Checking the result of a structure import

- **BO constructor: the sidebar item «Бизнес»** → `/business-objects/viewing-list` `[C]`. By default it is a top-level sidebar item; a company may move it into a menu group (e.g.
  «Системные») — see the Route note above, the grouping is per-company. Left panel = the
  list of BO GROUPS; the chevron on a group expands it
  into its BOs (grey rows underneath). This is the place to verify that an import did not rename a group.
- **This list is invisible to text extraction** `[C]`: page-text extraction, the accessibility tree and even
  `document.body.textContent` return only the outer chrome (the sidebar, not the list). Read it from **screenshots**, not from the DOM.
- Clicking a BO opens its registry: `/business-objects/viewing-list/bo/<boId>/list-view?…`.
- **The stand keeps the archive's `oldId` as the BO id** `[C]` — it is exactly the id in the registry URL. So deterministic generator ids are
  also the stand's ids, and a re-import of the same archive addresses the same BO.
- **Fields are matched by `newId`, not by code** `[C]`. A second archive with the same BO
  `oldId` but fresh field `newId`s passes the analysis with no error and no conflict. It then ADDS a second
  copy of every field to that BO, with the same codes, and rewrites the BO's code and name. To copy a BO,
  change its `oldId` and the field `newId`s, not only its `code` (`MYBPM-IMPORTS.md` §0.7).
- What an imported BO looks like straight away `[C]`: registry columns = the fields with
  `tableColToShow:true`, in `tableColOrderIndex` order; «Добавить» opens the form with the archive's
  `gridPosition` widths honoured (15 cols = full width, 5 cols ≈ a third); the platform appends a colon to
  every field label («Наименование:»); INPUT_NUMBER shows a default `0`; the record tabs
  В работе / Архивные / Удаленные / Тестовые and the empty state «Данные отсутствуют» come for free.
- Cancelling that «Добавить» form asks «Несохраненные данные — У вас есть несохраненные данные. Закрыть
  без сохранения?» (ДА / НЕТ) — a draft is created as soon as the form opens.

## 5b. Creating a BO in the constructor — no archive at all `[C]`

**Read this section only when** a BO (or a field, a setting, a script) must be created or changed WITHOUT an
archive — in the constructor UI or through its API — and jump to the subsection §0U names (5c–5f the five
kinds, 5g scripts, 5h–5i fields, 5j–5o BO settings). Importing an archive never needs it.

A BO does **not** have to come from a `.mybpm.zip`. The constructor creates one directly, and the same
six `/web/v2/business-objects/*` calls do it headlessly.

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
  the client then looks for a group of `kind: DEFAULT`, and **when no group is `kind: DEFAULT` (e.g. every group is `kind: MANUAL`)**
  nothing is created and the page is left half-rendered. **Always create from the group's ⋮.**
- **There is no dialog and no name prompt**: the click creates the BO immediately as
  «Бизнес объект №N» and routes to its constructor. Created is created — undo means deleting it.

### The constructor screen

Name input top-left, description beside it, the «Карточка / Вкладка» toggle, the palette
«Элементы страницы» (Email, Телефон, Число, Текст, Текстовое поле, Текстовый блок, Чекбокс, Время, Дата,
Дата и время, …) on the left, the form canvas on the right, and lock/gear icons top-right (access rights,
settings).

- **Fields are added by dragging** a palette item onto the canvas; an automation tool's press-move-release
  drag drives this CDK drag-drop fine. On drop the label input opens focused — type the label straight away.
- A **СОХРАНИТЬ / ОТМЕНИТЬ** bar appears at the bottom: **nothing about fields is persisted until
  СОХРАНИТЬ**. The BO **name and description save on blur**, with no bar and no confirmation.
- **Codes are generated by the server from the names** — never send one. «Проба UI 2026-09-18» →
  `Proba_UI_2026_09_18`; «Наименование» → `Naimenovanie`; «Количество» → `Kolichestvo`. The **BO code is
  truncated to 30 characters**: «Проба API-конструктор 2026-09-18» → `Proba_API_konstruktor_2026_09_`.

### The same thing through the API — `tools/create-bo-constructor.bun.ts`

| # | call | params / body | note |
|---|---|---|---|
| 1 | `load-bo-groups` | `{forEdit: true}` | resolve the group by name → `{id,name,code,orderIndex,kind}` |
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
  with an empty body and nothing is written `[C]`. It is the **registry-column writer** `[C]`: the registry
  editor («Список» view → the header row of the registry) saves every action AT ONCE, there is no СОХРАНИТЬ.
  Body `B {businessObjectId, fieldList:[…]}`, each entry carries `fieldId` and `archetype`:
  - **add** — the blue «+» at the end of the last header cell → a picker (search + a checkbox per field, a
    ticked row shows its order number); a tick sends `[{fieldId, tableColToShow:true, tableColOrderIndex:<last+1>}]`,
    then a second call re-indexes ALL columns `{tableColToShow:true, tableColOrderIndex:0..}`. Escape does not
    close the picker — click a blank part of the page;
  - **remove** — the trash on a hovered header cell (no confirm) or an untick: `[{fieldId, tableColToShow:false}]`,
    then the re-index call of the rest. **The last column cannot be removed**: its trash sends nothing, its
    checkbox is greyed;
  - **reorder** — drag a header cell by its label: every column `{fieldId, tableColOrderIndex}` in the new order;
  - **width** — drag the border between two cells: every column with `tableWidth` in px on the resized one,
    `null` on the others.
  On the FIRST card save of a BO with no columns the client adds the first 3 fields by grid position (not
  `TAB_GROUP` / `PROGRESS_BAR`) itself `[I]`. Widgets and `PROGRESS_BAR` are never offered as columns.
  Setting `tableColToShow` / `tableColOrderIndex` on the field DTO of the portion save does the same `[C]`.
- The constructor DTO from `load-business-object-by-id`: `id, idLong, name, recordName, nameMap,
  recordNameMap, staticValueMap, instanceViewType, orderIndex, description, code, formFields[], kind,
  boTabs, delBoTabs, isDictionary, hasScript, isCodeReadonly, boCategory, sortFieldId, …`. **`formFields`
  is an ARRAY** here — the archive's `dynamicFields` object keyed by code is a different shape.
- Field `gridPosition` in this DTO is `{x, y, cols, rows}` — `cols: 15` = full width, `rows: 3` = one line,
  so one-line field *i* sits at `y: i*3` (other heights: R1 «Layout»). `tableColToShow` / `tableColOrderIndex` behave as in the archive.
- `load-bo-records-by-group-id` takes **`groupId`**, not `boGroupId` (a wrong name answers HTTP 400
  «Required parameter 'groupId' is not present») → `[{id, name, nameReadonly, viewState, orderIndex,
  boCategory}]`, the cheapest way to list a group's BOs and check what an action created.

#### The rest of the constructor's controls — where each is and what it sends `[I]` unless marked

The API column is the call the control sends, usable alone. A row marked `[C]` was run on a stand with the
network log on; the rest is read off the client bundle — re-read the BO (`load-business-object-by-id`) after each
write. Open questions: §12.

| operation | UI control | API |
|---|---|---|
| Rename a field (label) | the field row header: inline input — a SINGLE click focuses it (a double / triple click does not: the row is a drag source) `[C]`; globe → per-language popover (only with more than one company language); `_` and `#` are blocked; a label must be unique within its tab | portion save with `editedFields [{fieldId, label, labelMap}]` (`label` applied this way `[C]`, §5i «Tabs») |
| Change a field code | gear → tab 2 «Инфо» («Идентификатор», «Системный тип», «Код» + pencil) → pencil → dialog «Изменение кода поля» (not for natives, not when `isCodeReadonly`). Opening it starts the usage analysis; **ИЗМЕНИТЬ КОД stays disabled until `is-analyze-done` answers `done:true` (~8 s) and the new code passes `verify-business-field-code`**; closing the dialog sends `field/refresh-code/cancel {refreshId}` `[C]` | `field/refresh-code/analyze-code-usage` P `{boId, fieldId}` → `{refreshCodeDtoId, …}`, `is-analyze-done` P `{refreshId}` polled, then ONE `field/refresh-code/apply-new-code` P `{refreshId, newFieldCode}` → `""` — live at once, no bottom СОХРАНИТЬ `[C]` (the cycle of §5j «Changing the code») |
| Move / resize a field | move: the drag handle (cross icon left of the label, on hover); resize: the corner handle at the item's bottom right. The grid compacts upwards: a field too wide for the gap beside another goes above it and pushes the rest down. **Any move or resize RESETS «Фиксировать при скроллинге» on EVERY field of the form** `[C]` — tick it after the last layout change. Adding a field from the palette sends only the new field and resets nothing `[C]` | portion save, `editedFields` = EVERY field `{fieldId, gridPosition, needFreezeWhenScroll:false}` `[C]` (R1); the flag alone: `editedFields [{fieldId, needFreezeWhenScroll:true}]` `[C]` |
| Default value | the field body on the canvas `[C]`: TEXT / TEXTAREA — type into it; CHECKBOX — the toggle LEFT of the label in the header; DATE — the date picker; a local dropdown — click an option chip; a radio — tick its circle; `*_LANG`: one input per language tab `[I]` | `editedFields [{fieldId, defaultValue}]` `[C]`; the server fills `defaultValueMap.RUS`. Stored as: text as typed (a TEXTAREA typed plainly gets no `<p>`), CHECKBOX the STRING `"true"`, DATE a JSON-QUOTED ISO string with the current time of day in UTC (`"\"2030-01-15T09:41:07.091Z\""`), dropdown / radio the option id. A new record's draft («Добавить», `create-draft-with-boi`) shows every default `[C]` |
| List options (`DROPDOWN_SINGLE` with a local list, `RADIO_BUTTON_GROUP`) | the field body `[C]`. Dropdown: link «Выберите» → popover, type into «Введите данные» + Enter adds an option; each chip shows `id: …`, its gear → popover «Изменение кода» (Сохранить takes TWO clicks — the first only verifies), × deletes at once with no confirm. Radio: «Добавить» under the list adds a row with a required label; hover icons info (`id`), gear (code, as above), trash. A per-language label pencil appears only with more than one company language `[I]`; with one language an option cannot be renamed — delete + re-add mints a new id. **Colour, «hide» and order are NOT here** — they live in the constructor's «Канбан» view (next row) | `options[]` `{id, label, labelMap, orderIndex, code, color}` on the field DTO, sent as `editedFields [{fieldId, options:[…all options], defaultValue?}]` `[C]`; a new option gets an id, `orderIndex` = last + 10000 and a colour the CLIENT picks `[C]`; a deleted one also goes into `deletedFieldOptionIds`; an option code is checked by `verify-business-field-code {businessObjectId, businessFieldCode}` and set by an EDIT of `options` after the add (§5h «Единичный выбор») |
| Option colour, «hide», order (`DROPDOWN_SINGLE`) | the constructor's view selector (top right) → «Канбан» (`…/kanban-editing`): one column per option of the dropdown; column header ⋮ → «Изменить цвет» (a colour picker, closes on an outside click) / «Скрыть из списка» (the column greys out); drag a column by its «+» handle to reorder. Each is saved AT ONCE, no СОХРАНИТЬ `[C]` | `v2/kanban/save-business-field-option` P `{boId, fieldId}` B the whole option DTO `{instanceId:null, id, label, color, code, orderIndex, hiddenInKanban, labelMap}` → `""` `[C]`; colour = the picker's hex, hide = `hiddenInKanban:true`; a drag saves ONLY the moved option, `orderIndex` = its new neighbour − 10000 (or + 10000) `[C]` |
| Progress steps (`PROGRESS_BAR`) | gear → tab 1 «Отображение» → «Добавить шаги»; per step «Названия шага» input + link «Изменить код» (popover «Изменение кода», Сохранить twice); ⊕ on the first step's row adds one, trash per step; then the popover's СОХРАНИТЬ. **Switching to «Поведение» or clicking outside before that drops the unsaved steps** `[C]` | `progressSteps[]` `{id, orderIndex (1-based), label, code ("" if unset), labelMap}` in the portion save `[C]`, deleted ones in `deletedFieldProgressStepIds`; a step code is checked by `verify-progress-step-code {boId, fieldId, progressStepCode}` and travels in `progressSteps[].code` — the constructor sends NO `save-progress-step-code` `[C]` |
| Questionnaire rows / columns | the field body `app-questionnaire` `[C]`: green ⊕ right of the header row adds a column, «Добавить» under the table adds a row; click a label to edit it inline; hover a column header / a row → gear (popover «Изменение кода», Сохранить twice) + trash (deletes at once, no confirm) — a row's icons sit outside the table, right of the row, and vanish when the pointer leaves it. **An empty row / column label is `required` and makes the whole form invalid → the bottom СОХРАНИТЬ greys out with no message.** Single / multiple: gear → «Отображение» | `questionnaires[]` `{id (client-minted), label:null, labelMap, orderIndex (0-based per rows / columns), isColumn, code}` `[C]` — a column whose code was never set has no `code` key; a row code is checked by `verify-business-field-code`, a column code is not; deleted ones (even never saved) in `deletedFieldQuestionnaireIds`; `questionnaireIsMultiple` |
| `STATIC_TEXT` body | the field body: a summernote editor with language tabs; the type has NO gear. **At the default height (rows 3) only the toolbar shows — the editing area is clipped to nothing; resize the field taller first** (a resize: the freeze-reset trap above). Toolbar `</>` = code view with the raw HTML; leave code view (`</>` again) before СОХРАНИТЬ — only then is the code copied into the editor `[C]` | `staticValueMap` via `editedFields [{fieldId, staticValueMap:{RUS:"<html>", …}}]` `[C]`; a styled `<div>` with inline `style` is stored byte for byte `[C]` (§5b «The same thing through the API») |
| Nested table columns (`BO` field, view «Табличный») | the gear at the RIGHT END of the table's header row on the canvas (not the field row's gear) → popover: search + one checkbox per field of the referenced BO, each ticked one with an order badge; **order = tick order** (untick + re-tick moves a column to the end). Ticking writes nothing, it only reloads the preview `[C]` | bottom СОХРАНИТЬ → `editedFields [{fieldId, boFieldRefs:[…]}]` — ticked = `toShow:true` with a 0-based `orderIndex`, unticked = `toShow:false` (its stale `orderIndex` is harmless) `[C]` |
| Reference field (`BO` / `CO`) settings | gear → tab 1 → sub-tabs «Отображение» («Вид отображения», «Динамическая высота», on a SINGLE field «Выбрать поля для отображения») and «Поведение» («При добавлении/изменении объекта…», «Выбор/Добавление ↔ Только добавление», «Помечать новые», «Связь объектов», «Зависимость полей»); «Добавлять в участники…» sits in the TOP checkbox list, only on a field → the Person BO `[C]` | keys and effects: §5h «Reference fields (`BO` / `CO`)»; set «Зависимость полей» one level per СОХРАНИТЬ (§5h «С фильтром» and «Зависимость полей») |
| Add a `TAB_GROUP` | palette search «Вкладки» (section «Виджеты») → drag onto the form; it comes with one tab whose label input is empty (orange border) — СОХРАНИТЬ stays grey until the tab is named `[C]` | `generate-business-form-field {boId, fieldType:"TAB_GROUP"}` answers `label: null`, the client sets label «Вкладки», so the first save gives the group the code `Vkladki` (the `label: null` → `code: ""` trap is API-only) `[C]`; the save: `addedFieldIds` + `editedFields [{fieldId, gridPosition, needFreezeWhenScroll:false, tabs}]` |
| Tab strip of a `TAB_GROUP` — add, rename, reorder | each tab: pencil (left), label input, gear, lock, trash. **Add**: the green «+» after the last left-hand tab → menu «Добавить вкладку здесь» (the new tab right after it) / «Добавить вкладку справа» (the new tab at the RIGHT end of the strip). **Rename**: the pencil focuses the label input, caret at the end; type, click away. **Reorder**: drag a tab by its label (a plain mouse drag); a right-hand tab stays at the right end. While a label input has focus the rest of the form is blurred; the first click on an icon of an inactive tab may only activate it — click again `[C]` | bottom СОХРАНИТЬ → portion save with the group in `editedFields [{fieldId, tabs[]}]`; a new tab `{id, label:"", labelMap:{RUS}, isActive, chosenAccessRight:false, orderIndex, isInvalid:false, isRight, isDefault:false}` («справа» = `isRight: true`) — the server fills `label` from `labelMap` and derives the code from it (`Detali`). **A rename never recodes a tab.** A reorder sends the new array order with the OLD `orderIndex` values — the server renumbers from the array position `[C]` |
| Tab code | tab gear → popover «Изменение кода вкладки» (input, СОХРАНИТЬ / ОТМЕНИТЬ) — saved at once, no bottom СОХРАНИТЬ `[C]` | `v2/business-objects/update-tab-code` **PARAMS** `{boId, fieldId:<group>, tabId, newTabCode}` → `""`; no verify, no usage analysis `[C]` |
| Tab rights | tab lock → popover with ONLY «Просмотр»: «Операция доступны ВСЕМ / ВЫБОРОЧНО»; ВЫБОРОЧНО pre-adds an «Автор» chip — remove it (its ×) for «никому»; popover СОХРАНИТЬ saves at once, the lock turns orange `[C]` | `save-field-tab-access-group` + `save-bo-field-tab-chosen-access-right` (R5 step 6, §4 «Tab rights»); ВЫБОРОЧНО with no chip = VIEW «никто» `[C]` |
| Delete a tab | tab trash → dialog «Удаление вкладки: использование в скриптах» (places of use, УДАЛИТЬ ВСЁ РАВНО / ОТМЕНИТЬ) → the tab **and every field on it** vanish → bottom СОХРАНИТЬ. **The dialog does not say the fields go too**, and the usage analysis covers the tab only, not its fields — before deleting a tab move off it the fields to keep, or check each field's usage (§5b «Delete a field») `[C]` | `v2/delete-script-usage/analyze-tab` **PARAMS** `{boId, fieldId:<group>, tabId}` → `{analyzeId}`, `is-analyze-done {analyzeId}` → `{done, errorMessage, hits}`; the save: `editedFields [{fieldId:<group>, deletedFieldTabIds:[tabId], tabs:[the rest]}]` + `deletedFieldIds: [the tab's fields]` `[C]` |
| Move a field onto / off a tab | onto: drag the field's cross (left of its label) into the body of the ACTIVE tab. Off: a field on a tab shows a u-turn icon right of its cross, tooltip «Убрать из вкладки» → the field goes below the group `[C]` | onto: `editedFields [{fieldId, tabId}]` (no `gridPosition`; the UI sends the whole BO, so `formFields` carries the `tabId` too — §5i «Tabs»); the server keeps the field's old `y`, the tab grid compacts on render. Off: `editedFields [{fieldId, gridPosition}]` without `tabId` → the server clears `tabId` `[C]` |
| Code of a `TAB_GROUP` | group header (hover) → gear → «i» Инфо → pencil by «Код» → the ordinary «Изменение кода поля» dialog (§5b «Change a field code») `[C]` | same calls as any field code (`apply-new-code`); `save-business-field-code` is the API alternative |
| A widget's code | the widget's gear popover: «Код: <code>» + pencil → dialog «Изменение кода поля» (ИЗМЕНИТЬ КОД greyed until the code is verified); hidden for CURRENT_DATE / CURRENT_USER `[I]`. Unlike a field code there is NO usage analysis and no bottom СОХРАНИТЬ — the button writes at once; the popover keeps showing the old code until a reload `[C]` | `verify-business-field-code` per keystroke (the widget's own current code answers `false`), then `v2/<widget>/save-<widget>-code` of §5i «A widget's code and url» (e.g. `v2/iframe/save-iframe-code {boId, iframeId, code}`) → `""` `[C]`, asynchronous |
| Add a widget | palette section «Виджеты» (ЭЦП / СМС, Кнопка, Блок IFrame, Блок captcha, Вкладки, Прогресс-бар) → drag onto the canvas like a field; the label input opens focused `[C]` | `v2/business-objects/generate-business-form-widget` P `{widgetType}` → the DTO (`code: null`); bottom СОХРАНИТЬ = portion save with `addedFieldIds` + `editedFields [{fieldId, gridPosition, needFreezeWhenScroll:false, label, labelMap}]`; the server derives the code from the label (`load-business-object-by-id` shows `code: null` for every widget but BUTTON) `[C]` |
| IFRAME url; BUTTON url and «Поля для отправки» | the widget's gear popover: «URL» textarea + popover СОХРАНИТЬ / ОТМЕНИТЬ; a BUTTON also has the link «Выбрать поля для отправки на сервер» → picker (search + a checkbox per field of THIS BO, widgets included). **Escape does not close the picker — click a blank part of the popover; a click on СОХРАНИТЬ while it is open only closes it.** Written at once, no bottom СОХРАНИТЬ `[C]` | IFRAME: `v2/iframe/save-iframe-url {boId, iframeId, url}` → `""`, asynchronous (an immediate `load-iframe-url` still answers the old url). BUTTON: one СОХРАНИТЬ sends `v2/button/save-button-url {boId, buttonId, url}` AND `save-button-field-ids {boId, buttonId, fieldIds:[…]}` (PARAMS, body `{}`) → `""` each; read back at once `[C]` |
| Delete a field | gear → the LAST icon (trash) → at once the script-usage analysis → dialog «Удаление поля: использование в скриптах» («Места использования» or «Использований в скриптах не найдено») with УДАЛИТЬ ВСЁ РАВНО / ОТМЕНИТЬ; the field leaves the canvas, **nothing is written until the bottom СОХРАНИТЬ** `[C]` | `v2/delete-script-usage/analyze-field` P `{boId, fieldId}` → `{analyzeId}`, `is-analyze-done` P `{analyzeId}` → `{done, errorMessage, hits}`; on УДАЛИТЬ ВСЁ РАВНО `v2/business-objects/load-field-usage` P `{boId, fieldId}` → `{isUsedForKanban, menuItemNames}` (a second dialog when either is set `[I]`); СОХРАНИТЬ → portion save `{businessObject, editedFields:[], addedFieldIds:[], deletedFieldIds:[fieldId]}` `[C]` |
| Field lock (a dynamic or a system field) | the lock icon of the field row → the field's gear popover on its lock tab: «Все операции доступны ВСЕМ / ВЫБОРОЧНО», then per operation (eye = Просмотр, pencil = Редактировать) «ВСЕМ / ВЫБОРОЧНО» + «Выберите» → tree (Выбрать все, Автор (инициатор), users, groups, Еще…; close it by a click on a blank part of the popover). ВЫБОРОЧНО pre-adds an «Автор» chip. A system field (`CREATED_AT` …) shows only eye + pencil. The popover's СОХРАНИТЬ writes AT ONCE, the lock turns orange `[C]` | `save-field-access-group` B `{businessObjectId, fieldId, accessGroup}` (`fieldId: "<NATIVE_TYPE>"` for a system field), then `save-bo-field-chosen-access-right` P `{boId, fieldId, chosenAccessRight:true}` `[C]` (R5). **A reset to ВСЕМ in the UI sends `accessForAll:true` but leaves the subjects in the body** (and the flag `false`) — the field is open again `[C]`; the API reset with `orgUnitToDelete` (R5) leaves no residue |
| Widget lock (BUTTON, CAPTCHA, CURRENT_USER, SIGNATURE, CURRENT_* dates) | the lock icon of the widget row → a SMALL popover with Просмотр only (ВСЕМ / ВЫБОРОЧНО + Выберите) and СОХРАНИТЬ / ОТМЕНИТЬ; **IFRAME has no lock** `[C]` | `v2/<widget>/load-access-group` / `save-access-group` P `{boId, <widget>Id}` B the access group itself, no wrapper and NO chosen-access-right call (`[C]` for BUTTON, the rest by analogy `[I]`); controllers and id names: §5i «A widget's code and url» |
| Registry columns | «Список» view → the registry header row: «+» picker, drag, border resize, trash — each AT ONCE; the last column stays `[C]` | `save-business-form-field` (§5b) `[C]` |
| Registry default sort | «Список» → hover a column → sort icon; a click cycles ASC → DESC → off, each AT ONCE; one sort per BO `[C]` | `save-bo-table-sort` PARAMS `{boId, fieldId, order}` (`ASC`/`DESC`); off = `{boId, order:"UNSET"}` without `fieldId` `[C]` (§7) |
| Calendar header titles / hover card | «Календарь» → «Настройка отображения заголовка:» / «Настройка отображения информации при наведении» | `v2/calendar/save-calendar-view-titles` PARAMS `{boId, titles}`; `v2/calendar/save-calendar-card-template` B the template, P `{boId}` (body shape and effect `[U]`, §12) |
| Timeline columns | «Диаграмма Ганта» → one columns table per `PERIOD` / `PERIOD_TIME` field | `v2/timeline/save-columns` B cols, P `{boId, timelineFieldId}`; `remove-column` P `{boId, timelineFieldId, fieldId}`; `save-table-locations-for-timelines` B `[{fieldId, archetype, gantTableLocations}]`, P `{boId}`; the first card save adds the first field as a column of every empty timeline |
| Record window size | the eye icon of the canvas header → the record preview → corner drag, at once; per BO, a viewer cannot resize (§5j) `[C]` | `save-business-object-grid-layout-position` `[C]` (R1 «Layout», §5i) |
| Print forms | rail → «Печатные формы» → panel: list + a draft dialog (add / edit) | §5i «Print forms» `[C]` |
| Messenger link field | gear on the TELEGRAM / WHATSAPP rail tab → link field + search type | §5k `[C]` |
| BO kind (`boCategory`) and `kind` | none — fixed at creation | none; to change a kind, create a new BO |
| Delete a BO | sidebar row ⋮ → «Удалить» → a dialog listing the BO's script usages, menu items and referencing BOs | `v2/delete-script-usage/analyze-bo` P `{boId}` → `{analyzeId}`, polled with `is-analyze-done` P `{analyzeId}` → `{done, errorMessage, hits}` (the client waits 0.5 s more each time, up to 5 s; `cancel` P `{analyzeId}` drops it), and `v2/business-objects/load-bo-usage` P `{boId}` → `{menuItemNames, refBoNames}` `[C]` for the dialog (it still names a menu item already deleted by `delete-menu-item` `[C]` — check `load-nav-items`), then `delete-business-object` PARAMS `{businessObjectId}` → `""`, the BO is gone and its script module survives `[C]` (trap 25); what happens to records, menu items, references and composites: §12 |
| BO groups | group row ⋮: «Изменить код» (groups of kind `MANUAL` / `PROCESS` only), «Переименовать», «Удалить» | the group lifecycle calls of §5 «Verifying an import» `[C]`; a non-empty group's delete: §12 |
| Composite attributes | «Связи» view of the composite | the draft cycle of §5e: `change-co-field-label` / `change-co-field-code` `{coId, draftId, coFieldId, label\|code}`, `remove-bo-from-co` `{coId, draftId, boId}`, then `apply-and-remove-draft` |

Constructor behaviour that every row above runs into `[C]`:

- **The bottom СОХРАНИТЬ greys out with no message while the form is invalid** (the client disables it on
  `form.invalid`, a pending add or save, or an empty form) — e.g. an empty questionnaire label or an empty radio
  option label. Look for an orange-bordered input.
- **With a popover open, the first click on the bottom СОХРАНИТЬ only closes the popover** — click again and check
  the network log for `save-business-object-portion`.
- **`editedFields` carries objects** `{fieldId, <changed keys>}`, never a list of key names.
- Every gear open loads the lock tab's data: `load-field-access-group`, `load-org-unit-record-list`,
  `load-org-field-record-list`, `load-field-access-author-person-list`.
- The gear's icon strip (dynamic field): settings, info, lock, puzzle («Интеграция через БД» / «Интеграция по
  API»), dependency, trash; a widget's popover is its own (code, url, lock).

### 5c. The matrix «4 routes × 5 object kinds» — column «Справочник» `[C]`

A dictionary is created by all four routes with NO route-specific machinery.

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
  `kind: DICTIONARY`, unlike the constructor's caption-level ⊕; no group is created or renamed.
- `tools/api-import-structure.bun.ts` runs **from the shell** (`--token-file`
  with the token in the session scratchpad) and drives the whole cycle: dry run → `--import-id … --apply`.

### 5d. The matrix «4 routes × 5 object kinds» — column «Панель» `[C]`

A panel is an ordinary BO with `boCategory: "BO_PANEL"`; all four routes need **no panel-specific
machinery**.

- **Constructor.** Group kebab → «Добавить панель» = `create-bo {boGroupId, boCategory: "BO_PANEL"}`,
  nothing else; the editor route is the same `…/object-editing`, and the DTO carries no panel-specific
  key (`isDictionary:false`, `instanceViewType:"FORM"`, `formFields: []` — unlike a dictionary a panel is
  born EMPTY).
- **A panel is built of NESTED OBJECTS — registry widgets, not «виджеты».** The palette («Элементы
  страницы» / «Виджеты» / «Системные поля» / **«Вложенные объекты»**) ends with a list of the company's
  BOs; dragging one in calls **`generate-business-form-field {boId, fieldType: "BO", fieldBoId: <BO id>}`**. The saved field is
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
  `oldRefBoId` is resolved against the stand on import, the field gets `refBoId` set.
  `tools/make-probe-archive.bun.ts --category BO_PANEL --field "Метка:BO@<boId>@<boCode>"` builds it.
  The import dialog's tree labels a panel node with the **bare BO name, no `<вид объекта>/` prefix**
  (a dictionary gets «Справочник/…») `[C]`.
- A real dashboard panel exports as the same
  `BoStructDto`, with `dynamicFields` of `type: "BO"`, each with `boRefStruct.fieldRefs` (which columns
  of the target BO to show, `toShow`/`orderIndex`/`gridPosition` per field) and a `bracketFilter`
  (e.g. «Мои встречи» = `nativeFilters: {type: "CREATED_BY", isCurrentUser: true}`). That pair —
  `fieldRefs` + `bracketFilter` — is what makes a real dashboard; the probe generator ships neither.

### 5e. The matrix «4 routes × 5 object kinds» — column «Составной объект» `[C]`

A composite object (`boCategory: "BO_COMPOSITE"`) is the ONE kind that needs machinery of its own: it has
its own editor route, its own controller and a DRAFT protocol.

- **Creation is the same as every other kind**: group kebab ⋮ → «Добавить составной объект» =
  `create-bo {boGroupId, boCategory: "BO_COMPOSITE"}`, created immediately as «Составной объект №N».
- **The editor is `/business-objects/editing/<coId>/composite-editing`**, NOT `…/object-editing`.
  Left pane = the source BOs and their attributes; right pane = the composite's own attributes, split into
  «Составные атрибуты» and «Простые атрибуты». No palette, no form canvas — a composite has no layout.
- **Its code is NOT regenerated by the rename** `[C]`: it keeps the code generated from the
  auto-name «Составной объект №N» (e.g. `Sostavnoyi_obekt__6962`). (For a BO built in the constructor the
  code follows the first naming save — see §5b. The composite editor's name input does not do that.)

#### Controller `v2/co` — the whole surface

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
`apply-and-remove-draft {draftId}`.

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
  description}` patch of §5b) **and the code does NOT follow the name** `[C]` — the code from the
  auto-name survives. So the composite behaves the same through both routes, unlike a plain BO
  whose code follows the first naming save. Corollary: the §5b rename race cannot bite here.
- **Reading a committed composite needs a draft of its own** — `load-co-fields-*` take `{coId, draftId}`
  and `apply-and-remove-draft` destroyed the one you had. `generate-draft` → read → `remove-draft`.
  The editor page does the same on every load, so merely opening it mints a draft.

#### In an archive

A `BO_COMPOSITE` export is ONE `BoStructDto`
plus a `BoGroupStructDto` and the metadata — 3 objects, no `AccessStructDto`:

- `category: "BO_COMPOSITE"`, `kind: "GENERAL"`, ordinary `name`/`recordName`/`orderIndex`;
- **`bos: [{code, name, boCategory}]`** — the source BOs, referenced **by CODE only**, no id. An export does not carry
  them; each must either already exist on the stand or travel as a `BoStructDto` in the SAME archive — line order
  irrelevant `[C]` (§5 «A composite's sources may travel in the same archive»);
- each field in `dynamicFields` carries **`boFieldCodes: [{boCode, fieldCode}]`** instead of the
  `links` of the live API — the same relation expressed in codes;
- `boRefStruct.fieldRefs: {}`, `linkedCoSettings: {}` present but empty.

**Both archive routes work** `[C]` — `tools/make-probe-archive.bun.ts --category BO_COMPOSITE --source …
--co-field …` builds the archive, either route of this section ships it. The importer resolves `bos`
**by code** into the stand's real `boId`s and `boFieldCodes` into the live `links` — the result is
identical to a composite built in the constructor.
Details and the failure mode in `MYBPM-IMPORTS.md` §5b.

#### Attributes of every type, and the records `[C]`

- **An attribute may be of any field type** — text, number, every date kind, checkbox, phone, e-mail, dropdown
  (local and dictionary), radio, checklist, BO reference, file, the `*_LANG` texts, `PERIOD`, `GEO_POINT`, `LINK`,
  `QUESTIONNAIRE`, `PROGRESS_BAR`, `STATIC_TEXT`, `TAB_GROUP`; the type is kept. An attribute merging fields of
  DIFFERENT types is not known yet `[U]`. A co field DTO carries `optionSource` (`FROM_FIELD`/`FROM_BO`) and
  `refBoId` (reference and dictionary dropdown) but **no options**.
- **The composite's registry lists the records of every source BO**; a row id is `"<source boId>-<boiId>"`. The
  columns are all attributes except `STATIC_TEXT` and `TAB_GROUP`. **Each cell comes from the SOURCE record's own
  field** (the value carries the source `fieldId`/`fieldCode`): a dropdown, radio or checklist shows the option of
  ITS source, also one the composite attribute's own option list lacks — so the attribute's copied settings
  (`MYBPM-IMPORTS.md` §5b) do not drive the display. A source not linked to an attribute leaves the cell empty.
- **«Добавить» in the composite's registry** offers a picker of the source BOs and opens a NEW record of the
  picked source; a row opens the SOURCE BO's card.
- **A `CO` field on a plain BO** (`type:"CO"`, `refBoId` = the composite) holds rows of any source: its value is a
  JSON array of `"<source boId>-<boiId>"` (§6b, which also has the read-back trap). Its «Добавить» on the card
  offers the same source picker and opens a NEW record of that source — not a picker of existing rows.

### 5f. The matrix «4 routes × 5 object kinds» — column «Бизнес-процесс» `[C]`

A business process (`boCategory: "BO_PROCESS"`) is the second kind with machinery of its own: its own
editor route, TWO controllers and a versioned diagram.

- **Creation is the same as every other kind**: group kebab ⋮ → «Добавить бизнес-процесс» =
  `create-bo {boGroupId, boCategory: "BO_PROCESS"}`, created immediately as «Бизнес-процесс №N».
- **The editor is `/business-objects/editing/<boId>/process-editing`**, NOT `…/object-editing`: a name
  input, a version selector «Версия: 1 (Тест)», a «Блок-схема» dropdown, a «Локальные методы» button and
  the diagram canvas. There is **no field palette and no form canvas in this editor** — the process's
  fields are still edited through the ordinary BO constructor.
- **The platform pre-builds two things at creation** `[C]`: the field `PROCESS_STATUS` («Статус процесса»,
  `type: "BO"`, `isSystem`, `isRequired`, pointing at the built-in dictionary «Статус процесса» — code
  `PROCESS_STATUS`, its id differs per stand), and **version 1 with a single `Enter` figure**.
- **The BO code FOLLOWS the rename** here, like a plain BO and unlike a
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
  `in-work-bo-process-version` is the same for «в работу»; on a version that is the test one it keeps only
  `isWork` and the stand at once creates a new test version (a copy, the next free number) `[C]` — as with scripts.
  A copy carries the run ways too `[C]`. What each exports and imports
  as: `MYBPM-IMPORTS.md` §5c (work → `workProcess`, test → `processVersions.<id>`, the rest not exported).
  **A process made in the constructor has only a TEST version, and a test version runs — by hand and by its
  run ways — only for test (DEV) records** `[C]`: publish it with `in-work-bo-process-version` (UI «в работу»)
  before ordinary records start it. An imported `workProcess` is already the work version.
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
  REPEAT_COUNT | EXPIRATION_DATE`), `.startTime` (a real UTC instant, `"YYYY-MM-DDThh:mm:00Z"`),
  `.startRepeatTime` (a date, `"…T00:00:00Z"`), `.endRepeatTime`, `.repeatCount`, `.interval`,
  `.daysOfWeek`, `.dayOfMonth` `[C]` (stored and read back as sent). **It has not been seen
  to fire** `[U]` — no process record even 16 hours after `startTime` (`MYBPM-IMPORTS.md` §5c `runWayMap`).
  A `dotPath` with `value: undefined` (i.e. the key left out of the JSON) deletes, e.g.
  `runWayMap.<id>` removes a run way. The process field must be a `type:"BO"` field of the process BO with
  `viewType` `SINGLE` or `FIELDS` (the dialog lists no other); `fieldIdsSet` holds ids of the TARGET BO's
  fields (the dialog offers that reference's `boFieldRefs` — an archive-built reference already lists
  every target field there, `toShow:false`). **The client refuses every edit on a WORK version**
  («you_cant_change_published_bo_process_version»), **the server does not**: the draft cycle above
  applies on an `isWork+isTest` version and the run ways work at once on ordinary records.
  What they do `[C]`: a target record's creation (`ON_INSTANCE_CREATE`) or a saved change of one of the
  `fieldIdsSet` fields (`ON_FIELD_CHANGE`; saving with no change or the same value starts nothing) creates a NEW
  record of the process BO pointing at that target record and runs the process on it; adding run ways does
  not switch off the default (a process record created directly still runs). `changeVariantSet`
  `ON_MANUAL_SAVE` (the dialog's default) covers a form save AND a record made by the §6a cycle;
  `ON_UPLOAD_XLSX` makes a record created by an xlsx records import (§6) start the `ON_INSTANCE_CREATE` run
  way `[C]` — the import itself runs no Block IDE script; the other members are `[U]`. **UI** `[I]`: the process editor's run-ways button opens the dialog
  (`openPopoverBoProcessRunWaysSettings`); its process-field list = the process BO's `BO`/`CO` fields with
  `viewType` `SINGLE`/`FIELDS`, its target-field list = that reference's `boFieldRefs`; it refuses every edit on a WORK version — switch to the test version first (or use the API
  above). The archive form (by CODE: `refBoInfo`, `processFieldCode`, `fieldCodes`) — `MYBPM-IMPORTS.md` §5c
  `runWayMap`.

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
figure AND the arrow in a single command. A coordinate drag drives this fine (the one place in
this app where a coordinate drag is needed — trap 30 does not apply to the slot handles) `[C]`; no
synthetic mouse events are needed. Take the dot from a SCREENSHOT, not from `getBoundingClientRect` of
`circle.fillOuter`: the two frames differ by the page zoom (§10). The picker (3×3 grid, 8 tiles: Exit,
Switch, Form, Script, the two waits, Timer, Terminator) opens below-right of the drop point, about 390×400
px — drop in the upper left of the canvas so it is not cut off by the window edge.
- **Ctrl+Z on the canvas = `v2/bo-process-editor/undo`** `[C]` — it removes a figure just created together
  with its arrow, followed by `validate-def`; a mis-picked tile is undone that way.
- **A Script figure has exactly ONE outgoing arrow** `[C]`: a second one marks both arrows ⚠ and
  `validate-def` answers «Из фигуры выходить может только одна стрелка» (`t9KI1UvhI2`, `place: ARROW`)
  for each. Branching belongs to a Switch, whose arrows must all be named (below); an arrow that is the
  only exit of its figure validates with `name: null` `[C]`.

#### The same thing headlessly — `tools/create-process-constructor.bun.ts` `[C]`

`create-bo {boGroupId, boCategory:"BO_PROCESS"}` → rename via `save-business-object-portion` →
`load-dev-bo-process-id` → `load-bo-process-def` (to find the Enter) → `load-new-ids {count: 2·N}` →
one `apply-update-cmd` chaining N figures after the Enter → `validate-def`. `--show <boId>` prints versions, figures,
arrows and validation of any existing process — the cheapest read-back there is.

#### Both archive routes `[C]`

`tools/make-probe-archive.bun.ts --category BO_PROCESS [--process-figure "<Type>@x,y"]…` builds the archive,
always with the required `PROCESS_STATUS` (`MYBPM-IMPORTS.md` 0.9 rule 18; `--process-status <refBoId>:<CREATED row id>`
only overrides its minted ids) (shape in `MYBPM-IMPORTS.md` §5c); the UI route and
`tools/api-import-structure.bun.ts` both apply it with zero analysis errors, and the diagram comes back
identical (`validate-def` clean).

- **The import needs the «Статус процесса» dictionary to exist in the company** `[C]`: it appears with the
  company's FIRST process created in the constructor, never by import. On a company that has never had a
  process the analysis reports the process's `PROCESS_STATUS` field: «В системе не найден бизнес объект, на
  который ссылается поле» (required BO code `PROCESS_STATUS`; `v2/business-objects/load-bo-id-by-code
  {code:"PROCESS_STATUS"}` answers «No bo with code»). Cancel that import, create any process
  (`create-bo {boGroupId, boCategory:"BO_PROCESS"}`, R1, or `tools/create-process-constructor.bun.ts`), delete it
  with `delete-business-object` — the dictionary stays, five rows `CREATED` / `EXECUTING` / `WAITING` /
  `FINISHED` / `FINISHED_WITH_ERROR` — and import again: zero errors `[C]`. The process's `defaultValue` may
  keep the archive's minted row id instead of the stand's `CREATED` id; its records still save and the engine
  sets the status `[C]` (`MYBPM-IMPORTS.md` §5c).

- **An imported version is `isWork: true` — «Версия: 1 (Опубликованный)»**, while a version created in
  the constructor is `isTest: true` / «Версия: 1 (Тест)» `[C]`. The import publishes the process.
- **Figure and arrow ids survive the import** `[C]` — the stand's def carries the archive's own ids,
  exactly like `oldId` → `boId`.
- **The importer does NOT create `PROCESS_STATUS`** `[C]`: the process imported without it has only the
  archive's own fields, while every constructor-made process has it. Ship it in `dynamicFields`
  **together with its `defaultValue`** — see the next
  block. **A process without that field still RUNS** `[C]` on ordinary and DEV records — the field gives
  the record its status, it does not drive the process (`MYBPM-IMPORTS.md` §5c). Skipping it is not
  an option: every process ships `PROCESS_STATUS` (`MYBPM-IMPORTS.md` 0.9 rule 18).

#### The same configured process through an ARCHIVE — export, generate, import, run `[C]`

A configured process (Enter → Form «Заявка» → Script → Switch on «Заявка».«Одобрить»
→ Exit «Да» / Exit «Нет», §«Running a process on a record» point 6) goes through an archive in four steps:

1. **Export** through the `struct` basket (§0U R4a) from inside the page — read the basket, put the
   process BO (+ its Заявка BO) in, `pre-create-process` → `struct/export-company-structure`, POST the
   bytes to the local bridge (`mise run bridge`, `tools/bridge.bun.ts`, §10), put the basket back. The
   process's `ScriptDefStructDto` lines come out WITHOUT ticking «Скрипты»; the basket even reset
   `isScriptsExport` / `hasScript` to `false` for a process BO. Shapes: `MYBPM-IMPORTS.md` §5c — Form =
   `FigureFormStruct {fieldCode}` (a CODE, portable), a test-only process sits under
   `processVersions.<version id>` with no `workProcess`.
2. **Generate** the archive by `MYBPM-IMPORTS.md` §0.18 / §5c (by hand), or, if `tools/` is available:
   `bun tools/make-probe-archive.bun.ts --group-code <код группы> --group-name "<имя группы>" --group-order <orderIndex группы> --process-spec tools/process-probe.spec.json --code
   <Code> --name "<Имя>"` → group, 2 script
   defs, BO, versions line; the form lint (`MYBPM-IMPORTS.md` 0.10) checks the process part (Form `fieldCode`
   is a BO field, Switch arrows named, every `scriptsDefIds` entry has its def, every `targetArrowId` is
   an arrow of the diagram, `PROCESS_STATUS` has a `defaultValue`).
3. **Import** through the §5 API cycle from the page (bridge `GET` → `FormData` → `import-file` → insert →
   analyze → apply); expect a clean analysis, `validate-def []` and `translate-script success` for every script. Figure
   and arrow ids are the archive's; the VERSION id is the stand's own, scripts re-keyed to it.
4. **Run** it by «Running a process on a record» (optional accelerator: `window.mybpmProcess.run(…)` from
   `create-process-constructor.bun.ts --page-script`): it
   runs on DEV records AND on ordinary records (`"state":"ALL"` in the run spec) — the
   imported version is `isWork: true, isTest: true`.

- **A Script / Switch figure shipped without its `ScriptDefStructDto` passes every check and then FAILS**
  `[C]`: analysis clean, apply fine, `validate-def []`; on the first record `load-process-steps`
  shows that figure `FAILED` with «Скрипт не определен» (`script.not.found`, `NoScriptWithId`) and the process
  stops — it does not «run empty». Every Script / Switch needs its def line, even with no acts
  (the form lint of `MYBPM-IMPORTS.md` 0.10 reports it; format in §5c there).
- **`PROCESS_STATUS` without a default blocks every record** `[C]`. The
  field is `isRequired`; the constructor defaults it to the «Статус процесса» row `CREATED`. Imported
  without a default, `validate-apply-remove-draft` on a new process record answers **200** with the form
  command `ALERT_SAVE_BUTTON_NOTIFICATION` «validate_required_title» — no record, no process, and nothing
  throws. **The default takes only when the archive carries BOTH** the key on the field,
  `"defaultValue": "[\"<CREATED row id>\"]"` (+ `defaultValueMap`), AND the export's `ExportStructInstanceDto`
  line for the `CREATED` row with a `DEFAULT_VALUE` source `[C]` (the line alone and the key
  alone each leave `"[]"` on a new BO; both together take — `make-probe-archive.bun.ts` writes both;
  the line is NOT ignored). **Both ids are resolved BY CODE on import, so none has to be read off the stand**
  `[C]`: the dictionary is built in with the fixed code `PROCESS_STATUS`, yet its id differs between stands,
  and so does the `CREATED` row id. Any ids (another stand's or made-up ones, used consistently in the
  field and in the line's `compositeId`) come in as this stand's own `refBoId` and `CREATED` row id in
  `defaultValue`. The importer matches the line by `boCode: "PROCESS_STATUS"` + the row's unique `code` field `CREATED`, and
  the field by `boRefStruct.boInfo.code`. The generator mints both ids; mismatched ids between the field and
  the line are not checked `[U]`. (To read the stand's own ids anyway: `load-bo-dictionary-list`, or
  `formFields[code=PROCESS_STATUS]` → `refBoId` / `defaultValue` of any process.)
  `runOnTestRecord` throws on that form command instead of reporting an empty run.
- **Re-importing the same code adds a version** `[C]`: version 2 `isWork+isTest`, version 1 demoted to
  `isWork:false, isTest:false`; the field default was NOT repaired by that re-import (it carried the line
  but not the key).
- **The EXPORT itself, re-imported as is (only code and name changed)** `[C]`: analysis
  clean, `validate-def []`, figure/arrow/field ids = the export's, but (a) the `processVersions` form comes
  in as a **test-only** version (`isWork:false, isTest:true`) — it runs on DEV records, an ordinary record
  gets no process (`load-process-steps` = `[]`); (b) every record is refused — the export carries no
  `defaultValue` on `PROCESS_STATUS`; adding `defaultValue` + `defaultValueMap` to that one field
  fixes it. So: **export → patch the default (and move
  `processVersions.<id>` to `workProcess` if ordinary records must run it) → import.** The BO the Form
  points at, shipped in the same export, merged into the existing one by CODE (its export `oldId` differs
  from its stand id).
- **A run is over only when no step is `STAND` or `GO`** `[C]`: right after the Form is released the
  Switch reads `GO` for a moment; a poll that stops at «no `STAND`» reports an unfinished run.
  `runOnTestRecord` waits for both.

#### Configuring the figures — what each settings dialog writes `[C]`

Every setting is ONE `apply-update-cmd` (named as below)
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
- **Timer** `[C]` — born as
  `{x, y, type:"Timer"}` (drawn with «выберите поле»). Double-click → a popup **«Выберите поле с датой:»**
  listing the process's date fields; one click writes `Set figures.<id>.fieldId = "<fieldId>"` and closes
  it. Nothing else to set — the due time IS that field's value when the process enters the Timer.
  A Timer without a field validates clean. Run-time behaviour (empty / past / future date, a field
  changed while it stands, `#Обновить таймер для процесса` — actId in «Running a process on a record» step 5):
  same as `MYBPM-IMPORTS.md` §16 «A Timer». In short:
  the Timer reads its field once, on entry; a later change of the field (form save OR script) does not move
  it, and only `#Обновить таймер для процесса` on that field right after the change does `[C]`.
- **SingleToParallel / ParallelToSingle** `[C]` — the palette writes `{x, y, type:"SingleToParallel", outSlotsCount:2}` /
  `{x, y, type:"ParallelToSingle", inSlotsCount:2}` (slot-drag: 3; the palette also adds `orientation`,
  not needed); arrows use `out1…outN` / `in` and `in1…inN` / `out` (table «Slots» below). One
  `apply-update-cmd` with these shapes builds them, `validate-def` → `[]`, and the run behaves as a fork + a real
  join (`MYBPM-IMPORTS.md` §16 «Parallel branches»). In an archive: `FigureSingleToParallelStruct
  {outSlotsCount}` / `FigureParallelToSingleStruct {inSlotsCount}` `[C]`.
- **Terminator** `[C]` (API and archive) — born `{x, y, type:"Terminator",
  fieldId:""}` (one `apply-update-cmd` with that shape, `validate-def` → `[]`), slots
  `left`/`right`/`top`/`bottom`, nothing to configure. In the archive it is `FigureTerminatorStruct {x, y}`.
  Run: **it ends the whole process** — a Timer standing in the other parallel branch turns `PASSED` with
  no next step the moment the Terminator is passed, and that branch's later figures never run
  (`MYBPM-IMPORTS.md` §16 «A Terminator ends the WHOLE process»). **An Exit ends only its own branch**
  `[C]`: a process may hold
  several Exits (`validate-def` → `[]`), and after one branch passes its Exit the other still stands on
  its Timer and later reaches its own Exit (`MYBPM-IMPORTS.md` §16 «An Exit inside one branch»).
- **Point** `[C]` — not in
  the palette: right-click an arrow → **«Вставить точку»** (bundle `insertPoint`). One command
  `CUT_ARROW_WITHIN_POINT` `[C]` (can be sent by hand through `apply-update-cmd`, `validate-def` → `[]`):

  ```
  Set figures.<pt> = {type:"Point", x, y}
  Set arrows.<old>.finishFigureId = <pt>, .finishSlotName = "angle_<a+180>", .labelDeltaX = 0, .labelDeltaY = 0
  Set arrows.<new> = {name: <old name>, startFigureId: <pt>, startSlotName: "angle_<a>",
                      finishFigureId: <old target>, finishSlotName: <old target slot>, labelDeltaX: 0, labelDeltaY: 0}
  ```

  (`a` = the arrow's direction at that spot, snapped to 45°; eight slots `angle_0` … `angle_315`: a
  left-to-right arrow comes in at `angle_180` and leaves at `angle_0`). Dragging from a Point that
  has no outgoing arrow starts a new arrow. At run time it passes instantly as its own step
  (`MYBPM-IMPORTS.md` §16 «A Point»); in an archive it is `FigurePointStruct {x, y}`.
- **Arrow name** — double-click the arrow → an inline input; Enter →
  `CHANGE_ARROW_NAME`, `Set arrows.<id>.name = "<text>"`. **Every arrow leaving a Switch must be named**
  («У стрелки должно быть название» until then); the name is what the Switch's script exits by.
  **A Form shows its reference field's label inside the figure, a Timer its date field's label; no other
  figure has a caption — the rest of the text is arrow names** `[C]`: name the arrow entering each Form /
  Script / Switch / Timer with what the step does; that label is how a person finds the step. An arrow label
  is 14 px text (≈ 7.5 px per character) whose top-left corner sits at the midpoint of the straight line
  between the two slots; it never wraps, except that a label crossing the visible editor's right edge folds
  into one word per line. A diagram that reads: one left-to-right row, straight arrows, names ≤ 12 characters,
  ≥ 15 px per character + 20 between facing slots, ≤ 1200 px wide (`MYBPM-IMPORTS.md` 0.18) `[C]`. When explaining an existing process, walk `arrows` from the Enter and describe only the
  figures reachable from it: **a figure no arrow leads to never runs**, even though its script is stored
  and exported — mention it only as «не подключена, не выполняется». A person sees neither figure ids nor
  x/y, and arrow names repeat or are empty, so point to a step by the process (`name` + `code`), its
  ordinal on the path from the Enter and the labels of BOTH its arrows («процесс «<name>», 3-й шаг от
  «Входа»: входящая без подписи, исходящая «Оповещение пользователя»»). When the person describes a
  figure by its arrows, match the description against `arrows` before agreeing — it may be another step;
  captions, a screenshot or a copied script fragment that the export does not contain mean another
  process or a newer version: say so and ask for that export, never retract what the export proves. A
  copied fragment has fresh block ids — match it to a script by act codes and variable names
  (`MYBPM-IMPORTS.md` §5c «Explaining what an existing process does», «Check what the person says»).
- **Script / Switch** — born as `{x, y, type:"Script", script:null}` / `{x, y, type:"Switch"}`.
  Double-click → `save-editing-script-figure-id {boProcessId, scriptFigureId}` and the ordinary Block IDE
  opens with **`scriptModuleId = boProcessId` (the version id) and `scriptId = the figure id`**
  (`v2/script/load-script-def` → `{blocks:{}, expressions:{}}` when empty). So §5g's headless
  `paste` / `apply-update-cmd` apply to process scripts with those two ids. An EMPTY Script or Switch
  validates clean — `validate-def` checked nothing inside them (while `translate-script` on an empty
  one answers «Не определён модуль»: nothing is stored for that figure yet).
- **Writing a Script and a Switch headlessly** `[C]` — one `apply-update-cmd`
  each, ids of your own, then `translate-script` → `success:true` and `validate-def` → `[]`:

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
- **Slots — the real names, per figure** `[C]` (`slotByName` falls back as shown):

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

  So `main` on a Switch silently means `up` (the top vertex), and a
  wrong name on a Form or Timer resolves to nothing. **A Form has three timer slots of its own** — an
  armed timer's exit is presumably an arrow out of `timerCreate` / `timerOpenForm` / `timerTouchDraft`
  `[I]`. A real project's generated archives use Switch `left`/`right`/`down` out and `up` in, Exit `main`/`top`.
- Dragging out of a slot works from the Enter but NOT from the Form's right slot (no picker opens) —
  the API route is the reliable one.
- **The editor remembers the open script** — `load-editor-state` → `{scrollTop, scrollLeft,
  scriptFigureId}`; with `scriptFigureId` set, reopening `…/process-editing` can come up straight in that
  figure's IDE: an empty grey canvas with only `»` at the top left, which looks like a diagram that failed
  to render. `save-editing-script-figure-id {boProcessId, scriptFigureId: null}` (or the IDE's × at the
  top right) brings the diagram back `[C]`; it does not reopen every time, when exactly is `[I]`.
- The IDE of a process record offers three process-only actions — `goForProcess`, `continueProcess`,
  `terminateProcess` — and a process field offers `#Обновить таймер для процесса`; actIds and use: «Running a
  process on a record» step 5 below.

#### Running a process on a record `[C]`

A TEST version is run only by **test records** (`boiState: DEV`, registry tab «Тестовые»,
§5g). In the points below the process field «Заявка» is a `BO` reference to a request BO (a CHECKBOX
«Одобрить» + an INPUT_TEXT «Текст заявки»), and the Form points at it. Drive it with the §6b form
cycle from inside the page and read the result back with `load-process-steps`.

1. **The process starts when the record is SAVED, not when it is opened.** `create-draft-with-boi
   {boId:<process BO>, boiState:"DEV"}` → `load-process-steps` = `[]`; `validate-apply-remove-draft` →
   Enter `PASSED`, Form `STAND` at once. «Статус процесса» shows «В ожидании» (`WAITING`) while a step
   stands.
2. **A Form step is released by saving THE record that was in its field when the step was entered.**
   Filling «Заявка» in the same draft as the process record's first save, then
   `create-draft` + `save-field-value` + `validate-apply-remove-draft` on that Заявка, makes Form →
   Script → Switch → Exit pass in one go and sets the
   status to «Завершён» (`FINISHED`). Nothing but the record save is needed: no task, no button on the
   process card. **The save must CHANGE a value of that record** `[C]`: a `create-draft` →
   `validate-apply-remove-draft` with no edit, and one that re-sends the value already stored, both leave
   the Form `STAND` (still minutes later), while a save with a changed value releases it at once.
   **The start is asynchronous**: right after the process record's first save `load-process-steps` can
   still be `[]` — poll until a step is `STAND` before saving the Form's record, or the release may land
   before the step exists.
3. **Filling the field AFTER the Form was entered leaves the step stuck for good** — even when the
   Заявка is then saved with a changed value. A retry does not help
   (`push-step-retry` → «Нет активных шагов для повторного запуска»; it is only for a step with
   diagnostics). So whatever feeds a Form must fill its field BEFORE the process reaches it: at the
   record's first save, or in a Script placed before the Form.
4. **Unsticking a step by hand: «Продолжить принудительно»** — the context menu of a STAND step's
   OUTGOING arrow in the diagram → `v2/boi-process/push-step-forcibly P {boProcessId, boiId, arrowId}`
   → empty 200, and the process runs on from that arrow's target. Given the arrow INTO the standing
   step (Enter → Form) it does nothing.
5. **A conditional Switch branches on the data** `[C]`: the Switch's script rewritten with
   `apply-update-cmd` to `ЕСЛИ ЭТОТ_ПРОЦЕСС.Заявка.Одобрить.#Значение → по стрелке «Да», ИНАЧЕ → по
   стрелке «Нет»` (the JSON below; same as `MYBPM-IMPORTS.md` §16 «A Switch with a condition»; `translate-script`
   `success:true`, `validate-def` `[]`): «Одобрить» `"true"` ends in `…, Switch PASSED, Exit «Да» PASSED`,
   `"false"` in `…, Switch PASSED, Exit «Нет» PASSED`. The whole run is one in-page script; no UI.
   The Switch body (`v2/script/apply-update-cmd`, `scriptModuleId` = the version, `scriptId` = the figure;
   process field «Заявка» code `Zayavka`, its CHECKBOX «Одобрить» code `Odobrit`) `[C]`:

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

   The process record's own fields are reached through `THIS_PROCESS` (IDE `ЭТОТ_ПРОЦЕСС`); a field of the
   REFERENCED record is its `F-<code>-K-DYN-S-boi_fields` applied straight to the reference field (no
   `#Значение` hop); the boolean is tested bare; the `ЕСЛИ` has no `downBlockId` because both branches are
   exits. The value read is the one saved when the Switch runs. What a Script / Switch writes is saved when
   the figure is left — no `#Сохранить` `[C]`.

   **Process-only actions** `[C]` — offered only on a record (`BoiRefCode`) of a `BO_PROCESS` BO; no arguments,
   no result, so each is a `BlockAssign` with only `leftExprId`:
   `F-goForProcess-K-FIX-T-BoiRefCode` «#Запустить процесс»; `F-continueProcess-K-FIX-T-BoiRefCode`
   «#Продолжить процесс» (a Form or a Timer it waits on passes at once); `F-terminateProcess-K-FIX-T-BoiRefCode`
   «#Терминируй процесс» (stops the whole process). On a process FIELD (`ЭТОТ_ПРОЦЕСС.<field>`, no `#Значение`
   hop): `F-updateTrapDate-K-FIX-T-BoiFieldRefCode` «#Обновить таймер для процесса» — call it right after changing
   a Timer's date field, or the Timer keeps the date it read on entry.

6. **The whole thing headlessly — `tools/process-builder.ts`** `[C]`: a spec (process
   fields, figures with slots, named arrows, Script/Switch bodies incl. a condition over a path of field
   codes) becomes a process in ONE pass — `create-bo` → rename → the BO-reference field with
   `viewType:"SINGLE"` + `toShow` in `editedFields` (trap 53) → one diagram `apply-update-cmd` (the born
   Enter is reused, a Form gets `fieldId`, Switch arrows get `name`) → one script `apply-update-cmd` per
   figure (`scriptModuleId` = version, `scriptId` = figure) → `translate-script` → `validate-def`.
   `runOnTestRecord` then runs it: DEV Заявка → DEV process record → poll for `STAND` → Заявка saved with
   a CHANGED value → steps read back. Example spec: `tools/process-probe.spec.json`. Two drivers: `create-process-constructor.bun.ts --spec <f>
   [--run '<json>']…` from the shell (token file), or `--page-script`, which prints a snippet defining
   `window.mybpmProcess = {api, build(spec), run(built, spec, run)}` in the stand's page — the token never
   leaves it (§10).

The run-time controller, all `P`: `v2/boi-process/…`

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
fields whose referenced BO can START the process by creating a record there (when there are any, the editor
opens that BO's new-record form instead of `start-dev-process`) `[I]`.

- **In the process EDITOR, a double-click on a standing Form opens the form of its record** (test mode
  only — the diagram on a record's own card does nothing). It is the same `create-draft` as anywhere
  else, with no process context, so saving it from the API is equivalent `[C]`.
- **A DEV process record lists only DEV records in its reference fields** `[I]` (the picker says «Данные отсутствуют» when the BO holds only ordinary records). Make the
  referenced records with `create-draft-with-boi {…, boiState:"DEV"}` for a test run.
- `load-boi-values` returns `""` for a `BO` reference field on a process record; read the link with
  `load-bo-with-instance-id` instead `[C]`.

### Export through the API — no browser download `[C]`

The browser's own «Выгрузить» fires, but **under browser automation the download may never reach a folder the
program can read** (§10).
Drive it from the shell or `fetch` instead, it is two calls:

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
selected BOs. The file name's company slug (`MyBPM-export-<COMPANY>-…`) is not the tenant you
are working in `[U]`.

### 5g. Block IDE scripts on a running stand — the API (reading and writing `[C]`, the rest read off the bundle)

What a write needs of the script language is in this section — «The script language», «House style», «What
the built-in operations do at run time» — and the UI paste route is «Pasting a script in the UI» (the same
rules at full length, the IDE palette included: `MYBPM-IMPORTS.md` Part II, §0S cookbook). This section is also: **where that
screen is and whether a script can be touched without it.** It can — the client drives scripts through
two ordinary controllers, so everything §0S says about «the clipboard is the whole delivery channel» is
true of the IDE, not of the platform.

**Most of this section is still `[I]`.**
**These calls are `[C]`** — `v2/script-browser/load-tree` + `load-children`,
`v2/bo-scripts-editor/load-bo-script-versions` + `load-bo-scripts`, `v2/script/load-script-def` and
`v2/script/translate-script` (the reading half; see «Reading a BO's scripts headlessly» below). The
WRITING half: **`apply-update-cmd` and `paste` are `[C]`** (below, «Writing a script
headlessly»), and so are `load-new-ids` + `save-bo-scripts` + `in-work-bo-script-version` (the hook
wiring, «Wiring scripts onto a BO headlessly»), and so are `create-local-method` / `list-local-methods` /
`delete-local-method` («Local methods without the IDE» below). An archive also creates scripts on import
(`MYBPM-IMPORTS.md` §5d) `[C]`.

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
  expressions (ids from `load-new-ids`) — then `translate-script` → `success:true`.
- **A local method with the same name overrides the global one** `[C]` (the screen says so); adding
  it to the work version or removing it with `delete-local-method` takes effect on the next record at once,
  no version switch.
- **Local methods without the IDE** `[C]`: `v2/bo-scripts-editor/create-local-method` P `{boScriptsId,
  methodName}` (`boScriptsId` = the version's `boScriptModId`) → `{scriptId, methodName}`; the method
  is added IN PLACE to that version's `methodScriptIds` (no new version, `methodsScriptId` stays null)
  and its def is a bare hat `{BlockFixMethod, methodName, params:{}}`. Fill it exactly like a global one
  (one `apply-update-cmd` P `{scriptModuleId: boScriptsId, scriptId}`, `Set blocks.<hat>` with
  `params`/`returnType`/`downBlockId` + the body). `list-local-methods {boScriptsId}` →
  `[{scriptId, methodName}]`; `delete-local-method {boScriptsId, scriptId}` → empty body, the id leaves
  `methodScriptIds`. **A local method belongs to EVERY script version of the BO** `[C]` (trap 68a): one created on
  the test version is listed by the work version too, and `delete-local-method` on one version is undone within
  seconds while another version still lists it — delete it from every version (`list-local-methods` of each) to
  remove it. A call site's `args` are keyed by the callee's param id — reuse the param id of the
  method you shadow and the same call works against either.
- **Calling a global method** `[C]`: a BO script calls it like a local one — `ExprCall {funcName:
  "<name>", useArgNames:false, args: {<the global method's param id>: {name, order, exprId}}}`; nothing
  names the global module. **A process Script figure calls it the same way** `[C]`: the figure's
  def has `scriptModuleId` = the process version, e.g. `Итог.#Значение = glob_greet("БП")` (`BlockAssign`,
  left = `F-VALUE-K-DYN-R-D-S-boi_fields` over `F-Itog-K-DYN-S-boi_fields` over `THIS_PROCESS`). The archive form and its import semantics (REPLACES the whole list,
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
  `translate-script` checks and `undo` removes the whole step in one call. Into an empty hook the fragment
  goes with its `BlockFixEntryPoint` hat and a closing `BlockExit FROM_METHOD` (`MYBPM-IMPORTS.md` §14 «Validator phases»).
- **`/paste` breaks parameter references** `[C]`: it gets no target (the client posts only `{copied}`), and
  every VAR_REF to a METHOD PARAMETER comes back rewired to a detached carrier `BlockFixEmpty →
  BlockNewVar «Переменная №N» = 0` (a Number CONST), the body under its own `BlockFixEmpty`, not hung under
  the hat — body alone or the whole method with its hat. The IDE writes that answer verbatim.
  **A method body that reads its parameters is written WITHOUT `paste`** `[C]`: one `apply-update-cmd`
  P `{scriptModuleId, scriptId}` with `Set blocks.<id>` / `Set expressions.<id>` under YOUR ids (any
  16 characters of the id alphabet are taken as they are; `load-new-ids` is optional) plus a `Set` of the
  whole hat with `downBlockId` = the first body block → `translate-script` `success:true`.
- **`undo` can wipe an imported def** `[C]`: on a method whose def came from an import and was never edited,
  one `undo` after the first `apply-update-cmd` left the def EMPTY, hat included. Keep the hat from
  `load-script-def` before writing, so a `Set` can put it back.
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
  Even an archive whose `compositeId` prefix is the current work `boScriptModId` adds a new version `[C]`;
  the test version keeps its old body.
- **`remove-bo-script-version {boId, boScriptsId}` removes ANY version, the work one included** `[C]` —
  200, no warning, and the BO is left with no work version (ordinary records run nothing). It only drops
  the version from the list: `load-script-def` on the removed module still returns its body. Remove only
  rows with `isWork:false, isTest:false`.

- **Where the screen is**: there is no route of its own. The script IDE is a dialog inside the BO
  constructor (`…/object-editing`) and inside the process editor (`…/process-editing`); the company-wide
  screens are `/settings?settingsOpenPageUrl=…` → «Глобальные методы» and «Браузер скриптов»
  (controller `v2/script-browser`: `load-tree`, `load-children {folderId}`, `search {query}`,
  `load-exit-variants {scriptModuleId, scriptId}`). «Глобальные методы» is a list on the left
  («Добавить», search) and the method's IDE canvas on the right; «Браузер скриптов» is `[U]`.
- **A freshly imported BO may fail `translate-script` falsely** `[I]`: right after the import, every
  field act of a script on it may answer `exprAct__noDefinitionForActId` for `F-VALUE-K-DYN-R-D-S-boi_fields`
  (hop 1 typed with no `boCode`; `load-bo-def-list` → 0 BOs), while `load-act-record-list` already knows
  the fields. It clears after a few minutes and/or once the BO's script dialog is opened in the
  constructor — wait, open the dialog, re-run `translate-script`. `in-work-bo-script-version` refuses while the error stands (it
  answers `[{text:"script_on_change_field_cause", …}]` and changes nothing).

#### Writing a script headlessly — `apply-update-cmd` `[C]`

The IDE's own request (§10 shows how to capture it), usable alone:

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
  is write-only.
- **`translate-script` checks in four phases and reports ONLY the first that fails** `[C]` — an error list is
  never the whole story; fix and re-run until `{"success":true}`:
  1. **Structure**: `noEntryPoint` «Нет точки входа» (a hook body needs its `BlockFixEntryPoint` hat),
     `blockIf__allBranchMustReturn__orContinueDownWithReturn` (a hook must END with
     `{"type":"BlockExit","exitType":"FROM_METHOD"}` as `downBlockId` of the last top-level block),
     `exprOp_operandIdIsNull` «Не задан операнд номер 2 в операции Plus» (a binary `ExprOp` without
     `rightExprId`; the variable it initialises also gets «Не указан расширенный тип (valueExtType == null)»),
     a variable whose type has no ext type (`getPrintForms` of a record).
  2. **Types**, all at once: a scalar added to / searched in a typed array (`illegalElementTypeForList`),
     `Readonly/Required/Shown -K-DYN-R-M-` need a user/department/group ref as argument, `SHOWN_BO_IN_CO_FIELD`
     needs a BO chosen as a CO attribute, `addFile_v2` wants a `File`, `inapplicableFilter`, `sendToUsers`
     wants Person/PersonGroup/Department, the four `associateSingle*Ref*` of a spreadsheet tab need a reference
     main field.
  3. **Read / write access**, ONE error per run — the `RestRequest` / `ElectronicTableBoTab` list above.
  4. **Java compilation** (`compile:compiler.err.*`, `sourceMessage` = the Java line, `exprId` at the TOP level
     of the diagnostic). **Defect** `[C]`: the catalogue offers `saveBoiChanges` / `updateOpenedBoi` /
     `closeOpenedBoi` (`-K-FIX-T-BoiRefCode`) also on a BO type, a field and a progress step; phases 1–3 pass
     them, the compiler rejects them («BoRefCode cannot be converted to BoiRefCode») — use them on a record
     only. Two `INFO compile:compiler.note.unchecked.*` beside a success mean nothing.
  Every other catalogue act (454 of 476) translates clean; compiling is not running.
- **Then `translate-script`** — the only check. It reports wrong `actId`s, argument names, dangling ids
  and types; `success:true` with a `WARN used_deprecated_blocks` means an old-panel element is present.
- **A wrong SHAPE bricks a module the same way** `[I]` (do not reproduce it): `ExprCall.args` sent as `{"<paramId>":"<exprId>"}` instead of `{"<paramId>":{"exprId":…}}`
  in a company-global method made the global module undecodable («Failed to decode 'ScriptModuleDto'») — the
  «Глобальные методы» list, every process `validate-def` and the figure script IDE all failed with it.
  Copy object-valued keys (`args`, `argExprIds`, `branches`, `more`, `params`, `valueType`) exactly
  from «The script language» below (same as `MYBPM-IMPORTS.md` §10–§11).
- **A `WARN` is not a clean result**: `Eq` between an act's `boolean` and a «Да/Нет» constant answers
  `success:true` with `WARN exprOp__equalsDifferentTypes` («…одинаковыми быть не могут никогда») — the
  condition is always false `[C]`. Use the boolean itself, or `Not`.
- **Never write an enum value that is not in the table of «The script language» below** (`opType`, `exitType`,
  `exprValueType`, `constType`, `type`). The server stores it, then cannot decode the BO's script module
  any more: every read and write of every version of that BO's scripts — including `apply-update-cmd`,
  `undo`, `delete-local-method`, `remove-bo-script-version` — answers `IllegalArgumentException: No enum
  constant …`, so nothing can repair it through the API or a structure import (trap 49) `[C]` (other BOs
  are unaffected). A wrong STRING value (`actId`, argument key, `enumValue`) is harmless — the
  validator reports it.
- Work on a **test version** (`in-test-bo-script-version` / the «Версия: N (Тест)» switch in the dialog) —
  it does not protect against the trap above (all versions are decoded together) but keeps a working
  hook out of an experiment's way.

#### The script language — what a `Set blocks.<id>` / `Set expressions.<id>` may hold `[C]` unless marked

The defs `load-script-def` returns and `apply-update-cmd` writes are two FLAT maps, `blocks` and
`expressions`, keyed by id; every entry carries its own `"type"`. Nothing nests inline: a block names its
expressions by id, an expression names its operands by id. (The clipboard / `paste` form wraps the same two
maps in `{"copiedType":"SCRIPT_BLOCKS","mouseX":202,"mouseY":62,"startBlockIds":["<root>"],"blocks":{…},
"expressions":{…}}` — `startBlockIds` holds ONE id: the method hat, the first body block of a body, or the
`BlockFixEntryPoint` of a hook / process script.) Same as `MYBPM-IMPORTS.md` §0S.3–§0S.11.

**Plan first.** Write the algorithm as pseudocode in the six forms of the language only — `Пусть <имя> =
<выражение>`, `<переменная> = <выражение>`, `ЕСЛИ … ИНАЧЕ ЕСЛИ … ИНАЧЕ`, `ЦИКЛ <элемент> : <число или
коллекция>`, `ВЫЙТИ ИЗ ЦИКЛА`, `ВЕРНУТЬ <выражение>` — named by the house style below. If a step does not fit,
the plan is wrong. **Never invent** a field code, a `boiId`, an arrow id or a parameter id: read them off the
stand (`load-bo-def-list`, `load-script-def` of the method's hat, `load-exit-variants`) or ask.

**Ids.** Exactly 16 characters of `A-Za-z0-9@~`, unique across the def — block ids, expression ids and the
keys of `branches` and `more` share one namespace. Three kinds are external and reproduced byte for byte:
method **parameter ids** (keys of the hat's `params` and every `varBlockId` that reads a parameter), process
**arrow ids** (`targetArrowId`), dictionary **row ids** (`boiId`).

**Blocks.** A statement points at the next one with `downBlockId`; the last of a chain has none. A nested
chain (`thenBlockId`, a branch's `blockId`, `bodyBlockId`) is a chain of its own; execution continues at the
parent's `downBlockId`.

```json
{"varName":"#текст#","valueExprId":"<expr>","downBlockId":"<next>","type":"BlockNewVar"}
{"leftExprId":"<expr>","rightExprId":"<expr>","downBlockId":"<next>","type":"BlockAssign"}
{"ifExprId":"<expr>","thenBlockId":"<first block of То>",
 "branches":{"<id>":{"blockId":"<first block>","order":10,"exprId":"<expr>","hasExpr":true},
             "<id>":{"blockId":"<first block>","order":20}},
 "downBlockId":"<next>","type":"BlockIf"}
{"elementVarName":"#шаг#","srcExprId":"<expr>","bodyBlockId":"<first block>","downBlockId":"<next>","type":"BlockForeach"}
{"exitType":"FROM_METHOD","returnExprId":"<expr>","type":"BlockExit"}
{"exitType":"FROM_CIRCLE","circleBlockId":"<BlockForeach id>","type":"BlockExit"}
{"exitType":"FROM_CIRCLE_ITER","circleBlockId":"<BlockForeach id>","type":"BlockExit"}
{"exitType":"FROM_METHOD_BY_ARROW","targetArrowId":"<arrow id>","type":"BlockExit"}
{"x":55,"y":44,"methodName":"describe",
 "params":{"<param id>":{"name":"step","order":1,"type":{"baseType":"BoiRefCode","boCode":"Model_step","isArray":false,"type":"Bo"}}},
 "returnType":{"baseType":"String","isArray":false,"type":"Text"},"downBlockId":"<first body block>","type":"BlockFixMethod"}
{"x":56,"y":65,"downBlockId":"<first block>","type":"BlockFixEntryPoint"}
```

- `BlockNewVar` = «Пусть»; `varName` is a free string, its decoration is the house style (next subsection), but
  it must be **unique within its scope**, loop element names included.
- `BlockAssign`: `leftExprId` is a `VAR_REF` for a variable, or the hop-2 `#Значение` act for a field (below).
  **A void action as a statement** (`#Добавить ошибку`, `#Сохранить`, `JsonDeck.put`, `.Добавить` of a
  multilingual text, a method call used as a statement) = `BlockAssign` with that `ExprAct` / `ExprCall` as
  `leftExprId` and **no `rightExprId`**.
- `BlockIf`: `branches` run in `order` (10, 20, …); a branch with `exprId` + `hasExpr:true` is «ИНАЧЕ ЕСЛИ»,
  one without them is plain «ИНАЧЕ». `branches` may be `{}`/absent, `thenBlockId` may be absent. **Exactly one
  branch of the chain runs** — for «try every candidate» write independent `ЕСЛИ`s one after another.
- `BlockForeach`: `srcExprId` a **number** → a counted loop (counter 1…n, n evaluated ONCE on entry); a
  **collection** (a link-many field through `#Значение`) → a foreach. The element of a foreach over a `Текст[]`
  PARAMETER is untyped `Object` — wrap it once, `Пусть #t# = '' ⊕ #el#`; a `Bo[]` element reads fields as is.
- `BlockExit`: `FROM_METHOD` = «Выйти из метода» and **carries the return value**; `FROM_CIRCLE` = break,
  `FROM_CIRCLE_ITER` = continue; `FROM_METHOD_BY_ARROW` leaves a process Switch by one of ITS arrows. An exit
  never has `downBlockId`. **A hook (Открытие / Сохранение / Создание / Закрытие / Изменение поля) and a
  process Script figure = `BlockFixEntryPoint` → body → `{"exitType":"FROM_METHOD","type":"BlockExit"}`**; a
  process Switch ends EVERY path in `FROM_METHOD_BY_ARROW` and has no plain exit (§5f). Keep ONE `FROM_METHOD`
  per method, at the end.
- `BlockFixMethod` (the method hat): never compose it — take it from `load-script-def` (after
  `create-local-method` / `create-company-global-method` it is a bare hat, which you complete). Type literals:
  Текст `{"baseType":"String","isArray":false,"type":"Text"}`, Число `{"baseType":"BigDecimal","isArray":false,
  "type":"Number"}`, Логическое `{"baseType":"Boolean","isArray":false,"type":"Bool"}`, экземпляр БО
  `{"baseType":"BoiRefCode","boCode":"<BO code>","isArray":false,"type":"Bo"}`; an array parameter adds
  `"isArray":true`.

**Expressions.** **Each expression id is referenced EXACTLY ONCE** — the graph is a strict tree; a value needed
twice is two copies of the subtree. **`value` is always a string** (`"0"`, `"yes"`).

```json
{"exprValueType":"CONST","valueType":{"baseType":"String","type":"Text"},"constType":"String","value":"текст","type":"ExprValue"}
{"exprValueType":"CONST","valueType":{"baseType":"BigDecimal","type":"Number"},"constType":"BigDecimal","value":"42","type":"ExprValue"}
{"exprValueType":"CONST","valueType":{"type":"Bool"},"constType":"Boolean","value":"yes","type":"ExprValue"}
{"exprValueType":"CONST","valueType":{"type":"Bool"},"constType":"Boolean","type":"ExprValue"}
{"exprValueType":"CONST","valueType":{"baseType":"BoRefCode","type":"Bo","isArray":false},"constType":"BoiRefCode","boCode":"<BO code>","type":"ExprValue"}
{"exprValueType":"CONST","valueType":{"baseType":"BoRefCode","type":"Bo","boCode":"Operator"},"constType":"BoRefCode","boCode":"Operator","type":"ExprValue"}
{"exprValueType":"CONST","valueType":{"baseType":"BoiRefCode","type":"Bo","boCode":"MODEL_ERROR_CODE"},"constType":"BoiRefCode","boCode":"MODEL_ERROR_CODE","boiId":"<row id>","type":"ExprValue"}
{"exprValueType":"CONST","valueType":{"baseType":"SingleSelectRefCode","type":"SingleSelect","boCode":"Operator","fieldCode":"operator_type"},"constType":"SingleSelectRefCode","boCode":"Operator","fieldCode":"operator_type","optionId":"<option CODE>","type":"ExprValue"}
{"exprValueType":"CONST","constType":"Enum","valueType":{"type":"EnumRef","baseType":"DateDeltaUnit","enumNativeName":"DateDeltaUnit"},"enumBaseType":"DateDeltaUnit","enumValue":"DAYS","type":"ExprValue"}
{"exprValueType":"CONST","constType":"JavaObjectFactories","objectDescriptor":"BEAN_METHOD-DateExtensions-now","valueType":{"type":"Object","baseType":"Date"},"type":"ExprValue"}
{"exprValueType":"VAR_REF","varBlockId":"<BlockNewVar | BlockForeach | parameter id>","type":"ExprValue"}
{"exprValueType":"THIS_PROCESS","constType":"BoiRefCode","type":"ExprValue"}
{"opType":"Concat","leftExprId":"<expr>","rightExprId":"<expr>","more":{"<id>":{"opType":"Concat","order":10,"exprId":"<expr>"}},"type":"ExprOp"}
{"leftExprId":"<expr>","actId":"F-substring-K-FIX-T-String","argExprIds":{"startIndex":"<expr>","endIndex":"<expr>"},"type":"ExprAct"}
{"funcName":"is_formula","args":{"<callee parameter id>":{"name":"#текст#","order":1,"exprId":"<expr>"}},"type":"ExprCall"}
```

In order: text, number, boolean (`"yes"`/`"no"`); the two EMPTY header constants — a boolean without `value`
(IDE `<пусто>`) and a record of a BO without `boiId` (IDE `БО/<name>.<пусто>`; `valueType.baseType`
`BoRefCode` with `constType` `BoiRefCode`, as the IDE writes it; runtime of `<пусто>` in `ЕСЛИ` `[U]`); a BO
**type** (left operand of create-instance and `findByFilter`); a concrete **record / dictionary row**; a
**SingleSelect option** (`optionId` = the option CODE; an option cannot be stored in a variable); an **enum**
constant; a **built-in object** («Встроенные объекты», `objectDescriptor` from `load-const-field-list`
`JAVA_OBJECT_FACTORY_LIST`); a variable / parameter reference; **`THIS_PROCESS`** = the record the script runs
on (IDE «ЭТА ИНСТАНЦИЯ» in a BO script, «ЭТОТ ПРОЦЕСС» in a process); an operator (third and further operands
in `more`, by `order`); an action (`argExprIds` keyed by the ARGUMENT NAME of `load-act-details`; none → no
`argExprIds` key); a method call (**`args` keyed by the CALLEE's parameter id**, each value an OBJECT
`{name, order, exprId}` — `name`/`order` cosmetic; the callee must exist first). An empty text constant read
back has no `value` key. A string compare of unknown operand types: `('' ⊕ #код#) Eq #токен#`.

**The enum-typed keys — write ONLY these values** (anything else bricks the BO's scripts for good, trap 49):

| key | values |
|---|---|
| `type` (block) | `BlockNewVar` `BlockAssign` `BlockIf` `BlockForeach` `BlockExit` `BlockFixMethod` `BlockFixEntryPoint` (old-panel `BlockSetVar` `BlockSetField` `BlockObject` `BlockReturn` `BlockSwitchExit` `BlockFunc` exist — do not generate them, they cost `WARN used_deprecated_blocks` and an unoptimised run) |
| `type` (expression) | `ExprValue` `ExprOp` `ExprAct` `ExprCall` (old-panel `ExprConst` `ExprVar` `ExprField` `ExprObject` `ExprNewBoi` `ExprBoiFind` `ExprCreateObject` `ExprFunc` — do not generate) |
| `exitType` | `FROM_METHOD` `FROM_CIRCLE` `FROM_CIRCLE_ITER` `FROM_METHOD_BY_ARROW` |
| `exprValueType` | `CONST` `VAR_REF` `THIS_PROCESS` |
| `constType` | `String` `BigDecimal` `Boolean` `Date` (value format `[U]`) `GeoPoint` (`latitude`, `longitude`, `geoPointShowType` `DEGREES_PARTS`/`DEGREES_MIN_SEC`) `BoRefCode` `BoiRefCode` `SingleSelectRefCode` `Enum` `JavaObjectFactories` `ScriptMethodRef` (`value`) `PrintFormRef` (`boCode`, `printFormCode`) `ReportRefCode` (`reportCode`) |
| `opType` (17) | `Concat` (◊, more: Concat); `Plus` `Minus` `Mul` `Div` (more: the same four); `And` `Or` `Xor` (more: the same three); `Not` (unary — `leftExprId` only); `Less` `LessEq` `More` `MoreEq` (more: the same four); `Eq` (more: `OrEq` «или =»); `NotEq` (more: `AndNotEq` «и ≠»). Not `Multiply`/`Divide`/`GreaterEq` |

`enumBaseType`/`enumValue`, `actId`, argument names and `varName` are plain strings — a wrong one is reported
by `translate-script`, not stored as poison. The 16 enums and their values: `load-const-field-list`
`ENUM_LIST` / `ENUM_VALUE_LIST`.

**Reading and writing data — two hops, each one `ExprAct`:**

    hop 1  field      {"leftExprId":<the object>, "actId":"F-<field code>-K-DYN-S-boi_fields"}
    hop 2  its value  {"leftExprId":<hop 1>,      "actId":"F-VALUE-K-DYN-R-D-S-boi_fields"}

- `<the object>` is a `VAR_REF` to a BO-typed variable / parameter / foreach element, or `THIS_PROCESS`. The
  field actId is built from the field CODE alone, case-sensitive. **Without hop 2 you get a reference, not a
  value** — it compares as if dereferenced but concatenates as garbage; every read ends with hop 2.
- **Writing a field** = `BlockAssign` whose `leftExprId` is the hop-2 act.
- `INPUT_TEXT_LANG` (and the system `label` of every dictionary row) reads with a third hop
  `F-RUS-K-DYN-S-TextLang`; write ONE language with `F-VALUE_IN_LANG-K-DYN-R-D-S-boi_fields` on hop 1, arg
  `language` = Enum `MybpmLang` `RUS`. Assigning to the hop-3 getter compiles and does nothing.
- **Clearing a field has no confirmed form** `[U]` — do not invent an empty date/number/option constant; leave
  it out and say so.
- **A link-many field** (`BO` TABLE / MULTIPLE, `CO`): hop 2 is `Bo/BoiRefCode[]` — foreach over it; on hop 1:
  add `F-ADD-K-DYN-R-D-S-boi_fields` (arg `adding`), count `F-COUNT-K-DYN-R-D-S-boi_fields` (also a counted
  loop's bound), `F-DELETE` / `F-FIRST` / `F-LAST`; `F-VALUE_FROM_LIST-K-DYN-R-D-S-boi_fields` («Значения как в
  реестре») = the same records in the target registry's sort order, without drafts (`#Значение` has no order
  and may hold drafts). **Row order is not a contract.** Create a record with `F-CI-K-DYN-R-C-S-bo_fields` on a
  `BoRefCode` constant. A **`SINGLE`** `BO` field is ONE record, not an array: no `F-ADD`/`F-DELETE`
  (`exprAct__noDefinitionForActId`), set it by assignment `….<single>.#Значение = #запись#`.
- **A `CO` element's fields are the composite's attributes**: `CO_CODE-<composite code>-F-<attribute
  code>-K-DYN-S-boi_fields`, then hop 2; the plain `F-<code>-…` does not exist on a CO element.
- **A child's field written by a script** reaches the child only when the PARENT form is saved (lost on
  cancel) — unless `#Сохранить` (`F-saveBoiChanges-K-FIX-T-BoiRefCode`, void, on a RECORD only) stores it at
  once. A process Script / Switch figure's writes are saved when the figure is left; no `#Сохранить` needed.
  An open card does not show them until reopened — the client never refreshes a record by itself `[C]`; a
  process can push a refresh of one record to one user with a dedicated method `[C]` (its name `[U]`).
- **A DEV record's script sees only DEV records in its `BO`/`CO` fields** (collections read empty otherwise).
- A dictionary at run time: `F-findByFilter-K-FIX-T-BoRefCode` on a `BoRefCode` constant → rows (no drafts;
  it searches the Elasticsearch index `[C]`, whose lag behind a save a person in the UI never notices `[C]`);
  `code` matching is case-sensitive.

**Core actIds** (the rest of the 476: walk `load-act-record-list` / `load-act-details` by `valueExtType`, the
catalogue calls below — an actId found in neither does not exist): `#Длина` `F-length-K-FIX-T-String`;
`#Пусто?` `F-isEmpty-K-FIX-T-String`; `#Подстрока` `F-substring-K-FIX-T-String` (`startIndex`, `endIndex`;
0-based, end exclusive); `#Заменить` `F-replaceByTemplate-K-FIX-T-String` (`target`, `replacement`,
`needReplaceAll`; LITERAL); `#Регулярка?` `F-doesItMatchARegularExpression-K-FIX-T-String` (`regExp`);
`#Содержит` `F-contains-K-FIX-T-String` (`fragment`); `#В число` `F-convertToBigDecimal-K-FIX-T-String`;
`#Взять целую часть` `F-intPart-K-FIX-T-BigDecimal`; `#Взять дробную часть` `F-fractionPart-K-FIX-T-BigDecimal`;
`#Модуль` `F-abs-K-FIX-T-BigDecimal`; `#Округлить до целого` `F-round-K-FIX-T-BigDecimal`; `#Округлять дробную
часть` `F-roundFractionPart-K-FIX-T-BigDecimal` (`value`); `#не чётное ли?` `F-isOdd-K-FIX-T-BigDecimal`. No
`indexOf` (only `F-returnLastIndex-K-FIX-T-String`), no `ceil`, no «strip trailing zeros».

**Language limits.** No `while` (a bounded loop = `ЦИКЛ i : 200` + `FROM_CIRCLE` on the exit condition), no
array literals (an array is only a parameter type or what an act returns), no dynamic dispatch (no call by a
name from data, no field chosen at run time — one `ЕСЛИ` per field).

**The rules — each has silently broken a real script:**
1. Never compare numbers with `Eq`/`NotEq` — `BigDecimal.equals`, scale-sensitive (`4/2 = 2` is false);
   equality = «not less and not more», a zero guard likewise. `Less`/`More` are safe.
2. Test a boolean as the bare `ifExprId`, its complement as plain «ИНАЧЕ» or `Not`; `Eq` between an act's
   `boolean` and a «Да/Нет» constant is the always-false `WARN exprOp__equalsDifferentTypes` (above).
3. Exactly one `FROM_METHOD` per method, at the end.
4. (Clipboard / `paste` route only) a body pasted without its hat types every parameter as a NUMBER: a text
   parameter needs `Пусть #x# = '' ⊕ <параметр>` as the first block, or string assignments vanish. A body that
   reads parameters goes by `apply-update-cmd` with the hat, never by `paste` (above).
5. No chained comparison — `a > b > c` is `(a > b) > c`; use `And` or nested `ЕСЛИ`.
6. Every expression referenced exactly once.
7. Variable names unique within a scope, loop elements included.
8. `#Подстрока` with `start >= end` returns the WHOLE string — guard `ЕСЛИ конец > начало … ИНАЧЕ x = ''`.
9. `#Заменить` is literal; a broken regex in `#Регулярка?` returns `Нет` silently; anchor `^…$`; inside `[…]`
   escape punctuation (a bare `-` is a range) but never backslash a letter (`\o` breaks, `\d` is a digit
   class) — words go into `^(?:or|and)$`.
10. Number → text is `BigDecimal.toString()`: the scale survives (`3.000000000000`) and `0/100` prints `0E-30`.
11. No `while` (above); bind a loop bound to a value that cannot change inside it.
12. Write callees before callers.
13. Enum-typed keys take only the values of the table above.

**Self-check before every `apply-update-cmd`** (the server stores any shape; `translate-script` catches only
part of it): (1) walking from the hat / entry point by `downBlockId` / `thenBlockId` / `bodyBlockId` /
`branches[*].blockId` reaches every block exactly once; (2) no dangling id (`*ExprId`, `exprId`, `argExprIds`
values, `blockId`, `circleBlockId`) — `actId`, `targetArrowId`, `boiId`, parameter ids are external; (3) every
expression referenced exactly once, none zero times; (4) every `VAR_REF.varBlockId` is a parameter id of the
hat or a `BlockNewVar` / `BlockForeach` earlier on the path; (5) no name re-declared while in scope; (6) every
id and every `branches`/`more` key is 16 characters; (7) the house style below; (8) every object-valued key
(`args`, `argExprIds`, `branches`, `more`, `params`, `valueType`) has exactly the shape of the templates above.

#### House style — naming and layout of a script (same rule as `MYBPM-IMPORTS.md` §0S.2a)

The platform enforces none of this (`varName` is a free string); it is the convention every script for this
user follows — apply it when writing, and do NOT flag it as a defect when reading a script back.

**Language.** Variable and module names are **Russian**. Exceptions: method **parameters** are English
`snake_case` with no decoration (`step`, `formula`, `model_step`); loop **counters** are bare `i`, `j`, `k`.

**Decoration — what the variable holds decides the wrapper:**

| holds | wrapper | case | example |
|---|---|---|---|
| a field reference — anything that has `.#Значение` (hop 1, no VALUE) | `~…~` | first letter capital | `~Статус~`, `~Шаги~` |
| a BO type (the `BoRefCode` constant) | `%…%` | the BO's **display name**, not its code | `%Шаг модели%` |
| a collection of ONE element by design | `[…]` around the element's own name | element style | `[#ответственный#]`, `[~Ссылка~]` |
| a collection that may hold MORE than one | `<…>` around the element's own name | element style | `<#шаг#>`, `<~Ссылка~>` |
| everything else — text, number, date, a **record (instance)** | `#…#` | **all** lower case | `#сумма ндс#`, `#заявка#` |
| a module | `\|…\|` | free | `\|Проверка ИНН\|` |
| a loop counter | none | — | `i`, `j` |

- A **record is `#…#`**, the **field holding records is `~…~`**: `~Шаги~` is the field, its `.#Значение` is
  `<#шаг#>`, one element is `#шаг#`. A field with a plain value is `~…~` too (`~Статус~` = `#заявка#.Статус`).
- `[…]` vs `<…>` is decided by design, not by the run-time count; the element inside is singular, in its own
  style.
- **A boolean ends in `?` inside the wrapper**: `#найдено?#`, `~Активен?~` (modules excepted).
- **A trailing `*` marks the inner twin of an outer variable**: a nested scope that needs its own variable for
  the same thing keeps the outer plain and names the inner with `*` before the closing wrapper — `~Человек~`
  in the parent loop, `~Человек*~` in the child; `~Объем~` of a row, `~Объем*~` of the record made from it.
  **It is the convention, not a defect — never flag it.**
- **Templates**: a name may embed another's — `#пароход ${#имя парохода#}#` («the пароход whose name is in
  `#имя парохода#`»); the `${…}` stays in `varName` literally, nothing substitutes it.

**Layout — declarations first.** A script (and every module) opens with a header of `Пусть` blocks; below it
only assignment and logic (loop elements are declared by their loop). A header line declares empty or
initialises at once:

| kind | empty declaration | IDE shows |
|---|---|---|
| text | `Пусть #текст# = ''` | `''` |
| number | `Пусть #сумма# = 0` | `0` |
| boolean | `Пусть #найдено?# = <пусто>` — a `Bool` CONST without `value` | `<пусто>` |
| record | `Пусть #шаг# = %Шаг модели%.<пусто>` — a `BoiRefCode` CONST with `boCode`, without `boiId` | `БО/<name>.<пусто>` |
| field reference | none — initialise: `Пусть ~Статус~ = #заявка#.Статус` | |

**Modules.** A module is a **boolean variable** `|Имя|`, unique within the Company, used **only** as the sole
condition of an `ЕСЛИ` with **no `ИНАЧЕ ЕСЛИ` and no `ИНАЧЕ`**: header `Пусть |Проверка ИНН| = Да` (Да / Нет /
`<пусто>`), any assignment on the way switches it, `ЕСЛИ |Проверка ИНН|` holds the module's own header and logic.
- The body of a module is **byte-identical everywhere** in the Company — change one, change all.
- **No `ЭТА ИНСТАНЦИЯ` / `ЭТОТ ПРОЦЕСС` inside a module**; the record comes in as an outer variable.
- A module uses its own variables and outer ones; every place it is used must have, in scope, outer variables
  of exactly those names and types.
- Modules nest, and one module may be used more than once — two copies in two `ЕСЛИ` bodies do not clash
  (names are unique per scope). **Compose anything but a trivial script out of modules.**

Self-check: every name decorated, `#…#` all lower case, inner twin ends in `*`, booleans end in `?`, counters
bare, header before logic, a module's `ЕСЛИ` holds only `|…|` with no other branch, no `ЭТА ИНСТАНЦИЯ` inside a
module, every copy of a module byte-identical.

#### What the built-in operations do at run time (same as `MYBPM-IMPORTS.md` §15)

- **Numbers are Java `BigDecimal`** `[C]`: `Eq` = `equals` (scale-sensitive: `2.0 = 2`, `4/2 = 2`, `1+1.0 = 2`
  all false; `Eq 0` misses `0.0`), `Less`/`More` = `compareTo`. Division has **scale 30** and never throws on a
  non-terminating quotient (`1/3` → `0.333…` 30 digits); a number FIELD shows its own display format.
  `#Округлять дробную часть: N` = `setScale(N)`; `#Взять целую часть` truncates toward zero (negative input
  `[U]`). Division by zero `[U]` — guard divisors with `Less`/`More`.
- **Number → text** (`'' ⊕ число`) = `BigDecimal.toString()` `[C]`: the scale stays, and `0/100` gives `0E-30` —
  parse with `^[-+]?[0-9]+(?:\.[0-9]+)?(?:[Ee][-+]?[0-9]+)?$`. `#В число` needs a DOT separator `[U]`. `Less`/`More`
  on TEXT compare lexically (`"10" < "9"`) `[I]` — wrap both sides in `#В число`.
- **Strings**: `Eq` is case-sensitive and nothing folds case `[C]`; `#Заменить` is literal `[C]`; `#Подстрока`
  0-based, `start >= end` → the whole string `[C]`.
- **Regex = `java.util.regex`**: a `PatternSyntaxException` is swallowed (returns `Нет`) `[C]`; `regExp` may be a
  variable `[C]`; anchor `^…$` (find vs matches `[U]`).
- **Booleans**: a checkbox's value act is a valid bare `ЕСЛИ` condition `[C]`; concatenated into text it gives
  `true` / `false` (not `Да`/`yes`/`1`) `[C]`. `Or` `Xor` `Not` `LessEq` `MoreEq` `OrEq` `AndNotEq` run correctly `[C]`.
- **Control flow**: an `ИНАЧЕ ЕСЛИ` chain runs ONE branch; an early `FROM_METHOD` inside a branch works (the
  blocks after the `ЕСЛИ` do not run) `[C]`; `FROM_CIRCLE` works from inside a branch of its loop `[C]`; no
  iteration over a record's fields or over BO codes.
- `F-CI` creates the record immediately; one never `F-ADD`ed to a list may stay an orphan `[I]`.

#### Wiring scripts onto a BO headlessly — `save-bo-scripts` `[C]`

The IDE's own sequence; it works alone, also on a BO that has NO scripts:

1. `v2/bo-scripts-editor/load-bo-script-versions` P `{boId}` → a BO that never had scripts still has one
   version, `isTest:true`, `isWork:false` — take its `boScriptModId`. (A BO without scripts is absent from
   `script-browser/load-tree`; find its id with `load-bo-id-by-code` P `{boCode}`, §R4.)
   **Right after the BO is created that first version is blind** `[C]` (trap 68): its `load-bo-def-list
   {scriptModuleId, scriptId:null}` is `list: []` for a few seconds, and meanwhile every field act fails
   `translate-script` with `exprAct__noDefinitionForActId`. Poll it until the list is non-empty, then wire and
   write into that version — it translates and `in-work-bo-script-version` accepts it. If it stays empty,
   `copy-bo-script-version` P `{boId, boScriptsId}` and work in the copy `[I]`.
2. `v2/script/load-new-ids` P `{count: N}` → N fresh script ids (one per hook / field script).
3. `v2/bo-scripts-editor/save-bo-scripts`, **everything in the BODY half**:
   `{id: <boScriptModId>, boId, onOpenFormScriptId, afterSaveScriptId, onCloseScriptId,
   onInstanceCreationId, fieldScripts: {<fieldID>: {afterChangeScriptId}}, methodScriptIds: []}` → empty
   200. Keyed by field ID here (the archive keys by CODE). Send the whole record — it replaces the wiring.
   **A field script is unwired by leaving its field out of `fieldScripts`** `[C]`. **A hook cannot be unwired**
   `[C]`: a hook sent as `null` or `""` is ignored and keeps its id (the IDE itself fills all four). To make a
   hook do nothing, write it the body «entry → `BlockExit FROM_METHOD`» (trap 68b).
4. Each script is now empty (`load-script-def` → `{blocks:{}, expressions:{}}`): write its body with
   `paste` + `apply-update-cmd` (above), hat and exit included, then `translate-script`.
   **A hook whose body was written and then emptied fails every form save** `[C]` (trap 68b): `translate-script`
   says `noEntryPoint`, and the save answers `SHOW_NOTIFICATION` with `notificationBody.notificationText.text`
   `script_after_save_error` (details `script_after_save_cause`) and no `CLOSE_DIALOG_SAVE` — nothing is stored. A
   wired hook never written («Не определён скрипт») blocks nothing. A hat with no block below fails translate
   (`block_noDownBlock`), so the neutral body is the hat + `BlockExit FROM_METHOD`. Per-version: a body written in
   one script version leaves the other versions' bodies as they were `[C]`.
5. **A TEST version runs only on test records** (`boiState: DEV`, the registry tab «Тестовые»); ordinary
   records keep running the work version (none → nothing runs). **And on a DEV record the script sees only
   DEV records in its `BO`/`CO` fields** `[C]` — links to ordinary records read as an empty collection, so test
   link logic with DEV children, or promote the version and test on an ordinary record (`MYBPM-IMPORTS.md` 0S.7). `in-work-bo-script-version`
   P `{boId, boScriptsId}` makes it the work version and the stand immediately creates a new test
   version (a copy, next number). The UI control that publishes a version: not known yet `[U]` — §12.

- The UI lists every field in «Изменение поля» **except `TAB_GROUP` and `PROGRESS_BAR`**; the wiring
  itself accepts them, and scripts on both fire `[C]`.
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
`load-act-details(ret.type)` → `load-act-record-list(ret.type)` …

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

#### Pasting a script in the UI — the canvas context menu «Вставить»

The UI route for a script body (same protocol as `MYBPM-IMPORTS.md` §0S.12 / §14); the JSON is the clipboard
form of §5g «The script language» (`copiedType: "SCRIPT_BLOCKS"`, `startBlockIds` = ONE id).

1. **The path that works is the canvas CONTEXT MENU** `[C]`: open the hook / method in «Настройка скрипта»,
   clear the old body, right-click the empty canvas, pick **«Вставить»**. Ctrl+V pressed by a human user
   is `[U]`. Under browser automation the menu reads `navigator.clipboard.readText()` and fails — override it
   first and click with a REAL mouse click (§10 «Pasting into the Block IDE from automation»).
2. **Put the JSON on the clipboard as text** `[C]`: on Linux/Wayland `wl-copy --type text/plain < file.json`;
   a bare `wl-copy` advertises `application/json` and the paste is silently ignored. Check with
   `wl-paste -n | md5sum` against the file. `wl-copy` daemonises — never end a piped script with it.
   The file is **pure ASCII**, every non-ASCII character a JSON `\uXXXX` escape (`MYBPM-IMPORTS.md` §0S.3) `[C]`:
   raw Cyrillic read in another code page on the way (Mac Roman, Windows-1251 …) pastes as broken names
   (`#–ø–æ–¥‚Ä¶#`) without a warning; the escapes paste as Cyrillic.
3. **Hats** `[C]`: a fragment whose `startBlockIds` point at a `BlockFixMethod` is silently NOT pasted, even
   onto an empty canvas — strip the hat (drop it, point `startBlockIds` at its `downBlockId`, copy its
   `x`/`y` onto that block). A hook / process script WITH its `BlockFixEntryPoint` pastes. A pasted body
   types every method parameter as a Number (rule 4 of «The script language») — a body that reads its
   parameters goes by `apply-update-cmd` instead (§5g «Writing a script headlessly»).
4. **A new method is created first, empty** `[C]`: «Локальные методы» → add (name, parameters, return type)
   — or `create-local-method` / `create-company-global-method` (above) — then copy it out to learn the real
   parameter ids before building the body.
5. **Order** `[C]`: callees before callers (a method pasted before its callee keeps a synthetic param id and
   must be re-pasted); every method before the process script — **an entry point in the clipboard blocks
   method pastes**; copy nothing after it.
6. **Read back**: copy the result out in the IDE (or `load-script-def`) and compare by SHAPE — every id is
   regenerated on paste. Patch the live copy, never re-paste a whole script «just in case»: it reverts every
   IDE edit made since. The menu's paste is `v2/script/paste` + one `apply-update-cmd`, so the API route of
   «Writing a script headlessly» does the same with no UI.
7. **After a structure import of global methods**, touch one in the IDE (any edit saved) or by the API
   `apply-update-cmd` (above): the running copy of the global module is refreshed only then `[C]`.

### 5h. Field settings — «Обязательное», «Уникальное», «Выпадающий список» `[C]`

What the constructor's gear popover on a field writes, and how to write the same thing through the API
and through an archive.

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
becomes `true`. Reproduce it, or the BO's registry will differ from a UI-built one.

Where the dictionaries come from: **`load-bo-dictionary-list`** (params and body empty) → every
`BO_DICTIONARY` of the company, and `load-dictionary-bo-field-options {boId}` → its rows
as ready option DTOs (e.g. `Должность` = `kNfvHppcNSR6Wz@B`, code `Dolzh`). **Binding to an EMPTY
dictionary is legal** and gives an empty dropdown on the form.

Accelerator — `tools/create-bo-constructor.bun.ts`, one call for the whole BO:

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
resolves it `[C]`: `dictionaryBoInfo.code = "Dolzh"` is stored as `refBoId` = that dictionary's id on
the stand. `tools/make-probe-archive.bun.ts` takes the same `--field` grammar with the
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
  `editedFields: [{fieldId, dateOnlyFuture: false, dateOnlyPast: true}]`. The date
  checkboxes do NOT add a registry column.
- **Works on all three routes, and on the record card for all six types**: API (`generate-business-form-field`
  + the key on the DTO and in `editedFields`), archive (plain booleans on the field, round-trip through
  the export) and the constructor. On a record the nz picker disables whole cells: a day for
  `DATE`/`FULL_DATE`/`PERIOD`/`PERIOD_TIME` (both ends of a range), a month for `YEAR_AND_MONTH`, a
  year for `YEAR`. **Today — and the current month / year — stays selectable in both modes.**
- **It is a CLIENT-side restriction only.** The server stores a forbidden date without a word through both
  record cycles — §6a (`save-boi-value`) and §6b (`save-field-value` + `validate-apply-remove-draft`,
  `notValid:false`) — and the card then shows it as is. So an API
  client writes any date, and a script or an Excel import almost certainly does too `[I]`; enforce
  the rule in a «Сохранение» script if it must hold.
- Accelerators: both `tools/create-bo-constructor.bun.ts` and `tools/make-probe-archive.bun.ts` take
  `--field "Дата:DATE!dateOnlyPast=true"` — the generic `!key=value` flag sets ANY key of the field
  (dotted for a nested one, `!params.url=…`; the value is parsed as JSON, else kept as a string).

#### Six more gear flags — what each does on a record `[C]`

They work on all three routes (API, archive, constructor). The constructor saves each tick as a one-key
patch — `editedFields: [{fieldId,
unacceptableValue: true, hideLabel: true, needFreezeWhenScroll: true}]`, `[{fieldId, isClickable: false}]`,
`[{fieldId, needShowToCalendar: false}]`.

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
  otherwise all date fields do `[I]`. The calendar's event title
  shows «Имя :» / «Статус :» — a field label with an empty value — when no card template
  (`calendarCardTemplates`) is set up; what a template changes is `[U]`.
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
  server moves a PLANNED record to OVERDUE when the day passes `[U]` (the logic is in the
  client's date component only). A tracked wrapper/dropdown has no settings, hint, integration or delete
  icons in the constructor.
- **A nested `BO` field built through the API needs what the constructor adds on drop**
  (`createFormFieldByBoId`): `viewType: "TABLE"` and `boFieldRefs` built from the target BO's fields
  (`{fieldId, label, toShow: <target's tableColToShow>, type, checked: false, orderIndex:
  <tableColOrderIndex>, gridPosition}`; if the target has no registry column, its first field gets
  `toShow`; at most 5 shown, `TAB_GROUP`/`PROGRESS_BAR` never). With `viewType: null` the card renders the
  field as an empty box — no table, no «Добавить». `tools/create-bo-constructor.bun.ts` builds both, and
  `--field "Срок:DATE!track"` there replays the «Отслеживать статус» sequence `[U]`; the archive
  generator's `!track` is `[C]`.
- The record picker of a nested field shows «Нет записей» until something is typed into its search
  box, then lists the target's records `[C]` — type a letter before concluding the
  target is empty.

#### «Поведение» and «Интеграция» — per-type settings `[C]`

They work on all three routes (API, archive, constructor). In the gear popover the
per-type settings sit under the **«Отображение» / «Поведение»** switch below the common checkboxes; the
database settings are the popover's 4th icon (puzzle), «Интеграция через БД». The constructor saves them
as one patch per field: `editedFields: [{fieldId, textCase: "UPPER", maxLength: 7,
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
  written through `v2/business-object-instance` stores a wrong-case or over-long value `[C]`. The form data (`load-field-data`) carries `maxLength` but not `textCase` — the check
  lives on the server. The case check lets digits, spaces and punctuation through and applies to Cyrillic.
  The card may keep the case warning on a value already fixed by retyping and refuse to save while a server
  read of the same draft is clean — a stale UI state `[I]`, retype or reopen.
- **The counter** (`enableSequence`) is filled when a NEW draft is created (`create-draft-with-boi`, i.e.
  opening «Добавить») — every draft takes a number, a discarded one too, and `business-objects/sequence-next {boId, fieldId}` hands out (and uses up) the next
  one. A §6a record gets NO number. The value stays editable on the card. The server stores `params` values
  as strings: an API write of `{enableSequence: true}` comes back `"true"`.
- **`params.url` on a LINK** (client code, `openLink`): if it starts with `call/plugin/`, a click on the link
  calls `link/call-plugin {boId, boiId, fieldId, fieldValueMap}` and downloads the files the plugin answers
  with (`download-file…`); otherwise the click opens the field's own value (with `www.` turned into
  `http://`). A plain URL in `params.url` does nothing `[C]` (the link opens its value); the plugin call itself
  is `[U]`.
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

The archive side is `MYBPM-IMPORTS.md` §3 «Reference fields». The controls are the gear → «Отображение» / «Поведение» of a `BO`/`CO` field (`app-bo-settings-behavior`; «Связь объектов» only
appears when the referenced BO has a field pointing back).

| key | control | on the record |
|---|---|---|
| `viewType` `TABLE` / `MULTIPLE` / `SINGLE` / `FIELDS` | «Отображение» → «Вид отображения» «Табличный / Множественный / Одиночный / Карточкой» | a table with the `boFieldRefs` columns / chips / one chip / the referenced record's fields as a form |
| `isKindAddForSelect` | «Поведение» → «Выбор/Добавление» (`false`) vs «Только добавление» (`true`) | «Добавить» opens the CREATE dialog of the referenced BO instead of the picker |
| `linkedFieldId` = a field of the REFERENCED BO that points back | «Поведение» → «Связь объектов» → «Заполнить поле "<label>"» (vs «Ничего не заполнять») | adding a record into this field writes the owner record into that back field; removing it from the field clears the back field `[C]` |
| `removeType` `STRIKETHROUGH` / `HIDE` / `DISCONNECT` | «Поведение» → «При удалении объектов <BO>» «Зачеркнуть / Скрывать из списка / Разорвать связь…» | see below |
| `needChangeParentBoByLinkedBo` (default `true` on EVERY field) | «Поведение» → «При добавлении/изменении объекта(ов)» «Изменить бизнес объект "<BO>"» (`true`) / «Не изменять…» (`false`) | see below |
| `copyFromFieldId` = another `BO` field of the same BO | «Отображение» → «Логика отображения значения» → «Из другого поля» | the field is filled with a COPY of that field's value on every save of the record (stored, not just shown); emptied when the source is emptied `[C]` |
| `needMarkNew` | «Поведение» → «Помечать новые» | client code: rows with `isNew` (or state NEW) render in bold and new ones are put on TOP instead of the sort order `[I]` |
| `needAddToParticipants` | «Добавлять в участники и уведомлять об добавлении» — in the TOP checkbox list of the gear (with «Необходимо заполнить»…), only when the referenced BO is kind `PERSON`; its constructor save also sends `tableColToShow:true` — the field becomes a registry column `[C]` | the person put into the field becomes a participant of the record and gets the bell event «Вас добавили» `[C]` (also through the script-less §6a cycle); adding yourself raises no notification. What a participant gains: §3 «What each subject opens» |
| `isHeightDynamic` | «Отображение» → «Динамическая высота» (`BO` only) | see «Tables» in `MYBPM-IMPORTS.md` §3 |
| `linkedCoSettings` (a `CO` field) | «Поведение» → «Связь объектов <BO>/<field>» → «Объект из Составного объекта» → pick a source BO → the same «Заполнить поле» / «При удалении» radios | per source BO of the composite: see below |

- **`removeType` is applied by the SERVER when it reads the field's records**
  (`business-object-instance/load-bo-instance-selector-records-by-ids {boInstanceIds, businessObjectId,
  fieldIds, ownerBoId, ownerBoInstanceId, ownerFieldId, draftId}`) — a record deleted with
  `delete-bo-instance` (state `REMOVED`) is: **`HIDE`** — left out of the answer, the field looks empty;
  **`STRIKETHROUGH`** — returned with `state: "REMOVED"`, and a TABLE view strikes the row through;
  **`DISCONNECT`** — on this build exactly like `STRIKETHROUGH` (the row is struck, the id stays in the
  stored value, even with `linkedFieldId` set) `[C]`. A `SINGLE` chip
  shows a deleted record plainly, with no mark. The stored value is never cleaned by a delete.
- **M:N = two `TABLE` fields whose `linkedFieldId` point at each other** `[C]` (archive form:
  `MYBPM-IMPORTS.md` §6; the server offers a `TABLE` back field in `linkedBo.fieldsForLink`).
  **Adding is mirrored and APPENDS** — the back field keeps its other records — in the form
  cycle and in §6a alike. **Removing is not symmetric**: through the form cycle / UI (⊖ = `saveType:"REMOVE"`,
  or a replace without the id) the removed record KEEPS the owner in its back field, so the sides drift
  apart — remove on both sides yourself; through §6a `save-boi-value` (`REMOVE` or replace) the removed
  record's WHOLE back field is emptied, its other links included. Never remove from an M:N
  field with §6a.
- **`needChangeParentBoByLinkedBo` decides whether a change of the field is a change of the OWNER record**
  `[C]` (UI and API): with `true` (default) choosing a record puts it into the card's draft only — the card
  shows «Сохранить / Отменить» and closing asks «Несохранённые данные … Закрыть без сохранения?»; «ДА» =
  `remove-draft`, nothing kept. With `false` the same `save-field-value` (`saveType: "ADD"`) is **written
  straight into the record** — the card stays clean, closing sends `remove-draft` and the choice is kept.
  Headlessly the same: `create-draft` → `save-field-value` on a `false` field → `remove-draft` leaves the
  value in the record; on a `true` field the value is gone. Without `saveType` the value replaces, with
  `"ADD"` it is appended, with `"REMOVE"` the listed ids are taken out — what the row's ⊖ in a card's
  table sends `[C]`; `"DELETE"` changes nothing. Editing a referenced record elsewhere does NOT touch the owner's
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
  its first id** `[C]`. So switching a field to «Одиночный» in the constructor drops the other
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
  `create-draft` may fail with it and go through a minute later, and a record whose save «failed» may
  already BE saved (with its back link) — a NEW record whose form save failed this way was stored, so
  `delete-boi` after such a failure deletes a kept record. A repeated apply answering `NoBoInstanceDraft`
  after an ES failure = the first apply went through. It is the Elasticsearch memory breaker of the stand,
  not the payload — retry, then check what was stored before retrying a create or cancelling.
- In the export (`MYBPM-IMPORTS.md` §3 «Reference fields») `linkedFieldId` becomes
  `boRefStruct.linkedFieldCode` and `copyFromFieldId` becomes `copyFromFieldCode` — both by CODE — and
  `linkedCoSettings` becomes a map `{"<source BO code>": {linkedFieldCode, removeType}}`. All three import
  back `[C]`.

#### «С фильтром» and «Зависимость полей» of a `BO` field `[C]`

**How the picker gets its records.** Every view (table, chips, single) asks
`v2/business-object-instance/load-bracket-ref-boi-table` body `{boId, boiId, draftId, fieldId, refBoId, search,
paging, ordering, boiIds, brackets, state:"ALL"}` (`boId`/`boiId`/`fieldId` = the OWNER record and field). The
server itself (`brackets: []`) applies the field's own filter and **leaves out the records already chosen in
this field** (saved value); anything else comes only from `brackets` the client sends.

**«С фильтром» (`bracketFilterId`)** — gear → «Отображение» → «С фильтром: Заполните» → a filter builder over
the referenced BO's fields. Works in the UI, through the API and after an import `[C]`: the picker lists only the
records that pass the filter.
- The constructor (one save of the BO): the portion carries `editedFields: [{fieldId, bracketFilterId}]`, then
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
- The server does NOT enforce the filter on save: a §6a record cycle stores a record the filter excludes `[C]`.
- Export/import: `MYBPM-IMPORTS.md` §3 «Reference fields — «С фильтром» and «Зависимость полей» in an archive».

**«Зависимость полей»** — gear → «Поведение» → «Поле зависимого» (`relMainInnerFieldId`, a `BO` field of the
REFERENCED BO) / «Зависимость от» (`relFieldId`, a `BO` field of THIS BO) / «Внутреннее поле зависимости»
(`relInnerFieldId`, a field of the `relFieldId` field's BO). Meaning: offer only the records whose main-inner field
equals the value of «Зависимость от» (or of that value's inner field).
- Set through the API as a one-field patch `{fieldId, relMainInnerFieldId, relFieldId, relInnerFieldId}` — the
  constructor then shows it `[C]`. Clearing goes with `needDeleteRel…FieldId: true`: × on the «Поле зависимого» chip
  removes all three levels and the save sends `needDeleteRelMainInnerFieldId`, `needDeleteRelFieldId`,
  `needDeleteRelInnerFieldId` all `true` `[C]`.
- **Constructor defect — set ONE level per СОХРАНИТЬ** `[C]`: choosing a level sets `needDelete…: true` for every
  level below it and does not undo it when you then choose that lower level, so «Поле зависимого» + «Зависимость от»
  chosen before one save send `relFieldId` together with `needDeleteRelFieldId: true` — the server keeps only
  `relMainInnerFieldId`. Choose «Поле зависимого» → СОХРАНИТЬ → «Зависимость от» → СОХРАНИТЬ → the inner field →
  СОХРАНИТЬ, then re-read; the API patch above has no such problem.
- The server builds the filter correctly: `v2/business-object-instance/load-field-relation-bracket-filter` params
  `{boId, boiId, fieldId, draftId}` returns `{brackets:[{dynamicFilters:[{fieldId:<main inner>, type:"BO",
  boiIds:[<value of «Зависимость от» in the DRAFT>]}]}]}`; with an inner field the `boiIds` are that value's inner
  field `[C]`. Passed as `brackets` to
  `load-bracket-ref-boi-table` it filters `[C]`.
- **In the UI it does NOT filter on this build** `[C]` (TABLE and MULTIPLE views, «Зависимость от» set and saved):
  the picker lists every record — the client sends `brackets: []`. The client only blocks the picker («relation_field_is_empty»)
  for the card-style view when «Зависимость от» is empty. Treat the relation as a client defect: if the
  restriction matters, use a script or a «С фильтром» filter instead.
- The server does not enforce it on save either: a mismatching combination is saved `[C]`.
- An archive carries only `relMainInnerFieldCode` — set `relFieldId` / `relInnerFieldId` after the import with
  the patch above (`MYBPM-IMPORTS.md` §3).
- Side effect of the constructor save: the UI also called `save-business-form-field` and made Имя / Регион /
  Город registry columns (`tableColToShow`).

#### «Читать из реестра» (`readFromRegistry`) of a panel's `BO` field `[C]`

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
  triple the server leaves `false` (from the UI and from the API alike). `readFromRegistry:true`
  alone, or with only one of the two other keys, IS stored. So turn it on through the API with the bare
  key; the UI shows the box ticked until the next reload.
- **A panel's record is per user** `[C]` (client: `checkBoiExists(boId, personId)` then
  `createBoiById(boId, personId)`): its `boiId` IS the viewer's `personId`, created on the first visit.
  So what an OFF field holds is each user's own list `[I]`. Open a panel by
  `/business-objects/viewing-single/panel?businessObjectId=<panel boId>` — the page adds the rest;
  `/viewing-list/panel/<boId>` falls through to «Главная». The first visit of a fresh panel may answer
  «Data too large» and hang on skeletons; a reload renders it.
- **A `BO` field added through the API needs `boFieldRefs`** `[C]`: with `[]` (what
  `generate-business-form-field` returns) the registry widget is EMPTY and the page toasts «target is
  marked non-null but is null». The UI's drag fills one entry per field of the target BO —
  `{fieldId, label, toShow, type, checked:false, orderIndex, gridPosition}`, `toShow` from the target's
  `tableColToShow` (the first field if none, at most 5, never TAB_GROUP / PROGRESS_BAR); send the same in
  `editedFields`. The drag also sets `viewType:"TABLE"` and `isKindAddForSelect:true`, which the API
  route must set itself.
- **Archive** — the export writes `"readFromRegistry": false` and OMITS the key when it is `null`; an
  import stores exactly what it gets — no key → `null` (registry), `false`, `true` — and the imported
  panel behaves like a constructor-built one `[C]` (`MYBPM-IMPORTS.md` §5a).
- Outside a panel the gear has no such checkbox; a form field's runtime still reads
  `readFromRegistry ?? isPanel`, so `true` on an ordinary BO's field would probably render it as a
  registry too `[U]`.

#### Per-type settings — checklist, questionnaire, progress bar, tabs, text editor, option colours `[C]`

The archive side is `MYBPM-IMPORTS.md` §3 «Per-type settings»; record behaviour holds for the form
cycle (§6b) and the card.

| type | gear → where | key (constructor patch) | what it does on a record |
|---|---|---|---|
| `CHECKLIST` | settings block | `isAppendable` «Добавляемый» | «Добавить» under the items — new items on the record |
| `CHECKLIST` | settings block | `isSelectOnly` «Выбор без редактирования» (`{fieldId, isSelectOnly:true}`) | the item texts are not editable, only ticked (without it a text stays editable even when the field is not appendable) |
| `CHECKLIST` | settings block | `isRequired` «Обязателен один пункт» | the SERVER refuses a record with no item ticked (`ALERT_SAVE_BUTTON_NOTIFICATION validate_required_title`) |
| `CHECKLIST` | settings block | `isRequiredAll` «Обязательны все пункты» | **nothing on this build**: stored, exported, imported, but the card (the client maps it to `false`) and the server both saved records with unticked items — through the UI and the form cycle |
| `QUESTIONNAIRE` | «Отображение» | `questionnaireIsMultiple` «Одиночный / Множественный» (`{fieldId, questionnaireIsMultiple:true}`) | single = radio buttons, one mark per row; multiple = checkboxes, several per row. Only the client keeps a row single — the form cycle stores two marks in one row of a single field. «Поведение» of a questionnaire is empty |
| `PROGRESS_BAR` | «Поведение» | `isProgressBarSticky` «Фиксация при скроллинге» (`{fieldId, isProgressBarSticky:false}`) | ON: the bar stays at the top of the card while the form scrolls (its grid row gets `div.isSticky`, `position: sticky`); OFF: it scrolls away. `params.isSticky` is only a create-time default, ignore it |
| `TAB_GROUP` | settings | `params.showAsStepper` «Показать как степпер» | **nothing on this build** — stored and exported, but no runtime component reads it; the card shows ordinary tabs |
| `TAB_GROUP` | settings (offered only with ≤ 1 tab) | `params.needDisableTabs` «Отключить вкладки» | the tab strip is hidden; the fields of the tab show as plain form fields |
| `TAB_GROUP` | tab strip in the body | `tabs[].isRight` | the tab sits at the right end of the strip |
| `TEXTAREA`, `TEXTAREA_LANG` | settings, 16 checkboxes «Включить настройку '…'» | `params.buttonTypes` = JSON TEXT of an array (`{fieldId, params:{buttonTypes:"[\"bold\",\"table\",\"codeview\",\"height\",\"italic\"]"}}`) | the editor toolbar shows exactly those buttons. Members: `style bold underline italic fontsize color ul ol paragraph table link picture video hr codeview height`; absent = the default ten `bold underline italic fontsize color ul ol table link picture` |
| `DROPDOWN_SINGLE` | option chip in the body / kanban editor | `options[].color` = any CSS colour string — a colour name in any case (`RED`, `green`, `PURPLE`, `PINK`…) or hex (`#0048ff`, `#0f0`); `null` = no colour | the kanban column colour: the column title text and the bar under it, `null` = black title over the default blue bar; a light colour (`YELLOW`, `PINK`) is hard to read — prefer a darker hex; the record card shows the option uncoloured. A `RADIO_BUTTON_GROUP` stores a colour too, and it shows nowhere — no kanban is built on a radio |

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

`MYBPM-IMPORTS.md` §3 «Единичный выбор» has the archive side.

- **Over the API** it is the dropdown recipe of R1 with a local list: on the DTO of
  `generate-business-form-field {boId, fieldType:"RADIO_BUTTON_GROUP"}` set `optionSource:"FROM_FIELD"`,
  `refBoId:null`, `options:[{instanceId:null, id, label, labelMap, color, code:null, orderIndex, hiddenInKanban:false}]`
  (ids from `v2/id-loader/load-portion`) and, for an option chosen in advance, `defaultValue: "<option id>"` —
  all stored on ADD; option codes come back generated from the labels (`Da`, `Net`, `Mozhet_byt`) `[C]`. **Set
  the codes by a later EDIT of `options`** (the same option ids, `code` changed; `editedFields: [{fieldId, options}]`)
  and read them back: the stand regenerates the codes a moment after the add, so an EDIT in the very next
  portion save may be overwritten — repeat it after a second until the read-back holds `[C]`. The constructor
  UI sets an option code the same way — a normal portion EDIT of `options`, no setter of its own `[C]`.
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
  control only sets).
- The registry column shows the option's label.

#### «История» — `isHistoryTracking` and the BO tab `HISTORY` `[C]`

- **Two switches, both needed.** Per field `isHistoryTracking: true` (a one-key `editedFields` patch through
  `save-business-object-portion`, mirrored into `formFields`; constructor: tab bar on the right of the form →
  «История» → its gear → «Отслеживать изменение полей», a checkbox per field, `changeFieldHistoryTracking` →
  `upsertFieldToEdit`) AND per BO the tab itself: `businessObject.boTabs: [{type: "HISTORY", orderIndex: 1}]` in
  the same portion (switch off = `boTabs` without it + `delBoTabs: ["HISTORY"]`). Tab types `CHAT PEOPLE FILES
  HISTORY PRINT_FORM` (+ `TELEGRAM`/`WHATSAPP`), all of them §5k. In an archive the same is
  `boTabs: {"HISTORY": 1}` (a map) — see `MYBPM-IMPORTS.md` «Field flags».
- **What gets logged**: no tab, no flag → journal empty; tab only → field edits not logged; tab + flag on
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
  and unflagging alike); a record save renames that record at once.
- **Archive**: the keys travel on `dynamicFields` (export, copy import → same flags and order, new record named
  from them). For a NATIVE the import applies `nativeFields.<TYPE>.titleToShow` but the export writes `false`
  (see `MYBPM-IMPORTS.md` «Field flags» «Название записи»).

#### What the settings actually DO on a record

- A required field is marked with a red `*` on the record card; saving with it empty is refused with the
  dialog **«Внимание — Карточка не соответствует требованиям: 1. Обязательные поля не заполнены»** and the
  field outlined red.
- A duplicate in a unique field is refused with the field-level tooltip **«Ошибка — Продублировано
  уникальное поле»**; the card stays open and nothing is written.
- A read-only field renders as a grey `disabled` input, **and a script still writes it** `[C]`
  (e.g. a button's «На изменение поля» script fills a read-only INPUT_TEXT on the open card). So «Только для чтения» is the right flag for the fields a script fills — the user cannot type
  into them, the script can. Set on an existing BO as a one-key `editedFields` patch
  `{fieldId, isReadonly: true}` (mirrored into `formFields`).
- A `FROM_BO` dropdown lists the dictionary's rows, a
  `FROM_FIELD` one lists its own options — both with a «Поиск» box.

### 5i. Every field type, widget and system field — constructor UI and API `[C]`

Three families, three palette sections, three generator endpoints. The archive half is in `MYBPM-IMPORTS.md` §0.5 / §0.12 / §0.13.

#### The palette — what the constructor really offers `[C]`

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
- **Tab code, rename, order** `[C]`: a tab's code changes only through `v2/business-objects/update-tab-code`
  **PARAMS** `{boId, fieldId:<group>, tabId, newTabCode}`; a new `label` in `tabs[]` never recodes the tab.
  `orderIndex` is ignored on a save — the server renumbers the tabs from their position in `tabs[]`.
- **Deleting a tab** `[C]`: `editedFields [{fieldId:<group>, deletedFieldTabIds:[tabId], tabs:[the remaining
  tabs]}]` and the tab's fields in `deletedFieldIds` (the UI lists them itself; `analyze-tab` first, see §5b
  «Delete a tab»). To keep a field, take it off the tab first (`gridPosition` outside the group, no `tabId`).

#### FILE_UPLOAD display mode — `params.viewType` `[C]`

The gear → «Отображение» radio (Одиночный / Множественный / Плиточный) is written by the constructor as
`editedFields: [{fieldId, params: {viewType: "MULTIPLE", contentType: "ALL"}}]`. **The key is
`params.viewType`, not the top-level `viewType`.** Setting only the top-level key over the API left
the radio on «Одиночный». Two rules follow:
- **For a photo to show in the field without downloading it, choose «Плиточный»** (not «Множественный»:
  there a PNG written by a script still renders as a file row with a preview on click). **«Плиточный» writes `params: {viewType: "TILE",
  contentType: "ALL"}`** `[C]` (the top-level `viewType` is ignored). In «Плиточный» the PNG shows as a
  thumbnail tile on the card. Known values: `MULTIPLE`, `TILE`; the «Одиночный» one is `[U]`.
- **In MULTIPLE and TILE mode the field's `#Значение` is `File[]`** (TILE `[C]`): a script that assigned one file stops
  compiling with `blockAssign_arrayAssignNoArray` (`MYBPM-IMPORTS.md` §12a, RestResponse notes).
- **«Поведение для MP» = `params.contentType`, mobile app only** `[C]`. Enum `ALL` /
  `IMAGE` / `DOCUMENT` / `FOR_CAMERA`; the gear checkbox «Только камера» writes only `FOR_CAMERA` ↔ `ALL`
  (`saveParams` → the same `editedFields` patch with the whole `params`), so it overwrites an `IMAGE` /
  `DOCUMENT` set over the API or an archive. All four can be set over the API (`params` on an added field)
  and survive an export and an import. **On the web nothing changes**: all four render
  `<input type=file accept="*">` without `capture`, and the server does not check the file kind — any file
  (a `.txt` too) is stored in a `FOR_CAMERA`, `IMAGE` or `DOCUMENT` field. The mobile behaviour itself is `[U]`.

#### GEO_POINT («Карта») is the platform's own map, not Yandex `[C]`

- **The «Карта» field works with Google.** The company settings screen «Навигатор» goes through the
  controller `/geo-map/settings` (`load-geo-map-company-fields`, `load-geo-map-company-field-values`,
  `save-geo-map-company-field-values`, all with P `{geoMapType}`). The only `geoMapType` is `GOOGLE_MAP`,
  and the screen takes a Google API key («Google API ключ действителен»). The coordinate picker dialog
  itself draws Leaflet on `tile.openstreetmap.org` tiles `[I]`.
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

**An IFRAME shows one fixed url per BO, and the record is NOT passed to it** `[C]`. The card calls `load-iframe-url {boId, iframeId}` and puts the answer
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

- **The click is a field change.** The widget's click handler runs
  `forkJoin([load-button-url, load-button-field-ids, changeValue$()])`. `changeValue$` sends the button's
  value to the draft, and that fires the field's «Изменение поля» script server-side, like
  `save-field-value` does for any field (§6b). Each click fires it again, and its field writes come back
  in `fieldFormCommands` and show on the open form at once. Headlessly the same click is
  `save-field-value {values:[{fieldId:<button id>, value:""}]}`.
- **The script is the only thing a button reliably does; leave its `url` EMPTY.** What each url does on the
  record card is in the next section. In short: `call/plugin/…` needs a plugin installed on the server.
  `client/save-current-boi` and `create-boi/…` do nothing on the card. Any other url does nothing either.
- Worked example: buttons, each with its own field script:
  `RestRequest` GET → `resultCode` / `resultAsText` into the record's fields
  (`MYBPM-IMPORTS.md` §0S, `RestRequest` in §12a). The GET `[C]`: `Пусть #запрос# = Создать Rest-запрос`
  (`JavaObjectFactories` `BEAN_METHOD-RestExtensions-createJsonDeck` → `Object/RestRequest`) →
  `#запрос#.адрес = …` (`F-address-K-FIX-T-RestRequest`, write-only) → `#запрос#.Метод вызова = GET`
  (`F-method-K-FIX-T-RestRequest`, Enum `RestRequestMethod` `GET`/`POST`/`PUT`) → optional
  `#запрос#.#Заголовок(name, value)` (`F-setHeader-K-FIX-T-RestRequest`, `BlockAssign` without right) →
  `Пусть #ответ# = #запрос#.#вызвать` (`F-call-K-FIX-T-RestRequest` → `Object/RestResponse`) →
  `F-resultCode-K-FIX-T-RestResponse` (Number; into text via `'' ⊕ …`) and `F-resultAsText-K-FIX-T-RestResponse`.
  **A 4xx does not throw** — the script goes on with `resultCode` 401/403 and the error body; every non-2xx
  also raises a user notification that shows the WHOLE url, query string included — put secrets in a header.
  A Cyrillic value may go into `адрес` raw; the platform encodes it.

#### What a BUTTON's `url` does on the record card `[C]`

The card draws a button with
`mybpm-ng-widget-button`. A click runs `load-button-url` + `load-button-field-ids` +
`save-field-value(<button>, "")`, and the last call fires the button's field script. After that the url
is read by its PREFIX:

| url | what happens on the card |
|---|---|
| empty | nothing more. **This is the working button: a script on «Изменение поля» does the job** |
| `call/plugin/<name>/…` | `v2/button/call-button-plugin {boId, boiId, fieldId, draftId}`. `<name>` is a **plugin registered on the server**, not something you write. An unknown name answers HTTP 400 «No such plugin `<name>`» and a red toast. The card sends **no** field values: the plugin reads the record itself |
| `client/save-current-boi` | **nothing — the record is NOT saved.** The handler emits on `BoiEventHandlerService.saveBoiSubject`, and no component subscribes to `saveBoi$`: no `validate-apply`, the typed value stays unsaved, the dialog stays open |
| `create-boi/<toFieldCode>/<from->to, …>`, `client/create-boi/…` | **nothing on the card.** Only the «dff» button component handles it, and the record card does not use that component. Which screen uses it is `[U]`. Per its code `[I]` it opens a create dialog for the BO behind the BO/CO field `<toFieldCode>`, copies the listed values (`Текст->Название`), and puts the new record into that field |
| anything else (`https://…` too) | nothing. A button never navigates |

- **«Поля для отправки» = `save-button-field-ids` = the archive's `fieldCodes`.** The card does not send
  them anywhere. They are meant for the server plugin. In an archive they are a map
  `{"<field code>": "<archetype>"}` (`MYBPM-IMPORTS.md` §0.13). An import turns it back into the field
  ids that `load-button-field-ids` returns `[C]`.
- A button has its own lock: `v2/button/load-access-group {boId, buttonId}` answers
  `{all, view, edit, create, …}` with `accessForAll: true` by default; `save-access-group` P `{boId, buttonId}`
  B the group itself (only `view` is offered) is stored — no chosen-access-right call follows `[C]` (§5b «Widget lock»).

#### The CURRENT_USER widget («Текущий пользователь») — settings `[C]`

- **What it shows: the person who OPENS the card, not the record's author.** The card component
  (`app-widget-current-user`) asks `v2/widget-current-user/load-bo-id` for the «Пользователи»
  BO and shows `[authInfo.personId]`, read-only, through the ordinary nested-record selector. **A record
  stores nothing for it**: `v2/load-boi-values` of a saved record has no entry for the widget's
  `fieldId`. Do not use it to record who created or changed a record. Use the natives `CREATED_BY` /
  `LAST_MODIFIED_BY` for that.
- **The DTO** from `generate-business-form-widget {widgetType:"CURRENT_USER"}` is `type:"BO"`,
  `boFieldArchetype:"WIDGET"`, `widgetType:"CURRENT_USER"`, `refBoId` = «Пользователи», `isReadonly:true`,
  `viewType:"TABLE"`, and `boFieldRefs` = every field of «Пользователи» with
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
- All four survive an export and an import (`MYBPM-IMPORTS.md` §0.13, «CURRENT_USER round-trips»):
  `currentUser.<code>` carries `viewType` and `fieldRefs` keyed by the «Пользователи» field CODES, and the
  lock is a normal `fieldAccessStructMap.<widget code>` entry of the `AccessStructDto`.

#### The CURRENT_* date widgets («Текущая дата / день / месяц / день и месяц / год») `[C]`

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
    participants:true`) works on all five.
- **On the card**: a disabled `nz-date-picker` in the format
  `dd.MM.yyyy` / `dd` / `LLLL` / `dd.MM` / `yyyy`. For 1 October of year `YYYY` the five show `01.10.YYYY`, `01`,
  `октябрь`, `01.10` and `YYYY`. The placeholder of «день и месяц» is the untranslated key `day_and_month`.
- **Nothing is stored.** `v2/instance-field-form/load-field-data` gives every widget the server time when
  the DRAFT was created, as an ISO string, and a new draft gives a new time. A `save-field-value` into
  the widget is accepted and the record saves, but the next draft shows the current time again. `load-boi-values` does not list the widgets. For a stored date use a DATE field or
  the native `CREATED_AT`.
- The palette offers each type once per BO; **the server accepts a second widget of the same type** (it
  gets its own derived code).
- Archive: `currentDates.<code>` + `fieldAccessStructMap.<code>`, both survive (`MYBPM-IMPORTS.md` §0.13,
  «CURRENT_* date widgets round-trip»).

#### The CAPTCHA widget («Блок captcha») — settings and what it does to saves `[C]`

- **The DTO** from `generate-business-form-widget {widgetType:"CAPTCHA"}`: `type:null`,
  `widgetType:"CAPTCHA"`, label «Блок captcha», `code:null` (also after the save, like every widget but
  BUTTON). The server derives the code `Blok_captcha`. It may repeat on a BO. Height 6 rows.
- **Settings: the code and the lock, nothing else.** The gear holds only the code (the change-code
  dialog calls `saveCaptchaCode`); the gear side is `[I]` (read off the client code, not the screen).
  - code: `v2/captcha/save-captcha-code {boId, captchaId, code}`, **asynchronous**: the old code is
    still read back 1 s later, the new one after 2 s. **The server does not check the code**: a Cyrillic
    one is stored as is, so check the code yourself against the naming convention (§0U.5 rule 12).
  - lock: `v2/captcha/load-access-group` / `save-access-group {boId, captchaId}` (params) + the access
    group as the body. Only `view` is used, and the default is `accessForAll: true`.
- **On the card** (dialog card): an image, an input and «Подтвердить».
  It is shown at once. Another card component shows it only after the first value change.
  - image: `GET /web/v2/captcha/generate?draftId=<draft>` with the `token` header → a PNG of 160×50 with
    five characters. **It is a GET with a query string**: a POST answers `405 Method Not Allowed`.
  - check: `POST v2/captcha/validate {draftId, code}` (params) → `true` / `false`. On `false` the card
    fetches a new image right away. On `true` the button turns into «Подтверждено» and a «Вы прошли
    верификацию» line appears. The captcha belongs to the DRAFT.
- **The server enforces it** (`CustomBoCaptchaValidator.validateOnSave`):
  `v2/instance-form/validate-apply-remove-draft` answers `{"errorType":"CaptchaNotVerified",
  "message":"… :: Капча не верифицирована"}` for a draft that CHANGED a value and for a NEW record,
  until the captcha of that draft was validated. A draft with no changes saves. **The four-call cycle of §6a is blocked the same way**: `apply-and-remove-draft`
  answers `CaptchaNotVerified` and no record is created. **So the record API (§6a), the headless form cycle (§6b) and every client that has
  no human to read the image cannot save records of a BO with a captcha.** Whether scripts and the xlsx
  import are blocked too is `[U]`. Removing the widget (`deletedFieldIds`) makes saving work again at once.
- The positive path (a solved captcha, then a save) is `[U]`: solving the image needs a person.
- Archive: `captcha.<code>` + `fieldAccessStructMap.<code>`, both survive (`MYBPM-IMPORTS.md` §0.13,
  «CAPTCHA round-trips»).

#### The SIGNATURE widget («ЭЦП / СМС») — settings `[C]`

One SIGNATURE per BO.

- **The DTO** from `generate-business-form-widget {widgetType:"SIGNATURE"}`: `type:null`,
  `widgetType:"SIGNATURE"`, label «ЭЦП/SMS», 6 rows high. The server derives the code from the label
  (`ECP_SMS`). Unlike the other widgets it shows the field-script icon in the constructor `[I]`.
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

  The UI sends exactly this. The API call with the same body works without the
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
  («…указать подписываемые поля/документы»). With the widget added the flag becomes
  Unsupported, and **nothing on the stand clears it** `[C]` — do not retry ticked fields or a print form on
  the linked widget, the same widget code or id, no phone on either side, a stand restart: the linked BO
  keeps `signFieldUnsupported` (and the mass FIELD row keeps `signFieldEmpty` as well). Every linked BO with a SIGNATURE carries it, hand-made ones included. The criterion is
  server-side only `[U]`, the client merely prints the flag. `load-mass-print-forms` answers one row per
  SIGNATURE widget of every BO referenced by ANY BO field (not only the mass fields), and its `pfRecords`
  stay empty, so the UI cannot pick a mass print form at all.
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
  `sign-otp`, `save-signed-data`, `load-signatures-list`) is `[U]`: it sends a real SMS. In
  scripts the result is `#получи подписи` → `Object/MybpmSignature[]` (`MYBPM-IMPORTS.md` §12a).
- **The archive form** (`signatures.<code>`) and what survives an import: `MYBPM-IMPORTS.md` §0.13 «SIGNATURE
  round-trips». In short, everything travels by CODE except `massPrintFormCodes`, which no import brings
  back (`[I]`: nothing is offered to resolve it against); re-importing onto the SAME BO also clears the phone
  and duplicates the print forms (trap 71).

#### System fields (natives) — settings `[C]`

A native is added over the API with `generate-business-form-field-by-native` + the §5b portion save.
A native's `fieldId` = its `code` = the native type (`CREATED_BY`, …) — use it wherever an
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

- `OPEN_COUNT` grows by one on every card open; `IN_MIGRATION_UPDATED_AT` is empty unless an
  IN migration wrote the record.
- **The archive does NOT carry a native's lock**: the export writes it (`AccessStructDto.fieldAccessStructMap.
  <NATIVE_TYPE>`), the import ignores it — and still sets `chosenAccessRight: true`, so the copy shows an
  orange lock over rights that are «всем». A dynamic field's lock in the same archive arrives. After an
  import, set native locks with `save-field-access-group` (`MYBPM-IMPORTS.md` §0.12 «What travels»).

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
| read | `load-print-forms {boId}` → `[{printFormId, name, fileType, orderIndex}]`; `load-print-form {boId, printFormId}` → `+ fileId, fileInfo`; `get-print-form-code {boId, printFormId}` | the server derives the code from the name («Проба ПФ подпись» → `Proba_PF_podpis`); the change-code dialog changes it (below) |
| order | `save-print-form-order-indexes` P `{boId}` B `[{printFormId, orderIndex}]` | ALL rows, `0..n-1` in the new order → `printForms.<id>.orderIndex` |
| access | `load-access-group {boId, printFormId}` → the generic access DTO (`all, useAll, view, edit, create, delete, archive, export, duplicate, add`); `save-access-group` P `{boId, printFormId}` B the whole DTO | → `printForms.<id>.accessGroupId`. The UI uses only `view` («Просмотр») and `export` (download) |
| test values | `load-test-values {boId, draftId, type}`, `type` = `TEMPLATE` (the template's placeholders) / `BO` (every dynamic field label) / `NATIVE` (system fields) → `[{label, value, isFound}]`; `save-test-value` P `{draftId}` B `{label, value}` | stored apart from the BO, one set per BO keyed by label (below) |
| download | `GET v2/print-form/download-test ?boId&draftId` (a draft) or `?boId&printFormId` (a saved form) | the template filled with the test values; file name = the template's, extension of `fileType` |
| delete | `delete-print-form {boId, printFormId}`, `remove-draft {draftId}` | other rows keep their `orderIndex` |

An export carries the template itself: `printForms[]` on the BO and one `ExportStructFileDto` line per file
(`MYBPM-IMPORTS.md` §0.13 «Print forms»).

- **`save-file-Id` can take minutes** `[C]` (more than 2 minutes). A browser call
  keeps running after the automation's timeout, so a «retry» creates a second form; the code is not unique
  (both get the same code). Read `load-print-forms` before retrying. `delete-print-form` is asynchronous as
  well — the form is still listed for a few seconds.
- **Re-imports and rollbacks multiply forms** (trap 71): a re-import matches forms by `newId`, not by code.
- **Template placeholders** `[C]`: `${<field label>}` (`MYBPM-IMPORTS.md` §0.13 «Print forms»). A placeholder
  with no value stays literal in the result.

#### Print forms in the UI `[C]`

- **The panel** exists only after the record-card rail «+» picker ticks «Печатные формы» and the card
  СОХРАНИТЬ saves it (§5k). Its rail icon opens the list (`load-print-forms`) with «Добавить документ» at the
  bottom.
- **«Добавить документ»** → dialog «Добавление печатной формы» = `create-draft`. Typing «Наименование» =
  `save-name` at once; the radio «Файл при скачивании» DOCX / PDF = `save-type` at once; «Шаблон(*.docx)» takes
  only a .docx (upload → `save-file-Id` → `load-test-values TEMPLATE`) and shows a page preview. The right pane
  «Переменные» has tabs «Из шаблона» / «Из объекта» / «Системные» (`TEMPLATE` / `BO` / `NATIVE`) with a test
  value per row (`save-test-value` on typing). «Скачать с тестовыми значениями» = `download-test` of the
  draft. СОХРАНИТЬ (grey until name + template) = `apply-draft`; ОТМЕНИТЬ or a backdrop click = `remove-draft`.
- **A row** carries, left to right: the type icon (pdf/docx — downloads the form with the test values), the
  gear (the change-code dialog «Изменение кода Печатной формы»: `print-form/refresh-code` →
  `analyze-code-usage {boId, printFormId}`, `verify-print-form-code {boId, printFormCode}` while typing,
  «ИЗМЕНИТЬ КОД» = `apply-new-code {newPrintFormCode, refreshId}`, closes silently), the pencil (dialog
  «Редактирование печатной формы» = `create-draft {boId, printFormId}`), the lock (access popover: «Просмотр» /
  download, «ВСЕМ / ВЫБОРОЧНО» → `save-access-group`), the trash (confirm «Удаление печатной формы» →
  `delete-print-form`, the row drops locally). Dragging a row = `save-print-form-order-indexes` for all rows,
  sent even when the row lands where it was.
- **Renaming a form regenerates its code** from the new name: a custom code is replaced by the transliterated
  new name, so whatever names the old code (a SIGNATURE's `printFormCodes`) no longer finds the form `[I]`. An
  edit that keeps the name keeps the code. Set the code again with the gear dialog after a rename.
- **Test values are shared by all print forms of the BO**, keyed by label: a new form's dialog opens with them
  filled, and a form never given a value downloads with them.
- **A new form is listed FIRST** until an order is saved (every form has `orderIndex` 0).
- **`apply-draft` and the list reload right after it may show the OLD name** (stale read); reopening the panel
  shows the new one.

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
  either — sort it itself: set the child's sort (`save-bo-table-sort`, below) and read the rows with
  `F-VALUE_FROM_LIST-K-DYN-R-D-S-boi_fields` («Значения как в реестре» — the registry's order, no drafts)
  instead of `#Значение`, or do a selection pass (`ЦИКЛ COUNT раз { лучший = 10⁹; foreach строка: ЕСЛИ номер >
  пред И номер < лучший → лучший = номер; ЕСЛИ лучший < 10⁹ → пред = лучший; обработать }`, only `More`/`Less`/
  `And`) `[C]` (§5g «The script language»).
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
  `0.9·innerHeight` — the server takes any `h` `[C]`, so that cap is the only ceiling. The viewer re-centres `x = ceil((16−w)/2)`. A form of `R` rows
  needs `h = R + 5` `[C]` (title + button bar 99 px, body padding 28); without a position the dialog is
  90 % × 90 % of the screen. A child's window is narrower than its parent's (`MYBPM-IMPORTS.md` §0.8a step 7). For two fields in one row, `w:6, h:8` gives a
  compact dialog: fields plus the СОХРАНИТЬ/ОТМЕНИТЬ bar.
- **A required `INPUT_NUMBER` starts at 0** on a CREATE dialog, so it counts as filled. The red `*` and
  the warning appear only after the user clears it. `isRequired` really is on, but nothing forces the
  user to type a number.
- Driving it from an in-page script: `el.click()` on the picker's «Добавить» does nothing — dispatch
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
through the controllers above.

#### The archive route carries all of it — checklist items included

A «Чек лист» keeps its items in the field's **`defaultValue`** (a JSON string of `{label, checked}`), and
that key travels: imported items show up on a new record's form, `checked:true` ones ticked `[C]`. Do not look for them in
`options` / `fieldOptionsStruct` (that reads as «items are lost») — a checklist does not use them (an import ignores that struct on a
checklist and even resets the field's `optionSource` to `null`). Everything else — all 27 types with their settings, all six system fields, all ten widgets with their
codes and urls — survives the archive round trip unchanged.

### 5j. BO header settings — name, description, code, «Помечать новые», «Скрыть кнопку добавить», Карточка/Вкладка `[C]`

The settings of the BO ITSELF that sit in the constructor header and its gear popover. Format side:
`MYBPM-IMPORTS.md` §2 «BO header settings in the archive».

| setting | UI place | API (all `v2/business-objects/…`, PARAMS half, answer `""`) | archive key |
|---|---|---|---|
| name | header «Наименование:» input | portion `{businessObject:{id, nameMap, recordNameMap, description}}` | `name` |
| record name | — (no control of its own) | the same portion, `recordNameMap` | `recordName` |
| fields that name a record | «Карточка» view → gear right of the BO name in the canvas header → popover: search «Найти поля для заголовка карточки» + a checkbox per DYNAMIC field (no system fields, no `TAB_GROUP`), order badges 1, 2 …; tick / untick writes AT ONCE; no drag — a re-tick moves the field to the END | `save-bo-fields-for-bo-name` (§5i «Название записи») | `titleToShow` / `titleOrderIndex` on each field |
| description | header centre textarea | the same portion, `description` | `description` |
| code | gear → «Код бизнес - объекта» → pencil → dialog «Изменение кода бизнес объекта» | `save-business-object-code {businessObjectId, businessObjectCode}` — or the dialog's cycle, below | `code` |
| «Помечать новые (непросмотренные) записи» | gear → checkbox → «Сохранить» | `save-business-object-settings {businessObjectId, businessObjectCode, isTouchEnabled}`; read `load-bo-is-touch-enabled {boId}` | `isTouchEnabled` |
| «Скрыть кнопку добавить» | gear → checkbox → «Сохранить» | `save-bo-hide-add-button-from-registry {boId, hideAddButtonFromRegistry}` | `hideAddButtonFromRegistry` |
| Карточка / Вкладка | toggle «Карточка ◯ Вкладка» at the right end of the canvas header, writes AT ONCE | `save-boi-view-type {boId, type: "FORM"\|"TAB"}` | `instanceViewType` |
| record window size | eye icon right of that toggle → the record preview → drag its bottom-right corner, writes AT ONCE; close = a click outside it | `save-business-object-grid-layout-position` BODY `{boId, gridLayoutPosition}` (§5i «Size of the child's record dialog») | `gridLayoutPosition` |
| «Список полей» | gear → link → a field chooser (search + every field label, sorted by label) | none — navigation: a label click closes the popovers, opens the tab holding the field and scrolls the canvas to it, highlighted | — |

All of them read back in `load-business-object-by-id` at once. Defaults of a new BO: `isTouchEnabled: true`,
`hideAddButtonFromRegistry: false`, `instanceViewType: "FORM"`, `description: ""`.

- **The header name input writes BOTH maps** `[C]`: typing in «Наименование» overwrites `recordName`
  with the same text. A `recordName` different from the name exists only through the API or an
  archive, and nothing on screen shows it: `load-bo-components` returns it beside `name`, and the record title
  does NOT use it (next point).
- **A record with no `titleToShow` field is named after the BO's `name`, not its `recordName`** `[C]` —
  the record tab carries the BO name.
- **«Скрыть кнопку добавить»** `[C]`: the registry loses its create button; the `⋮` there then offers only
  «Импорт из .xlsx» / «Экспорт в .xlsx» — records still come in through Excel and the API.
- **TAB** `[C]`: a record opens as a page tab (`display-instance?…&isTab=true&boiViewType=TAB`), FORM as a dialog.
- **`isTouchEnabled`** `[C]` as stored; what it does `[I]` (bundle): the menu-item editor asks
  `load-bo-is-touch-enabled` and shows the «needCountMenuItem» (unread counter) option only when it is true. The
  counter itself is `[U]` — records you create yourself are never «new» to you.
- **Archive** `[C]`: all seven keys of the table travel. A
  re-import WITHOUT `isTouchEnabled` / `hideAddButtonFromRegistry` / `instanceViewType` / `description` RESETS them
  to `true` / `false` / `FORM` / `null` — always ship every key.
- **The popover «Сохранить» re-sends the code** through `save-business-object-settings` (the input there is
  read-only), so that endpoint also changes the code.
- **The record window size is per BO** `[C]`: one `gridLayoutPosition` on the BO for every user, and only the
  constructor preview resizes it — the registry's record dialog opens at that size and has no resize handle. The
  preview re-centres `x = ceil((16 − w) / 2)` and shows `h` capped at `floor(0.9·innerHeight / 30)`; the stored `h`
  keeps the dragged value.

#### Changing the code — the dialog's cycle, and the two direct calls

The dialog runs controller **`bo/refresh-code`** — `/web/bo/refresh-code/<m>`, NOT under `v2` (a `v2/bo/…` call
answers 404): `analyze-code-usage {boId}` → `{refreshCodeDtoId, migrationType: [], alreadyInUse,
involvedInAnyMigration}`; poll `is-analyze-done {refreshId}` → `{done, errorMessage, scriptOwners, bpOwners}`;
then `apply-new-code {refreshId, newBoCode}` (answers `""` and the new code is live at once `[C]`); `cancel {refreshId}` drops it, though the run on the server goes on to its end `[I]`. The analysis scans the scripts and
processes that use the code (so the dialog can list them). Fields have the same cycle under `field/refresh-code`
(`analyze-code-usage {boId, fieldId}`, `apply-new-code {refreshId, newFieldCode}`).

- **In the dialog** `[C]`: opening it starts the analysis (`analyze-code-usage` + `load-business-object-code` +
  `is-analyze-done`); typing runs `verify-business-object-code` (debounced). A TAKEN code shows only an orange
  border and a warning icon — no text — and «ИЗМЕНИТЬ КОД» stays grey; the button is also grey while the analysis
  runs, the code is unchanged or invalid. «ИЗМЕНИТЬ КОД» = `apply-new-code`, the dialog closes with no message and
  the popover shows the new code at once. Each opening is a new analysis. The same dialog changes the code of a
  field and of a print form.

- `apply-new-code` before `done` answers `""` and changes NOTHING `[C]`.
- The dialog checks the new code on the client — not empty, no leading digit or one of `- = \` ~ ! @ # $ % ^ & * ( ) +`,
  no `#`, not a Java keyword or `id`/`in_id`/`out_id`/`inserted_date`/`in_status`/`occupied_id`/`occupied_at`/`removed`
  (`[I]`, bundle) — and on the server: `verify-business-object-code {businessObjectCode}` → `false` for an empty
  or TAKEN code, `true` for anything else, Cyrillic and spaces included `[C]`.
- **`save-business-object-code` and `save-business-object-settings` change the code at once and check NOTHING**
  `[C]` — they accept a code already used by another BO of the company (two BOs then share it), Cyrillic,
  spaces and the empty string. They also skip the usage analysis, so scripts and processes that name the old
  code are not migrated. Before calling either, run `verify-business-object-code` yourself.
- **Only one field-code analysis runs on the stand at a time** `[C]` — an `analyze-code-usage` started while
  another one is still running (any field, any company; BO-code analyses are counted apart) gets a
  `refreshCodeDtoId` the server does not keep: `is-analyze-done` answers `done: true`, `errorMessage: null`
  at once, and `apply-new-code` then fails with `RuntimeException «no refreshCodeDto with id: …»`. An unknown
  id behaves the same — **`done: true` within a second or two is NOT a finished analysis**; a real one takes
  ~35 s. `cancel` does not free the slot, and each lost call seems to keep it busy longer `[I]`: run code
  changes one at a time, never in parallel, never cancel-and-retry in a loop; if analyses keep coming back
  instantly, stop calling for ~5 min, then one analysis runs normally (trap 59).

### 5k. Card tabs — `boTabs`, `delBoTabs`, the messenger link field `[C]`

The icons on the right-hand rail of a record card. Constructor: «Карточка» view → the rail right of the form →
`+` → a checkbox list «Чат / Люди / Файлы / История / Печатные формы / Telegram / WhatsApp»; a tab is removed by
its trash icon (confirm «Удаление вкладки бизнес-объекта. Продолжить?») or by unticking it (no confirm); HISTORY and
WHATSAPP/TELEGRAM carry a gear instead of a trash icon — for a messenger tab the trash sits in the gear's popover
(below). The list has a search box; Telegram / WhatsApp are disabled there while the company's messenger is not
connected `[C]` — so is the whole «Использование» tab of Settings → «Мессенджеры» (§5n). Nothing is written until
the card «СОХРАНИТЬ». Format
side: `MYBPM-IMPORTS.md` §2 «BO card tabs in the archive».

**Reorder the rail** `[C]`: the rail has no drag. Its order is the order the boxes were ticked — untick a tab and
tick it again to move it to the END, repeat until the order is right, then «СОХРАНИТЬ». The save sends `boTabs` in
rail order with `orderIndex` 1, 2 …; an untick + re-tick of a saved tab nets out (`delBoTabs: []`).

On the record card: CHAT = the record's chat («N собеседников», message box), PEOPLE =
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
  disabled in its list («выберите данный бизнес-объект в меню Настройки»), so only the API or an archive puts the tab
  on a BO of a company whose messenger is not connected.
- **Messenger tab in the constructor** `[C]`: the rail tab's gear → popover with a gear (settings) and a trash
  in its header. Settings: «Выберите метод поиска» → Логин / Телефон, then «Выберите поле» → the fields of the
  matching type (Логин → `INPUT_TEXT`; Телефон → `INPUT_PHONE` `[I]`); the popover «СОХРАНИТЬ» writes the link field AT
  ONCE (`save-messenger-link-field-id`, no card save). A click outside an open dropdown only closes it — the first
  click on «СОХРАНИТЬ» is eaten. Trash → confirm «Удаление вкладки бизнес-объекта. Продолжить?» → the tab leaves the
  rail, the card «СОХРАНИТЬ» writes `boTabs` without it; **the link field stays set** — clear it with
  `fieldId: null` (next point).
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
- What a connected messenger does with the tab (chat mirroring, the user search) is `[U]`; the company switch is
  `messenger/settings/save-messenger-bo-settings` (company-wide).

### 5l. BO views — «Календарь», «Карта», «Группировка» `[C]`

Three registry views are switched on the BO itself. Format side: `MYBPM-IMPORTS.md` §2 «BO views in the archive».

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
reads «Статус : Новый, Дата : 05.10.2026». A new BO starts with one title (the name field, or another field — the
default is not stable). **The titles do NOT travel in the archive** — no key in the export; a re-import leaves the
stand's titles alone, a copy gets its own default. The hover card is `calendarCardTemplates` (§5i, travels).
Which dates place an event: `needShowToCalendar` (§5h).
- **Titles in the constructor** `[C]`: «Календарь» view → «Настройка отображения заголовка:» = chips + `⋮`. `⋮` →
  picker (search + every field, `TAB_GROUP` included; loaded by `load-bo-field-records {boId}`): a tick appends
  the field, an untick or a chip's `×` drops it — each AT ONCE, the whole list. The chips have no drag: the order is
  the tick order, a re-tick moves a field to the end. The last chip can go too (`titles: []`), then a link
  «Выберите» opens the same picker.
- **Hover card** `[C]`: «Настройка отображения информации при наведении:» → gear → dialog: left = search +
  «Динамические поля» / «Системные поля» (`v2/calendar/load-calendar-card-fields {boId}` → only the fields not on the
  card yet), right = the card's header / content / footer. Drag a field onto a zone; the header holds ONE field (a
  second one replaces it), content and footer several; drag it back onto the list to remove it. «СОХРАНИТЬ» =
  `v2/calendar/save-calendar-card-template` P `{boId}` B `{header, content, footer, headerDelFieldIds,
  contentDelFieldIds, footerDelFieldIds, alreadySelectedIds: []}`, items `{fieldId, label, orderIndex, kind:"DYNAMIC",
  native:false, dynamic:true}` → `""`; the server fills `alreadySelectedIds`, the `*DelFieldIds` are loose client
  bookkeeping. Read back: `load-calendar-view-settings` → `template.cardTemplate`.
- **Where the card shows** `[C]`: the registry calendar (view chooser → «Календарь», period link Месяц / Неделя / День)
  shows it on mouse-over of every event in the MONTH view; in the WEEK view only a timed event (`FULL_DATE`, in the hour
  grid) gets it, an all-day `DATE` event in the top strip has none. The card lists «label: value» per field.

**Map.** The registry «Карта» is a Leaflet map of the BO's `GEO_POINT` values, one marker per record.
Points come from `v2/geo/load-bracket-boi-points` (body = the registry bracket filter `{boId, dynamicFilters,
nativeFilters, brackets, search, paging:{offset, limit, hasNext}, ordering, state}`) → `[{boiId, coordinate:{lat, lon},
fields:[{label, displayValue, …}]}]` — **and the `fields` of a point are the KANBAN card template's fields**. So:
- **A BO with a `DROPDOWN_SINGLE` that has no kanban card template cannot show its map** `[C]`: as soon as it holds a
  record, `load-bracket-boi-points` answers NullPointerException «cardTemplate is null» and the map stays empty;
  the kanban view and the constructor's kanban editor die with the same error. A BO built in the constructor gets
  the template on its own; an ARCHIVE BO gets it only from `kanbanCardTemplates` (`MYBPM-IMPORTS.md` 0.5c), and
  an archive BO with a dropdown imported without one is broken this way (trap 61).
- **Two repairs, both keep the records** `[C]`: `v2/kanban/save-kanban-card-template` P `{boId, fieldId:<dropdown>}`
  with a header field (§7), or a re-import with `kanbanCardTemplates` for that dropdown — the map, the kanban view and
  the editor come back.
- A BO with a GEO_POINT and no dropdown at all needs no template `[C]`: its point carries EVERY form field,
  and the map opened from a menu item with `isMapEnabled` shows the marker.

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
- **The editor** `[C]`: without a `SINGLE`/`MULTIPLE` BO field it shows only a text that there is no such attribute.
  Left: the toggle (at once); when on, its label becomes a link «Включить группировку :» → a level picker (only
  `SINGLE`/`MULTIPLE` BO fields): a tick writes `groupingInfo {nodeTreeLevel:0, nodeTreeActive:true}` AT ONCE and
  asks `v2/boi-grouping/load-business-object-grouping-next-candidate` P `{groupingBo:<boId>, currentBoId:<referenced
  BO>}` for the next level's candidates; an untick writes `{nodeTreeActive:false, nodeTreeLevel:null}`. Right: the
  columns header `+` → picker of every field but `TAB_GROUP`; a tick writes `{colToShow:true, colOrderIndex:<n>}`, the
  hover trash `{colToShow:false}` — AT ONCE, the remaining columns are NOT re-indexed.

**Timeline («Диаграмма Ганта»).** One columns table per `PERIOD` / `PERIOD_TIME` field; a BO without one has no
timeline. Templates: `v2/timeline/load-templates {boId}` → `[{boId, label, timelineFieldId, columns:[{fieldId, label,
orderIndex}]}]` (Mongo and archive key `timelineTemplates`, `MYBPM-IMPORTS.md` §2). Constructor view chooser → «Диаграмма Ганта»
(`…/editing/<boId>/timeline-editing`), every action AT ONCE `[C]`:
- `+` → picker (every field but `TAB_GROUP`): a tick = `v2/timeline/save-columns` P `{boId, timelineFieldId}` B
  `[only the new column {fieldId, label, orderIndex:<last+1>}]` (append) + `save-table-locations-for-timelines` P
  `{boId}` B `[{fieldId, archetype, gantTableLocations:[{timelineFieldId, colOrderIndex, colToShow:true}]}]`.
- Hover a header cell → only a trash (no sort): `remove-column` P `{boId, timelineFieldId, fieldId}` + table-locations;
  an untick in the picker does the same. **The LAST column can be removed** (unlike the registry columns).
- Drag a header cell = `save-columns` with ALL columns in the new order. The fields' own `gantTableLocations` keep
  stale indexes then — `timelineTemplates` holds the order. No column resize.
- **The card «СОХРАНИТЬ» fills empty lists on the CLIENT**: it adds the top field (by `y`, then `x`; not `TAB_GROUP` /
  `PROGRESS_BAR`) to every timeline with no column (`v2/timeline/save-column-for-timelines` P `{boId,
  timelineFieldIds}` B `{fieldId, label, orderIndex:0}`); the same client step makes the first 3 fields registry
  columns when the BO has none (`save-business-form-field`) `[I]`. A portion save over the API does neither.
- Registry: the view chooser lists «Диаграмма Ганта по полю <label>» per `PERIOD` field →
  `…/viewing-list/bo/<boId>/timeline-view?fieldId=<periodFieldId>…` (without `fieldId` the page is blank); left table
  = the template columns in their order, right = bars «dd.mm.yyyy – dd.mm.yyyy», link «Масштаб». A licence banner of
  the Gantt library sits at the bottom (trap 56).

### 5m. The BO's sidebar row — «Дублировать», «Переименовать», order, «Добавить в группу», the create-record iframe URL `[C]`

The left list of the constructor (`/business-objects/editing/<boId>`) shows the BOs by group; the row's ⋮ menu has
«Права доступа» (menu rights, known), «Переименовать», «Добавить в группу», «Дублировать», «Экспортировать»,
«Удалить». All calls below are `v2/business-objects/…` and answer `""` unless said otherwise. Read the list with
`load-business-object-groups {forEdit: true}` (PARAMS) → `[{id, name, code, orderIndex, kind, records: [{id, name,
orderIndex, boCategory}]}]`, records sorted by `orderIndex`. Format side: `MYBPM-IMPORTS.md` §2 «BO place in the
sidebar».

**The list search finds BOs by NAME only** `[C]`: «Поиск» above the groups filters on the client (no call) and
collapses the groups — open a group to see what matched. A BO code finds nothing there; code → BO is
`load-bo-id-by-code {boCode}` (or the code line of each BO's header gear, §5j).

**«Дублировать» = `clone-business-object {boId}`** (PARAMS) → `{id, name, orderIndex, boCategory}` of the new BO; the UI
asks nothing and jumps to the clone's editor (its header still shows the source's name until a reload). What the clone
gets:
- name `Копия_<name>_<N>` and code `<code>_<N>`, where N is a company-wide clone counter (one per clone,
  deleted ones included). **The other languages come out as `Copy_null_<N>` / `Көшірме_null_<N>` / `Köşırme_null_<N>`**
  when the source has no text in them — rename the clone in every language you show.
- the same group and the same `orderIndex` as the source;
- every field with the **same field ids and codes** (a field id is unique only inside its BO), the card layout, the
  registry columns, `boTabs`, the messenger link fields, `instanceViewType`, the header flags, the calendar/map/grouping
  flags, `groupingInfo`, the kanban card template, record rights and the menu-rights record;
- **the scripts, all versions** (work and test) as NEW script modules whose `scriptId`s repeat the source's — the
  definitions are stored per (module, scriptId), so editing the clone's script leaves the source alone; the hooks fire on the clone's records;
- NOT copied: the records, the calendar event titles (the clone gets a default), the create-record iframe token, menu
  items;
- **a business process clone loses its work version**: both versions and both diagrams copy byte for byte, but the old
  work version comes back with `isWork: false` (the test one stays test) — publish one before the process can run.
A record saved into a clone through §6a is an ordinary record of the clone.

**«Переименовать» = `save-bo-record`** BODY `{id, name}` — and on this build it writes **`recordName` only**: `name`,
`nameMap`, the sidebar row and the header keep the old name, also after a reload and a 10-s wait (UI and API alike). The working rename is the header «Наименование» input (§5j), which writes `name` and
`recordName` together. Trap 63.

**Order inside a group = `save-bo-record`** BODY `{id, orderIndex}`. Dragging a row sends it with the midpoint of the
two neighbours' `orderIndex`. **Every archive-created BO carries the template's `orderIndex` 47480000**, so two archive
BOs side by side have the same value, the dragged row gets that value too and after a reload it falls back to the end
of the block of equal values — the drag is lost. Give such BOs distinct values
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
BO's current name. **While a messenger is not connected** (`load-messenger-bo-settings` → `isConnected: false`; the
«Подключение» tab asks for the phone, App id and App Hash id) its «Использование» tab is disabled `[C]` — the checkbox
and «Выбор бизнес-объекта» do not react; only the API above writes `boAllow` then.

**Physical removal** — one entry per BO: `{record:{id,name}, daysAfterCreation, daysAfterCreationEnabled,
afterChangeFields:[{id, fieldId, fieldLabel, newValue, newDisplayValue}]}`. The page warns «Внимание, актуальные
записи будут удалены безвозвратно!»: live records are deleted for good «Спустя N дней с момента создания» (when
enabled) and/or «При изменении значения поля <F> на <V>». Only `DROPDOWN_SINGLE` fields are offered
(`v2/business-objects/load-bo-field-records P {boId}` filtered by type; options from `load-bo-field-options P {boId,
fieldId}`); `newValue` is the option id, the condition `id` is any 10-char client id. The UI lists only `GENERAL` BOs
that are not panels. A rule saved by API shows in the UI unchanged. **The removal is NOT immediate** `[C]`: records matching a rule (even «Спустя 0 дней») stay live for at least ~25 minutes after the save; the purge runs on a server schedule whose period is unknown `[U]` — do not test a rule on records you need, and expect no visible effect right after saving.

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
asks the server to create its own registry BO `[U]`. The UI's picker lists only
`messenger/settings/load-chat-registry-business-objects`, so an ordinary BO can be made the
registry only through the API. A re-import of the registry BO puts the archive's name back; the registry pointer
stays. Trap 66.

**Not per BO, despite the inventory names** `[C]`: «Мобильное приложение»
(`v2/company/all-mobile-settings` / `save-mobile-settings`) — all seven lists, `importBoAllow` included, are ORG-UNIT
lists (who may take screenshots, copy, import, download…), not BO lists.

**Unverified** `[U]`: «Телефония» (`v2/telephony/settings/load-telephony-bo-settings P {type}` — `callOpenBoRecord`, the BO
a call opens, plus field lists) and «IN/OUT Миграция» (`kafka_migration/settings/load-{in,out}-migration-settings`,
allowed BOs) need a configured telephony provider / Kafka; without a provider `all-telephony-settings`
answers NPE «Провайдер телефонии отсутствует».

**«No archive carries them» holds for the BO's OWN export only.** The export screen has a
third basket, company settings (`struct/load-settings-export-kinds` → 14 kinds: `LANGUAGES, MOBILE,
PHYSICAL_REMOVAL, TELEPHONY, OFFLINE, IN_MIGRATION, OUT_MIGRATION, MESSENGER, OTP, NAVIGATOR, AUDIT_TRAIL,
MIGRATION_MONITORING, SCRIPT_SETTINGS, APPEARANCE`), and a ticked kind exports as a `CompanySettingsStructDto` line
(`SCRIPT_SETTINGS`: §5o). The line's payload has the keys `boiDeleteSettings`, `messengerTypes`,
`messengerCompanySettings`, `offlineViewBoAllowCodes`, `offlineEditBoAllowCodes` (BOs by CODE); what each kind
does on import is the next paragraph — **the messenger lists do NOT travel.**

**Every kind of the settings basket, imported back** `[C]`: per kind, what the line carries
and whether an import replaces, merges or ignores — the table in `MYBPM-IMPORTS.md` §2 «The other company-settings
kinds». In short: OFFLINE, MOBILE, LANGUAGES and SCRIPT_SETTINGS **replace**; PHYSICAL_REMOVAL **upserts by BO code and
never removes**; OTP recreates its row but loses the department; AUDIT_TRAIL overwrites the **first** audit row only;
MIGRATION_MONITORING sets the monitor by code; NAVIGATOR does not export the Google key; MESSENGER exports only the on/off
map and its import did nothing. The import of an archive is the §5 cycle; a settings-only archive with one kind takes
~10–20 s, so drive it fire-and-forget from the page (§10, the in-page call time limit).

The pages behind the other kinds (saves answer `""`):

| page | load | save |
|---|---|---|
| «Поддержка языков» | `v2/company/all-languages` → `[{language, code, orderIndex, isDefault, isActive, displayName, shortName}]`; `default-language` → `"ENG"`; `system-languages` = the active ones | `v2/company/language-add` B = the WHOLE list in that shape (the UI sends every language, `isActive` per row); `language-remove P {language}` |
| «Мобильное приложение» | `v2/company/all-mobile-settings` → seven org-unit lists | `v2/company/save-mobile-settings` B deltas `add<List>` / `del<List>` for `ScreenshotAllow, CopyAllow, ImportBoAllow, DownloadFileAllow, DownloadPrintFormAllow, DownloadReportAllow, MobileAllow`; add items `{orgUnitId:{id,type}, displayName}`, del items `{id, type}` |
| «OTP-аутентификация» | `v2/company/get-otp-settings` → `{id, department, personGroups, isActive, createInCurrentCompany, …}` (`id` null = no row) | `v2/company/save-otp-settings` B `{id, isActive, createInCurrentCompany, departmentId, personGroupsToAdd:[{id,name}], personGroupsToDel:[…]}`; **`isActive:false` deletes the row** |
| «Навигатор» | `geo-map/settings/load-geo-map-company-fields P {geoMapType:"GOOGLE_MAP"}` (field `api_key`), `load-geo-map-company-field-values P {geoMapType}` → `[{code, value}]` | `save-geo-map-company-field-values P {geoMapType} B [{code:"api_key", value}]` (`value:null` clears; on the favicon page the save answers a websocket «No session» error AFTER storing) |
| «Аудиторский след» | `aud-boi-settings/load-table-records` → rows `{id, historyBoRecord, audBoList, latestHistoryPeriodDays}`; `load-fields` (11 slots); `load-field-values P {recordId}` → `[{code, value:<field id>}]` | `save-aud-settings` B `{id, historyBoId, audBoIdList, latestHistoryPeriodDays}` (the row's own shape → NPE «audBoIdList is null»); `save-field-values P {recordId} B [{code, value}]`; `create-table-record`, `remove-table-record P {recordId}`. The BO list behaves as a set (order not kept) |
| «Мониторинг миграции» | `pg-migration-settings/load-settings` → `{monitorBoRecord}`; `load-fields` (9 slots); `load-field-values` | `save-settings` B `{monitorBoId}` — **cannot be unset** (`null` ignored, `""` → `IllegalId`, no key → NPE); `save-field-values` B `[{code, value:<field id or "">}]` |

Offline shapes: `nestedLevel` is the enum `NONE` / `FIRST` (a number → 400 «Failed to read request»); the add
deltas take `{boRecord:{id,name}, displayName}` for BOs and `{orgUnitId:{id,type}, displayName}` for org units, the
delete deltas `{id, name}` / `{id, type}`. Messenger `userAllow` / `delUserAllow` take org-unit records
`{id, type, name}`. Org units for any of these: `v2/business-objects/load-org-unit-record-list P {filter:{searchText,
types:["DEPARTMENT"|"GROUP"|"PERSON"]}, skipFirstCount:0}`.

### 5o. «Выставление сервисов» — a BO as a public HTTP endpoint `[C]`

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
  (`Thu, 01 Oct 2026 10:00:00 GMT` → stored `2026-10-01T10:00:00.000Z`); ISO with/without
  zone, epoch millis, `2026-10-01`, `01.10.2026`, `01.10.2026 10:00` are all refused. **Non-ASCII header values arrive as mojibake**
  (UTF-8 bytes read as Latin-1) — keep headers ASCII. Two headers may target one field.
- **Query parameters fill fields BY FIELD CODE** (`?Zagolovok_tekst=abc` → that field); a parameter with no
  such code goes to REQUEST_ERRORS («Пришёл параметр, но у бизнес-объекта нету поля с таким кодом»). A slot
  beats a parameter. JSON body keys are NOT spread into fields.
- **The body must be empty or a JSON OBJECT** — the platform's request filter (`RequestWrapper`) parses every body
  as a JSON map before the service sees it: `text/plain`, form-urlencoded, XML, a JSON string or a JSON array all
  answer 500 `JsonParseException` / «Cannot deserialize … LinkedHashMap», and NO record is created. A JSON object
  arrives verbatim (UTF-8 intact) in INPUT_TXT.
- **TEST mode runs the BO's TEST script version** (no TEST version → none runs); its records are ORDINARY records
  (`state` ALL, the «Тестовые»/DEV registry stays empty) with MODE = `TEST`.
- Scripts: only «Создание» runs (no form is opened); it reads the request fields and writes the result fields
  with ordinary `BlockAssign`s (`MYBPM-IMPORTS.md` §0S.7). Without any script the answer is 501.
- **File answer** `[C]` (`RESULT_FILE` mapped to a single-mode FILE_UPLOAD): the «Создание» script makes a file and assigns it to the field's
  `#Значение` — `<text>.#Записать в файл(fileName)` (`F-writeToFile-K-FIX-T-String`, the text as UTF-8) or
  `<base64>.#Base64 преобразовать в файл(fileName)` (`F-textToFile-K-FIX-T-String`, binary, byte-exact). The answer is then the file: status = RESULT_CODE, **body = the file bytes (RESULT_TXT is
  ignored)**, `Content-Disposition: attachment; filename="<name>"` (a non-ASCII name is percent-encoded UTF-8
  inside plain `filename=`, no `filename*=`), and **Content-Type comes from the file name's extension, NOT from
  RESULT_CONTENT_TYPE** (`.txt` → `text/plain;charset=UTF-8`, `.png` → `image/png;charset=UTF-8`, `.json` →
  `application/json;charset=UTF-8` whatever the slot holds). **The name must carry an extension the file
  storage knows**: `dannye.xyz` and a bare `otchet` both fail inside the script with
  `kz.greetgo.file_storage.errors.NoFileMimeType: No MIME type` (written to SCRIPT_ERRORS; the assignments before
  it, RESULT_CODE included, are kept), the field stays empty and the call answers 500 «has no any file». The file
  also stays in the record. Trap 69.
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

Saves answer `""`; **loaders lag a few seconds** — right after the save a read still returns the old value; wait ~2 s before reading it back.

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
headers are then dead (the service runs and answers 200 with an EMPTY body). Repair after a rollback: re-send
`save-field-values` + `save-header-values` with ids for every row. Trap 67.

**Script versions trap — right after a BO is created its first, implicit script version cannot see any BO**
`[C]`: on a constructor-made BO, `load-bo-script-versions` returns one version (`isTest:true`);
wire and fill a hook there in the first seconds and `translate-script` reports `exprAct__noDefinitionForActId` for every
`F-VALUE-K-DYN-R-D-S-boi_fields` hop (the field hop's type is NULL), and the TEST service URL fails with
«Ошибка компиляции скрипта на создание инстанции для режима ТЕСТ». `v2/script/load-bo-def-list
{scriptModuleId}` is the tell: `list: []` for that module, every BO of the company for any other; while it is
empty `in-work-bo-script-version` refuses it (`script_on_instance_creation_cause`). **Fix: wait** — within seconds
the list fills and the same version translates and publishes `[C]`; re-run `translate-script` on what was
written meanwhile. If it stays empty: `copy-bo-script-version P {boId, boScriptsId}` and work in the copy `[I]`. Trap 68.

**Trap 68a — a local method is BO-wide, not per version** `[C]`: every script version lists it, and
`delete-local-method` on one version comes back within seconds while another version still has it; delete it
from each version (§5g «Local methods without the IDE»).

**Trap 68b — an emptied hook body blocks the save** `[C]`: a hook written once and then cleared to
`{blocks:{}}` fails every form save (`script_after_save_error`, nothing stored); a hook cannot be unwired, so
neutralise it with the body «entry → `BlockExit FROM_METHOD`» (§5g «Wiring scripts onto a BO headlessly», step 4).

**A whole-stand outage can follow a TEST call** `[I]`: the first GET to `service_test` right after a new TEST
version is published may create its record (no result written) and then leave every URL of the stand, the API
included, answering nginx 502 for about a minute. Space TEST-mode experiments out and watch `load-auth-info`
between calls.

## 6. Records: Excel import and export

Records (instances) are imported as **Excel files into a BO registry** (registry kebab → импорт/экспорт
xlsx), never through the structure archive.

### Import and export through the API — controller `v2/bo-transfer` `[C]`

The registry kebab's «импорт/экспорт xlsx» is an ordinary controller, and it is **two-phase like the
structure import**: the upload builds an "act" you can read, and a second call applies it. The exact bodies are §0U R7.

| # | call | params | note |
|---|---|---|---|
| 0 | `load-bo-import-details` | `{businessObjectId}` | what the importer expects of this BO |
| 1 | `download-template` | `{businessObjectId, selectedFieldIds}` | a plain **GET** with query params, no envelope → the xlsx; ONE `selectedFieldIds=` per field (a comma list → `NullPointerException … colHeader is null`) `[C]` |
| 2 | `import-from-file` | multipart: file under **`file`**, plus the form field `businessObjectId` | → a bare `"<actId>"` |
| 3 | `is-import-file-finished` | `{actId}` | poll |
| 4 | `load-import-file` | `{actId}` | the act `{importId, total, newRecords, updatedRecords, errorRecords, fileError}` — **nothing written yet**; a blank cell shows up only as «updated» |
|   | `load-bo-import-table` | **B** `{importId, paging:{offset:0,limit:10}}` (params → NPE «strId is marked non-null») | the act's rows `{heads, records:[{hasError, errorText, values}]}` — the per-row error text, before apply `[C]` |
| 5 | `apply-imported` | `{importId}` | **writes** |
|   | `cancel-imported` / `imported-ok` | `{importId}` | drop / close |
|   | `watch-import-finished` | `{importId}` | poll the apply |
| 6 | `download-errors` | GET `?importId=` with the `token` header (POST → 405) | the «Ошибки при загрузке …» xlsx — after an apply it comes back with the header only, no rows, even when the act had an error row `[C]`; read `load-bo-import-table` instead |

Export: `export-bo` (raw body, params `boInstanceIds`, `boFieldIds`; `[U]`) and `export-bracket-bo`
(`{…filter…, boInstanceIds, boFieldIds, needBoiId}` in the BODY, `[C]`) → an `exportId`; then `is-bo-export-file-ready
{exportId}` and `load-bo-export-file {exportId}` → the bytes. `needBoiId: true` adds the column
«Внутренний айди» (each record's id), which a re-import IGNORES — only the unique field makes it idempotent (R7 step 6) `[C]`. `boFieldIds` picks the columns in its order; an empty list exports every field but `TAB_GROUP`, `STATIC_TEXT` and `tableColToShow:false` fields included `[C]` — **but with every nested block's cells blank** (no child codes, no repeated TABLE rows) `[C]`, so list the field ids whenever the file must carry links.

**What an update file does to the fields it carries** `[C]`: **A blank cell CLEARS the field** on an existing record (text, number, checkbox, dropdown, textarea —
`DATE` excepted — no cell value clears a date: blank or spaces keep it, `-`/`null`/`0` fail the row, so empty a date with §6a `value: null`), whether the cell is empty or absent from the row, and the act still says «обновлено»
with 0 errors; **a column missing from the file KEEPS the field**. To update a few fields, ship only
those columns plus the key. A date cell is parsed leniently — `31.02.2026` → 03.03.2026, `00.00.0000` →
30.11.0002, `1.1.26` → year 0026, no error `[C]`. After removing columns re-letter the cells contiguously — a header with
skipped letters misread the next column `[C]` (`MYBPM-IMPORTS.md` §19.6).

### 6a. Creating a record WITHOUT the UI — the draft cycle `[C]`

Controller **`v2/business-object-instance`** (the client's
own `v1/...` prefix is a 404 on the live stand — the same trap as `ensure-index`), four calls:

| # | call | params | body |
|---|---|---|---|
| 1 | `create-draft` | `{}` | `{}` → a bare `"<draftId>"` string |
| 2 | `v2/create-boi` | `{draftId, boId}` | `{}` → a bare `"<boiId>"` string |
| 3 | `v2/save-boi-value` | `{}` | the DTO below → `[]` |
| 4 | `apply-and-remove-draft` | `{draftId, boProcessId:null, isAutoSave:false}` | `{}` → empty 200 |

The value DTO (the client's class `M`, built by `M.of(draftId, boId, boiId, isDev)` +
`addValue(fieldId, value, saveType)`):

```json
{"draftId":…, "boId":…, "boInstanceId":…, "newIsDev":false, "setNewIsDev":false,
 "values":[{"fieldId":…, "value":"…", "saveType":null}]}
```

- **Editing an EXISTING record** the same way `[C]`: `create-draft` → `v2/save-boi-value` with the record's own id as
  `boInstanceId` (no `create-boi`) → `apply-and-remove-draft`. A `BO` value is `["<boiId>", …]`, a `CO` value
  `["<source BO id>-<boiId>", …]` (§6b table); both stored this way, and no script runs. **Not for
  removing from an M:N field** (two `TABLE` fields linked to each other): the removed record's whole back
  field is emptied, its other links included (§5h «Reference fields») `[C]`.
- **Reading an existing record** without a hook `[C]`: a bare `create-draft` (step 1), then
  `v2/instance-field-form/load-field-data` P `{boId, boiId, draftId}` → every field's `storedValue` of the
  record, `BO` and `CO` ids included (`"[\"<boiId>\", …]"`), which `v2/load-boi-values` answers `""`;
  `remove-draft` P `{draftId}` → `null` drops it (a later read of it: `NoBoInstanceDraftWithId`). No script runs
  — unlike the form cycle's «open EXISTING», which fires «Открытие». A `DATE` read this way may differ by hours
  from the same record's `load-boi-values` value `[I]` — compare dates by `load-boi-values`.
- **A `DATE` value** is the ISO instant as a JSON string (`value: "\"2026-09-30T22:00:00.000Z\""`), and
  **`value: null` or `""` clears it** `[C]` — the only way to empty a date without the card, since no xlsx cell does
  (`MYBPM-IMPORTS.md` §19.6).
- `addValueId(fieldId, valueId)` is the client's reference/dropdown variant: `value:""` plus `valueId`.
  **It does NOT store a `DROPDOWN_SINGLE`**: the call answers `[]` and the record's dropdown stays empty
  `[C]`. Set a dropdown through the form cycle instead (§6b `save-field-value` with the bare option id as
  `value`) `[C]`; whether `save-boi-value` takes the bare option id in `value` is `[U]`.
- Related in the same controller: `copy-bo-instance {boId,boiId}`, `delete-bo-instance
  {businessObjectId, boInstanceIds}`, `archive-bo-instance`, `restore-bo-instance`,
  `is-field-value-unique {boId,boiId,fieldId,value}`, `load-boi-id-by-unique-field
  {boId,fieldCode,fieldValue}` (body, not params; both
  `v2/business-object-instance/load-boi-id-by-unique-field` and `…/v2/load-boi-id-by-unique-field` answer 404 —
  find a record by its code with `load-bo-instance-bracket-table` instead, whose `records[].values[]` carry
  `fieldCode`, `value` and `displayValue` `[C]`), `v2/load-boi-values`.
- The *form* controllers are a different family:
  `v2/instance-form-create-draft/create-draft` demands a `boiId` (it is the EDIT draft),
  `…/create-draft-with-boi` wants a real minted `draftId` and a `BoiState`
  (`ALL|ARCHIVED|REMOVED|OFFLINE|DEV`), and `v2/instance-form/validate-apply-remove-draft` is its apply.
  Use the four calls above instead **when you want NO scripts to run** — see §6b.
  **Neither cycle can save a BO that has a CAPTCHA widget**: both answer `CaptchaNotVerified` (§5i «The
  CAPTCHA widget») `[C]`.
  They also skip the field RULES the form cycle enforces — `textCase`, `maxLength` (§5h «Поведение») — and
  hand out no counter number `[C]`.

### 6b. The FORM cycle — the one that runs the BO's scripts `[C]`

**The §6a cycle runs no Block IDE script at all, and neither does an xlsx import (R7) of a new record** `[C]`. The hooks run inside
the FORM controllers, which is what the UI's own dialog calls. Every hook runs server-side; the answers carry the script's field writes back as
`fieldFormCommands[{commandType:"UPDATE_STORED_VALUE_FIELD", fieldId, storedValue}]`.

| step | call | params / body | hooks that run |
|---|---|---|---|
| open NEW | `v2/instance-form-create-draft/create-draft-with-boi` | P `{boId, boiState:"ALL", isReadMode:false}` B `{}` → `{draftId, boiId}` | «Открытие» |
| open EXISTING | `v2/instance-form-create-draft/create-draft` | P `{boId, boiId, draftId:null}` B `{}` → bare `"<draftId>"` | «Открытие» |
| change a field | `v2/instance-field-form/save-field-value` | B `{draftId, boId, boInstanceId, values:[{fieldId, value}]}` | «Изменение поля» of that field |
| save | `v2/instance-form/validate-apply-remove-draft` | P `{draftId}` → `formCommands:[CLOSE_DIALOG_SAVE]`; **no `CLOSE_DIALOG_SAVE` = NOT saved** — e.g. an empty required field answered only `[CAN_ENABLE_CANCEL_BUTTON]`, no error command, record unchanged `[C]` | NEW: «Добавление новой записи» then «Сохранение»; EXISTING: «Сохранение» only |
| close without saving | `v2/instance-form/remove-draft` | P `{draftId}` → `formCommands:[CLOSE_DIALOG_CANCEL]` | EXISTING: «Закрытие»; NEW: nothing is created. **A NEW record is cancelled with `v2/business-object-instance/v2/delete-boi` P `{draftId, boiId}` FIRST, then `remove-draft`** — what the UI sends `[C]`; a bare `remove-draft` of a new draft on a BO with a «Закрытие» script answers `RuntimeException … No boi with id` and the draft stays readable (the pair afterwards removes it). A «Закрытие» hook wired by an archive but with no body adds `SHOW_NOTIFICATION` ERROR «Скрипт на закрытие не отработал.» even on a NEW record `[C]` — harmless, the draft is gone |
| read the draft | `v2/instance-field-form/load-field-data` | P `{boId, boiId, draftId}` → `[{fieldId, storedValue, …}]` | — |
| read the record | `v2/business-object-instance/v2/load-boi-values` | **B** `{businessObjectId, boInstanceId, draftId:null, tabId:null}` (in P it answers `NoBoWithId … boId = <NULL>`). **`tabId:null` returns only the fields OUTSIDE tabs**; the fields of a `TAB_GROUP` tab come back only with that tab's id in `tabId` `[C]` | — |

Order on a new record: открытие → поле … → создание → сохранение. Field ids and codes:
`v2/instance-form/load-field-structure` P `{boId, boiId, draftId}`. The full semantics (what is kept, what is
discarded) is `MYBPM-IMPORTS.md` §15 «When each hook runs»; the facts that bite:

- **«Закрытие» does not run after a save** — only on `remove-draft` of an existing record — and what it
  writes is **stored in the record**, while every edit of the discarded draft (the «Открытие» write of
  that same session included) is thrown away.
- **«Изменение поля» runs on EVERY `save-field-value` call** — the same value again, and a value the
  server then refuses to store, both fired it.
- `boiState:"DEV"` opens a TEST record: those run the BO's TEST script version, ordinary ones the WORK
  version (§5g «Wiring scripts onto a BO headlessly»).
- **A script vetoes a save with a field error** `[C]`: `поле.#Добавить ошибку(<мультиязычный текст>)` in a hook
  makes the answer carry `fieldFormCommands` `SHOW_FIELD_ERROR` (`fieldId`, `errorMessage`), `formCommands`
  `ALERT_SAVE_BUTTON_NOTIFICATION` and `notValid:true`; `validate-apply-remove-draft` then answers no
  `CLOSE_DIALOG_SAVE` until a script runs `#Удалить ошибку`. Meta assigns from a script (`#Только для чтения`,
  `#Обязателен`, `#Видимость`) arrive as `fieldFormCommandsSometimes` `READONLY` / `REQUIRED` / `HIDE_FIELD` with
  `commandB` — client-side only: `save-field-value` into a script-read-only field is still stored
  (`MYBPM-IMPORTS.md` §12a «Meta assign and field errors at run time»). The acts, all on the FIELD reference
  (hop 1): `F-Readonly-K-DYN-R-M-S-boi_fields` / `F-Required-K-DYN-R-M-S-boi_fields` /
  `F-Shown-K-DYN-R-M-S-boi_fields` (assignable Bool), `F-addError-K-FIX-T-BoiFieldRefCode` (arg
  `scriptMultiLangText`) and `F-removeError-K-FIX-T-BoiFieldRefCode`. The error text is a built-in object:
  `Пусть #текст ошибки# = Создать мультиязычный текст` (`JavaObjectFactories`
  `BEAN_METHOD-ScriptMultiLangTextFactory-newMultiLangText`), then `#текст ошибки#.Добавить(text, RUS)`
  (`F-addText-K-FIX-T-ScriptMultiLangText`, args `text`, `lang` = Enum `MybpmLang` `RUS`); both statements and
  `#Добавить ошибку` itself are `BlockAssign`s with no `rightExprId` (§5g «The script language»).
- `OPEN_COUNT` stayed `0` on a record opened only through these calls (the UI's records counted up) `[I]`.

**The `value` of `save-field-value`, per type** — what the client's field classes send; `[C]` = stored and read back:

| type | `value` | |
|---|---|---|
| `INPUT_TEXT` `INPUT_PHONE` `INPUT_EMAIL` `TEXTAREA` `LINK` | the plain string (`TEXTAREA` = its HTML — any HTML fragment may be sent instead of plain text, §8) | `[C]` |
| `INPUT_NUMBER` | `"42"` | `[C]` |
| `CHECKBOX` | `"true"` / `"false"` | `[C]` |
| `DATE` `FULL_DATE` `TIME` `YEAR` `YEAR_AND_MONTH` | `JSON.stringify(<Date>)` = an ISO instant INSIDE quotes: `"\"2026-09-24T10:30:00.000Z\""` | `[C]` |
| `PERIOD` `PERIOD_TIME` | `{"startDate":"<ISO>","endDate":"<ISO>"}`; `PERIOD_TIME` reads back with both ends as epoch milliseconds | `[C]` |
| `DROPDOWN_SINGLE` `RADIO_BUTTON_GROUP` | the option id, bare. A dictionary dropdown (`optionSource:"FROM_BO"`): send the dictionary record's CODE — it is stored as that record's id and the card shows it; the bare record id is stored too, but the card shows the field empty | `[C]` |
| `BO` | a JSON array of record ids `["<boiId>"]` | `[C]` |
| `CO` | a JSON array of `"<source BO id>-<boiId>"` — rows of DIFFERENT sources in one array, the whole set in one call, no `saveType` needed (bare ids → `IllegalStoredValue … Value_CO`); the UI adds one row with `saveType:"ADD"`. **`load-boi-values` answers `value:""` for a `CO` field even when it holds rows** — read it back from `load-field-data` of an existing-record draft, then `remove-draft` | `[C]` fires the script |
| `QUESTIONNAIRE` | `[{"rowId":"…","columnId":"…"}]` | `[C]` |
| `GEO_POINT` | `{"lat":43.238,"lon":76.945}` | `[C]` |
| `INPUT_TEXT_LANG` `TEXTAREA_LANG` `STATIC_TEXT` | `{"RUS":"…"}` (stored with all four languages; for `TEXTAREA_LANG` / `STATIC_TEXT` each language may be HTML, §8) | `[C]` |
| `TAB_GROUP` | `""` | `[C]` fires the script |
| `FILE_UPLOAD` | a JSON array of file ids `["<fileId>"]`; the UI first uploads with `POST /web/v2/file/upload?draftId=…&boId=…&boiId=…&fieldId=…` (multipart `file`, `token` header → the 24-hex fileId as a JSON string), then `file-meta-info-list` `B {fileIds}`; an upload without the query parameters works the same | `[C]` fires the script |
| `CHECKLIST` | the whole item list as JSON text: `[{"label":"Пункт 1","checked":true},…]` (also on a field whose constructor list is empty) | `[C]` fires the script |
| `PROGRESS_BAR` | a MAP `{"<step code>":"GREEN"}` (`RED GREEN YELLOW BLUE ORANGE PURPLE`); it reads back as `[{stepCode, color}]`, and THAT array, `["<stepId>"]` or `"[]"` sent as a value break the draft (trap 50) — §5h «Per-type settings»; the registry column shows a stored bar empty | `[C]` |

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

## 7. Kanban — columns, the card template (API, constructor, archive), the board `[C]`

A kanban is two independent pieces:

1. **Columns** — switched on where the board is shown; the one confirmed place is a MENU ITEM:
   `boPages.isKanbanEnabled`, `kanbanIndex`, `listIndex`, `kanbanFieldId` (§4).
   **The BO's own registry needs no switch** `[C]`: opened from «Бизнес-объекты» it offers «Канбан по полю:
   <label>» per `DROPDOWN_SINGLE` and renders the board at
   `/business-objects/viewing-list/bo/<boId>/kanban-view?fieldId=<dropdown fieldId>&boId=<boId>&menuItemId=<dropdown fieldId>&businessObjectId=<boId>`.
   A local-list dropdown (`FROM_FIELD`) qualifies exactly like a dictionary one (`FROM_BO`) `[C]`:
   `v2/kanban/load-kanban-fields {boId}` lists both and the board shows the local options as columns.
   A reference field (`BO` / `CO`) and a panel registry offer no kanban view in the constructor `[C]`
   (`MYBPM-IMPORTS.md` 0.5c).
2. **The card** — per BUSINESS OBJECT and dropdown: `kanbanCardTemplates` on the BO. **Adding a `DROPDOWN_SINGLE`
   in the constructor or over the API makes the SERVER write a default card** `[C]`: header = the first field,
   content = the other simple dynamic fields by `y` (not `TAB_GROUP`, `FULL_DATE`, `PERIOD` or the dropdown),
   footer = `PARTICIPANTS` (left out of the answer while that native is not on the form). **An imported BO gets
   none** — it carries `{}` unless the archive ships the template, so `BoDto.toKanbanCardTemplate` NPEs and the
   view shows «cardTemplate is null». Three writers, all `[C]`: `save-kanban-card-template` (below), the
   constructor's card editor (it sends that same call) and the archive (`MYBPM-IMPORTS.md` §0.5c, keyed by the
   dropdown's CODE, the card fields by CODE with `locationType` + `archetype`). The API call and the archive also
   repair a BO broken so, records kept; the constructor's editor dies on such a BO with the same error (trap 61).

**Over the API** `[C]`: `v2/kanban/save-kanban-card-template` P `{boId, fieldId:<dropdown fieldId>}` B `{header,
content, footer, headerDelFieldIds, contentDelFieldIds, footerDelFieldIds}` → `""`. Items are the runtime shape
below, at least `{kanbanFieldId:"D-<fieldId>"|"N-<NATIVE_TYPE>", cardOrderIndex, fieldKind, type}`; the
`*DelFieldIds` hold such ids. It is a PARTIAL update: every listed item is set (zone + order), every id of the
`*DelFieldIds` that is not on the new card is removed, a field in neither stays. It creates the dropdown's entry
when there is none — the repair of «cardTemplate is null». An EMPTY body returns 200 and does nothing. Read back
with `load-kanban-template`.

**In the constructor** `[C]`: view chooser → «Канбан» (`…/editing/<boId>/kanban-editing`, «Канбан для выпадающего
списка с названием - <label>»): one column per option, the first one shows a SAMPLE card with a gear. Gear → dialog:
left = search + «Динамические поля» (the fields NOT on the card) + «Системные поля» (natives on the form), from
`load-kanban-card-fields {boId, fieldId}`; right = the card's header / content / footer. Drag a field into a zone,
between zones, inside one, or back onto the LEFT LIST to remove it (a drop on the empty space below the list does
nothing); the header holds ONE field (a second one pushes the first back). «СОХРАНИТЬ» / «ОТМЕНИТЬ» appear after the
first change; СОХРАНИТЬ = `save-kanban-card-template` with `cardOrderIndex` re-numbered 0.. per zone. Close = the
red ⊗.

**On the board** `[C]`: dragging a card into another column = `has-rights` P `{businessObjectId, boInstanceId,
type:"EDIT", boiPageType:"KANBAN"}`, then `v2/kanban/move-kanban-card` P `{boId, fieldId, optionId, instanceId}` B
`{}` → `""`, then `load-bracket-total-card-count` per column.

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
  added and the line re-imported — **this works** `[C]` (it repairs an archive BO whose kanban and
  map die with «cardTemplate is null», §5l); keep the `kanbanFields` wrapper — without it the import is APPLIED
  and changes nothing. A constructor-made BO's export already carries
  `kanbanCardTemplates.<dropdown code> = {kanbanFields:{}}` (empty); the one-BO re-import updates the BO in place —
  same id, records kept `[C]`. MCP connected → `kanban_card_save` does this.
- `save-business-object-portion` does not carry the key (a full-DTO re-save changes nothing).
- `v2/kanban/load-kanban-template` answers `{boId, label, kanbanFieldId, cardTemplate:{header, content, footer,
  *DelFieldIds}, hasRights, options:[{id, label, code, color, orderIndex, hiddenInKanban}]}` `[C]`; no card on the
  BO for that dropdown = empty `header` / `content` / `footer` arrays (or a null `cardTemplate`).
- Runtime shape of a template item (what the kanban endpoints return, ids not codes):
  `{type:"KanbanCardFieldDynamic"|"KanbanCardFieldNative", coKanbanFieldId:null,
  kanbanFieldId:"D-<fieldId>"|"N-<NATIVE_TYPE>", label, cardOrderIndex, fieldKind:"DYNAMIC"|"NATIVE",
  isNotExistInBo:false, dynamicFieldType|nativeFieldType}`.
- The rest of `v2/kanban/*` (params `{boId, fieldId}`): `load-kanban-fields {boId}` →
  the dropdowns usable as columns; `load-kanban-card-fields {boId, fieldId}`; `save-business-field-option` (B one
  option DTO — a column's colour, «Скрыть из списка», order; §5b «Option colour») `[C]`; `move-kanban-card` (above);
  `load-bracket-kanban-cards` (body `{boId, dynamicFilters, nativeFilters, brackets, search, paging,
  ordering, state, kanbanFieldOptionId, kanbanFieldId}`).

### How the registry and the kanban sort — the request `[C]`

- The registry (`v2/business-object-instance/load-bo-instance-bracket-table`) and the kanban
  (`load-bracket-kanban-cards`) run the same query. The client sends `paging` as **`{limit:20, offset:0}`**,
  not `{page,size}`, and `ordering` as **`{archetype:null, fieldId:null, state:"UNSET"}`**, not `null`; both
  shapes are accepted. «Загрузить ещё» pages on with `offset` 20, 40, 60….
- An explicit `ordering` sorts by that field: `{archetype:"NATIVE", fieldId:"CREATED_AT", state:"DESC"}`, or
  `{archetype:"DYNAMIC", fieldId:<field id>, state:"ASC"|"DESC"}` — exactly what a click on a column header sends.
  `NATIVE UPDATED_AT` is **not** a valid ordering field (`IllegalArgumentException: No enum constant …`).
- **The default sort follows the FIRST registry column** (`tableColOrderIndex` 0), not `sortFieldId` `[C]`; on a
  BO with a UNIQUE field the server picks the unique one `[I]`.
- `v2/business-objects/save-bo-table-sort` takes its arguments in the **PARAMS** half (`{boId, fieldId, order}`);
  sent in the body it answers 200 and writes nothing. With params it writes `sortFieldId` (read back from
  `load-business-object-by-id`); `fieldId: null` clears it, the constructor clears it with `order: "UNSET"` and no
  `fieldId` (its «Список» view: the sort icon of a column cycles ASC → DESC → off, §5b). The ORDER OF A NESTED TABLE does follow it (§5i).
- **The registry REMEMBERS the sort a header click chose** `[C]`: every later opening (navigation or F5) arrives
  sorted that way until another header is clicked. Whether it is per user or shared is not checked `[U]`.
- A BO with **no** registry column answers `AccessDenied` «У Вас недостаточно прав на поля, которые выведены
  в реестр» even though every field has `accessForAll: true` — not rights, an empty column set. Trap 48.

Two related traps `[C]`:

- **`delete-bo-instance` takes `boInstanceIds` in the PARAMS half.** Sent in the body
  (`params {businessObjectId}`, `body {boInstanceIds}`) it answers 200 and deletes nothing; with both in
  params it answers `true` and the rows disappear. Trap 46.
- **A field that is not a registry column is invisible in `load-bo-instance-bracket-table`** — the row
  `values[]` carry only the `tableColToShow` fields, so you cannot read back what you wrote into a plain
  field there. Flipping `tableColToShow: true` (a one-key `editedFields` patch) makes both the column and
  the full-text `search` find it `[I]`.

## 8. HTML fields and «Текст» sections — what the sanitizer accepts

**Which fields take HTML** `[C]`: «Текст» (`STATIC_TEXT`), «Текстовый блок»
(`TEXTAREA`) and «Мультиязычный текстовый блок» (`TEXTAREA_LANG`) — an HTML fragment can go into them
instead of plain text, whether typed in the card, saved through `save-field-value` (§6b), written by a
script or imported. «Текстовое поле» (`INPUT_TEXT`) and its multilingual twin are plain single-line inputs `[I]`.

**What the server keeps** `[C]` — in a `TEXTAREA` written by `save-field-value` and read back with
`load-field-data`, and in `staticValueMap` of a `STATIC_TEXT` saved through
`save-business-object-portion`. The server re-serialises the HTML (pretty-printed, `\n` + indent around
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
A button script that writes
`<iframe src="https://<external host>/?a=<lat,lon>&b=<lat,lon>" width="100%" height="400">` into a
`TEXTAREA` makes the card show the external page inside the field; the value is stored with `&` as
`&amp;`. A page that loads a Referer-restricted browser API key (Yandex JS API) sends ITS OWN host as the
Referer, not the stand's, so that host must be on the key's list.

**A «Текст» (`STATIC_TEXT`) field works the same way, with no editor around it** `[C]`. Its `staticValueMap` is only the default: a script writes the RECORD's own HTML with
`F-VALUE_IN_LANG-K-DYN-R-D-S-boi_fields` (`language` = Enum `MybpmLang` `RUS`) on the field reference
(`MYBPM-IMPORTS.md` §0.5). A real button click shows the `<iframe>` at once; after СОХРАНИТЬ and reopening
the record still shows its own frame, while the BO's `staticValueMap` keeps its placeholder. Prefer this
over a `TEXTAREA` for a read-only embed. Which sites can be framed at all: `yandex.ru/maps` answers
`X-Frame-Options: DENY`; the embeddable widget `https://yandex.ru/map-widget/v1/?rtt=auto&rtext=<lat,lon>~<lat,lon>`
(no key, draws the road route) has no XFO / `frame-ancestors` and renders `[C]`.

Rules for HTML pasted into a MyBPM HTML field; the same rules work for HTML inside «Текст» (STATIC_TEXT)
headings. **A group heading** `[C]`: `<div style="font-size:18px;font-weight:700;color:#1f2d3d;border-bottom:1px solid #d9dee5;padding-bottom:6px">Тема</div>` renders
18 px bold with the underline (a `background` + `border-radius` plate and a `border-left` bar render too; so does
`<h3 style="font-size:18px;font-weight:700;margin:0">`); a bare `<h3><b>Тема</b></h3>` renders as a small bold label.

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

**Read this section only when** you patch an xlsx by hand or move files through Google Drive.

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

- Do not retry: hidden columns H:XFD + `zeroHeight` still show cells outside the table, and injecting
  that metadata after a library save does not crop either.
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
- rclone's shared client_id is being retired and hits `rateLimitExceeded` — if uploads start failing,
  give the remote its own client_id.

## 10. Browser-automation traps

**Read this section only when** a program drives the stand's UI in a real browser — any automation tool
(a browser extension, a DevTools-protocol client, Playwright, Selenium); the API route never needs it.
The words used below: an **in-page script** = JavaScript the tool evaluates inside the stand's page; a
**screenshot**; a **coordinate click** = a mouse event the tool sends at a point; **simulated typing** =
key events the tool sends; the **accessibility tree** = what the tool's «read the page / find an element»
calls see; the **network log** = the tool's list of requests.

What depends on the tool, not on the stand — check yours before relying on it:
- **What an in-page script may return.** A tool may refuse or mask results that look like credentials or
  URLs: values derived from `localStorage` or from response headers, text with a query string or
  cookie-like `=`/`&`/`?`. Then the token never leaves the page — drive the API through the in-page helper
  below, which reads the token inside the page and returns only the parsed body; leave `location.href` out
  of a result (a record panel's URL carries `draftId=…`); replace `[=&?]` before returning a text; pass an
  id that may contain `~` hex-dumped (`[...new TextEncoder().encode(id)].map(b=>b.toString(16)…)`) and
  decode it outside; return anything large through the local bridge below. A masked result does not mean
  the code did not run.
- **How long one in-page call may take.** A tool may cut the call after a fixed time (45 s has been seen)
  **while the page keeps running the promise** — the timeout kills the wait, not the work. So for anything
  long (a loop of imports, a poll, a settings-only import of ~10–20 s) do not await it in the call: start
  it as `window.__pending = run(list).then(r => window.__pendingDone = r)`, return at once, and poll
  `window.__pendingDone` in later calls. A long save loop cut off this way is still running: verify with a
  separate read, never rerun it.
- **Page state survives between in-page calls** — `window.__x` set in one call is readable in the next;
  only a navigation or a reload wipes it. Re-inject helpers after every navigation (a missing one fails
  with `ReferenceError` BEFORE it sends anything).
- **A network log may dump whole `data:image/…;base64` URLs** — filter it by `/web/` and keep the limit
  small. A log that lists URL + status only does not show bodies: to see what the UI really sends, patch
  `XMLHttpRequest` in the page (**the Angular client uses XHR, not `fetch`** — a `fetch` patch records
  nothing) and push `/web/` request bodies into `window.__log`.
- **Screenshots and the window.** A tool may resize the real window to its capture frame, and a scaled
  screenshot may shrink the viewport one step per call until the layout collapses and every drag misses —
  take screenshots unscaled; if the viewport is already wrecked, open a new tab. The viewport can differ
  between two screenshots, so a point computed from the previous one misses. A screenshot of a hidden
  window (`document.visibilityState === "hidden"`) times out while in-page scripts keep working — switch to
  the API calls the UI would have made (§6b), or bring the window forward. A screenshot also times out
  every few calls on this stand at random; repeating the same call works.
- **Coordinate frames.** Coordinate clicks are in the screenshot's frame, which need not equal CSS pixels.
  Measure the factor instead of guessing: `document.addEventListener('mousedown', e =>
  __pts.push([e.clientX,e.clientY]), true)`, click a known point, read it back, then click at CSS / factor
  with every rect from `getBoundingClientRect()`.

The stand's own behaviour under automation `[C]`:
- **Drive this app's clicks from an in-page script, not from coordinate clicks.** A coordinate click
  computed from an element's rect lands a full row off, and the mousedown calibration above catches
  nothing although the click visibly happens. `el.click()` on the element found by its text works every
  time and needs no coordinates. Two gotchas:
  - filter by **`innerText`**, not `textContent` — the buttons' `textContent` did not match `'ПРИМЕНИТЬ'`
    while `innerText` did;
  - scope the query to `.cdk-overlay-container` for anything inside a dialog, and click the `<button>`,
    not the `<span>` inside it.
- **Some controls ignore `el.click()`**: the «Добавить» inside a nested table's picker reacts only to a
  full mouse sequence. Dispatch `pointerdown`, `mousedown`, `pointerup`, `mouseup`, `click` (bubbling,
  with `clientX/Y`) on `document.elementFromPoint(<centre>)` — this also works while screenshots time out.
  Check first that the point is not covered by a `cdk-overlay-backdrop` (an open «Внимание» confirm
  dialog sits on top and swallows the click). The constructor's «СОХРАНИТЬ» is the opposite case: it
  ignores real mouse clicks and saves on `button.click()` (§2).
- **Do not type into this app's Angular inputs.** Simulated typing silently drops spaces, `:` and `()`,
  can lose trailing text, and does not replace a selection — after a triple click the text is APPENDED
  («Чекбокс» + «Активен» = «ЧекбоксАктивен»). Set the value through the native setter and fire the events
  Angular listens to —
  ```js
  const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;
  set.call(ta, text); ta.dispatchEvent(new Event('input',{bubbles:true}));
  ta.dispatchEvent(new Event('change',{bubbles:true}));
  ```
  (`HTMLInputElement.prototype` for an `<input>`), then READ `.value` back before saving — a field code is
  generated from the label at the first save and never regenerated.
- **Coordinate drags are needed in two places only**: a palette item onto the constructor canvas (§5b)
  and a figure's slot dot in the process editor (§5f). A tool's own press-move-release drag drives this
  CDK drag-drop fine.
- **The sidebar, popovers and the BO-group list are not in the accessibility tree** — read the sidebar
  with `document.querySelector('.menu-list').innerText`. **The BO-group list is CDK-virtualised**: a
  group below the fold is not in the DOM at all and scrolling the page does nothing. Scroll the container
  itself — `document.querySelector('.cdk-drop-list.scroll-bar').scrollTop = …` — then take a screenshot.
  Its `innerText` reads empty; locate rows by `input.value` + `getBoundingClientRect`.
- **A screenshot taken right after a navigation shows a half-loaded screen**: the composite editor
  rendered its panes empty and looked like an import that had written nothing. Wait, or re-navigate,
  before concluding anything from a screenshot — and prefer an API read-back as the evidence.
- **File inputs and downloads.** A file goes in by setting the files of the hidden `input[type=file]`
  (§5 «Import tab») — never click the button, it opens the operating system's file picker, which the
  automation cannot see or fill. A browser download the UI starts («Выгрузить», «Экспорт в .xlsx») may
  never reach a folder the program can read in an automated browser profile — take the bytes from the
  API instead (§5 «Export through the API», §6).
- **The in-page API helper** — the token stays in the page, the call returns only the parsed body:
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
  **Keep the envelope even where a plain call seems to work**: with the params in the query string and a
  bare JSON body, `bo-process-editor2/create-draft` and `load-draft-data` answer normally, but
  `update-draft` (whose body is an ARRAY) answers 400 «Failed to read request»; the same array inside
  `body_o1nhHUG480` goes through. Never return `r.headers.get(…)` (the export's file name sits in
  `content-disposition` — derive a name yourself).
- **Bytes in and out of the page go through a local bridge** — a `Bun.serve` on `127.0.0.1` with
  `Access-Control-Allow-Origin: *` (§5): `GET /get?name=` feeds a file INTO the page (the zip for
  `import-file`), `POST /save?name=` takes bytes OUT (an export, a JSON dump). Two shell traps around it:
  start it **detached** (`setsid nohup bun bridge.bun.ts > log 2>&1 < /dev/null &`) or a supervising
  harness may reap it; and stop it **by PID** — `pkill -f 'bun bridge.bun.ts'` inside a shell command
  matches the wrapper shell's own command line and kills it, so the rest of that command silently never
  runs. Writing one is ~20 lines of `Bun.serve`; if `tools/` is available, use the committed
  `tools/bridge.bun.ts`, started detached by `mise run bridge` and stopped by pid with
  `mise run bridge-stop`; files live in `tools/out/bridge/`.
- **Pasting into the Block IDE from automation**: the IDE pastes from the canvas CONTEXT MENU (right
  click → «Вставить»), not from Ctrl+V, and reads the clipboard with `navigator.clipboard.readText()` when
  the menu opens — which fails in an automated page («Document is not focused»), so the item silently
  pastes nothing. Fix: override it in the page before the right click —
  `navigator.clipboard.readText = async () => window.__scr` (the JSON fetched from the local bridge) —
  then click «Вставить» with a REAL coordinate click (`el.click()` and synthetic mouse events on its
  `<tr>` are ignored); compute the point from the `<tr>` rect × (screenshot width / `innerWidth`). The
  paste is `v2/script/paste` + one `apply-update-cmd`. After a navigation the first click on the scripts
  icon is swallowed — click `[selenide=q9qtPW3E-bo-script-icon]` from an in-page script instead.
  **Usually you do not need the UI at all**: the same two calls work headlessly from any page of the
  stand (`fetch('/web/…')` with the page's own token) — §5g «Writing a script headlessly».
- **Drive the API from `https://<stand>/favicon.ico`, not from the app**: the stand root redirects to the
  LAST opened route, and a record panel there re-creates its draft and reloads by itself — an in-page job
  started from it can vanish mid-run, and the tab can freeze (screenshots time out). The favicon URL is
  the same origin, so `localStorage` (the token) and `fetch('/web/…')` work, and nothing on it reloads.
  Use the app only for what needs the UI. The client bundle is readable from there too — `fetch('/')` →
  the `runtime.*.js` chunk map → grep the chunks for a controller path to learn a call's shape without
  clicking.
- **Open a record card by URL**: `/business-objects/viewing-list/bo/<boId>/list-view?fieldId=list&boId=<boId>&boiId=<boiId>&draftId=&menuItemId=list&businessObjectId=<boId>&boiDialogType=EDIT&boiViewType=FORM&boiState=ALL`
  — the registry with that record open in its dialog (the page mints its own draft). The shorter
  `/viewing-list/bo/<boId>/list-view` (no `/business-objects`) is NOT a route — it lands on «Главная».
- **Never reuse the `/business-objects/viewing-single/panel?…` URL for an ordinary BO**: with
  `isPanel=false` and a real `boiId` the page rewrites itself to the home PANEL's `boiId` and
  `isPanel=true` — and the BO gets a new empty record under that same id.
- **Reading a date picker without screenshots**: the card's pickers are `nz-date-picker` /
  `nz-range-picker` / `nz-year-picker` elements; `mousedown` + `click` + `focus` on their `input` opens a
  `.ant-picker-dropdown`, whose `td.ant-picker-cell-in-view` cells carry `title` (`30-9-2026`) and
  `ant-picker-cell-disabled`; `.ant-picker-header-next-btn` pages on. **Dropdowns of earlier pickers stay
  in the DOM** — record the set of dropdowns before the click and read only the new one, or you read a
  stale calendar. Run the loop fire-and-forget (`window.__r`) — eight pickers take longer than a cut-off
  in-page call.

## 11. Traps and defects — the short list

1. Filter an automation tool's network log by `/web/` — unfiltered it dumps whole base64 images (§10).
1b. The `token` header takes the localStorage value **without its JSON quotes**; with them every call
    answers `SecurityError` «Illegal Session».
2. `authorsField` is null on untouched BOs — create the object before saving rights.
3. Rights groups persist only through `orgUnitToAdd` / `orgUnitToDelete`, never `orgUnitRecordList`.
4. Menu-item rights use `v2/menu-item/*`; the `business-objects` menu-access endpoints fail with `NoBoWithId`.
5. A bracket's own filters are ignored when it has sub-brackets; sibling combination uses the EARLIER
   sibling's `connectionType`.
6. A menu icon must come from §4 «Menu icon catalogue» (`phosphor:*` or `menu-item:*`); the server and the
   importer accept any string, and a wrong one leaves the sidebar item without an icon.
7. A kanban needs `kanbanCardTemplates` ON THE BO. A dropdown added in the constructor or over the API gets a
   default card from the server; an ARCHIVE BO gets one only from the archive. `save-kanban-card-template` P
   `{boId, fieldId}` sets or repairs it (§7). The MAP view needs it too: give every dropdown of an archive BO a
   template (§5l, trap 61).
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
15. A blank scalar cell CLEARS the field, a missing column KEEPS it — on an update ship only the columns
    you change plus the key. Reference blocks behave the other way: an empty block keeps the link, a TABLE
    block only adds children, and a block never edits the child (R7).
16. xlsx library: update both `dimension` and the table `ref`; a Cyrillic table `displayName` breaks the file.
17. Do not chase Google Sheets grid cropping through `xl/metadata`.
18. Structure-import rollback: only the import with `canRollback:true` can be undone, inside one minute the
    stand ranks the FIRST-applied import as the newest, and undoing an UPDATE restores the state IT found — later changes are lost
    (§5 «Rollback trap»). Leave a minute between applies you may want to undo. After a same-minute
    create + update pair, the create is undone first and deletes the BO; the update then shows
    `canRollback:true` with a RESTORE of that BO — leave it APPLIED; whether undoing it brings the BO back is `[U]`.
18. A BO is created only from a GROUP's hover-kebab in `/business-objects/editing`; the caption-level ⊕
    sends `boGroupId: null`, finds no `kind: DEFAULT` group (a company may have none) and silently creates nothing.
19. `save-business-object-portion` wants `{businessObject: …}` inside `jsonPart`; a bare DTO throws
    `UndeclaredThrowableException`. `save-business-form-field` never creates fields — use the portion save.
20. BO and field codes are generated by the SERVER from the names; the BO code is cut to 30 characters.
21. `load-bo-records-by-group-id` takes `groupId`, not `boGroupId`.
22. A FIELD's code is generated from its label at the FIRST save and never regenerated — fix the label
    before СОХРАНИТЬ. **A BO's code behaves the same way** `[C]`: it appears at
    the first save that gives the BO a name and later renames do NOT change it.
23. The import dialog's tree labels a node `<вид объекта>/<имя БО>` — the first half is the CATEGORY, not
    the BO group. A `BO_PANEL` node carries no prefix at all, just the name.
24. **Constructor API race**: a field save that lands within ~1 s of the rename makes the server append a
    16-char uniquifier to the just-generated BO code (`<generated code><16 chars>`), and a BO
    code is never regenerated afterwards. `tools/create-bo-constructor.bun.ts` sleeps 3 s between the
    two and warns if the code changed. The Angular client never hits it — a human types the name and drags
    fields seconds apart.
25. `delete-business-object` takes `{businessObjectId}` as a **param**, not a body
    (`postJson(path, body, params)` — body FIRST in the client's signature, params second).
26. A MyBPM error response carries a ~100-line Java `stackTrace` — never `cat` one into the session,
    pipe it through `head -c 300` or read only `message`/`errorType`.
27. **An automation screenshot may resize the real browser window** (§10): a scaled screenshot shrinks the
    viewport one step per call until the app's layout collapses and every drag misses. Take screenshots
    unscaled; a viewport already pinned to the capture frame is undone only by a NEW TAB.
28. **Click coordinates are not CSS pixels and do not follow that emulated viewport.** Measure the factor
    instead of guessing: `document.addEventListener('mousedown', e => __pts.push([e.clientX,e.clientY]),
    true)`, click a known point, read it back (one tool gave `CSS = frame × 1.1885`,
    the ORIGINAL window width, not the current one). Then click at `CSS / factor`, taking every CSS
    rect from `getBoundingClientRect()`.
29. `v2/co/generate-draft` is **not idempotent** — each call creates a new draft of the composite object.
    Only the editor's own draft is applied by СОХРАНИТЬ; any draft you generate yourself to «just look»
    must be removed with `remove-draft`, whose response body is EMPTY (`res.json()` throws on it).
30. **The Angular client uses XHR, not `fetch`** — monkey-patching `window.fetch` to record requests
    captures nothing. Patch `XMLHttpRequest`, or read the automation tool's network log (§10).
31. **Simulated typing drops spaces and punctuation** in this app's inputs; a coordinate click lands
    off by a whole row and the trap-28 calibration does not even fire. Click with `el.click()` from
    an in-page script (match on `innerText`, scope dialogs to `.cdk-overlay-container`, click the
    `<button>`) and set text through the native value setter + an `input` event. §10.
32. **A BO code is cut to 30 characters**, so a hand-transliterated code silently misses the stand's
    (a 32-character transliteration loses its last two characters and can end in a trailing `_`). Anything that
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
    (e.g. a page navigation mid in-page call): the data goes in twice and the analysis ends
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
43. **The registry's default sort follows its FIRST column, not `sortFieldId`** `[C]` — `save-bo-table-sort`
    writes `sortFieldId` (PARAMS half only) and the registry still opens sorted by the column at
    `tableColOrderIndex` 0. Change the column order to change the default sort. §7.
45. **A registry remembers the sort a header click chose** `[C]` — the next opening (navigation or F5)
    arrives in that order, not the default one; click another header to change it. §7.
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
    `v1/business-object-instance/ensure-index` (its live route is `v2/…`). Whenever a bundle-read controller 404s, retry the same path under `v2`. §6a.
49. **One unknown enum value in a script def makes ALL scripts of that BO unreadable — for good** `[C]`
   . Once `apply-update-cmd` stores e.g. `"opType":"GreaterEq"`, every script call on that
    BO (read, translate, versions, apply, undo, delete) answers `IllegalArgumentException: No enum
    constant …`, the fix included. Only the enum values listed in §5g «The script language» may be written;
    a wrong `actId` or argument name is harmless. No API call or structure import repairs it — only the vendor,
    in the database: the defs are embedded in the ONE document of the script module, and the bad `opType` value
    there is set to a valid one. §5g «Writing a script headlessly».
50. **A wrong `PROGRESS_BAR` value makes the whole draft unreadable** `[C]` —
    `save-field-value` stores `["<stepId>"]` without complaint, then `load-field-data` answers
    `IllegalStoredValue … Value_PROGRESS_BAR` for the entire form (so would the UI). `"[]"` is refused the
    same way; **`""` repairs it**. Leave a progress bar alone unless you know its value shape (§6b).
51. **The §6a record API runs NO script** `[C]` — not «Добавление», not «Сохранение», not
    a field change. **Neither does an xlsx record import (R7)** `[C]` for a created record or an updated one. Use the form cycle of §6b when the BO's hooks must run, §6a when they must not.
52. **The whole stand answered 502 for ~30 s during a burst of `save-field-value` calls** `[C] symptom,
    [U] cause`. It followed `FILE_UPLOAD = "[]"` and `CHECKLIST = "[]"`; whether one of
    those crashes the backend is unknown — send one value at a time with a
    `load-auth-info` health check after each. The real shapes (§6b: `["<fileId>"]`, the item list) sent
    one by one cause no outage.
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
    undo the rename. Always ship `code` (§5 «Verifying an import»). Which group it hits is NOT the one
    with the largest `orderIndex` `[C]`; which one it is stays unknown, and it can no longer be probed —
    every group created now gets a code, and a code cannot be set back to `null` (§5 «group lifecycle»).
56. **The timeline view («Диаграмма Ганта») shows a licence banner of the Gantt library** at its bottom `[C]` —
    «Your license key is not valid to work with this version» or «Your license key is too old to work with this
    version», depending on the stand; the view works.
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
59. **A field-code analysis started while another runs is lost — and looks finished** `[C]` — the stand runs
    one `field/refresh-code` analysis at a time (all companies; BO-code analyses apart). A second
    `analyze-code-usage` returns a `refreshCodeDtoId` the server does not keep; `is-analyze-done` answers
    `done: true`, `errorMessage: null` at once (exactly as for a made-up id), and `apply-new-code` fails with
    `«no refreshCodeDto with id: …»`. A real analysis takes ~35 s, so an instant `done` means lost. `cancel`
    does not free the slot, and repeated lost calls seem to keep it busy `[I]`. Change codes one at a time;
    after a lost one stop calling for ~5 min, then start ONE analysis and let it finish. In the dialog the
    lost case shows as «Изменить код» enabled at once and the change failing on click `[I]`. §5j.
60. **The direct code setters validate nothing** `[C]` — `save-business-object-code` /
    `save-business-object-settings` accept a code another BO already has, Cyrillic, spaces and `""`, and do
    not migrate scripts that use the old code. §5j.
61. **An archive BO with a dropdown and no kanban card template has no map** `[C]` — once it holds a
    record, `v2/geo/load-bracket-boi-points` (the «Карта» view), the kanban view and the kanban editor all answer
    NullPointerException «cardTemplate is null». `save-kanban-card-template` P `{boId, fieldId}` repairs it (§7), so does a re-import with
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
71. **Re-importing a stand export onto the BO it came from is not a no-op** `[C]` — every print form gets a
    copy (same name and code; forms are matched by `newId`, which each export renews), the SIGNATURE phone is
    cleared, `massPrintFormCodes` is not restored, and rolling the import back adds one more copy of each form
    and restores neither the phone nor a radio's dictionary. Drop `printForms` from such an archive, then
    check phone and forms by hand. §5 «Rollback trap», §5i, `MYBPM-IMPORTS.md` §0.13.
72. **A rolled-back or deleted BO revives on the next import with the same `oldId`** `[C]` — with every old
    field (old positions, overlapping the new form), the diff silent about them; a revived reference to a
    rolled-back dictionary answers «данный бизнес-объект не существует» on its options. A new attempt gets new
    ids (a new build salt, `MYBPM-IMPORTS.md` 0.7). §5 «A deleted BO comes back».
73. **`EsDataTooLargeException` on a save or an import step is transient** `[C]` — the stand's Elasticsearch
    breaker, not the payload: repeat the same call every few seconds until it passes (it may take minutes), and
    before repeating a CREATE read whether the first one already stored the record (§5b «Data too large»).

## 12. Open questions

The record-format questions moved with the format itself — `MYBPM-IMPORTS.md` §20.

- Whether a registry column's `tableWidth` travels in an archive (export a BO with a resized column, re-import
  onto a copy).
- The create-record iframe URL in a browser with no stand login: does it open, and whose record is it (§5m)?
- §5n settings kinds: how to unset a migration monitor BO; what the `languageTag` an import writes
  into every language changes; whether an org unit (`D-<id>` + its record line) resolves on ANOTHER stand; TELEPHONY,
  IN/OUT_MIGRATION, APPEARANCE imports (need a provider / Kafka / ownership).
- §5n: how to clear a messenger chat registry once set (the API ignores `null`); why Telegram's `isConnected` turned
  `true` with no field values set (WhatsApp stayed `false`); the per-BO telephony and
  Kafka migration lists (need a provider / Kafka).
- §5o: whether the other 13 settings
  kinds (physical removal, messengers, offline …) round-trip through `CompanySettingsStructDto` like
  `SCRIPT_SETTINGS`, and whether they too REPLACE the stand's list; what caused the one-minute 502 after a TEST call.
- What «Браузер скриптов» (`v2/script-browser`) looks like on screen — not opened yet
  («Глобальные методы» is answered in §5g).
- **Constructor controls read off the bundle** (§5b «The rest of the constructor's controls», the rows not marked
  `[C]`): confirm each row once with the network log on, then re-read `load-business-object-by-id`. Open within
  them: the per-language option label (a company with two languages); the second dialog of a field delete when the
  field feeds a kanban or a menu item (`load-field-usage` not empty); nested tab groups (a `TAB_GROUP` on a tab); what `deletedFieldOptionIds` /
  `deletedFieldTabIds` / `deletedFieldProgressStepIds` do to records holding them (delete one, re-read a record);
  `calendarCardTemplates` / `timelineTemplates` through an archive (export shape, re-import onto a copy).
- Changing a field's TYPE: look for a control in the gear / «Инфо» tab; try `editedFields {fieldId, type}`, re-read.
- Deleting a BO: what happens to its records, menu items, references from other BOs and composites that use it
  (scratch BO with one of each, delete, re-read each); the UI dialog's buttons.
- BO groups: `delete-business-object-group` on a group holding a BO (answer, `load-bo-groups`); reordering groups
  by drag (watch for `save-business-object-group`).
- A field on a built-in BO (Person): `generate-business-form-field {boId:<Person boId>}` + portion save on a scratch
  field, then delete it.
- Structure import UI: whether the import log has a rollback control (open an applied import's row); what status
  «ПРЕКРАТИТЬ» leaves on a dry run (`load-import-data`).
- Script and process versions: the UI control that publishes a version (open the version selector, capture
  `in-work-*`); `change-bo-process-version-comment`, `unset-in-work-version`, `remove-bo-process-version` on a
  scratch BO, read the versions back.
- Processes: does a `SCHEDULED` run way ever fire (`startTime` a few minutes ahead, poll for a new process
  record); process local methods (`bo-process-editor/create-local-method {boProcessId, methodName}`, call it
  from a Script figure); `stop-step` / `push-step-terminate-all` / `go` / `start-dev-process` on a DEV process
  standing in a Form; a Form timer (`createTimer` 1 min, watch `load-process-steps`).
- Renaming a company-global method: `Set blocks.<hat>.methodName`, then `translate-script` its callers.
- Rights: the head / employees / department flags of «Из поля» (second non-admin login, one flag at a time,
  `totalHits`); whether a «Пользователи» record created by the §6a draft cycle or by an xlsx sends the invitation (a probe
  user only with the user's OK and an address they own — it mails a real person); switching tenant as a multi-company user (look for a company-selector call).
- Menu items: the calls behind rename, reorder, «Изменить код», move into another group and
  «Отображать в моб. приложении» / `needCountMenuItem` (click each kebab action with the network log on);
  where a menu item's views (timeline, list) are switched in the UI.
- Kanban: whether a card drag (`move-kanban-card`, §7) fires the dropdown's «Изменение поля» hook.
- Records: the registry / card controls for Удалить / Архивировать / Восстановить / Дублировать and the params of
  `archive-bo-instance` / `restore-bo-instance` / `copy-bo-instance` (tick a row, open both kebabs with the
  network log on, replay, re-read with `state:"ARCHIVED"`/`"REMOVED"`); the empty value for non-date types in
  `save-boi-value` / `save-field-value` (`""`, `null`, `[]` on a probe record, `load-boi-values`); whether
  `save-boi-value` stores a bare option id (one call + read-back); downloading an attached file (click the
  chip, capture the GET); a rollback of an applied records import (look for `bo-transfer/*rollback*`); the
  records import dialog, act screen and apply button in the UI; the registry search box and filter panel
  (capture `load-bo-instance-bracket-table` bodies); the CHAT tab's message send / read and PEOPLE add / remove;
  deleting a dictionary row still used by records' dropdowns (re-read a record).
- A `STATIC_TEXT`'s HTML sanitizer = the `TEXTAREA` one? Save `text-transform` HTML into `staticValueMap`, read back.
- The UI login form and the logout control (walk them once with screenshots).

- Whether a `CHECKLIST`'s items can be carried by an archive at all (an undocumented key?) or whether the
  exporter simply omits them — see trap 42.
- SIGNATURE: what clears `signFieldUnsupported` for MASS signing — nothing on the stand does (§5i), a
  vendor question — and what a real signing (OTP code / EDS through NCALayer) writes into the record.
