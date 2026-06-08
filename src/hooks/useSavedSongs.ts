import { useCallback, useEffect, useState } from "react";
import { libraryApi } from "../services/api";
import { useAuthStore } from "../store/authStore";
import { usePlayerStore } from "../store/playerStore";
import { clientCache, TTL } from "../services/cache";
import type { Song, SavedSong } from "../types";

const CACHE_KEY = "saved_ids";

/**
 * Tracks which songs the user has saved and exposes a toggle that saves/unsaves
 * with optimistic UI + toast feedback. Used by Search and Home so the heart
 * reflects real state and every tap confirms what happened (the old handlers
 * showed nothing on success and swallowed failures silently).
 */
export function useSavedSongs() {
  const isGuest = useAuthStore((s) => s.isGuest);
  const showToast = usePlayerStore((s) => s.showToast);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isGuest) return;
    const cached = clientCache.get<string[]>(CACHE_KEY);
    if (cached) { setSavedIds(new Set(cached)); return; }
    libraryApi
      .getSaved()
      .then(({ data }) => {
        const ids = (data as SavedSong[]).map((s) => s.song.youtube_id);
        clientCache.set(CACHE_KEY, ids, TTL.MEDIUM);
        setSavedIds(new Set(ids));
      })
      .catch(() => {});
  }, [isGuest]);

  const apply = (mutate: (set: Set<string>) => void) =>
    setSavedIds((prev) => {
      const next = new Set(prev);
      mutate(next);
      clientCache.set(CACHE_KEY, [...next], TTL.MEDIUM);
      return next;
    });

  const toggleSave = useCallback(
    async (song: Song) => {
      if (isGuest) { showToast("Sign in to save songs"); return; }
      const wasSaved = savedIds.has(song.youtube_id);
      // Optimistic flip.
      apply((s) => { wasSaved ? s.delete(song.youtube_id) : s.add(song.youtube_id); });
      try {
        if (wasSaved) {
          await libraryApi.unsaveSong(song.youtube_id);
          showToast("Removed from library");
        } else {
          await libraryApi.saveSong({
            youtube_id: song.youtube_id,
            title: song.title,
            artist: song.artist,
            thumbnail_url: song.thumbnail_url,
          });
          showToast("Saved to library");
        }
      } catch {
        // Revert on failure.
        apply((s) => { wasSaved ? s.add(song.youtube_id) : s.delete(song.youtube_id); });
        showToast("Couldn't update library — try again");
      }
    },
    [isGuest, savedIds, showToast],
  );

  return { savedIds, toggleSave };
}
