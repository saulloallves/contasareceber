import React from 'react';
import { createRoot } from 'react-dom/client';
import AtualizarSite from './atualizar-site';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AtualizarSite />
  </React.StrictMode>
);
