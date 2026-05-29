export interface User {
  id: number;
  email: string;
  username: string;
  display_name: string;
  avatar_url: string;
  bio: string;
  favourite_genres: string[];
  email_verified: boolean;
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

export interface AuthResponse {
  user: User;
  access: string;
  refresh: string;
}

export type RepeatMode = "off" | "one" | "all";
