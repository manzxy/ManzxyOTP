// plugins-md/admin/lock.js
module.exports = {
  name: 'lock',
  aliases: ['kunci'],
  description: 'Kunci grup — cuma admin yang bisa kirim pesan',
  groupOnly: true,
  adminOnly: true,
  async run(bot, msg, args, ctx) {
    try {
      await bot.setChatPermissions(msg.chat.id, {
        can_send_messages: false, can_send_media_messages: false,
        can_send_polls: false, can_send_other_messages: false,
        can_add_web_page_previews: false, can_change_info: false,
        can_invite_users: false, can_pin_messages: false,
      });
      ctx.reply('🔒 Grup dikunci — cuma admin yang bisa kirim pesan sekarang.');
    } catch (e) {
      ctx.reply(`❌ Gagal lock: ${e.message}\n\n_Pastikan bot adalah admin grup dengan izin "Ban Users"._`);
    }
  },
};
