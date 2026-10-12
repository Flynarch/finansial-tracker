import { ChevronLeft, Paintbrush, Check, Trash2, MoreVertical } from 'lucide-react'
import { translate } from '../../lib/i18n'

const BG_TEXTURE_OPTIONS = [
  { id: 'paper', defaultLabelId: 'Kertas Jurnal', defaultLabelEn: 'Journal Paper' },
  { id: 'dots', defaultLabelId: 'Dot Matrix', defaultLabelEn: 'Dot Matrix' },
  { id: 'grid', defaultLabelId: 'Ledger Grid', defaultLabelEn: 'Ledger Grid' },
  { id: 'topo', defaultLabelId: 'Topografis', defaultLabelEn: 'Topographic' },
  { id: 'clean', defaultLabelId: 'Minimalis', defaultLabelEn: 'Minimalist' },
]

export default function ChatHeaderToolbar({
  onBack,
  isOnline = true,
  locale = 'id',
  hasActiveChat = false,
  hasMessages = false,
  isScrolled,
  showOptionsMenu = false,
  setShowOptionsMenu,
  optionsMenuRef,
  backgroundTexture,
  setBackgroundTexture,
  onOpenClearConfirm,
}) {
  const isEn = locale === 'en'
  const isFrosted = typeof isScrolled === 'boolean' ? isScrolled : hasActiveChat

  return (
    <header
      className={`shrink-0 relative flex items-center justify-between px-3 py-2 pt-[max(env(safe-area-inset-top,0px),0.75rem)] z-20 transition-all duration-300 ease-out border-none shadow-none ${
        isFrosted
          ? 'bg-[var(--panel-strong)]/85 backdrop-blur-xl'
          : 'bg-transparent'
      }`}
    >
      {/* Left: Back button */}
      <button
        type="button"
        onClick={onBack}
        className="grid h-9 w-9 place-items-center rounded-full text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--field-bg)]/60 active:scale-95 transition cursor-pointer"
        aria-label={translate(locale, 'common.back') || 'Kembali'}
      >
        <ChevronLeft size={22} strokeWidth={2.2} />
      </button>

      {/* Center: Title (Perfect centered balance, pure typography, no dots/indicators) */}
      <div
        className={`absolute left-1/2 -translate-x-1/2 flex items-center justify-center max-w-[65%] min-w-0 transition-all duration-300 ease-out pointer-events-none ${
          hasActiveChat
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 -translate-y-1.5'
        }`}
      >
        <h1 className="text-sm font-semibold tracking-tight text-[var(--fg)] truncate text-center">
          {translate(locale, 'aiChat.title') || (isEn ? 'FinTrack AI Assistant' : 'Asisten Finansial FinTrack')}
        </h1>
      </div>

      {/* Right: Consolidated 3-dots Menu Button */}
      <div className="relative shrink-0" ref={optionsMenuRef}>
        <button
          type="button"
          onClick={() => setShowOptionsMenu?.((prev) => !prev)}
          className={`grid h-9 w-9 place-items-center rounded-full transition cursor-pointer active:scale-95 ${
            showOptionsMenu
              ? 'bg-[var(--field-bg)] text-[var(--fg)]'
              : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--field-bg)]/60'
          }`}
          title={translate(locale, 'aiChat.options') || (isEn ? 'Chat Options' : 'Opsi Obrolan')}
          aria-label={translate(locale, 'aiChat.options') || (isEn ? 'Chat Options' : 'Opsi Obrolan')}
          aria-expanded={showOptionsMenu}
        >
          <MoreVertical size={19} strokeWidth={2.2} />
        </button>

        {/* Options Dropdown Menu */}
        {showOptionsMenu && (
          <div className="absolute right-0 top-11 z-50 w-56 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)]/95 backdrop-blur-xl p-2.5 shadow-2xl animate-[ft-spring-dropdown_0.2s_ease-out_both] divide-y divide-[var(--border)]/70">
            {/* Model Info Section */}
            <div className="px-2 py-1.5 pb-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
                {translate(locale, 'aiChat.modelStatus') || (isEn ? 'Model Status' : 'Status Model')}
              </span>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs font-bold text-[var(--fg)]">Gemini 3.8 Flash</span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    isOnline ? 'bg-emerald-500/15 text-emerald-500' : 'bg-amber-500/15 text-amber-500'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  {isOnline ? (isEn ? 'Online' : 'Aktif') : 'Offline'}
                </span>
              </div>
            </div>

            {/* Background Texture Options */}
            <div className="py-2 space-y-1">
              <div className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
                <Paintbrush size={12} strokeWidth={2.5} />
                <span>
                  {translate(locale, 'aiChat.backgroundTexture') ||
                    (isEn ? 'Background Texture' : 'Tekstur Latar Belakang')}
                </span>
              </div>
              <div className="space-y-0.5">
                {BG_TEXTURE_OPTIONS.map((tex) => {
                  const isSelected = backgroundTexture === tex.id
                  return (
                    <button
                      key={tex.id}
                      type="button"
                      onClick={() => {
                        setBackgroundTexture(tex.id)
                        setShowOptionsMenu?.(false)
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold transition active:scale-[0.98] cursor-pointer ${
                        isSelected
                          ? 'bg-[var(--accent)] text-white shadow-2xs font-bold'
                          : 'text-[var(--fg)] hover:bg-[var(--field-bg)]'
                      }`}
                    >
                      <span>{isEn ? tex.defaultLabelEn : tex.defaultLabelId}</span>
                      {isSelected && <Check size={14} strokeWidth={2.5} />}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Clear Conversation Option */}
            {hasMessages && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowOptionsMenu?.(false)
                    onOpenClearConfirm()
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-500/10 active:scale-[0.98] transition cursor-pointer"
                >
                  <Trash2 size={14} strokeWidth={2.2} />
                  <span>
                    {translate(locale, 'aiChat.clearHistory') ||
                      (isEn ? 'Clear Conversation' : 'Hapus Percakapan')}
                  </span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
