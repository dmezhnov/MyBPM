/**
 * Template of skills/mybpm-imports/scripts/lint-archive.js — `mise run skills-gen` replaces the marker line
 * below with the `lintArchive` block of MYBPM-IMPORTS.md 0.10 and writes the result into the skill, so the
 * skill ships the form lint ready to run instead of a snippet a model must copy. Edit the lint in the
 * document, the command-line wrapper here; never edit the generated file.
 *
 * Node built-ins only: it must run under any Node >= 18 (the claude.ai sandbox) and under Bun. The file ships as
 * .js, not .cjs (the Gemini skill upload refuses .cjs), and a .js runs as an ES module under a package.json with
 * "type": "module" — so no require, module or __dirname: built-ins come by import(), the folder from argv[1].
 */
//@@HEADER@@
"use strict";
let fs, path, zlib;

//@@LINT_ARCHIVE@@

// The members of a .mybpm.zip (STORED or DEFLATED, no zip64): { names, jsonl, meta }; a file that is not a zip
// is taken as the text of data-*/0000001.mybpm itself (names and meta stay unknown).
function archive(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32LE(0) !== 0x04034b50) return { names: null, jsonl: b.toString("utf8"), meta: undefined };
  let eocd = b.length - 22;
  while (eocd >= 0 && b.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error(`${file}: no end of central directory — not a zip`);
  const names = [], read = {};
  let p = b.readUInt32LE(eocd + 16);
  for (let i = 0, n = b.readUInt16LE(eocd + 10); i < n; i++) {
    const method = b.readUInt16LE(p + 10), size = b.readUInt32LE(p + 20), nameLen = b.readUInt16LE(p + 28);
    const local = b.readUInt32LE(p + 42), name = b.toString("utf8", p + 46, p + 46 + nameLen);
    p += 46 + nameLen + b.readUInt16LE(p + 30) + b.readUInt16LE(p + 32);
    names.push(name);
    const m = /(^|\/)data-[^/]*\/(0000001|metadata)\.mybpm$/.exec(name);
    if (!m) continue;
    const start = local + 30 + b.readUInt16LE(local + 26) + b.readUInt16LE(local + 28), raw = b.subarray(start, start + size);
    if (method !== 0 && method !== 8) throw new Error(`${file}: ${name} uses zip method ${method}, only STORED and DEFLATED are read`);
    read[m[2]] = (method === 0 ? raw : zlib.inflateRawSync(raw)).toString("utf8");
  }
  if (read["0000001"] === undefined) throw new Error(`${file}: no data-*/0000001.mybpm inside (0.1)`);
  return { names, jsonl: read["0000001"], meta: read.metadata };
}

// Zip layout (0.1): exactly the two members, both in one data-*/ folder at the top.
function layout(names) {
  if (!names) return [];
  const files = names.filter((n) => !n.endsWith("/")), dir = /^(data-[^/]+)\//.exec(files[0] ?? "")?.[1];
  const ok = files.length === 2 && dir && files.every((n) => n === `${dir}/0000001.mybpm` || n === `${dir}/metadata.mybpm`) && files[0] !== files[1];
  return ok ? [] : [`FATAL zip holds ${JSON.stringify(names)} — exactly data-<name>/0000001.mybpm and data-<name>/metadata.mybpm, one folder at the top (0.1)`];
}

// The document sits beside the skill folder in the claude.ai zip and at the repository root in a checkout
// or the installed plugin.
function docText(given) {
  const here = path.dirname(path.resolve(process.argv[1]));
  const tries = given ? [given] : [path.join(here, "..", "MYBPM-IMPORTS.md"), path.join(here, "..", "..", "..", "MYBPM-IMPORTS.md")];
  const found = tries.find((f) => fs.existsSync(f));
  if (!found) throw new Error(`MYBPM-IMPORTS.md not found (tried ${tries.join(", ")}) — pass its path as the second argument`);
  return fs.readFileSync(found, "utf8");
}

// import() works in both module kinds; top-level await would not parse as CommonJS.
(async () => {
  [fs, path, zlib] = await Promise.all([import("node:fs"), import("node:path"), import("node:zlib")]);
  // --source <export>: the export this archive amends — lines on what it carries unchanged are left as exported (0.10)
  const args = process.argv.slice(2), at = args.indexOf("--source"), src = at < 0 ? undefined : args.splice(at, 2)[1];
  const [file, doc] = args;
  if (!file || (at >= 0 && !src)) {
    console.error("usage: node lint-archive.js <archive.mybpm.zip | 0000001.mybpm> [MYBPM-IMPORTS.md] [--source <the export it amends>]");
    process.exit(2);
  }
  const a = archive(file), out = [...layout(a.names), lintArchive(a.jsonl, docText(doc), a.meta, src && archive(src).jsonl)].join("\n");
  console.log(out);
  // Exit 1 while a defect line is left; REMINDER lines are answered in the report, not fixed in the file (0.10).
  process.exit(out.split("\n").some((l) => l && l !== "form lint: OK" && !l.startsWith("REMINDER")) ? 1 : 0);
})().catch((e) => { console.error(e && e.message || e); process.exit(2); });
