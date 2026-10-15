unzip -p "$1" 'data-*/0000001.mybpm' | bun -e '
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
if (!L.some((o) => cls(o) === "ScriptDefStructDto"))
  out.push("REMINDER no script line: every computed value and total of the spec is a hook (0.2c step 7) or a reason from 0.2b step 5");
if (!bos.some((b) => b.category === "BO_PROCESS"))
  out.push("REMINDER no process: an approval path of the spec is a BO_PROCESS (0.18) or a reason from 0.2b step 5");
console.log(out.length ? out.join("\n") : "form lint: OK");
'
