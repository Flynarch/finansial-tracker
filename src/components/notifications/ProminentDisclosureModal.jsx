import { ShieldCheck, Lock, BellRing, Smartphone, ArrowRight, AlertCircle } from 'lucide-react'
import Modal from '../ui/Modal'
import useTranslation from '../../hooks/useTranslation'
import { triggerHaptic } from '../../lib/haptics'
import { FinTrackNotificationPlugin } from '../../lib/notificationIngestion'

export default function ProminentDisclosureModal({ isOpen, onClose, onPermissionRequested }) {
  const { t } = useTranslation()

  const handleOpenSettings = async () => {
    triggerHaptic('impactMedium')
    try {
      await FinTrackNotificationPlugin.requestPermission()
      if (onPermissionRequested) onPermissionRequested()
      onClose()
    } catch (err) {
      console.error('Failed to open notification listener settings:', err)
      onClose()
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('notif.disclosure.title', 'Transparansi Izin Akses Notifikasi')}
      maxWidth="max-w-md"
      showCloseButton={true}
    >
      <div className="space-y-4">
        {/* Header Hero */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 text-center space-y-2">
          <div className="h-12 w-12 rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center mx-auto mb-1">
            <BellRing className="h-6 w-6" />
          </div>
          <h4 className="text-sm font-black text-[var(--fg)]">
            {t('notif.disclosure.heading', 'Otomatisasi Pencatatan Transaksi Bank')}
          </h4>
          <p className="text-xs text-[var(--muted)] leading-relaxed">
            {t(
              'notif.disclosure.subheading',
              'FinTrack memerlukan izin Akses Notifikasi Android untuk mendeteksi notifikasi mutasi secara otomatis dari aplikasi bank dan dompet digital Anda.'
            )}
          </p>
        </div>

        {/* Privacy & Security Guarantees */}
        <div className="space-y-2.5">
          <div className="flex items-start gap-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--field-bg)]/40">
            <div className="h-7 w-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <h5 className="text-xs font-bold text-[var(--fg)]">
                {t('notif.disclosure.privacyTitle', 'Hanya Memfilter Aplikasi Finansial Resmi')}
              </h5>
              <p className="text-[11px] text-[var(--muted)] mt-0.5 leading-relaxed">
                {t(
                  'notif.disclosure.privacyDesc',
                  'Sistem secara ketat hanya membaca notifikasi dari bank terdaftar (BCA, Livin Mandiri, BRImo, BNI, Jenius, GoPay, OVO, DANA, ShopeePay).'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--field-bg)]/40">
            <div className="h-7 w-7 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0 mt-0.5">
              <Lock className="h-4 w-4" />
            </div>
            <div>
              <h5 className="text-xs font-bold text-[var(--fg)]">
                {t('notif.disclosure.onDeviceTitle', 'Pemrosesan 100% On-Device (Lokal)')}
              </h5>
              <p className="text-[11px] text-[var(--muted)] mt-0.5 leading-relaxed">
                {t(
                  'notif.disclosure.onDeviceDesc',
                  'Tidak ada data notifikasi, saldo, atau isi pesan yang dikirim ke server luar. FinTrack tidak pernah membaca chat pribadi atau SMS non-bank.'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--field-bg)]/40">
            <div className="h-7 w-7 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 mt-0.5">
              <Smartphone className="h-4 w-4" />
            </div>
            <div>
              <h5 className="text-xs font-bold text-[var(--fg)]">
                {t('notif.disclosure.controlTitle', 'Kendali Penuh di Tangan Anda')}
              </h5>
              <p className="text-[11px] text-[var(--muted)] mt-0.5 leading-relaxed">
                {t(
                  'notif.disclosure.controlDesc',
                  'Anda dapat menonaktifkan izin ini kapan saja melalui menu Pengaturan Android.'
                )}
              </p>
            </div>
          </div>

        {/* Android 13/14+ Restricted Settings Help Banner */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 space-y-2">
          <div className="flex items-center gap-2 text-amber-500 font-bold text-xs">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{t('notif.disclosure.restrictedSettingsTitle', 'Muncul "Setelan Dibatasi" di Android 13/14+?')}</span>
          </div>
          <p className="text-[11px] text-[var(--fg)] leading-relaxed">
            {t(
              'notif.disclosure.restrictedSettingsDesc',
              'Jika tombol izin tidak bisa dinyalakan karena pembatasan Android APK, lakukan langkah berikut:'
            )}
          </p>
          <ol className="text-[11px] text-[var(--muted)] space-y-1 pl-4 list-decimal leading-relaxed">
            <li>{t('notif.disclosure.step1', 'Buka Info Aplikasi FinTrack di Pengaturan Android.')}</li>
            <li>{t('notif.disclosure.step2', 'Tekan ikon titik tiga di pojok kanan atas layar.')}</li>
            <li>{t('notif.disclosure.step3', 'Pilih "Izinkan setelan yang dibatasi" (Allow restricted settings).')}</li>
            <li>{t('notif.disclosure.step4', 'Buka kembali menu ini dan aktifkan izin Akses Notifikasi.')}</li>
          </ol>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2 border-t border-[var(--border)]/60">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-4 font-bold text-xs text-[var(--fg)] hover:bg-[var(--panel-strong)] transition active:scale-95 cursor-pointer"
          >
            {t('notif.disclosure.later', 'Nanti Saja')}
          </button>
          <button
            type="button"
            onClick={handleOpenSettings}
            className="flex-1 h-11 rounded-xl bg-[var(--fg)] text-[var(--bg)] font-black text-xs transition active:scale-95 cursor-pointer flex items-center justify-center gap-2 shadow-xs"
          >
            <span>{t('notif.disclosure.enableAction', 'Buka Pengaturan Android')}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </Modal>
  )
}
