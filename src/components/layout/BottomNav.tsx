import { NavLink } from "react-router-dom";

// Icons at 20px — refined, not oversized
function HomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9L12 2l9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function LibraryIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

const navItems = [
  { to: "/",        label: "Home",    Icon: HomeIcon    },
  { to: "/search",  label: "Search",  Icon: SearchIcon  },
  { to: "/library", label: "Library", Icon: LibraryIcon },
  { to: "/profile", label: "Profile", Icon: ProfileIcon },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden h-16 flex items-center bg-[#080808]/95 backdrop-blur-[16px] border-t border-white/[0.07]">
      {navItems.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center gap-[3px] py-2 transition-colors ${
              isActive ? "text-[#e8c97a]" : "text-[#3a3a3a]"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon />
              <span
                className={`text-[9px] font-semibold tracking-wide transition-colors ${
                  isActive ? "text-[#e8c97a]" : "text-[#3a3a3a]"
                }`}
                style={{ fontFamily: "Syne, sans-serif" }}
              >
                {label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
