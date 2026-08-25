/**
 * Function Declarations and Tool Schemas for Gemini Function Calling
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
                  notes: { type: 'STRING', description: 'Deskripsi transaksi atau nama barang.' },
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
        name: 'delete_transactions',
        description: 'Hapus satu atau banyak transaksi berdasarkan ID-nya yang valid.',
        parameters: {
          type: 'OBJECT',
          properties: {
            transactionIds: {
              type: 'ARRAY',
              items: { type: 'NUMBER' },
              description: 'Daftar ID transaksi yang ingin dihapus.',
            },
            replyMessage: { type: 'STRING', description: 'Konfirmasi ramah transaksi yang berhasil dihapus.' },
            suggestedChips: { type: 'ARRAY', items: { type: 'STRING' } },
          },
          required: ['transactionIds'],
        },
      },
      {
        name: 'update_transaction',
        description: 'Perbarui/edit data transaksi yang sudah ada (misal ubah nominal, kategori, catatan, atau tanggal).',
        parameters: {
          type: 'OBJECT',
          properties: {
            transactionId: { type: 'NUMBER', description: 'ID transaksi yang ingin diubah.' },
            type: { type: 'STRING', enum: ['income', 'expense', 'transfer'] },
            category: { type: 'STRING', description: 'ID kategori baru.' },
            amount: { type: 'NUMBER', description: 'Nominal baru.' },
            date: { type: 'STRING', description: 'YYYY-MM-DD baru.' },
            notes: { type: 'STRING', description: 'Catatan baru.' },
            replyMessage: { type: 'STRING', description: 'Pesan konfirmasi perubahan.' },
            suggestedChips: { type: 'ARRAY', items: { type: 'STRING' } },
          },
          required: ['transactionId'],
        },
      },
      {
        name: 'query_financial_data',
        description:
          'Gunakan ini HANYA JIKA user bertanya tentang rangkuman, analisis, perbandingan, atau total pengeluaran/pemasukan masa lalu (misal: "Berapa total makanku bulan ini?", "Tampilkan grafik pengeluaran").',
        parameters: {
          type: 'OBJECT',
          properties: {
            questionAnalysis: {
              type: 'STRING',
              description: 'Analisis pertanyaan user dan jawaban ringkas serta insight keuangan cerdas.',
            },
            chartType: {
              type: 'STRING',
              enum: ['donut', 'bar', 'line', 'none'],
              description: "Tipe visualisasi chart: 'donut' untuk proporsi kategori, 'bar' untuk perbandingan, 'line' untuk tren waktu, 'none' jika tidak perlu chart.",
            },
            chartData: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  label: { type: 'STRING', description: 'Nama kategori atau tanggal/bulan.' },
                  value: { type: 'NUMBER', description: 'Nominal total.' },
                  color: { type: 'STRING', description: 'Kode hex warna visual.' },
                },
                required: ['label', 'value'],
              },
            },
            suggestedChips: { type: 'ARRAY', items: { type: 'STRING' } },
          },
          required: ['questionAnalysis'],
        },
      },
      {
        name: 'manage_loans',
        description:
          'Catat hutang (uang yang kita pinjam ke orang lain) atau piutang (uang kita yang dipinjam orang lain), atau catat pelunasan/pembayaran cicilan hutang-piutang.',
        parameters: {
          type: 'OBJECT',
          properties: {
            action: { type: 'STRING', enum: ['create', 'pay'] },
            loanType: { type: 'STRING', enum: ['debt', 'receivable'] },
            personName: { type: 'STRING', description: 'Nama orang/pihak bersangkutan.' },
            title: { type: 'STRING', description: 'Judul pinjaman (misal: Pinjam uang beli ban).' },
            amount: { type: 'NUMBER', description: 'Nominal hutang/piutang atau nominal pembayaran cicilan.' },
            dueDate: { type: 'STRING', description: 'YYYY-MM-DD tanggal jatuh tempo jika ada.' },
            loanId: { type: 'NUMBER', description: 'ID pinjaman jika aksinya adalah pelunasan/pembayaran (pay).' },
            replyMessage: { type: 'STRING', description: 'Pesan konfirmasi pencatatan hutang/piutang.' },
            suggestedChips: { type: 'ARRAY', items: { type: 'STRING' } },
          },
          required: ['action', 'amount'],
        },
      },
      {
        name: 'manage_wallet',
        description: 'Buat dompet/akun rekening baru, ubah saldo, atau sesuaikan informasi dompet.',
        parameters: {
          type: 'OBJECT',
          properties: {
            action: { type: 'STRING', enum: ['create', 'adjust_balance'] },
            walletName: { type: 'STRING', description: 'Nama akun/dompet (misal: BCA, Dompet Tunai, Mandiri).' },
            walletType: { type: 'STRING', enum: ['bank', 'ewallet', 'cash', 'crypto'] },
            initialBalance: { type: 'NUMBER', description: 'Saldo awal atau saldo yang disesuaikan.' },
            replyMessage: { type: 'STRING', description: 'Pesan konfirmasi dompet.' },
            suggestedChips: { type: 'ARRAY', items: { type: 'STRING' } },
          },
          required: ['action'],
        },
      },
      {
        name: 'export_data',
        description: 'Bantu pengguna mengekspor transaksi ke format file CSV.',
        parameters: {
          type: 'OBJECT',
          properties: {
            format: { type: 'STRING', enum: ['csv'] },
            startDate: { type: 'STRING', description: 'YYYY-MM-DD' },
            endDate: { type: 'STRING', description: 'YYYY-MM-DD' },
            category: { type: 'STRING', description: 'Kategori spesifik atau "all".' },
            replyMessage: { type: 'STRING', description: 'Konfirmasi ekspor.' },
          },
          required: ['format'],
        },
      },
    ],
  },
]
