import { krizakaBase } from "@krizaka/config/eslint";

export default [
  ...krizakaBase,
  { ignores: [".expo/**", "dist/**", "ios/**", "android/**", "expo-env.d.ts"] },
  // Expo config plugins, their tests and Jest's resolver are CommonJS.
  { files: ["plugins/**/*.js", "jest.resolver.js"], rules: { "@typescript-eslint/no-require-imports": "off" } },
  // Jest's globals in the tests.
  {
    files: ["**/__tests__/**", "**/*.test.{js,ts,tsx}"],
    languageOptions: { globals: { describe: "readonly", it: "readonly", test: "readonly", expect: "readonly", jest: "readonly", beforeEach: "readonly", afterEach: "readonly", beforeAll: "readonly", afterAll: "readonly" } },
  },
];
