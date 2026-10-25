// src/utils/mode.js — ManzxyOTP
// Satu bot, dua mode: 'otp' (jualan OTP, default) dan 'md' (utility/grup).
// Mode disimpan di file kecil terpisah (data/mode.json) — SENGAJA bukan di
// db.json atau md-db.json, karena mode adalah setting bot itu sendiri, bukan
// data milik salah satu mode. Switch mode INSTAN, tidak perlu restart bot.
'use strict';

const fs   = require('fs');
const path = require('path');

const FILE  = path.join(__dirname, '..', '..', 'data', 'mode.json');
const MODES = ['otp', 'md'];

function _read() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { return { mode: 'otp' }; }
}
function _write(obj) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(obj, null, 2));
}

const getMode = () => (MODES.includes(_read().mode) ? _read().mode : 'otp');
const setMode = (mode) => {
  if (!MODES.includes(mode)) throw new Error(`Mode tidak dikenal: ${mode}`);
  _write({ mode, updated_at: new Date().toISOString() });
};

/**
 * Bungkus instance bot supaya SEMUA bot.onText(...) dan bot.on(event, ...)
 * yang didaftarkan lewat bot hasil wrap ini otomatis "diam" kalau mode bot
 * sedang bukan `mode`. Command-nya tetap terdaftar seperti biasa — cuma
 * callback-nya nge-cek mode dulu sebelum jalan.
 *
 * Kenapa begini (bukan edit tiap handler satu-satu): supaya kode handler
 * yang sudah ada (menu.js, callback.js, dst) TIDAK PERLU diubah sama sekali.
 * Cukup ganti `bot` jadi `withMode(bot, 'otp')` pas didaftarkan di index.js.
 */
function withMode(bot, mode) {
  return new Proxy(bot, {
    get(target, prop) {
      if (prop === 'onText') {
        return (regex, cb) => target.onText(regex, (msg, match) => {
          if (getMode() === mode) cb(msg, match);
        });
      }
      if (prop === 'on') {
        return (event, cb) => target.on(event, (...args) => {
          if (getMode() === mode) cb(...args);
        });
      }
      const val = target[prop];
      return typeof val === 'function' ? val.bind(target) : val;
    },
  });
}

module.exports = { getMode, setMode, withMode, MODES };
