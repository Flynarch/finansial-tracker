import { AlertCircle } from 'lucide-react'
import { SUGGESTED_DOMAINS } from './authFormHelpers'

export function AuthDomainChips({ email, onApplyDomain, t, suggestedDomains = SUGGESTED_DOMAINS }) {
  if (!email || !email.trim() || suggestedDomains.some((d) => email.trim().toLowerCase().endsWith(d))) {
    return null
  }
  return (
    <div className="flex items-center gap-1.5 flex-wrap pt-0.5 animate-fadeIn">
      <span className="text-[9.5px] font-semibold text-[var(--muted)] shrink-0">
        {t('auth.quickDomainHint', 'Domain cepat:')}
      </span>
      {suggestedDomains.map((dom) => (
        <button
          key={dom}
          type="button"
          onClick={() => onApplyDomain(dom)}
          className="px-2 py-0.5 rounded-full border border-[var(--border)] bg-[var(--panel-strong)] text-[10px] font-bold text-[var(--accent)] hover:border-[var(--accent)] active:scale-95 transition-all cursor-pointer shadow-2xs"
        >
          {dom}
        </button>
      ))}
    </div>
  )
}

export function AuthGmailWarning({ isInvalid, t }) {
  if (!isInvalid) return null
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-medium text-rose-500/80 pt-0.5 animate-fadeIn">
      <AlertCircle className="h-3 w-3 shrink-0 text-rose-500/70" />
      <span>{t('auth.gmailOnlyWarning', 'Hanya mendukung @gmail.com atau @googlemail.com')}</span>
    </div>
  )
}
