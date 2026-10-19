import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);

// Thème par défaut selon l'environnement :
//   - En local (développement) → dark
//   - En production (serveur)  → light
const ENV_DEFAULT_THEME = import.meta.env.DEV ? 'dark' : 'light';

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    // Respecter la préférence sauvegardée par l'utilisateur si existante
    const savedTheme = localStorage.getItem('app-theme');
    if (savedTheme === 'light' || savedTheme === 'dark') {
      return savedTheme;
    }
    // Sinon thème par défaut
    return import.meta.env.DEV ? 'dark' : 'light';
  });

  useEffect(() => {
    // Appliquer la classe 'dark' au <html> ou <body>
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('app-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
