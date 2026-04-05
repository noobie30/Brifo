import { NavLink, useNavigate } from "react-router-dom";
import { BrandLogo } from "./BrandLogo";
import { useAppStore } from "../store/app-store";
import { stopAutoCapture } from "../lib/auto-capture";

const NAV_ITEMS = [
  { to: "/home", label: "Dashboard", icon: "dashboard" },
  { to: "/meetings", label: "Meetings", icon: "video_chat" },
  { to: "/documents", label: "Documents", icon: "description" },
  { to: "/tasks", label: "Tasks", icon: "task_alt" },
  { to: "/settings", label: "Settings", icon: "settings" },
];

export function Sidebar() {
  const navigate = useNavigate();
  const user = useAppStore((state) => state.user);
  const signOut = useAppStore((state) => state.signOut);

  function onSignOut() {
    void stopAutoCapture("manual");
    signOut();
    navigate("/login");
  }

  return (
    <aside className="flex flex-col w-56 border-r border-gray-200 bg-white shrink-0">
      <div className="px-5 pt-5 pb-4">
        <BrandLogo showSubtitle />
      </div>

      <nav className="flex-1 flex flex-col gap-0.5 px-3" aria-label="Primary">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              [
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150",
                isActive
                  ? "bg-accent-50 text-accent-700"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-800",
              ].join(" ")
            }
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden>
              {item.icon}
            </span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-gray-200">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <div
            className="flex items-center justify-center h-8 w-8 rounded-full bg-accent-100 text-accent-700 text-xs font-semibold shrink-0"
            aria-hidden
          >
            {(user?.name?.[0] ?? "G").toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">
              {user?.name ?? "Brifo User"}
            </p>
          </div>
          <button
            className="flex items-center justify-center h-7 w-7 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
            type="button"
            onClick={onSignOut}
            title="Sign out"
            aria-label="Sign out"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden>
              logout
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
}
