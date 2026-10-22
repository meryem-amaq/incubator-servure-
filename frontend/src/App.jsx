import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import Layout from './components/Layout/Layout';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import Annuaire from './pages/Annuaire';
import ProfilIncube from './pages/ProfilIncube';
import Dashboard from './pages/Dashboard';
import Utilisateurs from './pages/Utilisateurs';
import Profil from './pages/Profil';
import Engagement from './pages/Engagement';
import Evenements from './pages/Evenements';
import Formations from './pages/Formations';
import Presence from './pages/Presence';
import PresenceFormation from './pages/PresenceFormation';
import GestionEspaces from './pages/GestionEspaces';
import ReservationEspacePublique from './pages/ReservationEspacePublique';
import BookingPage from './pages/BookingPage';
import RapportsActivite from './pages/RapportsActivite';
import ControleAcces from './pages/ControleAcces';

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

function SuperAdminRoute({ children }) {
  const { user, isSuperAdmin } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!isSuperAdmin) return <Navigate to="/incubes" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  // Si le lien provient d'un email (paramètre ?email=...), on affiche TOUJOURS la page de connexion
  if (searchParams.get('email') || searchParams.get('switch') || searchParams.get('logout')) {
    return children;
  }
  return user ? <Navigate to="/" replace /> : children;
}

function AdminRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'incube') {
    return <Navigate to={user.pp_id ? `/incube/${user.pp_id}` : '/profil'} replace />;
  }
  return children;
}

function IndexRedirect() {
  const { user, isSuperAdmin } = useAuth();
  if (user?.role === 'incube') {
    return <Navigate to={user.pp_id ? `/incube/${user.pp_id}` : '/profil'} replace />;
  }
  return <Navigate to={isSuperAdmin ? '/dashboard' : '/incubes'} replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/reset-password" element={<PublicRoute><ResetPassword /></PublicRoute>} />
      <Route path="/presence/:id" element={<Presence />} />
      <Route path="/emargement/:id" element={<Presence />} />
      <Route path="/formation" element={<PresenceFormation />} />
      <Route path="/formation/:id" element={<PresenceFormation />} />
      <Route path="/reserver-espace/:espace" element={<ReservationEspacePublique />} />
      <Route path="/booking/:espace" element={<ReservationEspacePublique />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<IndexRedirect />} />
        <Route
          path="dashboard"
          element={
            <SuperAdminRoute>
              <Dashboard />
            </SuperAdminRoute>
          }
        />
        <Route path="incubes" element={<AdminRoute><Annuaire /></AdminRoute>} />
        <Route path="incube/:id" element={<ProfilIncube />} />
        <Route path="booking" element={<BookingPage />} />
        <Route path="engagement" element={<AdminRoute><Engagement /></AdminRoute>} />
        <Route path="rapports" element={<SuperAdminRoute><RapportsActivite /></SuperAdminRoute>} />
        <Route path="formations" element={<Formations />} />
        <Route path="evenements" element={<Evenements />} />
        <Route path="evenement" element={<Navigate to="/evenements" replace />} />
        <Route path="espaces" element={<GestionEspaces />} />
        <Route path="materiel" element={<Navigate to="/espaces" replace />} />
        <Route
          path="utilisateurs"
          element={
            <SuperAdminRoute>
              <Utilisateurs />
            </SuperAdminRoute>
          }
        />
        <Route
          path="controle-acces"
          element={
            <SuperAdminRoute>
              <ControleAcces />
            </SuperAdminRoute>
          }
        />
        <Route path="profil" element={<Profil />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function ToastWrapper() {
  const { theme } = useTheme();
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 3500,
        style: {
          background: theme === 'dark' ? '#1e293b' : '#ffffff',
          color: theme === 'dark' ? '#e2e8f0' : '#0f172a',
          border: theme === 'dark' ? '1px solid rgba(51,65,85,0.5)' : '1px solid #e2e8f0',
          borderRadius: '12px',
          fontSize: '13px',
          fontWeight: '500',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
        },
        success: {
          iconTheme: {
            primary: '#059669',
            secondary: '#ffffff',
          },
        },
        error: {
          iconTheme: {
            primary: '#dc2626',
            secondary: '#ffffff',
          },
        },
      }}
    />
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <ToastWrapper />
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
