import { defineSemanticTokens } from "@chakra-ui/react";

export const semanticTokens = defineSemanticTokens({
  colors: {
    // Override Chakra's defaults to map to Savia's palette.
    // Nested DEFAULT key preserves Chakra's sub-token structure (bg.subtle, fg.muted, etc.).
    bg: {
      DEFAULT: { value: "{colors.paper}" },
      subtle: { value: "{colors.mist}" },
      inset: { value: "rgb(11 37 41 / 0.04)" },
      inverse: { value: "{colors.ink}" },
    },
    fg: {
      DEFAULT: { value: "{colors.ink}" },
      muted: { value: "{colors.slateText}" },
      subtle: { value: "rgb(11 37 41 / 0.48)" },
      inverse: { value: "{colors.paper}" },
    },
    border: {
      DEFAULT: { value: "{colors.line}" },
      subtle: { value: "rgb(11 37 41 / 0.10)" },
      inverse: { value: "rgb(255 255 255 / 0.12)" },
    },

    // Savia colorPalettes — Chakra's Button recipe reads exactly these 8 keys.
    // solid      → background for `variant="solid"`
    // contrast   → text color on solid background
    // fg         → text color for outline / ghost / plain
    // muted      → hover bg for subtle / ghost
    // subtle     → resting bg for subtle variant
    // emphasized → hover bg for surface variant
    // focusRing  → focus outline
    // border     → outline border for `variant="outline"`
    lime: {
      solid: { value: "{colors.signalLime}" },
      contrast: { value: "{colors.ink}" },
      fg: { value: "{colors.softInk}" },
      muted: { value: "rgb(231 255 24 / 0.14)" },
      subtle: { value: "rgb(231 255 24 / 0.08)" },
      emphasized: { value: "{colors.signalLimeSoft}" },
      focusRing: { value: "rgb(231 255 24 / 0.36)" },
      border: { value: "rgb(231 255 24 / 0.40)" },
    },
    ink: {
      solid: { value: "{colors.ink}" },
      contrast: { value: "{colors.paper}" },
      fg: { value: "{colors.ink}" },
      muted: { value: "rgb(11 37 41 / 0.08)" },
      subtle: { value: "rgb(11 37 41 / 0.04)" },
      emphasized: { value: "{colors.softInk}" },
      focusRing: { value: "rgb(11 37 41 / 0.22)" },
      border: { value: "rgb(11 37 41 / 0.20)" },
    },
    mist: {
      solid: { value: "{colors.mist}" },
      contrast: { value: "{colors.ink}" },
      fg: { value: "{colors.slateText}" },
      muted: { value: "rgb(11 37 41 / 0.05)" },
      subtle: { value: "rgb(11 37 41 / 0.03)" },
      emphasized: { value: "{colors.line}" },
      focusRing: { value: "rgb(11 37 41 / 0.12)" },
      border: { value: "{colors.line}" },
    },
  },
});
