// src/md/services/pluginStore.js — ManzxyOTP (mode MD)
// Simpan / edit / hapus / lihat plugin MD langsung dari chat Telegram.
// Semua operasi OWNER-ONLY (admin_ids) — plugin = kode yang dijalankan server.
//
// Plugin disimpan per KATEGORI: plugins-md/<kategori>/<nama>.js
//   .svplugins <kategori>/<nama>   → kategori eksplisit (folder dibuat kalau belum ada)
//   .svplugins <nama>              → kategori dari properti `category` di kodenya, kalau tidak ada: "umum"
// Perubahan di folder otomatis di-hot-reload. Plugin yang gagal dimuat setelah
// disimpan di-rollback (file baru dihapus / file lama dikembalikan), jadi
// kiriman yang salah tidak merusak plugin yang sudah jalan.
// Backup file lama (edit & hapus): data/backups/plugins/.
'use strict';

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');
const loader = require('../core/pluginLoader');
const { safeName, download, guardOwner } = require('../lib/tgfile');
const { fmtSize, sleep } = require('../lib/format');

const DIR       = loader.DIR;
const ROOT      = path.join(__dirname, '..', '..', '..');
const BACKUP    = path.join(ROOT, 'data', 'backups', 'plugins');
const MAX_BYTES = 1024 * 1024; // plugin >1MB hampir pasti salah file

// Plugin inti — boleh di-edit (ada backup) tapi TIDAK boleh dihapus lewat chat.
const PROTECTED = new Set([
  'menu', 'premium',
  'svplugins', 'editplugins', 'delplugins', 'listplugins',
  'svfile', 'editfile', 'delfile', 'listfile',
]);

const sayFor = (bot, msg) => (t, extra = {}) =>
  bot.sendMessage(msg.chat.id, t, { reply_to_message_id: msg.message_id, ...extra }).catch(() => {});

const fileOf = (file) => path.join(DIR, file);

/** "downloader/tiktok" atau "tiktok" → { cat, name } (sudah dibersihkan, aman dari path traversal). */
function parseTarget(arg) {
  const [a, b] = String(arg || '').split('/');
  return b === undefined ? { cat: null, name: safeName(a) } : { cat: safeName(a), name: safeName(b) };
}

/** Cari file plugin di disk lewat nama (opsional dibatasi kategori). */
function findFiles(name, cat = null) {
  return loader.walk().filter((f) => {
    const [c, n] = f.includes('/') ? f.split('/') : [null, f];
    return n === `${name}.js` && (!cat || c === cat);
  });
}

/** Cek sintaks (tanpa menjalankan kodenya) + kewajiban minimal format plugin. */
function validate(code, name) {
  try {
    new vm.Script(`(function (exports, require, module, __filename, __dirname) {${code}\n})`, { filename: `${name}.js` });
  } catch (e) {
    const esm = /Cannot use import|Unexpected token 'export'|Unexpected token 'import'/.test(e.message);
    return `Syntax error: ${e.message}` + (esm ? '\n(Plugin MD harus CommonJS: pakai module.exports & require, bukan import/export.)' : '');
  }
  if (!/module\.exports|\bexports\./.test(code)) return 'Tidak ada module.exports — format plugin salah.';
  if (!/\bname\s*:/.test(code) || !/\brun\s*(\(|:)/.test(code)) return 'Plugin wajib punya properti name dan fungsi run().';
  return null;
}

/** Ambil target + kode dari pesan: reply/kirim file .js, atau reply pesan teks berisi kode. */
async function readInput(bot, msg, args) {
  const src = msg.reply_to_message;
  const doc = msg.document || src?.document;
  let code, guess = '';

  if (doc) {
    if (!/\.(js|cjs)$/i.test(doc.file_name || '')) return { error: 'File harus berekstensi .js' };
    if ((doc.file_size || 0) > MAX_BYTES) return { error: `File terlalu besar (${fmtSize(doc.file_size)}), maks ${fmtSize(MAX_BYTES)}.` };
    code  = (await download(bot, doc.file_id, MAX_BYTES)).toString('utf8');
    guess = safeName(doc.file_name);
  } else {
    code = src?.text || src?.caption || '';
    if (!code.trim()) return { error: 'Reply ke file .js atau ke pesan yang berisi kode plugin (atau kirim file .js dengan caption command).' };
    const fence = code.match(/```[a-z]*\n([\s\S]*?)```/i);
    if (fence) code = fence[1];
    guess = safeName(code.match(/\bname\s*:\s*['"`]([^'"`]+)['"`]/)?.[1]);
  }

  code = code.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim() + '\n';
  const target  = parseTarget(args[0]);
  const name    = target.name || guess;
  const codeCat = safeName(code.match(/\bcategory\s*:\s*['"`]([^'"`]+)['"`]/)?.[1]);
  if (!name) return { error: 'Nama plugin tidak terdeteksi — tulis manual, mis. `svplugins downloader/namaplugin`.' };
  if (args[0] && String(args[0]).includes('/') && !target.cat) return { error: 'Nama kategori tidak valid. Contoh: svplugins downloader/namaplugin' };
  return { name, cat: target.cat, codeCat, code };
}

function backup(file) {
  fs.mkdirSync(BACKUP, { recursive: true });
  const dest = path.join(BACKUP, `${file.replace('/', '__').replace(/\.js$/, '')}.${new Date().toISOString().replace(/[:.]/g, '-')}.js`);
  fs.copyFileSync(fileOf(file), dest);
  return dest;
}

/** Tunggu hot-reload chokidar: { plugin } kalau termuat versi baru, { error } kalau gagal. */
async function waitLoaded(file, before) {
  for (let i = 0; i < 10; i++) {
    await sleep(400);
    const p = loader.byFile.get(file);
    if (p && p !== before) return { plugin: p };
    if (loader.errors.has(file)) return { error: loader.errors.get(file) };
  }
  return { error: 'tidak termuat dalam 4 detik (cek log bot)' };
}

/** mode: 'create' (svplugins) | 'edit' (editplugins) */
async function save(bot, msg, args, ctx, mode) {
  const say = sayFor(bot, msg);
  if (!guardOwner(msg, say)) return;
  const p = ctx.group.prefix;

  try {
    const input = await readInput(bot, msg, args);
    if (input.error) return say(`⚠️ ${input.error}`);
    const { name, code } = input;

    const bad = validate(code, name);
    if (bad) return say(`❌ Plugin ditolak, TIDAK disimpan:\n${bad}`);

    let file, prevCode = null, before = null;
    if (mode === 'create') {
      const same = findFiles(name);
      if (same.length) return say(`⚠️ Plugin "${name}" sudah ada di ${same[0]}. Pakai ${p}editplugins ${name} untuk menimpa.`);
      const cat = input.cat || input.codeCat || 'umum';
      file = `${cat}/${name}.js`;
    } else {
      const same = findFiles(name, input.cat);
      if (!same.length) return say(`⚠️ Plugin "${name}" belum ada${input.cat ? ` di kategori ${input.cat}` : ''}. Pakai ${p}svplugins ${input.cat ? input.cat + '/' : ''}${name} untuk membuat baru.`);
      file     = same[0];
      prevCode = fs.readFileSync(fileOf(file), 'utf8');
      before   = loader.byFile.get(file);
      backup(file);
    }

    fs.mkdirSync(path.dirname(fileOf(file)), { recursive: true });
    fs.writeFileSync(fileOf(file), code);

    const res = await waitLoaded(file, before);
    if (res.plugin) {
      const pl = res.plugin;
      const al = (pl.aliases || []).length ? ` (alias: ${pl.aliases.join(', ')})` : '';
      return say(`${mode === 'edit' ? '✅ Plugin diperbarui' : '✅ Plugin disimpan'}: ${file} — ${fmtSize(Buffer.byteLength(code))}\nKategori: ${pl.category} • Command aktif: ${p}${pl.name}${al}`);
    }

    // Gagal dimuat → rollback supaya bot tetap sehat
    if (prevCode == null) fs.rmSync(fileOf(file), { force: true });
    else fs.writeFileSync(fileOf(file), prevCode);
    say(`❌ Plugin gagal dimuat, perubahan DIBATALKAN${prevCode == null ? ' (file baru dihapus)' : ' (file lama dikembalikan)'}:\n${res.error}`);
  } catch (e) {
    say(`❌ Gagal: ${e.message}`);
  }
}

async function remove(bot, msg, args, ctx) {
  const say = sayFor(bot, msg);
  if (!guardOwner(msg, say)) return;
  const p = ctx.group.prefix;

  const { cat, name } = parseTarget(args[0]);
  if (!name) return say(`Pakai: ${p}delplugins <nama>   (atau <kategori>/<nama>)`);
  if (PROTECTED.has(name)) return say(`🔒 Plugin "${name}" adalah plugin inti, tidak boleh dihapus lewat chat.`);

  const found = findFiles(name, cat);
  if (!found.length) return say(`⚠️ Plugin "${name}" tidak ditemukan. Cek daftar: ${p}listplugins`);

  try {
    const file = found[0];
    const bak  = backup(file);
    fs.unlinkSync(fileOf(file));
    try { fs.rmdirSync(path.dirname(fileOf(file))); } catch { /* folder masih berisi plugin lain */ }
    await sleep(800);
    say(`🗑️ Plugin ${file} dihapus & command-nya nonaktif.\nBackup: ${path.relative(ROOT, bak)}`);
  } catch (e) {
    say(`❌ Gagal hapus: ${e.message}`);
  }
}

/**
 * .listplugins            → semua plugin, dikelompokkan per kategori
 * .listplugins <kategori> → plugin di kategori itu saja
 * .listplugins <nama>     → kirim file plugin-nya (buat diedit)
 */
async function list(bot, msg, args, ctx) {
  const say = sayFor(bot, msg);
  if (!guardOwner(msg, say)) return;
  const p = ctx.group.prefix;

  const files = loader.walk();
  const cats  = [...new Set(files.map((f) => (f.includes('/') ? f.split('/')[0] : '(root)')))].sort();
  const { cat, name } = parseTarget(args[0]);

  // Argumen tanpa "/" yang cocok dengan nama kategori → daftar kategori itu
  const asCategory = args[0] && !String(args[0]).includes('/') && cats.includes(name);
  if (name && !asCategory) {
    const found = findFiles(name, cat);
    if (!found.length) return say(`⚠️ Plugin atau kategori "${args[0]}" tidak ditemukan.`);
    return bot.sendDocument(msg.chat.id, fs.readFileSync(fileOf(found[0])), {
      reply_to_message_id: msg.message_id,
      caption: `${found[0]} — edit lalu kirim balik dengan ${p}editplugins ${name}`,
    }, { filename: `${name}.js`, contentType: 'application/javascript' }).catch((e) => say(`❌ ${e.message}`));
  }

  const show = asCategory ? [name] : cats;
  const out  = show.map((c) => {
    const inCat = files.filter((f) => (f.includes('/') ? f.split('/')[0] : '(root)') === c);
    const rows  = inCat.map((f) => {
      const base = f.split('/').pop().slice(0, -3);
      const pl   = loader.byFile.get(f);
      const lock = PROTECTED.has(base) ? ' 🔒' : '';
      return pl ? `  • ${base}${lock}${pl.limit ? ` (${pl.limit} limit)` : ''}` : `  • ${base}${lock} ⚠️ ${loader.errors.get(f) || 'tidak termuat'}`;
    });
    return `📂 ${c} (${inCat.length})\n${rows.join('\n')}`;
  });
  say(`🧩 Plugin MD — ${files.length} file, ${cats.length} kategori\n─────────────────────────\n${out.join('\n\n')}\n\n` +
      `${p}listplugins <kategori> • ${p}listplugins <nama> → kirim file-nya\n${p}svplugins <kategori>/<nama> • ${p}editplugins • ${p}delplugins`);
}

module.exports = { save, remove, list, validate, parseTarget, PROTECTED };
