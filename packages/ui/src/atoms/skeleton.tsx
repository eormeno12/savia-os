"use client";

import { Skeleton, SkeletonText, Stack } from "@chakra-ui/react";

export { Skeleton, SkeletonText };

export interface CardSkeletonProps {
  /** Number of placeholder cards to render. */
  count?: number;
  height?: string;
}

/**
 * Card-shaped loading placeholder — the default for grids/lists instead of a
 * centered spinner, so layout stays stable while data loads.
 */
export function CardSkeleton({ count = 3, height = "140px" }: CardSkeletonProps) {
  return (
    <Stack gap="4">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} height={height} borderRadius="card" />
      ))}
    </Stack>
  );
}
