// Serial Monitor using the Web Serial API (Chrome / Edge / Opera, secure context required).
import { $, toast, download, enc, dec, bytesToHex, hexToBytes, fmtBytes } from "/js/common.js";

const term = $("#terminal");
const statusEl = $("#serialStatus");
const statsEl = $("#serialStats");
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

function sys(msg) { appendLine(`${ts()}<span class="sys">${escapeHtml(msg)}</span>`); }

function updateStats() { statsEl.textContent = `RX ${fmtBytes(rxBytes)} / TX ${fmtBytes(txBytes)}`; }

function setConnected(on) {
  connectBtn.disabled = on;
  disconnectBtn.disabled = !on;
  input.disabled = !on;
  sendBtn.disabled = !on;
  statusEl.textContent = on ? "เชื่อมต่อแล้ว" : "ยังไม่ได้เชื่อมต่อ";
  statusEl.classList.toggle("on", on);
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
      sys("read error: " + e.message);
    } finally {
      reader.releaseLock();
      reader = null;
    }
  }
}

async function connect() {
  try {
    port = await navigator.serial.requestPort();
    const opts = {
      baudRate: Number($("#baud").value) || 115200,
      dataBits: Number($("#dataBits").value),
      parity: $("#parity").value,
      stopBits: Number($("#stopBits").value),
      flowControl: $("#flow").value,
    };
    await port.open(opts);
    await port.setSignals({ dataTerminalReady: $("#optDTR").checked, requestToSend: $("#optRTS").checked }).catch(() => {});
    const info = port.getInfo();
    const id = info.usbVendorId ? ` (VID ${info.usbVendorId.toString(16).padStart(4, "0")} PID ${info.usbProductId.toString(16).padStart(4, "0")})` : "";
    sys(`connected @ ${opts.baudRate} ${opts.dataBits}${opts.parity[0].toUpperCase()}${opts.stopBits}${id}`);
    keepReading = true;
    setConnected(true);
    readLoop();
    port.addEventListener("disconnect", () => { sys("device disconnected"); cleanup(); });
  } catch (e) {
    if (e.name !== "NotFoundError") sys("connect failed: " + e.message);
    port = null;
  }
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

async function send(text) {
  if (!port || !port.writable) return;
  let bytes;
  if ($("#sendHex").checked) {
    try { bytes = hexToBytes(text); } catch (e) { sys(e.message); return; }
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
    const shown = $("#sendHex").checked ? bytesToHex(bytes) : text;
    appendLine(`${ts()}<span class="tx">&gt; ${escapeHtml(shown)}</span>`);
  } catch (e) {
    sys("write error: " + e.message);
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

$("#optDTR").addEventListener("change", (e) => port?.setSignals({ dataTerminalReady: e.target.checked }).catch(() => {}));
$("#optRTS").addEventListener("change", (e) => port?.setSignals({ requestToSend: e.target.checked }).catch(() => {}));

$("#serialClear").addEventListener("click", () => { term.innerHTML = ""; rxBytes = txBytes = 0; updateStats(); });
$("#serialSave").addEventListener("click", () => {
  const text = [...term.children].map((l) => l.textContent).join("\n");
  if (!text) { toast("ไม่มีข้อมูล"); return; }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  download(`serial-log-${stamp}.txt`, text, "text/plain");
});

addEventListener("beforeunload", () => { if (port) cleanup(); });
