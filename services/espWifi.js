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

/** POST /api/wifi/connect — menunggu response penuh (legacy).
 *  Untuk flow baru pakai `submitWifiConnect`. */
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

/**
 * POST /api/wifi/connect — fire-and-forget.
 *
 * Latar belakang: setelah ESP32 menerima kredensial WiFi, ia akan coba
 * konek ke jaringan target. Proses ini bisa bikin ESP switch dari mode
 * AP ke STA → koneksi HP ke AP "UniFlow-Setup" terputus → response HTTP
 * tidak pernah sampai ke app → fetch timeout → user mikir gagal padahal
 * sebenernya berhasil.
 *
 * Solusi: kirim request, lalu anggap permintaan diterima kalau:
 *   - ESP merespons success eksplisit, ATAU
 *   - Request abort / network error setelah `ackTimeoutMs` detik
 *     (asumsinya ESP sudah switch network, artinya ESP menerima request).
 *
 * Caller (UI) tetap perlu verifikasi via backend health check setelah
 * HP reconnect ke WiFi normal.
 *
 * @returns {Promise<{ accepted: true, response?: object, assumed?: boolean }>}
 */
export const submitWifiConnect = async (ssid, password, ackTimeoutMs = 4000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ackTimeoutMs);

  try {
    const res = await fetch(`${ESP_BASE}/connect`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Connection: 'close',
      },
      body: JSON.stringify({ ssid, password }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    const text = await res.text();
    let data = {};
    if (text) {
      try { data = JSON.parse(text); }
      catch { data = { message: text }; }
    }

    // ESP eksplisit bilang gagal (mis. password salah)
    if (res.ok && data.success === false) {
      throw new AppError(data.message || 'Gagal terhubung, periksa password.', {
        code: 'ESP_CONNECT_REJECTED',
      });
    }

    return { accepted: true, response: data };
  } catch (err) {
    clearTimeout(timer);

    // Error eksplisit dari ESP (bukan network) → lempar
    if (err instanceof AppError && err.code === 'ESP_CONNECT_REJECTED') {
      throw err;
    }

    // Abort / network error → asumsikan ESP sudah menerima & switch network
    if (isAbortError(err) || err?.name === 'TypeError') {
      logError('espWifi.submitWifiConnect:assumed', err);
      return { accepted: true, assumed: true };
    }

    // Error tak terduga
    throw new AppError('Gagal mengirim permintaan koneksi ke ESP32.', {
      code: 'ESP_CONNECT_ERROR',
      cause: err,
    });
  }
};

/** POST /api/wifi/disconnect */
export const disconnectWifi = () => espFetch('/disconnect', { method: 'POST' }, 6000);

export { ESP_IP, ESP_BASE };
