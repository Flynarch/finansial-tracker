import { useState, useEffect, useRef, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'

import NodeWrapper from '../components/board/NodeWrapper'
import { NoteNode, ShapeNode, FrameNode, TextNode, DrawNode, ImageNode, EmojiNode, ChecklistNode, COLOR_PALETTE } from '../components/board/Nodes'
import SmartConnector from '../components/board/SmartConnector'
import Minimap from '../components/board/Minimap'

const IDEA_COLORS = ['#fbbf24', '#f87171', '#34d399', '#60a5fa', '#a78bfa', '#f472b6', '#fb923c']
let colorIndex = 0
const nextColor = () => {
  const color = IDEA_COLORS[colorIndex % IDEA_COLORS.length]
  colorIndex++
  return color
}

export default function IdeaBoard({ onClose }) {
  const containerRef = useRef(null)
  const fileInputRef = useRef(null)
  
  const ideasRaw = useLiveQuery(() => db.ideas ? db.ideas.toArray() : Promise.resolve([])) || []
  const ideas = [...ideasRaw].sort((a, b) => {
     const zA = a.zIndex || 0;
     const zB = b.zIndex || 0;
     if (zA === zB) return a.id - b.id;
     return zA - zB;
  })
  
  const links = useLiveQuery(() => db.board_links ? db.board_links.toArray() : Promise.resolve([])) || []

  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  
  const transformRef = useRef({ x: 0, y: 0, zoom: 1 })
  
  const updateTransform = (newPan, newZoom) => {
    transformRef.current = { ...newPan, zoom: newZoom }
    setPan(newPan)
    setZoom(newZoom)
  }

  const [toolMenuPos, setToolMenuPos] = useState(null)
  const [connectMode, setConnectMode] = useState({ active: false, sourceId: null })
  
  const [snapToGrid, setSnapToGrid] = useState(false)
  const [history, setHistory] = useState({ past: [], future: [] })
  
  const [mode, setMode] = useState('pan')
  const [selectionBox, setSelectionBox] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [groupDragOffset, setGroupDragOffset] = useState(null)
  
  const [currentStroke, setCurrentStroke] = useState(null)
  const [moreToolsOpen, setMoreToolsOpen] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [colorPickerOpen, setColorPickerOpen] = useState(false)
  const [alignmentGuides, setAlignmentGuides] = useState([])

  const handleDragAlign = useCallback((id, x, y, w, h) => {
    const threshold = 10
    let snappedX = x
    let snappedY = y
    const guides = []

    const cx = x + w / 2
    const cy = y + h / 2

    ideas.forEach((other) => {
      if (other.id === id) return
      const ow = other.width || 200
      const oh = other.height || 200
      const ocx = other.x + ow / 2
      const ocy = other.y + oh / 2

      if (Math.abs(cx - ocx) < threshold) {
        snappedX = ocx - w / 2
        guides.push({ type: 'v', pos: ocx })
      } else if (Math.abs(x - other.x) < threshold) {
        snappedX = other.x
        guides.push({ type: 'v', pos: other.x })
      } else if (Math.abs(x + w - (other.x + ow)) < threshold) {
        snappedX = other.x + ow - w
        guides.push({ type: 'v', pos: other.x + ow })
      }

      if (Math.abs(cy - ocy) < threshold) {
        snappedY = ocy - h / 2
        guides.push({ type: 'h', pos: ocy })
      } else if (Math.abs(y - other.y) < threshold) {
        snappedY = other.y
        guides.push({ type: 'h', pos: other.y })
      } else if (Math.abs(y + h - (other.y + oh)) < threshold) {
        snappedY = other.y + oh - h
        guides.push({ type: 'h', pos: other.y + oh })
      }
    })

    setAlignmentGuides(guides)
    return { x: snappedX, y: snappedY }
  }, [ideas])

  const handleDragEndAlign = useCallback(() => {
    setAlignmentGuides([])
  }, [])

  const handleClearBoard = async () => {
    await saveHistoryState()
    await db.ideas.clear()
    await db.board_links.clear()
    setSelectedIds(new Set())
    setShowClearConfirm(false)
  }

  const handleInsertTemplate = async (templateType) => {
    await saveHistoryState()
    const now = new Date().toISOString()
    const rect = containerRef.current.getBoundingClientRect()
    const cx = (rect.width / 2 - transformRef.current.x) / transformRef.current.zoom
    const cy = (rect.height / 2 - transformRef.current.y) / transformRef.current.zoom

    if (templateType === 'finance') {
      const headerId = await db.ideas.add({ type: 'note', content: '💰 Analisis Keuangan', color: '#60a5fa', x: cx - 100, y: cy - 200, width: 200, height: 80, zIndex: 1, createdAt: now })
      const inId = await db.ideas.add({ type: 'note', content: '📈 Pemasukan:\n• Gaji:\n• Bonus:', color: '#4ade80', x: cx - 100, y: cy - 90, width: 200, height: 110, zIndex: 1, createdAt: now })
      const outId = await db.ideas.add({ type: 'note', content: '📉 Pengeluaran:\n• Tagihan:\n• Makan:', color: '#f87171', x: cx - 100, y: cy + 40, width: 200, height: 110, zIndex: 1, createdAt: now })
      await db.board_links.add({ sourceId: headerId, targetId: inId })
      await db.board_links.add({ sourceId: headerId, targetId: outId })
    } else if (templateType === 'swot') {
      await db.ideas.add({ type: 'note', content: '🌟 Strengths (Kekuatan)', color: '#4ade80', x: cx - 110, y: cy - 220, width: 220, height: 100, zIndex: 1, createdAt: now })
      await db.ideas.add({ type: 'note', content: '⚠️ Weaknesses (Kelemahan)', color: '#f87171', x: cx - 110, y: cy - 100, width: 220, height: 100, zIndex: 1, createdAt: now })
      await db.ideas.add({ type: 'note', content: '🚀 Opportunities (Peluang)', color: '#60a5fa', x: cx - 110, y: cy + 20, width: 220, height: 100, zIndex: 1, createdAt: now })
      await db.ideas.add({ type: 'note', content: '🛡️ Threats (Ancaman)', color: '#fbbf24', x: cx - 110, y: cy + 140, width: 220, height: 100, zIndex: 1, createdAt: now })
    } else if (templateType === 'todo') {
      await db.ideas.add({ type: 'checklist', title: '🔥 Prioritas Tinggi', content: JSON.stringify([{ text: 'Bayar Tagihan Listrik', checked: false }, { text: 'Belanja Mingguan', checked: false }]), items: [{ text: 'Bayar Tagihan Listrik', checked: false }, { text: 'Belanja Mingguan', checked: false }], color: '#f87171', x: cx - 110, y: cy - 180, width: 220, height: 140, zIndex: 1, createdAt: now })
      await db.ideas.add({ type: 'checklist', title: '📌 Prioritas Sedang', content: JSON.stringify([{ text: 'Merapikan Catatan Keuangan', checked: false }]), items: [{ text: 'Merapikan Catatan Keuangan', checked: false }], color: '#fbbf24', x: cx - 110, y: cy - 20, width: 220, height: 140, zIndex: 1, createdAt: now })
    }
    setShowTemplateModal(false)
    setMoreToolsOpen(false)
    setTimeout(() => fitToContent(), 150)
  }

  const saveHistoryState = async () => {
    const currentIdeas = await db.ideas?.toArray() || []
    const currentLinks = await db.board_links?.toArray() || []
    setHistory(prev => ({
      past: [...prev.past.slice(-29), { ideas: currentIdeas, links: currentLinks }],
      future: []
    }))
  }

  const handleUndo = async () => {
    setHistory(prev => {
      if (prev.past.length === 0) return prev
      const previousState = prev.past[prev.past.length - 1]
      restoreState(previousState)
      return {
        past: prev.past.slice(0, -1),
        future: [{ ideas: ideasRaw, links }, ...prev.future]
      }
    })
  }

  const handleRedo = async () => {
    setHistory(prev => {
      if (prev.future.length === 0) return prev
      const nextState = prev.future[0]
      restoreState(nextState)
      return {
        past: [...prev.past, { ideas: ideasRaw, links }],
        future: prev.future.slice(1)
      }
    })
  }

  const restoreState = async (state) => {
    await db.transaction('rw', db.ideas, db.board_links, async () => {
      await db.ideas.clear()
      await db.board_links.clear()
      if (state.ideas.length) await db.ideas.bulkAdd(state.ideas)
      if (state.links.length) await db.board_links.bulkAdd(state.links)
    })
  }

  const pointers = useRef(new Map())
  const lastPanPos = useRef({ x: 0, y: 0 })
  const lastPinchDist = useRef(null)
  const clickStart = useRef({ x: 0, y: 0, time: 0 })

  const handlePointerDown = (e) => {
    if (e.target.id !== 'canvas-bg') return
    e.target.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    
    if (pointers.current.size === 1) {
      clickStart.current = { x: e.clientX, y: e.clientY, time: e.timeStamp }
      
      if (mode === 'draw') {
        const boardX = (e.clientX - containerRef.current.getBoundingClientRect().left - transformRef.current.x) / transformRef.current.zoom
        const boardY = (e.clientY - containerRef.current.getBoundingClientRect().top - transformRef.current.y) / transformRef.current.zoom
        setCurrentStroke([{ x: boardX, y: boardY }])
        setSelectedIds(new Set())
      } else if (mode === 'select') {
        setSelectionBox({
          startX: e.clientX, startY: e.clientY,
          currentX: e.clientX, currentY: e.clientY
        })
        setSelectedIds(new Set())
      } else {
        setSelectedIds(new Set())
        lastPanPos.current = { x: e.clientX, y: e.clientY }
        setToolMenuPos(null)
      }
    } else if (pointers.current.size === 2) {
      setCurrentStroke(null)
      setSelectionBox(null)
      const pts = Array.from(pointers.current.values())
      lastPinchDist.current = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      lastPanPos.current = { 
        x: (pts[0].x + pts[1].x) / 2, 
        y: (pts[0].y + pts[1].y) / 2 
      }
    }
  }

  const handlePointerMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    
    if (pointers.current.size === 1) {
      if (mode === 'draw' && currentStroke) {
        const boardX = (e.clientX - containerRef.current.getBoundingClientRect().left - transformRef.current.x) / transformRef.current.zoom
        const boardY = (e.clientY - containerRef.current.getBoundingClientRect().top - transformRef.current.y) / transformRef.current.zoom
        setCurrentStroke(prev => [...prev, { x: boardX, y: boardY }])
      } else if (mode === 'select' && selectionBox) {
        setSelectionBox(prev => ({ ...prev, currentX: e.clientX, currentY: e.clientY }))
        
        const rect = containerRef.current.getBoundingClientRect()
        const minX = Math.min(selectionBox.startX, e.clientX) - rect.left
        const maxX = Math.max(selectionBox.startX, e.clientX) - rect.left
        const minY = Math.min(selectionBox.startY, e.clientY) - rect.top
        const maxY = Math.max(selectionBox.startY, e.clientY) - rect.top
        
        const boardMinX = (minX - transformRef.current.x) / transformRef.current.zoom
        const boardMaxX = (maxX - transformRef.current.x) / transformRef.current.zoom
        const boardMinY = (minY - transformRef.current.y) / transformRef.current.zoom
        const boardMaxY = (maxY - transformRef.current.y) / transformRef.current.zoom

        const newSelected = new Set()
        ideas.forEach(idea => {
          const ix = idea.x, iy = idea.y, iw = idea.width || 200, ih = idea.height || 200
          if (ix < boardMaxX && ix + iw > boardMinX && iy < boardMaxY && iy + ih > boardMinY) {
            newSelected.add(idea.id)
          }
        })
        setSelectedIds(newSelected)
      } else if (mode === 'pan') {
        const moveDx = e.clientX - lastPanPos.current.x
        const moveDy = e.clientY - lastPanPos.current.y
        updateTransform(
          { x: transformRef.current.x + moveDx, y: transformRef.current.y + moveDy },
          transformRef.current.zoom
        )
        lastPanPos.current = { x: e.clientX, y: e.clientY }
      }
    } else if (pointers.current.size === 2) {
      const pts = Array.from(pointers.current.values())
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      const centerX = (pts[0].x + pts[1].x) / 2
      const centerY = (pts[0].y + pts[1].y) / 2

      if (lastPinchDist.current) {
        const panDx = centerX - lastPanPos.current.x
        const panDy = centerY - lastPanPos.current.y
        
        const rect = containerRef.current.getBoundingClientRect()
        const pointerX = centerX - rect.left
        const pointerY = centerY - rect.top
        
        const prevZoom = transformRef.current.zoom
        const prevPan = { x: transformRef.current.x, y: transformRef.current.y }
        
        const scaleFactor = dist / lastPinchDist.current
        const nextZoom = Math.min(Math.max(0.1, prevZoom * scaleFactor), 3)
        
        let newX = prevPan.x + panDx
        let newY = prevPan.y + panDy
        
        if (nextZoom !== prevZoom) {
           const bx = (pointerX - newX) / prevZoom
           const by = (pointerY - newY) / prevZoom
           newX = pointerX - bx * nextZoom
           newY = pointerY - by * nextZoom
        }
        
        updateTransform({ x: newX, y: newY }, nextZoom)
      }
      lastPinchDist.current = dist
      lastPanPos.current = { x: centerX, y: centerY }
    }
  }

  const finishDraw = async () => {
    if (!currentStroke || currentStroke.length < 2) {
       setCurrentStroke(null)
       return
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    currentStroke.forEach(p => {
       minX = Math.min(minX, p.x)
       minY = Math.min(minY, p.y)
       maxX = Math.max(maxX, p.x)
       maxY = Math.max(maxY, p.y)
    })
    
    minX -= 5; minY -= 5; maxX += 5; maxY += 5;
    const w = Math.max(20, maxX - minX)
    const h = Math.max(20, maxY - minY)
    
    const points = currentStroke.map(p => ({ x: p.x - minX, y: p.y - minY }))
    
    await saveHistoryState()
    await db.ideas.add({
      type: 'draw',
      x: minX,
      y: minY,
      width: w,
      height: h,
      points,
      color: 'var(--fg)',
      strokeWidth: 4,
      createdAt: new Date().toISOString()
    })
    setCurrentStroke(null)
  }

  const handlePointerUp = (e) => {
    if (selectionBox) setSelectionBox(null)
    if (currentStroke) finishDraw()
    
    if (pointers.current.has(e.pointerId)) {
      const start = clickStart.current
      const dist = Math.hypot(e.clientX - start.x, e.clientY - start.y)
      const duration = e.timeStamp - start.time
      
      if (mode === 'pan' && dist < 10 && duration < 500 && e.target.id === 'canvas-bg') {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect()
          const containerX = e.clientX - rect.left
          const containerY = e.clientY - rect.top
          const boardX = (containerX - transformRef.current.x) / transformRef.current.zoom
          const boardY = (containerY - transformRef.current.y) / transformRef.current.zoom
          
          const menuW = 320
          const menuH = 60
          const clampedX = Math.max(menuW / 2 + 16, Math.min(containerX, rect.width - menuW / 2 - 16))
          const clampedY = Math.max(menuH + 24, Math.min(containerY, rect.height - menuH - 24))
          
          if (navigator.vibrate) navigator.vibrate(30)
          setToolMenuPos({ containerX: clampedX, containerY: clampedY, boardX, boardY })
        }
      }

      e.target.releasePointerCapture(e.pointerId)
      pointers.current.delete(e.pointerId)
      
      if (pointers.current.size === 1) {
        const remainingPt = Array.from(pointers.current.values())[0]
        lastPanPos.current = { x: remainingPt.x, y: remainingPt.y }
      }
    }
    if (pointers.current.size < 2) lastPinchDist.current = null
  }

  const handleWheel = useCallback((e) => {
    e.preventDefault()
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const pointerX = e.clientX - rect.left
    const pointerY = e.clientY - rect.top

    const prevZoom = transformRef.current.zoom
    const prevPan = { x: transformRef.current.x, y: transformRef.current.y }

    if (e.ctrlKey || e.metaKey || !e.deltaX) {
      const zoomSensitivity = 0.005
      const nextZoom = Math.min(Math.max(0.1, prevZoom * Math.exp(-e.deltaY * zoomSensitivity)), 3)
      
      const bx = (pointerX - prevPan.x) / prevZoom
      const by = (pointerY - prevPan.y) / prevZoom
      updateTransform({ x: pointerX - bx * nextZoom, y: pointerY - by * nextZoom }, nextZoom)
    } else {
      updateTransform({ x: prevPan.x - e.deltaX, y: prevPan.y - e.deltaY }, prevZoom)
    }
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false })
      return () => container.removeEventListener('wheel', handleWheel)
    }
  }, [handleWheel])

  // --- Node CRUD ---
  const handleAddIdea = async (canvasX, canvasY) => {
    await saveHistoryState()
    const x = canvasX ?? (-transformRef.current.x + window.innerWidth / 2) / transformRef.current.zoom
    const y = canvasY ?? (-transformRef.current.y + window.innerHeight / 2) / transformRef.current.zoom

    await db.ideas.add({
      type: 'note',
      content: '',
      color: nextColor(),
      x,
      y,
      createdAt: new Date().toISOString()
    })
    setToolMenuPos(null)
  }

  const handleAddShape = async (shapeType) => {
    await saveHistoryState()
    const x = toolMenuPos?.boardX ?? (-transformRef.current.x + window.innerWidth / 2) / transformRef.current.zoom
    const y = toolMenuPos?.boardY ?? (-transformRef.current.y + window.innerHeight / 2) / transformRef.current.zoom
    await db.ideas.add({
      type: 'shape',
      shapeType,
      content: '',
      color: nextColor(),
      x,
      y,
      width: 150,
      height: 150,
      createdAt: new Date().toISOString()
    })
    setToolMenuPos(null)
  }

  const handleAddFrame = async () => {
    await saveHistoryState()
    const x = toolMenuPos?.boardX ?? (-transformRef.current.x + window.innerWidth / 2) / transformRef.current.zoom
    const y = toolMenuPos?.boardY ?? (-transformRef.current.y + window.innerHeight / 2) / transformRef.current.zoom
    await db.ideas.add({
      type: 'frame',
      content: 'Grup Baru',
      color: 'transparent',
      x,
      y,
      width: 400,
      height: 300,
      createdAt: new Date().toISOString()
    })
    setToolMenuPos(null)
  }
  
  const handleAddText = async () => {
    await saveHistoryState()
    const x = toolMenuPos?.boardX ?? (-transformRef.current.x + window.innerWidth / 2) / transformRef.current.zoom
    const y = toolMenuPos?.boardY ?? (-transformRef.current.y + window.innerHeight / 2) / transformRef.current.zoom
    await db.ideas.add({
      type: 'text',
      content: 'Teks Baru',
      color: 'var(--fg)',
      fontSize: 24,
      x,
      y,
      width: 200,
      height: 60,
      createdAt: new Date().toISOString()
    })
    setToolMenuPos(null)
  }
  
  const handleAddEmoji = async () => {
    await saveHistoryState()
    const x = toolMenuPos?.boardX ?? (-transformRef.current.x + window.innerWidth / 2) / transformRef.current.zoom
    const y = toolMenuPos?.boardY ?? (-transformRef.current.y + window.innerHeight / 2) / transformRef.current.zoom
    await db.ideas.add({
      type: 'emoji',
      content: '💡',
      fontSize: 64,
      x,
      y,
      width: 100,
      height: 100,
      createdAt: new Date().toISOString()
    })
    setToolMenuPos(null)
  }
  
  const handleAddChecklist = async () => {
    await saveHistoryState()
    const x = toolMenuPos?.boardX ?? (-transformRef.current.x + window.innerWidth / 2) / transformRef.current.zoom
    const y = toolMenuPos?.boardY ?? (-transformRef.current.y + window.innerHeight / 2) / transformRef.current.zoom
    const initialItems = [{ text: '', checked: false }]
    await db.ideas.add({
      type: 'checklist',
      title: 'Checklist Tugas',
      content: JSON.stringify(initialItems),
      items: initialItems,
      color: nextColor(),
      x,
      y,
      width: 220,
      height: 200,
      createdAt: new Date().toISOString()
    })
    setToolMenuPos(null)
  }
  
  const handleImageSelect = async (e) => {
     const file = e.target.files[0]
     if (!file) return
     
     const reader = new FileReader()
     reader.onload = async (event) => {
        const src = event.target.result
        
        await saveHistoryState()
        await db.ideas.add({
           type: 'image',
           src,
           x: (-transformRef.current.x + window.innerWidth / 2) / transformRef.current.zoom,
           y: (-transformRef.current.y + window.innerHeight / 2) / transformRef.current.zoom,
           width: 300,
           height: 300,
           createdAt: new Date().toISOString()
        })
     }
     reader.readAsDataURL(file)
     e.target.value = ''
  }

  const handleUpdateIdea = async (id, changes) => {
    await saveHistoryState()
    await db.ideas.update(id, changes)
  }
  
  const handleContentChange = async (id, content) => {
    await db.ideas.update(id, { content })
  }

  const handleColorChange = async (id, color) => {
    await saveHistoryState()
    await db.ideas.update(id, { color })
  }

  const handleToggleLock = async (id, locked) => {
    await db.ideas.update(id, { locked })
  }

  const handleDeleteIdea = async (id) => {
    await saveHistoryState()
    await db.ideas.delete(id)
    await db.board_links.where('sourceId').equals(id).or('targetId').equals(id).delete()
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    await saveHistoryState()
    const ids = Array.from(selectedIds)
    await db.ideas.bulkDelete(ids)
    for (const id of ids) {
      await db.board_links.where('sourceId').equals(id).or('targetId').equals(id).delete()
    }
    setSelectedIds(new Set())
  }

  const handleDuplicate = async (id) => {
    const original = ideas.find(i => i.id === id)
    if (!original) return
    await saveHistoryState()
    const copy = { ...original }
    delete copy.id
    await db.ideas.add({
      ...copy,
      x: original.x + 30,
      y: original.y + 30,
      locked: false,
      createdAt: new Date().toISOString()
    })
  }

  const handleDeleteLink = async (linkId) => {
    await saveHistoryState()
    await db.board_links.delete(linkId)
  }

  const handleLinkLabelChange = async (linkId, label) => {
    await db.board_links.update(linkId, { label })
  }

  const handleSelectForConnect = async (id) => {
    if (!connectMode.sourceId) {
      setConnectMode({ active: true, sourceId: id })
    } else {
      if (connectMode.sourceId !== id) {
        await saveHistoryState()
        await db.board_links.add({
          sourceId: connectMode.sourceId,
          targetId: id
        })
      }
      setConnectMode({ active: false, sourceId: null })
    }
  }

  const handleNodeSelect = (id) => {
    setSelectedIds(prev => {
      if (prev.has(id) && prev.size === 1) {
        return prev // Keep selected so menu stays visible on single tap
      }
      return new Set([id])
    })
  }

  const handleGroupDrag = (dx, dy) => {
    if (snapToGrid) {
      dx = Math.round(dx / 24) * 24
      dy = Math.round(dy / 24) * 24
    }
    setGroupDragOffset({ x: dx, y: dy })
  }

  const handleGroupDragEnd = async () => {
    if (!groupDragOffset) return
    await saveHistoryState()
    
    const updates = []
    selectedIds.forEach(id => {
      const idea = ideas.find(i => i.id === id)
      if (idea && !idea.locked) {
        updates.push({
          key: id,
          changes: {
            x: idea.x + groupDragOffset.x,
            y: idea.y + groupDragOffset.y
          }
        })
      }
    })
    
    await Promise.all(updates.map(u => db.ideas.update(u.key, u.changes)))
    setGroupDragOffset(null)
  }
  
  const bringToFront = async () => {
    if (selectedIds.size === 0) return
    await saveHistoryState()
    const maxZ = Math.max(...ideas.map(i => i.zIndex || 0), 0)
    const updates = Array.from(selectedIds).map(id => ({ key: id, changes: { zIndex: maxZ + 1 } }))
    await Promise.all(updates.map(u => db.ideas.update(u.key, u.changes)))
  }

  const sendToBack = async () => {
    if (selectedIds.size === 0) return
    await saveHistoryState()
    const minZ = Math.min(...ideas.map(i => i.zIndex || 0), 0)
    const updates = Array.from(selectedIds).map(id => ({ key: id, changes: { zIndex: minZ - 1 } }))
    await Promise.all(updates.map(u => db.ideas.update(u.key, u.changes)))
  }

  // Fit-to-content: zoom/pan to show all nodes
  const fitToContent = () => {
    if (ideas.length === 0) return
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    ideas.forEach(idea => {
      minX = Math.min(minX, idea.x)
      minY = Math.min(minY, idea.y)
      maxX = Math.max(maxX, idea.x + (idea.width || 200))
      maxY = Math.max(maxY, idea.y + (idea.height || 200))
    })
    
    const padding = 80
    const contentW = maxX - minX + padding * 2
    const contentH = maxY - minY + padding * 2
    
    const scaleX = rect.width / contentW
    const scaleY = rect.height / contentH
    const newZoom = Math.min(Math.max(0.15, Math.min(scaleX, scaleY)), 2)
    
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    
    const newPanX = rect.width / 2 - centerX * newZoom
    const newPanY = rect.height / 2 - centerY * newZoom
    
    updateTransform({ x: newPanX, y: newPanY }, newZoom)
  }

  const renderNodeContent = (idea) => {
    const commonProps = { 
      idea, 
      onDelete: handleDeleteIdea, 
      onUpdate: handleUpdateIdea,
      onContentChange: handleContentChange,
      onColorChange: handleColorChange,
      onDuplicate: handleDuplicate,
      onToggleLock: handleToggleLock,
    }
    
    switch(idea.type) {
      case 'note': return <NoteNode {...commonProps} onConnect={handleSelectForConnect} />
      case 'shape': return <ShapeNode {...commonProps} onConnect={handleSelectForConnect} />
      case 'frame': return <FrameNode {...commonProps} />
      case 'text': return <TextNode {...commonProps} />
      case 'draw': return <DrawNode {...commonProps} />
      case 'image': return <ImageNode {...commonProps} />
      case 'emoji': return <EmojiNode {...commonProps} />
      case 'checklist': return <ChecklistNode {...commonProps} />
      default: return null
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-[var(--bg)]">
      <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageSelect} className="hidden" />
      
      <style>{`
        @keyframes dash-flow {
          to { stroke-dashoffset: -14; }
        }
      `}</style>
      
      <div 
        ref={containerRef}
        id="canvas-bg"
        className="h-full w-full overflow-hidden touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          backgroundImage: 'radial-gradient(var(--border) 1.5px, transparent 1.5px)',
          backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`
        }}
      >
        <div 
          className="origin-top-left"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            pointerEvents: 'none' 
          }}
        >
          <svg className="absolute inset-0 h-full w-full pointer-events-none z-0 overflow-visible">
            {links.map(link => {
              const source = ideas.find(i => i.id === link.sourceId)
              const target = ideas.find(i => i.id === link.targetId)
              if (!source || !target) return null
              return (
                <SmartConnector 
                  key={link.id} 
                  source={source} 
                  target={target} 
                  isConnecting={connectMode.active} 
                  onDelete={() => handleDeleteLink(link.id)}
                  label={link.label}
                  onLabelChange={(label) => handleLinkLabelChange(link.id, label)}
                />
              )
            })}
          </svg>
          
          {currentStroke && (
             <svg className="absolute inset-0 h-full w-full pointer-events-none z-50 overflow-visible">
                <polyline 
                  points={currentStroke.map(p => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke="var(--fg)"
                  strokeWidth={4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
             </svg>
          )}

          {selectionBox && mode === 'select' && (
            <div
              className="absolute border-2 border-blue-500 bg-blue-500/15 pointer-events-none z-[120] rounded-sm"
              style={{
                left: (Math.min(selectionBox.startX, selectionBox.currentX) - (containerRef.current?.getBoundingClientRect()?.left || 0) - pan.x) / zoom,
                top: (Math.min(selectionBox.startY, selectionBox.currentY) - (containerRef.current?.getBoundingClientRect()?.top || 0) - pan.y) / zoom,
                width: Math.abs(selectionBox.currentX - selectionBox.startX) / zoom,
                height: Math.abs(selectionBox.currentY - selectionBox.startY) / zoom,
              }}
            />
          )}

          {/* Smart Alignment Guides */}
          {alignmentGuides.map((guide, idx) => (
            <div
              key={idx}
              className="absolute pointer-events-none z-[100] bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)] transition-all duration-75"
              style={
                guide.type === 'v'
                  ? { left: guide.pos, top: -2000, height: 4000, width: '1.5px' }
                  : { top: guide.pos, left: -2000, width: 4000, height: '1.5px' }
              }
            />
          ))}

          {ideas.map((idea) => (
            <NodeWrapper
              key={idea.id}
              idea={idea}
              zoom={zoom}
              snapToGrid={snapToGrid}
              isSelected={selectedIds.has(idea.id)}
              groupDragOffset={groupDragOffset}
              onUpdate={handleUpdateIdea}
              onGroupDrag={handleGroupDrag}
              onGroupDragEnd={handleGroupDragEnd}
              onSelect={handleNodeSelect}
              onDragAlign={handleDragAlign}
              onDragEndAlign={handleDragEndAlign}
              clearSelection={() => setSelectedIds(new Set())}
            >
              {renderNodeContent(idea)}
            </NodeWrapper>
          ))}
        </div>
      </div>

      {/* Empty State */}
      {ideas.length === 0 && (
         <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
           <div className="text-center max-w-[320px] px-4 pointer-events-auto">
             <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--panel-strong)] border border-[var(--border)] shadow-lg">
               <svg className="h-7 w-7 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                 <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
               </svg>
             </div>
             <p className="text-[var(--fg)] font-semibold text-base mb-1.5">Kanvas Masih Kosong</p>
             <p className="text-[var(--muted)] text-sm leading-relaxed mb-5">
               Tap di mana saja untuk menambah node, atau pilih template rancangan di bawah ini.
             </p>
             <button
               type="button"
               onClick={(e) => { e.stopPropagation(); setShowTemplateModal(true) }}
               className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--accent)] text-[var(--bg)] font-medium text-sm shadow-md hover:opacity-90 transition active:scale-95"
             >
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
               Gunakan Template Mobile
             </button>
           </div>
         </div>
      )}

      {/* Close Button */}
      {onClose && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onClose}
          className="absolute z-[200] pointer-events-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--panel-strong)] shadow-lg border border-[var(--border)] hover:bg-[var(--field-bg)] transition-transform active:scale-95"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 1rem)', left: 'calc(env(safe-area-inset-left, 0px) + 1rem)' }}
          title="Tutup Kanvas"
        >
          <svg className="h-6 w-6 text-[var(--fg)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {/* Connect Mode Banner */}
      {connectMode.active && (
        <div 
          className="absolute z-50 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-2xl px-5 py-3 shadow-xl border animate-in slide-in-from-top-4"
          style={{ 
            top: 'calc(env(safe-area-inset-top, 0px) + 1rem)',
            background: 'var(--panel-strong)',
            borderColor: 'var(--accent)',
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)]/20">
            <svg className="h-4 w-4 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
          </div>
          <span className="text-sm font-semibold text-[var(--fg)]">
            {connectMode.sourceId ? 'Tap node tujuan' : 'Tap node sumber'}
          </span>
          <button 
            type="button"
            onClick={() => setConnectMode({ active: false, sourceId: null })}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[var(--field-bg)] transition active:scale-95"
          >
            <svg className="h-4 w-4 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}
      
      {/* Mobile Bottom Action Pill (Thumb Ergonomics) */}
      {selectedIds.size > 0 && !connectMode.active && (
         <div 
           className="absolute left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 rounded-2xl bg-[var(--panel-strong)] p-1.5 shadow-2xl border border-[var(--border)] animate-in slide-in-from-bottom-4 duration-200"
           style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5.25rem)' }}
           onPointerDown={(e) => e.stopPropagation()}
         >
           {selectedIds.size === 1 ? (() => {
             const selectedIdea = ideas.find(i => selectedIds.has(i.id))
             if (!selectedIdea) return null
             return (
               <>
                 {['note', 'shape', 'text', 'draw', 'checklist'].includes(selectedIdea.type) && (
                   <div className="relative">
                     <button
                       type="button"
                       onClick={() => setColorPickerOpen(!colorPickerOpen)}
                       className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-[var(--field-bg)] transition active:scale-95"
                       title="Ganti Warna"
                     >
                       <div className="w-5 h-5 rounded-full border-2 border-white/80 shadow-sm" style={{ backgroundColor: selectedIdea.color || '#fbbf24' }} />
                     </button>
                     {colorPickerOpen && (
                       <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 flex gap-1.5 p-2 rounded-2xl bg-[var(--panel-strong)] shadow-2xl border border-[var(--border)] z-[200]" onPointerDown={(e) => e.stopPropagation()}>
                         {COLOR_PALETTE.map(c => (
                           <button
                             key={c}
                             type="button"
                             onClick={() => { handleColorChange(selectedIdea.id, c); setColorPickerOpen(false) }}
                             className={`w-8 h-8 rounded-full border-2 transition hover:scale-110 active:scale-95 ${c === selectedIdea.color ? 'border-white shadow-md scale-110' : 'border-transparent'}`}
                             style={{ backgroundColor: c }}
                           />
                         ))}
                       </div>
                     )}
                   </div>
                 )}
                 <button onClick={() => { handleDuplicate(selectedIdea.id); setColorPickerOpen(false) }} className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-[var(--field-bg)] transition active:scale-95" title="Duplikat">
                   <svg className="h-4 w-4 text-[var(--fg)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                 </button>
                 <button onClick={() => { handleToggleLock(selectedIdea.id, !selectedIdea.locked); setColorPickerOpen(false) }} className={`flex h-9 w-9 items-center justify-center rounded-xl transition active:scale-95 ${selectedIdea.locked ? 'bg-amber-500/20 text-amber-400' : 'hover:bg-[var(--field-bg)] text-[var(--fg)]'}`} title={selectedIdea.locked ? 'Buka Kunci' : 'Kunci'}>
                   {selectedIdea.locked ? (
                     <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                   ) : (
                     <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
                   )}
                 </button>
                 <button onClick={() => { handleSelectForConnect(selectedIdea.id); setColorPickerOpen(false) }} className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-[var(--field-bg)] transition active:scale-95 text-[var(--fg)]" title="Hubungkan">
                   <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                 </button>
                 <div className="w-px h-5 bg-[var(--border)]" />
                 <button onClick={() => { handleDeleteIdea(selectedIdea.id); setColorPickerOpen(false) }} className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-red-500/20 transition active:scale-95 text-red-400" title="Hapus">
                   <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                 </button>
               </>
             )
           })() : (
             <>
               <button onClick={bringToFront} className="px-3 py-2 rounded-xl hover:bg-[var(--field-bg)] text-xs font-bold transition active:scale-95 text-[var(--fg)]" title="Bawa ke Depan">
                 Depan
               </button>
               <div className="w-px h-5 bg-[var(--border)]" />
               <button onClick={sendToBack} className="px-3 py-2 rounded-xl hover:bg-[var(--field-bg)] text-xs font-bold transition active:scale-95 text-[var(--fg)]" title="Bawa ke Belakang">
                 Belakang
               </button>
               <div className="w-px h-5 bg-[var(--border)]" />
               <button onClick={handleBulkDelete} className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-red-500/20 transition active:scale-95 text-red-400" title="Hapus Semua">
                 <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
               </button>
             </>
           )}
           <div className="w-px h-5 bg-[var(--border)]" />
           <button onClick={() => { setSelectedIds(new Set()); setColorPickerOpen(false) }} className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-[var(--field-bg)] transition active:scale-95 text-[var(--muted)]" title="Batal Pilih">
             <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
           </button>
         </div>
      )}

      {/* Floating Tool Menu */}
      {toolMenuPos && (
        <div
          className="absolute z-50 flex flex-wrap items-center justify-center gap-2 rounded-2xl bg-[var(--panel-strong)] p-2.5 shadow-2xl border border-[var(--border)] animate-in fade-in zoom-in-90 duration-200"
          style={{
            left: toolMenuPos.containerX,
            top: toolMenuPos.containerY,
            transform: 'translate(-50%, -50%)',
            maxWidth: 320,
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button type="button" onClick={() => handleAddIdea(toolMenuPos.boardX, toolMenuPos.boardY)} className="flex h-11 w-11 flex-col items-center justify-center rounded-xl bg-[var(--field-bg)] hover:bg-[var(--accent)] hover:text-[var(--bg)] active:scale-95 transition-all animate-in zoom-in-50 duration-300 [animation-fill-mode:both] [animation-delay:0ms]" title="Catatan">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          </button>
          <button type="button" onClick={() => handleAddShape('rect')} className="flex h-11 w-11 flex-col items-center justify-center rounded-xl bg-[var(--field-bg)] hover:bg-[var(--accent)] hover:text-[var(--bg)] active:scale-95 transition-all animate-in zoom-in-50 duration-300 [animation-fill-mode:both] [animation-delay:50ms]" title="Kotak">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><rect x="4" y="4" width="16" height="16" rx="2" ry="2" /></svg>
          </button>
          <button type="button" onClick={() => handleAddShape('circle')} className="flex h-11 w-11 flex-col items-center justify-center rounded-xl bg-[var(--field-bg)] hover:bg-[var(--accent)] hover:text-[var(--bg)] active:scale-95 transition-all animate-in zoom-in-50 duration-300 [animation-fill-mode:both] [animation-delay:100ms]" title="Lingkaran">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /></svg>
          </button>
          <button type="button" onClick={handleAddText} className="flex h-11 w-11 flex-col items-center justify-center rounded-xl bg-[var(--field-bg)] hover:bg-[var(--accent)] hover:text-[var(--bg)] active:scale-95 transition-all animate-in zoom-in-50 duration-300 [animation-fill-mode:both] [animation-delay:150ms]" title="Teks">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" /></svg>
          </button>
          <button type="button" onClick={handleAddFrame} className="flex h-11 w-11 flex-col items-center justify-center rounded-xl bg-[var(--field-bg)] hover:bg-[var(--accent)] hover:text-[var(--bg)] active:scale-95 transition-all animate-in zoom-in-50 duration-300 [animation-fill-mode:both] [animation-delay:200ms]" title="Bingkai">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeDasharray="4 4" /></svg>
          </button>
          <button type="button" onClick={handleAddEmoji} className="flex h-11 w-11 flex-col items-center justify-center rounded-xl bg-[var(--field-bg)] hover:bg-[var(--accent)] hover:text-[var(--bg)] active:scale-95 transition-all animate-in zoom-in-50 duration-300 [animation-fill-mode:both] [animation-delay:250ms]" title="Emoji">
            <span className="text-xl leading-none">😀</span>
          </button>
          <button type="button" onClick={handleAddChecklist} className="flex h-11 w-11 flex-col items-center justify-center rounded-xl bg-[var(--field-bg)] hover:bg-[var(--accent)] hover:text-[var(--bg)] active:scale-95 transition-all animate-in zoom-in-50 duration-300 [animation-fill-mode:both] [animation-delay:300ms]" title="Checklist">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
          </button>
          <button type="button" onClick={() => { setConnectMode({ active: true, sourceId: null }); setToolMenuPos(null) }} className="flex h-11 w-11 flex-col items-center justify-center rounded-xl bg-[var(--field-bg)] hover:bg-rose-500 hover:text-white active:scale-95 transition-all animate-in zoom-in-50 duration-300 [animation-fill-mode:both] [animation-delay:350ms]" title="Hubungkan">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
          </button>
        </div>
      )}

      {/* Bottom Controls */}
      <div 
        className="absolute z-50 flex items-end justify-between pointer-events-none"
        style={{ 
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)', 
          left: 'calc(env(safe-area-inset-left, 0px) + 1rem)', 
          right: 'calc(env(safe-area-inset-right, 0px) + 1rem)' 
        }}
      >
        <div className="flex flex-col gap-2 pointer-events-auto" onPointerDown={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1 rounded-2xl bg-[var(--panel-strong)] p-1.5 shadow-xl border border-[var(--border)] w-fit">
            <button onClick={() => { setMode('pan'); setMoreToolsOpen(false) }} className={`flex h-11 w-11 items-center justify-center rounded-xl transition active:scale-95 ${mode === 'pan' ? 'bg-indigo-500 text-white shadow-md' : 'hover:bg-[var(--field-bg)]'}`} title="Geser">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" /></svg>
            </button>
            <button onClick={() => { setMode('select'); setMoreToolsOpen(false) }} className={`flex h-11 w-11 items-center justify-center rounded-xl transition active:scale-95 ${mode === 'select' ? 'bg-blue-500 text-white shadow-md' : 'hover:bg-[var(--field-bg)]'}`} title="Pilih">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
            </button>
            <button onClick={() => { setMode('draw'); setMoreToolsOpen(false) }} className={`flex h-11 w-11 items-center justify-center rounded-xl transition active:scale-95 ${mode === 'draw' ? 'bg-orange-500 text-white shadow-md' : 'hover:bg-[var(--field-bg)]'}`} title="Gambar">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            </button>

            <div className="w-px h-6 bg-[var(--border)] mx-0.5" />
            
            <button onClick={() => fileInputRef.current?.click()} className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-[var(--field-bg)] transition active:scale-95" title="Foto">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </button>

            <button onClick={() => setMoreToolsOpen(!moreToolsOpen)} className={`flex h-11 w-11 items-center justify-center rounded-xl transition active:scale-95 ${moreToolsOpen ? 'bg-[var(--accent)] text-[var(--bg)] shadow-md' : 'hover:bg-[var(--field-bg)]'}`} title="Lainnya">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" /></svg>
            </button>
          </div>

          {moreToolsOpen && (
            <div className="flex items-center gap-1 rounded-2xl bg-[var(--panel-strong)] p-1.5 shadow-xl border border-[var(--border)] w-fit animate-in slide-in-from-bottom-2 duration-200">
              <button onClick={handleUndo} disabled={history.past.length === 0} className={`flex h-11 w-11 items-center justify-center rounded-xl transition active:scale-95 ${history.past.length ? 'hover:bg-[var(--field-bg)]' : 'opacity-40'}`} title="Urungkan">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
              </button>
              <button onClick={handleRedo} disabled={history.future.length === 0} className={`flex h-11 w-11 items-center justify-center rounded-xl transition active:scale-95 ${history.future.length ? 'hover:bg-[var(--field-bg)]' : 'opacity-40'}`} title="Ulangi">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" /></svg>
              </button>
              <div className="w-px h-6 bg-[var(--border)] mx-0.5" />
              <button onClick={() => setSnapToGrid(!snapToGrid)} className={`flex h-11 w-11 items-center justify-center rounded-xl transition active:scale-95 ${snapToGrid ? 'bg-rose-500 text-white shadow-md' : 'hover:bg-[var(--field-bg)]'}`} title="Snap ke Grid">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
              </button>
              <div className="w-px h-6 bg-[var(--border)] mx-0.5" />
              <button onClick={() => { setMoreToolsOpen(false); setShowTemplateModal(true) }} className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-[var(--field-bg)] text-[var(--accent)] transition active:scale-95" title="Template Cepat">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
              </button>
              <div className="w-px h-6 bg-[var(--border)] mx-0.5" />
              <button onClick={fitToContent} disabled={ideas.length === 0} className={`flex h-11 w-11 items-center justify-center rounded-xl transition active:scale-95 ${ideas.length ? 'hover:bg-[var(--field-bg)]' : 'opacity-40'}`} title="Tampilkan Semua">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
              </button>
              <div className="w-px h-6 bg-[var(--border)] mx-0.5" />
              <button onClick={() => setShowClearConfirm(true)} disabled={ideas.length === 0} className={`flex h-11 w-11 items-center justify-center rounded-xl transition active:scale-95 ${ideas.length ? 'hover:bg-red-500/20 text-red-400' : 'opacity-40 text-[var(--muted)]'}`} title="Kosongkan Kanvas">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          )}
        </div>

        {/* Zoom Controls */}
        <div className="flex flex-col items-center gap-1 rounded-2xl bg-[var(--panel-strong)] p-1.5 shadow-xl border border-[var(--border)] pointer-events-auto" onPointerDown={(e) => e.stopPropagation()}>
          <button onClick={() => {
            const rect = containerRef.current.getBoundingClientRect()
            const prevZoom = transformRef.current.zoom
            const nextZoom = Math.min(3, prevZoom * 1.3)
            const bx = (rect.width/2 - transformRef.current.x) / prevZoom
            const by = (rect.height/2 - transformRef.current.y) / prevZoom
            updateTransform({ x: rect.width/2 - bx * nextZoom, y: rect.height/2 - by * nextZoom }, nextZoom)
          }} className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-[var(--field-bg)] transition active:scale-95">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          </button>
          <button onClick={() => updateTransform({ x: 0, y: 0 }, 1)} className="flex h-11 min-w-[2.75rem] items-center justify-center rounded-xl hover:bg-[var(--field-bg)] transition text-[11px] font-bold active:scale-95">
            {Math.round(zoom * 100)}%
          </button>
          <button onClick={() => {
            const rect = containerRef.current.getBoundingClientRect()
            const prevZoom = transformRef.current.zoom
            const nextZoom = Math.max(0.1, prevZoom / 1.3)
            const bx = (rect.width/2 - transformRef.current.x) / prevZoom
            const by = (rect.height/2 - transformRef.current.y) / prevZoom
            updateTransform({ x: rect.width/2 - bx * nextZoom, y: rect.height/2 - by * nextZoom }, nextZoom)
          }} className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-[var(--field-bg)] transition active:scale-95">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" /></svg>
          </button>
        </div>
      </div>
      
      <Minimap ideas={ideas} transform={{ x: pan.x, y: pan.y, zoom: zoom }} />

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl bg-[var(--panel-strong)] p-6 shadow-2xl border border-[var(--border)] text-center animate-in zoom-in-95 duration-200" onPointerDown={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/20 border border-red-500/30">
              <svg className="h-7 w-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </div>
            <h3 className="text-lg font-bold text-[var(--fg)] mb-2">Kosongkan Semua Ide?</h3>
            <p className="text-sm text-[var(--muted)] mb-6 leading-relaxed">
              Semua catatan, bentuk, gambar, dan konektor di kanvas ini akan dihapus. Perubahan ini dapat dibatalkan dengan tombol Undo.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 rounded-2xl bg-[var(--field-bg)] py-3 text-sm font-semibold text-[var(--fg)] hover:bg-[var(--border)] transition active:scale-95"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleClearBoard}
                className="flex-1 rounded-2xl bg-red-500 py-3 text-sm font-semibold text-white shadow-lg shadow-red-500/30 hover:bg-red-600 transition active:scale-95"
              >
                Hapus Semua
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl bg-[var(--panel-strong)] p-6 shadow-2xl border border-[var(--border)] animate-in slide-in-from-bottom-5 sm:zoom-in-95 duration-200 max-h-[85vh] overflow-y-auto" onPointerDown={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[var(--fg)]">Pilih Template Mobile</h3>
              <button onClick={() => setShowTemplateModal(false)} className="h-8 w-8 rounded-full bg-[var(--field-bg)] flex items-center justify-center text-[var(--muted)] hover:text-[var(--fg)]">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <p className="text-xs text-[var(--muted)] mb-5">
              Rancangan struktur vertikal yang dioptimalkan untuk lebar layar HP.
            </p>
            <div className="grid grid-cols-1 gap-3">
              <button
                type="button"
                onClick={() => handleInsertTemplate('finance')}
                className="flex items-start gap-3 p-4 rounded-2xl bg-[var(--field-bg)] hover:bg-[var(--border)] border border-[var(--border)] text-left transition active:scale-[0.98]"
              >
                <div className="h-10 w-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0 text-xl">💰</div>
                <div>
                  <div className="font-bold text-sm text-[var(--fg)]">Analisis Keuangan</div>
                  <div className="text-xs text-[var(--muted)] mt-0.5">Struktur bertingkat: Header utama terkoneksi ke Pemasukan dan Pengeluaran.</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleInsertTemplate('swot')}
                className="flex items-start gap-3 p-4 rounded-2xl bg-[var(--field-bg)] hover:bg-[var(--border)] border border-[var(--border)] text-left transition active:scale-[0.98]"
              >
                <div className="h-10 w-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 text-xl">🌟</div>
                <div>
                  <div className="font-bold text-sm text-[var(--fg)]">SWOT Vertikal</div>
                  <div className="text-xs text-[var(--muted)] mt-0.5">4 kolom vertikal pas di layar HP: Strengths, Weaknesses, Opportunities, Threats.</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleInsertTemplate('todo')}
                className="flex items-start gap-3 p-4 rounded-2xl bg-[var(--field-bg)] hover:bg-[var(--border)] border border-[var(--border)] text-left transition active:scale-[0.98]"
              >
                <div className="h-10 w-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center flex-shrink-0 text-xl">✅</div>
                <div>
                  <div className="font-bold text-sm text-[var(--fg)]">Checklist 2 Prioritas</div>
                  <div className="text-xs text-[var(--muted)] mt-0.5">Daftar tugas bertingkat siap pakai berdasarkan tingkat urgensi.</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
