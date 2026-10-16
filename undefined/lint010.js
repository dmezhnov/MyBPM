const L = (await Bun.stdin.text()).trimEnd().split("\n").map((l) => JSON.parse(l)), out = [];
const cls = (o) => o["@class"].split(".").pop(), bos = L.filter((o) => cls(o) === "BoStructDto");
const R3 = new Set(["INPUT_TEXT", "INPUT_TEXT_LANG", "INPUT_PHONE", "INPUT_EMAIL", "INPUT_NUMBER", "TIME", "FULL_DATE",
  "YEAR_AND_MONTH", "YEAR", "DATE", "PERIOD", "PERIOD_TIME", "CHECKBOX", "DROPDOWN_SINGLE"]);
for (const bo of bos.filter((b) => b.category !== "BO_COMPOSITE")) {
  const forms = new Map(), put = (tab, c) => forms.set(tab, [...(forms.get(tab) ?? []), c]);
  for (const f of Object.values(bo.dynamicFields ?? {})) {
    const t = `${bo.code}.${f.code}`, g = f.gridPosition, ref = f.type === "BO" || f.type === "CO";
    const single = ref && f.viewType === "SINGLE", table = ref && f.viewType === "TABLE", text = /^TEXTAREA/.test(f.type);
    if (text && f.params?.buttonTypes === undefined) out.push(`${t}: TEXTAREA without params.buttonTypes (0.5)`);
    if (table && Object.values(f.boRefStruct?.fieldRefs ?? {}).filter((r) => r.toShow).length < 2)
      out.push(`${t}: TABLE shows fewer than 2 columns (0.5a)`);
    if (!g || f.trackedFieldCode || f.code === "PROCESS_STATUS") continue;
    if ((single || R3.has(f.type)) && g.rows !== 3) out.push(`${t}: rows ${g.rows}, must be 3 (0.8)`);
    if ((table || text) && g.rows < 6) out.push(`${t}: rows ${g.rows}, must be 6 (0.8)`);
    put(f.tabCodePath?.tabCode ?? "", { t, g, short: single || R3.has(f.type) });
  }
  for (const w of ["signatures", "buttons", "iframes", "captcha", "currentDates", "currentUser"].flatMap((m) => Object.values(bo[m] ?? {})))
    if (w.gridPosition) put(w.tabCode?.tabCode ?? "", { t: `${bo.code}.${w.code}`, g: w.gridPosition, box: true });
  for (const n of Object.values(bo.nativeFields ?? {}))
    if (n.gridPosition) put(n.tabCodePath?.tabCode ?? "", { t: `${bo.code}.${n.nativeFieldId}`, g: n.gridPosition, box: true });
  for (const cells of forms.values()) {
    let next = 0, edge = 15;
    for (const y of [...new Set(cells.map((c) => c.g.y))].sort((a, b) => a - b)) {
      const row = cells.filter((c) => c.g.y === y).sort((a, b) => a.g.x - b.g.x);
      if (y !== next) out.push(`${row[0].t}: y ${y}, expected ${next} (0.8)`);
      let x = 0;
      for (const c of row) {
        if (c.g.x < x) out.push(`${c.t}: overlaps the cell before it in row y ${y} (0.10)`);
        if (!c.box && c.g.x >= edge) out.push(`${c.t}: x ${c.g.x} lies in the free columns ${edge}–14 of the row above — it floats up (0.8)`);
        x = Math.max(x, c.g.x + c.g.cols);
      }
      if (row.length > 1 && x !== 15) out.push(`${row[0].t}: row y ${y} spans ${x} of 15 columns (0.8)`);
      if (new Set(row.map((c) => c.g.rows)).size > 1) out.push(`${row[0].t}: row y ${y} mixes heights (0.8)`);
      if (row.length === 1 && row[0].short && row[0].g.cols === 15 && bo.category !== "BO_DICTIONARY")
        out.push(`${row[0].t}: a short field alone at full width — pair it by meaning or x 0, cols 8 (0.8)`);
      next = y + Math.max(...row.map((c) => c.g.rows));
      edge = row.some((c) => c.box) ? 15 : x;
    }
  }
}
for (const bo of bos.filter((b) => b.instanceViewType !== "TAB" && b.gridLayoutPosition)) {
  const g = bo.gridLayoutPosition;
  if (g.h > 28) out.push(`${bo.code}: FORM window h ${g.h} > 28 — tabs (0.8a step 3) or instanceViewType TAB (step 8)`);
  for (const f of Object.values(bo.dynamicFields ?? {}).filter((f) => f.type === "BO" && f.viewType === "TABLE")) {
    const c = bos.find((b) => b.oldId === f.oldRefBoId), back = Object.values(c?.dynamicFields ?? {})
      .some((x) => x.viewType === "TABLE" && x.oldRefBoId === bo.oldId);
    if (c && !back && c.instanceViewType !== "TAB" && c.gridLayoutPosition?.w >= g.w)
      out.push(`${bo.code}.${f.code}: child ${c.code} window w ${c.gridLayoutPosition.w} not below ${g.w} — narrower, or TAB (0.8a steps 7–8)`);
  }
}
const SZ = { Enter: [30, 30], Exit: [30, 30], Point: [20, 20], Terminator: [40, 40], Script: [80, 50], Timer: [80, 50],
  Form: [100, 50], Switch: [60, 60], SingleToParallel: [39, 64], ParallelToSingle: [39, 64] };
const hit = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
for (const pv of L.filter((o) => cls(o) === "BoProcessVersionsStructDto")) {
  const pc = bos.find((b) => b.oldId === pv.oldId)?.code ?? pv.oldId;
  for (const v of [pv.workProcess, ...Object.values(pv.processVersions ?? {})].filter(Boolean)) {
    const F = Object.fromEntries(Object.entries(v.figureStructs ?? {}).map(([id, f]) => {
      const t = cls(f).replace(/^Figure|Struct$/g, ""), [w, h] = SZ[t] ?? [80, 50];
      return [id, { t, x: f.x, y: f.y, b: [f.x - w / 2, f.y - h / 2, f.x + w / 2, f.y + h / 2] }];
    }));
    const at = (f, s) => s === "main" ? [f.t === "Enter" ? f.b[2] : f.b[0], f.y] : s === "left" ? [f.b[0], f.y]
      : s === "right" ? [f.b[2], f.y] : /^(top|up)$/.test(s) ? [f.x, f.b[1]] : /^(bottom|down)$/.test(s) ? [f.x, f.b[3]] : [f.x, f.y];
    const labs = [];
    for (const a of Object.values(v.arrows ?? {})) {
      const st = F[a.startFigureId], fi = F[a.finishFigureId];
      if (!st || !fi) continue;
      const [x1, y1] = at(st, a.startSlotName), [x2, y2] = at(fi, a.finishSlotName), n = [...(a.name ?? "")].length;
      const t = `${pc} arrow «${a.name ?? ""}»`, pt = st.t === "Point" || fi.t === "Point";
      if (!pt && x1 !== x2 && y1 !== y2) out.push(`${t}: not straight — both slots on one y or one x (0.18)`);
      if (n > 12) out.push(`${t}: name longer than 12 characters (0.18)`);
      if (y1 === y2 && Math.abs(x2 - x1) < 15 * n + 20) out.push(`${t}: gap ${Math.abs(x2 - x1)} px, needs ${15 * n + 20} (0.18)`);
      if (x1 === x2 && Math.abs(y2 - y1) < 50) out.push(`${t}: vertical gap ${Math.abs(y2 - y1)} px, needs 50 (0.18)`);
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      if (n) labs.push({ t, b: [mx, my, mx + 7.5 * n, my + 18] });
    }
    for (const [i, l] of labs.entries()) {
      for (const f of Object.values(F)) if (hit(l.b, f.b)) out.push(`${l.t}: label overlaps a ${f.t} figure (0.18)`);
      for (const m of labs.slice(i + 1)) if (hit(l.b, m.b)) out.push(`${l.t}: label overlaps ${m.t} (0.18)`);
      if (l.b[2] > 1200) out.push(`${l.t}: label ends at x ${Math.round(l.b[2])}, beyond 1200 (0.18)`);
    }
    if (!Object.keys(v.runWayMap ?? {}).length) out.push(`${pc}: empty runWayMap — nothing starts the process from its document (0.18)`);
  }
}
if (!L.some((o) => cls(o) === "ScriptDefStructDto"))
  out.push("REMINDER no script line: every computed value and total of the spec is a hook (0.2c step 7) or a reason from 0.2b step 5");
if (!bos.some((b) => b.category === "BO_PROCESS"))
  out.push("REMINDER no process: an approval path of the spec is a BO_PROCESS (0.18) or a reason from 0.2b step 5");
console.log(out.length ? out.join("\n") : "form lint: OK");