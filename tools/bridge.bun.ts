/**
 * Page <-> disk bridge for driving a stand from Claude-in-Chrome (MYBPM-UI-API.md §10).
 * An https page may fetch http://127.0.0.1, so bytes cross this way instead of through the tool output:
 *   GET  /get?name=<f>   → the bytes of tools/out/bridge/<f>   (e.g. an archive to import)
 *   POST /save?name=<f>  → writes the body to tools/out/bridge/<f> (e.g. an export, a JSON dump)
 * Run with `mise run bridge` (detached, pid in tools/out/bridge/bridge.pid), stop with `mise run bridge-stop`.
 */
const DIR = `${import.meta.dir}/out/bridge`;
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
await Bun.write(`${DIR}/bridge.pid`, String(process.pid));
Bun.serve({
  port: 8787,
  hostname: "127.0.0.1",
  async fetch(req) {
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    const url = new URL(req.url);
    const name = url.searchParams.get("name") ?? "";
    if (!name || name.includes("/") || name.startsWith(".")) return new Response("bad name", { status: 400, headers: cors });
    const path = `${DIR}/${name}`;
    if (url.pathname === "/get") {
      const f = Bun.file(path);
      return (await f.exists()) ? new Response(f, { headers: cors }) : new Response("no file", { status: 404, headers: cors });
    }
    if (url.pathname === "/save" && req.method === "POST") {
      const n = await Bun.write(path, await req.arrayBuffer());
      console.log(`saved ${name} (${n} bytes)`);
      return new Response(String(n), { headers: cors });
    }
    return new Response("not found", { status: 404, headers: cors });
  },
});
console.log("bridge on 127.0.0.1:8787");
