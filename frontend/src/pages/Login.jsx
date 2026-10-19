import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import toast from 'react-hot-toast';
import { Mail, Lock, Eye, EyeOff, X, ArrowRight, CheckCircle2, KeyRound, Sun, Moon } from 'lucide-react';
import api from '../api/axios';

export default function Login() {
  const [form, setForm] = useState({ email: '', mot_de_passe: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    return localStorage.getItem('ids_remember_me') === 'true';
  });
  const { login, logout, user, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const emailParam = searchParams.get('email');
    if (searchParams.get('logout') === 'true') {
      logout();
    }
    if (emailParam) {
      setForm((prev) => ({ ...prev, email: emailParam }));
      return;
    }
    const savedEmail = localStorage.getItem('ids_saved_email');
    if (savedEmail) {
      setForm((prev) => ({ ...prev, email: savedEmail }));
    }
  }, [location.search, logout]);

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (!forgotEmail) {
      toast.error("Veuillez saisir votre adresse e-mail");
      return;
    }
    setForgotLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email: forgotEmail });
      toast.success(res.data?.message || "Email envoyé !");
      setForgotSent(true);
    } catch (err) {
      console.error("Erreur forgot password:", err);
      toast.error(err.response?.data?.message || "Erreur lors de l'envoi de la demande");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await login(form.email, form.mot_de_passe);
    if (result.success) {
      if (rememberMe) {
        localStorage.setItem('ids_remember_me', 'true');
        localStorage.setItem('ids_saved_email', form.email);
      } else {
        localStorage.removeItem('ids_remember_me');
        localStorage.removeItem('ids_saved_email');
      }
      toast.success('Connexion réussie !');
      navigate('/');
    } else {
      toast.error(result.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200 dark:from-dark-950 dark:via-dark-900 dark:to-navy-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative ambient gradients matching logo charte */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-navy-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white/90 dark:bg-dark-900/80 backdrop-blur-xl border border-slate-200 dark:border-dark-700/60 rounded-3xl p-8 shadow-2xl relative z-10">
        {/* Bouton toggle thème */}
        <button
          type="button"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
          className="absolute top-4 right-4 w-9 h-9 rounded-xl flex items-center justify-center
                     bg-slate-100 dark:bg-dark-800 border border-slate-200 dark:border-dark-700/60
                     text-slate-500 dark:text-dark-300 hover:text-primary-600 dark:hover:text-primary-400
                     hover:bg-slate-200 dark:hover:bg-dark-700 transition-all duration-200
                     shadow-sm hover:shadow-md"
        >
          {theme === 'dark'
            ? <Sun size={16} className="transition-transform duration-300 rotate-0 hover:rotate-12" />
            : <Moon size={16} className="transition-transform duration-300" />}
        </button>
        {/* Brand Logo Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="relative group">
              <img
                src="/logo-ids.png"
                alt="Incubateur Digital Solidaire"
                className="w-24 h-24 rounded-2xl shadow-xl shadow-primary-500/20 object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </div>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">IDS Incubateur</h1>
          <p className="text-sm font-semibold text-primary-600 dark:text-primary-400 mt-1">Incubateur Digital Solidaire</p>
          <p className="text-xs text-slate-500 dark:text-dark-400 mt-1">Plateforme de suivi et d'accompagnement des projets</p>
        </div>

        {user && (
          <div className="mb-5 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-center justify-between gap-3 text-xs shadow-sm">
            <div className="truncate">
              <p className="text-amber-800 dark:text-amber-300 font-semibold truncate">
                Session active : {`${(user.prenom || '').replace(/\bcgs\b/gi, '').trim()} ${(user.nom || '').replace(/\bcgs\b/gi, '').trim()}`.trim() || 'Administrateur'}
              </p>
              <p className="text-amber-600/90 dark:text-amber-400/80 text-[11px] truncate">
                {user.role} ({user.email})
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                logout();
                toast.success('Déconnecté de la session précédente');
              }}
              className="px-2.5 py-1.5 rounded-lg bg-rose-600 text-white font-bold text-[11px] hover:bg-rose-700 transition shrink-0 shadow-sm"
            >
              Déconnexion
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} method="post" className="space-y-4">
          <div>
            <label className="label text-xs">Adresse e-mail</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-3.5 text-slate-400 dark:text-dark-400 pointer-events-none" />
              <input
                type="email"
                name="email"
                id="email"
                autoComplete="username"
                placeholder="nom@exemple.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="input pl-10"
                required
              />
            </div>
          </div>

          <div>
            <label className="label text-xs">Mot de passe</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-3.5 text-slate-400 dark:text-dark-400 pointer-events-none" />
              <input
                type={showPwd ? 'text' : 'password'}
                name="password"
                id="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={form.mot_de_passe}
                onChange={(e) => setForm({ ...form, mot_de_passe: e.target.value })}
                className="input pl-10 pr-10"
                required
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

          {/* Ligne au-dessus du bouton de connexion : Se souvenir de moi & Mot de passe oublié ? */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none group">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 dark:border-dark-600 text-primary-600 focus:ring-primary-500/30 cursor-pointer accent-primary-500"
              />
              <span className="text-xs text-slate-600 dark:text-dark-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors font-medium">
                Se souvenir de moi
              </span>
            </label>

            <button
              type="button"
              onClick={() => {
                setForgotEmail(form.email || '');
                setForgotSent(false);
                setShowForgotModal(true);
              }}
              className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 hover:underline transition-colors"
            >
              Mot de passe oublié ?
            </button>
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full py-3 mt-5 shadow-lg shadow-primary-500/25 flex items-center justify-center text-sm font-bold"
            disabled={loading}
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-navy-950" />
            ) : (
              'Se connecter'
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-dark-700/50 text-center">
          <p className="text-xs text-slate-500 dark:text-dark-400">
            Accès sécurisé réservé aux administrateurs et accompagnateurs
          </p>
          <p className="text-[11px] text-slate-400 dark:text-dark-500 mt-1 font-mono">
            Incubateur Digital Solidaire (IDS) • Fablab & Innovation
          </p>
        </div>
      </div>

      {/* Modal Récupération de Mot de Passe */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 dark:bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-3xl p-6 sm:p-7 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-dark-700/60 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary-500/10 text-primary-500 flex items-center justify-center">
                  <KeyRound size={17} />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Mot de passe oublié</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1"
              >
                <X size={18} />
              </button>
            </div>

            {forgotSent ? (
              <div className="py-4 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
                  <CheckCircle2 size={26} />
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Instructions transmises !</h4>
                <p className="text-xs text-slate-500 dark:text-dark-300 leading-relaxed">
                  Si l'adresse <strong>{forgotEmail}</strong> correspond à un compte actif, vous recevrez un email contenant un lien de réinitialisation sécurisé valable <strong>30 minutes</strong>.
                </p>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="btn btn-primary w-full py-2.5 text-xs font-bold mt-2"
                >
                  Compris, fermer
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <p className="text-xs text-slate-500 dark:text-dark-300 leading-relaxed">
                  Indiquez votre adresse e-mail professionnelle. Nous vous ferons parvenir un lien pour redéfinir votre mot de passe en toute sécurité.
                </p>

                <div>
                  <label className="label text-xs font-bold">Votre adresse e-mail</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-3 text-slate-400 pointer-events-none" />
                    <input
                      type="email"
                      required
                      placeholder="nom@exemple.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="input pl-10 !text-xs"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="btn btn-secondary btn-sm text-xs"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="btn btn-primary btn-sm text-xs font-bold flex items-center gap-1.5 shadow-md shadow-primary-500/20"
                  >
                    {forgotLoading ? 'Envoi...' : (
                      <>
                        <span>Envoyer le lien</span>
                        <ArrowRight size={14} />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
