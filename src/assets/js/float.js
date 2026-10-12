import { $, showErr } from "/assets/js/common.js";
import { ORDERS32, ORDERS64, parseHex, toHex, parseDecimal, toBytesBE, fromBytesBE, toOrder, fromOrder, fields, CLASS_TH, registersToFloat, formatFloat, shortestF32 } from "/assets/js/float-core.js";

function renderBits(el, be) {
  const f = fields(be);
  const parts = [];
  const add = (str, cls) => { for (const ch of str) parts.push(`<span class="${cls}">${ch}</span>`); };
  add(f.sign, "s");
  parts.push('<span class="gap"></span>');
  add(f.exp, "e");
  parts.push('<span class="gap"></span>');
  add(f.mant, "m");
  el.innerHTML = parts.join("");
  return f;
}

function clsText(f) {
  const exp = f.cls === "normal" || f.cls === "subnormal" ? ` / exponent ${f.expValue} - ${f.bias} = ${f.expUnbiased}` : "";
  return `${CLASS_TH[f.cls]}${exp}`;
}

// ---------- decimal -> hex ----------
function decToHex() {
  showErr("#fDecErr");
  const tbl = $("#fDecTbl");
  const raw = $("#fDec").value;
  if (!raw.trim()) { tbl.innerHTML = ""; $("#fDecBits32").innerHTML = $("#fDecBits64").innerHTML = ""; return; }
  let v;
  try { v = parseDecimal(raw); } catch (e) { showErr("#fDecErr", e.message); return; }
  const be32 = toBytesBE(v, 32), be64 = toBytesBE(v, 64);
  const stored = fromBytesBE(be32);
  const rows = Object.entries(ORDERS32).map(([o, name]) => `<tr><th>float32 ${name}</th><td class="mono copyable">${toHex(toOrder(be32, o))}</td></tr>`);
  rows.push(...Object.entries(ORDERS64).map(([o, name]) => `<tr><th>float64 ${name}</th><td class="mono copyable">${toHex(toOrder(be64, o))}</td></tr>`));
  rows.push(`<tr><th>ค่าที่ float32 เก็บได้จริง</th><td class="mono copyable">${formatFloat(stored, 32)}</td></tr>`);
  if (Number.isFinite(v) && stored !== v) {
    rows.push(`<tr><th>ความคลาดเคลื่อน float32</th><td class="mono">${(stored - v).toExponential(3)}</td></tr>`);
  }
  rows.push(`<tr><th>Modbus 2 register (ABCD)</th><td class="mono copyable">${toHex(be32.subarray(0, 2), "")} ${toHex(be32.subarray(2), "")}</td></tr>`);
  tbl.innerHTML = rows.join("");
  $("#fDecCls32").textContent = clsText(renderBits($("#fDecBits32"), be32));
  $("#fDecCls64").textContent = clsText(renderBits($("#fDecBits64"), be64));
}

// ---------- hex -> decimal ----------
function hexToDec() {
  showErr("#fHexErr");
  const tbl = $("#fHexTbl"), bitsEl = $("#fHexBits"), orderSel = $("#fHexOrder");
  tbl.innerHTML = ""; bitsEl.innerHTML = "";
  const raw = $("#fHex").value;
  if (!raw.trim()) return;
  let bytes;
  try { bytes = parseHex(raw); } catch (e) { showErr("#fHexErr", e.message); return; }
  if (bytes.length !== 4 && bytes.length !== 8) { showErr("#fHexErr", `ต้องเป็น 4 ไบต์ (float32) หรือ 8 ไบต์ (float64) แต่ได้ ${bytes.length} ไบต์`); return; }
  const is64 = bytes.length === 8;
  // float64 only supports big / little endian
  for (const opt of orderSel.options) opt.disabled = is64 && (opt.value === "CDAB" || opt.value === "BADC");
  let order = orderSel.value;
  if (is64 && opt64(order) === null) { orderSel.value = "ABCD"; order = "ABCD"; }
  const be = fromOrder(bytes, is64 ? opt64(order) : order);
  const v = fromBytesBE(be);
  const f = renderBits(bitsEl, be);
  const shown = is64 ? formatFloat(v, 64) : String(Number.isFinite(v) ? shortestF32(v) : formatFloat(v, 32));
  tbl.innerHTML = [
    ["ชนิด", is64 ? "float64 (double)" : "float32 (float)"],
    ["ค่า", shown],
    ...(is64 ? [] : [["ค่าละเอียด (9 หลัก)", formatFloat(v, 32)]]),
    ["Big-endian hex", toHex(be)],
    ["ประเภท", clsText(f)],
  ].map(([k, val]) => `<tr><th>${k}</th><td class="mono copyable">${val}</td></tr>`).join("");
}
const opt64 = (o) => (o === "ABCD" ? "BE" : o === "DCBA" ? "LE" : null);

// ---------- two registers -> float ----------
function parseReg(s) {
  const t = s.trim();
  const n = /^0x[0-9a-f]+$/i.test(t) ? parseInt(t, 16) : /^\d+$/.test(t) ? Number(t) : NaN;
  if (!Number.isInteger(n) || n < 0 || n > 0xffff) throw new Error(`register "${s}" ต้องเป็น 0 ถึง 65535 หรือ 0x0000 ถึง 0xFFFF`);
  return n;
}
function regsToFloat() {
  showErr("#fRErr");
  const tbl = $("#fRTbl");
  try {
    const r = registersToFloat(parseReg($("#fR1").value), parseReg($("#fR2").value), $("#fROrder").value);
    const other = registersToFloat(parseReg($("#fR1").value), parseReg($("#fR2").value), $("#fROrder").value === "ABCD" ? "CDAB" : "ABCD");
    const fmt = (x) => (Number.isFinite(x) ? shortestF32(x) : formatFloat(x, 32));
    tbl.innerHTML = [
      ["float32", fmt(r.f32)],
      ["int32", r.i32],
      ["uint32", r.u32],
      ["Big-endian hex", toHex(r.be)],
      ["ถ้าสลับลำดับ", `${fmt(other.f32)} (float32)`],
    ].map(([k, val]) => `<tr><th>${k}</th><td class="mono copyable">${val}</td></tr>`).join("");
  } catch (e) { tbl.innerHTML = ""; showErr("#fRErr", e.message); }
}

$("#fDec").addEventListener("input", decToHex);
$("#fHex").addEventListener("input", hexToDec);
$("#fHexOrder").addEventListener("change", hexToDec);
for (const id of ["#fR1", "#fR2"]) $(id).addEventListener("input", regsToFloat);
$("#fROrder").addEventListener("change", regsToFloat);

decToHex();
hexToDec();
regsToFloat();
