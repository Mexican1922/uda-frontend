import { useEffect, useRef, useState } from "react";
import { Smartphone, Tablet, Laptop, MonitorSpeaker, Check, X } from "lucide-react";
import { usePlayerStore } from "../../store/playerStore";
import { getDeviceInfo } from "../../services/device";
import { isRealtimeEnabled } from "../../services/supabase";
import type { DeviceKind, SyncDevice } from "../../types";

function KindIcon({ kind, size = 18 }: { kind: DeviceKind; size?: number }) {
  if (kind === "phone")  return <Smartphone size={size} />;
  if (kind === "tablet") return <Tablet size={size} />;
  return <Laptop size={size} />;
}

/** Animated three-bar equaliser shown next to the device currently playing. */
function PlayingBars() {
  return (
    <div className="flex items-end gap-[2px] h-3.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="uda-eq-bar w-[3px] bg-[#e8c97a] rounded-full"
          style={{ height: "100%", animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

export default function DevicePicker() {
  const { syncDevices, activeDeviceId, transferTo } = usePlayerStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const myId = getDeviceInfo().id;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Only meaningful once Realtime is configured and at least one device is present.
  if (!isRealtimeEnabled || syncDevices.length === 0) return null;

  const playingElsewhere = activeDeviceId !== null && activeDeviceId !== myId;
  // De-dupe by id (presence can briefly list the same key twice).
  const devices = Array.from(new Map(syncDevices.map((d) => [d.id, d])).values());

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Devices"
        className={`relative flex items-center justify-center transition-colors ${
          playingElsewhere ? "text-[#e8c97a]" : "text-[#3a3a3a] hover:text-[#b8b0a0]"
        }`}
      >
        <MonitorSpeaker size={18} />
        {playingElsewhere && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#e8c97a] ring-2 ring-[#0d0d0d]" />
        )}
      </button>

      {open && (
        <div
          className="absolute bottom-full right-0 mb-3 w-72 rounded-2xl overflow-hidden z-[80]
                     bg-[#141414] border border-[#2a2a2a] shadow-2xl shadow-black/60 animate-fade-in-up"
        >
          <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5 border-b border-[#1f1f1f]">
            <p className="text-sm font-bold text-[#f5f0e8]" style={{ fontFamily: "Syne, sans-serif" }}>
              Connect to a device
            </p>
            <button onClick={() => setOpen(false)} className="text-[#605850] hover:text-[#b8b0a0]">
              <X size={16} />
            </button>
          </div>

          <div className="py-1.5 max-h-72 overflow-y-auto">
            {devices.map((d: SyncDevice) => {
              const isActive = d.id === activeDeviceId;
              const isThis = d.id === myId;
              return (
                <button
                  key={d.id}
                  onClick={() => { transferTo(d.id); setOpen(false); }}
                  disabled={isActive}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    isActive ? "cursor-default" : "hover:bg-white/[0.04]"
                  }`}
                >
                  <span className={isActive ? "text-[#e8c97a]" : "text-[#605850]"}>
                    <KindIcon kind={d.kind} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${isActive ? "text-[#e8c97a] font-semibold" : "text-[#f5f0e8]"}`}>
                      {d.name}{isThis && <span className="text-[#605850] font-normal"> · This device</span>}
                    </p>
                    {isActive && <p className="text-[11px] text-[#605850]">Playing now</p>}
                  </div>
                  {isActive ? <PlayingBars /> : <Check size={16} className="text-transparent" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** Slim banner shown on a remote device: where audio is playing + a way to pull it here. */
export function DeviceBanner() {
  const { isRemote, activeDeviceId, syncDevices, listenHere } = usePlayerStore();
  if (!isRemote || !activeDeviceId) return null;

  const active = syncDevices.find((d) => d.id === activeDeviceId);
  const name = active?.name ?? "another device";

  return (
    <div className="flex items-center gap-2.5 px-4 py-1.5 bg-[#c9a84c] text-[#080808]">
      <MonitorSpeaker size={14} className="flex-shrink-0" />
      <p className="text-xs font-semibold flex-1 truncate" style={{ fontFamily: "Syne, sans-serif" }}>
        Playing on {name}
      </p>
      <button
        onClick={listenHere}
        className="text-xs font-bold underline underline-offset-2 hover:opacity-80 flex-shrink-0"
        style={{ fontFamily: "Syne, sans-serif" }}
      >
        Listen here
      </button>
    </div>
  );
}
