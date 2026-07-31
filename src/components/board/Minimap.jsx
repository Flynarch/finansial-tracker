import { useState, useEffect, useRef } from 'react'

export default function Minimap({ ideas, transform }) {
  const [collapsed, setCollapsed] = useState(true)
  const [active, setActive] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    if (collapsed) return
    setActive(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setActive(false)
    }, 2500)
    return () => clearTimeout(timerRef.current)
  }, [transform.x, transform.y, transform.zoom, collapsed])
  
  if (!ideas || ideas.length === 0) return null

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  ideas.forEach(idea => {
    minX = Math.min(minX, idea.x)
    minY = Math.min(minY, idea.y)
    maxX = Math.max(maxX, idea.x + (idea.width || 200))
    maxY = Math.max(maxY, idea.y + (idea.height || 200))
  })

  const vW = window.innerWidth / transform.zoom
  const vH = window.innerHeight / transform.zoom
  const vX = -transform.x / transform.zoom
  const vY = -transform.y / transform.zoom

  minX = Math.min(minX, vX)
  minY = Math.min(minY, vY)
  maxX = Math.max(maxX, vX + vW)
  maxY = Math.max(maxY, vY + vH)

  const padding = 200
  minX -= padding; minY -= padding; maxX += padding; maxY += padding

  const w = maxX - minX
  const h = maxY - minY
  const mapW = 120
  const mapH = 80
  const scale = Math.min(mapW / w, mapH / h)
  
  const actualW = w * scale
  const actualH = h * scale

  return (
    <div 
      className="absolute z-50 pointer-events-auto flex flex-col items-end"
      style={{ 
        top: 'calc(env(safe-area-inset-top, 0px) + 1rem)', 
        right: 'calc(env(safe-area-inset-right, 0px) + 1rem)' 
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Toggle Button */}
      <button
        type="button"
        onClick={() => { setCollapsed(!collapsed); setActive(true) }}
        className={`flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--panel-strong)] shadow-lg border border-[var(--border)] mb-1.5 transition active:scale-95 ${!collapsed ? 'bg-[var(--accent)] text-[var(--bg)]' : 'hover:bg-[var(--field-bg)] text-[var(--fg)]'}`}
        title={collapsed ? 'Tampilkan Peta' : 'Sembunyikan Peta'}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          {collapsed ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          )}
        </svg>
      </button>
      
      {/* Minimap Content */}
      {!collapsed && (
        <div 
          className={`rounded-xl bg-[var(--panel-strong)]/90 backdrop-blur shadow-2xl border border-[var(--border)] overflow-hidden pointer-events-none transition-opacity duration-500 animate-in fade-in zoom-in-95 ${active ? 'opacity-100' : 'opacity-35'}`} 
          style={{ width: actualW, height: actualH }}
        >
          <div className="relative w-full h-full">
            {ideas.map(idea => (
              <div
                key={idea.id}
                className="absolute rounded-[2px]"
                style={{
                  left: (idea.x - minX) * scale,
                  top: (idea.y - minY) * scale,
                  width: (idea.width || 200) * scale,
                  height: (idea.height || 200) * scale,
                  backgroundColor: idea.type === 'frame' ? 'transparent' : idea.color || '#999',
                  border: idea.type === 'frame' ? '1px dashed rgba(255,255,255,0.3)' : 'none'
                }}
              />
            ))}
            <div
              className="absolute border border-rose-500 bg-rose-500/10 rounded-[2px]"
              style={{
                left: (vX - minX) * scale,
                top: (vY - minY) * scale,
                width: vW * scale,
                height: vH * scale
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
