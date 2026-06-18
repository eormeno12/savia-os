import { Box, Code, Flex, Text } from "@chakra-ui/react";

export const metadata = { title: "Tokens" };

const RADII = [
  { name: "card", value: "28px", desc: "Tarjetas principales" },
  { name: "panel", value: "40px", desc: "Paneles y modales" },
  { name: "message", value: "22px", desc: "Burbujas de mensaje" },
  { name: "chip", value: "16px", desc: "Chips y tags" },
];

const SHADOWS = [
  { name: "soft", desc: "Cards, superficies flotantes" },
  { name: "float", desc: "Popover, dropdown, hero elements" },
  { name: "inset", desc: "Botones, inputs — borde superior interno" },
  { name: "controlKnob", desc: "Toggle knobs, sliders" },
];

const SPACING = [
  { name: "stackXs", value: "clamp(8px, 1vw, 16px)", desc: "Spacing mínimo" },
  { name: "stackSm", value: "clamp(16px, 1.5vw, 24px)", desc: "Gap entre items" },
  { name: "stackMd", value: "clamp(24px, 2vw, 32px)", desc: "Separación entre grupos" },
  { name: "stackLg", value: "clamp(32px, 3vw, 48px)", desc: "Secciones menores" },
  { name: "stackXl", value: "clamp(48px, 5vw, 80px)", desc: "Secciones mayores" },
  { name: "gridGap", value: "clamp(16px, 2vw, 24px)", desc: "Gap de grillas" },
  { name: "surfacePadding", value: "clamp(24px, 2vw, 32px)", desc: "Padding de cards" },
  { name: "sectionYTight", value: "clamp(3.5rem, 6vw, 6.5rem)", desc: "Sección compacta" },
  { name: "sectionY", value: "clamp(5rem, 8vw, 9rem)", desc: "Sección estándar" },
  { name: "sectionYLoose", value: "clamp(6.5rem, 10vw, 11rem)", desc: "Sección holgada" },
];

function SectionHead({ title, desc }: { title: string; desc?: string }) {
  return (
    <Box mb={desc ? "8" : "6"}>
      <Text as="h2" textStyle="label" color="fg.muted" mb={desc ? "2" : "0"}>
        {title}
      </Text>
      {desc && (
        <Text fontSize="sm" color="fg.muted" maxW="56ch" lineHeight="1.65">
          {desc}
        </Text>
      )}
    </Box>
  );
}

export default function TokensPage() {
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
            Fundamentos
          </Text>
          <Text
            as="h1"
            fontSize="displayXl"
            fontWeight="300"
            lineHeight="0.92"
            color="fg"
            maxW="18ch"
          >
            Tokens de espacio, forma y tiempo.
          </Text>
          <Text fontSize="bodyLg" color="fg.muted" mt="6" maxW="56ch">
            Los valores que definen cómo se sienten los elementos: cuánto espacio
            respiran, qué forma tienen, cómo se mueven.
          </Text>
        </Box>
      </Box>

      {/* Content */}
      <Box px={{ base: "5", md: "8" }} py="sectionY" maxW="containerWide" mx="auto">

        {/* Radii */}
        <Box as="section" mb="sectionYTight">
          <SectionHead
            title="Radios"
            desc="Cuatro radios específicos de Savia. Chakra ya cubre none → 3xl → full; solo definimos los que tienen significado semántico propio."
          />
          {RADII.map(({ name, value, desc }) => (
            <Flex
              key={name}
              gap="6"
              alignItems="center"
              py="6"
              borderBottom="1px solid"
              borderColor="border.subtle"
            >
              <Box
                w="24"
                h="16"
                bg="bg.subtle"
                borderRadius={name as any}
                border="1px solid"
                borderColor="border"
                flexShrink={0}
              />
              <Box>
                <Code fontSize="12px" color="fg" display="block">
                  {name}
                </Code>
                <Text
                  fontSize="11px"
                  color="fg.muted"
                  fontFamily="ui-monospace, monospace"
                  mt="1"
                >
                  {value}
                </Text>
                <Text fontSize="sm" color="fg.muted" mt="1">
                  {desc}
                </Text>
              </Box>
            </Flex>
          ))}
        </Box>

        {/* Shadows */}
        <Box as="section" mb="sectionYTight">
          <SectionHead
            title="Sombras"
            desc="Vocabulario de profundidad. Suplementa las sombras estándar de Chakra con el rango que usa Savia."
          />
          {SHADOWS.map(({ name, desc }) => (
            <Flex
              key={name}
              gap="6"
              alignItems="center"
              py="6"
              borderBottom="1px solid"
              borderColor="border.subtle"
            >
              <Box
                w="24"
                h="16"
                bg="bg"
                boxShadow={name as any}
                borderRadius="xl"
                flexShrink={0}
              />
              <Box>
                <Code fontSize="12px" color="fg" display="block">
                  {name}
                </Code>
                <Text fontSize="sm" color="fg.muted" mt="1">
                  {desc}
                </Text>
              </Box>
            </Flex>
          ))}
        </Box>

        {/* Spacing */}
        <Box as="section" mb="sectionYTight">
          <SectionHead
            title="Espaciado"
            desc="Todos los tokens de espaciado son fluid — usan clamp(). El viewport determina el valor exacto en cada punto. Las barras muestran el ancho real."
          />
          {SPACING.map(({ name, value, desc }) => (
            <Flex
              key={name}
              gap="6"
              alignItems="center"
              py="4"
              borderBottom="1px solid"
              borderColor="border.subtle"
              flexWrap="wrap"
            >
              <Box flexShrink={0} w="48" overflow="hidden">
                <Box
                  bg="signalLime"
                  h="3"
                  borderRadius="full"
                  style={{ width: value }}
                />
              </Box>
              <Box>
                <Code fontSize="12px" color="fg" display="block">
                  {name}
                </Code>
                <Text
                  fontSize="11px"
                  color="fg.muted"
                  fontFamily="ui-monospace, monospace"
                  mt="1"
                >
                  {value}
                </Text>
                <Text fontSize="11px" color="fg.muted">
                  {desc}
                </Text>
              </Box>
            </Flex>
          ))}
        </Box>

        {/* Motion */}
        <Box as="section">
          <SectionHead
            title="Motion"
            desc="Una curva de easing propia y tres duraciones. La firma cinética de Savia es suave con un final brusco — rápido de responder, tranquilo al llegar."
          />

          {/* Easing */}
          <Flex gap="6" alignItems="center" py="6" borderBottom="1px solid" borderColor="border.subtle">
            <Box flexShrink={0}>
              <svg width="80" height="80" viewBox="0 0 100 100" fill="none" aria-label="Curva easing.savia">
                <path
                  d="M0 100 C22 100, 64 0, 100 0"
                  stroke="#E7FF18"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <circle cx="0" cy="100" r="4" fill="#0B2529" />
                <circle cx="100" cy="0" r="4" fill="#0B2529" />
              </svg>
            </Box>
            <Box>
              <Code fontSize="12px" color="fg" display="block">easings.savia</Code>
              <Text fontSize="11px" color="fg.muted" fontFamily="ui-monospace, monospace" mt="1">
                cubic-bezier(0.22, 1, 0.36, 1)
              </Text>
              <Text fontSize="sm" color="fg.muted" mt="1">
                La curva de todas las transiciones Savia
              </Text>
            </Box>
          </Flex>

          {/* Durations */}
          {[
            { name: "durations.fast", value: "160ms", desc: "Hover, foco, micro-interacciones" },
            { name: "durations.soft", value: "260ms", desc: "Transiciones de estado estándar" },
            { name: "durations.slow", value: "700ms", desc: "Entrada de elementos de hero" },
          ].map(({ name, value, desc }) => (
            <Flex
              key={name}
              gap="6"
              alignItems="center"
              py="6"
              borderBottom="1px solid"
              borderColor="border.subtle"
            >
              <Box
                w="20"
                h="10"
                bg="lime.solid"
                borderRadius="full"
                flexShrink={0}
                _hover={{ bg: "lime.emphasized" }}
                transition={`background ${value} cubic-bezier(0.22, 1, 0.36, 1)`}
                cursor="default"
              />
              <Box>
                <Code fontSize="12px" color="fg" display="block">{name}</Code>
                <Text fontSize="11px" color="fg.muted" fontFamily="ui-monospace, monospace" mt="1">
                  {value}
                </Text>
                <Text fontSize="sm" color="fg.muted" mt="1">{desc}</Text>
              </Box>
            </Flex>
          ))}

          {/* Interactive demo */}
          <Box mt="10">
            <Text as="h3" textStyle="label" color="fg.muted" mb="4">
              Demo interactivo
            </Text>
            <Box
              bg="lime.subtle"
              borderRadius="card"
              p="8"
              cursor="pointer"
              textAlign="center"
              _hover={{ bg: "lime.muted", transform: "translateY(-3px)", boxShadow: "float" }}
              transition="all 260ms cubic-bezier(0.22, 1, 0.36, 1)"
            >
              <Text fontSize="sm" fontWeight="500" color="lime.fg">
                Pasa el cursor — easing.savia + durations.soft
              </Text>
            </Box>
          </Box>
        </Box>
      </Box>
    </>
  );
}
