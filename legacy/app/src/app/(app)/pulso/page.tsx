import { Box } from "@chakra-ui/react";
import { PulsoScreen } from "@/components/pulso/pulso-screen";

/** P1 — Pulso: the live activity of your memory (ink surface). */
export default function PulsoPage() {
  return (
    <Box display="flex" flexDirection="column" flex="1" minH="0" h="full">
      <PulsoScreen />
    </Box>
  );
}
