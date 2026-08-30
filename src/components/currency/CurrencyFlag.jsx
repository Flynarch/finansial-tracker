import { getCurrencyInfo } from '../../data/currencies'

export default function CurrencyFlag({ code, size = 32, className = '' }) {
  const info = getCurrencyInfo(code)
  const flag = info.flag || 'un'
  const sizePx = typeof size === 'number' ? `${size}px` : size

  return (
    <div
      className={`relative shrink-0 select-none rounded-full overflow-hidden border border-[var(--border)] bg-[var(--field-bg)] flex items-center justify-center ${className}`}
      style={{ width: sizePx, height: sizePx, minWidth: sizePx, minHeight: sizePx }}
      title={info.country || code}
      aria-label={info.country || code}
    >
      {flag === 'id' && (
        <svg viewBox="0 0 32 32" className="w-full h-full">
          <rect width="32" height="16" fill="#E11D48" />
          <rect y="16" width="32" height="16" fill="#FFFFFF" />
        </svg>
      )}

      {flag === 'us' && (
        <svg viewBox="0 0 32 32" className="w-full h-full">
          <rect width="32" height="32" fill="#B91C1C" />
          <rect y="4" width="32" height="4" fill="#FFFFFF" />
          <rect y="12" width="32" height="4" fill="#FFFFFF" />
          <rect y="20" width="32" height="4" fill="#FFFFFF" />
          <rect y="28" width="32" height="4" fill="#FFFFFF" />
          <rect width="15" height="17" fill="#1D4ED8" />
          {/* Stars representation */}
          <circle cx="4" cy="4" r="1" fill="#FFFFFF" />
          <circle cx="8" cy="4" r="1" fill="#FFFFFF" />
          <circle cx="12" cy="4" r="1" fill="#FFFFFF" />
          <circle cx="6" cy="8" r="1" fill="#FFFFFF" />
          <circle cx="10" cy="8" r="1" fill="#FFFFFF" />
          <circle cx="4" cy="12" r="1" fill="#FFFFFF" />
          <circle cx="8" cy="12" r="1" fill="#FFFFFF" />
          <circle cx="12" cy="12" r="1" fill="#FFFFFF" />
        </svg>
      )}

      {flag === 'eu' && (
        <svg viewBox="0 0 32 32" className="w-full h-full">
          <rect width="32" height="32" fill="#1E40AF" />
          <circle cx="16" cy="6" r="1.2" fill="#FBBF24" />
          <circle cx="21" cy="7.5" r="1.2" fill="#FBBF24" />
          <circle cx="24.5" cy="11" r="1.2" fill="#FBBF24" />
          <circle cx="26" cy="16" r="1.2" fill="#FBBF24" />
          <circle cx="24.5" cy="21" r="1.2" fill="#FBBF24" />
          <circle cx="21" cy="24.5" r="1.2" fill="#FBBF24" />
          <circle cx="16" cy="26" r="1.2" fill="#FBBF24" />
          <circle cx="11" cy="24.5" r="1.2" fill="#FBBF24" />
          <circle cx="7.5" cy="21" r="1.2" fill="#FBBF24" />
          <circle cx="6" cy="16" r="1.2" fill="#FBBF24" />
          <circle cx="7.5" cy="11" r="1.2" fill="#FBBF24" />
          <circle cx="11" cy="7.5" r="1.2" fill="#FBBF24" />
        </svg>
      )}

      {flag === 'sg' && (
        <svg viewBox="0 0 32 32" className="w-full h-full">
          <rect width="32" height="16" fill="#EF4444" />
          <rect y="16" width="32" height="16" fill="#FFFFFF" />
          {/* Crescent */}
          <path
            d="M8,4 A6,6 0 1,0 8,12 A5,5 0 1,1 8,4 Z"
            fill="#FFFFFF"
          />
          {/* Stars */}
          <circle cx="10" cy="5.5" r="0.7" fill="#FFFFFF" />
          <circle cx="12" cy="7" r="0.7" fill="#FFFFFF" />
          <circle cx="11.5" cy="9.5" r="0.7" fill="#FFFFFF" />
          <circle cx="8.5" cy="9.5" r="0.7" fill="#FFFFFF" />
          <circle cx="8" cy="7" r="0.7" fill="#FFFFFF" />
        </svg>
      )}

      {flag === 'my' && (
        <svg viewBox="0 0 32 32" className="w-full h-full">
          <rect width="32" height="32" fill="#EF4444" />
          <rect y="3" width="32" height="3" fill="#FFFFFF" />
          <rect y="9" width="32" height="3" fill="#FFFFFF" />
          <rect y="15" width="32" height="3" fill="#FFFFFF" />
          <rect y="21" width="32" height="3" fill="#FFFFFF" />
          <rect y="27" width="32" height="3" fill="#FFFFFF" />
          <rect width="17" height="17" fill="#1E3A8A" />
          <path
            d="M7,5 A4.5,4.5 0 1,0 7,12 A3.8,3.8 0 1,1 7,5 Z"
            fill="#FBBF24"
          />
          <circle cx="10.5" cy="8.5" r="1.8" fill="#FBBF24" />
        </svg>
      )}

      {flag === 'jp' && (
        <svg viewBox="0 0 32 32" className="w-full h-full bg-white">
          <circle cx="16" cy="16" r="8" fill="#DC2626" />
        </svg>
      )}

      {flag === 'gb' && (
        <svg viewBox="0 0 32 32" className="w-full h-full">
          <rect width="32" height="32" fill="#1E3A8A" />
          {/* Diagonals */}
          <path d="M0,0 L32,32 M32,0 L0,32" stroke="#FFFFFF" strokeWidth="4.5" />
          <path d="M0,0 L32,32 M32,0 L0,32" stroke="#DC2626" strokeWidth="2.5" />
          {/* Main Cross */}
          <path d="M16,0 L16,32 M0,16 L32,16" stroke="#FFFFFF" strokeWidth="8" />
          <path d="M16,0 L16,32 M0,16 L32,16" stroke="#DC2626" strokeWidth="5" />
        </svg>
      )}

      {flag === 'au' && (
        <svg viewBox="0 0 32 32" className="w-full h-full">
          <rect width="32" height="32" fill="#0F172A" />
          <rect width="15" height="15" fill="#1E3A8A" />
          <path d="M0,0 L15,15 M15,0 L0,15" stroke="#FFFFFF" strokeWidth="2.5" />
          <path d="M0,0 L15,15 M15,0 L0,15" stroke="#DC2626" strokeWidth="1.2" />
          <path d="M7.5,0 L7.5,15 M0,7.5 L15,7.5" stroke="#FFFFFF" strokeWidth="4" />
          <path d="M7.5,0 L7.5,15 M0,7.5 L15,7.5" stroke="#DC2626" strokeWidth="2.5" />
          {/* Southern Cross stars */}
          <circle cx="24" cy="7" r="1" fill="#FFFFFF" />
          <circle cx="27" cy="12" r="1" fill="#FFFFFF" />
          <circle cx="22" cy="17" r="1" fill="#FFFFFF" />
          <circle cx="25" cy="22" r="1.4" fill="#FFFFFF" />
          <circle cx="27" cy="18" r="0.8" fill="#FFFFFF" />
          <circle cx="8" cy="24" r="1.8" fill="#FFFFFF" />
        </svg>
      )}

      {flag === 'sa' && (
        <svg viewBox="0 0 32 32" className="w-full h-full">
          <rect width="32" height="32" fill="#15803D" />
          <path d="M8,14 H24 M8,17 H24" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M10,21 L22,21 M9,21 L12,23" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      )}

      {flag === 'cn' && (
        <svg viewBox="0 0 32 32" className="w-full h-full">
          <rect width="32" height="32" fill="#DC2626" />
          <polygon points="7,5 8.5,9.5 4,6.8 10,6.8 5.5,9.5" fill="#FBBF24" />
          <circle cx="12" cy="4" r="0.8" fill="#FBBF24" />
          <circle cx="14" cy="6" r="0.8" fill="#FBBF24" />
          <circle cx="14" cy="9" r="0.8" fill="#FBBF24" />
          <circle cx="12" cy="11" r="0.8" fill="#FBBF24" />
        </svg>
      )}

      {flag === 'kr' && (
        <svg viewBox="0 0 32 32" className="w-full h-full bg-white">
          <circle cx="16" cy="16" r="7" fill="#DC2626" />
          <path d="M16,9 A7,7 0 0,0 16,23 A3.5,3.5 0 0,0 16,16 A3.5,3.5 0 0,1 16,9 Z" fill="#2563EB" />
          {/* Trigrams */}
          <rect x="5" y="6" width="3" height="1" fill="#000000" />
          <rect x="5" y="8" width="3" height="1" fill="#000000" />
          <rect x="24" y="6" width="3" height="1" fill="#000000" />
          <rect x="24" y="8" width="3" height="1" fill="#000000" />
        </svg>
      )}

      {flag === 'ch' && (
        <svg viewBox="0 0 32 32" className="w-full h-full">
          <rect width="32" height="32" fill="#DC2626" />
          <rect x="13" y="7" width="6" height="18" fill="#FFFFFF" rx="1" />
          <rect x="7" y="13" width="18" height="6" fill="#FFFFFF" rx="1" />
        </svg>
      )}

      {flag === 'ca' && (
        <svg viewBox="0 0 32 32" className="w-full h-full">
          <rect width="8" height="32" fill="#DC2626" />
          <rect x="8" width="16" height="32" fill="#FFFFFF" />
          <rect x="24" width="8" height="32" fill="#DC2626" />
          {/* Maple leaf representation */}
          <path
            d="M16,8 L17.5,12.5 L20.5,11.5 L19.5,14.5 L22.5,16.5 L19,17.5 L17.5,21 L16,20 L14.5,21 L13,17.5 L9.5,16.5 L12.5,14.5 L11.5,11.5 L14.5,12.5 Z"
            fill="#DC2626"
          />
        </svg>
      )}

      {flag === 'th' && (
        <svg viewBox="0 0 32 32" className="w-full h-full">
          <rect width="32" height="5.5" fill="#DC2626" />
          <rect y="5.5" width="32" height="5.5" fill="#FFFFFF" />
          <rect y="11" width="32" height="10" fill="#1E3A8A" />
          <rect y="21" width="32" height="5.5" fill="#FFFFFF" />
          <rect y="26.5" width="32" height="5.5" fill="#DC2626" />
        </svg>
      )}

      {flag === 'vn' && (
        <svg viewBox="0 0 32 32" className="w-full h-full">
          <rect width="32" height="32" fill="#DC2626" />
          <polygon points="16,8 18.5,15 25.5,15 20,19 22,26 16,21.5 10,26 12,19 6.5,15 13.5,15" fill="#FBBF24" />
        </svg>
      )}

      {flag === 'ph' && (
        <svg viewBox="0 0 32 32" className="w-full h-full">
          <rect width="32" height="16" fill="#1D4ED8" />
          <rect y="16" width="32" height="16" fill="#DC2626" />
          <polygon points="0,0 15,16 0,32" fill="#FFFFFF" />
          <circle cx="5" cy="16" r="2.5" fill="#FBBF24" />
        </svg>
      )}

      {flag === 'hk' && (
        <svg viewBox="0 0 32 32" className="w-full h-full">
          <rect width="32" height="32" fill="#DC2626" />
          <circle cx="16" cy="16" r="6" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeDasharray="3 2" />
          <circle cx="16" cy="16" r="2" fill="#FFFFFF" />
        </svg>
      )}

      {flag === 'ae' && (
        <svg viewBox="0 0 32 32" className="w-full h-full">
          <rect width="32" height="10.5" fill="#15803D" />
          <rect y="10.5" width="32" height="11" fill="#FFFFFF" />
          <rect y="21.5" width="32" height="10.5" fill="#000000" />
          <rect width="9" height="32" fill="#DC2626" />
        </svg>
      )}

      {flag === 'in' && (
        <svg viewBox="0 0 32 32" className="w-full h-full">
          <rect width="32" height="10.5" fill="#EA580C" />
          <rect y="10.5" width="32" height="11" fill="#FFFFFF" />
          <rect y="21.5" width="32" height="10.5" fill="#15803D" />
          <circle cx="16" cy="16" r="3.5" fill="none" stroke="#1E3A8A" strokeWidth="1.2" />
        </svg>
      )}

      {flag === 'br' && (
        <svg viewBox="0 0 32 32" className="w-full h-full">
          <rect width="32" height="32" fill="#15803D" />
          <polygon points="16,4 29,16 16,28 3,16" fill="#FBBF24" />
          <circle cx="16" cy="16" r="6" fill="#1E3A8A" />
          <path d="M11,15 Q16,13 21,17" stroke="#FFFFFF" strokeWidth="1.2" fill="none" />
        </svg>
      )}

      {!['id', 'us', 'eu', 'sg', 'my', 'jp', 'gb', 'au', 'sa', 'cn', 'kr', 'ch', 'ca', 'th', 'vn', 'ph', 'hk', 'ae', 'in', 'br'].includes(flag) && (
        <span className="font-black text-[11px] text-[var(--fg)] tracking-wider">
          {code?.substring(0, 2).toUpperCase() || 'FX'}
        </span>
      )}
    </div>
  )
}
