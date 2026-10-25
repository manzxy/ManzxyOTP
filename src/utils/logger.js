// src/utils/logger.js — ManzxyOTP
'use strict';

const cfg = require('../../config');
const { fmt, fmtDate } = require('./helpers');
const botinfo = require('./botinfo');

let _bot = null;
const init = (bot) => { _bot = bot; };

// Tombol yang menempel di SETIAP log yang dikirim ke channel, biar admin bisa
// langsung buka bot atau chat user terkait tanpa perlu cari-cari manual.
const botButton  = () => {
  const uname = botinfo.getUsername();
  return uname ? [{ text: '🤖 Buka Bot', url: `https://t.me/${uname}` }] : [];
};
const userButton = (id) => (id && id !== '-')
  ? [{ text: '👤 Chat User', url: `tg://user?id=${id}` }]
  : [];

const send = (text, silent = true, extraRows = []) => {
  if (!_bot || !cfg.log_channel_id) return;
  const rows = [...extraRows, botButton()].filter((r) => r && r.length);
  _bot.sendMessage(cfg.log_channel_id, text, {
    parse_mode: 'Markdown',
    disable_notification: silent,
    disable_web_page_preview: true,
    reply_markup: rows.length ? { inline_keyboard: rows } : undefined,
  }).catch(() => {});
};

// Sensor: tampilkan 2 karakter pertama + bintang
const mask = (s, show = 2) => {
  if (!s) return '••••••';
  const str = String(s);
  return str.length <= show ? '•'.repeat(str.length) : str.slice(0, show) + '•'.repeat(Math.max(0, str.length - show));
};

const tag = (u) => {
  const name = u.first_name || u.username || 'Unknown';
  return `\`${u.id}\` ${u.username ? '@' + u.username : name}`;
};

const L = '─────────────────────────';
const ts = () => fmtDate(Date.now());

// ── Events ────────────────────────────────────────────────────────────────────
const logUserStart     = (u)                   => send(`👤 *User Baru*\n${L}\nID ${tag(u)}\nWaktu ${ts()}`, true, [userButton(u.id)]);
const logOrderCreated  = (u, o)                => send(`📦 *Order Masuk*\n${L}\nUser ${tag(u)}\nOrder \`${o.order_id}\`\nLayanan ${o.service}\nNegara ${o.country}\nNomor \`${mask(o.phone_number)}\` _(sensor)_\nHarga *${fmt(o.price)}*\nWaktu ${ts()}`, true, [userButton(u.id)]);
const logOTPReceived   = (u, orderId, phone, otp) => send(`📨 *OTP Masuk*\n${L}\nUser ${tag(u)}\nOrder \`${orderId}\`\nNomor \`${mask(phone)}\` _(sensor)_\nOTP \`${mask(otp)}\` _(sensor)_\nWaktu ${ts()}`, true, [userButton(u.id)]);
const logOrderCancelled= (u, orderId, ref, bal)   => send(`🔄 *Order Batal + Refund*\n${L}\nUser ${tag(u)}\nOrder \`${orderId}\`\nRefund *${fmt(ref)}*\nSaldo *${fmt(bal)}*\nWaktu ${ts()}`, true, [userButton(u.id)]);
const logOrderExpired  = (uid, orderId, svc)      => send(`⏰ *Order Expired*\n${L}\nUser \`${uid}\`\nOrder \`${orderId}\`\nLayanan ${svc}\nWaktu ${ts()}`, true, [userButton(uid)]);
const logDepositCreated= (u, dep)             => send(`💳 *Deposit Dibuat*\n${L}\nUser ${tag(u)}\nRef \`${dep.ref_no}\`\nNominal *${fmt(dep.amount)}*\nWaktu ${ts()}`, true, [userButton(u.id)]);
const logDepositSuccess= (u, ref, net, bal, issuer = '', payor = '') => send(`✅ *Deposit Sukses*\n${L}\nUser ${tag(u)}\nRef \`${ref}\`\nMasuk *${fmt(net)}*\nVia ${issuer || 'QRIS'}\nSaldo *${fmt(bal)}*\nWaktu ${ts()}`, false, [userButton(u.id)]);
const logDepositCancelled = (u, ref)          => send(`✖️ *Deposit Batal*\n${L}\nUser ${tag(u)}\nRef \`${ref}\`\nWaktu ${ts()}`, true, [userButton(u.id)]);
const logAutoTopupTriggered = (saldo, amount) => send(`🔁 *Auto-Topup Dipicu*\n${L}\nSaldo RO *${fmt(saldo)}*\nTopup *${fmt(amount)}*\nWaktu ${ts()}`, false);
const logAutoTopupSuccess   = (id, amount)    => send(`✅ *Auto-Topup Sukses*\n${L}\nDeposit \`${id}\`\nNominal *${fmt(amount)}*\nWaktu ${ts()}`, false);
const logAutoTopupFailed    = (reason)        => send(`❌ *Auto-Topup Gagal*\n${L}\nAlasan ${reason}\nWaktu ${ts()}`, false);
const logReferral = (referrerId, referredUser, bonus, totalReferral) => send(
  `🔗 *Bonus Referral Cair*\n${L}\nReferrer \`${referrerId}\`\nUser Baru ${tag(referredUser)}\nBonus *${fmt(bonus)}*\nTotal Referral Referrer ${totalReferral}×\nWaktu ${ts()}`,
  true, [userButton(referrerId), userButton(referredUser.id)]
);

// Action + error log (console saja, tidak spam channel)
// Format konsisten: [HH:MM:SS] [LEVEL] pesan — gampang dibaca di `pm2 logs`
const clock = () => new Date().toTimeString().slice(0, 8);
const COLOR = {
  info: '\x1b[36m', warn: '\x1b[33m', error: '\x1b[31m', ok: '\x1b[32m',
  cyan: '\x1b[36m', magenta: '\x1b[35m', dim: '\x1b[2m', bold: '\x1b[1m',
  reset: '\x1b[0m',
};
const cprint = (level, color, msg) => console.log(`${color}[${clock()}] [${level}]${COLOR.reset} ${msg}`);

const logInfo  = (msg) => cprint('INFO',  COLOR.info,  msg);
const logOk    = (msg) => cprint('OK',    COLOR.ok,    msg);
const logWarn  = (msg) => cprint('WARN',  COLOR.warn,  msg);

// ── Banner startup (console) ────────────────────────────────────────────────
// Logo blok "MANZXYOTP" bergradasi + kotak info bersekat. Hanya untuk console
// (log ke channel Telegram tetap lewat logBotStart). Warna otomatis mati kalau
// env NO_COLOR di-set.
const NO_COLOR = !!process.env.NO_COLOR;
const c256  = (n) => (NO_COLOR ? '' : `\x1b[38;5;${n}m`);
const paint = (code, text) => (NO_COLOR || !code ? String(text) : `${code}${text}${COLOR.reset}`);
const strip = (t) => String(t).replace(/\x1b\[[0-9;]*m/g, '');

// Font blok 5×5 — huruf yang dipakai: M A N Z X Y O T P
const GLYPH = {
  M: ['█   █', '██ ██', '█ █ █', '█   █', '█   █'],
  A: [' ███ ', '█   █', '█████', '█   █', '█   █'],
  N: ['█   █', '██  █', '█ █ █', '█  ██', '█   █'],
  Z: ['█████', '   █ ', '  █  ', ' █   ', '█████'],
  X: ['█   █', ' █ █ ', '  █  ', ' █ █ ', '█   █'],
  Y: ['█   █', ' █ █ ', '  █  ', '  █  ', '  █  '],
  O: [' ███ ', '█   █', '█   █', '█   █', ' ███ '],
  T: ['█████', '  █  ', '  █  ', '  █  ', '  █  '],
  P: ['████ ', '█   █', '████ ', '█    ', '█    '],
};
// Gradasi cyan → biru → ungu → magenta, satu warna per huruf
const GRADIENT = [51, 45, 39, 33, 63, 99, 135, 171, 207];

const logoLines = (word) =>
  [0, 1, 2, 3, 4].map((row) =>
    [...word].map((ch, i) => paint(c256(GRADIENT[i % GRADIENT.length]), GLYPH[ch][row])).join(' '));

const BOX_W = 58; // lebar isi kotak (tanpa border)

const boxLine = (content = '') => {
  const pad = Math.max(0, BOX_W - strip(content).length);
  return `${paint(c256(99), '│')} ${content}${' '.repeat(Math.max(0, pad - 1))}${paint(c256(99), '│')}`;
};
const boxTop    = (title) => {
  const t = title ? ` ${title} ` : '';
  return paint(c256(99), `╭─${t}${'─'.repeat(Math.max(0, BOX_W - t.length - 1))}╮`);
};
const boxDivider = (title) => {
  const t = title ? ` ${title} ` : '';
  return paint(c256(99), `├─${t}${'─'.repeat(Math.max(0, BOX_W - t.length - 1))}┤`);
};
const boxBottom = () => paint(c256(99), `╰${'─'.repeat(BOX_W)}╯`);

const fit = (text, max) => {
  const t = String(text);
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
};

/**
 * Cetak banner startup.
 * @param {Array<[string,string]>} rows  Pasangan [label, nilai]. Baris ['—', 'Judul'] = sekat bagian.
 */
const printBanner = (rows = []) => {
  const pad = '  ';
  console.log('');
  for (const line of logoLines('MANZXYOTP')) console.log(pad + line);
  console.log(pad + paint(c256(244), '─'.repeat(53)));
  console.log(pad + paint(COLOR.bold, 'Telegram OTP Seller') + paint(c256(244), '  ·  ') + paint(c256(250), 'Utility Grup') +
    paint(c256(244), '  ·  ') + paint(c256(213), cfg.bot_version || 'v1.0'));
  console.log('');

  // Sekat pertama jadi judul kotak (hindari dua garis judul bertumpuk)
  const first = rows[0] && rows[0][0] === '—' ? rows[0][1] : 'Status';
  const lines = [boxTop(first)];
  for (const [k, v] of rows.slice(first === 'Status' && !(rows[0] && rows[0][0] === '—') ? 0 : 1)) {
    if (k === '—') { lines.push(boxDivider(v)); continue; }
    const label = paint(c256(244), String(k).padEnd(13));
    lines.push(boxLine(`${paint(c256(51), '▸')} ${label} ${fit(v, BOX_W - 18)}`));
  }
  lines.push(boxDivider());
  lines.push(boxLine(`${paint(c256(244), 'Author')}  Manzxy ${paint(c256(244), '· github.com/manzxy')}`));
  lines.push(boxBottom());
  for (const l of lines) console.log(pad + l);
  console.log('');
};

const logUserAction = (u, action) => {
  const name = u.first_name || u.username || u.id;
  cprint('ACTION', COLOR.info, `uid=${u.id}(${name}) -> ${action}`);
};
const logError = (u, ctx, err) => {
  const name = u.first_name || u.username || u.id;
  console.error(`${COLOR.error}[${clock()}] [ERROR]${COLOR.reset} uid=${u.id}(${name}) ctx=${ctx}: ${err?.message || err}`);
  send(`⚠️ *Error*\n${L}\nUser ${tag(u)}\nKonteks ${ctx}\nError ${err?.message || err}\nWaktu ${ts()}`, true, [userButton(u.id)]);
};

// Sistem
const logBotStart = (me, adminIds) => send(
  `🚀 *ManzxyOTP Online*\n${L}\n@${me.username} (\`${me.id}\`)\nVersi ${cfg.bot_version}\nAdmin ${adminIds.map(id => `\`${id}\``).join(', ') || '-'}\nMarkup  ${cfg.price_markup_pct}%\nAuto-TU  ${cfg.auto_topup?.enabled ? `✅ ${fmt(cfg.auto_topup.threshold)}` : '❌'}\nMaintenance  ${cfg.maintenance?.enabled ? `✅ ${cfg.maintenance.start_hour}:00–${cfg.maintenance.end_hour}:00` : '❌'}\nWaktu  ${ts()}`,
 false
);
const logBotStop = (reason) => send(`🔴 *ManzxyOTP Offline*\n${L}\nAlasan  ${reason}\nWaktu  ${ts()}`, false);
const logSystemUpdate = (ver, changes) => send(`🆕 *Update ${ver}*\n${L}\n${changes.map((c, i) => `${i+1}. ${c}`).join('\n')}\nWaktu  ${ts()}`, false);
const logAnnouncement = (title, body, type = 'info') => {
 const icons = { info: '📢', warning: '⚠️', maintenance: '🔧', promo: '🎁' };
 send(`${icons[type] || '📢'} *${title}*\n${L}\n${body}\n${ts()}`, false);
};
const logMaintenance = (phase, reason = '') => send(
 phase === 'start'
 ? `🔧 *Maintenance Dimulai*\n${L}\nAlasan  ${reason || 'Perbaikan sistem'}\nWaktu  ${ts()}`
 : `✅ *Maintenance Selesai*\n${L}\nWaktu  ${ts()}`,
 false
);
const logDailyStats = (s) => send(
 `📊 *Statistik Harian*\n${L}\nUser  ${s.totalUsers} (baru +${s.newUsers})\nOrder  ${s.totalOrders} (✅${s.successOrders} ❌${s.cancelOrders})\nDeposit  *${fmt(s.totalDeposit)}*\nRevenue  *${fmt(s.totalRevenue)}*\nWaktu  ${ts()}`,
  false
);

module.exports = {
  init,
  logUserStart, logOrderCreated, logOTPReceived, logOrderCancelled, logOrderExpired,
  logDepositCreated, logDepositSuccess, logDepositCancelled,
  logAutoTopupTriggered, logAutoTopupSuccess, logAutoTopupFailed, logReferral,
  logUserAction, logError, logInfo, logOk, logWarn, printBanner,
  logBotStart, logBotStop, logSystemUpdate, logAnnouncement, logMaintenance, logDailyStats,
};
