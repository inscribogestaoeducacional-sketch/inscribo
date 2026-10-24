import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerServiceWorker } from './lib/push';
import { installMobileLayout } from './lib/mobileLayout';
import { installPullToRefresh } from './lib/pullToRefresh';

registerServiceWorker();
installMobileLayout();
installPullToRefresh();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
