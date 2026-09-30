import { useState, useEffect, useCallback } from 'react'
import {
  Fingerprint,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Smartphone,
  ShieldCheck,
  Loader2,
} from 'lucide-react'
import Modal from '../ui/Modal'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'
import { triggerHaptic } from '../../lib/haptics'
import {
  isPasskeySupported,
  getStoredPasskeys,
  registerPasskey,
  deletePasskey,
} from '../../lib/passkeys'
import { format } from 'date-fns'
import useBackButton from '../../hooks/useBackButton'

export default function PasskeysManagerModal({ isOpen, onClose }) {
  const { t } = useTranslation()
  const authUserEmail = useSettingsStore((s) => s.authUserEmail || 'user@fintrack.app')

  const [isSupported, setIsSupported] = useState(false)
  const [passkeys, setPasskeys] = useState([])
  const [isRegistering, setIsRegistering] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const [newDeviceName, setNewDeviceName] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)

  useBackButton(() => {
    setShowAddForm(false)
    setNewDeviceName('')
    setError('')
  }, isOpen && showAddForm)

  const reloadPasskeys = useCallback(() => {
    setPasskeys(getStoredPasskeys())
  }, [])

  useEffect(() => {
    let isMounted = true
    if (isOpen) {
      isPasskeySupported().then((sup) => {
        if (isMounted) {
          setIsSupported(sup)
          setPasskeys(getStoredPasskeys())
          setFeedback('')
          setError('')
          setShowAddForm(false)
          setNewDeviceName('')
        }
      })
    }
    return () => {
      isMounted = false
    }
  }, [isOpen])

  const handleRegisterNewPasskey = async () => {
    triggerHaptic('light')
    setIsRegistering(true)
    setError('')
    setFeedback('')

    try {
      const name = newDeviceName.trim() || 'Perangkat Ini'
      await registerPasskey(name, authUserEmail)
      triggerHaptic('success')
      setFeedback(t('passkeys.registerSuccess', 'Passkey biometrik baru berhasil didaftarkan!'))
      reloadPasskeys()
      setShowAddForm(false)
      setNewDeviceName('')
    } catch (err) {
      console.error('Registration failed:', err)
      setError(err.message || t('passkeys.registerFailed', 'Gagal mendaftarkan Passkey.'))
    } finally {
      setIsRegistering(false)
    }
  }

  const handleDelete = (id) => {
    triggerHaptic('warning')
    deletePasskey(id)
    reloadPasskeys()
    setFeedback(t('passkeys.deleteSuccess', 'Passkey berhasil dihapus.'))
    setTimeout(() => setFeedback(''), 2500)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('passkeys.modalTitle', 'Manajemen Passkeys (FIDO2)')}
      maxWidth="max-w-md"
      showCloseButton={true}
    >
      <div className="space-y-4">
        {/* Header Hero */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 text-center space-y-2">
          <div className="h-12 w-12 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center mx-auto mb-1">
            <Fingerprint className="h-6 w-6" />
          </div>
          <h4 className="text-sm font-black text-[var(--fg)]">
            {t('passkeys.heading', 'Login Bebas Sandi dengan Biometrik')}
          </h4>
          <p className="text-xs text-[var(--muted)] leading-relaxed max-w-xs mx-auto">
            {t(
              'passkeys.subheading',
              'Gunakan sidik jari, pengenalan wajah, atau kunci keamanan perangkat (FIDO2 / WebAuthn) untuk login instan.'
            )}
          </p>
          <div className="pt-1 flex items-center justify-center gap-1.5">
            <span
              className={`h-2 w-2 rounded-full ${
                isSupported ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            <span className="text-[11px] font-bold text-[var(--muted)]">
              {isSupported
                ? t('passkeys.platformSupported', 'Biometrik Platform Didukung')
                : t('passkeys.platformLimited', 'Platform WebAuthn Terbatas')}
            </span>
          </div>
        </div>

        {/* Feedback / Error notifications */}
        {feedback && (
          <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs font-bold text-rose-500 flex items-center gap-2 animate-fadeIn">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Registered Devices List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-[var(--muted)]">
              {t('passkeys.registeredList', 'Passkey Terdaftar ({{count}})', { count: passkeys.length })}
            </span>
          </div>

          {passkeys.length === 0 ? (
            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--field-bg)]/40 text-center">
              <p className="text-xs font-bold text-[var(--muted)]">
                {t('passkeys.emptyList', 'Belum ada Passkey biometrik yang didaftarkan.')}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {passkeys.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] gap-2"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
                      <Smartphone className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0">
                      <h5 className="text-xs font-extrabold text-[var(--fg)] truncate">
                        {p.deviceName}
                      </h5>
                      <span className="text-[10px] text-[var(--muted)] block mt-0.5">
                        {p.createdAt ? format(new Date(p.createdAt), 'dd MMM yyyy, HH:mm') : ''}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDelete(p.id)}
                    className="p-2 rounded-lg text-rose-500 hover:bg-rose-500/10 transition active:scale-95 cursor-pointer shrink-0"
                    title={t('common.delete', 'Hapus')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Passkey Form / Trigger */}
        {showAddForm ? (
          <div className="p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] space-y-3 animate-fadeIn">
            <div>
              <label className="block text-xs font-bold text-[var(--fg)] mb-1">
                {t('passkeys.deviceNameLabel', 'Nama Perangkat')}
              </label>
              <input
                type="text"
                value={newDeviceName}
                onChange={(e) => setNewDeviceName(e.target.value)}
                placeholder={t('passkeys.deviceNamePlaceholder', 'Contoh: HP Pribadi / Laptop Kerja')}
                className="ft-field w-full text-xs font-bold py-2 px-3 rounded-xl bg-[var(--panel)] border border-[var(--border)]"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="h-10 px-3.5 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] text-xs font-bold text-[var(--fg)] hover:bg-[var(--panel)] cursor-pointer"
              >
                {t('common.cancel', 'Batal')}
              </button>
              <button
                type="button"
                onClick={handleRegisterNewPasskey}
                disabled={isRegistering}
                className="flex-1 h-10 rounded-xl bg-[var(--fg)] text-[var(--bg)] font-black text-xs transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                {isRegistering ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
                <span>{t('passkeys.triggerBiometric', 'Pindai Sidik Jari / Kunci')}</span>
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="w-full h-11 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] hover:bg-[var(--panel)] text-xs font-extrabold text-[var(--fg)] flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
          >
            <Plus className="h-4 w-4 text-[var(--accent)]" />
            <span>{t('passkeys.addPasskeyBtn', 'Daftarkan Passkey Baru')}</span>
          </button>
        )}
      </div>
    </Modal>
  )
}
