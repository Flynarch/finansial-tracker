import React, { useRef, useState } from 'react'
import useTranslation from '../../hooks/useTranslation'

export default function NodeWrapper({ 
  idea, zoom, snapToGrid, isSelected, groupDragOffset, 
  onUpdate, onGroupDrag, onGroupDragEnd, clearSelection, onSelect,
  onDragAlign, onDragEndAlign,
  children 
}) {
  const { t } = useTranslation()
  const [pos, setPos] = useState({ x: idea.x, y: idea.y })
  const [size, setSize] = useState({ w: idea.width || 200, h: idea.height || 200 })
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  
  const [prevIdea, setPrevIdea] = useState({ x: idea.x, y: idea.y, width: idea.width, height: idea.height })
  if (prevIdea.x !== idea.x || prevIdea.y !== idea.y || prevIdea.width !== idea.width || prevIdea.height !== idea.height) {
    setPrevIdea({ x: idea.x, y: idea.y, width: idea.width, height: idea.height })
    setPos({ x: idea.x, y: idea.y })
    setSize({ w: idea.width || 200, h: idea.height || 200 })
  }
  
  const dragRef = useRef({ startX: 0, startY: 0, initX: 0, initY: 0 })
  const resizeRef = useRef({ startX: 0, startY: 0, initW: 0, initH: 0, initX: 0, initY: 0, handle: '' })
  const tapRef = useRef({ startX: 0, startY: 0, time: 0 })

  const handlePointerDown = (e) => {
    if (e.target.closest('button')) return
    
    tapRef.current = { startX: e.clientX, startY: e.clientY, time: e.timeStamp }

    const isTextInput = e.target.tagName.toLowerCase() === 'textarea' || e.target.tagName.toLowerCase() === 'input'
    if (isTextInput) {
      if (!isSelected && onSelect) {
        onSelect(idea.id)
      }
      return
    }

    e.preventDefault()
    e.stopPropagation()
    e.target.setPointerCapture(e.pointerId)
    
    // If locked, only allow tap (for selection), not drag
    if (idea.locked) {
      return
    }
    
    setIsDragging(true)
    
    // Haptic feedback on grab
    if (navigator.vibrate) navigator.vibrate(15)
    
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: pos.x,
      initY: pos.y,
    }
    
    // If this node isn't selected, clear selection so only this node is being moved
    if (!isSelected) {
      clearSelection()
    }
  }

  const handlePointerMove = (e) => {
    if (!isDragging) return
    const panDx = (e.clientX - dragRef.current.startX) / zoom
    const panDy = (e.clientY - dragRef.current.startY) / zoom
    
    if (isSelected && onGroupDrag) {
      onGroupDrag(panDx, panDy)
    } else {
      let newX = dragRef.current.initX + panDx
      let newY = dragRef.current.initY + panDy
      if (snapToGrid) {
        newX = Math.round(newX / 24) * 24
        newY = Math.round(newY / 24) * 24
      } else if (onDragAlign) {
        const snapped = onDragAlign(idea.id, newX, newY, size.w, size.h)
        if (snapped) {
          newX = snapped.x
          newY = snapped.y
        }
      }
      setPos({ x: newX, y: newY })
    }
  }

  const handlePointerUp = (e) => {
    if (onDragEndAlign) onDragEndAlign()
    if (idea.locked) {
      // For locked nodes, only handle tap-to-select
      const dist = Math.hypot(e.clientX - tapRef.current.startX, e.clientY - tapRef.current.startY)
      const duration = e.timeStamp - tapRef.current.time
      if (dist < 20 && duration < 600) {
        if (onSelect) onSelect(idea.id)
      }
      try { e.target.releasePointerCapture(e.pointerId) } catch {
        // ignore pointer capture error
      }
      return
    }
    
    if (!isDragging) return
    e.target.releasePointerCapture(e.pointerId)
    setIsDragging(false)
    
    // Detect tap (vs drag)
    const dist = Math.hypot(e.clientX - tapRef.current.startX, e.clientY - tapRef.current.startY)
    const duration = e.timeStamp - tapRef.current.time
    
    if (dist < 20 && duration < 600) {
      if (onSelect) onSelect(idea.id)
      return
    }
    
    if (isSelected && onGroupDragEnd) {
      onGroupDragEnd()
    } else {
      if (pos.x !== dragRef.current.initX || pos.y !== dragRef.current.initY) {
        onUpdate(idea.id, { x: pos.x, y: pos.y })
      }
    }
  }

  // --- Resize Logic ---
  const handleResizeStart = (e, handle) => {
    if (idea.locked) return // Prevent resize on locked nodes
    e.stopPropagation()
    e.preventDefault()
    e.target.setPointerCapture(e.pointerId)
    setIsResizing(true)
    if (navigator.vibrate) navigator.vibrate(10)
    resizeRef.current = {
      startX: e.clientX, startY: e.clientY,
      initW: size.w, initH: size.h,
      initX: pos.x, initY: pos.y,
      handle
    }
  }

  const handleResizeMove = (e) => {
    if (!isResizing) return
    const dx = (e.clientX - resizeRef.current.startX) / zoom
    const dy = (e.clientY - resizeRef.current.startY) / zoom
    const { handle, initW, initH, initX, initY } = resizeRef.current

    let newW = initW
    let newH = initH
    let newX = initX
    let newY = initY

    if (handle.includes('r')) newW = Math.max(50, initW + dx)
    if (handle.includes('b')) newH = Math.max(50, initH + dy)
    if (handle.includes('l')) {
      newW = Math.max(50, initW - dx)
      if (newW > 50) newX = initX + dx
    }
    if (handle.includes('t')) {
      newH = Math.max(50, initH - dy)
      if (newH > 50) newY = initY + dy
    }

    if (snapToGrid) {
      newW = Math.round(newW / 24) * 24
      newH = Math.round(newH / 24) * 24
      newX = Math.round(newX / 24) * 24
      newY = Math.round(newY / 24) * 24
    }

    setSize({ w: newW, h: newH })
    setPos({ x: newX, y: newY })
  }

  const handleResizeEnd = (e) => {
    if (!isResizing) return
    e.target.releasePointerCapture(e.pointerId)
    setIsResizing(false)
    onUpdate(idea.id, { width: size.w, height: size.h, x: pos.x, y: pos.y })
  }

  const finalX = pos.x + (isSelected && groupDragOffset && !isResizing ? groupDragOffset.x : 0)
  const finalY = pos.y + (isSelected && groupDragOffset && !isResizing ? groupDragOffset.y : 0)

  // Resize handle — clean touch area at bottom-right corner
  const renderHandle = (handle, classes) => (
    <div
      className={`absolute z-50 flex items-center justify-center ${classes}`}
      style={{ width: 32, height: 32, touchAction: 'none' }}
      onPointerDown={(e) => handleResizeStart(e, handle)}
      onPointerMove={handleResizeMove}
      onPointerUp={handleResizeEnd}
      onPointerCancel={handleResizeEnd}
      title={t('board.resize', 'Ubah Ukuran')}
    >
      <div className="w-3.5 h-3.5 rounded-full bg-blue-500 border-2 border-white shadow-md flex items-center justify-center">
        <div className="w-1 h-1 bg-white rounded-full" />
      </div>
    </div>
  )

  return (
    <div
      className={`absolute transition-shadow ${
        isDragging ? 'z-40 cursor-grabbing shadow-lg' : 'z-0 cursor-grab'
      } ${isSelected ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-transparent shadow-xl' : ''}`}
      style={{
        left: finalX,
        top: finalY,
        width: size.w,
        height: size.h,
        touchAction: 'none',
        zIndex: idea.zIndex || 0
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Content */}
      {React.cloneElement(children, { size, isDragging, pos, isSelected })}

      {/* Resize Handle — Single bottom-right corner handle on mobile to avoid blocking touches */}
      {isSelected && !isDragging && (
        <>
          {renderHandle('br', '-bottom-3 -right-3')}
        </>
      )}
    </div>
  )
}
