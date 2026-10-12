// Struct parser pure logic (no DOM) — used by struct.js and unit tests.
//
// Spec syntax (tokens separated by spaces, commas or new lines):
//   [name:]type[le|be][[count]]
//   types: u8 i8 u16 i16 u32 i32 u64 i64 f32 f64 bool
//          strN (text N bytes) hexN (raw N bytes) skipN / padN (ignore N bytes)
//   examples: u8  temp:f32le  regs:u16be[4]  name:str8  skip2

const SIZES = { u8: 1, i8: 1, bool: 1, u16: 2, i16: 2, u32: 4, i32: 4, u64: 8, i64: 8, f32: 4, f64: 8 };

export function parseHex(str) {
  const clean = String(str).replace(/0x/gi, "").replace(/\\x/gi, "").replace(/[^0-9a-f]/gi, "");
  if (clean.length % 2) throw new Error("จำนวนหลัก hex ต้องเป็นเลขคู่");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

export const toHex = (bytes) => [...bytes].map((b) => b.toString(16).toUpperCase().padStart(2, "0")).join(" ");

export function parseSpec(spec) {
  const tokens = String(spec).replace(/#.*$/gm, "").split(/[\s,;]+/).filter(Boolean);
  if (!tokens.length) throw new Error("ยังไม่ได้ใส่รูปแบบ (format)");
  return tokens.map((tok, i) => {
    let name = "", body = tok;
    const c = tok.indexOf(":");
    if (c > 0) { name = tok.slice(0, c); body = tok.slice(c + 1); }
    const m = body.toLowerCase().match(/^(u8|i8|bool|u16|i16|u32|i32|u64|i64|f32|f64|str|hex|skip|pad)(\d*)(le|be)?(?:\[(\d+)\])?$/);
    if (!m) throw new Error(`ไม่รู้จักชนิด "${tok}" (รายการที่ ${i + 1})`);
    const [, base, num, endian, cnt] = m;
    if (base === "str" || base === "hex" || base === "skip" || base === "pad") {
      const n = Number(num || 1);
      if (!n) throw new Error(`"${tok}" ต้องระบุจำนวนไบต์มากกว่า 0`);
      if (cnt) throw new Error(`"${tok}" ไม่รองรับ [count] ให้ใช้จำนวนไบต์แทน เช่น str8`);
      return { name, type: base === "pad" ? "skip" : base, size: n, count: 1, endian: null, token: tok };
    }
    if (num) throw new Error(`"${tok}" ไม่ถูกต้อง`);
    const count = cnt ? Number(cnt) : 1;
    if (cnt && !count) throw new Error(`"${tok}" จำนวนใน [ ] ต้องมากกว่า 0`);
    return { name, type: base, size: SIZES[base], count, endian: endian ?? null, token: tok };
  });
}

// Shortest decimal that converts back to the same float32 (35.2 instead of 35.2000008).
export function shortestF32(v) {
  if (!Number.isFinite(v)) return v;
  for (let p = 1; p <= 9; p++) {
    const n = Number(v.toPrecision(p));
    if (Math.fround(n) === v) return n;
  }
  return v;
}

function readOne(dv, off, type, little) {
  switch (type) {
    case "u8": return dv.getUint8(off);
    case "i8": return dv.getInt8(off);
    case "bool": return dv.getUint8(off) !== 0;
    case "u16": return dv.getUint16(off, little);
    case "i16": return dv.getInt16(off, little);
    case "u32": return dv.getUint32(off, little);
    case "i32": return dv.getInt32(off, little);
    case "u64": return dv.getBigUint64(off, little);
    case "i64": return dv.getBigInt64(off, little);
    case "f32": return shortestF32(dv.getFloat32(off, little));
    case "f64": return dv.getFloat64(off, little);
  }
}

// defaultEndian: "le" | "be"
export function parseStruct(bytes, items, defaultEndian = "le") {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const rows = [];
  let off = 0, error = null;
  for (const it of items) {
    const total = it.size * it.count;
    if (off + total > bytes.length) {
      error = `ข้อมูลไม่พอสำหรับ "${it.token}": ต้องการ ${total} ไบต์ที่ offset ${off} แต่เหลือ ${bytes.length - off} ไบต์`;
      break;
    }
    const raw = bytes.subarray(off, off + total);
    const little = (it.endian ?? defaultEndian) === "le";
    let value;
    if (it.type === "skip") value = "(ข้าม)";
    else if (it.type === "hex") value = toHex(raw);
    else if (it.type === "str") value = new TextDecoder().decode(raw).replace(/\0+$/, "");
    else {
      const vals = [];
      for (let k = 0; k < it.count; k++) vals.push(readOne(dv, off + k * it.size, it.type, little));
      value = it.count === 1 ? vals[0] : vals;
    }
    const endianLabel = it.size > 1 && SIZES[it.type] > 1 ? (little ? " LE" : " BE") : "";
    rows.push({
      offset: off,
      name: it.name,
      type: it.type + (it.type === "str" || it.type === "hex" || it.type === "skip" ? it.size : "") + endianLabel + (it.count > 1 ? `[${it.count}]` : ""),
      raw: toHex(raw),
      value,
      kind: it.type,
    });
    off += total;
  }
  return { rows, used: off, leftover: bytes.subarray(off), error };
}

export function formatValue(v) {
  if (Array.isArray(v)) return "[" + v.map(formatValue).join(", ") + "]";
  if (typeof v === "bigint") return v.toString();
  return String(v);
}
