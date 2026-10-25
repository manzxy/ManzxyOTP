// src/md/core/callbacks.js — ManzxyOTP (mode MD)
// Router tombol inline mode MD. Hanya aktif kalau mode bot = 'md'.
//
// Router ini TIDAK punya menu/fitur sendiri. Semua tombol milik plugin:
//   mdp:<callbackPrefix>:<...>  → plugin.onCallback(bot, q, parts, ctx)
// (menu utama = plugins-md/umum/menu.js, tombol MP3 = plugins-md/downloader/tiktok.js, dst)
'use strict';

const mddb  = require('../db/mddb');
const mdlog = require('./logger');
const { createContext } = require('./context');
const { getMode } = require('../../utils/mode');

module.exports = (bot, plugins) => {
  bot.on('callback_query', async (q) => {
    if (getMode() !== 'md') return;
    if (!q.data || !q.message || !q.data.startsWith('mdp:')) return;

    const chatId = q.message.chat.id;
    const group  = mddb.getGroup(chatId);

    const [prefix, ...parts] = q.data.slice(4).split(':');
    const plugin = [...new Set(plugins.values())].find((p) => p.callbackPrefix === prefix && typeof p.onCallback === 'function');
    if (!plugin) return bot.answerCallbackQuery(q.id, { text: 'Tombol ini sudah tidak aktif.', show_alert: true }).catch(() => {});

    const ctx = createContext({ bot, chatId, from: q.from, replyTo: q.message.message_id, group, plugins, plugin });
    try {
      await plugin.onCallback(bot, q, parts, ctx);
    } catch (e) {
      mdlog.logError({ from: q.from, chat: q.message.chat }, plugin, e);
      bot.answerCallbackQuery(q.id, { text: `❌ ${e.message}`.slice(0, 190), show_alert: true }).catch(() => {});
    }
    return bot.answerCallbackQuery(q.id).catch(() => {}); // pengaman: pastikan loading di tombol berhenti
  });
};
