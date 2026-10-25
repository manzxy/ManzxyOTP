// plugins-md/umum/menu.js
// MENU OTOMATIS — dibangun dari plugin yang terdeteksi (ctx.plugins), bukan daftar manual.
//   • Tambah plugin/kategori baru → langsung muncul di menu, tanpa edit file ini.
//   • Tombol hanya yang perlu: 1 tombol per kategori + "Kembali". Selebihnya teks.
//   • Plugin bertanda ownerOnly disembunyikan dari non-owner.
//   • Plugin boleh punya `status(group)` → ditampilkan di samping command (mis. ON/OFF).
//
//   .menu            → daftar kategori (tombol)
//   .menu <kategori> → langsung ke satu kategori, mis. .menu admin
const PREFIX = 'mn';   // callback_data: mdp:mn:<kategori|home>

// Ikon & nama tampilan kategori yang dikenal. Folder baru yang tidak ada di sini
// tetap muncul otomatis (ikon 📂, nama diambil dari nama folder).
const META = {
  umum:       ['ℹ️', 'Umum'],
  admin:      ['👮', 'Admin'],
  setting:    ['⚙️', 'Pengaturan'],
  downloader: ['📥', 'Downloader'],
  file:       ['🗂️', 'File'],
  plugin:     ['🧩', 'Plugin'],
  owner:      ['💎', 'Premium & Owner'],
};
const ORDER = Object.keys(META);

const label = (cat) => {
  const [icon, name] = META[cat] || ['📂', cat.charAt(0).toUpperCase() + cat.slice(1)];
  return { icon, name };
};

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/** Kategori → daftar plugin yang boleh dilihat user ini. */
function collect(plugins, isOwner) {
  const byCat = new Map();
  for (const p of new Set(plugins.values())) {
    if (p.ownerOnly && !isOwner) continue;
    const cat = p.category || 'lain';
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat).push(p);
  }
  for (const list of byCat.values()) list.sort((a, b) => a.name.localeCompare(b.name));
  return [...byCat.keys()]
    .sort((a, b) => {
      const ia = ORDER.indexOf(a), ib = ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
    })
    .map((cat) => ({ cat, list: byCat.get(cat) }));
}

function homeView(groups, group) {
  const total = groups.reduce((n, g) => n + g.list.length, 0);
  return {
    text:
      `🧩 *ManzxyOTP — Menu*\n─────────────────────────\n` +
      `${total} command • prefix \`${group.prefix}\` atau \`/\`\n\n` +
      `Pilih kategori:`,
    markup: {
      inline_keyboard: chunk(groups.map(({ cat, list }) => {
        const { icon, name } = label(cat);
        return { text: `${icon} ${name} (${list.length})`, callback_data: `mdp:${PREFIX}:${cat}` };
      }), 2),
    },
  };
}

function categoryView(entry, group) {
  const { icon, name } = label(entry.cat);
  const lines = entry.list.map((p) => {
    const st    = typeof p.status === 'function' ? p.status(group) : null;
    const extra = [
      p.adminOnly ? 'admin' : null,
      p.limit ? `${p.limit} limit` : null,
      st,
    ].filter(Boolean);
    return `\`${group.prefix}${p.name}\` — ${p.description || '-'}${extra.length ? ` _(${extra.join(' • ')})_` : ''}`;
  });
  return {
    text: `${icon} *${name}*\n─────────────────────────\n${lines.join('\n')}`,
    markup: { inline_keyboard: [[{ text: '🔙 Kembali', callback_data: `mdp:${PREFIX}:home` }]] },
  };
}

module.exports = {
  name: 'menu',
  aliases: ['start', 'help', 'commands'],
  description: 'Menu otomatis dari semua plugin — .menu <kategori> untuk langsung buka',
  callbackPrefix: PREFIX,

  async run(bot, msg, args, ctx) {
    const groups = collect(ctx.plugins, ctx.isOwner(msg.from.id));
    const want   = (args[0] || '').toLowerCase();
    const hit    = want && groups.find((g) => g.cat === want || label(g.cat).name.toLowerCase() === want);
    const view   = hit ? categoryView(hit, ctx.group) : homeView(groups, ctx.group);
    ctx.reply(view.text, { reply_markup: view.markup });
  },

  // Tombol: parts[0] = 'home' | nama kategori
  async onCallback(bot, q, parts, ctx) {
    const groups = collect(ctx.plugins, ctx.isOwner(q.from.id));
    const hit    = groups.find((g) => g.cat === parts[0]);
    const view   = hit ? categoryView(hit, ctx.group) : homeView(groups, ctx.group);
    await bot.editMessageText(view.text, {
      chat_id: q.message.chat.id,
      message_id: q.message.message_id,
      parse_mode: 'Markdown',
      reply_markup: view.markup,
    }).catch(() => {});
  },
};
