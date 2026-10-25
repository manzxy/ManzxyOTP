// src/md/core/logger.js — ManzxyOTP (mode MD)
// Log aktivitas command MD — HANYA ke console. Sengaja tidak mengirim apa pun
// ke channel/grup Telegram: kirim pesan otomatis tiap command = risiko
// kena spam-limit dan akun bot di-banned.
'use strict';

const clock = () => new Date().toTimeString().slice(0, 8);
const COLOR = { dim: '\x1b[2m', cyan: '\x1b[36m', magenta: '\x1b[35m', warn: '\x1b[33m', reset: '\x1b[0m' };

/** Dipanggil tiap kali ada command MD yang berhasil dijalankan. */
function logCommand(msg, plugin) {
  const chatLabel = msg.chat.title || `pm:${msg.chat.id}`;
  const who = msg.from.first_name || msg.from.username || msg.from.id;
  console.log(`${COLOR.dim}[${clock()}]${COLOR.reset} ${COLOR.magenta}[MD]${COLOR.reset} ${who} → ${COLOR.cyan}${plugin.name}${COLOR.reset} @ ${chatLabel}`);
}

/** Log error saat plugin MD gagal jalan. */
function logError(msg, plugin, err) {
  const who = msg?.from?.first_name || msg?.from?.username || msg?.from?.id || '?';
  console.error(`${COLOR.warn}[${clock()}] [MD ERROR]${COLOR.reset} ${plugin?.name || '?'} (${who}): ${err.message}`);
}

module.exports = { logCommand, logError };
