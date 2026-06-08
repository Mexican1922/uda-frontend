import axios from "axios";

// In production the frontend calls the Render backend directly.
// In dev the Vite proxy rewrites /api → localhost:8001 (vite.config.ts).
const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : "/api";

const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("uda_access");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh token on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      const refresh = localStorage.getItem("uda_refresh");
      // Guests (and logged-out users) have no refresh token. Don't bounce them
      // to /login on a 401 — let the caller handle it gracefully (empty state).
      if (!refresh) return Promise.reject(error);
      original._retry = true;
      try {
        // Use the absolute backend BASE_URL — a relative path would resolve to
        // the frontend origin in production (Vercel) and 404, silently logging
        // the user out every time the 1-day access token expires.
        const { data } = await axios.post(`${BASE_URL}/auth/token/refresh/`, { refresh });
        localStorage.setItem("uda_access", data.access);
        original.headers.Authorization = `Bearer ${data.access}`;
        return api(original);
      } catch {
        localStorage.removeItem("uda_access");
        localStorage.removeItem("uda_refresh");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

// ── Auth ──────────────────────────────────────────────
export const authApi = {
  register: (data: { email: string; username: string; display_name: string; password: string; favourite_genres?: string[] }) =>
    api.post("/auth/register/", data),
  login: (data: { email: string; password: string }) =>
    api.post("/auth/login/", data),
  logout: (refresh: string) =>
    api.post("/auth/logout/", { refresh }),
  profile: () =>
    api.get("/auth/profile/"),
  updateProfile: (data: Partial<{ display_name: string; bio: string; favourite_genres: string[] }>) =>
    api.patch("/auth/profile/", data),
  // Email verification
  verifyEmail: (uid: string, token: string) =>
    api.get("/auth/verify-email/", { params: { uid, token } }),
  resendVerification: (email: string) =>
    api.post("/auth/resend-verification/", { email }),
  // Google OAuth
  googleAuth: (access_token: string) =>
    api.post("/auth/google/", { access_token }),
};

// ── Music ─────────────────────────────────────────────
export const musicApi = {
  search: (q: string, limit = 25) =>
    api.get("/music/search/", { params: { q, limit } }),
  trending: () =>
    api.get("/music/trending/"),
  mixes: () =>
    api.get("/music/mixes/"),
  albums: () =>
    api.get("/music/albums/"),
  album: (playlistId: string) =>
    api.get(`/music/album/${playlistId}/`),
  artist: (name: string) =>
    api.get("/music/artist/", { params: { name } }),
  artistAlbums: (name: string) =>
    api.get("/music/artist/albums/", { params: { name } }),
  artistRadio: (name: string) =>
    api.get("/music/artist/radio/", { params: { name } }),
};

// ── Library ───────────────────────────────────────────
export const libraryApi = {
  getSaved: () => api.get("/library/saved/"),
  saveSong: (song: { youtube_id: string; title: string; artist: string; thumbnail_url: string }) =>
    api.post("/library/saved/", song),
  unsaveSong: (youtube_id: string) =>
    api.delete(`/library/saved/${youtube_id}/`),

  // Favourite (followed) artists
  getFavouriteArtists: () => api.get("/library/favourite-artists/"),
  followArtist: (data: { name: string; thumbnail_url?: string }) =>
    api.post("/library/favourite-artists/", data),
  unfollowArtist: (name: string) =>
    api.delete(`/library/favourite-artists/${encodeURIComponent(name)}/`),

  getPlaylists: () => api.get("/library/playlists/"),
  // IDs of the user's playlists that already contain a song (one query) — lets
  // the add-to-playlist sheet show ticks without opening every playlist.
  playlistsContaining: (youtube_id: string) =>
    api.get("/library/playlists/containing/", { params: { youtube_id } }),
  createPlaylist: (data: { name: string; description?: string }) =>
    api.post("/library/playlists/", data),
  getPlaylist: (id: number) =>
    api.get(`/library/playlists/${id}/`),
  updatePlaylist: (id: number, data: Partial<{ name: string; description: string }>) =>
    api.patch(`/library/playlists/${id}/`, data),
  deletePlaylist: (id: number) =>
    api.delete(`/library/playlists/${id}/`),
  addTrack: (playlistId: number, song: { youtube_id: string; title: string; artist: string; thumbnail_url: string }) =>
    api.post(`/library/playlists/${playlistId}/tracks/`, song),
  removeTrack: (playlistId: number, youtube_id: string) =>
    api.delete(`/library/playlists/${playlistId}/tracks/${youtube_id}/`),
};

// ── History ───────────────────────────────────────────
export const historyApi = {
  getHistory: () => api.get("/history/"),
  logPlay: (data: { youtube_id: string; title: string; artist: string; thumbnail_url: string; completed: boolean; play_duration_seconds: number }) =>
    api.post("/history/", data),
};

// ── Integrations: Spotify ─────────────────────────────
export const spotifyApi = {
  status: () => api.get("/integrations/spotify/status/"),
  // Returns { url } to send the user to Spotify's consent screen.
  connect: () => api.get("/integrations/spotify/connect/"),
  importLibrary: () => api.post("/integrations/spotify/import/"),
  // Import a Spotify CSV export (Exportify/Soundiiz/TuneMyMusic) — no API/Premium
  // needed. Sent as JSON text so it rides the default content type.
  importCsv: (csv: string, playlist_name?: string) =>
    api.post("/integrations/spotify/import-csv/", { csv, playlist_name }),
  likedTracks: () => api.get("/integrations/spotify/tracks/"),
  playlists: () => api.get("/integrations/spotify/playlists/"),
  playlistTracks: (id: number) => api.get(`/integrations/spotify/playlists/${id}/`),
  // Lazily match one imported track to a YouTube video; returns a playable Song.
  resolve: (track_id: number) => api.post("/integrations/spotify/resolve/", { track_id }),
  disconnect: () => api.post("/integrations/spotify/disconnect/"),
};

// ── Recommendations ───────────────────────────────────
export const recommendationsApi = {
  get: (mood?: string) =>
    api.get("/recommendations/", { params: mood ? { mood } : {} }),
  nlSearch: (query: string) =>
    api.post("/recommendations/nl-search/", { query }),
  explainLyric: (data: { line: string; title?: string; artist?: string }) =>
    api.post("/recommendations/lyrics-explain/", data),
};

export default api;
