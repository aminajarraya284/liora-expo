import React, { useState } from 'react';
import { AppAccessLog } from '../types';
import { INITIAL_LOGS } from '../data';
import { ShieldCheck, History, Eye, Trash2, Heart, Check } from 'lucide-react';

interface ParametresProps {
  logs: AppAccessLog[];
  onClearAllData: () => void;
}

export default function Parametres({ logs, onClearAllData }: ParametresProps) {
  const [allowLocation, setAllowLocation] = useState(true);
  const [allowTelemetry, setAllowTelemetry] = useState(false);
  const [doubleAuth, setDoubleAuth] = useState(true);

  const handleDeleteData = () => {
    if (confirm("🚨 ATTENTION : Êtes-vous sûr de vouloir supprimer définitivement l'intégralité de vos données Liora ? Cette action est irréversible (RGPD).")) {
      onClearAllData();
      alert("Toutes vos données et fichiers sécurisés ont été supprimés.");
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/60 shadow-sm">
        <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-emerald-600" />
          <span>Paramètres & Confidentialité</span>
        </h2>
        <p className="text-sm font-medium text-slate-500 mt-1">
          Gérez vos préférences RGPD, la sécurité de vos données et suivez les accès.
        </p>
      </div>

      {/* 2. RGPD granular permission toggles */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-base font-extrabold text-slate-900">Vos options de Confidentialité (RGPD)</h3>
        
        <div className="space-y-3">
          
          <label className="flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100 rounded-2xl cursor-pointer transition border border-slate-150">
            <div>
              <strong className="text-slate-900 font-extrabold block text-sm">Géolocalisation d'urgence</strong>
              <span className="text-xs text-slate-400 block mt-0.5 font-semibold">
                Autorise l'envoi de votre position GPS si vous cliquez sur "J'ai besoin d'aide".
              </span>
            </div>
            <input
              type="checkbox"
              checked={allowLocation}
              onChange={(e) => setAllowLocation(e.target.checked)}
              className="w-6 h-6 text-emerald-600 focus:ring-emerald-500 border-slate-300 rounded cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100 rounded-2xl cursor-pointer transition border border-slate-150">
            <div>
              <strong className="text-slate-900 font-extrabold block text-sm">Double sécurité Face ID / PIN</strong>
              <span className="text-xs text-slate-400 block mt-0.5 font-semibold">
                Re-demande systématiquement votre code secret lors de l'accès à vos mots de passe.
              </span>
            </div>
            <input
              type="checkbox"
              checked={doubleAuth}
              onChange={(e) => setDoubleAuth(e.target.checked)}
              className="w-6 h-6 text-emerald-600 focus:ring-emerald-500 border-slate-300 rounded cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100 rounded-2xl cursor-pointer transition border border-slate-150">
            <div>
              <strong className="text-slate-900 font-extrabold block text-sm">Analyses d'amélioration anonymes</strong>
              <span className="text-xs text-slate-400 block mt-0.5 font-semibold">
                Partage anonymement des données de performance système (désactivé par défaut).
              </span>
            </div>
            <input
              type="checkbox"
              checked={allowTelemetry}
              onChange={(e) => setAllowTelemetry(e.target.checked)}
              className="w-6 h-6 text-emerald-600 focus:ring-emerald-500 border-slate-300 rounded cursor-pointer"
            />
          </label>

        </div>
      </div>

      {/* 3. RELATIVES ACCESS TRANSPARENCY LOGGER */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
          <History className="w-5 h-5 text-indigo-600" />
          <span>Journal d'activité familial complet</span>
        </h3>

        <p className="text-xs font-semibold text-slate-500 leading-normal">
          Afin de garantir une relation saine et d'éviter toute dérive abusive, voici l'historique complet et transparent de chaque consultation initiée par vos proches de confiance.
        </p>

        <div className="space-y-3.5 divide-y divide-slate-100">
          {logs.map((log) => (
            <div key={log.id} className="pt-3 text-sm font-semibold flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
              <div>
                <span className="text-slate-800 font-black block sm:inline">{log.action}</span>
                <span className="text-xs font-bold text-slate-400 block sm:inline sm:ml-2">Par {log.acteur}</span>
              </div>
              <span className="text-xs font-bold text-slate-400 shrink-0">{log.date}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 4. DANGEROUS ZONE: DESTRUCTION (GDPR compliant) */}
      <div className="bg-rose-50 border border-rose-150 rounded-3xl p-5 space-y-3">
        <h4 className="text-base font-extrabold text-rose-950">Zone de Sécurité Critique (RGPD)</h4>
        <p className="text-xs text-rose-900 leading-relaxed font-semibold">
          Conformément aux lois de protection de la vie privée (RGPD), vous pouvez demander d'un clic la destruction immédiate de toutes vos informations de nos serveurs sécurisés et de ce téléphone.
        </p>

        <button
          onClick={handleDeleteData}
          className="w-full bg-rose-600 hover:bg-rose-700 text-white font-extrabold py-3.5 rounded-xl shadow cursor-pointer text-xs"
        >
          Supprimer définitivement mes données Liora
        </button>
      </div>

    </div>
  );
}
