import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
  // Le jeton JWT voyage dans un cookie httpOnly envoyé automatiquement par le navigateur
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('cgs_token'); // purge d'un éventuel ancien jeton stocké avant la migration
      localStorage.removeItem('cgs_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export const getPhotoUrl = (path) => {
  if (!path) return null;

  // Si c'est déjà une URL complète (http/https/data)
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    // Convertir les liens Google Drive en liens image directs
    // Format: https://drive.google.com/file/d/FILE_ID/view?...
    const driveMatch = path.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (driveMatch) {
      return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
    }
    // Format: https://drive.google.com/open?id=FILE_ID
    const driveMatch2 = path.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
    if (driveMatch2) {
      return `https://lh3.googleusercontent.com/d/${driveMatch2[1]}`;
    }
    // Format: https://drive.google.com/uc?id=FILE_ID
    const driveMatch3 = path.match(/drive\.google\.com\/uc\?.*id=([a-zA-Z0-9_-]+)/);
    if (driveMatch3) {
      return `https://lh3.googleusercontent.com/d/${driveMatch3[1]}`;
    }
    return path;
  }

  const clean = path.replace(/^uploads[\\/]/, '');
  const baseUrl = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://127.0.0.1:5000');
  return `${baseUrl}/uploads/${clean}`;
};

export default api;
