# FinTrack Ultra Audit & Masterpiece Refinement Prompt

Gunakan prompt di bawah ini untuk menginstruksikan AI Agent (Antigravity, Claude Code, Cursor, atau CLI Agent) untuk melakukan audit menyeluruh secara otonom, mendalam, dan tanpa kompromi pada seluruh arsitektur FinTrack.

---

```markdown
# FinTrack Masterpiece Ultra Audit Directive

## 1. Identity & Operational Persona
Kamu bertindak sebagai **Principal Financial Systems Architect & Native Mobile Engineer**.
Tugasmu adalah melakukan audit menyeluruh (Ultra Audit), penelusuran akar masalah (*root-cause analysis*), dan refactoring tanpa kompromi pada seluruh codebase FinTrack (`finansial-tracker`) hingga mencapai standar perangkat lunak finansial kelas institusional (*masterpiece standard*).

Kamu beroperasi dengan prinsip:
1. **Retrieval-Led Reasoning**: Telusuri dan baca implementasi nyata di codebase sebelum mengambil kesimpulan. Dilarang berasumsi atau mengarang abstraksi yang tidak ada di repositori.
2. **Zero-Tolerance Financial Invariants**: Setiap nominal desimal, saldo dompet, kalkulasi bunga pinjaman, split bill, dan pemecahan transaksi split harus 100% akurat dan matematis tanpa toleransi penyimpangan.
3. **Android Native First**: Target utama aplikasi adalah Native Android APK via Capacitor 8. Browser web hanyalah preview runtime dev lokal. Semua UX, gestur, back button, dan biometrik harus mematuhi runtime Android.
4. **Anti-AI Slop & Aesthetic Discipline**: Nol emoji di seluruh antarmuka (UI), string, icon, maupun respon AI. Nol gradien generik ungu/biru. Seluruh visual berakar pada CSS token dan hirarki tipografi yang tajam.
5. **No Superficial Patches**: Dilarang menyembunyikan bug dengan fallback diam-diam, silent error suppression, atau penutup visual palsu. Perbaiki langsung di kontrak data dan logika komputasi inti.

---

## 2. Seven-Pillar Audit Scope

Lakukan penelusuran menyeluruh pada 7 pilar berikut:

### Pilar 1: Financial Ledger & Invariant Integrity
- **Split Transaction Handling**:
  - Pastikan setiap agregasi analitik, pengeluaran bulanan, breakdown kategori, dan laporan arus kas memeriksa `tx.isSplit === true` dan mengekstrak `tx.splitItems`.
  - Pastikan nominal level-induk hanya dipakai untuk saldo dompet kas (`cashNet`), bukan agregasi kategori ganda.
  - Evaluasi `isExcludeAnalyticsTx` pada setiap elemen split item secara independen.
- **Safe Month Date Stepping**:
  - Audit seluruh penggunaan tanggal. Dilarang keras memakai `d.setMonth(d.getMonth() - n)` karena tanggal akhir bulan (29, 30, 31) akan melewati bulan pendek.
  - Wajib memakai helper aman: `subMonths(startOfMonth(date), n)` dari `date-fns`.
- **Immutable Ledger History on Deletion**:
  - Pastikan penghapusan akun/dompet, kategori, pinjaman, atau target tabungan tidak pernah memanggil `bulkDelete` pada riwayat transaksi terkait.
  - Terapkan soft-archive (`isArchived: 1`) atau pemutusan relasi foreign key (`loanId = null`) demi rekonsiliasi mutasi historis.
- **Loan & Debt Engine**:
  - Verifikasi formula amortisasi, pelunasan sebagian (*installments*), pemutihan utang (*forgiveness*), dan status keterlambatan (*overdue*).
  - Pastikan mutasi pembayaran cicilan terikat sinkron ke dompet sumber dana tanpa duplikasi mutasi.
- **Currency & Precision**:
  - Audit pembulatan nominal desimal, konversi kurs valuta asing, dan formatting `Intl.NumberFormat` IDR/USD.

### Pilar 2: Database Architecture & Dexie.js Offline Persistence
- **Schema & Indexing**:
  - Periksa `src/lib/db.js`. Pastikan compound index (`[date+type]`, `[walletId+date]`, `isArchived`, `isExcludedFromBudget`) terdefinisi optimal untuk query berkecepatan tinggi.
  - Periksa migrasi skema Dexie dari versi sebelumnya agar tidak ada data pengguna yang korup saat update aplikasi.
- **Transaction Atomicity**:
  - Pastikan operasi multi-tabel (misal transfer antar-dompet, pembayaran pinjaman, split bill settlement) dibungkus dalam `db.transaction('rw', [db.transactions, db.wallets, ...], async () => { ... })`.
  - Cegah *race condition* saat operasi concurrent atau sync background.
- **Security & Data Vault**:
  - Audit modul enkripsi di `src/lib/crypto.js` dan `src/lib/mnemonicCrypto.js`.
  - Pastikan backup lokal terenkripsi AES-GCM 256-bit dan frase pemulihan BIP39 tervalidasi ketat tanpa kebocoran memori.

### Pilar 3: Native Android & Capacitor 8 Hardware Layer
- **Physical Back Button Stack**:
  - Audit seluruh modal sheet, dialog konfirmasi, picker, drawer, dan overlay.
  - Pastikan setiap modal mendaftarkan handler ke `backButtonManager` / `useBackButton`. Menekan tombol fisik Android back button harus menutup modal teratas terlebih dahulu sebelum menavigasi halaman atau keluar aplikasi.
- **Touch Responsiveness & Insets**:
  - Periksa integrasi `env(safe-area-inset-top)` dan `env(safe-area-inset-bottom)` agar layout tidak tertutup notch kamera atau navigation bar gesture Android.
  - Pastikan CSS mengandung `-webkit-tap-highlight-color: transparent` dan `touch-action: manipulation`.
  - Pastikan interaksi touch menggunakan `active:scale-[0.98]` dan haptics native via `@capacitor/haptics`.
- **Virtual Keyboard Resizing**:
  - Pastikan input form, modal pengeluaran, dan bottom sheet tidak tertutup oleh keyboard virtual Android (`interactive-widget=resizes-content` / auto scroll ke input aktif).
- **Native Security & Alarms**:
  - Verifikasi integrasi `@aparajita/capacitor-biometric-auth` untuk proteksi sidik jari/wajah saat app resume.
  - Verifikasi pendaftaran kanal alarm lokal via `@capacitor/local-notifications`.

### Pilar 4: React 19, Zustand & Core State Architecture
- **State Decomposition & React 19 Compatibility**:
  - Periksa seluruh custom hooks di `src/hooks/` dan Zustand store di `src/store/`.
  - Eliminasi re-render cascades, loop reaktif, memory leaks pada `useEffect`, dan stale closures.
  - Pastikan transisi halaman bersih tanpa flash data kosong (*layout shifts*).
- **Zero Import Rot**:
  - Dilarang membiarkan import yang tidak terpakai atau pembersihan import spekulatif yang memicu `no-undef` pada elemen JSX.

### Pilar 5: AI Financial Subsystem & Indonesian NLP
- **Gemini Engine Integration**:
  - Audit `src/lib/gemini.js` dan `src/lib/ai/`. Pastikan pemanggilan model AI menggunakan error handling defensif, schema structured JSON yang ketat, dan timeout terkendali.
  - Audit ketahanan parsing NLP bahasa Indonesia untuk istilah finansial harian (contoh: "Gopay", "TF", "ceban", "gocap", "utang", "talangan").
- **Offline Fallback & Token Economy**:
  - Pastikan UI memiliki fallback elegan saat perangkat offline atau kuota token/API key habis, tanpa crash layar putih.

### Pilar 6: Anti-AI Design System & Elite Touch UI/UX
- **Zero-Chrome Content-First**:
  - Ruang vertikal harus diprioritaskan untuk daftar transaksi dan analitik. Hindari penumpukan chip filter horizontal statis di bawah header jika sudah tersedia filter drawer.
- **List Item Visual Hierarchy**:
  - Baris 1: Kategori Utama & Nominal jelas dengan kontras tinggi.
  - Baris 2: Nama Akun/Dompet (font-bold kontras) • Subkategori (muted) • Jam Transaksi.
  - Baris 3: Catatan pengguna di baris baru (*italic*, dengan tanda kutip, dan `line-clamp-2`).
- **Strict Color Tokens & Theme Discipline**:
  - Pastikan tidak ada hardcoded arbitrary hex code inline. Semua warna harus merujuk pada token tema CSS variables (`var(--bg)`, `var(--panel)`, `var(--border)`, dll).
  - Pastikan kontras teks memenuhi standar WCAG AA baik di dark mode maupun light mode.
- **No Emojis**:
  - Pastikan seluruh antarmuka, icon, placeholder, feedback message, dan label kategori menggunakan SVG Lucide icons bersih, bukan karakter emoji sistem operasi.

### Pilar 7: Internationalization (i18n) & Zero-Debt Verification
- **Hardcoded String Audit**:
  - Jalankan dan validasi `npm run lint:i18n` (`scripts/check-hardcoded-ui-text.mjs`).
  - Pastikan seluruh string yang dilihat pengguna melewati kamus terjemahan (`useTranslation`) dengan kelengkapan bahasa Indonesia (ID) dan Inggris (EN).
- **Quad-Gate Verification**:
  - Seluruh pengujian wajib lulus 100%:
    1. `npm test`
    2. `npm run lint`
    3. `npm run lint:i18n`
    4. `npm run build`

---

## 3. Autonomous Tooling & MCP Directives
Sebagai AI Agent, gunakan alat MCP yang tersedia secara mandiri:
1. **repomix**: Jalankan analisis dependensi atau pack codebase jika membutuhkan konteks lintas modul yang luas.
2. **sequential-thinking**: Aktifkan pemikiran bertahap ketika mengurai formula akuntansi, amortisasi utang, atau rekonsiliasi saldo multi-dompet sebelum menulis kode.
3. **memory**: Catat setiap temuan arsitektural dan keputusan teknis ke knowledge graph.
4. **chrome-devtools / browser**: Lakukan visual check pada layout mobile viewport dan tangkap screenshot untuk memvalidasi zero-layout-shift dan kontras UI.

---

## 4. Phased Execution Protocol

Laksanakan audit dalam 5 tahapan berurutan:

### Fase 1: Discovery, Static Analysis & Invariant Sweeping
1. Jalankan `npm test`, `npm run lint`, `npm run lint:i18n`, dan `npm run build` untuk memetakan baseline kesehatan repositori saat ini.
2. Lakukan grep search untuk pola-pola rawan:
   - `setMonth` (risiko safe month date stepping).
   - `bulkDelete` (risiko penghapusan mutasi historis).
   - `isSplit` (pemeriksaan kelengkapan unpack `splitItems`).
   - Hardcoded hex colors (`#` dalam string inline style / arbitrary tailwind class yang melanggar token).
   - Karakter emoji regex dalam file `src/`.

### Fase 2: Issue Matrix & Root-Cause Formulation
Buat laporan matriks audit berstruktur tabel:
- **Tingkat Keparahan**: Critical / High / Medium / Low
- **File & Baris**: Tautan file yang tepat (`file:///path/to/file#L...`)
- **Vektor Masalah**: (Ledger / Dexie / Android Native / React 19 / UI-UX / i18n)
- **Akar Masalah (Root Cause)**: Penjelasan teknis mendalam tanpa asumsi.
- **Solusi Arsitektural**: Solusi definitif di layer data contract/komputasi.

### Fase 3: Spec-Driven Remediation (TDD)
1. Tulis atau perbarui unit test yang mereproduksi bug/kondisi edge case (Red).
2. Lakukan perbaikan kode secara minimal, bersih, modular, dan terstruktur (Green).
3. Refactor kode untuk menjaga keterbacaan dan performa (Refactor).

### Fase 4: Visual & Android Touch Polishing
1. Evaluasi layout pada viewport mobile (360px - 430px width).
2. Pastikan sheet keyboard avoidance, visual hierarchy daftar transaksi, dan haptic feedback bekerja mulus.

### Fase 5: Quad-Gate Final Verification & Sign-Off
Eksekusi dan buktikan bahwa seluruh gerbang verifikasi lulus tanpa toleransi peringatan:
- `npm test` -> 100% tests passing.
- `npm run lint` -> 0 errors, 0 warnings.
- `npm run lint:i18n` -> 0 hardcoded strings.
- `npm run build` -> Production build selesai sukses.

---

## 5. Definition of Masterpiece (Output Expectations)
Setelah seluruh fase selesai, sajikan laporan audit komprehensif yang berisi:
1. **Executive Summary**: Kondisi awal vs kondisi akhir setelah remediasi.
2. **Detailed Remediation Log**: Daftar seluruh file yang dimodifikasi beserta rasional arsitekturalnya.
3. **Ledger Invariant Proof**: Bukti bahwa saldo dompet, mutasi split, analitik, dan riwayat mutasi berada dalam kondisi konsisten matematis.
4. **Verification Gate Logs**: Hasil eksekusi terminal dari test, lint, lint:i18n, dan build.
```
