"use client";

import { useState } from "react";
import { chakra, HStack, Stack, Text } from "@chakra-ui/react";
import { CopyBlock } from "@savia-os/ui";
import { MCP_CLIENTS, mcpConfig, type McpClient } from "@/lib/mcp-config";

interface McpConfigProps {
  token: string;
}

/**
 * C3 — per-client MCP config: pick your IA, copy the exact config to paste. The
 * token is the connection secret; it's only shown here, once.
 */
export function McpConfig({ token }: McpConfigProps) {
  const [client, setClient] = useState<McpClient>("claude-code");

  return (
    <Stack gap="3">
      <HStack gap="0" bg="bg.subtle" rounded="lg" p="1" alignSelf="flex-start" role="group" aria-label="Cliente de IA">
        {MCP_CLIENTS.map((c) => {
          const selected = client === c.id;
          return (
            <chakra.button
              key={c.id}
              type="button"
              aria-pressed={selected}
              onClick={() => setClient(c.id)}
              px="3.5"
              py="2"
              rounded="md"
              fontSize="13px"
              fontWeight="600"
              cursor="pointer"
              color={selected ? "fg" : "fg.muted"}
              bg={selected ? "bg.panel" : "transparent"}
              shadow={selected ? "xs" : "none"}
            >
              {c.label}
            </chakra.button>
          );
        })}
      </HStack>
      <CopyBlock value={mcpConfig(client, token)} copyLabel="Copiar configuración" />
      <Text fontSize="12px" color="fg.muted">
        Pega esto en la configuración MCP de tu IA. La conexión se verifica sola en cuanto la uses.
      </Text>
    </Stack>
  );
}
