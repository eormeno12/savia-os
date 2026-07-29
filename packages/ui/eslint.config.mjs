import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

/**
 * Flat ESLint config for @savia-os/ui (the shared component library).
 * TypeScript + React rules, no type-aware linting (fast, no project service).
 * The "tokens or nothing" color guardrail lives in scripts/check-design-tokens.mjs.
 */
export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "*.config.mjs"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { react, "react-hooks": reactHooks },
    settings: { react: { version: "detect" } },
    rules: {
      ...react.configs.flat.recommended.rules,
      // React 19 + automatic JSX runtime: no need to import React in scope.
      "react/react-in-jsx-scope": "off",
      "react/jsx-uses-react": "off",
      // TypeScript owns prop validation.
      "react/prop-types": "off",
      // Hooks correctness — non-negotiable.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
);
