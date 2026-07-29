"use client";

import { chakra } from "@chakra-ui/react";

/**
 * Shell navigation item. Generic and routing-agnostic: use `asChild` to wrap a
 * Next.js `<Link>` so the styles land on the anchor.
 *
 * `tone` matches the shell surface:
 *  - light (paper rail): active = ink pill, lime text.
 *  - dark  (ink rail):   active = lime pill, ink text.
 * All tokens, no raw values.
 */
export const NavItem = chakra("a", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "3",
    px: "3",
    py: "3",
    borderRadius: "xl",
    fontWeight: "medium",
    cursor: "pointer",
    transitionProperty: "background, color",
    transitionDuration: "fast",
    transitionTimingFunction: "savia",
    "& svg": { flexShrink: 0 },
    _focusVisible: {
      outline: "2px solid",
      outlineColor: "ink",
      outlineOffset: "2px",
    },
  },
  variants: {
    tone: {
      light: {
        color: "fg.muted",
        _hover: { bg: "bg.subtle", color: "fg" },
      },
      dark: {
        color: "fg.inverse/65",
        _hover: { bg: "fg.inverse/8", color: "fg.inverse" },
      },
    },
    active: {
      true: {},
      false: {},
    },
  },
  compoundVariants: [
    {
      tone: "light",
      active: true,
      css: {
        bg: "bg.inverse",
        color: "lime.solid",
        _hover: { bg: "bg.inverse", color: "lime.solid" },
      },
    },
    {
      tone: "dark",
      active: true,
      css: {
        bg: "lime.solid",
        color: "ink.solid",
        _hover: { bg: "lime.solid", color: "ink.solid" },
      },
    },
  ],
  defaultVariants: {
    tone: "light",
    active: false,
  },
});
