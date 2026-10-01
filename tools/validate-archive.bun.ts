#!/usr/bin/env bun
/**
 * Validator for a `.mybpm.zip` structure archive — checks it against the RULES OF §0 of
 * `MYBPM-IMPORTS.md` and nothing else. Written to grade archives produced by a model that was given
 * only that document, so every rule below quotes the section it comes from.
 *
 * Severity:
 *   FATAL — the import is expected to fail outright (§0.10)
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

// §0.5 "Cell heights the constructor itself assigns"
const ROWS_6 = new Set(["BO", "CO", "LINK", "FILE_UPLOAD", "CHECKLIST", "RADIO_BUTTON_GROUP", "PROGRESS_BAR"]);
const ROWS_8 = new Set(["STATIC_TEXT", "QUESTIONNAIRE", "TAB_GROUP", "GEO_POINT"]);
// the text editor's toolbar buttons a TEXTAREA's params.buttonTypes may list (client enum, 2026-10-01)
const TEXTAREA_BUTTONS = new Set(["style", "bold", "underline", "italic", "fontsize", "color", "ul", "ol", "paragraph",
  "table", "link", "picture", "video", "hr", "codeview", "height"]);

// §0.4 — the full key set of BoStructDto
const BO_KEYS = ["@class", "oldId", "code", "category", "kind", "boGroupOldId", "instanceViewType",
  "bos", "boTabs", "printForms", "name", "recordName", "staticValue", "description", "orderIndex",
  "dynamicFields", "nativeFields", "dictionaryFields", "actual", "isCalendarEnabled", "isMapEnabled",
  "isGroupingEnabled", "isCodeReadonly", "chosenAccessRight", "kanbanCardTemplates", "timelineTemplates",
  "calendarCardTemplates", "signatures", "buttons", "iframes", "currentDates", "captcha", "currentUser"];

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

// §0.6 transliteration table («ё» is not in the stand's table — it falls through to «_»)
const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z", и: "i", й: "yi",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};
function translit(label: string): string {
  let out = "";
  for (const ch of label) {
    const lower = ch.toLowerCase();
    let mapped: string;
    if (lower in TRANSLIT) mapped = TRANSLIT[lower];
    else if (/[a-z0-9]/.test(lower)) mapped = lower;
    else mapped = "_";
    if (mapped && ch !== lower && /[а-яёa-z]/.test(lower)) mapped = mapped[0].toUpperCase() + mapped.slice(1);
    out += mapped;
  }
  return out.slice(0, 30);
}

type Sev = "FATAL" | "ERROR" | "WARN";
const found: { sev: Sev; rule: string; msg: string }[] = [];
let nLines = 0;
const add = (sev: Sev, rule: string, msg: string) => found.push({ sev, rule, msg });

const file = Bun.argv[2];
const asJson = Bun.argv.includes("--json");
if (!file) { console.error("usage: validate-archive.bun.ts <file.mybpm.zip>"); process.exit(2); }

// ---------------------------------------------------------------- zip layout (§0.1, §0.11)
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

// ---------------------------------------------------------------- metadata (§0.10 rule 2)
const rawLines = payload.split("\n");
const jsonLines = rawLines.filter(l => l.trim() !== "");
nLines = jsonLines.length;
if (payload && !payload.endsWith("\n")) add("ERROR", "0.10/3", "payload has no final newline");
if (payload.endsWith("\n\n")) add("WARN", "0.10/3", "payload ends with a blank line");
if (metaName) {
  const m = /^objectCount-(\d+)$/.exec(meta.trim());
  if (!m) add("FATAL", "0.10/2", `metadata.mybpm is ${JSON.stringify(meta)}, expected "objectCount-<N>"`);
  else {
    if (meta !== meta.trim()) add("WARN", "0.1", "metadata.mybpm carries trailing whitespace/newline");
    if (Number(m[1]) !== jsonLines.length)
      add("FATAL", "0.10/2", `objectCount-${m[1]} but the payload has ${jsonLines.length} lines`);
  }
}

// ---------------------------------------------------------------- JSONL (§0.10 rule 3)
const objs: any[] = [];
jsonLines.forEach((line, i) => {
  try {
    const o = JSON.parse(line);
    objs.push(o);
    if (typeof o !== "object" || o === null || Array.isArray(o))
      add("FATAL", "0.10/3", `line ${i + 1} is not a JSON object`);
    const minified = JSON.stringify(o);
    if (line.length > minified.length + 2 && /:\s|,\s/.test(line))
      add("WARN", "0.10/3", `line ${i + 1} looks pretty-printed / padded (${line.length} vs ${minified.length} chars minified)`);
  } catch (e) {
    add("FATAL", "0.10/3", `line ${i + 1} does not parse as JSON: ${(e as Error).message}`);
  }
});
if (payload.trim().startsWith("[")) add("FATAL", "0.10/3", "payload is a JSON array, must be JSONL");

// ---------------------------------------------------------------- @class (§0.10 rule 4)
objs.forEach((o, i) => {
  if (!o["@class"]) add("FATAL", "0.10/4", `line ${i + 1} has no "@class"`);
  else if (!String(o["@class"]).startsWith(PKG) && !String(o["@class"]).startsWith("kz.greetgo.mybpm.reg.structure.model."))
    add("FATAL", "0.10/4", `line ${i + 1} "@class" = ${o["@class"]}, must start with ${PKG}`);
});
const cls = (o: any) => String(o?.["@class"] ?? "").split(".").pop();
const menus = objs.filter(o => cls(o) === "MenuItemStructDto");
// §5e: a menu line may point at a BO already on the stand, so an archive of menu lines alone is
// legal — imported 2026-09-22. It only needs every boCode to exist on the stand, which we cannot see.
const menuOnly = menus.length > 0 && !objs.some(o => cls(o) === "BoStructDto");

// ---------------------------------------------------------------- groups (§0.3, §0.10 rule 1)
const groups = objs.filter(o => cls(o) === "BoGroupStructDto");
if (groups.length === 0 && !menuOnly) add("FATAL", "0.3", "no BoGroupStructDto line");
const groupCodes = new Set<string>();
for (const g of groups) {
  // §0.3: groups are matched BY code; a line without one renames a fixed stand group (§8)
  if (typeof g.code !== "string" || !g.code)
    add("FATAL", "0.10/1", `group "${g.name}" has no code — the importer renames a fixed stand group instead (§8)`);
  else if (groupCodes.has(g.code)) add("ERROR", "0.3", `group code "${g.code}" repeats`);
  else groupCodes.add(g.code);
  if (g.kind !== "MANUAL") add("ERROR", "0.3", `group kind is ${g.kind}, must be MANUAL`);
  if (!ID_RE.test(String(g.oldId))) add("ERROR", "0.7", `group oldId "${g.oldId}" is not 16 chars over A-Za-z0-9@~`);
  if (!g.newId) add("WARN", "0.3", "group has no newId");
  if (typeof g.name !== "string" || !g.name) add("FATAL", "0.3", "group has no name");
}

for (const o of objs) if (cls(o) === "AccessStructDto")
  for (const k of Object.keys(o.fieldAccessStructMap ?? {})) if (k in NATIVE_TYPES)
    add("WARN", "0.5a", `AccessStructDto: the lock of native ${k} is ignored by the import — set it over the API after the import`);
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
if (objs.some(o => cls(o) === "AccessStructDto"))
  add("ERROR", "0.10/10", "archive ships an AccessStructDto — import replaces the stand's rights with the archive's; never ship one unasked");

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
if (bos.length === 0 && !menuOnly) add("FATAL", "0.4", "no BoStructDto line");
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
    add("ERROR", "0.4", `${tag}: key "${k}" missing — import MERGES, a missing key keeps the stand's old value`);
  }
  const unknownBo = Object.keys(bo).filter(k => !BO_KEYS.includes(k));
  if (unknownBo.length) add("WARN", "0.4", `${tag}: keys not in the §0.4 template: ${unknownBo.join(", ")}`);

  if (!CATEGORIES.has(bo.category)) add("FATAL", "0.9", `${tag}: category "${bo.category}" is not one of ${[...CATEGORIES].join("/")}`);
  if (groups.length && !groups.some(g => g.oldId === bo.boGroupOldId))
    add("FATAL", "0.10/8", `${tag}: boGroupOldId "${bo.boGroupOldId}" matches no group line oldId`);

  const code = String(bo.code ?? "");
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(code)) add("ERROR", "0.10/7", `${tag}: BO code "${code}" is not latin/digits/underscore`);
  if (code.length > 30) add("FATAL", "0.10/7", `${tag}: BO code is ${code.length} chars, max 30`);
  if (["Person", "Department", "PersonGroup"].includes(code))
    add("FATAL", "0.2a", `${tag}: "${code}" is a reserved built-in code — import dies with «Несоответствие типов объектов»`);
  if (bo.name && typeof bo.name.rus !== "string") add("ERROR", "0.4", `${tag}: name is not {rus: "…"}`);

  // ------------------------------------------------ dynamicFields (§0.5, §0.10 rules 5, 12)
  const df = bo.dynamicFields;
  if (df === undefined) { add("ERROR", "0.4", `${tag}: no dynamicFields`); continue; }
  if (Array.isArray(df)) { add("FATAL", "0.10/5", `${tag}: dynamicFields is an ARRAY, must be an object keyed by field code`); continue; }

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
    if (f.code !== key) add("FATAL", "0.10/5", `${ft}: dynamicFields key "${key}" != field code "${f.code}"`);
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
      add("FATAL", "0.10/12", `${ft}: type "${type}" is not a dynamic field type (widget / native / invented) — wrong map`);
    else if (!FIELD_TYPES.has(type))
      add("FATAL", "0.5", `${ft}: type "${type}" is not in the field-type enum`);

    const c = String(f.code ?? "");
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(c)) add("ERROR", "0.10/7", `${ft}: field code "${c}" is not latin/digits/underscore`);
    if (c.length > 30) add("ERROR", "0.10/7", `${ft}: field code is ${c.length} chars, max 30`);
    const lab = f.label?.rus;
    // «Отслеживать статус» (§3 «Six more gear flags»): the constructor leaves its TAB_GROUP wrapper unlabelled
    const trackedWrapper = type === "TAB_GROUP" && !!f.trackedFieldCode;
    if (typeof lab !== "string" && !trackedWrapper) add("ERROR", "0.5", `${ft}: label is not {rus: "…"}`);
    else if (typeof lab !== "string") { /* the wrapper: no label, no code rule */ }
    else {
      if (lab !== lab.trimStart()) add("WARN", "0.5", `${ft}: label has a leading space`);
      const want = translit(lab);
      if (want !== c && !c.startsWith(want) && bo.category !== "BO_DICTIONARY" && c !== "PROCESS_STATUS")
        add("WARN", "0.6", `${ft}: code "${c}" != transliteration of "${lab}" ("${want}")`);
      if (labels.has(lab)) add("WARN", "0.5", `${ft}: label "${lab}" repeats inside the BO`);
      labels.add(lab);
    }

    if (f.isRequired === true && f.isReadonly === true)
      add("ERROR", "0.10/9", `${ft}: isRequired AND isReadonly — the record can never be saved`);

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
      if (!f.oldRefBoId) add("ERROR", "0.5", `${ft}: ${type} without oldRefBoId (the target's id ON THE STAND)`);
      else if (!/^[A-Za-z0-9@~]{16}$/.test(String(f.oldRefBoId))) add("ERROR", "0.5", `${ft}: oldRefBoId "${f.oldRefBoId}" has the wrong shape`);
      const bi = f.boRefStruct?.boInfo;
      if (!bi?.code) add("ERROR", "0.5", `${ft}: ${type} without boRefStruct.boInfo.code`);
      if (type === "CO" && bi && bi.boCategory !== "BO_COMPOSITE")
        add("ERROR", "0.5", `${ft}: CO boInfo.boCategory = ${bi.boCategory}, expected BO_COMPOSITE`);
      if (!f.viewType) add("WARN", "0.5", `${ft}: ${type} without viewType (TABLE/SINGLE)`);
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
    if (type === "QUESTIONNAIRE" && !Object.keys(f.questionnaires ?? {}).length) add("ERROR", "0.5", `${ft}: QUESTIONNAIRE with empty questionnaires`);
    if (type === "PROGRESS_BAR" && !Object.keys(f.progressSteps ?? {}).length) add("ERROR", "0.5", `${ft}: PROGRESS_BAR with empty progressSteps`);
    if (type === "TAB_GROUP" && !Object.keys(f.fieldTabs ?? {}).length) add("ERROR", "0.5", `${ft}: TAB_GROUP with empty fieldTabs`);
    if (type === "FILE_UPLOAD") {
      if (!f.viewType) add("WARN", "0.5", `${ft}: FILE_UPLOAD without viewType SINGLE/MULTIPLE`);
      if (!f.params?.contentType) add("WARN", "0.5", `${ft}: FILE_UPLOAD without params.contentType ALL/FOR_CAMERA`);
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
        if (gp.x !== 0) add("WARN", "0.8", `${ft}: x=${gp.x}; the safe layout is x=0, cols=15`);
        if (gp.cols !== 15) add("WARN", "0.8", `${ft}: cols=${gp.cols}; the safe layout is cols=15`);
        const wantRows = trackedWrapper ? 4 : ROWS_8.has(type) ? 8 : ROWS_6.has(type) ? 6 : 4;
        if (gp.rows !== wantRows) add("WARN", "0.8", `${ft}: rows=${gp.rows}, the constructor gives ${wantRows} to ${type}`);
        laid.push({ ft, f, gp });
      }
    }
  }
  // a native field placed on the form takes its rows in the same stack (a stand export: LAST_MODIFIED_AT at y=40)
  if (bo.nativeFields && !Array.isArray(bo.nativeFields) && bo.category !== "BO_COMPOSITE")
    for (const [k, n] of Object.entries<any>(bo.nativeFields))
      if (n?.gridPosition && typeof n.gridPosition.y === "number") laid.push({ ft: `${tag}.native ${k}`, f: n, gp: n.gridPosition, box: true });
  // so does every widget (§0.5b) — a stand export with widgets between the fields has the gaps they fill
  if (bo.category !== "BO_COMPOSITE")
    for (const map of ["signatures", "buttons", "iframes", "captcha", "currentDates", "currentUser"])
      if (bo[map] && !Array.isArray(bo[map]))
        for (const [k, w] of Object.entries<any>(bo[map]))
          if (w?.gridPosition && typeof w.gridPosition.y === "number" && !w.tabCodePath?.tabGroupCode)
            laid.push({ ft: `${tag}.${map}.${k}`, f: w, gp: w.gridPosition, box: true });
  laid.sort((a, b) => a.gp.y - b.gp.y);
  let prevY: number | null = null, prevRows = 0;
  let idx = 0;
  for (const { ft, f, gp, box } of laid) {
    if (prevY !== null && gp.y !== prevY + prevRows)
      add("ERROR", "0.8", `${ft}: y=${gp.y}, expected ${prevY + prevRows} (previous y ${prevY} + previous rows ${prevRows})`);
    if (prevY === null && gp.y !== 0) add("ERROR", "0.8", `${ft}: the first field must start at y=0, got ${gp.y}`);
    prevY = gp.y; prevRows = gp.rows;
    if (box || f.trackedFieldCode) continue;
    if (!(bo.category === "BO_PROCESS" && f.type === "BO") && f.tableColOrderIndex !== idx) add("WARN", "0.5", `${ft}: tableColOrderIndex=${f.tableColOrderIndex}, expected ${idx} (form order)`);
    idx++;
  }

  // STATIC_TEXT heading must not repeat ANOTHER field's label (§0.5, §0.10 rule 12).
  // Its OWN label normally equals the heading — that is what a real export looks like, not a defect.
  for (const [, f] of entries) {
    if (f.type === "STATIC_TEXT") {
      const text = String(f.staticValue?.rus ?? "").replace(/<[^>]*>/g, "").trim();
      const clash = entries.some(([, g]) => g !== f && String(g.label?.rus ?? "").trim() === text);
      if (text && clash) add("WARN", "0.5", `${tag}: STATIC_TEXT heading "${text}" repeats ANOTHER field's label — breaks Excel import`);
    }
  }

  // ------------------------------------------------ nativeFields (§0.5a)
  const nf = bo.nativeFields;
  if (nf && !Array.isArray(nf)) for (const [key, n] of Object.entries<any>(nf)) {
    const ft = `${tag}.native ${key}`;
    if (!(key in NATIVE_TYPES)) add("ERROR", "0.5a", `${ft}: "${key}" is not a creatable native type (${Object.keys(NATIVE_TYPES).join("/")})`);
    if (n.nativeFieldId !== key) add("ERROR", "0.5a", `${ft}: nativeFields key != nativeFieldId "${n.nativeFieldId}"`);
    if (n.archetype !== "NATIVE") add("ERROR", "0.5a", `${ft}: archetype "${n.archetype}", must be NATIVE`);
    if (key in NATIVE_TYPES && n.type !== NATIVE_TYPES[key]) add("ERROR", "0.5a", `${ft}: type "${n.type}", the platform fixes ${NATIVE_TYPES[key]}`);
    id(ft, n.newId);
    // verified on core2 2026-10-01: the import applies chosenAccessRight but never the native's rights
    if (n.chosenAccessRight === true) add("WARN", "0.5a", `${ft}: chosenAccessRight on a native — the import shows the orange lock but does not apply its rights; set them over the API after the import`);
    for (const k of ["needUploadToOutTable", "needLoadFromInTables"]) if (n[k] === true) add("WARN", "0.5a", `${ft}: ${k} on a native is not applied by the import`);
    if (n.inMigrationTimezoneMinutes) add("WARN", "0.5a", `${ft}: inMigrationTimezoneMinutes on a native is never stored`);
  }

  // ------------------------------------------------ widgets (§0.5b)
  for (const [map, types] of Object.entries(WIDGET_MAPS)) {
    const w = bo[map];
    if (!w || Array.isArray(w)) continue;
    for (const [key, v] of Object.entries<any>(w)) {
      const ft = `${tag}.${map}.${key}`;
      if (v.code !== key) add("ERROR", "0.5b", `${ft}: widget map key != code "${v.code}"`);
      if (!types.includes(v.type)) add("ERROR", "0.5b", `${ft}: type "${v.type}" does not belong in "${map}" (${types.join("/")})`);
      id(ft, v.newId);
      if (!v.gridPosition) add("WARN", "0.5b", `${ft}: widget without gridPosition`);
      if (v.type === "BUTTON" && v.url === undefined) add("WARN", "0.5b", `${ft}: BUTTON without url`);
      if (v.type === "IFRAME" && v.url === undefined) add("WARN", "0.5b", `${ft}: IFRAME without url`);
      if (v.type === "BUTTON" && typeof v.url === "string" && v.url.trim()) {
        // what each url does on the record card was clicked through on core2, 2026-10-01
        if (/^(client\/)?(save-current-boi|create-boi\/)/.test(v.url))
          add("WARN", "0.5b", `${ft}: url "${v.url}" does nothing on the record card — leave url empty and put the logic into the button's field script`);
        else if (!v.url.startsWith("call/plugin/"))
          add("WARN", "0.5b", `${ft}: url "${v.url}" does nothing — a button never navigates; only empty (script) or call/plugin/<server plugin> act`);
      }
      if (v.type === "BUTTON" && v.fieldCodes && typeof v.fieldCodes === "object") {
        const known = new Set([...Object.keys(bo.dynamicFields ?? {}), ...Object.keys(bo.nativeFields ?? {})]);
        for (const c of Object.keys(v.fieldCodes))
          if (!known.has(c)) add("ERROR", "0.5b", `${ft}: fieldCodes names "${c}", no field of this BO has that code`);
      }
      if (v.type === "SIGNATURE") {
        // round-tripped on core2 2026-10-01: everything by CODE; printFormCodes / massPrintFormCodes values are 1
        const dyn = bo.dynamicFields ?? {};
        for (const c of Object.keys(v.fieldCodes ?? {}))
          if (!(c in dyn)) add("ERROR", "0.5b", `${ft}: fieldCodes names "${c}", no dynamic field of this BO has that code`);
        for (const c of Object.keys(v.massFieldCodes ?? {})) {
          if (!(c in dyn)) add("ERROR", "0.5b", `${ft}: massFieldCodes names "${c}", no dynamic field of this BO has that code`);
          else if (dyn[c].type !== "BO") add("ERROR", "0.5b", `${ft}: massFieldCodes "${c}" is ${dyn[c].type} — mass signing goes through a BO field`);
        }
        if (v.signingPhoneCode != null) {
          if (!(v.signingPhoneCode in dyn)) add("ERROR", "0.5b", `${ft}: signingPhoneCode "${v.signingPhoneCode}" is not a field of this BO`);
          else if (dyn[v.signingPhoneCode].type !== "INPUT_PHONE") add("ERROR", "0.5b", `${ft}: signingPhoneCode "${v.signingPhoneCode}" is ${dyn[v.signingPhoneCode].type}, the stand offers only INPUT_PHONE fields`);
        }
        const pfCodes = new Set((bo.printForms ?? []).map((f: any) => f.printFormCode));
        for (const c of Object.keys(v.printFormCodes ?? {}))
          if (!pfCodes.has(c)) add("ERROR", "0.5b", `${ft}: printFormCodes names "${c}", not a printForms[].printFormCode of this BO`);
        if (Object.keys(v.massPrintFormCodes ?? {}).length)
          add("WARN", "0.5b", `${ft}: massPrintFormCodes did NOT survive an import on core2 (2026-10-01) — check it on the stand after applying`);
      }
      if (WIDGET_MAPS.currentDates.includes(v.type) && v.widgetType !== v.type)
        // core2 2026-10-01: a stand export and the generator both carry widgetType = type in currentDates
        add("ERROR", "0.5b", `${ft}: widgetType "${v.widgetType}" must repeat type "${v.type}"`);
      if (v.type === "CAPTCHA")
        // core2 2026-10-01: both record-API cycles answer CaptchaNotVerified for a changed or new record
        add("WARN", "0.5b", `${ft}: a CAPTCHA makes the server refuse every save that changes a record until a person solves it — no record API, no headless client`);
      if (v.type === "IFRAME" && typeof v.url === "string" && /^http:/i.test(v.url))
        add("ERROR", "0.5b", `${ft}: http: url — the stand silently drops it, the iframe keeps no url; use https:`);
      if (v.type === "CURRENT_USER") {
        // round-tripped on core2 2026-10-01: TABLE/SINGLE only; fieldRefs keyed by «Пользователи» field CODES
        if (v.viewType !== undefined && v.viewType !== "TABLE" && v.viewType !== "SINGLE")
          add("ERROR", "0.5b", `${ft}: viewType "${v.viewType}" — CURRENT_USER takes only TABLE or SINGLE`);
        const refs = v.fieldRefs ?? {};
        if (typeof refs !== "object" || Array.isArray(refs)) add("ERROR", "0.5b", `${ft}: fieldRefs must be a map {<Person field code>: {toShow, orderIndex}}`);
        else {
          for (const [c, r] of Object.entries<any>(refs))
            if (typeof r?.toShow !== "boolean") add("ERROR", "0.5b", `${ft}: fieldRefs.${c}.toShow must be true/false`);
          const vals = Object.values<any>(refs);
          if (vals.length && !vals.some((r) => r?.toShow === true))
            add("WARN", "0.5b", `${ft}: fieldRefs hides every column — leave it {} for the default «Фамилия» + «Имя»`);
        }
      }
    }
    if (map === "currentUser" && Object.keys(w).length > 1)
      add("ERROR", "0.5b", `${tag}.${map}: ${Object.keys(w).length} CURRENT_USER widgets — the platform allows one per BO`);
  }

  // ------------------------------------------------ print forms (§0.5b «Print forms»)
  const files = new Set(objs.filter((o) => cls(o) === "ExportStructFileDto").map((o) => o.fileId));
  for (const [i, f] of (Array.isArray(bo.printForms) ? bo.printForms : []).entries()) {
    const pt = `${tag}.printForms[${i}]`;
    if (!f.printFormCode) add("ERROR", "0.5b", `${pt}: no printFormCode`);
    if (f.fileType !== "PDF" && f.fileType !== "DOCX") add("ERROR", "0.5b", `${pt}: fileType "${f.fileType}", must be PDF or DOCX`);
    if (!files.has(f.fileId)) add("ERROR", "0.5b", `${pt}: no ExportStructFileDto line with fileId "${f.fileId}" — the template .docx travels in the archive`);
    id(pt, f.newId);
  }

  // ------------------------------------------------ per-category (§0.9)
  if (bo.category === "BO_DICTIONARY") {
    const dfk = bo.dictionaryFields;
    if (JSON.stringify(dfk) !== JSON.stringify(["CODE", "LABEL"]))
      add("ERROR", "0.9", `${tag}: dictionaryFields = ${JSON.stringify(dfk)}, must be ["CODE","LABEL"]`);
    const keys = entries.map(([k]) => k);
    if (keys[0] !== "code" || keys[1] !== "label")
      add("ERROR", "0.9", `${tag}: a dictionary must START with the system fields code, label — got ${keys.slice(0, 2).join(", ")}`);
    const cf = df.code, lf = df.label;
    if (cf) {
      if (cf.type !== "INPUT_TEXT") add("ERROR", "0.9", `${tag}: dictionary "code" type ${cf.type}, must be INPUT_TEXT`);
      if (cf.isUnique !== true || cf.isRequired !== true) add("ERROR", "0.9", `${tag}: dictionary "code" must be isUnique+isRequired`);
      if (cf.isSystem !== true) add("ERROR", "0.9", `${tag}: dictionary "code" must be isSystem: true`);
    }
    if (lf) {
      if (lf.type !== "INPUT_TEXT_LANG") add("ERROR", "0.9", `${tag}: dictionary "label" type ${lf.type}, must be INPUT_TEXT_LANG`);
      if (lf.isRequired !== true) add("ERROR", "0.9", `${tag}: dictionary "label" must be isRequired`);
      if (lf.isSystem !== true) add("ERROR", "0.9", `${tag}: dictionary "label" must be isSystem: true`);
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
    if (ps && (!ps.defaultValue || ps.defaultValue === "[]"))
      add("ERROR", "5c", `${tag}: PROCESS_STATUS has no defaultValue (the stand's CREATED row) — required and empty, every record is refused on save; the export's DEFAULT_VALUE line alone does NOT set it`);
    const code = (bo as any).code;
    if (ps && !objs.some(o => cls(o) === "ExportStructInstanceDto" && (o.sources ?? []).some((x: any) =>
        x.sourceType === "DEFAULT_VALUE" && x.defaultValueInstanceSource?.boCode === code &&
        x.defaultValueInstanceSource?.fieldCode === "PROCESS_STATUS")))
      add("ERROR", "5c", `${tag}: no ExportStructInstanceDto with a DEFAULT_VALUE source for PROCESS_STATUS — without that line the field's defaultValue does not take and every record is refused on save`);
    const hasStatus = Object.keys(df).some(k => k === "PROCESS_STATUS") ||
      Object.values<any>(df).some(f => f.boRefStruct?.boInfo?.code === "PROCESS_STATUS");
    // §0.9: shipping the process WITHOUT PROCESS_STATUS is the prescribed answer when the
    // stand's «Статус процесса» id was not supplied — so this is a WARN, not an ERROR.
    if (!hasStatus) add("WARN", "5c/0.9", `${tag}: no PROCESS_STATUS — the process still runs, but records get no «Статус процесса»; legal only if the stand's dictionary id was unavailable, and it must be said out loud`);
  }
}

// process lines without a BO
for (const pv of objs.filter(o => cls(o) === "BoProcessVersionsStructDto"))
  if (!bos.some(b => b.oldId === pv.oldId))
    add("FATAL", "5c", `BoProcessVersionsStructDto oldId "${pv.oldId}" matches no BoStructDto`);

// ---------------------------------------------------------------- sidebar menu items (§0.5d, §0.10 rule 14)
const MENU_KEYS = ["@class", "menuItemCode", "menuItemName", "parentMenuItemCode", "boCode", "boName",
  "iconName", "orderIndex", "boPages", "chosenAccessRight", "needCountMenuItem", "isPanel",
  "needHideInMobApp", "bracketFilter", "menuItemType"];
const MENU_REQUIRED = ["menuItemCode", "menuItemName", "iconName", "orderIndex", "chosenAccessRight",
  "needCountMenuItem", "isPanel", "needHideInMobApp", "menuItemType"];
const BO_PAGES_KEYS = ["isKanbanEnabled", "kanbanIndex", "isCalendarEnabled", "calendarIndex",
  "isTimelineEnabled", "timelineIndex", "isListEnabled", "listIndex", "isMapEnabled", "mapIndex",
  "isGroupingEnabled", "groupingIndex"];

// 0.5e: the icon catalogue, pulled off a stand's frontend by tools/menu-icons.bun.ts
const MENU_ICON_DEFAULTS = ["bo-g-draggable", "man-with-company", "bo-d-draggable"];
const iconFile = Bun.file(`${import.meta.dir}/menu-icons.json`);
const iconCat = await iconFile.exists() ? await iconFile.json() : null;
const MENU_ICONS: Set<string> | null = iconCat
  ? new Set([...MENU_ICON_DEFAULTS, ...iconCat.tabs.flatMap((t: any) => t.names), ...iconCat.offPicker])
  : null;

const menuByCode = new Map<string, any>();
for (const m of menus) {
  const c = String(m.menuItemCode ?? "");
  if (menuByCode.has(c)) add("ERROR", "0.5d", `menu code "${c}" repeats — the stand addresses menu items by code`);
  menuByCode.set(c, m);
}
menus.forEach(m => {
  const tag = `menu ${m.menuItemCode ?? "?"}`;
  for (const k of MENU_REQUIRED) if (!(k in m)) add("ERROR", "0.5d", `${tag}: key "${k}" missing`);
  const unknown = Object.keys(m).filter(k => !MENU_KEYS.includes(k));
  if (unknown.length) add("WARN", "0.5d", `${tag}: keys not in the §0.5d template: ${unknown.join(", ")}`);
  for (const k of ["id", "oldId", "newId", "menuItemId", "parentId", "boId"])
    if (k in m) add("ERROR", "0.10/14", `${tag}: carries "${k}" — a menu line references everything by CODE and has no id`);
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(String(m.menuItemCode ?? "")))
    add("ERROR", "0.5d", `${tag}: menuItemCode is not latin/digits/underscore`);
  if (MENU_ICONS && m.iconName !== undefined && !MENU_ICONS.has(String(m.iconName)))
    add("ERROR", "0.5e", `${tag}: iconName "${m.iconName}" is not in the icon catalogue — it imports, but the sidebar draws no icon`);
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
      add("WARN", "0.5d", `${tag}: parent "${m.parentMenuItemCode}" is not in this archive — it must be a GROUP code taken off the stand, never a guess`);
    else if (parent.menuItemType !== "GROUP")
      add("ERROR", "0.5d", `${tag}: parent "${m.parentMenuItemCode}" is a ${parent.menuItemType} item, not a GROUP`);
    else if (menus.indexOf(parent) > menus.indexOf(m))
      add("WARN", "0.5d", `${tag}: listed BEFORE its group — the order proved on import is group first`);
  }

  if (type === "GROUP") {
    for (const k of ["boPages", "bracketFilter", "boCode", "boName"])
      if (k in m) add("ERROR", "0.10/14", `${tag}: a GROUP line carries "${k}" — the stand exports a group without it`);
    return;
  }

  // type BO
  for (const k of ["boCode", "boName", "boPages", "bracketFilter"])
    if (!(k in m)) add("ERROR", "0.10/14", `${tag}: a BO line needs "${k}"`);
  const bo = boByCode.get(String(m.boCode));
  if (m.boCode !== undefined && !bo)
    add("WARN", "0.5d", `${tag}: boCode "${m.boCode}" is not a BO of this archive — it must already be on the stand`);
  const bf = m.bracketFilter;
  if (bf) {
    if (bf.boCode !== m.boCode) add("ERROR", "0.5d", `${tag}: bracketFilter.boCode "${bf.boCode}" != boCode "${m.boCode}"`);
    if (bf.type !== "MENU_ITEM") add("ERROR", "0.5d", `${tag}: bracketFilter.type "${bf.type}", must be MENU_ITEM`);
    if (Array.isArray(bf.brackets))
      add("ERROR", "5e", `${tag}: bracketFilter.brackets is an ARRAY (the API shape) — in an archive it is a map keyed by 8-char ids`);
    else if (bf.brackets && Object.keys(bf.brackets).length)
      add("WARN", "5e", `${tag}: a non-empty record filter — importing one was never tried [U]`);
  }
  const bp = m.boPages;
  if (!bp) return;
  for (const k of BO_PAGES_KEYS) if (!(k in bp)) add("ERROR", "0.5d", `${tag}: boPages.${k} missing`);
  if ("kanbanFieldId" in bp)
    add("ERROR", "0.10/14", `${tag}: boPages.kanbanFieldId is the API key — an archive takes kanbanFieldCode`);
  if (bp.isKanbanEnabled && !bp.kanbanFieldCode)
    add("ERROR", "0.5d", `${tag}: kanban enabled without boPages.kanbanFieldCode — no columns`);
  if (!bp.isKanbanEnabled && bp.kanbanFieldCode)
    add("WARN", "0.5d", `${tag}: kanbanFieldCode "${bp.kanbanFieldCode}" but isKanbanEnabled is false`);
  if (bp.isKanbanEnabled && bp.kanbanFieldCode && bo) {
    const f = bo.dynamicFields?.[bp.kanbanFieldCode];
    if (!f) add("ERROR", "0.5d", `${tag}: kanbanFieldCode "${bp.kanbanFieldCode}" is not a field of BO ${bo.code}`);
    else if (f.type !== "DROPDOWN_SINGLE")
      add("ERROR", "0.5d", `${tag}: kanbanFieldCode "${bp.kanbanFieldCode}" is ${f.type}, the columns need a DROPDOWN_SINGLE`);
    if (!bo.kanbanCardTemplates?.[bp.kanbanFieldCode])
      add("ERROR", "0.5c", `${tag}: BO ${bo.code} has no kanbanCardTemplates.${bp.kanbanFieldCode} — the board dies with «cardTemplate is null»`);
  }
  for (const k of ["isCalendarEnabled", "isTimelineEnabled", "isMapEnabled", "isGroupingEnabled"])
    if (bp[k]) add("WARN", "0.5d", `${tag}: boPages.${k} — only the list and kanban views were ever shipped, what this one needs is [U]`);
  const on = BO_PAGES_KEYS.filter(k => k.startsWith("is") && bp[k]).map(k => bp[k.slice(2, 3).toLowerCase() + k.slice(3, -"Enabled".length) + "Index"]);
  if (new Set(on).size !== on.length || on.some(v => !(v >= 1)))
    add("WARN", "0.5d", `${tag}: the *Index of the enabled views should be distinct and 1-based, got ${JSON.stringify(on)}`);
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
