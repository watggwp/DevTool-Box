import { $, $$, showErr } from "/assets/js/common.js";

const inputs = $$(".tool input[data-base]");
const info = $("#nInfo");

function parseBig(str, base) {
  let s = str.trim().replace(/[\s_]/g, "");
  let neg = false;
  if (s.startsWith("-")) { neg = true; s = s.slice(1); }
  s = s.replace(/^0x/i, "").replace(/^0b/i, "").replace(/^0o/i, "");
  if (!s) return null;
  const valid = { 2: /^[01]+$/, 8: /^[0-7]+$/, 10: /^\d+$/, 16: /^[0-9a-f]+$/i }[base];
  if (!valid.test(s)) throw new Error(`ไม่ใช่เลขฐาน ${base} ที่ถูกต้อง`);
  const prefix = { 2: "0b", 8: "0o", 10: "", 16: "0x" }[base];
  const v = BigInt(prefix + s.toLowerCase());
  return neg ? -v : v;
}

function group(s, n, sep = " ") {
  const out = [];
  for (let i = s.length; i > 0; i -= n) out.unshift(s.slice(Math.max(0, i - n), i));
  return out.join(sep);
}

function render(v) {
  if (v === null) { info.innerHTML = ""; return; }
  const abs = v < 0n ? -v : v;
  const bits = abs === 0n ? 1 : abs.toString(2).length;
  const width = bits <= 8 ? 8 : bits <= 16 ? 16 : bits <= 32 ? 32 : bits <= 64 ? 64 : bits;
  const mask = (1n << BigInt(width)) - 1n;
  const twos = (v & mask).toString(16).toUpperCase().padStart(width / 4, "0");
  const asSigned = v >= 0n && (v >> BigInt(width - 1)) & 1n ? v - (1n << BigInt(width)) : v;
  const rows = [
    ["Bits", `${bits} bit (ขนาด ${width}-bit)`],
    ["Binary (grouped)", group(abs.toString(2).padStart(width, "0"), 4)],
    ["Hex (grouped)", group(abs.toString(16).toUpperCase().padStart(width / 4, "0"), 2)],
    [`2's complement ${width}-bit`, v < 0n ? `0x${twos}` : `0x${twos} (ถ้าอ่านเป็น signed = ${asSigned})`],
    ["Little-endian bytes", group(abs.toString(16).toUpperCase().padStart(width / 4, "0"), 2).split(" ").reverse().join(" ")],
  ];
  if (abs >= 0n && abs < 128n) {
    const c = Number(abs);
    rows.push(["ASCII", c >= 32 && c < 127 ? `'${String.fromCharCode(c)}'` : `control (0x${c.toString(16).toUpperCase().padStart(2, "0")})`]);
  }
  info.innerHTML = rows.map(([k, val]) => `<tr><th>${k}</th><td class="mono copyable">${val}</td></tr>`).join("");
}

for (const el of inputs) {
  el.addEventListener("input", () => {
    showErr("#baseErr");
    let v;
    try { v = parseBig(el.value, Number(el.dataset.base)); }
    catch (e) { showErr("#baseErr", e.message); return; }
    for (const other of inputs) {
      if (other === el) continue;
      other.value = v === null ? "" : (v < 0n ? "-" : "") + (v < 0n ? -v : v).toString(Number(other.dataset.base)).toUpperCase();
    }
    render(v);
  });
}
