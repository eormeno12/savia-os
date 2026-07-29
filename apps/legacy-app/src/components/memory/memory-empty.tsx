"use client";

import Link from "next/link";
import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";

/** Decorative version of the Memoria nav glyph, for the empty hero. */
function MemoryGlyph({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      aria-hidden
    >
      <circle cx="9" cy="9" r="5" />
      <circle cx="17" cy="16" r="3.2" />
    </svg>
  );
}

interface MemoryEmptyProps {
  /** Error variant: same shell, retry-first copy and action. */
  error?: boolean;
  onRetry?: () => void;
}

/**
 * M1 empty / error state (mockup "Sin memoria"): a warm invitation, never a
 * blank screen. The dashed glyph + light display heading match the mockup; the
 * error variant swaps copy and offers a retry.
 */
export function MemoryEmpty({ error, onRetry }: MemoryEmptyProps) {
  return (
    <Stack
      flex="1"
      align="center"
      justify="center"
      textAlign="center"
      gap="0"
      px={{ base: "6", md: "14" }}
      minH="60vh"
    >
      <Box
        w="96px"
        h="96px"
        rounded="full"
        borderWidth="2px"
        borderStyle="dashed"
        borderColor="border"
        display="flex"
        alignItems="center"
        justifyContent="center"
        color="fg.muted"
      >
        <MemoryGlyph />
      </Box>

      <Text fontWeight="300" fontSize="displayMd" lineHeight="1.05" color="fg" mt="7">
        {error ? "No pudimos cargar tu memoria." : "Tu memoria está vacía — por ahora."}
      </Text>
      <Text fontSize="bodyLg" lineHeight="1.6" color="fg.muted" mt="4" maxW="46ch">
        {error
          ? "Algo falló al traer tus áreas. Prueba de nuevo en un momento."
          : "Conecta una IA o suma tus conversaciones. Savia las absorbe y arma tu mapa de áreas sola."}
      </Text>

      <HStack gap="3" mt="7.5">
        {error ? (
          <Button colorPalette="ink" onClick={onRetry}>
            Reintentar
          </Button>
        ) : (
          <>
            <Button colorPalette="ink" asChild>
              <Link href="/conexiones/nueva">Conectar mi primera IA</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/fuentes">Sumar fuentes</Link>
            </Button>
          </>
        )}
      </HStack>
    </Stack>
  );
}
