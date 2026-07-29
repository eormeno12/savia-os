import { defineRecipe } from "@chakra-ui/react";

/**
 * Input recipe override — extends Chakra's built-in `input` recipe (createSystem
 * deep-merges by key, so sizes/variants are preserved). Two jobs:
 *  1. Pin the resting `outline` border to the brand `line` token (`border`).
 *  2. Add a `dark-form` variant for inputs on ink surfaces — replaces the
 *     inline `darkInput` object the audit found in the auth form.
 */
export const inputRecipe = defineRecipe({
  base: {
    borderColor: "border",
  },
  variants: {
    variant: {
      outline: {
        borderColor: "border",
      },
      "dark-form": {
        bg: "fg.inverse/8",
        borderColor: "fg.inverse/15",
        color: "fg.inverse",
        _placeholder: { color: "fg.inverse/40" },
        _hover: { borderColor: "fg.inverse/25" },
        _focusVisible: { borderColor: "signalLime" },
      },
    },
  },
});
