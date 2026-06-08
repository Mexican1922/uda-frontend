import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Mic, MicOff, Loader2, Sparkles, Clock, X } from "lucide-react";

// ── Recent searches (localStorage) ───────────────────────────────────────────
const RECENT_KEY = "uda_recent_searches";
const MAX_RECENT = 6;

function getRecentSearches(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); }
  catch { return []; }
}
function addRecentSearch(q: string) {
  const prev = getRecentSearches().filter((s) => s.toLowerCase() !== q.toLowerCase());
  localStorage.setItem(RECENT_KEY, JSON.stringify([q, ...prev].slice(0, MAX_RECENT)));
}
function removeRecentSearch(q: string) {
  localStorage.setItem(RECENT_KEY, JSON.stringify(getRecentSearches().filter((s) => s !== q)));
}
import { musicApi, recommendationsApi } from "../services/api";
import { usePlayerStore } from "../store/playerStore";
import { useAuthStore } from "../store/authStore";
import { useSavedSongs } from "../hooks/useSavedSongs";
import type { Song } from "../types";
import SongRow from "../components/ui/SongRow";
import AddToPlaylistModal from "../components/ui/AddToPlaylistModal";

type RecordState = "idle" | "listening" | "processing";

// African scenes — tapping runs a curated search.
const BROWSE_CATEGORIES = [
  { label: "Afrobeats",    query: "Afrobeats 2026 hits",        colors: ["#c9a84c", "#6b3a0f"] },
  { label: "Amapiano",     query: "Amapiano 2026 mix",          colors: ["#1a7a4a", "#0a3020"] },
  { label: "Highlife",     query: "Highlife music",             colors: ["#c2410c", "#431407"] },
  { label: "Alté",         query: "Alté Nigeria",               colors: ["#7c3aed", "#3b0764"] },
  { label: "Afro-soul",    query: "Afro soul",                  colors: ["#be123c", "#4c0519"] },
  { label: "Bongo Flava",  query: "Bongo Flava 2026",           colors: ["#0369a1", "#082f49"] },
  { label: "Gqom",         query: "Gqom South Africa",          colors: ["#065f46", "#022c22"] },
  { label: "Hip-Hop",      query: "hip hop 2026",               colors: ["#92400e", "#451a03"] },
];

// Country charts — real most-popular music per market (backend /charts).
const CHART_COUNTRIES = [
  { code: "NG", label: "Nigeria",      flag: "🇳🇬" },
  { code: "GH", label: "Ghana",        flag: "🇬🇭" },
  { code: "ZA", label: "South Africa", flag: "🇿🇦" },
  { code: "KE", label: "Kenya",        flag: "🇰🇪" },
];

// SpeechRecognition has partial browser support — use any to avoid TS noise
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySpeechRecognition = any;

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [isNL, setIsNL] = useState(false);
  const [interpreted, setInterpreted] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [recordState, setRecordState] = useState<RecordState>("idle");
  const [recordError, setRecordError] = useState("");
  const [searchError, setSearchError] = useState("");
  const [playlistSong, setPlaylistSong] = useState<Song | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const { playSong } = usePlayerStore();
  const showToast = usePlayerStore((s) => s.showToast);
  const isGuest = useAuthStore((s) => s.isGuest);
  const { savedIds, toggleSave } = useSavedSongs();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<AnySpeechRecognition>(null);

  // Load recent searches on mount
  useEffect(() => { setRecentSearches(getRecentSearches()); }, []);

  const runSearch = useCallback(async (q: string, nl: boolean) => {
    if (!q.trim()) return;
    setLoading(true);
    setInterpreted("");
    setSearchError("");
    setHasSearched(true);
    addRecentSearch(q.trim());
    setRecentSearches(getRecentSearches());
    try {
      if (nl) {
        const { data } = await recommendationsApi.nlSearch(q);
        setResults(data.results ?? []);
        setInterpreted(data.interpreted_as ?? "");
      } else {
        const { data } = await musicApi.search(q);
        setResults(data.results ?? []);
      }
    } catch (err: any) {
      console.error(err);
      setResults([]);
      // Daily YouTube quota exhausted on the free tier — tell the user plainly
      // that already-found music still plays and to come back tomorrow.
      if (err?.response?.status === 503) {
        setSearchError(
          err?.response?.data?.code === "quota_exceeded"
            ? "You’ve hit today’s search limit on the free tier. Everything you’ve already found still plays — come back tomorrow to search for new music. 🎵"
            : "Search is busy right now — please try again in a moment."
        );
      } else {
        setSearchError("Something went wrong with that search — try again.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(query, isNL);
  };

  // Load a country's chart into the same results view as search.
  const loadChart = useCallback(async (code: string, label: string) => {
    setLoading(true);
    setInterpreted("");
    setSearchError("");
    setHasSearched(true);
    setQuery(label);
    try {
      const { data } = await musicApi.charts(code);
      setResults(data.results ?? []);
    } catch {
      setResults([]);
      setSearchError("Charts are unavailable right now — try again shortly.");
    } finally {
      setLoading(false);
    }
  }, []);

  const startVoice = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setRecordError("Voice search isn't supported in this browser. Try Chrome.");
      return;
    }
    setRecordError("");

    const recognition = new SR();
    recognitionRef.current = recognition;
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setRecordState("listening");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript as string;
      setRecordState("processing");
      setQuery(transcript);
      runSearch(transcript, true).finally(() => setRecordState("idle"));
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      setRecordError(
        event.error === "not-allowed"
          ? "Microphone access denied. Allow it in your browser settings."
          : "Couldn't catch that — try again."
      );
      setRecordState("idle");
    };

    recognition.onend = () => {
      setRecordState((prev: RecordState) => prev === "listening" ? "idle" : prev);
    };

    recognition.start();
  };

  const stopVoice = () => {
    recognitionRef.current?.stop();
    setRecordState("idle");
  };

  const isMicBusy = recordState !== "idle";

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 max-w-3xl">
      <h1
        className="text-2xl md:text-3xl font-bold text-[#f5f0e8] mb-6"
        style={{ fontFamily: "Syne, sans-serif" }}
      >
        Search
      </h1>

      {/* Search form */}
      <form onSubmit={handleSubmit} className="mb-4">
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#605850] pointer-events-none">
            <Search size={16} />
          </div>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              isNL
                ? "Describe what you want to hear…"
                : "Search for a song or artist…"
            }
            className="w-full bg-[#111111] border border-[#2a2a2a] rounded-xl pl-11 pr-24 py-3.5 text-sm text-[#f5f0e8] placeholder-[#3a3a3a] focus:outline-none focus:border-[#c9a84c] transition-colors"
          />

          {/* Mic button — only in AI mode */}
          {isNL && (
            <button
              type="button"
              onClick={isMicBusy ? stopVoice : startVoice}
              title={
                recordState === "listening"
                  ? "Stop recording"
                  : recordState === "processing"
                    ? "Processing…"
                    : "Record voice query"
              }
              className={`absolute right-14 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all ${
                recordState === "listening"
                  ? "text-red-400 bg-red-400/10 animate-pulse"
                  : recordState === "processing"
                    ? "text-[#e8c97a] bg-[#c9a84c15]"
                    : "text-[#605850] hover:text-[#e8c97a] hover:bg-[#c9a84c10]"
              }`}
            >
              {recordState === "processing" ? (
                <Loader2 size={15} className="animate-spin" />
              ) : recordState === "listening" ? (
                <MicOff size={15} />
              ) : (
                <Mic size={15} />
              )}
            </button>
          )}

          <button
            type="submit"
            disabled={loading}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-[#c9a84c] hover:bg-[#e8c97a] text-[#080808] font-semibold rounded-lg text-xs transition-colors disabled:opacity-50"
            style={{ fontFamily: "Syne, sans-serif" }}
          >
            {loading ? "…" : "Go"}
          </button>
        </div>
      </form>

      {/* Mode toggle */}
      <div className="flex items-center gap-2 mb-2">
        <button
          type="button"
          onClick={() => { setIsNL(false); setRecordError(""); }}
          className={`px-3 py-1.5 rounded-full text-xs transition-all border ${
            !isNL
              ? "bg-[#c9a84c15] border-[#c9a84c44] text-[#e8c97a]"
              : "border-[#2a2a2a] text-[#3a3a3a] hover:text-[#605850]"
          }`}
        >
          Normal
        </button>
        <button
          type="button"
          onClick={() => isGuest ? showToast("Sign in to use AI Search") : setIsNL(true)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all border ${
            isNL
              ? "bg-[#2dbe8a22] border-[#2dbe8a44] text-[#2dbe8a]"
              : "border-[#2a2a2a] text-[#3a3a3a] hover:text-[#605850]"
          }`}
        >
          <Sparkles size={11} />
          AI Search
        </button>
      </div>

      {/* AI mode hint */}
      {isNL && recordState === "idle" && !recordError && (
        <p className="text-xs text-[#3a3a3a] mb-5 flex items-center gap-1.5">
          <Mic size={11} />
          Type a vibe or tap the mic to describe what you want to hear
        </p>
      )}

      {/* Recording state banner */}
      {recordState === "listening" && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-400/10 border border-red-400/20 px-3 py-2 rounded-lg mb-4">
          <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse flex-shrink-0" />
          Listening… speak now
          <button onClick={stopVoice} className="ml-auto text-[10px] underline">stop</button>
        </div>
      )}

      {recordState === "processing" && (
        <div className="flex items-center gap-2 text-xs text-[#e8c97a] bg-[#c9a84c10] border border-[#c9a84c22] px-3 py-2 rounded-lg mb-4">
          <Loader2 size={11} className="animate-spin flex-shrink-0" />
          Finding your vibe…
        </div>
      )}

      {/* Mic error */}
      {recordError && (
        <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 px-3 py-2 rounded-lg mb-4">
          {recordError}
        </p>
      )}

      {/* AI interpreted label */}
      {interpreted && (
        <p className="text-xs text-[#2dbe8a] mb-4 bg-[#2dbe8a11] border border-[#2dbe8a22] px-3 py-2 rounded-lg">
          <Sparkles size={11} className="inline mr-1" /> Interpreted as: "{interpreted}"
        </p>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="flex flex-col gap-1">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5">
              <div className="w-7 h-4 rounded bg-[#1a1a1a] animate-pulse flex-shrink-0" />
              <div className="w-11 h-11 rounded-lg bg-[#1a1a1a] animate-pulse flex-shrink-0" />
              <div className="flex-1">
                <div className="h-3.5 w-1/2 bg-[#1a1a1a] rounded animate-pulse mb-1.5" />
                <div className="h-3 w-1/4 bg-[#1a1a1a] rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {!loading && results.length > 0 && (
        <div className="flex flex-col gap-1">
          {results.map((song, i) => (
            <SongRow
              key={song.youtube_id}
              song={song}
              index={i}
              queue={results}
              onPlay={playSong}
              onAction={toggleSave}
              actionIcon={savedIds.has(song.youtube_id) ? <HeartFilledIcon /> : <HeartIcon />}
              onSecondAction={(s) => isGuest ? showToast("Sign in to build playlists") : setPlaylistSong(s)}
              secondActionIcon={<PlaylistAddIcon />}
              onArtistClick={(artist) => navigate(`/artist/${encodeURIComponent(artist)}`)}
            />
          ))}
        </div>
      )}

      {/* Search error (e.g. daily free-tier quota reached) */}
      {!loading && searchError && (
        <div className="mt-4 px-4 py-4 rounded-xl bg-[#c9a84c10] border border-[#c9a84c33] text-center">
          <p className="text-sm text-[#e8c97a] font-medium leading-relaxed" style={{ fontFamily: "Syne, sans-serif" }}>
            {searchError}
          </p>
        </div>
      )}

      {/* No results */}
      {!loading && hasSearched && !searchError && results.length === 0 && (
        <div className="text-center py-16">
          <p className="text-[#3a3a3a] text-sm">No results found for "{query}"</p>
        </div>
      )}

      {/* Recent searches + Browse — shown before any search */}
      {!loading && !hasSearched && (
        <div className="mt-2">

          {/* Recent searches */}
          {recentSearches.length > 0 && (
            <div className="mb-7">
              <p
                className="text-sm font-semibold text-[#f5f0e8] mb-3"
                style={{ fontFamily: "Syne, sans-serif" }}
              >
                Recent
              </p>
              <div className="flex flex-col gap-1">
                {recentSearches.map((s) => (
                  <div key={s} className="flex items-center gap-3 group px-1 py-1.5 rounded-lg hover:bg-[#111111] transition-colors">
                    <Clock size={15} className="text-[#3a3a3a] flex-shrink-0" />
                    <button
                      className="flex-1 text-left text-sm text-[#b8b0a0] hover:text-[#f5f0e8] transition-colors truncate"
                      onClick={() => { setQuery(s); runSearch(s, false); }}
                    >
                      {s}
                    </button>
                    <button
                      className="text-[#3a3a3a] hover:text-[#605850] transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0 p-1"
                      onClick={() => {
                        removeRecentSearch(s);
                        setRecentSearches(getRecentSearches());
                      }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Charts by country */}
          <p
            className="text-sm font-semibold text-[#f5f0e8] mb-3"
            style={{ fontFamily: "Syne, sans-serif" }}
          >
            Charts by country
          </p>
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 mb-7 pb-1">
            {CHART_COUNTRIES.map((c) => (
              <button
                key={c.code}
                onClick={() => loadChart(c.code, `${c.label} Top 30`)}
                className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border border-[#2a2a2a] text-[#b8b0a0] hover:text-[#e8c97a] hover:border-[#c9a84c44] transition-all"
                style={{ fontFamily: "Syne, sans-serif" }}
              >
                <span className="text-base leading-none">{c.flag}</span>
                {c.label}
              </button>
            ))}
          </div>

          {/* Browse grid */}
          <p
            className="text-sm font-semibold text-[#f5f0e8] mb-4"
            style={{ fontFamily: "Syne, sans-serif" }}
          >
            Browse scenes
          </p>
          <div className="grid grid-cols-2 gap-3">
            {BROWSE_CATEGORIES.map((cat) => {
              // 2-letter initials watermark from the category label
              const initials = cat.label
                .split(/\s+/)
                .map((w) => w[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);
              return (
                <button
                  key={cat.label}
                  onClick={() => { setQuery(cat.label); runSearch(cat.query, false); }}
                  className="relative h-20 rounded-xl overflow-hidden text-left focus:outline-none group"
                >
                  <div
                    className="absolute inset-0"
                    style={{ background: `linear-gradient(135deg, ${cat.colors[0]}, ${cat.colors[1]})` }}
                  />
                  {/* Large initials watermark */}
                  <span
                    className="absolute right-2 top-1/2 -translate-y-1/2 font-extrabold select-none pointer-events-none leading-none"
                    style={{
                      fontFamily: "Syne, sans-serif",
                      fontSize: 64,
                      color: "rgba(255,255,255,0.18)",
                      letterSpacing: "-0.04em",
                    }}
                  >
                    {initials}
                  </span>
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                  <span
                    className="absolute bottom-3 left-4 text-sm font-bold text-white"
                    style={{ fontFamily: "Syne, sans-serif" }}
                  >
                    {cat.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {playlistSong && (
        <AddToPlaylistModal
          song={playlistSong}
          onClose={() => setPlaylistSong(null)}
        />
      )}
    </div>
  );
}

function HeartIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

// Saved state — gold filled heart (explicit colour so it reads as "saved"
// regardless of the row's hover colour).
function HeartFilledIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="#e8c97a" stroke="none">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function PlaylistAddIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="15" y2="6" />
      <line x1="3" y1="12" x2="15" y2="12" />
      <line x1="3" y1="18" x2="9" y2="18" />
      <line x1="19" y1="15" x2="19" y2="21" />
      <line x1="16" y1="18" x2="22" y2="18" />
    </svg>
  );
}
