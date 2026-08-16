import { useState, useRef, useMemo, useCallback } from 'react'

const GRID_SIZE = 3
const NODES = Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => i + 1)

export default function PatternPad({
  value = '',
  onChange,
  onComplete,
  error = false,
  disabled = false,
  size = 240,
}) {
  const containerRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [currMousePos, setCurrMousePos] = useState(null)

  // Derive selected nodes directly from value prop (no redundant setState in effect)
  const selectedNodes = useMemo(() => {
    return value ? value.split('-').map(Number).filter(Boolean) : []
  }, [value])

  const getNodeCenter = useCallback(
    (nodeId) => {
      const idx = nodeId - 1
      const row = Math.floor(idx / GRID_SIZE)
      const col = idx % GRID_SIZE
      const step = size / GRID_SIZE
      return {
        x: col * step + step / 2,
        y: row * step + step / 2,
      }
    },
    [size],
  )

  const findNearestNode = useCallback(
    (clientX, clientY) => {
      if (!containerRef.current) return null
      const rect = containerRef.current.getBoundingClientRect()
      const x = clientX - rect.left
      const y = clientY - rect.top

      if (x < 0 || x > size || y < 0 || y > size) return null

      const step = size / GRID_SIZE
      const col = Math.floor(x / step)
      const row = Math.floor(y / step)
      if (col < 0 || col >= GRID_SIZE || row < 0 || row >= GRID_SIZE) return null

      const nodeId = row * GRID_SIZE + col + 1
      const center = getNodeCenter(nodeId)
      const dist = Math.hypot(x - center.x, y - center.y)

      // Radius threshold: 32px
      if (dist <= step * 0.42) {
        return { nodeId, x, y }
      }
      return { nodeId: null, x, y }
    },
    [size, getNodeCenter],
  )

  const addNode = useCallback(
    (nodeId) => {
      if (selectedNodes.includes(nodeId)) return
      const next = [...selectedNodes, nodeId]
      onChange?.(next.join('-'))
    },
    [selectedNodes, onChange],
  )

  const handlePointerDown = (e) => {
    if (disabled) return
    setIsDragging(true)
    const target = findNearestNode(e.clientX, e.clientY)
    if (target) {
      setCurrMousePos({ x: target.x, y: target.y })
      if (target.nodeId) {
        onChange?.(String(target.nodeId))
      } else {
        onChange?.('')
      }
    }
  }

  const handlePointerMove = (e) => {
    if (!isDragging || disabled) return
    const target = findNearestNode(e.clientX, e.clientY)
    if (target) {
      setCurrMousePos({ x: target.x, y: target.y })
      if (target.nodeId) {
        addNode(target.nodeId)
      }
    }
  }

  const handlePointerUp = () => {
    if (!isDragging) return
    setIsDragging(false)
    setCurrMousePos(null)
    if (selectedNodes.length > 0) {
      onComplete?.(selectedNodes.join('-'))
    }
  }

  // Handle tap on single node as fallback
  const handleNodeClick = (nodeId) => {
    if (disabled) return
    addNode(nodeId)
  }

  const handleClear = () => {
    onChange?.('')
  }

  return (
    <div className="flex flex-col items-center select-none touch-none">
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ width: size, height: size }}
        className="relative grid grid-cols-3 place-items-center rounded-2xl border border-[var(--border)] bg-[var(--field-bg)]/60 shadow-inner-xs p-3 cursor-pointer"
      >
        {/* SVG Connector Lines */}
        <svg
          className="absolute inset-0 pointer-events-none"
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
        >
          {selectedNodes.map((nodeId, idx) => {
            if (idx === 0) return null
            const from = getNodeCenter(selectedNodes[idx - 1])
            const to = getNodeCenter(nodeId)
            return (
              <line
                key={`line-${idx}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={error ? 'rgb(244 63 94)' : 'var(--fg)'}
                strokeWidth="3.5"
                strokeLinecap="round"
              />
            )
          })}
          {isDragging && currMousePos && selectedNodes.length > 0 && (
            <line
              x1={getNodeCenter(selectedNodes[selectedNodes.length - 1]).x}
              y1={getNodeCenter(selectedNodes[selectedNodes.length - 1]).y}
              x2={currMousePos.x}
              y2={currMousePos.y}
              stroke={error ? 'rgb(244 63 94)' : 'var(--fg)'}
              strokeWidth="2.5"
              strokeDasharray="4 4"
              strokeLinecap="round"
              opacity={0.7}
            />
          )}
        </svg>

        {/* 9 Pattern Dots */}
        {NODES.map((node) => {
          const isSelected = selectedNodes.includes(node)
          const isLast = selectedNodes[selectedNodes.length - 1] === node
          return (
            <button
              key={node}
              type="button"
              tabIndex={-1}
              onClick={() => handleNodeClick(node)}
              className="relative z-10 grid h-12 w-12 place-items-center rounded-full bg-transparent transition active:scale-90"
            >
              {/* Outer Ring */}
              <div
                className={`h-9 w-9 rounded-full border transition-all duration-150 grid place-items-center ${
                  isSelected
                    ? error
                      ? 'border-rose-500 bg-rose-500/20 scale-110'
                      : 'border-[var(--fg)] bg-[var(--fg)]/15 scale-110 shadow-sm'
                    : 'border-[var(--border)] bg-[var(--panel-strong)]'
                }`}
              >
                {/* Inner Core Dot */}
                <div
                  className={`h-3 w-3 rounded-full transition-all duration-150 ${
                    isSelected
                      ? error
                        ? 'bg-rose-500 scale-125'
                        : isLast
                          ? 'bg-[var(--fg)] scale-125'
                          : 'bg-[var(--fg)]'
                      : 'bg-[var(--muted)]/50'
                  }`}
                />
              </div>
            </button>
          )
        })}
      </div>

      {/* Helper Footer */}
      <div className="mt-2.5 flex items-center justify-between w-full max-w-[240px] px-1">
        <span className="text-[11px] font-medium text-[var(--muted)]">
          {selectedNodes.length > 0
            ? `${selectedNodes.length} titik terhubung`
            : 'Tarik garis hubungkan pola'}
        </span>
        {selectedNodes.length > 0 && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="text-[11px] font-bold text-[var(--fg)] hover:underline cursor-pointer"
          >
            Hapus
          </button>
        )}
      </div>
    </div>
  )
}
