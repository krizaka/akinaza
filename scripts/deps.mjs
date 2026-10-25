#!/usr/bin/env node
/* eslint-disable no-console -- a command-line tool: its output is the interface */
// dependency-cruiser over every JavaScript workspace (the shared preset of @krizaka/config, `.dependency-cruiser.cjs`).
// A workspace is cruised from its own folder, with its own tsconfig (its `@/` alias is its own), and keeps its known
// violations beside it: they only shrink.
//   node scripts/deps.mjs            check: a new violation fails, and so does a recorded one that is fixed
//   node scripts/deps.mjs update     removes the fixed ones from the files (never adds one)
//   node scripts/deps.mjs init       records the violations of a workspace that has no file yet (the adoption pull request)
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Every workspace with TypeScript sources, and the folders and files of its sources. */
export const WORKSPACES = Object.freeze({
  "apps/web": ["app", "components", "lib", "scripts", "proxy.ts", "instrumentation.ts"],
  "apps/mobile": ["app", "src", "plugins"],
  "packages/client": ["src"],
  "packages/core": ["src"],
  "packages/db": ["src"],
});

/** The workspaces of the repository that own a tsconfig: a new one cannot escape the cruise (tests/deps.test.mjs). */
export function workspacesWithSources(root = ROOT) {
  return ["apps", "packages"].flatMap((group) =>
    readdirSync(join(root, group), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(join(root, group, entry.name, "tsconfig.json")))
      .map((entry) => `${group}/${entry.name}`),
  );
}

function run(command, workspace) {
  const cwd = join(ROOT, workspace);
  const folders = WORKSPACES[workspace].filter((folder) => existsSync(join(cwd, folder)));
  const config = join(ROOT, ".dependency-cruiser.cjs");
  return spawnSync("pnpm", ["exec", "krizaka-known-violations", command, "--config", config, ...folders], { cwd, stdio: "inherit" }).status ?? 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const command = process.argv[2] ?? "check";
  if (!["check", "update", "init"].includes(command)) {
    console.error("Usage: node scripts/deps.mjs [check|update|init]");
    process.exit(2);
  }
  let failed = 0;
  for (const workspace of Object.keys(WORKSPACES)) {
    console.log(`depcruise ${workspace}`);
    if (run(command, workspace) !== 0) failed += 1;
  }
  process.exit(failed ? 1 : 0);
}
