import { Box, Flex, Link } from '@chakra-ui/react';
import { SaviaMark } from '@/components/design-system/savia-mark';
import { BRAND_COLORS } from '@/lib/constants';

type AppHeaderProps = {
  /** Short text shown as a pill badge next to the logo (e.g. "demo", "beta"). */
  badge?: string;
  /** Destination when the logo is clicked. Defaults to "/". */
  logoHref?: string;
  /** Center slot — navigation links or any content. Hidden on mobile unless provided. */
  nav?: React.ReactNode;
  /** Right slot — CTA buttons, user menu, etc. */
  actions?: React.ReactNode;
  /** Extra element rendered outside and below the pill (e.g. a mobile menu overlay). */
  below?: React.ReactNode;
};

export function AppHeader({
  badge,
  logoHref = '/',
  nav,
  actions,
  below,
}: AppHeaderProps) {
  return (
    <>
      <Box as="header" pt="4" pb="3" flexShrink={0}>
        <Flex
          bg="bg.inverse"
          borderRadius="full"
          boxShadow="float"
          mx="auto"
          maxW="container"
          px="6"
          h="14"
          alignItems="center"
          justifyContent="space-between"
        >
          {/* Logo + optional badge */}
          <Link
            href={logoHref}
            display="flex"
            alignItems="center"
            gap="2.5"
            textDecoration="none"
            _hover={{ textDecoration: 'none' }}
          >
            <SaviaMark size={18} color={BRAND_COLORS.lime} />
            <Box as="span" color="fg.inverse" fontWeight="600" fontSize="sm" letterSpacing="0.06em">
              SAVIA
            </Box>
            {badge && (
              <Box
                as="span"
                px="2"
                py="0.5"
                borderRadius="full"
                bg="fg.inverse/10"
                borderWidth="1px"
                borderColor="fg.inverse/18"
                fontSize="xs"
                fontWeight="500"
                color="fg.inverse/60"
                letterSpacing="0.04em"
              >
                {badge}
              </Box>
            )}
          </Link>

          {/* Center nav slot */}
          {nav && (
            <Box display={{ base: 'none', md: 'flex' }} alignItems="center">
              {nav}
            </Box>
          )}

          {/* Right actions slot */}
          {actions && (
            <Box display="flex" alignItems="center" gap="2">
              {actions}
            </Box>
          )}
        </Flex>
      </Box>

      {below}
    </>
  );
}
