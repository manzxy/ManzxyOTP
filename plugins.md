# 🧩 Folder Plugins MD — ManzxyOTP (mode MD)

Letakkan file `.js` di sini untuk menambah command baru ke **mode MD**
(utility/grup) — tanpa restart bot (hot-reload via chokidar).

Ini **terpisah total** dari folder `/plugins` (itu untuk mode OTP, format
berbeda). Plugin MD hanya aktif saat bot sedang `/setmode md`.

## Format Plugin

```js
// plugins-md/contoh.js
module.exports = {
  name: 'ping',            // wajib — nama command, dipanggil via <prefix>ping
  aliases: ['p'],           // opsional — nama lain untuk command yang sama
  category: 'umum',         // opsional — buat pengelompokan di *help
  description: 'Tes respon bot',  // opsional — ditampilkan di *help
  groupOnly: false,         // opsional — true kalau cuma boleh di grup
  adminOnly: false,         // opsional — true kalau cuma admin GRUP yang boleh pakai

  async run(bot, msg, args, ctx) {
    // bot    — instance node-telegram-bot-api asli
    // msg    — pesan Telegram yang trigger command ini
    // args   — array kata setelah nama command (string[])
    // ctx    — helper: { reply(text), group, plugins }
    //   ctx.reply(text)  → balas ke chat yang sama (otomatis reply ke pesan user)
    //   ctx.group        → setting grup ini dari data/md-db.json (prefix, antilink, dst)
    //   ctx.plugins       → Map semua plugin yang ter-load (buat command seperti *help)

    ctx.reply('🏓 Pong!');
  },
};
```

## Cara Pakai

1. Buat file baru di folder ini, misal `plugins-md/ping.js`
2. Bot langsung mendeteksi dan load file tersebut (gak perlu restart)
3. User panggil dengan prefix grup (default `.`) atau `/`, misal `.ping` atau `/ping`

## Data Grup (`ctx.group`)

Tiap grup punya setting sendiri, disimpan di `data/md-db.json` (terpisah dari
database mode OTP). Default-nya:

```js
{
  prefix: '.',       // prefix command di grup ini
  antilink: false,    // auto-hapus pesan berisi link dari non-admin
  welcome: true,       // kirim pesan sambutan ke member baru
  warns: {},            // { userId: jumlahWarn }
  members: {},           // { userId: { first_name, username } } — dikenal dari pesan masuk
}
```

Untuk mengubah dan menyimpan setting dari dalam plugin, pakai:

```js
const mddb = require('../src/md/mddb');
const group = ctx.group;
group.antilink = true;
mddb.saveGroup(group);
```

## Catatan

- Satu file = satu plugin (satu command + alias-nya)
- `name` dan `run` **wajib** ada — plugin tanpa itu dilewati otomatis (dicatat di log)
- Plugin yang error saat `run()` tidak akan nge-crash bot — error ditangkap dan dibalas ke chat
- File diubah → plugin reload otomatis. File dihapus → command langsung nonaktif
