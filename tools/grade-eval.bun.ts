// Round-2 grading: run tools/validate-archive.bun.ts over eval2/caseNN and diff with round 1.
const ROOT = "/home/dmezhnov/programming/MyBPM";
const RUN = "/tmp/claude-1000/-home-dmezhnov-programming-MyBPM/5b251b10-5859-4e66-9a44-8ff385efe108/scratchpad/eval2";
const R1 = `${ROOT}/tools/out/eval-2026-09-18`;

const cases = ["01","02","03","04","05","06","07","08","09","10","11","12"];
const rows: string[] = [];
for (const c of cases) {
  const zip = `${RUN}/case${c}/archive.mybpm.zip`;
  const exists = await Bun.file(zip).exists();
  let cur = "— no archive —";
  if (exists) {
    const p = Bun.spawnSync(["bun", `${ROOT}/tools/validate-archive.bun.ts`, zip, "--json"], { cwd: ROOT });
    const txt = new TextDecoder().decode(p.stdout);
    await Bun.write(`${RUN}/case${c}/report.json`, txt);
    try {
      const j = JSON.parse(txt);
      cur = `${j.counts.FATAL}/${j.counts.ERROR}/${j.counts.WARN}`;
    } catch { cur = `parse fail: ${txt.slice(0, 120)}`; }
  }
  let old = "?";
  try {
    const j = await Bun.file(`${R1}/case${c}/report.json`).json();
    old = `${j.counts.FATAL}/${j.counts.ERROR}/${j.counts.WARN}`;
  } catch {}
  rows.push(`case${c}  round1 ${old.padEnd(10)}  round2 ${cur}`);
}
console.log(rows.join("\n"));
