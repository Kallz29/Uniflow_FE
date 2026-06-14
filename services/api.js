// ============================================
// API Service - UniFlow React Native
// ============================================
//
// Semua request lewat `apiClient` (utils/apiClient.js), yang menangani
// timeout, parsing JSON/text, dan normalisasi error menjadi AppError.

import { BASE_URL } from '../config';
import { apiClient } from '../utils/apiClient';

const buildQueryString = (params = {}) => {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });

  return query.toString();
};

const buildCsvUrl = (params = {}) => {
  const query = buildQueryString(params);
  return `${BASE_URL}/sensors/export/csv${query ? `?${query}` : ''}`;
};

// ============================================
// SENSOR
// ============================================

/** GET /api/sensors/latest */
export const getLatestSensor = () =>
  apiClient.get('/sensors/latest', { tag: 'getLatestSensor' });

/** GET /api/sensors?limit=N&start=S&end=E&zone=Z */
export const getAllSensors = (params = {}) => {
  if (typeof params === 'number') {
    return apiClient.get(`/sensors?limit=${encodeURIComponent(params)}`, { tag: 'getAllSensors' });
  }

  const query = new URLSearchParams();
  if (params.limit != null) query.set('limit', String(params.limit));
  if (params.start) query.set('start', params.start);
  if (params.end) query.set('end', params.end);
  if (params.zone) query.set('zone', params.zone);

  const qs = query.toString();
  return apiClient.get(`/sensors${qs ? `?${qs}` : ''}`, { tag: 'getAllSensors' });
};

/** GET /api/sensors/stats */
export const getSensorStats = () =>
  apiClient.get('/sensors/stats', { tag: 'getSensorStats' });

/** GET /api/sensors/export/csv?days=N */
export const getSensorCSVUrl = (days = 90) => buildCsvUrl({ days });

/** GET /api/sensors/export/csv?days=N&zone=Z&start=S&end=E */
export const exportSensorCSV = (params = {}) => {
  const query = new URLSearchParams();
  if (params.zone) query.set('zone', params.zone);
  if (params.start) query.set('start', params.start);
  if (params.end) query.set('end', params.end);
  if (params.days != null) query.set('days', String(params.days));
  const qs = query.toString();
  return `${BASE_URL}/sensors/export/csv${qs ? `?${qs}` : ''}`;
};

// ============================================
// ALERTS
// ============================================

/** GET /api/alerts?unread=true&limit=N */
export const getAlerts = ({ unread = false, limit = 50 } = {}) => {
  const query = buildQueryString({
    limit,
    unread: unread ? 'true' : undefined,
  });

  return apiClient.get(`/alerts?${query}`, { tag: 'getAlerts' });
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
 */
export const updateDevice = (id, payload) =>
  apiClient.put(
    `/devices/${encodeURIComponent(id)}`,
    payload,
    {
      tag: 'updateDevice',
      fallbackErrorMsg: 'Gagal memperbarui perangkat',
    }
  );

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
 * PATCH /api/chat/sessions/:id
 * Fallback ke PUT untuk backend yang belum mendukung PATCH.
 */
export const updateChatSession = async (sessionId, title) => {
  const path = `/chat/sessions/${encodeURIComponent(sessionId)}`;

  try {
    return await apiClient.patch(path, { title }, { tag: 'updateChatSession:PATCH' });
  } catch (patchErr) {
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

/** POST /api/chat/sessions/:id/messages */
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

// ============================================
// MEASUREMENTS
// ============================================

/** POST /api/measurements/start */
export const startMeasurement = (deviceCode) =>
  apiClient.post('/measurements/start', { device_code: deviceCode }, {
    tag: 'startMeasurement',
    timeoutMs: 30000,
    fallbackErrorMsg: 'Sesi pengukuran belum dapat dimulai',
  });

/** POST /api/measurements/stop */
export const stopMeasurement = (deviceCode) =>
  apiClient.post('/measurements/stop', { device_code: deviceCode }, {
    tag: 'stopMeasurement',
    timeoutMs: 30000,
    fallbackErrorMsg: 'Sesi pengukuran belum dapat dihentikan',
  });

/** GET /api/measurements */
export const getMeasurements = () =>
  apiClient.get('/measurements', { tag: 'getMeasurements' });
