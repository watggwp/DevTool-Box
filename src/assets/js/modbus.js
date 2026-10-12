import { $, $$, showErr } from "/assets/js/common.js";
import { buildRequest, decodeFrame, pairRegisters, parseHex, parseInt16ish, withCrc, toHex, hex4 } from "/assets/js/modbus-core.js";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ---------------- builder ----------------
const fcSel = $("#mbFc"), qtyWrap = $("#mbQtyWrap"), valWrap = $("#mbValuesWrap"), valIn = $("#mbValues"), valHint = $("#mbValuesHint");

const VALUE_UI = {
  5: { hint: "(1 = ON, 0 = OFF)", placeholder: "1", def: "1" },
  6: { hint: "(ตัวเลข 0-65535 หรือ -32768 ถึง 32767 หรือ 0x hex)", placeholder: "1234", def: "1234" },
  15: { hint: "(สถานะ coil เรียงกัน เช่น 1 0 1 1)", placeholder: "1 0 1 1 0 0 1", def: "1 0 1 1" },
  16: { hint: "(ค่า register คั่นด้วยช่องว่างหรือจุลภาค)", placeholder: "100, 200, 0x0300", def: "100 200 300" },
};

function syncForm() {
  const fc = Number(fcSel.value);
  qtyWrap.hidden = !(fc >= 1 && fc <= 4);
  const ui = VALUE_UI[fc];
  valWrap.hidden = !ui;
  if (ui) {
    valHint.textContent = ui.hint;
    valIn.placeholder = ui.placeholder;
    if (!valIn.value || valIn.dataset.fc !== String(fc)) valIn.value = ui.def;
    valIn.dataset.fc = String(fc);
  }
  build();
}

function readValues(fc) {
  const parts = valIn.value.split(/[\s,;]+/).filter(Boolean);
  if (fc === 5) return parts[0] === "1" || /^on|true|ff00$/i.test(parts[0] ?? "");
  if (fc === 6) { if (!parts.length) throw new Error("ใส่ค่าที่จะเขียน"); return parseInt16ish(parts[0]); }
  if (fc === 15) return parts.map((p) => { if (p !== "0" && p !== "1") throw new Error(`coil ต้องเป็น 0 หรือ 1 ("${p}")`); return Number(p); });
  if (fc === 16) return parts.map(parseInt16ish);
  return undefined;
}

function build() {
  showErr("#mbBuildErr");
  const fc = Number(fcSel.value);
  try {
    const frame = buildRequest({
      slave: Number($("#mbSlave").value),
      fc,
      addr: parseInt16ish($("#mbAddr").value || "0"),
      qty: Number($("#mbQty").value),
      values: readValues(fc),
    });
    $("#mbFrame").textContent = toHex(frame);
    const d = decodeFrame(frame, "request");
    $("#mbBuildTbl").innerHTML = d.fields.map((f) => `<tr><th>${esc(f.name)}</th><td class="mono">${esc(f.raw)}</td><td>${esc(f.desc)}</td></tr>`).join("");
  } catch (e) {
    $("#mbFrame").textContent = "";
    $("#mbBuildTbl").innerHTML = "";
    showErr("#mbBuildErr", e.message);
  }
}

fcSel.addEventListener("change", syncForm);
for (const id of ["#mbSlave", "#mbAddr", "#mbQty", "#mbValues"]) $(id).addEventListener("input", build);
$("#mbToDecoder").addEventListener("click", () => {
  $("#mbIn").value = $("#mbFrame").textContent;
  decode();
  $("#mbIn").scrollIntoView({ block: "center" });
});

// ---------------- decoder ----------------
let lastRegs = null;

function decode() {
  showErr("#mbErr");
  $("#mbWarn").hidden = true;
  $("#mbStatus").innerHTML = "";
  $("#mbFields").innerHTML = "";
  $("#mbRegsCard").hidden = true;
  $("#mbBitsCard").hidden = true;
  lastRegs = null;
  const txt = $("#mbIn").value.trim();
  if (!txt) return;
  let bytes, d;
  try {
    bytes = parseHex(txt);
    d = decodeFrame(bytes, $("#mbKind").value);
  } catch (e) { showErr("#mbErr", e.message); return; }

  const kindTh = { request: "Request", response: "Response", exception: "Exception response" }[d.kind];
  $("#mbStatus").innerHTML =
    `<span class="pill ${d.crcOk ? "good" : "bad"}">CRC ${d.crcOk ? "ถูกต้อง" : "ผิด"}</span>` +
    `<span class="pill">${esc(kindTh)}</span>` +
    `<span class="pill">${bytes.length} bytes</span>` +
    (d.crcOk ? "" : `<button class="btn sm" type="button" id="mbFixCrc">แก้ CRC ให้ถูก</button>`);
  $("#mbFields").innerHTML = `<tr><th>Offset</th><th>Field</th><th>Hex</th><th style="width:auto">ความหมาย</th></tr>` +
    d.fields.map((f) => `<tr><td class="mono">${f.offset}</td><th>${esc(f.name)}</th><td class="mono copyable">${esc(f.raw)}</td><td>${esc(f.desc)}</td></tr>`).join("");
  if (d.exception) d.warnings.unshift(`อุปกรณ์ตอบ error: ${d.exception.text}`);
  if (d.warnings.length) { $("#mbWarn").hidden = false; $("#mbWarn").textContent = d.warnings.join("\n"); }
  const fix = $("#mbFixCrc");
  if (fix) fix.addEventListener("click", () => { $("#mbIn").value = toHex(withCrc(bytes.subarray(0, bytes.length - 2))); decode(); });

  if (d.registers && d.registers.length) { lastRegs = d.registers; renderRegs(); }
  if (d.bits && d.bits.length) {
    $("#mbBitsCard").hidden = false;
    $("#mbBits").innerHTML = d.bits.map((b, i) => `<span class="mb-bit${b ? " on" : ""}">#${i}<b>${b ? "ON" : "OFF"}</b></span>`).join("");
  }
}

function renderRegs() {
  if (!lastRegs) return;
  $("#mbRegsCard").hidden = false;
  $("#mbRegs").innerHTML = `<tr><th>#</th><th>Hex</th><th>uint16</th><th>int16</th></tr>` +
    lastRegs.map((r, i) => `<tr><td class="mono">${i}</td><td class="mono copyable">${hex4(r)}</td><td class="mono copyable">${r}</td><td class="mono copyable">${r > 32767 ? r - 65536 : r}</td></tr>`).join("");
  const pairs = pairRegisters(lastRegs, $("#mbOrder").value);
  $("#mbPairs").innerHTML = pairs.length
    ? `<tr><th>Reg</th><th>float32</th><th>int32</th><th>uint32</th></tr>` +
      pairs.map((p) => `<tr><td class="mono">${p.index}-${p.index + 1}</td><td class="mono copyable">${Number.isFinite(p.f32) ? Number(p.f32.toPrecision(7)) : p.f32}</td><td class="mono copyable">${p.i32}</td><td class="mono copyable">${p.u32}</td></tr>`).join("")
    : `<tr><td class="muted">ต้องมีอย่างน้อย 2 register เพื่อรวมเป็น 32-bit</td></tr>`;
}

$("#mbIn").addEventListener("input", decode);
$("#mbKind").addEventListener("change", decode);
$("#mbOrder").addEventListener("change", renderRegs);

const EXAMPLES = {
  req: () => toHex(buildRequest({ slave: 1, fc: 3, addr: 0, qty: 4 })),
  resp: () => toHex(withCrc(parseHex("01 03 08 41 C8 00 00 00 64 FF 9C"))),
  exc: () => toHex(withCrc(parseHex("01 83 02"))),
};
$$("[data-example]").forEach((b) => b.addEventListener("click", () => { $("#mbIn").value = EXAMPLES[b.dataset.example](); decode(); }));

syncForm();
// start with an example response so the decoder shows what it does
$("#mbIn").value = EXAMPLES.resp();
decode();
