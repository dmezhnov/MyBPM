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

// §0.6 transliteration table
const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "yi",
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

// ---------------------------------------------------------------- groups (§0.3, §0.10 rule 1)
const groups = objs.filter(o => cls(o) === "BoGroupStructDto");
if (groups.length === 0) add("FATAL", "0.3", "no BoGroupStructDto line");
if (groups.length > 1) add("FATAL", "0.10/1", `${groups.length} BoGroupStructDto lines; multi-group archives are broken (§8)`);
for (const g of groups) {
  if (g.kind !== "MANUAL") add("ERROR", "0.3", `group kind is ${g.kind}, must be MANUAL`);
  if (!ID_RE.test(String(g.oldId))) add("ERROR", "0.7", `group oldId "${g.oldId}" is not 16 chars over A-Za-z0-9@~`);
  if (!g.newId) add("WARN", "0.3", "group has no newId");
  if (typeof g.name !== "string" || !g.name) add("FATAL", "0.3", "group has no name");
}

if (objs.some(o => cls(o) === "AccessStructDto"))
  add("ERROR", "0.10/10", "archive ships an AccessStructDto — import wipes orgUnitIds; never ship one unasked");

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
if (bos.length === 0) add("FATAL", "0.4", "no BoStructDto line");

for (const bo of bos) {
  const tag = `BO ${bo.code ?? "?"}`;
  id(tag, bo.oldId);

  for (const k of BO_KEYS) if (!(k in bo)) add("ERROR", "0.4", `${tag}: key "${k}" missing — import MERGES, a missing key keeps the stand's old value`);
  const unknownBo = Object.keys(bo).filter(k => !BO_KEYS.includes(k));
  if (unknownBo.length) add("WARN", "0.4", `${tag}: keys not in the §0.4 template: ${unknownBo.join(", ")}`);

  if (!CATEGORIES.has(bo.category)) add("FATAL", "0.9", `${tag}: category "${bo.category}" is not one of ${[...CATEGORIES].join("/")}`);
  if (groups.length === 1 && bo.boGroupOldId !== groups[0].oldId)
    add("FATAL", "0.10/8", `${tag}: boGroupOldId "${bo.boGroupOldId}" != group oldId "${groups[0].oldId}"`);

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
  let prevY: number | null = null, prevRows = 0;
  let idx = 0;
  const entries = Object.entries(df as Record<string, any>);
  for (const [key, f] of entries) {
    const ft = `${tag}.${key}`;
    if (f.code !== key) add("FATAL", "0.10/5", `${ft}: dynamicFields key "${key}" != field code "${f.code}"`);
    id(ft, f.newId);
    if ("oldId" in f && !("newId" in f)) add("ERROR", "0.7", `${ft}: field carries oldId; fields use newId`);
    if (f.archetype !== "DYNAMIC") add("ERROR", "0.5", `${ft}: archetype "${f.archetype}", a dynamicFields entry is DYNAMIC`);

    for (const k of FIELD_KEYS) if (!(k in f)) add("ERROR", "0.5", `${ft}: key "${k}" missing from the field template`);
    const extra = Object.keys(f).filter(k => !FIELD_KEYS.includes(k) &&
      !["oldRefBoId", "viewType", "isHeightDynamic", "fieldOptionsStruct", "tableWidth", "defaultValue"].includes(k));
    if (extra.length) add("WARN", "0.5", `${ft}: keys outside the template: ${extra.join(", ")}`);

    const type = f.type;
    if (NOT_A_FIELD_TYPE.has(type))
      add("FATAL", "0.10/12", `${ft}: type "${type}" is not a dynamic field type (widget / native / invented) — wrong map`);
    else if (!FIELD_TYPES.has(type))
      add("FATAL", "0.5", `${ft}: type "${type}" is not in the field-type enum`);

    const c = String(f.code ?? "");
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(c)) add("ERROR", "0.10/7", `${ft}: field code "${c}" is not latin/digits/underscore`);
    if (c.length > 30) add("ERROR", "0.10/7", `${ft}: field code is ${c.length} chars, max 30`);
    const lab = f.label?.rus;
    if (typeof lab !== "string") add("ERROR", "0.5", `${ft}: label is not {rus: "…"}`);
    else {
      if (lab !== lab.trimStart()) add("WARN", "0.5", `${ft}: label has a leading space`);
      const want = translit(lab);
      if (want !== c && !c.startsWith(want) && bo.category !== "BO_DICTIONARY")
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
        if (!fo.dictionaryBoInfo?.code) add("ERROR", "5", `${ft}: FROM_BO without dictionaryBoInfo.code`);
        if (fo.dictionaryBoInfo?.boCategory && fo.dictionaryBoInfo.boCategory !== "BO_DICTIONARY")
          add("ERROR", "5", `${ft}: dictionaryBoInfo.boCategory = ${fo.dictionaryBoInfo.boCategory}, expected BO_DICTIONARY`);
        if (fo.dictionaryBoInfo?.oldRefBoId || fo.dictionaryBoInfo?.id)
          add("WARN", "5", `${ft}: a dictionary is named by CODE, not by id`);
      } else if (fo.optionSource === "FROM_FIELD") {
        const opts = fo.options ?? {};
        if (Array.isArray(opts)) add("ERROR", "5", `${ft}: options is an ARRAY, must be an object keyed by option code`);
        else for (const [ok, ov] of Object.entries<any>(opts)) {
          if (!ov.fieldOption) add("ERROR", "5", `${ft}: option "${ok}" has no fieldOption`);
          else {
            if (typeof ov.fieldOption.label !== "string")
              add("ERROR", "5", `${ft}: option "${ok}" label must be a PLAIN STRING, got ${JSON.stringify(ov.fieldOption.label)}`);
            if (ov.fieldOption.code !== ok) add("ERROR", "5", `${ft}: option key "${ok}" != fieldOption.code "${ov.fieldOption.code}"`);
          }
          id(`${ft}.option ${ok}`, ov.newOptionId);
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
    } else {
      const gp = f.gridPosition;
      if (!gp) add("ERROR", "0.8", `${ft}: no gridPosition`);
      else {
        if (gp.x !== 0) add("WARN", "0.8", `${ft}: x=${gp.x}; the safe layout is x=0, cols=15`);
        if (gp.cols !== 15) add("WARN", "0.8", `${ft}: cols=${gp.cols}; the safe layout is cols=15`);
        const wantRows = ROWS_8.has(type) ? 8 : ROWS_6.has(type) ? 6 : 4;
        if (gp.rows !== wantRows) add("WARN", "0.8", `${ft}: rows=${gp.rows}, the constructor gives ${wantRows} to ${type}`);
        if (prevY !== null && gp.y !== prevY + prevRows)
          add("ERROR", "0.8", `${ft}: y=${gp.y}, expected ${prevY + prevRows} (previous y ${prevY} + previous rows ${prevRows})`);
        if (prevY === null && gp.y !== 0) add("ERROR", "0.8", `${ft}: the first field must start at y=0, got ${gp.y}`);
        prevY = gp.y; prevRows = gp.rows;
      }
      if (f.tableColOrderIndex !== idx) add("WARN", "0.5", `${ft}: tableColOrderIndex=${f.tableColOrderIndex}, expected ${idx} (form order)`);
    }
    idx++;
  }

  // STATIC_TEXT heading must not repeat a field label (§0.5)
  for (const [, f] of entries) {
    if (f.type === "STATIC_TEXT") {
      const text = String(f.staticValue?.rus ?? "").replace(/<[^>]*>/g, "").trim();
      if (text && labels.has(text)) add("WARN", "0.5", `${tag}: STATIC_TEXT heading "${text}" repeats a field label — breaks Excel import`);
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
    }
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
      if (f.isReadonly !== true) add("WARN", "5a", `${tag}.${key}: a panel widget carries isReadonly: true`);
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
      const wp = pv[0].workProcess;
      if (!wp?.figureStructs || !Object.keys(wp.figureStructs).length) add("ERROR", "5c", `${tag}: workProcess has no figureStructs`);
      else for (const [fid, fig] of Object.entries<any>(wp.figureStructs)) {
        if (!String(fig["@class"] ?? "").includes("bo.process.figure.Figure"))
          add("ERROR", "5c", `${tag}: figure ${fid} has no Figure<Type>Struct "@class"`);
      }
      if (!wp?.arrows) add("WARN", "5c", `${tag}: workProcess has no arrows`);
      else for (const [aid, a] of Object.entries<any>(wp.arrows ?? {})) {
        for (const k of ["startFigureId", "finishFigureId"]) {
          if (!a[k]) { add("ERROR", "5c", `${tag}: arrow ${aid} misses ${k}`); continue; }
          if (wp.figureStructs && !(a[k] in wp.figureStructs))
            add("ERROR", "5c", `${tag}: arrow ${aid}.${k} points at "${a[k]}", not a declared figure`);
        }
      }
    }
    const hasStatus = Object.keys(df).some(k => k === "PROCESS_STATUS") ||
      Object.values<any>(df).some(f => f.boRefStruct?.boInfo?.code === "PROCESS_STATUS");
    if (!hasStatus) add("ERROR", "5c", `${tag}: the importer does NOT create PROCESS_STATUS — the archive must ship that field itself`);
  }
}

// process lines without a BO
for (const pv of objs.filter(o => cls(o) === "BoProcessVersionsStructDto"))
  if (!bos.some(b => b.oldId === pv.oldId))
    add("FATAL", "5c", `BoProcessVersionsStructDto oldId "${pv.oldId}" matches no BoStructDto`);

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
