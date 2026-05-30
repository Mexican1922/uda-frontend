import { useNavigate } from "react-router-dom";
import { LogIn } from "lucide-react";

/**
 * Shown on auth-only pages (Library, Profile) when browsing as a guest.
 * Invites the visitor to create an account to unlock the feature.
 */
export default function GuestPrompt({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-20 md:py-28">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
        style={{ background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.25)" }}
      >
        <span className="text-[#e8c97a]">{icon}</span>
      </div>
      <h2
        className="text-lg md:text-xl font-bold text-[#f5f0e8]"
        style={{ fontFamily: "Syne, sans-serif" }}
      >
        {title}
      </h2>
      <p className="text-sm text-[#605850] mt-2 max-w-xs">{desc}</p>

      <div className="flex flex-col sm:flex-row gap-3 mt-7 w-full max-w-xs">
        <button
          onClick={() => navigate("/register")}
          className="flex-1 h-11 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold text-[#080808] transition-all hover:brightness-110 active:scale-[0.98]"
          style={{
            fontFamily: "Syne, sans-serif",
            background: "linear-gradient(180deg, #e8c97a 0%, #c9a84c 100%)",
            boxShadow: "0 6px 18px rgba(201,168,76,0.3)",
          }}
        >
          Create account
        </button>
        <button
          onClick={() => navigate("/login")}
          className="flex-1 h-11 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold text-[#f5f0e8] border border-[#2a2a2a] hover:border-[#3a3a3a] hover:bg-white/[0.02] transition-all active:scale-[0.98]"
          style={{ fontFamily: "Syne, sans-serif" }}
        >
          <LogIn size={15} strokeWidth={2} />
          Sign in
        </button>
      </div>
    </div>
  );
}
