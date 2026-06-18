'use client';

import { Box, Stack, Text } from '@chakra-ui/react';
import { SaviaMark } from '@/components/design-system/savia-mark';
import { Button } from '@/components/ui/button';
import { BRAND_COLORS } from '@/lib/constants';

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
            Algo salió{' '}
            <Text as="span" color="fg" fontWeight="700">
              mal.
            </Text>
          </Text>
          <Text fontSize="bodyLg" color="fg.muted" lineHeight="1.65">
            No perdiste tu memoria. Inténtalo de nuevo.
          </Text>
        </Stack>

        <Button size="lg" colorPalette="lime" onClick={reset}>
          Volver a intentar
        </Button>
      </Stack>
    </Box>
  );
}
