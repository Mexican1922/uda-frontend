export interface User {
  id: number;
  email: string;
  username: string;
  display_name: string;
  avatar_url: string;
  bio: string;
  favourite_genres: string[];
  email_verified: boolean;
  sync_token?: string;
  date_joined: string;
}

export interface Song {
  id?: number;
  youtube_id: string;
  title: string;
  artist: string;
  thumbnail_url: string;
  duration: string;
  duration_seconds: number;
  genre_tags: string[];
  energy_level: number;
  has_video: boolean;
}

export interface Album {
  playlist_id: string;
  title: string;
  artist: string;
  thumbnail_url: string;
  track_count: number;
}

export interface Playlist {
  id: number;
  name: string;
  description: string;
  cover_image_url: string;
  is_public: boolean;
  song_count: number;
  tracks?: PlaylistTrack[];
  created_at: string;
}

export interface PlaylistTrack {
  id: number;
  song: Song;
  position: number;
  added_at: string;
}

export interface SavedSong {
  id: number;
  song: Song;
  saved_at: string;
}

// ── Spotify import ───────────────────────────────────────────────────────────
export interface ImportedTrack {
  id: number;
  spotify_id: string;
  title: string;
  artist: string;
  album: string;
  image_url: string;
  source: "liked" | "playlist";
  youtube_id: string;          // "" until resolved
  status: "pending" | "matched" | "unavailable";
  added_at: string | null;
  position: number;
}

export interface ImportedPlaylist {
  id: number;
  spotify_id: string;
  name: string;
  image_url: string;
  track_count: number;
}

// A not-yet-resolved imported track queued for lazy YouTube matching on play.
export interface PendingImport {
  importedTrackId: number;
  title: string;
  artist: string;
  thumbnail_url: string;
}

export interface SpotifyStatus {
  connected: boolean;
  configured: boolean;
  liked_count?: number;
  playlist_count?: number;
  last_import_at?: string | null;
}

export interface AuthResponse {
  user: User;
  access: string;
  refresh: string;
}

export type RepeatMode = "off" | "one" | "all";

// ── Cross-device playback sync ───────────────────────────────────────────────
export type DeviceKind = "phone" | "tablet" | "desktop";

export interface SyncDevice {
  id: string;
  name: string;
  kind: DeviceKind;
  isActive: boolean;
  activatedAt: number; // ms epoch — used to resolve "who is active" (latest wins)
}

export type SyncCommandAction = "play" | "pause" | "next" | "prev" | "seek" | "playSong";

export interface SyncCommand {
  action: SyncCommandAction;
  seek?: number;
  song?: Song;
  queue?: Song[];
}

// Playback snapshot the active device broadcasts to its remotes.
export interface RemoteSnapshot {
  song: Song | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  queue: Song[];
  currentIndex: number;
  userQueue?: Song[];
  repeatMode: RepeatMode;
  isShuffled: boolean;
  isVideoMode: boolean;
}
