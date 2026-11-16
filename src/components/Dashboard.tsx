import React, { useState } from 'react';
import { 
  FolderLock, ShieldCheck, Users, AlertCircle, CheckCircle, 
  Calendar, Pill, Sparkles, Smile, Radio, Dumbbell, MessageSquareText, HelpCircle 
} from 'lucide-react';
import { Medication, Appointment } from '../types';

interface DashboardProps {
  medications: Medication[];
  appointments: Appointment[];
  onNavigate: (screen: string) => void;
  onTakeMed: (id: string) => void;
}

export default function Dashboard({ medications, appointments, onNavigate, onTakeMed }: DashboardProps) {
  const [wellStatus, setWellStatus] = useState<'none' | 'success' | 'alert'>('none');
  const [feedbackMessage, setFeedbackMessage] = useState('');

  // Find next medicine to take
  const nextMed = medications.find(m => !m.prisAujourdhui);
  // Find next appointment (today or upcoming)
  const nextApp = appointments[0];

  const handleJeVaisBien = () => {
    setWellStatus('success');
    setFeedbackMessage('Excellente nouvelle ! Liora a envoyé un message rassurant à vos proches de confiance.');
    setTimeout(() => {
      setWellStatus('none');
    }, 6000);
  };

  const handleBesoinAide = () => {
    setWellStatus('alert');
    setFeedbackMessage('Alerte initiée. Une notification d\'urgence a été envoyée immédiatement à Sophie et Jean-Marc.');
  };

  const handleCancelAide = () => {
    setWellStatus('none');
    setFeedbackMessage('');
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Quick Check-In Status Header */}
      <div className="bg-white rounded-[2rem] p-5 shadow-sm border border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-full -z-10 opacity-60"></div>
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Smile className="w-5 h-5 text-emerald-500" />
          <span>Comment allez-vous aujourd'hui ?</span>
        </h2>

        {wellStatus === 'none' ? (
          <div className="grid grid-cols-2 gap-3">
            <button
              id="je-vais-bien-btn"
              onClick={handleJeVaisBien}
              className="bg-emerald-50/50 hover:bg-emerald-50 border border-emerald-100 text-emerald-900 font-semibold py-4 px-3 rounded-2xl transition duration-150 flex flex-col items-center justify-center gap-2 cursor-pointer min-h-[80px] shadow-sm"
            >
              <div className="bg-emerald-500 text-white rounded-full p-2.5 shadow-sm">
                <CheckCircle className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold tracking-tight">Je vais bien</span>
            </button>

            <button
              id="urgence-aide-btn"
              onClick={handleBesoinAide}
              className="bg-rose-50/50 hover:bg-rose-50 border border-rose-100 text-rose-900 font-semibold py-4 px-3 rounded-2xl transition duration-150 flex flex-col items-center justify-center gap-2 cursor-pointer min-h-[80px] shadow-sm"
            >
              <div className="bg-rose-500 text-white rounded-full p-2.5 shadow-sm">
                <AlertCircle className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold tracking-tight">J'ai besoin d'aide</span>
            </button>
          </div>
        ) : wellStatus === 'success' ? (
          <div className="bg-emerald-50 border-2 border-emerald-200 p-5 rounded-2xl text-emerald-950">
            <div className="flex gap-3 items-start">
              <CheckCircle className="w-8 h-8 text-emerald-600 shrink-0" />
              <div>
                <strong className="text-lg font-extrabold block">Signal de sérénité envoyé</strong>
                <p className="text-base font-medium mt-1 leading-relaxed">{feedbackMessage}</p>
                <button 
                  onClick={() => setWellStatus('none')}
                  className="mt-3 text-sm font-bold underline text-emerald-800 hover:text-emerald-900 cursor-pointer"
                >
                  Masquer le message
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-rose-50 border-2 border-rose-200 p-5 rounded-2xl text-rose-950">
            <div className="flex gap-3 items-start">
              <AlertCircle className="w-8 h-8 text-rose-600 shrink-0" />
              <div>
                <strong className="text-lg font-extrabold block text-rose-800">Alerte Proches Envoyée</strong>
                <p className="text-base font-medium mt-1 leading-relaxed">{feedbackMessage}</p>
                <div className="mt-4 flex gap-4">
                  <a 
                    href="tel:112"
                    className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold px-5 py-2.5 rounded-xl shadow text-center inline-block cursor-pointer text-sm"
                  >
                    Appeler les Secours (112)
                  </a>
                  <button 
                    onClick={handleCancelAide}
                    className="bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-bold px-5 py-2.5 rounded-xl text-sm cursor-pointer"
                  >
                    Annuler l'alerte
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. THE 4 MANDATORY KEY MODULES */}
      <div className="space-y-3">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block px-1">
          Mes 4 Espaces de Sérénité
        </span>
        
        <div className="grid grid-cols-2 gap-3">
          
          {/* MODULE 1: Mes Documents */}
          <button
            id="nav-documents-btn"
            onClick={() => onNavigate('documents')}
            className="bg-white hover:bg-slate-50 border border-slate-100 p-4 rounded-3xl text-left transition shadow-sm cursor-pointer min-h-[120px] flex flex-col justify-between group"
          >
            <div className="bg-emerald-50 text-emerald-600 w-10 h-10 rounded-full flex items-center justify-center group-hover:scale-105 transition-transform">
              <FolderLock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-sm font-bold text-slate-800 block mt-3">Mes documents</span>
              <span className="text-[10px] font-medium text-slate-500 block mt-1 leading-tight">Coffre-fort de vie</span>
            </div>
          </button>

          {/* MODULE 2: Me Protéger */}
          <button
            id="nav-proteger-btn"
            onClick={() => onNavigate('proteger')}
            className="bg-white hover:bg-slate-50 border border-slate-100 p-4 rounded-3xl text-left transition shadow-sm cursor-pointer min-h-[120px] flex flex-col justify-between group"
          >
            <div className="bg-blue-50 text-blue-600 w-10 h-10 rounded-full flex items-center justify-center group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-sm font-bold text-slate-800 block mt-3">Me protéger</span>
              <span className="text-[10px] font-medium text-slate-500 block mt-1 leading-tight">Mots de passe</span>
            </div>
          </button>

          {/* MODULE 3: Mes Proches */}
          <button
            id="nav-proches-btn"
            onClick={() => onNavigate('proches')}
            className="bg-white hover:bg-slate-50 border border-slate-100 p-4 rounded-3xl text-left transition shadow-sm cursor-pointer min-h-[120px] flex flex-col justify-between group"
          >
            <div className="bg-indigo-50 text-indigo-600 w-10 h-10 rounded-full flex items-center justify-center group-hover:scale-105 transition-transform">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <span className="text-sm font-bold text-slate-800 block mt-3">Mes proches</span>
              <span className="text-[10px] font-medium text-slate-500 block mt-1 leading-tight">Communication</span>
            </div>
          </button>

          {/* MODULE 4: Urgence / Clé */}
          <button
            id="nav-urgence-btn"
            onClick={() => onNavigate('urgence')}
            className="bg-white hover:bg-slate-50 border border-slate-100 p-4 rounded-3xl text-left transition shadow-sm cursor-pointer min-h-[120px] flex flex-col justify-between group"
          >
            <div className="bg-rose-50 text-rose-600 w-10 h-10 rounded-full flex items-center justify-center group-hover:scale-105 transition-transform">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-sm font-bold text-slate-800 block mt-3">Urgence & Clé</span>
              <span className="text-[10px] font-medium text-slate-500 block mt-1 leading-tight">Accès d'urgence</span>
            </div>
          </button>

        </div>
      </div>

      {/* 3. TODAY'S OVERVIEW (APERCU DU JOUR) */}
      <div className="bg-white rounded-[2rem] p-5 shadow-sm border border-slate-100 space-y-4 relative overflow-hidden">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 relative z-10">
          <Calendar className="w-4 h-4 text-indigo-500" />
          <span>Aperçu de ma journée</span>
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 relative z-10">
          
          {/* Next Medication Reminder */}
          <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-2xl flex justify-between items-center shadow-sm">
            <div className="flex gap-3 items-center">
              <div className="bg-amber-100/50 text-amber-700 p-2.5 rounded-xl">
                <Pill className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Prochain médicament</span>
                <span className="text-sm font-bold text-slate-800 block">
                  {nextMed ? nextMed.nom : "Tous pris !"}
                </span>
                <span className="text-xs font-medium text-slate-500 block">
                  {nextMed ? `${nextMed.dosage} • ${nextMed.horaire}` : "Aucun rappel en attente"}
                </span>
              </div>
            </div>
            
            {nextMed && (
              <button
                onClick={() => onTakeMed(nextMed.id)}
                className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 font-bold text-[11px] px-3 py-2 rounded-xl transition min-h-[36px]"
              >
                Pris ✓
              </button>
            )}
          </div>

          {/* Next Appointment */}
          <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-2xl flex justify-between items-center shadow-sm">
            <div className="flex gap-3 items-center">
              <div className="bg-indigo-50 text-indigo-600 p-2.5 rounded-xl">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Prochain rendez-vous</span>
                <span className="text-sm font-bold text-slate-800 block truncate max-w-[150px]">
                  {nextApp ? nextApp.titre : "Aucun de prévu"}
                </span>
                <span className="text-xs font-medium text-slate-500 block">
                  {nextApp ? `${nextApp.heure} (Demain)` : "Profitez de votre journée"}
                </span>
              </div>
            </div>
            
            <button
              onClick={() => onNavigate('agenda')}
              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-[11px] px-3 py-2 rounded-xl cursor-pointer transition min-h-[36px]"
            >
              Voir
            </button>
          </div>

        </div>
      </div>

      {/* 4. WELL-BEING SUGGESTIONS (SUGGESTIONS BIEN-ÊTRE) */}
      <div className="bg-emerald-900 text-white rounded-[2rem] p-5 shadow-sm border border-emerald-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-700 rounded-full blur-3xl opacity-50 -mr-10 -mt-10 pointer-events-none"></div>
        <h3 className="text-sm font-bold tracking-tight flex items-center gap-2 mb-4 relative z-10">
          <Sparkles className="w-4 h-4 text-emerald-300" />
          <span>Suggestions pour votre bien-être</span>
        </h3>
        
        <div className="grid grid-cols-3 gap-3 relative z-10">
          
          <button
            onClick={() => onNavigate('sante-mentale')}
            className="bg-emerald-800/40 hover:bg-emerald-800/60 text-emerald-50 border border-emerald-700/50 p-3 rounded-2xl text-center flex flex-col items-center justify-center gap-2 transition cursor-pointer min-h-[85px] backdrop-blur-sm"
          >
            <Smile className="w-5 h-5 text-emerald-300" />
            <span className="text-[10px] font-medium tracking-wide">Respiration</span>
          </button>

          <button
            onClick={() => onNavigate('audio-radio')}
            className="bg-emerald-800/40 hover:bg-emerald-800/60 text-emerald-50 border border-emerald-700/50 p-3 rounded-2xl text-center flex flex-col items-center justify-center gap-2 transition cursor-pointer min-h-[85px] backdrop-blur-sm"
          >
            <Radio className="w-5 h-5 text-emerald-300" />
            <span className="text-[10px] font-medium tracking-wide">Radio</span>
          </button>

          <button
            onClick={() => onNavigate('physique-doux')}
            className="bg-emerald-800/40 hover:bg-emerald-800/60 text-emerald-50 border border-emerald-700/50 p-3 rounded-2xl text-center flex flex-col items-center justify-center gap-2 transition cursor-pointer min-h-[85px] backdrop-blur-sm"
          >
            <Dumbbell className="w-5 h-5 text-emerald-300" />
            <span className="text-[10px] font-medium tracking-wide">Gym douce</span>
          </button>

        </div>
      </div>

      {/* 5. LIORA ASSISTANT VOCAL RAPIDE */}
      <div className="bg-indigo-50 text-indigo-900 rounded-[2rem] p-4 shadow-sm border border-indigo-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-100 p-2.5 rounded-full text-indigo-600">
            <MessageSquareText className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-indigo-400 block uppercase tracking-wider">Assistant Vocal</span>
            <span className="text-sm font-bold tracking-tight block">Dites "Liora..."</span>
          </div>
        </div>
        <button
          onClick={() => onNavigate('assistant-vocal')}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs py-2 px-4 rounded-full shadow-sm cursor-pointer shrink-0 transition"
        >
          Parler
        </button>
      </div>

    </div>
  );
}
