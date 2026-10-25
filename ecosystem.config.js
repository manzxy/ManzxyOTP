// ecosystem.config.js — PM2 config untuk ManzxyOTP
// Install: npm install -g pm2
// Jalankan: pm2 start ecosystem.config.js
// Auto-start saat reboot: pm2 startup && pm2 save

module.exports = {
  apps: [{
    name:         'manzxyotp',
    script:       'index.js',
    instances:    1,
    autorestart:  true,          // restart otomatis jika crash
    watch:        false,         // matikan watch PM2 — pakai chokidar internal
    max_memory_restart: '300M',  // restart jika makan RAM > 300MB
    restart_delay:  3000,        // delay 3 detik sebelum restart
    max_restarts:   10,          // maks 10 restart per interval
    min_uptime:     '10s',       // dianggap crash jika mati < 10 detik
    env: {
      NODE_ENV: 'production',
    },
    // Log
    out_file:  './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
  }],
};
