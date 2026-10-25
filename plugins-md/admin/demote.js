// plugins-md/admin/demote.js
module.exports = {
  name: 'demote',
  aliases: ['turunadmin'],
  description: 'Cabut status admin member — reply pesannya',
  groupOnly: true,
  adminOnly: true,
  async run(bot, msg, args, ctx) {
    const target = msg.reply_to_message?.from;
    if (!target) return ctx.reply('Reply ke pesan admin yang mau diturunkan.');
    try {
      await bot.promoteChatMember(msg.chat.id, target.id, {
        can_change_info: false, can_delete_messages: false, can_invite_users: false,
        can_restrict_members: false, can_pin_messages: false,
      });
      ctx.reply(`✅ *${target.first_name || 'Member'}* bukan admin lagi.`);
    } catch (e) {
      ctx.reply(`❌ Gagal demote: ${e.message}`);
    }
  },
};
