/**
 * Build the §0S worked example by following ONLY what §0S tells a model to type.
 * No import of the Scoring generator: every literal here is typed out of the cookbook.
 *
 *   bun tools/follow-cookbook-script.bun.ts [out.json]     # also writes out_body.json (the body without the hat)
 *   DET=1 bun tools/follow-cookbook-script.bun.ts …        # ids id0001… instead of random ones, for diffs
 */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@~";
const used = new Set<string>();
const DET = Bun.env.DET;
let n = 0;
function nid(): string {
  if (DET) {
    const i = `id${String(++n).padStart(4, "0")}`.padEnd(16, "0");
    used.add(i);
    return i;
  }
  while (true) {
    let i = "";
    for (let k = 0; k < 16; k++) i += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    if (!used.has(i)) { used.add(i); return i; }
  }
}

const B: Record<string, any> = {}, E: Record<string, any> = {};
const blk = (d: any) => { const i = nid(); B[i] = d; return i; };
const exp = (d: any) => { const i = nid(); E[i] = d; return i; };

// --- expression constructors (§0S.6)
const sConst = (v: string) => exp({ exprValueType: "CONST", valueType: { baseType: "String", type: "Text" },
                                    constType: "String", value: v, type: "ExprValue" });
const nConst = (v: string) => exp({ exprValueType: "CONST", valueType: { baseType: "BigDecimal", type: "Number" },
                                    constType: "BigDecimal", value: v, type: "ExprValue" });
const variable = (b: string) => exp({ exprValueType: "VAR_REF", varBlockId: b, type: "ExprValue" });
function op(t: string, l: string, r: string, ...more: string[]) {
  const d: any = { opType: t, leftExprId: l, rightExprId: r, type: "ExprOp" };
  if (more.length) d.more = Object.fromEntries(more.map((e, k) => [nid(), { opType: t, order: 10 * (k + 1), exprId: e }]));
  return exp(d);
}
function act(left: string, actId: string, args?: Record<string, string>) {
  const d: any = { leftExprId: left, actId, type: "ExprAct" };
  if (args) d.argExprIds = args;
  return exp(d);
}
const field = (obj: string, code: string) => act(obj, `F-${code}-K-DYN-S-boi_fields`);
const value = (ref: string) => act(ref, "F-VALUE-K-DYN-R-D-S-boi_fields");

// --- the method hat: ids COME FROM THE USER'S COPY, they are never invented (§0S.2 step 2)
const P_STEP = "KJC71su~DqnMxD7z";
const P_FORMULA = "0du0wJobopgISW6H";
used.add(P_STEP).add(P_FORMULA);

// 1  Пусть #текст# = '' ⊕ formula
const vText = blk({ varName: "#текст#", valueExprId: op("Concat", sConst(""), variable(P_FORMULA)), type: "BlockNewVar" });
// 2  Пусть #код# = step.code.#Значение
const vCode = blk({ varName: "#код#", valueExprId: value(field(variable(P_STEP), "code")), type: "BlockNewVar" });
// 3  Пусть #ответ# = ''
const vAns = blk({ varName: "#ответ#", valueExprId: sConst(""), type: "BlockNewVar" });

// 4  ЕСЛИ #текст#.#Пусто?# … ИНАЧЕ ЕСЛИ #текст#.#Регулярка?#('^[0-9]+$') … ИНАЧЕ …
const aEmpty = blk({ leftExprId: variable(vAns), rightExprId: sConst("пусто"), type: "BlockAssign" });
const aNum = blk({ leftExprId: variable(vAns), rightExprId: sConst("число"), type: "BlockAssign" });
const aForm = blk({ leftExprId: variable(vAns), rightExprId: sConst("формула"), type: "BlockAssign" });
const bIf = blk({
  ifExprId: act(variable(vText), "F-isEmpty-K-FIX-T-String"),
  thenBlockId: aEmpty,
  branches: {
    [nid()]: { blockId: aNum, order: 10,
               exprId: act(variable(vText), "F-doesItMatchARegularExpression-K-FIX-T-String",
                           { regExp: sConst("^[0-9]+$") }),
               hasExpr: true },
    [nid()]: { blockId: aForm, order: 20 } },
  type: "BlockIf",
});

// 5  Пусть #счётчик# = 0   (declared in the header — chained before the ЕСЛИ, §0S.2a)
const vI = blk({ varName: "#счётчик#", valueExprId: nConst("0"), type: "BlockNewVar" });
// 6  ЦИКЛ i : "3" { #счётчик# = #счётчик# + 1 ; ЕСЛИ #счётчик# > 2 : ВЫЙТИ ИЗ ЦИКЛА }
const loop = nid();
const brk = blk({ exitType: "FROM_CIRCLE", circleBlockId: loop, type: "BlockExit" });
const guard = blk({ ifExprId: op("More", variable(vI), nConst("2")), thenBlockId: brk, type: "BlockIf" });
const inc = blk({ leftExprId: variable(vI), rightExprId: op("Plus", variable(vI), nConst("1")),
                  downBlockId: guard, type: "BlockAssign" });
B[loop] = { elementVarName: "i", srcExprId: nConst("3"), bodyBlockId: inc, type: "BlockForeach" };

// 7  ВЕРНУТЬ #код# ⊕ ':' ⊕ #ответ#
const ret = blk({ exitType: "FROM_METHOD",
                  returnExprId: op("Concat", variable(vCode), sConst(":"), variable(vAns)),
                  type: "BlockExit" });

// chain the statements (§0S.5)
const chain = [vText, vCode, vAns, vI, bIf, loop, ret];
for (let k = 0; k + 1 < chain.length; k++) B[chain[k]].downBlockId = chain[k + 1];

const hat = blk({
  x: 55, y: 44, methodName: "describe",
  params: { [P_STEP]: { name: "step", order: 1,
                        type: { baseType: "BoiRefCode", boCode: "Model_step", isArray: false, type: "Bo" } },
            [P_FORMULA]: { name: "formula", order: 2,
                           type: { baseType: "String", isArray: false, type: "Text" } } },
  returnType: { baseType: "String", isArray: false, type: "Text" },
  downBlockId: chain[0], type: "BlockFixMethod",
});

const doc = { copiedType: "SCRIPT_BLOCKS", mouseX: 202, mouseY: 62, startBlockIds: [hat], blocks: B, expressions: E };
const out = Bun.argv[2] ?? "cookbook_demo.json";
await Bun.write(out, JSON.stringify(doc, null, 1));
const body = structuredClone(doc);
body.startBlockIds = [chain[0]];
Object.assign(body.blocks[chain[0]], { x: 55, y: 44 });
delete body.blocks[hat];
await Bun.write(out.replace(".json", "_body.json"), JSON.stringify(body, null, 1));
console.log("blocks", Object.keys(B).length, "expressions", Object.keys(E).length);
