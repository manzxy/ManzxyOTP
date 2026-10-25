// src/md/services/fileStore.js — ManzxyOTP (mode MD)
// Penyimpanan file bebas lewat chat Telegram (dokumen, foto, video, audio,
// voice, sticker, dll). File disimpan di data/files/, daftar & metadata di
// data/files/index.json. Semua operasi OWNER-ONLY.
'use strict';

const fs   = require('fs');
const path = require('path');
const { safeName, extractFile, download, guardOwner, TG_DOWNLOAD_MAX } = require('../lib/tgfile');
const { fmtSize } = require('../lib/format');

const DIR   = path.join(__dirname, '..', '..', '..', 'data', 'files');
const INDEX = path.join(DIR, 'index.json');

const sayFor = (bot, msg) => (t, extra = {}) =>
  bot.sendMessage(msg.chat.id, t, { reply_to_message_id: msg.message_id, ...extra }).catch(() => {});

function readIndex() {
  try { return JSON.parse(fs.readFileSync(INDEX, 'utf8')); } catch { return {}; }
}
function writeIndex(idx) {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(INDEX, JSON.stringify(idx, null, 2));
}
const diskPath = (entry) => path.join(DIR, entry.file); // entry.file dibuat server dari safeName → aman

const ICON = { document: '📄', photo: '🖼️', video: '🎬', animation: '🎞️', audio: '🎵', voice: '🎤', video_note: '⭕', sticker: '💟' };

/** mode: 'create' (svfile) | 'edit' (editfile) */
async function save(bot, msg, args, ctx, mode) {
  const say = sayFor(bot, msg);
  if (!guardOwner(msg, say)) return;
  const p = ctx.group.prefix;

  try {
    const f = extractFile(msg);

    // editfile <lama> <baru> tanpa file = RENAME
    if (mode === 'edit' && !f && args[1]) return rename(msg, args, say);

    if (!f) return say(`Reply ke file (atau kirim file dengan caption command).\n${p}${mode === 'edit' ? 'editfile' : 'svfile'} <nama>`);
    if (f.size > TG_DOWNLOAD_MAX) return say(`⚠️ File ${fmtSize(f.size)} terlalu besar (bot Telegram maksimal 20MB).`);

    const base = f.file_name ? safeName(f.file_name) : '';
    const name = safeName(args[0]) || base;
    if (!name) return say(`Kasih nama dulu: ${p}${mode === 'edit' ? 'editfile' : 'svfile'} <nama>`);

    const idx    = readIndex();
    const exists = idx[name];
    if (mode === 'create' && exists) return say(`⚠️ File "${name}" sudah ada. Pakai ${p}editfile ${name} untuk menimpa, atau pilih nama lain.`);
    if (mode === 'edit' && !exists) return say(`⚠️ File "${name}" belum ada. Pakai ${p}svfile ${name} untuk menyimpan baru.`);

    const buf  = await download(bot, f.file_id);
    const file = `${name}${f.ext}`;
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(path.join(DIR, file), buf);
    if (exists && exists.file !== file) fs.rmSync(diskPath(exists), { force: true }); // ekstensi berubah → buang file lama

    idx[name] = {
      file, type: f.type, mime: f.mime, original: f.file_name || '',
      size: buf.length, by: msg.from.id, at: new Date().toISOString(),
    };
    writeIndex(idx);
    say(`${mode === 'edit' ? '✅ File diperbarui' : '✅ File disimpan'}: ${name}${f.ext} ${ICON[f.type] || ''} ${fmtSize(buf.length)}\nAmbil lagi: ${p}listfile ${name}`);
  } catch (e) {
    say(`❌ Gagal: ${e.message}`);
  }
}

function rename(msg, args, say) {
  const from = safeName(args[0]);
  const to   = safeName(args[1]);
  if (!from || !to) return say('⚠️ Nama tidak valid.');
  const idx = readIndex();
  if (!idx[from]) return say(`⚠️ File "${from}" tidak ditemukan.`);
  if (idx[to])    return say(`⚠️ Nama "${to}" sudah dipakai.`);

  const ext  = path.extname(idx[from].file);
  const next = `${to}${ext}`;
  fs.renameSync(diskPath(idx[from]), path.join(DIR, next));
  idx[to] = { ...idx[from], file: next };
  delete idx[from];
  writeIndex(idx);
  say(`✅ Nama diganti: ${from} → ${to}`);
}

async function remove(bot, msg, args, ctx) {
  const say = sayFor(bot, msg);
  if (!guardOwner(msg, say)) return;

  const name = safeName(args[0]);
  if (!name) return say(`Pakai: ${ctx.group.prefix}delfile <nama>`);
  const idx = readIndex();
  if (!idx[name]) return say(`⚠️ File "${name}" tidak ditemukan. Cek daftar: ${ctx.group.prefix}listfile`);

  try {
    fs.rmSync(diskPath(idx[name]), { force: true });
    delete idx[name];
    writeIndex(idx);
    say(`🗑️ File "${name}" dihapus.`);
  } catch (e) {
    say(`❌ Gagal hapus: ${e.message}`);
  }
}

/** Tanpa argumen = daftar file. Dengan nama = kirim file-nya. */
async function list(bot, msg, args, ctx) {
  const say = sayFor(bot, msg);
  if (!guardOwner(msg, say)) return;
  const p   = ctx.group.prefix;
  const idx = readIndex();

  const name = safeName(args[0]);
  if (name) {
    const e = idx[name];
    if (!e || !fs.existsSync(diskPath(e))) return say(`⚠️ File "${name}" tidak ditemukan.`);

    const buf  = fs.readFileSync(diskPath(e));
    const opt  = { reply_to_message_id: msg.message_id };
    const meta = { filename: e.original || e.file, contentType: e.mime || 'application/octet-stream' };
    const sender = {
      photo: 'sendPhoto', video: 'sendVideo', animation: 'sendAnimation', audio: 'sendAudio',
      voice: 'sendVoice', video_note: 'sendVideoNote', sticker: 'sendSticker',
    }[e.type] || 'sendDocument';
    try {
      await bot[sender](msg.chat.id, buf, opt, meta);
    } catch {
      await bot.sendDocument(msg.chat.id, buf, opt, meta).catch((err) => say(`❌ ${err.message}`)); // fallback aman
    }
    return;
  }

  const names = Object.keys(idx).sort();
  const total = names.reduce((s, n) => s + (idx[n].size || 0), 0);
  const lines = names.map((n) => `${ICON[idx[n].type] || '📦'} ${n} — ${idx[n].file.slice(n.length) || '-'} ${fmtSize(idx[n].size || 0)}`);
  say(`🗂️ File tersimpan (${names.length}, ${fmtSize(total)})\n─────────────────────────\n${lines.join('\n') || '(kosong)'}\n\n` +
      `${p}listfile <nama> → kirim file-nya\n${p}svfile / ${p}editfile / ${p}delfile`);
}

module.exports = { save, remove, list };
