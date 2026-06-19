import { Box, Flex, Grid, HStack, Link, Stack, Text } from '@chakra-ui/react';
import { ArrowUpRight } from 'lucide-react';
import { SaviaMark } from '@/components/design-system/savia-mark';
import { CtaButton } from '@/components/landing/cta-button';
import { NAV_ITEMS, BRAND_COLORS } from '@/lib/constants';

function SocialLinkedInIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

const SOCIAL_ITEMS: { label: string; href: string; Icon: () => React.JSX.Element }[] = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com/company/saviahq', Icon: SocialLinkedInIcon },
];

const EYEBROW = {
  fontSize: 'xs',
  fontWeight: '600',
  letterSpacing: '0.1em',
  textTransform: 'uppercase' as const,
  color: 'fg.inverse',
  opacity: 0.35,
} as const;

export function SiteFooter() {
  return (
    <Box as="footer" bg="bg.inverse" position="relative">
      {/* Main area */}
      <Box
        mx="auto"
        w="container"
        pt={{ base: '12', lg: '16' }}
        pb="10"
        position="relative"
        zIndex={2}
      >
        <Grid
          templateColumns={{ base: '1fr', md: '1fr auto' }}
          gap={{ base: '10', md: '20' }}
          alignItems="start"
        >
          {/* Brand column */}
          <Stack gap="7">
            <HStack gap="2.5">
              <SaviaMark size={18} color={BRAND_COLORS.lime} />
              <Text color="fg.inverse" fontWeight="600" fontSize="sm" letterSpacing="0.06em">
                SAVIA
              </Text>
            </HStack>

            <Text
              as="p"
              fontSize={{ base: 'xl', md: '2xl' }}
              fontWeight="300"
              lineHeight="1.15"
              color="fg.inverse"
              maxW="22rem"
            >
              La memoria que{' '}
              <Text as="span" fontWeight="700">
                conecta
              </Text>{' '}
              todas tus IAs.
            </Text>

            <Box>
              <CtaButton size="sm">
                Early access
                <ArrowUpRight size={14} aria-hidden />
              </CtaButton>
            </Box>
          </Stack>

          {/* Nav + social columns */}
          <Grid templateColumns="1fr 1fr" gap="10" pt={{ base: '0', md: '1' }}>
            {/* Producto nav */}
            <Stack gap="4">
              <Text {...EYEBROW}>Producto</Text>
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  color="fg.inverse"
                  opacity={0.65}
                  fontSize="sm"
                  fontWeight="500"
                  textDecoration="none"
                  transition="opacity 150ms ease"
                  _hover={{ textDecoration: 'none', opacity: 1 }}
                >
                  {item.label}
                </Link>
              ))}
            </Stack>

            {/* Social links */}
            <Stack gap="4">
              <Text {...EYEBROW}>Redes</Text>
              {SOCIAL_ITEMS.map(({ label, href, Icon }) =>
                href ? (
                  <Link
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    color="fg.inverse"
                    opacity={0.65}
                    fontSize="sm"
                    fontWeight="500"
                    textDecoration="none"
                    transition="opacity 150ms ease"
                    _hover={{ textDecoration: 'none', opacity: 1 }}
                  >
                    <HStack gap="2">
                      <Icon />
                      <Text>{label}</Text>
                    </HStack>
                  </Link>
                ) : (
                  <Box
                    key={label}
                    as="span"
                    color="fg.inverse"
                    opacity={0.3}
                    fontSize="sm"
                    fontWeight="500"
                    cursor="not-allowed"
                    aria-label={`${label} (próximamente)`}
                  >
                    <HStack gap="2">
                      <Icon />
                      <Text>{label}</Text>
                    </HStack>
                  </Box>
                )
              )}
            </Stack>
          </Grid>
        </Grid>
      </Box>

      {/* Bottom bar */}
      <Box borderTopWidth="1px" borderColor="border.inverse" py="4" position="relative" zIndex={2}>
        <Flex mx="auto" w="container" align="center" justify="space-between">
          <Text fontSize="xs" color="fg.inverse" opacity={0.3}>
            © 2026 SAVIA.
          </Text>
          <Text fontSize="xs" color="fg.inverse" opacity={0.3}>
            Hecho para tu memoria.
          </Text>
        </Flex>
      </Box>
    </Box>
  );
}
