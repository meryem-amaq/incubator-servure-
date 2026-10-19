import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api, { getPhotoUrl } from '../api/axios';
import toast from 'react-hot-toast';
import { User, Mail, Phone, Lock, Upload, Save, Shield } from 'lucide-react';

export default function Profil() {
  const { user, updateUser } = useAuth();
  
  const [form, setForm] = useState({
    nom: '',
    prenom: '',
    email: '',
    telephone: '',
  });
  
  const [passwordForm, setPasswordForm] = useState({
    mot_de_passe: '',
    confirm_mot_de_passe: '',
  });

  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);

  useEffect(() => {
    if (user) {
      const cleanPrenom = (user.prenom || '').replace(/\bcgs\b/gi, '').trim();
      const cleanNom = (user.nom || '').replace(/\bcgs\b/gi, '').trim();
      setForm({
        nom: cleanNom || (user.role === 'super_admin' ? 'Administrateur' : ''),
        prenom: cleanPrenom,
        email: user.email || '',
        telephone: user.telephone || '',
      });
      if (user.photo_url) {
        setPhotoPreview(getPhotoUrl(user.photo_url));
      }
    }
  }, [user]);

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const formData = new FormData();
      formData.append('nom', form.nom);
      formData.append('prenom', form.prenom);
      formData.append('email', form.email);
      formData.append('telephone', form.telephone);
      if (photoFile) {
        formData.append('photo', photoFile);
      }

      const token = localStorage.getItem('cgs_token');
      const res = await fetch(import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/auth/me` : '/api/auth/me', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Erreur lors de la mise à jour du profil');
      }
      
      const data = await res.json();
      updateUser(data);
      toast.success('Profil mis à jour avec succès');
    } catch (err) {
      toast.error(err.message || 'Erreur lors de la mise à jour du profil');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.mot_de_passe !== passwordForm.confirm_mot_de_passe) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }
    if (passwordForm.mot_de_passe.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setPwdLoading(true);
    try {
      await api.put('/auth/me', { mot_de_passe: passwordForm.mot_de_passe });
      toast.success('Mot de passe modifié avec succès');
      setPasswordForm({ mot_de_passe: '', confirm_mot_de_passe: '' });
    } catch (err) {
      toast.error('Erreur lors de la modification du mot de passe');
    } finally {
      setPwdLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <User className="text-primary-500" size={26} />
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Mon Profil</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Colonne Informations Principales */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-5 flex items-center gap-2">
              <User size={18} className="text-primary-500" /> Informations Personnelles
            </h2>
            
            <form onSubmit={handleUpdateProfile} className="space-y-5">
              
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 mb-6">
                <div className="relative group">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Avatar" className="w-24 h-24 rounded-2xl object-cover border-2 border-slate-200 dark:border-dark-700 shadow-md" />
                  ) : (
                    <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary-500 to-navy-600 flex items-center justify-center text-white text-3xl font-black shadow-md">
                      {form.prenom?.[0]}{form.nom?.[0]}
                    </div>
                  )}
                  <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                    <Upload className="text-white" size={24} />
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                  </label>
                </div>
                <div className="text-center sm:text-left space-y-1">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">{form.prenom} {form.nom}</h3>
                  <p className="text-sm font-medium text-primary-600 dark:text-primary-400">
                    {user?.role === 'super_admin' ? 'Super Administrateur' : 'Accompagnateur'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-dark-400 mt-2">
                    Cliquez sur la photo pour la modifier. Taille max: 5 Mo.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="text-xs font-semibold text-slate-600 dark:text-dark-300">Prénom</label>
                  <input
                    type="text"
                    required
                    value={form.prenom}
                    onChange={(e) => setForm({ ...form, prenom: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                  />
                </div>
                <div className="form-group">
                  <label className="text-xs font-semibold text-slate-600 dark:text-dark-300">Nom</label>
                  <input
                    type="text"
                    required
                    value={form.nom}
                    onChange={(e) => setForm({ ...form, nom: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="text-xs font-semibold text-slate-600 dark:text-dark-300">Adresse Email</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-3 text-slate-400 dark:text-dark-400" />
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="text-xs font-semibold text-slate-600 dark:text-dark-300">Téléphone</label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-3.5 top-3 text-slate-400 dark:text-dark-400" />
                    <input
                      type="tel"
                      value={form.telephone}
                      onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                      placeholder="Ex: 06 00 00 00 00"
                      className="w-full bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary flex items-center gap-2 shadow-lg shadow-primary-500/25 px-6"
                >
                  <Save size={18} />
                  {loading ? 'Enregistrement...' : 'Enregistrer les modifications'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Colonne Sécurité */}
        <div className="space-y-6">
          <div className="card p-6 border-t-4 border-t-navy-500 dark:border-t-navy-400">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-5 flex items-center gap-2">
              <Shield size={18} className="text-navy-500 dark:text-navy-400" /> Sécurité
            </h2>
            
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="form-group">
                <label className="text-xs font-semibold text-slate-600 dark:text-dark-300">Nouveau mot de passe</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-3 text-slate-400 dark:text-dark-400" />
                  <input
                    type="password"
                    value={passwordForm.mot_de_passe}
                    onChange={(e) => setPasswordForm({ ...passwordForm, mot_de_passe: e.target.value })}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-navy-500/20 focus:border-navy-500 transition-all"
                  />
                </div>
                <span className="text-[10px] text-slate-500 dark:text-dark-400 mt-1 block">Laisser vide pour ne pas modifier</span>
              </div>
              
              <div className="form-group">
                <label className="text-xs font-semibold text-slate-600 dark:text-dark-300">Confirmer mot de passe</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-3 text-slate-400 dark:text-dark-400" />
                  <input
                    type="password"
                    value={passwordForm.confirm_mot_de_passe}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirm_mot_de_passe: e.target.value })}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-navy-500/20 focus:border-navy-500 transition-all"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={pwdLoading || !passwordForm.mot_de_passe}
                  className="w-full btn bg-navy-600 hover:bg-navy-700 text-white flex items-center justify-center gap-2 shadow-lg shadow-navy-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Lock size={18} />
                  {pwdLoading ? 'Mise à jour...' : 'Mettre à jour'}
                </button>
              </div>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
