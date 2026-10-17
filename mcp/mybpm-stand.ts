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
  if (tabLabels.includes("Системные")) notes.push("tab «Системные»: close it with VIEW «никому» (R5 step 6) — not done by this tool");

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
    if (o.commandType === "SHOW_NOTIFICATION") notes.push(clean({ type: o.notificationType ?? o.type, text: o.message ?? o.text ?? o.body }));
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
        const bo = await loadBo(s, id);
        if (!a.code && /_[A-Za-z0-9]{16}$/.test(bo.code ?? "")) done.notes.push(`the code «${bo.code}» carries the rename-race uniquifier (trap 24) — bo_code_set it`);
        return clean({ id, name: bo.name, code: bo.code, boCategory: bo.boCategory, group: g.name,
          url: `${s.c.origin}/business-objects/editing/${id}/object-editing`, window: done.window, notes: done.notes, fields: fieldRows(bo),
          next: "compare fields with what you asked; codes of tabs and rights are not set by this tool (R5, §5k)" });
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
            next: `the stand kept answering «Data too large» (trap 73); in a minute record_read id ${boiId} — values there = stored, an error = nothing was kept${a.id ? "" : "; a stored but unwanted record goes with record_delete"}` };
        }
      }
      if (!out.saved) {
        // nothing kept: a new record is deleted with its draft first (what the UI sends), an existing one only closed
        if (!a.id) await s.call(BOI_ + "v2/delete-boi", { draftId, boiId }, {}).catch(() => {});
        await s.call("v2/instance-form/remove-draft", { draftId }, {}).catch(() => {});
        return clean({ boId, id: a.id, saved: false, cycle: "form (scripts ran)", errors: out.errors, notifications: out.notifications,
          why: out.errors.length ? "a field error vetoed the save (a script or a rule) — nothing was stored" : "no CLOSE_DIALOG_SAVE — e.g. an empty required field; nothing was stored" });
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
  { name: "stand_call", write: true, description: "Any stand API method, writes included, in the standard envelope (MYBPM-UI-API.md 0U.2). For the recipes no task tool covers yet (scripts, processes, rights, menu — MYBPM-UI-API.md §0U). Writes are immediate: say what it changes and get the user's OK first; read the result back afterwards.",
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
  "Write tools (import_apply, import_rollback, import_cancel, bo_create, bo_fields_save, bo_code_set, bo_delete, co_build, record_save, record_delete, xlsx_import with confirm, notifications_clear, stand_call) change the stand: get the user's OK first. " +
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
