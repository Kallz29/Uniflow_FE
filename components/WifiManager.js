import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Animated, Modal, Platform,
  KeyboardAvoidingView, AppState,
} from 'react-native';
import * as Network from 'expo-network';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// ─── Konfigurasi ────────────────────────────────────────────
const ESP_IP        = '192.168.4.1';
const ESP_BASE      = `http://${ESP_IP}/api/wifi`;
const SCAN_INTERVAL = 15000;

// Seberapa lama polling setelah kirim connect request ke ESP32
// ESP32 butuh ~8-12 detik untuk proses WPA handshake + DHCP
const CONNECT_POLL_INTERVAL = 2000;   // cek status tiap 2 detik
const CONNECT_POLL_TIMEOUT  = 20000;  // total tunggu max 20 detik

// ─── API helpers ────────────────────────────────────────────
const espFetch = async (path, options = {}, timeoutMs = 12000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${ESP_BASE}${path}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        // Paksa fresh connection — ESP32 WebServer tidak support persistent connection
        'Connection': 'close',
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const text = await res.text();
    let data = {};
    if (text) {
      try { data = JSON.parse(text); }
      catch { data = { message: text }; }
    }

    if (!res.ok) throw new Error(data.message || `ESP response ${res.status}`);
    return data;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
};

const getLocalIpAddress = async () => {
  try { return await Network.getIpAddressAsync(); }
  catch { return null; }
};

const isOnEspSetupNetwork = (ip) => ip?.startsWith('192.168.4.');

const scanNetworks = async (retryCount = 0) => {
  const MAX_RETRY   = 8;
  const RETRY_DELAY = 2500;

  let result;
  try {
    result = await espFetch('/scan', {}, 12000);
  } catch (err) {
    if (retryCount < MAX_RETRY) {
      await new Promise(r => setTimeout(r, RETRY_DELAY));
      return scanNetworks(retryCount + 1);
    }
    throw err;
  }

  if (result.scanning === true) {
    if (retryCount >= MAX_RETRY) return { networks: [] };
    await new Promise(r => setTimeout(r, RETRY_DELAY));
    return scanNetworks(retryCount + 1);
  }

  return result;
};

const getWifiStatus  = ()           => espFetch('/status',     {},                          6000);
const connectWifi    = (ssid, pass) => espFetch('/connect',    {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ssid, password: pass }),
}, 15000);
const disconnectWifi = ()           => espFetch('/disconnect', { method: 'POST' },          6000);

const SETUP_CHECKLIST = [
  'HP terhubung ke WiFi UniFlow-Setup',
  'Data seluler dan VPN dimatikan sementara',
  'Pilih Tetap terhubung jika Android memberi peringatan WiFi tanpa internet',
  'Tunggu 10 detik setelah ESP32 dinyalakan, lalu coba scan ulang',
];

// ─── Signal strength ─────────────────────────────────────────
const getSignalInfo = (rssi) => {
  if (rssi >= -50) return { icon: 'wifi',         color: '#22C55E', label: 'Kuat' };
  if (rssi >= -65) return { icon: 'wifi',         color: '#84CC16', label: 'Baik' };
  if (rssi >= -75) return { icon: 'wifi-outline', color: '#EAB308', label: 'Lemah' };
  return             { icon: 'wifi-outline',       color: '#EF4444', label: 'Sangat Lemah' };
};

// ─── NetworkItem ──────────────────────────────────────────────
const NetworkItem = ({ network, onPress, isConnected }) => {
  const sig   = getSignalInfo(network.rssi);
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1,    duration: 80, useNativeDriver: true }),
    ]).start(() => onPress(network));
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={1}
        style={{
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: isConnected ? '#EFF8FF' : '#FFFFFF',
          borderRadius: 14, padding: 14, marginBottom: 8,
          borderWidth: 1.5,
          borderColor: isConnected ? '#7CB9D8' : '#E8F2F8',
        }}
      >
        <View style={{
          width: 40, height: 40, borderRadius: 12,
          backgroundColor: sig.color + '18',
          justifyContent: 'center', alignItems: 'center',
          marginRight: 12,
        }}>
          <Ionicons name={sig.icon} size={20} color={sig.color} />
        </View>

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#1A3040' }} numberOfLines={1}>
              {network.ssid}
            </Text>
            {isConnected && (
              <View style={{
                backgroundColor: '#7CB9D8', borderRadius: 6,
                paddingHorizontal: 7, paddingVertical: 2,
              }}>
                <Text style={{ fontSize: 9, color: '#fff', fontWeight: '700' }}>TERHUBUNG</Text>
              </View>
            )}
          </View>
          <Text style={{ fontSize: 11, color: '#8BAFC0', marginTop: 2 }}>
            {sig.label} {'\u00b7'} {network.rssi} dBm
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {network.secured && <Ionicons name="lock-closed" size={13} color="#B0CFE0" />}
          <Ionicons name="chevron-forward" size={16} color="#C5DDE8" />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── ConnectModal ─────────────────────────────────────────────
/**
 * FIX UTAMA: Setelah user tekan Hubungkan dan ESP32 merespons success,
 * modal langsung masuk fase "menunggu ESP32 pindah WiFi".
 *
 * Cara kerjanya:
 * 1. Kirim POST /connect ke ESP32  → ESP32 mulai proses koneksi di background
 * 2. Poll GET /status tiap 2 detik → tunggu field connected: true
 * 3. Kalau sudah connected → panggil onSuccess() → parent redirect ke Dashboard
 * 4. Kalau timeout 20 detik → tunjukkan error tapi tetap kasih tombol ke Dashboard
 *
 * Kenapa HP disconnect dari UniFlow-Setup?
 * ESP32 mode WIFI_AP_STA: saat STA berhasil connect ke WiFi baru, Android/iOS
 * kadang mendeteksi AP masih ada tapi koneksi ke 192.168.4.1 putus karena
 * interface STA sekarang aktif dan Android memilih route terbaik. Solusinya:
 * begitu onSuccess() dipanggil, app langsung pindah ke Dashboard sehingga
 * tidak ada lagi request ke ESP32 yang bisa gagal.
 */
const ConnectModal = ({ visible, network, onClose, onSuccess }) => {
  const [ssid,         setSsid]         = useState('');
  const [password,     setPassword]     = useState('');
  const [showPass,     setShowPass]     = useState(false);
  const [phase,        setPhase]        = useState('input');  // 'input' | 'waiting' | 'done' | 'error'
  const [statusMsg,    setStatusMsg]    = useState('');
  const [error,        setError]        = useState(null);
  const [countdown,    setCountdown]    = useState(0);
  const slideAnim = useRef(new Animated.Value(300)).current;
  const pollRef   = useRef(null);
  const startedAt = useRef(0);

  useEffect(() => {
    if (visible) {
      setSsid(network?.ssid || '');
      setPassword('');
      setError(null);
      setPhase('input');
      setStatusMsg('');
      setCountdown(0);
      Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 12, useNativeDriver: true }).start();
    } else {
      slideAnim.setValue(300);
      clearInterval(pollRef.current);
    }
    return () => clearInterval(pollRef.current);
  }, [visible]);

  // Poll status ESP32 setelah kirim connect request
  const startPolling = useCallback((targetSsid) => {
    startedAt.current = Date.now();
    setPhase('waiting');
    setStatusMsg(`Menunggu ESP32 terhubung ke "${targetSsid}"...`);
    setCountdown(Math.ceil(CONNECT_POLL_TIMEOUT / 1000));

    // Countdown visual
    const countdownRef = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(countdownRef); return 0; }
        return prev - 1;
      });
    }, 1000);

    // Poll status
    pollRef.current = setInterval(async () => {
      const elapsed = Date.now() - startedAt.current;

      // Timeout — ESP32 tidak berhasil connect dalam waktu yang ditentukan
      if (elapsed >= CONNECT_POLL_TIMEOUT) {
        clearInterval(pollRef.current);
        clearInterval(countdownRef);
        setPhase('error');
        setError(
          `ESP32 belum terhubung ke "${targetSsid}" setelah ${CONNECT_POLL_TIMEOUT / 1000} detik.\n\n` +
          `Kemungkinan:\n` +
          `\u2022 Password salah\n` +
          `\u2022 WiFi "${targetSsid}" tidak terjangkau\n\n` +
          `Kamu bisa langsung ke Dashboard dan coba lagi nanti.`
        );
        return;
      }

      try {
        const status = await getWifiStatus();
        if (status?.connected && status?.ssid === targetSsid) {
          clearInterval(pollRef.current);
          clearInterval(countdownRef);
          setPhase('done');
          setStatusMsg(`Berhasil! ESP32 terhubung ke "${targetSsid}"`);
          // Delay singkat agar user sempat lihat pesan success, lalu redirect
          setTimeout(() => onSuccess(targetSsid), 800);
        } else if (status?.connected && status?.ssid !== targetSsid) {
          // Sudah connected tapi ke SSID berbeda — mungkin fallback ke saved WiFi
          clearInterval(pollRef.current);
          clearInterval(countdownRef);
          setPhase('done');
          setStatusMsg(`ESP32 terhubung ke "${status.ssid}"`);
          setTimeout(() => onSuccess(status.ssid), 800);
        }
        // Kalau belum connected, tunggu interval berikutnya
      } catch {
        // Request gagal karena HP mulai disconnect dari UniFlow-Setup
        // — ini normal! Artinya ESP32 sudah mulai pindah WiFi.
        // Kita update pesan tapi lanjut polling sampai timeout.
        const secondsLeft = Math.ceil((CONNECT_POLL_TIMEOUT - elapsed) / 1000);
        if (secondsLeft > 0) {
          setStatusMsg(
            `ESP32 sedang berpindah jaringan...\n` +
            `HP mungkin disconnect dari UniFlow-Setup sebentar.`
          );
        }
      }
    }, CONNECT_POLL_INTERVAL);
  }, [onSuccess]);

  const handleConnect = async () => {
    const targetSsid = ssid.trim();
    if (!targetSsid) { setError('Masukkan nama WiFi terlebih dahulu'); return; }
    if (network?.secured && !password.trim()) { setError('Masukkan password terlebih dahulu'); return; }

    setPhase('waiting');
    setStatusMsg('Mengirim permintaan ke ESP32...');
    setError(null);

    try {
      const res = await connectWifi(targetSsid, password);
      if (res.success) {
        // ESP32 konfirmasi menerima request — sekarang poll sampai benar-benar connect
        startPolling(targetSsid);
      } else {
        setPhase('error');
        setError(res.message || 'Gagal terhubung, cek password');
      }
    } catch (err) {
      // Request bisa putus karena ESP32 langsung berpindah ke WiFi tujuan.
      // Poll dulu supaya kondisi sukses tidak ditampilkan sebagai gagal.
      startPolling(targetSsid);
      setStatusMsg(`Menunggu ESP32 terhubung ke "${targetSsid}"...`);
    }
  };

  const handleClose = () => {
    clearInterval(pollRef.current);
    onClose();
  };

  if (!network) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={{
          flex: 1, backgroundColor: 'rgba(10,28,45,0.55)',
          justifyContent: 'flex-end',
        }}>
          <Animated.View style={{
            backgroundColor: '#fff',
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            padding: 24, paddingBottom: 40,
            transform: [{ translateY: slideAnim }],
          }}>
            <View style={{
              width: 36, height: 4, borderRadius: 2,
              backgroundColor: '#D1E8F5', alignSelf: 'center', marginBottom: 20,
            }} />

            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <View style={{
                width: 44, height: 44, borderRadius: 13,
                backgroundColor: phase === 'done' ? '#F0FDF4' : '#EFF8FF',
                justifyContent: 'center', alignItems: 'center',
              }}>
                {phase === 'done'
                  ? <Ionicons name="checkmark-circle" size={24} color="#22C55E" />
                  : phase === 'waiting'
                  ? <ActivityIndicator size="small" color="#5AA3C8" />
                  : <Ionicons name="wifi" size={22} color="#5AA3C8" />
                }
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#1A3040' }}>
                  {phase === 'done'    ? 'Terhubung!'
                  : phase === 'waiting' ? 'Menghubungkan...'
                  : phase === 'error'   ? 'Gagal Terhubung'
                  : network.manual      ? 'Input WiFi Manual'
                  :                       network.ssid}
                </Text>
                <Text style={{ fontSize: 11, color: '#8BAFC0', marginTop: 1 }}>
                  {phase === 'waiting' || phase === 'done'
                    ? statusMsg
                    : network.secured ? 'Jaringan terenkripsi' : 'Jaringan terbuka'
                  }
                </Text>
              </View>
              {/* Tombol close hanya saat input atau error */}
              {(phase === 'input' || phase === 'error') && (
                <TouchableOpacity onPress={handleClose}>
                  <Ionicons name="close-circle" size={24} color="#C5DDE8" />
                </TouchableOpacity>
              )}
            </View>

            {/* Fase: input form */}
            {phase === 'input' && (
              <>
                {network.manual && (
                  <View style={{ marginBottom: 14 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#4A8BAA', marginBottom: 8 }}>
                      Nama WiFi / SSID
                    </Text>
                    <TextInput
                      style={{
                        borderWidth: 1.5, borderColor: error && !ssid.trim() ? '#FCA5A5' : '#D1E8F5',
                        borderRadius: 12, backgroundColor: '#F0F9FF',
                        paddingHorizontal: 14, paddingVertical: 12,
                        fontSize: 14, color: '#1A3040',
                      }}
                      value={ssid}
                      onChangeText={(t) => { setSsid(t); setError(null); }}
                      placeholder="Contoh: WiFi Rumah"
                      placeholderTextColor="#B0CFE0"
                      autoFocus
                    />
                  </View>
                )}

                {network.secured && (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#4A8BAA', marginBottom: 8 }}>
                      Password WiFi
                    </Text>
                    <View style={{
                      flexDirection: 'row', alignItems: 'center',
                      borderWidth: 1.5, borderColor: error ? '#FCA5A5' : '#D1E8F5',
                      borderRadius: 12, backgroundColor: '#F0F9FF', paddingHorizontal: 14,
                    }}>
                      <TextInput
                        style={{ flex: 1, paddingVertical: 12, fontSize: 14, color: '#1A3040' }}
                        value={password}
                        onChangeText={(t) => { setPassword(t); setError(null); }}
                        secureTextEntry={!showPass}
                        placeholder="Masukkan password"
                        placeholderTextColor="#B0CFE0"
                        autoFocus={!network.manual}
                      />
                      <TouchableOpacity onPress={() => setShowPass((p) => !p)}>
                        <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color="#8BAFC0" />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {error && (
                  <View style={{
                    backgroundColor: '#FEE2E2', borderRadius: 10, padding: 11, marginBottom: 14,
                    flexDirection: 'row', alignItems: 'flex-start', gap: 7,
                  }}>
                    <Ionicons name="alert-circle" size={15} color="#EF4444" style={{ marginTop: 1 }} />
                    <Text style={{ fontSize: 12, color: '#DC2626', flex: 1 }}>{error}</Text>
                  </View>
                )}

                <TouchableOpacity
                  onPress={handleConnect}
                  activeOpacity={0.85}
                  style={{
                    backgroundColor: '#5AA3C8',
                    borderRadius: 14, paddingVertical: 14,
                    alignItems: 'center', flexDirection: 'row',
                    justifyContent: 'center', gap: 8,
                  }}
                >
                  <Ionicons name="wifi" size={16} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Hubungkan</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Fase: menunggu ESP32 connect ke WiFi baru */}
            {phase === 'waiting' && (
              <View style={{ alignItems: 'center', paddingVertical: 20, gap: 12 }}>
                <ActivityIndicator size="large" color="#5AA3C8" />
                <Text style={{ fontSize: 13, color: '#4A8BAA', textAlign: 'center', lineHeight: 20 }}>
                  {statusMsg}
                </Text>
                {countdown > 0 && (
                  <View style={{
                    backgroundColor: '#EFF8FF', borderRadius: 20,
                    paddingHorizontal: 14, paddingVertical: 6,
                  }}>
                    <Text style={{ fontSize: 12, color: '#7CB9D8' }}>
                      Timeout dalam {countdown} detik
                    </Text>
                  </View>
                )}
                <View style={{
                  backgroundColor: '#FFFBEB', borderRadius: 10, padding: 12, marginTop: 4,
                  borderWidth: 1, borderColor: '#FDE68A',
                }}>
                  <Text style={{ fontSize: 11, color: '#92400E', textAlign: 'center', lineHeight: 17 }}>
                    HP mungkin sementara disconnect dari UniFlow-Setup.{'\n'}
                    Ini normal — tunggu hingga selesai.
                  </Text>
                </View>
              </View>
            )}

            {/* Fase: sukses */}
            {phase === 'done' && (
              <View style={{ alignItems: 'center', paddingVertical: 16, gap: 12 }}>
                <View style={{
                  width: 64, height: 64, borderRadius: 32,
                  backgroundColor: '#F0FDF4', justifyContent: 'center', alignItems: 'center',
                }}>
                  <Ionicons name="checkmark-circle" size={40} color="#22C55E" />
                </View>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#15803D', textAlign: 'center' }}>
                  {statusMsg}
                </Text>
                <Text style={{ fontSize: 12, color: '#8BAFC0', textAlign: 'center' }}>
                  Mengalihkan ke Dashboard...
                </Text>
                <ActivityIndicator size="small" color="#22C55E" />
              </View>
            )}

            {/* Fase: error */}
            {phase === 'error' && (
              <>
                <View style={{
                  backgroundColor: '#FEE2E2', borderRadius: 10, padding: 11, marginBottom: 16,
                  flexDirection: 'row', alignItems: 'flex-start', gap: 7,
                }}>
                  <Ionicons name="alert-circle" size={15} color="#EF4444" style={{ marginTop: 1 }} />
                  <Text style={{ fontSize: 12, color: '#DC2626', flex: 1, lineHeight: 18 }}>{error}</Text>
                </View>

                <TouchableOpacity
                  onPress={() => setPhase('input')}
                  activeOpacity={0.85}
                  style={{
                    backgroundColor: '#5AA3C8',
                    borderRadius: 14, paddingVertical: 12,
                    alignItems: 'center', marginBottom: 10,
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Coba Lagi</Text>
                </TouchableOpacity>

                {/* Tombol ke Dashboard tetap tersedia walau gagal */}
                <TouchableOpacity
                  onPress={() => { clearInterval(pollRef.current); onSuccess(null); }}
                  activeOpacity={0.85}
                  style={{
                    borderWidth: 1.5, borderColor: '#7CB9D8',
                    borderRadius: 14, paddingVertical: 12,
                    alignItems: 'center', flexDirection: 'row',
                    justifyContent: 'center', gap: 6,
                  }}
                >
                  <Text style={{ color: '#5AA3C8', fontWeight: '700', fontSize: 14 }}>Ke Dashboard</Text>
                  <Ionicons name="arrow-forward" size={14} color="#5AA3C8" />
                </TouchableOpacity>
              </>
            )}
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ─── Main: WiFiManager ───────────────────────────────────────
export default function WiFiManager({ onConnected }) {
  const [networks,      setNetworks]      = useState([]);
  const [scanning,      setScanning]      = useState(true);
  const [scanError,     setScanError]     = useState(null);
  const [wifiStatus,    setWifiStatus]    = useState(null);
  const [selectedNet,   setSelectedNet]   = useState(null);
  const [showConnect,   setShowConnect]   = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [scanHint,      setScanHint]      = useState(null);
  const [localIp,       setLocalIp]       = useState(null);
  const [retryInfo,     setRetryInfo]     = useState(null);
  const [setupWarning,  setSetupWarning]  = useState(null);
  const [espConnected, setEspConnected]       = useState(false);
  const [espConnectedSsid, setEspConnectedSsid] = useState(null);

  const headerOpac = useRef(new Animated.Value(0)).current;
  const headerY    = useRef(new Animated.Value(-20)).current;
  const spinAnim   = useRef(new Animated.Value(0)).current;
  const keepAliveRef  = useRef(null);
  const appStateRef   = useRef(AppState.currentState);

  const handleEspConnected = useCallback((ssid, { autoNavigate = false } = {}) => {
    clearInterval(keepAliveRef.current);
    setScanError(null);
    setSetupWarning(null);
    setScanHint(null);
    setWifiStatus((prev) => ({
      ...(prev || {}),
      connected: true,
      ssid,
    }));
    setEspConnected(true);
    setEspConnectedSsid(ssid);
    if (autoNavigate) {
      setTimeout(() => onConnected?.(), 1500);
    }
  }, [onConnected]);

  // ── Fix: jaga agar HP tidak drop dari UniFlow-Setup ──────────
  //
  // Android agresif mendrop koneksi AP yang "tidak punya internet".
  // Kita counter dengan:
  //  1. Ping ringan ke ESP32 tiap 3 detik saat WiFiManager aktif
  //     → menjaga ARP table + cegah Android idle-drop interface
  //  2. AppState listener: kalau app kembali ke foreground, langsung
  //     re-check status (user mungkin sempat buka Settings WiFi)
  const pingESP = useCallback(async () => {
    try {
      // Ping ringan — hanya butuh response apa saja
      await fetch(`http://${ESP_IP}/api/wifi/status?_=${Date.now()}`, {
        headers: { Connection: 'close', Accept: 'application/json' },
        signal: AbortSignal.timeout(1500),
      });
    } catch {
      // Abaikan error — tujuan hanya keep-alive, bukan baca data
    }
  }, []);

  useEffect(() => {
    if (espConnected) return;
    // Mulai keep-alive ping tiap 3 detik
    keepAliveRef.current = setInterval(pingESP, 3000);

    // AppState: re-scan saat app kembali ke foreground
    const sub = AppState.addEventListener('change', (nextState) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        doScan();
      }
      appStateRef.current = nextState;
    });

    return () => {
      clearInterval(keepAliveRef.current);
      sub.remove();
    };
  }, [pingESP, espConnected]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerOpac, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(headerY,    { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (scanning) {
      Animated.loop(
        Animated.timing(spinAnim, { toValue: 1, duration: 1200, useNativeDriver: true })
      ).start();
    } else {
      spinAnim.setValue(0);
    }
  }, [scanning]);

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const doScan = useCallback(async () => {
    setScanning(true);
    setScanError(null);
    setScanHint(null);
    setRetryInfo(null);
    setSetupWarning(null);

    try {
      const ipAddress = await getLocalIpAddress();
      setLocalIp(ipAddress);
      const connectedToEspAp = isOnEspSetupNetwork(ipAddress);
      if (!connectedToEspAp) {
        setSetupWarning('HP belum berada di WiFi UniFlow-Setup. Hubungkan dulu ke jaringan setup ESP32, lalu tekan Refresh.');
      }

      let scanResult   = { networks: [] };
      let statusResult = null;

      try {
        setScanHint('Menghubungi ESP32...');
        statusResult = await getWifiStatus();
        setScanHint(null);
      } catch (e) {
        setScanHint(null);
      }

      // Kalau ESP sudah connected ke WiFi, stop scan langsung
      if (statusResult?.connected && statusResult?.ssid) {
        setWifiStatus(statusResult);
        setScanError(null);
        setSetupWarning(null);
        handleEspConnected(statusResult.ssid, { autoNavigate: false });
        setScanning(false);
        return;
      }

      try {
        setScanHint('ESP32 memindai jaringan WiFi...');
        const patchedScan = async (attempt = 0) => {
          if (attempt > 0) setRetryInfo(`Percobaan ${attempt}/8...`);
          try {
            const res = await espFetch('/scan', {}, 12000);
            if (res.scanning === true) {
              if (attempt >= 8) return { networks: [] };
              await new Promise(r => setTimeout(r, 2500));
              return patchedScan(attempt + 1);
            }
            return res;
          } catch {
            if (attempt >= 8) return { networks: [] };
            await new Promise(r => setTimeout(r, 2500));
            return patchedScan(attempt + 1);
          }
        };
        scanResult = await patchedScan();
        setScanHint(null);
        setRetryInfo(null);
      } catch (e) {
        setScanHint(null);
        setRetryInfo(null);
      }

      const hasNetworks = (scanResult.networks || []).length > 0;
      const hasStatus   = !!statusResult;

      if (!hasNetworks && !hasStatus) {
        if (connectedToEspAp) {
          setScanError(
            `HP sudah di jaringan ESP (${ipAddress}), tetapi ESP32 belum merespons.\n\n` +
            `Kemungkinan penyebab:\n` +
            `\u2022 ESP32 masih proses koneksi ke WiFi kampus (~10 detik)\n` +
            `\u2022 Data seluler/VPN aktif \u2192 Android memblokir HTTP ke 192.168.4.1\n` +
            `\u2022 Pilih "Tetap terhubung" jika ada peringatan "WiFi tanpa internet"\n\n` +
            `Tunggu 10 detik lalu tekan Coba Lagi.`
          );
        } else {
          setScanError(
            'HP belum terhubung ke jaringan setup ESP32.\n' +
            'Pilih WiFi "UniFlow-Setup" dari pengaturan WiFi, lalu kembali ke aplikasi.'
          );
        }
        return;
      }

      setNetworks(scanResult.networks || []);
      if (statusResult) setWifiStatus(statusResult);

    } finally {
      setScanning(false);
    }
  }, [handleEspConnected]);

  useEffect(() => {
    if (espConnected) return;
    doScan();
    const iv = setInterval(doScan, SCAN_INTERVAL);
    return () => clearInterval(iv);
  }, [doScan, espConnected]);

  const handleSelectNetwork = (network) => {
    setSelectedNet(network);
    setShowConnect(true);
  };

  const handleManualNetwork = () => {
    setSelectedNet({ ssid: '', secured: true, rssi: -60, manual: true });
    setShowConnect(true);
  };

  /**
   * FIX: handleSuccess sekarang dipanggil dari ConnectModal setelah
   * polling membuktikan ESP32 sudah connected (atau timeout / user paksa).
   * Redirect ke Dashboard langsung — tidak ada state tambahan yang perlu diset.
   */
  const handleSuccess = useCallback((ssid) => {
    setShowConnect(false);
    if (ssid) {
      handleEspConnected(ssid, { autoNavigate: true });
    } else {
      onConnected?.();
    }
  }, [handleEspConnected, onConnected]);

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await disconnectWifi();
      setWifiStatus(null);
      doScan();
    } catch (err) {
      console.error(err);
    } finally {
      setDisconnecting(false);
    }
  };

  const sortedNetworks = [...networks].sort((a, b) => {
    const aConn = wifiStatus?.connected && wifiStatus.ssid === a.ssid;
    const bConn = wifiStatus?.connected && wifiStatus.ssid === b.ssid;
    if (aConn) return -1;
    if (bConn) return 1;
    return b.rssi - a.rssi;
  });

  return (
    <View style={{ flex: 1, backgroundColor: '#F0F7FB' }}>

      {/* ── Header ── */}
      <LinearGradient
        colors={['#2E7CA8', '#5AA3C8']}
        style={{
          paddingTop: Platform.OS === 'ios' ? 60 : 44,
          paddingBottom: 28, paddingHorizontal: 20,
        }}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      >
        <Animated.View style={{ opacity: headerOpac, transform: [{ translateY: headerY }] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <View style={{
              width: 40, height: 40, borderRadius: 13,
              backgroundColor: 'rgba(255,255,255,0.2)',
              justifyContent: 'center', alignItems: 'center',
            }}>
              <Ionicons name="wifi" size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: 0.2 }}>
                WiFi Manager
              </Text>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>
                Konfigurasi jaringan UniFlow
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => onConnected?.()}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 5,
                backgroundColor: 'rgba(255,255,255,0.2)',
                borderRadius: 10, paddingHorizontal: 11, paddingVertical: 7,
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
              }}
            >
              <Text style={{ fontSize: 12, color: '#fff', fontWeight: '700' }}>Dashboard</Text>
              <Ionicons name="arrow-forward" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {wifiStatus?.connected && (
          <Animated.View style={{
            opacity: headerOpac,
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: 'rgba(255,255,255,0.18)',
            borderRadius: 12, padding: 10, marginTop: 14, gap: 10,
          }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ADE80' }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>
                Connected - {wifiStatus.ssid}
              </Text>
              <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', marginTop: 1 }}>
                {wifiStatus.ip ? `IP: ${wifiStatus.ip}` : 'ESP32 terhubung'}
                {wifiStatus.signal ? ` \u00b7 ${wifiStatus.signal} dBm` : ''}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleDisconnect}
              disabled={disconnecting}
              style={{
                backgroundColor: 'rgba(239,68,68,0.25)',
                borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
                borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)',
              }}
            >
              {disconnecting
                ? <ActivityIndicator size="small" color="#FCA5A5" />
                : <Text style={{ fontSize: 11, color: '#FCA5A5', fontWeight: '700' }}>Putuskan</Text>
              }
            </TouchableOpacity>
          </Animated.View>
        )}
      </LinearGradient>

      {/* ── Instruksi ── */}
      <View style={{
        margin: 16, marginBottom: 0,
        backgroundColor: '#EFF8FF', borderRadius: 12, padding: 12,
        flexDirection: 'row', gap: 8, borderWidth: 1, borderColor: '#C5DDE8',
      }}>
        <Ionicons name="information-circle-outline" size={16} color="#5AA3C8" style={{ marginTop: 1 }} />
        <Text style={{ fontSize: 12, color: '#4A8BAA', flex: 1, lineHeight: 17 }}>
          Pastikan HP terhubung ke WiFi{' '}
          <Text style={{ fontWeight: '700' }}>"UniFlow-Setup"</Text> dan{' '}
          <Text style={{ fontWeight: '700' }}>matikan data seluler</Text> sementara.
          {localIp ? ` IP HP: ${localIp}.` : ''}
        </Text>
      </View>

      {/* ── Scan header ── */}
      {setupWarning && !espConnected && (
        <View style={{
          marginHorizontal: 16,
          marginTop: 10,
          backgroundColor: '#FFF7ED',
          borderRadius: 12,
          padding: 12,
          flexDirection: 'row',
          gap: 8,
          borderWidth: 1,
          borderColor: '#FED7AA',
        }}>
          <Ionicons name="wifi-outline" size={16} color="#C2410C" style={{ marginTop: 1 }} />
          <Text style={{ fontSize: 12, color: '#C2410C', flex: 1, lineHeight: 17 }}>
            {setupWarning}
          </Text>
        </View>
      )}

      <View style={{
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 16, paddingTop: 18, paddingBottom: 10,
      }}>
        <View>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#1A3040' }}>
            Jaringan Tersedia
            {!scanning && networks.length > 0 && (
              <Text style={{ fontWeight: '400', color: '#8BAFC0' }}> ({networks.length})</Text>
            )}
          </Text>
          {scanHint && (
            <Text style={{ fontSize: 10, color: '#8BAFC0', marginTop: 2 }}>{scanHint}</Text>
          )}
          {retryInfo && (
            <Text style={{ fontSize: 10, color: '#EAB308', marginTop: 2 }}>{retryInfo}</Text>
          )}
        </View>
        <TouchableOpacity
          onPress={doScan}
          disabled={scanning}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 5,
            backgroundColor: '#EAF4FB', borderRadius: 10,
            paddingHorizontal: 12, paddingVertical: 6,
          }}
        >
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Ionicons name="refresh" size={14} color="#5AA3C8" />
          </Animated.View>
          <Text style={{ fontSize: 12, color: '#5AA3C8', fontWeight: '600' }}>
            {scanning ? 'Mencari...' : 'Refresh'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Content ── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {espConnected ? (
          <View style={{
            backgroundColor: '#F0FDF4', borderRadius: 16, padding: 24,
            alignItems: 'center', borderWidth: 1, borderColor: '#BBF7D0', marginTop: 8, gap: 12,
          }}>
            <View style={{
              width: 64, height: 64, borderRadius: 32,
              backgroundColor: '#DCFCE7', justifyContent: 'center', alignItems: 'center',
            }}>
              <Ionicons name="checkmark-circle" size={40} color="#22C55E" />
            </View>
            <View style={{ alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#15803D' }}>
                Connected - {espConnectedSsid}
              </Text>
              <Text style={{ fontSize: 12, color: '#16A34A' }}>ESP32 telah terhubung ke jaringan WiFi</Text>
            </View>
            <TouchableOpacity
              onPress={() => onConnected?.()}
              style={{
                marginTop: 2,
                backgroundColor: '#22C55E',
                borderRadius: 12,
                paddingHorizontal: 18,
                paddingVertical: 10,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>Kembali ke Dashboard</Text>
            </TouchableOpacity>
          </View>
        ) : scanError ? (
          <View style={{
            backgroundColor: '#FEF2F2', borderRadius: 16, padding: 24,
            alignItems: 'center', borderWidth: 1, borderColor: '#FECACA', marginTop: 8,
          }}>
            <View style={{
              width: 56, height: 56, borderRadius: 28,
              backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center',
              marginBottom: 14,
            }}>
              <Ionicons name="wifi-outline" size={28} color="#F87171" />
            </View>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#991B1B', marginBottom: 8, textAlign: 'center' }}>
              ESP32 Tidak Terdeteksi
            </Text>
            <Text style={{ fontSize: 12, color: '#B91C1C', textAlign: 'center', lineHeight: 18, marginBottom: 16 }}>
              {scanError}
            </Text>
            <View style={{
              width: '100%', backgroundColor: '#fff', borderRadius: 12,
              padding: 12, borderWidth: 1, borderColor: '#FECACA', marginBottom: 14,
            }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#991B1B', marginBottom: 8 }}>
                Cek cepat
              </Text>
              {SETUP_CHECKLIST.map((item) => (
                <View key={item} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginBottom: 6 }}>
                  <Ionicons name="checkmark-circle-outline" size={14} color="#EF4444" style={{ marginTop: 1 }} />
                  <Text style={{ flex: 1, fontSize: 11, color: '#7F1D1D', lineHeight: 16 }}>{item}</Text>
                </View>
              ))}
              <Text style={{ fontSize: 10, color: '#B91C1C', marginTop: 4 }}>
                {localIp ? `IP HP saat ini: ${localIp}` : 'IP HP belum terbaca'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={doScan}
              style={{ backgroundColor: '#EF4444', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 10 }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Coba Lagi</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleManualNetwork}
              style={{
                marginTop: 10, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 10,
                borderWidth: 1.5, borderColor: '#EF4444',
              }}
            >
              <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 13 }}>Input WiFi Manual</Text>
            </TouchableOpacity>
          </View>
        ) : scanning && networks.length === 0 ? (
          <View style={{ paddingVertical: 48, alignItems: 'center', gap: 14 }}>
            <ActivityIndicator size="large" color="#7CB9D8" />
            <Text style={{ fontSize: 13, color: '#8BAFC0', textAlign: 'center' }}>
              {scanHint || 'Mencari jaringan WiFi...'}
            </Text>
            {retryInfo && (
              <Text style={{ fontSize: 11, color: '#EAB308' }}>{retryInfo}</Text>
            )}
          </View>
        ) : networks.length === 0 ? (
          <View style={{ paddingVertical: 48, alignItems: 'center', gap: 10 }}>
            <Ionicons name="wifi-outline" size={40} color="#C5DDE8" />
            <Text style={{ fontSize: 13, color: '#8BAFC0' }}>Tidak ada jaringan ditemukan</Text>
            <TouchableOpacity onPress={doScan}>
              <Text style={{ fontSize: 12, color: '#7CB9D8', fontWeight: '600' }}>Scan ulang</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleManualNetwork}>
              <Text style={{ fontSize: 12, color: '#7CB9D8', fontWeight: '600' }}>Input WiFi manual</Text>
            </TouchableOpacity>
          </View>
        ) : (
          sortedNetworks.map((network, idx) => (
            <NetworkItem
              key={`${network.ssid}-${idx}`}
              network={network}
              onPress={handleSelectNetwork}
              isConnected={wifiStatus?.connected && wifiStatus.ssid === network.ssid}
            />
          ))
        )}
      </ScrollView>

      <ConnectModal
        visible={showConnect}
        network={selectedNet}
        onClose={() => setShowConnect(false)}
        onSuccess={handleSuccess}
      />
    </View>
  );
}
