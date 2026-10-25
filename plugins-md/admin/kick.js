// plugins-md/admin/kick.js
module.exports = {
  name: 'kick',
  aliases: ['tendang'],
  description: 'Kick member — reply ke pesan member yang mau dikick',
  groupOnly: true,
  adminOnly: true,
  async run(bot, msg, args, ctx) {
    const target = msg.reply_to_message?.from;
    if (!target) return ctx.reply('Reply ke pesan member yang mau di-kick ya.');
    if (target.is_bot === false && target.id === msg.from.id) {
      return ctx.reply('Gak bisa kick diri sendiri 😄');
    }
    try {
      await bot.banChatMember(msg.chat.id, target.id);
      await bot.unbanChatMember(msg.chat.id, target.id); // biar bisa join lagi nanti (kick, bukan ban permanen)
      ctx.reply(`✅ *${target.first_name || 'Member'}* berhasil dikick dari grup.`);
    } catch (e) {
      ctx.reply(`❌ Gagal kick: ${e.message}\n\n_Pastikan bot adalah admin grup dengan izin "Ban Users"._`);
    }
  },
};
