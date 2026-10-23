#!/usr/bin/env node
// The source images of the storefront defaults (#267), made locally at no cost with FLUX.2 klein through stable-diffusion.cpp.
//   node scripts/default-media/generate.mjs <out-dir>          one 16:9 cover and four 4:3 gallery images per shop type (prompts.json)
// One image at a time, and only under the heavy lock (~/.krizaka-worktrees/tools/heavy-lock.sh): it keeps the Mac busy for about an hour.
// Neutral places and objects only: no real person, no text, nothing a customer could take for the owner's own shop. The files are never committed:
// `build.mjs` turns them into the renditions and the loops that go to the media CDN.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = process.argv[2];
if (!out) {
  console.error("usage: node scripts/default-media/generate.mjs <out-dir>");
  process.exit(2);
}
const models = join(homedir(), "models/stable-diffusion");
const sd = join(models, "stable-diffusion.cpp/build/bin/sd-cli");
const { style, types } = JSON.parse(readFileSync(join(here, "prompts.json"), "utf8"));
mkdirSync(out, { recursive: true });

let seed = 100;
for (const [type, slots] of Object.entries(types)) {
  for (const [slot, prompts] of Object.entries(slots)) {
    for (const [i, prompt] of prompts.entries()) {
      seed += 1;
      const file = join(out, `${type}-${slot}-${i + 1}.png`);
      if (existsSync(file)) continue;
      const [w, h] = slot === "cover" ? [1280, 720] : [1024, 768];
      const run = spawnSync(sd, ["--diffusion-model", join(models, "flux2-klein-4b/flux-2-klein-4b-Q8_0.gguf"), "--vae", join(models, "flux2-klein-4b/flux2-vae.safetensors"), "--llm", join(models, "flux2-klein-4b/Qwen3-4B-Q8_0.gguf"), "-p", `${prompt}, ${style}`, "--cfg-scale", "1.0", "--steps", "4", "-W", String(w), "-H", String(h), "--diffusion-fa", "-s", String(seed), "-o", file], { encoding: "utf8" });
      console.log(file, existsSync(file) ? "ok" : `FAILED (${run.status})`);
    }
  }
}
