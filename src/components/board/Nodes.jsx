import { useState } from 'react'

// eslint-disable-next-line react-refresh/only-export-components
export const COLOR_PALETTE = ['#fbbf24', '#f87171', '#34d399', '#60a5fa', '#a78bfa', '#f472b6', '#fb923c', '#38bdf8', '#facc15', '#4ade80']

function ColorPicker({ currentColor, onColorChange }) {
  const [open, setOpen] = useState(false)
  
  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
        onPointerDown={(e) => e.stopPropagation()}
        className="flex h-7 w-7 items-center justify-center rounded-lg hover:scale-110 active:scale-95 transition"
        title="Warna"
      >
        <div 
          className="w-4 h-4 rounded-full border-2 border-white/60 shadow-sm" 
          style={{ backgroundColor: currentColor }} 
        />
      </button>
      {open && (
        <div 
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 flex gap-1.5 p-2 rounded-xl bg-[var(--panel-strong)] shadow-xl border border-[var(--border)] z-[200]"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {COLOR_PALETTE.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => { onColorChange(c); setOpen(false) }}
              className={`w-7 h-7 rounded-full border-2 transition hover:scale-110 active:scale-95 ${c === currentColor ? 'border-white shadow-md scale-110' : 'border-transparent'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Action bar shared across node types — always visible on mobile
function NodeActions({ idea, onDelete, onConnect, onColorChange, onDuplicate, onToggleLock, compact }) {
  return (
    <div className={`flex items-center gap-0.5 ${compact ? 'p-0.5' : 'p-1'} rounded-xl bg-black/15 backdrop-blur-sm`}>
      {onColorChange && (
        <ColorPicker currentColor={idea.color} onColorChange={(c) => onColorChange(idea.id, c)} />
      )}
      {onDuplicate && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDuplicate(idea.id) }}
          onPointerDown={(e) => e.stopPropagation()}
          className="flex h-7 w-7 items-center justify-center rounded-lg hover:scale-110 active:scale-95 transition hover:bg-white/20"
          title="Duplikat"
        >
          <svg className="h-3.5 w-3.5 text-black/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
        </button>
      )}
      {onToggleLock && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleLock(idea.id, !idea.locked) }}
          onPointerDown={(e) => e.stopPropagation()}
          className={`flex h-7 w-7 items-center justify-center rounded-lg hover:scale-110 active:scale-95 transition ${idea.locked ? 'bg-amber-500/30' : 'hover:bg-white/20'}`}
          title={idea.locked ? 'Buka Kunci' : 'Kunci'}
        >
          {idea.locked ? (
            <svg className="h-3.5 w-3.5 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          ) : (
            <svg className="h-3.5 w-3.5 text-black/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
          )}
        </button>
      )}
      {onConnect && (
        <button
          type="button"
          onPointerDown={(e) => { e.stopPropagation(); onConnect(idea.id); }}
          className="flex h-7 w-7 items-center justify-center rounded-lg hover:scale-110 active:scale-95 transition hover:bg-white/20"
          title="Hubungkan"
        >
          <svg className="h-3.5 w-3.5 text-black/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
        </button>
      )}
      <button
        type="button"
        onClick={() => onDelete(idea.id)}
        className="flex h-7 w-7 items-center justify-center rounded-lg hover:scale-110 active:scale-95 transition hover:bg-red-500/20"
        title="Hapus"
      >
        <svg className="h-3.5 w-3.5 text-black/70 hover:text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
  )
}

// Dark themed action bar for non-colored nodes
function NodeActionsDark({ idea, onDelete, onConnect, onDuplicate, onToggleLock }) {
  return (
    <div className="flex items-center gap-0.5 p-0.5 rounded-xl bg-[var(--panel-strong)] shadow-lg border border-[var(--border)]">
      {onDuplicate && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDuplicate(idea.id) }}
          onPointerDown={(e) => e.stopPropagation()}
          className="flex h-8 w-8 items-center justify-center rounded-lg hover:scale-110 active:scale-95 transition hover:bg-[var(--field-bg)]"
          title="Duplikat"
        >
          <svg className="h-4 w-4 text-[var(--fg)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
        </button>
      )}
      {onToggleLock && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleLock(idea.id, !idea.locked) }}
          onPointerDown={(e) => e.stopPropagation()}
          className={`flex h-8 w-8 items-center justify-center rounded-lg hover:scale-110 active:scale-95 transition ${idea.locked ? 'bg-amber-500/20' : 'hover:bg-[var(--field-bg)]'}`}
          title={idea.locked ? 'Buka Kunci' : 'Kunci'}
        >
          {idea.locked ? (
            <svg className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          ) : (
            <svg className="h-4 w-4 text-[var(--fg)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
          )}
        </button>
      )}
      {onConnect && (
        <button
          type="button"
          onPointerDown={(e) => { e.stopPropagation(); onConnect(idea.id); }}
          className="flex h-8 w-8 items-center justify-center rounded-lg hover:scale-110 active:scale-95 transition hover:bg-[var(--field-bg)]"
          title="Hubungkan"
        >
          <svg className="h-4 w-4 text-[var(--fg)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
        </button>
      )}
      <button
        type="button"
        onClick={() => onDelete(idea.id)}
        className="flex h-8 w-8 items-center justify-center rounded-lg hover:scale-110 active:scale-95 transition hover:bg-red-500/20"
        title="Hapus"
      >
        <svg className="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
  )
}

export function NoteNode({ idea, isSelected, onContentChange, onDelete, onConnect, onColorChange, onDuplicate, onToggleLock }) {
  return (
    <div 
      className={`flex flex-col h-full w-full rounded-xl overflow-hidden shadow-md ${idea.locked ? 'ring-1 ring-amber-500/40' : ''}`}
      style={{ backgroundColor: idea.color }}
    >
      {/* Header bar — stable layout */}
      <div className={`flex items-center justify-end px-1.5 py-1 bg-black/10 transition-opacity duration-150 ${isSelected ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <NodeActions idea={idea} onDelete={onDelete} onConnect={onConnect} onColorChange={onColorChange} onDuplicate={onDuplicate} onToggleLock={onToggleLock} compact />
      </div>
      <textarea
        value={idea.content}
        onChange={(e) => onContentChange(idea.id, e.target.value)}
        className="flex-1 w-full resize-none bg-transparent p-4 text-black/80 placeholder-black/40 focus:outline-none text-[15px] leading-relaxed"
        placeholder="Ketik sesuatu..."
        style={{ scrollbarWidth: 'none' }}
      />
    </div>
  )
}

export function ShapeNode({ idea, onContentChange, onDelete, onConnect, onColorChange, onDuplicate, onToggleLock, isSelected }) {
  const isCircle = idea.shapeType === 'circle'
  return (
    <div 
      className={`flex flex-col h-full w-full relative ${idea.locked ? 'ring-1 ring-amber-500/40' : ''}`}
      style={{
        backgroundColor: idea.color,
        borderRadius: isCircle ? '50%' : '1rem'
      }}
    >
      <textarea
        value={idea.content}
        onChange={(e) => onContentChange(idea.id, e.target.value)}
        placeholder="Teks..."
        className="flex-1 w-full h-full resize-none bg-transparent p-4 text-center font-bold text-black/80 placeholder-black/40 focus:outline-none"
        style={{ scrollbarWidth: 'none' }}
      />
      <div className={`absolute top-2 right-2 transition-opacity duration-150 z-20 ${isSelected ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <NodeActions idea={idea} onDelete={onDelete} onConnect={onConnect} onColorChange={onColorChange} onDuplicate={onDuplicate} onToggleLock={onToggleLock} compact />
      </div>
    </div>
  )
}

export function FrameNode({ idea, onContentChange, onDelete }) {
  return (
    <div className="h-full w-full border-2 border-dashed border-[var(--muted)]/40 bg-transparent rounded-2xl relative">
      <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
        <input
          value={idea.content}
          onChange={(e) => onContentChange(idea.id, e.target.value)}
          className="bg-[var(--panel-strong)]/80 backdrop-blur-sm font-bold text-[var(--fg)] outline-none px-3 py-1.5 rounded-lg border border-[var(--border)] text-sm"
          style={{ minWidth: 80, maxWidth: 200 }}
          placeholder="Nama Grup"
        />
        <button
          type="button"
          onClick={() => onDelete(idea.id)}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--panel-strong)]/80 backdrop-blur-sm border border-[var(--border)] hover:scale-110 active:scale-95 transition hover:bg-red-500/20"
          title="Hapus Frame"
        >
          <svg className="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
  )
}

export function TextNode({ idea, onContentChange, onDelete, onDuplicate, onToggleLock, isSelected }) {
  return (
    <div className={`h-full w-full relative flex items-center justify-center ${idea.locked ? 'ring-1 ring-amber-500/40 rounded-lg' : ''}`}>
      <textarea
        value={idea.content}
        onChange={(e) => onContentChange(idea.id, e.target.value)}
        className="w-full h-full resize-none bg-transparent outline-none border-none p-2"
        style={{ 
          color: idea.color || 'var(--fg)', 
          fontSize: idea.fontSize || 24, 
          fontFamily: 'inherit',
          scrollbarWidth: 'none',
          overflow: 'hidden'
        }}
        placeholder="Ketik teks..."
      />
      <div className={`absolute -top-10 right-0 transition-opacity duration-150 z-20 ${isSelected ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <NodeActionsDark idea={idea} onDelete={onDelete} onDuplicate={onDuplicate} onToggleLock={onToggleLock} />
      </div>
    </div>
  )
}

export function DrawNode({ idea, size, onDelete, onDuplicate, onToggleLock, isSelected }) {
  if (!idea.points || idea.points.length === 0) return null
  
  const pointString = idea.points.map(p => `${p.x},${p.y}`).join(' ')
  
  return (
    <div className="h-full w-full relative">
      <svg width={size.w} height={size.h} className="overflow-visible pointer-events-none">
        <polyline 
          points={pointString} 
          fill="none" 
          stroke={idea.color || 'var(--fg)'} 
          strokeWidth={idea.strokeWidth || 4} 
          strokeLinecap="round" 
          strokeLinejoin="round" 
        />
      </svg>
      <div className={`absolute -top-10 right-0 transition-opacity duration-150 z-20 ${isSelected ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <NodeActionsDark idea={idea} onDelete={onDelete} onDuplicate={onDuplicate} onToggleLock={onToggleLock} />
      </div>
    </div>
  )
}

export function ImageNode({ idea, onDelete, onDuplicate, onToggleLock, isSelected }) {
  return (
    <div className={`h-full w-full relative ${idea.locked ? 'ring-1 ring-amber-500/40 rounded-lg' : ''}`}>
      <img 
        src={idea.src} 
        alt="Canvas Element" 
        className="w-full h-full object-contain rounded-lg pointer-events-none select-none" 
        draggable={false}
      />
      <div className={`absolute -top-10 right-0 transition-opacity duration-150 z-20 ${isSelected ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <NodeActionsDark idea={idea} onDelete={onDelete} onDuplicate={onDuplicate} onToggleLock={onToggleLock} />
      </div>
    </div>
  )
}

// Emoji/Sticker Node
export function EmojiNode({ idea, onDelete, onContentChange, onDuplicate, onToggleLock, isSelected }) {
  const [editing, setEditing] = useState(false)
  
  return (
    <div className={`h-full w-full relative flex items-center justify-center ${idea.locked ? 'ring-1 ring-amber-500/40 rounded-lg' : ''}`}>
      {editing ? (
        <input
          value={idea.content}
          onChange={(e) => onContentChange(idea.id, e.target.value)}
          onBlur={() => setEditing(false)}
          autoFocus
          className="w-full text-center bg-transparent outline-none border-none"
          style={{ fontSize: idea.fontSize || 64 }}
          placeholder="😀"
        />
      ) : (
        <div 
          className="select-none cursor-pointer hover:scale-105 transition-transform"
          onDoubleClick={() => setEditing(true)}
          style={{ fontSize: idea.fontSize || 64, lineHeight: 1 }}
        >
          {idea.content || '💡'}
        </div>
      )}
      <div className={`absolute -top-10 right-0 transition-opacity duration-150 z-20 ${isSelected ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <NodeActionsDark idea={idea} onDelete={onDelete} onDuplicate={onDuplicate} onToggleLock={onToggleLock} />
      </div>
    </div>
  )
}

// Checklist Node
export function ChecklistNode({ idea, onDelete, onUpdate, onContentChange, onColorChange, onDuplicate, onToggleLock, isSelected }) {
  let items = []
  try {
    items = typeof idea.content === 'string' && idea.content.startsWith('[') 
      ? JSON.parse(idea.content) 
      : (idea.items || [])
  } catch {
    items = idea.items || []
  }
  
  const title = idea.title || (typeof idea.content === 'string' && !idea.content.startsWith('[') ? idea.content : 'Checklist Tugas')

  const updateItems = (newItems) => {
    if (onUpdate) {
      onUpdate(idea.id, { items: newItems, content: JSON.stringify(newItems) })
    } else {
      onContentChange(idea.id, JSON.stringify(newItems))
    }
  }

  const handleTitleChange = (newTitle) => {
    if (onUpdate) {
      onUpdate(idea.id, { title: newTitle })
    }
  }
  
  const toggleItem = (idx) => {
    const newItems = items.map((item, i) => i === idx ? { ...item, checked: !item.checked } : item)
    updateItems(newItems)
  }
  
  const updateItemText = (idx, text) => {
    const newItems = items.map((item, i) => i === idx ? { ...item, text } : item)
    updateItems(newItems)
  }
  
  const addItem = () => {
    updateItems([...items, { text: '', checked: false }])
  }
  
  const removeItem = (idx) => {
    updateItems(items.filter((_, i) => i !== idx))
  }
  
  const doneCount = items.filter(i => i.checked).length
  
  return (
    <div 
      className={`flex flex-col h-full w-full rounded-xl overflow-hidden shadow-md ${idea.locked ? 'ring-1 ring-amber-500/40' : ''}`}
      style={{ backgroundColor: idea.color || '#60a5fa' }}
    >
      <div className="flex items-center justify-between px-1.5 py-1 bg-black/10 gap-1">
        <input
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Judul Checklist..."
          className="bg-transparent font-bold text-xs text-black/80 placeholder-black/40 outline-none w-full pl-1"
        />
        <span className="text-xs font-semibold text-black/50 px-1 flex-shrink-0">
          {doneCount}/{items.length}
        </span>
        <div className={`transition-opacity duration-150 flex-shrink-0 ${isSelected ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
          <NodeActions idea={idea} onDelete={onDelete} onColorChange={onColorChange} onDuplicate={onDuplicate} onToggleLock={onToggleLock} compact />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2" style={{ scrollbarWidth: 'none' }}>
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2 py-1 group">
            <button
              type="button"
              onClick={() => toggleItem(idx)}
              className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition ${item.checked ? 'bg-black/30 border-black/40' : 'border-black/30 hover:border-black/50'}`}
            >
              {item.checked && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              )}
            </button>
            <input
              value={item.text}
              onChange={(e) => updateItemText(idx, e.target.value)}
              placeholder="Item..."
              className={`flex-1 bg-transparent outline-none text-sm ${item.checked ? 'text-black/40 line-through' : 'text-black/80'} placeholder-black/30`}
            />
            <button
              type="button"
              onClick={() => removeItem(idx)}
              className="opacity-0 group-hover:opacity-100 flex-shrink-0 hover:scale-110 transition"
            >
              <svg className="w-3.5 h-3.5 text-black/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addItem}
          className="flex items-center gap-1.5 mt-1 px-1 py-1 text-xs font-medium text-black/50 hover:text-black/70 transition"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Tambah
        </button>
      </div>
    </div>
  )
}
