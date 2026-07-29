import { Text, type TextProps } from "@chakra-ui/react";

/**
 * Semantic text vocabulary — thin wrappers over the product `textStyle` scale so
 * screens express intent (`<Metric>`, `<CardTitle>`) instead of hand-rolling
 * `fontSize` + `fontWeight` pairs. This is the elegant fix for the ~90 raw-px
 * type sizes the audit found: the vocabulary lives here once; the guardrail
 * (scripts/check-design-tokens) flags any loose `fontSize`+`fontWeight` so the
 * migration trends to zero and can't regress.
 *
 * Each accepts all `TextProps`; defaults (textStyle, semantic color, element)
 * can be overridden by passing the prop — e.g. `<Metric color="lime.solid">`.
 */

/** Screen title — one per page (pageTitle: displayMd, 600). */
export function PageTitle(props: TextProps) {
  return <Text as="h1" textStyle="pageTitle" color="fg" {...props} />;
}

/** Section heading inside a screen (titleLg, 600). */
export function SectionTitle(props: TextProps) {
  return <Text as="h2" textStyle="titleLg" color="fg" {...props} />;
}

/** Card / panel title (cardTitle: lg, 600). */
export function CardTitle(props: TextProps) {
  return <Text as="h3" textStyle="cardTitle" color="fg" {...props} />;
}

/** Big number — counts, KPIs (metric: 3xl, 700, tabular-nums). */
export function Metric(props: TextProps) {
  return <Text textStyle="metric" color="fg" {...props} />;
}

/** Secondary / helper text (caption: sm, muted). */
export function Caption(props: TextProps) {
  return <Text textStyle="caption" color="fg.muted" {...props} />;
}

/** Uppercase eyebrow above a title (label: 12px, 0.12em, 600). */
export function Eyebrow(props: TextProps) {
  return <Text textStyle="label" color="fg.muted" {...props} />;
}
