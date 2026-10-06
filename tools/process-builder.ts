/**
 * Build a CONFIGURED business process on a MyBPM stand and run it on test records — the logic only, with
 * no runtime of its own: every stand call goes through the `api` function the caller passes in.
 *
 * Two callers use it:
 *   - `tools/create-process-constructor.bun.ts --spec <file>` — from the shell, with a token file;
 *   - the same code INSIDE the stand's page — `create-process-constructor.bun.ts --page-script` bundles
 *     this file into one snippet that defines `window.mybpmProcess` with an `api` that reads the token
 *     from localStorage, so the token never leaves the browser (MYBPM-UI-API.md §10).
 *
 * The call sequence (MYBPM-UI-API.md §5f):
 *   1. business-objects/create-bo {boGroupId, boCategory:"BO_PROCESS"} → the process + PROCESS_STATUS + an Enter
 *   2. business-objects/save-business-object-portion                     → rename
 *   3. generate-business-form-field {fieldType:"BO", fieldBoId} + save   → the BO-reference fields a Form needs
 *      (viewType SINGLE and toShow go through `editedFields`, trap 53)
 *   4. bo-process-editor/load-new-ids + ONE apply-update-cmd              → figures (Form.fieldId set), named arrows
 *   5. script/apply-update-cmd {scriptModuleId: version, scriptId: figure} per Script/Switch → translate-script
 *   6. bo-process-editor/validate-def
 *
 * A spec (JSON):
 *   {group, name, desc?,
 *    fields:  [{key, label, type?, refBoId?}],          // process fields: type "BO" (default) needs refBoId;
 *                                                       // "FULL_DATE" etc. for a Timer
 *    figures: [{key, type, x, y, field?, slots?}],      // type "Enter" reuses the one the platform made;
 *                                                       // a Form's / Timer's `field` is a key of `fields`;
 *                                                       // `slots` = branch count of a SingleToParallel
 *                                                       // (outSlotsCount, slots out1…outN) / ParallelToSingle
 *                                                       // (inSlotsCount, slots in1…inN), default 2
 *    arrows:  [{key, from, fromSlot, to, toSlot, name?}], // slot names per figure: §5f «Slots»
 *    scripts: {<figure key>: {exit: "plain", steps?}    // Script: «Выйти из скрипта»; steps run first:
 *                                                       //   {setDate: <path>, plus: 1, unit: "MINUTES"} —
 *                                                       //     <path>.#Значение := Сейчас.увеличить(plus, unit)
 *                                                       //   {updateTrap: <path>} — <path>.#Обновить таймер для процесса
 *                          | {exit: "<arrow key>"}      // Switch: «… по стрелке»
 *                          | {if: [<path>], then: "<arrow key>", else: "<arrow key>"}}}
 *   A path starts at ЭТОТ_ПРОЦЕСС: its first element is `@<field key>` (a process field of this spec) or a
 *   field code of the process, every next one a field code of the record the previous one references; the
 *   last value is read with #Значение and tested bare (MYBPM-IMPORTS.md §16 «A Switch with a condition»).
 */

export type Api = <T = any>(controller: string, method: string, params?: object, body?: unknown) => Promise<T>;

export type FigureType = "Enter" | "Exit" | "Switch" | "SingleToParallel" | "ParallelToSingle" | "Form" |
  "Script" | "Timer" | "Point" | "Terminator";

/** A statement run before a script's exit. Paths as in `if` (below); `unit` is a DateDeltaUnit (§12 enums). */
export type ScriptStep = { setDate: string[]; plus: number; unit: string } | { updateTrap: string[] };

export type ScriptSpec = { exit: string; steps?: ScriptStep[] } | { if: string[]; then: string; else: string };

export type ProcessSpec = {
  group: string;
  name: string;
  desc?: string;
  // refBoCode is read only by the archive route (make-probe-archive.bun.ts --process-spec): an archive
  // names the target BO by code in boRefStruct.boInfo, next to its stand id in oldRefBoId
  // type defaults to "BO" (a reference, needs refBoId); any other palette type, e.g. "FULL_DATE" for a Timer
  // show: the TARGET BO's field codes the reference displays — the archive route REQUIRES it for a "BO" field
  // (MYBPM-IMPORTS.md 0.10 rule 15: an empty boRefStruct.fieldRefs renders an empty selector); the API route
  // shows every field of the target by itself
  fields?: { key: string; label: string; type?: string; refBoId?: string; refBoCode?: string; show?: string[] }[];
  figures: { key: string; type: FigureType; x: number; y: number; field?: string; slots?: number }[];
  arrows: { key: string; from: string; fromSlot: string; to: string; toSlot: string; name?: string }[];
  scripts?: Record<string, ScriptSpec>;
};

export type BuiltProcess = {
  boId: string;
  code: string;
  boProcessId: string;
  fields: Record<string, { id: string; code: string }>;
  figures: Record<string, string>;
  arrows: Record<string, string>;
  translate: Record<string, { success: boolean; messages: string[] }>;
  validate: string[];
};

const langMap = (v: string) => ({ KAZ: null, ENG: null, RUS: v, QAZ: null });
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** save-business-object-portion chunks the JSON at 80 000 chars; each part carries the previous part's id. */
async function savePortion(api: Api, payload: object): Promise<string | null> {
  const json = JSON.stringify(payload);
  let id: string | null = null;
  for (let i = 0, n = Math.ceil(json.length / 80_000); i < n; i++) {
    id = await api<string>("business-objects", "save-business-object-portion", {},
      { jsonPart: json.slice(i * 80_000, (i + 1) * 80_000), orderIndex: i, isLast: i === n - 1, id });
  }
  return id;
}

/** The blocks and expressions of one figure's script, with ids from `newId` — the editor's shape (`type`). */
export function scriptBody(spec: ScriptSpec, arrowId: (key: string) => string, fieldCode: (seg: string) => string,
                    newId: () => string) {
  const blocks: Record<string, any> = {};
  const expressions: Record<string, any> = {};
  const hat = newId();
  const exit = (target: string) => {
    const id = newId();
    blocks[id] = target === "plain"
      ? { exitType: "FROM_METHOD", type: "BlockExit" }
      : { exitType: "FROM_METHOD_BY_ARROW", targetArrowId: arrowId(target), type: "BlockExit" };
    return id;
  };
  // ЭТОТ_ПРОЦЕСС.<a>.<b>… — the field itself (a BoiFieldRefCode); `value` adds the #Значение hop.
  const path = (segs: string[], value: boolean) => {
    let expr = newId();
    expressions[expr] = { exprValueType: "THIS_PROCESS", constType: "BoiRefCode", type: "ExprValue" };
    for (const seg of [...segs.map(fieldCode), ...(value ? ["VALUE"] : [])]) {
      const next = newId();
      expressions[next] = { leftExprId: expr,
        actId: seg === "VALUE" ? "F-VALUE-K-DYN-R-D-S-boi_fields" : `F-${seg}-K-DYN-S-boi_fields`, type: "ExprAct" };
      expr = next;
    }
    return expr;
  };
  const expr = (value: object) => { const id = newId(); expressions[id] = value; return id; };
  const step = (st: ScriptStep, down: string) => {
    const id = newId();
    if ("updateTrap" in st) {
      blocks[id] = { leftExprId: expr({ leftExprId: path(st.updateTrap, false),
        actId: "F-updateTrapDate-K-FIX-T-BoiFieldRefCode", type: "ExprAct" }), downBlockId: down, type: "BlockAssign" };
      return id;
    }
    const now = expr({ exprValueType: "CONST", constType: "JavaObjectFactories", objectDescriptor: "BEAN_METHOD-DateExtensions-now",
      valueType: { type: "Object", baseType: "Date" }, type: "ExprValue" });
    const amount = expr({ exprValueType: "CONST", valueType: { baseType: "BigDecimal", type: "Number" }, constType: "BigDecimal",
      value: String(st.plus), type: "ExprValue" });
    const unit = expr({ exprValueType: "CONST", constType: "Enum", enumBaseType: "DateDeltaUnit", enumValue: st.unit,
      valueType: { type: "EnumRef", baseType: "DateDeltaUnit", enumNativeName: "DateDeltaUnit" }, type: "ExprValue" });
    const inc = expr({ leftExprId: now, actId: "F-incDate-K-FIX-T-Date", argExprIds: { amount, unit }, type: "ExprAct" });
    blocks[id] = { leftExprId: path(st.setDate, true), rightExprId: inc, downBlockId: down, type: "BlockAssign" };
    return id;
  };
  if ("exit" in spec) {
    let first = exit(spec.exit);
    for (const st of [...(spec.steps ?? [])].reverse()) first = step(st, first);
    blocks[hat] = { x: 40, y: 40, downBlockId: first, type: "BlockFixEntryPoint" };
    return { blocks, expressions };
  }
  // ЕСЛИ ЭТОТ_ПРОЦЕСС.<a>.<b>….#Значение ТО exit(then) ИНАЧЕ exit(else) — no downBlockId: both branches exit.
  const expr0 = path(spec.if, true);
  const ifId = newId();
  blocks[hat] = { x: 40, y: 40, downBlockId: ifId, type: "BlockFixEntryPoint" };
  blocks[ifId] = { ifExprId: expr0, thenBlockId: exit(spec.then),
    branches: { [newId()]: { blockId: exit(spec.else), order: 10 } }, type: "BlockIf" };
  return { blocks, expressions };
}

/**
 * The same script in the ARCHIVE's shape (`ScriptDefStructDto`, MYBPM-IMPORTS.md §5d): `type: "BlockExit"`
 * becomes `@class: "…bo.process.block.BlockExitStruct"`, `valueType` becomes `valueTypeStruct`, and the
 * defaults an export writes are filled in.
 */
export function toArchiveScript(body: { blocks: Record<string, any>; expressions: Record<string, any> }) {
  const P = "kz.greetgo.mybpm.reg.structure.model.bo.process";
  const blocks: Record<string, any> = {};
  for (const [id, { type, ...rest }] of Object.entries(body.blocks)) {
    if (rest.branches) rest.branches = Object.fromEntries(Object.entries<any>(rest.branches)
      .map(([k, b]) => [k, { ...b, hasExpr: b.hasExpr ?? false }]));
    blocks[id] = { "@class": `${P}.block.${type}Struct`, ...rest };
  }
  const expressions: Record<string, any> = {};
  for (const [id, { type, valueType, ...rest }] of Object.entries(body.expressions)) {
    if (valueType) rest.valueTypeStruct = { isArray: false, ...valueType };
    const defaults = type === "ExprValue"
      ? { isTextMultiline: false, latitude: 0, longitude: 0, methodArgs: {} }
      : type === "ExprAct" ? { canWriteValue: false } : {};
    expressions[id] = { "@class": `${P}.expr.${type}Struct`, ...rest, ...defaults };
  }
  return { blocks, expressions };
}

const setAll = (name: string, entries: [string, unknown][]) => ({
  name,
  forward: { type: "Group", list: entries.map(([dotPath, value]) => ({ type: "Set", dotPath, value })) },
  backward: { type: "Group", list: entries.map(([dotPath]) => ({ type: "Unset", dotPath })).reverse() },
});

/**
 * Write (or REWRITE) the script of one figure: whatever the figure held is unset in the same command, so a
 * second call replaces the body instead of leaving a second entry point beside the first. Then translate.
 */
export async function writeScript(api: Api, b: Pick<BuiltProcess, "boProcessId" | "figures" | "arrows" | "fields">,
                                  figKey: string, s: ScriptSpec) {
  const scriptId = b.figures[figKey];
  if (!scriptId) throw new Error(`script for unknown figure ${figKey}`);
  const scriptModuleId = b.boProcessId;
  const pool = await api<string[]>("bo-process-editor", "load-new-ids", { count: 40 });
  const body = scriptBody(s,
    key => { if (!b.arrows[key]) throw new Error(`script ${figKey}: unknown arrow ${key}`); return b.arrows[key]; },
    seg => seg.startsWith("@") ? (b.fields[seg.slice(1)]?.code ?? (() => { throw new Error(`unknown field ${seg}`); })()) : seg,
    () => { const id = pool.shift(); if (!id) throw new Error("id pool exhausted"); return id; });
  const old = await api<any>("script", "load-script-def", { scriptModuleId, scriptId }).catch(() => null);
  const set = setAll(`script ${figKey}`, [
    ...Object.entries(body.blocks).map(([id, v]) => [`blocks.${id}`, v] as [string, unknown]),
    ...Object.entries(body.expressions).map(([id, v]) => [`expressions.${id}`, v] as [string, unknown]),
  ]);
  const drop = [...Object.keys(old?.blocks ?? {}).map(id => `blocks.${id}`),
                ...Object.keys(old?.expressions ?? {}).map(id => `expressions.${id}`)];
  set.forward.list.unshift(...drop.map(dotPath => ({ type: "Unset", dotPath, value: undefined as unknown })));
  await api("script", "apply-update-cmd", { scriptModuleId, scriptId }, set);
  const t = await api<any>("script", "translate-script", { scriptModuleId, scriptId });
  return { success: !!t?.success,
    messages: (t?.diagnosticMessageList ?? []).map((m: any) => `${m.type} ${m.messageCode} ${m.message ?? ""}`) as string[] };
}

export async function buildProcess(api: Api, spec: ProcessSpec, log: (s: string) => void = () => {}): Promise<BuiltProcess> {
  const groups = await api<any[]>("business-objects", "load-bo-groups");
  const group = groups.find(g => g.name === spec.group || g.id === spec.group);
  if (!group) throw new Error(`group not found: ${spec.group}`);

  // 1-2. create + rename
  const created = await api<{ id: string; name: string }>("business-objects", "create-bo", {},
    { boGroupId: group.id, boCategory: "BO_PROCESS" });
  const boId = created.id;
  log(`created   ${boId}  «${created.name}»  in «${group.name}»`);
  await savePortion(api, { businessObject: { id: boId, nameMap: langMap(spec.name), recordNameMap: langMap(spec.name),
    description: spec.desc ?? "" } });

  // 3. BO-reference fields. A field save within ~1 s of the rename appends a uniquifier to the BO code
  // (create-bo-constructor.bun.ts, RACE) — wait first.
  const fields: BuiltProcess["fields"] = {};
  if (spec.fields?.length) {
    await sleep(3000);
    const bo = await api<any>("business-objects", "load-business-object-by-id", { businessObjectId: boId });
    const added: any[] = [];
    const edits: any[] = [];
    let y = Math.max(0, ...(bo.formFields ?? []).map((f: any) => (f.gridPosition?.y ?? 0) + (f.gridPosition?.rows ?? 0)));
    for (const f of spec.fields) {
      const type = f.type ?? "BO";
      const dto = await api<any>("business-objects", "generate-business-form-field",
        { boId, fieldType: type, fieldBoId: type === "BO" ? f.refBoId : undefined });
      dto.label = f.label;
      dto.labelMap = langMap(f.label);
      dto.gridPosition = { x: 0, y, rows: 6, cols: 15 };
      y += 6;
      added.push(dto);
      if (type !== "BO") {
        edits.push({ fieldId: dto.fieldId, gridPosition: dto.gridPosition, needFreezeWhenScroll: false });
        continue;
      }
      // Without these the record card draws an empty selector (trap 53); they only take via editedFields.
      const boFieldRefs = (dto.boFieldRefs ?? []).map((r: any, i: number) => ({ ...r, toShow: true, orderIndex: i }));
      Object.assign(dto, { viewType: "SINGLE", boFieldRefs });
      edits.push({ fieldId: dto.fieldId, gridPosition: dto.gridPosition, needFreezeWhenScroll: false,
        viewType: "SINGLE", boFieldRefs });
    }
    bo.formFields = [...(bo.formFields ?? []), ...added];
    await savePortion(api, { businessObject: bo, editedFields: edits, addedFieldIds: added.map(f => f.fieldId),
      deletedFieldIds: [] });
    const saved = await api<any>("business-objects", "load-business-object-by-id", { businessObjectId: boId });
    spec.fields.forEach((f, i) => {
      const s = saved.formFields.find((x: any) => x.fieldId === added[i].fieldId);
      if (!s) throw new Error(`field «${f.label}» did not survive the save`);
      fields[f.key] = { id: s.fieldId, code: s.code };
      log(`field     ${f.key} = ${s.fieldId}  code=${s.code}  ${s.fieldType ?? f.type ?? "BO"}${f.refBoId ? ` → ${f.refBoId}` : ""}`);
    });
  }
  const code = (await api<any>("business-objects", "load-business-object-by-id", { businessObjectId: boId })).code;

  // 4. the diagram in one command: figures (the born Enter reused) + arrows with their names
  const boProcessId = await api<string>("bo-process-editor2", "load-dev-bo-process-id", { boId });
  const def = await api<any>("bo-process-editor", "load-bo-process-def", { boProcessId });
  const enterId = Object.entries<any>(def.figures ?? {}).find(([, f]) => f.type === "Enter")?.[0];
  const fresh = spec.figures.filter(f => f.type !== "Enter");
  const ids = await api<string[]>("bo-process-editor", "load-new-ids", { count: fresh.length + spec.arrows.length });
  const figures: Record<string, string> = {};
  const arrows: Record<string, string> = {};
  const entries: [string, unknown][] = [];
  for (const f of spec.figures) {
    if (f.type === "Enter") {
      if (!enterId) throw new Error("the platform made no Enter");
      figures[f.key] = enterId;
      entries.push([`figures.${enterId}.x`, f.x], [`figures.${enterId}.y`, f.y]);
      continue;
    }
    const id = ids.shift()!;
    figures[f.key] = id;
    const value: any = { x: f.x, y: f.y, type: f.type };
    if (f.type === "Form") {
      const field = f.field ? fields[f.field] : undefined;
      if (f.field && !field) throw new Error(`Form ${f.key}: unknown field key ${f.field}`);
      Object.assign(value, { fieldId: field?.id ?? null, createTimer: null, openFormTimer: null, touchDraftTimer: null });
    }
    if (f.type === "Script") value.script = null;
    // the editor's palette and slot-drag write exactly these (bundle chunk 9839: createFigureSingleToParallel …)
    if (f.type === "SingleToParallel") value.outSlotsCount = f.slots ?? 2;
    if (f.type === "ParallelToSingle") value.inSlotsCount = f.slots ?? 2;
    if (f.type === "Terminator") value.fieldId = "";
    if (f.type === "Timer") {
      // «Выберите поле с датой» writes just this; a Timer with no field still validates clean
      const field = f.field ? fields[f.field] : undefined;
      if (f.field && !field) throw new Error(`Timer ${f.key}: unknown field key ${f.field}`);
      value.fieldId = field?.id ?? null;
    }
    entries.push([`figures.${id}`, value]);
  }
  for (const a of spec.arrows) {
    const id = ids.shift()!;
    arrows[a.key] = id;
    const value: any = { startFigureId: figures[a.from], startSlotName: a.fromSlot,
      finishFigureId: figures[a.to], finishSlotName: a.toSlot };
    if (!value.startFigureId || !value.finishFigureId) throw new Error(`arrow ${a.key}: unknown figure`);
    if (a.name) value.name = a.name;
    entries.push([`arrows.${id}`, value]);
  }
  await api("bo-process-editor", "apply-update-cmd", { boProcessId }, setAll("build diagram", entries));
  log(`diagram   ${boProcessId}: ${spec.figures.map(f => `${f.type}(${figures[f.key]})`).join(", ")}`);

  // 5. scripts — module = the version, script = the figure
  const translate: BuiltProcess["translate"] = {};
  for (const [figKey, s] of Object.entries(spec.scripts ?? {})) {
    translate[figKey] = await writeScript(api, { boProcessId, figures, arrows, fields }, figKey, s);
    log(`script    ${figKey}: ${translate[figKey].success ? "success" : "FAILED"} ${translate[figKey].messages.join(" | ")}`);
  }

  // 6. validate
  const errs = await api<any[]>("bo-process-editor", "validate-def", { boProcessId, testMode: true });
  const validate = (errs ?? []).map(e => `${e.type}/${e.place} ${e.message}`);
  log(`validate  ${validate.length ? validate.join(" | ") : "clean"}`);
  return { boId, code, boProcessId, fields, figures, arrows, translate, validate };
}

/**
 * Run a process whose first Form waits for a referenced record — the §5f recipe, on TEST records (a
 * constructor-made version is `isTest`; pass `state: "ALL"` for a published one):
 *   a new record of the referenced BO with `values` → a new process record with the reference field set
 *   (the process starts on this save, the Form binds to that record) → wait until a step STANDs (the start
 *   is asynchronous: right after the save `load-process-steps` is still `[]`) → the referenced record saved
 *   again with `release`, which MUST change a value (a save that changes nothing does not release the Form)
 *   → the process steps, read back.
 * `values` / `release` are keyed by FIELD CODE of the referenced BO, in the `save-field-value` shape of §6b.
 */
export async function runOnTestRecord(api: Api, p: { boId: string; boProcessId: string; refFieldId: string;
    refBoId: string; values: Record<string, string>; release: Record<string, string>; state?: "DEV" | "ALL" }) {
  const boiState = p.state ?? "DEV";
  const ref = await api<any>("business-objects", "load-business-object-by-id", { businessObjectId: p.refBoId });
  const fieldValues = (v: Record<string, string>) => Object.entries(v).map(([c, value]) => {
    const f = ref.formFields.find((x: any) => x.code === c);
    if (!f) throw new Error(`no field ${c} on ${p.refBoId}`);
    return { fieldId: f.fieldId as string, value };
  });
  const save = async (boId: string, draftId: string, boInstanceId: string, values: { fieldId: string; value: string }[]) => {
    if (values.length) await api("instance-field-form", "save-field-value", {}, { draftId, boId, boInstanceId, values });
    // A refused save still answers 200; the refusal is a form command (e.g. a required field left empty).
    const r = await api<any>("instance-form", "validate-apply-remove-draft", { draftId });
    const alert = (r?.formCommands ?? []).find((c: any) => c.commandType === "ALERT_SAVE_BUTTON_NOTIFICATION");
    if (alert) throw new Error(`save of ${boId} refused: ${alert.notificationBody?.notificationText?.text}`);
  };
  const saveNew = async (boId: string, values: { fieldId: string; value: string }[]) => {
    const d = await api<any>("instance-form-create-draft", "create-draft-with-boi", { boId, boiState, isReadMode: false }, {});
    await save(boId, d.draftId, d.boiId, values);
    return d.boiId as string;
  };
  const steps = () => api<any[]>("boi-process", "load-process-steps", { boProcessId: p.boProcessId, boiId: poiId });
  const brief = (s: any[]) => (s ?? []).map(x => `${x.figureId}:${x.state}${x.scriptRunSuccess === false ? "!" : ""}`);

  const refBoiId = await saveNew(p.refBoId, fieldValues(p.values));
  const poiId = await saveNew(p.boId, [{ fieldId: p.refFieldId, value: JSON.stringify([refBoiId]) }]);
  let afterStart: any[] = [];
  for (let i = 0; i < 20 && !afterStart.some(s => s.state === "STAND"); i++) { await sleep(500); afterStart = await steps(); }
  const draftId = await api<string>("instance-form-create-draft", "create-draft", { boId: p.refBoId, boiId: refBoiId, draftId: null }, {});
  await save(p.refBoId, draftId, refBoiId, fieldValues(p.release));
  let final: any[] = [];
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    final = await steps();
    // GO = a figure still running (seen on a Switch right after the Form was released) — not an end state.
    if (!final.some(s => s.state === "STAND" || s.state === "GO")) break;
  }
  return { refBoiId, poiId, afterStart: brief(afterStart), final: brief(final) };
}

/**
 * Run a process that waits on nothing but itself (a Timer, scripts): save a new process record with
 * `values` (keyed by FIELD CODE of the process, `save-field-value` shape) and poll its steps every
 * `everyMs` until no step is STAND/WAITING/GO or `maxMs` runs out; `sink` gets the boiId and the growing
 * timeline at once (a long run outlives one javascript_tool call). Returns the timeline — one entry per change.
 */
export async function runAndWatch(api: Api, p: { boId: string; boProcessId: string; values?: Record<string, string>;
    state?: "DEV" | "ALL"; everyMs?: number; maxMs?: number; sink?: { boiId?: string; timeline?: unknown[] } }) {
  const bo = await api<any>("business-objects", "load-business-object-by-id", { businessObjectId: p.boId });
  const values = Object.entries(p.values ?? {}).map(([c, value]) => {
    const f = bo.formFields.find((x: any) => x.code === c);
    if (!f) throw new Error(`no field ${c} on ${p.boId}`);
    return { fieldId: f.fieldId as string, value };
  });
  const d = await api<any>("instance-form-create-draft", "create-draft-with-boi",
    { boId: p.boId, boiState: p.state ?? "DEV", isReadMode: false }, {});
  if (values.length) await api("instance-field-form", "save-field-value", {}, { draftId: d.draftId, boId: p.boId, boInstanceId: d.boiId, values });
  const r = await api<any>("instance-form", "validate-apply-remove-draft", { draftId: d.draftId });
  const alert = (r?.formCommands ?? []).find((c: any) => c.commandType === "ALERT_SAVE_BUTTON_NOTIFICATION");
  if (alert) throw new Error(`save of ${p.boId} refused: ${alert.notificationBody?.notificationText?.text}`);
  const t0 = Date.now();
  const timeline: { s: number; steps: string[] }[] = [];
  if (p.sink) Object.assign(p.sink, { boiId: d.boiId, timeline }); // readable while the run is still going
  let last = "";
  for (;;) {
    const steps = await api<any[]>("boi-process", "load-process-steps", { boProcessId: p.boProcessId, boiId: d.boiId });
    const brief = (steps ?? []).map(x => `${x.figureId}:${x.state}${x.scriptRunSuccess === false ? "!" : ""}`);
    const key = brief.join(" ");
    if (key !== last) { timeline.push({ s: Math.round((Date.now() - t0) / 1000), steps: brief }); last = key; }
    // STAND = waiting (a Form, a Timer before its due time), WAITING = a Timer past due, not yet fired, GO = running
    const busy = (steps ?? []).some(x => x.state === "STAND" || x.state === "WAITING" || x.state === "GO");
    if ((steps?.length && !busy) || Date.now() - t0 > (p.maxMs ?? 180_000)) break;
    await sleep(p.everyMs ?? 5000);
  }
  return { boiId: d.boiId as string, timeline };
}
