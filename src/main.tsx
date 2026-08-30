import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
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
          <App />
        </CompanyProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
