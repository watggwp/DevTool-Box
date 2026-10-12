import { $, bytesToHex, bytesToBase64 } from "/js/common.js";

const out = $("#uuidOut");
const clamp = (el, lo, hi) => Math.min(hi, Math.max(lo, Number(el.value) || lo));

function uuidv4() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = bytesToHex(b, "", false);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

$("#uuidGen").addEventListener("click", () => {
  const n = clamp($("#uuidCount"), 1, 100);
  const list = Array.from({ length: n }, uuidv4);
  out.value = ($("#uuidUpper").checked ? list.map((u) => u.toUpperCase()) : list).join("\n");
});

$("#randHex").addEventListener("click", () => {
  const n = clamp($("#randLen"), 1, 1024);
  out.value = bytesToHex(crypto.getRandomValues(new Uint8Array(n)), "", false);
});

$("#randB64").addEventListener("click", () => {
  const n = clamp($("#randLen"), 1, 1024);
  out.value = bytesToBase64(crypto.getRandomValues(new Uint8Array(n)));
});

$("#pwGen").addEventListener("click", () => {
  const n = clamp($("#pwLen"), 4, 128);
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_=+";
  const r = crypto.getRandomValues(new Uint32Array(n));
  out.value = Array.from(r, (x) => chars[x % chars.length]).join("");
});

$("#uuidGen").click();
