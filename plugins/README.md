# 🔌 Folder Plugins — ManzxyOTP

Letakkan file `.js` di sini untuk menambah fitur baru ke bot **tanpa restart**.

Bot secara otomatis mendeteksi file baru dan memuatnya langsung (hot-reload via chokidar).

## Format Plugin

```js
// plugins/contoh.js
'use strict';

module.exports = (bot) => {
  // Daftarkan command atau handler di sini
  bot.onText(/\/ping/, (m) => {
    bot.sendMessage(m.chat.id, '🏓 Pong!');
  });
};
```

## Cara Pakai

1. Buat file baru di folder ini, misal `plugins/custom.js`
2. Bot langsung mendeteksi dan load file tersebut
3. Tidak perlu restart bot sama sekali

## Catatan

- Satu file = satu modul plugin
- Export harus berupa **function** yang menerima parameter `bot`
- Jika file diubah → plugin reload otomatis
- Jika file dihapus → plugin tidak aktif lagi (command lama masih terdaftar sampai restart)
