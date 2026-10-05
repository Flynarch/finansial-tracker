import { User, Mail, Lock, KeyRound, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react'
import {
  getInputClasses,
  getPasswordInputClasses,
  SUGGESTED_DOMAINS,
} from './authFormHelpers'
import { AuthDomainChips, AuthGmailWarning } from './AuthDomainChips'

export default function AuthRegisterForm({
  name,
  setName,
  email,
  setEmail,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  showPassword,
  setShowPassword,
  showConfirmPassword,
  setShowConfirmPassword,
  sendVerification,
  setSendVerification,
  isLoading,
  passwordScore,
  isEmailError,
  isPasswordError,
  isConfirmPasswordError,
  isEmailDomainInvalid,
  handleRegister,
  handleGoogleAuth,
  handleApplyDomain,
  switchMode,
  t,
  clearErrorMessage,
}) {
  return (
    <div className="space-y-2.5">
      <form onSubmit={handleRegister} className="space-y-2">
        <div className="space-y-0.5">
          <label className="text-[11px] font-bold text-[var(--muted)]">
            {t('auth.nameLabel', 'Nama Lengkap')}
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--muted)]" />
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                clearErrorMessage?.()
              }}
              placeholder={t('auth.placeholder.name', 'Contoh: Budi Santoso')}
              className={getInputClasses(false)}
            />
          </div>
        </div>

        <div className="space-y-0.5">
          <label
            className={`text-[11px] font-bold block transition-colors ${
              isEmailError ? 'text-rose-500 dark:text-rose-400' : 'text-[var(--muted)]'
            }`}
          >
            {t('auth.emailLabel', 'Alamat Email')}
          </label>
          <div className="relative">
            <Mail
              className={`absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 transition-colors ${
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
              className={getInputClasses(isEmailError)}
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

        <div className="space-y-0.5">
          <label
            className={`text-[11px] font-bold transition-colors ${
              isPasswordError ? 'text-rose-500 dark:text-rose-400' : 'text-[var(--muted)]'
            }`}
          >
            {t('auth.passwordMinLabel', 'Kata Sandi (Min. 6 Karakter)')}
          </label>
          <div className="relative">
            <Lock
              className={`absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 transition-colors ${
                isPasswordError ? 'text-rose-500' : 'text-[var(--muted)]'
              }`}
            />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                clearErrorMessage?.()
              }}
              placeholder={t('auth.placeholder.passwordMin', 'Minimal 6 karakter')}
              className={getPasswordInputClasses(isPasswordError)}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--fg)] cursor-pointer"
              aria-label={
                showPassword
                  ? t('auth.hidePassword', 'Sembunyikan Sandi')
                  : t('auth.showPassword', 'Lihat Sandi')
              }
            >
              {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>

          {/* Password Strength Meter */}
          {password && (
            <div className="pt-0.5 space-y-0.5">
              <div className="flex gap-1 h-1">
                {[1, 2, 3, 4].map((step) => (
                  <div
                    key={step}
                    className={`flex-1 rounded-full transition-all duration-300 ${
                      passwordScore >= step
                        ? step <= 2
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                        : 'bg-[var(--border)]'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {password.length > 0 && password.length < 6 && (
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-rose-500 pt-0.5 animate-fadeIn">
              <AlertCircle className="h-3 w-3 shrink-0" />
              <span>{t('auth.passwordTooShort', 'Kata sandi minimal 6 karakter.')}</span>
            </div>
          )}
        </div>

        <div className="space-y-0.5">
          <label
            className={`text-[11px] font-bold transition-colors ${
              isConfirmPasswordError ? 'text-rose-500 dark:text-rose-400' : 'text-[var(--muted)]'
            }`}
          >
            {t('auth.confirmPasswordLabel', 'Konfirmasi Kata Sandi')}
          </label>
          <div className="relative">
            <KeyRound
              className={`absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 transition-colors ${
                isConfirmPasswordError ? 'text-rose-500' : 'text-[var(--muted)]'
              }`}
            />
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              required
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value)
                clearErrorMessage?.()
              }}
              placeholder={t('auth.placeholder.confirmPassword', 'Ulangi kata sandi')}
              className={getPasswordInputClasses(isConfirmPasswordError)}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--fg)] cursor-pointer"
              aria-label={
                showConfirmPassword
                  ? t('auth.hidePassword', 'Sembunyikan Sandi')
                  : t('auth.showPassword', 'Lihat Sandi')
              }
            >
              {showConfirmPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>

          {confirmPassword.length > 0 && confirmPassword !== password && (
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-rose-500 pt-0.5 animate-fadeIn">
              <AlertCircle className="h-3 w-3 shrink-0" />
              <span>{t('auth.passwordMismatch', 'Konfirmasi kata sandi tidak cocok.')}</span>
            </div>
          )}
        </div>

        {/* Email Verification Checkbox */}
        <label className="flex items-center gap-2 pt-0.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={sendVerification}
            onChange={(e) => setSendVerification(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
          />
          <span className="text-[10.5px] font-semibold text-[var(--muted)]">
            {t('auth.sendVerificationOption', 'Kirim email verifikasi setelah pendaftaran')}
          </span>
        </label>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] text-[var(--bg)] py-2.5 px-4 text-xs font-black shadow-xs active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 mt-0.5"
        >
          {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <User className="h-3.5 w-3.5" />}
          <span>{t('auth.signUpBtn', 'Bikin Akun Baru')}</span>
        </button>
      </form>

      {/* Clean Minimal Prompt: Switch to Login */}
      <div className="text-center text-xs text-[var(--muted)] font-medium pt-0.5">
        <span>{t('auth.haveAccountPrompt', 'Sudah punya akun?')} </span>
        <button
          type="button"
          onClick={() => switchMode('login')}
          className="font-black text-[var(--accent)] hover:underline active:scale-95 transition-transform cursor-pointer"
        >
          {t('auth.signInPrompt', 'Masuk di Sini')}
        </button>
      </div>

      {/* Subtle Divider */}
      <div className="flex items-center gap-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[var(--muted)]/50">
        <div className="flex-1 border-t border-[var(--border)]/40" />
        <span>{t('auth.orOtherOptions', 'atau opsi lainnya')}</span>
        <div className="flex-1 border-t border-[var(--border)]/40" />
      </div>

      {/* Quick Google Sign-Up Button */}
      <button
        type="button"
        onClick={handleGoogleAuth}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] py-2.5 px-3 text-xs font-bold text-[var(--fg)] hover:bg-[var(--panel-strong)] hover:border-[var(--border-strong)] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
      >
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            fill="#EA4335"
          />
        </svg>
        <span>{t('auth.quickGoogleSignUp', 'Daftar Cepat dengan Google')}</span>
      </button>
    </div>
  )
}
