import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Camera, Pencil } from 'lucide-react'
import Modal from '../components/ui/Modal'
import UserAvatar from '../components/ui/UserAvatar'
import ChangePhotoModal from '../components/profile/ChangePhotoModal'
import useTranslation from '../hooks/useTranslation'
import useSettingsStore from '../store/useSettingsStore'
import { db } from '../lib/db'

/* ─── stat mini-icons ─── */
function StatIcon({ name }) {
  const cls = 'h-4 w-4'
  if (name === 'tx') {
    return (
      <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M7 17l-4-4m0 0l4-4m-4 4h18" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (name === 'budget') {
    return (
      <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M3 6h18M3 12h18M3 18h12" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M13 7l5 5m0 0l-5 5m5-5H6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ─── stat card (premium accent) ─── */
function ProfileStatCard({ value, label, icon }) {
  return (
    <div className="relative flex-1 overflow-hidden rounded-[1.25rem] border border-[color-mix(in_srgb,var(--border)_80%,transparent)] bg-[var(--panel-strong)] p-4 shadow-[var(--shadow-card)] transition hover:border-[color-mix(in_srgb,var(--accent)_40%,transparent)]">
      <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-[0.6rem] bg-[color-mix(in_srgb,var(--accent)_12%,var(--field-bg))] text-[var(--accent)] border border-[color-mix(in_srgb,var(--accent)_25%,transparent)] shadow-sm">
        <StatIcon name={icon} />
      </div>
      <p className="text-[22px] font-bold tabular-nums tracking-tight text-[var(--fg)]">
        {value}
      </p>
      <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.15em] text-[var(--muted)]">{label}</p>
    </div>
  )
}

/* ─── shortcut icon glyphs ─── */
function ShortcutIcon({ name }) {
  const cls = 'h-5 w-5'
  if (name === 'settings') {
    return (
      <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z" />
        <path d="M19 12a7.8 7.8 0 0 0-.08-1l2.02-1.58-2-3.46-2.45.7a7.9 7.9 0 0 0-1.72-1l-.4-2.5h-4l-.4 2.5a7.9 7.9 0 0 0-1.72 1l-2.45-.7-2 3.46L5.08 11A8.4 8.4 0 0 0 5 12c0 .34.03.67.08 1l-2.02 1.58 2 3.46 2.45-.7c.53.43 1.11.77 1.72 1l.4 2.5h4l.4-2.5c.61-.23 1.19-.57 1.72-1l2.45.7 2-3.46L18.92 13c.05-.33.08-.66.08-1z" />
      </svg>
    )
  }
  if (name === 'calendar') {
    return (
      <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M7 3v3M17 3v3M4 8h16M5.5 5h13A1.5 1.5 0 0 1 20 6.5v12A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5v-12A1.5 1.5 0 0 1 5.5 5z" />
      </svg>
    )
  }
  if (name === 'reports') {
    return (
      <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M4 19h16" strokeLinecap="round" />
        <path d="M7 19V11" strokeLinecap="round" />
        <path d="M12 19V7" strokeLinecap="round" />
        <path d="M17 19v-5" strokeLinecap="round" />
      </svg>
    )
  }
  if (name === 'todo') {
    return (
      <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M5 5h14v14H5z" strokeLinejoin="round" />
        <path d="M9 9h6M9 12.5h6M9 16h4" strokeLinecap="round" />
      </svg>
    )
  }
  if (name === 'loans') {
    return (
      <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M11 15h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 17" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m7 21 1.6-1.4c.4-.4.9-.6 1.4-.6h4c1.7 0 3-1.3 3-3V7c0-1.7-1.3-3-3-3H9C7.3 4 6 5.3 6 7v4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (name === 'logout') {
    return (
      <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16 17l5-5-5-5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  return null
}

/* ─── shortcut row premium ─── */
function ShortcutRow({ icon, label, sublabel, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={sublabel ? `${label}. ${sublabel}` : label}
      className="group flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-[color-mix(in_srgb,var(--accent)_4%,var(--field-bg))] active:bg-[color-mix(in_srgb,var(--accent)_8%,var(--field-bg))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-inset"
    >
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--accent)_10%,var(--field-bg))] text-[var(--accent)] border border-[color-mix(in_srgb,var(--accent)_20%,transparent)] shadow-sm transition group-hover:scale-105">
        <ShortcutIcon name={icon} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[14.5px] font-bold text-[var(--fg)] group-hover:text-[var(--accent)] transition-colors">{label}</p>
        {sublabel ? <p className="mt-0.5 text-[11.5px] font-medium text-[var(--muted)]">{sublabel}</p> : null}
      </div>
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-[var(--muted-2)] transition-transform group-hover:translate-x-1 group-hover:text-[var(--accent)]" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

/* ─── main ─── */
function Profile() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [isEntering, setIsEntering] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [photoModalOpen, setPhotoModalOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const nameInputRef = useRef(null)

  const profileName = useSettingsStore((s) => s.profileName)
  const setProfileName = useSettingsStore((s) => s.setProfileName)
  const authProvider = useSettingsStore((s) => s.authProvider)
  const authUserEmail = useSettingsStore((s) => s.authUserEmail)

  const txCount = useLiveQuery(() => db.transactions.count(), [], 0)
  const budgetCount = useLiveQuery(() => db.budgets.count(), [], 0)
  const goalsCount = useLiveQuery(async () => {
    try {
      const all = await db.goals.toArray()
      return all.filter((g) => !g.isCompleted && !g.isArchived).length
    } catch {
      return 0
    }
  }, [], 0)

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => setIsEntering(true))
    return () => window.cancelAnimationFrame(frameId)
  }, [])

  const displayName = profileName || t('profile.userName')

  const openEditModal = () => {
    setEditName(profileName)
    setEditOpen(true)
    window.setTimeout(() => nameInputRef.current?.focus(), 80)
  }

  const handleSaveProfile = () => {
    setProfileName(editName)
    setEditOpen(false)
  }

  return (
    <div className="min-h-full">
      <div
        className={`ft-motion-page min-h-full space-y-4 transform-gpu ${
          isEntering ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
        }`}
      >
        {/* ── Hero profile card ── */}
        <section className="relative overflow-hidden rounded-[1.5rem] border border-[color-mix(in_srgb,var(--border)_80%,transparent)] bg-[var(--panel-strong)] shadow-[var(--shadow-card)]">
          {/* subtle elegant gradient */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: 'radial-gradient(ellipse 120% 120% at 50% -20%, color-mix(in srgb, var(--accent) 15%, transparent), transparent 70%)',
            }}
            aria-hidden="true"
          />

          <div className="relative flex flex-col items-center px-5 pb-8 pt-8">
            <div className="relative mb-4">
              {/* Profile Avatar Button */}
              <button
                type="button"
                onClick={() => setPhotoModalOpen(true)}
                className="group/avatar relative block rounded-full p-1 border-[2.5px] border-[color-mix(in_srgb,var(--accent)_30%,transparent)] bg-[var(--field-bg)] shadow-lg shadow-[color-mix(in_srgb,var(--accent)_20%,transparent)] transition hover:border-[var(--accent)] active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                title={t('profile.changePhoto', 'Ubah foto profil')}
                aria-label={t('profile.changePhoto', 'Ubah foto profil')}
              >
                <UserAvatar
                  size={88}
                  shape="circle"
                  className="w-[88px] h-[88px]"
                  border={false}
                />
                <div className="absolute inset-1 rounded-full bg-black/40 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex flex-col items-center justify-center text-white backdrop-blur-[1px]">
                  <Camera size={20} strokeWidth={2.2} />
                  <span className="text-[9px] font-black uppercase tracking-wider mt-0.5">
                    {t('profile.edit', 'Ubah')}
                  </span>
                </div>
              </button>

              {/* Camera badge trigger */}
              <button
                type="button"
                onClick={() => setPhotoModalOpen(true)}
                className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full border-2 border-[var(--panel-strong)] bg-[var(--fg)] text-[var(--bg)] shadow-md transition hover:scale-110 active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                aria-label={t('profile.changePhoto', 'Ubah foto profil')}
                title={t('profile.changePhoto', 'Ubah foto profil')}
              >
                <Camera size={14} strokeWidth={2.5} />
              </button>
            </div>

            <div className="flex items-center justify-center gap-1.5 mb-2 max-w-full">
              <h2 className="truncate text-center text-[22px] font-bold tracking-tight text-[var(--fg)]">
                {displayName}
              </h2>
              <button
                type="button"
                onClick={openEditModal}
                className="grid h-6 w-6 place-items-center rounded-full text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--field-bg)] transition-all active:scale-90 cursor-pointer shrink-0"
                title={t('profile.editName', 'Ubah nama')}
                aria-label={t('profile.editName', 'Ubah nama')}
              >
                <Pencil size={12.5} strokeWidth={2.2} />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--field-bg)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)] border border-[color-mix(in_srgb,var(--border)_50%,transparent)] shadow-sm">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-[var(--fg)]" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinejoin="round" />
                </svg>
                {authProvider === 'google'
                  ? `Google • ${authUserEmail || 'Connected'}`
                  : authProvider === 'email'
                  ? `Email • ${authUserEmail || 'Registered'}`
                  : authProvider === 'anonymous'
                  ? 'Akun Anonim (Tamu)'
                  : t('profile.badge.local')}
              </span>
            </div>
          </div>
        </section>

        {/* ── Stats row ── */}
        <section className="flex gap-3 ft-stagger-in">
          <ProfileStatCard
            value={txCount}
            label={t('profile.stats.transactions')}
            icon="tx"
          />
          <ProfileStatCard
            value={budgetCount}
            label={t('profile.stats.budgets')}
            icon="budget"
          />
          <ProfileStatCard
            value={goalsCount}
            label={t('profile.stats.goals')}
            icon="goals"
          />
        </section>

        {/* ── Account & prefs button ── */}
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className="group flex w-full items-center gap-4 rounded-[1.25rem] border border-[color-mix(in_srgb,var(--border)_80%,transparent)] bg-[var(--panel-strong)] px-5 py-4 text-left shadow-[var(--shadow-card)] transition hover:border-[color-mix(in_srgb,var(--accent)_40%,transparent)] active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[0.85rem] bg-[color-mix(in_srgb,var(--accent)_12%,var(--field-bg))] text-[var(--accent)] border border-[color-mix(in_srgb,var(--accent)_25%,transparent)] shadow-sm transition group-hover:scale-105">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" strokeLinejoin="round" />
              <path d="M4 21a8 8 0 0 1 16 0" strokeLinecap="round" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14.5px] font-bold text-[var(--fg)] group-hover:text-[var(--accent)] transition-colors">{t('profile.accountPrefs')}</p>
            <p className="mt-0.5 text-[11.5px] font-medium text-[var(--muted)]">{t('profile.accountPrefsDesc')}</p>
          </div>
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-[var(--muted-2)] transition-transform group-hover:translate-x-1 group-hover:text-[var(--accent)]" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* ── Shortcuts ── */}
        <div>
          <h2 className="mb-2.5 px-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-2)]">
            {t('profile.section.shortcuts')}
          </h2>
          <div className="overflow-hidden rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel-strong)] shadow-[var(--shadow-card)] divide-y divide-[color-mix(in_srgb,var(--border)_65%,transparent)]">
            <ShortcutRow
              icon="settings"
              label={t('profile.menu.settings')}
              sublabel={t('profile.menu.settingsSub')}
              onClick={() => navigate('/settings')}
            />
            <ShortcutRow
              icon="calendar"
              label={t('profile.menu.calendar')}
              sublabel={t('profile.menu.calendarSub')}
              onClick={() => navigate('/calendar')}
            />
            <ShortcutRow
              icon="reports"
              label={t('profile.menu.reports')}
              sublabel={t('profile.menu.reportsSub')}
              onClick={() => navigate('/reports')}
            />
            <ShortcutRow
              icon="loans"
              label={t('profile.menu.loans') || 'Utang & Piutang'}
              sublabel={t('profile.menu.loansSub') || 'Kelola utang & tagihan piutang'}
              onClick={() => navigate('/loans')}
            />
            <ShortcutRow
              icon="todo"
              label={t('profile.menu.todos')}
              sublabel={t('profile.menu.todosSub')}
              onClick={() => navigate('/todos')}
            />
          </div>
        </div>

        {/* ── Version footer ── */}
        <div className="flex items-center justify-center gap-2 pb-1">
          <div className="h-px flex-1 bg-[color-mix(in_srgb,var(--border)_50%,transparent)]" />
          <div className="mt-8 text-center text-[11px] font-medium text-[var(--muted-2)] uppercase tracking-widest">
            {t('profile.version', { value: '4.5.0' })}
          </div>
          <div className="h-px flex-1 bg-[color-mix(in_srgb,var(--border)_50%,transparent)]" />
        </div>
      </div>

      {/* ── Edit profile modal ── */}
      <Modal isOpen={editOpen} title={t('profile.editModal.title')} onClose={() => setEditOpen(false)}>
        <div className="space-y-4">
          <div>
            <label htmlFor="edit-profile-name" className="mb-1.5 block text-[13px] font-medium text-[var(--fg)]">
              {t('profile.editModal.name')}
            </label>
            <input
              ref={nameInputRef}
              id="edit-profile-name"
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveProfile() }}
              placeholder={t('profile.editModal.namePlaceholder')}
              maxLength={40}
              className="ft-field mt-0"
            />
          </div>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={handleSaveProfile}
              className="ft-btn-primary flex-1 py-2.5"
            >
              {t('profile.editModal.save')}
            </button>
            <button
              type="button"
              onClick={() => setEditOpen(false)}
              className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] py-2.5 text-[13px] font-semibold text-[var(--fg)] transition hover:bg-[color-mix(in_srgb,var(--field-bg)_90%,var(--accent))]"
            >
              {t('profile.editModal.cancel')}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Change Photo Modal ── */}
      <ChangePhotoModal isOpen={photoModalOpen} onClose={() => setPhotoModalOpen(false)} />
    </div>
  )
}

export default Profile
