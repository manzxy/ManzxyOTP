// config.js — ManzxyOTP
'use strict';

const fs   = require('fs');
const path = require('path');
require('dotenv').config();

// Peringatan dini kalau file .env tidak ada sama sekali — ini penyebab paling
// umum kenapa semua API key "kebaca kosong" padahal sudah diisi (biasanya
// karena yang diisi cuma .env.example, bukan .env hasil copy-nya).
if (!fs.existsSync(path.join(__dirname, '.env'))) {
  console.warn('⚠️  File .env tidak ditemukan di root project!');
  console.warn('    Jalankan: cp .env.example .env   lalu isi API key di dalamnya.');
}

// Helper baca env var — SELALU di-trim.
// Kenapa penting: copy-paste token dari HP/notes app/WhatsApp sering nyelipin
// spasi atau karakter \r (CRLF) di ujung nilai. Token yang keliatan "benar"
// di layar tapi ada \r tersembunyi bikin request ke Telegram/KiPay gagal
// dengan error yang membingungkan (mis. ETELEGRAM 404 Not Found).
const env = (key, fallback = '') => {
  const v = process.env[key];
  return v !== undefined && v !== '' ? String(v).trim() : fallback;
};
const envNum = (key, fallback) => {
  const v = env(key, '');
  const n = Number(v);
  return v !== '' && !Number.isNaN(n) ? n : fallback;
};

module.exports = {
  bot_token:            env('BOT_TOKEN', 'ISI_TOKEN_BOT'),
  bot_name:             'ManzxyOTP',
  bot_version:          'v1.6',
  admin_ids:            env('ADMIN_IDS', '').split(',').map((s) => Number(s.trim())).filter(Boolean),
  admin_username:       env('ADMIN_USERNAME', 'adminmu'),
  price_markup_pct:     envNum('PRICE_MARKUP', 0),
  // Markup khusus untuk admin/owner — bisa di-set lebih kecil atau 0 (harga modal)
  // Jika tidak diset, admin pakai PRICE_MARKUP_ADMIN, default 0% (harga modal asli)
  admin_markup_pct:     envNum('PRICE_MARKUP_ADMIN', 0),
  order_expire_minutes: envNum('ORDER_EXPIRE_MINUTES', 20),

  // ── Beli OTP cepat (tombol aplikasi + rekomendasi server otomatis) ─────────
  quick: {
    // Aplikasi yang tampil sebagai tombol di "Beli OTP" (nama layanan Ditznesia, huruf kecil)
    services:  env('QUICK_SERVICES', 'whatsapp,telegram,instagram,facebook,tiktok,twitter')
                 .split(',').map((x) => x.trim().toLowerCase()).filter(Boolean),
    // Negara default untuk rekomendasi (cocok sebagian dengan nama negara di Ditznesia)
    country:   env('QUICK_COUNTRY', 'indonesia'),
    // Jeda auto-cek OTP masuk (detik) — OTP dikirim otomatis ke user tanpa tekan "Cek OTP"
    poll_sec:  envNum('OTP_POLL_SEC', 6),
  },
  log_channel_id:       env('LOG_CHANNEL_ID', '') || null,
  currency:             'Rp',

  // ── Mode MD: limit harian per USER ────────────────────────────────────────
  // Tiap user punya jatah limit per hari; tiap fitur memotong sekian limit
  // (mis. .tiktok = 1). Reset otomatis tiap jam 00:00 di zona waktu di bawah.
  // Jatah per user bisa diubah owner lewat .setlimit (menimpa angka default ini).
  md_limit_free:        envNum('MD_LIMIT_FREE', 10),
  md_limit_premium:     envNum('MD_LIMIT_PREMIUM', 20),
  md_timezone:          env('MD_TIMEZONE', 'Asia/Jakarta'),
  db_path:              './data/db.json',

  // ── Ditznesia (provider OTP / nomor virtual) ──────────────────────────────
  // Docs: https://www.ditznesia.com/api-docs — auth lewat query param `apikey`.
  ditznesia: {
    api_key:  env('DITZNESIA_KEY', 'ISI_API_KEY'),
    // Bisa dioverride via .env kalau Ditznesia pindah domain/path.
    base_url: env('DITZNESIA_BASE_URL', 'https://www.ditznesia.com/api/dev'),
    // Server yang ditampilkan ke user (urutan = urutan tombol). Hapus nomor server
    // yang sedang bermasalah, mis. DITZNESIA_SERVERS=1,3,4
    servers:  env('DITZNESIA_SERVERS', '1,2,3,4,5').split(',').map((s) => s.trim()).filter(Boolean),
  },

  // ── KiPay Payment Gateway (QRIS) ──────────────────────────────────────────
  // Docs: https://kipay.id/docs/api — auth cukup lewat apiKey di path, tanpa header.
  kipay: {
    api_key: env('KIPAY_API_KEY', 'ISI_API_KEY_KIPAY'),
  },

  // ── QRIS settings ─────────────────────────────────────────────────────────
  // NB: KiPay menentukan masa berlaku QR sendiri (field expires_at dari API).
  // Nilai di bawah hanya dipakai sebagai fallback/buffer jika expires_at
  // entah kenapa tidak tersedia — bukan parameter yang dikirim ke KiPay.
  qris_expiry_minutes: envNum('QRIS_EXPIRY_MINUTES', 30),

  // ── Maintenance window ────────────────────────────────────────────────────
  // Format: jam WIB — bot ditolak diluar jam operasional
  maintenance: {
    enabled:    env('MAINTENANCE_ENABLED', 'false') === 'true',
    start_hour: envNum('MAINTENANCE_START_HOUR', 23), // 23:00 WIB
    end_hour:   envNum('MAINTENANCE_END_HOUR', 1),    // 01:00 WIB
    message:    env('MAINTENANCE_MESSAGE', 'Bot sedang maintenance. Coba lagi setelah jam 01.00 WIB.'),
  },

  // ── Pantau saldo Ditznesia (auto-topup) ───────────────────────────────────
  // Ditznesia TIDAK menyediakan endpoint deposit lewat API, jadi bot hanya
  // memantau saldo & mengirim peringatan ke admin saat saldo < threshold.
  // Isi saldo dilakukan manual lewat dashboard Ditznesia (tombol "+" di samping saldo).
  auto_topup: {
    enabled:            env('AUTO_TOPUP_ENABLED', 'false') === 'true',
    threshold:          envNum('AUTO_TOPUP_THRESHOLD', 50000),
    // Nominal top-up yang disarankan di pesan peringatan (hanya info)
    amount:             envNum('AUTO_TOPUP_AMOUNT', 200000),
    check_interval_min: envNum('AUTO_TOPUP_INTERVAL_MIN', 30),
    // Jeda minimal antar peringatan yang sama (menit) supaya admin tidak dispam
    alert_cooldown_min: envNum('AUTO_TOPUP_ALERT_COOLDOWN_MIN', 180),
  },

  // ── Referral ───────────────────────────────────────────────────────────────
  // Bonus saldo (Rp) untuk referrer setiap ada user baru yang start via link referral
  referral: {
    bonus: envNum('REFERRAL_BONUS', 150),
  },

  page_size: {
    services:  8,
    countries: 8,
    stock:     10,
  },

  // ── Wajib Join Channel ────────────────────────────────────────────────────
  required_channels: env('REQUIRED_CHANNELS', '')
    .split('|').filter(Boolean)
    .map((raw) => {
      const [id, name, url] = raw.split(',');
      return { id: (id || '').trim(), name: (name || '').trim(), url: (url || '').trim() };
    }),

  join_prompt_photo: env('JOIN_PROMPT_PHOTO', '') || null,
};
