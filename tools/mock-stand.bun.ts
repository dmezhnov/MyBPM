// A mock MyBPM stand used to VERIFY §0U of MYBPM-UI-API.md and to test the mybpm-stand MCP server.
//
//   PORT=8080 bun tools/mock-stand.bun.ts tool.jsonl     # then drive a client at http://127.0.0.1:$PORT
//
// Drive `tools/create-bo-constructor.bun.ts` (stand-verified) and `tools/follow-cookbook-stand.bun.ts`
// (written from §0U alone) through the same recipe against it, then diff the two request files:
// they must agree on every path, every parameter and every body, including the JSON inside `jsonPart`.
// The Bun tool hardcodes `https://`, so test it through a copy with the scheme rewritten to `http://`.
//
// `mise test` drives `mcp/mybpm-stand.cjs` against it (MYBPM_STAND=http://127.0.0.1:$PORT): the import cycle
// (upload → insert → analyze → apply → rollback, cancel), the structure export, the bell, the accounts. The BOs of an
// uploaded archive appear on apply and disappear on rollback, so bo_find shows what the stand would. A login with the
// password «secret» answers the token `mock-token-<login>`, and that token's session is <login>; any other token is admin@mock.
// The constructor is stateful too: create-bo, the portion save (only addedFieldIds / editedFields / deletedFieldIds change
// the stored fields — a change made only inside formFields is dropped, as on a stand, trap 53), field / widget / BO codes,
// a soft delete, and the composite draft cycle (`v2/co/load-mock-open-drafts` counts the drafts left open). The records xlsx
// too: the template (GET), the import act, its apply and the export answer real xlsx files built and read here.
//
// A mock MyBPM stand: records every request and answers canned DTOs, so two independent clients can be
// driven over the same recipe and their request streams diffed.
import { unzip, zip } from "./zip.ts";

const log: any[] = [];
const FIELD_IDS = ["fieldAAAAAAAAAA01", "fieldAAAAAAAAAA02", "fieldAAAAAAAAAA03"];
let generated = 0;
const out = Bun.argv[2] ?? "requests.jsonl";

function answer(path: string, params: any, body: any): any {
  if (path.endsWith("/load-bo-groups")) return [{ id: "N50iWQkw0iySlAKo", name: "Бизнес-объект", code: null, orderIndex: 1110000, kind: "MANUAL" }];
  if (path.endsWith("/create-bo")) return { id: "BO00000000000001", name: "Бизнес объект №9", nameReadonly: false, viewState: "ACTIVE", orderIndex: 10, boCategory: body.boCategory };
  if (path.endsWith("/save-business-object-portion")) return "acc-1";
  if (path.endsWith("/load-business-object-by-id")) return { id: "BO00000000000001", name: "Демо из кукбука", code: "Demo_iz_kukbuka", boCategory: "BO", isDictionary: false, formFields: [], kind: "GENERAL" };
  if (path.endsWith("/generate-business-form-field")) return { fieldId: FIELD_IDS[generated++], label: null, labelMap: null, code: null, type: params.fieldType, gridPosition: { x: 0, y: 0, cols: 15, rows: 4 } };
  return null;
}

// ── the MCP server's routes: a stateful import, export and bell ──────────────────────────────────────────
type Bo = { id: string; code: string; name: string; boCategory: string; fields?: any[]; deleted?: boolean; co?: Co; window?: unknown };
type CoField = { coFieldId: string; label: string; code: string; links: { boId: string; fieldId: string }[] };
type Co = { sources: string[]; fields: CoField[] };
const bos = new Map<string, Bo>(); // id → BO present on the stand
const live = () => [...bos.values()].filter((b) => !b.deleted);
const byCode = (code: string) => live().find((b) => b.code === code);
const parts = new Map<string, string>(); // portion-save accumulator id → the JSON so far
const drafts = new Map<string, { coId: string } & Co>();
const copyCo = (c: Co): Co => JSON.parse(JSON.stringify(c));
const imports = new Map<string, { status: string; fileName: string; bos: Bo[]; description: string | null }>();
let bell: { id: string; header: string; body: string; happenedAt: number }[] = [{ id: "NOTE_OLD_0000001", header: "Старое", body: "не наше", happenedAt: 1 }];
let seq = 0;
const nextId = (p: string) => `${p}${String(++seq).padStart(16 - p.length, "0")}`;
const raced = new Set<string>();
// access rights (R5): a group per target; units persist only through orgUnitToAdd / orgUnitToDelete (trap 3)
const ORG = [{ id: "GROUP00000000001", type: "GROUP", name: "Менеджеры", avatar: null, parentGroupNames: "", email: null },
  { id: "PERSON0000000001", type: "PERSON", name: "Mock Admin", avatar: null, parentGroupNames: "Все", email: null }];
const NAV: any[] = [{ id: "MENU000000000001", code: "mcp_menu", type: "BO", displayName: "Клиенты", iconName: "phosphor:users", parentId: null, orderIndex: 100000 }];
const filters = new Map<string, any>(); // bracket filter id → {id, boId, brackets}
/** A record under a bracket tree (UI-API §4 «Record filters»): AND inside, own filters ignored with sub-brackets, siblings by the earlier one. */
const inBracket = (r: any, b: any): boolean => {
  let ok: boolean;
  if (b.brackets?.length) {
    ok = inBracket(r, b.brackets[0]);
    for (let i = 1; i < b.brackets.length; i++) ok = b.brackets[i - 1].connectionType === "OR" ? ok || inBracket(r, b.brackets[i]) : ok && inBracket(r, b.brackets[i]);
  } else ok = (b.dynamicFilters ?? []).every((f: any) => {
    const v = r.values[f.fieldId], x = fieldsOf(r.boId).find((y) => y.fieldId === f.fieldId);
    if (f.isEmptyValue) return v == null || v === "";
    const want = x?.options?.find((o: any) => o.code === f.value)?.id ?? f.value;
    return String(v ?? "") === String(want);
  });
  return b.notType === "NOT" ? !ok : ok;
};
const access = new Map<string, any>(), chosen = new Map<string, boolean>();
const ACTIONS = ["all", "view", "edit", "create", "delete", "archive", "export", "duplicate", "add"];
const accessOf = (key: string) => {
  if (!access.has(key)) access.set(key, Object.fromEntries([...ACTIONS.map((k) => [k, { accessForAll: true, participants: false, authorsField: null,
    fromFields: {}, orgUnitRecordList: [], orgUnitToAdd: [], orgUnitToDelete: [] }]), ["useAll", false]]));
  return JSON.parse(JSON.stringify(access.get(key)));
};
const saveAccess = (key: string, g: any) => {
  const cur = accessOf(key);
  for (const [k, v] of Object.entries<any>(g ?? {})) {
    if (!v || typeof v !== "object") { cur[k] = v; continue; }
    const drop = new Set((v.orgUnitToDelete ?? []).map((u: any) => u.id));
    const list = [...(cur[k]?.orgUnitRecordList ?? []).filter((u: any) => !drop.has(u.id)), ...(v.orgUnitToAdd ?? [])];
    cur[k] = { ...v, orgUnitRecordList: list, orgUnitToAdd: [], orgUnitToDelete: [] };
  }
  access.set(key, cur); return "";
};
const fail = (message: string) => ({ errorType: "RuntimeException", message });
const openImport = () => [...imports.entries()].find(([, i]) => i.status === "ANALYZED");
const logRow = (id: string) => { const i = imports.get(id)!; return { id, fileName: i.fileName, description: i.description, status: i.status,
  canRollback: i.status === "APPLIED" && [...imports.keys()].pop() === id, newerAppliedImportsCount: 0 }; };

function bosOf(file: Uint8Array): Bo[] {
  const jsonl = unzip(file).find((e) => e.name.endsWith("/0000001.mybpm"));
  return new TextDecoder().decode(jsonl?.data).split("\n").filter(Boolean).map((l) => JSON.parse(l))
    .filter((o) => String(o["@class"]).endsWith(".BoStructDto"))
    .map((o) => ({ id: nextId("BO"), code: o.code, name: o.name?.rus ?? o.code, boCategory: o.category }));
}

const unb64 = (s: unknown) => Buffer.from(String(s ?? ""), "base64").toString("utf8");

// ── records: stored values per BO, record drafts of the §6a and §6b cycles ──────────────────────────────
type Rec = { id: string; boId: string; state: string; at: number; values: Record<string, string> };
const recs = new Map<string, Rec>(); // boiId → record
const recDrafts = new Map<string, { boId?: string; boiId?: string; isNew?: boolean; dev?: boolean; values: Record<string, string> }>();
const fieldsOf = (boId: string) => (bos.get(boId)?.fields ?? []).filter((x) => x.type && !x.widgetType && !x.nativeFieldType && x.type !== "TAB_GROUP");
const shown = (f: any, v: string) => f.type === "DROPDOWN_SINGLE" ? f.options?.find((o: any) => o.id === v)?.label ?? v
  : f.type === "CHECKBOX" ? (v === "true" ? "Да" : "Нет") : v;
const cell = (f: any, v = "") => ({ fieldId: f.fieldId, fieldCode: f.code, value: f.type === "BO" ? "" : v, displayValue: f.type === "BO" ? "" : shown(f, v) });
// trap 73 once per record whose values hold «ES breaker»: a read fails once, the first apply STORES and then fails
const esOnce = (key: string, values: Record<string, string>) =>
  Object.values(values).some((v) => String(v).includes("ES breaker")) && !raced.has(key) && !!raced.add(key);
const ES = { errorType: "EsDataTooLargeException", message: "[parent] Data too large, data for [<http_request>] would be larger than limit" };
function commit(draftId: string) {
  const d = recDrafts.get(draftId)!;
  const r = recs.get(d.boiId!) ?? { id: d.boiId!, boId: d.boId!, state: d.dev ? "DEV" : "ALL", at: ++seq, values: {} };
  Object.assign(r.values, d.values); recs.set(r.id, r); recDrafts.delete(draftId);
}

// ── xlsx of records: the template, the import act (rows counted, a row new when its key was absent before the act),
// the apply (a dropdown by label, a block by the value of a sub-column, a TABLE only adds, a blank clears except DATE), the export
const ID_COLUMN = "Внутренний айди";
const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const unxml = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
const colName = (i: number) => { let s = ""; for (i++; i; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s; return s; };
const colIndex = (l: string) => [...l].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
type XCol = { caption: string; sub: string; field: any; ref?: string }; // ref = the target field of a block's sub-column
const xcols = (boId: string, ids: string[]): XCol[] => ids.flatMap((id) => {
  const f = fieldsOf(boId).find((x) => x.fieldId === id);
  if (!f) return [];
  if (f.type !== "BO") return [{ caption: f.label, sub: "", field: f }];
  return (f.boFieldRefs ?? []).filter((r: any) => r.toShow).map((r: any) => ({ caption: f.label, sub: r.label, field: f, ref: r.fieldId }));
});
function xlsxOf(cols: XCol[], lines: string[][], idColumn: boolean): Uint8Array {
  const head = cols.some((c) => c.sub) ? 2 : 1, caps = [...cols.map((c) => c.caption), ...(idColumn ? [ID_COLUMN] : [])];
  const row = (n: number, cells: string[]) => `<row r="${n}">${cells.map((v, i) => v === "" ? "" : `<c r="${colName(i)}${n}" t="inlineStr"><is><t>${xml(v)}</t></is></c>`).join("")}</row>`;
  const merges: string[] = [];
  caps.forEach((c, i) => { if (i && caps[i - 1] === c) return; let j = i; while (caps[j + 1] === c && cols[j + 1]?.sub) j++; if (j > i) merges.push(`${colName(i)}1:${colName(j)}1`); });
  const rows = [row(1, caps.map((c, i) => (i && caps[i - 1] === c ? "" : c))), ...(head === 2 ? [row(2, cols.map((c) => c.sub))] : []),
    ...lines.map((l, j) => row(head + j + 1, l))];
  const sheet = `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${colName(caps.length - 1)}${head + lines.length}"/>` +
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${head}" topLeftCell="A${head + 1}" state="frozen"/></sheetView></sheetViews><sheetData>${rows.join("")}</sheetData>` +
    (merges.length ? `<mergeCells count="${merges.length}">${merges.map((m) => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>` : "") + "</worksheet>";
  return zip([{ name: "xl/worksheets/sheet1.xml", data: new TextEncoder().encode(sheet) }]);
}
function sheetOf(bytes: Uint8Array) {
  const x = new TextDecoder().decode(unzip(bytes).find((e) => /^xl\/worksheets\/sheet\d+\.xml$/.test(e.name))?.data);
  const grid: string[][] = [];
  for (const m of x.matchAll(/<c r="([A-Z]+)(\d+)"[^>]*?(?:\/>|>([\s\S]*?)<\/c>)/g))
    (grid[Number(m[2]) - 1] ??= [])[colIndex(m[1])] = unxml([...(m[3] ?? "").matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(""));
  const rows = Array.from(grid, (r) => Array.from(r ?? [], (v) => v ?? ""));
  const head = Number(/<pane\b[^>]*ySplit="(\d+)"/.exec(x)?.[1] ?? 1) >= 2 ? 2 : 1, caps = [...(rows[0] ?? [])];
  const width = Math.max(caps.length, head === 2 ? rows[1]?.length ?? 0 : 0);
  for (let i = 1; i < width; i++) if (!caps[i] && head === 2 && rows[1]?.[i]) caps[i] = caps[i - 1];
  return { head, cols: Array.from({ length: width }, (_, i) => ({ caption: caps[i] ?? "", sub: head === 2 ? rows[1]?.[i] ?? "" : "" })),
    data: rows.slice(head).filter((r) => r.some((v) => v !== "")) };
}
const xshown = (f: any, v = "") => f.type === "DATE" && v ? JSON.parse(v).slice(0, 10).split("-").reverse().join(".") : shown(f, v);
type XRow = { key: { id?: string; unique?: [string, string] }; set: Record<string, string>; links: Record<string, string[]>; err?: string; isNew: boolean; line: string[] };
const xacts = new Map<string, { boId: string; fileName: string; heads: string[]; rows: XRow[]; fileError?: string; applied?: boolean }>();
const xexports = new Map<string, any>();
const findRec = (boId: string, key: XRow["key"]) => key.id ? recs.get(key.id)
  : key.unique ? [...recs.values()].find((r) => r.boId === boId && r.state !== "REMOVED" && r.values[key.unique![0]] === key.unique![1]) : undefined;
function xact(boId: string, bytes: Uint8Array, fileName: string) {
  const sh = sheetOf(bytes), fields = fieldsOf(boId), act = { boId, fileName, heads: sh.cols.map((c) => c.sub ? `${c.caption}.${c.sub}` : c.caption), rows: [] as XRow[], fileError: undefined as string | undefined };
  const cols = sh.cols.map((c) => ({ ...c, field: fields.find((f) => f.label === c.caption) }));
  const odd = cols.find((c) => c.caption && c.caption !== ID_COLUMN && !c.field);
  if (odd) { act.fileError = `kD4QsxZrAY :: Нет поля с именем \`${odd.caption}\``; return act; }
  const unique = fields.find((f) => f.isUnique);
  for (const line of sh.data) {
    const row: XRow = { key: {}, set: {}, links: {}, isNew: false, line };
    cols.forEach((c, i) => {
      const v = line[i] ?? "", f = c.field;
      if (c.caption === ID_COLUMN) { if (v) row.key.id = v; return; }
      if (f.type === "BO") {
        if (!v) return;
        const t = fieldsOf(f.refBoId).find((x) => x.label === c.sub);
        const hit = t && [...recs.values()].find((r) => r.boId === f.refBoId && r.state !== "REMOVED" && xshown(t, r.values[t.fieldId]) === v);
        if (!hit) row.err ??= `Не найдена запись \`${v}\` в поле \`${f.label}\``;
        else (row.links[f.fieldId] ??= []).includes(hit.id) || row.links[f.fieldId].push(hit.id);
        return;
      }
      let s = v;
      if (f.type === "DROPDOWN_SINGLE" && v) {
        const o = f.options?.find((x: any) => x.label === v);
        if (!o) { row.err ??= `Не найдено значение \`${v}\` в поле \`${f.label}\`. Это поле должно содержать одно из следующих значений: ${f.options.map((x: any) => x.label).join(", ")}`; return; }
        s = o.id;
      } else if (f.type === "CHECKBOX") s = v === "Да" ? "true" : v ? "false" : "";
      else if (f.type === "DATE") { if (!v) return; s = JSON.stringify(`${v.split(".").reverse().join("-")}T00:00:00.000Z`); }
      row.set[f.fieldId] = s;
      if (f === unique && v) row.key.unique = [f.fieldId, s];
    });
    row.isNew = !findRec(boId, row.key);
    act.rows.push(row);
  }
  return act;
}
function xapply(importId: string) {
  const act = xacts.get(importId)!;
  for (const row of act.rows.filter((r) => !r.err)) {
    let r = findRec(act.boId, row.key);
    if (!r) { r = { id: nextId("BOI"), boId: act.boId, state: "ALL", at: ++seq, values: {} }; recs.set(r.id, r); }
    Object.assign(r.values, row.set);
    for (const [fid, ids] of Object.entries(row.links)) {
      const single = fieldsOf(act.boId).find((x) => x.fieldId === fid)?.viewType === "SINGLE";
      const had: string[] = single ? [] : JSON.parse(r.values[fid] || "[]");
      r.values[fid] = JSON.stringify([...had, ...ids.filter((x) => !had.includes(x))].slice(single ? -1 : 0));
    }
  }
  act.applied = true;
}
function xexport(e: any): Uint8Array {
  const cols = xcols(e.boId, e.boFieldIds);
  const rows = [...recs.values()].filter((r) => r.boId === e.boId && (e.state === "ALL" ? r.state === "ALL" || r.state === "DEV" : r.state === e.state)
    && (!e.boInstanceIds?.length || e.boInstanceIds.includes(r.id))).sort((a, b) => b.at - a.at);
  const lines = rows.filter((r) => !e.search || cols.some((c) => c.field.type !== "BO" && xshown(c.field, r.values[c.field.fieldId]).toLowerCase().includes(e.search.toLowerCase())))
    .flatMap((r) => {
      const linked = (f: any) => JSON.parse(r.values[f.fieldId] || "[]") as string[];
      const n = Math.max(1, ...cols.filter((c) => c.field.type === "BO" && c.field.viewType !== "SINGLE").map((c) => linked(c.field).length));
      return Array.from({ length: n }, (_, j) => [...cols.map((c) => {
        if (c.field.type !== "BO") return xshown(c.field, r.values[c.field.fieldId]);
        const t = recs.get(linked(c.field)[c.field.viewType === "SINGLE" ? 0 : j]), tf = t && fieldsOf(t.boId).find((x) => x.fieldId === c.ref);
        return tf ? xshown(tf, t!.values[tf.fieldId]) : "";
      }), ...(e.needBoiId ? [r.id] : [])]);
    });
  return xlsxOf(cols, lines, !!e.needBoiId);
}
const fileOf = (data: Uint8Array, name: string) => new Response(data, { headers: { "Content-Type": "application/octet-stream",
  "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}` } });

function mcp(path: string, params: any, body: any, token: string, file?: Uint8Array): any {
  const route = path.replace(/^\/web\//, "");
  switch (route) {
    case "v2/auth/v3/login": return unb64(body["cGFzc3dvcmQ="]) === "secret" ? `mock-token-${unb64(body["dXNlcm5hbWU="])}`
      : { errorType: "SecurityError", message: "wrong login or password" };
    case "v2/auth/logout": return null;
    case "v2/auth/load-auth-info": {
      const email = token.startsWith("mock-token-") ? token.slice("mock-token-".length) : "admin@mock";
      return { fio: email === "admin@mock" ? "Mock Admin" : `Mock ${email}`, email, companyCode: "MOCK", companyId: "COMPANY000000001", personId: "PERSON0000000001", language: "RUS", functionCodes: ["A", "B"] };
    }
    case "v2/business-objects/load-bo-id-by-kind": return "PERSONBO00000001";
    case "v2/business-objects/load-bo-id-by-code": return byCode(params.boCode)?.id ?? fail(`lKzjTR9WcU :: No bo with code = \`${params.boCode}\``);
    case "v2/business-objects/load-bo-records-by-group-id": return live().map(({ id, name, boCategory }) => ({ id, name, boCategory }));
    case "v2/business-objects/load-business-object-by-id": {
      const bo = bos.get(params.businessObjectId);
      if (!bo || bo.deleted) return fail("Cgf5V16VU4 :: данный бизнес-объект не существует");
      return { id: bo.id, code: bo.code, name: bo.name, boCategory: bo.boCategory, kind: "GENERAL", isDictionary: bo.boCategory === "BO_DICTIONARY",
        formFields: structuredClone(bo.fields ?? []) };
    }
    case "v2/business-objects/verify-business-object-code": return !!params.businessObjectCode && !byCode(params.businessObjectCode);
    case "v2/business-objects/create-bo": {
      const n = bos.size + 1, bo: Bo = { id: nextId("BO"), code: `Biznes_obekt_${n}`, name: `Бизнес объект №${n}`, boCategory: body.boCategory, fields: [],
        ...(body.boCategory === "BO_COMPOSITE" ? { co: { sources: [], fields: [] } } : {}) };
      bos.set(bo.id, bo);
      return { id: bo.id, name: bo.name, nameReadonly: false, viewState: "ACTIVE", orderIndex: 10, boCategory: bo.boCategory };
    }
    case "v2/business-objects/save-business-object-portion": {
      const acc = body.id ?? nextId("ACC"), json = (parts.get(acc) ?? "") + body.jsonPart;
      if (!body.isLast) { parts.set(acc, json); return acc; }
      parts.delete(acc);
      const p = JSON.parse(json), bo = bos.get(p.businessObject?.id);
      if (!bo) return fail("UndeclaredThrowableException");
      if (p.businessObject.nameMap?.RUS) bo.name = p.businessObject.nameMap.RUS;
      if (p.businessObject.formFields) {
        const drop = new Set(p.deletedFieldIds ?? []), add = new Set(p.addedFieldIds ?? []);
        // an added list's option codes come generated from the labels, whatever was sent (an EDIT of `options` sets them)
        const added = p.businessObject.formFields.filter((x: any) => add.has(x.fieldId))
          .map((x: any) => (x.options?.length ? { ...x, options: x.options.map((o: any, j: number) => ({ ...o, code: `Gen_${j}` })) } : x));
        bo.fields = [...(bo.fields ?? []).filter((x) => !drop.has(x.fieldId)), ...added];
        for (const e of p.editedFields ?? []) {
          const { options, ...rest } = e;
          Object.assign(bo.fields.find((x) => x.fieldId === e.fieldId) ?? {}, add.has(e.fieldId) ? rest : e);
        }
      }
      return acc;
    }
    case "v2/business-objects/generate-business-form-field":
      return { fieldId: nextId("FLD"), label: null, labelMap: null, code: null, type: params.fieldType, gridPosition: { x: 0, y: 0, cols: 15, rows: 4 } };
    case "v2/business-objects/generate-business-form-widget": return { fieldId: nextId("WGT"), label: null, code: null, widgetType: params.widgetType };
    case "v2/business-objects/generate-business-form-field-by-native": return { fieldId: nextId("NAT"), label: null, nativeFieldType: params.nativeType };
    case "v2/id-loader/load-portion": return Array.from({ length: 10 }, () => nextId("ID"));
    case "v2/business-objects/save-business-field-code": case "v2/button/save-button-code": case "v2/button/save-button-url": {
      const f = bos.get(params.businessObjectId ?? params.boId)?.fields?.find((x) => x.fieldId === (params.businessFieldId ?? params.buttonId));
      if (!f) return fail("no such field");
      // the stand: a setter right after the portion save that added the field does not see it yet — once per field here
      if (!raced.has(f.fieldId)) { raced.add(f.fieldId); return { errorType: "NoBoFieldWithId", message: "pYLrEBOVuV :: Данное поле не сохранено в бизнес-объекте" }; }
      if (route.endsWith("-url")) f.url = params.url; else f.code = params.businessFieldCode ?? params.code;
      return "";
    }
    case "v2/business-objects/save-business-object-code": bos.get(params.businessObjectId)!.code = params.businessObjectCode; return "";
    case "v2/business-objects/save-business-object-grid-layout-position": bos.get(body.boId)!.window = body.gridLayoutPosition; return "";
    case "v2/delete-script-usage/analyze-bo": return { analyzeId: nextId("ANL") };
    case "v2/delete-script-usage/is-analyze-done": return { done: true, errorMessage: null, hits: [] };
    case "v2/business-objects/load-bo-usage": return { menuItemNames: [], refBoNames: [] };
    case "v2/business-objects/delete-business-object": bos.get(params.businessObjectId)!.deleted = true; return "";
    case "v2/co/generate-draft": { const id = nextId("DRAFT"); drafts.set(id, { coId: params.coId, ...copyCo(bos.get(params.coId)!.co!) }); return id; }
    case "v2/co/remove-draft": drafts.delete(params.draftId); return null;
    case "v2/co/apply-and-remove-draft": { const d = drafts.get(params.draftId)!; bos.get(d.coId)!.co = copyCo(d); drafts.delete(params.draftId); return null; }
    case "v2/co/load-mock-open-drafts": return drafts.size;
    case "v2/co/add-bo-to-co": drafts.get(params.draftId)!.sources.push(params.boId); return null;
    case "v2/co/load-bo-records-for-co": return drafts.get(params.draftId)!.sources.map((id) => ({ id, name: bos.get(id)?.name }));
    case "v2/co/load-bo-fields-for-co": return (bos.get(params.boId)?.fields ?? []).map((x) => ({ fieldId: x.fieldId, label: x.label, code: x.code, type: x.type }));
    case "v2/co/load-co-fields-simple": case "v2/co/load-co-fields-composite":
      return drafts.get(params.draftId)!.fields.filter((x) => (x.links.length > 1) === route.endsWith("composite"));
    case "v2/co/add-co-field-to-simple": {
      const d = drafts.get(params.draftId)!;
      for (const l of body) {
        const src = bos.get(l.boId)?.fields?.find((x) => x.fieldId === l.fieldId);
        if (!src || d.fields.some((x) => x.links.some((y) => y.fieldId === l.fieldId))) return fail("bad link");
        d.fields.push({ coFieldId: nextId("COF"), label: src.label, code: `co_${src.code}`, links: [l] });
      }
      return null;
    }
    case "v2/co/add-co-field-to-composite": drafts.get(params.draftId)!.fields.find((x) => x.coFieldId === params.coFieldId)!.links.push(...body); return null;
    case "v2/co/change-co-field-label": case "v2/co/change-co-field-code": {
      const x = drafts.get(params.draftId)!.fields.find((y) => y.coFieldId === params.coFieldId)!;
      if (params.label !== undefined) x.label = params.label; else x.code = params.code;
      return null;
    }
    // records: the registry (columns only, CREATED_AT DESC), values per tab, the §6a draft cycle, the §6b form cycle, the delete
    case "v2/business-object-instance/load-bo-instance-bracket-table": {
      const cols = fieldsOf(body.boId).filter((x) => x.tableColToShow);
      const all = [...recs.values()].filter((r) => r.boId === body.boId && (body.state === "ALL" ? r.state === "ALL" || r.state === "DEV" : r.state === body.state) && (body.brackets ?? []).every((b: any) => inBracket(r, b)))
        .sort((a, b) => b.at - a.at), page = all.slice(body.paging.offset, body.paging.offset + body.paging.limit);
      return { heads: cols.map((x, i) => ({ fieldId: x.fieldId, name: x.label, orderIndex: i, boFieldArchetype: "DYNAMIC" })), totalHits: all.length,
        hasNext: body.paging.offset + page.length < all.length,
        records: page.map((r) => ({ boId: r.boId, instanceId: r.id, state: r.state, values: cols.map((x) => cell(x, r.values[x.fieldId])) })) };
    }
    case "v2/business-object-instance/v2/load-boi-values": {
      const r = recs.get(body.boInstanceId);
      if (!r) return fail("NoBoInstanceWithId");
      if (esOnce(`read-${r.id}`, r.values)) return ES;
      return { boInstanceId: r.id, state: r.state, fields: fieldsOf(r.boId).filter((x) => (x.tabId ?? null) === body.tabId).map((x) => cell(x, r.values[x.fieldId])) };
    }
    case "v2/business-object-instance/create-draft": { const id = nextId("RDR"); recDrafts.set(id, { values: {} }); return id; }
    case "v2/instance-field-form/load-field-data": {
      const r = recs.get(params.boiId), d = recDrafts.get(params.draftId);
      if (!d) return fail("NoBoInstanceDraftWithId");
      return fieldsOf(params.boId).map((x) => ({ fieldId: x.fieldId, storedValue: d.values[x.fieldId] ?? r?.values[x.fieldId] ?? (x.type === "BO" ? "[]" : "") }));
    }
    case "v2/business-object-instance/remove-draft": case "v2/instance-form/remove-draft": recDrafts.delete(params.draftId); return null;
    case "v2/business-object-instance/v2/create-boi": Object.assign(recDrafts.get(params.draftId)!, { boId: params.boId, boiId: nextId("BOI"), isNew: true }); return recDrafts.get(params.draftId)!.boiId;
    case "v2/business-object-instance/v2/save-boi-value": {
      const d = recDrafts.get(body.draftId)!;
      Object.assign(d, { boId: body.boId, boiId: body.boInstanceId, dev: body.newIsDev });
      for (const v of body.values) d.values[v.fieldId] = v.value;
      return null;
    }
    case "v2/business-object-instance/apply-and-remove-draft": commit(params.draftId); return null;
    case "v2/instance-form-create-draft/create-draft": { const id = nextId("RDR"); recDrafts.set(id, { boId: params.boId, boiId: params.boiId, values: {} }); return id; }
    case "v2/instance-form-create-draft/create-draft-with-boi": {
      const draftId = nextId("RDR"), boiId = nextId("BOI");
      recDrafts.set(draftId, { boId: params.boId, boiId, isNew: true, dev: params.boiState === "DEV", values: {} });
      return { draftId, boiId };
    }
    case "v2/instance-field-form/save-field-value": {
      const d = recDrafts.get(body.draftId);
      if (!d) return fail("NoBoInstanceDraftWithId");
      for (const v of body.values) d.values[v.fieldId] = v.value;
      return [];
    }
    case "v2/instance-form/validate-apply-remove-draft": {
      const d = recDrafts.get(params.draftId);
      if (!d) return fail("NoBoInstanceDraftWithId: the draft is gone");
      const was = recs.get(d.boiId!)?.values ?? {};
      const empty = fieldsOf(d.boId!).filter((x) => x.isRequired && !(d.values[x.fieldId] ?? was[x.fieldId]));
      if (empty.length) return [{ commandType: "SHOW_FIELD_ERROR", fieldId: empty[0].fieldId, errorMessage: "Необходимо заполнить" }];
      const es = esOnce(`apply-${d.boiId}`, d.values);
      commit(params.draftId);
      return es ? ES : [{ commandType: "CLOSE_DIALOG_SAVE" }];
    }
    case "v2/business-object-instance/v2/delete-boi": recDrafts.delete(params.draftId); return null;
    case "v2/business-object-instance/delete-bo-instance":
      for (const id of params.boInstanceIds ?? []) { const r = recs.get(id); if (r && r.boId === params.businessObjectId) r.state = "REMOVED"; }
      return null;
    case "v2/bo-transfer/download-template": {
      const bo = bos.get(params.businessObjectId)!;
      return fileOf(xlsxOf(xcols(bo.id, [params.selectedFieldIds ?? []].flat()), [], false), `Шаблон ${bo.name}.xlsx`);
    }
    case "v2/bo-transfer/import-from-file": { const id = nextId("XACT"); xacts.set(id, xact(params.businessObjectId, file!, "upload.xlsx")); return id; }
    case "v2/bo-transfer/is-import-file-finished": { const a = xacts.get(params.actId); return a?.fileError ? fail(a.fileError) : !!a; }
    case "v2/bo-transfer/load-import-file": {
      const a = xacts.get(params.actId);
      return a && { fileName: a.fileName, total: a.rows.length, newRecords: a.rows.filter((r) => !r.err && r.isNew).length,
        updatedRecords: a.rows.filter((r) => !r.err && !r.isNew).length, errorRecords: a.rows.filter((r) => r.err).length };
    }
    case "v2/bo-transfer/load-bo-import-table": {
      const a = xacts.get(body.importId)!;
      return { heads: a.heads, records: a.rows.slice(body.paging.offset, body.paging.offset + body.paging.limit)
        .map((r) => ({ hasError: !!r.err, errorText: r.err ?? null, values: r.line })) };
    }
    case "v2/bo-transfer/apply-imported": xapply(params.importId); return "";
    case "v2/bo-transfer/watch-import-finished": return xacts.get(params.importId)?.applied ?? true;
    case "v2/bo-transfer/imported-ok": case "v2/bo-transfer/cancel-imported": xacts.delete(params.importId); return "";
    case "v2/bo-transfer/export-bracket-bo": { const id = nextId("XEXP"); xexports.set(id, body); return id; }
    case "v2/bo-transfer/is-bo-export-file-ready": return xexports.has(params.exportId);
    case "v2/bo-transfer/load-bo-export-file": return fileOf(xexport(xexports.get(params.exportId)), `${bos.get(xexports.get(params.exportId).boId)!.name} export.xlsx`);
    case "v2/business-objects/load-org-unit-record-list":
      return ORG.filter((u) => u.name.toLowerCase().includes(String(params.filter ?? "").toLowerCase())).slice(params.skipFirstCount ?? 0, (params.skipFirstCount ?? 0) + 20);
    case "v2/business-objects/load-org-field-record-list":
      return fieldsOf(params.businessObjectId).filter((x) => x.type === "BO" && x.refBoId === "PERSONBO00000001").map((x) => ({ id: x.fieldId, name: x.label, kind: "PERSON" }));
    case "v2/business-objects/load-access-group": return accessOf(`bo:${params.businessObjectId}`);
    case "v2/business-objects/save-access-group": return saveAccess(`bo:${body.businessObjectId}`, body.accessGroup);
    case "v2/business-objects/load-field-access-group": return accessOf(`f:${params.businessObjectId}:${params.fieldId}`);
    case "v2/business-objects/save-field-access-group": return saveAccess(`f:${body.businessObjectId}:${body.fieldId}`, body.accessGroup);
    case "v2/business-objects/load-field-tab-access-group": return accessOf(`t:${params.businessObjectId}:${params.fieldId}:${params.tabId}`);
    case "v2/business-objects/save-field-tab-access-group": return saveAccess(`t:${body.businessObjectId}:${body.fieldId}:${body.tabId}`, body.accessGroup);
    case "v2/business-objects/save-bo-field-chosen-access-right": { const x = bos.get(params.boId)?.fields?.find((y) => y.fieldId === params.fieldId); if (x) x.chosenAccessRight = params.chosenAccessRight; return ""; }
    case "v2/business-objects/save-bo-field-tab-chosen-access-right": { const x = bos.get(params.boId)?.fields?.find((y) => y.fieldId === params.fieldId)?.tabs?.find((y: any) => y.id === params.tabId); if (x) x.chosenAccessRight = params.chosenAccessRight; return ""; }
    case "v2/menu-item/load-nav-items": return NAV.filter((m) => (m.parentId ?? null) === (params.parentId ?? null));
    case "v2/menu-item/create-menu-item": NAV.push({ ...body, code: `menu_${++seq}`, bracketFilterId: null }); return "";
    case "v2/menu-item/delete-menu-item": NAV.splice(NAV.findIndex((m) => m.id === params.menuItemId), 1); return "";
    case "v2/menu-item/save-menu-item-icon-name": NAV.find((m) => m.id === params.menuItemId)!.iconName = params.iconName; return "";
    case "v2/menu-item/save-menu-item-bo-pages": NAV.find((m) => m.id === params.menuItemId)!.boPages = body; return "";
    case "v2/menu-item/load-bracket-filter": {
      const m = NAV.find((x) => x.id === params.menuItemId)!;
      if (!m.bracketFilterId) { m.bracketFilterId = nextId("FLT"); filters.set(m.bracketFilterId, { id: m.bracketFilterId, boId: m.boId, brackets: [] }); }
      return filters.get(m.bracketFilterId);
    }
    case "v2/bracket-filter/save": filters.set(body.id, structuredClone(body)); return "";
    case "v2/kanban/load-kanban-template": return null;
    case "v2/menu-item/load-access-group": return accessOf(`m:${params.menuItemId}`);
    case "v2/menu-item/save-access-group": return saveAccess(`m:${params.menuItemId}`, body);
    case "v2/menu-item/save-menu-item-chosen-access-right": chosen.set(`m:${params.menuItemId}`, params.chosenAccessRight); { const m = NAV.find((x) => x.id === params.menuItemId); if (m) m.chosenAccessRight = params.chosenAccessRight; } return "";
    case "v2/org-unit/load-filtered-persons-v2": return [{ name: "Все", persons: [{ id: "PERSON0000000001", name: "Mock Admin", email: "admin@mock", parentGroupNames: "" }] }];
    case "v2/process-indicator/pre-create-process": return nextId("PROC");
    case "v2/process-indicator/load-state-short": return { isFinished: true, percentage: 100, label: "Готово" };
    case "import-structure/load-import-state": { const o = openImport(); return { importExists: !!o, importId: o?.[0] ?? null, fileName: o?.[1].fileName ?? null }; }
    case "import-structure/import-file": {
      if (openImport()) return fail("an import is already open");
      const id = nextId("IMP");
      imports.set(id, { status: "UPLOADED", fileName: "upload.mybpm.zip", bos: bosOf(file!), description: null });
      return id;
    }
    case "import-structure/insert-file-data": return nextId("PROC");
    case "import-structure/analyze-file-data": {
      imports.get(params.importId)!.status = "ANALYZED";
      bell.unshift({ id: nextId("NOTE"), header: "Анализ импорта завершен", body: "Перейдите к настройкам импорта/экспорта структуры", happenedAt: Date.now() });
      return nextId("PROC");
    }
    case "import-structure/load-import-data": return { status: imports.get(params.importId)?.status, error: null, conflicts: {} };
    case "import-structure/load-import-errors": return { errorRecords: [], nextPageId: null };
    case "import-structure/load-import-bo-infos":
      return imports.get(body.importId)?.bos.map((b) => ({ importRecordId: `REC${b.id}`, name: b.name, boCategory: b.boCategory, structTypes: ["STRUCTURE"] }));
    case "import-structure/load-import-bo-record": return { id: params.recordId, structureInfo: { addedField: [], changedField: [] } };
    case "import-structure/save-import-description": imports.get(params.importId)!.description = params.value; return null;
    case "import-structure/apply-import": {
      const i = imports.get(params.importId)!;
      for (const b of i.bos) bos.set(b.id, b);
      i.status = "APPLIED";
      return { type: "APPLIED" };
    }
    case "import-structure/cancel-import": imports.get(params.importId)!.status = "CANCELED"; return null;
    case "import-structure/remove-import": imports.delete(params.importId); return null;
    case "import-structure/load-import-rollback-preview": {
      const r = logRow(params.importId);
      return { canRollback: r.canRollback, newerAppliedImportsCount: 0, restoreItems: [],
        deleteItems: imports.get(params.importId)!.bos.map((b) => ({ action: "DELETE", code: `${b.code}#DICTIONARY`, name: b.name })) };
    }
    case "import-structure/rollback-import": {
      const i = imports.get(params.importId)!;
      for (const b of i.bos) bos.delete(b.id);
      i.status = "ROLLED_BACK";
      return { type: "ROLLED_BACK" };
    }
    case "import-structure/load-import-file-records": return [...imports.keys()].reverse().map(logRow);
    case "struct/load-bo-export-records": return [];
    case "struct/count-menu-export-records": return 0;
    case "struct/load-export-is-global-methods": return false;
    case "struct/clear-export-records": case "struct/save-bo-export-records": return null;
    case "v2/user-notification/count": return { messages: 0, events: 0, notifications: bell.length };
    case "v2/user-notification/load-notifications": return bell.map((row) => ({ row }));
    case "v2/user-notification/delete-notification": bell = bell.filter((n) => n.id !== params.notificationId); return null;
    case "v2/user-notification/delete-notifications": bell = []; return null;
  }
  return scriptsAndProcesses(route, params, body);
}

// ── scripts (§5g) and processes (§5f): versions, wiring, defs by module/script, a process diagram, run ways, steps ──
type SVer = { boScriptModId: string; version: string; isWork: boolean; isTest: boolean; comment: string | null; w: Record<string, any> };
type PVer = { boProcessId: string; version: string; isWork: boolean; isTest: boolean; comment: string | null; def: any; runWayMap: Record<string, any> };
const sVers = new Map<string, SVer[]>(), pVers = new Map<string, PVer[]>(), defs = new Map<string, any>(), written = new Set<string>();
const localMethods = new Map<string, { scriptId: string; methodName: string }[]>(); // per BO: every version lists them (trap 68a)
let globals: { scriptId: string; methodName: string }[] = [];
const rwDrafts = new Map<string, { boProcessId: string; runWayMap: Record<string, any> }>(), forced = new Map<string, Set<string>>();
const HOOK_KEYS = ["onOpenFormScriptId", "afterSaveScriptId", "onCloseScriptId", "onInstanceCreationId"];
const dk = (m: string, s: string) => `${m}/${s}`;
const setPath = (o: any, path: string, v: unknown) => {
  const ks = path.split("."), last = ks.pop()!;
  const at = ks.reduce((x, k) => (x[k] ??= {}), o);
  if (v === undefined) delete at[last]; else at[last] = structuredClone(v);
};
const applyCmd = (o: any, cmd: any) => { for (const op of cmd.forward?.list ?? []) setPath(o, op.dotPath, op.type === "Unset" ? undefined : op.value); };
const sVersOf = (boId: string) => {
  if (!sVers.has(boId)) sVers.set(boId, [{ boScriptModId: nextId("SMOD"), version: "1", isWork: false, isTest: true, comment: null,
    w: { ...Object.fromEntries(HOOK_KEYS.map((k) => [k, null])), fieldScripts: {} } }]);
  return sVers.get(boId)!;
};
const pVersOf = (boId: string) => {
  if (!pVers.has(boId)) pVers.set(boId, [{ boProcessId: nextId("PVER"), version: "1", isWork: false, isTest: true, comment: null,
    def: { figures: { [nextId("ENTER")]: { x: 100, y: 100, type: "Enter" } }, arrows: {} }, runWayMap: {} }]);
  return pVers.get(boId)!;
};
const pVerById = (id: string) => [...pVers.values()].flat().find((v) => v.boProcessId === id);
const ownerOf = (modId: string) => [...sVers.entries()].find(([, l]) => l.some((v) => v.boScriptModId === modId));
const diag = (code: string, message: string) => ({ success: false, diagnosticMessageList: [{ type: "ERROR", messageCode: code, message }] });
function translateDef(m: string, s: string) {
  const d = defs.get(dk(m, s)), blocks = d?.blocks ?? {};
  if (!Object.keys(blocks).length) return written.has(dk(m, s)) ? diag("noEntryPoint", "Нет точки входа") : diag("", "Не определён скрипт");
  const hat = Object.values<any>(blocks).find((b) => b.type === "BlockFixEntryPoint" || b.type === "BlockFixMethod");
  if (!hat) return diag("noEntryPoint", "Нет точки входа");
  if (!hat.downBlockId || !blocks[hat.downBlockId]) return diag("block_noDownBlock", "Нет блока ниже");
  return { success: true, diagnosticMessageList: [] };
}
function copyVersion<T extends { version: string; isWork: boolean; isTest: boolean; comment: string | null }>(list: T[], v: T, idKey: string, prefix: string): T {
  const c: any = { ...structuredClone(v), [idKey]: nextId(prefix), version: String(Math.max(...list.map((x) => +x.version)) + 1), isWork: false, isTest: false };
  for (const [k, d] of [...defs]) if (k.startsWith((v as any)[idKey] + "/")) defs.set(dk(c[idKey], k.split("/")[1]), structuredClone(d)); // same script ids
  list.push(c);
  return c;
}
function versionOp<T extends { version: string; isWork: boolean; isTest: boolean; comment: string | null }>(list: T[], op: string, id: string, idKey: string, prefix: string, comment?: string) {
  const v = list.find((x: any) => x[idKey] === id)!;
  if (op === "copy") copyVersion(list, v, idKey, prefix);
  if (op === "remove") list.splice(list.indexOf(v), 1);
  if (op === "comment") v.comment = comment ?? null;
  if (op === "test") { list.forEach((x) => (x.isTest = false)); v.isTest = true; }
  if (op === "work") { // the test one keeps only work and a new test copy appears
    const wasTest = v.isTest;
    list.forEach((x) => (x.isWork = false)); v.isWork = true;
    if (wasTest) { v.isTest = false; copyVersion(list, v, idKey, prefix).isTest = true; }
  }
  return "";
}
function steps(boProcessId: string, boiId: string) {
  const def = pVerById(boProcessId)?.def ?? { figures: {}, arrows: {} }, out: any[] = [], seen = new Set<string>();
  let at = Object.keys(def.figures).find((k) => def.figures[k].type === "Enter");
  while (at && !seen.has(at)) {
    seen.add(at);
    const fig = def.figures[at], outs = Object.entries<any>(def.arrows).filter(([, a]) => a.startFigureId === at);
    const push = outs.find(([id]) => forced.get(boiId)?.has(id));
    if ((fig.type === "Form" || fig.type === "Timer") && !push) { out.push({ figureId: at, state: "STAND" }); break; }
    out.push({ figureId: at, state: "PASSED" });
    if (fig.type === "Exit") break;
    const exitArrow = Object.values<any>(defs.get(dk(boProcessId, at))?.blocks ?? {}).find((b) => b.targetArrowId)?.targetArrowId;
    at = (push ?? outs.find(([id]) => id === exitArrow) ?? outs[0])?.[1].finishFigureId;
  }
  return out;
}
function scriptsAndProcesses(route: string, params: any, body: any): any {
  const ids = (n: number) => Array.from({ length: n }, () => nextId("NID"));
  switch (route) {
    case "v2/bo-scripts-editor/load-bo-script-versions": return sVersOf(params.boId).map(({ w, ...v }) => v);
    case "v2/bo-scripts-editor/load-bo-scripts": {
      const v = sVersOf(params.boId).find((x) => x.boScriptModId === params.boScriptsId)!;
      return { id: v.boScriptModId, boId: params.boId, ...structuredClone(v.w), methodScriptIds: (localMethods.get(params.boId) ?? []).map((m) => m.scriptId), methodsScriptId: null };
    }
    case "v2/bo-scripts-editor/save-bo-scripts": { // a null / "" hook is ignored (§5g): it keeps its id
      const v = sVersOf(body.boId).find((x) => x.boScriptModId === body.id)!;
      for (const k of HOOK_KEYS) if (body[k]) v.w[k] = body[k];
      v.w.fieldScripts = structuredClone(body.fieldScripts ?? {});
      return null;
    }
    case "v2/bo-scripts-editor/list-local-methods": return localMethods.get(ownerOf(params.boScriptsId)![0]) ?? [];
    case "v2/bo-scripts-editor/create-local-method": {
      const boId = ownerOf(params.boScriptsId)![0], m = { scriptId: nextId("LM"), methodName: params.methodName };
      localMethods.set(boId, [...(localMethods.get(boId) ?? []), m]);
      for (const v of sVersOf(boId)) defs.set(dk(v.boScriptModId, m.scriptId), { blocks: { [nextId("HAT")]: { type: "BlockFixMethod", methodName: m.methodName, params: {} } }, expressions: {} });
      return m;
    }
    case "v2/bo-scripts-editor/delete-local-method": {
      const boId = ownerOf(params.boScriptsId)![0];
      localMethods.set(boId, (localMethods.get(boId) ?? []).filter((m) => m.scriptId !== params.scriptId));
      return null;
    }
    case "v2/script/load-bo-def-list": return { list: [{ boId: "ANY" }] };
    case "v2/script/load-new-ids": case "v2/bo-process-editor/load-new-ids": return ids(params.count);
    case "v2/script/load-script-def": return structuredClone(defs.get(dk(params.scriptModuleId, params.scriptId)) ?? { blocks: {}, expressions: {} });
    case "v2/script/apply-update-cmd": {
      const k = dk(params.scriptModuleId, params.scriptId), d = defs.get(k) ?? { blocks: {}, expressions: {} };
      applyCmd(d, body); defs.set(k, d); written.add(k);
      return null;
    }
    case "v2/script/translate-script": return translateDef(params.scriptModuleId, params.scriptId);
    case "v2/script/ensure-company-global-script-module": return { scriptModuleId: "GLOBALMOD0000001", scriptId: null };
    case "v2/script/list-company-global-methods": return globals;
    case "v2/script/create-company-global-method": {
      const m = { scriptId: nextId("GM"), methodName: params.methodName };
      globals.push(m);
      defs.set(dk("GLOBALMOD0000001", m.scriptId), { blocks: { [nextId("HAT")]: { type: "BlockFixMethod", methodName: m.methodName, params: {} } }, expressions: {} });
      return { scriptModuleId: "GLOBALMOD0000001", scriptId: m.scriptId };
    }
    case "v2/script/delete-company-global-method": globals = globals.filter((m) => m.scriptId !== params.scriptId); return null;
    case "v2/script-browser/load-exit-variants": {
      const def = pVerById(params.scriptModuleId)?.def;
      return Object.entries<any>(def?.arrows ?? {}).filter(([, a]) => a.startFigureId === params.scriptId).map(([id]) => ({ id, displayName: id.slice(0, 6) }));
    }
    case "v2/bo-process-editor2/load-bo-process-versions": return pVersOf(params.boId).map(({ def, runWayMap, ...v }) => v);
    case "v2/bo-process-editor2/load-dev-bo-process-id": return pVersOf(params.boId).find((v) => v.isTest)!.boProcessId;
    case "v2/bo-process-editor/load-bo-process-def": return structuredClone(pVerById(params.boProcessId)!.def);
    case "v2/bo-process-editor/apply-update-cmd": applyCmd(pVerById(params.boProcessId)!.def, body); return null;
    case "v2/bo-process-editor/validate-def": {
      const def = pVerById(params.boProcessId)!.def, figs = Object.entries<any>(def.figures), arrs = Object.values<any>(def.arrows), errs: any[] = [];
      if (!figs.some(([, f]) => f.type === "Exit")) errs.push({ type: "ERROR", place: "COMMON", message: "Нет точка окончания" });
      for (const [id, f] of figs) if (f.type !== "Exit" && !arrs.some((a) => a.startFigureId === id)) errs.push({ type: "ERROR", place: "FIGURE", id, message: "Из фигуры должен быть выход" });
      return errs;
    }
    case "v2/bo-process-editor2/create-draft": { const id = nextId("RWD"); rwDrafts.set(id, { boProcessId: params.boProcessId, runWayMap: structuredClone(pVerById(params.boProcessId)!.runWayMap) }); return id; }
    case "v2/bo-process-editor2/load-draft-data": return { runWayMap: rwDrafts.get(params.draftId)!.runWayMap };
    case "v2/bo-process-editor2/update-draft": { const d = rwDrafts.get(params.draftId)!; for (const o of body) setPath(d, o.dotPath, o.value); return [{ type: "SET_SAVE_BUTTON_VISIBILITY" }]; }
    case "v2/bo-process-editor2/apply-draft": { const d = rwDrafts.get(params.draftId)!; pVerById(d.boProcessId)!.runWayMap = d.runWayMap; rwDrafts.delete(params.draftId); return null; }
    case "v2/bo-process-editor2/remove-draft": rwDrafts.delete(params.draftId); return "";
    case "v2/boi-process2/load-boi-process-id": return pVersOf(params.boId).find((v) => v.isTest)!.boProcessId;
    case "v2/boi-process/load-process-steps": return steps(params.boProcessId, params.boiId);
    case "v2/boi-process/push-step-forcibly": forced.set(params.boiId, new Set([...(forced.get(params.boiId) ?? []), params.arrowId])); return null;
    case "v2/boi-process/push-step-retry": return null;
  }
  const m = route.match(/^v2\/bo-(scripts|process)-editor2?\/(in-work|in-test|copy|remove|change)-bo-(script|process)-version(-comment)?$/);
  if (m) {
    const op = ({ "in-work": "work", "in-test": "test", copy: "copy", remove: "remove", change: "comment" } as any)[m[2]];
    return m[1] === "scripts" ? versionOp(sVersOf(params.boId), op, params.boScriptsId, "boScriptModId", "SMOD", params.comment)
      : versionOp(pVersOf(params.boId), op, params.boProcessId, "boProcessId", "PVER", params.comment);
  }
  return undefined;
}

/** The export: one BO line per BO in the stand, as the stand's own zip of 0000001.mybpm + metadata.mybpm. */
function exportZip(): Uint8Array {
  const enc = new TextEncoder();
  const lines = live().map((b) => JSON.stringify({ "@class": "kz.greetgo.mybpm.reg.structure.model.dto.BoStructDto",
    code: b.code, category: b.boCategory, name: { rus: b.name }, dynamicFields: {} }));
  return zip([{ name: "data-mock/0000001.mybpm", data: enc.encode(lines.join("\n") + "\n") },
    { name: "data-mock/metadata.mybpm", data: enc.encode(`objectCount-${lines.length}`) }]);
}

Bun.serve({
  port: Number(Bun.env.PORT ?? 8080),
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/latest/plugin.json") return Response.json({ version: "99.0.0" }); // the MCP server's release check
    let payload: any = {}, file: Uint8Array | undefined, form: Record<string, string> = {};
    if (req.headers.get("content-type")?.startsWith("multipart/form-data")) {
      for (const [k, v] of await req.formData()) if (v instanceof Blob) file = new Uint8Array(await v.arrayBuffer()); else form[k] = v;
    } else if (req.method === "GET") { // a download: its parameters ride in the query, a repeated one becomes a list
      for (const k of new Set(url.searchParams.keys())) { const all = url.searchParams.getAll(k); form[k] = all.length > 1 ? all : all[0] as any; }
    } else payload = await req.json().catch(() => ({}));
    const params = payload.params_Lr1oSgwPR8 ?? form, body = payload.body_o1nhHUG480 ?? {};
    log.push({ path: url.pathname.replace(/^\/web/, ""), params, body });
    await Bun.write(out, log.map(l => JSON.stringify(l)).join("\n") + "\n");
    if (url.pathname === "/web/struct/export-company-structure")
      return new Response(exportZip(), { headers: { "Content-Type": "application/zip", "Content-Disposition": 'attachment; filename="MyBPM-export-MOCK.mybpm.zip"' } });
    const special = Bun.env.MOCK_MCP ? mcp(url.pathname, params, body, req.headers.get("token") ?? "", file) : undefined;
    if (special instanceof Response) return special;
    return new Response(JSON.stringify(special !== undefined ? special : answer(url.pathname, params, body)), { headers: { "Content-Type": "application/json" } });
  },
});
console.log(`mock stand up on ${Bun.env.PORT ?? 8080}`);
