import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Music2, Waves, Zap, Target, Moon, Star, LayoutGrid, Play,
} from "lucide-react";
import {
  recommendationsApi,
  historyApi,
  libraryApi,
  musicApi,
} from "../services/api";
import { usePlayerStore } from "../store/playerStore";
import { useAuthStore } from "../store/authStore";
import { useSavedSongs } from "../hooks/useSavedSongs";
import type { Song, Album } from "../types";
import SongRow  from "../components/ui/SongRow";
import SongCard from "../components/ui/SongCard";
import AddToPlaylistModal from "../components/ui/AddToPlaylistModal";
import { clientCache, TTL } from "../services/cache";

// ── Cache helpers (thin wrappers around the shared clientCache) ───────────────
// TTL is stored at set-time; the ttlMs arg to cacheGet is kept for call-site
// clarity but is no longer used at read-time (clientCache handles expiry).
function cacheGet<T>(key: string, _ttlMs?: number): T | null {
  return clientCache.get<T>(key);
}
function cacheSet<T>(key: string, data: T, ttlMs = TTL.LONG) {
  clientCache.set(key, data, ttlMs);
}

const TTL_LONG  = TTL.LONG;   // 15 min — trending, albums, new-this-week
const TTL_SHORT = TTL.MEDIUM; // 5 min  — personalised recs (mood/default)

// ── Types ─────────────────────────────────────────────────────────────────────

interface Mood {
  label: string;
  value: string;
  icon: React.ReactNode;
}

interface ArtistMix {
  artist: string;
  playCount: number;
  thumbnail?: string;   // a song thumbnail from this artist's history
  followed?: boolean;   // user explicitly follows this artist
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MOODS: Mood[] = [
  { label: "All",        value: "",           icon: <LayoutGrid size={13} /> },
  { label: "Afrobeats",  value: "afrobeats",  icon: <Music2    size={13} /> },
  { label: "Chill",      value: "chill",      icon: <Waves     size={13} /> },
  { label: "Energetic",  value: "energetic",  icon: <Zap       size={13} /> },
  { label: "Focus",      value: "focus",      icon: <Target    size={13} /> },
  { label: "Late Night", value: "late night", icon: <Moon      size={13} /> },
  { label: "Party",      value: "party",      icon: <Star      size={13} /> },
];

// 6 preset gradients — picked by a hash of the artist name
const MIX_GRADIENTS: [string, string][] = [
  ["#c9a84c", "#6b3a0f"],   // gold
  ["#1a7a4a", "#0a3020"],   // emerald
  ["#7c3aed", "#3b0764"],   // violet
  ["#be123c", "#4c0519"],   // crimson
  ["#0369a1", "#082f49"],   // ocean
  ["#c2410c", "#431407"],   // burnt orange
];

function artistGradient(name: string): [string, string] {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return MIX_GRADIENTS[h % MIX_GRADIENTS.length];
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { playSong, queueMix } = usePlayerStore();
  const showToast = usePlayerStore((s) => s.showToast);
  const user = useAuthStore((s) => s.user);
  const isGuest = useAuthStore((s) => s.isGuest);
  const { savedIds, toggleSave } = useSavedSongs();
  const navigate = useNavigate();

  // Recently played
  const [recentlyPlayed, setRecentlyPlayed] = useState<Song[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Artist mixes (derived from history)
  const [artistMixes, setArtistMixes] = useState<ArtistMix[]>([]);

  // New This Week
  const [newThisWeek, setNewThisWeek]     = useState<Song[]>([]);
  const [loadingNew, setLoadingNew]       = useState(true);
  const [errorNew, setErrorNew]           = useState(false);

  // Trending in Naija
  const [trending, setTrending]           = useState<Song[]>([]);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const [errorTrending, setErrorTrending] = useState(false);

  // Top Albums
  const [albums, setAlbums]               = useState<Album[]>([]);
  const [loadingAlbums, setLoadingAlbums] = useState(true);
  const [errorAlbums, setErrorAlbums]     = useState(false);

  // Afrobeat Mixes
  const [mixes, setMixes]                 = useState<Song[]>([]);
  const [loadingMixes, setLoadingMixes]   = useState(true);
  const [errorMixes, setErrorMixes]       = useState(false);

  // Made for You / mood
  const [recommendations, setRecommendations] = useState<Song[]>([]);
  const [loadingRec, setLoadingRec]           = useState(true);
  const [activeMood, setActiveMood]           = useState("");

  // Playlist modal
  const [playlistSong, setPlaylistSong] = useState<Song | null>(null);

  // Whether the user just clicked a mood pill (triggers auto-play)
  const moodClickedRef = useRef(false);

  // ── Fetch: history + artist mixes ────────────────────────────────────────
  useEffect(() => {
    if (isGuest) { setLoadingHistory(false); return; }
    // Use the shared cache so ProfilePage can reuse the same response
    const cachedHistory = clientCache.get<any[]>("history");
    const historyPromise = cachedHistory
      ? Promise.resolve({ data: cachedHistory })
      : historyApi.getHistory().then((res) => {
          if (res.data?.length) clientCache.set("history", res.data, TTL.MEDIUM);
          return res;
        });
    // Followed artists also seed "Your Artist Mixes" — fetched in parallel.
    const favPromise = libraryApi
      .getFavouriteArtists()
      .then((res) => res.data as { name: string; thumbnail_url?: string }[])
      .catch(() => [] as { name: string; thumbnail_url?: string }[]);

    Promise.all([historyPromise, favPromise])
      .then(([{ data }, favourites]) => {
        // Recently played (unique songs, newest first)
        const seenIds = new Set<string>();
        const unique: Song[] = [];
        for (const entry of data) {
          if (!seenIds.has(entry.song.youtube_id)) {
            seenIds.add(entry.song.youtube_id);
            unique.push(entry.song);
          }
        }
        setRecentlyPlayed(unique.slice(0, 12));

        // Tally plays + a thumbnail per artist from history.
        const artistCount: Record<string, number> = {};
        const artistThumb: Record<string, string> = {};
        for (const entry of data) {
          const a = entry.song.artist;
          artistCount[a] = (artistCount[a] ?? 0) + 1;
          if (!artistThumb[a] && entry.song.thumbnail_url) {
            artistThumb[a] = entry.song.thumbnail_url;
          }
        }

        // Mixes = followed artists (always) + most-played artists (3+ plays).
        const followedNames = new Set(favourites.map((f) => f.name.toLowerCase()));
        const byName = new Map<string, ArtistMix>();

        // Followed first — they should always appear.
        for (const fav of favourites) {
          byName.set(fav.name.toLowerCase(), {
            artist: fav.name,
            playCount: artistCount[fav.name] ?? 0,
            thumbnail: artistThumb[fav.name] || fav.thumbnail_url || undefined,
            followed: true,
          });
        }
        // Then most-played artists not already followed.
        for (const [artist, playCount] of Object.entries(artistCount)) {
          if (playCount < 3) continue;
          const key = artist.toLowerCase();
          if (byName.has(key)) continue;
          byName.set(key, {
            artist,
            playCount,
            thumbnail: artistThumb[artist],
            followed: followedNames.has(key),
          });
        }

        const mixes: ArtistMix[] = Array.from(byName.values())
          .sort((a, b) => {
            // Followed artists float to the top, then by play count.
            if (a.followed !== b.followed) return a.followed ? -1 : 1;
            return b.playCount - a.playCount;
          })
          .slice(0, 10);
        setArtistMixes(mixes);
      })
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, []);

  // ── Fetch: New This Week ──────────────────────────────────────────────────
  useEffect(() => {
    if (isGuest) { setLoadingNew(false); return; }
    const hit = cacheGet<Song[]>("new_this_week", TTL_LONG);
    if (hit) { setNewThisWeek(hit); setLoadingNew(false); return; }
    recommendationsApi
      .get("new")
      .then(({ data }) => {
        const songs: Song[] = data.recommendations || [];
        setNewThisWeek(songs); setErrorNew(false);
        if (songs.length) cacheSet("new_this_week", songs, TTL_LONG);
      })
      .catch(() => { setNewThisWeek([]); setErrorNew(true); })
      .finally(() => setLoadingNew(false));
  }, []);

  // ── Fetch: Trending in Naija ──────────────────────────────────────────────
  useEffect(() => {
    const hit = cacheGet<Song[]>("trending", TTL_LONG);
    if (hit) { setTrending(hit); setLoadingTrending(false); return; }
    musicApi
      .trending()
      .then(({ data }) => {
        const songs: Song[] = data.results || [];
        setTrending(songs); setErrorTrending(false);
        if (songs.length) cacheSet("trending", songs, TTL_LONG);
      })
      .catch(() => { setTrending([]); setErrorTrending(true); })
      .finally(() => setLoadingTrending(false));
  }, []);

  // ── Fetch: Top Albums ─────────────────────────────────────────────────────
  useEffect(() => {
    const hit = cacheGet<Album[]>("albums_v2", TTL_LONG);
    if (hit) { setAlbums(hit); setLoadingAlbums(false); return; }
    musicApi
      .albums()
      .then(({ data }) => {
        const list: Album[] = data.results || [];
        setAlbums(list); setErrorAlbums(false);
        if (list.length) cacheSet("albums_v2", list, TTL_LONG);
      })
      .catch(() => { setAlbums([]); setErrorAlbums(true); })
      .finally(() => setLoadingAlbums(false));
  }, []);

  // ── Fetch: Afrobeat Mixes ─────────────────────────────────────────────────
  useEffect(() => {
    const hit = cacheGet<Song[]>("mixes", TTL_LONG);
    if (hit) { setMixes(hit); setLoadingMixes(false); return; }
    musicApi
      .mixes()
      .then(({ data }) => {
        const songs: Song[] = data.results || [];
        setMixes(songs); setErrorMixes(false);
        if (songs.length) cacheSet("mixes", songs, TTL_LONG);
      })
      .catch(() => { setMixes([]); setErrorMixes(true); })
      .finally(() => setLoadingMixes(false));
  }, []);

  // ── Fetch: Made for You / mood ────────────────────────────────────────────
  useEffect(() => {
    if (isGuest) { setLoadingRec(false); return; }
    const cacheKey = `recs_${activeMood || "default"}`;
    const hit = cacheGet<Song[]>(cacheKey, TTL_SHORT);
    if (hit && !moodClickedRef.current) {
      setRecommendations(hit);
      setLoadingRec(false);
      return;
    }
    setLoadingRec(true);
    recommendationsApi
      .get(activeMood || undefined)
      .then(({ data }) => {
        const songs: Song[] = data.recommendations || [];
        setRecommendations(songs);
        if (songs.length) cacheSet(cacheKey, songs, TTL_SHORT);
        // Auto-play when user tapped a specific mood pill
        if (moodClickedRef.current && songs.length > 0) {
          playSong(songs[0], songs);
          moodClickedRef.current = false;
        }
      })
      .catch(() => setRecommendations([]))
      .finally(() => setLoadingRec(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMood]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleMoodClick = (value: string) => {
    if (value !== "") moodClickedRef.current = true;
    setActiveMood(value);
  };

  // An Artist Mix is a genre station: this artist + same-genre artists, a new
  // line-up each day, reshuffled on every tap, and set to roll on to another
  // artist when it runs dry so it never stops.
  const handleArtistMixPlay = async (artist: string) => {
    try {
      const { data } = await musicApi.artistRadio(artist);
      const mix: Song[] = [...(data.results || [])].sort(() => Math.random() - 0.5);
      if (mix.length > 0) {
        queueMix(mix, { endlessArtist: artist, endlessPool: data.related || [] });
      } else {
        // Fallback: the artist's own catalogue, shuffled.
        const { data: s } = await musicApi.search(artist, 15);
        const songs: Song[] = [...(s.results || [])].sort(() => Math.random() - 0.5);
        if (songs.length > 0) queueMix(songs, { endlessArtist: artist });
      }
    } catch {}
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const activeMoodLabel =
    MOODS.find((m) => m.value === activeMood)?.label ?? "Picks";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="px-4 md:px-8 py-6 md:py-8 max-w-4xl">

      {/* Greeting */}
      <div className="mb-8 md:mb-10">
        <h1
          className="text-2xl md:text-3xl font-bold leading-tight"
          style={{ fontFamily: "Syne, sans-serif" }}
        >
          <span className="text-[#f5f0e8]">{greeting()}</span>
          {user?.display_name && (
            <span className="text-[#e8c97a]">, {user.display_name}</span>
          )}
        </h1>
        <p className="text-[#605850] text-sm mt-1">What are we feeling today?</p>
      </div>

      {/* Guest sign-in banner */}
      {isGuest && (
        <button
          onClick={() => navigate("/login")}
          className="w-full mb-8 md:mb-10 rounded-2xl flex items-center gap-4 px-4 py-3.5 text-left transition-all hover:brightness-110 active:scale-[0.99]"
          style={{
            background: "linear-gradient(135deg, rgba(201,168,76,0.14), rgba(201,168,76,0.04))",
            border: "1px solid rgba(201,168,76,0.28)",
          }}
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#e8c97a]" style={{ fontFamily: "Syne, sans-serif" }}>
              You're browsing as a guest
            </p>
            <p className="text-xs text-[#605850] mt-0.5">Sign in to save songs, build playlists & sync across devices</p>
          </div>
          <span
            className="flex-shrink-0 px-4 py-2 rounded-lg text-xs font-bold text-[#080808]"
            style={{ fontFamily: "Syne, sans-serif", background: "linear-gradient(180deg, #e8c97a 0%, #c9a84c 100%)" }}
          >
            Sign in
          </span>
        </button>
      )}

      {/* ── Recently Played ──────────────────────────────────────────────── */}
      {(loadingHistory || recentlyPlayed.length > 0) && (
        <Section title="Recently Played">
          {loadingHistory ? (
            <CardScrollSkeleton />
          ) : (
            <HorizontalScroll>
              {recentlyPlayed.map((song) => (
                <SongCard
                  key={song.youtube_id}
                  song={song}
                  queue={recentlyPlayed}
                  onPlay={playSong}
                />
              ))}
            </HorizontalScroll>
          )}
        </Section>
      )}

      {/* ── New This Week ────────────────────────────────────────────────── */}
      {!isGuest && (
      <Section title="New This Week" subtitle="Fresh from your favourite artists">
        {loadingNew ? (
          <CardScrollSkeleton />
        ) : errorNew ? (
          <SectionError />
        ) : newThisWeek.length === 0 ? (
          <SectionEmpty message="Nothing new right now — check back soon." />
        ) : (
          <HorizontalScroll>
            {newThisWeek.map((song) => (
              <SongCard
                key={song.youtube_id}
                song={song}
                queue={newThisWeek}
                onPlay={playSong}
              />
            ))}
          </HorizontalScroll>
        )}
      </Section>
      )}

      {/* ── Your Artist Mixes ────────────────────────────────────────────── */}
      {!loadingHistory && artistMixes.length > 0 && (
        <Section title="Your Artist Mixes" subtitle="Based on what you play most">
          <HorizontalScroll>
            {artistMixes.map((mix) => (
              <ArtistMixCard
                key={mix.artist}
                artist={mix.artist}
                thumbnail={mix.thumbnail}
                followed={mix.followed}
                onPlay={() => handleArtistMixPlay(mix.artist)}
              />
            ))}
          </HorizontalScroll>
        </Section>
      )}

      {/* ── Mood selector ────────────────────────────────────────────────── */}
      {!isGuest && (
      <>
      <div className="mb-5 flex gap-2 overflow-x-auto no-scrollbar -mx-4 md:mx-0 px-4 md:px-0 pb-1">
        {MOODS.map((mood) => (
          <button
            key={mood.value}
            onClick={() => handleMoodClick(mood.value)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all border ${
              activeMood === mood.value
                ? "bg-[#c9a84c15] border-[#c9a84c55] text-[#e8c97a]"
                : "border-[#2a2a2a] text-[#605850] hover:text-[#b8b0a0] hover:border-[#3a3a3a]"
            }`}
          >
            {mood.icon}
            {mood.label}
          </button>
        ))}
      </div>

      {/* ── Made for You / Mood station ──────────────────────────────────── */}
      <Section
        title={activeMood ? `${activeMoodLabel} for You` : "Made for You"}
        subtitle={activeMood ? "Playing now — tap any track to jump in" : "Based on your listening history"}
      >
        {loadingRec ? (
          <div className="flex flex-col gap-1">
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
        ) : recommendations.length > 0 ? (
          <div className="flex flex-col gap-1">
            {recommendations.map((song, i) => (
              <SongRow
                key={song.youtube_id}
                song={song}
                index={i}
                queue={recommendations}
                onPlay={playSong}
                onAction={toggleSave}
                actionIcon={savedIds.has(song.youtube_id) ? <HeartFilledIcon /> : <HeartIcon />}
                onSecondAction={(s) => isGuest ? showToast("Sign in to build playlists") : setPlaylistSong(s)}
                secondActionIcon={<PlaylistAddIcon />}
                onArtistClick={(artist) => navigate(`/artist/${encodeURIComponent(artist)}`)}
              />
            ))}
          </div>
        ) : (
          <div className="py-10 text-center">
            <p className="text-[#3a3a3a] text-sm">
              {activeMood
                ? "No recommendations for this mood yet."
                : "Search and listen to some songs — your picks will appear here."}
            </p>
          </div>
        )}
      </Section>
      </>
      )}

      {/* ── Trending in Naija ────────────────────────────────────────────── */}
      <Section title="Trending in Naija" subtitle="Hot right now">
        {loadingTrending ? (
          <CardScrollSkeleton />
        ) : errorTrending ? (
          <SectionError />
        ) : trending.length === 0 ? (
          <SectionEmpty message="Nothing trending right now — check back soon." />
        ) : (
          <HorizontalScroll>
            {trending.map((song) => (
              <SongCard
                key={song.youtube_id}
                song={song}
                queue={trending}
                onPlay={playSong}
              />
            ))}
          </HorizontalScroll>
        )}
      </Section>

      {/* ── Top Albums ───────────────────────────────────────────────────── */}
      <Section title="Top Albums" subtitle="Full projects from your favourites">
        {loadingAlbums ? (
          <CardScrollSkeleton />
        ) : errorAlbums ? (
          <SectionError />
        ) : albums.length === 0 ? (
          <SectionEmpty message="Albums loading — check back in a moment." />
        ) : (
          <HorizontalScroll>
            {albums.map((album) => (
              <AlbumCard
                key={album.playlist_id}
                album={album}
                onClick={() => navigate(`/album/${album.playlist_id}`)}
              />
            ))}
          </HorizontalScroll>
        )}
      </Section>

      {/* ── Afrobeat Mixes ───────────────────────────────────────────────── */}
      <Section title="Afrobeat Mixes" subtitle="Long-form DJ sets & party mixes">
        {loadingMixes ? (
          <CardScrollSkeleton />
        ) : errorMixes ? (
          <SectionError />
        ) : mixes.length === 0 ? (
          <SectionEmpty message="No mixes right now — check back soon." />
        ) : (
          <HorizontalScroll>
            {mixes.map((song) => (
              <SongCard
                key={song.youtube_id}
                song={song}
                queue={mixes}
                onPlay={playSong}
              />
            ))}
          </HorizontalScroll>
        )}
      </Section>

      {playlistSong && (
        <AddToPlaylistModal
          song={playlistSong}
          onClose={() => setPlaylistSong(null)}
        />
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8 md:mb-10">
      <div className="mb-4">
        <h2
          className="text-base md:text-lg font-semibold text-[#f5f0e8]"
          style={{ fontFamily: "Syne, sans-serif" }}
        >
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs text-[#605850] mt-0.5">{subtitle}</p>
        )}
      </div>
      {children}
    </section>
  );
}

/** Full-bleed horizontal scroll that bleeds to screen edge on mobile */
function HorizontalScroll({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-3 no-scrollbar -mx-4 md:mx-0 px-4 md:px-0">
      {children}
    </div>
  );
}

/** Artist Mix card — shows the artist's thumbnail with a dark gradient overlay */
function ArtistMixCard({
  artist,
  thumbnail,
  followed,
  onPlay,
}: {
  artist: string;
  thumbnail?: string;
  followed?: boolean;
  onPlay: () => void;
}) {
  const [from, to] = artistGradient(artist);

  return (
    <button
      onClick={onPlay}
      className="flex-shrink-0 w-36 h-36 rounded-xl overflow-hidden relative group select-none cursor-pointer focus:outline-none"
      title={`Play ${artist} Mix`}
    >
      {/* Following badge — distinguishes favourited artists from most-played */}
      {followed && (
        <span
          className="absolute top-1.5 right-1.5 z-10 w-5 h-5 rounded-full flex items-center justify-center backdrop-blur-sm"
          style={{ background: "rgba(0,0,0,0.45)" }}
          title="You follow this artist"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="#e8c97a" stroke="none">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </span>
      )}
      {/* Background: real thumbnail if available, otherwise gradient */}
      {thumbnail ? (
        <img
          src={thumbnail}
          alt={artist}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
        />
      )}

      {/* Large initials watermark (visible on gradient bg, hidden under photo) */}
      {!thumbnail && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
          <span
            className="font-extrabold leading-none"
            style={{
              fontFamily: "Syne, sans-serif",
              fontSize: 110,
              color: "rgba(255,255,255,0.12)",
              letterSpacing: "-0.05em",
              marginTop: 16,
            }}
          >
            {artist.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)}
          </span>
        </div>
      )}

      {/* Dark gradient from bottom so text is always readable */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10" />

      {/* Text pinned to bottom */}
      <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 pt-8">
        <p
          className="text-white font-bold text-sm truncate leading-tight"
          style={{ fontFamily: "Syne, sans-serif" }}
        >
          {artist}
        </p>
        <p className="text-white/55 text-[11px] tracking-widest uppercase mt-0.5">Mix</p>
      </div>

      {/* Hover / play overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-200 flex items-center justify-center">
        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 backdrop-blur-sm">
          <Play size={16} fill="white" className="text-white ml-0.5" />
        </div>
      </div>
    </button>
  );
}

/** Album cover card — opens the album's tracklist page */
function AlbumCard({ album, onClick }: { album: Album; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 w-32 md:w-40 text-left group select-none cursor-pointer focus:outline-none"
      title={`${album.title} — ${album.artist}`}
    >
      <div className="relative mb-2.5">
        <img
          src={album.thumbnail_url}
          alt={album.title}
          className="w-32 h-32 md:w-40 md:h-40 rounded-xl object-cover transition-transform duration-200 group-hover:scale-[1.03]"
        />
        <div className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/30 transition-colors duration-200 flex items-center justify-center">
          <div className="w-10 h-10 bg-[#e8c97a] rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all group-active:scale-90">
            <Play size={16} fill="currentColor" className="text-[#080808] ml-[2px]" />
          </div>
        </div>
        {/* Album badge */}
        <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-black/60 text-[#e8c97a] backdrop-blur-sm">
          {album.track_count} tracks
        </span>
      </div>
      <p
        className="text-xs md:text-sm font-medium truncate leading-tight text-[#f5f0e8]"
        style={{ fontFamily: "Syne, sans-serif" }}
      >
        {album.title}
      </p>
      <p className="text-[11px] md:text-xs text-[#605850] truncate mt-0.5">{album.artist}</p>
    </button>
  );
}

/** Loading skeleton for horizontal card rows */
function CardScrollSkeleton() {
  return (
    <div className="flex gap-4 -mx-4 md:mx-0 px-4 md:px-0">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex-shrink-0 w-32 md:w-40">
          <div className="w-32 h-32 md:w-40 md:h-40 rounded-xl bg-[#1a1a1a] animate-pulse mb-2.5" />
          <div className="h-3 w-3/4 bg-[#1a1a1a] rounded animate-pulse mb-1.5" />
          <div className="h-2.5 w-1/2 bg-[#1a1a1a] rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

/** Shown when a section fetch failed */
function SectionError() {
  return (
    <p className="text-xs text-[#3a3a3a] py-4 px-1">
      Couldn't load right now — make sure the server is running and refresh.
    </p>
  );
}

/** Shown when a section loaded successfully but returned no items */
function SectionEmpty({ message }: { message: string }) {
  return <p className="text-xs text-[#3a3a3a] py-4 px-1">{message}</p>;
}

// ── Tiny inline SVG icons ─────────────────────────────────────────────────────

function HeartIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

// Saved — gold filled heart.
function HeartFilledIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="#e8c97a" stroke="none">
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
