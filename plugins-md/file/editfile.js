// plugins-md/file/editfile.js
module.exports = {
  name: 'editfile',
  aliases: ['gantifile'],
  description: '[Owner] Timpa file tersimpan atau ganti nama: editfile lama baru',
  ownerOnly: true,   // disembunyikan dari menu untuk non-owner (pengecekan akses tetap di dalam)
  async run(bot, msg, args, ctx) {
    return require('../../src/md/services/fileStore').save(bot, msg, args, ctx, 'edit');
  },
};
