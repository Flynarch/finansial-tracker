# Hasil Refaktor Bottom Sheet Utang & Piutang (`LoanSheetModal.jsx`)

Refaktor bottom sheet form "Catat Hutang/Piutang" telah dilaksanakan sesuai spesifikasi Tier 1, Tier 2, dan Tier 3.

---

## Ringkasan Implemetansi Refaktor

### Tier 1 — Bug-Level Fixes
1. **Placeholder Contrast**: Menyesuaikan teks *placeholder* pada bidang "Judul Pinjaman", "Pemberi/Peminjam", dan "Catatan" dengan token warna redup (`placeholder:text-[var(--muted)]/60 placeholder:font-normal`) agar terbedakan secara kontras dari nilai teks yang telah diisi.
2. **Empty "Jatuh Tempo" Field**: Menambahkan teks petunjuk *placeholder* visual `"Pilih tanggal (opsional)"` saat bidang jatuh tempo belum diisi.
3. **Penyederhanaan Signal Toggle**: Menghapus ikon *checkmark* redundan pada kartu pilihan *Hutang Saya* / *Piutang Saya*, menyisakan kombinasi warna latar belakang tint halus & ikon saja.

---

### Tier 2 — Visual Hierarchy & Consistency
1. **Neutral Nominal Card**: Mengubah latar belakang kartu "Total Nominal Pinjaman" menjadi warna netral (`bg-[var(--field-bg)] border-[var(--border)]`) pada kondisi awal (nominal = 0). Warna merah/hijau hanya diterapkan pada angka nominal setelah nilai diisi (> 0).
2. **Flattened Container Hierarchy**: Mengeliminasi kontainer berlapis (*box-in-box-in-box*) dengan menyatukan bidang form ke dalam hirarki datar berpemisah garis tipis (*thin dividers*), selaras dengan gaya visual Net Worth sheet.
3. **Penyelarasan Saturasi Warna Merah**: Mengkonsentrasikan warna merah pekat khusus untuk tombol utama (*CTA*) "Simpan Catatan Hutang" dan nilai nominal angka saat terisi. Kartu opsi dan tombol chip menggunakan aksen tint halus.
4. **Quick-Add Chips Tokens**: Mengubah tombol chip nominal dan tanggal jatuh tempo agar menggunakan token desain pill standar aplikasi (`rounded-xl px-2.5 py-1 text-xs font-extrabold border border-[var(--border)] bg-[var(--panel-strong)]`).

---

### Tier 3 — Polish
1. **Press/Tap Animations**: Menambahkan efek animasi sentuh (`active:scale-95 transition-all duration-150`) pada chip nominal, preset tanggal, toggle tab, dan tombol submit.
2. **Muted Notes Icon**: Mengatur ukuran dan tingkat kegelapan ikon `FileText` agar tidak saling beradu dengan bidang utama di atasnya.

---

## Verifikasi Pengujian

- **Production Build**: Dijalankan `npm run build` dan berhasil dibangun tanpa kendala.
