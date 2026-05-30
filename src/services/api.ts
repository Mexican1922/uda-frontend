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
      original._retry = true;
      try {
        const refresh = localStorage.getItem("uda_refresh");
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
  albums: () =>
    api.get("/music/albums/"),
  artist: (name: string) =>
    api.get("/music/artist/", { params: { name } }),
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

  getPlaylists: () => api.get("/library/playlists/"),
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

// ── Recommendations ───────────────────────────────────
export const recommendationsApi = {
  get: (mood?: string) =>
    api.get("/recommendations/", { params: mood ? { mood } : {} }),
  nlSearch: (query: string) =>
    api.post("/recommendations/nl-search/", { query }),
};

export default api;
