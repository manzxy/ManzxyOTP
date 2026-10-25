// plugins-md/plugin/delplugins.js
module.exports = {
  name: 'delplugins',
  aliases: ['delplugin', 'hapusplugin'],
  description: '[Owner] Hapus plugin (di-backup dulu)',
  ownerOnly: true,   // disembunyikan dari menu untuk non-owner (pengecekan akses tetap di dalam)
  async run(bot, msg, args, ctx) {
    return require('../../src/md/services/pluginStore').remove(bot, msg, args, ctx);
  },
};
