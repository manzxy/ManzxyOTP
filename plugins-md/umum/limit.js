// plugins-md/umum/limit.js
module.exports = {
  name: 'limit',
  aliases: ['ceklimit', 'sisalimit'],
  description: 'Cek sisa limit harian kamu',
  async run(bot, msg, args, ctx) {
    const limitDb = require('../../src/md/db/limit');
    const st = ctx.limit.status();
    ctx.reply(
      `🎟️ *Limit Kamu*\n─────────────────────────\n` +
      `Status: *${limitDb.tier(st)}*\n` +
      `Sisa hari ini: *${limitDb.formatLeft(st)}*\n` +
      `Reset: ${limitDb.formatReset(st)}`
    );
  },
};
