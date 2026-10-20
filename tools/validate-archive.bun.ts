#!/usr/bin/env bun
/**
 * Grader for a `.mybpm.zip` structure archive — a thin wrapper over the form lint of `MYBPM-IMPORTS.md`
 * 0.10 (`lintArchive`, taken from the document itself, so the working copy's rules are the ones applied).
 * The lint is the one checker; this file only reads the zip, checks its layout (0.1) and maps the lint lines
 * to severities for the eval scripts (tools/grade-eval.bun.ts, tools/score-eval-crm.bun.ts):
 *   FATAL — a `FATAL …` lint line or a broken zip layout: the import fails outright
 *   ERROR — every other lint line: the import builds something other than asked
 *   WARN  — a `REMINDER …` line: answered in the report, not a defect by itself
 *
 *   bun tools/validate-archive.bun.ts <file.mybpm.zip> [--json] [--source <the export it amends>]
 */
import { unzip } from "./zip.ts";

type Sev = "FATAL" | "ERROR" | "WARN";
const ROOT = import.meta.dir + "/..";
const arg = (n: string) => { const i = Bun.argv.indexOf(n); return i > 0 ? Bun.argv[i + 1] : undefined; };
const sourcePath = arg("--source");
const file = Bun.argv.slice(2).find((a, i, all) => !a.startsWith("--") && all[i - 1] !== "--source");
const asJson = Bun.argv.includes("--json");
if (!file) { console.error("usage: validate-archive.bun.ts <file.mybpm.zip> [--json] [--source <export.mybpm.zip>]"); process.exit(2); }

const doc = await Bun.file(`${ROOT}/MYBPM-IMPORTS.md`).text();
const block = doc.match(/```js\n(function lintArchive[\s\S]*?\n)```/)?.[1];
if (!block) { console.error("MYBPM-IMPORTS.md 0.10: no lintArchive block"); process.exit(2); }
const lintArchive = new Function(`${block}\nreturn lintArchive;`)() as (jsonl: string, doc: string, meta?: string, source?: string) => string;

const found: { sev: Sev; rule: string; msg: string }[] = [];
const add = (sev: Sev, msg: string) => found.push({ sev, rule: /\(([^()]*)\)\s*$/.exec(msg)?.[1] ?? "", msg });

/** The members of a zip by name, or null when it is not one. */
async function members(path: string): Promise<Map<string, string> | null> {
  try {
    return new Map(unzip(new Uint8Array(await Bun.file(path).arrayBuffer())).map((e) => [e.name, new TextDecoder().decode(e.data)]));
  } catch { return null; }
}

let lines = 0;
const m = await members(file);
if (!m) add("FATAL", "not a readable zip (0.1)");
else {
  const names = [...m.keys()].filter((n) => !n.endsWith("/")), dir = /^(data-[^/]+)\//.exec(names[0] ?? "")?.[1];
  if (!(names.length === 2 && dir && names.includes(`${dir}/0000001.mybpm`) && names.includes(`${dir}/metadata.mybpm`)))
    add("FATAL", `zip holds ${JSON.stringify(names)} — exactly data-<name>/0000001.mybpm and data-<name>/metadata.mybpm, one folder at the top (0.1)`);
  const pick = (mm: Map<string, string>, base: string) => [...mm].find(([n]) => /(^|\/)data-[^/]*\//.test(n) && n.endsWith(`/${base}`))?.[1];
  const jsonl = pick(m, "0000001.mybpm");
  if (jsonl === undefined) add("FATAL", "no data-*/0000001.mybpm inside (0.1)");
  else {
    lines = jsonl.split("\n").filter((l) => l.trim()).length;
    const src = sourcePath ? await members(sourcePath) : null;
    if (sourcePath && !src) { console.error(`${sourcePath}: not a readable zip`); process.exit(2); }
    for (const l of lintArchive(jsonl, doc, pick(m, "metadata.mybpm"), src ? pick(src, "0000001.mybpm") : undefined).split("\n"))
      if (l !== "form lint: OK") add(l.startsWith("FATAL ") ? "FATAL" : l.startsWith("REMINDER ") ? "WARN" : "ERROR", l);
  }
}

const counts = { FATAL: 0, ERROR: 0, WARN: 0 } as Record<Sev, number>;
for (const f of found) counts[f.sev]++;
if (asJson) console.log(JSON.stringify({ file, lines, counts, findings: found }, null, 2));
else {
  console.log(`\n=== ${file}`);
  console.log(`lines: ${lines}  |  FATAL ${counts.FATAL}  ERROR ${counts.ERROR}  WARN ${counts.WARN}`);
  for (const sev of ["FATAL", "ERROR", "WARN"] as Sev[])
    for (const f of found.filter((x) => x.sev === sev)) console.log(`  [${sev}] ${f.msg.replace(/^(FATAL|REMINDER) /, "")}`);
  if (!found.length) console.log("  form lint: OK");
}
process.exit(counts.FATAL ? 1 : 0);
