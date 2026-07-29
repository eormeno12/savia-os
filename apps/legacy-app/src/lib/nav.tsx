import type { ReactNode } from "react";

/**
 * Primary product navigation (Shell rail). Order and icons mirror the mockup S1.
 * Icons are inline stroke SVGs (stroke=currentColor) so the active NavItem's
 * lime color flows into them.
 */
export interface NavEntry {
  href: string;
  label: string;
  icon: ReactNode;
}

const iconProps = {
  width: 19,
  height: 19,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const NAV_ENTRIES: NavEntry[] = [
  {
    href: "/memoria",
    label: "Memoria",
    icon: (
      <svg {...iconProps}>
        <circle cx="9" cy="9" r="5" />
        <circle cx="17" cy="16" r="3.2" />
      </svg>
    ),
  },
  {
    href: "/pulso",
    label: "Pulso",
    icon: (
      <svg {...iconProps}>
        <path d="M3 12h4l2.5-7 5 14 2.5-7H21" />
      </svg>
    ),
  },
  {
    href: "/conexiones",
    label: "Conexiones",
    icon: (
      <svg {...iconProps}>
        <path d="M8 7l-3 3a3.5 3.5 0 005 5l2-2M16 17l3-3a3.5 3.5 0 00-5-5l-2 2" />
      </svg>
    ),
  },
  {
    href: "/fuentes",
    label: "Fuentes",
    icon: (
      <svg {...iconProps}>
        <path d="M12 15V4m0 0L8 8m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
      </svg>
    ),
  },
];

/** True when `pathname` is within `href` (exact or nested segment). */
export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}
