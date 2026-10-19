import * as XLSX from 'xlsx';

/**
 * Exporter la feuille d'émargement d'un atelier en fichier Excel (.xlsx)
 */
export const exportAtelierPresencesToExcel = (atelier, presencesList = []) => {
  const atelierNom = atelier?.titre || 'Atelier';
  const dateStr = atelier?.date ? new Date(atelier.date).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR');
  const horaire = atelier?.heureDebut && atelier?.heureFin ? `${atelier.heureDebut} - ${atelier.heureFin}` : '09:30 - 12:30';
  const duree = atelier?.duree || '3h00';
  const formateur = atelier?.formateur || 'Intervenant IDS';

  // En-tête informatif officiel
  const headerData = [
    ['INCUBATEUR DIGITAL SOLIDAIRE (IDS) — FABLAB & INNOVATION'],
    ['FEUILLE D\'ÉMARGEMENT OFFICIELLE DE FORMATION'],
    [],
    ['Atelier / Thème :', atelierNom],
    ['Formateur / Animateur :', formateur],
    ['Date :', dateStr, 'Horaires :', horaire, 'Durée :', duree],
    ['Total Présents :', presencesList.filter(p => p.present).length, 'Total Inscrits :', presencesList.length],
    [],
    ['N°', 'N° PP / Dossier', 'Nom', 'Prénom', 'Statut', 'Heure d\'Émargement', 'Date Signature']
  ];

  // Lignes de données
  const rows = presencesList.map((p, idx) => [
    idx + 1,
    p.pp_numero || p.ppNumero || '—',
    p.nom || '—',
    p.prenom || '—',
    p.present ? 'PRÉSENT' : 'ABSENT',
    p.time || '—',
    p.signedAt ? new Date(p.signedAt).toLocaleDateString('fr-FR') : dateStr
  ]);

  const aoa = [...headerData, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Largeurs de colonnes optimisées
  ws['!cols'] = [
    { wch: 6 },  // N°
    { wch: 18 }, // PP
    { wch: 20 }, // Nom
    { wch: 20 }, // Prénom
    { wch: 14 }, // Statut
    { wch: 20 }, // Heure
    { wch: 16 }  // Date
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Émargement');

  const safeFileName = `emargement_${atelierNom.replace(/[^a-zA-Z0-9_-]/g, '_')}_${dateStr.replace(/\//g, '-')}.xlsx`;
  XLSX.writeFile(wb, safeFileName);
};

/**
 * Exporter le registre des réservations d'espaces en Excel (.xlsx)
 */
export const exportReservationsToExcel = (reservations = [], espaceNom = 'Tous') => {
  const dateExport = new Date().toLocaleDateString('fr-FR');

  const data = reservations.map((res, idx) => ({
    'N°': idx + 1,
    'Incubé / Porteur de projet': res.nomIncube || '—',
    'Email': res.emailIncube || '—',
    'Téléphone': res.telephoneIncube || '—',
    'Espace': (res.espace || '').toUpperCase(),
    'Salle Spécifique': res.salleSpecifique || 'Espace complet',
    'Date de Réservation': res.dateReservation ? new Date(res.dateReservation).toLocaleDateString('fr-FR') : '—',
    'Créneau Horaire': `${res.heureDebut || ''} - ${res.heureFin || ''}`,
    'Durée': res.duree || '1h',
    'Matériel Demandé': res.equipementsUtilises || 'Général',
    'Motif de Réservation': res.motifUtilisation || '—',
    'Statut': res.statut === 'valide' ? 'VALIDÉE' : res.statut === 'refuse' ? 'REFUSÉE' : 'EN ATTENTE',
    'Motif de Refus': res.motifRefus || '—'
  }));

  const ws = XLSX.utils.json_to_sheet(data);

  ws['!cols'] = [
    { wch: 6 },
    { wch: 24 },
    { wch: 26 },
    { wch: 16 },
    { wch: 14 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
    { wch: 10 },
    { wch: 24 },
    { wch: 30 },
    { wch: 14 },
    { wch: 25 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Réservations');

  const safeFileName = `reservations_${espaceNom.toLowerCase()}_${dateExport.replace(/\//g, '-')}.xlsx`;
  XLSX.writeFile(wb, safeFileName);
};

/**
 * Exporter le registre d'inventaire et d'état du parc matériel en Excel (.xlsx)
 */
export const exportEquipementsToExcel = (equipements = [], espaceNom = 'Tous') => {
  const dateExport = new Date().toLocaleDateString('fr-FR');

  const data = equipements.map((eq, idx) => {
    const activeIncident = (eq.incidents || []).find(i => !i.resolu);
    return {
      'N°': idx + 1,
      'Nom du Matériel': eq.nom || '—',
      'Numéro de Série': eq.numeroSerie || 'SN-NON-DEFINI',
      'Catégorie': eq.categorie || 'Général',
      'Salle / Emplacement': eq.salle || 'Espace complet',
      'État Avant Utilisation': eq.etatAvant || 'Opérationnel / Parfait état',
      'État Après (Restitution)': eq.etatApres || 'Conforme & Rendu propre',
      'Santé Matériel': activeIncident ? 'PANNE / INCIDENT ACTIF' : 'OPÉRATIONNEL',
      'Dernier Incident': activeIncident ? `${activeIncident.titre || ''} (${activeIncident.description || ''})` : 'Aucun',
      'Total Pannes Enregistrées': (eq.incidents || []).length
    };
  });

  const ws = XLSX.utils.json_to_sheet(data);

  ws['!cols'] = [
    { wch: 6 },
    { wch: 30 },
    { wch: 20 },
    { wch: 18 },
    { wch: 18 },
    { wch: 25 },
    { wch: 25 },
    { wch: 22 },
    { wch: 35 },
    { wch: 15 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Parc Matériel');

  const safeFileName = `inventaire_materiel_${espaceNom.toLowerCase()}_${dateExport.replace(/\//g, '-')}.xlsx`;
  XLSX.writeFile(wb, safeFileName);
};
