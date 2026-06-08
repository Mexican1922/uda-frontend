import { useEffect, useState } from "react";
import { libraryApi } from "../../services/api";
import type { Playlist, Song } from "../../types";

interface Props {
  song: Song;
  onClose: () => void;
}

export default function AddToPlaylistModal({ song, onClose }: Props) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading]     = useState(true);
  const [adding, setAdding]       = useState<number | null>(null);
  // Tracks playlists that already contain the song (from server) + ones added this session
  const [inPlaylist, setInPlaylist] = useState<Set<number>>(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName]       = useState("");
  const [creating, setCreating]     = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        // Two parallel calls total (was 1 + N): the playlist list, and a single
        // membership lookup for which of them already contain this song.
        const [{ data }, containing] = await Promise.all([
          libraryApi.getPlaylists(),
          libraryApi
            .playlistsContaining(song.youtube_id)
            .then((r) => r.data.playlist_ids as number[])
            .catch(() => [] as number[]),
        ]);
        if (cancelled) return;
        setPlaylists(data);
        setInPlaylist(new Set<number>(containing));
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [song.youtube_id]);

  const handleAdd = async (playlistId: number) => {
    if (inPlaylist.has(playlistId) || adding === playlistId) return;
    setAdding(playlistId);
    try {
      await libraryApi.addTrack(playlistId, {
        youtube_id:    song.youtube_id,
        title:         song.title,
        artist:        song.artist,
        thumbnail_url: song.thumbnail_url,
      });
      setInPlaylist((prev) => new Set([...prev, playlistId]));
    } catch {
      // silently ignore duplicate-track errors etc.
    } finally {
      setAdding(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const { data: newPl } = await libraryApi.createPlaylist({ name: newName.trim() });
      await libraryApi.addTrack(newPl.id, {
        youtube_id:    song.youtube_id,
        title:         song.title,
        artist:        song.artist,
        thumbnail_url: song.thumbnail_url,
      });
      setPlaylists((prev) => [{ ...newPl, song_count: 1 }, ...prev]);
      setInPlaylist((prev) => new Set([...prev, newPl.id]));
      setNewName("");
      setShowCreate(false);
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-[#111111] border border-[#2a2a2a] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm max-h-[72vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-9 h-1 bg-[#2a2a2a] rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-3 pb-3 flex-shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <h3
              className="text-sm font-semibold text-[#f5f0e8] truncate"
              style={{ fontFamily: "Syne, sans-serif" }}
            >
              Add to playlist
            </h3>
            <p className="text-xs text-[#605850] truncate mt-0.5">{song.title}</p>
          </div>
          <button
            onClick={onClose}
            className="text-[#605850] hover:text-[#b8b0a0] transition-colors flex-shrink-0 p-1"
          >
            <XIcon />
          </button>
        </div>

        {/* Create new playlist */}
        <div className="px-4 pb-3 flex-shrink-0">
          {showCreate ? (
            <form onSubmit={handleCreate} className="flex gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Playlist name..."
                autoFocus
                className="flex-1 bg-[#080808] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-[#f5f0e8] placeholder-[#3a3a3a] focus:outline-none focus:border-[#c9a84c] transition-colors"
              />
              <button
                type="submit"
                disabled={creating || !newName.trim()}
                className="px-3 py-2 bg-[#c9a84c] hover:bg-[#e8c97a] text-[#080808] font-semibold rounded-lg text-xs transition-colors disabled:opacity-50"
                style={{ fontFamily: "Syne, sans-serif" }}
              >
                {creating ? "…" : "Create"}
              </button>
              <button
                type="button"
                onClick={() => { setShowCreate(false); setNewName(""); }}
                className="px-3 py-2 border border-[#2a2a2a] text-[#605850] rounded-lg text-xs hover:text-[#b8b0a0] transition-colors"
              >
                <XIcon />
              </button>
            </form>
          ) : (
            <button
              onClick={() => setShowCreate(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 border border-dashed border-[#2a2a2a] hover:border-[#c9a84c44] hover:text-[#e8c97a] rounded-xl text-xs text-[#605850] transition-all"
            >
              <span className="text-base leading-none">+</span>
              New playlist
            </button>
          )}
        </div>

        <div className="border-t border-[#1a1a1a] mx-4 flex-shrink-0" />

        {/* Playlist list */}
        <div className="overflow-y-auto flex-1 px-2 py-2 no-scrollbar">
          {loading ? (
            <div className="flex flex-col gap-1 p-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-2 py-2.5">
                  <div className="w-10 h-10 rounded-lg bg-[#1a1a1a] animate-pulse flex-shrink-0" />
                  <div className="flex-1">
                    <div className="h-3 w-1/2 bg-[#1a1a1a] rounded animate-pulse mb-1.5" />
                    <div className="h-2.5 w-1/4 bg-[#1a1a1a] rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : playlists.length === 0 ? (
            <p className="text-xs text-[#3a3a3a] text-center py-8">
              No playlists yet — create one above
            </p>
          ) : (
            playlists.map((pl) => {
              const isIn     = inPlaylist.has(pl.id);
              const isAdding = adding === pl.id;

              return (
                <button
                  key={pl.id}
                  onClick={() => handleAdd(pl.id)}
                  disabled={isIn || isAdding}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left group ${
                    isIn
                      ? "cursor-default opacity-60"
                      : "hover:bg-white/[0.04] cursor-pointer"
                  }`}
                >
                  {/* Thumbnail */}
                  {pl.cover_image_url ? (
                    <img
                      src={pl.cover_image_url}
                      alt={pl.name}
                      className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center flex-shrink-0">
                      <MusicNoteSmall />
                    </div>
                  )}

                  {/* Name + count */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${isIn ? "text-[#605850]" : "text-[#f5f0e8]"}`}>
                      {pl.name}
                    </p>
                    <p className="text-xs text-[#3a3a3a]">
                      {pl.song_count} {pl.song_count === 1 ? "song" : "songs"}
                    </p>
                  </div>

                  {/* Status icon */}
                  <div className="flex-shrink-0 w-5 flex items-center justify-center">
                    {isAdding ? (
                      <span className="text-[#605850] text-xs animate-pulse">•••</span>
                    ) : isIn ? (
                      /* Already in playlist — green tick, no action */
                      <span className="text-[#2dbe8a]"><CheckIcon /></span>
                    ) : (
                      /* Not yet added — show + on hover */
                      <span className="text-[#3a3a3a] opacity-0 group-hover:opacity-100 transition-opacity">
                        <AddIcon />
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ── SVG icons ──────────────────────────────────────────────────────────────────

function MusicNoteSmall() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-[#3a3a3a]">
      <path d="M9 3v11.5A3.5 3.5 0 1 0 12.5 18V8h4V3H9z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function AddIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
