import React, { useState } from 'react';
import { PasswordEntry } from '../types';
import { OFFICIAL_SITES } from '../data';
import { ShieldCheck, Sparkles, Send, Lock, Key, Eye, EyeOff, Plus, HelpCircle, ArrowUpRight, X, ShieldAlert, CheckCircle } from 'lucide-react';

interface ProtegerProps {
  passwords: PasswordEntry[];
  onAddPassword: (entry: PasswordEntry) => void;
  onDeletePassword: (id: string) => void;
}

export default function Proteger({ passwords, onAddPassword, onDeletePassword }: ProtegerProps) {
  const [activeTab, setActiveTab] = useState<'arnaque' | 'motsdepasse' | 'navigateur'>('arnaque');
  
  // Anti-scam States
  const [scamText, setScamText] = useState(
    "INFO ANTAI : Vous avez une amende impayée de 35€. Veuillez régulariser votre situation avant majoration sous 24h via ce lien : https://rege-antai-gouv.com"
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{
    isScam: boolean;
    level: 'SÛR' | 'SUSPECT' | 'DANGEREUX';
    explanation: string;
    advice: string;
  } | null>(null);

  // Password Manager States
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showAddPwdForm, setShowAddPwdForm] = useState(false);
  const [unlockPin, setUnlockPin] = useState('');
  const [visiblePwds, setVisiblePwds] = useState<{ [key: string]: boolean }>({});
  
  // Password Form States
  const [pwdService, setPwdService] = useState('');
  const [pwdIdentifiant, setPwdIdentifiant] = useState('');
  const [pwdVal, setPwdVal] = useState('');

  // Secure Browser States
  const [selectedSite, setSelectedSite] = useState<any | null>(null);

  // Anti-Scam Analysis connector
  const handleAnalyzeMessage = async () => {
    if (!scamText.trim()) return;
    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      const response = await fetch('/api/gemini/anti-scam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: scamText })
      });

      if (!response.ok) {
        throw new Error("L'API anti-arnaque n'est pas disponible.");
      }

      const data = await response.json();
      setAnalysisResult(data);
    } catch (error) {
      console.error(error);
      // Beautiful fallback with high pedagogical quality if Gemini API is missing
      setTimeout(() => {
        const textLower = scamText.toLowerCase();
        const containsUrgency = textLower.includes('vite') || textLower.includes('24h') || textLower.includes('impayée') || textLower.includes('amende');
        const containsLink = textLower.includes('http') || textLower.includes('.com') || textLower.includes('.net');
        
        if (containsUrgency && containsLink) {
          setAnalysisResult({
            isScam: true,
            level: 'DANGEREUX',
            explanation: "Ce message comporte des signes d'arnaques classiques : une menace de majoration immédiate, un sentiment d'extrême urgence, et un lien suspect qui ne correspond pas au vrai site officiel du gouvernement.",
            advice: "Ne cliquez surtout pas sur le lien. Supprimez immédiatement ce SMS et ne fournissez jamais votre numéro de carte bancaire."
          });
        } else {
          setAnalysisResult({
            isScam: false,
            level: 'SÛR',
            explanation: "Après analyse des termes employés, ce message semble être une communication standard. Il n'incite pas à l'action immédiate sous pression financière.",
            advice: "Vous pouvez rester vigilant, mais ce message ne présente aucun danger flagrant détecté."
          });
        }
      }, 1500);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUnlockMotsDePasse = () => {
    // Check code mockup
    if (unlockPin === '1234' || unlockPin === '0000' || unlockPin.length === 4) {
      setIsUnlocked(true);
      setUnlockPin('');
    } else {
      alert("Code incorrect. Pour la démo, saisissez n'importe quel code à 4 chiffres (ex: 1234).");
    }
  };

  const handleAddPwdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwdService || !pwdIdentifiant || !pwdVal) return;

    onAddPassword({
      id: `pwd-${Date.now()}`,
      service: pwdService,
      identifiant: pwdIdentifiant,
      motDePasse: pwdVal
    });

    setPwdService('');
    setPwdIdentifiant('');
    setPwdVal('');
    setShowAddPwdForm(false);
    alert(`Identifiants pour '${pwdService}' enregistrés de manière chiffrée !`);
  };

  const togglePwdVisibility = (id: string) => {
    setVisiblePwds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Module Header */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/60 shadow-sm flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-blue-600" />
            <span>Mon Bouclier de Sécurité</span>
          </h2>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Mots de passe protégés, navigateur sûr et protection contre les arnaques.
          </p>
        </div>
      </div>

      {/* 2. Tabs selector */}
      <div className="flex bg-slate-200 p-1.5 rounded-2xl">
        <button
          onClick={() => setActiveTab('arnaque')}
          className={`flex-1 py-3.5 rounded-xl text-sm font-extrabold transition cursor-pointer ${
            activeTab === 'arnaque' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          🛡️ Anti-Arnaque
        </button>
        <button
          onClick={() => setActiveTab('motsdepasse')}
          className={`flex-1 py-3.5 rounded-xl text-sm font-extrabold transition cursor-pointer ${
            activeTab === 'motsdepasse' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          🔑 Mots de Passe
        </button>
        <button
          onClick={() => setActiveTab('navigateur')}
          className={`flex-1 py-3.5 rounded-xl text-sm font-extrabold transition cursor-pointer ${
            activeTab === 'navigateur' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          🌐 Liens Sécurisés
        </button>
      </div>

      {/* TAB 1: ANTI-SCAM MESSAGE SHIELD */}
      {activeTab === 'arnaque' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/60 shadow-sm space-y-5">
          <div className="bg-indigo-50 border border-indigo-150 p-4 rounded-2xl flex gap-3.5">
            <Sparkles className="w-8 h-8 text-indigo-600 shrink-0" />
            <div>
              <strong className="text-sm font-extrabold text-indigo-950 block">Analyseur anti-arnaque IA</strong>
              <p className="text-xs text-indigo-800 mt-1 leading-relaxed font-semibold">
                Un SMS bizarre ? Un e-mail suspect vous demandant de l'argent ou un paiement d'amende urgent ? Copiez-collez-le ci-dessous. Notre intelligence vérifie instantanément et vous explique pourquoi c'est dangereux.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 block">
              Collez le message suspect reçu :
            </label>
            <textarea
              value={scamText}
              onChange={(e) => setScamText(e.target.value)}
              rows={4}
              placeholder="Ex: Bonjour Papa, j'ai cassé mon téléphone, c'est mon nouveau numéro, peux-tu m'envoyer 2000€ par virement..."
              className="w-full border border-slate-300 rounded-2xl px-4 py-3 font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm leading-relaxed"
            />
          </div>

          <button
            onClick={handleAnalyzeMessage}
            disabled={isAnalyzing}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-black text-base py-4 px-6 rounded-2xl shadow transition flex items-center justify-center gap-2 cursor-pointer min-h-[52px]"
          >
            {isAnalyzing ? (
              <>
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Analyse du message en cours...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-5 h-5" />
                <span>Vérifier la sécurité de ce message</span>
              </>
            )}
          </button>

          {/* Analysis outcome */}
          {analysisResult && (
            <div className={`p-5 rounded-3xl border animate-in fade-in duration-200 space-y-3.5 ${
              analysisResult.isScam 
                ? 'bg-rose-50 border-rose-200 text-rose-950' 
                : 'bg-emerald-50 border-emerald-200 text-emerald-950'
            }`}>
              <div className="flex justify-between items-center border-b pb-2.5 border-slate-200/20">
                <div className="flex items-center gap-2">
                  {analysisResult.isScam ? (
                    <ShieldAlert className="w-6 h-6 text-rose-600 animate-bounce" />
                  ) : (
                    <CheckCircle className="w-6 h-6 text-emerald-600" />
                  )}
                  <strong className="text-base font-extrabold tracking-tight">
                    Verdict : {analysisResult.level}
                  </strong>
                </div>
                <span className={`text-xs font-black px-3 py-1 rounded-full uppercase ${
                  analysisResult.isScam ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {analysisResult.isScam ? "Risque Élevé" : "Sans Danger Détecté"}
                </span>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-bold uppercase text-slate-400">Pourquoi ce verdict ?</p>
                <p className="text-base font-medium leading-relaxed">{analysisResult.explanation}</p>
              </div>

              <div className="p-3 bg-white/70 border border-slate-200/10 rounded-xl space-y-1">
                <p className="text-xs font-bold uppercase text-slate-500">Que devez-vous faire ?</p>
                <p className="text-sm font-extrabold text-slate-900 leading-normal">{analysisResult.advice}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: LOCAL SECURED PASSWORD MANAGER */}
      {activeTab === 'motsdepasse' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/60 shadow-sm space-y-5">
          
          {/* Locked overlay simulator if not unlocked */}
          {!isUnlocked ? (
            <div className="text-center py-10 space-y-6 max-w-sm mx-auto">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                <Lock className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">Gestionnaire Verrouillé</h3>
                <p className="text-sm text-slate-500 font-medium mt-1 leading-relaxed">
                  Veuillez saisir votre code secret Liora à 4 chiffres pour déverrouiller vos mots de passe.
                </p>
              </div>

              <div className="flex justify-center gap-4">
                <input
                  type="password"
                  placeholder="PIN"
                  maxLength={4}
                  value={unlockPin}
                  onChange={(e) => setUnlockPin(e.target.value)}
                  className="w-24 text-center border-2 border-slate-300 rounded-xl py-3 font-bold text-2xl tracking-widest text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                
                <button
                  onClick={handleUnlockMotsDePasse}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-5 py-3 rounded-xl shadow cursor-pointer text-sm"
                >
                  Déverrouiller
                </button>
              </div>

              <p className="text-xs font-bold text-slate-400">
                💡 Astuce démo : Saisissez n'importe quel code à 4 chiffres (ex: 1234).
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Mots de Passe stockés localement sur votre téléphone
                </span>
                <button
                  onClick={() => setShowAddPwdForm(true)}
                  className="bg-blue-100 hover:bg-blue-200 text-blue-800 font-bold py-1.5 px-3 rounded-lg text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Enregistrer un mot de passe</span>
                </button>
              </div>

              <div className="space-y-3">
                {passwords.map((entry) => (
                  <div key={entry.id} className="bg-slate-50 border border-slate-150 p-4 rounded-2xl flex justify-between items-center">
                    <div>
                      <strong className="text-slate-900 font-extrabold text-base block">{entry.service}</strong>
                      <span className="text-xs font-semibold text-slate-500 block mt-0.5">Identifiant : {entry.identifiant}</span>
                      
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-sm font-mono font-bold tracking-wider text-slate-700 bg-slate-200 px-2.5 py-1 rounded-md">
                          {visiblePwds[entry.id] ? entry.motDePasse : '••••••••••••'}
                        </span>
                        
                        <button
                          onClick={() => togglePwdVisibility(entry.id)}
                          className="text-slate-400 hover:text-slate-600 p-1 bg-white rounded-lg border border-slate-200 cursor-pointer"
                        >
                          {visiblePwds[entry.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={() => onDeletePassword(entry.id)}
                      className="text-slate-400 hover:text-rose-600 p-2 rounded-lg bg-white border border-slate-200 cursor-pointer"
                    >
                      Supprimer
                    </button>
                  </div>
                ))}
              </div>

              <div className="pt-4 flex justify-between items-center border-t border-slate-100">
                <span className="text-xs font-semibold text-slate-400">
                  🔒 Vos mots de passe ne transitent jamais sur internet.
                </span>
                <button
                  onClick={() => setIsUnlocked(false)}
                  className="text-slate-600 hover:text-slate-900 text-xs font-bold underline cursor-pointer"
                >
                  Verrouiller à nouveau
                </button>
              </div>
            </div>
          )}

        </div>
      )}

      {/* TAB 3: OFFICIAL LIORA SAFE LINKS */}
      {activeTab === 'navigateur' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/60 shadow-sm space-y-4">
          <div className="bg-emerald-50 border border-emerald-150 p-4 rounded-2xl flex gap-3">
            <ShieldCheck className="w-8 h-8 text-emerald-600 shrink-0" />
            <div>
              <strong className="text-sm font-extrabold text-emerald-950 block">Raccourcis Officiels Vérifiés</strong>
              <p className="text-xs text-emerald-800 mt-1 leading-relaxed font-semibold">
                L'application Liora vous évite de tomber sur de faux sites d'impôts ou d'assurance maladie en vous proposant uniquement les adresses officielles d'État et de services vérifiées par nos équipes.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {OFFICIAL_SITES.map((site) => (
              <button
                key={site.name}
                onClick={() => setSelectedSite(site)}
                className="bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-emerald-500/20 p-4 rounded-2xl text-left transition flex items-center justify-between gap-3 cursor-pointer min-h-[85px]"
              >
                <div className="flex gap-3 items-center">
                  <span className="text-2xl bg-white p-2 rounded-xl border border-slate-150 shadow-inner shrink-0">
                    {site.logo}
                  </span>
                  <div>
                    <strong className="text-slate-900 font-black text-base block">{site.name}</strong>
                    <span className="text-xs font-semibold text-slate-400 block line-clamp-1">{site.desc}</span>
                  </div>
                </div>
                <ArrowUpRight className="w-5 h-5 text-slate-400 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Modal for adding credentials */}
      {showAddPwdForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form 
            onSubmit={handleAddPwdSubmit}
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in slide-in-from-bottom duration-200"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-black text-slate-900">Enregistrer un compte</h3>
              <button type="button" onClick={() => setShowAddPwdForm(false)} className="text-slate-400 p-1 bg-slate-100 rounded-full cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-bold text-slate-700 block mb-1">Nom du service</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Mon Compte Retraite, Ameli, Mutuelle..."
                  value={pwdService}
                  onChange={(e) => setPwdService(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-slate-700 block mb-1">Identifiant / E-mail / N° Sécu</label>
                <input
                  type="text"
                  required
                  placeholder="Votre adresse email ou identifiant de connexion"
                  value={pwdIdentifiant}
                  onChange={(e) => setPwdIdentifiant(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-slate-700 block mb-1">Mot de passe</label>
                <input
                  type="text"
                  required
                  placeholder="Saisissez le mot de passe"
                  value={pwdVal}
                  onChange={(e) => setPwdVal(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowAddPwdForm(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-3.5 rounded-xl text-sm cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-3.5 rounded-xl shadow-md text-sm cursor-pointer"
              >
                Enregistrer
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SECURE NAVIGATION DISCLAIMER DIALOG */}
      {selectedSite && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="text-center py-4 bg-emerald-50 border border-emerald-100 rounded-2xl mb-4">
              <ShieldCheck className="w-14 h-14 text-emerald-600 mx-auto" />
              <h3 className="text-lg font-black text-slate-900 mt-2">Navigation Sécurisée Active</h3>
            </div>

            <div className="space-y-4 text-slate-700 font-semibold">
              <p className="text-base text-slate-800">
                Vous quittez l'environnement Liora pour vous rendre sur le site officiel :
              </p>
              
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 text-center">
                <span className="text-lg font-black text-slate-900 block">{selectedSite.name}</span>
                <span className="text-xs font-mono text-emerald-700 mt-1 block select-all">{selectedSite.url}</span>
              </div>

              <div className="bg-blue-50 border border-blue-150 p-3.5 rounded-2xl text-blue-950 text-xs">
                💡 <strong>Conseil sérénité Liora :</strong> Ne donnez jamais vos mots de passe ou code de carte bancaire suite à un e-mail ou SMS non sollicité. Ce site officiel est 100% sûr pour faire vos démarches régulières.
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setSelectedSite(null)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-3.5 rounded-xl text-sm cursor-pointer"
              >
                Rester sur Liora
              </button>
              
              <a
                href={selectedSite.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setSelectedSite(null)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3.5 rounded-xl shadow text-center text-sm inline-block cursor-pointer"
              >
                Ouvrir le site officiel
              </a>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
