// Serial Monitor using the Web Serial API (Chrome / Edge / Opera, secure context required).
import { $, $$, toast, download, enc, dec, bytesToHex, hexToBytes, fmtBytes } from "/js/common.js";

const term = $("#terminal");
const statusEl = $("#serialStatus");
const statsEl = $("#serialStats");
const portInfoEl = $("#serialPortInfo");
const connectBtn = $("#serialConnect");
const disconnectBtn = $("#serialDisconnect");
const input = $("#serialInput");
const sendBtn = $("#serialSendBtn");

let port = null, reader = null, writer = null, keepReading = false;
let rxBytes = 0, txBytes = 0;
let lineBuf = "";
const history = [];
let histIdx = -1;
const MAX_LINES = 5000;

// Known USB vendor IDs for USB-to-serial bridges (used only for a friendly label).
const VENDORS = { 0x10c4: "Silicon Labs CP210x", 0x1a86: "WCH CH34x", 0x0403: "FTDI", 0x2341: "Arduino", 0x303a: "Espressif", 0x2e8a: "Raspberry Pi", 0x0483: "STMicro" };

if (!("serial" in navigator)) {
  $("#serialUnsupported").hidden = false;
  connectBtn.disabled = true;
}

function ts() {
  if (!$("#optTimestamp").checked) return "";
  const d = new Date();
  return `<span class="ts">[${d.toLocaleTimeString("th-TH", { hour12: false })}.${String(d.getMilliseconds()).padStart(3, "0")}]</span> `;
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function appendLine(html) {
  const line = document.createElement("div");
  line.innerHTML = html;
  term.appendChild(line);
  while (term.childElementCount > MAX_LINES) term.firstElementChild.remove();
  if ($("#optAutoscroll").checked) term.scrollTop = term.scrollHeight;
}

function sys(msg, cls = "sys") { appendLine(`${ts()}<span class="${cls}">${escapeHtml(msg)}</span>`); }

function updateStats() { statsEl.textContent = `RX ${fmtBytes(rxBytes)} / TX ${fmtBytes(txBytes)}`; }

function setConnected(on, label = "") {
  connectBtn.disabled = on;
  disconnectBtn.disabled = !on;
  input.disabled = !on;
  sendBtn.disabled = !on;
  statusEl.textContent = on ? "เชื่อมต่อแล้ว" : "ยังไม่ได้เชื่อมต่อ";
  statusEl.classList.toggle("on", on);
  portInfoEl.hidden = !on;
  portInfoEl.textContent = label;
  $("#termTitle").textContent = on ? label : "serial monitor";
  if (on) input.focus();
}

function renderChunk(bytes) {
  rxBytes += bytes.length;
  updateStats();
  const view = $("#optView").value;
  if (view === "hex" || view === "both") {
    const hex = bytesToHex(bytes);
    const txt = view === "both" ? " " + escapeHtml(dec.decode(bytes).replace(/[\x00-\x1f]/g, ".")) : "";
    appendLine(`${ts()}<span class="hx">${hex}</span>${txt}`);
    return;
  }
  // text mode: split into lines so timestamps align with device output
  lineBuf += dec.decode(bytes, { stream: true });
  let idx;
  while ((idx = lineBuf.search(/\r\n|\n|\r/)) !== -1) {
    const line = lineBuf.slice(0, idx);
    lineBuf = lineBuf.slice(idx + (lineBuf.startsWith("\r\n", idx) ? 2 : 1));
    appendLine(`${ts()}${escapeHtml(line)}`);
  }
  // flush partial line without newline after a short idle so prompts (e.g. ">") still show
  clearTimeout(renderChunk.flush);
  if (lineBuf) renderChunk.flush = setTimeout(() => { appendLine(`${ts()}${escapeHtml(lineBuf)}`); lineBuf = ""; }, 150);
}

async function readLoop() {
  while (port && port.readable && keepReading) {
    reader = port.readable.getReader();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) renderChunk(value);
      }
    } catch (e) {
      sys("read error: " + e.message, "err");
    } finally {
      reader.releaseLock();
      reader = null;
    }
  }
}

function describePort(p) {
  const info = p.getInfo();
  if (!info.usbVendorId) return "serial port";
  const vid = info.usbVendorId.toString(16).padStart(4, "0").toUpperCase();
  const pid = (info.usbProductId ?? 0).toString(16).padStart(4, "0").toUpperCase();
  const name = VENDORS[info.usbVendorId];
  return `${name ? name + " " : ""}VID:${vid} PID:${pid}`;
}

async function connect() {
  $("#serialNoPort").hidden = true;
  let chosen;
  try {
    chosen = await navigator.serial.requestPort();
  } catch (e) {
    // NotFoundError = user closed the picker (often because no port was listed) -> show driver help
    $("#serialNoPort").hidden = false;
    $("#serialHelp").open = true;
    return;
  }
  const opts = {
    baudRate: Number($("#baud").value) || 115200,
    dataBits: Number($("#dataBits").value),
    parity: $("#parity").value,
    stopBits: Number($("#stopBits").value),
    flowControl: $("#flow").value,
  };
  try {
    port = chosen;
    await port.open(opts);
  } catch (e) {
    port = null;
    sys(`เปิดพอร์ตไม่ได้: ${e.message}`, "err");
    sys("พอร์ตอาจถูกโปรแกรมอื่นใช้อยู่ (Arduino IDE, PuTTY) หรือ baud rate ไม่รองรับ ดูแผงช่วยเหลือด้านล่าง", "sys");
    $("#serialHelp").open = true;
    return;
  }
  await port.setSignals({ dataTerminalReady: $("#optDTR").checked, requestToSend: $("#optRTS").checked }).catch(() => {});
  const label = describePort(port);
  sys(`connected ${label} @ ${opts.baudRate} ${opts.dataBits}${opts.parity[0].toUpperCase()}${opts.stopBits}`);
  keepReading = true;
  setConnected(true, `${label} @ ${opts.baudRate}`);
  readLoop();
  port.addEventListener("disconnect", () => { sys("อุปกรณ์ถูกถอดออก", "err"); cleanup(); });
}

async function cleanup() {
  keepReading = false;
  try { if (reader) await reader.cancel(); } catch {}
  try { if (writer) { writer.releaseLock(); writer = null; } } catch {}
  try { if (port) await port.close(); } catch {}
  port = null;
  setConnected(false);
}

async function disconnect() {
  await cleanup();
  sys("disconnected");
}

async function send(text, forceHex = null) {
  if (!port || !port.writable) { toast("ยังไม่ได้เชื่อมต่อ"); return; }
  const asHex = forceHex ?? $("#sendHex").checked;
  let bytes;
  if (asHex) {
    try { bytes = hexToBytes(text); } catch (e) { sys(e.message, "err"); return; }
  } else {
    const le = { lf: "\n", cr: "\r", crlf: "\r\n", "": "" }[$("#lineEnding").value];
    bytes = enc.encode(text + le);
  }
  try {
    writer = port.writable.getWriter();
    await writer.write(bytes);
    writer.releaseLock();
    writer = null;
    txBytes += bytes.length;
    updateStats();
    const shown = asHex ? bytesToHex(bytes) : text;
    appendLine(`${ts()}<span class="tx">&gt; ${escapeHtml(shown)}</span>`);
  } catch (e) {
    sys("write error: " + e.message, "err");
  }
}

connectBtn.addEventListener("click", connect);
disconnectBtn.addEventListener("click", disconnect);

$("#serialSendForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value;
  if (!text && $("#sendHex").checked) return;
  send(text);
  if (text) { history.unshift(text); if (history.length > 50) history.pop(); }
  histIdx = -1;
  input.value = "";
});

input.addEventListener("keydown", (e) => {
  if (e.key === "ArrowUp") { e.preventDefault(); if (histIdx < history.length - 1) { histIdx++; input.value = history[histIdx]; } }
  else if (e.key === "ArrowDown") { e.preventDefault(); if (histIdx > 0) { histIdx--; input.value = history[histIdx]; } else { histIdx = -1; input.value = ""; } }
});

// quick-send buttons
$$("#quickSend [data-send]").forEach((b) => {
  b.addEventListener("click", () => {
    if (b.dataset.hex) send(b.dataset.hex, true); else send(b.dataset.send, false);
  });
});

$("#optDTR").addEventListener("change", (e) => port?.setSignals({ dataTerminalReady: e.target.checked }).catch(() => {}));
$("#optRTS").addEventListener("change", (e) => port?.setSignals({ requestToSend: e.target.checked }).catch(() => {}));

function clearTerm() { term.innerHTML = ""; rxBytes = txBytes = 0; updateStats(); }
$("#serialClear").addEventListener("click", clearTerm);
$("#serialSave").addEventListener("click", () => {
  const text = [...term.children].map((l) => l.textContent).join("\n");
  if (!text) { toast("ไม่มีข้อมูล"); return; }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  download(`serial-log-${stamp}.txt`, text, "text/plain");
  toast("บันทึก log แล้ว");
});
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key.toLowerCase() === "l") { e.preventDefault(); clearTerm(); }
});

// Reconnect hint: ports the user already granted show up here without a picker
if ("serial" in navigator) {
  navigator.serial.getPorts().then((ports) => {
    if (ports.length) sys(`พบพอร์ตที่เคยอนุญาตแล้ว ${ports.length} พอร์ต กด "เชื่อมต่อ" เพื่อเลือก`);
  }).catch(() => {});
}

addEventListener("beforeunload", () => { if (port) cleanup(); });
