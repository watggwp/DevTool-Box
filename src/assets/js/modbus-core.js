// Modbus RTU pure logic (no DOM) — used by modbus.js and unit tests.

export function crc16(bytes) {
  let crc = 0xffff;
  for (const b of bytes) {
    crc ^= b;
    for (let i = 0; i < 8; i++) crc = crc & 1 ? (crc >>> 1) ^ 0xa001 : crc >>> 1;
  }
  return crc;
}

export function withCrc(bytes) {
  const c = crc16(bytes);
  return Uint8Array.from([...bytes, c & 0xff, c >>> 8]);
}

export function parseHex(str) {
  const clean = String(str).replace(/0x/gi, "").replace(/[^0-9a-f]/gi, "");
  if (clean.length % 2) throw new Error("จำนวนหลัก hex ต้องเป็นเลขคู่");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

export const hex2 = (n) => n.toString(16).toUpperCase().padStart(2, "0");
export const hex4 = (n) => n.toString(16).toUpperCase().padStart(4, "0");
export const toHex = (bytes) => [...bytes].map(hex2).join(" ");

export const FUNCS = {
  1: "Read Coils",
  2: "Read Discrete Inputs",
  3: "Read Holding Registers",
  4: "Read Input Registers",
  5: "Write Single Coil",
  6: "Write Single Register",
  15: "Write Multiple Coils",
  16: "Write Multiple Registers",
};

export const EXCEPTIONS = {
  1: "Illegal Function: อุปกรณ์ไม่รองรับ function code นี้",
  2: "Illegal Data Address: ไม่มี address นี้ในอุปกรณ์ หรืออ่านเกินช่วง",
  3: "Illegal Data Value: ค่าหรือจำนวนที่ส่งไปไม่ถูกต้อง",
  4: "Slave Device Failure: อุปกรณ์เกิดข้อผิดพลาดภายในขณะทำงาน",
  5: "Acknowledge: รับคำสั่งแล้วแต่ต้องใช้เวลาประมวลผลนาน",
  6: "Slave Device Busy: อุปกรณ์ไม่ว่าง ให้ส่งใหม่ภายหลัง",
  8: "Memory Parity Error: หน่วยความจำของอุปกรณ์ผิดพลาด",
  10: "Gateway Path Unavailable: gateway หาเส้นทางไปยังอุปกรณ์ไม่ได้",
  11: "Gateway Target Device Failed to Respond: อุปกรณ์ปลายทางหลัง gateway ไม่ตอบ",
};

function intIn(v, lo, hi, name) {
  const n = typeof v === "number" ? v : Number(String(v).trim());
  if (!Number.isInteger(n) || n < lo || n > hi) throw new Error(`${name} ต้องเป็นจำนวนเต็ม ${lo} ถึง ${hi}`);
  return n;
}

// Parses "10", "0x0A", "0A h" style integers; accepts hex with 0x prefix.
export function parseInt16ish(s) {
  const t = String(s).trim();
  if (/^-?0x[0-9a-f]+$/i.test(t)) return t.startsWith("-") ? -parseInt(t.slice(3), 16) : parseInt(t.slice(2), 16);
  if (/^-?\d+$/.test(t)) return Number(t);
  throw new Error(`ค่า "${t}" ไม่ใช่ตัวเลข`);
}

// values: for fc5 -> boolean/0/1, fc6 -> number, fc15 -> array of 0/1, fc16 -> array of numbers
export function buildRequest({ slave, fc, addr, qty, values }) {
  slave = intIn(slave, 0, 247, "Slave ID");
  addr = intIn(addr, 0, 65535, "Address");
  const head = [slave, fc, addr >> 8, addr & 0xff];
  let body;
  if (fc >= 1 && fc <= 4) {
    const max = fc <= 2 ? 2000 : 125;
    qty = intIn(qty, 1, max, "จำนวน");
    body = [qty >> 8, qty & 0xff];
  } else if (fc === 5) {
    body = values ? [0xff, 0x00] : [0x00, 0x00];
  } else if (fc === 6) {
    let v = intIn(values, -32768, 65535, "ค่า");
    v &= 0xffff;
    body = [v >> 8, v & 0xff];
  } else if (fc === 15) {
    const bits = values ?? [];
    if (bits.length < 1 || bits.length > 1968) throw new Error("จำนวน coil ต้องอยู่ระหว่าง 1 ถึง 1968");
    const bc = Math.ceil(bits.length / 8);
    const data = new Array(bc).fill(0);
    bits.forEach((b, i) => { if (b) data[i >> 3] |= 1 << (i & 7); });
    body = [bits.length >> 8, bits.length & 0xff, bc, ...data];
  } else if (fc === 16) {
    const regs = values ?? [];
    if (regs.length < 1 || regs.length > 123) throw new Error("จำนวน register ต้องอยู่ระหว่าง 1 ถึง 123");
    const data = [];
    for (const r of regs) {
      const v = intIn(r, -32768, 65535, "ค่า register") & 0xffff;
      data.push(v >> 8, v & 0xff);
    }
    body = [regs.length >> 8, regs.length & 0xff, regs.length * 2, ...data];
  } else {
    throw new Error("ไม่รองรับ function code นี้");
  }
  return withCrc(Uint8Array.from([...head, ...body]));
}

const u16 = (b, i) => (b[i] << 8) | b[i + 1];

// Detects request / response / exception and explains every field.
// kind: "auto" | "request" | "response"
export function decodeFrame(bytes, kind = "auto") {
  if (bytes.length < 4) throw new Error("frame สั้นเกินไป (ต้องมีอย่างน้อย 4 ไบต์: slave, function, CRC 2 ไบต์)");
  const body = bytes.subarray(0, bytes.length - 2);
  const got = bytes[bytes.length - 2] | (bytes[bytes.length - 1] << 8);
  const calc = crc16(body);
  const res = { crcOk: got === calc, crcGot: got, crcCalc: calc, slave: bytes[0], fc: bytes[1], fields: [], registers: null, bits: null, kind: "", warnings: [] };
  const f = (bytesIdx, len, name, desc) => res.fields.push({ offset: bytesIdx, raw: toHex(bytes.subarray(bytesIdx, bytesIdx + len)), name, desc });

  f(0, 1, "Slave ID", bytes[0] === 0 ? "0 (broadcast)" : String(bytes[0]));
  const fc = bytes[1];

  if (fc & 0x80) {
    res.kind = "exception";
    const base = fc & 0x7f;
    f(1, 1, "Function", `0x${hex2(fc)} = exception ของ ${FUNCS[base] ?? "fc " + base}`);
    if (bytes.length >= 5) {
      const code = bytes[2];
      res.exception = { code, text: EXCEPTIONS[code] ?? "รหัส exception ที่ไม่รู้จัก" };
      f(2, 1, "Exception code", `${code}: ${res.exception.text}`);
    }
  } else {
    f(1, 1, "Function", `0x${hex2(fc)} = ${FUNCS[fc] ?? "ไม่รู้จัก"}`);
    const n = bytes.length;
    let detected = kind;
    if (detected === "auto") {
      if (fc >= 1 && fc <= 4) {
        // response length = 5 + byte count (register responses always have an even byte count)
        const looksResp = n === 5 + bytes[2] && (fc <= 2 || bytes[2] % 2 === 0);
        detected = looksResp ? "response" : n === 8 ? "request" : "response";
        if (looksResp && n === 8) res.warnings.push("frame นี้อ่านได้ทั้งแบบ request และ response ถ้าผลไม่ตรง ให้เลือกชนิดเอง");
      } else if (fc === 5 || fc === 6) detected = "request";
      else if (fc === 15 || fc === 16) detected = n === 8 ? "response" : "request";
      else detected = "request";
    }
    res.kind = detected;

    if (fc >= 1 && fc <= 4) {
      if (detected === "request") {
        if (n !== 8) res.warnings.push(`request ของ fc ${fc} ควรยาว 8 ไบต์ แต่ได้ ${n} ไบต์`);
        f(2, 2, "Start address", `${u16(bytes, 2)} (0x${hex4(u16(bytes, 2))})`);
        f(4, 2, "Quantity", `${u16(bytes, 4)}`);
      } else {
        const bc = bytes[2];
        f(2, 1, "Byte count", String(bc));
        if (n !== 5 + bc) res.warnings.push(`byte count = ${bc} แต่ข้อมูลจริงยาว ${n - 5} ไบต์`);
        const data = bytes.subarray(3, Math.min(3 + bc, n - 2));
        f(3, data.length, "Data", fc <= 2 ? "สถานะ bit (LSB ก่อน)" : `${Math.floor(data.length / 2)} register`);
        if (fc <= 2) {
          res.bits = [];
          for (let i = 0; i < data.length * 8; i++) res.bits.push((data[i >> 3] >> (i & 7)) & 1);
        } else {
          res.registers = [];
          for (let i = 0; i + 1 < data.length; i += 2) res.registers.push((data[i] << 8) | data[i + 1]);
        }
      }
    } else if (fc === 5) {
      f(2, 2, "Coil address", `${u16(bytes, 2)}`);
      const v = u16(bytes, 4);
      f(4, 2, "Value", v === 0xff00 ? "FF00 = ON" : v === 0 ? "0000 = OFF" : `0x${hex4(v)} (ค่าไม่ถูกต้อง ต้องเป็น FF00 หรือ 0000)`);
      res.warnings.push("fc 05 request และ response มีรูปแบบเหมือนกัน (อุปกรณ์ตอบกลับด้วย frame เดิม)");
    } else if (fc === 6) {
      f(2, 2, "Register address", `${u16(bytes, 2)}`);
      const v = u16(bytes, 4);
      f(4, 2, "Value", `${v} (int16 ${v > 32767 ? v - 65536 : v})`);
      res.registers = [v];
      res.warnings.push("fc 06 request และ response มีรูปแบบเหมือนกัน (อุปกรณ์ตอบกลับด้วย frame เดิม)");
    } else if (fc === 15 || fc === 16) {
      f(2, 2, "Start address", `${u16(bytes, 2)}`);
      f(4, 2, "Quantity", `${u16(bytes, 4)}`);
      if (detected === "request") {
        const bc = bytes[6];
        f(6, 1, "Byte count", String(bc));
        const data = bytes.subarray(7, Math.min(7 + bc, n - 2));
        f(7, data.length, "Data", fc === 15 ? "สถานะ coil (LSB ก่อน)" : `${Math.floor(data.length / 2)} register`);
        if (n !== 9 + bc) res.warnings.push(`byte count = ${bc} แต่ข้อมูลจริงยาว ${n - 9} ไบต์`);
        if (fc === 15) {
          res.bits = [];
          const q = u16(bytes, 4);
          for (let i = 0; i < q && i < data.length * 8; i++) res.bits.push((data[i >> 3] >> (i & 7)) & 1);
        } else {
          res.registers = [];
          for (let i = 0; i + 1 < data.length; i += 2) res.registers.push((data[i] << 8) | data[i + 1]);
        }
      }
    }
  }
  f(bytes.length - 2, 2, "CRC16", res.crcOk ? `ถูกต้อง (0x${hex4(got)})` : `ผิด ได้ ${hex2(got & 0xff)} ${hex2(got >> 8)} ที่ถูกคือ ${hex2(calc & 0xff)} ${hex2(calc >> 8)}`);
  return res;
}

// Pair registers into 32-bit values. order "ABCD" = high word first, "CDAB" = low word first.
export function pairRegisters(regs, order = "ABCD") {
  const out = [];
  const dv = new DataView(new ArrayBuffer(4));
  for (let i = 0; i + 1 < regs.length; i += 2) {
    const [hi, lo] = order === "ABCD" ? [regs[i], regs[i + 1]] : [regs[i + 1], regs[i]];
    dv.setUint16(0, hi);
    dv.setUint16(2, lo);
    out.push({ index: i, u32: dv.getUint32(0), i32: dv.getInt32(0), f32: dv.getFloat32(0) });
  }
  return out;
}

// ---------------- serial transaction helpers ----------------
// Expected byte length of a normal (non-exception) RTU response to a request frame.
export function expectedResponseLength(req) {
  const fc = req[1];
  const qty = (req[4] << 8) | req[5];
  if (fc === 1 || fc === 2) return 5 + Math.ceil(qty / 8);
  if (fc === 3 || fc === 4) return 5 + 2 * qty;
  if (fc === 5 || fc === 6 || fc === 15 || fc === 16) return 8;
  return 0; // unknown function: rely on the silence timeout
}

// Is the received buffer a complete reply? Exceptions are always 5 bytes.
export function responseComplete(req, buf) {
  if (buf.length >= 2 && buf[1] === (req[1] | 0x80)) return buf.length >= 5;
  const need = expectedResponseLength(req);
  return need > 0 && buf.length >= need;
}

// Modbus RTU inter-frame silence (3.5 characters, 11 bits per char), at least 1.75 ms per the spec above 19200 baud.
export function t35ms(baud) {
  return baud > 19200 ? 1.75 : (3.5 * 11 * 1000) / baud;
}
