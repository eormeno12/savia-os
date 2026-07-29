import type { ReactNode } from "react";
import { Stack, Text } from "@chakra-ui/react";

interface SectionCardProps {
  /** Uppercase kicker at the top of the card (PERFIL / PLAN / …). */
  label: string;
  /** "danger" tints the border + label for the destructive zone. */
  tone?: "default" | "danger";
  children: ReactNode;
}

/**
 * The single white surface used across the Cuenta screen: a soft card on paper
 * with an uppercase kicker. Keeps every section visually in one family so the
 * page reads as one considered document, not a stack of ad-hoc panels.
 */
export function SectionCard({ label, tone = "default", children }: SectionCardProps) {
  const danger = tone === "danger";
  return (
    <Stack
      gap="5"
      bg="bg.panel"
      borderWidth="1px"
      borderColor={danger ? "danger.border" : "border"}
      rounded="2xl"
      p={{ base: "5", md: "7" }}
    >
      <Text textStyle="label" color={danger ? "danger.fg" : "fg.muted"}>
        {label}
      </Text>
      {children}
    </Stack>
  );
}
