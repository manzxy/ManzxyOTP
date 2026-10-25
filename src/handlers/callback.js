// src/handlers/callback.js — ManzxyOTP (production-ready)
'use strict';

const db      = require('../utils/db');
const dz      = require('../providers/ditznesia');
const recommend = require('../utils/recommend');
const cancelOrderSafe = require('../utils/orderCancel');
const pgApi   = require('../providers/kipay');
const { verifyDeposit } = require('../utils/depositVerify');
const msg     = require('../utils/messages');
const kb      = require('../utils/keyboard');
const log     = require('../utils/logger');
const session = require('../utils/session');
const cfg     = require('../../config');
const botinfo = require('../utils/botinfo');
const QRCode  = require('qrcode');

const { fmt, isAdmin, paginate, applyMarkup, calcPrice, getUserLevel } = require('../utils/helpers');
const { checkMembership, sendJoinPrompt }            = require('../utils/joincheck');
const { isMaintenanceActive, maintenanceInfo }       = require('../utils/maintenance');

const S = (bot, cid, text, opts = {}) =>
  bot.sendMessage(cid, text, { parse_mode: 'Markdown', ...opts }).catch(() => {});
const E = (bot, cid, mid, text, opts = {}) =>
  bot.editMessageText(text, { chat_id: cid, message_id: mid, parse_mode: 'Markdown', ...opts }).catch(() => {});

const waitingInput = new Map();

// Hilangkan prefix teknis "[DZ:konteks]" sebelum pesan error ditampilkan ke user
const clean = (m) => String(m || '').replace(/^\[DZ:[^\]]*\]\s*/, '');

// ── View builder katalog (dipakai callback & pencarian teks) ────────────────
const countryView = (uid, page = 0) => {
  const { countries, server } = session.get(uid);
  if (!countries?.length) throw new Error('Sesi habis. Buka katalog ulang.');
  const { total, pages, current } = paginate(countries, page, cfg.page_size.countries);
  return { text: msg.countriesHeader(`Server ${server}`, total, current, pages), markup: kb.countriesMenu(countries, page) };
};

const serviceView = (uid, page = 0) => {
  const { services, server, countries, ctyIdx } = session.get(uid);
  const country = countries?.[ctyIdx];
  if (!services?.length || !country) throw new Error('Sesi habis. Buka katalog ulang.');
  const { total, pages, current } = paginate(services, page, cfg.page_size.services);
  return {
    text:   msg.catalogHeader(`Server ${server}`, country.name, country.iso_code, total, current, pages),
    markup: kb.servicesMenu(services, page, uid),
  };
};

module.exports = (bot, pending, pendingDeposit) => {

  bot.on('callback_query', async (q) => {
    const { data, from, message } = q;
    const cid = message?.chat?.id;
    const mid = message?.message_id;
    if (!cid || !mid || !data) return;

    // Selalu jawab callback agar tombol tidak loading terus
    bot.answerCallbackQuery(q.id).catch(() => {});

    db.updateUserInfo(from.id, { username: from.username, first_name: from.first_name, last_name: from.last_name });
    const user = db.getUser(from.id);

    // Maintenance check (admin bypass)
    if (!isAdmin(from.id) && isMaintenanceActive() && data !== 'noop') {
      return bot.answerCallbackQuery(q.id, { text: '🔧 Bot sedang maintenance. Coba lagi nanti.', show_alert: true }).catch(() => {});
    }

    // Join verify
    if (data === 'joincheck:verify') {
      const { passed, notJoined } = await checkMembership(bot, from.id);
      if (passed) {
        try { await bot.deleteMessage(cid, mid); } catch {}
        return S(bot, cid, msg.welcome(user, process.uptime(), isAdmin(from.id), db.getAllUsers().length, recommend.promo(from.id)), { reply_markup: kb.mainMenu() });
      }
      bot.answerCallbackQuery(q.id, { text: '❌ Belum join semua channel!', show_alert: true }).catch(() => {});
      return sendJoinPrompt(bot, cid, notJoined);
    }

    // Join check semua callback
    {
      const { passed, notJoined } = await checkMembership(bot, from.id);
      if (!passed) {
        bot.answerCallbackQuery(q.id, { text: '⚠️ Wajib join channel dulu!', show_alert: true }).catch(() => {});
        return sendJoinPrompt(bot, cid, notJoined);
      }
    }

    if (data === 'noop') return;

    log.logUserAction(user, data);

    try {
      await _route(bot, q, data, from, cid, mid, user, pending, pendingDeposit);
    } catch (err) {
      console.error(`[cb] uid=${from.id} data=${data}: ${err.message}`);
      log.logError(user, `cb:${data}`, err.message);
      E(bot, cid, mid,
        `❌ *Terjadi Kesalahan*\n─────────────────────────\n${err.message}\n\nCoba lagi atau hubungi admin.`,
        { reply_markup: kb.backMainMenu() }
      );
    }
  });

  // ── ROUTER ────────────────────────────────────────────────────────────────
  async function _route(bot, q, data, from, cid, mid, user, pending, pendingDeposit) {

    // ── NAVIGASI UTAMA ─────────────────────────────────────────────────────
    if (data === 'back:main')
      return E(bot, cid, mid, msg.welcome(user, process.uptime(), isAdmin(from.id), db.getAllUsers().length, recommend.promo(from.id)), { reply_markup: kb.mainMenu() });
    if (data === 'menu:profile')
      return E(bot, cid, mid, msg.profile(user, isAdmin(from.id)), { reply_markup: kb.profileMenu() });
    if (data === 'menu:level')
      return E(bot, cid, mid, msg.levelInfo(user, isAdmin(from.id)), { reply_markup: kb.backMainMenu() });
    if (data === 'menu:history')
      return E(bot, cid, mid, msg.historyOrder(user.orders), { reply_markup: kb.backMainMenu() });
    if (data === 'menu:depohist')
      return E(bot, cid, mid, msg.historyDeposit(user.deposits || []), { reply_markup: kb.backMainMenu() });
    if (data === 'menu:top')
      return E(bot, cid, mid, msg.topUsers(db.getAllUsers()), { reply_markup: kb.backMainMenu() });
    if (data === 'menu:help')
      return E(bot, cid, mid, msg.helpText(), { reply_markup: kb.helpMenu() });
    if (data === 'menu:referral')
      return E(bot, cid, mid, msg.referralInfo(user, botinfo.getUsername(), cfg.referral.bonus), { reply_markup: kb.backMainMenu() });
    if (data === 'menu:privacy')
      return E(bot, cid, mid, msg.privacyPolicy(), { reply_markup: kb.backMainMenu() });

    if (data === 'menu:deposit')
      return E(bot, cid, mid,
        `💳 *Isi Saldo*\n─────────────────────────\nPilih nominal deposit via QRIS.\nSaldo masuk otomatis setelah bayar. ✅`,
        { reply_markup: kb.depositAmountMenu() });

    // ── BELI OTP — jalur cepat: aplikasi → rekomendasi server → konfirmasi ──
    if (data === 'menu:otp') {
      const apps = recommend.quickApps();
      if (!apps.length) throw new Error('Aplikasi populer belum dikonfigurasi (QUICK_SERVICES).');
      return E(bot, cid, mid, msg.quickAppsHeader(), { reply_markup: kb.quickAppsMenu(apps) });
    }

    // Aplikasi dipilih → bandingkan semua server (live) → tampilkan 1–3 pilihan terbaik
    if (data.startsWith('qa:')) {
      const apps = recommend.quickApps();
      const idx  = Number(data.split(':')[1]);
      const app  = apps[idx];
      if (!app) throw new Error('Aplikasi tidak ditemukan.');

      await E(bot, cid, mid, `⏳ _Mencari server terbaik untuk ${app.name}..._`);
      const { options } = await recommend.findOptions(app.key);
      if (!options.length) {
        return E(bot, cid, mid,
          msg.orderStokHabis(cfg.quick.country.replace(/^./, (c) => c.toUpperCase()), app.name),
          { reply_markup: kb.quickAppsMenu(apps) });
      }
      const prices = options.map((o) => recommend.priceFor(o.svc, from.id));
      session.set(from.id, { quickApp: idx, quickOpts: options });
      return E(bot, cid, mid,
        msg.quickOptions(app, options[0].country, options, prices),
        { reply_markup: kb.quickOptionsMenu(options, prices) });
    }

    // Kembali ke pilihan rekomendasi (dari cache sesi — tanpa panggil API lagi)
    if (data === 'back:quick') {
      const { quickApp, quickOpts } = session.get(from.id);
      const app = recommend.quickApps()[quickApp];
      if (!app || !quickOpts?.length)
        return E(bot, cid, mid, msg.quickAppsHeader(), { reply_markup: kb.quickAppsMenu(recommend.quickApps()) });
      const prices = quickOpts.map((o) => recommend.priceFor(o.svc, from.id));
      return E(bot, cid, mid,
        msg.quickOptions(app, quickOpts[0].country, quickOpts, prices),
        { reply_markup: kb.quickOptionsMenu(quickOpts, prices) });
    }

    // Pilihan dipilih → langsung ke konfirmasi (operator otomatis "semua operator")
    if (data.startsWith('qb:')) {
      const idx = Number(data.split(':')[1]);
      const { quickOpts } = session.get(from.id);
      const o = quickOpts?.[idx];
      if (!o) throw new Error('Sesi habis. Buka Beli OTP ulang.');

      const price       = recommend.priceFor(o.svc, from.id);
      const discountPct = isAdmin(from.id) ? 0 : getUserLevel(from.id).current.discount;
      // Isi sesi persis seperti jalur manual → handler beli `o:0` dipakai bersama
      session.set(from.id, {
        server: o.server, countries: [o.country], ctyIdx: 0,
        services: [o.svc], svcIdx: 0, operators: [{ id: 'any', name: 'any' }],
      });
      const canBuy = user.balance >= price;
      return E(bot, cid, mid,
        canBuy
          ? msg.confirmOrder(o.svc.service_name, o.country.name, o.country.iso_code, null, price, user.balance, isAdmin(from.id), discountPct)
          : msg.saldoKurang(price, user.balance),
        { reply_markup: canBuy ? kb.quickConfirmMenu() : kb.saldoKurangMenu() });
    }

    // ── JALUR MANUAL: server → negara → layanan(+harga) ───────────────────
    // Langkah 1 — pilih server (⭐ = rekomendasi bot, ⚡ = median detik OTP masuk)
    if (data === 'menu:manual' || data === 'back:svc') {
      const servers = dz.getServers();
      if (!servers.length) throw new Error('Server belum dikonfigurasi. Hubungi admin.');
      session.set(from.id, { server: null, countries: null, allCountries: null, services: null, allServices: null });
      return E(bot, cid, mid, msg.serversHeader(servers.length), { reply_markup: kb.serversMenu(servers, recommend.serverHints()) });
    }

    // Langkah 2 — server dipilih → muat negara
    if (data.startsWith('sv:')) {
      const server = data.slice(3);
      if (!dz.getServers().some((x) => x.id === server)) throw new Error('Server tidak valid. Buka katalog ulang.');
      await E(bot, cid, mid, '⏳ _Memuat negara..._');
      const countries = await dz.getCountries(server);
      if (!countries.length) throw new Error(`Negara belum tersedia di Server ${server}. Coba server lain.`);
      session.set(from.id, { server, countries, allCountries: countries, ctyPage: 0, services: null, allServices: null });
      const v = countryView(from.id, 0);
      return E(bot, cid, mid, v.text, { reply_markup: v.markup });
    }

    // Pagination negara
    if (data.startsWith('cp:')) {
      const page = Math.max(0, Number(data.split(':')[1]) || 0);
      session.set(from.id, { ctyPage: page });
      const v = countryView(from.id, page);
      return E(bot, cid, mid, v.text, { reply_markup: v.markup });
    }

    // Cari negara
    if (data === 'cty:search') {
      waitingInput.set(from.id, { type: 'search_country' });
      return E(bot, cid, mid, `🔍 *Cari Negara*\n─────────────────────────\nKetik nama negara:`);
    }

    // Kembali ke daftar negara
    if (data === 'back:cty') {
      const page = session.get(from.id).ctyPage || 0;
      const v = countryView(from.id, page);
      return E(bot, cid, mid, v.text, { reply_markup: v.markup });
    }

    // Langkah 3 — negara dipilih → muat layanan + harga
    if (data.startsWith('c:')) {
      const [, rawIdx, rawPage] = data.split(':');
      const idx  = Number(rawIdx);
      const page = Number(rawPage) || 0;
      const { countries, server } = session.get(from.id);
      if (!countries?.length) throw new Error('Sesi habis. Buka katalog ulang.');
      const country = countries[idx];
      if (!country) throw new Error('Negara tidak ditemukan.');

      await E(bot, cid, mid, `⏳ _Memuat layanan ${country.name}..._`);
      const services = await dz.getServices(server, country.code);
      if (!services.length) {
        return E(bot, cid, mid,
          msg.orderStokHabis(country.name, `Server ${server}`),
          { reply_markup: kb.countriesMenu(countries, page) });
      }
      session.set(from.id, { ctyIdx: idx, ctyPage: page, services, allServices: services, svcPage: 0, svcIdx: null });
      const v = serviceView(from.id, 0);
      return E(bot, cid, mid, v.text, { reply_markup: v.markup });
    }

    // Pagination layanan
    if (data.startsWith('sp:')) {
      const page = Math.max(0, Number(data.split(':')[1]) || 0);
      session.set(from.id, { svcPage: page });
      const v = serviceView(from.id, page);
      return E(bot, cid, mid, v.text, { reply_markup: v.markup });
    }

    // Cari layanan (di dalam server + negara yang sedang dibuka)
    if (data === 'svc:search') {
      waitingInput.set(from.id, { type: 'search_service' });
      return E(bot, cid, mid, `🔍 *Cari Layanan*\n─────────────────────────\nKetik nama aplikasi (contoh: WhatsApp, Telegram, TikTok):`);
    }

    // Kembali ke daftar layanan
    if (data === 'back:stk') {
      const page = session.get(from.id).svcPage || 0;
      const v = serviceView(from.id, page);
      return E(bot, cid, mid, v.text, { reply_markup: v.markup });
    }

    // Langkah 4 — layanan (varian harga) dipilih → operator (server 1) / konfirmasi
    if (data.startsWith('s:')) {
      const [, rawIdx, rawPage] = data.split(':');
      const idx  = Number(rawIdx);
      const page = Number(rawPage) || 0;
      const { services, countries, ctyIdx, server } = session.get(from.id);
      const svc     = services?.[idx];
      const country = countries?.[ctyIdx];
      if (!svc || !country) throw new Error('Sesi habis. Buka katalog ulang.');

      // Harga dinamis sesuai role & level: admin = harga modal, user = harga markup - diskon level
      const price = calcPrice(svc.price, applyMarkup(svc.price), from.id);
      const discountPct = isAdmin(from.id) ? 0 : getUserLevel(from.id).current.discount;

      // Operator hanya dikenal di server 1; server lain otomatis "any"
      let operators = [{ id: 'any', name: 'any' }];
      if (String(server) === '1') {
        await E(bot, cid, mid, '⏳ _Memuat operator..._');
        operators = await dz.getOperators(server, country.code);
      }
      session.set(from.id, { svcIdx: idx, svcPage: page, operators });

      if (operators.length === 1) {
        const canBuy = user.balance >= price;
        return E(bot, cid, mid,
          canBuy
            ? msg.confirmOrder(svc.service_name, country.name, country.iso_code, String(server) === '1' ? 'any' : null, price, user.balance, isAdmin(from.id), discountPct)
            : msg.saldoKurang(price, user.balance),
          { reply_markup: canBuy ? kb.confirmOrderMenu(0) : kb.saldoKurangMenu() }
        );
      }
      return E(bot, cid, mid,
        msg.operatorHeader(svc.service_name, country.name, country.iso_code, price),
        { reply_markup: kb.operatorsMenu(operators) }
      );
    }

    // ── PILIH OPERATOR / KONFIRMASI → BELI NOMOR ───────────────────────────
    if (data.startsWith('o:')) {
      const opIdx = Number(data.split(':')[1]);
      const sess  = session.get(from.id);
      const { services, svcIdx, countries, ctyIdx, server, operators: ops } = sess;

      const svc     = services?.[svcIdx];
      const country = countries?.[ctyIdx];
      if (!svc || !country)
        throw new Error('Sesi habis. Pilih layanan ulang dari menu.');

      // Harga dinamis sesuai role: admin = harga modal, user = harga markup
      const price    = calcPrice(svc.price, applyMarkup(svc.price), from.id);
      const allOps   = ops || [{ id: 'any', name: 'any' }];
      const operator = allOps[opIdx];
      if (!operator) throw new Error('Operator tidak valid. Pilih layanan ulang.');

      // Ada order aktif?
      if (pending.has(from.id)) {
        const activeOrder = pending.get(from.id);
        return E(bot, cid, mid,
          `⚠️ *Ada Order Aktif!*\n─────────────────────────\n` +
          `Kamu masih punya order yang belum selesai:\n` +
          `📱 ${activeOrder.service} — \`${activeOrder.phone_number}\`\n\n` +
          `Selesaikan atau batalkan order tersebut dulu.`,
          { reply_markup: kb.orderActiveMenu(activeOrder.order_id) }
        );
      }

      // Saldo kurang?
      if (user.balance < price) {
        return E(bot, cid, mid, msg.saldoKurang(price, user.balance), { reply_markup: kb.saldoKurangMenu() });
      }

      await E(bot, cid, mid, '⏳ _Memproses pembelian..._');

      // Potong saldo
      db.deductBalance(from.id, price, `buy OTP ${svc.service_name}`);

      try {
        const order = await dz.buyNumber({
          server,
          country:  country.code,
          produk:   svc.produk,
          provider: svc.provider,
          operator: operator.id || operator.name,
        });

        // Pakai batas waktu asli dari Ditznesia kalau ada, fallback ke ORDER_EXPIRE_MINUTES
        const expMs = order.expires_at_ms && order.expires_at_ms > Date.now()
          ? order.expires_at_ms
          : Date.now() + cfg.order_expire_minutes * 60 * 1000;

        const orderEntry = {
          order_id:     order.order_id,
          service:      svc.service_name,
          service_code: svc.id,
          server:       String(server),
          country:      country.name,
          iso_code:     country.iso_code,
          phone_number: order.phone_number,
          operator:     String(server) === '1' ? (operator.name || 'any') : null, // operator hanya dikenal server 1
          price,
          cost:         order.price != null ? order.price : svc.price,
          expired_at:   new Date(expMs).toISOString(),
        };

        // Harga modal sebenarnya lebih mahal dari yang tampil di katalog (harga berubah)? Catat ke log.
        if (order.price != null && order.price > svc.price)
          log.logWarn(`harga modal naik: ${svc.service_name} katalog ${svc.price} → order ${order.price} (order ${order.order_id})`);

        db.addOrder(from.id, orderEntry);
        pending.set(from.id, { ...orderEntry, time: Date.now(), expires_ms: expMs });
        session.clear(from.id);

        await E(bot, cid, mid,
          msg.orderSuccess(orderEntry, db.getUser(from.id).balance),
          { reply_markup: kb.orderActiveMenu(order.order_id) }
        );
        log.logOrderCreated(user, orderEntry);

      } catch (buyErr) {
        // Refund saldo jika gagal beli
        db.refundBalance(from.id, price, `refund beli gagal ${svc.service_name}`);
        log.logError(user, 'buyNumber', buyErr.message);

        const em = buyErr.message.toLowerCase();
        const noProviderBalance = em.includes('balance') || em.includes('saldo') || em.includes('insufficient');
        const noStock = em.includes('stok') || em.includes('stock') || em.includes('kosong') || em.includes('habis') || em.includes('unavailable') || em.includes('tidak tersedia');

        // Saldo Ditznesia habis → kabari admin (user cukup lihat "stok habis")
        if (noProviderBalance) {
          for (const adminId of cfg.admin_ids)
            bot.sendMessage(adminId,
              `⚠️ *Saldo Ditznesia tidak cukup*\n─────────────────────────\nOrder ${svc.service_name} gagal.\nSilakan top-up lewat dashboard Ditznesia.\n\`${clean(buyErr.message)}\``,
              { parse_mode: 'Markdown' }).catch(() => {});
        }

        E(bot, cid, mid,
          `😔 *Gagal Membeli Nomor*\n─────────────────────────\n` +
          ((noProviderBalance || noStock)
            ? `Stok sedang habis untuk layanan ini.\nCoba negara/server lain atau tunggu beberapa menit.`
            : clean(buyErr.message)) +
          `\n\n✅ Saldo kamu *tidak dipotong*.`,
          { reply_markup: kb.backMainMenu() }
        );
      }
      return;
    }

    // ── CEK OTP ────────────────────────────────────────────────────────────
    if (data.startsWith('otp:')) {
      const orderId = data.split(':')[1];
      const state   = pending.get(from.id);
      if (!state || String(state.order_id) !== String(orderId)) {
        return bot.answerCallbackQuery(q.id, { text: 'Order ini sudah selesai — cek pesan OTP di chat. ✅', show_alert: true }).catch(() => {});
      }

      const res = await dz.getOrderStatus(orderId);
      if (!pending.has(from.id)) return;   // auto-poller sudah mengirim OTP lebih dulu
      if (res.otp_code) {
        pending.delete(from.id);
        const phone = res.phone_number || state.phone_number;
        db.updateOrder(from.id, orderId, { status: 'completed', otp_code: res.otp_code, otp_msg: res.otp_msg });
        await E(bot, cid, mid, msg.otpReceived(orderId, phone, res.otp_code, res.otp_msg), { reply_markup: kb.mainMenu() });
        log.logOTPReceived(user, orderId, phone, res.otp_code);
      } else if (cancelOrderSafe.CANCELED.includes(res.status)) {
        // Order sudah dibatalkan / kedaluwarsa di sisi Ditznesia tanpa OTP → refund user
        pending.delete(from.id);
        const balance = db.refundBalance(from.id, state.price || 0, `refund ${res.status} ${orderId}`);
        db.updateOrder(from.id, orderId, { status: 'canceled' });
        await E(bot, cid, mid, msg.orderCancelled(orderId, state.price || 0, balance), { reply_markup: kb.mainMenu() });
        log.logOrderCancelled(user, orderId, state.price || 0, balance);
      } else {
        bot.answerCallbackQuery(q.id, { text: '⏳ OTP belum masuk. Coba lagi dalam 5 detik!', show_alert: false }).catch(() => {});
      }
      return;
    }

    // ── BATALKAN ORDER ─────────────────────────────────────────────────────
    if (data.startsWith('cnl:')) {
      const orderId = data.split(':')[1];
      const state   = pending.get(from.id);
      if (!state || String(state.order_id) !== String(orderId)) {
        return bot.answerCallbackQuery(q.id, { text: 'Order tidak ditemukan.', show_alert: true }).catch(() => {});
      }

      // Saldo user HANYA dikembalikan kalau Ditznesia benar-benar sudah membatalkan order
      const r = await cancelOrderSafe(dz, orderId);

      if (r.otp) { // OTP ternyata sudah masuk saat user menekan batal
        pending.delete(from.id);
        const phone = r.otp.phone_number || state.phone_number;
        db.updateOrder(from.id, orderId, { status: 'completed', otp_code: r.otp.otp_code, otp_msg: r.otp.otp_msg });
        await E(bot, cid, mid, msg.otpReceived(orderId, phone, r.otp.otp_code, r.otp.otp_msg), { reply_markup: kb.mainMenu() });
        log.logOTPReceived(user, orderId, phone, r.otp.otp_code);
        return;
      }
      if (!r.ok) {
        return bot.answerCallbackQuery(q.id, {
          text: `❌ Order belum bisa dibatalkan${r.error ? `: ${r.error}` : ''}. Coba lagi sebentar lagi.`.slice(0, 190),
          show_alert: true,
        }).catch(() => {});
      }

      const balance = db.refundBalance(from.id, state.price || 0, `refund cancel ${orderId}`);
      db.updateOrder(from.id, orderId, { status: 'canceled' });
      pending.delete(from.id);

      await E(bot, cid, mid, msg.orderCancelled(orderId, state.price || 0, balance), { reply_markup: kb.mainMenu() });
      log.logOrderCancelled(user, orderId, state.price || 0, balance);
      return;
    }

    // ── DEPOSIT: PILIH NOMINAL ──────────────────────────────────────────────
    if (data.startsWith('dep:')) {
      const val = data.split(':')[1];
      if (val === 'custom') {
        waitingInput.set(from.id, { type: 'deposit_custom' });
        return E(bot, cid, mid, `✏️ *Nominal Custom*\n─────────────────────────\nMasukkan jumlah deposit (min. Rp 5.000):\n\n_Contoh: 75000_`);
      }
      return _makeDeposit(bot, from.id, cid, mid, Number(val), pendingDeposit, user);
    }

    // ── DEPOSIT: CEK STATUS MANUAL ──────────────────────────────────────────
    // Pakai verifyDeposit() yang sama persis dengan auto-poll (poller.js) —
    // supaya tombol "Cek Status" dan auto-poll SELALU kasih hasil yang sama,
    // tidak ada dua logic terpisah yang bisa beda jawaban.
    if (data.startsWith('dc:')) {
      const refNo = data.slice(3);
      const info  = pendingDeposit.get(refNo);
      if (!info) {
        return bot.answerCallbackQuery(q.id, { text: '✅ Deposit ini sudah selesai atau tidak ditemukan.', show_alert: true }).catch(() => {});
      }

      const status = await verifyDeposit(bot, pgApi, refNo, info, pendingDeposit);
      if (status === 'pending') {
        bot.answerCallbackQuery(q.id, { text: '⏳ Pembayaran belum terdeteksi. Coba lagi sebentar lagi!', show_alert: false }).catch(() => {});
      } else {
        bot.deleteMessage(cid, mid).catch(() => {});
      }
      return;
    }

    // ── DEPOSIT: BATALKAN ───────────────────────────────────────────────────
    if (data.startsWith('dx:')) {
      const refNo = data.slice(3);
      db.updateDeposit(from.id, refNo, { status: 'cancelled' });
      pendingDeposit.delete(refNo);
      bot.deleteMessage(cid, mid).catch(() => {});
      S(bot, cid, `✖️ Deposit dibatalkan.\n\nPilih nominal baru:`, { reply_markup: kb.depositAmountMenu() });
      log.logDepositCancelled(user, refNo);
      return;
    }
  }

  // ── INPUT TEKS ─────────────────────────────────────────────────────────────
  bot.on('message', async (m) => {
    if (!m.text || m.text.startsWith('/')) return;
    const state = waitingInput.get(m.from.id);
    if (!state) return;
    waitingInput.delete(m.from.id);

    const user = db.getUser(m.from.id);

    try {
      if (state.type === 'search_service') {
        const kw = m.text.trim().toLowerCase();
        const { allServices } = session.get(m.from.id);
        if (!allServices?.length) return S(bot, m.chat.id, '❌ Sesi habis. Buka katalog ulang.', { reply_markup: kb.backMainMenu() });
        const matched = allServices.filter((x) => x.service_name.toLowerCase().includes(kw) || x.produk.toLowerCase() === kw);
        if (!matched.length)
          return S(bot, m.chat.id, `❌ Layanan *"${m.text}"* tidak ditemukan.\n\nCoba kata kunci lain.`, { reply_markup: kb.backMainMenu() });
        session.set(m.from.id, { services: matched, svcPage: 0 });
        const v = serviceView(m.from.id, 0);
        S(bot, m.chat.id, v.text, { reply_markup: v.markup });
        return;
      }

      if (state.type === 'search_country') {
        const kw = m.text.trim().toLowerCase();
        const { allCountries } = session.get(m.from.id);
        if (!allCountries?.length) return S(bot, m.chat.id, '❌ Sesi habis. Buka katalog ulang.', { reply_markup: kb.backMainMenu() });
        const matched = allCountries.filter((c) => c.name.toLowerCase().includes(kw));
        if (!matched.length)
          return S(bot, m.chat.id, `❌ Negara *"${m.text}"* tidak ditemukan.`, { reply_markup: kb.backMainMenu() });
        session.set(m.from.id, { countries: matched, ctyPage: 0 });
        const v = countryView(m.from.id, 0);
        S(bot, m.chat.id, v.text, { reply_markup: v.markup });
        return;
      }

      if (state.type === 'deposit_custom') {
        const amount = parseInt(m.text.replace(/\D/g, ''), 10);
        if (isNaN(amount) || amount < 5000)
          return S(bot, m.chat.id, `❌ Minimal Rp 5.000.\nMasukkan ulang:`);
        return _makeDeposit(bot, m.from.id, m.chat.id, null, amount, pendingDeposit, user);
      }

    } catch (err) {
      console.error(`[input] uid=${m.from.id} type=${state.type}: ${err.message}`);
      log.logError(user, `input:${state.type}`, err.message);
      S(bot, m.chat.id, `❌ ${err.message}`, { reply_markup: kb.backMainMenu() });
    }
  });

  // ── BUAT DEPOSIT KIPAY ────────────────────────────────────────────────────────
  async function _makeDeposit(bot, userId, cid, mid, amount, pendingDeposit, user) {
    if (mid) await E(bot, cid, mid, '⏳ _Membuat QR QRIS..._');

    const dep = await pgApi.createTransaction(amount, `uid:${userId}`);

    // expires_at dari KiPay format "YYYY-MM-DD HH:mm:ss" dalam UTC
    const expiredAt = dep.expires_at
      ? new Date(String(dep.expires_at).replace(' ', 'T') + 'Z').getTime()
      : Date.now() + (cfg.qris_expiry_minutes || 30) * 60 * 1000;

    const fee = dep.fee_amount || 0;
    const net = dep.net_amount != null ? dep.net_amount : (dep.amount - fee);

    db.addDeposit(userId, {
      ref_no: dep.trx_id, amount: dep.amount, fee, expired_at: expiredAt,
      qr_url: null, payment_link: null, qr_payload: dep.qr_payload,
      requested_amount: dep.requested_amount, unique_code: dep.unique_code,
    }, net);
    pendingDeposit.set(dep.trx_id, { userId, amount: net });

    const caption = msg.depositCreated({
      ref_no: dep.trx_id, amount: dep.amount, requested_amount: dep.requested_amount,
      unique_code: dep.unique_code, diterima: net, expired_at: expiredAt,
    });
    const opts = { parse_mode: 'Markdown', caption, reply_markup: kb.depositConfirmMenu(dep.trx_id) };

    if (mid) bot.deleteMessage(cid, mid).catch(() => {});

    let sent;
    try {
      const qrBuf = await QRCode.toBuffer(dep.qr_payload, {
        type: 'png', width: 512, margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' },
        errorCorrectionLevel: 'M',
      });
      sent = await bot.sendPhoto(cid, qrBuf, opts);
    } catch {
      try   { sent = await bot.sendPhoto(cid, pgApi.qrPngUrl(dep.trx_id), opts); }
      catch { sent = await bot.sendMessage(cid, caption,
        { parse_mode: 'Markdown', reply_markup: kb.depositConfirmMenu(dep.trx_id) }); }
    }

    if (sent?.message_id) db.updateDeposit(userId, dep.trx_id, { qr_message_id: sent.message_id });
    log.logDepositCreated(user, { ref_no: dep.trx_id, amount: dep.amount, fee, diterima: net });
  }

  return waitingInput;
};
