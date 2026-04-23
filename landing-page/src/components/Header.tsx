import { useState } from "react";
import {
  BrifoMark,
  BtnPrimary,
  IconApple,
  IconMenu,
  IconX,
} from "../lib/design";

export function Header() {
  const downloadUrl =
    import.meta.env.VITE_DOWNLOAD_URL ||
    "https://github.com/noobie30/Brifo/releases/download/v0.1.4/Brifo-0.1.4-arm64.dmg";
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header
      className="sticky top-0 z-50 backdrop-blur-xl"
      style={{
        background: "color-mix(in oklab, var(--color-canvas) 80%, transparent)",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5 md:px-10">
        <a
          href="/"
          className="flex items-center gap-2.5"
          aria-label="Brifo"
        >
          <BrifoMark size={26} />
          <span
            className="text-[14px] font-semibold tracking-[-0.2px]"
            style={{ color: "var(--color-fg)" }}
          >
            Brifo
          </span>
        </a>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md w-9 h-9 md:hidden transition-colors"
            style={{ color: "var(--color-fg-muted)" }}
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            {menuOpen ? (
              <IconX size={20} />
            ) : (
              <IconMenu size={20} />
            )}
          </button>

          <div className="hidden md:block">
            <BtnPrimary
              asAnchor
              href={downloadUrl}
              download
              size="md"
            >
              <IconApple size={15} />
              Download for Mac
            </BtnPrimary>
          </div>
        </div>
      </div>

      {menuOpen && (
        <div
          className="md:hidden px-6 pb-3"
          style={{ borderTop: "1px solid var(--color-divider)" }}
        >
          <BtnPrimary
            asAnchor
            href={downloadUrl}
            download
            size="md"
            className="w-full mt-3"
          >
            <IconApple size={15} />
            Download for Mac
          </BtnPrimary>
        </div>
      )}
    </header>
  );
}
