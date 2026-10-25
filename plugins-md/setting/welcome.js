// plugins-md/setting/welcome.js
// Command on/off + pesan sambutannya (onNewMember) ada di SATU file ini.
module.exports = {
  name: 'welcome',
  aliases: ['sambutan'],
  description: 'on/off: pesan sambutan otomatis untuk member baru',
  groupOnly: true,
  adminOnly: true,
  status: (group) => (group.welcome ? 'ON' : 'OFF'),   // tampil di menu

  async run(bot, msg, args, ctx) {
    const mode = (args[0] || '').toLowerCase();

    if (!['on', 'off'].includes(mode)) {
      return ctx.reply(`Welcome message saat ini: *${ctx.group.welcome ? 'ON' : 'OFF'}*\n\nPakai: \`${ctx.group.prefix}welcome on\` atau \`off\``);
    }

    const group = ctx.group;
    group.welcome = mode === 'on';
    ctx.db.saveGroup(group);
    ctx.reply(`✅ Welcome message sekarang *${mode.toUpperCase()}*.`);
  },

  // Hook pasif: dipanggil dispatcher saat ada member baru masuk grup.
  async onNewMember(bot, msg, ctx) {
    if (!ctx.group.welcome) return;
    for (const member of msg.new_chat_members) {
      ctx.reply(`👋 Selamat datang, *${member.first_name || 'member baru'}*!\nSemoga betah di grup ini. 🎉`);
    }
  },
};
