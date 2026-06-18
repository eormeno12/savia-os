import { Box, Flex, Stack, Text } from '@chakra-ui/react';
import { Sparkles } from 'lucide-react';
import Image from 'next/image';
import { AvatarStack } from '@/components/landing/avatar-stack';
import { COMMUNITY_COUNT } from '@/lib/constants';
import { FadeInUp } from '@/components/ui/animated-section';
import { SiteHeader } from '@/components/landing/site-header';
import { SiteFooter } from '@/components/landing/site-footer';
import { SaviaParticles } from '@/components/landing/savia-particles';
import { IslandImage } from '@/components/landing/island-image';
import dynamic from 'next/dynamic';
import { HowItWorks } from '@/components/landing/how-it-works';
import { Pricing } from '@/components/landing/pricing';
import { WaitlistSection } from '@/components/landing/waitlist-section';

const EcosystemScroll = dynamic(
  () => import('@/components/landing/ecosystem-scroll').then((m) => m.EcosystemScroll),
  { loading: () => <Box minH="100svh" /> }
);
import { CountdownBanner } from '@/components/landing/countdown-banner';
import { ControlSection } from '@/components/landing/control-section';
import { CtaButton } from '@/components/landing/cta-button';
import { QuoteDivider } from '@/components/landing/quote-divider';

export default function Home() {
  return (
    <Box as="main" id="main-content" bg="bg" minH="100svh">
      <a href="#main-content" className="skip-link">
        Ir al contenido principal
      </a>

      {/* Partículas — fixed sobre toda la landing */}
      <SaviaParticles />

      <Box position="sticky" top="0" zIndex="sticky">
        <CountdownBanner />
        <SiteHeader />
      </Box>

      {/* ── Hero ──────────────────────────────────────────────── */}
      <Box as="section" id="inicio" position="relative" minH="100svh" overflow="hidden">
        {/* Copy */}
        <Box mx="auto" w="container" position="relative" zIndex="2" pt={{ base: '4', lg: '8' }}>
          <Stack gap="7" maxW="containerNarrow" mx="auto" textAlign="center" alignItems="center">
            {/* Disclaimer de audiencia */}
            <Text fontSize="xs" color="fg.muted" opacity={0.5} letterSpacing="0.04em">
              Diseñado para expertos que ya usan IA todos los días.
            </Text>

            {/* Social proof + incubadora */}
            <Flex alignItems="center" gap="3" flexWrap="wrap" justifyContent="center">
              {/* Badge con avatar stack */}
              <Flex
                display="inline-flex"
                alignItems="center"
                bg="bg.inset"
                borderWidth="1px"
                borderColor="border.subtle"
                borderRadius="full"
                pl="1.5"
                pr="4"
                py="1.5"
                gap="2.5"
                boxShadow="soft"
              >
                <AvatarStack />
                <Box w="px" h="3.5" bg="border.subtle" flexShrink={0} />
                <Flex alignItems="center" gap="1.5">
                  <Sparkles
                    size={11}
                    color="#0A0A0A"
                    fill="#E7FF18"
                    stroke="#0A0A0A"
                    strokeWidth={1.5}
                  />
                  <Text fontSize="xs" fontWeight="600" color="fg.muted" lineHeight="1">
                    {COMMUNITY_COUNT} ya en la comunidad
                  </Text>
                </Flex>
              </Flex>

              {/* Incubadora */}
              <Flex display="inline-flex" alignItems="center" gap="2">
                <Text fontSize="xs" color="fg.muted" opacity={0.5} lineHeight="1" whiteSpace="nowrap">
                  Incubados por
                </Text>
                <Image
                  src="/logo-uv.png"
                  alt="UTEC Ventures"
                  width={64}
                  height={20}
                  style={{ objectFit: 'contain' }}
                />
              </Flex>
            </Flex>

            {/* Headline */}
            <Text
              as="h1"
              fontSize={{ base: 'displayXl', lg: 'display2xl' }}
              fontWeight="300"
              lineHeight="0.92"
              color="fg.muted"
              textWrap="balance"
            >
              La memoria que{' '}
              <Text as="span" color="fg" fontWeight="700">
                conecta
              </Text>{' '}
              todas tus IAs
            </Text>

            {/* Subtítulo */}
            <Text
              fontSize="bodyLg"
              color="fg.muted"
              lineHeight="1.65"
              maxW="30rem"
              textWrap="pretty"
            >
              Mejores resultados, menos fricción. <br />
              Todo tu conocimiento en un solo lugar.
            </Text>

            {/* CTA split-pill */}
            <CtaButton size="lg">Early access</CtaButton>
          </Stack>
        </Box>

        {/* Isla — flujo normal, siempre debajo del copy */}
        <Box
          zIndex="2"
          mt={{ base: '10', lg: '14' }}
          pointerEvents="none"
          style={{
            width: 'clamp(480px, 58vw, 720px)',
            position: 'relative',
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        >
          <IslandImage />
        </Box>
      </Box>

      <EcosystemScroll />

      <HowItWorks />

      <FadeInUp>
        <QuoteDivider
          kind="pain"
          quote={
            <>
              La IA responde bien.{' '}
              <Text as="span" color="signalLime" fontWeight="600">
                Pero mañana no recuerda nada.
              </Text>
            </>
          }
          attribution="— Ana, Consultora"
        />
      </FadeInUp>

      <FadeInUp>
        <ControlSection />
      </FadeInUp>

      <FadeInUp>
        <QuoteDivider
          kind="affirmation"
          statement={
            <>
              El 90% también se frustra{' '}
              <Text as="span" color="signalLime" fontWeight="600">
                cuando la IA es imprecisa.
              </Text>
            </>
          }
        />
      </FadeInUp>

      <FadeInUp>
        <Pricing />
      </FadeInUp>

      <FadeInUp>
        <QuoteDivider
          kind="pain"
          quote={
            <>
              Sin contexto,{' '}
              <Text as="span" color="signalLime" fontWeight="600">
                hasta el mejor modelo es una m***.
              </Text>
            </>
          }
          attribution="— Diego, Product Manager"
        />
      </FadeInUp>

      <FadeInUp>
        <WaitlistSection />
      </FadeInUp>

      <SiteFooter />
    </Box>
  );
}
