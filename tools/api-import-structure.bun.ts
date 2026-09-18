#!/usr/bin/env bun
/**
 * Imports a structure archive (.mybpm.zip) into a MyBPM stand THROUGH THE API — no browser UI.
 *
 * The flow mirrors what the Angular client does (chunk 5675, service with prefix `import-structure`):
 *   1. POST /web/import-structure/import-file        multipart, field `file`   -> importId
 *   2. POST /web/import-structure/insert-file-data   {importId}                -> processId, poll it
 *   3. POST /web/import-structure/analyze-file-data  {importId}                -> processId, poll it
 *   4. POST /web/import-structure/load-import-data / load-import-bo-infos / load-import-errors  (dry-run diff)
 *   5. POST /web/import-structure/save-import-description {importId, value}
 *   6. POST /web/v2/process-indicator/pre-create-process {}                    -> processId
 *      POST /web/import-structure/apply-import       {importId, processId}, poll the process
 * Steps 5-6 only run with --apply; without it the import stays in status ANALYZED (nothing written)
 * and --cancel sends /cancel-import.
 *
 * Token: the value of localStorage.LOCAL_PRIVATE_SwebToken **without the surrounding JSON quotes**.
 * Pass it in $MYBPM_TOKEN or in a file via --token-file.
 *
 * Usage:
 *   bun tools/api-import-structure.bun.ts <archive.mybpm.zip> [--stand https://<stand>]
 *        [--token-file PATH] [--apply] [--cancel] [--description "текст"] [--import-id ID]
 */

const argv = Bun.argv.slice(2);
function opt(name: string, fallback?: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
}
const has = (name: string) => argv.includes(`--${name}`);

const archive = argv[0] && !argv[0].startsWith("--") ? argv[0] : undefined;
if (!archive) {
  console.error("usage: bun tools/api-import-structure.bun.ts <archive.mybpm.zip> [--apply] [--cancel]");
  process.exit(2);
}

const stand = opt("stand", "https://<stand>")!;
const tokenFile = opt("token-file");
const token = (tokenFile ? await Bun.file(tokenFile).text() : Bun.env.MYBPM_TOKEN ?? "").trim().replace(/^"|"$/g, "");
if (!token) {
  console.error("no token: set $MYBPM_TOKEN or pass --token-file PATH");
  process.exit(2);
}

const WEB = `${stand}/web`;

/** The platform's JSON envelope: params go in one magic key, the body in another. */
async function postJson(path: string, body: unknown = {}, params: unknown = {}): Promise<any> {
  const res = await fetch(`${WEB}${path}`, {
    method: "POST",
    headers: { token, "Content-Type": "application/json" },
    body: JSON.stringify({
      useParamsFromBody: true,
      params_Lr1oSgwPR8: params,
      body_o1nhHUG480: body,
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`POST ${path} -> ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

/** postFileJson: multipart/form-data, the file under the field name `file`, params as plain fields. */
async function postFile(path: string, file: Blob, name: string, params: Record<string, string> = {}): Promise<any> {
  const fd = new FormData();
  for (const [k, v] of Object.entries(params)) fd.append(k, v);
  fd.append("file", file, name);
  const res = await fetch(`${WEB}${path}`, { method: "POST", headers: { token }, body: fd });
  const text = await res.text();
  if (!res.ok) throw new Error(`POST ${path} -> ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

/** The progress toast behind every long operation: poll until isFinished. */
async function waitProcess(processId: string | null, what: string): Promise<any> {
  if (!processId) return null;
  for (let i = 0; i < 150; i++) {
    const st = await postJson("/v2/process-indicator/load-state-short", {}, { processId });
    if (st?.isFinished) {
      console.log(`  ${what}: finished (${st.label ?? ""} ${Math.floor(st.percentage ?? 100)}%)`);
      return st;
    }
    await Bun.sleep(1000);
  }
  throw new Error(`${what}: process ${processId} did not finish in 150 s`);
}

const bytes = await Bun.file(archive).arrayBuffer();
const fileName = archive.split("/").pop()!;
console.log(`stand ${stand}\narchive ${fileName} (${bytes.byteLength} bytes)`);

const state = await postJson("/import-structure/load-import-state");
console.log("import state:", JSON.stringify(state));

/** `--import-id ID` resumes an already analysed import (upload+analyse are not repeatable while one is open). */
let importId = opt("import-id");
if (importId) {
  console.log("1-3. skipped, resuming importId", JSON.stringify(importId));
} else {
  if (state?.importExists) {
    console.error(`an import is already open on this stand (importId ${state.importId}, file ${state.fileName}) —` +
      " apply it with --import-id, drop it with --import-id … --cancel, or finish it in the UI");
    process.exit(1);
  }

  importId = await postFile("/import-structure/import-file", new Blob([bytes]), fileName);
  console.log("1. import-file -> importId", JSON.stringify(importId));

  const insertProcess = await postJson("/import-structure/insert-file-data", {}, { importId });
  console.log("2. insert-file-data -> processId", JSON.stringify(insertProcess));
  await waitProcess(insertProcess, "insert");

  const analyzeProcess = await postJson("/import-structure/analyze-file-data", {}, { importId });
  console.log("3. analyze-file-data -> processId", JSON.stringify(analyzeProcess));
  await waitProcess(analyzeProcess, "analyze");
}

const data = await postJson("/import-structure/load-import-data", {}, { importId });
console.log("4. load-import-data:", JSON.stringify(data));
const errors = await postJson("/import-structure/load-import-errors", {}, { importId, pageId: null });
console.log("   load-import-errors:", JSON.stringify(errors));
const boInfos = await postJson("/import-structure/load-import-bo-infos", { importId });
console.log("   load-import-bo-infos:", JSON.stringify(boInfos));

if (has("cancel")) {
  console.log("5. cancel-import:", JSON.stringify(await postJson("/import-structure/cancel-import", {}, { importId })));
  process.exit(0);
}
if (!has("apply")) {
  console.log("\nanalysed only (status ANALYZED, nothing written). Re-run with --apply, or --cancel to drop it.");
  process.exit(0);
}

const description = opt("description", `API-импорт ${fileName}`)!;
console.log(
  "5. save-import-description:",
  JSON.stringify(await postJson("/import-structure/save-import-description", {}, { importId, value: description })),
);

const applyProcessId = await postJson("/v2/process-indicator/pre-create-process");
console.log("6. pre-create-process -> processId", JSON.stringify(applyProcessId));
const applied = await postJson("/import-structure/apply-import", {}, { importId, processId: applyProcessId });
console.log("   apply-import ->", JSON.stringify(applied));
await waitProcess(applyProcessId, "apply");

console.log("   load-import-file-record:", JSON.stringify(await postJson("/import-structure/load-import-file-record", {}, { importId })));
