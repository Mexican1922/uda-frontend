import { useEffect, useRef } from "react";
import { usePlayerStore } from "../../store/playerStore";
import { useMediaSession } from "../../hooks/useMediaSession";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export default function YouTubePlayer() {
  const {
    currentSong, isPlaying, isVideoMode, volume, isMuted,
    pendingSeek, isNowPlayingOpen, albumArtBounds,
    setProgress, setCurrentTime, setDuration, nextSong, clearPendingSeek,
  } = usePlayerStore();

  // Register Media Session (lock screen controls, hardware media buttons)
  useMediaSession();

  const playerRef    = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const isReadyRef   = useRef(false);
  // Track the last seeked song so we don't double-seek on init
  const lastSongRef  = useRef<string | null>(null);

  // ── Load YouTube IFrame API once ─────────────────────────────────────────
  useEffect(() => {
    if (window.YT) return;
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  }, []);

  // ── Init / change song ───────────────────────────────────────────────────
  useEffect(() => {
    if (!currentSong) return;

    const initPlayer = () => {
      if (playerRef.current) {
        // Player already exists — just load the new video
        isReadyRef.current = false; // will be set true again once PLAYING fires
        playerRef.current.loadVideoById(currentSong.youtube_id);
        lastSongRef.current = currentSong.youtube_id;
        return;
      }

      playerRef.current = new window.YT.Player("uda-yt-player", {
        videoId: currentSong.youtube_id,
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          playsinline: 1,    // critical for iOS inline playback
        },
        events: {
          onReady: (e: any) => {
            isReadyRef.current = true;
            lastSongRef.current = currentSong.youtube_id;
            e.target.setVolume(isMuted ? 0 : volume);
            e.target.playVideo();
            setDuration(e.target.getDuration());
          },
          onStateChange: (e: any) => {
            const YTState = window.YT.PlayerState;
            // Read latest store values directly to avoid stale closures
            const { isPlaying: storePlaying, repeatMode: rm } = usePlayerStore.getState();

            if (e.data === YTState.PLAYING) {
              isReadyRef.current = true;
              setDuration(e.target.getDuration());
            }
            // CUED or UNSTARTED means a new video just loaded.
            // Force playVideo() if the store says we should be playing —
            // this is the key fix for "can't switch songs while another is playing".
            if (
              (e.data === YTState.CUED || e.data === YTState.UNSTARTED) &&
              storePlaying
            ) {
              e.target.playVideo();
            }
            if (e.data === YTState.ENDED) {
              if (rm === "one") {
                e.target.seekTo(0, true);
                e.target.playVideo();
              } else {
                nextSong();
              }
            }
          },
        },
      });
      lastSongRef.current = currentSong.youtube_id;
    };

    if (window.YT?.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSong?.youtube_id]);

  // ── Sync play / pause ────────────────────────────────────────────────────
  useEffect(() => {
    if (!playerRef.current || !isReadyRef.current) return;
    if (isPlaying) playerRef.current.playVideo();
    else playerRef.current.pauseVideo();
  }, [isPlaying]);

  // ── Sync volume ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!playerRef.current || !isReadyRef.current) return;
    playerRef.current.setVolume(isMuted ? 0 : volume);
  }, [volume, isMuted]);

  // ── Execute pending seek ─────────────────────────────────────────────────
  useEffect(() => {
    if (pendingSeek === null) return;
    if (!playerRef.current || !isReadyRef.current) return;
    playerRef.current.seekTo(pendingSeek, true);
    clearPendingSeek();
  }, [pendingSeek]);

  // ── Progress tracking interval ───────────────────────────────────────────
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!isPlaying) return;

    intervalRef.current = setInterval(() => {
      if (!playerRef.current || !isReadyRef.current) return;
      const current = playerRef.current.getCurrentTime?.() ?? 0;
      const total   = playerRef.current.getDuration?.()   ?? 0;
      setCurrentTime(current);
      setProgress(total > 0 ? (current / total) * 100 : 0);
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying]);

  // ── Compute position style ───────────────────────────────────────────────
  // When NowPlaying is open + video mode: cover the album art slot exactly.
  // Otherwise: show as a small PiP in the bottom-right (or hidden).
  const inAlbumSlot = isNowPlayingOpen && isVideoMode && albumArtBounds !== null;

  let containerStyle: React.CSSProperties = {};
  let containerClass = "";

  if (inAlbumSlot && albumArtBounds) {
    containerClass =
      "fixed z-[65] overflow-hidden shadow-2xl shadow-black/80";
    containerStyle = {
      top:    albumArtBounds.top,
      left:   albumArtBounds.left,
      width:  albumArtBounds.width,
      height: albumArtBounds.height,
      borderRadius: "1rem",         // matches rounded-2xl
      transition: "all 0.3s ease",
    };
  } else if (isVideoMode) {
    containerClass =
      "fixed z-40 bottom-[138px] md:bottom-24 right-4 md:right-6 " +
      "w-72 md:w-80 h-[160px] md:h-[180px] rounded-2xl overflow-hidden " +
      "shadow-2xl shadow-black/60 border border-[#2a2a2a] transition-all duration-500";
  } else {
    containerClass = "fixed w-0 h-0 opacity-0 pointer-events-none overflow-hidden";
  }

  return (
    <div className={containerClass} style={inAlbumSlot ? containerStyle : undefined}>
      <div id="uda-yt-player" ref={containerRef} className="w-full h-full" />
    </div>
  );
}
