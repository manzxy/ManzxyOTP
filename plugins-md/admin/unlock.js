// plugins-md/admin/unlock.js
module.exports = {
  name: 'unlock',
  aliases: ['bukakunci'],
  description: 'Buka kunci grup — semua member bisa kirim pesan lagi',
  groupOnly: true,
  adminOnly: true,
  async run(bot, msg, args, ctx) {
    try {
      await bot.setChatPermissions(msg.chat.id, {
        can_send_messages: true, can_send_media_messages: true,
        can_send_polls: true, can_send_other_messages: true,
        can_add_web_page_previews: true, can_change_info: false,
        can_invite_users: true, can_pin_messages: false,
      });
      ctx.reply('🔓 Grup dibuka — semua member bisa kirim pesan lagi.');
    } catch (e) {
      ctx.reply(`❌ Gagal unlock: ${e.message}`);
    }
  },
};
