// src/providers/ditznesia.js — Ditznesia API wrapper (Jasa OTP / nomor virtual)
// Dokumentasi: https://www.ditznesia.com/api-docs
//
// Semua endpoint: GET {BASE}/<endpoint>?apikey=...&...
//   /profile    /countries   /operators   /services
//   /order      /status      /resend      /cancel     /history
//
// Perbedaan antar server (parameter /order):
//   server 1 → country + produk + operator   (operator 'any' = semua operator)
//   server 2 → country + produk + provider   (provider dari /services)
//   server 3 → country + produk              (tanpa operator/provider)
//   server 4 → country (kode ISO, mis. "id") + produk + provider
//   server 5 → country + produk + provider
'use strict';

const axios = require('axios');
const cfg   = require('../../config');

const BASE = String(cfg.ditznesia.base_url || 'https://www.ditznesia.com/api/dev').replace(/\/+$/, '');

const client = axios.create({ timeout: 20000, headers: { Accept: 'application/json' } });

/**
 * Lempar Error yang rapi & konsisten. Prefix [DZ:<ctx>] supaya mudah dilacak di log.
 * API key SENGAJA tidak pernah ikut masuk ke pesan error (key ada di query string).
 */
const fail = (e, ctx) => {
  if (e?.isDzError) throw e;
  const status = e?.response?.status;
  const body   = e?.response?.data;
  const m =
    (typeof body === 'string' && body.length < 200 ? body : null) ||
    body?.error?.message ||
    (typeof body?.error === 'string' ? body.error : null) ||
    body?.message ||
    body?.msg ||
    (status === 401 || status === 403 ? 'API key Ditznesia tidak valid / ditolak' : null) ||
    (status === 429 ? 'Terlalu banyak request ke Ditznesia, coba lagi sebentar' : null) ||
    (e?.code === 'ECONNABORTED' ? 'Timeout — server Ditznesia tidak merespons' : null) ||
    e?.message || 'Ditznesia error';
  const err = new Error(`[DZ:${ctx}] ${m}`);
  err.isDzError = true;
  err.status = status;
  throw err;
};

/**
 * GET generik. Respons sukses Ditznesia berupa JSON polos (objek / array).
 * Kalau body berisi penanda gagal ({ error } / { success:false } / { status:false }),
 * dilempar sebagai error supaya saldo user tidak terpotong untuk order gagal.
 */
const get = async (endpoint, params = {}, ctx = 'get') => {
  try {
    const { data } = await client.get(`${BASE}/${endpoint}`, {
      params: { apikey: cfg.ditznesia.api_key, ...params },
    });
    if (data && !Array.isArray(data) && typeof data === 'object') {
      const bad = data.success === false || data.ok === false || data.status === false || data.error;
      if (bad) {
        const msg = (typeof data.error === 'string' ? data.error : data.error?.message) || data.message || data.msg || 'Gagal memproses permintaan';
        const err = new Error(msg); err.isDzError = false; throw err;
      }
    }
    return data;
  } catch (e) { fail(e, ctx); }
};

const toArray = (res) => {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.result)) return res.result;
  return [];
};

// ── Akun & saldo ─────────────────────────────────────────────────────────────
/**
 * Info akun + saldo Ditznesia milik kita.
 * @returns {Promise<{ email, name, balance, formated }>}
 */
const getProviderBalance = async () => {
  const d = await get('profile', {}, 'profile');
  const balance = Number(d?.balance || 0);
  return {
    email:    d?.email || '-',
    name:     d?.name  || '-',
    balance,
    formated: `${cfg.currency}${balance.toLocaleString('id-ID')}`,
  };
};

// ── Server ───────────────────────────────────────────────────────────────────
/** Daftar server yang diaktifkan di .env (DITZNESIA_SERVERS), contoh: "1,2,3,4,5". */
const getServers = () => cfg.ditznesia.servers.map((id) => ({ id: String(id), name: `Server ${id}` }));

// ── Negara ───────────────────────────────────────────────────────────────────
/**
 * Daftar negara per server. Server 1/2/3/5 pakai kode angka (mis. "6"), server 4 pakai ISO ("id").
 * @param {string|number} server
 * @returns {Promise<Array<{ code, name, flag, iso_code }>>}
 */
const getCountries = async (server) => {
  const res = await get('countries', { server }, 'countries');
  return toArray(res)
    .map((c) => ({
      code:     String(c.code ?? c.id ?? ''),
      name:     String(c.name ?? c.code ?? '-'),
      flag:     c.flag || '',
      iso_code: c.flag || String(c.code ?? ''),   // dipakai flagEmoji() — emoji langsung ditampilkan apa adanya
    }))
    .filter((c) => c.code);
};

// ── Operator (hanya server 1) ────────────────────────────────────────────────
/**
 * Selalu return minimal [{ id:'any', name:'any' }] walau API error/kosong,
 * supaya alur beli tetap bisa lanjut dengan "Semua Operator".
 * @returns {Promise<Array<{ id, name }>>}
 */
const getOperators = async (server, country) => {
  try {
    const res  = await get('operators', { server, country }, 'operators');
    const list = toArray(res).map((o) =>
      typeof o === 'string' || typeof o === 'number'
        ? { id: String(o), name: String(o) }
        : { id: String(o.id ?? o.code ?? o.name), name: String(o.name ?? o.id ?? o.code) });
    const rest = list.filter((o) => o.name.toLowerCase() !== 'any' && o.id.toLowerCase() !== 'any');
    return [{ id: 'any', name: 'any' }, ...rest];
  } catch {
    return [{ id: 'any', name: 'any' }];
  }
};

// ── Layanan + harga ──────────────────────────────────────────────────────────
/**
 * Daftar layanan beserta harga & stok untuk kombinasi server + negara.
 * Server 2/4/5 mengembalikan beberapa varian per layanan (dibedakan field `provider`).
 * Hanya layanan yang stoknya > 0 yang dikembalikan, diurutkan nama lalu harga termurah.
 * @param {string|number} server
 * @param {string|number} country
 * @param {string} [service]  Filter ID/nama layanan (opsional)
 * @returns {Promise<Array<{ id, produk, service_name, provider, count, price, rate_sms }>>}
 */
const getServices = async (server, country, service) => {
  const params = { server, country };
  if (service) params.service = service;
  const res = await get('services', params, 'services');
  return toArray(res)
    .map((s) => ({
      id:           String(s.id ?? s.produk ?? ''),
      produk:       String(s.produk ?? s.id ?? ''),
      service_name: String(s.service_name ?? s.produk ?? s.id ?? '-'),
      provider:     s.provider != null && s.provider !== '' ? String(s.provider) : null,
      count:        s.count != null ? Number(s.count) : null,
      price:        Number(s.price || 0),
      rate_sms:     s.rate_sms != null ? Number(s.rate_sms) : null,
    }))
    .filter((s) => s.produk && s.price > 0 && (s.count == null || s.count > 0))
    .sort((a, b) => a.service_name.localeCompare(b.service_name) || a.price - b.price);
};

// ── Order nomor ──────────────────────────────────────────────────────────────
const isWaiting = (otp) => {
  if (otp == null) return true;
  const s = String(otp).trim();
  return s === '' || s === '-' || /^waiting$/i.test(s);
};

/** Samakan bentuk respons order/status ke format yang dipakai handler bot. */
const normalizeOrder = (d = {}) => ({
  order_id:     d.id,
  status:       String(d.status || '').toLowerCase(),
  phone_number: d.number,
  otp_code:     isWaiting(d.otp) ? null : String(d.otp),
  otp_msg:      d.sms || d.message || d.otp_msg || null,
  price:        d.price != null ? Number(d.price) : null,
  expires_at_ms: d.expires_at_ms != null ? Number(d.expires_at_ms) : null,
  can_resend:   !!d.can_resend,
  resend_waiting: !!d.resend_waiting,
  resend_count: d.resend_count != null ? Number(d.resend_count) : 0,
  raw: d,
});

/**
 * Beli nomor virtual.
 * @param {object} o
 * @param {string|number} o.server
 * @param {string|number} o.country    code dari getCountries()
 * @param {string} o.produk            produk dari getServices()
 * @param {string} [o.provider]        wajib untuk server 2/4/5 (dari getServices())
 * @param {string} [o.operator]        khusus server 1 ('any' = semua operator)
 * @returns {Promise<{ order_id, phone_number, status, price, expires_at_ms, ... }>}
 */
const buyNumber = async ({ server, country, produk, provider, operator }) => {
  const params = { server, country, produk };
  const sv = String(server);
  if (sv === '1')                 params.operator = operator || 'any';
  else if (sv !== '3' && provider) params.provider = provider;
  const d = await get('order', params, 'buyNumber');
  const order = normalizeOrder(Array.isArray(d) ? d[0] : d);
  if (!order.order_id || !order.phone_number)
    throw new Error('[DZ:buyNumber] Respons order tidak lengkap dari Ditznesia');
  return order;
};

/**
 * Cek status order — dipanggil untuk polling OTP masuk atau belum.
 * status: pending | success | canceled | expired
 */
const getOrderStatus = async (orderId) => normalizeOrder(await get('status', { id: orderId }, 'getStatus'));

/** Batalkan order (saldo Ditznesia otomatis di-refund oleh Ditznesia). */
const cancelOrder = async (orderId) => normalizeOrder(await get('cancel', { id: orderId }, 'cancel'));

/** Minta SMS OTP dikirim ulang — hanya untuk order berstatus success & belum habis waktunya. */
const resendOrder = async (orderId) => normalizeOrder(await get('resend', { id: orderId }, 'resend'));

/** Riwayat order terakhir di akun Ditznesia kita. */
const getHistory = async (limit = 20) => {
  const res = await get('history', { limit }, 'history');
  return toArray(res).map((h) => ({
    order_id:     h.id,
    service_name: h.service_name,
    phone_number: h.number,
    otp_code:     isWaiting(h.otp) ? null : String(h.otp),
    status:       String(h.status || '').toLowerCase(),
    price:        Number(h.price || 0),
    created_at:   h.created_at,
  }));
};

module.exports = {
  getProviderBalance,
  getServers, getCountries, getOperators, getServices,
  buyNumber, getOrderStatus, cancelOrder, resendOrder, getHistory,
};
