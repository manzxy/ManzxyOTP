// plugins-md/umum/id.js
module.exports = {
  name: 'id',
  description: 'Lihat Chat ID grup ini & User ID kamu (atau user yang di-reply)',
  async run(bot, msg, args, ctx) {
    const target = msg.reply_to_message?.from || msg.from;
    ctx.reply(
      `🆔 *ID Info*\n─────────────────────────\n` +
      `┌ 💬 Chat ID  \`${msg.chat.id}\`\n` +
      `└ 👤 User ID  \`${target.id}\`${target.username ? ` (@${target.username})` : ''}`
    );
  },
};
