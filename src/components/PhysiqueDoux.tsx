import React, { useState } from 'react';
import { PHYSICAL_EXERCISES } from '../data';
import { Dumbbell, Clock, ChevronRight, Check, X } from 'lucide-react';

export default function PhysiqueDoux() {
  const [selectedEx, setSelectedEx] = useState<any | null>(null);
  const [activeStep, setActiveStep] = useState(0);

  const handleStartExercise = (ex: any) => {
    setSelectedEx(ex);
    setActiveStep(0);
  };

  const handleNextStep = () => {
    if (selectedEx && activeStep < selectedEx.steps.length - 1) {
      setActiveStep(prev => prev + 1);
    } else {
      setSelectedEx(null);
      alert("Félicitations ! Vous avez terminé cet exercice doux d'entretien d'équilibre et de souplesse.");
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/60 shadow-sm">
        <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <Dumbbell className="w-6 h-6 text-emerald-600" />
          <span>Exercices Physiques Doux</span>
        </h2>
        <p className="text-sm font-medium text-slate-500 mt-1">
          Prenez soin de votre mobilité, de votre souffle et de votre équilibre au quotidien.
        </p>
      </div>

      {/* Exercises list */}
      <div className="space-y-3.5">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block px-1">
          Séances recommandées sans matériel :
        </span>

        {PHYSICAL_EXERCISES.map((ex) => (
          <div
            key={ex.id}
            onClick={() => handleStartExercise(ex)}
            className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex items-center justify-between gap-4 hover:border-emerald-500/20 transition cursor-pointer"
          >
            <div className="flex gap-4 items-center">
              <span className="text-3xl bg-slate-50 p-3.5 rounded-2xl border border-slate-150 shrink-0">
                {ex.emoji}
              </span>
              <div>
                <strong className="text-slate-900 font-black text-base block">{ex.name}</strong>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full w-max block mt-1">
                  Durée : {ex.duration}
                </span>
                <span className="text-xs font-semibold text-slate-400 block mt-1.5 leading-normal line-clamp-1">{ex.desc}</span>
              </div>
            </div>
            
            <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
          </div>
        ))}
      </div>

      {/* Guided steps Dialog overlay */}
      {selectedEx && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-center space-y-5">
            <div className="flex justify-between items-center border-b border-slate-150 pb-3">
              <span className="bg-emerald-100 text-emerald-800 text-xs font-black px-2.5 py-1 rounded-full uppercase">
                {selectedEx.name}
              </span>
              <button onClick={() => setSelectedEx(null)} className="text-slate-400 p-1 bg-slate-100 rounded-full cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-5xl py-4">{selectedEx.emoji}</div>

            {/* Steps tracker progress dot */}
            <div className="flex justify-center gap-2">
              {selectedEx.steps.map((_: any, idx: number) => (
                <div
                  key={idx}
                  className={`w-3.5 h-3.5 rounded-full border transition-all duration-200 ${
                    idx === activeStep ? 'bg-emerald-600 border-emerald-600 scale-125' : 'bg-slate-100 border-slate-300'
                  }`}
                />
              ))}
            </div>

            <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl min-h-[100px] flex flex-col justify-center">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">
                Étape {activeStep + 1} sur {selectedEx.steps.length} :
              </span>
              <p className="text-base font-bold text-slate-900 mt-2 leading-relaxed">
                {selectedEx.steps[activeStep]}
              </p>
            </div>

            <button
              onClick={handleNextStep}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base py-4 rounded-xl shadow cursor-pointer transition"
            >
              {activeStep === selectedEx.steps.length - 1 ? "Terminer la séance ✓" : "Continuer"}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
