// src/utils/keyboard.js — ManzxyOTP (harga dinamis per role)
'use strict';

const cfg = require('../../config');
const { fmt, flagEmoji, chunkRows, paginate, isAdmin, applyMarkup, calcPrice, getUserLevel } = require('./helpers');

// ── Main Menu — ringkas: 1 tombol utama besar + 3 baris pendukung ─────────────
const mainMenu = () => ({
  inline_keyboard: [
    [{ text: '⚡ Beli OTP Sekarang', callback_data: 'menu:otp' }],
    [
      { text: '💳 Isi Saldo', callback_data: 'menu:deposit' },
      { text: '👤 Akun Saya', callback_data: 'menu:profile' },
    ],
    [
      { text: '📋 Riwayat',  callback_data: 'menu:history' },
      { text: '❓ Bantuan',  callback_data: 'menu:help'    },
    ],
  ],
});

// Halaman Akun — pintu ke fitur akun yang jarang dipakai
const profileMenu = () => ({
  inline_keyboard: [
    [
      { text: '🏅 Level & Diskon', callback_data: 'menu:level'    },
      { text: '🔗 Referral',       callback_data: 'menu:referral' },
    ],
    [{ text: '💰 Riwayat Saldo',   callback_data: 'menu:depohist' }],
    [{ text: '🏠 Menu Utama',      callback_data: 'back:main'     }],
  ],
});

// Halaman Bantuan
const helpMenu = () => ({
  inline_keyboard: [
    [{ text: '📞 Hubungi CS Admin', url: `https://t.me/${cfg.admin_username}` }],
    [
      { text: '🏆 Top Member', callback_data: 'menu:top'     },
      { text: '🔒 Privasi',    callback_data: 'menu:privacy' },
    ],
    [{ text: '🏠 Menu Utama',  callback_data: 'back:main'    }],
  ],
});

// ── Beli OTP: pilih aplikasi (langkah 1 jalur cepat) ──────────────────────────
const quickAppsMenu = (apps) => {
  const rows = chunkRows(apps.map((a, i) => ({ text: `${a.icon} ${a.name}`, callback_data: `qa:${i}` })), 2);
  rows.push([{ text: '🌍 Negara / Server Lain', callback_data: 'menu:manual' }]);
  rows.push([{ text: '🏠 Menu Utama', callback_data: 'back:main' }]);
  return { inline_keyboard: rows };
};

// ── Beli OTP: pilihan rekomendasi (langkah 2) — tiap tombol langsung beli ────
const LABEL_ICON = { best: '🏆', fast: '⚡', cheap: '💰' };
const quickOptionsMenu = (options, prices) => {
  const rows = options.map((o, i) => [{
    text: `${o.labels.map((l) => LABEL_ICON[l]).join('')} Beli ${fmt(prices[i])} • Server ${o.server}`,
    callback_data: `qb:${i}`,
  }]);
  rows.push([
    { text: '◀ Aplikasi Lain', callback_data: 'menu:otp'    },
    { text: '🌍 Server Lain',  callback_data: 'menu:manual' },
  ]);
  return { inline_keyboard: rows };
};

const quickConfirmMenu = () => ({
  inline_keyboard: [
    [{ text: '✅ Ya, Beli Sekarang!', callback_data: 'o:0' }],
    [{ text: '◀ Pilihan Lain',       callback_data: 'back:quick' }],
  ],
});

// ── Server (jalur manual) — ⭐ = rekomendasi bot, ⚡ = median OTP masuk ───────
const serversMenu = (servers, hints = {}) => {
  const btns = servers.map((sv) => {
    const star = hints.best === sv.id ? ' ⭐' : '';
    const sec  = hints.sec?.[sv.id];
    return { text: `📡 Server ${sv.id}${star}${sec ? ` • ⚡${sec}s` : ''}`, callback_data: `sv:${sv.id}` };
  });
  const rows = chunkRows(btns, 2);
  rows.push([{ text: '◀ Kembali', callback_data: 'menu:otp' }]);
  return { inline_keyboard: rows };
};

// ── Countries (langkah 2) ─────────────────────────────────────────────────────
const countriesMenu = (countries, page = 0) => {
  const { items, pages, current } = paginate(countries, page, cfg.page_size.countries);
  const btns = items.map((c) => {
    const idx = countries.indexOf(c);
    return { text: `${flagEmoji(c.iso_code)} ${c.name}`, callback_data: `c:${idx}:${page}` };
  });
  const rows = chunkRows(btns, 2);
  const nav  = [];
  if (current > 1)     nav.push({ text: '◀ Prev', callback_data: `cp:${page - 1}` });
  nav.push({ text: `${current} / ${pages}`, callback_data: 'noop' });
  if (current < pages) nav.push({ text: 'Next ▶', callback_data: `cp:${page + 1}` });
  if (pages > 1) rows.push(nav);
  rows.push([
    { text: '🔍 Cari Negara', callback_data: 'cty:search' },
    { text: '◀ Kembali',     callback_data: 'back:svc'   },
  ]);
  return { inline_keyboard: rows };
};

// ── Services + harga (langkah 3) — harga dinamis sesuai role (admin lihat harga modal) ──
// Server 2/4/5 punya beberapa varian per layanan; tiap varian tampil sebagai tombol sendiri
// dengan harganya, jadi user langsung memilih layanan + harga sekaligus.
const servicesMenu = (services, page = 0, userId = null) => {
  const { items, pages, current } = paginate(services, page, cfg.page_size.services);
  const discAktif = userId && !isAdmin(userId) && getUserLevel(userId).current.discount > 0;
  const btns = items.map((s) => {
    const idx    = services.indexOf(s);
    const marked = applyMarkup(s.price);
    const price  = userId ? calcPrice(s.price, marked, userId) : marked;
    const badge  = userId && isAdmin(userId) ? ' 👑' : discAktif ? ' 🎁' : '';
    const rate   = s.rate_sms != null ? ` ✅${s.rate_sms}%` : '';
    return { text: `📱 ${s.service_name} • ${fmt(price)}${badge}${rate}`, callback_data: `s:${idx}:${page}` };
  });
  const rows = chunkRows(btns, 1);
  const nav  = [];
  if (current > 1)     nav.push({ text: '◀ Prev', callback_data: `sp:${page - 1}` });
  nav.push({ text: `${current} / ${pages}`, callback_data: 'noop' });
  if (current < pages) nav.push({ text: 'Next ▶', callback_data: `sp:${page + 1}` });
  if (pages > 1) rows.push(nav);
  rows.push([
    { text: '🔍 Cari Layanan', callback_data: 'svc:search' },
    { text: '◀ Kembali',       callback_data: 'back:cty'   },
  ]);
  return { inline_keyboard: rows };
};

// ── Operators (khusus server 1) ───────────────────────────────────────────────
const operatorsMenu = (operators) => {
  const btns = operators.map((op, idx) => ({
    text:          op.name === 'any' ? '✅ Semua Operator' : `📶 ${op.name.toUpperCase()}`,
    callback_data: `o:${idx}`,
  }));
  const rows = chunkRows(btns, 2);
  rows.push([{ text: '◀ Kembali', callback_data: 'back:stk' }]);
  return { inline_keyboard: rows };
};

// ── Konfirmasi Order ──────────────────────────────────────────────────────────
const confirmOrderMenu = (opIdx, canBuy = true) => ({
  inline_keyboard: [
    canBuy ? [{ text: '✅ Ya, Beli Sekarang!', callback_data: `o:${opIdx}` }] : [],
    [{ text: canBuy ? '❌ Batal'  : '💳 Isi Saldo', callback_data: canBuy ? 'back:stk' : 'menu:deposit' }],
  ].filter((r) => r.length > 0),
});

// ── Order aktif ───────────────────────────────────────────────────────────────
const orderActiveMenu = (orderId) => ({
  inline_keyboard: [
    [{ text: '📨 Cek OTP', callback_data: `otp:${orderId}` }],
    [{ text: '✖️ Batalkan', callback_data: `cnl:${orderId}` }],
  ],
});

// ── Deposit ───────────────────────────────────────────────────────────────────
const depositAmountMenu = () => ({
  inline_keyboard: [
    [
      { text: '💵 Rp 10.000',  callback_data: 'dep:10000'  },
      { text: '💵 Rp 25.000',  callback_data: 'dep:25000'  },
      { text: '💵 Rp 50.000',  callback_data: 'dep:50000'  },
    ],
    [
      { text: '💵 Rp 100.000', callback_data: 'dep:100000' },
      { text: '💵 Rp 200.000', callback_data: 'dep:200000' },
      { text: '💵 Rp 500.000', callback_data: 'dep:500000' },
    ],
    [{ text: '✏️ Nominal Lain', callback_data: 'dep:custom' }],
    [{ text: '🏠 Menu Utama',   callback_data: 'back:main'  }],
  ],
});

const depositConfirmMenu = (refNo) => ({
  inline_keyboard: [
    [{ text: '✅ Cek Status Pembayaran', callback_data: `dc:${refNo}` }],
    [{ text: '✖️ Batalkan',              callback_data: `dx:${refNo}` }],
  ],
});

// ── Saldo kurang ──────────────────────────────────────────────────────────────
const saldoKurangMenu = () => ({
  inline_keyboard: [
    [{ text: '💳 Isi Saldo Sekarang', callback_data: 'menu:deposit' }],
    [{ text: '🏠 Menu Utama',         callback_data: 'back:main'   }],
  ],
});

// ── Join Check ────────────────────────────────────────────────────────────────
const joinCheckMenu = (channels) => ({
  inline_keyboard: [
    ...channels.map((ch) => [{ text: `📢 Join ${ch.name}`, url: ch.url }]),
    [{ text: '✅ Sudah Join — Verifikasi', callback_data: 'joincheck:verify' }],
  ],
});

const backMainMenu = () => ({
  inline_keyboard: [[{ text: '🏠 Menu Utama', callback_data: 'back:main' }]],
});

module.exports = {
  mainMenu, profileMenu, helpMenu, quickAppsMenu, quickOptionsMenu, quickConfirmMenu, serversMenu, countriesMenu, servicesMenu, operatorsMenu,
  confirmOrderMenu, orderActiveMenu,
  depositAmountMenu, depositConfirmMenu, saldoKurangMenu,
  joinCheckMenu, backMainMenu,
};
