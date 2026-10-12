// Pure cron parser / scheduler / Thai explainer (no DOM). Used by cron.js and by Node tests.

const MONTH_NAMES = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const DOW_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
export const TH_MONTHS = ["", "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
export const TH_DOW = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

export const FIELDS = [
  { key: "second", name: "วินาที", unit: "วินาที", min: 0, max: 59 },
  { key: "minute", name: "นาที", unit: "นาที", min: 0, max: 59 },
  { key: "hour", name: "ชั่วโมง", unit: "ชั่วโมง", min: 0, max: 23 },
  { key: "dom", name: "วันที่ของเดือน", unit: "วัน", min: 1, max: 31 },
  { key: "month", name: "เดือน", unit: "เดือน", min: 1, max: 12, names: MONTH_NAMES, nameBase: 1 },
  { key: "dow", name: "วันในสัปดาห์", unit: "วัน", min: 0, max: 7, starMax: 6, names: DOW_NAMES, nameBase: 0 },
];
const FIELD = Object.fromEntries(FIELDS.map((f) => [f.key, f]));

export const MACROS = {
  "@yearly": "0 0 1 1 *",
  "@annually": "0 0 1 1 *",
  "@monthly": "0 0 1 * *",
  "@weekly": "0 0 * * 0",
  "@daily": "0 0 * * *",
  "@midnight": "0 0 * * *",
  "@hourly": "0 * * * *",
};

export class CronError extends Error {}

function parseValue(s, f) {
  const up = s.toUpperCase();
  if (f.names) {
    const i = f.names.indexOf(up);
    if (i >= 0) return i + f.nameBase;
  }
  if (!/^\d+$/.test(s)) {
    if (/^(L|LW|\d+W|\d+#\d+|\d*L)$/i.test(s)) throw new CronError(`${f.name}: ไม่รองรับ "${s}" (L / W / # เป็นรูปแบบของ Quartz ไม่ใช่ cron มาตรฐาน)`);
    throw new CronError(`${f.name}: "${s}" ไม่ใช่ตัวเลขหรือชื่อที่รู้จัก`);
  }
  const n = Number(s);
  if (n < f.min || n > f.max) throw new CronError(`${f.name}: ค่า ${n} อยู่นอกช่วง ${f.min}-${f.max}`);
  return n;
}

function parseItem(item, f) {
  const m = item.match(/^([^/]+)(?:\/(\d+))?$/);
  if (!m) throw new CronError(`${f.name}: รูปแบบ "${item}" ไม่ถูกต้อง`);
  const [, rangePart, stepStr] = m;
  const step = stepStr === undefined ? 1 : Number(stepStr);
  if (step < 1) throw new CronError(`${f.name}: ค่า step ต้องมากกว่า 0`);
  let lo, hi;
  if (rangePart === "*" || ((rangePart === "?") && (f.key === "dom" || f.key === "dow"))) {
    lo = f.min; hi = f.starMax ?? f.max;
  } else if (rangePart.includes("-")) {
    const bits = rangePart.split("-");
    if (bits.length !== 2 || !bits[0] || !bits[1]) throw new CronError(`${f.name}: ช่วง "${rangePart}" ไม่ถูกต้อง`);
    lo = parseValue(bits[0], f); hi = parseValue(bits[1], f);
    if (lo > hi) throw new CronError(`${f.name}: ช่วง ${rangePart} ไม่ถูกต้อง (ค่าเริ่มต้นมากกว่าค่าสิ้นสุด)`);
  } else {
    lo = parseValue(rangePart, f);
    hi = stepStr !== undefined ? (f.starMax ?? f.max) : lo;
  }
  return { lo, hi, step, star: rangePart === "*" || rangePart === "?" };
}

function parseField(str, f) {
  const set = new Set();
  if (str === "") throw new CronError(`${f.name}: ว่างเปล่า`);
  for (const item of str.split(",")) {
    if (item === "") throw new CronError(`${f.name}: มีเครื่องหมาย , เกินมา`);
    const { lo, hi, step } = parseItem(item, f);
    for (let v = lo; v <= hi; v += step) set.add(v);
  }
  return set;
}

export function parseCron(input) {
  let expr = String(input).trim().replace(/\s+/g, " ");
  if (!expr) throw new CronError("กรุณาใส่ cron expression");
  const lower = expr.toLowerCase();
  if (lower === "@reboot") return { reboot: true, macro: "@reboot", expr };
  let macro = null;
  if (lower.startsWith("@")) {
    if (!MACROS[lower]) throw new CronError(`ไม่รู้จัก macro "${expr}" (รองรับ ${Object.keys(MACROS).join(", ")}, @reboot)`);
    macro = lower;
    expr = MACROS[lower];
  }
  const parts = expr.split(" ");
  if (parts.length !== 5 && parts.length !== 6) throw new CronError(`ต้องมี 5 ฟิลด์ (หรือ 6 ฟิลด์ถ้ามีวินาที) แต่พบ ${parts.length} ฟิลด์`);
  const hasSeconds = parts.length === 6;
  const defs = hasSeconds ? FIELDS : FIELDS.slice(1);
  const p = { hasSeconds, macro, expr, raw: {}, sets: {} };
  defs.forEach((f, i) => { p.raw[f.key] = parts[i]; p.sets[f.key] = parseField(parts[i], f); });
  if (!hasSeconds) { p.raw.second = "0"; p.sets.second = new Set([0]); }
  if (p.sets.dow.has(7)) { p.sets.dow.delete(7); p.sets.dow.add(0); }
  // Vixie cron rule: a field "starts with *" counts as unrestricted for the DOM/DOW OR-rule.
  p.domStar = /^[*?]/.test(p.raw.dom);
  p.dowStar = /^[*?]/.test(p.raw.dow);
  return p;
}

function dayMatch(p, d) {
  const domM = p.sets.dom.has(d.getDate());
  const dowM = p.sets.dow.has(d.getDay());
  return p.domStar || p.dowStar ? domM && dowM : domM || dowM;
}

// Next `count` run times after `from` (local time). Searches up to ~5 years ahead.
export function nextRuns(p, from = new Date(), count = 10) {
  if (p.reboot) return [];
  const d = new Date(from.getTime());
  d.setMilliseconds(0);
  d.setSeconds(d.getSeconds() + 1);
  const res = [];
  const limitYear = from.getFullYear() + 5;
  let guard = 0;
  while (res.length < count && guard++ < 1_000_000) {
    if (d.getFullYear() > limitYear) break;
    if (!p.sets.month.has(d.getMonth() + 1)) { d.setMonth(d.getMonth() + 1, 1); d.setHours(0, 0, 0); continue; }
    if (!dayMatch(p, d)) { d.setDate(d.getDate() + 1); d.setHours(0, 0, 0); continue; }
    if (!p.sets.hour.has(d.getHours())) { d.setHours(d.getHours() + 1, 0, 0); continue; }
    if (!p.sets.minute.has(d.getMinutes())) { d.setMinutes(d.getMinutes() + 1, 0); continue; }
    if (!p.sets.second.has(d.getSeconds())) { d.setSeconds(d.getSeconds() + 1); continue; }
    res.push(new Date(d.getTime()));
    d.setSeconds(d.getSeconds() + 1);
  }
  return res;
}

// ---------- Thai explanation ----------
const pad = (n) => String(n).padStart(2, "0");

function fmtVal(f, v) {
  if (f.key === "month") return TH_MONTHS[v];
  if (f.key === "dow") return TH_DOW[v % 7];
  return String(v);
}

function joinTh(list) {
  if (list.length <= 1) return list.join("");
  return list.slice(0, -1).join(", ") + " และ " + list[list.length - 1];
}

function itemDesc(item, f) {
  const m = item.match(/^([^/]+)(?:\/(\d+))?$/);
  const [, rangePart, stepStr] = m;
  const step = stepStr ? Number(stepStr) : 1;
  const unit = f.unit;
  if (rangePart === "*" || rangePart === "?") return stepStr ? `ทุก ${step} ${unit}` : `ทุก${unit}`;
  if (rangePart.includes("-")) {
    const [a, b] = rangePart.split("-");
    const A = fmtVal(f, parseValue(a, f)), B = fmtVal(f, parseValue(b, f));
    return stepStr ? `ทุก ${step} ${unit} ตั้งแต่ ${A} ถึง ${B}` : `${A} ถึง ${B}`;
  }
  const A = fmtVal(f, parseValue(rangePart, f));
  return stepStr ? `ทุก ${step} ${unit} เริ่มที่ ${A}` : A;
}

export function fieldDesc(raw, key) {
  const f = FIELD[key];
  return joinTh(raw.split(",").map((it) => itemDesc(it, f)));
}

const isNum = (s) => /^\d+$/.test(s);
const isAll = (s) => s === "*" || s === "?";

export function explain(p) {
  if (p.reboot) return "รันครั้งเดียวทุกครั้งที่เครื่องบูต (@reboot) จึงไม่มีเวลารันถัดไปที่คำนวณได้";
  const r = p.raw;
  const out = [];

  // time of day
  const secSingle = !p.hasSeconds || isNum(r.second);
  const hourList = /^\d+(,\d+)*$/.test(r.hour);
  if (isNum(r.minute) && hourList && secSingle) {
    const sec = p.hasSeconds && r.second !== "0" ? `:${pad(r.second)}` : "";
    const times = r.hour.split(",").map((h) => `${pad(h)}:${pad(r.minute)}${sec}`);
    out.push(`เวลา ${joinTh(times)} น.`);
  } else {
    if (p.hasSeconds) {
      if (r.second === "*") out.push("ทุกวินาที");
      else if (r.second.startsWith("*/")) out.push(fieldDesc(r.second, "second"));
      else out.push(`วินาทีที่ ${fieldDesc(r.second, "second")}`);
    }
    if (r.minute === "*") { if (!p.hasSeconds || r.second !== "*") out.push("ทุกนาที"); }
    else if (r.minute.startsWith("*/")) out.push(fieldDesc(r.minute, "minute"));
    else out.push(`นาทีที่ ${fieldDesc(r.minute, "minute")}`);

    if (r.hour === "*") { /* every hour */ }
    else if (r.hour.startsWith("*/")) out.push(fieldDesc(r.hour, "hour"));
    else out.push(`ในช่วง ${fieldDesc(r.hour, "hour")} นาฬิกา`);
  }

  // day
  const domAll = isAll(r.dom), dowAll = isAll(r.dow);
  const domText = domAll ? null : r.dom.startsWith("*/") ? fieldDesc(r.dom, "dom") : `วันที่ ${fieldDesc(r.dom, "dom")} ของเดือน`;
  const dowText = dowAll ? null : r.dow.startsWith("*/") ? fieldDesc(r.dow, "dow") : `ทุกวัน${fieldDesc(r.dow, "dow")}`;
  if (!domText && !dowText) out.push("ทุกวัน");
  else if (domText && dowText) {
    if (p.domStar || p.dowStar) out.push(`${domText} และ ${dowText}`);
    else out.push(`${domText} หรือ ${dowText} (ตรงข้อใดข้อหนึ่งก็รัน)`);
  } else out.push(domText || dowText);

  // month
  if (!isAll(r.month)) out.push(r.month.startsWith("*/") ? fieldDesc(r.month, "month") : `ในเดือน${fieldDesc(r.month, "month")}`);

  let s = out.join(" ");
  if (p.macro) s = `${p.macro} = "${p.expr}" คือ ${s}`;
  return s;
}

export function fieldRows(p) {
  if (p.reboot) return [];
  return FIELDS.filter((f) => f.key !== "second" || p.hasSeconds).map((f) => {
    const set = [...p.sets[f.key]].sort((a, b) => a - b);
    const full = (f.starMax ?? f.max) - f.min + 1;
    let values;
    if (set.length >= full) values = "ทั้งหมด";
    else {
      const shown = set.slice(0, 24).map((v) => fmtVal(f, v));
      values = shown.join(", ") + (set.length > 24 ? ` … (รวม ${set.length} ค่า)` : "");
    }
    return { name: f.name, raw: p.raw[f.key], range: f.names ? `${f.min}-${f.max} หรือ ${f.names[0]}-${f.names[f.names.length - 1]}` : `${f.min}-${f.max}`, values };
  });
}
