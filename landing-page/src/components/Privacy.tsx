import { useInView } from "../hooks/useInView";

export function Privacy() {
  const ref = useInView();

  return (
    <section id="privacy" className="bg-gray-50 px-6 py-20 md:px-12 md:py-24">
      <div
        ref={ref}
        data-animate
        className="mx-auto max-w-3xl"
      >
        <h2 className="mb-4 text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">
          Your meetings stay yours
        </h2>
        <p className="max-w-xl text-base leading-relaxed text-gray-500">
          Brifo records audio directly from your Mac. Nothing joins the call,
          nothing records your screen, and your colleagues don't need to know
          it's there. We built it this way on purpose.
        </p>
      </div>
    </section>
  );
}
