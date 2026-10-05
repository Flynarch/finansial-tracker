import { Mail, Send, Loader2 } from 'lucide-react'
import {
  getInputClasses,
  SUGGESTED_DOMAINS,
} from './authFormHelpers'
import { AuthDomainChips, AuthGmailWarning } from './AuthDomainChips'

export default function AuthForgotPasswordForm({
  email,
  setEmail,
  isLoading,
  isEmailError,
  isEmailDomainInvalid,
  handleForgotPassword,
  handleApplyDomain,
  switchMode,
  t,
  clearErrorMessage,
}) {
  return (
    <form onSubmit={handleForgotPassword} className="space-y-4">
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
        <span>{t('auth.sendResetLink', 'Kirim Tautan Reset Sandi')}</span>
      </button>

      <div className="text-center">
        <button
          type="button"
          onClick={() => switchMode('login')}
          className="text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)] transition-colors cursor-pointer"
        >
          {t('auth.backToSignIn', 'Kembali ke Halaman Masuk')}
        </button>
      </div>
    </form>
  )
}
