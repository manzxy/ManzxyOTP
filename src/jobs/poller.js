// src/jobs/poller.js — ManzxyOTP
// Job 0: Auto-kirim OTP ke user begitu masuk (tanpa tekan "Cek OTP") + ukur kecepatan server
// Job 0b: Hangatkan cache rekomendasi server (tombol aplikasi terasa instan)
// Job 1: Auto-expire order OTP aktif
// Job 2: Auto-poll deposit KiPay (user → bot saldo masuk otomatis)
// Job 3: Verifikasi ulang deposit pending saat restart
'use strict';

const db      = require('../utils/db');
const pgApi   = require('../providers/kipay');
const dz      = require('../providers/ditznesia');
const cancelOrderSafe = require('../utils/orderCancel');
const msg     = require('../utils/messages');
const { fmt } = require('../utils/helpers');
const kb      = require('../utils/keyboard');
const log     = require('../utils/logger');
const serverStats = require('../utils/serverStats');
const recommend   = require('../utils/recommend');
const cfg     = require('../../config');
const { verifyDeposit } = require('../utils/depositVerify');

module.exports = (bot, pending, pendingDeposit) => {

  const S = (uid, text, extra = {}) =>
    bot.sendMessage(uid, text, { parse_mode: 'Markdown', ...extra }).catch(() => {});

  // ── Job 0: Auto-kirim OTP ───────────────────────────────────────────────────
  // Tiap OTP_POLL_SEC detik cek semua order aktif ke Ditznesia. OTP masuk → langsung
  // dikirim ke user. Durasi (beli → OTP terdeteksi) dicatat ke serverStats; itulah dasar
  // badge ⚡ Tercepat & klaim "OTP rata-rata masuk ±N detik".
  const polling = new Set();
  setInterval(() => {
    for (const [uid, state] of [...pending.entries()]) {
      if (polling.has(uid)) continue;
      polling.add(uid);
      (async () => {
        try {
          const res = await dz.getOrderStatus(state.order_id);
          const cur = pending.get(uid);
          if (!cur || cur.order_id !== state.order_id) return;   // sudah diselesaikan user di sela-sela

          if (res.otp_code) {
            pending.delete(uid);
            serverStats.record(state.server, (Date.now() - state.time) / 1000);
            const phone = res.phone_number || state.phone_number;
            db.updateOrder(uid, state.order_id, { status: 'completed', otp_code: res.otp_code, otp_msg: res.otp_msg });
            S(uid, msg.otpReceived(state.order_id, phone, res.otp_code, res.otp_msg), { reply_markup: kb.mainMenu() });
            log.logOTPReceived(db.getUser(uid), state.order_id, phone, res.otp_code);
          } else if (cancelOrderSafe.CANCELED.includes(res.status)) {
            // Dibatalkan / expired di sisi Ditznesia tanpa OTP → refund user
            pending.delete(uid);
            const balance = db.refundBalance(uid, state.price || 0, `refund ${res.status} ${state.order_id}`);
            db.updateOrder(uid, state.order_id, { status: 'canceled' });
            S(uid, msg.orderCancelled(state.order_id, state.price || 0, balance), { reply_markup: kb.mainMenu() });
            log.logOrderCancelled(db.getUser(uid), state.order_id, state.price || 0, balance);
          }
        } catch { /* gangguan sesaat ke Ditznesia — dicoba lagi di putaran berikutnya */ }
        finally { polling.delete(uid); }
      })();
    }
  }, Math.max(3, cfg.quick.poll_sec) * 1000);

  // ── Job 0b: Hangatkan cache rekomendasi ─────────────────────────────────────
  setTimeout(() => recommend.warm().catch(() => {}), 20 * 1000);
  setInterval(() => recommend.warm().catch(() => {}), 2 * 60 * 1000);

  // ── Job 1: Auto-expire order aktif ───────────────────────────────────────────
  // Batas waktu = expires_at_ms dari Ditznesia (fallback: ORDER_EXPIRE_MINUTES).
  // Saat habis, bot TANYA status asli ke Ditznesia dulu — jangan menebak:
  //   • OTP ternyata sudah masuk        → kirim OTP ke user
  //   • Order dibatalkan/expired/bisa dibatalkan → refund saldo user
  //   • Tidak bisa dipastikan           → tandai 'expiring', user diminta hubungi admin
  const ORDER_TTL  = cfg.order_expire_minutes * 60 * 1000;
  const expiring   = new Set();

  setInterval(async () => {
    const now = Date.now();
    for (const [uid, state] of [...pending.entries()]) {
      const deadline = state.expires_ms || (state.time + ORDER_TTL);
      if (now <= deadline || expiring.has(uid)) continue;
      expiring.add(uid);
      try {
        const r = await cancelOrderSafe(dz, state.order_id);
        if (!pending.has(uid)) continue; // sudah diselesaikan user di sela-sela

        if (r.otp) {
          pending.delete(uid);
          const phone = r.otp.phone_number || state.phone_number;
          db.updateOrder(uid, state.order_id, { status: 'completed', otp_code: r.otp.otp_code, otp_msg: r.otp.otp_msg });
          S(uid, msg.otpReceived(state.order_id, phone, r.otp.otp_code, r.otp.otp_msg), { reply_markup: kb.mainMenu() });
          log.logOTPReceived(db.getUser(uid), state.order_id, phone, r.otp.otp_code);
        } else if (r.ok) {
          pending.delete(uid);
          const balance = db.refundBalance(uid, state.price || 0, `refund expired ${state.order_id}`);
          db.updateOrder(uid, state.order_id, { status: 'canceled' });
          S(uid,
            `⏰ *Order Kedaluwarsa*\n─────────────────────────\n` +
            `Order \`${state.order_id}\` (${state.service}) tidak menerima OTP sampai batas waktu.\n\n` +
            `🔄 Saldo *${fmt(state.price || 0)}* sudah dikembalikan.\n💰 Saldo baru *${fmt(balance)}*`,
            { reply_markup: kb.mainMenu() }
          );
          log.logOrderExpired(uid, state.order_id, state.service);
        } else {
          pending.delete(uid);
          db.updateOrder(uid, state.order_id, { status: 'expiring' });
          S(uid,
            `⏰ *Order Kedaluwarsa*\n─────────────────────────\n` +
            `Order \`${state.order_id}\` (${state.service}) melewati batas waktu.\n\nHubungi admin jika ada pertanyaan.`,
            { reply_markup: kb.mainMenu() }
          );
          log.logOrderExpired(uid, state.order_id, state.service);
        }
      } catch (e) {
        console.error(`[poller] expire ${state.order_id}: ${e.message}`);
      } finally {
        expiring.delete(uid);
      }
    }
  }, 60 * 1000);

  // ── Job 2: Auto-poll deposit KiPay ───────────────────────────────────────────
  // PRINSIP: KiPay adalah satu-satunya sumber kebenaran soal status transaksi.
  // Bot TIDAK MENEBAK status berdasarkan waktu lokal — selalu tanya ke API lewat
  // verifyDeposit() dan percaya jawabannya (pending/paid/expired). Lock supaya
  // gak diproses dobel (mis. barengan sama tombol "Cek Status" manual) sudah
  // ditangani di dalam depositVerify.js sendiri, jadi di sini tinggal panggil.
  setInterval(() => {
    for (const [refNo, info] of pendingDeposit.entries()) {
      verifyDeposit(bot, pgApi, refNo, info, pendingDeposit)
        .catch((e) => console.error(`[poller] verifyDeposit ${refNo}: ${e.message}`));
    }
  }, 10 * 1000);

  // ── Job 3: Verifikasi ulang deposit pending saat restart ─────────────────────
  // Begitu bot nyala, langsung tanya status ASLI tiap deposit pending ke KiPay
  // (bukan menebak dari waktu lokal) — ini juga otomatis "menangkap" deposit
  // yang sudah dibayar SELAMA bot mati (mis. lagi restart/deploy).
  (async () => {
    const saved = db.getPendingDeposits();
    for (const d of saved) {
      const refNo = d.deposit_id || d.ref_no;
      const info  = { userId: d.user_id, amount: d.diterima || d.amount };
      pendingDeposit.set(refNo, info);
      await verifyDeposit(bot, pgApi, refNo, info, pendingDeposit).catch(() => {});
    }
    if (saved.length > 0) console.log(`[poller] ${saved.length} deposit pending diverifikasi ulang ke KiPay.`);
  })();
};
