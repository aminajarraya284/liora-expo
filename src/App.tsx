import React, { useState } from 'react';
import Header from './components/Header';
import Onboarding from './components/Onboarding';
import Dashboard from './components/Dashboard';
import Agenda from './components/Agenda';
import Medications from './components/Medications';
import CoffreFort from './components/CoffreFort';
import Proteger from './components/Proteger';
import Proches from './components/Proches';
import Urgence from './components/Urgence';
import ProcheDashboard from './components/ProcheDashboard';
import BienEtre from './components/BienEtre';
import RadioAudio from './components/RadioAudio';
import PhysiqueDoux from './components/PhysiqueDoux';
import AssistantVocal from './components/AssistantVocal';
import Parametres from './components/Parametres';

// Pre-filled mock data from data.ts
import { 
  INITIAL_MEDICATIONS, 
  INITIAL_APPOINTMENTS, 
  INITIAL_DOCUMENTS, 
  INITIAL_PASSWORDS, 
  INITIAL_RELATIVES, 
  INITIAL_LOGS, 
  INITIAL_JOURNAL 
} from './data';

import { Medication, Appointment, SecureDocument, PasswordEntry, RelativeContact, AppAccessLog, JournalEntry } from './types';
import { Home, Calendar, Pill, FolderLock, ShieldCheck, Users, AlertCircle, Sparkles, MessageSquare, Heart, Settings, RefreshCw } from 'lucide-react';

export default function App() {
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [role, setRole] = useState<'senior' | 'proche'>('senior');
  const [activeScreen, setActiveScreen] = useState<string>('dashboard');

  // Core application states
  const [medications, setMedications] = useState<Medication[]>(INITIAL_MEDICATIONS);
  const [appointments, setAppointments] = useState<Appointment[]>(INITIAL_APPOINTMENTS);
  const [documents, setDocuments] = useState<SecureDocument[]>(INITIAL_DOCUMENTS);
  const [passwords, setPasswords] = useState<PasswordEntry[]>(INITIAL_PASSWORDS);
  const [relatives, setRelatives] = useState<RelativeContact[]>(INITIAL_RELATIVES);
  const [logs, setLogs] = useState<AppAccessLog[]>(INITIAL_LOGS);
  const [journal, setJournal] = useState<JournalEntry[]>(INITIAL_JOURNAL);

  const handleCompleteOnboarding = (selectedRole: 'senior' | 'proche') => {
    setRole(selectedRole);
    setIsOnboarded(true);
    setActiveScreen('dashboard');
  };

  // State handlers
  const handleTakeMed = (id: string) => {
    setMedications(prev => prev.map(m => {
      if (m.id === id) {
        const alreadyTaken = m.prisAujourdhui;
        return { 
          ...m, 
          prisAujourdhui: !alreadyTaken, 
          stock: alreadyTaken ? m.stock + 1 : Math.max(0, m.stock - 1) 
        };
      }
      return m;
    }));
  };

  const handleRefillMed = (id: string) => {
    setMedications(prev => prev.map(m => {
      if (m.id === id) {
        return { ...m, stock: m.stockMax };
      }
      return m;
    }));
  };

  const handleAddMed = (newMed: Medication) => {
    setMedications(prev => [newMed, ...prev]);
  };

  const handleDeleteMed = (id: string) => {
    setMedications(prev => prev.filter(m => m.id !== id));
  };

  const handleAddAppointment = (newApp: Appointment) => {
    setAppointments(prev => [newApp, ...prev]);
  };

  const handleToggleAppointmentShare = (id: string) => {
    setAppointments(prev => prev.map(app => {
      if (app.id === id) {
        return { ...app, partageAvecProche: !app.partageAvecProche };
      }
      return app;
    }));
  };

  const handleAddDocument = (newDoc: SecureDocument) => {
    setDocuments(prev => [newDoc, ...prev]);
  };

  const handleToggleDocShare = (id: string) => {
    setDocuments(prev => prev.map(doc => {
      if (doc.id === id) {
        return { ...doc, partageSelectif: !doc.partageSelectif };
      }
      return doc;
    }));
  };

  const handleDeleteDoc = (id: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== id));
  };

  const handleAddPassword = (newPwd: PasswordEntry) => {
    setPasswords(prev => [newPwd, ...prev]);
  };

  const handleDeletePassword = (id: string) => {
    setPasswords(prev => prev.filter(p => p.id !== id));
  };

  const handleAddRelative = (newRel: RelativeContact) => {
    setRelatives(prev => [newRel, ...prev]);
  };

  const handleUpdateRelativePermission = (id: string, field: 'agenda' | 'documents' | 'sante', val: boolean) => {
    setRelatives(prev => prev.map(rel => {
      if (rel.id === id) {
        return {
          ...rel,
          partages: {
            ...rel.partages,
            [field]: val
          }
        };
      }
      return rel;
    }));
  };

  const handleDeleteRelative = (id: string) => {
    setRelatives(prev => prev.filter(r => r.id !== id));
  };

  const handleAddAccessLog = (acteur: string, action: string, status: 'success' | 'warning' | 'info') => {
    const newLog: AppAccessLog = {
      id: `log-${Date.now()}`,
      date: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      acteur,
      action,
      statut: status
    };
    setLogs(prev => [newLog, ...prev]);
  };

  const handleAddJournal = (newEntry: JournalEntry) => {
    setJournal(prev => [newEntry, ...prev]);
  };

  const handleClearAllData = () => {
    setMedications([]);
    setAppointments([]);
    setDocuments([]);
    setPasswords([]);
    setRelatives([]);
    setLogs([]);
    setJournal([]);
  };

  // Nav side links
  const menuItems = [
    { id: 'dashboard', label: 'Accueil', icon: Home, color: 'text-slate-700' },
    { id: 'agenda', label: 'Mon Agenda', icon: Calendar, color: 'text-indigo-600' },
    { id: 'pilulier', label: 'Mon Pilulier', icon: Pill, color: 'text-emerald-600' },
    { id: 'documents', label: 'Coffre-fort', icon: FolderLock, color: 'text-emerald-600' },
    { id: 'proteger', label: 'Bouclier Sécu', icon: ShieldCheck, color: 'text-blue-600' },
    { id: 'proches', label: 'Mes Proches', icon: Users, color: 'text-indigo-600' },
    { id: 'urgence', label: 'Clé d\'Urgence', icon: AlertCircle, color: 'text-rose-600' },
    { id: 'assistant-vocal', label: 'Assistant Vocal', icon: MessageSquare, color: 'text-indigo-600' },
    { id: 'sante-mentale', label: 'Zen / Respiration', icon: Heart, color: 'text-emerald-600' },
    { id: 'audio-radio', label: 'Radio', icon: Sparkles, color: 'text-indigo-600' },
    { id: 'physique-doux', label: 'Gym Douce', icon: Sparkles, color: 'text-emerald-600' },
    { id: 'parametres', label: 'Paramètres', icon: Settings, color: 'text-slate-500' },
  ];

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans selection:bg-emerald-100 selection:text-emerald-900">
      
      {/* App Container */}
      <div className="max-w-md w-full mx-auto bg-white min-h-screen overflow-hidden flex flex-col relative">
        
        {!isOnboarded ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <Onboarding onComplete={handleCompleteOnboarding} />
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            
            {/* Main header component */}
            <Header onGoHome={() => setActiveScreen('dashboard')} role={role} />

            {/* Horizontal Nav for Mobile */}
            <aside className="w-full bg-white border-b border-slate-100 py-3 px-4 shrink-0 shadow-[0_4px_20px_-15px_rgba(0,0,0,0.1)] relative z-10">
              <nav className="flex overflow-x-auto gap-2.5 pb-1 scrollbar-hide snap-x">
                {menuItems.map((item) => {
                  const IconComp = item.icon;
                  const isActive = activeScreen === item.id;
                  
                  // In proche mode, restrict or adjust some naming
                  if (role === 'proche' && (item.id === 'pilulier' || item.id === 'sante-mentale' || item.id === 'physique-doux' || item.id === 'proches')) {
                    return null; // Don't show personal items on proche space
                  }

                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveScreen(item.id)}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[11px] font-bold transition whitespace-nowrap shrink-0 snap-start border ${
                        isActive
                          ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <IconComp className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : item.color}`} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}

                <button
                  onClick={() => {
                    if (confirm("Se déconnecter ? Vous retournerez à l'onboarding pour changer de rôle.")) {
                      setIsOnboarded(false);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[11px] font-bold transition whitespace-nowrap shrink-0 snap-start bg-white text-rose-600 border border-rose-200 hover:bg-rose-50"
                >
                  <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                  <span>Quitter</span>
                </button>
              </nav>
            </aside>

            {/* Main content viewport */}
            <main className="flex-1 p-4 bg-white overflow-y-auto">
              
              {/* Screen router */}
              {activeScreen === 'dashboard' && (
                role === 'senior' ? (
                  <Dashboard 
                    medications={medications} 
                    appointments={appointments} 
                    onNavigate={setActiveScreen} 
                    onTakeMed={handleTakeMed} 
                  />
                ) : (
                  <ProcheDashboard 
                    relatives={relatives} 
                    onAddAccessLog={handleAddAccessLog} 
                  />
                )
              )}

              {activeScreen === 'agenda' && (
                <Agenda 
                  appointments={appointments} 
                  onAddAppointment={handleAddAppointment} 
                  onToggleShare={handleToggleAppointmentShare} 
                />
              )}

              {activeScreen === 'pilulier' && (
                <Medications 
                  medications={medications} 
                  onTakeMed={handleTakeMed} 
                  onAddMed={handleAddMed} 
                  onRefillMed={handleRefillMed} 
                  onDeleteMed={handleDeleteMed} 
                />
              )}

              {activeScreen === 'documents' && (
                <CoffreFort 
                  documents={documents} 
                  onAddDocument={handleAddDocument} 
                  onToggleShare={handleToggleDocShare} 
                  onDeleteDocument={handleDeleteDoc} 
                />
              )}

              {activeScreen === 'proteger' && (
                <Proteger 
                  passwords={passwords} 
                  onAddPassword={handleAddPassword} 
                  onDeletePassword={handleDeletePassword} 
                />
              )}

              {activeScreen === 'proches' && (
                <Proches 
                  relatives={relatives} 
                  onAddRelative={handleAddRelative} 
                  onUpdatePermission={handleUpdateRelativePermission} 
                  onDeleteRelative={handleDeleteRelative} 
                />
              )}

              {activeScreen === 'urgence' && (
                <Urgence onAddAccessLog={handleAddAccessLog} />
              )}

              {activeScreen === 'sante-mentale' && (
                <BienEtre journal={journal} onAddJournal={handleAddJournal} />
              )}

              {activeScreen === 'audio-radio' && (
                <RadioAudio />
              )}

              {activeScreen === 'physique-doux' && (
                <PhysiqueDoux />
              )}

              {activeScreen === 'assistant-vocal' && (
                <AssistantVocal />
              )}

              {activeScreen === 'parametres' && (
                <Parametres logs={logs} onClearAllData={handleClearAllData} />
              )}

            </main>
          </div>
        )}
      </div>

    </div>
  );
}
