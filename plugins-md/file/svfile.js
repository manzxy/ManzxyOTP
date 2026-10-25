// plugins-md/file/svfile.js
module.exports = {
  name: 'svfile',
  aliases: ['savefile'],
  description: '[Owner] Simpan file ke server — reply/kirim file + nama',
  ownerOnly: true,   // disembunyikan dari menu untuk non-owner (pengecekan akses tetap di dalam)
  async run(bot, msg, args, ctx) {
    return require('../../src/md/services/fileStore').save(bot, msg, args, ctx, 'create');
  },
};
