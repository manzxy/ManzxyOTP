<div align="center">

# 🔐 ManzxyOTP

### Bot Telegram Jual Nomor OTP Virtual — Otomatis, Aman, Siap Produksi

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![PM2 Ready](https://img.shields.io/badge/PM2-Ready-2B037A?style=flat-square&logo=pm2&logoColor=white)](https://pm2.keymetrics.io)
[![Provider](https://img.shields.io/badge/Provider-RumahOTP-blue?style=flat-square)]()
[![Payment](https://img.shields.io/badge/Payment-KiPay%20QRIS-orange?style=flat-square)]()
[![License](https://img.shields.io/badge/License-MIT%20%2B%20Attribution-yellow?style=flat-square)](./LICENSE)

**Provider OTP:** RumahOTP &nbsp;•&nbsp; **Payment Gateway:** KiPay &nbsp;•&nbsp; **Versi:** v1.3

**Satu bot, dua mode:** 🔐 OTP (jualan OTP) ⇄ 🧩 MD (utility/grup) — switch instan lewat `/setmode`

</div>

---

## 📑 Daftar Isi

- [Fitur Utama](#-fitur-utama)
- [Instalasi Cepat](#-instalasi-cepat)
- [Mode Ganda: OTP ⇄ MD](#-mode-ganda-otp--md)
- [Sistem Tingkatan (Level) Member](#-sistem-tingkatan-level-member)
- [Harga Khusus Admin/Owner](#-harga-khusus-adminowner)
- [Sistem Referral](#-sistem-referral)
- [Privasi](#-privasi)
- [Konfigurasi Penting](#-konfigurasi-penting)
- [Command User (Mode OTP)](#-command-user-mode-otp)
- [Command Admin (Mode OTP)](#-command-admin-mode-otp)
- [Command Mode MD](#-command-mode-md)
- [Struktur Folder](#-struktur-folder)
- [Troubleshooting](#-troubleshooting)
- [Author & Kontak](#-author--kontak)
- [Lisensi & Hak Cipta](#-lisensi--hak-cipta)

---

## ✨ Fitur Utama

| | |
|---|---|
| 🔀 **Mode Ganda** | Satu bot, dua kepribadian: OTP (jualan) ⇄ MD (utility/grup) — switch instan lewat `/setmode` |
| 📱 **Katalog Lengkap** | Ribuan layanan OTP, ratusan negara dengan bendera asli |
| 💳 **Deposit Otomatis** | QRIS auto-generate, saldo masuk otomatis tanpa link eksternal |
| 👑 **Harga Beda Admin/User** | Admin beli dengan harga modal, tanpa markup |
| 🏅 **Sistem Level Member** | Starter → Bronze → Silver → Gold → Platinum → VIP, diskon naik otomatis |
| 🔗 **Referral** | Ajak teman lewat link pribadi, dapat bonus saldo otomatis |
| 🔒 **Privasi Terjamin** | Kebijakan privasi jelas, data hanya dipakai untuk transaksi |
| 🔐 **Wajib Join Channel** | Middleware verifikasi member sebelum akses bot |
| 🔧 **Maintenance Mode** | Manual (`/mstart` `/mend`) atau terjadwal otomatis (jam WIB) |
| 🔁 **Auto-Topup** | Notifikasi otomatis saat saldo RumahOTP menipis |
| 📊 **Log Tersensor** | Nomor & kode OTP otomatis disensor di log admin |
| 🧩 **Plugin MD** | Kick/promote/mute/warn/antilink/welcome/tagall dll, struktur plugin sendiri |
| 🔌 **Plugin Hot-Reload** | Tambah plugin custom (OTP maupun MD) tanpa restart bot |
| ⚡ **PM2 Ready** | Auto-restart jika crash, siap untuk produksi |

---

## 🚀 Instalasi Cepat

```bash
npm install
cp .env.example .env
nano .env          # isi semua API key & token
npm start
```

**Mode production** (disarankan):

```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save && pm2 startup
```

📖 Panduan instalasi lengkap ada di [`INSTALL.md`](./INSTALL.md).

---

## 🔀 Mode Ganda: OTP ⇄ MD

Satu bot (satu token Telegram), dua mode yang bisa di-switch owner kapan saja:

| Mode | Fungsi | Database |
|---|---|---|
| 🔐 **OTP** *(default)* | Jualan nomor OTP virtual — semua fitur di README ini sebelum bagian ini | `data/db.json` |
| 🧩 **MD** | Utility/grup — kick, promote, mute, warn, antilink, welcome, tagall, dll | `data/md-db.json` |

```text
/setmode           Lihat mode aktif sekarang
/setmode otp       Pindah ke mode jualan OTP
/setmode md        Pindah ke mode utility/grup
```

Hanya **admin** (`ADMIN_IDS`) yang bisa switch mode. **Switch-nya instan** — begitu
`/setmode` dijalankan, command mode lama langsung berhenti merespon dan command
mode baru langsung aktif, **tanpa restart bot**.

**Kenapa database-nya dipisah?** Skema datanya beda total — mode OTP nyimpen user/
saldo/order/deposit, mode MD nyimpen setting grup/warn/member. Dipisah dari awal
(`db.js` vs `src/md/mddb.js`) supaya dua dunia ini gak pernah saling nyampur atau
nabrak, dan masing-masing tetap jalan rapi walau bot lagi di mode satunya — job
background seperti auto-poll deposit tetap jalan di mode MD sekalipun, jadi
transaksi OTP yang lagi berjalan gak pernah ke-drop cuma gara-gara ganti mode.

Plugin mode MD punya struktur & folder sendiri (`/plugins-md`, hot-reload) —
terpisah dari `/plugins` yang punya mode OTP. Lihat [Command Mode MD](#-command-mode-md)
dan [`plugins-md/README.md`](./plugins-md/README.md) untuk bikin plugin baru.

---

## 🏅 Sistem Tingkatan (Level) Member

Level naik otomatis berdasarkan jumlah order **sukses** (OTP diterima), dan memberi diskon tambahan di atas harga normal — bonus loyalitas murni, tidak mengubah markup dasar dari `.env`.

| Level | Min. Order Sukses | Diskon |
|:---:|:---:|:---:|
| 🌱 Starter | 0 | 0% |
| 🥉 Bronze | 5 | 1% |
| 🥈 Silver | 20 | 2% |
| 🥇 Gold | 50 | 4% |
| 💠 Platinum | 100 | 6% |
| 💎 VIP | 250 | 10% |

Cek tingkatan lewat `/level` atau tombol **🏅 Level & Diskon**. Admin/Owner selalu dapat harga modal, terlepas dari tingkatan. Ubah ambang batas/persentase di `src/utils/levels.js`.

---

## 👑 Harga Khusus Admin/Owner

Bot otomatis mendeteksi order dari admin (`ADMIN_IDS` di `.env`) dan memberi harga modal asli tanpa markup:

```env
PRICE_MARKUP=15          # User biasa : harga modal + 15%
PRICE_MARKUP_ADMIN=0     # Admin      : harga modal asli (0% markup)
```

---

## 🔗 Sistem Referral

Setiap user punya link referral pribadi:

```
https://t.me/<username_bot>?start=ref<user_id>
```

Bisa dilihat lewat `/referral` atau tombol **🔗 Referral** di menu utama. Setiap kali ada user **baru** yang membuka bot lewat link tersebut, referrer langsung dapat bonus saldo — otomatis, tanpa perlu deposit/order dulu.

| Pengaturan | Keterangan |
|---|---|
| Env variable | `REFERRAL_BONUS` |
| Default | Rp 150 / user baru |
| Anti self-referral | ✅ Pakai link sendiri otomatis ditolak |
| Anti dobel klaim | ✅ Bonus hanya dicairkan sekali per user baru |
| Anti user hantu | ✅ Kode referral tidak valid tidak membuat record palsu |
| Anti reset akun | ✅ Tidak ada fitur hapus akun sendiri — mencegah delete-lalu-daftar-ulang untuk klaim bonus berkali-kali |

---

## 🔒 Privasi

Kebijakan privasi bisa diakses user kapan saja lewat `/privasi`, ringkasnya:

- Data disimpan hanya yang perlu untuk transaksi (ID Telegram, saldo, riwayat order/deposit)
- Nomor & OTP di log admin otomatis disensor (lihat `src/utils/logger.js`)
- Permintaan koreksi/penghapusan data dilayani manual lewat admin — bukan self-service, supaya tidak disalahgunakan untuk membuat ulang akun demi klaim bonus referral berkali-kali

📄 Kebijakan lengkap ada di [`PRIVACY.md`](./PRIVACY.md) — sesuaikan sebelum dipublikasikan ke user.

---

## 🔧 Konfigurasi Penting

| Variable | Fungsi |
|---|---|
| `BOT_TOKEN` | Token dari @BotFather |
| `RUMAHOTP_KEY` | API key provider OTP |
| `KIPAY_API_KEY` | API key payment gateway (KiPay) |
| `PRICE_MARKUP` | Markup harga untuk user (%) |
| `PRICE_MARKUP_ADMIN` | Markup harga untuk admin (%) |
| `ADMIN_IDS` | Telegram ID admin, pisah koma |
| `LOG_CHANNEL_ID` | Channel untuk log transaksi |
| `MAINTENANCE_ENABLED` | Aktifkan jadwal maintenance otomatis |
| `AUTO_TOPUP_ENABLED` | Notif otomatis saat saldo RumahOTP tipis |
| `REQUIRED_CHANNELS` | Channel wajib join sebelum pakai bot |
| `REFERRAL_BONUS` | Bonus saldo (Rp) per user baru dari link referral |

---

## 📋 Command User (Mode OTP)

```text
/start  /menu     Menu utama
/saldo             Cek saldo
/profil            Profil & statistik lengkap
/level             Tingkatan member & diskon
/deposit           Isi saldo via QRIS
/history           Riwayat 10 order terakhir
/status            Cek OTP order aktif
/cancel            Batalkan order aktif
/referral          Link referral & bonus saldo
/privasi           Kebijakan privasi
/help              Panduan penggunaan
```

## 🔧 Command Admin (Mode OTP)

```text
/adminhelp                          Lihat semua command admin
/addbal <id> <jumlah>                Tambah saldo user
/kurangbal <id> <jumlah>             Kurangi saldo user
/cekbal <id>                         Detail user
/listuser                            Top 20 user
/stats                               Statistik bot
/provbal                             Saldo RumahOTP
/pgbal                               Info KiPay (link dashboard)
/broadcast <pesan>                   Broadcast ke semua user
/mstart [alasan]                     Aktifkan maintenance sekarang
/mend                                Matikan maintenance
/mstatus                             Cek status maintenance
/announce <judul> | <isi>            Pengumuman ke log channel
/update <versi> | <p1> ; <p2>        Changelog ke log channel
/dailystats                          Statistik harian ke log channel
/setmode [otp|md]                    Lihat/ganti mode bot (global, selalu aktif)
```

---

## 🧩 Command Mode MD

Prefix default `.` (bisa diganti per grup lewat `setprefix`), atau pakai `/` —
dua-duanya jalan. Lihat daftar lengkap & deskripsi langsung di bot lewat `.help`.

```text
UMUM
.start / .menu          Info bot & mode aktif
.help                    Daftar semua command
.groupinfo               Info & statistik grup

ADMIN GRUP  (perlu bot jadi admin grup + izin terkait)
.kick                    Kick member (reply pesannya)
.promote                 Jadikan member admin grup (reply pesannya)
.demote                  Cabut status admin (reply pesannya)
.mute / .unmute          Bisukan / lepas bisu member (reply pesannya)
.warn                    Beri peringatan — auto-kick di peringatan ke-3
.resetwarn               Reset peringatan member ke 0
.tagall [pesan]           Mention semua member yang pernah aktif di grup

SETTING GRUP  (admin grup)
.antilink on|off          Auto-hapus pesan berisi link dari non-admin
.welcome on|off           Pesan sambutan otomatis member baru
.setprefix <karakter>     Ganti prefix command grup ini (maks 3 karakter)
```

> Keterbatasan platform (bukan bug): Telegram Bot API tidak punya endpoint untuk
> mengambil **semua** member grup sekaligus, jadi `.tagall` hanya mention member
> yang sudah pernah kelihatan aktif (kirim pesan) sejak bot gabung di grup itu.

Mau nambah command sendiri? Taruh file baru di `/plugins-md` — hot-reload otomatis,
tanpa restart. Lihat [`plugins-md/README.md`](./plugins-md/README.md).

---

## 📁 Struktur Folder

```text
ManzxyOTP/
├── index.js                 Entry point — daftarkan handler mode OTP & MD
├── config.js                Konfigurasi terpusat (mode OTP)
├── ecosystem.config.js      Konfigurasi PM2
├── .env.example             Template environment
├── package.json
│
├── src/
│   ├── handlers/            ── Mode OTP ──────────────────────────────────
│   │   ├── menu.js          /start /saldo /profil /deposit /referral /privasi dll
│   │   ├── callback.js      Semua tombol inline (flow beli OTP, referral, privasi)
│   │   ├── otp.js           /status /cancel
│   │   ├── deposit.js       /deposit
│   │   ├── admin.js         Semua command admin mode OTP
│   │   └── setmode.js       /setmode — GLOBAL, switch OTP ⇄ MD (selalu aktif)
│   │
│   ├── providers/
│   │   ├── rumahotp.js      API RumahOTP (services, buy, deposit)
│   │   └── kipay.js          API KiPay (QRIS payment)
│   │
│   ├── utils/
│   │   ├── db.js            Database JSON mode OTP (user, saldo, referral, dll)
│   │   ├── mode.js           Mode manager + withMode() — gerbang OTP/MD tanpa restart
│   │   ├── depositVerify.js Satu-satunya logic verifikasi status deposit KiPay
│   │   ├── levels.js        Sistem tingkatan (level) member & diskon loyalitas
│   │   ├── session.js       State navigasi user (anti 64-byte limit)
│   │   ├── messages.js      Semua template pesan mode OTP
│   │   ├── keyboard.js      Builder inline keyboard mode OTP
│   │   ├── logger.js        Log ke channel + console (sensor data sensitif)
│   │   ├── helpers.js       fmt, flagEmoji, calcPrice (markup + diskon level), dll
│   │   ├── joincheck.js     Middleware wajib join channel
│   │   ├── maintenance.js   Cek status maintenance
│   │   ├── botinfo.js       Cache username bot (untuk link referral)
│   │   └── plugin-loader.js Hot-reload plugin mode OTP (folder /plugins)
│   │
│   ├── md/                  ── Mode MD ───────────────────────────────────
│   │   ├── mddb.js          Database JSON mode MD (setting grup, warn, member)
│   │   ├── pluginLoader.js  Hot-reload plugin mode MD (folder /plugins-md)
│   │   └── dispatcher.js    Router command + event welcome/antilink
│   │
│   └── jobs/
│       ├── poller.js        Auto-poll deposit, auto-expire order (selalu jalan)
│       └── autotopup.js     Notif auto-topup RumahOTP (selalu jalan)
│
├── plugins/                 Plugin custom mode OTP (hot-reload)
├── plugins-md/               Plugin custom mode MD (hot-reload) — lihat README di dalamnya
├── data/                    Database (auto-generated: db.json, md-db.json, mode.json)
└── logs/                    Log PM2
```

---

## 🆘 Troubleshooting

| Masalah | Solusi |
|---|---|
| Bot tidak respon | Cek `pm2 logs manzxyotp` |
| Operator tidak muncul | Pastikan versi terbaru (sudah di-fix) |
| Deposit QR tidak tampil | Cek `KIPAY_API_KEY` valid |
| Beli OTP gagal | Cek saldo RumahOTP via `/provbal` |
| Bot mati sendiri | Gunakan PM2, auto-restart otomatis |
| Command OTP gak respon | Cek mode aktif lewat `/setmode` — mungkin bot lagi di mode MD |
| Command MD (`.kick` dll) gak respon | Cek mode aktif lewat `/setmode` — mungkin bot lagi di mode OTP |
| `.kick`/`.mute`/`.promote` gagal | Pastikan bot sudah dijadikan **admin grup** dengan izin yang sesuai |

---

## 👤 Author & Kontak

```text
Nama      : Manzxy
Instagram : @manzkenzzid_
TikTok    : @manzoffc
GitHub    : github.com/manzxy
```

---

## © Lisensi & Hak Cipta

```text
MIT License — Copyright (c) 2026 Manzxy. Open Source dengan Atribusi Wajib.
```

Proyek ini **open-source** (lisensi MIT) — bebas dipakai, dimodifikasi, di-fork, bahkan
untuk keperluan komersial. Satu syarat tegas: **atribusi "Manzxy" wajib tetap ada** —
nama proyek, copyright notice, dan kredit di README/source code tidak boleh dihapus
atau diganti seolah-olah karya orang lain. Fork dan modifikasi fitur silakan bebas,
asal watermark kepemilikan asli tetap utuh.

Lihat berkas [`LICENSE`](./LICENSE) untuk teks lengkap.

<div align="center">

**Dibuat dengan ❤️ oleh [Manzxy](https://github.com/manzxy)**

</div>
