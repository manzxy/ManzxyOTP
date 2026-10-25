// plugins-md/owner/premium.js
// Premium melekat ke USER (ikut orangnya ke grup manapun), BUKAN ke grup.
// Cek status: siapa aja boleh. Ubah status: cuma owner bot (ADMIN_IDS, BUKAN admin grup)
// — reply ke pesan user targetnya. Efek premium: jatah limit harian lebih besar (MD_LIMIT_PREMIUM).
module.exports = {
  name: 'premium',
  description: 'Cek status premium (atau [Owner] atur premium user — reply pesannya)',
  async run(bot, msg, args, ctx) {
    const limitDb = require('../../src/md/db/limit');
    const action  = (args[0] || '').toLowerCase();
    const p       = ctx.group.prefix;

    // Siapa aja boleh cek status — diri sendiri, atau user yang di-reply.
    if (!action || action === 'status') {
      const target = msg.reply_to_message?.from || msg.from;
      const u  = ctx.db.getUser(target.id);
      const st = limitDb.status(target.id);
      const who = target.id === msg.from.id ? 'Kamu' : (target.first_name || 'User ini');
      return ctx.reply(
        `💎 ${who}: *${limitDb.tier(st)}*` +
        (u.premium_until && st.premium ? `\nBerlaku sampai ${new Date(u.premium_until).toLocaleDateString('id-ID')}` : '') +
        `\n🎟️ Limit hari ini: ${limitDb.formatLeft(st)}`
      );
    }

    // Selain cek status, semua perubahan cuma boleh owner bot.
    if (!ctx.isOwner(msg.from.id)) return ctx.reply('⚠️ Command ini cuma buat owner bot.');

    const target = msg.reply_to_message?.from;
    if (!target) {
      return ctx.reply(
        `Reply ke pesan user yang mau diatur status premium-nya, lalu:\n\n` +
        `\`${p}premium on [hari]\` — contoh: on 30\n` +
        `\`${p}premium permanen\`\n` +
        `\`${p}premium off\``
      );
    }

    const name = target.first_name || 'User';
    if (action === 'on') {
      const days = Number(args[1]) || 30;
      const u = ctx.db.setPremium(target.id, true, days);
      return ctx.reply(`✅ *${name}* sekarang PREMIUM sampai *${new Date(u.premium_until).toLocaleDateString('id-ID')}* (${days} hari).`);
    }
    if (action === 'permanen') {
      ctx.db.setPremium(target.id, true, null);
      return ctx.reply(`✅ *${name}* sekarang PREMIUM permanen (tanpa batas waktu).`);
    }
    if (action === 'off') {
      ctx.db.setPremium(target.id, false, null);
      return ctx.reply(`✅ Premium *${name}* dicabut, balik ke FREE.`);
    }

    ctx.reply(`Pakai: \`${p}premium on [hari]\` / \`permanen\` / \`off\` (reply ke user-nya dulu)`);
  },
};
