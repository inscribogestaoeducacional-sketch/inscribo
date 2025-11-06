import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { setupReloadPrevention, setupSessionPersistence } from './lib/preventReload'

// Setup de prevenção de reload (ANTES do createRoot)
setupReloadPrevention()
setupSessionPersistence()

// Renderizar aplicação (APENAS UMA VEZ!)
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
