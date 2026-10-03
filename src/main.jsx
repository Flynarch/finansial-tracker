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
    const err = event.reason
    if (
      err?.name === 'QuotaExceededError' ||
      err?.code === 22 ||
      String(err?.message || '').toLowerCase().includes('quota') ||
      String(err?.message || '').toLowerCase().includes('database space')
    ) {
      const isEn = typeof localStorage !== 'undefined' && localStorage.getItem('ft_locale') === 'en'
      window.dispatchEvent(
        new CustomEvent('ft-show-toast', {
          detail: {
            title: isEn ? 'Storage Full' : 'Penyimpanan Penuh',
            message: isEn
              ? 'Device storage is nearly full. Please clean up old files or transaction receipt photos.'
              : 'Memori penyimpanan perangkat hampir penuh. Bersihkan berkas atau foto bukti transaksi lama.',
            type: 'warning',
          },
        })
      )
    }
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
