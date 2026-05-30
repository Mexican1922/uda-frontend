import { Outlet } from "react-router-dom";
import TopBar from "./TopBar";
import BottomNav from "./BottomNav";
import Sidebar from "./Sidebar";
import PlayerBar from "../player/PlayerBar";
import { usePlayerStore } from "../../store/playerStore";
import { useDeviceSync } from "../../hooks/useDeviceSync";

export default function AppLayout() {
  const currentSong = usePlayerStore((s) => s.currentSong);
  const toast       = usePlayerStore((s) => s.toast);

  // Cross-device playback sync (no-op until Supabase Realtime is configured).
  useDeviceSync();

  return (
    <div className="flex h-screen bg-[#080808] overflow-hidden">
      {/* Desktop sidebar — visible md+ only (Sidebar has hidden md:flex) */}
      <Sidebar />

      {/* Scrollable page content */}
      <main
        className={[
          "flex-1 min-w-0 overflow-y-auto",
          // Mobile: clear TopBar (56px) at top
          "pt-14 md:pt-0",
          // Bottom: clear BottomNav (64px) + optional PlayerBar (~70px) on mobile
          //         clear PlayerBar (96px) on desktop
          currentSong
            ? "pb-[138px] md:pb-24"
            : "pb-16 md:pb-0",
        ].join(" ")}
      >
        <Outlet />
      </main>

      {/* Fixed overlays — all use position:fixed so don't affect flex layout */}
      <TopBar />
      {currentSong && <PlayerBar />}
      <BottomNav />

      {/* Toast notification (e.g. "video unavailable, skipped") */}
      {toast && (
        <div
          style={{ left: "50%" }}
          className="fixed bottom-[150px] md:bottom-28 z-[100]
                     px-4 py-2.5 rounded-full text-sm font-medium text-[#f5f0e8]
                     bg-[#1a1a1a] border border-[#2a2a2a] shadow-xl whitespace-nowrap
                     animate-fade-in"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
