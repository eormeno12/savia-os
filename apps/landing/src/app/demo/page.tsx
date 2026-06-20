import { Box, Link } from '@chakra-ui/react';
import { AppHeader } from '@/components/ui/app-header';
import { CtaButton } from '@/components/landing/cta-button';
import { DemoSection } from '@/components/landing/demo-section';

export const metadata = {
  title: 'Demo — Savia',
  description: 'El mismo mensaje, dos respuestas. Así se ve la IA con memoria.',
};

export default function DemoPage() {
  return (
    <Box as="main" bg="bg" h="100svh" display="flex" flexDirection="column" overflow="hidden">
      <AppHeader
        badge="demo"
        actions={
          <CtaButton size="sm">
            Solicitar acceso
          </CtaButton>
        }
      />
      <DemoSection />
    </Box>
  );
}
