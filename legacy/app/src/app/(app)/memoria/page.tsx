import { Box } from "@chakra-ui/react";
import { MemoriaScreen } from "@/components/memory/memoria-screen";

/**
 * Memoria (M1) — the living map of the user's memory. The screen is a client
 * orchestrator (auth-scoped, dynamic data) that renders every state itself.
 */
export default function MemoriaPage() {
  return (
    <Box display="flex" flexDirection="column" flex="1" minH="0" h="full">
      <MemoriaScreen />
    </Box>
  );
}
