import { ImageResponse } from 'next/og';

export const alt = 'Savia — La memoria que conecta todas tus IAs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          background: '#0B2529',
          padding: '80px',
          gap: '40px',
        }}
      >
        {/* Lime glow accent */}
        <div
          style={{
            position: 'absolute',
            top: '-120px',
            left: '50%',
            width: '600px',
            height: '600px',
            background: 'radial-gradient(ellipse at center, rgba(231,255,24,0.12) 0%, transparent 70%)',
            transform: 'translateX(-50%)',
          }}
        />

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: '#E7FF18',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 26,
              fontWeight: 900,
              color: '#0B2529',
            }}
          >
            S
          </div>
          <span
            style={{
              color: '#F4F4F1',
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: '0.1em',
            }}
          >
            SAVIA
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '20px',
            textAlign: 'center',
          }}
        >
          <span
            style={{
              color: 'rgba(244,244,241,0.65)',
              fontSize: 58,
              fontWeight: 300,
              lineHeight: 1,
              letterSpacing: '-0.02em',
              maxWidth: 840,
            }}
          >
            La memoria que{' '}
            <span style={{ fontWeight: 700, color: '#F4F4F1' }}>conecta</span>{' '}
            todas tus IAs.
          </span>
          <span
            style={{
              color: 'rgba(244,244,241,0.35)',
              fontSize: 22,
              fontWeight: 300,
              letterSpacing: '0.04em',
            }}
          >
            savia.dev
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
