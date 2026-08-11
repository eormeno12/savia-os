"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Box, Button, HStack, Input, Stack, Text } from "@chakra-ui/react";
import { ArrowRight, Check } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Field, Stepper } from "@savia-os/ui";
import type { CreateConnectionResponse } from "@savia-os/legacy-contracts";
import { api, ApiError } from "@/lib/api";
import { useSubscription } from "@/lib/use-subscription";
import { SubscriptionGate } from "@/components/billing/subscription-gate";
import { McpConfig } from "@/components/connections/mcp-config";

/** Poll cadence for the live-verification handshake. */
const VERIFY_MS = 4000;

type Phase = "naming" | "connecting" | "connected";

/**
 * C2 + C3 — New connection: name it, then the signature ink panel with the
 * per-client MCP config and a live-verification handshake that flips to a
 * celebration the moment the IA makes its first call. Gated behind the
 * subscription; direct navigation re-checks.
 */
export default function NuevaConexionPage() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const { active, ready, refresh } = useSubscription();

  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreateConnectionResponse | null>(null);
  const [phase, setPhase] = useState<Phase>("naming");

  // Live verification: poll until the connection reports its first call.
  useEffect(() => {
    if (!created || phase !== "connecting") return;
    const timer = setInterval(async () => {
      try {
        const conns = await api.connections.list();
        const mine = conns.find((c) => c.id === created.id);
        if (mine?.lastSeenAt) setPhase("connected");
      } catch {
        /* transient; keep polling */
      }
    }, VERIFY_MS);
    return () => clearInterval(timer);
  }, [created, phase]);

  const create = useCallback(async () => {
    if (label.trim().length < 2) {
      setError("Ponle un nombre (p. ej. «Claude de trabajo»).");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const conn = await api.connections.create(label.trim());
      setCreated(conn);
      setPhase("connecting");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos crear la conexión.");
    } finally {
      setCreating(false);
    }
  }, [label]);

  // Subscription guard for direct navigation.
  if (ready && !active) {
    return (
      <SubscriptionGate
        open
        onOpenChange={(o) => !o && router.push("/conexiones")}
        onActivated={refresh}
      />
    );
  }

  const step = phase === "naming" ? 0 : 1;

  return (
    <Stack gap="7" maxW="680px">
      <Box>
        <Text textStyle="label" color="fg.muted">
          Conectar una IA
        </Text>
        <Text textStyle="pageTitle" fontWeight="300" color="fg" mt="2.5">
          Conecta tu IA.
        </Text>
      </Box>

      <Stepper step={step} items={[{ title: "Nómbrala" }, { title: "Conéctala" }]} />

      {phase === "naming" ? (
        <Stack gap="5">
          <Field label="Nombre de la conexión" error={error ?? undefined} required>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Claude de trabajo"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && create()}
            />
          </Field>
          <Text fontSize="13px" color="fg.muted" mt="-2">
            Un nombre para reconocerla — puedes conectar varias IAs, cada una con su propio acceso.
          </Text>
          <HStack>
            <Button variant="outline" onClick={() => router.push("/conexiones")}>
              Cancelar
            </Button>
            <Button colorPalette="ink" onClick={create} loading={creating} ms="auto">
              Crear conexión <ArrowRight size={16} />
            </Button>
          </HStack>
        </Stack>
      ) : created ? (
        <Box
          position="relative"
          bg="bg.inverse"
          color="fg.inverse"
          rounded="card"
          overflow="hidden"
          p={{ base: "6", md: "8" }}
        >
          {/* signature glow */}
          <Box
            position="absolute"
            w="360px"
            h="360px"
            rounded="full"
            bg="lime.solid"
            filter="blur(130px)"
            opacity="0.1"
            top="-140px"
            insetEnd="-80px"
          />

          {phase === "connecting" ? (
            <Stack position="relative" gap="5">
              <Box>
                <Text textStyle="label" color="lime.solid">
                  Aquí se enchufa tu memoria
                </Text>
                <Text fontWeight="300" textStyle="titleLg" mt="2">
                  Conecta «{created.label}».
                </Text>
                <Text fontSize="14px" color="fg.inverse/70" mt="2" maxW="54ch">
                  Pega esta configuración en tu IA. En cuanto haga su primera consulta, lo verás
                  aquí — sin recargar.
                </Text>
              </Box>

              <McpConfig token={created.token} />

              <HStack
                gap="2.5"
                bg="softInk"
                rounded="full"
                px="4"
                py="2.5"
                alignSelf="flex-start"
              >
                <motion.div
                  animate={reduce ? undefined : { opacity: [1, 0.35, 1] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                  style={{ display: "flex" }}
                >
                  <Box w="2.5" h="2.5" rounded="full" bg="warning.solid" />
                </motion.div>
                <Text fontSize="13px" color="fg.inverse/80">
                  Esperando la primera llamada de tu IA…
                </Text>
              </HStack>

              <Button
                variant="ghost"
                size="sm"
                color="fg.inverse/60"
                alignSelf="flex-start"
                onClick={() => router.push("/conexiones")}
              >
                Terminar más tarde
              </Button>
            </Stack>
          ) : (
            <Stack position="relative" gap="5" align="flex-start" py="4">
              <motion.div
                initial={reduce ? false : { scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 16 }}
              >
                <Box
                  w="72px"
                  h="72px"
                  rounded="full"
                  bg="lime.solid"
                  color="ink"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Check size={34} strokeWidth={2.4} />
                </Box>
              </motion.div>
              <Box>
                <Text fontWeight="300" textStyle="pageTitle">
                  «{created.label}» está{" "}
                  <Box as="span" fontWeight="600" color="lime.solid">
                    conectada
                  </Box>
                  .
                </Text>
                <Text fontSize="15px" color="fg.inverse/70" mt="3" maxW="52ch">
                  Tu IA está conectada. No puede ver nada hasta que tú le des acceso — tú decides qué
                  áreas alcanza.
                </Text>
              </Box>
              <HStack gap="3" pt="1">
                <Button colorPalette="lime" asChild>
                  <Link href="/memoria">
                    Darle acceso a un área <ArrowRight size={16} />
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  color="fg.inverse"
                  borderColor="border.inverse"
                  asChild
                >
                  <Link href="/conexiones">Ver mis conexiones</Link>
                </Button>
              </HStack>
            </Stack>
          )}
        </Box>
      ) : null}
    </Stack>
  );
}
