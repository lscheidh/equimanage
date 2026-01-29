
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { UserView, Horse, ComplianceStatus, Vaccination, ServiceRecord, Profile, Stable } from './types';
import { HealthDashboard } from './components/HealthDashboard';
import { ActionDashboard } from './components/ActionDashboard';
import { HorseDetails } from './components/HorseDetails';
import { VetPortal } from './components/VetPortal';
import { TerminVereinbarenModal } from './components/TerminVereinbarenModal';
import { OwnerTerminanfragen } from './components/OwnerTerminanfragen';
import { checkVaccinationCompliance, checkHoofCareStatus } from './logic';
import * as auth from './services/authService';
import * as appointmentRequestService from './services/appointmentRequestService';
import * as horseService from './services/horseService';
import { HORSE_PLACEHOLDER_IMAGE, uploadHorseImage } from './services/horseImageService';
import * as rimondo from './services/rimondoService';
import { supabase } from './services/supabase';

type ProfileSubView = 'stableOverview' | 'settings' | 'dashboard';
type VetSubView = 'dashboard' | 'settings';
type AuthState = 'LANDING' | 'LOGIN' | 'REGISTER_CHOICE' | 'REGISTER_OWNER' | 'REGISTER_VET' | 'REGISTER_BOTH' | 'AUTHENTICATED';

function mapAuthError(err: unknown): string {
  let msg = '';
  if (err instanceof Error) msg = err.message;
  else if (err != null && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') msg = (err as { message: string }).message;
  else if (typeof err === 'string') msg = err;
  else msg = String(err ?? '');
  if (msg === '[object Object]' || !msg.trim()) return 'Ein Fehler ist aufgetreten. Bitte versuche es erneut.';
  const s = msg.toLowerCase();
  if (s.includes('invalid login') || s.includes('invalid_credentials') || s.includes('invalid grant')) return 'E-Mail oder Passwort falsch. Bitte prüfe deine Eingaben.';
  if (s.includes('email not confirmed')) return 'E-Mail noch nicht bestätigt. Bitte klicke den Link in der Bestätigungsmail.';
  if (s.includes('already registered') || s.includes('user already exists') || s.includes('duplicate')) return 'Diese E-Mail ist bereits registriert. Bitte melde dich an.';
  if (s.includes('password') && (s.includes('short') || s.includes('weak') || s.includes('least'))) return 'Passwort zu schwach. Bitte mindestens 6 Zeichen verwenden.';
  if (s.includes('fetch') || s.includes('network') || s.includes('failed to fetch')) return 'Netzwerkfehler. Bitte Verbindung prüfen und erneut versuchen.';
  if (s.includes('jwt') || s.includes('session')) return 'Sitzung abgelaufen. Bitte melde dich erneut an.';
  if (s.includes('nicht angemeldet')) return 'Nicht angemeldet. Bitte zuerst anmelden.';
  if (msg) return msg;
  return 'Ein Fehler ist aufgetreten. Bitte versuche es erneut.';
}

function getProfileInitials(p: Profile | null): string {
  if (!p) return '?';
  if (p.role === 'owner') {
    const s = ((p.first_name ?? '')[0] || '') + ((p.last_name ?? '')[0] || '');
    return (s || '?').toUpperCase();
  }
  const n = p.practice_name ?? '';
  const s = (n[0] ?? '') + (n[1] ?? '');
  return (s || '?').toUpperCase();
}

function mapHorseError(err: unknown, context?: 'create' | 'update' | 'delete'): string {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  const s = msg.toLowerCase();
  if (s.includes('duplicate') || s.includes('unique') || s.includes('already exists')) return 'Pferd mit dieser ISO- oder Reg.-Nr. existiert bereits.';
  if (s.includes('foreign key') || s.includes('owner')) return 'Besitzer nicht gefunden. Bitte Seite neu laden.';
  if (s.includes('fetch') || s.includes('network')) return 'Netzwerkfehler. Bitte Verbindung prüfen und erneut versuchen.';
  if (msg) return msg;
  if (context === 'delete') return 'Pferd konnte nicht gelöscht werden. Bitte erneut versuchen.';
  if (context === 'update') return 'Änderungen konnten nicht gespeichert werden. Bitte erneut versuchen.';
  return 'Pferd anlegen fehlgeschlagen. Bitte erneut versuchen.';
}

const App: React.FC = () => {
  const [authState, setAuthState] = useState<AuthState>('LANDING');
  const [view, setView] = useState<UserView>(UserView.OWNER);
  const [ownerSubView, setOwnerSubView] = useState<ProfileSubView>('dashboard');
  const [horses, setHorses] = useState<Horse[]>([]);
  const [selectedHorse, setSelectedHorse] = useState<Horse | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAddHorseModal, setShowAddHorseModal] = useState(false);
  const [showTerminModal, setShowTerminModal] = useState(false);
  const [addMode, setAddMode] = useState<'manual' | 'transfer'>('manual');

  const [profile, setProfile] = useState<Profile | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [userSettings, setUserSettings] = useState({
    firstName: '',
    lastName: '',
    stallName: '',
    zip: '',
    notifyVaccination: true,
    notifyHoof: true,
  });

  const [vetSubView, setVetSubView] = useState<VetSubView>('dashboard');
  const [vetSettings, setVetSettings] = useState({
    practiceName: '',
    zip: '',
    notifyVaccination: true,
    notifyHoof: true,
  });

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [settingsPassword, setSettingsPassword] = useState('');

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [regZip, setRegZip] = useState('');
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [suggestedStables, setSuggestedStables] = useState<Stable[]>([]);
  const [selectedStableId, setSelectedStableId] = useState<string>('');
  const [createNewStable, setCreateNewStable] = useState(false);
  const [newStallName, setNewStallName] = useState('');

  const [vetPracticeName, setVetPracticeName] = useState('');
  const [vetZip, setVetZip] = useState('');
  const [vetEmail, setVetEmail] = useState('');
  const [vetPassword, setVetPassword] = useState('');

  const [newHorseData, setNewHorseData] = useState<Partial<Horse>>({
    name: '', isoNr: '', feiNr: '', birthYear: new Date().getFullYear(), breedingAssociation: '',
    breed: '', color: '',
  });
  const [newHorseImageFile, setNewHorseImageFile] = useState<File | null>(null);
  const [redeemCode, setRedeemCode] = useState('');
  const [horseCreateLoading, setHorseCreateLoading] = useState(false);
  const [horseError, setHorseError] = useState<string | null>(null);
  const [rimondoUrl, setRimondoUrl] = useState('');
  const [rimondoLoading, setRimondoLoading] = useState(false);

  const [registrationSuccessMessage, setRegistrationSuccessMessage] = useState<string | null>(null);
  const [profileSaveSuccess, setProfileSaveSuccess] = useState(false);

  const defaultHorseData = (): Partial<Horse> => ({
    name: '', isoNr: '', feiNr: '', birthYear: new Date().getFullYear(), breedingAssociation: '',
    breed: '', color: '',
  });
  const closeAddHorseModal = () => {
    setShowAddHorseModal(false);
    setNewHorseData(defaultHorseData());
    setNewHorseImageFile(null);
    setRedeemCode('');
    setRimondoUrl('');
    setAddMode('manual');
    setHorseError(null);
  };

  const clearAuthForms = useCallback(() => {
    setLoginEmail('');
    setLoginPassword('');
    setRegZip('');
    setRegFirstName('');
    setRegLastName('');
    setRegEmail('');
    setRegPassword('');
    setSelectedStableId('');
    setCreateNewStable(false);
    setNewStallName('');
    setVetPracticeName('');
    setVetZip('');
    setVetEmail('');
    setVetPassword('');
    setSuggestedStables([]);
    setAuthError(null);
    setRegistrationSuccessMessage(null);
  }, []);

  const handleLogout = () => {
    setShowProfileMenu(false);
    setShowNotifications(false);
    setVetSubView('dashboard');
    setAuthState('LANDING');
    setProfile(null);
    setUserEmail(null);
    setHorses([]);
    setView(UserView.OWNER);
    clearAuthForms();
    auth.signOut().catch(() => {});
  };

  const profileRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const skipAuthTransitionRef = useRef(false);

  const ownerName = profile ? [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Nutzer' : '';
  const stallDisplay = profile?.stall_name ?? profile?.practice_name ?? '';
  const canActAsOwner = !!profile && (profile.role === 'owner' || !!profile.stable_id || !!(profile.stall_name && profile.stall_name.trim()));
  const canActAsVet = !!profile && (profile.role === 'vet' || !!(profile.practice_name && profile.practice_name.trim()));
  const canSwitchProfile = canActAsOwner && canActAsVet;

  const loadProfileAndData = useCallback(async (): Promise<Profile | null> => {
    const p = await auth.getProfile();
    setProfile(p);
    if (!p) return null;
    const role = p.role;
    const hasVet = !!(p.practice_name && p.practice_name.trim());
    setView(role === 'vet' ? UserView.VET : UserView.OWNER);
    setUserSettings({
      firstName: p.first_name ?? '',
      lastName: p.last_name ?? '',
      stallName: p.stall_name ?? p.practice_name ?? '',
      zip: p.zip ?? '',
      notifyVaccination: p.notify_vaccination ?? true,
      notifyHoof: p.notify_hoof ?? true,
    });
    const email = await auth.getCurrentUserEmail();
    setUserEmail(email ?? null);
    if (role === 'vet' || hasVet) {
      setVetSettings({
        practiceName: p.practice_name ?? '',
        zip: p.practice_zip ?? p.zip ?? '',
        notifyVaccination: p.notify_vaccination ?? true,
        notifyHoof: p.notify_hoof ?? true,
      });
    }
    const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Nutzer';
    if (role === 'owner') {
      const list = await horseService.fetchHorses(p.id, name);
      setHorses(list);
    } else {
      setHorses([]);
    }
    return p;
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const session = await auth.getSession();
        if (!mounted) return;
        if (session) {
          const p = await loadProfileAndData();
          if (!mounted) return;
          if (!p) {
            try { await auth.signOut(); } catch (_) { /* ignore */ }
            setAuthState('LANDING');
            setProfile(null);
            setHorses([]);
            setView(UserView.OWNER);
          } else {
            setAuthState('AUTHENTICATED');
          }
        } else {
          setAuthState('LANDING');
          setProfile(null);
          setHorses([]);
          setView(UserView.OWNER);
        }
      } catch {
        if (!mounted) return;
        setAuthState('LANDING');
        setProfile(null);
        setHorses([]);
        setView(UserView.OWNER);
      } finally {
        if (mounted) setAuthReady(true);
      }
    };
    load();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      if (event === 'SIGNED_OUT') {
        setAuthState('LANDING');
        setProfile(null);
        setHorses([]);
        setView(UserView.OWNER);
        clearAuthForms();
        skipAuthTransitionRef.current = false;
        return;
      }
      if (session && event !== 'INITIAL_SESSION') {
        if (skipAuthTransitionRef.current) {
          skipAuthTransitionRef.current = false;
          return;
        }
        await loadProfileAndData();
        if (!mounted) return;
        setAuthState('AUTHENTICATED');
      }
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfileAndData, clearAuthForms]);

  useEffect(() => {
    if (regZip.length < 2) {
      setSuggestedStables([]);
      return;
    }
    let cancelled = false;
    auth.listStablesByZip(regZip).then((list) => {
      if (!cancelled) setSuggestedStables(list);
    });
    return () => { cancelled = true; };
  }, [regZip]);

  const notifications = horses
    .map(horse => {
      const compliance = checkVaccinationCompliance(horse);
      const hoof = checkHoofCareStatus(horse);
      const items: { status: ComplianceStatus; message: string }[] = [];
      for (const di of compliance.dueItems) items.push({ status: di.status, message: di.message });
      if (hoof.status !== ComplianceStatus.GREEN) {
        items.push({ status: hoof.status, message: hoof.status === ComplianceStatus.RED ? 'Hufschmied überfällig (über 8 Wochen)' : 'Hufschmied fällig' });
      }
      if (items.length === 0) return null;
      return { horse, items };
    })
    .filter((n): n is { horse: Horse; items: { status: ComplianceStatus; message: string }[] } => n != null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) setShowProfileMenu(false);
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) setShowNotifications(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const persistHorse = async (h: Horse) => {
    if (!profile || profile.role !== 'owner') return;
    try {
      const updated = await horseService.updateHorse(profile.id, ownerName, h);
      setHorses(prev => prev.map(x => x.id === updated.id ? updated : x));
      if (selectedHorse?.id === h.id) setSelectedHorse(updated);
    } catch (e) {
      alert(mapHorseError(e, 'update'));
    }
  };

  const handleUpdateHorse = async (updatedHorse: Horse) => {
    setHorses(prev => prev.map(h => h.id === updatedHorse.id ? updatedHorse : h));
    setSelectedHorse(updatedHorse);
    await persistHorse(updatedHorse);
  };

  const handleBulkAddVaccination = async (horseIds: string[], vacc: Omit<Vaccination, 'id'>) => {
    const v = { ...vacc, id: crypto.randomUUID() };
    const updated: Horse[] = [];
    setHorses(prev => prev.map(h => {
      if (!horseIds.includes(h.id)) return h;
      const next = { ...h, vaccinations: [v, ...h.vaccinations] };
      updated.push(next);
      return next;
    }));
    for (const h of updated) {
      await persistHorse(h);
      if (selectedHorse?.id === h.id) setSelectedHorse(h);
    }
  };

  const handleUpdateVaccination = async (horseId: string, updatedVacc: Vaccination) => {
    let u: Horse | null = null;
    setHorses(prev => prev.map(h => {
      if (h.id !== horseId) return h;
      u = { ...h, vaccinations: h.vaccinations.map(v => v.id === updatedVacc.id ? updatedVacc : v) };
      return u;
    }));
    if (u) { await persistHorse(u); if (selectedHorse?.id === horseId) setSelectedHorse(u); }
  };

  const handleDeleteVaccination = async (horseId: string, vaccId: string) => {
    let u: Horse | null = null;
    setHorses(prev => prev.map(h => {
      if (h.id !== horseId) return h;
      u = { ...h, vaccinations: h.vaccinations.filter(v => v.id !== vaccId) };
      return u;
    }));
    if (u) { await persistHorse(u); if (selectedHorse?.id === horseId) setSelectedHorse(u); }
  };

  const handleBulkAddService = async (horseIds: string[], service: Omit<ServiceRecord, 'id'>) => {
    const s = { ...service, id: crypto.randomUUID() };
    const updated: Horse[] = [];
    setHorses(prev => prev.map(h => {
      if (!horseIds.includes(h.id)) return h;
      const next = { ...h, serviceHistory: [s, ...h.serviceHistory] };
      updated.push(next);
      return next;
    }));
    for (const h of updated) {
      await persistHorse(h);
      if (selectedHorse?.id === h.id) setSelectedHorse(h);
    }
  };

  const handleUpdateService = async (horseId: string, updatedService: ServiceRecord) => {
    let u: Horse | null = null;
    setHorses(prev => prev.map(h => {
      if (h.id !== horseId) return h;
      u = { ...h, serviceHistory: h.serviceHistory.map(x => x.id === updatedService.id ? updatedService : x) };
      return u;
    }));
    if (u) { await persistHorse(u); if (selectedHorse?.id === horseId) setSelectedHorse(u); }
  };

  const handleDeleteService = async (horseId: string, serviceId: string) => {
    let u: Horse | null = null;
    setHorses(prev => prev.map(h => {
      if (h.id !== horseId) return h;
      u = { ...h, serviceHistory: h.serviceHistory.filter(x => x.id !== serviceId) };
      return u;
    }));
    if (u) { await persistHorse(u); if (selectedHorse?.id === horseId) setSelectedHorse(u); }
  };

  const handleConfirmAppointmentRequest = useCallback(async (req: appointmentRequestService.AppointmentRequestRow) => {
    if (!profile || profile.role !== 'owner' || !req.scheduled_date) return;
    await appointmentRequestService.updateAppointmentRequestOwnerConfirm(profile.id, req.id);
    const vetName = req.payload.vet?.practiceName ?? 'Tierarzt';
    const date = req.scheduled_date;

    for (const ph of req.payload.horses) {
      const horse = horses.find((h) => h.id === ph.horseId);
      if (!horse) continue;
      const toAdd: Vaccination[] = [];

      if (ph.noVaccData && ph.selectedCategories?.length) {
        for (const type of ph.selectedCategories) {
          toAdd.push({
            id: crypto.randomUUID(),
            type,
            date,
            vetName,
            isBooster: false,
            sequence: 'V1',
            status: 'planned',
          });
        }
      } else if (ph.selectedDueItems?.length) {
        for (const d of ph.selectedDueItems) {
          toAdd.push({
            id: crypto.randomUUID(),
            type: d.type,
            date,
            vetName,
            isBooster: d.sequence === 'Booster',
            sequence: d.sequence as Vaccination['sequence'],
            status: 'planned',
          });
        }
      }

      if (toAdd.length === 0) continue;
      const next = { ...horse, vaccinations: [...toAdd, ...horse.vaccinations] };
      setHorses(prev => prev.map(h => (h.id === horse.id ? next : h)));
      if (selectedHorse?.id === horse.id) setSelectedHorse(next);
      await persistHorse(next);
    }
  }, [profile, horses, selectedHorse, persistHorse]);

  const handleDeleteHorse = async (id: string) => {
    if (!profile) return;
    try {
      await horseService.deleteHorse(profile.id, id);
      setHorses(prev => prev.filter(h => h.id !== id));
      setSelectedHorse(null);
      setOwnerSubView('stableOverview');
    } catch (e) {
      alert(mapHorseError(e, 'delete'));
    }
  };
  const handleCreateHorse = async (e: React.FormEvent) => {
    e.preventDefault();
    setHorseError(null);
    if (addMode === 'transfer') {
      setHorseError('Transfer-Code wird derzeit nicht unterstützt. Bitte Pferd manuell anlegen.');
      return;
    }
    let effectiveProfile = profile;
    if (!effectiveProfile) {
      const p = await auth.getProfile();
      if (p) {
        setProfile(p);
        effectiveProfile = p;
      }
    }
    if (!effectiveProfile || effectiveProfile.role !== 'owner') {
      setHorseError(
        effectiveProfile
          ? 'Nur Pferdebesitzer können Pferde anlegen.'
          : 'Profil konnte nicht geladen werden. Bitte Seite neu laden oder erneut anmelden.'
      );
      return;
    }
    const name = (newHorseData.name ?? '').trim();
    const isoNr = (newHorseData.isoNr ?? '').trim();
    if (!name || !isoNr) {
      setHorseError('Pferdename und ISO-Nr. (UELN) sind Pflichtangaben.');
      return;
    }
    const opt = (s: string | undefined) => ((s ?? '').trim() || '—');
    const feiNr = opt(newHorseData.feiNr as string);
    setHorseCreateLoading(true);
    const ownerDisplayName = [effectiveProfile.first_name, effectiveProfile.last_name].filter(Boolean).join(' ') || 'Nutzer';
    try {
      let imageUrl = HORSE_PLACEHOLDER_IMAGE;
      if (newHorseImageFile) {
        imageUrl = await uploadHorseImage(newHorseImageFile, effectiveProfile.id, null);
      }
      const horse = await horseService.createHorse(effectiveProfile.id, ownerDisplayName, {
        name,
        isoNr,
        feiNr,
        birthYear: newHorseData.birthYear ?? new Date().getFullYear(),
        breedingAssociation: opt(newHorseData.breedingAssociation as string),
        breed: opt(newHorseData.breed as string),
        gender: null,
        color: '—',
        chipId: opt(newHorseData.chipId as string),
        image: imageUrl,
        weightKg: null,
        vaccinations: [],
        serviceHistory: [],
      });
      setHorses(prev => [horse, ...prev]);
      closeAddHorseModal();
    } catch (err) {
      setHorseError(mapHorseError(err));
    } finally {
      setHorseCreateLoading(false);
    }
  };

  const renderAuth = () => {
    switch(authState) {
      case 'LANDING':
        return (
          <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4 animate-in fade-in duration-1000">
            {registrationSuccessMessage && (
              <div className="mb-8 w-full max-w-md p-5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-left">
                <p className="font-bold mb-1">Registrierung erfolgreich</p>
                <p className="text-sm">{registrationSuccessMessage}</p>
              </div>
            )}
            <div className="w-24 h-24 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center text-white shadow-2xl mb-8 transform rotate-3 hover:rotate-0 transition-transform">
              <svg className="w-14 h-14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" /></svg>
            </div>
            <h1 className="text-6xl font-black text-slate-900 mb-4 tracking-tighter">EquiManage</h1>
            <p className="text-xl text-slate-500 max-w-xl mb-12 font-medium">Das digitale Zuhause für dein Pferdemanagement.</p>
            <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
              <button type="button" onClick={() => { setAuthState('LOGIN'); setRegistrationSuccessMessage(null); }} className="flex-1 bg-slate-900 text-white font-bold py-4 rounded-2xl hover:bg-slate-800 transition-all shadow-xl">Anmelden</button>
              <button type="button" onClick={() => { setAuthState('REGISTER_CHOICE'); setRegistrationSuccessMessage(null); }} className="flex-1 bg-white border-2 border-slate-200 text-slate-900 font-bold py-4 rounded-2xl hover:bg-slate-50 transition-all">Registrieren</button>
            </div>
          </div>
        );
      case 'LOGIN':
        return (
          <div className="max-w-md mx-auto bg-white rounded-[2.5rem] p-10 shadow-xl border border-slate-100 animate-in zoom-in duration-300">
            <h2 className="text-3xl font-bold mb-6">Willkommen zurück</h2>
            <form className="space-y-4" onSubmit={async (e) => {
              e.preventDefault();
              setAuthError(null);
              setAuthLoading(true);
              try {
                await auth.signIn(loginEmail, loginPassword);
                const p = await loadProfileAndData();
                if (!p) {
                  try { await auth.signOut(); } catch (_) { /* ignore */ }
                  setAuthError('Profil konnte nicht geladen werden. Bitte E-Mail bestätigen (Link in der Inbox) oder später erneut versuchen.');
                  setProfile(null);
                  setHorses([]);
                  return;
                }
                setAuthState('AUTHENTICATED');
                clearAuthForms();
              } catch (err) {
                setAuthError(mapAuthError(err));
              } finally {
                setAuthLoading(false);
              }
            }}>
              <input type="email" placeholder="E-Mail Adresse" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" required />
              <input type="password" placeholder="Passwort" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" required />
              {authError && <p className="text-sm text-rose-600 font-medium">{authError}</p>}
              <button type="submit" disabled={authLoading} className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl shadow-lg mt-4 disabled:opacity-60">Anmelden</button>
              <button type="button" onClick={() => { setAuthState('LANDING'); clearAuthForms(); }} className="w-full text-slate-400 text-sm py-2 hover:text-slate-600">Zurück zur Startseite</button>
            </form>
          </div>
        );
      case 'REGISTER_CHOICE':
        return (
          <div className="max-w-4xl mx-auto text-center px-4">
            <h2 className="text-4xl font-bold mb-2">Wie möchtest du starten?</h2>
            <p className="text-slate-500 mb-12">Wähle den passenden Account-Typ für deine Bedürfnisse.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <button type="button" onClick={() => setAuthState('REGISTER_OWNER')} className="bg-white p-8 rounded-[3rem] border-2 border-slate-100 hover:border-indigo-600 transition-all group shadow-sm hover:shadow-2xl">
                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-all"><svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg></div>
                <h3 className="text-xl font-bold mb-1">Besitzer</h3>
                <p className="text-slate-400 text-xs">Bestand, Impfmonitoring.</p>
              </button>
              <button type="button" onClick={() => { setAuthState('REGISTER_VET'); setView(UserView.VET); }} className="bg-white p-8 rounded-[3rem] border-2 border-slate-100 hover:border-emerald-600 transition-all group shadow-sm hover:shadow-2xl">
                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-emerald-600 group-hover:text-white transition-all"><svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg></div>
                <h3 className="text-xl font-bold mb-1">Tierarzt</h3>
                <p className="text-slate-400 text-xs">Terminanfragen, Touren.</p>
              </button>
              <button type="button" onClick={() => setAuthState('REGISTER_BOTH')} className="bg-white p-8 rounded-[3rem] border-2 border-slate-100 hover:border-violet-600 transition-all group shadow-sm hover:shadow-2xl">
                <div className="w-16 h-16 bg-violet-50 text-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-violet-600 group-hover:text-white transition-all"><svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg></div>
                <h3 className="text-xl font-bold mb-1">Beides</h3>
                <p className="text-slate-400 text-xs">Ein Account, Wechsel möglich.</p>
              </button>
            </div>
            <button type="button" onClick={() => { setAuthState('LANDING'); clearAuthForms(); }} className="mt-12 text-slate-400 font-bold hover:text-slate-600">Zurück</button>
          </div>
        );
      case 'REGISTER_OWNER':
        return (
          <div className="max-w-2xl mx-auto bg-white rounded-[3rem] p-12 shadow-xl border border-slate-100 animate-in slide-in-from-bottom-8">
            <h2 className="text-3xl font-bold mb-8">Besitzer-Profil erstellen</h2>
            <form className="space-y-5" onSubmit={async (e) => {
              e.preventDefault();
              setAuthError(null);
              if (!createNewStable && !selectedStableId) {
                setAuthError('Bitte wähle einen Stall oder „Stall neu anlegen“.');
                return;
              }
              if (createNewStable && !newStallName.trim()) {
                setAuthError('Bitte gib einen Namen für den neuen Stall ein.');
                return;
              }
              setAuthLoading(true);
              setAuthError(null);
              try {
                skipAuthTransitionRef.current = true;
                const stallName = createNewStable ? newStallName.trim() : (suggestedStables.find(s => s.id === selectedStableId)?.name ?? '');
                await auth.signUpOwner({
                  email: regEmail,
                  password: regPassword,
                  firstName: regFirstName,
                  lastName: regLastName,
                  zip: regZip,
                  stableId: createNewStable ? null : selectedStableId || null,
                  stallName: stallName || 'Neuer Stall',
                });
                try { await auth.signOut(); } catch (_) { /* ignoriert */ }
                clearAuthForms();
                setAuthState('LANDING');
                setRegistrationSuccessMessage('Bitte bestätige deine E-Mail (Link wurde zugeschickt) und melde dich danach an.');
              } catch (err) {
                setAuthError(mapAuthError(err));
              } finally {
                skipAuthTransitionRef.current = false;
                setAuthLoading(false);
              }
            }}>
              <div className="grid grid-cols-2 gap-4">
                <input type="text" placeholder="Vorname" value={regFirstName} onChange={e => setRegFirstName(e.target.value)} className="p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" required />
                <input type="text" placeholder="Nachname" value={regLastName} onChange={e => setRegLastName(e.target.value)} className="p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" required />
              </div>
              <input type="text" value={regZip} onChange={e => { setRegZip(e.target.value); setCreateNewStable(false); setSelectedStableId(''); setNewStallName(''); }} placeholder="Stall-Suche via PLZ" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" required />
              {regZip.length >= 2 && (
                <div className="space-y-2 p-3 bg-indigo-50 rounded-2xl">
                  {suggestedStables.map(s => (
                    <button key={s.id} type="button" onClick={() => { setSelectedStableId(s.id); setCreateNewStable(false); setNewStallName(''); }} className={`w-full p-3 rounded-xl text-left text-sm font-bold border ${selectedStableId === s.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}>{s.name}</button>
                  ))}
                  <button type="button" onClick={() => { setCreateNewStable(true); setSelectedStableId(''); setNewStallName(''); }} className={`w-full p-3 rounded-xl text-left text-sm font-bold border-2 border-dashed ${createNewStable ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-300 text-slate-400'}`}>+ Stall neu anlegen</button>
                  {createNewStable && (
                    <div className="pt-2 space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 block">Name des neuen Stalls</label>
                      <input type="text" value={newStallName} onChange={e => setNewStallName(e.target.value)} placeholder="z.B. Reitstall Sonnenhof" className="w-full p-3 bg-white border-2 border-indigo-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400" />
                      <p className="text-xs text-slate-500">PLZ: {regZip} (aus Suche oben)</p>
                    </div>
                  )}
                </div>
              )}
              <input type="email" placeholder="E-Mail" value={regEmail} onChange={e => setRegEmail(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" required />
              <input type="password" placeholder="Passwort" value={regPassword} onChange={e => setRegPassword(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" required />
              {authError && <p className="text-sm text-rose-600 font-medium">{authError}</p>}
              <div className="flex gap-4 mt-6">
                <button type="button" onClick={() => { setAuthState('REGISTER_CHOICE'); clearAuthForms(); }} className="flex-1 py-4 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all">Zurück</button>
                <button type="submit" disabled={authLoading} className="flex-1 py-4 bg-slate-900 text-white font-bold rounded-xl shadow-xl hover:bg-slate-800 transition-all disabled:opacity-60">Registrierung abschließen</button>
              </div>
            </form>
          </div>
        );
      case 'REGISTER_VET':
        return (
          <div className="max-w-2xl mx-auto bg-white rounded-[3rem] p-12 shadow-xl border border-slate-100 animate-in slide-in-from-bottom-8">
            <h2 className="text-3xl font-bold mb-8">Tierarzt-Profil erstellen</h2>
            <form className="space-y-5" onSubmit={async (e) => {
              e.preventDefault();
              setAuthError(null);
              setAuthLoading(true);
              setAuthError(null);
              try {
                skipAuthTransitionRef.current = true;
                await auth.signUpVet({ email: vetEmail, password: vetPassword, practiceName: vetPracticeName, zip: vetZip });
                try { await auth.signOut(); } catch (_) { /* ignoriert */ }
                clearAuthForms();
                setAuthState('LANDING');
                setRegistrationSuccessMessage('Bitte bestätige deine E-Mail (Link wurde zugeschickt) und melde dich danach an.');
              } catch (err) {
                setAuthError(mapAuthError(err));
              } finally {
                skipAuthTransitionRef.current = false;
                setAuthLoading(false);
              }
            }}>
              <input type="text" placeholder="Praxis / Firmenname" value={vetPracticeName} onChange={e => setVetPracticeName(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" required />
              <input type="text" placeholder="Standort (PLZ)" value={vetZip} onChange={e => setVetZip(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" required />
              <input type="email" placeholder="E-Mail" value={vetEmail} onChange={e => setVetEmail(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" required />
              <input type="password" placeholder="Passwort" value={vetPassword} onChange={e => setVetPassword(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" required />
              {authError && <p className="text-sm text-rose-600 font-medium">{authError}</p>}
              <div className="flex gap-4 mt-6">
                <button type="button" onClick={() => { setAuthState('REGISTER_CHOICE'); setView(UserView.OWNER); clearAuthForms(); }} className="flex-1 py-4 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all">Zurück</button>
                <button type="submit" disabled={authLoading} className="flex-1 py-4 bg-emerald-600 text-white font-bold rounded-xl shadow-xl hover:bg-emerald-700 transition-all disabled:opacity-60">Account erstellen</button>
              </div>
            </form>
          </div>
        );
      case 'REGISTER_BOTH': {
        return (
          <div className="max-w-2xl mx-auto bg-white rounded-[3rem] p-12 shadow-xl border border-slate-100 animate-in slide-in-from-bottom-8">
            <h2 className="text-3xl font-bold mb-2">Besitzer + Tierarzt</h2>
            <p className="text-slate-500 text-sm mb-8">Ein Account – du kannst zwischen den Profilen wechseln.</p>
            <form className="space-y-5" onSubmit={async (e) => {
              e.preventDefault();
              setAuthError(null);
              if (!createNewStable && !selectedStableId) {
                setAuthError('Bitte wähle einen Stall oder „Stall neu anlegen“.');
                return;
              }
              if (createNewStable && !newStallName.trim()) {
                setAuthError('Bitte gib einen Namen für den neuen Stall ein.');
                return;
              }
              setAuthLoading(true);
              setAuthError(null);
              try {
                skipAuthTransitionRef.current = true;
                const stallName = createNewStable ? newStallName.trim() : (suggestedStables.find(s => s.id === selectedStableId)?.name ?? '');
                await auth.signUpBoth({
                  email: regEmail,
                  password: regPassword,
                  firstName: regFirstName,
                  lastName: regLastName,
                  zip: regZip,
                  stableId: createNewStable ? null : selectedStableId || null,
                  stallName: stallName || 'Neuer Stall',
                  practiceName: vetPracticeName,
                  practiceZip: vetZip,
                });
                try { await auth.signOut(); } catch (_) { /* ignoriert */ }
                clearAuthForms();
                setAuthState('LANDING');
                setRegistrationSuccessMessage('Bitte bestätige deine E-Mail (Link wurde zugeschickt) und melde dich danach an.');
              } catch (err) {
                setAuthError(mapAuthError(err));
              } finally {
                skipAuthTransitionRef.current = false;
                setAuthLoading(false);
              }
            }}>
              <div className="text-sm font-bold text-slate-600 border-b border-slate-100 pb-2">Besitzer</div>
              <div className="grid grid-cols-2 gap-4">
                <input type="text" placeholder="Vorname" value={regFirstName} onChange={e => setRegFirstName(e.target.value)} className="p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" required />
                <input type="text" placeholder="Nachname" value={regLastName} onChange={e => setRegLastName(e.target.value)} className="p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" required />
              </div>
              <input type="text" value={regZip} onChange={e => { setRegZip(e.target.value); setCreateNewStable(false); setSelectedStableId(''); setNewStallName(''); }} placeholder="Stall-Suche via PLZ" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" required />
              {regZip.length >= 2 && (
                <div className="space-y-2 p-3 bg-indigo-50 rounded-2xl">
                  {suggestedStables.map(s => (
                    <button key={s.id} type="button" onClick={() => { setSelectedStableId(s.id); setCreateNewStable(false); setNewStallName(''); }} className={`w-full p-3 rounded-xl text-left text-sm font-bold border ${selectedStableId === s.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}>{s.name}</button>
                  ))}
                  <button type="button" onClick={() => { setCreateNewStable(true); setSelectedStableId(''); setNewStallName(''); }} className={`w-full p-3 rounded-xl text-left text-sm font-bold border-2 border-dashed ${createNewStable ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-300 text-slate-400'}`}>+ Stall neu anlegen</button>
                  {createNewStable && (
                    <div className="pt-2 space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 block">Name des neuen Stalls</label>
                      <input type="text" value={newStallName} onChange={e => setNewStallName(e.target.value)} placeholder="z.B. Reitstall Sonnenhof" className="w-full p-3 bg-white border-2 border-indigo-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400" />
                      <p className="text-xs text-slate-500">PLZ: {regZip}</p>
                    </div>
                  )}
                </div>
              )}
              <div className="text-sm font-bold text-slate-600 border-b border-slate-100 pb-2 pt-4">Tierarzt / Praxis</div>
              <input type="text" placeholder="Praxis / Firmenname" value={vetPracticeName} onChange={e => setVetPracticeName(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" required />
              <input type="text" placeholder="Standort Praxis (PLZ)" value={vetZip} onChange={e => setVetZip(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" required />
              <div className="text-sm font-bold text-slate-600 border-b border-slate-100 pb-2 pt-4">Account</div>
              <input type="email" placeholder="E-Mail" value={regEmail} onChange={e => setRegEmail(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" required />
              <input type="password" placeholder="Passwort" value={regPassword} onChange={e => setRegPassword(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" required />
              {authError && <p className="text-sm text-rose-600 font-medium">{authError}</p>}
              <div className="flex gap-4 mt-6">
                <button type="button" onClick={() => { setAuthState('REGISTER_CHOICE'); clearAuthForms(); }} className="flex-1 py-4 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all">Zurück</button>
                <button type="submit" disabled={authLoading} className="flex-1 py-4 bg-violet-600 text-white font-bold rounded-xl shadow-xl hover:bg-violet-700 transition-all disabled:opacity-60">Registrierung abschließen</button>
              </div>
            </form>
          </div>
        );
      }
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

    if (ownerSubView === 'settings') {
      return (
        <div className="max-w-4xl mx-auto bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-slate-900 p-10 text-white flex items-center gap-8">
            <div className="w-28 h-28 bg-slate-800 rounded-full flex items-center justify-center text-4xl font-black border-4 border-slate-700 shadow-xl">{getProfileInitials(profile)}</div>
            <div>
              <h2 className="text-4xl font-black tracking-tight">{userSettings.firstName} {userSettings.lastName}</h2>
              <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">{stallDisplay || userSettings.stallName}</p>
            </div>
          </div>
          <div className="p-10 space-y-10">
            <p className="text-sm text-slate-500 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3">Alle Angaben aus der Registrierung kannst du hier ändern (inkl. E-Mail und Passwort).</p>
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vorname</label><input type="text" value={userSettings.firstName} onChange={e => setUserSettings({...userSettings, firstName: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500" /></div>
              <div className="space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nachname</label><input type="text" value={userSettings.lastName} onChange={e => setUserSettings({...userSettings, lastName: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500" /></div>
              <div className="space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Stall / Betrieb</label><input type="text" value={userSettings.stallName} onChange={e => setUserSettings({...userSettings, stallName: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500" /></div>
              <div className="space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">PLZ</label><input type="text" value={userSettings.zip} onChange={e => setUserSettings({...userSettings, zip: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none" placeholder="z.B. 10115" /></div>
              <div className="col-span-2 space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">E-Mail</label><input type="email" value={userEmail ?? ''} onChange={e => setUserEmail(e.target.value || null)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500" placeholder="E-Mail" /></div>
              <div className="col-span-2 space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Neues Passwort</label><input type="password" value={settingsPassword} onChange={e => setSettingsPassword(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none" placeholder="Leer lassen, um das Passwort beizubehalten" autoComplete="new-password" /></div>
            </div>
            <div className="space-y-6 pt-10 border-t border-slate-100">
              <h3 className="text-lg font-bold">Benachrichtigungen</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-5 bg-slate-50 rounded-3xl">
                  <div><p className="font-bold">Fällige Impfungen</p><p className="text-xs text-slate-400">Erinnere mich 14 Tage vor dem frühesten Fälligkeitstag.</p></div>
                  <button onClick={() => setUserSettings({...userSettings, notifyVaccination: !userSettings.notifyVaccination})} className={`w-14 h-7 rounded-full relative transition-all ${userSettings.notifyVaccination ? 'bg-indigo-600' : 'bg-slate-300'}`}><div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${userSettings.notifyVaccination ? 'left-8' : 'left-1'}`} /></button>
                </div>
                <div className="flex justify-between items-center p-5 bg-slate-50 rounded-3xl">
                  <div><p className="font-bold">Hufschmied-Termine</p><p className="text-xs text-slate-400">Erinnere mich nach 6 Wochen an den Schmied.</p></div>
                  <button onClick={() => setUserSettings({...userSettings, notifyHoof: !userSettings.notifyHoof})} className={`w-14 h-7 rounded-full relative transition-all ${userSettings.notifyHoof ? 'bg-emerald-600' : 'bg-slate-300'}`}><div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${userSettings.notifyHoof ? 'left-8' : 'left-1'}`} /></button>
                </div>
              </div>
            </div>
            {authError && <p className="text-sm text-rose-600 font-medium">{authError}</p>}
            {profileSaveSuccess && <p className="text-sm text-emerald-600 font-medium">Gespeichert. Du wirst zum Dashboard weitergeleitet.</p>}
            <div className="flex gap-4">
              <button type="button" onClick={() => { setOwnerSubView('dashboard'); setAuthError(null); setProfileSaveSuccess(false); setSettingsPassword(''); }} className="flex-1 py-4 bg-slate-100 text-slate-700 font-bold rounded-2xl hover:bg-slate-200 transition-all">Abbrechen</button>
              <button type="button" onClick={async () => {
                setAuthError(null);
                setProfileSaveSuccess(false);
                if (!profile) return;
                try {
                  if ((userEmail ?? '').trim() && userEmail !== (await auth.getCurrentUserEmail())) {
                    await auth.updateAuthEmail(userEmail!.trim());
                  }
                  if (settingsPassword.trim()) {
                    await auth.updateAuthPassword(settingsPassword);
                    setSettingsPassword('');
                  }
                  const p = await auth.updateProfile({
                    first_name: userSettings.firstName,
                    last_name: userSettings.lastName,
                    stall_name: userSettings.stallName || null,
                    zip: userSettings.zip || null,
                    notify_vaccination: userSettings.notifyVaccination,
                    notify_hoof: userSettings.notifyHoof,
                  });
                  setProfile(p);
                  setProfileSaveSuccess(true);
                  setUserSettings({ ...userSettings, firstName: p.first_name ?? '', lastName: p.last_name ?? '', stallName: p.stall_name ?? p.practice_name ?? '', zip: p.zip ?? '', notifyVaccination: p.notify_vaccination ?? true, notifyHoof: p.notify_hoof ?? true });
                  const em = await auth.getCurrentUserEmail();
                  setUserEmail(em ?? null);
                  setTimeout(() => { setOwnerSubView('dashboard'); setProfileSaveSuccess(false); }, 1200);
                } catch (e) {
                  setAuthError(mapAuthError(e));
                }
              }} className="flex-1 py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">Speichern</button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {ownerSubView === 'dashboard' ? (
          <div className="flex flex-col lg:flex-row gap-6 items-stretch">
            <div className="flex-1 min-w-0">
              <ActionDashboard horses={horses} onSelectHorse={setSelectedHorse} onGoToStable={() => setOwnerSubView('stableOverview')} />
            </div>
            <aside className="lg:w-80 flex-shrink-0">
              <OwnerTerminanfragen
                profile={profile}
                horses={horses}
                onConfirmRequest={handleConfirmAppointmentRequest}
                onSelectHorse={setSelectedHorse}
              />
            </aside>
          </div>
        ) : (
          <HealthDashboard horses={horses} onSelectHorse={setSelectedHorse} onAddNewHorse={() => { setHorseError(null); setShowAddHorseModal(true); }} onTerminVereinbaren={() => setShowTerminModal(true)} onGoToDashboard={() => setOwnerSubView('dashboard')} />
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 flex justify-between h-16 items-center">
          <div className="flex items-center gap-2 cursor-pointer group" onClick={() => { if (authState === 'AUTHENTICATED') { setOwnerSubView('dashboard'); setVetSubView('dashboard'); setSelectedHorse(null); } else if (authState !== 'LANDING') { setAuthState('LANDING'); setView(UserView.OWNER); clearAuthForms(); } }}>
            <div className="w-9 h-9 bg-indigo-600 rounded-[0.75rem] flex items-center justify-center text-white group-hover:bg-indigo-700 transition-all">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" /></svg>
            </div>
            <span className="font-bold text-xl text-slate-900 tracking-tight">EquiManage</span>
          </div>
          {authState === 'AUTHENTICATED' && (
            <div className="flex items-center gap-3">
              {view === UserView.OWNER && (
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
                          <div key={i} className="p-4 hover:bg-slate-50 cursor-pointer rounded-2xl border-b border-slate-50 last:border-0" onClick={() => { setOwnerSubView('stableOverview'); setSelectedHorse(n.horse); setShowNotifications(false); }}>
                            <p className="text-sm font-bold text-slate-800">{n.horse.name}</p>
                            <ul className="mt-1.5 space-y-0.5">
                              {n.items.map((it, j) => (
                                <li key={j} className="text-[10px] text-slate-500 font-medium">{it.message}</li>
                              ))}
                            </ul>
                          </div>
                        )) : <div className="p-10 text-center text-slate-400 text-xs italic">Keine neuen Mitteilungen</div>}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="relative" ref={profileRef}>
                <button onClick={() => setShowProfileMenu(!showProfileMenu)} className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center font-black text-white text-sm border-2 border-slate-200 shadow-sm">
                  {getProfileInitials(profile)}
                </button>
                {showProfileMenu && (
                  <div className="absolute right-0 mt-3 w-60 bg-white border border-slate-200 rounded-3xl shadow-2xl z-50 py-2 animate-in zoom-in-95 duration-200">
                    {canSwitchProfile && (
                      <>
                        <button type="button" onClick={() => { setView(UserView.OWNER); setOwnerSubView('dashboard'); setVetSubView('dashboard'); setShowProfileMenu(false); }} className={`w-full text-left px-5 py-3 hover:bg-slate-50 text-sm font-bold ${view === UserView.OWNER ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'}`}>Als Besitzer anzeigen</button>
                        <button type="button" onClick={() => { setView(UserView.VET); setVetSubView('dashboard'); setShowProfileMenu(false); }} className={`w-full text-left px-5 py-3 hover:bg-slate-50 text-sm font-bold ${view === UserView.VET ? 'bg-emerald-50 text-emerald-700' : 'text-slate-700'}`}>Als Tierarzt anzeigen</button>
                        <div className="border-t border-slate-100 my-2" />
                      </>
                    )}
                    {view === UserView.OWNER && canActAsOwner && (
                      <button type="button" onClick={() => { setSelectedHorse(null); setOwnerSubView('settings'); setShowProfileMenu(false); setProfileSaveSuccess(false); setAuthError(null); setSettingsPassword(''); setUserSettings((s) => ({ ...s, firstName: profile?.first_name ?? '', lastName: profile?.last_name ?? '', stallName: profile?.stall_name ?? profile?.practice_name ?? '', zip: profile?.zip ?? '' })); auth.getCurrentUserEmail().then((e) => setUserEmail(e ?? null)); }} className="w-full text-left px-5 py-3 hover:bg-slate-50 text-sm font-bold text-slate-700">Einstellungen</button>
                    )}
                    {view === UserView.VET && canActAsVet && (
                      <button type="button" onClick={() => { setVetSubView('settings'); setShowProfileMenu(false); setProfileSaveSuccess(false); setAuthError(null); setVetSettings({ ...vetSettings, practiceName: profile?.practice_name ?? '', zip: profile?.practice_zip ?? profile?.zip ?? '', notifyVaccination: profile?.notify_vaccination ?? true, notifyHoof: profile?.notify_hoof ?? true }); setSettingsPassword(''); auth.getCurrentUserEmail().then((e) => setUserEmail(e ?? null)); }} className="w-full text-left px-5 py-3 hover:bg-slate-50 text-sm font-bold text-slate-700">Einstellungen</button>
                    )}
                    <div className="border-t border-slate-50 mt-2 pt-2">
                      <button type="button" onClick={handleLogout} className="w-full text-left px-5 py-3 text-rose-600 font-bold hover:bg-rose-50 text-sm">Abmelden</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </nav>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8">
        {!authReady ? (
          <div className="flex items-center justify-center min-h-[40vh] text-slate-400 font-medium">Laden…</div>
        ) : authState === 'AUTHENTICATED' && profile === null ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4 space-y-6">
            <p className="text-slate-600 font-medium">Profil konnte nicht geladen werden. Bitte Seite neu laden.</p>
            <div className="flex flex-wrap gap-4 justify-center">
              <button
                type="button"
                disabled={authLoading}
                onClick={async () => { setAuthError(null); setAuthLoading(true); await loadProfileAndData(); setAuthLoading(false); }}
                className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-colors disabled:opacity-60"
              >
                {authLoading ? 'Laden…' : 'Seite neu laden'}
              </button>
              <button type="button" onClick={handleLogout} className="px-6 py-3 bg-slate-200 text-slate-700 font-bold rounded-2xl hover:bg-slate-300 transition-colors">
                Abmelden
              </button>
            </div>
          </div>
        ) : authState === 'AUTHENTICATED' ? (view === UserView.VET ? (
          vetSubView === 'settings' ? (
            <div className="max-w-4xl mx-auto bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4">
              <div className="bg-slate-900 p-10 text-white flex items-center gap-8">
                <div className="w-28 h-28 bg-slate-800 rounded-full flex items-center justify-center text-4xl font-black border-4 border-slate-700 shadow-xl">{getProfileInitials(profile)}</div>
                <div>
                  <h2 className="text-4xl font-black tracking-tight">{vetSettings.practiceName || 'Tierarzt'}</h2>
                  <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">PLZ {vetSettings.zip || '—'}</p>
                </div>
              </div>
              <div className="p-10 space-y-10">
                <p className="text-sm text-slate-500 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3">Alle Angaben aus der Registrierung kannst du hier ändern (inkl. E-Mail und Passwort).</p>
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Praxisname</label><input type="text" value={vetSettings.practiceName} onChange={e => setVetSettings({ ...vetSettings, practiceName: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                  <div className="space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">PLZ</label><input type="text" value={vetSettings.zip} onChange={e => setVetSettings({ ...vetSettings, zip: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none" placeholder="z.B. 10115" /></div>
                  <div className="col-span-2 space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">E-Mail</label><input type="email" value={userEmail ?? ''} onChange={e => setUserEmail(e.target.value || null)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500" placeholder="E-Mail" /></div>
                  <div className="col-span-2 space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Neues Passwort</label><input type="password" value={settingsPassword} onChange={e => setSettingsPassword(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none" placeholder="Leer lassen, um das Passwort beizubehalten" autoComplete="new-password" /></div>
                </div>
                <div className="space-y-6 pt-10 border-t border-slate-100">
                  <h3 className="text-lg font-bold">Benachrichtigungen</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-5 bg-slate-50 rounded-3xl">
                      <div><p className="font-bold">Fällige Impfungen</p><p className="text-xs text-slate-400">Hinweise zu Terminanfragen.</p></div>
                      <button onClick={() => setVetSettings({ ...vetSettings, notifyVaccination: !vetSettings.notifyVaccination })} className={`w-14 h-7 rounded-full relative transition-all ${vetSettings.notifyVaccination ? 'bg-indigo-600' : 'bg-slate-300'}`}><div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${vetSettings.notifyVaccination ? 'left-8' : 'left-1'}`} /></button>
                    </div>
                    <div className="flex justify-between items-center p-5 bg-slate-50 rounded-3xl">
                      <div><p className="font-bold">Allgemeine Erinnerungen</p><p className="text-xs text-slate-400">Weitere Benachrichtigungen.</p></div>
                      <button onClick={() => setVetSettings({ ...vetSettings, notifyHoof: !vetSettings.notifyHoof })} className={`w-14 h-7 rounded-full relative transition-all ${vetSettings.notifyHoof ? 'bg-emerald-600' : 'bg-slate-300'}`}><div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${vetSettings.notifyHoof ? 'left-8' : 'left-1'}`} /></button>
                    </div>
                  </div>
                </div>
                {authError && <p className="text-sm text-rose-600 font-medium">{authError}</p>}
                {profileSaveSuccess && <p className="text-sm text-emerald-600 font-medium">Gespeichert. Du wirst zum Dashboard weitergeleitet.</p>}
                <div className="flex gap-4">
                  <button type="button" onClick={() => { setVetSubView('dashboard'); setAuthError(null); setProfileSaveSuccess(false); setSettingsPassword(''); }} className="flex-1 py-4 bg-slate-100 text-slate-700 font-bold rounded-2xl hover:bg-slate-200 transition-all">Abbrechen</button>
                  <button type="button" onClick={async () => {
                    setAuthError(null); setProfileSaveSuccess(false);
                    if (!profile) return;
                    try {
                      if ((userEmail ?? '').trim() && userEmail !== (await auth.getCurrentUserEmail())) {
                        await auth.updateAuthEmail(userEmail!.trim());
                      }
                      if (settingsPassword.trim()) {
                        await auth.updateAuthPassword(settingsPassword);
                        setSettingsPassword('');
                      }
                      const p = await auth.updateProfile({
                        practice_name: vetSettings.practiceName || null,
                        practice_zip: vetSettings.zip || null,
                        notify_vaccination: vetSettings.notifyVaccination,
                        notify_hoof: vetSettings.notifyHoof,
                      });
                      setProfile(p);
                      setProfileSaveSuccess(true);
                      setVetSettings({ ...vetSettings, practiceName: p.practice_name ?? '', zip: p.practice_zip ?? p.zip ?? '', notifyVaccination: p.notify_vaccination ?? true, notifyHoof: p.notify_hoof ?? true });
                      const em = await auth.getCurrentUserEmail();
                      setUserEmail(em ?? null);
                      setTimeout(() => { setVetSubView('dashboard'); setProfileSaveSuccess(false); }, 1200);
                    } catch (e) {
                      setAuthError(mapAuthError(e));
                    }
                  }} className="flex-1 py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">Speichern</button>
                </div>
              </div>
            </div>
          ) : <VetPortal profile={profile!} />
        ) : renderContent()) : renderAuth()}
      </main>

      {showTerminModal && view === UserView.OWNER && (
        <TerminVereinbarenModal horses={horses} profile={profile} onClose={() => setShowTerminModal(false)} />
      )}
      {showAddHorseModal && view === UserView.OWNER && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={closeAddHorseModal} role="presentation">
          <form onSubmit={handleCreateHorse} className="bg-white rounded-[2.5rem] p-10 max-w-xl w-full shadow-2xl animate-in zoom-in-95 duration-200 space-y-6" onClick={e => e.stopPropagation()}>
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
                <div className="space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Reg.-Nr.</label><input type="text" value={newHorseData.feiNr} onChange={e => setNewHorseData({...newHorseData, feiNr: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none" placeholder="optional" /></div>
                <div className="space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Geburtsjahr *</label><input required type="number" value={newHorseData.birthYear} onChange={e => setNewHorseData({...newHorseData, birthYear: parseInt(e.target.value, 10) || new Date().getFullYear()})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                <div className="col-span-2 pt-4 border-t border-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rimondo</div>
                <div className="col-span-2 flex gap-2">
                  <input type="url" value={rimondoUrl} onChange={e => setRimondoUrl(e.target.value)} placeholder="Rimondo-Profil-URL (z.B. https://www.rimondo.com/de/horse-details/…)" className="flex-1 p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
                  <button type="button" onClick={async () => { if (!rimondo.isRimondoUrl(rimondoUrl)) return; setRimondoLoading(true); setHorseError(null); try { const d = await rimondo.fetchRimondoData(rimondoUrl); setNewHorseData(prev => ({ ...prev, name: d.name ?? prev.name, breed: d.breed ?? prev.breed, birthYear: d.birthYear ?? prev.birthYear, breedingAssociation: d.breedingAssociation ?? prev.breedingAssociation, gender: d.gender ?? prev.gender })); } catch { setHorseError('Rimondo-Daten konnten nicht geladen werden.'); } finally { setRimondoLoading(false); } }} disabled={rimondoLoading || !rimondo.isRimondoUrl(rimondoUrl)} className="px-4 py-3 bg-violet-600 text-white text-sm font-bold rounded-2xl hover:bg-violet-700 disabled:opacity-50 shrink-0">Von Rimondo übernehmen</button>
                </div>
                <div className="col-span-2 pt-4 border-t border-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Optionale Details</div>
                <div className="space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Zuchtverband</label><input type="text" value={newHorseData.breedingAssociation} onChange={e => setNewHorseData({...newHorseData, breedingAssociation: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500" placeholder="z.B. Oldenburger Verband" /></div>
                <div className="space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Rasse</label><input type="text" value={newHorseData.breed} onChange={e => setNewHorseData({...newHorseData, breed: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                <div className="space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Chip-ID</label><input type="text" value={newHorseData.chipId} onChange={e => setNewHorseData({...newHorseData, chipId: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                <div className="col-span-2 space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Profilbild</label>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-100 transition-colors text-sm font-medium text-slate-700">
                      <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      <span>Foto aufnehmen / hochladen</span>
                      <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={e => { const f = e.target.files?.[0]; setNewHorseImageFile(f || null); }} />
                    </label>
                    {newHorseImageFile && (
                      <>
                        <span className="text-sm text-emerald-600 font-medium">✓ {newHorseImageFile.name}</span>
                        <button type="button" onClick={() => setNewHorseImageFile(null)} className="text-sm text-rose-600 font-medium hover:underline">Entfernen</button>
                      </>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400">Auf dem Handy: Kamera nutzen. Sonst: Bild auswählen. Ohne Foto wird ein Platzhalter verwendet.</p>
                </div>
              </div>
            ) : (
              <div className="py-12 space-y-6 text-center">
                <p className="text-sm text-slate-400 font-medium">Gib den 6-stelligen Transfer-Code ein, um ein Pferd zu übernehmen.</p>
                <input type="text" maxLength={6} value={redeemCode} onChange={e => setRedeemCode(e.target.value.replace(/\D/g,''))} placeholder="000000" className="w-full p-8 text-center text-5xl font-black tracking-[1rem] bg-slate-50 border border-slate-200 rounded-[2.5rem] outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            )}
            {horseError && <p className="text-sm text-rose-600 font-medium">{horseError}</p>}
            <div className="flex gap-4 pt-4 border-t border-slate-50">
              <button type="button" onClick={closeAddHorseModal} className="flex-1 py-4 bg-slate-100 text-slate-700 font-bold rounded-2xl hover:bg-slate-200">Abbrechen</button>
              <button type="submit" disabled={horseCreateLoading} className="flex-1 py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-60">{horseCreateLoading ? 'Wird hinzugefügt…' : 'Pferd hinzufügen'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default App;
