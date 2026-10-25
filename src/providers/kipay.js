// src/providers/kipay.js — ManzxyOTP
// KiPay QRIS Payment Gateway
// Dokumentasi resmi: https://kipay.id/docs/api
'use strict';

const axios = require('axios');
const cfg   = require('../../config');

const BASE = 'https://api.kipay.id/api/pay';

const fail = (e) => {
  // KiPay selalu balas { "error": "pesan" } untuk 4xx (lihat docs/api/errors)
  const msg = e?.response?.data?.error || e?.message || 'KiPay error';
  throw new Error(msg);
};

/**
 * Buat transaksi QRIS baru.
 * KiPay otomatis menambahkan "kode unik" (unique_code) ke nominal yang diminta
 * supaya setiap transaksi punya nominal berbeda untuk pencocokan pembayaran,
 * lalu memotong fee QRIS dari total tersebut.
 *
 *   requested_amount   → nominal yang diminta (mis. nominal deposit user)
 *   amount             → total yang WAJIB dibayar persis (requested + unique_code)
 *   fee_amount         → potongan biaya QRIS dari KiPay
 *   net_amount         → sisa setelah fee (amount - fee_amount)
 *
 * @param {number} amount  Nominal yang diminta (sebelum kode unik ditambahkan)
 * @param {string} [note]  Catatan/referensi internal (mis. "uid:12345")
 * @returns {{ trx_id, mode, requested_amount, unique_code, amount, fee_amount, net_amount, status, provider, note, qr_payload, matched_at, created_at, expires_at }}
 */
async function createTransaction(amount, note = '') {
  try {
    const { data } = await axios.post(
      `${BASE}/${cfg.kipay.api_key}/transactions`,
      { amount: Math.round(amount), note: note || undefined },
      { headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, timeout: 15000 }
    );
    return data;
  } catch (e) { fail(e); }
}

/**
 * Ambil status transaksi terbaru berdasarkan trx_id.
 * status: 'pending' | 'paid' | 'expired'
 * @param {string} trxId
 * @returns {{ trx_id, mode, amount, fee_amount, net_amount, status, provider, matched_at }}
 */
async function getTransaction(trxId) {
  try {
    const { data } = await axios.get(
      `${BASE}/${cfg.kipay.api_key}/transactions/${trxId}`,
      { headers: { Accept: 'application/json' }, timeout: 10000 }
    );
    return data;
  } catch (e) { fail(e); }
}

/**
 * URL gambar QR PNG (500×500) langsung dari KiPay — dipakai sebagai fallback
 * kalau generate QR lokal dari qr_payload gagal.
 * @param {string} trxId
 */
function qrPngUrl(trxId) {
  return `${BASE}/${cfg.kipay.api_key}/transactions/${trxId}/qr.png`;
}

// CATATAN: KiPay (versi API publik saat ini) belum menyediakan endpoint
// cek saldo/pencairan maupun endpoint pembatalan transaksi. Cek saldo &
// riwayat pencairan dilakukan lewat Dashboard KiPay (https://kipay.id/login).
// Signature webhook juga belum dipublikasikan — jangan percaya payload webhook
// mentah-mentah, selalu verifikasi ulang lewat getTransaction() (dipakai poller.js).

module.exports = { createTransaction, getTransaction, qrPngUrl };
