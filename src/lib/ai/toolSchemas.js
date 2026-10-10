/**
 * Function Declarations and Tool Schemas for Gemini Function Calling
 * Canonical Single Source of Truth across FinTrack
 */
export const getTools = () => [
  {
    functionDeclarations: [
      {
        name: 'record_transactions',
        description:
          "Catat satu atau banyak transaksi baru ke database. Panggil ini JIKA user menyebutkan data pemasukan atau pengeluaran baru yang ingin dicatat (misal: 'beli kopi 20rb', 'dapat struk belanja', dll).",
        parameters: {
          type: 'OBJECT',
          properties: {
            transactions: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  type: { type: 'STRING', enum: ['income', 'expense', 'transfer'] },
                  category: { type: 'STRING', description: 'ID kategori dari daftar.' },
                  amount: { type: 'NUMBER', description: 'Nominal positif angka murni tanpa pemisah titik.' },
                  currency: {
                    type: 'STRING',
                    description:
                      'Kode mata uang 3-huruf ISO (IDR, USD, SGD, MYR, EUR, JPY, GBP) yang terdeteksi pada transaksi atau struk.',
                  },
                  date: { type: 'STRING', description: 'YYYY-MM-DD' },
                  time: {
                    type: 'STRING',
                    description: 'Waktu transaksi dalam format HH:mm 24-jam (misal: 17:00 jika user menyebut jam 5 sore atau 09:30).',
                  },
                  notes: {
                    type: 'STRING',
                    description: 'Nama entitas atau barang utama dalam Title Case bersih TANPA kata keterangan waktu, nominal, atau kata kerja beli/bayar (misal: "Matcha", "Nasi Padang", "Bensin Pertalite").',
                  },
                  merchant: {
                    type: 'STRING',
                    description: 'Nama toko/merchant jika ada (misal: Indomaret, Alfamart, Starbucks).',
                  },
                  walletId: { type: 'NUMBER', description: 'ID dompet (wallet) yang digunakan.' },
                  targetWalletId: { type: 'NUMBER', description: "ID dompet tujuan JIKA type='transfer'." },
                  items: {
                    type: 'ARRAY',
                    items: {
                      type: 'OBJECT',
                      properties: {
                        name: { type: 'STRING', description: 'Nama barang/item.' },
                        price: { type: 'NUMBER', description: 'Total harga item.' },
                        qty: { type: 'NUMBER', description: 'Kuantitas/jumlah barang.' },
                      },
                    },
                    description: 'Daftar rincian item barang pada struk belanja.',
                  },
                  subtotal: { type: 'NUMBER', description: 'Nominal subtotal sebelum pajak/diskon jika ada.' },
                  tax: { type: 'NUMBER', description: 'Nominal pajak PPN/PB1 jika ada.' },
                  discount: { type: 'NUMBER', description: 'Nominal potongan harga/diskon jika ada.' },
                  paymentMethod: {
                    type: 'STRING',
                    description: 'Metode pembayaran pada struk (misal: BCA, GoPay, QRIS, Tunai).',
                  },
                  isSplit: { type: 'BOOLEAN', description: 'True jika transaksi terdiri dari beberapa pos alokasi (split transaction).' },
                  splitItems: {
                    type: 'ARRAY',
                    items: {
                      type: 'OBJECT',
                      properties: {
                        category: { type: 'STRING', description: 'Kategori pos split.' },
                        amount: { type: 'NUMBER', description: 'Nominal pos split.' },
                        notes: { type: 'STRING', description: 'Keterangan pos split.' },
                        isExcludeAnalyticsTx: { type: 'BOOLEAN', description: 'True jika pos dikecualikan dari analitik.' },
                      },
                      required: ['category', 'amount'],
                    },
                    description: 'Rincian pos kategori dan nominal untuk transaksi split.',
                  },
                },
                required: ['type', 'category', 'amount', 'date', 'notes'],
              },
            },
            merchantName: { type: 'STRING', description: 'Nama toko/merchant utama yang tertera pada struk.' },
            currency: { type: 'STRING', description: 'Mata uang utama yang tertera pada struk.' },
            replyMessage: { type: 'STRING', description: 'Pesan sukses ramah.' },
            suggestedChips: {
              type: 'ARRAY',
              items: { type: 'STRING' },
              description:
                "Berikan 2-4 rekomendasi aksi/pertanyaan selanjutnya untuk user berdasarkan konteks (misal: 'Lihat laporan', 'Catat 10rb lagi'). WAJIB DIISI!",
            },
          },
          required: ['transactions'],
        },
      },
      {
        name: 'update_transaction',
        description:
          "Ubah/edit satu atau beberapa transaksi masa lalu. Panggil ini JIKA user minta mengubah data transaksi (misal: 'ubah transaksi tadi yang ke dana kategorinya jadi makanan', 'edit 2 transaksi tadi jadi langganan', 'ganti nominal kopi tadi jadi 30rb', 'pindahkan transaksi sebelumnya ke BCA'). Bisa mengubah satu transaksi via transactionId atau banyak transaksi via transactionIds.",
        parameters: {
          type: 'OBJECT',
          properties: {
            transactionId: { type: 'NUMBER', description: 'ID transaksi tunggal dari daftar transaksi jika diketahui.' },
            transactionIds: {
              type: 'ARRAY',
              items: { type: 'NUMBER' },
              description: 'Daftar ID transaksi jika user meminta mengubah lebih dari satu transaksi sekaligus (batch update, misal: [90, 89]).',
            },
            searchQuery: {
              type: 'STRING',
              description: "Kata kunci untuk mencari transaksi yang dimaksud (misal: 'dana', 'kopi', 'terakhir').",
            },
            updatedFields: {
              type: 'OBJECT',
              properties: {
                amount: { type: 'NUMBER', description: 'Nominal baru.' },
                category: { type: 'STRING', description: 'ID Kategori baru (format parentId/childId).' },
                notes: { type: 'STRING', description: 'Catatan baru.' },
                date: { type: 'STRING', description: 'Tanggal baru (YYYY-MM-DD).' },
                walletId: { type: 'NUMBER', description: 'ID Dompet baru jika ingin memindahkan dompet transaksi.' },
                targetWalletId: { type: 'NUMBER', description: 'ID Dompet tujuan baru (untuk transfer).' },
                type: { type: 'STRING', enum: ['income', 'expense', 'transfer'] },
                isSplit: { type: 'BOOLEAN', description: 'True jika transaksi diubah menjadi split.' },
                splitItems: {
                  type: 'ARRAY',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      category: { type: 'STRING', description: 'Kategori pos split.' },
                      amount: { type: 'NUMBER', description: 'Nominal pos split.' },
                      notes: { type: 'STRING', description: 'Keterangan pos split.' },
                      isExcludeAnalyticsTx: { type: 'BOOLEAN', description: 'True jika pos dikecualikan dari analitik.' },
                    },
                    required: ['category', 'amount'],
                  },
                  description: 'Rincian pos kategori dan nominal baru untuk split.',
                },
              },
            },
            replyMessage: { type: 'STRING', description: 'Pesan konfirmasi perubahan yang ramah.' },
            suggestedChips: {
              type: 'ARRAY',
              items: { type: 'STRING' },
              description: 'Berikan 2-4 rekomendasi aksi/pertanyaan selanjutnya untuk user berdasarkan konteks. WAJIB DIISI!',
            },
          },
          required: ['updatedFields'],
        },
      },
      {
        name: 'delete_transaction',
        description: "Hapus transaksi masa lalu. Panggil ini JIKA user minta menghapus data (misal: 'hapus transaksi makan siang tadi').",
        parameters: {
          type: 'OBJECT',
          properties: {
            transactionId: { type: 'NUMBER', description: 'ID transaksi jika diketahui.' },
            transactionIds: {
              type: 'ARRAY',
              items: { type: 'NUMBER' },
              description: 'Daftar ID transaksi jika user meminta menghapus lebih dari satu transaksi sekaligus (batch delete, misal: [90, 89]).',
            },
            searchQuery: { type: 'STRING', description: "Kata kunci transaksi (misal: 'makan siang', 'terakhir')." },
            date: { type: 'STRING', description: 'Tanggal transaksi jika disebutkan (YYYY-MM-DD).' },
            replyMessage: { type: 'STRING' },
            suggestedChips: {
              type: 'ARRAY',
              items: { type: 'STRING' },
              description: 'Berikan 2-4 rekomendasi aksi/pertanyaan selanjutnya untuk user berdasarkan konteks. WAJIB DIISI!',
            },
          },
          required: [],
        },
      },
      {
        name: 'query_database',
        description:
          "Hitung, cari, atau ringkas data transaksi masa lalu. Panggil ini JIKA user bertanya (misal: 'Berapa total pengeluaranku bulan ini?', 'Tampilkan chart pengeluaran').",
        parameters: {
          type: 'OBJECT',
          properties: {
            startDate: { type: 'STRING', description: 'YYYY-MM-DD' },
            endDate: { type: 'STRING', description: 'YYYY-MM-DD' },
            type: { type: 'STRING', enum: ['income', 'expense'] },
            category: { type: 'STRING' },
            renderChart: { type: 'BOOLEAN', description: 'Set true jika user meminta visualisasi/grafik/chart.' },
          },
          required: [],
        },
      },
      {
        name: 'manage_habit',
        description: "Kelola (buat/centang) Habit/Kebiasaan pengguna. Jika user minta centang semua habit, gunakan action 'log_all'.",
        parameters: {
          type: 'OBJECT',
          properties: {
            action: {
              type: 'STRING',
              enum: ['create', 'log', 'log_all'],
              description: 'create untuk buat habit, log untuk centang 1 habit, log_all untuk centang SEMUA habit',
            },
            title: { type: 'STRING', description: "Nama habit. Jika log_all, isi dengan 'semua'" },
            color: { type: 'STRING', description: "Warna habit (misal: 'red', 'blue', 'indigo')" },
            frequencyType: { type: 'STRING', enum: ['daily', 'weekly', 'specific_days'], description: 'Frekuensi habit' },
            frequencyValue: { type: 'INTEGER', description: 'Jumlah target frekuensi per minggu jika weekly (misal 3)' },
            reminderTime: { type: 'STRING', description: "Waktu pengingat (format HH:mm, misal: '08:00')" },
            replyMessage: { type: 'STRING', description: 'Pesan balasan untuk user' },
            suggestedChips: {
              type: 'ARRAY',
              items: { type: 'STRING' },
              description:
                "Berikan 2-4 rekomendasi aksi/pertanyaan selanjutnya untuk user berdasarkan konteks (misal: 'Lihat laporan', 'Catat 10rb lagi'). WAJIB DIISI!",
            },
          },
          required: ['action', 'title'],
        },
      },
      {
        name: 'manage_todo',
        description:
          'Kelola (buat/selesaikan) To-Do List/Tugas pengguna. Saat membuat tugas baru, SELALU coba isi description, category, subTasks, dan priority agar tugas langsung lengkap dan terstruktur.',
        parameters: {
          type: 'OBJECT',
          properties: {
            action: {
              type: 'STRING',
              enum: ['create', 'complete'],
              description: 'create untuk buat tugas baru, complete untuk menandai selesai',
            },
            title: { type: 'STRING', description: "Nama tugas (misal: 'Bayar Listrik')" },
            description: {
              type: 'STRING',
              description:
                'Deskripsi/catatan detail tugas. Isi dengan konteks tambahan, langkah-langkah, atau catatan penting terkait tugas ini. Boleh multi-baris.',
            },
            category: {
              type: 'STRING',
              enum: [
                'tagihan',
                'investasi',
                'belanja',
                'tabungan',
                'pekerjaan',
                'pribadi',
                'kesehatan',
                'pendidikan',
                'rumah',
                'transportasi',
                'lainnya',
              ],
              description:
                'Kategori tugas. Pilih yang paling sesuai: tagihan (Bills), investasi (Investment), belanja (Shopping), tabungan (Savings), pekerjaan (Work), pribadi (Personal), kesehatan (Health), pendidikan (Education), rumah (Household), transportasi (Transport), lainnya (Other).',
            },
            dueDate: { type: 'STRING', description: 'Tenggat waktu (YYYY-MM-DD)' },
            reminderTime: { type: 'STRING', description: "Waktu pengingat (format HH:mm, misal: '15:30')" },
            priority: { type: 'STRING', enum: ['low', 'medium', 'high'], description: 'Prioritas tugas' },
            subTasks: {
              type: 'ARRAY',
              items: { type: 'STRING' },
              description:
                "Daftar sub-tugas/checklist. Pecah tugas besar menjadi langkah-langkah kecil agar mudah dieksekusi. Contoh: ['Cek tagihan', 'Siapkan dana', 'Bayar via app']",
            },
            replyMessage: { type: 'STRING', description: 'Pesan balasan meyakinkan.' },
            suggestedChips: {
              type: 'ARRAY',
              items: { type: 'STRING' },
              description: 'Berikan 2-4 rekomendasi aksi/pertanyaan selanjutnya untuk user berdasarkan konteks. WAJIB DIISI!',
            },
          },
          required: ['action', 'title'],
        },
      },
      {
        name: 'manage_budget',
        description:
          'Kelola (buat/update/cek status) Budget/Anggaran bulanan. Panggil tool ini juga saat pengguna menanyakan status anggaran/apakah sudah limit/bagaimana budget saat ini.',
        parameters: {
          type: 'OBJECT',
          properties: {
            action: { type: 'STRING', enum: ['create', 'update', 'status'], description: 'create/update/status budget' },
            category: { type: 'STRING', description: "Kategori budget (misal: 'Makanan', 'Transportasi', 'Semua')" },
            limit: { type: 'NUMBER', description: 'Batas nominal budget (angka). Jika action=status dan tidak diubah, isi 0.' },
            currency: { type: 'STRING', description: "Mata uang anggaran (misal: 'IDR', 'USD', 'SGD'). Default ke mata uang aplikasi jika tidak disebutkan." },
            replyMessage: { type: 'STRING', description: 'Pesan balasan untuk user' },
            suggestedChips: {
              type: 'ARRAY',
              items: { type: 'STRING' },
              description: 'Berikan 2-4 rekomendasi aksi/pertanyaan selanjutnya untuk user berdasarkan konteks. WAJIB DIISI!',
            },
          },
          required: ['action', 'category'],
        },
      },
      {
        name: 'manage_savings',
        description:
          'Kelola tabungan/goals pengguna. Panggil ini untuk membuat target tabungan baru, menambahkan uang ke tabungan (top up), atau mencairkan tabungan (withdraw).',
        parameters: {
          type: 'OBJECT',
          properties: {
            action: {
              type: 'STRING',
              enum: ['create', 'add_funds', 'withdraw'],
              description: 'create untuk target baru, add_funds untuk mengisi tabungan/menambah saldo, withdraw untuk mencairkan tabungan kembali ke dompet',
            },
            name: { type: 'STRING', description: "Nama tabungan/goal (misal: 'Beli Laptop')" },
            amount: { type: 'NUMBER', description: 'Target dana (jika create), Jumlah uang yang disetor (jika add_funds), atau Jumlah uang yang dicairkan (jika withdraw)' },
            walletId: { type: 'NUMBER', description: 'ID dompet (wallet) sumber dana setor atau tujuan dana cairkan tabungan (opsional).' },
            currency: { type: 'STRING', description: "Mata uang tabungan/goal (misal: 'IDR', 'USD', 'SGD'). Default ke mata uang aplikasi jika tidak disebutkan." },
            replyMessage: { type: 'STRING', description: 'Pesan balasan untuk user' },
            suggestedChips: {
              type: 'ARRAY',
              items: { type: 'STRING' },
              description: 'Berikan 2-4 rekomendasi aksi/pertanyaan selanjutnya untuk user berdasarkan konteks. WAJIB DIISI!',
            },
          },
          required: ['action', 'name'],
        },
      },
      {
        name: 'manage_recurring',
        description: 'Kelola (buat/ubah/hapus) Tagihan/Langganan berulang bulanan/tahunan (contoh: langganan Netflix).',
        parameters: {
          type: 'OBJECT',
          properties: {
            action: {
              type: 'STRING',
              enum: ['create', 'update', 'delete'],
              description: 'create untuk tambah baru, update untuk ubah nominal/frekuensi, delete untuk membatalkan/menghapus langganan',
            },
            title: { type: 'STRING', description: "Nama tagihan/langganan (misal: 'Netflix')" },
            amount: { type: 'NUMBER', description: 'Nominal tagihan (angka) - opsional jika action=delete' },
            category: { type: 'STRING', description: "Kategori (misal: 'Hiburan', 'Tagihan')" },
            frequency: { type: 'STRING', enum: ['daily', 'weekly', 'monthly', 'yearly'], description: 'Frekuensi tagihan' },
            replyMessage: { type: 'STRING', description: 'Pesan balasan untuk user' },
            suggestedChips: {
              type: 'ARRAY',
              items: { type: 'STRING' },
              description: 'Berikan 2-4 rekomendasi aksi/pertanyaan selanjutnya untuk user berdasarkan konteks. WAJIB DIISI!',
            },
          },
          required: ['action', 'title'],
        },
      },
      {
        name: 'export_report',
        description: 'Unduh/ekspor laporan keuangan user ke dalam format CSV/Excel.',
        parameters: {
          type: 'OBJECT',
          properties: {
            month: { type: 'STRING', description: 'Bulan yang ingin diekspor (YYYY-MM). Kosongkan untuk semua data.' },
            replyMessage: { type: 'STRING', description: "Pesan balasan (contoh: 'Laporan sedang diunduh...')" },
            suggestedChips: {
              type: 'ARRAY',
              items: { type: 'STRING' },
              description: 'Berikan 2-4 rekomendasi aksi/pertanyaan selanjutnya untuk user berdasarkan konteks. WAJIB DIISI!',
            },
          },
          required: [],
        },
      },
      {
        name: 'manage_wallet',
        description: 'Kelola dompet/rekening pengguna (buat dompet baru atau transfer saldo antar dompet).',
        parameters: {
          type: 'OBJECT',
          properties: {
            action: {
              type: 'STRING',
              enum: ['create', 'transfer'],
              description: 'create untuk dompet baru, transfer untuk memindahkan saldo',
            },
            name: { type: 'STRING', description: "Nama dompet baru (misal: 'BCA', 'Gopay', 'Cash')" },
            walletType: {
              type: 'STRING',
              enum: ['bank', 'e-wallet', 'ewallet', 'cash', 'credit_card', 'investment', 'other'],
              description: 'Jenis dompet baru',
            },
            currency: { type: 'STRING', description: "Mata uang dompet (misal: 'IDR', 'USD', 'SGD', 'EUR'). Default ke mata uang aplikasi jika tidak disebutkan." },
            initialBalance: { type: 'NUMBER', description: 'Saldo awal dompet baru (jika action=create)' },
            fromWalletId: { type: 'NUMBER', description: 'ID dompet asal (jika action=transfer)' },
            toWalletId: { type: 'NUMBER', description: 'ID dompet tujuan (jika action=transfer)' },
            amount: { type: 'NUMBER', description: 'Nominal transfer (jika action=transfer)' },
            replyMessage: { type: 'STRING', description: 'Pesan balasan untuk user' },
            suggestedChips: {
              type: 'ARRAY',
              items: { type: 'STRING' },
              description: 'Berikan 2-4 rekomendasi aksi/pertanyaan selanjutnya untuk user. WAJIB DIISI!',
            },
          },
          required: ['action'],
        },
      },
      {
        name: 'manage_loans',
        description:
          'Kelola catatan utang atau piutang pengguna (catat utang/piutang baru, bayar cicilan, tandai lunas, hapus, atau query ringkasan utang/piutang).',
        parameters: {
          type: 'OBJECT',
          properties: {
            action: {
              type: 'STRING',
              enum: ['create', 'pay', 'mark_paid', 'delete', 'query'],
              description:
                'create (tambah baru), pay (bayar cicilan), mark_paid (tandai lunas), delete (hapus), query (ringkasan/tanya jawab saldo)',
            },
            loanType: { type: 'STRING', enum: ['debt', 'receivable'], description: 'debt = hutang saya, receivable = piutang saya' },
            title: { type: 'STRING', description: "Judul pinjaman (misal: 'Pinjaman Motor', 'Pinjam ke Andi')" },
            personName: { type: 'STRING', description: 'Nama pihak terkait (pemberi pinjaman / peminjam)' },
            amount: {
              type: 'NUMBER',
              description: 'Total nominal pinjaman (action=create) atau nominal bayar (action=pay)',
            },
            walletId: { type: 'NUMBER', description: 'ID dompet yang digunakan untuk transaksi ini.' },
            currency: { type: 'STRING', description: "Mata uang pinjaman (misal: 'IDR', 'USD', 'SGD'). Default ke mata uang dompet atau aplikasi jika tidak disebutkan." },
            dueDate: { type: 'STRING', description: 'Tanggal jatuh tempo (YYYY-MM-DD) - opsional' },
            replyMessage: { type: 'STRING', description: 'Pesan balasan untuk user' },
            suggestedChips: {
              type: 'ARRAY',
              items: { type: 'STRING' },
              description: 'Berikan 2-4 rekomendasi aksi/pertanyaan selanjutnya untuk user. WAJIB DIISI!',
            },
          },
          required: ['action'],
        },
      },
      {
        name: 'calculate_financial_health',
        description:
          'Hitung dan evaluasi skor kesehatan finansial pengguna (financial health score) berdasarkan rasio tabungan, beban hutang (DTI), dana darurat, dan konsistensi pengeluaran.',
        parameters: {
          type: 'OBJECT',
          properties: {
            focus: { type: 'STRING', description: 'Fokus evaluasi: all, savings, debt, spending' },
            replyMessage: { type: 'STRING', description: 'Pesan balasan pengantar evaluasi kesehatan finansial' },
            suggestedChips: { type: 'ARRAY', items: { type: 'STRING' }, description: '2-4 rekomendasi pertanyaan/aksi berikutnya' },
          },
          required: [],
        },
      },
    ],
  },
]

/**
 * Returns pruned tools depending on conversation context to conserve prompt tokens.
 * In quick_log or receipt scan mode, only transaction recording and wallet management tools are returned.
 *
 * @param {'full'|'quick_log'|'receipt'} [mode='full']
 * @returns {Array<object>}
 */
export function getPrunedTools(mode = 'full') {
  const allTools = getTools()
  if (mode === 'quick_log' || mode === 'receipt') {
    const allowedNames = ['record_transactions', 'manage_wallet']
    return [
      {
        functionDeclarations: allTools[0].functionDeclarations.filter((fd) =>
          allowedNames.includes(fd.name)
        ),
      },
    ]
  }
  return allTools
}

