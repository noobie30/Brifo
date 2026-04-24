import { BrifoMark, IconInstagram, IconLinkedIn } from "../lib/design";
import { trackSocialClick } from "../lib/analytics";

export function Footer() {
  return (
    <footer
      className="px-6 py-10 md:px-12 md:py-12"
      style={{
        background: "var(--color-subtle)",
        borderTop: "1px solid var(--color-border)",
      }}
    >
      <div className="mx-auto max-w-6xl flex flex-col gap-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <BrifoMark size={24} />
            <div className="flex flex-col">
              <span
                className="text-[13.5px] font-semibold tracking-[-0.2px]"
                style={{ color: "var(--color-fg)" }}
              >
                Brifo
              </span>
              <span
                className="text-[11.5px] mt-0.5"
                style={{ color: "var(--color-fg-muted)" }}
              >
                AI meeting notes for Mac
              </span>
            </div>
          </div>

          {/* Site nav — hidden from sighted users but visible to crawlers,
              AI agents, and screen readers. Gives search engines + LLMs a
              clean internal link graph to every page of the site. */}
          <nav aria-label="Site" className="sr-only">
            <h2>Brifo</h2>
            <a href="/about">About Brifo</a>
            <a href="/privacy">Privacy policy</a>
            <a href="/terms">Terms of use</a>
            <h2>Compare Brifo</h2>
            <a href="/compare">All comparisons</a>
            <a href="/compare/brifo-vs-otter">Brifo vs Otter.ai</a>
            <a href="/compare/brifo-vs-granola">Brifo vs Granola</a>
            <a href="/compare/brifo-vs-fireflies">Brifo vs Fireflies.ai</a>
          </nav>
        </div>

        {/* Agent discovery links — kept in the DOM (so crawlers / scraping
            agents see them), but visually hidden from sighted users. The
            canonical discovery is still via Link headers + /.well-known,
            but some agents only parse HTML, so we leave a breadcrumb. */}
        <nav
          aria-label="For agents"
          className="sr-only"
        >
          <span>For agents:</span>
          <a href="/llms.txt" rel="alternate" type="text/plain">
            llms.txt
          </a>
          <a href="/llms-full.txt" rel="alternate" type="text/plain">
            llms-full.txt
          </a>
          <a
            href="/.well-known/api-catalog"
            rel="api-catalog"
            type="application/linkset+json"
          >
            API catalog
          </a>
          <a
            href="/.well-known/agent-skills/index.json"
            rel="https://agentskills.io/rel/index"
            type="application/json"
          >
            Agent skills index
          </a>
          <a
            href="/index.md"
            rel="alternate"
            type="text/markdown"
          >
            Markdown version
          </a>
        </nav>

        <div
          className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between pt-6"
          style={{ borderTop: "1px solid var(--color-divider)" }}
        >
          <span
            className="text-[11.5px]"
            style={{ color: "var(--color-fg-subtle)" }}
          >
            &copy; {new Date().getFullYear()} Brifo &middot; AI meeting notes for Mac
          </span>
          <div className="flex items-center gap-4">
            <a
              href="https://instagram.com/brifo.in"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              onClick={() => trackSocialClick("instagram")}
              className="transition-colors"
              style={{ color: "var(--color-fg-subtle)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = "var(--color-fg)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = "var(--color-fg-subtle)")
              }
            >
              <IconInstagram size={16} />
            </a>
            <a
              href="https://linkedin.com/company/brifoapp"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
              onClick={() => trackSocialClick("linkedin")}
              className="transition-colors"
              style={{ color: "var(--color-fg-subtle)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = "var(--color-fg)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = "var(--color-fg-subtle)")
              }
            >
              <IconLinkedIn size={16} />
            </a>
            <a
              href="https://github.com/noobie30/Brifo"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              onClick={() => trackSocialClick("github")}
              className="transition-colors"
              style={{ color: "var(--color-fg-subtle)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = "var(--color-fg)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = "var(--color-fg-subtle)")
              }
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
