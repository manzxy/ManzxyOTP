// src/handlers/menu.js
'use strict';

const recommend = require('../utils/recommend');
const db      = require('../utils/db');
const msg     = require('../utils/messages');
const kb      = require('../utils/keyboard');
const log     = require('../utils/logger');
const cfg     = require('../../config');
const botinfo = require('../utils/botinfo');
const { fmt, isAdmin }                               = require('../utils/helpers');
const { checkMembership, sendJoinPrompt }            = require('../utils/joincheck');
const { isMaintenanceActive, maintenanceInfo }       = require('../utils/maintenance');

const S = (bot, cid, text, extra = {}) =>
  bot.sendMessage(cid, text, { parse_mode: 'Markdown', ...extra }).catch(() => {});

const guard = async (bot, m, fn) => {
  if (!isAdmin(m.from.id) && isMaintenanceActive())
    return S(bot, m.chat.id, msg.maintenanceMsg(maintenanceInfo()));
  const { passed, notJoined } = await checkMembership(bot, m.from.id);
  if (!passed) return sendJoinPrompt(bot, m.chat.id, notJoined);
  return fn();
};

module.exports = (bot) => {

  // /start [ref<id>] dan /menu berbagi logika yang sama; hanya /start yang
  // bisa membawa payload referral (dikirim Telegram sebagai teks setelah spasi).
  const openMenu = async (m, refPayload) => {
    if (!isAdmin(m.from.id) && isMaintenanceActive())
      return S(bot, m.chat.id, msg.maintenanceMsg(maintenanceInfo()));
    const { passed, notJoined } = await checkMembership(bot, m.from.id);
    if (!passed) return sendJoinPrompt(bot, m.chat.id, notJoined);

    const isNew = db.isNewUser(m.from.id);
    db.updateUserInfo(m.from.id, { username: m.from.username, first_name: m.from.first_name, last_name: m.from.last_name });

    if (isNew) {
      db.markUserSeen(m.from.id);
      log.logUserStart(db.getUser(m.from.id));

      // ── Referral: user baru buka bot lewat link referral teman ────────────
      if (refPayload && /^ref\d+$/.test(refPayload)) {
        const referrerId = refPayload.slice(3);
        if (referrerId !== String(m.from.id) && db.userExists(referrerId)) {
          const credited = db.addReferral(referrerId, m.from.id, cfg.referral.bonus);
          if (credited !== null) {
            const referrer = db.getUser(referrerId);
            bot.sendMessage(referrerId,
              msg.referralBonusNotify(cfg.referral.bonus, m.from, referrer.referral_count),
              { parse_mode: 'Markdown' }
            ).catch(() => {});
          }
        }
      }
    }

    S(bot, m.chat.id, msg.welcome(db.getUser(m.from.id), process.uptime(), isAdmin(m.from.id), db.getAllUsers().length, recommend.promo(m.from.id)), { reply_markup: kb.mainMenu() });
  };

  bot.onText(/\/start(?:\s+(\S+))?/, (m, match) => openMenu(m, match[1]));
  bot.onText(/\/menu\b/, (m) => openMenu(m, null));

  bot.onText(/\/saldo/, async (m) => {
    await guard(bot, m, () => {
      const u   = db.getUser(m.from.id);
      const dep = (u.deposits || []).filter((d) => d.status === 'success').reduce((s, d) => s + (d.diterima || 0), 0);
      S(bot, m.chat.id,
        `💰 *Saldo Akun*\n─────────────────────────\n` +
        `Saldo aktif *${fmt(u.balance)}*\n` +
        `Total deposited ${fmt(dep)}\n\nTekan *💳 Isi Saldo* untuk top-up via QRIS.`
      );
    });
  });

  bot.onText(/\/profil/, async (m) => {
    await guard(bot, m, () =>
      S(bot, m.chat.id, msg.profile(db.getUser(m.from.id), isAdmin(m.from.id)), { reply_markup: kb.profileMenu() }));
  });

  bot.onText(/\/level/, async (m) => {
    await guard(bot, m, () =>
      S(bot, m.chat.id, msg.levelInfo(db.getUser(m.from.id), isAdmin(m.from.id)), { reply_markup: kb.backMainMenu() }));
  });

  bot.onText(/\/history/, async (m) => {
    await guard(bot, m, () =>
      S(bot, m.chat.id, msg.historyOrder(db.getUser(m.from.id).orders), { reply_markup: kb.backMainMenu() }));
  });

  bot.onText(/\/deposit/, async (m) => {
    await guard(bot, m, () =>
      S(bot, m.chat.id,
        `💳 *Isi Saldo*\n─────────────────────────\nPilih nominal deposit via QRIS.\nSaldo masuk otomatis setelah bayar. ✅`,
        { reply_markup: kb.depositAmountMenu() })
    );
  });

  bot.onText(/\/help/, async (m) => {
    await guard(bot, m, () =>
      S(bot, m.chat.id, msg.helpText(), { reply_markup: kb.helpMenu() }));
  });

  bot.onText(/\/referral/, async (m) => {
    await guard(bot, m, () =>
      S(bot, m.chat.id, msg.referralInfo(db.getUser(m.from.id), botinfo.getUsername(), cfg.referral.bonus), { reply_markup: kb.backMainMenu() }));
  });

  bot.onText(/\/privasi/, async (m) => {
    await guard(bot, m, () =>
      S(bot, m.chat.id, msg.privacyPolicy(), { reply_markup: kb.backMainMenu() }));
  });
};
