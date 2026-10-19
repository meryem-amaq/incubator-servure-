// Calendrier officiel des jours fériés au Maroc (Fêtes nationales & religieuses)

// Fêtes nationales et civiles fixes (toutes les années)
export const FETES_FIXES_MAROC = {
  '01-01': 'Nouvel An',
  '01-11': 'Manifeste de l’Indépendance',
  '01-14': 'Nouvel An Amazigh (Yennayer)',
  '05-01': 'Fête du Travail',
  '07-30': 'Fête du Trône',
  '08-14': 'Allégeance Oued Eddahab',
  '08-20': 'Révolution du Roi et du Peuple',
  '08-21': 'Fête de la Jeunesse',
  '11-06': 'Anniversaire de la Marche Verte',
  '11-18': 'Fête de l’Indépendance'
};

// Fêtes religieuses musulmanes (dates selon le calendrier lunaire officiel au Maroc)
export const FETES_RELIGIEUSES_MAROC = {
  // 2024
  '2024-04-10': 'Aïd Al-Fitr',
  '2024-04-11': 'Aïd Al-Fitr (2ème jour)',
  '2024-06-17': 'Aïd Al-Adha',
  '2024-06-18': 'Aïd Al-Adha (2ème jour)',
  '2024-07-07': '1er Moharram (Nouvel An Hégirien)',
  '2024-09-16': 'Aïd Al-Mawlid Annabawi',
  '2024-09-17': 'Aïd Al-Mawlid Annabawi (2ème jour)',

  // 2025
  '2025-03-31': 'Aïd Al-Fitr',
  '2025-04-01': 'Aïd Al-Fitr (2ème jour)',
  '2025-06-06': 'Aïd Al-Adha',
  '2025-06-07': 'Aïd Al-Adha (2ème jour)',
  '2025-06-26': '1er Moharram (Nouvel An Hégirien)',
  '2025-09-05': 'Aïd Al-Mawlid Annabawi',
  '2025-09-06': 'Aïd Al-Mawlid Annabawi (2ème jour)',

  // 2026
  '2026-03-20': 'Aïd Al-Fitr',
  '2026-03-21': 'Aïd Al-Fitr (2ème jour)',
  '2026-05-27': 'Aïd Al-Adha',
  '2026-05-28': 'Aïd Al-Adha (2ème jour)',
  '2026-06-16': '1er Moharram (Nouvel An Hégirien)',
  '2026-08-25': 'Aïd Al-Mawlid Annabawi',
  '2026-08-26': 'Aïd Al-Mawlid Annabawi (2ème jour)',

  // 2027
  '2027-03-09': 'Aïd Al-Fitr',
  '2027-03-10': 'Aïd Al-Fitr (2ème jour)',
  '2027-05-16': 'Aïd Al-Adha',
  '2027-05-17': 'Aïd Al-Adha (2ème jour)',
  '2027-06-05': '1er Moharram (Nouvel An Hégirien)',
  '2027-08-14': 'Aïd Al-Mawlid Annabawi',
  '2027-08-15': 'Aïd Al-Mawlid Annabawi (2ème jour)',

  // 2028
  '2028-02-27': 'Aïd Al-Fitr',
  '2028-02-28': 'Aïd Al-Fitr (2ème jour)',
  '2028-05-04': 'Aïd Al-Adha',
  '2028-05-05': 'Aïd Al-Adha (2ème jour)',
  '2028-05-25': '1er Moharram (Nouvel An Hégirien)',
  '2028-08-03': 'Aïd Al-Mawlid Annabawi',
  '2028-08-04': 'Aïd Al-Mawlid Annabawi (2ème jour)',

  // 2029
  '2029-02-15': 'Aïd Al-Fitr',
  '2029-02-16': 'Aïd Al-Fitr (2ème jour)',
  '2029-04-24': 'Aïd Al-Adha',
  '2029-04-25': 'Aïd Al-Adha (2ème jour)',
  '2029-05-14': '1er Moharram (Nouvel An Hégirien)',
  '2029-07-23': 'Aïd Al-Mawlid Annabawi',
  '2029-07-24': 'Aïd Al-Mawlid Annabawi (2ème jour)',

  // 2030
  '2030-02-04': 'Aïd Al-Fitr',
  '2030-02-05': 'Aïd Al-Fitr (2ème jour)',
  '2030-04-13': 'Aïd Al-Adha',
  '2030-04-14': 'Aïd Al-Adha (2ème jour)',
  '2030-05-04': '1er Moharram (Nouvel An Hégirien)',
  '2030-07-12': 'Aïd Al-Mawlid Annabawi',
  '2030-07-13': 'Aïd Al-Mawlid Annabawi (2ème jour)'
};

export const LAST_SUPPORTED_RELIGIOUS_YEAR = 2030;

/**
 * Vérifie si une date donnée (format AAAA-MM-JJ) correspond à un jour férié officiel
 * @param {string} dateStr 'YYYY-MM-DD'
 * @returns {{ isFerie: boolean, nom: string | null }}
 */
export const getJourFerieInfo = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') {
    return { isFerie: false, nom: null };
  }

  // Vérifier format YYYY-MM-DD
  const parts = dateStr.trim().split('-');
  if (parts.length < 3) {
    return { isFerie: false, nom: null };
  }

  const year = parseInt(parts[0], 10);
  if (year > LAST_SUPPORTED_RELIGIOUS_YEAR) {
    console.warn(`[JoursFeries] Avertissement: La date demandée (${dateStr}) dépasse l'horizon des fêtes religieuses supportées (${LAST_SUPPORTED_RELIGIOUS_YEAR}).`);
  }

  const mmdd = `${parts[1]}-${parts[2]}`;
  const fullDate = dateStr.trim();

  // 1. Fêtes religieuses
  if (FETES_RELIGIEUSES_MAROC[fullDate]) {
    return { isFerie: true, nom: FETES_RELIGIEUSES_MAROC[fullDate] };
  }

  // 2. Fêtes civiles fixes
  if (FETES_FIXES_MAROC[mmdd]) {
    return { isFerie: true, nom: FETES_FIXES_MAROC[mmdd] };
  }

  return { isFerie: false, nom: null };
};
