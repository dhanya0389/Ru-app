// Web App Manifest. Next.js auto-serves this at /manifest.webmanifest.
// Read by Android Chrome/Edge/Samsung Internet for the install prompt;
// iOS Safari reads it for app name + theme color but uses apple-touch-icon
// (defined via app/apple-icon) for the home-screen icon itself.
//
// `display: 'standalone'` is the key field — once installed, opening the
// icon from the home screen launches Ruhi without the browser chrome,
// matching native app feel.

export default function manifest() {
  return {
    name: 'Ruhi — Your Health System',
    short_name: 'Ruhi',
    description: 'A cycle-synced personal health system — meals, movement, journal, all built around your body.',
    start_url: '/',
    display: 'standalone',
    background_color: '#FFF8F0',
    theme_color: '#FFF8F0',
    orientation: 'portrait',
    categories: ['health', 'lifestyle', 'food'],
    // Icons resolved dynamically — Next.js generates the install icon from
    // app/icon.js (512x512 PNG via ImageResponse). The runtime path is /icon
    // and the file is served as image/png. iOS uses app/apple-icon.js
    // separately via the apple-touch-icon link tag (auto-injected).
    icons: [
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
