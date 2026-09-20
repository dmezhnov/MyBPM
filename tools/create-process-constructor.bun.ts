#!/usr/bin/env bun
/**
 * Create a BUSINESS PROCESS («бизнес-процесс», `boCategory: "BO_PROCESS"`) on a MyBPM stand the way the
 * constructor does it — no `.mybpm.zip` import, only `/web/v2/*` calls.
 *
 * A process is the second kind with machinery of its own (MYBPM-UI-API.md §5f): its editor is
 * `/business-objects/editing/<boId>/process-editing`, and TWO controllers stand behind it —
 * `v2/bo-process-editor2` (versions: dev/test/work, copy, drafts) and `v2/bo-process-editor`
 * (the diagram of ONE version: def, update commands, undo/redo, validation, scripts).
 *
 *   1. v2/business-objects/load-bo-groups                     → resolve the target group
 *   2. v2/business-objects/create-bo {boGroupId, boCategory}  → the process exists, «Бизнес-процесс №N»,
 *                                                               with the PROCESS_STATUS field and version 1
 *   3. v2/business-objects/save-business-object-portion       → rename (partial patch; the code FOLLOWS it)
 *   4. v2/bo-process-editor2/load-dev-bo-process-id {boId}    → boProcessId of the editable version
 *   5. v2/bo-process-editor/load-bo-process-def {boProcessId} → {figures:{<id>:{x,y,type}}, arrows:{…}}
 *   6. v2/bo-process-editor/load-new-ids {count}              → ids for the new figures and arrows
 *   7. v2/bo-process-editor/apply-update-cmd {boProcessId}    → the diagram writer, see below
 *   8. v2/bo-process-editor/validate-def {boProcessId}        → [] when the process is well-formed
 *
 * **There is no СОХРАНИТЬ and no draft in the diagram editor** — `apply-update-cmd` writes straight into
 * the version; undo/redo is server-side. The body is a JSON-patch language over the def:
 *
 *   {name: "<label for undo>",
 *    forward:  {type:"Group", list:[{type:"Set",   dotPath:"figures.<id>", value:{x,y,type}}, …]},
 *    backward: {type:"Group", list:[{type:"Unset", dotPath:"figures.<id>"}, …]}}
 *
 * `type` ∈ Set | Unset | Group; figure `type` ∈ Enter | Exit | Switch | SingleToParallel |
 * ParallelToSingle | Form | Script | Timer | Point | Terminator.
 *
 * Usage:
 *   bun tools/create-process-constructor.bun.ts --token-file <path> \
 *     --group "Бизнес-объект" --name "Проба процесс API 2026-09-18" \
 *     --figure "Exit@440,104"
 *
 *   --figure "<Type>[@x,y]"   repeatable; the figures are chained after the Enter the platform created,
 *                             each arrow leaving slot «main» and entering slot «main».
 *   --show <boId>             inspection only: versions, def and validation of an existing process.
 *
 * Token: Chrome → localStorage.LOCAL_PRIVATE_SwebToken, quotes stripped; pass it as --token-file.
 */

const argv = Bun.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const flagAll = (name: string): string[] => {
  const out: string[] = [];
  argv.forEach((a, i) => { if (a === `--${name}`) out.push(argv[i + 1]); });
  return out;
};

const stand = flag("stand");
if (!stand) throw new Error("--stand <host> is required: the stand host is never implied");
const tokenFile = flag("token-file");
const token = (tokenFile ? (await Bun.file(tokenFile).text()).trim() : undefined)
  ?? flag("token") ?? Bun.env.MYBPM_TOKEN;
if (!token) {
  console.error("no token: pass --token-file <path> / --token <value> or set MYBPM_TOKEN");
  process.exit(1);
}

/** `/web/v2` envelope: params first, body second (MYBPM-UI-API.md §1). */
async function call<T = any>(controller: string, method: string, params: object = {}, body: unknown = {}): Promise<T> {
  const res = await fetch(`https://${stand}/web/v2/${controller}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", token: token! },
    body: JSON.stringify({ useParamsFromBody: true, params_Lr1oSgwPR8: params, body_o1nhHUG480: body }),
  });
  const text = await res.text();
  if (!text) return null as T;
  let json: any;
  try { json = JSON.parse(text); } catch { return text as T; } // load-dev-bo-process-id returns a bare string
  if (json && typeof json === "object" && !Array.isArray(json) && ("errorType" in json || "className" in json)) {
    throw new Error(`${controller}/${method}: ${json.errorType ?? json.className} ${json.message ?? ""} (traceId ${json.traceId ?? "-"})`); // trap 26: never print the stackTrace
  }
  return json as T;
}
const bo  = <T = any>(m: string, p?: object, b?: unknown) => call<T>("business-objects", m, p, b);
const pe2 = <T = any>(m: string, p?: object, b?: unknown) => call<T>("bo-process-editor2", m, p, b);
const pe  = <T = any>(m: string, p?: object, b?: unknown) => call<T>("bo-process-editor", m, p, b);

type ProcDef = { figures: Record<string, { x: number; y: number; type: string }>, arrows: Record<string, any> };

async function show(boId: string) {
  const b = await bo<any>("load-business-object-by-id", { businessObjectId: boId });
  console.log(`${b.id}  ${b.boCategory}  code=${b.code}  «${b.name}»`);
  const versions = await pe2<any[]>("load-bo-process-versions", { boId });
  for (const v of versions ?? []) {
    console.log(`  version ${v.version}  ${v.boProcessId}  test=${v.isTest} work=${v.isWork}  ${v.comment ?? ""}`);
  }
  const boProcessId = await pe2<string>("load-dev-bo-process-id", { boId });
  const def = await pe<ProcDef>("load-bo-process-def", { boProcessId });
  for (const [id, f] of Object.entries(def.figures ?? {})) console.log(`  figure ${id}  ${f.type}  (${f.x},${f.y})`);
  for (const [id, a] of Object.entries<any>(def.arrows ?? {})) {
    console.log(`  arrow  ${id}  ${a.startFigureId}.${a.startSlotName} → ${a.finishFigureId}.${a.finishSlotName}`);
  }
  const errs = await pe<any[]>("validate-def", { boProcessId });
  console.log(`  validate: ${errs?.length ? errs.map(e => `${e.type}/${e.place} ${e.message}`).join(" | ") : "clean"}`);
}

if (flag("show")) { await show(flag("show")!); process.exit(0); }

/** save-business-object-portion chunks the JSON at 80 000 chars; each part carries the previous part's id. */
async function savePortion(payload: object): Promise<string | null> {
  const json = JSON.stringify(payload);
  const parts: string[] = [];
  for (let i = 0; i < json.length; i += 80_000) parts.push(json.slice(i, i + 80_000));
  let id: string | null = null;
  for (let i = 0; i < parts.length; i++) {
    id = await bo<string>("save-business-object-portion", {}, { jsonPart: parts[i], orderIndex: i, isLast: i === parts.length - 1, id });
  }
  return id;
}
const langMap = (v: string) => ({ KAZ: null, ENG: null, RUS: v, QAZ: null });

const groupName = flag("group");
const name = flag("name");
const desc = flag("desc") ?? "";
// «<Type>[@x,y]»
const figureSpecs = flagAll("figure").map((spec, i) => {
  const [type, pos] = spec.split("@");
  const [x, y] = (pos ?? `${340 + i * 220},104`).split(",").map(Number);
  return { type, x, y };
});

if (!groupName || !name) {
  console.error("need --group <name|id> and --name <process name> (or --show <boId>)");
  process.exit(1);
}

const groups = await bo<any[]>("load-bo-groups");
const group = groups.find(g => g.name === groupName || g.id === groupName);
if (!group) { console.error(`group not found: ${groupName}`); process.exit(1); }

// 2. create — the process exists on the stand from this moment on, under a generated name.
const created = await bo<{ id: string; name: string }>("create-bo", {}, { boGroupId: group.id, boCategory: "BO_PROCESS" });
const boId = created.id;
console.log(`created   ${boId}  «${created.name}»  in «${group.name}»`);
const born = await bo<any>("load-business-object-by-id", { businessObjectId: boId });
console.log(`code@new  ${born.code}   fields: ${(born.formFields ?? []).map((f: any) => `${f.code}:${f.type}`).join(", ") || "—"}`);

// 3. rename
await savePortion({ businessObject: { id: boId, nameMap: langMap(name), recordNameMap: langMap(name), description: desc } });
const renamed = await bo<any>("load-business-object-by-id", { businessObjectId: boId });
console.log(`code@rename ${renamed.code}${renamed.code === born.code ? "  (unchanged)" : "  (followed the name)"}`);

// 4-5. the editable version and its diagram — the platform already put an Enter there.
const boProcessId = await pe2<string>("load-dev-bo-process-id", { boId });
const def = await pe<ProcDef>("load-bo-process-def", { boProcessId });
console.log(`version   ${boProcessId}  figures at birth: ${Object.entries(def.figures ?? {}).map(([id, f]) => `${f.type}(${id})`).join(", ") || "—"}`);

if (figureSpecs.length) {
  // 6. ids for N figures + N arrows (one arrow into each new figure, chained from the Enter).
  const ids = await pe<string[]>("load-new-ids", { count: figureSpecs.length * 2 });
  const figIds = ids.slice(0, figureSpecs.length);
  const arrIds = ids.slice(figureSpecs.length);

  let prevId = Object.entries(def.figures ?? {}).find(([, f]) => f.type === "Enter")?.[0];
  if (!prevId) { console.error("no Enter figure to chain from"); process.exit(1); }

  const forward: any[] = [];
  const backward: any[] = [];
  figureSpecs.forEach((spec, i) => {
    forward.push({ type: "Set", dotPath: `figures.${figIds[i]}`, value: { x: spec.x, y: spec.y, type: spec.type } });
    forward.push({ type: "Set", dotPath: `arrows.${arrIds[i]}`, value: {
      startFigureId: prevId, startSlotName: "main", finishFigureId: figIds[i], finishSlotName: "main",
    } });
    backward.push({ type: "Unset", dotPath: `arrows.${arrIds[i]}` });
    backward.push({ type: "Unset", dotPath: `figures.${figIds[i]}` });
    prevId = figIds[i];
  });

  // 7. one command, one undo step — exactly what the editor sends when a figure is dropped.
  await pe("apply-update-cmd", { boProcessId }, {
    name: `add ${figureSpecs.map(f => f.type).join("+")}`,
    forward:  { type: "Group", list: forward },
    backward: { type: "Group", list: backward.reverse() },
  });
  console.log(`diagram   +${figureSpecs.length} figure(s): ${figureSpecs.map((f, i) => `${f.type}(${figIds[i]})`).join(" → ")}`);
}

// 8. verify
await show(boId);
