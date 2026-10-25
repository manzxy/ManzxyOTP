// src/handlers/setmode.js — ManzxyOTP
// Command GLOBAL (tidak di-gate oleh mode manapun) — ini cara satu-satunya
// owner bisa pindah mode, jadi harus selalu aktif apapun mode saat ini.
'use strict';

const { getMode, setMode, MODES } = require('../utils/mode');
const { isAdmin } = require('../utils/helpers');

const LABEL = { otp: '🔐 OTP (jualan OTP)', md: '🧩 MD (utility/grup)' };

module.exports = (bot) => {
  bot.onText(/\/setmode(?:\s+(\w+))?/, (m, match) => {
    if (!isAdmin(m.from.id)) return;

    const target = (match[1] || '').toLowerCase();
    if (!MODES.includes(target)) {
      return bot.sendMessage(m.chat.id,
        `⚙️ *Mode Bot*\n─────────────────────────\n` +
        `Mode aktif sekarang: *${LABEL[getMode()]}*\n\n` +
        `Ganti mode dengan:\n` +
        `\`/setmode otp\` — mode jualan OTP\n` +
        `\`/setmode md\` — mode utility/grup (plugin)\n\n` +
        `_Switch instan, tidak perlu restart bot._`,
        { parse_mode: 'Markdown' });
    }

    const before = getMode();
    setMode(target);
    bot.sendMessage(m.chat.id,
      before === target
        ? `ℹ️ Mode bot memang sudah *${LABEL[target]}*.`
        : `✅ Mode bot diganti: *${LABEL[before]}* → *${LABEL[target]}*\n\n` +
          `Semua command langsung ikut mode baru — gak perlu restart.`,
      { parse_mode: 'Markdown' });
  });
};
