// <app> — ESLint 9 flat config for the CLI template.
//
// Two kinds of rules:
//   - plain TypeScript linting over src, tests and the configs;
//   - architecture guards: the layer walls of PLAYBOOK_CLI.md section 3.1.
//     core is pure (imports nothing from adapters/bin, owns no process);
//     adapters never import the bin entry; bin is the composition root that
//     wires the layers.
//
// Every rule is scoped by directory, never by file name, so a new file can be
// added without touching this config.
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**", ".claude/**", "evals/fixtures/**"],
  },
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    extends: [tseslint.configs.recommended],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Plain-JS config/test files (eslint config itself, the native evals).
    files: ["**/*.{mjs,cjs}"],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // core is pure: commands are functions over consumer-owned ports, so core
    // never imports the adapters or the bin entry and never touches process.
    files: ["src/core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "\\.\\./(adapters|bin)/",
              message: "core is pure — import direction is core -> adapters -> bin only",
            },
            {
              regex: "^(node:)",
              message: "core is pure — Node builtins belong to the adapters",
            },
          ],
        },
      ],
      "no-restricted-globals": [
        "error",
        {
          name: "process",
          message: "core is pure — process belongs to the adapters",
        },
      ],
    },
  },
  {
    // adapters own argv parsing and the process stdio streams; they never
    // reach up into the composition root.
    files: ["src/adapters/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "\\.\\./bin/",
              message: "adapters must not import the bin entry — bin wires the layers",
            },
          ],
        },
      ],
    },
  },
);
