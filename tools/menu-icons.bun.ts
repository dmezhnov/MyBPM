#!/usr/bin/env bun
/**
 * Pulls the list of sidebar-menu icons out of a stand's FRONTEND bundle — the names the «Изменить
 * иконку» picker offers — and writes it to `tools/menu-icons.json` (read by validate-archive).
 *
 * Where the list lives (MYBPM-UI-API.md §4, MYBPM-IMPORTS.md 0.5d): the Angular component
 * `app-phosphor-icon-chooser` in a lazy chunk (`956.<hash>.js` on build C4.24.25.264) holds 18 arrays,
 * one per picker tab. A name `<ns>:<name>` is drawn from the file `/assets/icons/<ns>/<name>.svg`,
 * so `--check` HEADs every one of them (200 = the icon exists on that stand).
 *
 *   bun tools/menu-icons.bun.ts --stand https://<stand> [--check] [--md] [--out tools/menu-icons.json]
 *
 * `--md` prints the per-tab list in the shape both documents carry it (so they can be refreshed).
 * The host is never written into the output.
 */

const arg = (k: string) => { const i = Bun.argv.indexOf(`--${k}`); return i < 0 ? undefined : Bun.argv[i + 1]; };
const stand = (arg("stand") ?? "").replace(/\/$/, "");
if (!stand) throw new Error("--stand https://<host> is required");
const out = arg("out") ?? `${import.meta.dir}/menu-icons.json`;

const get = async (path: string) => {
  const r = await fetch(`${stand}/${path}`);
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return r.text();
};

// index.html → runtime.<hash>.js → the chunk-id → hash map → the chunk that holds the chooser
const index = await get("");
const runtime = index.match(/src="(runtime\.[0-9a-f]+\.js)"/)?.[1];
if (!runtime) throw new Error("no runtime.<hash>.js in index.html");
const chunks = [...(await get(runtime)).matchAll(/(\d+):"([0-9a-f]{16})"/g)].map(m => `${m[1]}.${m[2]}.js`);
let src = "", chunk = "";
for (let i = 0; i < chunks.length && !src; i += 16) {
  const texts = await Promise.all(chunks.slice(i, i + 16).map(c => get(c).catch(() => "")));
  const hit = texts.findIndex(s => s.includes("app-phosphor-icon-chooser"));
  if (hit >= 0) { src = texts[hit]; chunk = chunks[i + hit]; }
}
if (!src) throw new Error(`app-phosphor-icon-chooser found in none of ${chunks.length} chunks`);

// the arrays, and the order the template binds them to tabs 1..18 (ngForOf)
const arrays: Record<string, string[]> = {};
for (const m of src.matchAll(/this\.(\w+)=\[((?:"[a-z-]+:[^"]+",?)+)\]/g))
  arrays[m[1]] = [...m[2].matchAll(/"([^"]+)"/g)].map(x => x[1]);
const order = [...new Set([...src.matchAll(/property\("ngForOf",\w\.(\w+)\)/g)].map(m => m[1]))]
  .filter(k => k in arrays);
const heads = [...src.matchAll(/\["idNumber","(\d+)"\],\["svgIcon","([^"]+)"\]/g)].map(m => m[2]);
const tabs = order.map((key, i) => ({ tab: i + 1, key, headIcon: heads[i] ?? null, names: arrays[key] }));
const all = tabs.flatMap(t => t.names);
const inChunk = new Set([...src.matchAll(/"((?:phosphor|menu-item):[^"]+)"/g)].map(m => m[1]));
const offPicker = [...inChunk].filter(n => !all.includes(n));

console.error(`${chunk}: ${tabs.length} tabs, ${all.length} names (${new Set(all).size} unique); `
  + `in the chunk but in no tab: ${offPicker.join(", ") || "none"}`);

if (Bun.argv.includes("--check")) {
  const bad: string[] = [];
  const names = [...new Set([...all, ...offPicker])];
  for (let i = 0; i < names.length; i += 64) {
    await Promise.all(names.slice(i, i + 64).map(async n => {
      const [ns, nm] = n.split(":");
      const r = await fetch(`${stand}/assets/icons/${ns}/${encodeURIComponent(nm)}.svg`, { method: "HEAD" });
      if (r.status !== 200) bad.push(`${r.status} ${n}`);
    }));
  }
  console.error(`--check: ${names.length - bad.length}/${names.length} files answer 200${bad.length ? `; missing: ${bad.join(", ")}` : ""}`);
}

// one tab per line: readable diffs when a new build changes the list
const body = tabs.map(t => `  ${JSON.stringify(t)}`).join(",\n");
await Bun.write(out, `{"chunk": ${JSON.stringify(chunk)}, "offPicker": ${JSON.stringify(offPicker)},\n "tabs": [\n${body}\n]}\n`);
console.error(`written ${out}`);

if (Bun.argv.includes("--md")) {
  for (const ns of ["phosphor", "menu-item"]) {
    console.log(`\n\`${ns}:\` —`);
    for (const t of tabs) {
      const n = t.names.filter(x => x.startsWith(`${ns}:`)).map(x => x.slice(ns.length + 1));
      if (n.length) console.log(`- tab ${t.tab} (head icon \`${t.headIcon?.split(":")[1]}\`, ${n.length}): ${n.map(x => x.includes(" ") ? `«${x}»` : x).join(" ")}`);
    }
    const extra = offPicker.filter(x => x.startsWith(`${ns}:`)).map(x => x.slice(ns.length + 1));
    if (extra.length) console.log(`- not in any tab, file exists: ${extra.join(" ")}`);
  }
}
