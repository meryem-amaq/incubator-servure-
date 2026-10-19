import { useState, useMemo, useEffect } from 'react';
import { Save, TrendingUp, TrendingDown, DollarSign, FileSpreadsheet, Printer, FileDown, Plus, Trash2, Tag } from 'lucide-react';
import api from '../../api/axios';
import ExcelImportModal from '../common/ExcelImportModal';
import SignatureModal from '../common/SignatureModal';
import toast from 'react-hot-toast';

const MOIS_LABELS = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const FIXED_CHARGES_FIELDS = [
  { key: 'achats', label: 'Achats' },
  { key: 'charges_personnel', label: 'Charges personnel' },
  { key: 'charges_cnss', label: 'CNSS' },
  { key: 'salaire_porteur', label: 'Salaire porteur' },
  { key: 'loyer_coworking', label: 'Loyer / Coworking' },
  { key: 'eau_electricite', label: 'Eau & Électricité' },
  { key: 'transport', label: 'Transport' },
  { key: 'telephone', label: 'Téléphone' },
  { key: 'taxes', label: 'Taxes' },
  { key: 'tva', label: 'TVA' },
  { key: 'remboursement_credit', label: 'Remb. crédit' },
];

const CHARGES_FIELDS = [
  ...FIXED_CHARGES_FIELDS,
  { key: 'autres_charges', label: 'Autres charges' },
];

export const TYPES_CHARGES_SUGGESTIONS = [
  'Assurances',
  'Frais bancaires & Commissions',
  'Marketing, Communication & Publicité',
  'Honoraires comptables & Juridiques',
  'Entretien & Réparations',
  'Fournitures de bureau & Consommables',
  'Abonnements logiciels, SaaS & Hébergement',
  'Transport & Déplacements',
  'Frais postaux & Livraisons',
  'Frais de mission & Réception',
  'Formation & Documentation',
  'Autres charges diverses'
];

const emptyMonth = (m, annee) => ({
  mois: m, annee,
  ventes: 0, autres_revenus: 0,
  achats: 0, charges_personnel: 0, charges_cnss: 0, salaire_porteur: 0,
  loyer_coworking: 0, eau_electricite: 0, transport: 0, telephone: 0,
  taxes: 0, tva: 0, remboursement_credit: 0, autres_charges: 0,
  details_autres_charges: '',
});

export default function TabFinancier({ incubeId, incube = {}, data = [], onUpdate }) {
  const currentYear = new Date().getFullYear();
  const [annee, setAnnee] = useState(currentYear);
  const [saving, setSaving] = useState(false);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [showSigModal, setShowSigModal] = useState(false);
  const [documentHtml, setDocumentHtml] = useState(null);

  // Parsing initial des charges personnalisées/spécifiées depuis les données du serveur
  const parseCustomChargesFromData = (dataList, selectedYear) => {
    const yearRecords = (dataList || []).filter(d => parseInt(d.annee) === parseInt(selectedYear));
    const chargesMap = new Map();
    let hasDetails = false;

    for (const r of yearRecords) {
      if (r.details_autres_charges) {
        try {
          const parsed = typeof r.details_autres_charges === 'string' 
            ? JSON.parse(r.details_autres_charges) 
            : r.details_autres_charges;
          if (Array.isArray(parsed) && parsed.length > 0) {
            hasDetails = true;
            parsed.forEach((item, idx) => {
              const id = item.id || `charge_${idx + 1}`;
              const nom = item.nom || 'Autre charge';
              if (!chargesMap.has(id)) {
                chargesMap.set(id, { id, nom, valeurs: {} });
              }
              const chargeObj = chargesMap.get(id);
              if (item.nom && (chargeObj.nom === 'Autre charge' || chargeObj.nom.startsWith('charge_'))) {
                chargeObj.nom = item.nom;
              }
              chargeObj.valeurs[parseInt(r.mois)] = parseFloat(item.montant) || 0;
            });
          }
        } catch (e) {
          console.warn('Erreur parsing details_autres_charges:', e);
        }
      }
    }

    if (hasDetails && chargesMap.size > 0) {
      const list = Array.from(chargesMap.values());
      list.forEach(c => {
        for (let m = 1; m <= 12; m++) {
          if (c.valeurs[m] === undefined) c.valeurs[m] = 0;
        }
      });
      return list;
    }

    // Sinon, récupérer les montants legacy dans autres_charges s'ils existent
    const defaultVals = {};
    for (let m = 1; m <= 12; m++) {
      const existing = yearRecords.find(d => parseInt(d.mois) === m);
      defaultVals[m] = existing ? (parseFloat(existing.autres_charges) || 0) : 0;
    }

    return [
      {
        id: 'charge_1',
        nom: 'Autres charges',
        valeurs: defaultVals
      }
    ];
  };

  // Liste dynamique des années : garantit 2024 minimum + tout l'historique enregistré + prévisions (currentYear + 2)
  const availableYears = useMemo(() => {
    const fromData = (data || [])
      .map(d => parseInt(d.annee))
      .filter(y => !isNaN(y) && y >= 2020);

    const minYear = Math.min(2024, currentYear - 2, ...fromData);
    const maxYear = Math.max(currentYear + 2, ...fromData);

    const list = [];
    for (let y = minYear; y <= maxYear; y++) {
      list.push(y);
    }
    return Array.from(new Set([...fromData, ...list])).sort((a, b) => a - b);
  }, [data, currentYear]);

  // État des charges personnalisées spécifiées (nom et 12 mois)
  const [customCharges, setCustomCharges] = useState(() => parseCustomChargesFromData(data, annee));

  // Initialiser 12 mois
  const [months, setMonths] = useState(() => {
    const init = {};
    for (let m = 1; m <= 12; m++) {
      const existing = (data || []).find(d => parseInt(d.mois) === m && parseInt(d.annee) === annee);
      init[m] = existing ? { ...existing } : emptyMonth(m, annee);
    }
    return init;
  });

  // Synchronisation dynamique quand les données du serveur ou l'année changent
  useEffect(() => {
    const init = {};
    for (let m = 1; m <= 12; m++) {
      const existing = (data || []).find(d => parseInt(d.mois) === m && parseInt(d.annee) === parseInt(annee));
      init[m] = existing ? { ...existing } : emptyMonth(m, annee);
    }
    setMonths(init);
    setCustomCharges(parseCustomChargesFromData(data, annee));
  }, [data, annee]);

  // Handlers pour les charges personnalisées
  const handleCustomChargeValueChange = (chargeId, mois, valStr) => {
    const num = valStr === '' ? 0 : parseFloat(valStr) || 0;
    setCustomCharges(prev => {
      const next = prev.map(c => {
        if (c.id !== chargeId) return c;
        return {
          ...c,
          valeurs: { ...c.valeurs, [mois]: num }
        };
      });

      // Synchroniser avec months
      setMonths(prevMonths => {
        const sumMois = next.reduce((s, c) => s + (parseFloat(c.valeurs[mois]) || 0), 0);
        const detailsMois = JSON.stringify(next.map(c => ({
          id: c.id,
          nom: c.nom || 'Autre charge',
          montant: parseFloat(c.valeurs[mois]) || 0,
        })));

        return {
          ...prevMonths,
          [mois]: {
            ...prevMonths[mois],
            autres_charges: sumMois,
            details_autres_charges: detailsMois,
          }
        };
      });

      return next;
    });
  };

  const handleCustomChargeNomChange = (chargeId, newNom) => {
    setCustomCharges(prev => {
      const next = prev.map(c => (c.id === chargeId ? { ...c, nom: newNom } : c));
      
      setMonths(prevMonths => {
        const updated = { ...prevMonths };
        for (let m = 1; m <= 12; m++) {
          const detailsMois = JSON.stringify(next.map(c => ({
            id: c.id,
            nom: c.nom || 'Autre charge',
            montant: parseFloat(c.valeurs[m]) || 0,
          })));
          updated[m] = {
            ...updated[m],
            details_autres_charges: detailsMois,
          };
        }
        return updated;
      });

      return next;
    });
  };

  const handleAddCustomCharge = () => {
    const newId = `charge_${Date.now()}`;
    const newNom = '';
    const initialVals = {};
    for (let m = 1; m <= 12; m++) initialVals[m] = 0;

    const newCharge = { id: newId, nom: newNom, valeurs: initialVals };
    setCustomCharges(prev => {
      const next = [...prev, newCharge];
      setMonths(prevMonths => {
        const updated = { ...prevMonths };
        for (let m = 1; m <= 12; m++) {
          const sumMois = next.reduce((s, c) => s + (parseFloat(c.valeurs[m]) || 0), 0);
          const detailsMois = JSON.stringify(next.map(c => ({
            id: c.id,
            nom: c.nom || 'Autre charge',
            montant: parseFloat(c.valeurs[m]) || 0,
          })));
          updated[m] = {
            ...updated[m],
            autres_charges: sumMois,
            details_autres_charges: detailsMois,
          };
        }
        return updated;
      });
      return next;
    });
  };

  const handleRemoveCustomCharge = (chargeId) => {
    setCustomCharges(prev => {
      let next = prev.filter(c => c.id !== chargeId);
      if (next.length === 0) {
        const resetVals = {};
        for (let m = 1; m <= 12; m++) resetVals[m] = 0;
        next = [{ id: `charge_${Date.now()}`, nom: 'Autres charges', valeurs: resetVals }];
      }

      setMonths(prevMonths => {
        const updated = { ...prevMonths };
        for (let m = 1; m <= 12; m++) {
          const sumMois = next.reduce((s, c) => s + (parseFloat(c.valeurs[m]) || 0), 0);
          const detailsMois = JSON.stringify(next.map(c => ({
            id: c.id,
            nom: c.nom || 'Autre charge',
            montant: parseFloat(c.valeurs[m]) || 0,
          })));
          updated[m] = {
            ...updated[m],
            autres_charges: sumMois,
            details_autres_charges: detailsMois,
          };
        }
        return updated;
      });

      return next;
    });
  };

  const handleImportFinances = (importedRows) => {
    if (!importedRows || importedRows.length === 0) {
      toast.error('Aucune donnée financière trouvée dans le fichier.');
      return;
    }

    const validRows = (importedRows || []).map(r => {
      const trimmedStr = String(r.mois ?? '').trim();
      const numericMonth = Number(trimmedStr);
      let mIdx = Number.isInteger(numericMonth) && numericMonth >= 1 && numericMonth <= 12 ? numericMonth : NaN;
      if (Number.isNaN(mIdx)) {
        const found = MOIS_LABELS.findIndex(l => l.toLowerCase() === trimmedStr.toLowerCase());
        if (found > 0) mIdx = found;
      }
      return { ...r, mIdx };
    }).filter(r => r.mIdx >= 1 && r.mIdx <= 12);

    if (validRows.length === 0) {
      toast.error('Aucun mois valide trouvé dans le fichier.');
      return;
    }

    setMonths(prev => {
      const next = { ...prev };
      for (const r of validRows) {
        next[r.mIdx] = {
          ...next[r.mIdx],
          ventes: parseFloat(r.ventes) || 0,
          autres_revenus: parseFloat(r.autres_revenus) || 0,
          achats: parseFloat(r.achats) || 0,
          charges_personnel: parseFloat(r.charges_personnel) || 0,
          charges_cnss: parseFloat(r.charges_cnss) || 0,
          salaire_porteur: parseFloat(r.salaire_porteur) || 0,
          loyer_coworking: parseFloat(r.loyer_coworking) || 0,
          eau_electricite: parseFloat(r.eau_electricite) || 0,
          transport: parseFloat(r.transport) || 0,
          telephone: parseFloat(r.telephone) || 0,
          taxes: parseFloat(r.taxes) || 0,
          tva: parseFloat(r.tva) || 0,
          remboursement_credit: parseFloat(r.remboursement_credit) || 0,
          autres_charges: parseFloat(r.autres_charges) || 0,
        };
      }
      return next;
    });

    // Mettre également à jour la première charge avec les valeurs d'autres_charges importées
    setCustomCharges(prev => {
      const copy = [...prev];
      if (copy.length === 0) {
        copy.push({ id: 'charge_1', nom: 'Autres charges', valeurs: {} });
      }
      for (const r of validRows) {
        copy[0].valeurs[r.mIdx] = parseFloat(r.autres_charges) || 0;
      }
      return copy;
    });

    toast.success(`${validRows.length} mois remplis depuis Excel ! Cliquez sur "Enregistrer tout" pour valider.`);
  };

  const updateField = (mois, field, value) => {
    const num = value === '' ? 0 : parseFloat(value) || 0;
    setMonths(prev => ({
      ...prev,
      [mois]: { ...prev[mois], [field]: num }
    }));
  };

  // Calculs dynamiques basés sur les chiffres en temps réel
  const calculs = useMemo(() => {
    const result = {};
    for (let m = 1; m <= 12; m++) {
      const d = months[m] || emptyMonth(m, annee);
      const revenus = (d.ventes || 0) + (d.autres_revenus || 0);
      const charges = FIXED_CHARGES_FIELDS.reduce((sum, f) => sum + (d[f.key] || 0), 0) + (d.autres_charges || 0);
      result[m] = { revenus, charges, resultat: revenus - charges };
    }

    // Trimestres
    const trim = (start) => {
      let rev = 0, cha = 0;
      for (let m = start; m < start + 3; m++) {
        rev += result[m]?.revenus || 0;
        cha += result[m]?.charges || 0;
      }
      return { revenus: rev, charges: cha, resultat: rev - cha };
    };

    result.T1 = trim(1);  // Jan-Mar
    result.T2 = trim(4);  // Avr-Jun
    result.T3 = trim(7);  // Jul-Sep
    result.T4 = trim(10); // Oct-Déc

    // Total annuel
    let totalRev = 0, totalCha = 0;
    for (let m = 1; m <= 12; m++) {
      totalRev += result[m]?.revenus || 0;
      totalCha += result[m]?.charges || 0;
    }
    result.TOTAL = { revenus: totalRev, charges: totalCha, resultat: totalRev - totalCha };

    return result;
  }, [months, annee]);

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const itemsToSave = Object.values(months).map(m => {
        const mIdx = parseInt(m.mois);
        const sumMois = customCharges.reduce((s, c) => s + (parseFloat(c.valeurs[mIdx]) || 0), 0);
        const detailsMois = JSON.stringify(customCharges.map(c => ({
          id: c.id,
          nom: c.nom?.trim() || 'Autre charge',
          montant: parseFloat(c.valeurs[mIdx]) || 0,
        })));
        return {
          ...m,
          incube_id: incubeId,
          annee: annee,
          autres_charges: sumMois,
          details_autres_charges: detailsMois,
        };
      });
      await api.post(`/incubes/${incubeId}/analyse-financiere/bulk`, itemsToSave);
      toast.success('Données financières enregistrées avec succès !');
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de l'enregistrement des finances");
    } finally { setSaving(false); }
  };

  const fmt = (v) => new Intl.NumberFormat('fr-MA', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(v || 0));

  // Badge de résultat dynamique : Vert si positif (+), Rouge si négatif (-), Neutre si zéro
  const resBadge = (v) => {
    if (v > 0) {
      return (
        <span className="text-emerald-600 dark:text-emerald-400 font-black inline-flex items-center justify-center gap-1">
          <TrendingUp size={14} className="text-emerald-500 shrink-0 stroke-[2.5]" />
          +{fmt(v)}
        </span>
      );
    }
    if (v < 0) {
      return (
        <span className="text-rose-600 dark:text-rose-400 font-black inline-flex items-center justify-center gap-1">
          <TrendingDown size={14} className="text-rose-500 shrink-0 stroke-[2.5]" />
          {fmt(v)}
        </span>
      );
    }
    return (
      <span className="text-slate-400 dark:text-slate-500 font-semibold inline-flex items-center justify-center gap-1">
        <span className="text-slate-400 font-bold">—</span> 0
      </span>
    );
  };

  const buildFinancialHtml = (signatureImage = null, isPrint = false) => {
    const esc = (str) => {
      if (!str) return '—';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    const dateEdition = new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date());

    const totalRev = calculs.TOTAL?.revenus || 0;
    const totalCha = calculs.TOTAL?.charges || 0;
    const totalRes = calculs.TOTAL?.resultat || 0;
    const isBenefice = totalRes > 0;
    const isDeficit = totalRes < 0;
    const tauxMarge = totalRev > 0 ? ((totalRes / totalRev) * 100).toFixed(1) : '0.0';
    const statusText = isBenefice ? 'Bénéficiaire' : isDeficit ? 'Déficitaire' : 'À l\'équilibre';
    const statusColor = isBenefice ? '#166534' : isDeficit ? '#991b1b' : '#334155';
    const statusBg = isBenefice ? '#dcfce7' : isDeficit ? '#fee2e2' : '#f1f5f9';
    const logoUrl = `${window.location.origin}/logo-ids.png`;

    // Totaux Semestre 1 (Janvier à Juin)
    const revS1 = (calculs.T1?.revenus || 0) + (calculs.T2?.revenus || 0);
    const chaS1 = (calculs.T1?.charges || 0) + (calculs.T2?.charges || 0);
    const resS1 = revS1 - chaS1;

    // Totaux Semestre 2 (Juillet à Décembre)
    const revS2 = (calculs.T3?.revenus || 0) + (calculs.T4?.revenus || 0);
    const chaS2 = (calculs.T3?.charges || 0) + (calculs.T4?.charges || 0);
    const resS2 = revS2 - chaS2;

    const getTrimValue = (key, trimIndex) => {
      const start = (trimIndex - 1) * 3 + 1;
      let sum = 0;
      for (let m = start; m < start + 3; m++) {
        sum += (months[m]?.[key] || 0);
      }
      return sum;
    };

    const getSemesterValue = (key, semIndex) => {
      const start = semIndex === 1 ? 1 : 7;
      let sum = 0;
      for (let m = start; m < start + 6; m++) {
        sum += (months[m]?.[key] || 0);
      }
      return sum;
    };

    const getAnnualValue = (key) => {
      return Object.values(months).reduce((s, d) => s + (d[key] || 0), 0);
    };

    // Ligne pour Tableau S1 (Janvier à Juin : 10 colonnes, total 100%)
    const renderRowS1 = (label, key, isTotal = false, isChargesTotal = false) => {
      let trClass = '';
      if (isTotal) trClass = 'total-revenus-row';
      else if (isChargesTotal) trClass = 'total-charges-row';

      const cells = [];
      cells.push(`<td class="col-rubrique ${isTotal || isChargesTotal ? 'font-bold' : ''}">${label}</td>`);

      // T1 (Jan, Fév, Mar + Total T1)
      for (let m = 1; m <= 3; m++) {
        const val = isTotal ? calculs[m]?.revenus : isChargesTotal ? calculs[m]?.charges : (months[m]?.[key] || 0);
        cells.push(`<td class="cell-num ${val ? 'has-val' : 'empty'}">${val ? fmt(val) : '—'}</td>`);
      }
      const t1Val = isTotal ? calculs.T1?.revenus : isChargesTotal ? calculs.T1?.charges : getTrimValue(key, 1);
      cells.push(`<td class="cell-trim ${t1Val ? 'has-val' : 'empty'}">${t1Val ? fmt(t1Val) : '0'}</td>`);

      // T2 (Avr, Mai, Juin + Total T2)
      for (let m = 4; m <= 6; m++) {
        const val = isTotal ? calculs[m]?.revenus : isChargesTotal ? calculs[m]?.charges : (months[m]?.[key] || 0);
        cells.push(`<td class="cell-num ${val ? 'has-val' : 'empty'}">${val ? fmt(val) : '—'}</td>`);
      }
      const t2Val = isTotal ? calculs.T2?.revenus : isChargesTotal ? calculs.T2?.charges : getTrimValue(key, 2);
      cells.push(`<td class="cell-trim ${t2Val ? 'has-val' : 'empty'}">${t2Val ? fmt(t2Val) : '0'}</td>`);

      // TOTAL S1
      const totS1Val = isTotal ? revS1 : isChargesTotal ? chaS1 : getSemesterValue(key, 1);
      cells.push(`<td class="cell-total font-bold">${fmt(totS1Val)}</td>`);

      return `<tr class="${trClass}">${cells.join('')}</tr>`;
    };

    // Ligne de charge personnalisée / spécifiée S1
    const renderCustomChargeRowS1 = (c) => {
      const cells = [];
      const nom = c.nom?.trim() || 'Autre charge';
      cells.push(`<td class="col-rubrique font-medium" style="color: #334155;">${esc(nom)}</td>`);

      // T1 (Jan, Fév, Mar + Total T1)
      let t1 = 0;
      for (let m = 1; m <= 3; m++) {
        const val = c.valeurs?.[m] || 0;
        t1 += val;
        cells.push(`<td class="cell-num ${val ? 'has-val' : 'empty'}">${val ? fmt(val) : '—'}</td>`);
      }
      cells.push(`<td class="cell-trim ${t1 ? 'has-val' : 'empty'}">${t1 ? fmt(t1) : '0'}</td>`);

      // T2 (Avr, Mai, Juin + Total T2)
      let t2 = 0;
      for (let m = 4; m <= 6; m++) {
        const val = c.valeurs?.[m] || 0;
        t2 += val;
        cells.push(`<td class="cell-num ${val ? 'has-val' : 'empty'}">${val ? fmt(val) : '—'}</td>`);
      }
      cells.push(`<td class="cell-trim ${t2 ? 'has-val' : 'empty'}">${t2 ? fmt(t2) : '0'}</td>`);

      // TOTAL S1
      const totS1 = t1 + t2;
      cells.push(`<td class="cell-total font-bold">${fmt(totS1)}</td>`);

      return `<tr>${cells.join('')}</tr>`;
    };

    // Ligne Résultat S1
    const renderResultRowS1 = () => {
      const cells = [];
      cells.push('<td class="col-rubrique font-black result-header">RÉSULTAT NET S1</td>');

      for (let m = 1; m <= 3; m++) {
        const res = calculs[m]?.resultat || 0;
        const cls = res > 0 ? 'text-pos font-bold' : res < 0 ? 'text-neg font-bold' : 'text-neutral';
        cells.push(`<td class="cell-num ${cls}">${res > 0 ? '+' : ''}${fmt(res)}</td>`);
      }
      const t1Res = calculs.T1?.resultat || 0;
      const t1Cls = t1Res > 0 ? 'text-pos font-black' : t1Res < 0 ? 'text-neg font-black' : 'text-neutral';
      cells.push(`<td class="cell-trim ${t1Cls} result-trim">${t1Res > 0 ? '+' : ''}${fmt(t1Res)}</td>`);

      for (let m = 4; m <= 6; m++) {
        const res = calculs[m]?.resultat || 0;
        const cls = res > 0 ? 'text-pos font-bold' : res < 0 ? 'text-neg font-bold' : 'text-neutral';
        cells.push(`<td class="cell-num ${cls}">${res > 0 ? '+' : ''}${fmt(res)}</td>`);
      }
      const t2Res = calculs.T2?.resultat || 0;
      const t2Cls = t2Res > 0 ? 'text-pos font-black' : t2Res < 0 ? 'text-neg font-black' : 'text-neutral';
      cells.push(`<td class="cell-trim ${t2Cls} result-trim">${t2Res > 0 ? '+' : ''}${fmt(t2Res)}</td>`);

      const s1Cls = resS1 > 0 ? 'text-pos font-black' : resS1 < 0 ? 'text-neg font-black' : 'text-neutral';
      cells.push(`<td class="cell-total ${s1Cls} result-total">${resS1 > 0 ? '+' : ''}${fmt(resS1)}</td>`);

      return `<tr class="result-row">${cells.join('')}</tr>`;
    };

    // Ligne pour Tableau S2 (Juillet à Décembre + Annuel : 11 colonnes, total 100%)
    const renderRowS2 = (label, key, isTotal = false, isChargesTotal = false) => {
      let trClass = '';
      if (isTotal) trClass = 'total-revenus-row';
      else if (isChargesTotal) trClass = 'total-charges-row';

      const cells = [];
      cells.push(`<td class="col-rubrique ${isTotal || isChargesTotal ? 'font-bold' : ''}">${label}</td>`);

      // T3 (Juil, Aoû, Sep + Total T3)
      for (let m = 7; m <= 9; m++) {
        const val = isTotal ? calculs[m]?.revenus : isChargesTotal ? calculs[m]?.charges : (months[m]?.[key] || 0);
        cells.push(`<td class="cell-num ${val ? 'has-val' : 'empty'}">${val ? fmt(val) : '—'}</td>`);
      }
      const t3Val = isTotal ? calculs.T3?.revenus : isChargesTotal ? calculs.T3?.charges : getTrimValue(key, 3);
      cells.push(`<td class="cell-trim ${t3Val ? 'has-val' : 'empty'}">${t3Val ? fmt(t3Val) : '0'}</td>`);

      // T4 (Oct, Nov, Déc + Total T4)
      for (let m = 10; m <= 12; m++) {
        const val = isTotal ? calculs[m]?.revenus : isChargesTotal ? calculs[m]?.charges : (months[m]?.[key] || 0);
        cells.push(`<td class="cell-num ${val ? 'has-val' : 'empty'}">${val ? fmt(val) : '—'}</td>`);
      }
      const t4Val = isTotal ? calculs.T4?.revenus : isChargesTotal ? calculs.T4?.charges : getTrimValue(key, 4);
      cells.push(`<td class="cell-trim ${t4Val ? 'has-val' : 'empty'}">${t4Val ? fmt(t4Val) : '0'}</td>`);

      // TOTAL S2
      const totS2Val = isTotal ? revS2 : isChargesTotal ? chaS2 : getSemesterValue(key, 2);
      cells.push(`<td class="cell-trim font-bold">${fmt(totS2Val)}</td>`);

      // TOTAL ANNUEL
      const totAnnVal = isTotal ? totalRev : isChargesTotal ? totalCha : getAnnualValue(key);
      cells.push(`<td class="cell-total font-bold">${fmt(totAnnVal)}</td>`);

      return `<tr class="${trClass}">${cells.join('')}</tr>`;
    };

    // Ligne de charge personnalisée / spécifiée S2
    const renderCustomChargeRowS2 = (c) => {
      const cells = [];
      const nom = c.nom?.trim() || 'Autre charge';
      cells.push(`<td class="col-rubrique font-medium" style="color: #334155;">${esc(nom)}</td>`);

      // T3 (Juil, Aoû, Sep + Total T3)
      let t3 = 0;
      for (let m = 7; m <= 9; m++) {
        const val = c.valeurs?.[m] || 0;
        t3 += val;
        cells.push(`<td class="cell-num ${val ? 'has-val' : 'empty'}">${val ? fmt(val) : '—'}</td>`);
      }
      cells.push(`<td class="cell-trim ${t3 ? 'has-val' : 'empty'}">${t3 ? fmt(t3) : '0'}</td>`);

      // T4 (Oct, Nov, Déc + Total T4)
      let t4 = 0;
      for (let m = 10; m <= 12; m++) {
        const val = c.valeurs?.[m] || 0;
        t4 += val;
        cells.push(`<td class="cell-num ${val ? 'has-val' : 'empty'}">${val ? fmt(val) : '—'}</td>`);
      }
      cells.push(`<td class="cell-trim ${t4 ? 'has-val' : 'empty'}">${t4 ? fmt(t4) : '0'}</td>`);

      // TOTAL S2
      const totS2 = t3 + t4;
      cells.push(`<td class="cell-trim font-bold">${fmt(totS2)}</td>`);

      // TOTAL ANNUEL
      let totAnn = 0;
      for (let m = 1; m <= 12; m++) {
        totAnn += (c.valeurs?.[m] || 0);
      }
      cells.push(`<td class="cell-total font-bold">${fmt(totAnn)}</td>`);

      return `<tr>${cells.join('')}</tr>`;
    };

    // Ligne Résultat S2 & Annuel
    const renderResultRowS2 = () => {
      const cells = [];
      cells.push('<td class="col-rubrique font-black result-header">RÉSULTAT NET</td>');

      for (let m = 7; m <= 9; m++) {
        const res = calculs[m]?.resultat || 0;
        const cls = res > 0 ? 'text-pos font-bold' : res < 0 ? 'text-neg font-bold' : 'text-neutral';
        cells.push(`<td class="cell-num ${cls}">${res > 0 ? '+' : ''}${fmt(res)}</td>`);
      }
      const t3Res = calculs.T3?.resultat || 0;
      const t3Cls = t3Res > 0 ? 'text-pos font-black' : t3Res < 0 ? 'text-neg font-black' : 'text-neutral';
      cells.push(`<td class="cell-trim ${t3Cls} result-trim">${t3Res > 0 ? '+' : ''}${fmt(t3Res)}</td>`);

      for (let m = 10; m <= 12; m++) {
        const res = calculs[m]?.resultat || 0;
        const cls = res > 0 ? 'text-pos font-bold' : res < 0 ? 'text-neg font-bold' : 'text-neutral';
        cells.push(`<td class="cell-num ${cls}">${res > 0 ? '+' : ''}${fmt(res)}</td>`);
      }
      const t4Res = calculs.T4?.resultat || 0;
      const t4Cls = t4Res > 0 ? 'text-pos font-black' : t4Res < 0 ? 'text-neg font-black' : 'text-neutral';
      cells.push(`<td class="cell-trim ${t4Cls} result-trim">${t4Res > 0 ? '+' : ''}${fmt(t4Res)}</td>`);

      const s2Cls = resS2 > 0 ? 'text-pos font-black' : resS2 < 0 ? 'text-neg font-black' : 'text-neutral';
      cells.push(`<td class="cell-trim ${s2Cls} font-bold">${resS2 > 0 ? '+' : ''}${fmt(resS2)}</td>`);

      const totCls = totalRes > 0 ? 'text-pos font-black' : totalRes < 0 ? 'text-neg font-black' : 'text-neutral';
      cells.push(`<td class="cell-total ${totCls} result-total">${totalRes > 0 ? '+' : ''}${fmt(totalRes)}</td>`);

      return `<tr class="result-row">${cells.join('')}</tr>`;
    };

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Analyse Financière ${annee} — ${esc(incube?.nom_incube || 'Incubé')}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 5mm 8mm 5mm 8mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background: #f8fafc;
      margin: 0;
      padding: 12px;
      font-size: 9.5px;
      line-height: 1.25;
    }
    .action-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #0f172a;
      color: #fff;
      padding: 10px 18px;
      border-radius: 10px;
      margin-bottom: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .action-bar-title {
      font-size: 13px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .action-btn {
      background: #10b981;
      color: #fff;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 12px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: background 0.2s;
    }
    .action-btn:hover {
      background: #059669;
    }
    .action-btn-close {
      background: #334155;
      color: #e2e8f0;
      border: none;
      padding: 8px 14px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 12px;
      cursor: pointer;
      margin-left: 8px;
    }
    .action-btn-close:hover {
      background: #475569;
    }

    /* CONTENEUR DES PAGES */
    .document-page {
      background: #fff;
      width: 100%;
      max-width: 1140px;
      margin: 0 auto;
      padding: 0;
    }

    .page {
      background: #fff;
      width: 100%;
      margin: 0 0 20px 0;
      padding: 18px 20px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.06);
      border: 1px solid #e2e8f0;
      box-sizing: border-box;
    }

    .page-1 {
      margin-top: 0 !important;
      padding-top: 0 !important;
    }

    .page-2 {
      page-break-before: always;
      break-before: page;
      margin-top: 0 !important;
      padding-top: 14px !important;
    }

    /* HEADER */
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin: 0 0 10px 0;
      padding-top: 0;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 8px;
    }
    .header-logo {
      width: 50px;
      height: 50px;
      object-fit: contain;
      border-radius: 8px;
    }
    .header-org-title {
      font-size: 14px;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin: 0;
    }
    .header-org-sub {
      font-size: 9px;
      color: #047857;
      font-weight: 700;
      margin: 2px 0 0 0;
    }
    .header-doc-title {
      text-align: right;
    }
    .header-badge {
      display: inline-block;
      background: #0f172a;
      color: #f8fafc;
      font-size: 9.5px;
      font-weight: 800;
      letter-spacing: 0.8px;
      padding: 3px 8px;
      border-radius: 5px;
      text-transform: uppercase;
    }
    .header-year {
      font-size: 12px;
      font-weight: 900;
      color: #0f172a;
      margin-top: 2px;
    }
    .header-date {
      font-size: 8.5px;
      color: #64748b;
      margin-top: 1px;
    }

    /* MINI HEADER PAGE 2 */
    .mini-header-table {
      width: 100%;
      border-collapse: collapse;
      margin: 0 0 10px 0;
      border-bottom: 1.5px solid #0f172a;
      padding-bottom: 6px;
    }

    /* METADATA GRID */
    .meta-box {
      width: 100%;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      background: #f8fafc;
      padding: 6px 10px;
      margin-bottom: 10px;
    }
    .meta-table {
      width: 100%;
      border-collapse: collapse;
    }
    .meta-table td {
      padding: 2px 5px;
      font-size: 9px;
      vertical-align: top;
    }
    .meta-label {
      color: #64748b;
      font-weight: 600;
      width: 110px;
    }
    .meta-value {
      color: #0f172a;
      font-weight: 700;
    }
    .status-badge {
      display: inline-block;
      padding: 1.5px 7px;
      border-radius: 4px;
      font-weight: 800;
      font-size: 8.5px;
    }

    /* SYNTHÈSE TRIMESTRIELLE */
    .summary-grid {
      display: grid;
      gap: 8px;
      margin-bottom: 10px;
      width: 100%;
    }
    .summary-grid-3 {
      grid-template-columns: repeat(3, 1fr);
    }
    .summary-grid-4 {
      grid-template-columns: repeat(4, 1fr);
    }
    .summary-card {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 6px 8px;
      background: #fff;
    }
    .summary-card.highlight {
      border: 1.5px solid #0284c7;
      background: #f0f9ff;
    }
    .summary-title {
      font-size: 8.5px;
      font-weight: 800;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 3px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      font-size: 8.5px;
      margin-bottom: 2px;
      color: #334155;
    }
    .summary-res {
      border-top: 1px dashed #cbd5e1;
      margin-top: 3px;
      padding-top: 2px;
      font-weight: 800;
      display: flex;
      justify-content: space-between;
      font-size: 8.5px;
    }

    /* MASTER FINANCIAL TABLES 100% WIDTH */
    .fin-table-wrapper {
      width: 100%;
      overflow-x: auto;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      margin-bottom: 10px;
    }
    .fin-table {
      width: 100% !important;
      border-collapse: collapse;
      font-size: 8.5px;
      table-layout: fixed;
    }
    .fin-table th, .fin-table td {
      border: 1px solid #e2e8f0;
      padding: 3.5px 2px;
      text-align: right;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .fin-table th {
      background: #f1f5f9;
      color: #1e293b;
      font-weight: 800;
      text-align: center;
      font-size: 8.5px;
      padding: 5px 2px;
    }
    .col-rubrique {
      text-align: left !important;
      padding-left: 5px !important;
      font-size: 8.5px;
      color: #1e293b;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .cell-num {
      color: #475569;
      font-variant-numeric: tabular-nums;
    }
    .cell-num.has-val {
      color: #0f172a;
      font-weight: 600;
    }
    .cell-num.empty {
      color: #cbd5e1;
    }
    .cell-trim {
      background: #f8fafc;
      font-weight: 700;
      color: #0f172a;
      border-left: 1.5px solid #cbd5e1 !important;
      border-right: 1.5px solid #cbd5e1 !important;
      font-variant-numeric: tabular-nums;
    }
    .cell-total {
      background: #f1f5f9;
      font-weight: 800;
      color: #0f172a;
      border-left: 2px solid #94a3b8 !important;
      font-variant-numeric: tabular-nums;
    }

    /* SECTION HEADERS */
    .section-header td {
      background: #f1f5f9;
      font-weight: 900;
      font-size: 8.5px;
      text-align: left;
      padding: 3.5px 5px;
      letter-spacing: 0.5px;
    }
    .section-rev td {
      background: #ecfdf5;
      color: #065f46;
      border-top: 1.5px solid #a7f3d0;
      border-bottom: 1.5px solid #a7f3d0;
    }
    .section-cha td {
      background: #fef2f2;
      color: #991b1b;
      border-top: 1.5px solid #fecaca;
      border-bottom: 1.5px solid #fecaca;
    }

    /* TOTAL ROWS */
    .total-revenus-row td {
      background: #ecfdf5;
      color: #065f46;
      font-weight: 800;
      border-top: 1.5px solid #6ee7b7;
      border-bottom: 1.5px solid #6ee7b7;
    }
    .total-charges-row td {
      background: #fef2f2;
      color: #991b1b;
      font-weight: 800;
      border-top: 1.5px solid #fca5a5;
      border-bottom: 1.5px solid #fca5a5;
    }

    /* MASTER RESULT ROW */
    .result-row td {
      background: #f8fafc;
      border-top: 2px solid #0f172a !important;
      border-bottom: 2px solid #0f172a !important;
      padding: 4.5px 2px;
    }
    .result-header {
      font-size: 9px;
      color: #0f172a;
    }
    .text-pos {
      color: #15803d;
    }
    .text-neg {
      color: #dc2626;
    }
    .text-neutral {
      color: #64748b;
    }

    /* RATIOS & SIGNATURES */
    .footer-grid {
      display: grid;
      grid-template-columns: 1.2fr 1fr 1fr;
      gap: 10px;
      margin-top: 8px;
    }
    .kpi-box {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 6px 8px;
      background: #f8fafc;
    }
    .kpi-title {
      font-size: 8.5px;
      font-weight: 800;
      color: #334155;
      text-transform: uppercase;
      margin-bottom: 4px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 2px;
    }
    .kpi-row {
      display: flex;
      justify-content: space-between;
      font-size: 8px;
      margin-bottom: 2px;
    }
    .sig-box {
      border: 1px dashed #94a3b8;
      border-radius: 6px;
      padding: 6px 8px;
      background: #fff;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 62px;
    }
    .sig-title {
      font-size: 8.5px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
    }
    .sig-sub {
      font-size: 7.5px;
      color: #64748b;
      margin-top: 1px;
    }
    .sig-line {
      border-bottom: 1px solid #cbd5e1;
      margin-top: 22px;
      text-align: right;
      font-size: 7px;
      color: #94a3b8;
    }

    .doc-legal {
      margin-top: 8px;
      text-align: center;
      font-size: 7.5px;
      color: #94a3b8;
    }

    @media print {
      @page {
        size: A4 landscape;
        margin: 5mm 8mm 5mm 8mm;
      }
      .no-print {
        display: none !important;
      }
      body {
        background: #fff;
        padding: 0;
        margin: 0;
      }
      .document-page {
        box-shadow: none;
        border: none;
        padding: 0;
        margin: 0;
        width: 100%;
        max-width: 100%;
      }
      .page {
        box-shadow: none;
        border: none;
        padding: 0;
        margin: 0;
        border-radius: 0;
        width: 100%;
      }
      .page-1 {
        margin-top: 0 !important;
        padding-top: 0 !important;
      }
      .page-2 {
        page-break-before: always;
        break-before: page;
        margin-top: 0 !important;
        padding-top: 0 !important;
      }
    }
  </style>
</head>
<body>

  ${isPrint ? `
  <!-- BARRE D'ACTION (ÉCRAN UNIQUEMENT) -->
  <div class="action-bar no-print">
    <div class="action-bar-title">
      <span>📄 Rapport Financier Officiel — Exercice ${annee}</span>
      <span style="font-size:11px; font-weight:normal; opacity:0.9; background:rgba(255,255,255,0.15); padding:2px 8px; border-radius:4px;">
        Format Paysage A4 (Landscape)
      </span>
    </div>
    <div>
      <button onclick="window.print()" class="action-btn">
        📥 Télécharger / Enregistrer en PDF (Paysage)
      </button>
      <button onclick="window.close()" class="action-btn-close">
        ✕ Fermer
      </button>
    </div>
  </div>
  ` : ''}

  <div class="document-page">

    <!-- ========================================== -->
    <!-- PAGE 1 : SEMESTRE 1 (Janvier à Juin)       -->
    <!-- ========================================== -->
    <div class="page page-1">
      <!-- ENTÊTE INSTITUTIONNELLE -->
      <table class="header-table">
        <tr>
          <td style="width: 55px; vertical-align: middle;">
            <img src="${logoUrl}" alt="IDS" class="header-logo" onerror="this.style.display='none'">
          </td>
          <td style="vertical-align: middle; padding-left: 10px;">
            <h1 class="header-org-title">Incubateur Digital Solidaire</h1>
            <p class="header-org-sub">Incubateur Digital Solidaire (IDS) — Suivi Comptable & Financier</p>
          </td>
          <td class="header-doc-title" style="vertical-align: middle;">
            <span class="header-badge">Rapport Financier — Semestre 1</span>
            <div style="font-size:9.5px; font-weight:800; color:#0f172a; margin-top:4px;">
              ${esc(incube?.nom_incube || 'Incubé')} · Dossier : ${esc(incube?.pp_numero || '—')} · Exercice ${annee}
            </div>
            <div class="header-date">Édité le ${dateEdition}</div>
          </td>
        </tr>
      </table>

      <!-- FICHE PROJET & INCUBÉ -->
      <div class="meta-box">
        <table class="meta-table">
          <tr>
            <td class="meta-label">Porteur de Projet :</td>
            <td class="meta-value" style="font-size:10px; color:#0f172a;">${esc(incube?.nom_incube || 'Non spécifié')}</td>
            <td class="meta-label">N° Dossier (PP) :</td>
            <td class="meta-value">${esc(incube?.pp_numero || '—')}</td>
          </tr>
          <tr>
            <td class="meta-label">Raison Sociale :</td>
            <td class="meta-value">${esc(incube?.raison_sociale || '—')}</td>
            <td class="meta-label">Phase d'Incubation :</td>
            <td class="meta-value">${esc(incube?.phase_projet || '—')}</td>
          </tr>
          <tr>
            <td class="meta-label">Domaine d'Activité :</td>
            <td class="meta-value">${esc(incube?.domaine_activite || '—')}</td>
            <td class="meta-label">Statut Exercice :</td>
            <td class="meta-value">
              <span class="status-badge" style="color:${statusColor}; background:${statusBg}; border:1px solid ${statusColor}40;">
                ${statusText} (${totalRes >= 0 ? '+' : ''}${fmt(totalRes)} MAD)
              </span>
            </td>
          </tr>
        </table>
      </div>

      <!-- SYNTHÈSE SEMESTRE 1 (T1, T2, TOTAL S1) -->
      <div class="summary-grid summary-grid-3">
        <!-- CARTE T1 -->
        <div class="summary-card">
          <div class="summary-title">
            <span>T1 (Janvier - Mars)</span>
            <span style="font-size:8px; color:${(calculs.T1?.resultat || 0) > 0 ? '#15803d' : (calculs.T1?.resultat || 0) < 0 ? '#dc2626' : '#64748b'};">
              ${(calculs.T1?.resultat || 0) > 0 ? 'Bénéfice' : (calculs.T1?.resultat || 0) < 0 ? 'Déficit' : 'Équilibre'}
            </span>
          </div>
          <div class="summary-row">
            <span style="color:#64748b;">Revenus :</span>
            <span style="font-weight:700; color:#15803d;">${fmt(calculs.T1?.revenus || 0)} MAD</span>
          </div>
          <div class="summary-row">
            <span style="color:#64748b;">Charges :</span>
            <span style="font-weight:700; color:#dc2626;">${fmt(calculs.T1?.charges || 0)} MAD</span>
          </div>
          <div class="summary-res">
            <span>Résultat T1 :</span>
            <span class="${(calculs.T1?.resultat || 0) > 0 ? 'text-pos' : (calculs.T1?.resultat || 0) < 0 ? 'text-neg' : 'text-neutral'}">
              ${(calculs.T1?.resultat || 0) > 0 ? '+' : ''}${fmt(calculs.T1?.resultat || 0)} MAD
            </span>
          </div>
        </div>

        <!-- CARTE T2 -->
        <div class="summary-card">
          <div class="summary-title">
            <span>T2 (Avril - Juin)</span>
            <span style="font-size:8px; color:${(calculs.T2?.resultat || 0) > 0 ? '#15803d' : (calculs.T2?.resultat || 0) < 0 ? '#dc2626' : '#64748b'};">
              ${(calculs.T2?.resultat || 0) > 0 ? 'Bénéfice' : (calculs.T2?.resultat || 0) < 0 ? 'Déficit' : 'Équilibre'}
            </span>
          </div>
          <div class="summary-row">
            <span style="color:#64748b;">Revenus :</span>
            <span style="font-weight:700; color:#15803d;">${fmt(calculs.T2?.revenus || 0)} MAD</span>
          </div>
          <div class="summary-row">
            <span style="color:#64748b;">Charges :</span>
            <span style="font-weight:700; color:#dc2626;">${fmt(calculs.T2?.charges || 0)} MAD</span>
          </div>
          <div class="summary-res">
            <span>Résultat T2 :</span>
            <span class="${(calculs.T2?.resultat || 0) > 0 ? 'text-pos' : (calculs.T2?.resultat || 0) < 0 ? 'text-neg' : 'text-neutral'}">
              ${(calculs.T2?.resultat || 0) > 0 ? '+' : ''}${fmt(calculs.T2?.resultat || 0)} MAD
            </span>
          </div>
        </div>

        <!-- CARTE TOTAL S1 -->
        <div class="summary-card highlight">
          <div class="summary-title" style="color:#0369a1;">
            <span>TOTAL SEMESTRE 1</span>
            <span style="font-size:8px; font-weight:800; color:${resS1 >= 0 ? '#15803d' : '#dc2626'};">
              ${resS1 > 0 ? 'Bénéfice S1' : resS1 < 0 ? 'Déficit S1' : 'Équilibre'}
            </span>
          </div>
          <div class="summary-row">
            <span style="color:#64748b;">Total Revenus S1 :</span>
            <span style="font-weight:800; color:#15803d;">${fmt(revS1)} MAD</span>
          </div>
          <div class="summary-row">
            <span style="color:#64748b;">Total Charges S1 :</span>
            <span style="font-weight:800; color:#dc2626;">${fmt(chaS1)} MAD</span>
          </div>
          <div class="summary-res" style="border-top-color:#0284c7;">
            <span style="color:#0f172a;">Résultat Net S1 :</span>
            <span class="${resS1 > 0 ? 'text-pos' : resS1 < 0 ? 'text-neg' : 'text-neutral'} font-black">
              ${resS1 > 0 ? '+' : ''}${fmt(resS1)} MAD
            </span>
          </div>
        </div>
      </div>

      <!-- TABLEAU S1 (100% LARGEUR : Rubrique 25%, 6 Mois 7.5% chacun, T1 & T2 9% chacun, TOTAL S1 12%) -->
      <div class="fin-table-wrapper">
        <table class="fin-table">
          <thead>
            <tr>
              <th style="width: 25%; text-align: left; padding-left: 5px;">Rubrique</th>
              <th style="width: 7.5%;">Jan</th>
              <th style="width: 7.5%;">Fév</th>
              <th style="width: 7.5%;">Mar</th>
              <th style="width: 9%;" class="cell-trim">T1</th>
              <th style="width: 7.5%;">Avr</th>
              <th style="width: 7.5%;">Mai</th>
              <th style="width: 7.5%;">Juin</th>
              <th style="width: 9%;" class="cell-trim">T2</th>
              <th style="width: 12%;" class="cell-total">TOTAL S1</th>
            </tr>
          </thead>
          <tbody>
            <!-- SECTION REVENUS S1 -->
            <tr class="section-header section-rev">
              <td colspan="10">PRODUITS & REVENUS D'EXPLOITATION (S1)</td>
            </tr>
            ${renderRowS1('Ventes', 'ventes')}
            ${renderRowS1('Autres revenus', 'autres_revenus')}
            ${renderRowS1('TOTAL REVENUS S1', '', true, false)}

            <!-- SECTION CHARGES S1 -->
            <tr class="section-header section-cha">
              <td colspan="10">CHARGES D'EXPLOITATION (S1)</td>
            </tr>
            ${FIXED_CHARGES_FIELDS.map(f => renderRowS1(f.label, f.key)).join('')}
            ${customCharges.map(c => renderCustomChargeRowS1(c)).join('')}
            ${renderRowS1('TOTAL CHARGES S1', '', false, true)}

            <!-- SECTION RÉSULTAT S1 -->
            ${renderResultRowS1()}
          </tbody>
        </table>
      </div>

      <!-- MENTIONS LÉGALES PAGE 1 -->
      <div class="doc-legal">
        Incubateur Digital Solidaire (IDS) · Suivi Comptable Semestre 1 · Page 1/2
      </div>
    </div>

    <!-- ======================================================= -->
    <!-- PAGE 2 : SEMESTRE 2 (Juillet à Décembre) + BILAN ANNUEL -->
    <!-- ======================================================= -->
    <div class="page page-2">
      <!-- MINI EN-TÊTE PAGE 2 (SANS FABLAB) -->
      <table class="mini-header-table">
        <tr>
          <td style="width: 45px; vertical-align: middle;">
            <img src="${logoUrl}" alt="IDS" style="width:40px; height:40px; object-fit:contain;" onerror="this.style.display='none'">
          </td>
          <td style="vertical-align: middle; padding-left: 8px;">
            <div style="font-size:12px; font-weight:900; color:#0f172a; text-transform:uppercase;">Incubateur Digital Solidaire</div>
            <div style="font-size:8.5px; color:#047857; font-weight:700;">Incubateur Digital Solidaire (IDS) — Suivi Comptable & Financier</div>
          </td>
          <td style="text-align: right; vertical-align: middle;">
            <span class="header-badge">Rapport Financier — Semestre 2 & Bilan Annuel</span>
            <div style="font-size:9.5px; font-weight:800; color:#0f172a; margin-top:4px;">
              ${esc(incube?.nom_incube || 'Incubé')} · Dossier : ${esc(incube?.pp_numero || '—')} · Exercice ${annee}
            </div>
            <div class="header-date">Édité le ${dateEdition}</div>
          </td>
        </tr>
      </table>

      <!-- SYNTHÈSE SEMESTRE 2 & BILAN ANNUEL -->
      <div class="summary-grid summary-grid-4">
        <!-- CARTE T3 -->
        <div class="summary-card">
          <div class="summary-title">
            <span>T3 (Juil - Sep)</span>
            <span style="font-size:7.5px; color:${(calculs.T3?.resultat || 0) > 0 ? '#15803d' : (calculs.T3?.resultat || 0) < 0 ? '#dc2626' : '#64748b'};">
              ${(calculs.T3?.resultat || 0) > 0 ? 'Bénéfice' : (calculs.T3?.resultat || 0) < 0 ? 'Déficit' : 'Équilibre'}
            </span>
          </div>
          <div class="summary-row">
            <span style="color:#64748b;">Revenus :</span>
            <span style="font-weight:700; color:#15803d;">${fmt(calculs.T3?.revenus || 0)} MAD</span>
          </div>
          <div class="summary-row">
            <span style="color:#64748b;">Charges :</span>
            <span style="font-weight:700; color:#dc2626;">${fmt(calculs.T3?.charges || 0)} MAD</span>
          </div>
          <div class="summary-res">
            <span>Résultat T3 :</span>
            <span class="${(calculs.T3?.resultat || 0) > 0 ? 'text-pos' : (calculs.T3?.resultat || 0) < 0 ? 'text-neg' : 'text-neutral'}">
              ${(calculs.T3?.resultat || 0) > 0 ? '+' : ''}${fmt(calculs.T3?.resultat || 0)} MAD
            </span>
          </div>
        </div>

        <!-- CARTE T4 -->
        <div class="summary-card">
          <div class="summary-title">
            <span>T4 (Oct - Déc)</span>
            <span style="font-size:7.5px; color:${(calculs.T4?.resultat || 0) > 0 ? '#15803d' : (calculs.T4?.resultat || 0) < 0 ? '#dc2626' : '#64748b'};">
              ${(calculs.T4?.resultat || 0) > 0 ? 'Bénéfice' : (calculs.T4?.resultat || 0) < 0 ? 'Déficit' : 'Équilibre'}
            </span>
          </div>
          <div class="summary-row">
            <span style="color:#64748b;">Revenus :</span>
            <span style="font-weight:700; color:#15803d;">${fmt(calculs.T4?.revenus || 0)} MAD</span>
          </div>
          <div class="summary-row">
            <span style="color:#64748b;">Charges :</span>
            <span style="font-weight:700; color:#dc2626;">${fmt(calculs.T4?.charges || 0)} MAD</span>
          </div>
          <div class="summary-res">
            <span>Résultat T4 :</span>
            <span class="${(calculs.T4?.resultat || 0) > 0 ? 'text-pos' : (calculs.T4?.resultat || 0) < 0 ? 'text-neg' : 'text-neutral'}">
              ${(calculs.T4?.resultat || 0) > 0 ? '+' : ''}${fmt(calculs.T4?.resultat || 0)} MAD
            </span>
          </div>
        </div>

        <!-- CARTE TOTAL S2 -->
        <div class="summary-card">
          <div class="summary-title">
            <span>TOTAL S2</span>
            <span style="font-size:7.5px; font-weight:700; color:${resS2 >= 0 ? '#15803d' : '#dc2626'};">
              ${resS2 > 0 ? 'Bénéfice' : resS2 < 0 ? 'Déficit' : 'Équilibre'}
            </span>
          </div>
          <div class="summary-row">
            <span style="color:#64748b;">Revenus :</span>
            <span style="font-weight:700; color:#15803d;">${fmt(revS2)} MAD</span>
          </div>
          <div class="summary-row">
            <span style="color:#64748b;">Charges :</span>
            <span style="font-weight:700; color:#dc2626;">${fmt(chaS2)} MAD</span>
          </div>
          <div class="summary-res">
            <span>Résultat S2 :</span>
            <span class="${resS2 > 0 ? 'text-pos' : resS2 < 0 ? 'text-neg' : 'text-neutral'} font-bold">
              ${resS2 > 0 ? '+' : ''}${fmt(resS2)} MAD
            </span>
          </div>
        </div>

        <!-- CARTE TOTAL ANNUEL (HIGHLIGHT) -->
        <div class="summary-card highlight">
          <div class="summary-title" style="color:#0369a1;">
            <span>TOTAL ANNUEL ${annee}</span>
            <span style="font-size:7.5px; font-weight:800; color:${statusColor};">
              ${statusText}
            </span>
          </div>
          <div class="summary-row">
            <span style="color:#64748b;">Revenus :</span>
            <span style="font-weight:800; color:#15803d;">${fmt(totalRev)} MAD</span>
          </div>
          <div class="summary-row">
            <span style="color:#64748b;">Charges :</span>
            <span style="font-weight:800; color:#dc2626;">${fmt(totalCha)} MAD</span>
          </div>
          <div class="summary-res" style="border-top-color:#0284c7;">
            <span style="color:#0f172a;">Résultat Net :</span>
            <span class="${isBenefice ? 'text-pos' : isDeficit ? 'text-neg' : 'text-neutral'} font-black">
              ${totalRes > 0 ? '+' : ''}${fmt(totalRes)} MAD
            </span>
          </div>
        </div>
      </div>

      <!-- TABLEAU S2 (100% LARGEUR : Rubrique 23%, 6 Mois 6.8% chacun, T3 & T4 8.2% chacun, TOTAL S2 9.8%, TOTAL ANNUEL 10%) -->
      <div class="fin-table-wrapper">
        <table class="fin-table">
          <thead>
            <tr>
              <th style="width: 23%; text-align: left; padding-left: 5px;">Rubrique</th>
              <th style="width: 6.8%;">Juil</th>
              <th style="width: 6.8%;">Août</th>
              <th style="width: 6.8%;">Sep</th>
              <th style="width: 8.2%;" class="cell-trim">T3</th>
              <th style="width: 6.8%;">Oct</th>
              <th style="width: 6.8%;">Nov</th>
              <th style="width: 6.8%;">Déc</th>
              <th style="width: 8.2%;" class="cell-trim">T4</th>
              <th style="width: 9.8%;" class="cell-trim">TOT. S2</th>
              <th style="width: 10%;" class="cell-total">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            <!-- SECTION REVENUS S2 -->
            <tr class="section-header section-rev">
              <td colspan="11">PRODUITS & REVENUS D'EXPLOITATION (S2 & ANNUEL)</td>
            </tr>
            ${renderRowS2('Ventes', 'ventes')}
            ${renderRowS2('Autres revenus', 'autres_revenus')}
            ${renderRowS2('TOTAL REVENUS', '', true, false)}

            <!-- SECTION CHARGES S2 -->
            <tr class="section-header section-cha">
              <td colspan="11">CHARGES D'EXPLOITATION (S2 & ANNUEL)</td>
            </tr>
            ${FIXED_CHARGES_FIELDS.map(f => renderRowS2(f.label, f.key)).join('')}
            ${customCharges.map(c => renderCustomChargeRowS2(c)).join('')}
            ${renderRowS2('TOTAL CHARGES', '', false, true)}

            <!-- SECTION RÉSULTAT S2 -->
            ${renderResultRowS2()}
          </tbody>
        </table>
      </div>

      <!-- RATIOS & SIGNATURES -->
      <div class="footer-grid">
        <!-- INDICATEURS CLÉS -->
        <div class="kpi-box">
          <div class="kpi-title">Indicateurs de Gestion & Rentabilité</div>
          <div class="kpi-row">
            <span style="color:#64748b;">CA Mensuel Moyen :</span>
            <span style="font-weight:700;">${fmt(totalRev / 12)} MAD</span>
          </div>
          <div class="kpi-row">
            <span style="color:#64748b;">Charges Mensuelles Moyennes :</span>
            <span style="font-weight:700;">${fmt(totalCha / 12)} MAD</span>
          </div>
          <div class="kpi-row">
            <span style="color:#64748b;">Marge d'Exploitation :</span>
            <span style="font-weight:800; color:${isBenefice ? '#15803d' : isDeficit ? '#dc2626' : '#64748b'};">${tauxMarge} %</span>
          </div>
          <div class="kpi-row">
            <span style="color:#64748b;">Taux de Couverture :</span>
            <span style="font-weight:700;">${totalCha > 0 ? ((totalRev / totalCha) * 100).toFixed(1) + ' %' : '—'}</span>
          </div>
        </div>

        <!-- VISA DU PORTEUR -->
        <div class="sig-box">
          <div>
            <div class="sig-title">Le Porteur de Projet / Incubé</div>
            <div class="sig-sub" style="font-weight:700; color:#0f172a; margin-top:2px;">${esc(incube?.nom_incube || '')}</div>
            <div class="sig-sub">Mention manuscrite "Lu et approuvé"</div>
          </div>
          ${signatureImage 
            ? '<div style="text-align: center; margin-top: 5px;"><img src="' + signatureImage + '" style="max-height: 35px; max-width: 100%; mix-blend-mode: multiply;" /></div>'
            : '<div class="sig-line">Date et signature</div>'
          }
        </div>

        <!-- SIGNATURE DE L'ACCOMPAGNATEUR -->
        <div class="sig-box">
          <div>
            <div class="sig-title">Pour l'Accompagnateur / Direction IDS</div>
            <div class="sig-sub">Signature & Cachet de l'accompagnateur</div>
          </div>
          <div class="sig-line">Date, cachet et signature</div>
        </div>
      </div>

      <!-- MENTIONS LÉGALES PAGE 2 -->
      <div class="doc-legal">
        Incubateur Digital Solidaire (IDS) · Bilan Financier Annuel · Page 2/2
      </div>
    </div>

  </div>

  ${isPrint ? `
  <script>
    window.addEventListener('load', () => {
      setTimeout(() => {
        window.print();
      }, 500);
    });
  </script>
  ` : ''}
</body>
</html>
    `;

    return html;
  };

  const handleOpenSignature = () => {
    const html = buildFinancialHtml(null, false);
    setDocumentHtml(html);
    setShowSigModal(true);
  };

  const handleExportPDF = (signatureImage = null) => {
    const printWindow = window.open('', '_blank', 'width=1200,height=900');
    if (!printWindow) {
      toast.error("Impossible d'ouvrir la fenêtre d'impression. Veuillez autoriser les pop-ups.");
      return;
    }
    const html = buildFinancialHtml(signatureImage, true);
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <DollarSign size={20} className="text-primary-500" /> Analyse Financière — {annee}
          </h2>
          <div className="flex items-center gap-2.5">
            <select className="input !w-32 bg-white dark:bg-dark-900 font-semibold" value={annee} onChange={e => setAnnee(parseInt(e.target.value))}>
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button
              type="button"
              className="btn btn-secondary flex items-center gap-1.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 font-semibold"
              onClick={() => setShowExcelModal(true)}
            >
              <FileSpreadsheet size={15} className="text-emerald-500" />
              Importer Excel
            </button>
            <button
              type="button"
              className="btn btn-secondary flex items-center gap-1.5 border-primary-500/40 text-primary-700 dark:text-primary-300 hover:bg-primary-500/10 font-bold"
              onClick={handleOpenSignature}
              title="Télécharger l'analyse financière complète en PDF"
            >
              <Printer size={15} className="text-primary-500" />
              Télécharger PDF
            </button>
            <button className="btn btn-primary" onClick={handleSaveAll} disabled={saving}>
              <Save size={16} /> {saving ? 'Sauvegarde...' : 'Enregistrer tout'}
            </button>
          </div>
        </div>

        {/* Résumé trimestriel avec cartes dynamiques */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {['T1', 'T2', 'T3', 'T4', 'TOTAL'].map(t => {
            const resVal = calculs[t]?.resultat || 0;
            const isPos = resVal > 0;
            const isNeg = resVal < 0;

            return (
              <div
                key={t}
                className={`card !p-4 transition-all shadow-sm rounded-2xl border ${t === 'TOTAL'
                    ? isPos
                      ? 'border-emerald-500/50 bg-emerald-500/10 shadow-emerald-500/10'
                      : isNeg
                        ? 'border-rose-500/50 bg-rose-500/10 shadow-rose-500/10'
                        : 'border-primary-500/50 bg-primary-500/10'
                    : isPos
                      ? 'border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-950/20'
                      : isNeg
                        ? 'border-rose-500/40 bg-rose-500/5 dark:bg-rose-950/20'
                        : 'bg-white dark:bg-dark-800/60 border-slate-200 dark:border-dark-700/50'
                  }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-slate-500 dark:text-dark-400 font-extrabold tracking-wider">
                    {t === 'TOTAL' ? 'TOTAL ANNUEL' : t}
                  </p>
                  {isPos && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded-md">
                      <TrendingUp size={11} className="stroke-[2.5]" /> Bénéfice
                    </span>
                  )}
                  {isNeg && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/15 px-1.5 py-0.5 rounded-md animate-pulse">
                      <TrendingDown size={11} className="stroke-[2.5]" /> Déficit
                    </span>
                  )}
                  {!isPos && !isNeg && (
                    <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-dark-700/50 px-1.5 py-0.5 rounded-md">
                      Équilibré
                    </span>
                  )}
                </div>

                <div className="text-xs space-y-1.5">
                  <p className="text-slate-600 dark:text-dark-300 flex justify-between">
                    <span>Revenus :</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">{fmt(calculs[t]?.revenus)} MAD</span>
                  </p>
                  <p className="text-slate-600 dark:text-dark-300 flex justify-between">
                    <span>Charges :</span>
                    <span className="text-rose-600 dark:text-red-400 font-bold">{fmt(calculs[t]?.charges)} MAD</span>
                  </p>
                  <div className="pt-2 border-t border-slate-200 dark:border-dark-600/40 flex justify-between items-center font-bold">
                    <span className="text-slate-800 dark:text-dark-200">Résultat :</span>
                    <div className="flex items-center gap-1">
                      {resBadge(resVal)}
                      <span className="text-[10px] font-bold text-slate-400">MAD</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Tableau mensuel */}
        <div className="card p-0 overflow-hidden border border-slate-200 dark:border-dark-700/60 shadow-md">
          <div className="table-container">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-dark-800 text-slate-700 dark:text-dark-200 border-b border-slate-200 dark:border-dark-700">
                  <th className="sticky left-0 bg-slate-100 dark:bg-dark-800 z-20 font-bold text-slate-800 dark:text-white border-r border-slate-200 dark:border-dark-700 py-3 px-4">Rubrique</th>
                  {[1, 2, 3].map(m => <th key={m} className="text-center font-semibold px-2 py-3">{MOIS_LABELS[m]?.slice(0, 3)}</th>)}
                  <th className="bg-primary-500/15 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300 font-bold text-center border-x border-slate-200 dark:border-dark-700 px-3">T1</th>
                  {[4, 5, 6].map(m => <th key={m} className="text-center font-semibold px-2 py-3">{MOIS_LABELS[m]?.slice(0, 3)}</th>)}
                  <th className="bg-primary-500/15 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300 font-bold text-center border-x border-slate-200 dark:border-dark-700 px-3">T2</th>
                  {[7, 8, 9].map(m => <th key={m} className="text-center font-semibold px-2 py-3">{MOIS_LABELS[m]?.slice(0, 3)}</th>)}
                  <th className="bg-primary-500/15 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300 font-bold text-center border-x border-slate-200 dark:border-dark-700 px-3">T3</th>
                  {[10, 11, 12].map(m => <th key={m} className="text-center font-semibold px-2 py-3">{MOIS_LABELS[m]?.slice(0, 3)}</th>)}
                  <th className="bg-primary-500/15 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300 font-bold text-center border-x border-slate-200 dark:border-dark-700 px-3">T4</th>
                  <th className="bg-primary-500/25 dark:bg-primary-800/40 text-primary-900 dark:text-primary-200 font-extrabold text-center border-l border-slate-200 dark:border-dark-700 px-3">TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {/* REVENUS */}
                <tr className="bg-emerald-500/10 dark:bg-emerald-950/40 border-y border-emerald-500/20">
                  <td colSpan={18} className="font-bold text-emerald-700 dark:text-emerald-400 text-xs py-2 px-4 sticky left-0 bg-emerald-500/10 dark:bg-dark-900 z-10">
                    REVENUS
                  </td>
                </tr>
                {[{ key: 'ventes', label: 'Ventes' }, { key: 'autres_revenus', label: 'Autres revenus' }].map(field => (
                  <tr key={field.key} className="hover:bg-slate-50 dark:hover:bg-dark-700/30 transition-colors border-b border-slate-100 dark:border-dark-700/40">
                    <td className="text-xs font-semibold text-slate-700 dark:text-dark-200 sticky left-0 bg-white dark:bg-dark-800/95 z-10 border-r border-slate-200 dark:border-dark-700 px-4 py-2.5 shadow-sm">
                      {field.label}
                    </td>
                    {[1, 2, 3].map(m => (
                      <td key={m} className="p-1 text-center">
                        <input
                          type="number"
                          className="input !py-1 !px-1.5 !text-xs !w-20 text-center font-medium bg-white dark:bg-dark-900 border-slate-300 dark:border-dark-600 text-slate-800 dark:text-white"
                          value={months[m][field.key] || ''}
                          onChange={e => updateField(m, field.key, e.target.value)}
                        />
                      </td>
                    ))}
                    <td className="text-xs font-bold text-primary-700 dark:text-primary-400 bg-primary-500/5 dark:bg-primary-900/10 text-center border-x border-slate-200 dark:border-dark-700">
                      {fmt([1, 2, 3].reduce((s, m) => s + (months[m][field.key] || 0), 0))}
                    </td>
                    {[4, 5, 6].map(m => (
                      <td key={m} className="p-1 text-center">
                        <input
                          type="number"
                          className="input !py-1 !px-1.5 !text-xs !w-20 text-center font-medium bg-white dark:bg-dark-900 border-slate-300 dark:border-dark-600 text-slate-800 dark:text-white"
                          value={months[m][field.key] || ''}
                          onChange={e => updateField(m, field.key, e.target.value)}
                        />
                      </td>
                    ))}
                    <td className="text-xs font-bold text-primary-700 dark:text-primary-400 bg-primary-500/5 dark:bg-primary-900/10 text-center border-x border-slate-200 dark:border-dark-700">
                      {fmt([4, 5, 6].reduce((s, m) => s + (months[m][field.key] || 0), 0))}
                    </td>
                    {[7, 8, 9].map(m => (
                      <td key={m} className="p-1 text-center">
                        <input
                          type="number"
                          className="input !py-1 !px-1.5 !text-xs !w-20 text-center font-medium bg-white dark:bg-dark-900 border-slate-300 dark:border-dark-600 text-slate-800 dark:text-white"
                          value={months[m][field.key] || ''}
                          onChange={e => updateField(m, field.key, e.target.value)}
                        />
                      </td>
                    ))}
                    <td className="text-xs font-bold text-primary-700 dark:text-primary-400 bg-primary-500/5 dark:bg-primary-900/10 text-center border-x border-slate-200 dark:border-dark-700">
                      {fmt([7, 8, 9].reduce((s, m) => s + (months[m][field.key] || 0), 0))}
                    </td>
                    {[10, 11, 12].map(m => (
                      <td key={m} className="p-1 text-center">
                        <input
                          type="number"
                          className="input !py-1 !px-1.5 !text-xs !w-20 text-center font-medium bg-white dark:bg-dark-900 border-slate-300 dark:border-dark-600 text-slate-800 dark:text-white"
                          value={months[m][field.key] || ''}
                          onChange={e => updateField(m, field.key, e.target.value)}
                        />
                      </td>
                    ))}
                    <td className="text-xs font-bold text-primary-700 dark:text-primary-400 bg-primary-500/5 dark:bg-primary-900/10 text-center border-x border-slate-200 dark:border-dark-700">
                      {fmt([10, 11, 12].reduce((s, m) => s + (months[m][field.key] || 0), 0))}
                    </td>
                    <td className="text-xs font-extrabold text-slate-900 dark:text-white bg-primary-500/15 dark:bg-primary-800/25 text-center border-l border-slate-200 dark:border-dark-700">
                      {fmt(Object.values(months).reduce((s, d) => s + (d[field.key] || 0), 0))}
                    </td>
                  </tr>
                ))}
                <tr className="bg-emerald-500/15 dark:bg-emerald-950/60 border-t-2 border-emerald-500/40">
                  <td className="text-xs font-extrabold text-emerald-800 dark:text-emerald-300 sticky left-0 bg-emerald-50 dark:bg-dark-800 z-10 border-r border-slate-200 dark:border-dark-700 px-4 py-3">
                    TOTAL REVENUS
                  </td>
                  {[1, 2, 3].map(m => <td key={m} className="text-xs font-bold text-emerald-700 dark:text-emerald-400 text-center px-1">{fmt(calculs[m].revenus)}</td>)}
                  <td className="text-xs font-extrabold text-emerald-800 dark:text-emerald-300 bg-primary-500/15 dark:bg-primary-900/20 text-center border-x border-slate-200 dark:border-dark-700">{fmt(calculs.T1.revenus)}</td>
                  {[4, 5, 6].map(m => <td key={m} className="text-xs font-bold text-emerald-700 dark:text-emerald-400 text-center px-1">{fmt(calculs[m].revenus)}</td>)}
                  <td className="text-xs font-extrabold text-emerald-800 dark:text-emerald-300 bg-primary-500/15 dark:bg-primary-900/20 text-center border-x border-slate-200 dark:border-dark-700">{fmt(calculs.T2.revenus)}</td>
                  {[7, 8, 9].map(m => <td key={m} className="text-xs font-bold text-emerald-700 dark:text-emerald-400 text-center px-1">{fmt(calculs[m].revenus)}</td>)}
                  <td className="text-xs font-extrabold text-emerald-800 dark:text-emerald-300 bg-primary-500/15 dark:bg-primary-900/20 text-center border-x border-slate-200 dark:border-dark-700">{fmt(calculs.T3.revenus)}</td>
                  {[10, 11, 12].map(m => <td key={m} className="text-xs font-bold text-emerald-700 dark:text-emerald-400 text-center px-1">{fmt(calculs[m].revenus)}</td>)}
                  <td className="text-xs font-extrabold text-emerald-800 dark:text-emerald-300 bg-primary-500/15 dark:bg-primary-900/20 text-center border-x border-slate-200 dark:border-dark-700">{fmt(calculs.T4.revenus)}</td>
                  <td className="text-xs font-black text-emerald-900 dark:text-emerald-200 bg-primary-500/25 dark:bg-primary-800/40 text-center border-l border-slate-200 dark:border-dark-700">{fmt(calculs.TOTAL.revenus)}</td>
                </tr>

                {/* CHARGES */}
                <tr className="bg-rose-500/10 dark:bg-red-950/40 border-y border-rose-500/20">
                  <td colSpan={18} className="font-bold text-rose-700 dark:text-red-400 text-xs py-2 px-4 sticky left-0 bg-rose-500/10 dark:bg-dark-900 z-10">
                    CHARGES
                  </td>
                </tr>
                {/* CHARGES FIXES */}
                {FIXED_CHARGES_FIELDS.map(field => (
                  <tr key={field.key} className="hover:bg-slate-50 dark:hover:bg-dark-700/30 transition-colors border-b border-slate-100 dark:border-dark-700/40">
                    <td className="text-xs font-semibold text-slate-700 dark:text-dark-200 sticky left-0 bg-white dark:bg-dark-800/95 z-10 border-r border-slate-200 dark:border-dark-700 px-4 py-2.5 shadow-sm">
                      {field.label}
                    </td>
                    {[1, 2, 3].map(m => (
                      <td key={m} className="p-1 text-center">
                        <input
                          type="number"
                          className="input !py-1 !px-1.5 !text-xs !w-20 text-center font-medium bg-white dark:bg-dark-900 border-slate-300 dark:border-dark-600 text-slate-800 dark:text-white"
                          value={months[m][field.key] || ''}
                          onChange={e => updateField(m, field.key, e.target.value)}
                        />
                      </td>
                    ))}
                    <td className="text-xs font-bold text-primary-700 dark:text-primary-400 bg-primary-500/5 dark:bg-primary-900/10 text-center border-x border-slate-200 dark:border-dark-700">
                      {fmt([1, 2, 3].reduce((s, m) => s + (months[m][field.key] || 0), 0))}
                    </td>
                    {[4, 5, 6].map(m => (
                      <td key={m} className="p-1 text-center">
                        <input
                          type="number"
                          className="input !py-1 !px-1.5 !text-xs !w-20 text-center font-medium bg-white dark:bg-dark-900 border-slate-300 dark:border-dark-600 text-slate-800 dark:text-white"
                          value={months[m][field.key] || ''}
                          onChange={e => updateField(m, field.key, e.target.value)}
                        />
                      </td>
                    ))}
                    <td className="text-xs font-bold text-primary-700 dark:text-primary-400 bg-primary-500/5 dark:bg-primary-900/10 text-center border-x border-slate-200 dark:border-dark-700">
                      {fmt([4, 5, 6].reduce((s, m) => s + (months[m][field.key] || 0), 0))}
                    </td>
                    {[7, 8, 9].map(m => (
                      <td key={m} className="p-1 text-center">
                        <input
                          type="number"
                          className="input !py-1 !px-1.5 !text-xs !w-20 text-center font-medium bg-white dark:bg-dark-900 border-slate-300 dark:border-dark-600 text-slate-800 dark:text-white"
                          value={months[m][field.key] || ''}
                          onChange={e => updateField(m, field.key, e.target.value)}
                        />
                      </td>
                    ))}
                    <td className="text-xs font-bold text-primary-700 dark:text-primary-400 bg-primary-500/5 dark:bg-primary-900/10 text-center border-x border-slate-200 dark:border-dark-700">
                      {fmt([7, 8, 9].reduce((s, m) => s + (months[m][field.key] || 0), 0))}
                    </td>
                    {[10, 11, 12].map(m => (
                      <td key={m} className="p-1 text-center">
                        <input
                          type="number"
                          className="input !py-1 !px-1.5 !text-xs !w-20 text-center font-medium bg-white dark:bg-dark-900 border-slate-300 dark:border-dark-600 text-slate-800 dark:text-white"
                          value={months[m][field.key] || ''}
                          onChange={e => updateField(m, field.key, e.target.value)}
                        />
                      </td>
                    ))}
                    <td className="text-xs font-bold text-primary-700 dark:text-primary-400 bg-primary-500/5 dark:bg-primary-900/10 text-center border-x border-slate-200 dark:border-dark-700">
                      {fmt([10, 11, 12].reduce((s, m) => s + (months[m][field.key] || 0), 0))}
                    </td>
                    <td className="text-xs font-extrabold text-slate-900 dark:text-white bg-primary-500/15 dark:bg-primary-800/25 text-center border-l border-slate-200 dark:border-dark-700">
                      {fmt(Object.values(months).reduce((s, d) => s + (d[field.key] || 0), 0))}
                    </td>
                  </tr>
                ))}

                {/* CHARGES SPÉCIFIÉES / AUTRES CHARGES */}
                {customCharges.map((charge) => {
                  const t1Sum = (charge.valeurs[1] || 0) + (charge.valeurs[2] || 0) + (charge.valeurs[3] || 0);
                  const t2Sum = (charge.valeurs[4] || 0) + (charge.valeurs[5] || 0) + (charge.valeurs[6] || 0);
                  const t3Sum = (charge.valeurs[7] || 0) + (charge.valeurs[8] || 0) + (charge.valeurs[9] || 0);
                  const t4Sum = (charge.valeurs[10] || 0) + (charge.valeurs[11] || 0) + (charge.valeurs[12] || 0);
                  const totalSum = t1Sum + t2Sum + t3Sum + t4Sum;

                  return (
                    <tr key={charge.id} className="bg-amber-50/20 dark:bg-amber-950/10 hover:bg-amber-50/40 dark:hover:bg-dark-700/40 transition-colors border-b border-slate-100 dark:border-dark-700/40">
                      <td className="sticky left-0 bg-white dark:bg-dark-800/95 z-10 border-r border-slate-200 dark:border-dark-700 px-3 py-2 shadow-sm">
                        <div className="flex items-center gap-1.5 min-w-[210px]">
                          <Tag size={13} className="text-amber-500 flex-shrink-0" />
                          <input
                            type="text"
                            list="charges-suggestions-list"
                            className="input !py-1 !px-2 !text-xs font-semibold bg-slate-50 dark:bg-dark-900 border border-slate-300 dark:border-dark-600 rounded-lg text-slate-800 dark:text-white flex-1 focus:ring-1 focus:ring-primary-500 shadow-none placeholder:text-slate-400 placeholder:font-normal"
                            value={charge.nom}
                            placeholder="Type de charge (ex: Assurances...)"
                            onChange={e => handleCustomChargeNomChange(charge.id, e.target.value)}
                          />
                          {customCharges.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveCustomCharge(charge.id)}
                              title="Supprimer cette ligne"
                              className="text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors flex-shrink-0"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                      {[1, 2, 3].map(m => (
                        <td key={m} className="p-1 text-center">
                          <input
                            type="number"
                            className="input !py-1 !px-1.5 !text-xs !w-20 text-center font-medium bg-white dark:bg-dark-900 border-slate-300 dark:border-dark-600 text-slate-800 dark:text-white"
                            value={charge.valeurs[m] || ''}
                            onChange={e => handleCustomChargeValueChange(charge.id, m, e.target.value)}
                          />
                        </td>
                      ))}
                      <td className="text-xs font-bold text-primary-700 dark:text-primary-400 bg-primary-500/5 dark:bg-primary-900/10 text-center border-x border-slate-200 dark:border-dark-700">
                        {fmt(t1Sum)}
                      </td>
                      {[4, 5, 6].map(m => (
                        <td key={m} className="p-1 text-center">
                          <input
                            type="number"
                            className="input !py-1 !px-1.5 !text-xs !w-20 text-center font-medium bg-white dark:bg-dark-900 border-slate-300 dark:border-dark-600 text-slate-800 dark:text-white"
                            value={charge.valeurs[m] || ''}
                            onChange={e => handleCustomChargeValueChange(charge.id, m, e.target.value)}
                          />
                        </td>
                      ))}
                      <td className="text-xs font-bold text-primary-700 dark:text-primary-400 bg-primary-500/5 dark:bg-primary-900/10 text-center border-x border-slate-200 dark:border-dark-700">
                        {fmt(t2Sum)}
                      </td>
                      {[7, 8, 9].map(m => (
                        <td key={m} className="p-1 text-center">
                          <input
                            type="number"
                            className="input !py-1 !px-1.5 !text-xs !w-20 text-center font-medium bg-white dark:bg-dark-900 border-slate-300 dark:border-dark-600 text-slate-800 dark:text-white"
                            value={charge.valeurs[m] || ''}
                            onChange={e => handleCustomChargeValueChange(charge.id, m, e.target.value)}
                          />
                        </td>
                      ))}
                      <td className="text-xs font-bold text-primary-700 dark:text-primary-400 bg-primary-500/5 dark:bg-primary-900/10 text-center border-x border-slate-200 dark:border-dark-700">
                        {fmt(t3Sum)}
                      </td>
                      {[10, 11, 12].map(m => (
                        <td key={m} className="p-1 text-center">
                          <input
                            type="number"
                            className="input !py-1 !px-1.5 !text-xs !w-20 text-center font-medium bg-white dark:bg-dark-900 border-slate-300 dark:border-dark-600 text-slate-800 dark:text-white"
                            value={charge.valeurs[m] || ''}
                            onChange={e => handleCustomChargeValueChange(charge.id, m, e.target.value)}
                          />
                        </td>
                      ))}
                      <td className="text-xs font-bold text-primary-700 dark:text-primary-400 bg-primary-500/5 dark:bg-primary-900/10 text-center border-x border-slate-200 dark:border-dark-700">
                        {fmt(t4Sum)}
                      </td>
                      <td className="text-xs font-extrabold text-slate-900 dark:text-white bg-primary-500/15 dark:bg-primary-800/25 text-center border-l border-slate-200 dark:border-dark-700">
                        {fmt(totalSum)}
                      </td>
                    </tr>
                  );
                })}

                {/* BOUTON AJOUTER UNE CHARGE */}
                <tr className="bg-slate-50/70 dark:bg-dark-900/40 border-b border-slate-200 dark:border-dark-700/60">
                  <td colSpan={18} className="py-2.5 px-4 sticky left-0 z-10 bg-slate-50/90 dark:bg-dark-900/90 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleAddCustomCharge}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-600 dark:text-primary-400 hover:text-primary-700 hover:bg-primary-500/10 px-3 py-1.5 rounded-lg border border-dashed border-primary-400/70 dark:border-primary-500/50 transition-all active:scale-95 shadow-sm"
                      >
                        <Plus size={14} className="stroke-[2.5]" />
                        <span>+ Spécifier une autre charge</span>
                      </button>
                      <span className="text-[11px] text-slate-500 dark:text-dark-400 italic">
                        (Précisez le type : Assurances, Frais bancaires, Marketing, Fournitures...)
                      </span>
                    </div>
                  </td>
                </tr>
                <tr className="bg-rose-500/15 dark:bg-red-950/60 border-t-2 border-rose-500/40">
                  <td className="text-xs font-extrabold text-rose-800 dark:text-red-300 sticky left-0 bg-rose-50 dark:bg-dark-800 z-10 border-r border-slate-200 dark:border-dark-700 px-4 py-3">
                    TOTAL CHARGES
                  </td>
                  {[1, 2, 3].map(m => <td key={m} className="text-xs font-bold text-rose-700 dark:text-red-400 text-center px-1">{fmt(calculs[m].charges)}</td>)}
                  <td className="text-xs font-extrabold text-rose-800 dark:text-red-300 bg-primary-500/15 dark:bg-primary-900/20 text-center border-x border-slate-200 dark:border-dark-700">{fmt(calculs.T1.charges)}</td>
                  {[4, 5, 6].map(m => <td key={m} className="text-xs font-bold text-rose-700 dark:text-red-400 text-center px-1">{fmt(calculs[m].charges)}</td>)}
                  <td className="text-xs font-extrabold text-rose-800 dark:text-red-300 bg-primary-500/15 dark:bg-primary-900/20 text-center border-x border-slate-200 dark:border-dark-700">{fmt(calculs.T2.charges)}</td>
                  {[7, 8, 9].map(m => <td key={m} className="text-xs font-bold text-rose-700 dark:text-red-400 text-center px-1">{fmt(calculs[m].charges)}</td>)}
                  <td className="text-xs font-extrabold text-rose-800 dark:text-red-300 bg-primary-500/15 dark:bg-primary-900/20 text-center border-x border-slate-200 dark:border-dark-700">{fmt(calculs.T3.charges)}</td>
                  {[10, 11, 12].map(m => <td key={m} className="text-xs font-bold text-rose-700 dark:text-red-400 text-center px-1">{fmt(calculs[m].charges)}</td>)}
                  <td className="text-xs font-extrabold text-rose-800 dark:text-red-300 bg-primary-500/15 dark:bg-primary-900/20 text-center border-x border-slate-200 dark:border-dark-700">{fmt(calculs.T4.charges)}</td>
                  <td className="text-xs font-black text-rose-900 dark:text-red-200 bg-primary-500/25 dark:bg-primary-800/40 text-center border-l border-slate-200 dark:border-dark-700">{fmt(calculs.TOTAL.charges)}</td>
                </tr>

                {/* RESULTAT */}
                <tr className="bg-primary-500/15 dark:bg-primary-900/30 border-t-4 border-primary-500/60 shadow-sm">
                  <td className="text-sm font-black text-slate-900 dark:text-white sticky left-0 bg-amber-50 dark:bg-dark-800 z-10 py-3.5 px-4 border-r border-slate-200 dark:border-dark-700">
                    RÉSULTAT
                  </td>
                  {[1, 2, 3].map(m => <td key={m} className="text-center font-bold px-1">{resBadge(calculs[m].resultat)}</td>)}
                  <td className="text-center bg-primary-500/20 dark:bg-primary-900/40 font-extrabold border-x border-slate-200 dark:border-dark-700">{resBadge(calculs.T1.resultat)}</td>
                  {[4, 5, 6].map(m => <td key={m} className="text-center font-bold px-1">{resBadge(calculs[m].resultat)}</td>)}
                  <td className="text-center bg-primary-500/20 dark:bg-primary-900/40 font-extrabold border-x border-slate-200 dark:border-dark-700">{resBadge(calculs.T2.resultat)}</td>
                  {[7, 8, 9].map(m => <td key={m} className="text-center font-bold px-1">{resBadge(calculs[m].resultat)}</td>)}
                  <td className="text-center bg-primary-500/20 dark:bg-primary-900/40 font-extrabold border-x border-slate-200 dark:border-dark-700">{resBadge(calculs.T3.resultat)}</td>
                  {[10, 11, 12].map(m => <td key={m} className="text-center font-bold px-1">{resBadge(calculs[m].resultat)}</td>)}
                  <td className="text-center bg-primary-500/20 dark:bg-primary-900/40 font-extrabold border-x border-slate-200 dark:border-dark-700">{resBadge(calculs.T4.resultat)}</td>
                  <td className="text-center bg-primary-500/30 dark:bg-primary-800/50 font-black border-l border-slate-200 dark:border-dark-700">{resBadge(calculs.TOTAL.resultat)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Liste de suggestions de types de charges */}
        <datalist id="charges-suggestions-list">
          {TYPES_CHARGES_SUGGESTIONS.map((s, idx) => (
            <option key={idx} value={s} />
          ))}
        </datalist>

        {/* Modale d'importation des données financières */}
        <ExcelImportModal
          isOpen={showExcelModal}
          onClose={() => setShowExcelModal(false)}
          title="Importer les données financières (Excel)"
          description="Chargez un fichier Excel pour remplir les 12 mois de ventes, achats et charges."
          templateType="financier"
          onImport={handleImportFinances}
        />

        <SignatureModal
          isOpen={showSigModal}
          onClose={() => {
            setShowSigModal(false);
            setDocumentHtml(null);
          }}
          onValidate={handleExportPDF}
          title="Signature de l'Analyse Financière"
          documentHtml={documentHtml}
        />
      </div>
    );
  }
