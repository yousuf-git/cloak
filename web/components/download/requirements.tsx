import { SITE } from "@/constants/site";
import { OPERATING_NOTES, REQUIREMENTS } from "@/content/download-content";

/**
 * What the setup below assumes, placed before it: whether you have a machine
 * that can run this at all is the question that decides whether the guide is
 * worth reading.
 */
export function Requirements() {
  return (
    <section id="requirements" className="border-t border-[var(--color-border)] py-16 sm:py-20">
      <header className="max-w-2xl">
        <p className="text-xs font-medium tracking-[0.14em] text-[var(--color-fg-subtle)] uppercase">
          Before you start
        </p>
        <h2 className="mt-3 font-display text-3xl tracking-tight text-[var(--color-fg)] sm:text-4xl">
          What you need
        </h2>
        <p className="mt-3 text-[1.0625rem] leading-relaxed text-[var(--color-fg-muted)]">
          The app runs on any current desktop. The server is a small Node.js process and a
          MongoDB — a laptop, a Raspberry Pi or a $5 VPS all do.
        </p>
      </header>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {REQUIREMENTS.map((group) => (
          <div
            key={group.title}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
          >
            <p className="text-sm font-semibold text-[var(--color-fg)]">{group.title}</p>
            <dl className="mt-3 space-y-2.5">
              {group.rows.map(([term, detail]) => (
                <div key={term}>
                  <dt className="text-xs tracking-wide text-[var(--color-fg-subtle)] uppercase">
                    {term}
                  </dt>
                  <dd className="text-[0.9375rem] text-[var(--color-fg-muted)]">{detail}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      <h3 className="mt-12 font-display text-2xl tracking-tight text-[var(--color-fg)]">
        Running it well
      </h3>
      <dl className="mt-5 grid gap-x-4 gap-y-0 sm:grid-cols-2">
        {OPERATING_NOTES.map((note) => (
          <div key={note.title} className="border-t border-[var(--color-border)] py-4">
            <dt className="text-[0.9375rem] font-semibold text-[var(--color-fg)]">{note.title}</dt>
            <dd className="mt-1 text-[0.9375rem] leading-relaxed text-[var(--color-fg-muted)]">
              {note.body}
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-6 text-sm text-[var(--color-fg-muted)]">
        Prefer to build it yourself?{" "}
        <a
          href={SITE.sourceBuildUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-4 hover:text-[var(--color-fg)]"
        >
          Development setup
        </a>{" "}
        covers the repository, and{" "}
        <a
          href={`${SITE.repo}/blob/main/docs/TEAMS_ARCHITECTURE.md`}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-4 hover:text-[var(--color-fg)]"
        >
          the architecture notes
        </a>{" "}
        explain how team keys work.
      </p>
    </section>
  );
}
