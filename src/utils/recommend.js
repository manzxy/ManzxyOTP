// src/utils/recommend.js — REKOMENDASI SERVER terbaik untuk satu aplikasi
//
// Untuk aplikasi tertentu (mis. WhatsApp) di negara default (Indonesia), cek SEMUA
// server Ditznesia secara paralel lalu pilih:
//   🏆 Rekomendasi — skor gabungan: success-rate (rate_sms 24 jam, Ditznesia) + bonus kecepatan
//                    (data OTP asli bot) − penalti kalau harganya jauh di atas yang termurah.
//                    Jadi bukan sekadar yang paling mahal/paling tinggi rate-nya.
//   ⚡ Tercepat    — median OTP masuk terkecil (hanya muncul kalau datanya sudah cukup)
//   💰 Termurah    — harga terendah di antara server yang success-rate-nya masih layak
// Server dengan stok 0 atau success-rate < MIN_RATE dibuang (kecuali tidak ada pilihan lain).
// Hasil di-cache 3 menit & dihangatkan berkala oleh poller → tombol aplikasi terasa instan.
'use strict';

const dz    = require('../providers/ditznesia');
const stats = require('./serverStats');
const cfg   = require('../../config');
const { applyMarkup, calcPrice } = require('./helpers');

const MIN_RATE       = 60;
const OPT_TTL        = 3 * 60 * 1000;
const STALE_OK       = 30 * 60 * 1000;   // peek() boleh pakai cache selama ini
const COUNTRY_TTL    = 30 * 60 * 1000;
const SERVER_TIMEOUT = 9000;

const APPS = {
  whatsapp:  ['💬', 'WhatsApp'],  telegram: ['✈️', 'Telegram'], instagram: ['📸', 'Instagram'],
  facebook:  ['👤', 'Facebook'],  tiktok:   ['🎵', 'TikTok'],   twitter:   ['🐦', 'Twitter/X'],
  google:    ['🔎', 'Google'],    shopee:   ['🛒', 'Shopee'],   gojek:     ['🏍️', 'Gojek'],
  discord:   ['🎮', 'Discord'],   line:     ['🟢', 'LINE'],     tokopedia: ['🛍️', 'Tokopedia'],
};
const appMeta = (key) => {
  const [icon, name] = APPS[key] || ['📱', key.charAt(0).toUpperCase() + key.slice(1)];
  return { key, icon, name };
};
/** Aplikasi populer yang ditampilkan di tombol "Beli OTP" (env QUICK_SERVICES). */
const quickApps = () => cfg.quick.services.map(appMeta);

const withTimeout = (p, ms) => Promise.race([
  p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
]);

// ── Negara default per server (mis. "Indonesia" → kode "6" di server 1, "id" di server 4) ──
const countryCache = new Map();
async function resolveCountry(server) {
  const hit = countryCache.get(server);
  if (hit && Date.now() - hit.at < COUNTRY_TTL) return hit.country;
  const list = await dz.getCountries(server);
  const want = cfg.quick.country.toLowerCase();
  const country = list.find((c) => c.name.toLowerCase().includes(want)) || null;
  countryCache.set(server, { at: Date.now(), country });
  return country;
}

async function candidatesFor(server, query) {
  const country = await resolveCountry(server);
  if (!country) return [];
  const q    = query.toLowerCase();
  const rows = (await dz.getServices(server, country.code, query))
    // Jaga-jaga kalau filter service di API longgar: hanya baris yang memang layanan ini
    .filter((s) => s.service_name.toLowerCase().includes(q) || s.id.toLowerCase() === q || s.produk.toLowerCase() === q);
  const sec = stats.medianSec(server);
  return rows.map((svc) => ({ server: String(server), country, svc, rate: svc.rate_sms, sec }));
}

const UNKNOWN_RATE = 65;   // rate belum ada (order <5 dalam 24 jam) → anggap sedikit di bawah rata-rata, bukan nol
const sameCand = (a, b) => a.server === b.server && a.svc.produk === b.svc.produk && a.svc.provider === b.svc.provider;

/**
 * Skor 🏆 (lebih tinggi = lebih baik):
 *   rate            0–100, dari Ditznesia (null → UNKNOWN_RATE)
 *   + bonus cepat   +8 (≤1 dtk) … 0 (25 dtk) … −6 (≥43 dtk); 0 kalau datanya belum ada
 *   − penalti harga 10 poin per 100% di atas harga termurah (maks 25) — 2× lebih mahal = −10
 */
const score = (c, minPrice) => {
  const rate  = c.rate == null ? UNKNOWN_RATE : c.rate;
  const speed = c.sec == null ? 0 : Math.max(-6, Math.min(8, (25 - c.sec) / 3));
  const price = Math.min(25, (c.svc.price / minPrice - 1) * 10);
  return rate + speed - price;
};

function rank(cands) {
  if (!cands.length) return [];
  const ok   = cands.filter((c) => c.rate == null || c.rate >= MIN_RATE);
  const pool = ok.length ? ok : cands;
  const minPrice = Math.min(...pool.map((c) => c.svc.price));

  const best  = [...pool].sort((a, b) => score(b, minPrice) - score(a, minPrice) || a.svc.price - b.svc.price)[0];
  const fast  = [...pool].filter((c) => c.sec != null).sort((a, b) => a.sec - b.sec || score(b, minPrice) - score(a, minPrice))[0];
  const cheap = [...pool].sort((a, b) => a.svc.price - b.svc.price || score(b, minPrice) - score(a, minPrice))[0];

  const out = [];
  for (const [label, c] of [['best', best], ['fast', fast], ['cheap', cheap]]) {
    if (!c) continue;
    const dup = out.find((o) => sameCand(o, c));
    if (dup) dup.labels.push(label); else out.push({ ...c, labels: [label] });
  }
  return out;
}

const optCache = new Map();   // query → { at, data }

/**
 * @returns {Promise<{ query, options: Array<{ labels, server, country, svc, rate, sec }>, at }>}
 * options kosong = tidak ada stok di server manapun.
 */
async function findOptions(query, { force = false } = {}) {
  const hit = optCache.get(query);
  if (!force && hit && Date.now() - hit.at < OPT_TTL) return hit.data;

  const servers = dz.getServers();
  const settled = await Promise.allSettled(servers.map((s) => withTimeout(candidatesFor(s.id, query), SERVER_TIMEOUT)));
  const cands   = settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  // Semua server error (bukan sekadar stok kosong) → lempar supaya user diberi tahu, bukan "stok habis"
  if (!cands.length && settled.every((r) => r.status === 'rejected'))
    throw new Error(settled[0].reason?.message || 'Gagal menghubungi server');

  const data = { query, options: rank(cands), at: Date.now() };
  optCache.set(query, { at: Date.now(), data });
  return data;
}

/** Hasil cache terakhir (tanpa memanggil API) — untuk teks sambutan. null kalau belum ada. */
function peek(query) {
  const hit = optCache.get(query);
  return hit && Date.now() - hit.at < STALE_OK ? hit.data : null;
}

/** Hangatkan cache semua aplikasi populer (dipanggil poller berkala). */
async function warm() {
  for (const app of quickApps()) {
    try { await findOptions(app.key, { force: true }); } catch { /* server lagi bermasalah — lewati */ }
  }
}

/** Petunjuk untuk daftar server manual: server rekomendasi + median detik tiap server. */
function serverHints() {
  const first = quickApps()[0];
  const top   = first && peek(first.key)?.options?.[0];
  const sec   = {};
  for (const s of dz.getServers()) sec[s.id] = stats.medianSec(s.id);
  return { best: top ? top.server : null, sec };
}

/** Harga untuk user ini (admin = modal, user = markup − diskon level). */
const priceFor = (svc, userId) => calcPrice(svc.price, applyMarkup(svc.price), userId);

/**
 * Bahan teks sambutan: rekomendasi terbaik aplikasi populer pertama (dari cache — tanpa API).
 * null kalau cache belum hangat → sambutan tampil tanpa blok rekomendasi.
 */
function promo(userId) {
  const app = quickApps()[0];
  const hit = app && peek(app.key);
  const opt = hit?.options?.[0];
  return opt ? { app, opt, price: priceFor(opt.svc, userId) } : null;
}

module.exports = { appMeta, quickApps, findOptions, peek, warm, serverHints, priceFor, promo };
