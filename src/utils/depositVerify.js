// src/utils/depositVerify.js — ManzxyOTP
// Logika TUNGGAL untuk verifikasi & penyelesaian satu deposit KiPay.
// Dipakai bareng oleh src/jobs/poller.js (auto-poll tiap 10 detik) dan
// src/handlers/callback.js (tombol "Cek Status" manual) — supaya
// perilakunya SELALU konsisten. Sebelumnya logic ini digandakan di dua
// tempat terpisah dan sempat beda-beda, itu salah satu sumber bug deposit
// (mis. status "expired" muncul padahal harusnya sukses).
'use strict';

const db  = require('./db');
const msg = require('./messages');
const kb  = require('./keyboard');
const log = require('./logger');

// Lock di level modul — SATU-SATUNYA titik kunci, dipakai otomatis oleh
// SEMUA pemanggil (poller.js auto-poll maupun tombol "Cek Status" manual di
// callback.js) karena sama-sama require modul ini. Ini yang mencegah race
// condition: poller lagi cek refNo yang sama persis saat user pencet tombol
// cek manual di detik yang sama → tanpa lock ini saldo bisa ke-credit dobel.
const _locks = new Set();

/**
 * Tanya status transaksi ke KiPay & selesaikan kalau sudah final
 * (credit saldo untuk 'paid', tandai 'expired' kalau lewat batas waktu).
 *
 * Aman dari double-credit lewat dua lapis:
 * 1. Lock per refNo (di atas) — dua pemanggilan barengan untuk refNo yang
 *    sama, yang kedua langsung di-skip (return 'pending'), tidak ikut proses.
 * 2. Cek status di database sebelum credit — kalau record sudah final
 *    (success/expired) dari pemrosesan sebelumnya, tidak diproses ulang.
 *
 * @returns {'paid'|'expired'|'pending'} status akhir yang didapat dari KiPay
 */
async function verifyDeposit(bot, pgApi, refNo, info, pendingDeposit) {
  if (_locks.has(refNo)) return 'pending'; // sedang diproses pemanggil lain, skip
  _locks.add(refNo);

  try {
    const existing = db.findUserDepositById(info.userId, refNo);
    if (existing && existing.status !== 'pending') {
      // Sudah final sebelumnya (success/expired) — jangan diproses ulang.
      pendingDeposit.delete(refNo);
      return existing.status === 'success' ? 'paid' : 'expired';
    }

    const res = await pgApi.getTransaction(refNo);

    if (res.status === 'paid') {
      const netAmount = res.net_amount != null ? res.net_amount : info.amount;
      const balance   = db.addBalance(info.userId, netAmount, `deposit KiPay ${refNo}`);
      db.updateDeposit(info.userId, refNo, { status: 'success', issuer: res.provider || '' });
      pendingDeposit.delete(refNo);

      const rec = db.findUserDepositById(info.userId, refNo);
      if (rec?.qr_message_id) bot.deleteMessage(info.userId, rec.qr_message_id).catch(() => {});

      bot.sendMessage(info.userId, msg.depositSuccess(refNo, netAmount, balance, res.provider, ''),
        { parse_mode: 'Markdown', reply_markup: kb.mainMenu() }).catch(() => {});
      log.logDepositSuccess(db.getUser(info.userId), refNo, netAmount, balance, res.provider, '');
      return 'paid';
    }

    if (res.status === 'expired') {
      db.updateDeposit(info.userId, refNo, { status: 'expired' });
      pendingDeposit.delete(refNo);

      const rec = db.findUserDepositById(info.userId, refNo);
      if (rec?.qr_message_id) bot.deleteMessage(info.userId, rec.qr_message_id).catch(() => {});

      bot.sendMessage(info.userId,
        `✖ *Deposit Kedaluwarsa*\n─────────────────────────\n` +
        `Ref \`${refNo}\` sudah lewat batas waktu bayar dari KiPay.\n\n` +
        `⚠️ Nominal harus dibayar PERSIS termasuk kode unik di 3 digit terakhir — kalau tidak pas, pembayaran tidak akan cocok otomatis.\n\n` +
        `Buat deposit baru untuk melanjutkan.`,
        { parse_mode: 'Markdown', reply_markup: kb.depositAmountMenu() }
      ).catch(() => {});
      return 'expired';
    }

    return 'pending'; // belum ada perubahan, tetap dipantau
  } finally {
    _locks.delete(refNo);
  }
}

module.exports = { verifyDeposit };
