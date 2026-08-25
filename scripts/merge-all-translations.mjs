import fs from 'node:fs';

const idModule = await import('../src/locales/id.js');
const enModule = await import('../src/locales/en.js');
const currentId = { ...idModule.default };
const currentEn = { ...enModule.default };

const allMissing = JSON.parse(fs.readFileSync('./scripts/all-missing-keys.json', 'utf8'));

// Full comprehensive mappings
const explicitTranslations = {
  // Auth
  'auth.sendResetLink': { id: 'Kirim Tautan Reset Sandi', en: 'Send Password Reset Link' },
  'auth.backToSignIn': { id: 'Kembali ke Halaman Masuk', en: 'Back to Sign In' },
  'auth.magicLinkHowItWorks': { id: 'Cara Kerja Magic Link:', en: 'How Magic Link Works:' },
  'auth.magicLinkInstruction': { id: 'Masukkan email Anda, buka email di perangkat ini, dan klik tautan masuk. Anda akan langsung masuk ke FinTrack secara otomatis tanpa perlu mengingat kata sandi.', en: 'Enter your email, open the link on this device, and you will be signed into FinTrack automatically without needing a password.' },
  'auth.usePasswordInstead': { id: 'Masuk dengan Kata Sandi Biasa', en: 'Sign in with Password' },
  'auth.emailVerifiedSuccessTitle': { id: 'Email Berhasil Terverifikasi!', en: 'Email Successfully Verified!' },
  'auth.emailVerifiedSuccessSubtitle': { id: 'Akun Anda telah diamankan & terhubung.', en: 'Your account is secured & connected.' },
  'auth.passwordPlaceholder': { id: 'Masukkan kata sandi...', en: 'Enter password...' },
  'auth.namePlaceholder': { id: 'Nama lengkap Anda...', en: 'Your full name...' },
  'auth.loginAction': { id: 'Masuk', en: 'Sign In' },
  'auth.registerAction': { id: 'Daftar Akun', en: 'Register' },
  'auth.haveAccount': { id: 'Sudah punya akun? Masuk', en: 'Already have an account? Sign in' },
  'auth.noAccount': { id: 'Belum punya akun? Daftar sekarang', en: "Don't have an account? Sign up" },

  // Common
  'common.color': { id: 'Warna', en: 'Color' },
  'common.duplicate': { id: 'Duplikat', en: 'Duplicate' },
  'common.unlock': { id: 'Buka Kunci', en: 'Unlock' },
  'common.lock': { id: 'Kunci', en: 'Lock' },
  'common.connect': { id: 'Hubungkan', en: 'Connect' },
  'common.copyRef': { id: 'Salin No. Referensi', en: 'Copy Reference No.' },
  'common.loading': { id: 'Memuat...', en: 'Loading...' },
  'common.disabled': { id: 'Nonaktif', en: 'Disabled' },
  'common.today': { id: 'Hari Ini', en: 'Today' },
  'common.yesterday': { id: 'Kemarin', en: 'Yesterday' },
  'common.backToDashboard': { id: 'Kembali ke Dashboard', en: 'Back to Dashboard' },
  'common.clearSearch': { id: 'Hapus pencarian', en: 'Clear search' },
  'common.reset': { id: 'Reset', en: 'Reset' },
  'common.loadMore': { id: 'Tampilkan Lebih Banyak', en: 'Load More' },
  'common.balanceHidden': { id: 'Saldo disembunyikan', en: 'Balance hidden' },
  'common.modal': { id: 'Modal', en: 'Modal' },
  'common.clear': { id: 'Hapus', en: 'Clear' },
  'common.save': { id: 'Simpan', en: 'Save' },
  'common.expense': { id: 'Pengeluaran', en: 'Expense' },
  'common.income': { id: 'Pemasukan', en: 'Income' },

  // Board
  'board.typeSomething': { id: 'Ketik sesuatu...', en: 'Type something...' },
  'board.textPlaceholder': { id: 'Teks...', en: 'Text...' },
  'board.groupNamePlaceholder': { id: 'Nama Grup', en: 'Group Name' },
  'board.deleteFrame': { id: 'Hapus Frame', en: 'Delete Frame' },
  'board.typeTextPlaceholder': { id: 'Ketik teks...', en: 'Type text...' },
  'board.emojiPlaceholder': { id: 'Pilih Icon...', en: 'Select Icon...' },
  'board.checklistTitlePlaceholder': { id: 'Judul Checklist...', en: 'Checklist Title...' },
  'board.itemPlaceholder': { id: 'Item...', en: 'Item...' },
  'board.resize': { id: 'Ubah Ukuran', en: 'Resize' },

  // Dashboard
  'dashboard.categoriesMonitored': { id: 'Kategori Terpantau', en: 'Categories Tracked' },
  'dashboard.monitorLimits': { id: 'Pantau batas pengeluaran', en: 'Monitor spending limits' },
  'dashboard.activeGoals': { id: 'Target Aktif', en: 'Active Goals' },
  'dashboard.dreamProgress': { id: 'Progres tujuan impian', en: 'Dream goal progress' },
  'dashboard.spentPct': { id: 'Terpakai', en: 'Spent' },
  'dashboard.collectedPct': { id: 'Terkumpul', en: 'Collected' },

  // Budget
  'budget.createQuick': { id: 'Buat Anggaran Cepat', en: 'Create Quick Budget' },
  'budget.manageCategories': { id: 'Kelola Kategori Anggaran', en: 'Manage Budget Categories' },
  'budget.noActiveBudgets': { id: 'Belum Ada Anggaran Aktif', en: 'No Active Budgets' },
  'budget.monthlyBudgetDesc': { id: 'Tetapkan batas pengeluaran per kategori setiap bulan.', en: 'Set monthly spending limits for each category.' },

  // Savings
  'savings.namePlaceholder': { id: 'Beli Rumah, Dana Darurat, Liburan...', en: 'House Down Payment, Emergency Fund, Vacation...' },
  'savings.newGoal': { id: 'Target Baru', en: 'New Goal' },
  'savings.completedAndCashed': { id: 'Selesai & Dicairkan', en: 'Completed & Withdrawn' },
  'savings.remainingShort': { id: 'Kurang', en: 'Short' },
  'savings.goalReached': { id: 'Target 100% Tercapai!', en: 'Goal 100% Achieved!' },
  'savings.emptyLogsTitle': { id: 'Belum Ada Riwayat', en: 'No Logs Yet' },
  'savings.emptyLogsDesc': { id: 'Tekan tombol Tambah Tabungan di bawah untuk mulai menabung.', en: 'Tap Add Savings button below to start saving.' },
  'savings.congratsGoalReached': { id: 'Selamat! Target 100% Tercapai', en: 'Congratulations! 100% Goal Achieved' },

  // Loans
  'loans.addTitle': { id: 'Tambah Catatan Pinjaman', en: 'Add Loan Record' },
  'loans.editTitle': { id: 'Ubah Catatan Pinjaman', en: 'Edit Loan Record' },
  'loans.debtLent': { id: 'Piutang (Dipinjamkan)', en: 'Receivable (Lent)' },
  'loans.debtBorrowed': { id: 'Hutang (Dipinjam)', en: 'Debt (Borrowed)' },
  'loans.remaining': { id: 'Sisa Pembayaran', en: 'Remaining Balance' },
  'loans.dueIn': { id: 'Jatuh tempo dalam {{days}} hari', en: 'Due in {{days}} days' },
  'loans.overdue': { id: 'Terlambat {{days}} hari', en: 'Overdue by {{days}} days' },
  'loans.settled': { id: 'Lunas', en: 'Settled' },
  'loans.moreReceivable': { id: 'piutang lebih dominan', en: 'more receivables' },
  'loans.moreDebt': { id: 'utang lebih dominan', en: 'more debt' },

  // Transactions & Filters
  'tx.today': { id: 'HARI INI', en: 'TODAY' },
  'tx.yesterday': { id: 'KEMARIN', en: 'YESTERDAY' },
  'tx.duplicateSuccess': { id: 'Transaksi berhasil diduplikasi ke hari ini.', en: 'Transaction successfully duplicated to today.' },
  'tx.menu.bulkEdit': { id: 'Edit Massal (Bulk)', en: 'Bulk Edit' },
  'tx.menu.splitBill': { id: 'Bagi Tagihan (Split Bill)', en: 'Split Bill' },
  'tx.filter.thisMonth': { id: 'Bulan Ini', en: 'This Month' },
  'tx.filter.today': { id: 'Hari Ini', en: 'Today' },
  'tx.filter.allTime': { id: 'Semua', en: 'All Time' },
  'tx.filter.custom': { id: 'Kustom', en: 'Custom' },
  'tx.filter.type': { id: 'Tipe Transaksi', en: 'Transaction Type' },
  'tx.income': { id: 'Pemasukan', en: 'Income' },
  'tx.expense': { id: 'Pengeluaran', en: 'Expense' },
  'tx.transfer': { id: 'Transfer', en: 'Transfer' },
  'tx.filter.allAccounts': { id: 'Semua Akun', en: 'All Accounts' },
  'tx.autoRecurringTooltip': { id: 'Otomatis dari jadwal berulang', en: 'Automatic recurring schedule' },
  'reports.netFlow': { id: 'Arus Kas', en: 'Net Flow' },
  'addTx.amountRequired': { id: 'Nominal harus lebih dari 0.', en: 'Amount must be greater than 0.' },
  'calendar.deleteAgenda': { id: 'Hapus Agenda', en: 'Delete Agenda' },

  // Wallets
  'wallets.title': { id: 'Akun / Dompet', en: 'Wallets / Accounts' },
  'wallets.notFound': { id: 'Akun Tidak Ditemukan', en: 'Wallet Not Found' },
  'wallets.options': { id: 'Opsi Akun', en: 'Wallet Options' },
  'wallets.primaryBadge': { id: 'Akun Utama', en: 'Primary Wallet' },
  'wallets.adjustBalance': { id: 'Penyesuaian Saldo', en: 'Adjust Balance' },
  'wallets.emptyTxTitle': { id: 'Belum Ada Transaksi', en: 'No Transactions Yet' },
  'wallets.optionsTitle': { id: 'Opsi Akun Dompet', en: 'Wallet Options' },
  'wallets.deleteTitle': { id: 'Hapus Dompet', en: 'Delete Wallet' },
  'wallets.editTitle': { id: 'Ubah Info Dompet', en: 'Edit Wallet Info' },
  'wallets.nameLabel': { id: 'Nama Dompet / Akun *', en: 'Wallet / Account Name *' },
  'wallets.namePlaceholder': { id: 'Contoh: BCA Utama, Mandiri Tabungan', en: 'Example: Checking, Savings, Cash' },
  'wallets.accountNumberLabel': { id: 'Nomor Rekening / ID Akun (Opsional)', en: 'Account Number / ID (Optional)' },
  'wallets.notesLabel': { id: 'Catatan (Opsional)', en: 'Notes (Optional)' },
  'wallets.notesPlaceholder': { id: 'Catatan penggunaan akun...', en: 'Account notes or purpose...' },
  'wallets.selectPlaceholder': { id: 'Pilih Dompet', en: 'Select Wallet' },
  'wallets.recommendedBadge': { id: 'Populer', en: 'Popular' },

  // Currency
  'currency.refreshRates': { id: 'Segarkan Nilai Kurs', en: 'Refresh Exchange Rates' },
  'currency.swapCurrencies': { id: 'Tukar Mata Uang', en: 'Swap Currencies' },

  // Settings
  'settings.category': { id: 'Kategori', en: 'Category' },
  'settings.resetDefault': { id: 'Reset ke Bawaan', en: 'Reset to Default' },
  'settings.categoriesDesc': { id: 'Kelola daftar kategori dan subkategori sesuai kebiasaan finansial Anda', en: 'Manage categories and subcategories tailored to your financial habits' },
  'settings.noCategoriesFound': { id: 'Tidak ada kategori yang cocok dengan pencarian', en: 'No categories matched your search' },
  'settings.addCategory': { id: 'Tambah Kategori', en: 'Add Category' },
  'settings.addSubcategory': { id: 'Tambah Subkategori', en: 'Add Subcategory' },
  'settings.deleteSubcategory': { id: 'Hapus Subkategori', en: 'Delete Subcategory' },
  'settings.addSubcategoryTitle': { id: 'Tambah Subkategori Baru', en: 'Add New Subcategory' },
  'settings.subNameId': { id: 'Nama Subkategori (Bahasa Indonesia) *', en: 'Subcategory Name (Indonesian) *' },
  'settings.subPlaceholderId': { id: 'Contoh: Kopi Kekinian, Donat, Susu', en: 'Example: Specialty Coffee, Donuts' },
  'settings.subNameEn': { id: 'Nama Subkategori (English - Opsional)', en: 'Subcategory Name (English - Optional)' },
  'settings.subPlaceholderEn': { id: 'Example: Specialty Coffee, Donuts', en: 'Example: Specialty Coffee, Donuts' },
  'settings.addIncomeCategoryTitle': { id: 'Tambah Kategori Utama Pemasukan', en: 'Add Primary Income Category' },
  'settings.catNameId': { id: 'Nama Kategori (Bahasa Indonesia) *', en: 'Category Name (Indonesian) *' },
  'settings.catPlaceholderId': { id: 'Contoh: Freelance, Dividen, Royalti', en: 'Example: Freelance, Dividends, Royalties' },
  'settings.catNameEn': { id: 'Nama Kategori (English - Opsional)', en: 'Category Name (English - Optional)' },
  'settings.catPlaceholderEn': { id: 'Example: Freelance, Dividends, Royalties', en: 'Example: Freelance, Dividends, Royalties' },
  'settings.deleteSubConfirm': { id: 'Hapus subkategori ini? Transaksi yang ada akan tetap tersimpan.', en: 'Delete this subcategory? Existing transactions will remain intact.' },
  'settings.subAddedSuccess': { id: 'Subkategori berhasil ditambahkan.', en: 'Subcategory added successfully.' },
  'settings.catAddedSuccess': { id: 'Kategori utama berhasil ditambahkan.', en: 'Primary category added successfully.' },
  'settings.subRemovedSuccess': { id: 'Subkategori berhasil dihapus dan riwayat transaksi dialihkan ke Lainnya.', en: 'Subcategory removed and existing transactions moved to Other.' },
  'settings.apiKeySaved': { id: 'API Key Gemini berhasil disimpan!', en: 'Gemini API Key saved successfully!' },
  'settings.apiKeyCleared': { id: 'API Key dikembalikan ke kuota bawaan sistem.', en: 'API Key reset to system default.' },

  'settings.backup.exportSuccess': { id: 'Data cadangan berhasil diunduh (JSON).', en: 'Backup data downloaded successfully (JSON).' },
  'settings.deleteAccount.needConfirm': { id: 'Ketik HAPUS untuk mengonfirmasi.', en: 'Type DELETE to confirm.' },
  'settings.backup.sectionTitle': { id: 'Cadangan & Pemulihan', en: 'Backup & Restore' },
  'settings.backup.description': { id: 'Ekspor seluruh transaksi dan pengaturan ke berkas JSON lokal untuk cadangan mandiri.', en: 'Export all transactions and settings to a local JSON file for backup.' },
  'settings.backup.exportJson': { id: 'Unduh Cadangan JSON', en: 'Download JSON Backup' },
  'settings.backup.importTitle': { id: 'Pulihkan Data Cadangan', en: 'Restore Backup Data' },
  'settings.deleteAccount.title': { id: 'Hapus Akun Permanen', en: 'Permanently Delete Account' },
  'settings.deleteAccount.button': { id: 'Hapus Akun Permanen', en: 'Permanently Delete Account' },
  'settings.deleteAccount.modalTitle': { id: 'Konfirmasi Hapus Akun Permanen', en: 'Confirm Permanent Account Deletion' },
  'settings.deleteAccount.warningHeader': { id: 'Peringatan: Tindakan ini tidak dapat dibatalkan!', en: 'Warning: This action cannot be undone!' },
  'settings.deleteAccount.modalDesc': { id: 'Untuk mengonfirmasi penghapusan akun, silakan ketik', en: 'To confirm account deletion, please type' },
  'settings.deleteAccount.modalDescSuffix': { id: 'di bawah ini.', en: 'below.' },
  'settings.deleteAccount.modalType': { id: 'Ketik HAPUS', en: 'Type DELETE' },
  'settings.deleteAccount.confirmBtn': { id: 'Hapus Akun Permanen', en: 'Permanently Delete Account' },
  'settings.recurring.addTitle': { id: 'Tambah Jadwal Otomatis', en: 'Add Recurring Schedule' },
  'settings.recurring.placeholder': { id: 'Contoh: Gaji Bulanan, Tagihan WiFi, Netflix', en: 'Example: Monthly Salary, WiFi Bill, Netflix' },
  'settings.recurring.activeList': { id: 'Daftar Jadwal Transaksi', en: 'Recurring Transaction Schedules' },
  'settings.recurring.footnote': { id: 'Transaksi akan otomatis dicatat pada dashboard dan saldo akun saat tanggal jatuh tempo tercapai.', en: 'Transactions will be automatically posted to your dashboard and balance on their due date.' },
  'recurring.editTitle': { id: 'Ubah Jadwal Otomatis', en: 'Edit Recurring Schedule' },
  'calendar.selectDate': { id: 'Pilih Tanggal', en: 'Select Date' },
  'settings.securityBioSaved': { id: 'Kunci sidik jari / sandi bawaan HP berhasil diaktifkan!', en: 'Biometric / device screen lock enabled successfully!' },
  'settings.securityDisabledSuccess': { id: 'Kunci aplikasi dinonaktifkan.', en: 'App lock disabled.' },
  'settings.securityTimeoutSaved': { id: 'Waktu kunci otomatis berhasil diperbarui!', en: 'Auto-lock timeout updated successfully!' },
  'settings.biometricFootnote': { id: 'Aplikasi menggunakan keamanan bawaan HP (Sidik Jari, Face Unlock, atau Pola/PIN layar HP). Anda tidak perlu menghafal PIN terpisah.', en: 'FinTrack utilizes native device security (Fingerprint, Face Unlock, or screen PIN/pattern). No separate PIN required.' },

  // Todo
  'todo.emptyState.title': { id: 'Tidak ada tugas', en: 'No tasks found' },
  'todo.addBtn': { id: 'Tambah Tugas', en: 'Add Task' },
  'todo.cat.lainnya': { id: 'Lainnya', en: 'Other' },
  'todo.cat.keuangan': { id: 'Keuangan', en: 'Finance' },
  'todo.cat.belanja': { id: 'Belanja', en: 'Shopping' },
  'todo.cat.pekerjaan': { id: 'Pekerjaan', en: 'Work' },
  'todo.cat.pribadi': { id: 'Pribadi', en: 'Personal' },
  'todo.priority.low': { id: 'Rendah', en: 'Low' },
  'todo.priority.medium': { id: 'Sedang', en: 'Medium' },
  'todo.priority.high': { id: 'Tinggi', en: 'High' },
  'todo.priority.urgent': { id: 'Mendesak', en: 'Urgent' }
};

// Check all items in allMissing and map any remaining
for (const item of allMissing) {
  const k = item.key;
  if (!explicitTranslations[k]) {
    const fb = (item.fallbacks && item.fallbacks[0]) || k;
    explicitTranslations[k] = { id: fb, en: fb };
  }
}

// Add to currentId and currentEn
for (const [key, val] of Object.entries(explicitTranslations)) {
  currentId[key] = val.id;
  currentEn[key] = val.en;
}

// Also ensure every key in currentId is in currentEn and vice versa
for (const k of Object.keys(currentId)) {
  if (!currentEn[k]) {
    currentEn[k] = currentId[k];
  }
}
for (const k of Object.keys(currentEn)) {
  if (!currentId[k]) {
    currentId[k] = currentEn[k];
  }
}

// Clean emojis from strings if any exist
const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu;
for (const k of Object.keys(currentId)) {
  currentId[k] = currentId[k].replace(emojiRegex, '').trim();
  currentEn[k] = currentEn[k].replace(emojiRegex, '').trim();
}

function serializeDictionary(dict) {
  const keys = Object.keys(dict).sort();
  const lines = ['export default {'];
  for (const k of keys) {
    const val = dict[k].replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
    lines.push(`    '${k}': '${val}',`);
  }
  lines.push('};');
  lines.push('');
  return lines.join('\n');
}

fs.writeFileSync('./src/locales/id.js', serializeDictionary(currentId));
fs.writeFileSync('./src/locales/en.js', serializeDictionary(currentEn));

console.log(`Updated ID dictionary with ${Object.keys(currentId).length} keys.`);
console.log(`Updated EN dictionary with ${Object.keys(currentEn).length} keys.`);
