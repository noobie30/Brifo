interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className = "" }: BreadcrumbsProps) {
  return (
    <nav className={`flex items-center gap-1.5 text-sm ${className}`}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={index} className="flex items-center gap-1.5">
            {index > 0 && <span className="text-gray-300">/</span>}
            {isLast || !item.onClick ? (
              <span
                className={
                  isLast ? "text-gray-800 font-medium" : "text-gray-500"
                }
              >
                {item.label}
              </span>
            ) : (
              <button
                type="button"
                onClick={item.onClick}
                className="text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
              >
                {item.label}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
