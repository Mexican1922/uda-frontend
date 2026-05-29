import { create } from "zustand";
import type { Song, RepeatMode } from "../types";

interface AlbumArtBounds {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface PlayerState {
  // Queue
  queue: Song[];
  currentIndex: number;
  currentSong: Song | null;

  // Playback state
  isPlaying: boolean;
  isVideoMode: boolean;
  volume: number;
  isMuted: boolean;
  progress: number;        // 0-100
  duration: number;        // seconds
  currentTime: number;     // seconds

  // Pending seek — YouTubePlayer watches this and calls player.seekTo()
  pendingSeek: number | null;

  // NowPlaying overlay open/closed + album art position for video slot
  isNowPlayingOpen: boolean;
  albumArtBounds: AlbumArtBounds | null;

  // Modes
  repeatMode: RepeatMode;
  isShuffled: boolean;

  // Actions
  playSong: (song: Song, queue?: Song[]) => void;
  playQueue: (songs: Song[], startIndex?: number) => void;
  togglePlay: () => void;
  nextSong: () => void;
  prevSong: () => void;
  seekTo: (time: number) => void;
  clearPendingSeek: () => void;
  setProgress: (progress: number) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleVideoMode: () => void;
  toggleRepeat: () => void;
  toggleShuffle: () => void;
  addToQueue: (song: Song) => void;
  clearQueue: () => void;
  setNowPlayingOpen: (open: boolean) => void;
  setAlbumArtBounds: (bounds: AlbumArtBounds | null) => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  queue: [],
  currentIndex: 0,
  currentSong: null,
  isPlaying: false,
  isVideoMode: false,
  volume: 80,
  isMuted: false,
  progress: 0,
  duration: 0,
  currentTime: 0,
  pendingSeek: null,
  isNowPlayingOpen: false,
  albumArtBounds: null,
  repeatMode: "off",
  isShuffled: false,

  playSong: (song, queue) => {
    const newQueue = queue || [song];
    const index = newQueue.findIndex((s) => s.youtube_id === song.youtube_id);
    set({
      currentSong: song,
      queue: newQueue,
      currentIndex: index >= 0 ? index : 0,
      isPlaying: true,
      progress: 0,
      currentTime: 0,
      pendingSeek: null,
    });
  },

  playQueue: (songs, startIndex = 0) => {
    set({
      queue: songs,
      currentIndex: startIndex,
      currentSong: songs[startIndex],
      isPlaying: true,
      progress: 0,
      currentTime: 0,
      pendingSeek: null,
    });
  },

  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),

  nextSong: () => {
    const { queue, currentIndex, repeatMode, isShuffled } = get();
    if (!queue.length) return;

    let next: number;
    if (isShuffled) {
      // Avoid repeating the same song when queue has more than 1 item
      let candidate = Math.floor(Math.random() * queue.length);
      if (queue.length > 1 && candidate === currentIndex) {
        candidate = (candidate + 1) % queue.length;
      }
      next = candidate;
    } else if (currentIndex < queue.length - 1) {
      next = currentIndex + 1;
    } else if (repeatMode === "all") {
      next = 0;
    } else {
      return; // End of queue
    }

    set({
      currentIndex: next,
      currentSong: queue[next],
      isPlaying: true,
      progress: 0,
      currentTime: 0,
      pendingSeek: null,
    });
  },

  prevSong: () => {
    const { queue, currentIndex, currentTime } = get();
    // If more than 3 seconds in — restart current song via seekTo
    if (currentTime > 3) {
      set({ progress: 0, currentTime: 0, pendingSeek: 0 });
      return;
    }
    if (currentIndex > 0) {
      const prev = currentIndex - 1;
      set({
        currentIndex: prev,
        currentSong: queue[prev],
        isPlaying: true,
        progress: 0,
        currentTime: 0,
        pendingSeek: null,
      });
    }
  },

  // seekTo: updates store AND queues a YouTube player seek
  seekTo: (time: number) => {
    const { duration } = get();
    set({
      currentTime: time,
      progress: duration > 0 ? (time / duration) * 100 : 0,
      pendingSeek: time,
    });
  },

  clearPendingSeek: () => set({ pendingSeek: null }),

  setProgress: (progress) => set({ progress }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setDuration: (duration) => set({ duration }),
  setVolume: (volume) => set({ volume, isMuted: volume === 0 }),
  toggleMute: () => set((s) => ({ isMuted: !s.isMuted })),
  toggleVideoMode: () => set((s) => ({ isVideoMode: !s.isVideoMode })),
  toggleRepeat: () =>
    set((s) => ({
      repeatMode:
        s.repeatMode === "off" ? "all" : s.repeatMode === "all" ? "one" : "off",
    })),
  toggleShuffle: () => set((s) => ({ isShuffled: !s.isShuffled })),
  addToQueue: (song) => set((s) => ({ queue: [...s.queue, song] })),
  clearQueue: () =>
    set({ queue: [], currentSong: null, isPlaying: false, currentIndex: 0 }),

  setNowPlayingOpen: (open) => set({ isNowPlayingOpen: open }),
  setAlbumArtBounds: (bounds) => set({ albumArtBounds: bounds }),
}));
