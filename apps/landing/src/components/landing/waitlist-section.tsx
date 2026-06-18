import { Box, Flex, Stack, Text } from '@chakra-ui/react';
import { Sparkles } from 'lucide-react';
import dynamic from 'next/dynamic';
import { SectionHeader } from '@/components/ui/section-header';

const WaitlistForm = dynamic(
  () => import('./waitlist-form').then((m) => m.WaitlistForm),
  { loading: () => <Box minH="20rem" bg="bg.inset" borderRadius="panel" /> }
);
import { AvatarStack } from './avatar-stack';
import { COMMUNITY_COUNT } from '@/lib/constants';

export function WaitlistSection() {
  return (
    <Box as="section" id="comunidad" py="sectionY" bg="bg.subtle" position="relative">
      <Box mx="auto" w="container" position="relative" zIndex={2}>
        <Box
          display="grid"
          gridTemplateColumns={{ base: '1fr', lg: 'minmax(0,2fr) minmax(0,3fr)' }}
          gap={{ base: '12', lg: '16' }}
          alignItems="start"
        >
          {/* ── Copy ──────────────────────────────────────── */}
          <Stack gap="5">
            <SectionHeader
              eyebrow="Early Access"
              headline={
                <>
                  Diseñado{' '}
                  <Text as="span" color="fg" fontWeight="700">
                    para no técnicos.
                  </Text>
                </>
              }
              description="Bienvenido a una comunidad de expertos que usan IA todos los días y buscan conectar con más profesionales."
              descriptionMaxW="28rem"
            />
            {/* Social proof */}
            <Flex alignItems="center" gap="3">
              <AvatarStack borderWidth="2px" />
              <Flex alignItems="center" gap="1.5">
                <Sparkles size={11} color="#0B2529" fill="#0B2529" />
                <Text fontSize="xs" fontWeight="600" color="fg.muted" lineHeight="1">
                  <Text as="span" color="fg" fontWeight="700">
                    {COMMUNITY_COUNT}
                  </Text>{' '}
                  ya en la comunidad
                </Text>
              </Flex>
            </Flex>
          </Stack>

          {/* ── Formulario ────────────────────────────────── */}
          <WaitlistForm />
        </Box>
      </Box>
    </Box>
  );
}
