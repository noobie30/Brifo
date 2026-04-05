import { useInView } from "../hooks/useInView";

export function CallToAction() {
  const downloadUrl = import.meta.env.VITE_DOWNLOAD_URL || "#download";
  const ref = useInView();

  return (
    <section className="bg-gray-900 px-6 py-20 md:px-12 md:py-24">
      <div
        ref={ref}
        data-animate
        className="mx-auto max-w-xl text-center"
      >
        <h2 className="mb-4 text-2xl font-bold tracking-tight text-white md:text-3xl">
          Try it on your next meeting
        </h2>
        <p className="mb-8 text-base leading-relaxed text-gray-400">
          Free to download. Takes about a minute to set up.
        </p>
        <a
          href={downloadUrl}
          download
          className="inline-block rounded-xl bg-white px-7 py-3.5 text-[15px] font-semibold text-gray-900 transition-colors hover:bg-gray-100"
        >
          Download for Mac
        </a>
      </div>
    </section>
  );
}
