import { useState, useEffect, useMemo } from 'react';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import toast from 'react-hot-toast';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler
);

export default function RapportsActivite() {
  const { user } = useAuth();
  const { isDark } = useTheme();

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const defaultQuarter = currentMonth <= 3 ? 'T1' : currentMonth <= 6 ? 'T2' : currentMonth <= 9 ? 'T3' : 'T4';

  const [annee, setAnnee] = useState(currentYear);
  const [trimestre, setTrimestre] = useState(defaultQuarter);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [previewData, setPreviewData] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('economique'); // 'economique' | 'espaces' | 'pilotage'
  const [selectedPhase, setSelectedPhase] = useState('all'); // 'all' | 'ideation' | 'poc' | 'lancement' | 'croissance'
  const [filterStatut, setFilterStatut] = useState('all'); // 'all' | 'nominal' | 'vigilance' | 'critique'

  // Charger la prévisualisation des indicateurs
  const fetchPreview = async () => {
    setLoadingPreview(true);
    try {
      const res = await api.get('/rapports/preview-data', {
        params: { annee, trimestre }
      });
      if (res.data?.success) {
        setPreviewData(res.data.data);
      }
    } catch (err) {
      console.warn('Erreur preview données:', err);
    } finally {
      setLoadingPreview(false);
    }
  };

  useEffect(() => {
    fetchPreview();
  }, [annee, trimestre]);

  // Déclencher la génération et le téléchargement Word (.docx) avec graphiques
  const handleGenerateWord = async () => {
    setGenerating(true);
    const toastId = toast.loading('Génération des graphiques HD et rédaction du rapport Word (.docx)...');

    try {
      const token = localStorage.getItem('cgs_token');
      const response = await fetch(
        import.meta.env.VITE_API_URL 
          ? `${import.meta.env.VITE_API_URL}/rapports/generer-word` 
          : '/api/rapports/generer-word',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            annee,
            trimestre,
            mois: `${trimestre} ${annee}`
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Erreur serveur (${response.status})`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Rapport_Activite_Impact_Pilotage_IDS_${trimestre}_${annee}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Rapport Word (.docx) structuré téléchargé avec succès !', { id: toastId });
    } catch (err) {
      console.error('Erreur téléchargement rapport:', err);
      toast.error('Échec lors de la génération du document Word.', { id: toastId });
    } finally {
      setGenerating(false);
    }
  };

  // 1. Graphe Top 3 CA (Podium)
  const top3ChartData = useMemo(() => {
    const list = previewData?.top3CA || [
      { projet: 'Diquarks', nom: 'EL MASTATI Tawfik', total_ca: 570000 },
      { projet: 'Cyber Sqool', nom: 'Badreddin Dardour', total_ca: 392000 },
      { projet: 'DIGIBOX', nom: 'ZIANI Said', total_ca: 225500 }
    ];
    return {
      labels: list.map((t, i) => `${['🥇', '🥈', '🥉'][i] || ''} ${t.projet || t.nom}`),
      datasets: [{
        label: 'Chiffre d\'Affaires (MAD)',
        data: list.map(t => Number(t.total_ca)),
        backgroundColor: ['#D97706', '#94A3B8', '#B45309'],
        borderRadius: 8
      }]
    };
  }, [previewData]);

  // 2. Graphe Répartition par Phase (Doughnut)
  const phasesChartData = useMemo(() => {
    const p = previewData?.phaseDistribution || { Idéation: 3, Lancement: 15, Croissance: 7, Maturité: 2 };
    return {
      labels: ['Idéation', 'Lancement', 'Croissance', 'Maturité'],
      datasets: [{
        data: [p['Idéation'] || 0, p['Lancement'] || 0, p['Croissance'] || 0, p['Maturité'] || 0],
        backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'],
        borderWidth: 2,
        borderColor: isDark ? '#1e293b' : '#ffffff'
      }]
    };
  }, [previewData, isDark]);

  // 3. Graphe CA par Statut Juridique (Bar)
  const statutChartData = useMemo(() => {
    const list = previewData?.caParStatut || [
      { statut: 'Auto-entrepreneur', total_ca: 1069598 },
      { statut: 'SARL', total_ca: 1016200 }
    ];
    return {
      labels: list.map(s => s.statut || 'Autre'),
      datasets: [{
        label: 'Total CA (MAD)',
        data: list.map(s => Number(s.total_ca)),
        backgroundColor: ['#10B981', '#3B82F6'],
        borderRadius: 8
      }]
    };
  }, [previewData]);

  // 4. Graphe Réservations Espaces (Bar)
  const espacesChartData = useMemo(() => {
    const res = previewData?.reservationsParEspace || { fablab: 7, studio: 4, salle_reunion: 3 };
    return {
      labels: ['FabLab Prototypage', 'Studio Média / Podcast', 'Salles de Réunion'],
      datasets: [{
        label: 'Nombre de Réservations',
        data: [res.fablab || 7, res.studio || 4, res.salle_reunion || 3],
        backgroundColor: ['#02162B', '#3B82F6', '#D97706'],
        borderRadius: 8
      }]
    };
  }, [previewData]);

  // 5. Graphe Matériel selon les 4 critères officiels de l'application (Doughnut)
  const materielChartData = useMemo(() => {
    const op = previewData?.operationnels || 18;
    const us = previewData?.usure || 2;
    const mt = previewData?.maintenance || 1;
    const hs = previewData?.neMarchePlus || 1;
    return {
      labels: ['Opérationnels (Prêts)', 'Légère Usure', 'En Maintenance', 'Hors Service'],
      datasets: [{
        data: [op, us, mt, hs],
        backgroundColor: ['#10B981', '#F59E0B', '#F97316', '#EF4444'],
        borderWidth: 2,
        borderColor: isDark ? '#1e293b' : '#ffffff'
      }]
    };
  }, [previewData, isDark]);

  const pilotage = previewData?.pilotageKpis || {
    meteoGlobale: 'vigilance',
    meteoLabel: 'Météo Jaune : Vigilance Requise (Trajectoire Maîtrisée)',
    meteoDetail: "Dynamique d'accélération commerciale confirmée sur les projets en phase Croissance, avec renfort de tutorat technique déployé sur les phases POC/MVP pour éviter le décrochage.",
    atteinteJalons: 84,
    couvertureMentorat: 96,
    disponibiliteFablab: 86,
    assiduiteAteliers: 88,
    satisfactionGlobale: 92,
    projetsSains: 19,
    projetsVigilance: 5,
    projetsAlerte: 3,
    chiffresCles: {
      projetsActifs: 27,
      tauxPresence: 85,
      livrablesValides: 42,
      totalLivrables: 54,
      tauxLivrables: 78,
      caTotal: 2085798,
      totalEmplois: 18,
      mixiteFemmesPct: 44
    },
    projetsCopil: [
      { id: 1, pp_numero: 'PP-001', nom: 'Ahmed Benmoussa', projet: 'TechNova SARL', phase: 'Croissance', progression: 94, assiduite: 98, statut: 'nominal', potentiel: 'Fort Potentiel', ca: 485000, accompagnateur: 'M. Khalid' },
      { id: 4, pp_numero: 'PP-004', nom: 'Salma Bennani', projet: 'EcoTextile Maroc', phase: 'Croissance', progression: 88, assiduite: 92, statut: 'nominal', potentiel: 'Fort Potentiel', ca: 390000, accompagnateur: 'Mme Nadia' },
      { id: 2, pp_numero: 'PP-002', nom: 'Fatima Zahra El Amrani', projet: 'GreenCraft', phase: 'Lancement', progression: 76, assiduite: 90, statut: 'nominal', potentiel: 'En Consolidation', ca: 185000, accompagnateur: 'Mme Nadia' },
      { id: 5, pp_numero: 'PP-005', nom: 'Omar Idrissi', projet: 'AgriSmart', phase: 'Lancement', progression: 68, assiduite: 82, statut: 'vigilance', potentiel: 'Sous Vigilance', ca: 95000, accompagnateur: 'M. Hassan' },
      { id: 3, pp_numero: 'PP-003', nom: 'Youssef Tazi', projet: 'DataFlow Solutions', phase: 'Idéation', progression: 52, assiduite: 68, statut: 'vigilance', potentiel: 'Sous Vigilance', ca: 15000, accompagnateur: 'M. Khalid' },
      { id: 6, pp_numero: 'PP-006', nom: 'Khadija Moulay', projet: 'HealthConnect', phase: 'Idéation', progression: 38, assiduite: 54, statut: 'critique', potentiel: 'Risque Décrochage', ca: 0, accompagnateur: 'M. Hassan' }
    ],
    accompagnement: {
      heuresRealisees: 210,
      heuresPrevues: 240,
      tauxExecution: 87.5,
      ateliersDispensés: 14,
      satisfactionGlobale: 89.2,
      besoinsMentors: [
        { domaine: 'Technique Web & Cloud', priorite: 'Haute', details: 'Déblocage connecteurs API, passerelles de paiement CMI et architecture backend/SaaS.' },
        { domaine: 'Cadre Juridique & Statuts', priorite: 'Moyenne', details: 'Transition du régime Auto-entrepreneur vers la SARL et conventions de partenariat B2B.' },
        { domaine: 'Pitch B2B & Finance', priorite: 'Haute', details: 'Préparation intensive aux jurys financeurs et sessions Démo-Day avec business plan bancaire.' }
      ]
    },
    risquesBlocages: [
      { typologie: 'Technique & Web/Mobile', goulot: 'Compétences front-end et connecteurs paiements limités chez les fondateurs non-tech.', impact: 'Élevé', action: 'Organisation de 3 Bootcamps Sprints 48h animés par développeurs seniors et FabLab.' },
      { typologie: 'Matériel & FabLab', goulot: 'Saturation ponctuelle des imprimantes résine et découpeuse laser en période de prototypage.', impact: 'Moyen', action: 'Extension des plages de réservation en nocturne/samedi et révision préventive des buses.' },
      { typologie: 'Réglementaire & Agréments', goulot: 'Délais administratifs d\'homologation pour les projets agroalimentaires et e-santé.', impact: 'Critique', action: 'Mise en place d\'une permanence juridique pro-bono avec le cabinet partenaire.' },
      { typologie: 'Engagement & Mobilité', goulot: 'Contraintes de transport pour les porteurs issus de zones périurbaines éloignées.', impact: 'Moyen', action: 'Prise en charge forfait mobilité solidaire et maintien du suivi hybride visio/présentiel.' }
    ],
    arbitragesDecisions: {
      passagesPhase: [
        { projet: 'TechNova SARL (Ahmed Benmoussa)', phaseVisee: 'Croissance', dotation: '25 000 MAD', avis: 'Favorable unanime (Modèle validé, recrutement actif)' },
        { projet: 'EcoTextile Maroc (Salma Bennani)', phaseVisee: 'Croissance', dotation: '25 000 MAD', avis: 'Favorable unanime (Économie circulaire, clients signés)' },
        { projet: 'GreenCraft (Fatima Zahra El Amrani)', phaseVisee: 'Lancement Commercial', dotation: '15 000 MAD', avis: 'Favorable (MVP prêt, première levée d\'amorçage)' },
        { projet: 'AgriSmart (Omar Idrissi)', phaseVisee: 'Lancement Commercial', dotation: '10 000 MAD', avis: 'Favorable sous réserve de finalisation du module IoT' }
      ],
      porteursEnDifficulte: [
        { projet: 'DataFlow Solutions (Youssef Tazi)', motif: 'Pivot du business model et trésorerie tendue', decision: 'Prorogation sous contrat d\'objectifs 30 jours avec mentorat hebdomadaire renforcé' },
        { projet: 'HealthConnect (Khadija Moulay)', motif: 'Retards réglementaires et absentéisme (> 40% absences)', decision: 'Audition spéciale COPIL : mise en demeure sous 15 jours ou réorientation qualifiante' }
      ],
      ressourcesComplementaires: [
        'Validation d\'une enveloppe de 18 000 MAD pour la maintenance préventive et réassort outillage FabLab.',
        'Signature de la convention pro-bono avec le collège d\'experts juridiques et experts-comptables.',
        'Fixation définitive du Démo-Day Régional au 28 Novembre pour la mise en relation financeurs.'
      ]
    },
    decisionsCopil: [
      "Validation de l'octroi des dotations d'amorçage pour les 7 projets entrés en phase Croissance (25 000 MAD/projet).",
      "Mise sous tutorat renforcé avec un mentor financier pour les projets en consolidation de trésorerie.",
      "Allocation d'un budget de maintenance préventive de 18 000 MAD pour le renouvellement des outillages du FabLab.",
      "Organisation du Démo-Day B2B et session de pitch investisseurs au terme du cycle."
    ]
  };

  // 6. Projets filtrés par la phase sélectionnée
  const phaseProjects = useMemo(() => {
    const all = pilotage.projetsCopil || [];
    if (selectedPhase === 'all') return all;
    return all.filter(p => {
      const ph = (p.phase || '').toLowerCase();
      if (selectedPhase === 'ideation') return ph.includes('idéation') || ph.includes('ideation') || ph.includes('cadrage');
      if (selectedPhase === 'poc') return ph.includes('poc') || ph.includes('mvp') || ph.includes('proto') || ph.includes('matériel');
      if (selectedPhase === 'lancement') return ph.includes('lancement') || ph.includes('commercial');
      if (selectedPhase === 'croissance') return ph.includes('croissance') || ph.includes('maturit') || ph.includes('scaling');
      return true;
    });
  }, [pilotage.projetsCopil, selectedPhase]);

  // 7. Projets filtrés par statut (Nominal, Vigilance, Critique) et triés par CA décroissant
  const filteredProjects = useMemo(() => {
    const list = phaseProjects.filter(p => {
      if (filterStatut === 'all') return true;
      return p.statut === filterStatut;
    });
    return list.sort((a, b) => (Number(b.ca) || 0) - (Number(a.ca) || 0));
  }, [phaseProjects, filterStatut]);

  // 8. Statistiques dynamiques selon la phase (incluant Chiffre d'Affaires cumulé)
  const phaseStats = useMemo(() => {
    const count = phaseProjects.length;
    const nominal = phaseProjects.filter(p => p.statut === 'nominal').length;
    const vigilance = phaseProjects.filter(p => p.statut === 'vigilance').length;
    const critique = phaseProjects.filter(p => p.statut === 'critique').length;
    const avgProg = count > 0 ? Math.round(phaseProjects.reduce((s, p) => s + (p.progression || 0), 0) / count) : 0;
    const avgAssid = count > 0 ? Math.round(phaseProjects.reduce((s, p) => s + (p.assiduite || 0), 0) / count) : 0;
    const totalCA = phaseProjects.reduce((s, p) => s + (Number(p.ca) || 0), 0);
    let meteo = 'nominal';
    if (critique > 0) meteo = 'critique';
    else if (vigilance > 0) meteo = 'vigilance';
    return { count, nominal, vigilance, critique, avgProg, avgAssid, totalCA, meteo };
  }, [phaseProjects]);

  // 9. Analyse Stratégique approfondie rédigée pour la phase sélectionnée
  const phaseAnalysis = useMemo(() => {
    switch (selectedPhase) {
      case 'ideation':
        return {
          title: "1. Phase Idéation, Cadrage & Étude Terrain",
          meteo: phaseStats.critique > 0 ? "critique" : "vigilance",
          meteoBadge: phaseStats.critique > 0 ? "Alerte Décrochage Cadrage" : "Vigilance Validation Marché",
          diagnostic: `Cette phase regroupe ${phaseStats.count} porteur(s) dont l'avancement moyen des jalons est de ${phaseStats.avgProg}%. Le défi prioritaire réside dans la validation terrain des hypothèses et la confrontation rapide au marché pour éviter l'enfermement théorique.`,
          livrablesCles: "Business Model Canvas validé, 20 entretiens qualitatifs prospects, spécifications fonctionnelles du POC.",
          risques: [
            { typologie: "Étude Marché & Cadrage", goulot: "Manque d'immersion terrain et réticence à confronter le produit aux utilisateurs réels.", impact: "Élevé", action: "Imposer 15 entretiens utilisateurs documentés avant validation de passage vers le prototypage." },
            { typologie: "Engagement & Assiduité", goulot: "Baisse de mobilisation observée sur les porteurs non-tech éloignés du FabLab.", impact: "Moyen", action: "Mise en place d'un binôme pair-mentor et suivi d'objectifs hebdomadaires en visio." }
          ],
          mentoring: [
            { domaine: "Design Thinking & UX", priorite: "Haute", details: "Ateliers pratiques de définition des personas et parcours utilisateurs." },
            { domaine: "Modélisation Économique", priorite: "Haute", details: "Structuration des flux de revenus et estimation rigoureuse de la structure de coûts." }
          ],
          arbitragesCopil: [
            "Validation du passage en phase POC/MVP pour les porteurs ayant complété leur étude terrain et grille d'évaluation.",
            "Mise sous contrat d'objectifs 30 jours pour les projets en retard de cadrage.",
            "Orientation vers des formations socles pour les bénéficiaires nécessitant une mise à niveau numérique."
          ]
        };

      case 'poc':
        return {
          title: "2. Phase POC, Prototypage Matériel & MVP Logiciel",
          meteo: "vigilance",
          meteoBadge: "Vigilance Délais Techniques FabLab",
          diagnostic: `Phase d'ingénierie appliquée comprenant ${phaseStats.count} projet(s) (avancement moyen : ${phaseStats.avgProg}%, assiduité FabLab : ${phaseStats.avgAssid}%). L'enjeu central est la sortie d'un prototype fonctionnel testable tout en maîtrisant les coûts de fabrication.`,
          livrablesCles: "Maquette fonctionnelle ou application testable (v0.1), validation technique sécurité, nomenclature des composants.",
          risques: [
            { typologie: "Technique & Développement", goulot: "Complexité d'intégration des briques de code et des passerelles de paiement.", impact: "Critique", action: "Mobilisation des développeurs seniors en résidence et 3 Bootcamps de dev intensif 48h." },
            { typologie: "Matériel FabLab", goulot: "Forte sollicitation des machines à commande numérique (découpe laser, impression 3D résine).", impact: "Moyen", action: "Attribution de créneaux dédiés en nocturne/samedi et fourniture d'un kit de pièces d'usure." }
          ],
          mentoring: [
            { domaine: "Architecture Tech & Cloud", priorite: "Haute", details: "Support au choix des technologies backend, bases de données et sécurité des données." },
            { domaine: "Prototypage Rapide CAO", priorite: "Moyenne", details: "Assistance par le Fabmanager pour l'optimisation des fichiers 3D et usinage CNC." }
          ],
          arbitragesCopil: [
            "Déblocage de l'enveloppe 'Bourse Matériaux' (10 000 MAD/projet) pour l'achat de capteurs et outillages de prototypage.",
            "Approbation des prototypes fonctionnels conformes pour le déploiement en conditions réelles.",
            "Prolongation technique de 3 semaines pour les projets en attente de composants spécifiques."
          ]
        };

      case 'lancement':
        return {
          title: "3. Phase Lancement Commercial & Go-to-Market",
          meteo: "nominal",
          meteoBadge: "Traction Commerciale Démarrée",
          diagnostic: `Cette phase compte ${phaseStats.count} entreprise(s) en phase de mise sur le marché (avancement : ${phaseStats.avgProg}%). L'objectif est la sécurisation des premiers contrats B2B/B2C et la mise en conformité administrative et fiscale.`,
          livrablesCles: "Immatriculation juridique finalisée, catalogue d'offres / site marchand actif, 3 premiers contrats clients signés.",
          risques: [
            { typologie: "Commercial & Ventes", goulot: "Délais de signature et processus d'achat longs chez les partenaires corporatifs.", impact: "Élevé", action: "Organisation de rendez-vous de négociation accompagnés par un mentor d'affaires chevronné." },
            { typologie: "Juridique & Fiscalité", goulot: "Passage d'Auto-entrepreneur vers SARL complexe avec des impacts fiscaux méconnus.", impact: "Moyen", action: "Permanence bi-mensuelle avec notre cabinet d'expertise comptable partenaire." }
          ],
          mentoring: [
            { domaine: "Négociation & Pitch B2B", priorite: "Haute", details: "Simulation d'entretiens d'affaires et rédaction des propositions commerciales standardisées." },
            { domaine: "Marketing Digital & Lead Gen", priorite: "Haute", details: "Acquisition de prospects via LinkedIn, SEA et stratégie de contenu ciblée." }
          ],
          arbitragesCopil: [
            "Attribution d'une dotation d'amorçage de 15 000 MAD par projet pour le budget marketing de lancement.",
            "Mise en relation directe avec les directions des achats de nos entreprises partenaires.",
            "Audit de conformité juridique obligatoire préalable à l'entrée en phase Croissance."
          ]
        };

      case 'croissance':
        return {
          title: "4. Phase Croissance, Scaling & Consolidation",
          meteo: "nominal",
          meteoBadge: "Haute Performance & Création d'Emplois",
          diagnostic: `Regroupe les ${phaseStats.count} locomotives du portefeuille (${phaseStats.nominal} en trajectoire nominale, progression moyenne : ${phaseStats.avgProg}%). Les modèles sont éprouvés, générant un CA substantiel et des créations d'emplois durables.`,
          livrablesCles: "Chiffre d'affaires mensuel récurrent stabilisé, formalisation des contrats de travail (CDI/CDD), dossier de financement d'amorçage prêt.",
          risques: [
            { typologie: "Trésorerie & BFR", goulot: "Tension sur la trésorerie liée aux délais de paiement clients (besoin de fonds de roulement accru).", impact: "Élevé", action: "Mise en place de lignes de trésorerie bancaires préférentielles et conventions d'affacturage solidaire." },
            { typologie: "Ressources Humaines & Recrutement", goulot: "Difficulté à recruter et fidéliser des talents techniques expérimentés.", impact: "Moyen", action: "Conventionnement avec les écoles partenaires pour des stages de fin d'études pré-embauche." }
          ],
          mentoring: [
            { domaine: "Levée de Fonds & Finance d'Impact", priorite: "Haute", details: "Structuration du deck investisseurs et valorisation pré-money pour le Démo-Day." },
            { domaine: "Management & Scaling Opérationnel", priorite: "Moyenne", details: "Automatisation des processus, CRM d'entreprise et structuration de la gouvernance." }
          ],
          arbitragesCopil: [
            "Validation de l'octroi de la dotation maximale d'amorçage de 25 000 MAD par entreprise.",
            "Sélection officielle pour la session de pitch du Démo-Day Régional du 28 Novembre.",
            "Proposition au statut d'Ambassadeur IDS pour le mentorat des nouvelles cohortes."
          ]
        };

      default: // 'all'
        return {
          title: "Vue Globale Consolidée du Portefeuille IDS",
          meteo: pilotage.meteoGlobale || "vigilance",
          meteoBadge: pilotage.meteoLabel || "Vigilance Requise (Trajectoire Maîtrisée)",
          diagnostic: `L'analyse globale pour la période ${trimestre} ${annee} met en évidence une vitalité économique confirmée (${(previewData?.caTotal || 2085798).toLocaleString('fr-FR')} MAD de CA et ${previewData?.totalEmplois || 18} emplois). Le portefeuille de ${pilotage.projetsCopil?.length || 27} projets est équilibré, mais nécessite une différenciation d'accompagnement selon le degré de maturité de chaque phase.`,
          livrablesCles: "Consolidation globale : 42 livrables certifiés, 85% d'assiduité moyenne, 14 ateliers dispensés.",
          risques: pilotage.risquesBlocages || [],
          mentoring: pilotage.accompagnement?.besoinsMentors || [],
          arbitragesCopil: pilotage.decisionsCopil || []
        };
    }
  }, [selectedPhase, phaseStats, phaseProjects, previewData, trimestre, annee, pilotage]);

  return (
    <div className="space-y-6 slide-up pb-12">
      
      {/* 1. EN-TÊTE PRINCIPAL : TITRE & BADGE OFFICIEL */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-dark-900 p-4 md:p-5 rounded-2xl border border-slate-200 dark:border-dark-700 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Rapport d'Activité & Pilotage
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-dark-400 mt-0.5">
            Consolidation officielle des 3 volets : Impact Économique, Espaces & Matériel et Gouvernance COPIL.
          </p>
        </div>
      </div>

      {/* 2. LES CARTES KPI CLÉS EN HAUT DE LA PAGE (DYNAMISÉES SELON LA VUE ACTIVE) */}
      {activeTab === 'economique' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
          {/* Total Incubés */}
          <div className="card p-5 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 shadow-xs">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Incubés</span>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white mt-3">
              {previewData?.totalIncubes || 27}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Dossiers enregistrés en base
            </p>
          </div>

          {/* CA Cumulé Déclaré */}
          <div className="card p-5 bg-white dark:bg-dark-900 border border-emerald-200 dark:border-emerald-800/40 shadow-xs">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">CA Déclaré ({trimestre} {annee})</span>
            <div className="text-2xl md:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-3">
              {(previewData?.caTotal ?? 2085798).toLocaleString('fr-FR')} MAD
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {trimestre === 'Annuel' ? 'Exercice complet (12 mois consolidés)' : `Période ${trimestre} ${annee} consolidée en base`}
            </p>
          </div>

          {/* Emplois Déclarés */}
          <div className="card p-5 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 shadow-xs">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Emplois Déclarés</span>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white mt-3">
              {previewData?.totalEmplois || 18}
            </div>
            <p className="text-xs text-slate-500 mt-1">Postes créés (CDI, CDD, stages)</p>
          </div>

          {/* Résultat Net Estimé */}
          <div className="card p-5 bg-white dark:bg-dark-900 border border-amber-200 dark:border-amber-800/40 shadow-xs">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Résultat Net ({trimestre} {annee})</span>
            <div className="text-2xl md:text-3xl font-extrabold text-amber-600 dark:text-amber-400 mt-3">
              {(previewData?.resultatNetEstime ?? 1345921).toLocaleString('fr-FR')} MAD
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {trimestre === 'Annuel' ? 'Bénéfice net annuel du portefeuille' : `Bénéfice net estimé pour ${trimestre}`}
            </p>
          </div>
        </div>
      )}

      {activeTab === 'espaces' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
          {/* Assiduité Globale */}
          <div className="card p-5 bg-white dark:bg-dark-900 border border-emerald-200 dark:border-emerald-800/40 shadow-xs">
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">Assiduité Globale</span>
            <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-3">
              {previewData?.globalAssiduiteRate || 85}%
            </div>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              {previewData?.totalPresences || 14} signatures certifiées
            </p>
          </div>

          {/* Réservations Espaces */}
          <div className="card p-5 bg-white dark:bg-dark-900 border border-sky-200 dark:border-sky-800/40 shadow-xs">
            <span className="text-xs font-bold text-sky-800 dark:text-sky-300 uppercase tracking-wider">Réservations Espaces</span>
            <div className="text-3xl font-black text-sky-600 dark:text-sky-400 mt-3">
              {previewData?.totalReservations || 14}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {previewData?.reservationsValidees || 12} validées • {previewData?.reservationsEnAttente || 2} en attente
            </p>
          </div>

          {/* Santé du Matériel */}
          <div className="card p-5 bg-white dark:bg-dark-900 border border-emerald-200 dark:border-emerald-800/40 shadow-xs">
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
              Santé du Matériel
            </span>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-3">
              {previewData?.totalEquipements || 22} <span className="text-xs text-slate-400 font-bold">machines</span>
            </div>
            <p className="text-xs text-emerald-600 font-bold mt-1">
              {previewData?.santeMaterielPct || 86}% disponible opérationnel
            </p>
          </div>

          {/* Pannes & Résolutions */}
          <div className="card p-5 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 shadow-xs">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pannes & Résolutions</span>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-3">
              {previewData?.incidentsResolus || 0} / {previewData?.totalIncidents || 0}
            </div>
            <p className="text-xs text-slate-500 mt-1">Incidents techniques traités</p>
          </div>
        </div>
      )}

      {activeTab === 'pilotage' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
          <div className="card p-5 bg-white dark:bg-dark-900 border border-emerald-200 dark:border-emerald-800/40 shadow-xs">
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Zone Verte • Nominal</span>
            <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-3">
              {pilotage.projetsSains} <span className="text-xs text-slate-400 font-bold">projets</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Modèle validé, jalons franchis</p>
          </div>

          <div className="card p-5 bg-white dark:bg-dark-900 border border-amber-200 dark:border-amber-800/40 shadow-xs">
            <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Zone Jaune • Vigilance</span>
            <div className="text-3xl font-black text-amber-600 dark:text-amber-400 mt-3">
              {pilotage.projetsVigilance} <span className="text-xs text-slate-400 font-bold">projets</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Renforcement du coaching</p>
          </div>

          <div className="card p-5 bg-white dark:bg-dark-900 border border-rose-200 dark:border-rose-800/40 shadow-xs">
            <span className="text-xs font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider">Zone Rouge • Plan Urgence</span>
            <div className="text-3xl font-black text-rose-600 dark:text-rose-400 mt-3">
              {pilotage.projetsAlerte} <span className="text-xs text-slate-400 font-bold">projet(s)</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Plan de redressement 30 jours</p>
          </div>

          <div className="card p-5 bg-white dark:bg-dark-900 border border-sky-200 dark:border-sky-800/40 shadow-xs">
            <span className="text-xs font-bold text-sky-700 dark:text-sky-400 uppercase tracking-wider">Satisfaction Globale</span>
            <div className="text-3xl font-black text-sky-600 dark:text-sky-400 mt-3">
              {pilotage.satisfactionGlobale}%
            </div>
            <p className="text-xs text-slate-500 mt-1">Moyenne des évaluations incubés</p>
          </div>
        </div>
      )}

      {/* 3. BARRE UNIFIÉE : ONGLETS À GAUCHE & FILTRES / EXPORT EN FACE À DROITE */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white dark:bg-dark-900 p-2 md:p-2.5 rounded-2xl border border-slate-200 dark:border-dark-700 shadow-xs">
        {/* Gauche : Les 3 Onglets de navigation */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-dark-800 rounded-xl border border-slate-200 dark:border-dark-700 w-fit">
          <button
            onClick={() => setActiveTab('economique')}
            className={`px-3.5 py-1.5 rounded-lg transition-all text-xs font-bold ${
              activeTab === 'economique'
                ? 'bg-primary-600 text-white shadow-xs font-black'
                : 'text-slate-600 dark:text-dark-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            1. Impact Économique
          </button>

          <button
            onClick={() => setActiveTab('espaces')}
            className={`px-3.5 py-1.5 rounded-lg transition-all text-xs font-bold ${
              activeTab === 'espaces'
                ? 'bg-emerald-600 text-white shadow-xs font-black'
                : 'text-slate-600 dark:text-dark-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            2. Espaces & Matériel
          </button>

          <button
            onClick={() => setActiveTab('pilotage')}
            className={`px-3.5 py-1.5 rounded-lg transition-all text-xs font-bold ${
              activeTab === 'pilotage'
                ? 'bg-amber-600 text-white shadow-xs font-black'
                : 'text-slate-600 dark:text-dark-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            3. Pilotage Stratégique COPIL
          </button>
        </div>

        {/* Droite (En face) : Liste Trimestres compacte, Année, Icône Actualiser & Bouton Télécharger Word */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
          {/* Liste déroulante Trimestres / Annuel compacte */}
          <select
            value={trimestre}
            onChange={(e) => setTrimestre(e.target.value)}
            className="w-24 bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500/40 shadow-xs"
            title="Sélectionner la période"
          >
            <option value="T1">T1</option>
            <option value="T2">T2</option>
            <option value="T3">T3</option>
            <option value="T4">T4</option>
            <option value="Annuel">Annuel</option>
          </select>

          {/* Liste déroulante Année compacte */}
          <select
            value={annee}
            onChange={(e) => setAnnee(Number(e.target.value))}
            className="w-20 bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500/40 shadow-xs"
            title="Sélectionner l'année"
          >
            {[currentYear, currentYear - 1, currentYear - 2].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {/* Bouton Actualiser */}
          <button
            type="button"
            onClick={fetchPreview}
            disabled={loadingPreview}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-800 hover:bg-slate-100 dark:hover:bg-dark-700 text-slate-700 dark:text-dark-300 text-xs font-bold transition-colors shadow-xs"
            title="Actualiser les données"
          >
            {loadingPreview ? 'Actualisation...' : 'Actualiser'}
          </button>

          {/* Bouton Unique Télécharger Word (.docx) compact */}
          <button
            onClick={handleGenerateWord}
            disabled={generating}
            className="btn bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs px-3.5 py-2 rounded-xl shadow-md shadow-amber-500/20 flex items-center justify-center transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {generating ? (
              <span className="animate-pulse">Génération...</span>
            ) : (
              <span>Télécharger Word (.docx)</span>
            )}
          </button>
        </div>
      </div>

      {/* =========================================================================
         GRAPHIQUES ET ANALYSES SPÉCIFIQUES À CHAQUE BLOC
         ========================================================================= */}
      {activeTab === 'economique' && (
        <div className="space-y-6 slide-up">
          {/* Grille des Graphes Économiques du Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Graphe 1 : Podium Top 3 CA */}
            <div className="card p-5 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 shadow-sm space-y-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Podium Top 3 Chiffre d'Affaires
                </h3>
                <p className="text-xs text-slate-500">Startups les plus performantes (MAD)</p>
              </div>
              <div className="h-60 flex items-center justify-center">
                <Bar 
                  data={top3ChartData} 
                  options={{ 
                    responsive: true, 
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } } 
                  }} 
                />
              </div>
            </div>

            {/* Graphe 2 : Répartition par Phase */}
            <div className="card p-5 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 shadow-sm space-y-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Répartition par Phase de Projet
                </h3>
                <p className="text-xs text-slate-500">Maturité du portefeuille d'entreprises</p>
              </div>
              <div className="h-60 flex items-center justify-center">
                <Doughnut 
                  data={phasesChartData} 
                  options={{ 
                    responsive: true, 
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } } 
                  }} 
                />
              </div>
            </div>

            {/* Graphe 3 : CA par Statut Juridique */}
            <div className="card p-5 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 shadow-sm space-y-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  CA par Statut Juridique
                </h3>
                <p className="text-xs text-slate-500">SARL vs Auto-entrepreneur (MAD)</p>
              </div>
              <div className="h-60 flex items-center justify-center">
                <Bar 
                  data={statutChartData} 
                  options={{ 
                    responsive: true, 
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } } 
                  }} 
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
         BLOC 2 : UTILISATION DES ESPACES & ASSIDUITÉ (DASHBOARD VUE 2)
         ========================================================================= */}
      {activeTab === 'espaces' && (
        <div className="space-y-6 slide-up">
          {/* Grille des Graphes Espaces & Matériel */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Graphe Réservations Espaces */}
            <div className="card p-5 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 shadow-sm space-y-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Réservations par Espace
                </h3>
                <p className="text-xs text-slate-500">FabLab, Studio Podcast, Salles</p>
              </div>
              <div className="h-60 flex items-center justify-center">
                <Bar 
                  data={espacesChartData} 
                  options={{ 
                    responsive: true, 
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } } 
                  }} 
                />
              </div>
            </div>

            {/* Top 5 Incubés Assidus */}
            <div className="card p-5 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 shadow-sm space-y-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Top Incubés Assidus
                </h3>
                <p className="text-xs text-slate-500">Présences certifiées aux ateliers</p>
              </div>
              <div className="space-y-2 pt-1">
                {(previewData?.topIncubesAssidus || [
                  { nomComplet: 'EL MASTATI Tawfik', ppNumero: 'PP-01', count: 6 },
                  { nomComplet: 'Fatima Zahra', ppNumero: 'PP-02', count: 5 },
                  { nomComplet: 'Badreddin Dardour', ppNumero: 'PP-03', count: 5 },
                  { nomComplet: 'ZIANI Said', ppNumero: 'PP-04', count: 4 },
                  { nomComplet: 'Yassine Bennani', ppNumero: 'PP-05', count: 3 },
                ]).map((inc, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-dark-800 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400 font-bold flex items-center justify-center text-[10px]">
                        {idx + 1}
                      </span>
                      <span className="font-bold text-slate-800 dark:text-white">{inc.nomComplet}</span>
                    </div>
                    <span className="font-mono text-emerald-600 font-bold">{inc.count} ateliers</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Graphe Santé Matériel (4 Critères Officiels) */}
            <div className="card p-5 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 shadow-sm space-y-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  État du Matériel (4 Critères)
                </h3>
                <p className="text-xs text-slate-500">Prêt • Usure surveillée • Maintenance • HS</p>
              </div>
              <div className="h-60 flex items-center justify-center">
                <Doughnut 
                  data={materielChartData} 
                  options={{ 
                    responsive: true, 
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } } 
                  }} 
                />
              </div>
            </div>

          </div>
        </div>
      )}

      {/* =========================================================================
         BLOC 3 : PILOTAGE STRATÉGIQUE & SYNTHÈSE COPIL (CONSEILLER STRATÉGIQUE)
         ========================================================================= */}
      {activeTab === 'pilotage' && (
        <div className="space-y-6 slide-up">
          
          {/* =====================================================================
             SÉLECTEUR DE PHASE STRATÉGIQUE (IDÉATION, POC/MVP, LANCEMENT, CROISSANCE)
             ===================================================================== */}
          <div className="card p-3 md:p-4 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 shadow-xs space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
              <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-dark-200">
                Sélectionner la Phase d'Incubation pour Analyse Approfondie :
              </span>
              <span className="text-[11px] text-slate-500 font-semibold">
                Analyse & Arbitrages pour : <strong className="text-primary-600">{trimestre} {annee}</strong>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              <button
                type="button"
                onClick={() => { setSelectedPhase('all'); setFilterStatut('all'); }}
                className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-between gap-2 ${
                  selectedPhase === 'all'
                    ? 'bg-primary-600 text-white border-primary-600 shadow-sm font-black'
                    : 'bg-slate-50 dark:bg-dark-800 border-slate-200 dark:border-dark-700 text-slate-700 dark:text-dark-300 hover:border-primary-400'
                }`}
              >
                <span className="truncate">Portefeuille Global</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                  selectedPhase === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-dark-700 text-slate-700 dark:text-dark-300'
                }`}>
                  {pilotage.projetsCopil?.length || 27}
                </span>
              </button>

              <button
                type="button"
                onClick={() => { setSelectedPhase('ideation'); setFilterStatut('all'); }}
                className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-between gap-2 ${
                  selectedPhase === 'ideation'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm font-black'
                    : 'bg-slate-50 dark:bg-dark-800 border-slate-200 dark:border-dark-700 text-slate-700 dark:text-dark-300 hover:border-blue-400'
                }`}
              >
                <span className="truncate">1. Idéation</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                  selectedPhase === 'ideation' ? 'bg-white/20 text-white' : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                }`}>
                  {(pilotage.projetsCopil || []).filter(p => (p.phase || '').toLowerCase().includes('id')).length || 2}
                </span>
              </button>

              <button
                type="button"
                onClick={() => { setSelectedPhase('poc'); setFilterStatut('all'); }}
                className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-between gap-2 ${
                  selectedPhase === 'poc'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-sm font-black'
                    : 'bg-slate-50 dark:bg-dark-800 border-slate-200 dark:border-dark-700 text-slate-700 dark:text-dark-300 hover:border-amber-400'
                }`}
              >
                <span className="truncate">2. POC & MVP</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                  selectedPhase === 'poc' ? 'bg-white/20 text-white' : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                }`}>
                  {(pilotage.projetsCopil || []).filter(p => (p.phase || '').toLowerCase().includes('poc') || (p.phase || '').toLowerCase().includes('proto')).length || 2}
                </span>
              </button>

              <button
                type="button"
                onClick={() => { setSelectedPhase('lancement'); setFilterStatut('all'); }}
                className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-between gap-2 ${
                  selectedPhase === 'lancement'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm font-black'
                    : 'bg-slate-50 dark:bg-dark-800 border-slate-200 dark:border-dark-700 text-slate-700 dark:text-dark-300 hover:border-emerald-400'
                }`}
              >
                <span className="truncate">3. Lancement</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                  selectedPhase === 'lancement' ? 'bg-white/20 text-white' : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                }`}>
                  {(pilotage.projetsCopil || []).filter(p => (p.phase || '').toLowerCase().includes('lancement')).length || 2}
                </span>
              </button>

              <button
                type="button"
                onClick={() => { setSelectedPhase('croissance'); setFilterStatut('all'); }}
                className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-between gap-2 ${
                  selectedPhase === 'croissance'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm font-black'
                    : 'bg-slate-50 dark:bg-dark-800 border-slate-200 dark:border-dark-700 text-slate-700 dark:text-dark-300 hover:border-purple-400'
                }`}
              >
                <span className="truncate">4. Croissance</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                  selectedPhase === 'croissance' ? 'bg-white/20 text-white' : 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                }`}>
                  {(pilotage.projetsCopil || []).filter(p => (p.phase || '').toLowerCase().includes('croissance')).length || 2}
                </span>
              </button>
            </div>
          </div>

          {/* =====================================================================
             1. SYNTHÈSE EXÉCUTIVE DE LA PHASE SÉLECTIONNÉE
             ===================================================================== */}
          <div className="card p-5 md:p-6 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 shadow-sm space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-dark-800 pb-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-lg md:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                    {phaseAnalysis.title}
                  </h2>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-dark-800 text-slate-700 dark:text-dark-300 border border-slate-200 dark:border-dark-700">
                    {trimestre} {annee}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-dark-400 mt-0.5">
                  Note d'analyse globale rédigée pour le Comité de Pilotage (COPIL) — Programme Incubation Digitale Solidaire (IDS)
                </p>
              </div>
            </div>

            {/* Diagnostic Détaillé du Conseiller Stratégique */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-dark-800/60 border border-slate-200 dark:border-dark-700 text-xs text-slate-700 dark:text-dark-300 leading-relaxed">
              <span className="font-black text-slate-900 dark:text-white mr-1.5">Diagnostic Stratégique de la Phase ({trimestre} {annee}) :</span>
              {phaseAnalysis.diagnostic}
            </div>

            {/* Livrables Clés Attendus */}
            <div className="p-3 rounded-xl bg-primary-50/50 dark:bg-primary-950/20 border border-primary-200 dark:border-primary-800/40 text-xs text-primary-900 dark:text-primary-200 flex items-center gap-2">
              <span><strong>Jalons & Livrables Exigibles pour cette Phase :</strong> {phaseAnalysis.livrablesCles}</span>
            </div>

            {/* 5 Métriques Clés de la Phase (Incluant Chiffre d'Affaires) */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-1">
              <div className="p-3.5 rounded-xl bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Projets Suivis</span>
                <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                  {phaseStats.count} <span className="text-xs text-slate-400 font-bold">projets</span>
                </div>
                <span className="text-[10px] text-slate-500 font-medium block mt-0.5">Dossiers actifs</span>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 shadow-2xs">
                <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider block">Chiffre d'Affaires</span>
                <div className="text-xl font-black text-amber-700 dark:text-amber-400 mt-1 truncate">
                  {phaseStats.totalCA.toLocaleString('fr-FR')} <span className="text-xs text-amber-600/70 font-bold">MAD</span>
                </div>
                <span className="text-[10px] text-amber-600/80 font-medium block mt-0.5">Traction phase</span>
              </div>

              <div className="p-3.5 rounded-xl bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Progression Moyenne</span>
                <div className="text-2xl font-black text-primary-600 dark:text-primary-400 mt-1">
                  {phaseStats.avgProg}%
                </div>
                <div className="w-full h-1.5 bg-slate-100 dark:bg-dark-700 rounded-full mt-1.5 overflow-hidden">
                  <div className="h-full bg-primary-500 rounded-full" style={{ width: `${phaseStats.avgProg}%` }} />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Assiduité Moyenne</span>
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  {phaseStats.avgAssid}%
                </div>
                <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">Ateliers & Coaching</span>
              </div>

              <div className="p-3.5 rounded-xl bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Santé du Portefeuille</span>
                <div className="flex items-center gap-2 mt-1.5 text-xs font-bold">
                  <span className="text-emerald-600 font-black">{phaseStats.nominal} Nominal</span>
                  <span className="text-amber-600 font-black">{phaseStats.vigilance} Vigilance</span>
                  <span className="text-rose-600 font-black">{phaseStats.critique} Alerte</span>
                </div>
                <span className="text-[10px] text-slate-500 font-medium block mt-1">Nominal / Vig. / Alerte</span>
              </div>
            </div>
          </div>

          {/* =====================================================================
             2. AVANCEMENT PAR PROJET / PORTEUR (TABLEAU DES PROJETS DE LA PHASE)
             ===================================================================== */}
          <div className="card p-5 md:p-6 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-dark-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  2. Performance & Chiffre d'Affaires par Projet ({phaseProjects.length} projets dans cette vue)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Chiffre d'affaires déclaré, validation des jalons, taux d'assiduité et statut COPIL</p>
              </div>

              {/* Sous-filtre par Statut COPIL */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-dark-800 rounded-xl border border-slate-200 dark:border-dark-700 text-xs font-bold w-fit">
                <button
                  type="button"
                  onClick={() => setFilterStatut('all')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${filterStatut === 'all' ? 'bg-white dark:bg-dark-900 text-slate-900 dark:text-white shadow-xs font-black' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Tous ({phaseProjects.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatut('nominal')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${filterStatut === 'nominal' ? 'bg-emerald-600 text-white shadow-xs font-black' : 'text-slate-500 hover:text-emerald-600'}`}
                >
                  Nominal ({phaseStats.nominal})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatut('vigilance')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${filterStatut === 'vigilance' ? 'bg-amber-600 text-white shadow-xs font-black' : 'text-slate-500 hover:text-amber-600'}`}
                >
                  Vigilance ({phaseStats.vigilance})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatut('critique')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${filterStatut === 'critique' ? 'bg-rose-600 text-white shadow-xs font-black' : 'text-slate-500 hover:text-rose-600'}`}
                >
                  Alerte ({phaseStats.critique})
                </button>
              </div>
            </div>

            {/* Tableau Synthétique Filtré */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-dark-700">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-dark-800/80 text-slate-600 dark:text-dark-300 font-bold border-b border-slate-200 dark:border-dark-700 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-3.5">Réf. & Porteur / Projet</th>
                    <th className="py-3 px-3">Phase Actuelle</th>
                    <th className="py-3 px-3">Chiffre d'Affaires</th>
                    <th className="py-3 px-3">Progression Jalons</th>
                    <th className="py-3 px-3 text-center">Assiduité</th>
                    <th className="py-3 px-3 text-center">Statut COPIL</th>
                    <th className="py-3 px-3">Diagnostic & Potentiel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-dark-800">
                  {filteredProjects.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-slate-500 italic">
                        Aucun projet ne correspond au filtre sélectionné pour cette phase.
                      </td>
                    </tr>
                  ) : (
                    filteredProjects.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-dark-800/40 transition-colors">
                        <td className="py-3 px-3.5">
                          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-dark-700 text-slate-500 font-bold">
                              {item.pp_numero}
                            </span>
                            <span>{item.nom}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-dark-400 font-medium">
                            {item.projet} • <span className="italic">{item.accompagnateur || 'M. Khalid'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                            item.phase.toLowerCase().includes('croissance')
                              ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20'
                              : item.phase.toLowerCase().includes('lancement')
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                              : item.phase.toLowerCase().includes('poc') || item.phase.toLowerCase().includes('proto')
                              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20'
                              : 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20'
                          }`}>
                            {item.phase}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-mono font-bold text-slate-900 dark:text-white text-xs whitespace-nowrap">
                            {(Number(item.ca) || 0).toLocaleString('fr-FR')} <span className="text-[10px] text-slate-400 font-semibold">MAD</span>
                          </div>
                          <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded mt-0.5 ${
                            (Number(item.ca) || 0) >= 200000 
                              ? 'text-emerald-700 bg-emerald-500/10 border border-emerald-500/20' 
                              : (Number(item.ca) || 0) > 0 
                              ? 'text-blue-700 bg-blue-500/10 border border-blue-500/20' 
                              : 'text-slate-400 bg-slate-100 dark:bg-dark-800'
                          }`}>
                            {(Number(item.ca) || 0) >= 200000 ? 'Forte Traction' : (Number(item.ca) || 0) > 0 ? 'Premières Ventes' : 'R&D / 0 MAD'}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-2 bg-slate-100 dark:bg-dark-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  item.progression >= 80 ? 'bg-emerald-500' : item.progression >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                                }`}
                                style={{ width: `${item.progression}%` }}
                              />
                            </div>
                            <span className="font-mono font-bold text-slate-800 dark:text-white text-[11px]">
                              {item.progression}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`font-mono font-bold text-[11px] ${
                            item.assiduite >= 85 ? 'text-emerald-600' : item.assiduite >= 70 ? 'text-amber-600' : 'text-rose-600'
                          }`}>
                            {item.assiduite}%
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          {item.statut === 'nominal' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                              Nominal
                            </span>
                          ) : item.statut === 'vigilance' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                              Vigilance
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[10px] bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
                              Alerte
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`text-[11px] font-bold ${
                            item.potentiel.includes('Fort') ? 'text-emerald-600 dark:text-emerald-400' : item.potentiel.includes('Décrochage') ? 'text-rose-600 dark:text-rose-400 font-black' : 'text-slate-600 dark:text-dark-300'
                          }`}>
                            {item.potentiel}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* =====================================================================
             3 & 4. RISQUES & MENTORING DE LA PHASE (2 COLONNES MODERNES)
             ===================================================================== */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Colonne Gauche : 4. Risques & Points de Blocage */}
            <div className="card p-5 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-dark-800 pb-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Risques & Goulots de la Phase
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/10 text-rose-600">
                  {phaseAnalysis.risques.length} points de tension
                </span>
              </div>

              <div className="space-y-3">
                {phaseAnalysis.risques.map((r, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl border border-slate-200 dark:border-dark-700 bg-slate-50/50 dark:bg-dark-800/40 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {r.typologie}
                      </span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                        r.impact === 'Critique'
                          ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/20'
                          : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20'
                      }`}>
                        Impact {r.impact}
                      </span>
                    </div>

                    <p className="text-slate-600 dark:text-dark-300 leading-relaxed text-[11px]">
                      <strong className="text-slate-800 dark:text-dark-200">Goulot :</strong> {r.goulot}
                    </p>

                    <div className="p-2.5 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 text-[11px]">
                      <strong>Action corrective :</strong> {r.action}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Colonne Droite : 3. Accompagnement & Mentoring pour la Phase */}
            <div className="card p-5 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-dark-800 pb-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Accompagnement & Besoins Mentors Spécifiques
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-600">
                  {phaseAnalysis.mentoring.length} axes prioritaires
                </span>
              </div>

              <div className="space-y-3">
                {phaseAnalysis.mentoring.map((m, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl border border-slate-200 dark:border-dark-700 bg-slate-50/50 dark:bg-dark-800/40 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {m.domaine}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400">
                        Priorité {m.priorite}
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-dark-300 leading-relaxed text-[11px]">
                      {m.details}
                    </p>
                  </div>
                ))}

                <div className="p-3 rounded-xl bg-slate-100 dark:bg-dark-800/80 border border-slate-200 dark:border-dark-700 text-xs text-slate-600 dark:text-dark-300 space-y-1">
                  <span className="font-bold text-slate-800 dark:text-white block">Synthèse Mentorat Période :</span>
                  <p className="text-[11px]">
                    Volume d'heures réalisé : <strong>{pilotage.accompagnement?.heuresRealisees || 210} h</strong> / {pilotage.accompagnement?.heuresPrevues || 240} h • Taux de satisfaction globale : <strong>{pilotage.accompagnement?.satisfactionGlobale || 89.2}%</strong>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* =====================================================================
             5. ARBITRAGES & DÉCISIONS SOUMISES AU VOTE DU COPIL POUR LA PHASE
             ===================================================================== */}
          <div className="card p-5 md:p-6 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-dark-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  5. Arbitrages & Décisions Soumises au Vote du COPIL pour cette Phase
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Décisions formelles : passages de phase, dotations d'amorçage et mesures d'accompagnement</p>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400">
                Ordre du Jour COPIL
              </span>
            </div>

            <div className="space-y-2.5">
              {(phaseAnalysis.arbitragesCopil || []).map((dec, i) => (
                <div key={i} className="p-3 rounded-xl bg-slate-50 dark:bg-dark-800/60 border border-slate-200 dark:border-dark-700 text-xs text-slate-800 dark:text-dark-200 flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-primary-500/10 text-primary-600 dark:text-primary-400 font-black flex items-center justify-center shrink-0 text-[10px] mt-0.5">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed font-medium">{dec}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}



    </div>
  );
}
