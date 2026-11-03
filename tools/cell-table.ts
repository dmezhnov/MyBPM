/**
 * The table «Cell of each type» of MYBPM-IMPORTS.md 0.8 — rows, place in a row and width of every field kind — read
 * from the document text, the way the form lint (0.10) reads it. Imported by mcp/mybpm-stand.ts and
 * tools/make-probe-archive.bun.ts so the tools lay out cells by the same table the lint checks them against.
 */

export type CellRule = {
  kind: string;
  rows: number; // 0 = computed: `items` (from the item count) or `tabs` (the tallest tab + 3)
  least: boolean; // `≥ N`: N is the minimum, not the only value
  items: { base: number; per: number; key: string } | null; // painted px = base + per·n, n = the count at `key`
  place: string; // pairs | alone | free
  width: string; // stretches | own | fills | —
};

/** kind (`TYPE` or `TYPE viewType`) → its row of the table; empty when the document has no such table. */
export function cellTable(doc: string): Record<string, CellRule> {
  const out: Record<string, CellRule> = {};
  for (const l of (doc.split("\n### 0.8 ")[1]?.split("\n### ")[0] ?? "").split("\n")) {
    const c = l.split("|").map((s) => s.trim()), r = /^(≥ )?(\d+)$/.exec(c[3] ?? ""), m = /^(\d+) \+ (\d+)·n, n = `([^`]+)`/.exec(c[2] ?? "");
    if (c.length !== 7 || !c[1].startsWith("`")) continue;
    for (const k of c[1].match(/`[^`]+`/g) ?? []) out[k.slice(1, -1)] = { kind: k.slice(1, -1), rows: r ? +r[2] : 0, least: !!r?.[1],
      items: c[3] === "items" && m ? { base: +m[1], per: +m[2], key: m[3] } : null, place: c[4], width: c[5] };
  }
  return out;
}

/** The row of a field: `TYPE viewType` first (BO SINGLE, FILE_UPLOAD TILE …), then the bare type. */
export const cellOf = (table: Record<string, CellRule>, type: string, viewType?: string) =>
  (viewType ? table[`${type} ${viewType}`] : undefined) ?? table[type];

/** The grid rows a cell takes: `items` → ⌈(painted + 15) / 30⌉ for n items, else N (the minimum of `≥ N`); 0 = no fixed value. */
export const rowsOf = (cell: CellRule | undefined, n = 0) =>
  !cell ? 0 : cell.items ? Math.ceil((cell.items.base + cell.items.per * n + 15) / 30) : cell.rows;
