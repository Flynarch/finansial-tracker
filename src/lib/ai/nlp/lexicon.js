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
