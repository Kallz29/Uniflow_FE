import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, Image, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, Dimensions,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import StatusCard from './StatusCard';
import HistoryModal from './HistoryModal';
import {
  getAllSensors, getLatestSensor, getSensorStats,
  getAlerts, markAlertRead, markAllAlertsRead, getThreshold,
  updateThreshold, resetThreshold,
  getAllDevices, updateDevice,
} from '../services/api';
import { checkESPReachable } from '../services/espDevice';
import { toUserMessage, logError } from '../utils/errorHandler';
import { dashboardStyles as styles } from '../styles/dashboardStyles';

// ─── Helpers ───────────────────────────────────────────────
const getStatus = (value, min, max) => {
  if (value == null || min == null || max == null) return 'good';
  const n = parseFloat(value);
  if (n < min || n > max) return 'danger';
  const range = max - min;
  if (n < min + range * 0.1 || n > max - range * 0.1) return 'warning';
  return 'good';
};

const STATUS_DOT = { good: '#4ADE80', warning: '#FCD34D', danger: '#F87171' };

const mapWQIStatus = (statusStr) => {
  if (!statusStr) return 'good';
  const s = statusStr.toLowerCase();
  if (s === 'baik')   return 'good';
  if (s === 'sedang') return 'warning';
  if (s === 'buruk')  return 'danger';
  if (s === 'good' || s === 'warning' || s === 'danger') return s;
  return 'good';
};

const mapSensorToCards = (data, threshold) => {
  const th = threshold || {};
  return [
    {
      id: 1, title: 'pH Level',
      value: data.ph != null ? String(parseFloat(data.ph).toFixed(1)) : '-',
      unit: 'pH',
      status: getStatus(data.ph, th.ph_min ?? 6.5, th.ph_max ?? 8.5),
      iconName: 'water',
      range: `${th.ph_min ?? 6.5}–${th.ph_max ?? 8.5}`,
      accuracy: '±0.1 pH',
      colors: ['#7CB9D8', '#5AA3C8'],
    },
    {
      id: 2, title: 'Suhu Air',
      value: data.temperature != null ? String(parseFloat(data.temperature).toFixed(1)) : '-',
      unit: '°C',
      status: getStatus(data.temperature, th.temp_min ?? 10, th.temp_max ?? 35),
      iconName: 'thermometer',
      range: `${th.temp_min ?? 10}–${th.temp_max ?? 35}°C`,
      accuracy: '±0.5°C',
      colors: ['#B8DAE8', '#7CB9D8'],
    },
    {
      id: 3, title: 'Padatan Terlarut',
      value: data.tds != null ? String(parseFloat(data.tds).toFixed(0)) : '-',
      unit: 'ppm',
      status: getStatus(data.tds, th.tds_min ?? 0, th.tds_max ?? 500),
      iconName: 'flask',
      range: `${th.tds_min ?? 0}–${th.tds_max ?? 500}`,
      accuracy: '±10% F.S.',
      colors: ['#5AA3C8', '#3E8FB8'],
    },
    {
      id: 4, title: 'Kekeruhan',
      value: data.turbidity != null ? String(parseFloat(data.turbidity).toFixed(1)) : '-',
      unit: 'NTU',
      status: getStatus(data.turbidity, th.tss_min ?? 0, th.tss_max ?? 25),
      iconName: 'eyedrop',
      range: `${th.tss_min ?? 0}–${th.tss_max ?? 25} NTU`,
      accuracy: '±85%',
      colors: ['#7CB9D8', '#5AA3C8'],
    },
  ];
};

const parseLocalDate = (str) => {
  if (!str) return new Date();
  return new Date(typeof str === 'string' ? str.replace('Z', '') : str);
};

const buildHistory = (list, field, unit) =>
  list.map((item) => ({
    timestamp: parseLocalDate(item.created_at),
    value: parseFloat(item[field]).toFixed(1),
    unit,
    status: 'good',
    location: item.location || null,   // ← tambah ini
  }));

const SEVERITY_BG    = { low: '#FEF3C7', medium: '#FED7AA', high: '#FEE2E2', critical: '#FECACA' };
const SEVERITY_TEXT  = { low: '#92400E', medium: '#C2410C', high: '#991B1B', critical: '#7F1D1D' };
const SEVERITY_LABEL = { low: 'Rendah', medium: 'Sedang', high: 'Tinggi', critical: 'Kritis' };

const { width: SCREEN_W } = Dimensions.get('window');
const GRID_PADDING = 16;
const GRID_GAP     = 10;
const CARD_W = Math.floor((SCREEN_W - GRID_PADDING * 2 - GRID_GAP) / 2);
const DASHBOARD_REFRESH_INTERVAL = 4000;

// ─── Parameter Card ────────────────────────────────────────
const ParamCard = ({ item, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.88}
    style={[styles.paramCard, { width: CARD_W }]}
  >
    <LinearGradient
      colors={item.colors}
      style={styles.paramCardTop}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View style={[styles.paramCardStatusDot, { backgroundColor: STATUS_DOT[item.status] }]} />
      <View style={styles.paramCardIconWrap}>
        <Ionicons name={item.iconName} size={16} color="rgba(255,255,255,0.9)" />
      </View>
      <Text style={styles.paramCardLabel}>{item.title}</Text>
      <View style={styles.paramCardValueRow}>
        <Text style={styles.paramCardValue}>{item.value}</Text>
        <Text style={styles.paramCardUnit}>{item.unit}</Text>
      </View>
    </LinearGradient>
    <View style={[styles.paramCardBottom, { backgroundColor: item.colors[1] + 'CC' }]}>
      <Text style={styles.paramCardRange}>{item.range}</Text>
      <Text style={styles.paramCardAccuracy}>{item.accuracy}</Text>
    </View>
  </TouchableOpacity>
);

// ─── Dashboard ─────────────────────────────────────────────
export default function Dashboard({ onNavigateToAbout, onNavigateToAI, onNavigateToWifi }) {
  // ── Navigation & History ──
  const [selectedParameter,   setSelectedParameter]   = useState(null);
  const [showOverallHistory,  setShowOverallHistory]   = useState(false);

  // ── Alerts ──
  const [showAlertsModal,     setShowAlertsModal]      = useState(false);

  // ── Settings Menu ──
  const [showSettingsMenu,    setShowSettingsMenu]     = useState(false);

  // ── Threshold Modal ──
  const [showThresholdModal,  setShowThresholdModal]   = useState(false);
  const [showResetConfirm,    setShowResetConfirm]     = useState(false);
  const [thresholdForm,       setThresholdForm]        = useState(null);
  const [thresholdSaving,     setThresholdSaving]      = useState(false);
  const [thresholdMsg,        setThresholdMsg]         = useState(null);

  // ── Device Modal ──
  const [showDeviceModal,     setShowDeviceModal]      = useState(false);
  const [devices,             setDevices]              = useState([]);
  const [deviceLoading,       setDeviceLoading]        = useState(false);
  const [deviceSaving,        setDeviceSaving]         = useState(null);
  const [deviceMsg,           setDeviceMsg]            = useState(null);
  const [editingLocation,     setEditingLocation]      = useState({});

  // ── Sensor/Alert/Threshold Data ──
  const [qualityData,  setQualityData]  = useState([]);
  const [overallData,  setOverallData]  = useState(null);
  const [historyList,  setHistoryList]  = useState([]);
  const [stats,        setStats]        = useState(null);
  const [alerts,       setAlerts]       = useState([]);
  const [unreadCount,  setUnreadCount]  = useState(0);
  const [threshold,    setThreshold]    = useState(null);

  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [lastUpdated,  setLastUpdated]  = useState(null);
  const [error,        setError]        = useState(null);

  // ─── Fetch data ──────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [latestRes, allRes, statsRes, alertsRes, thresholdRes] = await Promise.all([
        getLatestSensor(), getAllSensors(100), getSensorStats(),
        getAlerts({ limit: 20 }), getThreshold(),
      ]);

      const latest    = latestRes.data;
      const list      = allRes.data   || [];
      const statsData = statsRes.data || {};
      const alertList = alertsRes.data || [];
      const th        = thresholdRes.data || {};

      setThreshold(th);
      setQualityData(mapSensorToCards(latest, th));
      setHistoryList(list);
      setStats(statsData);
      setAlerts(alertList);
      setUnreadCount(alertList.filter((a) => !a.is_read).length);

      const backendScore  = latest.wqi_score != null ? Math.round(latest.wqi_score) : null;
      const backendStatus = mapWQIStatus(latest.wqi_status);

      setOverallData({
        id: 0,
        title: 'Kualitas Air Overall',
        value: backendScore != null ? String(backendScore) : '-',
        unit: 'Skor',
        status: backendStatus,
        colors: ['#4ADE80', '#22C55E'],
        color:  ['#4ADE80', '#22C55E'],
        history: list.map((item) => ({
          timestamp: parseLocalDate(item.created_at),
          value: item.wqi_score != null ? Math.round(item.wqi_score) : '-',
          unit: 'Skor',
          status: mapWQIStatus(item.wqi_status),
          location: item.location || null, 
        })),
      });

      setLastUpdated(parseLocalDate(latest.created_at));
    } catch (err) {
      logError('Dashboard.fetchData', err);
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
  }, [onNavigateToWifi]);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, DASHBOARD_REFRESH_INTERVAL);
    return () => clearInterval(iv);
  }, [fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

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
      tds_min: '0',  tds_max: '500',
      tss_min: '0',  tss_max: '25',
    });
    setThresholdMsg(null);
    setShowThresholdModal(true);
  };

  const handleSaveThreshold = async () => {
    setThresholdSaving(true);
    try {
      const payload = {
        ph_min:   parseFloat(thresholdForm.ph_min),
        ph_max:   parseFloat(thresholdForm.ph_max),
        temp_min: parseFloat(thresholdForm.temp_min),
        temp_max: parseFloat(thresholdForm.temp_max),
        tds_min:  parseFloat(thresholdForm.tds_min),
        tds_max:  parseFloat(thresholdForm.tds_max),
        tss_min:  parseFloat(thresholdForm.tss_min),
        tss_max:  parseFloat(thresholdForm.tss_max),
      };
      for (const [k, v] of Object.entries(payload)) {
        if (isNaN(v)) throw new Error(`Nilai "${k}" tidak valid`);
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
      const freshTh  = freshRes.data || {};
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
    setShowDeviceModal(true);
    setDeviceLoading(true);
    try {
      const res  = await getAllDevices();
      const list = res.data || [];
      setDevices(list);
      const init = {};
      list.forEach((d) => { init[d.id] = d.location || ''; });
      setEditingLocation(init);
    } catch (err) {
      logError('Dashboard.loadDevices', err);
      setDeviceMsg({ type: 'err', text: toUserMessage(err, 'Gagal memuat perangkat') });
    } finally {
      setDeviceLoading(false);
    }
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
      1: ['ph',          'pH'],
      2: ['temperature', '°C'],
      3: ['tds',         'ppm'],
      4: ['turbidity',   'NTU'],
    };
    const [field, unit] = map[id] || [];
    return buildHistory(historyList, field, unit);
  };

  const selectedData = qualityData.find((d) => d.id === selectedParameter);
  const selectedDataWithHistory = selectedData
    ? { ...selectedData, history: getHistoryForParam(selectedParameter) }
    : null;

  const formatLastUpdated = () => {
    if (!lastUpdated) return 'Memuat...';
    const diffMs   = Date.now() - lastUpdated.getTime();
    const diffMin  = Math.floor(diffMs / 60000);
    if (diffMin < 1)    return 'Baru saja';
    if (diffMin < 60)   return `${diffMin} menit lalu`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24)  return `${diffHour} jam lalu`;
    const diffDay  = Math.floor(diffHour / 24);
    if (diffDay < 7)    return `${diffDay} hari lalu`;
    return lastUpdated.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const overallStatusText =
    overallData?.status === 'danger'  ? 'Ada parameter di luar batas aman' :
    overallData?.status === 'warning' ? 'Beberapa parameter mendekati batas' :
    'Semua parameter dalam batas aman';

  const cardRows = [];
  for (let i = 0; i < qualityData.length; i += 2) {
    cardRows.push(qualityData.slice(i, i + 2));
  }

  const THRESHOLD_FIELDS = [
    { label: 'pH',                     minKey: 'ph_min',   maxKey: 'ph_max'   },
    { label: 'Suhu (°C)',              minKey: 'temp_min', maxKey: 'temp_max' },
    { label: 'TDS (ppm)',              minKey: 'tds_min',  maxKey: 'tds_max'  },
    { label: 'Kekeruhan / TSS (NTU)', minKey: 'tss_min',  maxKey: 'tss_max'  },
  ];

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7CB9D8" />}
    >
      {/* ── Header ── */}
      <View style={styles.header}>
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
            <TouchableOpacity onPress={() => setShowAlertsModal(true)} style={styles.statusIndicator}>
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
            <TouchableOpacity onPress={onNavigateToAI} style={styles.statusIndicator}>
              <Ionicons name="chatbubble-ellipses" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            {/* Settings */}
            <TouchableOpacity onPress={openSettingsMenu} style={styles.statusIndicator}>
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
            <Text style={styles.errorRetry}>Coba lagi →</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#7CB9D8" />
          <Text style={styles.loadingText}>Memuat data sensor...</Text>
        </View>
      ) : (
        <>
          <View style={styles.statusSection}>
            <StatusCard
              onHistoryClick={() => setShowOverallHistory(true)}
              wqiScore={overallData?.value}
              wqiStatus={overallData?.status}
            />
          </View>

          {stats && (
            <View style={styles.statsStrip}>
              {[
                {
                  label: 'Avg pH',
                  value: stats.avg_ph != null ? String(parseFloat(stats.avg_ph).toFixed(1)) : '-',
                },
                {
                  label: 'Avg Suhu',
                  value: stats.avg_temperature != null ? `${parseFloat(stats.avg_temperature).toFixed(1)}°C` : '-',
                },
                {
                  label: 'Avg TDS',
                  value: stats.avg_tds != null ? String(parseFloat(stats.avg_tds).toFixed(0)) : '-',
                },
                {
                  label: 'Avg TSS',
                  value: stats.avg_turbidity != null ? String(parseFloat(stats.avg_turbidity).toFixed(1)) : '-',
                },
              ].map((s) => (
                <View key={s.label} style={styles.statItem}>
                  <Text style={styles.statValue}>{s.value}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.metricsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Parameter Air</Text>
              <Text style={styles.updateTime}>Diperbarui {formatLastUpdated()}</Text>
            </View>
          </View>

          <View style={styles.cardsGrid}>
            {cardRows.map((row, rowIdx) => (
              <View key={rowIdx} style={styles.cardRow}>
                {row.map((item) => (
                  <ParamCard
                    key={item.id}
                    item={item}
                    onPress={() => setSelectedParameter(item.id)}
                  />
                ))}
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
                    backgroundColor: alert.is_read ? '#F9FAFB' : (SEVERITY_BG[alert.severity] || '#FEE2E2'),
                    borderRadius: 12, padding: 13, marginBottom: 10,
                    borderLeftWidth: 3,
                    borderLeftColor: alert.is_read ? '#D1D5DB' : (SEVERITY_TEXT[alert.severity] || '#DC2626'),
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: alert.is_read ? '#9CA3AF' : (SEVERITY_TEXT[alert.severity] || '#DC2626') }}>
                      {alert.parameter?.toUpperCase()} — {SEVERITY_LABEL[alert.severity] || alert.severity}
                    </Text>
                    {!alert.is_read && (
                      <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#EF4444', marginTop: 2 }} />
                    )}
                  </View>
                  <Text style={{ fontSize: 13, color: '#374151', lineHeight: 18 }}>{alert.message}</Text>
                  <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>
                    Nilai: {alert.value} | Batas: {alert.threshold_min}–{alert.threshold_max}
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
        onRequestClose={() => setShowDeviceModal(false)}
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
                  onPress={() => { setShowDeviceModal(false); setShowSettingsMenu(true); }}
                  style={{ marginRight: 2 }}
                >
                  <Ionicons name="chevron-back" size={20} color="#3E8FB8" />
                </TouchableOpacity>
                <Ionicons name="hardware-chip-outline" size={18} color="#3E8FB8" />
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#1A3040' }}>Perangkat &amp; Lokasi</Text>
              </View>
              <TouchableOpacity onPress={() => setShowDeviceModal(false)}>
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

              {/* Loading state */}
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
              ) : devices.map((device) => (
                <View
                  key={device.id}
                  style={{
                    backgroundColor: '#F8FBFF',
                    borderRadius: 14, padding: 14, marginBottom: 12,
                    borderWidth: 1.5, borderColor: '#D1E8F5',
                  }}
                >
                  {/* Device info */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <View style={{
                      width: 38, height: 38, borderRadius: 19,
                      backgroundColor: '#3E8FB8',
                      justifyContent: 'center', alignItems: 'center',
                      marginRight: 10,
                    }}>
                      <Ionicons name="hardware-chip" size={18} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#1A3040' }}>
  {device.device_code || `Device #${device.id}`}
</Text>
                    </View>
                    <View style={{
                      backgroundColor: device.status === 'active' ? '#D1FAE5' : '#FEE2E2',
                      borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
                    }}>
                      <Text style={{
                        fontSize: 10, fontWeight: '700',
                        color: device.status === 'active' ? '#065F46' : '#991B1B',
                      }}>
                        {device.status === 'active' ? 'Aktif' : 'Nonaktif'}
                      </Text>
                    </View>
                  </View>

                  {/* Location input + save */}
                  <Text style={{ fontSize: 11, color: '#8BAFC0', marginBottom: 5, fontWeight: '600' }}>
                    Lokasi Perangkat
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <TextInput
                      value={editingLocation[device.id] ?? ''}
                      onChangeText={(v) =>
                        setEditingLocation((prev) => ({ ...prev, [device.id]: v }))
                      }
                      placeholder="Masukkan nama lokasi..."
                      placeholderTextColor="#B0CFE0"
                      style={{
                        flex: 1,
                        borderWidth: 1.5, borderColor: '#D1E8F5',
                        borderRadius: 10, padding: 10,
                        fontSize: 13, color: '#1A3040',
                        backgroundColor: '#fff',
                      }}
                    />
                    <TouchableOpacity
                      onPress={() => handleSaveDeviceLocation(device.id)}
                      disabled={deviceSaving === device.id}
                      activeOpacity={0.85}
                      style={{
                        backgroundColor: deviceSaving === device.id ? '#A8D4EA' : '#3E8FB8',
                        borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11,
                        justifyContent: 'center', alignItems: 'center', minWidth: 68,
                      }}
                    >
                      {deviceSaving === device.id ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Simpan</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

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
          onClose={() => setSelectedParameter(null)}
        />
      )}
      {showOverallHistory && overallData && (
        <HistoryModal
          visible
          data={overallData}
          onClose={() => setShowOverallHistory(false)}
        />
      )}
    </ScrollView>
  );
}
