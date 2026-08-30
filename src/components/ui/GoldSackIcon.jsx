import { useId } from 'react'

export default function GoldSackIcon({ size = 32, className = '' }) {
  const rawId = useId()
  const uid = rawId.replace(/:/g, '')

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        {/* Main Sack Gold Gradient */}
        <linearGradient id={`goldSackBody-${uid}`} x1="12" y1="20" x2="52" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FCD34D" />
          <stop offset="45%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#B45309" />
        </linearGradient>
        {/* Top Fold Gradient */}
        <linearGradient id={`goldSackTop-${uid}`} x1="20" y1="8" x2="44" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
        {/* Rope Red Gradient */}
        <linearGradient id={`ropeGrad-${uid}`} x1="20" y1="20" x2="44" y2="25" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#EF4444" />
          <stop offset="100%" stopColor="#991B1B" />
        </linearGradient>
        {/* Shiny Coin Gradient */}
        <linearGradient id={`goldCoinGrad-${uid}`} x1="26" y1="32" x2="38" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFBEB" />
          <stop offset="50%" stopColor="#FBBF24" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
        {/* Drop Shadow */}
        <filter id={`sackShadow-${uid}`} x="4" y="8" width="56" height="52" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#78350F" floodOpacity="0.3" />
        </filter>
      </defs>

      <g filter={`url(#sackShadow-${uid})`}>
        {/* Top Ruffled Opening */}
        <path
          d="M22 14C20 10 18 8 24 8C27 8 29 11 32 11C35 11 37 8 40 8C46 8 44 10 42 14C40 18 24 18 22 14Z"
          fill={`url(#goldSackTop-${uid})`}
          stroke="#92400E"
          strokeWidth="1.5"
        />

        {/* Tied Rope */}
        <rect x="20" y="19" width="24" height="5" rx="2.5" fill={`url(#ropeGrad-${uid})`} stroke="#7F1D1D" strokeWidth="1" />
        <path d="M25 24L22 30M28 24L27 31" stroke="#991B1B" strokeWidth="2" strokeLinecap="round" />

        {/* Main Gold Sack Body */}
        <path
          d="M21 23C15 26 10 33 10 42C10 52 18 58 32 58C46 58 54 52 54 42C54 33 49 26 43 23C38 25 26 25 21 23Z"
          fill={`url(#goldSackBody-${uid})`}
          stroke="#78350F"
          strokeWidth="1.75"
        />

        {/* Dollar/Currency Symbol Badge */}
        <circle cx="32" cy="40" r="10" fill={`url(#goldCoinGrad-${uid})`} stroke="#B45309" strokeWidth="1.5" />
        <text
          x="32"
          y="45"
          textAnchor="middle"
          fontSize="14"
          fontWeight="900"
          fill="#78350F"
          fontFamily="sans-serif"
        >
          $
        </text>

        {/* Shine Highlights */}
        <path d="M16 38C15 42 16 48 20 52" stroke="#FEF3C7" strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
      </g>
    </svg>
  )
}
