import { Box, Stack, Text } from '@chakra-ui/react';

type PainQuote = {
  kind: 'pain';
  quote: React.ReactNode;
  attribution: string;
};

type Affirmation = {
  kind: 'affirmation';
  statement: React.ReactNode;
};

type QuoteDividerProps = PainQuote | Affirmation;

export function QuoteDivider(props: QuoteDividerProps) {
  if (props.kind === 'pain') {
    const authorName = props.attribution.replace(/^—\s*/, '');
    return (
      <Box as="section" aria-label={`Testimonio de ${authorName}`} py={{ base: "8", lg: "10" }} bg="ink" position="relative">
        <Box mx="auto" w="container" position="relative" zIndex={2}>
          <Stack gap="0" maxW="containerNarrow">
            <Text
              aria-hidden="true"
              fontSize={{ base: '4xl', lg: '5xl' }}
              color="signalLime"
              fontWeight="400"
              lineHeight="0.8"
              mb="3"
              userSelect="none"
            >
              "
            </Text>
            <Text
              fontSize={{ base: 'displayLg', lg: 'displayXl' }}
              fontWeight="300"
              lineHeight="0.95"
              color="fg.inverse"
              textWrap="balance"
            >
              {props.quote}
            </Text>
            <Text
              fontSize="sm"
              color="fg.inverse"
              fontWeight="400"
              opacity={0.35}
              mt="5"
            >
              {props.attribution}
            </Text>
          </Stack>
        </Box>
      </Box>
    );
  }

  return (
    <Box as="section" aria-label="Perspectiva de la comunidad" py={{ base: "8", lg: "10" }} bg="ink" position="relative">
      <Box mx="auto" w="container" position="relative" zIndex={2}>
        <Text
          fontSize={{ base: 'displayLg', lg: 'displayXl' }}
          fontWeight="300"
          lineHeight="0.95"
          color="fg.inverse"
          textWrap="balance"
          maxW="containerNarrow"
          textAlign={{ base: 'left', md: 'center' }}
          mx="auto"
        >
          {props.statement}
        </Text>
      </Box>
    </Box>
  );
}
