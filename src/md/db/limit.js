// src/md/db/limit.js — ManzxyOTP (mode MD)
// Sistem limit harian per USER.
//
//  - Tiap user punya jatah per hari: default FREE / PREMIUM (config.js, bisa
//    diubah lewat .env) atau angka khusus dari owner (.setlimit).
//  - Tiap fitur memotong sekian limit (mis. .tiktok = 1) — dipotong saat
//    take(), dikembalikan lewat refund() kalau fiturnya gagal.
//  - Reset otomatis tiap jam 00:00 di zona waktu MD_TIMEZONE (default
//    Asia/Jakarta = WIB). Tanpa cron/timer: tanggal dicek tiap akses, jadi
//    tetap benar walau bot sempat mati/restart di tengah malam.
//  - Owner bot (ADMIN_IDS) tidak kena limit.
'use strict';

const cfg  = require('../../../config');
const mddb = require('./mddb');
const { fmtDelay } = require('../lib/format');

const TZ       = cfg.md_timezone;
const TZ_LABEL = { 'Asia/Jakarta': 'WIB', 'Asia/Makassar': 'WITA', 'Asia/Jayapura': 'WIT' }[TZ] || TZ;
const RESET_AT = `00:00 ${TZ_LABEL}`;

const _dayFmt   = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const _clockFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });

let _now = () => Date.now();                     // diganti saat testing
const _setClock = (fn) => { _now = fn || (() => Date.now()); };

const today = () => _dayFmt.format(new Date(_now()));  // 'YYYY-MM-DD' di zona waktu MD
function msUntilReset() {
  const [h, m, s] = _clockFmt.format(new Date(_now())).split(':').map(Number);
  return 86400000 - ((h * 60 + m) * 60 + s) * 1000;
}

const isOwner = (id) => cfg.admin_ids.includes(Number(id));

/** Ambil data limit user & reset otomatis kalau sudah ganti hari. */
function _fresh(user) {
  const d = today();
  if (user.limit.date !== d) {
    user.limit.date = d;
    user.limit.used = 0;
    mddb.saveUser(user);
  }
  return user;
}

/**
 * @returns {{ unlimited, premium, max, used, left, custom, resetInMs, resetAt }}
 */
function status(userId) {
  const u         = _fresh(mddb.getUser(userId));
  const unlimited = isOwner(userId);
  const premium   = mddb.isPremium(u);
  const custom    = u.limit.max != null;
  const max       = custom ? u.limit.max : (premium ? cfg.md_limit_premium : cfg.md_limit_free);
  const used      = u.limit.used;
  return {
    unlimited, premium, custom, max, used,
    left: unlimited ? Infinity : Math.max(0, max - used),
    resetInMs: msUntilReset(),
    resetAt: RESET_AT,
  };
}

/**
 * Cek + potong dalam SATU langkah sinkron — aman dari race (user spam command
 * berkali-kali sekaligus tidak bisa "menembus" sisa limit).
 * @returns {{ ok: boolean } & ReturnType<typeof status>}
 */
function take(userId, cost = 1) {
  const st = status(userId);
  if (cost <= 0 || st.unlimited) return { ok: true, ...st };
  if (st.left < cost) return { ok: false, ...st };

  const u = mddb.getUser(userId);
  u.limit.used += cost;
  mddb.saveUser(u);
  return { ok: true, ...status(userId) };
}

/** Kembalikan limit yang sudah terpotong (fitur gagal). Tidak pernah membuat used < 0. */
function refund(userId, cost = 1) {
  if (cost <= 0 || isOwner(userId)) return;
  const u = _fresh(mddb.getUser(userId));
  u.limit.used = Math.max(0, u.limit.used - cost);
  mddb.saveUser(u);
}

/** Set jatah harian khusus user ini. null = balik ke default free/premium. */
function setMax(userId, max) {
  const u = mddb.getUser(userId);
  u.limit.max = max == null ? null : Math.max(0, Math.floor(max));
  mddb.saveUser(u);
  return status(userId);
}

// ── Teks siap pakai ──────────────────────────────────────────────────────────
const tier = (st) => (st.unlimited ? 'OWNER' : st.premium ? 'PREMIUM' : 'FREE');
const formatLeft = (st) => (st.unlimited ? 'Unlimited' : `${st.left}/${st.max}`);
const formatReset = (st) => `${st.resetAt} (${fmtDelay(st.resetInMs)} lagi)`;

/** Pesan saat limit tidak cukup. Tanpa karakter Markdown, aman dikirim dengan parse mode apapun. */
function exhaustedText(st, cost) {
  const head = st.left > 0
    ? `🚫 Limit kamu tidak cukup — fitur ini butuh ${cost} limit, sisa kamu ${st.left}/${st.max}.`
    : `🚫 Limit harian kamu habis (0/${st.max}).`;
  return `${head}\n⏰ Reset otomatis jam ${formatReset(st)}.\n💎 Mau limit lebih banyak? Hubungi owner bot untuk upgrade Premium.`;
}

module.exports = {
  status, take, refund, setMax, isOwner,
  tier, formatLeft, formatReset, exhaustedText,
  today, msUntilReset, RESET_AT, _setClock,
};
