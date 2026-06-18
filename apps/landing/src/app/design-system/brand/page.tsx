import { Box, Grid, Text } from "@chakra-ui/react";
import { SaviaMark } from "@/components/design-system/savia-mark";

export const metadata = { title: "Marca" };

const PILLARS = [
  {
    number: "01",
    word: "La memoria",
    title: "Una sola memoria",
    desc: "No una por herramienta, no una por conversación. Savia es la memoria central de tu ecosistema de IA — disponible en todas partes, organizada en un solo lugar.",
  },
  {
    number: "02",
    word: "que conecta",
    title: "Conexión, no integración",
    desc: "Savia no configura APIs ni mapea esquemas. Conecta tus IAs a través de contexto compartido — el tipo de conexión que transforma cómo responden.",
  },
  {
    number: "03",
    word: "todas",
    title: "Todas, sin excepción",
    desc: "ChatGPT, Claude, Copilot, Cursor — Savia funciona con cualquier IA que uses. La memoria no discrimina herramientas.",
  },
  {
    number: "04",
    word: "tus IAs",
    title: "Control total",
    desc: "Tu memoria es tuya. Tú decides qué se guarda, qué se comparte y cuándo se borra. Savia no aprende de tus datos — los custodia.",
  },
];

export default function BrandPage() {
  return (
    <>
      {/* Hero */}
      <Box
        bg="bg.inverse"
        px={{ base: "5", md: "8" }}
        py={{ base: "20", md: "32" }}
      >
        <Box maxW="containerWide" mx="auto">
          <Box display="flex" alignItems="center" gap="3" mb="10">
            <SaviaMark size={24} color="#E7FF18" />
            <Text
              fontSize="11px"
              fontWeight="600"
              letterSpacing="0.14em"
              textTransform="uppercase"
              color="fg.inverse"
              style={{ opacity: 0.5 }}
            >
              Identidad · Marca
            </Text>
          </Box>

          <Text
            as="h1"
            fontSize="displayXl"
            fontWeight="300"
            lineHeight="0.92"
            color="fg.inverse"
            maxW="22ch"
            mb="8"
          >
            La memoria que conecta{" "}
            <Text as="em" fontStyle="normal" color="signalLime">
              todas tus IAs.
            </Text>
          </Text>

          <Text
            fontSize="bodyLg"
            color="fg.inverse"
            maxW="52ch"
            style={{ opacity: 0.55 }}
          >
            No es un chatbot. No es un buscador. Es la capa de contexto que
            hace que cada IA que usas responda como si te conociera.
          </Text>
        </Box>
      </Box>

      <Box px={{ base: "5", md: "8" }} py="sectionY" maxW="containerWide" mx="auto">

        {/* One-liner */}
        <Box as="section" mb="sectionYTight">
          <Text as="h2" textStyle="label" color="fg.muted" mb="6">
            El one-liner
          </Text>
          <Box bg="bg.subtle" borderRadius="card" p={{ base: "8", md: "12" }}>
            <Text
              fontSize="displayMd"
              fontWeight="300"
              lineHeight="1.05"
              color="fg"
              maxW="22ch"
              mb="8"
            >
              Savia.{" "}
              <Text as="span" color="fg.muted" fontWeight="300">
                La memoria que conecta todas tus IAs.
              </Text>
            </Text>
            <Box h="1px" bg="border" mb="6" maxW="8rem" />
            <Grid templateColumns={{ base: "1fr", md: "1fr 1fr 1fr" }} gap="8">
              {[
                { word: "La memoria", meaning: "No 'una herramienta de memoria'. Savia ES la memoria — la función, no el contenedor. Artículo definido intencional." },
                { word: "que conecta", meaning: "Conectar implica relación, no instalación. Las IAs pasan a compartir algo que antes estaba separado." },
                { word: "todas tus IAs", meaning: "'Todas' elimina excepciones. 'Tus' hace la memoria personal y en control del usuario. 'IAs' es preciso sin ser técnico." },
              ].map(({ word, meaning }) => (
                <Box key={word}>
                  <Text fontSize="sm" fontWeight="700" color="fg" mb="2">"{word}"</Text>
                  <Text fontSize="sm" color="fg.muted" lineHeight="1.7">{meaning}</Text>
                </Box>
              ))}
            </Grid>
          </Box>
        </Box>

        {/* Posicionamiento */}
        <Box as="section" mb="sectionYTight">
          <Text as="h2" textStyle="label" color="fg.muted" mb="2">
            Posicionamiento
          </Text>
          <Text fontSize="sm" color="fg.muted" mb="8" maxW="56ch" lineHeight="1.65">
            Tres afirmaciones sobre lo que Savia es — y lo que no es.
          </Text>
          <Grid templateColumns={{ base: "1fr", md: "1fr 1fr 1fr" }} gap="4">
            {[
              {
                claim: "Savia es infraestructura.",
                sub: "No una app, no un dashboard, no una feature. Es la capa que se sienta entre tú y tus IAs. Como el DNS del internet — invisible cuando funciona, crítica cuando falta.",
              },
              {
                claim: "Savia no reemplaza.",
                sub: "ChatGPT, Claude y Copilot siguen siendo tus IAs. Savia no compite con ellos — los hace mejores. Les da lo que necesitan saber antes de que respondas.",
              },
              {
                claim: "Savia recuerda por todas.",
                sub: "Cada IA que usas opera en silos. Savia rompe ese silo — lo que le dijiste a Claude ayer, ChatGPT lo sabe hoy. Una memoria, muchas IAs.",
              },
            ].map(({ claim, sub }) => (
              <Box key={claim} bg="bg.subtle" borderRadius="card" p="8">
                <Text textStyle="titleLg" color="fg" mb="3">{claim}</Text>
                <Text fontSize="sm" color="fg.muted" lineHeight="1.75">{sub}</Text>
              </Box>
            ))}
          </Grid>
        </Box>

        {/* Pillars */}
        <Box as="section" mb="sectionYTight">
          <Text as="h2" textStyle="label" color="fg.muted" mb="2">
            Pilares
          </Text>
          <Text fontSize="sm" color="fg.muted" mb="10" maxW="56ch" lineHeight="1.65">
            Cuatro principios derivados del one-liner — cada uno anclado a una
            palabra clave de la promesa de Savia.
          </Text>
          <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap="4">
            {PILLARS.map(({ number, word, title, desc }) => (
              <Box key={number} bg="bg.subtle" borderRadius="card" p="8">
                <Box display="flex" alignItems="center" gap="3" mb="5">
                  <Text
                    fontSize="11px"
                    fontWeight="600"
                    letterSpacing="0.12em"
                    color="fg.muted"
                    fontFamily="ui-monospace, monospace"
                  >
                    {number}
                  </Text>
                  <Text
                    fontSize="11px"
                    fontWeight="600"
                    color="fg.muted"
                    fontFamily="ui-monospace, monospace"
                    bg="bg.inset"
                    px="2"
                    py="0.5"
                    borderRadius="sm"
                  >
                    "{word}"
                  </Text>
                </Box>
                <Text textStyle="titleLg" color="fg" mb="3">{title}</Text>
                <Text fontSize="sm" color="fg.muted" lineHeight="1.75">{desc}</Text>
              </Box>
            ))}
          </Grid>
        </Box>

        {/* Manifesto */}
        <Box as="section">
          <Text as="h2" textStyle="label" color="fg.muted" mb="6">
            Manifesto
          </Text>
          <Box bg="bg.inverse" borderRadius="panel" p={{ base: "10", md: "16" }}>
            <Text
              fontSize="displayMd"
              fontWeight="300"
              lineHeight="1.35"
              color="fg.inverse"
              maxW="36ch"
            >
              ChatGPT no sabe lo que le contaste a Claude.{" "}
              <Text as="span" color="fg.inverse" style={{ opacity: 0.4 }}>
                Claude no recuerda el documento que subiste la semana pasada.
                Copilot no tiene el contexto de la reunión de esta mañana.
              </Text>
            </Text>
            <Text
              fontSize="displayMd"
              fontWeight="300"
              lineHeight="1.35"
              color="signalLime"
              maxW="28ch"
              mt="8"
            >
              Savia recuerda todo.{" "}
              <Text as="span" color="fg.inverse">
                Por todas.
              </Text>
            </Text>
            <Box mt="10" h="1px" bg="border.inverse" maxW="6rem" />
            <Text mt="6" fontSize="sm" color="fg.inverse" fontWeight="500" style={{ opacity: 0.4 }}>
              Savia · 2026
            </Text>
          </Box>
        </Box>

      </Box>
    </>
  );
}
