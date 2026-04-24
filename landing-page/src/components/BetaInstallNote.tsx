import { useState } from "react";
import { track } from "../lib/analytics";

const POST_INSTALL_COMMAND = "xattr -cr /Applications/Brifo.app";

type BetaInstallNoteProps = {
  tone?: "light" | "dark";
  location: "hero" | "cta";
};

export function BetaInstallNote({
  tone = "light",
  location,
}: BetaInstallNoteProps) {
  const [copied, setCopied] = useState(false);
  const isDark = tone === "dark";

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(POST_INSTALL_COMMAND);
      setCopied(true);
      track("beta_install_command_copied", { location });
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* no-op — browsers without clipboard API still show the command */
    }
  };

  return (
    <div
      className="mx-auto mt-6 max-w-[540px] rounded-[10px] px-4 py-3.5 text-left"
      style={{
        background: isDark
          ? "rgba(255,255,255,0.06)"
          : "var(--color-subtle)",
        border: `1px solid ${
          isDark ? "rgba(255,255,255,0.12)" : "var(--color-border)"
        }`,
      }}
    >
      <div className="flex items-start gap-2.5">
        <span
          className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.6px]"
          style={{
            background: isDark
              ? "rgba(46,91,255,0.22)"
              : "var(--color-accent-soft)",
            color: isDark ? "#ffffff" : "var(--color-accent)",
            marginTop: 1,
          }}
        >
          Beta
        </span>
        <p
          className="flex-1 text-[12.5px] leading-[1.55] m-0"
          style={{
            color: isDark
              ? "rgba(250,250,247,0.78)"
              : "var(--color-fg-2)",
          }}
        >
          Not yet Apple-notarized. After installing, run this once in
          Terminal so macOS lets Brifo open:
        </p>
      </div>

      <div
        className="mt-2.5 flex items-center gap-2 rounded-[8px] px-3 py-2"
        style={{
          background: isDark
            ? "rgba(0,0,0,0.28)"
            : "var(--color-surface)",
          border: `1px solid ${
            isDark ? "rgba(255,255,255,0.06)" : "var(--color-border)"
          }`,
        }}
      >
        <code
          className="mono flex-1 overflow-x-auto whitespace-nowrap text-[12.5px] select-all"
          style={{
            color: isDark ? "#fafaf7" : "var(--color-fg)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {POST_INSTALL_COMMAND}
        </code>
        <button
          type="button"
          onClick={onCopy}
          aria-label={copied ? "Command copied" : "Copy command to clipboard"}
          className="shrink-0 rounded-[6px] px-2.5 py-1 text-[11.5px] font-medium transition-colors cursor-pointer"
          style={{
            background: isDark
              ? copied
                ? "rgba(14,123,78,0.32)"
                : "rgba(255,255,255,0.12)"
              : copied
                ? "var(--color-success-soft)"
                : "var(--color-muted)",
            color: isDark
              ? "#ffffff"
              : copied
                ? "var(--color-success)"
                : "var(--color-fg-2)",
            border: "none",
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
