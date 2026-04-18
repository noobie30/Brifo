import type { ReactNode } from "react";
import { useInView } from "../hooks/useInView";
import { Eyebrow, IconMic, IconSparkles, IconVideo } from "../lib/design";

type Step = {
  number: string;
  title: string;
  description: string;
  icon: ReactNode;
};

const steps: Step[] = [
  {
    number: "01",
    title: "Join your meeting",
    description:
      "Open Zoom, Google Meet, or Teams as usual. Brifo detects it automatically and starts listening. No setup required.",
    icon: <IconVideo size={18} />,
  },
  {
    number: "02",
    title: "Brifo captures everything",
    description:
      "Audio is transcribed in real-time with speaker identification. Take your own notes or don't, Brifo has you covered either way.",
    icon: <IconMic size={18} />,
  },
  {
    number: "03",
    title: "Get notes & tasks",
    description:
      "AI-generated summary with decisions, action items, and follow-ups. Push tasks to Jira with one click, ready before you close the call.",
    icon: <IconSparkles size={18} />,
  },
];

export function HowItWorks() {
  const ref = useInView();

  return (
    <section
      id="how-it-works"
      className="px-6 py-20 md:px-12 md:py-24"
      style={{ background: "var(--color-canvas)" }}
    >
      <div ref={ref} className="mx-auto max-w-6xl">
        <div className="mb-12 text-center" data-animate>
          <Eyebrow className="mb-3">How it works</Eyebrow>
          <h2
            className="serif font-medium tracking-[-0.8px]"
            style={{
              color: "var(--color-fg)",
              fontSize: "clamp(30px, 4vw, 40px)",
              lineHeight: 1.1,
              margin: 0,
            }}
          >
            Three steps. Zero effort.
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-3 md:gap-5">
          {steps.map((step, i) => (
            <div
              key={step.number}
              data-animate
              data-delay={i + 1}
              className="relative flex flex-col gap-3 p-6"
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: 14,
              }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="inline-flex items-center justify-center rounded-[8px]"
                  style={{
                    width: 34,
                    height: 34,
                    background: "var(--color-accent-soft)",
                    color: "var(--color-accent)",
                  }}
                >
                  {step.icon}
                </div>
                <span
                  className="mono text-[11px] font-semibold tracking-[0.6px]"
                  style={{ color: "var(--color-accent)" }}
                >
                  STEP {step.number}
                </span>
              </div>

              <h3
                className="text-[17px] font-semibold tracking-[-0.2px]"
                style={{ color: "var(--color-fg)", margin: 0 }}
              >
                {step.title}
              </h3>

              <p
                className="text-[13.5px] leading-[1.6]"
                style={{ color: "var(--color-fg-muted)", margin: 0 }}
              >
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
