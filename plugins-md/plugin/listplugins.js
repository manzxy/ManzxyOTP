// plugins-md/plugin/listplugins.js
module.exports = {
  name: 'listplugins',
  aliases: ['plugins', 'getplugins'],
  description: '[Owner] Daftar plugin per kategori / kirim file plugin',
  ownerOnly: true,   // disembunyikan dari menu untuk non-owner (pengecekan akses tetap di dalam)
  async run(bot, msg, args, ctx) {
    return require('../../src/md/services/pluginStore').list(bot, msg, args, ctx);
  },
};
