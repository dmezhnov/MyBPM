/**
 * Conformance check for §0U of MYBPM-UI-API.md: every endpoint name and every payload key the cookbook
 * mentions must occur literally in the stand's own client bundle — nothing invented.
 *
 * Download the bundle first (§0U.3): fetch `runtime.<hash>.js`, parse its chunk map, fetch every chunk into
 * `chunks/`, then run this from that directory:
 *
 *   bun ~/programming/MyBPM/tools/conform-cookbook-stand.bun.ts
 */

const doc = await Bun.file(`${import.meta.dir}/../MYBPM-UI-API.md`).text();
// §0U only
const sec = doc.slice(doc.indexOf("## 0U. COOKBOOK"), doc.indexOf("## 1. Request conventions"));

let blob = "";
for (const f of new Bun.Glob("chunks/*.js").scanSync()) blob += await Bun.file(f).text();

// endpoint method names: `<name>` tokens that look like kebab-case api methods, plus /web/... paths
const names = new Set<string>();
for (const m of sec.matchAll(/`([a-z0-9]+(?:-[a-z0-9]+){1,})`/g)) names.add(m[1]);
for (const m of sec.matchAll(/\/web\/(v2\/[a-z0-9\-/]+|[a-z\-]+\/[a-z0-9\-/]+)/g)) names.add(m[1].split("/").at(-1)!);
// keys used in payloads
const keys = new Set([...sec.matchAll(/"([a-zA-Z_][a-zA-Z0-9_]{2,})"\s*:/g)].map((m) => m[1]));

const skipNames = new Set(["mybpm-zip", "claude-in-chrome", "load-state-short"]);  // handled separately
const bad = [...names].sort().filter((n) => !skipNames.has(n) && !blob.includes(n));
console.log("endpoint-ish tokens in §0U:", names.size, "| not found in bundle:", JSON.stringify(bad));

const badKeys = [...keys].sort().filter((k) => !blob.includes(k));
console.log("payload keys:", keys.size, "| not found in bundle:", JSON.stringify(badKeys));
