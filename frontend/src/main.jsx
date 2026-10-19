import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { Toaster } from 'react-hot-toast';

// Protection contre les erreurs 'NotFoundError: Failed to execute removeChild on Node' provoquées par Google Translate
// Limitée aux nœuds internes de l'application React
if (typeof window !== 'undefined' && typeof Node === 'function' && Node.prototype) {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function (child) {
    if (child && child.parentNode !== this) {
      const root = document.getElementById('root');
      if (root && root.contains(this)) {
        if (console && console.warn) {
          console.warn('Google Translate conflict prevented in removeChild:', this, child);
        }
        return child;
      }
    }
    return originalRemoveChild.apply(this, arguments);
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function (newNode, referenceNode) {
    if (referenceNode && referenceNode.parentNode !== this) {
      const root = document.getElementById('root');
      if (root && root.contains(this)) {
        if (console && console.warn) {
          console.warn('Google Translate conflict prevented in insertBefore:', this, referenceNode);
        }
        return newNode;
      }
    }
    return originalInsertBefore.apply(this, arguments);
  };
}

// Ouvrir automatiquement le calendrier au clic sur les champs de type date
if (typeof window !== 'undefined') {
  document.addEventListener('click', (e) => {
    if (e.target && e.target.tagName === 'INPUT' && e.target.type === 'date') {
      if (typeof e.target.showPicker === 'function') {
        try {
          e.target.showPicker();
        } catch (err) {}
      }
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: '#1e293b',
          color: '#f1f5f9',
          border: '1px solid #263347',
          borderRadius: '10px',
          fontSize: '13.5px',
        },
        success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
        error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
      }}
    />
  </React.StrictMode>
);
