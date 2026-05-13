// ============================================
// API Service - UniFlow React Native
// ============================================
//
// Catatan:
// - Semua request sekarang lewat `apiClient` (utils/apiClient.js) yang
//   sudah menangani timeout, parsing JSON/text, dan normalisasi error.
// - Error yang di-throw dari fungsi-fungsi di file ini adalah `AppError`
//   dengan pesan siap tampil (Bahasa Indonesia).

import { BASE_URL } from '../config';
import { apiClient } from '../utils/apiClient';

// ============================================
// SENSOR
// ============================================

/** GET /api/sensors/latest */
export const getLatestSensor = () =>
  apiClient.get('/sensors/latest', { tag: 'getLatestSensor' });

/** GET /api/sensors?limit=N */
export const getAllSensors = (limit = 50) =>
  apiClient.get(`/sensors?limit=${encodeURIComponent(limit)}`, { tag: 'getAllSensors' });

/** GET /api/sensors/stats */
export const getSensorStats = () =>
  apiClient.get('/sensors/stats', { tag: 'getSensorStats' });

/** GET /api/sensors/export/csv?days=N — return URL string untuk di-share/open. */
export const getSensorCSVUrl = (days = 90) =>
  `${BASE_URL}/sensors/export/csv?days=${encodeURIComponent(days)}`;

// ============================================
// ALERTS
// ============================================

/** GET /api/alerts?unread=true&limit=N */
export const getAlerts = ({ unread = false, limit = 50 } = {}) => {
  const params = new URLSearchParams({ limit: String(limit) });
  if (unread) params.set('unread', 'true');
  return apiClient.get(`/alerts?${params.toString()}`, { tag: 'getAlerts' });
};

/** PATCH /api/alerts/:id/read */
export const markAlertRead = (id) =>
  apiClient.patch(`/alerts/${encodeURIComponent(id)}/read`, null, { tag: 'markAlertRead' });

/** PATCH /api/alerts/read-all */
export const markAllAlertsRead = () =>
  apiClient.patch('/alerts/read-all', null, { tag: 'markAllAlertsRead' });

// ============================================
// THRESHOLD
// ============================================

/** GET /api/threshold */
export const getThreshold = () =>
  apiClient.get('/threshold', { tag: 'getThreshold' });

/** PUT /api/threshold */
export const updateThreshold = (thresholdData) =>
  apiClient.put('/threshold', thresholdData, { tag: 'updateThreshold' });

/** POST /api/threshold/reset */
export const resetThreshold = () =>
  apiClient.post('/threshold/reset', null, { tag: 'resetThreshold' });

// ============================================
// DEVICES
// ============================================

/** GET /api/devices */
export const getAllDevices = () =>
  apiClient.get('/devices', { tag: 'getAllDevices' });

/** GET /api/devices/:id */
export const getDeviceById = (id) =>
  apiClient.get(`/devices/${encodeURIComponent(id)}`, { tag: 'getDeviceById' });

/** POST /api/devices */
export const createDevice = (deviceData) =>
  apiClient.post('/devices', deviceData, { tag: 'createDevice' });

/**
 * PUT /api/devices/:id
 * Body: { location: string }
 * Contoh: updateDevice(1, { location: 'Saluran Air Utama GKU' })
 */
export const updateDevice = (id, { location }) =>
  apiClient.put(`/devices/${encodeURIComponent(id)}`, { location }, {
    tag: 'updateDevice',
    fallbackErrorMsg: 'Gagal memperbarui perangkat',
  });

/** DELETE /api/devices/:id */
export const deleteDevice = (id) =>
  apiClient.del(`/devices/${encodeURIComponent(id)}`, {
    tag: 'deleteDevice',
    fallbackErrorMsg: 'Gagal menghapus perangkat',
  });

// ============================================
// CHAT
// ============================================

/** POST /api/chat/sessions */
export const createChatSession = (title = 'Sesi Baru') =>
  apiClient.post('/chat/sessions', { title }, { tag: 'createChatSession' });

/** GET /api/chat/sessions */
export const getAllChatSessions = () =>
  apiClient.get('/chat/sessions', { tag: 'getAllChatSessions' });

/**
 * PATCH /api/chat/sessions/:id — update session title.
 * Backend ada yang support PATCH, ada yang hanya PUT — coba dua-duanya.
 */
export const updateChatSession = async (sessionId, title) => {
  const path = `/chat/sessions/${encodeURIComponent(sessionId)}`;
  try {
    return await apiClient.patch(path, { title }, { tag: 'updateChatSession:PATCH' });
  } catch (patchErr) {
    // Kalau server tolak method, coba PUT sebagai fallback.
    if (patchErr?.status === 405 || patchErr?.status === 404) {
      return apiClient.put(path, { title }, { tag: 'updateChatSession:PUT' });
    }
    throw patchErr;
  }
};

/** GET /api/chat/sessions/:id/messages */
export const getChatMessages = (sessionId) =>
  apiClient.get(`/chat/sessions/${encodeURIComponent(sessionId)}/messages`, {
    tag: 'getChatMessages',
  });

/** POST /api/chat/sessions/:id/messages — kirim pesan user, butuh waktu lebih lama (AI). */
export const sendChatMessage = (sessionId, message) =>
  apiClient.post(
    `/chat/sessions/${encodeURIComponent(sessionId)}/messages`,
    { message },
    { tag: 'sendChatMessage', timeoutMs: 45000 }
  );

/** DELETE /api/chat/sessions/:id */
export const deleteChatSession = (sessionId) =>
  apiClient.del(`/chat/sessions/${encodeURIComponent(sessionId)}`, {
    tag: 'deleteChatSession',
    fallbackErrorMsg: 'Gagal menghapus sesi',
  });
