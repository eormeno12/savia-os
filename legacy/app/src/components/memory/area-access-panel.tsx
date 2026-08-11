"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Box, Button, HStack, Stack, Switch, Text } from "@chakra-ui/react";
import { Zap } from "lucide-react";
import type { ConnectionDto } from "@savia-os/legacy-contracts";
import { Skeleton, notify } from "@savia-os/ui";
import { api } from "@/lib/api";

interface AreaAccessPanelProps {
  areaId: string;
  areaName: string;
}

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; connections: ConnectionDto[] };

/** The grant on `conn` targeting this area, if any. */
function grantFor(conn: ConnectionDto, areaId: string) {
  return conn.grants.find((g) => g.scope === "space" && g.spaceId === areaId) ?? null;
}

/**
 * M2 "IAs" tab — "¿Quién ve esta área?". The same access model consolidated in
 * Pulso (P2), here as the in-context shortcut. Each connection toggles read
 * access to this area; every change carries a trust micro-message. Access is
 * never widened without the user's decision.
 */
export function AreaAccessPanel({ areaId, areaName }: AreaAccessPanelProps) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setState({ status: "loading" });
    api.connections
      .list()
      .then((connections) => !cancelled && setState({ status: "ready", connections }))
      .catch(() => !cancelled && setState({ status: "error" }));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => load(), [load]);

  async function toggle(conn: ConnectionDto, next: boolean) {
    setBusy(conn.id);
    try {
      const existing = grantFor(conn, areaId);
      if (next && !existing) {
        await api.connections.addGrant(conn.id, {
          scope: "space",
          spaceId: areaId,
          includeSensitive: false,
        });
        notify.success(
          `«${conn.label}» ya puede ver ${areaName}`,
          "Solo los recuerdos que acabas de autorizar. Nada más.",
        );
      } else if (!next && existing) {
        await api.connections.removeGrant(conn.id, existing.id);
        notify.success(
          `«${conn.label}» ya no tiene acceso a ${areaName}`,
          "Efectivo de inmediato.",
        );
      }
      load();
    } catch {
      notify.error("No pudimos cambiar el acceso", "Prueba de nuevo en un momento.");
    } finally {
      setBusy(null);
    }
  }

  if (state.status === "loading") {
    return (
      <Stack gap="2.5" mt="2">
        {[0, 1].map((i) => (
          <Skeleton key={i} w="100%" h="60px" rounded="xl" />
        ))}
      </Stack>
    );
  }

  if (state.status === "error") {
    return (
      <Stack align="center" py="10" gap="3">
        <Text fontSize="14px" color="fg.muted">
          No pudimos cargar tus conexiones.
        </Text>
        <Button size="sm" colorPalette="ink" onClick={load}>
          Reintentar
        </Button>
      </Stack>
    );
  }

  if (state.connections.length === 0) {
    return (
      <Stack
        align="center"
        textAlign="center"
        borderWidth="1px"
        borderStyle="dashed"
        borderColor="border"
        rounded="2xl"
        py="12"
        gap="2"
        mt="2"
      >
        <Text fontWeight="300" textStyle="titleLg" color="fg">
          Nada tiene acceso todavía.
        </Text>
        <Text fontSize="14px" color="fg.muted" maxW="42ch" lineHeight="1.6">
          Cuando conectes una IA, podrás darle acceso a esta área desde aquí. Tú decides qué ve
          cada una.
        </Text>
        <Button colorPalette="ink" mt="3" asChild>
          <Link href="/conexiones/nueva">
            <Zap size={15} /> Conectar una IA
          </Link>
        </Button>
      </Stack>
    );
  }

  return (
    <Stack gap="2.5" mt="2">
      <Text fontSize="13px" color="fg.muted">
        El acceso nunca se amplía sin tu decisión.
      </Text>
      {state.connections.map((conn) => {
        const on = grantFor(conn, areaId) !== null;
        return (
          <HStack
            key={conn.id}
            justify="space-between"
            bg="bg.panel"
            borderWidth="1px"
            borderColor="border"
            rounded="xl"
            px="4"
            py="3.5"
          >
            <Box minW="0">
              <Text fontSize="14px" fontWeight="600" color="fg" truncate>
                {conn.label}
              </Text>
              <Text fontSize="12px" color="fg.muted">
                {on ? "Puede leer esta área" : "Sin acceso a esta área"}
              </Text>
            </Box>
            <Switch.Root
              checked={on}
              disabled={busy === conn.id}
              onCheckedChange={(e) => toggle(conn, e.checked === true)}
              colorPalette="ink"
            >
              <Switch.HiddenInput />
              <Switch.Control />
            </Switch.Root>
          </HStack>
        );
      })}
    </Stack>
  );
}
