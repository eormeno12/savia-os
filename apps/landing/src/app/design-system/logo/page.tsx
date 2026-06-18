import { Box, Flex, Grid, Text } from "@chakra-ui/react";
import { SaviaMark } from "@/components/design-system/savia-mark";

export const metadata = { title: "Logo" };

const SIZES = [16, 24, 32, 48, 64, 80, 96] as const;

const MISUSE = [
  { label: "No rotar", desc: "El isotipo solo existe en vertical." },
  { label: "No distorsionar", desc: "Mantener proporción 1:1 siempre." },
  { label: "No recolorear", desc: "Solo ink #0B2529 o blanco puro." },
  { label: "No usar sobre fotos", desc: "Solo sobre fondos planos de la paleta." },
  { label: "No agregar efectos", desc: "Sin sombra, gradiente ni bisel." },
  { label: "No reducir a menos de 16px", desc: "Mínimo absoluto para legibilidad." },
];

export default function LogoPage() {
  return (
    <>
      {/* Hero */}
      <Box
        borderBottom="1px solid"
        borderColor="border.subtle"
        px={{ base: "5", md: "8" }}
        py={{ base: "16", md: "24" }}
      >
        <Box maxW="containerWide" mx="auto">
          <Text textStyle="label" color="fg.muted" mb="6">
            Identidad
          </Text>
          <Text
            as="h1"
            fontSize="displayXl"
            fontWeight="300"
            lineHeight="0.92"
            color="fg"
            maxW="18ch"
          >
            El isotipo y el wordmark.
          </Text>
          <Text fontSize="bodyLg" color="fg.muted" mt="6" maxW="56ch">
            Cuatro piezas en cruz. Esquinas a 7.2px. La convergencia al centro como
            metáfora de la memoria que conecta contextos distintos.
          </Text>
        </Box>
      </Box>

      {/* Content */}
      <Box px={{ base: "5", md: "8" }} py="sectionY" maxW="containerWide" mx="auto">

        {/* Mark at large scale */}
        <Box as="section" mb="sectionYTight">
          <Text as="h2" textStyle="label" color="fg.muted" mb="10">
            Isotipo
          </Text>
          <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap="4">
            {/* Light background */}
            <Box
              bg="bg.subtle"
              borderRadius="card"
              p="16"
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <SaviaMark size={96} color="#0B2529" />
            </Box>
            {/* Dark background */}
            <Box
              bg="bg.inverse"
              borderRadius="card"
              p="16"
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <SaviaMark size={96} color="#F4F4F1" />
            </Box>
          </Grid>
          <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap="4" mt="4">
            <Box px="2">
              <Text fontSize="12px" fontWeight="500" color="fg.muted">
                Sobre fondo claro — <Text as="code" fontFamily="ui-monospace, monospace" fontSize="0.9em">#0B2529</Text>
              </Text>
            </Box>
            <Box px="2">
              <Text fontSize="12px" fontWeight="500" color="fg.muted">
                Sobre fondo oscuro — <Text as="code" fontFamily="ui-monospace, monospace" fontSize="0.9em">#F4F4F1</Text>
              </Text>
            </Box>
          </Grid>
        </Box>

        {/* Wordmark */}
        <Box as="section" mb="sectionYTight">
          <Text as="h2" textStyle="label" color="fg.muted" mb="10">
            Wordmark
          </Text>
          <Box
            bg="bg.subtle"
            borderRadius="card"
            p={{ base: "10", md: "16" }}
            display="flex"
            alignItems="center"
            gap="4"
          >
            <SaviaMark size={48} color="#0B2529" />
            <Text
              fontSize="5xl"
              fontWeight="600"
              letterSpacing="0.04em"
              color="fg"
              lineHeight="1"
            >
              SAVIA
            </Text>
          </Box>
          <Box mt="4" px="2">
            <Text fontSize="sm" color="fg.muted" lineHeight="1.65">
              Wordmark: Inter Semibold 600 · todas en mayúsculas ·{" "}
              <Text as="code" fontFamily="ui-monospace, monospace" fontSize="0.9em">letterSpacing: 0.04em</Text>
              {" "}· separación del isotipo: 16px (mínimo).
            </Text>
          </Box>
        </Box>

        {/* Lime variant */}
        <Box as="section" mb="sectionYTight">
          <Text as="h2" textStyle="label" color="fg.muted" mb="10">
            Variante de acento
          </Text>
          <Box
            bg="bg.inverse"
            borderRadius="card"
            p={{ base: "10", md: "16" }}
            display="flex"
            alignItems="center"
            gap="4"
          >
            <SaviaMark size={48} color="#E7FF18" />
            <Text
              fontSize="5xl"
              fontWeight="600"
              letterSpacing="0.04em"
              color="fg.inverse"
              lineHeight="1"
            >
              SAVIA
            </Text>
          </Box>
          <Box mt="4" px="2">
            <Text fontSize="sm" color="fg.muted">
              Solo sobre fondos ink. Isotipo en signalLime, wordmark en paper.
            </Text>
          </Box>
        </Box>

        {/* Clearspace */}
        <Box as="section" mb="sectionYTight">
          <Text as="h2" textStyle="label" color="fg.muted" mb="2">
            Área de respeto
          </Text>
          <Text fontSize="sm" color="fg.muted" mb="8" maxW="56ch" lineHeight="1.65">
            El espacio libre mínimo alrededor del isotipo es igual a la mitad del
            ancho de una de las cuatro piezas.
          </Text>
          <Box
            bg="bg.subtle"
            borderRadius="card"
            p="16"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <Box position="relative">
              <Box
                position="absolute"
                inset="-16px"
                border="1px dashed"
                borderColor="border"
                borderRadius="lg"
              />
              <SaviaMark size={64} color="#0B2529" />
            </Box>
          </Box>
        </Box>

        {/* Sizes */}
        <Box as="section" mb="sectionYTight">
          <Text as="h2" textStyle="label" color="fg.muted" mb="2">
            Tamaños
          </Text>
          <Text fontSize="sm" color="fg.muted" mb="8">
            De 16px a 96px. Mínimo absoluto: 16px.
          </Text>
          <Flex gap="6" alignItems="flex-end" flexWrap="wrap">
            {SIZES.map((size) => (
              <Box key={size} textAlign="center">
                <SaviaMark size={size} color="#0B2529" />
                <Text
                  fontSize="11px"
                  color="fg.muted"
                  fontFamily="ui-monospace, monospace"
                  mt="2"
                >
                  {size}
                </Text>
              </Box>
            ))}
          </Flex>
        </Box>

        {/* Misuse */}
        <Box as="section">
          <Text as="h2" textStyle="label" color="fg.muted" mb="2">
            Usos incorrectos
          </Text>
          <Text fontSize="sm" color="fg.muted" mb="8" maxW="56ch" lineHeight="1.65">
            Lo que nunca debe hacerse con el isotipo o wordmark.
          </Text>
          <Grid
            templateColumns={{ base: "1fr", sm: "1fr 1fr", lg: "1fr 1fr 1fr" }}
            gap="4"
          >
            {MISUSE.map(({ label, desc }) => (
              <Box
                key={label}
                bg="bg.subtle"
                borderRadius="card"
                p="6"
                borderLeft="3px solid"
                borderColor="border"
              >
                <Text fontSize="sm" fontWeight="600" color="fg" mb="1">
                  {label}
                </Text>
                <Text fontSize="sm" color="fg.muted" lineHeight="1.6">
                  {desc}
                </Text>
              </Box>
            ))}
          </Grid>
        </Box>
      </Box>
    </>
  );
}
