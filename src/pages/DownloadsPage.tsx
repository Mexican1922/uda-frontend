import { useEffect, useState } from "react";
import { libraryApi } from "../services/api";
import { usePlayerStore } from "../store/playerStore";
import type { Song } from "../types";
import SongRow from "../components/ui/SongRow";
import AddToPlaylistModal from "../components/ui/AddToPlaylistModal";
import ShareSheet from "../components/ui/ShareSheet";

// ── localStorage download tracking ───────────────────────────────────────────
const DL_KEY = "uda_downloaded_ids";

export function getDownloadedIds(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(DL_KEY) || "[]")); }
  catch { return new Set(); }
}
export function saveDownloadedIds(ids: Set<string>) {
  localStorage.setItem(DL_KEY, JSON.stringify([...ids]));
}
export function toggleDownload(youtubeId: string) {
  const ids = getDownloadedIds();
  ids.has(youtubeId) ? ids.delete(youtubeId) : ids.add(youtubeId);
  saveDownloadedIds(ids);
  return ids.has(youtubeId); // returns new state
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DownloadsPage() {
  const { playSong } = usePlayerStore();
  const [savedSongs, setSavedSongs] = useState<Song[]>([]);
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [playlistSong, setPlaylistSong] = useState<Song | null>(null);
  const [shareSong, setShareSong] = useState<Song | null>(null);

  useEffect(() => {
    setDownloadedIds(getDownloadedIds());
    libraryApi
      .getSaved()
      .then(({ data }) => setSavedSongs(data.map((s: any) => s.song)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const offlineSongs = savedSongs.filter((s) => downloadedIds.has(s.youtube_id));

  // Simulated storage (16 MB per song)
  const usedMb = offlineSongs.length * 16;
  const totalMb = 1024;
  const pct = Math.min((usedMb / totalMb) * 100, 100);

  const handleToggle = (song: Song) => {
    const isNow = toggleDownload(song.youtube_id);
    setDownloadedIds(getDownloadedIds());
    return isNow;
  };

  return (
    <div className="pb-6 max-w-2xl">

      {/* Header */}
      <div className="px-4 md:px-8 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-1.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(45,190,138,0.12)", border: "1px solid rgba(45,190,138,0.25)" }}
          >
            <DownloadIcon />
          </div>
          <h1
            className="text-2xl font-extrabold text-[#f5f0e8]"
            style={{ fontFamily: "Syne, sans-serif", letterSpacing: "-0.02em" }}
          >
            Downloads
          </h1>
        </div>
        <p className="text-xs text-[#605850] pl-12">
          {offlineSongs.length} song{offlineSongs.length !== 1 ? "s" : ""} · Available offline
        </p>
      </div>

      {/* Storage bar */}
      <div className="mx-4 md:mx-8 mb-5">
        <div
          className="rounded-xl p-3.5"
          style={{ background: "#111111", border: "1px solid #2a2a2a" }}
        >
          <div className="flex justify-between text-[11px] text-[#605850] mb-2">
            <span>Storage used</span>
            <span className="text-[#b8b0a0]">{usedMb} MB / {totalMb} MB</span>
          </div>
          <div className="h-1 rounded-full" style={{ background: "#2a2a2a" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                background: "linear-gradient(90deg,#2dbe8a,rgba(45,190,138,0.6))",
              }}
            />
          </div>
        </div>
      </div>

      {/* Song list */}
      {loading ? (
        <div className="flex flex-col gap-1 px-1">
          {[...Array(5)].map((_, i) => (
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
      ) : offlineSongs.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center px-6">
          <div className="w-16 h-16 rounded-2xl bg-[#111111] border border-[#2a2a2a] flex items-center justify-center mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2dbe8a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <path d="M7 10l5 5 5-5" />
              <path d="M12 15V3" />
            </svg>
          </div>
          <p className="text-[#605850] text-sm font-medium mb-1">Nothing downloaded yet</p>
          <p className="text-xs text-[#3a3a3a] leading-relaxed">
            Tap the download icon on any saved song to make it available offline.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1 px-1">
          {offlineSongs.map((song, i) => (
            <SongRow
              key={song.youtube_id}
              song={song}
              index={i}
              queue={offlineSongs}
              onPlay={playSong}
              offline
              onAction={handleToggle}
              actionIcon={<RemoveDownloadIcon />}
              onSecondAction={setPlaylistSong}
              secondActionIcon={<PlaylistAddIcon />}
              onShare={setShareSong}
            />
          ))}
        </div>
      )}

      {/* Tip: mark songs for download from Library */}
      {!loading && offlineSongs.length === 0 && savedSongs.length > 0 && (
        <div
          className="mx-4 md:mx-8 mt-4 rounded-xl p-3.5 flex items-start gap-3"
          style={{ background: "rgba(45,190,138,0.06)", border: "1px solid rgba(45,190,138,0.15)" }}
        >
          <DownloadIcon className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-[#2dbe8a] mb-1" style={{ fontFamily: "Syne, sans-serif" }}>
              {savedSongs.length} saved songs available
            </p>
            <p className="text-[11px] text-[#605850]">
              Go to Library → Songs and tap the download icon on tracks you want offline.
            </p>
          </div>
        </div>
      )}

      {/* Modals */}
      {playlistSong && <AddToPlaylistModal song={playlistSong} onClose={() => setPlaylistSong(null)} />}
      {shareSong && <ShareSheet song={shareSong} onClose={() => setShareSong(null)} />}
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function DownloadIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2dbe8a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 2v12" /><path d="M7 10l5 5 5-5" />
      <path d="M3 17v2a2 2 0 002 2h14a2 2 0 002-2v-2" />
    </svg>
  );
}

function RemoveDownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

function PlaylistAddIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="15" y2="6" /><line x1="3" y1="12" x2="15" y2="12" />
      <line x1="3" y1="18" x2="9" y2="18" />
      <line x1="19" y1="15" x2="19" y2="21" /><line x1="16" y1="18" x2="22" y2="18" />
    </svg>
  );
}
