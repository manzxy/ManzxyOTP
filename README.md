# 🔐 ManzxyOTP — Bot OTP Telegram

Bot Telegram untuk jual nomor OTP virtual secara otomatis.
**Provider:** RumahOTP | **Payment Gateway:** MustikaPay

---

## ✨ Fitur Utama

- 📱 Ribuan layanan OTP, ratusan negara dengan bendera asli
- 💳 Deposit QRIS otomatis (generate gambar QR langsung, tanpa link)
- 👑 **Harga beda Admin vs User** — admin beli dengan harga modal
- 🏅 **Sistem Tingkatan (Level) Member** — Starter → Bronze → Silver → Gold → Platinum → VIP, diskon otomatis naik seiring order sukses
- 🔒 Wajib join channel sebelum bisa pakai bot
- 🔧 Maintenance manual (`/mstart` `/mend`) + terjadwal (jam WIB)
- 🔁 Auto-topup notifikasi saat saldo RumahOTP menipis
- 📊 Log lengkap dengan sensor data sensitif (nomor & OTP)
- 🔌 Plugin hot-reload tanpa restart bot
- ⚡ PM2 ready — auto-restart jika crash

---

## 🚀 Instalasi Cepat

```bash
npm install
cp .env.example .env
nano .env          # isi semua API key & token
npm start
```

Untuk production (recommended):
```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save && pm2 startup
```

Lihat `INSTALL.md` untuk panduan lengkap.

---

## 🏅 Sistem Tingkatan (Level) Member

Setiap user naik level otomatis berdasarkan jumlah order **sukses** (OTP diterima), dan dapat diskon tambahan di atas harga normal — murni bonus loyalitas, tidak mengubah markup dasar dari `.env`.

| Level | Min. Order Sukses | Diskon |
|---|---|---|
| 🌱 Starter | 0 | 0% |
| 🥉 Bronze | 5 | 1% |
| 🥈 Silver | 20 | 2% |
| 🥇 Gold | 50 | 4% |
| 💠 Platinum | 100 | 6% |
| 💎 VIP | 250 | 10% |

Cek tingkatan lewat command `/level` atau tombol **🏅 Level & Diskon** di menu utama. Admin/Owner selalu dapat harga modal, terlepas dari tingkatan. Mau ubah ambang batas atau persentase diskonnya? Tinggal edit `src/utils/levels.js`.

---

## 👑 Harga Khusus Admin/Owner

Bot otomatis mendeteksi jika yang order adalah admin (`ADMIN_IDS` di `.env`) dan memberi harga modal asli tanpa markup:

```env
PRICE_MARKUP=15          # User biasa: harga modal + 15%
PRICE_MARKUP_ADMIN=0     # Admin: harga modal asli (0% markup)
```

Owner bisa beli OTP untuk dipakai sendiri tanpa rugi margin.

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

---

## 📋 Command User

```
/start  /menu     Menu utama
/saldo             Cek saldo
/profil            Profil & statistik lengkap
/level             Tingkatan member & diskon
/deposit           Isi saldo via QRIS
/history           Riwayat 10 order terakhir
/status            Cek OTP order aktif
/cancel            Batalkan order aktif
/help              Panduan penggunaan
```

## 🔧 Command Admin

```
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

```
ManzxyOTP/
├── index.js                 Entry point
├── config.js                Konfigurasi terpusat
├── ecosystem.config.js      Konfigurasi PM2
├── .env.example             Template environment
├── package.json
│
├── src/
│   ├── handlers/
│   │   ├── menu.js          /start /saldo /profil /deposit dll
│   │   ├── callback.js      Semua tombol inline (flow beli OTP)
│   │   ├── otp.js           /status /cancel
│   │   ├── deposit.js       /deposit
│   │   └── admin.js         Semua command admin
│   │
│   ├── providers/
│   │   ├── rumahotp.js      API RumahOTP (services, buy, deposit)
│   │   └── mustikapay.js    API MustikaPay (QRIS payment)
│   │
│   ├── utils/
│   │   ├── db.js            Database JSON atomic
│   │   ├── levels.js        Sistem tingkatan (level) member & diskon loyalitas
│   │   ├── session.js       State navigasi user (anti 64-byte limit)
│   │   ├── messages.js      Semua template pesan
│   │   ├── keyboard.js      Builder inline keyboard
│   │   ├── logger.js        Log ke channel + console (sensor data sensitif)
│   │   ├── helpers.js       fmt, flagEmoji, calcPrice (markup + diskon level), dll
│   │   ├── joincheck.js     Middleware wajib join channel
│   │   ├── maintenance.js   Cek status maintenance
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

## 💰 Cara Kerja Bisnis

Lihat `STRATEGI_BISNIS.md` untuk rencana lengkap monetisasi, proyeksi keuntungan, dan strategi jangka panjang.

**Ringkasan singkat:**
```
User deposit → masuk saldo MustikaPay kamu
User beli OTP → bot potong saldo user (harga + markup)
Bot beli ke RumahOTP → pakai saldo RumahOTP (harga modal)
Selisihnya = keuntungan kamu
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
