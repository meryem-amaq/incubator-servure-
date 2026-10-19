import * as XLSX from 'xlsx';

export const loadXLSX = () => {
  if (XLSX && XLSX.utils) return Promise.resolve(XLSX);
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    script.onload = () => {
      if (window.XLSX) resolve(window.XLSX);
      else reject(new Error("Impossible de charger la librairie Excel XLSX"));
    };
    script.onerror = () => {
      const fallback = document.createElement('script');
      fallback.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      fallback.onload = () => resolve(window.XLSX);
      fallback.onerror = () => reject(new Error("Erreur de chargement de la bibliothèque Excel"));
      document.head.appendChild(fallback);
    };
    document.head.appendChild(script);
  });
};

// Normalisation des chaînes pour matcher les noms de colonnes sans accents/casse
export const cleanKey = (str) => {
  if (!str) return '';
  return String(str)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
};

// Formater une date Excel (numérique ou string) en format YYYY-MM-DD
export const formatExcelDate = (val) => {
  if (val === null || val === undefined || val === '') return '';
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString().split('T')[0];
  }
  if (typeof val === 'number') {
    if (val === 0) return '';
    // Nombre de jours Excel depuis 1900
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return '';
    // Si c'est au format DD/MM/YYYY ou YYYY/MM/DD
    const parts = trimmed.split(/[/.-]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) { // YYYY-MM-DD
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      } else if (parts[2].length === 4) { // DD/MM/YYYY
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  }
  return '';
};

// Dictionnaire de correspondances souples pour tous les types de formulaires
export const MAPPINGS = {
  incube: {
    nom_incube: ['nom_incube', 'nom', 'nomdelincube', 'nomincube', 'porteur', 'nomporteur', 'nomcomplet', 'nometprenom'],
    raison_sociale: ['raison_sociale', 'raisonsociale', 'societe', 'entreprise', 'projet', 'nomprojet', 'startup', 'structure'],
    phase_projet: ['phase_projet', 'phase', 'phaseprojet', 'etape', 'stadedeprojet', 'stade'],
    statut_juridique: ['statut_juridique', 'statut', 'formejuridique', 'statutjuridique', 'statutlegal'],
    pp_numero: ['pp_numero', 'pp', 'nopp', 'npp', 'numeropp', 'numpp', 'codepp', 'identifiant'],
    situation_familiale: ['situation_familiale', 'situation', 'situationfamiliale', 'etatcivil'],
    accompagnateur: ['accompagnateur', 'coach', 'responsable', 'mentore', 'referent'],
    date_demarrage: ['date_demarrage', 'datededemarrage', 'datedebut', 'debut', 'date', 'datedelancement'],
    niveau_etude: ['niveau_etude', 'niveau', 'etude', 'diplome', 'niveaudetude'],
    promotion: ['promotion', 'promo', 'promotion_nom', 'nopromotion', 'cohorte', 'session'],
    secteur_activite: ['secteur_activite', 'secteur', 'activite', 'domaine', 'secteuractivite', 'domainedactivite', 'secteurdactivite'],
  },
  associes: {
    nom: ['nom', 'nometprenom', 'nom_prenom', 'nomcomplet'],
    cin: ['cin', 'cnie', 'carte', 'id'],
    fonction: ['fonction', 'role', 'poste', 'titre'],
    tel: ['tel', 'telephone', 'contact'],
  },
  materiel: {
    incube_ref: ['incube_ref', 'nom_incube', 'nomincube', 'nom', 'porteur', 'pp_numero', 'pp', 'projet', 'ref_incube', 'incubé'],
    type_origine: ['type_origine', 'origine', 'typeorigine', 'type', 'propreouids', 'proprietaire'],
    article: ['article', 'designation', 'nomarticle', 'nom', 'materiel', 'equipement', 'intitule'],
    numero_serie: ['numero_serie', 'numerodeserie', 'noserie', 'nserie', 'sn', 'serie', 'serialnumber', 'serial'],
    date_acquisition_reception: ['date_acquisition_reception', 'dateacquisition', 'datereception', 'dateacq', 'date', 'dateachat'],
    caracteristiques_serie: ['caracteristiques_serie', 'caracteristiques', 'specifications', 'description'],
    quantite: ['quantite', 'qte', 'nombre', 'nb'],
    valeur_ou_etat: ['valeur_ou_etat', 'valeur', 'etat', 'prix', 'cout', 'montant', 'valeurmad', 'valeuroetat'],
  },
  plan_action: {
    incube_ref: ['incube_ref', 'nom_incube', 'nomincube', 'nom', 'porteur', 'pp_numero', 'pp', 'projet', 'ref_incube', 'incubé'],
    mois: ['mois', 'periode', 'moisconcerne', 'datesuivi', 'datedusuivi', 'datedesuivi', 'jour', 'jourdesuivi'],
    objectifs: ['objectifs', 'objectif', 'action', 'actions', 'tache', 'intitule', 'titre'],
    echeance: ['echeance', 'dateecheance', 'datefin', 'limite', 'delai'],
    realisation: ['realisation', 'statut', 'etat', 'avancement', 'progression'],
    problemes_rencontres: ['problemes_rencontres', 'problemes', 'bloquants', 'difficultes', 'obstacles', 'problemesrencontres'],
    commentaires: ['commentaires', 'commentaire', 'remarques', 'notes', 'observations'],
  },
  rh_personnel: {
    incube_ref: ['incube_ref', 'nom_incube', 'nomincube', 'nom', 'porteur', 'pp_numero', 'pp', 'projet', 'ref_incube', 'incubé'],
    nom_complet: ['nom_complet', 'nom', 'nomcomplet', 'salarie', 'employe', 'collaborateur', 'nometprenom'],
    poste: ['poste', 'fonction', 'role', 'intituleposte', 'metier'],
    nature_contrat: ['nature_contrat', 'contrat', 'typecontrat', 'naturecontrat', 'statutcontrat'],
    date_embauche: ['date_embauche', 'dateembauche', 'debutcontrat', 'datedebut', 'recrutement'],
    date_fin: ['date_fin', 'datefin', 'fincontrat', 'depart'],
    salaire_mensuel: ['salaire_mensuel', 'salaire', 'remuneration', 'salairemad', 'salairemensuel'],
  },
  rh_emploi: {
    incube_ref: ['incube_ref', 'nom_incube', 'nomincube', 'nom', 'porteur', 'pp_numero', 'pp', 'projet', 'ref_incube', 'incubé'],
    mois: ['mois', 'periode'],
    personnel_permanent: ['personnel_permanent', 'permanent', 'permanents', 'cdi', 'plein', 'personnelpermanent'],
    personnel_temporaire: ['personnel_temporaire', 'temporaire', 'temporaires', 'cdd', 'stagiaires', 'personneltemporaire'],
  },
  engagement: {
    incube_ref: ['incube_ref', 'nom_incube', 'nomincube', 'nom', 'porteur', 'pp_numero', 'pp', 'projet', 'ref_incube', 'incubé'],
    mois: ['mois', 'periode'],
    annee: ['annee', 'exercice'],
    moyenne_heures_presence: ['moyenne_heures_presence', 'heures', 'heurespresence', 'heuresdepresence', 'presenceheures'],
    taux_presence_formation: ['taux_presence_formation', 'taux', 'tauxpresence', 'presenceformation', 'tauxpresenceformation'],
    initiatives: ['initiatives', 'initiative', 'activites', 'evenements'],
    observations: ['observations', 'observation', 'remarques', 'notes', 'assiduite'],
  },
  financier: {
    incube_ref: ['incube_ref', 'nom_incube', 'nomincube', 'nom', 'porteur', 'pp_numero', 'pp', 'projet', 'ref_incube', 'incubé'],
    mois: ['mois', 'numero_mois', 'n_mois'],
    annee: ['annee', 'exercice'],
    ventes: ['ventes', 'ca', 'chiffredaffaires', 'recettes', 'produits'],
    autres_revenus: ['autres_revenus', 'autresrevenus', 'subventions', 'revenusdivers'],
    achats: ['achats', 'achat', 'matierespremieres', 'marchandises'],
    charges_personnel: ['charges_personnel', 'chargespersonnel', 'salaires', 'masse_salariale'],
    charges_cnss: ['charges_cnss', 'chargescnss', 'cnss', 'cotisations'],
    salaire_porteur: ['salaire_porteur', 'salaireporteur', 'remuneration_gerant', 'gerant'],
    loyer_coworking: ['loyer_coworking', 'loyer', 'coworking', 'locaux'],
    eau_electricite: ['eau_electricite', 'eauelectricite', 'eau', 'electricite', 'energie'],
    transport: ['transport', 'deplacement', 'frais_deplacement'],
    telephone: ['telephone', 'telecom', 'internet', 'communication'],
    taxes: ['taxes', 'taxe', 'impots', 'patente'],
    tva: ['tva', 'tva_due', 'tva_a_payer'],
    remboursement_credit: ['remboursement_credit', 'remboursementcredit', 'credit', 'emprunt', 'banque'],
    autres_charges: ['autres_charges', 'autrescharges', 'divers', 'chargesdiverses'],
  },
  fiche_technique: {
    incube_ref: ['incube_ref', 'nom_incube', 'nomincube', 'nom', 'porteur', 'pp_numero', 'pp', 'projet', 'ref_incube', 'incubé'],
    numero_ordre: ['numero_ordre', 'numeroordre', 'ordre', 'noordre', 'nord', 'num', 'n', 'rang'],
    date_suivi: ['date_suivi', 'date', 'datesuivi', 'datedujour', 'datedecreation', 'datedintervention'],
    statut_juridique: ['statut_juridique', 'statutjuridique', 'formejuridique', 'juridique', 'statut'],
    statut_avancement: ['statut_avancement', 'statutavancement', 'avancement', 'etatavancement', 'etat_avancement', 'progression', 'etat'],
    anomalie_signalee: ['anomalie_signalee', 'anomaliesignalee', 'anomalie', 'anomalies', 'probleme', 'incident', 'anomaliesignale'],
    declaration_echec: ['declaration_echec', 'declarationechec', 'echec', 'echecs', 'abandon', 'motif_echec', 'echecdeclare'],
    observations: ['observations', 'observation', 'remarques', 'notes', 'commentaires', 'details']
  }
};

// Lecture d'un fichier Excel sélectionné par l'utilisateur
// Extraction depuis une fiche verticale (Clé : Valeur ou cellules adjacentes)
export const extractVerticalIncubeInfo = (worksheet, xlsxLib = XLSX) => {
  if (!worksheet) return null;
  const rawRows = xlsxLib.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  if (!rawRows || rawRows.length === 0) return null;

  // Détecter si la feuille est un tableau horizontal classique (ex: liste d'incubés en ligne)
  for (let r = 0; r < Math.min(rawRows.length, 5); r++) {
    const row = rawRows[r] || [];
    let headersFound = 0;
    for (const c of row) {
      const ck = cleanKey(c);
      if (ck && ['nom', 'nomdelincube', 'raisonsociale', 'phase', 'phaseduprojet', 'statut', 'statutjuridique', 'pp', 'nopp', 'accompagnateur'].some(h => ck === h || (ck.length > 3 && h.includes(ck)))) {
        headersFound++;
      }
    }
    if (headersFound >= 3) {
      return null; // Tableau horizontal multi-lignes, ne pas forcer l'extraction verticale
    }
  }

  const info = {};

  const assignKey = (k, v) => {
    if (!v || v === '—' || v === '-' || v === 'undefined') return;
    const vStr = String(v).trim();
    if (!vStr) return;

    if ((k.includes('nom') && (k.includes('incube') || k.includes('porteur') || k.includes('beneficiaire') || k.includes('candidat'))) || k === 'nom' || k === 'nomcomplet' || k === 'nometprenom' || k === 'nomporteur') {
      if (!info.nom_incube) info.nom_incube = vStr;
    } else if (k.includes('pp') || k.includes('numeropp') || k.includes('nopp') || k.includes('numpp') || k.includes('cin')) {
      if (!info.pp_numero) info.pp_numero = vStr;
    } else if (k.includes('situation') || k.includes('familiale') || k.includes('etatcivil')) {
      if (!info.situation_familiale) info.situation_familiale = vStr;
    } else if (k.includes('accompagnateur') || k.includes('coach') || k.includes('mentor') || k.includes('responsable')) {
      if (!info.accompagnateur) info.accompagnateur = vStr;
    } else if (k.includes('demarrage') || k.includes('debut') || k.includes('lancement') || k.includes('dmarrage')) {
      if (!info.date_demarrage) info.date_demarrage = formatExcelDate(vStr);
    } else if (k.includes('phase') || k.includes('stade') || k.includes('etape')) {
      // Priorité à 'phase' avant 'projet' ou 'statut'
      if (!info.phase_projet) {
        const vClean = cleanKey(vStr);
        if (vClean.includes('ideat')) info.phase_projet = 'Idéation';
        else if (vClean.includes('lanc')) info.phase_projet = 'Lancement';
        else if (vClean.includes('croiss')) info.phase_projet = 'Croissance';
        else if (vClean.includes('matur')) info.phase_projet = 'Maturité';
        else info.phase_projet = vStr;
      }
    } else if (k.includes('statut') || k.includes('forme') || k.includes('juridique')) {
      if (!info.statut_juridique) {
        const vClean = cleanKey(vStr);
        if (vClean.includes('auto') || vClean.includes('entrepreneur')) info.statut_juridique = 'Auto-entrepreneur';
        else if (vClean.includes('sarl')) info.statut_juridique = 'SARL';
        else if (vClean.includes('sa')) info.statut_juridique = 'SA';
        else if (vClean.includes('coop')) info.statut_juridique = 'Coopérative';
        else if (vClean.includes('assoc')) info.statut_juridique = 'Association';
        else info.statut_juridique = vStr;
      }
    } else if (k.includes('raison') || k.includes('social') || k.includes('societe') || k.includes('entreprise') || k.includes('structure') || (k.includes('projet') && !k.includes('phase'))) {
      if (!info.raison_sociale) info.raison_sociale = vStr;
    } else if (k.includes('promotion') || k.includes('promo') || k.includes('cohorte')) {
      if (!info.promotion) info.promotion = vStr;
    } else if (k.includes('secteur') || k.includes('activite') || k.includes('domaine')) {
      if (!info.secteur_activite) info.secteur_activite = vStr;
    }
  };

  for (let r = 0; r < rawRows.length; r++) {
    const row = rawRows[r] || [];
    for (let c = 0; c < row.length; c++) {
      const cellVal = String(row[c] || '').trim();
      if (!cellVal) continue;

      // Cas 1 : "Clé : Valeur" dans la même cellule
      if (cellVal.includes(':')) {
        const parts = cellVal.split(':');
        const k = cleanKey(parts[0]);
        const v = parts.slice(1).join(':').trim();
        if (v) assignKey(k, v);
      }

      // Cas 2 : Clé dans cellule courante et Valeur dans cellule suivante
      const nextVal = String(row[c + 1] || '').trim();
      if (nextVal) {
        const k = cleanKey(cellVal.replace(':', ''));
        const nextClean = cleanKey(nextVal);
        const isHeader = ['nom', 'raisonsociale', 'phaseduprojet', 'statutjuridique', 'nopp', 'situationfamiliale', 'accompagnateur', 'datededemarrage'].some(h => nextClean === h);
        if (!isHeader) {
          assignKey(k, nextVal);
        }
      }
    }
  }

  return Object.keys(info).length > 0 ? info : null;
};

// Analyse intelligente d'une feuille tabulaire avec recherche de la ligne d'en-tête
export const smartParseSheet = (worksheet, XLSX, type) => {
  if (!worksheet) return [];

  // Si type === 'incube', essayer d'abord la fiche verticale
  if (type === 'incube') {
    const vert = extractVerticalIncubeInfo(worksheet, XLSX);
    if (vert && (vert.nom_incube || vert.pp_numero || vert.raison_sociale)) {
      return [vert];
    }
  }

  const matrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  if (!matrix || matrix.length === 0) return [];

  const schema = MAPPINGS[type] || {};
  const allAliases = Object.values(schema).flat();

  let bestHeaderIdx = 0;
  let maxMatches = 0;

  for (let r = 0; r < Math.min(matrix.length, 25); r++) {
    const row = matrix[r] || [];
    let matches = 0;
    for (const cell of row) {
      const cClean = cleanKey(cell);
      if (cClean && allAliases.some(a => cClean.includes(a) || a.includes(cClean))) {
        matches++;
      }
    }
    if (matches > maxMatches) {
      maxMatches = matches;
      bestHeaderIdx = r;
    }
  }

  const jsonData = XLSX.utils.sheet_to_json(worksheet, {
    range: bestHeaderIdx,
    defval: '',
    raw: false
  });

  return jsonData;
};

// Extraction intelligente d'une feuille financière transposée (rubriques en lignes, mois en colonnes)
export const extractTransposedFinancialSheet = (worksheet, xlsxLib = XLSX) => {
  if (!worksheet) return null;
  const rawRows = xlsxLib.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  if (!rawRows || rawRows.length === 0) return null;

  const MOIS_MAP = [
    { name: 'janvier', mois: 1 },
    { name: 'fevrier', mois: 2 },
    { name: 'mars', mois: 3 },
    { name: 'avril', mois: 4 },
    { name: 'mai', mois: 5 },
    { name: 'juin', mois: 6 },
    { name: 'juillet', mois: 7 },
    { name: 'aout', mois: 8 },
    { name: 'septembre', mois: 9 },
    { name: 'octobre', mois: 10 },
    { name: 'novembre', mois: 11 },
    { name: 'decembre', mois: 12 }
  ];

  // 1. Chercher la ligne qui contient les noms de mois
  let monthRowIdx = -1;
  const monthCols = {};

  for (let r = 0; r < Math.min(rawRows.length, 12); r++) {
    const row = rawRows[r] || [];
    let matchCount = 0;
    for (let c = 0; c < row.length; c++) {
      const ck = cleanKey(row[c]);
      if (MOIS_MAP.some(m => ck.includes(m.name))) {
        matchCount++;
      }
    }
    if (matchCount >= 3) {
      monthRowIdx = r;
      for (let c = 0; c < row.length; c++) {
        const ck = cleanKey(row[c]);
        const found = MOIS_MAP.find(m => ck.includes(m.name) && !ck.includes('total') && !ck.includes('trimestre'));
        if (found) {
          monthCols[c] = found.mois;
        }
      }
      break;
    }
  }

  if (monthRowIdx === -1 || Object.keys(monthCols).length === 0) {
    return null;
  }

  const monthsData = {};
  for (let m = 1; m <= 12; m++) {
    monthsData[m] = {
      mois: m,
      ventes: 0, autres_revenus: 0,
      achats: 0, charges_personnel: 0, charges_cnss: 0, salaire_porteur: 0,
      loyer_coworking: 0, eau_electricite: 0, transport: 0, telephone: 0,
      taxes: 0, tva: 0, remboursement_credit: 0, autres_charges: 0
    };
  }

  const FIELD_KEYWORDS = {
    ventes: ['vente', 'chiffredaffaire', 'ca'],
    autres_revenus: ['autrerevenu', 'autresrevenu', 'subvention'],
    achats: ['achat', 'marchandise', 'matiere'],
    charges_personnel: ['chargesdupersonnel', 'chargepersonnel', 'chargespersonnel', 'personnel', 'salaire'],
    charges_cnss: ['cnss', 'cotisation'],
    salaire_porteur: ['salaireporteur', 'remunerationgerant'],
    loyer_coworking: ['loyer', 'coworking', 'local', 'locaux'],
    eau_electricite: ['eau', 'electricite', 'quittance', 'energie'],
    transport: ['transport', 'deplacement'],
    telephone: ['telephone', 'telecom', 'internet', 'communication'],
    taxes: ['taxe', 'impot', 'patente'],
    tva: ['tva'],
    remboursement_credit: ['credit', 'emprunt', 'banque', 'remboursement'],
    autres_charges: ['autrecharge', 'autrescharge', 'divers']
  };

  let hasValues = false;

  for (let r = monthRowIdx + 1; r < rawRows.length; r++) {
    const row = rawRows[r] || [];
    const label = cleanKey(row[0] || row[1] || '');
    if (!label || label.includes('total') || label.includes('resultat')) continue;

    let matchedField = null;
    for (const [fName, kwList] of Object.entries(FIELD_KEYWORDS)) {
      if (kwList.some(kw => label.includes(kw))) {
        matchedField = fName;
        break;
      }
    }

    if (matchedField) {
      for (const [colIdx, mNum] of Object.entries(monthCols)) {
        const rawVal = row[colIdx];
        if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
          const numVal = parseFloat(String(rawVal).replace(/[^0-9.-]/g, '')) || 0;
          if (numVal !== 0) {
            monthsData[mNum][matchedField] = numVal;
            hasValues = true;
          }
        }
      }
    }
  }

  return hasValues ? Object.values(monthsData) : null;
};

// Lecture d'un fichier Excel sélectionné par l'utilisateur
export const readExcelFile = async (file, type = 'incube') => {
  const XLSX = await loadXLSX();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        
        // 1. Trouver la feuille la plus pertinente selon le type
        let targetSheetName = workbook.SheetNames[0];
        const t = cleanKey(type);

        for (const sName of workbook.SheetNames) {
          const sClean = cleanKey(sName);
          if (t === 'incube' && (sClean.includes('info') || sClean.includes('general') || sClean.includes('incube') || sClean.includes('porteur') || sClean.includes('fiche'))) {
            targetSheetName = sName;
            break;
          } else if (t === 'materiel' && (sClean.includes('mat') || sClean.includes('equip'))) {
            targetSheetName = sName;
            break;
          } else if (t.includes('plan') && (sClean.includes('plan') || sClean.includes('action') || sClean.includes('avancement'))) {
            targetSheetName = sName;
            break;
          } else if (t.includes('rh') && (sClean.includes('ressource') || sClean.includes('humain') || sClean.includes('personnel') || sClean.includes('emploi'))) {
            targetSheetName = sName;
            break;
          } else if (t === 'engagement' && (sClean.includes('engag') || sClean.includes('implic') || sClean.includes('suivi') || sClean.includes('presenc'))) {
            targetSheetName = sName;
            break;
          } else if (t === 'financier' && (sClean.includes('finan') || sClean.includes('resultat') || sClean.includes('compta') || sClean.includes('analyse'))) {
            targetSheetName = sName;
            break;
          }
        }

        const ws = workbook.Sheets[targetSheetName];

        // 2. Si c'est un incubé, vérifier aussi s'il y a une fiche verticale
        if (type === 'incube') {
          const vert = extractVerticalIncubeInfo(ws, XLSX);
          if (vert && (vert.nom_incube || vert.pp_numero || vert.raison_sociale)) {
            return resolve([vert]);
          }
          for (const sName of workbook.SheetNames) {
            const v = extractVerticalIncubeInfo(workbook.Sheets[sName], XLSX);
            if (v && (v.nom_incube || v.pp_numero || v.raison_sociale)) {
              return resolve([v]);
            }
          }
        }

        // 3. Si c'est financier, vérifier d'abord la feuille transposée (ANALYSE RESULTAT)
        if (type === 'financier') {
          const trans = extractTransposedFinancialSheet(ws, XLSX);
          if (trans && trans.length > 0) {
            return resolve(trans);
          }
          for (const sName of workbook.SheetNames) {
            const tRes = extractTransposedFinancialSheet(workbook.Sheets[sName], XLSX);
            if (tRes && tRes.length > 0) {
              return resolve(tRes);
            }
          }
        }

        // 4. Parser avec détection dynamique d'en-tête
        const rawRows = smartParseSheet(ws, XLSX, type);
        resolve(rawRows);
      } catch (err) {
        reject(new Error("Format de fichier Excel non reconnu ou illisible."));
      }
    };
    reader.onerror = () => reject(new Error("Erreur lors de la lecture du fichier."));
    reader.readAsArrayBuffer(file);
  });
};


// Mapper les données brutes lues depuis Excel vers les champs du formulaire/modèle
export const mapExcelRows = (rawRows, type) => {
  const schema = MAPPINGS[type];
  if (!schema) return rawRows;

  return rawRows.map((rawRow) => {
    // Si c'est déjà un objet extrait verticalement (ex: fiche incubé)
    if (type === 'incube' && (rawRow.nom_incube || rawRow.pp_numero || rawRow.raison_sociale)) {
      return { ...rawRow };
    }
    // Si c'est déjà un objet extrait de la feuille financière transposée
    if (type === 'financier' && (rawRow.ventes !== undefined || rawRow.achats !== undefined || rawRow.charges_personnel !== undefined)) {
      return { ...rawRow };
    }

    const mapped = {};
    // Obtenir toutes les clés du rawRow nettoyées
    const rawKeysClean = Object.keys(rawRow).map(k => ({
      original: k,
      cleaned: cleanKey(k)
    }));

    const usedKeys = new Set();

    for (const [targetField, aliases] of Object.entries(schema)) {
      // 1. Correspondance exacte prioritaire
      let match = rawKeysClean.find(rk => !usedKeys.has(rk.original) && aliases.includes(rk.cleaned));

      // 2. Sinon, correspondance partielle sur l'alias le plus long,
      // en évitant d'associer la colonne d'incubé de référence aux autres champs
      if (!match) {
        const sorted = [...aliases].sort((a, b) => b.length - a.length);
        match = rawKeysClean.find(rk =>
          !usedKeys.has(rk.original) &&
          (targetField === 'incube_ref' || (!rk.cleaned.includes('incube') && !rk.cleaned.includes('porteur'))) &&
          sorted.some(a => a.length >= 4 && rk.cleaned.includes(a))
        );
      }

      if (match) {
        usedKeys.add(match.original);
        let val = rawRow[match.original];
        if (targetField.includes('date') || targetField === 'echeance') {
          val = formatExcelDate(val);
        } else if (typeof val === 'string') {
          val = val.trim();
        }
        mapped[targetField] = val;
      }
    }
    return mapped;
  });
};

// Alias pour rétrocompatibilité
export const mapRowsToFields = mapExcelRows;

// Générer et télécharger des modèles Excel (.xlsx) pré-remplis
export const downloadTemplate = async (type) => {
  const XLSX = await loadXLSX();

  const templates = {
    incube: {
      filename: 'modele_import_incubes.xlsx',
      sheetName: 'Incubes',
      data: [
        {
          "Nom de l'incubé": "Mohamed Alami",
          "Raison sociale": "BioTech Solutions SARL",
          "Phase du projet": "Idéation",
          "Statut juridique": "SARL",
          "N° PP": "PP-2025-001",
          "Situation familiale": "Marié(e)",
          "Promotion": "Promotion 1",
          "Secteur d'activité": "Intelligence Artificielle",
          "Accompagnateur": "Karim Benali",
          "Date de démarrage": "2025-01-15"
        },
        {
          "Nom de l'incubé": "Fatima Zahra Mansouri",
          "Raison sociale": "EcoPack Maroc",
          "Phase du projet": "Lancement",
          "Statut juridique": "Auto-entrepreneur",
          "N° PP": "PP-2025-002",
          "Situation familiale": "Célibataire",
          "Promotion": "Promotion 2",
          "Secteur d'activité": "GREEN-TECH",
          "Accompagnateur": "Nadia Tazi",
          "Date de démarrage": "2025-02-01"
        }
      ]
    },
    materiel: {
      filename: 'modele_import_materiel.xlsx',
      sheetName: 'Materiel',
      data: [
        {
          "Origine": "propre",
          "Article": "Ordinateur Portable Dell XPS 15",
          "Date acquisition": "2025-01-10",
          "Caractéristiques / N° série": "Intel i7, 32GB RAM, SN: 987654321",
          "Quantité": 1,
          "Valeur ou État": "Neuf / 14000 MAD"
        },
        {
          "Origine": "ids",
          "Article": "Imprimante 3D Creality Ender 3",
          "Date acquisition": "2025-02-05",
          "Caractéristiques / N° série": "Prêt Fablab IDS - SN: FAB-004",
          "Quantité": 1,
          "Valeur ou État": "Bon état"
        }
      ]
    },
    plan_action: {
      filename: 'modele_import_plan_action.xlsx',
      sheetName: 'PlanAction',
      data: [
        {
          "Mois": "Janvier",
          "Objectifs": "Finalisation du prototype fonctionnel (MVP)",
          "Échéance": "2025-01-31",
          "Réalisation": "Réalisé",
          "Problèmes rencontrés": "Léger retard de livraison des composants",
          "Commentaires": "MVP validé avec le mentor technique"
        },
        {
          "Mois": "Février",
          "Objectifs": "Lancement de la campagne de prospection B2B",
          "Échéance": "2025-02-28",
          "Réalisation": "En cours",
          "Problèmes rencontrés": "Aucun",
          "Commentaires": "5 premiers clients contactés"
        }
      ]
    },
    rh_personnel: {
      filename: 'modele_import_personnel.xlsx',
      sheetName: 'Personnel',
      data: [
        {
          "Nom complet": "Yassine Berrada",
          "Poste": "Développeur Fullstack",
          "Type de contrat": "CDI",
          "Date embauche": "2025-01-01",
          "Date fin": "",
          "Salaire mensuel": 9000
        },
        {
          "Nom complet": "Salma Bennani",
          "Poste": "Designer UI/UX",
          "Type de contrat": "Stage",
          "Date embauche": "2025-02-01",
          "Date fin": "2025-07-31",
          "Salaire mensuel": 3500
        }
      ]
    },
    rh_emploi: {
      filename: 'modele_import_emplois.xlsx',
      sheetName: 'Emplois',
      data: [
        { "Mois": "Janvier", "Personnel permanent": 2, "Personnel temporaire": 1 },
        { "Mois": "Février", "Personnel permanent": 3, "Personnel temporaire": 1 },
        { "Mois": "Mars", "Personnel permanent": 3, "Personnel temporaire": 2 }
      ]
    },
    engagement: {
      filename: 'modele_import_engagement.xlsx',
      sheetName: 'Engagement',
      data: [
        {
          "Mois": "Janvier",
          "Année": 2025,
          "Heures présence": 36,
          "Taux présence (%)": 95,
          "Initiatives": "Participation active aux ateliers techniques du Fablab",
          "Observations": "Très assidu et impliqué"
        },
        {
          "Mois": "Février",
          "Année": 2025,
          "Heures présence": 40,
          "Taux présence (%)": 100,
          "Initiatives": "Animation d'une session de partage d'expérience",
          "Observations": "Objectifs du mois atteints avec brio"
        }
      ]
    },
    financier: {
      filename: 'modele_import_finances.xlsx',
      sheetName: 'Finances',
      data: [
        {
          "Mois (1-12)": 1,
          "Année": 2025,
          "Ventes": 25000,
          "Autres revenus": 5000,
          "Achats": 8000,
          "Charges personnel": 9000,
          "CNSS": 1800,
          "Salaire porteur": 4000,
          "Loyer coworking": 1500,
          "Eau & Électricité": 300,
          "Transport": 600,
          "Téléphone": 400,
          "Taxes": 200,
          "TVA": 2500,
          "Remboursement crédit": 0,
          "Autres charges": 500
        },
        {
          "Mois (1-12)": 2,
          "Année": 2025,
          "Ventes": 32000,
          "Autres revenus": 0,
          "Achats": 10000,
          "Charges personnel": 9000,
          "CNSS": 1800,
          "Salaire porteur": 4500,
          "Loyer coworking": 1500,
          "Eau & Électricité": 350,
          "Transport": 700,
          "Téléphone": 400,
          "Taxes": 200,
          "TVA": 3200,
          "Remboursement crédit": 0,
          "Autres charges": 600
        }
      ]
    },
    fiche_technique: {
      filename: 'modele_fiche_technique.xlsx',
      sheetName: 'Fiche Technique',
      data: [
        {
          "N° Ordre": "1",
          "Date": "2025-01-15",
          "Statut Juridique": "SARL",
          "État d'avancement": "En cours",
          "Anomalie signalée": "Retard livraison matières premières",
          "Déclaration d'échec": "Non",
          "Observations": "Objectifs du 1er trimestre en bonne voie"
        },
        {
          "N° Ordre": "2",
          "Date": "2025-02-10",
          "Statut Juridique": "SARL",
          "État d'avancement": "Réalisé",
          "Anomalie signalée": "Aucune",
          "Déclaration d'échec": "Non",
          "Observations": "Lancement officiel de l'application"
        }
      ]
    }
  };

  const tpl = templates[type];
  if (!tpl) return;

  const ws = XLSX.utils.json_to_sheet(tpl.data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, tpl.sheetName);
  XLSX.writeFile(wb, tpl.filename);
};

// Lecture de TOUTES les feuilles d'un classeur Excel
export const readAllWorkbookSheets = async (file) => {
  const XLSX = await loadXLSX();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheets = {};
        for (const sheetName of workbook.SheetNames) {
          const ws = workbook.Sheets[sheetName];
          const sClean = cleanKey(sheetName);

          // 1. Feuille financière transposée (ex: ANALYSE RESULTAT)
          if (sClean.includes('resultat') || sClean.includes('analyse') || sClean.includes('finan')) {
            const transposed = extractTransposedFinancialSheet(ws, XLSX);
            if (transposed && transposed.length > 0) {
              sheets[sheetName] = transposed;
              continue;
            }
          }

          // 2. Fiche incubé verticale
          if (sClean.includes('info') || sClean.includes('general') || sClean.includes('incube')) {
            const vert = extractVerticalIncubeInfo(ws, XLSX);
            if (vert && (vert.nom_incube || vert.pp_numero || vert.raison_sociale)) {
              sheets[sheetName] = [vert];
              continue;
            }
          }

          sheets[sheetName] = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
        }
        resolve(sheets);
      } catch (err) {
        reject(new Error("Format de fichier Excel non reconnu ou illisible."));
      }
    };
    reader.onerror = () => reject(new Error("Erreur lors de la lecture du fichier."));
    reader.readAsArrayBuffer(file);
  });
};

// Téléchargement d'un classeur complet multi-onglets (Dossier complet incubé)
export const exportFullIncubeTemplate = async () => {
  const XLSX = await loadXLSX();
  const wb = XLSX.utils.book_new();

  // 1. Infos
  const wsInfos = XLSX.utils.json_to_sheet([
    {
      "Nom de l'incubé": "Mohamed Alami",
      "Raison sociale": "BioTech Solutions SARL",
      "Phase du projet": "Idéation",
      "Statut juridique": "SARL",
      "N° PP": "PP-2025-001",
      "Situation familiale": "Marié(e)",
      "Promotion": "Promotion 1",
      "Secteur d'activité": "Intelligence Artificielle",
      "Niveau d'étude": "Master 2",
      "Accompagnateur": "Meryem Amaqran",
      "Date de démarrage": "2025-01-15"
    }
  ]);
  XLSX.utils.book_append_sheet(wb, wsInfos, "1. Infos Générales");

  // 2. Matériel
  const wsMat = XLSX.utils.json_to_sheet([
    {
      "Origine (propre/ids)": "propre",
      "Article": "Ordinateur Portable Dell XPS 15",
      "Date acquisition": "2025-01-10",
      "Caractéristiques / N° série": "Intel i7, 32GB RAM, SN: 987654321",
      "Quantité": 1,
      "Valeur ou État": "Neuf / 14000 MAD"
    },
    {
      "Origine (propre/ids)": "ids",
      "Article": "Imprimante 3D Creality",
      "Date acquisition": "2025-02-05",
      "Caractéristiques / N° série": "Prêt Fablab IDS - SN: FAB-004",
      "Quantité": 1,
      "Valeur ou État": "Bon état"
    }
  ]);
  XLSX.utils.book_append_sheet(wb, wsMat, "2. Matériel");

  // 3. Plan d'action
  const wsPlan = XLSX.utils.json_to_sheet([
    {
      "Mois": "Janvier",
      "Objectifs": "Finalisation du prototype fonctionnel (MVP)",
      "Échéance": "2025-01-31",
      "Réalisation": "Réalisé",
      "Problèmes rencontrés": "Léger retard livraison",
      "Commentaires": "MVP validé avec le mentor"
    },
    {
      "Mois": "Février",
      "Objectifs": "Lancement campagne prospection B2B",
      "Échéance": "2025-02-28",
      "Réalisation": "En cours",
      "Problèmes rencontrés": "Aucun",
      "Commentaires": "5 premiers clients contactés"
    }
  ]);
  XLSX.utils.book_append_sheet(wb, wsPlan, "3. Plan d'Action");

  // 4. Personnel RH
  const wsPersonnel = XLSX.utils.json_to_sheet([
    {
      "Nom complet": "Yassine Berrada",
      "Poste": "Développeur Fullstack",
      "Type de contrat": "CDI",
      "Date embauche": "2025-01-01",
      "Date fin": "",
      "Salaire mensuel": 9000
    }
  ]);
  XLSX.utils.book_append_sheet(wb, wsPersonnel, "4. Personnel RH");

  // 5. Emplois RH
  const wsEmplois = XLSX.utils.json_to_sheet([
    { "Mois": "Janvier", "Personnel permanent": 2, "Personnel temporaire": 1 },
    { "Mois": "Février", "Personnel permanent": 3, "Personnel temporaire": 1 }
  ]);
  XLSX.utils.book_append_sheet(wb, wsEmplois, "5. Emplois RH");

  // 6. Finances
  const wsFinances = XLSX.utils.json_to_sheet([
    {
      "Mois (1-12)": 1,
      "Année": 2025,
      "Ventes": 25000,
      "Autres revenus": 5000,
      "Achats": 8000,
      "Charges personnel": 9000,
      "CNSS": 1800,
      "Salaire porteur": 4000,
      "Loyer coworking": 1500,
      "Eau & Électricité": 300,
      "Transport": 600,
      "Téléphone": 400,
      "Taxes": 200,
      "TVA": 2500,
      "Remboursement crédit": 0,
      "Autres charges": 500
    }
  ]);
  XLSX.utils.book_append_sheet(wb, wsFinances, "6. Finances");

  // 7. Engagement
  const wsEng = XLSX.utils.json_to_sheet([
    {
      "Mois": "Janvier",
      "Année": 2025,
      "Heures présence": 36,
      "Taux présence (%)": 95,
      "Initiatives": "Participation active aux ateliers",
      "Observations": "Très assidu"
    }
  ]);
  XLSX.utils.book_append_sheet(wb, wsEng, "7. Engagement");

  // 8. Associés
  const wsAssocies = XLSX.utils.json_to_sheet([
    {
      "Nom & prénom": "Karim Bennani",
      "CIN": "AB123456",
      "Fonction": "Co-fondateur (CTO)",
      "Tel": "0600112233"
    }
  ]);
  XLSX.utils.book_append_sheet(wb, wsAssocies, "8. Associés");

  // 9. Fiche Technique
  const wsFicheTech = XLSX.utils.json_to_sheet([
    {
      "N° Ordre": "1",
      "Date": "2025-01-15",
      "Statut Juridique": "SARL",
      "État d'avancement": "En cours",
      "Anomalie signalée": "Retard livraison matières premières",
      "Déclaration d'échec": "Non",
      "Observations": "Objectifs du 1er trimestre en bonne voie"
    }
  ]);
  XLSX.utils.book_append_sheet(wb, wsFicheTech, "9. Fiche Technique");

  XLSX.writeFile(wb, "modele_dossier_complet_incube.xlsx");
};

// Analyse automatique de toutes les feuilles d'un classeur pour les mapper
export const parseFullIncubeWorkbook = (allSheets) => {
  const result = {
    infos: null,
    materiel: [],
    plan_action: [],
    rh_personnel: [],
    rh_emploi: [],
    financier: [],
    engagement: [],
    associes: [],
    fiche_technique: [],
  };

  for (const [sheetName, rows] of Object.entries(allSheets)) {
    if (!rows || !rows.length) continue;
    const name = cleanKey(sheetName);

    // Détection par nom d'onglet ou par en-têtes
    if (name.includes('info') || name.includes('general') || name.includes('incube')) {
      const mapped = mapRowsToFields(rows, 'incube');
      if (mapped.length > 0) result.infos = mapped[0];
    } else if (name.includes('mat') || name.includes('equip')) {
      result.materiel.push(...mapRowsToFields(rows, 'materiel'));
    } else if (name.includes('plan') || name.includes('action')) {
      result.plan_action.push(...mapRowsToFields(rows, 'plan_action'));
    } else if (name.includes('personnel') || name.includes('equipe') || name.includes('salarie')) {
      result.rh_personnel.push(...mapRowsToFields(rows, 'rh_personnel'));
    } else if (name.includes('emploi')) {
      result.rh_emploi.push(...mapRowsToFields(rows, 'rh_emploi'));
    } else if (name.includes('finan') || name.includes('compta') || name.includes('tresor') || name.includes('resultat') || name.includes('analyse')) {
      if (rows.length > 0 && rows[0].mois !== undefined && (rows[0].ventes !== undefined || rows[0].achats !== undefined || rows[0].charges_personnel !== undefined)) {
        result.financier.push(...rows);
      } else {
        result.financier.push(...mapRowsToFields(rows, 'financier'));
      }
    } else if (name.includes('technique') || name.includes('fiche')) {
      result.fiche_technique.push(...mapRowsToFields(rows, 'fiche_technique'));
    } else if (name.includes('engag') || name.includes('presenc')) {
      result.engagement.push(...mapRowsToFields(rows, 'engagement'));
    } else if (name.includes('associe') || name.includes('partenaire')) {
      result.associes.push(...mapRowsToFields(rows, 'associes'));
    } else {
      // Analyse heuristique des colonnes de la feuille si le nom n'est pas explicite (ex: Feuil1, Sheet1)
      const firstRow = rows[0] || {};
      const keys = Object.keys(firstRow).map(cleanKey);
      if (keys.some(k => k.includes('anomalie') || k.includes('echec') || (k.includes('ordre') && k.includes('statut')))) {
        result.fiche_technique.push(...mapRowsToFields(rows, 'fiche_technique'));
      } else if (keys.some(k => k.includes('nomincube') || k.includes('raisonsociale') || k.includes('statutjuridique'))) {
        const mapped = mapRowsToFields(rows, 'incube');
        if (mapped.length > 0) result.infos = mapped[0];
      } else if (keys.some(k => k.includes('article') || k.includes('quantite') || k.includes('serie'))) {
        result.materiel.push(...mapRowsToFields(rows, 'materiel'));
      } else if (keys.some(k => k.includes('objectif') || k.includes('echeance') || k.includes('realisation'))) {
        result.plan_action.push(...mapRowsToFields(rows, 'plan_action'));
      } else if (keys.some(k => k.includes('poste') || k.includes('salaire') || k.includes('contrat'))) {
        result.rh_personnel.push(...mapRowsToFields(rows, 'rh_personnel'));
      } else if (keys.some(k => k.includes('permanent') || k.includes('temporaire'))) {
        result.rh_emploi.push(...mapRowsToFields(rows, 'rh_emploi'));
      } else if (keys.some(k => k.includes('vente') || k.includes('achat') || k.includes('charges'))) {
        result.financier.push(...mapRowsToFields(rows, 'financier'));
      } else if (keys.some(k => k.includes('heures') || k.includes('tauxpresence') || k.includes('initiative'))) {
        result.engagement.push(...mapRowsToFields(rows, 'engagement'));
      } else if (keys.some(k => k.includes('cin') && (k.includes('nom') || k.includes('fonction') || k.includes('tel')))) {
        result.associes.push(...mapRowsToFields(rows, 'associes'));
      }
    }
  }

  if (result.associes && result.associes.length > 0) {
    if (!result.infos) result.infos = {};
    result.infos.associes = result.associes;
  }

  return result;
};

// Télécharger le modèle global pour importer TOUS les incubés avec TOUS leurs détails
export const exportGlobalPromotionTemplate = async () => {
  const XLSX = await loadXLSX();
  const wb = XLSX.utils.book_new();

  // 1. Liste des incubés
  const wsIncubes = XLSX.utils.json_to_sheet([
    {
      "Nom de l'incubé": "Mohamed Alami",
      "Raison sociale": "BioTech Solutions SARL",
      "Phase du projet": "Idéation",
      "Statut juridique": "SARL",
      "N° PP": "PP-2025-001",
      "Situation familiale": "Marié(e)",
      "Promotion": "Promotion 1",
      "Secteur d'activité": "Intelligence Artificielle",
      "Accompagnateur": "Meryem Amaqran",
      "Date de démarrage": "2025-01-15"
    },
    {
      "Nom de l'incubé": "Fatima Zahra Mansouri",
      "Raison sociale": "EcoPack Maroc",
      "Phase du projet": "Lancement",
      "Statut juridique": "Auto-entrepreneur",
      "N° PP": "PP-2025-002",
      "Situation familiale": "Célibataire",
      "Promotion": "Promotion 2",
      "Secteur d'activité": "GREEN-TECH",
      "Accompagnateur": "Meryem Amaqran",
      "Date de démarrage": "2025-02-01"
    }
  ]);
  XLSX.utils.book_append_sheet(wb, wsIncubes, "1. Incubes");

  // 2. Matériel
  const wsMat = XLSX.utils.json_to_sheet([
    {
      "Nom Incubé ou N° PP": "Mohamed Alami",
      "Origine (propre/ids)": "propre",
      "Article": "Ordinateur Portable Dell XPS 15",
      "Date acquisition": "2025-01-10",
      "Caractéristiques / N° série": "Intel i7, 32GB RAM, SN: 987654321",
      "Quantité": 1,
      "Valeur ou État": "Neuf / 14000 MAD"
    },
    {
      "Nom Incubé ou N° PP": "Fatima Zahra Mansouri",
      "Origine (propre/ids)": "ids",
      "Article": "Imprimante 3D Creality Ender 3",
      "Date acquisition": "2025-02-05",
      "Caractéristiques / N° série": "Prêt Fablab IDS - SN: FAB-004",
      "Quantité": 1,
      "Valeur ou État": "Bon état"
    }
  ]);
  XLSX.utils.book_append_sheet(wb, wsMat, "2. Materiel");

  // 3. Plan d'Action
  const wsPlan = XLSX.utils.json_to_sheet([
    {
      "Nom Incubé ou N° PP": "Mohamed Alami",
      "Mois": "Janvier",
      "Objectifs": "Finalisation du prototype fonctionnel (MVP)",
      "Échéance": "2025-01-31",
      "Réalisation": "Réalisé",
      "Problèmes rencontrés": "Léger retard de livraison des composants",
      "Commentaires": "MVP validé avec le mentor technique"
    },
    {
      "Nom Incubé ou N° PP": "Fatima Zahra Mansouri",
      "Mois": "Février",
      "Objectifs": "Lancement de la campagne de prospection B2B",
      "Échéance": "2025-02-28",
      "Réalisation": "En cours",
      "Problèmes rencontrés": "Aucun",
      "Commentaires": "5 premiers clients contactés"
    }
  ]);
  XLSX.utils.book_append_sheet(wb, wsPlan, "3. Plan Action");

  // 4. Personnel RH
  const wsPers = XLSX.utils.json_to_sheet([
    {
      "Nom Incubé ou N° PP": "Mohamed Alami",
      "Nom complet": "Yassine Berrada",
      "Poste": "Développeur Fullstack",
      "Type de contrat": "CDI",
      "Date embauche": "2025-01-01",
      "Date fin": "",
      "Salaire mensuel": 9000
    },
    {
      "Nom Incubé ou N° PP": "Fatima Zahra Mansouri",
      "Nom complet": "Salma Bennani",
      "Poste": "Designer UI/UX",
      "Type de contrat": "Stage",
      "Date embauche": "2025-02-01",
      "Date fin": "2025-07-31",
      "Salaire mensuel": 3500
    }
  ]);
  XLSX.utils.book_append_sheet(wb, wsPers, "4. Personnel RH");

  // 5. Emplois RH
  const wsEmp = XLSX.utils.json_to_sheet([
    { "Nom Incubé ou N° PP": "Mohamed Alami", "Mois": "Janvier", "Personnel permanent": 2, "Personnel temporaire": 1 },
    { "Nom Incubé ou N° PP": "Fatima Zahra Mansouri", "Mois": "Février", "Personnel permanent": 1, "Personnel temporaire": 2 }
  ]);
  XLSX.utils.book_append_sheet(wb, wsEmp, "5. Emplois RH");

  // 6. Finances
  const wsFin = XLSX.utils.json_to_sheet([
    {
      "Nom Incubé ou N° PP": "Mohamed Alami",
      "Mois (1-12)": 1,
      "Année": 2025,
      "Ventes": 25000,
      "Autres revenus": 5000,
      "Achats": 8000,
      "Charges personnel": 9000,
      "CNSS": 1800,
      "Salaire porteur": 4000,
      "Loyer coworking": 1500,
      "Eau & Électricité": 300,
      "Transport": 600,
      "Téléphone": 400,
      "Taxes": 200,
      "TVA": 2500,
      "Remboursement crédit": 0,
      "Autres charges": 500
    },
    {
      "Nom Incubé ou N° PP": "Fatima Zahra Mansouri",
      "Mois (1-12)": 1,
      "Année": 2025,
      "Ventes": 18000,
      "Autres revenus": 2000,
      "Achats": 5000,
      "Charges personnel": 5000,
      "CNSS": 1000,
      "Salaire porteur": 3500,
      "Loyer coworking": 1200,
      "Eau & Électricité": 200,
      "Transport": 400,
      "Téléphone": 300,
      "Taxes": 150,
      "TVA": 1800,
      "Remboursement crédit": 0,
      "Autres charges": 300
    }
  ]);
  XLSX.utils.book_append_sheet(wb, wsFin, "6. Finances");

  // 7. Engagement
  const wsEng = XLSX.utils.json_to_sheet([
    {
      "Nom Incubé ou N° PP": "Mohamed Alami",
      "Mois": "Janvier",
      "Année": 2025,
      "Heures présence": 36,
      "Taux présence (%)": 95,
      "Initiatives": "Participation active aux ateliers techniques",
      "Observations": "Très assidu et motivé"
    },
    {
      "Nom Incubé ou N° PP": "Fatima Zahra Mansouri",
      "Mois": "Janvier",
      "Année": 2025,
      "Heures présence": 32,
      "Taux présence (%)": 90,
      "Initiatives": "Présentation de son prototype en plénière",
      "Observations": "Bonne intégration au groupe"
    }
  ]);
  XLSX.utils.book_append_sheet(wb, wsEng, "7. Engagement");

  XLSX.writeFile(wb, "modele_global_tous_incubes_avec_details.xlsx");
};

// Parser un classeur global contenant TOUS les incubés et TOUS leurs détails
export const parseGlobalPromotionWorkbook = (allSheets, fileName = '') => {
  const incubesMap = new Map(); // key -> { incube, materiel: [], plan_action: [], rh_personnel: [], rh_emploi: [], financier: [], engagement: [] }

  const getIncubeKey = (val) => {
    if (!val) return '';
    return cleanKey(val);
  };

  // 1. Étape 1 : Trouver la liste des incubés dans les feuilles
  let incubesFound = false;
  for (const [sheetName, rows] of Object.entries(allSheets)) {
    if (!rows || !rows.length) continue;
    const name = cleanKey(sheetName);
    if (name.includes('incube') || name.includes('liste') || name.includes('porteur') || name.includes('projet') || name.includes('beneficiaire')) {
      const mapped = mapRowsToFields(rows, 'incube');
      for (const inc of mapped) {
        if (!inc.nom_incube) continue;
        const key = getIncubeKey(inc.nom_incube);
        const ppKey = inc.pp_numero ? getIncubeKey(inc.pp_numero) : null;
        const record = {
          incube: inc,
          materiel: [],
          plan_action: [],
          rh_personnel: [],
          rh_emploi: [],
          financier: [],
          engagement: []
        };
        incubesMap.set(key, record);
        if (ppKey) incubesMap.set(ppKey, record);
      }
      if (incubesMap.size > 0) incubesFound = true;
      break;
    }
  }

  // Si aucune feuille spécifique 'incubes' n'a été trouvée, inspecter la 1ère feuille
  if (!incubesFound) {
    const firstSheetName = Object.keys(allSheets)[0];
    const rows = allSheets[firstSheetName];
    if (rows && rows.length > 0) {
      const mapped = mapRowsToFields(rows, 'incube');
      for (const inc of mapped) {
        if (!inc.nom_incube) continue;
        const key = getIncubeKey(inc.nom_incube);
        const ppKey = inc.pp_numero ? getIncubeKey(inc.pp_numero) : null;
        const record = {
          incube: inc,
          materiel: [],
          plan_action: [],
          rh_personnel: [],
          rh_emploi: [],
          financier: [],
          engagement: []
        };
        incubesMap.set(key, record);
        if (ppKey) incubesMap.set(ppKey, record);
      }
      if (incubesMap.size > 0) incubesFound = true;
    }
  }

  // Si toujours aucun incubé, chercher dans TOUTES les feuilles si une ligne contient un nom d'incubé
  if (incubesMap.size === 0) {
    for (const [sheetName, rows] of Object.entries(allSheets)) {
      if (!rows || !rows.length) continue;
      const mapped = mapRowsToFields(rows, 'incube');
      for (const inc of mapped) {
        if (inc.nom_incube) {
          const key = getIncubeKey(inc.nom_incube);
          const ppKey = inc.pp_numero ? getIncubeKey(inc.pp_numero) : null;
          const record = {
            incube: inc,
            materiel: [],
            plan_action: [],
            rh_personnel: [],
            rh_emploi: [],
            financier: [],
            engagement: []
          };
          incubesMap.set(key, record);
          if (ppKey) incubesMap.set(ppKey, record);
        }
      }
      if (incubesMap.size > 0) break;
    }
  }

  // Si toujours aucun incubé, déduire depuis le nom du fichier (ex: TABLEAU_DE_SUIVI_INCUBES_Ahmed_Haij.xlsx -> Ahmed Haij)
  if (incubesMap.size === 0) {
    let fallbackNom = '';
    if (fileName) {
      fallbackNom = fileName
        .replace(/\.(xlsx|xls|csv)$/i, '')
        .replace(/[_\-]+/g, ' ')
        .replace(/\b(tableau|de|du|suivi|incube|incubes|cgs|ids)\b/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
    }
    if (fallbackNom && fallbackNom.length >= 2) {
      const defaultInc = {
        nom_incube: fallbackNom,
        raison_sociale: `Projet ${fallbackNom}`,
        phase_projet: 'Idéation',
        statut_juridique: 'SARL',
        pp_numero: 'PP-' + Math.floor(1000 + Math.random() * 9000),
        situation_familiale: '',
        accompagnateur: '',
        date_demarrage: new Date().toISOString().split('T')[0]
      };
      const key = getIncubeKey(fallbackNom);
      const record = {
        incube: defaultInc,
        materiel: [],
        plan_action: [],
        rh_personnel: [],
        rh_emploi: [],
        financier: [],
        engagement: []
      };
      incubesMap.set(key, record);
    }
  }

  // Fonction utilitaire pour associer une ligne de détail à un incubé
  const associateRow = (row, fieldType) => {
    let target = null;
    const ref = row.incube_ref || row.nom_incube || row.pp_numero;
    if (ref) {
      const k = getIncubeKey(ref);
      target = incubesMap.get(k);
      if (!target) {
        // Recherche partielle (fuzzy)
        for (const [mapKey, item] of incubesMap.entries()) {
          if (mapKey.includes(k) || k.includes(mapKey)) {
            target = item;
            break;
          }
        }
      }
    }

    // Si non trouvé et qu'il n'y a qu'un seul incubé, l'assigner à celui-ci
    if (!target) {
      const uniqueItems = Array.from(new Set(incubesMap.values()));
      if (uniqueItems.length === 1) {
        target = uniqueItems[0];
      }
    }

    if (target) {
      target[fieldType].push(row);
    }
  };

  // 2. Étape 2 : Mapper les autres feuilles
  for (const [sheetName, rows] of Object.entries(allSheets)) {
    if (!rows || !rows.length) continue;
    const name = cleanKey(sheetName);

    if (name.includes('mat') || name.includes('equip')) {
      const mapped = mapRowsToFields(rows, 'materiel');
      mapped.forEach(r => associateRow(r, 'materiel'));
    } else if (name.includes('plan') || name.includes('action')) {
      const mapped = mapRowsToFields(rows, 'plan_action');
      mapped.forEach(r => associateRow(r, 'plan_action'));
    } else if (name.includes('personnel') || name.includes('salarie') || name.includes('equipe')) {
      const mapped = mapRowsToFields(rows, 'rh_personnel');
      mapped.forEach(r => associateRow(r, 'rh_personnel'));
    } else if (name.includes('emploi')) {
      const mapped = mapRowsToFields(rows, 'rh_emploi');
      mapped.forEach(r => associateRow(r, 'rh_emploi'));
    } else if (name.includes('finan') || name.includes('compta') || name.includes('tresor')) {
      const mapped = mapRowsToFields(rows, 'financier');
      mapped.forEach(r => associateRow(r, 'financier'));
    } else if (name.includes('engag') || name.includes('presenc') || name.includes('suivi')) {
      const mapped = mapRowsToFields(rows, 'engagement');
      mapped.forEach(r => associateRow(r, 'engagement'));
    } else {
      // Analyse heuristique des colonnes de la feuille
      const firstRow = rows[0] || {};
      const keys = Object.keys(firstRow).map(cleanKey);
      if (keys.some(k => k.includes('article') || k.includes('quantite') || k.includes('serie'))) {
        const mapped = mapRowsToFields(rows, 'materiel');
        mapped.forEach(r => associateRow(r, 'materiel'));
      } else if (keys.some(k => k.includes('objectif') || k.includes('echeance') || k.includes('realisation'))) {
        const mapped = mapRowsToFields(rows, 'plan_action');
        mapped.forEach(r => associateRow(r, 'plan_action'));
      } else if (keys.some(k => k.includes('poste') || k.includes('salaire') || k.includes('contrat'))) {
        const mapped = mapRowsToFields(rows, 'rh_personnel');
        mapped.forEach(r => associateRow(r, 'rh_personnel'));
      } else if (keys.some(k => k.includes('permanent') || k.includes('temporaire'))) {
        const mapped = mapRowsToFields(rows, 'rh_emploi');
        mapped.forEach(r => associateRow(r, 'rh_emploi'));
      } else if (keys.some(k => k.includes('vente') || k.includes('achat') || k.includes('charges'))) {
        const mapped = mapRowsToFields(rows, 'financier');
        mapped.forEach(r => associateRow(r, 'financier'));
      } else if (keys.some(k => k.includes('heures') || k.includes('tauxpresence') || k.includes('initiative'))) {
        const mapped = mapRowsToFields(rows, 'engagement');
        mapped.forEach(r => associateRow(r, 'engagement'));
      }
    }
  }

  // Renvoyer la liste dédoublonnée des incubés avec leurs détails
  return Array.from(new Set(incubesMap.values()));
};
