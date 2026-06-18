import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

const PATH =
  'M42.2 0H63.8A7.2 7.2 0 0 1 71 7.2V28.8A7.2 7.2 0 0 1 63.8 36H42.2C38.8 36 36 38.8 36 42.2V63.8A7.2 7.2 0 0 1 28.8 71H7.2A7.2 7.2 0 0 1 0 63.8V42.2A7.2 7.2 0 0 1 7.2 35H28.8C32.2 35 35 32.2 35 28.8V7.2A7.2 7.2 0 0 1 42.2 0Z'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#F4F4F1',
        }}
      >
        <svg width="126" height="126" viewBox="0 0 148 148">
          <path fill="#0B2529" d={PATH} />
          <path fill="#0B2529" d={PATH} transform="rotate(90 74 74)" />
          <path fill="#0B2529" d={PATH} transform="rotate(180 74 74)" />
          <path fill="#0B2529" d={PATH} transform="rotate(270 74 74)" />
        </svg>
      </div>
    ),
    { ...size },
  )
}
