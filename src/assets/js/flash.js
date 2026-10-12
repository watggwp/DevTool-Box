// Firmware Flasher: ESP32 / ESP8266 via Espressif's esptool-js (Apache-2.0, vendored, lazy-loaded),
// plus a 1200-baud "touch" to drop UF2 boards (Pico, Leonardo) into their bootloader.
import { $, $$, toast, bytesToHex, fmtBytes } from "/assets/js/common.js";

const LIB_URL = "/assets/vendor/esptool-js-0.6.1.js";
const hex = (n) => "0x" + n.toString(16).toUpperCase();

// ---------- elements ----------
const els = {
  connect: $("#flashConnect"), disconnect: $("#flashDisconnect"), program: $("#flashProgram"),
  erase: $("#flashErase"), reset: $("#flashReset"), status: $("#flashStatus"),
  chip: $("#flashChip"), mac: $("#flashMac"), size: $("#flashSizePill"), log: $("#flashLog"),
  files: $("#flashFiles"), preset: $("#flashPreset"), hint: $("#flashOffsetHint"),
  progress: $("#flashProgress"), bar: $("#flashBar"), pct: $("#flashPct"),
};

let lib = null, transport = null, loader = null, busy = false;
let bootOffset = 0x1000; // ESP32 default until a chip is detected
let rows = [];            // { id, label, addr (string), file, data }
let rowSeq = 0;

if (!("serial" in navigator)) {
  $("#flashUnsupported").hidden = false;
  els.connect.disabled = true;
  $("#uf2Touch").disabled = true;
}

// ---------- log ----------
const MAX_LOG = 200_000;
function log(text, newline = true) {
  els.log.append(text + (newline ? "\n" : ""));
  if (els.log.textContent.length > MAX_LOG) els.log.textContent = els.log.textContent.slice(-MAX_LOG / 2);
  els.log.scrollTop = els.log.scrollHeight;
}
const terminal = { clean: () => { els.log.textContent = ""; }, writeLine: (d) => log(d), write: (d) => log(d, false) };
$("#flashLogClear").addEventListener("click", () => { els.log.textContent = ""; });

// ---------- MD5 (used by esptool-js to verify what was written) ----------
const MD5_K = Uint32Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32));
const MD5_S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
function md5(bytes) {
  const len = bytes.length, padLen = (((len + 8) >> 6) + 1) << 6;
  const buf = new Uint8Array(padLen);
  buf.set(bytes); buf[len] = 0x80;
  const dv = new DataView(buf.buffer);
  dv.setUint32(padLen - 8, (len * 8) >>> 0, true);
  dv.setUint32(padLen - 4, Math.floor((len * 8) / 2 ** 32), true);
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  const M = new Uint32Array(16);
  for (let off = 0; off < padLen; off += 64) {
    for (let i = 0; i < 16; i++) M[i] = dv.getUint32(off + i * 4, true);
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F, g;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * i) % 16; }
      F = (F + A + MD5_K[i] + M[g]) >>> 0;
      A = D; D = C; C = B;
      const s = MD5_S[(i >> 4) * 4 + (i % 4)];
      B = (B + ((F << s) | (F >>> (32 - s)))) >>> 0;
    }
    a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
  }
  const out = new Uint8Array(16), ov = new DataView(out.buffer);
  ov.setUint32(0, a0, true); ov.setUint32(4, b0, true); ov.setUint32(8, c0, true); ov.setUint32(12, d0, true);
  return bytesToHex(out, "", false);
}

// ---------- file rows ----------
const PRESETS = {
  app: () => [{ label: "app", addr: 0x10000 }],
  merged: () => [{ label: "merged", addr: 0x0 }],
  arduino: () => [
    { label: "bootloader", addr: bootOffset },
    { label: "partitions", addr: 0x8000 },
    { label: "boot_app0", addr: 0xe000 },
    { label: "app", addr: 0x10000 },
  ],
  esp8266: () => [{ label: "app", addr: 0x0 }],
  custom: () => [{ label: "", addr: 0x10000 }],
};

function applyPreset(name) {
  rows = PRESETS[name]().map((r) => ({ id: ++rowSeq, label: r.label, addr: hex(r.addr), file: null, data: null }));
  renderRows();
}

function parseAddr(s) {
  const t = String(s).trim();
  if (!/^(0x)?[0-9a-f]+$/i.test(t)) return NaN;
  return parseInt(t.replace(/^0x/i, ""), 16);
}

function rowWarning(r) {
  if (!r.data) return "";
  const a = parseAddr(r.addr);
  const isImageSlot = a === 0 || a === bootOffset || a === 0x10000;
  if (isImageSlot && r.data[0] !== 0xe9) return `ไฟล์นี้ไม่ได้ขึ้นต้นด้วย 0xE9 (magic byte ของ ESP image) ตรวจสอบว่าเลือกไฟล์และ address ถูกต้อง`;
  if (a === 0x8000 && !(r.data[0] === 0xaa && r.data[1] === 0x50)) return "ไฟล์นี้ไม่เหมือนตาราง partition (ปกติขึ้นต้นด้วย AA 50)";
  return "";
}

function renderRows() {
  els.files.textContent = "";
  for (const r of rows) {
    const row = document.createElement("div");
    row.className = "flash-row";
    row.dataset.id = r.id;

    const addr = document.createElement("input");
    addr.className = "addr";
    addr.value = r.addr;
    addr.spellcheck = false;
    addr.setAttribute("aria-label", "Flash address");
    addr.title = "ตำแหน่งใน flash (hex) เช่น 0x10000";
    addr.addEventListener("input", () => { r.addr = addr.value; updateState(); });

    const name = document.createElement("span");
    name.className = "fname" + (r.file ? "" : " no-file");
    if (r.file) {
      name.textContent = r.file.name;
      const sz = document.createElement("small");
      sz.textContent = fmtBytes(r.file.size);
      name.append(sz);
      const w = rowWarning(r);
      if (w) { const wEl = document.createElement("span"); wEl.className = "warn"; wEl.textContent = w; name.append(wEl); }
    } else {
      name.textContent = r.label ? `ยังไม่ได้เลือกไฟล์ ${r.label}.bin (ลากไฟล์มาวางได้)` : "ยังไม่ได้เลือกไฟล์ (ลากไฟล์มาวางได้)";
    }

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".bin,application/octet-stream";
    fileInput.className = "file-input";
    fileInput.addEventListener("change", () => { if (fileInput.files[0]) loadFile(r, fileInput.files[0]); });
    const pick = document.createElement("button");
    pick.type = "button";
    pick.className = "btn sm";
    pick.textContent = r.file ? "เปลี่ยนไฟล์" : "เลือกไฟล์";
    pick.addEventListener("click", () => fileInput.click());

    const del = document.createElement("button");
    del.type = "button";
    del.className = "btn ghost sm";
    del.textContent = "ลบ";
    del.title = "เอาแถวนี้ออก";
    del.disabled = rows.length === 1;
    del.addEventListener("click", () => { rows = rows.filter((x) => x !== r); renderRows(); });

    row.addEventListener("dragover", (e) => { e.preventDefault(); row.classList.add("dragover"); });
    row.addEventListener("dragleave", () => row.classList.remove("dragover"));
    row.addEventListener("drop", (e) => {
      e.preventDefault();
      row.classList.remove("dragover");
      const f = e.dataTransfer.files[0];
      if (f) loadFile(r, f);
    });

    row.append(addr, name, pick, del, fileInput);
    els.files.append(row);
  }
  updateState();
}

async function loadFile(r, file) {
  if (file.size > 32 * 1024 * 1024) { toast("ไฟล์ใหญ่เกิน 32 MB"); return; }
  r.file = file;
  r.data = new Uint8Array(await file.arrayBuffer());
  // guess address from common file names when the user picked a custom row
  const n = file.name.toLowerCase();
  if (els.preset.value === "custom" || els.preset.value === "arduino") {
    if (n.includes("bootloader")) r.addr = hex(bootOffset);
    else if (n.includes("partition")) r.addr = "0x8000";
    else if (n.includes("boot_app0")) r.addr = "0xE000";
    else if (n.includes("merged") || n.includes("factory")) r.addr = "0x0";
  }
  renderRows();
}

$("#flashAddRow").addEventListener("click", () => {
  rows.push({ id: ++rowSeq, label: "", addr: "0x10000", file: null, data: null });
  els.preset.value = "custom";
  renderRows();
});
els.preset.addEventListener("change", () => applyPreset(els.preset.value));

// Validation: all files chosen, addresses valid, 4 KB aligned, no overlap.
function validate() {
  if (!rows.length) return "ยังไม่มีไฟล์";
  const ranges = [];
  for (const r of rows) {
    if (!r.data) return "ยังเลือกไฟล์ไม่ครบทุกแถว";
    const a = parseAddr(r.addr);
    if (Number.isNaN(a)) return `address "${r.addr}" ไม่ใช่เลขฐาน 16`;
    if (a % 0x1000) return `address ${hex(a)} ต้องหารด้วย 0x1000 (4 KB) ลงตัว`;
    ranges.push([a, a + r.data.length, r.file.name]);
  }
  ranges.sort((x, y) => x[0] - y[0]);
  for (let i = 1; i < ranges.length; i++) {
    if (ranges[i][0] < ranges[i - 1][1]) return `ไฟล์ ${ranges[i - 1][2]} ทับกับ ${ranges[i][2]} ตรวจสอบ address`;
  }
  return "";
}

// ---------- UI state ----------
function setSteps() {
  const connected = !!loader;
  const ready = connected && !validate();
  const steps = $$(".fs-step");
  steps.forEach((s) => s.classList.remove("active", "done"));
  if (!connected) steps[0].classList.add("active");
  else {
    steps[0].classList.add("done");
    if (!ready) steps[1].classList.add("active");
    else { steps[1].classList.add("done"); steps[2].classList.add("active"); }
  }
}

function updateState() {
  const connected = !!loader;
  els.connect.disabled = busy || connected || !("serial" in navigator);
  els.disconnect.disabled = busy || !connected;
  els.erase.disabled = busy || !connected;
  els.reset.disabled = busy || !connected;
  els.program.disabled = busy || !connected || !!validate();
  els.program.title = connected ? validate() : "เชื่อมต่อบอร์ดก่อน";
  els.preset.disabled = busy;
  els.status.textContent = busy ? "กำลังทำงาน..." : connected ? "เชื่อมต่อแล้ว" : "ยังไม่ได้เชื่อมต่อ";
  els.status.classList.toggle("on", connected);
  els.hint.textContent = connected ? `bootloader ของชิปนี้อยู่ที่ ${hex(bootOffset)}` : "";
  setSteps();
}

function setProgress(frac, state = "") {
  els.progress.hidden = false;
  els.progress.classList.remove("ok", "fail");
  if (state) els.progress.classList.add(state);
  const p = Math.max(0, Math.min(100, Math.round(frac * 100)));
  els.bar.style.width = p + "%";
  els.pct.textContent = p + "%";
}

function showPill(el, text) { el.hidden = !text; el.textContent = text || ""; }

async function withBusy(fn) {
  busy = true; updateState();
  try { await fn(); }
  finally { busy = false; updateState(); }
}

// ---------- esptool actions ----------
async function loadLib() {
  if (lib) return lib;
  log("กำลังโหลด esptool-js...");
  lib = await import(LIB_URL);
  return lib;
}

async function connect() {
  let port;
  try { port = await navigator.serial.requestPort(); }
  catch { log("ยกเลิกการเลือกพอร์ต ถ้าไม่เห็นพอร์ตในรายการ ให้ติดตั้ง driver CP210x / CH340 (ดูหน้า Serial Monitor)"); return; }
  await withBusy(async () => {
    try {
      const { ESPLoader, Transport } = await loadLib();
      transport = new Transport(port, false);
      const l = new ESPLoader({ transport, baudrate: Number($("#flashBaud").value), terminal, debugLogging: false });
      const desc = await l.main();
      loader = l;
      bootOffset = l.chip.BOOTLOADER_FLASH_OFFSET ?? 0x1000;
      showPill(els.chip, desc);
      try { showPill(els.mac, "MAC " + (await l.chip.readMac(l))); } catch { showPill(els.mac, ""); }
      try { showPill(els.size, "Flash " + (await l.detectFlashSize())); } catch { showPill(els.size, ""); }
      // keep bootloader rows in sync with the detected chip
      for (const r of rows) if (r.label === "bootloader") r.addr = hex(bootOffset);
      if (l.chip.CHIP_NAME === "ESP8266" && els.preset.value === "app") { els.preset.value = "esp8266"; applyPreset("esp8266"); }
      renderRows();
      log(`พร้อมแล้ว: ${desc}`);
      toast("เชื่อมต่อบอร์ดแล้ว");
    } catch (e) {
      log("เชื่อมต่อไม่สำเร็จ: " + (e?.message || e));
      log("ลองกดปุ่ม BOOT ค้างไว้ แล้วกด EN/RST หนึ่งครั้ง จากนั้นกดเชื่อมต่อใหม่ หรือลดค่า baud rate");
      await cleanup();
    }
  });
}

async function cleanup() {
  try { if (transport) await transport.disconnect(); } catch {}
  transport = null; loader = null;
  showPill(els.chip, ""); showPill(els.mac, ""); showPill(els.size, "");
}

async function program() {
  const err = validate();
  if (err) { toast(err); return; }
  const sizes = rows.map((r) => r.data.length);
  const total = sizes.reduce((a, b) => a + b, 0);
  const before = sizes.map((_, i) => sizes.slice(0, i).reduce((a, b) => a + b, 0));
  await withBusy(async () => {
    setProgress(0);
    const started = performance.now();
    try {
      await loader.writeFlash({
        fileArray: rows.map((r) => ({ data: r.data, address: parseAddr(r.addr) })),
        flashMode: $("#flashMode").value,
        flashFreq: "keep",
        flashSize: $("#flashSize").value,
        eraseAll: $("#flashEraseAll").checked,
        compress: true,
        reportProgress: (i, written, size) => setProgress((before[i] + (size ? written / size : 1) * sizes[i]) / total),
        calculateMD5Hash: md5,
      });
      setProgress(1, "ok");
      log(`อัปโหลดสำเร็จ ${fmtBytes(total)} ใช้เวลา ${((performance.now() - started) / 1000).toFixed(1)} วินาที`);
      log("กำลังรีเซ็ตบอร์ดเพื่อรันเฟิร์มแวร์ใหม่...");
      try { await loader.after("hard_reset"); } catch {}
      await cleanup();
      log("ตัดการเชื่อมต่อแล้ว เปิดหน้า Serial Monitor เพื่อดูผลลัพธ์จากบอร์ดได้");
      toast("อัปโหลดเฟิร์มแวร์สำเร็จ");
    } catch (e) {
      setProgress(1, "fail");
      log("อัปโหลดไม่สำเร็จ: " + (e?.message || e));
      log("ลองลด baud rate เป็น 115200 หรือเปลี่ยนสาย USB แล้วเชื่อมต่อใหม่");
      await cleanup();
    }
  });
}

async function eraseAll() {
  if (!confirm("ลบข้อมูลใน flash ทั้งหมด รวมถึงโปรแกรมและค่าที่บันทึกไว้ ต้องการทำต่อหรือไม่?")) return;
  await withBusy(async () => {
    try {
      log("กำลังลบ flash ทั้งหมด อาจใช้เวลาประมาณ 10 ถึง 60 วินาที...");
      const t = performance.now();
      await loader.eraseFlash();
      log(`ลบเสร็จใน ${((performance.now() - t) / 1000).toFixed(1)} วินาที`);
      toast("ลบ flash แล้ว");
    } catch (e) {
      log("ลบไม่สำเร็จ: " + (e?.message || e));
    }
  });
}

async function resetBoard() {
  await withBusy(async () => {
    try { await loader.after("hard_reset"); log("รีเซ็ตบอร์ดแล้ว"); } catch (e) { log("รีเซ็ตไม่สำเร็จ: " + (e?.message || e)); }
    await cleanup();
  });
}

els.connect.addEventListener("click", connect);
els.disconnect.addEventListener("click", () => withBusy(async () => { await cleanup(); log("ตัดการเชื่อมต่อแล้ว"); }));
els.program.addEventListener("click", program);
els.erase.addEventListener("click", eraseAll);
els.reset.addEventListener("click", resetBoard);

// ---------- UF2 boards: 1200 baud touch ----------
$("#uf2Touch").addEventListener("click", async () => {
  const st = $("#uf2Status");
  let port;
  try { port = await navigator.serial.requestPort(); } catch { return; }
  try {
    await port.open({ baudRate: 1200 });
    await port.setSignals({ dataTerminalReady: false }).catch(() => {});
    await new Promise((r) => setTimeout(r, 150));
    await port.close();
    st.textContent = "ส่งคำสั่งแล้ว รอสักครู่ ไดรฟ์ RPI-RP2 ควรขึ้นมาใน File Explorer ถ้าไม่ขึ้น ให้ใช้วิธีกดปุ่ม BOOTSEL ขณะเสียบสาย";
  } catch (e) {
    st.textContent = "เปิดพอร์ตไม่ได้: " + (e?.message || e) + " ปิดโปรแกรมอื่นที่ใช้พอร์ตนี้อยู่ แล้วลองใหม่";
  }
});

addEventListener("beforeunload", (e) => { if (busy) { e.preventDefault(); e.returnValue = ""; } });

applyPreset("app");
