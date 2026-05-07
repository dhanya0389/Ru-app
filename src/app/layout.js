import './globals.css'
import ThemeLoader from '@/components/ThemeLoader'
import ThemePicker from '@/components/ThemePicker'
import Footer from '@/components/Footer'
import AuthProvider from '@/components/AuthProvider'
import { Analytics } from '@vercel/analytics/next'

// PWA + iOS app-like behavior:
// - manifestUrl is auto-served by Next.js from app/manifest.ts (Android +
//   modern browsers read this for the install prompt).
// - appleWebApp metadata adds the iOS-only meta tags so iOS Safari opens
//   the home-screen install fullscreen with our cream theme color.
// - themeColor matches --ruhi-cream for status-bar tinting on Android +
//   recent iOS, so the system chrome blends with the app background.
// - viewport sets the standard mobile-web-app posture and disables
//   user-scalable to avoid the iOS "double-tap to zoom" jitter that's
//   actively unhelpful in a content-list app.
export const metadata = {
  title: 'Ruhi — Your Health System',
  description: 'A personal health system built around your body, your cycle, your life.',
  applicationName: 'Ruhi',
  appleWebApp: {
    capable: true,
    title: 'Ruhi',
    statusBarStyle: 'default',
  },
  // Next.js outputs the modern `mobile-web-app-capable` from appleWebApp.
  // Older iOS Safari only honors the legacy `apple-mobile-web-app-capable`
  // name — adding it explicitly here so home-screen install opens fullscreen
  // on the older iOS versions still in the wild.
  other: {
    'apple-mobile-web-app-capable': 'yes',
  },
}

export const viewport = {
  themeColor: '#FFF8F0',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="font-sans min-h-screen bg-ruhi-cream flex flex-col">
        <AuthProvider>
          <ThemeLoader />
          <main className="flex-1">{children}</main>
          <Footer />
          <ThemePicker />
          <Analytics />
        </AuthProvider>
      </body>
    </html>
  )
}
