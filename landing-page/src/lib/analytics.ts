declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

type EventParams = Record<string, string | number | boolean | undefined>;

export function track(eventName: string, params?: EventParams): void {
  if (typeof window === "undefined") return;
  if (typeof window.gtag !== "function") return;
  window.gtag("event", eventName, params ?? {});
}

export type CtaLocation = "header" | "hero" | "cta";

export function trackDownload(location: CtaLocation): void {
  track("download_click", { location });
}

export function trackBetaClick(location: CtaLocation): void {
  track("beta_click", { location });
}

export function trackSocialClick(
  network: "instagram" | "linkedin" | "github",
): void {
  track("social_click", { network });
}

export function trackMobileMenuToggle(state: "open" | "closed"): void {
  track("mobile_menu_toggle", { state });
}

const SCROLL_THRESHOLDS = [25, 50, 75, 100] as const;

export function initScrollTracking(): () => void {
  if (typeof window === "undefined") return () => {};

  const fired = new Set<number>();
  let rafId: number | null = null;

  const handler = () => {
    if (rafId !== null) return;
    rafId = window.requestAnimationFrame(() => {
      rafId = null;
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const viewport = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;
      const scrollable = Math.max(docHeight - viewport, 1);
      const percent = Math.min(100, (scrollTop / scrollable) * 100);

      for (const threshold of SCROLL_THRESHOLDS) {
        if (percent >= threshold && !fired.has(threshold)) {
          fired.add(threshold);
          track("scroll_depth", { percent: threshold });
        }
      }
    });
  };

  window.addEventListener("scroll", handler, { passive: true });
  handler();

  return () => {
    window.removeEventListener("scroll", handler);
    if (rafId !== null) window.cancelAnimationFrame(rafId);
  };
}
