import React, { useState } from 'react';
import { Heart, UserCheck, ShieldCheck, KeyRound, ArrowRight } from 'lucide-react';

interface OnboardingProps {
  onComplete: (role: 'senior' | 'proche') => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedRole, setSelectedRole] = useState<'senior' | 'proche'>('senior');
  const [pin, setPin] = useState<string>('');

  const handleRoleSelection = (role: 'senior' | 'proche') => {
    setSelectedRole(role);
    setStep(2);
  };

  const handlePinKey = (num: string) => {
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      if (newPin.length === 4) {
        // Automatically progress to summary screen before entering app
        setTimeout(() => setStep(3), 400);
      }
    }
  };

  const handleClearPin = () => {
    setPin('');
  };

  return (
    <div className="w-full h-full bg-slate-50 flex flex-col justify-between overflow-y-auto">
      
      {/* Step 1: Welcome & Role selection */}
      {step === 1 && (
        <div className="p-8 flex-1 flex flex-col justify-between text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full blur-3xl opacity-60 -z-10 -mt-10 -mr-10"></div>
          <div className="mt-8">
            <div className="w-20 h-20 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto shadow-sm rotate-3 mb-6 relative">
              <div className="absolute inset-0 bg-white rounded-2xl -rotate-6 shadow-sm border border-emerald-100/50 flex items-center justify-center">
                <Heart className="w-10 h-10 text-emerald-500 fill-emerald-500" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight leading-tight">
              Bienvenue chez <span className="text-emerald-600">Liora</span>
            </h1>
            <p className="text-slate-500 mt-3 text-[13px] font-medium leading-relaxed max-w-xs mx-auto">
              Votre compagnon de confiance pour organiser votre quotidien en toute sérénité.
            </p>
          </div>

          <div className="my-8 space-y-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
              Qui va utiliser l'application ?
            </span>
            
            <button
              id="role-senior-btn"
              onClick={() => handleRoleSelection('senior')}
              className="w-full bg-white hover:bg-slate-50 text-slate-800 font-bold py-4 px-5 rounded-2xl border border-slate-200 hover:border-emerald-500/50 active:scale-[0.98] transition duration-150 flex items-center justify-between text-left shadow-sm cursor-pointer min-h-[70px] group"
            >
              <div>
                <span className="text-sm block font-bold text-slate-800">Je suis Senior Actif</span>
                <span className="text-[11px] font-medium text-slate-500 mt-0.5 block">Pour organiser mon agenda, mon coffre-fort et me protéger.</span>
              </div>
              <div className="bg-emerald-50 text-emerald-600 p-2 rounded-xl group-hover:scale-105 transition-transform shrink-0 ml-3">
                <UserCheck className="w-5 h-5" />
              </div>
            </button>

            <button
              id="role-proche-btn"
              onClick={() => handleRoleSelection('proche')}
              className="w-full bg-white hover:bg-slate-50 text-slate-800 font-bold py-4 px-5 rounded-2xl border border-slate-200 hover:border-indigo-500/50 active:scale-[0.98] transition duration-150 flex items-center justify-between text-left shadow-sm cursor-pointer min-h-[70px] group"
            >
              <div>
                <span className="text-sm block font-bold text-slate-800">Je suis un Proche</span>
                <span className="text-[11px] font-medium text-slate-500 mt-0.5 block">Pour accompagner un parent en toute confiance.</span>
              </div>
              <div className="bg-indigo-50 text-indigo-600 p-2 rounded-xl group-hover:scale-105 transition-transform shrink-0 ml-3">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </button>
          </div>

          <div className="text-[10px] font-semibold text-slate-400 pb-2">
            Liora garantit la confidentialité absolue de vos données.
          </div>
        </div>
      )}

      {/* Step 2: Simplified Pin setup */}
      {step === 2 && (
        <div className="p-8 flex-1 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full blur-3xl opacity-60 -z-10 -mt-10 -mr-10"></div>
          <div className="text-center mt-6">
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">
              Créer votre code secret
            </h2>
            <p className="text-slate-500 text-[13px] mt-2 font-medium max-w-xs mx-auto">
              Ce code à 4 chiffres sécurise l'accès à vos documents.
            </p>

            {/* Display code dots */}
            <div className="flex justify-center gap-4 my-8">
              {[0, 1, 2, 3].map((index) => (
                <div
                  key={index}
                  className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${
                    pin.length > index ? 'bg-emerald-500 border-emerald-500 scale-110' : 'bg-transparent border-slate-300'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Simple Grid numeric keypad */}
          <div className="max-w-[260px] mx-auto w-full grid grid-cols-3 gap-3 mb-8">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
              <button
                key={num}
                id={`pin-btn-${num}`}
                onClick={() => handlePinKey(num)}
                className="bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xl py-4 rounded-full border border-slate-200 shadow-sm active:scale-95 transition-all flex items-center justify-center cursor-pointer"
              >
                {num}
              </button>
            ))}
            <button
              onClick={handleClearPin}
              className="bg-slate-100/50 hover:bg-slate-100 text-slate-500 font-semibold text-xs py-4 rounded-full active:scale-95 transition-all flex items-center justify-center cursor-pointer"
            >
              Effacer
            </button>
            <button
              onClick={() => handlePinKey('0')}
              className="bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xl py-4 rounded-full border border-slate-200 shadow-sm active:scale-95 transition-all flex items-center justify-center cursor-pointer"
            >
              0
            </button>
            <button
              onClick={() => {
                // Biometrics mockup
                setPin('1234');
                setTimeout(() => setStep(3), 400);
              }}
              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-600 font-semibold text-[10px] py-2 rounded-full active:scale-95 transition-all flex flex-col items-center justify-center cursor-pointer border border-emerald-100/50"
            >
              <KeyRound className="w-4 h-4 mb-0.5 text-emerald-500" />
              <span>Face ID</span>
            </button>
          </div>

          <div className="text-center text-[11px] font-semibold text-slate-400 pb-2">
            Liora utilise la biométrie de votre téléphone.
          </div>
        </div>
      )}

      {/* Step 3: Success and ready */}
      {step === 3 && (
        <div className="p-8 flex-1 flex flex-col justify-between text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full blur-3xl opacity-60 -z-10 -mt-10 -mr-10"></div>
          <div className="my-auto space-y-6">
            <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto shadow-sm rotate-3 relative">
              <div className="absolute inset-0 bg-emerald-50 rounded-2xl -rotate-6 shadow-sm border border-emerald-100 flex items-center justify-center">
                <ShieldCheck className="w-8 h-8 text-emerald-600" />
              </div>
            </div>
            
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
              Profil configuré !
            </h2>
            
            <p className="text-slate-500 text-[13px] font-medium leading-relaxed max-w-xs mx-auto">
              {selectedRole === 'senior' 
                ? "Votre espace Liora est prêt. Vous gardez le contrôle total sur vos données à chaque instant."
                : "Votre accès Proche est prêt. Vous pourrez accompagner votre proche dans ses démarches en accord complet avec lui."
              }
            </p>

            <div className="bg-amber-50/50 border border-amber-100 p-3 rounded-2xl text-left text-amber-900 text-[11px] font-medium leading-relaxed">
              💡 <strong>Rappel :</strong> Votre proche ne peut pas modifier vos informations ou accéder à vos documents sans votre autorisation explicite depuis votre écran "Mes Proches".
            </div>
          </div>

          <button
            id="onboarding-complete-btn"
            onClick={() => onComplete(selectedRole)}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 px-6 rounded-full transition duration-150 flex items-center justify-center gap-2 shadow-md cursor-pointer text-sm mb-4"
          >
            <span>Accéder à mon espace</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

    </div>
  );
}
