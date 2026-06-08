import { useEffect, useState, useCallback, useRef } from "react";
import { ChevronLeft, Loader2, Play, RefreshCw, Music2, Link2Off, Upload, ListEnd } from "lucide-react";
import { spotifyApi } from "../../services/api";
import { usePlayerStore } from "../../store/playerStore";
import type { ImportedTrack, ImportedPlaylist, SpotifyStatus, PendingImport } from "../../types";

const toPending = (t: ImportedTrack): PendingImport => ({
  importedTrackId: t.id,
  title: t.title,
  artist: t.artist,
  thumbnail_url: t.image_url,
});

const SPOTIFY_GREEN = "#1DB954";

function SpotifyGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={SPOTIFY_GREEN} aria-hidden>
      <path d="M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24zm5.5 17.3a.75.75 0 0 1-1.03.25c-2.82-1.72-6.36-2.11-10.54-1.16a.75.75 0 1 1-.33-1.46c4.57-1.04 8.49-.59 11.65 1.34.35.21.46.67.25 1.03zm1.47-3.27a.94.94 0 0 1-1.29.31c-3.23-1.99-8.15-2.56-11.97-1.4a.94.94 0 1 1-.54-1.8c4.37-1.32 9.79-.68 13.49 1.6.44.27.58.85.31 1.29zm.13-3.4C15.21 8.23 8.85 8.02 5.2 9.13a1.12 1.12 0 1 1-.65-2.15c4.2-1.27 11.2-1.03 15.6 1.58a1.12 1.12 0 1 1-1.15 1.92z" />
    </svg>
  );
}

/** Compact row for an imported track: tap to play the list from here, or
 * add just this track to the queue. */
function TrackRow({
  track, onPlay, onQueue, busy,
}: { track: ImportedTrack; onPlay: () => void; onQueue: () => void; busy: boolean }) {
  const unavailable = track.status === "unavailable";
  return (
    <div
      className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
        unavailable ? "opacity-40" : "hover:bg-white/[0.04]"
      }`}
    >
      <button
        onClick={() => !unavailable && onPlay()}
        disabled={unavailable || busy}
        className="flex items-center gap-3 flex-1 min-w-0 text-left"
      >
        <div className="relative w-11 h-11 flex-shrink-0">
          {track.image_url ? (
            <img src={track.image_url} alt={track.title} className="w-full h-full rounded-lg object-cover" />
          ) : (
            <div className="w-full h-full rounded-lg bg-[#1a1a1a] flex items-center justify-center">
              <Music2 size={16} className="text-[#3a3a3a]" />
            </div>
          )}
          {busy && (
            <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40">
              <Loader2 size={16} className="animate-spin text-white" />
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#f5f0e8] truncate" style={{ fontFamily: "Syne, sans-serif" }}>
            {track.title}
          </p>
          <p className="text-xs text-[#605850] truncate mt-0.5">
            {track.artist}{unavailable ? " · no match" : ""}
          </p>
        </div>
      </button>
      {!unavailable && (
        <button
          onClick={onQueue}
          title="Add to queue"
          className="flex-shrink-0 p-1.5 text-[#605850] hover:text-[#e8c97a] active:scale-90 transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100"
        >
          <ListEnd size={15} />
        </button>
      )}
    </div>
  );
}

/** "Play" + "Add to queue" buttons for a whole imported list. */
function ListActions({ onPlay, onQueue }: { onPlay: () => void; onQueue: () => void }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <button
        onClick={onPlay}
        className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-[#080808]"
        style={{ background: "linear-gradient(180deg,#e8c97a,#c9a84c)", fontFamily: "Syne, sans-serif" }}
      >
        <Play size={12} fill="currentColor" /> Play
      </button>
      <button
        onClick={onQueue}
        className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold text-[#b8b0a0] border border-[#2a2a2a] hover:text-[#e8c97a] transition-colors"
        style={{ fontFamily: "Syne, sans-serif" }}
      >
        <ListEnd size={13} /> Add to queue
      </button>
    </div>
  );
}

export default function SpotifyPanel({ initialPlaylistId }: { initialPlaylistId?: number | null } = {}) {
  const playImports = usePlayerStore((s) => s.playImports);
  const queueImports = usePlayerStore((s) => s.queueImports);
  const importBusy = usePlayerStore((s) => s.importBusy);
  const showToast = usePlayerStore((s) => s.showToast);

  const [status, setStatus] = useState<SpotifyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const [liked, setLiked] = useState<ImportedTrack[]>([]);
  const [playlists, setPlaylists] = useState<ImportedPlaylist[]>([]);
  const [openPl, setOpenPl] = useState<ImportedPlaylist | null>(null);
  const [plTracks, setPlTracks] = useState<ImportedTrack[]>([]);
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [csvPlaylistName, setCsvPlaylistName] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);

  const loadLibrary = useCallback(async () => {
    try {
      const [l, p] = await Promise.all([spotifyApi.likedTracks(), spotifyApi.playlists()]);
      setLiked(l.data);
      setPlaylists(p.data);
    } catch { /* ignore */ }
  }, []);

  // Status + any already-imported library (CSV imports show even with no OAuth
  // connection). Also surfaces the ?spotify=… result from the OAuth callback.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("spotify");
    if (result) {
      showToast(
        result === "connected" ? "Spotify connected — import your songs"
          : result === "denied" ? "Spotify connection cancelled"
          : "Couldn't connect Spotify — try again",
      );
      window.history.replaceState({}, "", window.location.pathname);
    }
    Promise.all([
      spotifyApi.status().then(({ data }) => setStatus(data)).catch(() => setStatus({ connected: false, configured: false })),
      loadLibrary(),
    ]).finally(() => setLoading(false));
  }, [loadLibrary, showToast]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { data } = await spotifyApi.connect();
      window.location.href = data.url;
    } catch {
      showToast("Spotify connect isn't available right now");
      setConnecting(false);
    }
  };

  const handleSync = async () => {
    setImporting(true);
    try {
      const { data } = await spotifyApi.importLibrary();
      showToast(`Imported ${data.liked_imported} liked · ${data.playlists_imported} playlists`);
      await loadLibrary();
      const { data: st } = await spotifyApi.status();
      setStatus(st);
    } catch {
      showToast("Sync failed — try again");
    } finally {
      setImporting(false);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setUploading(true);
    try {
      const text = await file.text();
      const { data } = await spotifyApi.importCsv(text, csvPlaylistName.trim() || undefined);
      showToast(
        data.imported > 0
          ? `Imported ${data.imported} songs${data.skipped ? ` · skipped ${data.skipped}` : ""}`
          : "No songs found in that file",
      );
      setCsvPlaylistName("");
      await loadLibrary();
    } catch {
      showToast("Couldn't import that file — is it a Spotify CSV export?");
    } finally {
      setUploading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await spotifyApi.disconnect();
      setStatus({ connected: false, configured: status?.configured ?? false });
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

  // Clear the per-row spinner once the store finishes resolving the first track.
  useEffect(() => { if (!importBusy) setResolvingId(null); }, [importBusy]);

  // Deep-link: open a specific imported playlist (from the Playlists tab card).
  useEffect(() => {
    if (initialPlaylistId == null || !playlists.length) return;
    const pl = playlists.find((p) => p.id === initialPlaylistId);
    if (pl) openPlaylist(pl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPlaylistId, playlists]);

  // Play a whole imported list as a queue, starting at `index`. The store
  // resolves the first track now and the rest lazily as they're reached.
  const playList = (tracks: ImportedTrack[], index: number) => {
    setResolvingId(tracks[index].id);
    playImports(tracks.map(toPending), index);
  };
  const queueList = (tracks: ImportedTrack[]) => queueImports(tracks.map(toPending));
  const queueOne = (track: ImportedTrack) => queueImports([toPending(track)]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={20} className="animate-spin text-[#605850]" />
      </div>
    );
  }

  // Playlist drill-down.
  if (openPl) {
    return (
      <div>
        <button
          onClick={() => setOpenPl(null)}
          className="flex items-center gap-1.5 text-xs text-[#b8b0a0] hover:text-[#e8c97a] mb-4 transition-colors"
        >
          <ChevronLeft size={14} /> All imported playlists
        </button>
        <h3 className="text-base font-semibold text-[#f5f0e8] mb-3" style={{ fontFamily: "Syne, sans-serif" }}>
          {openPl.name}
        </h3>
        {plTracks.length > 0 && (
          <ListActions onPlay={() => playList(plTracks, 0)} onQueue={() => queueList(plTracks)} />
        )}
        <div className="flex flex-col gap-1">
          {plTracks.map((t, i) => (
            <TrackRow
              key={t.id} track={t} busy={resolvingId === t.id}
              onPlay={() => playList(plTracks, i)} onQueue={() => queueOne(t)}
            />
          ))}
        </div>
      </div>
    );
  }

  const hasLibrary = liked.length > 0 || playlists.length > 0;

  return (
    <div>
      {/* ── Import from CSV (works on a free Spotify account) ──────────────── */}
      <div className="mb-5 p-4 rounded-xl bg-[#111111] border border-[#2a2a2a]">
        <div className="flex items-center gap-2.5 mb-1">
          <SpotifyGlyph size={20} />
          <p className="text-sm font-semibold text-[#f5f0e8]" style={{ fontFamily: "Syne, sans-serif" }}>
            Import from Spotify
          </p>
        </div>
        <p className="text-xs text-[#605850] mb-3 leading-relaxed">
          Export your songs to CSV with a free tool (Exportify, Soundiiz or TuneMyMusic),
          then upload it here. They play through Ụda — no Spotify Premium needed.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={csvPlaylistName}
            onChange={(e) => setCsvPlaylistName(e.target.value)}
            placeholder="Playlist name (optional — blank = Liked)"
            className="flex-1 bg-[#080808] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-[#f5f0e8] placeholder-[#3a3a3a] focus:outline-none focus:border-[#c9a84c] transition-colors"
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-[#080808] disabled:opacity-60"
            style={{ background: SPOTIFY_GREEN, fontFamily: "Syne, sans-serif" }}
          >
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            {uploading ? "Importing…" : "Upload CSV"}
          </button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" />
        </div>

        {/* OAuth path — only if the server has Spotify configured (needs Premium). */}
        {status?.connected ? (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#1f1f1f]">
            <span className="text-[11px] text-[#605850] flex-1">Spotify account connected</span>
            <button
              onClick={handleSync}
              disabled={importing}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-[#e8c97a] disabled:opacity-60"
            >
              {importing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Sync
            </button>
            <button onClick={handleDisconnect} title="Disconnect" className="p-1 text-[#605850] hover:text-[#be123c] transition-colors">
              <Link2Off size={14} />
            </button>
          </div>
        ) : status?.configured ? (
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="mt-3 pt-3 border-t border-[#1f1f1f] w-full text-left text-[11px] text-[#605850] hover:text-[#e8c97a] transition-colors"
          >
            {connecting ? "Opening Spotify…" : "Or connect a Spotify Premium account →"}
          </button>
        ) : null}
      </div>

      {/* ── Imported library ──────────────────────────────────────────────── */}
      {!hasLibrary ? (
        <div className="text-center py-10">
          <p className="text-sm text-[#605850]">Your imported songs will appear here.</p>
        </div>
      ) : (
        <>
          {playlists.length > 0 && (
            <div className="mb-7">
              <h3 className="text-sm font-semibold text-[#f5f0e8] mb-3" style={{ fontFamily: "Syne, sans-serif" }}>
                Imported Playlists
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {playlists.map((pl) => (
                  <button key={pl.id} onClick={() => openPlaylist(pl)} className="text-left group">
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

          {liked.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-[#f5f0e8] mb-3" style={{ fontFamily: "Syne, sans-serif" }}>
                Liked Songs
              </h3>
              <ListActions onPlay={() => playList(liked, 0)} onQueue={() => queueList(liked)} />
              <div className="flex flex-col gap-1">
                {liked.map((t, i) => (
                  <TrackRow
                    key={t.id} track={t} busy={resolvingId === t.id}
                    onPlay={() => playList(liked, i)} onQueue={() => queueOne(t)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
