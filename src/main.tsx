// Limpiar cualquier Service Worker y CacheStorage en inicio
if (typeof window !== 'undefined') {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (const registration of registrations) {
        registration.unregister();
      }
    });
  }
  if ('caches' in window) {
    caches.keys().then(names => {
      for (const name of names) {
        caches.delete(name);
      }
    });
  }
}
// Limpiar cualquier Service Worker obsoleto o residual en desarrollo local
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (const registration of registrations) {
      registration.unregister();
    }
  });
}

import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ThemeProvider } from './utils/themeContext';
import { CompanyProvider } from './utils/companyContext';
import { AuthProvider } from './utils/authContext';
import { initDatabaseIfEmpty } from './db/seedData';
import './index.css';

// Inicializar base de datos con catálogo demostrativo si está vacía
initDatabaseIfEmpty().catch(console.error);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <CompanyProvider>
          <ErrorBoundary><App /></ErrorBoundary>
        </CompanyProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
