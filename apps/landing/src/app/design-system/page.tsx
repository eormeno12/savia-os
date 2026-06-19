import { Box, Grid, Text } from "@chakra-ui/react";
import Link from "next/link";
import { SaviaMark } from "@/components/design-system/savia-mark";

const SECTIONS = [
  {
    href: "/design-system/brand",
    label: "Marca",
    desc: "Posicionamiento, pilares y manifesto de la marca SAVIA.",
    category: "Identidad",
    featured: true,
  },
  {
    href: "/design-system/voice",
    label: "Voz",
    desc: "Tono, atributos y léxico de la marca.",
    category: "Identidad",
  },
  {
    href: "/design-system/logo",
    label: "Logo",
    desc: "Isotipo, wordmark, clearspace y usos.",
    category: "Identidad",
  },
  {
    href: "/design-system/colors",
    label: "Color",
    desc: "Paleta semántica y colorPalettes de Chakra UI.",
    category: "Fundamentos",
  },
  {
    href: "/design-system/typography",
    label: "Tipografía",
    desc: "Inter en cuatro pesos. Escala de display con clamp().",
    category: "Fundamentos",
  },
  {
    href: "/design-system/tokens",
    label: "Tokens",
    desc: "Radios, sombras, espaciado y motion.",
    category: "Fundamentos",
  },
  {
    href: "/design-system/buttons",
    label: "Botones",
    desc: "Matriz completa de colorPalette × variant.",
    category: "Componentes",
  },
  {
    href: "/design-system/isla",
    label: "Isla de memoria",
    desc: "El activo visual más distintivo de SAVIA — cuándo y cómo usarla.",
    category: "Identidad",
  },
];

export default function DesignSystemIndex() {
  const featured = SECTIONS.find((s) => s.featured)!;
  const rest = SECTIONS.filter((s) => !s.featured);

  return (
    <Box px={{ base: "5", md: "8" }} py="sectionY" maxW="containerWide" mx="auto">
      {/* Intro */}
      <Box mb="16">
        <Text
          textStyle="label"
          color="fg.muted"
          mb="6"
        >
          Design System
        </Text>
        <Text
          as="h1"
          fontSize="displayXl"
          fontWeight="300"
          lineHeight="0.92"
          color="fg"
          maxW="18ch"
        >
          La fundación visual de SAVIA.
        </Text>
        <Text
          fontSize="bodyLg"
          color="fg.muted"
          mt="6"
          maxW="56ch"
        >
          Tokens, componentes y guías de marca. Todo conectado al sistema real — los
          colores que ves son los tokens del tema.
        </Text>
      </Box>

      {/* Featured: Marca */}
      <Link href={featured.href} style={{ textDecoration: "none", display: "block" }}>
        <Box
          bg="bg.inverse"
          borderRadius="card"
          p={{ base: "8", md: "12" }}
          mb="4"
          _hover={{ opacity: 0.92 }}
          transition="opacity 160ms ease"
          cursor="pointer"
        >
          <Box
            display="flex"
            alignItems="center"
            gap="3"
            mb="8"
          >
            <SaviaMark size={22} color="#E7FF18" />
            <Text
              fontSize="11px"
              fontWeight="600"
              letterSpacing="0.14em"
              textTransform="uppercase"
              color="fg.inverse"
              style={{ opacity: 0.5 }}
            >
              {featured.category}
            </Text>
          </Box>
          <Text
            as="h2"
            fontSize="displayXl"
            fontWeight="300"
            lineHeight="0.92"
            color="fg.inverse"
            maxW="16ch"
          >
            {featured.label}.
          </Text>
          <Text
            fontSize="sm"
            color="fg.inverse"
            mt="4"
            maxW="48ch"
            style={{ opacity: 0.55 }}
          >
            {featured.desc}
          </Text>
          <Box mt="8">
            <Text fontSize="13px" fontWeight="600" color="signalLime">
              Ver marca →
            </Text>
          </Box>
        </Box>
      </Link>

      {/* Section grid */}
      <Grid
        templateColumns={{ base: "1fr", sm: "1fr 1fr", lg: "1fr 1fr 1fr" }}
        gap="4"
      >
        {rest.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            style={{ textDecoration: "none" }}
          >
            <Box
              bg="bg.subtle"
              borderRadius="card"
              p="8"
              h="full"
              _hover={{ bg: "bg.inset" }}
              transition="background 160ms ease"
              cursor="pointer"
            >
              <Text textStyle="label" color="fg.muted" mb="4">
                {section.category}
              </Text>
              <Text textStyle="titleLg" color="fg" mb="2">
                {section.label}
              </Text>
              <Text fontSize="sm" color="fg.muted" lineHeight="1.65">
                {section.desc}
              </Text>
            </Box>
          </Link>
        ))}
      </Grid>
    </Box>
  );
}
