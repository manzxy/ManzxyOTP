// src/md/db/mddb.js — ManzxyOTP (mode MD)
// Database TERPISAH dari db.js (mode OTP) — file data/md-db.json.
//
// Dua jenis data:
//  - GROUP → setting per grup (prefix, antilink, welcome, warns, rules, members)
//  - USER  → premium & limit harian per ORANG (ngikutin usernya, bukan grupnya)
//
// Skema USER (v1.5):
//   { id, premium, premium_until,
//     limit: { max, used, date } }
//     max  = jatah per hari khusus user ini (null = pakai default free/premium dari config)
//     used = limit terpakai hari ini
//     date = tanggal (zona waktu MD_TIMEZONE) saat `used` dihitung — beda hari → used di-reset 0
//   Logika limit ada di ./limit.js, file ini cuma penyimpanan.
//
// Data di-cache di memori & ditulis ke disk dengan debounce (atomic: tulis file
// sementara lalu rename) — sebelumnya tiap pesan masuk = baca + tulis ulang
// seluruh file JSON. Kalau file rusak, salinannya disimpan (*.corrupt-*.json)
// dan database mulai kosong, BUKAN menimpa file rusaknya.
'use strict';

const fs   = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', '..', '..', 'data', 'md-db.json');

let cache = null;
let dirty = false;
let timer = null;

function _load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (e) {
    if (e.code !== 'ENOENT') {
      const bak = FILE.replace(/\.json$/, `.corrupt-${Date.now()}.json`);
      try { fs.copyFileSync(FILE, bak); console.error(`[mddb] ${path.basename(FILE)} rusak (${e.message}) — disalin ke ${path.basename(bak)}`); } catch { /* abaikan */ }
    }
    cache = {};
  }
  cache.groups ??= {};
  cache.users  ??= {};
  return cache;
}

function flush() {
  clearTimeout(timer);
  timer = null;
  if (!dirty || !cache) return;
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    const tmp = `${FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(cache, null, 2));
    fs.renameSync(tmp, FILE);
    dirty = false;
  } catch (e) {
    console.error(`[mddb] gagal menyimpan: ${e.message}`);
  }
}

function _touch() {
  dirty = true;
  if (!timer) { timer = setTimeout(flush, 300); timer.unref?.(); }
}

process.on('exit', flush); // process.exit() / shutdown normal → data terakhir tetap tertulis

// ── Grup ──────────────────────────────────────────────────────────────────────
/** Ambil (dan buat kalau belum ada) setting sebuah grup. Objek yang dikembalikan LIVE — ubah lalu panggil saveGroup(). */
function getGroup(chatId) {
  const db  = _load();
  const key = String(chatId);
  if (!db.groups[key]) {
    db.groups[key] = {
      id: chatId,
      prefix: '.',
      antilink: false,
      welcome: true,
      warns: {},     // { userId: jumlahWarn }
      members: {},   // { userId: { first_name, username } } — dikenal dari pesan masuk, dipakai tagall
    };
    _touch();
  }
  return db.groups[key];
}

function saveGroup(group) {
  _load().groups[String(group.id)] = group;
  _touch();
}

/** Catat anggota yang kelihatan aktif. Hanya menulis kalau datanya berubah. */
function trackMember(chatId, user) {
  const g    = getGroup(chatId);
  const next = { first_name: user.first_name || '', username: user.username || '' };
  const cur  = g.members[user.id];
  if (cur && cur.first_name === next.first_name && cur.username === next.username) return;
  g.members[user.id] = next;
  _touch();
}

function addWarn(chatId, userId) {
  const g = getGroup(chatId);
  g.warns[userId] = (g.warns[userId] || 0) + 1;
  _touch();
  return g.warns[userId];
}
function resetWarn(chatId, userId) {
  const g = getGroup(chatId);
  delete g.warns[userId];
  _touch();
}

// ── User (premium & limit) ───────────────────────────────────────────────────
/** Ambil (dan buat kalau belum ada) profil MD seorang user. Skema lama (usage per-fitur) otomatis dimigrasi. */
function getUser(userId) {
  const db  = _load();
  const key = String(userId);
  let u = db.users[key];
  if (!u) {
    u = db.users[key] = { id: userId, premium: false, premium_until: null, limit: { max: null, used: 0, date: null } };
    _touch();
    return u;
  }
  if (!u.limit || typeof u.limit !== 'object') {
    u.limit = { max: null, used: 0, date: null };
    delete u.usage; // skema lama { fitur: {count, date} } — tidak dipakai lagi
    _touch();
  }
  return u;
}

function saveUser(user) {
  _load().users[String(user.id)] = user;
  _touch();
}

/** Apakah user lagi premium (otomatis false kalau masa aktifnya lewat). */
function isPremium(user) {
  if (!user.premium) return false;
  if (!user.premium_until) return true; // premium permanen
  return new Date(user.premium_until).getTime() > Date.now();
}

/** Set status premium. `days` = null berarti permanen. Dipanggil dari command owner-only. */
function setPremium(userId, enabled, days = null) {
  const u = getUser(userId);
  u.premium = enabled;
  u.premium_until = enabled && days ? new Date(Date.now() + days * 86400000).toISOString() : null;
  saveUser(u);
  return u;
}

module.exports = {
  getGroup, saveGroup, trackMember, addWarn, resetWarn,
  getUser, saveUser, isPremium, setPremium,
  flush,
};
