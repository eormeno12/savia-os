import { Box, HStack, Stack } from "@chakra-ui/react";
import { Skeleton } from "@savia-os/ui";

/** Plausible circle positions for the loading map (mockup skeleton frame). */
const BLOBS = [
  { left: "8%", top: "32%", size: 180 },
  { left: "30%", top: "16%", size: 150 },
  { left: "34%", top: "55%", size: 115 },
  { left: "52%", top: "28%", size: 125 },
  { left: "68%", top: "18%", size: 88 },
  { left: "70%", top: "50%", size: 80 },
  { left: "83%", top: "33%", size: 64 },
];

/**
 * M1 loading state: a silhouette of the whole screen, not a spinner. The ink
 * canvas appears immediately with faint circular placeholders — the shape of
 * the portrait is felt before the data lands — and the "Recientes" strip
 * reserves its row so nothing jumps.
 */
export function MemorySkeleton() {
  return (
    <Stack gap="6" flex="1" minH="0">
      <Box>
        <Skeleton w="90px" h="13px" />
        <Skeleton w="280px" h="52px" mt="3.5" />
      </Box>
      <Box position="relative" flex="1" minH="420px" bg="bg.inverse" rounded="card" overflow="hidden">
        {BLOBS.map((b, i) => (
          <Box
            key={i}
            position="absolute"
            left={b.left}
            top={b.top}
            w={`${b.size}px`}
            h={`${b.size}px`}
            rounded="full"
            bg="border.inverse"
          />
        ))}
      </Box>
      <Box>
        <Skeleton w="220px" h="13px" mb="3" />
        <HStack gap="3" align="stretch">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} flex="1" h="76px" rounded="xl" />
          ))}
        </HStack>
      </Box>
    </Stack>
  );
}
