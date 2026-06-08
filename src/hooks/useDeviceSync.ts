import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../services/supabase";
import { getDeviceInfo } from "../services/device";
import { useAuthStore } from "../store/authStore";
import { usePlayerStore } from "../store/playerStore";
import type { SyncDevice, SyncCommand, RemoteSnapshot } from "../types";

const HEARTBEAT_MS = 2000;

function buildSnapshot(): RemoteSnapshot {
  const s = usePlayerStore.getState();
  return {
    song: s.currentSong,
    isPlaying: s.isPlaying,
    currentTime: s.currentTime,
    duration: s.duration,
    queue: s.queue,
    currentIndex: s.currentIndex,
    repeatMode: s.repeatMode,
    isShuffled: s.isShuffled,
    isVideoMode: s.isVideoMode,
  };
}

// Signature of the fields that should trigger an *immediate* broadcast
// (currentTime is intentionally excluded — it rides the heartbeat).
function snapshotSignature(): string {
  const s = usePlayerStore.getState();
  return [
    s.currentSong?.youtube_id ?? "",
    s.isPlaying,
    s.currentIndex,
    s.isVideoMode,
    s.repeatMode,
    s.isShuffled,
  ].join("|");
}

/**
 * Cross-device playback sync over Supabase Realtime.
 *
 * - Presence tracks every online device for this user.
 * - Exactly one device is "active" (plays audio + broadcasts state); the rest
 *   are remotes that mirror the active device and send control commands.
 * - "Listen here" (listenHere) transfers active playback to the current device.
 *
 * No-ops gracefully if Supabase env vars or the user's sync_token are missing.
 */
export function useDeviceSync() {
  const syncToken = useAuthStore((s) => s.user?.sync_token);

  // Refs survive re-renders and avoid stale closures inside channel callbacks.
  const channelRef = useRef<RealtimeChannel | null>(null);
  const device = useRef(getDeviceInfo());
  const presenceRef = useRef<SyncDevice>({
    ...device.current,
    isActive: false,
    activatedAt: 0,
  });
  const roleRef = useRef<{ activeId: string | null; isRemote: boolean }>({
    activeId: null,
    isRemote: false,
  });
  const lastSigRef = useRef<string>("");

  useEffect(() => {
    if (!supabase || !syncToken) return;
    const myId = device.current.id;
    const channel = supabase.channel(`uda:sync:${syncToken}`, {
      config: { presence: { key: myId }, broadcast: { self: false } },
    });
    channelRef.current = channel;

    const claimActive = () => {
      presenceRef.current = {
        ...presenceRef.current,
        isActive: true,
        activatedAt: Date.now(),
      };
      channel.track(presenceRef.current);
    };

    const relinquish = () => {
      if (!presenceRef.current.isActive) return;
      presenceRef.current = { ...presenceRef.current, isActive: false };
      channel.track(presenceRef.current);
    };

    const broadcastSnapshot = () => {
      channel.send({
        type: "broadcast",
        event: "state",
        payload: buildSnapshot(),
      });
    };

    // Lightweight heartbeat: only the progress fields change second-to-second,
    // so we avoid re-sending the whole queue every 2s (Supabase bandwidth) — the
    // full snapshot still fires on real changes (song/queue/index) and on join.
    const broadcastTick = () => {
      const s = usePlayerStore.getState();
      channel.send({
        type: "broadcast",
        event: "tick",
        payload: { currentTime: s.currentTime, duration: s.duration, isPlaying: s.isPlaying },
      });
    };

    // ── Presence → resolve who is the active device ──────────────────────
    const recomputeRole = () => {
      const state = channel.presenceState<SyncDevice>();
      const devices: SyncDevice[] = Object.values(state).flatMap((metas) => metas as SyncDevice[]);

      const actives = devices.filter((d) => d.isActive);
      const winner = actives.length
        ? actives.reduce((a, b) => (b.activatedAt > a.activatedAt ? b : a))
        : null;
      const activeId = winner?.id ?? null;
      const isRemote = activeId !== null && activeId !== myId;

      roleRef.current = { activeId, isRemote };
      usePlayerStore.getState().setSyncDevices(devices);
      usePlayerStore.getState().setSyncRole(activeId, isRemote);

      // If someone else won but our presence still claims active, stand down.
      if (isRemote && presenceRef.current.isActive) relinquish();
    };

    // When a new device joins, the active device resends the full snapshot so
    // the newcomer gets the queue immediately (the heartbeat only carries
    // progress now, so we can't rely on it to deliver full state).
    const onJoin = () => {
      recomputeRole();
      if (roleRef.current.activeId === myId) broadcastSnapshot();
    };

    channel
      .on("presence", { event: "sync" }, recomputeRole)
      .on("presence", { event: "join" }, onJoin)
      .on("presence", { event: "leave" }, recomputeRole)
      // Remote receives the active device's full playback state.
      .on("broadcast", { event: "state" }, ({ payload }) => {
        if (roleRef.current.activeId === myId) return; // ignore if I'm active
        usePlayerStore.getState().applyRemoteSnapshot(payload as RemoteSnapshot);
      })
      // Remote receives lightweight progress ticks between full snapshots.
      .on("broadcast", { event: "tick" }, ({ payload }) => {
        if (roleRef.current.activeId === myId) return;
        const t = payload as { currentTime: number; duration: number; isPlaying: boolean };
        usePlayerStore.setState({
          currentTime: t.currentTime,
          duration: t.duration,
          isPlaying: t.isPlaying,
          progress: t.duration > 0 ? (t.currentTime / t.duration) * 100 : 0,
        });
      })
      // Active device receives control commands from a remote.
      .on("broadcast", { event: "command" }, ({ payload }) => {
        if (roleRef.current.activeId !== myId) return; // only the active device acts
        const cmd = payload as SyncCommand;
        const store = usePlayerStore.getState();
        switch (cmd.action) {
          case "play":  usePlayerStore.setState({ isPlaying: true }); break;
          case "pause": usePlayerStore.setState({ isPlaying: false }); break;
          case "next":  store.nextSong(); break;
          case "prev":  store.prevSong(); break;
          case "seek":  if (cmd.seek != null) store.seekTo(cmd.seek); break;
          case "playSong": if (cmd.song) store.playSong(cmd.song, cmd.queue); break;
        }
        broadcastSnapshot();
      })
      // A device explicitly took over playback.
      .on("broadcast", { event: "transfer" }, ({ payload }) => {
        const { activeId } = payload as { activeId: string };
        if (activeId !== myId && presenceRef.current.isActive) relinquish();
      })
      // Another device asked us to become the active player.
      .on("broadcast", { event: "claim" }, ({ payload }) => {
        const { targetId } = payload as { targetId: string };
        if (targetId === myId) becomeActive();
      });

    // Take over active playback on this device (used by Listen here + claim).
    const becomeActive = () => {
      claimActive();
      channel.send({
        type: "broadcast",
        event: "transfer",
        payload: { activeId: myId, activatedAt: presenceRef.current.activatedAt },
      });
      roleRef.current = { activeId: myId, isRemote: false };
      usePlayerStore.getState().setSyncRole(myId, false);
      usePlayerStore.setState({ isPlaying: true });
      broadcastSnapshot();
    };

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        // Announce ourselves (initially not the active device).
        channel.track(presenceRef.current);
      }
    });

    // ── Wire store → realtime sinks ──────────────────────────────────────
    usePlayerStore.getState().registerSyncSinks({
      command: (cmd) =>
        channel.send({ type: "broadcast", event: "command", payload: { ...cmd, from: myId } }),
      transfer: becomeActive,
      claim: (targetId) =>
        channel.send({ type: "broadcast", event: "claim", payload: { targetId } }),
    });

    // ── Auto-claim active when playback starts locally; broadcast on change ─
    const unsubscribeStore = usePlayerStore.subscribe((s) => {
      const playingHere = !s.isRemote && !!s.currentSong && s.isPlaying;
      // Claim active if we're playing locally and aren't already the active device.
      if (playingHere && roleRef.current.activeId !== myId && !presenceRef.current.isActive) {
        claimActive();
      }
      // If we're the active device, broadcast immediately on meaningful changes.
      if (roleRef.current.activeId === myId) {
        const sig = snapshotSignature();
        if (sig !== lastSigRef.current) {
          lastSigRef.current = sig;
          broadcastSnapshot();
        }
      }
    });

    // Heartbeat — carries only currentTime/progress to remotes while playing.
    const heartbeat = setInterval(() => {
      if (roleRef.current.activeId === myId && usePlayerStore.getState().isPlaying) {
        broadcastTick();
      }
    }, HEARTBEAT_MS);

    return () => {
      clearInterval(heartbeat);
      unsubscribeStore();
      usePlayerStore.getState().clearSyncSinks();
      channel.untrack();
      supabase!.removeChannel(channel);
      channelRef.current = null;
    };
  }, [syncToken]);
}
