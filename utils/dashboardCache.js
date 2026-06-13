import AsyncStorage from '@react-native-async-storage/async-storage';

const DASHBOARD_CACHE_KEY = 'uniflow.dashboard.snapshot.v1';

export const saveDashboardSnapshot = async (snapshot) => {
  try {
    await AsyncStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify({
      ...snapshot,
      cachedAt: new Date().toISOString(),
    }));
  } catch {
    // Cache should never block live dashboard updates.
  }
};

export const loadDashboardSnapshot = async () => {
  try {
    const raw = await AsyncStorage.getItem(DASHBOARD_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};
