"use client";

import { HStack, Progress } from "@chakra-ui/react";
import type { ReactNode } from "react";

export interface ProgressBarProps extends Progress.RootProps {
  /** Optional label shown above the track. */
  label?: ReactNode;
  /** Show the numeric value text next to the label. */
  showValue?: boolean;
}

/**
 * Linear progress / share bar built on Chakra's Progress. Use for upload
 * progress (F1/O2) and area share-of-memory (M1 list). Color comes from
 * `colorPalette` — inject a space's palette for share bars.
 */
export function ProgressBar({ label, showValue, ...rest }: ProgressBarProps) {
  return (
    <Progress.Root {...rest}>
      {(label != null || showValue) && (
        <HStack justify="space-between" mb="1.5">
          {label != null ? <Progress.Label>{label}</Progress.Label> : <span />}
          {showValue && <Progress.ValueText />}
        </HStack>
      )}
      <Progress.Track>
        <Progress.Range />
      </Progress.Track>
    </Progress.Root>
  );
}
