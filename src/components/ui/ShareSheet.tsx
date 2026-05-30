import { useState } from "react";
import type { Song } from "../../types";

interface Props {
  song: Song;
  onClose: () => void;
  /** Optional lyric line to feature on the shareable card */
  lyricLine?: string;
}

// ── Shareable image card ──────────────────────────────────────────────────────

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) break;
    } else {
      line = test;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  // Ellipsis if we ran out of room
  if (lines.length === maxLines) {
    let last = lines[maxLines - 1];
    while (ctx.measureText(last + "…").width > maxWidth && last.length) last = last.slice(0, -1);
    if (text.length > lines.join(" ").length) lines[maxLines - 1] = last + "…";
  }
  return lines;
}

/**
 * Render a branded Ụda image card to a PNG Blob. Tries to include the artwork;
 * if the cross-origin thumbnail taints the canvas (export throws), it rebuilds
 * a gradient-only card so a share always succeeds.
 */
async function generateCardBlob(song: Song, gradient: [string, string], lyricLine?: string): Promise<Blob | null> {
  const W = 1080, H = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  try { await (document as Document & { fonts?: FontFaceSet }).fonts?.ready; } catch { /* fonts optional */ }

  let art: HTMLImageElement | null = null;
  try { if (song.thumbnail_url) art = await loadImage(song.thumbnail_url); } catch { art = null; }

  const draw = (withImage: boolean) => {
    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, gradient[0]);
    bg.addColorStop(1, gradient[1]);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    // Darken toward the bottom for text legibility
    const fade = ctx.createLinearGradient(0, H * 0.4, 0, H);
    fade.addColorStop(0, "rgba(8,8,8,0)");
    fade.addColorStop(1, "rgba(8,8,8,0.92)");
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, W, H);

    // Album art — centered rounded square
    const size = 560, ax = (W - size) / 2, ay = 150;
    ctx.save();
    roundRect(ctx, ax, ay, size, size, 40);
    ctx.clip();
    if (withImage && art) {
      // cover-fit
      const ar = art.width / art.height;
      let dw = size, dh = size, dx = ax, dy = ay;
      if (ar > 1) { dw = size * ar; dx = ax - (dw - size) / 2; }
      else { dh = size / ar; dy = ay - (dh - size) / 2; }
      ctx.drawImage(art, dx, dy, dw, dh);
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.10)";
      ctx.fillRect(ax, ay, size, size);
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "800 180px Syne, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(song.artist.slice(0, 2).toUpperCase(), W / 2, ay + size / 2);
    }
    ctx.restore();

    // Text block
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    let y = ay + size + 110;

    ctx.fillStyle = "#f5f0e8";
    ctx.font = "800 60px Syne, sans-serif";
    for (const line of wrapText(ctx, song.title, W - 160, 2)) {
      ctx.fillText(line, W / 2, y);
      y += 72;
    }

    ctx.fillStyle = "#e8c97a";
    ctx.font = "600 40px Syne, sans-serif";
    ctx.fillText(wrapText(ctx, song.artist, W - 200, 1)[0] || song.artist, W / 2, y + 6);
    y += 70;

    if (lyricLine) {
      ctx.fillStyle = "rgba(245,240,232,0.7)";
      ctx.font = "italic 34px Georgia, serif";
      for (const line of wrapText(ctx, `"${lyricLine}"`, W - 220, 2)) {
        ctx.fillText(line, W / 2, y);
        y += 46;
      }
    }

    // Ụda wordmark, bottom
    ctx.fillStyle = "#e8c97a";
    ctx.font = "800 38px Syne, sans-serif";
    ctx.fillText("Ụda", W / 2, H - 56);
  };

  draw(true);
  // Force a taint check; if the artwork tainted the canvas this throws.
  try {
    return await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
  } catch {
    draw(false);
    return await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
  }
}

const ACTIONS = [
  {
    id: "copy",
    label: "Copy link",
    sub: "uda.fm/track/…",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" />
        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
      </svg>
    ),
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    sub: "Send to a chat",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.47 14.38c-.3-.15-1.76-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.07-.3-.14-1.25-.46-2.38-1.47-.88-.78-1.47-1.74-1.64-2.04-.17-.3-.02-.46.13-.61.13-.13.3-.35.44-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.6-.91-2.19-.24-.57-.49-.5-.67-.5-.17 0-.37-.02-.57-.02a1.1 1.1 0 00-.8.37c-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.14.2 2.1 3.2 5.09 4.49.71.31 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35zm-5.47 7.45h-.01a9.87 9.87 0 01-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.38A9.86 9.86 0 012 12C2 6.48 6.48 2 12 2s10 4.48 10 10-4.48 10-10 10z" />
      </svg>
    ),
  },
  {
    id: "instagram",
    label: "Instagram Story",
    sub: "Post to your story",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    id: "twitter",
    label: "X (Twitter)",
    sub: "Tweet this track",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
] as const;

// Simple artist-name → gradient hash
function songGradient(seed: string): [string, string] {
  const pairs: [string, string][] = [
    ["#c9a84c", "#6b3a0f"], ["#1a7a4a", "#0a3020"], ["#7c3aed", "#3b0764"],
    ["#be123c", "#4c0519"], ["#0369a1", "#082f49"], ["#c2410c", "#431407"],
  ];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return pairs[h % pairs.length];
}

export default function ShareSheet({ song, onClose, lyricLine }: Props) {
  const [copied, setCopied] = useState(false);
  const [cardBusy, setCardBusy] = useState(false);

  const handleShareImage = async () => {
    if (cardBusy) return;
    setCardBusy(true);
    try {
      const blob = await generateCardBlob(song, songGradient(song.artist + song.title), lyricLine);
      if (!blob) return;
      const file = new File([blob], `uda-${song.youtube_id}.png`, { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      // Mobile: native share sheet → WhatsApp/IG Story directly.
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({
          files: [file],
          title: `${song.title} — ${song.artist}`,
          text: `${song.title} by ${song.artist} on Ụda 🎵`,
        });
      } else {
        // Desktop fallback: save the PNG so it can be uploaded anywhere.
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `uda-${song.title}.png`.replace(/[^\w.-]+/g, "_");
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      /* user cancelled the share sheet, or generation failed — no-op */
    } finally {
      setCardBusy(false);
    }
  };

  const handleAction = async (id: string) => {
    if (id === "copy") {
      const url = `https://uda.fm/track/${song.youtube_id}`;
      try { await navigator.clipboard.writeText(url); } catch {}
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else if (id === "whatsapp") {
      window.open(
        `https://wa.me/?text=${encodeURIComponent(`${song.title} by ${song.artist} — https://uda.fm/track/${song.youtube_id}`)}`,
        "_blank"
      );
    } else if (id === "twitter") {
      window.open(
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Listening to ${song.title} by ${song.artist} on Ụda 🎵`)}&url=${encodeURIComponent(`https://uda.fm/track/${song.youtube_id}`)}`,
        "_blank"
      );
    }
  };

  const [from, to] = songGradient(song.artist + song.title);

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[80] flex items-end bg-black/65 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Sheet */}
      <div
        className="w-full rounded-t-[24px] pb-8 animate-slide-up"
        style={{
          background: "#0f0f0f",
          border: "1px solid #1a1a1a",
          borderBottom: "none",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="w-10 h-1 bg-[#2a2a2a] rounded-full mx-auto mt-3 mb-5" />

        {/* Song preview card */}
        <div
          className="mx-5 mb-5 rounded-2xl p-3.5 flex items-center gap-3"
          style={{ background: "#111111", border: "1px solid #2a2a2a" }}
        >
          {/* Cover gradient */}
          <div
            className="w-14 h-14 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
          >
            {song.thumbnail_url ? (
              <img src={song.thumbnail_url} alt={song.title} className="w-full h-full object-cover" />
            ) : (
              <span
                className="font-extrabold text-white/80 text-lg"
                style={{ fontFamily: "Syne, sans-serif" }}
              >
                {song.artist.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-bold text-white truncate"
              style={{ fontFamily: "Syne, sans-serif" }}
            >
              {song.title}
            </p>
            <p className="text-xs text-[#605850] truncate mt-0.5">{song.artist}</p>
          </div>

          {/* Ụda card badge */}
          <div
            className="flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold text-[#080808]"
            style={{
              fontFamily: "Syne, sans-serif",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              background: "linear-gradient(135deg, #e8c97a, #c9a84c)",
            }}
          >
            Ụda
          </div>
        </div>

        {/* Primary: share as a branded image card */}
        <div className="px-3 mb-2.5">
          <button
            onClick={handleShareImage}
            disabled={cardBusy}
            className="w-full h-12 rounded-2xl flex items-center justify-center gap-2 text-sm font-bold text-[#080808] transition-all active:scale-[0.99] disabled:opacity-70"
            style={{
              fontFamily: "Syne, sans-serif",
              background: "linear-gradient(135deg, #e8c97a, #c9a84c)",
            }}
          >
            {cardBusy ? (
              <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
              </svg>
            )}
            {cardBusy ? "Creating card…" : "Share as image"}
          </button>
        </div>

        {/* Share action grid */}
        <div className="px-3 grid grid-cols-2 gap-2.5 mb-4">
          {ACTIONS.map((action) => {
            const isCopied = action.id === "copy" && copied;
            return (
              <button
                key={action.id}
                onClick={() => handleAction(action.id)}
                className="flex items-center gap-3 p-3.5 rounded-2xl text-left transition-all"
                style={{
                  background: isCopied ? "rgba(45,190,138,0.1)" : "#111111",
                  border: `1px solid ${isCopied ? "rgba(45,190,138,0.35)" : "#2a2a2a"}`,
                }}
              >
                {/* Icon container */}
                <div
                  className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center"
                  style={{ background: "#1a1a1a", color: isCopied ? "#2dbe8a" : "white" }}
                >
                  {isCopied ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2dbe8a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    action.icon
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p
                    className="text-sm font-semibold truncate"
                    style={{
                      fontFamily: "Syne, sans-serif",
                      color: isCopied ? "#2dbe8a" : "white",
                    }}
                  >
                    {isCopied ? "Copied!" : action.label}
                  </p>
                  <p className="text-[10.5px] text-[#605850] truncate mt-0.5">{action.sub}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Divider + cancel */}
        <div className="h-px bg-[#1a1a1a] mx-5 mb-3" />
        <div className="px-3">
          <button
            onClick={onClose}
            className="w-full h-12 rounded-xl text-sm font-semibold text-[#b8b0a0] transition-colors"
            style={{
              fontFamily: "Syne, sans-serif",
              background: "#111111",
              border: "1px solid #2a2a2a",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
