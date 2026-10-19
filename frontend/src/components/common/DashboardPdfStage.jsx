import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Bar, Doughnut, Pie } from 'react-chartjs-2';
import {
  Users,
  DollarSign,
  Briefcase,
  Award,
  TrendingUp,
  CheckCircle2,
  Building2,
  Wrench,
  ShieldCheck,
  Target,
  PieChart as PieIcon,
  BarChart2,
  GraduationCap,
  MapPin,
  Calendar,
} from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

// Options Chart.js optimisées pour l'exportation PDF haute définition (statiques, sans animation)
const pdfBarOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  plugins: {
    legend: { display: false },
    tooltip: { enabled: false },
  },
  scales: {
    y: {
      beginAtZero: true,
      grid: { color: 'rgba(0, 0, 0, 0.06)' },
      ticks: {
        color: '#64748b',
        font: { size: 10, family: "'Inter', sans-serif", weight: '600' },
      },
    },
    x: {
      grid: { display: false },
      ticks: {
        color: '#475569',
        font: { size: 10, family: "'Inter', sans-serif", weight: '700' },
      },
    },
  },
};

const pdfDoughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  plugins: {
    legend: {
      display: true,
      position: 'bottom',
      labels: {
        color: '#334155',
        boxWidth: 10,
        font: { size: 10, family: "'Inter', sans-serif", weight: '600' },
        padding: 8,
      },
    },
    tooltip: { enabled: false },
  },
};

const formatDH = (amount) => {
  return new Intl.NumberFormat('fr-MA', {
    style: 'currency',
    currency: 'MAD',
    maximumFractionDigits: 0,
  }).format(amount || 0);
};

export default function DashboardPdfStage({ stats, impactStats, activeTab = 'economique', selectedPromotion = 'all' }) {
  const currentYear = new Date().getFullYear();
  const total = stats?.totalIncubes || 0;
  const caTotal = stats?.caTotal || 0;
  const totalEmplois = stats?.totalEmplois || 0;

  // 1. Analyse Financière (12 mois consolidés)
  const availableYears = useMemo(() => {
    return Array.from(new Set((stats?.analyseMois || []).map((m) => Number(m.annee)).filter(Boolean)));
  }, [stats?.analyseMois]);

  const yearToUse = availableYears.includes(currentYear)
    ? currentYear
    : availableYears.length > 0
    ? Math.max(...availableYears)
    : currentYear;

  const moisNoms = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

  const monthData = useMemo(() => {
    const list = stats?.analyseMois || [];
    const res = [];
    for (let m = 1; m <= 12; m++) {
      const match = list.filter((item) => Number(item.annee || 2026) === yearToUse && Number(item.mois) === m);
      const gains = match.reduce((sum, item) => sum + (Number(item.total_gains) || 0), 0);
      const pertes = match.reduce((sum, item) => sum + (Number(item.total_pertes) || 0), 0);
      res.push({ mois: m, label: moisNoms[m - 1], gains, pertes });
    }
    return res;
  }, [stats?.analyseMois, yearToUse]);

  const totalGainsYear = useMemo(() => monthData.reduce((acc, c) => acc + c.gains, 0), [monthData]);
  const totalPertesYear = useMemo(() => monthData.reduce((acc, c) => acc + c.pertes, 0), [monthData]);
  const resultatNetYear = totalGainsYear - totalPertesYear;

  const finChartData = {
    labels: monthData.map((d) => d.label),
    datasets: [
      {
        label: 'Gains (Recettes)',
        data: monthData.map((d) => d.gains),
        backgroundColor: '#10b981',
        borderRadius: 4,
      },
      {
        label: 'Pertes (Charges)',
        data: monthData.map((d) => d.pertes),
        backgroundColor: '#ef4444',
        borderRadius: 4,
      },
    ],
  };

  // 2. Top 3 Chiffre d'Affaires
  const top3CAList = useMemo(() => {
    if (stats?.analyseIncubesMois && stats.analyseIncubesMois.length > 0) {
      const agg = {};
      stats.analyseIncubesMois.forEach((item) => {
        const key = item.projet || item.nom || 'Projet';
        agg[key] = (agg[key] || 0) + (Number(item.total_ca) || 0);
      });
      return Object.entries(agg)
        .map(([nom, total_ca]) => ({ nom, total_ca }))
        .sort((a, b) => b.total_ca - a.total_ca)
        .slice(0, 3);
    }
    return (stats?.top3CA || []).slice(0, 3);
  }, [stats?.analyseIncubesMois, stats?.top3CA]);

  const top3Data = {
    labels: top3CAList.map((item, idx) => {
      const ranks = ['1er', '2ème', '3ème'];
      return `${ranks[idx] || ''} ${item.nom || item.projet || 'Projet'}`.slice(0, 18);
    }),
    datasets: [
      {
        data: top3CAList.map((item) => Number(item.total_ca) || 0),
        backgroundColor: ['#f59e0b', '#94a3b8', '#b45309'],
        borderRadius: 6,
      },
    ],
  };

  // 3. CA par Statut Juridique
  const caStatutList = useMemo(() => {
    const agg = {};
    (stats?.analyseMois || []).forEach((item) => {
      const st = (item.statut_juridique || 'Non spécifié').trim();
      agg[st] = (agg[st] || 0) + (Number(item.total_gains) || 0);
    });
    return Object.entries(agg)
      .map(([statut, total_ca]) => ({ statut, total_ca }))
      .sort((a, b) => b.total_ca - a.total_ca);
  }, [stats?.analyseMois]);

  const caStatutData = {
    labels: caStatutList.map((item) => item.statut),
    datasets: [
      {
        data: caStatutList.map((item) => item.total_ca),
        backgroundColor: ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899'],
        borderRadius: 6,
      },
    ],
  };

  // 4. Phases d'incubation
  const phases = stats?.phases || [];
  const phaseData = {
    labels: phases.map((p) => p.phase_projet || 'Non spécifié'),
    datasets: [
      {
        data: phases.map((p) => Number(p.count) || 0),
        backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'],
        borderWidth: 1,
        borderColor: '#ffffff',
      },
    ],
  };

  // 5. Genre
  const genreStats = stats?.genreStats || [];
  const genreData = {
    labels: genreStats.map((g) => g.genre || 'Non spécifié'),
    datasets: [
      {
        data: genreStats.map((g) => Number(g.count) || 0),
        backgroundColor: ['#6366f1', '#10b981', '#f59e0b'],
        borderWidth: 1,
        borderColor: '#ffffff',
      },
    ],
  };

  // 6. Province
  const provinceStats = useMemo(() => {
    return (stats?.provinceStats || []).slice(0, 5);
  }, [stats?.provinceStats]);

  const provinceData = {
    labels: provinceStats.map((p) => (p.province || 'Autre').slice(0, 12)),
    datasets: [
      {
        data: provinceStats.map((p) => Number(p.count) || 0),
        backgroundColor: '#3b82f6',
        borderRadius: 4,
      },
    ],
  };

  // 7. Secteurs d'activité
  const domaineStats = useMemo(() => {
    return (stats?.domaineStats || []).slice(0, 5);
  }, [stats?.domaineStats]);

  const domaineData = {
    labels: domaineStats.map((d) => (d.secteur_activite || 'Autre').slice(0, 15)),
    datasets: [
      {
        data: domaineStats.map((d) => Number(d.count) || 0),
        backgroundColor: ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#06b6d4'],
        borderRadius: 4,
      },
    ],
  };

  // 8. Niveau d'étude
  const etudeBreakdown = useMemo(() => {
    const rawList = stats?.etudeStats || [];
    const map = {};
    rawList.forEach((item) => {
      let lvl = (item.niveau_etude || '').trim();
      if (!lvl || lvl.toLowerCase() === 'null') lvl = 'Non spécifié';
      else if (
        lvl.toLowerCase().includes('doct') ||
        lvl.toLowerCase().includes('master') ||
        lvl.toLowerCase().includes('bac+5') ||
        lvl.toLowerCase().includes('bac +5') ||
        lvl.toLowerCase().includes('ingénieur')
      ) {
        lvl = 'Bac+5 (Master, Ing., Doc.)';
      } else if (
        lvl.toLowerCase().includes('licence') ||
        lvl.toLowerCase().includes('bac+3') ||
        lvl.toLowerCase().includes('bac +3') ||
        lvl.toLowerCase().includes('bac+4')
      ) {
        lvl = 'Bac+3 (Licence)';
      } else if (
        lvl.toLowerCase().includes('bac+2') ||
        lvl.toLowerCase().includes('ts') ||
        lvl.toLowerCase().includes('bts') ||
        lvl.toLowerCase().includes('dut')
      ) {
        lvl = 'Bac+2 (TS, BTS, DUT)';
      } else if (lvl.toLowerCase().includes('bac')) {
        lvl = 'Bac / Secondaire';
      } else {
        lvl = 'Autre';
      }
      map[lvl] = (map[lvl] || 0) + (Number(item.count) || 0);
    });

    return Object.entries(map).map(([label, count]) => ({ label, count }));
  }, [stats?.etudeStats]);

  const etudeData = {
    labels: etudeBreakdown.map((item) => item.label),
    datasets: [
      {
        data: etudeBreakdown.map((item) => item.count),
        backgroundColor: ['#8b5cf6', '#10b981', '#14b8a6', '#6366f1', '#94a3b8'],
        borderWidth: 1,
        borderColor: '#ffffff',
      },
    ],
  };

  // Top créateurs d'emplois
  const topEmplois = (stats?.top4Emplois || []).slice(0, 3);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '40px',
        backgroundColor: '#ffffff',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* =========================================================================
         PAGE 1 : INDICATEURS CLÉS & ANALYSE FINANCIÈRE GLOBALE (1240px x 780px)
         ========================================================================= */}
      <div
        id="pdf-stage-page-1"
        style={{
          width: '1240px',
          height: '780px',
          boxSizing: 'border-box',
          padding: '16px 20px',
          backgroundColor: '#ffffff',
          color: '#0f172a',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        {activeTab === 'economique' ? (
          <>
            {/* LIGNE 1 : 4 KPI CARDS (HAUTEUR ~115px) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', height: '115px' }}>
              {/* KPI 1 : Porteurs de Projet */}
              <div
                style={{
                  border: '1.5px solid #e2e8f0',
                  borderRadius: '14px',
                  padding: '14px 18px',
                  backgroundColor: '#f8fafc',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', letterSpacing: '0.05em' }}>
                    TOTAL INCUBÉS
                  </span>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      backgroundColor: '#e0e7ff',
                      color: '#4338ca',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Users size={16} />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '28px', fontWeight: '900', color: '#0f172a', lineHeight: '1' }}>{total}</div>
                  <p style={{ fontSize: '10.5px', fontWeight: '600', color: '#059669', marginTop: '4px', margin: '4px 0 0' }}>
                    ✓ Dossiers enregistrés & actifs
                  </p>
                </div>
              </div>

              {/* KPI 2 : Chiffre d'Affaires Cumulé */}
              <div
                style={{
                  border: '1.5px solid #bbf7d0',
                  borderRadius: '14px',
                  padding: '14px 18px',
                  backgroundColor: '#f0fdf4',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: '#166534', letterSpacing: '0.05em' }}>
                    CHIFFRE D'AFFAIRES CUMULÉ
                  </span>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      backgroundColor: '#dcfce7',
                      color: '#15803d',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <DollarSign size={16} />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '26px', fontWeight: '900', color: '#15803d', lineHeight: '1' }}>
                    {formatDH(caTotal)}
                  </div>
                  <p style={{ fontSize: '10.5px', fontWeight: '600', color: '#166534', marginTop: '4px', margin: '4px 0 0' }}>
                    ↗ Consolidation trimestrielle T1 à T4
                  </p>
                </div>
              </div>

              {/* KPI 3 : Emplois Créés */}
              <div
                style={{
                  border: '1.5px solid #bfdbfe',
                  borderRadius: '14px',
                  padding: '14px 18px',
                  backgroundColor: '#eff6ff',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: '#1e40af', letterSpacing: '0.05em' }}>
                    POSTES CRÉÉS
                  </span>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      backgroundColor: '#dbeafe',
                      color: '#1d4ed8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Briefcase size={16} />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '28px', fontWeight: '900', color: '#1d4ed8', lineHeight: '1' }}>
                    {totalEmplois}
                  </div>
                  <p style={{ fontSize: '10.5px', fontWeight: '600', color: '#3b82f6', marginTop: '4px', margin: '4px 0 0' }}>
                    Recrutements consolidés (CDI, CDD, Stages)
                  </p>
                </div>
              </div>

              {/* KPI 4 : Taux d'Activité */}
              <div
                style={{
                  border: '1.5px solid #fde68a',
                  borderRadius: '14px',
                  padding: '14px 18px',
                  backgroundColor: '#fffbeb',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: '#92400e', letterSpacing: '0.05em' }}>
                    TAUX D'ACCOMPAGNEMENT
                  </span>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      backgroundColor: '#fef3c7',
                      color: '#b45309',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Award size={16} />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '28px', fontWeight: '900', color: '#b45309', lineHeight: '1' }}>
                    {total > 0 ? '100%' : '0%'}
                  </div>
                  <p style={{ fontSize: '10.5px', fontWeight: '600', color: '#d97706', marginTop: '4px', margin: '4px 0 0' }}>
                    Porteurs en cours d'incubation active
                  </p>
                </div>
              </div>
            </div>

            {/* LIGNE 2 : ANALYSE FINANCIÈRE GLOBALE (HAUTEUR ~615px) */}
            <div
              style={{
                border: '1.5px solid #e2e8f0',
                borderRadius: '16px',
                padding: '16px 20px',
                backgroundColor: '#ffffff',
                height: '615px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              {/* Header de l'Analyse Financière */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingBottom: '12px',
                  borderBottom: '1px solid #f1f5f9',
                }}
              >
                <div>
                  <h3
                    style={{
                      fontSize: '15px',
                      fontWeight: '900',
                      color: '#0f172a',
                      letterSpacing: '0.02em',
                      margin: '0',
                      textTransform: 'uppercase',
                    }}
                  >
                    ANALYSE FINANCIÈRE GLOBALE — EXERCICE {yearToUse}
                  </h3>
                  <p style={{ fontSize: '11px', color: '#64748b', margin: '3px 0 0', fontWeight: '500' }}>
                    Gains (Recettes) et Pertes (Charges) cumulés sur les 12 mois — Tous statuts juridiques confondus
                  </p>
                </div>

                {/* Légende Gains / Pertes */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#10b981' }} />
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#047857' }}>Recettes / Gains</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#ef4444' }} />
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#b91c1c' }}>Charges / Pertes</span>
                  </div>
                </div>
              </div>

              {/* Bandeau des 3 Métriques Financières Consolidées */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', margin: '10px 0' }}>
                <div
                  style={{
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '10px',
                    padding: '8px 14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: '11.5px', fontWeight: '700', color: '#166534' }}>
                    Total Recettes ({yearToUse}) :
                  </span>
                  <span style={{ fontSize: '15px', fontWeight: '900', color: '#15803d' }}>
                    {formatDH(totalGainsYear)}
                  </span>
                </div>

                <div
                  style={{
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '10px',
                    padding: '8px 14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: '11.5px', fontWeight: '700', color: '#991b1b' }}>
                    Total Charges ({yearToUse}) :
                  </span>
                  <span style={{ fontSize: '15px', fontWeight: '900', color: '#dc2626' }}>
                    {formatDH(totalPertesYear)}
                  </span>
                </div>

                <div
                  style={{
                    backgroundColor: resultatNetYear >= 0 ? '#eff6ff' : '#fffbeb',
                    border: resultatNetYear >= 0 ? '1px solid #bfdbfe' : '1px solid #fde68a',
                    borderRadius: '10px',
                    padding: '8px 14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span
                    style={{
                      fontSize: '11.5px',
                      fontWeight: '700',
                      color: resultatNetYear >= 0 ? '#1e40af' : '#92400e',
                    }}
                  >
                    Résultat Net Global ({yearToUse}) :
                  </span>
                  <span
                    style={{
                      fontSize: '15px',
                      fontWeight: '900',
                      color: resultatNetYear >= 0 ? '#1d4ed8' : '#b45309',
                    }}
                  >
                    {formatDH(resultatNetYear)}
                  </span>
                </div>
              </div>

              {/* Grand Graphique Bar 12 Mois (Hauteur 470px) */}
              <div style={{ height: '470px', width: '100%', position: 'relative' }}>
                <Bar
                  data={finChartData}
                  options={{
                    ...pdfBarOptions,
                    scales: {
                      ...pdfBarOptions.scales,
                      y: {
                        ...pdfBarOptions.scales.y,
                        ticks: {
                          ...pdfBarOptions.scales.y.ticks,
                          callback: (val) => `${Number(val).toLocaleString('fr-FR')} MAD`,
                        },
                      },
                    },
                  }}
                />
              </div>
            </div>
          </>
        ) : (
          /* Page 1 pour le volet Impact & Assiduité */
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', height: '115px' }}>
              <div style={{ border: '1.5px solid #a7f3d0', borderRadius: '14px', padding: '14px', backgroundColor: '#f0fdf4' }}>
                <span style={{ fontSize: '11px', fontWeight: '800', color: '#166534' }}>ASSIDUITÉ GLOBALE</span>
                <div style={{ fontSize: '28px', fontWeight: '900', color: '#15803d', marginTop: '6px' }}>
                  {impactStats?.assiduite?.globalAssiduiteRate || 0}%
                </div>
                <p style={{ fontSize: '10px', color: '#059669', margin: '4px 0 0' }}>
                  {impactStats?.assiduite?.totalPresences || 0} signatures certifiées
                </p>
              </div>

              <div style={{ border: '1.5px solid #bae6fd', borderRadius: '14px', padding: '14px', backgroundColor: '#f0f9ff' }}>
                <span style={{ fontSize: '11px', fontWeight: '800', color: '#075985' }}>RÉSERVATIONS ESPACES</span>
                <div style={{ fontSize: '28px', fontWeight: '900', color: '#0284c7', marginTop: '6px' }}>
                  {impactStats?.espaces?.totalReservations || 0}
                </div>
                <p style={{ fontSize: '10px', color: '#0369a1', margin: '4px 0 0' }}>Fablab, Studio, Salles</p>
              </div>

              <div style={{ border: '1.5px solid #bbf7d0', borderRadius: '14px', padding: '14px', backgroundColor: '#f0fdf4' }}>
                <span style={{ fontSize: '11px', fontWeight: '800', color: '#166534' }}>SANTÉ DU MATÉRIEL</span>
                <div style={{ fontSize: '28px', fontWeight: '900', color: '#15803d', marginTop: '6px' }}>
                  {impactStats?.equipements?.santeMaterielPct ?? 100}%
                </div>
                <p style={{ fontSize: '10px', color: '#166534', margin: '4px 0 0' }}>
                  {impactStats?.equipements?.operationnels || 0} machines prêtes à l'emploi
                </p>
              </div>

              <div style={{ border: '1.5px solid #cbd5e1', borderRadius: '14px', padding: '14px', backgroundColor: '#f8fafc' }}>
                <span style={{ fontSize: '11px', fontWeight: '800', color: '#475569' }}>INCIDENTS MATÉRIELS</span>
                <div style={{ fontSize: '28px', fontWeight: '900', color: '#334155', marginTop: '6px' }}>
                  {impactStats?.equipements?.incidentsResolus || 0} / {impactStats?.equipements?.totalIncidents || 0}
                </div>
                <p style={{ fontSize: '10px', color: '#64748b', margin: '4px 0 0' }}>Pannes résolues</p>
              </div>
            </div>

            <div
              style={{
                border: '1.5px solid #e2e8f0',
                borderRadius: '16px',
                padding: '18px',
                backgroundColor: '#ffffff',
                height: '615px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: '900', color: '#0f172a', margin: '0' }}>
                  PARTICIPATION ET ASSIDUITÉ AUX ATELIERS DE FORMATION
                </h3>
                <p style={{ fontSize: '11px', color: '#64748b', margin: '3px 0 0' }}>
                  Taux de présence des promotions IDS aux modules de formation
                </p>
              </div>
              <div style={{ height: '520px', width: '100%', position: 'relative' }}>
                <Bar
                  data={{
                    labels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'],
                    datasets: [
                      {
                        label: 'Émargements validés',
                        data: [12, 19, 25, 30, 22, 28, 15, 8, 35, 42, 38, 29],
                        backgroundColor: '#10b981',
                        borderRadius: 6,
                      },
                    ],
                  }}
                  options={pdfBarOptions}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
         PAGE 2 : PERFORMANCE DES PROJETS & DÉMOGRAPHIE (1240px x 780px)
         ========================================================================= */}
      <div
        id="pdf-stage-page-2"
        style={{
          width: '1240px',
          height: '780px',
          boxSizing: 'border-box',
          padding: '16px 20px',
          backgroundColor: '#ffffff',
          color: '#0f172a',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        {activeTab === 'economique' ? (
          <>
            {/* VOLET HAUT : PERFORMANCE DES PROJETS (HAUTEUR ~360px) */}
            <div style={{ display: 'flex', flexDirection: 'column', height: '360px', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '4px' }}>
                <div
                  style={{
                    backgroundColor: '#e0e7ff',
                    color: '#4338ca',
                    fontSize: '10px',
                    fontWeight: '900',
                    padding: '3px 8px',
                    borderRadius: '6px',
                  }}
                >
                  VOLET 1
                </div>
                <h4 style={{ fontSize: '13px', fontWeight: '900', color: '#1e293b', margin: '0', letterSpacing: '0.02em' }}>
                  PERFORMANCE ÉCONOMIQUE, VALEUR AJOUTÉE & EMPLOIS
                </h4>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.15fr', gap: '14px', height: '325px' }}>
                {/* Carte 1 : TOP 3 CA */}
                <div
                  style={{
                    border: '1.5px solid #e2e8f0',
                    borderRadius: '14px',
                    padding: '12px 14px',
                    backgroundColor: '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: '900', color: '#b45309' }}>TOP 3 CHIFFRE D'AFFAIRES</span>
                    <span style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8' }}>MAD</span>
                  </div>
                  <div style={{ height: '175px', position: 'relative' }}>
                    <Bar
                      data={top3Data}
                      options={{
                        ...pdfBarOptions,
                        scales: {
                          ...pdfBarOptions.scales,
                          x: { ...pdfBarOptions.scales.x, ticks: { font: { size: 9, weight: '700' } } },
                        },
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '4px', flexDirection: 'column' }}>
                    {top3CAList.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '10.5px',
                          padding: '3px 6px',
                          borderRadius: '6px',
                          backgroundColor: idx === 0 ? '#fef3c7' : '#f8fafc',
                          fontWeight: '700',
                        }}
                      >
                        <span style={{ color: '#1e293b' }}>
                          {idx + 1}. {item.nom || item.projet || 'Projet'}
                        </span>
                        <span style={{ color: '#b45309' }}>{formatDH(item.total_ca)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Carte 2 : CA par Statut Juridique */}
                <div
                  style={{
                    border: '1.5px solid #e2e8f0',
                    borderRadius: '14px',
                    padding: '12px 14px',
                    backgroundColor: '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: '900', color: '#1d4ed8' }}>
                      CA PAR STATUT JURIDIQUE
                    </span>
                    <span style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8' }}>Consolidé</span>
                  </div>
                  <div style={{ height: '220px', position: 'relative' }}>
                    <Bar data={caStatutData} options={pdfBarOptions} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b' }}>
                    <span>SARL & Auto-entrepreneurs</span>
                    <span style={{ fontWeight: '800', color: '#0f172a' }}>{formatDH(caTotal)}</span>
                  </div>
                </div>

                {/* Carte 3 : Phases d'Incubation & Postes */}
                <div
                  style={{
                    border: '1.5px solid #e2e8f0',
                    borderRadius: '14px',
                    padding: '12px 14px',
                    backgroundColor: '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: '900', color: '#047857' }}>
                      MATURITÉ & CRÉATION D'EMPLOIS
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: '800',
                        color: '#065f46',
                        backgroundColor: '#d1fae5',
                        padding: '2px 6px',
                        borderRadius: '4px',
                      }}
                    >
                      {totalEmplois} postes
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', alignItems: 'center', height: '180px' }}>
                    <div style={{ height: '160px', position: 'relative' }}>
                      <Doughnut data={phaseData} options={pdfDoughnutOptions} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '10px', fontWeight: '800', color: '#475569', textTransform: 'uppercase' }}>
                        Top Recruteurs :
                      </span>
                      {topEmplois.length > 0 ? (
                        topEmplois.map((item, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              fontSize: '10px',
                              backgroundColor: '#f1f5f9',
                              padding: '4px 6px',
                              borderRadius: '6px',
                              fontWeight: '700',
                            }}
                          >
                            <span style={{ color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '90px' }}>
                              {item.projet || item.nom}
                            </span>
                            <span style={{ color: '#059669', fontWeight: '800' }}>{item.total_postes} p.</span>
                          </div>
                        ))
                      ) : (
                        <span style={{ fontSize: '10px', color: '#94a3b8' }}>Dossiers en recrutement</span>
                      )}
                    </div>
                  </div>

                  <div style={{ fontSize: '9.5px', color: '#64748b', borderTop: '1px solid #f1f5f9', paddingTop: '4px' }}>
                    Progression : Idéation → Lancement → Croissance → Maturité
                  </div>
                </div>
              </div>
            </div>

            {/* VOLET BAS : DÉMOGRAPHIE & PROFILS ACADÉMIQUES (HAUTEUR ~360px) */}
            <div style={{ display: 'flex', flexDirection: 'column', height: '360px', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '4px' }}>
                <div
                  style={{
                    backgroundColor: '#d1fae5',
                    color: '#065f46',
                    fontSize: '10px',
                    fontWeight: '900',
                    padding: '3px 8px',
                    borderRadius: '6px',
                  }}
                >
                  VOLET 2
                </div>
                <h4 style={{ fontSize: '13px', fontWeight: '900', color: '#1e293b', margin: '0', letterSpacing: '0.02em' }}>
                  DÉMOGRAPHIE, RÉPARTITION GÉOGRAPHIQUE & PROFILS ACADÉMIQUES
                </h4>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '0.85fr 1fr 1fr 1fr', gap: '14px', height: '325px' }}>
                {/* Carte 1 : Genre */}
                <div
                  style={{
                    border: '1.5px solid #e2e8f0',
                    borderRadius: '14px',
                    padding: '12px 14px',
                    backgroundColor: '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: '11px', fontWeight: '900', color: '#4338ca' }}>RÉPARTITION PAR GENRE</span>
                  <div style={{ height: '180px', position: 'relative' }}>
                    <Doughnut data={genreData} options={pdfDoughnutOptions} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: '10px', fontWeight: '700' }}>
                    {genreStats.map((g, i) => (
                      <span key={i} style={{ color: i === 0 ? '#6366f1' : '#10b981' }}>
                        {g.genre} : {g.count}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Carte 2 : Province */}
                <div
                  style={{
                    border: '1.5px solid #e2e8f0',
                    borderRadius: '14px',
                    padding: '12px 14px',
                    backgroundColor: '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: '11px', fontWeight: '900', color: '#0369a1' }}>PROVINCE / RÉGION</span>
                  <div style={{ height: '190px', position: 'relative' }}>
                    <Bar data={provinceData} options={pdfBarOptions} />
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748b', textAlign: 'center' }}>Salé, Rabat, Témara & Kénitra</div>
                </div>

                {/* Carte 3 : Secteur d'activité */}
                <div
                  style={{
                    border: '1.5px solid #e2e8f0',
                    borderRadius: '14px',
                    padding: '12px 14px',
                    backgroundColor: '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: '11px', fontWeight: '900', color: '#059669' }}>SECTEURS D'ACTIVITÉ</span>
                  <div style={{ height: '190px', position: 'relative' }}>
                    <Bar
                      data={domaineData}
                      options={{
                        ...pdfBarOptions,
                        indexAxis: 'y',
                      }}
                    />
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748b', textAlign: 'center' }}>Tech, Services, Économie Verte</div>
                </div>

                {/* Carte 4 : Niveau d'étude */}
                <div
                  style={{
                    border: '1.5px solid #e2e8f0',
                    borderRadius: '14px',
                    padding: '12px 14px',
                    backgroundColor: '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: '11px', fontWeight: '900', color: '#6d28d9' }}>NIVEAU D'ÉTUDE</span>
                  <div style={{ height: '180px', position: 'relative' }}>
                    <Doughnut data={etudeData} options={pdfDoughnutOptions} />
                  </div>
                  <div style={{ fontSize: '9.5px', color: '#64748b', textAlign: 'center' }}>
                    Bac+5, Ingénieurs, Licences & Formations Pro
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Page 2 pour le volet Impact & Espaces */
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', height: '100%' }}>
            <div style={{ border: '1.5px solid #e2e8f0', borderRadius: '14px', padding: '16px', backgroundColor: '#ffffff' }}>
              <h4 style={{ fontSize: '13px', fontWeight: '900', color: '#0f172a', margin: '0 0 12px' }}>
                TOP INCUBÉS LES PLUS ASSIDUS AUX FORMATIONS
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(impactStats?.assiduite?.topIncubes || []).slice(0, 6).map((inc, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      backgroundColor: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <span style={{ fontSize: '12px', fontWeight: '800', color: '#1e293b' }}>
                      {i + 1}. {inc.nomComplet}
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: '900', color: '#10b981' }}>{inc.taux}% de présence</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ border: '1.5px solid #e2e8f0', borderRadius: '14px', padding: '16px', backgroundColor: '#ffffff' }}>
              <h4 style={{ fontSize: '13px', fontWeight: '900', color: '#0f172a', margin: '0 0 12px' }}>
                OCCUPATION DES ESPACES & ÉTAT DU MATÉRIEL
              </h4>
              <div style={{ height: '320px', position: 'relative' }}>
                <Doughnut
                  data={{
                    labels: ['Fablab (3D & CNC)', 'Studio Média', 'Salles de Réunion'],
                    datasets: [
                      {
                        data: [
                          impactStats?.espaces?.parEspace?.fablab || 14,
                          impactStats?.espaces?.parEspace?.studio || 8,
                          impactStats?.espaces?.parEspace?.salle_reunion || 22,
                        ],
                        backgroundColor: ['#3b82f6', '#10b981', '#f59e0b'],
                      },
                    ],
                  }}
                  options={pdfDoughnutOptions}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
