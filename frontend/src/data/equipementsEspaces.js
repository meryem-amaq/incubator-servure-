export const DEFAULT_EQUIPEMENTS = {
  fablab: [
    {
      id: 1,
      nom: 'Imprimante 3D Prusa i3 MK3S+ (Unité #1)',
      numeroSerie: 'SN-FAB-PRUSA-01',
      categorie: 'Impression 3D',
      typeGroupe: 'imprimante3d',
      salle: 'Fablab 1',
      desc: 'Impression filament PLA, PETG, ABS haute précision 0.05mm (Étage)',
      etatAvant: 'Opérationnel / Parfait état',
      etatApres: 'Conforme & Rendu propre',
      incidents: []
    },
    {
      id: 2,
      nom: 'Imprimante 3D Bambu Lab X1 Carbon (Unité #2)',
      numeroSerie: 'SN-FAB-BAMBU-02',
      categorie: 'Impression 3D',
      typeGroupe: 'imprimante3d',
      salle: 'Fablab 1',
      desc: 'Impression multi-couleurs haute vitesse et matériaux composites (Étage)',
      etatAvant: 'Opérationnel / Parfait état',
      etatApres: 'Conforme & Rendu propre',
      incidents: []
    },
    {
      id: 3,
      nom: 'Découpeuse Laser CO2 100W',
      numeroSerie: 'SN-FAB-LASER-100W',
      categorie: 'Découpe & Gravure',
      typeGroupe: 'laser',
      salle: 'Fablab 1',
      desc: 'Découpe bois, plexiglas, carton et gravure précise 900x600mm (Étage)',
      etatAvant: 'Opérationnel / Parfait état',
      etatApres: 'Conforme & Rendu propre',
      incidents: []
    },
    {
      id: 4,
      nom: 'Station de Soudage & Oscilloscope',
      numeroSerie: 'SN-FAB-SOUD-003',
      categorie: 'Électronique',
      typeGroupe: 'electronique',
      salle: 'Fablab 1',
      desc: 'Fer à souder température régulée, oscilloscope 100MHz & multimètre (Étage)',
      etatAvant: 'Bon état / Prêt à l\'emploi',
      etatApres: 'Conforme & Rendu propre',
      incidents: []
    },
    {
      id: 5,
      nom: 'Scanner 3D Haute Définition',
      numeroSerie: 'SN-FAB-SCAN-3D',
      categorie: 'Numérisation',
      typeGroupe: 'scan3d',
      salle: 'Fablab 1',
      desc: 'Numérisation géométrique 3D pour modélisation CAO (Étage)',
      etatAvant: 'Opérationnel / Parfait état',
      etatApres: 'Conforme & Rendu propre',
      incidents: []
    },
    {
      id: 6,
      nom: 'Fraiseuse Numérique CNC Carvey',
      numeroSerie: 'SN-FAB-CNC-CARV',
      categorie: 'Usinage',
      typeGroupe: 'cnc',
      salle: 'Sous-sol',
      desc: 'Usinage précis bois, résine et circuits imprimés PCB (Sous-sol)',
      etatAvant: 'Opérationnel / Parfait état',
      etatApres: 'Conforme & Rendu propre',
      incidents: []
    },
    {
      id: 7,
      nom: 'Découpeuse Métal & Plasma d\'Atelier',
      numeroSerie: 'SN-FAB-PLASM-MET',
      categorie: 'Usinage Lourd',
      typeGroupe: 'plasma',
      salle: 'Sous-sol',
      desc: 'Découpe tôles et profilés métalliques d\'atelier (Sous-sol)',
      etatAvant: 'Opérationnel / Parfait état',
      etatApres: 'Conforme & Rendu propre',
      incidents: []
    },
    {
      id: 8,
      nom: 'Tour Mécanique & Perceuse à Colonne',
      numeroSerie: 'SN-FAB-TOUR-PERC',
      categorie: 'Usinage Mécanique',
      typeGroupe: 'tour',
      salle: 'Sous-sol',
      desc: 'Tournage de pièces métalliques & perçage de précision (Sous-sol)',
      etatAvant: 'Bon état / Prêt à l\'emploi',
      etatApres: 'Conforme & Rendu propre',
      incidents: []
    }
  ],
  studio: [
    {
      id: 1,
      nom: 'Caméra Sony Alpha 7 IV 4K - Boîtier #1',
      numeroSerie: 'SN-STU-SONY-01',
      categorie: 'Caméra Vidéo',
      typeGroupe: 'camera',
      salle: 'Studio Média',
      desc: 'Capteur plein format 4K 60fps, objectif 24-70mm f/2.8 (Boîtier #1)',
      etatAvant: 'Opérationnel / Parfait état',
      etatApres: 'Conforme & Rendu propre',
      incidents: []
    },
    {
      id: 2,
      nom: 'Caméra Sony Alpha 7 IV 4K - Boîtier #2',
      numeroSerie: 'SN-STU-SONY-02',
      categorie: 'Caméra Vidéo',
      typeGroupe: 'camera',
      salle: 'Studio Média',
      desc: 'Capteur plein format 4K 60fps, objectif 50mm f/1.4 (Boîtier #2)',
      etatAvant: 'Opérationnel / Parfait état',
      etatApres: 'Conforme & Rendu propre',
      incidents: []
    },
    {
      id: 3,
      nom: 'Caméra Sony Alpha 7 IV 4K - Boîtier #3',
      numeroSerie: 'SN-STU-SONY-03',
      categorie: 'Caméra Vidéo',
      typeGroupe: 'camera',
      salle: 'Studio Média',
      desc: 'Capteur plein format 4K 60fps, objectif 16-35mm grand angle (Boîtier #3)',
      etatAvant: 'Opérationnel / Parfait état',
      etatApres: 'Conforme & Rendu propre',
      incidents: []
    },
    {
      id: 4,
      nom: 'Kit Micro Podcast Rode RodeCaster Pro',
      numeroSerie: 'SN-STU-RODE-CAST',
      categorie: 'Audio & Podcast',
      typeGroupe: 'audio',
      salle: 'Studio Média',
      desc: 'Console de mixage podcast multipiste & 2 micros broadcast Shure SM7B',
      etatAvant: 'Opérationnel / Parfait état',
      etatApres: 'Conforme & Rendu propre',
      incidents: []
    },
    {
      id: 5,
      nom: 'Kit Éclairage LED Softbox 300W',
      numeroSerie: 'SN-STU-LED-SOFT',
      categorie: 'Lumière & Projecteurs',
      typeGroupe: 'lumiere',
      salle: 'Studio Média',
      desc: 'Panneaux LED bicolores réglables avec diffuseurs softbox et trépieds',
      etatAvant: 'Opérationnel / Parfait état',
      etatApres: 'Conforme & Rendu propre',
      incidents: []
    },
    {
      id: 6,
      nom: 'Fond Vert & Cyclorama Photo Réglable',
      numeroSerie: 'SN-STU-CYCLO-VERT',
      categorie: 'Décor & Fond',
      typeGroupe: 'fond',
      salle: 'Studio Média',
      desc: 'Fond vert rétractable 3x3m, fonds photo blanc et noir pour shooting',
      etatAvant: 'Opérationnel / Parfait état',
      etatApres: 'Conforme & Rendu propre',
      incidents: []
    },
    {
      id: 7,
      nom: 'Téléprompteur Professionnel & Tablette',
      numeroSerie: 'SN-STU-PROMPTER-1',
      categorie: 'Présentation',
      typeGroupe: 'prompteur',
      salle: 'Studio Média',
      desc: 'Vitre semi-réfléchissante grand format avec application de défilement',
      etatAvant: 'Opérationnel / Parfait état',
      etatApres: 'Conforme & Rendu propre',
      incidents: []
    }
  ],
  salle_reunion: [
    {
      id: 1,
      nom: 'Écran Tactile Interactif 75 pouces 4K',
      numeroSerie: 'SN-REU-ECRAN-75',
      categorie: 'Affichage & Brainstorming',
      salle: 'Salle 1',
      desc: 'Tableau blanc interactif tactile multi-touch avec stylets haute sensibilité (Salle 1)',
      etatAvant: 'Opérationnel / Parfait état',
      etatApres: 'Conforme & Rendu propre'
    },
    {
      id: 2,
      nom: 'Barre de Visioconférence 4K Logitech MeetUp',
      numeroSerie: 'SN-REU-LOGI-MEET',
      categorie: 'Audio/Vidéo',
      salle: 'Salle 1',
      desc: 'Caméra grand angle 120°, réduction de bruit IA, micros de table (Salle 1)',
      etatAvant: 'Opérationnel / Parfait état',
      etatApres: 'Conforme & Rendu propre'
    },
    {
      id: 3,
      nom: 'Écran Collaboratif Tactile 65 pouces',
      numeroSerie: 'SN-REU-ECRAN-65',
      categorie: 'Affichage Collaboratif',
      salle: 'Salle 2',
      desc: 'Écran tactile dynamique pour présentations d\'équipes et réunions agiles (Salle 2)',
      etatAvant: 'Opérationnel / Parfait état',
      etatApres: 'Conforme & Rendu propre'
    },
    {
      id: 4,
      nom: 'Système de Présentation Sans Fil Barco ClickShare',
      numeroSerie: 'SN-REU-BARCO-CS',
      categorie: 'Connectivité',
      salle: 'Salle 2',
      desc: 'Partage d\'écran sans fil instantané multi-utilisateurs USB-C & HDMI (Salle 2)',
      etatAvant: 'Opérationnel / Parfait état',
      etatApres: 'Conforme & Rendu propre'
    },
    {
      id: 5,
      nom: 'Vidéoprojecteur Interactif Laser 4K',
      numeroSerie: 'SN-REU-VP-LASER',
      categorie: 'Projection Grand Format',
      salle: 'Salle de formation',
      desc: 'Projection très haute luminosité sur mur interactif 3m (Salle de formation)',
      etatAvant: 'Opérationnel / Parfait état',
      etatApres: 'Conforme & Rendu propre'
    },
    {
      id: 6,
      nom: 'Système de Sonorisation & Micro Conférence',
      numeroSerie: 'SN-REU-SONO-CONF',
      categorie: 'Audio & Voix',
      salle: 'Salle de formation',
      desc: 'Micros cravate sans fil, micro de table et sonorisation d\'amphithéâtre (Salle de formation)',
      etatAvant: 'Opérationnel / Parfait état',
      etatApres: 'Conforme & Rendu propre'
    },
    {
      id: 7,
      nom: 'Pupitre Multimédia & Pointeur Laser',
      numeroSerie: 'SN-REU-PUPITRE-01',
      categorie: 'Animation Formation',
      salle: 'Salle de formation',
      desc: 'Pupitre équipé prises HDMI, audio et retour écran pour formateur (Salle de formation)',
      etatAvant: 'Opérationnel / Parfait état',
      etatApres: 'Conforme & Rendu propre'
    }
  ]
};

export const getEquipementsEspace = (espaceKey, sousSalle = null) => {
  let list = DEFAULT_EQUIPEMENTS[espaceKey] || [];
  try {
    const saved = localStorage.getItem('ids_equipements_espaces');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed[espaceKey] && parsed[espaceKey].length > 0) {
        list = parsed[espaceKey];
      }
    }
  } catch (e) {
    console.error(e);
  }

  if (sousSalle) {
    // Si une sous-salle est demandée, on priorise ou filtre par salle
    const filtered = list.filter(eq => !eq.salle || eq.salle.toLowerCase() === sousSalle.toLowerCase());
    if (filtered.length > 0) return filtered;
  }
  return list;
};
