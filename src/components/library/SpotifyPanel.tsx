import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, Loader2, Play, RefreshCw, Music2, Link2Off } from "lucide-react";
import { spotifyApi } from "../../services/api";
import { usePlayerStore } from "../../store/playerStore";
import type { Song, ImportedTrack, ImportedPlaylist, SpotifyStatus } from "../../types";

const SPOTIFY_GREEN = "#1DB954";

function SpotifyGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={SPOTIFY_GREEN} aria-hidden>
      <path d="M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24zm5.5 17.3a.75.75 0 0 1-1.03.25c-2.82-1.72-6.36-2.11-10.54-1.16a.75.75 0 1 1-.33-1.46c4.57-1.04 8.49-.59 11.65 1.34.35.21.46.67.25 1.03zm1.47-3.27a.94.94 0 0 1-1.29.31c-3.23-1.99-8.15-2.56-11.97-1.4a.94.94 0 1 1-.54-1.8c4.37-1.32 9.79-.68 13.49 1.6.44.27.58.85.31 1.29zm.13-3.4C15.21 8.23 8.85 8.02 5.2 9.13a1.12 1.12 0 1 1-.65-2.15c4.2-1.27 11.2-1.03 15.6 1.58a1.12 1.12 0 1 1-1.15 1.92z" />
    </svg>
  );
}

/** Compact row for a not-yet-resolved Spotify track. */
function TrackRow({
  track, onPlay, busy,
}: { track: ImportedTrack; onPlay: (t: ImportedTrack) => void; busy: boolean }) {
  const unavailable = track.status === "unavailable";
  return (
    <button
      onClick={() => !unavailable && onPlay(track)}
      disabled={unavailable || busy}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
        unavailable ? "opacity-40 cursor-default" : "hover:bg-white/[0.04]"
      }`}
    >
      <div className="relative w-11 h-11 flex-shrink-0">
        {track.image_url ? (
          <img src={track.image_url} alt={track.title} className="w-full h-full rounded-lg object-cover" />
        ) : (
          <div className="w-full h-full rounded-lg bg-[#1a1a1a] flex items-center justify-center">
            <Music2 size={16} className="text-[#3a3a3a]" />
          </div>
        )}
        <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/0 hover:bg-black/30 transition-colors">
          {busy ? <Loader2 size={16} className="animate-spin text-white" /> : null}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#f5f0e8] truncate" style={{ fontFamily: "Syne, sans-serif" }}>
          {track.title}
        </p>
        <p className="text-xs text-[#605850] truncate mt-0.5">
          {track.artist}{unavailable ? " · no match" : ""}
        </p>
      </div>
      {!unavailable && !busy && (
        <Play size={14} className="text-[#605850] flex-shrink-0" fill="currentColor" />
      )}
    </button>
  );
}

export default function SpotifyPanel() {
  const playSong = usePlayerStore((s) => s.playSong);
  const showToast = usePlayerStore((s) => s.showToast);

  const [status, setStatus] = useState<SpotifyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const [liked, setLiked] = useState<ImportedTrack[]>([]);
  const [playlists, setPlaylists] = useState<ImportedPlaylist[]>([]);
  const [openPl, setOpenPl] = useState<ImportedPlaylist | null>(null);
  const [plTracks, setPlTracks] = useState<ImportedTrack[]>([]);
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  const loadLibrary = useCallback(async () => {
    try {
      const [l, p] = await Promise.all([spotifyApi.likedTracks(), spotifyApi.playlists()]);
      setLiked(l.data);
      setPlaylists(p.data);
    } catch { /* ignore */ }
  }, []);

  // Initial status (+ library if already connected). Also surfaces the
  // ?spotify=… result the OAuth callback redirects back with.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("spotify");
    if (result) {
      showToast(
        result === "connected" ? "Spotify connected — import your songs"
          : result === "denied" ? "Spotify connection cancelled"
          : "Couldn't connect Spotify — try again",
      );
      // Clean the URL so a refresh doesn't re-toast.
      window.history.replaceState({}, "", window.location.pathname);
    }
    spotifyApi.status()
      .then(({ data }) => {
        setStatus(data);
        if (data.connected) loadLibrary();
      })
      .catch(() => setStatus({ connected: false, configured: false }))
      .finally(() => setLoading(false));
  }, [loadLibrary, showToast]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { data } = await spotifyApi.connect();
      window.location.href = data.url;          // off to Spotify's consent screen
    } catch {
      showToast("Spotify isn't available right now");
      setConnecting(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const { data } = await spotifyApi.importLibrary();
      showToast(`Imported ${data.liked_imported} liked songs · ${data.playlists_imported} playlists`);
      await loadLibrary();
      const { data: st } = await spotifyApi.status();
      setStatus(st);
    } catch {
      showToast("Import failed — try again");
    } finally {
      setImporting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await spotifyApi.disconnect();
      setStatus({ connected: false, configured: true });
      setLiked([]); setPlaylists([]); setOpenPl(null); setPlTracks([]);
      showToast("Spotify disconnected");
    } catch {
      showToast("Couldn't disconnect — try again");
    }
  };

  const openPlaylist = async (pl: ImportedPlaylist) => {
    setOpenPl(pl);
    setPlTracks([]);
    try {
      const { data } = await spotifyApi.playlistTracks(pl.id);
      setPlTracks(data.tracks);
    } catch { showToast("Couldn't open that playlist"); }
  };

  // Lazy resolve → play. The first play of a track spends one YouTube search;
  // afterwards the match is cached and instant.
  const playImported = async (track: ImportedTrack) => {
    if (resolvingId) return;
    setResolvingId(track.id);
    try {
      const { data } = await spotifyApi.resolve(track.id);
      playSong(data as Song, [data as Song]);
      // Reflect the now-resolved id locally so the row won't re-resolve.
      const patch = (arr: ImportedTrack[]) =>
        arr.map((t) => t.id === track.id ? { ...t, youtube_id: data.youtube_id, status: "matched" as const } : t);
      setLiked(patch); setPlTracks(patch);
    } catch (e: any) {
      const code = e?.response?.data?.code;
      if (code === "no_match") {
        const mark = (arr: ImportedTrack[]) =>
          arr.map((t) => t.id === track.id ? { ...t, status: "unavailable" as const } : t);
        setLiked(mark); setPlTracks(mark);
        showToast("No YouTube match for this song");
      } else {
        showToast(code === "quota_exceeded"
          ? "Daily match limit reached — try again tomorrow"
          : "Couldn't play that — try again");
      }
    } finally {
      setResolvingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={20} className="animate-spin text-[#605850]" />
      </div>
    );
  }

  // Spotify not set up on the server.
  if (status && status.configured === false && !status.connected) {
    return (
      <div className="text-center py-16 px-6">
        <SpotifyGlyph size={32} />
        <p className="text-sm text-[#605850] mt-3">Spotify import isn't available yet.</p>
      </div>
    );
  }

  // Connected → import controls + library.
  if (status?.connected) {
    // Drill-down: a single opened playlist.
    if (openPl) {
      return (
        <div>
          <button
            onClick={() => setOpenPl(null)}
            className="flex items-center gap-1.5 text-xs text-[#b8b0a0] hover:text-[#e8c97a] mb-4 transition-colors"
          >
            <ChevronLeft size={14} /> All Spotify playlists
          </button>
          <h3 className="text-base font-semibold text-[#f5f0e8] mb-3" style={{ fontFamily: "Syne, sans-serif" }}>
            {openPl.name}
          </h3>
          <div className="flex flex-col gap-1">
            {plTracks.map((t) => (
              <TrackRow key={t.id} track={t} onPlay={playImported} busy={resolvingId === t.id} />
            ))}
          </div>
        </div>
      );
    }

    return (
      <div>
        {/* Connected header */}
        <div className="flex items-center gap-3 mb-5 p-3 rounded-xl bg-[#111111] border border-[#2a2a2a]">
          <SpotifyGlyph size={22} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#f5f0e8]" style={{ fontFamily: "Syne, sans-serif" }}>
              Spotify connected
            </p>
            <p className="text-xs text-[#605850]">
              {status.liked_count ?? 0} liked · {status.playlist_count ?? 0} playlists
            </p>
          </div>
          <button
            onClick={handleImport}
            disabled={importing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#080808] disabled:opacity-60"
            style={{ background: SPOTIFY_GREEN, fontFamily: "Syne, sans-serif" }}
          >
            {importing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            {importing ? "Importing…" : "Sync"}
          </button>
          <button
            onClick={handleDisconnect}
            title="Disconnect Spotify"
            className="p-1.5 text-[#605850] hover:text-[#be123c] transition-colors"
          >
            <Link2Off size={15} />
          </button>
        </div>

        {liked.length === 0 && playlists.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-[#605850]">Tap <span className="text-[#e8c97a]">Sync</span> to import your Liked Songs and playlists.</p>
          </div>
        ) : (
          <>
            {/* Playlists */}
            {playlists.length > 0 && (
              <div className="mb-7">
                <h3 className="text-sm font-semibold text-[#f5f0e8] mb-3" style={{ fontFamily: "Syne, sans-serif" }}>
                  Playlists from Spotify
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {playlists.map((pl) => (
                    <button
                      key={pl.id}
                      onClick={() => openPlaylist(pl)}
                      className="text-left group"
                    >
                      <div className="relative w-full aspect-square rounded-xl overflow-hidden mb-2 bg-[#1a1a1a]">
                        {pl.image_url ? (
                          <img src={pl.image_url} alt={pl.name} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><Music2 size={28} className="text-[#2a2a2a]" /></div>
                        )}
                      </div>
                      <p className="text-xs font-medium text-[#f5f0e8] truncate" style={{ fontFamily: "Syne, sans-serif" }}>{pl.name}</p>
                      <p className="text-[11px] text-[#605850]">{pl.track_count} songs</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Liked songs */}
            {liked.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-[#f5f0e8] mb-3" style={{ fontFamily: "Syne, sans-serif" }}>
                  Liked Songs
                </h3>
                <div className="flex flex-col gap-1">
                  {liked.map((t) => (
                    <TrackRow key={t.id} track={t} onPlay={playImported} busy={resolvingId === t.id} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // Configured but not connected → connect CTA.
  return (
    <div className="text-center py-14 px-6">
      <SpotifyGlyph size={36} />
      <p className="text-base font-semibold text-[#f5f0e8] mt-4 mb-1" style={{ fontFamily: "Syne, sans-serif" }}>
        Bring your Spotify library
      </p>
      <p className="text-sm text-[#605850] mb-6 max-w-xs mx-auto">
        Import your Liked Songs and playlists. They play here through Ụda — no Spotify Premium needed.
      </p>
      <button
        onClick={handleConnect}
        disabled={connecting}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold text-[#080808] disabled:opacity-60"
        style={{ background: SPOTIFY_GREEN, fontFamily: "Syne, sans-serif" }}
      >
        {connecting ? <Loader2 size={15} className="animate-spin" /> : <SpotifyGlyph size={16} />}
        Connect Spotify
      </button>
    </div>
  );
}
