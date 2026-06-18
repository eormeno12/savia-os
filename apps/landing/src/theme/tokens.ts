import { defineTokens } from "@chakra-ui/react";

export const tokens = defineTokens({
  colors: {
    // Savia brand palette — raw values, no alpha variants needed.
    // Use CSS color-mix or inline opacity (e.g. bg="ink/8") for transparency.
    ink: { value: "#0B2529" },
    softInk: { value: "#152F34" },
    paper: { value: "#F4F4F1" },
    signalLime: { value: "#E7FF18" },
    signalLimeSoft: { value: "#F1FF67" },
    mist: { value: "#ECEDEA" },
    line: { value: "#DDDFDC" },
    slateText: { value: "#53606C" },
  },

  fonts: {
    heading: { value: "var(--font-inter), system-ui, sans-serif" },
    body: { value: "var(--font-inter), system-ui, sans-serif" },
  },

  // Fluid display scale — fills the gap above Chakra's 6xl (3.75rem).
  // Chakra already handles xs → 7xl; only add what doesn't exist.
  fontSizes: {
    displayXl: { value: "clamp(40px, 4.8vw, 80px)" },
    display2xl: { value: "clamp(2.35rem, 5vw, 5rem)" },
    display3xl: { value: "clamp(2.75rem, 6vw, 6rem)" },
    display4xl: { value: "clamp(4.3rem, 10vw, 7.4rem)" },
    displayLg: { value: "clamp(36px, 4vw, 64px)" },
    displayMd: { value: "clamp(2rem, 3.4vw, 3.35rem)" },
    titleLg: { value: "clamp(20px, 1.6vw, 32px)" },
    bodyLg: { value: "clamp(16px, 1.1vw, 20px)" },
  },

  // Savia-specific semantic radii.
  // Chakra already covers: none, sm(4px), md(6px), lg(8px), xl(12px),
  // 2xl(16px), 3xl(24px), full(9999px). Only add what's genuinely missing.
  radii: {
    card: { value: "28px" },
    panel: { value: "40px" },
    message: { value: "22px" },
    chip: { value: "16px" },
  },

  // Savia depth vocabulary — supplements Chakra's xs/sm/md/lg/xl/2xl shadows.
  shadows: {
    soft: { value: "0 18px 70px rgb(11 37 41 / 0.08)" },
    float: { value: "0 34px 110px rgb(11 37 41 / 0.14)" },
    inset: { value: "inset 0 1px 0 rgb(255 255 255 / 0.72)" },
    controlKnob: { value: "0 1px 4px rgb(11 37 41 / 0.16)" },
  },

  // Fluid section + stack rhythm — not in Chakra's 0–96 spacing scale.
  spacing: {
    sectionY: { value: "clamp(5rem, 8vw, 9rem)" },
    sectionYTight: { value: "clamp(3.5rem, 6vw, 6.5rem)" },
    sectionYLoose: { value: "clamp(6.5rem, 10vw, 11rem)" },
    stackXs: { value: "clamp(8px, 1vw, 16px)" },
    stackSm: { value: "clamp(16px, 1.5vw, 24px)" },
    stackMd: { value: "clamp(24px, 2vw, 32px)" },
    stackLg: { value: "clamp(32px, 3vw, 48px)" },
    stackXl: { value: "clamp(48px, 5vw, 80px)" },
    gridGap: { value: "clamp(16px, 2vw, 24px)" },
    surfacePadding: { value: "clamp(24px, 2vw, 32px)" },
  },

  // Fluid container widths with viewport-responsive side margins.
  sizes: {
    container: {
      value: "min(calc(100% - clamp(2.5rem, 10vw, 12rem)), 78rem)",
    },
    containerWide: {
      value: "min(calc(100% - clamp(2.5rem, 10vw, 12rem)), 108rem)",
    },
    containerNarrow: {
      value: "min(calc(100% - clamp(2.5rem, 10vw, 12rem)), 62rem)",
    },
  },

  easings: {
    savia: { value: "cubic-bezier(0.22, 1, 0.36, 1)" },
  },

  durations: {
    fast: { value: "160ms" },
    soft: { value: "260ms" },
    slow: { value: "700ms" },
  },
});
