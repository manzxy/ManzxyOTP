// plugins-md/admin/promote.js
module.exports = {
  name: 'promote',
  aliases: ['naikadmin'],
  description: 'Jadikan member sebagai admin grup — reply pesannya',
  groupOnly: true,
  adminOnly: true,
  async run(bot, msg, args, ctx) {
    const target = msg.reply_to_message?.from;
    if (!target) return ctx.reply('Reply ke pesan member yang mau dijadikan admin.');
    try {
      await bot.promoteChatMember(msg.chat.id, target.id, {
        can_change_info: true, can_delete_messages: true, can_invite_users: true,
        can_restrict_members: true, can_pin_messages: true,
      });
      ctx.reply(`✅ *${target.first_name || 'Member'}* sekarang jadi admin grup.`);
    } catch (e) {
      ctx.reply(`❌ Gagal promote: ${e.message}\n\n_Pastikan bot adalah admin grup dengan izin "Add New Admins"._`);
    }
  },
};
