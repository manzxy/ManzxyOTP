// plugins-md/setting/antilink.js
// Command on/off + filter pasifnya (onMessage) ada di SATU file ini.
const LINK_RE = /(https?:\/\/|t\.me\/|telegram\.me\/)\S+/i;

module.exports = {
  name: 'antilink',
  description: 'on/off: hapus otomatis pesan berisi link dari non-admin',
  groupOnly: true,
  adminOnly: true,
  status: (group) => (group.antilink ? 'ON' : 'OFF'),   // tampil di menu

  async run(bot, msg, args, ctx) {
    const mode = (args[0] || '').toLowerCase();

    if (!['on', 'off'].includes(mode)) {
      return ctx.reply(`Antilink saat ini: *${ctx.group.antilink ? 'ON' : 'OFF'}*\n\nPakai: \`${ctx.group.prefix}antilink on\` atau \`off\``);
    }

    const group = ctx.group;
    group.antilink = mode === 'on';
    ctx.db.saveGroup(group);
    ctx.reply(`✅ Antilink sekarang *${mode.toUpperCase()}*.`);
  },

  // Hook pasif: dipanggil dispatcher untuk setiap pesan BUKAN command.
  async onMessage(bot, msg, ctx) {
    const text = msg.text ?? msg.caption;
    if (!ctx.group.antilink || !text || !['group', 'supergroup'].includes(msg.chat.type)) return;
    if (!LINK_RE.test(text)) return;
    if (await ctx.isGroupAdmin(msg.from.id)) return;

    bot.deleteMessage(msg.chat.id, msg.message_id).catch(() => {});
    ctx.reply(`🚫 Link dari *${msg.from.first_name || 'member'}* dihapus (antilink aktif).`);
    return true;
  },
};
