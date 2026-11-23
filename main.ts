// The World Today — 22 November 2026.
// Entry point for the make.fun submission. Reads stories.json, renders the
// 1024x1024 front page through render.mjs, and writes entry.png into the
// output directory named by MAKEFUN_OUTPUT_DIR (default "out").
// Runs with plain Node 24: `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts`
// Two runs write identical bytes.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPoster } from './render.mjs';

const here: string = path.dirname(fileURLToPath(import.meta.url));
const outDir: string = process.env.MAKEFUN_OUTPUT_DIR ?? 'out';
const dataPath: string = path.join(here, 'stories.json');

const raw: string = fs.readFileSync(dataPath, 'utf8');
const data: unknown = JSON.parse(raw);
const png: Buffer = renderPoster(data as never);

fs.mkdirSync(outDir, { recursive: true });
const target: string = path.join(outDir, 'entry.png');
fs.writeFileSync(target, png);
console.log(`wrote ${target} (${png.length} bytes)`);
