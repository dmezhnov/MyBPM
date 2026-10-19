/**
 * The accounts page of the mybpm-stand MCP server (tool stand_accounts): served on 127.0.0.1 under a secret path,
 * it lists the stand accounts and adds, edits and removes them (all equal, none is the default). The password typed here goes
 * to the server and on to the stand — never through the model. Plain HTML + JS, no external resources.
 */
export const PAGE_HTML = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>MyBPM — учётки стендов</title>
<style>
:root{--bg:#fff;--fg:#1d1d1f;--mute:#6e6e73;--line:#d9d9de;--acc:#2b6cb0;--bad:#c53030;--ok:#2f855a;--card:#f6f6f8}
@media (prefers-color-scheme:dark){:root{--bg:#1c1c1e;--fg:#f2f2f7;--mute:#a1a1a6;--line:#3a3a3c;--acc:#63a4ff;--bad:#ff6b6b;--ok:#5fd38d;--card:#2c2c2e}}
[hidden]{display:none!important}html,body{background:var(--bg)}body{margin:0;min-height:100vh;color:var(--fg);font:15px/1.45 system-ui,sans-serif}
main{max-width:860px;margin:0 auto;padding:24px 16px}
h1{font-size:22px;margin:0 0 4px}p.sub{color:var(--mute);margin:0 0 20px}
table{width:100%;border-collapse:collapse;margin-bottom:24px}th,td{text-align:left;padding:8px 6px;border-bottom:1px solid var(--line);vertical-align:top}
th{font-weight:600;color:var(--mute);font-size:13px}td small{color:var(--mute)}
button{font:inherit;border:1px solid var(--line);background:var(--card);color:var(--fg);border-radius:6px;padding:4px 10px;cursor:pointer;margin:0 4px 4px 0}
button.primary{background:var(--acc);border-color:var(--acc);color:#fff}button.danger{color:var(--bad)}
form{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px;display:grid;gap:10px;max-width:460px}
label{display:grid;gap:4px;font-size:13px;color:var(--mute)}input{font:inherit;padding:7px 9px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--fg)}
label.check{display:flex;gap:6px;align-items:center;color:var(--fg)}.msg{min-height:1.4em}.bad{color:var(--bad)}.ok{color:var(--ok)}.star{color:var(--acc);font-weight:600}
</style></head><body><main>
<h1>Учётки стендов MyBPM</h1>
<p class="sub">Хранятся только на этом компьютере. Пароль уходит со страницы прямо на стенд, в чат он не попадает. С галочкой «Запомнить пароль» он хранится в системном хранилище секретов (Linux — Secret Service, macOS — Связка ключей, Windows — DPAPI), и когда сессия истекает, сервер сам входит заново.</p>
<table><thead><tr><th>Название</th><th>Стенд / логин</th><th>Кто</th><th></th></tr></thead><tbody id="rows"></tbody></table>
<button class="primary" id="add">Добавить учётку</button>
<form id="form" hidden>
<strong id="ftitle">Новая учётка</strong>
<label>Название (необязательно)<input name="name" placeholder="например, Тестовый core2"></label>
<label>Стенд<input name="stand" required placeholder="mybpm.example.com"></label>
<label>Логин<input name="login" required autocomplete="username"></label>
<label>Пароль<input name="password" type="password" autocomplete="current-password"></label>
<label class="check"><input name="remember" type="checkbox" checked> Запомнить пароль — входить заново самому, когда сессия истекла</label>
<div><button class="primary" type="submit">Сохранить</button><button type="button" id="cancel">Отмена</button></div>
<div class="msg" id="fmsg"></div>
</form>
<p class="msg" id="msg"></p>
</main><script>
const $ = (id) => document.getElementById(id), form = $("form");
const api = (r, b) => fetch("api/" + r, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) })
  .then(async (x) => { const j = await x.json(); if (!x.ok) throw new Error(j.error); return j; });
const say = (el, text, cls) => { el.textContent = text; el.className = "msg " + (cls || ""); };
const el = (tag, text, cls) => { const e = document.createElement(tag); if (text) e.textContent = text; if (cls) e.className = cls; return e; };
let was = null;
function edit(a) {
  was = a ? a.key : null; form.hidden = false; say($("fmsg"), "");
  $("ftitle").textContent = a ? "Изменить учётку" : "Новая учётка";
  form.name.value = a ? a.name || "" : ""; form.stand.value = a ? (a.origin.startsWith("https://") ? a.origin.slice(8) : a.origin) : ""; form.login.value = a ? a.login : ""; form.password.value = ""; form.remember.checked = a ? a.remember !== false : true;
  form.password.placeholder = a ? "пусто = не входить заново" : ""; form.password.required = !a;
  (a ? form.password : form.stand).focus();
}
async function load() {
  const rows = await api("list"), tb = $("rows"); tb.replaceChildren();
  if (!rows.length) { const tr = el("tr"), td = el("td", "Учёток пока нет — добавьте первую."); td.colSpan = 4; tr.append(td); tb.append(tr); }
  for (const a of rows) {
    const tr = el("tr"), name = el("td"), where = el("td"), who = el("td"), act = el("td");
    name.append(el("span", a.name || "—"));
    where.append(el("div", a.stand), el("small", a.login + (a.remember ? " · пароль запомнен" : "")));
    who.append(el("div", a.fio || ""), el("small", a.companyCode || "")); const st = el("div"); who.append(st);
    const b = (t, f, cls) => { const x = el("button", t, cls); x.type = "button"; x.onclick = f; act.append(x); };
    b("Проверить", async () => { say(st, "…"); const r = await api("check", { key: a.key });
      say(st, r.alive ? (r.relogged ? "сессия истекла — вошёл заново по запомненному паролю" : "сессия жива") : "сессия истекла — «Изменить» и войти заново", r.alive ? "ok" : "bad"); });
    if (a.via === "token file") {
      b("Изменить", () => edit(a));
      // the second click removes: no confirm() dialog
      b("Удалить", async (ev) => { const x = ev.target; if (!x.dataset.sure) { x.dataset.sure = 1; x.textContent = "Точно удалить?"; return; }
        try { await api("remove", { key: a.key }); say($("msg"), "Удалено: " + a.stand + " / " + a.login + ".", "ok"); load(); } catch (e) { say($("msg"), e.message, "bad"); } }, "danger");
    }
    tr.append(name, where, who, act); tb.append(tr);
  }
}
$("add").onclick = () => edit(null);
$("cancel").onclick = () => { form.hidden = true; };
form.onsubmit = async (ev) => {
  ev.preventDefault(); const btn = form.querySelector("button[type=submit]"); btn.disabled = true;
  say($("fmsg"), form.password.value ? "Вхожу на стенд…" : "Сохраняю…");
  try {
    const r = await api("save", { was, name: form.name.value, stand: form.stand.value, login: form.login.value, password: form.password.value, remember: form.remember.checked });
    form.password.value = ""; form.hidden = true;
    say($("msg"), "Готово: " + r.stand + " / " + r.login + (r.fio ? " — " + r.fio + ", " + (r.companyCode || "") : "") + (r.remembered ? ", пароль запомнен" : "") + "." + (r.rememberError ? " Внимание: " + r.rememberError + "." : "") + " Можно вернуться в чат.", r.rememberError ? "bad" : "ok");
    load();
  } catch (e) { say($("fmsg"), e.message, "bad"); } finally { btn.disabled = false; }
};
const pre = new URLSearchParams(location.hash.replace(/^#add&?/, ""));
load().then(() => { if (location.hash.startsWith("#add")) { edit(null); form.stand.value = pre.get("stand") || ""; form.login.value = pre.get("login") || ""; form.name.value = pre.get("name") || "";
  (form.stand.value ? (form.login.value ? form.password : form.login) : form.stand).focus(); } });
</script></body></html>
`;
