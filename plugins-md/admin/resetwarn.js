// plugins-md/admin/resetwarn.js
module.exports = {
  name: 'resetwarn',
  aliases: ['hapuswarn'],
  description: 'Reset peringatan member jadi 0 — reply pesannya',
  groupOnly: true,
  adminOnly: true,
  async run(bot, msg, args, ctx) {
    const mddb = ctx.db;
    const target = msg.reply_to_message?.from;
    if (!target) return ctx.reply('Reply ke pesan member yang mau direset peringatannya.');
    mddb.resetWarn(msg.chat.id, target.id);
    ctx.reply(`✅ Peringatan *${target.first_name || 'Member'}* direset ke 0.`);
  },
};
