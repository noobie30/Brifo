import { useState } from "react";
import brifoLogo from "../assets/brifo-logo-mark.png";

const navLinks = [];

export function Header() {
  const downloadUrl = import.meta.env.VITE_DOWNLOAD_URL || "#download";
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 md:px-12">
        <div className="flex items-center gap-8">
          <a
            href="/"
            className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-gray-900"
          >
            <img src={brifoLogo} alt="Brifo" className="h-8 w-8 rounded-lg" />
            Brifo
          </a>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md p-2 text-gray-600 hover:bg-gray-100 md:hidden"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {menuOpen ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="4" y1="6" x2="20" y2="6" />
                  <line x1="4" y1="12" x2="20" y2="12" />
                  <line x1="4" y1="18" x2="20" y2="18" />
                </>
              )}
            </svg>
          </button>
          <a
            href={downloadUrl}
            download
            className="hidden rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 md:inline-block"
          >
            Download for Mac
          </a>
        </div>
      </div>
    </header>
  );
}
