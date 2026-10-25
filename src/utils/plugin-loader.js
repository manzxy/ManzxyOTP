// src/utils/plugin-loader.js
// Auto-load & hot-reload plugins dari folder /plugins
// Setiap file .js di folder plugins diload otomatis
// Jika ada file baru → auto-register ke bot tanpa restart
'use strict';

const fs       = require('fs');
const path     = require('path');
const chokidar = require('chokidar');

const PLUGINS_DIR = path.resolve('./plugins');

// Map nama file → handler yg sudah diload
const loaded = new Map();

function loadPlugin(bot, filePath) {
  try {
    // Hapus cache supaya require ulang fresh
    delete require.cache[require.resolve(filePath)];
    const plugin = require(filePath);
    if (typeof plugin === 'function') {
      plugin(bot);
      loaded.set(filePath, true);
      console.log(`[plugin] Loaded: ${path.basename(filePath)}`);
    }
  } catch (e) {
    console.error(`[plugin] Error loading ${path.basename(filePath)}: ${e.message}`);
  }
}

function initPlugins(bot) {
  // Buat folder plugins jika belum ada
  if (!fs.existsSync(PLUGINS_DIR)) {
    fs.mkdirSync(PLUGINS_DIR, { recursive: true });
    console.log('[plugin] Folder /plugins dibuat.');
  }

  // Load semua plugin yang sudah ada
  const files = fs.readdirSync(PLUGINS_DIR).filter(f => f.endsWith('.js'));
  for (const file of files) {
    loadPlugin(bot, path.join(PLUGINS_DIR, file));
  }

  // Watch folder plugins — auto-reload jika ada file baru/berubah
  const watcher = chokidar.watch(PLUGINS_DIR, {
    persistent:       true,
    ignoreInitial:    true,  // abaikan file yang sudah ada saat init
    awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
  });

  watcher
    .on('add', (filePath) => {
      if (!filePath.endsWith('.js')) return;
      console.log(`[plugin] File baru terdeteksi: ${path.basename(filePath)}`);
      loadPlugin(bot, filePath);
    })
    .on('change', (filePath) => {
      if (!filePath.endsWith('.js')) return;
      console.log(`[plugin] File berubah, reload: ${path.basename(filePath)}`);
      loadPlugin(bot, filePath);
    })
    .on('unlink', (filePath) => {
      if (!filePath.endsWith('.js')) return;
      loaded.delete(filePath);
      console.log(`[plugin] File dihapus: ${path.basename(filePath)}`);
    });

  console.log(`[plugin] Watching /plugins — ${files.length} plugin dimuat, auto-reload aktif.`);
}

module.exports = { initPlugins };
