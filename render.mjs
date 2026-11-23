// The World Today — 22 November 2026.
// Draws the day's world news as a 1024x1024 newspaper front page and writes
// it to entry.png. Pure Node.js standard library: no npm packages, no browser,
// no external art. Text is set with a small built-in 5x7 bitmap font and the
// PNG file is encoded by hand (zlib deflate + CRC32 chunks), so every run
// produces exactly the same bytes.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const WIDTH = 1024;
const HEIGHT = 1024;

// ---- palette ---------------------------------------------------------------
const PAPER = [247, 242, 230]; // warm newsprint
const INK = [24, 24, 24]; // near-black text
const SOFT_INK = [58, 54, 48]; // body copy
const MUTED = [96, 90, 80]; // small print
const RED = [176, 32, 28]; // kickers, badges, date
const WHITE = [255, 255, 255];
const SKY_TOP = [36, 64, 108]; // dusk sky, top of the lead art
const SKY_LOW = [228, 146, 74]; // dusk sky, horizon
const SUN = [238, 186, 72]; // low sun in the lead art
const SUN_CORE = [247, 208, 110];
const SKYLINE = [38, 36, 34]; // city silhouette
const GROUND = [52, 48, 42];
const GOLD = [212, 158, 46];
const BOX_TINT = [236, 228, 210]; // stat box fill

// ---- CRC32 + PNG encoding --------------------------------------------------
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  const crcInput = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  out.writeUInt32BE(crc32(crcInput), 8 + data.length);
  return out;
}

function encodePng(width, height, rgb) {
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y += 1) {
    raw[y * (1 + width * 3)] = 0; // filter: none
    rgb.copy(raw, y * (1 + width * 3) + 1, y * width * 3, (y + 1) * width * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = zlib.deflateSync(raw, { level: 9 });
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- a tiny drawing surface -------------------------------------------------
class Page {
  constructor(w, h, bg) {
    this.w = w;
    this.h = h;
    this.px = new Uint8Array(w * h * 3);
    for (let i = 0; i < w * h; i += 1) {
      this.px[i * 3] = bg[0];
      this.px[i * 3 + 1] = bg[1];
      this.px[i * 3 + 2] = bg[2];
    }
  }

  set(x, y, c) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 3;
    this.px[i] = c[0];
    this.px[i + 1] = c[1];
    this.px[i + 2] = c[2];
  }

  rect(x, y, w, h, c) {
    const x0 = Math.max(0, x);
    const y0 = Math.max(0, y);
    const x1 = Math.min(this.w, x + w);
    const y1 = Math.min(this.h, y + h);
    for (let yy = y0; yy < y1; yy += 1) {
      for (let xx = x0; xx < x1; xx += 1) this.set(xx, yy, c);
    }
  }

  hline(x, y, w, c, t = 1) {
    for (let k = 0; k < t; k += 1) this.rect(x, y + k, w, 1, c);
  }

  vline(x, y, h, c, t = 1) {
    for (let k = 0; k < t; k += 1) this.rect(x + k, y, 1, h, c);
  }

  frame(x, y, w, h, c, t = 1) {
    this.hline(x, y, w, c, t);
    this.hline(x, y + h - t, w, c, t);
    this.vline(x, y, h, c, t);
    this.vline(x + w - t, y, h, c, t);
  }

  disc(cx, cy, r, c) {
    for (let dy = -r; dy <= r; dy += 1) {
      const dx = Math.floor(Math.sqrt(r * r - dy * dy));
      this.rect(cx - dx, cy + dy, dx * 2 + 1, 1, c);
    }
  }

  toPng() {
    return encodePng(this.w, this.h, Buffer.from(this.px));
  }
}

// ---- 5x7 bitmap font --------------------------------------------------------
// Each glyph is 7 rows of 5 cells; '#' is ink, '.' is blank. The poster sets
// everything in capitals, so only capitals, digits and punctuation are needed.
const GLYPHS = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.####', '#....', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '##..#', '#.#.#', '#..##', '#..##', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '...#.', '..#..', '..#..', '..#..'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  ',': ['.....', '.....', '.....', '.....', '.##..', '.##..', '.#...'],
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  ';': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.#...'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  "'": ['..#..', '..#..', '.#...', '.....', '.....', '.....', '.....'],
  '"': ['.#.#.', '.#.#.', '.....', '.....', '.....', '.....', '.....'],
  '-': ['.....', '.....', '.....', '.###.', '.....', '.....', '.....'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  '(': ['...##', '..#..', '.#...', '.#...', '.#...', '..#..', '...##'],
  ')': ['##...', '..#..', '...#.', '...#.', '...#.', '..#..', '##...'],
  '&': ['.###.', '#...#', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'],
  '%': ['##..#', '##.#.', '...#.', '..#..', '.#...', '#.##.', '#..##'],
  '+': ['.....', '..#..', '..#..', '.###.', '..#..', '..#..', '.....'],
  '=': ['.....', '.....', '.###.', '.....', '.###.', '.....', '.....'],
  $: ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'],
  '•': ['.....', '.....', '.###.', '.###.', '.###.', '.....', '.....'],
};

// Letters with accents are folded to their plain form so names stay readable.
const ACCENTS = {
  Á: 'A', À: 'A', Â: 'A', Ä: 'A',
  É: 'E', È: 'E', Ê: 'E', Ë: 'E',
  Í: 'I', Ì: 'I', Î: 'I', Ï: 'I',
  Ó: 'O', Ò: 'O', Ô: 'O', Ö: 'O',
  Ú: 'U', Ù: 'U', Û: 'U', Ü: 'U',
  Ñ: 'N', Ç: 'C', Ý: 'Y',
};

// Normalise copy for the bitmap font: capitals, straight quotes and dashes,
// accented letters folded, anything unknown becomes a space.
function clean(text) {
  return String(text)
    .toUpperCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[—–]/g, '-')
    .replace(/…/g, '...')
    .split('')
    .map((ch) => ACCENTS[ch] || ch)
    .map((ch) => (GLYPHS[ch] ? ch : ' '))
    .join('');
}

function textWidth(text, scale) {
  const s = clean(text);
  return s.length === 0 ? 0 : s.length * 6 * scale - scale;
}

function drawGlyph(page, ch, x, y, scale, color) {
  const g = GLYPHS[ch];
  if (!g) return;
  for (let r = 0; r < 7; r += 1) {
    for (let c = 0; c < 5; c += 1) {
      if (g[r][c] === '#') page.rect(x + c * scale, y + r * scale, scale, scale, color);
    }
  }
}

function drawText(page, text, x, y, scale, color) {
  const s = clean(text);
  let cx = x;
  for (const ch of s) {
    drawGlyph(page, ch, cx, y, scale, color);
    cx += 6 * scale;
  }
  return cx;
}

// Greedy word wrap; a single over-long word is split mid-word.
function wrapText(text, scale, maxWidth) {
  const words = clean(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const trial = line ? `${line} ${w}` : w;
    if (textWidth(trial, scale) <= maxWidth) {
      line = trial;
      continue;
    }
    if (!line) {
      let part = '';
      for (const ch of w) {
        if (part && textWidth(part + ch, scale) > maxWidth) {
          lines.push(part);
          part = ch;
        } else {
          part += ch;
        }
      }
      line = part;
      continue;
    }
    lines.push(line);
    line = w;
  }
  if (line) lines.push(line);
  return lines;
}

// Draw wrapped copy and report how many lines were used.
function drawWrapped(page, text, x, y, scale, color, maxWidth, maxLines, leading) {
  const lines = wrapText(text, scale, maxWidth).slice(0, maxLines);
  lines.forEach((ln, i) => drawText(page, ln, x, y + i * leading, scale, color));
  return lines.length;
}

// ---- lead art: a dusk skyline for the climate-summit lead -------------------
// Original flat illustration: banded sunset sky, low sun, dark city skyline.
function drawLeadArt(page, x, y, w, h) {
  for (let row = 0; row < h; row += 1) {
    const t = row / (h - 1);
    const c = [
      Math.round(SKY_TOP[0] + (SKY_LOW[0] - SKY_TOP[0]) * t),
      Math.round(SKY_TOP[1] + (SKY_LOW[1] - SKY_TOP[1]) * t),
      Math.round(SKY_TOP[2] + (SKY_LOW[2] - SKY_TOP[2]) * t),
    ];
    page.rect(x, y + row, w, 1, c);
  }
  const sunX = x + Math.floor(w * 0.72);
  const sunY = y + Math.floor(h * 0.5);
  const sunR = Math.floor(h * 0.19);
  page.disc(sunX, sunY, sunR, SUN);
  page.disc(sunX, sunY, Math.floor(sunR * 0.68), SUN_CORE);

  const groundH = Math.floor(h * 0.16);
  const groundTop = y + h - groundH;
  page.rect(x, groundTop, w, groundH, GROUND);
  page.hline(x, groundTop - 2, w, GOLD, 2);

  // Uneven skyline: twelve towers of different heights on the ground line.
  const heights = [0.34, 0.46, 0.3, 0.56, 0.4, 0.5, 0.28, 0.6, 0.36, 0.48, 0.32, 0.44];
  const bw = Math.floor(w / heights.length);
  heights.forEach((f, i) => {
    const bx = x + i * bw + 2;
    const bh = Math.floor(h * f);
    page.rect(bx, groundTop - bh, bw - 4, bh, SKYLINE);
  });
  // One tall antenna tower in the middle of the skyline.
  const towerX = x + Math.floor(w * 0.5);
  page.rect(towerX - 2, groundTop - Math.floor(h * 0.78), 4, Math.floor(h * 0.78), SKYLINE);
  page.disc(towerX, groundTop - Math.floor(h * 0.78) - 3, 3, RED);
}

// ---- the poster -------------------------------------------------------------
export function renderPoster(data) {
  const page = new Page(WIDTH, HEIGHT, PAPER);
  const MX = 48; // side margin
  const CW = WIDTH - MX * 2; // 928

  page.frame(16, 16, WIDTH - 32, HEIGHT - 32, INK, 2);
  page.frame(22, 22, WIDTH - 44, HEIGHT - 44, INK, 1);

  let y = 34;

  // Masthead.
  const mast = clean(data.masthead || 'THE WORLD TODAY');
  const mastScale = 9;
  drawText(page, mast, Math.floor((WIDTH - textWidth(mast, mastScale)) / 2), y, mastScale, INK);
  y += 63 + 10;

  // Date line.
  const dateLine = clean(data.date || '');
  drawText(page, dateLine, Math.floor((WIDTH - textWidth(dateLine, 2)) / 2), y, 2, RED);
  y += 14 + 10;

  // Rules under the masthead.
  page.hline(MX, y, CW, INK, 3);
  y += 8;
  page.hline(MX, y, CW, INK, 1);
  y += 10;

  // Lead art.
  const artH = 205;
  drawLeadArt(page, MX, y, CW, artH);
  page.frame(MX, y, CW, artH, INK, 1);
  y += artH + 12;

  // Lead kicker on the left, dateline on the right.
  drawText(page, data.lead.kicker, MX, y, 2, RED);
  if (data.lead.dateline) {
    const dl = clean(data.lead.dateline);
    drawText(page, dl, WIDTH - MX - textWidth(dl, 2), y, 2, RED);
  }
  y += 14 + 8;

  // Lead headline, then summary. The headline gets a roomier line spacing
  // (38) so its two lines breathe; the summary runs slightly tighter (18)
  // to keep the whole lead block the same height.
  const hLines = drawWrapped(page, data.lead.headline, MX, y, 4, INK, CW, 3, 38);
  y += hLines * 38 + 8;
  const sLines = drawWrapped(page, data.lead.summary, MX, y, 2, SOFT_INK, CW, 5, 18);
  y += sLines * 18 + 10;

  page.hline(MX, y, CW, INK, 2);
  y += 12;

  // The five other stories: red number badge, headline, short summary.
  const stories = data.stories || [];
  const rowH = 53;
  stories.forEach((st) => {
    page.rect(MX, y, 30, 30, RED);
    const num = String(st.n);
    drawText(page, num, MX + Math.floor((30 - textWidth(num, 3)) / 2), y + 5, 3, WHITE);
    const tx = MX + 42;
    const tw = CW - 42;
    const hl = drawWrapped(page, st.headline, tx, y, 2, INK, tw, 2, 19);
    drawWrapped(page, st.summary, tx, y + hl * 19 + 3, 1, MUTED, tw, 2, 11);
    y += rowH;
  });

  // Four stat boxes in a row.
  const stats = data.stats || [];
  const gap = 12;
  const boxW = Math.floor((CW - gap * (stats.length - 1)) / Math.max(stats.length, 1));
  const boxH = 50;
  stats.forEach((st, i) => {
    const bx = MX + i * (boxW + gap);
    page.rect(bx, y, boxW, boxH, BOX_TINT);
    page.frame(bx, y, boxW, boxH, INK, 1);
    const val = clean(st.value);
    drawText(page, val, bx + Math.floor((boxW - textWidth(val, 3)) / 2), y + 7, 3, RED);
    const lab = clean(st.label);
    drawText(page, lab, bx + Math.floor((boxW - textWidth(lab, 1)) / 2), y + 33, 1, INK);
  });
  y += boxH + 10;

  // Sources in two columns, three per side.
  const sources = data.sources || [];
  drawText(page, 'SOURCES', MX, y, 1, RED);
  y += 11;
  const colW = Math.floor((CW - 24) / 2);
  sources.forEach((src, i) => {
    const col = i < 3 ? 0 : 1;
    const row = i % 3;
    drawText(page, src, MX + col * (colW + 24), y + row * 11, 1, MUTED);
  });
  y += 3 * 11 + 8;

  // Footer: rule, tagline, then the footer line.
  page.hline(MX, y, CW, INK, 1);
  y += 8;
  const tag = clean(data.tagline || '');
  drawText(page, tag, Math.floor((WIDTH - textWidth(tag, 2)) / 2), y, 2, INK);
  y += 14 + 6;
  const foot = clean(data.footer || '');
  drawText(page, foot, Math.floor((WIDTH - textWidth(foot, 1)) / 2), y, 1, MUTED);
  y += 7;

  if (y > HEIGHT - 24) throw new Error(`poster overflow: content ends at y=${y}`);
  return page.toPng();
}

// ---- command line: node render.mjs writes entry.png next to this file -------
const here = path.dirname(fileURLToPath(import.meta.url));
const invokedAsMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(here, 'render.mjs');

if (invokedAsMain) {
  const data = JSON.parse(fs.readFileSync(path.join(here, 'stories.json'), 'utf8'));
  const png = renderPoster(data);
  const target = path.join(here, 'entry.png');
  fs.writeFileSync(target, png);
  console.log(`wrote ${target} (${png.length} bytes, ${WIDTH}x${HEIGHT})`);
}
