#!/usr/bin/env bun
/**
 * Score the runs of `mise run eval-crm` with ONE fixed metrics table, so a series is compared by
 * median/range and never by its best run. Each run dir holds trace.jsonl (stream-json of `claude -p`)
 * and files/ (what the model left in its working folder).
 *
 *   bun tools/score-eval-crm.bun.ts [runsDir=tools/out/eval-crm] [--md]
 *
 * Columns (archive = the first *.mybpm.zip under files/):
 *   ask       the run stopped on questions and got the fixed answer of turn 2
 *   read      highest MYBPM-IMPORTS.md line the model got through Read / core end (the `### 0.11` heading)
 *   BO/dict   BOs of category BO / BO_DICTIONARY
 *   ref ok    BO fields with a real target (oldRefBoId = an oldId of the file, boInfo.code = that BO, a toShow
 *             fieldRef naming a field of it) / all BO fields
 *   pairs     TABLE fields whose linkedFieldCode names a SINGLE on the target that links back
 *   line=cat  TABLE fields whose target BO is also referenced by a BO field of ANOTHER BO — a shared catalogue
 *             used as the line BO (0.2c: lines are their own BO pointing at the catalogue); lower is better
 *   menu      MenuItemStructDto lines
 *   kanban    dropdowns with a kanbanCardTemplates entry / all dropdowns
 *   status    status-like dropdowns (code ~ status|stage) that are LOCAL lists / all of them
 *   badDD     dropdowns with no options: no fieldOptionsStruct, FROM_BO to a code that is no BO_DICTIONARY
 *             of the file, or FROM_FIELD with zero options
 *   ids       ids that are not 16 chars + ids repeated across the file
 *   overlap   pairs of fields whose gridPosition rectangles overlap on the same tab
 *   F/E/W     tools/validate-archive.bun.ts counts; FATAL > 0 = the archive would not import → the run is
 *             marked INVALID (keep it out of the medians)
 *   $, turns, s  from the trace's result event
 */
const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const args = Bun.argv.slice(2);
const runsDir = args.find(a => !a.startsWith("--")) ?? `${ROOT}/tools/out/eval-crm`;
const md = args.includes("--md");

const coreEndCache = new Map<string, number>();
async function coreEnd(label: string): Promise<number> {
  // the run label starts with the doc version ("1.4.93-…") or "current-…"
  const ver = label.split("-")[0];
  if (coreEndCache.has(ver)) return coreEndCache.get(ver)!;
  const doc = ver === "current"
    ? await Bun.file(`${ROOT}/MYBPM-IMPORTS.md`).text()
    : await Bun.$`git -C ${ROOT} show v${ver}:MYBPM-IMPORTS.md`.text();
  const n = doc.split("\n").findIndex(l => l.startsWith("### 0.11")) + 1;
  coreEndCache.set(ver, n);
  return n;
}

function traceStats(text: string) {
  const reads = new Map<string, string>();   // tool_use_id → file read
  let maxLine = 0, cost = 0, turns = 0, secs = 0;  // summed over turn 1 and the answered turn 2
  for (const l of text.split("\n").filter(Boolean)) {
    const e = JSON.parse(l);
    if (e.type === "assistant") for (const c of e.message.content)
      if (c.type === "tool_use" && c.name === "Read") reads.set(c.id, String(c.input.file_path));
    if (e.type === "user") for (const c of e.message.content ?? []) {
      if (c.type !== "tool_result" || !reads.get(c.tool_use_id)?.endsWith("MYBPM-IMPORTS.md")) continue;
      const t = typeof c.content === "string" ? c.content : c.content.map((x: any) => x.text ?? "").join("");
      for (const m of t.matchAll(/(?:^|\n)\s*(\d+)\t/g)) maxLine = Math.max(maxLine, Number(m[1]));
    }
    if (e.type === "result") { cost += e.total_cost_usd; turns += e.num_turns; secs += Math.round(e.duration_ms / 1000); }
  }
  return { maxLine, cost, turns, secs };
}

function rect(g: any) { return g && typeof g.y === "number" ? { x: g.x ?? 0, y: g.y, w: g.cols ?? 0, h: g.rows ?? 0 } : null; }

function archiveStats(objs: any[]) {
  const cls = (o: any) => String(o?.["@class"] ?? "").split(".").pop();
  const bos = objs.filter(o => cls(o) === "BoStructDto");
  const byCode = new Map(bos.map(b => [b.code, b]));
  const byId = new Map(bos.map(b => [b.oldId, b]));
  const dicts = new Set(bos.filter(b => b.category === "BO_DICTIONARY").map(b => b.code));
  const s = { bo: 0, dict: dicts.size, refOk: 0, refs: 0, pairs: 0, menu: objs.filter(o => cls(o) === "MenuItemStructDto").length,
    lineCat: 0, kanban: 0, dd: 0, statusLocal: 0, status: 0, badDD: 0, idBad: 0, idDup: 0, overlap: 0 };
  // which BOs point at each BO through a BO field
  const referrers = new Map<string, Set<string>>();
  for (const b of bos) for (const f of Object.values<any>(b.dynamicFields ?? {}))
    if (f.type === "BO" && f.oldRefBoId) {
      if (!referrers.has(f.oldRefBoId)) referrers.set(f.oldRefBoId, new Set());
      referrers.get(f.oldRefBoId)!.add(b.oldId);
    }
  for (const b of bos) {
    if (b.category === "BO") s.bo++;
    const fields: Record<string, any> = b.dynamicFields ?? {};
    for (const [key, f] of Object.entries(fields)) {
      if (f.type === "BO") {
        s.refs++;
        const target = byId.get(f.oldRefBoId);
        const show = Object.entries<any>(f.boRefStruct?.fieldRefs ?? {}).some(([k, r]) => r?.toShow && target?.dynamicFields?.[k]);
        if (target && f.boRefStruct?.boInfo?.code === target.code && show) s.refOk++;
        const back = target?.dynamicFields?.[f.boRefStruct?.linkedFieldCode];
        if (f.viewType === "TABLE" && back?.viewType === "SINGLE" && back.boRefStruct?.linkedFieldCode === key
          && back.oldRefBoId === b.oldId) s.pairs++;
        if (f.viewType === "TABLE" && target && [...(referrers.get(target.oldId) ?? [])].some(id => id !== b.oldId && id !== target.oldId)) s.lineCat++;
      }
      if (f.type === "DROPDOWN_SINGLE") {
        s.dd++;
        if (b.kanbanCardTemplates?.[key]) s.kanban++;
        const fo = f.fieldOptionsStruct;
        const local = fo?.optionSource === "FROM_FIELD";
        if (/status|stage|state/i.test(key)) { s.status++; if (local) s.statusLocal++; }
        if (!fo || (fo.optionSource === "FROM_BO" && !dicts.has(fo.dictionaryBoInfo?.code))
          || (local && Object.keys(fo.options ?? {}).length === 0)) s.badDD++;
      }
    }
    // overlaps per tab: a field on a tab carries tabCodePath (or tabCode); the rest share the main sheet
    const placed = Object.values(fields).map((f: any) => ({ tab: JSON.stringify(f.tabCodePath ?? f.params?.tabCode ?? ""), r: rect(f.gridPosition) }))
      .filter(p => p.r && p.r.w > 0 && p.r.h > 0);
    for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i], c = placed[j];
      if (a.tab === c.tab && a.r!.x < c.r!.x + c.r!.w && c.r!.x < a.r!.x + a.r!.w && a.r!.y < c.r!.y + c.r!.h && c.r!.y < a.r!.y + a.r!.h) s.overlap++;
    }
  }
  // ids: every oldId / newId / newOptionId anywhere in the file
  const seen = new Map<string, number>();
  const walk = (v: any) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) {
      if ((k === "oldId" || k === "newId" || k === "newOptionId") && typeof x === "string") {
        if (x.length !== 16) s.idBad++;
        seen.set(x, (seen.get(x) ?? 0) + 1);
      } else walk(x);
    }
  };
  objs.forEach(walk);
  for (const n of seen.values()) if (n > 1) s.idDup += n - 1;
  return s;
}

const rows: string[][] = [];
const head = ["run", "ask", "read", "BO", "dict", "ref ok", "pairs", "line=cat", "menu", "kanban", "status", "badDD", "ids", "overlap", "F/E/W", "$", "turns", "s"];
const labels = [...new Bun.Glob("*/trace.jsonl").scanSync(runsDir)].map(p => p.split("/")[0]).sort();
for (const label of labels) {
  const dir = `${runsDir}/${label}`;
  const trace2 = Bun.file(`${dir}/trace2.jsonl`);
  const asked = await trace2.exists();
  const t = traceStats(await Bun.file(`${dir}/trace.jsonl`).text() + "\n" + (asked ? await trace2.text() : ""));
  const end = await coreEnd(label);
  // files/ appears when the run ends; Bun.file().exists() is false for a directory, so ask the shell
  if (Bun.spawnSync(["test", "-d", `${dir}/files`]).exitCode) { rows.push([label, "", "running", ...Array(head.length - 3).fill("")]); continue; }
  const zip = [...new Bun.Glob("**/*.mybpm.zip").scanSync(`${dir}/files`)][0];
  let a: ReturnType<typeof archiveStats> | null = null, few = "no zip";
  if (zip) {
    const path = `${dir}/files/${zip}`;
    const payload = Bun.spawnSync(["sh", "-c", `unzip -p "$0" '*0000001.mybpm'`, path]).stdout.toString();
    const objs = payload.split("\n").filter(l => l.trim()).flatMap(l => { try { return [JSON.parse(l)]; } catch { return []; } });
    a = archiveStats(objs);
    const v = Bun.spawnSync(["bun", `${ROOT}/tools/validate-archive.bun.ts`, path, "--json"]);
    try { const c = JSON.parse(v.stdout.toString()).counts; few = `${c.FATAL}/${c.ERROR}/${c.WARN}` + (c.FATAL > 0 ? " INVALID" : ""); } catch { few = "?"; }
  }
  rows.push([label, asked ? "yes" : "", `${t.maxLine}/${end}`,
    ...(a ? [a.bo, a.dict, `${a.refOk}/${a.refs}`, a.pairs, a.lineCat, a.menu, `${a.kanban}/${a.dd}`, `${a.statusLocal}/${a.status}`,
      a.badDD, `${a.idBad}+${a.idDup}`, a.overlap] : Array(11).fill("—")).map(String),
    few, t.cost.toFixed(2), String(t.turns), String(t.secs)]);
}

if (md) {
  console.log(`| ${head.join(" | ")} |\n|${head.map(() => "---").join("|")}|`);
  for (const r of rows) console.log(`| ${r.join(" | ")} |`);
} else {
  const w = head.map((h, i) => Math.max(h.length, ...rows.map(r => r[i].length)));
  const line = (r: string[]) => r.map((c, i) => c.padEnd(w[i])).join("  ");
  console.log(line(head));
  for (const r of rows) console.log(line(r));
}
