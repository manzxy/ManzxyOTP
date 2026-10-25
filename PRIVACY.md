# 🔒 Kebijakan Privasi — ManzxyOTP

Dokumen ini menjelaskan data apa saja yang disimpan bot ini, untuk apa
dipakai, dan hak apa saja yang dimiliki pengguna. Versi ringkas dari
dokumen ini juga bisa diakses langsung oleh user lewat perintah `/privasi`
di dalam bot.

> Sesuaikan nama bot/owner di bawah sebelum dipublikasikan ke user asli.

---

## 1. Data yang Dikumpulkan

Saat seseorang mulai menggunakan bot (`/start`), sistem menyimpan:

- **ID & profil Telegram** — user ID, username, nama depan/belakang (dari Telegram, bukan input manual)
- **Saldo & riwayat transaksi** — nominal deposit, nominal order, waktu transaksi
- **Riwayat order OTP** — layanan, negara, nomor virtual, dan kode OTP dari order milik user itu sendiri
- **Data referral** — siapa yang mengajak (jika daftar lewat link referral), jumlah teman yang diajak

Bot **tidak** meminta atau menyimpan: nomor HP pribadi, KTP/dokumen identitas, alamat, atau data kartu pembayaran. Deposit diproses lewat QRIS pihak ketiga (KiPay) — bot hanya menerima status & nominal transaksi, bukan detail rekening/kartu pengguna.

## 2. Bagaimana Data Digunakan

- Memproses pembelian nomor OTP & deposit saldo
- Menghitung tingkatan (level) member dan diskon loyalitas
- Menghitung & mencairkan bonus referral
- Statistik agregat untuk admin (jumlah user, omzet, dll — tanpa membongkar data personal ke publik)

## 3. Keamanan & Penyensoran Log

- Log transaksi ke channel admin otomatis **menyensor** nomor HP dan kode OTP (lihat `src/utils/logger.js`, fungsi `mask()`) — hanya 2 karakter pertama yang tampil, sisanya diganti `•`
- Database disimpan lokal di server (`data/db.json`) dan hanya bisa diakses oleh pengelola server/bot
- Data tidak pernah dijual, disewakan, atau dibagikan ke pihak ketiga di luar keperluan menjalankan layanan (mis. API provider OTP & payment gateway yang memang dipakai untuk transaksi)

## 4. Hak Pengguna

Pengguna berhak untuk:

- **Melihat** datanya sendiri kapan saja lewat `/profil` dan `/history`
- **Meminta koreksi atau penghapusan** data dengan menghubungi admin lewat tombol **📞 CS Admin** di menu bot — permintaan ini diproses manual oleh admin, bukan lewat perintah self-service di bot
- **Bertanya** soal data yang disimpan dengan menghubungi admin lewat tombol **📞 CS Admin** di menu bot

> Kenapa penghapusan tidak dibuat self-service (mis. lewat perintah `/hapusdata`)?
> Karena bot punya sistem **bonus referral** yang mencairkan saldo begitu ada akun baru
> yang start via link referral. Kalau user bisa menghapus akunnya sendiri kapan saja,
> celah ini bisa disalahgunakan untuk hapus-lalu-daftar-ulang berkali-kali demi klaim
> bonus referral berulang. Penghapusan tetap bisa dilakukan admin secara manual atas
> permintaan user yang sah, di luar alur otomatis bot.

## 5. Retensi Data

Data disimpan selama akun masih digunakan. Kalau user meminta penghapusan lewat admin,
data dihapus permanen dari database bot pada saat itu juga. Log yang sudah terlanjur
terkirim ke channel admin (mis. notifikasi transaksi) mengikuti kebijakan retensi
channel Telegram itu sendiri dan sudah disensor sejak awal sesuai poin 3.

## 6. Kontak

Pertanyaan seputar privasi & data bisa disampaikan ke admin bot melalui username yang tertera di menu **📞 CS Admin**.

---

_Dokumen ini adalah template dasar, bukan nasihat hukum. Sesuaikan dengan regulasi yang berlaku di wilayah operasimu (mis. UU PDP di Indonesia) sebelum digunakan secara komersial._
