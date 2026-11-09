import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

const sanitizeUserData = (userData) => {
  if (!userData) return null;
  const cleaned = { ...userData };
  if (typeof cleaned.prenom === 'string' && cleaned.prenom.trim().toUpperCase() === 'CGS') {
    cleaned.prenom = '';
  }
  if (typeof cleaned.nom === 'string' && cleaned.nom.trim().toUpperCase() === 'CGS') {
    cleaned.nom = 'Administrateur';
  }
  return cleaned;
};

// Le jeton JWT est désormais stocké dans un cookie httpOnly géré par le serveur :
// il n'est jamais lisible par le JavaScript. Seul le profil (non sensible) est mis en cache
// dans localStorage pour l'affichage immédiat de l'interface.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    // Purge définitive de l'ancien jeton stocké en clair avant la migration vers le cookie httpOnly
    localStorage.removeItem('cgs_token');
    const stored = localStorage.getItem('cgs_user');
    if (!stored) return null;
    try {
      const parsed = JSON.parse(stored);
      const cleaned = sanitizeUserData(parsed);
      if (JSON.stringify(cleaned) !== stored) {
        localStorage.setItem('cgs_user', JSON.stringify(cleaned));
      }
      return cleaned;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);

  // Vérification de la session auprès du serveur (le cookie httpOnly est envoyé automatiquement)
  useEffect(() => {
    if (!localStorage.getItem('cgs_user')) return;
    api.get('/auth/me')
      .then((res) => {
        if (res.data) {
          const cleaned = sanitizeUserData(res.data);
          setUser(cleaned);
          localStorage.setItem('cgs_user', JSON.stringify(cleaned));
        }
      })
      .catch(() => {});
  }, []);

  const login = async (email, mot_de_passe) => {
    setLoading(true);

    // Connexion réelle via API backend (le serveur dépose le cookie httpOnly de session)
    try {
      const res = await api.post('/auth/login', { email, mot_de_passe });
      localStorage.setItem('cgs_user', JSON.stringify(res.data.user));
      setUser(res.data.user);
      return { success: true };
    } catch (err) {
      return { 
        success: false, 
        message: err.response?.data?.message || 'Erreur de connexion au serveur backend' 
      };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    localStorage.removeItem('cgs_user');
    setUser(null);
    // Le cookie httpOnly ne peut être supprimé que par le serveur
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignorer : la session locale est déjà vidée
    }
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('cgs_user', JSON.stringify(updatedUser));
  };

  const isSuperAdmin = ['super_admin', 'administrateur', 'superadmin'].includes(user?.role);
  const isStaff = ['super_admin', 'admin', 'administrateur', 'superadmin', 'accompagnateur', 'gestionnaire', 'consultant'].includes(user?.role);
  const isAdmin = isStaff; // Alias pour rétro-compatibilité
  const isIncube = user?.role === 'incube' || user?.role === 'user';

  return (
    <AuthContext.Provider value={{ user, isSuperAdmin, isAdmin, isStaff, isIncube, login, logout, loading, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
