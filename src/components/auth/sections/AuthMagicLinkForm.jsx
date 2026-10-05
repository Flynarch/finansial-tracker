import { Sparkles, Mail, Send, Loader2 } from 'lucide-react'
import {
  getInputClasses,
  SUGGESTED_DOMAINS,
} from './authFormHelpers'
import { AuthDomainChips, AuthGmailWarning } from './AuthDomainChips'

export default function AuthMagicLinkForm({
  email,
  setEmail,
  isLoading,
  isEmailError,
  isEmailDomainInvalid,
  handleMagicLink,
  handleApplyDomain,
  switchMode,
  t,
  clearErrorMessage,
}) {
  return (
    <form onSubmit={handleMagicLink} className="space-y-4">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-3.5 space-y-1.5">
        <div className="flex items-center gap-2 text-xs font-bold text-[var(--fg)]">
          <Sparkles className="h-4 w-4 text-[var(--accent)] shrink-0" />
          <span>{t('auth.magicLinkHowItWorks', 'Cara Kerja Magic Link:')}</span>
        </div>
        <p className="text-[11px] text-[var(--muted)] leading-relaxed">
          {t(
            'auth.magicLinkInstruction',
            'Masukkan email Gmail Anda, buka email di perangkat ini, dan klik tautan masuk. Anda akan langsung masuk ke FinTrack secara otomatis tanpa perlu mengingat kata sandi.'
          )}
        </p>
      </div>

      <div className="space-y-1">
        <label
          className={`text-[11px] font-bold block transition-colors ${
            isEmailError ? 'text-rose-500 dark:text-rose-400' : 'text-[var(--muted)]'
          }`}
        >
          {t('auth.emailLabel', 'Alamat Email')}
        </label>
        <div className="relative">
          <Mail
            className={`absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors ${
              isEmailError ? 'text-rose-500' : 'text-[var(--muted)]'
            }`}
          />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              clearErrorMessage?.()
            }}
            placeholder={t('auth.emailPlaceholder', 'nama@gmail.com')}
            className={getInputClasses(isEmailError, true)}
          />
        </div>

        <AuthDomainChips
          email={email}
          onApplyDomain={handleApplyDomain}
          t={t}
          suggestedDomains={SUGGESTED_DOMAINS}
        />

        <AuthGmailWarning isInvalid={isEmailDomainInvalid} t={t} />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] text-[var(--bg)] py-3 px-4 text-xs font-extrabold shadow-sm active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        <span>{t('auth.sendMagicLinkBtn', 'Kirim Tautan Masuk Ajaib')}</span>
      </button>

      <div className="text-center">
        <button
          type="button"
          onClick={() => switchMode('login')}
          className="text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)] transition-colors cursor-pointer"
        >
          {t('auth.usePasswordInstead', 'Masuk dengan Kata Sandi Biasa')}
        </button>
      </div>
    </form>
  )
}
