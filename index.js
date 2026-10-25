// index.js — ManzxyOTP
// ─────────────────────────────────────────────────────────────────────────
// Copyright (c) 2026 Manzxy. Open Source (MIT + Atribusi Wajib).
// GitHub: github.com/manzxy — Lisensi lengkap: lihat berkas LICENSE
// Atribusi "Manzxy" wajib tetap ada di source code, README, dan credit —
// bebas dipakai/dimodifikasi/di-fork selama watermark ini tidak dihapus.
// ─────────────────────────────────────────────────────────────────────────
'use strict';

require('dotenv').config();
const TelegramBot     = require('node-telegram-bot-api');
const cfg             = require('./config');
const log             = require('./src/utils/logger');
const { initPlugins } = require('./src/utils/plugin-loader');
const { fmt }         = require('./src/utils/helpers');
const botinfo         = require('./src/utils/botinfo');
const { getMode, withMode } = require('./src/utils/mode');

// ── Validasi env ──────────────────────────────────────────────────────────────
if (!cfg.bot_token || cfg.bot_token === 'ISI_TOKEN_BOT') {
  console.error('❌ BOT_TOKEN belum diisi di .env'); process.exit(1);
}
// Format token Telegram yang valid selalu "<digit>:<35 karakter>". Kalau tidak
// cocok, hampir pasti ada karakter nyasar (spasi/kutip/\r) ikut ke-copy — ini
// penyebab paling sering ETELEGRAM 404 Not Found saat bot.getMe() dipanggil.
if (!/^\d+:[A-Za-z0-9_-]{30,}$/.test(cfg.bot_token)) {
  console.warn('⚠️  Format BOT_TOKEN kelihatan tidak wajar (dicek: ' +
    `"${cfg.bot_token.slice(0, 6)}...${cfg.bot_token.slice(-4)}", panjang ${cfg.bot_token.length}).`);
  console.warn('    Kemungkinan ada spasi/kutip/karakter tersembunyi ikut ter-copy ke .env.');
  console.warn('    Ambil ulang token dari @BotFather → /mybots → API Token, lalu paste tanpa spasi.');
}
if (!cfg.ditznesia.api_key || cfg.ditznesia.api_key === 'ISI_API_KEY' || cfg.ditznesia.api_key === 'ISI_API_KEY_DITZNESIA') {
  console.error('❌ DITZNESIA_KEY belum diisi di .env'); process.exit(1);
}
if (!cfg.kipay.api_key || cfg.kipay.api_key === 'ISI_API_KEY_KIPAY') {
  console.warn('⚠️  KIPAY_API_KEY belum diisi — deposit tidak berfungsi');
}

// ── State global ──────────────────────────────────────────────────────────────
const pending        = new Map(); // order OTP aktif per user
const pendingDeposit = new Map(); // deposit QRIS aktif per ref_no

// ── Bot ───────────────────────────────────────────────────────────────────────
// autoStart: false — sengaja TIDAK langsung polling. Token divalidasi dulu
// lewat bot.getMe() di bawah; handler, job, dan plugin baru didaftarkan
// (dan polling baru dimulai) SETELAH token terbukti valid. Urutan lama
// (semua didaftarkan duluan lalu getMe() belakangan) bikin log auto-topup/
// plugin nongol duluan sebelum error token kelihatan — membingungkan saat
// debug. Sekarang urutannya: validasi dulu, baru jalan.
const bot = new TelegramBot(cfg.bot_token, {
  polling: { interval: 300, autoStart: false, params: { timeout: 10 } },
});

log.init(bot);

// ── Graceful shutdown ─────────────────────────────────────────────────────────
const shutdown = (reason) => {
  log.logWarn(`shutdown diminta — ${reason}`);
  log.logBotStop(reason);
  setTimeout(() => process.exit(0), 1500);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT (Ctrl+C)'));
process.on('uncaughtException',  (e) => log.logError({ id: '-', first_name: 'system' }, 'uncaughtException', e.stack || e.message));
process.on('unhandledRejection', (r) => log.logError({ id: '-', first_name: 'system' }, 'unhandledRejection', r?.message || r));

// ── Start ─────────────────────────────────────────────────────────────────────
bot.getMe()
  .then((me) => {
    botinfo.setUsername(me.username);

    // Token valid — baru sekarang daftarkan semua handler, job, dan plugin.
    //
    // ── Mode OTP vs MD ──────────────────────────────────────────────────────
    // Satu bot (satu token), dua "kepribadian" yang bisa di-switch owner lewat
    // /setmode — command-command OTP di bawah ini dibungkus withMode(bot,'otp')
    // supaya otomatis diam kalau mode bot lagi 'md', TANPA perlu edit kode di
    // dalam menu.js/callback.js/dst sama sekali. Lihat src/utils/mode.js.
    const otpBot = withMode(bot, 'otp');
    require('./src/handlers/menu')(otpBot);
    require('./src/handlers/otp')(otpBot, pending);
    require('./src/handlers/deposit')(otpBot, pendingDeposit);
    require('./src/handlers/admin')(otpBot, pending, pendingDeposit);
    require('./src/handlers/callback')(otpBot, pending, pendingDeposit);

    // Job background (auto-expire order, auto-poll deposit, pantau saldo Ditznesia)
    // SENGAJA tidak di-gate mode — transaksi yang lagi berjalan harus tetap
    // diselesaikan walau owner pindah mode di tengah jalan.
    require('./src/jobs/poller')(bot, pending, pendingDeposit);
    require('./src/jobs/autotopup')(bot);

    initPlugins(bot); // hot-reload dari /plugins (mode OTP)

    // /setmode harus selalu aktif apapun mode-nya, jadi daftar di bot asli,
    // bukan otpBot/mdBot yang ke-gate.
    require('./src/handlers/setmode')(bot);

    // ── Mode MD (utility/grup) ───────────────────────────────────────────────
    const { initMdPlugins, plugins: mdPlugins } = require('./src/md/core/pluginLoader');
    initMdPlugins();
    require('./src/md/core/dispatcher')(bot, mdPlugins);
    require('./src/md/core/callbacks')(bot, mdPlugins); // router tombol (menu MD + tombol milik plugin)

    bot.on('polling_error', (e) => log.logError({ id: '-', first_name: 'system' }, 'polling_error', e.code ? `${e.code} ${e.message}` : e.message));
    bot.on('error',         (e) => log.logError({ id: '-', first_name: 'system' }, 'bot_error', e.message));

    bot.startPolling();

    const mdCount = new Set(mdPlugins.values()).size;
    log.printBanner([
      ['—', 'Bot'],
      ['Username',     `@${me.username}`],
      ['Status',       '● Online'],
      ['Mode aktif',   `${getMode().toUpperCase()}  (ganti: /setmode)`],
      ['Admin',        cfg.admin_ids.join(', ') || '(belum diset)'],
      ['—', 'Layanan'],
      ['Provider OTP', `Ditznesia (server ${cfg.ditznesia.servers.join(',')})`],
      ['Payment',      'KiPay QRIS'],
      ['Plugin MD',    `${mdCount} command`],
      ['Auto-OTP',     `cek tiap ${cfg.quick.poll_sec} detik`],
      ['—', 'Pengaturan'],
      ['Markup User',  `${cfg.price_markup_pct}%`],
      ['Referral',     `${fmt(cfg.referral.bonus)} / user baru`],
      ['Limit MD',     `free ${cfg.md_limit_free} · premium ${cfg.md_limit_premium} / hari`],
      ['Pantau Saldo', cfg.auto_topup?.enabled ? `aktif (min ${fmt(cfg.auto_topup.threshold)})` : 'nonaktif'],
      ['Maintenance',  cfg.maintenance?.enabled ? `${cfg.maintenance.start_hour}:00-${cfg.maintenance.end_hour}:00 WIB` : 'nonaktif'],
      ['Log Channel',  cfg.log_channel_id || '(tidak diset)'],
    ]);
    log.logBotStart(me, cfg.admin_ids);

    // Heartbeat log tiap 6 jam
    setInterval(() => {
      const upH = Math.floor(process.uptime() / 3600);
      const upM = Math.floor((process.uptime() % 3600) / 60);
      log.logInfo(`heartbeat — uptime ${upH}j ${upM}m | order aktif: ${pending.size} | deposit aktif: ${pendingDeposit.size}`);
    }, 6 * 60 * 60 * 1000);
  })
  .catch((e) => {
    console.error(`❌ Gagal connect ke Telegram: ${e.message}`);
    if (String(e.message).includes('404')) {
      console.error('');
      console.error('   Error 404 dari Telegram HAMPIR SELALU berarti BOT_TOKEN salah/tidak valid, bukan masalah jaringan. Cek:');
      console.error('   1. Buka file .env (bukan .env.example) — pastikan BOT_TOKEN sudah diisi token asli');
      console.error('   2. Pastikan tidak ada spasi/kutip di awal atau akhir token');
      console.error('   3. Ambil ulang token dari @BotFather di Telegram → /mybots → pilih bot → API Token');
      console.error(`   4. Token yang kebaca sekarang: "${cfg.bot_token.slice(0, 6)}...${cfg.bot_token.slice(-4)}" (panjang ${cfg.bot_token.length} karakter)`);
      console.error('');
    }
    process.exit(1);
  });
