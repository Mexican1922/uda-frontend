/**
 * useVoiceControl
 * Hands-free playback control with a wake word: say "Uda, next" / "Uda pause" etc.
 *
 * Hard limitations (be honest with users in the UI):
 *  - Uses the Web Speech API (SpeechRecognition). Only Chromium browsers
 *    (Chrome / Edge, desktop + Android) support it. iOS Safari does NOT.
 *  - The mic only listens while the tab is OPEN and in the FOREGROUND. Mobile
 *    browsers suspend recognition when the screen locks or the app is
 *    backgrounded — so it can't be triggered with the phone in your pocket.
 *
 * Mount this once high in the tree (AppLayout). It watches store.voiceEnabled
 * and drives a continuous recognition session, mapping recognised commands to
 * the existing player actions.
 */

import { useEffect, useRef } from "react";
import { usePlayerStore } from "../store/playerStore";

// Wake-word variants — speech engines mishear "Uda" a lot, so accept near-misses.
const WAKE_WORDS = ["uda", "uder", "udah", "ouda", "yuda", "uta", "hooda", "huda", "buddha", "uba"];

type Command = "next" | "prev" | "pause" | "play" | null;

function parseCommand(transcript: string): Command {
  const t = transcript.toLowerCase();
  // Require the wake word somewhere in the phrase to avoid false triggers.
  if (!WAKE_WORDS.some((w) => t.includes(w))) return null;
  if (/\b(next|skip|forward)\b/.test(t)) return "next";
  if (/\b(previous|prev|back|last)\b/.test(t)) return "prev";
  if (/\b(pause|stop|hold)\b/.test(t)) return "pause";
  if (/\b(play|resume|continue|go)\b/.test(t)) return "play";
  return null;
}

export function useVoiceControl() {
  const voiceEnabled = usePlayerStore((s) => s.voiceEnabled);

  const recognitionRef = useRef<any>(null);
  const wantRunningRef = useRef(false);

  // Detect support once.
  useEffect(() => {
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    usePlayerStore.getState().setVoiceSupported(!!SR);
  }, []);

  useEffect(() => {
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const store = usePlayerStore.getState;

    if (!SR || !voiceEnabled) {
      // Tear down any running session.
      wantRunningRef.current = false;
      try { recognitionRef.current?.stop(); } catch {}
      recognitionRef.current = null;
      store().setVoiceListening(false);
      return;
    }

    wantRunningRef.current = true;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = "en-US";
    recognitionRef.current = rec;

    const act = (cmd: Command) => {
      const s = store();
      if (cmd === "next") s.nextSong();
      else if (cmd === "prev") s.prevSong();
      else if (cmd === "pause") { if (s.isPlaying) s.togglePlay(); }
      else if (cmd === "play") { if (!s.isPlaying) s.togglePlay(); }
    };

    rec.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (!res.isFinal) continue;
        const transcript = res[0]?.transcript ?? "";
        const cmd = parseCommand(transcript);
        if (cmd) {
          store().setLastVoiceHeard(transcript.trim());
          act(cmd);
          const labels: Record<string, string> = {
            next: "Voice: next track",
            prev: "Voice: previous track",
            pause: "Voice: paused",
            play: "Voice: playing",
          };
          store().showToast(labels[cmd]);
        }
      }
    };

    rec.onstart = () => store().setVoiceListening(true);
    rec.onend = () => {
      store().setVoiceListening(false);
      // Auto-restart while still enabled + page visible (recognition stops itself
      // periodically). Don't hammer it when the tab is hidden.
      if (wantRunningRef.current && document.visibilityState === "visible") {
        try { rec.start(); } catch {}
      }
    };
    rec.onerror = (e: any) => {
      // "not-allowed" = mic permission denied → give up and flip the switch off.
      if (e?.error === "not-allowed" || e?.error === "service-not-allowed") {
        wantRunningRef.current = false;
        store().setVoiceListening(false);
        if (store().voiceEnabled) store().toggleVoice();
        store().showToast("Mic permission denied");
      }
    };

    const start = () => { try { rec.start(); } catch {} };
    start();

    // Pause/resume with tab visibility to save battery + respect the OS.
    const onVisibility = () => {
      if (!wantRunningRef.current) return;
      if (document.visibilityState === "visible") start();
      else { try { rec.stop(); } catch {} }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      wantRunningRef.current = false;
      document.removeEventListener("visibilitychange", onVisibility);
      try { rec.stop(); } catch {}
      recognitionRef.current = null;
      store().setVoiceListening(false);
    };
  }, [voiceEnabled]);
}
