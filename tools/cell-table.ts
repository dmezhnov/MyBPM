/**
 * The table «Cell of each type» of MYBPM-IMPORTS.md 0.8 — rows, place in a row, width and min px of every field kind — read
 * from the document text, the way the form lint (0.10) reads it. Imported by mcp/mybpm-stand.ts and
 * tools/make-probe-archive.bun.ts so the tools lay out cells by the same table the lint checks them against.
 */

export type CellRule = {
  kind: string;
  rows: number; // 0 = computed: `items` (from the item count) or `tabs` (the tallest tab + 3)
  least: boolean; // `≥ N`: N is the minimum, not the only value
  items: { base: number; per: number; key: string } | null; // painted px = base + per·n, n = the count at `key`
  place: string; // pairs | alone | free
  width: string; // stretches | narrow | own | fills | —
  minPx: number; // the narrowest cell that shows the whole box; 0 = no minimum
};

/** kind (`TYPE` or `TYPE viewType`) → its row of the table; empty when the document has no such table. */
export function cellTable(doc: string): Record<string, CellRule> {
  const out: Record<string, CellRule> = {};
  for (const l of (doc.split("\n### 0.8 ")[1]?.split("\n### ")[0] ?? "").split("\n")) {
    const c = l.split("|").map((s) => s.trim()), r = /^(≥ )?(\d+)$/.exec(c[3] ?? ""), m = /^(\d+) \+ (\d+)·n, n = `([^`]+)`/.exec(c[2] ?? "");
    if (c.length !== 8 || !c[1].startsWith("`")) continue;
    for (const k of c[1].match(/`[^`]+`/g) ?? []) out[k.slice(1, -1)] = { kind: k.slice(1, -1), rows: r ? +r[2] : 0, least: !!r?.[1],
      items: c[3] === "items" && m ? { base: +m[1], per: +m[2], key: m[3] } : null, place: c[4], width: c[5],
      minPx: /^\d+$/.test(c[6]) ? +c[6] : 0 };
  }
  return out;
}

/** The row of a field: `TYPE viewType` first (BO SINGLE, FILE_UPLOAD TILE …), then the bare type. */
export const cellOf = (table: Record<string, CellRule>, type: string, viewType?: string) =>
  (viewType ? table[`${type} ${viewType}`] : undefined) ?? table[type];

/** The grid rows a cell takes: `items` → ⌈(painted + 15) / 30⌉ for n items, else N (the minimum of `≥ N`); 0 = no fixed value. */
export const rowsOf = (cell: CellRule | undefined, n = 0) =>
  !cell ? 0 : cell.items ? Math.ceil((cell.items.base + cell.items.per * n + 15) / 30) : cell.rows;

/** n of an `items` cell for a field as the archive stores it: the value at `items.key`, a string parsed as JSON
 *  first, then an array → its elements, an object → its keys, anything else → 0 — what the form lint's `count` does (0.8). */
export function itemsOf(cell: CellRule | undefined, field: any): number {
  if (!cell?.items) return 0;
  let v = cell.items.key.split(".").reduce((o, p) => o?.[p], field);
  try { v = typeof v === "string" ? JSON.parse(v) : v; } catch { return 0; }
  return Array.isArray(v) ? v.length : v && typeof v === "object" ? Object.keys(v).length : 0;
}

/** The grid rows a stored field takes by the table: its row (`TYPE viewType`, `params.viewType`, the bare type) and its items. */
export function cellRowsOf(table: Record<string, CellRule>, field: any): number {
  const cell = cellOf(table, field.type, field.viewType ?? field.params?.viewType);
  return rowsOf(cell, itemsOf(cell, field));
}

/** px of one form column on a 1280 px screen in a record window of width `win`, `lvl` TAB_GROUPs deep (0.8 «Cell width in px»). */
export const colPx = (win: number, lvl = 0) => (72 * win - 69 - 39 * lvl) / 15;

/** The fewest columns that show a kind's whole box (its `minPx`) in that window; 0 = the kind has no minimum. */
export const minColsOf = (cell: CellRule | undefined, win: number, lvl = 0) =>
  cell?.minPx ? Math.ceil((cell.minPx + 1) / colPx(win, lvl)) : 0;

/** The most columns a kind may take: 5 for a `narrow` one (a third of the form), else 15. */
export const maxColsOf = (cell: CellRule | undefined) => (cell?.width === "narrow" ? 5 : 15);
