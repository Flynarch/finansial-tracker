import { useState, useEffect } from 'react'
import { Check, Palette, ChevronRight, Pipette } from 'lucide-react'
import BottomSheet from '../ui/BottomSheet'

const PRESET_PALETTES = [
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Sky', hex: '#0284c7' },
  { name: 'Purple', hex: '#8b5cf6' },
  { name: 'Rose', hex: '#f43f5e' },
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Teal', hex: '#14b8a6' },
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Orange', hex: '#ea580c' },
]

function hslToHex(h, s, l) {
  s /= 100
  l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

function hexToHsl(hex) {
  let c = String(hex || '').replace('#', '')
  if (c.length === 3) c = c.split('').map((x) => x + x).join('')
  if (c.length !== 6) return { h: 160, s: 85, l: 50 }
  const r = parseInt(c.substring(0, 2), 16) / 255
  const g = parseInt(c.substring(2, 4), 16) / 255
  const b = parseInt(c.substring(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break
      case g: h = (b - r) / d + 2; break
      case b: h = (r - g) / d + 4; break
      default: break
    }
    h /= 6
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) }
}

export default function HabitColorPicker({ selectedColor = '#10b981', onChangeColor }) {
  const [showSheet, setShowSheet] = useState(false)
  const [hue, setHue] = useState(() => hexToHsl(selectedColor).h)
  const [hexInput, setHexInput] = useState(selectedColor)

  const activePreset = PRESET_PALETTES.find(
    (p) => p.hex.toLowerCase() === String(selectedColor || '').toLowerCase(),
  )

  useEffect(() => {
    setHue(hexToHsl(selectedColor).h)
    setHexInput(selectedColor)
  }, [selectedColor])

  const handleHueChange = (h) => {
    setHue(h)
    const newHex = hslToHex(h, 85, 50)
    setHexInput(newHex)
    onChangeColor(newHex)
  }

  const handleHexInputChange = (val) => {
    setHexInput(val)
    if (/^#[0-9A-F]{6}$/i.test(val)) {
      onChangeColor(val)
      setHue(hexToHsl(val).h)
    }
  }

  return (
    <div className="space-y-1">
      <label className="block text-xs font-bold uppercase tracking-wider text-[var(--muted-2)]">
        Tema Warna
      </label>

      {/* Pill Button Trigger */}
      <button
        type="button"
        onClick={() => setShowSheet(true)}
        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] px-3.5 py-2.5 text-left transition-all hover:border-[var(--border-strong)] shadow-2xs cursor-pointer"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="h-5 w-5 shrink-0 rounded-full border border-white/40 shadow-xs"
            style={{ backgroundColor: selectedColor || '#10b981' }}
          />
          <span className="truncate text-sm font-bold text-[var(--fg)]">
            {activePreset ? activePreset.name : 'Warna Kustom'}
          </span>
          <span className="font-mono text-xs font-extrabold uppercase text-[var(--muted)]">
            ({selectedColor})
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[var(--muted)]">
          <Palette className="h-4 w-4" />
          <ChevronRight className="h-4 w-4" />
        </div>
      </button>

      {/* Ultra Compact Color Spectrum Wheel BottomSheet */}
      <BottomSheet
        isOpen={showSheet}
        onClose={() => setShowSheet(false)}
        title="Pilih Warna Habit"
        maxWidth="max-w-sm"
      >
        <div className="space-y-3 pt-1 pb-2">
          {/* Preset Swatches Row */}
          <div className="space-y-1">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-[var(--muted-2)]">
              Preset Warna
            </span>
            <div className="flex items-center gap-2 overflow-x-auto ft-hide-scrollbar py-1">
              {PRESET_PALETTES.map((p) => {
                const isSelected = String(selectedColor || '').toLowerCase() === p.hex.toLowerCase()
                return (
                  <button
                    key={p.hex}
                    type="button"
                    onClick={() => {
                      onChangeColor(p.hex)
                      setHue(hexToHsl(p.hex).h)
                      setHexInput(p.hex)
                    }}
                    className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95 cursor-pointer ${
                      isSelected
                        ? 'scale-110 shadow-md ring-2 ring-[var(--fg)] ring-offset-2 ring-offset-[var(--panel-strong)]'
                        : 'hover:scale-105 opacity-90'
                    }`}
                    style={{ backgroundColor: p.hex }}
                    title={p.name}
                  >
                    {isSelected && <Check className="h-4 w-4 text-white drop-shadow-sm" strokeWidth={3} />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Rainbow Hue Spectrum Slider */}
          <div className="space-y-1 pt-1">
            <div className="flex items-center justify-between text-xs font-bold text-[var(--fg)]">
              <span className="flex items-center gap-1">
                <Pipette className="h-3.5 w-3.5 text-[var(--accent)]" />
                Spektrum Bebas
              </span>
              <div className="flex items-center gap-1.5">
                <span
                  className="h-3.5 w-3.5 rounded-full border border-white/40 shadow-xs"
                  style={{ backgroundColor: selectedColor }}
                />
                <span className="font-mono text-xs font-extrabold text-[var(--muted)]">{selectedColor}</span>
              </div>
            </div>
            <input
              type="range"
              min="0"
              max="360"
              value={hue}
              onChange={(e) => handleHueChange(Number(e.target.value))}
              className="h-4 w-full rounded-xl appearance-none cursor-pointer outline-none shadow-xs"
              style={{
                background:
                  'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
              }}
            />
          </div>

          {/* Hex Input & Done Button */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="text"
              value={hexInput}
              onChange={(e) => handleHexInputChange(e.target.value)}
              placeholder="#10B981"
              className="w-full flex-1 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider text-[var(--fg)] outline-none focus:border-[var(--accent)] text-center"
            />
            <button
              type="button"
              onClick={() => setShowSheet(false)}
              className="rounded-xl bg-[var(--fg)] px-5 py-2 text-xs font-bold text-[var(--bg)] shadow-md transition active:scale-95 cursor-pointer flex items-center gap-1 shrink-0"
            >
              <Check className="h-4 w-4" />
              Selesai
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  )
}
