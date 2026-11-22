// Render the 22 November news poster: reads stories.json, builds a
// 1024x1024 HTML page and screenshots it with headless Chromium.
// Only Node's standard library is used; the artwork is original SVG.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(root, 'stories.json'), 'utf8'));

// Small original icons, one per story (64x64 viewBox, drawn by hand).
const icons = {
  leaf: `<svg viewBox="0 0 64 64" width="52" height="52"><path d="M32 5 C53 13 57 35 40 51 C25 63 9 54 9 37 C9 19 20 9 32 5 Z" fill="#14264a"/><path d="M32 12 C32 26 30 39 20 51" stroke="#f8f4ec" stroke-width="3" fill="none"/><path d="M32 24 L45 20 M32 34 L46 30" stroke="#f8f4ec" stroke-width="2.5" fill="none"/></svg>`,
  anchor: `<svg viewBox="0 0 64 64" width="52" height="52"><circle cx="32" cy="12" r="6" fill="none" stroke="#14264a" stroke-width="4"/><path d="M32 18 V52 M18 30 C18 44 24 52 32 52 C40 52 46 44 46 30" stroke="#14264a" stroke-width="4" fill="none"/><path d="M12 30 L24 30 M40 30 L52 30" stroke="#14264a" stroke-width="4"/><path d="M14 22 L22 30 L14 38 M50 22 L42 30 L50 38" stroke="#a41212" stroke-width="3.5" fill="none"/></svg>`,
  shield: `<svg viewBox="0 0 64 64" width="52" height="52"><path d="M32 5 L55 13 V31 C55 46 45 57 32 61 C19 57 9 46 9 31 V13 Z" fill="#14264a"/><path d="M32 19 L32 45 M21 30 L43 30" stroke="#f8f4ec" stroke-width="4" fill="none"/><circle cx="32" cy="32" r="4" fill="#a41212"/></svg>`,
  bolt: `<svg viewBox="0 0 64 64" width="52" height="52"><path d="M36 4 L12 36 H26 L22 60 L48 26 H33 Z" fill="#a41212"/><path d="M36 4 L12 36 H26 L22 60" fill="none" stroke="#14264a" stroke-width="2"/></svg>`,
  gamepad: `<svg viewBox="0 0 64 64" width="52" height="52"><rect x="7" y="19" width="50" height="27" rx="13" fill="#14264a"/><path d="M20 27 v11 M14 32 h12" stroke="#f8f4ec" stroke-width="3" fill="none"/><circle cx="42" cy="29" r="3.5" fill="#a41212"/><circle cx="50" cy="36" r="3.5" fill="#f8f4ec"/></svg>`,
};

// Lead illustration: an original night scene — a gold badge over a dark
// desert road, with a striped roadblock barrier and a flare in the sky.
const leadArt = `<svg viewBox="0 0 220 190" width="220" height="190">
  <rect x="0" y="0" width="220" height="190" fill="#14264a"/>
  <circle cx="28" cy="24" r="2" fill="#f8f4ec"/><circle cx="72" cy="13" r="1.6" fill="#f8f4ec"/>
  <circle cx="118" cy="28" r="2" fill="#f8f4ec"/><circle cx="172" cy="16" r="1.6" fill="#f8f4ec"/>
  <circle cx="198" cy="42" r="2" fill="#f8f4ec"/><circle cx="96" cy="46" r="1.5" fill="#f8f4ec"/>
  <path d="M110 34 L125 62 L156 66 L132 87 L141 118 L110 100 L79 118 L88 87 L64 66 L95 62 Z" fill="#f8c531"/>
  <circle cx="110" cy="76" r="9" fill="#14264a"/>
  <path d="M110 70 L110 82 M104 76 L116 76" stroke="#f8f4ec" stroke-width="3.5" fill="none"/>
  <path d="M14 148 L206 148 L206 160 L14 160 Z" fill="#0b1a33"/>
  <path d="M30 148 L30 160 M60 148 L60 160 M90 148 L90 160 M120 148 L120 160 M150 148 L150 160 M180 148 L180 160" stroke="#f8f4ec" stroke-width="2"/>
  <path d="M40 128 L180 128 L180 140 L40 140 Z" fill="#f8f4ec"/>
  <path d="M52 128 L52 140 M76 128 L76 140 M100 128 L100 140 M124 128 L124 140 M148 128 L148 140 M172 128 L172 140" stroke="#a41212" stroke-width="6"/>
  <text x="110" y="184" font-size="13" font-weight="700" fill="#f8f4ec" text-anchor="middle" font-family="Arial,sans-serif">SINALOA • 22 NOV 2026</text>
</svg>`;

const story = (s) => `
  <div class="story">
    <div class="num">${s.n}</div>
    <div class="sbody">
      <div class="kicker">${s.kicker}</div>
      <div class="shead">${s.headline}</div>
      <div class="ssum">${s.summary}</div>
    </div>
    <div class="sicon">${icons[s.icon]}</div>
  </div>`;

const stat = (s) => `
    <div class="stat"><div class="n">${s.value}</div><div class="l">${s.label}</div></div>`;

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1024px;height:1024px;background:#f8f4ec;color:#141414;font-family:"Noto Sans",Arial,sans-serif;overflow:hidden}
.page{width:1024px;height:1024px;padding:14px 36px 10px;display:flex;flex-direction:column}
.mast{text-align:center;border-bottom:4px solid #141414;padding-bottom:6px}
.mast h1{font-size:50px;font-weight:900;letter-spacing:5px;line-height:1}
.dateline{display:flex;justify-content:space-between;align-items:baseline;border-bottom:2px solid #141414;padding:5px 2px 6px}
.dateline .date{font-size:27px;font-weight:900;color:#a41212;letter-spacing:1px}
.dateline .tag{font-size:18px;font-weight:700;letter-spacing:2px;text-transform:uppercase}
.lead{display:flex;gap:24px;padding:8px 0 6px;border-bottom:2px solid #141414}
.lead-text{flex:1}
.kicker{font-size:16px;font-weight:900;letter-spacing:2px;color:#a41212;text-transform:uppercase}
.lead-text h2{font-size:33px;line-height:1.13;font-weight:900;margin:7px 0 8px}
.lead-text p{font-size:18px;line-height:1.32}
.lead-art{flex:0 0 220px;display:flex;align-items:center;justify-content:center}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:0 28px}
.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:0 24px}
.story{display:flex;gap:10px;padding:5px 0;border-bottom:1px solid #b9b2a4}
.num{flex:0 0 30px;height:30px;border-radius:50%;background:#a41212;color:#f8f4ec;font-size:18px;font-weight:900;display:flex;align-items:center;justify-content:center;margin-top:2px}
.sbody{flex:1}
.shead{font-size:19px;line-height:1.16;font-weight:900;margin:4px 0 5px}
.ssum{font-size:15px;line-height:1.3}
.sicon{flex:0 0 44px;padding-top:4px}
.sicon svg{width:44px;height:44px}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;padding:6px 0;border-bottom:2px solid #141414;align-items:start}
.stat{text-align:center}
.stat .n{font-size:26px;font-weight:900;color:#a41212;line-height:1}
.stat .l{font-size:12px;line-height:1.25;margin-top:4px;font-weight:700}
.foot{border-top:4px solid #141414;margin-top:6px;padding-top:5px;text-align:center}
.foot .f1{font-size:18px;font-weight:700}
.foot .f2{font-size:15px;color:#555;margin-top:2px}
</style></head><body><div class="page">
  <div class="mast"><h1>${data.masthead}</h1></div>
  <div class="dateline"><span class="date">${data.date}</span><span class="tag">${data.tagline}</span></div>
  <div class="lead">
    <div class="lead-text">
      <div class="kicker">${data.lead.kicker}</div>
      <h2>${data.lead.headline}</h2>
      <p><b>${data.lead.dateline} —</b> ${data.lead.summary}</p>
    </div>
    <div class="lead-art">${leadArt}</div>
  </div>
  <div class="grid2">
    ${data.stories.slice(0, 2).map((s) => story(s)).join('\n')}
  </div>
  <div class="grid3">
    ${data.stories.slice(2).map((s) => story(s)).join('\n')}
  </div>
  <div class="stats">${data.stats.map((s) => stat(s)).join('')}
  </div>
  <div class="foot">
    <div class="f1">${data.footer}</div>
    <div class="f2">${data.judge_note}</div>
  </div>
</div></body></html>`;

const outHtml = '/tmp/poster22.html';
writeFileSync(outHtml, html);
const chrome = join(homedir(), '.cache/ms-playwright/chromium-1148/chrome-linux/chrome');
const outPng = join(root, 'entry.png');
execFileSync(chrome, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  '--force-device-scale-factor=1', '--window-size=1024,1024',
  `--screenshot=${outPng}`, `file://${outHtml}`,
], { stdio: 'inherit' });
console.log('wrote', outPng);
