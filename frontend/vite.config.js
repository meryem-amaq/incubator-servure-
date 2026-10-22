import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Exposition réseau sécurisée : VITE_EXPOSE=1 npm run dev
    host: process.env.VITE_EXPOSE === '1' ? true : 'localhost',
    port: 5173,
    allowedHosts: process.env.VITE_ALLOWED_HOSTS 
      ? process.env.VITE_ALLOWED_HOSTS.split(',') 
      : ['.ngrok-free.app', '.loca.lt', 'localhost'],
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-charts': ['chart.js', 'react-chartjs-2'],
          'vendor-excel': ['xlsx'],
          'vendor-pdf': ['jspdf', 'jspdf-autotable'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
});
