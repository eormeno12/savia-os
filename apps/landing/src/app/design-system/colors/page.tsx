import { Box, Code, Grid, Text } from "@chakra-ui/react";

export const metadata = { title: "Color" };

type ChipData = { token: string; label: string; role: string };

function ColorChip({ token, label, role }: ChipData) {
  return (
    <Box
      borderRadius="2xl"
      overflow="hidden"
      border="1px solid"
      borderColor="border.subtle"
      bg="bg"
    >
      <Box bg={token} h="14" />
      <Box p="3">
        <Code fontSize="11px" color="fg" display="block">
          {label}
        </Code>
        <Text fontSize="11px" color="fg.muted" mt="1" lineHeight="1.4">
          {role}
        </Text>
      </Box>
    </Box>
  );
}

const SEMANTIC_TOKENS: ChipData[] = [
  { token: "bg", label: "bg", role: "Fondo de página" },
  { token: "bg.subtle", label: "bg.subtle", role: "Cards y secciones" },
  { token: "bg.inset", label: "bg.inset", role: "Well / inset" },
  { token: "bg.inverse", label: "bg.inverse", role: "Fondo invertido (oscuro)" },
  { token: "fg", label: "fg", role: "Texto principal" },
  { token: "fg.muted", label: "fg.muted", role: "Texto secundario" },
  { token: "fg.subtle", label: "fg.subtle", role: "Texto terciario" },
  { token: "fg.inverse", label: "fg.inverse", role: "Texto sobre fondo oscuro" },
  { token: "border", label: "border", role: "Borde estándar" },
  { token: "border.subtle", label: "border.subtle", role: "Borde sutil" },
  { token: "border.inverse", label: "border.inverse", role: "Borde sobre fondo oscuro" },
];

const PALETTE_ROLES = [
  { key: "solid", role: "Fondo solid" },
  { key: "contrast", role: "Texto sobre solid" },
  { key: "fg", role: "Texto del componente" },
  { key: "muted", role: "Hover ghost / subtle" },
  { key: "subtle", role: "Fondo subtle" },
  { key: "emphasized", role: "Hover surface" },
  { key: "focusRing", role: "Anillo de foco" },
  { key: "border", role: "Borde outline" },
];

const PALETTES: { name: string; label: string; desc: string }[] = [
  {
    name: "lime",
    label: "Lime",
    desc: "El acento de marca. Señal de acción principal.",
  },
  {
    name: "ink",
    label: "Ink",
    desc: "Neutro oscuro. CTAs secundarias, superficies inversas.",
  },
  {
    name: "mist",
    label: "Mist",
    desc: "Neutro claro. Fondos, variantes ghost sobre paper.",
  },
];

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <Box as="section" mb="sectionYTight">
      <Text
        as="h2"
        textStyle="label"
        color="fg.muted"
        mb={desc ? "2" : "6"}
      >
        {title}
      </Text>
      {desc && (
        <Text fontSize="sm" color="fg.muted" mb="6" maxW="56ch" lineHeight="1.65">
          {desc}
        </Text>
      )}
      {children}
    </Box>
  );
}

export default function ColorsPage() {
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
            Un sistema semántico, no una paleta fija.
          </Text>
          <Text
            fontSize="bodyLg"
            color="fg.muted"
            mt="6"
            maxW="56ch"
          >
            Los colores que ves son los tokens reales del tema. Cada chip renderiza
            con <Code>bg="token.key"</Code> — no hay valores hardcodeados.
          </Text>
        </Box>
      </Box>

      {/* Content */}
      <Box px={{ base: "5", md: "8" }} py="sectionY" maxW="containerWide" mx="auto">

        <Section
          title="Tokens semánticos"
          desc="bg, fg y border definen el sistema base. Mapean automáticamente al tema claro u oscuro."
        >
          <Grid
            templateColumns="repeat(auto-fill, minmax(160px, 1fr))"
            gap="3"
          >
            {SEMANTIC_TOKENS.map((chip) => (
              <ColorChip key={chip.token} {...chip} />
            ))}
          </Grid>
        </Section>

        {PALETTES.map(({ name, label, desc }) => (
          <Section key={name} title={`Paleta ${label}`} desc={desc}>
            <Grid
              templateColumns="repeat(auto-fill, minmax(160px, 1fr))"
              gap="3"
            >
              {PALETTE_ROLES.map(({ key, role }) => (
                <ColorChip
                  key={key}
                  token={`${name}.${key}`}
                  label={`${name}.${key}`}
                  role={role}
                />
              ))}
            </Grid>
          </Section>
        ))}

        {/* Raw palette */}
        <Section
          title="Paleta primitiva"
          desc="Colores base. Usar siempre a través de tokens semánticos, no directamente."
        >
          <Grid
            templateColumns="repeat(auto-fill, minmax(160px, 1fr))"
            gap="3"
          >
            {[
              { token: "ink", label: "ink", role: "#0B2529" },
              { token: "softInk", label: "softInk", role: "#152F34" },
              { token: "paper", label: "paper", role: "#F4F4F1" },
              { token: "signalLime", label: "signalLime", role: "#E7FF18" },
              { token: "signalLimeSoft", label: "signalLimeSoft", role: "#F1FF67" },
              { token: "mist", label: "mist", role: "#ECEDEA" },
              { token: "line", label: "line", role: "#DDDFDC" },
              { token: "slateText", label: "slateText", role: "#53606C" },
            ].map((chip) => (
              <ColorChip key={chip.token} {...chip} />
            ))}
          </Grid>
        </Section>
      </Box>
    </>
  );
}
