import { $, showErr, base64ToBytes } from "/assets/js/common.js";

const inp = $("#jwtIn");

function decodePart(p) {
  return JSON.parse(new TextDecoder().decode(base64ToBytes(p)));
}

function fmtTime(sec) {
  const d = new Date(sec * 1000);
  const diff = sec - Date.now() / 1000;
  const abs = Math.abs(diff);
  const rel = abs < 60 ? `${Math.round(abs)} วินาที` : abs < 3600 ? `${Math.round(abs / 60)} นาที` : abs < 86400 ? `${(abs / 3600).toFixed(1)} ชั่วโมง` : `${(abs / 86400).toFixed(1)} วัน`;
  return `${d.toLocaleString("th-TH", { hour12: false })} (${diff < 0 ? "ผ่านมาแล้ว " : "อีก "}${rel})`;
}

function decode() {
  showErr("#jwtErr");
  $("#jwtHeader").textContent = $("#jwtPayload").textContent = "";
  $("#jwtTimes").innerHTML = "";
  const t = inp.value.trim().replace(/^Bearer\s+/i, "");
  if (!t) return;
  const parts = t.split(".");
  if (parts.length < 2) { showErr("#jwtErr", "รูปแบบ JWT ต้องเป็น header.payload.signature"); return; }
  try {
    const header = decodePart(parts[0]);
    const payload = decodePart(parts[1]);
    $("#jwtHeader").textContent = JSON.stringify(header, null, 2);
    $("#jwtPayload").textContent = JSON.stringify(payload, null, 2);
    const rows = [];
    for (const k of ["iat", "nbf", "exp"]) {
      if (typeof payload[k] === "number") rows.push(`<tr><th>${k}</th><td>${fmtTime(payload[k])}</td></tr>`);
    }
    if (typeof payload.exp === "number") {
      const expired = payload.exp < Date.now() / 1000;
      rows.push(`<tr><th>สถานะ</th><td>${expired ? "หมดอายุแล้ว" : "ยังไม่หมดอายุ"}</td></tr>`);
    }
    const alg = String(header.alg ?? "-").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    rows.push(`<tr><th>alg</th><td>${alg}</td></tr>`);
    rows.push(`<tr><th>signature</th><td class="mono">${parts[2] ? parts[2].length + " ตัวอักษร (ไม่ได้ตรวจสอบ)" : "ไม่มี"}</td></tr>`);
    $("#jwtTimes").innerHTML = rows.join("");
  } catch (e) {
    showErr("#jwtErr", "ถอดรหัสไม่ได้: " + e.message);
  }
}

$("#jwtDecode").addEventListener("click", decode);
inp.addEventListener("input", decode);
