"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Button, Editable, HStack, IconButton, Stack, Text } from "@chakra-ui/react";
import { Download, LogOut, Pencil } from "lucide-react";
import { Avatar, FadeInUp, Skeleton, notify } from "@savia-os/ui";
import type { MeResponse } from "@savia-os/legacy-contracts";
import { api } from "@/lib/api";
import { useSubscription } from "@/lib/use-subscription";
import { SectionCard } from "./section-card";
import { PlanSection } from "./plan-section";
import { HelpSection } from "./help-section";
import { DeleteAccountDialog } from "./delete-account-dialog";
import { formatLongDate } from "./format";

/**
 * Cuenta (CT1–CT4) — the account as one considered document: profile, plan
 * (the signature ink surface when it's live), data ownership, help, and the
 * danger zone. Everything real: logout, name edit, cancel/reactivate, export
 * and delete all go through `api`. Sections enter staggered on load.
 */
export function CuentaScreen() {
  const router = useRouter();
  const { active, subscription, ready, refresh } = useSubscription();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [meError, setMeError] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const loadMe = useCallback(() => {
    setMeError(false);
    api.me()
      .then(setMe)
      .catch(() => setMeError(true));
  }, []);

  useEffect(() => loadMe(), [loadMe]);

  async function logout() {
    try {
      await api.logout();
    } finally {
      router.push("/login");
    }
  }

  async function saveName(value: string) {
    const trimmed = value.trim();
    if (!me || !trimmed || trimmed === (me.displayName ?? "")) return;
    try {
      const updated = await api.onboarding.saveProfile(trimmed);
      setMe(updated);
      notify.success("Listo, actualizamos tu nombre.");
    } catch {
      notify.error("No pudimos guardar tu nombre.", "Intenta de nuevo.");
    }
  }

  async function requestExport() {
    setExporting(true);
    try {
      await api.account.requestExport();
      notify.success(
        "Estamos preparando tu exportación.",
        "Te avisamos en la Bandeja cuando esté lista.",
      );
    } catch {
      notify.error("No pudimos iniciar la exportación.", "Intenta de nuevo en un momento.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Stack gap="6" maxW="800px" pb="12">
      <Box>
        <Text textStyle="label" color="fg.muted">
          Tu cuenta
        </Text>
        <Text as="h1" textStyle="pageTitle" fontWeight="300" color="fg" mt="2.5">
          Tu cuenta.
        </Text>
        <Text fontSize="15px" color="fg.muted" lineHeight="1.6" mt="2">
          Tu perfil, tu plan y tus datos. Todo tuyo, en un solo lugar.
        </Text>
      </Box>

      {/* CT1 — perfil */}
      <FadeInUp>
        <ProfileCard me={me} error={meError} onRetry={loadMe} onSaveName={saveName} onLogout={logout} />
      </FadeInUp>

      {/* CT2 — plan + facturación (el núcleo) */}
      <FadeInUp delay={0.08}>
        <PlanSection subscription={subscription} active={active} ready={ready} onChanged={refresh} />
      </FadeInUp>

      {/* CT3 — tus datos */}
      <FadeInUp delay={0.16}>
        <SectionCard label="Tus datos">
          <Stack gap="2">
            <Text fontSize="15px" color="fg" lineHeight="1.6" maxW="58ch">
              Estos son tus datos, en bruto. Savia los procesa para organizarlos, pero siempre son
              tuyos.
            </Text>
            <Text fontSize="13px" color="fg.muted" lineHeight="1.6" maxW="58ch">
              Te los damos en JSON y CSV. El enlace de descarga vale 48 horas.
            </Text>
          </Stack>
          <Button
            variant="outline"
            alignSelf="flex-start"
            loading={exporting}
            loadingText="Preparando…"
            onClick={requestExport}
          >
            <Download size={16} /> Solicitar exportación
          </Button>
        </SectionCard>
      </FadeInUp>

      {/* CT4 — ayuda y soporte */}
      <FadeInUp delay={0.24}>
        <HelpSection />
      </FadeInUp>

      {/* Zona peligrosa */}
      <FadeInUp delay={0.32}>
        <SectionCard label="Zona peligrosa" tone="danger">
          <HStack justify="space-between" align="flex-start" flexWrap="wrap" gap="4">
            <Stack gap="1.5">
              <Text textStyle="cardTitle" color="fg">
                Eliminar tu cuenta
              </Text>
              <Text fontSize="14px" color="fg.muted" lineHeight="1.6" maxW="52ch">
                Esto borra toda tu memoria de forma permanente. No podemos recuperarla después.
              </Text>
            </Stack>
            <Button
              variant="outline"
              colorPalette="danger"
              flexShrink="0"
              onClick={() => setConfirmDelete(true)}
            >
              Eliminar cuenta
            </Button>
          </HStack>
        </SectionCard>
      </FadeInUp>

      <DeleteAccountDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        email={me?.email ?? ""}
        onDeleted={() => router.push("/login")}
      />
    </Stack>
  );
}

interface ProfileCardProps {
  me: MeResponse | null;
  error: boolean;
  onRetry: () => void;
  onSaveName: (value: string) => void;
  onLogout: () => void;
}

/** CT1 — avatar, editable display name, read-only email, member-since, logout. */
function ProfileCard({ me, error, onRetry, onSaveName, onLogout }: ProfileCardProps) {
  return (
    <SectionCard label="Perfil">
      {error ? (
        <HStack justify="space-between" flexWrap="wrap" gap="3">
          <Text fontSize="14px" color="fg.muted">
            No pudimos cargar tu perfil.
          </Text>
          <Button variant="outline" size="sm" onClick={onRetry}>
            Reintentar
          </Button>
        </HStack>
      ) : !me ? (
        <HStack gap="4">
          <Skeleton w="56px" h="56px" rounded="full" />
          <Stack gap="2" flex="1">
            <Skeleton h="16px" w="180px" rounded="md" />
            <Skeleton h="13px" w="220px" rounded="md" />
          </Stack>
        </HStack>
      ) : (
        <HStack gap="4" align="center" flexWrap="wrap">
          <Avatar size="lg" name={me.displayName || me.email} />
          <Box flex="1" minW="0">
            <HStack gap="1" align="center">
              <Editable.Root
                key={me.id}
                defaultValue={me.displayName ?? ""}
                placeholder="Añade tu nombre"
                onValueCommit={(e) => onSaveName(e.value)}
                fontSize="17px"
                fontWeight="600"
                color="fg"
                maxW="360px"
              >
                <Editable.Preview />
                <Editable.Input />
                <Editable.Control>
                  <Editable.EditTrigger asChild>
                    <IconButton aria-label="Editar tu nombre" variant="ghost" size="2xs" color="fg.muted">
                      <Pencil size={13} />
                    </IconButton>
                  </Editable.EditTrigger>
                </Editable.Control>
              </Editable.Root>
            </HStack>
            <Text fontSize="13px" color="fg.muted" truncate>
              {me.email}
            </Text>
            <Text fontSize="12px" color="fg.subtle" mt="1">
              Miembro desde el {formatLongDate(me.createdAt)}
            </Text>
          </Box>
          <Button variant="outline" size="sm" flexShrink="0" onClick={onLogout}>
            <LogOut size={15} /> Cerrar sesión
          </Button>
        </HStack>
      )}
    </SectionCard>
  );
}
