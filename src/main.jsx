import './initTheme'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { initFirebaseAnalytics } from './lib/firebase'
import { initGlobalAutocorrect } from './lib/keyboardAutocorrect'

if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    console.warn('Unhandled promise rejection:', event.reason)
    if (typeof event.preventDefault === 'function') event.preventDefault()
  })
  window.addEventListener('error', (event) => {
    console.warn('Global error caught:', event.error || event.message)
  })
  initGlobalAutocorrect()
}

void initFirebaseAnalytics()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
