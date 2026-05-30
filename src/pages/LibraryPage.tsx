import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Music2, Heart } from "lucide-react";
import { libraryApi } from "../services/api";
import { usePlayerStore } from "../store/playerStore";
import type { Playlist, SavedSong, Song } from "../types";
import SongRow from "../components/ui/SongRow";

type Tab = "songs" | "playlists";

export default function LibraryPage() {
  const [tab, setTab] = useState<Tab>("songs");
  const [savedSongs, setSavedSongs] = useState<SavedSong[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const { playSong } = usePlayerStore();
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [savedRes, plRes] = await Promise.all([
          libraryApi.getSaved(),
          libraryApi.getPlaylists(),
        ]);
        setSavedSongs(savedRes.data);
        setPlaylists(plRes.data);
      } catch {
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleUnsave = async (song: Song) => {
    try {
      await libraryApi.unsaveSong(song.youtube_id);
      setSavedSongs((prev) =>
        prev.filter((s) => s.song.youtube_id !== song.youtube_id),
      );
    } catch {}
  };

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const { data } = await libraryApi.createPlaylist({
        name: newName.trim(),
      });
      setPlaylists((prev) => [data, ...prev]);
      setNewName("");
      setShowCreateModal(false);
    } catch {
    } finally {
      setCreating(false);
    }
  };

  const songs = savedSongs.map((s) => s.song);

  return (
    <div className="px-4 md:px-8 py-6 md:py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1
          className="text-2xl md:text-3xl font-bold text-[#f5f0e8]"
          style={{ fontFamily: "Syne, sans-serif" }}
        >
          Library
        </h1>
        <div className="flex items-center gap-2">
          {/* Downloads link */}
          <button
            onClick={() => navigate("/downloads")}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-[#2a2a2a] text-[#605850] hover:text-[#2dbe8a] hover:border-[#2dbe8a33] rounded-lg text-xs transition-colors"
            title="Downloads"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2v12" />
              <path d="M7 10l5 5 5-5" />
              <path d="M3 17v2a2 2 0 002 2h14a2 2 0 002-2v-2" />
            </svg>
            Downloads
          </button>
          {tab === "playlists" && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#c9a84c15] hover:bg-[#c9a84c25] border border-[#c9a84c33] text-[#e8c97a] rounded-lg text-xs transition-colors"
            >
              <span className="text-base leading-none">+</span>
              New Playlist
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[#111111] rounded-xl p-1 w-fit">
        {(["songs", "playlists"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all capitalize ${
              tab === t
                ? "bg-[#1a1a1a] text-[#e8c97a]"
                : "text-[#605850] hover:text-[#b8b0a0]"
            }`}
            style={tab === t ? { fontFamily: "Syne, sans-serif" } : {}}
          >
            {t === "songs"
              ? `Songs${savedSongs.length > 0 ? ` (${savedSongs.length})` : ""}`
              : "Playlists"}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <LoadingSkeleton />
      ) : tab === "songs" ? (
        songs.length > 0 ? (
          <div className="flex flex-col gap-1">
            {songs.map((song, i) => (
              <SongRow
                key={song.youtube_id}
                song={song}
                index={i}
                queue={songs}
                onPlay={playSong}
                onAction={handleUnsave}
                actionIcon={<TrashIcon />}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Heart size={36} />}
            title="No saved songs"
            desc="Songs you save will appear here"
          />
        )
      ) : playlists.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {playlists.map((pl) => (
            <PlaylistCard
              key={pl.id}
              playlist={pl}
              onClick={() => navigate(`/playlist/${pl.id}`)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Music2 size={36} />}
          title="No playlists yet"
          desc="Create a playlist to organise your music"
        />
      )}

      {/* Gold FAB — visible on playlists tab, mobile only */}
      {tab === "playlists" && (
        <button
          onClick={() => setShowCreateModal(true)}
          className="fixed bottom-24 right-5 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl z-40 md:hidden transition-transform hover:scale-105 active:scale-95"
          style={{
            background: "linear-gradient(180deg, #e8c97a 0%, #c9a84c 100%)",
            boxShadow: "0 8px 24px rgba(201,168,76,0.45)",
          }}
          title="New playlist"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#080808"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      )}

      {/* Create Playlist Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 px-4"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              className="text-base font-semibold text-[#f5f0e8] mb-5"
              style={{ fontFamily: "Syne, sans-serif" }}
            >
              New Playlist
            </h3>
            <form
              onSubmit={handleCreatePlaylist}
              className="flex flex-col gap-4"
            >
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Playlist name..."
                autoFocus
                className="w-full bg-[#080808] border border-[#2a2a2a] rounded-lg px-4 py-3 text-sm text-[#f5f0e8] placeholder-[#3a3a3a] focus:outline-none focus:border-[#c9a84c] transition-colors"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 border border-[#2a2a2a] text-[#605850] rounded-lg text-sm hover:text-[#b8b0a0] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newName.trim()}
                  className="flex-1 py-2.5 bg-[#c9a84c] hover:bg-[#e8c97a] text-[#080808] font-semibold rounded-lg text-sm transition-colors disabled:opacity-50"
                  style={{ fontFamily: "Syne, sans-serif" }}
                >
                  {creating ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Deterministic gradient pairs derived from a string hash
const PLAYLIST_GRADIENTS: [string, string][] = [
  ["#c9a84c", "#6b3a0f"],
  ["#1a7a4a", "#0a3020"],
  ["#7c3aed", "#3b0764"],
  ["#be123c", "#4c0519"],
  ["#0369a1", "#082f49"],
  ["#c2410c", "#431407"],
  ["#065f46", "#022c22"],
  ["#4d7c0f", "#1a2e05"],
];
function plGradient(seed: string, offset = 0): [string, string] {
  let h = offset * 31;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PLAYLIST_GRADIENTS[h % PLAYLIST_GRADIENTS.length];
}
function plInitials(name: string) {
  return (
    name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "PL"
  );
}

function PlaylistCard({
  playlist,
  onClick,
}: {
  playlist: Playlist;
  onClick: () => void;
}) {
  return (
    <div onClick={onClick} className="cursor-pointer group">
      <div className="relative mb-2.5">
        {playlist.cover_image_url ? (
          <img
            src={playlist.cover_image_url}
            alt={playlist.name}
            className="w-full aspect-square rounded-xl object-cover transition-transform duration-200 group-hover:scale-[1.03]"
          />
        ) : (
          /* 2×2 gradient mosaic + initials watermark */
          <div className="relative w-full aspect-square rounded-xl overflow-hidden transition-transform duration-200 group-hover:scale-[1.03]">
            <div className="absolute inset-0 grid grid-cols-2 gap-px">
              {[0, 1, 2, 3].map((i) => {
                const [a, b] = plGradient(playlist.name, i);
                return (
                  <div
                    key={i}
                    style={{
                      background: `linear-gradient(135deg, ${a}, ${b})`,
                    }}
                  />
                );
              })}
            </div>
            {/* Initials watermark */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
              <span
                className="font-extrabold leading-none"
                style={{
                  fontFamily: "Syne, sans-serif",
                  fontSize: 52,
                  color: "rgba(255,255,255,0.22)",
                  letterSpacing: "-0.04em",
                }}
              >
                {plInitials(playlist.name)}
              </span>
            </div>
          </div>
        )}
        <div className="absolute inset-0 rounded-xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-10 h-10 bg-[#e8c97a] rounded-full flex items-center justify-center shadow-lg">
            <Play
              size={16}
              fill="currentColor"
              className="text-[#080808] ml-[2px]"
            />
          </div>
        </div>
      </div>
      <p
        className="text-sm font-medium text-[#f5f0e8] truncate"
        style={{ fontFamily: "Syne, sans-serif" }}
      >
        {playlist.name}
      </p>
      <p className="text-xs text-[#605850] mt-0.5">
        {playlist.song_count} {playlist.song_count === 1 ? "song" : "songs"}
      </p>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <span className="text-[#2a2a2a] mb-4">{icon}</span>
      <p className="text-[#605850] text-sm font-medium mb-1">{title}</p>
      <p className="text-[#3a3a3a] text-xs">{desc}</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-1">
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
  );
}

function TrashIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
  );
}
