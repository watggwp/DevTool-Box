import { $, showErr } from "/js/common.js";

const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
$("#tzInfo").textContent = `timezone: ${tz}`;

function tick() {
  const now = Date.now();
  $("#nowSec").textContent = Math.floor(now / 1000);
  $("#nowMs").textContent = now;
}
tick(); setInterval(tick, 1000);

function rows(d, extra = []) {
  if (isNaN(d)) return `<tr><td class="muted">วันที่ไม่ถูกต้อง</td></tr>`;
  const sec = Math.floor(d.getTime() / 1000);
  const list = [
    ["Local", d.toLocaleString("th-TH", { hour12: false, dateStyle: "full", timeStyle: "medium" })],
    ["UTC", d.toUTCString()],
    ["ISO 8601", d.toISOString()],
    ["Unix (s)", sec],
    ["Unix (ms)", d.getTime()],
    ["Relative", relative(d)],
    ...extra,
  ];
  return list.map(([k, v]) => `<tr><th>${k}</th><td class="mono copyable">${v}</td></tr>`).join("");
}

function relative(d) {
  const diff = (d.getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  const u = abs < 60 ? [abs, "วินาที"] : abs < 3600 ? [abs / 60, "นาที"] : abs < 86400 ? [abs / 3600, "ชั่วโมง"] : [abs / 86400, "วัน"];
  return `${diff < 0 ? "ผ่านมาแล้ว" : "อีก"} ${u[0].toFixed(u[1] === "วินาที" ? 0 : 1)} ${u[1]}`;
}

function tsToDate() {
  showErr("#timeErr");
  const raw = $("#tsIn").value.trim();
  if (!raw) { $("#tsResult").innerHTML = ""; return; }
  const n = Number(raw);
  if (!isFinite(n)) { showErr("#timeErr", "ต้องเป็นตัวเลข"); return; }
  const isMs = Math.abs(n) >= 1e11;
  const d = new Date(isMs ? n : n * 1000);
  $("#tsResult").innerHTML = rows(d, [["ตีความเป็น", isMs ? "มิลลิวินาที" : "วินาที"]]);
}

function dateToTs() {
  showErr("#timeErr");
  const v = $("#dateIn").value;
  if (!v) { $("#dateResult").innerHTML = ""; return; }
  $("#dateResult").innerHTML = rows(new Date(v));
}

$("#tsToDate").addEventListener("click", tsToDate);
$("#tsIn").addEventListener("input", tsToDate);
$("#dateToTs").addEventListener("click", dateToTs);
$("#dateIn").addEventListener("change", dateToTs);

// default: now
const now = new Date();
now.setMilliseconds(0);
const pad = (n) => String(n).padStart(2, "0");
$("#dateIn").value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
