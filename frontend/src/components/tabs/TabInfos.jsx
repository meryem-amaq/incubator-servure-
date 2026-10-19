import { useState, useEffect } from 'react';
import { Save, UserCheck, ShieldAlert, ArrowRightLeft, Camera, Upload, X, FileSpreadsheet, GraduationCap, Plus, Eye } from 'lucide-react';
import api, { getPhotoUrl } from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import ExcelImportModal from '../common/ExcelImportModal';
import { SECTEURS_ACTIVITE, NIVEAUX_ETUDE_OPTIONS, NIVEAUX_ETUDE, normalizeNiveauEtude } from '../../data/constants';
import toast from 'react-hot-toast';

const PHASE_OPTS = ['Idéation', 'Lancement', 'Croissance', 'Maturité'];
const STATUT_OPTS = ['Auto-entrepreneur', 'SARL', 'SARL AU', 'Autre'];
const SITUATION_OPTS = ['Célibataire', 'Marié(e)', 'Divorcé(e)', 'Veuf(ve)'];

const calculateAge = (dob) => {
  if (!dob) return '';
  const birthDate = new Date(dob);
  const today = new Date();
  
  let years = today.getFullYear() - birthDate.getFullYear();
  let months = today.getMonth() - birthDate.getMonth();
  let days = today.getDate() - birthDate.getDate();

  if (days < 0) {
    months--;
    const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    days += prevMonth.getDate();
  }
  
  if (months < 0) {
    years--;
    months += 12;
  }
  
  let result = [];
  if (years > 0) result.push(`${years} an${years > 1 ? 's' : ''}`);
  if (months > 0) result.push(`${months} mois`);
  if (days > 0) result.push(`${days} jour${days > 1 ? 's' : ''}`);
  
  return result.join(', ') || '0 jour';
};

const parseAssocies = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }
  return [];
};

export default function TabInfos({ incube, onUpdate }) {
  const { isSuperAdmin } = useAuth();
  const [form, setForm] = useState(() => {
    const initial = { ...incube };
    if (initial.date_naissance) {
      initial.age = calculateAge(initial.date_naissance);
    }
    initial.associes = parseAssocies(initial.associes);
    return initial;
  });
  const [saving, setSaving] = useState(false);
  const [admins, setAdmins] = useState([]);
  const [selectedAdminId, setSelectedAdminId] = useState(incube.admin_id || '');
  const [reassigning, setReassigning] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [enlargedPhoto, setEnlargedPhoto] = useState(null);
  const [showExcelModal, setShowExcelModal] = useState(false);

  // Gestion des promotions
  const [promotions, setPromotions] = useState([]);
  const [showAddPromo, setShowAddPromo] = useState(false);
  const [newPromoName, setNewPromoName] = useState('');
  const [creatingPromo, setCreatingPromo] = useState(false);
  const [isCustomSecteur, setIsCustomSecteur] = useState(false);
  const [isCustomEtude, setIsCustomEtude] = useState(false);

  const loadPromotions = async () => {
    try {
      const res = await api.get('/promotions');
      if (Array.isArray(res.data) && res.data.length > 0) {
        setPromotions(res.data);
      } else {
        setPromotions([{ id: 1, nom: 'Promotion 1' }, { id: 2, nom: 'Promotion 2' }]);
      }
    } catch (err) {
      setPromotions([{ id: 1, nom: 'Promotion 1' }, { id: 2, nom: 'Promotion 2' }]);
    }
  };

  useEffect(() => {
    loadPromotions();
  }, []);

  const handleAddPromotion = async (e) => {
    if (e) e.preventDefault();
    const clean = newPromoName.trim();
    if (!clean) {
      toast.error('Veuillez renseigner le nom de la promotion');
      return;
    }
    setCreatingPromo(true);
    try {
      const res = await api.post('/promotions', { nom: clean });
      const added = res.data;
      setPromotions(prev => {
        if (prev.some(p => p.nom.toLowerCase() === added.nom.toLowerCase())) return prev;
        return [...prev, added];
      });
      setForm(prev => ({ ...prev, promotion: added.nom }));
      setNewPromoName('');
      setShowAddPromo(false);
      toast.success(`Promotion "${added.nom}" ajoutée et sélectionnée !`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de l'ajout de la promotion");
    } finally {
      setCreatingPromo(false);
    }
  };

  const handleImportExcel = (row) => {
    if (!row) return;
    setForm(prev => ({
      ...prev,
      nom_incube: row.nom_incube || prev.nom_incube,
      email: row.email || row.mail || prev.email,
      telephone: row.telephone || row.tel || prev.telephone,
      raison_sociale: row.raison_sociale || prev.raison_sociale,
      rc: row.rc || row.registre_commerce || prev.rc,
      phase_projet: row.phase_projet || prev.phase_projet,
      statut_juridique: row.statut_juridique || prev.statut_juridique,
      pp_numero: row.pp_numero || prev.pp_numero,
      situation_familiale: row.situation_familiale || prev.situation_familiale,
      accompagnateur: row.accompagnateur || prev.accompagnateur,
      date_demarrage: row.date_demarrage || prev.date_demarrage,
      province: row.province || prev.province,
      ville: row.ville || prev.ville,
      genre: row.genre || prev.genre,
      secteur_activite: row.secteur_activite || prev.secteur_activite,
      promotion: row.promotion || row.promo || prev.promotion,
      age: row.date_naissance ? calculateAge(row.date_naissance) : (row.age || prev.age),
      date_naissance: row.date_naissance || prev.date_naissance,
    }));
    toast.success('Champs mis à jour depuis le fichier Excel ! Cliquez sur Enregistrer.');
  };

  useEffect(() => {
    const initialForm = { ...incube };
    if (initialForm.date_naissance) {
      initialForm.age = calculateAge(initialForm.date_naissance);
    }
    initialForm.associes = parseAssocies(initialForm.associes);
    setForm(initialForm);
    setIsCustomSecteur(Boolean(initialForm.secteur_activite && !SECTEURS_ACTIVITE.includes(initialForm.secteur_activite)));
    setSelectedAdminId(incube.admin_id || '');
    setPhotoFile(null);
    setPhotoPreview(null);
  }, [incube]);

  useEffect(() => {
    if (isSuperAdmin) {
      api.get('/users/admins')
        .then((res) => setAdmins(res.data))
        .catch(() => {});
    }
  }, [isSuperAdmin]);

  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleAddAssocie = () => {
    setForm(prev => {
      const current = parseAssocies(prev?.associes);
      return {
        ...prev,
        associes: [...current, { nom: '', cin: '', fonction: '', tel: '' }]
      };
    });
  };

  const handleRemoveAssocie = (index) => {
    setForm(prev => {
      const current = parseAssocies(prev?.associes);
      const newAssocies = [...current];
      newAssocies.splice(index, 1);
      return { ...prev, associes: newAssocies };
    });
  };

  const handleAssocieChange = (index, field, value) => {
    setForm(prev => {
      const current = parseAssocies(prev?.associes);
      const newAssocies = [...current];
      newAssocies[index] = { ...newAssocies[index], [field]: value };
      return { ...prev, associes: newAssocies };
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const formData = new FormData();
      Object.keys(form).forEach(key => {
        if (key !== 'materiels' && key !== 'engagements' && key !== 'emplois' && key !== 'personnel' && key !== 'plans' && key !== 'finances' && key !== 'accompagnateurAdmin' && key !== 'photo_path') {
          if (form[key] !== undefined && form[key] !== null) {
            if (key === 'associes') {
              formData.append(key, JSON.stringify(form[key]));
            } else {
              formData.append(key, form[key]);
            }
          }
        }
      });
      if (photoFile) {
        formData.append('photo', photoFile);
      } else if (form.photo_path === '') {
        formData.append('photo_path', '');
      } else if (form.photo_path && form.photo_path !== incube.photo_path) {
        formData.append('photo_path', form.photo_path);
      }

      const token = localStorage.getItem('cgs_token');
      const res = await fetch(import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/incubes/${incube.id}` : `/api/incubes/${incube.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || 'Erreur lors de la mise à jour');
      }

      toast.success('Informations enregistrées avec succès !');
      setPhotoFile(null);
      setPhotoPreview(null);
      onUpdate();
    } catch (err) {
      toast.error(err.message || 'Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  const handleReassign = async () => {
    if (!selectedAdminId) {
      toast.error('Veuillez sélectionner un accompagnateur');
      return;
    }
    setReassigning(true);
    try {
      const res = await api.put(`/incubes/${incube.id}/assigner`, {
        admin_id: selectedAdminId,
      });
      toast.success(res.data.message || 'Dossier transféré avec succès');
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur lors du transfert du dossier');
    } finally {
      setReassigning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Box de réassignation conditionnelle (Super Admin uniquement) */}
      {isSuperAdmin && (
        <div className="card p-5 border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-slate-50 dark:from-amber-500/5 dark:via-dark-800/80 dark:to-dark-900/90 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 dark:text-amber-400 shrink-0 mt-0.5">
                <ArrowRightLeft size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  Changer d'accompagnateur / Transférer le dossier
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                    Super Admin
                  </span>
                </h3>
                <p className="text-xs text-slate-600 dark:text-dark-300 mt-0.5">
                  Accompagnateur actuel :{' '}
                  <strong className="text-slate-900 dark:text-white">
                    {incube.accompagnateurAdmin
                      ? `${incube.accompagnateurAdmin.prenom} ${incube.accompagnateurAdmin.nom}`
                      : incube.accompagnateur || 'Non assigné'}
                  </strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 sm:self-center w-full sm:w-auto">
              <select
                value={selectedAdminId}
                onChange={(e) => setSelectedAdminId(e.target.value)}
                className="input text-xs py-2 w-full sm:w-64 bg-white dark:bg-dark-900 border-amber-500/30 text-slate-800 dark:text-white focus:border-amber-400"
              >
                <option value="">— Choisir un nouvel accompagnateur —</option>
                {admins.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.prenom} {a.nom} ({a.role === 'super_admin' ? 'Super Admin' : 'Admin'})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleReassign}
                disabled={reassigning || String(selectedAdminId) === String(incube.admin_id)}
                className="btn btn-primary text-xs py-2 px-3 shrink-0 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed bg-amber-500 hover:bg-amber-400 border-amber-400"
              >
                <UserCheck size={14} />
                {reassigning ? 'Transfert...' : 'Transférer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Formulaire classique */}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Informations Générales</h2>
            <button
              type="button"
              onClick={() => setShowExcelModal(true)}
              className="btn btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 font-semibold self-start sm:self-auto"
            >
              <FileSpreadsheet size={15} className="text-emerald-500" />
              Remplir les champs depuis Excel
            </button>
          </div>

          {/* Photo de l'incubé */}
          <div className="space-y-3 mb-6 p-4 rounded-2xl bg-slate-50 dark:bg-dark-800/60 border border-slate-200 dark:border-dark-700/60">
            <div className="flex items-center gap-4">
              <div className="relative group shrink-0">
                {photoPreview ? (
                  <img 
                    src={photoPreview} 
                    alt="Aperçu" 
                    className="w-16 h-16 rounded-xl object-cover border-2 border-primary-500 shadow-md"
                  />
                ) : form.photo_path ? (
                  <img 
                    src={getPhotoUrl(form.photo_path)} 
                    alt={incube.nom_incube} 
                    className="w-16 h-16 rounded-xl object-cover border-2 border-primary-500/40 shadow-md"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-slate-200 dark:bg-dark-700 border-2 border-dashed border-slate-300 dark:border-dark-600 flex flex-col items-center justify-center text-slate-400 dark:text-dark-400">
                    <Camera size={22} />
                    <span className="text-[9px] mt-1 font-semibold">Photo</span>
                  </div>
                )}
                {(photoPreview || form.photo_path) && (
                  <button 
                    type="button"
                    onClick={() => setEnlargedPhoto(photoPreview || getPhotoUrl(form.photo_path))}
                    className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    title="Agrandir la photo"
                  >
                    <Eye size={18} className="text-white" />
                  </button>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-800 dark:text-white">Photo du porteur / incubé</p>
                <p className="text-[11px] text-slate-500 dark:text-dark-400 mt-0.5">Importer un fichier image (JPG, PNG, WebP)</p>
                <label className="inline-flex items-center gap-1.5 mt-1.5 px-3 py-1 rounded-lg bg-primary-500/15 hover:bg-primary-500/25 text-primary-600 dark:text-primary-400 text-xs font-semibold cursor-pointer transition-colors">
                  <Upload size={12} />
                  {photoPreview || form.photo_path ? 'Changer la photo' : 'Importer une photo'}
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setPhotoFile(file);
                        setPhotoPreview(URL.createObjectURL(file));
                      }
                    }} 
                  />
                </label>
              </div>

              {(photoPreview || photoFile || form.photo_path) && (
                <button 
                  type="button" 
                  onClick={() => { setPhotoFile(null); setPhotoPreview(null); setForm({ ...form, photo_path: '' }); }}
                  className="p-1.5 rounded-lg text-dark-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Supprimer ou réinitialiser la photo"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Nom de l'incubé *</label>
              <input
                className="input"
                value={form.nom_incube || ''}
                onChange={f('nom_incube')}
                required
              />
            </div>
            <div>
              <label className="label">N° Porteur de Projet</label>
              <input
                className="input"
                value={form.pp_numero || ''}
                onChange={f('pp_numero')}
              />
            </div>
            <div>
              <label className="label">📧 Adresse Email (pour convocations & RDV)</label>
              <input
                type="email"
                className="input"
                placeholder="Ex: porteur@gmail.com"
                value={form.email || ''}
                onChange={f('email')}
              />
            </div>
            <div>
              <label className="label">📞 N° Téléphone</label>
              <input
                type="tel"
                className="input"
                placeholder="Ex: 06 12 34 56 78"
                value={form.telephone || ''}
                onChange={f('telephone')}
              />
            </div>
            <div>
              <label className="label">Raison sociale</label>
              <input
                className="input"
                value={form.raison_sociale || ''}
                onChange={f('raison_sociale')}
              />
            </div>
            <div>
              <label className="label">Registre du Commerce (RC)</label>
              <input
                className="input"
                placeholder="Ex: 123456"
                value={form.rc || ''}
                onChange={f('rc')}
              />
            </div>
            <div>
              <label className="label">Situation familiale</label>
              <select
                className="input"
                value={form.situation_familiale || ''}
                onChange={f('situation_familiale')}
              >
                <option value="">— Sélectionner —</option>
                {SITUATION_OPTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            {/* Promotion */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label !mb-0 flex items-center gap-1.5">
                  <GraduationCap size={15} className="text-primary-500" />
                  Promotion
                </label>
                <button
                  type="button"
                  onClick={() => setShowAddPromo(!showAddPromo)}
                  className="text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1 font-semibold"
                  title="Ajouter une nouvelle promotion (ex: Promotion 3...)"
                >
                  <Plus size={12} />
                  {showAddPromo ? 'Fermer' : 'Nouvelle promo'}
                </button>
              </div>

              {showAddPromo && (
                <div className="flex items-center gap-2 p-2 rounded-xl bg-primary-500/10 border border-primary-500/30 mb-2">
                  <input
                    type="text"
                    className="input text-xs !py-1.5 flex-1 bg-white dark:bg-dark-900"
                    placeholder="Ex: Promotion 3..."
                    value={newPromoName}
                    onChange={(e) => setNewPromoName(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddPromotion();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddPromotion}
                    disabled={creatingPromo || !newPromoName.trim()}
                    className="btn btn-primary text-xs !py-1.5 !px-3 shrink-0"
                  >
                    {creatingPromo ? 'Ajout...' : 'Ajouter'}
                  </button>
                </div>
              )}

              <select
                className="input"
                value={form.promotion || ''}
                onChange={f('promotion')}
              >
                <option value="">— Sélectionner une promotion —</option>
                {promotions.map((p) => (
                  <option key={p.id || p.nom} value={p.nom}>
                    {p.nom}
                  </option>
                ))}
                {form.promotion && !promotions.some(p => p.nom === form.promotion) && (
                  <option value={form.promotion}>{form.promotion}</option>
                )}
              </select>
            </div>

            {/* Phase du projet (État d'avancement) */}
            <div className="relative">
              <label className="label">Phase du projet</label>
              <select
                className="input"
                value={form.phase_projet || ''}
                onChange={f('phase_projet')}
              >
                {PHASE_OPTS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              {/* Historique des phases */}
              {incube.historique_phases && incube.historique_phases.length > 0 && (
                <div className="mt-3 p-3 bg-slate-50 dark:bg-dark-800/80 rounded-lg border border-slate-200 dark:border-dark-700/60 max-h-32 overflow-y-auto custom-scrollbar">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Historique des phases</h4>
                  <div className="space-y-2">
                    {incube.historique_phases.map((log, i) => (
                      <div key={log.id || i} className="flex flex-col gap-0.5 relative pl-3 border-l-2 border-primary-400/50">
                        <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-primary-500"></div>
                        <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                          Passage à <span className="text-primary-600 dark:text-primary-400">"{log.nouvelle_phase}"</span>
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-dark-400">
                          Le {new Date(log.date_changement).toLocaleDateString('fr-FR')} 
                          {log.ancienne_phase && ` (depuis "${log.ancienne_phase}")`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Statut juridique */}
            <div>
              <label className="label">Statut juridique</label>
              <select
                className="input"
                value={STATUT_OPTS.includes(form.statut_juridique) ? form.statut_juridique : (form.statut_juridique ? 'Autre' : '')}
                onChange={(e) => {
                  if (e.target.value === 'Autre') {
                    setForm(prev => ({ ...prev, statut_juridique: '' }));
                  } else {
                    setForm(prev => ({ ...prev, statut_juridique: e.target.value }));
                  }
                }}
              >
                <option value="" disabled>-- Sélectionner --</option>
                {STATUT_OPTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {(!STATUT_OPTS.includes(form.statut_juridique) && form.statut_juridique !== undefined) || form.statut_juridique === 'Autre' ? (
                <input
                  type="text"
                  className="input mt-2"
                  placeholder="Spécifiez le statut juridique"
                  value={STATUT_OPTS.includes(form.statut_juridique) ? '' : form.statut_juridique}
                  onChange={f('statut_juridique')}
                  autoFocus
                />
              ) : null}

              {/* Historique des statuts juridiques */}
              {incube.historique_statuts && incube.historique_statuts.length > 0 && (
                <div className="mt-3 p-3 bg-slate-50 dark:bg-dark-800/80 rounded-lg border border-slate-200 dark:border-dark-700/60 max-h-32 overflow-y-auto custom-scrollbar">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Historique des statuts juridiques</h4>
                  <div className="space-y-2">
                    {incube.historique_statuts.map((log, i) => (
                      <div key={log.id || i} className="flex flex-col gap-0.5 relative pl-3 border-l-2 border-primary-400/50">
                        <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-primary-500"></div>
                        <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                          Passage à <span className="text-primary-600 dark:text-primary-400">"{log.nouveau_statut}"</span>
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-dark-400">
                          Le {new Date(log.date_changement).toLocaleDateString('fr-FR')} 
                          {log.ancien_statut && ` (depuis "${log.ancien_statut}")`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="label">Accompagnateur référent</label>
              <input
                className="input"
                value={form.accompagnateur || ''}
                onChange={f('accompagnateur')}
                disabled={!isSuperAdmin}
              />
            </div>
            <div>
              <label className="label">Date de démarrage</label>
              <input
                type="date"
                className="input"
                value={form.date_demarrage || ''}
                onChange={f('date_demarrage')}
              />
            </div>
            <div>
              <label className="label">Province</label>
              <input
                className="input"
                value={form.province || ''}
                onChange={f('province')}
              />
            </div>
            <div>
              <label className="label">Ville</label>
              <input
                className="input"
                value={form.ville || ''}
                onChange={f('ville')}
              />
            </div>
            <div>
              <label className="label">Genre</label>
              <select
                className="input"
                value={form.genre || ''}
                onChange={f('genre')}
              >
                <option value="">— Sélectionner —</option>
                <option value="Homme">Homme</option>
                <option value="Femme">Femme</option>
              </select>
            </div>
            <div>
              <label className="label">Secteur d'activité</label>
              <select
                className="input"
                value={
                  SECTEURS_ACTIVITE.includes(form.secteur_activite)
                    ? form.secteur_activite
                    : (form.secteur_activite ? 'Autre' : '')
                }
                onChange={(e) => {
                  if (e.target.value === 'Autre') {
                    setIsCustomSecteur(true);
                    setForm(prev => ({ ...prev, secteur_activite: '' }));
                  } else {
                    setIsCustomSecteur(false);
                    setForm(prev => ({ ...prev, secteur_activite: e.target.value }));
                  }
                }}
              >
                <option value="">— Sélectionner un secteur d'activité —</option>
                {SECTEURS_ACTIVITE.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
                <option value="Autre">Autre (préciser)...</option>
              </select>
              {(isCustomSecteur || (form.secteur_activite && !SECTEURS_ACTIVITE.includes(form.secteur_activite))) && (
                <input
                  type="text"
                  className="input mt-2"
                  placeholder="Précisez le secteur d'activité..."
                  value={form.secteur_activite || ''}
                  onChange={f('secteur_activite')}
                  autoFocus
                />
              )}
            </div>
            <div>
              <label className="label">Date de naissance</label>
              <input
                type="date"
                className="input"
                value={form.date_naissance || ''}
                onChange={(e) => {
                  const dob = e.target.value;
                  setForm(prev => ({ ...prev, date_naissance: dob, age: calculateAge(dob) }));
                }}
              />
            </div>
            <div>
              <label className="label">Âge</label>
              <input
                type="text"
                className="input bg-slate-100 dark:bg-dark-800 cursor-not-allowed opacity-70"
                value={form.age || ''}
                readOnly
              />
            </div>
            <div>
              <label className="label">Niveau d'étude</label>
              <select
                className="input"
                value={(() => {
                  const normalized = normalizeNiveauEtude(form.niveau_etude);
                  if (NIVEAUX_ETUDE.includes(normalized)) return normalized;
                  return form.niveau_etude ? 'Autre' : '';
                })()}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'Autre') {
                    setIsCustomEtude(true);
                    setForm(prev => ({ ...prev, niveau_etude: '' }));
                  } else {
                    setIsCustomEtude(false);
                    setForm(prev => ({ ...prev, niveau_etude: val }));
                  }
                }}
              >
                <option value="">— Sélectionner le niveau d'étude —</option>
                {NIVEAUX_ETUDE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
                <option value="Autre">Autre (préciser)...</option>
              </select>
              {(isCustomEtude || (form.niveau_etude && !NIVEAUX_ETUDE.includes(normalizeNiveauEtude(form.niveau_etude)))) && (
                <input
                  type="text"
                  className="input mt-2"
                  placeholder="Précisez le niveau d'étude..."
                  value={form.niveau_etude || ''}
                  onChange={f('niveau_etude')}
                  autoFocus
                />
              )}
            </div>
          </div>
        </div>

        <div className="card mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Associés
            </h2>
            <button
              type="button"
              onClick={handleAddAssocie}
              className="btn btn-secondary text-xs py-1.5 px-3 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 font-semibold"
            >
              + Ajouter un associé
            </button>
          </div>
          
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-dark-700/60">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-dark-800/60 text-xs font-semibold text-slate-500 dark:text-dark-300 uppercase tracking-wider">
                  <th className="p-3 border-b border-slate-200 dark:border-dark-700/60">Nom & prénom</th>
                  <th className="p-3 border-b border-slate-200 dark:border-dark-700/60">CIN</th>
                  <th className="p-3 border-b border-slate-200 dark:border-dark-700/60">Fonction</th>
                  <th className="p-3 border-b border-slate-200 dark:border-dark-700/60">Tel</th>
                  <th className="p-3 border-b border-slate-200 dark:border-dark-700/60 w-12 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-dark-700/60">
                {(!Array.isArray(form.associes) || form.associes.length === 0) ? (
                  <tr>
                    <td colSpan="5" className="p-4 text-center text-sm text-slate-500 dark:text-dark-400 italic">
                      Aucun associé pour le moment
                    </td>
                  </tr>
                ) : (
                  form.associes.map((associe, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-dark-800/30 transition-colors">
                      <td className="p-2">
                        <input
                          className="input text-sm py-1.5 px-2"
                          value={associe.nom || ''}
                          onChange={(e) => handleAssocieChange(idx, 'nom', e.target.value)}
                          placeholder="Nom & prénom"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          className="input text-sm py-1.5 px-2"
                          value={associe.cin || ''}
                          onChange={(e) => handleAssocieChange(idx, 'cin', e.target.value)}
                          placeholder="CIN"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          className="input text-sm py-1.5 px-2"
                          value={associe.fonction || ''}
                          onChange={(e) => handleAssocieChange(idx, 'fonction', e.target.value)}
                          placeholder="Fonction"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          className="input text-sm py-1.5 px-2"
                          value={associe.tel || ''}
                          onChange={(e) => handleAssocieChange(idx, 'tel', e.target.value)}
                          placeholder="Tel"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveAssocie(idx)}
                          className="p-1.5 rounded-lg text-dark-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                          title="Supprimer"
                        >
                          <X size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="flex justify-end">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            <Save size={16} /> {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </form>

      {/* Modale d'importation Excel pour remplir les champs */}
      <ExcelImportModal
        isOpen={showExcelModal}
        onClose={() => setShowExcelModal(false)}
        title="Remplir les informations depuis Excel"
        description="Chargez un fichier Excel pour pré-remplir les champs de cet incubé."
        templateType="incube"
        fillSingle={true}
        onImport={handleImportExcel}
      />

      {/* MODAL POUR AGRANDIR LA PHOTO */}
      {enlargedPhoto && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            {/* Bouton Fermer */}
            <button
              onClick={() => setEnlargedPhoto(null)}
              className="absolute -top-12 right-0 p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
              title="Fermer (Échap)"
            >
              <X size={28} />
            </button>
            
            {/* L'image agrandie */}
            <img 
              src={enlargedPhoto} 
              alt="Photo de l'incubé" 
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl border-4 border-white/10"
            />
          </div>
        </div>
      )}
    </div>
  );
}
