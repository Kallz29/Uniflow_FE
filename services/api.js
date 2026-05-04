// ============================================
// API Service - UniFlow React Native
// ============================================

import { BASE_URL } from '../config';

const handleResponse = async (res) => {
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Terjadi kesalahan');
  return json;
};

// ============================================
// SENSOR
// ============================================

/** GET /api/sensors/latest */
export const getLatestSensor = async () => {
  const res = await fetch(`${BASE_URL}/sensors/latest`);
  return handleResponse(res);
};

/** GET /api/sensors?limit=N */
export const getAllSensors = async (limit = 50) => {
  const res = await fetch(`${BASE_URL}/sensors?limit=${limit}`);
  return handleResponse(res);
};

/** GET /api/sensors/stats */
export const getSensorStats = async () => {
  const res = await fetch(`${BASE_URL}/sensors/stats`);
  return handleResponse(res);
};

/** GET /api/sensors/export/csv?days=N → returns blob URL string */
export const getSensorCSVUrl = (days = 90) =>
  `${BASE_URL}/sensors/export/csv?days=${days}`;

// ============================================
// ALERTS
// ============================================

/** GET /api/alerts?unread=true&limit=N */
export const getAlerts = async ({ unread = false, limit = 50 } = {}) => {
  const params = new URLSearchParams({ limit });
  if (unread) params.set('unread', 'true');
  const res = await fetch(`${BASE_URL}/alerts?${params}`);
  return handleResponse(res);
};

/** PATCH /api/alerts/:id/read */
export const markAlertRead = async (id) => {
  const res = await fetch(`${BASE_URL}/alerts/${id}/read`, { method: 'PATCH' });
  return handleResponse(res);
};

/** PATCH /api/alerts/read-all */
export const markAllAlertsRead = async () => {
  const res = await fetch(`${BASE_URL}/alerts/read-all`, { method: 'PATCH' });
  return handleResponse(res);
};

// ============================================
// THRESHOLD
// ============================================

/** GET /api/threshold */
export const getThreshold = async () => {
  const res = await fetch(`${BASE_URL}/threshold`);
  return handleResponse(res);
};

/** PUT /api/threshold */
export const updateThreshold = async (thresholdData) => {
  const res = await fetch(`${BASE_URL}/threshold`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(thresholdData),
  });
  return handleResponse(res);
};

/** POST /api/threshold/reset */
export const resetThreshold = async () => {
  const res = await fetch(`${BASE_URL}/threshold/reset`, { method: 'POST' });
  return handleResponse(res);
};

// ============================================
// DEVICES
// ============================================

/** GET /api/devices */
export const getAllDevices = async () => {
  const res = await fetch(`${BASE_URL}/devices`);
  return handleResponse(res);
};

/** GET /api/devices/:id */
export const getDeviceById = async (id) => {
  const res = await fetch(`${BASE_URL}/devices/${id}`);
  return handleResponse(res);
};

/** POST /api/devices */
export const createDevice = async (deviceData) => {
  const res = await fetch(`${BASE_URL}/devices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(deviceData),
  });
  return handleResponse(res);
};

/** PUT /api/devices/:id */
export const updateDevice = async (id, deviceData) => {
  const res = await fetch(`${BASE_URL}/devices/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(deviceData),
  });
  return handleResponse(res);
};

/** DELETE /api/devices/:id */
export const deleteDevice = async (id) => {
  const res = await fetch(`${BASE_URL}/devices/${id}`, {
    method: 'DELETE',
  });

  // 204 No Content — sukses tanpa body
  if (res.status === 204) return { success: true };

  // 200 dengan body JSON
  if (res.ok) {
    try {
      const json = await res.json();
      return { success: true, ...json };
    } catch {
      return { success: true };
    }
  }

  // Error — coba parse body untuk pesan error
  let errorMsg = `Gagal menghapus device (${res.status})`;
  try {
    const text = await res.text();
    if (text) {
      try {
        const json = JSON.parse(text);
        errorMsg = json.error || json.message || text;
      } catch {
        errorMsg = text;
      }
    }
  } catch { /* ignore */ }

  throw new Error(errorMsg);
};

// ============================================
// CHAT
// ============================================

/** POST /api/chat/sessions */
export const createChatSession = async (title = 'Sesi Baru') => {
  const res = await fetch(`${BASE_URL}/chat/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  return handleResponse(res);
};

/** GET /api/chat/sessions */
export const getAllChatSessions = async () => {
  const res = await fetch(`${BASE_URL}/chat/sessions`);
  return handleResponse(res);
};

/** PATCH /api/chat/sessions/:id — update session title */
export const updateChatSession = async (sessionId, title) => {
  for (const method of ['PATCH', 'PUT']) {
    try {
      const res = await fetch(`${BASE_URL}/chat/sessions/${sessionId}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        return json;
      }
    } catch (err) {
      console.warn('[updateChatSession]', method, 'error:', err.message);
    }
  }
  throw new Error('updateChatSession: both PATCH and PUT failed');
};

/** GET /api/chat/sessions/:id/messages */
export const getChatMessages = async (sessionId) => {
  const res = await fetch(`${BASE_URL}/chat/sessions/${sessionId}/messages`);
  return handleResponse(res);
};

/** POST /api/chat/sessions/:id/messages */
export const sendChatMessage = async (sessionId, message) => {
  const res = await fetch(`${BASE_URL}/chat/sessions/${sessionId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  return handleResponse(res);
};

/** DELETE /api/chat/sessions/:id */
export const deleteChatSession = async (sessionId) => {
  const res = await fetch(`${BASE_URL}/chat/sessions/${sessionId}`, {
    method: 'DELETE',
  });

  // 204 No Content — sukses tanpa body
  if (res.status === 204) return { success: true };

  // 200 dengan body JSON
  if (res.ok) {
    try {
      const json = await res.json();
      return { success: true, ...json };
    } catch {
      return { success: true };
    }
  }

  // Error — coba parse body untuk pesan error
  let errorMsg = `Gagal menghapus sesi (${res.status})`;
  try {
    const text = await res.text();
    if (text) {
      try {
        const json = JSON.parse(text);
        errorMsg = json.error || json.message || text;
      } catch {
        errorMsg = text;
      }
    }
  } catch { /* ignore */ }

  throw new Error(errorMsg);
};