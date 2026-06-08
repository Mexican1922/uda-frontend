import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Lock, Eye, EyeOff, CheckCircle2, ArrowLeft } from "lucide-react";
import { authApi } from "../services/api";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const uid = params.get("uid") || "";
  const token = params.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const invalidLink = !uid || !token;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setLoading(true);
    try {
      await authApi.confirmPasswordReset(uid, token, password);
      setDone(true);
    } catch (err: any) {
      setError(err.response?.data?.error || "This reset link is invalid or has expired.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center px-6">
      <div className="w-full max-w-[340px]">
        <div className="text-center mb-10">
          <h1 className="font-extrabold text-[#e8c97a] leading-none"
              style={{ fontFamily: "Syne, sans-serif", fontSize: 48, letterSpacing: "-0.04em" }}>
            Ụda
          </h1>
          <p className="text-[#605850] mt-2 font-semibold" style={{ fontSize: 11, letterSpacing: "0.32em", textTransform: "uppercase" }}>
            New Password
          </p>
        </div>

        {done ? (
          <div className="text-center">
            <CheckCircle2 size={40} className="text-[#2dbe8a] mx-auto mb-4" />
            <p className="text-sm text-[#f5f0e8] mb-2" style={{ fontFamily: "Syne, sans-serif" }}>Password updated</p>
            <p className="text-sm text-[#605850] mb-6">You can now sign in with your new password.</p>
            <button
              onClick={() => navigate("/login")}
              className="w-full h-[52px] rounded-[14px] font-bold text-[#080808]"
              style={{ fontFamily: "Syne, sans-serif", fontSize: 15, background: "linear-gradient(180deg,#e8c97a,#c9a84c)" }}
            >
              Sign in
            </button>
          </div>
        ) : invalidLink ? (
          <div className="text-center">
            <p className="text-sm text-red-400 mb-4">This reset link is missing or malformed.</p>
            <Link to="/forgot-password" className="text-xs text-[#e8c97a] hover:text-[#c9a84c] transition-colors">
              Request a new link
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-3 mb-4">
              <label className="flex items-center gap-3 bg-[#111111] border border-[#2a2a2a] rounded-[14px] px-4 h-[52px] focus-within:border-[#c9a84c] transition-colors">
                <Lock size={16} className="text-[#605850] flex-shrink-0" />
                <input
                  type={showPw ? "text" : "password"} value={password}
                  onChange={(e) => setPassword(e.target.value)} required autoFocus
                  placeholder="New password"
                  className="flex-1 bg-transparent border-none outline-none text-sm text-[#f5f0e8] placeholder-[#3a3a3a]"
                />
                <button type="button" onClick={() => setShowPw((v) => !v)} tabIndex={-1}
                        className="text-[#605850] hover:text-[#b8b0a0] transition-colors flex-shrink-0">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </label>
              <label className="flex items-center gap-3 bg-[#111111] border border-[#2a2a2a] rounded-[14px] px-4 h-[52px] focus-within:border-[#c9a84c] transition-colors">
                <Lock size={16} className="text-[#605850] flex-shrink-0" />
                <input
                  type={showPw ? "text" : "password"} value={confirm}
                  onChange={(e) => setConfirm(e.target.value)} required
                  placeholder="Confirm new password"
                  className="flex-1 bg-transparent border-none outline-none text-sm text-[#f5f0e8] placeholder-[#3a3a3a]"
                />
              </label>
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-3 py-2.5 mb-4">{error}</p>
            )}

            <button
              type="submit" disabled={loading}
              className="w-full h-[52px] rounded-[14px] font-bold text-[#080808] transition-opacity disabled:opacity-50"
              style={{ fontFamily: "Syne, sans-serif", fontSize: 15, background: "linear-gradient(180deg,#e8c97a,#c9a84c)" }}
            >
              {loading ? "Updating…" : "Update password"}
            </button>
            <p className="text-center mt-6">
              <Link to="/login" className="inline-flex items-center gap-1.5 text-xs text-[#605850] hover:text-[#b8b0a0] transition-colors">
                <ArrowLeft size={13} /> Back to sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
