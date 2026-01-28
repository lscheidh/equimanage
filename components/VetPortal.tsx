
import React from 'react';

export const VetPortal: React.FC = () => {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Tierärztliches Kontrollzentrum</h1>
        <p className="text-slate-500">Kundenverwaltung und Terminmanagement.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
              Smarte Route für heute
            </h3>
            <div className="aspect-video bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 border border-slate-200 relative overflow-hidden">
               <img src="https://picsum.photos/seed/map/800/450" className="w-full h-full object-cover opacity-50 grayscale" alt="Karte" />
               <div className="absolute inset-0 flex items-center justify-center text-center px-4">
                  <span className="bg-white px-4 py-2 rounded-lg shadow-lg font-semibold text-slate-800">Karten-Interface (Integrations-Mockup)</span>
               </div>
            </div>
            
            <div className="mt-4 space-y-2">
               <div className="p-3 bg-slate-50 rounded-lg flex justify-between items-center">
                  <div className="flex items-center gap-3">
                     <span className="w-6 h-6 bg-slate-800 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
                     <div>
                        <p className="text-sm font-bold">Reitstall "Grüne Wiese"</p>
                        <p className="text-xs text-slate-500">09:00 Uhr • 3 Impfungen</p>
                     </div>
                  </div>
                  <span className="text-xs font-semibold text-emerald-600">Pünktlich</span>
               </div>
               <div className="p-3 bg-slate-50 rounded-lg flex justify-between items-center">
                  <div className="flex items-center gap-3">
                     <span className="w-6 h-6 bg-slate-800 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                     <div>
                        <p className="text-sm font-bold">Gestüt "Königseichen"</p>
                        <p className="text-xs text-slate-500">11:30 Uhr • 1 Notfall</p>
                     </div>
                  </div>
                  <span className="text-xs font-semibold text-amber-600">Hohe Priorität</span>
               </div>
            </div>
          </div>

          <div className="bg-emerald-900 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
             <div className="relative z-10">
                <h3 className="text-xl font-bold mb-2">Umsatzpotential durch Sammeltermine</h3>
                <p className="text-emerald-100 text-sm mb-6">5 Pferde im Reitstall "Grüne Wiese" sind in den nächsten 14 Tagen für Impfungen fällig.</p>
                <button className="bg-white text-emerald-900 px-6 py-2 rounded-xl font-bold hover:bg-emerald-50 transition-colors">
                  Alle Besitzer benachrichtigen
                </button>
             </div>
             <svg className="absolute top-0 right-0 w-48 h-48 text-emerald-800 -mr-12 -mt-12 opacity-50" fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" /></svg>
          </div>
        </div>

        <div className="space-y-6">
           <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="font-bold text-slate-800 mb-4">Praxis-Effizienz</h3>
              <div className="space-y-4">
                 <div className="p-4 bg-slate-50 rounded-xl">
                    <p className="text-xs text-slate-500 font-bold uppercase mb-1">Zeitersparnis (Routing)</p>
                    <p className="text-3xl font-bold text-slate-900">4.2h <span className="text-sm font-medium text-emerald-600">+12%</span></p>
                 </div>
                 <div className="p-4 bg-slate-50 rounded-xl">
                    <p className="text-xs text-slate-500 font-bold uppercase mb-1">Durchschn. Umsatz / Stopp</p>
                    <p className="text-3xl font-bold text-slate-900">€245 <span className="text-sm font-medium text-emerald-600">+8%</span></p>
                 </div>
              </div>
           </div>

           <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="font-bold text-slate-800 mb-4">Anstehende Aufnahmen</h3>
              <div className="space-y-3">
                 <div className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer">
                    <img src="https://picsum.photos/seed/h1/40/40" className="w-10 h-10 rounded-full" alt="Pferd" />
                    <div>
                       <p className="text-sm font-bold">Starlight Dream</p>
                       <p className="text-[10px] text-slate-500">Aufnahmeformular ausgefüllt</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer">
                    <img src="https://picsum.photos/seed/h2/40/40" className="w-10 h-10 rounded-full" alt="Pferd" />
                    <div>
                       <p className="text-sm font-bold">Quicksilver</p>
                       <p className="text-[10px] text-rose-500">Wartet auf Historien-Upload</p>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
