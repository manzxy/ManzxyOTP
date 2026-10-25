// plugins-md/admin/unmute.js
module.exports = {
  name: 'unmute',
  aliases: ['bukasuara'],
  description: 'Lepas bisu member — reply pesannya',
  groupOnly: true,
  adminOnly: true,
  async run(bot, msg, args, ctx) {
    const target = msg.reply_to_message?.from;
    if (!target) return ctx.reply('Reply ke pesan member yang mau di-unmute.');
    try {
      await bot.restrictChatMember(msg.chat.id, target.id, {
        can_send_messages: true, can_send_media_messages: true,
        can_send_polls: true, can_send_other_messages: true,
      });
      ctx.reply(`🔊 *${target.first_name || 'Member'}* sudah bisa chat lagi.`);
    } catch (e) {
      ctx.reply(`❌ Gagal unmute: ${e.message}`);
    }
  },
};
