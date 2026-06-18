import { Stack, Text } from '@chakra-ui/react';
import type { BoxProps } from '@chakra-ui/react';

type SectionHeaderProps = {
  eyebrow: string;
  headline: React.ReactNode;
  description?: React.ReactNode;
  descriptionMaxW?: string;
  maxW?: BoxProps['maxW'];
  mb?: BoxProps['mb'];
};

export function SectionHeader({
  eyebrow,
  headline,
  description,
  descriptionMaxW = '32rem',
  maxW = 'containerNarrow',
  mb,
}: SectionHeaderProps) {
  return (
    <Stack gap="5" maxW={maxW} mb={mb}>
      <Text
        textStyle="label"
        fontWeight="700"
        color="fg.muted"
      >
        {eyebrow}
      </Text>
      <Text
        as="h2"
        fontSize={{ base: 'displayLg', lg: 'display2xl' }}
        fontWeight="300"
        lineHeight="0.95"
        color="fg.muted"
        textWrap="balance"
      >
        {headline}
      </Text>
      {description && (
        <Text
          fontSize="bodyLg"
          color="fg.muted"
          lineHeight="1.65"
          maxW={descriptionMaxW}
          textWrap="pretty"
        >
          {description}
        </Text>
      )}
    </Stack>
  );
}
