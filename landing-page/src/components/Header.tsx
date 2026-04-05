import brifoLogo from "../assets/brifo-logo-mark.png";

export function Header() {
  const downloadUrl = import.meta.env.VITE_DOWNLOAD_URL || "#download";

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 md:px-12">
        <div className="flex items-center gap-8">
          <a href="#" className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-gray-900">
            <img src={brifoLogo} alt="Brifo" className="h-8 w-8 rounded-lg" />
            Brifo
          </a>
          <nav className="hidden items-center gap-6 text-sm text-gray-500 md:flex">
            <a href="#features" className="transition-colors hover:text-gray-900">
              Features
            </a>
            <a
              href="#how-it-works"
              className="transition-colors hover:text-gray-900"
            >
              How it works
            </a>
            <a href="#privacy" className="transition-colors hover:text-gray-900">
              Privacy
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={downloadUrl}
            download
            className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800"
          >
            Download for Mac
          </a>
        </div>
      </div>
    </header>
  );
}
