// <app> - ESLint 9 flat config.
//
// Two layers of rules:
//   - type-aware TypeScript rules over the sources, the build configs and the
//     tests;
//   - the React-free layer walls of PLAYBOOK_FRONTEND §1.1: core, the SDK and
//     the ViewModels never import react / react-dom / react-native. The
//     relative-import direction between layers (views -> viewmodels -> sdk ->
//     core) is enforced by the vitest architecture test, which can resolve
//     import specifiers to files; ESLint only guards the external module
//     names here.
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
    // TypeScript files outside the type-aware set still need the TS parser.
    files: ["**/*.{ts,tsx}"],
    languageOptions: { parser: tseslint.parser },
  },
  {
    // Type-aware rules: sources, build configs and tests.
    files: [
      "src/**/*.{ts,tsx}",
      "tests/**/*.{ts,tsx}",
      "vite.config.ts",
      "vitest.config.ts",
    ],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.json", "./tsconfig.test.json"],
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.browser },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    // Node-side files: build configs, tests and the evals.
    files: [
      "vite.config.ts",
      "vitest.config.ts",
      "**/*.config.mjs",
      "tests/**/*.{ts,tsx}",
      "evals/**/*.{ts,mjs}",
      "scripts/**/*.{ts,mjs}",
    ],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // The SDK is platform-agnostic (PLAYBOOK_FRONTEND §1.1): it ships to every
    // context and never imports React or any platform global.
    files: ["src/sdk/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "react", message: "the SDK is platform-agnostic: no React (PLAYBOOK_FRONTEND §1.1)." },
            { name: "react-dom", message: "the SDK is platform-agnostic: no React DOM (PLAYBOOK_FRONTEND §1.1)." },
            { name: "react-native", message: "the SDK is platform-agnostic: no React Native (PLAYBOOK_FRONTEND §1.1)." },
          ],
        },
      ],
    },
  },
  {
    // core holds ports and pure types only (PLAYBOOK_FRONTEND §1.1): it imports
    // nothing but itself.
    files: ["src/core/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "react", message: "core holds ports and pure types only (PLAYBOOK_FRONTEND §1.1)." },
            { name: "react-dom", message: "core holds ports and pure types only (PLAYBOOK_FRONTEND §1.1)." },
            { name: "react-native", message: "core holds ports and pure types only (PLAYBOOK_FRONTEND §1.1)." },
          ],
        },
      ],
    },
  },
  {
    // ViewModels are React-free (PLAYBOOK_FRONTEND §1.1): the React hook
    // binding lives in views/ (src/views/useLeadDetailViewModel.ts), so the
    // ViewModel stays identical across web, native and extension.
    files: ["src/viewmodels/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "react", message: "ViewModels are React-free: the hook binding lives in views/ (PLAYBOOK_FRONTEND §1.1)." },
            { name: "react-dom", message: "ViewModels never touch react-dom (PLAYBOOK_FRONTEND §1.1)." },
            { name: "react-native", message: "ViewModels never touch react-native (PLAYBOOK_FRONTEND §1.1)." },
          ],
        },
      ],
    },
  },
  {
    // This is the web SPA kit; react-native belongs to the mobile kit.
    files: ["src/views/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "react-native", message: "this is the web SPA kit; react-native lives in the mobile kit." },
          ],
        },
      ],
    },
  },
);
