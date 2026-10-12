import { $, $$, showErr } from "/assets/js/common.js";

// ---------- colour tables ----------
const COLORS = [
  { k: "black", th: "ดำ", css: "#1b1b1b", d: 0, m: 1, tc: 250 },
  { k: "brown", th: "น้ำตาล", css: "#7a4a24", d: 1, m: 10, tol: 1, tc: 100 },
  { k: "red", th: "แดง", css: "#d32f2f", d: 2, m: 100, tol: 2, tc: 50 },
  { k: "orange", th: "ส้ม", css: "#f57c00", d: 3, m: 1e3, tc: 15 },
  { k: "yellow", th: "เหลือง", css: "#fbc02d", d: 4, m: 1e4, tc: 25 },
  { k: "green", th: "เขียว", css: "#2e7d32", d: 5, m: 1e5, tol: 0.5, tc: 20 },
  { k: "blue", th: "น้ำเงิน", css: "#1565c0", d: 6, m: 1e6, tol: 0.25, tc: 10 },
  { k: "violet", th: "ม่วง", css: "#7b1fa2", d: 7, m: 1e7, tol: 0.1, tc: 5 },
  { k: "grey", th: "เทา", css: "#8e8e8e", d: 8, m: 1e8, tol: 0.05, tc: 1 },
  { k: "white", th: "ขาว", css: "#f5f5f5", d: 9, m: 1e9 },
  { k: "gold", th: "ทอง", css: "#c9a227", m: 0.1, tol: 5 },
  { k: "silver", th: "เงิน", css: "#b8bec4", m: 0.01, tol: 10 },
  { k: "none", th: "ไม่มี", css: "transparent", tol: 20 },
];
const byKey = Object.fromEntries(COLORS.map((c) => [c.k, c]));

const E12 = [10, 12, 15, 18, 22, 27, 33, 39, 47, 56, 68, 82];
const E24 = [10, 11, 12, 13, 15, 16, 18, 20, 22, 24, 27, 30, 33, 36, 39, 43, 47, 51, 56, 62, 68, 75, 82, 91];
const E96 = [100, 102, 105, 107, 110, 113, 115, 118, 121, 124, 127, 130, 133, 137, 140, 143, 147, 150, 154, 158, 162, 165, 169, 174, 178, 182, 187, 191, 196, 200, 205, 210, 215, 221, 226, 232, 237, 243, 249, 255, 261, 267, 274, 280, 287, 294, 301, 309, 316, 324, 332, 340, 348, 357, 365, 374, 383, 392, 402, 412, 422, 432, 442, 453, 464, 475, 487, 499, 511, 523, 536, 549, 562, 576, 590, 604, 619, 634, 649, 665, 681, 698, 715, 732, 750, 768, 787, 806, 825, 845, 866, 887, 909, 931, 953, 976];

// ---------- helpers ----------
function fmtOhm(v) {
  if (!Number.isFinite(v)) return "-";
  const a = Math.abs(v);
  const [div, u] = a >= 1e9 ? [1e9, "GΩ"] : a >= 1e6 ? [1e6, "MΩ"] : a >= 1e3 ? [1e3, "kΩ"] : [1, "Ω"];
  return `${+(v / div).toPrecision(4)} ${u}`;
}
const fmt = (v, unit, p = 4) => (Number.isFinite(v) ? `${+v.toPrecision(p)} ${unit}` : "-");

// Accepts 4.7k, 4k7, 470R, 0R47, 1M, 2.2meg, 10 ohm
export function parseOhm(str) {
  let s = String(str).trim().toLowerCase().replace(/\s|ω|ohms?/g, "").replace(/meg/, "m");
  if (!s) return NaN;
  const mult = { r: 1, k: 1e3, m: 1e6, g: 1e9 };
  let m = s.match(/^(\d+)([rkmg])(\d+)$/); // 4k7, 0r47
  if (m) return parseFloat(`${m[1]}.${m[3]}`) * mult[m[2]];
  m = s.match(/^(\d*\.?\d+)([rkmg])?$/);
  if (m) return parseFloat(m[1]) * (m[2] ? mult[m[2]] : 1);
  return NaN;
}

function nearest(v, series) {
  if (!(v > 0)) return NaN;
  const base = series[0] >= 100 ? 100 : 10;
  const dec = Math.floor(Math.log10(v)) - Math.log10(base) + 1;
  let best = NaN, bestErr = Infinity;
  for (let d = dec - 2; d <= dec + 1; d++) {
    for (const s of series) {
      const c = s * 10 ** d;
      const err = Math.abs(Math.log(c / v));
      if (err < bestErr) { bestErr = err; best = c; }
    }
  }
  return +best.toPrecision(3);
}
function nextUp(v, series) {
  if (!(v > 0)) return NaN;
  const base = series[0] >= 100 ? 100 : 10;
  const dec = Math.floor(Math.log10(v)) - Math.log10(base) + 1;
  const cands = [];
  for (let d = dec - 1; d <= dec + 1; d++) for (const s of series) cands.push(+(s * 10 ** d).toPrecision(3));
  return cands.filter((c) => c >= v * 0.9999).sort((a, b) => a - b)[0];
}

// ---------- band -> value ----------
const bandSel = $("#bandSelects");
let nBands = 4;

function bandSpec(n) {
  // returns list of [role, options]
  const digit = COLORS.filter((c) => c.d !== undefined);
  const mult = COLORS.filter((c) => c.m !== undefined);
  const tol = COLORS.filter((c) => c.tol !== undefined && (n !== 4 || c.k !== "none" || true));
  const tc = COLORS.filter((c) => c.tc !== undefined);
  const digits = n === 4 ? 2 : 3;
  const spec = [];
  for (let i = 0; i < digits; i++) spec.push([`หลักที่ ${i + 1}`, i === 0 ? digit.filter((c) => c.d > 0) : digit]);
  spec.push(["ตัวคูณ", mult]);
  spec.push(["ความคลาดเคลื่อน", tol]);
  if (n === 6) spec.push(["Temp. coeff.", tc]);
  return spec;
}
const DEFAULTS = { 4: ["yellow", "violet", "red", "gold"], 5: ["yellow", "violet", "black", "brown", "brown"], 6: ["yellow", "violet", "black", "brown", "brown", "red"] };

function buildSelects() {
  const spec = bandSpec(nBands);
  bandSel.innerHTML = "";
  spec.forEach(([label, opts], i) => {
    const wrap = document.createElement("label");
    wrap.textContent = label;
    const sel = document.createElement("select");
    sel.dataset.idx = i;
    for (const c of opts) {
      const o = document.createElement("option");
      o.value = c.k;
      o.textContent = `${c.th} (${c.k})`;
      sel.appendChild(o);
    }
    sel.value = DEFAULTS[nBands][i];
    sel.addEventListener("change", calcBands);
    const dot = document.createElement("span");
    dot.className = "band-dot";
    wrap.prepend(dot);
    wrap.appendChild(sel);
    bandSel.appendChild(wrap);
  });
  calcBands();
}

function drawBands(keys) {
  const g = $("#resBands");
  const n = keys.length;
  // body x range 85..315; place digit bands left, tolerance band at right
  const xs = n === 4 ? [100, 140, 180, 290] : n === 5 ? [98, 130, 162, 194, 290] : [98, 128, 158, 188, 270, 300];
  g.innerHTML = keys.map((k, i) => {
    const c = byKey[k];
    const tall = xs[i] < 125 || xs[i] > 275;
    const y = tall ? 10 : 18, h = tall ? 70 : 54;
    return c.k === "none" ? "" : `<rect x="${xs[i]}" y="${y}" width="16" height="${h}" fill="${c.css}" stroke="rgba(0,0,0,.25)" stroke-width="1"/>`;
  }).join("");
}

function calcBands() {
  const sels = $$("select", bandSel);
  const keys = sels.map((s) => s.value);
  sels.forEach((s) => { s.parentElement.querySelector(".band-dot").style.background = byKey[s.value].css; });
  drawBands(keys);
  const digits = nBands === 4 ? 2 : 3;
  let base = 0;
  for (let i = 0; i < digits; i++) base = base * 10 + byKey[keys[i]].d;
  const value = base * byKey[keys[digits]].m;
  const tol = byKey[keys[digits + 1]].tol;
  const tc = nBands === 6 ? byKey[keys[5]].tc : null;
  const lo = value * (1 - tol / 100), hi = value * (1 + tol / 100);
  $("#resResult").innerHTML = `<div class="res-value">${fmtOhm(value)} <span>±${tol}%</span></div>
    <div class="muted">ช่วงค่าจริง ${fmtOhm(lo)} ถึง ${fmtOhm(hi)}${tc ? ` / ${tc} ppm/K` : ""} / ${keys.map((k) => byKey[k].th).join(" - ")}</div>`;
}

$$('input[name="bands"]').forEach((r) => r.addEventListener("change", () => { nBands = Number(r.value); buildSelects(); }));

// ---------- value -> bands ----------
function bandsFor(v, digits) {
  if (!(v > 0)) return null;
  // round to `digits` significant figures
  let exp = Math.floor(Math.log10(v)) - (digits - 1);
  let sig = Math.round(v / 10 ** exp);
  if (sig >= 10 ** digits) { sig /= 10; exp++; }
  if (exp < -2 || exp > 9) return null;
  const ds = String(sig).padStart(digits, "0").split("").map(Number);
  const mul = COLORS.find((c) => c.m !== undefined && Math.abs(Math.log10(c.m) - exp) < 1e-9);
  if (!mul || ds[0] === 0) return null;
  return { cols: [...ds.map((d) => COLORS.find((c) => c.d === d)), mul], exact: sig * 10 ** exp };
}
const chips = (cols) => cols.map((c) => `<span class="cchip"><i style="background:${c.css}"></i>${c.th}</span>`).join("");

function calcReverse() {
  const v = parseOhm($("#revIn").value);
  const out = $("#revOut");
  if (!(v > 0)) { out.innerHTML = `<tr><td class="muted">กรอกค่า เช่น 4.7k, 330, 1M</td></tr>`; return; }
  const b4 = bandsFor(v, 2), b5 = bandsFor(v, 3);
  const rows = [
    ["ค่าที่กรอก", fmtOhm(v)],
    ["4 แถบ (±5% ทอง)", b4 ? `${chips(b4.cols)} <span class="muted">= ${fmtOhm(b4.exact)}</span>` : "-"],
    ["5 แถบ (±1% น้ำตาล)", b5 ? `${chips(b5.cols)} <span class="muted">= ${fmtOhm(b5.exact)}</span>` : "-"],
    ["ใกล้สุด E12", fmtOhm(nearest(v, E12))],
    ["ใกล้สุด E24", fmtOhm(nearest(v, E24))],
    ["ใกล้สุด E96", fmtOhm(nearest(v, E96))],
  ];
  out.innerHTML = rows.map(([k, val]) => `<tr><th>${k}</th><td>${val}</td></tr>`).join("");
}
$("#revIn").addEventListener("input", calcReverse);

// ---------- LED ----------
const WATTS = [0.125, 0.25, 0.5, 1, 2, 3, 5, 10];
function calcLed() {
  const vs = Number($("#ledVs").value), vf = Number($("#ledVf").value), ma = Number($("#ledI").value), n = Math.max(1, Math.round(Number($("#ledN").value) || 1));
  const out = $("#ledOut");
  const drop = vs - vf * n;
  if (!(ma > 0) || !(vs > 0)) { out.innerHTML = `<tr><td class="muted">กรอกแรงดันและกระแส</td></tr>`; return; }
  if (drop <= 0) { out.innerHTML = `<tr><td class="err-text">แรงดันไม่พอ: ${n} LED ต้องการอย่างน้อย ${fmt(vf * n, "V")} แต่ไฟเลี้ยงมี ${fmt(vs, "V")}</td></tr>`; return; }
  const i = ma / 1000;
  const r = drop / i;
  const rows = [["R ที่คำนวณได้", fmtOhm(r)]];
  for (const [name, s] of [["E12", E12], ["E24", E24]]) {
    const rs = nextUp(r, s);
    const ia = drop / rs, p = ia * ia * rs;
    const w = WATTS.find((x) => x >= p * 2) ?? "> 10";
    rows.push([`มาตรฐาน ${name} (ปัดขึ้น)`, `${fmtOhm(rs)} <span class="muted">/ กระแสจริง ${fmt(ia * 1000, "mA", 3)} / กำลัง ${fmt(p * 1000, "mW", 3)} / ใช้ ${w} W ขึ้นไป</span>`]);
  }
  rows.push(["กำลังรวมที่ LED", fmt(vf * n * i * 1000, "mW", 3)]);
  out.innerHTML = rows.map(([k, val]) => `<tr><th>${k}</th><td>${val}</td></tr>`).join("");
}
["#ledVs", "#ledVf", "#ledI", "#ledN"].forEach((s) => $(s).addEventListener("input", calcLed));
$("#ledPreset").addEventListener("change", (e) => { if (e.target.value) { $("#ledVf").value = e.target.value; calcLed(); } });

// ---------- voltage divider ----------
function calcDivider() {
  const vin = Number($("#dvVin").value), r1 = parseOhm($("#dvR1").value), r2 = parseOhm($("#dvR2").value);
  const target = $("#dvTarget").value === "" ? NaN : Number($("#dvTarget").value);
  const rows = [];
  if (vin > 0 && r1 > 0 && r2 > 0) {
    const vout = (vin * r2) / (r1 + r2), i = vin / (r1 + r2);
    rows.push(["Vout", `<strong>${fmt(vout, "V")}</strong>`], ["อัตราส่วน", `${+(r2 / (r1 + r2)).toPrecision(4)}`], ["กระแส", fmt(i * 1000, "mA", 3)], ["กำลังรวม", fmt(vin * i * 1000, "mW", 3)]);
  }
  if (Number.isFinite(target)) {
    if (vin > 0 && r1 > 0 && target > 0 && target < vin) {
      const need = (r1 * target) / (vin - target);
      const e24 = nearest(need, E24);
      rows.push(["R2 สำหรับ Vout เป้าหมาย", `${fmtOhm(need)} <span class="muted">/ E24 ใกล้สุด ${fmtOhm(e24)} ให้ ${fmt((vin * e24) / (r1 + e24), "V")}</span>`]);
    } else rows.push(["R2 สำหรับ Vout เป้าหมาย", `<span class="err-text">Vout ต้องมากกว่า 0 และน้อยกว่า Vin</span>`]);
  }
  $("#dvOut").innerHTML = rows.length ? rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join("") : `<tr><td class="muted">กรอก Vin, R1, R2</td></tr>`;
}
["#dvVin", "#dvR1", "#dvR2", "#dvTarget"].forEach((s) => $(s).addEventListener("input", calcDivider));

// ---------- Ohm's law ----------
function calcOhm() {
  showErr("#resErr");
  const get = (id) => ($(id).value.trim() === "" ? NaN : Number($(id).value));
  let V = get("#ohV"), I = get("#ohI") / 1000, P = get("#ohP");
  let R = $("#ohR").value.trim() === "" ? NaN : parseOhm($("#ohR").value);
  const known = [V, I, R, P].filter(Number.isFinite).length;
  if (known < 2) { showErr("#resErr", "กรอกอย่างน้อย 2 ค่าในกฎของโอห์ม"); return; }
  if (Number.isFinite(V) && Number.isFinite(I)) { R = V / I; P = V * I; }
  else if (Number.isFinite(V) && Number.isFinite(R)) { I = V / R; P = (V * V) / R; }
  else if (Number.isFinite(V) && Number.isFinite(P)) { I = P / V; R = (V * V) / P; }
  else if (Number.isFinite(I) && Number.isFinite(R)) { V = I * R; P = I * I * R; }
  else if (Number.isFinite(I) && Number.isFinite(P)) { V = P / I; R = P / (I * I); }
  else if (Number.isFinite(R) && Number.isFinite(P)) { V = Math.sqrt(P * R); I = Math.sqrt(P / R); }
  $("#ohOut").innerHTML = [["V", fmt(V, "V")], ["I", fmt(I * 1000, "mA")], ["R", fmtOhm(R)], ["P", `${fmt(P, "W")} <span class="muted">(${fmt(P * 1000, "mW")})</span>`]]
    .map(([k, v]) => `<tr><th>${k}</th><td class="mono">${v}</td></tr>`).join("");
}
$("#ohCalc").addEventListener("click", calcOhm);
$("#ohClear").addEventListener("click", () => { ["#ohV", "#ohI", "#ohR", "#ohP"].forEach((s) => ($(s).value = "")); $("#ohOut").innerHTML = ""; showErr("#resErr"); });

buildSelects();
calcReverse();
calcLed();
calcDivider();
