"use client";

import {
  Avatar as ChakraAvatar,
  AvatarGroup as ChakraAvatarGroup,
} from "@chakra-ui/react";
import { forwardRef } from "react";
import type { ImgHTMLAttributes, ReactElement, ReactNode } from "react";

export interface AvatarProps extends ChakraAvatar.RootProps {
  name?: string;
  src?: string;
  srcSet?: string;
  loading?: ImgHTMLAttributes<HTMLImageElement>["loading"];
  icon?: ReactElement;
  fallback?: ReactNode;
}

/**
 * Single-element avatar: shows the image, falling back to initials from `name`
 * (or a custom `fallback`/`icon`). Use `AvatarGroup` to stack members (CO2, CO5).
 */
export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(function Avatar(
  { name, src, srcSet, loading, icon, fallback, children, ...rest },
  ref,
) {
  return (
    <ChakraAvatar.Root ref={ref} {...rest}>
      <ChakraAvatar.Fallback name={name}>{fallback || icon}</ChakraAvatar.Fallback>
      <ChakraAvatar.Image src={src} srcSet={srcSet} loading={loading} />
      {children}
    </ChakraAvatar.Root>
  );
});

export const AvatarGroup = ChakraAvatarGroup;
