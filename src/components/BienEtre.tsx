import React, { useState, useEffect } from 'react';
import { JournalEntry } from '../types';
import { Smile, Sparkles, Check, RefreshCw, Eye, History, User, Camera, ShieldCheck, Heart, Trash2, X } from 'lucide-react';

interface BienEtreProps {
  journal: JournalEntry[];
  onAddJournal: (entry: JournalEntry) => void;
}

export default function BienEtre({ journal, onAddJournal }: BienEtreProps) {
  const [selectedMood, setSelectedMood] = useState<'excellent' | 'bien' | 'moyen' | 'triste' | null>(null);
  const [noteText, setNoteText] = useState('');
  
  // Guided Breathing States
  const [breathingActive, setBreathingActive] = useState(false);
  const [breathingPhase, setBreathingPhase] = useState<'inspire' | 'bloque' | 'expire'>('inspire');
  const [breathCount, setBreathCount] = useState(0);

  // Camera consent simulation
  const [cameraConsent, setCameraConsent] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);

  // Breathing simulation loop
  useEffect(() => {
    if (!breathingActive) return;

    let timer: any;
    const runBreathingCycle = () => {
      // 4s Inspire -> 4s Bloque -> 4s Expire
      setBreathingPhase('inspire');
      timer = setTimeout(() => {
        setBreathingPhase('bloque');
        timer = setTimeout(() => {
          setBreathingPhase('expire');
          timer = setTimeout(() => {
            setBreathCount((prev) => prev + 1);
            runBreathingCycle();
          }, 4000);
        }, 4000);
      }, 4000);
    };

    runBreathingCycle();

    return () => clearTimeout(timer);
  }, [breathingActive]);

  const handleSaveJournal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMood) {
      alert("Veuillez d'abord sélectionner votre humeur d'aujourd'hui !");
      return;
    }

    onAddJournal({
      id: `j-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      humeur: selectedMood,
      note: noteText || "Aujourd'hui, tout se passe pour le mieux."
    });

    setNoteText('');
    setSelectedMood(null);
    alert("Votre humeur et vos notes bien-être du jour ont été enregistrées avec succès !");
  };

  const getMoodEmoji = (mood: string) => {
    switch (mood) {
      case 'excellent': return '🤩';
      case 'bien': return '😊';
      case 'moyen': return '😐';
      default: return '😔';
    }
  };

  const getMoodColor = (mood: string) => {
    switch (mood) {
      case 'excellent': return 'bg-emerald-100 border-emerald-300 text-emerald-800';
      case 'bien': return 'bg-teal-50 border-teal-200 text-teal-800';
      case 'moyen': return 'bg-amber-50 border-amber-200 text-amber-800';
      default: return 'bg-rose-50 border-rose-200 text-rose-800';
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Header */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/60 shadow-sm">
        <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <Heart className="w-6 h-6 text-emerald-600 fill-emerald-600" />
          <span>Mon Bien-être Mental</span>
        </h2>
        <p className="text-sm font-medium text-slate-500 mt-1">
          Détendez-vous, respirez et notez vos plus belles pensées.
        </p>
      </div>

      {/* 2. BREATHING GUIDED EXERCISE (COEUR BIEN-ÊTRE) */}
      <div className="bg-emerald-900 text-white p-6 rounded-3xl border border-emerald-800 shadow-md space-y-5 text-center">
        <div className="flex justify-between items-center border-b border-emerald-800 pb-3">
          <span className="text-xs font-black uppercase tracking-widest text-emerald-300">
            Exercice de Respiration Guidée
          </span>
          <span className="bg-emerald-800 text-emerald-200 text-xs font-bold px-2.5 py-0.5 rounded-full">
            Pratique Douce (4-4-4)
          </span>
        </div>

        {!breathingActive ? (
          <div className="space-y-4 py-3">
            <p className="text-base text-emerald-100 max-w-sm mx-auto font-semibold leading-relaxed">
              Prenez 2 minutes de calme pour libérer vos tensions et retrouver votre sérénité.
            </p>
            
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setBreathingActive(true)}
                className="bg-white hover:bg-slate-150 text-emerald-950 font-black px-6 py-3.5 rounded-xl shadow cursor-pointer text-base"
              >
                Démarrer la séance
              </button>
              
              <button
                onClick={() => setShowConsentModal(true)}
                className="bg-emerald-800 hover:bg-emerald-700 text-emerald-200 font-bold px-4 py-3.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer border border-emerald-700"
              >
                <Camera className="w-4 h-4" />
                <span>Option Caméra</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 py-4 flex flex-col items-center">
            {/* BREATH BALLOON ANIMATED CIRCLE */}
            <div className="relative flex items-center justify-center">
              {/* Pulsing expand/shrink balloon circle */}
              <div 
                className={`rounded-full bg-emerald-500/30 border-2 border-emerald-400 flex items-center justify-center transition-all duration-[4000ms] ${
                  breathingPhase === 'inspire' ? 'w-48 h-48 scale-110' :
                  breathingPhase === 'bloque' ? 'w-48 h-48 scale-110 rotate-180 bg-emerald-500/50' :
                  'w-28 h-28 scale-90'
                }`}
              >
                <div className="bg-white/95 text-emerald-950 font-extrabold text-sm py-2.5 px-3.5 rounded-full shadow border border-emerald-100">
                  {breathingPhase === 'inspire' && "🌬️ INSPIRER"}
                  {breathingPhase === 'bloque' && "✋ BLOQUER"}
                  {breathingPhase === 'expire' && "😮 EXPIRER"}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-emerald-200 text-sm font-bold">Cycle respiratoire n° {breathCount}</p>
              <p className="text-xs text-emerald-300 font-semibold max-w-xs mx-auto">
                {breathingPhase === 'inspire' && "Gonflez votre ventre d'air doucement..."}
                {breathingPhase === 'bloque' && "Retenez l'air sans forcer..."}
                {breathingPhase === 'expire' && "Soufflez par la bouche longuement..."}
              </p>
            </div>

            <button
              onClick={() => {
                setBreathingActive(false);
                setBreathCount(0);
              }}
              className="bg-emerald-850 hover:bg-emerald-800 text-white font-bold py-2 px-5 rounded-xl text-xs cursor-pointer border border-emerald-700"
            >
              Arrêter l'exercice
            </button>
          </div>
        )}

        {/* Respiratory rate camera check simulator */}
        {cameraConsent && (
          <div className="bg-emerald-850/80 border border-emerald-700/50 p-3.5 rounded-2xl text-emerald-200 text-xs font-semibold flex items-center justify-between max-w-sm mx-auto">
            <span className="flex items-center gap-1.5 text-emerald-300">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span>Analyse optique de la cage thoracique active</span>
            </span>
            <span className="bg-emerald-900 px-2 py-0.5 rounded font-mono font-bold text-white text-xs">
              14 rpm
            </span>
          </div>
        )}
      </div>

      {/* 3. DAILY MOOD TRACKER & JOURNAL */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/60 shadow-sm space-y-4">
        <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
          <Smile className="w-5 h-5 text-emerald-600" />
          <span>Mon Journal Intime du jour</span>
        </h3>

        <form onSubmit={handleSaveJournal} className="space-y-4">
          
          {/* Emojis selection */}
          <div>
            <label className="text-sm font-bold text-slate-700 block mb-2">
              Comment vous sentez-vous aujourd'hui ?
            </label>
            
            <div className="grid grid-cols-4 gap-2">
              {[
                { val: 'excellent', emoji: '🤩', label: 'Super !' },
                { val: 'bien', emoji: '😊', label: 'Bien' },
                { val: 'moyen', emoji: '😐', label: 'Moyen' },
                { val: 'triste', emoji: '😔', label: 'Triste' }
              ].map((item) => (
                <button
                  key={item.val}
                  type="button"
                  onClick={() => setSelectedMood(item.val as any)}
                  className={`p-3.5 rounded-2xl border transition flex flex-col items-center gap-1 cursor-pointer ${
                    selectedMood === item.val
                      ? 'bg-emerald-600 border-emerald-600 text-white shadow-md'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="text-3xl">{item.emoji}</span>
                  <span className="text-xs font-extrabold leading-none">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-bold text-slate-700 block mb-1">
              Notez vos pensées ou vos gratitudes (optionnel) :
            </label>
            <textarea
              placeholder="Ex: J'ai fait une superbe promenade ce matin au soleil. J'ai aussi eu un appel de Julie..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="w-full border border-slate-300 rounded-2xl px-4 py-3 font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm leading-relaxed"
              rows={3}
            />
          </div>

          <button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3.5 rounded-xl shadow cursor-pointer text-sm"
          >
            Enregistrer dans mon journal
          </button>
        </form>
      </div>

      {/* 4. HISTORIC LOG OF WELLNESS JOURNAL */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/60 shadow-sm space-y-3">
        <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
          <History className="w-5 h-5 text-indigo-500" />
          <span>Mes souvenirs et notes d'humeur passées</span>
        </h3>
        
        <div className="space-y-3.5 divide-y divide-slate-100">
          {journal.map((entry) => (
            <div key={entry.id} className="pt-3 flex gap-3.5 items-start">
              <span className={`text-2xl p-2 rounded-2xl border ${getMoodColor(entry.humeur)}`}>
                {getMoodEmoji(entry.humeur)}
              </span>
              <div>
                <p className="text-sm font-black text-slate-900">
                  {new Date(entry.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                <p className="text-sm font-medium text-slate-600 leading-normal mt-1">{entry.note}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CAMERA OPTIONAL CONSENT DIALOG OVERLAY */}
      {showConsentModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="text-center py-4 bg-emerald-50 border border-emerald-100 rounded-2xl mb-4">
              <Camera className="w-14 h-14 text-emerald-600 mx-auto" />
              <h3 className="text-lg font-black text-slate-900 mt-2">Mesure de rythme respiratoire par caméra</h3>
            </div>

            <div className="space-y-4 text-slate-700 font-semibold text-sm leading-relaxed">
              <p>
                L'application Liora peut utiliser la caméra de votre téléphone pour analyser de micro-mouvements de votre cage thoracique et évaluer la qualité de votre calme pulmonaire.
              </p>
              <p className="text-slate-500 font-medium">
                Cette option est <strong>100% facultative</strong>. L'analyse s'effectue intégralement en local dans votre téléphone, aucune image ou vidéo n'est enregistrée ou envoyée sur internet.
              </p>

              <div className="bg-emerald-50 border border-emerald-150 p-3 rounded-xl text-emerald-950 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>Confidentialité et sécurité des données de santé assurées.</span>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setCameraConsent(false);
                  setShowConsentModal(false);
                }}
                className="flex-1 bg-slate-150 hover:bg-slate-200 text-slate-800 font-bold py-3.5 rounded-xl text-sm cursor-pointer"
              >
                Refuser l'option
              </button>
              
              <button
                onClick={() => {
                  setCameraConsent(true);
                  setShowConsentModal(false);
                }}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3.5 rounded-xl shadow cursor-pointer text-sm"
              >
                Accepter & Activer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
