// News-image entry for 22 November 2026 (Node 22, standard library only):
// the poster lives in this repository as entry.png, and this program copies
// it to the output directory as entry.png. It reads no network and writes
// the same bytes on every run.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { copyFileSync, mkdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// The copy is byte-for-byte identical on every run: no timestamps,
// no randomness, no network — the same entry.png lands in /output.
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
// The repository root: MAKEFUN_BOT_DIR in the grader's container, or the
// directory this file lives in when run locally.
const botDir = process.env.MAKEFUN_BOT_DIR ?? dirname(fileURLToPath(import.meta.url));
const source = join(botDir, 'entry.png');
const target = join(outDir, 'entry.png');

mkdirSync(outDir, { recursive: true });
copyFileSync(source, target);
console.log(`wrote ${target} (${statSync(target).size} bytes)`);
