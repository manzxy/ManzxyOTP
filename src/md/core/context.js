// src/md/core/context.js — ManzxyOTP (mode MD)
// Pembuat `ctx` yang diberikan ke plugin (command DAN tombol inline).
//
//   ctx.reply(text, extra)   balas ke chat (Markdown, reply ke pesan pemicu)
//   ctx.group                setting grup ini
//   ctx.plugins              Map semua plugin yang termuat
//   ctx.db                   database MD (getGroup/saveGroup/getUser/isPremium/...)
//   ctx.isOwner(id)          owner bot (ADMIN_IDS)? — BUKAN admin grup
//   ctx.isGroupAdmin(id)     admin/creator grup tempat pesan ini? (async → boolean)
//   ctx.limit                limit harian user pemanggil, biaya = plugin.limit:
//     .cost                    biaya per pemakaian
//     .take()                  cek + potong; kalau kurang, otomatis balas pesan "limit habis" & return false
//     .refund()                kembalikan limit (fitur gagal)
//     .status()                { max, used, left, unlimited, premium, ... }
'use strict';

const mddb    = require('../db/mddb');
const limitDb = require('../db/limit');

function createContext({ bot, chatId, from, replyTo, group, plugins, plugin }) {
  const reply = (text, extra = {}) => bot.sendMessage(chatId, text, {
    parse_mode: 'Markdown',
    ...(replyTo ? { reply_to_message_id: replyTo } : {}),
    ...extra,
  }).catch(() => {});

  const cost = Number(plugin?.limit) || 0;
  const limit = {
    cost,
    status: () => limitDb.status(from.id),
    take(c = cost) {
      const r = limitDb.take(from.id, c);
      if (!r.ok) reply(limitDb.exhaustedText(r, c));
      return r.ok;
    },
    refund: (c = cost) => limitDb.refund(from.id, c),
  };

  const isGroupAdmin = async (userId) => {
    try {
      const m = await bot.getChatMember(chatId, userId);
      return ['administrator', 'creator'].includes(m.status);
    } catch { return false; }
  };

  return { reply, group, plugins, db: mddb, limit, isOwner: limitDb.isOwner, isGroupAdmin };
}

module.exports = { createContext };
