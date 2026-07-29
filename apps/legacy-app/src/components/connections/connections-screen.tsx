"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { Plug, Zap } from "lucide-react";
import { ConfirmDialog, Skeleton, StatusBadge, notify, type StatusTone } from "@savia-os/ui";
import type { AreaDto, ConnectionDto, GroupDto } from "@savia-os/contracts";
import { api } from "@/lib/api";
import { relativeTime } from "@/lib/relative-time";
import { useSubscription } from "@/lib/use-subscription";
import { SubscriptionGate } from "@/components/billing/subscription-gate";

/** Fresh if the IA called within the last hour. */
const FRESH_MS = 60 * 60 * 1000;

interface Loaded {
  connections: ConnectionDto[];
  names: Map<string, string>;
}

type State = { status: "loading" } | { status: "error" } | { status: "ready"; data: Loaded };

function health(c: ConnectionDto): { tone: StatusTone; label: string } {
  if (c.revoked) return { tone: "danger", label: "Con problema" };
  if (!c.lastSeenAt) return { tone: "warning", label: "Sin actividad aún" };
  const fresh = Date.now() - Date.parse(c.lastSeenAt) < FRESH_MS;
  return fresh
    ? { tone: "success", label: `Activa · ${relativeTime(c.lastSeenAt)}` }
    : { tone: "neutral", label: `Sin actividad reciente · ${relativeTime(c.lastSeenAt)}` };
}

/** Human summary of what a connection can read, resolving grant targets to names. */
function accessLabel(c: ConnectionDto, names: Map<string, string>): string {
  if (c.grants.length === 0) return "No puede ver nada todavía — dale acceso desde un área.";
  const resolved = c.grants
    .map((g) => names.get(g.spaceId ?? g.groupId ?? "") ?? null)
    .filter((n): n is string => Boolean(n));
  if (resolved.length === 0) return `${c.grants.length} con acceso`;
  return `Puede ver ${resolved.slice(0, 3).join(", ")}${resolved.length > 3 ? "…" : ""}`;
}

/**
 * C1 — Connections list. Each IA with its real health, a plain-language summary
 * of what it can read, and revoke. Connecting is gated behind the subscription
 * (SB1); the gate opens inline when a free user tries.
 */
export function ConnectionsScreen() {
  const router = useRouter();
  const { active: subscribed, ready } = useSubscription();
  const [state, setState] = useState<State>({ status: "loading" });
  const [gateOpen, setGateOpen] = useState(false);
  const [toRevoke, setToRevoke] = useState<ConnectionDto | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setState({ status: "loading" });
    Promise.all([
      api.connections.list(),
      api.areas.list().catch(() => [] as AreaDto[]),
      api.groups.list().catch(() => [] as GroupDto[]),
    ])
      .then(([connections, areas, groups]) => {
        if (cancelled) return;
        const names = new Map<string, string>();
        areas.forEach((a) => names.set(a.id, a.name));
        groups.forEach((g) => names.set(g.id, g.name));
        setState({ status: "ready", data: { connections, names } });
      })
      .catch(() => !cancelled && setState({ status: "error" }));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => load(), [load]);

  function connect() {
    if (ready && !subscribed) return setGateOpen(true);
    router.push("/conexiones/nueva");
  }

  async function revoke(c: ConnectionDto) {
    await api.connections.revoke(c.id);
    setToRevoke(null);
    notify.success(`«${c.label}» ya no tiene acceso`, "Efectivo de inmediato.");
    load();
  }

  const showHint = ready && !subscribed;

  return (
    <Stack gap="6" maxW="900px">
      <HStack align="flex-end" gap="6" flexWrap="wrap">
        <Box>
          <Text textStyle="label" color="fg.muted">
            Tus conexiones
          </Text>
          <Text textStyle="pageTitle" fontWeight="300" color="fg" mt="2.5">
            Conexiones
          </Text>
        </Box>
        <Stack gap="1" ms="auto" align="flex-end">
          <Button colorPalette="ink" onClick={connect}>
            <Zap size={16} /> Conectar IA
          </Button>
          {showHint ? (
            <Text fontSize="12px" color="fg.muted">
              Requiere suscripción
            </Text>
          ) : null}
        </Stack>
      </HStack>

      {state.status === "loading" ? (
        <Stack gap="3">
          {[0, 1].map((i) => (
            <Skeleton key={i} h="76px" rounded="2xl" />
          ))}
        </Stack>
      ) : state.status === "error" ? (
        <Stack gap="3" align="flex-start">
          <Text color="fg.muted">No pudimos cargar tus conexiones.</Text>
          <Button variant="outline" onClick={load}>
            Reintentar
          </Button>
        </Stack>
      ) : state.data.connections.length === 0 ? (
        <EmptyConnections onConnect={connect} />
      ) : (
        <Stack gap="3">
          {state.data.connections.map((c) => {
            const h = health(c);
            return (
              <HStack
                key={c.id}
                gap="4"
                bg="bg.panel"
                borderWidth="1px"
                borderColor={c.revoked ? "danger.border" : "border"}
                rounded="2xl"
                px="5"
                py="4"
              >
                <Box flex="1" minW="0">
                  <HStack gap="2.5" flexWrap="wrap">
                    <Text fontSize="16px" fontWeight="600" color="fg">
                      {c.label}
                    </Text>
                    <StatusBadge tone={h.tone}>{h.label}</StatusBadge>
                  </HStack>
                  <Text fontSize="13px" color="fg.muted" mt="1">
                    {accessLabel(c, state.data.names)}
                  </Text>
                </Box>
                {!c.revoked ? (
                  <Button
                    variant="outline"
                    size="sm"
                    colorPalette="danger"
                    onClick={() => setToRevoke(c)}
                  >
                    Revocar
                  </Button>
                ) : null}
              </HStack>
            );
          })}
        </Stack>
      )}

      <SubscriptionGate
        open={gateOpen}
        onOpenChange={setGateOpen}
        onActivated={() => router.push("/conexiones/nueva")}
      />
      <ConfirmDialog
        open={toRevoke !== null}
        onOpenChange={(o) => !o && setToRevoke(null)}
        title={`¿Revocar «${toRevoke?.label}»?`}
        description="Dejará de tener acceso a tu memoria de inmediato. Puedes volver a conectarla cuando quieras."
        confirmLabel="Revocar"
        onConfirm={() => toRevoke && revoke(toRevoke)}
      />
    </Stack>
  );
}

/** Empty state — an ink hero so the first CTA lands on a signature surface. */
function EmptyConnections({ onConnect }: { onConnect: () => void }) {
  return (
    <Box position="relative" bg="bg.inverse" rounded="card" overflow="hidden" px={{ base: "8", md: "14" }} py="16">
      <Box
        position="absolute"
        w="360px"
        h="360px"
        rounded="full"
        bg="lime.solid"
        filter="blur(140px)"
        opacity="0.1"
        bottom="-160px"
        insetEnd="-100px"
      />
      <Stack position="relative" align="center" textAlign="center" gap="0">
        <Box color="lime.solid">
          <Plug size={40} strokeWidth={1.4} />
        </Box>
        <Text fontWeight="300" textStyle="pageTitle" color="fg.inverse" mt="5">
          Conecta tu primera IA.
        </Text>
        <Text fontSize="15px" color="fg.inverse/70" lineHeight="1.6" mt="3" maxW="46ch">
          Claude, Cursor, ChatGPT o cualquier IA compatible empezarán a recordar usando tu memoria
          — y a alimentarla. Sin esto, Savia no tiene nada que recordar.
        </Text>
        <Button colorPalette="lime" mt="6" onClick={onConnect}>
          <Zap size={16} /> Conectar mi primera IA
        </Button>
      </Stack>
    </Box>
  );
}
