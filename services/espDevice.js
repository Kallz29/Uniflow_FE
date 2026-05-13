import * as Network from 'expo-network';

const ESP_HOST = '192.168.4.1';
const ESP_BASE_URL = `http://${ESP_HOST}`;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithTimeout = async (url, timeoutMs = 1800) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
      },
    });
    return res.status >= 200 && res.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
};

export const getLocalIpAddress = async () => {
  try {
    return await Network.getIpAddressAsync();
  } catch {
    return null;
  }
};

export const isEspSetupIp = (ipAddress) => ipAddress?.startsWith('192.168.4.');

export const hasEspSetupIp = async () => isEspSetupIp(await getLocalIpAddress());

export const checkESPReachable = async ({ retries = 3, delayMs = 1000 } = {}) => {
  if (await hasEspSetupIp()) return true;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const cacheBust = Date.now();
    const statusOk = await fetchWithTimeout(`${ESP_BASE_URL}/api/wifi/status?_=${cacheBust}`);
    if (statusOk) return true;

    const rootOk = await fetchWithTimeout(`${ESP_BASE_URL}/?_=${cacheBust}`, 1000);
    if (rootOk) return true;

    if (attempt < retries) {
      await wait(delayMs);
      if (await hasEspSetupIp()) return true;
    }
  }

  return false;
};

export { ESP_BASE_URL };
