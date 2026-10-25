# 🧩 Folder Plugins MD — ManzxyOTP (mode MD)

Letakkan file `.js` di sini untuk menambah command baru ke **mode MD**
(utility/grup) — tanpa restart bot (hot-reload via chokidar).

Ini **terpisah total** dari folder `/plugins` (itu untuk mode OTP, format
berbeda). Plugin MD hanya aktif saat bot sedang `/setmode md`.

## Struktur: satu subfolder = satu kategori

```text
plugins-md/
├── admin/        kick promote demote mute unmute warn resetwarn lock unlock pin unpin tagall setname
├── downloader/   tiktok
├── file/         svfile editfile delfile listfile            (owner)
├── owner/        premium setlimit                            (owner)
├── plugin/       svplugins editplugins delplugins listplugins (owner)
├── setting/      antilink welcome setprefix
└── umum/         menu id rules groupinfo limit
```

- **Nama folder = kategori.** Tidak perlu (dan tidak dipakai) properti `category` di dalam file.
- Satu file = satu fitur, nama file = nama command (`downloader/tiktok.js` → `.tiktok`).
- Kategori baru? Cukup bikin folder baru — langsung terdeteksi, dan muncul di menu *Semua Command*.
- Nama command dan alias harus unik di SEMUA kategori. Kalau bentrok, file yang baru ditolak (ada peringatan di console).
- File/folder berawalan `_` atau `.` dilewati — taruh helper bersama di sana (mis. `_shared/util.js`).
- Logika berat jangan ditaruh di plugin: taruh di `src/md/services/`, plugin cukup jadi pintu masuk tipis.

## Format Plugin

```js
// plugins-md/umum/ping.js
module.exports = {
  name: 'ping',                    // wajib — nama command, dipanggil via <prefix>ping
  aliases: ['p'],                  // opsional — nama lain
  description: 'Tes respon bot',   // opsional — tampil di menu
  groupOnly: false,                // opsional — true = cuma di grup
  adminOnly: false,                // opsional — true = cuma admin GRUP
  limit: 0,                        // opsional — biaya limit harian per pemakaian (lihat bawah)

  async run(bot, msg, args, ctx) {
    // bot  — instance node-telegram-bot-api asli
    // msg  — pesan Telegram pemicu
    // args — kata setelah nama command (string[])
    // ctx  — helper (lihat tabel)
    ctx.reply('🏓 Pong!');
  },
};
```

| `ctx` | Isi |
|---|---|
| `ctx.reply(text, extra)` | Balas ke chat (Markdown, otomatis reply ke pesan user) |
| `ctx.group` | Setting grup (prefix, antilink, welcome, warns, members, rules) |
| `ctx.db` | Database MD: `getGroup/saveGroup/getUser/isPremium/setPremium/addWarn/...` |
| `ctx.isOwner(id)` | Owner bot (ADMIN_IDS)? — bukan admin grup |
| `ctx.isGroupAdmin(id)` | Admin/creator grup tempat pesan ini? (async → boolean) |
| `ctx.limit` | Limit harian user pemanggil (lihat bawah) |
| `ctx.plugins` | Map semua plugin yang termuat |

Pakai `ctx.db` (bukan `require('../../src/md/db/mddb')`) supaya plugin tidak rusak kalau
kamu memindahkannya antar kategori.

## Limit Harian (per USER, bukan per grup)

- Tiap user punya **jatah per hari**: default **10** (free) / **20** (premium), diatur di `.env`
  (`MD_LIMIT_FREE`, `MD_LIMIT_PREMIUM`) atau khusus per user oleh owner lewat `.setlimit`.
- Tiap fitur **memotong limit** sesuai biayanya. Contoh: `.tiktok` = 1 limit.
- **Reset otomatis tiap jam 00:00** (zona waktu `MD_TIMEZONE`, default `Asia/Jakarta` = WIB).
- Owner bot tidak kena limit.

Cara pakai di plugin — cukup tulis `limit: <biaya>` lalu panggil `take()` **setelah argumen valid**:

```js
module.exports = {
  name: 'fitur', limit: 2,               // fitur ini butuh 2 limit
  async run(bot, msg, args, ctx) {
    if (!args[0]) return ctx.reply('Pakai: fitur <sesuatu>');   // salah pakai → JANGAN potong limit

    if (!ctx.limit.take()) return;       // cek + potong sekaligus; kalau kurang, pesan "limit habis" dikirim otomatis
    try {
      // ...proses fitur...
    } catch (e) {
      ctx.limit.refund();                // gagal → kembalikan limit
      return ctx.reply(`❌ ${e.message}`);
    }
  },
};
```

`ctx.limit.status()` → `{ max, used, left, unlimited, premium, resetAt, resetInMs }`.
`take()` bersifat atomik, jadi user yang spam command berkali-kali sekaligus tidak bisa menembus sisa limit.

## Menu Otomatis

`.menu` ada di `umum/menu.js` dan **membaca daftar plugin yang terdeteksi** — tidak ada daftar manual:

- Folder baru / plugin baru → otomatis muncul di menu (tanpa edit `menu.js`).
- Tombol cuma yang perlu: satu tombol per kategori + tombol Kembali. Isi kategori berupa teks.
- Kategori yang dikenal punya ikon & nama cantik (daftar `META` di `menu.js`); folder lain tetap tampil dengan ikon 📂.
- `ownerOnly: true` di plugin → disembunyikan dari menu non-owner.
- `status(group)` di plugin → teks status ikut tampil di samping command (mis. `ON`/`OFF`).
- Langsung ke satu kategori: `.menu admin`.

## Hook Pasif (fitur tanpa command)

Plugin boleh menangani kejadian tanpa dipanggil lewat command — semua logika tetap di file plugin-nya,
dispatcher tidak punya fitur sendiri. Contoh nyata: `setting/antilink.js` dan `setting/welcome.js`.

```js
module.exports = {
  name: 'contoh', description: '...',
  async run(bot, msg, args, ctx) { /* command biasa */ },

  // Tiap pesan yang BUKAN command. Return true kalau sudah ditangani (hook berikutnya dilewati).
  async onMessage(bot, msg, ctx) { if (/kata-terlarang/i.test(msg.text || '')) { /* ... */ return true; } },

  // Tiap ada member baru masuk grup (msg.new_chat_members).
  async onNewMember(bot, msg, ctx) { ctx.reply(`Halo ${msg.new_chat_members[0].first_name}!`); },

  status: (group) => (group.contoh ? 'ON' : 'OFF'),   // opsional — tampil di menu
  ownerOnly: false,                                    // opsional — true = sembunyikan dari non-owner
};
```

Di dalam hook, `ctx.reply` mengirim pesan biasa (tanpa reply ke pesan pemicu).

## Tombol Inline Milik Plugin

Plugin bisa punya tombol sendiri (contoh: tombol 🎵 Download MP3 di `.tiktok`):

```js
module.exports = {
  name: 'contoh',
  callbackPrefix: 'cn',                                   // prefix unik plugin ini
  async run(bot, msg, args, ctx) {
    ctx.reply('Pilih:', { reply_markup: { inline_keyboard: [[
      { text: 'Klik', callback_data: 'mdp:cn:klik:123' }  // WAJIB diawali "mdp:<callbackPrefix>:"
    ]] } });
  },
  async onCallback(bot, q, parts, ctx) {                   // parts = ['klik', '123']
    bot.answerCallbackQuery(q.id, { text: 'Diklik!' });
  },
};
```

`callback_data` maksimal 64 byte — simpan data besar di memori (lihat `src/md/services/tiktok.js`), kirim token pendeknya saja.

## Plugin Bawaan: TikTok Downloader

`.tiktok <link>` (alias `.tt`, boleh reply ke pesan berisi link) — **1 limit per download**.
- Video tanpa watermark, atau foto slideshow (album). Pesan hasilnya memuat nama, @username, ID,
  durasi/ukuran (atau jumlah foto), statistik, musik, link asli, dan deskripsi lengkap.
- Deskripsi yang tidak muat di caption Telegram (1024 karakter) dikirim utuh di pesan terpisah.
- Tombol **🎵 Download MP3** muncul di bawah hasilnya — user yang memilih. Hanya yang request yang bisa menekan, aktif 30 menit, gratis (ubah `COST_MP3` di `src/md/services/tiktok.js` kalau mau ditarik limit).
- Gagal download → limit otomatis dikembalikan.
- Scraper: `src/md/scrapers/ttdl.js` — kalau situsnya berubah, cukup perbaiki file itu.

## Kelola Plugin & File dari Chat (OWNER ONLY)

Cuma owner bot (`ADMIN_IDS`) yang bisa. Plugin = kode yang dijalankan server, jangan pernah buka akses ini ke orang lain.

| Command | Fungsi |
|---|---|
| `.svplugins <kategori>/<nama>` | Simpan plugin baru ke `plugins-md/<kategori>/`. Reply file `.js` / pesan berisi kode, atau kirim file `.js` dengan caption command. Tanpa kategori → ambil dari `category:` di kode, kalau tidak ada → `umum` |
| `.editplugins <nama>` | Timpa plugin yang sudah ada (dicari di semua kategori; file lama di-backup) |
| `.delplugins <nama>` | Hapus plugin (di-backup dulu, plugin inti dikunci; folder kategori yang kosong ikut dibersihkan) |
| `.listplugins` | Daftar semua plugin per kategori · `.listplugins <kategori>` filter · `.listplugins <nama>` kirim file-nya |
| `.svfile <nama>` | Simpan file apa saja (dokumen, foto, video, audio, voice, sticker) |
| `.editfile <nama>` | Reply file baru = timpa isinya. `.editfile lama baru` tanpa reply = ganti nama |
| `.delfile <nama>` | Hapus file tersimpan |
| `.listfile [nama]` | Daftar file; dengan nama = kirim file-nya |
| `.setlimit <angka\|reset>` | Reply ke user: atur jatah limit harian khusus dia |
| `.premium on [hari]` / `permanen` / `off` | Reply ke user: atur premium |

Catatan:
- Plugin divalidasi dulu (sintaks, `module.exports`, `name`, `run`) — kalau salah, TIDAK disimpan.
- Plugin yang gagal dimuat setelah disimpan (mis. alias bentrok) **otomatis di-rollback**: file baru dihapus / file lama dikembalikan.
- Plugin harus CommonJS (`module.exports`, `require`), bukan `import/export`.
- Nama otomatis dibersihkan (huruf kecil, angka, `-`, `_`), aman dari path traversal.
- Backup: `data/backups/plugins/` · File tersimpan: `data/files/` (maks 20MB per file, batas download bot Telegram).
- Plugin inti yang tidak bisa dihapus: `menu`, `premium`, dan 8 command pengelola di atas.

## Data Grup (`ctx.group`)

Disimpan di `data/md-db.json` (terpisah dari database mode OTP):

```js
{ prefix: '.', antilink: false, welcome: true, warns: {}, members: {}, rules: '...' }
```

Ubah dan simpan dari plugin:

```js
const group = ctx.group;
group.antilink = true;
ctx.db.saveGroup(group);
```

## Catatan

- Plugin yang error saat dijalankan tidak membuat bot crash — error muncul di console dan user dapat pesan error singkat.
- Command admin grup dicek lewat `adminOnly: true`, bukan manual di dalam plugin.
- Log aktivitas MD **hanya ke console** (tidak ada pesan ke channel/grup, supaya aman dari spam-limit Telegram).
