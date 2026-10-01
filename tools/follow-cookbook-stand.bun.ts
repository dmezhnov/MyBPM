/**
 * A MyBPM stand client written FROM `MYBPM-UI-API.md` §0U AND NOTHING ELSE.
 *
 * Its purpose is the same as `follow-cookbook-script.bun.ts` for §0S: to prove that the cookbook is
 * self-sufficient. Nothing here is imported from the other `tools/*.bun.ts`; every path, every parameter and
 * every literal below was typed out of §0U by reading it as a third-party model would.
 *
 *     # R1 — create a BO with fields (dry run prints the requests, writes nothing)
 *     bun tools/follow-cookbook-stand.bun.ts --stand https://<stand> --token-file /tmp/t \
 *         --create-bo --group "Бизнес-объект" --name "Демо из кукбука" \
 *         --field "Наименование:INPUT_TEXT" --field "Сумма:INPUT_NUMBER" [--dry-run]
 *
 *     # R4 — read anything back
 *     bun tools/follow-cookbook-stand.bun.ts --stand … --token-file … --show <boId>
 *     bun tools/follow-cookbook-stand.bun.ts --stand … --token-file … --groups
 *
 *     # 0U.1 route A — log in and print the token
 *     bun tools/follow-cookbook-stand.bun.ts --stand … --login user@example.kz --password ***
 *
 * Other flags: --desc <text>, --category BO|BO_DICTIONARY|BO_PANEL|BO_COMPOSITE|BO_PROCESS (default BO),
 * --field "Метка:BO@<boId>" for a nested object, --print-requests (print the request log after a real run).
 */

const argv = Bun.argv.slice(2);
const flag = (n: string, d?: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const flagAll = (n: string) => argv.flatMap((a, i) => (a === `--${n}` ? [argv[i + 1]] : []));
const has = (n: string) => argv.includes(`--${n}`);

const args = {
  stand: (flag("stand") ?? "").replace(/\/+$/, ""),
  token: flag("token"),
  login: flag("login"), password: flag("password"),
  group: flag("group"), name: flag("name"), desc: flag("desc", "")!,
  category: flag("category", "BO")!,
  fields: flagAll("field"),
  dryRun: has("dry-run"),
};
if (!args.stand) { console.error("--stand https://<host> is required — an archive never carries it"); process.exit(2); }

type Req = { path: string; params: any; body: any };
const REQUEST_LOG: Req[] = [];          // every request, in order — what the dry run prints and what a diff compares

// Placeholder answers so that --dry-run can walk the whole recipe; they are NOT stand data.
let dryField = 0;
function dry(path: string): any {
  if (path.endsWith("/load-bo-groups")) return [{ id: "<group-id>", name: args.group, kind: "MANUAL" }];
  if (path.endsWith("/create-bo")) return { id: "<bo-id>" };
  if (path.endsWith("/save-business-object-portion")) return "<accumulator-id>";
  if (path.endsWith("/load-business-object-by-id")) return { id: "<bo-id>", name: args.name, formFields: [] };
  if (path.endsWith("/generate-business-form-field")) return { fieldId: `<field-id-${++dryField}>` };
  return null;
}

/** §0U.2: one envelope for every endpoint; errors arrive as HTTP 200 + errorType. */
async function call(path: string, params?: any, body?: any): Promise<any> {
  const payload = { useParamsFromBody: true, params_Lr1oSgwPR8: params ?? {}, body_o1nhHUG480: body ?? {} };
  REQUEST_LOG.push({ path, params: payload.params_Lr1oSgwPR8, body: payload.body_o1nhHUG480 });
  if (args.dryRun) return dry(path);
  const res = await fetch(`${args.stand}/web${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(args.token ? { token: args.token } : {}) },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  const text = await res.text();
  if (!text) return null;                                  // §0U.2: 200 with an empty body is a success
  const out = JSON.parse(text);
  if (out && typeof out === "object" && !Array.isArray(out) && ("errorType" in out || "className" in out))
    throw new Error(`${path}: ${out.errorType} ${out.message}`);   // never the stackTrace
  return out;
}

/** §0U R1 step 3: the four-language map the constructor sends. */
const langMap = (v: string | undefined) => ({ KAZ: null, ENG: null, RUS: v, QAZ: null });

/** §0U R1 step 7: jsonPart is a STRING of JSON, cut at 80 000 chars, each part carrying the
 *  accumulator id the previous call returned. */
async function savePortion(payload: any) {
  const js = JSON.stringify(payload);
  const parts: string[] = [];
  for (let i = 0; i < js.length; i += 80_000) parts.push(js.slice(i, i + 80_000));
  if (!parts.length) parts.push(js);
  let acc: any = null;
  for (let i = 0; i < parts.length; i++)
    acc = await call("/v2/business-objects/save-business-object-portion", {},
                     { jsonPart: parts[i], orderIndex: i, isLast: i === parts.length - 1, id: acc });
  return acc;
}

/** §0U.1 route A. The two keys are base64 of the words username/password; the values are base64 too. */
async function login() {
  const b64 = (v: string) => Buffer.from(v, "utf-8").toString("base64");
  return call("/v2/auth/v3/login", undefined, {
    "dXNlcm5hbWU=": b64(args.login!), "cGFzc3dvcmQ=": b64(args.password ?? ""),
    timeOffsetZoneInMinutes: -300, timezoneRegion: "Asia/Almaty",
    clientType: "WEB", userAgent: "curl", pushToken: null, clientVersion: "" });
}

/** §0U R1, steps 1-8. */
async function createBo() {
  const groups = await call("/v2/business-objects/load-bo-groups", {}, {});                      // 1
  const group = groups.find((g: any) => args.group === g.name || args.group === g.id);
  if (!group) { console.error(`group not found: ${args.group}`); process.exit(1); }

  const created = await call("/v2/business-objects/create-bo", {},                               // 2
                             { boGroupId: group.id, boCategory: args.category });
  const boId = created.id;

  await savePortion({ businessObject: {                                                         // 3
    id: boId, nameMap: langMap(args.name), recordNameMap: langMap(args.name), description: args.desc } });

  if (args.fields.length) {
    await Bun.sleep(args.dryRun ? 0 : 3000);                                                     // 4, trap 24
    const bo = await call("/v2/business-objects/load-business-object-by-id",                     // 5
                          { businessObjectId: boId }, {});
    const added: any[] = [];
    for (const [i, spec] of args.fields.entries()) {
      const cut = spec.lastIndexOf(":");
      const label = spec.slice(0, Math.max(cut, 0));
      let ftype = spec.slice(cut + 1), ref: string | undefined;
      if (ftype.includes("@")) [ftype, ref] = [ftype.slice(0, ftype.indexOf("@")), ftype.slice(ftype.indexOf("@") + 1)];
      // §0U R1 step 6: `fieldBoId` belongs in the params ONLY for a nested object (fieldType BO);
      // a null-valued parameter is not what the client sends — it omits the key.
      const params: any = { boId, fieldType: ftype };
      if (ref) params.fieldBoId = ref;
      const dto = await call("/v2/business-objects/generate-business-form-field", params, {});   // 6
      dto.label = label;
      dto.labelMap = langMap(label);
      dto.gridPosition = { x: 0, y: 4 * i, cols: 15, rows: ftype === "BO" ? 6 : 4 };
      added.push(dto);
    }
    bo.formFields = [...(bo.formFields ?? []), ...added];
    await savePortion({ businessObject: bo,                                                     // 7
                        editedFields: added.map((f) => ({ fieldId: f.fieldId, gridPosition: f.gridPosition,
                                                          needFreezeWhenScroll: false })),
                        addedFieldIds: added.map((f) => f.fieldId),
                        deletedFieldIds: [] });
  }

  return call("/v2/business-objects/load-business-object-by-id", { businessObjectId: boId }, {}); // 8
}

/** §0U R4. */
async function show(boId: string) {
  const bo = await call("/v2/business-objects/load-business-object-by-id", { businessObjectId: boId }, {});
  console.log(`${bo.id}  ${bo.boCategory}  code=${bo.code}  «${bo.name}»`);
  for (const f of bo.formFields ?? []) console.log(`  field  ${f.label} / ${f.code} / ${f.type}`);
}

// Keys sorted at every level, so two request logs diff line by line.
const sorted = (v: any): any =>
  Array.isArray(v) ? v.map(sorted)
  : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted(v[k])]))
  : v;

const tokenFile = flag("token-file");
if (tokenFile) {
  // §0U.1 route B: the localStorage value WITHOUT its JSON quotes
  args.token = (await Bun.file(tokenFile).text()).trim().replace(/^"|"$/g, "");
}

if (args.login) {
  console.log(await login());
} else if (has("groups")) {
  for (const g of await call("/v2/business-objects/load-bo-groups", {}, {})) console.log(`${g.id}\t${g.kind}\t${g.name}`);
} else if (flag("show")) {
  await show(flag("show")!);
} else if (has("create-bo")) {
  const bo = await createBo();
  if (!args.dryRun) {
    console.log(`${bo.id}  code=${bo.code}  «${bo.name}»`);
    console.log(`${args.stand}/business-objects/editing/${bo.id}/object-editing`);
  }
} else {
  console.error("nothing to do: pass --create-bo, --show, --groups or --login");
  process.exit(2);
}

if (args.dryRun || has("print-requests"))
  for (const r of REQUEST_LOG) console.log(JSON.stringify(sorted(r)));
