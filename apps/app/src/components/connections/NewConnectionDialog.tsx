"use client";

import { useState } from "react";
import {
  Box,
  Button,
  Input,
  Text,
  HStack,
  VStack,
  Checkbox,
  Code,
  IconButton,
  Separator,
} from "@chakra-ui/react";
import { Copy, Check } from "lucide-react";
import { api } from "@/lib/api";

interface SpaceDto {
  id: string; name: string; memoryCount: number;
}

interface Props {
  spaces: SpaceDto[];
  onCreated: () => void;
  onClose: () => void;
}

export function NewConnectionDialog({ spaces, onCreated, onClose }: Props) {
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedSpaces, setSelectedSpaces] = useState<Set<string>>(new Set());
  const [savingGrants, setSavingGrants] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setLoading(true);
    try {
      const res = await api.connections.create(label.trim());
      setToken(res.token);
      setConnectionId(res.id);
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!token) return;
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function toggleSpace(id: string) {
    setSelectedSpaces((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleFinish() {
    if (!connectionId) return;
    setSavingGrants(true);
    try {
      await Promise.all(
        Array.from(selectedSpaces).map((spaceId) =>
          api.connections.addGrant(connectionId, spaceId),
        ),
      );
      onCreated();
    } finally {
      setSavingGrants(false);
    }
  }

  return (
    <Box
      position="fixed"
      inset="0"
      bg="blackAlpha.600"
      zIndex="overlay"
      display="flex"
      alignItems="center"
      justifyContent="center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <Box
        bg="bg"
        borderRadius="xl"
        p="6"
        w="full"
        maxW="480px"
        mx="4"
        boxShadow="xl"
      >
        {!token ? (
          <>
            <Text fontWeight="700" fontSize="md" mb="4" color="fg">
              Nueva conexión
            </Text>
            <Box as="form" onSubmit={handleCreate}>
              <Text fontSize="xs" color="fg.muted" mb="2">
                Nombre de la IA o herramienta
              </Text>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ej: Claude personal, Cursor work…"
                size="sm"
                mb="4"
                autoFocus
              />
              <HStack justify="flex-end" gap="2">
                <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
                <Button
                  type="submit"
                  size="sm"
                  loading={loading}
                  disabled={!label.trim()}
                >
                  Crear
                </Button>
              </HStack>
            </Box>
          </>
        ) : (
          <>
            <Text fontWeight="700" fontSize="md" mb="1" color="fg">Token creado</Text>
            <Text fontSize="xs" color="fg.muted" mb="4">
              Copia este token ahora — no lo verás de nuevo.
            </Text>

            <Box
              border="1px solid"
              borderColor="border.subtle"
              borderRadius="md"
              px="3"
              py="2.5"
              bg="bg.subtle"
              mb="4"
              display="flex"
              alignItems="center"
              gap="2"
            >
              <Code fontSize="xs" flex="1" wordBreak="break-all" bg="transparent">
                {token}
              </Code>
              <IconButton
                variant="ghost"
                size="xs"
                aria-label="Copiar token"
                onClick={handleCopy}
                flexShrink={0}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </IconButton>
            </Box>

            {spaces.length > 0 && (
              <>
                <Separator mb="4" />
                <Text fontSize="sm" fontWeight="600" color="fg" mb="3">
                  ¿Qué spaces puede ver esta conexión?
                </Text>
                <VStack align="stretch" gap="2" mb="4">
                  {spaces.map((s) => (
                    <HStack
                      key={s.id}
                      gap="3"
                      cursor="pointer"
                      onClick={() => toggleSpace(s.id)}
                      py="1"
                    >
                      <Checkbox.Root
                        checked={selectedSpaces.has(s.id)}
                        onCheckedChange={() => toggleSpace(s.id)}
                        size="sm"
                      >
                        <Checkbox.HiddenInput />
                        <Checkbox.Control />
                      </Checkbox.Root>
                      <Text fontSize="sm" color="fg">{s.name}</Text>
                      <Text fontSize="xs" color="fg.muted" ml="auto">
                        {s.memoryCount} mem.
                      </Text>
                    </HStack>
                  ))}
                </VStack>
              </>
            )}

            <HStack justify="flex-end" gap="2">
              <Button
                size="sm"
                loading={savingGrants}
                onClick={handleFinish}
              >
                Listo
              </Button>
            </HStack>
          </>
        )}
      </Box>
    </Box>
  );
}
