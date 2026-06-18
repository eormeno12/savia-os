import { LinkButton } from '@/components/ui/button';
import type { ButtonProps } from '@chakra-ui/react';

type CtaButtonProps = Pick<ButtonProps, 'size' | 'w' | 'onClick'> & {
  children?: React.ReactNode;
};

export function CtaButton({ children = 'Solicitar acceso', ...props }: CtaButtonProps) {
  return (
    <LinkButton href="#comunidad" colorPalette="lime" {...props}>
      {children}
    </LinkButton>
  );
}
