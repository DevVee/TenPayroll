import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Initialise demo data on first run
import { seedIfNeeded } from './lib/db'
seedIfNeeded()

// Restore auth session from localStorage
import { useAuthStore } from './store/authStore'
useAuthStore.getState().restoreSession()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
