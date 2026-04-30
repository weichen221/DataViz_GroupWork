import React from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

requestAnimationFrame(async () => {
  await import('./experience.js');
  await import('./legacyFloodRecords.js');
  await import('./legacyInline.js');
});
