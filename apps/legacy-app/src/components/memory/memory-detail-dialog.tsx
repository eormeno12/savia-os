"use client";

import { useState } from "react";
import { Box, Button, HStack, Menu, Portal, Stack, Text } from "@chakra-ui/react";
import { ChevronDown, Lock, LockOpen } from "lucide-react";
import type { Sensitivity } from "@savia-os/contracts";
import { ConfirmDialog, Dialog, notify } from "@savia-os/ui";
import { spaceColor } from "@/lib/space-colors";
import { api } from "@/lib/api";

export interface MemoryView {
  id: string;
  text: string;
  /** Who wrote it (AI label or source file). */
  source?: string;
  /** Human-readable timestamp. */
  when?: string;
  /** Whether the memory is flagged sensitive. */
  sensitivity?: Sensitivity;
  /** Spaces this memory lives in; the first is the primary. */
  spaces?: { id: string; name: string }[];
  /** Every area, so "move" can offer a destination. */
  allAreas?: { id: string; name: string }[];
}

interface MemoryDetailDialogProps {
  memory: MemoryView | null;
  onClose: () => void;
  /** Called after any successful mutation so the parent can refresh. */
  onChanged?: (id: string) => void;
}

/**
 * M6 — single memory detail. A focused dialog showing the memory, its origin
 * and the areas it lives in, with move / mark-sensitive / delete wired to
 * `api.memory.update` and `api.memory.delete`.
 */
export function MemoryDetailDialog({ memory, onClose, onChanged }: MemoryDetailDialogProps) {
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const homeId = memory?.spaces?.[0]?.id;
  const isSensitive = memory?.sensitivity === "sensitive";
  // Areas the memory is not already in, as move targets.
  const moveTargets =
    memory?.allAreas?.filter((a) => !memory.spaces?.some((s) => s.id === a.id)) ?? [];

  async function move(targetId: string, targetName: string) {
    if (!memory) return;
    setBusy(true);
    try {
      await api.memory.update(memory.id, {
        addAreas: [targetId],
        ...(homeId ? { removeAreas: [homeId] } : {}),
      });
      notify.success("Recuerdo movido", `Ahora vive en ${targetName}.`);
      onChanged?.(memory.id);
      onClose();
    } catch {
      notify.error("No pudimos mover el recuerdo");
    } finally {
      setBusy(false);
    }
  }

  async function toggleSensitive() {
    if (!memory) return;
    setBusy(true);
    try {
      await api.memory.update(memory.id, { sensitivity: isSensitive ? "normal" : "sensitive" });
      notify.success(
        isSensitive ? "Marca de sensible quitada" : "Marcado como sensible",
        isSensitive
          ? "Ya no requiere confirmación extra."
          : "Savia pedirá tu confirmación antes de que cualquier IA acceda a esto.",
      );
      onChanged?.(memory.id);
      onClose();
    } catch {
      notify.error("No pudimos actualizar el recuerdo");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!memory) return;
    setBusy(true);
    try {
      await api.memory.delete(memory.id);
      notify.success("Recuerdo eliminado");
      onChanged?.(memory.id);
      setConfirmDelete(false);
      onClose();
    } catch {
      notify.error("No pudimos eliminar el recuerdo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Dialog open={memory !== null} onOpenChange={(o) => !o && onClose()} size="lg">
        {memory ? (
          <Stack gap="0">
            <HStack justify="space-between">
              <Text textStyle="label" color="fg.muted">
                Recuerdo
              </Text>
              {isSensitive ? (
                <HStack gap="1.5" color="warningInk">
                  <Lock size={13} />
                  <Text fontSize="12px" fontWeight="600">
                    Sensible
                  </Text>
                </HStack>
              ) : null}
            </HStack>

            <Text fontWeight="300" fontSize="titleLg" lineHeight="1.35" color="fg" mt="4">
              {memory.text}
            </Text>

            <HStack gap="8" mt="5" py="4" borderTopWidth="1px" borderBottomWidth="1px" borderColor="border">
              {memory.source ? (
                <Box>
                  <Text textStyle="label" color="fg.muted">
                    Origen
                  </Text>
                  <Text fontSize="14px" fontWeight="500" color="fg" mt="1.5">
                    {memory.source}
                  </Text>
                </Box>
              ) : null}
              {memory.when ? (
                <Box>
                  <Text textStyle="label" color="fg.muted">
                    Fecha
                  </Text>
                  <Text fontSize="14px" fontWeight="500" color="fg" mt="1.5">
                    {memory.when}
                  </Text>
                </Box>
              ) : null}
            </HStack>

            {memory.spaces && memory.spaces.length > 0 ? (
              <Box mt="4.5">
                <Text textStyle="label" color="fg.muted" mb="2.5">
                  Vive en
                </Text>
                <HStack gap="2" flexWrap="wrap">
                  {memory.spaces.map((s, i) => {
                    const col = spaceColor(s.id);
                    return (
                      <HStack
                        key={s.id}
                        gap="2"
                        px="3"
                        py="1.5"
                        rounded="full"
                        bg={i === 0 ? "bg.inverse" : "bg.panel"}
                        color={i === 0 ? "fg.inverse" : "fg"}
                        borderWidth={i === 0 ? "0" : "1px"}
                        borderColor="border"
                      >
                        <Box w="2" h="2" rounded="full" bg={col.fill} />
                        <Text fontSize="13px" fontWeight="500">
                          {s.name}
                        </Text>
                        {i === 0 ? (
                          <Text fontSize="11px" color="fg.inverse" opacity="0.6">
                            principal
                          </Text>
                        ) : null}
                      </HStack>
                    );
                  })}
                </HStack>
              </Box>
            ) : null}

            <HStack gap="2.5" mt="7" flexWrap="wrap">
              {moveTargets.length > 0 ? (
                <Menu.Root>
                  <Menu.Trigger asChild>
                    <Button colorPalette="ink" loading={busy}>
                      Mover de área <ChevronDown size={15} />
                    </Button>
                  </Menu.Trigger>
                  <Portal>
                    <Menu.Positioner>
                      <Menu.Content maxH="260px" overflowY="auto">
                        {moveTargets.map((a) => (
                          <Menu.Item key={a.id} value={a.id} onClick={() => move(a.id, a.name)}>
                            {a.name}
                          </Menu.Item>
                        ))}
                      </Menu.Content>
                    </Menu.Positioner>
                  </Portal>
                </Menu.Root>
              ) : null}
              <Button variant="outline" onClick={toggleSensitive} loading={busy}>
                {isSensitive ? <LockOpen size={14} /> : <Lock size={14} />}
                {isSensitive ? "Quitar sensible" : "Marcar sensible"}
              </Button>
              <Button
                ms="auto"
                variant="outline"
                colorPalette="danger"
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
              >
                Eliminar
              </Button>
            </HStack>
          </Stack>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="¿Eliminar este recuerdo?"
        description="Se borra de forma permanente. No podemos recuperarlo después."
        confirmLabel="Eliminar"
        loading={busy}
        onConfirm={remove}
      />
    </>
  );
}
