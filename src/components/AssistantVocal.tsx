import React, { useState } from 'react';
import { MessageSquare, Mic, Sparkles, Send, Volume2, HelpCircle } from 'lucide-react';

export default function AssistantVocal() {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<{ sender: 'user' | 'liora'; text: string }[]>([
    { sender: 'liora', text: "Bonjour ! Je suis Liora, votre assistant de sérénité. Je peux lire votre agenda, vous guider pour respirer ou simplement discuter. Que puis-je faire pour vous ?" }
  ]);
  const [isRecording, setIsRecording] = useState(false);

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || query;
    if (!textToSend.trim()) return;

    // Add user message to chat list
    const updatedMessages = [...messages, { sender: 'user' as const, text: textToSend }];
    setMessages(updatedMessages);
    setQuery('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/gemini/voice-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: textToSend })
      });

      if (!response.ok) {
        throw new Error("Erreur de communication.");
      }

      const data = await response.json();
      setMessages([...updatedMessages, { sender: 'liora' as const, text: data.responseText }]);
    } catch (err) {
      console.error(err);
      // Gentle offline/fallback responses
      setTimeout(() => {
        setMessages([
          ...updatedMessages,
          { 
            sender: 'liora' as const, 
            text: "Désolée, je n'ai pas pu joindre mon serveur d'intelligence vocale. Mais je suis toujours là si besoin. N'hésitez pas à revoir vos documents ou appeler vos proches !" 
          }
        ]);
      }, 1000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSimulateVoice = () => {
    setIsRecording(true);
    // Simulate speaking after 3 seconds
    setTimeout(() => {
      setIsRecording(false);
      handleSendMessage("Liora, conseille-moi une respiration guidée");
    }, 2500);
  };

  const suggestions = [
    "Montre-moi mon agenda de demain.",
    "J'ai pris mes médicaments ?",
    "Comment puis-je me protéger des SMS suspects ?",
    "Conseille-moi une respiration douce."
  ];

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/60 shadow-sm">
        <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-indigo-600 animate-pulse" />
          <span>L'Assistant Vocal Liora</span>
        </h2>
        <p className="text-sm font-medium text-slate-500 mt-1">
          Parlez ou écrivez naturellement à Liora pour vous organiser.
        </p>
      </div>

      {/* 2. LIVE CHAT STREAM */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-inner h-80 overflow-y-auto space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex flex-col max-w-[85%] ${msg.sender === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'}`}
          >
            <div className={`p-4 rounded-2xl text-sm font-semibold leading-relaxed shadow-sm ${
              msg.sender === 'user'
                ? 'bg-indigo-600 text-white rounded-tr-none'
                : 'bg-slate-50 border border-slate-150 text-slate-900 rounded-tl-none'
            }`}>
              <p>{msg.text}</p>
            </div>
            <span className="text-[10px] font-bold text-slate-400 mt-1 uppercase">
              {msg.sender === 'user' ? "Vous" : "Liora AI"}
            </span>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2 items-center text-slate-400 text-xs font-bold animate-pulse pl-1.5">
            <Sparkles className="w-4 h-4 text-indigo-500 animate-spin" />
            <span>Liora réfléchit...</span>
          </div>
        )}
      </div>

      {/* 3. SIMULATE MIC RECORDING */}
      <div className="bg-slate-900 text-white rounded-3xl p-5 border border-slate-800 text-center space-y-4">
        {!isRecording ? (
          <div className="flex flex-col items-center space-y-3.5">
            <button
              onClick={handleSimulateVoice}
              className="bg-indigo-600 hover:bg-indigo-700 text-white p-5 rounded-full shadow-lg transition hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center animate-none"
            >
              <Mic className="w-8 h-8" />
            </button>
            <div>
              <strong className="text-base font-black text-white">Appuyez sur le micro pour me parler</strong>
              <p className="text-xs text-slate-400 mt-1">Dites par exemple : "Liora, quel est mon prochain rendez-vous ?"</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-4 py-2">
            {/* Pulsing speech waves */}
            <div className="flex gap-1.5 items-end h-10 shrink-0 justify-center">
              <span className="w-1.5 bg-indigo-400 h-6 rounded-full animate-bounce [animation-delay:0.1s]" />
              <span className="w-1.5 bg-indigo-400 h-9 rounded-full animate-bounce [animation-delay:0.3s]" />
              <span className="w-1.5 bg-indigo-400 h-5 rounded-full animate-bounce [animation-delay:0.5s]" />
              <span className="w-1.5 bg-indigo-400 h-8 rounded-full animate-bounce [animation-delay:0.2s]" />
              <span className="w-1.5 bg-indigo-400 h-4 rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>

            <div>
              <strong className="text-base font-black text-white">Liora écoute votre voix...</strong>
              <p className="text-xs text-indigo-300 mt-1 font-bold">"Liora, conseille-moi une respiration..."</p>
            </div>

            <button
              onClick={() => setIsRecording(false)}
              className="text-xs text-rose-400 font-bold underline cursor-pointer"
            >
              Annuler l'enregistrement
            </button>
          </div>
        )}
      </div>

      {/* SUGGESTIONS PILLS */}
      <div className="space-y-2">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block px-1 flex items-center gap-1">
          <HelpCircle className="w-4 h-4 text-slate-400" />
          <span>Idées de questions à poser à Liora :</span>
        </span>
        
        <div className="flex flex-wrap gap-2">
          {suggestions.map((sug, i) => (
            <button
              key={i}
              onClick={() => handleSendMessage(sug)}
              className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-semibold py-2 px-3.5 rounded-xl text-xs transition cursor-pointer text-left shadow-sm min-h-[38px]"
            >
              💡 {sug}
            </button>
          ))}
        </div>
      </div>

      {/* TEXT FALLBACK INPUT */}
      <div className="bg-white rounded-2xl border border-slate-200 p-2.5 flex items-center gap-2">
        <input
          type="text"
          placeholder="Écrivez votre message ici..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          className="flex-1 bg-transparent px-3 py-2 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none"
        />
        <button
          onClick={() => handleSendMessage()}
          className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-xl transition cursor-pointer"
        >
          <Send className="w-4.5 h-4.5" />
        </button>
      </div>

    </div>
  );
}
