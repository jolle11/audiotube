import js from "@eslint/js";
import globals from "globals";

const extensionGlobals = { AudioTubeUtil: "readonly", AudioTubeState: "readonly", AudioTubeTimer: "readonly", AudioTubePlayer: "readonly" };

export default [
  { ignores: ["dist/", "node_modules/"] },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: { sourceType: "script", globals: { ...globals.browser, ...globals.webextensions, ...extensionGlobals } },
    rules: { "no-unused-vars": ["error", { caughtErrors: "none", varsIgnorePattern: "^AudioTube" }], "no-unused-expressions": ["error", { allowTernary: true }] }
  },
  { files: ["content/util.js"], languageOptions: { globals: { module: "writable" } } },
  { files: ["content/*.js"], rules: { "no-redeclare": "off" } },
  { files: ["**/*.mjs", "scripts/**", "test/**"], languageOptions: { sourceType: "module", globals: globals.node } },
  { files: ["e2e/**"], languageOptions: { globals: { ...globals.browser, ...globals.webextensions } } }
];
