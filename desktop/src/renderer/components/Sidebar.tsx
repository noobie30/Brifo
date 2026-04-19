import { NavLink, useNavigate } from "react-router-dom";
import { useAppStore } from "../store/app-store";
import { stopAutoCapture } from "../lib/auto-capture";
import {
  BrifoMark,
  IconDashboard,
  IconDocuments,
  IconLogout,
  IconMeetings,
  IconNote,
  IconPlus,
  IconSettings,
  IconTasks,
} from "./icons";

type IconCmp = typeof IconDashboard;

const NAV: Array<{ to: string; label: string; icon: IconCmp }> = [
  { to: "/home", label: "Dashboard", icon: IconDashboard },
  { to: "/quick-note", label: "Quick Note", icon: IconNote },
  { to: "/meetings", label: "Meetings", icon: IconMeetings },
  { to: "/documents", label: "Documents", icon: IconDocuments },
  { to: "/tasks", label: "Tasks", icon: IconTasks },
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

  const initials = (user?.name ?? "G")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <aside
      className="flex flex-col w-[232px] flex-shrink-0 px-2.5 py-3 border-r border-border"
      style={{ background: "var(--color-sidebar)" }}
    >
      {/* brand */}
      <div className="flex items-center gap-2.5 px-2 pt-1.5 pb-3.5">
        <BrifoMark size={26} />
        <div className="flex flex-col min-w-0">
          <span className="text-[14px] font-semibold tracking-[-0.2px] leading-tight text-fg">
            Brifo
          </span>
        </div>
        <div className="flex-1" />
        <button
          title="New note"
          className="w-6 h-6 rounded-md flex items-center justify-center text-fg-muted hover:bg-subtle transition-colors cursor-pointer"
          onClick={() => navigate("/quick-note")}
          type="button"
          aria-label="New quick note"
        >
          <IconPlus width={14} height={14} />
        </button>
      </div>

      {/* nav */}
      <nav className="flex flex-col gap-[1px]" aria-label="Primary">
        {NAV.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  "relative flex items-center gap-2.5 h-8 px-2.5 rounded-[7px] text-[13px] tracking-[-0.1px] transition-colors cursor-pointer",
                  isActive
                    ? "font-medium text-fg"
                    : "font-normal text-fg-2 hover:bg-subtle",
                ].join(" ")
              }
              style={({ isActive }) =>
                isActive
                  ? { background: "var(--color-sidebar-active)" }
                  : undefined
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span
                      className="absolute -left-2.5 top-1.5 bottom-1.5 w-[2px] rounded-sm"
                      style={{ background: "var(--color-accent)" }}
                    />
                  )}
                  <Icon width={16} height={16} />
                  <span className="flex-1">{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="flex-1" />

      {/* settings link + user pill */}
      <NavLink
        to="/settings"
        className={({ isActive }) =>
          [
            "flex items-center gap-2.5 h-8 px-2.5 rounded-[7px] text-[13px] transition-colors cursor-pointer",
            isActive ? "text-fg font-medium" : "text-fg-2 hover:bg-subtle",
          ].join(" ")
        }
        style={({ isActive }) =>
          isActive ? { background: "var(--color-sidebar-active)" } : undefined
        }
      >
        <IconSettings width={16} height={16} />
        <span>Settings</span>
      </NavLink>

      <div
        className="flex items-center gap-2 p-1.5 mt-2 rounded-lg border border-border"
        style={{ background: "var(--color-surface)" }}
      >
        <div
          className="flex items-center justify-center w-[26px] h-[26px] rounded-md text-white text-[11px] font-semibold flex-shrink-0"
          style={{
            background:
              "linear-gradient(135deg, var(--color-accent), var(--color-accent-hover))",
            letterSpacing: "0.2px",
          }}
          aria-hidden
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] font-medium text-fg truncate">
            {user?.name ?? "Brifo User"}
          </div>
          <div className="text-[10.5px] text-fg-subtle truncate">
            {user?.email ?? ""}
          </div>
        </div>
        <button
          type="button"
          title="Sign out"
          onClick={onSignOut}
          aria-label="Sign out"
          className="w-[26px] h-[26px] rounded-md flex items-center justify-center text-fg-subtle hover:text-fg hover:bg-subtle transition-colors cursor-pointer"
        >
          <IconLogout width={14} height={14} />
        </button>
      </div>
    </aside>
  );
}
