"use client";

import { useState } from "react";
import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { AlertTriangle, ArrowRight, Check, Clock } from "lucide-react";
import { ConfirmDialog, Skeleton, notify } from "@savia-os/ui";
import type { SubscriptionDto } from "@savia-os/contracts";
import { api } from "@/lib/api";
import { SubscriptionGate } from "@/components/billing/subscription-gate";
import { SectionCard } from "./section-card";
import { BillingHistory } from "./billing-history";
import { formatLongDate } from "./format";

/** What an active plan unlocks — shown on the ink panel where lime finally glows. */
const PLAN_INCLUDES = [
  "Conecta todas las IAs que quieras — Claude, Cursor, ChatGPT y más.",
  "Mira en vivo lo que cada IA hace con tu memoria.",
  "Deja que tus IAs lean y recuerden por ti.",
];

type PlanView = "free" | "active" | "grace" | "failed" | "pending";

/** Resolve the display state. `subscription` is authoritative; `active` (from the
 *  materialized plan on the user) is the fallback when the detail call fails. */
function planView(sub: SubscriptionDto | null, active: boolean): PlanView {
  switch (sub?.status) {
    case "active":
      return "active";
    case "failed":
      return "failed";
    case "pending":
      return "pending";
    case "cancelled":
    case "paused":
      return "grace";
    default:
      return active ? "active" : "free";
  }
}

interface PlanSectionProps {
  subscription: SubscriptionDto | null;
  active: boolean;
  ready: boolean;
  /** Re-reads me() + subscription after a mutation (cancel / reactivate / checkout). */
  onChanged: () => void;
}

/**
 * CT2 — the core of the account. The one signature dark surface on this otherwise
 * light admin page: when the plan is live (or in its grace window) it becomes an
 * ink panel where the lime accent glows — a deliberate "this is yours, and it's
 * on" moment. Free / failed / pending stay on light cards with an ink CTA (lime
 * only ever lands on dark). Billing history follows below.
 */
export function PlanSection({ subscription, active, ready, onChanged }: PlanSectionProps) {
  const [gateOpen, setGateOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!ready) {
    return <Skeleton h="220px" rounded="2xl" />;
  }

  const view = planView(subscription, active);
  const price = `$${(subscription?.amount ?? 11.99).toFixed(2)}`;
  const renewal = formatLongDate(subscription?.nextPaymentAt);

  async function cancel() {
    setBusy(true);
    try {
      const updated = await api.billing.cancel();
      notify.success(
        "Suscripción cancelada.",
        `Tu acceso sigue hasta el ${formatLongDate(updated.nextPaymentAt)}.`,
      );
      onChanged();
    } catch {
      notify.error("No pudimos cancelar ahora.", "Intenta de nuevo en un momento.");
    } finally {
      setBusy(false);
      setConfirmCancel(false);
    }
  }

  async function reactivate() {
    setBusy(true);
    try {
      await api.billing.reactivate();
      notify.success("Suscripción reactivada.", "Tus IAs siguen conectadas.");
      onChanged();
    } catch {
      notify.error("No pudimos reactivar ahora.", "Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack gap="6">
      {view === "free" ? (
        <SectionCard label="Plan">
          <Stack gap="2">
            <Text textStyle="cardTitle" color="fg">
              Plan gratuito
            </Text>
            <Text fontSize="14px" color="fg.muted" lineHeight="1.6" maxW="54ch">
              Organiza y explora tu memoria gratis. Actívala para que tus IAs se conecten y
              recuerden por ti.
            </Text>
          </Stack>
          <Button colorPalette="ink" size="lg" alignSelf="flex-start" onClick={() => setGateOpen(true)}>
            Activar suscripción — $11.99/mes
            <ArrowRight size={16} />
          </Button>
        </SectionCard>
      ) : null}

      {view === "pending" ? (
        <SectionCard label="Plan">
          <HStack gap="3.5" align="flex-start">
            <Box color="info.fg" mt="0.5" flexShrink="0">
              <Clock size={20} />
            </Box>
            <Stack gap="1.5">
              <Text textStyle="cardTitle" color="fg">
                Confirmando tu pago…
              </Text>
              <Text fontSize="14px" color="fg.muted" lineHeight="1.6" maxW="54ch">
                Mercado Pago está procesando tu suscripción. Puede tardar unos minutos — te
                avisaremos en la Bandeja en cuanto quede activa.
              </Text>
            </Stack>
          </HStack>
        </SectionCard>
      ) : null}

      {view === "failed" ? (
        <Stack
          gap="4"
          bg="danger.subtle"
          borderWidth="1px"
          borderColor="danger.border"
          rounded="2xl"
          p={{ base: "5", md: "7" }}
        >
          <Text textStyle="label" color="danger.fg">
            Plan
          </Text>
          <HStack gap="3.5" align="flex-start">
            <Box color="danger.fg" mt="0.5" flexShrink="0">
              <AlertTriangle size={20} />
            </Box>
            <Stack gap="1.5">
              <Text textStyle="cardTitle" color="danger.fg">
                No pudimos cobrar tu suscripción.
              </Text>
              <Text fontSize="14px" color="fg.muted" lineHeight="1.6" maxW="54ch">
                Actualiza tu método de pago para no perder el acceso. Tu memoria está a salvo — solo
                necesitamos reintentar el cobro.
              </Text>
            </Stack>
          </HStack>
          <Button colorPalette="ink" alignSelf="flex-start" onClick={() => setGateOpen(true)}>
            Actualizar método de pago
          </Button>
        </Stack>
      ) : null}

      {view === "active" || view === "grace" ? (
        <PlanPanel>
          <HStack justify="space-between" align="flex-start" gap="4" flexWrap="wrap">
            <Stack gap="3.5">
              <HStack gap="3">
                <Text textStyle="label" color="lime.solid">
                  Tu plan
                </Text>
                {view === "active" ? (
                  <StatePill dot="success.solid" label="Activa" />
                ) : (
                  <StatePill dot="warning.solid" label="Se cancelará" />
                )}
              </HStack>

              {view === "active" ? (
                <Text fontWeight="300" fontSize="displayMd" lineHeight="1">
                  Plan{" "}
                  <Box as="span" fontWeight="600" color="lime.solid">
                    mensual
                  </Box>
                  .
                </Text>
              ) : (
                <Text fontWeight="300" fontSize="displayMd" lineHeight="1.05" maxW="16ch">
                  Tu acceso sigue{" "}
                  <Box as="span" fontWeight="600" color="lime.solid">
                    activo
                  </Box>
                  .
                </Text>
              )}

              {view === "active" ? (
                <Stack gap="1">
                  <HStack gap="2" align="baseline">
                    <Text textStyle="metric" fontSize="2xl" color="fg.inverse">
                      {price}
                    </Text>
                    <Text fontSize="14px" color="fg.inverse/60">
                      / mes
                    </Text>
                  </HStack>
                  <Text fontSize="13px" color="fg.inverse/70">
                    Próxima renovación · {renewal}
                  </Text>
                </Stack>
              ) : (
                <Text fontSize="14px" color="fg.inverse/75" lineHeight="1.6" maxW="46ch">
                  Hasta el {renewal}. Después, tus IAs se desconectarán — pero toda tu memoria se
                  conserva.
                </Text>
              )}
            </Stack>
          </HStack>

          <Box h="1px" bg="border.inverse" />

          <Stack gap="3">
            <Text textStyle="label" color="fg.inverse/55">
              Qué incluye tu plan
            </Text>
            {PLAN_INCLUDES.map((item) => (
              <HStack key={item} gap="2.5" align="flex-start">
                <Box color="lime.solid" mt="0.5" flexShrink="0">
                  <Check size={15} strokeWidth={2.4} />
                </Box>
                <Text fontSize="13.5px" color="fg.inverse" lineHeight="1.5">
                  {item}
                </Text>
              </HStack>
            ))}
          </Stack>

          {view === "active" ? (
            <Button
              variant="outline"
              alignSelf="flex-start"
              color="fg.inverse"
              borderColor="border.inverse"
              _hover={{ borderColor: "fg.inverse/35" }}
              onClick={() => setConfirmCancel(true)}
            >
              Cancelar suscripción
            </Button>
          ) : (
            <Button colorPalette="lime" alignSelf="flex-start" loading={busy} onClick={reactivate}>
              Reactivar suscripción
            </Button>
          )}
        </PlanPanel>
      ) : null}

      <BillingHistory active={active} />

      <SubscriptionGate open={gateOpen} onOpenChange={setGateOpen} onActivated={onChanged} />
      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="¿Cancelar tu suscripción?"
        description={`Tu acceso continúa hasta el ${renewal}. Después tus IAs se desconectarán, pero toda tu memoria se conserva.`}
        confirmLabel="Cancelar suscripción"
        cancelLabel="Volver"
        loading={busy}
        onConfirm={cancel}
      />
    </Stack>
  );
}

/** The signature ink surface with the atmospheric lime glow (design system §3). */
function PlanPanel({ children }: { children: React.ReactNode }) {
  return (
    <Box
      position="relative"
      overflow="hidden"
      bg="bg.inverse"
      color="fg.inverse"
      rounded="card"
      boxShadow="floatDark"
      p={{ base: "6", md: "8" }}
    >
      <Box
        position="absolute"
        w="360px"
        h="360px"
        rounded="full"
        bg="lime.solid"
        filter="blur(130px)"
        opacity="0.1"
        top="-160px"
        insetEnd="-100px"
        pointerEvents="none"
        aria-hidden
      />
      <Stack position="relative" gap="6">
        {children}
      </Stack>
    </Box>
  );
}

/** Small status pill for the ink panel — dot + label, never color alone. */
function StatePill({ dot, label }: { dot: string; label: string }) {
  return (
    <HStack
      gap="2"
      borderWidth="1px"
      borderColor="border.inverse"
      rounded="full"
      px="3"
      py="1"
      color="fg.inverse/75"
    >
      <Box w="2" h="2" rounded="full" bg={dot} flexShrink="0" aria-hidden />
      <Text fontSize="12px">{label}</Text>
    </HStack>
  );
}
