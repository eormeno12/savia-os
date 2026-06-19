import { Box, Flex, Grid, Stack, Text } from '@chakra-ui/react';
import { Check, Sparkles } from 'lucide-react';
import { CtaButton } from '@/components/landing/cta-button';
import { SectionHeader } from '@/components/ui/section-header';

const FEATURES = [
  'Tus IAs responden mejor — comparten el mismo contexto',
  'No repites lo que ya le contaste a otra IA',
  'Tu memoria se construye sola, desde donde ya trabajas',
  'Encuentra cualquier contexto aunque no recuerdes cómo lo llamaste',
  'Lo que recuerdas es tuyo — SAVIA custodia, no aprende',
  'Funciona con Claude, ChatGPT, Gemini, Cursor y las que vengan',
  'Sin límite de fuentes ni de IAs conectadas',
  'Acceso anticipado a todo lo que viene',
] as const;

export function Pricing() {
  return (
    <Box as="section" id="planes" py="sectionY" bg="bg" position="relative">
      <Box mx="auto" w="container" position="relative" zIndex={2}>
        <SectionHeader
          eyebrow="Planes"
          mb={{ base: '12', lg: '16' }}
          headline={
            <>
              Un solo pago <br />
              <Text as="span" color="fg" fontWeight="700">
                para todas tus IAs.
              </Text>
            </>
          }
        />

        <Grid
          templateColumns={{ base: '1fr', lg: 'minmax(0, 7fr) minmax(0, 5fr)' }}
          gap={{ base: '12', lg: '20' }}
          alignItems="start"
        >
          {/* ── Columna izquierda: beneficios ─────────────────── */}
          <Grid templateColumns={{ base: '1fr', sm: '1fr 1fr' }} gap="0">
            {FEATURES.map((feature) => (
              <Flex
                key={feature}
                alignItems="flex-start"
                gap="3"
                py="4"
                pr={{ sm: '6' }}
                borderBottomWidth="1px"
                borderColor="border"
              >
                <Box color="fg.muted" flexShrink={0} mt="3px" lineHeight={1} aria-hidden="true">
                  <Check size={14} strokeWidth={2} />
                </Box>
                <Text fontSize="sm" color="fg.muted" lineHeight="1.5">
                  {feature}
                </Text>
              </Flex>
            ))}
          </Grid>

          {/* ── Columna derecha: tarjeta de precio ───────────── */}
          <Box
            bg="ink"
            borderRadius="card"
            p={{ base: '6', lg: '8' }}
            borderWidth="1px"
            borderColor="rgba(231,255,24,0.25)"
            style={{
              boxShadow: '0 0 48px -8px rgba(231,255,24,0.15), 0 0 0 1px rgba(231,255,24,0.08)',
            }}
            position="relative"
            overflow="hidden"
            _before={{
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '2px',
              background: '#E7FF18',
            }}
          >
            <Stack gap="8">
              {/* Badge + precio */}
              <Stack gap="4">
                <Flex
                  display="inline-flex"
                  alignSelf="flex-start"
                  alignItems="center"
                  gap="1.5"
                  bg="signalLime"
                  borderRadius="chip"
                  px="3"
                  py="1.5"
                >
                  <Sparkles size={12} color="#0B2529" fill="#0B2529" />
                  <Text
                    fontSize="xs"
                    fontWeight="700"
                    letterSpacing="0.10em"
                    textTransform="uppercase"
                    color="ink"
                    lineHeight="1"
                  >
                    SAVIA PRO
                  </Text>
                </Flex>

                <Flex alignItems="center" gap="2.5">
                  <Text
                    as="span"
                    fontSize="lg"
                    fontWeight="400"
                    color="fg.inverse/28"
                    textDecoration="line-through"
                  >
                    $19.99
                  </Text>
                  <Box bg="rgba(231,255,24,0.12)" borderRadius="chip" px="2" py="1">
                    <Text fontSize="xs" fontWeight="700" color="signalLime" lineHeight="1">
                      −60%
                    </Text>
                  </Box>
                </Flex>

                <Flex alignItems="baseline" gap="1.5">
                  <Text
                    as="span"
                    fontSize={{ base: 'display2xl', lg: 'display3xl' }}
                    fontWeight="700"
                    lineHeight="1"
                    color="fg.inverse"
                  >
                    $11.99
                  </Text>
                  <Text as="span" fontSize="titleLg" fontWeight="300" color="fg.inverse/50">
                    /mes
                  </Text>
                </Flex>

                <Text
                  fontSize="sm"
                  color="fg.inverse/50"
                  lineHeight="1.65"
                  textWrap="pretty"
                >
                  Precio exclusivo para miembros de la comunidad.
                </Text>
              </Stack>

              {/* CTA */}
              <Stack gap="2">
                <CtaButton size="lg" w="full">
                  Unirme a la comunidad
                </CtaButton>
              </Stack>
            </Stack>
          </Box>
        </Grid>
      </Box>
    </Box>
  );
}
