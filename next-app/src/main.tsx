import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import MoneyMovementsApp from './features/moneyMovements/MoneyMovementsApp';
import './styles/index.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

const isMoneyMovementExperiment = new URLSearchParams(window.location.search).get('product') === '1';
const RootApp = isMoneyMovementExperiment ? MoneyMovementsApp : App;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RootApp />
  </React.StrictMode>
);
