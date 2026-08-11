"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import {
  AlertCircle,
  ArrowUpRight,
  Bell,
  CheckCheck,
  CheckCircle2,
  Mail,
  Sparkles,
  TrendingUp,
  UserPlus,
} from "lucide-react";
import {
  EmptyState,
  FadeInUp,
  SaviaMark,
  Skeleton,
  StatusBadge,
  notify,
} from "@savia-os/ui";
import type {
  GroupRole,
  InboxItem,
  PendingInviteDto,
  SuggestedSpace,
} from "@savia-os/legacy-contracts";
import { api } from "@/lib/api";
import { relativeTime } from "@/lib/relative-time";

/* ------------------------------------------------------------------ helpers */

const ROLE_LABEL: Record<GroupRole, string> = {
  viewer: "lector",
  contributor: "colaborador",
  admin: "admin",
};

/**
 * Defensive read of a string field from an inbox item's untyped `data` blob.
 * The shape per kind isn't in the contract yet (see the report), so every read
 * is guarded — never trust `data` to have a given key or type.
 */
function readStr(data: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return null;
}

/** Relative label for a *future* expiry — `relative-time.ts` only handles past. */
function expiryLabel(iso: string): { text: string; expired: boolean } {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return { text: "sin vencimiento", expired: false };
  const diff = then - Date.now();
  if (diff <= 0) return { text: "Venció", expired: true };
  const hours = Math.round(diff / 3_600_000);
  if (hours < 1) return { text: "Vence en menos de 1 h", expired: false };
  if (hours < 24) return { text: `Vence en ${hours} h`, expired: false };
  const days = Math.round(hours / 24);
  return { text: `Vence en ${days} ${days === 1 ? "día" : "días"}`, expired: false };
}

interface InboxPresentation {
  icon: ReactNode;
  title: string;
  detail?: string;
  /** Where the card navigates on click, when it has a context to open. */
  href?: string;
}

/**
 * Turn one real inbox item into its visual presentation. Copy + destination are
 * derived defensively from `kind` and the untyped `data`; suggestions are the
 * one kind whose actions live inline (accept/ignore), so they get no `href`.
 */
function presentInbox(item: InboxItem): InboxPresentation {
  switch (item.kind) {
    case "invite": {
      const groupName = readStr(item.data, "groupName", "name");
      const role = readStr(item.data, "role");
      const roleName = role && role in ROLE_LABEL ? ROLE_LABEL[role as GroupRole] : null;
      return {
        icon: <Mail size={17} />,
        title: groupName ? `Te invitaron a «${groupName}»` : "Tienes una invitación a un grupo",
        detail: roleName ? `Como ${roleName}. Ábrela para ver el grupo.` : "Ábrela para ver el grupo.",
        href: item.refId ? `/colectivo/${item.refId}` : "/colectivo",
      };
    }
    case "suggestion": {
      const rationale = readStr(item.data, "rationale");
      return {
        icon: <Sparkles size={17} />,
        title: rationale ? `Savia sugiere: ${rationale}` : "Savia sugiere una mejora en tu memoria.",
        detail: "Puedes aplicarla ahora — o ignorarla.",
      };
    }
    case "job": {
      const type = (readStr(item.data, "type", "kind") ?? "").toLowerCase();
      const failed = readStr(item.data, "status") === "failed";
      const isExport = type.includes("export");
      return {
        icon: failed ? <AlertCircle size={17} /> : <CheckCircle2 size={17} />,
        title: failed
          ? "Un proceso no pudo terminar."
          : isExport
            ? "Tu exportación está lista."
            : "Un proceso terminó.",
        detail:
          readStr(item.data, "message", "detail") ??
          (isExport ? "Descárgala desde tu cuenta." : "Míralo en tu cuenta."),
        href: "/cuenta",
      };
    }
    case "milestone": {
      const text = readStr(item.data, "text", "message", "title");
      return {
        icon: <TrendingUp size={17} />,
        title: text ?? "Tus IAs sumaron recuerdos esta semana.",
        detail: "Míralo en tu Pulso.",
        href: "/pulso",
      };
    }
    case "member_joined": {
      const who = readStr(item.data, "email", "memberEmail", "displayName", "name");
      const groupName = readStr(item.data, "groupName", "name");
      return {
        icon: <UserPlus size={17} />,
        title: `${who ?? "Alguien"} se unió a «${groupName ?? "tu grupo"}».`,
        detail: "Ve al grupo.",
        href: item.refId ? `/colectivo/${item.refId}` : "/colectivo",
      };
    }
    default:
      return { icon: <Bell size={17} />, title: "Tienes un aviso nuevo." };
  }
}

/* -------------------------------------------------------------------- state */

interface ReadyData {
  inbox: InboxItem[];
  invites: PendingInviteDto[];
  spaces: SuggestedSpace[];
}

type State = { status: "loading" } | { status: "error" } | ({ status: "ready" } & ReadyData);

type FeedEntry =
  | { kind: "inbox"; createdAt: string; item: InboxItem }
  | { kind: "invite"; createdAt: string; invite: PendingInviteDto };

/**
 * N1 — Bandeja: the real notification center. Merges the backend inbox
 * (`GET /inbox`) with pending group invites (`GET /invites`) into one feed
 * ordered by recency, keeping the shell's unread badge honest. Suggestions are
 * actionable inline (Savia applies / you ignore); everything else opens its
 * context and marks itself read on the way. Savia's detected areas ride along
 * as a calm secondary section.
 */
export function BandejaScreen() {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "loading" });
  const [markingAll, setMarkingAll] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creatingSpace, setCreatingSpace] = useState<string | null>(null);
  const [dismissedSpaces, setDismissedSpaces] = useState<ReadonlySet<string>>(new Set());

  // Each source settles on its own: one failure degrades gracefully to [] and
  // never takes the whole screen down (only a total inbox+invites failure is an
  // error). suggest-spaces is purely additive, so its failure is silent.
  const fetchAll = useCallback(async () => {
    const settle = <T,>(p: Promise<T>) =>
      p.then((value) => ({ ok: true as const, value })).catch(() => ({ ok: false as const }));
    const [inbox, invites, spaces] = await Promise.all([
      settle(api.inbox.list()),
      settle(api.invites.listPending()),
      settle(api.onboarding.suggestSpaces()),
    ]);
    return { inbox, invites, spaces };
  }, []);

  const load = useCallback(() => {
    let cancelled = false;
    setState({ status: "loading" });
    fetchAll().then(({ inbox, invites, spaces }) => {
      if (cancelled) return;
      if (!inbox.ok && !invites.ok) {
        setState({ status: "error" });
        return;
      }
      setState({
        status: "ready",
        inbox: inbox.ok ? inbox.value : [],
        invites: invites.ok ? invites.value : [],
        spaces: spaces.ok ? spaces.value : [],
      });
    });
    return () => {
      cancelled = true;
    };
  }, [fetchAll]);

  useEffect(() => load(), [load]);

  /** Silent re-sync after an action — no skeleton flash. */
  const refresh = useCallback(async () => {
    const { inbox, invites, spaces } = await fetchAll();
    if (!inbox.ok && !invites.ok) return;
    setState({
      status: "ready",
      inbox: inbox.ok ? inbox.value : [],
      invites: invites.ok ? invites.value : [],
      spaces: spaces.ok ? spaces.value : [],
    });
  }, [fetchAll]);

  async function markAll() {
    if (state.status !== "ready") return;
    const unseen = state.inbox.filter((i) => !i.seen);
    if (unseen.length === 0) return;
    setMarkingAll(true);
    setState((s) =>
      s.status === "ready" ? { ...s, inbox: s.inbox.map((i) => ({ ...i, seen: true })) } : s,
    );
    try {
      await Promise.all(unseen.map((i) => api.inbox.markSeen(i.id)));
      await refresh();
    } catch {
      notify.error("No pudimos marcar todo como leído.", "Intenta de nuevo.");
      await refresh();
    } finally {
      setMarkingAll(false);
    }
  }

  function openInbox(item: InboxItem, href: string) {
    if (!item.seen) {
      api.inbox.markSeen(item.id).catch(() => {});
      setState((s) =>
        s.status === "ready"
          ? { ...s, inbox: s.inbox.map((i) => (i.id === item.id ? { ...i, seen: true } : i)) }
          : s,
      );
    }
    router.push(href);
  }

  async function resolveSuggestion(item: InboxItem, action: "accept" | "dismiss") {
    setBusyId(item.id);
    try {
      if (item.refId) {
        if (action === "accept") await api.inbox.acceptSuggestion(item.refId);
        else await api.inbox.dismissSuggestion(item.refId);
      }
      await api.inbox.markSeen(item.id).catch(() => {});
      setState((s) =>
        s.status === "ready" ? { ...s, inbox: s.inbox.filter((i) => i.id !== item.id) } : s,
      );
      if (action === "accept") {
        notify.success("Entendido — Savia lo aplicó.", "Puedes revertirlo desde Pulso.");
      } else {
        notify.info("Listo, la ignoramos.", "No volveremos a sugerir esto.");
      }
    } catch {
      notify.error("No pudimos aplicar eso.", "Intenta de nuevo.");
    } finally {
      setBusyId(null);
    }
  }

  async function createSpace(space: SuggestedSpace) {
    setCreatingSpace(space.name);
    try {
      const area = await api.areas.create(space.description || space.name);
      notify.success("Área creada.", `«${space.name}» ya vive en tu memoria.`);
      router.push(`/memoria/${area.id}`);
    } catch {
      notify.error("No pudimos crear el área.", "Intenta de nuevo.");
      setCreatingSpace(null);
    }
  }

  function showInviteHint() {
    // PendingInviteDto never carries the token (contract note), so acceptance
    // still goes through the emailed link. Inline accept would need a new
    // endpoint — espera endpoint: POST /invites/:id/accept-inline.
    notify.info("Revisa tu correo.", "Acéptala desde el link de la invitación que te enviamos por email.");
  }

  /* ------------------------------------------------------------------ views */

  if (state.status === "loading") {
    return (
      <Stack gap="8" maxW="760px">
        <Stack gap="3">
          <Skeleton h="12px" w="88px" rounded="md" />
          <Skeleton h="44px" w="min(340px, 80%)" rounded="lg" />
          <Skeleton h="16px" w="min(260px, 70%)" rounded="md" />
        </Stack>
        <Stack gap="3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} h="88px" rounded="2xl" />
          ))}
        </Stack>
      </Stack>
    );
  }

  if (state.status === "error") {
    return (
      <Stack gap="8" maxW="760px">
        <Header unread={0} onMarkAll={markAll} markingAll={false} />
        <HStack
          gap="3"
          align="center"
          bg="bg.panel"
          borderWidth="1px"
          borderColor="border"
          rounded="2xl"
          px="5"
          py="5"
        >
          <Box color="fg.muted" flexShrink="0">
            <AlertCircle size={20} />
          </Box>
          <Text textStyle="caption" color="fg.muted" flex="1">
            No pudimos cargar tu bandeja ahora.
          </Text>
          <Button size="sm" variant="outline" onClick={load}>
            Reintentar
          </Button>
        </HStack>
      </Stack>
    );
  }

  // Dedup: an inbox `invite` that mirrors a pending invite (same id or group)
  // is dropped in favour of the richer PendingInviteDto row.
  const pendingKeys = new Set<string>();
  for (const inv of state.invites) {
    pendingKeys.add(inv.id);
    pendingKeys.add(inv.groupId);
  }
  const inboxItems = state.inbox.filter(
    (it) => !(it.kind === "invite" && it.refId !== null && pendingKeys.has(it.refId)),
  );

  const feed: FeedEntry[] = [
    ...inboxItems.map((item): FeedEntry => ({ kind: "inbox", createdAt: item.createdAt, item })),
    ...state.invites.map(
      (invite): FeedEntry => ({ kind: "invite", createdAt: invite.createdAt, invite }),
    ),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const unread = state.inbox.filter((i) => !i.seen).length;
  const visibleSpaces = state.spaces.filter((s) => !dismissedSpaces.has(s.name));

  return (
    <Stack gap="8" maxW="760px">
      <FadeInUp>
        <Header unread={unread} onMarkAll={markAll} markingAll={markingAll} />
      </FadeInUp>

      {feed.length === 0 ? (
        <FadeInUp delay={0.05}>
          <EmptyState
            icon={<SaviaMark size={34} />}
            title="Estás al día."
            description="No hay nada que necesite tu atención. Cuando llegue una invitación o Savia note algo, aparecerá aquí."
          />
        </FadeInUp>
      ) : (
        <Stack gap="3">
          {feed.map((entry, i) => {
            const delay = Math.min(i, 7) * 0.06 + 0.04;
            if (entry.kind === "invite") {
              const inv = entry.invite;
              const exp = expiryLabel(inv.expiresAt);
              return (
                <FadeInUp key={`inv-${inv.id}`} delay={delay} distance={12}>
                  <FeedRow
                    icon={<Mail size={17} />}
                    title={`Te invitaron a «${inv.groupName}»`}
                    detail={`Como ${ROLE_LABEL[inv.role]}.`}
                    seen={false}
                    meta={
                      <HStack gap="2" wrap="wrap">
                        <Text textStyle="caption" color="fg.subtle">
                          {relativeTime(inv.createdAt)}
                        </Text>
                        {exp.expired ? (
                          <StatusBadge tone="danger" icon={<AlertCircle size={12} />}>
                            {exp.text}
                          </StatusBadge>
                        ) : (
                          <Text textStyle="caption" color="fg.muted">
                            · {exp.text}
                          </Text>
                        )}
                      </HStack>
                    }
                    actions={
                      <Button size="sm" variant="outline" onClick={showInviteHint}>
                        <Mail size={14} /> Ver invitación
                      </Button>
                    }
                  />
                </FadeInUp>
              );
            }

            const { item } = entry;
            const p = presentInbox(item);
            const isSuggestion = item.kind === "suggestion";
            const navigable = !isSuggestion && Boolean(p.href);
            const busy = busyId === item.id;
            return (
              <FadeInUp key={item.id} delay={delay} distance={12}>
                <FeedRow
                  icon={p.icon}
                  title={p.title}
                  detail={p.detail}
                  seen={item.seen}
                  meta={
                    <Text textStyle="caption" color="fg.subtle">
                      {relativeTime(item.createdAt)}
                    </Text>
                  }
                  navigable={navigable}
                  onOpen={navigable && p.href ? () => openInbox(item, p.href!) : undefined}
                  actions={
                    isSuggestion ? (
                      <>
                        <Button
                          size="sm"
                          colorPalette="ink"
                          loading={busy}
                          loadingText="Aplicando…"
                          onClick={() => resolveSuggestion(item, "accept")}
                        >
                          Aceptar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => resolveSuggestion(item, "dismiss")}
                        >
                          Ignorar
                        </Button>
                      </>
                    ) : undefined
                  }
                />
              </FadeInUp>
            );
          })}
        </Stack>
      )}

      {visibleSpaces.length > 0 ? (
        <FadeInUp delay={0.06}>
          <Stack gap="3">
            <Box>
              <Text textStyle="label" color="fg.muted">
                Savia detectó áreas
              </Text>
              <Text textStyle="caption" color="fg.muted" mt="1" maxW="52ch" lineHeight="1.6">
                Agrupaciones que Savia ve en tu memoria. Créalas cuando quieras — o déjalas pasar.
              </Text>
            </Box>
            {visibleSpaces.map((space) => (
              <FeedRow
                key={space.name}
                seen
                icon={<Sparkles size={17} />}
                title={`«${space.name}»`}
                detail={`${space.memoryCount} ${
                  space.memoryCount === 1 ? "recuerdo podría vivir" : "recuerdos podrían vivir"
                } aquí. ${space.description}`}
                actions={
                  <>
                    <Button
                      size="sm"
                      colorPalette="ink"
                      loading={creatingSpace === space.name}
                      loadingText="Creando…"
                      onClick={() => createSpace(space)}
                    >
                      Crear área
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={creatingSpace === space.name}
                      onClick={() =>
                        setDismissedSpaces((prev) => new Set(prev).add(space.name))
                      }
                    >
                      Descartar
                    </Button>
                  </>
                }
              />
            ))}
          </Stack>
        </FadeInUp>
      ) : null}
    </Stack>
  );
}

/* --------------------------------------------------------------- subviews */

function Header({
  unread,
  onMarkAll,
  markingAll,
}: {
  unread: number;
  onMarkAll: () => void;
  markingAll: boolean;
}) {
  return (
    <Stack gap="2.5">
      <HStack gap="3">
        <Text textStyle="label" color="fg.muted">
          Bandeja
        </Text>
        {unread > 0 ? (
          <StatusBadge tone="neutral" icon={<Bell size={12} />}>
            {unread} sin leer
          </StatusBadge>
        ) : null}
      </HStack>
      <HStack justify="space-between" align="flex-end" gap="4" wrap="wrap">
        <Text as="h1" fontSize="displayMd" fontWeight="300" lineHeight="1" color="fg">
          Lo que necesita tu atención.
        </Text>
        {unread > 0 ? (
          <Button
            size="sm"
            variant="ghost"
            color="fg.muted"
            loading={markingAll}
            loadingText="Marcando…"
            onClick={onMarkAll}
          >
            <CheckCheck size={15} /> Marcar todo como leído
          </Button>
        ) : null}
      </HStack>
      <Text textStyle="caption" color="fg.muted" maxW="54ch" lineHeight="1.6">
        Invitaciones, sugerencias de Savia y avisos de tus grupos — en un solo lugar.
      </Text>
    </Stack>
  );
}

/**
 * One feed row. Unread rows carry an ink dot, a lifted shadow and the crisp
 * `border` (design system §—: dot ink a la izquierda); read rows recede (muted
 * icon, subtle border, flat). Navigable rows behave as links (Enter/Space,
 * focus ring), while inline actions keep the click to themselves.
 */
function FeedRow({
  icon,
  title,
  detail,
  meta,
  seen,
  navigable = false,
  onOpen,
  actions,
}: {
  icon: ReactNode;
  title: ReactNode;
  detail?: ReactNode;
  meta?: ReactNode;
  seen: boolean;
  navigable?: boolean;
  onOpen?: () => void;
  actions?: ReactNode;
}) {
  const clickable = navigable && Boolean(onOpen);
  return (
    <HStack
      align="flex-start"
      gap="3.5"
      bg="bg.panel"
      borderWidth="1px"
      borderColor={seen ? "border.subtle" : "border"}
      boxShadow={seen ? undefined : "soft"}
      rounded="2xl"
      px="5"
      py="4"
      role={clickable ? "link" : undefined}
      tabIndex={clickable ? 0 : undefined}
      cursor={clickable ? "pointer" : undefined}
      transition="border-color 0.2s, box-shadow 0.2s, transform 0.2s"
      _hover={
        clickable
          ? { transform: "translateY(-1px)", boxShadow: "float", borderColor: "border" }
          : undefined
      }
      _focusVisible={
        clickable
          ? { outline: "2px solid", outlineColor: "ink", outlineOffset: "2px" }
          : undefined
      }
      onClick={clickable ? onOpen : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen?.();
              }
            }
          : undefined
      }
    >
      {/* Unread marker: an ink dot in the left gutter. */}
      <Box w="2" alignSelf="stretch" flexShrink="0" display="flex" justifyContent="center" pt="2.5">
        {!seen ? <Box w="2" h="2" rounded="full" bg="fg" aria-hidden /> : null}
      </Box>

      <Box
        w="9"
        h="9"
        rounded="xl"
        flexShrink="0"
        display="flex"
        alignItems="center"
        justifyContent="center"
        bg="bg.subtle"
        color={seen ? "fg.muted" : "fg"}
      >
        {icon}
      </Box>

      <Stack gap="1.5" flex="1" minW="0">
        <Text fontSize="15px" fontWeight="600" color="fg" lineClamp="2">
          {title}
        </Text>
        {detail ? (
          <Text textStyle="caption" color="fg.muted" lineHeight="1.5" lineClamp="2">
            {detail}
          </Text>
        ) : null}
        {meta ? <Box mt="0.5">{meta}</Box> : null}
        {actions ? (
          <HStack gap="2.5" pt="2" wrap="wrap" onClick={(e) => e.stopPropagation()}>
            {actions}
          </HStack>
        ) : null}
      </Stack>

      {navigable ? (
        <Box color="fg.subtle" flexShrink="0" mt="1" aria-hidden>
          <ArrowUpRight size={16} />
        </Box>
      ) : null}
    </HStack>
  );
}
