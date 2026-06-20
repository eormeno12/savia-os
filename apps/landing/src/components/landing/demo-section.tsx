import dynamic from 'next/dynamic';
import { Box } from '@chakra-ui/react';

const DemoChat = dynamic(
  () => import('./demo-chat').then((m) => m.DemoChat),
  { loading: () => <Box flex="1" bg="bg.inset" borderRadius="panel" /> }
);

export function DemoSection() {
  return (
    <Box
      as="section"
      id="demo"
      flex="1"
      display="flex"
      flexDirection="column"
      overflow="hidden"
      px={{ base: '4', md: '6', lg: '8' }}
      pt={{ base: '4', lg: '5' }}
      pb={{ base: '3', lg: '4' }}
    >
      <DemoChat />
    </Box>
  );
}
