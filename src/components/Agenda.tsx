import React, { useState } from 'react';
import { Appointment } from '../types';
import { Calendar, Plus, Share2, Check, FileText, ChevronRight, X } from 'lucide-react';

interface AgendaProps {
  appointments: Appointment[];
  onAddAppointment: (app: Appointment) => void;
  onToggleShare: (id: string) => void;
}

export default function Agenda({ appointments, onAddAppointment, onToggleShare }: AgendaProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedApp, setSelectedApp] = useState<Appointment | null>(null);

  // Form states
  const [titre, setTitre] = useState('');
  const [date, setDate] = useState('');
  const [heure, setHeure] = useState('');
  const [categorie, setCategorie] = useState<'médical' | 'familial' | 'administratif' | 'autre'>('médical');
  const [description, setDescription] = useState('');
  const [documentAssocie, setDocumentAssocie] = useState('');
  const [partageAvecProche, setPartageAvecProche] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titre || !date || !heure) return;

    const newApp: Appointment = {
      id: `app-${Date.now()}`,
      titre,
      date,
      heure,
      categorie,
      description,
      documentAssocie: documentAssocie || undefined,
      partageAvecProche
    };

    onAddAppointment(newApp);
    
    // Reset form
    setTitre('');
    setDate('');
    setHeure('');
    setCategorie('médical');
    setDescription('');
    setDocumentAssocie('');
    setPartageAvecProche(true);
    setShowAddForm(false);
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'médical': return 'bg-rose-50 border-rose-200 text-rose-800';
      case 'familial': return 'bg-emerald-50 border-emerald-200 text-emerald-800';
      case 'administratif': return 'bg-amber-50 border-amber-200 text-amber-800';
      default: return 'bg-slate-100 border-slate-200 text-slate-800';
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header section */}
      <div className="flex justify-between items-center bg-white p-5 rounded-3xl border border-slate-200/60 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Calendar className="w-6 h-6 text-indigo-600" />
            <span>Mon Agenda</span>
          </h2>
          <p className="text-sm font-medium text-slate-500 mt-1">Gérez vos activités et rendez-vous simplement.</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          id="agenda-add-btn"
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-4 py-3 rounded-2xl flex items-center gap-1.5 transition text-base shadow cursor-pointer min-h-[48px]"
        >
          <Plus className="w-5 h-5" />
          <span>Ajouter</span>
        </button>
      </div>

      {/* Main List of Appointments */}
      <div className="space-y-4">
        {appointments.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-slate-200/60">
            <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-lg font-bold text-slate-700">Aucun rendez-vous planifié</p>
            <p className="text-sm text-slate-400 mt-1">Appuyez sur "Ajouter" pour créer votre premier rendez-vous.</p>
          </div>
        ) : (
          appointments.map((app) => (
            <div
              key={app.id}
              className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-indigo-500/30 transition"
            >
              <div 
                className="flex gap-4 items-start cursor-pointer flex-1"
                onClick={() => setSelectedApp(app)}
              >
                <div className={`p-3 rounded-2xl border text-center font-bold min-w-[75px] ${getCategoryColor(app.categorie)}`}>
                  <span className="text-xs uppercase tracking-wider block font-semibold">
                    {app.categorie}
                  </span>
                  <span className="text-lg font-extrabold block mt-0.5">
                    {app.heure}
                  </span>
                </div>
                
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                    {app.titre}
                  </h3>
                  <p className="text-sm font-bold text-slate-500 mt-1">
                    Date : {new Date(app.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                  {app.documentAssocie && (
                    <div className="flex items-center gap-1 mt-2 text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full w-max">
                      <FileText className="w-3.5 h-3.5" />
                      <span>{app.documentAssocie}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action columns */}
              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                <button
                  onClick={() => onToggleShare(app.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition border cursor-pointer min-h-[40px] ${
                    app.partageAvecProche 
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                  title="Partager ce rendez-vous avec mes proches"
                >
                  <Share2 className="w-4 h-4" />
                  <span>{app.partageAvecProche ? "Partagé aux proches" : "Privé (cliquer)"}</span>
                </button>
                
                <button
                  onClick={() => setSelectedApp(app)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 p-2.5 rounded-xl cursor-pointer min-h-[40px] flex items-center justify-center"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Appointment Details Modal */}
      {selectedApp && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex justify-between items-start mb-4">
              <span className={`px-3 py-1 text-xs font-extrabold rounded-full uppercase border ${getCategoryColor(selectedApp.categorie)}`}>
                {selectedApp.categorie}
              </span>
              <button 
                onClick={() => setSelectedApp(null)}
                className="text-slate-400 hover:text-slate-600 p-1 bg-slate-100 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <h3 className="text-xl font-black text-slate-900 leading-tight">{selectedApp.titre}</h3>
            
            <div className="mt-4 space-y-3 font-semibold text-slate-700">
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase">Date & Heure</p>
                <p className="text-base font-bold text-slate-900 mt-0.5">
                  Le {new Date(selectedApp.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                <p className="text-base font-extrabold text-indigo-700 mt-0.5">
                  À {selectedApp.heure}
                </p>
              </div>

              {selectedApp.description && (
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                  <p className="text-xs font-bold text-slate-400 uppercase">Notes / Consignes</p>
                  <p className="text-sm font-medium text-slate-800 mt-1 leading-relaxed">{selectedApp.description}</p>
                </div>
              )}

              {selectedApp.documentAssocie && (
                <div className="bg-indigo-50/60 p-3.5 rounded-2xl border border-indigo-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-600" />
                    <div>
                      <p className="text-xs font-bold text-indigo-400 uppercase">Document utile lié</p>
                      <p className="text-sm font-bold text-indigo-950 mt-0.5">{selectedApp.documentAssocie}</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">
                    Sécurisé
                  </span>
                </div>
              )}

              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 flex justify-between items-center">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase">Partage familial</p>
                  <p className="text-sm font-bold text-slate-800 mt-0.5">
                    {selectedApp.partageAvecProche ? "Visible par Sophie et Jean-Marc" : "Privé — visible uniquement par vous"}
                  </p>
                </div>
                <div className={`w-3.5 h-3.5 rounded-full ${selectedApp.partageAvecProche ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={() => {
                  onToggleShare(selectedApp.id);
                  setSelectedApp({ ...selectedApp, partageAvecProche: !selectedApp.partageAvecProche });
                }}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 px-4 rounded-xl shadow cursor-pointer transition text-center text-sm"
              >
                {selectedApp.partageAvecProche ? "Rendre Privé (ne plus partager)" : "Partager avec mes proches de confiance"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Appointment Drawer/Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form 
            onSubmit={handleSubmit}
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in slide-in-from-bottom duration-200 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Nouveau rendez-vous</h3>
              <button 
                type="button"
                onClick={() => setShowAddForm(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 bg-slate-100 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-bold text-slate-700 block mb-1">Titre / Professionnel</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Dr. Martin, Coiffeur, Repas de famille"
                  value={titre}
                  onChange={(e) => setTitre(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-base"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-bold text-slate-700 block mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-4 py-3 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-base"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-slate-700 block mb-1">Heure</label>
                  <input
                    type="time"
                    required
                    value={heure}
                    onChange={(e) => setHeure(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-4 py-3 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-base"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-bold text-slate-700 block mb-1">Catégorie d'activité</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { val: 'médical', label: '🩺 Médical' },
                    { val: 'familial', label: '🏡 Familial' },
                    { val: 'administratif', label: '📄 Administratif' },
                    { val: 'autre', label: '✨ Autre' }
                  ].map((item) => (
                    <button
                      key={item.val}
                      type="button"
                      onClick={() => setCategorie(item.val as any)}
                      className={`py-3 px-3 rounded-xl border text-sm font-bold text-center transition cursor-pointer ${
                        categorie === item.val
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-bold text-slate-700 block mb-1">Notes ou remarques (optionnel)</label>
                <textarea
                  placeholder="Notes complémentaires, adresse, choses à ne pas oublier..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-base h-20"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-slate-700 block mb-1">Document d'accompagnement (optionnel)</label>
                <select
                  value={documentAssocie}
                  onChange={(e) => setDocumentAssocie(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-base"
                >
                  <option value="">Aucun document lié</option>
                  <option value="Ordonnance_Controle_Cardio.pdf">Ordonnance Contrôle Cardio</option>
                  <option value="Contrat_Mutuelle_Sante.pdf">Contrat Mutuelle Santé</option>
                  <option value="EDF_Facture_Juin26.pdf">Justificatif de domicile EDF</option>
                </select>
              </div>

              <div className="flex items-center gap-3 bg-slate-50 border border-slate-150 p-3.5 rounded-2xl">
                <input
                  type="checkbox"
                  id="partage"
                  checked={partageAvecProche}
                  onChange={(e) => setPartageAvecProche(e.target.checked)}
                  className="w-6 h-6 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded cursor-pointer"
                />
                <label htmlFor="partage" className="text-sm font-semibold text-slate-700 cursor-pointer">
                  Partager automatiquement ce rendez-vous avec mes proches autorisés
                </label>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-3.5 rounded-xl cursor-pointer text-center text-sm"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3.5 rounded-xl shadow cursor-pointer text-center text-sm"
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
