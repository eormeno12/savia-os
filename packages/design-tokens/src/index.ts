import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";
import { tokens } from "./tokens";
import { semanticTokens } from "./semantic-tokens";
import { textStyles } from "./text-styles";
import { cardRecipe } from "./recipes/card";
import { inputRecipe } from "./recipes/input";
import { marketingButtonRecipe } from "./recipes/button";

const config = defineConfig({
  globalCss: {
    "html, body": {
      minWidth: "320px",
    },
    html: {
      scrollBehavior: "smooth",
      overflowX: "hidden",
    },
    body: {
      bg: "bg",
      color: "fg",
      fontFamily: "body",
      textRendering: "geometricPrecision",
    },
    "::selection": {
      background: "rgb(11 37 41 / 0.14)",
    },
    ".skip-link": {
      position: "fixed",
      left: "-9999px",
      top: "1rem",
      zIndex: 9999,
      background: "#0B2529",
      color: "#F4F4F1",
      padding: "0.5rem 1rem",
      borderRadius: "0.375rem",
      fontSize: "0.875rem",
      fontWeight: "600",
      textDecoration: "none",
      "&:focus-visible": {
        left: "1rem",
        outline: "2px solid #E7FF18",
        outlineOffset: "4px",
      },
    },
  },
  theme: {
    tokens,
    semanticTokens,
    textStyles,
    recipes: {
      card: cardRecipe,
      input: inputRecipe,
    },
  },
});

export const system = createSystem(defaultConfig, config);

/**
 * Marketing-surface system — same tokens/recipes as `system`, plus the
 * button overlay (pill + semibold) that makes every CTA on the landing
 * surface consistent by construction. Used only by apps/landing's provider;
 * apps/app renders under the plain `system` above.
 */
const marketingConfig = defineConfig({
  theme: {
    recipes: {
      button: marketingButtonRecipe,
    },
  },
});

export const marketingSystem = createSystem(defaultConfig, config, marketingConfig);

// Barrel: expose the raw token sources so consumers (preview generators,
// design tooling) can read them without re-importing each file.
export { tokens } from "./tokens";
export { semanticTokens } from "./semantic-tokens";
export { textStyles } from "./text-styles";
export { cardRecipe } from "./recipes/card";
