import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Check, Plus, Play, Shuffle, Radio, Disc3, ChevronDown, Loader2 } from "lucide-react";
import { musicApi, libraryApi } from "../services/api";
import { usePlayerStore } from "../store/playerStore";
import { useAuthStore } from "../store/authStore";
import type { Song, Album } from "../types";
import SongRow from "../components/ui/SongRow";
import AddToPlaylistModal from "../components/ui/AddToPlaylistModal";
import ShareSheet from "../components/ui/ShareSheet";

// ── Artist metadata helpers ───────────────────────────────────────────────────

const GRADIENTS: [string, string][] = [
  ["#c9a84c", "#3a1f06"], ["#2dbe8a", "#06241a"], ["#7c3aed", "#220546"],
  ["#be123c", "#310615"], ["#c2410c", "#2a0d04"], ["#0369a1", "#03253c"],
];

function artistGradient(name: string): [string, string] {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

function artistInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

// Rough monthly listeners: deterministic but looks real
function fakeListeners(name: string): string {
  let h = 7;
  for (const c of name) h = (h * 17 + c.charCodeAt(0)) >>> 0;
  const m = (1.2 + (h % 28) * 0.4).toFixed(1);
  return `${m}M`;
}

// Genre tag based on hash
const GENRE_TAGS = ["Afrobeats", "Afropop", "Amapiano", "Afro-soul", "Afro-fusion", "Highlife", "Alté"];
function fakeGenre(name: string): string {
  let h = 3;
  for (const c of name) h = (h * 13 + c.charCodeAt(0)) >>> 0;
  return GENRE_TAGS[h % GENRE_TAGS.length];
}

// Related artists: pick 6 from a pool, excluding the current artist
const ARTIST_POOL = [
  "Burna Boy","Wizkid","Davido","Asake","Rema","Tems","Omah Lay",
  "Fireboy DML","Adekunle Gold","Tiwa Savage","Kizz Daniel","Olamide",
  "Simi","Flavour","Phyno","Ycee","Wande Coal","Mr Eazi",
];
function relatedArtists(name: string): string[] {
  const pool = ARTIST_POOL.filter((a) => a.toLowerCase() !== name.toLowerCase());
  let h = 5;
  for (const c of name) h = (h * 11 + c.charCodeAt(0)) >>> 0;
  const result: string[] = [];
  for (let i = 0; i < 6; i++) {
    result.push(pool[(h + i * 3) % pool.length]);
  }
  return [...new Set(result)].slice(0, 6);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ArtistPage() {
  const { name: encodedName } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const { playSong } = usePlayerStore();
  const showToast = usePlayerStore((s) => s.showToast);
  const isGuest = useAuthStore((s) => s.isGuest);

  const artistName = decodeURIComponent(encodedName || "");
  const [from, to] = artistGradient(artistName);
  const genre = fakeGenre(artistName);
  const listeners = fakeListeners(artistName);

  const [songs, setSongs] = useState<Song[]>([]);
  const [related, setRelated] = useState<string[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [albumsLoading, setAlbumsLoading] = useState(true);
  const [showAllSongs, setShowAllSongs] = useState(false);
  const [heroImage, setHeroImage] = useState("");
  const [loading, setLoading] = useState(true);
  const [radioLoading, setRadioLoading] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [playlistSong, setPlaylistSong] = useState<Song | null>(null);
  const [shareSong, setShareSong] = useState<Song | null>(null);

  useEffect(() => {
    setLoading(true);
    setSongs([]);
    setRelated([]);
    setShowAllSongs(false);
    setHeroImage("");
    musicApi
      .artist(artistName)
      .then(({ data }) => {
        setSongs(data.songs || []);
        // Prefer the channel banner (wide) then avatar; gradient+initials below
        // remain the fallback until YouTube returns an image.
        setHeroImage(data.banner_url || data.image_url || "");
        // Backend related artists are genre-correct; fall back to the local pool
        // only when the LLM call returned nothing (e.g. no Anthropic credit).
        setRelated(
          (data.related && data.related.length > 0)
            ? data.related
            : relatedArtists(artistName)
        );
      })
      .catch(() => setRelated(relatedArtists(artistName)))
      .finally(() => setLoading(false));
  }, [artistName]);

  // Albums load independently — slower (YouTube playlist search) so it shouldn't
  // hold up the songs list.
  useEffect(() => {
    setAlbumsLoading(true);
    setAlbums([]);
    musicApi
      .artistAlbums(artistName)
      .then(({ data }) => setAlbums(data.results || []))
      .catch(() => setAlbums([]))
      .finally(() => setAlbumsLoading(false));
  }, [artistName]);

  // Load whether the logged-in user already follows this artist.
  useEffect(() => {
    setFollowing(false);
    if (isGuest) return;
    libraryApi
      .getFavouriteArtists()
      .then(({ data }) => {
        const names: string[] = (data || []).map((f: { name: string }) => f.name.toLowerCase());
        setFollowing(names.includes(artistName.toLowerCase()));
      })
      .catch(() => {});
  }, [artistName, isGuest]);

  const handleFollow = async () => {
    if (isGuest) { showToast("Sign in to follow artists"); return; }
    if (followBusy) return;
    setFollowBusy(true);
    const next = !following;
    setFollowing(next); // optimistic
    try {
      if (next) {
        await libraryApi.followArtist({ name: artistName, thumbnail_url: songs[0]?.thumbnail_url || "" });
        showToast(`Following ${artistName}`);
      } else {
        await libraryApi.unfollowArtist(artistName);
        showToast(`Unfollowed ${artistName}`);
      }
    } catch {
      setFollowing(!next); // revert on failure
      showToast("Couldn't update — try again");
    } finally {
      setFollowBusy(false);
    }
  };

  const handlePlay = () => {
    if (songs.length > 0) playSong(songs[0], songs);
  };

  const handleShuffle = () => {
    if (!songs.length) return;
    const shuffled = [...songs].sort(() => Math.random() - 0.5);
    playSong(shuffled[0], shuffled);
  };

  // Blended mix: artist's tracks weighted heavily against similar artists.
  const handleRadio = async () => {
    if (radioLoading) return;
    setRadioLoading(true);
    try {
      const { data } = await musicApi.artistRadio(artistName);
      const mix: Song[] = data.results || [];
      if (mix.length > 0) playSong(mix[0], mix);
    } catch {
      // Fall back to just shuffling the artist's own catalogue.
      handleShuffle();
    } finally {
      setRadioLoading(false);
    }
  };

  return (
    <div className="pb-6 max-w-2xl">

      {/* ── Hero header ──────────────────────────────────────────────────── */}
      <div className="relative h-[260px] overflow-hidden">
        {/* Gradient fill (always present — also the fallback while/if no photo) */}
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${from}, ${to})` }} />
        {/* Real artist photo (channel banner/avatar) when available */}
        {heroImage && (
          <img
            src={heroImage}
            alt={artistName}
            className="absolute inset-0 w-full h-full object-cover"
            onError={() => setHeroImage("")}
          />
        )}
        {/* Sheen overlay */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.08) 0%,transparent 50%,rgba(0,0,0,0.5) 100%)" }} />
        {/* Large initials watermark — only when there's no real photo */}
        {!heroImage && (
          <div
            className="absolute -right-5 -top-5 font-extrabold leading-none pointer-events-none select-none"
            style={{
              fontFamily: "Syne, sans-serif",
              fontSize: 200,
              color: "rgba(255,255,255,0.08)",
              letterSpacing: "-0.04em",
            }}
          >
            {artistInitials(artistName)}
          </div>
        )}
        {/* Bottom gradient fade */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(8,8,8,0.25) 0%, rgba(8,8,8,0.9) 100%)" }} />

        {/* Back + more buttons */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-3.5 z-10 w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md"
          style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.12)" }}
        >
          <ChevronLeft size={15} className="text-white" />
        </button>

        {/* Artist info at bottom */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
          <h1
            className="text-[28px] font-extrabold text-white leading-tight"
            style={{ fontFamily: "Syne, sans-serif", letterSpacing: "-0.02em", textShadow: "0 2px 16px rgba(0,0,0,0.5)" }}
          >
            {artistName}
          </h1>
          <div className="flex items-center gap-2.5 mt-1.5">
            <span className="text-[11px] text-white/65 font-semibold tracking-[0.06em]">{genre}</span>
            <span className="w-1 h-1 rounded-full bg-white/30" />
            <span className="text-[11px] text-white/65 font-semibold">{listeners} monthly listeners</span>
          </div>
        </div>
      </div>

      {/* ── Action row ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-4 py-4">
        {/* Play */}
        <button
          onClick={handlePlay}
          disabled={songs.length === 0}
          className="flex-1 h-11 rounded-full flex items-center justify-center gap-2 font-bold text-sm text-[#080808] disabled:opacity-40 transition-opacity"
          style={{
            fontFamily: "Syne, sans-serif",
            letterSpacing: "0.04em",
            background: "linear-gradient(180deg,#e8c97a,#c9a84c)",
            boxShadow: "0 6px 16px rgba(201,168,76,0.35), inset 0 1px 0 rgba(255,255,255,0.3)",
          }}
        >
          <Play size={13} fill="currentColor" />
          Play
        </button>

        {/* Shuffle — icon only */}
        <button
          onClick={handleShuffle}
          disabled={songs.length === 0}
          title="Shuffle"
          className="h-11 w-11 rounded-full flex items-center justify-center text-white disabled:opacity-40 transition-opacity flex-shrink-0"
          style={{ background: "transparent", border: "1px solid #2a2a2a" }}
        >
          <Shuffle size={14} />
        </button>

        {/* Follow toggle */}
        <button
          onClick={handleFollow}
          disabled={followBusy}
          className="h-11 px-4 rounded-full flex items-center gap-2 font-bold text-sm transition-all disabled:opacity-60"
          style={{
            fontFamily: "Syne, sans-serif",
            letterSpacing: "0.04em",
            background: "transparent",
            border: `1.5px solid ${following ? "rgba(201,168,76,0.55)" : "#2a2a2a"}`,
            color: following ? "#e8c97a" : "#b8b0a0",
          }}
        >
          {following ? <Check size={13} /> : <Plus size={13} />}
          {following ? "Following" : "Follow"}
        </button>
      </div>

      {/* ── Stations: Radio + Mix ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2.5 px-4 mb-6">
        {/* Radio — blended mix of this artist + similar artists */}
        <button
          onClick={handleRadio}
          disabled={songs.length === 0 || radioLoading}
          className="relative h-[68px] rounded-2xl overflow-hidden flex items-center gap-3 px-3.5 text-left disabled:opacity-40 transition-transform active:scale-[0.98]"
          style={{ background: "linear-gradient(135deg, #7c3aed, #220546)" }}
        >
          <span className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
            {radioLoading ? <Loader2 size={16} className="animate-spin text-white" /> : <Radio size={16} className="text-white" />}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-white leading-tight" style={{ fontFamily: "Syne, sans-serif" }}>Radio</span>
            <span className="block text-[10.5px] text-white/65 truncate">{artistName} & the genre</span>
          </span>
        </button>

        {/* Mix — this artist's own catalogue, shuffled */}
        <button
          onClick={handleShuffle}
          disabled={songs.length === 0}
          className="relative h-[68px] rounded-2xl overflow-hidden flex items-center gap-3 px-3.5 text-left disabled:opacity-40 transition-transform active:scale-[0.98]"
          style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
        >
          <span className="w-9 h-9 rounded-full bg-black/25 flex items-center justify-center flex-shrink-0">
            <Disc3 size={16} className="text-white" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-white leading-tight" style={{ fontFamily: "Syne, sans-serif" }}>Mix</span>
            <span className="block text-[10.5px] text-white/70 truncate">Songs & features, shuffled</span>
          </span>
        </button>
      </div>

      {/* ── Top songs ────────────────────────────────────────────────────── */}
      <div className="px-4 mb-2">
        <h2
          className="text-sm font-semibold text-[#f5f0e8] mb-1"
          style={{ fontFamily: "Syne, sans-serif" }}
        >
          Top Songs
        </h2>
      </div>

      {loading ? (
        <div className="flex flex-col gap-1 px-1">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5">
              <div className="w-7 h-4 rounded bg-[#1a1a1a] animate-pulse flex-shrink-0" />
              <div className="w-11 h-11 rounded-lg bg-[#1a1a1a] animate-pulse flex-shrink-0" />
              <div className="flex-1">
                <div className="h-3.5 w-2/3 bg-[#1a1a1a] rounded animate-pulse mb-1.5" />
                <div className="h-3 w-1/3 bg-[#1a1a1a] rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : songs.length === 0 ? (
        <p className="text-sm text-[#3a3a3a] px-4 py-6">No songs found for this artist.</p>
      ) : (
        <>
        <div className="flex flex-col gap-1 px-1">
          {(showAllSongs ? songs : songs.slice(0, 6)).map((song, i) => (
            <SongRow
              key={song.youtube_id}
              song={song}
              index={i}
              queue={songs}
              onPlay={playSong}
              onSecondAction={(s) => isGuest ? showToast("Sign in to build playlists") : setPlaylistSong(s)}
              secondActionIcon={<PlaylistAddIcon />}
              onShare={setShareSong}
            />
          ))}
        </div>
        {songs.length > 6 && (
          <button
            onClick={() => setShowAllSongs((v) => !v)}
            className="flex items-center gap-1.5 mx-4 mt-3 text-xs font-semibold text-[#b8b0a0] hover:text-[#e8c97a] transition-colors"
            style={{ fontFamily: "Syne, sans-serif" }}
          >
            {showAllSongs ? "Show less" : `Show all ${songs.length} songs`}
            <ChevronDown size={14} className={`transition-transform ${showAllSongs ? "rotate-180" : ""}`} />
          </button>
        )}
        </>
      )}

      {/* ── Albums ───────────────────────────────────────────────────────── */}
      {(albumsLoading || albums.length > 0) && (
        <div className="mt-8">
          <div className="px-4 mb-3">
            <h2 className="text-sm font-semibold text-[#f5f0e8]" style={{ fontFamily: "Syne, sans-serif" }}>
              Albums
            </h2>
          </div>
          {albumsLoading ? (
            <div className="flex gap-4 overflow-x-auto no-scrollbar -mx-4 px-4 pb-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex-shrink-0 w-32">
                  <div className="w-32 h-32 rounded-xl bg-[#1a1a1a] animate-pulse mb-2" />
                  <div className="h-3 w-3/4 bg-[#1a1a1a] rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto no-scrollbar -mx-4 px-4 pb-2">
              {albums.map((album) => (
                <button
                  key={album.playlist_id}
                  onClick={() => navigate(`/album/${album.playlist_id}`)}
                  className="flex-shrink-0 w-32 text-left group focus:outline-none"
                  title={album.title}
                >
                  <div className="relative mb-2">
                    <img
                      src={album.thumbnail_url}
                      alt={album.title}
                      className="w-32 h-32 rounded-xl object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                    />
                    <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-black/60 text-[#e8c97a] backdrop-blur-sm">
                      {album.track_count} tracks
                    </span>
                  </div>
                  <p className="text-xs font-medium truncate leading-tight text-[#f5f0e8]" style={{ fontFamily: "Syne, sans-serif" }}>
                    {album.title}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Related artists ───────────────────────────────────────────────── */}
      {!loading && (
        <div className="mt-8">
          <div className="px-4 mb-3">
            <h2
              className="text-sm font-semibold text-[#f5f0e8]"
              style={{ fontFamily: "Syne, sans-serif" }}
            >
              Fans also like
            </h2>
          </div>
          <div className="flex gap-4 overflow-x-auto no-scrollbar -mx-4 px-4 pb-2">
            {related.map((name) => {
              const [f, t] = artistGradient(name);
              return (
                <button
                  key={name}
                  onClick={() => navigate(`/artist/${encodeURIComponent(name)}`)}
                  className="flex-shrink-0 flex flex-col items-center gap-2 focus:outline-none"
                >
                  <div
                    className="w-[72px] h-[72px] rounded-full flex items-center justify-center"
                    style={{ background: `linear-gradient(135deg, ${f}, ${t})` }}
                  >
                    <span
                      className="text-sm font-bold text-white/80"
                      style={{ fontFamily: "Syne, sans-serif" }}
                    >
                      {artistInitials(name)}
                    </span>
                  </div>
                  <span
                    className="text-[11px] font-semibold text-white text-center w-20 truncate"
                    style={{ fontFamily: "Syne, sans-serif" }}
                  >
                    {name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Modals */}
      {playlistSong && (
        <AddToPlaylistModal song={playlistSong} onClose={() => setPlaylistSong(null)} />
      )}
      {shareSong && (
        <ShareSheet song={shareSong} onClose={() => setShareSong(null)} />
      )}
    </div>
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
