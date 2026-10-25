// src/utils/serverStats.js — kecepatan OTP NYATA per server Ditznesia
//
// Ditznesia hanya memberi success-rate (rate_sms), bukan kecepatan. Kecepatan
// diukur dari order kita sendiri: selisih waktu beli nomor → OTP terdeteksi oleh
// auto-poller (jeda ukur maks. beberapa detik). Dipakai untuk badge ⚡ Tercepat
// dan peringkat rekomendasi. Disimpan di data/server-stats.json (40 sampel terakhir/server).
'use strict';

const fs   = require('fs');
const path = require('path');

const FILE        = path.join(__dirname, '..', '..', 'data', 'server-stats.json');
const MAX_SAMPLES = 40;
const MIN_SEC = 1, MAX_SEC = 20 * 60;   // buang sampel tidak masuk akal

let data = null;
const load = () => {
  if (data) return data;
  try { data = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { data = {}; }
  if (!data.servers) data.servers = {};
  return data;
};
const save = () => {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE + '.tmp', JSON.stringify(data));
    fs.renameSync(FILE + '.tmp', FILE);
  } catch { /* statistik bersifat pelengkap — jangan ganggu alur order */ }
};

const median = (arr) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

/** Catat satu OTP sukses: durasi (detik) sejak nomor dibeli. */
const record = (server, sec) => {
  sec = Math.round(Number(sec));
  if (!(sec >= MIN_SEC && sec <= MAX_SEC)) return;
  const d = load();
  const key = String(server);
  (d.servers[key] ||= []).push(sec);
  if (d.servers[key].length > MAX_SAMPLES) d.servers[key].shift();
  save();
};

/** Median detik OTP masuk untuk satu server — null kalau sampel < minN. */
const medianSec = (server, minN = 3) => {
  const list = load().servers[String(server)] || [];
  return list.length >= minN ? median(list) : null;
};

/** Median gabungan semua server — dipakai untuk klaim "rata-rata OTP masuk ±N detik". */
const overallMedianSec = (minN = 5) => {
  const all = Object.values(load().servers).flat();
  return all.length >= minN ? median(all) : null;
};

module.exports = { record, medianSec, overallMedianSec };
