// src/utils/levels.js — Sistem Tingkatan (Level) Member ManzxyOTP
// Level naik otomatis berdasarkan jumlah order SUKSES (OTP diterima).
// Semakin tinggi level, semakin besar diskon tambahan yang didapat user
// di atas harga normal — ini murni bonus loyalitas, tidak mengubah
// markup dasar yang di-set admin lewat PRICE_MARKUP.
'use strict';

// Urutan WAJIB dari level terendah ke tertinggi.
// threshold = minimal jumlah order sukses untuk mencapai level ini.
// discount  = diskon tambahan (%) dari harga jual normal, khusus user non-admin.
const LEVELS = [
  { key: 'starter',  name: 'Starter',  icon: '🌱', threshold: 0,   discount: 0  },
  { key: 'bronze',   name: 'Bronze',   icon: '🥉', threshold: 5,   discount: 1  },
  { key: 'silver',   name: 'Silver',   icon: '🥈', threshold: 20,  discount: 2  },
  { key: 'gold',     name: 'Gold',     icon: '🥇', threshold: 50,  discount: 4  },
  { key: 'platinum', name: 'Platinum', icon: '💠', threshold: 100, discount: 6  },
  { key: 'vip',      name: 'VIP',      icon: '💎', threshold: 250, discount: 10 },
];

/** Hitung jumlah order berstatus completed (OTP berhasil diterima). */
const countSukses = (orders = []) => orders.filter((o) => o.status === 'completed').length;

/**
 * Ambil level user saat ini berdasarkan riwayat order.
 * @param {Array} orders  Riwayat order user (user.orders)
 * @returns {{ key, name, icon, threshold, discount }}
 */
const getLevel = (orders = []) => {
  const sukses = countSukses(orders);
  let current = LEVELS[0];
  for (const lvl of LEVELS) if (sukses >= lvl.threshold) current = lvl;
  return current;
};

/** Level berikutnya yang belum tercapai, atau null jika sudah level tertinggi. */
const getNextLevel = (orders = []) => {
  const sukses = countSukses(orders);
  return LEVELS.find((lvl) => lvl.threshold > sukses) || null;
};

/**
 * Progres lengkap menuju level berikutnya — dipakai untuk tampilan profil.
 * @returns {{ sukses, current, next, remaining, percent }}
 */
const getProgress = (orders = []) => {
  const sukses  = countSukses(orders);
  const current = getLevel(orders);
  const next    = getNextLevel(orders);
  if (!next) return { sukses, current, next: null, remaining: 0, percent: 100 };
  const span    = next.threshold - current.threshold;
  const done    = sukses - current.threshold;
  const percent = span > 0 ? Math.min(100, Math.max(0, Math.round((done / span) * 100))) : 100;
  return { sukses, current, next, remaining: next.threshold - sukses, percent };
};

/** Progress bar visual sederhana, contoh: ▰▰▰▰▱▱▱▱▱▱ */
const progressBar = (percent, size = 10) => {
  const filled = Math.min(size, Math.max(0, Math.round((percent / 100) * size)));
  return '▰'.repeat(filled) + '▱'.repeat(size - filled);
};

module.exports = { LEVELS, countSukses, getLevel, getNextLevel, getProgress, progressBar };
