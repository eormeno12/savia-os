import { Box, Grid, Text } from "@chakra-ui/react";

export const metadata = { title: "Voz" };

const ATTRIBUTES = [
  {
    title: "Declarativa",
    desc: "SAVIA no vende ni convence — declara. 'La memoria que conecta todas tus IAs' es una descripción, no un pitch. Escribe como si la persona ya entendiera el problema y solo necesitara saber la solución.",
    example: "SAVIA recuerda lo que le dijiste a Claude ayer.",
  },
  {
    title: "Posesiva",
    desc: "Siempre 'tus IAs', 'tu memoria', 'tu contexto'. Nunca 'el usuario', 'su cuenta' o 'sus herramientas'. La persona es el centro — la gramática lo refleja.",
    example: "Tu primera memoria ya está conectada.",
  },
  {
    title: "Técnica sin jerga",
    desc: "Hablamos de contexto, modelos e índices — pero en el idioma de alguien que los usa, no de alguien que los construye. La precisión no requiere vocabulario de manual técnico.",
    example: "Claude ahora tiene el contexto de tu reunión.",
  },
  {
    title: "Sin superlativos",
    desc: "Nunca 'la mejor', 'más potente' ni 'revolucionaria'. SAVIA describe exactamente lo que hace. Los adjetivos vacíos son una señal de que la frase no confía en sí misma.",
    example: "Una memoria. Todas tus IAs.",
  },
];

const DO_DONT = [
  {
    type: "Headline",
    do: "La memoria que conecta todas tus IAs.",
    dont: "La plataforma de memoria AI que revoluciona tu productividad.",
    note: "Declarativo vs. pitch. El one-liner no necesita adjetivos — la idea sola sostiene.",
  },
  {
    type: "Feature",
    do: "Claude recibe el contexto de tu última sesión con ChatGPT.",
    dont: "Sincronización cross-platform de memoria contextual multi-modelo.",
    note: "Describe el resultado para el usuario, no la mecánica del sistema.",
  },
  {
    type: "Onboarding",
    do: "Tu primera memoria está guardada. Ahora ChatGPT también sabe.",
    dont: "¡Configuración completada! Tu ecosistema de IA está ahora optimizado.",
    note: "Confirma lo que pasó, en términos del usuario. Sin exclamaciones, sin jerga.",
  },
  {
    type: "Estado vacío",
    do: "No hay memoria para esta IA todavía. Empieza una conversación.",
    dont: "Error: no se encontraron registros en el índice contextual del modelo.",
    note: "El estado vacío no es un error — es el punto de partida. Hablar en humano.",
  },
  {
    type: "CTA",
    do: "Conectar mi primera IA",
    dont: "Activar mi plan y transformar mi workflow con inteligencia artificial",
    note: "El CTA describe la acción exacta. Sin promesas de transformación.",
  },
];

const LEXICON = [
  {
    use: "la memoria",
    avoid: "el sistema / la plataforma / la solución",
    why: "SAVIA ES la memoria — no es un contenedor. Artículo definido intencional.",
  },
  {
    use: "tus IAs",
    avoid: "tus herramientas / tus modelos / el ecosistema",
    why: "'Tus' es posesivo y humano. 'IAs' es preciso sin ser técnico.",
  },
  {
    use: "conecta",
    avoid: "integra / sincroniza / interopera",
    why: "Conectar implica relación. Integrar implica instalación técnica.",
  },
  {
    use: "recuerda",
    avoid: "almacena / indexa / guarda",
    why: "Recuerda es humano y orientado al propósito. Los otros suenan a base de datos.",
  },
  {
    use: "la capa",
    avoid: "el middleware / la infraestructura / el backend",
    why: "Capa es visual e intuitivo. Los otros son jerga de ingeniería.",
  },
  {
    use: "contexto",
    avoid: "datos / información / conocimiento",
    why: "Contexto implica relevancia para una situación concreta.",
  },
  {
    use: "responde mejor",
    avoid: "optimiza / potencia / mejora la eficiencia",
    why: "Responde mejor es el resultado que le importa al usuario, no la métrica del sistema.",
  },
  {
    use: "ahora mismo",
    avoid: "en tiempo real / instantáneamente",
    why: "Ahora mismo es conversacional. Los otros son promesas de marketing.",
  },
  {
    use: "custodia",
    avoid: "protege / encripta / asegura",
    why: "Custodiar implica que algo te pertenece y alguien lo guarda por ti. Es más honesto.",
  },
];

export default function VoicePage() {
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
            Identidad · Voz
          </Text>
          <Text
            as="h1"
            fontSize="displayXl"
            fontWeight="300"
            lineHeight="0.92"
            color="fg"
            maxW="20ch"
          >
            Cómo habla{" "}
            <Text as="em" fontWeight="600" fontStyle="normal">
              SAVIA.
            </Text>
          </Text>
          <Text fontSize="bodyLg" color="fg.muted" mt="6" maxW="52ch" lineHeight="1.6">
            La voz de SAVIA parte del one-liner:{" "}
            <Text as="em" fontStyle="normal" fontWeight="500" color="fg">
              "La memoria que conecta todas tus IAs."
            </Text>{" "}
            Declarativa, posesiva, precisa. Sin superlativos, sin pitch.
          </Text>
        </Box>
      </Box>

      <Box px={{ base: "5", md: "8" }} py="sectionY" maxW="containerWide" mx="auto">

        {/* Attributes */}
        <Box as="section" mb="sectionYTight">
          <Text as="h2" textStyle="label" color="fg.muted" mb="10">
            Atributos
          </Text>
          <Grid templateColumns={{ base: "1fr", sm: "1fr 1fr" }} gap="4">
            {ATTRIBUTES.map(({ title, desc, example }) => (
              <Box key={title} bg="bg.subtle" borderRadius="card" p="8">
                <Text textStyle="titleLg" color="fg" mb="3">{title}</Text>
                <Text fontSize="sm" color="fg.muted" lineHeight="1.75" mb="5">{desc}</Text>
                <Box
                  bg="bg.inset"
                  borderRadius="message"
                  px="4"
                  py="3"
                  borderLeft="2px solid"
                  borderColor="border"
                >
                  <Text fontSize="xs" color="fg.muted" mb="1" fontWeight="600" letterSpacing="0.08em">
                    EJEMPLO
                  </Text>
                  <Text fontSize="sm" color="fg" fontWeight="500">{example}</Text>
                </Box>
              </Box>
            ))}
          </Grid>
        </Box>

        {/* Do / Dont */}
        <Box as="section" mb="sectionYTight">
          <Text as="h2" textStyle="label" color="fg.muted" mb="2">
            Sí / No
          </Text>
          <Text fontSize="sm" color="fg.muted" mb="10" maxW="56ch" lineHeight="1.65">
            Cinco contextos reales de SAVIA. El lado izquierdo suena a SAVIA.
            El derecho suena a cualquier otro SaaS.
          </Text>
          <Box>
            {DO_DONT.map(({ type, do: yes, dont: no, note }) => (
              <Box
                key={type}
                py="8"
                borderBottom="1px solid"
                borderColor="border.subtle"
              >
                <Text textStyle="label" color="fg.muted" mb="5">{type}</Text>
                <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap="4" mb="3">
                  {/* Do */}
                  <Box
                    bg="lime.subtle"
                    borderRadius="message"
                    p="5"
                    borderLeft="3px solid"
                    borderColor="lime.border"
                  >
                    <Text
                      fontSize="11px"
                      fontWeight="600"
                      letterSpacing="0.1em"
                      textTransform="uppercase"
                      color="lime.fg"
                      mb="2"
                    >
                      Sí
                    </Text>
                    <Text fontSize="sm" color="fg" fontWeight="500">{yes}</Text>
                  </Box>
                  {/* Dont */}
                  <Box
                    bg="bg.subtle"
                    borderRadius="message"
                    p="5"
                    borderLeft="3px solid"
                    borderColor="border"
                  >
                    <Text
                      fontSize="11px"
                      fontWeight="600"
                      letterSpacing="0.1em"
                      textTransform="uppercase"
                      color="fg.muted"
                      mb="2"
                    >
                      No
                    </Text>
                    <Text
                      fontSize="sm"
                      color="fg.muted"
                      style={{ textDecoration: "line-through" }}
                    >
                      {no}
                    </Text>
                  </Box>
                </Grid>
                <Text fontSize="xs" color="fg.muted" lineHeight="1.6" style={{ opacity: 0.7 }}>
                  {note}
                </Text>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Lexicon */}
        <Box as="section">
          <Text as="h2" textStyle="label" color="fg.muted" mb="2">
            Léxico
          </Text>
          <Text fontSize="sm" color="fg.muted" mb="8" maxW="56ch" lineHeight="1.65">
            Las palabras preferidas de SAVIA, derivadas del one-liner y su territorio de marca.
          </Text>
          <Box border="1px solid" borderColor="border" borderRadius="card" overflow="hidden">
            <Box
              display="grid"
              style={{ gridTemplateColumns: "1fr 1fr 2fr" }}
              bg="bg.subtle"
              px="6"
              py="3"
              borderBottom="1px solid"
              borderColor="border"
            >
              <Text textStyle="label" color="fg.muted">Usar</Text>
              <Text textStyle="label" color="fg.muted">Evitar</Text>
              <Text textStyle="label" color="fg.muted">Por qué</Text>
            </Box>
            {LEXICON.map(({ use, avoid, why }, i) => (
              <Box
                key={use}
                display="grid"
                style={{ gridTemplateColumns: "1fr 1fr 2fr" }}
                px="6"
                py="4"
                borderBottom={i < LEXICON.length - 1 ? "1px solid" : undefined}
                borderColor="border.subtle"
                alignItems="center"
              >
                <Text fontSize="sm" fontWeight="600" color="fg">{use}</Text>
                <Text fontSize="sm" color="fg.muted" style={{ textDecoration: "line-through" }}>
                  {avoid}
                </Text>
                <Text fontSize="sm" color="fg.muted">{why}</Text>
              </Box>
            ))}
          </Box>
        </Box>

      </Box>
    </>
  );
}
