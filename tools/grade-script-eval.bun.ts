// Grade a §0S eval run: tools/validate-script.bun.ts over <run>/caseNN/script.json with that case's spec.json,
// writes <run>/caseNN/report.json and prints FATAL/ERROR/WARN per case (the cases come from tools/eval-script-cases.bun.ts).
//   bun tools/grade-script-eval.bun.ts <runDir> [41,42,…]
const ROOT = `${import.meta.dir}/..`;
const [run, list] = Bun.argv.slice(2);
if (!run) { console.error("usage: bun tools/grade-script-eval.bun.ts <runDir> [41,42,…]"); process.exit(2); }

const cases = list
  ? list.split(",").map((c) => c.trim().replace(/^case/, ""))
  : [...new Bun.Glob("case*/spec.json").scanSync(run)].map((p) => p.slice(4, 6)).sort();

for (const c of cases) {
  const dir = `${run}/case${c}`;
  let cur = "— no script —";
  if (await Bun.file(`${dir}/script.json`).exists()) {
    const p = Bun.spawnSync(["bun", `${ROOT}/tools/validate-script.bun.ts`, `${dir}/script.json`, "--spec", `${dir}/spec.json`, "--json"]);
    const txt = new TextDecoder().decode(p.stdout);
    await Bun.write(`${dir}/report.json`, txt);
    try {
      const j = JSON.parse(txt);
      cur = `${j.counts.FATAL}/${j.counts.ERROR}/${j.counts.WARN}  ${j.stats.blocks}b/${j.stats.expressions}e`;
    } catch { cur = `parse fail: ${txt.slice(0, 120)}`; }
  }
  console.log(`case${c}  ${cur}`);
}
