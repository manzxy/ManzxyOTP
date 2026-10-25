// src/utils/maintenance.js
// Maintenance bisa aktif dari 2 cara:
//   1. Jam otomatis (MAINTENANCE_ENABLED=true, jam 23:00–01:00 WIB)
//   2. Command admin /maintenance start → aktif manual sampai /maintenance end
'use strict';

const cfg = require('../../config');

// State maintenance manual (dari command admin)
let _manualActive  = false;
let _manualReason  = '';
let _manualStartAt = null;

// ── Manual toggle (dipanggil dari admin handler) ───────────────────────────────
function setManual(active, reason = '') {
  _manualActive  = active;
  _manualReason  = reason;
  _manualStartAt = active ? new Date() : null;
}

function getManualState() {
  return { active: _manualActive, reason: _manualReason, startAt: _manualStartAt };
}

// ── Cek jam maintenance (WIB = UTC+7) ─────────────────────────────────────────
function isScheduledTime() {
  if (!cfg.maintenance?.enabled) return false;

  const now     = new Date();
  const totalMin = ((now.getUTCHours() + 7) % 24) * 60 + now.getUTCMinutes();

  const startMin = cfg.maintenance.start_hour * 60; // 23 * 60 = 1380
  const endMin   = cfg.maintenance.end_hour   * 60; // 01 * 60 = 60

  // Rentang melintasi tengah malam (23:00 → 01:00)
  if (startMin > endMin) {
    return totalMin >= startMin || totalMin < endMin;
  }
  return totalMin >= startMin && totalMin < endMin;
}

// ── Cek apakah maintenance aktif (salah satu atau keduanya) ───────────────────
function isMaintenanceActive() {
  return _manualActive || isScheduledTime();
}

// ── Info untuk ditampilkan ke user ────────────────────────────────────────────
function maintenanceInfo() {
  const s = String(cfg.maintenance?.start_hour ?? 23).padStart(2, '0');
  const e = String(cfg.maintenance?.end_hour   ?? 1).padStart(2, '0');
  return {
    start:    `${s}:00`,
    end:      `${e}:00`,
    manual:   _manualActive,
    reason:   _manualReason || 'Perbaikan & pemeliharaan rutin sistem',
    startAt:  _manualStartAt,
    message:  cfg.maintenance?.message || '',
  };
}

module.exports = {
  setManual,
  getManualState,
  isMaintenanceActive,
  isScheduledTime,
  maintenanceInfo,
};
