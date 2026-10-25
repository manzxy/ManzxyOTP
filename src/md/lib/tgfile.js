// src/md/lib/tgfile.js — ManzxyOTP (mode MD)
// Helper bersama untuk svplugins & svfile: ambil file dari pesan Telegram,
// download ke Buffer, dan bersihkan nama supaya aman dipakai sebagai nama file.
'use strict';

const axios = require('axios');
const { isAdmin } = require('../../utils/helpers');

const TG_DOWNLOAD_MAX = 20 * 1024 * 1024; // batas download bot API Telegram

const MIME_EXT = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif',
  'video/mp4': '.mp4', 'video/webm': '.webm', 'audio/mpeg': '.mp3', 'audio/ogg': '.ogg',
  'application/pdf': '.pdf', 'application/zip': '.zip', 'text/plain': '.txt',
  'application/json': '.json', 'application/javascript': '.js',
};

/** Nama aman: huruf kecil, angka, `_` dan `-` saja (tanpa ekstensi), maks 40 karakter. */
function safeName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\.[a-z0-9]{1,8}$/i, '')
    .replace(/[\s.]+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .slice(0, 40);
}

function safeExt(fileName, mime, fallback = '') {
  const m = String(fileName || '').match(/(\.[a-z0-9]{1,8})$/i);
  if (m) return m[1].toLowerCase();
  return MIME_EXT[mime] || fallback;
}

function pick(o) {
  return { file_id: o.file_id, file_name: o.file_name || '', mime: o.mime_type || '', size: o.file_size || 0 };
}

/**
 * Cari file di pesan ini ATAU pesan yang di-reply (file + caption command
 * di pesan yang sama juga didukung).
 * @returns {{type, file_id, file_name, mime, size, ext, from}|null}
 */
function extractFile(msg) {
  for (const m of [msg, msg.reply_to_message]) {
    if (!m) continue;
    let f = null;
    if (m.document)        f = { type: 'document',   ...pick(m.document) };
    else if (m.photo?.length) {
      const p = m.photo[m.photo.length - 1]; // resolusi terbesar
      f = { type: 'photo', file_id: p.file_id, file_name: '', mime: 'image/jpeg', size: p.file_size || 0 };
    }
    else if (m.video)      f = { type: 'video',      ...pick(m.video) };
    else if (m.animation)  f = { type: 'animation',  ...pick(m.animation) };
    else if (m.audio)      f = { type: 'audio',      ...pick(m.audio) };
    else if (m.voice)      f = { type: 'voice',      ...pick(m.voice) };
    else if (m.video_note) f = { type: 'video_note', ...pick(m.video_note) };
    else if (m.sticker)    f = { type: 'sticker',    ...pick(m.sticker) };
    if (f) {
      const fallback = { photo: '.jpg', video: '.mp4', animation: '.mp4', voice: '.ogg', video_note: '.mp4', sticker: '.webp', audio: '.mp3' }[f.type] || '';
      f.ext  = safeExt(f.file_name, f.mime, fallback);
      f.from = m === msg ? 'self' : 'reply';
      return f;
    }
  }
  return null;
}

/** Download file Telegram → Buffer. */
async function download(bot, fileId, maxBytes = TG_DOWNLOAD_MAX) {
  let link;
  try {
    link = await bot.getFileLink(fileId);
  } catch (e) {
    if (/too big/i.test(e.message)) throw new Error('File terlalu besar (bot Telegram maksimal 20MB).');
    throw e;
  }
  const { data } = await axios.get(link, { responseType: 'arraybuffer', timeout: 60_000, maxContentLength: maxBytes });
  return Buffer.from(data);
}

/** Cuma owner bot (admin_ids di config) — BUKAN admin grup. */
function guardOwner(msg, say) {
  if (isAdmin(msg.from.id)) return true;
  say('⚠️ Command ini cuma buat owner bot.');
  return false;
}

module.exports = { safeName, safeExt, extractFile, download, guardOwner, TG_DOWNLOAD_MAX };
