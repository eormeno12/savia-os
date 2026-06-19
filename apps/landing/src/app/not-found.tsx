import { Box, Stack, Text } from '@chakra-ui/react';
import { SaviaMark } from '@/components/design-system/savia-mark';
import { LinkButton } from '@/components/ui/button';

export default function NotFound() {
  return (
    <Box
      as="main"
      minH="100svh"
      bg="bg.inverse"
      display="flex"
      alignItems="center"
      justifyContent="center"
      px="6"
      position="relative"
      overflow="hidden"
      _before={{
        content: '""',
        position: 'absolute',
        inset: 0,
        backgroundImage: 'radial-gradient(circle, rgba(244,244,241,0.055) 1px, transparent 1px)',
        backgroundSize: '36px 36px',
        pointerEvents: 'none',
      }}
    >

      <Stack alignItems="center" gap="10" textAlign="center" position="relative" zIndex={1}>
        <SaviaMark size={48} color="#E7FF18" />

        <Stack gap="6" maxW="30rem" alignItems="center">
          {/* Eyebrow de error */}
          <Text
            fontSize="xs"
            fontWeight="700"
            letterSpacing="0.14em"
            textTransform="uppercase"
            color="signalLime"
          >
            Error 404
          </Text>

          <Stack gap="3">
            <Text
              as="h1"
              fontSize={{ base: 'display2xl', lg: 'display3xl' }}
              fontWeight="300"
              lineHeight="0.92"
              color="fg.inverse"
              textWrap="balance"
            >
              Esta página{' '}
              <Text as="span" color="signalLime" fontWeight="700">
                no existe.
              </Text>
            </Text>
            <Text fontSize="bodyLg" color="fg.inverse/60" lineHeight="1.65">
              Pero tu memoria inteligente, sí.
            </Text>
          </Stack>
        </Stack>

        <LinkButton href="/" size="lg" colorPalette="lime">
          Volver al inicio
        </LinkButton>
      </Stack>
    </Box>
  );
}
