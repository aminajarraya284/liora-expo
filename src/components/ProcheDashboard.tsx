import React, { useState } from 'react';
import { RelativeContact } from '../types';
import { ShieldCheck, Heart, AlertCircle, Phone, MessageSquare, Clock, ArrowRight, X, Sparkles } from 'lucide-react';

interface ProcheDashboardProps {
  relatives: RelativeContact[];
  onAddAccessLog: (acteur: string, action: string, status: 'success' | 'warning' | 'info') => void;
}

export default function ProcheDashboard({ relatives, onAddAccessLog }: ProcheDashboardProps) {
  const [parentStatus, setParentStatus] = useState<'well' | 'alert'>('well');
  const [emergencyRequestSent, setEmergencyRequestSent] = useState(false);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [requestReason, setRequestReason] = useState('');

  const handleSimulateAlert = () => {
    setParentStatus('alert');
  };

  const handleResolveAlert = () => {
    setParentStatus('well');
  };

  const handleSendEmergencyRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestReason.trim()) return;

    setEmergencyRequestSent(true);
    setShowRequestDialog(false);
    onAddAccessLog("Jean-Marc Dupond (Fils)", `A initié une clé d'urgence pour le motif : "${requestReason}"`, "warning");
    alert(`Votre demande d'accès d'urgence aux documents d'assurance de Pierre Dupond a été envoyée. S'il ne refuse pas d'ici 48h, le coffre-fort d'assurance sera libéré temporairement.`);
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Header showing role */}
      <div className="bg-slate-900 text-white p-5 rounded-3xl border border-slate-800 shadow-md">
        <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-emerald-400" />
          <span>Espace Proche — Liora</span>
        </h2>
        <p className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-widest">
          Accompagnement de confiance de Pierre Dupond (Père)
        </p>
      </div>

      {/* 2. Parent's live status card */}
      <div className={`p-5 rounded-3xl border shadow-sm space-y-4 ${
        parentStatus === 'well' 
          ? 'bg-emerald-50 border-emerald-200 text-emerald-950' 
          : 'bg-rose-50 border-rose-300 text-rose-950 animate-pulse'
      }`}>
        <div className="flex justify-between items-start">
          <div className="flex gap-3.5 items-start">
            <div className={`p-3 rounded-2xl text-white shadow-md ${parentStatus === 'well' ? 'bg-emerald-600' : 'bg-rose-600 animate-bounce'}`}>
              <Heart className="w-7 h-7 fill-white" />
            </div>
            <div>
              <span className="text-xs font-extrabold uppercase tracking-wider block">
                Statut de Pierre Dupond :
              </span>
              <h3 className="text-xl font-black leading-tight mt-0.5">
                {parentStatus === 'well' ? "Tout va bien !" : "Alerte d'Urgence Déclenchée !"}
              </h3>
              <p className="text-xs font-semibold text-slate-500 mt-1">
                Dernier check-in rassurant : Aujourd'hui à 08:30 (Prise de Kardegic validée).
              </p>
            </div>
          </div>

          <span className={`text-xs font-black px-2.5 py-1 rounded-full uppercase ${
            parentStatus === 'well' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
          }`}>
            {parentStatus === 'well' ? "Sécurité OK" : "Alerte active"}
          </span>
        </div>

        {/* Action columns for alert resolution */}
        <div className="flex gap-3 pt-1">
          {parentStatus === 'well' ? (
            <button
              onClick={handleSimulateAlert}
              className="w-full bg-rose-600 hover:bg-rose-700 text-white font-extrabold py-3 rounded-xl text-xs shadow transition cursor-pointer"
            >
              Simuler un appel à l'aide de Pierre (Démo)
            </button>
          ) : (
            <button
              onClick={handleResolveAlert}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 rounded-xl text-xs shadow transition cursor-pointer"
            >
              Résoudre l'alerte (Tout va bien désormais)
            </button>
          )}
        </div>
      </div>

      {/* 3. Authorized Shared spaces with Pierre */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-indigo-600" />
          <span>Espaces Partagés avec votre consentement</span>
        </h3>

        <p className="text-xs font-semibold text-slate-500 leading-normal">
          Pierre a partagé avec vous : <strong>Agenda</strong> et <strong>Santé</strong>. Le Coffre-fort est privé.
        </p>

        <div className="grid grid-cols-2 gap-3">
          
          {/* Mock shared Agenda */}
          <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl">
            <span className="text-xs font-bold text-slate-400 uppercase block">Prochains rendez-vous de Pierre</span>
            <strong className="text-slate-900 font-black block mt-1.5 text-sm">Dr. Martin (Cardiologue)</strong>
            <span className="text-xs font-semibold text-slate-500 block mt-0.5">Demain à 10:00 — Partagé</span>
          </div>

          {/* Mock shared Medicine state */}
          <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl">
            <span className="text-xs font-bold text-slate-400 uppercase block">Pilulier aujourd'hui</span>
            <strong className="text-emerald-700 font-black block mt-1.5 text-sm">Kardegic pris ✓</strong>
            <span className="text-xs font-semibold text-slate-500 block mt-0.5">Levothyrox à prendre — Suivi</span>
          </div>

        </div>
      </div>

      {/* 4. EMERGENCY KEY REQUEST TRIGGER */}
      <div className="bg-rose-50 border border-rose-150 p-5 rounded-3xl space-y-3">
        <h4 className="text-base font-extrabold text-rose-950 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-600" />
          <span>Demander une Clé d'Urgence 48h</span>
        </h4>
        <p className="text-xs text-rose-900 leading-relaxed font-semibold">
          En cas d'accident ou si Pierre est injoignable, vous pouvez demander l'accès d'urgence à ses documents importants (EDF, Assurance). Pierre sera prévenu et pourra refuser. Sans action de sa part sous 48h, vos accès seront validés.
        </p>

        {!emergencyRequestSent ? (
          <button
            onClick={() => setShowRequestDialog(true)}
            className="w-full bg-rose-600 hover:bg-rose-700 text-white font-extrabold py-3.5 rounded-xl shadow cursor-pointer text-xs"
          >
            Initier une demande d'accès d'urgence (Clé 48h)
          </button>
        ) : (
          <div className="bg-white border border-rose-200 p-4 rounded-2xl text-center space-y-2">
            <span className="text-xs font-black text-rose-800 uppercase tracking-widest block animate-pulse">
              ⏳ Compte à rebours 48h initié
            </span>
            <p className="text-xs font-semibold text-slate-700">
              Pierre a été alerté. Vous recevrez l'accès aux documents dès qu'il accepte, ou automatiquement après 48 heures d'inactivité.
            </p>
            <button
              onClick={() => setEmergencyRequestSent(false)}
              className="text-xs text-slate-400 hover:text-rose-600 font-bold underline cursor-pointer"
            >
              Annuler la demande
            </button>
          </div>
        )}
      </div>

      {/* 5. QUICK DIALS */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-slate-100 p-2.5 rounded-xl text-slate-700">
            <Phone className="w-5 h-5" />
          </div>
          <div>
            <strong className="text-sm font-black text-slate-900 block">Appeler Pierre Dupond</strong>
            <span className="text-xs font-semibold text-slate-400 block">N° Direct : 06 12 34 56 78</span>
          </div>
        </div>
        <a
          href="tel:0612345678"
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow text-center cursor-pointer inline-block"
        >
          Appeler Pierre
        </a>
      </div>

      {/* REQUEST KEY REASON DIALOG OVERLAY */}
      {showRequestDialog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form 
            onSubmit={handleSendEmergencyRequest}
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in slide-in-from-bottom duration-200"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-black text-slate-900">Demande d'Accès d'Urgence</h3>
              <button type="button" onClick={() => setShowRequestDialog(false)} className="text-slate-400 p-1 bg-slate-100 rounded-full cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-rose-50 border border-rose-100 p-3.5 rounded-2xl flex gap-2">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <span className="text-xs text-rose-950 font-semibold leading-normal">
                  La loi punit sévèrement l'usurpation d'accès ou l'abus de confiance. Cette demande sera historisée dans le journal de Pierre.
                </span>
              </div>

              <div>
                <label className="text-sm font-bold text-slate-700 block mb-1">Motif de votre demande d'urgence (pour Pierre) :</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Expliquez clairement pourquoi vous devez accéder à ses documents aujourd'hui..."
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowRequestDialog(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-3.5 rounded-xl text-sm cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-extrabold py-3.5 rounded-xl shadow cursor-pointer text-sm"
              >
                Envoyer la demande
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
