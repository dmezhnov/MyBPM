#!/usr/bin/env python3
# Python port of `lintArchive` (MYBPM-IMPORTS.md 0.10) with the command line of lint-archive.js — for a chat
# that runs Python but no JavaScript. Same input, same output lines, same exit code as lint-archive.js.
# Run: python3 lint_archive.py <archive.mybpm.zip> [MYBPM-IMPORTS.md] [--source <the export it amends>]
#      (Python >= 3.8, standard library only; exit 1 while a defect line is left)
#
# Hand-written, NOT generated: after a change of `lintArchive` in MYBPM-IMPORTS.md 0.10 port it here line by
# line, run `mise run lint-parity` (the JS lint and this port on the same fuzzed archives, outputs must be
# equal) and then set the marker below to the hash `mise test` prints. The helpers mimic the JavaScript the
# lint is written in: object key order, truthiness, String(), JSON.stringify, ===, <, + and Math.max on
# anything a broken archive may carry, so both lints print the same bytes.
# lintArchive sha256: 80c024e60a30
import json
import math
import os
import re
import sys
import zipfile


class _Undefined:
    __slots__ = ()

    def __bool__(self):
        return False

    def __repr__(self):
        return "undefined"


U = _Undefined()  # JavaScript undefined: a missing key; None is JSON null


def nul(v):
    return v is None or v is U


def nn(a, b):  # a ?? b
    return b if nul(a) else a


def isnum(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def tr(v):  # JavaScript truthiness: [] and {} are true
    if nul(v) or v is False:
        return False
    if v is True:
        return True
    if isnum(v):
        return v == v and v != 0
    if isinstance(v, str):
        return v != ""
    return True


def js_num(x):  # Number.prototype.toString
    if isinstance(x, int):
        if abs(x) < 10 ** 21:
            return str(x)
        x = float(x)
    if x != x:
        return "NaN"
    if x in (math.inf, -math.inf):
        return "Infinity" if x > 0 else "-Infinity"
    if x == 0:
        return "0"
    sign, r = ("-" if x < 0 else ""), repr(abs(x))
    m, e = (r.split("e") + ["0"])[:2]
    ip, fp = (m.split(".") + [""])[:2]
    if fp == "0":
        fp = ""
    e = int(e)
    n = len(ip.lstrip("0")) + e if ip.lstrip("0") else e - (len(fp) - len(fp.lstrip("0")))
    digits = (ip + fp).lstrip("0").rstrip("0")
    k = len(digits)
    if k <= n <= 21:
        return sign + digits + "0" * (n - k)
    if 0 < n <= 21:
        return sign + digits[:n] + "." + digits[n:]
    if -6 < n <= 0:
        return sign + "0." + "0" * (-n) + digits
    ex = ("+" if n - 1 >= 0 else "-") + str(abs(n - 1))
    return sign + (digits if k == 1 else digits[0] + "." + digits[1:]) + "e" + ex


def s(v):  # String(v)
    if v is U:
        return "undefined"
    if v is None:
        return "null"
    if v is True:
        return "true"
    if v is False:
        return "false"
    if isnum(v):
        return js_num(v)
    if isinstance(v, str):
        return v
    if isinstance(v, list):
        return ",".join("" if nul(x) else s(x) for x in v)
    return "[object Object]"


def join(a, sep=","):  # Array.prototype.join
    return sep.join("" if nul(x) else s(x) for x in a)


def jstr(v):
    return json.dumps(v, ensure_ascii=False)


def jj(v):  # JSON.stringify; U for undefined
    if v is U:
        return U
    if v is None:
        return "null"
    if v is True:
        return "true"
    if v is False:
        return "false"
    if isnum(v):
        return js_num(v) if v == v and v not in (math.inf, -math.inf) else "null"
    if isinstance(v, str):
        return jstr(v)
    if isinstance(v, list):
        return "[" + ",".join("null" if jj(x) is U else jj(x) for x in v) + "]"
    if isinstance(v, dict):
        return "{" + ",".join(jstr(k) + ":" + jj(v[k]) for k in keys(v) if jj(v[k]) is not U) + "}"
    return U


def _idx(k):
    return isinstance(k, str) and re.fullmatch(r"0|[1-9][0-9]*", k) is not None and int(k) < 2 ** 32 - 1


def keys(o):  # Object.keys: integer-like keys first, ascending, then the rest in insertion order
    if isinstance(o, dict):
        return sorted((k for k in o if _idx(k)), key=int) + [k for k in o if not _idx(k)]
    if isinstance(o, (list, str)):
        return [str(i) for i in range(len(o))]
    return []


def ents(o):  # Object.entries(o ?? {})
    return [(k, g(o, k)) for k in keys(o)]


def vals(o):  # Object.values(o ?? {})
    return [g(o, k) for k in keys(o)]


def g(o, *ks):  # o?.k1?.k2 …
    for k in ks:
        if not isinstance(k, str):
            k = s(k)
        if isinstance(o, dict):
            o = o.get(k, U)
        elif isinstance(o, (list, str)):
            o = len(o) if k == "length" else o[int(k)] if _idx(k) and int(k) < len(o) else U
        else:
            return U
    return o


def has(o, k):  # k in o
    if isinstance(o, dict):
        return k in o
    if isinstance(o, list):
        return k == "length" or (_idx(k) and int(k) < len(o))
    return False


def it(v):  # what for…of walks
    return v if isinstance(v, list) else list(v) if isinstance(v, str) else []


def find(a, f):  # Array.prototype.find
    for x in a:
        if f(x):
            return x
    return U


def seq(a, b):  # ===
    if isinstance(a, bool) or isinstance(b, bool):
        return a is b
    if isnum(a) or isnum(b):
        return isnum(a) and isnum(b) and a == b
    if isinstance(a, (dict, list)) or isinstance(b, (dict, list)):
        return a is b
    return a == b


def jk(v):  # a Map / Set key under SameValueZero
    if isinstance(v, bool):
        return ("b", v)
    if isnum(v):
        return ("n", "NaN" if v != v else float(v))
    if isinstance(v, (dict, list)):
        return ("o", id(v))
    if v is U:
        return ("u",)
    if v is None:
        return ("z",)
    return ("s", v)


def uniq(a):  # [...new Set(a)]
    seen, r = set(), []
    for x in a:
        if jk(x) not in seen:
            seen.add(jk(x))
            r.append(x)
    return r


def includes(a, v):
    return any(jk(x) == jk(v) for x in a)


_NUM = re.compile(r"[+-]?(Infinity|([0-9]+\.?[0-9]*|\.[0-9]+)([eE][+-]?[0-9]+)?)")
_WS = "\t\n\v\f\r                  　﻿"


def js_trim(x):
    return x.strip(_WS)


def num(v):  # ToNumber
    if v is U:
        return math.nan
    if v is None or v is False:
        return 0.0
    if v is True:
        return 1.0
    if isnum(v):
        return float(v)
    if isinstance(v, (list, dict)):
        return num(s(v))
    t = js_trim(v)
    if t == "":
        return 0.0
    if re.fullmatch(r"0[xX][0-9a-fA-F]+", t):
        return float(int(t[2:], 16))
    if re.fullmatch(r"0[oO][0-7]+", t):
        return float(int(t[2:], 8))
    if re.fullmatch(r"0[bB][01]+", t):
        return float(int(t[2:], 2))
    if _NUM.fullmatch(t):
        return float(t.replace("Infinity", "inf"))
    return math.nan


def _prim(v):
    return s(v) if isinstance(v, (list, dict)) else v


def _u16(x):
    return x.encode("utf-16-be", "surrogatepass")


def _rel(a, b):
    a, b = _prim(a), _prim(b)
    if isinstance(a, str) and isinstance(b, str):
        return _u16(a), _u16(b)
    x, y = num(a), num(b)
    return None if x != x or y != y else (x, y)


def lt(a, b):
    r = _rel(a, b)
    return r is not None and r[0] < r[1]


def gt(a, b):
    r = _rel(a, b)
    return r is not None and r[0] > r[1]


def le(a, b):
    r = _rel(a, b)
    return r is not None and r[0] <= r[1]


def ge(a, b):
    r = _rel(a, b)
    return r is not None and r[0] >= r[1]


def jadd(a, b):  # a + b
    a, b = _prim(a), _prim(b)
    if isinstance(a, str) or isinstance(b, str):
        return s(a) + s(b)
    return num(a) + num(b)


def jmax(*a):
    r = -math.inf
    for x in a:
        x = num(x)
        if x != x:
            return math.nan
        r = max(r, x)
    return r


def jmin(*a):
    r = math.inf
    for x in a:
        x = num(x)
        if x != x:
            return math.nan
        r = min(r, x)
    return r


def num0(v):  # +v || 0
    x = num(v)
    return 0.0 if x != x else x


def jsort(a):  # [...a].sort((x, y) => (+x || 0) - (+y || 0)): undefined last, the rest stable
    return sorted([v for v in a if v is not U], key=num0) + [v for v in a if v is U]


def jround(x):
    return x if x != x or x in (math.inf, -math.inf) else float(math.floor(x + 0.5))


def jparse(t):  # JSON.parse(String(t))
    def no(c):
        raise ValueError(c)

    return json.loads(s(t), parse_int=float, parse_constant=no)


_RX = {}


def R(p, i=False):  # a JavaScript regex: \w \d ASCII, $ only at the very end
    if (p, i) not in _RX:
        q, k, cls = [], 0, False
        while k < len(p):
            c = p[k]
            if c == "\\" and k + 1 < len(p):
                n = p[k + 1]
                q.append({"w": "A-Za-z0-9_", "d": "0-9"}[n] if cls and n in "wd" else
                         {"w": "[A-Za-z0-9_]", "d": "[0-9]"}[n] if n in "wd" else c + n)
                k += 2
                continue
            if c == "[" and not cls:
                cls = True
            elif c == "]" and cls:
                cls = False
            q.append(r"\Z" if c == "$" and not cls else c)
            k += 1
        _RX[(p, i)] = re.compile("".join(q), re.I if i else 0)
    return _RX[(p, i)]


def T(rx, v):  # rx.test(v)
    return rx.search(s(v)) is not None


def lint_archive(jsonl, doc=None, meta=U, source=U):
    """jsonl = the whole text of data-*/0000001.mybpm, doc = the whole text of MYBPM-IMPORTS.md, meta = the text
    of data-*/metadata.mybpm when you have it, source = the 0000001.mybpm text of the export this file amends"""
    out, L = [], []
    err = out.append

    def fatal(x):
        err("FATAL " + x)

    for i, l in enumerate(s(jsonl).rstrip(_WS).split("\n")):
        try:
            o = jparse(l)
        except (ValueError, RecursionError):
            fatal(f"line {i + 1}: does not parse — one minified JSON object per line, no blank line (0.9 rule 3)")
            continue
        if isinstance(o, dict):
            L.append(o)
        else:
            fatal(f"line {i + 1}: not a JSON object — no array wrapper (0.9 rule 3)")
    if out:
        return "\n".join(out)
    if not T(R(r"[^\n]\n$"), jsonl):
        err("the payload must end with exactly one newline (0.9 rule 3)")
    om = R(r"^objectCount-(\d+)(\s*)$").search(s(nn(meta, "")))
    if meta is not U and (not om or float(om.group(1)) != len(L)):
        fatal(f'metadata.mybpm is {s(jj(meta))}, must be "objectCount-{len(L)}" (0.9 rule 2)')
    elif om and om.group(2):
        err(f'metadata.mybpm ends with whitespace — "objectCount-{len(L)}" alone (0.11)')

    def cls(o):
        return s(g(o, "@class")).split(".")[-1]

    def of(c):
        return [o for o in L if cls(o) == c]

    bos = of("BoStructDto")

    def low(x):
        return js_trim(R("<[^>]*>").sub("", s(x))).lower()

    def isRef(f):
        return g(f, "type") in ("BO", "CO")

    ID, CODE, ids = R("^[A-Za-z0-9@~]{16}$"), R("^[A-Za-z0-9_]{1,30}$"), {}

    def idf(t, v):
        if not T(ID, v):
            err(f'{t}: id "{s(v)}" is not 16 of A-Za-z0-9@~ (0.7)')
        elif jk(v) in ids:
            err(f"{t}: id {s(v)} repeats {ids[jk(v)]} (0.7)")
        else:
            ids[jk(v)] = t

    W = ["signatures", "buttons", "iframes", "captcha", "currentDates", "currentUser"]
    defs, menu, gm, PV = of("ScriptDefStructDto"), of("MenuItemStructDto"), of("CompanyGlobalMethodsStructDto"), of("BoProcessVersionsStructDto")
    NAME = []

    def name(t, c, rx, want):  # 0.6a, one REMINDER at the end
        if not T(rx, c):
            NAME.append(f"{t} \"{s(c)}\" ({want})")

    OBJ, LOW = (R("^[A-Z][a-z0-9]*(_[a-z0-9]+)*$"), "Capitalised snake_case"), (R("^[a-z][a-z0-9]*(_[a-z0-9]+)*$"), "lower snake_case")
    CHK, TABS, TAB = (R("^is_[a-z0-9]+(_[a-z0-9]+)*$"), "is_*"), (R("^tabs(_[a-z0-9]+)*$"), "tabs / tabs_*"), (R("^tab_[a-z0-9]+(_[a-z0-9]+)*$"), "tab_*")
    RM, DEF_ICON, DV = R("^(STRIKETHROUGH|HIDE|DISCONNECT)$"), [], []
    for i, o in enumerate(L):
        if not T(R(r"^kz\.greetgo\.mybpm\.reg\.structure\.model\.(dto\.\w+|access\.AccessStructDto)$"), g(o, "@class")):
            fatal(f"line {i + 1}: @class {s(g(o, '@class'))} — copy it from its template (0.9 rule 4)")
    groups, order, gcodes = of("BoGroupStructDto"), set(), set()
    noBo = not bos and (menu or gm or of("CompanySettingsStructDto"))  # menu lines, global methods or company settings alone (§5d, §5e)
    BUILT = {"Person": "PERSON", "Department": "DEPARTMENT", "PersonGroup": "PERSON_GROUP"}  # a built-in BO's line sits in no group (§6 «Built-in BOs»)
    isBuilt = lambda c: isinstance(c, str) and c in BUILT
    if not noBo and not groups and (not bos or any(not isBuilt(g(x, "code")) for x in bos)):
        fatal("no BoGroupStructDto line (0.3)")
    if not noBo and not bos:
        fatal("no BoStructDto line (0.4)")
    for gr in groups:
        gc, gk = g(gr, "code"), g(gr, "kind")
        if not tr(gc):
            fatal(f"group «{s(g(gr, 'name'))}»: no code — renames a fixed stand group (0.9 rule 1)")
        elif jk(gc) in gcodes:
            err(f"group {s(gc)}: code repeats (0.3)")
        else:
            gcodes.add(jk(gc))
            name("group", gc, *OBJ)
        if not isinstance(g(gr, "name"), str) or g(gr, "name") == "":
            fatal(f"group {s(gc)}: no name (0.3)")
        if not seq(gk, "DEFAULT" if gc == "General" else "MANUAL"):
            (fatal if gc == "General" or gk == "DEFAULT" else err)(
                f"group General: kind {s(gk)} — the general group «Общее» keeps DEFAULT, MANUAL demotes it (0.3)" if gc == "General"
                else f"group {s(gc)}: kind {s(gk)}, must be MANUAL (0.9 rule 1)")
        idf(f"group {s(gc)}", g(gr, "oldId"))
        idf(f"group {s(gc)} newId", g(gr, "newId"))
    if len(gm) > 1:
        err(f"{len(gm)} CompanyGlobalMethodsStructDto lines — one; the import replaces the whole list with it (§5d «Company-global methods»)")
    for x in gm:
        sd = g(x, "scriptDefIds")
        if not isinstance(sd, list):
            fatal("CompanyGlobalMethodsStructDto: no scriptDefIds list (§5d)")
        seen = set()
        for c in sd if isinstance(sd, list) else []:
            sx = find(defs, lambda d: seq(g(d, "compositeId"), c))
            hats = [b for b in vals(g(sx, "blocks")) if T(R("BlockFixMethodStruct$"), nn(g(b, "@class"), ""))]
            n = g(hats[0] if hats else U, "methodName")
            if sx is U:
                err(f"global method {s(c)}: no ScriptDefStructDto with that compositeId (§5d)")
            elif len(hats) != 1 or not tr(n) or jk(n) in seen:
                err(f'global method {s(c)}: {len(hats)} BlockFixMethodStruct hat(s), methodName "{s(nn(n, ""))}" — one hat with a name of its own (§5d)')
            seen.add(jk(n))
    acc = of("AccessStructDto")
    for a in acc:
        for k, v in ents(g(a, "fieldAccessStructMap")):
            for t in keys(nn(g(v, "tabAccessStructMap"), {})):
                bo = find(bos, lambda b: seq(g(b, "code"), g(a, "boCode")))
                tg = g(bo, "dynamicFields", k)
                if bo is not U and not (g(tg, "type") == "TAB_GROUP" and tr(g(tg, "fieldTabs", t))):
                    err(f"rights of {s(g(a, 'boCode'))}: tab rule {k}.{t} names no tab of a TAB_GROUP of {s(g(a, 'boCode'))} (§7)")
    if acc:
        err(f"REMINDER rights lines of {join([g(a, 'boCode') for a in acc], ', ')}: name each one's case in the report — an amendment (the source archive's line, changed only where asked), a new BO (always a line; orgUnitIds only ids the user gave), a blind update (only when the user asked to change rights, and the whole set) (0.9 rule 10)")
    bare = [g(b, "code") for b in bos if g(b, "category") != "BO_COMPOSITE" and not any(seq(g(a, "boCode"), g(b, "code")) for a in acc)]
    if bare:
        err(f"REMINDER {join(bare, ', ')}: no rights line — right only for a blind update of a BO already on the stand; a new BO always carries one, the all-open line of 0.8a step 6 when the task says nothing about rights (0.9 rule 10)")
    if len(bos) > 6 and len(groups) < 2:
        err(f"{len(bos)} BOs in one group — 2–4 groups by theme (0.2 step 1)")
    NOT_DYN = R("^(BUTTON|IFRAME|CAPTCHA|SIGNATURE|CURRENT_.*|CREATED_.*|LAST_MODIFIED_.*|OPEN_COUNT|PARTICIPANTS)$")
    SYS = {"BO_DICTIONARY": [["code", "INPUT_TEXT", "0.5b"], ["label", "INPUT_TEXT_LANG", "0.5b"]], "BO_PROCESS": [["PROCESS_STATUS", "BO", "0.18"]]}
    TYPES = R("^(INPUT_(TEXT|PHONE|EMAIL|NUMBER|TEXT_LANG)|TEXTAREA(_LANG)?|TIME|FULL_DATE|YEAR_AND_MONTH|YEAR|DATE|PERIOD(_TIME)?|CHECKBOX|DROPDOWN_SINGLE|FILE_UPLOAD|CHECKLIST|RADIO_BUTTON_GROUP|QUESTIONNAIRE|BO|CO|TAB_GROUP|GEO_POINT|PROGRESS_BAR|LINK|STATIC_TEXT)$")
    BOK = ["oldId", "code", "category", "kind", "boGroupOldId", "instanceViewType", "bos", "boTabs", "printForms", "name", "recordName", "staticValue", "description", "orderIndex", "dynamicFields", "nativeFields", "dictionaryFields", "actual", "isCalendarEnabled", "isMapEnabled", "isGroupingEnabled", "isCodeReadonly", "chosenAccessRight", "isTouchEnabled", "hideAddButtonFromRegistry", "kanbanCardTemplates", "timelineTemplates", "calendarCardTemplates", *W]  # 0.4
    FK = ["code", "newId", "archetype", "kind", "boRefStruct", "label", "staticValue", "isUnique", "isRequired", "isAppendable", "isRequiredAll", "isReadonly", "isClickable", "isSelectOnly", "isSeparated", "needAddToParticipants", "needShowToCalendar", "dateOnlyFuture", "dateOnlyPast", "needTrackStatus", "tableColToShow", "isHistoryTracking", "isKindAddForSelect", "titleToShow", "questionnaireIsMultiple", "isProgressBarSticky", "hideLabel", "chosenAccessRight", "unacceptableValue", "isSystem", "isCodeReadonly", "needLoadFromInTables", "useAsKeyInMigration", "needUploadToOutTable", "needChangeParentBoByLinkedBo", "needFreezeWhenScroll", "needMarkNew", "textCase", "inMigrationTimezoneMinutes", "type", "groupingInfo", "fieldTabs", "gridPosition", "removeType", "gantTableLocations", "boFieldCodes", "linkedCoSettings", "questionnaires", "progressSteps", "params"]  # 0.5
    NT = {"CREATED_AT": "FULL_DATE", "LAST_MODIFIED_AT": "FULL_DATE", "CREATED_BY": "BO", "LAST_MODIFIED_BY": "BO", "OPEN_COUNT": "INPUT_NUMBER", "IN_MIGRATION_UPDATED_AT": "FULL_DATE"}
    WT = {"signatures": R("^SIGNATURE$"), "buttons": R("^BUTTON$"), "iframes": R("^IFRAME$"), "captcha": R("^CAPTCHA$"), "currentDates": R("^CURRENT_(DATE|DAY|MONTH|DAY_AND_MONTH|YEAR)$"), "currentUser": R("^CURRENT_USER$")}
    BUILTIN = ("Person", "Department", "PersonGroup")
    for bo in bos:
        b, cat = g(bo, "code"), g(bo, "category")
        bs, df = s(b), nn(g(bo, "dynamicFields"), {})
        fs, place = ents(df), f"{s(g(bo, 'boGroupOldId'))} {s(g(bo, 'orderIndex'))}"
        if not T(CODE, nn(b, "")):
            fatal(f"{bs}: BO code — at most 30 of A-Za-z0-9_ (0.9 rule 7)")
        else:
            name("BO", b, *OBJ)
        idf(bs, g(bo, "oldId"))
        miss = [k for k in BOK if k not in bo and not (k == "instanceViewType" and cat == "BO_PANEL") and not (k == "boGroupOldId" and isBuilt(b))]
        if miss:
            err(f"{bs}: keys missing — {', '.join(miss)}; ship every key of 0.4 (0.9 rule 6)")
        if not T(R("^BO(_DICTIONARY|_PANEL|_COMPOSITE|_PROCESS)?$"), cat):
            fatal(f"{bs}: category {s(cat)} — BO, BO_DICTIONARY, BO_PANEL, BO_COMPOSITE or BO_PROCESS (0.17)")
        if isBuilt(b) and not seq(g(bo, "kind"), BUILT[b]):
            fatal(f'{bs}: a built-in BO\'s code — its line must carry "kind": "{BUILT[b]}": without kind the import erases the BO\'s kind and breaks the company, a BO of your own with this code dies «Несоответствие типов объектов» (§6 «Built-in BOs»)')
        if isBuilt(b) and "boGroupOldId" in bo:
            err(f"{bs}: a built-in BO sits in no group — no boGroupOldId on its line (§6 «Built-in BOs»)")
        if not isinstance(g(bo, "name", "rus"), str):
            err(f'{bs}: name is not {{"rus": "…"}} (0.4)')
        for k in ["bos", "printForms", "dictionaryFields"]:
            if k in bo and not isinstance(bo[k], list):
                err(f"{bs}.{k}: must be a list [] (0.9 rule 5)")
        for k in ["name", "recordName", "staticValue", "boTabs", "dynamicFields", "nativeFields", "kanbanCardTemplates", "timelineTemplates", "calendarCardTemplates", *W]:
            if k in bo and not isinstance(bo[k], dict):
                err(f"{bs}.{k}: must be an object {{}}, not {s(jj(bo[k]))} — the stand drops the whole BO (0.9 rule 5)")
        if not isBuilt(b) and not any(seq(g(x, "oldId"), g(bo, "boGroupOldId")) for x in groups):
            fatal(f"{bs}: boGroupOldId names no group line (0.7)")
        for c, t in ents(g(bo, "kanbanCardTemplates")):
            kf = g(t, "kanbanFields")
            if not isinstance(kf, dict):
                err(f'{bs}: kanbanCardTemplates.{c} must be {{"kanbanFields": {{…}}}} — without the wrapper the import sets nothing (0.5c)')
            else:
                for k in keys(kf):
                    if not tr(g(df, k)) and not tr(g(bo, "nativeFields", k)):
                        err(f"{bs}: kanbanCardTemplates.{c} shows {k}, no field of {bs} (0.5c)")
        bt = ents(bo["boTabs"]) if isinstance(g(bo, "boTabs"), dict) else []
        for t, n in bt:
            if not T(R("^(CHAT|PEOPLE|FILES|HISTORY|PRINT_FORM|TELEGRAM|WHATSAPP)$"), t) or not isnum(n):
                err(f'{bs}: boTabs.{t} = {s(jj(n))} — {{"CHAT"|"PEOPLE"|"FILES"|"HISTORY"|"PRINT_FORM"|"TELEGRAM"|"WHATSAPP": <orderIndex>}} (§2 «BO card tabs»)')
        if len(uniq([n for _, n in bt])) < len(bt):
            err(f"{bs}: two boTabs share an orderIndex (§2 «BO card tabs»)")
        for k in ["messengerFieldCode", "whatsAppFieldCode"]:
            if not nul(g(bo, k)) and not tr(g(df, g(bo, k))):
                err(f'{bs}: {k} "{s(g(bo, k))}" is no field of {bs} (§2 «BO card tabs»)')
        mk = [k for k, f in fs if tr(g(f, "useAsKeyInMigration"))]
        if len(mk) > 1:
            err(f"{bs}: useAsKeyInMigration on {', '.join(mk)} — one per BO (§3)")
        for k, n in ents(g(bo, "nativeFields")):
            idf(f"{bs}.{k}", g(n, "newId"))
            if not seq(NT.get(k, U), g(n, "type")) or g(n, "archetype") != "NATIVE":
                err(f"{bs}.{k}: a native is one of {', '.join(NT)} with its fixed type and archetype NATIVE (0.12)")
        pfs = bo["printForms"] if isinstance(g(bo, "printForms"), list) else []
        files = [g(x, "fileId") for x in of("ExportStructFileDto")]
        for i, p in enumerate(pfs):
            idf(f"{bs}.printForms[{i}]", g(p, "newId"))
            if not tr(g(p, "printFormCode")) or not T(R("^(PDF|DOCX)$"), g(p, "fileType")) or not includes(files, g(p, "fileId")):
                err(f"{bs}.printForms[{i}]: printFormCode, fileType PDF or DOCX, an ExportStructFileDto line with its fileId (0.13)")
        if len(keys(nn(g(bo, "currentUser"), {}))) > 1:
            err(f"{bs}: {len(keys(g(bo, 'currentUser')))} CURRENT_USER widgets — one per BO (0.13)")
        for m in W:
            for k, w in ents(g(bo, m)):
                t, fc, wt = f"{bs}.{m}.{k}", keys(nn(g(w, "fieldCodes"), {})), g(w, "tabCode")
                u, ur, ty = js_trim(s(nn(g(w, "url"), ""))), nn(g(w, "fieldRefs"), {}), g(w, "type")
                name(t, k, *LOW)
                idf(t, g(w, "newId"))
                if not T(WT[m], ty):
                    err(f"{t}: type {s(ty)} does not belong in {m} (0.13)")
                if not tr(g(w, "gridPosition")):
                    err(f"{t}: no gridPosition (0.13)")
                if tr(g(w, "tabCodePath")):
                    err(f'{t}: a widget names its tab in "tabCode" — the import ignores tabCodePath (0.13)')
                if tr(g(wt, "tabGroupCode")) and not (g(df, g(wt, "tabGroupCode"), "type") == "TAB_GROUP" and tr(g(df, g(wt, "tabGroupCode"), "fieldTabs", g(wt, "tabCode")))):
                    err(f"{t}: tabCode {s(g(wt, 'tabGroupCode'))}.{s(g(wt, 'tabCode'))} names no tab of {bs} (0.13)")
                if T(R("^(BUTTON|SIGNATURE)$"), ty) and any(not tr(g(df, c)) and not (ty == "BUTTON" and tr(g(bo, "nativeFields", c))) for c in fc):
                    err(f"{t}: fieldCodes names a code no field of {bs} has (0.13)")
                if T(R("^(BUTTON|IFRAME)$"), ty) and g(w, "url") is U:
                    err(f"{t}: no url key (0.13)")
                if ty == "BUTTON" and u and not u.startswith("call/plugin/"):
                    err(f'{t}: url "{u}" does nothing — a button never navigates; empty + its field script, or call/plugin/<server plugin> (0.13)')
                if ty == "IFRAME" and T(R("^http:", True), u):
                    err(f"{t}: an http: url is dropped — https: (0.13)")
                if ty == "SIGNATURE" and (any(g(df, c, "type") != "BO" for c in keys(nn(g(w, "massFieldCodes"), {})))
                                          or (not nul(g(w, "signingPhoneCode")) and g(df, g(w, "signingPhoneCode"), "type") != "INPUT_PHONE")
                                          or any(not any(seq(g(p, "printFormCode"), c) for p in pfs) for c in keys(nn(g(w, "printFormCodes"), {})))):
                    err(f"{t}: massFieldCodes are BO fields of {bs}, signingPhoneCode an INPUT_PHONE of {bs}, printFormCodes its printForms[].printFormCode (0.13)")
                if m == "currentDates" and not seq(g(w, "widgetType"), ty):
                    err(f"{t}: widgetType {s(g(w, 'widgetType'))} must repeat type {s(ty)} (0.13)")
                if ty == "CURRENT_USER" and ((g(w, "viewType") is not U and not T(R("^(TABLE|SINGLE)$"), g(w, "viewType"))) or not isinstance(ur, dict)
                                             or any(not isinstance(g(r, "toShow"), bool) for r in vals(ur)) or (vals(ur) and not any(tr(g(r, "toShow")) for r in vals(ur)))):
                    err(f'{t}: CURRENT_USER — viewType TABLE or SINGLE, fieldRefs {{}} or {{<Person field code>: {{"toShow": true|false, …}}}} with one shown (0.13)')
        if cat == "BO_DICTIONARY" and (join(keys(df)[:2]) != "code,label" or g(df, "code", "isUnique") is not True):
            err(f"{bs}: a dictionary starts with code, label, and code is isUnique (0.5b)")
        if cat == "BO_PANEL":
            for k, f in fs:
                rfr = g(f, "readFromRegistry")
                if (g(f, "type") != "BO" or not any(seq(rfr, x) for x in (U, None, True, False))
                        or ((g(f, "isReadonly") is True) if rfr is False else (g(f, "isReadonly") is not True))
                        or not any(g(r, "toShow") is True for r in vals(g(f, "boRefStruct", "fieldRefs"))) or g(f, "isKindAddForSelect") is not True):
                    err(f"{bs}.{k}: a panel widget — type BO, isKindAddForSelect true, a fieldRefs entry with toShow true, isReadonly true (false with readFromRegistry false) (§5a)")
        if cat == "BO_COMPOSITE" and (not isinstance(g(bo, "bos"), list) or not bo["bos"] or any(not tr(g(x, "code")) for x in bo["bos"])):
            err(f'{bs}: a composite lists its source BOs in bos: [{{"code", "name", "boCategory"}}] (§5b)')
        if cat == "BO_PROCESS" and not any(seq(g(p, "oldId"), g(bo, "oldId")) for p in PV):
            fatal(f"{bs}: no BoProcessVersionsStructDto line with its oldId (0.18)")
        if not isnum(g(bo, "orderIndex")) or place in order:
            err(f"{bs}: orderIndex {s(g(bo, 'orderIndex'))} — one number per BO in its group (0.9 rule 17)")
        order.add(place)
        want = '["CODE","LABEL"]' if cat == "BO_DICTIONARY" else "[]"
        if jj(g(bo, "dictionaryFields")) != want:
            err(f"{bs}: dictionaryFields must be {want} (0.5b)")
        for c, ty, sec in SYS.get(cat, []) if isinstance(cat, str) else []:
            if not (seq(g(df, c, "type"), ty) and tr(g(df, c, "isSystem")) and tr(g(df, c, "isRequired"))):
                err(f"{bs}: {c} missing or not {ty} + isSystem + isRequired ({sec}, 0.9 rule 18)")
        if cat != "BO_COMPOSITE" and not any(g(f, "tableColToShow") is True for f in [*vals(df), *vals(g(bo, "nativeFields"))]):
            err(f"{bs}: no field has tableColToShow: true (0.9 rule 15)")
        for m in ["nativeFields", *W]:
            for k, w in ents(g(bo, m)):
                if not seq(k, nn(g(w, "code"), g(w, "nativeFieldId"))):
                    err(f"{bs}.{k}: {m} key differs from its code (0.9 rule 5)")
        labels = set(low(g(f, "label", "rus")) for _, f in fs if g(f, "type") != "STATIC_TEXT")
        tci = [v for v in (g(f, "tableColOrderIndex") for _, f in fs if not tr(g(f, "trackedFieldCode")) and not (cat == "BO_PROCESS" and g(f, "type") == "BO")) if isnum(v)]
        if cat != "BO_COMPOSITE" and any(v != i for i, v in enumerate(sorted(tci))):
            err(f"{bs}: tableColOrderIndex [{join(tci, ', ')}] — the counter 0, 1, 2 … one per field (0.5)")
        if any(tr(g(f, "fieldTabs", "tab_system")) for _, f in fs) and not any(seq(g(o, "boCode"), b) for o in acc):
            err(f"{bs}: tab_system without its AccessStructDto line (0.8a step 6)")
        lack, seenLab = {}, set()  # fields by the set of template keys they lack, labels seen
        for k, f in fs:
            t, ty, op, bi = f"{bs}.{k}", g(f, "type"), g(f, "fieldOptionsStruct", "options"), g(f, "boRefStruct", "boInfo")
            if not seq(k, g(f, "code")):
                fatal(f'{t}: key differs from code "{s(g(f, "code"))}" (0.9 rule 5)')
            if not T(CODE, k):
                fatal(f"{t}: field code — at most 30 of A-Za-z0-9_ (0.9 rule 7)")
            idf(t, g(f, "newId"))
            if T(NOT_DYN, ty):
                fatal(f"{t}: {s(ty)} is a widget or system field — its own map (0.9 rule 13)")
            elif not T(TYPES, ty):
                fatal(f"{t}: type {s(ty)} is not a field type (§3 «Field types»)")
            skip = ("gridPosition", "removeType") if cat == "BO_COMPOSITE" else ("removeType", "inMigrationTimezoneMinutes") if cat == "BO_PROCESS" and k == "PROCESS_STATUS" else ()
            ms = ", ".join(x for x in FK if not has(f, x) and x not in skip)
            if ms:
                lack.setdefault(ms, []).append(k)
            if has(f, "oldId") and not has(f, "newId"):
                err(f"{t}: a field carries oldId — fields take newId (0.7)")
            if tr(g(f, "isRequired")) and tr(g(f, "isReadonly")):
                err(f"{t}: isRequired + isReadonly — never saves (0.9 rule 9)")
            if ty == "STATIC_TEXT" and tr(g(f, "tableColToShow")):
                err(f"{t}: STATIC_TEXT as a registry column (0.8a step 2)")
            if ty == "STATIC_TEXT" and low(g(f, "staticValue", "rus")) in labels:
                err(f"{t}: heading repeats a field label (0.9 rule 12)")
            if ty == "STATIC_TEXT" and T(R(r"^\s*<(h\d|b|strong)>", True), nn(g(f, "staticValue", "rus"), "")):
                err(f"{t}: a bare <h3>/<b> heading renders as a small bold label — the styled <div> of 0.5")
            if op is not U and not tr(g(f, "trackedFieldCode")) and (isinstance(op, list) or any(not seq(g(o, "fieldOption", "code"), c) or not isinstance(g(o, "fieldOption", "label"), str) for c, o in ents(op))):
                err(f'{t}: options — {{<code>: {{"fieldOption": {{"code", "label": "<string>"…}}, "newOptionId"}}}} (0.5)')
            elif not tr(g(f, "trackedFieldCode")):
                for c, o in ents(op):
                    idf(f"{t}.{c}", g(o, "newOptionId"))
                    name(f"{t} option", c, *LOW)
            if ty == "QUESTIONNAIRE":
                qs = vals(g(f, "questionnaires"))
                if any(not any(seq(g(q, "questionnaireDto", "isColumn"), col) for q in qs)
                       or any(seq(g(q, "questionnaireDto", "isColumn"), col) and not tr(U if nul(g(q, "questionnaireDto", "label")) else js_trim(s(g(q, "questionnaireDto", "label")))) for q in qs)
                       for col in (True, False)):
                    err(f"{t}: a questionnaire needs ≥1 row and ≥1 column, each with a label — an empty one blocks the constructor save (0.5)")
            if ty == "DROPDOWN_SINGLE" and g(f, "fieldOptionsStruct", "optionSource") == "FROM_FIELD" and not ents(op):
                err(f"{t}: a local list with no options (0.5)")
            if ty == "DROPDOWN_SINGLE" and not tr(g(bo, "kanbanCardTemplates", k, "kanbanFields")):
                err(f"{t}: no kanbanCardTemplates.{k}.kanbanFields (0.9 rule 16)")
            for c, tb in ents(g(f, "fieldTabs")):
                idf(f"{t}.{c}", g(tb, "newId"))
            if ty == "TAB_GROUP" and tr(g(f, "gridPosition")):
                tall = jmax(0, *[jadd(g(x, "gridPosition", "y"), g(x, "gridPosition", "rows")) for _, x in fs if seq(g(x, "tabCodePath", "tabGroupCode"), k) and tr(g(x, "gridPosition"))])
                need = jadd(tall, 2 if tr(g(f, "tabCodePath", "tabCode")) else 6 if g(bo, "instanceViewType") == "TAB" else 3)
                if tr(tall) and not seq(g(f, "gridPosition", "rows"), need):
                    err(f"{t}: rows {s(g(f, 'gridPosition', 'rows'))}, tallest tab {s(tall)} + {s(num(need) - num(tall))} = {s(need)} (0.8a step 5)")
            for c in [c for c in keys(nn(g(f, "fieldTabs"), {})) if c != "tab_system"]:
                n = len([1 for _, x in fs if seq(g(x, "tabCodePath", "tabCode"), c) and g(x, "type") != "STATIC_TEXT"])
                if n < 2:
                    err(f"{t}.{c}: a tab with {n} field(s) — at least 2, else a heading (0.8a step 3)")
            if ty == "DROPDOWN_SINGLE" and tr(g(f, "tabCodePath", "tabCode")) and (k == "status" or low(g(f, "label", "rus")) == "статус"):
                err(f"{t}: the status inside tab {s(g(f, 'tabCodePath', 'tabCode'))} — the header row beside the title field, seen on every tab (0.8a step 3)")
            if ty == "FILE_UPLOAD" and T(R("фото|снимк|снимок|photo", True), f"{k} {s(g(f, 'label', 'rus'))}") and g(f, "params", "viewType") != "TILE":
                err(f"{t}: a photo field without params.viewType TILE shows no pictures (0.19)")
            if cat == "BO_DICTIONARY" and k in ("code", "label") and tr(g(f, "gridPosition")) and (not seq(g(f, "gridPosition", "x"), 0) or not seq(g(f, "gridPosition", "cols"), 15)):
                err(f"{t}: a dictionary's Код / Значение — x 0, cols 15 each, one width (0.5b, 0.8)")
            for p, v in ents(g(f, "params")):
                if not isinstance(v, str):
                    err(f"{t}: params.{p} = {s(jj(v))} — every params value is a string (§3)")
            if tr(g(f, "textCase")) and g(f, "textCase") != "NONE" and ty != "INPUT_TEXT":
                err(f"{t}: textCase on a {s(ty)} — INPUT_TEXT only (§3)")
            if tr(g(f, "maxLength")) and (not T(R("^(INPUT_TEXT(_LANG)?|INPUT_NUMBER|TEXTAREA(_LANG)?)$"), ty) or (ty == "INPUT_NUMBER" and gt(g(f, "maxLength"), 21))):
                err(f"{t}: maxLength {s(g(f, 'maxLength'))} on a {s(ty)} — text and number types only, a number at most 21 (§3)")
            if tr(g(f, "useAsKeyInMigration")) and not T(R("^INPUT_(TEXT|EMAIL|PHONE)$"), ty):
                err(f"{t}: useAsKeyInMigration on a {s(ty)} — INPUT_TEXT, INPUT_EMAIL, INPUT_PHONE only (§3)")
            try:
                btn = jparse(g(f, "params", "buttonTypes"))
            except (ValueError, RecursionError):
                btn = None
            if g(f, "params", "buttonTypes") is not U and (not T(R("^TEXTAREA"), ty) or not isinstance(btn, list) or any(not T(R("^(style|bold|underline|italic|fontsize|color|ul|ol|paragraph|table|link|picture|video|hr|codeview|height)$"), x) for x in btn)):
                err(f"{t}: params.buttonTypes — only on TEXTAREA / TEXTAREA_LANG, the JSON text of a list of style bold underline italic fontsize color ul ol paragraph table link picture video hr codeview height (§3)")
            if ty == "CHECKLIST" and g(f, "isSelectOnly") is True and g(f, "isAppendable") is True:
                err(f"{t}: isSelectOnly and isAppendable — one of the two (§3)")
            if ty == "TAB_GROUP" and g(f, "params", "needDisableTabs") == "true" and len(keys(nn(g(f, "fieldTabs"), {}))) > 1:
                err(f"{t}: needDisableTabs hides the strip of {len(keys(g(f, 'fieldTabs')))} tabs — only with one tab (§3)")
            if g(f, "isProgressBarSticky") is True and ty != "PROGRESS_BAR":
                err(f"{t}: isProgressBarSticky on a {s(ty)} — PROGRESS_BAR only; needFreezeWhenScroll for the rest (§3)")
            tw, lb = ty == "TAB_GROUP" and tr(g(f, "trackedFieldCode")), g(f, "label", "rus")
            if (not tw and not (ty == "TAB_GROUP" and tr(g(f, "label")) and not keys(g(f, "label")))) if not isinstance(lb, str) else lb != lb.lstrip(_WS):
                err(f'{t}: label must be {{"rus": "<text>"}} with no leading space (0.5)')
            if isinstance(lb, str) and jk(lb) in seenLab:
                err(f"{t}: label «{lb}» repeats inside {bs} (0.5)")
            seenLab.add(jk(lb))
            if not (cat == "BO_DICTIONARY" and k in ("code", "label")) and k != "PROCESS_STATUS" and not tw:
                name(t, k, *(CHK if ty == "CHECKBOX" else TABS if ty == "TAB_GROUP" else LOW))
            for c, q in ents(g(f, "questionnaires")):
                name(f"{t} questionnaire", nn(g(q, "questionnaireDto", "code"), c), *LOW)
            for x in vals(g(f, "progressSteps")):
                if tr(g(x, "code")):
                    name(f"{t} step", g(x, "code"), *LOW)
            if ty == "TAB_GROUP" and not tw:
                for c in keys(nn(g(f, "fieldTabs"), {})):
                    if c != "tab_system":
                        name(f"{t} tab", c, *TAB)
            fo = g(f, "fieldOptionsStruct")
            di = g(fo, "dictionaryBoInfo")
            if ty in ("DROPDOWN_SINGLE", "RADIO_BUTTON_GROUP"):
                if not tr(fo):
                    err(f"{t}: {s(ty)} without fieldOptionsStruct (0.5)")
                elif g(fo, "optionSource") == "FROM_BO":
                    if ty == "RADIO_BUTTON_GROUP":
                        err(f"{t}: a RADIO_BUTTON_GROUP takes no dictionary — the import drops it; DROPDOWN_SINGLE, or a local list (§3)")
                    if not tr(g(di, "code")) or (tr(g(di, "boCategory")) and g(di, "boCategory") != "BO_DICTIONARY") or tr(g(di, "oldRefBoId")) or tr(g(di, "id")):
                        err(f'{t}: dictionaryBoInfo — {{"code": "<dictionary code>", "boCategory": "BO_DICTIONARY"}}, by code, no id (0.5)')
                elif g(fo, "optionSource") != "FROM_FIELD":
                    err(f"{t}: optionSource {s(g(fo, 'optionSource'))} — FROM_FIELD or FROM_BO (0.5)")
                elif tr(g(f, "trackedFieldCode")):
                    if join(sorted(keys(nn(op, {})), key=_u16)) != "CANCELED,DONE,OVERDUE,PLANNED":
                        err(f"{t}: a tracked status list holds exactly PLANNED, OVERDUE, DONE, CANCELED (§3)")
                elif not nul(g(f, "defaultValue")) and g(f, "defaultValue") != "" and not any(seq(g(o, "newOptionId"), g(f, "defaultValue")) for o in vals(op)):
                    DV.append(t)
            if g(f, "isHistoryTracking") is True and (ty == "TAB_GROUP" or nul(g(bo, "boTabs", "HISTORY"))):
                err(f"{t}: isHistoryTracking {'on a TAB_GROUP' if ty == 'TAB_GROUP' else 'without boTabs.HISTORY — never logged'} (§3)")
            if g(f, "titleToShow") is True and (ty == "TAB_GROUP" or not isnum(g(f, "titleOrderIndex")) or any(x is not f and g(x, "titleToShow") is True and seq(g(x, "titleOrderIndex"), g(f, "titleOrderIndex")) for x in [*vals(df), *vals(g(bo, "nativeFields"))])):
                err(f"{t}: titleToShow needs a titleOrderIndex of its own, never on a TAB_GROUP (§3)")
            if g(f, "needTrackStatus") is True:
                w = find(vals(df), lambda x: g(x, "type") == "TAB_GROUP" and seq(g(x, "trackedFieldCode"), k))
                st = find(vals(df), lambda x: g(x, "type") == "DROPDOWN_SINGLE" and seq(g(x, "trackedFieldCode"), k))
                if not tr(w) or not tr(st) or not seq(g(f, "tabCodePath", "tabGroupCode"), g(w, "code")) or not seq(g(st, "tabCodePath", "tabGroupCode"), g(w, "code")):
                    err(f"{t}: needTrackStatus — its TAB_GROUP wrapper and «Статус» dropdown (trackedFieldCode {k}), the date and the status inside the wrapper (§3)")
            if ty == "STATIC_TEXT" and not tr(g(f, "staticValue", "rus")):
                err(f"{t}: STATIC_TEXT without staticValue.rus (0.5)")
            if (ty == "PROGRESS_BAR" and not keys(nn(g(f, "progressSteps"), {}))) or (ty == "TAB_GROUP" and not keys(nn(g(f, "fieldTabs"), {}))):
                err(f"{t}: {s(ty)} with no {'fieldTabs' if ty == 'TAB_GROUP' else 'progressSteps'} (0.5)")
            if ty == "FILE_UPLOAD" and not (T(R("^(SINGLE|MULTIPLE|TILE)$"), g(f, "params", "viewType")) and T(R("^(ALL|IMAGE|DOCUMENT|FOR_CAMERA)$"), g(f, "params", "contentType"))):
                err(f"{t}: FILE_UPLOAD needs params.viewType SINGLE / MULTIPLE / TILE and params.contentType ALL / IMAGE / DOCUMENT / FOR_CAMERA (0.19)")
            tp = g(f, "tabCodePath")
            if cat == "BO_COMPOSITE":
                bfc = g(f, "boFieldCodes") if isinstance(g(f, "boFieldCodes"), list) else []
                if tr(g(f, "gridPosition")) and keys(g(f, "gridPosition")):
                    err(f"{t}: a composite has no form — no gridPosition (§5b)")
                if not bfc or any(not tr(g(x, "boCode")) or not tr(g(x, "fieldCode")) or (isinstance(g(bo, "bos"), list) and not any(seq(g(y, "code"), g(x, "boCode")) for y in bo["bos"])) for x in bfc):
                    err(f'{t}: boFieldCodes — [{{"boCode", "fieldCode"}}…], each boCode in bos[] (§5b)')
            else:
                if tr(g(tp, "tabGroupCode")) and not (g(df, g(tp, "tabGroupCode"), "type") == "TAB_GROUP" and tr(g(df, g(tp, "tabGroupCode"), "fieldTabs", g(tp, "tabCode")))):
                    err(f"{t}: tabCodePath {s(g(tp, 'tabGroupCode'))}.{s(g(tp, 'tabCode'))} names no tab of a TAB_GROUP of {bs} (0.5)")
                if not tr(g(f, "gridPosition")) and not (cat == "BO_PROCESS" and k == "PROCESS_STATUS" and not tr(g(tp, "tabGroupCode"))):
                    err(f"{t}: no gridPosition (0.8)")
            if not isRef(f):
                if keys(nn(g(f, "linkedCoSettings"), {})) or tr(g(f, "copyFromFieldCode")):
                    err(f"{t}: linkedCoSettings / copyFromFieldCode on a {s(ty)} — BO / CO fields only (§3)")
                continue
            if not tr(g(bi, "code")):
                err(f"{t}: no boRefStruct.boInfo.code (0.5a)")
            if k != "PROCESS_STATUS" and g(bi, "boCategory") == "BO_DICTIONARY":
                err(f"{t}: dictionary {s(g(bi, 'code'))} as a BO reference draws a «Выберите» link — DROPDOWN_SINGLE FROM_BO (0.5)")
            if (not T(ID, g(f, "oldRefBoId"))) if tr(g(f, "oldRefBoId")) else g(bi, "code") not in BUILTIN:
                err(f'{t}: oldRefBoId "{s(g(f, "oldRefBoId"))}" — the target\'s oldId, "" only for Person (0.5a)')
            if cat != "BO_PANEL" and g(bi, "code") != "Person" and not any(tr(g(r, "toShow")) for r in vals(g(f, "boRefStruct", "fieldRefs"))):
                err(f"{t}: no fieldRefs entry with toShow: true (0.9 rule 15)")
            rs = nn(g(f, "boRefStruct"), {})
            tg = find(bos, lambda x: seq(g(x, "code"), g(bi, "code")))
            tf = nn(g(tg, "dynamicFields"), {})
            back = g(rs, "linkedFieldCode")
            bk = g(tf, back)
            if ty == "CO" and g(bi, "boCategory") != "BO_COMPOSITE":
                err(f"{t}: a CO names boInfo.boCategory BO_COMPOSITE (0.5)")
            if not (g(f, "viewType") is U and g(bi, "code") == "Person") and not T(R("^(TABLE|MULTIPLE|SINGLE|FIELDS)$"), g(f, "viewType")):
                err(f"{t}: viewType {s(g(f, 'viewType'))} — TABLE, MULTIPLE, SINGLE or FIELDS (§3)")
            if tr(g(f, "removeType")) and not T(RM, g(f, "removeType")):
                err(f"{t}: removeType {s(g(f, 'removeType'))} — STRIKETHROUGH, HIDE or DISCONNECT (§3)")
            if ty == "CO" and tr(g(f, "isHeightDynamic")):
                err(f"{t}: isHeightDynamic on a CO — BO only (§3)")
            if tr(g(rs, "relMainInnerFieldCode")) and tr(tg) and not isRef(nn(g(tf, g(rs, "relMainInnerFieldCode")), {})):
                err(f"{t}: relMainInnerFieldCode {s(g(rs, 'relMainInnerFieldCode'))} is no BO / CO field of {s(g(tg, 'code'))} (§3)")
            if has(rs, "relFieldCode") or has(rs, "relInnerFieldCode") or any(has(f, x) for x in ["relFieldCode", "relInnerFieldCode", "relMainInnerFieldCode"]):
                err(f"{t}: only boRefStruct.relMainInnerFieldCode travels — relFieldCode stores a wrong field, relInnerFieldCode and top-level rel* are ignored (§3)")
            bf = g(f, "bracketFilter")
            if tr(bf) and (not seq(g(bf, "boCode"), g(bi, "code")) or not seq(g(bf, "fieldCode"), k) or isinstance(g(bf, "brackets"), list)
                           or any(any(tr(tg) and not tr(g(tf, g(d, "fieldCode"))) for d in vals(g(x, "dynamicFilters"))) for x in vals(g(bf, "brackets")))):
                err(f'{t}: bracketFilter — {{"boCode": "{s(g(bi, "code"))}", "fieldCode": "{k}", "brackets": {{<8-char id>: …}}}} with fields of the target (§3)')
            if tr(back) and tr(tg) and ty == "BO":
                co = g(bk, "type") == "CO" and find(bos, lambda x: seq(g(x, "code"), g(bk, "boRefStruct", "boInfo", "code")))
                if not isRef(nn(bk, {})):
                    err(f"{t}: linkedFieldCode {s(back)} is no BO / CO field of {s(g(tg, 'code'))} (0.5a)")
                elif ((isinstance(g(co, "bos"), list) and not any(seq(g(x, "code"), b) for x in co["bos"])) if g(bk, "type") == "CO"
                      else (not seq(g(bk, "boRefStruct", "boInfo", "code"), b) or not seq(g(bk, "boRefStruct", "linkedFieldCode"), k))):
                    err(f"{t}: linkedFieldCode — {s(g(tg, 'code'))}.{s(back)} does not reference {bs} and name {k} back (0.5a)")
                elif any(x != k and g(h, "type") == "BO" and seq(g(h, "boRefStruct", "linkedFieldCode"), back) and seq(g(h, "boRefStruct", "boInfo", "code"), g(tg, "code")) for x, h in fs):
                    err(f"{t}: back field {s(g(tg, 'code'))}.{s(back)} serves another field too — one back field serves one field (0.5a)")
            src, lc = g(df, g(f, "copyFromFieldCode")), g(f, "linkedCoSettings")
            if tr(g(f, "copyFromFieldCode")) and (not seq(g(src, "type"), ty) or not seq(g(src, "viewType"), g(f, "viewType"))):
                err(f"{t}: copyFromFieldCode {s(g(f, 'copyFromFieldCode'))} — a field of {bs} of the same type and viewType (§3)")
            if ty == "BO" and keys(nn(lc, {})):
                err(f"{t}: linkedCoSettings on a BO field — CO only (§3)")
            if ty == "CO" and isinstance(lc, list):
                err(f"{t}: linkedCoSettings is keyed by source BO code, not a list (§3)")
            elif ty == "CO":
                for sc, x in ents(lc):
                    sb = find(bos, lambda y: seq(g(y, "code"), sc))
                    gl = g(sb, "dynamicFields", g(x, "linkedFieldCode"))
                    if ((isinstance(g(tg, "bos"), list) and not any(seq(g(y, "code"), sc) for y in tg["bos"])) or (tr(g(x, "removeType")) and not T(RM, g(x, "removeType")))
                            or (tr(g(x, "linkedFieldCode")) and tr(sb) and not seq(g(gl, "boRefStruct", "boInfo", "code"), b))):
                        err(f"{t}: linkedCoSettings.{sc} — a source BO of {s(g(bi, 'code'))}, removeType STRIKETHROUGH / HIDE / DISCONNECT, linkedFieldCode a field of {sc} that references {bs} (§3)")
        for ms, ks in lack.items():
            err(f"{bs}.{', '.join(ks)}: keys missing from the field template — {ms} (0.5, 0.9 rule 6)")
    mc = set()
    MENU = ["menuItemName", "iconName", "orderIndex", "chosenAccessRight", "needCountMenuItem", "isPanel", "needHideInMobApp", "menuItemType"]
    PAGES = ["isKanbanEnabled", "kanbanIndex", "isCalendarEnabled", "calendarIndex", "isTimelineEnabled", "timelineIndex", "isListEnabled", "listIndex", "isMapEnabled", "mapIndex", "isGroupingEnabled", "groupingIndex"]
    DEF_ICONS = ("bo-g-draggable", "man-with-company", "bo-d-draggable")
    for m in menu:
        mic = g(m, "menuItemCode")
        t, grp, kf = f"menu {s(mic)}", g(m, "menuItemType") == "GROUP", g(m, "boPages", "kanbanFieldCode")
        bo = find(bos, lambda x: seq(g(x, "code"), g(m, "boCode")))
        if not T(CODE, nn(mic, "")) or jk(mic) in mc:
            err(f"{t}: menuItemCode — unique, at most 30 of A-Za-z0-9_ (0.5d)")
        else:
            name(t, mic, *OBJ)
        mc.add(jk(mic))
        if not T(R("^(GROUP|BO)$"), g(m, "menuItemType")):
            err(f"{t}: menuItemType {s(g(m, 'menuItemType'))} — GROUP or BO (0.5d)")
        par = find(menu, lambda x: seq(g(x, "menuItemCode"), g(m, "parentMenuItemCode")))
        bf, bp = g(m, "bracketFilter"), nn(g(m, "boPages"), {})
        if tr(par) and g(par, "menuItemType") != "GROUP":
            err(f"{t}: parent {s(g(par, 'menuItemCode'))} is a {s(g(par, 'menuItemType'))} line, not a GROUP (0.5d)")
        if not grp and tr(bf) and (not seq(g(bf, "boCode"), g(m, "boCode")) or g(bf, "type") != "MENU_ITEM" or isinstance(g(bf, "brackets"), list)):
            err(f'{t}: bracketFilter — {{"boCode": "{s(g(m, "boCode"))}", "type": "MENU_ITEM", "brackets": {{}}}} (0.5d)')
        if not grp and tr(g(m, "boPages")):
            ms = [k for k in PAGES if not has(bp, k)]
            on = [g(bp, k[2].lower() + k[3:].replace("Enabled", "Index")) for k in PAGES if k.startswith("is") and tr(g(bp, k))]
            if ms:
                err(f"{t}: boPages keys missing — {', '.join(ms)} (0.5d)")
            if has(bp, "kanbanFieldId") or (tr(g(bp, "isKanbanEnabled")) and not tr(kf)):
                err(f"{t}: a kanban opens by boPages.kanbanFieldCode — never kanbanFieldId, never enabled without it (0.5d)")
            if len(uniq(on)) < len(on) or any(not ge(v, 1) for v in on):
                err(f"{t}: the *Index of the enabled views — distinct, from 1 (0.5d)")
        if T(R("^(bo-g-draggable|man-with-company|bo-d-draggable)$"), g(m, "iconName")):
            DEF_ICON.append(mic)
        for k in MENU:
            if k not in m:
                err(f"{t}: key {k} missing (0.5d)")
        for k in ["oldId", "newId", "id", "boId", "parentId"]:
            if k in m:
                err(f"{t}: carries {k} — name by code (0.9 rule 14)")
        for k in ["boPages", "bracketFilter"] if grp else ["boCode", "boName", "boPages", "bracketFilter"]:
            if (k in m) == grp:
                err(f"{t}: {'a GROUP line carries' if grp else 'a BO line needs'} {k} (0.9 rule 14)")
        if tr(kf) and tr(bo) and not (g(bo, "dynamicFields", kf, "type") == "DROPDOWN_SINGLE" and tr(g(bo, "kanbanCardTemplates", kf))):
            err(f"{t}: kanbanFieldCode {s(kf)} is no DROPDOWN_SINGLE of {s(g(bo, 'code'))} with a card template (0.9 rule 14)")
        if tr(kf) and g(bo, "dynamicFields", "status", "type") == "DROPDOWN_SINGLE" and not any(seq(g(x, "boCode"), g(m, "boCode")) and g(x, "boPages", "kanbanFieldCode") == "status" for x in of("MenuItemStructDto")):
            err(f"{t}: the kanban opens by {s(kf)} while {s(g(bo, 'code'))} has a status — kanbanFieldCode status (0.15)")
        if tr(kf) and kf != "status":
            err(f"REMINDER {t}: a kanban by {s(kf)} — no status path; right only when the user asked for a board by {s(kf)} (name that request in the report), else isKanbanEnabled false (0.5d «Kanban only by `status`»)")

    def by(a, f):
        r = {}
        for x in a:
            r.setdefault(s(f(x)), []).append(x)
        return r

    def icon(ms):
        return ents(by(ms, lambda m: nn(g(m, "iconName"), "")))

    gmenu = [m for m in menu if g(m, "menuItemType") == "GROUP"]
    for ic, ms in icon(gmenu):
        if len(ms) > 1:
            err(f"menu {join([g(m, 'menuItemCode') for m in ms], ', ')}: groups share icon {ic} — each group by its own theme (0.5d)")
    for x in gmenu:
        for c in [m for m in menu if seq(g(m, "parentMenuItemCode"), g(x, "menuItemCode")) and seq(g(m, "iconName"), g(x, "iconName"))]:
            err(f"menu {s(g(x, 'menuItemCode'))}: group icon {s(g(x, 'iconName'))} repeats its item {s(g(c, 'menuItemCode'))} — the group by its theme, the item by its records (0.5d)")
    parts = s(nn(doc, "")).split("\n### 0.16 Menu icons")
    icat = parts[1].split("\n### ")[0] if len(parts) > 1 else U
    if not tr(icat):
        err("iconName not checked — call lintArchive(<the archive text>, <the text of this document>) (0.16)")
    else:
        for m in menu:
            ns, *rest = s(nn(g(m, "iconName"), "")).split(":")
            n = ":".join(rest)
            known = g(m, "iconName") in DEF_ICONS or (T(R("^(phosphor|menu-item)$"), ns) and (f" {n} " in icat or f" {n}\n" in icat or f"«{n}»" in icat or f": {n} " in icat))
            if not known:
                err(f'menu {s(g(m, "menuItemCode"))}: iconName "{s(g(m, "iconName"))}" is not in 0.16 — the sidebar draws an empty place; pick one from 0.5d «Icons by meaning» (0.16)')
    for sib in vals(by([m for m in menu if g(m, "menuItemType") != "GROUP"], lambda m: nn(g(m, "parentMenuItemCode"), ""))):
        for ic, ms in icon(sib):
            if len(ms) >= 3:
                err(f"menu {join([g(m, 'menuItemCode') for m in ms], ', ')}: {len(ms)} siblings with icon {ic} — each by what it lists (0.5d)")
    R3 = R("^(INPUT_(TEXT|TEXT_LANG|PHONE|EMAIL|NUMBER)|TIME|FULL_DATE|YEAR_AND_MONTH|YEAR|DATE|PERIOD|PERIOD_TIME|CHECKBOX|DROPDOWN_SINGLE)$")
    R6, R8 = R("^(LINK|FILE_UPLOAD|CHECKLIST|RADIO_BUTTON_GROUP|PROGRESS_BAR)$"), R("^(QUESTIONNAIRE|GEO_POINT)$")
    FULL = R("^(TEXTAREA(_LANG)?|STATIC_TEXT|TAB_GROUP|CHECKLIST|QUESTIONNAIRE|GEO_POINT|PROGRESS_BAR)$")
    for bo in [x for x in bos if g(x, "category") != "BO_COMPOSITE"]:
        bc, fs, forms = s(g(bo, "code")), vals(g(bo, "dynamicFields")), {}

        def put(tab, c):
            forms.setdefault(jk(nn(tab, "")), [nn(tab, ""), []])[1].append(c)

        for f in fs:
            t, gp, ty = f"{bc}.{s(g(f, 'code'))}", g(f, "gridPosition"), g(f, "type")
            text = T(R("^TEXTAREA"), ty)
            short = g(f, "viewType") == "SINGLE" if isRef(f) else T(R3, ty)
            table = isRef(f) and g(f, "viewType") == "TABLE"
            if g(f, "archetype") != "DYNAMIC" or not tr(g(f, "kind")):
                err(f'{t}: no "archetype": "DYNAMIC" + "kind": "GENERAL" (0.5)')
            if text and g(f, "params", "buttonTypes") is U:
                err(f"{t}: TEXTAREA without params.buttonTypes (0.5)")
            if table and len([r for r in vals(g(f, "boRefStruct", "fieldRefs")) if tr(g(r, "toShow"))]) < 2:
                err(f"{t}: TABLE shows fewer than 2 columns (0.5a)")
            if tr(gp) and ty == "TAB_GROUP" and tr(g(f, "trackedFieldCode")) and not seq(g(gp, "rows"), 4):
                err(f"{t}: rows {s(g(gp, 'rows'))}, a tracked-status wrapper takes 4 (§3)")
            if not tr(gp) or tr(g(f, "trackedFieldCode")):
                continue
            if g(f, "code") == "PROCESS_STATUS":  # its own box, but its rows stack (0.8)
                put(g(f, "tabCodePath", "tabCode"), {"t": t, "g": gp, "box": True})
                continue
            want = 3 if short else 8 if T(R8, ty) else 6 if T(R6, ty) else 0
            mn = 6 if text or (isRef(f) and not short) else 3 if ty == "STATIC_TEXT" else 0
            if (not seq(g(gp, "rows"), want)) if want else lt(g(gp, "rows"), mn):
                err(f"{t}: rows {s(g(gp, 'rows'))}, a {s(ty)} takes {want or 'at least ' + str(mn)} (0.8)")
            put(g(f, "tabCodePath", "tabCode"), {"t": t, "g": gp, "short": short, "head": ty == "STATIC_TEXT", "full": T(FULL, ty) or table})
        for w in [*[w for m in W for w in vals(g(bo, m))], *vals(g(bo, "nativeFields"))]:
            if tr(g(w, "gridPosition")):
                put(g(nn(g(w, "tabCode"), g(w, "tabCodePath")), "tabCode"), {"t": f"{bc}.{s(nn(g(w, 'code'), g(w, 'nativeFieldId')))}", "g": g(w, "gridPosition"), "box": True})
        for tab, cells in forms.values():
            nxt, edge, lone = 0, 15, 0
            for y in jsort(uniq([g(c["g"], "y") for c in cells])):  # a y that is no number sorts as 0
                row = sorted([c for c in cells if seq(g(c["g"], "y"), y)], key=lambda c: num0(g(c["g"], "x")))
                r = row[0]["t"]
                if not seq(y, nxt):
                    err(f"{r}: y {s(y)}, expected {s(nxt)} (0.8)")
                x = 0
                for c in row:
                    cx = g(c["g"], "x")
                    if lt(cx, x):
                        err(f"{c['t']}: overlaps the cell before it in row y {s(y)} (0.10)")
                    elif gt(cx, x) and not any(d.get("box") for d in row):
                        err(f"{c['t']}: x {s(cx)} leaves a gap after column {s(x)} (0.8)")
                    if not c.get("box") and ge(cx, edge):
                        err(f"{c['t']}: x {s(cx)} in the free columns {s(edge)}–14 above — floats up (0.8)")
                    x = jmax(x, jadd(cx, g(c["g"], "cols")))
                lone8 = len(row) == 1 and row[0].get("short") and seq(g(row[0]["g"], "x"), 0) and seq(g(row[0]["g"], "cols"), 8)
                if (len(row) > 1 or not row[0].get("box")) and not seq(x, 15) and not lone8:
                    err(f"{r}: row y {s(y)} spans {s(x)} of 15 columns (0.8)")
                if len([c for c in row if not c.get("box")]) > 1:
                    for c in [c for c in row if c.get("full")]:
                        err(f"{c['t']}: shares row y {s(y)} — it stands alone, full width (0.8)")
                if len(uniq([g(c["g"], "rows") for c in row])) > 1:
                    err(f"{r}: row y {s(y)} mixes heights (0.8)")
                if len(row) == 1 and row[0].get("short"):
                    lone += 1
                    if seq(g(row[0]["g"], "cols"), 15) and g(bo, "category") != "BO_DICTIONARY":
                        err(f"{r}: a short field alone at full width — pair it or x 0, cols 8 (0.8)")
                nxt = jadd(y, jmax(*[g(c["g"], "rows") for c in row]))
                edge = 15 if any(c.get("box") for c in row) else x
            heads = [c for c in cells if c.get("head")]
            for h in heads:
                below = [c for c in cells if gt(g(c["g"], "y"), g(h["g"], "y"))]
                y = jmin(*[g(c["g"], "y") for c in below])
                if not below or any(seq(g(c["g"], "y"), y) and c.get("head") for c in below):
                    err(f"{h['t']}: heading with no field under it — not a group (0.8a step 2)")
            if len(heads) == 1 and len(cells) > 1 and seq(g(heads[0]["g"], "y"), jmin(*[g(c["g"], "y") for c in cells])):
                err(f"{heads[0]['t']}: the only heading, on top of the whole {'tab' if tr(tab) else 'form'} — groups nothing; ≥ 2 headings or none (0.8a step 2)")
            if lone >= 3 and g(bo, "category") != "BO_DICTIONARY":
                err(f"{bc}{' tab ' + s(tab) if tr(tab) else ''}: {lone} rows hold one short field each — 2–3 per row, a lone field at most 2 per form (0.8)")
        if g(bo, "category") in ("BO_DICTIONARY", "BO_PROCESS"):
            continue
        seen = len([f for f in fs if not tr(g(f, "trackedFieldCode")) and g(f, "type") != "STATIC_TEXT" and g(f, "type") != "TAB_GROUP" and g(f, "tabCodePath", "tabCode") != "tab_system"])
        tabs = any(g(f, "type") == "TAB_GROUP" and any(k != "tab_system" for k in keys(nn(g(f, "fieldTabs"), {}))) for f in fs)
        cols = len([f for f in fs if g(f, "tableColToShow") is True])
        if seen > 12 and not tabs:
            err(f"{bc}: {seen} visible fields and no tabs — tabs of ≤ 12 fields, also on instanceViewType TAB (0.8a step 3)")
        elif seen > 8 and not tabs and not any(g(f, "type") == "STATIC_TEXT" for f in fs):
            err(f"{bc}: {seen} visible fields, no heading and no tabs (0.8a step 2)")
        if cols > 6:
            err(f"{bc}: {cols} registry columns — the name + at most 5 (0.5)")
    tl = by([{"bo": g(bo, "code"), "k": low(g(x, "label", "rus"))} for bo in bos for f in vals(g(bo, "dynamicFields")) if g(f, "type") == "TAB_GROUP"
             for x in vals(g(f, "fieldTabs")) if g(x, "code") != "tab_system" and not tr(g(x, "isDefault"))], lambda x: x["k"])
    for k, sl in ents(tl):
        tb = uniq([x["bo"] for x in sl])
        if k and len(tb) >= 3:
            err(f"{join(tb, ', ')}: tab «{k}» copied onto every BO — name each tab by what it holds (0.8a step 3)")
    for bo in [x for x in bos if g(x, "instanceViewType") != "TAB" and T(R("^BO(_PROCESS|_DICTIONARY)?$"), g(x, "category"))]:
        bc, gp, fs = s(g(bo, "code")), g(bo, "gridLayoutPosition"), vals(g(bo, "dynamicFields"))
        if not tr(gp):
            err(f"{bc}: no gridLayoutPosition — the record opens at 90 % × 90 % of the screen (0.8a step 7)")
            continue
        rows = jmax(0, *[jadd(g(f, "gridPosition", "y"), g(f, "gridPosition", "rows")) for f in fs if tr(g(f, "gridPosition")) and not tr(g(f, "tabCodePath", "tabCode")) and not tr(g(f, "trackedFieldCode"))])
        if gt(g(gp, "h"), 28):
            err(f"{bc}: FORM window h {s(g(gp, 'h'))} > 28 — tabs or instanceViewType TAB (0.8a steps 3, 8)")
        elif lt(g(gp, "h"), rows + 5):
            err(f"{bc}: FORM window h {s(g(gp, 'h'))} scrolls {s(rows)} form rows — h {s(rows + 5)} (0.8a step 7)")
        for f in [f for f in fs if g(f, "type") == "BO" and g(f, "viewType") == "TABLE"]:
            c = find(bos, lambda x: seq(g(x, "oldId"), g(f, "oldRefBoId")))
            if tr(c) and g(c, "instanceViewType") != "TAB" and ge(g(c, "gridLayoutPosition", "w"), g(gp, "w")) and not any(g(x, "viewType") == "TABLE" and seq(g(x, "oldRefBoId"), g(bo, "oldId")) for x in vals(g(c, "dynamicFields"))):
                err(f"{bc}.{s(g(f, 'code'))}: child {s(g(c, 'code'))} window w {s(g(c, 'gridLayoutPosition', 'w'))} ≥ {s(g(gp, 'w'))} — narrower or TAB (0.8a steps 7–8)")
    SZ = {"Enter": [30, 30], "Exit": [30, 30], "Point": [20, 20], "Terminator": [40, 40], "Script": [80, 50], "Timer": [80, 50],
          "Form": [100, 50], "Switch": [60, 60], "SingleToParallel": [39, 64], "ParallelToSingle": [39, 64]}

    def hit(a, b):
        return lt(a[0], b[2]) and lt(b[0], a[2]) and lt(a[1], b[3]) and lt(b[1], a[3])

    for pv in PV:
        host = find(bos, lambda b: seq(g(b, "oldId"), g(pv, "oldId")))
        pc = s(nn(g(host, "code"), g(pv, "oldId")))
        if host is U:
            fatal(f"BoProcessVersionsStructDto {s(g(pv, 'oldId'))}: no BO line with that oldId (0.18)")
        if not tr(g(pv, "workProcess")):
            err(f"{pc}: only processVersions — imports as a TEST version that runs on DEV records only; the diagram goes into workProcess (0.18)")
        for v in [x for x in [g(pv, "workProcess"), *vals(g(pv, "processVersions"))] if tr(x)]:
            if not ents(g(v, "figureStructs")):
                err(f"{pc}: no figureStructs (0.18)")
                continue
            for fid, f in ents(g(v, "figureStructs")):
                mt = R(r"\.Figure(\w+)Struct$").search(s(nn(g(f, "@class"), "")))
                t, fc = mt.group(1) if mt else U, g(host, "dynamicFields", g(f, "fieldCode"))
                if not tr(t):
                    err(f"{pc}: figure {fid} has no Figure<Type>Struct @class (0.18)")
                if t == "Form" and g(fc, "type") != "BO":
                    err(f"{pc}: Form {fid} fieldCode {s(g(f, 'fieldCode'))} — a BO-reference field of the process (0.18)")
                if t == "Timer" and not (T(R("^(FULL_DATE|DATE)$"), g(fc, "type")) and g(f, "archetype") == "DYNAMIC"):
                    err(f"{pc}: Timer {fid} — fieldCode a date field of the process, archetype DYNAMIC (0.18)")
            if not ents(g(v, "arrows")):
                err(f"{pc}: no arrows (0.18)")
            for c in it(nn(g(v, "scriptsDefIds"), [])):
                sx = find(defs, lambda x: seq(g(x, "compositeId"), c))
                if sx is U:
                    err(f"{pc}: scriptsDefIds names {s(c)}, no ScriptDefStructDto (0.18)")
                else:
                    for bid, x in ents(g(sx, "blocks")):
                        if tr(g(x, "targetArrowId")) and not tr(g(v, "arrows", g(x, "targetArrowId"))):
                            err(f"{pc}: script {s(c)} block {bid} exits by {s(g(x, 'targetArrowId'))}, no arrow of the diagram (0.18)")
            F = {}
            for fid, f in ents(g(v, "figureStructs")):
                t = R("^Figure|Struct$").sub("", cls(f))
                w, h = SZ.get(t, [80, 50])
                F[fid] = {"t": t, "x": g(f, "x"), "y": g(f, "y"), "b": [num(g(f, "x")) - w / 2, num(g(f, "y")) - h / 2, jadd(g(f, "x"), w / 2), jadd(g(f, "y"), h / 2)]}
            for fid, f in F.items():
                if T(R("^(Script|Switch)$"), f["t"]) and not any(s(g(x, "compositeId")).endswith(f"-{fid}") for x in of("ScriptDefStructDto")):
                    err(f'{pc}: {f["t"]} {fid} has no ScriptDefStructDto "<version>-{fid}" — on a record the figure FAILS «Скрипт не определен» (0.18)')

            def at(f, sl):
                if sl == "main":
                    return [f["b"][2] if f["t"] == "Enter" else f["b"][0], f["y"]]
                if sl == "left":
                    return [f["b"][0], f["y"]]
                if sl == "right":
                    return [f["b"][2], f["y"]]
                if T(R("^(top|up)$"), sl):
                    return [f["x"], f["b"][1]]
                if T(R("^(bottom|down)$"), sl):
                    return [f["x"], f["b"][3]]
                return [f["x"], f["y"]]

            labs = []
            for a in vals(g(v, "arrows")):
                st, fi, an = F.get(s(g(a, "startFigureId"))), F.get(s(g(a, "finishFigureId"))), nn(g(a, "name"), "")
                if st is None or fi is None:
                    err(f"{pc} arrow «{s(an)}»: both ends name figures of the diagram (0.18)")
                    continue
                if st["t"] == "Switch" and not tr(g(a, "name")):
                    err(f"{pc}: an arrow leaves Switch {s(g(a, 'startFigureId'))} without a name — validation fails (0.18)")
                (x1, y1), (x2, y2) = at(st, g(a, "startSlotName")), at(fi, g(a, "finishSlotName"))
                n = len(an) if isinstance(an, (str, list)) else 0
                t, dx, dy = f"{pc} arrow «{s(an)}»", abs(num(x2) - num(x1)), abs(num(y2) - num(y1))
                if st["t"] != "Point" and fi["t"] != "Point" and tr(dx) and tr(dy):
                    err(f"{t}: not straight — both slots on one y or one x (0.18)")
                if n > 12:
                    err(f"{t}: name longer than 12 characters (0.18)")
                if not tr(dy) and dx < 15 * n + 20:
                    err(f"{t}: gap {s(dx)} px, needs {15 * n + 20} (0.18)")
                if not tr(dx) and dy < 50:
                    err(f"{t}: vertical gap {s(dy)} px, needs 50 (0.18)")
                if n:
                    mx, my = num(jadd(x1, x2)) / 2, num(jadd(y1, y2)) / 2
                    labs.append({"t": t, "b": [mx, my, mx + 7.5 * n, my + 18]})
            for i, l in enumerate(labs):
                for f in vals(F):
                    if hit(l["b"], f["b"]):
                        err(f"{l['t']}: label overlaps a {f['t']} figure (0.18)")
                for m in labs[i + 1:]:
                    if hit(l["b"], m["b"]):
                        err(f"{l['t']}: label overlaps {m['t']} (0.18)")
                if l["b"][2] > 1200:
                    err(f"{l['t']}: label ends at x {s(jround(l['b'][2]))}, beyond 1200 (0.18)")
            if not ents(g(v, "runWayMap")):
                err(f"{pc}: empty runWayMap — nothing starts the process (0.18)")
    for bo in [x for x in bos if tr(g(x, "dynamicFields", "PROCESS_STATUS"))]:
        bc, dv = s(g(bo, "code")), g(bo, "dynamicFields", "PROCESS_STATUS", "defaultValue")
        if not tr(dv) or dv == "[]":
            err(f"{bc}.PROCESS_STATUS: no defaultValue (the CREATED row) — every record is refused on save (0.17)")
        if not any(any(g(x, "sourceType") == "DEFAULT_VALUE" and seq(g(x, "defaultValueInstanceSource", "boCode"), g(bo, "code")) and g(x, "defaultValueInstanceSource", "fieldCode") == "PROCESS_STATUS"
                       for x in it(nn(g(r, "sources"), []))) for r in of("ExportStructInstanceDto")):
            err(f'{bc}.PROCESS_STATUS: no PROCESS_STATUS row line with sources DEFAULT_VALUE {{boCode: "{bc}", fieldCode: "PROCESS_STATUS"}} — the default does not take, every record is refused on save (0.17, 0.18)')
    fields, rows = [f for b in bos for f in vals(g(b, "dynamicFields"))], of("ExportStructInstanceDto")

    def lab(r):
        try:
            p = jparse(nn(g(r, "fieldMap", "label", "storedValue"), "{}"))
        except (ValueError, RecursionError):
            return ""
        return "" if p is None else low(g(p, "RUS"))

    for d in [x for x in bos if g(x, "category") == "BO_DICTIONARY" and g(x, "code") != "PROCESS_STATUS"]:
        used = any(seq(g(f, "fieldOptionsStruct", "dictionaryBoInfo", "code"), g(d, "code")) or seq(g(f, "boRefStruct", "boInfo", "code"), g(d, "code")) for f in fields)
        if not used and any(g(b, "category") != "BO_DICTIONARY" for b in bos):
            err(f"{s(g(d, 'code'))}: dictionary no field uses — a DROPDOWN_SINGLE FROM_BO on it, or drop it (0.5b)")
        dl = set(x for x in (lab(r) for r in rows if seq(g(r, "boCode"), g(d, "code"))) if x)
        for bo in bos:
            for f in vals(g(bo, "dynamicFields")):
                same = len([o for o in vals(g(f, "fieldOptionsStruct", "options")) if low(g(o, "fieldOption", "label")) in dl])
                if g(f, "fieldOptionsStruct", "optionSource") == "FROM_FIELD" and same >= 2:
                    err(f"{s(g(bo, 'code'))}.{s(g(f, 'code'))}: local list repeats {same} rows of dictionary {s(g(d, 'code'))} — FROM_BO on it (0.5)")
    for x in of("ScriptDefStructDto"):
        if all(T(R("Block(FixEntryPoint|Exit)Struct$"), nn(g(y, "@class"), nn(g(y, "type"), ""))) for y in vals(g(x, "blocks"))):
            err(f"script {s(g(x, 'compositeId'))}: only entry → exit — does nothing; give it the step's work or drop it (0.18)")
    owner, written = {}, set()  # "<BO>.<field>" some script assigns: <x>.<field>.#Значение = …
    for v in of("BoScriptVersionsStructDto"):
        for c in it(nn(g(v, "workScripts", "scriptDefIds"), [])):
            owner[jk(c)] = g(v, "ownerBoInfo", "code")
    for pv in of("BoProcessVersionsStructDto"):
        for v in [g(pv, "workProcess"), *vals(g(pv, "processVersions"))]:
            for c in it(nn(g(v, "scriptsDefIds"), [])):
                owner[jk(c)] = g(find(bos, lambda b: seq(g(b, "oldId"), g(pv, "oldId"))), "code")
    for sd in of("ScriptDefStructDto"):
        X, B = nn(g(sd, "expressions"), {}), nn(g(sd, "blocks"), {})

        def fld(e):
            m = R(r"^F-(\w+)-K-").search(s(nn(g(e, "actId"), "")))
            return m.group(1) if m else U

        def boOf(e, d=0):  # the BO whose records the expression yields
            if not tr(e) or d > 20:
                return U
            if g(e, "exprValueType") == "THIS_PROCESS":
                return owner.get(jk(g(sd, "compositeId")), U)
            if g(e, "exprValueType") == "VAR_REF":
                b = g(B, g(e, "varBlockId"))
                return boOf(g(X, nn(g(b, "srcExprId"), g(b, "valueExprId"))), d + 1)
            a = e
            while tr(a) and T(R("^F-VALUE-"), nn(g(a, "actId"), "")):
                a = g(X, g(a, "leftExprId"))
            f = fld(a)
            host = boOf(g(X, g(a, "leftExprId")), d + 1) if tr(f) else f
            return g(find(bos, lambda b: seq(g(b, "code"), host)), "dynamicFields", f, "boRefStruct", "boInfo", "code")

        for b in [x for x in vals(B) if T(R("BlockAssign"), nn(g(x, "@class"), ""))]:
            e = g(X, g(b, "leftExprId"))
            while tr(e) and T(R("^F-VALUE-"), nn(g(e, "actId"), "")):
                e = g(X, g(e, "leftExprId"))
            if tr(fld(e)):
                written.add(f"{s(nn(boOf(g(X, g(e, 'leftExprId'))), '*'))}.{s(fld(e))}")
    noProcess = not any(any(any(T(R("BlockAssign"), jj(g(find(of("ScriptDefStructDto"), lambda x: seq(g(x, "compositeId"), c)), "blocks"))) for c in it(nn(g(v, "scriptsDefIds"), [])))
                            for v in [g(pv, "workProcess"), *vals(g(pv, "processVersions"))]) for pv in of("BoProcessVersionsStructDto"))
    for bo in [x for x in bos if g(x, "category") != "BO_DICTIONARY"]:
        for f in vals(g(bo, "dynamicFields")):
            l = nn(g(f, "label", "rus"), "")
            t = f"REMINDER {s(g(bo, 'code'))}.{s(g(f, 'code'))} «{s(l)}»"
            nums = [low(g(x, "label", "rus")) for x in vals(g(bo, "dynamicFields")) if g(x, "type") == "INPUT_NUMBER"]
            line = T(R("сумм", True), l) and any(T(R("кол|час|объ[её]м|вес"), x) for x in nums) and any(T(R("цен|тариф|ставк"), x) for x in nums)  # qty ∙ price
            if (f"{s(g(bo, 'code'))}.{s(g(f, 'code'))}" not in written and f"*.{s(g(f, 'code'))}" not in written and g(f, "type") == "INPUT_NUMBER"
                    and not T(R("мин|макс|порог|лимит|норм", True), l) and (line or T(R("итого|остат|резерв|баланс|к оплате", True), l))):
                err(f"{t} looks computed and no script writes it — a hook (0.2c step 7, §5d «A ready sum hook»), or report «вводится вручную, потому что …»")
            if noProcess and g(f, "type") in ("CHECKBOX", "DROPDOWN_SINGLE") and T(R("согласован|утвержд", True), l):
                stage = any(x is not f and any(T(R("согласов|утвержд", True), nn(g(o, "fieldOption", "label"), "")) for o in vals(g(x, "fieldOptionsStruct", "options"))) for x in vals(g(bo, "dynamicFields")))
                if stage:
                    err(f"{s(g(bo, 'code'))}.{s(g(f, 'code'))} «{s(l)}»: an approval field AND an approval stage in the status list, and no process links them — the BO_PROCESS that moves the status when it is approved (0.18 «A writing Script, literally»); «отмечается вручную» does not answer a stage path")
                else:
                    err(f"{t} looks like an approval and no process changes anything — a BO_PROCESS that writes (0.18), or report «отмечается вручную, потому что …»")
    for bo in [x for x in bos if g(x, "category") == "BO" and not tr(g(x, "isCalendarEnabled")) and T(R("запис|визит|встреч|при[её]м|брон", True), nn(g(x, "name", "rus"), ""))]:
        if any(g(f, "type") == "FULL_DATE" for f in vals(g(bo, "dynamicFields"))):
            err(f"REMINDER {s(g(bo, 'code'))} «{s(g(bo, 'name', 'rus'))}»: visits with a date and time but no calendar — isCalendarEnabled + a calendar menu item (§2 «BO views»), or report why not")
    ASK = R("^REMINDER .* (looks computed|looks like an approval)")
    asks = len([x for x in out if ASK.search(x)])
    if asks and not of("ScriptDefStructDto") and not of("BoProcessVersionsStructDto"):
        err(f"{asks} fields look computed or like an approval and the file has NO script and NO process — a blanket «пока не реализовано» is no reason (0.2b step 5): the ready sum hook (§5d «A ready sum hook»), the writing Script (0.18)")
    if DEF_ICON:
        err(f"REMINDER menu {join(DEF_ICON, ', ')}: the generic default icon — only when the user asked for no icons; else an icon by meaning (0.5d)")
    if DV:
        err(f"REMINDER defaultValue of {', '.join(DV)} is no option's newOptionId: right only when the line goes back onto the SAME BO it was exported from; else the newOptionId of the option it meant (§3)")
    if NAME:
        err(f"REMINDER {len(NAME)} code(s) off the naming convention — {'; '.join(NAME[:8])}{'; …' if len(NAME) > 8 else ''}: rename a new code, or say in the report the code is already on the stand — a stand code is never renamed (0.6a)")
    MAP = R("^(dynamicFields|nativeFields|fieldRefs|fieldMap|fieldTabs|fieldScripts|fieldAccessStructMap|tabAccessStructMap|boTabs|options|kanbanFields|kanbanCardTemplates|timelineTemplates|calendarCardTemplates|columns|signatures|buttons|iframes|captcha|currentDates|currentUser|groupingInfo|gantTableLocations|linkedCoSettings|questionnaires|progressSteps|blocks|expressions|args|argExprIds|branches|brackets|dynamicFilters|nativeFilters|fromFields|fieldCodes|massFieldCodes|printFormCodes|massPrintFormCodes|figureStructs|arrows|processVersions|more|runWayMap|fieldValues|changeVariantSet|defaultValueMap)$")
    named, invented, dtext = {}, {}, s(nn(doc, ""))  # a key this document names as "key" or `key`; the others with where they sit

    def keyOk(k):
        if k not in named:
            named[k] = f'"{k}"' in dtext or f"`{k}`" in dtext
        return named[k]

    def walk(o, at, p, up):  # p = the key holding o, up = the key above it; the keys of a MAP (codes, ids) are data
        if isinstance(o, list):
            for x in o:
                walk(x, at, p, up)
        elif isinstance(o, dict):
            for k, v in ents(o):
                if not T(MAP, p) and up != "massPrintFormCodes" and not T(ID, k) and not keyOk(k):
                    invented.setdefault(k, []).append(f"{at}{'.' + p if p else ''}")
                walk(v, at, k, p)

    def where(o, i):  # raw: a Set below keeps two objects or 5 and "5" apart, as in JS
        return nn(g(o, "code"), nn(g(o, "menuItemCode"), nn(g(o, "ownerBoInfo", "code"), nn(g(o, "compositeId"), f"line {i + 1}"))))

    if tr(doc):
        for i, o in enumerate(L):
            walk(o, s(where(o, i)), "", "")
    for k, at in invented.items():
        err(f'{", ".join(uniq(at)[:3])}: key "{k}" is not in this document — invented, the importer drops it silently or fails; find the setting by meaning or write no key and say so (0.4a)')
    KP, wrong = {}, {}  # 0.4b: "<DtoClass> <place>" → the keys that sit there
    m4 = R(r"### 0\.4b[\s\S]*?```text\n([\s\S]*?)```").search(dtext)
    for l in (m4.group(1) if m4 else "").split("\n"):
        m = R(r"^(\S+) (\S+): (.+)$").search(l)
        if m:
            for p in m.group(2).split("|"):
                KP[f"{m.group(1)} {'' if p == '(top)' else p}"] = set(m.group(3).split(" "))

    def place(o, c, p, at):  # p = the place of o: the key holding it, "<map>.*" for a member of a map; an unknown place is not checked
        if isinstance(o, list):
            for x in o:
                place(x, c, p, at)
            return
        if not isinstance(o, dict) or p == "massPrintFormCodes.*":
            return
        if not p.endswith(".*") and (T(MAP, p) or (c == "ScriptDefStructDto" and p == "params")):
            for v in vals(o):
                place(v, c, f"{p}.*", at)
            return
        here = KP.get(f"{c} {p}")
        for k, v in ents(o):
            if here is not None and k not in here and keyOk(k):
                wrong.setdefault(f"{k}|{c} {p or '(top)'}", []).append(at)
            place(v, c, k, at)

    if KP:
        for i, o in enumerate(L):
            place(o, cls(o), "", where(o, i))
    for w, at in wrong.items():
        k, cp = w.split("|")[:2]
        there = [p + "(top)" if p.endswith(" ") else p for p, st in KP.items() if k in st]
        err(f'{join(uniq(at)[:3], ", ")}: key "{k}" in {cp} — it sits in {", ".join(there[:3]) or "no place of 0.4b"}{", …" if len(there) > 3 else ""}; the importer drops it there without a word (0.4b)')
    if tr(source):  # the export this file amends (0.7 case 1): a line on a BO header, field, widget, script or process it carries byte-for-byte is left as exported; FATAL lines always stay
        def canon(v):
            if isinstance(v, list):
                return "[" + ",".join(canon(x) for x in v) + "]"
            if isinstance(v, dict):
                return "{" + ",".join(jstr(k) + ":" + canon(v[k]) for k in sorted(keys(v), key=_u16)) + "}"
            return jj(v)

        S, had = {}, set()
        for l in s(source).rstrip(_WS).split("\n"):
            try:
                o = jparse(l)
            except (ValueError, RecursionError):
                continue
            had.add(canon(o))
            if cls(o) == "BoStructDto":
                S[jk(g(o, "code"))] = o

        def idem(o):
            return tr(o) and canon(o) in had

        def head(b):
            return canon({k: v for k, v in ents(b) if k != "dynamicFields" and k != "nativeFields" and k not in W})

        def get(b, seg):
            a, c = (seg.split(".") + [U])[:2]
            if a in W:
                return g(b, a, c)
            return nn(g(b, "dynamicFields", a), nn(find(vals(g(b, "dynamicFields")), lambda x: seq(g(x, "code"), a)), nn(g(b, "nativeFields", a), find([g(b, w, a) for w in W], tr))))

        def same(b, sb, seg):
            x = get(b, seg)
            return not nul(x) and canon(x) == canon(get(sb, seg))

        kept, carried = [], []
        whole = all(jk(g(x, "code")) in S and head(x) == head(S[jk(g(x, "code"))]) for x in bos)
        asked = [R(r"^REMINDER ([A-Za-z0-9_]+)\.(\w+)").search(r) for r in out if ASK.search(r)]
        for l in out:
            m, sc = R(r"^([A-Za-z0-9_]+)(?:\.([^:]+)| (arrow|tab) [^:]*)?: ").search(l), R(r"^(script|rights of) (\S+): ").search(l)
            b = find(bos, lambda x: seq(g(x, "code"), m.group(1))) if m else None
            sb = S.get(jk(m.group(1)), U) if m else None
            segs = R(" «[^»]*»$").sub("", m.group(2), count=1).split(", ") if m and m.group(2) is not None else []
            y = g(get(b, segs[0]), "gridPosition", "y") if segs else 0

            def form(keep):
                return all(same(b, sb, k) for k, f in [*ents(g(b, "dynamicFields")), *[(f"{w}.{c}", x) for w in W for c, x in ents(g(b, w))]] if keep(f))

            if sc:
                as_ = idem(find(defs, lambda d: seq(g(d, "compositeId"), sc.group(2))) if sc.group(1) == "script" else find(acc, lambda a: seq(g(a, "boCode"), sc.group(2))))
            elif R(r"^\d+ BOs in one group").search(l):  # the grouping of a file that only carries BOs
                as_ = whole
            elif R(r"^\d+ fields look computed").search(l):
                as_ = all(r is not None and jk(r.group(1)) in S and same(find(bos, lambda x: seq(g(x, "code"), r.group(1))), S[jk(r.group(1))], r.group(2)) for r in asked)
            elif not (tr(b) and tr(sb)):
                as_ = False
            elif R(r"\(0\.18\)").search(l):  # a process line: the whole process carried
                as_ = idem(find(PV, lambda p: seq(g(p, "oldId"), g(b, "oldId"))))
            elif m.group(3) == "tab":
                as_ = form(lambda f: True)
            elif segs:
                as_ = all(same(b, sb, x) for x in segs)
            else:  # a form-wide line needs the whole form carried
                as_ = head(b) == head(sb) and (not R(r"\(0\.8\)").search(l) or form(lambda f: True))
            if as_ and R(r": (row y|x \d+ leaves|shares row y)").search(l):  # a row line: its neighbours too
                as_ = form(lambda f: seq(g(f, "gridPosition", "y"), y))
            if as_ and R(r": y \d+, expected").search(l):  # a stack line: every field above
                as_ = form(lambda f: le(g(f, "gridPosition", "y"), y))
            if as_:
                carried.append((sc.group(0) if sc else m.group(0) if m else l.split(": ")[0] + ": ")[:-2])
            else:
                kept.append(l)
        out[:] = kept
        if carried:
            err(f"REMINDER {len(carried)} line(s) on what the source export carries unchanged — {', '.join(uniq(carried)[:8])}{', …' if len(carried) > 8 else ''}: left as exported; fix one only when the user asked to change it (0.10)")
    return "\n".join(out) if out else "form lint: OK"


# The members of a .mybpm.zip: (names, jsonl, meta); a file that is not a zip is taken as the text of
# data-*/0000001.mybpm itself (names and meta stay unknown).
def archive(file):
    with open(file, "rb") as h:
        b = h.read()
    if b[:4] != b"PK\x03\x04":
        return None, b.decode("utf-8", "replace"), U
    try:
        z = zipfile.ZipFile(file)
    except zipfile.BadZipFile:
        raise RuntimeError(f"{file}: no end of central directory — not a zip")
    names, read = [], {}
    with z:
        for info in z.infolist():
            names.append(info.filename)
            m = re.search(r"(^|/)data-[^/]*/(0000001|metadata)\.mybpm\Z", info.filename)
            if not m:
                continue
            if info.compress_type not in (0, 8):
                raise RuntimeError(f"{file}: {info.filename} uses zip method {info.compress_type}, only STORED and DEFLATED are read")
            read[m.group(2)] = z.read(info).decode("utf-8", "replace")
    if "0000001" not in read:
        raise RuntimeError(f"{file}: no data-*/0000001.mybpm inside (0.1)")
    return names, read["0000001"], read.get("metadata", U)


# Zip layout (0.1): exactly the two members, both in one data-*/ folder at the top.
def layout(names):
    if names is None:
        return []
    files = [n for n in names if not n.endswith("/")]
    d = re.match(r"(data-[^/]+)/", files[0] if files else "")
    ok = len(files) == 2 and d and all(n in (f"{d.group(1)}/0000001.mybpm", f"{d.group(1)}/metadata.mybpm") for n in files) and files[0] != files[1]
    return [] if ok else [f"FATAL zip holds {json.dumps(names, ensure_ascii=False, separators=(',', ':'))} — exactly data-<name>/0000001.mybpm and data-<name>/metadata.mybpm, one folder at the top (0.1)"]


# The document sits beside the skill folder in the claude.ai zip and at the repository root in a checkout
# or the installed plugin.
def doc_text(given):
    here = os.path.dirname(os.path.abspath(__file__))
    tries = [given] if given else [os.path.join(here, "..", "MYBPM-IMPORTS.md"), os.path.join(here, "..", "..", "..", "MYBPM-IMPORTS.md")]
    found = next((f for f in tries if os.path.exists(f)), None)
    if not found:
        raise RuntimeError(f"MYBPM-IMPORTS.md not found (tried {', '.join(tries)}) — pass its path as the second argument")
    with open(found, encoding="utf-8") as h:
        return h.read()


def main(argv):
    for st in (sys.stdout, sys.stderr):
        if hasattr(st, "reconfigure"):
            st.reconfigure(encoding="utf-8", errors="replace")
    sys.setrecursionlimit(20000)
    # --source <export>: the export this archive amends — lines on what it carries unchanged are left as exported (0.10)
    args, src = list(argv), None
    if "--source" in args:
        at = args.index("--source")
        src = args[at + 1] if at + 1 < len(args) else ""
        del args[at:at + 2]
    if not args or src == "":
        print("usage: python3 lint_archive.py <archive.mybpm.zip | 0000001.mybpm> [MYBPM-IMPORTS.md] [--source <the export it amends>]", file=sys.stderr)
        return 2
    try:
        names, jsonl, meta = archive(args[0])
        res = lint_archive(jsonl, doc_text(args[1] if len(args) > 1 else None), meta, archive(src)[1] if src else U)
    except Exception as e:  # noqa: BLE001 — one line, like the JS wrapper
        print(e, file=sys.stderr)
        return 2
    out = "\n".join([*layout(names), res])
    print(out)
    # Exit 1 while a defect line is left; REMINDER lines are answered in the report, not fixed in the file (0.10).
    return 1 if any(l and l != "form lint: OK" and not l.startswith("REMINDER") for l in out.split("\n")) else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
