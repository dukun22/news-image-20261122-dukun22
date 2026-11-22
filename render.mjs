// Builds the "THE WORLD TODAY" front page for 22 November 2026 and
// screenshots it to entry.png with the headless Chromium shell.
// Reads stories.json, writes a static HTML page, screenshots it.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { homedir } from "node:os";
import { join } from "node:path";

const ROOT = new URL(".", import.meta.url).pathname;
const data = JSON.parse(readFileSync(join(ROOT, "stories.json"), "utf8"));

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// --- tiny original SVG icons (24x24) -------------------------------------
function iconSvg(kind) {
  const wrap = (inner) =>
    `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden="true">${inner}</svg>`;
  switch (kind) {
    case "leaf":
      return wrap(
        `<path d="M5 19C5 9 11 4 20 4c0 9-5 15-15 15Z" fill="#1d3557"/>` +
          `<path d="M5 19C9 13 13 9 18 6" stroke="#f6f1e5" stroke-width="1.4"/>`
      );
    case "anchor":
      return wrap(
        `<circle cx="12" cy="5" r="2.4" stroke="#1d3557" stroke-width="1.8"/>` +
          `<path d="M12 7.5V20M7 12h10M4 13c0 4 3.5 7 8 7s8-3 8-7" stroke="#1d3557" stroke-width="1.8" fill="none" stroke-linecap="round"/>`
      );
    case "shield":
      return wrap(
        `<path d="M12 2.5 19 5v6c0 5-3.2 8.6-7 9.5C8.2 19.6 5 16 5 11V5Z" fill="#1d3557"/>` +
          `<path d="M12 7v9M7.5 11.5h9" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>`
      );
    case "bolt":
      return wrap(
        `<polygon points="13,2 5.5,13.5 10.5,13.5 9,22 18.5,10 13.5,10" fill="#a4161a"/>`
      );
    case "gamepad":
      return wrap(
        `<rect x="2.5" y="7" width="19" height="11" rx="5.5" fill="#1d3557"/>` +
          `<path d="M8 10.5v5M5.5 13h5" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>` +
          `<circle cx="15.5" cy="11.8" r="1.2" fill="#fff"/><circle cx="18" cy="14.2" r="1.2" fill="#e63946"/>`
      );
    default:
      return wrap(`<circle cx="12" cy="12" r="8" fill="#1d3557"/>`);
  }
}

// --- lead illustration: night sky, gold star, roadblock barrier -----------
function leadArt() {
  return `<svg width="288" height="208" viewBox="0 0 288 208" aria-hidden="true">
  <rect width="288" height="208" fill="#16224a"/>
  <g fill="#ffffff">
    <circle cx="22" cy="24" r="1.6"/><circle cx="58" cy="14" r="1.2"/><circle cx="104" cy="30" r="1.6"/>
    <circle cx="160" cy="18" r="1.2"/><circle cx="210" cy="34" r="1.6"/><circle cx="256" cy="16" r="1.2"/>
    <circle cx="40" cy="58" r="1.2"/><circle cx="248" cy="62" r="1.4"/><circle cx="196" cy="58" r="1"/>
  </g>
  <polygon fill="#f4b400" points="144,26 157,66 198,67 166,91 178,131 144,107 110,131 122,91 90,67 131,66"/>
  <circle cx="144" cy="82" r="13" fill="#16224a"/>
  <circle cx="144" cy="82" r="13" fill="none" stroke="#ffffff" stroke-width="1.5"/>
  <path d="M144 75v14M137 82h14" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round"/>
  <rect x="18" y="150" width="252" height="16" fill="#f6f1e5"/>
  <g fill="#a4161a"><rect x="42" y="150" width="14" height="16"/><rect x="86" y="150" width="14" height="16"/><rect x="130" y="150" width="14" height="16"/><rect x="174" y="150" width="14" height="16"/><rect x="218" y="150" width="14" height="16"/></g>
  <rect x="18" y="170" width="252" height="14" fill="#0d1530"/>
  <g stroke="#f6f1e5" stroke-width="2"><line x1="40" y1="170" x2="40" y2="184"/><line x1="88" y1="170" x2="88" y2="184"/><line x1="136" y1="170" x2="136" y2="184"/><line x1="184" y1="170" x2="184" y2="184"/><line x1="232" y1="170" x2="232" y2="184"/></g>
  <text x="144" y="200" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" letter-spacing="2" fill="#ffffff">SINALOA &#8226; 22 NOV 2026</text>
</svg>`;
}

// --- one small story card --------------------------------------------------
function storyCard(story) {
  return `<div class="story">
    <div class="story-top">
      <span class="num">${story.n}</span>
      <span class="kicker">${esc(story.kicker)}</span>
      <span class="icon">${iconSvg(story.icon)}</span>
    </div>
    <h3>${esc(story.headline)}</h3>
    <p>${esc(story.summary)}</p>
  </div>`;
}

const [first, second] = [data.stories.slice(0, 2), data.stories.slice(2)];

const page = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 1024px; height: 1024px; overflow: hidden; }
  body { background: #f6f1e5; color: #111; font-family: Arial, Helvetica, sans-serif; padding: 18px 36px 14px; }
  .mast { font-family: Georgia, 'Times New Roman', serif; font-size: 62px; font-weight: 900; letter-spacing: 3px; text-align: center; line-height: 1.05; }
  .rule-thick { border: none; border-top: 4px solid #111; margin: 10px 0 3px; }
  .rule-thin { border: none; border-top: 1px solid #111; margin: 0 0 8px; }
  .daterow { display: flex; justify-content: space-between; align-items: baseline; padding: 2px 0 8px; }
  .date { color: #a4161a; font-weight: 800; font-size: 26px; letter-spacing: 1px; }
  .tagline { font-size: 15px; letter-spacing: 3px; font-weight: 700; }
  .lead { display: flex; gap: 26px; padding: 12px 0 14px; }
  .lead-text { flex: 1; }
  .kicker { color: #a4161a; font-size: 15px; font-weight: 800; letter-spacing: 1.5px; }
  .lead h2 { font-family: Georgia, 'Times New Roman', serif; font-size: 41px; line-height: 1.12; margin: 6px 0 10px; }
  .lead p { font-size: 18px; line-height: 1.42; }
  .lead p b { font-weight: 800; }
  .lead-art { flex: none; }
  .row { display: flex; gap: 28px; }
  .row.two .story { flex: 1; }
  .row.three .story { flex: 1; }
  .row.two { padding: 14px 0 6px; }
  .row.three { padding: 12px 0 6px; }
  .story-top { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }
  .num { width: 30px; height: 30px; border-radius: 50%; background: #a4161a; color: #fff; font-weight: 800; font-size: 16px; display: flex; align-items: center; justify-content: center; flex: none; }
  .story h3 { font-size: 23px; line-height: 1.18; margin: 2px 0 6px; }
  .row.three .story h3 { font-size: 21px; }
  .story p { font-size: 16px; line-height: 1.4; }
  .row.three .story p { font-size: 15.5px; }
  .icon { margin-left: auto; flex: none; }
  .stats { display: flex; border-top: 1px solid #999; margin-top: 8px; padding-top: 8px; }
  .stat { flex: 1; text-align: center; }
  .stat b { display: block; color: #a4161a; font-size: 34px; }
  .stat span { font-size: 13px; font-weight: 700; }
  .foot { border-top: 4px solid #111; margin-top: 10px; padding-top: 8px; text-align: center; }
  .foot b { font-size: 17px; display: block; margin-bottom: 3px; }
  .foot span { font-size: 15px; color: #555; }
</style></head>
<body>
  <div class="mast">${esc(data.masthead)}</div>
  <hr class="rule-thick"><hr class="rule-thin">
  <div class="daterow"><span class="date">${esc(data.date)}</span><span class="tagline">${esc(data.tagline).toUpperCase()}</span></div>
  <hr class="rule-thin">
  <div class="lead">
    <div class="lead-text">
      <div class="kicker">${esc(data.lead.kicker)}</div>
      <h2>${esc(data.lead.headline)}</h2>
      <p><b>${esc(data.lead.dateline)} &mdash;</b> ${esc(data.lead.summary)}</p>
    </div>
    <div class="lead-art">${leadArt()}</div>
  </div>
  <hr class="rule-thin">
  <div class="row two">${first.map(storyCard).join("")}</div>
  <div class="row three">${second.map(storyCard).join("")}</div>
  <div class="stats">
    ${data.stats.map((s) => `<div class="stat"><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`).join("")}
  </div>
  <div class="foot"><b>${esc(data.footer)}</b><span>${esc(data.judge_note)}</span></div>
</body></html>`;

const workDir = mkdtempSync(join(tmpdir(), "poster-"));
const htmlPath = join(workDir, "page.html");
const outPath = join(ROOT, "entry.png");
writeFileSync(htmlPath, page, "utf8");

const shell = join(homedir(), ".cache", "ms-playwright", "chromium_headless_shell-1148", "chrome-linux", "headless_shell");
execFileSync(shell, [
  "--disable-gpu",
  "--no-sandbox",
  "--hide-scrollbars",
  "--force-device-scale-factor=1",
  "--window-size=1024,1024",
  `--screenshot=${outPath}`,
  `file://${htmlPath}`,
], { stdio: "ignore" });

if (!existsSync(outPath)) {
  throw new Error("headless shell did not produce entry.png");
}

rmSync(workDir, { recursive: true, force: true });
const bytes = statSync(outPath).size;
console.log(`wrote entry.png (${bytes} bytes)`);
