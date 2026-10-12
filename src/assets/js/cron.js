import { $, $$, showErr } from "/assets/js/common.js";
import { parseCron, nextRuns, explain, fieldRows } from "/assets/js/cron-core.js";

const inp = $("#cronIn");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

$("#cronTz").textContent = Intl.DateTimeFormat().resolvedOptions().timeZone;

function rel(d) {
  const s = (d.getTime() - Date.now()) / 1000;
  if (s < 60) return `อีก ${Math.max(0, Math.round(s))} วินาที`;
  if (s < 3600) return `อีก ${Math.round(s / 60)} นาที`;
  if (s < 86400) return `อีก ${(s / 3600).toFixed(1)} ชั่วโมง`;
  return `อีก ${(s / 86400).toFixed(1)} วัน`;
}

function run() {
  showErr("#cronErr");
  const legend = $(".cron-legend");
  let p;
  try { p = parseCron(inp.value); }
  catch (e) {
    showErr("#cronErr", e.message);
    $("#cronExplain").textContent = "";
    $("#cronNext").innerHTML = "";
    $("#cronFields").innerHTML = "";
    inp.classList.add("bad");
    return;
  }
  inp.classList.remove("bad");
  const names = ["นาที", "ชั่วโมง", "วันที่", "เดือน", "วันในสัปดาห์"];
  if (p.hasSeconds) names.unshift("วินาที");
  legend.innerHTML = names.map((n) => `<span>${n}</span>`).join("");
  legend.hidden = !!p.reboot || (inp.value.trim().startsWith("@"));
  $("#cronExplain").textContent = explain(p);

  const runs = nextRuns(p, new Date(), 10);
  if (p.reboot) $("#cronNext").innerHTML = '<tr><td class="muted">@reboot รันตอนเครื่องบูตเท่านั้น</td></tr>';
  else if (!runs.length) $("#cronNext").innerHTML = '<tr><td class="muted">ไม่พบเวลาที่ตรงเงื่อนไขภายใน 5 ปี (เช่น วันที่ 30 กุมภาพันธ์)</td></tr>';
  else {
    const showSec = p.hasSeconds;
    $("#cronNext").innerHTML = runs.map((d, i) => {
      const date = d.toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
      const time = d.toLocaleTimeString("th-TH", { hour12: false, hour: "2-digit", minute: "2-digit", ...(showSec ? { second: "2-digit" } : {}) });
      return `<tr><th>${i + 1}</th><td>${esc(date)}</td><td class="mono">${esc(time)}</td><td class="muted">${rel(d)}</td></tr>`;
    }).join("");
  }

  $("#cronFields").innerHTML = '<tr><th>ฟิลด์</th><th>ค่า</th><th>ช่วงที่ใช้ได้</th><th>ค่าที่ตรง</th></tr>' +
    fieldRows(p).map((r) => `<tr><td>${esc(r.name)}</td><td class="mono">${esc(r.raw)}</td><td class="muted">${esc(r.range)}</td><td>${esc(r.values)}</td></tr>`).join("");
}

// ---------- builder ----------
function build() {
  const f = $("#bFreq").value;
  const [hh, mm] = ($("#bTime").value || "00:00").split(":").map(Number);
  const clamp = (el, lo, hi) => Math.min(hi, Math.max(lo, Number(el.value) || lo));
  switch (f) {
    case "minutes": return `*/${clamp($("#bEvery"), 1, 59)} * * * *`;
    case "hourly": return `${clamp($("#bMinute"), 0, 59)} * * * *`;
    case "daily": return `${mm} ${hh} * * *`;
    case "weekdays": return `${mm} ${hh} * * 1-5`;
    case "weekly": return `${mm} ${hh} * * ${$("#bDow").value}`;
    case "monthly": return `${mm} ${hh} ${clamp($("#bDom"), 1, 31)} * *`;
    case "yearly": return `${mm} ${hh} ${clamp($("#bDom"), 1, 31)} ${$("#bMonth").value} *`;
  }
  return "* * * * *";
}
function syncBuilder() {
  const f = $("#bFreq").value;
  $$("[data-b]").forEach((el) => (el.hidden = !el.dataset.b.split(" ").includes(f)));
  $("#bPreview").textContent = build();
}
$$("#bFreq, #bEvery, #bMinute, #bTime, #bDow, #bDom, #bMonth").forEach((el) => el.addEventListener("input", syncBuilder));
$("#bApply").addEventListener("click", () => { inp.value = build(); run(); inp.focus(); });

$$("[data-cron]").forEach((b) => b.addEventListener("click", () => { inp.value = b.dataset.cron; run(); }));

let deb;
inp.addEventListener("input", () => { clearTimeout(deb); deb = setTimeout(run, 120); });

// refresh relative times once a minute while visible
setInterval(() => { if (!document.hidden) run(); }, 60_000);

syncBuilder();
run();
