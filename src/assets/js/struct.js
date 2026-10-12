import { $, showErr } from "/assets/js/common.js";
import { parseHex, parseSpec, parseStruct, formatValue, toHex } from "/assets/js/struct-core.js";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const hexIn = $("#stHex"), specIn = $("#stSpec"), endianSel = $("#stEndian");

const PRESETS = {
  sensor: {
    hex: "AA 55 01 0A CD CC 0C 42 00 00 70 42 E8 03 00 00 4F 4B",
    spec: "header:u16be   # ไบต์เริ่มต้น 0xAA55\nid:u8 flags:u8\ntemp:f32 hum:f32\nuptime:u32\nstatus:str2",
    endian: "le",
  },
  modbus: {
    hex: "00 0A FF F6 41 C8 00 00 00 01 86 A0",
    spec: "setpoint:u16 offset:i16\ntemperature:f32\ncounter:u32",
    endian: "be",
  },
  array: {
    hex: "01 00 02 00 03 00 04 00 DE AD 00 00 FF",
    spec: "adc:u16[4] magic:hex2 skip2 rssi:i8",
    endian: "le",
  },
};

function run() {
  showErr("#stErr");
  $("#stLeft").hidden = true;
  $("#stUsed").hidden = true;
  const tbl = $("#stTbl");
  tbl.innerHTML = "";
  if (!hexIn.value.trim() || !specIn.value.trim()) { $("#stLen").textContent = ""; return; }
  let bytes, items;
  try { bytes = parseHex(hexIn.value); } catch (e) { showErr("#stErr", "ข้อมูล hex: " + e.message); return; }
  $("#stLen").textContent = `${bytes.length} bytes`;
  try { items = parseSpec(specIn.value); } catch (e) { showErr("#stErr", "รูปแบบ: " + e.message); return; }
  const r = parseStruct(bytes, items, endianSel.value);
  if (r.rows.length) {
    tbl.innerHTML = `<tr><th>Offset</th><th>ชื่อ</th><th>ชนิด</th><th>Hex</th><th style="width:auto">ค่า</th></tr>` +
      r.rows.map((x) => `<tr${x.kind === "skip" ? ' class="muted"' : ""}><td class="mono">${x.offset}</td><td>${esc(x.name || "-")}</td><td class="mono">${esc(x.type)}</td><td class="mono">${esc(x.raw)}</td><td class="mono copyable">${esc(formatValue(x.value))}</td></tr>`).join("");
  }
  $("#stUsed").hidden = false;
  $("#stUsed").textContent = `ใช้ ${r.used} / ${bytes.length} bytes`;
  if (r.error) showErr("#stErr", r.error);
  else if (r.leftover.length) {
    $("#stLeft").hidden = false;
    $("#stLeft").textContent = `เหลือข้อมูลที่ยังไม่ได้แยก ${r.leftover.length} ไบต์: ${toHex(r.leftover)}`;
  }
}

$("#stPreset").addEventListener("change", (e) => {
  const p = PRESETS[e.target.value];
  if (!p) return;
  hexIn.value = p.hex;
  specIn.value = p.spec;
  endianSel.value = p.endian;
  run();
  e.target.value = "";
});
for (const el of [hexIn, specIn]) el.addEventListener("input", run);
endianSel.addEventListener("change", run);

// start with an example so the page shows what it does
hexIn.value = PRESETS.sensor.hex;
specIn.value = PRESETS.sensor.spec;
run();
