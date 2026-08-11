"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Box, HStack, Link as CkLink, Stack, Tabs, Text } from "@chakra-ui/react";
import { Lock, Sparkles, Users } from "lucide-react";
import { Avatar, EmptyState, FadeInUp, Skeleton, StatusBadge } from "@savia-os/ui";
import type { GroupDto, GroupMemberDto, GroupMemoryDto } from "@savia-os/legacy-contracts";
import { api } from "@/lib/api";
import { SpaceGlyph } from "@/components/ui/SpaceGlyph";
import { MemberStack, RoleBadge, MembersPanel } from "@/components/collective/members-panel";

/**
 * CO1 (detail) — a collective group. A team header that reads unmistakably as
 * shared (the lime-ringed glyph, the "colectiva" kicker, your role), then two
 * tabs: the shared Recuerdos (each tagged with who contributed) and the People
 * who can see them. Admin actions live in the People tab.
 */
export default function ColectivoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [group, setGroup] = useState<GroupDto | null | undefined>(undefined);
  const [meId, setMeId] = useState<string | undefined>(undefined);

  useEffect(() => {
    api.groups.get(id).then(setGroup).catch(() => setGroup(null));
    api.me().then((m) => setMeId(m.id)).catch(() => setMeId(undefined));
  }, [id]);

  return (
    <Stack gap="7" maxW="860px">
      <FadeInUp>
        <Text fontSize="13px" color="fg.muted">
          <CkLink asChild color="fg.muted" _hover={{ color: "fg" }}>
            <Link href="/colectivo">Colectivo</Link>
          </CkLink>{" "}
          / <Box as="span" color="fg" fontWeight="500">{group?.name ?? "…"}</Box>
        </Text>

        {group === undefined ? (
          <HStack gap="4" mt="4">
            <Skeleton w="56px" h="56px" rounded="chip" />
            <Stack gap="2">
              <Skeleton w="240px" h="34px" />
              <Skeleton w="160px" h="18px" />
            </Stack>
          </HStack>
        ) : group === null ? (
          <Box mt="6">
            <EmptyState
              icon={<Users size={32} />}
              title="No encontramos este grupo"
              description="Puede que ya no seas parte de él, o que el enlace haya cambiado."
              action={
                <CkLink asChild color="fg" fontWeight="600">
                  <Link href="/colectivo">Volver a Colectivo</Link>
                </CkLink>
              }
            />
          </Box>
        ) : (
          <GroupHeader group={group} />
        )}
      </FadeInUp>

      {group ? (
        <FadeInUp delay={0.08}>
          <Tabs.Root defaultValue="recuerdos" lazyMount unmountOnExit variant="line" colorPalette="ink">
            <Tabs.List>
              <Tabs.Trigger value="recuerdos">
                <Sparkles size={16} /> Recuerdos
              </Tabs.Trigger>
              <Tabs.Trigger value="personas">
                <Users size={16} /> Personas
              </Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content value="recuerdos" pt="6">
              <GroupMemories groupId={group.id} meId={meId} />
            </Tabs.Content>

            <Tabs.Content value="personas" pt="6">
              <MembersPanel groupId={group.id} currentUserId={meId} selfRole={group.role} />
            </Tabs.Content>
          </Tabs.Root>
        </FadeInUp>
      ) : null}
    </Stack>
  );
}

/** The team identity block — colour, name, the unmistakable "collective" signal. */
function GroupHeader({ group }: { group: GroupDto }) {
  return (
    <HStack gap="4" mt="4" align="center" flexWrap="wrap">
      <SpaceGlyph spaceId={group.id} name={group.name} collective size={56} />
      <Box flex="1" minW="0">
        <Text textStyle="label" color="fg.muted">
          Memoria colectiva
        </Text>
        <Text textStyle="pageTitle" fontWeight="300" color="fg" mt="1.5" lineHeight="1.05">
          {group.name}
        </Text>
      </Box>
      <HStack gap="3.5" flexShrink="0">
        <Box display={{ base: "none", sm: "block" }}>
          <MemberStack count={group.memberCount} size="sm" />
        </Box>
        <RoleBadge role={group.role} />
      </HStack>
    </HStack>
  );
}

/* -------------------------------------------------------------------------- */
/*  Recuerdos tab — the shared memories, each attributed to who contributed.   */
/* -------------------------------------------------------------------------- */

type MemState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; memories: GroupMemoryDto[]; names: Map<string, string> };

function GroupMemories({ groupId, meId }: { groupId: string; meId?: string }) {
  const [state, setState] = useState<MemState>({ status: "loading" });

  const load = useCallback(() => {
    setState({ status: "loading" });
    Promise.all([
      api.groups.memories(groupId),
      api.groups.members(groupId).catch(() => [] as GroupMemberDto[]),
    ])
      .then(([memories, members]) => {
        const names = new Map<string, string>();
        members.forEach((m) => names.set(m.userId, m.email));
        setState({ status: "ready", memories, names });
      })
      .catch(() => setState({ status: "error" }));
  }, [groupId]);

  useEffect(() => load(), [load]);

  if (state.status === "loading") {
    return (
      <Stack gap="3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} h="96px" rounded="card" />
        ))}
      </Stack>
    );
  }

  if (state.status === "error") {
    return (
      <Stack gap="3" align="flex-start">
        <Text color="fg.muted">No pudimos cargar los recuerdos del grupo.</Text>
        <CkLink as="button" color="fg" fontWeight="600" onClick={load}>
          Reintentar
        </CkLink>
      </Stack>
    );
  }

  if (state.memories.length === 0) {
    return (
      <EmptyState
        icon={<Sparkles size={32} />}
        title="Aún no hay recuerdos compartidos"
        description="Cuando tú o el equipo aporten un área, sus recuerdos aparecerán aquí — cada uno con quién lo contribuyó."
      />
    );
  }

  const authorLabel = (userId: string) => {
    if (userId === meId) return "ti";
    return state.names.get(userId) ?? "un miembro del grupo";
  };

  return (
    <Stack gap="3">
      {state.memories.map((m, i) => (
        <FadeInUp key={m.memoryId} delay={i * 0.05}>
          <Stack
            gap="3"
            bg="bg.panel"
            borderWidth="1px"
            borderColor="border"
            rounded="card"
            px="5"
            py="4.5"
          >
            <Text fontSize="15px" color="fg" lineHeight="1.7">
              {m.text}
            </Text>
            <HStack gap="2.5" flexWrap="wrap">
              <HStack gap="2" color="fg.muted" fontSize="12.5px">
                <Avatar size="2xs" name={state.names.get(m.authorUserId)} colorPalette="mist" />
                <Text>
                  Aportado por{" "}
                  <Box as="span" color="fg" fontWeight="600">
                    {authorLabel(m.authorUserId)}
                  </Box>
                </Text>
              </HStack>
              {m.alsoFrom.length > 0 ? (
                <Text fontSize="12.5px" color="fg.muted">
                  · también aportado por {m.alsoFrom.length}{" "}
                  {m.alsoFrom.length === 1 ? "persona" : "personas"} más
                </Text>
              ) : null}
              {m.sensitivity === "sensitive" ? (
                <StatusBadge tone="warning" icon={<Lock size={12} />}>
                  Sensible
                </StatusBadge>
              ) : null}
            </HStack>
          </Stack>
        </FadeInUp>
      ))}
    </Stack>
  );
}
