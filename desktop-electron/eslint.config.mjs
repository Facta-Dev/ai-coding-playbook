// <app> — ESLint 9 flat config.
//
// Three layers of rules:
//   - type-aware TypeScript rules over the five source surfaces, the build
//     configs and the tests;
//   - the trust-zone walls: the renderer, the feature domain/application and
//     the preload bridge may not reach for electron, node:* or the SDK —
//     platform access routes through src/platform/** and the preload bridge
//     (PLAYBOOK_DESKTOP_ELECTRON §2, §3, §6);
//   - the slice rule: features are sealed, one slice never imports another.
//
// Every rule is scoped by directory, never by file name, so a new file can be
// added without touching this config. Module-level walls are also enforced by
// dependency-cruiser (same file, same walls): ESLint guards the import
// statements and the bare globals, depcruise guards the graph.
import js from "@eslint/js";
import eslintComments from "@eslint-community/eslint-plugin-eslint-comments";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "dist-*/**",
      "out/**",
      "coverage/**",
      "node_modules/**",
      ".claude/**",
      "**/*.cjs",
      "tests/e2e/**",
    ],
  },
  js.configs.recommended,
  {
    // The two eslint-comments rules the playbook pins: every disable is
    // scoped to listed rules and every disable carries a description.
    plugins: { "@eslint-community/eslint-comments": eslintComments },
    rules: {
      "@eslint-community/eslint-comments/no-unlimited-disable": "error",
      "@eslint-community/eslint-comments/require-description": "error",
    },
  },
  {
    // TypeScript files outside the type-aware set still need the TS parser.
    files: ["**/*.{ts,tsx}"],
    languageOptions: { parser: tseslint.parser },
  },
  {
    // Type-aware rules: sources, build configs and tests. The tsconfig list
    // mirrors `pnpm typecheck` — one program per Electron surface.
    files: [
      "src/**/*.{ts,tsx}",
      "tests/**/*.{ts,tsx}",
      "packages/**/*.{ts,tsx}",
      "forge.config.ts",
      "vite.*.config.ts",
      "vitest.config.ts",
    ],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        project: [
          "./tsconfig.main.json",
          "./tsconfig.core.json",
          "./tsconfig.preload.json",
          "./tsconfig.renderer.json",
          "./tsconfig.test.json",
          "./packages/sdk/tsconfig.json",
        ],
        tsconfigRootDir: import.meta.dirname,
      },
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
    // Renderer surface (views, ui-kit, view models, the browser port): no
    // electron, no node built-ins, no SDK import, no process/require. Renderer
    // platform access goes through the preload bridge (window.hmd), and the
    // SDK ships to the core, not to the browser context.
    files: [
      "src/renderer/**/*.{ts,tsx}",
      "src/ui-kit/**/*.{ts,tsx}",
      "src/features/**/views/**/*.{ts,tsx}",
      "src/features/**/viewmodels/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["electron", "electron/*"],
              message: "the renderer never touches electron — go through the preload bridge.",
            },
            { regex: "^node:", message: "node built-ins do not exist in the renderer." },
            {
              group: ["@/sdk", "@/sdk/*", "packages/sdk", "@hmd/sdk"],
              message: "the SDK ships to the core process — talk to it over the typed RPC.",
            },
          ],
        },
      ],
      "no-restricted-globals": [
        "error",
        { name: "process", message: "the renderer has no Node process — use window.hmd.platform." },
        { name: "require", message: "the renderer has no module system — use ESM imports." },
      ],
    },
  },
  {
    // Feature domain and application: pure TypeScript. The same walls again —
    // electron import and any Node built-in — because these layers must stay
    // runnable (and testable) without Electron.
    files: ["src/features/**/domain/**/*.ts", "src/features/**/application/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["electron", "electron/*"],
              message: "the domain and application never import electron.",
            },
            { regex: "^node:", message: "node built-ins stay in platform and infrastructure." },
          ],
        },
      ],
      "no-restricted-globals": [
        "error",
        { name: "process", message: "the domain and application must not depend on the Node runtime." },
        { name: "require", message: "the domain and application must not depend on the Node runtime." },
      ],
    },
  },
  {
    // Preload bridge: thin enough to audit in one sitting. It may not import
    // the renderer (it must stay independent of browser code) or the core
    // internals (the bridge speaks the contract layer, nothing else).
    files: ["src/preload/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["src/renderer/*", "@features/*", "@platform/*", "@/*"],
              message: "the preload bridge imports contracts and shared-kernel only.",
            },
            {
              group: ["../core/*", "../../core/*"],
              message: "the preload bridge must not reach into core internals.",
            },
          ],
        },
      ],
    },
  },
  {
    // Features are sealed: a feature never imports another feature. Import
    // inside your own slice with a relative path; the composition root wires
    // the slices together.
    files: ["src/features/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^@features/",
              message: "features are sealed — import inside your own slice with a relative path",
            },
          ],
        },
      ],
    },
  },
);
