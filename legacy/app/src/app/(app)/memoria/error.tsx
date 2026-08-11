"use client";

import { Box } from "@chakra-ui/react";
import { MemoryEmpty } from "@/components/memory/memory-empty";

/** Segment-level error boundary for Memoria — Spanish copy + retry, never blank. */
export default function MemoriaError({ reset }: { error: Error; reset: () => void }) {
  return (
    <Box display="flex" flexDirection="column" flex="1" minH="0" h="full">
      <MemoryEmpty error onRetry={reset} />
    </Box>
  );
}
