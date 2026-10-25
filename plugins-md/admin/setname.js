// plugins-md/admin/setname.js
module.exports = {
  name: 'setname',
  aliases: ['ubahnama'],
  description: 'Ganti nama grup — contoh: setname Nama Baru Grup',
  groupOnly: true,
  adminOnly: true,
  async run(bot, msg, args, ctx) {
    const name = args.join(' ').trim();
    if (!name) return ctx.reply(`Pakai: \`${ctx.group.prefix}setname <nama baru>\``);
    try {
      await bot.setChatTitle(msg.chat.id, name);
      ctx.reply(`✅ Nama grup diganti jadi *${name}*.`);
    } catch (e) {
      ctx.reply(`❌ Gagal ganti nama: ${e.message}\n\n_Pastikan bot adalah admin grup dengan izin "Change Group Info"._`);
    }
  },
};
