// src/utils/db.js — ManzxyOTP (atomic JSON, production-ready)
'use strict';

const fs   = require('fs');
const path = require('path');
const cfg  = require('../../config');

const DEFAULT = () => ({ users: {}, transactions: [], deposits: [] });

class DB {
  constructor(fp) {
    this.fp  = path.resolve(fp);
    this.tmp = this.fp + '.tmp';
    fs.mkdirSync(path.dirname(this.fp), { recursive: true });
    if (!fs.existsSync(this.fp)) this._write(DEFAULT());
  }

  _read() {
    try { return JSON.parse(fs.readFileSync(this.fp, 'utf8')); }
    catch { try { return JSON.parse(fs.readFileSync(this.tmp, 'utf8')); } catch { return DEFAULT(); } }
  }

  _write(data) {
    fs.writeFileSync(this.tmp, JSON.stringify(data, null, 2));
    fs.renameSync(this.tmp, this.fp);
  }

  // ── User ──────────────────────────────────────────────────────────────────
  getUser(id) {
    const db  = this._read();
    const key = String(id);
    if (!db.users[key]) {
      db.users[key] = {
        id, username: null, first_name: null, last_name: null,
        balance: 0, orders: [], deposits: [],
        joined_at: new Date().toISOString(), is_new: true,
        referred_by: null, referral_count: 0, referral_earnings: 0,
      };
      this._write(db);
    }
    return db.users[key];
  }

  // Cek keberadaan user TANPA membuat record baru (dipakai validasi kode referral).
  userExists(id) { return !!this._read().users[String(id)]; }

  isNewUser(id)    { const u = this._read().users[String(id)]; return !u || !!u.is_new; }
  markUserSeen(id) { const u = this.getUser(id); u.is_new = false; this.saveUser(u); }
  saveUser(user)   { const db = this._read(); db.users[String(user.id)] = user; this._write(db); }
  getAllUsers()     { return Object.values(this._read().users); }

  updateUserInfo(id, { username, first_name, last_name } = {}) {
    const u = this.getUser(id);
    if (username   !== undefined) u.username   = username   || null;
    if (first_name !== undefined) u.first_name = first_name || null;
    if (last_name  !== undefined) u.last_name  = last_name  || null;
    this.saveUser(u);
    return u;
  }

  // ── Saldo ─────────────────────────────────────────────────────────────────
  addBalance(id, amount, note = '') {
    const u = this.getUser(id);
    u.balance += Number(amount);
    this.saveUser(u);
    this._tx({ user_id: String(id), type: 'topup', amount: Number(amount), note });
    return u.balance;
  }

  deductBalance(id, amount, note = '') {
    const u = this.getUser(id);
    const n = Number(amount);
    if (u.balance < n) throw new Error(
      `Saldo tidak cukup.\n💰 Saldo: *${cfg.currency}${u.balance.toLocaleString('id-ID')}*\n💸 Perlu: *${cfg.currency}${n.toLocaleString('id-ID')}*`
    );
    u.balance -= n;
    this.saveUser(u);
    this._tx({ user_id: String(id), type: 'deduct', amount: n, note });
    return u.balance;
  }

  refundBalance(id, amount, note = '') {
    if (!amount || amount <= 0) return this.getUser(id).balance;
    const u = this.getUser(id);
    u.balance += Number(amount);
    this.saveUser(u);
    this._tx({ user_id: String(id), type: 'refund', amount: Number(amount), note });
    return u.balance;
  }

  // ── Referral ──────────────────────────────────────────────────────────────
  // Tandai user baru sebagai "diajak oleh" referrer (dicatat sekali saja, saat
  // pertama kali start via link referral) + kreditkan bonus ke referrer.
  addReferral(referrerId, newUserId, bonus) {
    const referred = this.getUser(newUserId);
    if (referred.referred_by) return null; // sudah pernah dicatat, jangan dobel

    referred.referred_by = String(referrerId);
    this.saveUser(referred);

    const referrer = this.getUser(referrerId);
    referrer.balance += Number(bonus);
    referrer.referral_count   = (referrer.referral_count   || 0) + 1;
    referrer.referral_earnings = (referrer.referral_earnings || 0) + Number(bonus);
    this.saveUser(referrer);

    this._tx({ user_id: String(referrerId), type: 'referral', amount: Number(bonus), note: `referral dari user ${newUserId}` });
    return referrer.balance;
  }

  // ── Order ─────────────────────────────────────────────────────────────────
  addOrder(id, data) {
    const u = this.getUser(id);
    const e = { ...data, status: 'pending', otp_code: null, otp_msg: null, time: new Date().toISOString() };
    u.orders.unshift(e);
    if (u.orders.length > 100) u.orders = u.orders.slice(0, 100);
    this.saveUser(u);
    return e;
  }

  updateOrder(id, orderId, patch) {
    const u = this.getUser(id);
    const o = u.orders.find((x) => String(x.order_id) === String(orderId));
    if (o) Object.assign(o, patch);
    this.saveUser(u);
    return o || null;
  }

  // ── Deposit ───────────────────────────────────────────────────────────────
  addDeposit(id, dep, netAmount) {
    const u = this.getUser(id);
    const e = {
      deposit_id:    dep.ref_no || dep.id,
      ref_no:        dep.ref_no || dep.id,
      amount:        dep.amount,
      diterima:      netAmount,
      fee:           dep.fee || 0,
      qr_url:        dep.qr_url        || null,
      qr_payload:    dep.qr_payload    || null,
      payment_link:  dep.payment_link  || null,
      requested_amount: dep.requested_amount || null,
      unique_code:      dep.unique_code      || null,
      issuer:        null,
      payor:         null,
      status:        'pending',
      created_local: new Date().toISOString(),
      expired_at:    dep.expired_at || Date.now() + 30 * 60 * 1000,
      qr_message_id: null,
    };
    u.deposits.unshift(e);
    if (u.deposits.length > 50) u.deposits = u.deposits.slice(0, 50);
    this.saveUser(u);

    const db = this._read();
    db.deposits.unshift({ user_id: String(id), ...e });
    if (db.deposits.length > 1000) db.deposits = db.deposits.slice(0, 1000);
    this._write(db);
    return e;
  }

  updateDeposit(id, refNo, patch) {
    const u = this.getUser(id);
    const d = u.deposits.find((x) => x.deposit_id === String(refNo) || x.ref_no === String(refNo));
    if (d) Object.assign(d, patch);
    this.saveUser(u);
    const db = this._read();
    const gd = db.deposits.find((x) => x.deposit_id === String(refNo) || x.ref_no === String(refNo));
    if (gd) Object.assign(gd, patch);
    this._write(db);
    return d || null;
  }

  findUserDepositById(userId, refNo) {
    return this.getUser(userId).deposits
      .find((x) => x.deposit_id === String(refNo) || x.ref_no === String(refNo)) || null;
  }

  getPendingDeposits() {
    return this._read().deposits.filter((d) => d.status === 'pending');
  }

  // ── Tx log ────────────────────────────────────────────────────────────────
  _tx(entry) {
    const db = this._read();
    db.transactions.unshift({ ...entry, time: new Date().toISOString() });
    if (db.transactions.length > 2000) db.transactions = db.transactions.slice(0, 2000);
    this._write(db);
  }

  getTx(limit = 10, userId = null) {
    const all = this._read().transactions;
    return (userId ? all.filter((t) => String(t.user_id) === String(userId)) : all).slice(0, limit);
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  getStats() {
    const db    = this._read();
    const users = Object.values(db.users);
    const tx    = db.transactions;
    return {
      total_users:    users.length,
      totalBalance:   users.reduce((s, u) => s + (u.balance || 0), 0),
      totalOrders:    users.reduce((s, u) => s + (u.orders?.length || 0), 0),
      totalTopup:     tx.filter((t) => t.type === 'topup').reduce((s, t) => s + (t.amount || 0), 0),
      totalRefund:    tx.filter((t) => t.type === 'refund').reduce((s, t) => s + (t.amount || 0), 0),
      totalReferral:  tx.filter((t) => t.type === 'referral').reduce((s, t) => s + (t.amount || 0), 0),
      referralCount:  tx.filter((t) => t.type === 'referral').length,
      depositDone:    db.deposits.filter((d) => d.status === 'success').length,
      depositPending: db.deposits.filter((d) => d.status === 'pending').length,
    };
  }
}

module.exports = new DB(cfg.db_path);
