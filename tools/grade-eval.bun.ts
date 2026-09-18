// Grade an eval run: tools/validate-archive.bun.ts over <run>/caseNN/archive.mybpm.zip,
// counts diffed against a previous round's snapshot.
//   bun tools/grade-eval.bun.ts <runDir> [snapshotDir] [caseNN,caseNN,…]
// Defaults: snapshot = tools/out/eval3-2026-09-18, cases = every caseNN found in <runDir>.
const ROOT = "/home/dmezhnov/programming/MyBPM";
const [run, snap = `${ROOT}/tools/out/eval3-2026-09-18`, list] = Bun.argv.slice(2);
if (!run) { console.error("usage: bun tools/grade-eval.bun.ts <runDir> [snapshotDir] [01,05,…]"); process.exit(2); }

const cases = list
  ? list.split(",").map(c => c.trim().replace(/^case/, ""))
  : [...new Bun.Glob("case*/archive.mybpm.zip").scanSync(run)].map(p => p.slice(4, 6)).sort();

const counts = async (dir: string, c: string) => {
  try {
    const j = await Bun.file(`${dir}/case${c}/report.json`).json();
    return `${j.counts.FATAL}/${j.counts.ERROR}/${j.counts.WARN}`;
  } catch { return "?"; }
};

const rows: string[] = [];
for (const c of cases) {
  const zip = `${run}/case${c}/archive.mybpm.zip`;
  let cur = "— no archive —";
  if (await Bun.file(zip).exists()) {
    const p = Bun.spawnSync(["bun", `${ROOT}/tools/validate-archive.bun.ts`, zip, "--json"], { cwd: ROOT });
    const txt = new TextDecoder().decode(p.stdout);
    await Bun.write(`${run}/case${c}/report.json`, txt);
    try { const j = JSON.parse(txt); cur = `${j.counts.FATAL}/${j.counts.ERROR}/${j.counts.WARN}`; }
    catch { cur = `parse fail: ${txt.slice(0, 120)}`; }
  }
  rows.push(`case${c}  prev ${(await counts(snap, c)).padEnd(10)}  now ${cur}`);
}
console.log(rows.join("\n"));
