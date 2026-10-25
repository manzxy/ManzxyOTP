// plugins-md/admin/mute.js
module.exports = {
  name: 'mute',
  aliases: ['bisukan'],
  description: 'Bisukan member (gak bisa kirim pesan) — reply pesannya',
  groupOnly: true,
  adminOnly: true,
  async run(bot, msg, args, ctx) {
    const target = msg.reply_to_message?.from;
    if (!target) return ctx.reply('Reply ke pesan member yang mau di-mute.');
    try {
      await bot.restrictChatMember(msg.chat.id, target.id, {
        can_send_messages: false, can_send_media_messages: false,
        can_send_polls: false, can_send_other_messages: false,
      });
      ctx.reply(`🔇 *${target.first_name || 'Member'}* dibisukan di grup ini.`);
    } catch (e) {
      ctx.reply(`❌ Gagal mute: ${e.message}\n\n_Pastikan bot adalah admin grup dengan izin "Ban Users"._`);
    }
  },
};
