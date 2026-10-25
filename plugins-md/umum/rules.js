// plugins-md/umum/rules.js
module.exports = {
  name: 'rules',
  aliases: ['peraturan'],
  description: 'Lihat peraturan grup — admin bisa set dengan: rules set <teks>',
  groupOnly: true,
  async run(bot, msg, args, ctx) {
    const mddb = ctx.db;

    if ((args[0] || '').toLowerCase() === 'set') {
      const isGroupAdmin = ['administrator', 'creator'].includes(
        (await bot.getChatMember(msg.chat.id, msg.from.id).catch(() => ({}))).status
      );
      if (!isGroupAdmin) return ctx.reply('⚠️ Cuma admin grup yang bisa ubah peraturan.');

      const text = args.slice(1).join(' ').trim();
      if (!text) return ctx.reply(`Pakai: \`${ctx.group.prefix}rules set <teks peraturan>\``);

      const group = ctx.group;
      group.rules = text;
      mddb.saveGroup(group);
      return ctx.reply('✅ Peraturan grup berhasil diperbarui.');
    }

    ctx.reply(ctx.group.rules
      ? `📜 *Peraturan Grup*\n─────────────────────────\n${ctx.group.rules}`
      : `📜 Belum ada peraturan grup di-set.\n\nAdmin bisa set dengan \`${ctx.group.prefix}rules set <teks>\``);
  },
};
