import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, ScrollView, Image, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, Dimensions,
  TextInput, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import StatusCard from './StatusCard';
import HistoryModal from './HistoryModal';
import QuickTour, { useShouldShowTour } from './QuickTour';
import ParameterCard from './ParameterCard';
import {
  getAllSensors, getLatestSensor, getSensorStats,
  getAlerts, markAlertRead, markAllAlertsRead, getThreshold,
  updateThreshold, resetThreshold,
  getAllDevices, createDevice, updateDevice, deleteDevice,
  getMeasurements,
} from '../services/api';
import { checkESPReachable } from '../services/espDevice';
import { toUserMessage, logError } from '../utils/errorHandler';
import {
  WATER_UNITS,
  buildHistory as buildHistoryFromSensor,
  buildOverallData as buildOverallSnapshot,
  getStatus,
  mapWQIStatus,
  mapSensorToCards as mapSensorCards,
  parseLocalDate as parseSensorDate,
  validateThresholdPayload,
} from '../utils/waterQuality';
import { loadDashboardSnapshot, saveDashboardSnapshot } from '../utils/dashboardCache';
import { dashboardStyles as styles } from '../styles/dashboardStyles';

// ─── Helpers ───────────────────────────────────────────────
const SEVERITY_BG = { low: '#FEF3C7', medium: '#FED7AA', high: '#FEE2E2', critical: '#FECACA' };
const SEVERITY_TEXT = { low: '#92400E', medium: '#C2410C', high: '#991B1B', critical: '#7F1D1D' };
const SEVERITY_LABEL = { low: 'Rendah', medium: 'Sedang', high: 'Tinggi', critical: 'Kritis' };

const { width: SCREEN_W } = Dimensions.get('window');
const GRID_PADDING = 16;
const GRID_GAP = 10;
const CARD_W = Math.floor((SCREEN_W - GRID_PADDING * 2 - GRID_GAP) / 2);
const DASHBOARD_REFRESH_INTERVAL = 4000;
const STOP_COLOR = '#E11D48';
const STOP_COLOR_DARK = '#BE123C';

const AVG_STATUS_STYLE = {
  good: { bg: '#F0FDF4', border: '#BBF7D0', text: '#166534', dot: '#22C55E' },
  warning: { bg: '#FFFBEB', border: '#FDE68A', text: '#92400E', dot: '#F59E0B' },
  danger: { bg: '#FEF2F2', border: '#FECACA', text: '#991B1B', dot: '#EF4444' },
};

const parseSessionDate = (str) => {
  if (!str) return new Date();
  if (str instanceof Date) return str;
  const raw = String(str).trim();
  const hasTimezone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(raw);
  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
  const parsed = new Date(hasTimezone ? raw : `${normalized}Z`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const getWqiHighlightStatus = (value, explicitStatus) => {
  if (explicitStatus) return mapWQIStatus(explicitStatus);
  const n = Number(value);
  if (!Number.isFinite(n)) return 'good';
  if (n >= 80) return 'good';
  if (n >= 60) return 'warning';
  return 'danger';
};

const normalizeDevice = (device) => ({
  ...device,
  status: device?.status || 'inactive',
});

const normalizeDevices = (list = []) => list.map(normalizeDevice);

const buildEditingLocation = (list = []) => {
  const init = {};
  list.forEach((d) => { init[d.id] = d.location || ''; });
  return init;
};

const LoadingSkeleton = () => (
  <View style={{ padding: 16, gap: 12 }}>
    <View style={{
      height: 118, borderRadius: 16, backgroundColor: '#DDEFF7',
      borderWidth: 1, borderColor: '#C5DDE8',
    }} />
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {[0, 1, 2, 3].map((i) => (
        <View
          key={i}
          style={{ flex: 1, height: 56, borderRadius: 12, backgroundColor: '#EAF4FB', borderWidth: 1, borderColor: '#D4E8F2' }}
        />
      ))}
    </View>
    <View style={{ height: 46, borderRadius: 12, backgroundColor: '#DDEFF7' }} />
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <View style={{ flex: 1, height: 154, borderRadius: 16, backgroundColor: '#DDEFF7' }} />
      <View style={{ flex: 1, height: 154, borderRadius: 16, backgroundColor: '#DDEFF7' }} />
    </View>
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <View style={{ flex: 1, height: 154, borderRadius: 16, backgroundColor: '#DDEFF7' }} />
      <View style={{ flex: 1, height: 154, borderRadius: 16, backgroundColor: '#DDEFF7' }} />
    </View>
    <Text style={{ alignSelf: 'center', color: '#8BAFC0', fontSize: 12, marginTop: 4 }}>
      Memuat data sensor...
    </Text>
  </View>
);

// ─── Parameter Card ────────────────────────────────────────
// ─── Dashboard ─────────────────────────────────────────────
export default function Dashboard({ onNavigateToAbout, onNavigateToAI, onNavigateToWifi, onNavigateToMeasurement }) {
  // ── Navigation & History ──
  const [selectedParameter, setSelectedParameter] = useState(null);
  const [showOverallHistory, setShowOverallHistory] = useState(false);

  // ── Alerts ──
  const [showAlertsModal, setShowAlertsModal] = useState(false);

  // ── Settings Menu ──
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

  // ── Threshold Modal ──
  const [showThresholdModal, setShowThresholdModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [thresholdForm, setThresholdForm] = useState(null);
  const [thresholdSaving, setThresholdSaving] = useState(false);
  const [thresholdMsg, setThresholdMsg] = useState(null);

  // ── Device Modal ──
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [devices, setDevices] = useState([]);
  const [sensorDeviceStatus, setSensorDeviceStatus] = useState('inactive');
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [deviceSaving, setDeviceSaving] = useState(null);
  const [deviceMsg, setDeviceMsg] = useState(null);
  const [editingLocation, setEditingLocation] = useState({});
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [editingDeviceCode, setEditingDeviceCode] = useState('');
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [newDeviceCode, setNewDeviceCode] = useState('');
  const [newDeviceLocation, setNewDeviceLocation] = useState('');
  const [addingDevice, setAddingDevice] = useState(false);

  // ── Sensor/Alert/Threshold Data ──
  const [qualityData, setQualityData] = useState([]);
  const [overallData, setOverallData] = useState(null);
  const [historyList, setHistoryList] = useState([]);
  const [allZones, setAllZones] = useState([]);
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [threshold, setThreshold] = useState(null);

  // Measurement Session
  const [activeMeasurement, setActiveMeasurement] = useState(null);
  const [measurementsList, setMeasurementsList] = useState([]);
  const [elapsed, setElapsed] = useState(0);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshToast, setRefreshToast] = useState(null);
  const [showTour, setShowTour] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);
  const [usingCachedData, setUsingCachedData] = useState(false);
  const [cachedAt, setCachedAt] = useState(null);
  const toastTimeout = useRef(null);
  const refWQI = useRef(null);
  const refStats = useRef(null);
  const refParams = useRef(null);
  const refStartBtn = useRef(null);
  const refNotifBtn = useRef(null);
  const refAI = useRef(null);
  const refSettingBtn = useRef(null);
  const refHeader = useRef(null);
  const scrollRef = useRef(null);
  const [tourScrollY, setTourScrollY] = useState(0);
  const [tourLayouts, setTourLayouts] = useState({});
  const { shouldShowTour, tourChecked, resetTour } = useShouldShowTour();

  const captureTourLayout = useCallback((key) => (event) => {
    const { x, y, width, height } = event.nativeEvent.layout;
    setTourLayouts((prev) => {
      const old = prev[key];
      if (
        old
        && old.x === x
        && old.y === y
        && old.width === width
        && old.height === height
      ) {
        return prev;
      }
      return { ...prev, [key]: { x, y, width, height } };
    });
  }, []);

  const insetTourLayout = useCallback((key, insetX = 0, insetY = 0, insetBottom = 0) => {
    const layout = tourLayouts[key];
    if (!layout) return undefined;

    return {
      x: layout.x + insetX,
      y: layout.y + insetY,
      width: Math.max(1, layout.width - insetX * 2),
      height: Math.max(1, layout.height - insetY - insetBottom),
    };
  }, [tourLayouts]);

  const getHeaderIconTourLayout = useCallback((index) => {
    const header = tourLayouts.refHeader;
    if (!header) return undefined;

    const iconSize = 36;
    const gap = 8;
    const rightPadding = 20;
    const iconCount = 4;
    const iconsWidth = iconSize * iconCount + gap * (iconCount - 1);
    return {
      x: SCREEN_W - rightPadding - iconsWidth + index * (iconSize + gap),
      y: header.y + 52 + 4,
      width: iconSize,
      height: iconSize,
    };
  }, [tourLayouts.refHeader]);

  const applyDashboardSnapshot = useCallback((snapshot) => {
    let {
      latest = {},
      list = [],
      statsData = {},
      alertList = [],
      th = {},
      devicesList = [],
      measurementSessions = [],
    } = snapshot || {};

    devicesList = normalizeDevices(devicesList);
    const active = measurementSessions.find((s) => s.status === 'active') || null;
    setThreshold(th);
    setActiveMeasurement(active);
    setMeasurementsList(measurementSessions);
    setDevices(devicesList);

    const latestDevice = devicesList.find((device) => (
      (latest.device_id != null && device.id === latest.device_id)
      || (latest.device_code && device.device_code === latest.device_code)
      || (latest.device?.device_code && device.device_code === latest.device.device_code)
    ));
    setSensorDeviceStatus(
      latestDevice?.status || (devicesList.some((d) => d.status === 'active') ? 'active' : 'inactive')
    );

    const zonesFromDevices = devicesList.map((d) => d.location).filter(Boolean);
    const zonesFromHistory = list.map((item) => item.session_location || item.location).filter(Boolean);
    const zonesFromMeasurements = measurementSessions.map((item) => item.location).filter(Boolean);
    setAllZones([...new Set([...zonesFromDevices, ...zonesFromHistory, ...zonesFromMeasurements])].sort());

    setQualityData(mapSensorCards(latest, th));
    setHistoryList(list);
    setStats(statsData);
    setAlerts(alertList);

    setUnreadCount(alertList.filter((a) => !a.is_read).length);

    setOverallData(buildOverallSnapshot(latest, list));
    setLastUpdated(parseSensorDate(latest.created_at || snapshot?.cachedAt));
  }, []);

  // ─── Fetch data ──────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [latestRes, allRes, statsRes, alertsRes, thresholdRes] = await Promise.all([
        getLatestSensor(), getAllSensors({ limit: 100 }), getSensorStats(),
        getAlerts({ limit: 20 }), getThreshold(),
      ]);

      const latest = latestRes.data;
      const list = allRes.data || [];
      const statsData = statsRes.data || {};
      const alertList = alertsRes.data || [];
      const th = thresholdRes.data || {};
      let devicesList = [];
      let measurementSessions = [];

      setThreshold(th);

      try {
        const measRes = await getMeasurements();
        measurementSessions = measRes.data || [];
        const active = measurementSessions.find((s) => s.status === 'active') || null;
        setActiveMeasurement(active);
        setMeasurementsList(measurementSessions);
      } catch (_) {
        // Dashboard tetap bisa tampil meski endpoint measurement gagal.
      }

      try {
        const devRes = await getAllDevices();
        devicesList = normalizeDevices(devRes.data || []);
        setDevices(devicesList);
      } catch (_) {
        // Indikator offline tidak boleh membuat dashboard gagal dimuat.
      }

      const snapshot = {
        latest,
        list,
        statsData,
        alertList,
        th,
        devicesList,
        measurementSessions,
      };
      applyDashboardSnapshot(snapshot);
      setUsingCachedData(false);
      setCachedAt(null);
      await saveDashboardSnapshot(snapshot);
    } catch (err) {
      logError('Dashboard.fetchData', err);
      const cached = await loadDashboardSnapshot();
      if (cached) {
        applyDashboardSnapshot(cached);
        setUsingCachedData(true);
        setCachedAt(parseSensorDate(cached.cachedAt));
        setError(`${toUserMessage(err, 'Gagal memuat data sensor')} Menampilkan data terakhir yang tersimpan.`);
        return;
      }

      // Kalau backend tidak jawab tapi ESP32 di jangkauan, arahkan user ke WiFi setup.
      const espReachable = await checkESPReachable({ retries: 1, delayMs: 600 });
      if (espReachable) {
        onNavigateToWifi?.();
        return;
      }
      setError(toUserMessage(err, 'Gagal memuat data sensor'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [applyDashboardSnapshot, onNavigateToWifi]);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, DASHBOARD_REFRESH_INTERVAL);
    return () => {
      clearInterval(iv);
      clearTimeout(toastTimeout.current);
    };
  }, [fetchData]);

  useEffect(() => {
    if (tourChecked && shouldShowTour && !loading) {
      const t = setTimeout(() => setShowTour(true), 800);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [tourChecked, shouldShowTour, loading]);

  useEffect(() => {
    if (!activeMeasurement?.start_time) {
      setElapsed(0);
      return;
    }

    const startMs = parseSessionDate(activeMeasurement.start_time).getTime();
    const tick = () => {
      if (Number.isNaN(startMs)) {
        setElapsed(0);
        return;
      }
      const diff = Math.floor((Date.now() - startMs) / 1000);
      setElapsed(diff > 0 ? diff : 0);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [activeMeasurement?.start_time]);

  const showToast = (msg) => {
    setRefreshToast(msg);
    clearTimeout(toastTimeout.current);
    toastTimeout.current = setTimeout(() => setRefreshToast(null), 2500);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    const now = new Date();
    showToast(`Diperbarui ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')} WIB`);
  };

  // ─── Alert handlers ──────────────────────────────────────
  const handleMarkRead = async (id) => {
    try {
      await markAlertRead(id);
      setAlerts((p) => p.map((a) => a.id === id ? { ...a, is_read: true } : a));
      setUnreadCount((p) => Math.max(0, p - 1));
    } catch (err) {
      logError('Dashboard.markRead', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAlertsRead();
      setAlerts((p) => p.map((a) => ({ ...a, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      logError('Dashboard.markAllRead', err);
    }
  };

  // ─── Settings Menu ───────────────────────────────────────
  const openSettingsMenu = () => setShowSettingsMenu(true);

  const openWifiManager = () => {
    setShowSettingsMenu(false);
    onNavigateToWifi?.();
  };

  // ─── Threshold handlers ──────────────────────────────────
  const openThreshold = () => {
    setShowSettingsMenu(false);
    setThresholdForm(threshold ? { ...threshold } : {
      ph_min: '6.5', ph_max: '8.5',
      temp_min: '25', temp_max: '30',
      tds_min: '0', tds_max: '500',
      tss_min: '0', tss_max: '25',
    });
    setThresholdMsg(null);
    setShowThresholdModal(true);
  };

  const handleSaveThreshold = async () => {
    setThresholdSaving(true);
    try {
      const payload = {
        ph_min: parseFloat(thresholdForm.ph_min),
        ph_max: parseFloat(thresholdForm.ph_max),
        temp_min: parseFloat(thresholdForm.temp_min),
        temp_max: parseFloat(thresholdForm.temp_max),
        tds_min: parseFloat(thresholdForm.tds_min),
        tds_max: parseFloat(thresholdForm.tds_max),
        tss_min: parseFloat(thresholdForm.tss_min),
        tss_max: parseFloat(thresholdForm.tss_max),
      };
      for (const [k, v] of Object.entries(payload)) {
        if (isNaN(v)) throw new Error(`Nilai "${k}" tidak valid`);
      }
      const validationError = validateThresholdPayload(payload);
      if (validationError) {
        setThresholdMsg({ type: 'err', text: validationError });
        return;
      }
      await updateThreshold(payload);
      setThresholdMsg({ type: 'ok', text: 'Threshold berhasil diperbarui!' });
      fetchData();
    } catch (err) {
      logError('Dashboard.saveThreshold', err);
      setThresholdMsg({ type: 'err', text: toUserMessage(err, 'Gagal menyimpan threshold') });
    } finally {
      setThresholdSaving(false);
    }
  };

  const handleResetThreshold = () => setShowResetConfirm(true);

  const doResetThreshold = async () => {
    setShowResetConfirm(false);
    try {
      await resetThreshold();
      const freshRes = await getThreshold();
      const freshTh = freshRes.data || {};
      setThreshold(freshTh);
      setThresholdForm({ ...freshTh });
      setThresholdMsg({ type: 'ok', text: 'Threshold direset ke default.' });
      fetchData();
    } catch (err) {
      logError('Dashboard.resetThreshold', err);
      setThresholdMsg({ type: 'err', text: toUserMessage(err, 'Gagal reset threshold') });
    }
  };

  // ─── Device handlers ─────────────────────────────────────
  const openDeviceModal = async () => {
    setShowSettingsMenu(false);
    setDeviceMsg(null);
    setSelectedDevice(null);
    setEditingDeviceCode('');
    setShowAddDevice(false);
    setNewDeviceCode('');
    setNewDeviceLocation('');
    setShowDeviceModal(true);
    setDeviceLoading(true);
    try {
      const res = await getAllDevices();
      const list = normalizeDevices(res.data || []);
      setDevices(list);
      setEditingLocation(buildEditingLocation(list));
    } catch (err) {
      logError('Dashboard.loadDevices', err);
      setDeviceMsg({ type: 'err', text: toUserMessage(err, 'Gagal memuat perangkat') });
    } finally {
      setDeviceLoading(false);
    }
  };

  const validateDeviceCode = (code) => {
    if (!code) return 'Kode device tidak boleh kosong';
    if (code.length < 3) return 'Kode device minimal 3 karakter';
    if (!/^[a-zA-Z0-9_-]+$/.test(code)) {
      return 'Kode device hanya boleh memakai huruf, angka, dash, atau underscore';
    }
    return null;
  };

  const handleSaveDeviceLocation = async (deviceId) => {
    const loc = editingLocation[deviceId]?.trim();
    if (!loc) {
      setDeviceMsg({ type: 'err', text: 'Lokasi tidak boleh kosong' });
      return;
    }
    setDeviceSaving(deviceId);
    setDeviceMsg(null);
    try {
      await updateDevice(deviceId, { location: loc });
      setDevices((prev) =>
        prev.map((d) => d.id === deviceId ? { ...d, location: loc } : d)
      );
      setSelectedDevice((prev) =>
        prev?.id === deviceId ? { ...prev, location: loc } : prev
      );
      setDeviceMsg({ type: 'ok', text: 'Lokasi perangkat berhasil diperbarui!' });
    } catch (err) {
      logError('Dashboard.saveDeviceLocation', err);
      setDeviceMsg({ type: 'err', text: toUserMessage(err, 'Gagal menyimpan lokasi') });
    } finally {
      setDeviceSaving(null);
    }
  };

  // ─── History helpers ─────────────────────────────────────
  const getHistoryForParam = (id) => {
    const map = {
      1: ['ph', 'pH'],
      2: ['temperature', WATER_UNITS.temperature],
      3: ['tds', 'ppm'],
      4: ['turbidity', 'NTU'],
    };
    const [field, unit] = map[id] || [];
    return buildHistoryFromSensor(historyList, field, unit, threshold);
  };

  const selectedData = qualityData.find((d) => d.id === selectedParameter);
  const selectedDataWithHistory = selectedData
    ? { ...selectedData, history: getHistoryForParam(selectedParameter) }
    : null;

  const formatLastUpdated = () => {
    if (!lastUpdated) return 'Memuat...';
    const diffMs = Date.now() - lastUpdated.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Baru saja';
    if (diffMin < 60) return `${diffMin} menit lalu`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} jam lalu`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 7) return `${diffDay} hari lalu`;
    return lastUpdated.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const handleDeleteDevice = (device) => {
    Alert.alert(
      'Hapus device?',
      `${device.device_code || `Device #${device.id}`} akan dihapus dari daftar perangkat.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            setDeviceSaving(`${device.id}_delete`);
            setDeviceMsg(null);
            try {
              await deleteDevice(device.id);
              setDevices((prev) => prev.filter((d) => d.id !== device.id));
              setEditingLocation((prev) => {
                const next = { ...prev };
                delete next[device.id];
                return next;
              });
              setSelectedDevice(null);
              setDeviceMsg({ type: 'ok', text: 'Device berhasil dihapus.' });
            } catch (err) {
              setDeviceMsg({ type: 'err', text: toUserMessage(err, 'Gagal menghapus device') });
            } finally {
              setDeviceSaving(null);
            }
          },
        },
      ],
    );
  };

  const formatCachedAt = () => {
    if (!cachedAt) return 'waktu tidak diketahui';
    return cachedAt.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatElapsed = (sec) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const getAverageStats = () => {
    if (!stats) return [];
    const th = threshold || {};
    const historyWqi = (historyList || [])
      .map((item) => Number(item?.wqi_score))
      .filter(Number.isFinite);
    const computedAvgWqi = historyWqi.length
      ? historyWqi.reduce((sum, value) => sum + value, 0) / historyWqi.length
      : null;
    const wqiValue = stats.avg_wqi_score ?? stats.avg_wqi ?? stats.wqi_score ?? computedAvgWqi;
    const wqiStatus = getWqiHighlightStatus(wqiValue, stats.avg_wqi_status);

    return [
      {
        label: 'Avg WQI',
        value: wqiValue != null ? String(Math.round(Number(wqiValue))) : '-',
        status: wqiValue != null ? wqiStatus : 'good',
      },
      {
        label: 'Avg pH',
        value: stats.avg_ph != null ? String(parseFloat(stats.avg_ph).toFixed(1)) : '-',
        status: getStatus(stats.avg_ph, th.ph_min ?? 6.5, th.ph_max ?? 8.5),
      },
      {
        label: 'Avg Suhu',
        value: stats.avg_temperature != null ? `${parseFloat(stats.avg_temperature).toFixed(1)}${WATER_UNITS.temperature}` : '-',
        status: getStatus(stats.avg_temperature, th.temp_min ?? 10, th.temp_max ?? 35),
      },
      {
        label: 'Avg ppm',
        value: stats.avg_tds != null ? String(parseFloat(stats.avg_tds).toFixed(0)) : '-',
        status: getStatus(stats.avg_tds, th.tds_min ?? 0, th.tds_max ?? 500),
      },
      {
        label: 'Avg NTU',
        value: stats.avg_turbidity != null ? String(parseFloat(stats.avg_turbidity).toFixed(1)) : '-',
        status: getStatus(stats.avg_turbidity, th.tss_min ?? 0, th.tss_max ?? 25),
      },
    ];
  };

  const overallStatusText =
    overallData?.status === 'danger' ? 'Ada parameter di luar batas aman' :
      overallData?.status === 'warning' ? 'Beberapa parameter mendekati batas' :
        'Semua parameter dalam batas aman';

  const cardRows = [];
  for (let i = 0; i < qualityData.length; i += 2) {
    cardRows.push(qualityData.slice(i, i + 2));
  }

  const THRESHOLD_FIELDS = [
    { label: 'pH', minKey: 'ph_min', maxKey: 'ph_max' },
    { label: `Suhu (${WATER_UNITS.temperature})`, minKey: 'temp_min', maxKey: 'temp_max' },
    { label: 'TDS (ppm)', minKey: 'tds_min', maxKey: 'tds_max' },
    { label: 'Kekeruhan / TSS (NTU)', minKey: 'tss_min', maxKey: 'tss_max' },
  ];

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      showsVerticalScrollIndicator={false}
      onScroll={(event) => setTourScrollY(event.nativeEvent.contentOffset.y)}
      scrollEventThrottle={16}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7CB9D8" />}
    >
      {/* ── Header ── */}
      <View ref={refHeader} onLayout={captureTourLayout('refHeader')} style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.logoContainer}>
            <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />
            <View>
              <Text style={styles.headerTitle}>UniFlow</Text>
              <Text style={styles.headerSubtitle}>Monitoring Kualitas Air</Text>
            </View>
          </View>
          <View style={styles.headerIcons}>
            {/* Notifications */}
            <TouchableOpacity
              ref={refNotifBtn}
              onLayout={captureTourLayout('refNotifBtn')}
              onPress={() => setShowAlertsModal(true)}
              style={styles.statusIndicator}
            >
              <Ionicons name="notifications" size={20} color="#FFFFFF" />
              {unreadCount > 0 && (
                <View style={{
                  position: 'absolute', top: -4, right: -4,
                  backgroundColor: '#EF4444', borderRadius: 8,
                  minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center',
                }}>
                  <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            {/* About */}
            <TouchableOpacity onPress={onNavigateToAbout} style={styles.statusIndicator}>
              <Ionicons name="person" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            {/* AI Chat */}
            <TouchableOpacity
              ref={refAI}
              onLayout={captureTourLayout('refAI')}
              onPress={onNavigateToAI}
              style={styles.statusIndicator}
            >
              <Ionicons name="chatbubble-ellipses" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            {/* Settings */}
            <TouchableOpacity
              ref={refSettingBtn}
              onLayout={captureTourLayout('refSettingBtn')}
              onPress={openSettingsMenu}
              style={styles.statusIndicator}
            >
              <Ionicons name="settings-outline" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── Error banner ── */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>Gagal mengambil data: {error}</Text>
          <TouchableOpacity onPress={fetchData}>
            <Text style={styles.errorRetry}>Coba lagi {'\u2192'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {usingCachedData && (
        <View style={{
          marginHorizontal: 16,
          marginTop: error ? -6 : 12,
          marginBottom: 10,
          backgroundColor: '#FFF7ED',
          borderRadius: 12,
          borderWidth: 1,
          borderColor: '#FED7AA',
          padding: 11,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}>
          <Ionicons name="cloud-offline-outline" size={16} color="#C2410C" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#9A3412' }}>Data terakhir tersimpan</Text>
            <Text style={{ fontSize: 11, color: '#C2410C', marginTop: 1 }}>
              Snapshot {formatCachedAt()} - tarik untuk mencoba data live.
            </Text>
          </View>
        </View>
      )}

      {/* Refresh Toast */}
      {refreshToast && (
        <View style={{
          position: 'absolute', bottom: 24, alignSelf: 'center',
          backgroundColor: 'rgba(26,48,64,0.88)', borderRadius: 20,
          paddingHorizontal: 16, paddingVertical: 8,
          flexDirection: 'row', alignItems: 'center', gap: 6, zIndex: 99,
        }}>
          <Ionicons name="checkmark-circle" size={14} color="#4ADE80" />
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>{refreshToast}</Text>
        </View>
      )}

      {loading ? (
        <LoadingSkeleton />
      ) : (
        <>
          <View ref={refWQI} onLayout={captureTourLayout('refWQI')} style={styles.statusSection}>
            <StatusCard
              onHistoryClick={() => setShowOverallHistory(true)}
              wqiScore={overallData?.value}
              wqiStatus={overallData?.status}
            />
          </View>

          {stats && (
            <View ref={refStats} onLayout={captureTourLayout('refStats')} style={styles.statsStrip}>
              {getAverageStats().map((s) => {
                const statusStyle = AVG_STATUS_STYLE[s.status] || AVG_STATUS_STYLE.good;
                return (
                <View
                  key={s.label}
                  style={[
                    styles.statItem,
                    {
                      backgroundColor: statusStyle.bg,
                      borderColor: statusStyle.border,
                    },
                  ]}
                >
                  <Text style={[styles.statValue, { color: statusStyle.text }]}>{s.value}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
                );
              })}
            </View>
          )}

          {/* Start / Stop Measurement */}
          <View ref={refStartBtn} onLayout={captureTourLayout('refStartBtn')} style={{ paddingHorizontal: 16, paddingBottom: 4 }}>
            <TouchableOpacity
              onPress={() => onNavigateToMeasurement?.()}
              activeOpacity={0.85}
              style={{
                backgroundColor: activeMeasurement ? STOP_COLOR : '#5AA3C8',
                borderRadius: 14,
                minHeight: activeMeasurement ? 72 : 50,
                paddingVertical: activeMeasurement ? 12 : 13,
                paddingHorizontal: 16,
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 10,
                shadowColor: activeMeasurement ? STOP_COLOR_DARK : '#3E8FB8',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.16,
                shadowRadius: 10,
                elevation: 3,
              }}
            >
              <Ionicons name={activeMeasurement ? 'stop-circle' : 'play-circle'} size={activeMeasurement ? 24 : 18} color="#fff" />
              <View style={{ alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: activeMeasurement ? 16 : 14, textAlign: 'center' }}>
                  {activeMeasurement ? 'Stop' : 'Start'}
                </Text>
                {activeMeasurement && (
                  <Text style={{ color: 'rgba(255,255,255,0.86)', fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 2 }}>
                    {formatElapsed(elapsed)} - {activeMeasurement.location || activeMeasurement.device?.location || 'Sesi Aktif'}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.metricsSection}>
            <View style={styles.sectionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.sectionTitle}>Parameter Air</Text>
                <View style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: sensorDeviceStatus === 'active' ? '#ECFDF5' : '#FFF7ED',
                  borderWidth: 1,
                  borderColor: sensorDeviceStatus === 'active' ? '#BBF7D0' : '#FED7AA',
                }}>
                  <Ionicons
                    name={sensorDeviceStatus === 'active' ? 'radio-outline' : 'cloud-offline-outline'}
                    size={13}
                    color={sensorDeviceStatus === 'active' ? '#16A34A' : '#C2410C'}
                  />
                </View>
              </View>
              <Text style={styles.updateTime}>Diperbarui {formatLastUpdated()}</Text>
            </View>
          </View>

          <View ref={refParams} onLayout={captureTourLayout('refParams')} style={styles.cardsGrid}>
            {cardRows.map((row, rowIdx) => (
              <View key={rowIdx} style={styles.cardRow}>
                {row.map((item) => {
                  return (
                    <ParameterCard
                      key={item.id}
                      item={item}
                      width={CARD_W}
                      onPress={() => setSelectedParameter(item.id)}
                    />
                  );
                })}
              </View>
            ))}
          </View>

          <View style={styles.infoSection}>
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <View style={styles.infoDot} />
                <Text style={styles.infoText}>{overallStatusText}</Text>
              </View>
              <Text style={styles.infoSubtext}>PERMENKES RI No. 32 Tahun 2017 Terkait Air Tersanitasi Dengan Mengambil 4 Parameter</Text>
            </View>
          </View>
        </>
      )}

      {/* ══════════════════════════════════════════════════
          ── Settings Menu Modal ──
      ══════════════════════════════════════════════════ */}
      <Modal
        visible={showSettingsMenu}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSettingsMenu(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: '#fff',
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            paddingBottom: 36,
          }}>
            {/* Handle bar */}
            <View style={{ alignItems: 'center', paddingTop: 12, marginBottom: 4 }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#D1E8F5' }} />
            </View>

            {/* Header */}
            <View style={{
              flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              paddingHorizontal: 20, paddingVertical: 14,
              borderBottomWidth: 1, borderBottomColor: '#EAF4FB',
            }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#1A3040' }}>Pengaturan</Text>
              <TouchableOpacity onPress={() => setShowSettingsMenu(false)}>
                <Ionicons name="close" size={22} color="#8BAFC0" />
              </TouchableOpacity>
            </View>

            {/* Menu items */}
            <View style={{ padding: 16, gap: 12 }}>

              {/* Threshold */}
              <TouchableOpacity
                onPress={openThreshold}
                activeOpacity={0.85}
                style={{
                  flexDirection: 'row', alignItems: 'center',
                  backgroundColor: '#F0F9FF',
                  borderRadius: 16, padding: 16,
                  borderWidth: 1.5, borderColor: '#D1E8F5',
                }}
              >
                <View style={{
                  width: 46, height: 46, borderRadius: 23,
                  backgroundColor: '#5AA3C8',
                  justifyContent: 'center', alignItems: 'center',
                  marginRight: 14,
                }}>
                  <Ionicons name="options-outline" size={22} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#1A3040' }}>
                    Pengaturan Threshold
                  </Text>
                  <Text style={{ fontSize: 12, color: '#8BAFC0', marginTop: 2 }}>
                    Atur batas min &amp; maks tiap parameter
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#B0CFE0" />
              </TouchableOpacity>

              {/* Device & Location */}
              <TouchableOpacity
                onPress={openDeviceModal}
                activeOpacity={0.85}
                style={{
                  flexDirection: 'row', alignItems: 'center',
                  backgroundColor: '#F0F9FF',
                  borderRadius: 16, padding: 16,
                  borderWidth: 1.5, borderColor: '#D1E8F5',
                }}
              >
                <View style={{
                  width: 46, height: 46, borderRadius: 23,
                  backgroundColor: '#3E8FB8',
                  justifyContent: 'center', alignItems: 'center',
                  marginRight: 14,
                }}>
                  <Ionicons name="hardware-chip-outline" size={22} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#1A3040' }}>
                    Perangkat &amp; Lokasi
                  </Text>
                  <Text style={{ fontSize: 12, color: '#8BAFC0', marginTop: 2 }}>
                    Kelola nama lokasi setiap perangkat
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#B0CFE0" />
              </TouchableOpacity>

              {/* WiFi Manager */}
              <TouchableOpacity
                onPress={openWifiManager}
                activeOpacity={0.85}
                style={{
                  flexDirection: 'row', alignItems: 'center',
                  backgroundColor: '#F0F9FF',
                  borderRadius: 16, padding: 16,
                  borderWidth: 1.5, borderColor: '#D1E8F5',
                }}
              >
                <View style={{
                  width: 46, height: 46, borderRadius: 23,
                  backgroundColor: '#2E7CA8',
                  justifyContent: 'center', alignItems: 'center',
                  marginRight: 14,
                }}>
                  <Ionicons name="wifi-outline" size={22} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#1A3040' }}>
                    WiFi Manager ESP32
                  </Text>
                  <Text style={{ fontSize: 12, color: '#8BAFC0', marginTop: 2 }}>
                    Hubungkan UniFlow ke jaringan WiFi
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#B0CFE0" />
              </TouchableOpacity>

              {/* Ulangi Tour */}
              <TouchableOpacity
                onPress={async () => {
                  setShowSettingsMenu(false);
                  await resetTour();
                  setTimeout(() => setShowTour(true), 300);
                }}
                activeOpacity={0.85}
                style={{
                  flexDirection: 'row', alignItems: 'center',
                  backgroundColor: '#F0F9FF', borderRadius: 16, padding: 16,
                  borderWidth: 1.5, borderColor: '#D1E8F5',
                }}
              >
                <View style={{
                  width: 46, height: 46, borderRadius: 23, backgroundColor: '#7CB9D8',
                  justifyContent: 'center', alignItems: 'center', marginRight: 14,
                }}>
                  <Ionicons name="help-circle-outline" size={22} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#1A3040' }}>Panduan Aplikasi</Text>
                  <Text style={{ fontSize: 12, color: '#8BAFC0', marginTop: 2 }}>Ulangi tour fitur UniFlow</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#B0CFE0" />
              </TouchableOpacity>

            </View>
          </View>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════════
          ── Alerts Modal ──
      ══════════════════════════════════════════════════ */}
      <Modal
        visible={showAlertsModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAlertsModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '75%' }}>
            <View style={{
              flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              padding: 16, borderBottomWidth: 1, borderBottomColor: '#EAF4FB',
            }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#1A3040' }}>Notifikasi Alert</Text>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                {unreadCount > 0 && (
                  <TouchableOpacity onPress={handleMarkAllRead}>
                    <Text style={{ fontSize: 12, color: '#7CB9D8', fontWeight: '600' }}>Tandai semua dibaca</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setShowAlertsModal(false)}>
                  <Ionicons name="close" size={22} color="#8BAFC0" />
                </TouchableOpacity>
              </View>
            </View>
            <ScrollView style={{ padding: 16 }}>
              {alerts.length === 0 ? (
                <View style={{ padding: 32, alignItems: 'center' }}>
                  <Ionicons name="checkmark-circle" size={40} color="#7CB9D8" />
                  <Text style={{ color: '#8BAFC0', marginTop: 8, fontSize: 13 }}>Tidak ada alert</Text>
                </View>
              ) : alerts.map((alert) => (
                <TouchableOpacity
                  key={alert.id}
                  onPress={() => !alert.is_read && handleMarkRead(alert.id)}
                  style={{
                    backgroundColor: '#F8FBFF',
                    borderRadius: 16,
                    padding: 14,
                    marginBottom: 12,
                    borderWidth: 1.5,
                    borderColor: alert.is_read ? '#EAF4FB' : '#FECACA',
                    shadowColor: '#1A3040',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.06,
                    shadowRadius: 10,
                    elevation: 2,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <View style={{
                      width: 34,
                      height: 34,
                      borderRadius: 12,
                      backgroundColor: alert.is_read ? '#EAF4FB' : (SEVERITY_BG[alert.severity] || '#FEE2E2'),
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Ionicons
                        name={alert.is_read ? 'notifications-outline' : 'warning-outline'}
                        size={17}
                        color={alert.is_read ? '#8BAFC0' : (SEVERITY_TEXT[alert.severity] || '#DC2626')}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: alert.is_read ? '#9CA3AF' : (SEVERITY_TEXT[alert.severity] || '#DC2626') }}>
                      {alert.parameter?.toUpperCase()} — {SEVERITY_LABEL[alert.severity] || alert.severity}
                    </Text>
                    </View>
                    {!alert.is_read && (
                      <View style={{ backgroundColor: '#FEE2E2', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 }}>
                        <Text style={{ color: '#DC2626', fontSize: 9, fontWeight: '800' }}>BARU</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ fontSize: 13, color: '#374151', lineHeight: 18 }}>{alert.message}</Text>
                  <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>
                    Nilai: {alert.value} | Batas: {alert.threshold_min}{'\u2013'}{alert.threshold_max}
                  </Text>
                  <Text style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>
                    {new Date(alert.created_at.replace('Z', '')).toLocaleString('id-ID')}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════════
          ── Threshold Modal ──
      ══════════════════════════════════════════════════ */}
      <Modal
        visible={showThresholdModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowThresholdModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' }}>
            {/* Header */}
            <View style={{
              flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              padding: 16, borderBottomWidth: 1, borderBottomColor: '#EAF4FB',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <TouchableOpacity
                  onPress={() => { setShowThresholdModal(false); setShowSettingsMenu(true); }}
                  style={{ marginRight: 2 }}
                >
                  <Ionicons name="chevron-back" size={20} color="#5AA3C8" />
                </TouchableOpacity>
                <Ionicons name="options-outline" size={18} color="#5AA3C8" />
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#1A3040' }}>Pengaturan Threshold</Text>
              </View>
              <TouchableOpacity onPress={() => setShowThresholdModal(false)}>
                <Ionicons name="close" size={22} color="#8BAFC0" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: 16 }} keyboardShouldPersistTaps="handled">
              {thresholdMsg && (
                <View style={{
                  backgroundColor: thresholdMsg.type === 'ok' ? '#D1FAE5' : '#FEE2E2',
                  borderRadius: 10, padding: 11, marginBottom: 14,
                  flexDirection: 'row', alignItems: 'center', gap: 8,
                }}>
                  <Ionicons
                    name={thresholdMsg.type === 'ok' ? 'checkmark-circle' : 'alert-circle'}
                    size={16}
                    color={thresholdMsg.type === 'ok' ? '#065F46' : '#991B1B'}
                  />
                  <Text style={{ color: thresholdMsg.type === 'ok' ? '#065F46' : '#991B1B', fontSize: 13, flex: 1 }}>
                    {thresholdMsg.text}
                  </Text>
                </View>
              )}

              <View style={{
                backgroundColor: '#EFF8FF', borderRadius: 8, padding: 10, marginBottom: 16,
                flexDirection: 'row', gap: 6,
              }}>
                <Ionicons name="information-circle-outline" size={14} color="#5AA3C8" style={{ marginTop: 1 }} />
                <Text style={{ fontSize: 11, color: '#5AA3C8', flex: 1, lineHeight: 16 }}>
                  Ubah nilai batas minimum dan maksimum untuk setiap parameter kualitas air.
                  Alert akan dikirim jika nilai sensor melewati batas yang ditentukan.
                </Text>
              </View>

              {thresholdForm && THRESHOLD_FIELDS.map(({ label, minKey, maxKey }) => (
                <View key={label} style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#1A3040', marginBottom: 8 }}>
                    {label}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    {[
                      { key: minKey, placeholder: 'Min' },
                      { key: maxKey, placeholder: 'Max' },
                    ].map(({ key, placeholder }) => (
                      <View key={key} style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, color: '#8BAFC0', marginBottom: 4, fontWeight: '500' }}>
                          {placeholder}
                        </Text>
                        <TextInput
                          keyboardType="numeric"
                          value={String(thresholdForm[key] ?? '')}
                          onChangeText={(v) => setThresholdForm((prev) => ({ ...prev, [key]: v }))}
                          style={{
                            borderWidth: 1.5, borderColor: '#D1E8F5', borderRadius: 10,
                            padding: 10, fontSize: 14, color: '#1A3040',
                            backgroundColor: '#F0F9FF', fontWeight: '600',
                          }}
                          placeholderTextColor="#B0CFE0"
                          placeholder={placeholder}
                        />
                      </View>
                    ))}
                  </View>
                </View>
              ))}

              <TouchableOpacity
                onPress={handleSaveThreshold}
                disabled={thresholdSaving}
                activeOpacity={0.85}
                style={{
                  backgroundColor: thresholdSaving ? '#A8D4EA' : '#5AA3C8',
                  borderRadius: 13, padding: 14,
                  alignItems: 'center', marginTop: 6, marginBottom: 10,
                  flexDirection: 'row', justifyContent: 'center', gap: 8,
                }}
              >
                {thresholdSaving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="save-outline" size={16} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Simpan Threshold</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleResetThreshold}
                activeOpacity={0.85}
                style={{
                  borderWidth: 1.5, borderColor: '#F87171',
                  borderRadius: 13, padding: 14,
                  alignItems: 'center', marginBottom: 32,
                  flexDirection: 'row', justifyContent: 'center', gap: 8,
                }}
              >
                <Ionicons name="refresh-outline" size={16} color="#F87171" />
                <Text style={{ color: '#F87171', fontWeight: '700', fontSize: 14 }}>Reset ke Default</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════════
          ── Reset Confirm Modal ──
      ══════════════════════════════════════════════════ */}
      <Modal
        visible={showResetConfirm}
        animationType="fade"
        transparent
        onRequestClose={() => setShowResetConfirm(false)}
      >
        <View style={{
          flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center', alignItems: 'center', padding: 32,
        }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 340 }}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{
                width: 52, height: 52, borderRadius: 26,
                backgroundColor: '#FEE2E2',
                justifyContent: 'center', alignItems: 'center',
              }}>
                <Ionicons name="refresh-outline" size={26} color="#F87171" />
              </View>
            </View>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#1A3040', textAlign: 'center', marginBottom: 8 }}>
              Reset Threshold
            </Text>
            <Text style={{ fontSize: 13, color: '#6B7280', textAlign: 'center', lineHeight: 20, marginBottom: 24 }}>
              Kembalikan semua threshold ke nilai default?{'\n'}Tindakan ini tidak dapat dibatalkan.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => setShowResetConfirm(false)}
                activeOpacity={0.85}
                style={{
                  flex: 1, borderWidth: 1.5, borderColor: '#D1D5DB',
                  borderRadius: 12, padding: 13, alignItems: 'center',
                }}
              >
                <Text style={{ color: '#6B7280', fontWeight: '600', fontSize: 14 }}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={doResetThreshold}
                activeOpacity={0.85}
                style={{ flex: 1, backgroundColor: '#F87171', borderRadius: 12, padding: 13, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Reset</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════════
          ── Device & Location Modal ──
      ══════════════════════════════════════════════════ */}
      <Modal
        visible={showDeviceModal}
        animationType="slide"
        transparent
        onRequestClose={() => { setShowDeviceModal(false); setSelectedDevice(null); }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%' }}>

            {/* Header */}
            <View style={{
              flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              padding: 16, borderBottomWidth: 1, borderBottomColor: '#EAF4FB',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <TouchableOpacity
                  onPress={() => { setShowDeviceModal(false); setShowSettingsMenu(true); setSelectedDevice(null); }}
                  style={{ marginRight: 2 }}
                >
                  <Ionicons name="chevron-back" size={20} color="#3E8FB8" />
                </TouchableOpacity>
                <Ionicons name="hardware-chip-outline" size={18} color="#3E8FB8" />
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#1A3040' }}>Perangkat &amp; Lokasi</Text>
              </View>
              <TouchableOpacity onPress={() => { setShowDeviceModal(false); setSelectedDevice(null); }}>
                <Ionicons name="close" size={22} color="#8BAFC0" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: 16 }} keyboardShouldPersistTaps="handled">

              {/* Status message */}
              {deviceMsg && (
                <View style={{
                  backgroundColor: deviceMsg.type === 'ok' ? '#D1FAE5' : '#FEE2E2',
                  borderRadius: 10, padding: 11, marginBottom: 14,
                  flexDirection: 'row', alignItems: 'center', gap: 8,
                }}>
                  <Ionicons
                    name={deviceMsg.type === 'ok' ? 'checkmark-circle' : 'alert-circle'}
                    size={16}
                    color={deviceMsg.type === 'ok' ? '#065F46' : '#991B1B'}
                  />
                  <Text style={{ color: deviceMsg.type === 'ok' ? '#065F46' : '#991B1B', fontSize: 13, flex: 1 }}>
                    {deviceMsg.text}
                  </Text>
                </View>
              )}

              {/* Info */}
              <View style={{
                backgroundColor: '#EFF8FF', borderRadius: 8, padding: 10, marginBottom: 16,
                flexDirection: 'row', gap: 6,
              }}>
                <Ionicons name="information-circle-outline" size={14} color="#3E8FB8" style={{ marginTop: 1 }} />
                <Text style={{ fontSize: 11, color: '#3E8FB8', flex: 1, lineHeight: 16 }}>
                  Edit nama lokasi untuk setiap perangkat sensor yang terdaftar, lalu tekan Simpan.
                </Text>
              </View>

              {!selectedDevice && (showAddDevice ? (
                <View style={{ marginBottom: 16 }}>
                  <TouchableOpacity
                    onPress={() => {
                      setShowAddDevice(false);
                      setNewDeviceCode('');
                      setNewDeviceLocation('');
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}
                  >
                    <Ionicons name="chevron-back" size={16} color="#5AA3C8" />
                    <Text style={{ fontSize: 12, color: '#5AA3C8', fontWeight: '600' }}>Batal</Text>
                  </TouchableOpacity>

                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#1A3040', marginBottom: 6 }}>Kode Device</Text>
                  <TextInput
                    value={newDeviceCode}
                    onChangeText={setNewDeviceCode}
                    placeholder="Contoh: UNIFLOW-02"
                    placeholderTextColor="#B0CFE0"
                    style={{
                      borderWidth: 1.5, borderColor: '#D1E8F5', borderRadius: 10,
                      padding: 10, fontSize: 13, color: '#1A3040', backgroundColor: '#fff', marginBottom: 12,
                    }}
                  />

                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#1A3040', marginBottom: 6 }}>Lokasi</Text>
                  <TextInput
                    value={newDeviceLocation}
                    onChangeText={setNewDeviceLocation}
                    placeholder="Contoh: Asrama"
                    placeholderTextColor="#B0CFE0"
                    style={{
                      borderWidth: 1.5, borderColor: '#D1E8F5', borderRadius: 10,
                      padding: 10, fontSize: 13, color: '#1A3040', backgroundColor: '#fff', marginBottom: 16,
                    }}
                  />

                  <TouchableOpacity
                    onPress={async () => {
                      const code = newDeviceCode.trim();
                      const codeError = validateDeviceCode(code);
                      if (codeError) {
                        setDeviceMsg({ type: 'err', text: codeError });
                        return;
                      }
                      setAddingDevice(true);
                      setDeviceMsg(null);
                      try {
                        await createDevice({
                          device_code: code,
                          location: newDeviceLocation.trim(),
                          status: 'inactive',
                        });
                        setDeviceMsg({ type: 'ok', text: 'Device berhasil ditambahkan!' });
                        setShowAddDevice(false);
                        setNewDeviceCode('');
                        setNewDeviceLocation('');
                        const res = await getAllDevices();
                        const nextDevices = normalizeDevices(res.data || []).map((device) => (
                          device.device_code === code ? { ...device, status: 'inactive' } : device
                        ));
                        setDevices(nextDevices);
                        setEditingLocation(buildEditingLocation(nextDevices));
                      } catch (err) {
                        setDeviceMsg({ type: 'err', text: toUserMessage(err, 'Gagal menambah device') });
                      } finally {
                        setAddingDevice(false);
                      }
                    }}
                    disabled={addingDevice}
                    style={{
                      backgroundColor: newDeviceCode.trim() ? '#3E8FB8' : '#C5DDE8',
                      borderRadius: 12, paddingVertical: 12,
                      flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
                    }}
                  >
                    {addingDevice ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Ionicons name="add-circle" size={16} color="#fff" />
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Tambah Device</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => setShowAddDevice(true)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                    borderWidth: 1.5, borderColor: '#D1E8F5', borderStyle: 'dashed',
                    borderRadius: 14, padding: 14, marginBottom: 12, gap: 8,
                  }}
                >
                  <Ionicons name="add-circle-outline" size={18} color="#5AA3C8" />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#5AA3C8' }}>Tambah Device Baru</Text>
                </TouchableOpacity>
              ))}

              {deviceLoading ? (
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <ActivityIndicator size="large" color="#3E8FB8" />
                  <Text style={{ color: '#8BAFC0', marginTop: 10, fontSize: 13 }}>Memuat perangkat...</Text>
                </View>
              ) : devices.length === 0 ? (
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <Ionicons name="hardware-chip-outline" size={44} color="#B0CFE0" />
                  <Text style={{ color: '#8BAFC0', marginTop: 10, fontSize: 13 }}>Tidak ada perangkat terdaftar</Text>
                </View>
              ) : selectedDevice ? (
                <View>
                  <TouchableOpacity
                    onPress={() => setSelectedDevice(null)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 }}
                  >
                    <Ionicons name="chevron-back" size={16} color="#5AA3C8" />
                    <Text style={{ fontSize: 12, color: '#5AA3C8', fontWeight: '600' }}>Semua Perangkat</Text>
                  </TouchableOpacity>

                  <View style={{
                    backgroundColor: '#F0F9FF', borderRadius: 14, padding: 14, marginBottom: 16,
                    borderWidth: 1.5, borderColor: '#D1E8F5', flexDirection: 'row', alignItems: 'center',
                  }}>
                    <View style={{
                      width: 44, height: 44, borderRadius: 22, backgroundColor: '#3E8FB8',
                      justifyContent: 'center', alignItems: 'center', marginRight: 12,
                    }}>
                      <Ionicons name="hardware-chip" size={20} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#1A3040' }}>
                        {selectedDevice.device_code || `Device #${selectedDevice.id}`}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                        <View style={{
                          backgroundColor: selectedDevice.status === 'active' ? '#D1FAE5' : '#FEE2E2',
                          borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2,
                        }}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: selectedDevice.status === 'active' ? '#065F46' : '#991B1B' }}>
                            {selectedDevice.status === 'active' ? 'Aktif' : 'Nonaktif'}
                          </Text>
                        </View>
                        {selectedDevice.last_seen && (
                          <Text style={{ fontSize: 10, color: '#8BAFC0' }}>
                            Terakhir: {new Date(selectedDevice.last_seen.replace('Z', '')).toLocaleString('id-ID')}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>

                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#1A3040', marginBottom: 6 }}>Nama Device</Text>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 16 }}>
                    <TextInput
                      value={editingDeviceCode}
                      onChangeText={setEditingDeviceCode}
                      placeholder="Contoh: UNIFLOW-01"
                      placeholderTextColor="#B0CFE0"
                      style={{
                        flex: 1, borderWidth: 1.5, borderColor: '#D1E8F5',
                        borderRadius: 10, padding: 10, fontSize: 13, color: '#1A3040', backgroundColor: '#fff',
                      }}
                    />
                    <TouchableOpacity
                      onPress={async () => {
                        const code = editingDeviceCode.trim();
                        const codeError = validateDeviceCode(code);
                        if (codeError) {
                          setDeviceMsg({ type: 'err', text: codeError });
                          return;
                        }
                        setDeviceSaving(`${selectedDevice.id}_code`);
                        setDeviceMsg(null);
                        try {
                          await updateDevice(selectedDevice.id, { device_code: code });
                          setDevices((prev) => prev.map((d) => d.id === selectedDevice.id ? { ...d, device_code: code } : d));
                          setSelectedDevice((prev) => ({ ...prev, device_code: code }));
                          setDeviceMsg({ type: 'ok', text: 'Nama device diperbarui!' });
                        } catch (err) {
                          setDeviceMsg({ type: 'err', text: toUserMessage(err, 'Gagal menyimpan nama device') });
                        } finally {
                          setDeviceSaving(null);
                        }
                      }}
                      disabled={deviceSaving === `${selectedDevice.id}_code`}
                      style={{
                        backgroundColor: deviceSaving === `${selectedDevice.id}_code` ? '#A8D4EA' : '#3E8FB8',
                        borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, minWidth: 68, alignItems: 'center',
                      }}
                    >
                      {deviceSaving === `${selectedDevice.id}_code` ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Simpan</Text>
                      )}
                    </TouchableOpacity>
                  </View>

                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#1A3040', marginBottom: 6 }}>Lokasi Perangkat</Text>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                    <TextInput
                      value={editingLocation[selectedDevice.id] ?? ''}
                      onChangeText={(v) => setEditingLocation((prev) => ({ ...prev, [selectedDevice.id]: v }))}
                      placeholder="Contoh: Asrama, Sport Center..."
                      placeholderTextColor="#B0CFE0"
                      style={{
                        flex: 1, borderWidth: 1.5, borderColor: '#D1E8F5',
                        borderRadius: 10, padding: 10, fontSize: 13, color: '#1A3040', backgroundColor: '#fff',
                      }}
                    />
                    <TouchableOpacity
                      onPress={() => handleSaveDeviceLocation(selectedDevice.id)}
                      disabled={deviceSaving === selectedDevice.id}
                      style={{
                        backgroundColor: deviceSaving === selectedDevice.id ? '#A8D4EA' : '#3E8FB8',
                        borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, minWidth: 68, alignItems: 'center',
                      }}
                    >
                      {deviceSaving === selectedDevice.id ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Simpan</Text>
                      )}
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    onPress={() => handleDeleteDevice(selectedDevice)}
                    disabled={deviceSaving === `${selectedDevice.id}_delete`}
                    style={{
                      marginTop: 10,
                      borderRadius: 12,
                      paddingVertical: 12,
                      borderWidth: 1.5,
                      borderColor: '#FECACA',
                      backgroundColor: '#FEF2F2',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 7,
                    }}
                  >
                    {deviceSaving === `${selectedDevice.id}_delete` ? (
                      <ActivityIndicator color="#DC2626" size="small" />
                    ) : (
                      <>
                        <Ionicons name="trash-outline" size={16} color="#DC2626" />
                        <Text style={{ color: '#DC2626', fontSize: 13, fontWeight: '800' }}>Hapus Device</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                devices.map((device) => (
                  <TouchableOpacity
                    key={device.id}
                    onPress={() => {
                      setSelectedDevice(device);
                      setEditingDeviceCode(device.device_code || '');
                    }}
                    activeOpacity={0.85}
                    style={{
                      backgroundColor: '#F8FBFF', borderRadius: 14, padding: 14, marginBottom: 12,
                      borderWidth: 1.5, borderColor: '#D1E8F5',
                      flexDirection: 'row', alignItems: 'center',
                    }}
                  >
                    <View style={{
                      width: 38, height: 38, borderRadius: 19, backgroundColor: '#3E8FB8',
                      justifyContent: 'center', alignItems: 'center', marginRight: 12,
                    }}>
                      <Ionicons name="hardware-chip" size={18} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#1A3040' }}>
                        {device.device_code || `Device #${device.id}`}
                      </Text>
                      <Text style={{ fontSize: 11, color: '#8BAFC0', marginTop: 2 }}>
                        {device.location || 'Lokasi belum diatur'}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <View style={{
                        backgroundColor: device.status === 'active' ? '#D1FAE5' : '#FEE2E2',
                        borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2,
                      }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: device.status === 'active' ? '#065F46' : '#991B1B' }}>
                          {device.status === 'active' ? 'Aktif' : 'Nonaktif'}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="#B0CFE0" />
                    </View>
                  </TouchableOpacity>
                ))
              )}

              <View style={{ height: 32 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── History Modals ── */}
      {selectedDataWithHistory && (
        <HistoryModal
          visible
          data={selectedDataWithHistory}
          activeMeasurement={activeMeasurement}
          measurementsList={measurementsList}
          allZones={allZones}
          onClose={() => setSelectedParameter(null)}
        />
      )}
      {showOverallHistory && overallData && (
        <HistoryModal
          visible
          data={overallData}
          activeMeasurement={activeMeasurement}
          measurementsList={measurementsList}
          allZones={allZones}
          onClose={() => setShowOverallHistory(false)}
        />
      )}

      <QuickTour
        visible={showTour}
        onDone={() => setShowTour(false)}
        refs={{
          refHeader: { current: refHeader.current, layout: tourLayouts.refHeader },
          refWQI: { current: refWQI.current, layout: insetTourLayout('refWQI', 16) },
          refStats: { current: refStats.current, layout: insetTourLayout('refStats', 16) },
          refParams: { current: refParams.current, layout: insetTourLayout('refParams', 16) },
          refStartBtn: { current: refStartBtn.current, layout: insetTourLayout('refStartBtn', 16) },
          refNotifBtn: { current: refNotifBtn.current, layout: getHeaderIconTourLayout(0) },
          refAI: { current: refAI.current, layout: getHeaderIconTourLayout(2) },
          refSettingBtn: { current: refSettingBtn.current, layout: getHeaderIconTourLayout(3) },
        }}
        scrollRef={scrollRef}
        scrollY={tourScrollY}
      />
    </ScrollView>
  );
}
