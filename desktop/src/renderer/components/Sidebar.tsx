import { NavLink, useNavigate } from "react-router-dom";
import { BrandLogo } from "./BrandLogo";
import { useAppStore } from "../store/app-store";
import { stopAutoCapture } from "../lib/auto-capture";

const NAV_ITEMS = [
  { to: "/home", label: "Dashboard", icon: "dashboard" },
  { to: "/quick-note", label: "Quick Note", icon: "edit_note" },
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
    <aside className="flex flex-col w-52 bg-slate-900 shrink-0">
      <div className="px-4 pt-4 pb-3">
        <BrandLogo showSubtitle dark />
      </div>

      <nav className="flex-1 flex flex-col gap-0.5 px-2" aria-label="Primary">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              [
                "relative flex items-center gap-2.5 px-3 py-2 rounded text-sm font-medium transition-colors duration-150",
                isActive
                  ? "bg-white/10 text-white"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
              ].join(" ")
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-accent-400" />
                )}
                <span
                  className="material-symbols-outlined text-[20px]"
                  aria-hidden
                >
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-2 border-t border-white/10">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <div
            className="flex items-center justify-center h-8 w-8 rounded-full bg-accent-500 text-white text-xs font-semibold shrink-0"
            aria-hidden
          >
            {(user?.name?.[0] ?? "G").toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-200 truncate">
              {user?.name ?? "Brifo User"}
            </p>
          </div>
          <button
            className="flex items-center justify-center h-7 w-7 rounded text-slate-500 hover:text-slate-300 hover:bg-white/10 transition-colors cursor-pointer"
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
