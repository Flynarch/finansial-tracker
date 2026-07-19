import React from 'react'

export default function MoneyBag({ size = 24, className = '', strokeWidth = 2, color = 'currentColor' }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke={color} 
      strokeWidth={strokeWidth} 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M10 2a2 2 0 0 0-2 2v3h8V4a2 2 0 0 0-2-2h-4z" />
      <path d="M7 7h10" />
      <path d="M8 7C5 7 3 9.5 3 14c0 4 3 8 9 8s9-4 9-8c0-4.5-2-7-5-7" />
      <path d="M12 11v6" />
      <path d="M10.5 12.5c0-.8.7-1.5 1.5-1.5h.5c.8 0 1.5.7 1.5 1.5s-.7 1.5-1.5 1.5H11.5c-.8 0-1.5.7-1.5 1.5s.7 1.5 1.5 1.5h.5c.8 0 1.5-.7 1.5-1.5" />
    </svg>
  )
}
