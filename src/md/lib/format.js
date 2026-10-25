// src/md/lib/format.js — ManzxyOTP (mode MD)
// Helper format teks kecil yang dipakai bareng oleh service & plugin MD.
'use strict';

const esc     = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s) => esc(s).replace(/"/g, '&quot;');

/** Potong teks maksimal n karakter (tambah …), tanpa memotong surrogate pair emoji. */
function cut(s, n) {
  s = String(s ?? '');
  if (s.length <= n) return s;
  let out = s.slice(0, Math.max(0, n - 1));
  if (/[\uD800-\uDBFF]$/.test(out)) out = out.slice(0, -1);
  return out + '…';
}

const fmtNum = (n) => Number(n).toLocaleString('id-ID');

function fmtSize(n) {
  n = Number(n) || 0;
  return n >= 1048576 ? `${(n / 1048576).toFixed(1)}MB` : n >= 1024 ? `${(n / 1024).toFixed(1)}KB` : `${n}B`;
}

/** Durasi video → "m:ss" / "h:mm:ss". Nilai > 3600 dianggap milidetik (API scraper tidak mendokumentasikan satuannya). */
function fmtDuration(v) {
  let s = Number(v);
  if (!Number.isFinite(s) || s <= 0) return null;
  if (s > 3600) s = s / 1000;
  s = Math.round(s);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const pad = (x) => String(x).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** 11_520_000 ms → "3 jam 12 menit" */
function fmtDelay(ms) {
  const min = Math.max(1, Math.ceil(ms / 60000));
  const h = Math.floor(min / 60), m = min % 60;
  return h ? (m ? `${h} jam ${m} menit` : `${h} jam`) : `${m} menit`;
}

/** Panjang teks yang terlihat di Telegram (tag HTML dibuang, entity dihitung 1 karakter). */
const visibleLength = (html) => String(html).replace(/<[^>]+>/g, '').replace(/&(?:amp|lt|gt|quot);/g, 'x').length;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = { esc, escAttr, cut, fmtNum, fmtSize, fmtDuration, fmtDelay, visibleLength, sleep };
