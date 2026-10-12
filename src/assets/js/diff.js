import { $, showErr, copyText, toast } from "/assets/js/common.js";
import { diffLines, unified, stats, charDiff, pairRows } from "/assets/js/diff-core.js";

const MAX_LINES = 20000;     // refuse beyond this
const LIVE_LIMIT = 200_000;  // characters; above this only diff on button press
const CTX = 3;

const A = $("#dfA"), B = $("#dfB"), out = $("#dfOut");
let last = null;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function info() {
  const n = (t) => (t === "" ? 0 : t.split(/\r\n|\r|\n/).length);
  $("#dfInfoA").textContent = `${n(A.value)} บรรทัด`;
  $("#dfInfoB").textContent = `${n(B.value)} บรรทัด`;
}

function segHtml(segs, cls) {
  return segs.map((s) => (s.t === "=" ? esc(s.s) : `<span class="${cls}">${esc(s.s)}</span>`)).join("");
}

// Returns [leftHtml, rightHtml] for a changed line pair with char-level highlight.
function pairHtml(x, y) {
  const cd = charDiff(x, y);
  if (!cd) return [esc(x), esc(y)];
  return [segHtml(cd.left, "df-chd"), segHtml(cd.right, "df-cha")];
}

// Decide which row indices are visible when collapsing unchanged lines.
function visibleMask(rows, collapse) {
  const vis = new Uint8Array(rows.length);
  if (!collapse) { vis.fill(1); return vis; }
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].t !== "=") {
      for (let k = Math.max(0, i - CTX); k <= Math.min(rows.length - 1, i + CTX); k++) vis[k] = 1;
    }
  }
  return vis;
}

function gapRow(count, cols) {
  return `<tr class="df-gap"><td colspan="${cols}">&#8942; ${count} บรรทัดที่เหมือนกัน</td></tr>`;
}

function renderSplit(res, collapse) {
  const rows = pairRows(res.ops);
  const vis = visibleMask(rows, collapse);
  const html = [];
  let hidden = 0;
  for (let i = 0; i < rows.length; i++) {
    if (!vis[i]) { hidden++; continue; }
    if (hidden) { html.push(gapRow(hidden, 4)); hidden = 0; }
    const r = rows[i];
    const la = r.a >= 0 ? res.A[r.a] : null, lb = r.b >= 0 ? res.B[r.b] : null;
    let lh = la === null ? "" : esc(la), rh = lb === null ? "" : esc(lb);
    let lc = "", rc = "";
    if (r.t === "~") { [lh, rh] = pairHtml(la, lb); lc = "df-del"; rc = "df-add"; }
    else if (r.t === "-") { lc = "df-del"; rc = "df-none"; }
    else if (r.t === "+") { lc = "df-none"; rc = "df-add"; }
    html.push(`<tr><td class="df-ln">${r.a >= 0 ? r.a + 1 : ""}</td><td class="df-code ${lc}">${lh}</td><td class="df-ln">${r.b >= 0 ? r.b + 1 : ""}</td><td class="df-code ${rc}">${rh}</td></tr>`);
  }
  if (hidden) html.push(gapRow(hidden, 4));
  return `<table class="df-table df-split"><colgroup><col class="df-lncol"><col><col class="df-lncol"><col></colgroup>${html.join("")}</table>`;
}

function renderUnified(res, collapse) {
  // Build unified rows: inside each change block show deletions then additions, char-highlighting pairs.
  const rows = [];
  const ops = res.ops;
  let i = 0;
  while (i < ops.length) {
    if (ops[i].t === "=") { rows.push({ t: "=", a: ops[i].a, b: ops[i].b, h: esc(res.A[ops[i].a]) }); i++; continue; }
    const dels = [], adds = [];
    while (i < ops.length && ops[i].t !== "=") { (ops[i].t === "-" ? dels : adds).push(ops[i]); i++; }
    const dh = dels.map((d) => esc(res.A[d.a])), ah = adds.map((a) => esc(res.B[a.b]));
    for (let k = 0; k < Math.min(dels.length, adds.length); k++) [dh[k], ah[k]] = pairHtml(res.A[dels[k].a], res.B[adds[k].b]);
    dels.forEach((d, k) => rows.push({ t: "-", a: d.a, b: -1, h: dh[k] }));
    adds.forEach((a, k) => rows.push({ t: "+", a: -1, b: a.b, h: ah[k] }));
  }
  const vis = visibleMask(rows, collapse);
  const html = [];
  let hidden = 0;
  for (let k = 0; k < rows.length; k++) {
    if (!vis[k]) { hidden++; continue; }
    if (hidden) { html.push(gapRow(hidden, 4)); hidden = 0; }
    const r = rows[k];
    const cls = r.t === "-" ? "df-del" : r.t === "+" ? "df-add" : "";
    const sign = r.t === "=" ? " " : r.t;
    html.push(`<tr><td class="df-ln">${r.a >= 0 ? r.a + 1 : ""}</td><td class="df-ln">${r.b >= 0 ? r.b + 1 : ""}</td><td class="df-sign ${cls}">${sign}</td><td class="df-code ${cls}">${r.h}</td></tr>`);
  }
  if (hidden) html.push(gapRow(hidden, 4));
  return `<table class="df-table df-unified"><colgroup><col class="df-lncol"><col class="df-lncol"><col class="df-signcol"><col></colgroup>${html.join("")}</table>`;
}

function run() {
  info();
  showErr("#dfWarn");
  const a = A.value, b = B.value;
  if (!a && !b) {
    out.innerHTML = '<p class="muted df-empty">ใส่ข้อความทั้งสองฝั่งแล้วกด "เปรียบเทียบ"</p>';
    last = null; setStats({ add: 0, del: 0, same: 0 }); $("#dfTime").textContent = "";
    return;
  }
  const lines = (t) => (t.match(/\n/g)?.length ?? 0) + 1;
  if (lines(a) > MAX_LINES || lines(b) > MAX_LINES) {
    showErr("#dfWarn", `ข้อความยาวเกิน ${MAX_LINES.toLocaleString()} บรรทัด กรุณาแบ่งเปรียบเทียบเป็นส่วน ๆ`);
    return;
  }
  const t0 = performance.now();
  const res = diffLines(a, b, { ignoreWs: $("#dfIgnoreWs").checked, ignoreCase: $("#dfIgnoreCase").checked });
  last = res;
  const st = stats(res.ops);
  setStats(st);
  if (res.approx) showErr("#dfWarn", "ข้อความสองชุดต่างกันมากเกินไป จึงแสดงส่วนที่ต่างเป็นการลบทั้งหมดแล้วเพิ่มใหม่ (ไม่ได้หา diff ที่สั้นที่สุด)");
  if (!st.add && !st.del) {
    out.innerHTML = '<p class="df-same">ข้อความทั้งสองชุดเหมือนกัน' + ($("#dfIgnoreWs").checked || $("#dfIgnoreCase").checked ? " (ตามเงื่อนไขที่เลือก)" : "") + "</p>";
  } else {
    const collapse = $("#dfCollapse").checked;
    out.innerHTML = $("#dfView").value === "unified" ? renderUnified(res, collapse) : renderSplit(res, collapse);
  }
  $("#dfTime").textContent = `ใช้เวลา ${(performance.now() - t0).toFixed(1)} ms`;
}

function setStats(s) {
  $("#dfStatAdd").textContent = `+${s.add} เพิ่ม`;
  $("#dfStatDel").textContent = `-${s.del} ลบ`;
  $("#dfStatSame").textContent = `${s.same} เหมือนเดิม`;
}

let deb;
function live() {
  info();
  clearTimeout(deb);
  if (A.value.length + B.value.length > LIVE_LIMIT) return; // large input: wait for button
  deb = setTimeout(run, 300);
}

A.addEventListener("input", live);
B.addEventListener("input", live);
$("#dfRun").addEventListener("click", run);
["#dfView", "#dfIgnoreWs", "#dfIgnoreCase", "#dfCollapse"].forEach((s) => $(s).addEventListener("change", run));
$("#dfSwap").addEventListener("click", () => { [A.value, B.value] = [B.value, A.value]; run(); });
$("#dfCopy").addEventListener("click", () => {
  if (!last) run();
  if (!last) { toast("ยังไม่มีข้อมูล"); return; }
  const text = unified(last, CTX);
  if (!text) { toast("ไม่มีความแตกต่าง"); return; }
  copyText(text);
});

for (const [inputSel, areaSel] of [["#dfFileA", A], ["#dfFileB", B]]) {
  $(inputSel).addEventListener("change", async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { toast("ไฟล์ใหญ่เกิน 5 MB"); e.target.value = ""; return; }
    areaSel.value = await f.text();
    e.target.value = "";
    run();
  });
}

// example
A.value = `# WiFi config\nssid=OfficeAP\npassword=12345678\nchannel=6\nmqtt_host=192.168.1.10\nmqtt_port=1883\nlog_level=info`;
B.value = `# WiFi config\nssid=OfficeAP_5G\npassword=12345678\nchannel=36\nmqtt_host=192.168.1.10\nmqtt_port=8883\nmqtt_tls=true\nlog_level=info`;
run();
