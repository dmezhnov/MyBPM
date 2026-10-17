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
// (upload → insert → analyze → apply → rollback, cancel), the structure export, the bell. The BOs of an
// uploaded archive appear on apply and disappear on rollback, so bo_find shows what the stand would.
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
type Bo = { id: string; code: string; name: string; boCategory: string };
const bos = new Map<string, Bo>(); // code → BO present on the stand
const imports = new Map<string, { status: string; fileName: string; bos: Bo[]; description: string | null }>();
let bell: { id: string; header: string; body: string; happenedAt: number }[] = [{ id: "NOTE_OLD_0000001", header: "Старое", body: "не наше", happenedAt: 1 }];
let seq = 0;
const nextId = (p: string) => `${p}${String(++seq).padStart(16 - p.length, "0")}`;
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

function mcp(path: string, params: any, body: any, file?: Uint8Array): any {
  const route = path.replace(/^\/web\//, "");
  switch (route) {
    case "v2/auth/load-auth-info": return { fio: "Mock Admin", email: "admin@mock", companyCode: "MOCK", companyId: "COMPANY000000001", personId: "PERSON0000000001", language: "RUS", functionCodes: ["A", "B"] };
    case "v2/business-objects/load-bo-id-by-kind": return "PERSONBO00000001";
    case "v2/business-objects/load-bo-id-by-code": return bos.get(params.boCode)?.id ?? fail(`lKzjTR9WcU :: No bo with code = \`${params.boCode}\``);
    case "v2/business-objects/load-bo-records-by-group-id": return [...bos.values()].map(({ id, name, boCategory }) => ({ id, name, boCategory }));
    case "v2/business-objects/load-business-object-by-id": {
      const bo = [...bos.values()].find((b) => b.id === params.businessObjectId);
      return bo && { ...bo, kind: "GENERAL", isDictionary: bo.boCategory === "BO_DICTIONARY", formFields: [] };
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
      for (const b of i.bos) bos.set(b.code, b);
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
      for (const b of i.bos) bos.delete(b.code);
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
  const lines = [...bos.values()].map((b) => JSON.stringify({ "@class": "kz.greetgo.mybpm.reg.structure.model.dto.BoStructDto",
    code: b.code, category: b.boCategory, name: { rus: b.name }, dynamicFields: {} }));
  return zip([{ name: "data-mock/0000001.mybpm", data: enc.encode(lines.join("\n") + "\n") },
    { name: "data-mock/metadata.mybpm", data: enc.encode(`objectCount-${lines.length}`) }]);
}

Bun.serve({
  port: Number(Bun.env.PORT ?? 8080),
  async fetch(req) {
    const url = new URL(req.url);
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
    const special = Bun.env.MOCK_MCP ? mcp(url.pathname, params, body, file) : undefined;
    return new Response(JSON.stringify(special !== undefined ? special : answer(url.pathname, params, body)), { headers: { "Content-Type": "application/json" } });
  },
});
console.log(`mock stand up on ${Bun.env.PORT ?? 8080}`);
