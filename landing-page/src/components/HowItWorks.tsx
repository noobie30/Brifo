import { useInView } from "../hooks/useInView";

const steps = [
  {
    number: "01",
    title: "Join your meeting",
    description:
      "Open Zoom, Google Meet, or Teams as usual. Brifo detects it automatically and starts listening. No setup required.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
      </svg>
    ),
  },
  {
    number: "02",
    title: "Brifo captures everything",
    description:
      "Audio is transcribed in real-time with speaker identification. Take your own notes or don't. Brifo has you covered either way.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
      </svg>
    ),
  },
  {
    number: "03",
    title: "Get notes & tasks",
    description:
      "AI-generated summary with decisions, action items, and follow-ups. Push tasks to Jira with one click. Ready before you close the call.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
      </svg>
    ),
  },
];

export function HowItWorks() {
  const ref = useInView();

  return (
    <section id="how-it-works" className="bg-white px-6 py-20 md:px-12 md:py-24">
      <div ref={ref} className="mx-auto max-w-6xl">
        <div className="mb-14 text-center" data-animate>
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-gray-400">
            How it works
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
            Three steps. Zero effort.
          </h2>
        </div>

        <div className="grid gap-8 md:grid-cols-3 md:gap-6">
          {steps.map((step, i) => (
            <div
              key={step.number}
              data-animate
              data-delay={i + 1}
              className="relative text-center md:text-left"
            >
              {/* Connector line (desktop only) */}
              {i < steps.length - 1 && (
                <div className="absolute right-0 top-8 hidden h-px w-full translate-x-1/2 bg-gray-200 md:block" />
              )}

              <div className="relative mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-900 text-white">
                {step.icon}
              </div>

              <p className="mb-1 text-xs font-bold uppercase tracking-widest text-gray-400">
                Step {step.number}
              </p>
              <h3 className="mb-2.5 text-lg font-semibold tracking-tight text-gray-900">
                {step.title}
              </h3>
              <p className="text-sm leading-relaxed text-gray-500">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
