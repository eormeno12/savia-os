"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { motion, useReducedMotion } from "framer-motion";
import { FadeInUp, SaviaMark, Skeleton, notify } from "@savia-os/ui";
import type { ConnectionDto, GrowthEvent, GrowthSummary } from "@savia-os/contracts";
import { api, type AccessActivity } from "@/lib/api";
import { relativeTime } from "@/lib/relative-time";
import { GrowthChart } from "./growth-chart";

interface PulsoData {
  summary: GrowthSummary;
  events: GrowthEvent[];
  nextCursor: string | null;
  activity: AccessActivity[];
  connections: ConnectionDto[];
  /** spaceId → area name, resolved once from /areas. */
  areaNames: ReadonlyMap<string, string>;
}

type State = { status: "loading" } | { status: "error" } | ({ status: "ready" } & PulsoData);

/** Events where Savia reorganized on its own — they get the lime treatment + revert. */
const REORG_ACTIONS: ReadonlySet<GrowthEvent["action"]> = new Set([
  "move",
  "split",
  "merge",
  "supersede",
]);

/** Readable sentence per event action: `before + {area} + after`, plus the meta verb. */
const EVENT_COPY: Record<GrowthEvent["action"], { before: string; after: string; verb: string }> = {
  create: { before: "Se guardó un recuerdo nuevo en ", after: "", verb: "guardó" },
  move: { before: "Savia movió un recuerdo a ", after: "", verb: "reorganizó" },
  split: { before: "Savia separó sub-temas en ", after: "", verb: "reorganizó" },
  merge: { before: "Savia fusionó áreas parecidas en ", after: "", verb: "reorganizó" },
  decay: { before: "Savia archivó un recuerdo poco usado de ", after: "", verb: "archivó" },
  sensitivity: { before: "Se marcó un recuerdo de ", after: " como sensible", verb: "protegió" },
  supersede: {
    before: "Savia actualizó un recuerdo de ",
    after: " con información más nueva",
    verb: "actualizó",
  },
};

/** An AI is "live" if it called within the last hour. */
const LIVE_WINDOW_MS = 60 * 60 * 1000;

/**
 * P1 — Pulso: the live heartbeat of your memory, full-screen on ink. Left, the
 * activity feed (what got remembered, what Savia reorganized — revertable
 * inline). Right, the growth hero number over a lime curve and the per-AI
 * access panel. The shell already renders the ink chrome for /pulso.
 */
export function PulsoScreen() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [loadingMore, setLoadingMore] = useState(false);
  const [revertingId, setRevertingId] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setState({ status: "loading" });
    Promise.all([
      api.growth.summary("week"),
      api.growth.events(undefined, 30),
      api.growth.accessActivity(),
      api.connections.list(),
      api.areas.list(),
    ])
      .then(([summary, eventsPage, activity, connections, areas]) => {
        if (cancelled) return;
        setState({
          status: "ready",
          summary,
          events: eventsPage.items,
          nextCursor: eventsPage.nextCursor,
          activity,
          connections: connections.filter((c) => !c.revoked),
          areaNames: new Map(areas.map((a) => [a.id, a.name])),
        });
      })
      .catch(() => !cancelled && setState({ status: "error" }));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => load(), [load]);

  const loadMore = async () => {
    if (state.status !== "ready" || !state.nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await api.growth.events(state.nextCursor, 30);
      setState((s) =>
        s.status === "ready"
          ? { ...s, events: [...s.events, ...page.items], nextCursor: page.nextCursor }
          : s,
      );
    } catch {
      notify.error("No pudimos cargar más actividad.");
    } finally {
      setLoadingMore(false);
    }
  };

  const revert = async (id: string) => {
    setRevertingId(id);
    try {
      await api.growth.revertEvent(id);
      notify.success("Revertido. Savia no volverá a clasificar contenido similar ahí.");
      setState((s) =>
        s.status === "ready"
          ? { ...s, events: s.events.map((e) => (e.id === id ? { ...e, reverted: true } : e)) }
          : s,
      );
    } catch {
      notify.error("No pudimos revertir eso. Intenta de nuevo.");
    } finally {
      setRevertingId(null);
    }
  };

  return (
    // The shell renders the ink chrome (tone="dark" for /pulso); this lays out
    // the content directly on it — no inner ink card.
    <Box color="fg.inverse" flex="1" minH="0" position="relative">
      {/* Signature lime glow bleeding off the top corner (design system §3). */}
      <Box
        position="absolute"
        w="480px"
        h="480px"
        rounded="full"
        bg="lime.solid"
        filter="blur(150px)"
        opacity="0.07"
        top="-180px"
        insetEnd="-100px"
        pointerEvents="none"
      />

      <Box position="relative">
        <HStack gap="3">
          <Text textStyle="label" color="lime.solid">
            Pulso
          </Text>
          <LiveChip />
        </HStack>
        <Text as="h2" fontWeight="300" fontSize="displayMd" lineHeight="1" mt="2.5">
          Tu memoria,{" "}
          <Box as="span" fontWeight="600" color="lime.solid">
            en vivo
          </Box>
          .
        </Text>

        {state.status === "loading" ? (
          <PulsoSkeleton />
        ) : state.status === "error" ? (
          <Stack mt="10" gap="4" align="flex-start">
            <Text color="fg.inverse/70">No pudimos cargar tu actividad ahora.</Text>
            <Button colorPalette="lime" onClick={load}>
              Reintentar
            </Button>
          </Stack>
        ) : (
          <HStack
            align="stretch"
            gap={{ base: "8", lg: "8" }}
            mt="8"
            flexDirection={{ base: "column", lg: "row" }}
          >
            {/* ── Feed: ACTIVIDAD ─────────────────────────────────────── */}
            <Stack flex="1.5" minW="0" w="full" gap="3">
              <Text textStyle="label" color="fg.inverse/55">
                Actividad
              </Text>

              {state.events.length === 0 ? (
                <Box
                  borderWidth="1px"
                  borderColor="border.inverse"
                  rounded="l3"
                  p="8"
                  textAlign="center"
                >
                  <Text color="fg.inverse/70" textStyle="caption">
                    Sin actividad aún — cuando tus IAs consulten o Savia reorganice, lo verás
                    aquí.
                  </Text>
                </Box>
              ) : (
                <Stack gap="2.5">
                  {state.events.map((event, i) => (
                    <FadeInUp key={event.id} delay={Math.min(i % 30, 6) * 0.07} distance={14}>
                      <EventCard
                        event={event}
                        areaNames={state.areaNames}
                        reverting={revertingId === event.id}
                        onRevert={() => revert(event.id)}
                      />
                    </FadeInUp>
                  ))}
                  {state.nextCursor ? (
                    <Button
                      alignSelf="center"
                      mt="2"
                      size="sm"
                      variant="outline"
                      color="fg.inverse"
                      borderColor="border.inverse"
                      _hover={{ borderColor: "fg.inverse/35" }}
                      loading={loadingMore}
                      loadingText="Cargando…"
                      onClick={loadMore}
                    >
                      Cargar más
                    </Button>
                  ) : null}
                </Stack>
              )}
            </Stack>

            {/* ── Side panel ──────────────────────────────────────────── */}
            <Stack flex="1" minW="0" w="full" maxW={{ lg: "340px" }} gap="4">
              <FadeInUp delay={0.1} distance={14}>
                <Box bg="softInk" rounded="2xl" p="5">
                  <GrowthChart
                    points={state.summary.points}
                    todayTotal={state.summary.todayTotal}
                    weekTotal={state.summary.weekTotal}
                    weekDelta={state.summary.weekDelta}
                  />
                </Box>
              </FadeInUp>
              <FadeInUp delay={0.18} distance={14}>
                <AiPanel connections={state.connections} activity={state.activity} />
              </FadeInUp>
            </Stack>
          </HStack>
        )}
      </Box>
    </Box>
  );
}

/** "● En vivo" — the green dot beats with an expanding halo (framer-motion). */
function LiveChip() {
  const reduced = useReducedMotion();
  return (
    <HStack
      gap="2"
      borderWidth="1px"
      borderColor="border.inverse"
      rounded="full"
      px="3"
      py="1"
      textStyle="caption"
      color="fg.inverse/70"
    >
      <Box position="relative" w="2" h="2" flexShrink="0">
        <Box position="absolute" inset="0" rounded="full" bg="success.solid" />
        {!reduced ? (
          <Box asChild position="absolute" inset="0" rounded="full" bg="success.solid">
            <motion.span
              animate={{ scale: [1, 2.6], opacity: [0.55, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
            />
          </Box>
        ) : null}
      </Box>
      En vivo
    </HStack>
  );
}

/** One feed card. Savia's reorgs get a subtle lime border + inline revert. */
function EventCard({
  event,
  areaNames,
  reverting,
  onRevert,
}: {
  event: GrowthEvent;
  areaNames: ReadonlyMap<string, string>;
  reverting: boolean;
  onRevert: () => void;
}) {
  const copy = EVENT_COPY[event.action];
  const isReorg = REORG_ACTIONS.has(event.action);
  const areaName = (event.spaceId && areaNames.get(event.spaceId)) || "tu memoria";

  return (
    <HStack
      gap="3.5"
      bg="softInk"
      rounded="l3"
      p="4"
      align="flex-start"
      borderWidth="1px"
      borderColor={isReorg && !event.reverted ? "lime.border" : "transparent"}
      opacity={event.reverted ? 0.55 : 1}
      transition="opacity 0.2s"
    >
      {/* Avatar: Savia's reorgs = ink mark on a lime box; the rest = mark on ink. */}
      <Box
        w="8"
        h="8"
        rounded="lg"
        bg={isReorg ? "lime.solid" : "bg.inverse"}
        color={isReorg ? "lime.contrast" : "lime.solid"}
        display="flex"
        alignItems="center"
        justifyContent="center"
        flexShrink="0"
      >
        <SaviaMark size={13} />
      </Box>

      <Box flex="1" minW="0">
        <Text textStyle="caption" color="fg.inverse">
          {copy.before}
          <Box as="span" fontWeight="600">
            {areaName}
          </Box>
          {copy.after}
        </Text>
        <HStack gap="3" mt="1">
          <Text textStyle="caption" fontSize="12px" color="fg.inverse/50">
            {relativeTime(event.createdAt)} · {copy.verb}
          </Text>
          {event.reverted ? (
            <Text textStyle="caption" fontSize="12px" color="fg.inverse/40">
              Revertido
            </Text>
          ) : event.revertable && isReorg ? (
            <Button
              size="2xs"
              variant="outline"
              color="fg.inverse/80"
              borderColor="border.inverse"
              _hover={{ borderColor: "lime.border", color: "fg.inverse" }}
              loading={reverting}
              onClick={onRevert}
            >
              ↩ Revertir
            </Button>
          ) : null}
        </HStack>
      </Box>
    </HStack>
  );
}

/** "Tus IAs" — each connection with its live dot, last-seen and call count. */
function AiPanel({
  connections,
  activity,
}: {
  connections: ConnectionDto[];
  activity: AccessActivity[];
}) {
  const byConnection = new Map(activity.map((a) => [a.connectionId, a]));

  return (
    <Box bg="softInk" rounded="2xl" p="5">
      <Text textStyle="label" color="fg.inverse/55">
        Tus IAs
      </Text>

      {connections.length === 0 ? (
        <Stack mt="4" gap="3" align="flex-start">
          <Text textStyle="caption" color="fg.inverse/70">
            Conecta una IA para ver su actividad aquí.
          </Text>
          <Button colorPalette="lime" size="sm" asChild>
            <Link href="/conexiones/nueva">Conectar IA</Link>
          </Button>
        </Stack>
      ) : (
        <Stack mt="4" gap="3.5">
          {connections.map((conn) => {
            const act = byConnection.get(conn.id);
            const lastSeen = conn.lastSeenAt ?? act?.lastSeenAt ?? null;
            const live =
              lastSeen !== null && Date.now() - new Date(lastSeen).getTime() < LIVE_WINDOW_MS;
            const calls = act?.totalCalls ?? 0;
            return (
              <HStack key={conn.id} gap="2.5" align="center">
                <Box
                  w="2"
                  h="2"
                  rounded="full"
                  bg={live ? "success.solid" : "fg.inverse/25"}
                  flexShrink="0"
                  aria-hidden
                />
                <Text textStyle="caption" color="fg.inverse" fontWeight="500" truncate flex="1">
                  {conn.label}
                  <Box as="span" fontWeight="400" color="fg.inverse/50">
                    {" "}
                    · {relativeTime(lastSeen)}
                  </Box>
                </Text>
                <Text
                  textStyle="caption"
                  fontSize="12px"
                  color="fg.inverse/60"
                  fontVariantNumeric="tabular-nums"
                  flexShrink="0"
                >
                  {calls.toLocaleString("es-AR")} {calls === 1 ? "consulta" : "consultas"}
                </Text>
              </HStack>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}

/** Dark skeletons mirroring the real anatomy (feed cards + two panel cards). */
function PulsoSkeleton() {
  return (
    <HStack align="stretch" gap="8" mt="8" flexDirection={{ base: "column", lg: "row" }}>
      <Stack flex="1.5" minW="0" w="full" gap="2.5">
        <Skeleton h="12px" w="88px" bg="border.inverse" rounded="md" mb="1" />
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} h="72px" rounded="l3" bg="border.inverse" />
        ))}
      </Stack>
      <Stack flex="1" minW="0" w="full" maxW={{ lg: "340px" }} gap="4">
        <Skeleton h="280px" rounded="2xl" bg="border.inverse" />
        <Skeleton h="160px" rounded="2xl" bg="border.inverse" />
      </Stack>
    </HStack>
  );
}
