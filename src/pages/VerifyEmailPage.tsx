import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { authApi } from "../services/api";

type State = "verifying" | "success" | "error" | "already_verified" | "awaiting";

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  const uid   = searchParams.get("uid");
  const token = searchParams.get("token");

  // If no uid/token in URL — show "check your inbox" screen
  const [state, setState] = useState<State>(uid && token ? "verifying" : "awaiting");
  const [email, setEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  // ── Auto-verify when token is present in URL ───────────────────────────────
  useEffect(() => {
    if (!uid || !token) return;

    authApi.verifyEmail(uid, token)
      .then(({ data }) => {
        if (data.access) {
          // Verification returned tokens — auto-login the user
          setAuth(data.user, data.access, data.refresh);
          setState("success");
          setTimeout(() => navigate("/onboarding"), 2500);
        } else {
          setState("already_verified");
          setTimeout(() => navigate("/login"), 2000);
        }
      })
      .catch((err) => {
        const msg = err.response?.data?.error || "";
        if (msg.includes("already")) {
          setState("already_verified");
          setTimeout(() => navigate("/login"), 2000);
        } else {
          setState("error");
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleResend = async () => {
    if (!email.trim()) return;
    setResendLoading(true);
    try {
      await authApi.resendVerification(email.trim());
      setResendSent(true);
    } catch {}
    finally { setResendLoading(false); }
  };

  // ── Screen: awaiting (just registered, no token in URL) ───────────────────
  if (state === "awaiting") {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center px-6">
        {/* Gold glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[35%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(201,168,76,0.14) 0%, transparent 70%)", filter: "blur(40px)" }} />
        </div>

        <div className="w-full max-w-[340px] text-center relative z-10">
          {/* Envelope icon */}
          <div className="w-20 h-20 rounded-[24px] flex items-center justify-center mx-auto mb-8"
            style={{ background: "linear-gradient(135deg, rgba(201,168,76,0.2), rgba(201,168,76,0.05))", border: "1px solid rgba(201,168,76,0.25)" }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#c9a84c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2"/>
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-[#f5f0e8] mb-3" style={{ fontFamily: "Syne, sans-serif" }}>
            Check your inbox
          </h1>
          <p className="text-[#b8b0a0] text-sm leading-relaxed mb-8">
            We've sent a verification link to your email address.
            Click it to activate your account.
          </p>

          <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-4 mb-6 text-left">
            <p className="text-xs text-[#605850] mb-3 uppercase tracking-widest">Didn't get it?</p>
            {resendSent ? (
              <p className="text-sm text-[#2dbe8a] font-semibold">✓ New link sent — check your inbox</p>
            ) : (
              <div className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your email address"
                  className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-[#f5f0e8] placeholder-[#3a3a3a] outline-none focus:border-[#c9a84c] transition-colors"
                />
                <button
                  onClick={handleResend}
                  disabled={resendLoading || !email.trim()}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-[#080808] disabled:opacity-50 transition-opacity flex-shrink-0"
                  style={{ background: "linear-gradient(180deg,#e8c97a,#c9a84c)" }}
                >
                  {resendLoading ? "…" : "Resend"}
                </button>
              </div>
            )}
          </div>

          <Link to="/login" className="text-sm text-[#605850] hover:text-[#b8b0a0] transition-colors">
            ← Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  // ── Screen: verifying spinner ──────────────────────────────────────────────
  if (state === "verifying") {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-2 border-[#c9a84c] border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-[#b8b0a0] text-sm">Verifying your email…</p>
        </div>
      </div>
    );
  }

  // ── Screen: success ────────────────────────────────────────────────────────
  if (state === "success" || state === "already_verified") {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center px-6">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[35%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(45,190,138,0.12) 0%, transparent 70%)", filter: "blur(40px)" }} />
        </div>

        <div className="text-center relative z-10">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ background: "rgba(45,190,138,0.15)", border: "1px solid rgba(45,190,138,0.3)" }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#2dbe8a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[#f5f0e8] mb-2" style={{ fontFamily: "Syne, sans-serif" }}>
            {state === "already_verified" ? "Already verified" : "Email verified!"}
          </h1>
          <p className="text-[#b8b0a0] text-sm">
            {state === "already_verified"
              ? "Redirecting to sign in…"
              : "Welcome to Ụda 🎵 Setting up your experience…"}
          </p>
        </div>
      </div>
    );
  }

  // ── Screen: error ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center px-6">
      <div className="w-full max-w-[340px] text-center">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ background: "rgba(190,18,60,0.1)", border: "1px solid rgba(190,18,60,0.25)" }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8v4M12 16h.01"/>
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-[#f5f0e8] mb-3" style={{ fontFamily: "Syne, sans-serif" }}>
          Link expired
        </h1>
        <p className="text-[#b8b0a0] text-sm mb-8">
          This verification link is invalid or has expired. Request a new one below.
        </p>

        {resendSent ? (
          <p className="text-sm text-[#2dbe8a] font-semibold mb-6">✓ New link sent — check your inbox</p>
        ) : (
          <div className="flex flex-col gap-3 mb-6">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email address"
              className="w-full bg-[#111111] border border-[#2a2a2a] rounded-[14px] px-4 h-[52px] text-sm text-[#f5f0e8] placeholder-[#3a3a3a] outline-none focus:border-[#c9a84c] transition-colors"
            />
            <button
              onClick={handleResend}
              disabled={resendLoading || !email.trim()}
              className="w-full h-[52px] rounded-[14px] font-bold text-[#080808] disabled:opacity-50"
              style={{ fontFamily: "Syne, sans-serif", background: "linear-gradient(180deg,#e8c97a,#c9a84c)" }}
            >
              {resendLoading ? "Sending…" : "Send new link"}
            </button>
          </div>
        )}

        <Link to="/login" className="text-sm text-[#605850] hover:text-[#b8b0a0] transition-colors">
          ← Back to sign in
        </Link>
      </div>
    </div>
  );
}
