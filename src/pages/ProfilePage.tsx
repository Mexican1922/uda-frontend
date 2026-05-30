import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authApi, historyApi, libraryApi } from "../services/api";
import { useAuthStore } from "../store/authStore";
import { usePlayerStore } from "../store/playerStore";
import type { Song } from "../types";
import SongRow from "../components/ui/SongRow";
import GuestPrompt from "../components/ui/GuestPrompt";
import { UserRound } from "lucide-react";
import { clientCache, TTL } from "../services/cache";
import { usePWAInstall } from "../hooks/usePWAInstall";

export default function ProfilePage() {
  const { user, logout, isGuest } = useAuthStore();
  const { playSong } = usePlayerStore();
  const navigate = useNavigate();
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [playlistCount, setPlaylistCount] = useState<number | null>(null);
  const [historyCount, setHistoryCount] = useState<number | null>(null);
  const [recentHistory, setRecentHistory] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isGuest) { setLoading(false); return; }
    const load = async () => {
      try {
        // History: read from shared cache if HomePage already populated it
        const cachedHistory = clientCache.get<any[]>("history");
        const [savedRes, plRes, histRes] = await Promise.all([
          libraryApi.getSaved(),
          libraryApi.getPlaylists(),
          cachedHistory
            ? Promise.resolve({ data: cachedHistory })
            : historyApi.getHistory().then((res) => {
                if (res.data?.length) clientCache.set("history", res.data, TTL.MEDIUM);
                return res;
              }),
        ]);
        setSavedCount(savedRes.data.length);
        setPlaylistCount(plRes.data.length);
        setHistoryCount(histRes.data.length);

        const seen = new Set<string>();
        const unique: Song[] = [];
        for (const entry of histRes.data) {
          if (!seen.has(entry.song.youtube_id)) {
            seen.add(entry.song.youtube_id);
            unique.push(entry.song);
          }
        }
        setRecentHistory(unique.slice(0, 5));
      } catch {}
      finally { setLoading(false); }
    };
    load();
  }, [isGuest]);

  const { canInstall, install, isInstalled } = usePWAInstall();

  const handleLogout = async () => {
    const refresh = localStorage.getItem("uda_refresh") || "";
    try { await authApi.logout(refresh); } catch {}
    logout();
    navigate("/login");
  };

  const initials = user?.display_name
    ? user.display_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : (user?.username?.[0]?.toUpperCase() ?? "U");

  const memberSince = user?.date_joined
    ? new Date(user.date_joined).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "";

  // Rough listening hours: assume avg ~3 min per history entry
  const listeningHours =
    historyCount !== null ? Math.round((historyCount * 3) / 60) : null;

  const fmt = (n: number | null) => (n === null ? "—" : String(n));

  if (isGuest) {
    return (
      <div className="max-w-2xl pb-10">
        <div className="px-4 md:px-8 pt-6 md:pt-8">
          <h1
            className="text-2xl md:text-3xl font-bold text-[#f5f0e8]"
            style={{ fontFamily: "Syne, sans-serif" }}
          >
            Profile
          </h1>
        </div>
        <GuestPrompt
          icon={<UserRound size={28} />}
          title="You're browsing as a guest"
          desc="Sign in to keep your library, listening history, and recommendations in sync everywhere."
        />
      </div>
    );
  }

  return (
    <div className="max-w-2xl pb-10">

      {/* ── Header: avatar + identity ─────────────────────────────────────── */}
      <div className="px-4 md:px-8 pt-6 md:pt-8 pb-5">
        <div className="flex items-center gap-5">
          {/* Avatar */}
          <div
            className="w-[76px] h-[76px] rounded-full flex items-center justify-center flex-shrink-0 shadow-lg"
            style={{
              background: "linear-gradient(135deg, #c9a84c, #e8c97a)",
            }}
          >
            <span
              className="text-2xl font-extrabold text-[#080808]"
              style={{ fontFamily: "Syne, sans-serif" }}
            >
              {initials}
            </span>
          </div>

          {/* Identity */}
          <div className="min-w-0">
            <h1
              className="text-xl font-bold text-[#f5f0e8] leading-tight truncate"
              style={{ fontFamily: "Syne, sans-serif" }}
            >
              {user?.display_name || user?.username}
            </h1>
            <p className="text-sm text-[#605850] mt-0.5 truncate">@{user?.username}</p>
            {memberSince && (
              <p className="text-xs text-[#3a3a3a] mt-1">Member since {memberSince}</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Stats row ─────────────────────────────────────────────────────── */}
      <div className="mx-4 md:mx-8 mb-6">
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "#111111", border: "1px solid #2a2a2a" }}
        >
          <div className="grid grid-cols-3">
            {[
              { label: "Saved", hint: "songs",     value: fmt(savedCount) },
              { label: "Playlists", hint: "made",  value: fmt(playlistCount) },
              { label: "Listening", hint: "hours", value: loading ? "—" : fmt(listeningHours) },
            ].map((stat, i) => (
              <div
                key={stat.label}
                className={`py-4 text-center ${i > 0 ? "border-l border-[#2a2a2a]" : ""}`}
              >
                <p
                  className="text-[22px] font-extrabold text-[#e8c97a] leading-none"
                  style={{ fontFamily: "Syne, sans-serif", fontVariantNumeric: "tabular-nums" }}
                >
                  {stat.value}
                </p>
                <p
                  className="text-[10px] text-[#605850] mt-1.5 uppercase tracking-[0.08em] font-semibold"
                >
                  {stat.label} {stat.hint}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Account section ───────────────────────────────────────────────── */}
      <ProfileSection title="Account">
        <ProfileRow label="Display name" value={user?.display_name || "—"} />
        <ProfileRow label="Username" value={`@${user?.username || "—"}`} />
        <ProfileRow label="Email" value={user?.email || "—"} last />
      </ProfileSection>

      {/* ── Preferences ───────────────────────────────────────────────────── */}
      <ProfileSection title="Preferences">
        {user?.favourite_genres && user.favourite_genres.length > 0 ? (
          <div className="px-4 py-4">
            <p className="text-sm text-[#b8b0a0] mb-3">Favourite genres</p>
            <div className="flex flex-wrap gap-2">
              {user.favourite_genres.map((genre) => (
                <span
                  key={genre}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={{
                    fontFamily: "Syne, sans-serif",
                    background: "rgba(201,168,76,0.1)",
                    border: "1px solid rgba(201,168,76,0.33)",
                    color: "#e8c97a",
                  }}
                >
                  {genre}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="px-4 py-4">
            <p className="text-sm text-[#3a3a3a]">No genres selected yet.</p>
          </div>
        )}
      </ProfileSection>

      {/* ── App section ───────────────────────────────────────────────────── */}
      {recentHistory.length > 0 && (
        <ProfileSection title="Recent listens">
          <div className="py-2">
            {recentHistory.map((song, i) => (
              <SongRow
                key={song.youtube_id}
                song={song}
                index={i}
                queue={recentHistory}
                onPlay={playSong}
                onArtistClick={(artist) => navigate(`/artist/${encodeURIComponent(artist)}`)}
              />
            ))}
          </div>
        </ProfileSection>
      )}

      {/* ── Install app banner ────────────────────────────────────────────── */}
      {canInstall && (
        <div className="px-4 md:px-8 mt-6">
          <button
            onClick={install}
            className="w-full rounded-xl flex items-center gap-4 px-4 py-3.5 transition-all hover:opacity-90"
            style={{ background: "linear-gradient(135deg, rgba(201,168,76,0.15), rgba(201,168,76,0.05))", border: "1px solid rgba(201,168,76,0.3)" }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
              <img src="/icons/icon-192.png" alt="Ụda" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-[#e8c97a]" style={{ fontFamily: "Syne, sans-serif" }}>
                Install Ụda App
              </p>
              <p className="text-xs text-[#605850] mt-0.5">Add to home screen for the best experience</p>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c9a84c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>
        </div>
      )}
      {isInstalled && (
        <div className="px-4 md:px-8 mt-6">
          <div className="rounded-xl flex items-center gap-3 px-4 py-3 bg-[#111111] border border-[#2a2a2a]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2dbe8a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5"/>
            </svg>
            <p className="text-sm text-[#b8b0a0]">Ụda is installed on this device</p>
          </div>
        </div>
      )}

      {/* ── Logout button ─────────────────────────────────────────────────── */}
      <div className="px-4 md:px-8 mt-6">
        <button
          onClick={handleLogout}
          className="w-full h-12 rounded-xl flex items-center justify-center gap-2.5 font-semibold text-sm transition-all hover:opacity-90"
          style={{
            fontFamily: "Syne, sans-serif",
            letterSpacing: "0.04em",
            background: "rgba(190,18,60,0.08)",
            border: "1px solid rgba(190,18,60,0.3)",
            color: "#f87171",
          }}
        >
          <SignOutIcon />
          Log out
        </button>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ProfileSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5 px-4 md:px-8">
      <p
        className="text-[11px] font-semibold text-[#3a3a3a] uppercase tracking-[0.16em] mb-2 px-1"
        style={{ fontFamily: "Syne, sans-serif" }}
      >
        {title}
      </p>
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "#111111", border: "1px solid #2a2a2a" }}
      >
        {children}
      </div>
    </div>
  );
}

function ProfileRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between px-4 py-3.5 ${
        !last ? "border-b border-[#1a1a1a]" : ""
      }`}
    >
      <span className="text-sm text-[#605850]">{label}</span>
      <span className="text-sm text-[#b8b0a0] truncate max-w-[60%] text-right">{value}</span>
    </div>
  );
}

function SignOutIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
