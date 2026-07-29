import { Box } from "@chakra-ui/react";
import { MemorySkeleton } from "@/components/memory/memory-skeleton";

/** Streamed loading UI for the Memoria segment (no global spinner). */
export default function MemoriaLoading() {
  return (
    <Box display="flex" flexDirection="column" flex="1" minH="0" h="full">
      <MemorySkeleton />
    </Box>
  );
}
