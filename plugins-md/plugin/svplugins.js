// plugins-md/plugin/svplugins.js
module.exports = {
  name: 'svplugins',
  aliases: ['saveplugin', 'addplugin'],
  description: '[Owner] Simpan plugin baru — svplugins <kategori>/<nama> (reply file .js / kode)',
  ownerOnly: true,   // disembunyikan dari menu untuk non-owner (pengecekan akses tetap di dalam)
  async run(bot, msg, args, ctx) {
    return require('../../src/md/services/pluginStore').save(bot, msg, args, ctx, 'create');
  },
};
