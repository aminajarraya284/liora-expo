import React, { useState } from 'react';
import { RADIOS } from '../data';
import { Radio, Play, Pause, Star, Volume2, History } from 'lucide-react';

export default function RadioAudio() {
  const [playingRadio, setPlayingRadio] = useState<any | null>(null);
  const [favorites, setFavorites] = useState<string[]>(['rad-1', 'rad-4']); // prefilled favs
  const [isPlaying, setIsPlaying] = useState(false);

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (favorites.includes(id)) {
      setFavorites(favorites.filter(f => f !== id));
    } else {
      setFavorites([...favorites, id]);
    }
  };

  const handlePlayRadio = (radio: any) => {
    if (playingRadio?.id === radio.id) {
      setIsPlaying(!isPlaying);
    } else {
      setPlayingRadio(radio);
      setIsPlaying(true);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/60 shadow-sm">
        <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <Radio className="w-6 h-6 text-indigo-600 animate-pulse" />
          <span>Radio & Contenus Audio</span>
        </h2>
        <p className="text-sm font-medium text-slate-500 mt-1">
          Écoutez vos émissions de radio et musiques préférées en un clic.
        </p>
      </div>

      {/* 2. ACTIVE MINI PLAYER DISPLAY */}
      {playingRadio && (
        <div className="bg-slate-900 text-white rounded-3xl p-5 border border-slate-800 shadow-md flex items-center justify-between gap-4 animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-3.5">
            <div className="bg-emerald-600 text-white p-3.5 rounded-2xl flex items-center justify-center animate-pulse">
              <Radio className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest block">Écoute en cours :</span>
              <strong className="text-lg font-black block leading-none mt-0.5">{playingRadio.name}</strong>
              <span className="text-xs text-slate-400 block mt-1">Diffusion nationale en direct</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isPlaying && (
              <div className="flex gap-1 items-end h-6 w-8 pb-1 shrink-0 justify-center">
                <span className="w-1 bg-emerald-400 h-4 rounded-full animate-bounce [animation-delay:0.1s]" />
                <span className="w-1 bg-emerald-400 h-6 rounded-full animate-bounce [animation-delay:0.3s]" />
                <span className="w-1 bg-emerald-400 h-3 rounded-full animate-bounce [animation-delay:0.5s]" />
              </div>
            )}

            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="bg-white text-slate-950 p-3 rounded-full shadow hover:scale-105 active:scale-95 transition cursor-pointer"
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-slate-950" /> : <Play className="w-5 h-5 fill-slate-950 ml-0.5" />}
            </button>
          </div>
        </div>
      )}

      {/* 3. RADIOS SELECTION GRID */}
      <div className="space-y-4">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block px-1">
          Toutes les Stations Disponibles
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {RADIOS.map((radio) => {
            const isFav = favorites.includes(radio.id);
            const isCurrent = playingRadio?.id === radio.id && isPlaying;

            return (
              <div
                key={radio.id}
                onClick={() => handlePlayRadio(radio)}
                className={`bg-white rounded-3xl p-4.5 border shadow-sm flex items-center justify-between gap-4 cursor-pointer transition ${
                  isCurrent ? 'border-emerald-500 bg-emerald-50/10' : 'border-slate-200 hover:border-indigo-500/20'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-2xl ${isCurrent ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-50 border border-slate-150 text-slate-500'}`}>
                    <Radio className="w-5 h-5" />
                  </div>
                  <div>
                    <strong className="text-slate-900 font-extrabold text-base block">{radio.name}</strong>
                    <span className="text-xs font-semibold text-slate-400 block mt-0.5">Fréquence nationale</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Star favorites button */}
                  <button
                    onClick={(e) => toggleFavorite(radio.id, e)}
                    className={`p-2 rounded-lg border cursor-pointer ${
                      isFav ? 'bg-amber-50 border-amber-200 text-amber-500' : 'bg-slate-50 border-slate-200 text-slate-400'
                    }`}
                  >
                    <Star className={`w-4.5 h-4.5 ${isFav ? 'fill-amber-500' : ''}`} />
                  </button>

                  <button className="bg-slate-100 hover:bg-slate-200 text-slate-800 p-2 rounded-lg">
                    {isCurrent ? <Pause className="w-4.5 h-4.5 fill-slate-800" /> : <Play className="w-4.5 h-4.5 fill-slate-800" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
