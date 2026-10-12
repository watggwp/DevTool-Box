// Regex Tester: matching runs in a throw-away Worker with a timeout,
// so catastrophic backtracking cannot freeze the page.
import { $, $$, showErr, copyText, toast } from "/assets/js/common.js";

const MAX_MATCHES = 1000;
const TIMEOUT_MS = 1000;

const pat = $("#rxPattern"), text = $("#rxText"), out = $("#rxOut");
const repOn = $("#rxReplaceOn"), rep = $("#rxReplace"), repOut = $("#rxReplaced");
const table = $("#rxTable"), note = $("#rxTableNote"), countEl = $("#rxCount");

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const WORKER_SRC = `
self.onmessage = (e) => {
  const { pattern, flags, text, replacement, doReplace, max } = e.data;
  let re;
  try { re = new RegExp(pattern, flags); } catch (err) { self.postMessage({ error: err.message }); return; }
  const pack = (m) => ({ i: m.index, t: m[0], g: m.slice(1), n: m.groups ? Object.assign({}, m.groups) : null });
  const matches = [];
  let truncated = false;
  if (!re.global && !re.sticky) {
    const m = re.exec(text);
    if (m) matches.push(pack(m));
  } else {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      if (matches.length >= max) { truncated = true; break; }
      matches.push(pack(m));
      if (m[0] === "") re.lastIndex++;
      if (!re.global) { /* sticky only: continue contiguous matches */ }
    }
  }
  let replaced = null;
  if (doReplace) { re.lastIndex = 0; replaced = text.replace(re, replacement); }
  self.postMessage({ matches, truncated, replaced });
};`;
const workerUrl = URL.createObjectURL(new Blob([WORKER_SRC], { type: "text/javascript" }));

let worker = null, timer = null, runId = 0;

function flags() {
  return $$("[data-flag]").filter((c) => c.checked).map((c) => c.dataset.flag).join("");
}

function killWorker() {
  if (worker) { worker.terminate(); worker = null; }
  clearTimeout(timer);
}

function run() {
  const id = ++runId;
  const f = flags();
  $("#rxFlagText").textContent = f;
  $("#rxTextInfo").textContent = `${text.value.length} ตัวอักษร`;
  showErr("#rxErr");
  showErr("#rxWarn");

  const pattern = pat.value;
  if (!pattern) { render(text.value, [], false); repOut.hidden = true; return; }
  // quick syntax check on the main thread (compiling never backtracks)
  try { new RegExp(pattern, f); } catch (e) { showErr("#rxErr", "รูปแบบไม่ถูกต้อง: " + e.message); render(text.value, [], false); return; }

  killWorker();
  worker = new Worker(workerUrl);
  timer = setTimeout(() => {
    if (id !== runId) return;
    killWorker();
    showErr("#rxWarn", `หยุดการทำงานแล้ว: รูปแบบนี้ใช้เวลาเกิน ${TIMEOUT_MS / 1000} วินาที อาจเกิด catastrophic backtracking เช่น (a+)+ ลองทำให้รูปแบบเจาะจงขึ้น`);
    countEl.textContent = "timeout";
  }, TIMEOUT_MS);
  worker.onmessage = (e) => {
    if (id !== runId) return;
    killWorker();
    const d = e.data;
    if (d.error) { showErr("#rxErr", "รูปแบบไม่ถูกต้อง: " + d.error); return; }
    render(text.value, d.matches, d.truncated);
    if (repOn.checked) { repOut.hidden = false; repOut.textContent = d.replaced ?? ""; }
    else repOut.hidden = true;
  };
  worker.postMessage({ pattern, flags: f, text: text.value, replacement: rep.value, doReplace: repOn.checked, max: MAX_MATCHES });
}

function render(src, matches, truncated) {
  // highlighted text
  let html = "", pos = 0;
  matches.forEach((m, k) => {
    if (m.i < pos) return; // overlapping (should not happen)
    html += esc(src.slice(pos, m.i));
    if (m.t === "") html += `<mark class="rx-zero" title="match ว่างที่ตำแหน่ง ${m.i}"></mark>`;
    else html += `<mark class="${k % 2 ? "rx-b" : "rx-a"}" title="#${k + 1} ตำแหน่ง ${m.i}">${esc(m.t)}</mark>`;
    pos = m.i + m.t.length;
  });
  html += esc(src.slice(pos));
  out.innerHTML = html || '<span class="muted">ข้อความว่าง</span>';
  countEl.textContent = `${matches.length}${truncated ? "+" : ""} match`;
  if (truncated) showErr("#rxWarn", `แสดงเฉพาะ ${MAX_MATCHES} ผลลัพธ์แรก`);

  // table
  if (!matches.length) { table.innerHTML = ""; note.hidden = false; note.textContent = pat.value ? "ไม่พบผลลัพธ์" : "ยังไม่มีผลลัพธ์"; return; }
  note.hidden = true;
  const maxG = Math.max(0, ...matches.map((m) => m.g.length));
  const names = matches[0].n ? Object.keys(matches[0].n) : [];
  let head = "<tr><th>#</th><th>ตำแหน่ง</th><th>match</th>";
  for (let g = 1; g <= maxG; g++) head += `<th>$${g}</th>`;
  for (const n of names) head += `<th>&lt;${esc(n)}&gt;</th>`;
  head += "</tr>";
  const cell = (v) => (v === undefined || v === null ? '<td class="muted">–</td>' : `<td class="mono copyable">${esc(v)}</td>`);
  const rows = matches.slice(0, 300).map((m, k) => {
    let r = `<tr><td>${k + 1}</td><td class="mono">${m.i}-${m.i + m.t.length}</td>${cell(m.t)}`;
    for (let g = 0; g < maxG; g++) r += cell(m.g[g]);
    for (const n of names) r += cell(m.n?.[n]);
    return r + "</tr>";
  });
  table.innerHTML = head + rows.join("");
  if (matches.length > 300) { note.hidden = false; note.textContent = `ตารางแสดง 300 รายการแรกจาก ${matches.length}`; }
}

let deb;
const schedule = () => { clearTimeout(deb); deb = setTimeout(run, 150); };
pat.addEventListener("input", schedule);
text.addEventListener("input", schedule);
rep.addEventListener("input", schedule);
$$("[data-flag]").forEach((c) => c.addEventListener("change", run));
repOn.addEventListener("change", () => { rep.disabled = !repOn.checked; if (repOn.checked) rep.focus(); run(); });

// cheat-sheet chips insert at cursor
$("#rxChips").addEventListener("click", (e) => {
  const b = e.target.closest("[data-ins]");
  if (!b) return;
  const ins = b.dataset.ins, back = Number(b.dataset.back || 0);
  const s = pat.selectionStart ?? pat.value.length, en = pat.selectionEnd ?? s;
  pat.value = pat.value.slice(0, s) + ins + pat.value.slice(en);
  pat.focus();
  const caret = s + ins.length - back;
  pat.setSelectionRange(caret, caret);
  schedule();
});

const PRESETS = {
  email: ["[\\w.+-]+@[\\w-]+(?:\\.[\\w-]+)+", "gi", "ติดต่อ admin@example.com หรือ sales.team+th@company.co.th\nไม่ใช่อีเมล: user@ , @domain.com"],
  ipv4: ["\\b(?:(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\b", "g", "gateway 192.168.1.1, dns 8.8.8.8\nไม่ถูกต้อง: 256.1.1.1, 10.0.0"],
  thphone: ["\\b0(?:[689]\\d-?\\d{3}-?\\d{4}|[2-7]-?\\d{3}-?\\d{4})\\b", "g", "มือถือ 081-234-5678, 0912345678\nบ้าน 02-123-4567, 053123456\nไม่ใช่: 1234567"],
  mac: ["\\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\\b", "g", "ESP32 MAC: 24:6F:28:AB:CD:EF\nWindows: 00-1A-2B-3C-4D-5E\nไม่ใช่: 24:6F:28:AB:CD"],
  hex: ["\\b(?:0x)?[0-9A-Fa-f]{2}\\b", "g", "frame: 01 03 00 00 00 0A C5 CD\nC array: 0x1F, 0xA0, 0xFF"],
  date: ["(?<year>\\d{4})-(?<month>0[1-9]|1[0-2])-(?<day>0[1-9]|[12]\\d|3[01])", "g", "log 2026-10-12 19:30 เริ่มงาน\nสิ้นสุด 2026-12-31\nไม่ถูกต้อง 2026-13-01"],
};
$("#rxPreset").addEventListener("change", (e) => {
  const p = PRESETS[e.target.value];
  if (!p) return;
  pat.value = p[0];
  $$("[data-flag]").forEach((c) => (c.checked = p[1].includes(c.dataset.flag)));
  text.value = p[2];
  e.target.value = "";
  run();
});

$("#rxCopyLiteral").addEventListener("click", () => {
  if (!pat.value) { toast("ยังไม่มีรูปแบบ"); return; }
  copyText(`/${pat.value.replace(/\//g, "\\/")}/${flags()}`);
});

// initial example
pat.value = PRESETS.date[0];
text.value = PRESETS.date[2];
run();
