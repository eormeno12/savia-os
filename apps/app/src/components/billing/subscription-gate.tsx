"use client";

import { useState } from "react";
import { Box, Button, Dialog, HStack, IconButton, Portal, Stack, Text } from "@chakra-ui/react";
import { ArrowRight, Check, Lock, X } from "lucide-react";
import { api } from "@/lib/api";

const UNLOCKS = [
  "Conectar Claude, Cursor, ChatGPT y cualquier IA compatible",
  "Que tus IAs busquen y recuerden usando tu memoria",
  "Actividad en vivo de lo que cada IA hace con tu memoria",
];

const FREE = [
  "Organizar y explorar tu memoria",
  "Importar fuentes",
  "Áreas automáticas y búsquedas guardadas",
  "Memoria colectiva",
];

interface SubscriptionGateProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once the subscription becomes active (e.g. after returning from checkout). */
  onActivated?: () => void;
}

/**
 * SB1 — contextual subscription gate, shown when a free user tries to connect an
 * IA. Ink surface with lime accents (the product's deliberate dark moment). The
 * CTA starts a Mercado Pago checkout (`POST /billing/subscription`) and hands
 * off to the hosted flow; the webhook flips the user's plan to `pro` on success.
 */
export function SubscriptionGate({ open, onOpenChange, onActivated }: SubscriptionGateProps) {
  const [status, setStatus] = useState<"idle" | "processing" | "error">("idle");

  async function subscribe() {
    setStatus("processing");
    try {
      const { checkoutUrl } = await api.billing.subscribe("monthly");
      // Hand off to the hosted Mercado Pago flow; on return, `plan` is `pro` and
      // the caller can re-check via `onActivated`.
      onActivated?.();
      window.location.assign(checkoutUrl);
    } catch {
      // A gate that can't reach checkout must say so without alarming — and make
      // clear no money moved.
      setStatus("error");
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(e) => onOpenChange(e.open)} size="lg" placement="center" motionPreset="scale">
      <Portal>
        <Dialog.Backdrop bg="ink/50" backdropFilter="blur(6px)" />
        <Dialog.Positioner>
          <Dialog.Content bg="bg.inverse" color="fg.inverse" borderRadius="card" boxShadow="floatDark" overflow="hidden" maxW="680px">
            <Box position="absolute" w="320px" h="320px" rounded="full" bg="lime.solid" filter="blur(110px)" opacity="0.12" top="-120px" insetEnd="-80px" />
            <Dialog.CloseTrigger asChild>
              <IconButton aria-label="Cerrar" variant="ghost" size="sm" position="absolute" top="4" insetEnd="4" color="fg.inverse">
                <X size={18} />
              </IconButton>
            </Dialog.CloseTrigger>

            <Box position="relative" p={{ base: "6", md: "10" }}>
              <Box as="span" display="inline-flex" alignItems="center" gap="2" textStyle="label" color="ink.solid" bg="lime.solid" px="3" py="1.5" rounded="full">
                Un paso para conectar tus IAs
              </Box>
              <Text fontWeight="300" fontSize="displayMd" lineHeight="1.08" mt="4.5" maxW="18ch">
                Activa tu suscripción y deja que tus IAs{" "}
                <Box as="span" fontWeight="600" color="lime.solid">
                  recuerden
                </Box>{" "}
                por ti.
              </Text>
              <Text fontSize="15px" lineHeight="1.6" color="fg.inverse" opacity="0.72" mt="3" maxW="52ch">
                Savia es gratis para organizar tu memoria. Para conectar tus IAs y que recuerden por
                ti, activa tu suscripción.
              </Text>

              <HStack align="baseline" gap="2.5" mt="5.5">
                <Text fontWeight="300" fontSize="display2xl" color="lime.solid" lineHeight="1">
                  $11.99
                </Text>
                <Text fontSize="14px" color="fg.inverse" opacity="0.6">
                  / mes · facturado mensualmente · cancelable cuando quieras
                </Text>
              </HStack>

              <HStack gap="3.5" mt="6" align="stretch" flexDirection={{ base: "column", sm: "row" }}>
                <Stack flex="1" bg="softInk" rounded="2xl" p="5" gap="2.5">
                  <Text textStyle="label" color="lime.solid">
                    Qué desbloqueas
                  </Text>
                  {UNLOCKS.map((u) => (
                    <HStack key={u} gap="2.5" align="flex-start">
                      <Box color="lime.solid" mt="0.5" flexShrink="0">
                        <Check size={16} strokeWidth={2.2} />
                      </Box>
                      <Text fontSize="13.5px">{u}</Text>
                    </HStack>
                  ))}
                </Stack>
                <Stack flex="1" borderWidth="1px" borderColor="border.inverse" rounded="2xl" p="5" gap="2.5">
                  <Text textStyle="label" color="fg.inverse" opacity="0.55">
                    Qué sigue siendo gratis
                  </Text>
                  {FREE.map((f) => (
                    <HStack key={f} gap="2.5" align="center">
                      <Box w="1.5" h="1.5" rounded="full" bg="fg.inverse" opacity="0.5" flexShrink="0" />
                      <Text fontSize="13.5px" opacity="0.78">
                        {f}
                      </Text>
                    </HStack>
                  ))}
                </Stack>
              </HStack>

              {status === "error" ? (
                <HStack
                  gap="2.5"
                  mt="5.5"
                  bg="dangerSoft/12"
                  borderWidth="1px"
                  borderColor="dangerSoft/30"
                  rounded="xl"
                  px="4"
                  py="3"
                >
                  <Box color="dangerSoft" flexShrink="0">
                    <Lock size={15} />
                  </Box>
                  <Text fontSize="13px" color="dangerSoft">
                    No pudimos abrir el pago. No se hizo ningún cargo — inténtalo de nuevo.
                  </Text>
                </HStack>
              ) : null}

              <Button
                colorPalette="lime"
                size="lg"
                w="full"
                mt="5.5"
                onClick={subscribe}
                loading={status === "processing"}
                loadingText="Confirmando con Mercado Pago…"
              >
                {status === "error" ? "Reintentar" : "Suscribirme — $11.99/mes"}
                {status !== "processing" ? <ArrowRight size={16} /> : null}
              </Button>
              <Stack gap="1.5" mt="3.5" align="center">
                <HStack gap="2" fontSize="12px" color="fg.inverse" opacity="0.55">
                  <Lock size={13} />
                  <Text>Pago seguro con Mercado Pago · Cancela cuando quieras. Sin permanencia.</Text>
                </HStack>
                <Text fontSize="12px" color="fg.inverse" opacity="0.45">
                  Tus datos son tuyos — puedes exportarlos en cualquier momento.
                </Text>
              </Stack>
            </Box>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
