export interface InstitutionInfo {
  id: string;
  name: string;
  category: 'bank' | 'ewallet' | 'investment' | 'paylater';
  color: string;
  code: string;
}

export const INDONESIAN_INSTITUTIONS: InstitutionInfo[] = [
  // Banks
  { id: 'bca', name: 'Bank BCA', category: 'bank', color: '#005CAB', code: 'BCA' },
  { id: 'mandiri', name: 'Bank Mandiri', category: 'bank', color: '#003D79', code: 'BMRI' },
  { id: 'bri', name: 'Bank BRI', category: 'bank', color: '#00529C', code: 'BBRI' },
  { id: 'bni', name: 'Bank BNI', category: 'bank', color: '#F15A22', code: 'BBNI' },
  { id: 'bsi', name: 'Bank Syariah Indonesia', category: 'bank', color: '#00A39D', code: 'BSI' },
  { id: 'jago', name: 'Bank Jago', category: 'bank', color: '#FF7A00', code: 'JAGO' },
  { id: 'seabank', name: 'SeaBank Indonesia', category: 'bank', color: '#FF5722', code: 'SEABANK' },
  { id: 'cimb', name: 'CIMB Niaga', category: 'bank', color: '#ED1C24', code: 'CIMB' },
  { id: 'jenius', name: 'Jenius / BTPN', category: 'bank', color: '#00A4E4', code: 'JENIUS' },
  { id: 'blu', name: 'blu by BCA Digital', category: 'bank', color: '#00A3FF', code: 'BLU' },
  { id: 'neobank', name: 'Bank Neo Commerce', category: 'bank', color: '#FFD700', code: 'NEO' },
  { id: 'allobank', name: 'Allo Bank', category: 'bank', color: '#6C5CE7', code: 'ALLO' },
  { id: 'permata', name: 'Permata Bank', category: 'bank', color: '#00873D', code: 'PERMATA' },
  { id: 'danamon', name: 'Bank Danamon', category: 'bank', color: '#FF7F00', code: 'DANAMON' },
  { id: 'btn', name: 'Bank BTN', category: 'bank', color: '#00509E', code: 'BBTN' },
  { id: 'ocbc', name: 'OCBC Indonesia', category: 'bank', color: '#ED1B24', code: 'OCBC' },
  { id: 'maybank', name: 'Maybank Indonesia', category: 'bank', color: '#FFC80B', code: 'MAYBANK' },
  { id: 'panin', name: 'Panin Bank', category: 'bank', color: '#006699', code: 'PANIN' },
  { id: 'mega', name: 'Bank Mega', category: 'bank', color: '#FDB813', code: 'MEGA' },
  { id: 'sinarmas', name: 'Bank Sinarmas', category: 'bank', color: '#E30613', code: 'SINARMAS' },

  // E-Wallets
  { id: 'gopay', name: 'GoPay', category: 'ewallet', color: '#00AED6', code: 'GOPAY' },
  { id: 'ovo', name: 'OVO', category: 'ewallet', color: '#4C3494', code: 'OVO' },
  { id: 'dana', name: 'DANA', category: 'ewallet', color: '#118EEA', code: 'DANA' },
  { id: 'shopeepay', name: 'ShopeePay', category: 'ewallet', color: '#EE4D2D', code: 'SHOPEEPAY' },
  { id: 'linkaja', name: 'LinkAja', category: 'ewallet', color: '#ED1C24', code: 'LINKAJA' },
  { id: 'astrapay', name: 'AstraPay', category: 'ewallet', color: '#003399', code: 'ASTRAPAY' },
  { id: 'isaku', name: 'i.Saku', category: 'ewallet', color: '#0055B8', code: 'ISAKU' },
  { id: 'paypal', name: 'PayPal', category: 'ewallet', color: '#003087', code: 'PAYPAL' },
  { id: 'wise', name: 'Wise', category: 'ewallet', color: '#2ED06E', code: 'WISE' },

  // Investments & Crypto
  { id: 'bibit', name: 'Bibit Reksadana', category: 'investment', color: '#00B14F', code: 'BIBIT' },
  { id: 'ajaib', name: 'Ajaib Sekuritas', category: 'investment', color: '#2B6CB0', code: 'AJAIB' },
  { id: 'bareksa', name: 'Bareksa', category: 'investment', color: '#78B833', code: 'BAREKSA' },
  { id: 'stockbit', name: 'Stockbit', category: 'investment', color: '#009944', code: 'STOCKBIT' },
  { id: 'pintu', name: 'Pintu Crypto', category: 'investment', color: '#0A1172', code: 'PINTU' },
  { id: 'indodax', name: 'Indodax', category: 'investment', color: '#0066A2', code: 'INDODAX' },
  { id: 'tokocrypto', name: 'Tokocrypto', category: 'investment', color: '#F3BA2F', code: 'TKX' },
  { id: 'binance', name: 'Binance', category: 'investment', color: '#F0B90B', code: 'BNB' },

  // Paylater & Credit
  { id: 'spaylater', name: 'SPayLater', category: 'paylater', color: '#EE4D2D', code: 'SPAYLATER' },
  { id: 'gopaylater', name: 'GoPay Later', category: 'paylater', color: '#00AED6', code: 'GOPAYLATER' },
  { id: 'kredivo', name: 'Kredivo', category: 'paylater', color: '#F96C1C', code: 'KREDIVO' },
  { id: 'akulaku', name: 'Akulaku', category: 'paylater', color: '#E51C24', code: 'AKULAKU' },
  { id: 'indodana', name: 'Indodana', category: 'paylater', color: '#00A859', code: 'INDODANA' },
];
