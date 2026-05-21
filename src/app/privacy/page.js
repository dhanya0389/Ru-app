// /privacy — plain-English data-handling page (PR #32).
//
// Linked from the site footer. Single screen, no legalese, written from
// Dhanya as the founder so it reads like a person not a policy. Anything
// that changes the substance (storage location, training stance, who has
// access) should also update the in-app copy and the migration docs so
// the three sources stay in sync.

export const metadata = {
  title: 'Your data on Ruhi',
  description:
    'How Ruhi handles your data — what we collect, where it lives, who can see it, and how to delete it.',
}

export default function PrivacyPage() {
  return (
    <article className="max-w-2xl mx-auto px-5 py-10 sm:py-14 text-ruhi-deep">
      <h1 className="text-3xl sm:text-4xl font-semibold mb-3">Your data on Ruhi</h1>

      <p className="text-base sm:text-lg leading-relaxed mb-8 text-ruhi-earth">
        Short version: your data is yours, it stays where you put it, and nothing
        about you is used to train AI models.
      </p>

      <Section title="What we collect">
        <p>
          Only what you tell us. Your profile (diet, cycle, goals), your journal
          entries, your meal plans, your pantry. There&apos;s no hidden tracking,
          no third-party ads, no analytics that follow you around the web.
        </p>
      </Section>

      <Section title="Where it lives">
        <p>
          <strong>If you don&apos;t sign in:</strong> everything stays on your
          device, in your browser. We never see it. Clearing your browser data
          clears Ruhi.
        </p>
        <p>
          <strong>If you sign in:</strong> your profile is also saved to
          Ruhi&apos;s database (hosted on Supabase, on AWS servers in the United
          States). This is what lets you switch devices without losing your
          setup. Journal, plans, and pantry are coming to the cloud in a future
          update — until then they stay on-device.
        </p>
      </Section>

      <Section title="About the AI">
        <p>
          Ruhi uses Anthropic&apos;s Claude to generate meal ideas, reflect on
          your journal entries, and read your pantry photos. When Ruhi calls
          Claude, your data is sent over an encrypted connection, Claude
          responds, and the conversation ends there.{' '}
          <strong>
            Anthropic does not train its models on what Ruhi sends them
          </strong>{' '}
          — that&apos;s a contractual guarantee in their API terms, separate from
          how their consumer chat product works.
        </p>
        <p>
          Voice journals use your browser&apos;s built-in speech recognition. The
          audio never leaves your device.
        </p>
      </Section>

      <Section title="Who can see your data">
        <ul className="list-disc pl-6 space-y-1">
          <li>
            <strong>You.</strong>
          </li>
          <li>
            <strong>Dhanya, the founder</strong> — has database access to fix
            bugs and help with support. Treated with the same care you&apos;d
            expect from a small founder-run app.
          </li>
          <li>
            <strong>No one else.</strong> Other Ruhi users cannot see your data.
            Our database enforces this at the row level — even if someone got
            hold of our public API key, they couldn&apos;t read anyone else&apos;s
            rows.
          </li>
        </ul>
      </Section>

      <Section title="Deleting your data">
        <p>
          <strong>On your device:</strong> Menu → Edit profile → Reset everything
          wipes your locally stored data on this device.
        </p>
        <p>
          <strong>In the cloud:</strong> Menu → Delete my data removes your
          account and everything associated with it. This is permanent.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          If we ever change how data is handled, we&apos;ll update this page and
          tell you in the app before the change takes effect.
        </p>
      </Section>

      <Section title="Questions">
        <p>
          Email{' '}
          <a
            href="mailto:hello@tryruhi.ai?subject=Privacy%20question"
            className="font-medium underline underline-offset-2 decoration-ruhi-deep/50 hover:decoration-ruhi-deep transition-colors"
          >
            hello@tryruhi.ai
          </a>{' '}
          — Dhanya answers personally.
        </p>
      </Section>

      <p className="mt-12 text-sm text-ruhi-earth/80">
        Last updated: May 20, 2026
      </p>
    </article>
  )
}

function Section({ title, children }) {
  return (
    <section className="mb-7 sm:mb-8">
      <h2 className="text-lg sm:text-xl font-semibold mb-2 text-ruhi-deep">
        {title}
      </h2>
      <div className="space-y-3 text-base leading-relaxed text-ruhi-earth">
        {children}
      </div>
    </section>
  )
}
