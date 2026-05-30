import { useState, useEffect, useRef, useLayoutEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown, SkipBack, SkipForward, Play, Pause,
  Shuffle, Repeat, Repeat1, Heart, ListPlus,
  Volume2, VolumeX, Music, Video, Loader2, X, ListMusic, Mic, Sparkles, Share2,
} from "lucide-react";
import { usePlayerStore } from "../../store/playerStore";
import { useAuthStore } from "../../store/authStore";
import { libraryApi, recommendationsApi } from "../../services/api";
import type { Song } from "../../types";
import AddToPlaylistModal from "../ui/AddToPlaylistModal";
import ShareSheet from "../ui/ShareSheet";

// ── LRCLIB helpers ────────────────────────────────────────────────────────────

interface LrcLine {
  time: number;
  text: string;
}

function parseLrc(lrc: string): LrcLine[] {
  const lines: LrcLine[] = [];
  const re = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;
  for (const raw of lrc.split("\n")) {
    const m = raw.match(re);
    if (!m) continue;
    const time =
      parseInt(m[1]) * 60 +
      parseInt(m[2]) +
      parseInt(m[3]) / (m[3].length === 3 ? 1000 : 100);
    const text = m[4].trim();
    if (text) lines.push({ time, text });
  }
  return lines.sort((a, b) => a.time - b.time);
}

async function fetchLyrics(title: string, artist: string) {
  try {
    const res = await fetch(
      `https://lrclib.net/api/get?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (res.status === 404) return { synced: [], plain: "" };
    if (!res.ok) throw new Error("HTTP " + res.status);
    const d = await res.json();
    return {
      synced: d.syncedLyrics ? parseLrc(d.syncedLyrics) : [],
      plain: d.plainLyrics ?? "",
    };
  } catch {
    return { synced: [], plain: "" };
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
}

export default function NowPlayingScreen({ onClose }: Props) {
  const {
    currentSong, isPlaying, progress, currentTime, duration,
    repeatMode, isShuffled, volume, isMuted, isVideoMode,
    queue, currentIndex,
    voiceEnabled, voiceSupported, voiceListening, toggleVoice,
    togglePlay, nextSong, prevSong, toggleRepeat, toggleShuffle,
    seekTo, setVolume, toggleMute, toggleVideoMode, jumpTo, removeFromQueue,
    setNowPlayingOpen, setAlbumArtBounds,
  } = usePlayerStore();
  const showToast = usePlayerStore((s) => s.showToast);
  const isGuest = useAuthStore((s) => s.isGuest);

  const navigate = useNavigate();

  // Tapping any artist name closes the player sheet and opens their page.
  const goToArtist = (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    if (!name) return;
    onClose();
    navigate(`/artist/${encodeURIComponent(name)}`);
  };

  const [tab, setTab]               = useState<"playing" | "lyrics" | "queue">("playing");
  const [saved, setSaved]           = useState(false);
  const [playlistSong, setPlaylistSong] = useState<Song | null>(null);

  // Lyrics Decoder — tap a line to translate Naija slang to plain English.
  const [decodeMode, setDecodeMode]     = useState(false);
  const [expandedLine, setExpandedLine] = useState<string | null>(null);
  const [decodingLine, setDecodingLine] = useState<string | null>(null);
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [shareLyric, setShareLyric]     = useState<string | null>(null);

  // Lyrics
  const [syncedLyrics, setSyncedLyrics]   = useState<LrcLine[]>([]);
  const [plainLyrics, setPlainLyrics]     = useState("");
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [lyricsFound, setLyricsFound]     = useState(true);
  const [activeLine, setActiveLine]       = useState(-1);

  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const activeLineRef      = useRef<HTMLDivElement>(null);
  const albumArtRef        = useRef<HTMLDivElement>(null);
  const lyricsVideoRef     = useRef<HTMLDivElement>(null);

  // ── Register open/closed with the store ──────────────────────────────────
  useEffect(() => {
    setNowPlayingOpen(true);
    return () => {
      setNowPlayingOpen(false);
      setAlbumArtBounds(null);
    };
  }, []);

  // ── Measure the active video slot and tell YouTubePlayer where to render ──
  // Video shows in the album-art square on the "playing" tab, and in a 16:9
  // slot at the top of the "lyrics" tab. On the "queue" tab it falls back to
  // the floating PiP (bounds = null).
  const measureVideoSlot = useCallback(() => {
    const el = tab === "lyrics" ? lyricsVideoRef.current : albumArtRef.current;
    if (!el) { setAlbumArtBounds(null); return; }
    const r = el.getBoundingClientRect();
    setAlbumArtBounds({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [tab, setAlbumArtBounds]);

  useLayoutEffect(() => {
    if (isVideoMode && (tab === "playing" || tab === "lyrics")) {
      measureVideoSlot();
    } else {
      setAlbumArtBounds(null);
    }
  }, [isVideoMode, tab]);

  // Re-measure on resize (orientation change on mobile)
  useEffect(() => {
    if (!isVideoMode) return;
    window.addEventListener("resize", measureVideoSlot);
    return () => window.removeEventListener("resize", measureVideoSlot);
  }, [isVideoMode, measureVideoSlot]);

  if (!currentSong) return null;

  // ── Lyrics fetch ──────────────────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    setSyncedLyrics([]);
    setPlainLyrics("");
    setActiveLine(-1);
    setLyricsFound(true);
    setLyricsLoading(true);
    setExpandedLine(null);
    setExplanations({});
    fetchLyrics(currentSong.title, currentSong.artist).then(({ synced, plain }) => {
      setSyncedLyrics(synced);
      setPlainLyrics(plain);
      setLyricsFound(synced.length > 0 || plain.length > 0);
      setLyricsLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSong.youtube_id]);

  // ── Active lyric line tracking ────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!syncedLyrics.length) return;
    let idx = -1;
    for (let i = 0; i < syncedLyrics.length; i++) {
      if (syncedLyrics[i].time <= currentTime) idx = i;
      else break;
    }
    setActiveLine(idx);
  }, [currentTime, syncedLyrics]);

  // ── Auto-scroll lyrics ────────────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (activeLineRef.current) {
      activeLineRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeLine]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seekTo(pct * duration);   // ← actual YouTube seek now
  };

  const handleSave = async () => {
    try {
      await libraryApi.saveSong({
        youtube_id: currentSong.youtube_id,
        title: currentSong.title,
        artist: currentSong.artist,
        thumbnail_url: currentSong.thumbnail_url,
      });
      setSaved(true);
    } catch {}
  };

  const seekToLine = (time: number) => seekTo(time);

  // Lyrics Decoder: in decode mode, tapping a line asks Claude what it means
  // (Pidgin/Yoruba/Igbo/slang → plain English) instead of seeking to it.
  const handleLineTap = (text: string, time?: number) => {
    if (!decodeMode) {
      if (time !== undefined) seekToLine(time);
      return;
    }
    const line = text.trim();
    if (!line) return;
    // Toggle closed if already open.
    if (expandedLine === line) { setExpandedLine(null); return; }
    setExpandedLine(line);
    if (explanations[line] || decodingLine) return;   // cached or busy
    if (isGuest) { showToast("Sign in to decode lyrics"); setExpandedLine(null); return; }
    setDecodingLine(line);
    recommendationsApi
      .explainLyric({ line, title: currentSong.title, artist: currentSong.artist })
      .then(({ data }) => setExplanations((prev) => ({ ...prev, [line]: data.explanation })))
      .catch(() => { showToast("Couldn't decode that line"); setExpandedLine(null); })
      .finally(() => setDecodingLine(null));
  };

  const fmt = (s: number) => {
    const m   = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const repeatActive = repeatMode !== "off";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#080808]">
      {/* Ambient background */}
      <div
        className="absolute inset-0 opacity-20 bg-cover bg-center blur-3xl scale-110"
        style={{ backgroundImage: `url(${currentSong.thumbnail_url})` }}
      />
      <div className="absolute inset-0 bg-[#080808]/70" />

      <div className="relative flex flex-col flex-1 overflow-hidden">

        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-1">
            <button
              onClick={onClose}
              className="p-2 text-[#605850] hover:text-[#f5f0e8] transition-colors"
            >
              <ChevronDown size={24} />
            </button>

            {/* Voice control toggle — only when the browser supports it */}
            {voiceSupported && (
              <button
                onClick={toggleVoice}
                title={voiceEnabled ? "Voice control on — say “Uda, next”" : "Enable voice control"}
                className={`relative p-2 rounded-full transition-colors ${
                  voiceEnabled ? "text-[#e8c97a]" : "text-[#3a3a3a] hover:text-[#605850]"
                }`}
              >
                <Mic size={18} />
                {voiceListening && (
                  <span className="absolute inset-0 rounded-full border border-[#e8c97a]/40 animate-ping pointer-events-none" />
                )}
              </button>
            )}
          </div>

          <p className="text-xs text-[#605850] uppercase tracking-widest">Now Playing</p>

          {/* Video / Audio toggle — always visible */}
          <button
            onClick={toggleVideoMode}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
              isVideoMode
                ? "bg-[#c9a84c15] border-[#c9a84c55] text-[#e8c97a]"
                : "border-[#2a2a2a] text-[#605850] hover:text-[#b8b0a0] hover:border-[#3a3a3a]"
            }`}
          >
            {isVideoMode ? <Music size={12} /> : <Video size={12} />}
            <span>{isVideoMode ? "Audio" : "Video"}</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 self-center mb-4 bg-[#111111]/80 rounded-xl p-1 flex-shrink-0">
          {(["playing", "lyrics", "queue"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
                tab === t
                  ? "bg-[#1a1a1a] text-[#e8c97a]"
                  : "text-[#605850] hover:text-[#b8b0a0]"
              }`}
              style={tab === t ? { fontFamily: "Syne, sans-serif" } : {}}
            >
              {t}
            </button>
          ))}
        </div>

        {/* ── Tab: playing ────────────────────────────────────────────────── */}
        {tab === "playing" ? (
          <div className="flex-1 overflow-y-auto no-scrollbar px-6 pb-6">

            {/* Album art / video slot */}
            <div className="flex justify-center mb-8">
              <div
                ref={albumArtRef}
                className="relative w-64 h-64 md:w-72 md:h-72 rounded-2xl overflow-hidden shadow-2xl"
              >
                {/* Always render the img for layout; hide it when video is active
                    so the slot div keeps its size but the iframe is visible on top */}
                <img
                  src={currentSong.thumbnail_url}
                  alt={currentSong.title}
                  className={`w-full h-full object-cover transition-all duration-500 ${
                    isVideoMode ? "opacity-0" : isPlaying ? "scale-100" : "scale-95 opacity-80"
                  }`}
                />
                {/* When NOT in video mode, show the pulse ring */}
                {isPlaying && !isVideoMode && (
                  <div className="absolute -inset-3 rounded-3xl border border-[#c9a84c]/10 animate-pulse pointer-events-none" />
                )}
                {/* Video mode label overlay (fades in while video loads) */}
                {isVideoMode && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <Video size={28} className="text-white/40" />
                  </div>
                )}
              </div>
            </div>

            {/* Song info + save */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex-1 min-w-0 pr-4">
                <h2
                  className="text-xl font-bold text-[#f5f0e8] truncate leading-tight"
                  style={{ fontFamily: "Syne, sans-serif" }}
                >
                  {currentSong.title}
                </h2>
                <span
                  role="link"
                  onClick={(e) => goToArtist(e, currentSong.artist)}
                  className="text-sm text-[#605850] hover:text-[#e8c97a] truncate mt-1 block w-fit max-w-full transition-colors"
                >
                  {currentSong.artist}
                </span>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 pt-1">
                <button
                  onClick={() => setPlaylistSong(currentSong)}
                  className="text-[#605850] hover:text-[#e8c97a] transition-colors"
                  title="Add to playlist"
                >
                  <ListPlus size={20} />
                </button>
                <button
                  onClick={handleSave}
                  className={`transition-colors ${saved ? "text-[#e8c97a]" : "text-[#605850] hover:text-[#e8c97a]"}`}
                >
                  <Heart size={20} fill={saved ? "currentColor" : "none"} />
                </button>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-5">
              <div
                onClick={handleSeek}
                className="h-1.5 bg-[#2a2a2a] rounded-full cursor-pointer group mb-2 relative"
              >
                <div
                  className="h-full bg-[#e8c97a] rounded-full relative transition-all duration-300"
                  style={{ width: `${progress}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-[#e8c97a] rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-[#3a3a3a] tabular-nums">{fmt(currentTime)}</span>
                <span className="text-xs text-[#3a3a3a] tabular-nums">{fmt(duration)}</span>
              </div>
            </div>

            {/* Playback controls */}
            <div className="flex items-center justify-between mb-8">
              <button
                onClick={toggleShuffle}
                className={`p-2 transition-colors ${isShuffled ? "text-[#e8c97a]" : "text-[#3a3a3a] hover:text-[#605850]"}`}
              >
                <Shuffle size={20} />
              </button>
              <button onClick={prevSong} className="p-2 text-[#b8b0a0] hover:text-[#f5f0e8] transition-colors">
                <SkipBack size={28} fill="currentColor" />
              </button>
              <button
                onClick={togglePlay}
                className="w-16 h-16 rounded-full bg-[#e8c97a] text-[#080808] flex items-center justify-center hover:bg-[#c9a84c] hover:scale-105 active:scale-95 transition-all shadow-lg shadow-[#c9a84c]/20 flex-shrink-0"
              >
                {isPlaying
                  ? <Pause size={26} fill="currentColor" />
                  : <Play  size={26} fill="currentColor" className="ml-1" />}
              </button>
              <button onClick={nextSong} className="p-2 text-[#b8b0a0] hover:text-[#f5f0e8] transition-colors">
                <SkipForward size={28} fill="currentColor" />
              </button>
              <button
                onClick={toggleRepeat}
                className={`p-2 transition-colors ${repeatActive ? "text-[#e8c97a]" : "text-[#3a3a3a] hover:text-[#605850]"}`}
              >
                {repeatMode === "one" ? <Repeat1 size={20} /> : <Repeat size={20} />}
              </button>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-3">
              <button
                onClick={toggleMute}
                className="text-[#3a3a3a] hover:text-[#605850] transition-colors flex-shrink-0"
              >
                {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <input
                type="range" min={0} max={100}
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="flex-1 h-1 accent-[#c9a84c] cursor-pointer"
              />
            </div>
          </div>

        ) : tab === "lyrics" ? (
        /* ── Tab: lyrics ──────────────────────────────────────────────────── */
          <div className="flex-1 overflow-hidden flex flex-col px-2">
            {/* Video slot — keeps the video visible above the lyrics in video mode */}
            {isVideoMode && (
              <div
                ref={lyricsVideoRef}
                className="mx-3 mb-3 rounded-xl overflow-hidden aspect-video bg-black flex-shrink-0 flex items-center justify-center border border-[#1a1a1a]"
              >
                <Video size={24} className="text-white/25" />
              </div>
            )}

            {/* Lyrics Decoder toggle — tap a line to translate Naija slang */}
            {!lyricsLoading && lyricsFound && (
              <div className="flex items-center justify-between px-4 pb-2 flex-shrink-0">
                <span className="text-[10px] text-[#3a3a3a] uppercase tracking-widest">
                  {decodeMode ? "Tap a line to decode" : "Lyrics"}
                </span>
                <button
                  onClick={() => { setDecodeMode((d) => !d); setExpandedLine(null); }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                    decodeMode
                      ? "bg-[#c9a84c1a] border-[#c9a84c55] text-[#e8c97a]"
                      : "border-[#2a2a2a] text-[#605850] hover:text-[#b8b0a0] hover:border-[#3a3a3a]"
                  }`}
                  style={{ fontFamily: "Syne, sans-serif" }}
                  title="Translate Pidgin/Yoruba/Igbo slang to plain English"
                >
                  <Sparkles size={12} />
                  Decode
                </button>
              </div>
            )}
            {lyricsLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 size={24} className="text-[#605850] animate-spin" />
                  <p className="text-[#3a3a3a] text-xs">Fetching lyrics…</p>
                </div>
              </div>

            ) : !lyricsFound ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
                <div className="w-16 h-16 rounded-2xl bg-[#111111] border border-[#2a2a2a] flex items-center justify-center mb-4">
                  <Music size={28} className="text-[#2a2a2a]" />
                </div>
                <p className="text-[#605850] font-medium text-sm mb-1" style={{ fontFamily: "Syne, sans-serif" }}>
                  No lyrics found
                </p>
                <p className="text-[#3a3a3a] text-xs max-w-xs">
                  Lyrics aren't available for this track yet.
                </p>
              </div>

            ) : syncedLyrics.length > 0 ? (
              <div ref={lyricsContainerRef} className="flex-1 overflow-y-auto no-scrollbar">
                <div className="sticky top-0 h-12 bg-gradient-to-b from-[#080808] to-transparent pointer-events-none z-10" />
                <div className="flex flex-col items-center gap-6 px-4 pb-32">
                  {syncedLyrics.map((line, i) => {
                    const isActive = i === activeLine;
                    const isPast   = i < activeLine;
                    const key = line.text.trim();
                    return (
                      <div key={i} ref={isActive ? activeLineRef : null} className="w-full flex flex-col items-center">
                        <div
                          onClick={() => handleLineTap(line.text, line.time)}
                          className={`text-center cursor-pointer select-none transition-all duration-300 leading-snug ${
                            decodeMode && expandedLine === key ? "text-[#e8c97a]" :
                            isActive
                              ? "text-[#e8c97a] text-xl font-bold scale-[1.08]"
                              : isPast
                                ? "text-[#2a2a2a] text-base"
                                : "text-[#605850] text-base hover:text-[#b8b0a0]"
                          }`}
                          style={isActive ? { fontFamily: "Syne, sans-serif" } : {}}
                        >
                          {line.text}
                        </div>
                        <LyricExplanation
                          show={decodeMode && expandedLine === key}
                          loading={decodingLine === key}
                          text={explanations[key]}
                          line={key}
                          onShare={setShareLyric}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="sticky bottom-0 h-16 bg-gradient-to-t from-[#080808] to-transparent pointer-events-none" />
              </div>

            ) : (
              <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-6">
                <div className="flex flex-col items-center gap-1.5 pb-24">
                  {plainLyrics.split("\n").map((raw, i) => {
                    const key = raw.trim();
                    if (!key) return <div key={i} className="h-3" />;
                    return (
                      <div key={i} className="w-full flex flex-col items-center">
                        <div
                          onClick={() => handleLineTap(raw)}
                          className={`text-center text-sm leading-relaxed select-none transition-colors ${
                            decodeMode
                              ? `cursor-pointer ${expandedLine === key ? "text-[#e8c97a]" : "text-[#605850] hover:text-[#b8b0a0]"}`
                              : "text-[#605850]"
                          }`}
                        >
                          {raw}
                        </div>
                        <LyricExplanation
                          show={decodeMode && expandedLine === key}
                          loading={decodingLine === key}
                          text={explanations[key]}
                          line={key}
                          onShare={setShareLyric}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

        ) : (
        /* ── Tab: queue ───────────────────────────────────────────────────── */
          <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-8">
            {/* Now playing */}
            <p className="text-[11px] text-[#605850] uppercase tracking-widest mb-2 px-1">Now playing</p>
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#c9a84c0d] border border-[#c9a84c22] mb-6">
              <img src={currentSong.thumbnail_url} alt="" className="w-11 h-11 rounded-lg object-cover flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#e8c97a] truncate" style={{ fontFamily: "Syne, sans-serif" }}>
                  {currentSong.title}
                </p>
                <span
                  role="link"
                  onClick={(e) => goToArtist(e, currentSong.artist)}
                  className="text-xs text-[#605850] hover:text-[#e8c97a] truncate mt-0.5 block w-fit max-w-full transition-colors"
                >
                  {currentSong.artist}
                </span>
              </div>
              {isPlaying ? <Pause size={16} className="text-[#e8c97a] flex-shrink-0" fill="currentColor" />
                         : <Play size={16} className="text-[#e8c97a] flex-shrink-0" fill="currentColor" />}
            </div>

            {/* Up next */}
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="text-[11px] text-[#605850] uppercase tracking-widest">Up next</p>
              {queue.length - currentIndex - 1 > 0 && (
                <span className="text-[11px] text-[#3a3a3a]">{queue.length - currentIndex - 1} in queue</span>
              )}
            </div>

            {queue.length - currentIndex - 1 <= 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-2xl bg-[#111111] border border-[#2a2a2a] flex items-center justify-center mb-3">
                  <ListMusic size={24} className="text-[#2a2a2a]" />
                </div>
                <p className="text-[#605850] text-sm font-medium">Nothing up next</p>
                <p className="text-[#3a3a3a] text-xs mt-1 max-w-[15rem]">
                  Tap the menu on any song to add it here or play it next.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-0.5">
                {queue.slice(currentIndex + 1).map((song, i) => {
                  const realIndex = currentIndex + 1 + i;
                  return (
                    <div
                      key={`${song.youtube_id}-${realIndex}`}
                      onClick={() => jumpTo(realIndex)}
                      className="group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-white/[0.04] transition-colors select-none"
                    >
                      <span className="w-5 text-center text-xs text-[#3a3a3a] tabular-nums flex-shrink-0 group-hover:hidden">{i + 1}</span>
                      <span className="w-5 hidden group-hover:flex items-center justify-center flex-shrink-0 text-[#e8c97a]">
                        <Play size={11} fill="currentColor" />
                      </span>
                      <img src={song.thumbnail_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#f5f0e8] truncate" style={{ fontFamily: "Syne, sans-serif" }}>{song.title}</p>
                        <span
                          role="link"
                          onClick={(e) => goToArtist(e, song.artist)}
                          className="text-xs text-[#605850] hover:text-[#e8c97a] truncate mt-0.5 block w-fit max-w-full transition-colors"
                        >
                          {song.artist}
                        </span>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeFromQueue(realIndex); }}
                        title="Remove from queue"
                        className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-[#3a3a3a] hover:text-[#f87171] active:scale-90 p-1 flex-shrink-0"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {playlistSong && (
        <AddToPlaylistModal song={playlistSong} onClose={() => setPlaylistSong(null)} />
      )}

      {shareLyric && (
        <ShareSheet song={currentSong} lyricLine={shareLyric} onClose={() => setShareLyric(null)} />
      )}
    </div>
  );
}

// ── Lyrics Decoder explanation bubble ─────────────────────────────────────────
function LyricExplanation({ show, loading, text, line, onShare }: {
  show: boolean; loading: boolean; text?: string; line?: string; onShare?: (line: string) => void;
}) {
  if (!show) return null;
  return (
    <div className="mt-2 mb-1 max-w-md w-full px-3.5 py-2.5 rounded-xl bg-[#c9a84c0d] border border-[#c9a84c22] text-left">
      {loading ? (
        <div className="flex items-center gap-2 text-[#605850]">
          <Loader2 size={13} className="animate-spin" />
          <span className="text-xs">Decoding…</span>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-2">
            <Sparkles size={13} className="text-[#e8c97a] mt-0.5 flex-shrink-0" />
            <p className="text-[13px] text-[#b8b0a0] leading-relaxed">{text}</p>
          </div>
          {text && line && onShare && (
            <button
              onClick={(e) => { e.stopPropagation(); onShare(line); }}
              className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#e8c97a] hover:text-[#f5e0a8] transition-colors"
              style={{ fontFamily: "Syne, sans-serif" }}
            >
              <Share2 size={12} />
              Share this line
            </button>
          )}
        </>
      )}
    </div>
  );
}
