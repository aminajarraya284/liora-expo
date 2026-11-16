import React, { useState } from 'react';
import { RelativeContact } from '../types';
import { Users, Plus, Phone, MessageSquare, Share2, ShieldCheck, Check, Info, X } from 'lucide-react';

interface ProchesProps {
  relatives: RelativeContact[];
  onAddRelative: (rel: RelativeContact) => void;
  onUpdatePermission: (id: string, field: 'agenda' | 'documents' | 'sante', val: boolean) => void;
  onDeleteRelative: (id: string) => void;
}

export default function Proches({ relatives, onAddRelative, onUpdatePermission, onDeleteRelative }: ProchesProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Form states
  const [nom, setNom] = useState('');
  const [relation, setRelation] = useState('');
  const [telephone, setTelephone] = useState('');

  const [shareAgenda, setShareAgenda] = useState(true);
  const [shareDocs, setShareDocs] = useState(false);
  const [shareSante, setShareSante] = useState(true);

  // Quick SMS helper simulation
  const [quickSmsContact, setQuickSmsContact] = useState<RelativeContact | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom || !relation || !telephone) return;

    onAddRelative({
      id: `rel-${Date.now()}`,
      nom,
      relation,
      telephone,
      partages: {
        agenda: shareAgenda,
        documents: shareDocs,
        sante: shareSante
      }
    });

    // Reset states
    setNom('');
    setRelation('');
    setTelephone('');
    setShareAgenda(true);
    setShareDocs(false);
    setShareSante(true);
    setShowAddForm(false);
  };

  const handleSendQuickMessage = (type: string, rel: RelativeContact) => {
    let msg = "";
    if (type === 'bien') {
      msg = `Coucou ${rel.nom.split(' ')[0]} ! C'est pour te rassurer et te dire que tout va bien de mon côté. Bonne journée ! — Envoyé via Liora`;
    } else {
      msg = `Bonjour ${rel.nom.split(' ')[0]}, j'aurais besoin d'un petit coup de main aujourd'hui ou que tu m'appelles s'il te plaît. Rien de grave ! — Envoyé via Liora`;
    }

    setQuickSmsContact(null);
    alert(`SMS prérempli simulé envoyé à ${rel.nom} :\n\n"${msg}"`);
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Header with add trigger */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/60 shadow-sm flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-600" />
            <span>Mes Proches de Confiance</span>
          </h2>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Gérez qui vous accompagne et contrôlez ce que vous partagez.
          </p>
        </div>
        
        <button
          onClick={() => setShowAddForm(true)}
          id="proches-add-btn"
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-4 py-3 rounded-2xl flex items-center gap-1.5 transition text-base shadow cursor-pointer min-h-[48px]"
        >
          <Plus className="w-5 h-5" />
          <span>Ajouter</span>
        </button>
      </div>

      {/* 2. Granular permissions autonomy reminder */}
      <div className="bg-emerald-50 border border-emerald-150 p-5 rounded-3xl flex gap-3.5 text-emerald-950 shadow-sm">
        <ShieldCheck className="w-8 h-8 text-emerald-600 shrink-0" />
        <div className="text-sm font-semibold">
          <p className="text-emerald-900 font-extrabold text-base">Vous gardez le contrôle total</p>
          <p className="mt-0.5 text-emerald-800 leading-relaxed font-medium">
            L'accompagnement oui, l'infantilisation non. Vos proches ne voient <strong>uniquement</strong> que les cases cochées ci-dessous. Vous pouvez modifier ou révoquer leurs accès instantanément à tout moment.
          </p>
        </div>
      </div>

      {/* 3. Relatives List with instant permission settings */}
      <div className="space-y-5">
        {relatives.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-slate-200/60">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-lg font-bold text-slate-700">Aucun proche enregistré</p>
            <p className="text-sm text-slate-400 mt-1">Cliquez sur "Ajouter" pour désigner un proche de confiance.</p>
          </div>
        ) : (
          relatives.map((rel) => (
            <div key={rel.id} className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
              
              {/* Profile Card and Quick communication */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight leading-snug">
                    {rel.nom}
                  </h3>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mt-0.5">
                    Relation : {rel.relation} • {rel.telephone}
                  </span>
                </div>

                {/* Communication Actions */}
                <div className="flex items-center gap-2">
                  <a
                    href={`tel:${rel.telephone.replace(/\s+/g, '')}`}
                    className="flex-1 sm:flex-none bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold px-3.5 py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition min-h-[40px]"
                  >
                    <Phone className="w-4 h-4 text-slate-600" />
                    <span>Appeler</span>
                  </a>

                  <button
                    onClick={() => setQuickSmsContact(rel)}
                    className="flex-1 sm:flex-none bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold px-3.5 py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition min-h-[40px] cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Donner des nouvelles</span>
                  </button>
                </div>
              </div>

              {/* Granular sharing checklist */}
              <div className="space-y-2.5">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">
                  Permissions de partage accordées à {rel.nom.split(' ')[0]} :
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  
                  {/* Agenda share checkbox */}
                  <label className="flex items-center gap-3 bg-slate-50 border border-slate-150 p-3 rounded-2xl cursor-pointer hover:bg-slate-100/50 transition">
                    <input
                      type="checkbox"
                      checked={rel.partages.agenda}
                      onChange={(e) => onUpdatePermission(rel.id, 'agenda', e.target.checked)}
                      className="w-5 h-5 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded cursor-pointer"
                    />
                    <div className="text-xs">
                      <strong className="text-slate-900 font-black block leading-none">Mon Agenda</strong>
                      <span className="text-slate-400 font-medium block mt-0.5">Rendez-vous partagés</span>
                    </div>
                  </label>

                  {/* Documents share checkbox */}
                  <label className="flex items-center gap-3 bg-slate-50 border border-slate-150 p-3 rounded-2xl cursor-pointer hover:bg-slate-100/50 transition">
                    <input
                      type="checkbox"
                      checked={rel.partages.documents}
                      onChange={(e) => onUpdatePermission(rel.id, 'documents', e.target.checked)}
                      className="w-5 h-5 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded cursor-pointer"
                    />
                    <div className="text-xs">
                      <strong className="text-slate-900 font-black block leading-none">Coffre-fort</strong>
                      <span className="text-slate-400 font-medium block mt-0.5">Documents autorisés</span>
                    </div>
                  </label>

                  {/* Health/Medication share checkbox */}
                  <label className="flex items-center gap-3 bg-slate-50 border border-slate-150 p-3 rounded-2xl cursor-pointer hover:bg-slate-100/50 transition">
                    <input
                      type="checkbox"
                      checked={rel.partages.sante}
                      onChange={(e) => onUpdatePermission(rel.id, 'sante', e.target.checked)}
                      className="w-5 h-5 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded cursor-pointer"
                    />
                    <div className="text-xs">
                      <strong className="text-slate-900 font-black block leading-none">Santé & Pilulier</strong>
                      <span className="text-slate-400 font-medium block mt-0.5">Rappels et prises</span>
                    </div>
                  </label>

                </div>
              </div>

              {/* Revoke relative option */}
              <div className="flex justify-end pt-1">
                <button
                  onClick={() => {
                    if (confirm(`Voulez-vous vraiment révoquer l'accès complet de ${rel.nom} ? Ses autorisations seront supprimées.`)) {
                      onDeleteRelative(rel.id);
                    }
                  }}
                  className="text-xs text-slate-400 hover:text-rose-600 font-bold underline cursor-pointer"
                >
                  Révoquer ce proche
                </button>
              </div>

            </div>
          ))
        )}
      </div>

      {/* QUICK COMMUNICATION POPUP SELECTOR */}
      {quickSmsContact && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Rassurer mes proches</h3>
              <button onClick={() => setQuickSmsContact(null)} className="text-slate-400 p-1.5 bg-slate-100 rounded-full cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm font-semibold text-slate-500 mb-4">
              Choisissez un message pré-écrit en un clic à envoyer à {quickSmsContact.nom.split(' ')[0]} :
            </p>

            <div className="space-y-3">
              <button
                onClick={() => handleSendQuickMessage('bien', quickSmsContact)}
                className="w-full text-left bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 p-4 rounded-2xl transition cursor-pointer"
              >
                <span className="font-extrabold text-emerald-950 block text-base">🟢 "Tout va bien !"</span>
                <span className="text-xs text-emerald-800 block mt-1 leading-relaxed">
                  Coucou ! C'est pour te rassurer et te dire que tout va bien de mon côté. Bonne journée !
                </span >
              </button>

              <button
                onClick={() => handleSendQuickMessage('aide', quickSmsContact)}
                className="w-full text-left bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 p-4 rounded-2xl transition cursor-pointer"
              >
                <span className="font-extrabold text-indigo-950 block text-base">💬 "Besoin d'un petit service"</span>
                <span className="text-xs text-indigo-800 block mt-1 leading-relaxed">
                  Bonjour, j'aurais besoin d'un petit coup de main aujourd'hui ou que tu m'appelles s'il te plaît. Rien de grave !
                </span>
              </button>
            </div>

            <div className="mt-5">
              <button
                onClick={() => setQuickSmsContact(null)}
                className="w-full bg-slate-150 hover:bg-slate-200 text-slate-800 font-bold py-3 rounded-xl text-sm cursor-pointer text-center"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD RELATIVE DRAWER */}
      {showAddForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <form 
            onSubmit={handleSubmit}
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-black text-slate-900">Ajouter un proche</h3>
              <button type="button" onClick={() => setShowAddForm(false)} className="text-slate-400 p-1.5 bg-slate-100 rounded-full cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-bold text-slate-700 block mb-1">Prénom & Nom du proche</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Sophie Bernard"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-base"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-bold text-slate-700 block mb-1">Lien de parenté</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Fille, Fils, Voisin..."
                    value={relation}
                    onChange={(e) => setRelation(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-4 py-3 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-base"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-slate-700 block mb-1">N° de Téléphone</label>
                  <input
                    type="tel"
                    required
                    placeholder="Ex: 06 12 34 56 78"
                    value={telephone}
                    onChange={(e) => setTelephone(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-4 py-3 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-base"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <span className="text-xs font-extrabold text-slate-400 uppercase tracking-widest block">
                  Permissions de départ (modifiables ensuite) :
                </span>

                <div className="space-y-2">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={shareAgenda}
                      onChange={(e) => setShareAgenda(e.target.checked)}
                      className="w-5 h-5 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded"
                    />
                    <span className="text-sm font-bold text-slate-700">Partager l'Agenda (rendez-vous)</span>
                  </label>

                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={shareDocs}
                      onChange={(e) => setShareDocs(e.target.checked)}
                      className="w-5 h-5 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded"
                    />
                    <span className="text-sm font-bold text-slate-700">Partager le Coffre-fort (documents)</span>
                  </label>

                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={shareSante}
                      onChange={(e) => setShareSante(e.target.checked)}
                      className="w-5 h-5 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded"
                    />
                    <span className="text-sm font-bold text-slate-700">Partager la Santé (pilulier)</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-3.5 rounded-xl text-sm cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3.5 rounded-xl shadow-md text-sm cursor-pointer"
              >
                Enregistrer
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
