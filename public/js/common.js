// Shared behaviour for every page: theme toggle, mobile menu, copy/clear buttons, toast, helpers, home search.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

let toastTimer;
export function toast(msg) {
  const t = $("#toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
}

export function showErr(sel, msg) {
  const el = $(sel);
  if (!el) return;
  if (!msg) { el.hidden = true; el.textContent = ""; return; }
  el.hidden = false;
  el.textContent = msg;
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast("คัดลอกแล้ว");
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    toast("คัดลอกแล้ว");
  }
}

export function download(filename, data, type = "application/octet-stream") {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- byte helpers ----------
export const enc = new TextEncoder();
export const dec = new TextDecoder("utf-8", { fatal: false });

export function bytesToHex(bytes, sep = " ", upper = true) {
  const out = [];
  for (const b of bytes) out.push(b.toString(16).padStart(2, "0"));
  const s = out.join(sep);
  return upper ? s.toUpperCase() : s;
}

export function hexToBytes(str) {
  const clean = str.replace(/0x/gi, "").replace(/\\x/gi, "").replace(/[^0-9a-f]/gi, "");
  if (clean.length % 2) throw new Error("จำนวนหลัก hex ต้องเป็นเลขคู่ (" + clean.length + " หลัก)");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

export function bytesToBase64(bytes, urlSafe = false) {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  let b64 = btoa(bin);
  if (urlSafe) b64 = b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return b64;
}

export function base64ToBytes(b64) {
  let s = b64.trim().replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
  if (s.length % 4) s += "=".repeat(4 - (s.length % 4));
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function fmtBytes(n) {
  if (n < 1024) return n + " B";
  if (n < 1048576) return (n / 1024).toFixed(1) + " KB";
  return (n / 1048576).toFixed(2) + " MB";
}

// ---------- theme toggle (two-state, per modern-web-guidance) ----------
function initTheme() {
  const meta = document.querySelector('meta[name="color-scheme"]');
  const btn = $("#themeToggle");
  if (!meta || !btn) return;
  const mq = matchMedia("(prefers-color-scheme: dark)");
  const current = () => {
    const stored = safeGet("color-scheme");
    if (stored === "light" || stored === "dark") return stored;
    return mq.matches ? "dark" : "light";
  };
  btn.addEventListener("click", () => {
    const target = current() === "dark" ? "light" : "dark";
    const system = mq.matches ? "dark" : "light";
    if (target === system) safeRemove("color-scheme"); else safeSet("color-scheme", target);
    meta.content = safeGet("color-scheme") ?? "light dark";
  });
  addEventListener("storage", (e) => {
    if (e.key === "color-scheme") meta.content = e.newValue ?? "light dark";
  });
}
function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function safeSet(k, v) { try { localStorage.setItem(k, v); } catch {} }
function safeRemove(k) { try { localStorage.removeItem(k); } catch {} }

// ---------- mobile menu ----------
function initMenu() {
  const btn = $("#menuBtn"), sb = $("#sidebar");
  if (!btn || !sb) return;
  btn.addEventListener("click", () => {
    const open = sb.classList.toggle("open");
    btn.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("click", (e) => {
    if (sb.classList.contains("open") && !sb.contains(e.target) && e.target !== btn) {
      sb.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
    }
  });
}

// ---------- generic copy / clear buttons ----------
function initButtons() {
  document.addEventListener("click", (e) => {
    const copyBtn = e.target.closest("[data-copy]");
    if (copyBtn) {
      const el = $(copyBtn.dataset.copy);
      const text = el ? ("value" in el ? el.value : el.textContent) : "";
      if (!text) { toast("ไม่มีข้อมูลให้คัดลอก"); return; }
      copyText(text);
      return;
    }
    const clearBtn = e.target.closest("[data-clear]");
    if (clearBtn) {
      clearBtn.dataset.clear.split(",").forEach((s) => {
        const el = $(s.trim());
        if (!el) return;
        if ("value" in el) el.value = ""; else el.textContent = "";
        el.dispatchEvent(new Event("input", { bubbles: true }));
      });
      $$(".notice.err").forEach((n) => (n.hidden = true));
      return;
    }
    const cell = e.target.closest("td.copyable");
    if (cell && cell.textContent.trim()) copyText(cell.textContent.trim());
  });
}

function initSecureBadge() {
  const b = $("#secureBadge");
  if (!b) return;
  if (window.isSecureContext) { b.textContent = "secure"; b.classList.add("ok"); }
  else { b.textContent = "not secure"; }
}

// ---------- home page search ----------
function initSearch() {
  const box = $("#toolSearch");
  if (!box) return;
  const cards = $$("#toolGrid .tool-card");
  const empty = $("#toolEmpty");
  const apply = () => {
    const q = box.value.trim().toLowerCase();
    let shown = 0;
    for (const c of cards) {
      const hit = !q || c.dataset.search.includes(q);
      c.hidden = !hit;
      if (hit) shown++;
    }
    empty.hidden = shown > 0;
  };
  box.addEventListener("input", apply);
  box.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { const first = cards.find((c) => !c.hidden); if (first) location.href = first.href; }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && !/input|textarea|select/i.test(e.target.tagName)) { e.preventDefault(); box.focus(); box.select(); }
  });
}

initTheme();
initMenu();
initButtons();
initSecureBadge();
initSearch();
