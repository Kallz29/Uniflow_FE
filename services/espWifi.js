// ============================================
// ESP32 WiFi Setup Service
// ============================================
//
// Fungsi-fungsi HTTP untuk berkomunikasi dengan ESP32 saat HP masih
// terhubung ke AP "UniFlow-Setup" (192.168.4.1).
//
// Catatan penting:
// - Header `Connection: close` WAJIB ada untuk cegah keep-alive hang
//   di Android + Expo Go (ESP32 WebServer tidak reliable dengan keep-alive).
// - Timeout default dinaikkan (12s) karena ESP32 bisa sibuk saat baru
//   selesai enterprise WiFi timeout.

import { AppError, isAbortError, logError } from '../utils/errorHandler';

const ESP_IP = '192.168.4.1';
const ESP_BASE = `http://${ESP_IP}/api/wifi`;

const DEFAULT_TIMEOUT_MS = 12000;
const SCAN_MAX_RETRY = 8;
const SCAN_RETRY_DELAY_MS = 2500;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Wrapper fetch untuk endpoint ESP32. Throw AppError kalau gagal.
 */
const espFetch = async (path, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${ESP_BASE}${path}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        Connection: 'close', // cegah keep-alive hang di ESP32
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });

    const text = await res.text();
    let data = {};
    if (text) {
      try { data = JSON.parse(text); }
      catch { data = { message: text }; }
    }

    if (!res.ok) {
      throw new AppError(data.message || `ESP32 merespons dengan status ${res.status}`, {
        code: 'ESP_HTTP_ERROR',
        status: res.status,
      });
    }
    return data;
  } catch (err) {
    if (err instanceof AppError) throw err;

    if (isAbortError(err)) {
      throw new AppError('ESP32 tidak merespons dalam batas waktu.', {
        code: 'ESP_TIMEOUT',
        cause: err,
      });
    }

    logError('espWifi', err);
    throw new AppError('Tidak dapat menjangkau ESP32. Pastikan HP terhubung ke "UniFlow-Setup".', {
      code: 'ESP_UNREACHABLE',
      cause: err,
    });
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Scan jaringan WiFi lewat ESP32.
 * ESP bisa merespons { scanning: true } saat sedang sibuk — kita retry
 * sampai SCAN_MAX_RETRY kali sebelum menyerah.
 *
 * @param {function} onRetry - callback(attempt) dipanggil saat retry (untuk UI progress).
 */
export const scanNetworks = async (onRetry) => {
  for (let attempt = 0; attempt <= SCAN_MAX_RETRY; attempt += 1) {
    if (attempt > 0) {
      onRetry?.(attempt, SCAN_MAX_RETRY);
      await wait(SCAN_RETRY_DELAY_MS);
    }

    try {
      const res = await espFetch('/scan', {}, DEFAULT_TIMEOUT_MS);
      if (res.scanning === true) continue; // ESP masih memindai → retry
      return res;
    } catch (err) {
      // Kalau sudah retry maksimum, lempar error terakhir.
      if (attempt >= SCAN_MAX_RETRY) throw err;
      // Kalau belum, lanjut loop untuk coba lagi.
    }
  }

  return { networks: [] };
};

/** GET /api/wifi/status */
export const getWifiStatus = () => espFetch('/status', {}, 6000);

/** POST /api/wifi/connect */
export const connectWifi = (ssid, password) =>
  espFetch(
    '/connect',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ssid, password }),
    },
    15000,
  );

/** POST /api/wifi/disconnect */
export const disconnectWifi = () => espFetch('/disconnect', { method: 'POST' }, 6000);

export { ESP_IP, ESP_BASE };
