import { NavLink } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";

export default function TopBar() {
  const user = useAuthStore((s) => s.user);
  const initial =
    user?.display_name?.[0]?.toUpperCase() ||
    user?.username?.[0]?.toUpperCase() ||
    "U";

  return (
    <header className="fixed top-0 left-0 right-0 z-40 md:hidden h-14 flex items-center justify-between px-5 bg-[#080808]/90 backdrop-blur-[16px] border-b border-white/10">
      <h1
        className="text-xl font-bold tracking-tight text-[#e8c97a]"
        style={{ fontFamily: "Syne, sans-serif" }}
      >
        Ụda
      </h1>

      <NavLink to="/profile">
        {({ isActive }) => (
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              isActive
                ? "bg-[#c9a84c22] border-2 border-[#e8c97a] text-[#e8c97a]"
                : "bg-[#c9a84c15] border border-[#c9a84c44] text-[#c9a84c]"
            }`}
            style={{ fontFamily: "Syne, sans-serif" }}
          >
            {initial}
          </div>
        )}
      </NavLink>
    </header>
  );
}
