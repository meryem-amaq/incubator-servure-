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

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem('cgs_token');
    // Si un ancien faux token démo est présent, on le purge
    if (token === 'demo-token') {
      localStorage.removeItem('cgs_token');
      localStorage.removeItem('cgs_user');
      return null;
    }
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

  // Synchronisation avec l'API pour récupérer les données fraîches sans "CGS"
  useEffect(() => {
    const token = localStorage.getItem('cgs_token');
    if (token && token !== 'demo-token') {
      api.get('/auth/me')
        .then((res) => {
          if (res.data) {
            const cleaned = sanitizeUserData(res.data);
            setUser(cleaned);
            localStorage.setItem('cgs_user', JSON.stringify(cleaned));
          }
        })
        .catch(() => {});
    }
  }, []);

  const login = async (email, mot_de_passe) => {
    setLoading(true);

    // Connexion réelle via API backend
    try {
      const res = await api.post('/auth/login', { email, mot_de_passe });
      localStorage.setItem('cgs_token', res.data.token);
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

  const logout = () => {
    localStorage.removeItem('cgs_token');
    localStorage.removeItem('cgs_user');
    setUser(null);
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('cgs_user', JSON.stringify(updatedUser));
  };

  const isSuperAdmin = ['super_admin', 'admin', 'administrateur', 'superadmin'].includes(user?.role);

  return (
    <AuthContext.Provider value={{ user, isSuperAdmin, login, logout, loading, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
