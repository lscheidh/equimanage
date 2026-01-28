
import React, { useState, useRef, useEffect } from 'react';
import { UserView, Horse, ComplianceStatus, Vaccination, ServiceRecord, ServiceType } from './types';
import { MOCK_HORSES } from './data';
import { HealthDashboard } from './components/HealthDashboard';
import { ActionDashboard } from './components/ActionDashboard';
import { HorseDetails } from './components/HorseDetails';
import { VetPortal } from './components/VetPortal';
import { checkFEICompliance, checkHoofCareStatus } from './logic';

type ProfileSubView = 'stableOverview' | 'profile' | 'settings' | 'dashboard';
type AuthState = 'LANDING' | 'LOGIN' | 'REGISTER_CHOICE' | 'REGISTER_OWNER' | 'REGISTER_VET' | 'AUTHENTICATED';

const EXISTING_STABLES = [
  { id: 's1', name: 'Reitstall Grüne Wiese', zip: '12345' },
  { id: 's2', name: 'Gut Sonnenhof', zip: '12345' },
];

const App: React.FC = () => {
  const [authState, setAuthState] = useState<AuthState>('LANDING');
  const [view, setView] = useState<UserView>(UserView.OWNER);
  const [ownerSubView, setOwnerSubView] = useState<ProfileSubView>('dashboard');
  const [horses, setHorses] = useState<Horse[]>(MOCK_HORSES);
  const [selectedHorse, setSelectedHorse] = useState<Horse | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAddHorseModal, setShowAddHorseModal] = useState(false);
  const [addMode, setAddMode] = useState<'manual' | 'transfer'>('manual');
  
  // Registration States
  const [regZip, setRegZip] = useState('');
  const [suggestedStables, setSuggestedStables] = useState<typeof EXISTING_STABLES>([]);
  const [selectedStableId, setSelectedStableId] = useState<string>('');
  
  const [newHorseData, setNewHorseData] = useState<Partial<Horse>>({
    name: '', isoNr: '', feiNr: '', birthYear: new Date().getFullYear(), breedingAssociation: '',
    breed: '', gender: 'Wallach', color: '', weightKg: 600
  });
  const [redeemCode, setRedeemCode] = useState('');

  const [userSettings, setUserSettings] = useState({
    firstName: 'Max',
    lastName: 'Mustermann',
    stallName: 'Gut Sonnenhof',
    notifyVaccination: true,
    notifyHoof: true
  });

  const profileRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (regZip.length >= 3) {
      setSuggestedStables(EXISTING_STABLES.filter(s => s.zip.startsWith(regZip)));
    } else {
      setSuggestedStables([]);
    }
  }, [regZip]);

  const notifications = horses.flatMap(horse => {
    const list = [];
    const compliance = checkFEICompliance(horse);
    if (compliance.status !== ComplianceStatus.GREEN) {
      list.push({ horse, status: compliance.status, message: compliance.message });
    }
    const hoof = checkHoofCareStatus(horse);
    if (hoof.status !== ComplianceStatus.GREEN) {
      list.push({ horse, status: hoof.status, message: hoof.status === ComplianceStatus.RED ? 'Schmied überfällig' : 'Schmied bald fällig' });
    }
    return list;
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) setShowProfileMenu(false);
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) setShowNotifications(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleUpdateHorse = (updatedHorse: Horse) => {
    setHorses(prev => prev.map(h => h.id === updatedHorse.id ? updatedHorse : h));
    setSelectedHorse(updatedHorse);
  };

  const handleBulkAddVaccination = (horseIds: string[], vacc: Omit<Vaccination, 'id'>) => {
    setHorses(prev => prev.map(h => horseIds.includes(h.id) ? { ...h, vaccinations: [{ ...vacc, id: crypto.randomUUID() }, ...h.vaccinations] } : h));
  };

  const handleUpdateVaccination = (horseId: string, updatedVacc: Vaccination) => {
    setHorses(prev => prev.map(h => h.id === horseId ? { ...h, vaccinations: h.vaccinations.map(v => v.id === updatedVacc.id ? updatedVacc : v) } : h));
  };

  const handleDeleteVaccination = (horseId: string, vaccId: string) => {
    setHorses(prev => prev.map(h => h.id === horseId ? { ...h, vaccinations: h.vaccinations.filter(v => v.id !== vaccId) } : h));
  };

  const handleBulkAddService = (horseIds: string[], service: Omit<ServiceRecord, 'id'>) => {
    setHorses(prev => prev.map(h => horseIds.includes(h.id) ? { ...h, serviceHistory: [{ ...service, id: crypto.randomUUID() }, ...h.serviceHistory] } : h));
  };

  const handleUpdateService = (horseId: string, updatedService: ServiceRecord) => {
    setHorses(prev => prev.map(h => h.id === horseId ? { ...h, serviceHistory: h.serviceHistory.map(s => s.id === updatedService.id ? updatedService : s) } : h));
  };

  const handleDeleteService = (horseId: string, serviceId: string) => {
    setHorses(prev => prev.map(h => h.id === horseId ? { ...h, serviceHistory: h.serviceHistory.filter(s => s.id !== serviceId) } : h));
  };

  const handleDeleteHorse = (id: string) => {
    setHorses(prev => prev.filter(h => h.id !== id));
    setSelectedHorse(null);
    setOwnerSubView('stableOverview');
  };

  const handleCreateHorse = (e: React.FormEvent) => {
    e.preventDefault();
    if (addMode === 'manual') {
      const horse: Horse = {
        ...newHorseData as Horse,
        id: crypto.randomUUID(),
        ownerId: 'current-user',
        ownerName: `${userSettings.firstName} ${userSettings.lastName}`,
        image: `https://picsum.photos/seed/${newHorseData.name}/400/300`,
        vaccinations: [],
        serviceHistory: [],
        chipId: newHorseData.chipId || 'Nicht angegeben'
      };
      setHorses(prev => [horse, ...prev]);
    } else {
      alert("Pferd erfolgreich mit Code übernommen!");
    }
    setShowAddHorseModal(false);
    setNewHorseData({ name: '', isoNr: '', feiNr: '', birthYear: new Date().getFullYear(), breedingAssociation: '' });
    setRedeemCode('');
  };

  const renderAuth = () => {
    switch(authState) {
      case 'LANDING':
        return (
          <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4 animate-in fade-in duration-1000">
            <div className="w-24 h-24 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center text-white shadow-2xl mb-8 transform rotate-3 hover:rotate-0 transition-transform">
              <svg className="w-14 h-14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" /></svg>
            </div>
            <h1 className="text-6xl font-black text-slate-900 mb-4 tracking-tighter">EquiManage</h1>
            <p className="text-xl text-slate-500 max-w-xl mb-12 font-medium">Das digitale Zuhause für dein Pferdemanagement & FEI-Konformität.</p>
            <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
              <button type="button" onClick={() => setAuthState('LOGIN')} className="flex-1 bg-slate-900 text-white font-bold py-4 rounded-2xl hover:bg-slate-800 transition-all shadow-xl">Anmelden</button>
              <button type="button" onClick={() => setAuthState('REGISTER_CHOICE')} className="flex-1 bg-white border-2 border-slate-200 text-slate-900 font-bold py-4 rounded-2xl hover:bg-slate-50 transition-all">Registrieren</button>
            </div>
          </div>
        );
      case 'LOGIN':
        return (
          <div className="max-w-md mx-auto bg-white rounded-[2.5rem] p-10 shadow-xl border border-slate-100 animate-in zoom-in duration-300">
            <h2 className="text-3xl font-bold mb-6">Willkommen zurück</h2>
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setAuthState('AUTHENTICATED'); }}>
              <input type="email" placeholder="E-Mail Adresse" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" required />
              <input type="password" placeholder="Passwort" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" required />
              <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl shadow-lg mt-4">Login</button>
              <button type="button" onClick={() => setAuthState('LANDING')} className="w-full text-slate-400 text-sm py-2 hover:text-slate-600">Zurück zur Startseite</button>
            </form>
          </div>
        );
      case 'REGISTER_CHOICE':
        return (
          <div className="max-w-4xl mx-auto text-center px-4">
            <h2 className="text-4xl font-bold mb-2">Wie möchtest du starten?</h2>
            <p className="text-slate-500 mb-12">Wähle den passenden Account-Typ für deine Bedürfnisse.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <button type="button" onClick={() => setAuthState('REGISTER_OWNER')} className="bg-white p-10 rounded-[3rem] border-2 border-slate-100 hover:border-indigo-600 transition-all group shadow-sm hover:shadow-2xl">
                <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-all"><svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg></div>
                <h3 className="text-2xl font-bold mb-2">Besitzer</h3>
                <p className="text-slate-400 text-sm">Bestandsverwaltung, Dokumentation und FEI-Monitoring.</p>
              </button>
              <button type="button" onClick={() => { setAuthState('REGISTER_VET'); setView(UserView.VET); }} className="bg-white p-10 rounded-[3rem] border-2 border-slate-100 hover:border-emerald-600 transition-all group shadow-sm hover:shadow-2xl">
                <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-6 group-hover:bg-emerald-600 group-hover:text-white transition-all"><svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg></div>
                <h3 className="text-2xl font-bold mb-2">Tierarzt / Dienstleister</h3>
                <p className="text-slate-400 text-sm">Patientenmanagement, Verifizierung und Tourenplanung.</p>
              </button>
            </div>
            <button type="button" onClick={() => setAuthState('LANDING')} className="mt-12 text-slate-400 font-bold hover:text-slate-600">Zurück</button>
          </div>
        );
      case 'REGISTER_OWNER':
        return (
          <div className="max-w-2xl mx-auto bg-white rounded-[3rem] p-12 shadow-xl border border-slate-100 animate-in slide-in-from-bottom-8">
            <h2 className="text-3xl font-bold mb-8">Besitzer-Profil erstellen</h2>
            <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); setAuthState('AUTHENTICATED'); }}>
              <div className="grid grid-cols-2 gap-4">
                <input type="text" placeholder="Vorname" className="p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none" required />
                <input type="text" placeholder="Nachname" className="p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none" required />
              </div>
              <input type="text" value={regZip} onChange={e => setRegZip(e.target.value)} placeholder="Stall-Suche via PLZ" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none" required />
              {regZip.length >= 3 && (
                <div className="space-y-2 p-3 bg-indigo-50 rounded-2xl">
                  {suggestedStables.map(s => (
                    <button key={s.id} type="button" onClick={() => setSelectedStableId(s.id)} className={`w-full p-3 rounded-xl text-left text-sm font-bold border ${selectedStableId === s.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}>{s.name}</button>
                  ))}
                  <button type="button" className="w-full p-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-400 font-bold text-xs">+ Stall neu anlegen</button>
                </div>
              )}
              <input type="email" placeholder="E-Mail" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none" required />
              <input type="password" placeholder="Passwort" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none" required />
              <div className="flex gap-4 mt-6">
                <button type="button" onClick={() => setAuthState('REGISTER_CHOICE')} className="flex-1 py-4 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all">Zurück</button>
                <button type="submit" className="flex-1 py-4 bg-slate-900 text-white font-bold rounded-xl shadow-xl hover:bg-slate-800 transition-all">Registrierung abschließen</button>
              </div>
            </form>
          </div>
        );
      case 'REGISTER_VET':
        return (
          <div className="max-w-2xl mx-auto bg-white rounded-[3rem] p-12 shadow-xl border border-slate-100 animate-in slide-in-from-bottom-8">
            <h2 className="text-3xl font-bold mb-8">Tierarzt-Profil erstellen</h2>
            <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); setAuthState('AUTHENTICATED'); }}>
              <input type="text" placeholder="Praxis / Firmenname" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none" required />
              <input type="text" placeholder="Standort (PLZ)" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none" required />
              <input type="email" placeholder="E-Mail" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none" required />
              <input type="password" placeholder="Passwort" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none" required />
              <div className="flex gap-4 mt-6">
                <button type="button" onClick={() => { setAuthState('REGISTER_CHOICE'); setView(UserView.OWNER); }} className="flex-1 py-4 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all">Zurück</button>
                <button type="submit" className="flex-1 py-4 bg-emerald-600 text-white font-bold rounded-xl shadow-xl hover:bg-emerald-700 transition-all">Account erstellen</button>
              </div>
            </form>
          </div>
        );
      default: return null;
    }
  };

  const renderContent = () => {
    if (selectedHorse) {
      return (
        <HorseDetails 
          horse={horses.find(h => h.id === selectedHorse.id) || selectedHorse}
          allHorses={horses}
          onBack={() => { setSelectedHorse(null); setOwnerSubView('stableOverview'); }} 
          onDelete={handleDeleteHorse}
          onUpdateHorse={handleUpdateHorse}
          onBulkAddVaccination={handleBulkAddVaccination}
          onUpdateVaccination={handleUpdateVaccination}
          onDeleteVaccination={handleDeleteVaccination}
          onBulkAddService={handleBulkAddService}
          onUpdateService={handleUpdateService}
          onDeleteService={handleDeleteService}
          onTransfer={(id) => { setHorses(prev => prev.filter(h => h.id !== id)); setSelectedHorse(null); }}
        />
      );
    }

    if (ownerSubView === 'profile' || ownerSubView === 'settings') {
      return (
        <div className="max-w-4xl mx-auto bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-slate-900 p-10 text-white flex items-center gap-8">
            <div className="w-28 h-28 bg-slate-800 rounded-full flex items-center justify-center text-4xl font-black border-4 border-slate-700 shadow-xl">M</div>
            <div>
              <h2 className="text-4xl font-black tracking-tight">{userSettings.firstName} {userSettings.lastName}</h2>
              <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">{userSettings.stallName}</p>
            </div>
          </div>
          <div className="p-10 space-y-10">
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vorname</label><input type="text" value={userSettings.firstName} onChange={e => setUserSettings({...userSettings, firstName: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500" /></div>
              <div className="space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nachname</label><input type="text" value={userSettings.lastName} onChange={e => setUserSettings({...userSettings, lastName: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500" /></div>
            </div>
            <div className="space-y-6 pt-10 border-t border-slate-100">
              <h3 className="text-lg font-bold">Benachrichtigungen</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-5 bg-slate-50 rounded-3xl">
                  <div><p className="font-bold">Fällige Impfungen</p><p className="text-xs text-slate-400">Erinnere mich 14 Tage vor Ablauf der FEI-Frist.</p></div>
                  <button onClick={() => setUserSettings({...userSettings, notifyVaccination: !userSettings.notifyVaccination})} className={`w-14 h-7 rounded-full relative transition-all ${userSettings.notifyVaccination ? 'bg-indigo-600' : 'bg-slate-300'}`}><div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${userSettings.notifyVaccination ? 'left-8' : 'left-1'}`} /></button>
                </div>
                <div className="flex justify-between items-center p-5 bg-slate-50 rounded-3xl">
                  <div><p className="font-bold">Hufschmied-Termine</p><p className="text-xs text-slate-400">Erinnere mich nach 6 Wochen an den Schmied.</p></div>
                  <button onClick={() => setUserSettings({...userSettings, notifyHoof: !userSettings.notifyHoof})} className={`w-14 h-7 rounded-full relative transition-all ${userSettings.notifyHoof ? 'bg-emerald-600' : 'bg-slate-300'}`}><div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${userSettings.notifyHoof ? 'left-8' : 'left-1'}`} /></button>
                </div>
              </div>
            </div>
            <div className="flex gap-4">
              <button onClick={() => setOwnerSubView('dashboard')} className="flex-1 py-4 bg-slate-100 text-slate-700 font-bold rounded-2xl hover:bg-slate-200 transition-all">Abbrechen</button>
              <button onClick={() => setOwnerSubView('dashboard')} className="flex-1 py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">Speichern</button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {ownerSubView === 'dashboard' ? (
          <ActionDashboard horses={horses} onSelectHorse={setSelectedHorse} onGoToStable={() => setOwnerSubView('stableOverview')} />
        ) : (
          <HealthDashboard horses={horses} onSelectHorse={setSelectedHorse} onAddNewHorse={() => setShowAddHorseModal(true)} onExport={() => {}} onGoToDashboard={() => setOwnerSubView('dashboard')} />
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 flex justify-between h-16 items-center">
          <div className="flex items-center gap-2 cursor-pointer group" onClick={() => { if (authState === 'AUTHENTICATED') { setOwnerSubView('dashboard'); setSelectedHorse(null); } else if (authState !== 'LANDING') { setAuthState('LANDING'); setView(UserView.OWNER); } }}>
            <div className="w-9 h-9 bg-slate-900 rounded-[0.75rem] flex items-center justify-center text-white font-black text-sm group-hover:bg-indigo-600 transition-all">E</div>
            <span className="font-bold text-xl text-slate-900 tracking-tight">EquiManage</span>
          </div>
          {authState === 'AUTHENTICATED' && (
            <div className="flex items-center gap-3">
              <div className="relative" ref={notificationRef}>
                <button onClick={() => setShowNotifications(!showNotifications)} className="p-2 text-slate-400 relative hover:bg-slate-100 rounded-xl transition-all">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                  {notifications.length > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border border-white"></span>}
                </button>
                {showNotifications && (
                  <div className="absolute right-0 mt-3 w-80 bg-white border border-slate-200 rounded-3xl shadow-2xl z-50 p-2 animate-in zoom-in-95 duration-200">
                    <div className="p-3 border-b border-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mitteilungen</div>
                    <div className="max-h-80 overflow-y-auto custom-scrollbar">
                      {notifications.length > 0 ? notifications.map((n, i) => (
                        <div key={i} className="p-4 hover:bg-slate-50 cursor-pointer rounded-2xl border-b border-slate-50 last:border-0" onClick={() => { setSelectedHorse(n.horse); setShowNotifications(false); }}>
                          <p className="text-sm font-bold text-slate-800">{n.horse.name}</p><p className="text-[10px] text-slate-500 font-medium">{n.message}</p>
                        </div>
                      )) : <div className="p-10 text-center text-slate-400 text-xs italic">Keine neuen Mitteilungen</div>}
                    </div>
                  </div>
                )}
              </div>
              <div className="relative" ref={profileRef}>
                <button onClick={() => setShowProfileMenu(!showProfileMenu)} className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center font-black text-white text-sm border-2 border-slate-200 shadow-sm">M</button>
                {showProfileMenu && (
                  <div className="absolute right-0 mt-3 w-60 bg-white border border-slate-200 rounded-3xl shadow-2xl z-50 py-2 animate-in zoom-in-95 duration-200">
                    <button onClick={() => {setOwnerSubView('profile'); setShowProfileMenu(false);}} className="w-full text-left px-5 py-3 hover:bg-slate-50 text-sm font-bold text-slate-700">Profil bearbeiten</button>
                    <button onClick={() => {setOwnerSubView('settings'); setShowProfileMenu(false);}} className="w-full text-left px-5 py-3 hover:bg-slate-50 text-sm font-bold text-slate-700">Einstellungen</button>
                    <div className="border-t border-slate-50 mt-2 pt-2"><button onClick={() => setAuthState('LANDING')} className="w-full text-left px-5 py-3 text-rose-600 font-bold hover:bg-rose-50 text-sm">Abmelden</button></div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </nav>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8">
        {authState === 'AUTHENTICATED' ? (view === UserView.VET ? <VetPortal /> : renderContent()) : renderAuth()}
      </main>

      {showAddHorseModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <form onSubmit={handleCreateHorse} className="bg-white rounded-[2.5rem] p-10 max-w-xl w-full shadow-2xl animate-in zoom-in-95 duration-200 space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-6">
              <h4 className="text-2xl font-black tracking-tight">Neues Pferd</h4>
              <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                <button type="button" onClick={() => setAddMode('manual')} className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${addMode === 'manual' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}>Manuell</button>
                <button type="button" onClick={() => setAddMode('transfer')} className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${addMode === 'transfer' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}>Transfer-Code</button>
              </div>
            </div>
            {addMode === 'manual' ? (
              <div className="grid grid-cols-2 gap-5 max-h-[50vh] overflow-y-auto pr-3 custom-scrollbar">
                <div className="col-span-2 space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Pferdename *</label><input required type="text" value={newHorseData.name} onChange={e => setNewHorseData({...newHorseData, name: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Name" /></div>
                <div className="space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">ISO-Nr. (UELN) *</label><input required type="text" value={newHorseData.isoNr} onChange={e => setNewHorseData({...newHorseData, isoNr: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none" placeholder="z.B. DE..." /></div>
                <div className="space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">FEI-Nr. *</label><input required type="text" value={newHorseData.feiNr} onChange={e => setNewHorseData({...newHorseData, feiNr: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none" placeholder="z.B. 10..." /></div>
                <div className="space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Geburtsjahr *</label><input required type="number" value={newHorseData.birthYear} onChange={e => setNewHorseData({...newHorseData, birthYear: parseInt(e.target.value)})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none" /></div>
                <div className="space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Zuchtverband *</label><input required type="text" value={newHorseData.breedingAssociation} onChange={e => setNewHorseData({...newHorseData, breedingAssociation: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none" /></div>
                <div className="col-span-2 pt-4 border-t border-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Optionale Details</div>
                <div className="space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Rasse</label><input type="text" value={newHorseData.breed} onChange={e => setNewHorseData({...newHorseData, breed: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none" /></div>
                <div className="space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Chip-ID</label><input type="text" value={newHorseData.chipId} onChange={e => setNewHorseData({...newHorseData, chipId: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none" /></div>
              </div>
            ) : (
              <div className="py-12 space-y-6 text-center">
                <p className="text-sm text-slate-400 font-medium">Gib den 6-stelligen Transfer-Code ein, um ein Pferd zu übernehmen.</p>
                <input type="text" maxLength={6} value={redeemCode} onChange={e => setRedeemCode(e.target.value.replace(/\D/g,''))} placeholder="000000" className="w-full p-8 text-center text-5xl font-black tracking-[1rem] bg-slate-50 border border-slate-200 rounded-[2.5rem] outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            )}
            <div className="flex gap-4 pt-4 border-t border-slate-50">
              <button type="button" onClick={() => setShowAddHorseModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-700 font-bold rounded-2xl hover:bg-slate-200">Abbrechen</button>
              <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">Pferd hinzufügen</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default App;
