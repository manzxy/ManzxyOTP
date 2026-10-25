// src/md/core/dispatcher.js — ManzxyOTP (mode MD)
// Satu pintu masuk untuk semua command plugin MD + hook pasif plugin
// (onMessage untuk pesan biasa, onNewMember untuk member baru). Dispatcher
// sendiri TIDAK punya fitur — semua fitur ada di plugins-md/. Hanya aktif kalau mode
// bot sedang 'md' (dicek tiap pesan masuk — bukan di-skip permanen — supaya
// gak perlu restart bot pas owner switch mode).
'use strict';

const mddb  = require('../db/mddb');
const mdlog = require('./logger');
const { createContext } = require('./context');
const { getMode } = require('../../utils/mode');

// Plugin unik (satu plugin bisa terdaftar dengan banyak alias di Map)
const uniq = (plugins) => [...new Set(plugins.values())];

function isGroupChat(chat) {
  return chat.type === 'group' || chat.type === 'supergroup';
}

async function isGroupAdmin(bot, chatId, userId) {
  try {
    const member = await bot.getChatMember(chatId, userId);
    return ['administrator', 'creator'].includes(member.status);
  } catch {
    return false;
  }
}

module.exports = (bot, plugins) => {

  // ── Command router ───────────────────────────────────────────────────────
  bot.on('message', async (msg) => {
    if (getMode() !== 'md') return;
    // caption ikut dibaca: kirim file + caption ".svfile nama" langsung jalan
    const text = msg.text ?? msg.caption;
    if (!text || !msg.from) return;

    const chatId = msg.chat.id;
    const group  = mddb.getGroup(chatId);
    if (isGroupChat(msg.chat)) mddb.trackMember(chatId, msg.from);

    const prefixes = [group.prefix || '.', '/'];
    const usedPrefix = prefixes.find((p) => text.startsWith(p));

    // Bukan command → jalankan hook pasif milik plugin (mis. antilink.onMessage).
    // Hook yang return true = pesan sudah ditangani, hook berikutnya dilewati.
    if (!usedPrefix) {
      for (const p of uniq(plugins)) {
        if (typeof p.onMessage !== 'function') continue;
        const ctx = createContext({ bot, chatId, from: msg.from, replyTo: null, group, plugins, plugin: p });
        try {
          if (await p.onMessage(bot, msg, ctx)) break;
        } catch (e) { mdlog.logError(msg, p, e); }
      }
      return;
    }

    const body = text.slice(usedPrefix.length).trim();
    if (!body) return;
    const [cmdRaw, ...args] = body.split(/\s+/);
    const plugin = plugins.get(cmdRaw.toLowerCase());
    if (!plugin) return;

    const ctx = createContext({
      bot, chatId, from: msg.from, replyTo: msg.message_id, group, plugins, plugin,
    });

    if (plugin.groupOnly && !isGroupChat(msg.chat)) {
      return ctx.reply('⚠️ Command ini cuma bisa dipakai di grup.');
    }
    if (plugin.adminOnly && !(await isGroupAdmin(bot, chatId, msg.from.id))) {
      return ctx.reply('⚠️ Command ini cuma buat admin grup.');
    }

    try {
      await plugin.run(bot, msg, args, ctx);
      mdlog.logCommand(msg, plugin);
    } catch (e) {
      mdlog.logError(msg, plugin, e);
      ctx.reply(`❌ Error: ${e.message}`);
    }
  });

  // ── Member baru → hook plugin (mis. welcome.onNewMember) ──────────────────
  bot.on('new_chat_members', async (msg) => {
    if (getMode() !== 'md') return;
    const group = mddb.getGroup(msg.chat.id);
    for (const p of uniq(plugins)) {
      if (typeof p.onNewMember !== 'function') continue;
      const ctx = createContext({ bot, chatId: msg.chat.id, from: msg.from, replyTo: null, group, plugins, plugin: p });
      try { await p.onNewMember(bot, msg, ctx); } catch (e) { mdlog.logError(msg, p, e); }
    }
  });
};
