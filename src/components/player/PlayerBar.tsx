import { useEffect, useRef, useState } from "react";
import {
  SkipBack, SkipForward, Play, Pause,
  Shuffle, Repeat, Repeat1,
  Volume2, Volume1, VolumeX,
  Video, Music, Mic,
  ChevronUp,
} from "lucide-react";
import { usePlayerStore } from "../../store/playerStore";
import { useAuthStore } from "../../store/authStore";
import { historyApi, musicApi } from "../../services/api";
import type { Song } from "../../types";
import YouTubePlayer from "./YouTubePlayer";
import NowPlayingScreen from "./NowPlayingScreen";
import DevicePicker, { DeviceBanner } from "./DevicePicker";

export default function PlayerBar() {
  const {
    currentSong, isPlaying, isVideoMode, volume, isMuted,
    progress, currentTime, duration, repeatMode, isShuffled,
    togglePlay, nextSong, prevSong, seekTo,
    setVolume, toggleMute, toggleVideoMode,
    toggleRepeat, toggleShuffle,
    voiceEnabled, voiceSupported, voiceListening, toggleVoice,
  } = usePlayerStore();
  const showToast = usePlayerStore((s) => s.showToast);

  const [showNowPlaying, setShowNowPlaying] = useState(false);
  const registerRadioRefill = usePlayerStore((s) => s.registerRadioRefill);

  // Hands-free voice control — same toggle as Now Playing, surfaced here so it's
  // reachable without opening the full screen. The toast explains the commands
  // (a bare mic icon is otherwise meaningless to a first-time user).
  const handleVoiceToggle = () => {
    const turningOn = !voiceEnabled;
    toggleVoice();
    showToast(
      turningOn
        ? "Voice on — say “Ụda, next”, “Ụda pause” or “Ụda play”"
        : "Voice control off"
    );
  };

  // Endless radio: when a station's queue runs dry, fetch the next artist's
  // tracks so playback rolls on instead of stopping. The store calls this.
  useEffect(() => {
    registerRadioRefill(async (artist: string): Promise<Song[]> => {
      try {
        const { data } = await musicApi.search(artist, 15);
        return (data.results || []) as Song[];
      } catch {
        return [];
      }
    });
  }, [registerRadioRefill]);

  // Media Session (lock-screen controls) is owned by useMediaSession() inside
  // YouTubePlayer — intentionally NOT duplicated here (the old copy bound both
  // play & pause to togglePlay, which desynced OS controls).

  // ── Play-history logging ───────────────────────────────────────────────────
  // One record per song. This handles three things the old version got wrong:
  //  • guests have no account → never POST (was spamming 401s)
  //  • a tab close/refresh never runs React cleanup → also flush on pagehide
  //  • don't double-log when both a pagehide and a song change fire
  const songRef   = useRef<Song | null>(currentSong);
  const startRef  = useRef<number>(Date.now());
  const loggedRef = useRef(false);

  // Kept in a ref so the once-registered pagehide listener always calls the
  // latest version without re-binding on every render.
  const flushPlay = useRef(() => {});
  flushPlay.current = () => {
    const song = songRef.current;
    if (!song || loggedRef.current) return;
    if (useAuthStore.getState().isGuest) return;          // browse-only: nothing to log
    const playedSeconds = Math.floor((Date.now() - startRef.current) / 1000);
    if (playedSeconds < 1) return;                          // ignore instant skips
    loggedRef.current = true;
    historyApi.logPlay({
      youtube_id: song.youtube_id,
      title: song.title,
      artist: song.artist,
      thumbnail_url: song.thumbnail_url,
      completed: playedSeconds >= song.duration_seconds * 0.8,
      play_duration_seconds: playedSeconds,
    }).catch(() => {});
  };

  // On song change (and unmount): the cleanup logs the song that just ended,
  // then we arm the timer for the new one.
  useEffect(() => {
    songRef.current   = currentSong;
    startRef.current  = Date.now();
    loggedRef.current = false;
    return () => { flushPlay.current(); };
  }, [currentSong?.youtube_id]);

  // Tab close / backgrounding / refresh never runs the cleanup above — catch
  // those exits here so the final (often most important) play is still logged.
  useEffect(() => {
    const flush = () => flushPlay.current();
    const onVisibility = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seekTo(pct * duration);   // ← real YouTube seek
  };

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const repeatActive = repeatMode !== "off";

  if (!currentSong) return null;

  return (
    <>
      <YouTubePlayer />

      {/* Now Playing fullscreen overlay */}
      {showNowPlaying && (
        <NowPlayingScreen onClose={() => setShowNowPlaying(false)} />
      )}

      <div className="fixed z-50 left-0 right-0 bottom-16 md:bottom-0 bg-[#0d0d0d]/95 backdrop-blur-[16px] border-t border-white/10">

        {/* Remote-device banner — where audio is actually playing */}
        <DeviceBanner />

        {/* ── Mobile layout ─────────────────────────── */}
        <div className="md:hidden">
          {/* Slim seekable progress strip — thin visual, tall touch target */}
          <div onClick={handleSeek} className="relative h-0.5 bg-[#1a1a1a] cursor-pointer group">
            <div className="absolute -top-2 -bottom-2 left-0 right-0" />
            <div
              className="h-full bg-[#e8c97a] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Song info (clickable → Now Playing) + controls */}
          <div className="flex items-center gap-3 px-4 h-[68px]">
            {/* Tappable song info area */}
            <button
              onClick={() => setShowNowPlaying(true)}
              className="flex items-center gap-3 flex-1 min-w-0 text-left"
            >
              <img
                src={currentSong.thumbnail_url}
                alt={currentSong.title}
                className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm text-[#f5f0e8] truncate font-medium"
                  style={{ fontFamily: "Syne, sans-serif" }}
                >
                  {currentSong.title}
                </p>
                <p className="text-xs text-[#605850] truncate">{currentSong.artist}</p>
              </div>
              <ChevronUp size={14} className="text-[#3a3a3a] flex-shrink-0 mr-1" />
            </button>

            {/* Playback controls */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <DevicePicker />
              <button
                onClick={prevSong}
                className="p-1 text-[#605850] hover:text-[#b8b0a0] transition-colors"
              >
                <SkipBack size={18} />
              </button>
              <button
                onClick={togglePlay}
                className="w-9 h-9 rounded-full bg-[#e8c97a] text-[#080808] flex items-center justify-center hover:bg-[#c9a84c] active:scale-90 transition-all flex-shrink-0"
              >
                {isPlaying
                  ? <Pause size={16} fill="currentColor" />
                  : <Play size={16} fill="currentColor" className="ml-0.5" />}
              </button>
              <button
                onClick={nextSong}
                className="p-1 text-[#605850] hover:text-[#b8b0a0] transition-colors"
              >
                <SkipForward size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Desktop layout ────────────────────────── */}
        <div className="hidden md:flex items-center gap-6 px-6 h-24 max-w-screen-xl mx-auto">

          {/* Left — song info (clickable → Now Playing) */}
          <button
            onClick={() => setShowNowPlaying(true)}
            className="flex items-center gap-3 w-64 flex-shrink-0 text-left group"
          >
            <div className="relative flex-shrink-0">
              <img
                src={currentSong.thumbnail_url}
                alt={currentSong.title}
                className="w-12 h-12 rounded-lg object-cover group-hover:opacity-80 transition-opacity"
              />
              <div className="absolute inset-0 rounded-lg bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <ChevronUp size={16} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
            <div className="min-w-0">
              <p
                className="text-sm text-[#f5f0e8] truncate font-medium group-hover:text-[#e8c97a] transition-colors"
                style={{ fontFamily: "Syne, sans-serif" }}
              >
                {currentSong.title}
              </p>
              <p className="text-xs text-[#605850] truncate">{currentSong.artist}</p>
            </div>
          </button>

          {/* Center — controls + progress */}
          <div className="flex-1 flex flex-col items-center gap-2">
            <div className="flex items-center gap-5">
              <button
                onClick={toggleShuffle}
                className={`transition-colors ${isShuffled ? "text-[#e8c97a]" : "text-[#3a3a3a] hover:text-[#605850]"}`}
                title="Shuffle"
              >
                <Shuffle size={16} />
              </button>
              <button
                onClick={prevSong}
                className="text-[#b8b0a0] hover:text-[#f5f0e8] transition-colors"
              >
                <SkipBack size={20} />
              </button>
              <button
                onClick={togglePlay}
                className="w-10 h-10 rounded-full bg-[#e8c97a] text-[#080808] flex items-center justify-center hover:bg-[#c9a84c] hover:scale-105 active:scale-95 transition-all flex-shrink-0"
              >
                {isPlaying
                  ? <Pause size={18} fill="currentColor" />
                  : <Play size={18} fill="currentColor" className="ml-0.5" />}
              </button>
              <button
                onClick={nextSong}
                className="text-[#b8b0a0] hover:text-[#f5f0e8] transition-colors"
              >
                <SkipForward size={20} />
              </button>
              <button
                onClick={toggleRepeat}
                className={`transition-colors ${repeatActive ? "text-[#e8c97a]" : "text-[#3a3a3a] hover:text-[#605850]"}`}
                title={`Repeat: ${repeatMode}`}
              >
                {repeatMode === "one" ? <Repeat1 size={16} /> : <Repeat size={16} />}
              </button>
            </div>

            {/* Seekbar */}
            <div className="flex items-center gap-2 w-full max-w-lg">
              <span className="text-[10px] text-[#3a3a3a] w-8 text-right tabular-nums">
                {fmt(currentTime)}
              </span>
              <div
                onClick={handleSeek}
                className="flex-1 h-1 bg-[#2a2a2a] rounded-full cursor-pointer group relative"
              >
                <div
                  className="h-full bg-[#e8c97a] rounded-full relative transition-all duration-300"
                  style={{ width: `${progress}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-[#e8c97a] rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
              <span className="text-[10px] text-[#3a3a3a] w-8 tabular-nums">
                {fmt(duration)}
              </span>
            </div>
          </div>

          {/* Right — devices + volume + video toggle */}
          <div className="flex items-center gap-4 w-56 justify-end flex-shrink-0">
            {/* Hands-free voice control (Chromium only) */}
            {voiceSupported && (
              <button
                onClick={handleVoiceToggle}
                title={voiceEnabled ? "Voice on — say “Uda, next”" : "Hands-free: tap, then say “Uda, next”"}
                className={`relative transition-colors ${
                  voiceEnabled ? "text-[#e8c97a]" : "text-[#3a3a3a] hover:text-[#605850]"
                }`}
              >
                <Mic size={16} />
                {voiceListening && (
                  <span className="absolute inset-0 -m-1 rounded-full border border-[#e8c97a]/40 animate-ping pointer-events-none" />
                )}
              </button>
            )}
            <DevicePicker />
            <button
              onClick={toggleVideoMode}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                isVideoMode
                  ? "bg-[#c9a84c15] border-[#c9a84c44] text-[#e8c97a]"
                  : "border-[#2a2a2a] text-[#3a3a3a] hover:border-[#c9a84c44] hover:text-[#605850]"
              }`}
              style={{ fontFamily: "Syne, sans-serif" }}
            >
              {isVideoMode ? <Music size={12} /> : <Video size={12} />}
              <span>{isVideoMode ? "Audio" : "Watch"}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleMute}
                className="text-[#3a3a3a] hover:text-[#b8b0a0] transition-colors"
              >
                {isMuted || volume === 0
                  ? <VolumeX size={16} />
                  : volume < 50
                    ? <Volume1 size={16} />
                    : <Volume2 size={16} />}
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-20 h-1 accent-[#c9a84c] cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
