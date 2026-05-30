import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Play, Disc3 } from "lucide-react";
import { musicApi, libraryApi } from "../services/api";
import { usePlayerStore } from "../store/playerStore";
import { useAuthStore } from "../store/authStore";
import type { Album, Song } from "../types";
import SongRow from "../components/ui/SongRow";
import AddToPlaylistModal from "../components/ui/AddToPlaylistModal";
import { clientCache, TTL } from "../services/cache";

export default function AlbumPage() {
  const { playlistId } = useParams<{ playlistId: string }>();
  const navigate = useNavigate();
  const { playSong } = usePlayerStore();
  const showToast = usePlayerStore((s) => s.showToast);
  const isGuest = useAuthStore((s) => s.isGuest);

  const [album, setAlbum] = useState<Album | null>(null);
  const [tracks, setTracks] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [playlistSong, setPlaylistSong] = useState<Song | null>(null);

  useEffect(() => {
    if (!playlistId) return;
    const cacheKey = `album_${playlistId}`;
    const hit = clientCache.get<{ album: Album; tracks: Song[] }>(cacheKey);
    if (hit) {
      setAlbum(hit.album);
      setTracks(hit.tracks);
      setLoading(false);
      return;
    }
    musicApi
      .album(playlistId)
      .then(({ data }) => {
        setAlbum(data.album);
        setTracks(data.tracks || []);
        if (data.tracks?.length) {
          clientCache.set(cacheKey, { album: data.album, tracks: data.tracks }, TTL.LONG);
        }
      })
      .catch(() => navigate("/"))
      .finally(() => setLoading(false));
  }, [playlistId]);

  const handlePlayAll = () => {
    if (tracks.length) playSong(tracks[0], tracks);
  };

  const handleSave = async (song: Song) => {
    if (isGuest) { showToast("Sign in to save songs"); return; }
    try {
      await libraryApi.saveSong({
        youtube_id: song.youtube_id,
        title: song.title,
        artist: song.artist,
        thumbnail_url: song.thumbnail_url,
      });
    } catch {}
  };

  if (loading) {
    return (
      <div className="px-4 md:px-8 py-6 md:py-8">
        <div className="flex flex-col sm:flex-row items-start gap-5 mb-8">
          <div className="w-36 h-36 md:w-48 md:h-48 rounded-2xl bg-[#1a1a1a] animate-pulse flex-shrink-0" />
          <div className="flex-1 pt-2">
            <div className="h-3 w-16 bg-[#1a1a1a] rounded animate-pulse mb-3" />
            <div className="h-7 w-1/2 bg-[#1a1a1a] rounded animate-pulse mb-2" />
            <div className="h-3 w-24 bg-[#1a1a1a] rounded animate-pulse" />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5">
              <div className="w-7 h-4 rounded bg-[#1a1a1a] animate-pulse" />
              <div className="w-11 h-11 rounded-lg bg-[#1a1a1a] animate-pulse" />
              <div className="flex-1">
                <div className="h-3.5 w-2/3 bg-[#1a1a1a] rounded animate-pulse mb-1.5" />
                <div className="h-3 w-1/3 bg-[#1a1a1a] rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!album) return null;

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 pb-10">
      {/* Hero */}
      <div className="flex flex-col sm:flex-row items-start sm:items-end gap-5 mb-8">
        {album.thumbnail_url ? (
          <img
            src={album.thumbnail_url}
            alt={album.title}
            className="w-36 h-36 md:w-48 md:h-48 rounded-2xl object-cover flex-shrink-0 shadow-2xl"
          />
        ) : (
          <div className="w-36 h-36 md:w-48 md:h-48 rounded-2xl bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-[#2a2a2a] flex items-center justify-center flex-shrink-0 shadow-2xl">
            <Disc3 size={48} className="text-[#2a2a2a]" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-[#605850] uppercase tracking-widest mb-1">Album</p>
          <h1
            className="text-2xl md:text-4xl font-bold text-[#f5f0e8] leading-tight mb-2"
            style={{ fontFamily: "Syne, sans-serif" }}
          >
            {album.title}
          </h1>
          <button
            onClick={() => navigate(`/artist/${encodeURIComponent(album.artist)}`)}
            className="text-sm text-[#b8b0a0] hover:text-[#e8c97a] transition-colors mb-1 block"
          >
            {album.artist}
          </button>
          <p className="text-xs text-[#3a3a3a] mb-4">
            {tracks.length} {tracks.length === 1 ? "track" : "tracks"}
          </p>
          {tracks.length > 0 && (
            <button
              onClick={handlePlayAll}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#c9a84c] hover:bg-[#e8c97a] active:scale-95 text-[#080808] font-semibold rounded-xl text-sm transition-all shadow-lg"
              style={{ fontFamily: "Syne, sans-serif" }}
            >
              <Play size={14} fill="currentColor" />
              Play All
            </button>
          )}
        </div>
      </div>

      {/* Track list */}
      {tracks.length > 0 ? (
        <div className="flex flex-col gap-1">
          {tracks.map((song, i) => (
            <SongRow
              key={song.youtube_id}
              song={song}
              index={i}
              queue={tracks}
              onPlay={playSong}
              onAction={handleSave}
              actionIcon={<HeartIcon />}
              onSecondAction={(s) => isGuest ? showToast("Sign in to build playlists") : setPlaylistSong(s)}
              secondActionIcon={<PlaylistAddIcon />}
              onArtistClick={(artist) => navigate(`/artist/${encodeURIComponent(artist)}`)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Disc3 size={40} className="text-[#2a2a2a] mb-4" />
          <p className="text-[#605850] text-sm font-medium">No playable tracks</p>
          <p className="text-[#3a3a3a] text-xs mt-1">This album isn't available right now.</p>
        </div>
      )}

      {playlistSong && (
        <AddToPlaylistModal song={playlistSong} onClose={() => setPlaylistSong(null)} />
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
