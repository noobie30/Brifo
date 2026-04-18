import type { ReactNode } from "react";
import { useInView } from "../hooks/useInView";
import { Eyebrow } from "../lib/design";

type Platform = {
  name: string;
  icon: ReactNode;
  /** Brand hover tint, used subtly — base color is muted fg. */
  hover: string;
};

const platforms: Platform[] = [
  {
    name: "Google Meet",
    hover: "#00AC47",
    icon: (
      <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l7 4.5-7 4.5z" />
      </svg>
    ),
  },
  {
    name: "Zoom",
    hover: "#2D8CFF",
    icon: (
      <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
        <path d="M4.5 4.5h10.8c1.32 0 2.4 1.08 2.4 2.4v4.8l3.9-2.7v7l-3.9-2.7v.6c0 1.32-1.08 2.4-2.4 2.4H4.5c-1.32 0-2.4-1.08-2.4-2.4V6.9c0-1.32 1.08-2.4 2.4-2.4z" />
      </svg>
    ),
  },
  {
    name: "Microsoft Teams",
    hover: "#4B53BC",
    icon: (
      <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
        <path d="M19.5 3h-15A1.5 1.5 0 0 0 3 4.5v15A1.5 1.5 0 0 0 4.5 21h15a1.5 1.5 0 0 0 1.5-1.5v-15A1.5 1.5 0 0 0 19.5 3zM8 17H6v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-5h2v5z" />
      </svg>
    ),
  },
  {
    name: "Slack",
    hover: "#ECB22E",
    icon: (
      <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
        <path d="M6 15a2 2 0 0 1-2 2 2 2 0 0 1-2-2 2 2 0 0 1 2-2h2v2zm1 0a2 2 0 0 1 2-2 2 2 0 0 1 2 2v5a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-5zm2-8a2 2 0 0 1-2-2 2 2 0 0 1 2-2 2 2 0 0 1 2 2v2H9zm0 1a2 2 0 0 1 2 2 2 2 0 0 1-2 2H4a2 2 0 0 1-2-2 2 2 0 0 1 2-2h5zm8 2a2 2 0 0 1 2-2 2 2 0 0 1 2 2 2 2 0 0 1-2 2h-2v-2zm-1 0a2 2 0 0 1-2 2 2 2 0 0 1-2-2V5a2 2 0 0 1 2-2 2 2 0 0 1 2 2v5zm-2 8a2 2 0 0 1 2 2 2 2 0 0 1-2 2 2 2 0 0 1-2-2v-2h2zm0-1a2 2 0 0 1-2-2 2 2 0 0 1 2-2h5a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-5z" />
      </svg>
    ),
  },
  {
    name: "Jira",
    hover: "#2684FF",
    icon: (
      <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
        <path d="M12.005 2 6.2 7.78l5.805 5.805 5.805-5.805L12.005 2zm-5.805 5.78L.4 13.585l5.8 5.805L12.005 13.585 6.2 7.78zm11.61 0-5.805 5.805 5.805 5.805 5.8-5.805-5.8-5.805z" />
      </svg>
    ),
  },
];

export function Integrations() {
  const ref = useInView();

  return (
    <section
      id="integrations"
      className="px-6 py-16 md:px-12 md:py-20"
      style={{ background: "var(--color-canvas)" }}
    >
      <div ref={ref} className="mx-auto max-w-4xl text-center">
        <div data-animate>
          <Eyebrow className="mb-8">Works with the tools you already use</Eyebrow>
        </div>

        <div
          className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6 md:gap-x-12 rounded-[14px] px-6 py-8 md:py-10"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
          }}
          data-animate
          data-delay={1}
        >
          {platforms.map((platform) => (
            <div
              key={platform.name}
              className="group flex flex-col items-center gap-2 transition-colors duration-150"
              style={{
                color: "var(--color-fg-subtle)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = platform.hover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--color-fg-subtle)";
              }}
            >
              {platform.icon}
              <span
                className="text-[11.5px] font-medium"
                style={{ color: "var(--color-fg-muted)" }}
              >
                {platform.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
