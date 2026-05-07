import { ImageResponse } from 'next/og'

// Programmatic Ruhi app icon. Next.js renders this at /icon (PNG) on
// demand — used by the manifest for Android home-screen installs and
// as the browser favicon. Same design as apple-icon, scaled.
//
// Design: a stylized lotus on a cream field. Cream + deep matches the
// app's primary palette (--ruhi-cream / --ruhi-deep). Square, balanced,
// reads at 16x16 favicon scale and 512x512 install scale.

export const size = { width: 512, height: 512 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#FFF8F0',
        }}
      >
        <svg width="380" height="380" viewBox="0 0 100 100" fill="none">
          {/* Outer petals */}
          <path d="M50 22 C 42 35, 42 48, 50 58 C 58 48, 58 35, 50 22 Z" fill="#4A3728" />
          <path d="M50 78 C 42 65, 42 52, 50 42 C 58 52, 58 65, 50 78 Z" fill="#4A3728" opacity="0.85" />
          <path d="M22 50 C 35 42, 48 42, 58 50 C 48 58, 35 58, 22 50 Z" fill="#4A3728" opacity="0.7" />
          <path d="M78 50 C 65 42, 52 42, 42 50 C 52 58, 65 58, 78 50 Z" fill="#4A3728" opacity="0.7" />
          {/* Diagonal petals */}
          <path d="M30 30 C 38 36, 46 44, 50 50 C 44 46, 36 38, 30 30 Z" fill="#735D42" opacity="0.6" />
          <path d="M70 30 C 62 36, 54 44, 50 50 C 56 46, 64 38, 70 30 Z" fill="#735D42" opacity="0.6" />
          <path d="M30 70 C 38 64, 46 56, 50 50 C 44 54, 36 62, 30 70 Z" fill="#735D42" opacity="0.6" />
          <path d="M70 70 C 62 64, 54 56, 50 50 C 56 54, 64 62, 70 70 Z" fill="#735D42" opacity="0.6" />
          {/* Center */}
          <circle cx="50" cy="50" r="6" fill="#4A3728" />
        </svg>
      </div>
    ),
    { ...size }
  )
}
