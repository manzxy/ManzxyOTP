// plugins-md/setting/setprefix.js
module.exports = {
  name: 'setprefix',
  aliases: ['ubahprefix'],
  description: 'Ganti prefix command di grup ini — contoh: setprefix !',
  groupOnly: true,
  adminOnly: true,
  async run(bot, msg, args, ctx) {
    const mddb = ctx.db;
    const next = args[0];

    if (!next || next.length > 3 || /\s/.test(next)) {
      return ctx.reply(`Prefix sekarang: \`${ctx.group.prefix}\`\n\nPakai: \`${ctx.group.prefix}setprefix !\` (maks 3 karakter, tanpa spasi)`);
    }

    const group = ctx.group;
    group.prefix = next;
    mddb.saveGroup(group);
    ctx.reply(`✅ Prefix diganti jadi \`${next}\`. Contoh: \`${next}help\``);
  },
};
