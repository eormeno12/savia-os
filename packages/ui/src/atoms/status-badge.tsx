"use client";

import type { ReactNode } from "react";
import { Badge, HStack } from "@chakra-ui/react";

export type StatusTone = "neutral" | "success" | "warning" | "danger" | "info";

const TONE_PALETTE: Record<StatusTone, string> = {
  neutral: "mist",
  success: "success",
  warning: "warning",
  danger: "danger",
  info: "info",
};

export interface StatusBadgeProps {
  tone?: StatusTone;
  /** Icon paired with the label — status is never conveyed by color alone. */
  icon?: ReactNode;
  children: ReactNode;
}

/**
 * Accessible status pill: always icon + text, colored from the brand state
 * palettes. Never relies on color alone (WCAG 1.4.1).
 */
export function StatusBadge({ tone = "neutral", icon, children }: StatusBadgeProps) {
  return (
    <Badge
      colorPalette={TONE_PALETTE[tone]}
      variant="subtle"
      borderRadius="chip"
      px="2.5"
      py="1"
    >
      <HStack gap="1.5">
        {icon}
        {children}
      </HStack>
    </Badge>
  );
}
