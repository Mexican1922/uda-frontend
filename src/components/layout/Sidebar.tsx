import { NavLink, useNavigate } from "react-router-dom";
import { Home, Search, BookOpen, LogOut } from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { authApi } from "../../services/api";

const navItems = [
  { to: "/", label: "Home", Icon: Home },
  { to: "/search", label: "Search", Icon: Search },
  { to: "/library", label: "Library", Icon: BookOpen },
];

export default function Sidebar() {
  const { user, logout, refreshToken } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } catch {}
    logout();
    navigate("/login");
  };

  return (
    <aside className="hidden md:flex w-60 flex-shrink-0 flex-col bg-[#0d0d0d] border-r border-[#1a1a1a] px-4 py-6">
      {/* Logo */}
      <div className="mb-10 px-2">
        <h1
          className="text-2xl font-bold tracking-tight text-[#e8c97a]"
          style={{ fontFamily: "Syne, sans-serif" }}
        >
          Ụda
        </h1>
        <p className="text-[10px] text-[#605850] tracking-widest uppercase mt-0.5">
          Feel the Sound
        </p>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1">
        {navItems.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                isActive
                  ? "bg-[#c9a84c15] text-[#e8c97a] font-medium"
                  : "text-[#605850] hover:text-[#b8b0a0] hover:bg-[#ffffff08]"
              }`
            }
          >
            <Icon size={17} strokeWidth={1.8} className="flex-shrink-0" />
            <span style={{ fontFamily: "Syne, sans-serif" }}>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Divider */}
      <div className="my-6 border-t border-[#1a1a1a]" />

      {/* User section */}
      <div className="mt-auto">
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 mb-2 ${
              isActive ? "bg-[#c9a84c15] text-[#e8c97a]" : "text-[#605850] hover:text-[#b8b0a0] hover:bg-[#ffffff08]"
            }`
          }
        >
          <div className="w-7 h-7 rounded-full bg-[#c9a84c22] border border-[#c9a84c44] flex items-center justify-center text-xs text-[#e8c97a] font-bold flex-shrink-0">
            {user?.display_name?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || "U"}
          </div>
          <span className="truncate" style={{ fontFamily: "Syne, sans-serif" }}>
            {user?.display_name || user?.username}
          </span>
        </NavLink>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-[#3a3a3a] hover:text-[#605850] transition-colors"
        >
          <LogOut size={14} strokeWidth={1.8} className="flex-shrink-0" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
