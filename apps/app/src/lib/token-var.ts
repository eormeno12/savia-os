import { system } from "@savia-os/design-tokens";

/**
 * Resolve a design token to its CSS variable reference (e.g.
 * `colors.spaceScale.8` → `var(--chakra-colors-space-scale-8)`).
 *
 * The memory map renders raw `<svg>` elements that can't take Chakra token
 * props, so it depends on the token *system* (not hex literals) to stay inside
 * the "tokens or nothing" rule. This is the single bridge from tokens to SVG.
 */
export function tokenVar(path: string): string {
  return system.token.var(path);
}
