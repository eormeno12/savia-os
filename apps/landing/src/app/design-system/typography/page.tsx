import { Box, Code, Text } from "@chakra-ui/react";

export const metadata = { title: "Tipografía" };

export default function TypographyPage() {
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
          >
            Una sola fuente: <Text as="em" fontWeight="600" fontStyle="normal">Inter.</Text>
          </Text>
          <Text fontSize="bodyLg" color="fg.muted" mt="6" maxW="56ch">
            Inter en cuatro pesos. Display ligero (300) para el aire, semibold (600)
            para el énfasis. Todos los tamaños de display escalan con{" "}
            <Code>clamp()</Code> — el texto respira con el viewport, sin saltos de
            breakpoint.
          </Text>
        </Box>
      </Box>

      {/* Content */}
      <Box px={{ base: "5", md: "8" }} py="sectionY" maxW="containerWide" mx="auto">

        {/* Font weights */}
        <Box as="section" mb="sectionYTight">
          <Text as="h2" textStyle="label" color="fg.muted" mb="2">
            Pesos
          </Text>
          <Text fontSize="sm" color="fg.muted" mb="8" maxW="56ch" lineHeight="1.65">
            Cuatro pesos cargados. Sin italics — la cursiva no es parte de la voz Savia.
          </Text>
          <Box
            display="grid"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}
            gap="3"
          >
            {[
              { weight: "300", name: "light", use: "display" },
              { weight: "400", name: "regular", use: "body" },
              { weight: "500", name: "medium", use: "nav links" },
              { weight: "600", name: "semibold", use: "acentos" },
            ].map(({ weight, name, use }) => (
              <Box
                key={weight}
                bg="bg"
                border="1px solid"
                borderColor="border.subtle"
                borderRadius="2xl"
                p="6"
              >
                <Text
                  fontSize="5xl"
                  lineHeight="1"
                  letterSpacing="-0.01em"
                  color="fg"
                  style={{ fontWeight: weight }}
                >
                  Aa
                </Text>
                <Box mt="4">
                  <Code fontSize="12px" color="fg" display="block">
                    {name}
                  </Code>
                  <Text
                    fontSize="11px"
                    color="fg.muted"
                    fontFamily="ui-monospace, monospace"
                    mt="1"
                  >
                    {weight} · {use}
                  </Text>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Type scale */}
        <Box as="section" mb="sectionYTight">
          <Text as="h2" textStyle="label" color="fg.muted" mb="2">
            Escala de display
          </Text>
          <Text fontSize="sm" color="fg.muted" mb="8" maxW="60ch" lineHeight="1.65">
            Todos los tamaños de display usan <Code>clamp(min, fluid, max)</Code> — no
            escalan por breakpoints sino linealmente con el viewport. Esto es lo que{" "}
            <Code>textStyle</Code> aplica directamente desde el tema.
          </Text>

          {/* displayXl */}
          <Box
            py="8"
            borderBottom="1px solid"
            borderColor="border.subtle"
            display="flex"
            gap="10"
            alignItems="baseline"
            flexWrap="wrap"
          >
            <Box minW="52" flexShrink={0}>
              <Code fontSize="13px" color="fg">displayXl</Code>
              <Text
                fontSize="11px"
                color="fg.muted"
                fontFamily="ui-monospace, monospace"
                mt="1"
                lineHeight="1.5"
              >
                clamp(40px, 4.8vw, 80px)
                <br />
                weight 300 · lh 0.92
              </Text>
            </Box>
            <Text textStyle="displayXl" color="fg">
              Memoria para tu IA
            </Text>
          </Box>

          {/* displayLg */}
          <Box
            py="8"
            borderBottom="1px solid"
            borderColor="border.subtle"
            display="flex"
            gap="10"
            alignItems="baseline"
            flexWrap="wrap"
          >
            <Box minW="52" flexShrink={0}>
              <Code fontSize="13px" color="fg">displayLg</Code>
              <Text
                fontSize="11px"
                color="fg.muted"
                fontFamily="ui-monospace, monospace"
                mt="1"
                lineHeight="1.5"
              >
                clamp(36px, 4vw, 64px)
                <br />
                weight 300 · lh 0.92
              </Text>
            </Box>
            <Text
              fontSize="displayLg"
              fontWeight="300"
              lineHeight="0.92"
              color="fg"
            >
              Contexto inteligente
            </Text>
          </Box>

          {/* displayMd */}
          <Box
            py="8"
            borderBottom="1px solid"
            borderColor="border.subtle"
            display="flex"
            gap="10"
            alignItems="baseline"
            flexWrap="wrap"
          >
            <Box minW="52" flexShrink={0}>
              <Code fontSize="13px" color="fg">displayMd</Code>
              <Text
                fontSize="11px"
                color="fg.muted"
                fontFamily="ui-monospace, monospace"
                mt="1"
                lineHeight="1.5"
              >
                clamp(2rem, 3.4vw, 3.35rem)
                <br />
                weight 600 · lh 1.02
              </Text>
            </Box>
            <Text textStyle="displayMd" color="fg">
              Recuerda por ti
            </Text>
          </Box>

          {/* display2xl */}
          <Box
            py="8"
            borderBottom="1px solid"
            borderColor="border.subtle"
            display="flex"
            gap="10"
            alignItems="baseline"
            flexWrap="wrap"
          >
            <Box minW="52" flexShrink={0}>
              <Code fontSize="13px" color="fg">display2xl</Code>
              <Text
                fontSize="11px"
                color="fg.muted"
                fontFamily="ui-monospace, monospace"
                mt="1"
                lineHeight="1.5"
              >
                clamp(2.35rem, 5vw, 5rem)
                <br />
                weight 300 · lh 0.88
              </Text>
            </Box>
            <Text textStyle="display2xl" color="fg">
              Tu segunda capa
            </Text>
          </Box>

          {/* display3xl */}
          <Box
            py="8"
            borderBottom="1px solid"
            borderColor="border.subtle"
            display="flex"
            gap="10"
            alignItems="baseline"
            flexWrap="wrap"
          >
            <Box minW="52" flexShrink={0}>
              <Code fontSize="13px" color="fg">display3xl</Code>
              <Text
                fontSize="11px"
                color="fg.muted"
                fontFamily="ui-monospace, monospace"
                mt="1"
                lineHeight="1.5"
              >
                clamp(2.75rem, 6vw, 6rem)
                <br />
                weight 300 · lh 0.92
              </Text>
            </Box>
            <Text textStyle="display3xl" color="fg">
              Una sola señal
            </Text>
          </Box>

          {/* titleLg */}
          <Box
            py="8"
            borderBottom="1px solid"
            borderColor="border.subtle"
            display="flex"
            gap="10"
            alignItems="baseline"
            flexWrap="wrap"
          >
            <Box minW="52" flexShrink={0}>
              <Code fontSize="13px" color="fg">titleLg</Code>
              <Text
                fontSize="11px"
                color="fg.muted"
                fontFamily="ui-monospace, monospace"
                mt="1"
                lineHeight="1.5"
              >
                clamp(20px, 1.6vw, 32px)
                <br />
                weight 600 · lh 1.1
              </Text>
            </Box>
            <Text textStyle="titleLg" color="fg">
              Cómo funciona la memoria
            </Text>
          </Box>

          {/* bodyLg */}
          <Box
            py="8"
            borderBottom="1px solid"
            borderColor="border.subtle"
            display="flex"
            gap="10"
            alignItems="baseline"
            flexWrap="wrap"
          >
            <Box minW="52" flexShrink={0}>
              <Code fontSize="13px" color="fg">bodyLg</Code>
              <Text
                fontSize="11px"
                color="fg.muted"
                fontFamily="ui-monospace, monospace"
                mt="1"
                lineHeight="1.5"
              >
                clamp(16px, 1.1vw, 20px)
                <br />
                weight 400 · lh 1.75
              </Text>
            </Box>
            <Text textStyle="bodyLg" color="fg" maxW="52ch">
              Savia indexa cada conversación y archivo que pasa por tu IA. Cuando
              preguntas algo nuevo, recupera el contexto relevante sin que tengas que
              recordarlo tú.
            </Text>
          </Box>

          {/* label */}
          <Box
            py="8"
            display="flex"
            gap="10"
            alignItems="baseline"
            flexWrap="wrap"
          >
            <Box minW="52" flexShrink={0}>
              <Code fontSize="13px" color="fg">label</Code>
              <Text
                fontSize="11px"
                color="fg.muted"
                fontFamily="ui-monospace, monospace"
                mt="1"
                lineHeight="1.5"
              >
                12px · weight 600
                <br />
                ls 0.12em · uppercase
              </Text>
            </Box>
            <Text textStyle="label" color="fg">
              Acceso anticipado
            </Text>
          </Box>
        </Box>

        {/* Pairing */}
        <Box as="section">
          <Text as="h2" textStyle="label" color="fg.muted" mb="2">
            Combinación
          </Text>
          <Text fontSize="sm" color="fg.muted" mb="8" maxW="56ch" lineHeight="1.65">
            La jerarquía estándar para secciones: label + headline ligero con acento
            semibold + body en slate.
          </Text>
          <Box
            bg="bg"
            border="1px solid"
            borderColor="border"
            borderRadius="card"
            p={{ base: "8", md: "12" }}
          >
            <Text textStyle="label" color="fg.muted" mb="6">
              Cómo funciona
            </Text>
            <Text
              as="h3"
              fontSize="displayXl"
              fontWeight="300"
              lineHeight="0.92"
              color="fg"
              maxW="18ch"
            >
              Memoria que{" "}
              <Text as="em" fontWeight="600" fontStyle="normal">
                conecta
              </Text>{" "}
              tus chats.
            </Text>
            <Text textStyle="bodyLg" color="fg.muted" mt="8" maxW="56ch">
              Savia organiza de manera inteligente tus conversaciones y archivos para
              que cada modelo responda con la precisión de uno que te conoce. Sin
              reentrenamiento. Sin pegar contexto cada vez.
            </Text>
          </Box>
        </Box>
      </Box>
    </>
  );
}
