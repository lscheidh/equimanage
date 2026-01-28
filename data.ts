
import { Horse, Task } from './types';

export const MOCK_HORSES: Horse[] = [
  {
    id: '1',
    name: 'Starlight Dream',
    breed: 'Oldenburger',
    birthYear: 2018,
    isoNr: 'DE 433330123418',
    feiNr: '107XX99',
    chipId: '276023456789123',
    ownerId: 'owner-1',
    ownerName: 'Max Mustermann',
    gender: 'Wallach',
    color: 'Dunkelbraun',
    breedingAssociation: 'Oldenburger Verband',
    image: 'https://picsum.photos/seed/horse1/400/300',
    vaccinations: [
      { id: 'v1', type: 'Influenza', date: '2024-11-15', vetName: 'Dr. Müller', isBooster: true, sequence: 'Booster', status: 'verified' },
      { id: 'v2', type: 'Influenza', date: '2024-05-10', vetName: 'Dr. Müller', isBooster: false, sequence: 'V2', status: 'verified' },
    ],
    serviceHistory: [
      { id: 's1', type: 'Hufschmied', date: '2024-12-10', provider: 'Schmied Hans' },
      { id: 's2', type: 'Entwurmung', date: '2024-10-20' },
    ],
    weightKg: 620
  },
  {
    id: '2',
    name: 'Quicksilver',
    breed: 'Holsteiner',
    birthYear: 2015,
    isoNr: 'DE 421000567815',
    feiNr: '105YY88',
    chipId: '276023456789124',
    ownerId: 'owner-1',
    ownerName: 'Max Mustermann',
    gender: 'Hengst',
    color: 'Schimmel',
    breedingAssociation: 'Holsteiner Verband',
    image: 'https://picsum.photos/seed/horse2/400/300',
    vaccinations: [
      { id: 'v3', type: 'Influenza', date: '2024-06-01', vetName: 'Dr. Schmidt', isBooster: true, sequence: 'Booster', status: 'verified' },
    ],
    serviceHistory: [
      { id: 's3', type: 'Hufschmied', date: '2025-01-01', provider: 'Schmied Hans' },
    ],
    weightKg: 580
  }
];

export const MOCK_TASKS: Task[] = [
  { id: 't1', title: 'Measure temperature', horseId: '1', assignedTo: 'Lukas', dueDate: '2025-01-21', completed: false, priority: 'High' },
];
