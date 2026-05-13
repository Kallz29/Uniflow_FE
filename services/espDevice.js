// ============================================
// ESP Device Service - deteksi & komunikasi ESP32 di mode AP setup
// ============================================

import * as Network from 'expo-network';
import { logError } from '../utils/errorHandler';

const ESP_HOST = '192.168.4.1';
const ESP_BASE_URL = `http://${ESP_HOST}`;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Cek apakah URL ESP32 bisa dijangkau (tidak peduli konten response).
 * Pakai timeout pendek karena dipanggil saat app boot / gagal fetch backend.
 */
const pingUrl = async (url, timeoutMs = 1800) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
      },
    });
    // Status < 500 dianggap "hidup" (termasuk 4xx dari handler ESP).
    return res.status >= 200 && res.status < 500;
  } catch (err) {
    // Timeout/network error — perangkat tidak menjawab.
    if (err?.name !== 'AbortError') logError('espDevice.pingUrl', err);
    return false;
  } finally {
    clearTimeout(timer);
  }
};

/** Ambil IP lokal HP. Return null kalau gagal. */
export const getLocalIpAddress = async () => {
  try {
    return await Network.getIpAddressAsync();
  } catch (err) {
    logError('espDevice.getLocalIpAddress', err);
    return null;
  }
};

export const isEspSetupIp = (ipAddress) => !!ipAddress && ipAddress.startsWith('192.168.4.');

export const hasEspSetupIp = async () => isEspSetupIp(await getLocalIpAddress());

/**
 * Cek keberadaan ESP32 dalam mode AP dengan retry.
 * Return boolean — tidak pernah throw, aman dipanggil dari error handler.
 */
export const checkESPReachable = async ({ retries = 3, delayMs = 1000 } = {}) => {
  if (await hasEspSetupIp()) return true;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const cacheBust = Date.now();

    if (await pingUrl(`${ESP_BASE_URL}/api/wifi/status?_=${cacheBust}`)) return true;
    if (await pingUrl(`${ESP_BASE_URL}/?_=${cacheBust}`, 1000)) return true;

    if (attempt < retries) {
      await wait(delayMs);
      if (await hasEspSetupIp()) return true;
    }
  }

  return false;
};

export { ESP_BASE_URL };
