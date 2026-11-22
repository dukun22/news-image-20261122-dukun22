// Entry point for the make.fun News Image 22 Nov submission.
// Copies the finished poster into the directory the grader reads.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const botDir = process.env.MAKEFUN_BOT_DIR ?? ".";
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? "out";
const source = join(botDir, "entry.png");
const target = join(outputDir, "entry.png");

if (!existsSync(source)) {
  throw new Error(`entry.png not found in ${botDir}`);
}
mkdirSync(outputDir, { recursive: true });
copyFileSync(source, target);
if (!existsSync(target)) {
  throw new Error(`failed to write ${target}`);
}
console.log(`copied ${source} -> ${target}`);
