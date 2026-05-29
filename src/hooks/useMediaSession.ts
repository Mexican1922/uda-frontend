/**
 * useMediaSession
 * Registers the current song with the browser's Media Session API so that:
 *  - The OS lock screen shows artwork + title + artist
 *  - Hardware/Bluetooth media buttons (play, pause, next, prev) work
 *  - The OS doesn't pause audio when the screen locks
 *
 * Supported everywhere: Chrome (Android + desktop), Edge, Safari 15+, Firefox.
 */

import { useEffect } from "react";
import { usePlayerStore } from "../store/playerStore";

export function useMediaSession() {
  const {
    currentSong,
    isPlaying,
    togglePlay,
    nextSong,
    prevSong,
  } = usePlayerStore();

  // ── Update metadata when the song changes ─────────────────────────────────
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    if (!currentSong) {
      navigator.mediaSession.metadata = null;
      return;
    }

    navigator.mediaSession.metadata = new MediaMetadata({
      title:  currentSong.title,
      artist: currentSong.artist,
      album:  "Ụda",
      artwork: currentSong.thumbnail_url
        ? [
            { src: currentSong.thumbnail_url, sizes: "96x96",   type: "image/jpeg" },
            { src: currentSong.thumbnail_url, sizes: "128x128", type: "image/jpeg" },
            { src: currentSong.thumbnail_url, sizes: "256x256", type: "image/jpeg" },
            { src: currentSong.thumbnail_url, sizes: "512x512", type: "image/jpeg" },
          ]
        : [],
    });
  }, [currentSong?.youtube_id]);

  // ── Sync playback state (playing / paused) ────────────────────────────────
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }, [isPlaying]);

  // ── Register action handlers once ────────────────────────────────────────
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ["play",          () => { if (!usePlayerStore.getState().isPlaying) togglePlay(); }],
      ["pause",         () => { if (usePlayerStore.getState().isPlaying)  togglePlay(); }],
      ["nexttrack",     () => nextSong()],
      ["previoustrack", () => prevSong()],
      // seekbackward / seekforward optional but nice for headphone double-tap
      ["seekbackward",  () => {
        const { pendingSeek, currentTime, seekTo } = usePlayerStore.getState();
        seekTo(Math.max(0, (pendingSeek ?? currentTime) - 10));
      }],
      ["seekforward",   () => {
        const { pendingSeek, currentTime, duration, seekTo } = usePlayerStore.getState();
        seekTo(Math.min(duration ?? Infinity, (pendingSeek ?? currentTime) + 10));
      }],
    ];

    for (const [action, handler] of handlers) {
      try { navigator.mediaSession.setActionHandler(action, handler); }
      catch { /* browser doesn't support this action — skip */ }
    }

    return () => {
      for (const [action] of handlers) {
        try { navigator.mediaSession.setActionHandler(action, null); }
        catch {}
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // register once; handlers read store directly so no stale closures
}
