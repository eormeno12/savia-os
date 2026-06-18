import { Box, Code, Flex, Grid, Text } from "@chakra-ui/react";
import {
  OrbitalRings,
  OrbitalRingsDark,
} from "@/components/landing/orbital-rings";

export const metadata = { title: "Órbitas" };

// ─── Propiedades del sistema ──────────────────────────────────────────────────

const SYSTEM_PROPS = [
  { prop: "Trazo", value: "strokeWidth={1}", note: "Nunca mayor — el grosor diluye el efecto" },
  { prop: "Opacidad interior", value: "5–9%", note: "Fondo claro: ink 5.5% · Fondo oscuro: paper 8%" },
  { prop: "Decaimiento", value: "×0.72 por anillo", note: "Exponencial — el sistema se desvanece hacia afuera" },
  { prop: "baseRadius", value: "> 50% del ancho", note: "Si el anillo cabe entero, es demasiado pequeño" },
  { prop: "increment", value: "140–220px", note: "Consistente dentro de cada variante" },
  { prop: "Color permitido", value: "ink · paper · lime", note: "Lime solo en fondos oscuros y con moderación" },
];

const DO_DONT = [
  { type: "do", rule: "Rings que sangran fuera del borde", detail: "El recorte por overflow:hidden es el efecto. Los anillos completos son decoración genérica." },
  { type: "do", rule: "Un solo origen por sección", detail: "El centro define la jerarquía espacial. Dos centros distintos compiten." },
  { type: "do", rule: "Origen descentrado para tensión", detail: "Mover el origen a un borde o fuera del viewport genera composiciones más dinámicas." },
  { type: "do", rule: "Muy baja opacidad — que se sientan, no que se vean", detail: "Si los notas a primera vista, están demasiado prominentes." },
  { type: "dont", rule: "Anillos que caben completos en el contenedor", detail: "Eso es un diagrama, no identidad visual. El sistema orbital existe a escala mayor que cualquier pantalla." },
  { type: "dont", rule: "Múltiples grupos de anillos en el mismo viewport", detail: "Múltiples centros anulan la jerarquía espacial que los anillos crean." },
  { type: "dont", rule: "strokeWidth > 1 o lime en fondo claro", detail: "El trazo delgado y el lime reservado son parte de la disciplina visual de Savia." },
  { type: "dont", rule: "Animar a velocidad perceptible", detail: "Si rotan, debe ser invisible (90s+ por revolución). Savia es quietud, no actividad." },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrbitsPage() {
  return (
    <>
      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <Box
        bg="bg.inverse"
        position="relative"
        overflow="hidden"
        px={{ base: "5", md: "8" }}
        py={{ base: "20", md: "28" }}
      >
        <OrbitalRingsDark />

        <Box maxW="containerWide" mx="auto" position="relative" zIndex={1}>
          <Text textStyle="label" color="fg.inverse" style={{ opacity: 0.4 }} mb="6">
            Identidad visual · Motivo orbital
          </Text>
          <Text
            as="h1"
            fontSize="displayXl"
            fontWeight="300"
            lineHeight="0.92"
            color="fg.inverse"
            maxW="18ch"
            mb="6"
          >
            Arcos,{" "}
            <Text as="em" fontStyle="normal" color="signalLime">
              no círculos.
            </Text>
          </Text>
          <Text fontSize="bodyLg" color="fg.inverse" maxW="52ch" style={{ opacity: 0.5 }}>
            Los anillos representan un sistema orbital que existe a escala mayor que
            cualquier pantalla. Siempre deberías ver arcos — nunca el sistema completo.
          </Text>
        </Box>
      </Box>

      <Box px={{ base: "5", md: "8" }} py="sectionY" maxW="containerWide" mx="auto">

        {/* ── El principio ──────────────────────────────────────────────── */}
        <Box as="section" mb="sectionYTight">
          <Text as="h2" textStyle="label" color="fg.muted" mb="8">El principio</Text>
          <Grid templateColumns={{ base: "1fr", md: "1fr 1fr 1fr" }} gap="4" mb="10">
            {[
              {
                n: "01",
                title: "El sistema es infinito",
                desc: "Los anillos representan capas de memoria acumuladas — sin límite visible. El viewport es solo una ventana dentro de ese sistema.",
              },
              {
                n: "02",
                title: "El origen define la jerarquía",
                desc: "El centro de los anillos señala lo más importante. Centro en el contenido: foco. Centro en el borde: perspectiva. Centro fuera del viewport: escala.",
              },
              {
                n: "03",
                title: "overflow:hidden es el mecanismo",
                desc: "Los anillos se renderizan grandes y se recortan. No son objetos decorativos a medida — son una ventana sobre un sistema mayor.",
              },
            ].map(({ n, title, desc }) => (
              <Box key={n} bg="bg.subtle" borderRadius="card" p="8">
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
                <Text textStyle="titleLg" color="fg" mb="3">{title}</Text>
                <Text fontSize="sm" color="fg.muted" lineHeight="1.75">{desc}</Text>
              </Box>
            ))}
          </Grid>

          {/* Comparativa: full circles vs arcs */}
          <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap="4">
            <Box>
              <Flex align="center" gap="2" mb="3">
                <Box w="2" h="2" borderRadius="full" bg="red.500" />
                <Text fontSize="sm" fontWeight="600" color="fg.muted">Incorrecto — anillos completos visibles</Text>
              </Flex>
              <Box
                position="relative"
                overflow="hidden"
                bg="bg.subtle"
                borderRadius="card"
                h="56"
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                <OrbitalRings
                  count={4}
                  baseRadius={40}
                  increment={32}
                  color="#0B2529"
                  opacity={0.18}
                />
                <Box position="relative" zIndex={1}>
                  <Text fontSize="xs" color="fg.muted" textAlign="center">Decorativo genérico —<br />sin identidad visual</Text>
                </Box>
              </Box>
            </Box>

            <Box>
              <Flex align="center" gap="2" mb="3">
                <Box w="2" h="2" borderRadius="full" bg="lime.fg" />
                <Text fontSize="sm" fontWeight="600" color="fg.muted">Correcto — solo arcos, sistema mayor</Text>
              </Flex>
              <Box
                position="relative"
                overflow="hidden"
                bg="bg.subtle"
                borderRadius="card"
                h="56"
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                <OrbitalRings
                  count={5}
                  baseRadius={200}
                  increment={140}
                  color="#0B2529"
                  opacity={0.09}
                />
                <Box position="relative" zIndex={1}>
                  <Text fontSize="xs" color="fg.muted" textAlign="center">Atmosférico —<br />ventana al sistema orbital</Text>
                </Box>
              </Box>
            </Box>
          </Grid>
        </Box>

        {/* ── Los 5 patrones ────────────────────────────────────────────── */}
        <Box as="section" mb="sectionYTight">
          <Text as="h2" textStyle="label" color="fg.muted" mb="2">Los 5 patrones</Text>
          <Text fontSize="sm" color="fg.muted" mb="10" maxW="56ch" lineHeight="1.65">
            Cada patrón posiciona el origen de los anillos de forma distinta.
            El origen — no el tamaño — es lo que cambia la composición.
          </Text>

          <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap="6">

            {/* P1 — Centered */}
            <Box>
              <Text textStyle="label" color="fg.muted" mb="1">01 · Centrado</Text>
              <Text fontSize="sm" color="fg.muted" mb="3" lineHeight="1.6">
                El origen coincide con el contenido. Para las secciones más importantes: hero, portada, CTA principal.
              </Text>
              <Box position="relative" overflow="hidden" bg="bg.subtle" borderRadius="card" h="64">
                <OrbitalRings count={5} baseRadius={200} increment={140} color="#0B2529" opacity={0.09} />
                <Flex position="relative" zIndex={1} h="full" direction="column" align="center" justify="center" gap="2">
                  <Text textStyle="label" color="fg.muted">Cómo funciona</Text>
                  <Text fontSize="titleLg" fontWeight="300" color="fg" textAlign="center" maxW="18ch">
                    Savia organiza tu contexto.
                  </Text>
                </Flex>
              </Box>
            </Box>

            {/* P2 — Corner */}
            <Box>
              <Text textStyle="label" color="fg.muted" mb="1">02 · Origen en esquina</Text>
              <Text fontSize="sm" color="fg.muted" mb="3" lineHeight="1.6">
                El centro está en un borde del contenedor. Solo se ven arcos diagonales. Para secciones secundarias o listas.
              </Text>
              <Box position="relative" overflow="hidden" bg="bg.subtle" borderRadius="card" h="64">
                <OrbitalRings count={4} baseRadius={180} increment={150} color="#0B2529" opacity={0.10} offsetX={240} offsetY={160} />
                <Flex position="relative" zIndex={1} h="full" direction="column" justify="center" px="8" gap="2">
                  <Text textStyle="label" color="fg.muted">Planes</Text>
                  <Text fontSize="titleLg" fontWeight="300" color="fg">
                    Individual · Equipo · Enterprise
                  </Text>
                </Flex>
              </Box>
            </Box>

            {/* P3 — Dark centered */}
            <Box>
              <Text textStyle="label" color="fg.muted" mb="1">03 · Fondo oscuro</Text>
              <Text fontSize="sm" color="fg.muted" mb="3" lineHeight="1.6">
                Fondo ink, anillos paper. Mismo patrón centrado, misma disciplina de escala. Para métricas, testimonios, secciones de impacto.
              </Text>
              <Box position="relative" overflow="hidden" bg="bg.inverse" borderRadius="card" h="64">
                <OrbitalRings count={5} baseRadius={200} increment={140} color="#F4F4F1" opacity={0.09} />
                <Flex position="relative" zIndex={1} h="full" direction="column" align="center" justify="center" gap="2">
                  <Text textStyle="label" color="fg.inverse" style={{ opacity: 0.4 }}>Métrica</Text>
                  <Text fontSize="displayMd" fontWeight="300" color="fg.inverse">3.5×</Text>
                  <Text fontSize="sm" color="fg.inverse" style={{ opacity: 0.4 }}>mejora en respuestas</Text>
                </Flex>
              </Box>
            </Box>

            {/* P4 — Lime */}
            <Box>
              <Text textStyle="label" color="fg.muted" mb="1">04 · Acento lime</Text>
              <Text fontSize="sm" color="fg.muted" mb="3" lineHeight="1.6">
                Solo en momentos de logro o estado positivo. Fondo oscuro obligatorio. Máximo 3 anillos. No usar en secciones informativas.
              </Text>
              <Box position="relative" overflow="hidden" bg="bg.inverse" borderRadius="card" h="64">
                <OrbitalRings count={3} baseRadius={180} increment={140} color="#E7FF18" opacity={0.20} />
                <Flex position="relative" zIndex={1} h="full" direction="column" align="center" justify="center" gap="1">
                  <Text fontSize="sm" fontWeight="700" color="signalLime">✓ Memoria sincronizada</Text>
                  <Text fontSize="sm" color="fg.inverse" style={{ opacity: 0.4 }}>42 conversaciones indexadas</Text>
                </Flex>
              </Box>
            </Box>

            {/* P5 — Off-screen / editorial sweep */}
            <Box>
              <Text textStyle="label" color="fg.muted" mb="1">05 · Barrido — origen off-screen</Text>
              <Text fontSize="sm" color="fg.muted" mb="3" lineHeight="1.6">
                El origen está completamente fuera del viewport. Solo se ve un arco casi recto que cruza la sección. Editorial, separadores, empty states.
              </Text>
              <Box position="relative" overflow="hidden" bg="bg.subtle" borderRadius="card" h="64">
                <OrbitalRings count={3} baseRadius={500} increment={120} color="#0B2529" opacity={0.10} offsetX={-420} />
                <Flex position="relative" zIndex={1} h="full" direction="column" justify="center" px="8">
                  <Text textStyle="label" color="fg.muted" mb="2">Estado vacío</Text>
                  <Text fontSize="sm" fontWeight="500" color="fg">Sin memoria aún.</Text>
                  <Text fontSize="sm" color="fg.muted" mt="1">Conecta tu primera IA para empezar.</Text>
                </Flex>
              </Box>
            </Box>

            {/* P6 — Card accent */}
            <Box>
              <Text textStyle="label" color="fg.muted" mb="1">06 · Acento en card</Text>
              <Text fontSize="sm" color="fg.muted" mb="3" lineHeight="1.6">
                Anillos dentro de una card oscura. El borderRadius recorta naturalmente. Los anillos dan profundidad sin ocupar jerarquía visual.
              </Text>
              <Box position="relative" overflow="hidden" bg="bg.subtle" borderRadius="card" h="64" display="flex" alignItems="center" justifyContent="center">
                <Box position="relative" overflow="hidden" bg="bg.inverse" borderRadius="card" p="6" w="72">
                  <OrbitalRings count={3} baseRadius={100} increment={80} color="#F4F4F1" opacity={0.09} />
                  <Box position="relative" zIndex={1}>
                    <Text fontSize="11px" fontWeight="600" color="fg.inverse" style={{ opacity: 0.4 }} mb="1">MEMORIA ACTIVA</Text>
                    <Text fontSize="titleLg" fontWeight="300" color="fg.inverse">42 contextos</Text>
                    <Text fontSize="sm" color="fg.inverse" style={{ opacity: 0.4 }} mt="1">indexados esta semana</Text>
                  </Box>
                </Box>
              </Box>
            </Box>

          </Grid>
        </Box>

        {/* ── Propiedades del sistema ────────────────────────────────────── */}
        <Box as="section" mb="sectionYTight">
          <Text as="h2" textStyle="label" color="fg.muted" mb="2">Propiedades del sistema</Text>
          <Text fontSize="sm" color="fg.muted" mb="8" maxW="56ch" lineHeight="1.65">
            Valores que aplican a todas las variantes. La consistencia de estas
            propiedades hace que los anillos sean reconocibles como Savia en cualquier contexto.
          </Text>
          <Box border="1px solid" borderColor="border" borderRadius="card" overflow="hidden">
            {SYSTEM_PROPS.map(({ prop, value, note }, i, arr) => (
              <Flex
                key={prop}
                px="5"
                py="4"
                gap="4"
                justifyContent="space-between"
                alignItems="center"
                borderBottom={i < arr.length - 1 ? "1px solid" : undefined}
                borderColor="border.subtle"
                flexWrap="wrap"
              >
                <Text fontSize="sm" fontWeight="500" color="fg" minW="140px">{prop}</Text>
                <Code fontSize="12px" color="fg" flexShrink={0}>{value}</Code>
                <Text fontSize="sm" color="fg.muted" flex={1} textAlign={{ base: "left", md: "right" }}>{note}</Text>
              </Flex>
            ))}
          </Box>
        </Box>

        {/* ── Sí / No ───────────────────────────────────────────────────── */}
        <Box as="section" mb="sectionYTight">
          <Text as="h2" textStyle="label" color="fg.muted" mb="8">Principios de uso</Text>
          <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap="4">
            <Box>
              <Text textStyle="label" color="lime.fg" mb="4">Sí</Text>
              <Flex direction="column" gap="3">
                {DO_DONT.filter((r) => r.type === "do").map(({ rule, detail }) => (
                  <Box key={rule} bg="lime.subtle" borderRadius="message" p="5" borderLeft="3px solid" borderColor="lime.border">
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
                  <Box key={rule} bg="bg.subtle" borderRadius="message" p="5" borderLeft="3px solid" borderColor="border">
                    <Text fontSize="sm" fontWeight="600" color="fg.muted" mb="1" style={{ textDecoration: "line-through" }}>{rule}</Text>
                    <Text fontSize="sm" color="fg.muted" lineHeight="1.6">{detail}</Text>
                  </Box>
                ))}
              </Flex>
            </Box>
          </Grid>
        </Box>

        {/* ── Componente ────────────────────────────────────────────────── */}
        <Box as="section">
          <Text as="h2" textStyle="label" color="fg.muted" mb="2">Componente</Text>
          <Text fontSize="sm" color="fg.muted" mb="8" maxW="56ch" lineHeight="1.65">
            Server component — sin estado, sin hooks. El padre necesita{" "}
            <Code fontSize="12px">position:relative</Code> +{" "}
            <Code fontSize="12px">overflow:hidden</Code>.
          </Text>

          <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap="4" mb="4">
            <Box bg="bg.subtle" borderRadius="card" p="6">
              <Text textStyle="label" color="fg.muted" mb="4">Patrón de layout</Text>
              <Code
                fontSize="12px"
                color="fg"
                display="block"
                whiteSpace="pre"
                fontFamily="ui-monospace, monospace"
                lineHeight="1.9"
              >{`<Box position="relative" overflow="hidden">
  <OrbitalRingsHero />
  <Box position="relative" zIndex={1}>
    {/* contenido */}
  </Box>
</Box>`}</Code>
            </Box>

            <Box bg="bg.subtle" borderRadius="card" p="6">
              <Text textStyle="label" color="fg.muted" mb="4">Props del componente base</Text>
              <Code
                fontSize="12px"
                color="fg"
                display="block"
                whiteSpace="pre"
                fontFamily="ui-monospace, monospace"
                lineHeight="1.9"
              >{`<OrbitalRings
  count={5}          // # de anillos
  baseRadius={320}   // radio interior (px)
  increment={200}    // separación entre anillos
  color="#0B2529"
  opacity={0.08}     // anillo interior
  offsetX={0}        // desplazamiento horizontal
  offsetY={0}        // desplazamiento vertical
/>`}</Code>
            </Box>
          </Grid>

          <Box bg="bg.subtle" borderRadius="card" p="6">
            <Text textStyle="label" color="fg.muted" mb="4">Presets</Text>
            <Grid templateColumns={{ base: "1fr", md: "1fr 1fr 1fr" }} gap="3">
              {[
                { name: "OrbitalRingsHero", use: "Fondo claro · 6 anillos · ink 5.5%", when: "Portadas, hero sections" },
                { name: "OrbitalRingsDark", use: "Fondo ink · 5 anillos · paper 8%", when: "Secciones oscuras, cards" },
                { name: "OrbitalRingsLime", use: "Fondo ink · 3 anillos · lime 22%", when: "Logro, sincronización, CTA" },
              ].map(({ name, use, when }) => (
                <Box key={name} bg="bg.inset" borderRadius="message" p="4">
                  <Code fontSize="12px" color="fg" display="block" mb="2">{name}</Code>
                  <Text fontSize="11px" color="fg.muted" lineHeight="1.6">{use}</Text>
                  <Text fontSize="11px" color="fg.muted" mt="1" fontStyle="italic">{when}</Text>
                </Box>
              ))}
            </Grid>
            <Text fontSize="xs" color="fg.muted" mt="4">
              Todos los presets aceptan <Code fontSize="11px">offsetX</Code> y <Code fontSize="11px">offsetY</Code> para desplazar el origen.
            </Text>
          </Box>
        </Box>

      </Box>
    </>
  );
}
