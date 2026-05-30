import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, Mail, Lock, Check } from "lucide-react";
import { authApi } from "../services/api";
import GoogleButton from "../components/auth/GoogleButton";

const ALL_GENRES = [
  "Afrobeats", "Amapiano", "R&B", "Hip-hop",
  "Afropop", "Soul", "Highlife", "Gospel",
];

export default function RegisterPage() {
  const [form, setForm] = useState({
    email: "", username: "", display_name: "", password: "",
  });
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const toggleGenre = (genre: string) =>
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await authApi.register({
        ...form,
        ...(selectedGenres.length > 0 ? { favourite_genres: selectedGenres } : {}),
      });
      // Don't auto-login — user must verify email first
      navigate("/verify-email");
    } catch (err: any) {
      const errors = err.response?.data;
      if (errors) {
        const first = Object.values(errors)[0];
        setError(Array.isArray(first) ? (first[0] as string) : String(first));
      } else {
        setError("Something went wrong.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080808] overflow-auto relative">
      {/* Subtle green glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(45,190,138,0.06) 0%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />
      </div>

      <div className="max-w-[340px] mx-auto px-6 pt-14 pb-12 relative z-10">
        {/* Back button */}
        <button
          type="button"
          onClick={() => navigate("/login")}
          className="flex items-center gap-1.5 text-[#605850] hover:text-[#b8b0a0] transition-colors mb-6"
        >
          <ChevronLeft size={18} />
          <span className="text-sm">Back</span>
        </button>

        {/* Heading */}
        <div className="mb-7">
          <h1
            className="font-extrabold text-[28px] leading-tight"
            style={{ fontFamily: "Syne, sans-serif", letterSpacing: "-0.02em" }}
          >
            <span className="text-[#f5f0e8]">Join </span>
            <span className="text-[#e8c97a]">Ụda</span>
          </h1>
          <p className="text-[#605850] text-sm mt-1.5">Build your sound, your way.</p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Input fields */}
          <div className="flex flex-col gap-3 mb-7">
            <InputField
              name="display_name"
              placeholder="Display name"
              value={form.display_name}
              onChange={handleChange}
            />
            <InputField
              name="username"
              placeholder="Username"
              value={form.username}
              onChange={handleChange}
            />
            <InputField
              icon={<Mail size={16} className="text-[#605850]" />}
              name="email"
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={handleChange}
            />
            <InputField
              icon={<Lock size={16} className="text-[#605850]" />}
              name="password"
              type="password"
              placeholder="Password (min 8 chars)"
              value={form.password}
              onChange={handleChange}
            />
          </div>

          {/* Genre chips */}
          <div className="mb-7">
            <p
              className="text-[#f5f0e8] font-semibold text-sm mb-1"
              style={{ fontFamily: "Syne, sans-serif" }}
            >
              Favourite genres
            </p>
            <p className="text-[#605850] text-[11.5px] mb-3.5">
              Pick a few — we'll tune your home feed.
            </p>
            <div className="flex flex-wrap gap-2">
              {ALL_GENRES.map((genre) => {
                const active = selectedGenres.includes(genre);
                return (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => toggleGenre(genre)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12.5px] font-semibold transition-all"
                    style={{
                      fontFamily: "Syne, sans-serif",
                      background: active ? "rgba(201,168,76,0.12)" : "#111111",
                      border: `1px solid ${active ? "rgba(201,168,76,0.55)" : "#2a2a2a"}`,
                      color: active ? "#e8c97a" : "#b8b0a0",
                    }}
                  >
                    {active && <Check size={11} />}
                    {genre}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-3 py-2.5 mb-4">
              {error}
            </p>
          )}

          {/* Submit */}
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
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        {/* OR divider */}
        <div className="flex items-center gap-3.5 my-6">
          <div className="flex-1 h-px bg-[#2a2a2a]" />
          <span className="text-[#3a3a3a]" style={{ fontSize: 11, letterSpacing: "0.16em" }}>OR</span>
          <div className="flex-1 h-px bg-[#2a2a2a]" />
        </div>

        {/* Google sign-up */}
        <GoogleButton onLoadingChange={setLoading} onError={setError} />

        <p className="text-center text-sm text-[#605850] mt-6">
          Already have one?{" "}
          <Link
            to="/login"
            className="text-[#e8c97a] font-semibold hover:text-[#c9a84c] transition-colors"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

// ── Shared input field ────────────────────────────────────────────────────────

function InputField({
  icon,
  name,
  type = "text",
  placeholder,
  value,
  onChange,
}: {
  icon?: React.ReactNode;
  name: string;
  type?: string;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="flex items-center gap-3 bg-[#111111] border border-[#2a2a2a] rounded-[14px] px-4 h-[52px] focus-within:border-[#c9a84c] transition-colors cursor-text">
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        required
        placeholder={placeholder}
        className="flex-1 bg-transparent border-none outline-none text-sm text-[#f5f0e8] placeholder-[#3a3a3a]"
      />
    </label>
  );
}
