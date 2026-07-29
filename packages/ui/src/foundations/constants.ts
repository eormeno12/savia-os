/**
 * Brand constants — the single source of truth shared across every Savia
 * frontend. App- or page-specific content (nav items, community copy) stays in
 * each app's own `lib/`; only the brand atoms live here.
 */

export const BRAND_COLORS = {
  lime: "#E7FF18",
  ink: "#0B2529",
  paper: "#F4F4F1",
} as const;

/** Savia's signature easing curve — confident overshoot. */
export const EASE_SAVIA = [0.22, 1, 0.36, 1] as const;
