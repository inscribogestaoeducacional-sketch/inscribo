import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { installMobileLayout } from './lib/mobileLayout';
import { installPullToRefresh } from './lib/pullToRefresh';

installMobileLayout();
installPullToRefresh();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
