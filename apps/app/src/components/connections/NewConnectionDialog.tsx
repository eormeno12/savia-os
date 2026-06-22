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
  Separator,
} from "@chakra-ui/react";
import { api } from "@/lib/api";
import { McpConfigBlock } from "@/components/connect/McpConfigBlock";

interface SpaceDto {
  id: string; name: string; memoryCount: number;
}

interface Props {
  spaces: SpaceDto[];
  onCreated: () => void;
  onClose: () => void;
}

type Step = "form" | "token" | "config";

export function NewConnectionDialog({ spaces, onCreated, onClose }: Props) {
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [token, setToken] = useState<string | null>(null);
  const [connectionLabel, setConnectionLabel] = useState("");
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [selectedSpaces, setSelectedSpaces] = useState<Set<string>>(new Set());
  const [savingGrants, setSavingGrants] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setLoading(true);
    try {
      const res = await api.connections.create(label.trim());
      setToken(res.token);
      setConnectionLabel(label.trim());
      setConnectionId(res.id);
      setStep("token");
    } finally {
      setLoading(false);
    }
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
      setStep("config");
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
        maxW="520px"
        mx="4"
        boxShadow="xl"
        maxH="90vh"
        overflowY="auto"
      >
        {step === "form" && (
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
        )}

        {step === "token" && (
          <>
            <Text fontWeight="700" fontSize="md" mb="1" color="fg">
              Conexión creada
            </Text>
            <Text fontSize="xs" color="fg.muted" mb="4">
              Guarda el token ahora — no lo verás de nuevo.
            </Text>

            {token && (
              <McpConfigBlock token={token} connectionLabel={connectionLabel} />
            )}

            {spaces.length > 0 && (
              <>
                <Separator my="4" />
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

            <HStack justify="flex-end" gap="2" mt="4">
              <Button
                size="sm"
                loading={savingGrants}
                onClick={handleFinish}
              >
                {selectedSpaces.size === 0 ? "Continuar sin spaces" : "Guardar accesos"}
              </Button>
            </HStack>
          </>
        )}

        {step === "config" && token && (
          <>
            <Text fontWeight="700" fontSize="md" mb="1" color="fg">
              Config MCP lista
            </Text>
            <Text fontSize="xs" color="fg.muted" mb="4">
              Pégala en tu herramienta y empieza a usar tu memoria.
            </Text>
            <McpConfigBlock token={token} connectionLabel={connectionLabel} />
            <HStack justify="flex-end" mt="4">
              <Button size="sm" onClick={onClose}>Cerrar</Button>
            </HStack>
          </>
        )}
      </Box>
    </Box>
  );
}
