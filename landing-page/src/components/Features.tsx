import { useInView } from "../hooks/useInView";

const features = [
  {
    title: "Notes that actually capture what matters",
    description:
      "Not another generic transcript summary. Brifo picks up on decisions, open questions, and commitments so you get notes worth reading.",
    icon: (
      <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      </svg>
    ),
  },
  {
    title: "Tasks pulled straight from the conversation",
    description:
      "Action items get extracted automatically and can be pushed to Jira. No more digging through notes to figure out who said they'd do what.",
    icon: (
      <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
  {
    title: "Runs quietly on your Mac",
    description:
      "Brifo lives in your menu bar and picks up meetings automatically. It captures audio locally on your machine, not through some browser plugin.",
    icon: (
      <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25A2.25 2.25 0 0 1 5.25 3h13.5A2.25 2.25 0 0 1 21 5.25Z" />
      </svg>
    ),
  },
];

export function Features() {
  const ref = useInView();

  return (
    <section id="features" className="bg-gray-50 px-6 py-20 md:px-12 md:py-24">
      <div ref={ref} className="mx-auto max-w-6xl">
        <div className="grid gap-5 md:grid-cols-3">
          {features.map((feature, i) => (
            <div
              key={feature.title}
              data-animate
              data-delay={i + 1}
              className="rounded-2xl border border-gray-100 bg-white p-8"
            >
              <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50">
                {feature.icon}
              </div>
              <h3 className="mb-2.5 text-base font-semibold tracking-tight text-gray-900">
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-gray-500">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
