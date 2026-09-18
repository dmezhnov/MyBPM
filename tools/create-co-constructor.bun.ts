#!/usr/bin/env bun
/**
 * Create a COMPOSITE object («составной объект», `boCategory: "BO_COMPOSITE"`) on a MyBPM stand the way
 * the constructor does it — no `.mybpm.zip` import, only `/web/v2/*` calls.
 *
 * A composite is the one kind with machinery of its own (MYBPM-UI-API.md §5e): its editor is
 * `/business-objects/editing/<coId>/composite-editing`, its controller is `v2/co`, and every edit goes
 * into a DRAFT which СОХРАНИТЬ commits.
 *
 *   1. v2/business-objects/load-bo-groups                        → resolve the target group
 *   2. v2/business-objects/create-bo {boGroupId, boCategory}      → the CO exists, named «Составной объект №N»
 *   3. v2/business-objects/save-business-object-portion           → rename (partial patch)
 *   4. v2/co/generate-draft {coId}                                → draftId  (NOT idempotent — trap 29)
 *   5. v2/co/add-bo-to-co {coId, draftId, boId}                   → one call per source BO
 *   6. v2/co/load-bo-fields-for-co {boId}                         → the source fields and their fieldIds
 *   7. v2/co/add-co-field-to-simple    {coId, draftId} + links[]  → a new attribute (one link)
 *      v2/co/add-co-field-to-composite {coId, draftId, coFieldId} + links[]  → extra links on that attribute
 *   8. v2/co/apply-and-remove-draft {draftId}                     → commit
 *
 * `links` is the whole point: one link → «Простые атрибуты», two or more → «Составные атрибуты».
 * The two lists are the same objects sorted by link count.
 *
 * Usage:
 *   bun tools/create-co-constructor.bun.ts --token-file <path> \
 *     --group  "Бизнес-объект" \
 *     --name   "Проба составной API 2026-09-18" \
 *     --source "Проба UI 2026-09-18" --source "Проба API-конструктор 2026-09-18" \
 *     --attr   "1:Наименование+2:Наименование" \
 *     --attr   "1:Чекбокс"
 *
 *   --attr "<src>:<field>[+<src>:<field>…]"  — `<src>` is the 1-based index of a --source,
 *                                              `<field>` the source field's LABEL (or `#<fieldId>`).
 *                                              Prefix with «Имя=» to rename the attribute afterwards.
 *   --source "@<boId>"                        — a source given by id instead of by name.
 *
 * Inspection modes (no writes):
 *   --list-bos                 every BO of the company as «id  category  group  name»
 *   --list-fields "<BO name>"  the source fields as `load-bo-fields-for-co` returns them
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
const has = (name: string) => argv.includes(`--${name}`);

const stand = flag("stand") ?? "<stand>";
const tokenFile = flag("token-file");
const token = (tokenFile ? (await Bun.file(tokenFile).text()).trim() : undefined)
  ?? flag("token") ?? Bun.env.MYBPM_TOKEN;
if (!token) {
  console.error("no token: pass --token-file <path> / --token <value> or set MYBPM_TOKEN");
  process.exit(1);
}

/** `/web/v2` envelope: params first, body second (MYBPM-UI-API.md §1). The body may be an array. */
async function call<T = any>(controller: string, method: string, params: object = {}, body: unknown = {}): Promise<T> {
  const res = await fetch(`https://${stand}/web/v2/${controller}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", token: token! },
    body: JSON.stringify({
      useParamsFromBody: true,
      params_Lr1oSgwPR8: params,
      body_o1nhHUG480: body,
    }),
  });
  const text = await res.text();
  if (!text) return null as T; // apply-and-remove-draft & co answer 200 with an empty body
  let json: any;
  try { json = JSON.parse(text); } catch { return text as T; } // generate-draft returns a bare string
  if (json && typeof json === "object" && !Array.isArray(json) && ("errorType" in json || "className" in json)) {
    // never print the ~100-line Java stackTrace (trap 26)
    throw new Error(`${controller}/${method}: ${json.errorType ?? json.className} ${json.message ?? ""} (traceId ${json.traceId ?? "-"})`);
  }
  return json as T;
}
const bo = <T = any>(m: string, p?: object, b?: unknown) => call<T>("business-objects", m, p, b);
const co = <T = any>(m: string, p?: object, b?: unknown) => call<T>("co", m, p, b);

/** save-business-object-portion chunks the JSON at 80 000 chars; each part carries the previous part's id. */
async function savePortion(payload: object): Promise<string | null> {
  const json = JSON.stringify(payload);
  const parts: string[] = [];
  for (let i = 0; i < json.length; i += 80_000) parts.push(json.slice(i, i + 80_000));
  let id: string | null = null;
  for (let i = 0; i < parts.length; i++) {
    id = await bo<string>("save-business-object-portion", {}, {
      jsonPart: parts[i], orderIndex: i, isLast: i === parts.length - 1, id,
    });
  }
  return id;
}

const langMap = (v: string) => ({ KAZ: null, ENG: null, RUS: v, QAZ: null });

type BoGroup = { id: string; name: string; code: string | null; orderIndex: number; kind: string };
type BoRecord = { id: string; name: string; boCategory: string; orderIndex: number };

const groups = await bo<BoGroup[]>("load-bo-groups");

/** Every BO of the company, group by group — the only cheap name → id index we have. */
async function allBos(): Promise<(BoRecord & { group: string })[]> {
  const out: (BoRecord & { group: string })[] = [];
  for (const g of groups) {
    // load-bo-records-by-group-id takes `groupId`, NOT `boGroupId` (trap 21)
    const recs = await bo<BoRecord[]>("load-bo-records-by-group-id", { groupId: g.id });
    for (const r of recs ?? []) out.push({ ...r, group: g.name });
  }
  return out;
}

if (has("list-bos")) {
  for (const b of await allBos()) console.log(`${b.id}\t${b.boCategory}\t${b.group}\t${b.name}`);
  process.exit(0);
}

const resolveBo = async (spec: string): Promise<{ id: string; name: string }> => {
  if (spec.startsWith("@")) return { id: spec.slice(1), name: spec };
  const hit = (await allBos()).filter(b => b.name === spec);
  if (hit.length === 0) throw new Error(`source BO not found: «${spec}» (--list-bos shows them)`);
  if (hit.length > 1) throw new Error(`source BO name is ambiguous: «${spec}» → ${hit.map(h => h.id).join(", ")}`);
  return hit[0];
};

if (has("list-fields")) {
  const src = await resolveBo(flag("list-fields")!);
  const fields = await co<any[]>("load-bo-fields-for-co", { boId: src.id });
  console.log(`${src.name}  ${src.id}`);
  for (const f of fields ?? []) {
    console.log(`  ${f.fieldId ?? f.id}\t${f.type ?? f.fieldType}\t${f.label ?? f.name}`);
  }
  process.exit(0);
}

const groupName = flag("group");
const name = flag("name");
const desc = flag("desc") ?? "";
const sources = flagAll("source");
// «[Имя=]<src>:<field>[+<src>:<field>…]»
const attrs = flagAll("attr").map(spec => {
  const eq = spec.indexOf("=");
  const label = eq > 0 && !spec.slice(0, eq).includes(":") ? spec.slice(0, eq) : undefined;
  const body = label === undefined ? spec : spec.slice(eq + 1);
  const links = body.split("+").map(part => {
    const colon = part.indexOf(":");
    const srcIdx = Number(part.slice(0, colon));
    if (!Number.isInteger(srcIdx) || srcIdx < 1 || srcIdx > sources.length) {
      throw new Error(`--attr «${spec}»: «${part.slice(0, colon)}» is not a 1-based --source index`);
    }
    return { srcIdx, field: part.slice(colon + 1) };
  });
  return { label, links };
});

if (!groupName || !name || sources.length === 0) {
  console.error("need --group <name|id>, --name <CO name> and at least one --source <BO name|@boId>");
  process.exit(1);
}

const group = groups.find(g => g.name === groupName || g.id === groupName);
if (!group) {
  console.error(`group not found: ${groupName}`);
  process.exit(1);
}

// 2. create — the CO exists on the stand from this moment on, under a generated name.
const created = await bo<{ id: string; name: string }>(
  "create-bo", {}, { boGroupId: group.id, boCategory: "BO_COMPOSITE" },
);
const coId = created.id;
console.log(`created  ${coId}  «${created.name}»  in «${group.name}»`);
const codeAtBirth = (await bo<any>("load-business-object-by-id", { businessObjectId: coId })).code;
console.log(`code@new  ${codeAtBirth}`);

// 3. rename — the same partial patch the plain constructor uses. §5e says the composite EDITOR's name
// input does not regenerate the code; this checks whether the BO-level writer behaves the same.
await savePortion({
  businessObject: {
    id: coId,
    nameMap: langMap(name),
    recordNameMap: langMap(name),
    description: desc,
  },
});
const codeAfterRename = (await bo<any>("load-business-object-by-id", { businessObjectId: coId })).code;
console.log(`code@rename ${codeAfterRename}${codeAfterRename === codeAtBirth ? "  (unchanged — as in the UI)" : "  (FOLLOWED THE NAME — unlike the UI)"}`);

// 4. draft — everything below is written into it; nothing is visible until apply-and-remove-draft.
const draftId = await co<string>("generate-draft", { coId });
console.log(`draft     ${draftId}`);

try {
  // 5. sources
  const srcBos: { id: string; name: string }[] = [];
  for (const s of sources) {
    const b = await resolveBo(s);
    await co("add-bo-to-co", { coId, draftId, boId: b.id });
    srcBos.push(b);
    console.log(`source    ${b.id}  «${b.name}»`);
  }

  // 6. the source fields, per source BO
  const srcFields = new Map<string, any[]>();
  for (const b of srcBos) srcFields.set(b.id, (await co<any[]>("load-bo-fields-for-co", { boId: b.id })) ?? []);

  const linkOf = (srcIdx: number, field: string) => {
    const b = srcBos[srcIdx - 1];
    const list = srcFields.get(b.id)!;
    const f = field.startsWith("#")
      ? list.find(x => (x.fieldId ?? x.id) === field.slice(1))
      : list.find(x => (x.label ?? x.name) === field);
    if (!f) throw new Error(`«${field}» is not a field of «${b.name}» (--list-fields shows them)`);
    return { boId: b.id, fieldId: f.fieldId ?? f.id };
  };

  // 7. attributes. add-co-field-to-simple creates ONE attribute per link in its body, so a composite
  // attribute is built as «create with the first link, then add the rest to it».
  const seen = async () => {
    const simple = (await co<any[]>("load-co-fields-simple", { coId, draftId })) ?? [];
    const composite = (await co<any[]>("load-co-fields-composite", { coId, draftId })) ?? [];
    return [...simple, ...composite];
  };

  for (const a of attrs) {
    const before = new Set((await seen()).map(f => f.coFieldId));
    await co("add-co-field-to-simple", { coId, draftId }, [linkOf(a.links[0].srcIdx, a.links[0].field)]);
    const fresh = (await seen()).filter(f => !before.has(f.coFieldId));
    if (fresh.length !== 1) throw new Error(`add-co-field-to-simple created ${fresh.length} attributes, expected 1`);
    const coFieldId = fresh[0].coFieldId;

    if (a.links.length > 1) {
      await co("add-co-field-to-composite", { coId, draftId, coFieldId },
        a.links.slice(1).map(l => linkOf(l.srcIdx, l.field)));
    }
    if (a.label) await co("change-co-field-label", { coId, draftId, coFieldId, label: a.label });
    console.log(`attr      ${coFieldId}  «${a.label ?? fresh[0].label}»  ${a.links.length} link(s)`);
  }

  // 8. commit
  await co("apply-and-remove-draft", { draftId });
  console.log(`applied   draft ${draftId}`);
} catch (e) {
  await co("remove-draft", { draftId }).catch(() => {});
  console.error(`draft ${draftId} removed after: ${(e as Error).message}`);
  process.exit(1);
}

// verify — reading the co fields needs a draft of its own; remove it right away (trap 29).
const after = await bo<any>("load-business-object-by-id", { businessObjectId: coId });
console.log(`name     «${after.name}»`);
console.log(`code      ${after.code}`);
console.log(`category  ${after.boCategory}`);
const check = await co<string>("generate-draft", { coId });
try {
  for (const f of (await co<any[]>("load-co-fields-composite", { coId, draftId: check })) ?? []) {
    console.log(`составной ${f.label} / ${f.code} / ${(f.links ?? []).length} links`);
  }
  for (const f of (await co<any[]>("load-co-fields-simple", { coId, draftId: check })) ?? []) {
    console.log(`простой   ${f.label} / ${f.code} / ${(f.links ?? []).length} links`);
  }
} finally {
  await co("remove-draft", { draftId: check });
}
console.log(`url       https://${stand}/business-objects/editing/${coId}/composite-editing`);
