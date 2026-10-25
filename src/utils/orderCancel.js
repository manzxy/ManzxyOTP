// src/utils/orderCancel.js — pembatalan order Ditznesia yang aman untuk saldo user
'use strict';

const CANCELED = ['canceled', 'cancelled', 'cancel', 'expired'];

/**
 * Batalkan order di Ditznesia dan tentukan APAKAH user boleh di-refund.
 *
 * Prinsip: saldo user hanya dikembalikan kalau Ditznesia memang sudah
 * membatalkan/meng-expire order itu. Kalau pembatalan ditolak (mis. OTP sudah
 * masuk, atau order belum boleh dibatalkan), user TIDAK di-refund — kalau tidak,
 * user bisa dapat OTP gratis sementara bot tetap membayar ke Ditznesia.
 *
 * @param {object} dz       provider Ditznesia
 * @param {string} orderId
 * @returns {Promise<{ ok: boolean, otp?: object, error?: string }>}
 *   ok=true  → aman refund
 *   otp      → ternyata OTP sudah masuk (jangan refund, kirim OTP ke user)
 *   ok=false → batal ditolak, order masih aktif (jangan refund)
 */
module.exports = async function cancelOrderSafe(dz, orderId) {
  try {
    const r = await dz.cancelOrder(orderId);
    if (r.status === 'success') return { ok: false, error: 'Order sudah selesai (OTP sudah masuk).' };
    return { ok: true };
  } catch (e) {
    // Cancel ditolak → tanya status ASLI ke Ditznesia sebagai sumber kebenaran
    try {
      const s = await dz.getOrderStatus(orderId);
      if (s.otp_code) return { ok: false, otp: s };
      if (CANCELED.includes(s.status)) return { ok: true };
      return { ok: false, error: String(e.message || '').replace(/^\[DZ:[^\]]*\]\s*/, '') };
    } catch {
      return { ok: false, error: String(e.message || '').replace(/^\[DZ:[^\]]*\]\s*/, '') };
    }
  }
};

module.exports.CANCELED = CANCELED;
