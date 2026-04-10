import { useInView } from "../hooks/useInView";

const platforms = [
  {
    name: "Google Meet",
    icon: (
      <svg className="h-7 w-7" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l7 4.5-7 4.5z" />
      </svg>
    ),
  },
  {
    name: "Zoom",
    icon: (
      <svg className="h-7 w-7" viewBox="0 0 24 24" fill="currentColor">
        <path d="M4.5 4.5h10.8c1.32 0 2.4 1.08 2.4 2.4v4.8l3.9-2.7v7l-3.9-2.7v.6c0 1.32-1.08 2.4-2.4 2.4H4.5c-1.32 0-2.4-1.08-2.4-2.4V6.9c0-1.32 1.08-2.4 2.4-2.4z" />
      </svg>
    ),
  },
  {
    name: "Microsoft Teams",
    icon: (
      <svg className="h-7 w-7" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.5 3h-15A1.5 1.5 0 0 0 3 4.5v15A1.5 1.5 0 0 0 4.5 21h15a1.5 1.5 0 0 0 1.5-1.5v-15A1.5 1.5 0 0 0 19.5 3zM8 17H6v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-5h2v5z" />
      </svg>
    ),
  },
  {
    name: "Slack",
    icon: (
      <svg className="h-7 w-7" viewBox="0 0 24 24" fill="currentColor">
        <path d="M6 15a2 2 0 0 1-2 2 2 2 0 0 1-2-2 2 2 0 0 1 2-2h2v2zm1 0a2 2 0 0 1 2-2 2 2 0 0 1 2 2v5a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-5zm2-8a2 2 0 0 1-2-2 2 2 0 0 1 2-2 2 2 0 0 1 2 2v2H9zm0 1a2 2 0 0 1 2 2 2 2 0 0 1-2 2H4a2 2 0 0 1-2-2 2 2 0 0 1 2-2h5zm8 2a2 2 0 0 1 2-2 2 2 0 0 1 2 2 2 2 0 0 1-2 2h-2v-2zm-1 0a2 2 0 0 1-2 2 2 2 0 0 1-2-2V5a2 2 0 0 1 2-2 2 2 0 0 1 2 2v5zm-2 8a2 2 0 0 1 2 2 2 2 0 0 1-2 2 2 2 0 0 1-2-2v-2h2zm0-1a2 2 0 0 1-2-2 2 2 0 0 1 2-2h5a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-5z" />
      </svg>
    ),
  },
  {
    name: "Jira",
    icon: (
      <svg className="h-7 w-7" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.005 2 6.2 7.78l5.805 5.805 5.805-5.805L12.005 2zm-5.805 5.78L.4 13.585l5.8 5.805L12.005 13.585 6.2 7.78zm11.61 0-5.805 5.805 5.805 5.805 5.8-5.805-5.8-5.805z" />
      </svg>
    ),
  },
];

export function Integrations() {
  const ref = useInView();

  return (
    <section className="bg-white px-6 py-16 md:px-12 md:py-20">
      <div ref={ref} className="mx-auto max-w-4xl text-center">
        <p
          className="mb-10 text-sm font-medium text-gray-400"
          data-animate
        >
          Works with the tools you already use
        </p>

        <div
          className="flex flex-wrap items-center justify-center gap-8 md:gap-12"
          data-animate
          data-delay={1}
        >
          {platforms.map((platform) => (
            <div
              key={platform.name}
              className="flex flex-col items-center gap-2 text-gray-300 transition-colors hover:text-gray-500"
            >
              {platform.icon}
              <span className="text-xs font-medium text-gray-400">
                {platform.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
