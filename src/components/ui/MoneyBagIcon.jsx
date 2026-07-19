export default function MoneyBagIcon({ className = '', size = 24, strokeWidth = 2, fill = 'none' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M8 4v-1a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v1" />
      <path d="M15 4a3 3 0 1 1-6 0" />
      <path d="M5.5 7.5A9.8 9.8 0 0 0 4 13c0 4.4 3.6 8 8 8s8-3.6 8-8a9.8 9.8 0 0 0-1.5-5.5" />
      {/* Dollar sign inside */}
      <path d="M12 11v6" />
      <path d="M10 12.5h2a1.5 1.5 0 0 1 0 3h-2a1.5 1.5 0 0 0 0 3h2" />
    </svg>
  );
}
