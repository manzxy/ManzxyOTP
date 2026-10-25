// plugins-md/owner/setlimit.js
// Atur jatah limit HARIAN khusus seorang user (menimpa default free/premium).
//   .setlimit 50      (reply ke user) → jatah user itu jadi 50/hari
//   .setlimit reset   (reply ke user) → balik ke default free/premium
//   .setlimit         (reply ke user) → lihat jatahnya sekarang
module.exports = {
  name: 'setlimit',
  aliases: ['limituser'],
  description: '[Owner] Atur jatah limit harian user — reply pesannya: setlimit <angka|reset>',
  ownerOnly: true,   // disembunyikan dari menu untuk non-owner (pengecekan akses tetap di dalam)
  async run(bot, msg, args, ctx) {
    const limitDb = require('../../src/md/db/limit');
    const p = ctx.group.prefix;
    if (!ctx.isOwner(msg.from.id)) return ctx.reply('⚠️ Command ini cuma buat owner bot.');

    const target = msg.reply_to_message?.from;
    if (!target) return ctx.reply(`Reply ke pesan user yang mau diatur limitnya.\n\n\`${p}setlimit 50\` — jatah 50/hari\n\`${p}setlimit reset\` — balik ke default\n\`${p}setlimit\` — lihat jatah`);

    const name = target.first_name || 'User';
    const arg  = (args[0] || '').toLowerCase();

    if (!arg) {
      const st = limitDb.status(target.id);
      return ctx.reply(`🎟️ *${name}* (${limitDb.tier(st)}): ${limitDb.formatLeft(st)} hari ini${st.custom ? ' — jatah khusus' : ' — jatah default'}\nReset: ${limitDb.formatReset(st)}`);
    }
    if (arg === 'reset') {
      const st = limitDb.setMax(target.id, null);
      return ctx.reply(`✅ Jatah *${name}* balik ke default (${st.max}/hari).`);
    }

    const n = Number(arg);
    if (!Number.isInteger(n) || n < 0 || n > 100000) return ctx.reply('⚠️ Jumlah harus bilangan bulat 0–100000, atau `reset`.');
    const st = limitDb.setMax(target.id, n);
    ctx.reply(`✅ Jatah harian *${name}* diatur ke *${n}*. Hari ini terpakai ${st.used}, sisa ${limitDb.formatLeft(st)}.`);
  },
};
