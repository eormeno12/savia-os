import { Suspense } from "react";
import { Box, Flex, Stack, Text } from "@chakra-ui/react";
import { SaviaMark } from "@savia-os/ui";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = { title: "Acceder — Savia" };

const JOURNEY = [
  { n: 1, title: "Entrar", hint: "Estás aquí", here: true },
  { n: 2, title: "Reunir tu memoria" },
  { n: 3, title: "Conectar tus IAs", hint: "El objetivo →" },
];

/** A1/A2 — passwordless login: ink journey panel + paper OTP form. */
export default function LoginPage() {
  return (
    <Flex direction={{ base: "column", md: "row" }} minH="100svh">
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
        <Box position="absolute" w="420px" h="420px" rounded="full" bg="lime.solid" filter="blur(140px)" opacity="0.09" bottom="-160px" insetStart="-100px" />
        <Box position="relative" display="flex" alignItems="center" gap="3">
          <SaviaMark size={28} color="var(--chakra-colors-lime-solid)" />
          <Text fontWeight="600" letterSpacing="0.09em" fontSize="18px">
            SAVIA
          </Text>
        </Box>
        <Box position="relative" display={{ base: "none", md: "block" }}>
          <Text fontWeight="300" fontSize="display2xl" lineHeight="1.04" maxW="14ch">
            La memoria que{" "}
            <Box as="span" fontWeight="600" color="lime.solid">
              conecta
            </Box>{" "}
            todas tus IAs.
          </Text>
        </Box>
        <Stack position="relative" gap="4.5">
          {JOURNEY.map((s) => (
            <Box key={s.n} display="flex" alignItems="center" gap="3.5" opacity={s.here ? 1 : 0.5}>
              <Box
                w="7"
                h="7"
                rounded="full"
                display="flex"
                alignItems="center"
                justifyContent="center"
                fontSize="13px"
                fontWeight={s.here ? "700" : "600"}
                bg={s.here ? "lime.solid" : "transparent"}
                color={s.here ? "ink.solid" : "fg.inverse"}
                borderWidth={s.here ? "0" : "1.5px"}
                borderColor="border.inverse"
                flexShrink="0"
              >
                {s.n}
              </Box>
              <Box>
                <Text fontWeight={s.here ? "600" : "500"} fontSize="15px">
                  {s.title}
                </Text>
                {s.hint ? (
                  <Text fontSize="12px" color={s.hint.includes("→") ? "lime.solid" : "fg.inverse"} opacity={s.hint.includes("→") ? 1 : 0.5}>
                    {s.hint}
                  </Text>
                ) : null}
              </Box>
            </Box>
          ))}
        </Stack>
      </Box>

      <Flex flex="1" bg="bg" align="center" justify="center" p={{ base: "8", md: "14" }}>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </Flex>
    </Flex>
  );
}
