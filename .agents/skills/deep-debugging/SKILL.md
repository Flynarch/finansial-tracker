---
name: deep-debugging
description: Comprehensive protocol for deep debugging, root-cause diagnosis, data-flow auditing, and feature improvement in FinTrack.
---

# Deep Debugging & Feature Improvement Protocol

Gunakan skill ini setiap kali diminta melakukan debugging mendalam, penelusuran bug (*root-cause analysis*), audit aliran data, atau peningkatan kualitas fitur/UI pada aplikasi FinTrack.

## 4 Langkah Protokol Debugging & Improvment

### 1. Root-Cause Analysis & Data Flow Tracing (Tanpa Asumsi)
- Penelusuran Alur Data dari Ujung ke Ujung: `Dexie DB Query` -> `Hook / State` -> `Calculations / Filters` -> `UI Component` -> `Event Handler`.
- Audit Struktur Data & Skema: Periksa skema Dexie, format tanggal (`yyyy-MM`), konversi mata uang (`rates`), dan flag filter seperti `!isExcludeAnalyticsTx(tx)`.
- Pengujian Edge Case: Periksa nilai null/undefined, angka nominal 0, batas perpindahan bulan/tahun, dan pencocokan string kategori.

### 2. Dilarang Perbaikan Permukaan (No Superficial Patches)
- Jangan menutup bug dengan menyembunyikan pesan kesalahan atau menambahkan nilai fallback palsu secara diam-diam.
- Selalu perbaiki kontrak data dan logika kalkulasi langsung di sumber utamanya.

### 3. Peningkatan Kualitas Fitur & UI/UX Polish
- **Aestetika Visual**: Patuhi CSS Variable (`var(--bg)`, `var(--fg)`, `var(--panel)`), hirarki tipografi, dan kontras warna tanpa hex-code acak.
- **Interaksi Pengguna**: Tambahkan transisi halus, micro-interactions, state kosong (*empty state*), dan respon umpan balik yang jelas.

### 4. Verifikasi Mutlak (Definition of Done)
- Jalankan pintu verifikasi: `npm run lint` dan `npm run build`.
- Pastikan perubahan tidak merusak komponen lain, card analitik, atau histori transaksi.
