import { $, showErr, download, enc, dec, bytesToBase64, base64ToBytes, fmtBytes } from "/assets/js/common.js";

const inp = $("#b64In"), out = $("#b64Out");
let lastFileName = "";

function updateLen() {
  $("#b64InLen").textContent = `${inp.value.length} ตัวอักษร / ${enc.encode(inp.value).length} bytes`;
  $("#b64OutLen").textContent = `${out.value.length} ตัวอักษร`;
}
inp.addEventListener("input", updateLen);
out.addEventListener("input", updateLen);

$("#b64Encode").addEventListener("click", () => {
  showErr("#b64Err");
  out.value = bytesToBase64(enc.encode(inp.value), $("#b64UrlSafe").checked);
  updateLen();
});

$("#b64Decode").addEventListener("click", () => {
  try {
    showErr("#b64Err");
    const bytes = base64ToBytes(out.value);
    inp.value = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    updateLen();
  } catch (e) {
    if (e instanceof TypeError) showErr("#b64Err", "ถอดรหัสได้แต่ไม่ใช่ข้อความ UTF-8 ที่ถูกต้อง ลองใช้ปุ่ม \"ถอดรหัสเป็นไฟล์\" แทน");
    else showErr("#b64Err", "Base64 ไม่ถูกต้อง: " + e.message);
  }
});

$("#b64File").addEventListener("change", async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  showErr("#b64Err");
  lastFileName = f.name;
  const bytes = new Uint8Array(await f.arrayBuffer());
  out.value = bytesToBase64(bytes, $("#b64UrlSafe").checked);
  inp.value = `[ไฟล์: ${f.name}, ${fmtBytes(bytes.length)}, ${f.type || "unknown type"}]`;
  updateLen();
  e.target.value = "";
});

$("#b64DownloadBin").addEventListener("click", () => {
  try {
    showErr("#b64Err");
    const bytes = base64ToBytes(out.value);
    download(lastFileName ? "decoded-" + lastFileName : "decoded.bin", bytes);
  } catch (e) {
    showErr("#b64Err", "Base64 ไม่ถูกต้อง: " + e.message);
  }
});
