"use client";

import {
  createRecipeContext,
  type HTMLChakraProps,
  type RecipeVariantProps,
} from "@chakra-ui/react";
import { cardRecipe } from "@savia-os/design-tokens";

const { withContext } = createRecipeContext({ key: "card" });

type CardVariantProps = RecipeVariantProps<typeof cardRecipe>;

export type CardProps = HTMLChakraProps<"div", CardVariantProps>;

/**
 * The single card surface for the product. Styling lives in the `card` recipe
 * (`@savia-os/design-tokens`); this is just the bound element so screens stop
 * repeating `<Box border borderColor borderRadius="card">`.
 *
 * `variant`: flat | elevated | inverse · `interactive`: hover lift + focus ring.
 */
export const Card = withContext<HTMLDivElement, CardProps>("div");
