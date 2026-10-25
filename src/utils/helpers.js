// src/utils/helpers.js
'use strict';

const cfg    = require('../../config');
const db     = require('./db');
const levels = require('./levels');
const { currency, admin_ids } = cfg;

const fmt     = (n) => `${currency}${Number(n || 0).toLocaleString('id-ID')}`;
const isAdmin = (id) => admin_ids.includes(Number(id));

/**
 * Ambil info level (tingkatan) member sebuah user, lengkap dengan progres
 * menuju level berikutnya. Dipakai oleh helpers.calcPrice, messages.js, dll.
 * @param {number} userId
 * @returns {{ sukses, current, next, remaining, percent }}
 */
const getUserLevel = (userId) => levels.getProgress(db.getUser(userId).orders || []);

/**
 * Hitung harga final berdasarkan role & level user.
 * - Owner/Admin : pakai admin_markup_pct (default 0% = harga modal asli), TIDAK terpengaruh diskon level.
 * - User biasa  : pakai price_markup_pct (markup normal dari provider/API),
 *                 lalu dikurangi diskon loyalitas sesuai LEVEL member (lihat utils/levels.js).
 *                 Harga akhir tidak akan pernah lebih murah dari harga modal (basePrice).
 *
 * @param {number} basePrice    Harga ASLI dari Ditznesia (sebelum markup apapun)
 * @param {number} markedPrice  Harga setelah markup user (lihat applyMarkup)
 * @param {number} userId       ID user untuk cek role & level
 * @returns {number} harga final yang ditampilkan & dipotong dari saldo
 */
const calcPrice = (basePrice, markedPrice, userId) => {
  if (isAdmin(userId)) {
    // Admin: harga modal + markup_admin (biasanya 0)
    const adminMarkup = cfg.admin_markup_pct || 0;
    return Math.ceil(basePrice * (1 + adminMarkup / 100));
  }
  // User biasa: harga sudah di-markup (applyMarkup)
  const price = markedPrice || basePrice;
  const { current } = getUserLevel(userId);
  if (!current.discount) return price;
  return Math.max(basePrice, Math.round(price * (1 - current.discount / 100)));
};
/**
 * Terapkan markup user biasa (PRICE_MARKUP, persen) ke harga modal dari Ditznesia.
 * Dibulatkan ke atas ke rupiah penuh. Admin pakai calcPrice() (markup admin).
 * @param {number} basePrice Harga modal asli dari Ditznesia
 */
const applyMarkup = (basePrice) => Math.ceil(Number(basePrice || 0) * (1 + (cfg.price_markup_pct || 0) / 100));

const fmtDate = (isoOrMs) => {
  const d = new Date(isoOrMs);
  if (isNaN(d)) return '-';
  return d.toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const timeAgo = (isoOrMs) => {
  const m = Math.floor((Date.now() - new Date(isoOrMs)) / 60000);
  if (m <  1)  return 'baru saja';
  if (m < 60)  return `${m} mnt lalu`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h} jam lalu`;
  return `${Math.floor(h / 24)} hari lalu`;
};

const paginate = (arr, page, size) => ({
  items:   arr.slice(page * size, (page + 1) * size),
  total:   arr.length,
  pages:   Math.max(1, Math.ceil(arr.length / size)),
  current: page + 1,
});

const chunkRows = (arr, cols = 2) => {
  const rows = [];
  for (let i = 0; i < arr.length; i += cols) rows.push(arr.slice(i, i + cols));
  return rows;
};

const statusEmoji = (s) => ({
  pending: '⏳', received: '📨', completed: '✅',
  canceled: '❌', cancelled: '❌', expiring: '⚠️',
  success: '✅', cancel: '❌', expired: '🕐',
}[s] || '•');

// ── Emoji bendera ASLI dari ISO 3166-1 alpha-2 ────────────────────────────────
// Unicode regional indicator: A=U+1F1E6, B=U+1F1E7, ... Z=U+1F1FF
const flagEmoji = (isoCode) => {
  if (!isoCode) return '🌐';
  // Ditznesia mengirim bendera sebagai emoji langsung (field `flag`) — tampilkan apa adanya.
  if (/[^\x00-\x7F]/.test(String(isoCode))) return String(isoCode).trim();
  const code = String(isoCode).trim().toUpperCase();
  // Handle kode 2 huruf (standar)
  if (code.length === 2) {
    const A = 0x1F1E6;
    const offset = 'A'.charCodeAt(0);
    const c1 = code.charCodeAt(0) - offset;
    const c2 = code.charCodeAt(1) - offset;
    if (c1 >= 0 && c1 < 26 && c2 >= 0 && c2 < 26) {
      return String.fromCodePoint(A + c1) + String.fromCodePoint(A + c2);
    }
  }
  // Mapping kode umum yang mungkin bukan ISO standar
  const map = {
    'UK': '🇬🇧', 'EN': '🇬🇧', 'ENG': '🇬🇧',
    'USA': '🇺🇸', 'US': '🇺🇸',
    'IDN': '🇮🇩', 'ID': '🇮🇩',
    'MYS': '🇲🇾', 'MY': '🇲🇾',
    'SGP': '🇸🇬', 'SG': '🇸🇬',
    'THA': '🇹🇭', 'TH': '🇹🇭',
    'PHL': '🇵🇭', 'PH': '🇵🇭',
    'VNM': '🇻🇳', 'VN': '🇻🇳',
    'IND': '🇮🇳', 'IN': '🇮🇳',
    'CHN': '🇨🇳', 'CN': '🇨🇳',
    'JPN': '🇯🇵', 'JP': '🇯🇵',
    'KOR': '🇰🇷', 'KR': '🇰🇷',
    'AUS': '🇦🇺', 'AU': '🇦🇺',
    'DEU': '🇩🇪', 'DE': '🇩🇪',
    'FRA': '🇫🇷', 'FR': '🇫🇷',
    'RUS': '🇷🇺', 'RU': '🇷🇺',
    'BRA': '🇧🇷', 'BR': '🇧🇷',
    'MEX': '🇲🇽', 'MX': '🇲🇽',
    'PAK': '🇵🇰', 'PK': '🇵🇰',
    'BGD': '🇧🇩', 'BD': '🇧🇩',
    'NGA': '🇳🇬', 'NG': '🇳🇬',
    'GBR': '🇬🇧', 'GB': '🇬🇧',
    'CAN': '🇨🇦', 'CA': '🇨🇦',
    'ESP': '🇪🇸', 'ES': '🇪🇸',
    'ITA': '🇮🇹', 'IT': '🇮🇹',
    'TUR': '🇹🇷', 'TR': '🇹🇷',
    'SAU': '🇸🇦', 'SA': '🇸🇦',
    'ARE': '🇦🇪', 'AE': '🇦🇪',
    'EGY': '🇪🇬', 'EG': '🇪🇬',
    'IRN': '🇮🇷', 'IR': '🇮🇷',
    'UKR': '🇺🇦', 'UA': '🇺🇦',
    'POL': '🇵🇱', 'PL': '🇵🇱',
    'NLD': '🇳🇱', 'NL': '🇳🇱',
    'COL': '🇨🇴', 'CO': '🇨🇴',
    'ARG': '🇦🇷', 'AR': '🇦🇷',
    'ZAF': '🇿🇦', 'ZA': '🇿🇦',
    'KEN': '🇰🇪', 'KE': '🇰🇪',
    'GHA': '🇬🇭', 'GH': '🇬🇭',
    'ETH': '🇪🇹', 'ET': '🇪🇹',
    'KAZ': '🇰🇿', 'KZ': '🇰🇿',
    'UZB': '🇺🇿', 'UZ': '🇺🇿',
    'MMR': '🇲🇲', 'MM': '🇲🇲',
    'KHM': '🇰🇭', 'KH': '🇰🇭',
    'LAO': '🇱🇦', 'LA': '🇱🇦',
    'NPL': '🇳🇵', 'NP': '🇳🇵',
    'LKA': '🇱🇰', 'LK': '🇱🇰',
    'BGO': '🇧🇬', 'BG': '🇧🇬',
    'HRV': '🇭🇷', 'HR': '🇭🇷',
    'CZE': '🇨🇿', 'CZ': '🇨🇿',
    'HUN': '🇭🇺', 'HU': '🇭🇺',
    'ROU': '🇷🇴', 'RO': '🇷🇴',
    'SWE': '🇸🇪', 'SE': '🇸🇪',
    'NOR': '🇳🇴', 'NO': '🇳🇴',
    'DNK': '🇩🇰', 'DK': '🇩🇰',
    'FIN': '🇫🇮', 'FI': '🇫🇮',
    'BEL': '🇧🇪', 'BE': '🇧🇪',
    'CHE': '🇨🇭', 'CH': '🇨🇭',
    'AUT': '🇦🇹', 'AT': '🇦🇹',
    'PRT': '🇵🇹', 'PT': '🇵🇹',
    'GRC': '🇬🇷', 'GR': '🇬🇷',
    'ISR': '🇮🇱', 'IL': '🇮🇱',
    'NZL': '🇳🇿', 'NZ': '🇳🇿',
    'PER': '🇵🇪', 'PE': '🇵🇪',
    'CHL': '🇨🇱', 'CL': '🇨🇱',
    'VEN': '🇻🇪', 'VE': '🇻🇪',
    'ECU': '🇪🇨', 'EC': '🇪🇨',
    'BOL': '🇧🇴', 'BO': '🇧🇴',
    'PRY': '🇵🇾', 'PY': '🇵🇾',
    'URY': '🇺🇾', 'UY': '🇺🇾',
  };
  return map[code] || '🌐';
};

module.exports = { fmt, isAdmin, applyMarkup, fmtDate, timeAgo, paginate, chunkRows, statusEmoji, flagEmoji, calcPrice, getUserLevel };
