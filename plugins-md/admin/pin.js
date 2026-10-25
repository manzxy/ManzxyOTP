// plugins-md/admin/pin.js
module.exports = {
  name: 'pin',
  description: 'Pin pesan — reply pesan yang mau di-pin',
  groupOnly: true,
  adminOnly: true,
  async run(bot, msg, args, ctx) {
    if (!msg.reply_to_message) return ctx.reply('Reply ke pesan yang mau di-pin.');
    try {
      await bot.pinChatMessage(msg.chat.id, msg.reply_to_message.message_id);
      ctx.reply('📌 Pesan berhasil di-pin.');
    } catch (e) {
      ctx.reply(`❌ Gagal pin: ${e.message}\n\n_Pastikan bot adalah admin grup dengan izin "Pin Messages"._`);
    }
  },
};
