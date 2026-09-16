<div align="center">

# 🔐 ManzxyOTP

### Bot Telegram Jual Nomor OTP Virtual — Otomatis, Aman, Siap Produksi

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![PM2 Ready](https://img.shields.io/badge/PM2-Ready-2B037A?style=flat-square&logo=pm2&logoColor=white)](https://pm2.keymetrics.io)
[![Provider](https://img.shields.io/badge/Provider-RumahOTP-blue?style=flat-square)]()
[![Payment](https://img.shields.io/badge/Payment-KiPay%20QRIS-orange?style=flat-square)]()
[![License](https://img.shields.io/badge/License-Proprietary-red?style=flat-square)](./LICENSE)

**Provider OTP:** RumahOTP &nbsp;•&nbsp; **Payment Gateway:** KiPay &nbsp;•&nbsp; **Versi:** v1.2

</div>

---

## 📑 Daftar Isi

- [Fitur Utama](#-fitur-utama)
- [Instalasi Cepat](#-instalasi-cepat)
- [Sistem Tingkatan (Level) Member](#-sistem-tingkatan-level-member)
- [Harga Khusus Admin/Owner](#-harga-khusus-adminowner)
- [Sistem Referral](#-sistem-referral)
- [Privasi](#-privasi)
- [Konfigurasi Penting](#-konfigurasi-penting)
- [Command User](#-command-user)
- [Command Admin](#-command-admin)
- [Struktur Folder](#-struktur-folder)
- [Troubleshooting](#-troubleshooting)
- [Author & Kontak](#-author--kontak)
- [Lisensi & Hak Cipta](#-lisensi--hak-cipta)

---

## ✨ Fitur Utama

| | |
|---|---|
| 📱 **Katalog Lengkap** | Ribuan layanan OTP, ratusan negara dengan bendera asli |
| 💳 **Deposit Otomatis** | QRIS auto-generate, saldo masuk otomatis tanpa link eksternal |
| 👑 **Harga Beda Admin/User** | Admin beli dengan harga modal, tanpa markup |
| 🏅 **Sistem Level Member** | Starter → Bronze → Silver → Gold → Platinum → VIP, diskon naik otomatis |
| 🔗 **Referral** | Ajak teman lewat link pribadi, dapat bonus saldo otomatis |
| 🔒 **Privasi Terjamin** | Kebijakan privasi jelas + user bisa hapus data sendiri kapan saja |
| 🔐 **Wajib Join Channel** | Middleware verifikasi member sebelum akses bot |
| 🔧 **Maintenance Mode** | Manual (`/mstart` `/mend`) atau terjadwal otomatis (jam WIB) |
| 🔁 **Auto-Topup** | Notifikasi otomatis saat saldo RumahOTP menipis |
| 📊 **Log Tersensor** | Nomor & kode OTP otomatis disensor di log admin |
| 🔌 **Plugin Hot-Reload** | Tambah plugin custom tanpa restart bot |
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

---

## 🔒 Privasi

Kebijakan privasi bisa diakses user kapan saja lewat `/privasi`, ringkasnya:

- Data disimpan hanya yang perlu untuk transaksi (ID Telegram, saldo, riwayat order/deposit)
- Nomor & OTP di log admin otomatis disensor (lihat `src/utils/logger.js`)
- User bisa hapus semua datanya sendiri secara permanen lewat `/hapusdata`

📄 Kebijakan lengkap ada di [`PRIVACY.md`](./PRIVACY.md) — sesuaikan sebelum dipublikasikan ke user.

---

## 🔧 Konfigurasi Penting

| Variable | Fungsi |
|---|---|
| `BOT_TOKEN` | Token dari @BotFather |
| `RUMAHOTP_KEY` | API key provider OTP |
| `MUSTIKAPAY_API_KEY` | API key payment gateway |
| `PRICE_MARKUP` | Markup harga untuk user (%) |
| `PRICE_MARKUP_ADMIN` | Markup harga untuk admin (%) |
| `ADMIN_IDS` | Telegram ID admin, pisah koma |
| `LOG_CHANNEL_ID` | Channel untuk log transaksi |
| `MAINTENANCE_ENABLED` | Aktifkan jadwal maintenance otomatis |
| `AUTO_TOPUP_ENABLED` | Notif otomatis saat saldo RumahOTP tipis |
| `REQUIRED_CHANNELS` | Channel wajib join sebelum pakai bot |
| `REFERRAL_BONUS` | Bonus saldo (Rp) per user baru dari link referral |

---

## 📋 Command User

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
/hapusdata         Hapus semua data akun (permanen)
/help              Panduan penggunaan
```

## 🔧 Command Admin

```text
/adminhelp                          Lihat semua command admin
/addbal <id> <jumlah>                Tambah saldo user
/kurangbal <id> <jumlah>             Kurangi saldo user
/cekbal <id>                         Detail user
/listuser                            Top 20 user
/stats                               Statistik bot
/provbal                             Saldo RumahOTP
/pgbal                               Saldo MustikaPay
/broadcast <pesan>                   Broadcast ke semua user
/mstart [alasan]                     Aktifkan maintenance sekarang
/mend                                Matikan maintenance
/mstatus                             Cek status maintenance
/announce <judul> | <isi>            Pengumuman ke log channel
/update <versi> | <p1> ; <p2>        Changelog ke log channel
/dailystats                          Statistik harian ke log channel
```

---

## 📁 Struktur Folder

```text
ManzxyOTP/
├── index.js                 Entry point
├── config.js                Konfigurasi terpusat
├── ecosystem.config.js      Konfigurasi PM2
├── .env.example             Template environment
├── package.json
│
├── src/
│   ├── handlers/
│   │   ├── menu.js          /start /saldo /profil /deposit /referral /privasi dll
│   │   ├── callback.js      Semua tombol inline (flow beli OTP, referral, privasi)
│   │   ├── otp.js           /status /cancel
│   │   ├── deposit.js       /deposit
│   │   └── admin.js         Semua command admin
│   │
│   ├── providers/
│   │   ├── rumahotp.js      API RumahOTP (services, buy, deposit)
│   │   └── mustikapay.js    API MustikaPay (QRIS payment)
│   │
│   ├── utils/
│   │   ├── db.js            Database JSON atomic (user, saldo, referral, dll)
│   │   ├── levels.js        Sistem tingkatan (level) member & diskon loyalitas
│   │   ├── session.js       State navigasi user (anti 64-byte limit)
│   │   ├── messages.js      Semua template pesan
│   │   ├── keyboard.js      Builder inline keyboard
│   │   ├── logger.js        Log ke channel + console (sensor data sensitif)
│   │   ├── helpers.js       fmt, flagEmoji, calcPrice (markup + diskon level), dll
│   │   ├── joincheck.js     Middleware wajib join channel
│   │   ├── maintenance.js   Cek status maintenance
│   │   ├── botinfo.js       Cache username bot (untuk link referral)
│   │   └── plugin-loader.js Hot-reload plugin
│   │
│   └── jobs/
│       ├── poller.js        Auto-poll deposit, auto-expire order
│       └── autotopup.js     Notif auto-topup RumahOTP
│
├── plugins/                 Taruh plugin custom di sini
├── data/                    Database (auto-generated)
└── logs/                    Log PM2
```

---

## 🆘 Troubleshooting

| Masalah | Solusi |
|---|---|
| Bot tidak respon | Cek `pm2 logs manzxyotp` |
| Operator tidak muncul | Pastikan versi terbaru (sudah di-fix) |
| Deposit QR tidak tampil | Cek `MUSTIKAPAY_API_KEY` valid |
| Beli OTP gagal | Cek saldo RumahOTP via `/provbal` |
| Bot mati sendiri | Gunakan PM2, auto-restart otomatis |

---

## 👤 Author & Kontak

```text
Nama      : Manzxy
Instagram : @manzkenzzid_
TikTok    : @manzoffc
Telegram   : t.me/manukzx 
GitHub    : github.com/manzxy
```

---

## © Lisensi & Hak Cipta

```text
Copyright (c) 2026 Manzxy. All Rights Reserved.
```

Proyek ini adalah karya asli **Manzxy** dan dilindungi hak cipta. Dilarang mengklaim ulang,
mendistribusikan ulang tanpa izin, atau menghapus atribusi kepemilikan pada source code ini.
Lihat berkas [`LICENSE`](./LICENSE) untuk ketentuan lengkap penggunaan.

<div align="center">

**Dibuat dengan oleh [Manzxy/Claude](https://github.com/manzxy)**

</div>
