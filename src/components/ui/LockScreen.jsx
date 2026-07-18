import { useMemo, useState } from 'react'
import { authenticateBiometric, canUseBiometric } from '../../lib/biometric'
import Button from './Button'
import PatternPad from './PatternPad'

function LockScreen({ method, secret, onUnlock }) {
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [isAuthenticating, setIsAuthenticating] = useState(false)

  const methodLabel = useMemo(() => {
    if (method === 'pattern') return 'Pattern'
    if (method === 'biometric') return 'Biometric'
    return 'PIN'
  }, [method])

  const handleUnlock = () => {
    if (method === 'biometric') {
      onUnlock()
      return
    }
    if (input === secret) {
      onUnlock()
      return
    }
    setError(`${methodLabel} salah, coba lagi.`)
  }

  const handleBiometricUnlock = async () => {
    setIsAuthenticating(true)
    const available = await canUseBiometric()
    if (!available) {
      setError('Biometric tidak tersedia di device ini.')
      setIsAuthenticating(false)
      return
    }
    const success = await authenticateBiometric()
    setIsAuthenticating(false)
    if (success) {
      onUnlock()
      return
    }
    setError('Autentikasi biometric gagal.')
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--bg)]/95 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] p-5 shadow-[var(--shadow-card)]">
        <h2 className="text-lg font-semibold text-[var(--fg)]">FinTrack Locked</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Masukkan {methodLabel} untuk membuka aplikasi.
        </p>

        {method === 'biometric' ? (
          <Button type="button" className="mt-4 w-full" onClick={handleBiometricUnlock}>
            {isAuthenticating ? 'Authenticating...' : 'Unlock with Biometric'}
          </Button>
        ) : method === 'pattern' ? (
          <div className="mt-4">
            <PatternPad value={input} onChange={setInput} />
            <Button type="button" className="mt-2 w-full" onClick={handleUnlock}>
              Unlock
            </Button>
          </div>
        ) : (
          <div className="mt-4">
            <input
              type="password"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={method === 'pattern' ? 'Contoh: 1-2-3-6' : 'Masukkan PIN'}
              className="w-full rounded-lg border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-[var(--fg)]"
            />
            <Button type="button" className="mt-2 w-full" onClick={handleUnlock}>
              Unlock
            </Button>
          </div>
        )}

        {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
      </div>
    </div>
  )
}

export default LockScreen
