// src/md/services/tiktok.js — ManzxyOTP (mode MD)
// Logika downloader TikTok (dipakai plugins-md/downloader/tiktok.js):
//   .tiktok <link>  → limit dipotong → ambil info (scrapers/ttdl.js) → kirim video
//                     / album foto lengkap dengan deskripsi, statistik, musik →
//                     tombol "🎵 Download MP3" (user pilih sendiri mau atau tidak).
//   Tombol MP3 dikirim lewat callback_data "mdp:tt:mp3:<token>"; data video
//   ditahan sementara di memori (SESSION_TTL) karena callback_data maks 64 byte.
'use strict';

const crypto = require('crypto');
const limitDb = require('../db/limit');
const { getTiktokInfo, downloadFile } = require('../scrapers/ttdl');
const { esc, escAttr, cut, fmtNum, fmtSize, fmtDuration, visibleLength } = require('../lib/format');

const CALLBACK_PREFIX = 'tt';
const LIMIT_COST      = 1;                 // biaya satu kali download video/foto (dibaca plugin: limit)
const COST_MP3        = 0;                 // biaya tombol MP3 — 0 = gratis (link ini sudah dibayar). Ubah ke 1 kalau mau ditarik juga.
const SESSION_TTL     = 30 * 60 * 1000;    // tombol MP3 aktif 30 menit
const CAPTION_MAX     = 1024;              // batas caption media Telegram
const TEXT_CHUNK      = 3500;              // batas aman per pesan teks (limit Telegram 4096)
const TT_RE           = /(?:https?:\/\/)?(?:[\w-]+\.)?tiktok\.com\/\S+/i;

const sessions = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, s] of sessions) if (s.expires < now) sessions.delete(k);
}, 5 * 60 * 1000).unref();

// ── Statistik: label dikenali dari nama field apa pun yang dikirim API ───────────
const STAT_KINDS = [
  { icon: '▶️', re: /^(play|plays|view|views|play_?count|view_?count)$/i },
  { icon: '❤️', re: /^(digg|like|likes|heart|hearts|digg_?count|like_?count)$/i },
  { icon: '💬', re: /^(comment|comments|comment_?count)$/i },
  { icon: '↗️', re: /^(share|shares|share_?count|forward_?count)$/i },
  { icon: '🔖', re: /^(collect|collects|save|saves|favorite|favorites|collect_?count|favorite_?count)$/i },
  { icon: '⬇️', re: /^(download|downloads|download_?count)$/i },
  { icon: '🔁', re: /^(repost|reposts|repost_?count)$/i },
];

function formatStats(stats) {
  const known = new Map();   // icon → nilai (pertama menang)
  const extra = [];
  for (const [key, raw] of Object.entries(stats || {})) {
    if (raw === null || raw === '' || typeof raw === 'object') continue;
    const n = Number(raw);
    if (!Number.isFinite(n)) continue;
    const kind = STAT_KINDS.find((k) => k.re.test(key));
    if (kind) { if (!known.has(kind.icon)) known.set(kind.icon, n); }
    else extra.push(`${esc(key.replace(/_?count$/i, '').replace(/[_-]+/g, ' '))} ${fmtNum(n)}`);
  }
  const order = STAT_KINDS.map((k) => k.icon).filter((i) => known.has(i));
  return [...order.map((i) => `${i} ${fmtNum(known.get(i))}`), ...extra].join(' • ');
}

// ── Caption ──────────────────────────────────────────────────────────────────
function describe(info, url, st) {
  const isPhoto = info.photos.length > 0 && !info.video?.nowm;
  const name    = cut(info.nickname || info.username || 'TikTok', 60);
  const lines   = [isPhoto ? '🖼️ <b>TikTok Slideshow</b>' : '🎬 <b>TikTok Video</b>'];

  lines.push(`👤 <b>${esc(name)}</b>` + (info.nickname && info.username ? ` (@${esc(info.username)})` : ''));
  if (info.id) lines.push(`🆔 <code>${esc(info.id)}</code>`);

  const meta = [];
  if (isPhoto) meta.push(`🖼️ ${info.photos.length} foto`);
  else {
    const dur = fmtDuration(info.video?.duration);
    if (dur) meta.push(`⏱️ ${dur}`);
    if (Number(info.video?.size) > 0) meta.push(`📦 ${fmtSize(info.video.size)}`);
  }
  if (meta.length) lines.push(meta.join(' • '));

  const stats = formatStats(info.stats);
  if (stats) lines.push(stats);

  if (info.music) {
    const m = [info.music.title, info.music.author].filter(Boolean).map((x) => cut(x, 70)).join(' — ');
    if (m) lines.push(`🎶 ${esc(m)}`);
  }
  lines.push(`🔗 <a href="${escAttr(url)}">Buka di TikTok</a>`);

  const footer = `🎟️ Sisa limit: ${limitDb.formatLeft(st)} • reset ${st.resetAt}`;
  return { isPhoto, head: lines.join('\n'), footer };
}

/** Susun caption <= 1024 karakter. Deskripsi yang kepotong dikirim utuh di pesan terpisah. */
function buildCaption(parts, desc) {
  const { head, footer } = parts;
  desc = String(desc || '').trim();
  if (!desc) return { caption: `${head}\n\n${footer}`, truncated: false };

  const label  = '📝 <b>Deskripsi:</b>\n';
  const fixed  = visibleLength(`${head}\n\n${label}\n\n${footer}`);
  const budget = CAPTION_MAX - fixed - 4;
  if (desc.length <= budget) return { caption: `${head}\n\n${label}${esc(desc)}\n\n${footer}`, truncated: false };
  if (budget < 40) return { caption: `${head}\n\n${footer}`, truncated: true };
  return { caption: `${head}\n\n${label}${esc(cut(desc, budget))}\n\n${footer}`, truncated: true };
}

const chunks = (s, n) => { const out = []; for (let i = 0; i < s.length; i += n) out.push(s.slice(i, i + n)); return out; };
const mp3Keyboard = (token) => ({ inline_keyboard: [[{ text: '🎵 Download MP3', callback_data: `mdp:${CALLBACK_PREFIX}:mp3:${token}` }]] });

// ── Command: .tiktok <link> ──────────────────────────────────────────────────
async function run(bot, msg, args, ctx) {
  const chatId = msg.chat.id;
  const say    = (t, extra = {}) => bot.sendMessage(chatId, t, { reply_to_message_id: msg.message_id, ...extra }).catch(() => {});

  const found = `${args.join(' ')} ${msg.reply_to_message?.text || msg.reply_to_message?.caption || ''}`.match(TT_RE);
  const url   = found && found[0].replace(/[)\].,!?]+$/, '');
  if (!url) {
    return say(`Pakai: ${ctx.group.prefix}tiktok <link tiktok>\n(boleh juga reply ke pesan yang berisi link TikTok)\n\nBiaya: ${LIMIT_COST} limit per download.`);
  }

  if (!ctx.limit.take()) return; // pesan "limit habis" sudah dikirim oleh take()

  const wait = await bot.sendMessage(chatId, '⏳ Memproses...', { reply_to_message_id: msg.message_id }).catch(() => null);
  try {
    const info  = await getTiktokInfo(url);
    const parts = describe(info, url, ctx.limit.status());
    const { caption, truncated } = buildCaption(parts, info.desc);
    const slug  = `${info.username || 'tiktok'}-${info.id || Date.now()}`;
    const token = info.music ? crypto.randomBytes(5).toString('hex') : null;
    const base  = { parse_mode: 'HTML', reply_to_message_id: msg.message_id };

    let anchor;   // pesan yang jadi tempat tombol MP3 menempel
    if (parts.isPhoto) {
      await bot.sendChatAction(chatId, 'upload_photo').catch(() => {});
      const bufs = [];
      for (const p of info.photos) bufs.push(await downloadFile(p.download));
      for (let i = 0; i < bufs.length; i += 10) {
        const album = bufs.slice(i, i + 10).map((b, j) => ({
          type: 'photo', media: b,
          fileOptions: { filename: `${slug}-${i + j + 1}.jpg`, contentType: 'image/jpeg' },
          ...(i === 0 && j === 0 ? { caption, parse_mode: 'HTML' } : {}),
        }));
        await bot.sendMediaGroup(chatId, album, { reply_to_message_id: msg.message_id });
      }
    } else if (info.video?.nowm || info.video?.wm) {
      await bot.sendChatAction(chatId, 'upload_video').catch(() => {});
      let buf;
      try { buf = await downloadFile(info.video.nowm); }
      catch (e) { if (!info.video.wm) throw e; buf = await downloadFile(info.video.wm); } // cadangan: versi watermark
      anchor = await bot.sendVideo(chatId, buf, {
        ...base, caption, supports_streaming: true, ...(token ? { reply_markup: mp3Keyboard(token) } : {}),
      }, { filename: `${slug}.mp4`, contentType: 'video/mp4' });
    } else {
      throw new Error('Konten tidak punya video/foto yang bisa diunduh.');
    }

    // Deskripsi utuh (kalau caption tidak muat) + tombol MP3 untuk slideshow (album tidak bisa pakai tombol)
    const texts = truncated ? chunks(String(info.desc).trim(), TEXT_CHUNK) : [];
    const needBtn = parts.isPhoto && token;
    for (let i = 0; i < texts.length; i++) {
      const last = i === texts.length - 1;
      const m = await bot.sendMessage(chatId, `${i === 0 ? '📝 <b>Deskripsi lengkap:</b>\n' : ''}${esc(texts[i])}`, {
        ...base, ...(needBtn && last ? { reply_markup: mp3Keyboard(token) } : {}),
      }).catch(() => null);
      if (needBtn && last) anchor = m;
    }
    if (needBtn && !texts.length) {
      anchor = await bot.sendMessage(chatId, '🎵 Mau sekalian download audionya?', { ...base, reply_markup: mp3Keyboard(token) }).catch(() => null);
    }

    if (token && anchor) {
      sessions.set(token, {
        userId: msg.from.id, chatId, messageId: anchor.message_id, music: info.music,
        username: info.username, id: info.id, expires: Date.now() + SESSION_TTL, busy: false,
      });
    }
  } catch (e) {
    ctx.limit.refund(); // gagal → limit dikembalikan
    await say(`❌ Gagal download: ${e.message}\n(limit kamu dikembalikan)`);
  } finally {
    if (wait) bot.deleteMessage(chatId, wait.message_id).catch(() => {});
  }
}

// ── Tombol: 🎵 Download MP3 ──────────────────────────────────────────────────
async function onCallback(bot, q, parts, ctx) {
  const answer = (text, alert = false) => bot.answerCallbackQuery(q.id, { text, show_alert: alert }).catch(() => {});
  const [action, token] = parts;
  if (action !== 'mp3') return answer('Tombol tidak dikenal.', true);

  const s = sessions.get(token);
  if (!s || s.expires < Date.now()) return answer('⌛ Tombol sudah kedaluwarsa — kirim ulang link TikTok-nya.', true);
  if (q.from.id !== s.userId)       return answer('⚠️ Tombol ini cuma untuk yang request download.', true);
  if (s.busy)                       return answer('⏳ Audio lagi diproses...');

  s.busy = true;
  let charged = false;
  try {
    if (COST_MP3 > 0) {
      const r = limitDb.take(q.from.id, COST_MP3);
      if (!r.ok) return answer(`🚫 Limit tidak cukup (butuh ${COST_MP3}). ${limitDb.exhaustedText(r, COST_MP3).split('\n')[1] || ''}`.slice(0, 190), true);
      charged = true;
    }
    await answer('🎵 Mengirim audio...');
    await bot.sendChatAction(s.chatId, 'upload_voice').catch(() => {});

    const buf  = await downloadFile(s.music.download);
    const title = cut(s.music.title || 'TikTok audio', 64);
    await bot.sendAudio(s.chatId, buf, {
      title, performer: cut(s.music.author || s.username || '', 64),
      caption: `🎵 <b>${esc(title)}</b>${s.music.author ? `\n👤 ${esc(s.music.author)}` : ''}\n<i>dari video @${esc(s.username || '-')}</i>`,
      parse_mode: 'HTML', reply_to_message_id: s.messageId,
    }, { filename: `${s.username || 'tiktok'}-${s.id || 'audio'}.mp3`, contentType: 'audio/mpeg' });

    bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: s.chatId, message_id: s.messageId }).catch(() => {});
    sessions.delete(token);
  } catch (e) {
    if (charged) limitDb.refund(q.from.id, COST_MP3);
    bot.sendMessage(s.chatId, `❌ Gagal download audio: ${e.message}`, { reply_to_message_id: s.messageId }).catch(() => {});
  } finally {
    s.busy = false;
  }
}

module.exports = { run, onCallback, CALLBACK_PREFIX, LIMIT_COST, formatStats, buildCaption, _sessions: sessions };
