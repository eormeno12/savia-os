import { Box, Flex, Grid, Text } from "@chakra-ui/react";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Botones" };

const PALETTES = ["lime", "ink", "mist"] as const;
const VARIANTS = ["solid", "outline", "ghost", "subtle"] as const;
const SIZES = ["xs", "sm", "md", "lg"] as const;

export default function ButtonsPage() {
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
            Componentes
          </Text>
          <Text
            as="h1"
            fontSize="displayXl"
            fontWeight="300"
            lineHeight="0.92"
            color="fg"
            maxW="18ch"
          >
            Botones reales del tema.
          </Text>
          <Text fontSize="bodyLg" color="fg.muted" mt="6" maxW="56ch">
            Cada botón usa <Text as="code" fontFamily="ui-monospace, monospace" fontSize="0.875em">colorPalette</Text> y{" "}
            <Text as="code" fontFamily="ui-monospace, monospace" fontSize="0.875em">variant</Text> de Chakra UI v3.
            Los colores provienen directamente del tema — no hay valores hardcodeados.
          </Text>
        </Box>
      </Box>

      {/* Content */}
      <Box px={{ base: "5", md: "8" }} py="sectionY" maxW="containerWide" mx="auto">

        {/* Matrix */}
        <Box as="section" mb="sectionYTight">
          <Text as="h2" textStyle="label" color="fg.muted" mb="2">
            Matriz colorPalette × variant
          </Text>
          <Text fontSize="sm" color="fg.muted" mb="10" maxW="56ch" lineHeight="1.65">
            3 paletas × 4 variantes. Todos los botones usan{" "}
            <Text as="code" fontFamily="ui-monospace, monospace" fontSize="0.875em">borderRadius="full"</Text> y{" "}
            <Text as="code" fontFamily="ui-monospace, monospace" fontSize="0.875em">fontWeight="semibold"</Text> por defecto.
          </Text>

          <Box overflowX="auto">
            <Grid
              templateColumns="auto 1fr 1fr 1fr 1fr"
              gap="4"
              alignItems="center"
              minW="560px"
            >
              {/* Header row */}
              <Box />
              {VARIANTS.map((v) => (
                <Text
                  key={v}
                  fontSize="11px"
                  fontWeight="600"
                  color="fg.muted"
                  letterSpacing="0.1em"
                  textTransform="uppercase"
                  textAlign="center"
                >
                  {v}
                </Text>
              ))}

              {/* Button rows */}
              {PALETTES.flatMap((palette) => [
                <Flex key={`label-${palette}`} alignItems="center" justifyContent="flex-end" pr="2">
                  <Text
                    fontSize="12px"
                    fontWeight="600"
                    color="fg.muted"
                    fontFamily="ui-monospace, monospace"
                  >
                    {palette}
                  </Text>
                </Flex>,
                ...VARIANTS.map((variant) => (
                  <Flex key={`${palette}-${variant}`} justifyContent="center">
                    <Button colorPalette={palette} variant={variant} size="sm">
                      {palette}
                    </Button>
                  </Flex>
                )),
              ])}
            </Grid>
          </Box>
        </Box>

        {/* Sizes */}
        <Box as="section" mb="sectionYTight">
          <Text as="h2" textStyle="label" color="fg.muted" mb="2">
            Tamaños
          </Text>
          <Text fontSize="sm" color="fg.muted" mb="8" maxW="56ch" lineHeight="1.65">
            Cuatro tamaños del sistema Chakra. Usar <Text as="code" fontFamily="ui-monospace, monospace" fontSize="0.875em">sm</Text> y{" "}
            <Text as="code" fontFamily="ui-monospace, monospace" fontSize="0.875em">md</Text> en el 90% de casos.
          </Text>
          <Flex gap="4" alignItems="center" flexWrap="wrap">
            {SIZES.map((size) => (
              <Button key={size} colorPalette="lime" size={size}>
                Tamaño {size}
              </Button>
            ))}
          </Flex>
        </Box>

        {/* States */}
        <Box as="section" mb="sectionYTight">
          <Text as="h2" textStyle="label" color="fg.muted" mb="2">
            Estados
          </Text>
          <Text fontSize="sm" color="fg.muted" mb="8" maxW="56ch" lineHeight="1.65">
            Cargando y deshabilitado — heredados directamente de Chakra. Sin código extra.
          </Text>
          <Flex gap="4" flexWrap="wrap">
            <Button colorPalette="lime">Normal</Button>
            <Button colorPalette="lime" loading>
              Cargando
            </Button>
            <Button colorPalette="lime" disabled>
              Deshabilitado
            </Button>
            <Button colorPalette="ink">Normal</Button>
            <Button colorPalette="ink" loading>
              Cargando
            </Button>
            <Button colorPalette="ink" disabled>
              Deshabilitado
            </Button>
          </Flex>
        </Box>

        {/* Dark surface */}
        <Box as="section">
          <Text as="h2" textStyle="label" color="fg.muted" mb="2">
            Sobre fondo oscuro
          </Text>
          <Text fontSize="sm" color="fg.muted" mb="8" maxW="56ch" lineHeight="1.65">
            Lime solid y ghost en superficie inversa. El contraste de lime sobre ink es
            el par más directo de la marca.
          </Text>
          <Box bg="bg.inverse" borderRadius="card" p="10">
            <Flex gap="4" flexWrap="wrap">
              <Button colorPalette="lime" variant="solid">
                Acceso exclusivo
              </Button>
              <Button colorPalette="lime" variant="ghost">
                Saber más
              </Button>
              <Button colorPalette="mist" variant="outline">
                Ver demo
              </Button>
            </Flex>
          </Box>
        </Box>
      </Box>
    </>
  );
}
