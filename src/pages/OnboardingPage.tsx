import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Check, Plus } from "lucide-react";

// ── Genre options with gradient backgrounds ───────────────────────────────────
const GENRES = [
  { name: "Afrobeats",  gradient: "linear-gradient(135deg,#c9a84c,#3a1f06)" },
  { name: "Amapiano",   gradient: "linear-gradient(135deg,#2dbe8a,#06241a)" },
  { name: "R&B",        gradient: "linear-gradient(135deg,#7c3aed,#220546)" },
  { name: "Hip-hop",    gradient: "linear-gradient(135deg,#be123c,#310615)" },
  { name: "Afropop",    gradient: "linear-gradient(135deg,#c2410c,#2a0d04)" },
  { name: "Soul",       gradient: "linear-gradient(135deg,#0369a1,#03253c)" },
  { name: "Highlife",   gradient: "linear-gradient(135deg,#c9a84c,#06241a)" },
  { name: "Gospel",     gradient: "linear-gradient(135deg,#be123c,#220546)" },
];

// ── Artist picks ──────────────────────────────────────────────────────────────
const ARTISTS = [
  "Burna Boy", "Asake", "Rema", "Wizkid", "Tems",
  "Davido", "Tiwa Savage", "Omah Lay", "Fireboy DML", "Adekunle Gold",
];

function artistInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

// 6 gradients for avatar placeholders
const AV_GRADS = [
  ["#c9a84c","#6b3a0f"], ["#1a7a4a","#0a3020"], ["#7c3aed","#3b0764"],
  ["#be123c","#4c0519"], ["#0369a1","#082f49"], ["#c2410c","#431407"],
];
function artistGrad(name: string) {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AV_GRADS[h % AV_GRADS.length];
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);   // 0 = genres, 1 = artists, 2 = done
  const [selectedGenres, setSelectedGenres] = useState<string[]>(["Afrobeats", "R&B"]);
  const [followedArtists, setFollowedArtists] = useState<string[]>(["Burna Boy", "Tems"]);

  const toggleGenre = (g: string) =>
    setSelectedGenres((p) => p.includes(g) ? p.filter((x) => x !== g) : [...p, g]);

  const toggleArtist = (a: string) =>
    setFollowedArtists((p) => p.includes(a) ? p.filter((x) => x !== a) : [...p, a]);

  const STEP_LABELS = ["Pick your vibe", "Follow artists", "You're in"];

  return (
    <div className="min-h-screen bg-[#080808] flex flex-col overflow-hidden relative">

      {/* Ambient glow */}
      <div
        className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(201,168,76,0.14) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      {/* Progress dots */}
      <div className="flex justify-center gap-2 pt-5 pb-1 z-10">
        {STEP_LABELS.map((_, i) => (
          <div
            key={i}
            className="h-1 rounded-full transition-all duration-300"
            style={{
              width: i === step ? 24 : 8,
              background: i === step ? "#e8c97a" : i < step ? "rgba(201,168,76,0.4)" : "#2a2a2a",
            }}
          />
        ))}
      </div>

      {/* ── STEP 0: Genre picker ──────────────────────────────────────────── */}
      {step === 0 && (
        <div className="flex flex-col flex-1 overflow-auto px-5 pt-6 pb-10 z-10 max-w-lg mx-auto w-full">
          <h1
            className="font-extrabold text-[26px] leading-[1.15] mb-1.5"
            style={{ fontFamily: "Syne, sans-serif", letterSpacing: "-0.02em" }}
          >
            <span className="text-white">Pick your</span><br />
            <span className="text-[#e8c97a]">vibe.</span>
          </h1>
          <p className="text-[#605850] text-sm mb-6">
            Choose at least 1 genre — we'll build your home feed around them.
          </p>

          <div className="flex flex-wrap gap-2.5 flex-1">
            {GENRES.map((g) => {
              const active = selectedGenres.includes(g.name);
              return (
                <button
                  key={g.name}
                  onClick={() => toggleGenre(g.name)}
                  className="relative overflow-hidden flex items-center gap-2 px-4 py-3 rounded-2xl font-bold text-[13.5px] transition-all"
                  style={{
                    fontFamily: "Syne, sans-serif",
                    background: active ? g.gradient : "#111111",
                    border: `1.5px solid ${active ? "transparent" : "#2a2a2a"}`,
                    color: active ? "white" : "#b8b0a0",
                    boxShadow: active ? "0 6px 20px rgba(0,0,0,0.35)" : "none",
                  }}
                >
                  {active && (
                    <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.12),transparent)" }} />
                  )}
                  {active && <Check size={13} className="flex-shrink-0 relative" />}
                  <span className="relative">{g.name}</span>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => selectedGenres.length >= 1 && setStep(1)}
            disabled={selectedGenres.length < 1}
            className="mt-6 h-[52px] w-full rounded-[14px] font-bold text-[15px] transition-all disabled:opacity-40"
            style={{
              fontFamily: "Syne, sans-serif",
              letterSpacing: "0.04em",
              background: selectedGenres.length >= 1
                ? "linear-gradient(180deg, #e8c97a 0%, #c9a84c 100%)"
                : "#2a2a2a",
              color: selectedGenres.length >= 1 ? "#080808" : "#605850",
              boxShadow: selectedGenres.length >= 1 ? "0 8px 24px rgba(201,168,76,0.35)" : "none",
            }}
          >
            Continue {selectedGenres.length >= 1 && `(${selectedGenres.length} picked)`}
          </button>
        </div>
      )}

      {/* ── STEP 1: Follow artists ────────────────────────────────────────── */}
      {step === 1 && (
        <div className="flex flex-col flex-1 overflow-auto px-5 pt-5 pb-10 z-10 max-w-lg mx-auto w-full">
          <button
            onClick={() => setStep(0)}
            className="flex items-center gap-1.5 text-[#605850] hover:text-[#b8b0a0] transition-colors mb-4"
          >
            <ChevronLeft size={16} />
            <span className="text-xs">Back</span>
          </button>

          <h1
            className="font-extrabold text-[26px] leading-[1.15] mb-1.5"
            style={{ fontFamily: "Syne, sans-serif", letterSpacing: "-0.02em" }}
          >
            <span className="text-white">Follow</span><br />
            <span className="text-[#e8c97a]">your artists.</span>
          </h1>
          <p className="text-[#605850] text-sm mb-5">
            Your personalised mixes will include their latest drops.
          </p>

          <div className="grid grid-cols-2 gap-2.5 flex-1">
            {ARTISTS.map((name) => {
              const following = followedArtists.includes(name);
              const [from, to] = artistGrad(name);
              return (
                <button
                  key={name}
                  onClick={() => toggleArtist(name)}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl transition-all text-left"
                  style={{
                    background: following ? "rgba(201,168,76,0.08)" : "#111111",
                    border: `1.5px solid ${following ? "rgba(201,168,76,0.4)" : "#2a2a2a"}`,
                  }}
                >
                  {/* Avatar */}
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
                  >
                    <span
                      className="text-xs font-bold text-white/80"
                      style={{ fontFamily: "Syne, sans-serif" }}
                    >
                      {artistInitials(name)}
                    </span>
                  </div>

                  <span
                    className="flex-1 text-xs font-semibold truncate"
                    style={{
                      fontFamily: "Syne, sans-serif",
                      color: following ? "#e8c97a" : "white",
                    }}
                  >
                    {name}
                  </span>

                  {/* Follow toggle circle */}
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                    style={{
                      background: following ? "rgba(201,168,76,0.2)" : "transparent",
                      border: `1.5px solid ${following ? "rgba(201,168,76,0.6)" : "#3a3a3a"}`,
                      color: following ? "#e8c97a" : "#605850",
                    }}
                  >
                    {following ? <Check size={10} /> : <Plus size={10} />}
                  </div>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setStep(2)}
            className="mt-5 h-[52px] w-full rounded-[14px] font-bold text-[15px] text-[#080808]"
            style={{
              fontFamily: "Syne, sans-serif",
              letterSpacing: "0.04em",
              background: "linear-gradient(180deg, #e8c97a 0%, #c9a84c 100%)",
              boxShadow: "0 8px 24px rgba(201,168,76,0.35), inset 0 1px 0 rgba(255,255,255,0.3)",
            }}
          >
            Done{followedArtists.length > 0 ? ` · Following ${followedArtists.length}` : ""}
          </button>
        </div>
      )}

      {/* ── STEP 2: Celebration ───────────────────────────────────────────── */}
      {step === 2 && (
        <div className="flex flex-col flex-1 items-center justify-center px-7 pb-10 z-10 max-w-sm mx-auto w-full">
          {/* Gold celebration ring */}
          <div className="relative mb-8">
            <div
              className="w-28 h-28 rounded-full flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #e8c97a, #c9a84c)",
                boxShadow: "0 0 0 18px rgba(201,168,76,0.08), 0 0 0 36px rgba(201,168,76,0.04)",
              }}
            >
              <span style={{ fontSize: 52 }}>✨</span>
            </div>
          </div>

          <h1
            className="text-[30px] font-extrabold text-[#e8c97a] text-center leading-[1.1] mb-3"
            style={{ fontFamily: "Syne, sans-serif", letterSpacing: "-0.02em" }}
          >
            You're all set.
          </h1>
          <p className="text-sm text-[#b8b0a0] text-center leading-relaxed mb-7">
            Your personalised Ụda feed is ready.<br />Let the music find you.
          </p>

          {/* Summary card */}
          <div
            className="w-full rounded-2xl p-4 flex flex-col gap-3 mb-7"
            style={{ background: "#111111", border: "1px solid #2a2a2a" }}
          >
            {[
              { icon: "🎭", label: `${selectedGenres.length} genres selected` },
              { icon: "⭐", label: `${followedArtists.length} artists followed` },
              { icon: "🎵", label: "Personalised feed ready" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 text-sm">
                <span className="text-lg">{item.icon}</span>
                <span className="text-[#b8b0a0] flex-1">{item.label}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2dbe8a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            ))}
          </div>

          <button
            onClick={() => navigate("/")}
            className="w-full h-14 rounded-[14px] font-bold text-[16px] text-[#080808]"
            style={{
              fontFamily: "Syne, sans-serif",
              letterSpacing: "0.04em",
              background: "linear-gradient(180deg, #e8c97a 0%, #c9a84c 100%)",
              boxShadow: "0 8px 24px rgba(201,168,76,0.35), inset 0 1px 0 rgba(255,255,255,0.3)",
            }}
          >
            Enter Ụda
          </button>
        </div>
      )}
    </div>
  );
}
