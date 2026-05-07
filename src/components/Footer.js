// Site-wide footer. Currently surfaces a feedback hyperlink — the only
// channel real users have to reach us until Phase 2 brings a proper auth +
// in-app feedback widget. Placement: inside <main>, sits below the active
// screen's content. Print-hidden so PDFs don't carry the link.
//
// Pattern: subtle but findable. Small text, ruhi-earth, centered. The word
// "feedback" itself is the link target so the eye lands on the action verb.

export default function Footer() {
  return (
    <footer
      data-no-print
      role="contentinfo"
      className="w-full text-center py-6 px-4 text-[11px] text-ruhi-earth/80"
    >
      Got{' '}
      <a
        href="mailto:feedback@tryruhi.ai?subject=Ruhi%20feedback"
        className="text-ruhi-deep underline underline-offset-2 hover:text-ruhi-earth transition-colors"
      >
        feedback
      </a>
      ?
    </footer>
  )
}
