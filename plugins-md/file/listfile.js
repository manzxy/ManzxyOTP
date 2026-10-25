// plugins-md/file/listfile.js
module.exports = {
  name: 'listfile',
  aliases: ['files', 'getfile'],
  description: '[Owner] Daftar file tersimpan / kirim file-nya',
  ownerOnly: true,   // disembunyikan dari menu untuk non-owner (pengecekan akses tetap di dalam)
  async run(bot, msg, args, ctx) {
    return require('../../src/md/services/fileStore').list(bot, msg, args, ctx);
  },
};
