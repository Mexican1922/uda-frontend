import { useState, useRef, useEffect } from "react";
import { Play, MoreVertical, ListEnd, ListStart } from "lucide-react";
import { usePlayerStore } from "../../store/playerStore";
import type { Song } from "../../types";

function EqBars() {
  return (
    <span className="flex items-end gap-[2px] w-4 h-4">
      {[0.65, 1, 0.5].map((h, i) => (
        <span
          key={i}
          className="uda-eq-bar w-[3px] rounded-full bg-[#e8c97a]"
          style={{ height: `${h * 14}px`, animationDelay: `${i * 0.18}s` }}
        />
      ))}
    </span>
  );
}

interface Props {
  song: Song;
  index: number;
  queue: Song[];
  onPlay: (s: Song, q: Song[]) => void;
  /** Primary action (save, unsave, remove) */
  onAction?: (song: Song) => void;
  actionIcon?: React.ReactNode;
  /** Secondary action (add to playlist) */
  onSecondAction?: (song: Song) => void;
  secondActionIcon?: React.ReactNode;
  /** Show emerald offline/downloaded badge on thumbnail */
  offline?: boolean;
  /** Share action */
  onShare?: (song: Song) => void;
  /** Navigate to artist page */
  onArtistClick?: (artist: string) => void;
}

function MusicNoteIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M9 3v11.5A3.5 3.5 0 1 0 12.5 18V8h4V3H9z" />
    </svg>
  );
}

export default function SongRow({
  song,
  index,
  queue,
  onPlay,
  onAction,
  actionIcon,
  onSecondAction,
  secondActionIcon,
  offline,
  onShare,
  onArtistClick,
}: Props) {
  const { currentSong, isPlaying, togglePlay, playNext, addToQueue } = usePlayerStore();
  const isActive = currentSong?.youtube_id === song.youtube_id;

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the kebab menu on any outside click / scroll.
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: Event) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("scroll", close, true);
    };
  }, [menuOpen]);

  const handleAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAction?.(song);
  };

  const handleSecondAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSecondAction?.(song);
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    onShare?.(song);
  };

  return (
    <div
      onClick={() => isActive ? togglePlay() : onPlay(song, queue)}
      className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all select-none ${
        isActive
          ? "bg-[#c9a84c0d] border border-[#c9a84c22]"
          : "hover:bg-white/[0.04] border border-transparent"
      }`}
    >
      {/* Index / playing indicator */}
      <div className="w-7 flex-shrink-0 flex items-center justify-center">
        {isActive && isPlaying ? (
          <EqBars />
        ) : (
          <>
            <span
              className={`text-xs tabular-nums group-hover:hidden ${
                isActive ? "text-[#e8c97a]" : "text-[#3a3a3a]"
              }`}
            >
              {isActive ? <MusicNoteIcon /> : index + 1}
            </span>
            <span className="text-[#e8c97a] hidden group-hover:flex items-center justify-center">
              <Play size={11} fill="currentColor" />
            </span>
          </>
        )}
      </div>

      {/* Thumbnail + optional offline badge */}
      <div className="relative w-11 h-11 flex-shrink-0">
        <img
          src={song.thumbnail_url}
          alt={song.title}
          className="w-full h-full rounded-lg object-cover"
        />
        {offline && (
          <div
            className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#080808] flex items-center justify-center"
            style={{ background: "#2dbe8a" }}
            title="Available offline"
          >
            <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v12" /><path d="M7 10l5 5 5-5" />
            </svg>
          </div>
        )}
      </div>

      {/* Title + artist */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p
            className={`text-sm font-medium truncate ${isActive ? "text-[#e8c97a]" : "text-[#f5f0e8]"}`}
            style={{ fontFamily: "Syne, sans-serif" }}
          >
            {song.title}
          </p>
          {offline && (
            <span
              className="flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
              style={{
                background: "rgba(45,190,138,0.15)",
                border: "1px solid rgba(45,190,138,0.35)",
                color: "#2dbe8a",
                letterSpacing: "0.08em",
              }}
            >
              OFFLINE
            </span>
          )}
        </div>
        {onArtistClick ? (
          <button
            onClick={(e) => { e.stopPropagation(); onArtistClick(song.artist); }}
            className="text-xs text-[#605850] hover:text-[#b8b0a0] truncate mt-0.5 block text-left transition-colors"
          >
            {song.artist}
          </button>
        ) : (
          <p className="text-xs text-[#605850] truncate mt-0.5">{song.artist}</p>
        )}
      </div>

      {/* Right side: share + actions + duration */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {onShare && (
          <button
            onClick={handleShare}
            title="Share"
            className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-[#605850] hover:text-[#e8c97a] active:scale-90 p-1 leading-none"
          >
            <ShareRowIcon />
          </button>
        )}
        {onSecondAction && secondActionIcon && (
          <button
            onClick={handleSecondAction}
            title="Add to playlist"
            className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-[#605850] hover:text-[#e8c97a] active:scale-90 p-1 leading-none"
          >
            {secondActionIcon}
          </button>
        )}
        {onAction && actionIcon && (
          <button
            onClick={handleAction}
            className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-[#605850] hover:text-[#e8c97a] active:scale-90 p-1 leading-none"
          >
            {actionIcon}
          </button>
        )}

        {/* Queue kebab — Play next / Add to queue */}
        <div ref={menuRef} className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
            title="More"
            className={`transition-opacity text-[#605850] hover:text-[#e8c97a] active:scale-90 p-1 leading-none ${
              menuOpen ? "opacity-100" : "opacity-100 md:opacity-0 md:group-hover:opacity-100"
            }`}
          >
            <MoreVertical size={15} />
          </button>
          {menuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-full mt-1 z-50 w-44 rounded-xl bg-[#161616] border border-[#2a2a2a] shadow-2xl shadow-black/60 overflow-hidden py-1"
            >
              <button
                onClick={() => { playNext(song); setMenuOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-xs text-[#b8b0a0] hover:bg-white/[0.05] hover:text-[#f5f0e8] transition-colors"
              >
                <ListStart size={14} className="text-[#605850]" />
                Play next
              </button>
              <button
                onClick={() => { addToQueue(song); setMenuOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-xs text-[#b8b0a0] hover:bg-white/[0.05] hover:text-[#f5f0e8] transition-colors"
              >
                <ListEnd size={14} className="text-[#605850]" />
                Add to queue
              </button>
            </div>
          )}
        </div>

        <span className="text-xs text-[#3a3a3a] tabular-nums ml-1">{song.duration}</span>
      </div>
    </div>
  );
}

function ShareRowIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}
