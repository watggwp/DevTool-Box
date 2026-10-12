import { $, showErr } from "/assets/js/common.js";

// TFT_eSPI predefined 16-bit colours (from TFT_eSPI.h)
const TFT = [
  ["TFT_BLACK", 0x0000], ["TFT_NAVY", 0x000F], ["TFT_DARKGREEN", 0x03E0], ["TFT_DARKCYAN", 0x03EF],
  ["TFT_MAROON", 0x7800], ["TFT_PURPLE", 0x780F], ["TFT_OLIVE", 0x7BE0], ["TFT_LIGHTGREY", 0xD69A],
  ["TFT_DARKGREY", 0x7BEF], ["TFT_BLUE", 0x001F], ["TFT_GREEN", 0x07E0], ["TFT_CYAN", 0x07FF],
  ["TFT_RED", 0xF800], ["TFT_MAGENTA", 0xF81F], ["TFT_YELLOW", 0xFFE0], ["TFT_WHITE", 0xFFFF],
  ["TFT_ORANGE", 0xFDA0], ["TFT_GREENYELLOW", 0xB7E0], ["TFT_PINK", 0xFE19], ["TFT_BROWN", 0x9A60],
  ["TFT_GOLD", 0xFEA0], ["TFT_SILVER", 0xC618], ["TFT_SKYBLUE", 0x867D], ["TFT_VIOLET", 0x915C],
];

const hex2 = (n) => n.toString(16).padStart(2, "0").toUpperCase();
const hex4 = (n) => n.toString(16).padStart(4, "0").toUpperCase();
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const to565 = (r, g, b) => ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3);
function from565(v) {
  const r5 = (v >> 11) & 0x1f, g6 = (v >> 5) & 0x3f, b5 = v & 0x1f;
  return [(r5 << 3) | (r5 >> 2), (g6 << 2) | (g6 >> 4), (b5 << 3) | (b5 >> 2)];
}
const swap16 = (v) => ((v & 0xff) << 8) | (v >> 8);

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}
function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}
function luminance(r, g, b) {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
const ratio = (l1, l2) => (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

function parseHex(s) {
  let t = s.trim().replace(/^#|^0x/i, "");
  if (/^[0-9a-f]{3}$/i.test(t)) t = t.split("").map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(t)) return null;
  const n = parseInt(t, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

let rgb = [255, 136, 0];

function update(source) {
  showErr("#cErr");
  const [r, g, b] = rgb;
  const hex = `#${hex2(r)}${hex2(g)}${hex2(b)}`;
  const v565 = to565(r, g, b);
  const q = from565(v565);
  const [h, s, l] = rgbToHsl(r, g, b);

  if (source !== "picker") $("#cPicker").value = hex.toLowerCase();
  if (source !== "hex") $("#cHex").value = hex;
  if (source !== "565") $("#c565").value = "0x" + hex4(v565);
  if (source !== "rgb") { $("#cR").value = r; $("#cG").value = g; $("#cB").value = b; }
  if (source !== "hsl") { $("#cH").value = h; $("#cS").value = s; $("#cL").value = l; }

  $("#cSwatch").style.background = hex;
  $("#cSwatch565").style.background = `rgb(${q[0]},${q[1]},${q[2]})`;

  const rows = [
    ["HEX", hex],
    ["RGB", `rgb(${r}, ${g}, ${b})`],
    ["HSL", `hsl(${h}, ${s}%, ${l}%)`],
    ["RGB888", `0x${hex2(r)}${hex2(g)}${hex2(b)}`],
    ["BGR888", `0x${hex2(b)}${hex2(g)}${hex2(r)}`],
    ["RGB565", `0x${hex4(v565)}`],
    ["RGB565 (dec)", String(v565)],
    ["RGB565 swapped", `0x${hex4(swap16(v565))}`],
    ["RGB565 bytes", `0x${hex2(v565 >> 8)}, 0x${hex2(v565 & 0xff)}`],
    ["C / Arduino", `#define MY_COLOR 0x${hex4(v565)}  // RGB565`],
    ["RGB565 -> 888", `#${hex2(q[0])}${hex2(q[1])}${hex2(q[2])}`],
  ];
  $("#cOut").innerHTML = rows.map(([k, v]) => `<tr><th>${k}</th><td class="mono copyable">${v}</td></tr>`).join("");

  const L = luminance(r, g, b);
  const cw = ratio(L, 1), cb = ratio(L, 0);
  const grade = (c) => (c >= 7 ? "AAA" : c >= 4.5 ? "AA" : c >= 3 ? "AA ตัวใหญ่" : "ไม่ผ่าน");
  const w = $("#cOnWhite"), k = $("#cOnBlack");
  w.style.cssText = `background:#fff;color:${hex}`;
  k.style.cssText = `background:#000;color:${hex}`;
  w.innerHTML = `<strong>Aa บนขาว</strong><span>${cw.toFixed(2)} : 1 / ${grade(cw)}</span>`;
  k.innerHTML = `<strong>Aa บนดำ</strong><span>${cb.toFixed(2)} : 1 / ${grade(cb)}</span>`;
}

$("#cPicker").addEventListener("input", (e) => { rgb = parseHex(e.target.value); update("picker"); });
$("#cHex").addEventListener("input", (e) => {
  const v = parseHex(e.target.value);
  if (!v) { showErr("#cErr", "HEX ไม่ถูกต้อง ใช้รูปแบบ #RRGGBB หรือ #RGB"); return; }
  rgb = v; update("hex");
});
$("#c565").addEventListener("input", (e) => {
  const t = e.target.value.trim();
  let v = /^0x/i.test(t) || /[a-f]/i.test(t) ? parseInt(t.replace(/^0x/i, ""), 16) : parseInt(t, 10);
  if (!Number.isFinite(v) || v < 0 || v > 0xffff || !/^(0x)?[0-9a-f]{1,5}$/i.test(t)) { showErr("#cErr", "RGB565 ต้องเป็น 0x0000 - 0xFFFF หรือเลขฐานสิบ 0 - 65535"); return; }
  rgb = from565(v); update("565");
});
for (const id of ["#cR", "#cG", "#cB"]) {
  $(id).addEventListener("input", () => {
    rgb = [$("#cR"), $("#cG"), $("#cB")].map((el) => clamp(Math.round(Number(el.value) || 0), 0, 255));
    update("rgb");
  });
}
for (const id of ["#cH", "#cS", "#cL"]) {
  $(id).addEventListener("input", () => {
    rgb = hslToRgb(Number($("#cH").value) || 0, clamp(Number($("#cS").value) || 0, 0, 100), clamp(Number($("#cL").value) || 0, 0, 100));
    update("hsl");
  });
}

// TFT_eSPI palette
const grid = $("#cTft");
for (const [name, v] of TFT) {
  const [r, g, b] = from565(v);
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "tft-chip";
  btn.title = `${name} = 0x${hex4(v)}`;
  btn.innerHTML = `<span class="tft-dot" style="background:rgb(${r},${g},${b})"></span><span class="tft-name">${name.replace("TFT_", "")}</span><span class="tft-val">0x${hex4(v)}</span>`;
  btn.addEventListener("click", () => { rgb = [r, g, b]; update(); });
  grid.appendChild(btn);
}

update();
