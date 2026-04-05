import { useEffect, useRef } from "react";

export function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const targets = el.querySelectorAll("[data-animate]");
    if (targets.length === 0) {
      // If the ref element itself is animated
      if (el.hasAttribute("data-animate")) {
        const observer = new IntersectionObserver(
          ([entry]) => {
            if (entry.isIntersecting) {
              el.classList.add("in-view");
              observer.unobserve(el);
            }
          },
          { threshold },
        );
        observer.observe(el);
        return () => observer.disconnect();
      }
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold },
    );

    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, [threshold]);

  return ref;
}
