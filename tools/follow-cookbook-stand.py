#!/usr/bin/env python3
"""
A MyBPM stand client written FROM `MYBPM-UI-API.md` §0U AND NOTHING ELSE.

Its purpose is the same as `follow-cookbook-script.py` for §0S: to prove that the cookbook is
self-sufficient. Nothing here is imported from `tools/*.bun.ts`; every path, every parameter and every
literal below was typed out of §0U by reading it as a third-party model would.

    # R1 — create a BO with fields (dry run prints the requests, writes nothing)
    python3 tools/follow-cookbook-stand.py --stand https://<stand> --token-file /tmp/t \
        --create-bo --group "Бизнес-объект" --name "Демо из кукбука" \
        --field "Наименование:INPUT_TEXT" --field "Сумма:INPUT_NUMBER" [--dry-run]

    # R4 — read anything back
    python3 tools/follow-cookbook-stand.py --stand … --token-file … --show <boId>
    python3 tools/follow-cookbook-stand.py --stand … --token-file … --groups

    # 0U.1 route A — log in and print the token
    python3 tools/follow-cookbook-stand.py --stand … --login user@example.kz --password ***
"""
import argparse, base64, json, sys, time, urllib.request

REQUEST_LOG = []          # every request, in order — what the dry run prints and what a diff compares


def call(args, path, params=None, body=None):
    """§0U.2: one envelope for every endpoint; errors arrive as HTTP 200 + errorType."""
    payload = {"useParamsFromBody": True,
               "params_Lr1oSgwPR8": params if params is not None else {},
               "body_o1nhHUG480": body if body is not None else {}}
    REQUEST_LOG.append({"path": path, "params": payload["params_Lr1oSgwPR8"],
                        "body": payload["body_o1nhHUG480"]})
    if args.dry_run:
        return DRY.get(path)
    req = urllib.request.Request(
        f"{args.stand}/web{path}", method="POST",
        headers={"Content-Type": "application/json", **({"token": args.token} if args.token else {})},
        data=json.dumps(payload, ensure_ascii=False).encode())
    text = urllib.request.urlopen(req).read().decode()
    if not text:
        return None                                    # §0U.2: 200 with an empty body is a success
    out = json.loads(text)
    if isinstance(out, dict) and ("errorType" in out or "className" in out):
        raise RuntimeError(f"{path}: {out.get('errorType')} {out.get('message')}")   # never the stackTrace
    return out


DRY = {}   # canned answers so that --dry-run can walk the whole recipe


def lang_map(v):
    """§0U R1 step 3: the four-language map the constructor sends."""
    return {"KAZ": None, "ENG": None, "RUS": v, "QAZ": None}


def save_portion(args, payload):
    """§0U R1 step 7: jsonPart is a STRING of JSON, cut at 80 000 chars, each part carrying the
    accumulator id the previous call returned."""
    js = json.dumps(payload, ensure_ascii=False)
    parts = [js[i:i + 80_000] for i in range(0, len(js), 80_000)] or [js]
    acc = None
    for i, part in enumerate(parts):
        acc = call(args, "/v2/business-objects/save-business-object-portion", {},
                   {"jsonPart": part, "orderIndex": i, "isLast": i == len(parts) - 1, "id": acc})
    return acc


def login(args):
    """§0U.1 route A. The two keys are base64 of the words username/password; the values are base64 too."""
    b64 = lambda v: base64.b64encode(v.encode("utf-8")).decode()
    return call(args, "/v2/auth/v3/login", None, {
        "dXNlcm5hbWU=": b64(args.login), "cGFzc3dvcmQ=": b64(args.password),
        "timeOffsetZoneInMinutes": -300, "timezoneRegion": "Asia/Almaty",
        "clientType": "WEB", "userAgent": "curl", "pushToken": None, "clientVersion": ""})


def create_bo(args):
    """§0U R1, steps 1-8."""
    groups = call(args, "/v2/business-objects/load-bo-groups", {}, {})                        # 1
    group = next((g for g in groups if args.group in (g["name"], g["id"])), None)
    if not group:
        sys.exit(f"group not found: {args.group}")

    created = call(args, "/v2/business-objects/create-bo", {},                                # 2
                   {"boGroupId": group["id"], "boCategory": args.category})
    bo_id = created["id"]

    save_portion(args, {"businessObject": {                                                   # 3
        "id": bo_id, "nameMap": lang_map(args.name), "recordNameMap": lang_map(args.name),
        "description": args.desc}})

    if args.fields:
        time.sleep(0 if args.dry_run else 3)                                                  # 4, trap 24
        bo = call(args, "/v2/business-objects/load-business-object-by-id",                    # 5
                  {"businessObjectId": bo_id}, {})
        added = []
        for i, spec in enumerate(args.fields):
            label, _, ftype = spec.rpartition(":")
            ref = None
            if "@" in ftype:
                ftype, ref = ftype.split("@", 1)
            # §0U R1 step 6: `fieldBoId` belongs in the params ONLY for a nested object (fieldType BO);
            # a null-valued parameter is not what the client sends — it omits the key.
            params = {"boId": bo_id, "fieldType": ftype}
            if ref:
                params["fieldBoId"] = ref
            dto = call(args, "/v2/business-objects/generate-business-form-field", params, {})   # 6
            dto["label"] = label
            dto["labelMap"] = lang_map(label)
            dto["gridPosition"] = {"x": 0, "y": 4 * i, "cols": 15, "rows": 6 if ftype == "BO" else 4}
            added.append(dto)
        bo["formFields"] = (bo.get("formFields") or []) + added
        save_portion(args, {"businessObject": bo,                                             # 7
                            "editedFields": [{"fieldId": f["fieldId"], "gridPosition": f["gridPosition"],
                                              "needFreezeWhenScroll": False} for f in added],
                            "addedFieldIds": [f["fieldId"] for f in added],
                            "deletedFieldIds": []})

    after = call(args, "/v2/business-objects/load-business-object-by-id",                      # 8
                 {"businessObjectId": bo_id}, {})
    return after


def show(args, bo_id):
    """§0U R4."""
    bo = call(args, "/v2/business-objects/load-business-object-by-id", {"businessObjectId": bo_id}, {})
    print(f'{bo["id"]}  {bo.get("boCategory")}  code={bo.get("code")}  «{bo.get("name")}»')
    for f in bo.get("formFields") or []:
        print(f'  field  {f.get("label")} / {f.get("code")} / {f.get("type")}')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stand", required=True, help="https://<host> — an archive never carries it")
    ap.add_argument("--token"); ap.add_argument("--token-file")
    ap.add_argument("--login"); ap.add_argument("--password")
    ap.add_argument("--groups", action="store_true")
    ap.add_argument("--show")
    ap.add_argument("--create-bo", action="store_true")
    ap.add_argument("--group"); ap.add_argument("--name"); ap.add_argument("--desc", default="")
    ap.add_argument("--category", default="BO",
                    help="BO | BO_DICTIONARY | BO_PANEL | BO_COMPOSITE | BO_PROCESS")
    ap.add_argument("--field", action="append", dest="fields", default=[],
                    help='"Метка:INPUT_TEXT" or "Метка:BO@<boId>" for a nested object')
    ap.add_argument("--dry-run", action="store_true", help="print the requests, send nothing")
    ap.add_argument("--print-requests", action="store_true")
    args = ap.parse_args()

    args.stand = args.stand.rstrip("/")
    if args.token_file:
        # §0U.1 route B: the localStorage value WITHOUT its JSON quotes
        args.token = open(args.token_file, encoding="utf-8").read().strip().strip('"')

    if args.login:
        print(login(args))
    elif args.groups:
        for g in call(args, "/v2/business-objects/load-bo-groups", {}, {}):
            print(f'{g["id"]}\t{g["kind"]}\t{g["name"]}')
    elif args.show:
        show(args, args.show)
    elif args.create_bo:
        bo = create_bo(args)
        if not args.dry_run:
            print(f'{bo["id"]}  code={bo.get("code")}  «{bo.get("name")}»')
            print(f'{args.stand}/business-objects/editing/{bo["id"]}/object-editing')
    else:
        ap.error("nothing to do: pass --create-bo, --show, --groups or --login")

    if args.dry_run or args.print_requests:
        for r in REQUEST_LOG:
            print(json.dumps(r, ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()
