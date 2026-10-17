/**
 * The mybpm-stand MCP server: a running MyBPM stand behind task-level tools (MYBPM-UI-API.md «0U.8»).
 *
 * Local stdio only — the stand token never leaves the machine. `mise run mcp-build` bundles this file into
 * mcp/mybpm-stand.cjs, which runs under any Node >= 18 (Claude Desktop ships its own) and under Bun; the
 * Claude Code plugin starts it from plugin.json, Claude Desktop from the .mcpb that `mise run mcp-pack` builds.
 *
 * Node built-ins (`node:fs`, `node:child_process`, `node:zlib` …) instead of Bun's API: the bundle runs under
 * plain Node in Claude Desktop, where Bun does not exist.
 *
 * Accounts — a login on a stand host; several may be kept, one is the default:
 *   ~/.config/mybpm/tokens/<host>/<login>.token  — the session token: added on the accounts page (stand_accounts)
 *                                                  or by `mise run stand-login <host> <login>`
 *   ~/.config/mybpm/accounts.json                — per account its name, the stand's origin, who logged in;
 *                                                  and which account is the default
 *   MYBPM_STAND + MYBPM_TOKEN (+ MYBPM_LOGIN)     — one more account from the environment (tests, a one-off)
 * No password is stored: the accounts page sends it to the stand and keeps the token; an expired token is renewed
 * by logging in on that page again. Neither a password nor a token is ever a tool argument or a tool result.
 */
import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, rmdirSync, writeFileSync, appendFileSync } from "node:fs";
import { createServer } from "node:http";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { inflateRawSync } from "node:zlib";
import { zip } from "../tools/zip.ts";
import { PAGE_HTML } from "./accounts-page.ts";

// ── accounts ─────────────────────────────────────────────────────────────────────────────────────────────

// The folder of the running file. Not `__dirname`: `bun build` replaces it by the build machine's absolute path.
const HERE = dirname(realpathSync(process.argv[1]));
const CONFIG = join(homedir(), ".config", "mybpm");
const TOKENS = join(CONFIG, "tokens");
const BOOK = join(CONFIG, "accounts.json");
const CACHE = join(homedir(), ".cache", "mybpm");
const env = process.env;

/** `mybpm.example.com`, `https://mybpm.example.com/` → origin; a bare host means https. */
function origin(stand: string): string {
  const s = stand.trim().replace(/\/+$/, "");
  return /^https?:\/\//.test(s) ? s : `https://${s}`;
}
const hostKey = (stand: string) => origin(stand).replace(/^https?:\/\//, "");
/** The folder of a host's tokens: the `:` of a port is not allowed in a Windows file name. */
const hostDir = (o: string) => hostKey(o).replace(/:/g, "_");

type Meta = { origin?: string; name?: string; fio?: string; email?: string; companyCode?: string; savedAt?: string };
type Book = { default?: string; accounts: Record<string, Meta> }; // key = `<hostDir>/<login>`
type Cred = { key: string; origin: string; login: string; name?: string; token?: string; file?: string; meta: Meta };

function readBook(): Book {
  try { const b = JSON.parse(readFileSync(BOOK, "utf8")); return { default: b.default, accounts: b.accounts ?? {} }; }
  catch { return { accounts: {} }; }
}
function writeBook(b: Book) {
  mkdirSync(CONFIG, { recursive: true });
  writeFileSync(BOOK, JSON.stringify(b, null, 1) + "\n", { mode: 0o600 });
}

function accounts(): Cred[] {
  const book = readBook(), out: Cred[] = [];
  if (env.MYBPM_STAND && env.MYBPM_TOKEN) {
    const o = origin(env.MYBPM_STAND), login = env.MYBPM_LOGIN ?? "";
    out.push({ key: `${hostDir(o)}/${login}`, origin: o, login, token: env.MYBPM_TOKEN, meta: {} });
  }
  if (existsSync(TOKENS))
    for (const dir of readdirSync(TOKENS)) {
      let files: string[] = [];
      try { files = readdirSync(join(TOKENS, dir)); } catch { continue; }
      for (const f of files) {
        const key = `${dir}/${f.slice(0, -6)}`;
        if (!f.endsWith(".token") || out.some((c) => c.key === key)) continue;
        const meta = book.accounts[key] ?? {};
        out.push({ key, origin: meta.origin ?? origin(dir), login: f.slice(0, -6), name: meta.name, file: join(TOKENS, dir, f), meta });
      }
    }
  return out;
}

const label = (c: Cred) => `${c.name ? `«${c.name}» ` : ""}${hostKey(c.origin)} / ${c.login || "?"}`;
const listed = (cs: Cred[]) => cs.map(label).join("; ");
const NO_ACCOUNTS = "no stand accounts yet — call stand_accounts and give the user its link to a local page where they log in " +
  "(the password goes to that page, never to the chat); do not open their browser unasked";

/** The default account: the one marked on the accounts page, else MYBPM_STAND's, else the only one. */
function defaultAccount(all: Cred[]): Cred | undefined {
  const d = readBook().default;
  return all.find((c) => c.key === d)
    ?? (env.MYBPM_STAND ? all.find((c) => hostKey(c.origin) === hostKey(env.MYBPM_STAND!)) : undefined)
    ?? (all.length === 1 ? all[0] : undefined);
}

/** Which account a call goes to: `stand` is an account name or a host; nothing named = the default. */
function pickStand(stand?: string, login?: string): Cred {
  const all = accounts();
  if (!all.length) throw new Error(NO_ACCOUNTS);
  if (!stand && !login) {
    const d = defaultAccount(all);
    if (d) return d;
    throw new Error(`several accounts, none is the default — pass \`stand\` (a name or a host) or set one with stand_use: ${listed(all)}`);
  }
  const want = stand?.trim().toLowerCase();
  let hits = !want ? all : all.filter((c) => c.name?.trim().toLowerCase() === want);
  if (want && !hits.length) hits = all.filter((c) => hostKey(c.origin).toLowerCase() === hostKey(want));
  if (login) hits = hits.filter((c) => c.login.toLowerCase() === login.trim().toLowerCase());
  if (hits.length === 1) return hits[0];
  if (hits.length > 1) {
    const d = defaultAccount(all);
    if (d && hits.includes(d)) return d;
    throw new Error(`several accounts match — pass \`login\`: ${listed(hits)}`);
  }
  throw new Error(`no account ${[stand, login].filter(Boolean).join(" / ")} — known: ${listed(all)}. ` +
    "A new one is added with stand_accounts (the user logs in on a local page).");
}

const tokenOf = (c: Cred) => (c.token ?? readFileSync(c.file!, "utf8")).trim().replace(/^"|"$/g, "");

class StandError extends Error {
  constructor(public errorType: string, message: string) { super(`${errorType}: ${message}`); }
}

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");

async function passwordLogin(o: string, login: string, password: string): Promise<string> {
  const r = await fetch(`${o}/web/v2/auth/v3/login`, {
    method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(30000),
    body: JSON.stringify({ useParamsFromBody: true, params_Lr1oSgwPR8: null, body_o1nhHUG480: {
      "dXNlcm5hbWU=": b64(login), "cGFzc3dvcmQ=": b64(password), timeOffsetZoneInMinutes: -300,
      timezoneRegion: "Asia/Almaty", clientType: "WEB", userAgent: "mybpm-stand MCP", pushToken: null, clientVersion: "" } }),
  });
  const body = await r.json().catch(() => null);
  if (typeof body !== "string") throw new StandError(body?.errorType ?? `HTTP ${r.status}`, body?.message ?? "login failed");
  return body;
}

async function authInfo(o: string, token: string): Promise<any> {
  const r = await fetch(`${o}/web/v2/auth/load-auth-info`, { headers: { token }, signal: AbortSignal.timeout(15000) });
  const j = await r.json().catch(() => null);
  if (!j || typeof j !== "object" || "errorType" in j || !j.email) throw new StandError(j?.errorType ?? `HTTP ${r.status}`, j?.message ?? "no session");
  return j;
}

const tokenFile = (key: string) => join(TOKENS, `${key}.token`);

/** Add an account or change one (`was` = its key): with a password logs in and keeps the new token. */
async function saveAccount(a: { was?: string; stand?: string; login?: string; password?: string; name?: string }) {
  const stand = a.stand?.trim() ?? "", login = a.login?.trim() ?? "";
  if (!stand || !login) throw new Error("стенд и логин обязательны");
  if (/[\\/]/.test(login)) throw new Error("логин не может содержать / или \\");
  const o = origin(stand), key = `${hostDir(o)}/${login}`, name = a.name?.trim() || undefined, book = readBook();
  if (name && Object.entries(book.accounts).some(([k, m]) => k !== key && k !== a.was && m.name?.toLowerCase() === name.toLowerCase()))
    throw new Error(`название «${name}» уже занято`);
  let meta: Meta = { ...(book.accounts[a.was ?? key] ?? book.accounts[key] ?? {}), origin: o, name };
  if (a.password) {
    const token = await passwordLogin(o, login, a.password).catch((e) => {
      throw e instanceof StandError && e.errorType === "SecurityError" ? new Error(`стенд не принял логин или пароль (${e.message})`) : e;
    });
    const me = await authInfo(o, token).catch(() => ({}));
    mkdirSync(join(TOKENS, hostDir(o)), { recursive: true });
    writeFileSync(tokenFile(key), token, { mode: 0o600 });
    meta = { ...meta, fio: me.fio, email: me.email, companyCode: me.companyCode, savedAt: new Date().toISOString() };
  } else if (!existsSync(tokenFile(key))) throw new Error("нужен пароль: такой учётки ещё нет, или изменены стенд или логин");
  const before = accounts();
  book.accounts[key] = meta;
  if (a.was && a.was !== key) {
    const old = before.find((c) => c.key === a.was);
    if (old?.file) dropFiles(old);
    delete book.accounts[a.was];
    if (book.default === a.was) book.default = key;
  }
  // the first account becomes the default; adding a second keeps the one that worked so far
  const others = before.filter((c) => c.key !== key && c.key !== a.was);
  if (!book.default) book.default = others.length === 1 ? others[0].key : key;
  writeBook(book);
  return { key, name, stand: hostKey(o), login, fio: meta.fio, email: meta.email, companyCode: meta.companyCode, default: book.default === key };
}

function dropFiles(c: Cred) {
  rmSync(c.file!, { force: true });
  try { rmdirSync(dirname(c.file!)); } catch {} // only when empty
}

async function removeAccount(c: Cred) {
  if (!c.file) throw new Error(`${label(c)} comes from MYBPM_STAND / MYBPM_TOKEN of the server's environment — remove it there`);
  // end the session on the stand too (GET v2/auth/logout); an unreachable stand does not block the removal
  await fetch(`${c.origin}/web/v2/auth/logout`, { headers: { token: tokenOf(c) }, signal: AbortSignal.timeout(5000) }).catch(() => {});
  dropFiles(c);
  const book = readBook();
  delete book.accounts[c.key];
  if (book.default === c.key) delete book.default;
  writeBook(book);
  return { removed: label(c) };
}

function useAccount(c: Cred) {
  const book = readBook();
  book.default = c.key;
  writeBook(book);
  return { default: label(c) };
}

async function checkAccount(c: Cred) {
  try {
    const me = await authInfo(c.origin, tokenOf(c));
    if (c.file) {
      const book = readBook();
      book.accounts[c.key] = { ...(book.accounts[c.key] ?? { origin: c.origin }), fio: me.fio, email: me.email, companyCode: me.companyCode };
      writeBook(book);
    }
    return { alive: true, fio: me.fio, email: me.email, companyCode: me.companyCode };
  } catch (e: any) { return { alive: false, error: e.message }; }
}

function accountRows() {
  const all = accounts(), d = defaultAccount(all);
  return all.map((c) => ({ key: c.key, name: c.name ?? null, stand: hostKey(c.origin), origin: c.origin, login: c.login,
    fio: c.meta.fio ?? null, companyCode: c.meta.companyCode ?? null, savedAt: c.meta.savedAt ?? null,
    default: c === d, via: c.file ? "token file" : "MYBPM_TOKEN" }));
}

const byKey = (key: string) => {
  const c = accounts().find((x) => x.key === key);
  if (!c) throw new Error("нет такой учётки — обновите страницу");
  return c;
};

// ── the accounts page: a local form, so a password goes from the user's browser to this server, never via the model

let pageUrl: string | undefined;

function accountsPage(): Promise<string> {
  if (pageUrl) return Promise.resolve(pageUrl);
  // the secret in the path keeps other local processes and web pages (a cross-origin POST) out
  const secret = randomBytes(16).toString("hex");
  return new Promise((ok, fail) => {
    const srv = createServer(async (req, res) => {
      const reply = (code: number, body: unknown, type = "application/json") => {
        res.writeHead(code, { "Content-Type": `${type}; charset=utf-8`, "Cache-Control": "no-store", "X-Frame-Options": "DENY", "Referrer-Policy": "no-referrer" });
        res.end(typeof body === "string" ? body : JSON.stringify(body));
      };
      const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
      if (!path.startsWith(`/${secret}/`)) return reply(404, "not found", "text/plain");
      const route = path.slice(secret.length + 2);
      try {
        if (req.method === "GET" && route === "") return reply(200, PAGE_HTML, "text/html");
        if (req.method !== "POST" || !String(req.headers["content-type"]).startsWith("application/json")) return reply(405, { error: "POST JSON only" });
        let raw = "";
        for await (const chunk of req) raw += chunk;
        const a = raw ? JSON.parse(raw) : {};
        switch (route) {
          case "api/list": return reply(200, accountRows());
          case "api/save": return reply(200, await saveAccount(a));
          case "api/remove": return reply(200, await removeAccount(byKey(a.key)));
          case "api/default": return reply(200, useAccount(byKey(a.key)));
          case "api/check": return reply(200, await checkAccount(byKey(a.key)));
        }
        return reply(404, { error: "no such route" });
      } catch (e: any) { return reply(400, { error: e.message }); }
    });
    srv.on("error", fail);
    srv.listen(0, "127.0.0.1", () => {
      srv.unref();
      ok((pageUrl = `http://127.0.0.1:${(srv.address() as any).port}/${secret}/`));
    });
  });
}

function openBrowser(url: string): boolean {
  const [cmd, args] = process.platform === "darwin" ? ["open", [url]]
    : process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : ["xdg-open", [url]];
  try {
    spawn(cmd as string, args as string[], { detached: true, stdio: "ignore" }).on("error", () => {}).unref();
    return true;
  } catch { return false; }
}

// ── the transport (MYBPM-UI-API.md 0U.2) ─────────────────────────────────────────────────────────────────

type Stand = { c: Cred; call: (path: string, params?: unknown, body?: unknown) => Promise<any>;
  get: (path: string) => Promise<any>; upload: (path: string, file: Uint8Array, name: string) => Promise<any>;
  bytes: (path: string, params?: unknown, body?: unknown) => Promise<{ data: Uint8Array; name: string }> };

function parse(text: string): any {
  if (!text) return null;
  let out: any = text;
  try { out = JSON.parse(text); } catch {}
  if (out && typeof out === "object" && !Array.isArray(out) && ("errorType" in out || "className" in out))
    throw new StandError(out.errorType ?? out.className, String(out.message ?? "").slice(0, 600));
  return out;
}

function stand(args: { stand?: string; login?: string }): Stand {
  const c = pickStand(args.stand, args.login);
  const url = (p: string) => `${c.origin}/web/${p.replace(/^\/?(web\/)?/, "")}`;
  const envelope = (params: unknown, body: unknown) =>
    JSON.stringify({ useParamsFromBody: true, params_Lr1oSgwPR8: params ?? {}, body_o1nhHUG480: body ?? {} });
  // a SecurityError is either a missing right or a dead session: the session is asked to tell them apart
  async function send(make: (token: string) => Promise<Response>): Promise<Response> {
    const r = await make(tokenOf(c));
    if (/"errorType"\s*:\s*"SecurityError"/.test(await r.clone().text()) && !(await checkAccount(c)).alive)
      throw new Error(`the session of ${label(c)} has expired — call stand_accounts and give the user its link to log in again ` +
        "(«Изменить» on that account); the password goes to that page, not to the chat");
    return r;
  }
  const text = async (r: Response) => {
    const t = await r.text();
    if (!r.ok && !t.includes("errorType")) throw new StandError(`HTTP ${r.status}`, t.slice(0, 300));
    return parse(t);
  };
  return {
    c,
    call: async (p, params, body) => text(await send((token) =>
      fetch(url(p), { method: "POST", headers: { "Content-Type": "application/json", token }, body: envelope(params, body) }))),
    get: async (p) => text(await send((token) => fetch(url(p), { headers: { token } }))),
    upload: async (p, file, name) => text(await send((token) => {
      const fd = new FormData();
      fd.append("file", new Blob([file]), name);
      return fetch(url(p), { method: "POST", headers: { token }, body: fd });
    })),
    bytes: async (p, params, body) => {
      const r = await send((token) =>
        fetch(url(p), { method: "POST", headers: { "Content-Type": "application/json", token }, body: envelope(params, body) }));
      const data = new Uint8Array(await r.arrayBuffer());
      if (data[0] === 0x7b) parse(new TextDecoder().decode(data)); // `{` = an error body, not a zip
      const name = /filename\*?=(?:UTF-8'')?"?([^";]+)/i.exec(r.headers.get("content-disposition") ?? "")?.[1];
      return { data, name: name ? decodeURIComponent(name) : "export.mybpm.zip" };
    },
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The progress indicator behind every long operation: poll until isFinished (a rollback stops at 25 %). */
async function waitProcess(s: Stand, processId: string, seconds = 300): Promise<any> {
  for (let i = 0; i < seconds; i++) {
    const st = await s.call("v2/process-indicator/load-state-short", { processId });
    if (st?.isFinished) return st;
    await sleep(1000);
  }
  throw new Error(`process ${processId} did not finish in ${seconds} s — read import_log before retrying`);
}

// ── archives ─────────────────────────────────────────────────────────────────────────────────────────────

/** Every member of a zip, STORED or DEFLATED (no zip64). */
function unzip(b: Buffer): { name: string; data: Buffer }[] {
  let eocd = b.length - 22;
  while (eocd >= 0 && b.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error("not a zip: no end of central directory");
  const out: { name: string; data: Buffer }[] = [];
  let p = b.readUInt32LE(eocd + 16);
  for (let i = 0, n = b.readUInt16LE(eocd + 10); i < n; i++) {
    const method = b.readUInt16LE(p + 10), size = b.readUInt32LE(p + 20), nameLen = b.readUInt16LE(p + 28);
    const local = b.readUInt32LE(p + 42), name = b.toString("utf8", p + 46, p + 46 + nameLen);
    p += 46 + nameLen + b.readUInt16LE(p + 30) + b.readUInt16LE(p + 32);
    const start = local + 30 + b.readUInt16LE(local + 26) + b.readUInt16LE(local + 28), raw = b.subarray(start, start + size);
    out.push({ name, data: method === 8 ? inflateRawSync(raw) : raw });
  }
  return out;
}

/** What an archive holds, in a few lines instead of its JSON: DTO tally and the BOs by code. */
function summarize(file: string) {
  const b = readFileSync(file);
  const text = b.readUInt32LE(0) === 0x04034b50
    ? unzip(b).find((e) => /(^|\/)data-[^/]*\/0000001\.mybpm$/.test(e.name))?.data.toString("utf8") ?? ""
    : b.toString("utf8");
  const lines = text.split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const types: Record<string, number> = {};
  const dto = (l: any) => String(l["@class"] ?? "?").split(".").pop()!;
  for (const l of lines) types[dto(l)] = (types[dto(l)] ?? 0) + 1;
  const bos = lines.filter((l) => dto(l) === "BoStructDto")
    .map((l) => ({ code: l.code, name: l.name?.rus ?? l.name, category: l.category, fields: Object.keys(l.dynamicFields ?? {}).length }));
  return { file, bytes: b.length, lines: lines.length, types, bos };
}

/** The lint the skill ships (MYBPM-IMPORTS.md 0.10), run as it is — beside this file in the plugin and in the .mcpb. */
function lint(file: string): { ok: boolean; out: string } {
  const script = [join(HERE, "..", "skills", "mybpm-imports", "scripts", "lint-archive.cjs")].find(existsSync);
  if (!script) return { ok: true, out: "form lint: NOT RUN (lint-archive.cjs not found beside the server)" };
  try {
    return { ok: true, out: execFileSync(process.execPath, [script, file], { encoding: "utf8" }).trim() };
  } catch (e: any) {
    if (e.status === 1) return { ok: false, out: String(e.stdout).trim() };
    throw new Error(`lint-archive.cjs failed: ${String(e.stderr || e.message).slice(0, 500)}`);
  }
}

const safeName = (n: string) => {
  if (!/^[\w.-]{1,80}$/.test(n)) throw new Error("name: letters, digits, `_`, `-`, `.` only");
  return n.replace(/\.mybpm(\.zip)?$/, "");
};

function archivePath(args: { path?: string; name?: string }): string {
  const p = args.path ? resolve(args.path.replace(/^~(?=\/|$)/, homedir()))
    : args.name ? join(CACHE, "archives", safeName(args.name), `${safeName(args.name)}.mybpm.zip`) : "";
  if (!p) throw new Error("pass `path` (a .mybpm.zip on this machine) or `name` (one built with archive_put)");
  if (!existsSync(p)) throw new Error(`${p}: no such file${args.name ? " — finish it with archive_put last:true" : ""}`);
  return p;
}

// ── imports (MYBPM-UI-API.md R3, §5) ─────────────────────────────────────────────────────────────────────

const cut = (s: unknown, n = 1500) => (typeof s === "string" && s.length > n ? s.slice(0, n) + " …" : s);
const clean = (o: any) => JSON.parse(JSON.stringify(o, (_, v) => (v === null || (Array.isArray(v) && !v.length) ? undefined : v)));

async function importReport(s: Stand, importId: string) {
  const data = await s.call("import-structure/load-import-data", { importId });
  const errors: any[] = [];
  let pageId: string | undefined;
  for (let i = 0; i < 20; i++) {
    const page = await s.call("import-structure/load-import-errors", pageId ? { importId, pageId } : { importId });
    errors.push(...(page?.errorRecords ?? []).map((e: any) => clean({ ...e, id: undefined, importId: undefined })));
    if (!page?.nextPageId || !page?.errorRecords?.length) break;
    pageId = page.nextPageId;
  }
  const bos = await s.call("import-structure/load-import-bo-infos", {}, { importId });
  return { importId, status: data?.status, error: cut(data?.error), conflicts: data?.conflicts, errors, bos };
}

async function logRow(s: Stand, importId: string) {
  const rows = await s.call("import-structure/load-import-file-records", {}, { paging: { offset: 0, limit: 50 } });
  return (rows ?? []).find((r: any) => r.id === importId);
}

// ── notifications ────────────────────────────────────────────────────────────────────────────────────────

const seenAtStart = new Map<string, Set<string>>(); // account key → notification ids present before this session's first stand call
const OFFLINE = new Set(["stand_list", "stand_accounts", "stand_use", "stand_remove", "archive_put", "archive_lint"]);

/** Before the first stand call of a session, note which notifications already exist — what appears later is ours. */
async function baseline(t: Tool, args: any) {
  if (OFFLINE.has(t.name)) return;
  try { const s = stand(args); if (!seenAtStart.has(s.c.key)) await notifications(s, 100); } catch {}
}

async function notifications(s: Stand, limit: number) {
  const rows = (await s.call("v2/user-notification/load-notifications", {}, { paging: { offset: 0, limit } })) ?? [];
  if (!seenAtStart.has(s.c.key)) seenAtStart.set(s.c.key, new Set(rows.map((r: any) => r.row?.id)));
  const before = seenAtStart.get(s.c.key)!;
  return rows.map((r: any) => ({ id: r.row?.id, header: r.row?.header, body: cut(r.row?.body, 200), happenedAt: r.row?.happenedAt, newThisSession: !before.has(r.row?.id) }));
}

// ── tools ────────────────────────────────────────────────────────────────────────────────────────────────

type Tool = { name: string; description: string; props?: Record<string, any>; required?: string[];
  write?: boolean; run: (a: any) => Promise<unknown> };

const STAND_ARGS = {
  stand: { type: "string", description: "The account: its name or the stand host (stand_list). Omit for the default account." },
  login: { type: "string", description: "Login on that stand, when it has several accounts." },
};
const AUTH_PATHS = /auth\/(v3\/login|load-token|fast-login|otp-login)/;
const READ_METHOD = /^(load|count|verify|get|find|search)-/;

async function boById(s: Stand, a: { boId?: string; code?: string }): Promise<string> {
  if (a.boId) return a.boId;
  if (!a.code) throw new Error("pass `boId` or `code`");
  return s.call("v2/business-objects/load-bo-id-by-code", { boCode: a.code });
}

const tools: Tool[] = [
  // 1. connection
  { name: "stand_list", description: "The stand accounts this server keeps (name, stand host, login, who logged in, company) and which one is the default — the account every tool uses when `stand` is not passed. `check: true` also asks each stand whether its session is alive. Never shows a token.",
    props: { check: { type: "boolean", description: "Ask every stand whether the session is still alive (one call per account)." } },
    run: async (a) => {
      const rows = accountRows();
      if (a.check) await Promise.all(rows.map(async (r) => Object.assign(r, await checkAccount(byKey(r.key)))));
      return { accounts: rows.map(({ origin: _, ...r }) => r),
        manage: rows.length ? "stand_use sets the default, stand_remove removes one; adding, renaming, a re-login after an expired session — stand_accounts (a page in the user's browser)"
          : NO_ACCOUNTS };
    } },
  { name: "stand_accounts", description: "The accounts page — a local page of this server where the user adds a stand account (stand host, login, password, an optional name), edits one (rename, another login, log in again when the session expired), removes one or marks the default. The password goes from that page straight to the stand: never ask for it in the chat. Returns the page URL: give it to the user as a link and wait for them. It opens their browser only with open:true — pass it only when the user asked you to open the page or to add / re-log an account, never just because a question found no account, and stand_list shows the result. `stand` / `login` / `name` prefill the add form.",
    props: { name: { type: "string", description: "A name to prefill, e.g. «Тестовый core2»." },
      open: { type: "boolean", description: "true = also open the page in the user's browser; only when the user asked for it. Default false: the URL only." } },
    run: async (a) => {
      const url = await accountsPage();
      const pre = new URLSearchParams(Object.entries({ stand: a.stand, login: a.login, name: a.name }).filter(([, v]) => v) as [string, string][]);
      const link = url + (pre.toString() ? `#add&${pre}` : "");
      return { url: link, opened: a.open === true ? openBrowser(link) : false,
        tell: "Give the user the url as a link (opened:true = it is already open in their browser). They log in there; the password never comes to the chat. When they say it is done, call stand_list." };
    } },
  { name: "stand_use", description: "Make an account the default: every tool called without `stand` goes to it. Local, the stand is not touched.",
    required: ["stand"],
    run: async (a) => useAccount(pickStand(a.stand, a.login)) },
  { name: "stand_remove", write: true, description: "Remove a stand account from this computer: ends its session on the stand (logout) and deletes the saved token. Ask the user first.",
    required: ["stand"],
    run: async (a) => removeAccount(pickStand(a.stand, a.login)) },
  { name: "stand_whoami", description: "Who the token logs in as and which company (tenant) it selects: fio, email, companyCode, companyId, personId, and the company's Person BO id (personBoId). Run it first to confirm you are on the intended account — one host serves several companies.",
    props: { functions: { type: "boolean", description: "Also list the user's functionCodes (long)." } },
    run: async (a) => {
      const s = stand(a);
      const me = await s.get("v2/auth/load-auth-info");
      const personBoId = await s.call("v2/business-objects/load-bo-id-by-kind", { kind: "PERSON" }).catch(() => null);
      return { account: label(s.c), stand: hostKey(s.c.origin), fio: me?.fio, email: me?.email, companyCode: me?.companyCode, companyId: me?.companyId,
        personId: me?.personId, personBoId, language: me?.language, ...(a.functions ? { functionCodes: me?.functionCodes } : { functionCodes: me?.functionCodes?.length }) };
    } },

  // 2. reading the structure
  { name: "bo_groups", description: "Every BO group of the company with the BOs in it (id, name, boCategory), empty groups included (load-bo-groups forEdit + load-bo-records-by-group-id). Group codes are what an archive's BoGroupStructDto matches.",
    run: async (a) => {
      const s = stand(a);
      const groups = (await s.call("v2/business-objects/load-bo-groups", { forEdit: true })) ?? [];
      return Promise.all(groups.map(async (g: any) => ({ id: g.id, code: g.code, name: g.name, kind: g.kind, orderIndex: g.orderIndex,
        bos: ((await s.call("v2/business-objects/load-bo-records-by-group-id", { groupId: g.id })) ?? [])
          .map((b: any) => ({ id: b.id, name: b.name, boCategory: b.boCategory })) })));
    } },
  { name: "bo_find", description: "Find a BO: by `code` (exact, load-bo-id-by-code — also the existence check after a delete or rollback) or by a piece of its `name` (case-insensitive, over every group).",
    props: { code: { type: "string" }, name: { type: "string" } },
    run: async (a) => {
      const s = stand(a);
      if (a.code) {
        let id: string;
        try { id = await s.call("v2/business-objects/load-bo-id-by-code", { boCode: a.code }); }
        catch (e: any) { if (/No bo with code/.test(e.message)) return { exists: false, code: a.code }; throw e; }
        const bo = await s.call("v2/business-objects/load-business-object-by-id", { businessObjectId: id });
        return { exists: true, id, code: bo?.code, name: bo?.name, boCategory: bo?.boCategory };
      }
      if (!a.name) throw new Error("pass `code` or `name`");
      const q = String(a.name).toLowerCase(), hits: any[] = [];
      for (const g of (await s.call("v2/business-objects/load-bo-groups", { forEdit: true })) ?? [])
        for (const b of (await s.call("v2/business-objects/load-bo-records-by-group-id", { groupId: g.id })) ?? [])
          if (String(b.name).toLowerCase().includes(q)) hits.push({ id: b.id, name: b.name, boCategory: b.boCategory, group: g.name });
      return hits;
    } },
  { name: "bo_read", description: "One BO's structure as a compact summary: header (id, code, name, category, kind, card tabs) and one row per field — fieldId, code, label, type (field type, widget or native), tabId, grid x/y/cols/rows, refBoId, required, registry column. `raw: true` returns the whole DTO of load-business-object-by-id instead.",
    props: { boId: { type: "string" }, code: { type: "string" }, raw: { type: "boolean" } },
    run: async (a) => {
      const s = stand(a);
      const bo = await s.call("v2/business-objects/load-business-object-by-id", { businessObjectId: await boById(s, a) });
      if (a.raw) return bo;
      return clean({ id: bo.id, code: bo.code, name: bo.name, boCategory: bo.boCategory, kind: bo.kind, isDictionary: bo.isDictionary,
        hasScript: bo.hasScript, boTabs: bo.boTabs, fields: (bo.formFields ?? []).map((f: any) => ({
          fieldId: f.fieldId, code: f.code, label: f.label, type: f.type ?? f.widgetType ?? f.nativeFieldType, archetype: f.boFieldArchetype,
          tabId: f.tabId, grid: f.gridPosition && [f.gridPosition.x, f.gridPosition.y, f.gridPosition.cols, f.gridPosition.rows].join("/"),
          refBoId: f.refBoId, required: f.isRequired || undefined, column: f.tableColToShow ? f.tableColOrderIndex ?? true : undefined })) });
    } },
  { name: "persons_find", description: "Users of the company by a piece of name or e-mail (v2/org-unit/load-filtered-persons-v2): id, name, email, groups. The id is what a Person field or a rights subject takes.",
    props: { filter: { type: "string" }, limit: { type: "number" } }, required: ["filter"],
    run: async (a) => {
      const s = stand(a);
      const groups = (await s.call("v2/org-unit/load-filtered-persons-v2", { filter: a.filter, chosenPersonIds: [] }, { limit: a.limit ?? 20, offset: 0 })) ?? [];
      return groups.flatMap((g: any) => (g.persons ?? []).map((p: any) => ({ id: p.id, name: p.name, email: p.email, groups: p.parentGroupNames || undefined })));
    } },

  // 3. the archive
  { name: "archive_put", description: "Build a .mybpm.zip on THIS machine from the JSONL lines of 0000001.mybpm (MYBPM-IMPORTS.md 0.11) — the way to hand an archive over when your own code runs elsewhere (claude.ai / Claude Desktop chat) and cannot reach the stand. Send the lines in parts of up to ~100 KB: part 1 starts the archive, each next part appends, `last: true` checks every line is JSON, writes metadata.mybpm and zips. Then archive_lint / import_analyze with the same `name`.",
    props: { name: { type: "string", description: "Archive name, e.g. `crm` → crm.mybpm.zip" }, part: { type: "number", description: "1, 2, 3 …" },
      lines: { type: "string", description: "JSONL: one DTO per line, in archive order" }, last: { type: "boolean" } },
    required: ["name", "part", "lines"],
    run: async (a) => {
      const name = safeName(a.name), dir = join(CACHE, "archives", name), jsonl = join(dir, `${name}.jsonl`);
      mkdirSync(dir, { recursive: true });
      const chunk = String(a.lines).replace(/\r/g, "").replace(/\n*$/, "\n");
      if (a.part === 1) writeFileSync(jsonl, chunk);
      else if (!existsSync(jsonl)) throw new Error("part 1 never arrived — start again with part 1");
      else appendFileSync(jsonl, chunk);
      const lines = readFileSync(jsonl, "utf8").split("\n").filter((l) => l.trim());
      if (!a.last) return { name, part: a.part, linesSoFar: lines.length };
      const objects = lines.map((l, i) => { try { return JSON.parse(l); } catch (e: any) { throw new Error(`line ${i + 1} is not JSON: ${e.message}`); } });
      const d = "data-" + new Date().toISOString().replace(/[:.]/g, "-").replace("Z", "");
      const enc = new TextEncoder();
      const file = join(dir, `${name}.mybpm.zip`);
      writeFileSync(file, zip([
        { name: `${d}/0000001.mybpm`, data: enc.encode(objects.map((o) => JSON.stringify(o)).join("\n") + "\n") },
        { name: `${d}/metadata.mybpm`, data: enc.encode(`objectCount-${objects.length}`) },
      ]));
      return { ...summarize(file), lint: lint(file).out };
    } },
  { name: "archive_lint", description: "Run the form lint of MYBPM-IMPORTS.md 0.10 (the skill's lint-archive.cjs) on an archive and summarise what it holds. Every line other than `form lint: OK` and REMINDER is a defect to fix before importing.",
    props: { path: { type: "string" }, name: { type: "string" } },
    run: async (a) => { const f = archivePath(a); const l = lint(f); return { ...summarize(f), lintOk: l.ok, lint: l.out }; } },
  { name: "import_analyze", description: "Upload an archive and run the stand's analysis (R3 steps 1-4) — the dry run: NOTHING is written, the import stays ANALYZED. Lints first and stops on a defect unless `skipLint`. Returns importId, status, analysis errors, conflicts and one row per BO. Next: import_apply (writes) or import_cancel. Only one import may be open per company.",
    props: { path: { type: "string", description: "A .mybpm.zip on this machine" }, name: { type: "string", description: "An archive built with archive_put" },
      skipLint: { type: "boolean" } },
    run: async (a) => {
      const file = archivePath(a);
      if (!a.skipLint) { const l = lint(file); if (!l.ok) return { stopped: "the form lint flags defects — fix the archive (or pass skipLint)", lint: l.out }; }
      const s = stand(a);
      const state = await s.call("import-structure/load-import-state");
      if (state?.importExists) throw new Error(`an import is already open: importId ${state.importId} (${state.fileName}) — import_apply or import_cancel it first`);
      let fileName = basename(file);
      if (!/\.mybpm(\.zip)?$/.test(fileName)) fileName += ".mybpm.zip";
      const importId = await s.upload("import-structure/import-file", readFileSync(file), fileName);
      await waitProcess(s, await s.call("import-structure/insert-file-data", { importId }));
      await waitProcess(s, await s.call("import-structure/analyze-file-data", { importId }));
      return { ...(await importReport(s, importId)), next: "read errors + bos; then import_apply (asks the user) or import_cancel" };
    } },
  { name: "import_report", description: "Re-read an import: status, errors, conflicts, BOs; with `recordId` (a bos[].importRecordId) the per-BO pre-apply diff (load-import-bo-record).",
    props: { importId: { type: "string" }, recordId: { type: "string" } }, required: ["importId"],
    run: async (a) => {
      const s = stand(a);
      if (a.recordId) return s.call("import-structure/load-import-bo-record", { importId: a.importId, recordId: a.recordId });
      return { ...(await importReport(s, a.importId)), log: await logRow(s, a.importId) };
    } },
  { name: "import_apply", write: true, description: "APPLY an analysed import — the one call that writes the structure to the stand (R3 steps 5-7). Ask the user first and give them the description. Waits for the apply process, then reads the import log back (status APPLIED, canRollback).",
    props: { importId: { type: "string" }, description: { type: "string", description: "What and why — required by the stand" } }, required: ["importId", "description"],
    run: async (a) => {
      const s = stand(a), importId = a.importId;
      await s.call("import-structure/save-import-description", { importId, value: a.description });
      const processId = await s.call("v2/process-indicator/pre-create-process");
      const applied = await s.call("import-structure/apply-import", { importId, processId });
      const st = await waitProcess(s, processId);
      const data = await s.call("import-structure/load-import-data", { importId });
      return { importId, applied, process: { label: st?.label, percentage: st?.percentage }, status: data?.status, error: cut(data?.error),
        log: await logRow(s, importId), next: "verify with bo_find / bo_read; then notifications_read + notifications_clear" };
    } },
  { name: "import_cancel", write: true, description: "Drop an analysed (not applied) import: cancel-import, status CANCELED; `remove: true` also deletes its log row.",
    props: { importId: { type: "string" }, remove: { type: "boolean" } }, required: ["importId"],
    run: async (a) => {
      const s = stand(a);
      await s.call("import-structure/cancel-import", { importId: a.importId });
      if (a.remove) await s.call("import-structure/remove-import", { importId: a.importId });
      return { importId: a.importId, cancelled: true, removed: !!a.remove };
    } },
  { name: "import_rollback", write: true, description: "Undo an APPLIED import. Without `confirm` it only returns the preview (what would be deleted / restored, canRollback). With `confirm: true` — after the user agreed — it rolls back. Only the import with canRollback:true can be undone; read MYBPM-UI-API.md §5 «Rollback trap» before undoing anything but a single import.",
    props: { importId: { type: "string" }, confirm: { type: "boolean" } }, required: ["importId"],
    run: async (a) => {
      const s = stand(a), importId = a.importId;
      const preview = await s.call("import-structure/load-import-rollback-preview", { importId });
      if (!a.confirm) return { preview, next: preview?.canRollback ? "show the user; import_rollback confirm:true undoes it" : "canRollback is false — not the latest applied import" };
      if (!preview?.canRollback) throw new Error(`canRollback is false (newerAppliedImportsCount ${preview?.newerAppliedImportsCount}) — not the latest applied import`);
      const processId = await s.call("v2/process-indicator/pre-create-process");
      const result = await s.call("import-structure/rollback-import", { importId, processId });
      await waitProcess(s, processId);
      return { importId, result, log: await logRow(s, importId) };
    } },
  { name: "import_log", description: "The import log (newest first: fileName, description, imported_at, status, canRollback) and whether an import is open. The reliable way to learn what happened to an import whose call was cut off.",
    props: { limit: { type: "number" } },
    run: async (a) => {
      const s = stand(a);
      return { open: await s.call("import-structure/load-import-state"),
        log: await s.call("import-structure/load-import-file-records", {}, { paging: { offset: 0, limit: a.limit ?? 10 } }) };
    } },

  // 4. export
  { name: "structure_export", description: "Export BOs' structure to a .mybpm.zip on this machine (R4a / R8): puts exactly these BOs into the server-side export basket, exports, then puts the user's own basket back. Returns the file path and a summary (DTO tally, BOs), not the JSON — read the file if you need it. Menu items / global methods / settings already selected in the user's other baskets come along and are reported.",
    props: { boIds: { type: "array", items: { type: "string" } }, codes: { type: "array", items: { type: "string" } },
      rights: { type: "boolean", description: "Include AccessStructDto" }, scripts: { type: "boolean", description: "Include scripts" },
      out: { type: "string", description: "Directory for the file (default ~/Downloads, else ~/.cache/mybpm/exports)" } },
    run: async (a) => {
      const s = stand(a);
      const ids: string[] = [...(a.boIds ?? [])];
      for (const code of a.codes ?? []) ids.push(await s.call("v2/business-objects/load-bo-id-by-code", { boCode: code }));
      if (!ids.length) throw new Error("pass `boIds` or `codes`");
      const records = await Promise.all(ids.map(async (id) => {
        const bo = await s.call("v2/business-objects/load-business-object-by-id", { businessObjectId: id });
        return { boId: id, boName: bo.name, boCategory: bo.boCategory, hasScript: !!bo.hasScript, isStructureExport: true,
          isAccessRightsExport: !!a.rights, isScriptsExport: !!a.scripts && !!bo.hasScript };
      }));
      const saved = (await s.call("struct/load-bo-export-records", { offset: 0, limit: 1000 })) ?? [];
      const others = { menuItems: await s.call("struct/count-menu-export-records"), globalMethods: await s.call("struct/load-export-is-global-methods") };
      await s.call("struct/clear-export-records");
      try {
        await s.call("struct/save-bo-export-records", {}, records);
        const processId = await s.call("v2/process-indicator/pre-create-process");
        const { data, name } = await s.bytes("struct/export-company-structure", { processId });
        const dl = join(homedir(), "Downloads");
        const dir = a.out ? resolve(a.out.replace(/^~(?=\/|$)/, homedir())) : existsSync(dl) ? dl : join(CACHE, "exports");
        mkdirSync(dir, { recursive: true });
        const file = join(dir, basename(name));
        writeFileSync(file, data);
        return { ...summarize(file), alsoInBaskets: others };
      } finally {
        await s.call("struct/clear-export-records");
        if (saved.length) await s.call("struct/save-bo-export-records", {}, saved);
      }
    } },

  // 14. notifications
  { name: "notifications_read", description: "The bell (header «События»): counters and the latest entries with ids. `newThisSession` marks what appeared after this server first looked — the ones your work raised (every import leaves «Анализ импорта завершен»).",
    props: { limit: { type: "number" } },
    run: async (a) => { const s = stand(a); return { count: await s.call("v2/user-notification/count"), items: await notifications(s, a.limit ?? 30) }; } },
  { name: "notifications_clear", write: true, description: "Delete the notifications your work raised, by id (notifications_read). `all: true` wipes the user's others too — only when the user asks.",
    props: { ids: { type: "array", items: { type: "string" } }, all: { type: "boolean" } },
    run: async (a) => {
      const s = stand(a);
      if (a.all) { await s.call("v2/user-notification/delete-notifications"); return { deleted: "all" }; }
      for (const id of a.ids ?? []) await s.call("v2/user-notification/delete-notification", { notificationId: id });
      return { deleted: (a.ids ?? []).length, count: await s.call("v2/user-notification/count") };
    } },

  // 15. anything else
  { name: "stand_read", description: "Any READ method of the stand API (last path segment load-/count-/verify-/get-/find-/search-) in the standard envelope (MYBPM-UI-API.md 0U.2; which values go to params and which to body is per method — the document's recipes say). For what no other tool covers.",
    props: { path: { type: "string", description: "After /web/, e.g. v2/business-objects/load-bo-groups" }, params: { type: "object" }, body: {}, get: { type: "boolean", description: "GET without the envelope" },
      maxChars: { type: "number" } }, required: ["path"],
    run: async (a) => {
      if (AUTH_PATHS.test(a.path)) throw new Error("this method returns a session token — refused");
      if (!READ_METHOD.test(String(a.path).split("/").pop() ?? "")) throw new Error("not a read method — use stand_call (asks the user)");
      const s = stand(a);
      return trim(a.get ? await s.get(a.path) : await s.call(a.path, a.params, a.body), a.maxChars);
    } },
  { name: "stand_call", write: true, description: "Any stand API method, writes included, in the standard envelope (MYBPM-UI-API.md 0U.2). For the recipes no task tool covers yet (constructor, scripts, processes, rights, menu, records, kanban — MYBPM-UI-API.md §0U). Writes are immediate: say what it changes and get the user's OK first; read the result back afterwards.",
    props: { path: { type: "string" }, params: { type: "object" }, body: {}, get: { type: "boolean" }, maxChars: { type: "number" } }, required: ["path"],
    run: async (a) => {
      if (AUTH_PATHS.test(a.path)) throw new Error("this method returns a session token — refused");
      const s = stand(a);
      return trim(a.get ? await s.get(a.path) : await s.call(a.path, a.params, a.body), a.maxChars);
    } },
];

function trim(v: unknown, max = 30000): unknown {
  const t = typeof v === "string" ? v : JSON.stringify(v);
  return t.length > max ? `${t.slice(0, max)}\n… cut at ${max} of ${t.length} characters (raise maxChars)` : v;
}

// ── MCP over stdio: newline-delimited JSON-RPC ──────────────────────────────────────────────────────────

const VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
const version = (() => {
  for (const f of [join(HERE, "..", ".claude-plugin", "plugin.json"), join(HERE, "..", "manifest.json")])
    try { return JSON.parse(readFileSync(f, "utf8")).version; } catch {}
  return "dev";
})();

const INSTRUCTIONS = "Drives a running MyBPM stand. Platform knowledge is in the mybpm-stand / mybpm-imports skills " +
  "(MYBPM-UI-API.md, MYBPM-IMPORTS.md) — read them; these tools only do the calls. Several stand accounts may be kept: " +
  "stand_list names them and the default one, `stand` on any tool picks another by name or host, and a new account or a " +
  "re-login goes through stand_accounts (a local page — give the user its link, open their browser only when they ask; never ask for a password in the chat). Start with stand_whoami. " +
  "Write tools (import_apply, import_rollback, import_cancel, notifications_clear, stand_call) change the stand: get the user's OK first. " +
  "An archive you built where the stand is unreachable goes in with archive_put, then import_analyze → import_apply. " +
  "Finish a session by clearing the notifications your work raised (notifications_read → notifications_clear).";

function schema(t: Tool) {
  return { type: "object", properties: { ...(t.props ?? {}), ...STAND_ARGS }, ...(t.required ? { required: t.required } : {}) };
}

async function handle(msg: any): Promise<any> {
  switch (msg.method) {
    case "initialize":
      return { protocolVersion: VERSIONS.includes(msg.params?.protocolVersion) ? msg.params.protocolVersion : VERSIONS[0],
        capabilities: { tools: {} }, serverInfo: { name: "mybpm-stand", version }, instructions: INSTRUCTIONS };
    case "ping": return {};
    case "tools/list":
      return { tools: tools.map((t) => ({ name: t.name, description: t.description, inputSchema: schema(t),
        annotations: { readOnlyHint: !t.write && !["stand_accounts", "stand_use", "archive_put", "import_analyze", "structure_export"].includes(t.name), destructiveHint: !!t.write, openWorldHint: true } })) };
    case "tools/call": {
      const t = tools.find((x) => x.name === msg.params?.name);
      if (!t) throw Object.assign(new Error(`unknown tool ${msg.params?.name}`), { code: -32602 });
      try {
        await baseline(t, msg.params?.arguments ?? {});
        const out = await t.run(msg.params?.arguments ?? {});
        return { content: [{ type: "text", text: typeof out === "string" ? out : JSON.stringify(out, null, 1) }] };
      } catch (e: any) {
        return { content: [{ type: "text", text: `error: ${e.message}` }], isError: true };
      }
    }
    default:
      throw Object.assign(new Error(`method not found: ${msg.method}`), { code: -32601 });
  }
}

const send = (o: unknown) => process.stdout.write(JSON.stringify(o) + "\n");
createInterface({ input: process.stdin }).on("line", async (line) => {
  if (!line.trim()) return;
  let msg: any;
  try { msg = JSON.parse(line); } catch { return send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } }); }
  if (msg.id === undefined || msg.id === null) return; // a notification: nothing to answer
  try { send({ jsonrpc: "2.0", id: msg.id, result: await handle(msg) }); }
  catch (e: any) { send({ jsonrpc: "2.0", id: msg.id, error: { code: e.code ?? -32603, message: e.message } }); }
});
