import { useNavigate } from 'react'
import { Lock, Sparkles, ArrowLeft, ShieldAlert } from 'lucide-react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'

export default function Investments() {
  const navigate = useNavigate()

  return (
    <div className="bg-[var(--bg)] min-h-[calc(100svh_-_64px)] p-4 sm:p-6 flex flex-col justify-center items-center">
      <Card className="max-w-md w-full text-center p-6 sm:p-8 bg-[color-mix(in_srgb,var(--panel-strong)_96%,var(--bg)_4%)] border border-[var(--border)] shadow-xl rounded-3xl">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-500 shadow-xs">
          <Lock className="h-8 w-8" strokeWidth={2} />
        </div>

        <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-3">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Locked / Rencana Masa Depan</span>
        </div>

        <h1 className="text-xl sm:text-2xl font-black text-[var(--fg)] tracking-tight mb-2">
          Fitur Investasi (Ide & Rencana)
        </h1>

        <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed mb-6">
          Halaman ini dikunci sementara karena dipersiapkan sebagai modul ide/rencana pengembangan masa depan (Portofolio Emas, Saham, Crypto, dan Analisis Aset).
        </p>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-4 text-left space-y-2 mb-6">
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--fg)]">
            <ShieldAlert className="h-4 w-4 text-[var(--accent)] shrink-0" />
            <span>Rencana Fitur Mendatang:</span>
          </div>
          <ul className="text-[11px] text-[var(--muted)] space-y-1 list-disc list-inside leading-normal">
            <li>Pencatatan Portofolio Emas & Harga Live</li>
            <li>Tracking Aset Saham & Reksa Dana</li>
            <li>Analisis Risiko & Alokasi Kekayaan</li>
          </ul>
        </div>

        <Button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="w-full flex items-center justify-center gap-2 py-3 text-xs font-bold"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Kembali ke Dashboard</span>
        </Button>
      </Card>
    </div>
  )
}
