import { Box, Stack, Text } from '@chakra-ui/react';
import { SaviaMark } from '@/components/design-system/savia-mark';
import { LinkButton } from '@/components/ui/button';
import { BRAND_COLORS } from '@/lib/constants';

export default function NotFound() {
  return (
    <Box
      as="main"
      minH="100svh"
      bg="bg"
      display="flex"
      alignItems="center"
      justifyContent="center"
      px="6"
    >
      <Stack alignItems="center" gap="8" textAlign="center">
        <SaviaMark size={40} color={BRAND_COLORS.lime} />

        <Stack gap="4" maxW="32rem">
          <Text
            as="h1"
            fontSize={{ base: 'display2xl', lg: 'display3xl' }}
            fontWeight="300"
            lineHeight="0.92"
            color="fg.muted"
            textWrap="balance"
          >
            Esta página{' '}
            <Text as="span" color="fg" fontWeight="700">
              no existe.
            </Text>
          </Text>
          <Text fontSize="bodyLg" color="fg.muted" lineHeight="1.65">
            Pero tu memoria inteligente, sí.
          </Text>
        </Stack>

        <LinkButton href="/" size="lg" colorPalette="lime">
          Volver al inicio
        </LinkButton>
      </Stack>
    </Box>
  );
}
