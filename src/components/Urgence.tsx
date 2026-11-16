import React, { useState, useEffect } from 'react';
import { ShieldAlert, Clock, AlertTriangle, Check, X, ShieldCheck, History } from 'lucide-react';

interface UrgenceProps {
  onAddAccessLog: (acteur: string, action: string, status: 'success' | 'warning' | 'info') => void;
}

export default function Urgence({ onAddAccessLog }: UrgenceProps) {
  const [requestStatus, setRequestStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [timeLeft, setTimeLeft] = useState(172800); // 48 hours in seconds

  useEffect(() => {
    if (requestStatus !== 'pending') return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [requestStatus]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}h ${m}m ${s}s`;
  };

  const handleApprove = () => {
    setRequestStatus('approved');
    onAddAccessLog("Jean-Marc Dupond (Fils)", "Accès d'urgence accordé à l'Attestation de Mutuelle", "success");
    alert("Vous avez accordé l'accès d'urgence à vos documents. Jean-Marc a été prévenu et remercie votre confiance.");
  };

  const handleReject = () => {
    setRequestStatus('rejected');
    onAddAccessLog("Jean-Marc Dupond (Fils)", "Accès d'urgence décliné par l'utilisateur", "warning");
    alert("Accès d'urgence refusé. Jean-Marc a été notifié de votre refus. Vos documents restent entièrement cryptés et invisibles.");
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Explanatory Header */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/60 shadow-sm">
        <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-rose-600 animate-pulse" />
          <span>Clé de Confiance 48h</span>
        </h2>
        <p className="text-sm font-medium text-slate-500 mt-1">
          La sécurité absolue sans bloquer vos proches en cas d'imprévu majeur.
        </p>
      </div>

      {/* 2. Educational Concept card */}
      <div className="bg-slate-900 text-slate-300 p-5 rounded-3xl border border-slate-800 shadow-md space-y-3">
        <div className="flex gap-3 items-center">
          <div className="bg-rose-950 p-2 rounded-xl text-rose-400">
            <Clock className="w-5 h-5" />
          </div>
          <strong className="text-white text-base font-black">Comment fonctionne la Clé 48h ?</strong>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed font-semibold">
          Si vous êtes indisponible (ex: hospitalisation surprise), un proche de confiance peut demander l'accès à vos papiers importants (mutuelle, assurance).
        </p>
        <p className="text-xs text-slate-400 leading-relaxed font-semibold">
          Liora vous alerte immédiatement. <strong>Vous avez 48 heures pour refuser d'un clic.</strong> Si vous ne refusez pas dans ce délai, l'accès est déverrouillé temporairement pour votre sécurité. Vous restez maître du jeu à chaque instant !
        </p>
      </div>

      {/* 3. SIMULATED EMERGENCY REQUEST ALERT */}
      {requestStatus === 'pending' ? (
        <div className="bg-rose-50 border-2 border-rose-300 rounded-3xl p-5 shadow-sm space-y-4 animate-in zoom-in duration-200">
          <div className="flex gap-3.5 items-start">
            <div className="bg-rose-500 text-white p-3 rounded-2xl shrink-0 shadow-md">
              <AlertTriangle className="w-7 h-7 animate-bounce" />
            </div>
            <div>
              <span className="text-xs font-extrabold text-rose-800 uppercase tracking-widest block">
                Demande d'Accès d'Urgence Active
              </span>
              <h3 className="text-lg font-black text-slate-900 leading-snug mt-1">
                Votre fils Jean-Marc demande l'accès à votre contrat d'assurance AXA.
              </h3>
              <p className="text-xs font-semibold text-rose-900 mt-1">
                Motif renseigné : "Papa, j'ai besoin de retrouver ton contrat d'habitation pour déclarer le sinistre dégât des eaux chez toi."
              </p>
            </div>
          </div>

          {/* Countdown timer */}
          <div className="bg-rose-100/50 border border-rose-200/50 p-3 rounded-2xl flex items-center justify-between text-rose-950">
            <span className="text-xs font-extrabold uppercase">Temps restant pour refuser :</span>
            <span className="text-sm font-mono font-black text-rose-800 animate-pulse bg-white px-3 py-1 rounded-full border border-rose-200">
              {formatTime(timeLeft)}
            </span>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              id="urgence-reject-btn"
              onClick={handleReject}
              className="bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-extrabold py-3.5 rounded-2xl transition shadow-sm text-center text-sm cursor-pointer min-h-[48px] flex items-center justify-center gap-1.5"
            >
              <X className="w-4 h-4 text-rose-600" />
              <span>Refuser l'accès</span>
            </button>

            <button
              id="urgence-approve-btn"
              onClick={handleApprove}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3.5 rounded-2xl transition shadow-md text-center text-sm cursor-pointer min-h-[48px] flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Accepter (Donner la clé)</span>
            </button>
          </div>
        </div>
      ) : requestStatus === 'approved' ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-5 flex gap-3 text-emerald-950 animate-in fade-in duration-200">
          <ShieldCheck className="w-8 h-8 text-emerald-600 shrink-0" />
          <div>
            <strong className="text-base font-black block">Demande acceptée par vos soins</strong>
            <p className="text-sm font-semibold text-emerald-800 mt-1">
              Jean-Marc Dupond a désormais accès à l'Attestation de Mutuelle. Vous pouvez révoquer cette clé d'urgence dans l'onglet des permissions de vos proches à tout moment.
            </p>
            <button
              onClick={() => setRequestStatus('pending')}
              className="mt-3 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition"
            >
              Réinitialiser la simulation de démo
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-rose-50 border border-rose-200 rounded-3xl p-5 flex gap-3 text-rose-950 animate-in fade-in duration-200">
          <X className="w-8 h-8 text-rose-600 shrink-0 bg-white rounded-full p-1.5" />
          <div>
            <strong className="text-base font-black block">Demande déclinée avec succès</strong>
            <p className="text-sm font-semibold text-rose-800 mt-1">
              Vous avez refusé la demande d'accès d'urgence de Jean-Marc. Vos données confidentielles restent parfaitement protégées dans votre coffre-fort.
            </p>
            <button
              onClick={() => setRequestStatus('pending')}
              className="mt-3 bg-white hover:bg-rose-100 text-rose-800 border border-rose-200 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition"
            >
              Réinitialiser la simulation de démo
            </button>
          </div>
        </div>
      )}

      {/* 4. Journal / History */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/60 shadow-sm space-y-3">
        <h4 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
          <History className="w-5 h-5 text-indigo-500" />
          <span>Journal historique des clés de confiance</span>
        </h4>
        
        <div className="space-y-2.5 divide-y divide-slate-100">
          <div className="flex justify-between text-sm py-2 font-semibold">
            <div>
              <p className="text-slate-800">Clé d'urgence activée automatiquement (48h)</p>
              <p className="text-xs text-slate-400 mt-0.5">Pour Jean-Marc Dupond</p>
            </div>
            <span className="text-xs font-bold text-slate-400">Le 22/05/2026</span>
          </div>
          <div className="flex justify-between text-sm py-2 font-semibold pt-2">
            <div>
              <p className="text-slate-800">Révocation manuelle de la clé de confiance</p>
              <p className="text-xs text-slate-400 mt-0.5">Par vous-même</p>
            </div>
            <span className="text-xs font-bold text-slate-400">Le 25/05/2026</span>
          </div>
        </div>
      </div>

    </div>
  );
}
