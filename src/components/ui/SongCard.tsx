import { Play, Pause } from "lucide-react";
import { usePlayerStore } from "../../store/playerStore";
import type { Song } from "../../types";

interface Props {
  song: Song;
  queue: Song[];
  onPlay: (s: Song, q: Song[]) => void;
}

export default function SongCard({ song, queue, onPlay }: Props) {
  const { currentSong, isPlaying, togglePlay } = usePlayerStore();
  const isActive = currentSong?.youtube_id === song.youtube_id;

  const handleClick = () => {
    if (isActive) togglePlay();   // tap active card → pause / resume
    else onPlay(song, queue);     // tap new card → switch song
  };

  return (
    <div
      onClick={handleClick}
      className="flex-shrink-0 w-32 md:w-40 cursor-pointer group select-none"
    >
      <div className="relative mb-2.5">
        <img
          src={song.thumbnail_url}
          alt={song.title}
          className="w-32 h-32 md:w-40 md:h-40 rounded-xl object-cover transition-transform duration-200 group-hover:scale-[1.03]"
        />
        {isActive && <div className="absolute inset-0 bg-[#c9a84c]/20 rounded-xl" />}
        <div
          className={`absolute inset-0 rounded-xl flex items-center justify-center transition-opacity duration-200 ${
            isActive
              ? "opacity-100 bg-black/20"
              : "opacity-0 group-hover:opacity-100 bg-black/40"
          }`}
        >
          <div className="w-10 h-10 bg-[#e8c97a] rounded-full flex items-center justify-center shadow-lg">
            {isActive && isPlaying
              ? <Pause size={16} fill="currentColor" className="text-[#080808]" />
              : <Play size={16} fill="currentColor" className="text-[#080808] ml-[2px]" />
            }
          </div>
        </div>
      </div>
      <p
        className={`text-xs md:text-sm font-medium truncate leading-tight ${
          isActive ? "text-[#e8c97a]" : "text-[#f5f0e8]"
        }`}
        style={{ fontFamily: "Syne, sans-serif" }}
      >
        {song.title}
      </p>
      <p className="text-[11px] md:text-xs text-[#605850] truncate mt-0.5">{song.artist}</p>
    </div>
  );
}
