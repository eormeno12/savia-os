"use client";

import Link from "next/link";
import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { Plus } from "lucide-react";
import { useMemoryData } from "./use-memory-data";
import { MemoryMap } from "./memory-map";
import { MemoryEmpty } from "./memory-empty";
import { MemorySkeleton } from "./memory-skeleton";

/**
 * Memoria (M1) orchestrator: resolves the data and routes to the right state —
 * loading skeleton, error, empty hero, the "everything is still in General"
 * moment, or the populated living map. Each state is fully designed; there is
 * no global spinner.
 */
export function MemoriaScreen() {
  const state = useMemoryData();

  if (state.status === "loading") return <MemorySkeleton />;
  if (state.status === "error") return <MemoryEmpty error onRetry={state.reload} />;

  const { areas, total, weekDelta, root, recent, areaNames } = state.data;
  if (total === 0) return <MemoryEmpty />;
  if (areas.length === 0) return <SingleAreaState total={total} rootId={root?.id} />;

  return (
    <MemoryMap
      areas={areas}
      total={total}
      weekDelta={weekDelta}
      root={root}
      recent={recent}
      areaNames={areaNames}
    />
  );
}

/**
 * The portrait before areas emerge: everything rests in General. One lime
 * bubble on the ink canvas plus an explanation — the promise that the map
 * will organize itself as the memory grows.
 */
function SingleAreaState({ total, rootId }: { total: number; rootId?: string }) {
  return (
    <Stack gap="6" flex="1" minH="0">
      <Box>
        <Text textStyle="label" color="fg.muted">
          Tu memoria
        </Text>
        <HStack align="baseline" gap="3.5" mt="2.5">
          <Text textStyle="heroNumber" color="fg">
            {total.toLocaleString("es-AR")}
          </Text>
          <Text textStyle="bodyLg" lineHeight="1.3" color="fg.muted">
            recuerdos · 1 área
          </Text>
        </HStack>
      </Box>

      <Box
        position="relative"
        flex="1"
        minH="420px"
        bg="bg.inverse"
        rounded="card"
        overflow="hidden"
        display="flex"
        alignItems="center"
      >
        <Box
          position="absolute"
          w="420px"
          h="420px"
          rounded="full"
          bg="lime.solid"
          filter="blur(150px)"
          opacity="0.08"
          bottom="-160px"
          insetEnd="-100px"
        />

        <HStack
          gap={{ base: "8", md: "14" }}
          px={{ base: "8", md: "16" }}
          flexWrap="wrap"
          position="relative"
          zIndex="1"
        >
          <Link href={rootId ? `/memoria/${rootId}` : "/memoria"} aria-label="Entrar a General">
            <Box
              w={{ base: "160px", md: "200px" }}
              h={{ base: "160px", md: "200px" }}
              rounded="full"
              bg="lime.solid"
              display="flex"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              color="ink"
              transition="transform 0.22s"
              _hover={{ transform: "scale(1.03)" }}
            >
              <Text fontWeight="600" fontSize="22px">
                General
              </Text>
              <Text fontSize="14px" opacity="0.75" fontVariantNumeric="tabular-nums">
                {total.toLocaleString("es-AR")} recuerdos
              </Text>
            </Box>
          </Link>

          <Box maxW="42ch">
            <Text textStyle="titleLg" color="fg.inverse">
              Todo está en General por ahora.
            </Text>
            <Text fontSize="15px" lineHeight="1.6" color="fg.inverse/70" mt="3">
              Savia descubrirá áreas a medida que creces — o crea una tú cuando quieras.
            </Text>
            <Button colorPalette="lime" mt="6" asChild>
              <Link href="/memoria/nueva">
                <Plus size={15} /> Crear un área
              </Link>
            </Button>
          </Box>
        </HStack>
      </Box>
    </Stack>
  );
}
