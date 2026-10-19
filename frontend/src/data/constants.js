export const SECTEURS_ACTIVITE = [
  'Intelligence Artificielle',
  'Developpement Informatique',
  'E-COMMERCE',
  'DOMOTIQUE',
  'MARKETING DIGITAL',
  'AUDIO-VISUEL',
  'E-TOURISME',
  'HEALTH-TECH',
  'SOLUTION IT',
  'EDU-TECH',
  'FIN-TECH',
  'Cyber Securité',
  'GREEN-TECH',
  'Design graphique',
  'IOT'
];

export const DEFAULT_PROMOTIONS = [
  'Promotion 1',
  'Promotion 2'
];

export const STATUT_JURIDIQUE_OPTS = [
  'Auto-entrepreneur',
  'SARL',
  'SARL AU',
  'Autre'
];

export const NIVEAUX_ETUDE_OPTIONS = [
  { value: 'Niveau Bac', label: 'Niveau Bac (Secondaire)' },
  { value: 'Bac', label: 'Bac (Baccalauréat)' },
  { value: 'Bac+2', label: 'Bac+2 (DEUG, BTS, DUT, TS)' },
  { value: 'Bac+3', label: 'Bac+3 (Licence)' },
  { value: 'Bac+5', label: 'Bac+5 et plus (Master, Ingénieur, Doctorat)' },
];

export const NIVEAUX_ETUDE = NIVEAUX_ETUDE_OPTIONS.map(o => o.value);

export const normalizeNiveauEtude = (val) => {
  if (!val) return '';
  const s = String(val).trim();
  if (NIVEAUX_ETUDE.includes(s)) return s;

  const low = s.toLowerCase();
  if (low === 'niveau bac' || low === 'sans bac' || low.includes('secondaire')) return 'Niveau Bac';
  if (low === 'bac' || low === 'baccalaureat' || low === 'baccalauréat') return 'Bac';
  if (low === 'bac+1' || low === 'bac +1') return 'Bac';
  if (low === 'bac+2' || low === 'bac +2' || low.includes('deug') || low.includes('bts') || low.includes('dut') || low.startsWith('ts') || low.includes('technicien')) return 'Bac+2';
  if (low.includes('licence') || low === 'bac+3' || low === 'bac +3' || low === 'bachelor') return 'Bac+3';
  if (low === 'bac+4' || low === 'bac +4' || low === 'm1') return 'Bac+3';
  if (low.includes('master') || low === 'bac+5' || low === 'bac +5' || low.includes('ingenieur') || low.includes('ingénieur') || low.includes('doct') || low.includes('phd') || low.includes('bac+5+') || low.includes('bac+5 et plus') || low.includes('bac +5 +')) return 'Bac+5';

  return s;
};
