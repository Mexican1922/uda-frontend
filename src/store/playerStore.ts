import { create } from "zustand";
import type { Song, RepeatMode, SyncDevice, SyncCommand, RemoteSnapshot } from "../types";
import { getDeviceInfo } from "../services/device";

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

  // Toast notification (e.g. "video unavailable, skipped")
  toast: string | null;
  showToast: (msg: string) => void;
  clearToast: () => void;

  // ── Cross-device sync ──
  syncDevices: SyncDevice[];        // all online devices for this user (incl. self)
  activeDeviceId: string | null;    // device currently playing audio (null = none claimed)
  isRemote: boolean;                // true when another device is active and we control it remotely
  // Internal sinks wired up by useDeviceSync — let store actions emit realtime events
  _commandSink: ((cmd: SyncCommand) => void) | null;
  _transferSink: (() => void) | null;
  _claimSink: ((deviceId: string) => void) | null;
  setSyncDevices: (devices: SyncDevice[]) => void;
  setSyncRole: (activeDeviceId: string | null, isRemote: boolean) => void;
  registerSyncSinks: (sinks: {
    command: (cmd: SyncCommand) => void;
    transfer: () => void;
    claim: (deviceId: string) => void;
  }) => void;
  clearSyncSinks: () => void;
  applyRemoteSnapshot: (snap: RemoteSnapshot) => void;  // remote applies broadcasted state
  listenHere: () => void;                               // transfer playback to this device
  transferTo: (deviceId: string) => void;               // move playback to another device

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

  toast: null,
  showToast: (msg) => {
    set({ toast: msg });
    setTimeout(() => set({ toast: null }), 3000);
  },
  clearToast: () => set({ toast: null }),

  // ── Cross-device sync ──
  syncDevices: [],
  activeDeviceId: null,
  isRemote: false,
  _commandSink: null,
  _transferSink: null,
  _claimSink: null,
  setSyncDevices: (syncDevices) => set({ syncDevices }),
  setSyncRole: (activeDeviceId, isRemote) => set({ activeDeviceId, isRemote }),
  registerSyncSinks: ({ command, transfer, claim }) =>
    set({ _commandSink: command, _transferSink: transfer, _claimSink: claim }),
  clearSyncSinks: () =>
    set({ _commandSink: null, _transferSink: null, _claimSink: null, isRemote: false, activeDeviceId: null, syncDevices: [] }),

  // A remote device applies the active device's broadcasted playback state.
  applyRemoteSnapshot: (snap) =>
    set({
      currentSong: snap.song,
      isPlaying: snap.isPlaying,
      currentTime: snap.currentTime,
      duration: snap.duration,
      progress: snap.duration > 0 ? (snap.currentTime / snap.duration) * 100 : 0,
      queue: snap.queue,
      currentIndex: snap.currentIndex,
      repeatMode: snap.repeatMode,
      isShuffled: snap.isShuffled,
      isVideoMode: snap.isVideoMode,
    }),

  // "Listen here" — claim active playback for this device.
  listenHere: () => {
    const { _transferSink } = get();
    _transferSink?.();
  },

  // Move playback to a specific (other) device.
  transferTo: (deviceId) => {
    const { _claimSink, listenHere } = get();
    if (deviceId === getDeviceInfo().id) { listenHere(); return; }
    _claimSink?.(deviceId);
  },

  playSong: (song, queue) => {
    const { isRemote, _commandSink } = get();
    if (isRemote && _commandSink) {
      // Audio lives on another device — tell it to play this song.
      _commandSink({ action: "playSong", song, queue });
      return;
    }
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

  togglePlay: () => {
    const { isRemote, _commandSink, isPlaying } = get();
    if (isRemote && _commandSink) {
      _commandSink({ action: isPlaying ? "pause" : "play" });
      return;
    }
    set({ isPlaying: !isPlaying });
  },

  nextSong: () => {
    const { queue, currentIndex, repeatMode, isShuffled, isRemote, _commandSink } = get();
    if (isRemote && _commandSink) {
      _commandSink({ action: "next" });
      return;
    }
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
    const { queue, currentIndex, currentTime, isRemote, _commandSink } = get();
    if (isRemote && _commandSink) {
      _commandSink({ action: "prev" });
      return;
    }
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
    const { duration, isRemote, _commandSink } = get();
    if (isRemote && _commandSink) {
      _commandSink({ action: "seek", seek: time });
      return;
    }
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
