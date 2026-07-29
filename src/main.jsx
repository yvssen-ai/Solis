import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

import './styles/tokens.css';
import './styles/base.css';
import './styles/sections.css';
import './styles/menu.css';

/* Lock scrolling for the preloader here, not in an effect: child effects run
   before parent ones, so a reduced-motion preloader would otherwise finish and
   unlock the page *before* the lock was ever applied. */
document.body.classList.add('is-loading');

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
