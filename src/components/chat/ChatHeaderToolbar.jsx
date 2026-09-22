import { ChevronLeft, Sparkles, Paintbrush, Check, Trash2 } from 'lucide-react'
import { translate } from '../../lib/i18n'

const BG_TEXTURE_OPTIONS = [
  { id: 'paper', labelKey: 'aiChat.texture.paper', defaultLabel: 'Kertas Jurnal' },
  { id: 'dots', labelKey: 'aiChat.texture.dots', defaultLabel: 'Dot Matrix' },
  { id: 'grid', labelKey: 'aiChat.texture.grid', defaultLabel: 'Ledger Grid' },
  { id: 'topo', labelKey: 'aiChat.texture.topo', defaultLabel: 'Topografis' },
  { id: 'clean', labelKey: 'aiChat.texture.clean', defaultLabel: 'Minimalis' },
]

export default function ChatHeaderToolbar({
  onBack,
  isOnline,
  locale,
  showTexturePicker,
  setShowTexturePicker,
  backgroundTexture,
  setBackgroundTexture,
  textureDropdownRef,
  onOpenClearConfirm,
}) {
  return (
    <header className="shrink-0 flex items-center justify-between border-b border-[var(--border)] bg-[var(--panel-strong)]/90 backdrop-blur-xl px-3 py-2.5 pt-[max(env(safe-area-inset-top,0px),0.75rem)] shadow-xs z-20">
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onClick={onBack}
          className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--border)] bg-[var(--field-bg)] text-[var(--muted)] hover:text-[var(--fg)] active:scale-95 transition cursor-pointer"
          aria-label={translate(locale, 'common.back') || 'Kembali'}
        >
          <ChevronLeft size={20} strokeWidth={2.5} />
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <div className="relative grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/20 shadow-2xs">
            <Sparkles size={16} strokeWidth={2.2} />
            <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'} ring-2 ring-[var(--panel-strong)]`} />
            </span>
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-black tracking-tight text-[var(--fg)] truncate">
              {translate(locale, 'aiChat.title') || 'AI Finance Advisor'}
            </h1>
            <p className="text-[10.5px] font-semibold text-[var(--muted)] truncate flex items-center gap-1">
              <span>{isOnline ? 'Gemini 3.8 Flash' : 'NLP Lokal'}</span>
              <span className="inline-block h-1 w-1 rounded-full bg-[var(--muted-2)]" />
              <span className={isOnline ? 'text-emerald-500 font-bold' : 'text-amber-500 font-bold'}>
                {isOnline ? (locale === 'en' ? 'Online' : 'Aktif') : (locale === 'en' ? 'Offline' : 'Offline')}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Action Controls: Background Picker & Clear History */}
      <div className="flex items-center gap-1.5 shrink-0" ref={textureDropdownRef}>
        {/* Background Texture Popover Trigger */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowTexturePicker((prev) => !prev)}
            className={`grid h-8.5 w-8.5 place-items-center rounded-xl border transition active:scale-95 cursor-pointer ${
              showTexturePicker
                ? 'bg-[var(--fg)] text-[var(--bg)] border-transparent'
                : 'bg-[var(--field-bg)] text-[var(--muted)] border-[var(--border)] hover:text-[var(--fg)]'
            }`}
            title={locale === 'en' ? 'Background Texture' : 'Tekstur Latar Belakang'}
            aria-label={locale === 'en' ? 'Background Texture' : 'Tekstur Latar Belakang'}
          >
            <Paintbrush size={15} strokeWidth={2.2} />
          </button>

          {showTexturePicker && (
            <div className="absolute right-0 top-10 z-50 w-52 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)]/95 backdrop-blur-xl p-2 shadow-xl animate-[ft-spring-dropdown_0.2s_ease-out_both]">
              <p className="px-2 py-1 text-[10.5px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
                {locale === 'en' ? 'Background Texture' : 'Pilihan Latar Belakang'}
              </p>
              <div className="mt-1 space-y-1">
                {BG_TEXTURE_OPTIONS.map((tex) => {
                  const isSelected = backgroundTexture === tex.id
                  return (
                    <button
                      key={tex.id}
                      type="button"
                      onClick={() => {
                        setBackgroundTexture(tex.id)
                        setShowTexturePicker(false)
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold transition active:scale-[0.98] cursor-pointer ${
                        isSelected
                          ? 'bg-[var(--accent)] text-white shadow-2xs'
                          : 'text-[var(--fg)] hover:bg-[var(--field-bg)]'
                      }`}
                    >
                      <span>{tex.defaultLabel}</span>
                      {isSelected && <Check size={14} strokeWidth={2.5} />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Clear Chat Button */}
        <button
          type="button"
          onClick={onOpenClearConfirm}
          className="grid h-8.5 w-8.5 place-items-center rounded-xl border border-[var(--border)] bg-[var(--field-bg)] text-[var(--muted)] hover:text-rose-500 hover:border-rose-500/30 transition active:scale-95 cursor-pointer"
          title={locale === 'en' ? 'Clear History' : 'Hapus Percakapan'}
          aria-label={locale === 'en' ? 'Clear History' : 'Hapus Percakapan'}
        >
          <Trash2 size={15} strokeWidth={2.2} />
        </button>
      </div>
    </header>
  )
}
