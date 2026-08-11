"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { ArrowRight, ChevronRight, Users } from "lucide-react";
import { FadeInUp, Skeleton } from "@savia-os/ui";
import type { GroupDto } from "@savia-os/legacy-contracts";
import { api } from "@/lib/api";
import { SpaceGlyph } from "@/components/ui/SpaceGlyph";
import { MemberStack, RoleBadge } from "@/components/collective/members-panel";

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; groups: GroupDto[] };

/**
 * CO1 (index) — the collective home. Explains what a shared memory is, offers
 * the one action that creates one (convert an area), and lists the groups you
 * belong to as living team cards. Empty, loading and error states are all
 * designed; the first-run empty state is a signature ink surface.
 */
export default function ColectivoIndexPage() {
  const [state, setState] = useState<State>({ status: "loading" });

  const load = useCallback(() => {
    setState({ status: "loading" });
    api.groups
      .list()
      .then((groups) => setState({ status: "ready", groups }))
      .catch(() => setState({ status: "error" }));
  }, []);

  useEffect(() => load(), [load]);

  const hasGroups = state.status === "ready" && state.groups.length > 0;

  return (
    <Stack gap="8" maxW="880px">
      <FadeInUp>
        <HStack justify="space-between" align="flex-end" gap="6" flexWrap="wrap">
          <Box>
            <Text textStyle="label" color="fg.muted">
              Memoria compartida
            </Text>
            <Text textStyle="pageTitle" fontWeight="300" color="fg" mt="2.5">
              Tu colectivo.
            </Text>
            <Text fontSize="15px" color="fg.muted" mt="3" maxW="56ch" lineHeight="1.6">
              Un cerebro de equipo: una memoria que tú y tu gente comparten, y a la que cada
              uno —y sus IAs— puede aportar, con los permisos que tú defines.
            </Text>
          </Box>
          {hasGroups ? (
            <Button colorPalette="ink" asChild flexShrink="0">
              <Link href="/colectivo/convertir">
                <Users size={16} /> Convertir un área
              </Link>
            </Button>
          ) : null}
        </HStack>
      </FadeInUp>

      {state.status === "loading" ? (
        <Stack gap="3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} h="88px" rounded="card" />
          ))}
        </Stack>
      ) : state.status === "error" ? (
        <Stack gap="3" align="flex-start">
          <Text color="fg.muted">No pudimos cargar tus memorias colectivas.</Text>
          <Button variant="outline" onClick={load}>
            Reintentar
          </Button>
        </Stack>
      ) : state.groups.length === 0 ? (
        <FadeInUp delay={0.05}>
          <EmptyCollective />
        </FadeInUp>
      ) : (
        <Stack gap="3">
          {state.groups.map((g, i) => (
            <FadeInUp key={g.id} delay={i * 0.06}>
              <GroupCard group={g} />
            </FadeInUp>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

/** A group as a team card: its brand-coloured glyph (with the collective ring),
 *  your role, what's inside, and who's in. */
function GroupCard({ group }: { group: GroupDto }) {
  return (
    <Link href={`/colectivo/${group.id}`} style={{ textDecoration: "none" }}>
      <HStack
        gap="4"
        bg="bg.panel"
        borderWidth="1px"
        borderColor="border"
        rounded="card"
        px="5"
        py="4.5"
        transition="border-color 0.18s, box-shadow 0.18s, transform 0.18s"
        _hover={{ borderColor: "fg.subtle", boxShadow: "soft", transform: "translateY(-2px)" }}
      >
        <SpaceGlyph spaceId={group.id} name={group.name} collective size={46} />

        <Box flex="1" minW="0">
          <Text fontSize="17px" fontWeight="600" color="fg" truncate>
            {group.name}
          </Text>
          <Text fontSize="13px" color="fg.muted" mt="0.5">
            {group.memberCount} {group.memberCount === 1 ? "miembro" : "miembros"} ·{" "}
            {group.fragmentCount} {group.fragmentCount === 1 ? "aporte" : "aportes"}
          </Text>
        </Box>

        <HStack gap="4" flexShrink="0">
          <Box display={{ base: "none", sm: "block" }}>
            <MemberStack count={group.memberCount} size="sm" />
          </Box>
          <RoleBadge role={group.role} />
          <Box color="fg.subtle">
            <ChevronRight size={18} />
          </Box>
        </HStack>
      </HStack>
    </Link>
  );
}

/** First-run: a signature ink panel that explains collective memory and lands
 *  the first CTA in lime on dark, where it belongs. */
function EmptyCollective() {
  return (
    <Box
      position="relative"
      bg="bg.inverse"
      rounded="panel"
      overflow="hidden"
      boxShadow="floatDark"
      px={{ base: "8", md: "14" }}
      py={{ base: "12", md: "16" }}
    >
      <Box
        position="absolute"
        w="420px"
        h="420px"
        rounded="full"
        bg="signalLime"
        filter="blur(150px)"
        opacity="0.1"
        bottom="-180px"
        insetEnd="-120px"
        pointerEvents="none"
        aria-hidden
      />
      <Stack position="relative" align="center" textAlign="center" gap="0">
        <Box color="signalLime">
          <Users size={40} strokeWidth={1.4} />
        </Box>
        <Text textStyle="pageTitle" fontWeight="300" color="fg.inverse" mt="5" maxW="18ch">
          Todavía no compartes tu memoria.
        </Text>
        <Text fontSize="15px" color="fg.inverse/70" lineHeight="1.7" mt="4" maxW="50ch">
          Una memoria colectiva es un cerebro de equipo. Toma un área que ya tengas, invita a tu
          gente, y todos empiezan a recordar juntos —sin perder lo que es solo tuyo.
        </Text>
        <Button colorPalette="lime" size="lg" mt="8" asChild>
          <Link href="/colectivo/convertir">
            Convertir un área en colectiva <ArrowRight size={16} />
          </Link>
        </Button>
      </Stack>
    </Box>
  );
}
