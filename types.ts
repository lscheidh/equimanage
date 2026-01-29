
export enum ComplianceStatus {
  GREEN = 'GREEN',   // Aktuell
  YELLOW = 'YELLOW',  // Bald fällig
  RED = 'RED'        // Überfällig
}

export interface Vaccination {
  id: string;
  type: string;
  date: string;
  vetName: string;
  isBooster: boolean;
  sequence?: 'V1' | 'V2' | 'V3' | 'Booster';
  status: 'verified' | 'pending' | 'planned';
}

export type ServiceType = 'Hufschmied' | 'Entwurmung' | 'Zahnarzt' | 'Physio' | 'Sonstiges';

export interface ServiceRecord {
  id: string;
  type: ServiceType;
  date: string;
  notes?: string;
  provider?: string;
}

export interface Horse {
  id: string;
  name: string;
  breed: string;
  birthYear: number;
  isoNr: string;
  feiNr: string;
  chipId: string;
  ownerId: string;
  ownerName: string;
  gender: 'Hengst' | 'Stute' | 'Wallach' | null;
  color: string;
  breedingAssociation: string;
  image: string;
  vaccinations: Vaccination[];
  serviceHistory: ServiceRecord[];
  weightKg: number | null;
}

export interface Task {
  id: string;
  title: string;
  horseId: string;
  assignedTo: string;
  dueDate: string;
  completed: boolean;
  priority: 'Low' | 'Medium' | 'High';
}

export enum UserView {
  OWNER = 'OWNER',
  VET = 'VET'
}

export type ProfileRole = 'owner' | 'vet';

export interface Profile {
  id: string;
  role: ProfileRole;
  first_name: string | null;
  last_name: string | null;
  stall_name: string | null;
  practice_name: string | null;
  zip: string | null;
  stable_id: string | null;
  notify_vaccination: boolean;
  notify_hoof: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Stable {
  id: string;
  name: string;
  zip: string;
  created_at?: string;
}
