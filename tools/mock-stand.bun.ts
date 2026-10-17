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
// a soft delete, and the composite draft cycle (`v2/co/load-mock-open-drafts` counts the drafts left open).
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
        bo.fields = [...(bo.fields ?? []).filter((x) => !drop.has(x.fieldId)), ...p.businessObject.formFields.filter((x: any) => add.has(x.fieldId))];
        for (const e of p.editedFields ?? []) Object.assign(bo.fields.find((x) => x.fieldId === e.fieldId) ?? {}, e);
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
    let payload: any = {}, file: Uint8Array | undefined;
    if (req.headers.get("content-type")?.startsWith("multipart/form-data")) {
      const f = (await req.formData()).get("file");
      if (f instanceof Blob) file = new Uint8Array(await f.arrayBuffer());
    } else payload = await req.json().catch(() => ({}));
    const params = payload.params_Lr1oSgwPR8 ?? {}, body = payload.body_o1nhHUG480 ?? {};
    log.push({ path: url.pathname.replace(/^\/web/, ""), params, body });
    await Bun.write(out, log.map(l => JSON.stringify(l)).join("\n") + "\n");
    if (url.pathname === "/web/struct/export-company-structure")
      return new Response(exportZip(), { headers: { "Content-Type": "application/zip", "Content-Disposition": 'attachment; filename="MyBPM-export-MOCK.mybpm.zip"' } });
    const special = Bun.env.MOCK_MCP ? mcp(url.pathname, params, body, req.headers.get("token") ?? "", file) : undefined;
    return new Response(JSON.stringify(special !== undefined ? special : answer(url.pathname, params, body)), { headers: { "Content-Type": "application/json" } });
  },
});
console.log(`mock stand up on ${Bun.env.PORT ?? 8080}`);
