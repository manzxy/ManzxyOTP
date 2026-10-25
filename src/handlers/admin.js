// src/handlers/admin.js — ManzxyOTP
'use strict';

const db      = require('../utils/db');
const dz      = require('../providers/ditznesia');
// (KiPay belum menyediakan endpoint publik untuk cek saldo — lihat /pgbal di bawah)
const log     = require('../utils/logger');
const { fmt, isAdmin, fmtDate } = require('../utils/helpers');
const { setManual, getManualState, isMaintenanceActive, maintenanceInfo } = require('../utils/maintenance');
const cfg     = require('../../config');

const S = (bot, cid, text, extra = {}) =>
  bot.sendMessage(cid, text, { parse_mode: 'Markdown', ...extra });

const guard = (m, bot) => {
  if (!isAdmin(m.from.id)) { S(bot, m.chat.id, '❌ Akses ditolak.'); return false; }
  return true;
};

const L = '─────────────────────────';

module.exports = (bot, pending, pendingDeposit) => {

  // /adminhelp
  bot.onText(/\/adminhelp/, (m) => {
    if (!guard(m, bot)) return;
    S(bot, m.chat.id,
      `🔧 *Admin — ManzxyOTP*\n${L}\n\n` +
      `👑 *Harga Spesial Admin Aktif*\n` +
      `Kamu beli OTP dengan harga modal (markup ${cfg.admin_markup_pct || 0}%)\n` +
      `User biasa tetap kena markup ${cfg.price_markup_pct}%\n` +
      `Bonus referral aktif: ${fmt(cfg.referral.bonus)}/user baru\n\n` +
      `*Saldo User*\n` +
      `/addbal <id> <jml>\n/kurangbal <id> <jml>\n/cekbal <id>\n\n` +
      `*Data*\n` +
      `/listuser — top 20 saldo\n/stats — statistik bot\n` +
      `/trxlog — 15 trx terakhir\n/deplog — deposit pending\n\n` +
      `*Provider*\n` +
      `/provbal — saldo Ditznesia\n/provhist — riwayat order Ditznesia\n/pgbal — info KiPay\n/pgmutasi — mutasi deposit\n\n` +
      `*Maintenance (LANGSUNG AKTIF)*\n` +
      `/mstart [alasan] — aktifkan maintenance sekarang\n` +
      `/mend — matikan maintenance\n` +
      `/mstatus — cek status maintenance\n\n` +
      `*Broadcast*\n/broadcast <pesan>\n\n` +
      `*Log Channel*\n` +
      `/announce <judul> | <isi>\n` +
      `/update <versi> | <p1> ; <p2>\n` +
      `/dailystats`
    );
  });

  // ── MAINTENANCE COMMANDS ───────────────────────────────────────────────────

  // /mstart [alasan] — aktifkan maintenance SEKARANG, semua user langsung kena block
  bot.onText(/\/mstart(.*)/, async (m, match) => {
    if (!guard(m, bot)) return;
    const reason = (match[1] || '').trim() || 'Perbaikan sistem oleh admin';

    setManual(true, reason);
    log.logMaintenance('start', reason);

    S(bot, m.chat.id,
      `🔧 *Maintenance AKTIF*\n${L}\n` +
      `Alasan ${reason}\n` +
      `Waktu ${fmtDate(Date.now())}\n\n` +
      `Semua user sudah diblokir dari akses bot.\n` +
      `Gunakan /mend untuk matikan maintenance.`
    );

    // Broadcast ke semua user bahwa bot maintenance
    const users  = db.getAllUsers();
    const info   = maintenanceInfo();
    let sent = 0;
    for (const u of users) {
      try {
        await bot.sendMessage(u.id,
          `🔧 *ManzxyOTP — Maintenance*\n${L}\n\n` +
          `Bot sedang dalam perbaikan sementara.\n\n` +
          `Alasan ${reason}\n\n` +
          `Bot akan aktif kembali setelah perbaikan selesai.\n` +
          `Pantau pengumuman di channel kami.`,
          { parse_mode: 'Markdown' }
        );
        sent++;
      } catch {}
      await new Promise(r => setTimeout(r, 60));
    }
    S(bot, m.chat.id, `📢 Notif maintenance terkirim ke ${sent} user.`);
  });

  // /mend — matikan maintenance
  bot.onText(/\/mend/, async (m) => {
    if (!guard(m, bot)) return;

    const wasManual = getManualState().active;
    setManual(false);
    log.logMaintenance('end', '');

    S(bot, m.chat.id,
      `✅ *Maintenance Selesai*\n${L}\n` +
      `Status Bot kembali online\n` +
      `Waktu ${fmtDate(Date.now())}\n\n` +
      `Semua user sudah bisa menggunakan bot kembali.`
    );

    // Broadcast ke semua user bahwa bot aktif kembali
    const users = db.getAllUsers();
    let sent = 0;
    for (const u of users) {
      try {
        await bot.sendMessage(u.id,
          `✅ *ManzxyOTP — Kembali Online!*\n${L}\n\n` +
          `Bot sudah aktif kembali dan siap digunakan.\n` +
          `Ketik /start untuk memulai.`,
          { parse_mode: 'Markdown' }
        );
        sent++;
      } catch {}
      await new Promise(r => setTimeout(r, 60));
    }
    S(bot, m.chat.id, `📢 Notif selesai maintenance terkirim ke ${sent} user.`);
  });

  // /mstatus — cek status maintenance sekarang
  bot.onText(/\/mstatus/, (m) => {
    if (!guard(m, bot)) return;
    const manual  = getManualState();
    const active  = isMaintenanceActive();
    const info    = maintenanceInfo();
    S(bot, m.chat.id,
      `🔧 *Status Maintenance*\n${L}\n\n` +
      `Status sekarang ${active ? '🔴 AKTIF (user diblokir)' : '🟢 TIDAK AKTIF'}\n\n` +
      `*Mode Manual (command):*\n` +
      `${manual.active ? `🔴 Aktif sejak ${fmtDate(manual.startAt)}\nAlasan: ${manual.reason}` : '🟢 Tidak aktif'}\n\n` +
      `*Mode Terjadwal (.env):*\n` +
      `${cfg.maintenance?.enabled ? `✅ Aktif — jam ${info.start}–${info.end} WIB` : '❌ Dinonaktifkan'}\n\n` +
      `Admin selalu bisa akses bot meski maintenance aktif.`
    );
  });

  // ── USER COMMANDS ──────────────────────────────────────────────────────────

  bot.onText(/\/addbal (\d+) (\d+)/, (m, match) => {
    if (!guard(m, bot)) return;
    try {
      const uid     = Number(match[1]);
      const amount  = Number(match[2]);
      const balance = db.addBalance(uid, amount, `topup admin ${m.from.id}`);
      S(bot, m.chat.id, `✅ Tambah *${fmt(amount)}* ke \`${uid}\`\nSaldo baru: *${fmt(balance)}*`);
      bot.sendMessage(uid,
        `💰 *Saldo Ditambahkan*\n${L}\nMasuk *${fmt(amount)}*\nSaldo *${fmt(balance)}*\n\n_Ditambahkan oleh Admin._`,
        { parse_mode: 'Markdown' }
      ).catch(() => {});
    } catch (e) { S(bot, m.chat.id, `❌ ${e.message}`); }
  });

  bot.onText(/\/kurangbal (\d+) (\d+)/, (m, match) => {
    if (!guard(m, bot)) return;
    try {
      const uid     = Number(match[1]);
      const amount  = Number(match[2]);
      const balance = db.deductBalance(uid, amount, `deduct admin ${m.from.id}`);
      S(bot, m.chat.id, `✅ Kurangi *${fmt(amount)}* dari \`${uid}\`\nSaldo baru: *${fmt(balance)}*`);
    } catch (e) { S(bot, m.chat.id, `❌ ${e.message}`); }
  });

  bot.onText(/\/cekbal (\d+)/, (m, match) => {
    if (!guard(m, bot)) return;
    const u       = db.getUser(Number(match[1]));
    const spend   = u.orders.reduce((s, o) => s + (o.price || 0), 0);
    const sukses  = u.orders.filter((o) => o.status === 'completed').length;
    const batal   = u.orders.filter((o) => ['cancelled','canceled'].includes(o.status)).length;
    const depOk   = (u.deposits || []).filter((d) => d.status === 'success').length;
    const depTot  = (u.deposits || []).filter((d) => d.status === 'success').reduce((s, d) => s + (d.diterima || d.amount || 0), 0);
    const winRate = u.orders.length ? Math.round((sukses / u.orders.length) * 100) : 0;
    S(bot, m.chat.id,
      `👤 *Detail User*\n${L}\n` +
      `ID \`${u.id}\`\n` +
      `Nama ${[u.first_name, u.last_name].filter(Boolean).join(' ') || '-'}\n` +
      `Username ${u.username ? '@' + u.username : '-'}\n` +
      `Bergabung ${fmtDate(u.joined_at)}\n\n` +
      `Saldo *${fmt(u.balance)}*\n` +
      `Depo total ${fmt(depTot)} (${depOk}×)\n` +
      `Spend ${fmt(spend)}\n\n` +
      `Order ${u.orders.length} • ✅${sukses} ❌${batal}\n` +
      `Win ${winRate}%`
    );
  });

  bot.onText(/\/listuser/, (m) => {
    if (!guard(m, bot)) return;
    const users = db.getAllUsers();
    if (!users.length) return S(bot, m.chat.id, 'Belum ada user.');
    const lines = users.sort((a, b) => b.balance - a.balance).slice(0, 20)
      .map((u, i) => `${i+1}. \`${u.id}\` ${u.first_name || '-'} *${fmt(u.balance)}* ${u.orders.length} order`);
    S(bot, m.chat.id, `👥 *Top 20 User:*\n${L}\n${lines.join('\n')}`);
  });

  bot.onText(/\/stats/, (m) => {
    if (!guard(m, bot)) return;
    const st = db.getStats();
    S(bot, m.chat.id,
      `📊 *Statistik ManzxyOTP*\n${L}\n` +
      `Total user ${st.total_users}\n` +
      `Total saldo user ${fmt(st.totalBalance)}\n` +
      `Total order ${st.totalOrders}\n` +
      `Total topup ${fmt(st.totalTopup)}\n` +
      `Total refund ${fmt(st.totalRefund)}\n` +
      `Bonus referral ${fmt(st.totalReferral)} (${st.referralCount}×)\n` +
      `Revenue bersih *${fmt(st.totalTopup - st.totalRefund - st.totalReferral)}*\n` +
      `Deposit sukses ${st.depositDone}\n` +
      `Deposit pending ${st.depositPending}\n` +
      `Order aktif ${pending.size}\n` +
      `Maintenance ${isMaintenanceActive() ? '🔴 Aktif' : '🟢 Off'}`
    );
  });

  bot.onText(/\/trxlog/, (m) => {
    if (!guard(m, bot)) return;
    const trx   = db.getTx(15);
    if (!trx.length) return S(bot, m.chat.id, 'Belum ada transaksi.');
    const ic    = { topup: '➕', deduct: '➖', refund: '🔄' };
    const lines = trx.map((t, i) =>
      `${i+1}. ${ic[t.type]||'•'} \`${t.user_id}\` *${fmt(t.amount)}*\n ${t.note||'-'}`
    );
    S(bot, m.chat.id, `📊 *Log Transaksi (15):*\n${L}\n${lines.join('\n\n')}`);
  });

  bot.onText(/\/deplog/, (m) => {
    if (!guard(m, bot)) return;
    const deps = db.getPendingDeposits().slice(0, 10);
    if (!deps.length) return S(bot, m.chat.id, '✅ Tidak ada deposit pending.');
    const lines = deps.map((d, i) =>
      `${i+1}. \`${d.user_id}\` ${fmt(d.diterima||d.amount)} *${d.status}*\n Ref: \`${d.deposit_id||d.ref_no}\``
    );
    S(bot, m.chat.id, `💳 *Deposit Pending (${deps.length}):*\n${L}\n${lines.join('\n\n')}`);
  });

  bot.onText(/\/provbal/, async (m) => {
    if (!guard(m, bot)) return;
    try {
      const data = await dz.getProviderBalance();
      S(bot, m.chat.id,
        `🏦 *Saldo Ditznesia*\n${L}\n` +
        `Nama ${data.name}\n` +
        `Email ${data.email}\n` +
        `Saldo *${data.formated}*`
      );
    } catch (e) { S(bot, m.chat.id, `❌ ${e.message}`); }
  });

  // /provhist [jumlah] — riwayat order terakhir di akun Ditznesia
  bot.onText(/\/provhist(?:\s+(\d+))?/, async (m, match) => {
    if (!guard(m, bot)) return;
    const limit = Math.min(Math.max(Number(match[1]) || 10, 1), 30);
    try {
      const list = await dz.getHistory(limit);
      if (!list.length) return S(bot, m.chat.id, 'Belum ada riwayat order di Ditznesia.');
      const lines = list.map((h, i) =>
        `${i + 1}. ${h.service_name || '-'} • \`${h.phone_number || '-'}\`\n` +
        `   ${h.status} • ${fmt(h.price)}${h.otp_code ? ` • OTP \`${h.otp_code}\`` : ''}`);
      S(bot, m.chat.id, `📜 *Riwayat Ditznesia (${list.length})*\n${L}\n${lines.join('\n')}`);
    } catch (e) { S(bot, m.chat.id, `❌ ${e.message}`); }
  });

  bot.onText(/\/pgbal/, async (m) => {
    if (!guard(m, bot)) return;
    S(bot, m.chat.id,
      `💳 *Saldo KiPay*\n${L}\n` +
      `KiPay (versi API publik saat ini) belum menyediakan endpoint\n` +
      `cek saldo/pencairan otomatis.\n\n` +
      `Cek saldo & riwayat pencairan langsung lewat Dashboard:\n` +
      `🔗 https://kipay.id/login`
    );
  });

  bot.onText(/\/pgmutasi/, async (m) => {
    if (!guard(m, bot)) return;
    const deps = db.getAllUsers()
      .flatMap((u) => (u.deposits||[]).filter((d) => d.status==='success')
        .map((d) => ({ ...d, user_id: u.id, user_name: u.first_name||u.username })))
      .sort((a, b) => new Date(b.created_local) - new Date(a.created_local))
      .slice(0, 10);
    if (!deps.length) return S(bot, m.chat.id, 'Belum ada deposit sukses.');
    const lines = deps.map((d, i) =>
      `${i+1}. \`${d.user_id}\` ${d.user_name||'-'}\n *${fmt(d.diterima||d.amount)}* via ${d.issuer||'QRIS'} • ${d.created_local ? new Date(d.created_local).toLocaleDateString('id-ID') : '-'}`
    );
    S(bot, m.chat.id, `💳 *Mutasi Deposit Sukses (10):*\n${L}\n${lines.join('\n\n')}`);
  });

  bot.onText(/\/broadcast (.+)/, async (m, match) => {
    if (!guard(m, bot)) return;
    const text  = match[1];
    const users = db.getAllUsers();
    let ok = 0, fail = 0;
    S(bot, m.chat.id, `📢 Mengirim broadcast ke ${users.length} user...`);
    for (const u of users) {
      try {
        await bot.sendMessage(u.id,
          `📢 *Pengumuman — ManzxyOTP*\n${L}\n\n${text}`,
          { parse_mode: 'Markdown' }
        );
        ok++;
      } catch { fail++; }
      await new Promise(r => setTimeout(r, 60));
    }
    S(bot, m.chat.id, `📢 *Selesai*\n✅ ${ok} terkirim • ❌ ${fail} gagal`);
  });

  // ── LOG CHANNEL COMMANDS ───────────────────────────────────────────────────

  bot.onText(/\/announce (.+)/, (m, match) => {
    if (!guard(m, bot)) return;
    if (!cfg.log_channel_id) return S(bot, m.chat.id, '❌ LOG_CHANNEL_ID belum diset di .env');
    const parts = match[1].split('|');
    if (parts.length < 2)
      return S(bot, m.chat.id, '❌ Format: `/announce <judul> | <isi>`');
    let title = parts[0].trim(), body = parts.slice(1).join('|').trim(), type = 'info';
    for (const p of ['warning:','maintenance:','promo:','info:']) {
      if (title.toLowerCase().startsWith(p)) { type = p.replace(':',''); title = title.slice(p.length).trim(); break; }
    }
    log.logAnnouncement(title, body, type);
    S(bot, m.chat.id, `✅ Pengumuman *"${title}"* terkirim.`);
  });

  bot.onText(/\/update (.+)/, (m, match) => {
    if (!guard(m, bot)) return;
    if (!cfg.log_channel_id) return S(bot, m.chat.id, '❌ LOG_CHANNEL_ID belum diset di .env');
    const parts = match[1].split('|');
    if (parts.length < 2) return S(bot, m.chat.id, '❌ Format: `/update <versi> | <p1> ; <p2>`');
    const version = parts[0].trim();
    const changes = parts[1].split(';').map(c => c.trim()).filter(Boolean);
    log.logSystemUpdate(version, changes);
    S(bot, m.chat.id, `✅ Log update *${version}* (${changes.length} item) terkirim.`);
  });

  bot.onText(/\/dailystats/, (m) => {
    if (!guard(m, bot)) return;
    if (!cfg.log_channel_id) return S(bot, m.chat.id, '❌ LOG_CHANNEL_ID belum diset di .env');
    const st    = db.getStats();
    const users = db.getAllUsers();
    const since = Date.now() - 86400000;
    const newUsers      = users.filter(u => new Date(u.joined_at).getTime() >= since).length;
    const successOrders = users.reduce((s, u) => s + u.orders.filter(o => o.status==='completed').length, 0);
    const cancelOrders  = users.reduce((s, u) => s + u.orders.filter(o => ['cancelled','canceled'].includes(o.status)).length, 0);
    log.logDailyStats({
      totalUsers: st.total_users, newUsers,
      totalOrders: st.totalOrders, successOrders, cancelOrders,
      totalDeposit: st.totalTopup, totalRevenue: st.totalTopup - st.totalRefund,
    });
    S(bot, m.chat.id, '📊 Statistik harian terkirim ke log channel.');
  });

};
