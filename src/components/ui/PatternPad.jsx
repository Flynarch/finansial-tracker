function PatternPad({ value, onChange }) {
  const selected = value ? value.split('-').filter(Boolean) : []

  const toggleNode = (node) => {
    const token = String(node)
    if (selected.includes(token)) {
      onChange(selected.filter((item) => item !== token).join('-'))
      return
    }
    onChange([...selected, token].join('-'))
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 9 }, (_, idx) => {
          const node = idx + 1
          const active = selected.includes(String(node))
          return (
            <button
              key={node}
              type="button"
              onClick={() => toggleNode(node)}
              className={`h-12 rounded-lg border text-sm font-medium ${
                active
                  ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300'
                  : 'border-[var(--border-strong)] bg-[var(--field-bg)] text-[var(--muted)]'
              }`}
            >
              {node}
            </button>
          )
        })}
      </div>
      <p className="mt-2 text-xs text-[var(--muted)]">Pattern: {value || '-'}</p>
    </div>
  )
}

export default PatternPad
