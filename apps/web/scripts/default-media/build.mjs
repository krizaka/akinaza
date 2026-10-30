#!/usr/bin/env tsx
// The renditions and loops of the storefront defaults (#267), from the source images of generate.mjs.
//   pnpm --filter @akinaza/web exec tsx scripts/default-media/build.mjs <src-dir> <out-dir>
// Per shop type: the cover as AVIF/WebP at the widths the hero needs, its poster, and an 8 second silent loop (a slow breathing zoom that ends where it began:
// webm and mp4); the gallery images; the service images (3:2 crops of the first gallery images). Then the manifest `apps/web/lib/default-media.manifest.json`
// (logical path -> first 10 hex of the file's SHA-256, the same rule as krizaka-com's cdn-assets.mjs, so the URL here is the one the upload creates).
// Upload afterwards, from krizaka-com:  node scripts/cdn-assets.mjs upload <out-dir> --to apps/akinaza/defaults
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { DEFAULT_SLOTS, DEFAULTS_ROOT, RENDITION_FORMATS, SHOP_TYPES } from "@akinaza/core";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const [src, out] = process.argv.slice(2);
if (!src || !out) {
  console.error("usage: tsx scripts/default-media/build.mjs <src-dir> <out-dir>");
  process.exit(2);
}
const QUALITY = { avif: { quality: 52, effort: 6 }, webp: { quality: 78, effort: 5 } };
const manifest = {};
const record = (logical, file) => {
  manifest[logical] = createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, 10);
};
const target = (type, slot, name) => {
  const dir = join(out, type, slot);
  mkdirSync(dir, { recursive: true });
  return join(dir, name);
};
const logical = (type, slot, name) => `${DEFAULTS_ROOT}/${type}/${slot}/${name}`;

async function renditions(input, type, slot, name, ratio) {
  for (const width of DEFAULT_SLOTS[slot].widths) {
    for (const format of RENDITION_FORMATS) {
      const file = target(type, slot, `${name}-${width}.${format}`);
      let image = sharp(input).resize({ width, height: ratio ? Math.round(width / ratio) : undefined, fit: "cover", position: "centre" });
      image = format === "avif" ? image.avif(QUALITY.avif) : image.webp(QUALITY.webp);
      await image.toFile(file);
      record(logical(type, slot, `${name}-${width}.${format}`), file);
    }
  }
}

function loop(input, type, name) {
  const webm = target(type, "cover", `${name}-loop.webm`);
  const mp4 = target(type, "cover", `${name}-loop.mp4`);
  const filter = "scale=2560:-1,zoompan=z='1+0.08*sin(PI*on/192)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=192:s=1280x720:fps=24,format=yuv420p";
  const common = ["-y", "-loglevel", "error", "-loop", "1", "-i", input, "-vf", filter, "-t", "8", "-an"];
  for (const [file, codec] of [[webm, ["-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "36", "-row-mt", "1"]], [mp4, ["-c:v", "libx264", "-crf", "24", "-preset", "slow", "-movflags", "+faststart", "-pix_fmt", "yuv420p"]]]) {
    const run = spawnSync("ffmpeg", [...common, ...codec, file], { encoding: "utf8" });
    if (run.status !== 0) throw new Error(`ffmpeg failed for ${file}: ${run.stderr}`);
  }
  record(logical(type, "cover", `${name}-loop.webm`), webm);
  record(logical(type, "cover", `${name}-loop.mp4`), mp4);
}

for (const type of SHOP_TYPES) {
  // The cover: the image, its poster (the first frame of the loop is the image itself) and its loop.
  const cover = join(src, `${type}-cover-1.png`);
  await renditions(cover, type, "cover", `${type}-cover-1`, 16 / 9);
  const poster = target(type, "cover", `${type}-cover-1-poster.webp`);
  await sharp(cover).resize({ width: 1280, height: 720, fit: "cover" }).webp(QUALITY.webp).toFile(poster);
  record(logical(type, "cover", `${type}-cover-1-poster.webp`), poster);
  loop(cover, type, `${type}-cover-1`);
  for (let n = 1; n <= DEFAULT_SLOTS.gallery.count; n += 1) await renditions(join(src, `${type}-gallery-${n}.png`), type, "gallery", `${type}-gallery-${n}`, 4 / 3);
  for (let n = 1; n <= DEFAULT_SLOTS.service.count; n += 1) await renditions(join(src, `${type}-gallery-${n}.png`), type, "service", `${type}-service-${n}`, 3 / 2);
  console.log(type, "done");
}

const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(join(here, "../../lib/default-media.manifest.json"), `${JSON.stringify({ cdn: "https://krizaka-assets.b-cdn.net", root: "apps/akinaza", files: sorted }, null, 2)}\n`);
console.log(Object.keys(sorted).length, "files in the manifest");
