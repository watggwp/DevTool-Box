import { $, $$, showErr, toast } from "/assets/js/common.js";
import { buildRequest, decodeFrame, pairRegisters, parseHex, parseInt16ish, withCrc, toHex, hex4, crc16, responseComplete, t35ms } from "/assets/js/modbus-core.js";

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

// ---------------- send over Web Serial / RS485 ----------------
const ser = {
  port: null, reader: null, rx: [], waiter: null, busy: false, pollTimer: null,
  stats: { tx: 0, ok: 0, timeout: 0, crc: 0 },
};
const serEl = {
  connect: $("#mbSerConnect"), disconnect: $("#mbSerDisconnect"), send: $("#mbSerSend"), poll: $("#mbSerPoll"),
  status: $("#mbSerStatus"), log: $("#mbSerLog"), stats: $("#mbSerStats"), rtt: $("#mbSerRtt"),
};
const MAX_LOG_LINES = 400;

if (!("serial" in navigator)) {
  $("#mbSerUnsupported").hidden = false;
  serEl.connect.disabled = true;
}

function stamp() {
  const d = new Date();
  return d.toLocaleTimeString("th-TH", { hour12: false }) + "." + String(d.getMilliseconds()).padStart(3, "0");
}
function serLog(kind, text) {
  const line = document.createElement("div");
  const ts = document.createElement("span");
  ts.className = "ts";
  ts.textContent = `[${stamp()}] `;
  const body = document.createElement("span");
  body.className = { tx: "tx", rx: "hx", err: "err", sys: "sys" }[kind] || "";
  body.textContent = text;
  line.append(ts, body);
  serEl.log.append(line);
  while (serEl.log.childElementCount > MAX_LOG_LINES) serEl.log.firstElementChild.remove();
  serEl.log.scrollTop = serEl.log.scrollHeight;
}
function serStats() {
  const s = ser.stats;
  serEl.stats.textContent = `TX ${s.tx} / OK ${s.ok} / timeout ${s.timeout} / CRC ผิด ${s.crc}`;
}
function serState() {
  const on = !!ser.port;
  serEl.connect.disabled = on || !("serial" in navigator);
  serEl.disconnect.disabled = !on;
  serEl.send.disabled = !on || ser.busy;
  serEl.poll.disabled = !on;
  serEl.poll.textContent = ser.pollTimer ? "หยุด polling" : "เริ่ม polling";
  serEl.status.textContent = on ? (ser.pollTimer ? "กำลัง polling" : "เชื่อมต่อแล้ว") : "ยังไม่ได้เชื่อมต่อ";
  serEl.status.classList.toggle("on", on);
  for (const id of ["#mbSerBaud", "#mbSerParity", "#mbSerStop"]) $(id).disabled = on;
}

async function readLoop() {
  while (ser.port && ser.port.readable) {
    ser.reader = ser.port.readable.getReader();
    try {
      for (;;) {
        const { value, done } = await ser.reader.read();
        if (done) break;
        if (!value) continue;
        if (ser.waiter) { for (const b of value) ser.rx.push(b); ser.waiter.onData(); }
        else serLog("rx", "ข้อมูลที่ไม่ได้ร้องขอ: " + toHex(value));
      }
    } catch (e) {
      if (ser.port) serLog("err", "อ่านข้อมูลผิดพลาด: " + e.message);
    } finally {
      try { ser.reader.releaseLock(); } catch {}
      ser.reader = null;
    }
    if (!ser.port) break;
  }
}

async function serConnect() {
  let port;
  try { port = await navigator.serial.requestPort(); } catch { return; }
  const baud = Number($("#mbSerBaud").value);
  try {
    await port.open({ baudRate: baud, dataBits: 8, parity: $("#mbSerParity").value, stopBits: Number($("#mbSerStop").value) });
  } catch (e) {
    serLog("err", "เปิดพอร์ตไม่ได้: " + e.message + " (พอร์ตอาจถูกโปรแกรมอื่นใช้อยู่)");
    return;
  }
  ser.port = port;
  port.addEventListener("disconnect", () => { serLog("err", "อุปกรณ์ถูกถอดออก"); serDisconnect(); });
  serLog("sys", `เชื่อมต่อแล้ว ${baud} 8${$("#mbSerParity").value[0].toUpperCase()}${$("#mbSerStop").value}`);
  serState();
  readLoop();
}

async function serDisconnect() {
  stopPoll();
  const port = ser.port;
  ser.port = null;
  if (ser.waiter) ser.waiter.cancel();
  try { if (ser.reader) await ser.reader.cancel(); } catch {}
  try { if (port) await port.close(); } catch {}
  serState();
}

// One request/response exchange. Resolves with the reply bytes, or null on timeout / broadcast.
async function transact(req) {
  const timeout = Math.max(50, Number($("#mbSerTimeout").value) || 1000);
  const silence = Math.max(20, t35ms(Number($("#mbSerBaud").value)) * 4); // allow for USB adapter latency
  ser.rx = [];
  const writer = ser.port.writable.getWriter();
  const t0 = performance.now();
  try { await writer.write(req); } finally { writer.releaseLock(); }
  ser.stats.tx++;
  serLog("tx", "TX " + toHex(req));
  if (req[0] === 0) { serLog("sys", "slave 0 คือ broadcast อุปกรณ์จะไม่ตอบกลับ"); serStats(); return null; }

  const result = await new Promise((resolve) => {
    let idle = null;
    const finish = (val) => { clearTimeout(hard); clearTimeout(idle); ser.waiter = null; resolve(val); };
    const hard = setTimeout(() => finish(ser.rx.length ? "partial" : null), timeout);
    ser.waiter = {
      cancel: () => finish(null),
      onData: () => {
        if (responseComplete(req, ser.rx)) return finish("ok");
        clearTimeout(idle); // otherwise the frame ends after a period of silence
        idle = setTimeout(() => finish("partial"), silence);
      },
    };
  });
  const rtt = performance.now() - t0;
  const bytes = Uint8Array.from(ser.rx);
  if (!result) { ser.stats.timeout++; serLog("err", `ไม่มีการตอบกลับภายใน ${timeout} ms`); serStats(); return null; }
  serEl.rtt.textContent = `${rtt.toFixed(0)} ms`;
  const crcOk = bytes.length >= 4 && crc16(bytes.subarray(0, bytes.length - 2)) === (bytes[bytes.length - 2] | (bytes[bytes.length - 1] << 8));
  if (crcOk) ser.stats.ok++; else ser.stats.crc++;
  let note = "";
  if (!crcOk) note = result === "partial" ? "  (ได้รับไม่ครบ หรือ CRC ไม่ถูกต้อง)" : "  (CRC ไม่ถูกต้อง)";
  if (bytes[0] !== req[0]) note += `  (ตอบจาก slave ${bytes[0]} ไม่ตรงกับที่ถาม)`;
  if (bytes[1] === (req[1] | 0x80)) note += "  (exception)";
  serLog(crcOk ? "rx" : "err", `RX ${toHex(bytes)}${note}`);
  serStats();
  return bytes;
}

async function sendCurrent() {
  if (!ser.port || ser.busy) return;
  let req;
  try { req = parseHex($("#mbFrame").textContent); } catch { req = new Uint8Array(); }
  if (req.length < 4) { toast("ยังไม่มีคำสั่งที่ถูกต้องในส่วนสร้างคำสั่ง"); stopPoll(); return; }
  ser.busy = true; serState();
  try {
    const resp = await transact(req);
    if (resp && resp.length && $("#mbSerAutoDecode").checked) {
      $("#mbIn").value = toHex(resp);
      $("#mbKind").value = "response";
      decode();
    }
  } catch (e) {
    serLog("err", "ส่งไม่สำเร็จ: " + e.message);
  } finally {
    ser.busy = false; serState();
  }
}

function stopPoll() { clearTimeout(ser.pollTimer); ser.pollTimer = null; serState(); }
function startPoll() {
  const every = Math.max(100, Number($("#mbSerInterval").value) || 1000);
  const tick = async () => {
    if (!ser.pollTimer) return;
    if (!document.hidden) await sendCurrent();
    if (ser.pollTimer) ser.pollTimer = setTimeout(tick, every);
  };
  ser.pollTimer = setTimeout(tick, 0);
  serState();
}

serEl.connect.addEventListener("click", serConnect);
serEl.disconnect.addEventListener("click", async () => { await serDisconnect(); serLog("sys", "ตัดการเชื่อมต่อแล้ว"); });
serEl.send.addEventListener("click", sendCurrent);
serEl.poll.addEventListener("click", () => (ser.pollTimer ? stopPoll() : startPoll()));
$("#mbSerClear").addEventListener("click", () => {
  serEl.log.textContent = "";
  ser.stats = { tx: 0, ok: 0, timeout: 0, crc: 0 };
  serStats();
  serEl.rtt.textContent = "";
});
addEventListener("beforeunload", () => { if (ser.port) serDisconnect(); });
serState();
