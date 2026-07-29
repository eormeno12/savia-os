import { defineRecipe } from "@chakra-ui/react";

/**
 * Marketing-surface overlay for Chakra's built-in button recipe (deep-merged
 * by `createSystem`, so sizes/colorPalette/loading state are preserved).
 *
 * The product surface (apps/app) never sees this — its buttons stay on the
 * shared control-radius family (`radii.l2`, same as Input/Select/Tag) so they
 * read as one control language with a real primary/secondary/ghost hierarchy.
 *
 * Landing's buttons are, without exception, CTAs — pill + semibold is a
 * property of the marketing surface itself, not a per-button choice, so it
 * lives here as a system-level default rather than a variant a call site
 * could opt into (or accidentally leave off).
 */
export const marketingButtonRecipe = defineRecipe({
  base: {
    borderRadius: "full",
    fontWeight: "semibold",
  },
});
