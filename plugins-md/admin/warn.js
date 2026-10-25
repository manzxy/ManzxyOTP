// plugins-md/admin/warn.js
const MAX_WARN = 3;

module.exports = {
  name: 'warn',
  aliases: ['peringatan'],
  description: 'Beri peringatan ke member — auto-kick di peringatan ke-3',
  groupOnly: true,
  adminOnly: true,
  async run(bot, msg, args, ctx) {
    const mddb = ctx.db;
    const target = msg.reply_to_message?.from;
    if (!target) return ctx.reply('Reply ke pesan member yang mau diberi peringatan.');

    const count = mddb.addWarn(msg.chat.id, target.id);

    if (count >= MAX_WARN) {
      try {
        await bot.banChatMember(msg.chat.id, target.id);
        await bot.unbanChatMember(msg.chat.id, target.id);
        mddb.resetWarn(msg.chat.id, target.id);
        return ctx.reply(`🚫 *${target.first_name || 'Member'}* kena kick otomatis (sudah ${MAX_WARN}x peringatan).`);
      } catch (e) {
        return ctx.reply(`⚠️ Sudah ${count}x peringatan tapi gagal auto-kick: ${e.message}`);
      }
    }

    ctx.reply(`⚠️ *${target.first_name || 'Member'}* diberi peringatan (${count}/${MAX_WARN}).`);
  },
};
