"use client";

import { useState } from "react";
import {
  Box,
  Text,
  HStack,
  VStack,
  Badge,
  Code,
  IconButton,
  Button,
} from "@chakra-ui/react";
import { Copy, Check } from "lucide-react";

const MCP_URL = process.env.NEXT_PUBLIC_MCP_URL ?? "http://127.0.0.1:4401/mcp";

interface Props {
  token: string;
  connectionLabel: string;
}

type McpClient = "claude-code" | "cursor" | "other";

function getConfig(client: McpClient, token: string, url: string): string {
  if (client === "claude-code") {
    return JSON.stringify(
      {
        mcpServers: {
          savia: {
            type: "http",
            url,
            headers: { Authorization: `Bearer ${token}` },
          },
        },
      },
      null,
      2,
    );
  }
  if (client === "cursor") {
    return JSON.stringify(
      {
        mcpServers: {
          savia: {
            url,
            headers: { Authorization: `Bearer ${token}` },
          },
        },
      },
      null,
      2,
    );
  }
  // Generic MCP config
  return JSON.stringify(
    {
      url,
      headers: { Authorization: `Bearer ${token}` },
    },
    null,
    2,
  );
}

export function McpConfigBlock({ token, connectionLabel }: Props) {
  const [client, setClient] = useState<McpClient>("claude-code");
  const [copied, setCopied] = useState(false);

  const config = getConfig(client, token, MCP_URL);

  async function handleCopy() {
    await navigator.clipboard.writeText(config);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const clients: { id: McpClient; label: string }[] = [
    { id: "claude-code", label: "Claude Code" },
    { id: "cursor", label: "Cursor" },
    { id: "other", label: "Otro" },
  ];

  return (
    <Box
      border="1px solid"
      borderColor="border.subtle"
      borderRadius="card"
      p="5"
      bg="bg"
    >
      <HStack justify="space-between" mb="3">
        <VStack align="flex-start" gap="0">
          <Text fontSize="sm" fontWeight="600" color="fg">{connectionLabel}</Text>
          <Text fontSize="xs" color="fg.muted">Config lista para pegar</Text>
        </VStack>
        <Badge colorPalette="green" variant="subtle" size="sm">activa</Badge>
      </HStack>

      <HStack gap="2" mb="3">
        {clients.map((c) => (
          <Button
            key={c.id}
            size="xs"
            variant={client === c.id ? "solid" : "outline"}
            onClick={() => setClient(c.id)}
          >
            {c.label}
          </Button>
        ))}
      </HStack>

      <Box position="relative">
        <Box
          as="pre"
          bg="bg.subtle"
          border="1px solid"
          borderColor="border.subtle"
          borderRadius="md"
          p="3"
          fontSize="xs"
          fontFamily="mono"
          overflowX="auto"
          color="fg"
          pr="10"
        >
          {config}
        </Box>
        <IconButton
          position="absolute"
          top="2"
          right="2"
          variant="ghost"
          size="xs"
          aria-label="Copiar config"
          onClick={handleCopy}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </IconButton>
      </Box>

      <Text fontSize="xs" color="fg.muted" mt="3">
        Pega esta config en tu herramienta de IA. El servidor MCP está en{" "}
        <Code fontSize="xs">{MCP_URL}</Code>.
      </Text>
    </Box>
  );
}
