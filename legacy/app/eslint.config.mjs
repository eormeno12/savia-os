import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import nextPlugin from "@next/eslint-plugin-next";
import globals from "globals";

/**
 * Flat ESLint config for @savia-os/app (Next.js 16 App Router).
 * `next lint` is removed in Next 16, so we lint with ESLint directly:
 * TypeScript + React + React Hooks + Next core-web-vitals rules.
 * The "tokens or nothing" color guardrail lives in scripts/check-design-tokens.mjs.
 */
export default tseslint.config(
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts", "*.config.mjs"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { react, "react-hooks": reactHooks, "@next/next": nextPlugin },
    settings: { react: { version: "detect" } },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      // React 19 + automatic JSX runtime.
      "react/react-in-jsx-scope": "off",
      "react/jsx-uses-react": "off",
      "react/no-unknown-property": "off", // SVG/Chakra props
      "react/prop-types": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
);
