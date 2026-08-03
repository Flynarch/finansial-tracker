function iconPath(icon) {
  switch (icon) {
    case 'food':
      return <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" strokeLinecap="round" strokeLinejoin="round" />
    case 'people':
      return <path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a5 5 0 0 1 10 0M11 20a5 5 0 0 1 10 0" strokeLinecap="round" strokeLinejoin="round" />
    case 'transport':
      return <path d="M4 14l1.5-5A3 3 0 0 1 8.4 7h7.2a3 3 0 0 1 2.9 2l1.5 5M5 14h14v4H5zM7.5 18h.01M16.5 18h.01" strokeLinecap="round" strokeLinejoin="round" />
    case 'culture':
      return <path d="M4 6h16v12H4zM8 10l2.5 3 2-2 3.5 4" strokeLinecap="round" strokeLinejoin="round" />
    case 'home':
      return <path d="M4 11l8-6 8 6M6 10v9h12v-9M10 19v-5h4v5" strokeLinecap="round" strokeLinejoin="round" />
    case 'clothing':
      return <path d="M9 5l3 2 3-2 4 3-2 4h-2v7H9v-7H7L5 8z" strokeLinecap="round" strokeLinejoin="round" />
    case 'beauty':
      return <path d="M8 5h8l-1 4H9zM10 9v10h4V9M8 19h8" strokeLinecap="round" strokeLinejoin="round" />
    case 'education':
      return <path d="M3 8l9-4 9 4-9 4-9-4zM6 10v5c0 1 3 3 6 3s6-2 6-3v-5" strokeLinecap="round" strokeLinejoin="round" />
    case 'health':
      return <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    case 'investment':
      return <path d="M5 17l5-5 3 3 6-6M15 9h4v4" strokeLinecap="round" strokeLinejoin="round" />
    case 'gift':
      return <path d="M4 10h16v10H4zM12 10v10M4 14h16M8.5 10c-1.4 0-2.5-1-2.5-2.3C6 6.3 7.1 5.3 8.5 5.3c1.6 0 2.7 1 3.5 2.7.8-1.7 1.9-2.7 3.5-2.7 1.4 0 2.5 1 2.5 2.4 0 1.2-1.1 2.3-2.5 2.3" strokeLinecap="round" strokeLinejoin="round" />
    case 'unknown':
      return <path d="M9.5 9a2.5 2.5 0 1 1 4 2c-.7.6-1.5 1.1-1.5 2M12 17h.01" strokeLinecap="round" strokeLinejoin="round" />
    case 'wallet':
      return <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5zM13 12h7" strokeLinecap="round" strokeLinejoin="round" />
    case 'salary':
      return <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" strokeLinecap="round" strokeLinejoin="round" />
    case 'cash':
      return <path d="M4 7h16v10H4zM9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0M6.5 9.5h.01M17.5 14.5h.01" strokeLinecap="round" strokeLinejoin="round" />
    case 'bonus':
      return <path d="M12 4l2.2 4.5 5 .7-3.6 3.5.8 5-4.4-2.3-4.4 2.3.8-5L5 9.2l5-.7z" strokeLinecap="round" strokeLinejoin="round" />
    case 'repayment':
      return <path d="M20 12H8M12 8l-4 4 4 4M4 5v14" strokeLinecap="round" strokeLinejoin="round" />
    case 'income':
      return <path d="M12 19V5M6 11l6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    case 'expense':
      return <path d="M12 5v14M6 13l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    case 'adjustment':
    case 'sliders':
      return <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" strokeLinecap="round" strokeLinejoin="round" />
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
