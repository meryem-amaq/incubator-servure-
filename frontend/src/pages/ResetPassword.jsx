import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowLeft, ShieldCheck, KeyRound } from 'lucide-react';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const id = searchParams.get('id');

  const [nouveauMotDePasse, setNouveauMotDePasse] = useState('');
  const [confirmMotDePasse, setConfirmMotDePasse] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const isTokenMissing = !token || !id;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (nouveauMotDePasse.length < 6) {
      toast.error('Le mot de passe doit comporter au moins 6 caractères');
      return;
    }

    if (nouveauMotDePasse !== confirmMotDePasse) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/reset-password', {
        id,
        token,
        nouveau_mot_de_passe: nouveauMotDePasse
      });

      toast.success(res.data?.message || 'Mot de passe réinitialisé avec succès !');
      setSuccess(true);
    } catch (err) {
      console.error('Erreur réinitialisation:', err);
      toast.error(err.response?.data?.message || 'Lien invalide ou expiré (durée de validité : 30 min)');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200 dark:from-dark-950 dark:via-dark-900 dark:to-navy-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Halo décoratif */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-navy-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white/95 dark:bg-dark-900/90 backdrop-blur-xl border border-slate-200 dark:border-dark-700/60 rounded-3xl p-8 shadow-2xl relative z-10">
        {/* En-tête */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-navy-600 text-white flex items-center justify-center shadow-lg shadow-primary-500/25">
              <KeyRound size={28} />
            </div>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Nouveau mot de passe</h1>
          <p className="text-xs text-slate-500 dark:text-dark-400 mt-1">
            Définissez un mot de passe sécurisé pour accéder à votre compte IDS
          </p>
        </div>

        {isTokenMissing ? (
          <div className="text-center py-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
              <AlertCircle size={24} />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Lien invalide ou incomplet</h3>
            <p className="text-xs text-slate-500 dark:text-dark-400">
              Ce lien de réinitialisation ne contient pas les identifiants requis. Veuillez réitérer votre demande depuis l'écran de connexion.
            </p>
            <Link
              to="/login"
              className="btn btn-primary w-full py-2.5 text-xs font-bold inline-flex items-center justify-center gap-2 mt-2"
            >
              <ArrowLeft size={15} /> Retour à la connexion
            </Link>
          </div>
        ) : success ? (
          <div className="text-center py-6 space-y-4 animate-fade-in">
            <div className="w-14 h-14 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30 shadow-sm">
              <CheckCircle2 size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Mot de passe réinitialisé !</h3>
            <p className="text-xs text-slate-600 dark:text-dark-300">
              Votre mot de passe a été mis à jour avec succès. Vous pouvez à présent vous connecter à la plateforme IDS.
            </p>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="btn btn-primary w-full py-3 text-sm font-bold shadow-lg shadow-primary-500/25 mt-4"
            >
              Se connecter maintenant →
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label text-xs font-bold">Nouveau mot de passe</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-3.5 text-slate-400 dark:text-dark-400 pointer-events-none" />
                <input
                  type={showPwd ? 'text' : 'password'}
                  placeholder="Min. 6 caractères"
                  value={nouveauMotDePasse}
                  onChange={(e) => setNouveauMotDePasse(e.target.value)}
                  className="input pl-10 pr-10"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3.5 top-3 text-slate-400 dark:text-dark-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="label text-xs font-bold">Confirmer le nouveau mot de passe</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-3.5 text-slate-400 dark:text-dark-400 pointer-events-none" />
                <input
                  type={showPwd ? 'text' : 'password'}
                  placeholder="Retapez le mot de passe"
                  value={confirmMotDePasse}
                  onChange={(e) => setConfirmMotDePasse(e.target.value)}
                  className="input pl-10 pr-10"
                  required
                  minLength={6}
                />
              </div>
            </div>

            {/* Règles de sécurité */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-dark-800/60 border border-slate-200 dark:border-dark-700/60 text-[11px] text-slate-500 dark:text-dark-400 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-dark-300">
                <ShieldCheck size={14} className="text-primary-500" />
                <span>Consignes de sécurité :</span>
              </div>
              <ul className="list-disc pl-5 space-y-0.5 text-[10px]">
                <li>Au moins 6 caractères</li>
                <li>Lien valable 30 minutes, à usage unique</li>
              </ul>
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full py-3 mt-4 shadow-lg shadow-primary-500/25 flex items-center justify-center text-sm font-bold"
              disabled={loading}
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-navy-950" />
              ) : (
                'Enregistrer le nouveau mot de passe'
              )}
            </button>

            <div className="text-center pt-2">
              <Link
                to="/login"
                className="text-xs text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 inline-flex items-center gap-1 transition-colors"
              >
                <ArrowLeft size={13} /> Retour à l'écran de connexion
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
