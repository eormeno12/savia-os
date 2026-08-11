"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Box, Button, Flex, HStack, Link as CkLink, Stack, Text } from "@chakra-ui/react";
import { SaviaMark } from "@savia-os/ui";
import { ArrowRight, Check } from "lucide-react";
import { api, ApiError } from "@/lib/api";

type Auth = { status: "checking" } | { status: "in"; name: string } | { status: "out" };

const JOURNEY = [
  "Aceptas la invitación.",
  "Entras a la memoria del grupo.",
  "Tú y tus IAs recuerdan juntos.",
];

/**
 * CO7 — Accept an invite (public, outside the app shell). A brand moment for
 * someone who may not know Savia yet: the signature ink panel introduces the
 * product, and the light panel resolves the one decision — join. Accepting
 * needs a session; a signed-out visitor is routed to sign up first, and the
 * token survives the round-trip so they land back here.
 */
export default function InvitarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const [auth, setAuth] = useState<Auth>({ status: "checking" });
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loginHref = `/login?next=${encodeURIComponent(`/invitar/${token}`)}`;

  useEffect(() => {
    api
      .me()
      .then((m) => setAuth({ status: "in", name: m.displayName || "" }))
      .catch(() => setAuth({ status: "out" }));
  }, []);

  async function accept() {
    setWorking(true);
    setError(null);
    try {
      const { groupId } = await api.invites.accept(token);
      router.push(`/colectivo/${groupId}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push(loginHref);
        return;
      }
      setError(
        err instanceof ApiError
          ? err.message
          : "Este enlace de invitación no es válido o ya expiró.",
      );
      setWorking(false);
    }
  }

  return (
    <Flex direction={{ base: "column", md: "row" }} minH="100svh">
      <BrandPanel />

      <Flex flex="1" bg="bg" align="center" justify="center" p={{ base: "8", md: "14" }}>
        <Stack maxW="420px" w="full" gap="0">
          <Text textStyle="label" color="fg.muted">
            Invitación
          </Text>

          <Text fontWeight="300" fontSize="displayMd" lineHeight="1.02" color="fg" mt="3.5">
            {auth.status === "in" && auth.name ? `Hola, ${auth.name}.` : "Te invitaron."}
          </Text>
          <Text fontSize="16px" lineHeight="1.65" color="fg.muted" mt="3.5" maxW="42ch">
            Alguien te invitó a su{" "}
            <Box as="span" color="fg" fontWeight="600">
              memoria colectiva
            </Box>{" "}
            en Savia — una memoria de equipo a la que tú y tus IAs pueden aportar.
          </Text>

          {error ? (
            <Box mt="6" bg="danger.subtle" borderWidth="1px" borderColor="danger.border" rounded="card" px="5" py="4">
              <Text fontSize="14px" color="danger.fg" lineHeight="1.6">
                {error}
              </Text>
              <CkLink asChild color="fg" fontWeight="600" fontSize="14px" mt="2" display="inline-block">
                <Link href="/">Ir a Savia</Link>
              </CkLink>
            </Box>
          ) : (
            <Stack gap="0" mt="8">
              <Button
                colorPalette="ink"
                size="lg"
                w="full"
                loading={working || auth.status === "checking"}
                loadingText={working ? "Uniéndote…" : "Un momento…"}
                onClick={() => (auth.status === "out" ? router.push(loginHref) : accept())}
              >
                {auth.status === "out" ? "Crear cuenta y unirme" : "Unirme a la memoria"}{" "}
                <ArrowRight size={18} />
              </Button>

              {auth.status === "out" ? (
                <Text fontSize="13px" color="fg.muted" mt="4">
                  ¿Ya tienes cuenta?{" "}
                  <CkLink asChild color="fg" fontWeight="600">
                    <Link href={loginHref}>Inicia sesión</Link>
                  </CkLink>{" "}
                  y vuelve a este enlace.
                </Text>
              ) : (
                <Text fontSize="13px" color="fg.muted" mt="4">
                  Tu memoria personal sigue siendo privada. Solo compartes lo de este grupo.
                </Text>
              )}
            </Stack>
          )}
        </Stack>
      </Flex>
    </Flex>
  );
}

/** The signature ink panel — brand, one-liner, and what joining sets in motion. */
function BrandPanel() {
  return (
    <Box
      w={{ md: "46%" }}
      bg="bg.inverse"
      color="fg.inverse"
      p={{ base: "10", md: "12" }}
      display="flex"
      flexDirection="column"
      justifyContent="space-between"
      position="relative"
      overflow="hidden"
      minH={{ base: "auto", md: "100svh" }}
      gap="10"
    >
      <Box
        position="absolute"
        w="440px"
        h="440px"
        rounded="full"
        bg="signalLime"
        filter="blur(150px)"
        opacity="0.1"
        bottom="-180px"
        insetStart="-120px"
        pointerEvents="none"
        aria-hidden
      />

      <HStack position="relative" gap="3">
        <SaviaMark size={28} color="var(--chakra-colors-lime-solid)" />
        <Text fontWeight="600" letterSpacing="0.09em" fontSize="18px">
          SAVIA
        </Text>
      </HStack>

      <Box position="relative" display={{ base: "none", md: "block" }}>
        <Text fontWeight="300" fontSize="display2xl" lineHeight="1.04" maxW="15ch">
          La memoria que{" "}
          <Box as="span" fontWeight="600" color="signalLime">
            conecta
          </Box>{" "}
          a tu equipo.
        </Text>
      </Box>

      <Stack position="relative" gap="4">
        {JOURNEY.map((label) => (
          <HStack key={label} gap="3.5" align="center">
            <Box
              w="7"
              h="7"
              rounded="full"
              display="flex"
              alignItems="center"
              justifyContent="center"
              bg="fg.inverse/10"
              color="signalLime"
              flexShrink="0"
            >
              <Check size={14} />
            </Box>
            <Text fontSize="15px" color="fg.inverse/85">
              {label}
            </Text>
          </HStack>
        ))}
      </Stack>
    </Box>
  );
}
