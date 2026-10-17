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
 * Accounts — a login on a stand host; several may be kept, all equal (none is the default):
 *   ~/.config/mybpm/tokens/<host>/<login>.token  — the session token: added on the accounts page (stand_accounts)
 *                                                  or by `mise run stand-login <host> <login>`
 *   ~/.config/mybpm/accounts.json                — per account its name, the stand's origin, who logged in
 *   MYBPM_STAND + MYBPM_TOKEN (+ MYBPM_LOGIN)     — one more account from the environment (tests, a one-off)
 *   MYBPM_TRACE=<file>                           — append every stand call (path, params, body, answer; cut) as a JSON line
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
type Book = { accounts: Record<string, Meta> }; // key = `<hostDir>/<login>`
type Cred = { key: string; origin: string; login: string; name?: string; token?: string; file?: string; meta: Meta };

function readBook(): Book {
  try { const b = JSON.parse(readFileSync(BOOK, "utf8")); return { accounts: b.accounts ?? {} }; }
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

/** Which account a call goes to: `stand` is an account name or a host; nothing named = the only account there is. */
function pickStand(stand?: string, login?: string): Cred {
  const all = accounts();
  if (!all.length) throw new Error(NO_ACCOUNTS);
  if (!stand && !login) {
    if (all.length === 1) return all[0];
    throw new Error(`several accounts — ask the user which one to work with (unless they said it in this conversation) and pass \`stand\` on every call: ${listed(all)}`);
  }
  const want = stand?.trim().toLowerCase();
  let hits = !want ? all : all.filter((c) => c.name?.trim().toLowerCase() === want);
  if (want && !hits.length) hits = all.filter((c) => hostKey(c.origin).toLowerCase() === hostKey(want));
  if (login) hits = hits.filter((c) => c.login.toLowerCase() === login.trim().toLowerCase());
  if (hits.length === 1) return hits[0];
  if (hits.length > 1) throw new Error(`several accounts match — pass \`login\`: ${listed(hits)}`);
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
  }
  writeBook(book);
  return { key, name, stand: hostKey(o), login, fio: meta.fio, email: meta.email, companyCode: meta.companyCode };
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
  writeBook(book);
  return { removed: label(c) };
}

async function checkAccount(c: Cred, details = false) {
  try {
    const me = await authInfo(c.origin, tokenOf(c));
    if (c.file) {
      const book = readBook();
      book.accounts[c.key] = { ...(book.accounts[c.key] ?? { origin: c.origin }), fio: me.fio, email: me.email, companyCode: me.companyCode };
      writeBook(book);
    }
    if (details) return { alive: true, me };
    return { alive: true, fio: me.fio, email: me.email, companyCode: me.companyCode };
  } catch (e: any) { return { alive: false, error: e.message }; }
}

function accountRows() {
  return accounts().map((c) => ({ key: c.key, name: c.name ?? null, stand: hostKey(c.origin), origin: c.origin, login: c.login,
    fio: c.meta.fio ?? null, companyCode: c.meta.companyCode ?? null, savedAt: c.meta.savedAt ?? null,
    via: c.file ? "token file" : "MYBPM_TOKEN" }));
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
  get: (path: string) => Promise<any>; upload: (path: string, file: Uint8Array, name: string, form?: Record<string, string>) => Promise<any>;
  bytes: (path: string, params?: unknown, body?: unknown) => Promise<{ data: Uint8Array; name: string }>;
  download: (path: string) => Promise<{ data: Uint8Array; name: string }> };

function parse(text: string): any {
  if (!text) return null;
  let out: any = text;
  try { out = JSON.parse(text); } catch {}
  if (out && typeof out === "object" && !Array.isArray(out) && ("errorType" in out || "className" in out))
    throw new StandError(out.errorType ?? out.className, String(out.message ?? "").slice(0, 600));
  return out;
}

const stand = (args: { stand?: string; login?: string }): Stand => standOf(pickStand(args.stand, args.login));

function standOf(c: Cred): Stand {
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
    call: async (p, params, body) => {
      const cut = (v: unknown) => { const s = JSON.stringify(v) ?? ""; return s.length > 4000 ? s.slice(0, 4000) + "…" : s; };
      const r = text(await send((token) =>
        fetch(url(p), { method: "POST", headers: { "Content-Type": "application/json", token }, body: envelope(params, body) })));
      if (process.env.MYBPM_TRACE) await r.then((v) => ({ answer: cut(v) }), (e) => ({ error: String(e.message) }))
        .then((o) => appendFileSync(process.env.MYBPM_TRACE!, JSON.stringify({ p, params: cut(params), body: cut(body), ...o }) + "\n"));
      return r;
    },
    get: async (p) => text(await send((token) => fetch(url(p), { headers: { token } }))),
    upload: async (p, file, name, form) => text(await send((token) => {
      const fd = new FormData();
      fd.append("file", new Blob([file]), name);
      for (const [k, v] of Object.entries(form ?? {})) fd.append(k, v);
      return fetch(url(p), { method: "POST", headers: { token }, body: fd });
    })),
    bytes: async (p, params, body) => fileOf(await send((token) =>
      fetch(url(p), { method: "POST", headers: { "Content-Type": "application/json", token }, body: envelope(params, body) })), "export.mybpm.zip"),
    download: async (p) => fileOf(await send((token) => fetch(url(p), { headers: { token } })), "download.xlsx"),
  };
}

/** A file answer: its bytes and the name from Content-Disposition (`+` there is a space); a JSON error body throws. */
async function fileOf(r: Response, fallback: string): Promise<{ data: Uint8Array; name: string }> {
  const data = new Uint8Array(await r.arrayBuffer());
  if (data[0] === 0x7b) parse(new TextDecoder().decode(data)); // `{` = an error body, not a zip
  if (!r.ok) throw new StandError(`HTTP ${r.status}`, new TextDecoder().decode(data).slice(0, 300));
  const name = /filename\*?=(?:UTF-8'')?"?([^";]+)/i.exec(r.headers.get("content-disposition") ?? "")?.[1];
  return { data, name: name ? decodeURIComponent(name.replace(/\+/g, " ")) : fallback };
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
const OFFLINE = new Set(["stand_list", "stand_accounts", "stand_remove", "archive_put", "archive_lint", "platform_report"]);

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

// ── the constructor (MYBPM-UI-API.md R1, R2, R2a, §5i, §5j) ──────────────────────────────────────────────

const BO_ = "v2/business-objects/";
const ru = (v: string | null) => ({ KAZ: null, ENG: null, RUS: v, QAZ: null });
const WIDGETS = ["BUTTON", "IFRAME", "SIGNATURE", "CAPTCHA", "CURRENT_DATE", "CURRENT_DAY", "CURRENT_MONTH", "CURRENT_DAY_AND_MONTH", "CURRENT_YEAR", "CURRENT_USER"];
const NATIVES = ["CREATED_AT", "CREATED_BY", "LAST_MODIFIED_AT", "LAST_MODIFIED_BY", "OPEN_COUNT", "IN_MIGRATION_UPDATED_AT"];
const ROWS_6 = ["TEXTAREA", "TEXTAREA_LANG", "LINK", "FILE_UPLOAD", "CHECKLIST", "RADIO_BUTTON_GROUP", "PROGRESS_BAR", "SIGNATURE", "CAPTCHA", "CURRENT_USER"];
const ROWS_8 = ["QUESTIONNAIRE", "GEO_POINT", "IFRAME"];
const ALONE = ["TEXTAREA", "TEXTAREA_LANG", "TAB_GROUP", "CHECKLIST", "QUESTIONNAIRE", "GEO_POINT", "PROGRESS_BAR", "IFRAME"];
const HEADING = (t: string) => `<div style="font-size:18px;font-weight:700;color:#1f2d3d;border-bottom:1px solid #d9dee5;padding-bottom:6px">${t}</div>`;
const WIDGET_CODE: Record<string, [controller: string, method: string, idKey: string]> = {
  SIGNATURE: ["signature", "save-signature-code", "signatureId"], BUTTON: ["button", "save-button-code", "buttonId"],
  IFRAME: ["iframe", "save-iframe-code", "iframeId"], CAPTCHA: ["captcha", "save-captcha-code", "captchaId"],
  CURRENT_USER: ["widget-current-user", "save-current-user-code", "currentUserId"],
  ...Object.fromEntries(["CURRENT_DATE", "CURRENT_DAY", "CURRENT_MONTH", "CURRENT_DAY_AND_MONTH", "CURRENT_YEAR"]
    .map((t) => [t, ["current-date", "save-current-date-code", "currentDateId"]])),
};
// dropped on a field that is being added: a second patch on the saved field sets them (§5h «Поведение»)
const LOST_ON_ADD = ["useAsKeyInMigration", "needMarkNew", "needAddToParticipants"];

type Opt = string | { label: string; code?: string; color?: string };
type FieldSpec = { label?: string; type: string; code?: string; refBoId?: string; viewType?: "TABLE" | "SINGLE"; options?: Opt[];
  required?: boolean; unique?: boolean; readonly?: boolean; column?: boolean; cols?: number; rows?: number; x?: number; y?: number;
  tab?: string; heading?: boolean; html?: string; url?: string; set?: Record<string, unknown> };

const FIELD_SPEC = { type: "object", required: ["type"], properties: {
  label: { type: "string", description: "The label — the field's code is NOT derived from it if you pass `code`; get it right the first time (trap 22)." },
  type: { type: "string", description: "A field type of UI-API §5i (INPUT_TEXT, INPUT_NUMBER, DATE, FULL_DATE, DROPDOWN_SINGLE, BO, CO, TEXTAREA, STATIC_TEXT, …), a widget (BUTTON, IFRAME, SIGNATURE, CAPTCHA, CURRENT_DATE…, CURRENT_USER) or a system field (CREATED_AT, CREATED_BY, LAST_MODIFIED_AT, LAST_MODIFIED_BY, OPEN_COUNT, IN_MIGRATION_UPDATED_AT)." },
  code: { type: "string", description: "The code by the naming convention (0U.5 rule 12: English snake_case, `is_*` for a CHECKBOX); set right after the save. Pass it for every field and widget." },
  refBoId: { type: "string", description: "BO / CO: the BO shown (a user field: personBoId of stand_list); DROPDOWN_SINGLE: the dictionary it reads (optionSource FROM_BO)." },
  viewType: { type: "string", enum: ["TABLE", "SINGLE"], description: "BO / CO: a table (6 rows high, full width) or one chip (3 rows). Default TABLE." },
  options: { type: "array", items: {}, description: "DROPDOWN_SINGLE / RADIO_BUTTON_GROUP: the local list (FROM_FIELD); CHECKLIST: its items. A string or {label, code, color}." },
  required: { type: "boolean" }, unique: { type: "boolean" }, readonly: { type: "boolean", description: "Never together with required." },
  column: { type: "boolean", description: "A registry column. Default: the first field, plus required / unique ones; 6 at most (R1 «Layout»)." },
  cols: { type: "number", description: "Width of 15. Short fields that belong together share a row: 8 + 7 or 5 + 5 + 5 — consecutive fields that fit are packed into one row. Default 15." },
  rows: { type: "number", description: "Height; default by type (R1 «Layout»: 3 one-line, 6 text/table/file, 8 questionnaire/map)." },
  x: { type: "number" }, y: { type: "number", description: "x / y on every field = you own the layout; otherwise it is packed for you." },
  tab: { type: "string", description: "The tab label this field goes on: every field with a `tab` lands in one TAB_GROUP (code `tabs`) placed where the first of them stands; tabs in order of appearance, the first is the default." },
  heading: { type: "boolean", description: "STATIC_TEXT: a section heading (the styled <div> of R1 «Layout», label hidden, no column)." },
  html: { type: "string", description: "STATIC_TEXT: the HTML shown." },
  url: { type: "string", description: "BUTTON / IFRAME: its url (https only for an IFRAME)." },
  set: { type: "object", description: "Any other key of the field DTO, e.g. {\"params\":{\"viewType\":\"TILE\",\"contentType\":\"ALL\"}} for a FILE_UPLOAD (§5h, §5i)." },
} };

/** save-business-object-portion: the JSON cut at 80 000 characters, each part carrying the previous part's id (R1 step 7). */
async function savePortion(s: Stand, payload: object) {
  const json = JSON.stringify(payload);
  let id: string | null = null;
  for (let i = 0, n = Math.max(1, Math.ceil(json.length / 80000)); i < n; i++)
    id = await s.call(BO_ + "save-business-object-portion", {}, { jsonPart: json.slice(i * 80000, (i + 1) * 80000), orderIndex: i, isLast: i === n - 1, id });
}

const loadBo = (s: Stand, id: string) => s.call(BO_ + "load-business-object-by-id", { businessObjectId: id });

async function groupOf(s: Stand, group: string) {
  const groups = (await s.call(BO_ + "load-bo-groups", { forEdit: true })) ?? [];
  const g = groups.find((x: any) => x.id === group) ?? groups.filter((x: any) => x.name?.toLowerCase() === group.trim().toLowerCase())[0];
  if (!g) throw new Error(`no BO group «${group}» — the group must exist (bo_groups lists them): ${groups.map((x: any) => x.name).join(", ")}`);
  return g;
}

async function freshIds(s: Stand, n: number): Promise<string[]> {
  const ids: string[] = [];
  while (ids.length < n) {
    const got = (await s.call("v2/id-loader/load-portion")) ?? [];
    if (!got.length) throw new Error("v2/id-loader/load-portion returned no ids");
    ids.push(...got);
  }
  return ids.slice(0, n);
}

/** The columns of a reference: the target's registry columns, else its first field; at most 5 shown (trap 53). */
async function boFieldRefs(s: Stand, refBoId: string) {
  const t = await loadBo(s, refBoId);
  const fields = [...(t.formFields ?? [])]
    .sort((a, b) => (a.gridPosition?.y ?? 0) - (b.gridPosition?.y ?? 0) || (a.gridPosition?.x ?? 0) - (b.gridPosition?.x ?? 0))
    .sort((a, b) => (a.tableColOrderIndex ?? 0) - (b.tableColOrderIndex ?? 0));
  const any = fields.some((f) => f.tableColToShow), refs: any[] = [];
  for (const g of fields) {
    let toShow = !!g.tableColToShow || (!any && !refs.some((x) => x.toShow));
    if (["TAB_GROUP", "PROGRESS_BAR", "STATIC_TEXT"].includes(g.type) || refs.filter((x) => x.toShow).length >= 5) toShow = false;
    refs.push({ fieldId: g.fieldId, label: g.label, toShow, type: g.type, checked: false, orderIndex: g.tableColOrderIndex, gridPosition: g.gridPosition });
  }
  return refs;
}

const isRef = (f: FieldSpec) => f.type === "BO" || f.type === "CO";
const heightOf = (f: FieldSpec) => f.rows ?? (ROWS_8.includes(f.type) ? 8 : ROWS_6.includes(f.type) ? 6
  : isRef(f) || f.type === "CREATED_BY" || f.type === "LAST_MODIFIED_BY" ? (f.viewType === "SINGLE" ? 3 : 6) : 3);
const aloneOf = (f: FieldSpec) => ALONE.includes(f.type) || (isRef(f) && f.viewType !== "SINGLE") || (f.type === "STATIC_TEXT" && f.heading);
const visible = (f: FieldSpec) => !["STATIC_TEXT", "TAB_GROUP"].includes(f.type) && !NATIVES.includes(f.type);

type Cell = { x: number; y: number; cols: number; rows: number };
/** Pack the fields of one container (the form or a tab) into rows of 15 columns, from `y0` down (R1 «Layout»). */
function pack(specs: FieldSpec[], y0: number, notes: string[], where: string): { cells: Cell[]; bottom: number } {
  const cells: Cell[] = [];
  let y = y0, row: Cell[] = [];
  const close = () => {
    if (!row.length) return;
    const used = row.reduce((n, c) => n + c.cols, 0);
    if (used < 15 && !(row.length === 1 && row[0].cols === 8)) notes.push(`${where}: the row at y ${row[0].y} fills ${used} of 15 columns`);
    y += row[0].rows; row = [];
  };
  for (const f of specs) {
    const cols = aloneOf(f) ? 15 : Math.min(15, Math.max(1, f.cols ?? 15)), rows = heightOf(f);
    const used = row.reduce((n, c) => n + c.cols, 0);
    if (row.length && (aloneOf(f) || used + cols > 15 || row[0].rows !== rows)) close();
    const c = { x: row.reduce((n, c) => n + c.cols, 0), y, cols, rows };
    row.push(c); cells.push(c);
  }
  close();
  const short = specs.filter((f, i) => visible(f) && !aloneOf(f) && cells[i].cols === 15 && heightOf(f) === 3).length;
  if (short >= 4) notes.push(`${where}: ${short} short one-line fields stand alone at full width — pair them (cols 8 + 7, 5 + 5 + 5)`);
  const lone = specs.filter((_, i) => cells[i].cols === 8 && !cells.some((c, j) => j !== i && c.y === cells[i].y)).length;
  if (lone > 2) notes.push(`${where}: ${lone} fields alone at cols 8 — at most 2 per form / tab`);
  if (specs.filter(visible).length > 12) notes.push(`${where}: ${specs.filter(visible).length} visible fields — over 12 asks for tabs (pass \`tab\`)`);
  return { cells, bottom: y };
}

const bottomOf = (fields: any[]) => Math.max(0, ...fields.filter((f) => !f.tabId).map((f) => (f.gridPosition?.y ?? 0) + (f.gridPosition?.rows ?? 0)));

/**
 * Generate, lay out and save new fields on a BO in one portion save (R1 steps 5–7, §5i), then the second patch,
 * the codes and widget urls. Returns what was added and the layout notes.
 */
async function addFields(s: Stand, boId: string, specs: FieldSpec[], window?: boolean | { w?: number; h?: number }) {
  const notes: string[] = [];
  const bo = await loadBo(s, boId);
  const own = specs.every((f) => f.x !== undefined && f.y !== undefined);
  const plain = specs.filter((f) => !f.tab), tabbed = specs.filter((f) => f.tab);
  const tabLabels = [...new Set(tabbed.map((f) => f.tab!))];
  const added: any[] = [], edits: any[] = [], later: { spec: FieldSpec; dto: any }[] = [];
  const hadColumn = (bo.formFields ?? []).some((f: any) => f.tableColToShow);

  // where everything goes: the top level gets the plain fields and, at the first tabbed field's place, one TAB_GROUP
  const groupAt = tabbed.length ? specs.indexOf(tabbed[0]) : -1;
  const top: FieldSpec[] = plain.slice();
  const groupSpec: FieldSpec = { type: "TAB_GROUP", label: undefined, code: "tabs" };
  if (groupAt >= 0) top.splice(specs.slice(0, groupAt).filter((f) => !f.tab).length, 0, groupSpec);
  const tabPacks = tabLabels.map((t) => pack(tabbed.filter((f) => f.tab === t), 0, notes, `tab «${t}»`));
  if (groupAt >= 0) groupSpec.rows = Math.max(...tabPacks.map((p) => p.bottom)) + 3;
  const y0 = bottomOf(bo.formFields ?? []);
  const topPack = own ? { cells: [], bottom: 0 } : pack(top, y0, notes, "form");
  const tabIds = tabLabels.length ? await freshIds(s, tabLabels.length) : [];

  const optIds = await freshIds(s, specs.reduce((n, f) => n + (["DROPDOWN_SINGLE", "RADIO_BUTTON_GROUP"].includes(f.type) ? f.options?.length ?? 0 : 0), 0));
  let column = (bo.formFields ?? []).filter((f: any) => f.tableColToShow).length;

  const make = async (f: FieldSpec, cell: Cell | undefined, tabId: string | undefined) => {
    const dto = WIDGETS.includes(f.type) ? await s.call(BO_ + "generate-business-form-widget", { widgetType: f.type })
      : NATIVES.includes(f.type) ? await s.call(BO_ + "generate-business-form-field-by-native", { nativeType: f.type })
      : await s.call(BO_ + "generate-business-form-field", { boId, fieldType: f.type, ...(isRef(f) && f.refBoId ? { fieldBoId: f.refBoId } : {}) });
    if (!dto?.fieldId) throw new Error(`the stand made no field for ${f.type}${f.type === "PARTICIPANTS" ? " (PARTICIPANTS cannot be created)" : ""}`);
    const gridPosition = own && f.x !== undefined ? { x: f.x, y: f.y!, cols: f.cols ?? 15, rows: heightOf(f) } : cell!;
    const edit: any = { fieldId: dto.fieldId, gridPosition, needFreezeWhenScroll: false };
    const set = (k: string, v: unknown) => { dto[k] = v; edit[k] = v; };
    dto.gridPosition = gridPosition;
    if (f.label) { set("label", f.label); set("labelMap", ru(f.label)); }
    if (tabId) set("tabId", tabId);
    if (f.required) set("isRequired", true);
    if (f.unique) set("isUnique", true);
    if (f.readonly) set("isReadonly", true);
    if (f.type === "STATIC_TEXT") {
      set("staticValueMap", ru(f.heading ? HEADING(f.html ?? f.label ?? "") : f.html ?? ""));
      if (f.heading) set("hideLabel", true);
    }
    if (isRef(f) && f.refBoId) {
      set("refBoId", f.refBoId); set("viewType", f.viewType ?? "TABLE"); set("boFieldRefs", await boFieldRefs(s, f.refBoId));
    }
    if ((f.type === "CREATED_BY" || f.type === "LAST_MODIFIED_BY") && f.viewType) set("viewType", f.viewType);
    if (f.type === "DROPDOWN_SINGLE" && f.refBoId) { set("optionSource", "FROM_BO"); set("refBoId", f.refBoId); set("options", []); }
    if (["DROPDOWN_SINGLE", "RADIO_BUTTON_GROUP"].includes(f.type) && f.options?.length) {
      set("optionSource", "FROM_FIELD"); set("refBoId", null);
      set("options", f.options.map((o, j) => { const v = typeof o === "string" ? { label: o } : o;
        return { instanceId: null, id: optIds.shift(), label: v.label, color: v.color ?? null, code: v.code ?? null, orderIndex: j, hiddenInKanban: false, labelMap: ru(v.label) }; }));
    }
    if (f.type === "CHECKLIST" && f.options?.length) {
      set("defaultValue", JSON.stringify(f.options.map((o) => ({ label: typeof o === "string" ? o : o.label, checked: false })))); set("isAppendable", true);
    }
    const wantColumn = f.column ?? ((f.required || f.unique) ? true : !hadColumn && column === 0 && visible(f) && !WIDGETS.includes(f.type) ? true : undefined);
    if (wantColumn !== undefined) {
      set("tableColToShow", wantColumn);
      if (wantColumn) set("tableColOrderIndex", column++);
    }
    for (const [k, v] of Object.entries(f.set ?? {})) set(k, v);
    added.push(dto); edits.push(edit); later.push({ spec: f, dto });
    return dto;
  };

  for (const [i, f] of top.entries()) {
    if (f !== groupSpec) { await make(f, topPack.cells[i], undefined); continue; }
    const g = await make(f, topPack.cells[i] ?? { x: 0, y: y0, cols: 15, rows: f.rows! }, undefined);
    const tabs = tabLabels.map((t, j) => ({ id: tabIds[j], label: t, labelMap: ru(t), isActive: j === 0, chosenAccessRight: false, orderIndex: j, isInvalid: false, isRight: false, isDefault: j === 0 }));
    g.tabs = tabs; edits[edits.length - 1].tabs = tabs;
    for (const [j, t] of tabLabels.entries()) {
      const mine = tabbed.filter((x) => x.tab === t);
      for (const [k, x] of mine.entries()) await make(x, tabPacks[j].cells[k], tabIds[j]);
    }
  }
  if (column > 6) notes.push(`${column} registry columns — 6 at most (R1 «Layout»): pass column:false on the minor ones`);

  bo.formFields = [...(bo.formFields ?? []), ...added];
  await savePortion(s, { businessObject: bo, editedFields: edits, addedFieldIds: added.map((f) => f.fieldId), deletedFieldIds: [] });

  // the keys an added field loses, in ONE patch per field (a same-field patch without needMarkNew resets it)
  const second = later.map(({ dto }) => ({ fieldId: dto.fieldId, ...Object.fromEntries(LOST_ON_ADD.filter((k) => dto[k]).map((k) => [k, true])) }))
    .filter((p) => Object.keys(p).length > 1);
  if (second.length) {
    const saved = await loadBo(s, boId);
    for (const f of saved.formFields ?? []) Object.assign(f, second.find((p) => p.fieldId === f.fieldId) ?? {});
    await savePortion(s, { businessObject: saved, editedFields: second, addedFieldIds: [], deletedFieldIds: [] });
  }

  // codes (0U.5 rule 4 + 12) and widget urls — after the save, each by its own setter, all in PARAMS; a setter
  // called right after the save does not see the field yet (NoBoFieldWithId) — it is retried until it does
  const uncoded: string[] = [];
  const settled = async <T>(go: () => Promise<T>): Promise<T> => {
    for (let i = 0; ; i++) {
      try { return await go(); } catch (e: any) { if (i >= 20 || !/NoBoFieldWithId/.test(e.message)) throw e; await sleep(500); }
    }
  };
  for (const { spec, dto } of later) {
    const w = WIDGET_CODE[spec.type];
    if (spec.code && w) await settled(() => s.call(`v2/${w[0]}/${w[1]}`, { boId, [w[2]]: dto.fieldId, code: spec.code }));
    else if (spec.code && !NATIVES.includes(spec.type))
      await settled(() => s.call(BO_ + "save-business-field-code", { businessObjectId: boId, businessFieldId: dto.fieldId, businessFieldCode: spec.code }));
    else if (!NATIVES.includes(spec.type) && !(spec.type === "STATIC_TEXT")) uncoded.push(spec.label ?? spec.type);
    if (spec.url && spec.type === "BUTTON") await settled(() => s.call("v2/button/save-button-url", { boId, buttonId: dto.fieldId, url: spec.url }));
    if (spec.url && spec.type === "IFRAME") await settled(() => s.call("v2/iframe/save-iframe-url", { boId, iframeId: dto.fieldId, url: spec.url }));
  }
  // option codes: ADD generates them from the labels, and a little after the save — an EDIT of `options` (what the
  // constructor sends) made too early is overwritten; so it goes after the setters above, read back, repeated
  const wantCodes = (spec: FieldSpec) => (spec.options ?? []).map((o) => (typeof o === "string" ? null : o.code ?? null));
  const coded = later.filter(({ spec }) => ["DROPDOWN_SINGLE", "RADIO_BUTTON_GROUP"].includes(spec.type) && wantCodes(spec).some(Boolean));
  const byOrder = (f: any) => [...(f?.options ?? [])].sort((a: any, b: any) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
  for (let i = 0; coded.length; i++) {
    const cur = await loadBo(s, boId), edits: any[] = [], off: string[] = [];
    for (const { spec, dto } of coded) {
      const f = (cur.formFields ?? []).find((x: any) => x.fieldId === dto.fieldId), opts = byOrder(f), codes = wantCodes(spec);
      const wrong = codes.map((c, j) => (c && opts[j]?.code !== c ? `${c} → ${opts[j]?.code}` : null)).filter(Boolean);
      if (!f || !wrong.length) continue;
      off.push(`«${spec.label ?? spec.type}»: ${wrong.join(", ")}`);
      f.options = opts.map((o: any, j: number) => (codes[j] ? { ...o, code: codes[j] } : o));
      edits.push({ fieldId: f.fieldId, options: f.options });
    }
    if (!edits.length) break;
    if (i >= 4) { notes.push(`option codes not kept (set them in the field body of the constructor): ${off.join("; ")}`); break; }
    if (i) await sleep(1000);
    await savePortion(s, { businessObject: cur, editedFields: edits, addedFieldIds: [], deletedFieldIds: [] });
  }
  if (uncoded.length) notes.push(`no \`code\` given — the server's transliteration stays (0U.5 rule 12 wants English snake_case): ${uncoded.join(", ")}`);
  if (tabLabels.length) notes.push("tab codes stay derived from the tab labels (rule 12 wants tab_*) — set them in the constructor's tab popover");

  // the record window (R1 «Layout»): h = form rows + 5, w 10 for one-line fields, 12 with tables or shared rows
  let win: unknown;
  if (window !== false && bo.boCategory !== "BO_PANEL") {
    const after = await loadBo(s, boId);
    const rows = bottomOf(after.formFields ?? []);
    const wide = (after.formFields ?? []).some((f: any) => (f.gridPosition?.cols ?? 15) < 15 || (f.type === "BO" && f.viewType === "TABLE"));
    const w = (typeof window === "object" && window.w) || (wide ? 12 : 10), h = (typeof window === "object" && window.h) || rows + 5;
    if (h > 28) notes.push(`the record window needs h ${h} — over ~28 (90 % of a 1080p screen): split into tabs or open records as a page tab (§5j)`);
    await s.call(BO_ + "save-business-object-grid-layout-position", {}, { boId, gridLayoutPosition: { id: "0", x: Math.ceil((16 - w) / 2), y: 0, w, h } });
    win = { w, h };
  }
  return { added: later.map(({ spec, dto }) => ({ fieldId: dto.fieldId, label: spec.label ?? dto.label, type: spec.type })), window: win, notes };
}

/** One row per field of a BO read back: what a caller compares against what it asked for. */
const fieldRows = (bo: any) => (bo.formFields ?? []).map((f: any) => clean({ fieldId: f.fieldId, code: f.code, label: f.label,
  type: f.type ?? f.widgetType ?? f.nativeFieldType, tabId: f.tabId,
  grid: f.gridPosition && [f.gridPosition.x, f.gridPosition.y, f.gridPosition.cols, f.gridPosition.rows].join("/"),
  required: f.isRequired || undefined, column: f.tableColToShow ? f.tableColOrderIndex ?? true : undefined }));

// ── records (MYBPM-UI-API.md §6a, §6b, traps 46, 47) ─────────────────────────────────────────────────────

const BOI_ = "v2/business-object-instance/";
const DATES = ["DATE", "FULL_DATE", "TIME", "YEAR", "YEAR_AND_MONTH"];
const LANGS = ["INPUT_TEXT_LANG", "TEXTAREA_LANG", "STATIC_TEXT"];
const NOT_VALUES = ["TAB_GROUP", "PARTICIPANTS"];

// trap 73: the ES breaker fails a call and lets the same call through seconds or minutes later
const ES_ERR = /EsDataTooLarge|Data too large/i;
const ES_WAIT = Number(process.env.MYBPM_ES_WAIT_MS ?? 60000);
const ES_PAUSE = Math.min(3000, ES_WAIT / 20);
const APPLY = /apply-remove-draft|apply-and-remove-draft/;

/** The stand with every record call repeated while ES breaks — except an apply, which goes through applyDraft. */
const esRetry = (s: Stand): Stand => ({ ...s, call: async (p, params, body) => {
  for (const t0 = Date.now(); ;) {
    try { return await s.call(p, params, body); }
    catch (e: any) { if (APPLY.test(p) || !ES_ERR.test(e.message) || Date.now() - t0 > ES_WAIT) throw e; await sleep(ES_PAUSE); }
  }
} });

/** An apply of a draft under trap 73: repeated while ES breaks; a repeat that finds the draft gone means an
 *  earlier attempt went through (§5b «Data too large») — `{ appliedEarlier: true }`, the caller re-reads the record. */
async function applyDraft(s: Stand, p: string, params: unknown): Promise<any> {
  for (let t0 = Date.now(), broke = false; ;) {
    try { return await s.call(p, params, {}); }
    catch (e: any) {
      if (broke && /NoBoInstanceDraft/.test(e.message)) return { appliedEarlier: true };
      if (!ES_ERR.test(e.message) || Date.now() - t0 > ES_WAIT) throw e;
      broke = true; await sleep(ES_PAUSE);
    }
  }
}

/** The fields a record carries a value in: the BO's dynamic fields (no widgets, system fields or tab groups). */
const valueFields = (bo: any) => (bo.formFields ?? []).filter((f: any) => f.type && !f.widgetType && !f.nativeFieldType && !NOT_VALUES.includes(f.type));
const nameOf = (f: any) => f.code || f.label || f.fieldId;

/** A field by code, fieldId or exact label (the label only when no other field shares it). */
function fieldBy(fields: any[], key: string) {
  const f = fields.find((x) => x.code === key) ?? fields.find((x) => x.fieldId === key);
  if (f) return f;
  const byLabel = fields.filter((x) => x.label === key);
  if (byLabel.length === 1) return byLabel[0];
  throw new Error(`no field «${key}»${byLabel.length ? " — several fields carry this label, pass the code" : ""}: ${fields.map(nameOf).join(", ")}`);
}

const iso = (v: unknown) => {
  const d = new Date(v as any);
  if (isNaN(d.getTime())) throw new Error(`«${v}» is not a date — pass an ISO date or instant (2026-10-17, 2026-10-17T09:30:00Z)`);
  return d.toISOString();
};

/** A plain value → what save-field-value / save-boi-value store for this field type (§6b «The value … per type»). */
function toStored(f: any, v: any): string | null {
  const t = f.type, json = (x: unknown) => (typeof x === "string" ? x : JSON.stringify(x));
  if (v === null || v === undefined) return DATES.includes(t) ? null : t === "BO" || t === "CO" || t === "FILE_UPLOAD" ? "[]" : "";
  if (DATES.includes(t)) return JSON.stringify(iso(v));
  if (t === "PERIOD" || t === "PERIOD_TIME") {
    const start = v.startDate ?? v.start ?? v[0], end = v.endDate ?? v.end ?? v[1];
    return JSON.stringify({ startDate: iso(start), endDate: iso(end) });
  }
  if (t === "CHECKBOX") return String(v === true || /^(true|да|yes|1)$/i.test(String(v)));
  if (t === "DROPDOWN_SINGLE" || t === "RADIO_BUTTON_GROUP") {
    if (f.optionSource === "FROM_BO") return String(v); // the dictionary record's CODE: stored as its id, the card shows it
    const opts: any[] = f.options ?? [], s = String(v).trim().toLowerCase();
    const o = opts.find((x) => x.id === v) ?? opts.find((x) => x.code && x.code.toLowerCase() === s) ?? opts.find((x) => String(x.label).toLowerCase() === s);
    if (!o) throw new Error(`«${v}» is not an option of «${nameOf(f)}»: ${opts.map((x) => x.label + (x.code ? ` (${x.code})` : "")).join(", ")}`);
    return o.id;
  }
  if (t === "BO" || t === "CO" || t === "FILE_UPLOAD") return JSON.stringify(Array.isArray(v) ? v : [v]);
  if (LANGS.includes(t)) return JSON.stringify(typeof v === "string" ? { RUS: v } : v);
  if (t === "CHECKLIST") return JSON.stringify((Array.isArray(v) ? v : [v]).map((x) => (typeof x === "string" ? { label: x, checked: false } : x)));
  if (["GEO_POINT", "QUESTIONNAIRE", "PROGRESS_BAR"].includes(t)) return json(v);
  return String(v);
}

/** Every value of one record: load-boi-values once outside tabs and once per tab of each TAB_GROUP (tabId:null misses tab fields). */
async function recordValues(s: Stand, bo: any, boiId: string) {
  const tabs = (bo.formFields ?? []).filter((f: any) => f.type === "TAB_GROUP").flatMap((g: any) => (g.tabs ?? []).map((t: any) => t.id));
  const got = new Map<string, any>();
  let state: string | undefined;
  for (const tabId of [null, ...tabs]) {
    const r = await s.call(BOI_ + "v2/load-boi-values", {}, { businessObjectId: bo.id, boInstanceId: boiId, draftId: null, tabId });
    state ??= r?.state;
    for (const v of r?.fields ?? []) if (!got.has(v.fieldId)) got.set(v.fieldId, v);
  }
  const refs = valueFields(bo).filter((f: any) => f.type === "BO" || f.type === "CO");
  if (refs.length) {
    // load-boi-values answers "" for BO / CO fields; a bare §6a draft runs no hook and load-field-data gives storedValue
    const draftId = await s.call(BOI_ + "create-draft", {}, {});
    try {
      const data: any[] = (await s.call("v2/instance-field-form/load-field-data", { boId: bo.id, boiId, draftId })) ?? [];
      for (const f of refs) { const d = data.find((x) => x.fieldId === f.fieldId); if (d) got.set(f.fieldId, { ...got.get(f.fieldId), value: d.storedValue, displayValue: undefined }); }
    } finally { await s.call(BOI_ + "remove-draft", { draftId }, {}).catch(() => {}); }
  }
  const values: Record<string, unknown> = {};
  for (const f of valueFields(bo)) {
    const v = got.get(f.fieldId);
    if (!v) continue;
    const empty = v.value === "" || v.value === "[]" || v.value === null;
    if (empty && (v.displayValue ?? "") === "") continue;
    values[nameOf(f)] = v.displayValue === undefined || v.displayValue === v.value || v.displayValue === "" ? v.value : { value: v.value, display: v.displayValue };
  }
  return { state, values };
}

/** Commands of a form answer, flattened: «CLOSE_DIALOG_SAVE», field errors, notifications. */
function formOutcome(answers: any[], fields: any[]) {
  const all = JSON.stringify(answers);
  const errors: any[] = [], notes: any[] = [];
  const walk = (o: any) => {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) return o.forEach(walk);
    if (o.commandType === "SHOW_FIELD_ERROR") { const f = fields.find((x) => x.fieldId === o.fieldId); errors.push({ field: f ? nameOf(f) : o.fieldId, error: o.errorMessage }); }
    if (o.commandType === "SHOW_NOTIFICATION") {
      const b = o.notificationBody ?? {};
      notes.push(clean({ type: b.notificationType ?? o.notificationType ?? o.type, text: b.notificationText?.text ?? o.message ?? o.text,
        details: b.details?.map((d: any) => d.text), scriptErrorId: o.scriptErrorId ?? undefined }));
      return;
    }
    Object.values(o).forEach(walk);
  };
  walk(answers);
  return { saved: all.includes("CLOSE_DIALOG_SAVE"), errors, notifications: notes };
}

// ── xlsx of records (MYBPM-UI-API.md R7, §6; MYBPM-IMPORTS.md Part III) ───────────────────────────────────

const XF_ = "v2/bo-transfer/";
const ID_COLUMN = "Внутренний айди";
const unxml = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const enxml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const colName = (i: number) => { let s = ""; for (i++; i; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s; return s; };
const colIndex = (letters: string) => [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
const texts = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => unxml(m[1])).join("");

/** The first sheet of an xlsx as a grid of strings (inline, shared and plain cells) and its header: one row, or two
 *  when the freeze is at row 3 (nested blocks); a column = (row-1 caption carried over its merge, row-2 sub-header). */
function readSheet(bytes: Uint8Array) {
  const entries = unzip(Buffer.from(bytes));
  const get = (n: string) => entries.find((e) => e.name === n)?.data.toString("utf8");
  const sheet = entries.map((e) => e.name).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort()[0];
  if (!sheet) throw new Error("not an xlsx: no worksheet");
  const shared = [...(get("xl/sharedStrings.xml") ?? "").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => texts(m[1]));
  const xml = get(sheet)!, grid: string[][] = [];
  for (const r of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const n = Number(/\br="(\d+)"/.exec(r[1])?.[1] ?? grid.length + 1), cells: string[] = [];
    for (const c of (r[2] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = /\br="([A-Z]+)\d+"/.exec(c[1])?.[1], t = /\bt="(\w+)"/.exec(c[1])?.[1], inner = c[2] ?? "";
      const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
      cells[ref ? colIndex(ref) : cells.length] = t === "inlineStr" ? texts(inner) : v === undefined ? "" : t === "s" ? shared[Number(v)] ?? "" : unxml(v);
    }
    grid[n - 1] = Array.from(cells, (x) => x ?? "");
  }
  const rows = Array.from(grid, (r) => r ?? []);
  const head = Number(/<pane\b[^>]*\bySplit="([\d.]+)"/.exec(xml)?.[1] ?? 1) >= 2 ? 2 : 1;
  const caption = [...(rows[0] ?? [])];
  for (const m of xml.matchAll(/<mergeCell ref="([A-Z]+)1:([A-Z]+)1"\/>/g))
    for (let i = colIndex(m[1]) + 1; i <= colIndex(m[2]); i++) caption[i] = caption[colIndex(m[1])];
  const width = Math.max(caption.length, rows[1]?.length ?? 0);
  const columns = Array.from({ length: width }, (_, i) => ({ column: colName(i), caption: caption[i] ?? "", sub: head === 2 ? rows[1]?.[i] ?? "" : "" }));
  return { entries, sheet, xml, head, columns, data: rows.slice(head) };
}

/** A sheet with these data rows under its header, every cell an inline string (a numeric cell breaks lookups, R7 step 2). */
function writeSheet(x: ReturnType<typeof readSheet>, lines: string[][]): Uint8Array {
  const rows = lines.map((r, j) => `<row r="${x.head + j + 1}">` + r.map((v, i) => (v === "" ? "" :
    `<c r="${colName(i)}${x.head + j + 1}" t="inlineStr"><is><t xml:space="preserve">${enxml(v)}</t></is></c>`)).join("") + "</row>");
  const last = `${colName(x.columns.length - 1)}${x.head + lines.length}`;
  const xml = x.xml.replace(/<sheetData>[\s\S]*<\/sheetData>|<sheetData\/>/, (all) => {
    const keep = [...all.matchAll(/<row\b[^>]*?(?:\/>|>[\s\S]*?<\/row>)/g)].map((m) => m[0]).slice(0, x.head);
    return `<sheetData>${keep.join("\n")}\n${rows.join("\n")}\n</sheetData>`;
  }).replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="A1:${last}"/>`);
  return zip(x.entries.map((e) => ({ name: e.name, data: new Uint8Array(e.name === x.sheet ? Buffer.from(xml, "utf8") : e.data) })));
}

/** The fields an xlsx carries: the record's values, no headings. */
const xlsxFields = (bo: any) => valueFields(bo).filter((f: any) => f.type !== "STATIC_TEXT");

/** A field's caption in a template / export: its label, «<tab label>.<label>» for a field on a tab. */
function captionOf(bo: any, f: any): string {
  if (!f.tabId) return f.label ?? "";
  const tab = (bo.formFields ?? []).flatMap((g: any) => g.tabs ?? []).find((t: any) => t.id === f.tabId);
  return tab ? `${tab.label ?? tab.labelMap?.RUS ?? ""}.${f.label}` : f.label;
}

/** Which field each column of a sheet belongs to (by caption, never by position — R7 step 2). */
function fieldColumns(bo: any, cols: { caption: string; sub: string }[]) {
  const fields = xlsxFields(bo);
  return cols.map((c) => ({ ...c, field: c.caption === ID_COLUMN ? undefined : fields.find((f: any) => captionOf(bo, f) === c.caption) }));
}

async function template(s: Stand, boId: string, fields: any[]) {
  const q = fields.map((f) => `selectedFieldIds=${encodeURIComponent(f.fieldId)}`).join("&");
  return s.download(`${XF_}download-template?businessObjectId=${encodeURIComponent(boId)}&${q}`);
}

/** A file of the stand written to `out`, else ~/Downloads, else ~/.cache/mybpm/<sub>; the name made safe on Windows. */
function saveFile(out: string | undefined, sub: string, name: string, data: Uint8Array): string {
  const dl = join(homedir(), "Downloads");
  const dir = out ? resolve(out.replace(/^~(?=\/|$)/, homedir())) : existsSync(dl) ? dl : join(CACHE, sub);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, basename(name).replace(/[\\/:*?"<>|]/g, "-"));
  writeFileSync(file, data);
  return file;
}

/** A date as the xlsx wants it — dd.mm.yyyy (+ « HH:MM») — taken literally from an ISO string, no time zone shift. */
function xlsxDate(v: unknown, time: boolean): string {
  const s = String(v).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(s);
  if (!m) { if (/^\d{2}\.\d{2}\.\d{4}/.test(s)) return s; throw new Error(`«${s}» is not a date — pass 2026-10-17 or 17.10.2026`); }
  return `${m[3]}.${m[2]}.${m[1]}` + (time ? ` ${m[4] ?? "00"}:${m[5] ?? "00"}` : "");
}

/** A plain scalar → the cell text of R7 step 2 (Да/Нет, dd.mm.yyyy, a dropdown by LABEL, numbers as text). */
function cellOf(f: any, v: any, warn: (w: string) => void): string {
  const t = f.type;
  if (v === null || v === undefined || v === "") return "";
  if (t === "CHECKBOX") return v === true || /^(true|да|yes|1)$/i.test(String(v)) ? "Да" : "Нет";
  if (t === "DATE" || t === "FULL_DATE") return xlsxDate(v, t === "FULL_DATE");
  if (t === "PERIOD" || t === "PERIOD_TIME") return `${xlsxDate(v.startDate ?? v.start ?? v[0], t === "PERIOD_TIME")} - ${xlsxDate(v.endDate ?? v.end ?? v[1], t === "PERIOD_TIME")}`;
  if ((t === "DROPDOWN_SINGLE" || t === "RADIO_BUTTON_GROUP") && f.optionSource !== "FROM_BO") {
    const opts: any[] = f.options ?? [], s = String(v).trim().toLowerCase();
    const o = opts.find((x) => x.id === v) ?? opts.find((x) => x.code && x.code.toLowerCase() === s) ?? opts.find((x) => String(x.label).toLowerCase() === s);
    if (!o) warn(`«${v}» is not an option of «${nameOf(f)}» (${opts.map((x) => x.label).join(", ")}) — its row will fail`);
    return o ? o.label : String(v);
  }
  if (LANGS.includes(t) && typeof v === "object") return String(v.RUS ?? Object.values(v)[0] ?? "");
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}

/** The act of an uploaded file: counts (ROWS, not records — a TABLE block repeats its record) and the failing rows.
 *  emptyExplain («не найдено уникального значения…» for every block sub-column) is noise and left out. */
async function actReport(s: Stand, importId: string, head: number) {
  const act = await s.call(XF_ + "load-import-file", { actId: importId });
  const errorRows: any[] = [];
  let scanned = 0;
  for (let offset = 0; offset < 2000 && errorRows.length < 50; offset += 100) {
    const t = await s.call(XF_ + "load-bo-import-table", {}, { importId, paging: { offset, limit: 100 } });
    const recs: any[] = t?.records ?? [];
    recs.forEach((r, j) => { if (r.hasError && errorRows.length < 50) errorRows.push({ line: head + offset + j + 1, error: r.errorText,
      values: Object.fromEntries((t.heads ?? []).map((h: string, i: number) => [h, r.values?.[i]]).filter(([, v]: any) => v !== "" && v != null)) }); });
    scanned += recs.length;
    if (recs.length < 100) break;
  }
  return clean({ importId, file: act?.fileName, rows: act?.total, newRows: act?.newRecords, updatedRows: act?.updatedRecords, errorRows: act?.errorRecords,
    fileError: act?.fileError, failing: errorRows });
}

/** The own key of a BO's rows: its unique fields, or an own field labelled «ID» (MYBPM-IMPORTS.md §19.5). */
const keysOf = (bo: any) => xlsxFields(bo).filter((f: any) => f.isUnique || f.label === "ID");

/** xlsx_import `rows` → a file on a fresh template of the fields they use: one line per record, a TABLE block's
 *  children on repeated lines with the parent's cells copied (R7 step 2). Warns of what the stand does silently. */
async function buildRows(s: Stand, bo: any, rows: Record<string, any>[], warn: (w: string) => void) {
  const fields = xlsxFields(bo), used: any[] = [];
  for (const r of rows) for (const k of Object.keys(r)) { const f = fieldBy(fields, k); if (!used.includes(f)) used.push(f); }
  if (!used.length) throw new Error("`rows` carry no values");
  const co = used.filter((f) => f.type === "CO");
  if (co.length) throw new Error(`a CO field does not go through xlsx: ${co.map(nameOf).join(", ")} — record_save`);
  const tpl = await template(s, bo.id, used), sheet = readSheet(tpl.data), cols = fieldColumns(bo, sheet.columns);
  for (const f of used) if (!cols.some((c) => c.field === f))
    throw new Error(`the template has no column for «${nameOf(f)}»: ${sheet.columns.map((c) => c.caption).join(", ")}`);
  const subsOf = (f: any) => cols.flatMap((c, i) => (c.field === f ? [{ ...c, i }] : []));
  const targets = new Map<string, any>();
  // the sub-column a plain value of a block goes to: the target's unique field, a Person's e-mail, an «ID»
  async function keyColumn(f: any): Promise<number> {
    const subs = subsOf(f), bare = (sub: string) => sub.slice(sub.indexOf(".") + 1);
    if (!targets.has(f.refBoId)) targets.set(f.refBoId, await loadBo(s, f.refBoId));
    const t = targets.get(f.refBoId), keys = keysOf(t).map((x: any) => x.label);
    const email = (f.boFieldRefs ?? []).filter((x: any) => x.type === "INPUT_EMAIL").map((x: any) => x.label);
    const hit = subs.find((c) => keys.includes(bare(c.sub))) ?? subs.find((c) => email.includes(bare(c.sub))) ?? subs.find((c) => bare(c.sub) === "ID");
    if (!hit) throw new Error(`«${nameOf(f)}»: none of its sub-columns (${subs.map((c) => c.sub).join(", ")}) is a key of «${t.name}» — ` +
      "pass {\"<sub-header>\": value} naming the target's unique field, and show that field in the reference (bo_fields_save) if it is not there");
    return hit.i;
  }
  const subColumn = (f: any, sub: string) => {
    const c = subsOf(f).find((x) => x.sub === sub) ?? subsOf(f).find((x) => x.sub.slice(x.sub.indexOf(".") + 1) === sub);
    if (!c) throw new Error(`«${nameOf(f)}» has no sub-column «${sub}»: ${subsOf(f).map((x) => x.sub).join(", ")}`);
    return c.i;
  };
  const lines: string[][] = [];
  for (const r of rows) {
    const base = Array<string>(cols.length).fill(""), kids: Map<number, string>[] = [];
    for (const [k, v] of Object.entries(r)) {
      const f = fieldBy(fields, k);
      if (f.type !== "BO") { base[subsOf(f)[0].i] = cellOf(f, v, warn); continue; }
      const items = v === null || v === undefined || v === "" ? [] : Array.isArray(v) ? v : [v];
      if (f.viewType === "SINGLE" && items.length > 1) throw new Error(`«${nameOf(f)}» holds one record, the row gives ${items.length}`);
      for (const [j, it] of items.entries()) {
        const cells = it && typeof it === "object" ? Object.entries(it).map(([sub, x]) => [subColumn(f, sub), String(x ?? "")] as const)
          : [[await keyColumn(f), String(it)] as const];
        for (const [i, x] of cells) if (j === 0 && f.viewType === "SINGLE") base[i] = x; else (kids[j] ??= new Map()).set(i, x);
      }
    }
    for (let j = 0; j < Math.max(1, kids.length); j++) { const line = [...base]; for (const [i, x] of kids[j] ?? []) line[i] = x; lines.push(line); }
  }
  const keys = keysOf(bo);
  if (!keys.length) warn("the BO has no unique field (nor an own «ID»): every row CREATES a record, a re-run duplicates them");
  else if (!keys.some((f: any) => used.includes(f))) warn(`the key field (${keys.map(nameOf).join(" / ")}) is not in the rows: every row CREATES a record`);
  const blank = used.filter((f) => f.type !== "BO" && f.type !== "DATE" && rows.some((r) => { const k = Object.keys(r).find((x) => fieldBy(fields, x) === f); return !k || r[k] === null || r[k] === ""; }));
  if (blank.length) warn(`blank cells CLEAR the field on an existing record: ${blank.map(nameOf).join(", ")} (a DATE keeps its value; a column left out keeps the field)`);
  if (used.some((f) => f.type === "BO" && f.viewType !== "SINGLE")) warn("a TABLE block only ADDS links on an update, it never unlinks (MYBPM-IMPORTS.md 0X.4)");
  const ro = used.filter((f) => f.isReadonly);
  if (ro.length) warn(`isReadonly fields are written by the import: ${ro.map(nameOf).join(", ")}`);
  return { data: writeSheet(sheet, lines), name: tpl.name, head: sheet.head, lines: lines.length };
}

const actHead = new Map<string, number>(); // importId → header rows of its file, for line numbers in a re-read

// ── scripts and processes (MYBPM-UI-API.md §5f, §5g; MYBPM-IMPORTS.md Part II) ────────────────────────────

const SE_ = "v2/bo-scripts-editor/", SC_ = "v2/script/", SB_ = "v2/script-browser/";
const PE_ = "v2/bo-process-editor/", PE2_ = "v2/bo-process-editor2/", BP_ = "v2/boi-process/";
const HOOKS: Record<string, string> = { onOpen: "onOpenFormScriptId", afterSave: "afterSaveScriptId", onClose: "onCloseScriptId", onCreate: "onInstanceCreationId" };

// the enum-typed keys (UI-API §5g «The script language»): any other value bricks the BO's scripts for good (trap 49);
// the old-panel types are not generated but are valid in a def read back
const S_BLOCKS = new Set(["BlockNewVar", "BlockAssign", "BlockIf", "BlockForeach", "BlockExit", "BlockFixMethod", "BlockFixEntryPoint",
  "BlockSetVar", "BlockSetField", "BlockObject", "BlockReturn", "BlockSwitchExit", "BlockFunc", "BlockFixEmpty"]);
const S_EXPRS = new Set(["ExprValue", "ExprOp", "ExprAct", "ExprCall",
  "ExprConst", "ExprVar", "ExprField", "ExprObject", "ExprNewBoi", "ExprBoiFind", "ExprCreateObject", "ExprFunc"]);
const S_EXITS = new Set(["FROM_METHOD", "FROM_CIRCLE", "FROM_CIRCLE_ITER", "FROM_METHOD_BY_ARROW"]);
const S_VALUES = new Set(["CONST", "VAR_REF", "THIS_PROCESS"]);
const S_CONSTS = new Set(["String", "BigDecimal", "Boolean", "Date", "GeoPoint", "BoRefCode", "BoiRefCode", "SingleSelectRefCode", "Enum",
  "JavaObjectFactories", "ScriptMethodRef", "PrintFormRef", "ReportRefCode"]);
const S_OPS = new Set(["Concat", "Plus", "Minus", "Mul", "Div", "And", "Or", "Xor", "Not", "Less", "LessEq", "More", "MoreEq", "Eq", "NotEq", "OrEq", "AndNotEq"]);
const ID16 = /^[A-Za-z0-9@~]{16}$/;
const ID_ABC = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@~";
/** Any 16 characters of the id alphabet are taken as they are (§5g «/paste breaks parameter references»). */
const newId = () => Array.from(randomBytes(16), (b) => ID_ABC[b % 64]).join("");

/** What would brick or break a def before it is written (trap 49): errors refuse the write, warnings are reported. */
function scriptProblems(def: any): { errors: string[]; warnings: string[] } {
  const errors: string[] = [], warnings: string[] = [];
  const blocks: Record<string, any> = def?.blocks ?? {}, exprs: Record<string, any> = def?.expressions ?? {};
  if (!def || typeof def !== "object" || typeof blocks !== "object" || typeof exprs !== "object") return { errors: ["def must be {blocks: {…}, expressions: {…}}"], warnings };
  const uses = new Map<string, number>(), params = new Set<string>(), down: [string, string][] = [];
  const hats = Object.entries(blocks).filter(([, b]) => b?.type === "BlockFixMethod" || b?.type === "BlockFixEntryPoint");
  for (const [, h] of hats) for (const p of Object.keys(h.params ?? {})) params.add(p);
  const useExpr = (where: string, id: unknown) => {
    if (id == null) return;
    if (typeof id !== "string" || !exprs[id]) { errors.push(`${where} → ${JSON.stringify(id)}: no such expression`); return; }
    uses.set(id, (uses.get(id) ?? 0) + 1);
  };
  const useBlock = (where: string, from: string, id: unknown) => {
    if (id == null) return;
    if (typeof id !== "string" || !blocks[id]) errors.push(`${where} → ${JSON.stringify(id)}: no such block`);
    else down.push([from, id]);
  };
  const objects = (where: string, m: any, each: (k: string, v: any) => void) => {
    if (m == null) return;
    if (typeof m !== "object" || Array.isArray(m)) { errors.push(`${where} must be an object keyed by id`); return; }
    for (const [k, v] of Object.entries(m)) {
      if (!v || typeof v !== "object") { errors.push(`${where}.${k} must be an object, not ${JSON.stringify(v)} (a wrong shape bricks the module)`); continue; }
      each(k, v);
    }
  };
  const refs = (where: string, from: string, o: any) => {
    for (const [k, v] of Object.entries(o)) {
      if (/(^e|E)xprId$/.test(k)) useExpr(`${where}.${k}`, v);
      else if (/(^b|B)lockId$/.test(k) && k !== "varBlockId") useBlock(`${where}.${k}`, from, v);
    }
  };
  for (const [id, b] of Object.entries(blocks)) {
    const w = `blocks.${id}`;
    if (!ID16.test(id)) errors.push(`${w}: an id is 16 characters of A-Z a-z 0-9 @ ~`);
    if (!b || typeof b !== "object") { errors.push(`${w} is not an object`); continue; }
    if ("@class" in b) errors.push(`${w}: \`@class\` is the ARCHIVE shape — the editor takes \`type\` (MYBPM-IMPORTS.md §5d vs §0S.3)`);
    if (!S_BLOCKS.has(b.type)) errors.push(`${w}.type ${JSON.stringify(b.type)} is not a block type`);
    if (b.exitType != null && !S_EXITS.has(b.exitType)) errors.push(`${w}.exitType ${JSON.stringify(b.exitType)} is not an exit type`);
    refs(w, id, b);
    objects(`${w}.branches`, b.branches, (k, br) => {
      if (!ID16.test(k)) errors.push(`${w}.branches.${k}: a branch key is a 16-character id`);
      refs(`${w}.branches.${k}`, id, br);
    });
    objects(`${w}.params`, b.params, () => {});
  }
  for (const [id, e] of Object.entries(exprs)) {
    const w = `expressions.${id}`;
    // the editor leaves a stray `expressions.undefined: {type: "Expr"}` in live defs; the stand translates them — not a fault
    if (id === "undefined" && e?.type === "Expr" && Object.keys(e).length === 1) { warnings.push(`${w} {type: "Expr"} — a stray entry the editor leaves; harmless`); continue; }
    if (!ID16.test(id)) errors.push(`${w}: an id is 16 characters of A-Z a-z 0-9 @ ~`);
    if (!e || typeof e !== "object") { errors.push(`${w} is not an object`); continue; }
    if ("@class" in e) errors.push(`${w}: \`@class\` is the ARCHIVE shape — the editor takes \`type\``);
    if (!S_EXPRS.has(e.type)) errors.push(`${w}.type ${JSON.stringify(e.type)} is not an expression type`);
    if (e.exprValueType != null && !S_VALUES.has(e.exprValueType)) errors.push(`${w}.exprValueType ${JSON.stringify(e.exprValueType)} is not one of CONST VAR_REF THIS_PROCESS`);
    if (e.constType != null && !S_CONSTS.has(e.constType)) errors.push(`${w}.constType ${JSON.stringify(e.constType)} is not a value kind`);
    if (e.opType != null && !S_OPS.has(e.opType)) errors.push(`${w}.opType ${JSON.stringify(e.opType)} is not an operation`);
    if (e.exprValueType === "VAR_REF" && !blocks[e.varBlockId] && !params.has(e.varBlockId))
      errors.push(`${w}.varBlockId ${JSON.stringify(e.varBlockId)}: neither a block nor a parameter of the hat`);
    refs(w, id, e);
    for (const [k, v] of Object.entries(e.argExprIds ?? {})) useExpr(`${w}.argExprIds.${k}`, v);
    objects(`${w}.args`, e.args, (k, v) => useExpr(`${w}.args.${k}.exprId`, v.exprId));
    objects(`${w}.more`, e.more, (k, v) => {
      if (v.opType != null && !S_OPS.has(v.opType)) errors.push(`${w}.more.${k}.opType ${JSON.stringify(v.opType)} is not an operation`);
      useExpr(`${w}.more.${k}.exprId`, v.exprId);
    });
  }
  for (const [id, n] of uses) if (n > 1) errors.push(`expressions.${id} is used ${n} times — every use needs its own expression`);
  for (const id of Object.keys(exprs)) if (!uses.has(id) && id !== "undefined") warnings.push(`expressions.${id} is used nowhere`);
  if (Object.keys(blocks).length && hats.length !== 1)
    errors.push(`${hats.length} hats (BlockFixEntryPoint / BlockFixMethod) — a script has exactly one`);
  if (hats.length === 1) {
    const seen = new Set([hats[0][0]]), todo = [hats[0][0]];
    while (todo.length) { const at = todo.pop()!; for (const [f, t] of down) if (f === at && !seen.has(t)) { seen.add(t); todo.push(t); } }
    for (const id of Object.keys(blocks)) if (!seen.has(id) && blocks[id]?.type !== "BlockFixEmpty") warnings.push(`blocks.${id} is not reached from the hat`);
  }
  return { errors, warnings };
}

/** One patch command whose `backward` puts back what `def` holds now (never the server undo — it can wipe an imported def). */
function patchCmd(name: string, def: any, entries: [string, unknown][]) {
  const at = (p: string) => p.split(".").reduce((o, k) => (o == null ? undefined : o[k]), def);
  const op = (dotPath: string, value: unknown) => (value === undefined ? { type: "Unset", dotPath } : { type: "Set", dotPath, value });
  return { name, forward: { type: "Group", list: entries.map(([p, v]) => op(p, v)) },
    backward: { type: "Group", list: entries.map(([p]) => op(p, at(p))).reverse() } };
}
const undoCmd = (c: ReturnType<typeof patchCmd>) => ({ name: `revert ${c.name}`, forward: c.backward, backward: c.forward });

async function translate(s: Stand, scriptModuleId: string, scriptId: string) {
  const t = await s.call(SC_ + "translate-script", { scriptModuleId, scriptId });
  const msgs = (t?.diagnosticMessageList ?? []).map((m: any) => [m.type, m.messageCode, m.message].filter(Boolean).join(" "));
  return { success: !!t?.success, ...(msgs.length ? { messages: msgs.slice(0, 20) } : {}) };
}

/** Replace a script's def in ONE apply-update-cmd (old ids not in the new def are unset), translate, and put the old
 *  def back when it does not translate (unless keep). A method keeps its BlockFixMethod hat. */
async function writeScript(s: Stand, scriptModuleId: string, scriptId: string, def: any, o: { keep?: boolean; dryRun?: boolean } = {}) {
  if (def?.copied) def = def.copied; // the clipboard JSON of §0S.3
  def = { blocks: def?.blocks ?? {}, expressions: def?.expressions ?? {} };
  const old = (await s.call(SC_ + "load-script-def", { scriptModuleId, scriptId })) ?? {};
  const hat = Object.entries<any>(old.blocks ?? {}).find(([, b]) => b?.type === "BlockFixMethod");
  const p = scriptProblems(def);
  if (hat && def.blocks[hat[0]]?.type !== "BlockFixMethod")
    p.errors.push(`a method: keep its hat blocks.${hat[0]} (BlockFixMethod «${hat[1].methodName}», its params and returnType) — scripts_read defs:true shows it`);
  if (p.errors.length || o.dryRun) return clean({ written: false, ...p,
    why: p.errors.length ? "refused before writing: a def like this bricks or breaks the module (trap 49)" : "dryRun: the def passes the check, nothing written" });
  const entries: [string, unknown][] = [];
  for (const k of ["blocks", "expressions"] as const) {
    for (const id of Object.keys(old[k] ?? {})) if (!(id in def[k])) entries.push([`${k}.${id}`, undefined]);
    for (const [id, v] of Object.entries(def[k])) entries.push([`${k}.${id}`, v]);
  }
  const cmd = patchCmd("script", old, entries);
  await s.call(SC_ + "apply-update-cmd", { scriptModuleId, scriptId }, cmd);
  const t = await translate(s, scriptModuleId, scriptId);
  if (t.success || o.keep) return clean({ written: true, translate: t, warnings: p.warnings });
  await s.call(SC_ + "apply-update-cmd", { scriptModuleId, scriptId }, undoCmd(cmd));
  return clean({ written: false, reverted: true, translate: t, warnings: p.warnings,
    why: "the new def did not translate — the old one is back; fix the def (keep:true stores it anyway)" });
}

/** A version by "work" | "test" | its id | its number; none given → the work one, else the test one. */
function pickVersion(list: any[], want: string | undefined, idKey: string) {
  const v = want === "work" ? list.find((x) => x.isWork) : want === "test" ? list.find((x) => x.isTest)
    : want ? list.find((x) => x[idKey] === want || String(x.version) === String(want)) : list.find((x) => x.isWork) ?? list.find((x) => x.isTest);
  if (!v) throw new Error(`no version ${want ?? "work/test"}: ${JSON.stringify(list.map((x) => ({ id: x[idKey], version: x.version, isWork: x.isWork, isTest: x.isTest })))}`);
  return v;
}
const versionRows = (list: any[], idKey: string) => list.map((x) => clean({ id: x[idKey], version: x.version, work: x.isWork || undefined, test: x.isTest || undefined, comment: x.comment || undefined }));

/** in-work / in-test / copy / remove / change-comment of a script or a process version — one shape for both editors. */
async function versionAction(s: Stand, kind: "script" | "process", boId: string, a: any) {
  const [ctl, list, idKey, noun] = kind === "script" ? [SE_, "load-bo-script-versions", "boScriptModId", "bo-script-version"]
    : [PE2_, "load-bo-process-versions", "boProcessId", "bo-process-version"];
  const idParam = kind === "script" ? "boScriptsId" : "boProcessId";
  const before: any[] = (await s.call(ctl + list, { boId })) ?? [];
  if (!a.action) return { boId, versions: versionRows(before, idKey) };
  const v = pickVersion(before, a.version ?? (a.action === "copy" || a.action === "comment" ? undefined : "test"), idKey);
  const method = ({ work: `in-work-${noun}`, test: `in-test-${noun}`, copy: `copy-${noun}`, remove: `remove-${noun}`, comment: `change-${noun}-comment` } as any)[a.action];
  if (!method) throw new Error("action is one of work, test, copy, remove, comment");
  if (a.action === "remove" && (v.isWork || v.isTest)) throw new Error(`version ${v.version} is the ${v.isWork ? "work" : "test"} one — the stand keeps it; make another one work/test first`);
  const answer = await s.call(ctl + method, { boId, [idParam]: v[idKey], ...(a.action === "comment" ? { comment: a.comment ?? "" } : {}) });
  const refused = Array.isArray(answer) ? answer.filter((x: any) => x?.text).map((x: any) => x.text) : [];
  const after: any[] = (await s.call(ctl + list, { boId })) ?? [];
  return clean({ boId, action: a.action, version: v.version, ...(refused.length ? { refused } : {}), versions: versionRows(after, idKey) });
}

/** The script versions of a BO and the one asked for. A fresh BO's load-bo-def-list is empty for a few seconds (trap 68) and
 *  no field act translates meanwhile — wait for it (≤15 s); still empty = blind. */
async function scriptVersion(s: Stand, boId: string, want?: string) {
  const list: any[] = (await s.call(SE_ + "load-bo-script-versions", { boId })) ?? [];
  const v = pickVersion(list, want, "boScriptModId");
  const empty = async () => { const d = await s.call(SC_ + "load-bo-def-list", { scriptModuleId: v.boScriptModId, scriptId: null }).catch(() => null); return Array.isArray(d?.list) && !d.list.length; };
  let blind = await empty();
  for (let i = 0; blind && i < 15; i++) { await sleep(1000); blind = await empty(); }
  return { list, v, id: v.boScriptModId as string, blind };
}

// the slot names a figure takes (§5f «Slots»); a wrong one silently means another slot or nothing
const SCRIPT_SLOTS = ["left", "right", "top", "bottom", "topLeft", "topRight", "bottomLeft", "bottomRight"];
function slotsOf(f: any): string[] {
  switch (f.type) {
    case "Enter": case "Exit": return ["main", "top", "bottom"];
    case "Switch": return ["up", "right", "down", "left"];
    case "Script": case "Timer": return SCRIPT_SLOTS;
    case "Form": return [...SCRIPT_SLOTS.filter((x) => x !== "bottom"), "timerCreate", "timerOpenForm", "timerTouchDraft"];
    case "Terminator": return ["left", "right", "top", "bottom"];
    case "Point": return [0, 45, 90, 135, 180, 225, 270, 315].map((d) => `angle_${d}`);
    case "SingleToParallel": return ["in", ...Array.from({ length: f.outSlotsCount ?? 2 }, (_, i) => `out${i + 1}`)];
    case "ParallelToSingle": return ["out", ...Array.from({ length: f.inSlotsCount ?? 2 }, (_, i) => `in${i + 1}`)];
  }
  return [];
}
const FIGURES = ["Enter", "Exit", "Switch", "SingleToParallel", "ParallelToSingle", "Form", "Script", "Timer", "Point", "Terminator"];
const OUT_SLOT: Record<string, string> = { Enter: "main", Exit: "main", Switch: "right", Point: "angle_0" };
const IN_SLOT: Record<string, string> = { Enter: "main", Exit: "main", Switch: "left", Point: "angle_180" };

/** A process version: "dev" = the editable one (load-dev-bo-process-id), else as pickVersion. */
async function processVersion(s: Stand, boId: string, want?: string) {
  const list: any[] = (await s.call(PE2_ + "load-bo-process-versions", { boId })) ?? [];
  if (want === "dev") want = await s.call(PE2_ + "load-dev-bo-process-id", { boId });
  const v = pickVersion(list, want, "boProcessId");
  return { list, v, id: v.boProcessId as string };
}

/** The process a record runs: its version, the def and the figure labels. */
async function boiProcess(s: Stand, boId: string, boiId: string) {
  const r = await s.call("v2/boi-process2/load-boi-process-id", { boId, boiId, draftId: null });
  const boProcessId: string = typeof r === "string" ? r : r?.boProcessId ?? r?.id;
  if (!boProcessId) throw new Error(`record ${boiId} runs no process: ${JSON.stringify(r)}`);
  return { boProcessId, def: (await s.call(PE_ + "load-bo-process-def", { boProcessId })) ?? {} };
}

function figureLabel(f: any, fields: Map<string, any>) {
  const fld = f.fieldId ? fields.get(f.fieldId) : undefined;
  return fld ? `${f.type} «${fld.label}»` : f.type;
}

/** The run ways of a version through the dialog's draft (dropped again), ids turned into codes. */
async function runWays(s: Stand, bo: any, boProcessId: string) {
  const draftId = await s.call(PE2_ + "create-draft", { boProcessId });
  try {
    const map = (await s.call(PE2_ + "load-draft-data", { draftId }))?.runWayMap ?? {};
    const rows = [];
    for (const [id, w] of Object.entries<any>(map)) {
      const pf = (bo.formFields ?? []).find((f: any) => f.fieldId === w.processFieldId);
      const target = pf?.refBoId ? await loadBo(s, pf.refBoId).catch(() => null) : null;
      const code = (fid: string) => { const f = (target?.formFields ?? []).find((x: any) => x.fieldId === fid); return f ? nameOf(f) : fid; };
      rows.push(clean({ id, runWay: w.runWay, orderIndex: w.orderIndex, processField: pf ? nameOf(pf) : w.processFieldId, target: target?.code,
        fields: Object.keys(w.fieldIdsSet ?? {}).map(code), variants: Object.keys(w.changeVariantSet ?? {}),
        values: w.fieldValues && Object.fromEntries(Object.entries(w.fieldValues).filter(([k]) => !w.useFieldValuesSet || k in w.useFieldValuesSet).map(([k, v]) => [code(k), v])),
        schedule: w.schedule }));
    }
    return rows;
  } finally { await s.call(PE2_ + "remove-draft", { draftId }).catch(() => {}); }
}

async function processSteps(s: Stand, boProcessId: string, boiId: string, def: any, fields: Map<string, any>) {
  const steps: any[] = (await s.call(BP_ + "load-process-steps", { boProcessId, boiId })) ?? [];
  const arrows = Object.entries<any>(def.arrows ?? {});
  return { over: steps.length > 0 && !steps.some((x) => ["STAND", "GO", "WAITING"].includes(x.state)),
    steps: steps.map((x) => {
      const f = def.figures?.[x.figureId];
      return clean({ figure: x.figureId, what: f ? figureLabel(f, fields) : undefined, state: x.state,
        scriptRunSuccess: x.scriptRunSuccess === false ? false : undefined, diagnostics: x.diagnosticMessages,
        out: arrows.filter(([, a]) => a.startFigureId === x.figureId).map(([id, a]) => `${id}${a.name ? ` «${a.name}»` : ""} → ${a.finishFigureId}`) });
    }) };
}

/** The company-global methods module (one per company) and its methods. */
async function globalMethods(s: Stand) {
  const m = await s.call(SC_ + "ensure-company-global-script-module", {});
  return { scriptModuleId: m?.scriptModuleId as string, methods: ((await s.call(SC_ + "list-company-global-methods", {})) ?? []) as { scriptId: string; methodName: string }[] };
}

/** The script a write goes to: explicit ids, a global method, a process figure, or a hook / field / local method of a BO version. */
async function scriptTarget(s: Stand, a: any): Promise<{ scriptModuleId: string; scriptId: string; what: string }> {
  if (a.scriptModuleId && a.scriptId) return { scriptModuleId: a.scriptModuleId, scriptId: a.scriptId, what: "script" };
  if (a.globalMethod) {
    const g = await globalMethods(s), m = g.methods.find((x) => x.methodName === a.globalMethod);
    if (!m) throw new Error(`no global method «${a.globalMethod}»: ${g.methods.map((x) => x.methodName).join(", ") || "none"} — scripts_wire global:true methods:[…] creates one`);
    return { scriptModuleId: g.scriptModuleId, scriptId: m.scriptId, what: `global method «${a.globalMethod}»` };
  }
  const boId = await boById(s, a);
  if (a.figure) return { scriptModuleId: (await processVersion(s, boId, a.version ?? "dev")).id, scriptId: a.figure, what: `figure ${a.figure}` };
  const v = await scriptVersion(s, boId, a.version ?? "test"), w = (await s.call(SE_ + "load-bo-scripts", { boId, boScriptsId: v.id })) ?? {};
  let scriptId: string | undefined, what: string;
  if (a.hook) {
    if (!HOOKS[a.hook]) throw new Error(`hook is one of ${Object.keys(HOOKS).join(", ")}`);
    scriptId = w[HOOKS[a.hook]]; what = `hook ${a.hook}`;
  } else if (a.field) {
    const f = fieldBy((await loadBo(s, boId)).formFields ?? [], a.field);
    scriptId = w.fieldScripts?.[f.fieldId]?.afterChangeScriptId; what = `field ${nameOf(f)}`;
  } else if (a.method) {
    scriptId = ((await s.call(SE_ + "list-local-methods", { boScriptsId: v.id })) ?? []).find((m: any) => m.methodName === a.method)?.scriptId; what = `method «${a.method}»`;
  } else throw new Error("say which script: scriptModuleId + scriptId, or boId/code with hook | field | method | figure, or globalMethod");
  if (!scriptId) throw new Error(`${what} is not wired on version ${v.v.version} — scripts_wire first`);
  return { scriptModuleId: v.id, scriptId, what: `${what}, version ${v.v.version}` };
}

// ── a platform discrepancy → a prefilled GitHub issue (the user submits it) ────────────────────────────────

const ISSUES = "https://github.com/dmezhnov/MyBPM/issues";

/** What of the user's own stands must not leave in a public issue: hosts, logins, names, company codes. */
function leaks(text: string): string[] {
  const words = new Set<string>();
  for (const c of accounts()) {
    for (const w of [hostKey(c.origin), c.login, c.meta.email, c.meta.fio, c.meta.companyCode, c.name]) if (w && w.length > 2) words.add(w);
    const host = hostKey(c.origin).split(".");
    if (host.length > 2) words.add(host.slice(-2).join("."));
  }
  const low = text.toLowerCase();
  return [...words].filter((w) => low.includes(w.toLowerCase()));
}

// ── tools ────────────────────────────────────────────────────────────────────────────────────────────────

type Tool ={ name: string; description: string; props?: Record<string, any>; required?: string[];
  write?: boolean; run: (a: any) => Promise<unknown> };

const STAND_ARGS = {
  stand: { type: "string", description: "The account: its name or the stand host (stand_list). Required when several accounts are kept — ask the user which one; may be omitted only when there is one account." },
  login: { type: "string", description: "Login on that stand, when it has several accounts." },
};
const AUTH_PATHS = /auth\/(v3\/login|load-token|fast-login|otp-login)/;
const READ_METHOD = /^(load|count|verify|get|find|search)-/;

/** What the delete dialog lists: scripts that use the BO (an analysis polled until done), menu items, referencing BOs. */
async function boUsage(s: Stand, boId: string) {
  const out: any = {};
  try {
    const { analyzeId } = await s.call("v2/delete-script-usage/analyze-bo", { boId });
    for (let wait = 500, t0 = Date.now(); ; wait = Math.min(wait + 500, 5000)) {
      const r = await s.call("v2/delete-script-usage/is-analyze-done", { analyzeId });
      if (r?.done) { out.scripts = r.errorMessage ? `not read: ${r.errorMessage}` : r.hits ?? []; break; }
      if (Date.now() - t0 > 60000) { await s.call("v2/delete-script-usage/cancel", { analyzeId }).catch(() => {}); out.scripts = "not read: the analysis took over 60 s"; break; }
      await sleep(wait);
    }
  } catch (e: any) { out.scripts = `not read: ${e.message}`; }
  try {
    const u = await s.call(BO_ + "load-bo-usage", { boId });
    out.menuItems = u?.menuItemNames ?? []; out.refBos = u?.refBoNames ?? [];
  } catch (e: any) { out.menuItems = out.refBos = `not read: ${e.message}`; }
  return out;
}

async function boById(s: Stand, a: { boId?: string; code?: string }): Promise<string> {
  if (a.boId) return a.boId;
  if (!a.code) throw new Error("pass `boId` or `code`");
  return s.call("v2/business-objects/load-bo-id-by-code", { boCode: a.code });
}

// ── rights (UI-API R5) ──
const MENU_ = "v2/menu-item/";
const BO_ACTIONS = ["all", "view", "edit", "create", "delete", "archive", "export", "duplicate", "add"];
/** The author block the server leaves null on an untouched BO (trap 2). */
const authorsBlock = () => ({ accessForContent: false, accessForHead: false, accessForAuthor: false, accessForEmployees: false,
  accessForDepartment: false, accessForParentDepartment: false, accessForChildDepartment: false, fieldIds: [] as string[] });

/** Every menu item, walking GROUP items down (load-nav-items per level). */
async function menuTree(s: Stand, parentId: string | null = null, depth = 0): Promise<any[]> {
  const out: any[] = [];
  for (const it of (await s.call(MENU_ + "load-nav-items", { parentId })) ?? []) {
    out.push({ ...it, depth });
    if (it.type === "GROUP" && depth < 5) out.push(...(await menuTree(s, it.id, depth + 1)));
  }
  return out;
}

type RightsAt = { what: string; boId?: string; fields: any[]; actions: string[]; load: () => Promise<any>;
  save: (group: any) => Promise<unknown>; flag?: (on: boolean) => unknown; flagNow?: () => Promise<boolean> };

/** Where the rights live: a menu item, a tab, a field, or the BO itself. */
async function rightsAt(s: Stand, a: any): Promise<RightsAt> {
  if (a.menuItemId || a.menu) {
    let id = a.menuItemId;
    if (!id) {
      const all = await menuTree(s);
      const hit = all.filter((m) => m.code === a.menu || m.id === a.menu || m.displayName === a.menu);
      if (hit.length !== 1) throw new Error(`${hit.length ? "several" : "no"} menu items «${a.menu}» — pass menuItemId: ${all.map((m) => `${m.displayName} (${m.code ?? m.id})`).join(", ")}`);
      id = hit[0].id;
    }
    return { what: `menu item ${id}`, fields: [], actions: ["view"],
      load: () => s.call(MENU_ + "load-access-group", { menuItemId: id }),
      save: (g) => s.call(MENU_ + "save-access-group", { menuItemId: id }, g),
      flag: (on) => s.call(MENU_ + "save-menu-item-chosen-access-right", { menuItemId: id, chosenAccessRight: on }) };
  }
  const boId = await boById(s, a), bo = await loadBo(s, boId), fields = bo.formFields ?? [];
  if (a.tab) {
    const tabs = fields.filter((f: any) => f.type === "TAB_GROUP").flatMap((g: any) => (g.tabs ?? []).map((t: any) => ({ g, t })));
    const hit = tabs.filter(({ t }: any) => t.id === a.tab || t.code === a.tab || t.label === a.tab);
    if (hit.length !== 1) throw new Error(`${hit.length ? "several" : "no"} tabs «${a.tab}» — pass the tab id: ${tabs.map(({ t }: any) => `${t.label} (${t.id})`).join(", ")}`);
    const fieldId = hit[0].g.fieldId, tabId = hit[0].t.id, key = { businessObjectId: boId, fieldId, tabId };
    return { what: `tab «${hit[0].t.label}» of ${bo.code ?? boId}`, boId, fields, actions: ["view"],
      load: () => s.call(BO_ + "load-field-tab-access-group", key),
      save: (g) => s.call(BO_ + "save-field-tab-access-group", {}, { ...key, accessGroup: g }),
      flag: (on) => s.call(BO_ + "save-bo-field-tab-chosen-access-right", { boId, fieldId, tabId, chosenAccessRight: on }),
      flagNow: async () => !!(await loadBo(s, boId)).formFields?.find((x: any) => x.fieldId === fieldId)?.tabs?.find((x: any) => x.id === tabId)?.chosenAccessRight };
  }
  if (a.field) {
    const f = fieldBy(fields, a.field), key = { businessObjectId: boId, fieldId: f.fieldId };
    return { what: `field «${nameOf(f)}» of ${bo.code ?? boId}`, boId, fields, actions: ["view", "edit"],
      load: () => s.call(BO_ + "load-field-access-group", key),
      save: (g) => s.call(BO_ + "save-field-access-group", {}, { ...key, accessGroup: g }),
      flag: (on) => s.call(BO_ + "save-bo-field-chosen-access-right", { boId, fieldId: f.fieldId, chosenAccessRight: on }),
      flagNow: async () => !!(await loadBo(s, boId)).formFields?.find((x: any) => x.fieldId === f.fieldId)?.chosenAccessRight };
  }
  return { what: `BO ${bo.code ?? boId}`, boId, fields, actions: BO_ACTIONS,
    load: () => s.call(BO_ + "load-access-group", { businessObjectId: boId }),
    save: (g) => s.call(BO_ + "save-access-group", {}, { businessObjectId: boId, accessGroup: g }),
    // the UI only ever turns a BO's lock ON (portion save); a portion with false is ignored, and no other call exists
    flag: (on) => on ? savePortion(s, { businessObject: { id: boId, nameMap: {}, recordNameMap: {}, chosenAccessRight: true } }) : "keep" };
}

/** Close every tab labelled «Системные» or coded tab_system with VIEW «никому» (IMPORTS 0.8a); notes on what happened. */
async function closeSystemTabs(s: Stand, boId: string): Promise<string[]> {
  const tabs = ((await loadBo(s, boId)).formFields ?? []).filter((f: any) => f.type === "TAB_GROUP")
    .flatMap((g: any) => g.tabs ?? []).filter((t: any) => t.label === "Системные" || t.code === "tab_system");
  const notes: string[] = [];
  for (const t of tabs) {
    try {
      const r: any = await rightsSave(s, await rightsAt(s, { boId, tab: t.id }), { view: "nobody" });
      notes.push(r.mismatch.length ? `tab «${t.label}»: VIEW «никому» did not hold — rights_save it: ${JSON.stringify(r.mismatch)}` : `tab «${t.label}» closed: VIEW «никому» (an admin still sees it)`);
    } catch (e: any) { notes.push(`tab «${t.label}» NOT closed (${e.message}) — rights_save tab + {view: "nobody"}`); }
  }
  return notes;
}

/** One action as the user reads it: "all", "nobody" or its subjects. */
function rightsOf(x: any, fields: any[]) {
  if (!x) return undefined;
  if (x.accessForAll) return "all";
  const units = x.orgUnitRecordList ?? [], af = x.authorsField ?? {};
  const code = (id: string) => { const f = fields.find((y) => y.fieldId === id); return f ? nameOf(f) : id; };
  const out = clean({
    groups: units.filter((u: any) => u.type === "GROUP").map((u: any) => u.name),
    persons: units.filter((u: any) => u.type === "PERSON").map((u: any) => u.name),
    author: af.accessForAuthor || undefined, participants: x.participants || undefined,
    fromFields: Object.entries(x.fromFields ?? {}).filter(([, v]: any) => v?.accessForContent).map(([k]) => code(k)),
    other: Object.entries(af).filter(([k, v]) => v === true && k !== "accessForAuthor").map(([k]) => k.replace(/^accessFor/, "")),
  });
  return Object.keys(out).length ? out : "nobody";
}

/** Org units (groups and users) matching a name, all pages. */
async function orgUnits(s: Stand, filter: string) {
  const out: any[] = [];
  for (let page = 0; page < 50; page++) {
    const got = (await s.call(BO_ + "load-org-unit-record-list", { filter, skipFirstCount: out.length })) ?? [];
    out.push(...got.filter((u: any) => !out.some((o) => o.id === u.id && o.type === u.type)));
    if (!got.length || got.length < 20) break;
  }
  return out;
}

/** A group (name | id) or a user (e-mail | name | id) → the full org-unit record rights take. */
async function orgUnit(s: Stand, type: "GROUP" | "PERSON", key: string) {
  let name = key;
  if (type === "PERSON" && key.includes("@")) {
    // the person search does not match e-mails: read the whole list and pick by e-mail
    const found = ((await s.call("v2/org-unit/load-filtered-persons-v2", { filter: "", chosenPersonIds: [] }, { limit: 1000, offset: 0 })) ?? [])
      .flatMap((g: any) => g.persons ?? []).find((p: any) => p.email?.toLowerCase() === key.toLowerCase());
    if (!found) throw new Error(`no user with e-mail «${key}» (persons_find)`);
    name = found.name; key = found.id;
  }
  const lc = (v: string) => v?.trim().toLowerCase();
  const byId = (us: any[]) => us.find((u) => u.type === type && (u.id === key || u.id === key.replace(/^G-/, "")));
  const named = (us: any[]) => us.filter((u) => u.type === type && lc(u.name) === lc(name));
  let units = await orgUnits(s, name), hit = byId(units);
  if (!hit) { const n = named(units); if (n.length > 1) throw new Error(`several ${type === "GROUP" ? "groups" : "users"} «${key}» — pass the id: ${n.map((u) => u.id).join(", ")}`); hit = n[0]; }
  if (!hit && units.length === 0) { units = await orgUnits(s, ""); hit = byId(units); }
  if (!hit) throw new Error(`no ${type === "GROUP" ? "group" : "user"} «${key}»${units.length ? `; close: ${units.filter((u) => u.type === type).slice(0, 10).map((u) => u.name).join(", ")}` : ""}`);
  return hit;
}

/** The action after a spec: "all" | "nobody" | {groups, persons, author, participants, fromFields} — EXACTLY these subjects. */
async function rightsApply(s: Stand, cur: any, spec: any, at: RightsAt) {
  const g = structuredClone(cur ?? {}), units = g.orgUnitRecordList ?? [];
  const off = (b: any) => { for (const k of Object.keys(b ?? {})) if (k.startsWith("accessFor")) b[k] = false; };
  if (spec === "all") {
    Object.assign(g, { accessForAll: true, participants: false, orgUnitToAdd: [], orgUnitToDelete: units });
    off(g.authorsField);
    for (const v of Object.values(g.fromFields ?? {}) as any[]) v.accessForContent = false;
    return g;
  }
  const want = spec === "nobody" ? {} : spec;
  if (typeof want !== "object") throw new Error(`a right is "all", "nobody" or {groups, persons, author, participants, fromFields} — got ${JSON.stringify(spec)}`);
  const wanted = [...await Promise.all((want.groups ?? []).map((k: string) => orgUnit(s, "GROUP", k))),
    ...await Promise.all((want.persons ?? []).map((k: string) => orgUnit(s, "PERSON", k)))];
  Object.assign(g, { accessForAll: false, participants: !!want.participants,
    orgUnitToAdd: wanted.filter((w) => !units.some((u: any) => u.id === w.id)),
    orgUnitToDelete: units.filter((u: any) => !wanted.some((w) => w.id === u.id)) });
  g.authorsField ??= authorsBlock();
  off(g.authorsField);
  g.authorsField.accessForAuthor = !!want.author;
  if (want.fromFields?.length && !at.boId) throw new Error("fromFields applies to a BO, a field or a tab — not to a menu item");
  const ff = new Set<string>((want.fromFields ?? []).map((k: string) => fieldBy(at.fields, k).fieldId));
  g.fromFields ??= {};
  for (const [k, v] of Object.entries(g.fromFields) as [string, any][]) v.accessForContent = ff.has(k);
  for (const k of ff) g.fromFields[k] ??= { ...authorsBlock(), accessForAuthor: true, accessForContent: true };
  return g;
}

/** A spec normalised the way rightsOf reads it back — for the comparison after the save. */
async function rightsWant(s: Stand, spec: any, fields: any[]) {
  if (spec === "all" || spec === "nobody") return spec;
  const names = async (type: "GROUP" | "PERSON", keys: string[] = []) => (await Promise.all(keys.map((k) => orgUnit(s, type, k)))).map((u) => u.name).sort();
  const out = clean({ groups: await names("GROUP", spec.groups), persons: await names("PERSON", spec.persons), author: spec.author || undefined,
    participants: spec.participants || undefined, fromFields: (spec.fromFields ?? []).map((k: string) => nameOf(fieldBy(fields, k))).sort() });
  return Object.keys(out).length ? out : "nobody";
}
const rightsKey = (r: any) => JSON.stringify(typeof r === "string" ? r : { ...r, groups: r.groups?.slice().sort(), persons: r.persons?.slice().sort(), fromFields: r.fromFields?.slice().sort() });

/** Save the actions of `set` on a target, flip «выборочно» (chosenAccessRight) to match, re-read and compare. */
async function rightsSave(s: Stand, at: RightsAt, set: Record<string, any>, dryRun = false) {
  const bad = Object.keys(set).filter((k) => !at.actions.includes(k));
  if (bad.length) throw new Error(`${at.what} has no action ${bad.join(", ")} — it takes ${at.actions.join(", ")}`);
  const cur = await at.load(), next = structuredClone(cur);
  for (const [k, spec] of Object.entries(set)) next[k] = await rightsApply(s, cur[k], spec, at);
  if (dryRun) return { what: at.what, dryRun: true, body: Object.fromEntries(Object.keys(set).map((k) => [k, next[k]])) };
  await at.save(next);
  const want = Object.fromEntries(await Promise.all(Object.entries(set).map(async ([k, spec]) => [k, await rightsWant(s, spec, at.fields)])));
  // a read right after the save may still answer the old rights: read again for a few seconds
  let after: any, mismatch: any[] = [];
  for (let i = 0; i < 4; i++) {
    if (i) await sleep(1500);
    after = await at.load();
    mismatch = Object.keys(set).map((k) => ({ action: k, want: want[k], got: rightsOf(after[k], at.fields) })).filter((m) => rightsKey(m.want) !== rightsKey(m.got));
    if (!mismatch.length) break;
  }
  const on = at.actions.some((k) => after[k] && !after[k].accessForAll);
  const kept = at.flag ? (await at.flag(on)) === "keep" : false;
  // a flag written right after the rights may be overtaken by a late earlier write: check it and write again
  for (let i = 0; at.flag && at.flagNow && i < 3 && (await at.flagNow()) !== on; i++) { await sleep(1500); await at.flag(on); }
  return { what: at.what, chosenAccessRight: at.flag ? on || (kept ? "stays on" : false) : undefined,
    note: kept ? "every action is «all» again, but a BO's «выборочно» lock cannot be turned off through the API (the UI never does it either) — it only marks the BO [I]" : undefined,
    rights: Object.fromEntries(at.actions.map((k) => [k, rightsOf(after[k], at.fields)])), mismatch };
}

const tools: Tool[] = [
  // 1. connection
  { name: "stand_list", description: "Every stand account this server keeps — all equal, none is the default — each asked live: name, stand host, login, alive (the session works) or the error, who it logs in as (fio, email) and which company (tenant) it selects (companyCode, companyId, personId, the company's Person BO id personBoId). Start here; several accounts and the user has not said which → ask them, then pass `stand` on every call. Never shows a token.",
    props: { functions: { type: "boolean", description: "Also list each user's functionCodes (long)." } },
    run: async (a) => {
      const rows = await Promise.all(accounts().map(async (c) => {
        const base = { name: c.name ?? null, stand: hostKey(c.origin), login: c.login, via: c.file ? "token file" : "MYBPM_TOKEN" };
        const r = await checkAccount(c, true);
        if (!r.alive) return { ...base, alive: false, error: r.error, fio: c.meta.fio ?? null, companyCode: c.meta.companyCode ?? null,
          fix: "the session expired or the stand is unreachable — stand_accounts, the user logs in again on the page" };
        const me = (r as any).me, s = standOf(c);
        const personBoId = await s.call("v2/business-objects/load-bo-id-by-kind", { kind: "PERSON" }).catch(() => null);
        return { ...base, alive: true, fio: me.fio, email: me.email, companyCode: me.companyCode, companyId: me.companyId, personId: me.personId,
          personBoId, language: me.language, ...(a.functions ? { functionCodes: me.functionCodes } : {}) };
      }));
      return { accounts: rows,
        manage: rows.length ? "adding, renaming, a re-login after an expired session — stand_accounts (a page in the user's browser); stand_remove removes one"
          : NO_ACCOUNTS };
    } },
  { name: "stand_accounts", description: "The accounts page — a local page of this server where the user adds a stand account (stand host, login, password, an optional name), edits one (rename, another login, log in again when the session expired), or removes one. The password goes from that page straight to the stand: never ask for it in the chat. Returns the page URL: give it to the user as a link and wait for them. It opens their browser only with open:true — pass it only when the user asked you to open the page or to add / re-log an account, never just because a question found no account, and stand_list shows the result. `stand` / `login` / `name` prefill the add form.",
    props: { name: { type: "string", description: "A name to prefill, e.g. «Тестовый core2»." },
      open: { type: "boolean", description: "true = also open the page in the user's browser; only when the user asked for it. Default false: the URL only." } },
    run: async (a) => {
      const url = await accountsPage();
      const pre = new URLSearchParams(Object.entries({ stand: a.stand, login: a.login, name: a.name }).filter(([, v]) => v) as [string, string][]);
      const link = url + (pre.toString() ? `#add&${pre}` : "");
      return { url: link, opened: a.open === true ? openBrowser(link) : false,
        tell: "Give the user the url as a link (opened:true = it is already open in their browser). They log in there; the password never comes to the chat. When they say it is done, call stand_list." };
    } },
  { name: "stand_remove", write: true, description: "Remove a stand account from this computer: ends its session on the stand (logout) and deletes the saved token. Ask the user first.",
    required: ["stand"],
    run: async (a) => removeAccount(pickStand(a.stand, a.login)) },

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
  { name: "persons_find", description: "Users of the company by a piece of name or e-mail (v2/org-unit/load-filtered-persons-v2; the stand's search does not match e-mails, so a filter with «@» reads the whole list and matches the e-mail here): id, name, email, groups. The id is what a Person field or a rights subject takes.",
    props: { filter: { type: "string" }, limit: { type: "number" } }, required: ["filter"],
    run: async (a) => {
      const s = stand(a);
      const mail = String(a.filter).includes("@"), lc = String(a.filter).toLowerCase();
      const groups = (await s.call("v2/org-unit/load-filtered-persons-v2", { filter: mail ? "" : a.filter, chosenPersonIds: [] }, { limit: mail ? 1000 : a.limit ?? 20, offset: 0 })) ?? [];
      return groups.flatMap((g: any) => g.persons ?? []).filter((p: any) => !mail || p.email?.toLowerCase().includes(lc)).slice(0, a.limit ?? 20)
        .map((p: any) => ({ id: p.id, name: p.name, email: p.email, groups: p.parentGroupNames || undefined }));
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
        return { ...summarize(saveFile(a.out, "exports", name, data)), alsoInBaskets: others };
      } finally {
        await s.call("struct/clear-export-records");
        if (saved.length) await s.call("struct/save-bo-export-records", {}, saved);
      }
    } },

  // 5. the constructor — a BO without an archive (R1, R2, R2a, §5i, §5j)
  { name: "bo_create", write: true, description: "Create a BO in the constructor, with its fields, in one call (R1 steps 1–8; R2 for a dictionary / panel / process): create-bo in an EXISTING group → rename (gives the code) → 3 s against the rename race (trap 24) → the code you pass → every field generated, laid out and saved in one portion save → field codes, widget urls → the record window → read back. Writes immediately and has no undo but bo_delete: ask the user first. Get labels right the first time (a field's server code is fixed at its first save). A composite is co_build.",
    props: { group: { type: "string", description: "The BO group, by id or exact name (bo_groups); it must exist." },
      kind: { type: "string", enum: ["BO", "BO_DICTIONARY", "BO_PANEL", "BO_PROCESS"], description: "Default BO." },
      name: { type: "string" }, description: { type: "string" },
      code: { type: "string", description: "The BO code by the naming convention (0U.5 rule 12: English snake_case). Checked free first; without it the server's transliteration of the name stays." },
      fields: { type: "array", items: FIELD_SPEC, description: "In form order, top to bottom." },
      window: { description: "The record window: omit = sized from the form (h = rows + 5, w 10 or 12); {w, h} = these; false = leave it." } },
    required: ["group", "name"],
    run: async (a) => {
      const s = stand(a), kind = a.kind ?? "BO";
      const g = await groupOf(s, a.group);
      if (a.code && !(await s.call(BO_ + "verify-business-object-code", { businessObjectCode: a.code })))
        throw new Error(`BO code «${a.code}» is empty or taken in this company — pick another (bo_find shows who has it)`);
      const created = await s.call(BO_ + "create-bo", {}, { boGroupId: g.id, boCategory: kind });
      const id = created?.id;
      if (!id) throw new Error(`create-bo answered no id: ${JSON.stringify(created)?.slice(0, 200)}`);
      try {
        await savePortion(s, { businessObject: { id, nameMap: ru(a.name), recordNameMap: ru(a.name), description: a.description ?? "" } });
        await sleep(3000);
        if (a.code) await s.call(BO_ + "save-business-object-code", { businessObjectId: id, businessObjectCode: a.code });
        const done = a.fields?.length ? await addFields(s, id, a.fields, a.window) : { added: [], window: undefined, notes: [] as string[] };
        let bo = await loadBo(s, id);
        if (a.code && bo.code !== a.code) {
          await s.call(BO_ + "save-business-object-code", { businessObjectId: id, businessObjectCode: a.code });
          await sleep(1000); bo = await loadBo(s, id);
          done.notes.push(bo.code === a.code ? `the code was overwritten after the first set (trap 24) — set again: ${a.code}` : `the code is «${bo.code}», not «${a.code}» even after a second set — bo_code_set it`);
        }
        done.notes.push(...await closeSystemTabs(s, id));
        if (!a.code && /_[A-Za-z0-9]{16}$/.test(bo.code ?? "")) done.notes.push(`the code «${bo.code}» carries the rename-race uniquifier (trap 24) — bo_code_set it`);
        return clean({ id, name: bo.name, code: bo.code, boCategory: bo.boCategory, group: g.name,
          url: `${s.c.origin}/business-objects/editing/${id}/object-editing`, window: done.window, notes: done.notes, fields: fieldRows(bo),
          next: "compare fields with what you asked; codes of tabs are not set by this tool (§5k); rights → rights_save" });
      } catch (e: any) {
        throw new Error(`${e.message} — the BO ${id} («${created.name}») EXISTS on the stand: finish it with bo_fields_save, or bo_delete it`);
      }
    } },
  { name: "bo_fields_save", write: true, description: "Change the fields of an existing BO: `add` new ones (laid out below the form, or on tabs — as in bo_create), `edit` existing ones (only the keys you pass are applied: editedFields, trap 53), `delete` by fieldId (an import never deletes a field — this is the way; a script that names the field stops compiling). Edits and deletions go in one save, additions in a second. Ask the user first.",
    props: { boId: { type: "string" }, code: { type: "string", description: "The BO code instead of boId" },
      add: { type: "array", items: FIELD_SPEC },
      edit: { type: "array", items: { type: "object", required: ["fieldId"], properties: {
        fieldId: { type: "string" }, label: { type: "string", description: "Renames the label; the field code stays (bo_code_set changes it)" },
        required: { type: "boolean" }, unique: { type: "boolean" }, readonly: { type: "boolean" }, column: { type: "boolean", description: "Registry column on / off" },
        x: { type: "number" }, y: { type: "number" }, cols: { type: "number" }, rows: { type: "number" },
        html: { type: "string", description: "STATIC_TEXT: the new HTML" },
        optionCodes: { type: "object", description: "DROPDOWN_SINGLE / RADIO_BUTTON_GROUP: {\"<option label or current code>\": \"new_code\"}" },
        set: { type: "object", description: "Any other key of the field DTO (a move to another tab: {\"tabId\": …})" } } } },
      delete: { type: "array", items: { type: "string" }, description: "fieldIds" },
      window: { description: "As in bo_create; applies with `add`." } },
    run: async (a) => {
      const s = stand(a), boId = await boById(s, a);
      if (!a.add?.length && !a.edit?.length && !a.delete?.length) throw new Error("pass `add`, `edit` or `delete`");
      const notes: string[] = [];
      if (a.edit?.length || a.delete?.length) {
        const bo = await loadBo(s, boId), fields: any[] = bo.formFields ?? [], edits: any[] = [];
        const drop = new Set<string>(a.delete ?? []);
        for (const id of drop) if (!fields.some((f) => f.fieldId === id)) throw new Error(`no field ${id} on this BO (bo_read lists them)`);
        for (const e of a.edit ?? []) {
          const f = fields.find((x) => x.fieldId === e.fieldId);
          if (!f) throw new Error(`no field ${e.fieldId} on this BO (bo_read lists them)`);
          if (drop.has(e.fieldId)) throw new Error(`field ${e.fieldId} is both edited and deleted`);
          const edit: any = { fieldId: f.fieldId }, set = (k: string, v: unknown) => { f[k] = v; edit[k] = v; };
          if (e.label !== undefined) { set("label", e.label); set("labelMap", { ...(f.labelMap ?? ru(null)), RUS: e.label }); }
          if (e.required !== undefined) { set("isRequired", e.required); if (e.required) set("isReadonly", false); }
          if (e.unique !== undefined) set("isUnique", e.unique);
          if (e.readonly !== undefined) { set("isReadonly", e.readonly); if (e.readonly) set("isRequired", false); }
          if ((e.required || e.unique) && e.column === undefined && !f.tableColToShow) e.column = true;
          if (e.column !== undefined) {
            set("tableColToShow", e.column);
            if (e.column && !f.tableColToShow) set("tableColOrderIndex", fields.filter((x) => x.tableColToShow && x !== f).length);
          }
          if (["x", "y", "cols", "rows"].some((k) => e[k] !== undefined)) {
            const p = f.gridPosition ?? { x: 0, y: 0, cols: 15, rows: 3 };
            set("gridPosition", { x: e.x ?? p.x, y: e.y ?? p.y, cols: e.cols ?? p.cols, rows: e.rows ?? p.rows }); set("needFreezeWhenScroll", false);
          }
          if (e.html !== undefined) set("staticValueMap", { ...(f.staticValueMap ?? ru(null)), RUS: e.html });
          if (e.optionCodes) {
            const opts: any[] = f.options ?? [];
            for (const k of Object.keys(e.optionCodes)) if (!opts.some((o) => o.label === k || o.code === k))
              throw new Error(`«${k}» is not an option of ${f.label ?? f.fieldId}: ${opts.map((o) => `${o.label} (${o.code})`).join(", ")}`);
            set("options", opts.map((o) => { const c = e.optionCodes[o.label] ?? e.optionCodes[o.code]; return c ? { ...o, code: c } : o; }));
          }
          for (const [k, v] of Object.entries(e.set ?? {})) set(k, v);
          edits.push(edit);
        }
        bo.formFields = fields.filter((f) => !drop.has(f.fieldId));
        await savePortion(s, { businessObject: bo, editedFields: edits, addedFieldIds: [], deletedFieldIds: [...drop] });
        if (drop.size) notes.push("deleted fields are gone from the form; a script or process that names them must be rewritten (0U.5, §5i)");
      }
      const added = a.add?.length ? await addFields(s, boId, a.add, a.window) : undefined;
      const bo = await loadBo(s, boId);
      const lost = (a.delete ?? []).filter((id: string) => (bo.formFields ?? []).some((f: any) => f.fieldId === id));
      if (lost.length) notes.push(`still on the BO after the delete: ${lost.join(", ")}`);
      return clean({ boId, code: bo.code, added: added?.added, window: added?.window, notes: [...notes, ...(added?.notes ?? [])], fields: fieldRows(bo) });
    } },
  { name: "bo_code_set", write: true, description: "Set the code of a BO, or of one of its fields / widgets (`fieldId`), to the naming convention (0U.5 rules 4 + 12) — for codes NOTHING uses yet: the direct setters skip the usage analysis, so scripts, processes, kanban templates and menu items that name the old code are not migrated (§5j, trap 60). A code already in use → change it in the constructor's code dialog instead. A BO code is checked free first. Ask the user first.",
    props: { boId: { type: "string" }, code: { type: "string", description: "The BO's CURRENT code, instead of boId" },
      fieldId: { type: "string", description: "A field or widget of that BO; omit = the BO itself" }, newCode: { type: "string" } },
    required: ["newCode"],
    run: async (a) => {
      const s = stand(a), boId = await boById(s, a), newCode = String(a.newCode).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(newCode)) throw new Error("newCode: Latin letters, digits and `_`, not starting with a digit (0U.5 rule 12)");
      const bo = await loadBo(s, boId);
      if (!a.fieldId) {
        if (bo.code === newCode) return { boId, code: newCode, unchanged: true };
        if (!(await s.call(BO_ + "verify-business-object-code", { businessObjectCode: newCode }))) throw new Error(`BO code «${newCode}» is taken in this company`);
        await s.call(BO_ + "save-business-object-code", { businessObjectId: boId, businessObjectCode: newCode });
        return { boId, was: bo.code, code: (await loadBo(s, boId)).code };
      }
      const f = (bo.formFields ?? []).find((x: any) => x.fieldId === a.fieldId);
      if (!f) throw new Error(`no field ${a.fieldId} on this BO (bo_read lists them)`);
      if (f.nativeFieldType || NATIVES.includes(f.type)) throw new Error("a system field has no code of its own");
      if ((bo.formFields ?? []).some((x: any) => x !== f && x.code === newCode)) throw new Error(`another field of this BO already has the code «${newCode}»`);
      const w = WIDGET_CODE[f.widgetType ?? f.type];
      if (w) await s.call(`v2/${w[0]}/${w[1]}`, { boId, [w[2]]: f.fieldId, code: newCode });
      else await s.call(BO_ + "save-business-field-code", { businessObjectId: boId, businessFieldId: f.fieldId, businessFieldCode: newCode });
      const back = ((await loadBo(s, boId)).formFields ?? []).find((x: any) => x.fieldId === a.fieldId);
      return { boId, fieldId: a.fieldId, was: f.code, code: back?.code };
    } },
  { name: "bo_delete", write: true, description: "Delete a BO (constructor ⋮ → «Удалить»). Without `confirm` only the preview: the BO and what uses it (v2/delete-script-usage/analyze-bo). With `confirm: true` — after the user agreed — delete-business-object, then the code check. The delete is SOFT: the id keeps the BO with all its fields, and an archive with the same oldId revives it with the old fields — a new attempt needs new ids (§5 «A deleted BO comes back», MYBPM-IMPORTS.md 0.7). Its script module survives (trap 25).",
    props: { boId: { type: "string" }, code: { type: "string" }, confirm: { type: "boolean" } },
    run: async (a) => {
      const s = stand(a), boId = await boById(s, a), bo = await loadBo(s, boId);
      const head = { boId, code: bo.code, name: bo.name, boCategory: bo.boCategory, fields: (bo.formFields ?? []).length };
      if (!a.confirm) return { ...head, usage: await boUsage(s, boId), next: "show the user what goes; bo_delete confirm:true deletes" };
      await s.call(BO_ + "delete-business-object", { businessObjectId: boId });
      let gone = false;
      try { await s.call(BO_ + "load-bo-id-by-code", { boCode: bo.code }); } catch (e: any) { gone = /No bo with code/.test(e.message); }
      return { ...head, deleted: gone, ...(gone ? {} : { warning: "the code still resolves — read bo_find before going on" }) };
    } },
  { name: "co_build", write: true, description: "Build a composite object (BO_COMPOSITE) in the constructor — its draft cycle of R2a / §5e: create-bo → rename → code → ONE draft: sources added, each attribute created with its first link and extended with the rest (2+ links = «составной атрибут»), renamed / recoded → apply-and-remove-draft; on any failure the draft is removed. Read back through a draft of its own, removed too. `coId` extends an existing composite instead of creating one. Ask the user first.",
    props: { group: { type: "string", description: "The BO group by id or name (new composite)" }, name: { type: "string" }, description: { type: "string" },
      code: { type: "string", description: "The composite's code (0U.5 rule 12); its auto-name code stays otherwise — the code never follows the name here" },
      coId: { type: "string", description: "An existing composite to add sources / attributes to" },
      sources: { type: "array", items: { type: "string" }, description: "Source BOs by id or exact name; those named in links are added by themselves" },
      attrs: { type: "array", items: { type: "object", required: ["links"], properties: {
        label: { type: "string", description: "Default = the first source field's label" }, code: { type: "string", description: "Default = transliterated from the source label" },
        links: { type: "array", items: { type: "object", required: ["bo", "field"], properties: {
          bo: { type: "string", description: "Source BO id or exact name" }, field: { type: "string", description: "Source field label or fieldId" } } } } } } } },
    run: async (a) => {
      const s = stand(a);
      if (!a.coId && (!a.group || !a.name)) throw new Error("pass `group` + `name` for a new composite, or `coId`");
      const index = new Map<string, string>(); // name → id, read once when a name is used
      const boIdOf = async (ref: string) => {
        if (/^[A-Za-z0-9@_$-]{16}$/.test(ref)) return ref;
        if (!index.size) for (const g of (await s.call(BO_ + "load-bo-groups", { forEdit: true })) ?? [])
          for (const b of (await s.call(BO_ + "load-bo-records-by-group-id", { groupId: g.id })) ?? [])
            index.set(b.name, index.has(b.name) ? "" : b.id);
        const id = index.get(ref);
        if (id === undefined) throw new Error(`no BO named «${ref}» (bo_find)`);
        if (!id) throw new Error(`several BOs are named «${ref}» — pass its id`);
        return id;
      };
      let coId = a.coId, created = false;
      if (!coId) {
        const g = await groupOf(s, a.group);
        if (a.code && !(await s.call(BO_ + "verify-business-object-code", { businessObjectCode: a.code }))) throw new Error(`code «${a.code}» is empty or taken`);
        coId = (await s.call(BO_ + "create-bo", {}, { boGroupId: g.id, boCategory: "BO_COMPOSITE" }))?.id;
        if (!coId) throw new Error("create-bo answered no id");
        created = true;
        await savePortion(s, { businessObject: { id: coId, nameMap: ru(a.name), recordNameMap: ru(a.name), description: a.description ?? "" } });
        if (a.code) await s.call(BO_ + "save-business-object-code", { businessObjectId: coId, businessObjectCode: a.code });
      }
      const exists = created ? ` — the composite ${coId} EXISTS on the stand (empty): rerun with coId, or bo_delete it` : "";
      const draftId = await s.call("v2/co/generate-draft", { coId });
      const attrsOut: any[] = [];
      try {
        const have = new Set(((await s.call("v2/co/load-bo-records-for-co", { coId, draftId })) ?? []).map((b: any) => b.id ?? b.boId));
        const srcIds: string[] = [];
        for (const r of [...(a.sources ?? []), ...(a.attrs ?? []).flatMap((x: any) => x.links.map((l: any) => l.bo))]) {
          const id = await boIdOf(r);
          if (!srcIds.includes(id)) srcIds.push(id);
        }
        const fieldsOf = new Map<string, any[]>();
        for (const id of srcIds) {
          if (!have.has(id)) await s.call("v2/co/add-bo-to-co", { coId, draftId, boId: id });
          fieldsOf.set(id, (await s.call("v2/co/load-bo-fields-for-co", { boId: id })) ?? []);
        }
        const link = async (l: { bo: string; field: string }) => {
          const boId = await boIdOf(l.bo), list = fieldsOf.get(boId)!;
          const f = list.find((x) => (x.fieldId ?? x.id) === l.field) ?? list.find((x) => (x.label ?? x.name) === l.field);
          if (!f) throw new Error(`«${l.field}» is not a field of ${l.bo}: ${list.map((x) => x.label ?? x.name).filter(Boolean).join(", ")}`);
          return { boId, fieldId: f.fieldId ?? f.id };
        };
        const seen = async () => [...((await s.call("v2/co/load-co-fields-simple", { coId, draftId })) ?? []),
          ...((await s.call("v2/co/load-co-fields-composite", { coId, draftId })) ?? [])];
        for (const at of a.attrs ?? []) {
          const before = new Set((await seen()).map((f: any) => f.coFieldId));
          await s.call("v2/co/add-co-field-to-simple", { coId, draftId }, [await link(at.links[0])]);
          const fresh = (await seen()).filter((f: any) => !before.has(f.coFieldId));
          if (fresh.length !== 1) throw new Error(`add-co-field-to-simple made ${fresh.length} attributes, expected 1 (the source field may be linked already)`);
          const coFieldId = fresh[0].coFieldId;
          if (at.links.length > 1) await s.call("v2/co/add-co-field-to-composite", { coId, draftId, coFieldId }, await Promise.all(at.links.slice(1).map(link)));
          if (at.label) await s.call("v2/co/change-co-field-label", { coId, draftId, coFieldId, label: at.label });
          if (at.code) await s.call("v2/co/change-co-field-code", { coId, draftId, coFieldId, code: at.code });
          attrsOut.push({ coFieldId, links: at.links.length });
        }
        await s.call("v2/co/apply-and-remove-draft", { draftId });
      } catch (e: any) {
        await s.call("v2/co/remove-draft", { draftId }).catch(() => {});
        throw new Error(`${e.message} — the draft was removed, nothing of this call was committed${exists}`);
      }
      const bo = await loadBo(s, coId), check = await s.call("v2/co/generate-draft", { coId });
      try {
        const row = (f: any) => ({ coFieldId: f.coFieldId, label: f.label, code: f.code, links: (f.links ?? []).length });
        return { coId, name: bo.name, code: bo.code, url: `${s.c.origin}/business-objects/editing/${coId}/composite-editing`,
          sources: ((await s.call("v2/co/load-bo-records-for-co", { coId, draftId: check })) ?? []).map((b: any) => b.name ?? b.id),
          simple: ((await s.call("v2/co/load-co-fields-simple", { coId, draftId: check })) ?? []).map(row),
          composite: ((await s.call("v2/co/load-co-fields-composite", { coId, draftId: check })) ?? []).map(row), added: attrsOut };
      } finally { await s.call("v2/co/remove-draft", { draftId: check }).catch(() => {}); }
    } },

  // 6. records (§6a, §6b)
  { name: "records_find", description: "Records of a BO from its registry (load-bo-instance-bracket-table, explicit CREATED_AT DESC ordering against the ES sort defect §7): id, state and the REGISTRY COLUMNS only (trap 47 — record_read gives every field). `search` = the registry's full-text box; `where` = {field code / label: value} matched exactly (value or shown text, case-insensitive) over up to 2000 records — the way to find a record by its code. A registry with no columns answers AccessDenied (trap 48).",
    props: { boId: { type: "string" }, code: { type: "string", description: "The BO code instead of boId" }, search: { type: "string" },
      where: { type: "object", description: "{fieldCodeOrLabel: value}, all must match; the fields must be registry columns" },
      state: { type: "string", enum: ["ALL", "ARCHIVED", "REMOVED", "DEV"], description: "Default ALL (the working records)" },
      limit: { type: "number", description: "Default 20, at most 200" }, offset: { type: "number" } },
    run: async (a) => {
      const s = esRetry(stand(a)), boId = await boById(s, a);
      const page = (offset: number, limit: number) => s.call(BOI_ + "load-bo-instance-bracket-table", {}, { boId, dynamicFilters: [], nativeFilters: [],
        search: a.search ?? "", paging: { offset, limit }, ordering: { archetype: "NATIVE", fieldId: "CREATED_AT", state: "DESC" }, state: a.state ?? "ALL", brackets: [] });
      const limit = Math.min(200, a.limit ?? 20);
      const row = (heads: any[], r: any) => ({ id: r.instanceId, ...(r.state && r.state !== "ALL" ? { state: r.state } : {}),
        values: Object.fromEntries((r.values ?? []).map((v: any) => [v.fieldCode || heads.find((h) => h.fieldId === v.fieldId)?.name || v.fieldId,
          v.displayValue === undefined || v.displayValue === v.value ? v.value : v.displayValue])) });
      if (!a.where) {
        const t = await page(a.offset ?? 0, limit);
        return { columns: (t?.heads ?? []).map((h: any) => h.name), total: t?.totalHits, hasNext: t?.hasNext, records: (t?.records ?? []).map((r: any) => row(t.heads ?? [], r)) };
      }
      const want = Object.entries(a.where as Record<string, unknown>).map(([k, v]) => [k, String(v).trim().toLowerCase()] as const);
      const hits: any[] = [];
      let scanned = 0, total: number | undefined, columns: string[] = [];
      for (let offset = 0; offset < 2000 && hits.length < limit; offset += 100) {
        const t = await page(offset, 100), heads: any[] = t?.heads ?? [];
        total = t?.totalHits; columns = heads.map((h) => h.name);
        for (const [k] of want) if (!heads.some((h) => h.name === k) && !(t?.records ?? []).some((r: any) => r.values?.some((v: any) => v.fieldCode === k)) && (t?.records ?? []).length)
          throw new Error(`«${k}» is not a registry column of this BO (trap 47): ${columns.join(", ")} — match on a column, or turn it on with bo_fields_save edit column:true`);
        for (const r of t?.records ?? []) {
          const ok = want.every(([k, w]) => (r.values ?? []).some((v: any) => (v.fieldCode === k || heads.find((h) => h.fieldId === v.fieldId)?.name === k)
            && [v.value, v.displayValue].some((x) => String(x ?? "").trim().toLowerCase() === w)));
          if (ok) hits.push(row(heads, r));
        }
        scanned += (t?.records ?? []).length;
        if (!t?.hasNext) break;
      }
      return { columns, total, scanned, records: hits.slice(0, limit) };
    } },
  { name: "record_read", description: "One record, every field: values keyed by field code (label when it has none) — the raw stored value, or {value, display} when the shown text differs (a dropdown's option code / label, a reference's id / name). Reads each tab of the form too. BO / CO fields come from a bare draft (§6a, no hook runs) dropped right after: their stored id arrays.",
    props: { boId: { type: "string" }, code: { type: "string", description: "The BO code instead of boId" }, id: { type: "string", description: "The record id (records_find)" } },
    required: ["id"],
    run: async (a) => {
      const s = esRetry(stand(a)), boId = await boById(s, a), bo = await loadBo(s, boId);
      const r = await recordValues(s, bo, a.id);
      return { boId, id: a.id, state: r.state, values: r.values };
    } },
  { name: "record_save", write: true, description: "Create a record (no `id`) or change one (`id`), values by field code / fieldId / label in PLAIN form — the tool converts each to what the type stores (§6b table): text and numbers as is, CHECKBOX true/false, DATE… an ISO date, PERIOD {start, end}, DROPDOWN / RADIO the option label or code (a dictionary dropdown: the dictionary record's CODE), BO a record id or an array of them, CO \"<source BO id>-<record id>\" items, *_LANG a string (→ RUS) or {RUS, KAZ, ENG}, CHECKLIST [{label, checked}], FILE_UPLOAD file ids; null clears. scripts:true (default) = the FORM cycle — the BO's hooks run as in the UI dialog, saved only when the answer carries CLOSE_DIALOG_SAVE, else nothing is kept and the field errors come back; scripts:false = the draft cycle (§6a): no hook, no field rules (textCase, maxLength), no counter number, no DROPDOWN_SINGLE. A kanban card move = a save of its status field. Ask the user first.",
    props: { boId: { type: "string" }, code: { type: "string", description: "The BO code instead of boId" }, id: { type: "string", description: "The record to change; omit = a new one" },
      values: { type: "object", description: "{fieldCodeOrLabel: plain value}" },
      scripts: { type: "boolean", description: "Default true: run the BO's hooks (form cycle). false: store without hooks or rules (draft cycle)" },
      dev: { type: "boolean", description: "A TEST record (boiState DEV, the BO's TEST script version); new records only" } },
    required: ["values"],
    run: async (a) => {
      const s = esRetry(stand(a)), boId = await boById(s, a), bo = await loadBo(s, boId), fields = valueFields(bo);
      const vals = Object.entries(a.values ?? {}).map(([k, v]) => { const f = fieldBy(fields, k); return { f, fieldId: f.fieldId, value: toStored(f, v) }; });
      if (!vals.length) throw new Error("pass `values`");
      const scripts = a.scripts !== false;
      if (!scripts) {
        const dd = vals.filter((v) => v.f.type === "DROPDOWN_SINGLE");
        if (dd.length) throw new Error(`the draft cycle does not store a DROPDOWN_SINGLE (§6a): ${dd.map((v) => nameOf(v.f)).join(", ")} — use scripts:true`);
        const draftId = await s.call(BOI_ + "create-draft", {}, {});
        const boiId = a.id ?? (await s.call(BOI_ + "v2/create-boi", { draftId, boId }, {}));
        await s.call(BOI_ + "v2/save-boi-value", {}, { draftId, boId, boInstanceId: boiId, newIsDev: !!a.dev, setNewIsDev: !!a.dev && !a.id,
          values: vals.map((v) => ({ fieldId: v.fieldId, value: v.value, saveType: null })) });
        await applyDraft(s, BOI_ + "apply-and-remove-draft", { draftId, boProcessId: null, isAutoSave: false });
        return { boId, id: boiId, created: !a.id, saved: true, cycle: "draft (no scripts)", record: (await recordValues(s, bo, boiId)).values };
      }
      let draftId: string, boiId: string;
      if (a.id) { boiId = a.id; draftId = await s.call("v2/instance-form-create-draft/create-draft", { boId, boiId, draftId: null }, {}); }
      else ({ draftId, boiId } = await s.call("v2/instance-form-create-draft/create-draft-with-boi", { boId, boiState: a.dev ? "DEV" : "ALL", isReadMode: false }, {}));
      const answers: any[] = [];
      let out: ReturnType<typeof formOutcome>;
      try {
        for (const v of vals) answers.push(await s.call("v2/instance-field-form/save-field-value", {}, { draftId, boId, boInstanceId: boiId, values: [{ fieldId: v.fieldId, value: v.value }] }));
        const applied = await applyDraft(s, "v2/instance-form/validate-apply-remove-draft", { draftId });
        if (applied?.appliedEarlier) // the answer was lost to ES, the draft is gone: the record is what the stand kept
          return { boId, id: boiId, created: !a.id, saved: true, cycle: "form (scripts ran)", note: "the apply answer was lost to an ES error (trap 73) — the values below are what the stand stored",
            record: (await recordValues(s, bo, boiId)).values };
        answers.push(applied);
        out = formOutcome(answers, fields);
      } catch (e: any) {
        if (!ES_ERR.test(e.message)) out = { saved: false, errors: [{ field: null, error: e.message }], notifications: [] };
        else { // ES kept breaking past the wait: whether the record was stored is unknown — nothing is deleted
          await s.call("v2/instance-form/remove-draft", { draftId }, {}).catch(() => {});
          return { boId, id: boiId, saved: "unknown", cycle: "form (scripts ran)", error: e.message,
            next: `the stand's Elasticsearch kept failing (trap 73); in a minute record_read id ${boiId} — values there = stored, an error = nothing was kept${a.id ? "" : "; a stored but unwanted record goes with record_delete"}` };
        }
      }
      if (!out.saved) {
        // nothing kept: a new record is deleted with its draft first (what the UI sends), an existing one only closed
        if (!a.id) await s.call(BOI_ + "v2/delete-boi", { draftId, boiId }, {}).catch(() => {});
        await s.call("v2/instance-form/remove-draft", { draftId }, {}).catch(() => {});
        return clean({ boId, id: a.id, saved: false, cycle: "form (scripts ran)", errors: out.errors, notifications: out.notifications,
          why: out.errors.length ? "a field error vetoed the save (a script or a rule) — nothing was stored"
            : out.notifications.some((n: any) => /^script_/.test(n.text ?? "")) ? "a hook script failed (text = which hook) — nothing was stored; scripts_read shows whether it translates (an emptied body fails: write entry → exit)"
            : "no CLOSE_DIALOG_SAVE — e.g. an empty required field; nothing was stored" });
      }
      return clean({ boId, id: boiId, created: !a.id, saved: true, cycle: "form (scripts ran)", notifications: out.notifications, record: (await recordValues(s, bo, boiId)).values });
    } },
  { name: "record_delete", write: true, description: "Delete records of a BO (delete-bo-instance, ids in the PARAMS — trap 46). Without `confirm` only the preview: each record's values. With `confirm: true` — after the user agreed — deletes, then re-reads. The delete is SOFT: the record goes to state REMOVED, references to it stay stored and show it struck through or hidden (§5h «Reference fields»).",
    props: { boId: { type: "string" }, code: { type: "string", description: "The BO code instead of boId" }, ids: { type: "array", items: { type: "string" } }, confirm: { type: "boolean" } },
    required: ["ids"],
    run: async (a) => {
      const s = esRetry(stand(a)), boId = await boById(s, a), bo = await loadBo(s, boId), ids: string[] = a.ids ?? [];
      if (!ids.length) throw new Error("pass `ids`");
      const before = await Promise.all(ids.map(async (id) => ({ id, ...(await recordValues(s, bo, id)) })));
      if (!a.confirm) return { boId, bo: bo.name, records: before, next: "show the user what goes; record_delete confirm:true deletes" };
      const answer = await s.call(BOI_ + "delete-bo-instance", { businessObjectId: boId, boInstanceIds: ids }, {});
      const after = await Promise.all(ids.map(async (id) => ({ id, state: (await recordValues(s, bo, id).catch(() => ({ state: "gone" }))).state })));
      const left = after.filter((r) => r.state !== "REMOVED" && r.state !== "gone");
      return clean({ boId, answer, deleted: after, ...(left.length ? { warning: `still not REMOVED: ${left.map((r) => r.id).join(", ")}` } : {}) });
    } },

  // 7. records through xlsx (R7, §6; MYBPM-IMPORTS.md Part III)
  { name: "xlsx_template", description: "The stand's own xlsx template of a BO's registry (download-template): saved on this machine, plus what each column is — caption, sub-header of a nested block, field code and type — and the BO's key field (unique / «ID»; none → an import only creates). Columns follow the BO, so take a fresh one after every structure change. To import, xlsx_import `rows` builds the file for you.",
    props: { boId: { type: "string" }, code: { type: "string", description: "The BO code instead of boId" },
      fields: { type: "array", items: { type: "string" }, description: "Field codes / labels, in column order; default every value field" },
      out: { type: "string", description: "Directory for the file (default ~/Downloads, else ~/.cache/mybpm/xlsx)" } },
    run: async (a) => {
      const s = stand(a), boId = await boById(s, a), bo = await loadBo(s, boId), all = xlsxFields(bo);
      const fields = a.fields?.length ? a.fields.map((k: string) => fieldBy(all, k)) : all;
      const tpl = await template(s, boId, fields), sheet = readSheet(tpl.data);
      return { file: saveFile(a.out, "xlsx", tpl.name, tpl.data), headerRows: sheet.head,
        columns: fieldColumns(bo, sheet.columns).map((c) => clean({ column: c.column, caption: c.caption, sub: c.sub || undefined, field: c.field && nameOf(c.field), type: c.field?.type })),
        key: keysOf(bo).map(nameOf), ...(keysOf(bo).length ? {} : { warning: "no unique field (nor an own «ID»): every imported row CREATES a record" }) };
    } },
  { name: "xlsx_import", write: true, description: "Import records from an xlsx in two phases, as the registry's «Импорт из Excel» (R7 steps 3–5). Phase 1 — `path` (an xlsx on this machine) or `rows` ([{fieldCodeOrLabel: plain value}], the file is built on a fresh template and saved): upload → the stand's act: rows new / updated / failing with each failing row's reason (counts are ROWS — a TABLE block repeats its record), plus warnings (no key field → every row creates; blank cells clear fields; a TABLE block only adds links). NOTHING is written in phase 1. Phase 2 — `importId` + `confirm: true` after the user agreed: apply (failing rows are skipped); `importId` + `cancel: true` drops the act. `rows` values: text / numbers, CHECKBOX true/false, DATE an ISO date (written literally, dd.mm.yyyy), a dropdown's label or code, a BO field the target's key (its unique field, a Person's e-mail) or {\"<sub-header>\": value}, an array of them for a TABLE. An xlsx import runs NONE of the BO's scripts (trap 51) — record_save does.",
    props: { boId: { type: "string" }, code: { type: "string", description: "The BO code instead of boId" },
      path: { type: "string", description: "An xlsx on this machine (a filled template or an export)" },
      rows: { type: "array", items: { type: "object" }, description: "Records as {fieldCodeOrLabel: plain value}; the file is built for you" },
      importId: { type: "string", description: "Phase 2: the act of phase 1" }, confirm: { type: "boolean" }, cancel: { type: "boolean" },
      out: { type: "string", description: "Directory for the built file (default ~/Downloads, else ~/.cache/mybpm/xlsx)" } },
    run: async (a) => {
      const s = stand(a);
      if (a.importId) {
        const importId = a.importId;
        if (a.cancel) { await s.call(XF_ + "cancel-imported", { importId }); return { importId, canceled: true }; }
        if (!a.confirm) return { ...(await actReport(s, importId, actHead.get(importId) ?? 1)), next: "confirm:true applies, cancel:true drops it" };
        await s.call(XF_ + "apply-imported", { importId });
        for (const t0 = Date.now(); (await s.call(XF_ + "watch-import-finished", { importId })) !== true; await sleep(2000))
          if (Date.now() - t0 > 600000) throw new Error(`the apply of ${importId} did not finish in 10 min — xlsx_export / records_find shows what is in`);
        const act = await s.call(XF_ + "load-import-file", { actId: importId });
        await s.call(XF_ + "imported-ok", { importId }).catch(() => {});
        return clean({ importId, applied: true, rows: act?.total, newRows: act?.newRecords, updatedRows: act?.updatedRecords, skippedRows: act?.errorRecords,
          next: "verify: xlsx_export (or records_find / record_read) and compare with what was meant (R7 step 7)" });
      }
      const boId = await boById(s, a), bo = await loadBo(s, boId), warnings: string[] = [];
      const warn = (w: string) => { if (!warnings.includes(w)) warnings.push(w); };
      let data: Uint8Array, name: string, file: string, head: number;
      if (a.rows?.length) {
        const b = await buildRows(s, bo, a.rows, warn);
        ({ data, name, head } = b);
        file = saveFile(a.out, "xlsx", name.replace(/^Шаблон\s*/, "").replace(/(\.xlsx)?$/i, " import.xlsx"), data);
      } else if (a.path) {
        file = resolve(a.path.replace(/^~(?=\/|$)/, homedir()));
        if (!existsSync(file)) throw new Error(`${file}: no such file`);
        data = new Uint8Array(readFileSync(file)); name = basename(file);
        const sheet = readSheet(data), cols = fieldColumns(bo, sheet.columns);
        head = sheet.head;
        const odd = cols.filter((c) => c.caption && !c.field && c.caption !== ID_COLUMN).map((c) => c.caption);
        if (odd.length) warn(`captions that name no field of «${bo.name}» (the stand rejects the file): ${[...new Set(odd)].join(", ")}`);
        if (!keysOf(bo).some((f: any) => cols.some((c) => c.field === f))) warn("no key column (unique field / «ID»): every row CREATES a record");
      } else throw new Error("pass `path` or `rows` (phase 1), or `importId` with confirm / cancel (phase 2)");
      const actId: string = await s.upload(XF_ + "import-from-file", data, name, { businessObjectId: boId });
      actHead.set(actId, head);
      for (const t0 = Date.now(); ; await sleep(1000)) {
        let r: any;
        try { r = await s.call(XF_ + "is-import-file-finished", { actId }); }
        catch (e: any) { r = { message: e.message }; }
        if (r === true) break;
        if (r !== false) { // a header error comes back here instead of a boolean (R7 step 4)
          await s.call(XF_ + "cancel-imported", { importId: actId }).catch(() => {});
          return clean({ importId: actId, file, fileError: r?.message ?? JSON.stringify(r), warnings,
            next: "the file was rejected as a whole — fix the header (captions, sub-headers, freeze) and upload again" });
        }
        if (Date.now() - t0 > 120000) throw new Error(`the act of ${actId} is not ready after 2 min — xlsx_import importId:${actId} re-reads it`);
      }
      return { ...(await actReport(s, actId, head)), file, warnings,
        next: "NOTHING is written yet: show the user the counts, failing rows and warnings; xlsx_import importId + confirm:true applies (failing rows are skipped), cancel:true drops it" };
    } },
  { name: "xlsx_export", description: "Export records to an xlsx (the registry's «Экспорт в .xlsx», R7 step 6): saved on this machine and read back as records — values keyed by field code: the cell text (dropdown label, Да/Нет, dd.mm.yyyy), a block as {sub-header: text}, a TABLE block as a list of them (its repeated rows folded by the record id column). The export ignores paging: every record of the filter goes into the file, `limit` only cuts what is returned here.",
    props: { boId: { type: "string" }, code: { type: "string", description: "The BO code instead of boId" },
      fields: { type: "array", items: { type: "string" }, description: "Field codes / labels, in column order; default every value field (an empty list on the stand would blank the blocks)" },
      ids: { type: "array", items: { type: "string" }, description: "Only these records" }, search: { type: "string", description: "The registry's full-text box" },
      state: { type: "string", enum: ["ALL", "ARCHIVED", "REMOVED", "DEV"], description: "Default ALL" },
      limit: { type: "number", description: "Records returned here (default 50); the file holds all" },
      out: { type: "string", description: "Directory for the file (default ~/Downloads, else ~/.cache/mybpm/xlsx)" } },
    run: async (a) => {
      const s = esRetry(stand(a)), boId = await boById(s, a), bo = await loadBo(s, boId), all = xlsxFields(bo);
      const fields = a.fields?.length ? a.fields.map((k: string) => fieldBy(all, k)) : all;
      const body = { boId, dynamicFilters: [], nativeFilters: [], brackets: [], search: a.search ?? "", paging: { offset: 0, limit: 50 },
        ordering: { fieldId: "", state: "UNSET", archetype: null }, state: a.state ?? "ALL", boInstanceIds: a.ids ?? [], boFieldIds: fields.map((f: any) => f.fieldId), needBoiId: true };
      let exportId: string, noIds = false;
      try { exportId = await s.call(XF_ + "export-bracket-bo", {}, body); }
      catch (e: any) {
        if (ES_ERR.test(e.message)) throw e;
        exportId = await s.call(XF_ + "export-bracket-bo", {}, { ...body, needBoiId: false }); noIds = true;
      } // the id column is for administrators
      for (const t0 = Date.now(); (await s.call(XF_ + "is-bo-export-file-ready", { exportId })) !== true; await sleep(1000))
        if (Date.now() - t0 > 300000) throw new Error(`the export ${exportId} is not ready after 5 min`);
      const { data, name } = await s.bytes(XF_ + "load-bo-export-file", { exportId });
      const file = saveFile(a.out, "xlsx", name, data), sheet = readSheet(data), cols = fieldColumns(bo, sheet.columns);
      const idCol = cols.findIndex((c) => c.caption === ID_COLUMN);
      const records: { id?: string; values: Record<string, any> }[] = [];
      let prev = "";
      for (const row of sheet.data) {
        if (!row.some((v) => v !== "")) continue;
        // a TABLE block repeats its record on several rows: one record per id, or per run of equal other cells
        const key = idCol >= 0 ? row[idCol] : JSON.stringify(cols.map((c, i) => (c.field?.type === "BO" && c.field.viewType !== "SINGLE" ? "" : row[i] ?? "")));
        if (key !== prev || !records.length) records.push({ ...(idCol >= 0 ? { id: row[idCol] } : {}), values: {} });
        prev = key;
        const rec = records[records.length - 1];
        for (const f of fields) {
          const fc = cols.flatMap((c, i) => (c.field === f ? [{ ...c, i }] : []));
          if (!fc.length) continue;
          if (f.type !== "BO") { if (!(nameOf(f) in rec.values) && (row[fc[0].i] ?? "") !== "") rec.values[nameOf(f)] = row[fc[0].i]; continue; }
          const obj = Object.fromEntries(fc.map((c) => [c.sub || c.caption, row[c.i] ?? ""]).filter(([, v]) => v !== ""));
          if (!Object.keys(obj).length) continue;
          if (f.viewType === "SINGLE") { rec.values[nameOf(f)] ??= obj; continue; }
          const list: any[] = (rec.values[nameOf(f)] ??= []);
          if (!list.some((x) => JSON.stringify(x) === JSON.stringify(obj))) list.push(obj);
        }
      }
      const limit = a.limit ?? 50;
      return clean({ file, columns: sheet.columns.map((c) => (c.sub ? `${c.caption} › ${c.sub}` : c.caption)), total: records.length,
        records: records.slice(0, limit), cut: records.length > limit ? `${records.length - limit} more in the file` : undefined,
        note: noIds ? "no «Внутренний айди» column (it is for administrators): records are told apart by their cells" : undefined });
    } },

  // 8. scripts (§5g; the language: MYBPM-IMPORTS.md Part II)
  { name: "scripts_read", description: "A BO's Block IDE scripts (§5g «Reading a BO's scripts headlessly»): its script versions, the wiring of the chosen one — the four hooks (onOpen, afterSave, onClose, onCreate), the field scripts keyed by field CODE, the local methods — and per script {scriptModuleId, scriptId}, whether it translates (check, default true) and with defs:true its def {blocks, expressions}. A blind version (trap 68: empty load-bo-def-list) is flagged. global:true — the company-global methods instead (no BO needed). Process figures' scripts: process_read.",
    props: { boId: { type: "string" }, code: { type: "string", description: "The BO code instead of boId" },
      version: { type: "string", description: "work | test | a version id or number; default the work one, else the test one" },
      defs: { type: "boolean", description: "Also each script's def (long)" }, check: { type: "boolean", description: "Default true: translate-script each one" },
      global: { type: "boolean", description: "The company-global methods" } },
    run: async (a) => {
      const s = stand(a), check = a.check !== false;
      const one = async (scriptModuleId: string, scriptId: string, extra: object) => clean({ ...extra, scriptModuleId, scriptId,
        ...(check ? { translate: await translate(s, scriptModuleId, scriptId) } : {}),
        ...(a.defs ? { def: await s.call(SC_ + "load-script-def", { scriptModuleId, scriptId }) } : {}) });
      if (a.global) {
        const g = await globalMethods(s);
        return { scriptModuleId: g.scriptModuleId, methods: await Promise.all(g.methods.map((m) => one(g.scriptModuleId, m.scriptId, { method: m.methodName }))) };
      }
      const boId = await boById(s, a), bo = await loadBo(s, boId), v = await scriptVersion(s, boId, a.version);
      const w = (await s.call(SE_ + "load-bo-scripts", { boId, boScriptsId: v.id })) ?? {};
      const byId = new Map<string, any>((bo.formFields ?? []).map((f: any) => [f.fieldId, f]));
      const scripts: Promise<any>[] = [];
      for (const [hook, key] of Object.entries(HOOKS)) if (w[key]) scripts.push(one(v.id, w[key], { hook }));
      for (const [fid, fs] of Object.entries<any>(w.fieldScripts ?? {}))
        if (fs?.afterChangeScriptId) scripts.push(one(v.id, fs.afterChangeScriptId, { field: byId.get(fid) ? nameOf(byId.get(fid)) : fid, fieldId: fid }));
      for (const m of (await s.call(SE_ + "list-local-methods", { boScriptsId: v.id })) ?? []) scripts.push(one(v.id, m.scriptId, { method: m.methodName }));
      return clean({ boId, bo: bo.name, versions: versionRows(v.list, "boScriptModId"), version: { id: v.id, version: v.v.version, work: v.v.isWork, test: v.v.isTest },
        ...(v.blind ? { blind: "load-bo-def-list is still empty after 15 s (trap 68): no field act translates — read again in a minute" } : {}),
        methodsScriptId: w.methodsScriptId, scripts: await Promise.all(scripts),
        runs: "a TEST version runs only on test (DEV) records; ordinary records run the work version (none → nothing runs)" });
    } },
  { name: "script_write", write: true, description: "Write the body of ONE script — a hook, a field script, a local or global method, a process Script / Switch figure — from a def {blocks, expressions} in the editor's shape (`type`, not the archive's `@class`; MYBPM-IMPORTS.md §0S, §12, §12a; the clipboard JSON of §0S.3 is taken too). Before writing, the def is checked against what bricks a module for good (trap 49: enum values off the table, ids not 16 characters, dangling or reused expressions, wrong object shapes, not exactly one hat) — any problem refuses the write. A method keeps its BlockFixMethod hat (scripts_read defs:true shows it). Then ONE apply-update-cmd replaces the whole def, translate-script checks it, and a def that does not translate is replaced by the old one again (keep:true stores it anyway). dryRun:true = only the check. Ask the user first.",
    props: { scriptModuleId: { type: "string" }, scriptId: { type: "string" },
      boId: { type: "string" }, code: { type: "string", description: "The BO code instead of boId" },
      hook: { type: "string", enum: Object.keys(HOOKS) }, field: { type: "string", description: "A field script: the field's code / label" },
      method: { type: "string", description: "A local method by name" }, globalMethod: { type: "string", description: "A company-global method by name" },
      figure: { type: "string", description: "A process figure id (Script / Switch)" },
      version: { type: "string", description: "work | test | dev | a version id or number; default test (a BO's scripts), dev (a process)" },
      def: { type: "object", description: "{blocks: {<id>: {type, …}}, expressions: {<id>: {type, …}}}" },
      keep: { type: "boolean" }, dryRun: { type: "boolean" } },
    required: ["def"],
    run: async (a) => {
      const s = stand(a), t = await scriptTarget(s, a);
      return { ...t, ...(await writeScript(s, t.scriptModuleId, t.scriptId, a.def, { keep: a.keep, dryRun: a.dryRun })) };
    } },
  { name: "scripts_wire", write: true, description: "Wire scripts onto a BO (§5g «Wiring scripts onto a BO headlessly»): hooks (onOpen, afterSave, onClose, onCreate) and field scripts (by field code) get a script id each — an existing one is kept — then save-bo-scripts stores the whole wiring; unwire: a field script leaves the wiring; a hook stays wired (the stand keeps a hook id — the IDE itself keeps all four) and its body is cleared, so it runs nothing. methods create local methods; removeMethods deletes them from this version — a local method belongs to every script version, so it comes back unless allVersions:true (UI-API trap 68a). Default the TEST version: it runs only on test records — script_version work publishes it. global:true → methods / removeMethods act on the company-global methods (no BO). Bodies: script_write. Ask the user first.",
    props: { boId: { type: "string" }, code: { type: "string", description: "The BO code instead of boId" },
      version: { type: "string", description: "work | test | a version id or number; default test" },
      hooks: { type: "array", items: { type: "string", enum: Object.keys(HOOKS) } }, fields: { type: "array", items: { type: "string" }, description: "Field codes / labels that get an «Изменение поля» script" },
      unwire: { type: "array", items: { type: "string" }, description: "Hook names or field codes to unwire" },
      methods: { type: "array", items: { type: "string" }, description: "Method names to create (existing ones are kept)" },
      removeMethods: { type: "array", items: { type: "string" } },
      allVersions: { type: "boolean", description: "removeMethods: delete from every script version (a local method belongs to all of them), the work one included — scripts that call it break" },
      global: { type: "boolean" } },
    run: async (a) => {
      const s = stand(a), notes: string[] = [];
      const methods = async (list: () => Promise<any[]>, create: (n: string) => Promise<any>, drop: (id: string) => Promise<any>,
        holders?: (id: string) => Promise<string[]>) => {
        const have = new Map<string, string>(((await list()) ?? []).map((m: any) => [m.methodName, m.scriptId]));
        for (const n of a.methods ?? []) if (!have.has(n)) have.set(n, (await create(n))?.scriptId);
        const dropped: string[] = [];
        for (const n of a.removeMethods ?? []) { const id = have.get(n); if (!id) notes.push(`no method «${n}»`); else { await drop(id); dropped.push(n); } }
        if (dropped.length) {
          await sleep(3000); // a method other versions still list comes back within ~3 s (trap 68a)
          const now = new Set(((await list()) ?? []).map((m: any) => m.methodName));
          for (const n of dropped) {
            if (!now.has(n)) { have.delete(n); continue; }
            const others = holders ? await holders(have.get(n)!) : [];
            notes.push(`method «${n}» came back: versions ${others.join(", ") || "?"} list it too (a local method belongs to every script version of the BO, trap 68a) — ` +
              `removeMethods with allVersions:true deletes it from all of them, the work one included`);
          }
        }
        return Object.fromEntries(have);
      };
      if (a.global) {
        const g = await globalMethods(s);
        return clean({ scriptModuleId: g.scriptModuleId, methods: await methods(async () => (await globalMethods(s)).methods,
          (methodName) => s.call(SC_ + "create-company-global-method", { methodName }), (scriptId) => s.call(SC_ + "delete-company-global-method", { scriptId })), notes });
      }
      const boId = await boById(s, a), bo = await loadBo(s, boId);
      const v = await scriptVersion(s, boId, a.version ?? "test");
      if (v.blind) throw new Error(`version ${v.v.version}: load-bo-def-list is still empty after 15 s (trap 68) — no field script would translate; try again in a minute`);
      const cur = (await s.call(SE_ + "load-bo-scripts", { boId, boScriptsId: v.id })) ?? {};
      const fs: Record<string, any> = { ...(cur.fieldScripts ?? {}) };
      const hooks = Object.fromEntries(Object.values(HOOKS).map((k) => [k, cur[k] ?? null]));
      const want: [string, (id: string) => void][] = [];
      for (const h of a.hooks ?? []) {
        if (!HOOKS[h]) throw new Error(`hook is one of ${Object.keys(HOOKS).join(", ")}`);
        if (!hooks[HOOKS[h]]) want.push([h, (id) => { hooks[HOOKS[h]] = id; }]);
      }
      for (const c of a.fields ?? []) {
        const f = fieldBy(bo.formFields ?? [], c);
        if (!fs[f.fieldId]?.afterChangeScriptId) want.push([nameOf(f), (id) => { fs[f.fieldId] = { afterChangeScriptId: id }; }]);
      }
      const clear: string[] = [];
      for (const u of a.unwire ?? []) {
        if (HOOKS[u]) { if (hooks[HOOKS[u]]) clear.push(hooks[HOOKS[u]]); } // save-bo-scripts ignores a null / "" hook (§5g)
        else delete fs[fieldBy(bo.formFields ?? [], u).fieldId];
      }
      // an EMPTIED hook body ({blocks:{}}) fails the save (script_after_save_error «Нет точки входа»): hat → exit instead
      for (const scriptId of clear) {
        const hat = newId(), exit = newId();
        await writeScript(s, v.id, scriptId, { blocks: { [hat]: { x: 40, y: 40, downBlockId: exit, type: "BlockFixEntryPoint" },
          [exit]: { exitType: "FROM_METHOD", type: "BlockExit" } }, expressions: {} }, { keep: true });
      }
      if (clear.length) notes.push(`hooks ${(a.unwire ?? []).filter((u: string) => HOOKS[u]).join(", ")}: still wired (the stand keeps hook ids), body = entry → exit — they run nothing`);
      if (want.length) {
        const r = await s.call(SC_ + "load-new-ids", { count: want.length });
        const ids: string[] = Array.isArray(r) ? r : r?.ids ?? r?.list ?? [];
        if (ids.length < want.length) throw new Error(`load-new-ids gave ${JSON.stringify(r)}`);
        want.forEach(([, set], i) => set(ids[i]));
      }
      if (want.length || Object.keys(fs).length !== Object.keys(cur.fieldScripts ?? {}).length)
        await s.call(SE_ + "save-bo-scripts", {}, { id: v.id, boId, ...hooks, fieldScripts: fs,
          methodScriptIds: cur.methodScriptIds ?? [], methodsScriptId: cur.methodsScriptId ?? null });
      // after the save: it replaces methodScriptIds with what it is sent
      // a local method is listed by every script version of the BO and is gone only when each of them drops it (trap 68a)
      const holding = async (scriptId: string) => (await Promise.all(v.list.map(async (x: any) =>
        ((await s.call(SE_ + "list-local-methods", { boScriptsId: x.boScriptModId })) ?? []).some((m: any) => m.scriptId === scriptId) ? x : null))).filter(Boolean);
      const ms = await methods(() => s.call(SE_ + "list-local-methods", { boScriptsId: v.id }),
        (methodName) => s.call(SE_ + "create-local-method", { boScriptsId: v.id, methodName }),
        async (scriptId) => {
          const from = a.allVersions ? await holding(scriptId) : [v.v];
          for (const x of from) await s.call(SE_ + "delete-local-method", { boScriptsId: x.boScriptModId, scriptId });
        },
        async (scriptId) => (await holding(scriptId)).map((x: any) => x.version + (x.isWork ? " (work)" : x.isTest ? " (test)" : "")));
      const w = (await s.call(SE_ + "load-bo-scripts", { boId, boScriptsId: v.id })) ?? {};
      const byId = new Map<string, any>((bo.formFields ?? []).map((f: any) => [f.fieldId, f]));
      return clean({ boId, version: { id: v.id, version: v.v.version, work: v.v.isWork, test: v.v.isTest }, scriptModuleId: v.id,
        hooks: Object.fromEntries(Object.entries(HOOKS).map(([h, k]) => [h, w[k] ?? null]).filter(([, id]) => id)),
        fields: Object.fromEntries(Object.entries<any>(w.fieldScripts ?? {}).map(([fid, x]) => [byId.get(fid) ? nameOf(byId.get(fid)) : fid, x?.afterChangeScriptId])),
        methods: ms, notes, next: "script_write writes each body (a new one is empty and does not translate until then)" });
    } },
  { name: "script_version", write: true, description: "A BO's script versions (§5g): no action → the list; action work (publish: ordinary records run it; the stand then makes a fresh test copy), test (make it the test version), copy, remove (not the work or test one), comment. version: work | test | id | number (default test; copy / comment default the work one). Ask the user first.",
    props: { boId: { type: "string" }, code: { type: "string", description: "The BO code instead of boId" },
      action: { type: "string", enum: ["work", "test", "copy", "remove", "comment"] }, version: { type: "string" }, comment: { type: "string" } },
    run: async (a) => { const s = stand(a); return versionAction(s, "script", await boById(s, a), a); } },

  // 9. processes (§5f)
  { name: "process_read", description: "A business process (a BO_PROCESS BO) as it runs (§5f): its versions; the chosen version's figures (type, x/y, a Form's / Timer's field label) and arrows (from, slot, to, slot, name) in walk order from the Enter — a figure no arrow reaches is «не подключена»; validate-def; per Script / Switch figure its exit variants and translate (check, default true), with defs:true its def; the run ways (WHEN it starts) with field codes. To explain a process walk the arrows from the Enter (MYBPM-IMPORTS.md §5c).",
    props: { boId: { type: "string" }, code: { type: "string", description: "The BO code instead of boId" },
      version: { type: "string", description: "work | test | dev | a version id or number; default the work one, else the test one" },
      defs: { type: "boolean" }, check: { type: "boolean", description: "Default true" } },
    run: async (a) => {
      const s = stand(a), boId = await boById(s, a), bo = await loadBo(s, boId), v = await processVersion(s, boId, a.version), id = v.id;
      const def = (await s.call(PE_ + "load-bo-process-def", { boProcessId: id })) ?? {};
      const fields = new Map<string, any>((bo.formFields ?? []).map((f: any) => [f.fieldId, f]));
      const figs = def.figures ?? {}, arrows = Object.entries<any>(def.arrows ?? {});
      const enter = Object.keys(figs).find((k) => figs[k].type === "Enter");
      const order: string[] = enter ? [enter] : [];
      for (let i = 0; i < order.length; i++)
        for (const [, ar] of arrows) if (ar.startFigureId === order[i] && figs[ar.finishFigureId] && !order.includes(ar.finishFigureId)) order.push(ar.finishFigureId);
      const figures = await Promise.all([...order, ...Object.keys(figs).filter((k) => !order.includes(k))].map(async (fid) => {
        const f = figs[fid], scripted = f.type === "Script" || f.type === "Switch";
        return clean({ id: fid, what: figureLabel(f, fields), x: f.x, y: f.y, field: f.fieldId ? (fields.get(f.fieldId) ? nameOf(fields.get(f.fieldId)) : f.fieldId) : undefined,
          slots: f.outSlotsCount ?? f.inSlotsCount, ...(order.includes(fid) ? {} : { reached: "не подключена — no arrow from the Enter leads here" }),
          out: arrows.filter(([, ar]) => ar.startFigureId === fid).map(([aid, ar]) => clean({ arrow: aid, name: ar.name, slot: ar.startSlotName, to: ar.finishFigureId, toSlot: ar.finishSlotName })),
          ...(scripted ? { exits: await s.call(SB_ + "load-exit-variants", { scriptModuleId: id, scriptId: fid }).catch((e: any) => `not read: ${e.message}`) } : {}),
          ...(scripted && a.check !== false ? { translate: await translate(s, id, fid).catch((e: any) => ({ error: e.message })) } : {}),
          ...(scripted && a.defs ? { def: await s.call(SC_ + "load-script-def", { scriptModuleId: id, scriptId: fid }) } : {}) });
      }));
      const validate = ((await s.call(PE_ + "validate-def", { boProcessId: id, boiId: null, testMode: true })) ?? []).map((e: any) => clean({ type: e.type, place: e.place, id: e.id ?? e.figureId ?? e.arrowId, message: e.message }));
      return clean({ boId, bo: bo.name, versions: versionRows(v.list, "boProcessId"), boProcessId: id, version: v.v.version,
        runs: v.v.isWork ? "the work version: ordinary records run it" : v.v.isTest ? "the TEST version: only test (DEV) records run it (process_version work publishes it)" : "neither work nor test: nothing runs it",
        figures, validate: validate.length ? validate : "clean", runWays: await runWays(s, bo, id).then((r) => (r.length ? r : "none — nothing starts this process by itself (process_run_ways adds one)")).catch((e: any) => `not read: ${e.message}`) });
    } },
  { name: "process_edit", write: true, description: "Change a process diagram in ONE apply-update-cmd (§5f — no draft, no СОХРАНИТЬ: it is written at once) whose backward restores the old state: add figures [{key, type, x, y, field (a Form's BO-reference / a Timer's date field: code or label), slots (S2P / P2S branch count, default 2)}] (not an Enter — every process has one), arrows [{key?, from, fromSlot?, to, toSlot?, name?}] (from / to = a new figure's key or an existing figure id; slots default right → left, Enter / Exit main, Switch right / left; S2P out1… / P2S in1… must be named; a Switch's outgoing arrows need names), change [{id, x?, y?, field?, name?, fromSlot?, toSlot?}] (a figure or an arrow), remove [ids] (a figure takes its arrows). Slot names off the §5f table are refused. Every NEW Script gets a minimal body (exit) and every new Switch exits by its first outgoing arrow so none runs «Скрипт не определён»; real bodies: script_write figure:<id>. Then validate-def. Default the dev (editable) version. Ask the user first.",
    props: { boId: { type: "string" }, code: { type: "string", description: "The BO code instead of boId" },
      version: { type: "string", description: "dev (default) | work | test | a version id or number" },
      figures: { type: "array", items: { type: "object", required: ["key", "type", "x", "y"], properties: { key: { type: "string" }, type: { type: "string", enum: FIGURES.filter((f) => f !== "Enter") },
        x: { type: "number" }, y: { type: "number" }, field: { type: "string" }, slots: { type: "number" } } } },
      arrows: { type: "array", items: { type: "object", required: ["from", "to"], properties: { key: { type: "string" }, from: { type: "string" }, fromSlot: { type: "string" },
        to: { type: "string" }, toSlot: { type: "string" }, name: { type: "string" } } } },
      change: { type: "array", items: { type: "object", required: ["id"] } }, remove: { type: "array", items: { type: "string" } } },
    run: async (a) => {
      const s = stand(a), boId = await boById(s, a), bo = await loadBo(s, boId), v = await processVersion(s, boId, a.version ?? "dev"), id = v.id;
      const old = (await s.call(PE_ + "load-bo-process-def", { boProcessId: id })) ?? {};
      const figs: Record<string, any> = JSON.parse(JSON.stringify(old.figures ?? {})), arrs: Record<string, any> = JSON.parse(JSON.stringify(old.arrows ?? {}));
      const addF: any[] = a.figures ?? [], addA: any[] = a.arrows ?? [], entries: [string, unknown][] = [], keys: Record<string, string> = {};
      const fieldId = (c: string | undefined) => (c ? fieldBy(bo.formFields ?? [], c).fieldId : null);
      const ids: string[] = addF.length + addA.length ? await s.call(PE_ + "load-new-ids", { count: addF.length + addA.length }) : [];
      for (const f of addF) {
        if (!FIGURES.includes(f.type) || f.type === "Enter") throw new Error(`figure ${f.key}: type is one of ${FIGURES.filter((x) => x !== "Enter").join(", ")}`);
        const fid = (keys[f.key] = ids.shift()!), val: any = { x: f.x, y: f.y, type: f.type };
        // born shapes the editor writes (§5f; tools/process-builder.ts)
        if (f.type === "Form") Object.assign(val, { fieldId: fieldId(f.field), createTimer: null, openFormTimer: null, touchDraftTimer: null });
        if (f.type === "Timer") val.fieldId = fieldId(f.field);
        if (f.type === "Script") val.script = null;
        if (f.type === "Terminator") val.fieldId = "";
        if (f.type === "SingleToParallel") val.outSlotsCount = f.slots ?? 2;
        if (f.type === "ParallelToSingle") val.inSlotsCount = f.slots ?? 2;
        figs[fid] = val; entries.push([`figures.${fid}`, val]);
      }
      const fig = (k: string) => { const fid = keys[k] ?? k; if (!figs[fid]) throw new Error(`no figure «${k}» (a new figure's key or an existing figure id)`); return fid; };
      const slot = (fid: string, given: string | undefined, dflt: Record<string, string>, side: string) => {
        const f = figs[fid], sl = given ?? dflt[f.type] ?? (["SingleToParallel", "ParallelToSingle"].includes(f.type) ? undefined : side);
        if (!sl) throw new Error(`a ${f.type} needs its slot named: ${slotsOf(f).join(", ")}`);
        if (!slotsOf(f).includes(sl)) throw new Error(`a ${f.type} has no slot «${sl}» (it would silently mean another one or nothing): ${slotsOf(f).join(", ")}`);
        return sl;
      };
      for (const ar of addA) {
        const aid = ids.shift()!, from = fig(ar.from), to = fig(ar.to);
        if (ar.key) keys[ar.key] = aid;
        const val: any = { startFigureId: from, startSlotName: slot(from, ar.fromSlot, OUT_SLOT, "right"), finishFigureId: to, finishSlotName: slot(to, ar.toSlot, IN_SLOT, "left") };
        if (ar.name) val.name = ar.name;
        arrs[aid] = val; entries.push([`arrows.${aid}`, val]);
      }
      for (const c of a.change ?? []) {
        if (figs[c.id]) {
          for (const k of ["x", "y"]) if (c[k] != null) { figs[c.id][k] = c[k]; entries.push([`figures.${c.id}.${k}`, c[k]]); }
          if (c.field !== undefined) { figs[c.id].fieldId = fieldId(c.field); entries.push([`figures.${c.id}.fieldId`, figs[c.id].fieldId]); }
        } else if (arrs[c.id]) {
          if (c.name !== undefined) { arrs[c.id].name = c.name || undefined; entries.push([`arrows.${c.id}.name`, c.name || undefined]); }
          if (c.fromSlot) entries.push([`arrows.${c.id}.startSlotName`, slot(arrs[c.id].startFigureId, c.fromSlot, OUT_SLOT, "right")]);
          if (c.toSlot) entries.push([`arrows.${c.id}.finishSlotName`, slot(arrs[c.id].finishFigureId, c.toSlot, IN_SLOT, "left")]);
        } else throw new Error(`change: no figure or arrow ${c.id}`);
      }
      for (const r of a.remove ?? []) {
        if (figs[r]?.type === "Enter") throw new Error("the Enter stays — every process has exactly one");
        if (figs[r]) {
          for (const [aid, ar] of Object.entries<any>(arrs)) if (ar.startFigureId === r || ar.finishFigureId === r) { delete arrs[aid]; entries.push([`arrows.${aid}`, undefined]); }
          delete figs[r]; entries.push([`figures.${r}`, undefined]);
        } else if (arrs[r]) { delete arrs[r]; entries.push([`arrows.${r}`, undefined]); }
        else throw new Error(`remove: no figure or arrow ${r}`);
      }
      if (!entries.length) throw new Error("nothing to change: pass figures, arrows, change or remove");
      await s.call(PE_ + "apply-update-cmd", { boProcessId: id }, patchCmd("process_edit", old, entries));
      // a new Script / Switch with no body runs «Скрипт не определён»: a minimal one, the real body by script_write
      const bodies: Record<string, unknown> = {};
      for (const f of addF.filter((x) => x.type === "Script" || x.type === "Switch")) {
        const fid = keys[f.key], out = Object.keys(arrs).find((aid) => arrs[aid].startFigureId === fid);
        if (f.type === "Switch" && !out) { bodies[f.key] = "no body: the Switch has no outgoing arrow yet"; continue; }
        const hat = newId(), exit = newId();
        const r = await writeScript(s, id, fid, { blocks: { [hat]: { x: 40, y: 40, downBlockId: exit, type: "BlockFixEntryPoint" },
          [exit]: f.type === "Script" ? { exitType: "FROM_METHOD", type: "BlockExit" } : { exitType: "FROM_METHOD_BY_ARROW", targetArrowId: out, type: "BlockExit" } },
          expressions: {} }, { keep: true });
        bodies[f.key] = f.type === "Script" ? r.translate ?? r : { exitsBy: out, ...(r.translate ?? r) };
      }
      const validate = ((await s.call(PE_ + "validate-def", { boProcessId: id, boiId: null, testMode: true })) ?? []).map((e: any) => clean({ type: e.type, place: e.place, message: e.message }));
      return clean({ boId, boProcessId: id, version: v.v.version, ids: keys, bodies, validate: validate.length ? validate : "clean",
        ...(v.v.isWork ? { warning: "this is the WORK version — ordinary records run the change at once" } : {}) });
    } },
  { name: "process_version", write: true, description: "A process's versions (§5f «Versions»): no action → the list; action work (publish: ordinary records start running it — a constructor-made process has only a test version, which runs only for test records), test, copy (same figure ids), remove (not the work or test one), comment. version: work | test | id | number (default test; copy / comment default the work one). Ask the user first.",
    props: { boId: { type: "string" }, code: { type: "string", description: "The BO code instead of boId" },
      action: { type: "string", enum: ["work", "test", "copy", "remove", "comment"] }, version: { type: "string" }, comment: { type: "string" } },
    run: async (a) => { const s = stand(a); return versionAction(s, "process", await boById(s, a), a); } },
  { name: "process_run_ways", write: true, description: "WHEN a process starts (§5f «Run ways», the dialog's draft): set [{id? (an existing run way to change), runWay ON_INSTANCE_CREATE | ON_FIELD_CHANGE | SCHEDULED | ON_MIGRATION_END, processField (the process BO's BO-reference field, SINGLE / FIELDS; not for SCHEDULED), fields (ON_FIELD_CHANGE: the TARGET BO's field codes), values ({targetFieldCode: value} — start only when changed TO it), variants (default [ON_MANUAL_SAVE]; ON_UPLOAD_XLSX: an xlsx-created record starts it too), orderIndex, schedule {repeatType, repeatUntilType, startTime, …}}], remove [ids]. Applied as one draft (dropped on any error); the default «run on a record of this BO when it is created» stays. Works on the work version too (only the UI refuses). Default the work version, else the test one. Ask the user first.",
    props: { boId: { type: "string" }, code: { type: "string", description: "The BO code instead of boId" }, version: { type: "string" },
      set: { type: "array", items: { type: "object", required: ["runWay"] } }, remove: { type: "array", items: { type: "string" } } },
    run: async (a) => {
      const s = stand(a), boId = await boById(s, a), bo = await loadBo(s, boId), v = await processVersion(s, boId, a.version), id = v.id;
      const draftId = await s.call(PE2_ + "create-draft", { boProcessId: id });
      try {
        const map = (await s.call(PE2_ + "load-draft-data", { draftId }))?.runWayMap ?? {};
        const sets: any[] = a.set ?? [], fresh: string[] = sets.some((w) => !w.id) ? await s.call(PE_ + "load-new-ids", { count: sets.length }) : [];
        let order = Math.max(0, ...Object.values<any>(map).map((w) => w.orderIndex ?? 0));
        const ops: { dotPath: string; value?: unknown }[][] = [];
        for (const w of sets) {
          if (w.id && !map[w.id]) throw new Error(`no run way ${w.id}: ${Object.keys(map).join(", ") || "none"}`);
          const rid = w.id ?? fresh.shift()!, p = (k: string) => `runWayMap.${rid}.${k}`, list: { dotPath: string; value?: unknown }[] = [];
          list.push({ dotPath: p("runWay"), value: w.runWay }, { dotPath: p("orderIndex"), value: w.orderIndex ?? map[rid]?.orderIndex ?? ++order },
            { dotPath: p("changeVariantSet"), value: Object.fromEntries((w.variants ?? ["ON_MANUAL_SAVE"]).map((x: string) => [x, 1])) });
          if (w.runWay !== "SCHEDULED") {
            const pf = fieldBy((bo.formFields ?? []).filter((f: any) => f.type === "BO" || f.type === "CO"), w.processField ?? "");
            const target = await loadBo(s, pf.refBoId), tid = (c: string) => fieldBy(target.formFields ?? [], c).fieldId;
            list.push({ dotPath: p("processFieldId"), value: pf.fieldId });
            if (w.fields) list.push({ dotPath: p("fieldIdsSet"), value: Object.fromEntries(w.fields.map((c: string) => [tid(c), 1])) });
            if (w.values) {
              const vals = Object.entries<any>(w.values).map(([c, x]) => [tid(c), x]);
              list.push({ dotPath: p("useFieldValuesSet"), value: Object.fromEntries(vals.map(([k]) => [k, 1])) }, { dotPath: p("fieldValues"), value: Object.fromEntries(vals) });
            }
          }
          ops.push(list);
          // a schedule goes one key per update, as the dialog sends it
          for (const [k, x] of Object.entries(w.schedule ?? {})) ops.push([{ dotPath: p(`schedule.${k}`), value: x }]);
        }
        for (const r of a.remove ?? []) { if (!map[r]) throw new Error(`no run way ${r}`); ops.push([{ dotPath: `runWayMap.${r}` }]); }
        if (!ops.length) throw new Error("nothing to change: pass set or remove (process_read shows the run ways)");
        for (const o of ops) await s.call(PE2_ + "update-draft", { draftId }, o);
        await s.call(PE2_ + "apply-draft", { draftId });
      } catch (e) { await s.call(PE2_ + "remove-draft", { draftId }).catch(() => {}); throw e; }
      return { boId, boProcessId: id, version: v.v.version, runWays: await runWays(s, bo, id) };
    } },
  { name: "process_steps", description: "Where a process record is (§5f run-time controller): the version it runs and every step — figure, what it is, state PASSED | STAND (waiting: a Form, a Timer) | GO (running) | WAITING (a Timer past due) | FAILED, a script failure, diagnostics, its outgoing arrows; over = none is STAND / GO / WAITING. A Form waits for a CHANGED save of its record; a field filled after the Form was entered leaves it stuck (§5f).",
    props: { boId: { type: "string" }, code: { type: "string", description: "The process BO code instead of boId" }, boiId: { type: "string", description: "The process record" } },
    required: ["boiId"],
    run: async (a) => {
      const s = stand(a), boId = await boById(s, a), bo = await loadBo(s, boId), p = await boiProcess(s, boId, a.boiId);
      return { boId, boiId: a.boiId, boProcessId: p.boProcessId, ...(await processSteps(s, p.boProcessId, a.boiId, p.def, new Map((bo.formFields ?? []).map((f: any) => [f.fieldId, f])))) };
    } },
  { name: "process_push", write: true, description: "Move a stuck process record on (§5f): action forward = «Продолжить принудительно» along an OUTGOING arrow of the standing step (arrowId; the arrow into it does nothing); retry = «Попробовать еще раз» on a Script / Switch / Form step with diagnostics (figureId). Then the steps, re-read until they change (≤10 s). Ask the user first.",
    props: { boId: { type: "string" }, code: { type: "string", description: "The process BO code instead of boId" }, boiId: { type: "string" },
      action: { type: "string", enum: ["forward", "retry"] }, arrowId: { type: "string" }, figureId: { type: "string" } },
    required: ["boiId", "action"],
    run: async (a) => {
      const s = stand(a), boId = await boById(s, a), bo = await loadBo(s, boId), p = await boiProcess(s, boId, a.boiId);
      const fields = new Map<string, any>((bo.formFields ?? []).map((f: any) => [f.fieldId, f]));
      const before = await processSteps(s, p.boProcessId, a.boiId, p.def, fields);
      if (a.action === "forward") {
        if (!a.arrowId || !p.def.arrows?.[a.arrowId]) throw new Error("forward needs arrowId: an outgoing arrow of the standing step (process_steps lists them)");
        await s.call(BP_ + "push-step-forcibly", { boProcessId: p.boProcessId, boiId: a.boiId, arrowId: a.arrowId });
      } else if (a.action === "retry") {
        if (!a.figureId) throw new Error("retry needs figureId");
        await s.call(BP_ + "push-step-retry", { boProcessId: p.boProcessId, boiId: a.boiId, figureId: a.figureId });
      } else throw new Error("action is forward or retry");
      let after = before;
      for (let i = 0; i < 20 && JSON.stringify(after) === JSON.stringify(before); i++) { await sleep(500); after = await processSteps(s, p.boProcessId, a.boiId, p.def, fields); }
      return { boId, boiId: a.boiId, boProcessId: p.boProcessId, changed: JSON.stringify(after) !== JSON.stringify(before), ...after };
    } },

  // the platform behaves unlike the documents → a GitHub issue the user submits
  { name: "platform_report", description: "The stand behaved unlike MYBPM-IMPORTS.md / MYBPM-UI-API.md say, on the LATEST plugin → a prefilled GitHub issue for the user to submit under their own account (nothing is sent by this tool). Refuses on an outdated copy (update first — the fact may be fixed) and when the text names the user's stands, logins, people or companies: de-identify to placeholders (`<stand>`, `<company-a>`, …) and keep record data out. Search existing issues first (`search` url). One fact per issue. Show the user the text and give them the url; open:true only when they ask.",
    props: { title: { type: "string", description: "One line: what differs" },
      document: { type: "string", enum: ["MYBPM-IMPORTS.md", "MYBPM-UI-API.md"] },
      heading: { type: "string", description: "The heading (§, item, trap number) the fact is under" },
      mark: { type: "string", enum: ["[C]", "[I]", "[U]", "none"], description: "The mark the document gives the fact" },
      docSays: { type: "string", description: "What the document says — quote it" },
      standDid: { type: "string", description: "What the stand did instead: the exact answer / error text, de-identified" },
      repro: { type: "string", description: "The minimal API calls (path, params, body) or UI steps that show it, de-identified" },
      open: { type: "boolean", description: "Open the issue page in the user's browser — only when they asked" } },
    required: ["title", "document", "heading", "docSays", "standDid"],
    run: async (a) => {
      // the leak first: a de-identified text is worth keeping even when the copy turns out outdated
      const text = [a.title, a.heading, a.docSays, a.standDid, a.repro].filter(Boolean).join("\n");
      const hits = leaks(text);
      if (hits.length) throw new Error(`the report names the user's own stand / account / company: ${hits.join(", ")} — replace with placeholders (<stand>, <company-a>, <user>) and drop record data`);
      await latestCheck;
      if (latest && newer(latest, version)) throw new Error(`this copy is ${version}, ${latest} is out — update the plugin and re-check against the new documents before reporting (${updateHow()})`);
      const fields: Record<string, string> = { template: "platform-discrepancy.yml", title: a.title, document: a.document, heading: a.heading,
        mark: a.mark ?? "none", doc_says: a.docSays, stand_did: a.standDid, repro: a.repro ?? "", version };
      let url = `${ISSUES}/new?${new URLSearchParams(fields)}`, cut = false;
      for (const k of ["repro", "stand_did", "doc_says"]) {
        if (url.length <= 7500) break;
        fields[k] = fields[k].slice(0, Math.max(200, fields[k].length - (url.length - 7500))) + " …";
        url = `${ISSUES}/new?${new URLSearchParams(fields)}`; cut = true;
      }
      const search = `${ISSUES}?${new URLSearchParams({ q: `is:issue label:platform-discrepancy ${a.heading}` })}`;
      return { url, search, version, cut, opened: a.open === true ? openBrowser(url) : false,
        tell: `Look at \`search\` first (an existing issue → add to it instead). Then give the user \`url\`: it opens a filled issue form on GitHub, they read it and press «Submit new issue» under their own account.${cut ? " The text was too long for a link and was cut — give the user the full text to paste." : ""}` };
    } },

  // 13a. access rights (R5)
  { name: "rights_read", description: "Who may do what (R5): the rights of a BO (actions all, view, edit, create, delete, archive, export, duplicate, add), of one field (view, edit), of one tab (view) or of a menu item (view). Each action reads \"all\" (everyone), \"nobody\" or its subjects: groups, persons (names), author («Автор (инициатор)» — the records a user created), participants («Участники»), fromFields (Person fields whose person sees the record), other (untested author flags: Head, Employees, Department…). An admin always sees everything whatever this says. `subjects: true` adds what may be granted: groups and users of the company, the BO's Person fields.",
    props: { boId: { type: "string" }, code: { type: "string", description: "The BO code instead of boId" },
      field: { type: "string", description: "A field (code, fieldId or label) — its rights instead of the BO's" },
      tab: { type: "string", description: "A tab (id, code or label) of any TAB_GROUP of the BO — its rights" },
      menuItemId: { type: "string", description: "A menu item — its rights (no BO needed)" }, menu: { type: "string", description: "A menu item by code or name" },
      subjects: { type: "boolean" } },
    run: async (a) => {
      const s = stand(a), at = await rightsAt(s, a), g = (await at.load()) ?? {};
      const out: any = { what: at.what, rights: Object.fromEntries(at.actions.map((k) => [k, rightsOf(g[k], at.fields)])) };
      if (a.subjects) {
        const units = await orgUnits(s, "");
        out.groups = units.filter((u) => u.type === "GROUP").map((u) => ({ id: u.id, name: u.name }));
        out.persons = units.filter((u) => u.type === "PERSON").map((u) => ({ id: u.id, name: u.name }));
        if (at.boId) out.personFields = ((await s.call(BO_ + "load-org-field-record-list", { businessObjectId: at.boId })) ?? [])
          .map((f: any) => ({ id: f.id, name: f.name, code: at.fields.find((x) => x.fieldId === f.id)?.code ?? undefined, kind: f.kind }));
      }
      return clean(out);
    } },
  { name: "rights_save", write: true, description: "Set who may do what (R5) on a BO, a field, a tab or a menu item — target as in rights_read. `set` = {<action>: spec}; only the actions you pass change. Spec: \"all\" (everyone), \"nobody\" (an admin still sees everything), or {groups: [name|id], persons: [e-mail|name|id], author: true, participants: true, fromFields: [Person field code]} — the action's subjects become EXACTLY these (anything else is removed). Groups go in through orgUnitToAdd/orgUnitToDelete (trap 3), the null author block is built (trap 2), then «выборочно» (chosenAccessRight) is switched on while any action is not \"all\" and off otherwise (a BO's lock only turns on); read back and compared → `mismatch` rows. Hidden is not secret: the API still returns a hidden field or tab to a script. A system tab is closed with tab + {view: \"nobody\"}. Ask the user first; `dryRun: true` shows the bodies only.",
    props: { boId: { type: "string" }, code: { type: "string" }, field: { type: "string" }, tab: { type: "string" },
      menuItemId: { type: "string" }, menu: { type: "string" },
      set: { type: "object", description: "{view: \"all\" | \"nobody\" | {groups, persons, author, participants, fromFields}, edit: …}" },
      dryRun: { type: "boolean" } },
    required: ["set"],
    run: async (a) => {
      const s = stand(a);
      if (!a.set || typeof a.set !== "object" || !Object.keys(a.set).length) throw new Error("pass `set`: {<action>: \"all\" | \"nobody\" | {groups, persons, author, participants, fromFields}}");
      return clean(await rightsSave(s, await rightsAt(s, a), a.set, a.dryRun));
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
  { name: "stand_call", write: true, description: "Any stand API method, writes included, in the standard envelope (MYBPM-UI-API.md 0U.2). For the recipes no task tool covers yet (rights, menu, company settings — MYBPM-UI-API.md §0U). Writes are immediate: say what it changes and get the user's OK first; read the result back afterwards.",
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

// ── a newer release: checked once at start against main (CI fast-forwards main only on a green release) ──────

const LATEST_URL = process.env.MYBPM_LATEST_URL ?? "https://raw.githubusercontent.com/dmezhnov/MyBPM/main/.claude-plugin/plugin.json";
const RELEASE = "https://github.com/dmezhnov/MyBPM/releases/latest/download";
const newer = (a: string, b: string) => {
  const [x, y] = [a, b].map((v) => v.split(".").map(Number));
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  return false;
};
let latest: string | undefined;
const started = Date.now();
const latestCheck: Promise<void> = version === "dev" || !LATEST_URL ? Promise.resolve() :
  fetch(LATEST_URL, { signal: AbortSignal.timeout(5000) }).then((r) => r.json()).then((j: any) => {
    if (typeof j?.version === "string" && /^\d+\.\d+\.\d+$/.test(j.version)) latest = j.version;
  }).catch(() => {});

// how this copy was installed, by where the server file sits
function updateHow(): string {
  const p = HERE.replace(/\\/g, "/");
  if (existsSync(join(HERE, "..", "manifest.json")))
    return `a Claude Desktop extension: download ${RELEASE}/mybpm-stand.mcpb, open it and Install (replaces the old one), then restart Desktop`;
  if (p.includes("/local-agent-mode-sessions/"))
    return "the Claude Desktop account plugin: Customize → Plugins → Yours → Mybpm in the plugin list → ⋯ → Check for updates → the «Update» button becomes active → press it (the skills are new at once), then quit Desktop fully and start it again so these tools run the new code " +
      `(installed with Upload plugin instead: upload ${RELEASE}/mybpm-plugin.zip again)`;
  if (p.includes("/.claude/plugins/"))
    return "Claude Code: `claude plugin marketplace update mybpm`, then `claude plugin update mybpm@mybpm`, then restart Claude Code";
  return "a checkout of the MyBPM repository: `git pull` in it";
}

let releaseTold = false;
async function releaseNote(t: Tool): Promise<string | undefined> {
  if (releaseTold && t.name !== "stand_list") return;
  if (!releaseTold) await Promise.race([latestCheck, new Promise((r) => setTimeout(r, Math.max(0, 1500 - (Date.now() - started))))]);
  releaseTold = true;
  if (!latest || !newer(latest, version)) return;
  return `NOTE for Claude: the mybpm plugin ${latest} is out, this copy is ${version}. Open your reply with this warning block, in the user's language, ` +
    `then the answer (go on with the task on this copy):\n\n> ⚠️ **A new version of the MyBPM plugin is out: ${latest}** (you have ${version}).\n> To update: ${updateHow()}.`;
}

const INSTRUCTIONS = "Drives a running MyBPM stand. Platform knowledge is in the mybpm-stand / mybpm-imports skills " +
  "(MYBPM-UI-API.md, MYBPM-IMPORTS.md) — read them; these tools only do the calls. Several stand accounts may be kept: " +
  "all accounts are equal: start with stand_list (each one asked live); one account → it is used by itself; several and the user " +
  "has not said which in this conversation → ask them, then pass `stand` (a name or a host) on every call. A new account or a " +
  "re-login goes through stand_accounts (a local page — give the user its link, open their browser only when they ask; never ask for a password in the chat). Before a write, name the account, stand and company in the question. " +
  "Write tools (import_apply, import_rollback, import_cancel, bo_create, bo_fields_save, bo_code_set, bo_delete, co_build, rights_save, record_save, record_delete, xlsx_import with confirm, script_write, scripts_wire, script_version, process_edit, process_version, process_run_ways, process_push, notifications_clear, stand_call) change the stand: get the user's OK first. " +
  "An archive you built where the stand is unreachable goes in with archive_put, then import_analyze → import_apply. " +
  "Finish a session by clearing the notifications your work raised (notifications_read → notifications_clear). " +
  "A result that ends with «NOTE for Claude» about a newer release: open your reply with the warning block it gives, then go on. " +
  "The stand behaves unlike the documents say, on the latest plugin → platform_report prepares a GitHub issue the user submits (ask them first).";

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
        annotations: { readOnlyHint: !t.write && !["stand_accounts", "archive_put", "import_analyze", "structure_export"].includes(t.name), destructiveHint: !!t.write, openWorldHint: true } })) };
    case "tools/call": {
      const t = tools.find((x) => x.name === msg.params?.name);
      if (!t) throw Object.assign(new Error(`unknown tool ${msg.params?.name}`), { code: -32602 });
      try {
        await baseline(t, msg.params?.arguments ?? {});
        const out = await t.run(msg.params?.arguments ?? {});
        const note = await releaseNote(t);
        return { content: [{ type: "text", text: typeof out === "string" ? out : JSON.stringify(out, null, 1) }, ...(note ? [{ type: "text", text: note }] : [])] };
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
