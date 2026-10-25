// src/utils/botinfo.js
// Simpan info bot (username) sekali di awal (dari bot.getMe() di index.js),
// dipakai untuk generate link referral tanpa perlu request ulang tiap saat.
'use strict';

let _username = null;

const setUsername = (username) => { _username = username || null; };
const getUsername = () => _username;

module.exports = { setUsername, getUsername };
