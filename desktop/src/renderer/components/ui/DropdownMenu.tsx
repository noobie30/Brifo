import { ReactNode, useEffect, useRef, useState } from "react";

interface DropdownMenuItem {
  label: string;
  icon?: string;
  onClick: () => void;
  variant?: "default" | "danger";
}

interface DropdownMenuProps {
  trigger: ReactNode;
  items: DropdownMenuItem[];
  align?: "left" | "right";
}

export function DropdownMenu({
  trigger,
  items,
  align = "right",
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex">
      <div onClick={() => setOpen(!open)}>{trigger}</div>
      {open && (
        <div
          className={`absolute top-full mt-1 z-40 min-w-[160px] rounded border border-gray-200 bg-white py-1 shadow-sm animate-fade-in ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {items.map((item, index) => (
            <button
              key={`${item.label}-${index}`}
              type="button"
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-sm transition-colors cursor-pointer ${
                item.variant === "danger"
                  ? "text-error-600 hover:bg-error-50"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
              onClick={() => {
                item.onClick();
                setOpen(false);
              }}
            >
              {item.icon && (
                <span className="material-symbols-rounded text-base">
                  {item.icon}
                </span>
              )}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
