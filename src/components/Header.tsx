import React, { useState, useEffect } from 'react';
import { ShieldCheck, Calendar, Clock, Heart } from 'lucide-react';

interface HeaderProps {
  onGoHome: () => void;
  role: 'senior' | 'proche';
}

export default function Header({ onGoHome, role }: HeaderProps) {
  const [time, setTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  const todayStr = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <header className="bg-white border-b border-slate-200 px-4 py-3 shrink-0 z-10 sticky top-0">
      <div className="flex justify-between items-center">
        {/* Brand/Logo click leads home */}
        <button 
          onClick={onGoHome}
          id="liora-brand-btn"
          className="flex items-center gap-2 cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded p-1"
        >
          <div className="bg-emerald-50 p-2 rounded-xl shadow-sm border border-emerald-100 flex items-center justify-center">
            <Heart className="w-5 h-5 text-emerald-600 fill-emerald-600" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-slate-900 block">Liora</span>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest block mt-0.5">
              {role === 'senior' ? "Sérénité & Autonomie" : "Espace Proche"}
            </span>
          </div>
        </button>

        {/* Safety & Time Indicators */}
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full text-emerald-700 text-[10px] font-bold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span className="uppercase tracking-wider">Protection Active</span>
          </div>
          
          <div className="flex items-center gap-1.5 mt-1 text-slate-500 font-medium">
            <span className="text-xs capitalize">{todayStr}</span>
            <span className="text-[10px] text-slate-300">•</span>
            <span className="text-sm font-bold text-slate-800 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" /> {time}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
