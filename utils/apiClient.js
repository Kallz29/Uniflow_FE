// ============================================
// API Client - Wrapper fetch dengan timeout & error handling konsisten
// ============================================
//
// Semua pemanggilan REST API dari aplikasi diharapkan lewat sini supaya:
// - Timeout terpusat (default 15 detik, override per call).
// - Parsing body & error seragam (fallback ke text kalau bukan JSON).
// - Error yang di-throw selalu instance dari AppError dengan pesan
//   dalam Bahasa Indonesia, siap ditampilkan di UI.

import { BASE_URL } from '../config';
import { AppError, isAbortError, isNetworkError, logError } from './errorHandler';

const DEFAULT_TIMEOUT_MS = 15000;

/**
 * Parse body response — coba JSON dulu, fallback ke text.
 */
const parseBody = async (res) => {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

/**
 * Bangun AppError dari response yang gagal (status >= 400).
 */
const buildErrorFromResponse = async (res, fallbackMsg) => {
  const body = await parseBody(res).catch(() => null);

  let message = fallbackMsg || `Permintaan gagal (${res.status})`;
  if (body && typeof body === 'object') {
    message = body.error || body.message || message;
  } else if (typeof body === 'string' && body.trim()) {
    message = body;
  }

  return new AppError(message, {
    code: 'HTTP_ERROR',
    status: res.status,
  });
};

/**
 * Inti fetch — dengan timeout via AbortController.
 * Melempar AppError yang sudah di-normalisasi.
 *
 * @param {string} path  - path relatif (contoh: '/sensors/latest') atau URL absolut.
 * @param {object} opts  - opsi fetch standar.
 * @param {object} cfg   - { timeoutMs, tag, fallbackErrorMsg }
 */
export const request = async (path, opts = {}, cfg = {}) => {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    tag = 'api',
    fallbackErrorMsg,
    accept = 'application/json',
  } = cfg;

  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...opts,
      headers: {
        Accept: accept,
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
        ...(opts.headers || {}),
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      throw await buildErrorFromResponse(res, fallbackErrorMsg);
    }

    // 204 No Content
    if (res.status === 204) return { success: true };

    const body = await parseBody(res);
    return body ?? { success: true };
  } catch (err) {
    if (err instanceof AppError) {
      logError(tag, err);
      throw err;
    }

    if (isAbortError(err)) {
      const appErr = new AppError(
        'Permintaan memakan waktu terlalu lama. Periksa koneksi lalu coba lagi.',
        { code: 'TIMEOUT', cause: err }
      );
      logError(tag, appErr);
      throw appErr;
    }

    if (isNetworkError(err)) {
      const appErr = new AppError(
        'Tidak dapat terhubung ke server. Periksa koneksi internet perangkat Anda.',
        { code: 'NETWORK', cause: err }
      );
      logError(tag, appErr);
      throw appErr;
    }

    const appErr = new AppError(err.message || 'Terjadi kesalahan tak terduga', {
      code: 'UNKNOWN',
      cause: err,
    });
    logError(tag, appErr);
    throw appErr;
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Helper method singkat untuk setiap verb HTTP.
 */
export const apiClient = {
  get:    (path, cfg)       => request(path, { method: 'GET' }, cfg),
  post:   (path, body, cfg) => request(path, { method: 'POST',  body: body != null ? JSON.stringify(body) : undefined }, cfg),
  put:    (path, body, cfg) => request(path, { method: 'PUT',   body: body != null ? JSON.stringify(body) : undefined }, cfg),
  patch:  (path, body, cfg) => request(path, { method: 'PATCH', body: body != null ? JSON.stringify(body) : undefined }, cfg),
  del:    (path, cfg)       => request(path, { method: 'DELETE' }, cfg),
};
