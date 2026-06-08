import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";
import { authApi } from "../services/api";
import { useAuthStore } from "../store/authStore";
import GoogleButton from "../components/auth/GoogleButton";

// Faint album mosaic background — 12 gradient tiles
const MOSAIC = [
  ["#c9a84c", "#6b3a0f"], ["#1a7a4a", "#0a3020"], ["#7c3aed", "#3b0764"],
  ["#be123c", "#4c0519"], ["#0369a1", "#082f49"], ["#c2410c", "#431407"],
  ["#065f46", "#022c22"], ["#92400e", "#451a03"], ["#1e40af", "#1e3a8a"],
  ["#4d7c0f", "#1a2e05"], ["#9333ea", "#581c87"], ["#0f766e", "#042f2e"],
] as [string, string][];

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { setAuth, continueAsGuest } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await authApi.login({ email, password });
      localStorage.setItem("uda_access", data.access);
      const { data: user } = await authApi.profile();
      setAuth(user, data.access, data.refresh);
      navigate("/");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Invalid credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center px-6 overflow-hidden relative">

      {/* Radial gold glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-[30%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(201,168,76,0.18) 0%, transparent 70%)",
            filter: "blur(40px)",
          }}
        />
      </div>

      {/* Faint album mosaic tiles — top of screen */}
      <div
        className="absolute top-0 left-0 right-0 h-72 pointer-events-none"
        style={{ opacity: 0.08 }}
      >
        <div
          className="h-full gap-1.5 p-1.5"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gridTemplateRows: "repeat(3, 1fr)",
          }}
        >
          {MOSAIC.map(([a, b], i) => (
            <div key={i} className="rounded-md" style={{ background: `linear-gradient(135deg, ${a}, ${b})` }} />
          ))}
        </div>
      </div>
      {/* Fade mosaic into bg */}
      <div
        className="absolute top-0 left-0 right-0 h-80 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, rgba(8,8,8,0.6) 0%, #080808 100%)" }}
      />

      {/* Main content */}
      <div className="w-full max-w-[340px] relative z-10">

        {/* Wordmark */}
        <div className="text-center mb-12">
          <h1
            className="font-extrabold text-[#e8c97a] leading-none"
            style={{
              fontFamily: "Syne, sans-serif",
              fontSize: 56,
              letterSpacing: "-0.04em",
              textShadow: "0 0 40px rgba(201,168,76,0.4)",
            }}
          >
            Ụda
          </h1>
          <p
            className="text-[#605850] mt-2 font-semibold"
            style={{ fontSize: 11, letterSpacing: "0.32em", textTransform: "uppercase" }}
          >
            The Sound of Naija
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-3 mb-3">
            {/* Email */}
            <label className="flex items-center gap-3 bg-[#111111] border border-[#2a2a2a] rounded-[14px] px-4 h-[52px] focus-within:border-[#c9a84c] transition-colors">
              <Mail size={16} className="text-[#605850] flex-shrink-0" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Email"
                className="flex-1 bg-transparent border-none outline-none text-sm text-[#f5f0e8] placeholder-[#3a3a3a]"
              />
            </label>

            {/* Password */}
            <label className="flex items-center gap-3 bg-[#111111] border border-[#2a2a2a] rounded-[14px] px-4 h-[52px] focus-within:border-[#c9a84c] transition-colors">
              <Lock size={16} className="text-[#605850] flex-shrink-0" />
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Password"
                className="flex-1 bg-transparent border-none outline-none text-sm text-[#f5f0e8] placeholder-[#3a3a3a]"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="text-[#605850] hover:text-[#b8b0a0] transition-colors flex-shrink-0"
                tabIndex={-1}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </label>
          </div>

          {/* Forgot password */}
          <div className="text-right mb-6">
            <Link
              to="/forgot-password"
              className="text-xs text-[#605850] hover:text-[#b8b0a0] transition-colors"
            >
              Forgot password?
            </Link>
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-3 py-2.5 mb-4">
              {error}
            </p>
          )}

          {/* Sign in */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-[52px] rounded-[14px] font-bold text-[#080808] transition-opacity disabled:opacity-50"
            style={{
              fontFamily: "Syne, sans-serif",
              fontSize: 15,
              letterSpacing: "0.04em",
              background: "linear-gradient(180deg, #e8c97a 0%, #c9a84c 100%)",
              boxShadow: "0 8px 24px rgba(201,168,76,0.35), inset 0 1px 0 rgba(255,255,255,0.3)",
            }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {/* OR divider */}
        <div className="flex items-center gap-3.5 my-7">
          <div className="flex-1 h-px bg-[#2a2a2a]" />
          <span className="text-[#3a3a3a]" style={{ fontSize: 11, letterSpacing: "0.16em" }}>OR</span>
          <div className="flex-1 h-px bg-[#2a2a2a]" />
        </div>

        {/* Google sign-in */}
        <GoogleButton
          onLoadingChange={setLoading}
          onError={setError}
        />

        {/* Continue as guest */}
        <button
          type="button"
          onClick={() => { continueAsGuest(); navigate("/"); }}
          className="w-full h-12 rounded-[14px] border border-[#2a2a2a] text-[#f5f0e8] text-sm font-semibold hover:border-[#3a3a3a] hover:bg-white/[0.02] transition-all mt-3"
          style={{ fontFamily: "Syne, sans-serif" }}
        >
          Continue as guest
        </button>

        {/* Sign up link */}
        <p className="text-center text-sm text-[#605850] mt-8">
          New to Ụda?{" "}
          <Link
            to="/register"
            className="text-[#e8c97a] font-semibold hover:text-[#c9a84c] transition-colors"
          >
            Create account
          </Link>
        </p>
      </div>
    </div>
  );
}
