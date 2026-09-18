# -*- coding: utf-8 -*-
"""Build the §0S worked example by following ONLY what §0S tells a model to type.
   No import of the Scoring generator: every literal here is typed out of the cookbook."""
import json, random, sys

ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@~"
used = set()
DET = __import__("os").environ.get("DET")
_n = [0]
def nid():
    if DET:
        _n[0] += 1
        i = ("id%04d" % _n[0]).ljust(16, "0")
        used.add(i); return i
    while True:
        i = "".join(random.choice(ALPHABET) for _ in range(16))
        if i not in used:
            used.add(i); return i

B, E = {}, {}
def blk(d): i = nid(); B[i] = d; return i
def exp(d): i = nid(); E[i] = d; return i

# --- expression constructors (§0S.6)
def s_const(v):  return exp({"exprValueType":"CONST","valueType":{"baseType":"String","type":"Text"},
                             "constType":"String","value":v,"type":"ExprValue"})
def n_const(v):  return exp({"exprValueType":"CONST","valueType":{"baseType":"BigDecimal","type":"Number"},
                             "constType":"BigDecimal","value":v,"type":"ExprValue"})
def var(b):      return exp({"exprValueType":"VAR_REF","varBlockId":b,"type":"ExprValue"})
def op(t,l,r,*more):
    d = {"opType":t,"leftExprId":l,"rightExprId":r,"type":"ExprOp"}
    if more:
        d["more"] = {nid(): {"opType":t,"order":10*(k+1),"exprId":e} for k,e in enumerate(more)}
    return exp(d)
def act(left,actId,args=None):
    d = {"leftExprId":left,"actId":actId,"type":"ExprAct"}
    if args: d["argExprIds"] = args
    return exp(d)
def field(obj,code): return act(obj, "F-%s-K-DYN-S-boi_fields" % code)
def value(ref):      return act(ref, "F-VALUE-K-DYN-R-D-S-boi_fields")

# --- the method hat: ids COME FROM THE USER'S COPY, they are never invented (§0S.2 step 2)
P_STEP    = "KJC71su~DqnMxD7z"
P_FORMULA = "0du0wJobopgISW6H"
used.update({P_STEP, P_FORMULA})

# 1  Пусть #текст# = '' ⊕ formula
v_text = blk({"varName":"#текст#","valueExprId":op("Concat", s_const(""), var(P_FORMULA)),
              "type":"BlockNewVar"})
# 2  Пусть #код# = step.Код.#Значение
v_code = blk({"varName":"#код#","valueExprId":value(field(var(P_STEP),"code")),"type":"BlockNewVar"})
# 3  Пусть #ответ# = ''
v_ans  = blk({"varName":"#ответ#","valueExprId":s_const(""),"type":"BlockNewVar"})

# 4  ЕСЛИ #текст#.#Пусто?# … ИНАЧЕ ЕСЛИ #текст#.#Регулярка?#('^[0-9]+$') … ИНАЧЕ …
a_empty = blk({"leftExprId":var(v_ans),"rightExprId":s_const("пусто"),"type":"BlockAssign"})
a_num   = blk({"leftExprId":var(v_ans),"rightExprId":s_const("число"),"type":"BlockAssign"})
a_form  = blk({"leftExprId":var(v_ans),"rightExprId":s_const("формула"),"type":"BlockAssign"})
b_if = blk({"ifExprId": act(var(v_text),"F-isEmpty-K-FIX-T-String"),
            "thenBlockId": a_empty,
            "branches": {
                nid(): {"blockId": a_num, "order": 10,
                        "exprId": act(var(v_text),"F-doesItMatchARegularExpression-K-FIX-T-String",
                                      {"regExp": s_const("^[0-9]+$")}),
                        "hasExpr": True},
                nid(): {"blockId": a_form, "order": 20}},
            "type":"BlockIf"})

# 5  Пусть #i# = 0
v_i = blk({"varName":"#i#","valueExprId":n_const("0"),"type":"BlockNewVar"})
# 6  ЦИКЛ #шаг# : "3" { #i# = #i# + 1 ; ЕСЛИ #i# > 2 : ВЫЙТИ ИЗ ЦИКЛА }
loop = nid(); used.add(loop)
brk  = blk({"exitType":"FROM_CIRCLE","circleBlockId":loop,"type":"BlockExit"})
guard= blk({"ifExprId": op("More", var(v_i), n_const("2")), "thenBlockId": brk, "type":"BlockIf"})
inc  = blk({"leftExprId":var(v_i),"rightExprId":op("Plus",var(v_i),n_const("1")),
            "downBlockId":guard,"type":"BlockAssign"})
B[loop] = {"elementVarName":"#шаг#","srcExprId":n_const("3"),"bodyBlockId":inc,"type":"BlockForeach"}

# 7  ВЕРНУТЬ #код# ⊕ ':' ⊕ #ответ#
ret = blk({"exitType":"FROM_METHOD",
           "returnExprId": op("Concat", var(v_code), s_const(":"), var(v_ans)),
           "type":"BlockExit"})

# chain the statements (§0S.5)
chain = [v_text, v_code, v_ans, b_if, v_i, loop, ret]
for a, b in zip(chain, chain[1:]): B[a]["downBlockId"] = b

hat = blk({"x":55,"y":44,"methodName":"describe",
           "params":{P_STEP:{"name":"step","order":1,
                             "type":{"baseType":"BoiRefCode","boCode":"Model_step","isArray":False,"type":"Bo"}},
                     P_FORMULA:{"name":"formula","order":2,
                             "type":{"baseType":"String","isArray":False,"type":"Text"}}},
           "returnType":{"baseType":"String","isArray":False,"type":"Text"},
           "downBlockId": chain[0], "type":"BlockFixMethod"})

doc = {"copiedType":"SCRIPT_BLOCKS","mouseX":202,"mouseY":62,
       "startBlockIds":[hat],"blocks":B,"expressions":E}
out = sys.argv[1] if len(sys.argv) > 1 else "cookbook_demo.json"
json.dump(doc, open(out,"w",encoding="utf-8"), ensure_ascii=False, indent=1)
body = json.loads(json.dumps(doc))
body["startBlockIds"] = [chain[0]]; body["blocks"][chain[0]].update({"x":55,"y":44}); body["blocks"].pop(hat)
json.dump(body, open(out.replace(".json","_body.json"),"w",encoding="utf-8"), ensure_ascii=False, indent=1)
print("blocks", len(B), "expressions", len(E))
