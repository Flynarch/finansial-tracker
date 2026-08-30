function iconPath(icon) {
  switch (icon) {
    case 'food':
      return <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" strokeLinecap="round" strokeLinejoin="round" />
    case 'coffee':
      return <path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8zM6 1v3M10 1v3M14 1v3" strokeLinecap="round" strokeLinejoin="round" />
    case 'shopping':
      return <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" strokeLinecap="round" strokeLinejoin="round" />
    case 'people':
      return <path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a5 5 0 0 1 10 0M11 20a5 5 0 0 1 10 0" strokeLinecap="round" strokeLinejoin="round" />
    case 'transport':
      return <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9C2.1 11.2 2 11.6 2 12v4c0 .6.4 1 1 1h2M7 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" strokeLinecap="round" strokeLinejoin="round" />
    case 'car':
      return <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9C2.1 11.2 2 11.6 2 12v4c0 .6.4 1 1 1h2M7 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" strokeLinecap="round" strokeLinejoin="round" />
    case 'fuel':
      return <path d="M3 22h12M4 9h10M4 5h10a1 1 0 0 1 1 1v16H3V6a1 1 0 0 1 1-1zm14 8h.5a2 2 0 0 0 2-2V7.5a2 2 0 0 0-.6-1.4L18 4.2" strokeLinecap="round" strokeLinejoin="round" />
    case 'culture':
      return <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" strokeLinecap="round" strokeLinejoin="round" />
    case 'film':
      return <path d="M19.8 4H4.2A2.2 2.2 0 0 0 2 6.2v11.6A2.2 2.2 0 0 0 4.2 20h15.6a2.2 2.2 0 0 0 2.2-2.2V6.2A2.2 2.2 0 0 0 19.8 4zM7 4v16M17 4v16M2 12h20M2 8h5M2 16h5M17 8h5M17 16h5" strokeLinecap="round" strokeLinejoin="round" />
    case 'game':
      return <path d="M6 12h4M8 10v4M15 13h.01M18 11h.01M17.3 5H6.7A4.7 4.7 0 0 0 2 9.7v4.6A4.7 4.7 0 0 0 6.7 19h10.6a4.7 4.7 0 0 0 4.7-4.7V9.7A4.7 4.7 0 0 0 17.3 5z" strokeLinecap="round" strokeLinejoin="round" />
    case 'music':
      return <path d="M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm12 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" strokeLinecap="round" strokeLinejoin="round" />
    case 'home':
      return <path d="M4 11l8-6 8 6M6 10v9h12v-9M10 19v-5h4v5" strokeLinecap="round" strokeLinejoin="round" />
    case 'rent':
      return <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2M10 6h4M10 10h4M10 14h4M10 18h4" strokeLinecap="round" strokeLinejoin="round" />
    case 'zap':
      return <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" />
    case 'water':
      return <path d="M12 2.7l5.6 7a7 7 0 1 1-11.2 0z" strokeLinecap="round" strokeLinejoin="round" />
    case 'wifi':
      return <path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 20h.01" strokeLinecap="round" strokeLinejoin="round" />
    case 'phone':
      return <path d="M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm6 16h.01" strokeLinecap="round" strokeLinejoin="round" />
    case 'clothing':
      return <path d="M9 5l3 2 3-2 4 3-2 4h-2v7H9v-7H7L5 8z" strokeLinecap="round" strokeLinejoin="round" />
    case 'beauty':
      return <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" strokeLinecap="round" strokeLinejoin="round" />
    case 'education':
      return <path d="M3 8l9-4 9 4-9 4-9-4zM6 10v5c0 1 3 3 6 3s6-2 6-3v-5" strokeLinecap="round" strokeLinejoin="round" />
    case 'book':
      return <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15z" strokeLinecap="round" strokeLinejoin="round" />
    case 'health':
      return <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7ZM12 8v6M9 11h6" strokeLinecap="round" strokeLinejoin="round" />
    case 'gym':
      return <path d="M6.5 6.5h11M6.5 17.5h11M12 6.5v11M3 8.5v7M21 8.5v7M4.5 7.5v9M19.5 7.5v9" strokeLinecap="round" strokeLinejoin="round" />
    case 'investment':
      return <path d="M5 17l5-5 3 3 6-6M15 9h4v4" strokeLinecap="round" strokeLinejoin="round" />
    case 'crypto':
      return <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm-1 5h3a2 2 0 0 1 0 4h-3zm0 4h3.5a2 2 0 0 1 0 4H11zm-2-5h2m-2 4h2m-2 4h2M12 5v2m0 8v2" strokeLinecap="round" strokeLinejoin="round" />
    case 'gift':
      return <path d="M4 10h16v10H4zM12 10v10M4 14h16M8.5 10c-1.4 0-2.5-1-2.5-2.3C6 6.3 7.1 5.3 8.5 5.3c1.6 0 2.7 1 3.5 2.7.8-1.7 1.9-2.7 3.5-2.7 1.4 0 2.5 1 2.5 2.4 0 1.2-1.1 2.3-2.5 2.3" strokeLinecap="round" strokeLinejoin="round" />
    case 'pets':
      return <path d="M12 10a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm-6-2a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm12 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM9 5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm6 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" strokeLinecap="round" strokeLinejoin="round" />
    case 'baby':
      return <path d="M12 2a8 8 0 1 0 8 8 8 8 0 0 0-8-8zm-3 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm6 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm-5 4a4 4 0 0 0 4 0" strokeLinecap="round" strokeLinejoin="round" />
    case 'travel':
      return <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 20 2.5S18 3 16.5 4.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.3.5-.1 1.1.4 1.4L9 12l-2 3-2.5-.5c-.4-.1-.8.1-1 .4l-.3.4c-.2.4-.1.8.2 1.1l3 2.5 2.5 3c.3.3.7.4 1.1.2l.4-.3c.3-.2.5-.6.4-1L10 17l3-2 3.4 5.2c.3.5.9.7 1.4.4l.5-.3c.4-.2.6-.6.5-1.1z" strokeLinecap="round" strokeLinejoin="round" />
    case 'salary':
      return <path d="M2 6h20v12H2zM12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 12h.01M18 12h.01" strokeLinecap="round" strokeLinejoin="round" />
    case 'bonus':
      return <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.45 1-1 1H8c-.55 0-1 .45-1 1v1h10v-1c0-.55-.45-1-1-1h-1c-.55 0-1-.45-1-1v-2.34M7 4h10v6a5 5 0 0 1-10 0V4z" strokeLinecap="round" strokeLinejoin="round" />
    case 'cash':
      return <path d="M4 7h16v10H4zM9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0M6.5 9.5h.01M17.5 14.5h.01" strokeLinecap="round" strokeLinejoin="round" />
    case 'briefcase':
      return <path d="M4 7h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zm4 0V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M2 13h20M12 12v3" strokeLinecap="round" strokeLinejoin="round" />
    case 'wallet':
      return <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5zM16 12h4" strokeLinecap="round" strokeLinejoin="round" />
    case 'repayment':
      return <path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" strokeLinecap="round" strokeLinejoin="round" />
    case 'transfer':
      return <path d="m16 3 4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16" strokeLinecap="round" strokeLinejoin="round" />
    case 'shield':
      return <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    case 'tax':
      return <path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 3 2V2l-3 2-3-2-3 2-3-2-3 2-3-2zM9 9h6M9 13h6M9 17h4" strokeLinecap="round" strokeLinejoin="round" />
    case 'tools':
      return <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" strokeLinecap="round" strokeLinejoin="round" />
    case 'repeat':
      return <path d="M17 2l4 4-4 4M21 6H3M7 22l-4-4 4-4M3 18h18" strokeLinecap="round" strokeLinejoin="round" />
    case 'star':
      return <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" strokeLinecap="round" strokeLinejoin="round" />
    case 'heart':
      return <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" strokeLinecap="round" strokeLinejoin="round" />
    case 'other':
      return <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" strokeLinecap="round" strokeLinejoin="round" />
    case 'income':
      return <path d="M12 19V5M6 11l6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    case 'expense':
      return <path d="M12 5v14M6 13l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    case 'unknown':
      return <path d="M9.5 9a2.5 2.5 0 1 1 4 2c-.7.6-1.5 1.1-1.5 2M12 17h.01" strokeLinecap="round" strokeLinejoin="round" />
    default:
      return <circle cx="12" cy="12" r="4" />
  }
}

export default function CategoryIcon({ icon = 'expense', iconKey, className = '' }) {
  const targetIcon = iconKey || icon || 'expense'
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      {iconPath(targetIcon)}
    </svg>
  )
}
