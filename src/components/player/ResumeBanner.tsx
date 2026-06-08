import { useState } from "react";
import { Play, X } from "lucide-react";
import { usePlayerStore } from "../../store/playerStore";

/**
 * "Continue listening" prompt shown once on app load when a previous session
 * was restored from storage. The player rehydrates PAUSED (never auto-plays),
 * so this is the user's explicit opt-in to resume where they left off.
 *
 * Shown only on first mount: pausing/navigating mid-session won't re-trigger it,
 * because AppLayout doesn't remount. A full reload remounts → re-evaluates.
 */
export default function ResumeBanner() {
  // Capture the restored state at first render. Persist hydrates synchronously
  // (localStorage) before React mounts, so currentSong is already populated here.
  const [show, setShow] = useState(() => {
    const s = usePlayerStore.getState();
    return !!s.currentSong && !s.isPlaying;
  });

  const song = usePlayerStore.getState().currentSong;
  if (!show || !song) return null;

  const resume = () => {
    // Player is already cued at the saved position (startAt = currentTime);
    // flipping isPlaying → true resumes from exactly there.
    usePlayerStore.getState().togglePlay();
    setShow(false);
  };

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 top-[68px] md:top-4 z-[90]
                 flex items-center gap-3 pl-3 pr-2 py-2 rounded-full
                 bg-[#1a1a1a] border border-[#2a2a2a] shadow-xl
                 max-w-[calc(100vw-2rem)] animate-fade-in"
    >
      <img
        src={song.thumbnail_url}
        alt={song.title}
        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
      />
      <div className="min-w-0">
        <p className="text-[10.5px] text-[#605850] leading-none mb-0.5">Continue listening</p>
        <p
          className="text-xs text-[#f5f0e8] truncate font-medium leading-tight"
          style={{ fontFamily: "Syne, sans-serif" }}
        >
          {song.title}
        </p>
      </div>
      <button
        onClick={resume}
        className="flex-shrink-0 h-8 px-3 rounded-full flex items-center gap-1.5 text-xs font-bold text-[#080808]"
        style={{
          fontFamily: "Syne, sans-serif",
          background: "linear-gradient(180deg,#e8c97a,#c9a84c)",
        }}
      >
        <Play size={11} fill="currentColor" />
        Resume
      </button>
      <button
        onClick={() => setShow(false)}
        aria-label="Dismiss"
        className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[#605850] hover:text-[#b8b0a0] transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
}
