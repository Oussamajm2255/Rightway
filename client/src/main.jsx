import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/index.css';
import './lib/RightWayLoader';

// Show the premium loader immediately — before React even mounts.
// It will be hidden by App.jsx once auth & initial data are ready.
window.RightWayLoader.show();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
