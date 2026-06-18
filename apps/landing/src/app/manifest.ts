import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Savia',
    short_name: 'Savia',
    description: 'La memoria que conecta todas tus IAs.',
    start_url: '/',
    display: 'browser',
    background_color: '#F4F4F1',
    theme_color: '#F4F4F1',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  }
}
