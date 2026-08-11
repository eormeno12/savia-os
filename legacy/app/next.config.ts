import type { NextConfig } from "next";

// Hosts allowed to reach the dev server cross-origin (HMR + /_next assets).
// Next 16 blocks these by default; the devtunnel host must be listed explicitly.
// Set DEV_TUNNEL_HOST (hostname only, no protocol) when the tunnel URL changes.
const DEV_TUNNEL_HOST = process.env.DEV_TUNNEL_HOST ?? "51pxqv5q-4345.brs.devtunnels.ms";

// Where the NestJS API listens locally. The rewrite below proxies /api/* to it
// so the browser only ever talks to the app's own origin (the tunnel over HTTPS):
// first-party cookies, no CORS, no mixed content.
const API_UPSTREAM = process.env.API_UPSTREAM ?? "http://127.0.0.1:4400";

const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

// Legacy routes superseded by the redesign IA. Kept as redirects so old links /
// bookmarks resolve to the new surfaces instead of the orphaned pre-redesign UI.
const LEGACY_REDIRECTS = [
  { source: "/dashboard", destination: "/pulso" },
  { source: "/spaces", destination: "/memoria" },
  { source: "/drive", destination: "/fuentes" },
  { source: "/connect", destination: "/conexiones" },
  { source: "/connections", destination: "/conexiones" },
];

const nextConfig: NextConfig = {
  transpilePackages: ["@savia-os/design-tokens", "@savia-os/ui"],
  allowedDevOrigins: [DEV_TUNNEL_HOST],
  async headers() {
    return [{ source: "/(.*)", headers: SECURITY_HEADERS }];
  },
  async redirects() {
    return LEGACY_REDIRECTS.map((r) => ({ ...r, permanent: false }));
  },
  async rewrites() {
    // Proxy /api/* → NestJS, stripping the /api prefix (API routes live at root).
    return [{ source: "/api/:path*", destination: `${API_UPSTREAM}/:path*` }];
  },
};

export default nextConfig;
