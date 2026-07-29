import { defineSemanticTokens } from "@chakra-ui/react";

export const semanticTokens = defineSemanticTokens({
  colors: {
    // Override Chakra's defaults to map to SAVIA's palette.
    // Nested DEFAULT key preserves Chakra's sub-token structure (bg.subtle, fg.muted, etc.).
    bg: {
      DEFAULT: { value: "{colors.paper}" },
      subtle: { value: "{colors.mist}" },
      inset: { value: "rgb(11 37 41 / 0.04)" },
      inverse: { value: "{colors.ink}" },
      // White panels (rail, top bar, cards) layered over the paper canvas —
      // the mockup's surface hierarchy: paper bg → white panels → ink accents.
      panel: { value: "{colors.white}" },
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

    // SAVIA colorPalettes — Chakra's Button recipe reads exactly these 8 keys.
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

    // State palettes — same 8-key shape as above so Chakra's Button/Badge
    // recipes read them directly (colorPalette="success" | "warning" | …).
    // Used for status, validation, deltas — never raw `green.500` again.
    success: {
      solid: { value: "{colors.success}" },
      contrast: { value: "{colors.paper}" },
      fg: { value: "{colors.successInk}" },
      muted: { value: "rgb(62 142 90 / 0.14)" },
      subtle: { value: "rgb(62 142 90 / 0.08)" },
      emphasized: { value: "{colors.successInk}" },
      focusRing: { value: "rgb(62 142 90 / 0.36)" },
      border: { value: "rgb(62 142 90 / 0.40)" },
    },
    warning: {
      solid: { value: "{colors.warning}" },
      contrast: { value: "{colors.ink}" },
      fg: { value: "{colors.warningInk}" },
      muted: { value: "rgb(201 133 42 / 0.16)" },
      subtle: { value: "rgb(201 133 42 / 0.10)" },
      emphasized: { value: "{colors.warningInk}" },
      focusRing: { value: "rgb(201 133 42 / 0.36)" },
      border: { value: "rgb(201 133 42 / 0.42)" },
    },
    danger: {
      solid: { value: "{colors.danger}" },
      contrast: { value: "{colors.paper}" },
      fg: { value: "{colors.dangerInk}" },
      muted: { value: "rgb(214 72 59 / 0.14)" },
      subtle: { value: "rgb(214 72 59 / 0.08)" },
      emphasized: { value: "{colors.dangerInk}" },
      focusRing: { value: "rgb(214 72 59 / 0.36)" },
      border: { value: "rgb(214 72 59 / 0.40)" },
    },
    info: {
      solid: { value: "{colors.info}" },
      contrast: { value: "{colors.paper}" },
      fg: { value: "{colors.infoInk}" },
      muted: { value: "rgb(46 107 122 / 0.14)" },
      subtle: { value: "rgb(46 107 122 / 0.08)" },
      emphasized: { value: "{colors.infoInk}" },
      focusRing: { value: "rgb(46 107 122 / 0.36)" },
      border: { value: "rgb(46 107 122 / 0.40)" },
    },

    // Status tokens — semantic aliases for file/ingest lifecycle, consumed by
    // StatusBadge. Maps lifecycle → readable foreground tone.
    status: {
      pending: { value: "{colors.slateText}" },
      processing: { value: "{colors.warningInk}" },
      indexed: { value: "{colors.successInk}" },
      failed: { value: "{colors.dangerInk}" },
    },
  },

  // Control radii — Chakra's Button / Input / Select / Textarea / Tag recipes all
  // read `borderRadius: "l2"` (large controls use "l3"). Chakra's default maps
  // l2 → {radii.sm} → 4px, which flattened EVERY control to sharp corners. We own
  // the control rung here so the soft, rounded controls of the mockup (11–14px)
  // land across the whole product from one place — no per-component styling.
  radii: {
    l1: { value: "10px" }, // xs / sm controls
    l2: { value: "12px" }, // default — buttons, inputs, selects, tags, menus
    l3: { value: "14px" }, // lg controls
  },
});
