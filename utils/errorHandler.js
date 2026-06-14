// ============================================
// Error Handler - Pemetaan error → pesan user
// ============================================
//
// Tujuan:
// - Menyediakan satu tempat untuk konversi error mentah (fetch, abort,
//   JSON parse, dsb) menjadi pesan yang ramah untuk user berbahasa Indonesia.
// - Menghindari pesan "TypeError: Network request failed" bocor ke UI.
// - Memudahkan logging konsisten (tag + pesan) saat debug.

/** Kelas error khusus aplikasi — biar gampang dibedain dari error JS generic. */
export class AppError extends Error {
  constructor(message, { code = 'UNKNOWN', status, cause } = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    if (cause) this.cause = cause;
  }
}

/**
 * Cek apakah error berasal dari AbortController (request di-cancel/timeout).
 */
export const isAbortError = (err) =>
  err?.name === 'AbortError' || err?.code === 'ABORT_ERR';

/**
 * Cek apakah error berasal dari fetch gagal (offline, DNS, dsb).
 * React Native fetch melempar TypeError dengan pesan 'Network request failed'.
 */
export const isNetworkError = (err) => {
  if (!err) return false;
  if (err.name === 'TypeError') return true;
  const msg = String(err.message || '').toLowerCase();
  return (
    msg.includes('network request failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('network error')
  );
};

/**
 * Konversi error apa pun → pesan yang bisa ditampilkan ke user (Bahasa Indonesia).
 * Selalu return string, tidak pernah throw.
 */
export const toUserMessage = (err, fallback = 'Terjadi kesalahan tak terduga') => {
  if (!err) return fallback;

  if (isAbortError(err)) {
    return 'Permintaan memakan waktu terlalu lama. Periksa koneksi lalu coba lagi.';
  }

  if (isNetworkError(err)) {
    return 'Tidak dapat terhubung ke server. Periksa koneksi internet perangkat Anda.';
  }

  if (err instanceof AppError) return err.message;

  if (typeof err === 'string') return err;

  return err.message || fallback;
};

/**
 * Logger ringan: biar error tetap tercatat di console dengan tag konsisten,
 * tanpa menyebarkan detail teknis ke UI.
 */
export const logError = (tag, err) => {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.warn(`[${tag}]`, err?.message || err);
  }
};
