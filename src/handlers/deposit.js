// src/handlers/deposit.js — ManzxyOTP
'use strict';

const kb  = require('../utils/keyboard');
const { checkMembership, sendJoinPrompt }    = require('../utils/joincheck');
const { isMaintenanceActive, maintenanceInfo } = require('../utils/maintenance');
const helpers = require('../utils/helpers');
const msg = require('../utils/messages');

const S = (bot, cid, text, extra = {}) =>
  bot.sendMessage(cid, text, { parse_mode: 'Markdown', ...extra });

module.exports = (bot, pendingDeposit) => {
  bot.onText(/\/deposit/, async (m) => {
    if (!helpers.isAdmin(m.from.id) && isMaintenanceActive()) return S(bot, m.chat.id, msg.maintenanceMsg(maintenanceInfo()));
    const { passed, notJoined } = await checkMembership(bot, m.from.id);
    if (!passed) return sendJoinPrompt(bot, m.chat.id, notJoined);

    S(bot, m.chat.id,
      `💳 *Isi Saldo — ManzxyOTP*\n` +
      `─────────────────────────\n` +
      `Pilih nominal deposit via QRIS.\n\n` +
      `Saldo masuk otomatis setelah pembayaran dikonfirmasi.`,
      { reply_markup: kb.depositAmountMenu() }
    );
  });
};
