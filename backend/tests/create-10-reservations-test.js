const http = require('http');

const BASE_URL = 'http://localhost:5000';

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqHeaders = { 'Content-Type': 'application/json' };
    const payload = body ? JSON.stringify(body) : null;
    if (payload) {
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(url, { method, headers: reqHeaders }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: data ? JSON.parse(data) : {} });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const RESERVATIONS_DATA = [
  {
    nom: 'Yassine Benali',
    email: 'yassine.benali@agritech.ma',
    telephone: '+212 6 61 12 34 56',
    espace: 'fablab',
    dateReservation: '2026-09-22',
    heureDebut: '09:00',
    heureFin: '12:00',
    duree: '3h',
    motif: "Prototypage rapide d'un capteur agricole connecté pour irrigation intelligente (boîtier étanche IP67)",
    equipementsUtilises: 'Imprimante 3D Bambu Lab X1 Carbon, Station de soudage Weller, Multimètre numérique',
    statutFinal: 'valide',
    etatAvant: 'Imprimante calibrée, buse 0.4mm propre, plateau nettoyé à l’alcool, bobine filament PETG en place.',
    etatApres: 'Impression terminée avec succès, résidus et supports jetés au bac de recyclage, machine nettoyée et mise hors tension.'
  },
  {
    nom: 'Sara Mansouri',
    email: 'sara.mansouri@mediaflow.ma',
    telephone: '+212 6 62 23 45 67',
    espace: 'studio',
    dateReservation: '2026-09-23',
    heureDebut: '14:00',
    heureFin: '16:30',
    duree: '2h30',
    motif: "Enregistrement de l'épisode #4 du podcast 'Entreprendre au Maroc' et tournage de capsules vidéo pour LinkedIn",
    equipementsUtilises: 'Microphones Shure SM7B (x2), Caméra Sony Alpha 7 IV, Éclairage Ring Light et panneaux LED Godox',
    statutFinal: 'valide',
    etatAvant: 'Cartes SD formatées, bonnettes micro dépoussiérées, fond vert repassé et tendu, batteries chargées à 100%.',
    etatApres: 'Matériel audio/vidéo rangé dans les valises antichocs, câbles enroulés, éclairages débranchés et studio verrouillé.'
  },
  {
    nom: 'Karim El Fassi',
    email: 'karim.elfassi@fintech-atlas.ma',
    telephone: '+212 6 63 34 56 78',
    espace: 'salle_reunion',
    dateReservation: '2026-09-24',
    heureDebut: '10:00',
    heureFin: '12:00',
    duree: '2h',
    motif: "Pitch Deck de levée de fonds Seed (1.5M MAD) devant un consortium d'investisseurs et Business Angels",
    equipementsUtilises: 'Écran interactif tactile 75 pouces, Système de visioconférence Polycom 4K, Pieuvre audio Jabra Speak 710',
    statutFinal: 'valide',
    etatAvant: 'Câblage HDMI et adaptateurs USB-C vérifiés, tableau blanc effacé avec marqueurs neufs, télécommande présente.',
    etatApres: 'Écran éteint, tableau nettoyé à l’alcool isopropylique, chaises réalignées et bouteilles d’eau recyclées.'
  },
  {
    nom: 'Amina Tazi',
    email: 'amina.tazi@ecocraft.ma',
    telephone: '+212 6 64 45 67 89',
    espace: 'fablab',
    dateReservation: '2026-09-25',
    heureDebut: '13:30',
    heureFin: '17:00',
    duree: '3h30',
    motif: "Découpe et gravure laser de boîtiers en plexiglas et contreplaqué bouleau pour maroquinerie végétale écoresponsable",
    equipementsUtilises: 'Découpeuse Laser CO2 80W, Système d’extraction de fumées et filtration active, Compresseur à air',
    statutFinal: 'valide',
    etatAvant: 'Miroirs optiques et lentille de focalisation propres, plateau en nid d’abeille nettoyé, flux d’air comprimé vérifié.',
    etatApres: 'Bac à chutes de bois et plexiglas vidé, ventilateur d’aspiration purgé, lunettes de protection rangées.'
  },
  {
    nom: 'Mehdi Chraibi',
    email: 'mehdi.chraibi@artisanat-luxe.ma',
    telephone: '+212 6 65 56 78 90',
    espace: 'studio',
    dateReservation: '2026-09-26',
    heureDebut: '09:30',
    heureFin: '11:30',
    duree: '2h',
    motif: "Shooting photo packshot haute résolution de la nouvelle gamme de luminaires artisanaux en cuivre ciselé",
    equipementsUtilises: 'Table de prise de vue rétroéclairée, Softbox octogonales (x3), Réflecteurs argent/or, Trépied Manfrotto Pro',
    statutFinal: 'en_attente',
    etatAvant: null,
    etatApres: null
  },
  {
    nom: 'Fatima Zahra Bennani',
    email: 'fz.bennani@edulearn.ma',
    telephone: '+212 6 66 67 89 01',
    espace: 'salle_reunion',
    dateReservation: '2026-09-28',
    heureDebut: '15:00',
    heureFin: '17:30',
    duree: '2h30',
    motif: "Atelier collaboratif de Design Thinking et prototypage d’expérience utilisateur (UX) pour plateforme scolaire interactive",
    equipementsUtilises: 'Paperboard mobile, Projecteur Epson Full HD sans fil, Kit complet d’animation de sprint (post-its, feutres, gommettes)',
    statutFinal: 'en_attente',
    etatAvant: null,
    etatApres: null
  },
  {
    nom: 'Omar Drissi',
    email: 'omar.drissi@robocare.ma',
    telephone: '+212 6 67 78 90 12',
    espace: 'fablab',
    dateReservation: '2026-09-29',
    heureDebut: '08:30',
    heureFin: '11:30',
    duree: '3h',
    motif: "Usinage par commande numérique (CNC) d’un châssis robotique d’inspection de canalisations souterraines",
    equipementsUtilises: 'Fraiseuse CNC ShopBot 3 axes, Fraises carbure monobloc 3mm et 6mm, Aspirateur de copeaux haute puissance',
    statutFinal: 'refuse',
    motifRefus: "Maintenance programmée semestrielle de la broche CNC et étalonnage des axes moteurs durant ce créneau. Créneau alternatif proposé : 30/09 à 14h.",
    etatAvant: null,
    etatApres: null
  },
  {
    nom: 'Nadia Boukhris',
    email: 'nadia.boukhris@voix-digital.ma',
    telephone: '+212 6 68 89 01 23',
    espace: 'studio',
    dateReservation: '2026-09-30',
    heureDebut: '16:00',
    heureFin: '19:00',
    duree: '3h',
    motif: "Enregistrement de cours audio interactifs (Mooc) et narrations pour applications mobiles d’apprentissage des langues",
    equipementsUtilises: 'Cabine d’isolation acoustique WhisperRoom, Micro statique Rode NT1-A, Interface audio Focusrite Scarlett 2i2, Casque studio Beyerdynamic DT 770',
    statutFinal: 'valide',
    etatAvant: 'Micro statique monté sur suspension antichoc avec filtre anti-pop, carte son paramétrée 24bit/96kHz, monitoring casque testé.',
    etatApres: 'Sessions audio sauvegardées sur cloud et disque externe, cabine ventilée pendant 15min, câbles XLR enroulés.'
  },
  {
    nom: 'Hamza Kabbaj',
    email: 'hamza.kabbaj@greendrop.ma',
    telephone: '+212 6 69 90 12 34',
    espace: 'salle_reunion',
    dateReservation: '2026-10-01',
    heureDebut: '11:00',
    heureFin: '13:00',
    duree: '2h',
    motif: "Négociation de convention de distribution et de partenariat stratégique avec les représentants d’une coopérative régionale",
    equipementsUtilises: 'Table de réunion 12 places, Moniteur de diffusion HDMI, Système de visioconférence sans fil, Tableau d’affichage',
    statutFinal: 'refuse',
    motifRefus: "La salle de réunion principale est réquisitionnée par la direction générale pour la réunion du comité consultatif annuel.",
    etatAvant: null,
    etatApres: null
  },
  {
    nom: 'Zineb Idrissi',
    email: 'zineb.idrissi@biomaterials.ma',
    telephone: '+212 6 70 01 23 45',
    espace: 'fablab',
    dateReservation: '2026-10-02',
    heureDebut: '14:00',
    heureFin: '18:00',
    duree: '4h',
    motif: "Fabrication de bio-composites et stéréolithographie haute précision pour packaging cosmétique biodégradable",
    equipementsUtilises: 'Imprimante 3D résine MSLA Elegoo Saturn 3 Ultra, Station de lavage et post-polymérisation UV Anycubic Cure, Scanner 3D EinScan-SE',
    statutFinal: 'valide',
    etatAvant: 'Bac de résine intact et propre, écran LCD protégé par film d’usure, station UV approvisionnée en alcool IPA propre, gants nitrile à disposition.',
    etatApres: 'Pièces post-traitées et durcies sous UV, résine restante filtrée et reversée dans le flacon opaque, bac rincé, plan de travail nettoyé.'
  }
];

async function run() {
  console.log('========================================================================================');
  console.log('🚀 DÉMARRAGE DU TEST : CRÉATION DE 10 RÉSERVATIONS AVEC TOUS LES CHAMPS UTILISÉS');
  console.log('========================================================================================\n');

  const createdIds = [];
  let failedCount = 0;

  for (let i = 0; i < RESERVATIONS_DATA.length; i++) {
    const item = RESERVATIONS_DATA[i];
    console.log(`\n----------------------------------------------------------------------------------------`);
    console.log(`[#${i + 1}/10] Porteur : ${item.nom} | Espace : ${item.espace.toUpperCase()} | Durée : ${item.duree}`);
    console.log(`  Motif : "${item.motif}"`);
    console.log(`  Équipements : "${item.equipementsUtilises}"`);

    // 1. Soumission publique de la demande de réservation
    const postRes = await request('POST', '/api/reservations/demande', {
      espace: item.espace,
      nomIncube: item.nom,
      emailIncube: item.email,
      telephoneIncube: item.telephone,
      dateReservation: item.dateReservation,
      heureDebut: item.heureDebut,
      heureFin: item.heureFin,
      duree: item.duree,
      motifUtilisation: item.motif,
      equipementsUtilises: item.equipementsUtilises,
    });

    if (postRes.status !== 201 || !postRes.body.reservation) {
      console.error(`  ❌ Erreur lors de la création de la réservation :`, postRes);
      failedCount++;
      continue;
    }

    const reservation = postRes.body.reservation;
    const resId = reservation.id;
    createdIds.push(resId);
    console.log(`  ✅ 1. Demande créée avec succès (ID: ${resId}) | Statut initial : "${reservation.statut}"`);

    // 2. Traitement du statut (Validation ou Refus avec motif)
    if (item.statutFinal === 'valide') {
      const valRes = await request('PUT', `/api/reservations/${resId}/valider`, {
        statut: 'valide'
      });
      if (valRes.status === 200) {
        console.log(`  ✅ 2. Demande VALIDÉE par l'administration (Simulation d'email envoyée à ${item.email})`);
      } else {
        console.error(`  ❌ Échec validation :`, valRes);
      }

      // 3. Renseignement des fiches d'état Avant et Après utilisation
      if (item.etatAvant && item.etatApres) {
        const etatRes = await request('PUT', `/api/reservations/${resId}/etat`, {
          etatAvant: item.etatAvant,
          etatApres: item.etatApres
        });
        if (etatRes.status === 200) {
          console.log(`  ✅ 3. Fiches d'état matériel enregistrées :`);
          console.log(`       - État AVANT : "${item.etatAvant}"`);
          console.log(`       - État APRÈS : "${item.etatApres}"`);
        } else {
          console.error(`  ❌ Échec enregistrement fiche état :`, etatRes);
        }
      }
    } else if (item.statutFinal === 'refuse') {
      const refRes = await request('PUT', `/api/reservations/${resId}/valider`, {
        statut: 'refuse',
        motifRefus: item.motifRefus
      });
      if (refRes.status === 200) {
        console.log(`  ⛔ 2. Demande REFUSÉE avec motif : "${item.motifRefus}" (Simulation email envoyée à ${item.email})`);
      } else {
        console.error(`  ❌ Échec refus :`, refRes);
      }
    } else {
      console.log(`  ⏳ 2. Demande laissée en attente de traitement (Statut: "en_attente")`);
    }
  }

  // Vérification finale en base de données de toutes les 10 réservations
  console.log('\n========================================================================================');
  console.log('🔍 VÉRIFICATION FINALE : CONTRÔLE DE TOUS LES CHAMPS EN BASE DE DONNÉES');
  console.log('========================================================================================\n');

  const { ReservationEspace } = require('../src/models');
  const allReservations = await ReservationEspace.findAll({
    where: { id: createdIds },
    order: [['id', 'ASC']]
  });

  const fieldsToCheck = [
    'id', 'espace', 'nomIncube', 'emailIncube', 'telephoneIncube',
    'dateReservation', 'heureDebut', 'heureFin', 'duree',
    'motifUtilisation', 'equipementsUtilises', 'statut',
    'motifRefus', 'etatAvant', 'etatApres'
  ];

  console.log(`Nombre de réservations vérifiées : ${allReservations.length}/${createdIds.length}`);
  console.log(`Champs audités (${fieldsToCheck.length}) :`, fieldsToCheck.join(', '));
  console.log('');

  allReservations.forEach((r, idx) => {
    const presentFields = fieldsToCheck.filter(f => r[f] !== null && r[f] !== undefined && r[f] !== '');
    console.log(`[Réservation #${r.id}] ${r.nomIncube} | Espace: ${r.espace} | Statut: ${r.statut} | Champs renseignés: ${presentFields.length}/${fieldsToCheck.length}`);
  });

  const expected = RESERVATIONS_DATA.length;
  if (allReservations.length !== expected || failedCount > 0) {
    console.error(`\n❌ ÉCHEC : ${allReservations.length}/${expected} réservations créées avec succès (${failedCount} échecs).`);
    process.exit(1);
  }

  console.log('\n🎉 TEST DE 10 PERSONNES ET RÉSERVATIONS COMPLÈTEMENT RÉUSSI !');
  process.exit(0);
}

run().catch((err) => {
  console.error('Erreur test réservations:', err);
  process.exit(1);
});
