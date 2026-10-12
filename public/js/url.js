import { $, showErr } from "/js/common.js";

const inp = $("#urlIn"), out = $("#urlOut");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

$("#urlEncComp").addEventListener("click", () => { showErr("#urlErr"); out.value = encodeURIComponent(inp.value); });
$("#urlEncFull").addEventListener("click", () => { showErr("#urlErr"); out.value = encodeURI(inp.value); });
$("#urlDec").addEventListener("click", () => {
  try { showErr("#urlErr"); inp.value = decodeURIComponent(out.value.replace(/\+/g, "%20")); }
  catch (e) { showErr("#urlErr", "ถอดรหัสไม่ได้: " + e.message); }
});

$("#urlParse").addEventListener("input", (e) => {
  const tbl = $("#urlParseTbl");
  const v = e.target.value.trim();
  if (!v) { tbl.innerHTML = ""; return; }
  let u;
  try { u = new URL(v.includes("://") ? v : "https://" + v); }
  catch { tbl.innerHTML = `<tr><td class="muted">URL ไม่ถูกต้อง</td></tr>`; return; }
  const rows = [
    ["protocol", u.protocol], ["host", u.host], ["pathname", u.pathname], ["hash", u.hash],
  ].filter(([, val]) => val).map(([k, val]) => `<tr><th>${k}</th><td class="mono copyable">${esc(val)}</td></tr>`);
  const params = [...u.searchParams.entries()];
  if (params.length) {
    rows.push(`<tr><th colspan="2">Query parameters (${params.length})</th></tr>`);
    for (const [k, val] of params) rows.push(`<tr><th>${esc(k)}</th><td class="mono copyable">${esc(val)}</td></tr>`);
  }
  tbl.innerHTML = rows.join("");
});
