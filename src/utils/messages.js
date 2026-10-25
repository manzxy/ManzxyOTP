// src/utils/messages.js — ManzxyOTP v1.0 (Go Public, rapi dengan box-drawing)
'use strict';

const { fmt, fmtDate, timeAgo, statusEmoji, flagEmoji } = require('./helpers');
const levels = require('./levels');
const serverStats = require('./serverStats');
const cfg    = require('../../config');
const L  = '━━━━━━━━━━━━━━━━━━━━━━━━━';
const L2 = '─────────────────────────';

// ── Welcome / Menu Utama ─────────────────────────────────────────────────────
const welcome = (user, uptime, isOwner = false, totalUsers = 0, promo = null) => {
  const name   = user.first_name || user.username || 'Kamu';
  const orders = user.orders?.length || 0;
  const sukses = user.orders?.filter((o) => o.status === 'completed').length || 0;
  const lvl    = levels.getLevel(user.orders || []);
  const lvlTag = isOwner ? '👑 Owner' : `${lvl.icon} ${lvl.name}${lvl.discount ? ` • diskon ${lvl.discount}%` : ''}`;

  const hourWIB = (new Date().getUTCHours() + 7) % 24;
  const greet   = hourWIB < 11 ? 'Selamat pagi' : hourWIB < 15 ? 'Selamat siang' : hourWIB < 18 ? 'Selamat sore' : 'Selamat malam';

  // Klaim kecepatan hanya muncul kalau didukung data nyata dari order sebelumnya
  const med   = serverStats.overallMedianSec();
  const speed = med ? `OTP rata-rata masuk ±${med} detik` : 'OTP masuk dalam hitungan detik';

  // Blok rekomendasi — dari cache live (kosong kalau belum hangat)
  const hot = promo
    ? `━━━━━━━━━━━━━━━━━━\n` +
      `🔥 *Rekomendasi Hari Ini*\n` +
      `${promo.app.icon} ${promo.app.name} ${flagEmoji(promo.opt.country.iso_code)} ${promo.opt.country.name}\n` +
      `🏆 Server ${promo.opt.server} • *${fmt(promo.price)}*` +
      `${promo.opt.rate != null ? ` • ✅ ${promo.opt.rate}% sukses` : ''}\n` +
      `━━━━━━━━━━━━━━━━━━\n\n`
    : '';

  const h = Math.floor(uptime / 3600);
  const m = Math.floor((uptime % 3600) / 60);
  const ownerStats = isOwner
    ? `\n\n🖥️ ${cfg.bot_version} • up ${h}j ${m}m • ${totalUsers.toLocaleString('id-ID')} user`
    : '';

  return (
    `🔐 *ManzxyOTP*\n` +
    `_Nomor virtual OTP — cepat, murah, aman_\n\n` +
    `${greet}, *${name}*! 👋\n` +
    `💰 Saldo *${fmt(user.balance || 0)}* • ${lvlTag}\n` +
    (orders ? `📦 ${orders}× order • ✅ ${sukses}× sukses\n` : '') +
    `\n${hot}` +
    `⚡ ${speed}\n` +
    `🛡️ OTP gagal masuk? Saldo balik otomatis 100%\n` +
    `🤖 OTP dikirim otomatis ke chat ini\n` +
    `🎁 Makin sering order, makin besar diskon` +
    `${ownerStats}\n\n` +
    `👇 Tap *Beli OTP Sekarang* untuk mulai`
  );
};

// ── Beli OTP: pilih aplikasi ──────────────────────────────────────────────────
const quickAppsHeader = () =>
  `⚡ *Beli OTP*\n${L2}\n` +
  `Pilih aplikasi — bot otomatis memilihkan\n` +
  `*server tercepat & terbaik* untuk kamu 🇮🇩\n\n` +
  `Butuh negara lain? Pakai *Negara / Server Lain*.`;

// ── Beli OTP: pilihan rekomendasi ─────────────────────────────────────────────
const LABEL_TEXT = { best: '🏆 *Rekomendasi*', fast: '⚡ *Tercepat*', cheap: '💰 *Termurah*' };
const quickOptions = (app, country, options, prices) => {
  const blocks = options.map((o, i) => {
    const bits = [`*${fmt(prices[i])}*`];
    if (o.rate != null) bits.push(`✅ ${o.rate}% sukses`); else bits.push('🆕 belum ada statistik');
    if (o.sec  != null) bits.push(`⏱ ±${o.sec} dtk`);
    return `${o.labels.map((l) => LABEL_TEXT[l]).join(' + ')} — Server ${o.server}\n   ${bits.join(' • ')}`;
  });
  return (
    `${app.icon} *${app.name}* • ${flagEmoji(country.iso_code)} ${country.name}\n${L2}\n` +
    `Pilihan terbaik saat ini _(dicek live)_:\n\n` +
    `${blocks.join('\n\n')}\n\n` +
    `_Gagal dapat OTP? Saldo dikembalikan otomatis._`
  );
};

// ── Maintenance ───────────────────────────────────────────────────────────────
const maintenanceMsg = (info) => {
  if (info.manual) {
    return (
      `🔧 *ManzxyOTP — Pemeliharaan Sistem*\n${L}\n\n` +
      `Bot sedang dalam perbaikan sementara.\n\n` +
      `├ 📝 Alasan ${info.reason}\n` +
      `└ 🕐 Mulai ${info.startAt ? fmtDate(info.startAt) : '-'}\n\n` +
      `Bot akan aktif kembali setelah perbaikan selesai.\n` +
      `Pantau info terbaru di channel kami. 🙏`
    );
  }
  return (
    `🔧 *ManzxyOTP — Pemeliharaan Rutin*\n${L}\n\n` +
    `Bot sedang dalam pemeliharaan terjadwal.\n\n` +
    `└ 🕐 Jadwal ${info.start} – ${info.end} WIB\n\n` +
    `Silakan kembali setelah jam *${info.end} WIB*.\n` +
    `Mohon maaf atas ketidaknyamanannya. 🙏`
  );
};

// ── Profil ────────────────────────────────────────────────────────────────────
const profile = (user, isOwner = false) => {
  const orders   = user.orders   || [];
  const deposits = user.deposits || [];
  const sukses   = orders.filter((o) => o.status === 'completed').length;
  const batal    = orders.filter((o) => ['cancelled','canceled'].includes(o.status)).length;
  const exprd    = orders.filter((o) => o.status === 'expiring').length;
  const spend    = orders.reduce((s, o) => s + (o.price || 0), 0);
  const depOk    = deposits.filter((d) => d.status === 'success').length;
  const depSum   = deposits.filter((d) => d.status === 'success').reduce((s, d) => s + (d.diterima || d.amount || 0), 0);
  const winRate  = orders.length ? Math.round((sukses / orders.length) * 100) : 0;
  const name     = [user.first_name, user.last_name].filter(Boolean).join(' ') || '-';
  const refCount = user.referral_count    || 0;
  const refEarn  = user.referral_earnings || 0;
  const svcMap   = {};
  orders.forEach((o) => { if (o.service) svcMap[o.service] = (svcMap[o.service] || 0) + 1; });
  const topSvc   = Object.entries(svcMap).sort((a, b) => b[1] - a[1])[0];
  const lastDep  = deposits.filter((d) => d.status === 'success')
    .sort((a, b) => new Date(b.created_local) - new Date(a.created_local))[0];

  const { current, next, percent, remaining } = levels.getProgress(orders);
  const levelTag = isOwner ? '👑 Owner' : `${current.icon} ${current.name}`;
  const bar       = levels.progressBar(percent);
  const nextLine  = isOwner
    ? '   Harga modal berlaku permanen untuk Owner.'
    : next
      ? ` ${bar} ${percent}%\n ${remaining} order sukses lagi ke ${next.icon} *${next.name}* (diskon ${next.discount}%)`
      : '   🏆 Level tertinggi tercapai — terima kasih sudah jadi pelanggan setia!';

  return (
    `╭─────────────────────╮\n` +
    `    👤 *Profil Akun*\n` +
    `╰─────────────────────╯\n\n` +
    `┌ 🆔 ID          \`${user.id}\`\n` +
    `├ 👤 Nama        ${name}\n` +
    `├ 📛 Username    ${user.username ? '@' + user.username : '—'}\n` +
    `├ 🏅 Tingkatan   ${levelTag}${!isOwner && current.discount ? ` (diskon ${current.discount}%)` : ''}\n` +
    `└ 📅 Bergabung   ${fmtDate(user.joined_at)}\n` +
    `${nextLine}\n\n` +
    `${L2}\n` +
    `💰 *Keuangan*\n` +
    `┌ Saldo aktif        *${fmt(user.balance)}*\n` +
    `├ Total deposit      ${fmt(depSum)} (${depOk}× sukses)\n` +
    `└ Total pengeluaran  ${fmt(spend)}\n` +
    (lastDep ? ` Deposit terakhir ${timeAgo(lastDep.created_local)}\n` : '') +
    `\n${L2}\n` +
    `📊 *Statistik Order*\n` +
    `┌ Total order   ${orders.length}\n` +
    `├ ✅ Sukses ${sukses}  ❌ Batal ${batal}  ⏰ Expire ${exprd}\n` +
    `├ 🎯 Win rate   ${winRate}%\n` +
    `└ 🏆 Favorit    ${topSvc ? `${topSvc[0]} (${topSvc[1]}×)` : '-'}\n` +
    `\n${L2}\n` +
    `🔗 *Referral*\n` +
    `┌ 👥 Diajak      ${refCount} orang\n` +
    `└ 💰 Total bonus ${fmt(refEarn)}\n` +
    `\n${L2}\n` +
    `${user.balance > 0 ? '🟢 Saldo tersedia, siap bertransaksi!' : '🔴 Saldo kosong — isi saldo dulu ya!'}`
  );
};

// ── Detail Tingkatan (Level) Member ─────────────────────────────────────────────
const levelInfo = (user, isOwner = false) => {
  const orders = user.orders || [];
  const { current, next, percent, remaining, sukses } = levels.getProgress(orders);

  const rows = levels.LEVELS.map((lvl) => {
    const reached = sukses >= lvl.threshold;
    const isCurrent = lvl.key === current.key;
    const mark = isCurrent ? '👉' : reached ? '✅' : '🔒';
    return `${mark} ${lvl.icon} *${lvl.name}* — min. ${lvl.threshold}× order sukses • diskon ${lvl.discount}%`;
  }).join('\n');

  const progressLine = isOwner
    ? '👑 Owner selalu dapat harga modal, terlepas dari tingkatan.'
    : next
      ? `${levels.progressBar(percent)} ${percent}%\n${remaining} order sukses lagi menuju *${next.icon} ${next.name}*`
      : '🏆 Kamu sudah di tingkatan tertinggi! Terima kasih sudah setia pakai ManzxyOTP.';

  return (
    `🏅 *Tingkatan Member*\n${L}\n\n` +
    `Tingkatanmu sekarang: *${current.icon} ${current.name}*\n` +
    `Total order sukses: *${sukses}×*\n\n` +
    `${progressLine}\n\n` +
    `${L2}\n` +
    `*Daftar Tingkatan:*\n${rows}\n\n` +
    `${L2}\n` +
    `_Diskon tingkatan otomatis diterapkan ke setiap pembelian OTP —_\n` +
    `_makin sering order sukses, makin murah harganya!_`
  );
};

// ── Katalog ───────────────────────────────────────────────────────────────────
const serversHeader = (total) =>
  `🌍 *Negara / Server Lain*\n${L2}\n` +
  `┌ ${total} server tersedia\n` +
  `├ ⭐ = rekomendasi bot saat ini\n` +
  `└ ⚡ = rata-rata detik OTP masuk\n\n` +
  `Pilih server:`;

const countriesHeader = (serverName, total, page, pages) =>
  `🌍 *Pilih Negara*\n${L2}\n` +
  `┌ ${serverName}\n` +
  `├ Negara ${total} tersedia\n` +
  `└ Halaman ${page}/${pages}\n\n` +
  `Pilih negara tujuan verifikasi:`;

const catalogHeader = (serverName, countryName, isoCode, total, page, pages) =>
  `📱 *Pilih Layanan*\n${L2}\n` +
  `┌ ${serverName}\n` +
  `├ Negara ${flagEmoji(isoCode)} *${countryName}*\n` +
  `├ Layanan ${total} tersedia\n` +
  `└ Halaman ${page}/${pages}\n\n` +
  `Harga tertera di tombol • ✅ = persentase OTP sukses 24 jam terakhir\n` +
  `Ketik nama di pencarian atau pilih dari daftar:`;

const operatorHeader = (serviceName, countryName, isoCode, price) =>
  `📶 *Pilih Operator*\n${L2}\n` +
  `┌ Negara ${flagEmoji(isoCode)} ${countryName}\n` +
  `├ Layanan ${serviceName}\n` +
  `└ Harga *${fmt(price)}*\n\n` +
  `Pilih jaringan operator atau gunakan *Semua Operator*:`;

const confirmOrder = (svc, country, isoCode, operator, price, balance, isOwner = false, discountPct = 0) =>
  `🛒 *Konfirmasi Pembelian*\n${L}\n\n` +
  `┌ 📱 Layanan *${svc}*\n` +
  `├ 🌍 Negara ${flagEmoji(isoCode)} ${country}\n` +
  (operator ? `├ 📶 Operator ${operator === 'any' ? 'Semua Operator' : operator.toUpperCase()}\n` : '') +
  `└ 💰 Harga *${fmt(price)}*${isOwner ? ' 👑' : discountPct > 0 ? ` (diskon level ${discountPct}%)` : ''}\n` +
  `${L2}\n` +
  `┌ Saldo kamu *${fmt(balance)}*\n` +
  `└ Sisa setelah *${fmt(balance - price)}*\n` +
  `${L2}\n\n` +
  `${balance < price
 ? '❌ *Saldo tidak cukup!*\nSilakan isi saldo terlebih dahulu.'
 : '✅ Konfirmasi pembelian?'}`;

// ── Order ─────────────────────────────────────────────────────────────────────
const orderSuccess = (order, balance) =>
  `✅ *Pembelian Berhasil!*\n${L}\n\n` +
  `┌ 📞 Nomor \`${order.phone_number}\`\n` +
  `└ 🔑 Order ID \`${order.order_id}\`\n` +
  `${L2}\n` +
  `┌ 📱 Layanan ${order.service}\n` +
  `├ 🌍 Negara ${flagEmoji(order.iso_code)} ${order.country}\n` +
  (order.operator ? `├ 📶 Operator ${order.operator === 'any' ? 'Semua Operator' : order.operator.toUpperCase()}\n` : '') +
  `├ 💰 Harga *${fmt(order.price)}*\n` +
  `├ ⏱ Expire ${fmtDate(order.expired_at)}\n` +
  `└ 💳 Sisa saldo *${fmt(balance)}*\n` +
  `${L}\n\n` +
  `📋 *Tinggal 3 langkah:*\n` +
  `1️⃣ Salin nomor di atas\n` +
  `2️⃣ Masukkan ke aplikasi *${order.service}*\n` +
  `3️⃣ Tunggu — 🤖 *OTP dikirim otomatis* ke chat ini\n\n` +
  `_Tidak jadi? Tekan Batalkan — saldo dikembalikan penuh_`;

const otpReceived = (orderId, phoneNumber, otpCode, otpMsg) =>
  `🎉 *OTP Berhasil Diterima!*\n${L}\n\n` +
  `🔢 Kode OTP kamu:\n\n` +
  `┌─────────────────────┐\n` +
  `│ *${otpCode}*\n` +
  `└─────────────────────┘\n\n` +
  `┌ 📞 Nomor \`${phoneNumber}\`\n` +
  `└ 🔑 Order ID \`${orderId}\`\n` +
  (otpMsg ? `\n📩 Pesan lengkap:\n\`\`\`\n${otpMsg.slice(0, 200)}\`\`\`` : '') +
  `\n\n_Segera masukkan kode sebelum expired!_`;

const otpPending = (order) =>
  `⏳ *Menunggu OTP...*\n${L2}\n\n` +
  `┌ 📞 Nomor \`${order.phone_number || order.number}\`\n` +
  `└ 📱 Layanan ${order.service || '-'}\n\n` +
  `OTP belum masuk. Pastikan kamu sudah:\n` +
  `├ Memasukkan nomor ke aplikasi\n` +
  `└ Meminta kode verifikasi dikirim\n\n` +
  `Coba klik *📨 Cek OTP* lagi dalam beberapa detik.`;

const orderCancelled = (orderId, refund, balance) =>
  `✖️ *Order Dibatalkan*\n${L2}\n\n` +
  `┌ 🔑 Order ID \`${orderId}\`\n` +
  `├ 🔄 Refund *${fmt(refund)}*\n` +
  `└ 💰 Saldo baru *${fmt(balance)}*\n\n` +
  `✅ Refund sudah masuk ke saldo kamu.`;

const orderStokHabis = (countryName, serviceName) =>
  `😔 *Stok Tidak Tersedia*\n${L2}\n\n` +
  `Maaf, saat ini tidak ada stok nomor untuk:\n` +
  `┌ 📱 ${serviceName}\n` +
  `└ 🌍 ${countryName}\n\n` +
  `Silakan coba:\n` +
  `├ Pilih negara lain\n` +
  `├ Coba beberapa menit lagi\n` +
  `└ Hubungi admin jika terus berlanjut`;

const saldoKurang = (price, balance) =>
  `❌ *Saldo Tidak Cukup*\n${L2}\n\n` +
  `┌ 💰 Saldo kamu *${fmt(balance)}*\n` +
  `├ 💸 Harga OTP *${fmt(price)}*\n` +
  `└ ➕ Kekurangan *${fmt(price - balance)}*\n\n` +
  `Silakan isi saldo terlebih dahulu untuk melanjutkan.`;

// ── Deposit ───────────────────────────────────────────────────────────────────
const depositCreated = (dep) => {
  const expMs  = dep.expired_at || Date.now() + 30 * 60 * 1000;
  const expMin = Math.max(0, Math.floor((expMs - Date.now()) / 60000));
  const hasUnique = dep.unique_code != null && dep.requested_amount != null;
  return (
    `💳 *Deposit via QRIS*\n${L}\n\n` +
    (hasUnique
      ? `🚨 *WAJIB BACA:* transfer PERSIS *${fmt(dep.amount)}* (sampai 3 digit terakhir kode uniknya). Jangan dibulatkan — kalau kurang/lebih meski cuma Rp1, sistem *tidak akan mendeteksi* pembayaran otomatis.\n\n${L2}\n\n`
      : '') +
    `┌ 🔖 Ref \`${dep.ref_no}\`\n` +
    (hasUnique
      ? `├ 💵 Nominal diminta  ${fmt(dep.requested_amount)}\n├ 🔢 Kode unik        +${dep.unique_code}\n`
      : '') +
    `├ 💳 Total *HARUS* dibayar  *${fmt(dep.amount)}*\n` +
    `├ 💰 Saldo masuk       *${fmt(dep.diterima || dep.amount)}*\n` +
    `└ ⏱ Berlaku ${expMin} menit lagi\n` +
    `${L}\n\n` +
    `📱 *Cara bayar:*\n` +
    `1️⃣ Buka m-banking atau e-wallet\n` +
    `2️⃣ Scan QR Code di atas\n` +
    `3️⃣ Pastikan nominal di aplikasi sudah PERSIS *${fmt(dep.amount)}* sebelum konfirmasi\n\n` +
    `✅ Saldo masuk *otomatis* setelah bayar!\n` +
    `_Bot memantau pembayaran tiap 10 detik_`
  );
};

const depositSuccess = (refNo, amount, balance, issuer = '', payor = '') =>
  `💰 *Saldo Berhasil Masuk!*\n${L}\n\n` +
  `┌ 🔖 Ref No \`${refNo}\`\n` +
  `├ 💵 Masuk *${fmt(amount)}*\n` +
  (issuer ? `├ 📱 Metode ${issuer}\n` : '') +
  (payor  ? `├ 👤 Dari ${payor}\n`  : '') +
  `└ 💳 Total saldo *${fmt(balance)}*\n\n` +
  `🚀 Saldo aktif, yuk mulai bertransaksi!`;

// ── Riwayat ───────────────────────────────────────────────────────────────────
const historyOrder = (orders) => {
  if (!orders?.length) return (
    `📋 *Riwayat Order*\n${L}\n\n` +
    `Belum ada riwayat transaksi.\n\n` +
    `Mulai dengan menekan *📱 Beli OTP* di menu utama!`
  );
  const lines = orders.slice(0, 10).map((o) => {
    const ic  = statusEmoji(o.status);
    const otp = o.otp_code ? ` 🔢 \`${o.otp_code}\`` : '';
    return (
      `${ic} *${o.service || '-'}* ${flagEmoji(o.iso_code)}\n` +
      ` ├ 📞 \`${o.phone_number || '-'}\`${otp}\n` +
      ` └ 💰 ${fmt(o.price || 0)} • 🕐 ${timeAgo(o.time)}`
    );
  });
  return `📋 *Riwayat Order*\n${L}\n_10 transaksi terakhir:_\n\n` + lines.join('\n\n');
};

const historyDeposit = (deposits) => {
  if (!deposits?.length) return (
    `💰 *Riwayat Deposit*\n${L}\n\n` +
    `Belum ada riwayat deposit.\n\n` +
    `Tekan *💳 Isi Saldo* untuk deposit pertamamu!`
  );
  const lines = deposits.slice(0, 10).map((d) => {
    const ic  = statusEmoji(d.status);
    const via = d.issuer ? ` 📱 ${d.issuer}` : '';
    return (
      `${ic} \`${d.deposit_id || d.ref_no || '-'}\`${via}\n` +
      ` └ 💰 *${fmt(d.diterima || d.amount)}* • ${timeAgo(d.created_local || d.created)}`
    );
  });
  return `💰 *Riwayat Deposit*\n${L}\n_10 deposit terakhir:_\n\n` + lines.join('\n\n');
};

const topUsers = (users) => {
  const sorted = [...users].sort((a, b) => b.orders.length - a.orders.length).slice(0, 10);
  const medals = ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];
  const lines  = sorted.map((u, i) => {
    const name   = u.first_name || u.username || `User`;
    const sukses = u.orders.filter((o) => o.status === 'completed').length;
    return `${medals[i]} *${name}* ${u.orders.length}× order ✅${sukses}`;
  });
  return `🏆 *Top Pengguna ManzxyOTP*\n${L}\n_Berdasarkan jumlah order:_\n\n` + lines.join('\n');
};

const helpText = () =>
  `❓ *Panduan Penggunaan*\n${L}\n\n` +
  `📱 *Cara Order OTP:*\n` +
  `1️⃣ Isi saldo → *💳 Isi Saldo* → QRIS\n` +
  `2️⃣ Pilih *📱 Beli OTP*\n` +
  `3️⃣ Pilih Server → Negara → Layanan\n` +
  `4️⃣ Konfirmasi pembelian (server 1: pilih operator dulu)\n` +
  `5️⃣ Masukkan nomor ke aplikasi tujuan\n` +
  `6️⃣ Klik *📨 Cek OTP* → kode muncul\n` +
  `7️⃣ Klik *✖️ Batalkan* jika tidak jadi\n\n` +
  `${L2}\n` +
  `💳 *Cara Deposit:*\n` +
  `1️⃣ Tekan *💳 Isi Saldo*\n` +
  `2️⃣ Pilih nominal\n` +
  `3️⃣ Scan QR Code\n` +
  `4️⃣ Saldo masuk otomatis! ✅\n\n` +
  `${L2}\n` +
  `📋 *Perintah tersedia:*\n` +
  `/start /menu /saldo /profil\n` +
  `/deposit /history /level /help\n` +
  `/referral /privasi\n\n` +
  `${L2}\n` +
  `⚠️ *Ketentuan:*\n` +
  `├ Maks 1 order aktif per akun\n` +
  `├ Refund otomatis jika OTP gagal\n` +
  `├ Minimal deposit Rp 5.000\n` +
  `└ Maintenance 23:00–01:00 WIB\n\n` +
  `📞 Ada masalah? Hubungi admin!`;

// ── Referral ──────────────────────────────────────────────────────────────────
const referralInfo = (user, botUsername, bonus) => {
  const link = botUsername ? `https://t.me/${botUsername}?start=ref${user.id}` : '(link belum tersedia, coba lagi sesaat lagi)';
  const count  = user.referral_count    || 0;
  const earned = user.referral_earnings || 0;
  return (
    `🔗 *Ajak Teman, Dapat Saldo!*\n${L}\n\n` +
    `Bagikan link referral kamu. Setiap orang yang buka bot lewat link ini,\n` +
    `kamu langsung dapat bonus saldo *${fmt(bonus)}* — otomatis, tanpa syarat tambahan.\n\n` +
    `┌ 🔗 Link kamu:\n` +
    `└ \`${link}\`\n\n` +
    `${L2}\n` +
    `📊 *Statistik Referral*\n` +
    `┌ 👥 Total diajak ${count} orang\n` +
    `└ 💰 Total bonus didapat *${fmt(earned)}*\n\n` +
    `_Tap link di atas untuk salin, lalu kirim ke teman kamu!_`
  );
};

const referralBonusNotify = (bonus, newUser, totalReferral) =>
  `🎉 *Bonus Referral Masuk!*\n${L2}\n\n` +
  `Ada teman baru buka bot lewat link kamu:\n` +
  `👤 ${newUser.first_name || newUser.username || 'User baru'}\n\n` +
  `💰 Bonus *${fmt(bonus)}* sudah masuk ke saldo kamu.\n` +
  `👥 Total teman diajak: *${totalReferral}* orang.`;

// ── Privasi ───────────────────────────────────────────────────────────────────
const privacyPolicy = () =>
  `🔒 *Kebijakan Privasi — ManzxyOTP*\n${L}\n\n` +
  `*Data yang kami simpan:*\n` +
  `├ ID & username Telegram kamu\n` +
  `├ Saldo & riwayat transaksi (deposit/order)\n` +
  `├ Nomor virtual & kode OTP dari order kamu sendiri\n` +
  `└ Tidak ada nomor HP pribadi, tidak ada data KTP/dokumen\n\n` +
  `${L2}\n` +
  `*Bagaimana data dipakai:*\n` +
  `├ Hanya untuk memproses order & deposit kamu\n` +
  `├ Log transaksi disensor otomatis (nomor & OTP di-mask)\n` +
  `├ Tidak pernah dijual atau dibagikan ke pihak ketiga\n` +
  `└ Hanya admin bot yang bisa akses data, untuk keperluan support\n\n` +
  `${L2}\n` +
  `*Hak kamu:*\n` +
  `├ Lihat data lewat /profil\n` +
  `└ Tanya-tanya soal privasi atau minta koreksi data, hubungi admin\n\n` +
  `_Dengan menggunakan bot ini kamu setuju data kamu diproses sesuai kebijakan di atas._`;

const joinPrompt = (notJoined) => {
  const list = notJoined.map((ch, i) => `${i+1}. [${ch.name}](${ch.url})`).join('\n');
  return (
    `🔒 *Akses Terbatas*\n${L}\n\n` +
    `Halo! Sebelum menggunakan *ManzxyOTP*,\nkamu wajib join channel berikut:\n\n` +
    `${list}\n\n` +
    `Setelah join semua channel, klik tombol\n` +
    `*✅ Sudah Join* untuk verifikasi otomatis.`
  );
};

module.exports = {
  maintenanceMsg, profile, levelInfo, helpText, joinPrompt,
  welcome, quickAppsHeader, quickOptions, serversHeader, countriesHeader, catalogHeader, operatorHeader,
  confirmOrder, orderSuccess, otpReceived, otpPending,
  orderCancelled, orderStokHabis, saldoKurang,
  depositCreated, depositSuccess,
  historyOrder, historyDeposit, topUsers,
  referralInfo, referralBonusNotify,
  privacyPolicy,
};
