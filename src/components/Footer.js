// Site-wide footer. Currently surfaces a feedback hyperlink — the only
// channel real users have to reach us until Phase 2 brings a proper auth +
// in-app feedback widget. Placement: inside <main>, sits below the active
// screen's content. Print-hidden so PDFs don't carry the link.
//
// Volume bump (post-PR #24): the original footer was too quiet — small
// text in muted ruhi-earth/80 — so users weren't catching it. Option A
// from the prominence pass: same position but bigger text (text-sm),
// darker tone (ruhi-deep), small envelope icon prefix, and a hairline
// divider above so it visually separates from the screen content.
//
// Theme alignment: every color uses a `ruhi-*` Tailwind class which is
// backed by CSS custom properties (--ruhi-deep, --ruhi-earth, etc.).
// ThemeLoader rewrites those properties on theme switch, so the footer
// automatically retints — no theme-specific code needed here.

export default function Footer() {
  return (
    <footer
      data-no-print
      role="contentinfo"
      className="w-full border-t border-ruhi-earth/15 mt-4 py-5 px-4
                 text-center text-sm text-ruhi-deep flex items-center
                 justify-center gap-2"
    >
      <MailIcon />
      <span>
        Got{' '}
        <a
          href="mailto:feedback@tryruhi.ai?subject=Ruhi%20feedback"
          className="font-medium underline underline-offset-2 decoration-ruhi-deep/50
                     hover:decoration-ruhi-deep transition-colors"
        >
          feedback
        </a>
        ? We&apos;re listening.
      </span>
      {/* Privacy link sits next to feedback so users have a one-tap path to
          understand what we do with their data. Same row, low-key separator,
          keeps the footer to one line on most viewports. */}
      <span aria-hidden="true" className="text-ruhi-earth/40">·</span>
      <a
        href="/privacy"
        className="font-medium underline underline-offset-2 decoration-ruhi-deep/50
                   hover:decoration-ruhi-deep transition-colors"
      >
        Privacy
      </a>
    </footer>
  )
}

function MailIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="flex-shrink-0 text-ruhi-earth"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  )
}
