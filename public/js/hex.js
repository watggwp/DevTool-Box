import { $, showErr, enc, bytesToHex, hexToBytes } from "/js/common.js";

const txt = $("#hexText"), out = $("#hexOut");
const SEPS = { space: " ", none: "", comma: ", ", bsx: "\\x", "0x": " 0x" };

function fmt(bytes) {
  const sep = $("#hexSep").value, upper = $("#hexUpper").checked;
  if (sep === "bsx") return bytes.length ? "\\x" + bytesToHex(bytes, "\\x", upper) : "";
  if (sep === "0x") return bytes.length ? "0x" + bytesToHex(bytes, " 0x", upper) : "";
  return bytesToHex(bytes, SEPS[sep], upper);
}

function dump(bytes) {
  const lines = [];
  for (let i = 0; i < bytes.length; i += 16) {
    const chunk = bytes.subarray(i, i + 16);
    const hex = [...chunk].map((b) => b.toString(16).padStart(2, "0")).join(" ").padEnd(47);
    const ascii = [...chunk].map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : ".")).join("");
    lines.push(`${i.toString(16).padStart(8, "0")}  ${hex}  |${ascii}|`);
  }
  $("#hexDump").textContent = lines.join("\n");
  $("#hexCount").textContent = bytes.length ? `${bytes.length} bytes` : "";
}

$("#hexToHex").addEventListener("click", () => {
  showErr("#hexErr");
  const bytes = enc.encode(txt.value);
  out.value = fmt(bytes);
  dump(bytes);
});

$("#hexToText").addEventListener("click", () => {
  try {
    showErr("#hexErr");
    const bytes = hexToBytes(out.value);
    txt.value = new TextDecoder().decode(bytes);
    dump(bytes);
  } catch (e) { showErr("#hexErr", e.message); }
});

$("#hexSep").addEventListener("change", () => { if (txt.value) $("#hexToHex").click(); });
$("#hexUpper").addEventListener("change", () => { if (txt.value) $("#hexToHex").click(); });
