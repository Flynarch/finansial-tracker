import { useState } from 'react'
import {
  Bot,
  Sparkles,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Receipt,
  Tag,
  MessageSquare,
  Activity,
  Loader2,
} from 'lucide-react'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'
import { SettingsSection } from './settingsComponents'
import { testGeminiApiKey, getEffectiveApiKey } from '../../lib/gemini'

export default function SettingsAi() {
  const { t } = useTranslation()
  const geminiApiKey = useSettingsStore((state) => state.geminiApiKey)
  const setGeminiApiKey = useSettingsStore((state) => state.setGeminiApiKey)

  const [apiKeyInput, setApiKeyInput] = useState(geminiApiKey || '')
  const [showKey, setShowKey] = useState(false)
  const [keyStatusMessage, setKeyStatusMessage] = useState('')
  const [isTestingKey, setIsTestingKey] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [prevGeminiApiKey, setPrevGeminiApiKey] = useState(geminiApiKey)

  if (prevGeminiApiKey !== geminiApiKey) {
    setPrevGeminiApiKey(geminiApiKey)
    setApiKeyInput(geminiApiKey || '')
  }

  const handleSaveApiKey = async (e) => {
    if (e) e.preventDefault()
    const cleanKey = apiKeyInput.trim().replace(/^["']|["']$/g, '')
    await setGeminiApiKey(cleanKey)
    setKeyStatusMessage(t('settings.apiKeySaved', 'API Key Gemini berhasil disimpan!'))
    setTimeout(() => setKeyStatusMessage(''), 3500)
  }

  const handleTestApiKey = async () => {
    const cleanKey = apiKeyInput.trim().replace(/^["']|["']$/g, '')
    const keyToTest = cleanKey || getEffectiveApiKey()
    setIsTestingKey(true)
    setTestResult(null)
    try {
      const res = await testGeminiApiKey(keyToTest)
      if (res.ok && !cleanKey) {
        setTestResult({ ok: true, message: t('settings.ai.defaultKeyOk', 'Koneksi AI Bawaan Sistem Berhasil! Model aktif dan siap digunakan.') })
      } else {
        setTestResult(res)
      }
      if (res.ok && cleanKey) {
        await setGeminiApiKey(cleanKey)
      }
    } catch (err) {
      setTestResult({ ok: false, message: err.message || 'Gagal mengetes API Key.' })
    } finally {
      setIsTestingKey(false)
    }
  }

  const handleClearApiKey = async () => {
    setApiKeyInput('')
    setTestResult(null)
    await setGeminiApiKey('')
    setKeyStatusMessage(t('settings.apiKeyCleared', 'API Key dikembalikan ke kuota bawaan sistem.'))
    setTimeout(() => setKeyStatusMessage(''), 3500)
  }

  return (
    <>
      {keyStatusMessage ? (
        <div
          className="mb-5 flex items-center gap-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 animate-fadeIn"
          role="status"
        >
          <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-emerald-500" />
          <span>{keyStatusMessage}</span>
        </div>
      ) : null}

      {/* Hero Overview Card */}
      <div className="mb-6 flex flex-col gap-4 rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-5 shadow-card">
        <div className="flex items-center gap-3.5">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--badge-bg)] text-[var(--badge-icon)] border border-[var(--badge-border)] shadow-2xs">
            <Bot className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base sm:text-lg font-black text-[var(--fg)] leading-tight">
              {t('settings.ai.heroTitle', 'Integrasi Asisten AI (Gemini)')}
            </h3>
            <p className="text-xs font-medium text-[var(--muted)] mt-1">
              {t('settings.ai.heroSubtitle', 'Ditenagai model Google Gemini untuk analisis finansial, scanning struk & kategorisasi cerdas.')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--border)]/60 text-center">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] py-2 px-2">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">{t('settings.ai.quotaStatus', 'Status Kuota')}</span>
            <span className="block text-xs font-black text-[var(--fg)] mt-0.5">
              {geminiApiKey ? t('settings.ai.unlimitedPersonal', 'Tanpa Batas (Pribadi)') : t('settings.ai.sharedQuota', 'Kuota Bersama')}
            </span>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] py-2 px-2">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">{t('settings.ai.encryption', 'Enkripsi')}</span>
            <span className="block text-xs font-black text-emerald-500 mt-0.5">{t('settings.ai.localOnDevice', '100% Lokal di HP')}</span>
          </div>
        </div>
      </div>

      {/* API Key Configuration Form */}
      <SettingsSection
        label={t('settings.ai.configApiKey', 'Konfigurasi API Key')}
        footnote={t('settings.ai.configApiKeyDesc', 'API Key Anda disimpan secara lokal di memori perangkat ini dan tidak pernah dibagikan ke server lain.')}
      >
        <div className="ft-settings-cell space-y-4">
          <form onSubmit={handleSaveApiKey} className="space-y-3.5">
            <div>
              <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                Gemini API Key
              </label>
              <div className="relative flex items-center">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder={t('settings.apiKeyPlaceholder', 'Masukkan Gemini API Key (opsional)...')}
                  className="ft-settings-field-compact h-12 w-full pr-12 text-xs sm:text-sm font-mono shadow-2xs"
                  aria-label={'Gemini API Key'}
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 grid h-8 w-8 place-items-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--panel-strong)] transition cursor-pointer"
                  aria-label={showKey ? t('settings.hideKey', 'Sembunyikan Key') : t('settings.showKey', 'Tampilkan Key')}
                >
                  {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            {/* Live Test Connection Result */}
            {testResult && (
              <div
                className={`p-3.5 rounded-2xl border text-xs font-bold flex items-start gap-2.5 ${
                  testResult.ok
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                }`}
              >
                {testResult.ok ? (
                  <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-emerald-500 mt-0.5" />
                ) : (
                  <AlertCircle className="h-4.5 w-4.5 shrink-0 text-rose-500 mt-0.5" />
                )}
                <span className="leading-relaxed flex-1">{testResult.message}</span>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <button
                type="submit"
                className="flex-1 min-w-[140px] h-12 rounded-2xl bg-[var(--fg)] py-3 px-4 text-xs sm:text-sm font-black text-[var(--bg)] transition hover:opacity-90 active:scale-95 cursor-pointer shadow-xs flex items-center justify-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                <span>{t('settings.saveApiKey', 'Simpan')}</span>
              </button>

              <button
                type="button"
                onClick={handleTestApiKey}
                disabled={isTestingKey}
                className="h-12 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] py-3 px-4 text-xs sm:text-sm font-bold text-[var(--fg)] hover:bg-[var(--panel-strong)] transition active:scale-95 cursor-pointer shadow-2xs flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isTestingKey ? (
                  <Loader2 className="h-4 w-4 animate-spin text-[var(--accent)]" />
                ) : (
                  <Activity className="h-4 w-4 text-[var(--accent)]" />
                )}
                <span>{isTestingKey ? t('common.loading', 'Mengetes...') : t('settings.testApiKey', 'Tes Koneksi')}</span>
              </button>

              {geminiApiKey ? (
                <button
                  type="button"
                  onClick={handleClearApiKey}
                  className="h-12 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] py-3 px-3.5 text-xs font-bold text-[var(--muted)] hover:text-rose-500 hover:border-rose-500/30 transition active:scale-95 cursor-pointer shadow-2xs"
                >
                  {t('settings.resetApiKey', 'Reset')}
                </button>
              ) : null}
            </div>
          </form>

          {/* Quick Guide Card */}
          <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)]/80 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="block text-xs font-black text-[var(--fg)]">{t('settings.ai.noKeyYet', 'Belum punya API Key?')}</span>
              <span className="block text-[11px] font-medium text-[var(--muted)] mt-0.5">
                {t('settings.ai.getKeyDesc', 'Dapatkan API Key Google Gemini secara gratis dan cepat di Google AI Studio.')}
              </span>
            </div>
            <a
              href="https://aistudio.google.com"
              target="_blank"
              rel="noreferrer"
              className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-[var(--fg)] px-3.5 py-2 text-xs font-black text-[var(--bg)] hover:opacity-90 transition active:scale-95 shadow-xs"
            >
              <span>{t('settings.ai.getKeyBtn', 'Dapatkan')}</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </SettingsSection>

      {/* AI Capabilities Cards */}
      <div className="mb-2 px-1">
        <h2 className="text-xs font-black uppercase tracking-wider text-[var(--muted)]">
          {t('settings.ai.capabilitiesTitle', 'Kemampuan AI di FinTrack')}
        </h2>
      </div>

      <div className="grid gap-3 mb-6">
        <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] shadow-card flex items-start gap-3.5">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-purple-500/10 text-purple-500 border border-purple-500/20 shadow-2xs">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="block text-sm font-black text-[var(--fg)]">{t('settings.ai.capAssistantTitle', 'Asisten Finansial Interaktif')}</span>
            <p className="text-xs font-medium text-[var(--muted)] mt-0.5 leading-relaxed">
              {t('settings.ai.capAssistantDesc', 'Tanyakan ringkasan pengeluaran, evaluasi target tabungan, dan rekomendasi pos anggaran harian via chat.')}
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] shadow-card flex items-start gap-3.5">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--status-transfer-soft)] text-[var(--status-transfer)] border border-[var(--status-transfer)]/20 shadow-2xs">
            <Receipt className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="block text-sm font-black text-[var(--fg)]">{t('settings.ai.capOcrTitle', 'OCR Pemindai Struk Digital')}</span>
            <p className="text-xs font-medium text-[var(--muted)] mt-0.5 leading-relaxed">
              {t('settings.ai.capOcrDesc', 'Cukup upload atau foto struk belanja, AI akan membaca total nominal, merchant, dan item secara otomatis.')}
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] shadow-card flex items-start gap-3.5">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--status-income-soft)] text-[var(--status-income)] border border-[var(--status-income)]/20 shadow-2xs">
            <Tag className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="block text-sm font-black text-[var(--fg)]">{t('settings.ai.capCategoryTitle', 'Auto Smart-Categorization')}</span>
            <p className="text-xs font-medium text-[var(--muted)] mt-0.5 leading-relaxed">
              {t('settings.ai.capCategoryDesc', 'Secara otomatis mengelompokkan catatan transaksi ke kategori dan subkategori yang paling akurat.')}
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
