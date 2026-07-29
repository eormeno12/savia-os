"use client";

import type { ReactElement } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Box,
  Button,
  Group,
  HStack,
  Input,
  NativeSelect,
  RadioCard,
  Stack,
  Text,
} from "@chakra-ui/react";
import {
  Avatar,
  AvatarGroup,
  ConfirmDialog,
  CopyBlock,
  Dialog,
  Field,
  FadeInUp,
  Skeleton,
  notify,
} from "@savia-os/ui";
import { Eye, LogOut, Mail, PenLine, ShieldCheck, UserPlus } from "lucide-react";
import type { GroupMemberDto, GroupRole } from "@savia-os/contracts";
import { api } from "@/lib/api";
import { relativeTime } from "@/lib/relative-time";

/* -------------------------------------------------------------------------- */
/*  Role vocabulary — shared across every collective surface (list, detail).   */
/* -------------------------------------------------------------------------- */

interface RoleMeta {
  label: string;
  /** One-line description of what the role can do (invite dialog, CO6). */
  description: string;
  icon: ReactElement;
}

export const ROLE_META: Record<GroupRole, RoleMeta> = {
  viewer: {
    label: "Lector",
    description: "Solo lee la memoria del grupo.",
    icon: <Eye size={14} />,
  },
  contributor: {
    label: "Colaborador",
    description: "Lee y aporta recuerdos al grupo.",
    icon: <PenLine size={14} />,
  },
  admin: {
    label: "Admin",
    description: "Gestiona miembros e invitaciones.",
    icon: <ShieldCheck size={14} />,
  },
};

/** Roles in ascending order of power — the order shown in every selector. */
export const ROLE_ORDER: GroupRole[] = ["viewer", "contributor", "admin"];

export const roleLabel = (r: GroupRole) => ROLE_META[r].label;

/** A pill that names a member's role — icon + text, never colour alone. Admin
 *  gets the ink fill so authority reads at a glance; the rest stay calm. */
export function RoleBadge({ role }: { role: GroupRole }) {
  const meta = ROLE_META[role];
  const isAdmin = role === "admin";
  return (
    <Badge
      colorPalette={isAdmin ? "ink" : "mist"}
      variant={isAdmin ? "solid" : "subtle"}
      borderRadius="chip"
      px="2.5"
      py="1"
    >
      <HStack gap="1.5">
        {meta.icon}
        {meta.label}
      </HStack>
    </Badge>
  );
}

/** Overlapping member avatars. Pass real names for initials, or just a count
 *  for anonymous member dots (the list endpoint only exposes counts). */
export function MemberStack({
  count,
  names,
  size = "xs",
}: {
  count?: number;
  names?: string[];
  size?: "xs" | "sm" | "md";
}) {
  const total = names?.length ?? count ?? 0;
  if (total === 0) return null;
  const max = 4;
  const shownNames = names?.slice(0, max);
  const shownCount = shownNames ? shownNames.length : Math.min(total, max);
  const overflow = total - shownCount;

  return (
    <AvatarGroup gap="0" spaceX="-2.5" size={size}>
      {Array.from({ length: shownCount }).map((_, i) => (
        <Avatar key={i} name={shownNames?.[i]} colorPalette="mist" />
      ))}
      {overflow > 0 ? <Avatar fallback={`+${overflow}`} colorPalette="mist" /> : null}
    </AvatarGroup>
  );
}

/** Future-facing relative time for invite expiry ("en 6 días"). */
function expiresInLabel(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms) || ms <= 0) return "ya expiró";
  const min = Math.round(ms / 60000);
  if (min < 60) return `en ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `en ${h} h`;
  const d = Math.round(h / 24);
  return `en ${d} ${d === 1 ? "día" : "días"}`;
}

/* -------------------------------------------------------------------------- */
/*  Members panel (CO2 + CO5)                                                  */
/* -------------------------------------------------------------------------- */

interface MembersPanelProps {
  groupId: string;
  /** Current user's id — marks the "you" row and guards the sole-admin rule. */
  currentUserId?: string;
  /** The requesting user's role (from GroupDto); derived from members if absent. */
  selfRole?: GroupRole;
}

/**
 * CO2/CO5 — People of a collective group: who's in, what they can do, and the
 * ways in and out. Admins invite (link-based, with role + expiry), change roles
 * inline and remove members; everyone can leave — unless they're the last admin.
 */
export function MembersPanel({ groupId, currentUserId, selfRole }: MembersPanelProps) {
  const router = useRouter();
  const [members, setMembers] = useState<GroupMemberDto[] | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [toRemove, setToRemove] = useState<GroupMemberDto | null>(null);
  const [removing, setRemoving] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const load = useCallback(() => {
    api.groups
      .members(groupId)
      .then(setMembers)
      .catch(() => setMembers([]));
  }, [groupId]);

  useEffect(() => load(), [load]);

  const myRole =
    selfRole ?? members?.find((m) => m.userId === currentUserId)?.role;
  const isAdmin = myRole === "admin";
  const adminCount = useMemo(
    () => (members ?? []).filter((m) => m.role === "admin").length,
    [members],
  );
  const soleAdmin = isAdmin && adminCount <= 1;

  async function changeRole(userId: string, next: GroupRole) {
    try {
      await api.groups.setRole(groupId, userId, next);
      notify.success("Rol actualizado", "Efectivo de inmediato.");
      load();
    } catch {
      notify.error("No pudimos cambiar el rol");
    }
  }

  async function remove() {
    if (!toRemove) return;
    setRemoving(true);
    try {
      await api.groups.removeMember(groupId, toRemove.userId);
      notify.success(`${toRemove.email} ya no es parte del grupo`);
      setToRemove(null);
      load();
    } catch {
      notify.error("No pudimos quitar a esta persona");
    } finally {
      setRemoving(false);
    }
  }

  async function leave() {
    setLeaving(true);
    try {
      await api.groups.leave(groupId);
      notify.success("Saliste del grupo", "Ya no verás esta memoria compartida.");
      router.push("/colectivo");
    } catch {
      notify.error("No pudimos completar la salida");
      setLeaving(false);
    }
  }

  return (
    <Stack gap="5">
      <HStack justify="space-between" align="center" gap="4">
        <Text textStyle="label" color="fg.muted">
          {members ? `${members.length} ${members.length === 1 ? "persona" : "personas"}` : "Personas"}
        </Text>
        {isAdmin ? (
          <Button colorPalette="ink" size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus size={16} /> Invitar persona
          </Button>
        ) : null}
      </HStack>

      {members === null ? (
        <Stack gap="2.5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} h="64px" rounded="2xl" />
          ))}
        </Stack>
      ) : (
        <Stack gap="2.5">
          {members.map((m, i) => {
            const isSelf = m.userId === currentUserId;
            return (
              <FadeInUp key={m.userId} delay={i * 0.05}>
                <HStack
                  gap="3.5"
                  bg="bg.panel"
                  borderWidth="1px"
                  borderColor="border"
                  rounded="2xl"
                  px="4"
                  py="3"
                >
                  <Avatar size="sm" name={m.email} colorPalette="mist" />
                  <Box flex="1" minW="0">
                    <HStack gap="2" minW="0">
                      <Text fontSize="14px" fontWeight="600" color="fg" truncate>
                        {m.email}
                      </Text>
                      {isSelf ? (
                        <Badge colorPalette="mist" variant="subtle" borderRadius="chip" fontSize="11px">
                          Tú
                        </Badge>
                      ) : null}
                    </HStack>
                    <Text fontSize="12px" color="fg.muted">
                      Se unió {relativeTime(m.joinedAt)}
                    </Text>
                  </Box>

                  {isAdmin && !(isSelf && soleAdmin) ? (
                    <NativeSelect.Root w="150px" size="sm" flexShrink="0">
                      <NativeSelect.Field
                        aria-label={`Rol de ${m.email}`}
                        value={m.role}
                        onChange={(e) => changeRole(m.userId, e.target.value as GroupRole)}
                      >
                        {ROLE_ORDER.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_META[r].label}
                          </option>
                        ))}
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                  ) : (
                    <RoleBadge role={m.role} />
                  )}

                  {isSelf ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      colorPalette="mist"
                      flexShrink="0"
                      disabled={soleAdmin}
                      title={soleAdmin ? "Eres el único admin del grupo" : undefined}
                      onClick={() => setLeaveOpen(true)}
                    >
                      <LogOut size={15} /> Salir
                    </Button>
                  ) : isAdmin ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      colorPalette="danger"
                      flexShrink="0"
                      onClick={() => setToRemove(m)}
                    >
                      Quitar
                    </Button>
                  ) : null}
                </HStack>
              </FadeInUp>
            );
          })}

          {soleAdmin ? (
            <Text fontSize="12px" color="fg.muted" px="1">
              Eres el único admin. Asigna admin a otra persona antes de poder salir del grupo.
            </Text>
          ) : null}
        </Stack>
      )}

      <InviteDialog groupId={groupId} open={inviteOpen} onOpenChange={setInviteOpen} />

      <ConfirmDialog
        open={toRemove !== null}
        onOpenChange={(o) => !o && setToRemove(null)}
        title={`¿Quitar a ${toRemove?.email}?`}
        description="Perderá el acceso a esta memoria compartida de inmediato. Puedes volver a invitarla cuando quieras."
        confirmLabel="Quitar del grupo"
        loading={removing}
        onConfirm={remove}
      />

      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={(o) => !o && setLeaveOpen(false)}
        title="¿Salir del grupo?"
        description="Dejarás de ver esta memoria compartida. Necesitarás una nueva invitación para volver."
        confirmLabel="Salir del grupo"
        loading={leaving}
        onConfirm={leave}
      />
    </Stack>
  );
}

/* -------------------------------------------------------------------------- */
/*  Invite dialog (CO5) — generate a link, pick the role, copy, share.         */
/* -------------------------------------------------------------------------- */

interface Generated {
  email: string;
  role: GroupRole;
  link: string;
  expiresAt: string;
}

function InviteDialog({
  groupId,
  open,
  onOpenChange,
}: {
  groupId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<GroupRole>("contributor");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [generated, setGenerated] = useState<Generated | null>(null);

  function reset() {
    setEmail("");
    setRole("contributor");
    setError(null);
    setGenerated(null);
  }

  async function generate() {
    const clean = email.trim().toLowerCase();
    if (!clean.includes("@") || clean.length < 3) {
      setError("Ingresa un email válido.");
      return;
    }
    setError(null);
    setWorking(true);
    try {
      const { token, expiresAt } = await api.groups.invite(groupId, clean, role);
      setGenerated({
        email: clean,
        role,
        expiresAt,
        link: `${window.location.origin}/invitar/${token}`,
      });
    } catch {
      setError("No pudimos crear la invitación. Intenta de nuevo.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
      size="md"
      title={generated ? "Invitación lista" : "Invitar a la memoria colectiva"}
      footer={
        generated ? (
          <>
            <Button variant="ghost" colorPalette="mist" onClick={reset}>
              Invitar a otra persona
            </Button>
            <Button colorPalette="ink" onClick={() => onOpenChange(false)}>
              Listo
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" colorPalette="mist" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button colorPalette="ink" onClick={generate} loading={working} loadingText="Creando…">
              Generar invitación
            </Button>
          </>
        )
      }
    >
      {generated ? (
        <Stack gap="4">
          <Text fontSize="14px" color="fg.muted" lineHeight="1.6">
            Comparte este enlace con{" "}
            <Box as="span" color="fg" fontWeight="600">
              {generated.email}
            </Box>
            . Al abrirlo entrará como{" "}
            <Box as="span" color="fg" fontWeight="600">
              {ROLE_META[generated.role].label.toLowerCase()}
            </Box>
            .
          </Text>
          <CopyBlock value={generated.link} copyLabel="Copiar enlace de invitación" fontSize="13px" />
          <Text fontSize="12px" color="fg.muted">
            El enlace vence {expiresInLabel(generated.expiresAt)}. Puedes generar otro cuando quieras.
          </Text>
        </Stack>
      ) : (
        <Stack gap="5">
          <Field label="Email de la persona" error={error ?? undefined}>
            <Input
              type="email"
              placeholder="persona@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && generate()}
              autoFocus
            />
          </Field>

          <Box>
            <Text fontSize="13px" fontWeight="600" color="fg" mb="2.5">
              ¿Qué podrá hacer?
            </Text>
            <RadioCard.Root
              value={role}
              onValueChange={(e) => e.value && setRole(e.value as GroupRole)}
              colorPalette="ink"
            >
              <Group orientation="vertical" attached={false} gap="2" w="full">
                {ROLE_ORDER.map((r) => (
                  <RadioCard.Item key={r} value={r} w="full">
                    <RadioCard.ItemHiddenInput />
                    <RadioCard.ItemControl>
                      <RadioCard.ItemContent>
                        <HStack gap="2">
                          {ROLE_META[r].icon}
                          <RadioCard.ItemText>{ROLE_META[r].label}</RadioCard.ItemText>
                        </HStack>
                        <RadioCard.ItemDescription>
                          {ROLE_META[r].description}
                        </RadioCard.ItemDescription>
                      </RadioCard.ItemContent>
                      <RadioCard.ItemIndicator />
                    </RadioCard.ItemControl>
                  </RadioCard.Item>
                ))}
              </Group>
            </RadioCard.Root>
          </Box>

          <HStack gap="2" color="fg.muted" fontSize="12px" align="flex-start">
            <Box mt="0.5" flexShrink="0">
              <Mail size={14} />
            </Box>
            <Text lineHeight="1.5">
              Generamos un enlace de invitación para compartir. La persona se une al abrirlo.
            </Text>
          </HStack>
        </Stack>
      )}
    </Dialog>
  );
}
