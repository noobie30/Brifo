import { useInView } from "../hooks/useInView";

const steps = [
  {
    number: "01",
    title: "Open the app",
    description:
      "Launch Brifo and leave it running. It sits in your menu bar and detects meetings on its own.",
  },
  {
    number: "02",
    title: "Talk like you normally would",
    description:
      "Use Zoom, Google Meet, whatever you like. Brifo records audio from your Mac. Nobody sees a bot join.",
  },
  {
    number: "03",
    title: "Review what happened",
    description:
      "When the meeting ends, your notes are ready. Key points, action items, and the full transcript.",
  },
];

export function HowItWorks() {
  const ref = useInView();

  return (
    <section id="how-it-works" className="bg-white px-6 py-20 md:px-12 md:py-24">
      <div ref={ref} className="mx-auto max-w-3xl">
        <h2 className="mb-12 text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">
          How it works
        </h2>

        <div className="space-y-10">
          {steps.map((step, i) => (
            <div
              key={step.number}
              data-animate
              data-delay={i + 1}
              className="flex gap-6"
            >
              <span className="shrink-0 pt-0.5 text-sm font-medium tabular-nums text-gray-300">
                {step.number}
              </span>
              <div>
                <h3 className="mb-1.5 text-base font-semibold text-gray-900">
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed text-gray-500">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
