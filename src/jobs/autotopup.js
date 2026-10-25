// src/jobs/autotopup.js
// PEMANTAU SALDO DITZNESIA (pengganti auto-topup lama)
//
// Ditznesia tidak menyediakan endpoint deposit lewat API (hanya profile, order,
// status, cancel, resend, history, dll), jadi bot tidak bisa membuat tagihan
// top-up sendiri. Yang dilakukan job ini:
//
// 1. Cek saldo Ditznesia tiap AUTO_TOPUP_INTERVAL_MIN menit
// 2. Kalau saldo < AUTO_TOPUP_THRESHOLD → kirim peringatan ke semua admin
//    (diberi jeda AUTO_TOPUP_ALERT_COOLDOWN_MIN supaya tidak spam)
// 3. Kalau saldo sudah pulih → kirim notifikasi "saldo aman" sekali
//
// Admin tinggal isi saldo lewat dashboard Ditznesia (tombol "+" di samping saldo).
// Terpisah total dari KiPay (gateway deposit user ke saldo bot).
'use strict';

const dz      = require('../providers/ditznesia');
const log     = require('../utils/logger');
const { fmt } = require('../utils/helpers');
const cfg     = require('../../config');

// Halaman dashboard = origin dari base URL API (mis. https://www.ditznesia.com)
const dashboardUrl = (() => {
  try { return new URL(cfg.ditznesia.base_url).origin; } catch { return 'https://www.ditznesia.com'; }
})();

module.exports = (bot) => {
  if (!cfg.auto_topup?.enabled) return;

  const INTERVAL_MS = (cfg.auto_topup.check_interval_min || 30) * 60 * 1000;
  const COOLDOWN_MS = (cfg.auto_topup.alert_cooldown_min || 180) * 60 * 1000;

  let lastAlertAt = 0;
  let wasLow      = false;
  let running     = false;

  const notifyAdmins = (text) => {
    for (const adminId of cfg.admin_ids)
      bot.sendMessage(adminId, text, { parse_mode: 'Markdown', disable_web_page_preview: true }).catch(() => {});
  };

  const check = async () => {
    if (running) return;
    running = true;
    try {
      const { balance: saldo } = await dz.getProviderBalance();
      console.log(`[saldo-ditznesia] Saldo: ${fmt(saldo)}`);

      if (saldo < cfg.auto_topup.threshold) {
        wasLow = true;
        if (Date.now() - lastAlertAt < COOLDOWN_MS) return;
        lastAlertAt = Date.now();

        log.logAutoTopupTriggered(saldo, cfg.auto_topup.amount);
        notifyAdmins(
          `⚠️ *Saldo Ditznesia Menipis*\n` +
          `─────────────────────────\n` +
          `Saldo saat ini  *${fmt(saldo)}*\n` +
          `Batas minimum   ${fmt(cfg.auto_topup.threshold)}\n` +
          `Saran top-up    *${fmt(cfg.auto_topup.amount)}*\n` +
          `─────────────────────────\n\n` +
          `Order OTP akan gagal kalau saldo habis.\n` +
          `Isi saldo lewat dashboard: ${dashboardUrl}`
        );
      } else if (wasLow) {
        wasLow = false;
        lastAlertAt = 0;
        notifyAdmins(`✅ *Saldo Ditznesia Aman*\nSaldo sekarang *${fmt(saldo)}*.`);
      }
    } catch (e) {
      console.error('[saldo-ditznesia] Error:', e.message);
      log.logAutoTopupFailed(e.message);
    } finally {
      running = false;
    }
  };

  setInterval(check, INTERVAL_MS);
  setTimeout(check, 15 * 1000); // cek pertama 15 detik setelah bot nyala

  console.log(`[saldo-ditznesia] Aktif — cek tiap ${cfg.auto_topup.check_interval_min} mnt, threshold ${fmt(cfg.auto_topup.threshold)}`);
};
