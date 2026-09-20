#!/usr/bin/env bun
/**
 * Generates a minimal MyBPM structure archive (.mybpm.zip) with exactly ONE business object.
 *
 * Purpose: probe the importer on a live stand — see MYBPM-IMPORTS.md §1 and §8.
 * Attempt 1 deliberately ships only 2 JSONL lines (BoGroupStructDto + BoStructDto), WITHOUT
 * CompanyMetadataStructDto, to settle whether that line is mandatory ([U] in MYBPM-IMPORTS.md §1).
 *
 * The group is named after an EXISTING group on the target stand: the importer is known to RENAME
 * an existing group instead of creating one (MYBPM-IMPORTS.md §8), so renaming it onto itself is a
 * no-op. Group `oldId` is NOT stable — every export of the same stand group carries a different
 * oldId/newId — so it only has to tie the two lines of this archive together.
 *
 * Usage:  bun tools/make-probe-archive.bun.ts [--with-metadata] [--out DIR] [--code CODE] [--name NAME]
 *         [--category BO|BO_DICTIONARY|BO_COMPOSITE|BO_PANEL|BO_PROCESS] [--field "Метка:TYPE"]...
 *         [--process-figure "Exit@440,104"]... [--process-status <refBoId>]
 *
 * The full `--field` grammar is «Метка:TYPE[@a][@b][#вариант|вариант][!req,uniq,readonly]»:
 *   --field "Наименование:INPUT_TEXT!req"                     — «Необходимо заполнять» (isRequired)
 *   --field "Табельный номер:INPUT_TEXT!uniq"                 — «Уникальное поле» (isUnique)
 *   --field "Должность:DROPDOWN_SINGLE@Dolzhnost@Должность"   — «Справочник» BY CODE (FROM_BO)
 *   --field "Статус:DROPDOWN_SINGLE#Новый|В работе|Готово"    — «Задать вручную» (FROM_FIELD)
 *
 * A KANBAN needs a card template ON THE BO, or the view dies with «cardTemplate is null»:
 *   --kanban "Статус:HEADER=Наименование;CONTENT=Исполнитель,CREATED_BY;FOOTER=Комментарий"
 * («Статус» is the dropdown whose options become the columns; the names are field labels, or a
 * NATIVE type that `--native` has already added.)
 *
 * A PANEL is an ordinary BoStructDto with `category: "BO_PANEL"` whose fields are NESTED OBJECTS:
 *   --category BO_PANEL --field "Мои пробы:BO@OpmGDzaQRUT27jky@Proba_UI_2026_09_18"
 * (`BO@<boId на стенде>@<код БО>` → `type: "BO"`, `oldRefBoId`, `boRefStruct.boInfo.code`.)
 *
 * A COMPOSITE OBJECT (MYBPM-IMPORTS.md §5b) names its source BOs **by code only** in `bos`, and every
 * field says which source field feeds it in `boFieldCodes` (one entry = «простой атрибут», two or more =
 * «составной»). The sources are NOT carried in the archive — they must already be on the stand:
 *   --category BO_COMPOSITE \
 *     --source "Proba_UI_2026_09_18:Проба UI 2026-09-18" \
 *     --source "Proba_API_konstruktor_2026_09:Проба API-конструктор 2026-09-18" \
 *     --co-field "Наименование:INPUT_TEXT=Proba_UI_2026_09_18.Naimenovanie+Proba_API_konstruktor_2026_09.Naimenovanie" \
 *     --co-field "Чекбокс:CHECKBOX=Proba_UI_2026_09_18.Chekboks"
 */

import { createHash } from "node:crypto"; // Bun.hash is not a cryptographic digest; sha256 keeps ids reproducible

const PKG = "kz.greetgo.mybpm.reg.structure.model.dto";

const args = new Set(Bun.argv.slice(2));
const withMetadata = args.has("--with-metadata");
const outDir = Bun.argv.includes("--out")
  ? Bun.argv[Bun.argv.indexOf("--out") + 1]
  : `${import.meta.dir}/out`;

/**
 * Company ids lifted from ONE stand export (2026-05, build 4.24.25.470) — they exist only to give
 * `CompanyMetadataStructDto` a well-formed shape. That line is OPTIONAL (MYBPM-IMPORTS.md §1); if your
 * stand needs it, take the ids from your own export instead of these.
 */
const COMPANY_METADATA = {
  personBoId: "kuauBPHguuPrPIzq",
  departmentBoId: "b@hLtBKNqBseRbj9",
  personGroupBoId: "ARXWYNE8Kl8O6GZe",
};

const GROUP_NAME = "Бизнес-объект"; // must match a group that ALREADY exists on the target stand

/** `--code X` / `--name Y` override the defaults; ids are derived from the code, so a new code = a new BO. */
function flag(name: string, fallback: string): string {
  const i = Bun.argv.indexOf(`--${name}`);
  return i >= 0 ? Bun.argv[i + 1] : fallback;
}

const BO_CODE = flag("code", "Proba_importa_20260918");
const BO_NAME = flag("name", "Проба импорта 2026-09-18");

/** BoStructDto.category — the same five kinds the group's kebab offers (MYBPM-UI-API.md §5b). */
const CATEGORY = flag("category", "BO");

/**
 * `--field "Метка:TYPE"`, repeatable; the code is transliterated from the label the way the stand does
 * it. Without any `--field` the default pair (Наименование / Число) is kept, so old calls are unchanged.
 */
type FieldSpec = {
  label: string; type: string; refBoId?: string; refBoCode?: string;
  options: string[]; flags: string[];
};
function fieldFlags(): FieldSpec[] {
  const out: FieldSpec[] = [];
  for (let i = 0; i < Bun.argv.length; i++) {
    if (Bun.argv[i] !== "--field") continue;
    const raw = Bun.argv[i + 1] ?? "";
    const at = raw.lastIndexOf(":");
    if (at < 1) throw new Error(`--field expects "Метка:TYPE", got ${JSON.stringify(raw)}`);
    let spec = raw.slice(at + 1);
    // `!req,uniq,readonly,nocol` — the field settings of the constructor's gear popover.
    let flags: string[] = [];
    const bang = spec.indexOf("!");
    if (bang >= 0) { flags = spec.slice(bang + 1).split(",").filter(Boolean); spec = spec.slice(0, bang); }
    // `#Новый|В работе|Готово` — a DROPDOWN_SINGLE's LOCAL option list («Задать вручную»).
    let options: string[] = [];
    const hash = spec.indexOf("#");
    if (hash >= 0) { options = spec.slice(hash + 1).split("|").filter(Boolean); spec = spec.slice(0, hash); }
    // «Метка:BO@<boId стенда>@<код БО>» — a NESTED OBJECT (the registry widget a panel is built of);
    // «Метка:DROPDOWN_SINGLE@<КОД справочника>@<Имя справочника>» — a dropdown fed by a DICTIONARY,
    // which an archive names by CODE, never by id (unlike a nested object).
    // Parsed so that a stand id may itself start with or contain «@» (`@feclOAWUnwXFQ8c`):
    // the TYPE runs to the first «@», the code after the LAST one, the id is what is left between.
    const first = spec.indexOf("@");
    const last = spec.lastIndexOf("@");
    const type = first < 0 ? spec : spec.slice(0, first);
    const refBoId = first < 0 ? undefined : spec.slice(first + 1, last > first ? last : undefined);
    const refBoCode = last > first ? spec.slice(last + 1) : undefined;
    const unknown = flags.filter(f => !["req", "uniq", "readonly", "nocol", "multiple", "camera"].includes(f));
    if (unknown.length) throw new Error(`unknown --field flag(s): ${unknown.join(", ")}`);
    out.push({ label: raw.slice(0, at), type, refBoId, refBoCode, options, flags });
  }
  return out;
}

/**
 * `--native <NATIVE_TYPE>`, repeatable — a SYSTEM field («Системные поля» in the constructor palette).
 * They do NOT live in `dynamicFields`: the archive keeps them in their own `nativeFields` map, keyed by
 * the native type itself (MYBPM-IMPORTS.md §3a).
 */
function nativeFlags(): string[] {
  const out: string[] = [];
  for (let i = 0; i < Bun.argv.length; i++) if (Bun.argv[i] === "--native") out.push(Bun.argv[i + 1]);
  const known = ["CREATED_AT", "CREATED_BY", "LAST_MODIFIED_AT", "LAST_MODIFIED_BY", "OPEN_COUNT", "IN_MIGRATION_UPDATED_AT"];
  const bad = out.filter(t => !known.includes(t));
  if (bad.length) throw new Error(`unknown --native type(s): ${bad.join(", ")} (known: ${known.join(", ")})`);
  return out;
}

/**
 * `--widget "TYPE:Метка[:код][:url]"`, repeatable — a WIDGET («Виджеты» in the palette). Each family
 * has its OWN map in the archive: SIGNATURE→`signatures`, BUTTON→`buttons`, IFRAME→`iframes`,
 * CAPTCHA→`captcha`, CURRENT_*→`currentDates`, CURRENT_USER→`currentUser` (MYBPM-IMPORTS.md §3b).
 * `url` is accepted by BUTTON and IFRAME only.
 */
function widgetFlags(): { type: string; label: string; code: string; url?: string }[] {
  const out: { type: string; label: string; code: string; url?: string }[] = [];
  for (let i = 0; i < Bun.argv.length; i++) {
    if (Bun.argv[i] !== "--widget") continue;
    // split into at most 4 parts: a url carries «:» of its own and must stay in one piece
    const raw = Bun.argv[i + 1] ?? "";
    const parts: string[] = [];
    let rest = raw;
    for (let k = 0; k < 3 && rest.includes(":"); k++) {
      parts.push(rest.slice(0, rest.indexOf(":")));
      rest = rest.slice(rest.indexOf(":") + 1);
    }
    parts.push(rest);
    const [type, label, code, url] = parts;
    if (!type || !label) throw new Error(`--widget expects "TYPE:Метка[:код][:url]", got ${JSON.stringify(raw)}`);
    out.push({ type, label, code: code || codeOf(label), url: url || undefined });
  }
  return out;
}

/**
 * `--source "<код БО>:<Имя>[:<категория>]"`, repeatable — the source BOs of a COMPOSITE object.
 * They live on the stand, not in the archive; the archive references them by code (MYBPM-IMPORTS.md §5b).
 */
function sourceFlags(): { code: string; name: string; boCategory: string }[] {
  const out: { code: string; name: string; boCategory: string }[] = [];
  for (let i = 0; i < Bun.argv.length; i++) {
    if (Bun.argv[i] !== "--source") continue;
    const [code, name, boCategory] = (Bun.argv[i + 1] ?? "").split(":");
    if (!code || !name) throw new Error(`--source expects "код:Имя[:категория]", got ${JSON.stringify(Bun.argv[i + 1])}`);
    out.push({ code, name, boCategory: boCategory ?? "BO" });
  }
  return out;
}

/** `--co-field "Метка:TYPE=<boCode>.<fieldCode>[+…]"`, repeatable — an attribute of a COMPOSITE object. */
function coFieldFlags(): { label: string; type: string; links: { boCode: string; fieldCode: string }[] }[] {
  const out: { label: string; type: string; links: { boCode: string; fieldCode: string }[] }[] = [];
  for (let i = 0; i < Bun.argv.length; i++) {
    if (Bun.argv[i] !== "--co-field") continue;
    const raw = Bun.argv[i + 1] ?? "";
    const eq = raw.indexOf("=");
    const head = eq < 0 ? raw : raw.slice(0, eq);
    const at = head.lastIndexOf(":");
    if (at < 1 || eq < 0) throw new Error(`--co-field expects "Метка:TYPE=boCode.fieldCode[+…]", got ${JSON.stringify(raw)}`);
    const links = raw.slice(eq + 1).split("+").map(l => {
      const dot = l.lastIndexOf(".");
      if (dot < 1) throw new Error(`--co-field link expects "boCode.fieldCode", got ${JSON.stringify(l)}`);
      return { boCode: l.slice(0, dot), fieldCode: l.slice(dot + 1) };
    });
    out.push({ label: head.slice(0, at), type: head.slice(at + 1), links });
  }
  return out;
}

/**
 * `--kanban "<Метка выпадающего списка>:HEADER=<Метка>[,…];CONTENT=…;FOOTER=…"`, repeatable — the CARD
 * TEMPLATE of a kanban whose COLUMNS are that dropdown's options. Without it an imported BO carries
 * `kanbanCardTemplates: {}` and the kanban view dies with «cardTemplate is null» (MYBPM-UI-API.md §7):
 * the menu item's `isKanbanEnabled` alone is not enough, the template lives on the BO.
 * A name that is a known NATIVE type (CREATED_BY, …) goes onto the card as `archetype: "NATIVE"`;
 * everything else is a dynamic field and is matched by label (or by code, if the label is already one).
 */
function kanbanFlags(): { column: string; locations: Record<string, string[]> }[] {
  const out: { column: string; locations: Record<string, string[]> }[] = [];
  for (let i = 0; i < Bun.argv.length; i++) {
    if (Bun.argv[i] !== "--kanban") continue;
    const raw = Bun.argv[i + 1] ?? "";
    const at = raw.indexOf(":");
    if (at < 1) throw new Error(`--kanban expects "Метка:HEADER=…;CONTENT=…", got ${JSON.stringify(raw)}`);
    const locations: Record<string, string[]> = {};
    for (const part of raw.slice(at + 1).split(";").filter(Boolean)) {
      const eq = part.indexOf("=");
      if (eq < 1) throw new Error(`--kanban location expects "HEADER=Метка,…", got ${JSON.stringify(part)}`);
      const loc = part.slice(0, eq).trim().toUpperCase();
      if (!["HEADER", "CONTENT", "FOOTER"].includes(loc)) {
        throw new Error(`--kanban location must be HEADER|CONTENT|FOOTER, got ${JSON.stringify(loc)}`);
      }
      locations[loc] = part.slice(eq + 1).split(",").map(s => s.trim()).filter(Boolean);
    }
    out.push({ column: raw.slice(0, at), locations });
  }
  return out;
}

/** Cyrillic → latin the way the server generates field/BO codes (see MYBPM-UI-API.md §5b). */
const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "yi",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};
function codeOf(label: string): string {
  let s = "";
  for (const ch of label) {
    const low = ch.toLowerCase();
    const tr = TRANSLIT[low];
    if (tr !== undefined) s += low === ch ? tr : tr.charAt(0).toUpperCase() + tr.slice(1);
    else if (/[A-Za-z0-9]/.test(ch)) s += ch;
    else s += "_";
  }
  return s.slice(0, 30);
}

/** Deterministic 16-char platform-shaped id (alphabet seen in real exports: A-Za-z0-9@~_). */
function id(seed: string): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@~";
  const h = createHash("sha256").update(seed).digest();
  let s = "";
  for (let i = 0; i < 16; i++) s += alphabet[h[i] % alphabet.length];
  return s;
}

/** Every boolean flag a stand-built field carries, in the order real exports write them. */
function field(o: {
  code: string;
  label: string;
  type: string;
  x: number;
  y: number;
  cols: number;
  rows: number;
  tableColToShow?: boolean;
  tableColOrderIndex?: number;
  /** The dictionary's own `code`/`label` fields carry these — a stand-built one always has isSystem. */
  isUnique?: boolean;
  isRequired?: boolean;
  isSystem?: boolean;
  labelAll?: Record<string, string>;
  isReadonly?: boolean;
  /** A `type: "BO"` field points at another BO — the stand's id plus its code (read off a real export). */
  refBoId?: string;
  refBoCode?: string;
  /**
   * A DROPDOWN_SINGLE's «Отобразить значения». `dictionary` = «Справочник» (the dictionary is named by
   * CODE and the stand resolves it on import); `options` = «Задать вручную», the local list. Shapes read
   * off a real export (`Model_step.condition`, `Request.gender`).
   */
  dictionary?: { code: string; name: string };
  options?: string[];
  /**
   * A COMPOSITE object's attribute: which source field feeds it. One entry = «простой атрибут»,
   * two or more = «составной». A composite has no form, so such a field carries no layout — the
   * `TestComposite` sample has no `gridPosition` at all.
   */
  boFieldCodes?: { boCode: string; fieldCode: string }[];
  /** The reference target's category: a nested object is a `BO`, a «Составной объект» field a `BO_COMPOSITE`. */
  refBoCategory?: string;
  /** «Текст» (STATIC_TEXT) — the HTML of the section heading. */
  staticValue?: string;
  /** «Опросник» (QUESTIONNAIRE) — the column and row labels of the grid. */
  questionnaire?: { columns: string[]; rows: string[] };
  /** «Прогресс-бар» (PROGRESS_BAR) — the steps, in order. */
  steps?: string[];
  /** «Вкладки» (TAB_GROUP) — the tab labels, in order. */
  tabs?: string[];
  /** «Загрузка файла» — SINGLE / MULTIPLE, and `params.contentType` ALL / FOR_CAMERA. */
  viewType?: string;
  params?: Record<string, unknown>;
}) {
  const layout = o.boFieldCodes
    ? {}
    : {
      tableColOrderIndex: o.tableColOrderIndex ?? 0,
      gridPosition: { x: o.x, y: o.y, cols: o.cols, rows: o.rows },
      removeType: "STRIKETHROUGH",
    };
  return {
    code: o.code,
    newId: id(`${BO_CODE}.${o.code}`),
    archetype: "DYNAMIC",
    kind: "GENERAL",
    boRefStruct: o.refBoCode
      ? { boInfo: { code: o.refBoCode, name: o.label, boCategory: o.refBoCategory ?? "BO" }, fieldRefs: {} }
      : { fieldRefs: {} },
    ...(o.refBoId ? { oldRefBoId: o.refBoId, viewType: o.viewType ?? "TABLE", isHeightDynamic: true } : {}),
    label: o.labelAll ?? { rus: o.label },
    staticValue: o.staticValue ? { rus: o.staticValue } : {},
    isUnique: o.isUnique ?? false,
    isRequired: o.isRequired ?? false,
    isAppendable: false,
    isRequiredAll: false,
    isReadonly: o.isReadonly ?? false,
    isClickable: true,
    isSelectOnly: false,
    isSeparated: false,
    needAddToParticipants: false,
    needShowToCalendar: true,
    dateOnlyFuture: false,
    dateOnlyPast: false,
    needTrackStatus: false,
    tableColToShow: o.tableColToShow ?? true,
    isHistoryTracking: false,
    isKindAddForSelect: !!o.refBoId, // a nested object on a PANEL is «добавить для выбора» — see MYBPM-UI-API.md §5d
    titleToShow: false,
    questionnaireIsMultiple: false,
    isProgressBarSticky: false,
    hideLabel: false,
    chosenAccessRight: false,
    unacceptableValue: false,
    isSystem: o.isSystem ?? false,
    isCodeReadonly: false,
    needLoadFromInTables: false,
    useAsKeyInMigration: false,
    needUploadToOutTable: false,
    needChangeParentBoByLinkedBo: true,
    needFreezeWhenScroll: false,
    needMarkNew: false,
    textCase: "NONE",
    inMigrationTimezoneMinutes: 0,
    type: o.type,
    groupingInfo: {},
    ...(o.dictionary
      ? {
        fieldOptionsStruct: {
          optionSource: "FROM_BO",
          options: {},
          dictionaryBoInfo: { code: o.dictionary.code, name: o.dictionary.name, boCategory: "BO_DICTIONARY" },
          dictionaryOptionSetting: {},
        },
      }
      : {}),
    ...(o.options?.length
      ? {
        fieldOptionsStruct: {
          optionSource: "FROM_FIELD",
          // keyed by the option's own transliterated code, each entry carrying its own new id
          options: Object.fromEntries(o.options.map((label, i) => {
            const optCode = codeOf(label);
            return [optCode, {
              fieldOption: { label, orderIndex: i * 10000, color: null, code: optCode, hiddenInKanban: false },
              newOptionId: id(`${BO_CODE}.${o.code}.${optCode}`),
            }];
          })),
          dictionaryOptionSetting: {},
        },
      }
      : {}),
    // «Вкладки»: one entry per tab, keyed by the tab's transliterated code (export shape).
    fieldTabs: Object.fromEntries((o.tabs ?? []).map((label, i) => {
      const tabCode = codeOf(label);
      return [tabCode, {
        label: { rus: label }, orderIndex: i, chosenAccessRight: false,
        isRight: false, isDefault: i === 0, code: tabCode,
        newId: id(`${BO_CODE}.${o.code}.tab.${tabCode}`),
      }];
    })),
    ...(o.viewType && !o.refBoId ? { viewType: o.viewType } : {}),
    ...layout,
    gantTableLocations: {},
    boFieldCodes: o.boFieldCodes ?? [],
    linkedCoSettings: {},
    // «Опросник»: columns and rows share one map, told apart by `isColumn`; both are keyed by code.
    questionnaires: Object.fromEntries([
      ...(o.questionnaire?.columns ?? []).map((label, i) => [label, i, true] as const),
      ...(o.questionnaire?.rows ?? []).map((label, i) => [label, i, false] as const),
    ].map(([label, i, isColumn]) => {
      const qCode = codeOf(label);
      return [qCode, {
        questionnaireDto: { label, isColumn, orderIndex: i, code: qCode },
        newId: id(`${BO_CODE}.${o.code}.q.${qCode}`),
      }];
    })),
    // «Прогресс-бар»: keyed by the step's own id, not by its code (export shape).
    progressSteps: Object.fromEntries((o.steps ?? []).map((label, i) => [
      id(`${BO_CODE}.${o.code}.step.${codeOf(label)}`),
      { code: codeOf(label), label, orderIndex: i },
    ])),
    params: o.params ?? {},
  };
}

const groupOldId = id(`group.${GROUP_NAME}`);

const lines: object[] = [];

if (withMetadata) {
  lines.push({ "@class": `${PKG}.CompanyMetadataStructDto`, ...COMPANY_METADATA });
}

lines.push({
  "@class": `${PKG}.BoGroupStructDto`,
  oldId: groupOldId,
  name: GROUP_NAME,
  orderIndex: 1110000.0,
  kind: "MANUAL",
  newId: id(`group.new.${GROUP_NAME}`),
});

/**
 * A dictionary ALWAYS carries the two system fields `code` / `label` and lists them in
 * `dictionaryFields` — read off a real export of «Единица измерения» (MYBPM-IMPORTS.md §5) and
 * confirmed against a dictionary built in the constructor (MYBPM-UI-API.md §5b).
 */
const DICTIONARY_FIELDS = {
  code: field({
    code: "code",
    label: "Код",
    labelAll: { rus: "Код", kaz: "Код", qaz: "Kod", eng: "Code" },
    type: "INPUT_TEXT",
    x: 0,
    y: 0,
    cols: 15,
    rows: 4,
    isUnique: true,
    isRequired: true,
    isSystem: true,
  }),
  label: field({
    code: "label",
    label: "Значение",
    labelAll: { rus: "Значение", kaz: "Мәні", qaz: "Mani", eng: "Value" },
    type: "INPUT_TEXT_LANG",
    x: 0,
    y: 4,
    cols: 15,
    rows: 4,
    isRequired: true,
    isSystem: true,
  }),
};

const DEFAULT_FIELDS = {
  Naimenovanie: field({
    code: "Naimenovanie",
    label: "Наименование",
    type: "INPUT_TEXT",
    x: 0,
    y: 0,
    cols: 15,
    rows: 4,
    tableColOrderIndex: 0,
  }),
  Chislo: field({
    code: "Chislo",
    label: "Число",
    type: "INPUT_NUMBER",
    x: 0,
    y: 4,
    cols: 5,
    rows: 3,
    tableColOrderIndex: 1,
  }),
};

const isDictionary = CATEGORY === "BO_DICTIONARY";
const isComposite = CATEGORY === "BO_COMPOSITE";
const custom = fieldFlags();
const sources = sourceFlags();
const coFields = coFieldFlags();
const natives = nativeFlags();
const widgets = widgetFlags();
const kanbans = kanbanFlags();

if (isComposite && (sources.length === 0 || coFields.length === 0)) {
  throw new Error("--category BO_COMPOSITE needs at least one --source and one --co-field");
}
for (const f of coFields) {
  for (const l of f.links) {
    if (!sources.some(s => s.code === l.boCode)) {
      throw new Error(`--co-field references «${l.boCode}», which no --source declares`);
    }
  }
}

/** System fields first (a dictionary owns rows 0-7), then whatever `--field` asked for. */
const dynamicFields: Record<string, object> = isDictionary ? { ...DICTIONARY_FIELDS } : {};
if (isComposite) {
  for (const f of coFields) {
    const code = codeOf(f.label);
    dynamicFields[code] = field({
      code, label: f.label, type: f.type,
      x: 0, y: 0, cols: 15, rows: 4, // ignored: a composite field gets no layout at all
      boFieldCodes: f.links,
    });
  }
} else if (custom.length === 0 && !isDictionary) {
  Object.assign(dynamicFields, DEFAULT_FIELDS);
} else {
  let y = Object.keys(dynamicFields).length * 4;
  custom.forEach((f, i) => {
    const code = codeOf(f.label);
    // What the constructor itself assigns: a reference or a file 6 rows, a grid-shaped field 8, else 4.
    const rows = ["BO", "CO", "LINK", "FILE_UPLOAD", "CHECKLIST", "RADIO_BUTTON_GROUP", "PROGRESS_BAR"].includes(f.type)
      ? 6
      : ["STATIC_TEXT", "QUESTIONNAIRE", "TAB_GROUP", "GEO_POINT"].includes(f.type) ? 8 : 4;
    const isRef = f.type === "BO" || f.type === "CO";
    // `#…` means a different thing per type: options for a list, steps for a bar, tabs for a tab group,
    // «колонки^строки» for a questionnaire, and the HTML itself for «Текст».
    const hash = f.options;
    dynamicFields[code] = field({
      code,
      label: f.label,
      type: f.type,
      x: 0,
      y,
      cols: 15,
      rows,
      tableColOrderIndex: i,
      refBoId: isRef ? f.refBoId : undefined,
      refBoCode: isRef ? f.refBoCode : undefined,
      refBoCategory: f.type === "CO" ? "BO_COMPOSITE" : undefined,
      dictionary: f.type === "DROPDOWN_SINGLE" && f.refBoId
        ? { code: f.refBoId, name: f.refBoCode ?? f.refBoId }
        : undefined,
      options: ["DROPDOWN_SINGLE", "RADIO_BUTTON_GROUP", "CHECKLIST"].includes(f.type) ? hash : [],
      staticValue: f.type === "STATIC_TEXT" ? (hash[0] ?? `<h2>${f.label}</h2>`) : undefined,
      steps: f.type === "PROGRESS_BAR" ? hash : undefined,
      tabs: f.type === "TAB_GROUP" ? hash : undefined,
      questionnaire: f.type === "QUESTIONNAIRE"
        ? { columns: hash.filter(v => !v.startsWith("^")), rows: hash.filter(v => v.startsWith("^")).map(v => v.slice(1)) }
        : undefined,
      viewType: f.type === "FILE_UPLOAD" ? (f.flags.includes("multiple") ? "MULTIPLE" : "SINGLE") : undefined,
      params: f.type === "FILE_UPLOAD" ? { contentType: f.flags.includes("camera") ? "FOR_CAMERA" : "ALL" } : undefined,
      isRequired: f.flags.includes("req"),
      isUnique: f.flags.includes("uniq"),
      isReadonly: f.flags.includes("readonly"),
    });
    y += rows;
  });
}

/**
 * `--process-status <refBoId>` adds the process's own system field `PROCESS_STATUS` — the BO-reference
 * to the stand's built-in dictionary «Статус процесса» (its id is per-stand — read it off your own). The constructor
 * creates this field by itself; the IMPORTER does not `[C]` (2026-09-18), so an archive that wants a
 * process shaped like an exported one has to ship it. Its shape is copied verbatim off a real export —
 * `viewType: "SINGLE"`, `isSystem`/`isCodeReadonly`/`isRequired`, no `removeType`, no `tableColOrderIndex`.
 */
const processStatusRefBoId = flag("process-status", "");
if (CATEGORY === "BO_PROCESS" && processStatusRefBoId) {
  dynamicFields.PROCESS_STATUS = {
    code: "PROCESS_STATUS",
    newId: id(`${BO_CODE}.PROCESS_STATUS`),
    archetype: "DYNAMIC",
    kind: "GENERAL",
    boRefStruct: {
      boInfo: { code: "PROCESS_STATUS", name: "Статус процесса", boCategory: "BO_DICTIONARY" },
      fieldRefs: { label: { toShow: true, orderIndex: 2147483647 } },
    },
    label: { rus: "Статус процесса", kaz: "Процестің мәртебесі", qaz: "Procestiń märtbesi", eng: "Process status" },
    staticValue: {},
    isUnique: false, isRequired: true, isAppendable: false, isRequiredAll: false, isReadonly: false,
    isClickable: true, isSelectOnly: false, isSeparated: false, needAddToParticipants: false,
    needShowToCalendar: false, dateOnlyFuture: false, dateOnlyPast: false, needTrackStatus: false,
    tableColToShow: true, isHistoryTracking: false, isKindAddForSelect: false, titleToShow: false,
    questionnaireIsMultiple: false, isProgressBarSticky: false, hideLabel: false, chosenAccessRight: false,
    unacceptableValue: false, isSystem: true, isCodeReadonly: true, needLoadFromInTables: false,
    useAsKeyInMigration: false, needUploadToOutTable: false, needChangeParentBoByLinkedBo: true,
    needFreezeWhenScroll: false, needMarkNew: false, textCase: "NONE",
    type: "BO", viewType: "SINGLE",
    groupingInfo: {},
    oldRefBoId: processStatusRefBoId,
    // a real export puts the status first; here it goes under whatever `--field` already claimed
    gridPosition: { x: 0, y: Object.keys(dynamicFields).length * 4, cols: 8, rows: 4 },
    fieldTabs: {}, gantTableLocations: {}, boFieldCodes: [], linkedCoSettings: {},
    questionnaires: {}, progressSteps: {}, params: {},
  };
}

/**
 * SYSTEM fields. The label and the underlying `type` are fixed by the platform (they are what
 * `generate-business-form-field-by-native` returns), so the archive just repeats them; the key of the
 * map, `nativeFieldId` and the field's code are all the native type itself.
 */
const NATIVE_DEFS: Record<string, { label: Record<string, string>; type: string }> = {
  CREATED_AT: { label: { rus: "Дата создания", kaz: "Құрылған күні", qaz: "Qurylǵan kúni", eng: "Date of creation" }, type: "FULL_DATE" },
  LAST_MODIFIED_AT: { label: { rus: "Дата последнего изменения", kaz: "Соңғы өзгертілген күні", qaz: "Sońǵy ózgertilgen kúni", eng: "Last modified date" }, type: "FULL_DATE" },
  CREATED_BY: { label: { rus: "Автор", kaz: "Автор", qaz: "Avtor", eng: "Author" }, type: "BO" },
  LAST_MODIFIED_BY: { label: { rus: "Автор последнего изменения", kaz: "Соңғы өзгерістің авторы", qaz: "Sońǵy ózgeristiń avtory", eng: "The author of the last change" }, type: "BO" },
  OPEN_COUNT: { label: { rus: "Счетчик открытий", kaz: "Ашу есептегіші", qaz: "Ashý eseptegishi", eng: "Opening counter" }, type: "INPUT_NUMBER" },
  IN_MIGRATION_UPDATED_AT: { label: { rus: "Дата обновления IN миграции", kaz: "IN миграциясының жаңартылған күні", qaz: "IN migrasiasynyñ jañartylğan künı", eng: "Date of update IN migration" }, type: "FULL_DATE" },
};

let nativeY = Object.values(dynamicFields).reduce((m: number, f: any) =>
  Math.max(m, (f.gridPosition?.y ?? 0) + (f.gridPosition?.rows ?? 0)), 0);
const nativeFields: Record<string, object> = {};
for (const t of natives) {
  const def = NATIVE_DEFS[t];
  const isPerson = def.type === "BO";
  nativeFields[t] = {
    newId: id(`${BO_CODE}.native.${t}`),
    nativeFieldId: t,
    archetype: "NATIVE",
    // «Автор» and «Автор последнего изменения» point at the built-in «Пользователи» — by CODE, as always
    boRefStruct: isPerson ? { boInfo: { code: "Person", name: "Пользователи", boCategory: "BO" }, fieldRefs: {} } : { fieldRefs: {} },
    label: def.label,
    staticValue: {},
    chosenAccessRight: false,
    unacceptableValue: false,
    isSystem: false,
    isCodeReadonly: false,
    needLoadFromInTables: false,
    useAsKeyInMigration: false,
    needUploadToOutTable: false,
    needChangeParentBoByLinkedBo: false,
    needFreezeWhenScroll: false,
    needMarkNew: false,
    type: def.type,
    ...(isPerson ? { viewType: "SINGLE" } : {}),
    groupingInfo: {},
    gridPosition: { x: 0, y: (nativeY += isPerson ? 6 : 4) - (isPerson ? 6 : 4), cols: 15, rows: isPerson ? 6 : 4 },
    fieldTabs: {},
    gantTableLocations: {},
    boFieldCodes: [],
    linkedCoSettings: {},
    questionnaires: {},
    progressSteps: {},
    params: {},
  };
}

/** WIDGETS — one map per family; the key is the widget's code, which the stand shows in scripts. */
const widgetMaps: Record<string, Record<string, object>> = {
  signatures: {}, buttons: {}, iframes: {}, captcha: {}, currentDates: {}, currentUser: {},
};
const WIDGET_MAP: Record<string, string> = {
  SIGNATURE: "signatures", BUTTON: "buttons", IFRAME: "iframes", CAPTCHA: "captcha",
  CURRENT_DATE: "currentDates", CURRENT_DAY: "currentDates", CURRENT_MONTH: "currentDates",
  CURRENT_DAY_AND_MONTH: "currentDates", CURRENT_YEAR: "currentDates", CURRENT_USER: "currentUser",
};
let widgetY = nativeY;
for (const w of widgets) {
  const map = WIDGET_MAP[w.type];
  if (!map) throw new Error(`unknown --widget type ${w.type} (known: ${Object.keys(WIDGET_MAP).join(", ")})`);
  const rows = w.type === "SIGNATURE" || w.type === "CAPTCHA" || w.type === "CURRENT_USER" ? 6 : w.type === "IFRAME" ? 8 : 4;
  widgetMaps[map][w.code] = {
    label: { rus: w.label },
    gridPosition: { x: 0, y: (widgetY += rows) - rows, cols: 15, rows },
    code: w.code,
    type: w.type,
    newId: id(`${BO_CODE}.widget.${w.code}`),
    ...(w.url ? { url: w.url } : {}),
    ...(map === "currentDates" ? { widgetType: w.type } : {}),
    ...(map === "currentUser" ? { viewType: "TABLE", fieldRefs: {} } : {}),
    ...(map === "signatures" ? { fieldCodes: {}, massFieldCodes: {}, printFormCodes: {}, massPrintFormCodes: {} } : {}),
    ...(map === "buttons" ? { fieldCodes: {} } : {}),
  };
}

/**
 * KANBAN CARD TEMPLATES. In the archive the map is keyed by the CODE of the dropdown field whose options
 * become the columns, and each entry is `{kanbanFields: {<code>: {cardOrderIndex, locationType, archetype}}}`
 * — codes, never ids, exactly like the rest of a `BoStructDto` (shape taken from a stand export of a BO
 * whose kanban works, 2026-09-19). `archetype` repeats the field's own archetype: DYNAMIC for a field of
 * `dynamicFields`, NATIVE for one of `nativeFields`.
 */
const kanbanCardTemplates: Record<string, { kanbanFields: Record<string, object> }> = {};
for (const k of kanbans) {
  const columnCode = dynamicFields[k.column] ? k.column : codeOf(k.column);
  const column: any = dynamicFields[columnCode];
  if (!column) throw new Error(`--kanban column «${k.column}» is not a field of this BO`);
  if (!String(column.type).startsWith("DROPDOWN")) {
    throw new Error(`--kanban column «${k.column}» is ${column.type}; the columns come from a dropdown`);
  }
  const kanbanFields: Record<string, object> = {};
  for (const [locationType, names] of Object.entries(k.locations)) {
    let cardOrderIndex = 0;
    for (const name of names) {
      const isNative = NATIVE_DEFS[name] !== undefined;
      const code = isNative ? name : (dynamicFields[name] ? name : codeOf(name));
      if (isNative && !nativeFields[code]) throw new Error(`--kanban names «${name}», add it with --native ${name}`);
      if (!isNative && !dynamicFields[code]) throw new Error(`--kanban names «${name}», which is not a field of this BO`);
      kanbanFields[code] = { cardOrderIndex: cardOrderIndex++, locationType, archetype: isNative ? "NATIVE" : "DYNAMIC" };
    }
  }
  kanbanCardTemplates[columnCode] = { kanbanFields };
}

lines.push({
  "@class": `${PKG}.BoStructDto`,
  oldId: id(`bo.${BO_CODE}`),
  code: BO_CODE,
  category: CATEGORY,
  kind: "GENERAL",
  boGroupOldId: groupOldId,
  instanceViewType: "FORM",
  bos: sources,
  boTabs: {},
  printForms: [],
  name: { rus: BO_NAME },
  recordName: { rus: BO_NAME },
  staticValue: {},
  description: "",
  orderIndex: 47480000.0,
  dynamicFields,
  nativeFields,
  dictionaryFields: isDictionary ? ["CODE", "LABEL"] : [],
  actual: true,
  isCalendarEnabled: false,
  isMapEnabled: false,
  isGroupingEnabled: false,
  isCodeReadonly: false,
  chosenAccessRight: false,
  kanbanCardTemplates,
  timelineTemplates: {},
  calendarCardTemplates: {
    header: {},
    content: {},
    footer: {},
    headerDelFieldCodes: {},
    contentFieldCodes: {},
    footerDelFieldCodes: {},
  },
  signatures: widgetMaps.signatures,
  buttons: widgetMaps.buttons,
  iframes: widgetMaps.iframes,
  currentDates: widgetMaps.currentDates,
  captcha: widgetMaps.captcha,
  currentUser: widgetMaps.currentUser,
});

/**
 * A BUSINESS PROCESS carries a SECOND line: `BoProcessVersionsStructDto`, whose `oldId` is the BO's own
 * `oldId` (MYBPM-IMPORTS.md §5c). `workProcess` is the editable («Тест») version's diagram in the same
 * shape the editor's `load-bo-process-def` returns, except that every figure is a typed struct:
 * `…bo.process.figure.Figure<Type>Struct`. `processVersions` is empty until a version is put «в работу».
 *
 * `--process-figure "<Type>[@x,y]"` (repeatable) chains figures after the Enter the platform always
 * starts with; the default is a single Exit, i.e. the smallest diagram that validates.
 */
if (CATEGORY === "BO_PROCESS") {
  const FIG_PKG = "kz.greetgo.mybpm.reg.structure.model.bo.process.figure";
  const specs: { type: string; x: number; y: number }[] = [];
  for (let i = 0; i < Bun.argv.length; i++) {
    if (Bun.argv[i] !== "--process-figure") continue;
    const [type, pos] = (Bun.argv[i + 1] ?? "").split("@");
    const [x, y] = (pos ?? `${340 + specs.length * 220},104`).split(",").map(Number);
    specs.push({ type, x, y });
  }
  if (specs.length === 0) specs.push({ type: "Exit", x: 440, y: 104 });

  const enterId = id(`figure.${BO_CODE}.enter`);
  const figureStructs: Record<string, object> = {
    [enterId]: { "@class": `${FIG_PKG}.FigureEnterStruct`, x: 100, y: 100 },
  };
  const arrows: Record<string, object> = {};
  let prev = enterId;
  specs.forEach((spec, i) => {
    const figId = id(`figure.${BO_CODE}.${i}.${spec.type}`);
    figureStructs[figId] = { "@class": `${FIG_PKG}.Figure${spec.type}Struct`, x: spec.x, y: spec.y };
    arrows[id(`arrow.${BO_CODE}.${i}`)] = {
      startFigureId: prev, startSlotName: "main", finishFigureId: figId, finishSlotName: "main",
    };
    prev = figId;
  });

  lines.push({
    "@class": `${PKG}.BoProcessVersionsStructDto`,
    oldId: id(`bo.${BO_CODE}`),
    workProcess: { figureStructs, scriptsDefIds: [], arrows, runWayMap: {} },
    processVersions: {},
  });
}

// ---- zip writing (STORE only; no `zip` binary on this machine and Bun has no zip writer) ----

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosTime(d: Date): { time: number; date: number } {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

function zip(entries: { name: string; data: Uint8Array }[], now: Date): Uint8Array {
  const { time, date } = dosTime(now);
  const enc = new TextEncoder();
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const e of entries) {
    const name = enc.encode(e.name);
    const crc = crc32(e.data);

    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true);
    lh.setUint16(4, 20, true); // version needed
    lh.setUint16(6, 0x0800, true); // UTF-8 names
    lh.setUint16(8, 0, true); // method: stored
    lh.setUint16(10, time, true);
    lh.setUint16(12, date, true);
    lh.setUint32(14, crc, true);
    lh.setUint32(18, e.data.length, true);
    lh.setUint32(22, e.data.length, true);
    lh.setUint16(26, name.length, true);
    lh.setUint16(28, 0, true);
    local.push(new Uint8Array(lh.buffer), name, e.data);

    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true);
    ch.setUint16(4, 20, true); // version made by
    ch.setUint16(6, 20, true);
    ch.setUint16(8, 0x0800, true);
    ch.setUint16(10, 0, true);
    ch.setUint16(12, time, true);
    ch.setUint16(14, date, true);
    ch.setUint32(16, crc, true);
    ch.setUint32(20, e.data.length, true);
    ch.setUint32(24, e.data.length, true);
    ch.setUint16(28, name.length, true);
    ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), name);

    offset += 30 + name.length + e.data.length;
  }

  const centralSize = central.reduce((n, a) => n + a.length, 0);
  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true);
  eocd.setUint16(8, entries.length, true);
  eocd.setUint16(10, entries.length, true);
  eocd.setUint32(12, centralSize, true);
  eocd.setUint32(16, offset, true);

  const parts = [...local, ...central, new Uint8Array(eocd.buffer)];
  const out = new Uint8Array(parts.reduce((n, a) => n + a.length, 0));
  let p = 0;
  for (const a of parts) {
    out.set(a, p);
    p += a.length;
  }
  return out;
}

// ---- assemble ----

const now = new Date();
const stampUtc = now.toISOString().replace(/[:.]/g, "-").replace("T", "T").slice(0, 23); // 2026-09-18T05-29-24-428
const dataDir = `data-${stampUtc}`;
const enc = new TextEncoder();

const jsonl = lines.map((l) => JSON.stringify(l)).join("\n") + "\n";
const archive = zip(
  [
    { name: `${dataDir}/0000001.mybpm`, data: enc.encode(jsonl) },
    { name: `${dataDir}/metadata.mybpm`, data: enc.encode(`objectCount-${lines.length}`) },
  ],
  now,
);

const localStamp = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  .toISOString()
  .replace(/[:]/g, "-")
  .slice(0, 19);
const suffix = withMetadata ? "-meta" : "-nometa";
const outPath = `${outDir}/MyBPM-export-probe-${localStamp}${suffix}.mybpm.zip`;

await Bun.write(outPath, archive);
console.log(`${outPath}\n  lines: ${lines.length} (${lines.map((l) => (l as any)["@class"].split(".").pop()).join(", ")})\n  inner: ${dataDir}/`);
