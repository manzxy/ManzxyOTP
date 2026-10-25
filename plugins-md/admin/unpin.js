// plugins-md/admin/unpin.js
module.exports = {
  name: 'unpin',
  description: 'Lepas semua pesan yang di-pin di grup ini',
  groupOnly: true,
  adminOnly: true,
  async run(bot, msg, args, ctx) {
    try {
      await bot.unpinAllChatMessages(msg.chat.id);
      ctx.reply('📌 Semua pesan di-pin sudah dilepas.');
    } catch (e) {
      ctx.reply(`❌ Gagal unpin: ${e.message}`);
    }
  },
};
