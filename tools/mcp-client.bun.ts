#!/usr/bin/env bun
/**
 * Drives the mybpm-stand MCP server (mcp/mybpm-stand.cjs) from the shell: starts it over stdio, initializes,
 * lists the tools or calls them one after another, prints each result. What `mise test` uses against the mock
 * stand, and the quick way to try a tool on a real stand without a chat.
 *
 *   bun tools/mcp-client.bun.ts list
 *   bun tools/mcp-client.bun.ts call stand_list '{}' [bo_groups '{}' …]
 *   bun tools/mcp-client.bun.ts call … --runtime bun --quiet       (default runtime node; --quiet prints only errors)
 *   bun tools/mcp-client.bun.ts call … --server dist/x/server/mybpm-stand.cjs   (another copy of the server, e.g. unpacked .mcpb)
 *   bun tools/mcp-client.bun.ts call … --json                      (one JSON array [{tool, isError, result}] instead)
 *
 * A string argument "@<tool>.<path>" is replaced by that value of the latest JSON result of <tool>, e.g.
 *   call import_analyze '{"name":"crm"}' import_apply '{"importId":"@import_analyze.importId","description":"…"}'
 *   notifications_clear '{"ids":["@notifications_read.items.0.id"]}'
 *
 * The pseudo-tool `http` posts JSON to the server's accounts page, as the page's own form does — how a test logs
 * in without a browser: http '{"url":"@stand_accounts.url","path":"api/save","body":{"stand":"…","login":"…","password":"…"}}'
 * (a `#add…` prefill on the url is dropped; an HTTP error status counts as isError; the answer is the result `http`).
 *
 * The server takes its stand and credentials from the environment (MYBPM_STAND, MYBPM_TOKEN …, see the
 * server's header) or the token files of `mise run stand-login`. Exit 1 when any call answers isError.
 */
const argv = Bun.argv.slice(2);
const runtime = argv.includes("--runtime") ? argv[argv.indexOf("--runtime") + 1] : "node";
const quiet = argv.includes("--quiet"), asJson = argv.includes("--json");
const serverFile = argv.includes("--server") ? argv[argv.indexOf("--server") + 1] : `${import.meta.dir}/../mcp/mybpm-stand.cjs`;
const rest = argv.filter((a, i) => !a.startsWith("--") && argv[i - 1] !== "--runtime" && argv[i - 1] !== "--server");
const [mode, ...pairs] = rest;
if (mode !== "list" && mode !== "call") {
  console.error("usage: bun tools/mcp-client.bun.ts list | call <tool> '<json args>' [<tool> '<json>' …]");
  process.exit(2);
}

const server = Bun.spawn([runtime, serverFile], { stdin: "pipe", stdout: "pipe", stderr: "inherit" });
const pending = new Map<number, (v: any) => void>();
(async () => {
  let buf = "";
  for await (const chunk of server.stdout) {
    buf += new TextDecoder().decode(chunk);
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const msg = JSON.parse(buf.slice(0, nl));
      buf = buf.slice(nl + 1);
      pending.get(msg.id)?.(msg);
    }
  }
})();
let id = 0;
function rpc(method: string, params: unknown = {}): Promise<any> {
  const n = ++id;
  server.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: n, method, params }) + "\n");
  server.stdin.flush();
  return new Promise((r) => pending.set(n, r));
}

const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "mcp-client", version: "0" } });
if (init.error) { console.error("initialize:", init.error); process.exit(1); }
server.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");

let failed = false;
const results: Record<string, any> = {}, report: any[] = [];
function resolveRefs(v: any): any {
  if (typeof v === "string") {
    const m = /^@(\w+)\.([\w.]+)$/.exec(v);
    if (!m) return v;
    const got = m[2].split(".").reduce((o, k) => o?.[k], results[m[1]]);
    if (got === undefined) throw new Error(`${v}: no such value in the latest ${m[1]} result`);
    return got;
  }
  if (Array.isArray(v)) return v.map(resolveRefs);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolveRefs(x)]));
  return v;
}
if (mode === "list") {
  const { result } = await rpc("tools/list");
  for (const t of result.tools) console.log(`${t.annotations?.destructiveHint ? "✎" : " "} ${t.name.padEnd(20)} ${t.description.slice(0, 110)}`);
} else {
  for (let i = 0; i < pairs.length; i += 2) {
    let args: any;
    // an earlier failed step leaves its reference unresolved: this step fails alone, the rest of the run goes on
    try { args = resolveRefs(JSON.parse(pairs[i + 1] ?? "{}")); } catch (e) { args = e as Error; }
    let text: string, isError: boolean, notes: string[] = [];
    if (args instanceof Error) {
      text = args.message;
      isError = true;
    } else if (pairs[i] === "http") {
      const r = await fetch(String(args.url).replace(/#.*$/, "") + args.path,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(args.body ?? {}) });
      text = await r.text();
      isError = !r.ok;
    } else {
      const r = await rpc("tools/call", { name: pairs[i], arguments: args });
      text = r.error ? JSON.stringify(r.error) : r.result.content[0]?.text ?? "";
      notes = r.error ? [] : r.result.content.slice(1).map((c: any) => c.text);
      isError = !!(r.error || r.result.isError);
    }
    let result: any = text;
    try { result = JSON.parse(text); } catch {}
    if (!isError) results[pairs[i]] = result;
    if (isError) failed = true;
    if (asJson) report.push({ tool: pairs[i], isError, result, ...(notes.length ? { notes } : {}) });
    else if (!quiet || isError) console.log(`── ${pairs[i]}${isError ? " (ERROR)" : ""}\n${[text, ...notes].join("\n")}`);
  }
}
if (asJson) console.log(JSON.stringify(report, null, 1));
server.kill();
process.exit(failed ? 1 : 0);
