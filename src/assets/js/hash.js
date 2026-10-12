import { $, $$, showErr, enc, bytesToHex, hexToBytes, fmtBytes } from "/assets/js/common.js";

const inp = $("#hashIn");
let fileBytes = null;

// ---------- MD5 (RFC 1321), compact implementation ----------
const MD5_K = Uint32Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32));
const MD5_S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
function md5(bytes) {
  const K = MD5_K, S = MD5_S;
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
      F = (F + A + K[i] + M[g]) >>> 0;
      A = D; D = C; C = B;
      const s = S[(i >> 4) * 4 + (i % 4)];
      B = (B + ((F << s) | (F >>> (32 - s)))) >>> 0;
    }
    a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
  }
  const out = new Uint8Array(16), ov = new DataView(out.buffer);
  ov.setUint32(0, a0, true); ov.setUint32(4, b0, true); ov.setUint32(8, c0, true); ov.setUint32(12, d0, true);
  return bytesToHex(out, "", false);
}

// ---------- CRC32 (IEEE 802.3) ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return ((c ^ 0xffffffff) >>> 0).toString(16).padStart(8, "0").toUpperCase();
}

// ---------- CRC16 Modbus (poly 0xA001 reflected, init 0xFFFF) ----------
function crc16Modbus(bytes) {
  let crc = 0xffff;
  for (const b of bytes) {
    crc ^= b;
    for (let i = 0; i < 8; i++) crc = crc & 1 ? (crc >>> 1) ^ 0xa001 : crc >>> 1;
  }
  const hex = crc.toString(16).padStart(4, "0").toUpperCase();
  return `${hex}  (LSB first: ${hex.slice(2)} ${hex.slice(0, 2)})`;
}

function xorSum(bytes) { let x = 0; for (const b of bytes) x ^= b; return x.toString(16).padStart(2, "0").toUpperCase(); }
function sum8(bytes) {
  let s = 0; for (const b of bytes) s = (s + b) & 0xff;
  const comp = (0x100 - s) & 0xff;
  return `${s.toString(16).padStart(2, "0").toUpperCase()}  /  2's complement: ${comp.toString(16).padStart(2, "0").toUpperCase()}`;
}

let runId = 0;
async function compute() {
  const id = ++runId;
  showErr("#hashErr");
  let bytes;
  try {
    bytes = fileBytes ?? ($("#hashIsHex").checked ? hexToBytes(inp.value) : enc.encode(inp.value));
  } catch (e) { showErr("#hashErr", e.message); return; }
  const cells = Object.fromEntries($$("#hashTbl td[data-h]").map((td) => [td.dataset.h, td]));
  cells.md5.textContent = md5(bytes);
  cells.crc32.textContent = crc32(bytes);
  cells.crc16.textContent = crc16Modbus(bytes);
  cells.xor.textContent = xorSum(bytes);
  cells.sum.textContent = sum8(bytes);
  for (const alg of ["SHA-1", "SHA-256", "SHA-384", "SHA-512"]) {
    const h = await crypto.subtle.digest(alg, bytes);
    if (id !== runId) return;
    cells[alg].textContent = bytesToHex(new Uint8Array(h), "", false);
  }
}

let debounce;
inp.addEventListener("input", () => {
  fileBytes = null;
  $("#hashFileName").textContent = "";
  clearTimeout(debounce);
  debounce = setTimeout(compute, 200);
});
$("#hashIsHex").addEventListener("change", compute);
$("#hashFile").addEventListener("change", async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  fileBytes = new Uint8Array(await f.arrayBuffer());
  $("#hashFileName").textContent = `${f.name} (${fmtBytes(fileBytes.length)})`;
  inp.value = "";
  compute();
  e.target.value = "";
});
compute();
