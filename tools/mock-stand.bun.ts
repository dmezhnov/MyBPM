// A mock MyBPM stand used to VERIFY §0U of MYBPM-UI-API.md.
//
//   bun tools/mock-stand.bun.ts tool.jsonl     # then drive a client at http://127.0.0.1:8080
//
// Drive `tools/create-bo-constructor.bun.ts` (stand-verified) and `tools/follow-cookbook-stand.py`
// (written from §0U alone) through the same recipe against it, then diff the two request files:
// they must agree on every path, every parameter and every body, including the JSON inside `jsonPart`.
// The Bun tool hardcodes `https://`, so test it through a copy with the scheme rewritten to `http://`.
//
// A mock MyBPM stand: records every request and answers canned DTOs, so two independent clients can be
// driven over the same recipe and their request streams diffed.
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

Bun.serve({
  port: 8080,
  async fetch(req) {
    const url = new URL(req.url);
    const payload: any = await req.json().catch(() => ({}));
    log.push({ path: url.pathname.replace(/^\/web/, ""), params: payload.params_Lr1oSgwPR8 ?? {}, body: payload.body_o1nhHUG480 ?? {} });
    await Bun.write(out, log.map(l => JSON.stringify(l)).join("\n") + "\n");
    return new Response(JSON.stringify(answer(url.pathname, payload.params_Lr1oSgwPR8 ?? {}, payload.body_o1nhHUG480 ?? {})), { headers: { "Content-Type": "application/json" } });
  },
});
console.log("mock stand up on 8080");
