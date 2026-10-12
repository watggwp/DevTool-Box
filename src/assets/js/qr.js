import { $, $$, showErr, toast, download, enc } from "/assets/js/common.js";
import { encodeQR } from "/assets/js/qr-encoder.js";

const canvas = $("#qrCanvas");
let mode = "text";
let current = null; // last encoded result

// Escape special characters for the WIFI: payload (\ ; , : ")
const wifiEsc = (s) => s.replace(/([\\;,:"])/g, "\\$1");

function wifiPayload() {
  const sec = $("#wifiSec").value;
  const ssid = wifiEsc($("#wifiSsid").value);
  const pass = sec === "nopass" ? "" : wifiEsc($("#wifiPass").value);
  const hidden = $("#wifiHidden").checked ? "true" : "false";
  return `WIFI:T:${sec};S:${ssid};${sec === "nopass" ? "" : `P:${pass};`}H:${hidden};;`;
}

function payload() {
  if (mode === "wifi") {
    const p = wifiPayload();
    $("#wifiPayload").textContent = p;
    return $("#wifiSsid").value ? p : "";
  }
  return $("#qrText").value;
}

const num = (el, lo, hi, def) => {
  const v = Math.round(Number(el.value));
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def;
};

function render() {
  showErr("#qrErr");
  const text = payload();
  const ctx = canvas.getContext("2d");
  if (!text) {
    current = null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    $("#qrInfo").textContent = mode === "wifi" ? "กรอกชื่อ Wi-Fi เพื่อสร้าง QR" : "พิมพ์ข้อความเพื่อสร้าง QR";
    return;
  }
  try {
    const bytes = enc.encode(text);
    current = encodeQR(bytes, $("#qrEcl").value);
    current.bytes = bytes.length;
  } catch (e) {
    current = null;
    showErr("#qrErr", e.message);
    return;
  }
  const px = num($("#qrSize"), 64, 2048, 320);
  const margin = num($("#qrMargin"), 0, 16, 4);
  const total = current.size + margin * 2;
  const scale = Math.max(1, Math.floor(px / total));
  const dim = total * scale;
  canvas.width = canvas.height = dim;
  ctx.fillStyle = $("#qrBg").value;
  ctx.fillRect(0, 0, dim, dim);
  ctx.fillStyle = $("#qrFg").value;
  for (let y = 0; y < current.size; y++) {
    const row = current.modules[y];
    for (let x = 0; x < current.size; x++) if (row[x]) ctx.fillRect((x + margin) * scale, (y + margin) * scale, scale, scale);
  }
  $("#qrInfo").textContent = `Version ${current.version} (${current.size}x${current.size}) / ECC ${$("#qrEcl").value} / mask ${current.mask} / ${current.bytes} bytes / ภาพ ${dim}px`;
}

function toSvg() {
  if (!current) return "";
  const margin = num($("#qrMargin"), 0, 16, 4);
  const total = current.size + margin * 2;
  let path = "";
  for (let y = 0; y < current.size; y++) {
    for (let x = 0; x < current.size; x++) {
      if (!current.modules[y][x]) continue;
      let w = 1;
      while (x + w < current.size && current.modules[y][x + w]) w++;
      path += `M${x + margin} ${y + margin}h${w}v1h-${w}z`;
      x += w - 1;
    }
  }
  const fg = $("#qrFg").value, bg = $("#qrBg").value;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="${bg}"/><path d="${path}" fill="${fg}"/></svg>\n`;
}

let timer;
const schedule = () => { clearTimeout(timer); timer = setTimeout(render, 120); };

$$(".qr-tabs [data-mode]").forEach((b) => {
  b.addEventListener("click", () => {
    mode = b.dataset.mode;
    $$(".qr-tabs [data-mode]").forEach((x) => {
      const on = x === b;
      x.classList.toggle("primary", on);
      x.setAttribute("aria-selected", String(on));
    });
    $("#qrModeText").hidden = mode !== "text";
    $("#qrModeWifi").hidden = mode !== "wifi";
    render();
  });
});

["#qrText", "#wifiSsid", "#wifiPass", "#qrSize", "#qrMargin"].forEach((s) => $(s).addEventListener("input", schedule));
["#wifiSec", "#wifiHidden", "#qrEcl", "#qrFg", "#qrBg"].forEach((s) => $(s).addEventListener("input", render));
$("#wifiSec").addEventListener("change", () => { $("#wifiPass").disabled = $("#wifiSec").value === "nopass"; render(); });

$("#qrSwap").addEventListener("click", () => {
  const f = $("#qrFg").value;
  $("#qrFg").value = $("#qrBg").value;
  $("#qrBg").value = f;
  render();
});

$("#qrPng").addEventListener("click", () => {
  if (!current) { toast("ยังไม่มี QR code"); return; }
  canvas.toBlob((blob) => blob && download("qrcode.png", blob), "image/png");
});
$("#qrSvg").addEventListener("click", () => {
  if (!current) { toast("ยังไม่มี QR code"); return; }
  download("qrcode.svg", toSvg(), "image/svg+xml");
});
$("#qrCopy").addEventListener("click", () => {
  if (!current) { toast("ยังไม่มี QR code"); return; }
  if (!navigator.clipboard || typeof ClipboardItem === "undefined") { toast("เบราว์เซอร์นี้คัดลอกรูปไม่ได้ ใช้ดาวน์โหลดแทน"); return; }
  canvas.toBlob(async (blob) => {
    try { await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]); toast("คัดลอกรูปแล้ว"); }
    catch { toast("คัดลอกรูปไม่สำเร็จ"); }
  }, "image/png");
});

render();
