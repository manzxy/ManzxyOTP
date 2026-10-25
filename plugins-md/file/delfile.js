// plugins-md/file/delfile.js
module.exports = {
  name: 'delfile',
  aliases: ['hapusfile'],
  description: '[Owner] Hapus file tersimpan',
  ownerOnly: true,   // disembunyikan dari menu untuk non-owner (pengecekan akses tetap di dalam)
  async run(bot, msg, args, ctx) {
    return require('../../src/md/services/fileStore').remove(bot, msg, args, ctx);
  },
};
