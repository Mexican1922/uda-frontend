import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Play, Music2 } from "lucide-react";
import { libraryApi } from "../services/api";
import { usePlayerStore } from "../store/playerStore";
import type { Playlist, Song } from "../types";
import SongRow from "../components/ui/SongRow";

export default function PlaylistPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { playSong } = usePlayerStore();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    libraryApi
      .getPlaylist(Number(id))
      .then(({ data }) => setPlaylist(data))
      .catch(() => navigate("/library"))
      .finally(() => setLoading(false));
  }, [id]);

  const handleRemoveTrack = async (song: Song) => {
    if (!playlist || !id) return;
    try {
      await libraryApi.removeTrack(Number(id), song.youtube_id);
      setPlaylist((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          tracks: prev.tracks?.filter((t) => t.song.youtube_id !== song.youtube_id),
          song_count: prev.song_count - 1,
        };
      });
    } catch {}
  };

  const handlePlayAll = () => {
    if (!playlist?.tracks?.length) return;
    const songs = playlist.tracks.map((t) => t.song);
    playSong(songs[0], songs);
  };

  if (loading) {
    return (
      <div className="px-4 md:px-8 py-6 md:py-8">
        <div className="flex flex-col sm:flex-row items-start gap-5 mb-8">
          <div className="w-32 h-32 md:w-40 md:h-40 rounded-2xl bg-[#1a1a1a] animate-pulse flex-shrink-0" />
          <div className="flex-1 pt-2">
            <div className="h-3 w-16 bg-[#1a1a1a] rounded animate-pulse mb-3" />
            <div className="h-7 w-1/2 bg-[#1a1a1a] rounded animate-pulse mb-2" />
            <div className="h-3 w-20 bg-[#1a1a1a] rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!playlist) return null;

  const songs = playlist.tracks?.map((t) => t.song) ?? [];

  return (
    <div className="px-4 md:px-8 py-6 md:py-8">
      {/* Hero */}
      <div className="flex flex-col sm:flex-row items-start sm:items-end gap-5 mb-8">
        {playlist.cover_image_url ? (
          <img
            src={playlist.cover_image_url}
            alt={playlist.name}
            className="w-32 h-32 md:w-40 md:h-40 rounded-2xl object-cover flex-shrink-0 shadow-2xl"
          />
        ) : (
          <div className="w-32 h-32 md:w-40 md:h-40 rounded-2xl bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-[#2a2a2a] flex items-center justify-center flex-shrink-0 shadow-2xl">
            <Music2 size={48} className="text-[#2a2a2a]" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-[#605850] uppercase tracking-widest mb-1">Playlist</p>
          <h1
            className="text-2xl md:text-3xl font-bold text-[#f5f0e8] leading-tight truncate mb-2"
            style={{ fontFamily: "Syne, sans-serif" }}
          >
            {playlist.name}
          </h1>
          {playlist.description && (
            <p className="text-sm text-[#605850] mb-3 line-clamp-2">{playlist.description}</p>
          )}
          <p className="text-xs text-[#3a3a3a] mb-4">
            {playlist.song_count} {playlist.song_count === 1 ? "song" : "songs"}
          </p>
          {songs.length > 0 && (
            <button
              onClick={handlePlayAll}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#c9a84c] hover:bg-[#e8c97a] text-[#080808] font-semibold rounded-xl text-sm transition-colors shadow-lg"
              style={{ fontFamily: "Syne, sans-serif" }}
            >
              <Play size={14} fill="currentColor" />
              Play All
            </button>
          )}
        </div>
      </div>

      {/* Track list */}
      {songs.length > 0 ? (
        <div className="flex flex-col gap-1">
          {songs.map((song, i) => (
            <SongRow
              key={song.youtube_id}
              song={song}
              index={i}
              queue={songs}
              onPlay={playSong}
              onAction={handleRemoveTrack}
              actionIcon={<RemoveIcon />}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Music2 size={40} className="text-[#2a2a2a] mb-4" />
          <p className="text-[#605850] text-sm font-medium">No songs yet</p>
          <p className="text-[#3a3a3a] text-xs mt-1">
            Search for songs to add to this playlist
          </p>
        </div>
      )}
    </div>
  );
}

function RemoveIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
