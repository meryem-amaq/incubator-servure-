import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  UserPlus,
  ShieldCheck,
  UserCheck,
  UserX,
  Trash2,
  Lock,
  Mail,
  User,
  Layers,
  X,
  Search,
  KeyRound,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react';
import api, { getPhotoUrl } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Utilisateurs() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    nom: '',
    prenom: '',
    email: '',
    mot_de_passe: '',
    role: 'admin',
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // État pour la réinitialisation de mot de passe par le Super Admin
  const [resetModalUser, setResetModalUser] = useState(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [sendEmailNotify, setSendEmailNotify] = useState(true);
  const [resettingPassword, setResettingPassword] = useState(false);

  const generateStrongPassword = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%';
    let pwd = '';
    for (let i = 0; i < 10; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPasswordInput(pwd);
  };

  const handleAdminResetPassword = async (e) => {
    e.preventDefault();
    if (!resetModalUser) return;
    if (newPasswordInput.length < 6) {
      toast.error('Le mot de passe doit comporter au moins 6 caractères');
      return;
    }
    setResettingPassword(true);
    try {
      const res = await api.post(`/users/${resetModalUser.id}/reset-password`, {
        mot_de_passe: newPasswordInput,
        envoyer_email: sendEmailNotify
      });
      toast.success(res.data?.message || 'Mot de passe réinitialisé avec succès !');
      setResetModalUser(null);
      setNewPasswordInput('');
    } catch (err) {
      console.error('Erreur reset password admin:', err);
      toast.error(err.response?.data?.message || 'Erreur lors de la réinitialisation');
    } finally {
      setResettingPassword(false);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users');
      setUsers(res.data);
    } catch (err) {
      toast.error('Impossible de charger la liste des utilisateurs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const formData = new FormData();
      Object.keys(form).forEach(key => formData.append(key, form[key]));
      if (photoFile) formData.append('photo', photoFile);

      const token = localStorage.getItem('cgs_token');
      const res = await fetch(import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/users` : '/api/users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Erreur lors de la création du compte');
      }

      toast.success('Compte administrateur créé avec succès');
      setShowModal(false);
      setForm({ nom: '', prenom: '', email: '', mot_de_passe: '', role: 'admin' });
      setPhotoFile(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.message || 'Erreur lors de la création du compte');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActif = async (targetUser) => {
    if (targetUser.id === currentUser?.id) {
      toast.error('Vous ne pouvez pas désactiver votre propre compte');
      return;
    }
    try {
      await api.put(`/users/${targetUser.id}`, { actif: !targetUser.actif });
      toast.success(`Compte ${targetUser.actif ? 'suspendu' : 'réactivé'}`);
      fetchUsers();
    } catch (err) {
      toast.error('Erreur lors du changement de statut');
    }
  };

  const handleDelete = async (targetUser) => {
    if (targetUser.id === currentUser?.id) {
      toast.error('Vous ne pouvez pas supprimer votre propre compte');
      return;
    }
    if (!window.confirm(`Voulez-vous vraiment supprimer le compte de ${targetUser.prenom} ${targetUser.nom} ?`)) {
      return;
    }
    try {
      await api.delete(`/users/${targetUser.id}`);
      toast.success('Utilisateur supprimé');
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      !search ||
      u.nom?.toLowerCase().includes(search.toLowerCase()) ||
      u.prenom?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-amber-500 dark:text-amber-400" size={22} />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Gestion des Utilisateurs</h1>
          </div>
          <p className="text-sm text-slate-600 dark:text-dark-300 mt-1">
            Gérez les comptes des accompagnateurs (Admins) et des superviseurs (Super Admins) de l'incubateur.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn btn-primary flex items-center gap-2 shadow-lg shadow-primary-500/25 shrink-0"
        >
          <UserPlus size={18} />
          Nouvel Accompagnateur
        </button>
      </div>

      {/* Barre de recherche */}
      <div className="card p-4 flex items-center gap-3">
        <Search size={18} className="text-slate-400 dark:text-dark-400 shrink-0" />
        <input
          type="text"
          placeholder="Rechercher par nom, prénom ou email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-transparent border-none text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-dark-400 focus:outline-none w-full"
        />
        {search && (
          <button onClick={() => setSearch('')} className="text-slate-400 dark:text-dark-400 hover:text-slate-700 dark:hover:text-white">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Table des utilisateurs */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-16 text-slate-500 dark:text-dark-400 text-sm">
            Aucun utilisateur trouvé.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-dark-700/60 bg-slate-50 dark:bg-dark-800/40 text-slate-500 dark:text-dark-400">
                  <th className="p-4 font-semibold">Utilisateur</th>
                  <th className="p-4 font-semibold">Email</th>
                  <th className="p-4 font-semibold">Rôle</th>
                  <th className="p-4 font-semibold text-center">Incubés Assignés</th>
                  <th className="p-4 font-semibold">Statut</th>
                  <th className="p-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-dark-700/30">
                {filteredUsers.map((item) => {
                  const isSuper = item.role === 'super_admin' || item.role === 'administrateur';
                  const isCurrent = item.id === currentUser?.id;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-dark-800/30 transition-colors">
                      <td className="p-4 font-medium text-slate-900 dark:text-white flex items-center gap-3">
                        {item.photo_url ? (
                          <img 
                            src={getPhotoUrl(item.photo_url)} 
                            alt={`${item.prenom} ${item.nom}`}
                            className="w-9 h-9 rounded-lg object-cover shrink-0 border border-slate-200 dark:border-dark-700"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-600 to-navy-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {item.prenom?.[0]}{item.nom?.[0]}
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span>{item.prenom} {item.nom}</span>
                            {isCurrent && (
                              <span className="text-[10px] text-primary-600 dark:text-primary-400 font-normal">(Vous)</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-slate-600 dark:text-dark-300 font-mono text-[11px]">{item.email}</td>
                      <td className="p-4">
                        {isSuper ? (
                          <span className="px-2 py-1 text-[10px] font-bold rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            Super Admin
                          </span>
                        ) : item.role === 'admin' ? (
                          <span className="px-2 py-1 text-[10px] font-semibold rounded-md bg-navy-500/15 text-navy-600 dark:text-navy-300 border border-navy-500/30">
                            Accompagnateur
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-[10px] font-semibold rounded-md bg-slate-500/15 text-slate-600 dark:text-slate-300 border border-slate-500/30">
                            Incubé
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <span className="px-2.5 py-1 rounded-full bg-slate-200 dark:bg-dark-700/60 text-slate-700 dark:text-white font-bold text-xs">
                          {item.totalIncubes}
                        </span>
                      </td>
                      <td className="p-4">
                        {item.actif ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400" /> Actif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-semibold text-[11px]">
                            <span className="w-2 h-2 rounded-full bg-red-500 dark:bg-red-400" /> Suspendu
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setResetModalUser(item);
                              generateStrongPassword();
                              setShowNewPassword(true);
                              setSendEmailNotify(true);
                            }}
                            className="p-1.5 rounded-lg border border-blue-500/30 text-blue-500 dark:text-blue-400 hover:bg-blue-500/10 transition-all"
                            title="Réinitialiser le mot de passe de cet utilisateur"
                          >
                            <KeyRound size={15} />
                          </button>
                          <button
                            onClick={() => handleToggleActif(item)}
                            disabled={isCurrent}
                            className={`p-1.5 rounded-lg border transition-all ${
                              item.actif
                                ? 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10'
                                : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                            } disabled:opacity-30 disabled:cursor-not-allowed`}
                            title={item.actif ? 'Suspendre' : 'Réactiver'}
                          >
                            {item.actif ? <UserX size={15} /> : <UserCheck size={15} />}
                          </button>
                          <button
                            onClick={() => handleDelete(item)}
                            disabled={isCurrent}
                            className="p-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Supprimer"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Créer un utilisateur */}
      {showModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-navy-950/60 dark:bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="card w-full max-w-md p-6 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-dark-700 pb-4 mb-5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <UserPlus size={20} className="text-primary-600 dark:text-primary-400" /> Nouvel Accompagnateur
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-500 dark:text-dark-400 hover:text-slate-900 dark:hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="text-xs text-slate-600 dark:text-dark-300">Prénom *</label>
                  <input
                    type="text"
                    required
                    placeholder="ex: Khalid"
                    value={form.prenom}
                    onChange={(e) => setForm({ ...form, prenom: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-dark-500 focus:outline-none focus:border-primary-500"
                  />
                </div>
                <div className="form-group">
                  <label className="text-xs text-slate-600 dark:text-dark-300">Nom *</label>
                  <input
                    type="text"
                    required
                    placeholder="ex: Alami"
                    value={form.nom}
                    onChange={(e) => setForm({ ...form, nom: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-dark-500 focus:outline-none focus:border-primary-500"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="text-xs text-slate-600 dark:text-dark-300">Adresse e-mail *</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-3 text-slate-400 dark:text-dark-400" />
                  <input
                    type="email"
                    required
                    placeholder="accompagnateur@ids.ma"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-dark-500 focus:outline-none focus:border-primary-500"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="text-xs text-slate-600 dark:text-dark-300">Mot de passe temporaire *</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-3 text-slate-400 dark:text-dark-400" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="••••••••"
                    value={form.mot_de_passe}
                    onChange={(e) => setForm({ ...form, mot_de_passe: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-dark-500 focus:outline-none focus:border-primary-500"
                  />
                </div>
                <span className="text-[10px] text-slate-500 dark:text-dark-400 mt-1 block">Au moins 6 caractères</span>
              </div>

              <div className="form-group">
                <label className="text-xs text-slate-600 dark:text-dark-300">Rôle attribué *</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-primary-500"
                >
                  <option value="admin">Accompagnateur / Formateur (Admin)</option>
                  <option value="super_admin">Super Administrateur / Directeur (Super Admin)</option>
                  <option value="user">Incubé</option>
                </select>
              </div>

              <div className="form-group">
                <label className="text-xs text-slate-600 dark:text-dark-300">Photo de profil (Optionnelle)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPhotoFile(e.target.files[0])}
                  className="w-full bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:bg-primary-500 file:text-navy-950 hover:file:bg-primary-600"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-dark-700">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary text-xs"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary text-xs flex items-center gap-2"
                >
                  {submitting ? 'Création...' : 'Créer le compte'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Réinitialiser le mot de passe (Super Admin) */}
      {resetModalUser && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-navy-950/60 dark:bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="card w-full max-w-md p-6 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-dark-700 pb-4 mb-5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <KeyRound size={20} className="text-primary-600 dark:text-primary-400" />
                Réinitialiser le mot de passe
              </h2>
              <button
                onClick={() => setResetModalUser(null)}
                className="text-slate-500 dark:text-dark-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAdminResetPassword} className="space-y-4">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-dark-800/60 border border-slate-200 dark:border-dark-700/60 text-xs">
                <p className="text-slate-500 dark:text-dark-400">Compte concerné :</p>
                <p className="font-bold text-slate-800 dark:text-dark-100 text-sm mt-0.5">
                  {resetModalUser.prenom} {resetModalUser.nom}
                </p>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">{resetModalUser.email}</p>
              </div>

              <div className="form-group">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-dark-200">
                    Nouveau mot de passe *
                  </label>
                  <button
                    type="button"
                    onClick={generateStrongPassword}
                    className="text-[11px] font-bold text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
                  >
                    <Sparkles size={12} /> Générer aléatoire
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-lg pl-3 pr-10 py-2 text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-dark-500 focus:outline-none focus:border-primary-500"
                    placeholder="Min. 6 caractères"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={sendEmailNotify}
                  onChange={(e) => setSendEmailNotify(e.target.checked)}
                  className="rounded border-slate-300 text-primary-600 focus:ring-primary-500/20"
                />
                <span className="text-xs text-slate-600 dark:text-dark-300">
                  Transmettre automatiquement les nouveaux accès par e-mail
                </span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-dark-700/60">
                <button
                  type="button"
                  onClick={() => setResetModalUser(null)}
                  className="btn btn-secondary btn-sm text-xs"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={resettingPassword}
                  className="btn btn-primary btn-sm text-xs font-bold flex items-center gap-1.5 shadow-md shadow-primary-500/20"
                >
                  {resettingPassword ? 'Enregistrement...' : 'Enregistrer le mot de passe'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
