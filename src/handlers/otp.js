// src/handlers/otp.js — ManzxyOTP
'use strict';

const db  = require('../utils/db');
const api = require('../providers/ditznesia');
const cancelOrderSafe = require('../utils/orderCancel');
const msg = require('../utils/messages');
const kb  = require('../utils/keyboard');
const log = require('../utils/logger');
const { isMaintenanceActive, maintenanceInfo } = require('../utils/maintenance');
const helpers = require('../utils/helpers');
const { checkMembership, sendJoinPrompt }    = require('../utils/joincheck');

const S = (bot, cid, text, extra = {}) =>
  bot.sendMessage(cid, text, { parse_mode: 'Markdown', ...extra });

module.exports = (bot, pending) => {

  bot.onText(/\/status/, async (m) => {
    if (!helpers.isAdmin(m.from.id) && isMaintenanceActive()) return S(bot, m.chat.id, msg.maintenanceMsg(maintenanceInfo()));
    const { passed, notJoined } = await checkMembership(bot, m.from.id);
    if (!passed) return sendJoinPrompt(bot, m.chat.id, notJoined);

    const state = pending.get(m.from.id);
    if (!state)
      return S(bot, m.chat.id,
        `❌ Tidak ada order aktif saat ini.\n\nGunakan *Layanan OTP* dari /menu untuk order baru.`,
        { reply_markup: kb.mainMenu() }
      );

    try {
      const res = await api.getOrderStatus(state.order_id);
      if (!pending.has(m.from.id)) return;   // auto-poller sudah mengirim OTP lebih dulu
      if (res.otp_code) {
        pending.delete(m.from.id);
        const phone = res.phone_number || state.phone_number;
        db.updateOrder(m.from.id, state.order_id, { status: 'completed', otp_code: res.otp_code, otp_msg: res.otp_msg });
        S(bot, m.chat.id, msg.otpReceived(state.order_id, phone, res.otp_code, res.otp_msg), { reply_markup: kb.mainMenu() });
        const user = db.getUser(m.from.id);
        log.logOTPReceived(user, state.order_id, phone, res.otp_code);
      } else if (cancelOrderSafe.CANCELED.includes(res.status)) {
        // Dibatalkan / kedaluwarsa di sisi Ditznesia tanpa OTP → refund user
        pending.delete(m.from.id);
        const balance = db.refundBalance(m.from.id, state.price || 0, `refund ${res.status} ${state.order_id}`);
        db.updateOrder(m.from.id, state.order_id, { status: 'canceled' });
        S(bot, m.chat.id, msg.orderCancelled(state.order_id, state.price || 0, balance), { reply_markup: kb.mainMenu() });
        log.logOrderCancelled(db.getUser(m.from.id), state.order_id, state.price || 0, balance);
      } else {
        S(bot, m.chat.id, msg.otpPending(state), { reply_markup: kb.orderActiveMenu(state.order_id) });
      }
    } catch (e) {
      S(bot, m.chat.id, `❌ Gagal cek status: ${e.message.replace(/^\[DZ:[^\]]*\]\s*/, '')}`);
    }
  });

  bot.onText(/\/cancel/, async (m) => {
    if (!helpers.isAdmin(m.from.id) && isMaintenanceActive()) return S(bot, m.chat.id, msg.maintenanceMsg(maintenanceInfo()));
    const { passed, notJoined } = await checkMembership(bot, m.from.id);
    if (!passed) return sendJoinPrompt(bot, m.chat.id, notJoined);

    const state = pending.get(m.from.id);
    if (!state)
      return S(bot, m.chat.id, `❌ Tidak ada order aktif saat ini.`, { reply_markup: kb.mainMenu() });

    try {
      // Refund HANYA kalau Ditznesia benar-benar sudah membatalkan order
      const r = await cancelOrderSafe(api, state.order_id);

      if (r.otp) { // OTP ternyata sudah masuk
        pending.delete(m.from.id);
        const phone = r.otp.phone_number || state.phone_number;
        db.updateOrder(m.from.id, state.order_id, { status: 'completed', otp_code: r.otp.otp_code, otp_msg: r.otp.otp_msg });
        S(bot, m.chat.id, msg.otpReceived(state.order_id, phone, r.otp.otp_code, r.otp.otp_msg), { reply_markup: kb.mainMenu() });
        log.logOTPReceived(db.getUser(m.from.id), state.order_id, phone, r.otp.otp_code);
        return;
      }
      if (!r.ok)
        return S(bot, m.chat.id, `❌ Order belum bisa dibatalkan${r.error ? `: ${r.error}` : ''}.\n\nCoba lagi sebentar lagi.`);

      const balance = db.refundBalance(m.from.id, state.price || 0, `refund cancel ${state.order_id}`);
      db.updateOrder(m.from.id, state.order_id, { status: 'canceled' });
      pending.delete(m.from.id);
      S(bot, m.chat.id, msg.orderCancelled(state.order_id, state.price || 0, balance), { reply_markup: kb.mainMenu() });
      log.logOrderCancelled(db.getUser(m.from.id), state.order_id, state.price || 0, balance);
    } catch (e) {
      S(bot, m.chat.id, `❌ Gagal batalkan: ${e.message.replace(/^\[DZ:[^\]]*\]\s*/, '')}`);
    }
  });
};
