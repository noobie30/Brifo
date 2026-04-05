export function Hero() {
  const downloadUrl = import.meta.env.VITE_DOWNLOAD_URL || "#download";

  return (
    <section className="bg-white px-6 pb-20 pt-24 md:px-12 md:pb-24 md:pt-28">
      <div className="animate-hero mx-auto max-w-2xl text-center">
        <h1 className="mb-5 text-4xl font-bold leading-[1.1] tracking-tight text-gray-900 md:text-[52px]">
          Meeting notes that
          <br />
          write themselves
        </h1>
        <p className="mx-auto mb-9 max-w-lg text-lg leading-relaxed text-gray-500">
          Brifo listens to your meetings and writes up the notes so you don't
          have to. No bot joins the call. Nothing to install in your browser.
        </p>
        <a
          href={downloadUrl}
          download
          className="inline-block rounded-xl bg-gray-900 px-7 py-3.5 text-[15px] font-medium text-white transition-colors hover:bg-gray-800"
        >
          Download for Mac
        </a>
      </div>
    </section>
  );
}
