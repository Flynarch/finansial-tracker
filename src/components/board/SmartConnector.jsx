import { useState } from 'react'

export default function SmartConnector({ source, target, isConnecting, onDelete, label, onLabelChange }) {
  const [editing, setEditing] = useState(false)
  
  if (!source || !target) return null

  // Centers
  const sx = source.x + (source.width || 200) / 2
  const sy = source.y + (source.height || 200) / 2
  const tx = target.x + (target.width || 200) / 2
  const ty = target.y + (target.height || 200) / 2

  const tw = (target.width || 200) / 2
  const th = (target.height || 200) / 2

  const dx = tx - sx
  const dy = ty - sy
  const angle = Math.atan2(dy, dx)

  let endX
  let endY

  if (target.shapeType === 'circle') {
    const radius = Math.min(tw, th)
    endX = tx - Math.cos(angle) * radius
    endY = ty - Math.sin(angle) * radius
  } else {
    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)
    
    if (absDx * th > absDy * tw) {
      endX = tx - Math.sign(dx) * tw
      endY = ty - Math.sign(dx) * tw * (dy / dx)
    } else {
      endY = ty - Math.sign(dy) * th
      endX = tx - Math.sign(dy) * th * (dx / dy)
    }
  }

  // Arrowhead
  const arrowSize = 12
  const arrowAngle1 = angle - Math.PI / 6
  const arrowAngle2 = angle + Math.PI / 6

  const a1x = endX - Math.cos(arrowAngle1) * arrowSize
  const a1y = endY - Math.sin(arrowAngle1) * arrowSize
  const a2x = endX - Math.cos(arrowAngle2) * arrowSize
  const a2y = endY - Math.sin(arrowAngle2) * arrowSize

  // Curved path
  const cx = (sx + endX) / 2 - dy * 0.1
  const cy = (sy + endY) / 2 + dx * 0.1
  const pathData = `M ${sx} ${sy} Q ${cx} ${cy} ${endX} ${endY}`

  // Midpoint for controls
  const midX = (sx + endX) / 2
  const midY = (sy + endY) / 2

  return (
    <g>
      {/* Invisible wider hit area for easier tapping on mobile */}
      {onDelete && (
        <path
          d={pathData}
          fill="none"
          stroke="transparent"
          strokeWidth="24"
          style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
          onClick={(e) => { e.stopPropagation(); onDelete() }}
        />
      )}
      <path 
        d={pathData}
        fill="none"
        stroke={isConnecting ? 'var(--accent)' : 'var(--fg)'} 
        strokeWidth="3" 
        strokeOpacity="0.8"
        strokeDasharray={isConnecting ? '8 6' : 'none'}
        style={isConnecting ? { animation: 'dash-flow 0.6s linear infinite' } : undefined}
      />
      {/* Arrowhead */}
      <polygon 
        points={`${endX},${endY} ${a1x},${a1y} ${a2x},${a2y}`} 
        fill={isConnecting ? 'var(--accent)' : 'var(--fg)'} 
        opacity="0.8" 
      />
      
      {/* Label on connector */}
      {(label || editing) && (
        <foreignObject 
          x={midX - 60} y={midY - 14} width="120" height="28"
          style={{ pointerEvents: 'auto', overflow: 'visible' }}
        >
          {editing ? (
            <input
              type="text"
              defaultValue={label || ''}
              autoFocus
              onBlur={(e) => { 
                setEditing(false)
                if (onLabelChange) onLabelChange(e.target.value)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.target.blur()
                }
              }}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                textAlign: 'center',
                fontSize: '11px',
                fontWeight: 600,
                background: 'var(--panel-strong)',
                color: 'var(--fg)',
                border: '1.5px solid var(--accent)',
                borderRadius: '6px',
                padding: '3px 6px',
                outline: 'none',
              }}
            />
          ) : (
            <div
              onClick={(e) => { e.stopPropagation(); setEditing(true) }}
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                textAlign: 'center',
                fontSize: '11px',
                fontWeight: 600,
                background: 'var(--panel-strong)',
                color: 'var(--muted)',
                borderRadius: '6px',
                padding: '3px 8px',
                cursor: 'pointer',
                border: '1px solid var(--border)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {label}
            </div>
          )}
        </foreignObject>
      )}
      
      {/* Midpoint controls: delete + label */}
      {onDelete && !label && !editing && (
        <g style={{ pointerEvents: 'auto' }}>
          {/* Delete circle */}
          <g style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onDelete() }}>
            <circle cx={midX} cy={midY} r="14" fill="var(--panel-strong)" stroke="var(--border)" strokeWidth="1.5" opacity="0.9" />
            <line x1={midX - 5} y1={midY - 5} x2={midX + 5} y2={midY + 5} stroke="var(--danger)" strokeWidth="2.5" strokeLinecap="round" />
            <line x1={midX + 5} y1={midY - 5} x2={midX - 5} y2={midY + 5} stroke="var(--danger)" strokeWidth="2.5" strokeLinecap="round" />
          </g>
          {/* Add label button */}
          {onLabelChange && (
            <g style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setEditing(true) }}>
              <circle cx={midX + 32} cy={midY} r="14" fill="var(--panel-strong)" stroke="var(--border)" strokeWidth="1.5" opacity="0.9" />
              <text x={midX + 32} y={midY + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--muted)">Aa</text>
            </g>
          )}
        </g>
      )}
      
      {/* When there's a label, show delete next to it */}
      {onDelete && label && !editing && (
        <g style={{ pointerEvents: 'auto', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onDelete() }}>
          <circle cx={midX + 68} cy={midY} r="12" fill="var(--panel-strong)" stroke="var(--border)" strokeWidth="1.5" opacity="0.9" />
          <line x1={midX + 68 - 4} y1={midY - 4} x2={midX + 68 + 4} y2={midY + 4} stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" />
          <line x1={midX + 68 + 4} y1={midY - 4} x2={midX + 68 - 4} y2={midY + 4} stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" />
        </g>
      )}
    </g>
  )
}
