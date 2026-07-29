// Brand atoms (BRAND_COLORS, EASE_SAVIA) now live in the shared package —
// re-exported here so existing `@/lib/constants` import sites keep working with
// a single source of truth.
export { BRAND_COLORS, EASE_SAVIA } from '@savia-os/ui';

// Landing-specific content stays local.
export const NAV_ITEMS = [
  { label: 'Inicio', href: '#inicio' },
  { label: 'Cómo funciona', href: '#flujo' },
  { label: 'Plug & play', href: '#integraciones' },
  { label: 'Control', href: '#control' },
  { label: 'Planes', href: '#planes' },
] as const;

export const COMMUNITY_AVATARS = [
  { label: 'AI', bg: '#0B2529', fg: '#F4F4F1' },
  { label: 'UX', bg: '#1A4A4E', fg: '#F4F4F1' },
  { label: 'PM', bg: '#E7FF18', fg: '#0B2529' },
  { label: 'DV', bg: '#53606C', fg: '#F4F4F1' },
] as const;

export const COMMUNITY_COUNT = '+1,000';
