// src/md/core/pluginLoader.js — ManzxyOTP (mode MD)
// Loader plugin KHUSUS mode MD — terpisah dari src/utils/plugin-loader.js (mode OTP).
// Hot-reload lewat chokidar.
//
// STRUKTUR: plugins-md/<kategori>/<nama>.js
//   Nama subfolder = KATEGORI plugin (admin, downloader, setting, umum, ...).
//   Folder adalah sumber kebenaran: properti `category` di dalam file diabaikan.
//   File di root plugins-md/ tetap dimuat (kategori dari properti category, atau "lain").
//   File/folder berawalan "_" atau "." dilewati (buat helper bersama antar plugin).
//
// Format satu file plugin (detail: plugins-md/README.md):
//   module.exports = {
//     name: 'kick', aliases: ['tendang'], description: '...',
//     groupOnly: true, adminOnly: true,
//     limit: 1,                                  // opsional: biaya limit harian per pemakaian
//     callbackPrefix: 'xx', onCallback(bot, q, parts, ctx) {},   // opsional: tombol inline milik plugin
//     onMessage(bot, msg, ctx) {},               // opsional: hook pasif tiap pesan BUKAN command (return true = selesai)
//     onNewMember(bot, msg, ctx) {},             // opsional: hook saat ada member baru masuk grup
//     status(group) { return 'ON'; },            // opsional: teks status di samping command pada menu
//     ownerOnly: true,                           // opsional: disembunyikan dari menu non-owner
//     async run(bot, msg, args, ctx) { ... }
//   };
'use strict';

const fs       = require('fs');
const path     = require('path');
const chokidar = require('chokidar');

const DIR = path.join(__dirname, '..', '..', '..', 'plugins-md');

// command (nama + alias, huruf kecil) → objek plugin. Dipakai dispatcher.
const plugins = new Map();
// "kategori/nama.js" → objek plugin yang sedang aktif dari file itu.
const byFile  = new Map();
// "kategori/nama.js" → alasan terakhir kenapa file itu gagal dimuat.
const errors  = new Map();

const rel = (full) => path.relative(DIR, full).split(path.sep).join('/');
const isPluginFile = (r) => r.endsWith('.js') && !r.split('/').some((p) => p.startsWith('_') || p.startsWith('.'));

/** Semua file plugin (path relatif, mis. "downloader/tiktok.js") yang ada di disk. */
function walk(dir = DIR) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { if (!e.name.startsWith('_') && !e.name.startsWith('.')) out.push(...walk(full)); }
    else if (isPluginFile(rel(full))) out.push(rel(full));
  }
  return out.sort();
}

function _fail(file, reason) {
  errors.set(file, reason);
  console.warn(`[plugin-md] ${file}: ${reason}`);
  return null;
}

function _loadFile(file) {
  const full = path.join(DIR, file);
  try {
    delete require.cache[require.resolve(full)];
    const plugin = require(full);
    if (!plugin?.name || typeof plugin.run !== 'function') {
      return _fail(file, 'format salah — wajib punya name dan fungsi run()');
    }
    const folder = file.includes('/') ? file.split('/')[0] : null;
    try {
      plugin.category = folder || plugin.category || 'lain';
      plugin.__file   = file;
    } catch { /* objek frozen — abaikan */ }
    return plugin;
  } catch (e) {
    return _fail(file, e.message);
  }
}

function _unregisterByFile(file) {
  const old = byFile.get(file);
  if (!old) return;
  for (const [key, p] of plugins.entries()) if (p === old) plugins.delete(key);
  byFile.delete(file);
}

/** Daftarkan plugin. Gagal (false) kalau nama/alias bentrok dengan plugin dari file lain. */
function _register(plugin, file) {
  const keys = [plugin.name, ...(plugin.aliases || [])].map((k) => String(k).toLowerCase());
  for (const k of keys) {
    const other = plugins.get(k);
    if (other && other.__file !== file) {
      _fail(file, `command "${k}" bentrok dengan ${other.__file}`);
      return false;
    }
  }
  _unregisterByFile(file); // lepas versi lama HANYA setelah versi baru valid
  keys.forEach((k) => plugins.set(k, plugin));
  byFile.set(file, plugin);
  errors.delete(file);
  return true;
}

function initMdPlugins() {
  fs.mkdirSync(DIR, { recursive: true });

  for (const f of walk()) {
    const p = _loadFile(f);
    if (p) _register(p, f);
  }

  chokidar.watch(DIR, { ignoreInitial: true }).on('all', (event, filePath) => {
    const file = rel(filePath);
    if (!isPluginFile(file)) return;

    if (event === 'add' || event === 'change') {
      const p = _loadFile(file);
      if (p && _register(p, file)) console.log(`[plugin-md] dimuat: ${p.category}/${p.name}`);
    } else if (event === 'unlink') {
      _unregisterByFile(file);
      errors.delete(file);
      console.log(`[plugin-md] dilepas: ${file}`);
    }
  });

  const unique = new Set(plugins.values());
  const cats   = new Set([...unique].map((p) => p.category));
  console.log(`[plugin-md] ${unique.size} plugin dimuat dari /plugins-md (${cats.size} kategori)`);
  if (errors.size) console.warn(`[plugin-md] ${errors.size} file gagal dimuat — lihat peringatan di atas`);
  return plugins;
}

module.exports = { initMdPlugins, plugins, byFile, errors, walk, DIR };
