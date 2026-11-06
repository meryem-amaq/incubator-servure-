import XLSX from 'xlsx-js-style';

export const loadXLSX = () => {
  return Promise.resolve(XLSX);
};

// Application du style visuel officiel IDS (Bleu Marine, bordures nettes, freeze pane, alternance de lignes)
export const applyIdsTableStyle = (ws, totalRows = 0, isTemplate = false) => {
  if (!ws || !ws['!ref']) return;

  // 1. Hauteurs de ligne aérées
  ws['!rows'] = [{ hpt: 30 }]; // Ligne d'en-tête (30pt)
  const nbRowsToStyle = Math.max(totalRows || 0, isTemplate ? 10 : 0);
  for (let r = 1; r <= nbRowsToStyle; r++) {
    ws['!rows'].push({ hpt: 22 });
  }

  // 2. Figer la 1ère ligne d'en-tête (Freeze Pane)
  ws['!views'] = [{ state: 'frozen', ySplit: 1 }];

  // 3. Styliser l'en-tête et les cellules
  const range = XLSX.utils.decode_range(ws['!ref']);

  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[cellAddress]) {
        if (isTemplate && R > 0) {
          ws[cellAddress] = { t: 's', v: '' };
        } else {
          continue;
        }
      }
      const cell = ws[cellAddress];

      if (R === 0) {
        // En-tête officiel IDS (Bleu marine #0F172A, texte blanc gras, centré)
        cell.s = {
          fill: { fgColor: { rgb: "0F172A" } },
          font: { name: "Calibri", sz: 11, bold: true, color: { rgb: "FFFFFF" } },
          alignment: { vertical: "center", horizontal: "center", wrapText: true },
          border: {
            top: { style: "thin", color: { rgb: "334155" } },
            bottom: { style: "medium", color: { rgb: "0F172A" } },
            left: { style: "thin", color: { rgb: "334155" } },
            right: { style: "thin", color: { rgb: "334155" } }
          }
        };
      } else {
        // Lignes de données : alternance de lignes blanches et gris perle
        const isZebra = R % 2 === 1;
        cell.s = {
          fill: { fgColor: { rgb: isZebra ? "FFFFFF" : "F8FAFC" } },
          font: { name: "Calibri", sz: 10, color: { rgb: "1E293B" } },
          alignment: { vertical: "center", horizontal: "left" },
          border: {
            top: { style: "thin", color: { rgb: "E2E8F0" } },
            bottom: { style: "thin", color: { rgb: "E2E8F0" } },
            left: { style: "thin", color: { rgb: "E2E8F0" } },
            right: { style: "thin", color: { rgb: "E2E8F0" } }
          }
        };
        // Forcer format texte pour téléphone ou codes commençant par 0
        if (cell.v !== undefined && cell.v !== null && String(cell.v).startsWith('0')) {
          cell.z = '@';
        }
      }
    }
  }
};

// ============================================================================
// RESTRUCTURATION OPTION B : 2 TABLEAUX SUPERPOSÉS SUR LA MÊME FEUILLE
// Tableau 1 : Informations Générales Porteur & Startup (21 colonnes)
// Tableau 2 : Associés & Partenaires de la Startup (6 colonnes)
// ============================================================================

export const OPTION_B_COLUMNS_INCUBE = [
  { key: 'nom_incube', label: "Nom de l'incubé *", width: 26, required: true },
  { key: 'pp_numero', label: "N° Porteur de Projet", width: 20 },
  { key: 'cin', label: "CIN", width: 15 },
  { key: 'situation_familiale', label: "Situation familiale", width: 18 },
  { key: 'email', label: "Email", width: 28 },
  { key: 'telephone', label: "Téléphone", width: 16 },
  { key: 'raison_sociale', label: "Raison sociale", width: 26 },
  { key: 'rc', label: "Registre du Commerce (RC)", width: 22 },
  { key: 'statut_juridique', label: "Statut juridique", width: 18 },
  { key: 'phase_projet', label: "Phase du projet", width: 16 },
  { key: 'promotion', label: "Promotion", width: 16 },
  { key: 'accompagnateur', label: "Accompagnateur référent", width: 24 },
  { key: 'date_demarrage', label: "Date de démarrage", width: 16 },
  { key: 'province', label: "Province", width: 16 },
  { key: 'ville', label: "Ville", width: 16 },
  { key: 'genre', label: "Genre", width: 12 },
  { key: 'secteur_activite', label: "Secteur d'activité", width: 24 },
  { key: 'date_naissance', label: "Date de naissance", width: 16 },
  { key: 'age', label: "Âge", width: 14 },
  { key: 'niveau_etude', label: "Niveau d'étude", width: 20 },
  { key: 'badge_id', label: "N° Badge RFID", width: 16 }
];

export const OPTION_B_COLUMNS_ASSOCIES = [
  { key: 'incube_ref', label: "Nom Incubé ou N° PP *", width: 26, required: true },
  { key: 'nom', label: "Nom & prénom de l'associé *", width: 26, required: true },
  { key: 'cin', label: "CIN Associé", width: 16 },
  { key: 'fonction', label: "Fonction (Rôle)", width: 22 },
  { key: 'tel', label: "Téléphone Associé", width: 18 },
  { key: 'badge_id', label: "N° Badge RFID Associé", width: 22 }
];

// Construction de la feuille principale "Infos Générales" avec 2 tableaux superposés
export const buildOptionBSheet = (incubesList = [], isTemplate = false, xlsxLib = XLSX) => {
  const ws = {};
  const merges = [];
  const rows = [];
  let currentRow = 0;

  // --- 1. BANNIÈRE TABLEAU 1 (Porteur & Startup - Bleu Marine IDS #0F172A) ---
  const banner1Text = "📋 1. INFORMATIONS GÉNÉRALES DU PORTEUR ET DE LA STARTUP";
  merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: OPTION_B_COLUMNS_INCUBE.length - 1 } });
  rows.push({ hpt: 32 });

  for (let c = 0; c < OPTION_B_COLUMNS_INCUBE.length; c++) {
    const addr = xlsxLib.utils.encode_cell({ r: currentRow, c });
    ws[addr] = {
      t: 's',
      v: c === 0 ? banner1Text : '',
      s: {
        fill: { fgColor: { rgb: "0F172A" } },
        font: { name: "Calibri", sz: 12, bold: true, color: { rgb: "FFFFFF" } },
        alignment: { vertical: "center", horizontal: "center" },
        border: {
          top: { style: "thin", color: { rgb: "334155" } },
          bottom: { style: "thin", color: { rgb: "334155" } },
          left: { style: "thin", color: { rgb: "334155" } },
          right: { style: "thin", color: { rgb: "334155" } }
        }
      }
    };
  }
  currentRow++;

  // --- 2. EN-TÊTE TABLEAU 1 (Slate foncé #1E293B) ---
  rows.push({ hpt: 30 });
  OPTION_B_COLUMNS_INCUBE.forEach((col, c) => {
    const addr = xlsxLib.utils.encode_cell({ r: currentRow, c });
    ws[addr] = {
      t: 's',
      v: col.label,
      s: {
        fill: { fgColor: { rgb: "1E293B" } },
        font: { name: "Calibri", sz: 10, bold: true, color: { rgb: "FFFFFF" } },
        alignment: { vertical: "center", horizontal: "center", wrapText: true },
        border: {
          top: { style: "thin", color: { rgb: "334155" } },
          bottom: { style: "medium", color: { rgb: "0F172A" } },
          left: { style: "thin", color: { rgb: "334155" } },
          right: { style: "thin", color: { rgb: "334155" } }
        }
      }
    };
  });
  currentRow++;

  // --- 3. LIGNES TABLEAU 1 (Données réelles ou 5 lignes vierges formatées si modèle) ---
  const nbIncubes = incubesList.length;
  const nbTable1Rows = isTemplate ? Math.max(nbIncubes, 5) : nbIncubes;

  for (let r = 0; r < nbTable1Rows; r++) {
    const inc = incubesList[r] || {};
    rows.push({ hpt: 22 });
    const isZebra = r % 2 === 1;

    OPTION_B_COLUMNS_INCUBE.forEach((col, c) => {
      const addr = xlsxLib.utils.encode_cell({ r: currentRow, c });
      let val = inc[col.key] !== undefined && inc[col.key] !== null ? inc[col.key] : '';
      if (col.key === 'accompagnateur' && inc.accompagnateurAdmin) {
        val = `${inc.accompagnateurAdmin.prenom || ''} ${inc.accompagnateurAdmin.nom || ''}`.trim() || inc.accompagnateur || '';
      }
      if ((col.key === 'date_demarrage' || col.key === 'date_naissance') && val) {
        val = String(val).split('T')[0];
      }

      ws[addr] = {
        t: 's',
        v: String(val),
        s: {
          fill: { fgColor: { rgb: isZebra ? "F8FAFC" : "FFFFFF" } },
          font: { name: "Calibri", sz: 10, color: { rgb: "1E293B" } },
          alignment: { vertical: "center", horizontal: "left" },
          border: {
            top: { style: "thin", color: { rgb: "E2E8F0" } },
            bottom: { style: "thin", color: { rgb: "E2E8F0" } },
            left: { style: "thin", color: { rgb: "E2E8F0" } },
            right: { style: "thin", color: { rgb: "E2E8F0" } }
          }
        }
      };
      if (val && String(val).startsWith('0')) {
        ws[addr].z = '@';
      }
    });
    currentRow++;
  }

  // --- 4. SÉPARATEUR ENTRE LES DEUX TABLEAUX (2 lignes vides) ---
  for (let s = 0; s < 2; s++) {
    rows.push({ hpt: 15 });
    currentRow++;
  }

  // --- 5. BANNIÈRE TABLEAU 2 (Associés & Partenaires - Vert Émeraude IDS #065F46) ---
  const banner2Text = "👥 2. ASSOCIÉS & PARTENAIRES DE LA STARTUP";
  merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: OPTION_B_COLUMNS_ASSOCIES.length - 1 } });
  rows.push({ hpt: 30 });

  for (let c = 0; c < OPTION_B_COLUMNS_ASSOCIES.length; c++) {
    const addr = xlsxLib.utils.encode_cell({ r: currentRow, c });
    ws[addr] = {
      t: 's',
      v: c === 0 ? banner2Text : '',
      s: {
        fill: { fgColor: { rgb: "065F46" } },
        font: { name: "Calibri", sz: 11, bold: true, color: { rgb: "FFFFFF" } },
        alignment: { vertical: "center", horizontal: "center" },
        border: {
          top: { style: "thin", color: { rgb: "047857" } },
          bottom: { style: "thin", color: { rgb: "047857" } },
          left: { style: "thin", color: { rgb: "047857" } },
          right: { style: "thin", color: { rgb: "047857" } }
        }
      }
    };
  }
  currentRow++;

  // --- 6. EN-TÊTE TABLEAU 2 (Vert Émeraude #047857) ---
  rows.push({ hpt: 28 });
  OPTION_B_COLUMNS_ASSOCIES.forEach((col, c) => {
    const addr = xlsxLib.utils.encode_cell({ r: currentRow, c });
    ws[addr] = {
      t: 's',
      v: col.label,
      s: {
        fill: { fgColor: { rgb: "047857" } },
        font: { name: "Calibri", sz: 10, bold: true, color: { rgb: "FFFFFF" } },
        alignment: { vertical: "center", horizontal: "center", wrapText: true },
        border: {
          top: { style: "thin", color: { rgb: "065F46" } },
          bottom: { style: "medium", color: { rgb: "064E3B" } },
          left: { style: "thin", color: { rgb: "065F46" } },
          right: { style: "thin", color: { rgb: "065F46" } }
        }
      }
    };
  });
  currentRow++;

  // --- 7. LIGNES TABLEAU 2 (Associés réels extraits ou 5 lignes vierges formatées si modèle) ---
  const allAssocies = [];
  incubesList.forEach(inc => {
    let list = [];
    try {
      list = typeof inc.associes === 'string' ? JSON.parse(inc.associes) : inc.associes;
    } catch (e) { list = []; }
    if (Array.isArray(list)) {
      list.forEach(a => {
        allAssocies.push({
          incube_ref: inc.nom_incube || inc.pp_numero || '',
          nom: a.nom || a.nom_complet || '',
          cin: a.cin || '',
          fonction: a.fonction || a.role || '',
          tel: a.tel || a.telephone || '',
          badge_id: a.badge_id || a.matricule || ''
        });
      });
    }
  });

  const nbAssocies = allAssocies.length;
  const nbTable2Rows = isTemplate ? Math.max(nbAssocies, 5) : nbAssocies;

  for (let r = 0; r < nbTable2Rows; r++) {
    const assoc = allAssocies[r] || {};
    rows.push({ hpt: 22 });
    const isZebra = r % 2 === 1;

    OPTION_B_COLUMNS_ASSOCIES.forEach((col, c) => {
      const addr = xlsxLib.utils.encode_cell({ r: currentRow, c });
      const val = assoc[col.key] !== undefined && assoc[col.key] !== null ? assoc[col.key] : '';

      ws[addr] = {
        t: 's',
        v: String(val),
        s: {
          fill: { fgColor: { rgb: isZebra ? "F0FDF4" : "FFFFFF" } },
          font: { name: "Calibri", sz: 10, color: { rgb: "064E3B" } },
          alignment: { vertical: "center", horizontal: "left" },
          border: {
            top: { style: "thin", color: { rgb: "D1FAE5" } },
            bottom: { style: "thin", color: { rgb: "D1FAE5" } },
            left: { style: "thin", color: { rgb: "D1FAE5" } },
            right: { style: "thin", color: { rgb: "D1FAE5" } }
          }
        }
      };
      if (val && String(val).startsWith('0')) {
        ws[addr].z = '@';
      }
    });
    currentRow++;
  }

  // Définir la plage totale de la feuille
  ws['!ref'] = xlsxLib.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: currentRow - 1, c: OPTION_B_COLUMNS_INCUBE.length - 1 }
  });
  ws['!merges'] = merges;
  ws['!rows'] = rows;

  // Calcul des largeurs optimales (max entre Tableau 1 et Tableau 2 pour les 6 premières colonnes)
  ws['!cols'] = OPTION_B_COLUMNS_INCUBE.map((col, idx) => {
    let width = col.width || 16;
    if (idx < OPTION_B_COLUMNS_ASSOCIES.length) {
      width = Math.max(width, OPTION_B_COLUMNS_ASSOCIES[idx].width || 16);
    }
    return { wch: width };
  });

  // Figer la bannière et l'en-tête du Tableau 1
  ws['!views'] = [{ state: 'frozen', ySplit: 2 }];

  return ws;
};

// Feuille d'instructions détaillée pour l'Option B
export const buildOptionBGuideSheet = (xlsxLib = XLSX) => {
  const guideData = [
    ["SECTION / TABLEAU", "COLONNE", "DESCRIPTION DU CHAMP", "EXEMPLE / FORMAT ATTENDU"],
    ["1. Porteur & Startup", "Nom de l'incubé *", "Nom et prénom complet du porteur de projet (Champ obligatoire)", "Ex: Ayoub El Mansouri"],
    ["1. Porteur & Startup", "N° Porteur de Projet", "Identifiant ou code de référence unique", "Ex: PP-2025-001"],
    ["1. Porteur & Startup", "CIN", "Numéro de la Carte Nationale d'Identité du porteur", "Ex: AB123456"],
    ["1. Porteur & Startup", "Situation familiale", "État civil du porteur", "Célibataire, Marié(e), Divorcé(e), Veuf(ve)"],
    ["1. Porteur & Startup", "Email", "Adresse email de contact pour alertes & RDV", "Ex: porteur@gmail.com"],
    ["1. Porteur & Startup", "Téléphone", "Numéro de téléphone mobile (le 0 initial est conservé)", "Ex: 0612345678"],
    ["1. Porteur & Startup", "Raison sociale", "Nom commercial ou raison sociale de la startup", "Ex: InnovTech Solutions SARL"],
    ["1. Porteur & Startup", "Registre du Commerce (RC)", "Numéro d'immatriculation au Registre du Commerce", "Ex: 124580"],
    ["1. Porteur & Startup", "Statut juridique", "Forme juridique légale de la structure", "Auto-entrepreneur, SARL, SARL AU, ou Autre"],
    ["1. Porteur & Startup", "Phase du projet", "Étape d'avancement actuelle de la startup", "Idéation, Lancement, Croissance, Maturité"],
    ["1. Porteur & Startup", "Promotion", "Cohorte / Session d'incubation IDS", "Promotion 1, Promotion 2, Promotion 3..."],
    ["1. Porteur & Startup", "Accompagnateur référent", "Nom du coach ou mentor IDS assigné", "Ex: Karim Benali"],
    ["1. Porteur & Startup", "Date de démarrage", "Date de début d'accompagnement IDS", "Format AAAA-MM-JJ (ex: 2025-01-15)"],
    ["1. Porteur & Startup", "Province", "Province ou préfecture", "Ex: Salé, Rabat, Kénitra..."],
    ["1. Porteur & Startup", "Ville", "Ville de localisation", "Ex: Salé, Rabat, Casablanca..."],
    ["1. Porteur & Startup", "Genre", "Genre du porteur de projet", "Homme ou Femme"],
    ["1. Porteur & Startup", "Secteur d'activité", "Domaine économique d'activité", "GREEN-TECH, E-Commerce, Intelligence Artificielle..."],
    ["1. Porteur & Startup", "Date de naissance", "Date de naissance du porteur", "Format AAAA-MM-JJ (ex: 1995-04-12)"],
    ["1. Porteur & Startup", "Âge", "Âge calculé automatiquement ou saisi", "Ex: 30"],
    ["1. Porteur & Startup", "Niveau d'étude", "Dernier diplôme ou niveau académique", "Bac+5 (Master / Ingénieur), Bac+3, Bac+2..."],
    ["1. Porteur & Startup", "N° Badge RFID", "Identifiant du badge physique pour tourniquets", "Ex: 0012345678"],
    ["2. Associés & Partenaires", "Nom Incubé ou N° PP *", "Rattachement au porteur principal du Tableau 1 (Obligatoire)", "Ex: Ayoub El Mansouri ou PP-2025-001"],
    ["2. Associés & Partenaires", "Nom & prénom de l'associé *", "Nom complet de l'associé / partenaire (Obligatoire)", "Ex: Sara Tazi"],
    ["2. Associés & Partenaires", "CIN Associé", "Carte Nationale d'Identité de l'associé", "Ex: CD112233"],
    ["2. Associés & Partenaires", "Fonction (Rôle)", "Rôle / Poste de l'associé au sein de la startup", "Ex: Co-gérante, CTO, Directeur Technique..."],
    ["2. Associés & Partenaires", "Téléphone Associé", "Numéro de téléphone de contact", "Ex: 0662345678"],
    ["2. Associés & Partenaires", "N° Badge RFID Associé", "Badge physique de contrôle d'accès tourniquet IDS", "Ex: 0098765432"]
  ];

  const ws = xlsxLib.utils.aoa_to_sheet(guideData);
  ws['!cols'] = [{ wch: 26 }, { wch: 28 }, { wch: 48 }, { wch: 45 }];
  applyIdsTableStyle(ws, guideData.length - 1, false);
  return ws;
};

// Création d'un classeur complet Option B (Feuille Infos Générales + Feuille Guide)
export const buildOptionBWorkbook = (incubesList = [], isTemplate = false, xlsxLib = XLSX) => {
  const wb = xlsxLib.utils.book_new();
  const wsInfos = buildOptionBSheet(incubesList, isTemplate, xlsxLib);
  xlsxLib.utils.book_append_sheet(wb, wsInfos, "Infos Générales");

  const wsGuide = buildOptionBGuideSheet(xlsxLib);
  xlsxLib.utils.book_append_sheet(wb, wsGuide, "Guide & Instructions");

  return wb;
};

// Extraction intelligente des deux tableaux superposés Option B
export const parseStackedOptionBSheet = (worksheet, xlsxLib = XLSX) => {
  if (!worksheet) return null;
  const matrix = xlsxLib.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  if (!matrix || matrix.length === 0) return null;

  // 1. Détecter l'en-tête du Tableau 1 (Incubés / Startup)
  let incubeHeaderRowIdx = -1;
  let incubeColsMap = {};
  let maxIncMatches = 0;

  for (let r = 0; r < Math.min(matrix.length, 20); r++) {
    const row = matrix[r] || [];
    let matches = 0;
    const tempMap = {};
    for (let c = 0; c < row.length; c++) {
      const ck = cleanKey(row[c]);
      if (!ck) continue;
      for (const colDef of OPTION_B_COLUMNS_INCUBE) {
        const colCk = cleanKey(colDef.label);
        if (ck === colCk || (ck.length >= 4 && (colCk.includes(ck) || ck.includes(colCk)))) {
          tempMap[c] = colDef.key;
          matches++;
          break;
        }
      }
    }
    if (matches >= 4 && matches > maxIncMatches) {
      maxIncMatches = matches;
      incubeHeaderRowIdx = r;
      incubeColsMap = tempMap;
    }
  }

  if (incubeHeaderRowIdx === -1) {
    return null; // Pas un tableau Option B valide
  }

  // 2. Détecter l'en-tête du Tableau 2 (Associés & Partenaires) situé APRÈS incubeHeaderRowIdx
  let assocHeaderRowIdx = -1;
  let assocColsMap = {};

  for (let r = incubeHeaderRowIdx + 1; r < matrix.length; r++) {
    const row = matrix[r] || [];
    let matches = 0;
    const tempMap = {};
    for (let c = 0; c < row.length; c++) {
      const ck = cleanKey(row[c]);
      if (!ck) continue;
      for (const colDef of OPTION_B_COLUMNS_ASSOCIES) {
        const colCk = cleanKey(colDef.label);
        if (ck === colCk || (ck.length >= 4 && (colCk.includes(ck) || ck.includes(colCk)))) {
          tempMap[c] = colDef.key;
          matches++;
          break;
        }
      }
    }
    if (matches >= 2) {
      assocHeaderRowIdx = r;
      assocColsMap = tempMap;
      break;
    }
  }

  // 3. Extraire les incubés entre incubeHeaderRowIdx et assocHeaderRowIdx
  const endIncubeRow = assocHeaderRowIdx !== -1 ? assocHeaderRowIdx : matrix.length;
  const incubes = [];

  for (let r = incubeHeaderRowIdx + 1; r < endIncubeRow; r++) {
    const row = matrix[r] || [];
    const firstCell = String(row[0] || '').trim();
    if (firstCell.includes('ASSOCIÉS') || firstCell.includes('ASSOCIES') || firstCell.includes('2.')) {
      break;
    }

    const inc = {};
    let hasData = false;

    for (const [colIdx, key] of Object.entries(incubeColsMap)) {
      const val = row[colIdx];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        let v = String(val).trim();
        if (key === 'date_naissance' || key === 'date_demarrage') {
          v = formatExcelDate(val);
        }
        inc[key] = v;
        hasData = true;
      }
    }

    if (hasData && (inc.nom_incube || inc.pp_numero || inc.cin || inc.raison_sociale)) {
      inc.associes = [];
      incubes.push(inc);
    }
  }

  // 4. Extraire les associés à partir de assocHeaderRowIdx + 1
  const associesList = [];
  if (assocHeaderRowIdx !== -1) {
    for (let r = assocHeaderRowIdx + 1; r < matrix.length; r++) {
      const row = matrix[r] || [];
      const assoc = {};
      let hasData = false;

      for (const [colIdx, key] of Object.entries(assocColsMap)) {
        const val = row[colIdx];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          assoc[key] = String(val).trim();
          hasData = true;
        }
      }

      if (hasData && (assoc.nom || assoc.cin || assoc.fonction)) {
        associesList.push(assoc);
      }
    }
  }

  // 5. Associer les associés à leurs incubés respectifs
  associesList.forEach(assoc => {
    let target = null;
    const ref = cleanKey(assoc.incube_ref);

    if (ref) {
      target = incubes.find(i => {
        const n = cleanKey(i.nom_incube);
        const p = cleanKey(i.pp_numero);
        return (n && (n === ref || n.includes(ref) || ref.includes(n))) ||
               (p && (p === ref || p.includes(ref) || ref.includes(p)));
      });
    }

    if (!target && incubes.length === 1) {
      target = incubes[0];
    }

    if (target) {
      target.associes.push({
        nom: assoc.nom || '',
        cin: assoc.cin || '',
        fonction: assoc.fonction || '',
        tel: assoc.tel || '',
        badge_id: assoc.badge_id || ''
      });
    }
  });

  return incubes.length > 0 ? incubes : null;
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
    cin: ['cin', 'cni', 'cnie', 'cartenationale', 'cartenationaledidentite', 'cinporteur', 'numcin', 'nocin', 'numcni', 'nocni', 'identite', 'pieceidentite', 'cartedidentite'],
    email: ['email', 'mail', 'courriel', 'adresseemail', 'e-mail'],
    telephone: ['telephone', 'tel', 'gsm', 'mobile', 'phone', 'contact'],
    genre: ['genre', 'sexe', 'civilite'],
    date_naissance: ['date_naissance', 'datenaissance', 'datedenaissance', 'ddn', 'naissance'],
    age: ['age'],
    niveau_etude: ['niveau_etude', 'niveau', 'etude', 'diplome', 'niveaudetude'],
    situation_familiale: ['situation_familiale', 'situation', 'situationfamiliale', 'etatcivil'],
    raison_sociale: ['raison_sociale', 'raisonsociale', 'societe', 'entreprise', 'projet', 'nomprojet', 'startup', 'structure'],
    statut_juridique: ['statut_juridique', 'statut', 'formejuridique', 'statutjuridique', 'statutlegal'],
    pp_numero: ['pp_numero', 'pp', 'nopp', 'npp', 'numeropp', 'numpp', 'codepp', 'identifiant', 'nporteurdeprojet', 'porteurdeprojet'],
    rc: ['rc', 'registrecommerce', 'registredecommerce', 'numrc', 'registreducommercerc', 'registreducommerce'],
    phase_projet: ['phase_projet', 'phase', 'phaseprojet', 'etape', 'stadedeprojet', 'stade', 'phaseduprojet'],
    secteur_activite: ['secteur_activite', 'secteur', 'activite', 'domaine', 'secteuractivite', 'domainedactivite', 'secteurdactivite'],
    province: ['province', 'prefecture', 'region'],
    ville: ['ville', 'cite', 'commune'],
    promotion: ['promotion', 'promo', 'promotion_nom', 'nopromotion', 'cohorte', 'session'],
    accompagnateur: ['accompagnateur', 'coach', 'responsable', 'mentore', 'referent', 'accompagnateurreferent'],
    date_demarrage: ['date_demarrage', 'datededemarrage', 'datedebut', 'debut', 'date', 'datedelancement'],
    badge_id: ['badge_id', 'badge', 'badgerfid', 'rfid', 'numérobadge', 'numerobadge', 'codebadge', 'badgeacces', 'nbadgerfid'],
    associes: ['associes', 'partenaires', 'co-fondateurs', 'cofondateurs']
  },
  formation: {
    incube_ref: ['incube_ref', 'nom_incube', 'nomincube', 'nom', 'porteur', 'pp_numero', 'pp', 'projet', 'ref_incube', 'incubé'],
    theme: ['theme', 'titre', 'intitule', 'formation', 'module', 'nomformation', 'nom_formation'],
    formateur: ['formateur', 'intervenant', 'animateur', 'enseignant', 'expert'],
    heures: ['heures', 'duree', 'volume_horaire', 'nb_heures'],
    date_formation: ['date_formation', 'date', 'dateformation', 'jour'],
    presence: ['presence', 'statut_presence', 'etat_presence', 'statut'],
    attestation: ['attestation', 'certificat', 'valide']
  },
  associes: {
    incube_ref: ['incube_ref', 'nomincube', 'nom_incube', 'pp', 'pp_numero', 'nomincubeounpp', 'porteur', 'ref_incube'],
    nom: ['nom', 'nometprenom', 'nom_prenom', 'nomcomplet', 'nometprenomdelassocie', 'nomdelassocie', 'associe'],
    cin: ['cin', 'cnie', 'carte', 'id', 'cinassocie', 'cni'],
    fonction: ['fonction', 'role', 'poste', 'titre', 'fonctionrole'],
    tel: ['tel', 'telephone', 'contact', 'telephoneassocie', 'gsm', 'mobile'],
    badge_id: ['badge_id', 'badge', 'badgerfid', 'rfid', 'nbadgerfidassocie', 'nbadgerfid', 'numerobadge']
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

        // 2. Si c'est un incubé :
        if (type === 'incube') {
          // A. Vérifier en priorité absolue la structure Option B superposée (Tableau 1 Porteur + Tableau 2 Associés)
          const stacked = parseStackedOptionBSheet(ws, XLSX);
          if (stacked && stacked.length > 0) {
            return resolve(stacked);
          }
          for (const sName of workbook.SheetNames) {
            const sStacked = parseStackedOptionBSheet(workbook.Sheets[sName], XLSX);
            if (sStacked && sStacked.length > 0) {
              return resolve(sStacked);
            }
          }

          // B. Sinon, vérifier s'il y a une fiche verticale
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

    if (rawRow.associes && Array.isArray(rawRow.associes)) {
      mapped.associes = rawRow.associes;
    }

    return mapped;
  });
};

// Alias pour rétrocompatibilité
export const mapRowsToFields = mapExcelRows;

// Générer et télécharger des modèles Excel (.xlsx) 100% VIERGES (sans fausses données de démo) et stylisés aux couleurs IDS
export const downloadTemplate = async (type) => {
  const XLSX = await loadXLSX();

  // Pour les incubés, générer la structure officielle Option B (Tableau Porteur + Tableau Associés superposés, 100% vierge)
  if (type === 'incube') {
    const wb = buildOptionBWorkbook([], true, XLSX);
    XLSX.writeFile(wb, 'modele_import_incubes_vierge.xlsx');
    return;
  }

  const templates = {
    incube: {
      filename: 'modele_import_incubes_vierge.xlsx',
      sheetName: 'Incubes',
      headers: [
        "Nom de l'incubé *",
        "CIN",
        "N° PP",
        "Email",
        "Téléphone",
        "Raison sociale",
        "Statut juridique",
        "RC",
        "Phase du projet",
        "Secteur d'activité",
        "Promotion",
        "Accompagnateur",
        "Date de démarrage",
        "Genre",
        "Date de naissance",
        "Âge",
        "Niveau d'étude",
        "Situation familiale",
        "Ville",
        "Province",
        "N° Badge RFID"
      ],
      guide: [
        ["Nom de l'incubé *", "Nom et prénom du porteur (Champ obligatoire)", "Ex: Ayoub El Mansouri"],
        ["CIN", "Carte Nationale d'Identité (Optionnel mais recommandé)", "Ex: AB123456"],
        ["N° PP", "Numéro Porteur de Projet", "Ex: PP-2025-001"],
        ["Email", "Adresse email du porteur pour les convocations et alertes", "Ex: porteur@gmail.com"],
        ["Téléphone", "Numéro de téléphone mobile (le 0 initial sera conservé)", "Ex: 0612345678"],
        ["Raison sociale", "Nom du projet ou raison sociale de la structure", "Ex: InnovTech Solutions SARL"],
        ["Statut juridique", "Forme légale de la startup", "Auto-entrepreneur, SARL, SARL AU, ou Autre"],
        ["RC", "Numéro d'immatriculation au Registre du Commerce", "Ex: 124580"],
        ["Phase du projet", "Étape actuelle d'avancement de la startup", "Idéation, Lancement, Croissance, Maturité"],
        ["Secteur d'activité", "Domaine économique d'activité", "GREEN-TECH, Intelligence Artificielle, E-Commerce..."],
        ["Promotion", "Nom de la promotion / cohorte", "Promotion 1, Promotion 2, Promotion 3..."],
        ["Accompagnateur", "Nom du coach ou mentor référent IDS", "Ex: Karim Benali"],
        ["Date de démarrage", "Date de début de l'accompagnement", "Format AAAA-MM-JJ (ex: 2025-01-15)"],
        ["Genre", "Genre du porteur de projet", "Homme ou Femme"],
        ["Date de naissance", "Date de naissance du porteur", "Format AAAA-MM-JJ (ex: 1995-04-12)"],
        ["Âge", "Âge calculé ou saisi", "Ex: 30"],
        ["Niveau d'étude", "Dernier diplôme ou niveau académique", "Bac, Bac+2, Bac+3, Bac+5, Doctorat..."],
        ["Situation familiale", "État civil", "Célibataire, Marié(e), Divorcé(e), Veuf(ve)"],
        ["Ville", "Ville de résidence ou d'activité", "Ex: Salé, Rabat, Kénitra..."],
        ["Province", "Province ou préfecture", "Ex: Salé, Rabat, Kénitra..."],
        ["N° Badge RFID", "Identifiant du badge physique pour les tourniquets", "Ex: 0012345678"]
      ]
    },
    materiel: {
      filename: 'modele_import_materiel_vierge.xlsx',
      sheetName: 'Materiel',
      headers: [
        "Origine (propre/ids) *",
        "Article *",
        "Date acquisition",
        "Caractéristiques / N° série",
        "Quantité",
        "Valeur ou État"
      ],
      guide: [
        ["Origine (propre/ids) *", "Type de propriété du matériel", "propre (matériel incubé) OU ids (prêt incubateur)"],
        ["Article *", "Désignation de l'équipement", "Ex: Ordinateur portable Dell XPS 15"],
        ["Date acquisition", "Date d'achat ou de mise à disposition", "Format AAAA-MM-JJ (ex: 2025-01-10)"],
        ["Caractéristiques / N° série", "Spécifications techniques ou SN", "Ex: 16GB RAM, SN: 987654321"],
        ["Quantité", "Nombre d'unités", "Ex: 1"],
        ["Valeur ou État", "Valeur en MAD ou état physique", "Ex: Neuf / 14000 MAD ou Bon état"]
      ]
    },
    plan_action: {
      filename: 'modele_import_plan_action_vierge.xlsx',
      sheetName: 'PlanAction',
      headers: [
        "Mois *",
        "Objectifs *",
        "Échéance",
        "Réalisation",
        "Problèmes rencontrés",
        "Commentaires"
      ],
      guide: [
        ["Mois *", "Mois concerné par l'action", "Janvier, Février, Mars, Avril, Mai, Juin..."],
        ["Objectifs *", "Intitulé clair de l'objectif ou jalon", "Ex: Finalisation du MVP fonctionnel"],
        ["Échéance", "Date limite prévue de réalisation", "Format AAAA-MM-JJ (ex: 2025-01-31)"],
        ["Réalisation", "État d'avancement de l'action", "Non commencé, En cours, Réalisé, Bloqué"],
        ["Problèmes rencontrés", "Obstacles ou difficultés identifiés", "Ex: Retard livraison fournisseur"],
        ["Commentaires", "Observations ou validation du mentor", "Ex: MVP validé avec le mentor"]
      ]
    },
    rh_personnel: {
      filename: 'modele_import_personnel_vierge.xlsx',
      sheetName: 'Personnel',
      headers: [
        "Nom complet *",
        "Poste",
        "Type de contrat",
        "Date embauche",
        "Date fin",
        "Salaire mensuel"
      ],
      guide: [
        ["Nom complet *", "Nom et prénom du salarié", "Ex: Yassine Berrada"],
        ["Poste", "Fonction occupée", "Ex: Développeur Fullstack"],
        ["Type de contrat", "Nature du contrat de travail", "CDI, CDD, Stage, ANAPEC, Freelance"],
        ["Date embauche", "Date d'entrée en fonction", "Format AAAA-MM-JJ (ex: 2025-01-01)"],
        ["Date fin", "Date de fin pour contrat temporaire", "Format AAAA-MM-JJ ou vide si CDI"],
        ["Salaire mensuel", "Rémunération mensuelle en MAD", "Ex: 8500"]
      ]
    },
    rh_emploi: {
      filename: 'modele_import_emplois_vierge.xlsx',
      sheetName: 'Emplois',
      headers: [
        "Mois *",
        "Personnel permanent",
        "Personnel temporaire"
      ],
      guide: [
        ["Mois *", "Mois du suivi", "Janvier, Février, Mars..."],
        ["Personnel permanent", "Nombre d'employés permanents (CDI...)", "Ex: 3"],
        ["Personnel temporaire", "Nombre d'employés temporaires (CDD, stagiaires)", "Ex: 1"]
      ]
    },
    financier: {
      filename: 'modele_import_finances_vierge.xlsx',
      sheetName: 'Finances',
      headers: [
        "Mois (1-12) *",
        "Année *",
        "Ventes",
        "Autres revenus",
        "Achats",
        "Charges personnel",
        "CNSS",
        "Salaire porteur",
        "Loyer coworking",
        "Eau & Électricité",
        "Transport",
        "Téléphone",
        "Taxes",
        "TVA",
        "Remboursement crédit",
        "Autres charges"
      ],
      guide: [
        ["Mois (1-12) *", "Numéro du mois dans l'année (1 à 12)", "Ex: 1 pour Janvier, 2 pour Février"],
        ["Année *", "Année de l'exercice financier", "Ex: 2025 ou 2026"],
        ["Ventes", "Chiffre d'affaires mensuel hors taxes en MAD", "Ex: 25000"],
        ["Autres charges", "Toutes les charges en MAD (nombres sans devise)", "Ex: 1500"]
      ]
    },
    fiche_technique: {
      filename: 'modele_fiche_technique_vierge.xlsx',
      sheetName: 'Fiche Technique',
      headers: [
        "N° Ordre",
        "Date",
        "Statut Juridique",
        "État d'avancement",
        "Anomalie signalée",
        "Déclaration d'échec",
        "Observations"
      ],
      guide: [
        ["Date", "Date de la fiche de suivi", "Format AAAA-MM-JJ"],
        ["État d'avancement", "Statut général du projet", "En cours, Réalisé, En difficulté"],
        ["Anomalie signalée", "Problème constaté lors du suivi", "Ex: Rupture de stock composants"],
        ["Déclaration d'échec", "Le projet est-il déclaré abandonné ?", "Non ou Oui"]
      ]
    }
  };

  const tpl = templates[type];
  if (!tpl) return;

  const wb = XLSX.utils.book_new();

  // 1. Feuille principale 100% VIERGE (aucun faux incubé ni démo)
  const ws = XLSX.utils.aoa_to_sheet([tpl.headers]);
  ws['!cols'] = tpl.headers.map(h => ({ wch: Math.max(h.length + 4, 16) }));
  applyIdsTableStyle(ws, 0, true);
  XLSX.utils.book_append_sheet(wb, ws, tpl.sheetName);

  // 2. Deuxième feuille d'aide et d'instructions pour guider la saisie
  if (tpl.guide && tpl.guide.length > 0) {
    const wsGuide = XLSX.utils.aoa_to_sheet([
      ['Colonne', 'Description', 'Valeurs autorisées / Format attendu'],
      ...tpl.guide
    ]);
    wsGuide['!cols'] = [{ wch: 28 }, { wch: 45 }, { wch: 45 }];
    applyIdsTableStyle(wsGuide, tpl.guide.length, false);
    XLSX.utils.book_append_sheet(wb, wsGuide, 'Guide & Instructions');
  }

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

          // 2. Fiche Option B (Tableau 1 + Tableau 2 superposés) ou Fiche verticale
          if (sClean.includes('info') || sClean.includes('general') || sClean.includes('incube')) {
            const stacked = parseStackedOptionBSheet(ws, XLSX);
            if (stacked && stacked.length > 0) {
              sheets[sheetName] = stacked;
              continue;
            }
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

// Téléchargement d'un classeur complet multi-onglets (Dossier complet incubé) 100% VIERGE
export const exportFullIncubeTemplate = async () => {
  const XLSX = await loadXLSX();
  const wb = XLSX.utils.book_new();

  const addStyledSheet = (sheetName, headers) => {
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 4, 16) }));
    applyIdsTableStyle(ws, 0, true);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  };

  // 1. Infos Générales & Associés (Option B superposée 100% vierge)
  const wsOptionB = buildOptionBSheet([], true, XLSX);
  XLSX.utils.book_append_sheet(wb, wsOptionB, "1. Infos Générales");

  // 2. Matériel
  addStyledSheet("2. Matériel", [
    "Origine (propre/ids) *", "Article *", "Date acquisition", "Caractéristiques / N° série", "Quantité", "Valeur ou État"
  ]);

  // 3. Plan d'action
  addStyledSheet("3. Plan d'Action", [
    "Mois *", "Objectifs *", "Échéance", "Réalisation", "Problèmes rencontrés", "Commentaires"
  ]);

  // 4. Personnel RH
  addStyledSheet("4. Personnel RH", [
    "Nom complet *", "Poste", "Type de contrat", "Date embauche", "Date fin", "Salaire mensuel"
  ]);

  // 5. Emplois RH
  addStyledSheet("5. Emplois RH", [
    "Mois *", "Personnel permanent", "Personnel temporaire"
  ]);

  // 6. Finances
  addStyledSheet("6. Finances", [
    "Mois (1-12) *", "Année *", "Ventes", "Autres revenus", "Achats", "Charges personnel", "CNSS",
    "Salaire porteur", "Loyer coworking", "Eau & Électricité", "Transport", "Téléphone", "Taxes", "TVA",
    "Remboursement crédit", "Autres charges"
  ]);

  // 7. Engagement & Présence
  addStyledSheet("7. Engagement", [
    "Mois *", "Année *", "Heures présence", "Taux présence (%)", "Initiatives", "Observations"
  ]);

  // 8. Fiche Technique
  addStyledSheet("8. Fiche Technique", [
    "N° Ordre", "Date", "Statut Juridique", "État d'avancement", "Anomalie signalée", "Déclaration d'échec", "Observations"
  ]);

  // 9. Formations & Ateliers
  addStyledSheet("9. Formations", [
    "Thème *", "Formateur", "Date formation", "Heures", "Présence", "Attestation"
  ]);

  XLSX.writeFile(wb, "modele_dossier_complet_incube_vierge.xlsx");
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
    formation: [],
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
    } else if (name.includes('technique') || name.includes('suivi') || name.includes('fiche')) {
      result.fiche_technique.push(...mapRowsToFields(rows, 'fiche_technique'));
    } else if (name.includes('format') || name.includes('atelier')) {
      result.formation.push(...mapRowsToFields(rows, 'formation'));
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

// Télécharger le modèle global pour importer TOUS les incubés avec TOUS leurs détails (100% VIERGE)
export const exportGlobalPromotionTemplate = async () => {
  const XLSX = await loadXLSX();
  const wb = XLSX.utils.book_new();

  const addStyledSheet = (sheetName, headers) => {
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 4, 16) }));
    applyIdsTableStyle(ws, 0, true);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  };

  // 1. Liste des incubés
  addStyledSheet("1. Incubes", [
    "Nom de l'incubé *", "CIN", "N° PP", "Email", "Téléphone", "Genre", "Date de naissance", "Âge",
    "Niveau d'étude", "Situation familiale", "Raison sociale", "Statut juridique", "RC", "Phase du projet",
    "Secteur d'activité", "Province", "Ville", "Promotion", "Accompagnateur", "Date de démarrage",
    "N° Badge RFID", "Associés"
  ]);

  // 2. Matériel
  addStyledSheet("2. Materiel", [
    "Nom Incubé ou N° PP *", "Origine (propre/ids) *", "Article *", "Date acquisition", "Caractéristiques / N° série", "Quantité", "Valeur ou État"
  ]);

  // 3. Plan d'Action
  addStyledSheet("3. Plan Action", [
    "Nom Incubé ou N° PP *", "Mois *", "Objectifs *", "Échéance", "Réalisation", "Problèmes rencontrés", "Commentaires"
  ]);

  // 4. Personnel RH
  addStyledSheet("4. Personnel RH", [
    "Nom Incubé ou N° PP *", "Nom complet *", "Poste", "Type de contrat", "Date embauche", "Date fin", "Salaire mensuel"
  ]);

  // 5. Emplois RH
  addStyledSheet("5. Emplois RH", [
    "Nom Incubé ou N° PP *", "Mois *", "Personnel permanent", "Personnel temporaire"
  ]);

  // 6. Finances
  addStyledSheet("6. Finances", [
    "Nom Incubé ou N° PP *", "Mois (1-12) *", "Année *", "Ventes", "Autres revenus", "Achats", "Charges personnel", "CNSS",
    "Salaire porteur", "Loyer coworking", "Eau & Électricité", "Transport", "Téléphone", "Taxes", "TVA",
    "Remboursement crédit", "Autres charges"
  ]);

  // 7. Engagement & Assiduité
  addStyledSheet("7. Engagement", [
    "Nom Incubé ou N° PP *", "Mois *", "Année *", "Heures présence", "Taux présence (%)", "Initiatives", "Observations"
  ]);

  // 8. Fiches de Suivi & Entretiens
  addStyledSheet("8. Fiches de Suivi", [
    "Nom Incubé ou N° PP *", "N° Ordre", "Date suivi", "Objet réunion", "Statut avancement", "Statut juridique", "Anomalie signalée", "Déclaration échec", "Observations"
  ]);

  // 9. Formations & Ateliers
  addStyledSheet("9. Formations", [
    "Nom Incubé ou N° PP *", "Thème *", "Formateur", "Date formation", "Heures", "Présence", "Attestation"
  ]);

  // 10. Associés & Partenaires
  addStyledSheet("10. Associés", [
    "Nom Incubé ou N° PP *", "Nom & prénom *", "CIN", "Fonction", "Téléphone", "Part capital (%)"
  ]);

  XLSX.writeFile(wb, "modele_global_tous_incubes_avec_details_vierge.xlsx");
};

// Parser un classeur global contenant TOUS les incubés et TOUS leurs détails
export const parseGlobalPromotionWorkbook = (allSheets, fileName = '') => {
  const incubesMap = new Map(); // key -> { incube, materiel: [], plan_action: [], rh_personnel: [], rh_emploi: [], financier: [], engagement: [], fiche_suivi: [], formation: [], associes: [] }

  const getIncubeKey = (val) => {
    if (!val) return '';
    return cleanKey(val);
  };

  // 1. Étape 1 : Trouver la liste des incubés dans les feuilles
  let incubesFound = false;
  for (const [sheetName, rows] of Object.entries(allSheets)) {
    if (!rows || !rows.length) continue;
    const name = cleanKey(sheetName);
    if (name.includes('incube') || name.includes('liste') || name.includes('porteur') || name.includes('projet') || name.includes('beneficiaire') || name.includes('info')) {
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
          engagement: [],
          fiche_suivi: [],
          formation: [],
          associes: []
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
          engagement: [],
          fiche_suivi: [],
          formation: [],
          associes: []
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
            engagement: [],
            fiche_suivi: [],
            formation: [],
            associes: []
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
        .replace(/[_-]+/g, ' ')
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
        engagement: [],
        fiche_suivi: [],
        formation: [],
        associes: []
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
    } else if (name.includes('engag') || name.includes('presenc')) {
      const mapped = mapRowsToFields(rows, 'engagement');
      mapped.forEach(r => associateRow(r, 'engagement'));
    } else if (name.includes('suivi') || name.includes('fiche_technique') || name.includes('technique') || name.includes('entretien')) {
      const mapped = mapRowsToFields(rows, 'fiche_technique');
      mapped.forEach(r => associateRow(r, 'fiche_suivi'));
    } else if (name.includes('format') || name.includes('atelier')) {
      const mapped = mapRowsToFields(rows, 'formation');
      mapped.forEach(r => associateRow(r, 'formation'));
    } else if (name.includes('associe') || name.includes('partenaire')) {
      const mapped = mapRowsToFields(rows, 'associes');
      mapped.forEach(r => associateRow(r, 'associes'));
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
      } else if (keys.some(k => k.includes('avancement') || k.includes('anomalie') || k.includes('objetreunion') || k.includes('suivi'))) {
        const mapped = mapRowsToFields(rows, 'fiche_technique');
        mapped.forEach(r => associateRow(r, 'fiche_suivi'));
      } else if (keys.some(k => k.includes('theme') || k.includes('formateur') || k.includes('attestation'))) {
        const mapped = mapRowsToFields(rows, 'formation');
        mapped.forEach(r => associateRow(r, 'formation'));
      }
    }
  }

  // Lier les associés trouvés dans la feuille 10 au champ associes de l'incubé
  const uniqueItems = Array.from(new Set(incubesMap.values()));
  uniqueItems.forEach(item => {
    if (item.associes && item.associes.length > 0 && (!item.incube.associes || item.incube.associes.length === 0)) {
      item.incube.associes = item.associes.map(a => ({
        nom: a.nom || a.nom_complet || '',
        cin: a.cin || '',
        fonction: a.fonction || a.role || '',
        tel: a.tel || a.telephone || '',
        part: a.part || a.part_capital || ''
      }));
    }
  });

  // Renvoyer la liste dédoublonnée des incubés avec leurs détails
  return uniqueItems;
};

// Exporter la liste des incubés existants vers un classeur Excel officiel Option B (Tableau 1 Porteurs & Tableau 2 Associés)
export const exportIncubesListToExcel = async (incubesList = [], filename = 'annuaire_incubes.xlsx') => {
  const XLSX = await loadXLSX();
  if (!incubesList || incubesList.length === 0) {
    throw new Error("Aucun incubé à exporter");
  }

  const wb = buildOptionBWorkbook(incubesList, false, XLSX);
  XLSX.writeFile(wb, filename);
};
