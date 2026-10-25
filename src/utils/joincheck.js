// src/utils/joincheck.js
'use strict';

const cfg = require('../../config');
const kb  = require('./keyboard');
const msg = require('./messages');

async function checkMembership(bot, userId) {
  if (!cfg.required_channels || !cfg.required_channels.length)
    return { passed: true, notJoined: [] };

  const notJoined = [];
  for (const ch of cfg.required_channels) {
    try {
      const member = await bot.getChatMember(ch.id, userId);
      if (member.status === 'left' || member.status === 'kicked') notJoined.push(ch);
    } catch { notJoined.push(ch); }
  }
  return { passed: notJoined.length === 0, notJoined };
}

async function sendJoinPrompt(bot, chatId, notJoined) {
  const text = msg.joinPrompt(notJoined);
  const opts = {
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
    reply_markup: kb.joinCheckMenu(notJoined),
  };

  if (cfg.join_prompt_photo) {
    try {
      await bot.sendPhoto(chatId, cfg.join_prompt_photo, { caption: text, ...opts });
      return;
    } catch {}
  }
  await bot.sendMessage(chatId, text, opts);
}

module.exports = { checkMembership, sendJoinPrompt };
