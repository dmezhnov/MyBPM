#!/usr/bin/env bun
/**
 * Validator for a Block IDE script file (the clipboard JSON of Part II) — checks it against the RULES OF §0S
 * of `MYBPM-IMPORTS.md` and nothing else: the 0S.11 self-check, the 0S.9 rules a machine can see, the enum
 * values and the actId catalogue, and the 0S.2a house style. Written to grade scripts produced by a model
 * that was given only that document; the `[…]` tag of every finding names the rule.
 *
 * Severity:
 *   FATAL — the IDE / server is expected to reject the file or be damaged by it (bad JSON, unknown enum value)
 *   ERROR — it pastes but is wrong: broken graph, out-of-scope variable, an actId that does not exist,
 *           a rule of 0S.9 violated (silent damage at run time)
 *   WARN  — house style (0S.2a) and suspicious-but-legal shapes
 *
 *   bun tools/validate-script.bun.ts <script.json> [--spec <spec.json>] [--json]
 *
 * The optional spec says what the task supplied, so the external ids can be checked:
 *   { "kind": "method" | "hook" | "process",
 *     "params":  { "<param id>": "Text" | "Number" | "Bool" | "Bo" },   // the method's parameters
 *     "fields":  { "<field code>": "Text" | "Number" | "Bool" | "Date" | "SingleSelect" | "Bo" | "TextLang" | "Any" },
 *     "arrows":  ["<targetArrowId>", …],
 *     "callees": { "<methodName>": ["<param id>", …] } }
 * Without a spec the external ids are not checked and the kind is guessed from the root block.
 */

const ID_RE = /^[A-Za-z0-9@~]{16}$/;
const DOC = `${import.meta.dir}/../MYBPM-IMPORTS.md`;

const BLOCK_TYPES = new Set(["BlockFixMethod", "BlockFixEntryPoint", "BlockNewVar", "BlockAssign", "BlockIf",
  "BlockForeach", "BlockExit", "BlockFunc"]);
const EXPR_TYPES = new Set(["ExprValue", "ExprOp", "ExprAct", "ExprCall", "ExprFunc"]);
// §12a «Every opType — 17»
const OP_TYPES = new Set(["Concat", "Plus", "Minus", "Mul", "Div", "And", "Or", "Xor", "Not", "Less", "LessEq",
  "More", "MoreEq", "Eq", "NotEq", "OrEq", "AndNotEq"]);
const MORE_OK: Record<string, string[]> = {
  Concat: ["Concat"], Plus: ["Plus", "Minus", "Mul", "Div"], Minus: ["Plus", "Minus", "Mul", "Div"],
  Mul: ["Plus", "Minus", "Mul", "Div"], Div: ["Plus", "Minus", "Mul", "Div"], And: ["And", "Or", "Xor"],
  Or: ["And", "Or", "Xor"], Xor: ["And", "Or", "Xor"], Less: ["Less", "LessEq", "More", "MoreEq"],
  LessEq: ["Less", "LessEq", "More", "MoreEq"], More: ["Less", "LessEq", "More", "MoreEq"],
  MoreEq: ["Less", "LessEq", "More", "MoreEq"], Eq: ["OrEq"], NotEq: ["AndNotEq"],
};
const EXIT_TYPES = new Set(["FROM_METHOD", "FROM_CIRCLE", "FROM_CIRCLE_ITER", "FROM_METHOD_BY_ARROW"]);
const VALUE_TYPES = new Set(["CONST", "VAR_REF", "THIS_PROCESS"]);
// §12a «Value kinds of ExprValue»
const CONST_TYPES = new Set(["String", "BigDecimal", "Boolean", "Date", "GeoPoint", "BoRefCode", "BoiRefCode",
  "SingleSelectRefCode", "Enum", "JavaObjectFactories", "ScriptMethodRef", "PrintFormRef", "ReportRefCode"]);
const NUMBER_ACTS = new Set(["F-length-K-FIX-T-String", "F-convertToBigDecimal-K-FIX-T-String",
  "F-intPart-K-FIX-T-BigDecimal", "F-fractionPart-K-FIX-T-BigDecimal", "F-abs-K-FIX-T-BigDecimal",
  "F-round-K-FIX-T-BigDecimal", "F-roundFractionPart-K-FIX-T-BigDecimal", "F-COUNT-K-DYN-R-D-S-boi_fields"]);
const BOOL_ACTS = new Set(["F-isEmpty-K-FIX-T-String", "F-doesItMatchARegularExpression-K-FIX-T-String",
  "F-isOdd-K-FIX-T-BigDecimal", "F-isEven-K-FIX-T-BigDecimal", "F-contains-K-FIX-T-String"]);
// §12a «Searching records — filters»: F-create<X>Filter-K-FIX-T-BoFieldRefCode
const FILTERS = new Set(["ExactEquality", "ExactInequality", "ContainsText", "ContainsPhraseText", "StartsWithText",
  "EndsWithText", "GreaterThan", "LessThan", "GreaterThanOrEqual", "LessThanOrEqual", "GreaterThanButLessThan",
  "GreaterThanOrEqualButLessThan", "GreaterThanButLessThanOrEqual", "GreaterThanOrEqualButLessThanOrEqual",
  "ContainsAny", "ExactEmpty"]);
const VALUE_ACT = "F-VALUE-K-DYN-R-D-S-boi_fields";

type Sev = "FATAL" | "ERROR" | "WARN";
const findings: { sev: Sev; rule: string; msg: string }[] = [];
const add = (sev: Sev, rule: string, msg: string) => findings.push({ sev, rule, msg });

const args = Bun.argv.slice(2);
const file = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--spec");
const specPath = args.includes("--spec") ? args[args.indexOf("--spec") + 1] : undefined;
const asJson = args.includes("--json");
if (!file) { console.error("usage: bun tools/validate-script.bun.ts <script.json> [--spec spec.json] [--json]"); process.exit(2); }

const spec: any = specPath ? await Bun.file(specPath).json() : {};
const docText = await Bun.file(DOC).text();
const KNOWN_ACTS = new Set(docText.match(/F-[A-Za-z0-9_]+-K-(?:FIX-T-[A-Za-z]+|DYN-[A-Za-z_-]+?(?:boi_fields|bo_fields|TextLang))/g) ?? []);
// §12a field-type rows list the collection acts short (`F-DELETE`, …, all `-K-DYN-R-D-S-boi_fields`)
for (const line of docText.split("\n")) if (line.includes("all `-K-DYN-R-D-S-boi_fields`"))
  for (const m of line.matchAll(/`(F-[A-Z_]+)(?=[` (])/g)) KNOWN_ACTS.add(`${m[1]}-K-DYN-R-D-S-boi_fields`);

let s: any;
const raw = await Bun.file(file).text();
// §0S.3: the delivered file is pure ASCII, Cyrillic as \uXXXX — raw text read in another code page pastes broken names
const nonAscii = raw.match(/[^\x00-\x7f]/g);
if (nonAscii) add("ERROR", "0S.3", `${nonAscii.length} non-ASCII characters (first «${nonAscii[0]}») — write them as \\uXXXX escapes`);
try { s = JSON.parse(raw); }
catch (e) { add("FATAL", "0S.3", `not JSON: ${(e as Error).message}`); finish(); }

// ---- 0S.3 envelope
for (const k of ["copiedType", "mouseX", "mouseY", "startBlockIds", "blocks", "expressions"])
  if (!(k in s)) add("FATAL", "0S.3", `envelope lacks "${k}"`);
for (const k of Object.keys(s)) if (!["copiedType", "mouseX", "mouseY", "startBlockIds", "blocks", "expressions"].includes(k))
  add("WARN", "0S.3", `extra envelope key "${k}"`);
if (s.copiedType !== undefined && s.copiedType !== "SCRIPT_BLOCKS") add("FATAL", "0S.3", `copiedType "${s.copiedType}"`);
const B: Record<string, any> = s.blocks ?? {}, E: Record<string, any> = s.expressions ?? {};
const starts: string[] = Array.isArray(s.startBlockIds) ? s.startBlockIds : [];
if (starts.length !== 1) add("ERROR", "0S.3", `startBlockIds must hold ONE id, has ${starts.length}`);
const root = starts[0];
if (root && !B[root]) add("ERROR", "0S.3", `startBlockIds → "${root}" is not a block`);

// ---- 0S.4 ids: format, one namespace
const seen = new Map<string, string>();
const claim = (id: string, where: string) => {
  if (!ID_RE.test(id)) add("ERROR", "0S.4", `${where} id "${id}" is not 16 chars of [A-Za-z0-9@~]`);
  if (seen.has(id)) add("ERROR", "0S.4", `id "${id}" used twice (${seen.get(id)} and ${where})`);
  seen.set(id, where);
};
for (const id of Object.keys(B)) claim(id, "block");
for (const id of Object.keys(E)) claim(id, "expression");
for (const [id, b] of Object.entries(B)) for (const k of Object.keys(b.branches ?? {})) claim(k, `branch of ${id}`);
for (const [id, e] of Object.entries(E)) for (const k of Object.keys(e.more ?? {})) claim(k, `more of ${id}`);

// ---- enum values (0S.9 rule 13)
for (const [id, b] of Object.entries(B)) {
  if (!BLOCK_TYPES.has(b.type)) add("FATAL", "0S.9/13", `block ${id} type "${b.type}"`);
  if (b.type === "BlockExit" && !EXIT_TYPES.has(b.exitType)) add("FATAL", "0S.9/13", `block ${id} exitType "${b.exitType}"`);
  if (b.type === "BlockFunc") add("WARN", "§12a", `block ${id} BlockFunc — old panel only`);
}
for (const [id, e] of Object.entries(E)) {
  if (!EXPR_TYPES.has(e.type)) add("FATAL", "0S.9/13", `expression ${id} type "${e.type}"`);
  if (e.type === "ExprValue") {
    if (!VALUE_TYPES.has(e.exprValueType)) add("FATAL", "0S.9/13", `expression ${id} exprValueType "${e.exprValueType}"`);
    if (e.exprValueType === "CONST" && !CONST_TYPES.has(e.constType)) add("FATAL", "0S.9/13", `expression ${id} constType "${e.constType}"`);
    if (e.exprValueType === "CONST" && "value" in e && typeof e.value !== "string") add("ERROR", "0S.6", `expression ${id} value is not a string`);
    if (e.constType === "Boolean" && "value" in e && !["yes", "no"].includes(e.value)) add("ERROR", "0S.6", `expression ${id} Boolean value "${e.value}" (yes/no)`);
  }
  if (e.type === "ExprOp") {
    if (!OP_TYPES.has(e.opType)) add("FATAL", "0S.9/13", `expression ${id} opType "${e.opType}"`);
    for (const m of Object.values<any>(e.more ?? {})) {
      if (!OP_TYPES.has(m.opType)) add("FATAL", "0S.9/13", `more of ${id} opType "${m.opType}"`);
      else if (!(MORE_OK[e.opType] ?? []).includes(m.opType)) add("ERROR", "§12a", `more of ${id}: ${e.opType} cannot continue with ${m.opType}`);
    }
    if (e.opType === "Not" && e.rightExprId) add("ERROR", "0S.6", `expression ${id} Not is unary (leftExprId only)`);
    if (["OrEq", "AndNotEq"].includes(e.opType)) add("ERROR", "0S.6", `expression ${id} ${e.opType} only inside more`);
  }
}

// ---- 0S.11/2-3: dangling ids, every expression referenced exactly once
const exprRefs = new Map<string, number>();
const parentOf = new Map<string, { kind: "block" | "expr"; id: string; slot: string }>();
const refExpr = (eid: any, from: string, kind: "block" | "expr", slot: string) => {
  if (eid == null) return;
  if (!E[eid]) { add("ERROR", "0S.11/2", `${from}.${slot} → "${eid}" is not an expression`); return; }
  exprRefs.set(eid, (exprRefs.get(eid) ?? 0) + 1);
  parentOf.set(eid, { kind, id: from, slot });
};
for (const [id, b] of Object.entries(B)) {
  for (const k of ["valueExprId", "leftExprId", "rightExprId", "ifExprId", "srcExprId", "returnExprId"]) refExpr(b[k], id, "block", k);
  for (const br of Object.values<any>(b.branches ?? {})) refExpr(br.exprId, id, "block", "branch");
}
for (const [id, e] of Object.entries(E)) {
  for (const k of ["leftExprId", "rightExprId"]) refExpr(e[k], id, "expr", k);
  for (const m of Object.values<any>(e.more ?? {})) refExpr(m.exprId, id, "expr", "more");
  for (const [k, v] of Object.entries<any>(e.argExprIds ?? {})) refExpr(v, id, "expr", `arg:${k}`);
  for (const a of Object.values<any>(e.args ?? {})) refExpr(a.exprId, id, "expr", "call-arg");
}
for (const id of Object.keys(E)) {
  const n = exprRefs.get(id) ?? 0;
  if (n === 0) add("ERROR", "0S.11/3", `expression ${id} is never referenced (orphan)`);
  if (n > 1) add("ERROR", "0S.6", `expression ${id} referenced ${n} times (must be a tree)`);
}

// ---- kind
const rootType = B[root]?.type;
const kind: string = spec.kind ?? (rootType === "BlockFixEntryPoint" ? "process" : "method");
const hat = rootType === "BlockFixMethod" ? B[root] : undefined;
const params: Record<string, string> = { ...(spec.params ?? {}) };
if (hat) for (const [pid, p] of Object.entries<any>(hat.params ?? {})) params[pid] ??= p.type?.type ?? "Any";
if (kind === "process" && rootType !== "BlockFixEntryPoint") add("ERROR", "0S.5", `a process script starts with BlockFixEntryPoint, root is ${rootType}`);
if (kind === "hook" && rootType !== "BlockFixEntryPoint") add("WARN", "0S.12/7", `a hook body normally starts with its BlockFixEntryPoint, root is ${rootType}`);
if (kind === "method" && rootType === "BlockFixEntryPoint") add("ERROR", "0S.5", "a method body has no BlockFixEntryPoint");
// a hat stays only on the 7b / archive route, which is the route for a body reading a Bo parameter (0S.9 rule 4)
const readsBoParam = () => Object.values<any>(E).some((e) => e.type === "ExprAct" && /-K-DYN-S-boi_fields$/.test(e.actId)
  && E[e.leftExprId]?.exprValueType === "VAR_REF" && params[E[e.leftExprId].varBlockId] === "Bo");
if (hat && !readsBoParam()) add("WARN", "0S.12/1", "the method hat is still in the file — a body paste strips it (a hat never pastes)");

// ---- 0S.11/1 reachability + 4/5 scope and names, walking chains
const reached = new Map<string, number>();
const decl = new Map<string, { name: string; type: string }>(); // declaring block id → name, inferred type
const exitsFromMethod: string[] = [];
const rootChain: string[] = [];

function typeOf(eid: string | undefined, depth = 0): string {
  const e = eid ? E[eid] : undefined;
  if (!e || depth > 30) return "Any";
  if (e.type === "ExprValue") {
    if (e.exprValueType === "CONST") return ({ String: "Text", BigDecimal: "Number", Boolean: "Bool", BoiRefCode: "Bo", BoRefCode: "BoType", SingleSelectRefCode: "SingleSelect", Date: "Date" } as any)[e.constType] ?? "Any";
    if (e.exprValueType === "THIS_PROCESS") return "Bo";
    if (e.exprValueType === "VAR_REF") return params[e.varBlockId] ?? decl.get(e.varBlockId)?.type ?? "Any";
  }
  if (e.type === "ExprOp") {
    if (["Plus", "Minus", "Mul", "Div"].includes(e.opType)) return "Number";
    if (e.opType === "Concat") return "Text";
    return "Bool";
  }
  if (e.type === "ExprAct") {
    if (NUMBER_ACTS.has(e.actId)) return "Number";
    if (BOOL_ACTS.has(e.actId)) return "Bool";
    if (e.actId === VALUE_ACT) {
      const f = E[e.leftExprId]?.actId?.match(/^F-(.+)-K-DYN-S-boi_fields$/)?.[1];
      return f ? (spec.fields?.[f] ?? "Any") : "Any";
    }
    if (/-K-FIX-T-String$/.test(e.actId) && /F-(substring|toLower|toUpper|trim|replaceByTemplate)/.test(e.actId)) return "Text";
  }
  return "Any";
}

function walk(first: string | undefined, scope: Map<string, string>, depth: number, loops: string[], isRoot: boolean) {
  let cur = first;
  const local = new Map(scope);
  while (cur) {
    const b = B[cur];
    if (!b) { add("ERROR", "0S.11/2", `chain → "${cur}" is not a block`); return; }
    reached.set(cur, (reached.get(cur) ?? 0) + 1);
    if ((reached.get(cur) ?? 0) > 1) { add("ERROR", "0S.11/1", `block ${cur} reached more than once`); return; }
    if (isRoot) rootChain.push(cur);
    checkScope(cur, b, local, loops);
    if (b.type === "BlockNewVar") {
      if (local.has(b.varName)) add("ERROR", "0S.9/7", `"${b.varName}" declared again while visible (block ${cur})`);
      local.set(b.varName, cur);
      decl.set(cur, { name: b.varName, type: typeOf(b.valueExprId) });
    }
    if (b.type === "BlockIf") {
      walk(b.thenBlockId, local, depth + 1, loops, false);
      const brs = Object.values<any>(b.branches ?? {}).sort((x, y) => x.order - y.order);
      brs.forEach((br, i) => {
        if (br.hasExpr && !br.exprId) add("ERROR", "0S.5", `branch of ${cur}: hasExpr without exprId`);
        if (!br.exprId && i !== brs.length - 1) add("ERROR", "0S.5", `branch of ${cur}: plain ИНАЧЕ is not the last branch`);
        walk(br.blockId, local, depth + 1, loops, false);
      });
    }
    if (b.type === "BlockForeach") {
      const inner = new Map(local);
      if (inner.has(b.elementVarName)) add("ERROR", "0S.9/7", `loop element "${b.elementVarName}" shadows a visible name (block ${cur})`);
      inner.set(b.elementVarName, cur);
      const st = typeOf(b.srcExprId);
      decl.set(cur, { name: b.elementVarName, type: st === "Number" ? "Number" : "Any" });
      walk(b.bodyBlockId, inner, depth + 1, [...loops, cur], false);
    }
    if (b.type === "BlockExit") {
      if (b.downBlockId) add("ERROR", "0S.5", `exit block ${cur} has a downBlockId`);
      if (b.exitType === "FROM_METHOD") exitsFromMethod.push(cur);
      if (["FROM_CIRCLE", "FROM_CIRCLE_ITER"].includes(b.exitType) && !loops.includes(b.circleBlockId))
        add("ERROR", "0S.5", `exit ${cur} names loop "${b.circleBlockId}" it is not inside`);
      if (b.exitType === "FROM_CIRCLE_ITER") add("WARN", "0S.5", `exit ${cur} FROM_CIRCLE_ITER — prefer a guard ЕСЛИ`);
      if (b.exitType === "FROM_METHOD_BY_ARROW") {
        if (kind !== "process") add("ERROR", "0S.5", `exit ${cur} by arrow outside a process script`);
        if (spec.arrows && !spec.arrows.includes(b.targetArrowId)) add("ERROR", "0S.4", `exit ${cur} targetArrowId "${b.targetArrowId}" is not one the user supplied`);
      }
    }
    cur = b.downBlockId;
  }
}

function checkScope(bid: string, b: any, scope: Map<string, string>, _loops: string[]) {
  const visible = new Set(scope.values());
  const own = b.type === "BlockForeach" ? [b.srcExprId] : b.type === "BlockIf"
    ? [b.ifExprId, ...Object.values<any>(b.branches ?? {}).map((x) => x.exprId)]
    : [b.valueExprId, b.leftExprId, b.rightExprId, b.returnExprId];
  const stack = own.filter(Boolean);
  while (stack.length) {
    const eid = stack.pop()!; const e = E[eid]; if (!e) continue;
    if (e.type === "ExprValue" && e.exprValueType === "VAR_REF") {
      const v = e.varBlockId;
      if (!(v in params) && !visible.has(v)) {
        if (!hat && !spec.params) add("WARN", "0S.11/4", `VAR_REF ${eid} → "${v}" out of scope (a parameter? no spec given)`);
        else add("ERROR", "0S.11/4", `VAR_REF ${eid} → "${v}" is neither a parameter nor a visible variable (block ${bid})`);
      }
    }
    for (const k of ["leftExprId", "rightExprId"]) if (e[k]) stack.push(e[k]);
    for (const m of Object.values<any>(e.more ?? {})) stack.push(m.exprId);
    for (const v of Object.values<any>(e.argExprIds ?? {})) stack.push(v);
    for (const a of Object.values<any>(e.args ?? {})) stack.push(a.exprId);
  }
}

if (B[root]) walk(root, new Map(), 0, [], true);
for (const id of Object.keys(B)) if (!reached.has(id)) add("ERROR", "0S.11/1", `block ${id} (${B[id].type}) is unreachable`);

// ---- 0S.9 rule 3: one FROM_METHOD, at the end
if (kind === "method") {
  if (exitsFromMethod.length !== 1) add("ERROR", "0S.9/3", `${exitsFromMethod.length} FROM_METHOD exits (exactly one)`);
  const last = rootChain[rootChain.length - 1];
  if (exitsFromMethod.length && !(B[last]?.type === "BlockExit" && B[last].exitType === "FROM_METHOD"))
    add("ERROR", "0S.9/3", "the FROM_METHOD is not the last block of the top-level chain");
}
if (kind === "hook") {
  const last = rootChain[rootChain.length - 1];
  if (!(B[last]?.type === "BlockExit" && B[last].exitType === "FROM_METHOD")) add("WARN", "0S.12/7", "a hook body closes with BlockExit FROM_METHOD");
}
if (kind === "process") {
  // 0S.5: a Script figure ends in a plain FROM_METHOD, a Switch ends every path by one of its arrows — never both
  const exits = Object.values<any>(B).filter((b) => b.type === "BlockExit");
  const byArrow = exits.filter((b) => b.exitType === "FROM_METHOD_BY_ARROW").length;
  const plain = exits.filter((b) => b.exitType === "FROM_METHOD").length;
  if (byArrow && plain) add("ERROR", "0S.5", "a process script mixes FROM_METHOD and exits by arrow (Script vs Switch)");
  if (!byArrow && !plain) add("ERROR", "0S.5", "a process script with no exit");
  if (spec.arrows?.length > 1 && !byArrow) add("ERROR", "0S.5", "several outgoing arrows = a Switch, but the script never exits by an arrow");
  if (spec.arrows?.length === 1 && byArrow) add("ERROR", "0S.5", "one outgoing arrow = a Script figure, it ends in a plain FROM_METHOD");
}

// ---- actIds, hops, calls, operators (0S.6–0S.9)
for (const [id, e] of Object.entries(E)) {
  if (e.type === "ExprAct") {
    const a: string = e.actId ?? "";
    const field = a.match(/^F-(.+)-K-DYN-S-boi_fields$/)?.[1];
    const co = a.match(/^CO_CODE-(.+)-F-(.+)-K-DYN-S-boi_fields$/);
    const boField = a.match(/^F-(.+)-K-DYN-S-bo_fields$/)?.[1]; // a field of a BO TYPE (§12a filters)
    const filter = a.match(/^F-create(\w+)Filter-K-FIX-T-BoFieldRefCode$/)?.[1];
    if (co) { /* composite attribute — codes not checked */ }
    else if (boField) { if (spec.fields && !(boField in spec.fields)) add("ERROR", "0S.7", `expression ${id} filters on field "${boField}" the task did not give`); }
    else if (filter) { if (!FILTERS.has(filter)) add("ERROR", "§12a", `expression ${id} filter constructor "${filter}" is not in the §12a table`); }
    else if (field) {
      if (spec.fields && !(field in spec.fields)) add("ERROR", "0S.7", `expression ${id} reads field "${field}" the task did not give`);
      const p = parentOf.get(id);
      const pe = p?.kind === "expr" ? E[p.id] : undefined;
      if (pe?.type === "ExprOp" && !["Eq", "NotEq"].includes(pe.opType))
        add("ERROR", "0S.7", `expression ${id} field "${field}" used as an operand without hop 2 (VALUE)`);
      if (p?.kind === "block" && B[p.id]?.type === "BlockAssign" && p.slot === "leftExprId")
        add("ERROR", "0S.7", `expression ${id} assigns to the field reference — write through its VALUE act`);
    } else if (!KNOWN_ACTS.has(a)) add("ERROR", "0S.8", `expression ${id} actId "${a}" is in neither 0S.8 nor §12a`);
    if (field && E[e.leftExprId]?.type === "ExprValue" && E[e.leftExprId].exprValueType === "CONST")
      add("ERROR", "0S.7", `expression ${id} reads a field of a constant`);
  }
  if (e.type === "ExprCall") {
    const want = spec.callees?.[e.funcName];
    if (spec.callees && !want) add("ERROR", "0S.6", `call ${id} to "${e.funcName}" — not a method the task gave`);
    if (want) for (const k of Object.keys(e.args ?? {})) if (!want.includes(k)) add("ERROR", "0S.6", `call ${id} args key "${k}" is not a parameter id of ${e.funcName}`);
    if (want && Object.keys(e.args ?? {}).length !== want.length) add("ERROR", "0S.6", `call ${id} passes ${Object.keys(e.args ?? {}).length} of ${want.length} arguments`);
  }
  if (e.type === "ExprOp" && ["Eq", "NotEq"].includes(e.opType)) {
    const ops = [e.leftExprId, e.rightExprId, ...Object.values<any>(e.more ?? {}).map((m) => m.exprId)];
    const t = ops.map((x) => typeOf(x));
    if (t.includes("Number")) add("ERROR", "0S.9/1", `expression ${id} ${e.opType} on numbers (scale-sensitive)`);
    if (t.includes("Bool")) add("ERROR", "0S.9/2", `expression ${id} ${e.opType} on a boolean`);
  }
  if (e.type === "ExprOp" && ["Less", "More", "LessEq", "MoreEq"].includes(e.opType)) {
    const l = E[e.leftExprId];
    if (l?.type === "ExprOp" && ["Less", "More", "LessEq", "MoreEq"].includes(l.opType)) add("ERROR", "0S.9/5", `expression ${id} chained comparison`);
  }
}

// ---- 0S.9 rule 4: a text parameter must not be taken bare into a variable
for (const [id, b] of Object.entries(B)) {
  for (const k of ["valueExprId", "rightExprId"]) {
    const e = E[b[k]];
    if (e?.exprValueType === "VAR_REF" && params[e.varBlockId] === "Text")
      add("ERROR", "0S.9/4", `block ${id} takes text parameter ${e.varBlockId} bare — write '' ⊕ параметр`);
  }
}

// ---- 0S.9 rule 4, BO half: a body reading a Bo parameter's fields does not go through the clipboard (0S.12 item 7b)
if (!hat && kind === "method") for (const [id, e] of Object.entries(E)) {
  const l = E[e.leftExprId];
  if (e.type === "ExprAct" && /-K-DYN-S-boi_fields$/.test(e.actId) && l?.exprValueType === "VAR_REF" && params[l.varBlockId] === "Bo") {
    add("ERROR", "0S.9/4", `expression ${id} reads a field of Bo parameter ${l.varBlockId} in a clipboard body — deliver by 7b (with the hat) or an archive`);
    break;
  }
}
// ---- 0S.7: clearing a field has no confirmed form
for (const [id, e] of Object.entries(E))
  if (e.exprValueType === "CONST" && ["Date", "BigDecimal", "SingleSelectRefCode"].includes(e.constType) && !("value" in e) && !e.optionId)
    add("ERROR", "0S.7", `expression ${id} an empty ${e.constType} constant — clearing a field has no confirmed form`);

// ---- 0S.9 rule 8: substring without a guard is only a WARN (can't prove the guard)
const subs = Object.values<any>(E).filter((e) => e.actId === "F-substring-K-FIX-T-String").length;
if (subs) {
  const guarded = Object.values<any>(B).some((b) => b.type === "BlockIf");
  if (!guarded) add("WARN", "0S.9/8", `${subs} #Подстрока without any ЕСЛИ — start >= end returns the whole string`);
}

// ---- 0S.2a house style
const nameOk = (n: string, type: string): string | null => {
  if (/^[ijk]$/.test(n)) return null;
  const m = n.match(/^([#~%\[<|])(.*)([#~%\]>|])$/);
  if (!m) return "no decoration";
  const pair: Record<string, string> = { "#": "#", "~": "~", "%": "%", "[": "]", "<": ">", "|": "|" };
  if (pair[m[1]] !== m[3]) return "unbalanced decoration";
  if (m[1] === "#" && m[2] !== m[2].toLowerCase()) return "#…# must be all lower case";
  if (m[1] === "#" && !/[а-яё]/i.test(m[2])) return "names are in Russian";
  if (m[1] === "#" && type === "Bool" && !m[2].endsWith("?")) return "a boolean ends in ?";
  return null;
};
for (const [id, d] of decl) {
  const why = nameOk(d.name, d.type);
  if (why) add("WARN", "0S.2a", `"${d.name}" (block ${id}): ${why}`);
}
for (const [pid] of Object.entries(params)) void pid;
// header first: on every chain, no BlockNewVar after the first non-NewVar statement (loop elements excluded)
const chainHeads = [root, ...Object.values<any>(B).flatMap((b) => [b.thenBlockId, b.bodyBlockId,
  ...Object.values<any>(b.branches ?? {}).map((x) => x.blockId)])].filter(Boolean);
for (const h of chainHeads) {
  let cur = B[h]?.type === "BlockFixMethod" || B[h]?.type === "BlockFixEntryPoint" ? B[h].downBlockId : h;
  let logic = false;
  while (cur && B[cur]) {
    const b = B[cur];
    if (b.type === "BlockNewVar" && logic) { add("WARN", "0S.2a", `"${b.varName}" declared after logic (block ${cur}) — header first`); }
    if (b.type !== "BlockNewVar") logic = true;
    cur = b.downBlockId;
  }
}

finish();

function finish(): never {
  const counts = { FATAL: 0, ERROR: 0, WARN: 0 } as Record<Sev, number>;
  for (const f of findings) counts[f.sev]++;
  const stats = s ? { blocks: Object.keys(s.blocks ?? {}).length, expressions: Object.keys(s.expressions ?? {}).length } : {};
  if (asJson) console.log(JSON.stringify({ file, counts, stats, findings }, null, 1));
  else {
    for (const f of findings) console.log(`${f.sev.padEnd(5)} [${f.rule}] ${f.msg}`);
    console.log(`${file}: ${counts.FATAL} FATAL / ${counts.ERROR} ERROR / ${counts.WARN} WARN — ${JSON.stringify(stats)}`);
  }
  process.exit(counts.FATAL || counts.ERROR ? 1 : 0);
}
