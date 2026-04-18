import { BrifoMark, IconInstagram, IconLinkedIn } from "../lib/design";

export function Footer() {
  return (
    <footer
      className="px-6 py-10 md:px-12 md:py-12"
      style={{
        background: "var(--color-subtle)",
        borderTop: "1px solid var(--color-border)",
      }}
    >
      <div className="mx-auto max-w-6xl flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
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
          </div>
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

        {/* Social + copyright */}
        <div className="flex items-center gap-4">
          <a
            href="https://instagram.com/brifo.in"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
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
          <span
            className="text-[11px]"
            style={{ color: "var(--color-fg-subtle)" }}
          >
            &copy; {new Date().getFullYear()} Brifo
          </span>
        </div>
      </div>
    </footer>
  );
}
