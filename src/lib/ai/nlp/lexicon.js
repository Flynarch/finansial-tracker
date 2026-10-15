/**
 * Indonesian Finance NLP - Lexicon & Dictionary Definitions
 */

/**
 * Common Indonesian day definitions and typos
 * 0 = Sunday (Minggu), 1 = Monday (Senin), ..., 6 = Saturday (Sabtu)
 */
export const DAY_DEFINITIONS = [
  { dayIndex: 1, canonical: 'senin', nameId: 'Senin', regex: /\b(senin|senen|senn)\b/i },
  { dayIndex: 2, canonical: 'selasa', nameId: 'Selasa', regex: /\b(selasa|slasa)\b/i },
  { dayIndex: 3, canonical: 'rabu', nameId: 'Rabu', regex: /\b(rabu|rbu)\b/i },
  { dayIndex: 4, canonical: 'kamis', nameId: 'Kamis', regex: /\b(kamis|kms)\b/i },
  { dayIndex: 5, canonical: 'jumat', nameId: 'Jumat', regex: /\b(jumat|jum'at|jumwt|jmt|jumatt)\b/i },
  { dayIndex: 6, canonical: 'sabtu', nameId: 'Sabtu', regex: /\b(sabtu|sbtu|sabt|sbt)\b/i },
  { dayIndex: 0, canonical: 'minggu', nameId: 'Minggu', regex: /\b(minggu|mnggu|ahad|mggu)\b/i },
]

/**
 * Common Indonesian merchants, ride-hailing services, and brands
 */
export const KNOWN_MERCHANT_SERVICES = [
  {
    regex: /\b(maxim)\b/i,
    name: 'Maxim',
    category: 'transportasi/ojol',
  },
  {
    regex: /\b(gojek|goride|gocar|gofood|gomart)\b/i,
    name: 'Gojek',
    category: 'transportasi/ojol',
  },
  {
    regex: /\b(grab|grabbike|grabcar|grabfood)\b/i,
    name: 'Grab',
    category: 'transportasi/ojol',
  },
  {
    regex: /\b(indrive|in-drive)\b/i,
    name: 'inDrive',
    category: 'transportasi/ojol',
  },
  {
    regex: /\b(bluebird|blue bird)\b/i,
    name: 'Bluebird',
    category: 'transportasi/taksi',
  },
  {
    regex: /\b(krl|commuter|commuterline)\b/i,
    name: 'KRL Commuter Line',
    category: 'transportasi/kereta',
  },
  {
    regex: /\b(mrt|mrt jakarta)\b/i,
    name: 'MRT Jakarta',
    category: 'transportasi/kereta',
  },
  {
    regex: /\b(lrt|lrt jabodebek)\b/i,
    name: 'LRT',
    category: 'transportasi/kereta',
  },
  {
    regex: /\b(transjakarta|busway|tj)\b/i,
    name: 'TransJakarta',
    category: 'transportasi/bis',
  },
  {
    regex: /\b(damri)\b/i,
    name: 'Damri',
    category: 'transportasi/bis',
  },
  {
    regex: /\b(indomaret|indomart)\b/i,
    name: 'Indomaret',
    category: 'kebutuhan_harian/belanja_bulanan',
  },
  {
    regex: /\b(alfamart|alfa)\b/i,
    name: 'Alfamart',
    category: 'kebutuhan_harian/belanja_bulanan',
  },
  {
    regex: /\b(superindo|super indo)\b/i,
    name: 'Super Indo',
    category: 'kebutuhan_harian/belanja_bulanan',
  },
  {
    regex: /\b(starbucks|sbux)\b/i,
    name: 'Starbucks',
    category: 'makanan/kopi',
  },
  {
    regex: /\b(kopi kenangan|kopikenangan)\b/i,
    name: 'Kopi Kenangan',
    category: 'makanan/kopi',
  },
  {
    regex: /\b(janji jiwa|janjijiwa)\b/i,
    name: 'Janji Jiwa',
    category: 'makanan/kopi',
  },
  {
    regex: /\b(mcd|mcdonald|mcdonalds|mcdonald's)\b/i,
    name: "McDonald's",
    category: 'makanan/makan_siang',
  },
  {
    regex: /\b(kfc)\b/i,
    name: 'KFC',
    category: 'makanan/makan_siang',
  },
  {
    regex: /\b(pertamina|spbu)\b/i,
    name: 'Pertamina',
    category: 'transportasi/bensin',
  },
  {
    regex: /\b(shell)\b/i,
    name: 'Shell',
    category: 'transportasi/bensin',
  },
  {
    regex: /\b(kulo)\b/i,
    name: 'Kulo',
    category: 'makanan/kopi',
  },
  {
    regex: /\b(fore|fore coffee)\b/i,
    name: 'Fore Coffee',
    category: 'makanan/kopi',
  },
  {
    regex: /\b(mixue)\b/i,
    name: 'Mixue',
    category: 'makanan/minuman',
  },
  {
    regex: /\b(point coffee|pointcoffee)\b/i,
    name: 'Point Coffee',
    category: 'makanan/kopi',
  },
  {
    regex: /\b(tomoro|tomoro coffee)\b/i,
    name: 'Tomoro Coffee',
    category: 'makanan/kopi',
  },
  // Food & Beverages (Indonesian favorites & chains)
  {
    regex: /\b(mie gacoan|gacoan)\b/i,
    name: 'Mie Gacoan',
    category: 'makanan/makan_siang',
  },
  {
    regex: /\b(hokben|hoka hoka bento)\b/i,
    name: 'HokBen',
    category: 'makanan/makan_siang',
  },
  {
    regex: /\b(richeese|richeese factory)\b/i,
    name: 'Richeese Factory',
    category: 'makanan/makan_siang',
  },
  {
    regex: /\b(solaria)\b/i,
    name: 'Solaria',
    category: 'makanan/makan_siang',
  },
  {
    regex: /\b(burger king|bk)\b/i,
    name: 'Burger King',
    category: 'makanan/makan_siang',
  },
  {
    regex: /\b(pizza hut|phd)\b/i,
    name: 'Pizza Hut',
    category: 'makanan/makan_malam',
  },
  {
    regex: /\b(dominos|domino's|domino's pizza)\b/i,
    name: "Domino's Pizza",
    category: 'makanan/makan_malam',
  },
  {
    regex: /\b(a&w|aw)\b/i,
    name: 'A&W',
    category: 'makanan/makan_siang',
  },
  {
    regex: /\b(subway)\b/i,
    name: 'Subway',
    category: 'makanan/makan_siang',
  },
  {
    regex: /\b(marugame|marugame udon)\b/i,
    name: 'Marugame Udon',
    category: 'makanan/makan_siang',
  },
  {
    regex: /\b(yoshinoya)\b/i,
    name: 'Yoshinoya',
    category: 'makanan/makan_siang',
  },
  {
    regex: /\b(d'cost|dcost)\b/i,
    name: "D'Cost",
    category: 'makanan/makan_malam',
  },
  {
    regex: /\b(bakso boedjangan|boedjangan)\b/i,
    name: 'Bakso Boedjangan',
    category: 'makanan/makan_siang',
  },
  {
    regex: /\b(shihlin)\b/i,
    name: 'Shihlin',
    category: 'makanan/camilan',
  },
  {
    regex: /\b(jco|j\.co)\b/i,
    name: 'J.CO Donuts',
    category: 'makanan/camilan',
  },
  {
    regex: /\b(chatime)\b/i,
    name: 'Chatime',
    category: 'makanan/minuman',
  },
  {
    regex: /\b(haus!?)\b/i,
    name: 'Haus!',
    category: 'makanan/minuman',
  },
  {
    regex: /\b(teguk)\b/i,
    name: 'Teguk',
    category: 'makanan/minuman',
  },
  {
    regex: /\b(menantea)\b/i,
    name: 'Menantea',
    category: 'makanan/minuman',
  },
  {
    regex: /\b(xing fu tang|xft)\b/i,
    name: 'Xing Fu Tang',
    category: 'makanan/minuman',
  },
  {
    regex: /\b(kopi soe|kopisoe)\b/i,
    name: 'Kopi Soe',
    category: 'makanan/kopi',
  },
  {
    regex: /\b(anomali|anomali coffee)\b/i,
    name: 'Anomali Coffee',
    category: 'makanan/kopi',
  },
  {
    regex: /\b(excelso)\b/i,
    name: 'Excelso',
    category: 'makanan/kopi',
  },
  {
    regex: /\b(djournal|djournal coffee)\b/i,
    name: 'Djournal Coffee',
    category: 'makanan/kopi',
  },

  // Groceries & Retail Outlets
  {
    regex: /\b(alfamidi|midi)\b/i,
    name: 'Alfamidi',
    category: 'kebutuhan_harian/belanja_bulanan',
  },
  {
    regex: /\b(hypermart)\b/i,
    name: 'Hypermart',
    category: 'kebutuhan_harian/belanja_bulanan',
  },
  {
    regex: /\b(transmart|carrefour)\b/i,
    name: 'Transmart',
    category: 'kebutuhan_harian/belanja_bulanan',
  },
  {
    regex: /\b(lotte mart|lottemart)\b/i,
    name: 'Lotte Mart',
    category: 'kebutuhan_harian/belanja_bulanan',
  },
  {
    regex: /\b(farmers market|farmer market)\b/i,
    name: 'Farmers Market',
    category: 'kebutuhan_harian/belanja_bulanan',
  },
  {
    regex: /\b(ranch market)\b/i,
    name: 'Ranch Market',
    category: 'kebutuhan_harian/belanja_bulanan',
  },
  {
    regex: /\b(grand lucky|grandlucky)\b/i,
    name: 'Grand Lucky',
    category: 'kebutuhan_harian/belanja_bulanan',
  },
  {
    regex: /\b(sayurbox|sayur box)\b/i,
    name: 'Sayurbox',
    category: 'kebutuhan_harian/belanja_bulanan',
  },
  {
    regex: /\b(segari)\b/i,
    name: 'Segari',
    category: 'kebutuhan_harian/belanja_bulanan',
  },
  {
    regex: /\b(astro)\b/i,
    name: 'Astro',
    category: 'kebutuhan_harian/belanja_bulanan',
  },
  {
    regex: /\b(familymart|family mart|famima)\b/i,
    name: 'FamilyMart',
    category: 'kebutuhan_harian/belanja_bulanan',
  },
  {
    regex: /\b(lawson)\b/i,
    name: 'Lawson',
    category: 'kebutuhan_harian/belanja_bulanan',
  },
  {
    regex: /\b(circle k|circle-k)\b/i,
    name: 'Circle K',
    category: 'kebutuhan_harian/belanja_bulanan',
  },
  {
    regex: /\b(miniso)\b/i,
    name: 'Miniso',
    category: 'kebutuhan_harian/belanja_bulanan',
  },
  {
    regex: /\b(kkv)\b/i,
    name: 'KKV',
    category: 'kebutuhan_harian/belanja_bulanan',
  },
  {
    regex: /\b(mr\.?\s*diy|mrdiy)\b/i,
    name: 'Mr. DIY',
    category: 'kebutuhan_harian/alat_rumah',
  },
  {
    regex: /\b(ace hardware)\b/i,
    name: 'Ace Hardware',
    category: 'kebutuhan_harian/alat_rumah',
  },
  {
    regex: /\b(ikea)\b/i,
    name: 'IKEA',
    category: 'kebutuhan_harian/alat_rumah',
  },
  {
    regex: /\b(informa)\b/i,
    name: 'Informa',
    category: 'kebutuhan_harian/alat_rumah',
  },
  {
    regex: /\b(mitra10|mitra 10)\b/i,
    name: 'Mitra10',
    category: 'kebutuhan_harian/alat_rumah',
  },

  // Health, Medical & Pharmacies
  {
    regex: /\b(kimia farma)\b/i,
    name: 'Kimia Farma',
    category: 'kesehatan/obat',
  },
  {
    regex: /\b(guardian)\b/i,
    name: 'Guardian',
    category: 'kesehatan/obat',
  },
  {
    regex: /\b(watsons|watson)\b/i,
    name: 'Watsons',
    category: 'kesehatan/obat',
  },
  {
    regex: /\b(century|apotek century)\b/i,
    name: 'Century Healthcare',
    category: 'kesehatan/obat',
  },
  {
    regex: /\b(k-24|k24|apotek k24|apotek k-24)\b/i,
    name: 'Apotek K-24',
    category: 'kesehatan/obat',
  },
  {
    regex: /\b(halodoc)\b/i,
    name: 'Halodoc',
    category: 'kesehatan/konsultasi',
  },
  {
    regex: /\b(alodokter)\b/i,
    name: 'Alodokter',
    category: 'kesehatan/konsultasi',
  },

  // Fuel & Automotive
  {
    regex: /\b(bp akr|spbu bp)\b/i,
    name: 'BP',
    category: 'transportasi/bensin',
  },
  {
    regex: /\b(spbu vivo|vivo energy)\b/i,
    name: 'Vivo',
    category: 'transportasi/bensin',
  },

  // E-Commerce & Marketplaces
  {
    regex: /\b(shopee)\b/i,
    name: 'Shopee',
    category: 'kebutuhan_harian/belanja_online',
  },
  {
    regex: /\b(tokopedia|tokped|toped)\b/i,
    name: 'Tokopedia',
    category: 'kebutuhan_harian/belanja_online',
  },
  {
    regex: /\b(tiktok shop|tt shop)\b/i,
    name: 'TikTok Shop',
    category: 'kebutuhan_harian/belanja_online',
  },
  {
    regex: /\b(lazada)\b/i,
    name: 'Lazada',
    category: 'kebutuhan_harian/belanja_online',
  },
  {
    regex: /\b(blibli)\b/i,
    name: 'Blibli',
    category: 'kebutuhan_harian/belanja_online',
  },
  {
    regex: /\b(bukalapak)\b/i,
    name: 'Bukalapak',
    category: 'kebutuhan_harian/belanja_online',
  },

  // Entertainment, Streaming & Digital
  {
    regex: /\b(netflix)\b/i,
    name: 'Netflix',
    category: 'hiburan/langganan',
  },
  {
    regex: /\b(spotify)\b/i,
    name: 'Spotify',
    category: 'hiburan/langganan',
  },
  {
    regex: /\b(youtube premium|yt premium|youtube)\b/i,
    name: 'YouTube',
    category: 'hiburan/langganan',
  },
  {
    regex: /\b(disney\+|disney plus|hotstar)\b/i,
    name: 'Disney+ Hotstar',
    category: 'hiburan/langganan',
  },
  {
    regex: /\b(steam)\b/i,
    name: 'Steam',
    category: 'hiburan/game',
  },
  {
    regex: /\b(cinema xxi|xxi|cinema 21)\b/i,
    name: 'Cinema XXI',
    category: 'hiburan/bioskop',
  },
  {
    regex: /\b(cgv|cgv cinemas)\b/i,
    name: 'CGV Cinemas',
    category: 'hiburan/bioskop',
  },
  {
    regex: /\b(cinepolis)\b/i,
    name: 'Cinepolis',
    category: 'hiburan/bioskop',
  },
  {
    regex: /\b(gramedia)\b/i,
    name: 'Gramedia',
    category: 'pendidikan/buku',
  },

  // Bills, Utilities & Telco
  {
    regex: /\b(pln|token pln|listrik pln)\b/i,
    name: 'PLN',
    category: 'tagihan/listrik',
  },
  {
    regex: /\b(pdam|air pdam)\b/i,
    name: 'PDAM',
    category: 'tagihan/air',
  },
  {
    regex: /\b(telkomsel|tsel|byu|by\.u)\b/i,
    name: 'Telkomsel',
    category: 'tagihan/pulsa',
  },
  {
    regex: /\b(indosat|im3)\b/i,
    name: 'Indosat Ooredoo',
    category: 'tagihan/pulsa',
  },
  {
    regex: /\b(xl axiata|axis)\b/i,
    name: 'XL Axiata',
    category: 'tagihan/pulsa',
  },
  {
    regex: /\b(indihome|indihome telkom)\b/i,
    name: 'IndiHome',
    category: 'tagihan/internet',
  },
  {
    regex: /\b(biznet|biznet home)\b/i,
    name: 'Biznet',
    category: 'tagihan/internet',
  },
  {
    regex: /\b(first media|firstmedia)\b/i,
    name: 'First Media',
    category: 'tagihan/internet',
  },
  {
    regex: /\b(myrepublic|my republic)\b/i,
    name: 'MyRepublic',
    category: 'tagihan/internet',
  },
]

/**
 * Common Indonesian month definitions and regex
 */
export const MONTH_DEFINITIONS = [
  { month: 1, regex: /\b(januari|jan)\b/i, name: 'Januari' },
  { month: 2, regex: /\b(februari|feb)\b/i, name: 'Februari' },
  { month: 3, regex: /\b(maret|mar)\b/i, name: 'Maret' },
  { month: 4, regex: /\b(april|apr)\b/i, name: 'April' },
  { month: 5, regex: /\b(mei|may)\b/i, name: 'Mei' },
  { month: 6, regex: /\b(juni|jun)\b/i, name: 'Juni' },
  { month: 7, regex: /\b(juli|jul)\b/i, name: 'Juli' },
  { month: 8, regex: /\b(agustus|ags|agst|aug)\b/i, name: 'Agustus' },
  { month: 9, regex: /\b(september|sep|sept)\b/i, name: 'September' },
  { month: 10, regex: /\b(oktober|okt|oct)\b/i, name: 'Oktober' },
  { month: 11, regex: /\b(november|nov)\b/i, name: 'November' },
  { month: 12, regex: /\b(desember|des|dec)\b/i, name: 'Desember' },
]

export const MONTH_NAME_REGEX =
  /\b(januari|jan|februari|feb|maret|mar|april|apr|mei|may|juni|jun|juli|jul|agustus|ags|agst|aug|september|sep|sept|oktober|okt|oct|november|nov|desember|des|dec)\b/i
