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

  // ── Voice control ("Uda, next") ──
  voiceEnabled: boolean;       // user has switched it on
  voiceSupported: boolean;     // browser exposes SpeechRecognition
  voiceListening: boolean;     // mic is actively listening right now
  lastVoiceHeard: string | null;
  toggleVoice: () => void;
  setVoiceSupported: (v: boolean) => void;
  setVoiceListening: (v: boolean) => void;
  setLastVoiceHeard: (v: string | null) => void;

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

  // ── Endless radio ("never stop the music") ──
  // When a station is playing we remember the genre-mates we can roll on to.
  // When the queue runs dry we pull the next artist and keep playing instead
  // of stopping. PlayerBar registers the actual fetch via registerRadioRefill.
  endlessArtist: string | null;     // station seed (main artist)
  endlessPool: string[];            // genre-mate names still to roll onto
  endlessUsed: string[];            // names already pulled (no repeats)
  endlessBusy: boolean;             // a refill is in flight
  _radioRefill: ((artist: string) => Promise<Song[]>) | null;
  registerRadioRefill: (fn: (artist: string) => Promise<Song[]>) => void;
  _tryEndlessRefill: () => void;

  // Actions
  playSong: (song: Song, queue?: Song[]) => void;
  playQueue: (songs: Song[], startIndex?: number) => void;
  // Queue a station/mix WITHOUT interrupting what's playing: if nothing is
  // playing it starts; otherwise the songs are inserted right after the current
  // track (above the existing up-next) so the music never stops.
  queueMix: (songs: Song[], opts?: { endlessArtist?: string; endlessPool?: string[] }) => void;
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
  playNext: (song: Song) => void;
  removeFromQueue: (index: number) => void;
  jumpTo: (index: number) => void;
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

  endlessArtist: null,
  endlessPool: [],
  endlessUsed: [],
  endlessBusy: false,
  _radioRefill: null,
  registerRadioRefill: (fn) => set({ _radioRefill: fn }),

  toast: null,
  showToast: (msg) => {
    set({ toast: msg });
    setTimeout(() => set({ toast: null }), 3000);
  },
  clearToast: () => set({ toast: null }),

  // ── Voice control ──
  voiceEnabled: (() => {
    try { return localStorage.getItem("uda_voice") === "1"; } catch { return false; }
  })(),
  voiceSupported: false,
  voiceListening: false,
  lastVoiceHeard: null,
  toggleVoice: () =>
    set((s) => {
      const next = !s.voiceEnabled;
      try { localStorage.setItem("uda_voice", next ? "1" : "0"); } catch {}
      return { voiceEnabled: next };
    }),
  setVoiceSupported: (voiceSupported) => set({ voiceSupported }),
  setVoiceListening: (voiceListening) => set({ voiceListening }),
  setLastVoiceHeard: (lastVoiceHeard) => set({ lastVoiceHeard }),

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

  queueMix: (songs, opts) => {
    const { isRemote, _commandSink, queue, currentSong, currentIndex, showToast } = get();
    // De-dupe against what's already queued.
    const seen = new Set(queue.map((s) => s.youtube_id));
    const fresh = songs.filter((s) => {
      if (seen.has(s.youtube_id)) return false;
      seen.add(s.youtube_id);
      return true;
    });

    const endlessArtist = opts?.endlessArtist ?? null;
    const endlessPool = opts?.endlessPool ?? [];

    // Remote device owns audio — just hand it the station to play.
    if (isRemote && _commandSink) {
      if (fresh.length) _commandSink({ action: "playSong", song: fresh[0], queue: fresh });
      return;
    }

    // Nothing playing yet → start the station now.
    if (!currentSong) {
      if (!fresh.length) return;
      set({
        queue: fresh,
        currentIndex: 0,
        currentSong: fresh[0],
        isPlaying: true,
        progress: 0,
        currentTime: 0,
        pendingSeek: null,
        endlessArtist,
        endlessPool,
        endlessUsed: endlessArtist ? [endlessArtist] : [],
      });
      return;
    }

    if (!fresh.length) { showToast("Already in your queue"); return; }

    // Insert right after the current track — above the existing up-next — so
    // the current song keeps playing and the new mix flows straight after it.
    const next = [
      ...queue.slice(0, currentIndex + 1),
      ...fresh,
      ...queue.slice(currentIndex + 1),
    ];
    set({
      queue: next,
      // Adopt/refresh the station seed so "never stop" can roll on later.
      endlessArtist: endlessArtist ?? get().endlessArtist,
      endlessPool: endlessPool.length ? endlessPool : get().endlessPool,
      endlessUsed: endlessArtist ? [endlessArtist] : get().endlessUsed,
    });
    showToast(`Added ${fresh.length} songs — playing after this`);
  },

  // Queue ran dry on a station → pull another genre-mate and keep playing.
  _tryEndlessRefill: () => {
    const { endlessArtist, endlessPool, endlessUsed, endlessBusy, _radioRefill } = get();
    if (endlessBusy || !endlessArtist || !_radioRefill) return;
    // Next genre-mate we haven't pulled yet; fall back to the seed artist.
    const candidate = endlessPool.find((a) => !endlessUsed.includes(a)) || endlessArtist;
    set({ endlessBusy: true });
    _radioRefill(candidate)
      .then((songs) => {
        const cur = get();
        const have = new Set(cur.queue.map((s) => s.youtube_id));
        const add = (songs || []).filter((s) => !have.has(s.youtube_id));
        if (!add.length) return;
        const startAt = cur.queue.length;
        const newQueue = [...cur.queue, ...add];
        set({
          queue: newQueue,
          currentIndex: startAt,
          currentSong: newQueue[startAt],
          isPlaying: true,
          progress: 0,
          currentTime: 0,
          pendingSeek: null,
          endlessUsed: [...cur.endlessUsed, candidate],
        });
        get().showToast(`Radio rolling on — ${candidate}`);
      })
      .catch(() => {})
      .finally(() => set({ endlessBusy: false }));
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
      // End of queue — on an endless station, roll on to another artist
      // instead of stopping. Otherwise we're genuinely done.
      get()._tryEndlessRefill();
      return;
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
  addToQueue: (song) => {
    const { queue, showToast } = get();
    if (queue.some((s) => s.youtube_id === song.youtube_id)) {
      showToast("Already in queue");
      return;
    }
    set({ queue: [...queue, song] });
    showToast("Added to queue");
  },

  // Insert a song to play right after the current track.
  playNext: (song) => {
    const { queue, currentIndex, currentSong, showToast } = get();
    // Nothing playing yet — just start it.
    if (!currentSong) {
      set({ queue: [song], currentIndex: 0, currentSong: song, isPlaying: true, progress: 0, currentTime: 0, pendingSeek: null });
      return;
    }
    // Drop any existing copy so we don't duplicate, then splice in after current.
    const without = queue.filter((s) => s.youtube_id !== song.youtube_id);
    // currentIndex may shift if the removed copy was before it.
    let insertAt = without.findIndex((s) => s.youtube_id === currentSong.youtube_id);
    insertAt = insertAt >= 0 ? insertAt + 1 : currentIndex + 1;
    const next = [...without.slice(0, insertAt), song, ...without.slice(insertAt)];
    const newCurrentIndex = next.findIndex((s) => s.youtube_id === currentSong.youtube_id);
    set({ queue: next, currentIndex: newCurrentIndex >= 0 ? newCurrentIndex : currentIndex });
    showToast("Playing next");
  },

  // Remove a song from the queue by index (can't remove the current track).
  removeFromQueue: (index) => {
    const { queue, currentIndex } = get();
    if (index < 0 || index >= queue.length || index === currentIndex) return;
    const next = queue.filter((_, i) => i !== index);
    // Keep currentIndex pointing at the same song.
    const newIndex = index < currentIndex ? currentIndex - 1 : currentIndex;
    set({ queue: next, currentIndex: newIndex });
  },

  // Jump straight to a queue position (tap an up-next item).
  jumpTo: (index) => {
    const { queue, isRemote, _commandSink } = get();
    if (index < 0 || index >= queue.length) return;
    const song = queue[index];
    if (isRemote && _commandSink) {
      _commandSink({ action: "playSong", song, queue });
      return;
    }
    set({ currentIndex: index, currentSong: song, isPlaying: true, progress: 0, currentTime: 0, pendingSeek: null });
  },

  clearQueue: () =>
    set({
      queue: [], currentSong: null, isPlaying: false, currentIndex: 0,
      endlessArtist: null, endlessPool: [], endlessUsed: [],
    }),

  setNowPlayingOpen: (open) => set({ isNowPlayingOpen: open }),
  setAlbumArtBounds: (bounds) => set({ albumArtBounds: bounds }),
}));
