#!/usr/bin/env bun
/**
 * Adds Block IDE scripts to an already generated structure archive: appends one
 * `BoScriptVersionsStructDto` (the wiring) plus one `ScriptDefStructDto` per body, so the import
 * CREATES the scripts on the stand — see MYBPM-IMPORTS.md §5d.
 *
 * The bodies are lifted out of another export (`--from`), because a def is far easier to copy than to
 * write: `--def <scriptIdSuffix>:onOpen|afterSave|onClose|onCreate|field:<fieldCode>` picks the def whose
 * `compositeId` ends with that script id and wires it onto the hook named after the colon.
 *
 * Or the bodies are GENERATED: `--bodies <file.json>` takes `{"<hook>": {entry, blocks, expressions}}` with the
 * hook keys of `--def` (`onOpen`, `field:<fieldCode>` …) and each body in the CLIPBOARD form of Part II (`type`,
 * `valueType`); it is rewritten into the archive form (`@class` …Struct, `valueTypeStruct`) — §5d. Each body must
 * be a whole hook script: its `BlockFixEntryPoint` hat, the statements, a closing `BlockExit FROM_METHOD`.
 *
 * MIND §5d: a `K-DYN` actId embeds the SOURCE field code (`F-code-K-DYN-S-boi_fields`). Moving a body to a
 * BO with different field codes needs `--rename-act code=Kod`, otherwise the import succeeds and the
 * script is silently broken — check it afterwards with `v2/script/translate-script` (MYBPM-UI-API.md §5g).
 *
 * Usage:
 *   bun tools/add-bo-scripts.bun.ts <in.mybpm.zip> <out.mybpm.zip> \
 *     --bo-code Proba_skript_arhiv_20260918 --bo-name "Проба скрипт архивом 2026-09-18" \
 *     --from <some-export>.mybpm.zip \
 *     --def s1BJw7CmFKAU2Cty:onOpen --def "DlQXUgrNRYPh@IQv:field:Kod" --rename-act code=Kod
 *   bun tools/add-bo-scripts.bun.ts <in.mybpm.zip> <out.mybpm.zip> --bo-code C --bo-name N --bodies bodies.json
 */
import { createHash } from "node:crypto"; // sha256 keeps the generated ids reproducible; Bun.hash is not a digest
import { mkdtempSync } from "node:fs";    // Bun has no mktemp helper
import { tmpdir } from "node:os";         // platform temp root

const argv = Bun.argv.slice(2);
const flag = (n: string, d?: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const flagAll = (n: string) => argv.flatMap((a, i) => (a === `--${n}` ? [argv[i + 1]] : []));

const inZip = argv[0], outZip = argv[1];
const boCode = flag("bo-code"), boName = flag("bo-name");
const boCategory = flag("bo-category", "BO")!;
const from = flag("from");
const defs = flagAll("def");
const bodiesFile = flag("bodies");
if (!inZip || !outZip || !boCode || !boName || (!(from && defs.length) && !bodiesFile)) {
  console.error("usage: bun tools/add-bo-scripts.bun.ts <in.zip> <out.zip> --bo-code C --bo-name N --from export.zip --def <scriptId>:<hook> …");
  process.exit(2);
}

function id16(seed: string): string {
  const h = createHash("sha256").update(seed).digest();
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@~";
  let s = "";
  for (let i = 0; i < 16; i++) s += alphabet[h[i] % alphabet.length];
  return s;
}
const zipdir = `${import.meta.dir}/zipdir.py`;
async function unzipTo(zip: string, dir: string) {
  await Bun.$`python3 -c ${"import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])"} ${zip} ${dir}`.quiet();
}

// ---- the source bodies
let srcText = "";
if (from) {
  const srcDir = mkdtempSync(`${tmpdir()}/mybpm-src-`);
  await unzipTo(from, srcDir);
  const srcInner = (await Bun.$`ls ${srcDir}`.text()).trim().split("\n")[0];
  srcText = await Bun.file(`${srcDir}/${srcInner}/0000001.mybpm`).text();
}
// `--rename-act old=new` retargets every `K-DYN` act (§5d) from the source field code to the target one.
for (const r of flagAll("rename-act")) {
  const [a, b] = r.split("=");
  srcText = srcText.replaceAll(`F-${a}-K-DYN-`, `F-${b}-K-DYN-`);
}
const srcDefs = new Map<string, any>();
for (const line of srcText.split("\n").filter(Boolean)) {
  const o = JSON.parse(line);
  if (o["@class"].endsWith("ScriptDefStructDto")) srcDefs.set(o.compositeId.slice(o.compositeId.indexOf("-") + 1), o);
}

// ---- the wiring: a fresh id per hook, the version id only ties this archive together (§5d)
const verId = id16(`${boCode}-versions`);
const hookKey: Record<string, string> = {
  onOpen: "onOpenFormScriptId", afterSave: "afterSaveScriptId",
  onClose: "onCloseScriptId", onCreate: "onInstanceCreationId",
};
const work: any = {
  onOpenFormScriptId: id16(`${boCode}-onOpen`), afterSaveScriptId: id16(`${boCode}-afterSave`),
  onCloseScriptId: id16(`${boCode}-onClose`), onInstanceCreationId: id16(`${boCode}-onCreate`),
  methodScriptIds: [], fieldScripts: {}, scriptDefIds: [],
};
// clipboard form (Part II) → archive form (§5d): `type` → `@class`, `valueType` → `valueTypeStruct`
const PKG = "kz.greetgo.mybpm.reg.structure.model.bo.process";
const toStruct = (o: any, kind: "block" | "expr") => {
  const { type, valueType, ...rest } = o;
  return { "@class": `${PKG}.${kind}.${type}Struct`, ...rest, ...(valueType ? { valueTypeStruct: { isArray: false, ...valueType } } : {}) };
};
const specs = [...defs];
if (bodiesFile) {
  const bodies = await Bun.file(bodiesFile).json();
  for (const [hook, b] of Object.entries<any>(bodies)) {
    const key = `@generated${specs.length}`;
    srcDefs.set(key, {
      "@class": "kz.greetgo.mybpm.reg.structure.model.dto.ScriptDefStructDto",
      blocks: Object.fromEntries(Object.entries<any>(b.blocks).map(([k, v]) => [k, toStruct(v, "block")])),
      expressions: Object.fromEntries(Object.entries<any>(b.expressions).map(([k, v]) => [k, toStruct(v, "expr")])),
    });
    specs.push(`${key}:${hook}`);
  }
}
const defLines: any[] = [];
for (const spec of specs) {
  const [srcId, hook, fieldCode] = spec.split(":");
  const body = srcDefs.get(srcId);
  if (!body) throw new Error(`--def ${spec}: no ScriptDefStructDto ending with ${srcId} in ${from}`);
  let scriptId: string;
  if (hook === "field") {
    if (!fieldCode) throw new Error(`--def ${spec}: "field" needs a field code`);
    scriptId = id16(`${boCode}-field-${fieldCode}`);
    work.fieldScripts[fieldCode] = scriptId;      // archive = by CODE, the stand stores it by field id
  } else {
    if (!hookKey[hook]) throw new Error(`--def ${spec}: unknown hook ${hook}`);
    scriptId = work[hookKey[hook]];
  }
  work.scriptDefIds.push(`${verId}-${scriptId}`);
  defLines.push({ ...body, compositeId: `${verId}-${scriptId}` });
}
const versions = {
  "@class": "kz.greetgo.mybpm.reg.structure.model.dto.BoScriptVersionsStructDto",
  ownerBoInfo: { code: boCode, name: boName, boCategory },
  workScripts: work,
};

// ---- rebuild: the same inner folder, the extra lines, objectCount bumped
const work2 = mkdtempSync(`${tmpdir()}/mybpm-out-`);
await unzipTo(inZip, work2);
const inner = (await Bun.$`ls ${work2}`.text()).trim().split("\n")[0];
const jsonl = `${work2}/${inner}/0000001.mybpm`;
const lines = (await Bun.file(jsonl).text()).split("\n").filter(Boolean);
lines.push(JSON.stringify(versions), ...defLines.map((d) => JSON.stringify(d)));
await Bun.write(jsonl, lines.join("\n") + "\n");
await Bun.write(`${work2}/${inner}/metadata.mybpm`, `objectCount-${lines.length}`);
await Bun.$`python3 ${zipdir} ${work2} ${outZip} ${inner}`.quiet();

console.log(outZip);
console.log(`  lines: ${lines.length}; versionId ${verId}`);
for (const d of defLines) console.log(`  def ${d.compositeId}`);
