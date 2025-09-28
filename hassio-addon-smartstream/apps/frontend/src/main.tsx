import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App.tsx';
import './index.css';

// Detect if running in Home Assistant ingress
const getBasename = (): string => {
  // For Home Assistant ingress, the basename is derived from the current path
  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname;
    // Home Assistant ingress URLs look like: /api/hassio_ingress/TOKEN/
    const ingressMatch = pathname.match(/^(\/api\/hassio_ingress\/[^\/]+)/);
    if (ingressMatch) {
      return ingressMatch[1];
    }
  }
  return '/';
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter
      basename={getBasename()}
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <App />
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            duration: 5000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>,
);
