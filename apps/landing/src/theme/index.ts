import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";
import { tokens } from "./tokens";
import { semanticTokens } from "./semantic-tokens";
import { textStyles } from "./text-styles";

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
  },
});

export const system = createSystem(defaultConfig, config);
