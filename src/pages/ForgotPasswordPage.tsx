import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { authApi } from "../services/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authApi.requestPasswordReset(email);
    } catch { /* response is intentionally generic; ignore errors */ }
    finally {
      setLoading(false);
      setSent(true); // always show the same confirmation (no account enumeration)
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
            Reset Password
          </p>
        </div>

        {sent ? (
          <div className="text-center">
            <CheckCircle2 size={40} className="text-[#2dbe8a] mx-auto mb-4" />
            <p className="text-sm text-[#f5f0e8] mb-2" style={{ fontFamily: "Syne, sans-serif" }}>
              Check your email
            </p>
            <p className="text-sm text-[#605850] leading-relaxed">
              If <span className="text-[#b8b0a0]">{email}</span> is registered, we've sent a reset link.
              It expires shortly — check spam too.
            </p>
            <Link to="/login" className="inline-flex items-center gap-1.5 text-xs text-[#e8c97a] hover:text-[#c9a84c] mt-6 transition-colors">
              <ArrowLeft size={13} /> Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <p className="text-sm text-[#605850] mb-5 text-center leading-relaxed">
              Enter your email and we'll send you a link to reset your password.
            </p>
            <label className="flex items-center gap-3 bg-[#111111] border border-[#2a2a2a] rounded-[14px] px-4 h-[52px] focus-within:border-[#c9a84c] transition-colors mb-4">
              <Mail size={16} className="text-[#605850] flex-shrink-0" />
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                placeholder="Email" autoFocus
                className="flex-1 bg-transparent border-none outline-none text-sm text-[#f5f0e8] placeholder-[#3a3a3a]"
              />
            </label>
            <button
              type="submit" disabled={loading}
              className="w-full h-[52px] rounded-[14px] font-bold text-[#080808] transition-opacity disabled:opacity-50"
              style={{ fontFamily: "Syne, sans-serif", fontSize: 15, background: "linear-gradient(180deg,#e8c97a,#c9a84c)" }}
            >
              {loading ? "Sending…" : "Send reset link"}
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
