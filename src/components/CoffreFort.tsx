import React, { useState } from 'react';
import { SecureDocument } from '../types';
import { FolderLock, Plus, FileText, Share2, Check, Download, Camera, ShieldCheck, Search, History, Eye, X } from 'lucide-react';

interface CoffreFortProps {
  documents: SecureDocument[];
  onAddDocument: (doc: SecureDocument) => void;
  onToggleShare: (id: string) => void;
  onDeleteDocument: (id: string) => void;
}

export default function CoffreFort({ documents, onAddDocument, onToggleShare, onDeleteDocument }: CoffreFortProps) {
  const [activeCategory, setActiveCategory] = useState<string>('tous');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<SecureDocument | null>(null);
  
  // OCR & Upload States
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState<1 | 2 | 3>(1); // 1: choose, 2: scan animation/cropper, 3: OCR edit
  const [showScanModal, setShowScanModal] = useState(false);

  // Scan OCR Form States (editable before confirmation)
  const [scannedTitre, setScannedTitre] = useState('');
  const [scannedCat, setScannedCat] = useState<'santé' | 'assurance' | 'contrat' | 'facture' | 'administratif'>('administratif');

  // Logs for access tracking
  const [accessHistory, setAccessHistory] = useState([
    { id: '1', date: "Hier à 14:15", acteur: "Sophie Bernard (Fille)", action: "A téléchargé 'Attestation de Mutuelle 2026'" },
    { id: '2', date: "Le 30/06/2026 à 10:22", acteur: "Vous-même", action: "A ajouté le document 'Justificatif de Domicile EDF'" },
    { id: '3', date: "Le 28/06/2026 à 11:05", acteur: "Jean-Marc Dupond (Fils)", action: "Tentative d'accès bloquée (Pas de permission pour ce document)" }
  ]);

  const categories = ['tous', 'santé', 'assurance', 'contrat', 'facture', 'administratif'];

  const filteredDocs = documents.filter(doc => {
    const matchesCategory = activeCategory === 'tous' || doc.categorie === activeCategory;
    const matchesSearch = doc.titre.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleStartScan = () => {
    setShowScanModal(true);
    setScanStep(1);
    setIsScanning(false);
  };

  const handleTriggerOcr = () => {
    setIsScanning(true);
    // Simulate smart OCR & crop border detection
    setTimeout(() => {
      setIsScanning(false);
      setScannedTitre("Avis d'Imposition Simplifié 2025");
      setScannedCat('administratif');
      setScanStep(3); // Go to editable fields step
    }, 2500);
  };

  const handleSaveScannedDoc = () => {
    const newDoc: SecureDocument = {
      id: `doc-${Date.now()}`,
      titre: scannedTitre || "Document numérisé",
      categorie: scannedCat,
      dateAjout: new Date().toISOString().split('T')[0],
      urlSimulee: "Document_Numerise_Liora.pdf",
      partageSelectif: false
    };

    onAddDocument(newDoc);
    
    // Add log
    setAccessHistory([
      { id: Date.now().toString(), date: "À l'instant", acteur: "Vous-même", action: `A numérisé le document '${newDoc.titre}'` },
      ...accessHistory
    ]);

    setShowScanModal(false);
    alert(`Votre document '${newDoc.titre}' a été chiffré et stocké dans votre Coffre-fort avec succès !`);
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'santé': return 'text-rose-600 bg-rose-50 border-rose-100';
      case 'assurance': return 'text-emerald-600 bg-emerald-50 border-emerald-100';
      case 'contrat': return 'text-blue-600 bg-blue-50 border-blue-100';
      case 'facture': return 'text-purple-600 bg-purple-50 border-purple-100';
      default: return 'text-amber-600 bg-amber-50 border-amber-100';
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Header with Scan trigger */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/60 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <FolderLock className="w-6 h-6 text-emerald-600" />
            <span>Coffre-fort Sérénité</span>
          </h2>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Numérisez, chiffrez et stockez vos papiers importants en toute sérénité.
          </p>
        </div>
        
        <button
          onClick={handleStartScan}
          id="coffre-scan-btn"
          className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-4.5 py-3 rounded-2xl flex items-center justify-center gap-2 transition text-base shadow cursor-pointer min-h-[48px]"
        >
          <Camera className="w-5 h-5" />
          <span>Scanner un document</span>
        </button>
      </div>

      {/* 2. Security trust warning */}
      <div className="bg-slate-900 text-slate-300 p-4.5 rounded-3xl flex gap-3.5 border border-slate-800 shadow-md">
        <ShieldCheck className="w-8 h-8 text-emerald-400 shrink-0" />
        <div className="text-sm font-semibold">
          <p className="text-white font-bold text-base">Chiffrement de bout en bout actif</p>
          <p className="mt-0.5 text-slate-400">
            Liora stocke vos documents de manière ultra-sécurisée. Aucun proche n'a accès à un document sans que vous n'ayez activé le bouton de partage familial.
          </p>
        </div>
      </div>

      {/* Search and Category filter */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="w-5 h-5 text-slate-400 absolute left-4 top-3.5" />
          <input
            type="text"
            placeholder="Rechercher un document par mot-clé..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-base"
          />
        </div>

        {/* Categories Carousel */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4.5 py-2 rounded-full text-sm font-extrabold capitalize transition shrink-0 cursor-pointer ${
                activeCategory === cat
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-150'
              }`}
            >
              {cat === 'tous' ? '📁 Tous' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Document list display */}
      <div className="space-y-3">
        {filteredDocs.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-slate-200/60">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-lg font-bold text-slate-700">Aucun document trouvé</p>
            <p className="text-sm text-slate-400 mt-1">Modifiez vos filtres ou ajoutez/scannez un document.</p>
          </div>
        ) : (
          filteredDocs.map((doc) => (
            <div
              key={doc.id}
              className="bg-white rounded-3xl p-4.5 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-emerald-500/30 transition"
            >
              <div 
                className="flex gap-3.5 items-start cursor-pointer flex-1"
                onClick={() => setSelectedDoc(doc)}
              >
                <div className={`p-3 rounded-2xl border ${getCategoryColor(doc.categorie)}`}>
                  <FileText className="w-6 h-6" />
                </div>
                
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight leading-tight">
                    {doc.titre}
                  </h3>
                  <div className="flex items-center gap-2 mt-1.5 text-xs font-semibold text-slate-400">
                    <span className="uppercase">{doc.categorie}</span>
                    <span>•</span>
                    <span>Ajouté le {doc.dateAjout}</span>
                  </div>
                </div>
              </div>

              {/* Action columns */}
              <div className="flex items-center gap-2 justify-between border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                <button
                  onClick={() => onToggleShare(doc.id)}
                  className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold transition border cursor-pointer min-h-[40px] ${
                    doc.partageSelectif 
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                  title="Partager ce document avec mes proches de confiance"
                >
                  <Share2 className="w-4 h-4" />
                  <span>{doc.partageSelectif ? "Partagé famille" : "Privé (cliquer)"}</span>
                </button>
                
                <button
                  onClick={() => {
                    alert(`Téléchargement sécurisé simulé de '${doc.urlSimulee}'...`);
                  }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2.5 rounded-xl cursor-pointer min-h-[40px] flex items-center justify-center"
                  title="Télécharger le document"
                >
                  <Download className="w-4.5 h-4.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 4. Transparency tracking logs */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/60 shadow-sm space-y-3.5">
        <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
          <History className="w-5 h-5 text-emerald-600" />
          <span>Journal d'accès à vos documents (Transparence)</span>
        </h3>
        
        <p className="text-xs font-semibold text-slate-500">
          Pour votre tranquillité d'esprit, Liora garde une trace infalsifiable de chaque consultation de document.
        </p>

        <div className="space-y-3 divide-y divide-slate-150">
          {accessHistory.map((item) => (
            <div key={item.id} className="pt-2.5 text-sm font-semibold flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
              <div>
                <span className="text-slate-800">{item.action}</span>
                <span className="text-xs font-bold text-slate-400 block sm:inline sm:ml-2">Par {item.acteur}</span>
              </div>
              <span className="text-xs font-bold text-slate-400 shrink-0">{item.date}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Detail overlay modal */}
      {selectedDoc && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-start mb-4">
              <span className={`px-2.5 py-1 text-xs font-extrabold rounded-full uppercase border ${getCategoryColor(selectedDoc.categorie)}`}>
                {selectedDoc.categorie}
              </span>
              <button 
                onClick={() => setSelectedDoc(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 bg-slate-100 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-center py-4 bg-slate-50 border border-slate-100 rounded-2xl mb-4">
              <FileText className="w-16 h-16 text-emerald-600 mx-auto" />
              <h3 className="text-lg font-black text-slate-900 mt-2">{selectedDoc.titre}</h3>
              <p className="text-xs font-semibold text-slate-400 mt-1">Fichier : {selectedDoc.urlSimulee}</p>
            </div>

            <div className="space-y-3.5">
              <div className="flex justify-between items-center text-sm font-bold text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span>Date d'enregistrement</span>
                <span className="text-slate-900">{selectedDoc.dateAjout}</span>
              </div>

              <div className="flex justify-between items-center text-sm font-bold text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span>Partage familial activé</span>
                <span className={selectedDoc.partageSelectif ? "text-emerald-700" : "text-slate-500"}>
                  {selectedDoc.partageSelectif ? "Oui — Sophie / Jean-Marc" : "Non — Document Privé"}
                </span>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  onDeleteDocument(selectedDoc.id);
                  setSelectedDoc(null);
                }}
                className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold py-3.5 rounded-xl text-sm cursor-pointer border border-rose-100"
              >
                Supprimer
              </button>
              <button
                onClick={() => {
                  alert("Simulation de l'impression sans fil sécurisée...");
                }}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-3.5 rounded-xl text-sm cursor-pointer"
              >
                Imprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SCANNER CAMERA INTERACTIVE SIMULATOR */}
      {showScanModal && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in duration-200">
            
            {/* Step 1: Scanner introduction and file selection */}
            {scanStep === 1 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-1">
                  <h3 className="text-xl font-black text-slate-900">Numériser un document</h3>
                  <button onClick={() => setShowScanModal(false)} className="text-slate-400 p-1.5 bg-slate-100 rounded-full cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="bg-emerald-50 text-emerald-950 p-4 rounded-2xl text-center">
                  <Camera className="w-12 h-12 text-emerald-600 mx-auto mb-2" />
                  <p className="text-base font-extrabold">Prendre une photo de votre document</p>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Cadrez bien votre document. L'application Liora découpera automatiquement les bords et optimisera le contraste pour une lisibilité parfaite.
                  </p>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={() => {
                      setScanStep(2);
                      handleTriggerOcr();
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-4 rounded-xl shadow cursor-pointer text-base"
                  >
                    Activer l'appareil photo de l'appli
                  </button>
                  <button
                    onClick={() => {
                      setScannedTitre("Contrat Assurance Prévoyance AXA");
                      setScannedCat('assurance');
                      setScanStep(3);
                    }}
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-3.5 rounded-xl text-sm cursor-pointer"
                  >
                    Choisir un fichier depuis mon téléphone
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Camera View Simulation / Edge Detection cropper */}
            {scanStep === 2 && (
              <div className="space-y-4 text-center">
                <div className="relative w-full aspect-[3/4] bg-slate-950 rounded-2xl overflow-hidden border-2 border-slate-800 flex items-center justify-center">
                  {/* Glowing camera lens / scan animation lines */}
                  <div className="absolute inset-0 bg-emerald-500/10 flex flex-col justify-between p-6">
                    {/* Simulated Camera Border corners */}
                    <div className="flex justify-between">
                      <div className="w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                      <div className="w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                    </div>

                    {/* Laser line moving */}
                    <div className="w-full h-1 bg-emerald-400 shadow-md shadow-emerald-400/80 animate-bounce" />

                    <div className="flex justify-between">
                      <div className="w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                      <div className="w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />
                    </div>
                  </div>

                  <div className="text-center text-slate-400 z-10 p-4">
                    <Camera className="w-10 h-10 mx-auto text-emerald-400 mb-2 animate-pulse" />
                    <p className="text-base font-black text-white">Cadrage Intelligent actif</p>
                    <p className="text-xs text-slate-400 mt-1">Maintenez votre appareil stable...</p>
                    {isScanning && (
                      <span className="inline-block bg-emerald-600/90 text-white text-xs px-3 py-1.5 rounded-full mt-4 font-bold animate-pulse">
                        Lecture du texte (OCR) par Liora AI...
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setScanStep(1)}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-3 rounded-xl text-sm cursor-pointer"
                >
                  Retour
                </button>
              </div>
            )}

            {/* Step 3: Editable OCR result proposal before saving */}
            {scanStep === 3 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-150">
                  <h4 className="text-lg font-black text-slate-900">Document Détecté</h4>
                  <span className="bg-emerald-100 text-emerald-800 text-xs font-extrabold px-2.5 py-0.5 rounded-full">
                    Aperçu OCR
                  </span>
                </div>

                <div className="space-y-3.5">
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">Nom du document (modifiable)</label>
                    <input
                      type="text"
                      value={scannedTitre}
                      onChange={(e) => setScannedTitre(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl px-4 py-3 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-base"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">Classer dans la Catégorie</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['santé', 'assurance', 'contrat', 'facture', 'administratif'].map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setScannedCat(cat as any)}
                          className={`py-2 px-3 rounded-xl border text-xs font-extrabold transition capitalize cursor-pointer ${
                            scannedCat === cat
                              ? 'bg-emerald-600 border-emerald-600 text-white shadow'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-emerald-50 border border-emerald-150 p-3.5 rounded-2xl flex gap-2.5 text-emerald-950 text-xs font-semibold">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>Ce document sera chiffré dans votre téléphone de manière ultra-sécurisée.</span>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setScanStep(1)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-3.5 rounded-xl text-sm cursor-pointer"
                  >
                    Recommencer
                  </button>
                  <button
                    onClick={handleSaveScannedDoc}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3.5 rounded-xl shadow-md text-sm cursor-pointer"
                  >
                    Enregistrer
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
