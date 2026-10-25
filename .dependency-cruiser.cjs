// « Krizaka first », cycles, unresolvable imports and dev dependencies in production code: the shared preset of
// @krizaka/config. Run it with `pnpm run lint:deps` (scripts/deps.mjs: one run per workspace, from the workspace's own folder
// so that its tsconfig, and its `@/` alias, is the one read; each keeps a .dependency-cruiser-known-violations.json, which
// only shrinks).
module.exports = {
  extends: "@krizaka/config/dependency-cruiser",
  forbidden: [],
  options: {
    exclude: { path: "(^|/)(\\.next|dist|\\.expo|ios|android|coverage)/" },
    // another workspace is not followed: its own run reports its violations, once.
    doNotFollow: { path: "(^|/)node_modules/|^\\.\\./\\.\\./(apps|packages)/" },
    tsConfig: { fileName: "tsconfig.json" },
  },
};
