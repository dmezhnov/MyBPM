#!/usr/bin/env bun
/**
 * Validator for a `.mybpm.zip` structure archive — checks it against the RULES OF §0 of
 * `MYBPM-IMPORTS.md` and nothing else. Written to grade archives produced by a model that was given
 * only that document, so every rule below quotes the section it comes from.
 *
 * Severity:
 *   FATAL — the import is expected to fail outright (§0.9)
 *   ERROR — the import succeeds but builds something other than what was asked (silent damage)
 *   WARN  — style / convention deviation, the object is still usable
 *
 *   bun tools/validate-archive.bun.ts <file.mybpm.zip> [--json]
 */

const PKG = "kz.greetgo.mybpm.reg.structure.model.dto.";
const ID_RE = /^[A-Za-z0-9@~]{16}$/;

const FIELD_TYPES = new Set([
  "INPUT_TEXT", "INPUT_PHONE", "INPUT_EMAIL", "INPUT_NUMBER", "TEXTAREA", "TIME", "FULL_DATE",
  "YEAR_AND_MONTH", "YEAR", "DATE", "PERIOD", "PERIOD_TIME", "CHECKBOX", "DROPDOWN_SINGLE",
  "FILE_UPLOAD", "CHECKLIST", "RADIO_BUTTON_GROUP", "QUESTIONNAIRE", "BO", "CO", "TAB_GROUP",
  "GEO_POINT", "PROGRESS_BAR", "INPUT_TEXT_LANG", "TEXTAREA_LANG", "LINK", "STATIC_TEXT",
]);
const NOT_A_FIELD_TYPE = new Set(["BUTTON", "RANGE", "MULTIPLE", "SINGLE", "INPUT", "IFRAME",
  "CAPTCHA", "CURRENT_DATE", "CURRENT_DAY", "CURRENT_MONTH", "CURRENT_DAY_AND_MONTH", "CURRENT_YEAR",
  "CURRENT_USER", "SIGNATURE", "CREATED_AT", "LAST_MODIFIED_AT", "CREATED_BY", "LAST_MODIFIED_BY",
  "OPEN_COUNT", "IN_MIGRATION_UPDATED_AT", "PARTICIPANTS", "BUSINESS_OBJECT", "USER_DROPDOWN_MULTI",
  "CHECKBOX_GROUP", "DATE_TIME", "BOOLEAN", "STRING", "NUMBER", "TEXT"]);

const CATEGORIES = new Set(["BO", "BO_DICTIONARY", "BO_PANEL", "BO_COMPOSITE", "BO_PROCESS"]);

const NATIVE_TYPES: Record<string, string> = {
  CREATED_AT: "FULL_DATE", LAST_MODIFIED_AT: "FULL_DATE", CREATED_BY: "BO", LAST_MODIFIED_BY: "BO",
  OPEN_COUNT: "INPUT_NUMBER", IN_MIGRATION_UPDATED_AT: "FULL_DATE",
};

const WIDGET_MAPS: Record<string, string[]> = {
  signatures: ["SIGNATURE"], buttons: ["BUTTON"], iframes: ["IFRAME"], captcha: ["CAPTCHA"],
  currentDates: ["CURRENT_DATE", "CURRENT_DAY", "CURRENT_MONTH", "CURRENT_DAY_AND_MONTH", "CURRENT_YEAR"],
  currentUser: ["CURRENT_USER"],
};

// §0.8: the heights that fit the content (a BO / CO SINGLE is one line = 3, a TEXTAREA 6)
const ROWS_6 = new Set(["BO", "CO", "LINK", "FILE_UPLOAD", "CHECKLIST", "RADIO_BUTTON_GROUP", "PROGRESS_BAR", "TEXTAREA", "TEXTAREA_LANG"]);
// §0.8: kinds that stand alone in their row, full width
const FULL_WIDTH = new Set(["TEXTAREA", "TEXTAREA_LANG", "STATIC_TEXT", "TAB_GROUP", "CHECKLIST", "QUESTIONNAIRE", "GEO_POINT", "PROGRESS_BAR"]);
const ROWS_8 = new Set(["QUESTIONNAIRE", "GEO_POINT"]);
// §0.8a: a label + one-line box is 58 px = 3 rows of 30; 4 leaves an empty band
const ROWS_3 = new Set(["INPUT_TEXT", "INPUT_TEXT_LANG", "INPUT_PHONE", "INPUT_EMAIL", "INPUT_NUMBER", "TIME", "FULL_DATE",
  "YEAR_AND_MONTH", "YEAR", "DATE", "PERIOD", "PERIOD_TIME", "CHECKBOX", "DROPDOWN_SINGLE"]);
// the text editor's toolbar buttons a TEXTAREA's params.buttonTypes may list (client enum, 2026-10-01)
const TEXTAREA_BUTTONS = new Set(["style", "bold", "underline", "italic", "fontsize", "color", "ul", "ol", "paragraph",
  "table", "link", "picture", "video", "hr", "codeview", "height"]);

// §0.4 — the full key set of BoStructDto
const BO_KEYS = ["@class", "oldId", "code", "category", "kind", "boGroupOldId", "instanceViewType",
  "bos", "boTabs", "printForms", "name", "recordName", "staticValue", "description", "orderIndex",
  "dynamicFields", "nativeFields", "dictionaryFields", "actual", "isCalendarEnabled", "isMapEnabled",
  "isGroupingEnabled", "isCodeReadonly", "chosenAccessRight", "kanbanCardTemplates", "timelineTemplates",
  "calendarCardTemplates", "signatures", "buttons", "iframes", "currentDates", "captcha", "currentUser"];
// keys newer builds write; older exports lack them. A re-import WITHOUT them resets the stand to the default
// (verified on <stand> 2026-10-01: isTouchEnabled → true, hideAddButtonFromRegistry → false)
const BO_KEYS_NEW = ["isTouchEnabled", "hideAddButtonFromRegistry"];
const BO_KEYS_OPTIONAL = ["sortFieldCode", "sortFieldOrder", "messengerFieldCode", "whatsAppFieldCode", "gridLayoutPosition"];
// the record card's rail tabs (MYBPM-IMPORTS.md §2 «BO card tabs»)
const BO_TAB_TYPES = new Set(["CHAT", "PEOPLE", "FILES", "HISTORY", "PRINT_FORM", "TELEGRAM", "WHATSAPP"]);

// §0.5 — the full key set of a dynamic field
const FIELD_KEYS = ["code", "newId", "archetype", "kind", "boRefStruct", "label", "staticValue",
  "isUnique", "isRequired", "isAppendable", "isRequiredAll", "isReadonly", "isClickable", "isSelectOnly",
  "isSeparated", "needAddToParticipants", "needShowToCalendar", "dateOnlyFuture", "dateOnlyPast",
  "needTrackStatus", "tableColToShow", "isHistoryTracking", "isKindAddForSelect", "titleToShow",
  "questionnaireIsMultiple", "isProgressBarSticky", "hideLabel", "chosenAccessRight",
  "unacceptableValue", "isSystem", "isCodeReadonly", "needLoadFromInTables", "useAsKeyInMigration",
  "needUploadToOutTable", "needChangeParentBoByLinkedBo", "needFreezeWhenScroll", "needMarkNew",
  "textCase", "inMigrationTimezoneMinutes", "type", "groupingInfo", "fieldTabs", "tableColOrderIndex",
  "gridPosition", "removeType", "gantTableLocations", "boFieldCodes", "linkedCoSettings",
  "questionnaires", "progressSteps", "params"];

// §5b — a BO_COMPOSITE has no form: the verified sample carries none of these three keys
// on its dynamicFields, and an archive generated without them imports fine.
const COMPOSITE_ABSENT_KEYS = new Set(["gridPosition", "tableColOrderIndex", "removeType"]);
const PROCESS_STATUS_ABSENT_KEYS = new Set(["tableColOrderIndex", "removeType", "inMigrationTimezoneMinutes"]);
const EMPTY_SET = new Set<string>();

// §0.6a naming convention for new codes: English snake_case. Objects (BO / dictionary / composite /
// process / panel), BO groups and menu items are «Capitalised», everything else is lower case.
// A code already on a stand is never renamed, so a mismatch is a WARN, not an error.
const OBJECT_CODE_RE = /^[A-Z][a-z0-9]*(_[a-z0-9]+)*$/;
const LOWER_CODE_RE = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;
function naming(where: string, code: string, kind: "object" | "lower" | "checkbox" | "tabs" | "tab") {
  const want = {
    object: [OBJECT_CODE_RE, "First letter capital, the rest lower snake_case (Client_order)"],
    lower: [LOWER_CODE_RE, "lower snake_case (client_name)"],
    checkbox: [/^is_[a-z0-9]+(_[a-z0-9]+)*$/, "is_* (is_active)"],
    tabs: [/^tabs(_[a-z0-9]+)*$/, "tabs, or tabs_* when the BO has several"],
    tab: [/^tab_[a-z0-9]+(_[a-z0-9]+)*$/, "tab_* (tab_documents)"],
  }[kind] as [RegExp, string];
  if (!want[0].test(code)) add("WARN", "0.6a", `${where}: code "${code}" is not ${want[1]}`);
}

type Sev = "FATAL" | "ERROR" | "WARN";
const found: { sev: Sev; rule: string; msg: string }[] = [];
let nLines = 0;
const add = (sev: Sev, rule: string, msg: string) => found.push({ sev, rule, msg });

const file = Bun.argv[2];
const asJson = Bun.argv.includes("--json");
if (!file) { console.error("usage: validate-archive.bun.ts <file.mybpm.zip>"); process.exit(2); }

// ---------------------------------------------------------------- zip layout (§0.1, §0.10)
const listProc = Bun.spawnSync(["zipinfo", "-1", file]);
if (listProc.exitCode !== 0) {
  add("FATAL", "0.1", `not a readable zip: ${new TextDecoder().decode(listProc.stderr).trim()}`);
  report(); process.exit(0);
}
const members = new TextDecoder().decode(listProc.stdout).trim().split("\n").filter(Boolean)
  .filter(m => !m.endsWith("/"));

const dirs = new Set(members.map(m => m.includes("/") ? m.split("/")[0] : ""));
if (members.length !== 2) add("FATAL", "0.1", `zip holds ${members.length} members, expected exactly 2: ${members.join(", ")}`);
if (dirs.has("")) add("FATAL", "0.1", "members sit at the zip root; they must be inside one data-<timestamp>/ folder");
if (dirs.size > 1) add("FATAL", "0.1", `members are spread over ${dirs.size} folders: ${[...dirs].join(", ")}`);
const dir = [...dirs][0] ?? "";
if (dir && !/^data-/.test(dir)) add("FATAL", "0.1", `folder is "${dir}", must start with "data-"`);

const payloadName = members.find(m => m.endsWith("0000001.mybpm"));
const metaName = members.find(m => m.endsWith("metadata.mybpm"));
if (!payloadName) add("FATAL", "0.1", "no member named 0000001.mybpm");
if (!metaName) add("FATAL", "0.1", "no member named metadata.mybpm");

function extract(name: string): string {
  const p = Bun.spawnSync(["unzip", "-p", file, name]);
  return new TextDecoder().decode(p.stdout);
}

let payload = payloadName ? extract(payloadName) : "";
const meta = metaName ? extract(metaName) : "";

// ---------------------------------------------------------------- metadata (§0.9 rule 2)
const rawLines = payload.split("\n");
const jsonLines = rawLines.filter(l => l.trim() !== "");
nLines = jsonLines.length;
if (payload && !payload.endsWith("\n")) add("ERROR", "0.9/3", "payload has no final newline");
if (payload.endsWith("\n\n")) add("WARN", "0.9/3", "payload ends with a blank line");
if (metaName) {
  const m = /^objectCount-(\d+)$/.exec(meta.trim());
  if (!m) add("FATAL", "0.9/2", `metadata.mybpm is ${JSON.stringify(meta)}, expected "objectCount-<N>"`);
  else {
    if (meta !== meta.trim()) add("WARN", "0.1", "metadata.mybpm carries trailing whitespace/newline");
    if (Number(m[1]) !== jsonLines.length)
      add("FATAL", "0.9/2", `objectCount-${m[1]} but the payload has ${jsonLines.length} lines`);
  }
}

// ---------------------------------------------------------------- JSONL (§0.9 rule 3)
const objs: any[] = [];
jsonLines.forEach((line, i) => {
  try {
    const o = JSON.parse(line);
    objs.push(o);
    if (typeof o !== "object" || o === null || Array.isArray(o))
      add("FATAL", "0.9/3", `line ${i + 1} is not a JSON object`);
    const minified = JSON.stringify(o);
    if (line.length > minified.length + 2 && /:\s|,\s/.test(line))
      add("WARN", "0.9/3", `line ${i + 1} looks pretty-printed / padded (${line.length} vs ${minified.length} chars minified)`);
  } catch (e) {
    add("FATAL", "0.9/3", `line ${i + 1} does not parse as JSON: ${(e as Error).message}`);
  }
});
if (payload.trim().startsWith("[")) add("FATAL", "0.9/3", "payload is a JSON array, must be JSONL");

// ---------------------------------------------------------------- @class (§0.9 rule 4)
objs.forEach((o, i) => {
  if (!o["@class"]) add("FATAL", "0.9/4", `line ${i + 1} has no "@class"`);
  else if (!String(o["@class"]).startsWith(PKG) && !String(o["@class"]).startsWith("kz.greetgo.mybpm.reg.structure.model."))
    add("FATAL", "0.9/4", `line ${i + 1} "@class" = ${o["@class"]}, must start with ${PKG}`);
});
const cls = (o: any) => String(o?.["@class"] ?? "").split(".").pop();
const menus = objs.filter(o => cls(o) === "MenuItemStructDto");
// §5e: a menu line may point at a BO already on the stand, so an archive of menu lines alone is
// legal — imported 2026-09-22. It only needs every boCode to exist on the stand, which we cannot see.
const menuOnly = menus.length > 0 && !objs.some(o => cls(o) === "BoStructDto");
// §5d «Company-global methods»: an archive of global methods alone (their ScriptDefStructDtos + one
// CompanyGlobalMethodsStructDto) is legal too — it has no group and no BO.
const globals = objs.filter(o => cls(o) === "CompanyGlobalMethodsStructDto");
const noBoArchive = menuOnly || (globals.length > 0 && !objs.some(o => cls(o) === "BoStructDto"));
if (globals.length > 1) add("ERROR", "5d", `${globals.length} CompanyGlobalMethodsStructDto lines — the export writes one; the import REPLACES the whole list with it`);
for (const g of globals) {
  const ids: string[] = Array.isArray(g.scriptDefIds) ? g.scriptDefIds : [];
  if (!Array.isArray(g.scriptDefIds)) add("FATAL", "5d", "CompanyGlobalMethodsStructDto has no scriptDefIds array");
  const names = new Set<string>();
  for (const sid of ids) {
    const def = objs.find(o => cls(o) === "ScriptDefStructDto" && o.compositeId === sid);
    if (!def) { add("ERROR", "5d", `global methods: scriptDefIds names "${sid}", no ScriptDefStructDto has that compositeId`); continue; }
    const hats = Object.values(def.blocks ?? {}).filter((b: any) => String(b["@class"] ?? "").endsWith("BlockFixMethodStruct")) as any[];
    if (hats.length !== 1) { add("ERROR", "5d", `global method "${sid}": ${hats.length} BlockFixMethodStruct hats, must be exactly 1`); continue; }
    const n = String(hats[0].methodName ?? "");
    if (!n) add("ERROR", "5d", `global method "${sid}": hat has no methodName`);
    if (names.has(n)) add("ERROR", "5d", `global method name "${n}" twice`);
    names.add(n);
  }
  add("WARN", "5d", `the import REPLACES the stand's whole global-method list with these ${ids.length} — a stand method missing here is DELETED; after the import touch one method via apply-update-cmd or records keep running the old bodies`);
}

// ---------------------------------------------------------------- groups (§0.3, §0.9 rule 1)
const groups = objs.filter(o => cls(o) === "BoGroupStructDto");
if (groups.length === 0 && !noBoArchive) add("FATAL", "0.3", "no BoGroupStructDto line");
const groupCodes = new Set<string>();
for (const g of groups) {
  // §0.3: groups are matched BY code; a line without one renames a fixed stand group (§8)
  if (typeof g.code !== "string" || !g.code)
    add("FATAL", "0.9/1", `group "${g.name}" has no code — the importer renames a fixed stand group instead (§8)`);
  else if (groupCodes.has(g.code)) add("ERROR", "0.3", `group code "${g.code}" repeats`);
  else { groupCodes.add(g.code); naming(`group "${g.name}"`, g.code, "object"); }
  if (g.kind !== "MANUAL") add(g.kind === "DEFAULT" ? "FATAL" : "ERROR", "0.3", `group kind is ${g.kind}, must be MANUAL${g.kind === "DEFAULT" ? " — a DEFAULT group created by import becomes the general group and can never be deleted, not even by rollback" : ""}`);
  if (!ID_RE.test(String(g.oldId))) add("ERROR", "0.7", `group oldId "${g.oldId}" is not 16 chars over A-Za-z0-9@~`);
  if (!g.newId) add("WARN", "0.3", "group has no newId");
  if (typeof g.name !== "string" || !g.name) add("FATAL", "0.3", "group has no name");
}

for (const o of objs) if (cls(o) === "AccessStructDto")
  for (const k of Object.keys(o.fieldAccessStructMap ?? {})) if (k in NATIVE_TYPES)
    add("WARN", "0.12", `AccessStructDto: the lock of native ${k} is ignored by the import — set it over the API after the import`);
// tab rules (§7): fieldAccessStructMap.<TAB_GROUP code>.tabAccessStructMap.<tab code> — both looked up by code
for (const o of objs) if (cls(o) === "AccessStructDto") {
  const bo = objs.find(b => cls(b) === "BoStructDto" && b.code === o.boCode);
  if (!bo) continue;
  for (const [k, v] of Object.entries<any>(o.fieldAccessStructMap ?? {})) {
    const tabs = v?.tabAccessStructMap;
    if (!tabs || !Object.keys(tabs).length) continue;
    const g = bo.dynamicFields?.[k];
    if (g?.type !== "TAB_GROUP") { add("ERROR", "7", `AccessStructDto: tabAccessStructMap under "${k}", which is not a TAB_GROUP of ${bo.code}`); continue; }
    for (const t of Object.keys(tabs)) if (!(t in (g.fieldTabs ?? {})))
      add("ERROR", "7", `AccessStructDto: tab rule "${k}.${t}" names no tab of that TAB_GROUP (tab codes: ${Object.keys(g.fieldTabs ?? {}).join(", ")})`);
  }
}
// 0.9 rule 10 has ONE exception — the «никому» rule of the hidden system tab tab_system (§0.8a step 6)
for (const o of objs) if (cls(o) === "AccessStructDto") {
  const systemTab = Object.values<any>(o.fieldAccessStructMap ?? {}).some(v => v?.tabAccessStructMap?.tab_system);
  if (!systemTab)
    add("ERROR", "0.9/10", `AccessStructDto of ${o.boCode}: import replaces the stand's rights with the archive's; never ship one unasked`);
  else
    add("WARN", "0.8a", `AccessStructDto of ${o.boCode} carries the tab_system rule: fine for a NEW BO with all actions open; for an EXISTING BO it must be its fresh export line plus that rule — anything else replaces the stand's rights`);
}

// ---------------------------------------------------------------- ids unique (§0.7)
const idSeen = new Map<string, string>();
function id(where: string, value: any) {
  if (value === undefined || value === null) return;
  const v = String(value);
  if (!ID_RE.test(v)) add("ERROR", "0.7", `${where}: id "${v}" is not 16 chars over A-Za-z0-9@~`);
  if (idSeen.has(v)) add("ERROR", "0.7", `${where}: id "${v}" repeats (also ${idSeen.get(v)})`);
  else idSeen.set(v, where);
}

// ---------------------------------------------------------------- business objects
const bos = objs.filter(o => cls(o) === "BoStructDto");
if (bos.length === 0 && !noBoArchive) add("FATAL", "0.4", "no BoStructDto line");
if (menuOnly) add("WARN", "5e", "menu lines only, no BO line — legal (§5e), but every boCode must already be on the stand");
const boByCode = new Map<string, any>(bos.map(b => [String(b.code), b]));

/**
 * «Отображение» / «Поведение» of a BO / CO field (MYBPM-IMPORTS.md §3 «Reference fields») — every link is by
 * CODE and can only be checked when the other BO travels in this archive; otherwise it must exist on the stand.
 */
function checkRefSettings(bo: any, key: string, f: any, ft: string) {
  const fields = (b: any) => (b?.dynamicFields ?? {}) as Record<string, any>;
  const target = boByCode.get(f.boRefStruct?.boInfo?.code);
  if (f.viewType && !["TABLE", "MULTIPLE", "SINGLE", "FIELDS"].includes(f.viewType))
    add("ERROR", "3", `${ft}: viewType "${f.viewType}" — the constructor offers TABLE / MULTIPLE / SINGLE / FIELDS`);
  if (f.removeType && !["STRIKETHROUGH", "HIDE", "DISCONNECT"].includes(f.removeType))
    add("ERROR", "3", `${ft}: removeType "${f.removeType}" is not STRIKETHROUGH / HIDE / DISCONNECT`);
  if (f.needChangeParentBoByLinkedBo === false)
    add("WARN", "3", `${ft}: needChangeParentBoByLinkedBo false is LOST when the import CREATES the field — import the archive twice`);
  if (f.type === "CO" && f.isHeightDynamic) add("WARN", "3", `${ft}: isHeightDynamic on a CO — the constructor offers it on BO only`);

  // «Зависимость полей»: only boRefStruct.relMainInnerFieldCode travels; relFieldCode is resolved in the
  // REFERENCED BO (a wrong field) and the inner key is ignored (MYBPM-IMPORTS.md §3, 2026-10-01)
  const main = f.boRefStruct?.relMainInnerFieldCode;
  if (main && target) {
    const g = fields(target)[main];
    if (!g) add("ERROR", "3", `${ft}: relMainInnerFieldCode "${main}" is not a field of ${target.code}`);
    else if (g.type !== "BO" && g.type !== "CO") add("ERROR", "3", `${ft}: relMainInnerFieldCode "${main}" is a ${g.type}, must be a BO/CO field`);
  }
  if (f.boRefStruct && "relFieldCode" in f.boRefStruct)
    add("ERROR", "3", `${ft}: boRefStruct.relFieldCode is resolved in the REFERENCED BO and stores a wrong field — drop it and set relFieldId through the API after the import`);
  for (const k of ["relInnerFieldCode"]) if (f.boRefStruct && k in f.boRefStruct)
    add("WARN", "3", `${ft}: boRefStruct.${k} is ignored by the import — set relInnerFieldId through the API`);
  for (const k of ["relFieldCode", "relInnerFieldCode", "relMainInnerFieldCode"]) if (k in f)
    add("WARN", "3", `${ft}: top-level ${k} is ignored by the import (relMainInnerFieldCode belongs in boRefStruct)`);

  // «С фильтром»: bracketFilter = {boCode: REFERENCED BO, fieldCode: this field, brackets: map}
  const bf = f.bracketFilter;
  if (bf) {
    if (bf.boCode !== f.boRefStruct?.boInfo?.code) add("ERROR", "3", `${ft}: bracketFilter.boCode "${bf.boCode}" must be the referenced BO "${f.boRefStruct?.boInfo?.code}"`);
    if (bf.fieldCode !== key) add("ERROR", "3", `${ft}: bracketFilter.fieldCode "${bf.fieldCode}" must be this field "${key}"`);
    if (Array.isArray(bf.brackets)) add("ERROR", "3", `${ft}: bracketFilter.brackets is an ARRAY (the API shape) — in an archive it is a map keyed by 8-char ids`);
    else for (const [bk, b] of Object.entries<any>(bf.brackets ?? {})) {
      for (const [dk, d] of Object.entries<any>(b.dynamicFilters ?? {}))
        if (target && !fields(target)[d.fieldCode]) add("ERROR", "3", `${ft}: bracketFilter ${bk}/${dk} fieldCode "${d.fieldCode}" is not a field of ${target.code}`);
    }
  }

  // back link: a field of the REFERENCED BO that references this BO
  const back = f.boRefStruct?.linkedFieldCode;
  if (back && target && f.type === "BO") {
    const g = fields(target)[back];
    if (!g) add("ERROR", "3", `${ft}: linkedFieldCode "${back}" is not a field of ${target.code}`);
    else if (g.type !== "BO" && g.type !== "CO") add("ERROR", "3", `${ft}: linkedFieldCode "${back}" is a ${g.type}, must be a BO field`);
    else if (g.type === "CO") {
      // the other end is a CO field whose composite has THIS BO among its sources (its linkedCoSettings)
      const co = boByCode.get(g.boRefStruct?.boInfo?.code);
      if (co && Array.isArray(co.bos) && !co.bos.some((b: any) => b.code === bo.code))
        add("ERROR", "3", `${ft}: linkedFieldCode "${back}" is a CO field on ${co.code}, which has no source ${bo.code}`);
    } else if (g.boRefStruct?.boInfo?.code !== bo.code)
      add("ERROR", "3", `${ft}: linkedFieldCode "${back}" references ${g.boRefStruct?.boInfo?.code}, not this BO`);
    const rivals = Object.entries(fields(bo)).filter(([k, h]) => k !== key && h.type === "BO" && h.boRefStruct?.linkedFieldCode === back
      && h.boRefStruct?.boInfo?.code === target.code);
    if (rivals.length) add("ERROR", "3", `${ft}: back field "${back}" is also linked from ${rivals.map(([k]) => k).join(", ")} — one back field serves one field`);
  }

  const copy = f.copyFromFieldCode;
  if (copy) {
    const src = fields(bo)[copy];
    if (!src) add("ERROR", "3", `${ft}: copyFromFieldCode "${copy}" is not a field of this BO`);
    else if (src.type !== f.type) add("ERROR", "3", `${ft}: copyFromFieldCode "${copy}" is a ${src.type}, this field is a ${f.type}`);
    else if (src.viewType !== f.viewType) add("WARN", "3", `${ft}: copies "${copy}" whose viewType ${src.viewType} differs — the constructor refuses that pair`);
  }

  const lcs = f.linkedCoSettings;
  if (f.type === "BO" && lcs && Object.keys(lcs).length) add("ERROR", "3", `${ft}: linkedCoSettings on a BO field — only a CO field has them`);
  if (f.type !== "CO" || !lcs) return;
  if (Array.isArray(lcs)) { add("ERROR", "3", `${ft}: linkedCoSettings is an ARRAY (the API shape); an archive keys it by source BO CODE`); return; }
  for (const [srcCode, s] of Object.entries<any>(lcs)) {
    if (target && Array.isArray(target.bos) && !target.bos.some((b: any) => b.code === srcCode))
      add("ERROR", "3", `${ft}: linkedCoSettings key "${srcCode}" is not a source BO of the composite ${target.code}`);
    if (s.removeType && !["STRIKETHROUGH", "HIDE", "DISCONNECT"].includes(s.removeType))
      add("ERROR", "3", `${ft}: linkedCoSettings.${srcCode}.removeType "${s.removeType}" is not STRIKETHROUGH / HIDE / DISCONNECT`);
    const source = boByCode.get(srcCode);
    if (s.linkedFieldCode && source) {
      const g = fields(source)[s.linkedFieldCode];
      if (!g) add("ERROR", "3", `${ft}: linkedCoSettings.${srcCode}.linkedFieldCode "${s.linkedFieldCode}" is not a field of ${srcCode}`);
      else if (g.boRefStruct?.boInfo?.code !== bo.code)
        add("ERROR", "3", `${ft}: linkedCoSettings.${srcCode}.linkedFieldCode "${s.linkedFieldCode}" references ${g.boRefStruct?.boInfo?.code}, not this BO`);
    }
  }
}

for (const bo of bos) {
  const tag = `BO ${bo.code ?? "?"}`;
  id(tag, bo.oldId);

  for (const k of BO_KEYS) if (!(k in bo)) {
    // a panel the stand built itself has instanceViewType null, and the export omits a null key
    if (k === "instanceViewType" && bo.category === "BO_PANEL") continue;
    add("ERROR", "0.4", `${tag}: key "${k}" missing — a re-import may reset the stand's value or keep it; ship every key`);
  }
  for (const k of BO_KEYS_NEW) if (!(k in bo))
    add("WARN", "0.4", `${tag}: key "${k}" missing — a re-import of an existing BO resets it to the default`);
  // §2 «BO place in the sidebar»: orderIndex is the BO's place in its group; null/missing lands it on top,
  // and the template value is shared by every archive BO, so a drag between two of them is lost on reload
  if ("orderIndex" in bo && (bo.orderIndex === null || typeof bo.orderIndex !== "number"))
    add("ERROR", "0.4", `${tag}: orderIndex = ${JSON.stringify(bo.orderIndex)} — the BO lands with a null place on top of its group`);
  else if (bo.orderIndex === 47480000)
    add("WARN", "2", `${tag}: orderIndex 47480000 is the template value every archive BO shares — the user cannot drag this BO between two others with it; give it its own place`);
  const unknownBo = Object.keys(bo).filter(k => ![...BO_KEYS, ...BO_KEYS_NEW, ...BO_KEYS_OPTIONAL].includes(k));
  if (unknownBo.length) add("WARN", "0.4", `${tag}: keys not in the §0.4 template: ${unknownBo.join(", ")}`);

  // 0.14 / §2 «BO views»: every template is {kanbanFields: {...}}, and every DROPDOWN_SINGLE needs one —
  // without it the map, the kanban view and the kanban editor die with «cardTemplate is null»
  const kct = bo.kanbanCardTemplates;
  if (kct && typeof kct === "object") {
    for (const [code, t] of Object.entries<any>(kct)) {
      if (!t || typeof t.kanbanFields !== "object" || Array.isArray(t.kanbanFields))
        add("ERROR", "0.14", `${tag}: kanbanCardTemplates.${code} must be {"kanbanFields": {...}} — without the wrapper the import is APPLIED and sets nothing`);
      else for (const fc of Object.keys(t.kanbanFields))
        if (!bo.dynamicFields?.[fc] && !bo.nativeFields?.[fc])
          add("ERROR", "0.14", `${tag}: kanbanCardTemplates.${code} names ${fc}, not a field of this BO`);
    }
    if (bo.category === "BO" || bo.category === "BO_DICTIONARY")
      for (const [code, f] of Object.entries<any>(bo.dynamicFields ?? {}))
        if (f?.type === "DROPDOWN_SINGLE" && !kct[code])
          add("ERROR", "0.14", `${tag}: DROPDOWN_SINGLE ${code} has no kanbanCardTemplates entry — the BO's map and kanban die with «cardTemplate is null» once it has a record`);
  }
  if (bo.isGroupingEnabled === true)
    add("WARN", "2", `${tag}: isGroupingEnabled — the registry grouping view is 404 on the server (§2 «BO views»), it renders nothing`);

  // §2 «BO card tabs»: boTabs is a map TYPE → orderIndex; a re-import only adds and renumbers, never removes
  if (bo.boTabs !== undefined) {
    if (!bo.boTabs || typeof bo.boTabs !== "object" || Array.isArray(bo.boTabs))
      add("ERROR", "2", `${tag}: boTabs must be a map {"<TYPE>": <orderIndex>}, got ${JSON.stringify(bo.boTabs)}`);
    else {
      const nums = new Map<number, string>();
      for (const [type, n] of Object.entries(bo.boTabs)) {
        if (!BO_TAB_TYPES.has(type)) add("ERROR", "2", `${tag}: boTabs type "${type}" is not one of ${[...BO_TAB_TYPES].join("/")}`);
        if (typeof n !== "number") add("ERROR", "2", `${tag}: boTabs.${type} = ${JSON.stringify(n)}, expected an orderIndex number`);
        else if (nums.has(n)) add("WARN", "2", `${tag}: boTabs.${type} and boTabs.${nums.get(n)} share orderIndex ${n}`);
        else nums.set(n, type);
        if (type === "TELEGRAM" || type === "WHATSAPP")
          add("WARN", "2", `${tag}: boTabs.${type} imports unchecked and cannot be unticked in the constructor unless the company messenger lists this BO`);
      }
    }
  }
  // §2 «BO card tabs»: the Telegram / WhatsApp link field, by field code; a re-import without them keeps the stand's
  for (const k of ["messengerFieldCode", "whatsAppFieldCode"])
    if (bo[k] != null && !(bo.dynamicFields && bo[k] in bo.dynamicFields))
      add("WARN", "2", `${tag}: ${k} "${bo[k]}" is no dynamicFields code of this BO`);

  if (!CATEGORIES.has(bo.category)) add("FATAL", "0.17", `${tag}: category "${bo.category}" is not one of ${[...CATEGORIES].join("/")}`);
  if (groups.length && !groups.some(g => g.oldId === bo.boGroupOldId))
    add("FATAL", "0.9/8", `${tag}: boGroupOldId "${bo.boGroupOldId}" matches no group line oldId`);

  const code = String(bo.code ?? "");
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(code)) add("ERROR", "0.9/7", `${tag}: BO code "${code}" is not latin/digits/underscore`);
  if (code.length > 30) add("FATAL", "0.9/7", `${tag}: BO code is ${code.length} chars, max 30`);
  naming(tag, code, "object");
  if (["Person", "Department", "PersonGroup"].includes(code))
    add("FATAL", "0.2a", `${tag}: "${code}" is a reserved built-in code — import dies with «Несоответствие типов объектов»`);
  if (bo.name && typeof bo.name.rus !== "string") add("ERROR", "0.4", `${tag}: name is not {rus: "…"}`);

  // ------------------------------------------------ dynamicFields (§0.5, §0.9 rules 5, 12)
  const df = bo.dynamicFields;
  if (df === undefined) { add("ERROR", "0.4", `${tag}: no dynamicFields`); continue; }
  if (Array.isArray(df)) { add("FATAL", "0.9/5", `${tag}: dynamicFields is an ARRAY, must be an object keyed by field code`); continue; }

  const labels = new Set<string>();
  // The stacking rule is about the y values, not about the key order: a stand's own export lists the map
  // in any order, so the layout is checked in y order after the loop.
  const laid: { ft: string; f: any; gp: any; box?: boolean }[] = [];
  const entries = Object.entries(df as Record<string, any>);
  // The constructor allows ONE «Ключевое поле в IN-миграции» per BO; the importer was not seen to check it.
  const migrationKeys = entries.filter(([, f]) => f?.useAsKeyInMigration).map(([k]) => k);
  if (migrationKeys.length > 1)
    add("ERROR", "3", `${tag}: useAsKeyInMigration on ${migrationKeys.length} fields (${migrationKeys.join(", ")}) — the constructor allows one per BO`);
  for (const [key, f] of entries) {
    const ft = `${tag}.${key}`;
    if (f.code !== key) add("FATAL", "0.9/5", `${ft}: dynamicFields key "${key}" != field code "${f.code}"`);
    id(ft, f.newId);
    if ("oldId" in f && !("newId" in f)) add("ERROR", "0.7", `${ft}: field carries oldId; fields use newId`);
    if (f.archetype !== "DYNAMIC") add("ERROR", "0.5", `${ft}: archetype "${f.archetype}", a dynamicFields entry is DYNAMIC`);

    // §5b: a composite has no form, so its fields legitimately carry no layout keys
    // a process's PROCESS_STATUS and its BO-reference fields are exported without these (§5c, 2026-09-27)
    const processSkip = bo.category === "BO_PROCESS" && f.type === "BO"
      ? (key === "PROCESS_STATUS" ? PROCESS_STATUS_ABSENT_KEYS : new Set(["tableColOrderIndex"]))
      : EMPTY_SET;
    const skipKeys = bo.category === "BO_COMPOSITE" ? COMPOSITE_ABSENT_KEYS : processSkip;
    // A stand export leaves tableColOrderIndex off a field that is not ordered yet (one added through the
    // API) and the importer stores null — so its absence is only the form-order WARN below.
    for (const k of FIELD_KEYS) if (!(k in f) && !skipKeys.has(k) && k !== "tableColOrderIndex")
      add("ERROR", "0.5", `${ft}: key "${k}" missing from the field template`);
    const extra = Object.keys(f).filter(k => !FIELD_KEYS.includes(k) &&
      !["oldRefBoId", "viewType", "isHeightDynamic", "fieldOptionsStruct", "tableWidth", "defaultValue",
        "defaultValueMap", "trackedFieldCode", "tabCodePath", "maxLength", "copyFromFieldCode", "bracketFilter", "readFromRegistry", "titleOrderIndex"].includes(k));
    if (extra.length) add("WARN", "0.5", `${ft}: keys outside the template: ${extra.join(", ")}`);

    // «Поведение» (MYBPM-IMPORTS.md «Поведение» and «Интеграция» of a field): the stand keeps every
    // params value as a STRING, and each per-type key only means something on its own types.
    for (const [k, v] of Object.entries(f.params ?? {}))
      if (typeof v !== "string") add("WARN", "3", `${ft}: params.${k} is ${typeof v}; the stand stores params values as strings ("${v}")`);
    if (f.textCase && f.textCase !== "NONE" && f.type !== "INPUT_TEXT")
      add("WARN", "3", `${ft}: textCase on a ${f.type} — only INPUT_TEXT has it`);
    if (f.maxLength && !["INPUT_TEXT", "INPUT_TEXT_LANG", "INPUT_NUMBER", "TEXTAREA", "TEXTAREA_LANG"].includes(f.type))
      add("WARN", "3", `${ft}: maxLength on a ${f.type} — the constructor offers it only on text and number types`);
    if (f.type === "INPUT_NUMBER" && f.maxLength > 21)
      add("WARN", "3", `${ft}: maxLength ${f.maxLength} on a number — the constructor caps it at 21`);
    if (f.useAsKeyInMigration && !["INPUT_TEXT", "INPUT_EMAIL", "INPUT_PHONE"].includes(f.type))
      add("WARN", "3", `${ft}: useAsKeyInMigration on a ${f.type} — only INPUT_TEXT / INPUT_EMAIL / INPUT_PHONE have it`);

    // Per-type settings (MYBPM-IMPORTS.md §3 «Per-type settings»)
    if (f.params?.buttonTypes !== undefined) {
      let bt: unknown = null;
      try { bt = JSON.parse(f.params.buttonTypes); } catch { /* reported below */ }
      if (!["TEXTAREA", "TEXTAREA_LANG"].includes(f.type)) add("WARN", "3", `${ft}: params.buttonTypes on a ${f.type} — only TEXTAREA / TEXTAREA_LANG have an editor toolbar`);
      if (!Array.isArray(bt)) add("ERROR", "3", `${ft}: params.buttonTypes must be the JSON TEXT of an array ("[\\"bold\\",…]"), got ${JSON.stringify(f.params.buttonTypes)}`);
      else {
        const bad = bt.filter(b => !TEXTAREA_BUTTONS.has(b as string));
        if (bad.length) add("ERROR", "3", `${ft}: params.buttonTypes has unknown buttons ${bad.join(", ")} — allowed: ${[...TEXTAREA_BUTTONS].join(" ")}`);
      }
    }
    if (f.type === "CHECKLIST") {
      if (f.isSelectOnly === true && f.isAppendable === true)
        add("WARN", "3", `${ft}: isSelectOnly with isAppendable — the constructor allows only one of the two`);
      if (f.isRequiredAll === true)
        add("WARN", "3", `${ft}: isRequiredAll («Обязательны все пункты») is imported but nothing enforces it on this build — use isRequired or a script`);
    }
    if (f.type === "TAB_GROUP") {
      if (f.params?.showAsStepper === "true") add("WARN", "3", `${ft}: params.showAsStepper travels but changes nothing on a card on this build`);
      if (f.params?.needDisableTabs === "true" && Object.keys(f.fieldTabs ?? {}).length > 1)
        add("WARN", "3", `${ft}: params.needDisableTabs hides the strip of ${Object.keys(f.fieldTabs).length} tabs — the fields of the others cannot be reached; the constructor offers it only with one tab`);
    }
    if (f.isProgressBarSticky === true && f.type !== "PROGRESS_BAR")
      add("WARN", "3", `${ft}: isProgressBarSticky on a ${f.type} — only PROGRESS_BAR reads it (use needFreezeWhenScroll)`);

    const type = f.type;
    if (NOT_A_FIELD_TYPE.has(type))
      add("FATAL", "0.9/12", `${ft}: type "${type}" is not a dynamic field type (widget / native / invented) — wrong map`);
    else if (!FIELD_TYPES.has(type))
      add("FATAL", "0.5", `${ft}: type "${type}" is not in the field-type enum`);

    const c = String(f.code ?? "");
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(c)) add("ERROR", "0.9/7", `${ft}: field code "${c}" is not latin/digits/underscore`);
    if (c.length > 30) add("ERROR", "0.9/7", `${ft}: field code is ${c.length} chars, max 30`);
    const lab = f.label?.rus;
    // «Отслеживать статус» (§3 «Six more gear flags»): the constructor leaves its TAB_GROUP wrapper unlabelled
    const trackedWrapper = type === "TAB_GROUP" && !!f.trackedFieldCode;
    if (typeof lab !== "string" && !trackedWrapper) add("ERROR", "0.5", `${ft}: label is not {rus: "…"}`);
    else if (typeof lab !== "string") { /* the wrapper: no label, no code rule */ }
    else {
      if (lab !== lab.trimStart()) add("WARN", "0.5", `${ft}: label has a leading space`);
      // CODE / LABEL of a dictionary and PROCESS_STATUS are fixed by the platform (0.6a)
      if (!(bo.category === "BO_DICTIONARY" && (c === "CODE" || c === "LABEL")) && c !== "PROCESS_STATUS")
        naming(ft, c, type === "CHECKBOX" ? "checkbox" : type === "TAB_GROUP" ? "tabs" : "lower");
      if (labels.has(lab)) add("WARN", "0.5", `${ft}: label "${lab}" repeats inside the BO`);
      labels.add(lab);
    }

    if (f.isRequired === true && f.isReadonly === true)
      add("ERROR", "0.9/9", `${ft}: isRequired AND isReadonly — the record can never be saved`);

    // type-specific extras
    if (type === "DROPDOWN_SINGLE" || type === "RADIO_BUTTON_GROUP") {
      const fo = f.fieldOptionsStruct;
      if (!fo) add("ERROR", "0.5", `${ft}: ${type} without fieldOptionsStruct (§5)`);
      else if (fo.optionSource === "FROM_BO") {
        if (type === "RADIO_BUTTON_GROUP")
          add("ERROR", "3", `${ft}: a RADIO_BUTTON_GROUP cannot take a dictionary — the import drops it (refBoId null), the card shows no buttons, and the stand's re-export of the field crashes the analysis; use DROPDOWN_SINGLE or a local list (§3 «Единичный выбор»)`);
        if (!fo.dictionaryBoInfo?.code) add("ERROR", "5", `${ft}: FROM_BO without dictionaryBoInfo.code`);
        if (fo.dictionaryBoInfo?.boCategory && fo.dictionaryBoInfo.boCategory !== "BO_DICTIONARY")
          add("ERROR", "5", `${ft}: dictionaryBoInfo.boCategory = ${fo.dictionaryBoInfo.boCategory}, expected BO_DICTIONARY`);
        if (fo.dictionaryBoInfo?.oldRefBoId || fo.dictionaryBoInfo?.id)
          add("WARN", "5", `${ft}: a dictionary is named by CODE, not by id`);
      } else if (fo.optionSource === "FROM_FIELD") {
        const opts = fo.options ?? {};
        if (Array.isArray(opts)) add("ERROR", "5", `${ft}: options is an ARRAY, must be an object keyed by option code`);
        else if (f.trackedFieldCode) {
          // the «Статус» dropdown of «Отслеживать статус»: the card and the calendar key on these exact ids
          const keys = Object.keys(opts).sort().join(",");
          if (keys !== "CANCELED,DONE,OVERDUE,PLANNED")
            add("ERROR", "3", `${ft}: a tracked status dropdown needs exactly the options PLANNED, OVERDUE, DONE, CANCELED (got ${keys})`);
          // the KEY becomes the option id on import; newOptionId may be anything (a stand export has random ones)
        }
        else for (const [ok, ov] of Object.entries<any>(opts)) {
          if (!ov.fieldOption) add("ERROR", "5", `${ft}: option "${ok}" has no fieldOption`);
          else {
            if (typeof ov.fieldOption.label !== "string")
              add("ERROR", "5", `${ft}: option "${ok}" label must be a PLAIN STRING, got ${JSON.stringify(ov.fieldOption.label)}`);
            if (ov.fieldOption.code !== ok) add("ERROR", "5", `${ft}: option key "${ok}" != fieldOption.code "${ov.fieldOption.code}"`);
            naming(`${ft}.option`, ok, "lower");
          }
          id(`${ft}.option ${ok}`, ov.newOptionId);
        }
        // the import makes newOptionId the option's id and copies defaultValue verbatim (§3 «Единичный выбор»)
        if (!f.trackedFieldCode && f.defaultValue != null && f.defaultValue !== "" && !Array.isArray(opts)) {
          const byId = Object.entries<any>(opts).find(([, ov]) => ov.newOptionId === f.defaultValue);
          if (!byId) {
            const byCode = opts[f.defaultValue];
            add("ERROR", "3", `${ft}: defaultValue "${f.defaultValue}" is no option's newOptionId — the import copies it as is, so the default points at nothing${byCode ? ` (it is an option CODE; write ${byCode.newOptionId})` : " (a stand export writes the SOURCE stand's option id here — replace it with the newOptionId of the option meant)"}`);
          }
        }
      } else add("ERROR", "5", `${ft}: optionSource "${fo.optionSource}" is neither FROM_BO nor FROM_FIELD`);
    }
    if (type === "BO" || type === "CO") {
      const bi = f.boRefStruct?.boInfo;
      // a reference to a built-in BO is resolved by boInfo.code, so its oldRefBoId may be "" (§6 «Person reference»)
      const builtIn = ["Person", "Department", "PersonGroup"].includes(bi?.code);
      if (!f.oldRefBoId) { if (!builtIn) add("ERROR", "0.5", `${ft}: ${type} without oldRefBoId (the target's id ON THE STAND)`); }
      else if (!/^[A-Za-z0-9@~]{16}$/.test(String(f.oldRefBoId))) add("ERROR", "0.5", `${ft}: oldRefBoId "${f.oldRefBoId}" has the wrong shape`);
      if (!bi?.code) add("ERROR", "0.5", `${ft}: ${type} without boRefStruct.boInfo.code`);
      if (type === "CO" && bi && bi.boCategory !== "BO_COMPOSITE")
        add("ERROR", "0.5", `${ft}: CO boInfo.boCategory = ${bi.boCategory}, expected BO_COMPOSITE`);
      if (!f.viewType) add("WARN", "0.5", `${ft}: ${type} without viewType (TABLE/SINGLE)`);
      // 0.9 rule 15: a reference shows at least one field of its target (a panel widget: §5a check below;
      // a Person reference with {} is filled with Фамилия + Имя by the stand, 0.13)
      if (bo.category !== "BO_PANEL" && bi?.code !== "Person"
          && !Object.values<any>(f.boRefStruct?.fieldRefs ?? {}).some((r: any) => r?.toShow === true))
        add("ERROR", "0.9/15", `${ft}: boRefStruct.fieldRefs has no toShow: true — the reference renders an empty selector; list at least one field of ${bi?.code}`);
      // 0.5a: a table shows 2–5 columns chosen by meaning
      if (f.viewType === "TABLE" && bo.category !== "BO_PANEL" && bi?.code !== "Person") {
        const shown = Object.values<any>(f.boRefStruct?.fieldRefs ?? {}).filter((r: any) => r?.toShow === true).length;
        if (shown === 1) add("WARN", "0.5a", `${ft}: a TABLE showing one column — show 2–5 key fields of ${bi?.code}`);
      }
      checkRefSettings(bo, key, f, ft);
    } else {
      if (f.linkedCoSettings && Object.keys(f.linkedCoSettings).length)
        add("ERROR", "3", `${ft}: linkedCoSettings on a ${type} — only a CO field has them`);
      if (f.copyFromFieldCode) add("ERROR", "3", `${ft}: copyFromFieldCode on a ${type} — only BO / CO fields copy`);
    }
    if (f.isHistoryTracking === true && !(bo.boTabs && !Array.isArray(bo.boTabs) && "HISTORY" in bo.boTabs))
      add("WARN", "3", `${ft}: isHistoryTracking without the BO's boTabs.HISTORY — the change is never logged`);
    if (f.isHistoryTracking === true && type === "TAB_GROUP") add("WARN", "3", `${ft}: isHistoryTracking on a TAB_GROUP — the constructor never offers it`);
    // «Название записи» (§3 «Field flags»): the record name = display values of the titleToShow fields by titleOrderIndex
    if (f.titleToShow === true) {
      if (type === "TAB_GROUP") add("WARN", "3", `${ft}: titleToShow on a TAB_GROUP — the constructor never offers it`);
      if (typeof f.titleOrderIndex !== "number") add("WARN", "3", `${ft}: titleToShow without titleOrderIndex — the name parts have no defined order`);
      else {
        const same = [...Object.values<any>(bo.dynamicFields), ...Object.values<any>(bo.nativeFields ?? {})]
          .filter(g => g !== f && g.titleToShow === true && g.titleOrderIndex === f.titleOrderIndex);
        if (same.length) add("WARN", "3", `${ft}: titleOrderIndex ${f.titleOrderIndex} is shared with another titleToShow field`);
      }
    }
    if (f.needTrackStatus === true) {
      const all = Object.values<any>(bo.dynamicFields);
      const wrap = all.find(g => g.type === "TAB_GROUP" && g.trackedFieldCode === f.code);
      const status = all.find(g => g.type === "DROPDOWN_SINGLE" && g.trackedFieldCode === f.code);
      if (!wrap || !status)
        add("ERROR", "3", `${ft}: needTrackStatus without its TAB_GROUP wrapper and «Статус» dropdown (trackedFieldCode) — the flag alone does nothing`);
      else if (f.tabCodePath?.tabGroupCode !== wrap.code || status.tabCodePath?.tabGroupCode !== wrap.code)
        add("ERROR", "3", `${ft}: the tracked date and its «Статус» must sit in the wrapper's tab (tabCodePath.tabGroupCode = "${wrap.code}")`);
    }
    if (type === "STATIC_TEXT" && !f.staticValue?.rus) add("ERROR", "0.5", `${ft}: STATIC_TEXT without staticValue.rus`);
    for (const [k, q] of Object.entries<any>(f.questionnaires ?? {})) naming(`${ft}.questionnaire`, q?.questionnaireDto?.code ?? k, "lower");
    for (const st of Object.values<any>(f.progressSteps ?? {})) if (st?.code) naming(`${ft}.step`, st.code, "lower");
    if (type === "TAB_GROUP" && !trackedWrapper) for (const k of Object.keys(f.fieldTabs ?? {})) naming(`${ft}.tab`, k, "tab");
    if (type === "QUESTIONNAIRE" && !Object.keys(f.questionnaires ?? {}).length) add("ERROR", "0.5", `${ft}: QUESTIONNAIRE with empty questionnaires`);
    if (type === "PROGRESS_BAR" && !Object.keys(f.progressSteps ?? {}).length) add("ERROR", "0.5", `${ft}: PROGRESS_BAR with empty progressSteps`);
    if (type === "TAB_GROUP" && !Object.keys(f.fieldTabs ?? {}).length) add("ERROR", "0.5", `${ft}: TAB_GROUP with empty fieldTabs`);
    if (type === "FILE_UPLOAD") {
      // the display mode lives in params.viewType; the top-level viewType is ignored (UI-API §5i)
      const pv = f.params?.viewType;
      if (pv === undefined) add("WARN", "0.5", `${ft}: FILE_UPLOAD without params.viewType SINGLE/MULTIPLE/TILE`);
      else if (!["SINGLE", "MULTIPLE", "TILE"].includes(pv)) add("ERROR", "0.5", `${ft}: FILE_UPLOAD params.viewType "${pv}" is not SINGLE/MULTIPLE/TILE`);
      const ct = f.params?.contentType;
      if (ct === undefined) add("WARN", "0.5", `${ft}: FILE_UPLOAD without params.contentType ALL/FOR_CAMERA`);
      else if (!["ALL", "IMAGE", "DOCUMENT", "FOR_CAMERA"].includes(ct)) add("ERROR", "0.5", `${ft}: FILE_UPLOAD params.contentType "${ct}" is not ALL/IMAGE/DOCUMENT/FOR_CAMERA`);
    }

    // layout (§0.8) — a composite has no form at all (§5b)
    if (bo.category === "BO_COMPOSITE") {
      if (f.gridPosition && Object.keys(f.gridPosition).length)
        add("WARN", "5b", `${ft}: a composite has no form; gridPosition should be absent`);
      if (!Array.isArray(f.boFieldCodes) || f.boFieldCodes.length === 0)
        add("ERROR", "5b", `${ft}: a composite attribute needs boFieldCodes [{boCode, fieldCode}]`);
      else for (const l of f.boFieldCodes) {
        if (!l.boCode || !l.fieldCode) add("ERROR", "5b", `${ft}: boFieldCodes entry misses boCode/fieldCode`);
        else if (Array.isArray(bo.bos) && !bo.bos.some((s: any) => s.code === l.boCode))
          add("ERROR", "5b", `${ft}: boFieldCodes names "${l.boCode}" which is not declared in bos[]`);
      }
    } else if (f.tabCodePath?.tabGroupCode) {
      // a group with an empty code is exported with its id here and dropped itself (§0.5 TAB_GROUP)
      const grp = bo.dynamicFields?.[f.tabCodePath.tabGroupCode];
      if (grp?.type !== "TAB_GROUP") add("ERROR", "0.5", `${ft}: tabCodePath.tabGroupCode "${f.tabCodePath.tabGroupCode}" is not a TAB_GROUP of this BO`);
      else if (!(f.tabCodePath.tabCode in (grp.fieldTabs ?? {}))) add("ERROR", "0.5", `${ft}: tabCodePath.tabCode "${f.tabCodePath.tabCode}" is not a tab of ${f.tabCodePath.tabGroupCode}`);
      // a field inside a tab is laid out inside that tab (its own x/y from 0), not in the form's stack
      if (!f.gridPosition) add("ERROR", "0.8", `${ft}: no gridPosition`);
    } else if (bo.category === "BO_PROCESS" && key === "PROCESS_STATUS") {
      // the constructor's own 8×4 box: no x/cols/rows rule, but it takes its rows in the stack — the stand
      // exports it at y=0 with the fields below it, the generator puts it after them
      if (f.gridPosition) laid.push({ ft, f, gp: f.gridPosition, box: true });
    } else {
      const gp = f.gridPosition;
      if (!gp) add("ERROR", "0.8", `${ft}: no gridPosition`);
      else {
        // §0.8 / §0.8a: the heights that fit the content; a TAB_GROUP and a heading are checked below
        const single = (type === "BO" || type === "CO") && f.viewType === "SINGLE";
        const wantRows = trackedWrapper ? 4 : ROWS_3.has(type) || single ? 3 : ROWS_8.has(type) ? 8 : ROWS_6.has(type) ? 6 : null;
        if (wantRows !== null && gp.rows !== wantRows) add("WARN", "0.8", `${ft}: rows=${gp.rows}, a ${type} takes ${wantRows}`);
        laid.push({ ft, f, gp });
      }
    }
  }
  // 0.9 rule 15: every BO shows at least one registry column — without one the registry answers
  // AccessDenied and lists nothing (PROCESS_STATUS is a process's default column)
  if (bo.category !== "BO_COMPOSITE"
      && ![...Object.values<any>(bo.dynamicFields ?? {}), ...Object.values<any>(bo.nativeFields ?? {})].some((f: any) => f?.tableColToShow === true))
    add("ERROR", "0.9/15", `${tag}: no field has tableColToShow: true — the registry shows no column, answers AccessDenied and lists nothing`);
  // a native field placed on the form takes its rows in the same stack (a stand export: LAST_MODIFIED_AT at y=40)
  if (bo.nativeFields && !Array.isArray(bo.nativeFields) && bo.category !== "BO_COMPOSITE")
    for (const [k, n] of Object.entries<any>(bo.nativeFields))
      if (n?.gridPosition && typeof n.gridPosition.y === "number") laid.push({ ft: `${tag}.native ${k}`, f: n, gp: n.gridPosition, box: true });
  // so does every widget (§0.13) — a stand export with widgets between the fields has the gaps they fill; a widget
  // on a tab names it in `tabCode` (a field uses `tabCodePath`, which the import IGNORES on a widget) and is laid
  // out inside that tab, not in this stack
  if (bo.category !== "BO_COMPOSITE")
    for (const map of ["signatures", "buttons", "iframes", "captcha", "currentDates", "currentUser"])
      if (bo[map] && !Array.isArray(bo[map]))
        for (const [k, w] of Object.entries<any>(bo[map])) {
          const wt = `${tag}.${map}.${k}`;
          if (w?.tabCodePath)
            add("ERROR", "0.5", `${wt}: a widget names its tab in "tabCode", not "tabCodePath" — the import ignores tabCodePath and drops the widget out of the tab`);
          if (w?.tabCode?.tabGroupCode) {
            const grp = bo.dynamicFields?.[w.tabCode.tabGroupCode];
            if (grp?.type !== "TAB_GROUP") add("ERROR", "0.5", `${wt}: tabCode.tabGroupCode "${w.tabCode.tabGroupCode}" is not a TAB_GROUP of this BO`);
            else if (!(w.tabCode.tabCode in (grp.fieldTabs ?? {}))) add("ERROR", "0.5", `${wt}: tabCode.tabCode "${w.tabCode.tabCode}" is not a tab of ${w.tabCode.tabGroupCode}`);
          } else if (w?.gridPosition && typeof w.gridPosition.y === "number")
            laid.push({ ft: wt, f: w, gp: w.gridPosition, box: true });
        }
  // §0.8a: a heading needs 3 rows (2 scrolls inside itself) and no registry column; a TAB_GROUP = its tallest tab
  // + 3 on the form, + 2 when it sits on a tab of another group — one row less scrolls inside the group
  if (bo.category !== "BO_COMPOSITE") for (const [, f] of entries) {
    const ft = `${tag}.${f.code}`;
    if (f.type === "STATIC_TEXT") {
      if (typeof f.gridPosition?.rows === "number" && f.gridPosition.rows < 3)
        add("WARN", "0.8a", `${ft}: a heading of ${f.gridPosition.rows} rows scrolls inside itself — 3 rows`);
      if (f.tableColToShow === true) add("WARN", "0.8a", `${ft}: a heading with tableColToShow: true is an empty registry column`);
    }
    if (f.type === "TAB_GROUP" && !f.trackedFieldCode && typeof f.gridPosition?.rows === "number") {
      const tallest = Math.max(0, ...entries.filter(([, g]) => g.tabCodePath?.tabGroupCode === f.code && g.gridPosition)
        .map(([, g]) => g.gridPosition.y + g.gridPosition.rows));
      const need = tallest + (f.tabCodePath?.tabGroupCode ? 2 : 3);
      if (tallest && f.gridPosition.rows < need)
        add("WARN", "0.8a", `${ft}: rows=${f.gridPosition.rows}, its tallest tab is ${tallest} rows — the group scrolls inside itself; give it ${need}`);
      else if (tallest && f.gridPosition.rows > need + 2)
        add("WARN", "0.8a", `${ft}: rows=${f.gridPosition.rows}, its tallest tab needs only ${need} — an empty band under every tab`);
    }
  }
  // §0.8a step 7: the record window — h = form rows + 5, or the dialog scrolls (FORM only; a dictionary has none)
  if (bo.category !== "BO_COMPOSITE" && bo.category !== "BO_DICTIONARY" && bo.instanceViewType !== "TAB") {
    const formRows = Math.max(0, ...laid.map(l => l.gp.y + l.gp.rows));
    const win = bo.gridLayoutPosition;
    if (!win) add("WARN", "0.8a", `${tag}: no gridLayoutPosition — the record dialog opens at 90 % × 90 % of the screen; give it h = ${formRows + 5}`);
    else if (typeof win.h === "number" && win.h < formRows + 5)
      add("WARN", "0.8a", `${tag}: gridLayoutPosition.h=${win.h} for ${formRows} form rows — the window scrolls; h = ${formRows + 5}${formRows + 5 > 28 ? " (over ~28 does not fit a 1080p screen: split into tabs or instanceViewType TAB)" : ""}`);
  }
  // §0.8: rows — the cells of one row share y and rows, x runs 0, 0 + cols …, cols sum to 15; next y = y + rows
  const rowsByY = new Map<number, typeof laid>();
  for (const l of laid) rowsByY.set(l.gp.y, [...(rowsByY.get(l.gp.y) ?? []), l]);
  let prevY: number | null = null, prevRows = 0, shared = 0, oneLine = 0;
  for (const y of [...rowsByY.keys()].sort((a, b) => a - b)) {
    const row = rowsByY.get(y)!.sort((a, b) => (a.gp.x ?? 0) - (b.gp.x ?? 0));
    const ft = row[0].ft;
    if (prevY !== null && y !== prevY + prevRows)
      add("ERROR", "0.8", `${ft}: y=${y}, expected ${prevY + prevRows} (previous row y ${prevY} + its rows ${prevRows})`);
    if (prevY === null && y !== 0) add("ERROR", "0.8", `${ft}: the first field must start at y=0, got ${y}`);
    const heights = new Set(row.map(l => l.gp.rows));
    if (heights.size > 1)
      add("WARN", "0.8", `${row.map(l => l.ft).join(" + ")}: one row of y=${y} mixes heights ${[...heights].join("/")} — the next row floats into the hole under the short cell; pair only equal rows`);
    const cells = row.filter(l => !l.box);
    if (cells.length > 1) {
      shared++;
      for (const l of cells) if (FULL_WIDTH.has(l.f.type) || l.f.viewType === "TABLE")
        add("WARN", "0.8", `${l.ft}: a ${l.f.viewType === "TABLE" ? "TABLE" : l.f.type} shares row y=${y} — it stands alone, full width`);
    }
    if (cells.length && cells.length === row.length) {
      let x = 0;
      for (const l of cells) {
        if ((l.gp.x ?? 0) < x) add("ERROR", "0.8", `${l.ft}: x=${l.gp.x} overlaps the cell before it in row y=${y} (free from x=${x})`);
        else if ((l.gp.x ?? 0) > x) add("WARN", "0.8", `${l.ft}: x=${l.gp.x} leaves a gap in row y=${y} (expected x=${x})`);
        x = (l.gp.x ?? 0) + (l.gp.cols ?? 0);
      }
      if (x !== 15) add("WARN", "0.8", `${ft}: row y=${y} spans ${x} of 15 columns — the cols of a row sum to 15`);
      if (cells.length === 1 && ROWS_3.has(cells[0].f.type)) oneLine++;
    }
    prevY = y; prevRows = Math.max(...heights);
  }
  // §0.8: short one-line fields share rows — a form of nothing but full-width fields is a defect
  if (bo.category !== "BO_DICTIONARY" && bo.category !== "BO_COMPOSITE" && shared === 0 && oneLine >= 6)
    add("WARN", "0.8", `${tag}: ${oneLine} one-line fields, each alone at full width — put short fields that belong together 2–3 per row`);
  // 0.5: tableColOrderIndex is a counter — the values form 0, 1, 2 … n-1, no duplicates, no gaps. Not checked
  // against y: a progress bar or a tab group on top of the form (y 0) may stand after the name field, and a
  // stand export lists the map in any order
  if (bo.category !== "BO_COMPOSITE") {
    const counted = entries.filter(([, f]) => !f?.trackedFieldCode && !(bo.category === "BO_PROCESS" && f?.type === "BO"));
    const got = counted.map(([, f]) => f?.tableColOrderIndex).filter((v) => typeof v === "number").sort((x, y) => x - y);
    if (got.some((v, i) => v !== i))
      add("WARN", "0.5", `${tag}: tableColOrderIndex values [${got.join(",")}] are not the counter 0..${counted.length - 1} (one per dynamicFields entry)`);
  }

  // STATIC_TEXT heading must not repeat ANOTHER field's label (§0.5, §0.9 rule 12).
  // Its OWN label normally equals the heading — that is what a real export looks like, not a defect.
  for (const [, f] of entries) {
    if (f.type === "STATIC_TEXT") {
      const text = String(f.staticValue?.rus ?? "").replace(/<[^>]*>/g, "").trim();
      const clash = entries.some(([, g]) => g !== f && String(g.label?.rus ?? "").trim() === text);
      if (text && clash) add("WARN", "0.5", `${tag}: STATIC_TEXT heading "${text}" repeats ANOTHER field's label — breaks Excel import`);
    }
  }

  // ------------------------------------------------ nativeFields (§0.12)
  const nf = bo.nativeFields;
  if (nf && !Array.isArray(nf)) for (const [key, n] of Object.entries<any>(nf)) {
    const ft = `${tag}.native ${key}`;
    if (!(key in NATIVE_TYPES)) add("ERROR", "0.12", `${ft}: "${key}" is not a creatable native type (${Object.keys(NATIVE_TYPES).join("/")})`);
    if (n.nativeFieldId !== key) add("ERROR", "0.12", `${ft}: nativeFields key != nativeFieldId "${n.nativeFieldId}"`);
    if (n.archetype !== "NATIVE") add("ERROR", "0.12", `${ft}: archetype "${n.archetype}", must be NATIVE`);
    if (key in NATIVE_TYPES && n.type !== NATIVE_TYPES[key]) add("ERROR", "0.12", `${ft}: type "${n.type}", the platform fixes ${NATIVE_TYPES[key]}`);
    id(ft, n.newId);
    // verified on <stand> 2026-10-01: the import applies chosenAccessRight but never the native's rights
    if (n.chosenAccessRight === true) add("WARN", "0.12", `${ft}: chosenAccessRight on a native — the import shows the orange lock but does not apply its rights; set them over the API after the import`);
    for (const k of ["needUploadToOutTable", "needLoadFromInTables"]) if (n[k] === true) add("WARN", "0.12", `${ft}: ${k} on a native is not applied by the import`);
    if (n.inMigrationTimezoneMinutes) add("WARN", "0.12", `${ft}: inMigrationTimezoneMinutes on a native is never stored`);
  }

  // ------------------------------------------------ widgets (§0.13)
  for (const [map, types] of Object.entries(WIDGET_MAPS)) {
    const w = bo[map];
    if (!w || Array.isArray(w)) continue;
    for (const [key, v] of Object.entries<any>(w)) {
      const ft = `${tag}.${map}.${key}`;
      if (v.code !== key) add("ERROR", "0.13", `${ft}: widget map key != code "${v.code}"`);
      naming(ft, key, "lower");
      if (!types.includes(v.type)) add("ERROR", "0.13", `${ft}: type "${v.type}" does not belong in "${map}" (${types.join("/")})`);
      id(ft, v.newId);
      if (!v.gridPosition) add("WARN", "0.13", `${ft}: widget without gridPosition`);
      if (v.type === "BUTTON" && v.url === undefined) add("WARN", "0.13", `${ft}: BUTTON without url`);
      if (v.type === "IFRAME" && v.url === undefined) add("WARN", "0.13", `${ft}: IFRAME without url`);
      if (v.type === "BUTTON" && typeof v.url === "string" && v.url.trim()) {
        // what each url does on the record card was clicked through on <stand>, 2026-10-01
        if (/^(client\/)?(save-current-boi|create-boi\/)/.test(v.url))
          add("WARN", "0.13", `${ft}: url "${v.url}" does nothing on the record card — leave url empty and put the logic into the button's field script`);
        else if (!v.url.startsWith("call/plugin/"))
          add("WARN", "0.13", `${ft}: url "${v.url}" does nothing — a button never navigates; only empty (script) or call/plugin/<server plugin> act`);
      }
      if (v.type === "BUTTON" && v.fieldCodes && typeof v.fieldCodes === "object") {
        const known = new Set([...Object.keys(bo.dynamicFields ?? {}), ...Object.keys(bo.nativeFields ?? {})]);
        for (const c of Object.keys(v.fieldCodes))
          if (!known.has(c)) add("ERROR", "0.13", `${ft}: fieldCodes names "${c}", no field of this BO has that code`);
      }
      if (v.type === "SIGNATURE") {
        // round-tripped on <stand> 2026-10-01: everything by CODE; printFormCodes / massPrintFormCodes values are 1
        const dyn = bo.dynamicFields ?? {};
        for (const c of Object.keys(v.fieldCodes ?? {}))
          if (!(c in dyn)) add("ERROR", "0.13", `${ft}: fieldCodes names "${c}", no dynamic field of this BO has that code`);
        for (const c of Object.keys(v.massFieldCodes ?? {})) {
          if (!(c in dyn)) add("ERROR", "0.13", `${ft}: massFieldCodes names "${c}", no dynamic field of this BO has that code`);
          else if (dyn[c].type !== "BO") add("ERROR", "0.13", `${ft}: massFieldCodes "${c}" is ${dyn[c].type} — mass signing goes through a BO field`);
        }
        if (v.signingPhoneCode != null) {
          if (!(v.signingPhoneCode in dyn)) add("ERROR", "0.13", `${ft}: signingPhoneCode "${v.signingPhoneCode}" is not a field of this BO`);
          else if (dyn[v.signingPhoneCode].type !== "INPUT_PHONE") add("ERROR", "0.13", `${ft}: signingPhoneCode "${v.signingPhoneCode}" is ${dyn[v.signingPhoneCode].type}, the stand offers only INPUT_PHONE fields`);
        }
        const pfCodes = new Set((bo.printForms ?? []).map((f: any) => f.printFormCode));
        for (const c of Object.keys(v.printFormCodes ?? {}))
          if (!pfCodes.has(c)) add("ERROR", "0.13", `${ft}: printFormCodes names "${c}", not a printForms[].printFormCode of this BO`);
        if (Object.keys(v.massPrintFormCodes ?? {}).length)
          add("WARN", "0.13", `${ft}: massPrintFormCodes did NOT survive an import on <stand> (2026-10-01) — check it on the stand after applying`);
      }
      if (WIDGET_MAPS.currentDates.includes(v.type) && v.widgetType !== v.type)
        // <stand> 2026-10-01: a stand export and the generator both carry widgetType = type in currentDates
        add("ERROR", "0.13", `${ft}: widgetType "${v.widgetType}" must repeat type "${v.type}"`);
      if (v.type === "CAPTCHA")
        // <stand> 2026-10-01: both record-API cycles answer CaptchaNotVerified for a changed or new record
        add("WARN", "0.13", `${ft}: a CAPTCHA makes the server refuse every save that changes a record until a person solves it — no record API, no headless client`);
      if (v.type === "IFRAME" && typeof v.url === "string" && /^http:/i.test(v.url))
        add("ERROR", "0.13", `${ft}: http: url — the stand silently drops it, the iframe keeps no url; use https:`);
      if (v.type === "CURRENT_USER") {
        // round-tripped on <stand> 2026-10-01: TABLE/SINGLE only; fieldRefs keyed by «Пользователи» field CODES
        if (v.viewType !== undefined && v.viewType !== "TABLE" && v.viewType !== "SINGLE")
          add("ERROR", "0.13", `${ft}: viewType "${v.viewType}" — CURRENT_USER takes only TABLE or SINGLE`);
        const refs = v.fieldRefs ?? {};
        if (typeof refs !== "object" || Array.isArray(refs)) add("ERROR", "0.13", `${ft}: fieldRefs must be a map {<Person field code>: {toShow, orderIndex}}`);
        else {
          for (const [c, r] of Object.entries<any>(refs))
            if (typeof r?.toShow !== "boolean") add("ERROR", "0.13", `${ft}: fieldRefs.${c}.toShow must be true/false`);
          const vals = Object.values<any>(refs);
          if (vals.length && !vals.some((r) => r?.toShow === true))
            add("WARN", "0.13", `${ft}: fieldRefs hides every column — leave it {} for the default «Фамилия» + «Имя»`);
        }
      }
    }
    if (map === "currentUser" && Object.keys(w).length > 1)
      add("ERROR", "0.13", `${tag}.${map}: ${Object.keys(w).length} CURRENT_USER widgets — the platform allows one per BO`);
  }

  // ------------------------------------------------ print forms (§0.13 «Print forms»)
  const files = new Set(objs.filter((o) => cls(o) === "ExportStructFileDto").map((o) => o.fileId));
  for (const [i, f] of (Array.isArray(bo.printForms) ? bo.printForms : []).entries()) {
    const pt = `${tag}.printForms[${i}]`;
    if (!f.printFormCode) add("ERROR", "0.13", `${pt}: no printFormCode`);
    if (f.fileType !== "PDF" && f.fileType !== "DOCX") add("ERROR", "0.13", `${pt}: fileType "${f.fileType}", must be PDF or DOCX`);
    if (!files.has(f.fileId)) add("ERROR", "0.13", `${pt}: no ExportStructFileDto line with fileId "${f.fileId}" — the template .docx travels in the archive`);
    id(pt, f.newId);
  }

  // ------------------------------------------------ per-category (§0.17)
  if (bo.category === "BO_DICTIONARY") {
    const dfk = bo.dictionaryFields;
    if (JSON.stringify(dfk) !== JSON.stringify(["CODE", "LABEL"]))
      add("ERROR", "0.17", `${tag}: dictionaryFields = ${JSON.stringify(dfk)}, must be ["CODE","LABEL"]`);
    const keys = entries.map(([k]) => k);
    if (keys[0] !== "code" || keys[1] !== "label")
      add("ERROR", "0.17", `${tag}: a dictionary must START with the system fields code, label — got ${keys.slice(0, 2).join(", ")}`);
    const cf = df.code, lf = df.label;
    // 0.9 rule 18: both system fields are mandatory on every dictionary
    if (!cf) add("ERROR", "0.9/18", `${tag}: a dictionary without the required system field "code" — every dictionary has code + label`);
    if (!lf) add("ERROR", "0.9/18", `${tag}: a dictionary without the required system field "label" — every dictionary has code + label`);
    if (cf) {
      if (cf.type !== "INPUT_TEXT") add("ERROR", "0.17", `${tag}: dictionary "code" type ${cf.type}, must be INPUT_TEXT`);
      if (cf.isUnique !== true || cf.isRequired !== true) add("ERROR", "0.17", `${tag}: dictionary "code" must be isUnique+isRequired`);
      if (cf.isSystem !== true) add("ERROR", "0.17", `${tag}: dictionary "code" must be isSystem: true`);
    }
    if (lf) {
      if (lf.type !== "INPUT_TEXT_LANG") add("ERROR", "0.17", `${tag}: dictionary "label" type ${lf.type}, must be INPUT_TEXT_LANG`);
      if (lf.isRequired !== true) add("ERROR", "0.17", `${tag}: dictionary "label" must be isRequired`);
      if (lf.isSystem !== true) add("ERROR", "0.17", `${tag}: dictionary "label" must be isSystem: true`);
    }
  }
  if (bo.category === "BO_PANEL") {
    for (const [key, f] of entries) {
      if (f.type !== "BO") { add("ERROR", "5a", `${tag}.${key}: a panel holds only type "BO" registry widgets, got ${f.type}`); continue; }
      // readFromRegistry: absent/null/true = the whole registry, false = a picked list kept in the panel record
      if ("readFromRegistry" in f && f.readFromRegistry !== null && typeof f.readFromRegistry !== "boolean")
        add("ERROR", "5a", `${tag}.${key}: readFromRegistry must be true, false or absent, got ${JSON.stringify(f.readFromRegistry)}`);
      if (f.readFromRegistry === false) {
        if (f.isReadonly === true) add("WARN", "5a", `${tag}.${key}: readFromRegistry false with isReadonly true — the picked list cannot be filled`);
      } else if (f.isReadonly !== true) add("WARN", "5a", `${tag}.${key}: a registry widget of a panel carries isReadonly: true`);
      if (!Object.values(f.boRefStruct?.fieldRefs ?? {}).some((r: any) => r?.toShow === true))
        add("WARN", "5a", `${tag}.${key}: no boRefStruct.fieldRefs entry with toShow: true — the widget renders without columns, empty`);
      if (f.isKindAddForSelect !== true) add("WARN", "5a", `${tag}.${key}: a panel widget carries isKindAddForSelect: true`);
    }
  }
  if (bo.category === "BO_COMPOSITE") {
    if (!Array.isArray(bo.bos) || bo.bos.length === 0)
      add("ERROR", "5b", `${tag}: a composite must list its source BOs in bos: [{code,name,boCategory}]`);
    else for (const s of bo.bos) if (!s.code) add("ERROR", "5b", `${tag}: a bos[] entry has no code`);
  }
  if (bo.category === "BO_PROCESS") {
    const pv = objs.filter(o => cls(o) === "BoProcessVersionsStructDto" && o.oldId === bo.oldId);
    if (pv.length === 0)
      add("FATAL", "5c", `${tag}: a BO_PROCESS needs a BoProcessVersionsStructDto line whose oldId == the BO's oldId`);
    else {
      // the diagram lives in workProcess (what a generator writes; imported as the WORK version) or, in
      // an export of a test version, under processVersions.<version id> — check every one present
      const diagrams: [string, any][] = [
        ...(pv[0].workProcess ? [["workProcess", pv[0].workProcess] as [string, any]] : []),
        ...Object.entries<any>(pv[0].processVersions ?? {}).map(([v, d]) => [`processVersions.${v}`, d] as [string, any]),
      ];
      if (!diagrams.length) add("ERROR", "5c", `${tag}: neither workProcess nor processVersions carries a diagram`);
      else if (!pv[0].workProcess)
        add("WARN", "5c", `${tag}: only processVersions — imports as a TEST-only version (DEV records only); move the diagram to workProcess to run on ordinary records`);
      for (const [where, wp] of diagrams) {
        const dt = `${tag} ${where}`;
        if (!wp?.figureStructs || !Object.keys(wp.figureStructs).length) { add("ERROR", "5c", `${dt}: no figureStructs`); continue; }
        const figType = (fig: any) => String(fig["@class"] ?? "").match(/\.Figure(\w+)Struct$/)?.[1];
        for (const [fid, fig] of Object.entries<any>(wp.figureStructs)) {
          const t = figType(fig);
          if (!t) { add("ERROR", "5c", `${dt}: figure ${fid} has no Figure<Type>Struct "@class"`); continue; }
          if (t === "Form") {
            const target = fig.fieldCode ? (df as any)[fig.fieldCode] : undefined;
            if (!fig.fieldCode) add("WARN", "5c", `${dt}: Form ${fid} has no fieldCode — the step has no record to show`);
            else if (!target || target.type !== "BO")
              add("ERROR", "5c", `${dt}: Form ${fid}.fieldCode "${fig.fieldCode}" is not a BO-reference field of this process`);
          }
          if (t === "Timer") {
            const target = fig.fieldCode ? (df as any)[fig.fieldCode] : undefined;
            if (!fig.fieldCode) add("WARN", "5c", `${dt}: Timer ${fid} has no fieldCode — it passes at once`);
            else if (!target || !["FULL_DATE", "DATE"].includes(target.type))
              add("ERROR", "5c", `${dt}: Timer ${fid}.fieldCode "${fig.fieldCode}" is not a date field of this process`);
            else if (fig.archetype !== "DYNAMIC")
              add("WARN", "5c", `${dt}: Timer ${fid} has no archetype "DYNAMIC" (what exports write for a dynamic field)`);
          }
          if ((t === "Script" || t === "Switch") &&
              !objs.some(o => cls(o) === "ScriptDefStructDto" && String(o.compositeId).endsWith(`-${fid}`)))
            add("ERROR", "5c", `${dt}: ${t} ${fid} has no ScriptDefStructDto "<version>-${fid}" — the import and validate-def stay silent, but on a record the figure FAILS «Скрипт не определен» and the process stops there`);
        }
        const arrows = wp.arrows ?? {};
        if (!wp.arrows) add("WARN", "5c", `${dt}: no arrows`);
        for (const [aid, a] of Object.entries<any>(arrows)) {
          for (const k of ["startFigureId", "finishFigureId"]) {
            if (!a[k]) { add("ERROR", "5c", `${dt}: arrow ${aid} misses ${k}`); continue; }
            if (!(a[k] in wp.figureStructs)) add("ERROR", "5c", `${dt}: arrow ${aid}.${k} points at "${a[k]}", not a declared figure`);
          }
          if (figType(wp.figureStructs[a.startFigureId] ?? {}) === "Switch" && !a.name)
            add("ERROR", "5c", `${dt}: arrow ${aid} leaves a Switch without a name — validation fails`);
        }
        for (const sid of wp.scriptsDefIds ?? []) {
          const def = objs.find(o => cls(o) === "ScriptDefStructDto" && o.compositeId === sid);
          if (!def) { add("ERROR", "5c", `${dt}: scriptsDefIds names "${sid}", no ScriptDefStructDto has that compositeId`); continue; }
          for (const [bid, blk] of Object.entries<any>(def.blocks ?? {}))
            if (blk.targetArrowId && !(blk.targetArrowId in arrows))
              add("ERROR", "5d", `${dt}: script ${sid} block ${bid} exits by arrow "${blk.targetArrowId}", not an arrow of this diagram`);
        }
      }
    }
    const ps = (df as any).PROCESS_STATUS;
    // 0.9 rule 18: every business process carries PROCESS_STATUS — never ship one without it
    if (!ps) add("ERROR", "0.9/18", `${tag}: no PROCESS_STATUS — every business process has the required «Статус процесса» field; ship it (§5c); its ids are resolved by code, mint them (0.2a)`);
    else if (ps.isRequired !== true || ps.isSystem !== true || ps.type !== "BO")
      add("ERROR", "0.9/18", `${tag}: PROCESS_STATUS must be the system field — type BO, isSystem: true, isRequired: true (§5c)`);
    if (ps && (!ps.defaultValue || ps.defaultValue === "[]"))
      add("ERROR", "5c", `${tag}: PROCESS_STATUS has no defaultValue (the stand's CREATED row) — required and empty, every record is refused on save; the export's DEFAULT_VALUE line alone does NOT set it`);
    const code = (bo as any).code;
    if (ps && !objs.some(o => cls(o) === "ExportStructInstanceDto" && (o.sources ?? []).some((x: any) =>
        x.sourceType === "DEFAULT_VALUE" && x.defaultValueInstanceSource?.boCode === code &&
        x.defaultValueInstanceSource?.fieldCode === "PROCESS_STATUS")))
      add("ERROR", "5c", `${tag}: no ExportStructInstanceDto with a DEFAULT_VALUE source for PROCESS_STATUS — without that line the field's defaultValue does not take and every record is refused on save`);
  }
}

// process lines without a BO
for (const pv of objs.filter(o => cls(o) === "BoProcessVersionsStructDto"))
  if (!bos.some(b => b.oldId === pv.oldId))
    add("FATAL", "5c", `BoProcessVersionsStructDto oldId "${pv.oldId}" matches no BoStructDto`);

// ---------------------------------------------------------------- sidebar menu items (§0.15, §0.9 rule 14)
const MENU_KEYS = ["@class", "menuItemCode", "menuItemName", "parentMenuItemCode", "boCode", "boName",
  "iconName", "orderIndex", "boPages", "chosenAccessRight", "needCountMenuItem", "isPanel",
  "needHideInMobApp", "bracketFilter", "menuItemType"];
const MENU_REQUIRED = ["menuItemCode", "menuItemName", "iconName", "orderIndex", "chosenAccessRight",
  "needCountMenuItem", "isPanel", "needHideInMobApp", "menuItemType"];
const BO_PAGES_KEYS = ["isKanbanEnabled", "kanbanIndex", "isCalendarEnabled", "calendarIndex",
  "isTimelineEnabled", "timelineIndex", "isListEnabled", "listIndex", "isMapEnabled", "mapIndex",
  "isGroupingEnabled", "groupingIndex"];

// 0.16: the icon catalogue, pulled off a stand's frontend by tools/menu-icons.bun.ts
const MENU_ICON_DEFAULTS = ["bo-g-draggable", "man-with-company", "bo-d-draggable"];
const iconFile = Bun.file(`${import.meta.dir}/menu-icons.json`);
const iconCat = await iconFile.exists() ? await iconFile.json() : null;
const MENU_ICONS: Set<string> | null = iconCat
  ? new Set([...MENU_ICON_DEFAULTS, ...iconCat.tabs.flatMap((t: any) => t.names), ...iconCat.offPicker])
  : null;

const menuByCode = new Map<string, any>();
for (const m of menus) {
  const c = String(m.menuItemCode ?? "");
  if (menuByCode.has(c)) add("ERROR", "0.15", `menu code "${c}" repeats — the stand addresses menu items by code`);
  menuByCode.set(c, m);
}
menus.forEach(m => {
  const tag = `menu ${m.menuItemCode ?? "?"}`;
  for (const k of MENU_REQUIRED) if (!(k in m)) add("ERROR", "0.15", `${tag}: key "${k}" missing`);
  const unknown = Object.keys(m).filter(k => !MENU_KEYS.includes(k));
  if (unknown.length) add("WARN", "0.15", `${tag}: keys not in the §0.15 template: ${unknown.join(", ")}`);
  for (const k of ["id", "oldId", "newId", "menuItemId", "parentId", "boId"])
    if (k in m) add("ERROR", "0.9/14", `${tag}: carries "${k}" — a menu line references everything by CODE and has no id`);
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(String(m.menuItemCode ?? "")))
    add("ERROR", "0.15", `${tag}: menuItemCode is not latin/digits/underscore`);
  else naming(tag, String(m.menuItemCode), "object");
  if (MENU_ICONS && m.iconName !== undefined && !MENU_ICONS.has(String(m.iconName)))
    add("ERROR", "0.16", `${tag}: iconName "${m.iconName}" is not in the icon catalogue — it imports, but the sidebar draws no icon`);
  if (MENU_ICON_DEFAULTS.includes(String(m.iconName)))
    add("WARN", "0.5d", `${tag}: iconName "${m.iconName}" is the generic default — pick an icon by the item's meaning from 0.5d «Icons by meaning» / 0.16`);
  if (m.chosenAccessRight === true)
    add("WARN", "5e", `${tag}: chosenAccessRight true — whether menu access rights travel in an archive is [U]`);

  const type = m.menuItemType;
  if (type !== "GROUP" && type !== "BO") {
    add("ERROR", "5e", `${tag}: menuItemType "${type}" — only GROUP and BO were ever imported`);
    return;
  }

  // the parent: a GROUP of this archive (listed earlier), else a stand code the user must have given
  if (m.parentMenuItemCode !== undefined) {
    const parent = menuByCode.get(String(m.parentMenuItemCode));
    if (!parent)
      add("WARN", "0.15", `${tag}: parent "${m.parentMenuItemCode}" is not in this archive — it must be a GROUP code taken off the stand, never a guess`);
    else if (parent.menuItemType !== "GROUP")
      add("ERROR", "0.15", `${tag}: parent "${m.parentMenuItemCode}" is a ${parent.menuItemType} item, not a GROUP`);
    else if (menus.indexOf(parent) > menus.indexOf(m))
      add("WARN", "0.15", `${tag}: listed BEFORE its group — the order proved on import is group first`);
  }

  if (type === "GROUP") {
    for (const k of ["boPages", "bracketFilter", "boCode", "boName"])
      if (k in m) add("ERROR", "0.9/14", `${tag}: a GROUP line carries "${k}" — the stand exports a group without it`);
    return;
  }

  // type BO
  for (const k of ["boCode", "boName", "boPages", "bracketFilter"])
    if (!(k in m)) add("ERROR", "0.9/14", `${tag}: a BO line needs "${k}"`);
  const bo = boByCode.get(String(m.boCode));
  if (m.boCode !== undefined && !bo)
    add("WARN", "0.15", `${tag}: boCode "${m.boCode}" is not a BO of this archive — it must already be on the stand`);
  const bf = m.bracketFilter;
  if (bf) {
    if (bf.boCode !== m.boCode) add("ERROR", "0.15", `${tag}: bracketFilter.boCode "${bf.boCode}" != boCode "${m.boCode}"`);
    if (bf.type !== "MENU_ITEM") add("ERROR", "0.15", `${tag}: bracketFilter.type "${bf.type}", must be MENU_ITEM`);
    if (Array.isArray(bf.brackets))
      add("ERROR", "5e", `${tag}: bracketFilter.brackets is an ARRAY (the API shape) — in an archive it is a map keyed by 8-char ids`);
    else if (bf.brackets && Object.keys(bf.brackets).length)
      add("WARN", "5e", `${tag}: a non-empty record filter — importing one was never tried [U]`);
  }
  const bp = m.boPages;
  if (!bp) return;
  for (const k of BO_PAGES_KEYS) if (!(k in bp)) add("ERROR", "0.15", `${tag}: boPages.${k} missing`);
  if ("kanbanFieldId" in bp)
    add("ERROR", "0.9/14", `${tag}: boPages.kanbanFieldId is the API key — an archive takes kanbanFieldCode`);
  if (bp.isKanbanEnabled && !bp.kanbanFieldCode)
    add("ERROR", "0.15", `${tag}: kanban enabled without boPages.kanbanFieldCode — no columns`);
  if (!bp.isKanbanEnabled && bp.kanbanFieldCode)
    add("WARN", "0.15", `${tag}: kanbanFieldCode "${bp.kanbanFieldCode}" but isKanbanEnabled is false`);
  if (bp.isKanbanEnabled && bp.kanbanFieldCode && bo) {
    const f = bo.dynamicFields?.[bp.kanbanFieldCode];
    if (!f) add("ERROR", "0.15", `${tag}: kanbanFieldCode "${bp.kanbanFieldCode}" is not a field of BO ${bo.code}`);
    else if (f.type !== "DROPDOWN_SINGLE")
      add("ERROR", "0.15", `${tag}: kanbanFieldCode "${bp.kanbanFieldCode}" is ${f.type}, the columns need a DROPDOWN_SINGLE`);
    if (!bo.kanbanCardTemplates?.[bp.kanbanFieldCode])
      add("ERROR", "0.14", `${tag}: BO ${bo.code} has no kanbanCardTemplates.${bp.kanbanFieldCode} — the board dies with «cardTemplate is null»`);
  }
  for (const k of ["isCalendarEnabled", "isTimelineEnabled", "isMapEnabled", "isGroupingEnabled"])
    if (bp[k]) add("WARN", "0.15", `${tag}: boPages.${k} — only the list and kanban views were ever shipped, what this one needs is [U]`);
  const on = BO_PAGES_KEYS.filter(k => k.startsWith("is") && bp[k]).map(k => bp[k.slice(2, 3).toLowerCase() + k.slice(3, -"Enabled".length) + "Index"]);
  if (new Set(on).size !== on.length || on.some(v => !(v >= 1)))
    add("WARN", "0.15", `${tag}: the *Index of the enabled views should be distinct and 1-based, got ${JSON.stringify(on)}`);
});

// ---------------------------------------------------------------- report
function report() {
  const counts = { FATAL: 0, ERROR: 0, WARN: 0 } as Record<Sev, number>;
  for (const f of found) counts[f.sev]++;
  if (asJson) {
    console.log(JSON.stringify({ file, lines: nLines, counts, findings: found }, null, 2));
    return;
  }
  console.log(`\n=== ${file}`);
  console.log(`lines: ${nLines}  |  FATAL ${counts.FATAL}  ERROR ${counts.ERROR}  WARN ${counts.WARN}`);
  for (const sev of ["FATAL", "ERROR", "WARN"] as Sev[])
    for (const f of found.filter(x => x.sev === sev)) console.log(`  [${sev}] §${f.rule}  ${f.msg}`);
  if (!found.length) console.log("  clean — every §0 rule this validator knows about holds");
}
report();
process.exit(found.some(f => f.sev === "FATAL") ? 1 : 0);
