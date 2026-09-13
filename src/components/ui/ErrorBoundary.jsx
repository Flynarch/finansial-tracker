import { Component } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import useSettingsStore from '../../store/useSettingsStore'
import idLocale from '../../locales/id'
import enLocale from '../../locales/en'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      const locale = useSettingsStore.getState?.()?.locale || 'id'
      const dict = locale === 'en' ? enLocale : idLocale

      const title = dict['common.errorBoundary.title'] || 'Terjadi Kendala Memuat Halaman'
      const message = dict['common.errorBoundary.message'] || 'Halaman gagal dimuat. Silakan muat ulang untuk memperbarui data.'
      const reload = dict['common.errorBoundary.reload'] || 'Muat Ulang Halaman'

      return (
        <div className="flex min-h-screen w-full bg-[var(--bg)] flex-col items-center justify-center p-6 text-center space-y-4">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--earthy-terra-soft)] text-[var(--earthy-terra)] border border-[var(--earthy-terra)]/30">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-black text-[var(--fg)]">{title}</h3>
            <p className="text-xs font-medium text-[var(--muted)] max-w-xs leading-relaxed">
              {message}
            </p>
          </div>
          <button
            type="button"
            onClick={this.handleReset}
            className="flex items-center gap-2 rounded-2xl bg-[var(--accent)] text-white px-4 py-2.5 text-xs font-black shadow-md hover:bg-[var(--accent-strong)] transition active:scale-95 cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" />
            {reload}
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
