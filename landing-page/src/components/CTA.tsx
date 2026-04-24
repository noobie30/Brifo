import { BtnOnDark, IconApple } from "../lib/design";
import { trackBetaClick, trackDownload } from "../lib/analytics";
import { BetaInstallNote } from "./BetaInstallNote";

export function CTA() {
  const downloadUrl =
    import.meta.env.VITE_DOWNLOAD_URL ||
    "https://github.com/noobie30/Brifo/releases/download/v0.1.5/Brifo-0.1.5-arm64.dmg";

  return (
    <section
      id="cta"
      className="relative overflow-hidden px-6 py-20 md:px-12 md:py-28"
      style={{
        background:
          "linear-gradient(135deg, var(--color-fg) 0%, #2a2922 100%)",
        color: "var(--color-fg-inverse)",
      }}
    >
      {/* blurred accent glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          top: -80,
          right: -60,
          width: 320,
          height: 320,
          borderRadius: "50%",
          background: "var(--color-accent)",
          opacity: 0.28,
          filter: "blur(60px)",
        }}
      />

      <div className="relative mx-auto max-w-2xl text-center">
        <p
          className="eyebrow mb-4"
          style={{ color: "rgba(250,250,247,0.55)" }}
        >
          Ready when you are
        </p>
        <h2
          className="serif font-medium tracking-[-1px] text-white"
          style={{
            fontSize: "clamp(30px, 4.5vw, 44px)",
            lineHeight: 1.08,
            margin: 0,
          }}
        >
          Ready to stop taking
          <br />
          meeting notes?
        </h2>
        <p
          className="mx-auto mt-5 text-[15.5px] leading-[1.6]"
          style={{
            color: "rgba(250,250,247,0.72)",
            maxWidth: 440,
          }}
        >
          Download Brifo free for Mac and let your meetings work for you.
        </p>

        <div className="mt-9 flex flex-col items-center gap-3">
          <BtnOnDark
            asAnchor
            href={downloadUrl}
            download
            size="lg"
            onClick={() => trackDownload("cta")}
          >
            <IconApple size={16} />
            Download for Mac
          </BtnOnDark>
          <a
            href="https://forms.gle/Yr6WrWgruwj4GWYt6"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackBetaClick("cta")}
            className="inline-flex items-center justify-center gap-2 rounded-[10px] font-medium whitespace-nowrap transition-colors cursor-pointer h-[46px] px-6 text-[15px] bg-transparent text-white border border-white/40 hover:border-white hover:bg-white/10"
          >
            Join the beta
          </a>
        </div>

        <BetaInstallNote tone="dark" location="cta" />
      </div>
    </section>
  );
}
