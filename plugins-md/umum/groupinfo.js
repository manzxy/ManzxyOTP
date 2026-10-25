// plugins-md/umum/groupinfo.js
module.exports = {
  name: 'groupinfo',
  aliases: ['infogrup'],
  description: 'Info & statistik grup ini',
  groupOnly: true,
  async run(bot, msg, args, ctx) {
    const [chat, memberCount] = await Promise.all([
      bot.getChat(msg.chat.id),
      bot.getChatMemberCount(msg.chat.id).catch(() => '?'),
    ]);

    ctx.reply(
      `ℹ️ *Info Grup*\n─────────────────────────\n` +
      `┌ 📛 Nama        ${chat.title}\n` +
      `├ 🆔 Chat ID     \`${chat.id}\`\n` +
      `├ 👥 Total member ${memberCount}\n` +
      `├ 🔗 Prefix      \`${ctx.group.prefix}\`\n` +
      `├ 🔇 Antilink    ${ctx.group.antilink ? 'ON' : 'OFF'}\n` +
      `└ 👋 Welcome     ${ctx.group.welcome ? 'ON' : 'OFF'}`
    );
  },
};
