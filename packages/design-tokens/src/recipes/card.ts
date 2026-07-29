import { defineRecipe } from "@chakra-ui/react";

/**
 * The product's single card surface, as a Chakra recipe so the variant matrix
 * lives in the theme (not in inline conditionals) and any element can become a
 * card via `colorPalette`-style props. Replaces the prop-styled Card.
 *
 * - `variant`: surface treatment (flat border · elevated shadow · dark ink).
 * - `interactive`: adds the hover lift + focus ring for clickable cards.
 *
 * All motion comes from tokens (`durations.fast`, `easings.savia`) — no raw
 * cubic-bezier / ms literals.
 */
export const cardRecipe = defineRecipe({
  className: "savia-card",
  base: {
    borderRadius: "card",
    p: "surfacePadding",
    transitionProperty: "transform, box-shadow",
    transitionDuration: "fast",
    transitionTimingFunction: "savia",
  },
  variants: {
    variant: {
      flat: {
        bg: "bg",
        color: "fg",
        borderWidth: "1px",
        borderColor: "border.subtle",
      },
      elevated: {
        bg: "bg",
        color: "fg",
        borderWidth: "1px",
        borderColor: "border.subtle",
        boxShadow: "soft",
      },
      inverse: {
        bg: "bg.inverse",
        color: "fg.inverse",
        boxShadow: "floatDark",
      },
    },
    interactive: {
      true: {
        cursor: "pointer",
        _hover: { transform: "translateY(-2px)", boxShadow: "float" },
        _focusVisible: {
          outline: "2px solid",
          outlineColor: "ink",
          outlineOffset: "2px",
        },
      },
      false: {},
    },
  },
  defaultVariants: {
    variant: "flat",
    interactive: false,
  },
});
