// src/utils/session.js
// Simpan state navigasi user di memory — solusi batas 64 byte callback_data
// Key: userId, Value: { services, countries, pricelist, operators, ctx }
'use strict';

const sessions = new Map();

const TTL = 30 * 60 * 1000; // 30 menit

function get(userId) {
  const s = sessions.get(String(userId));
  if (!s) return {};
  // Auto-expire
  if (Date.now() - s._ts > TTL) { sessions.delete(String(userId)); return {}; }
  return s;
}

function set(userId, data) {
  const prev = get(userId);
  sessions.set(String(userId), { ...prev, ...data, _ts: Date.now() });
}

function clear(userId) { sessions.delete(String(userId)); }

module.exports = { get, set, clear };
