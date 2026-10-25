# 🚀 Cara Install & Jalankan ManzxyOTP

## 1. Install Dependencies

```bash
npm install
```

## 2. Setup Environment

```bash
cp .env.example .env
# Edit .env — isi BOT_TOKEN, RUMAHOTP_KEY, KIPAY_API_KEY, dst.
nano .env
```

## 3. Jalankan Bot

### Mode biasa (untuk testing):
```bash
npm start
```

### Mode production (pakai PM2 — recommended):
```bash
# Install PM2 global (sekali saja)
npm install -g pm2

# Jalankan bot
pm2 start ecosystem.config.js

# Auto-start saat server reboot
pm2 startup
pm2 save

# Lihat log
pm2 logs manzxyotp

# Restart
pm2 restart manzxyotp

# Stop
pm2 stop manzxyotp
```

## 4. Cara Dapat Untung

Bot otomatis menerapkan markup harga ke semua OTP yang dijual.

Contoh dengan `PRICE_MARKUP=15`:
- Harga asli RumahOTP: **Rp 1.100**
- Harga ke user: **Rp 1.265**
- Untung per transaksi: **Rp 165**

Semakin banyak user & transaksi, semakin besar penghasilan.

### Tips maksimalkan untung:
- Set markup 10–20% (terlalu tinggi = user pindah ke kompetitor)
- Aktifkan wajib join channel — biar user tetap update info
- Broadcast promo rutin ke semua user
- Jaga saldo RumahOTP selalu cukup (aktifkan AUTO_TOPUP)

## 5. Auto-reload Plugin

Letakkan file `.js` baru di folder `/plugins` → bot langsung load tanpa restart.
Lihat `/plugins/README.md` untuk format plugin.

## 6. Troubleshooting

| Masalah | Solusi |
|---|---|
| Bot tidak response | `pm2 logs manzxyotp` untuk lihat error |
| Deposit QR tidak muncul | Cek KIPAY_API_KEY di .env |
| OTP tidak masuk | Cek RUMAHOTP_KEY & saldo RumahOTP (`/provbal`) |
| Bot mati sendiri | PM2 akan restart otomatis, cek `pm2 status` |
