#!/usr/bin/env bun
/**
 * Generates a minimal MyBPM structure archive (.mybpm.zip) with exactly ONE business object.
 *
 * Purpose: probe the importer on a live stand — see MYBPM-IMPORTS.md §1 and §8.
 * Attempt 1 deliberately ships only 2 JSONL lines (BoGroupStructDto + BoStructDto), WITHOUT
 * CompanyMetadataStructDto, to settle whether that line is mandatory ([U] in MYBPM-IMPORTS.md §1).
 *
 * The group line always carries a `code`: the importer matches groups BY `code` (MYBPM-IMPORTS.md 0.3,
 * §8) — an existing code puts the BO into that group, a new code CREATES a group named `--group-name`.
 * A line without `code` would RENAME one fixed stand group, so the generator never writes one.
 * A line WITH an existing code still OVERWRITES that group's name and orderIndex with its own (2026-09-30:
 * the old default «name = code» renamed a stand group «Тест» to its code and moved it), so
 * `--group-code`, `--group-name` and `--group-order` are all required — copy the three from
 * `load-bo-groups` for an existing group, choose them for a new one. Group `oldId` is
 * NOT stable — every export of the same stand group carries a different oldId/newId — so it only has
 * to tie the lines of this archive together.
 *
 * Usage:  bun tools/make-probe-archive.bun.ts --group-code CODE --group-name NAME --group-order N
 *         [--with-metadata] [--out DIR] [--code CODE] [--name NAME]
 *         [--category BO|BO_DICTIONARY|BO_COMPOSITE|BO_PANEL|BO_PROCESS] [--field "Метка:TYPE"]...
 *         [--process-figure "Exit@440,104"]... [--process-status <refBoId>]
 *         [--process-spec <spec.json>]   (a CONFIGURED process — the spec of tools/process-builder.ts)
 *         [--menu "Имя:GROUP"]... [--menu "Имя:BO@<код БО>[@Имя БО]!parent=…!kanban=…"]...
 *         [--print-form "Имя:код:file.docx[:PDF|DOCX]"]...
 *
 * The full `--field` grammar is «Метка:TYPE[@a][@b][#вариант|вариант][!req,uniq,readonly]»:
 *   --field "Дата:DATE!dateOnlyPast=true"                     — ANY key of the field, `!key=value`
 *   --field "Срок:DATE!track"                                 — «Отслеживать статус»: the date moves into a
 *     «Статус объекта» TAB_GROUP next to a «Статус» dropdown with the options PLANNED / OVERDUE / DONE /
 *     CANCELED — the three fields the constructor itself adds (MYBPM-UI-API.md §5h)
 *   --field "Офис:BO@<boId>@Ofis!show=Strana|Gorod"            — the columns of a nested-object table, by
 *     the TARGET's field codes (without it the importer shows none)
 *   --calendar                                                — the BO's «Календарь» view (isCalendarEnabled)
 *   --field "Номер:INPUT_TEXT!titleToShow=true,titleOrderIndex=0" — a part of the record name (card title),
 *     joined by spaces in titleOrderIndex order (MYBPM-IMPORTS.md §3 «Field flags» «Название записи»)
 *   --history                                                 — the record card's «История» tab (boTabs.HISTORY);
 *     a field is logged only with it AND "!isHistoryTracking=true" (MYBPM-IMPORTS.md §3 «Field flags»)
 *   --field "Табл:BO@<boId>@Cel!boRefStruct.linkedFieldCode=Roditel,removeType=HIDE,needMarkNew=true" — the
 *     «Отображение» / «Поведение» of a reference (MYBPM-IMPORTS.md §3 «Reference fields»): back field, removeType
 *     (STRIKETHROUGH / HIDE / DISCONNECT), viewType (TABLE / MULTIPLE / SINGLE / FIELDS), isKindAddForSelect,
 *     copyFromFieldCode=<another BO field>; a CO field links per SOURCE BO of its composite:
 *     --field "Состав:CO@<coId>@Sostav!linkedCoSettings.<source code>.linkedFieldCode=Back,linkedCoSettings.<source code>.removeType=HIDE"
 *     needChangeParentBoByLinkedBo=false is lost when the import CREATES the field — import the archive twice
 *     (dotted = nested, e.g. `!params.url=https://…`; value parsed as JSON, else a string; no «,» in it)
 *   --field "Наименование:INPUT_TEXT!req"                     — «Необходимо заполнять» (isRequired)
 *   --field "Табельный номер:INPUT_TEXT!uniq"                 — «Уникальное поле» (isUnique)
 *   --field "Должность:DROPDOWN_SINGLE@Dolzhnost@Должность"   — «Справочник» BY CODE (FROM_BO)
 *   --field "Статус:DROPDOWN_SINGLE#Новый|В работе|Готово"    — «Задать вручную» (FROM_FIELD)
 *   --field "Статус:DROPDOWN_SINGLE#Новый=BLUE|Готово=GREEN"  — the same with option colours (kanban columns)
 *   --field "Чек:CHECKLIST#Пункт 1|+Пункт 2!isSelectOnly=true,isAppendable=false" — items go to defaultValue
 *     (`+` = ticked), isAppendable defaults to true as in the constructor
 *   --field "Вкладки:TAB_GROUP#Шаг 1|>Справа!params.needDisableTabs=true" — `>` = a tab at the right end
 *   --field "Поле:INPUT_TEXT!tab=Vkladki/Shag_1"              — the field sits ON that tab (tabCodePath,
 *     its y counted from the top of the tab)
 *   --field 'Текст:TEXTAREA!params.buttonTypes=["bold","table"]' — a JSON value may hold commas inside []/{}/""
 *   (MYBPM-IMPORTS.md §3 «Per-type settings» for what each key does)
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
import { scriptBody, toArchiveScript, type ProcessSpec } from "./process-builder.ts";
import { zip } from "./zip.ts";

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

/** `--code X` / `--name Y` override the defaults; ids are derived from the code, so a new code = a new BO. */
function flag(name: string, fallback: string): string {
  const i = Bun.argv.indexOf(`--${name}`);
  return i >= 0 ? Bun.argv[i + 1] : fallback;
}

/**
 * `--process-spec <file>` — the SAME spec `tools/process-builder.ts` builds through the API (its header has
 * the grammar), emitted as an archive instead: the BO-reference fields, the typed figures (a Form names its
 * field by CODE), the named arrows and one `ScriptDefStructDto` per scripted figure (MYBPM-IMPORTS.md §5c).
 * Every `fields[]` entry needs `refBoCode` here — an archive names the target BO by code as well as by id.
 */
const PROCESS_SPEC: ProcessSpec | null = flag("process-spec", "")
  ? await Bun.file(flag("process-spec", "")).json()
  : null;

const BO_CODE = flag("code", "Proba_importa_20260918");
const BO_NAME = flag("name", PROCESS_SPEC?.name ?? "Проба импорта 2026-09-18");

/** BoStructDto.category — the same five kinds the group's kebab offers (MYBPM-UI-API.md §5b). */
const CATEGORY = flag("category", PROCESS_SPEC ? "BO_PROCESS" : "BO");

/**
 * `--field "Метка:TYPE"`, repeatable; the code is transliterated from the label the way the stand does
 * it. Without any `--field` the default pair (Наименование / Число) is kept, so old calls are unchanged.
 */
type FieldSpec = {
  label: string; type: string; refBoId?: string; refBoCode?: string;
  options: string[]; flags: string[];
  /** `!key=value` — any key of the archive field, dotted for a nested one (`params.url`). */
  sets: { path: string[]; value: unknown }[];
};
/** Split `a=1,b=["x","y"]` on the commas that are NOT inside [], {} or "" — a JSON value may carry its own. */
function splitTop(s: string): string[] {
  const out: string[] = []; let depth = 0, quote = false, cur = "";
  for (const ch of s) {
    if (ch === "\"") quote = !quote;
    else if (!quote && (ch === "[" || ch === "{")) depth++;
    else if (!quote && (ch === "]" || ch === "}")) depth--;
    if (ch === "," && depth === 0 && !quote) { out.push(cur); cur = ""; } else cur += ch;
  }
  out.push(cur);
  return out;
}
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
    if (bang >= 0) { flags = splitTop(spec.slice(bang + 1)).filter(Boolean); spec = spec.slice(0, bang); }
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
    // `key=value` sets ANY key of the archive field; the value is JSON when it parses, else a string.
    const sets = flags.filter(f => f.includes("=")).map(kv => {
      const eq = kv.indexOf("=");
      let value: unknown = kv.slice(eq + 1);
      try { value = JSON.parse(value as string); } catch { /* a bare string */ }
      return { path: kv.slice(0, eq).split("."), value };
    });
    flags = flags.filter(f => !f.includes("="));
    const unknown = flags.filter(f => !["req", "uniq", "readonly", "nocol", "multiple", "camera", "track"].includes(f));
    if (unknown.length) throw new Error(`unknown --field flag(s): ${unknown.join(", ")}`);
    out.push({ label: raw.slice(0, at), type, refBoId, refBoCode, options, flags, sets });
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
 * `url` is accepted by BUTTON and IFRAME only. For CURRENT_USER the 4th part is the view and the columns
 * instead: `SINGLE` / `TABLE`, optionally `/<code>,<code>…` = the CODES of the «Пользователи» fields to
 * show, in that order (e.g. `CURRENT_USER:Текущий пользователь:cur:SINGLE/surname,email`). Without it the
 * widget gets `TABLE` + `fieldRefs: {}`, which the stand turns into «Фамилия» + «Имя» (MYBPM-IMPORTS.md §0.5b).
 * For SIGNATURE the 4th part is its settings, «;»-separated: the codes of the fields to sign, then
 * `phone=<code of an INPUT_PHONE field>`, `pf=<print form code>,…` (from `--print-form`) and
 * `mass=<code of a BO field>,…` (e.g. `SIGNATURE:ЭЦП/SMS:podpis:Tekst,Otvet;phone=Telefon;pf=Dogovor`).
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

/**
 * `--menu "Имя:GROUP"` / `--menu "Имя:BO@<код БО>[@Имя БО]"`, repeatable — a SIDEBAR MENU ITEM
 * (`MenuItemStructDto`, MYBPM-IMPORTS.md §5e). A menu line references everything BY CODE: its parent by
 * `parentMenuItemCode`, its BO by `boCode`, the kanban column field by `boPages.kanbanFieldCode` — so it
 * travels with the BO in one archive, or alone against a BO that is already on the stand.
 * Options are appended with `!`:
 *   `!code=<код>`   override the code (default: transliterated from the name)
 *   `!parent=<код>` put it inside that menu GROUP
 *   `!kanban=<код поля>` turn the kanban view on, columns = that dropdown's options
 *   `!order=<n>`    orderIndex (default 900000 + 10000 per item); the built-in «Системные» is 60000
 *   `!icon=<имя>`   iconName, a name from MYBPM-IMPORTS.md 0.5e (default GROUP `bo-g-draggable`, BO `man-with-company`)
 *   `!panel` `!count` `!hidemob` — isPanel / needCountMenuItem / needHideInMobApp
 *
 *   --menu "Заявки:BO@Zayavki@Заявки"          a plain root item, list view only
 *   --menu "Проба меню:GROUP!order=950000"
 *   --menu "Проба канбана:BO@Proba_menu_bo@Проба меню БО!parent=Proba_menu!kanban=Status"
 * Only the list and kanban views are generated — calendar / timeline / map / grouping are `[U]` (0.5d).
 */
type MenuSpec = {
  code: string; name: string; type: "GROUP" | "BO";
  boCode?: string; boName?: string; parent?: string; kanbanField?: string;
  order: number; icon: string; isPanel: boolean; needCount: boolean; hideMob: boolean;
};

function menuFlags(): MenuSpec[] {
  const out: MenuSpec[] = [];
  for (let i = 0; i < Bun.argv.length; i++) {
    if (Bun.argv[i] !== "--menu") continue;
    const raw = Bun.argv[i + 1] ?? "";
    const bang = raw.indexOf("!");
    const head = bang < 0 ? raw : raw.slice(0, bang);
    const opts: Record<string, string> = {};
    if (bang >= 0) {
      for (const o of raw.slice(bang + 1).split("!").filter(Boolean)) {
        const eq = o.indexOf("=");
        if (eq < 0) opts[o.trim().toLowerCase()] = "";
        else opts[o.slice(0, eq).trim().toLowerCase()] = o.slice(eq + 1).trim();
      }
    }
    const colon = head.indexOf(":");
    if (colon < 1) {
      throw new Error(`--menu expects "Имя:GROUP" or "Имя:BO@<код БО>", got ${JSON.stringify(raw)}`);
    }
    const name = head.slice(0, colon);
    const [kind, boCode, boName] = head.slice(colon + 1).split("@");
    const type = kind.trim().toUpperCase();
    if (type !== "GROUP" && type !== "BO") {
      throw new Error(`--menu type must be GROUP or BO, got ${JSON.stringify(kind)}`);
    }
    if (type === "BO" && !boCode) {
      throw new Error(`--menu "${name}:BO" needs the BO code: "Имя:BO@<код БО>"`);
    }
    if (type === "GROUP" && opts.kanban) {
      throw new Error(`--menu "${name}": !kanban belongs to a BO item, a GROUP has no pages`);
    }
    out.push({
      code: opts.code || codeOf(name),
      name,
      type,
      boCode,
      boName: boName || boCode,
      parent: opts.parent,
      kanbanField: opts.kanban,
      order: opts.order ? Number(opts.order) : 900000 + out.length * 10000,
      icon: opts.icon || (type === "GROUP" ? "bo-g-draggable" : "man-with-company"),
      isPanel: "panel" in opts,
      needCount: "count" in opts,
      hideMob: "hidemob" in opts,
    });
  }
  return out;
}

/**
 * Cyrillic → latin the way the server generates field/BO codes (see MYBPM-UI-API.md §5b). «ё» is not in
 * the server's table, so it becomes «_» like any other foreign character (2026-10-01: option «Зелёный» →
 * `Zel_nyyi`).
 */
const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z", и: "i", й: "yi",
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
    // «Динамическая высота» exists only on a BO field — the constructor offers none on a CO (MYBPM-UI-API.md §5h)
    ...(o.refBoId ? { oldRefBoId: o.refBoId, viewType: o.viewType ?? "TABLE" } : {}),
    ...(o.refBoId && o.type === "BO" ? { isHeightDynamic: true } : {}),
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
          // «Красный=RED» — the option's colour (RED GREEN YELLOW BLUE ORANGE PURPLE …), else none
          options: Object.fromEntries(o.options.map((spec, i) => {
            const eq = spec.lastIndexOf("=");
            const label = eq > 0 ? spec.slice(0, eq) : spec;
            const color = eq > 0 ? spec.slice(eq + 1) : null;
            const optCode = codeOf(label);
            return [optCode, {
              fieldOption: { label, orderIndex: i * 10000, color, code: optCode, hiddenInKanban: false },
              newOptionId: id(`${BO_CODE}.${o.code}.${optCode}`),
            }];
          })),
          dictionaryOptionSetting: {},
        },
      }
      : {}),
    // «Вкладки»: one entry per tab, keyed by the tab's transliterated code (export shape).
    // «>Справа» = a tab on the RIGHT end of the strip (isRight).
    fieldTabs: Object.fromEntries((o.tabs ?? []).map((spec, i) => {
      const isRight = spec.startsWith(">");
      const label = isRight ? spec.slice(1) : spec;
      const tabCode = codeOf(label);
      return [tabCode, {
        label: { rus: label }, orderIndex: i * 10000, chosenAccessRight: false,
        isRight, isDefault: i === 0, code: tabCode,
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

/**
 * `--group-code` — the group is matched BY CODE, and the line then OVERWRITES that group's name and
 * orderIndex, so `--group-name` / `--group-order` must repeat the stand's own values (load-bo-groups).
 */
const GROUP_CODE = flag("group-code", "");
const GROUP_NAME = flag("group-name", "");
const GROUP_ORDER = Number(flag("group-order", ""));
if (!GROUP_CODE || !GROUP_NAME || !Number.isFinite(GROUP_ORDER) || !flag("group-order", ""))
  throw new Error("--group-code, --group-name and --group-order are all required: copy code, name and orderIndex of an existing group from load-bo-groups (the import overwrites name and orderIndex), or choose them for a new group");
const groupOldId = id(`group.${GROUP_CODE}`);

const lines: object[] = [];

if (withMetadata) {
  lines.push({ "@class": `${PKG}.CompanyMetadataStructDto`, ...COMPANY_METADATA });
}

lines.push({
  "@class": `${PKG}.BoGroupStructDto`,
  oldId: groupOldId,
  name: GROUP_NAME,
  code: GROUP_CODE,
  orderIndex: GROUP_ORDER,
  kind: "MANUAL",
  newId: id(`group.new.${GROUP_CODE}`),
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
for (const f of PROCESS_SPEC?.fields ?? []) {
  if ((f.type ?? "BO") !== "BO") { custom.push({ label: f.label, type: f.type!, options: [], flags: [] }); continue; }
  if (!f.refBoCode) throw new Error(`--process-spec: field «${f.label}» needs refBoCode for the archive`);
  custom.push({ label: f.label, type: "BO", refBoId: f.refBoId, refBoCode: f.refBoCode, options: [], flags: [] });
}
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
  const tabY = new Map<string, number>();
  let col = Object.keys(dynamicFields).length;
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
      options: ["DROPDOWN_SINGLE", "RADIO_BUTTON_GROUP"].includes(f.type) ? hash : [],
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
    // «Чек лист»: the items are the field's defaultValue, a JSON STRING (MYBPM-IMPORTS.md 0.5) — never
    // fieldOptionsStruct, which the importer ignores; «+Пункт» starts ticked. isAppendable as the constructor sets it.
    if (f.type === "CHECKLIST" && hash.length) Object.assign(dynamicFields[code] as any, {
      defaultValue: JSON.stringify(hash.map(h => ({ label: h.replace(/^\+/, ""), checked: h.startsWith("+") }))),
      isAppendable: true,
    });
    if (f.flags.includes("track")) addTrackStatus(code, y);
    let inTab = false;
    for (const { path, value } of f.sets) {
      // `!tab=<код вкладок>/<код вкладки>` — the field sits ON that tab: tabCodePath, and its y counts from the
      // top of the tab (MYBPM-IMPORTS.md «tabCodePath»), so the form below does not move down.
      if (path[0] === "tab") {
        const [tabGroupCode, tabCode] = String(value).split("/");
        const key = `${tabGroupCode}/${tabCode}`;
        const ty = tabY.get(key) ?? 0;
        Object.assign(dynamicFields[code] as any, { tabCodePath: { tabGroupCode, tabCode }, gridPosition: { x: 0, y: ty, cols: 15, rows } });
        tabY.set(key, ty + rows);
        inTab = true;
        continue;
      }
      // `!show=Strana|Gorod` — the COLUMNS a nested-object table shows, by the target BO's field codes.
      // Without it the importer lists the target's fields with `toShow: false` and the table is blank.
      if (path[0] === "show" && isRef) {
        (dynamicFields[code] as any).boRefStruct.fieldRefs = Object.fromEntries(String(value).split("|")
          .map((c, j) => [c, { toShow: true, orderIndex: j }]));
        continue;
      }
      let o: any = dynamicFields[code];
      for (const k of path.slice(0, -1)) o = o[k] ??= {};
      // the stand keeps every `params` value as a string (`"enableSequence": "true"`) — write it that way
      // (an array or object goes in as its JSON text — `params.buttonTypes` is `"[\"bold\",…]"`)
      o[path.at(-1)!] = path[0] === "params" && typeof value !== "string"
        ? (typeof value === "object" && value !== null ? JSON.stringify(value) : String(value)) : value;
    }
    // a field on a tab stays out of the form stack: no y, and no slot in the form-order column index
    if (!inTab) { y += rows; (dynamicFields[code] as any).tableColOrderIndex = col++; }
  });
}

/**
 * «Отслеживать статус» on a date field (DATE, FULL_DATE, PERIOD, PERIOD_TIME) — the three fields the
 * constructor's `saveNeedTrackStatus` builds, shaped as a stand export writes them (2026-09-30): a
 * TAB_GROUP wrapper with one tab «Статус объекта» and a «Статус» DROPDOWN_SINGLE, both carrying
 * `trackedFieldCode`, and the date itself moved into that tab (`tabCodePath`, 9×3 at the left).
 * The dropdown's option IDS must be exactly PLANNED / OVERDUE / DONE / CANCELED: the record card sets the
 * status by those ids when the date is entered, and the calendar colours an event by them.
 */
function addTrackStatus(dateCode: string, y: number) {
  const wrapCode = `${dateCode}_status`.slice(0, 30);
  const tabCode = "Status_obekta";
  const statusCode = `Status_${dateCode}`.slice(0, 30);
  const tabCodePath = { tabGroupCode: wrapCode, tabCode };
  const date: any = dynamicFields[dateCode];
  Object.assign(date, { needTrackStatus: true, tabCodePath, gridPosition: { x: 0, y: 0, cols: 9, rows: 3 } });
  const wrap: any = field({ code: wrapCode, label: "", type: "TAB_GROUP", x: 0, y, cols: 15, rows: 4, tableColToShow: false });
  Object.assign(wrap, {
    label: {}, trackedFieldCode: dateCode,
    fieldTabs: {
      [tabCode]: {
        label: { rus: "Статус объекта" }, orderIndex: 0, chosenAccessRight: false, isRight: false,
        isDefault: false, code: tabCode, newId: id(`${BO_CODE}.${wrapCode}.tab.${tabCode}`),
      },
    },
  });
  const status: any = field({ code: statusCode, label: "Статус", type: "DROPDOWN_SINGLE", x: 9, y: 0, cols: 6, rows: 3 });
  const opts: [string, string, string][] = [
    ["PLANNED", "Запланировано", "#0048ff"], ["OVERDUE", "Просрочено", "#d3a52f"],
    ["DONE", "Выполнено", "#6797fa"], ["CANCELED", "Отменено", "#6797fa"],
  ];
  Object.assign(status, {
    trackedFieldCode: dateCode, tabCodePath,
    fieldOptionsStruct: {
      optionSource: "FROM_FIELD",
      options: Object.fromEntries(opts.map(([oid, label, color]) => [oid, {
        fieldOption: { label, orderIndex: 0, color, code: codeOf(label), hiddenInKanban: false },
        newOptionId: oid,
      }])),
      dictionaryOptionSetting: {},
    },
  });
  dynamicFields[wrapCode] = wrap;
  dynamicFields[statusCode] = status;
}

/**
 * A process's own BO-reference field (the record a Form step shows) is exported as a SINGLE picker, not
 * the TABLE a panel's nested object is: `viewType: "SINGLE"`, not «добавить для выбора», no column, no
 * dynamic height (read off the export of the API-built probe, 2026-09-27).
 */
for (const f of PROCESS_SPEC?.fields ?? []) {
  if ((f.type ?? "BO") !== "BO") continue; // e.g. a Timer's FULL_DATE: an ordinary field, left as generated
  const df: any = dynamicFields[codeOf(f.label)];
  Object.assign(df, { viewType: "SINGLE", isKindAddForSelect: false, tableColToShow: false });
  delete df.isHeightDynamic;
  delete df.tableColOrderIndex;
}

/**
 * `--process-status <refBoId>` adds the process's own system field `PROCESS_STATUS` — the BO-reference
 * to the stand's built-in dictionary «Статус процесса» (its id is per-stand — read it off your own). The constructor
 * creates this field by itself; the IMPORTER does not `[C]` (2026-09-18), so an archive that wants a
 * process shaped like an exported one has to ship it. Its shape is copied verbatim off a real export —
 * `viewType: "SINGLE"`, `isSystem`/`isCodeReadonly`/`isRequired`, no `removeType`, no `tableColOrderIndex`.
 *
 * `--process-status <refBoId>:<CREATED row id>` also gives the field its DEFAULT VALUE — the dictionary
 * row `CREATED` («Только что создан»; its id is per-stand too). Without it the field is required AND
 * empty, so every record of the process is refused on save («validate_required_title») and the process
 * never starts `[C]` (2026-09-27). The default takes only together with the export's separate
 * `ExportStructInstanceDto` line for that row (see `pushStatusDefault` below), which is written too.
 */
const [processStatusRefBoId, processStatusCreatedId] = flag("process-status", "").split(":");
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
    ...(processStatusCreatedId ? {
      defaultValue: JSON.stringify([processStatusCreatedId]),
      defaultValueMap: { RUS: JSON.stringify([processStatusCreatedId]) },
    } : {}),
    // a real export puts the status first; here it goes under whatever `--field` already claimed
    gridPosition: { x: 0, y: Object.values(dynamicFields).reduce((m: number, f: any) =>
      Math.max(m, (f.gridPosition?.y ?? 0) + (f.gridPosition?.rows ?? 0)), 0), cols: 8, rows: 4 },
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

/**
 * PRINT FORMS — `--print-form "<Имя>:<код>:<file.docx>[:PDF|DOCX]"`, repeatable. The BO lists them in
 * `printForms`, and the .docx template itself travels in the archive as an `ExportStructFileDto` line
 * (base64 `content`), written BEFORE the BoStructDto as a stand export does; the import uploads it as a new
 * file (MYBPM-IMPORTS.md §0.5b «Print forms»). The last part is the output type, PDF by default.
 */
const printForms: { name: string; printFormCode: string; fileId: string; fileType: string; orderIndex: number; newId: string }[] = [];
const printFormFiles: object[] = [];
for (let i = 0; i < Bun.argv.length; i++) {
  if (Bun.argv[i] !== "--print-form") continue;
  const [name, code, path, type = "PDF"] = (Bun.argv[i + 1] ?? "").split(":");
  if (!name || !code || !path?.endsWith(".docx")) throw new Error(`--print-form expects "Имя:код:file.docx[:PDF|DOCX]", got ${JSON.stringify(Bun.argv[i + 1])}`);
  if (type !== "PDF" && type !== "DOCX") throw new Error(`--print-form type must be PDF or DOCX, got ${type}`);
  const bytes = new Uint8Array(await Bun.file(path).arrayBuffer());
  const fileId = createHash("sha256").update(`${BO_CODE}.pf.${code}`).digest("hex").slice(0, 24).toUpperCase();
  printForms.push({ name, printFormCode: code, fileId, fileType: type, orderIndex: printForms.length, newId: id(`${BO_CODE}.pf.${code}`) });
  printFormFiles.push({
    "@class": `${PKG}.ExportStructFileDto`, fileId, name: path.split("/").pop(),
    content: bytes.toBase64(),
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
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
/** CURRENT_USER: "SINGLE/surname,email" → viewType + fieldRefs keyed by «Пользователи» field codes. */
function currentUserSettings(spec?: string): { viewType: string; fieldRefs: Record<string, object> } {
  if (!spec) return { viewType: "TABLE", fieldRefs: {} };
  const [viewType, cols = ""] = spec.split("/");
  if (viewType !== "TABLE" && viewType !== "SINGLE") throw new Error(`CURRENT_USER view must be TABLE or SINGLE, got ${viewType}`);
  const codes = cols.split(",").map((c) => c.trim()).filter(Boolean);
  return { viewType, fieldRefs: Object.fromEntries(codes.map((c, i) => [c, { toShow: true, orderIndex: i }])) };
}
/** SIGNATURE: "Tekst,Otvet;phone=Telefon;pf=Dogovor;mass=Regiony" → the four maps + signingPhoneCode. */
function signatureSettings(spec?: string): object {
  const out: any = { fieldCodes: {}, massFieldCodes: {}, printFormCodes: {}, massPrintFormCodes: {} };
  if (!spec) return out;
  const own = (code: string, what: string) => {
    const f: any = dynamicFields[code];
    if (!f) throw new Error(`SIGNATURE ${what} «${code}» is not a field code of this BO`);
    return f;
  };
  for (const part of spec.split(";").map((x) => x.trim()).filter(Boolean)) {
    const eq = part.indexOf("=");
    const key = eq < 0 ? "fields" : part.slice(0, eq);
    const vals = (eq < 0 ? part : part.slice(eq + 1)).split(",").map((x) => x.trim()).filter(Boolean);
    if (key === "fields") for (const c of vals) { own(c, "field"); out.fieldCodes[c] = { ownerFieldArchetype: "DYNAMIC", fieldCodes: [] }; }
    else if (key === "mass") for (const c of vals) {
      if (own(c, "mass field").type !== "BO") throw new Error(`SIGNATURE mass field «${c}» must be a BO field`);
      out.massFieldCodes[c] = { ownerFieldArchetype: "DYNAMIC", fieldCodes: [] };
    }
    else if (key === "phone") {
      if (own(vals[0], "phone").type !== "INPUT_PHONE") throw new Error(`SIGNATURE phone «${vals[0]}» must be an INPUT_PHONE field`);
      out.signingPhoneCode = vals[0];
    }
    else if (key === "pf") for (const c of vals) {
      if (!printForms.some((f) => f.printFormCode === c)) throw new Error(`SIGNATURE pf «${c}» is not a --print-form code`);
      out.printFormCodes[c] = 1;
    }
    else throw new Error(`SIGNATURE settings: unknown key «${key}» (fields / phone= / pf= / mass=)`);
  }
  return out;
}
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
    ...(w.url && map !== "currentUser" && map !== "signatures" ? { url: w.url } : {}),
    ...(map === "currentDates" ? { widgetType: w.type } : {}),
    ...(map === "currentUser" ? currentUserSettings(w.url) : {}),
    ...(map === "signatures" ? signatureSettings(w.url) : {}),
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

// a print form's template precedes the BO, as in a stand export
lines.push(...printFormFiles);

lines.push({
  "@class": `${PKG}.BoStructDto`,
  oldId: id(`bo.${BO_CODE}`),
  code: BO_CODE,
  category: CATEGORY,
  kind: "GENERAL",
  boGroupOldId: groupOldId,
  instanceViewType: "FORM",
  bos: sources,
  // `--history` = the card's «История» tab; without it no isHistoryTracking field is ever logged
  boTabs: args.has("--history") ? { HISTORY: 1 } : {},
  printForms,
  name: { rus: BO_NAME },
  recordName: { rus: BO_NAME },
  staticValue: {},
  description: "",
  orderIndex: 47480000.0,
  dynamicFields,
  nativeFields,
  dictionaryFields: isDictionary ? ["CODE", "LABEL"] : [],
  actual: true,
  // `--calendar` = the registry's «Календарь» view (a BO built in the constructor gets it by default)
  isCalendarEnabled: args.has("--calendar"),
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
const FIG_PKG = "kz.greetgo.mybpm.reg.structure.model.bo.process.figure";

/**
 * The `CREATED` row as the export writes it: an `ExportStructInstanceDto` whose source is
 * `DEFAULT_VALUE` of this BO's `PROCESS_STATUS`. **It is needed TOGETHER with `defaultValue` on the field**
 * `[C]` (2026-09-27, `<stand>`): a new BO imported with the field key alone kept `defaultValue "[]"`, with
 * this line alone likewise (archive-2); with both the default took (archive-3, and the patched export of
 * 4c2, which carried the export's own line). Goes between the BO and the versions line, as in an export.
 */
function pushStatusDefault() {
  if (!processStatusCreatedId) return;
  lines.push({
    "@class": `${PKG}.ExportStructInstanceDto`,
    compositeId: `${processStatusRefBoId}-${processStatusCreatedId}`,
    boCode: "PROCESS_STATUS",
    kind: "GENERAL",
    fieldMap: {
      code: { type: "INPUT_TEXT", storedValue: "CREATED", isUnique: true, showTable: true, orderIndex: 2147483647, kind: "GENERAL" },
      label: { type: "INPUT_TEXT_LANG", storedValue: JSON.stringify({ ENG: "Just created", KAZ: "Жақында жасалды",
        QAZ: "Zhaqynda zhasaldy", RUS: "Только что создан" }), isUnique: false, showTable: true, orderIndex: 2147483647, kind: "GENERAL" },
    },
    sources: [{ sourceType: "DEFAULT_VALUE", defaultValueInstanceSource: { boCode: BO_CODE, fieldCode: "PROCESS_STATUS" } }],
  });
}

if (CATEGORY === "BO_PROCESS" && PROCESS_SPEC) {
  /**
   * The configured process. The diagram goes into `workProcess` (imported as the WORK version, §5c) and
   * every script's `compositeId` is `<version id>-<figure id>` — for `workProcess` the version id is one
   * we mint; the exporter writes the platform's own. Figure / arrow / block ids are derived from the BO
   * code and the spec keys, so the same spec + code always yields the same archive.
   */
  const spec = PROCESS_SPEC;
  const versionId = id(`version.${BO_CODE}`);
  const figures: Record<string, string> = {};
  const arrowIds: Record<string, string> = {};
  const fieldCodes: Record<string, string> = Object.fromEntries((spec.fields ?? []).map(f => [f.key, codeOf(f.label)]));
  const figureStructs: Record<string, object> = {};
  for (const f of spec.figures) {
    const figId = id(`figure.${BO_CODE}.${f.key}`);
    figures[f.key] = figId;
    const struct: Record<string, unknown> = { "@class": `${FIG_PKG}.Figure${f.type}Struct`, x: f.x, y: f.y };
    if (f.type === "Form") {
      if (f.field && !fieldCodes[f.field]) throw new Error(`Form ${f.key}: unknown field key ${f.field}`);
      if (f.field) struct.fieldCode = fieldCodes[f.field];
    }
    if (f.type === "Timer") {
      // the editor's `fieldId` becomes a code + archetype, as in the exports of real processes (§5c)
      if (f.field && !fieldCodes[f.field]) throw new Error(`Timer ${f.key}: unknown field key ${f.field}`);
      if (f.field) Object.assign(struct, { archetype: "DYNAMIC", fieldCode: fieldCodes[f.field] });
    }
    // as exported (2026-09-27): the branch count is the only setting; a Terminator carries just x, y
    if (f.type === "SingleToParallel") struct.outSlotsCount = f.slots ?? 2;
    if (f.type === "ParallelToSingle") struct.inSlotsCount = f.slots ?? 2;
    figureStructs[figId] = struct;
  }
  const arrows: Record<string, object> = {};
  for (const a of spec.arrows) {
    const arrId = id(`arrow.${BO_CODE}.${a.key}`);
    arrowIds[a.key] = arrId;
    if (!figures[a.from] || !figures[a.to]) throw new Error(`arrow ${a.key}: unknown figure`);
    arrows[arrId] = {
      ...(a.name ? { name: a.name } : {}),
      startFigureId: figures[a.from], startSlotName: a.fromSlot,
      finishFigureId: figures[a.to], finishSlotName: a.toSlot,
    };
  }
  const scriptLines: object[] = [];
  for (const [figKey, sc] of Object.entries(spec.scripts ?? {})) {
    const figId = figures[figKey];
    if (!figId) throw new Error(`script for unknown figure ${figKey}`);
    let n = 0;
    const body = scriptBody(sc,
      key => { if (!arrowIds[key]) throw new Error(`script ${figKey}: unknown arrow ${key}`); return arrowIds[key]; },
      seg => seg.startsWith("@") ? (fieldCodes[seg.slice(1)] ?? (() => { throw new Error(`unknown field ${seg}`); })()) : seg,
      () => id(`script.${BO_CODE}.${figKey}.${n++}`));
    scriptLines.push({ "@class": `${PKG}.ScriptDefStructDto`, compositeId: `${versionId}-${figId}`, ...toArchiveScript(body) });
  }
  // the export's own order: the script bodies BEFORE the versions line, the BO after both
  lines.splice(lines.length - 1, 0, ...scriptLines);
  pushStatusDefault();
  lines.push({
    "@class": `${PKG}.BoProcessVersionsStructDto`,
    oldId: id(`bo.${BO_CODE}`),
    workProcess: {
      figureStructs,
      scriptsDefIds: scriptLines.map((l: any) => l.compositeId),
      methodScriptIds: [],
      arrows,
      runWayMap: {},
    },
    processVersions: {},
  });
} else if (CATEGORY === "BO_PROCESS") {
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

  pushStatusDefault();
  lines.push({
    "@class": `${PKG}.BoProcessVersionsStructDto`,
    oldId: id(`bo.${BO_CODE}`),
    workProcess: { figureStructs, scriptsDefIds: [], arrows, runWayMap: {} },
    processVersions: {},
  });
}

// ---- sidebar menu items (MenuItemStructDto) ----

for (const m of menuFlags()) {
  const line: Record<string, unknown> = {
    "@class": `${PKG}.MenuItemStructDto`,
    menuItemCode: m.code,
    menuItemName: m.name,
  };
  if (m.parent) line.parentMenuItemCode = m.parent;
  if (m.type === "BO") {
    line.boCode = m.boCode;
    line.boName = m.boName;
  }
  line.iconName = m.icon;
  line.orderIndex = m.order;
  // A GROUP carries no `boPages` and no `bracketFilter` at all — that is how the stand exports it.
  if (m.type === "BO") {
    line.boPages = {
      isKanbanEnabled: !!m.kanbanField,
      kanbanIndex: m.kanbanField ? 1 : 0,
      isCalendarEnabled: false,
      calendarIndex: 0,
      isTimelineEnabled: false,
      timelineIndex: 0,
      isListEnabled: true,
      listIndex: m.kanbanField ? 2 : 1,
      isMapEnabled: false,
      mapIndex: 0,
      isGroupingEnabled: false,
      groupingIndex: 0,
      ...(m.kanbanField ? { kanbanFieldCode: m.kanbanField } : {}),
    };
  }
  line.chosenAccessRight = false;
  line.needCountMenuItem = m.needCount;
  line.isPanel = m.isPanel;
  line.needHideInMobApp = m.hideMob;
  if (m.type === "BO") line.bracketFilter = { boCode: m.boCode, type: "MENU_ITEM", brackets: {} };
  line.menuItemType = m.type;
  lines.push(line);
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
