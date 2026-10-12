// IEEE 754 pure logic (no DOM) — used by float.js and unit tests.

// 32-bit byte orders: letters are the big-endian bytes A B C D.
export const ORDERS32 = {
  ABCD: "Big-endian (ABCD)",
  DCBA: "Little-endian (DCBA)",
  CDAB: "Word swap (CDAB)",
  BADC: "Byte swap (BADC)",
};
export const ORDERS64 = { BE: "Big-endian", LE: "Little-endian" };

export function parseHex(str) {
  const clean = String(str).replace(/0x/gi, "").replace(/[^0-9a-f]/gi, "");
  if (clean.length % 2) throw new Error("จำนวนหลัก hex ต้องเป็นเลขคู่");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

export const toHex = (bytes, sep = " ") => [...bytes].map((b) => b.toString(16).toUpperCase().padStart(2, "0")).join(sep);

export function parseDecimal(str) {
  const t = String(str).trim().toLowerCase().replace(/,/g, "");
  if (t === "nan") return NaN;
  if (t === "inf" || t === "+inf" || t === "infinity" || t === "+infinity") return Infinity;
  if (t === "-inf" || t === "-infinity") return -Infinity;
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/.test(t)) throw new Error(`"${str}" ไม่ใช่ตัวเลขทศนิยม`);
  return Number(t);
}

export function toBytesBE(value, bits) {
  const dv = new DataView(new ArrayBuffer(bits / 8));
  if (bits === 32) dv.setFloat32(0, value, false); else dv.setFloat64(0, value, false);
  return new Uint8Array(dv.buffer);
}

export function fromBytesBE(bytes) {
  const dv = new DataView(Uint8Array.from(bytes).buffer);
  return bytes.length === 4 ? dv.getFloat32(0, false) : dv.getFloat64(0, false);
}

// Reorder big-endian bytes into the given order (and reverse with fromOrder).
export function toOrder(be, order) {
  if (be.length === 8) return order === "LE" ? Uint8Array.from(be).reverse() : Uint8Array.from(be);
  return Uint8Array.from(order, (ch) => be[ch.charCodeAt(0) - 65]);
}
export function fromOrder(bytes, order) {
  if (bytes.length === 8) return order === "LE" ? Uint8Array.from(bytes).reverse() : Uint8Array.from(bytes);
  const be = new Uint8Array(4);
  [...order].forEach((ch, i) => { be[ch.charCodeAt(0) - 65] = bytes[i]; });
  return be;
}

// Bit fields of a big-endian float.
export function fields(be) {
  const bits = [...be].map((b) => b.toString(2).padStart(8, "0")).join("");
  const is32 = be.length === 4;
  const expLen = is32 ? 8 : 11, bias = is32 ? 127 : 1023;
  const sign = bits[0];
  const exp = bits.slice(1, 1 + expLen);
  const mant = bits.slice(1 + expLen);
  const e = parseInt(exp, 2);
  const allOnes = e === (1 << expLen) - 1;
  const mantZero = !mant.includes("1");
  let cls;
  if (e === 0) cls = mantZero ? "zero" : "subnormal";
  else if (allOnes) cls = mantZero ? "infinity" : "nan";
  else cls = "normal";
  return { bits, sign, exp, mant, expValue: e, bias, expUnbiased: e === 0 ? 1 - bias : e - bias, cls };
}

export const CLASS_TH = {
  zero: "ศูนย์ (zero)",
  subnormal: "Subnormal / denormal (ค่าน้อยมาก ความละเอียดลดลง)",
  normal: "ปกติ (normal)",
  infinity: "อนันต์ (Infinity)",
  nan: "ไม่ใช่ตัวเลข (NaN)",
};

// Two 16-bit registers -> float32. order "ABCD" = first register is high word.
export function registersToFloat(r1, r2, order = "ABCD") {
  const [hi, lo] = order === "ABCD" ? [r1, r2] : [r2, r1];
  const dv = new DataView(new ArrayBuffer(4));
  dv.setUint16(0, hi);
  dv.setUint16(2, lo);
  return { f32: dv.getFloat32(0), u32: dv.getUint32(0), i32: dv.getInt32(0), be: new Uint8Array(dv.buffer) };
}

export function formatFloat(v, bits) {
  if (Number.isNaN(v)) return "NaN";
  if (!Number.isFinite(v)) return v > 0 ? "Infinity" : "-Infinity";
  if (Object.is(v, -0)) return "-0";
  return bits === 32 ? String(Number(v.toPrecision(9))) : String(v);
}

// Shortest decimal that converts back to the same float32.
export function shortestF32(v) {
  if (!Number.isFinite(v)) return v;
  for (let p = 1; p <= 9; p++) {
    const n = Number(v.toPrecision(p));
    if (Math.fround(n) === v) return n;
  }
  return v;
}
