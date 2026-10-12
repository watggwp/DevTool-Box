// Serial Plotter: Web Serial -> ring buffer -> canvas, redrawn at most once per frame and only when dirty.
import { $, toast, download } from "/assets/js/common.js";
import { parseLine, toCsv, niceStep } from "/assets/js/plotter-core.js";

const CAP = 2000;          // samples kept per series (max window)
const MAX_SERIES = 8;
const COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#a855f7", "#06b6d4", "#ec4899", "#84cc16"];

const canvas = $("#plCanvas");
const ctx = canvas.getContext("2d");
const legendEl = $("#plLegend");

// ---------- data ----------
let series = [];           // { name, color, visible, buf: Float32Array(CAP) }
let headerNames = [];      // names from a header-only line, for unlabelled values
let pos = 0;               // next write index in ring
let total = 0;             // samples received since clear
let dirty = true, paused = false, frameQueued = false, warnedMax = false;

function getSeries(name) {
  let s = series.find((x) => x.name === name);
  if (s) return s;
  if (series.length >= MAX_SERIES) {
    if (!warnedMax) { toast(`รองรับสูงสุด ${MAX_SERIES} เส้น`); warnedMax = true; }
    return null;
  }
  s = { name, color: COLORS[series.length], visible: true, buf: new Float32Array(CAP).fill(NaN) };
  series.push(s);
  buildLegend();
  return s;
}

function addLine(line) {
  const p = parseLine(line);
  if (!p) return;
  if (p.header) { headerNames = p.header; return; }
  let unnamed = 0;
  const seen = new Set();
  for (const { label, value } of p.values) {
    const name = label ?? headerNames[unnamed] ?? `ค่า ${unnamed + 1}`;
    if (label === null) unnamed++;
    const s = getSeries(name);
    if (!s) continue;
    s.buf[pos] = value;
    seen.add(s);
  }
  for (const s of series) if (!seen.has(s)) s.buf[pos] = NaN;
  pos = (pos + 1) % CAP;
  total++;
  lastLine = line;
  requestDraw();
}

// value at logical index i (0 = oldest of the last n samples)
function windowInfo() {
  const n = Math.min(total, CAP, Number($("#plWindow").value));
  const start = (pos - n + CAP * 2) % CAP;
  return { n, start };
}

// ---------- drawing ----------
// Theme tokens use light-dark(), so read them through a probe element to get resolved rgb() values.
let colors = {};
const probe = document.createElement("span");
probe.hidden = true;
document.body.append(probe);
function resolveVar(name, fallback) {
  probe.style.color = `var(${name}, ${fallback})`;
  return getComputedStyle(probe).color || fallback;
}
function readColors() {
  colors = {
    bg: resolveVar("--surface-2", "#f3f4f6"),
    grid: resolveVar("--border", "#e5e7eb"),
    text: resolveVar("--muted", "#6b7280"),
    zero: resolveVar("--border-strong", "#cbd1d9"),
  };
}

let cssW = 0, cssH = 0;
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const r = canvas.getBoundingClientRect();
  cssW = Math.max(200, Math.floor(r.width));
  cssH = Math.max(160, Math.floor(r.height));
  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  dirty = true;
  requestDraw();
}

function requestDraw() {
  dirty = true;
  if (frameQueued || paused || document.hidden) return;
  frameQueued = true;
  requestAnimationFrame(draw);
}

let lastLine = "", lastStatsAt = 0, trailTimer = 0;

function draw(now) {
  frameQueued = false;
  if (!dirty || paused || document.hidden) return;
  dirty = false;
  const { n, start } = windowInfo();
  const W = cssW, H = cssH;
  const padL = 56, padR = 12, padT = 12, padB = 26;
  const pw = W - padL - padR, ph = H - padT - padB;

  // y range
  let lo = Infinity, hi = -Infinity;
  const stats = series.map(() => ({ min: Infinity, max: -Infinity, sum: 0, cnt: 0, last: NaN }));
  series.forEach((s, k) => {
    const st = stats[k];
    for (let i = 0; i < n; i++) {
      const v = s.buf[(start + i) % CAP];
      if (Number.isNaN(v)) continue;
      st.cnt++; st.sum += v; st.last = v;
      if (v < st.min) st.min = v;
      if (v > st.max) st.max = v;
    }
    if (s.visible && st.cnt) { lo = Math.min(lo, st.min); hi = Math.max(hi, st.max); }
  });
  if ($("#plScale").value === "fixed") {
    lo = Number($("#plMin").value); hi = Number($("#plMax").value);
    if (!(hi > lo)) hi = lo + 1;
  } else if (!Number.isFinite(lo)) { lo = 0; hi = 1; }
  else if (lo === hi) { lo -= 1; hi += 1; }
  else { const m = (hi - lo) * 0.06; lo -= m; hi += m; }
  const yOf = (v) => padT + ph - ((v - lo) / (hi - lo)) * ph;

  // background + grid
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.font = "11px ui-monospace, Consolas, monospace";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 1;
  const step = niceStep(hi - lo, Math.max(3, Math.floor(ph / 50)));
  const decimals = Math.max(0, -Math.floor(Math.log10(step)));
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) {
    const y = Math.round(yOf(v)) + 0.5;
    ctx.strokeStyle = Math.abs(v) < step / 1e6 ? colors.zero : colors.grid;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
    ctx.fillStyle = colors.text;
    ctx.fillText(v.toFixed(Math.min(decimals, 6)), padL - 6, y);
  }
  // x labels: sample numbers
  const winSize = Number($("#plWindow").value);
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const firstSample = total - n;
  const xStep = niceStep(winSize, Math.max(2, Math.floor(pw / 90)));
  const xOfIdx = (i) => padL + (winSize <= 1 ? 0 : (i / (winSize - 1)) * pw);
  for (let sNum = Math.ceil(firstSample / xStep) * xStep; sNum < firstSample + n; sNum += xStep) {
    const x = xOfIdx(sNum - firstSample);
    ctx.fillStyle = colors.text;
    ctx.fillText(String(sNum), x, padT + ph + 6);
  }

  // lines
  ctx.save();
  ctx.beginPath(); ctx.rect(padL, padT, pw, ph); ctx.clip();
  ctx.lineWidth = $("#plSmooth").checked ? 2.5 : 1.5;
  ctx.lineJoin = "round";
  for (const s of series) {
    if (!s.visible) continue;
    ctx.strokeStyle = s.color;
    ctx.beginPath();
    let pen = false;
    // draw at most ~2 points per pixel to stay cheap on big windows
    const stride = Math.max(1, Math.floor(n / (pw * 2)));
    for (let i = 0; i < n; i += stride) {
      const v = s.buf[(start + i) % CAP];
      if (Number.isNaN(v)) { pen = false; continue; }
      const x = xOfIdx(i), y = yOf(v);
      if (pen) ctx.lineTo(x, y); else { ctx.moveTo(x, y); pen = true; }
    }
    ctx.stroke();
  }
  ctx.restore();

  if (!n) {
    ctx.fillStyle = colors.text;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "14px system-ui, sans-serif";
    ctx.fillText("ยังไม่มีข้อมูล กดเชื่อมต่อ หรือกดลองด้วยข้อมูลตัวอย่าง", padL + pw / 2, padT + ph / 2);
  }

  // legend text is updated a few times per second only
  clearTimeout(trailTimer);
  if (!now || now - lastStatsAt > 250) {
    lastStatsAt = now || 0;
    updateLegend(stats);
    $("#plLast").textContent = lastLine || "-";
    $("#plCount").textContent = `${total.toLocaleString()} จุด`;
  } else {
    // make sure the legend catches up after the last burst of data
    trailTimer = setTimeout(() => { lastStatsAt = 0; requestDraw(); }, 300);
  }
}

const fmt = (v) => (Number.isFinite(v) ? (Math.abs(v) >= 1e5 || (Math.abs(v) < 1e-3 && v !== 0) ? v.toExponential(2) : Number(v.toFixed(3)).toString()) : "-");

function buildLegend() {
  legendEl.textContent = "";
  for (const s of series) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "pl-item" + (s.visible ? "" : " off");
    b.title = "คลิกเพื่อซ่อน / แสดงเส้นนี้";
    const sw = document.createElement("span"); sw.className = "pl-swatch"; sw.style.background = s.color;
    const nm = document.createElement("span"); nm.className = "pl-name"; nm.textContent = s.name;
    const val = document.createElement("span"); val.className = "pl-val"; val.textContent = "-";
    const st = document.createElement("span"); st.className = "pl-stats";
    b.append(sw, nm, val, st);
    b.addEventListener("click", () => { s.visible = !s.visible; b.classList.toggle("off", !s.visible); requestDraw(); });
    s.el = { val, st };
    legendEl.append(b);
  }
}

function updateLegend(stats) {
  series.forEach((s, k) => {
    const st = stats[k];
    if (!s.el) return;
    s.el.val.textContent = fmt(st.last);
    s.el.st.textContent = st.cnt ? `min ${fmt(st.min)} max ${fmt(st.max)} avg ${fmt(st.sum / st.cnt)}` : "";
  });
}

function clearAll() {
  series = []; headerNames = []; pos = 0; total = 0; lastLine = ""; warnedMax = false;
  buildLegend();
  requestDraw();
}

// ---------- serial ----------
let port = null, reader = null, keepReading = false;
const statusEl = $("#plStatus");

function setConnected(on) {
  $("#plConnect").disabled = on || !("serial" in navigator);
  $("#plDisconnect").disabled = !on;
  statusEl.textContent = on ? "เชื่อมต่อแล้ว" : "ยังไม่ได้เชื่อมต่อ";
  statusEl.classList.toggle("on", on);
}

async function connect() {
  stopDemo();
  let chosen;
  try { chosen = await navigator.serial.requestPort(); } catch { return; }
  try {
    await chosen.open({ baudRate: Number($("#plBaud").value) || 115200 });
  } catch (e) {
    toast("เปิดพอร์ตไม่ได้: " + e.message);
    return;
  }
  port = chosen;
  keepReading = true;
  setConnected(true);
  port.addEventListener("disconnect", () => { toast("อุปกรณ์ถูกถอดออก"); cleanup(); });
  readLoop();
}

async function readLoop() {
  const decoder = new TextDecoder();
  let buf = "";
  while (port && port.readable && keepReading) {
    reader = port.readable.getReader();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.search(/\r\n|\n|\r/)) !== -1) {
          addLine(buf.slice(0, idx));
          buf = buf.slice(idx + (buf.startsWith("\r\n", idx) ? 2 : 1));
        }
        if (buf.length > 4096) buf = ""; // guard against binary garbage without newlines
      }
    } catch (e) {
      toast("อ่านข้อมูลผิดพลาด: " + e.message);
    } finally {
      reader.releaseLock();
      reader = null;
    }
  }
}

async function cleanup() {
  keepReading = false;
  try { if (reader) await reader.cancel(); } catch {}
  try { if (port) await port.close(); } catch {}
  port = null;
  setConnected(false);
}

// ---------- demo data ----------
let demoTimer = null, demoT = 0;
function startDemo() {
  if (port) return;
  $("#plDemo").textContent = "หยุดข้อมูลตัวอย่าง";
  statusEl.textContent = "โหมดข้อมูลตัวอย่าง";
  demoTimer = setInterval(() => {
    for (let k = 0; k < 2; k++) {
      demoT += 0.05;
      const sine = Math.sin(demoT) * 50 + 50;
      const noisy = Math.cos(demoT * 0.7) * 30 + 40 + (Math.random() - 0.5) * 8;
      const square = Math.sin(demoT * 0.25) > 0 ? 90 : 10;
      addLine(`sine:${sine.toFixed(2)},noisy:${noisy.toFixed(2)},square:${square}`);
    }
  }, 20);
}
function stopDemo() {
  if (!demoTimer) return;
  clearInterval(demoTimer);
  demoTimer = null;
  $("#plDemo").textContent = "ลองด้วยข้อมูลตัวอย่าง";
  if (!port) statusEl.textContent = "ยังไม่ได้เชื่อมต่อ";
}

// ---------- controls ----------
if (!("serial" in navigator)) $("#plUnsupported").hidden = false;
setConnected(false);
$("#plConnect").addEventListener("click", connect);
$("#plDisconnect").addEventListener("click", cleanup);
$("#plDemo").addEventListener("click", () => (demoTimer ? stopDemo() : startDemo()));
$("#plPause").addEventListener("click", (e) => {
  paused = !paused;
  e.target.textContent = paused ? "แสดงต่อ" : "หยุดภาพ";
  e.target.classList.toggle("primary", paused);
  if (!paused) requestDraw();
});
$("#plClear").addEventListener("click", clearAll);
$("#plScale").addEventListener("change", (e) => { $("#plFixedWrap").hidden = e.target.value !== "fixed"; requestDraw(); });
for (const id of ["#plWindow", "#plMin", "#plMax", "#plSmooth"]) $(id).addEventListener("input", requestDraw);

$("#plCsv").addEventListener("click", () => {
  const n = Math.min(total, CAP);
  if (!n || !series.length) { toast("ยังไม่มีข้อมูล"); return; }
  const start = (pos - n + CAP * 2) % CAP;
  const cols = series.map((s) => Array.from({ length: n }, (_, i) => s.buf[(start + i) % CAP]));
  download(`plot-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`, toCsv(series.map((s) => s.name), cols, n), "text/csv");
});
$("#plPng").addEventListener("click", () => {
  const wasPaused = paused;
  paused = false; dirty = true; draw(0); paused = wasPaused;
  canvas.toBlob((blob) => blob && download(`plot-${new Date().toISOString().replace(/[:.]/g, "-")}.png`, blob));
});

document.addEventListener("visibilitychange", () => { if (!document.hidden) requestDraw(); });
// theme can change via the toggle button or the OS
const mq = matchMedia("(prefers-color-scheme: dark)");
mq.addEventListener("change", () => { readColors(); requestDraw(); });
$("#themeToggle")?.addEventListener("click", () => setTimeout(() => { readColors(); requestDraw(); }, 0));
new ResizeObserver(resize).observe(canvas);
addEventListener("beforeunload", () => { if (port) cleanup(); });

readColors();
resize();

// /plotter/?demo opens straight into demo mode (handy for trying the page or sharing a link)
if (new URLSearchParams(location.search).has("demo")) startDemo();
