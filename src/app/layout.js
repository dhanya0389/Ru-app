import './globals.css'
import ThemeLoader from '@/components/ThemeLoader'
import ThemePicker from '@/components/ThemePicker'
import { Analytics } from '@vercel/analytics/next'

export const metadata = {
  title: 'Ruhi — Your Health System',
  description: 'A personal health system built around your body, your cycle, your life.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="font-sans min-h-screen bg-ruhi-cream">
        <ThemeLoader />
        {children}
        <ThemePicker />
        <Analytics />
      </body>
    </html>
  )
}
