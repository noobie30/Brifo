import {
  BtnPrimary,
  Eyebrow,
  IconApple,
  IconCheck,
} from "../lib/design";

export function Hero() {
  const downloadUrl =
    import.meta.env.VITE_DOWNLOAD_URL ||
    "https://github.com/noobie30/Brifo/releases/download/v0.1.2/Brifo-0.1.2-arm64.dmg";

  return (
    <section
      id="hero"
      className="relative overflow-hidden px-6 pt-16 pb-20 md:px-12 md:pt-24 md:pb-28"
      style={{ background: "var(--color-canvas)" }}
    >
      {/* subtle accent glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          top: -140,
          left: "50%",
          transform: "translateX(-50%)",
          width: 520,
          height: 520,
          borderRadius: "50%",
          background: "var(--color-accent)",
          opacity: 0.08,
          filter: "blur(80px)",
        }}
      />

      <div className="animate-hero relative mx-auto max-w-3xl text-center">
        <h1
          className="serif font-medium tracking-[-1.2px]"
          style={{
            color: "var(--color-fg)",
            fontSize: "clamp(40px, 6vw, 58px)",
            lineHeight: 1.06,
            margin: 0,
          }}
        >
          Meeting notes that
          <br />
          write themselves
        </h1>

        <p
          className="mx-auto mt-6 text-[16.5px] md:text-[17px] leading-[1.6]"
          style={{ color: "var(--color-fg-muted)", maxWidth: 560 }}
        >
          Brifo listens to your meetings and writes up the notes so you don't
          have to. No bot joins the call.
        </p>

        <div className="mt-9 flex flex-col items-center gap-3">
          <BtnPrimary asAnchor href={downloadUrl} download size="lg">
            <IconApple size={16} />
            Download for Mac
          </BtnPrimary>
        </div>
      </div>
    </section>
  );
}
