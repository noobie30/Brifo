import brifoLogo from "../assets/brifo-logo-mark.png";

export function Footer() {
  return (
    <footer className="border-t border-gray-800 bg-gray-900 px-6 py-8 md:px-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 md:flex-row md:justify-between">
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-2 text-base font-bold tracking-tight text-white">
            <img src={brifoLogo} alt="Brifo" className="h-6 w-6 rounded-md" />
            Brifo
          </span>
          <nav className="flex gap-5 text-[13px] text-gray-500">
            <a href="#features" className="transition-colors hover:text-gray-300">
              Features
            </a>
            <a href="#privacy" className="transition-colors hover:text-gray-300">
              Privacy
            </a>
            <a href="#" className="transition-colors hover:text-gray-300">
              Support
            </a>
          </nav>
        </div>
        <p className="text-[13px] text-gray-600">
          &copy; {new Date().getFullYear()} Brifo. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
