import { memo } from 'react'
import { User } from 'lucide-react'
import useSettingsStore from '../../store/useSettingsStore'

const SIZE_MAP = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-7 w-7 text-xs',
  md: 'h-9.5 w-9.5 text-xs',
  lg: 'h-12 w-12 text-base',
  xl: 'h-22 w-22 text-2xl',
  '2xl': 'h-28 w-28 text-3xl',
}

function getProfileInitials(name) {
  const clean = String(name || '').trim()
  if (!clean) return ''
  const parts = clean.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return clean.slice(0, 2).toUpperCase()
}

const UserAvatar = memo(function UserAvatar({
  name,
  photo,
  size = 'md',
  shape = 'circle',
  showOnlineIndicator = false,
  className = '',
  style = {},
  border = true,
  onClick,
  ...props
}) {
  const storeName = useSettingsStore((s) => s.profileName)
  const storePhoto = useSettingsStore((s) => s.profilePhoto)

  const finalName = name !== undefined ? name : storeName
  const finalPhoto = photo !== undefined ? photo : storePhoto
  const initials = getProfileInitials(finalName)

  const sizeClasses = typeof size === 'string' && SIZE_MAP[size] ? SIZE_MAP[size] : SIZE_MAP.md
  const isCircle = shape === 'circle'
  const shapeClasses = isCircle ? 'rounded-full' : 'rounded-2xl'

  const customDimensions =
    typeof size === 'number'
      ? { width: `${size}px`, height: `${size}px`, minWidth: `${size}px`, minHeight: `${size}px`, fontSize: `${Math.max(10, Math.floor(size * 0.35))}px` }
      : {}

  return (
    <div
      className={`relative shrink-0 select-none ${sizeClasses} ${className}`}
      style={{ ...customDimensions, ...style }}
      onClick={onClick}
      {...props}
    >
      <div
        className={`w-full h-full flex items-center justify-center font-black tracking-wider overflow-hidden transition-all duration-200 ${shapeClasses} ${
          border ? 'border-[0.5px] border-[var(--wallet-logo-border,var(--border))] shadow-2xs' : ''
        }`}
        style={
          finalPhoto
            ? { backgroundColor: 'var(--panel-strong)' }
            : {
                background: 'linear-gradient(135deg, var(--fg) 0%, color-mix(in srgb, var(--fg) 80%, var(--accent)) 100%)',
                color: 'var(--bg)',
              }
        }
      >
        {finalPhoto ? (
          <img
            src={finalPhoto}
            alt={finalName || 'User profile'}
            className={`w-full h-full object-cover ${shapeClasses}`}
            onError={(e) => {
              e.target.style.display = 'none'
              if (e.target.nextSibling) {
                e.target.nextSibling.style.display = 'flex'
              }
            }}
          />
        ) : null}

        <div
          className="w-full h-full flex items-center justify-center font-black"
          style={{ display: finalPhoto ? 'none' : 'flex' }}
        >
          {initials || <User className="w-1/2 h-1/2 opacity-80" strokeWidth={2.2} />}
        </div>
      </div>

      {showOnlineIndicator && (
        <span
          className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-[var(--bg)] shadow-xs"
          aria-hidden="true"
        />
      )}
    </div>
  )
})

export default UserAvatar
