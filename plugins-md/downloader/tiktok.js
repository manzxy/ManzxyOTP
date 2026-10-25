// plugins-md/downloader/tiktok.js
// Downloader TikTok (scraper ttdl.zone.id): video tanpa watermark / foto slideshow,
// lengkap dengan deskripsi, statistik & musik. Audio MP3 dipilih user lewat tombol
// di bawah hasilnya — satu fitur, tidak ada command terpisah.
// Biaya: 1 limit per download (limit harian per user, reset 00:00).
// Logika: src/md/services/tiktok.js · Scraper: src/md/scrapers/ttdl.js
const tiktok = require('../../src/md/services/tiktok');

module.exports = {
  name: 'tiktok',
  aliases: ['tt', 'ttdl'],
  description: 'Download TikTok tanpa watermark (video/foto) + tombol MP3',
  limit: tiktok.LIMIT_COST,
  callbackPrefix: tiktok.CALLBACK_PREFIX,
  run: tiktok.run,
  onCallback: tiktok.onCallback,
};
