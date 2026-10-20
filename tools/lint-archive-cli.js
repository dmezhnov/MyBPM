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

// The text of data-*/0000001.mybpm from a .mybpm.zip (STORED or DEFLATED members, no zip64), or the file
// itself when it is not a zip.
function archiveText(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32LE(0) !== 0x04034b50) return b.toString("utf8");
  let eocd = b.length - 22;
  while (eocd >= 0 && b.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error(`${file}: no end of central directory — not a zip`);
  let p = b.readUInt32LE(eocd + 16);
  for (let i = 0, n = b.readUInt16LE(eocd + 10); i < n; i++) {
    const method = b.readUInt16LE(p + 10), size = b.readUInt32LE(p + 20), nameLen = b.readUInt16LE(p + 28);
    const local = b.readUInt32LE(p + 42), name = b.toString("utf8", p + 46, p + 46 + nameLen);
    p += 46 + nameLen + b.readUInt16LE(p + 30) + b.readUInt16LE(p + 32);
    if (!/(^|\/)data-[^/]*\/0000001\.mybpm$/.test(name)) continue;
    const start = local + 30 + b.readUInt16LE(local + 26) + b.readUInt16LE(local + 28), raw = b.subarray(start, start + size);
    if (method === 0) return raw.toString("utf8");
    if (method === 8) return zlib.inflateRawSync(raw).toString("utf8");
    throw new Error(`${file}: ${name} uses zip method ${method}, only STORED and DEFLATED are read`);
  }
  throw new Error(`${file}: no data-*/0000001.mybpm inside (1. Zip layout)`);
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
  const [file, doc] = process.argv.slice(2);
  if (!file) {
    console.error("usage: node lint-archive.js <archive.mybpm.zip | 0000001.mybpm> [MYBPM-IMPORTS.md]");
    process.exit(2);
  }
  const out = lintArchive(archiveText(file), docText(doc));
  console.log(out);
  // Exit 1 while a defect line is left; REMINDER lines are answered in the report, not fixed in the file (0.10).
  process.exit(out.split("\n").some((l) => l && l !== "form lint: OK" && !l.startsWith("REMINDER")) ? 1 : 0);
})().catch((e) => { console.error(e && e.message || e); process.exit(2); });
