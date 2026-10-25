// plugins-md/plugin/editplugins.js
module.exports = {
  name: 'editplugins',
  aliases: ['editplugin'],
  description: '[Owner] Timpa plugin yang sudah ada (file lama di-backup)',
  ownerOnly: true,   // disembunyikan dari menu untuk non-owner (pengecekan akses tetap di dalam)
  async run(bot, msg, args, ctx) {
    return require('../../src/md/services/pluginStore').save(bot, msg, args, ctx, 'edit');
  },
};
