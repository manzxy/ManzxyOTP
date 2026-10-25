// plugins-md/admin/tagall.js
// CATATAN: Telegram Bot API tidak punya endpoint untuk ambil SEMUA member
// grup (keterbatasan platform, bukan bug) — jadi command ini nge-tag member
// yang sudah pernah kelihatan aktif (kirim pesan) sejak bot gabung, yang
// dicatat otomatis oleh dispatcher tiap ada pesan masuk.
module.exports = {
  name: 'tagall',
  aliases: ['tagsemua'],
  description: 'Mention semua member yang pernah aktif di grup ini',
  groupOnly: true,
  adminOnly: true,
  async run(bot, msg, args, ctx) {
    const ids = Object.keys(ctx.group.members || {});
    if (!ids.length) return ctx.reply('Belum ada member aktif yang tercatat.');

    const note = args.join(' ');
    const names = ids.map((id) => `[${ctx.group.members[id].first_name || 'member'}](tg://user?id=${id})`);

    // Kirim per 30 mention supaya gak kena limit panjang pesan Telegram
    const CHUNK = 30;
    for (let i = 0; i < names.length; i += CHUNK) {
      const chunk = names.slice(i, i + CHUNK).join(', ');
      await bot.sendMessage(msg.chat.id, `${note ? `${note}\n\n` : ''}${chunk}`, { parse_mode: 'Markdown' }).catch(() => {});
    }
  },
};
