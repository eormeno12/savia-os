import { Box, Code, Flex, Grid, Text } from "@chakra-ui/react";
import { IslandImage } from "@/components/landing/island-image";

export const metadata = { title: "Isla de memoria" };

// ─── Data ─────────────────────────────────────────────────────────────────────

const METAPHOR = [
  {
    n: "01",
    title: "Ciudad flotante",
    desc: "La isla es una ciudad suspendida sobre la niebla — tu memoria organizada, por encima del ruido de las conversaciones sin contexto.",
  },
  {
    n: "02",
    title: "Plataformas de contexto",
    desc: "Los anillos concéntricos de la isla son plataformas de contexto. Cada capa almacena un tipo de memoria distinto — chats, archivos, patrones de uso.",
  },
  {
    n: "03",
    title: "La niebla como base",
    desc: "La isla no toca el suelo. Flota sobre la niebla — está por encima de la complejidad. Lo que ves debajo es lo que SAVIA absorbió y transformó en contexto.",
  },
  {
    n: "04",
    title: "Imponente e inmóvil",
    desc: "La isla no se mueve. Es sólida, permanente, monumental. La IA bajo SAVIA responde desde esa solidez — con todo el contexto necesario ya disponible.",
  },
];

const USE_CASES = [
  { context: "Landing / hero principal", size: "Responsive, max 720px", bg: "Fondo paper o muy claro", why: "El primer impacto de la marca — la isla debe dominar el espacio." },
  { context: "Sección de producto", size: "360–480px fijo", bg: "Fondo paper", why: "Ilustra el concepto de memoria organizada en una sola imagen." },
  { context: "Estado vacío", size: "240–320px fijo", bg: "Fondo paper o bg.subtle", why: "La isla sin contexto activo — el sistema existe pero espera tu primera conexión." },
  { context: "Email / material estático", size: "Cualquier tamaño fijo", bg: "Fondo blanco", why: "El PNG es estático por naturaleza — funciona directamente en cualquier contexto offline." },
];

const DO_DONT = [
  { type: "do", rule: "Fondo claro — paper, blanco o muy claro", detail: "La isla es oscura y contiene mucho detalle. El contraste con el fondo le da presencia sin perder definición en los bordes." },
  { type: "do", rule: "Espacio generoso alrededor", detail: "La isla necesita respirar. Mínimo el 30% de su diámetro como margen en cada lado. La niebla es parte del activo." },
  { type: "do", rule: "Una sola isla por página", detail: "Es el activo más potente de la marca. Si aparece dos veces en el mismo scroll, pierde completamente su impacto." },
  { type: "do", rule: "Mostrarla grande — heroica", detail: "La isla solo funciona a escala. Por debajo de 240px el detalle de la ciudad y las plataformas desaparece." },
  { type: "dont", rule: "No usar sobre fondo oscuro", detail: "La isla pierde su contorno y la niebla desaparece. En ink, los bordes son invisibles — el activo se destruye." },
  { type: "dont", rule: "No recortar la parte inferior", detail: "La niebla bajo la isla es parte del efecto de flotación. Cortarla hace que la isla parezca posada, no flotante." },
  { type: "dont", rule: "No usar por debajo de 240px", detail: "A tamaños pequeños los detalles de la ciudad y las plataformas se pierden — queda como una mancha circular sin lectura." },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function IslaPage() {
  return (
    <>
      {/* ── Hero: Asgard en el espacio ───────────────────────────────────── */}
      <Box
        position="relative"
        overflow="hidden"
        minH="90vh"
        display="flex"
        flexDirection="column"
        bg="bg"
      >
        {/* Label — top left */}
        <Box px={{ base: "5", md: "8" }} pt="8" flexShrink={0}>
          <Text
            textStyle="label"
            color="fg.muted"
            style={{ opacity: 0.5 }}
          >
            Identidad visual · Asset central
          </Text>
        </Box>

        {/* Island — fills center, large */}
        <Flex flex={1} align="center" justify="center" py="4">
          <Box
            w={{ base: "88vw", md: "64vw" }}
            maxW="740px"
            mx="auto"
          >
            <IslandImage />
          </Box>
        </Flex>

        {/* Title — bottom left, below island */}
        <Box
          px={{ base: "5", md: "8" }}
          pb={{ base: "10", md: "14" }}
          maxW="containerWide"
          mx="auto"
          w="full"
          flexShrink={0}
        >
          <Text
            as="h1"
            fontSize={{ base: "displayLg", md: "displayXl" }}
            fontWeight="300"
            lineHeight="0.92"
            color="fg"
            maxW="22ch"
          >
            La isla de memoria.
          </Text>
          <Text
            fontSize="bodyLg"
            color="fg.muted"
            maxW="56ch"
            mt="5"
            lineHeight="1.6"
            style={{ opacity: 0.7 }}
          >
            El activo visual más distintivo de SAVIA. Una ciudad flotante y monumental
            que representa el sistema de memoria — organizado en capas, sólido,
            permanente.
          </Text>
        </Box>
      </Box>

      <Box px={{ base: "5", md: "8" }} py="sectionY" maxW="containerWide" mx="auto">

        {/* ── La metáfora ───────────────────────────────────────────────── */}
        <Box as="section" mb="sectionYTight">
          <Text as="h2" textStyle="label" color="fg.muted" mb="8">
            La metáfora
          </Text>
          <Grid
            templateColumns={{ base: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr 1fr" }}
            gap="4"
          >
            {METAPHOR.map(({ n, title, desc }) => (
              <Box key={n} bg="bg.subtle" borderRadius="card" p="7">
                <Text
                  fontSize="11px"
                  fontWeight="600"
                  letterSpacing="0.12em"
                  color="fg.muted"
                  fontFamily="ui-monospace, monospace"
                  mb="4"
                >
                  {n}
                </Text>
                <Text textStyle="titleLg" color="fg" mb="3">
                  {title}
                </Text>
                <Text fontSize="sm" color="fg.muted" lineHeight="1.75">
                  {desc}
                </Text>
              </Box>
            ))}
          </Grid>
        </Box>

        {/* ── Escalas de uso ────────────────────────────────────────────── */}
        <Box as="section" mb="sectionYTight">
          <Text as="h2" textStyle="label" color="fg.muted" mb="2">
            Escalas de uso
          </Text>
          <Text fontSize="sm" color="fg.muted" mb="10" maxW="56ch" lineHeight="1.65">
            La isla funciona a tres escalas distintas. En cada una el nivel de detalle
            visible cambia — de monumental a ilustrativo.
          </Text>

          <Grid templateColumns={{ base: "1fr", md: "1fr 1fr 1fr" }} gap="4">
            {/* Escala 1: Heroica */}
            <Box>
              <Flex align="baseline" gap="2" mb="1">
                <Text textStyle="label" color="fg.muted">Heroica</Text>
                <Text fontSize="xs" color="fg.muted" style={{ opacity: 0.6 }}>600–740px</Text>
              </Flex>
              <Text fontSize="sm" color="fg.muted" mb="4" lineHeight="1.6">
                Para landing pages y heroes. La ciudad, las plataformas y la niebla son
                legibles con todo su detalle. Esta escala es la razón por la que la isla existe.
              </Text>
              <Box
                bg="bg.subtle"
                borderRadius="card"
                display="flex"
                alignItems="center"
                justifyContent="center"
                py="8"
                px="4"
              >
                <IslandImage size={280} />
              </Box>
              <Box bg="bg.inset" borderRadius="message" p="3" mt="3">
                <Code fontSize="12px" color="fg" fontFamily="ui-monospace, monospace">
                  {`<IslandImage />  {/* responsive */}`}
                </Code>
              </Box>
            </Box>

            {/* Escala 2: Producto */}
            <Box>
              <Flex align="baseline" gap="2" mb="1">
                <Text textStyle="label" color="fg.muted">Producto</Text>
                <Text fontSize="xs" color="fg.muted" style={{ opacity: 0.6 }}>360–480px</Text>
              </Flex>
              <Text fontSize="sm" color="fg.muted" mb="4" lineHeight="1.6">
                Para secciones dentro de una página o app. La lectura del conjunto sigue
                siendo clara aunque los detalles finos de la ciudad pierdan resolución.
              </Text>
              <Box
                bg="bg.subtle"
                borderRadius="card"
                display="flex"
                alignItems="center"
                justifyContent="center"
                py="8"
                px="4"
              >
                <IslandImage size={180} />
              </Box>
              <Box bg="bg.inset" borderRadius="message" p="3" mt="3">
                <Code fontSize="12px" color="fg" fontFamily="ui-monospace, monospace">
                  {`<IslandImage size={480} />`}
                </Code>
              </Box>
            </Box>

            {/* Escala 3: Ilustrativa */}
            <Box>
              <Flex align="baseline" gap="2" mb="1">
                <Text textStyle="label" color="fg.muted">Ilustrativa</Text>
                <Text fontSize="xs" color="fg.muted" style={{ opacity: 0.6 }}>240–320px</Text>
              </Flex>
              <Text fontSize="sm" color="fg.muted" mb="4" lineHeight="1.6">
                El mínimo útil. Solo para estados vacíos o callouts pequeños. La silueta
                de la isla es reconocible pero el detalle interno desaparece.
              </Text>
              <Box
                bg="bg.subtle"
                borderRadius="card"
                display="flex"
                alignItems="center"
                justifyContent="center"
                py="8"
                px="4"
              >
                <IslandImage size={110} />
              </Box>
              <Box bg="bg.inset" borderRadius="message" p="3" mt="3">
                <Code fontSize="12px" color="fg" fontFamily="ui-monospace, monospace">
                  {`<IslandImage size={280} />`}
                </Code>
              </Box>
            </Box>
          </Grid>
        </Box>

        {/* ── Cuándo y cómo ─────────────────────────────────────────────── */}
        <Box as="section" mb="sectionYTight">
          <Text as="h2" textStyle="label" color="fg.muted" mb="2">
            Cuándo y cómo
          </Text>
          <Text fontSize="sm" color="fg.muted" mb="8" maxW="56ch" lineHeight="1.65">
            La isla es el activo más pesado de la marca. Úsala una vez por página,
            en el momento de máximo impacto.
          </Text>
          <Box border="1px solid" borderColor="border" borderRadius="card" overflow="hidden">
            <Grid
              templateColumns={{ base: "1fr", md: "1fr 1fr 1fr 1fr" }}
              display={{ base: "none", md: "grid" }}
              px="5"
              py="3"
              borderBottom="1px solid"
              borderColor="border.subtle"
            >
              {["Contexto", "Tamaño", "Fondo", "Por qué"].map((h) => (
                <Text
                  key={h}
                  fontSize="11px"
                  fontWeight="600"
                  color="fg.muted"
                  letterSpacing="0.08em"
                >
                  {h}
                </Text>
              ))}
            </Grid>
            {USE_CASES.map(({ context, size, bg, why }, i, arr) => (
              <Grid
                key={context}
                templateColumns={{ base: "1fr", md: "1fr 1fr 1fr 1fr" }}
                px="5"
                py="4"
                gap="2"
                borderBottom={i < arr.length - 1 ? "1px solid" : undefined}
                borderColor="border.subtle"
                alignItems="start"
              >
                <Text fontSize="sm" fontWeight="600" color="fg">
                  {context}
                </Text>
                <Code fontSize="12px" color="fg.muted" whiteSpace="pre-wrap">
                  {size}
                </Code>
                <Text fontSize="sm" color="fg.muted">
                  {bg}
                </Text>
                <Text fontSize="sm" color="fg.muted" lineHeight="1.6">
                  {why}
                </Text>
              </Grid>
            ))}
          </Box>
        </Box>

        {/* ── Principios ────────────────────────────────────────────────── */}
        <Box as="section" mb="sectionYTight">
          <Text as="h2" textStyle="label" color="fg.muted" mb="8">
            Principios de uso
          </Text>
          <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap="4">
            <Box>
              <Text textStyle="label" color="lime.fg" mb="4">Sí</Text>
              <Flex direction="column" gap="3">
                {DO_DONT.filter((r) => r.type === "do").map(({ rule, detail }) => (
                  <Box
                    key={rule}
                    bg="lime.subtle"
                    borderRadius="message"
                    p="5"
                    borderLeft="3px solid"
                    borderColor="lime.border"
                  >
                    <Text fontSize="sm" fontWeight="600" color="fg" mb="1">{rule}</Text>
                    <Text fontSize="sm" color="fg.muted" lineHeight="1.6">{detail}</Text>
                  </Box>
                ))}
              </Flex>
            </Box>
            <Box>
              <Text textStyle="label" color="fg.muted" mb="4">No</Text>
              <Flex direction="column" gap="3">
                {DO_DONT.filter((r) => r.type === "dont").map(({ rule, detail }) => (
                  <Box
                    key={rule}
                    bg="bg.subtle"
                    borderRadius="message"
                    p="5"
                    borderLeft="3px solid"
                    borderColor="border"
                  >
                    <Text
                      fontSize="sm"
                      fontWeight="600"
                      color="fg.muted"
                      mb="1"
                      style={{ textDecoration: "line-through" }}
                    >
                      {rule}
                    </Text>
                    <Text fontSize="sm" color="fg.muted" lineHeight="1.6">{detail}</Text>
                  </Box>
                ))}
              </Flex>
            </Box>
          </Grid>
        </Box>

        {/* ── Componente ────────────────────────────────────────────────── */}
        <Box as="section">
          <Text as="h2" textStyle="label" color="fg.muted" mb="2">
            Componente
          </Text>
          <Text fontSize="sm" color="fg.muted" mb="8" maxW="56ch" lineHeight="1.65">
            Server component — sin estado, sin animaciones. El asset es una imagen PNG
            de alta resolución renderizada con{" "}
            <Code fontSize="12px">next/image</Code>.
          </Text>

          <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap="4">
            <Box bg="bg.subtle" borderRadius="card" p="6">
              <Text textStyle="label" color="fg.muted" mb="4">Props</Text>
              <Box
                border="1px solid"
                borderColor="border.subtle"
                borderRadius="message"
                overflow="hidden"
              >
                {[
                  {
                    prop: "size",
                    type: "number",
                    default: "—",
                    desc: "Tamaño fijo en px. Omitir para modo responsive (llena el padre).",
                  },
                ].map(({ prop, type, default: def, desc }) => (
                  <Flex key={prop} px="4" py="3" gap="3" alignItems="start" flexWrap="wrap">
                    <Code fontSize="12px" color="fg" minW="50px">{prop}</Code>
                    <Code fontSize="12px" color="fg.muted" minW="60px">{type}</Code>
                    <Code fontSize="12px" color="fg.muted" minW="30px">{def}</Code>
                    <Text fontSize="sm" color="fg.muted" flex={1}>{desc}</Text>
                  </Flex>
                ))}
              </Box>
            </Box>

            <Box bg="bg.subtle" borderRadius="card" p="6">
              <Text textStyle="label" color="fg.muted" mb="4">Modos de uso</Text>
              <Flex direction="column" gap="3">
                <Box>
                  <Text fontSize="xs" color="fg.muted" mb="2">Responsive — llena el padre</Text>
                  <Code
                    fontSize="12px"
                    color="fg"
                    display="block"
                    whiteSpace="pre"
                    fontFamily="ui-monospace, monospace"
                    lineHeight="1.9"
                  >{`{/* padre con dimensiones explícitas */}
<Box w="60vw" maxW="720px">
  <IslandImage />
</Box>`}</Code>
                </Box>
                <Box>
                  <Text fontSize="xs" color="fg.muted" mb="2">Tamaño fijo</Text>
                  <Code
                    fontSize="12px"
                    color="fg"
                    display="block"
                    whiteSpace="pre"
                    fontFamily="ui-monospace, monospace"
                    lineHeight="1.9"
                  >{`<IslandImage size={480} />`}</Code>
                </Box>
              </Flex>
            </Box>
          </Grid>
        </Box>

      </Box>
    </>
  );
}
