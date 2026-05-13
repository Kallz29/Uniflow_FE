import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Animated, Modal, Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import {
  scanNetworks, getWifiStatus, connectWifi, disconnectWifi,
} from '../services/espWifi';
import { getLocalIpAddress, isEspSetupIp } from '../services/espDevice';
import { toUserMessage, logError } from '../utils/errorHandler';

// ─── Konstanta ──────────────────────────────────────────────
const SCAN_INTERVAL_MS = 15000;

// ─── Helpers tampilan sinyal ────────────────────────────────
const getSignalInfo = (rssi) => {
  if (rssi >= -50) return { icon: 'wifi',         color: '#22C55E', label: 'Kuat' };
  if (rssi >= -65) return { icon: 'wifi',         color: '#84CC16', label: 'Baik' };
  if (rssi >= -75) return { icon: 'wifi-outline', color: '#EAB308', label: 'Lemah' };
  return             { icon: 'wifi-outline',       color: '#EF4444', label: 'Sangat Lemah' };
};

// ─── NetworkItem ────────────────────────────────────────────
const NetworkItem = ({ network, onPress, isConnected }) => {
  const sig = getSignalInfo(network.rssi);
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
            {sig.label} · {network.rssi} dBm
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

// ─── ConnectModal ───────────────────────────────────────────
const ConnectModal = ({ visible, network, onClose, onSuccess }) => {
  const [ssid,       setSsid]       = useState('');
  const [password,   setPassword]   = useState('');
  const [showPass,   setShowPass]   = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error,      setError]      = useState(null);
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (visible) {
      setSsid(network?.ssid || '');
      setPassword('');
      setError(null);
      Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 12, useNativeDriver: true }).start();
    } else {
      slideAnim.setValue(300);
    }
  }, [visible, network]);

  const handleConnect = async () => {
    const targetSsid = ssid.trim();
    if (!targetSsid) { setError('Masukkan nama WiFi terlebih dahulu'); return; }
    if (network?.secured && !password.trim()) { setError('Masukkan password terlebih dahulu'); return; }

    setConnecting(true);
    setError(null);
    try {
      const res = await connectWifi(targetSsid, password);
      if (res.success) {
        onSuccess(targetSsid);
      } else {
        setError(res.message || 'Gagal terhubung, cek password');
      }
    } catch (err) {
      logError('WifiManager.connect', err);
      setError(
        toUserMessage(err, 'Tidak dapat menjangkau ESP32.') +
        '\n\nPastikan:\n' +
        '• HP terhubung ke WiFi "UniFlow-Setup"\n' +
        '• Data seluler/VPN dimatikan\n' +
        '• Pilih "Tetap terhubung" jika ada peringatan'
      );
    } finally {
      setConnecting(false);
    }
  };

  if (!network) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
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

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <View style={{
                width: 44, height: 44, borderRadius: 13,
                backgroundColor: '#EFF8FF', justifyContent: 'center', alignItems: 'center',
              }}>
                <Ionicons name="wifi" size={22} color="#5AA3C8" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#1A3040' }}>
                  {network.manual ? 'Input WiFi Manual' : network.ssid}
                </Text>
                <Text style={{ fontSize: 11, color: '#8BAFC0', marginTop: 1 }}>
                  {network.secured ? 'Jaringan terenkripsi' : 'Jaringan terbuka'}
                </Text>
              </View>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close-circle" size={24} color="#C5DDE8" />
              </TouchableOpacity>
            </View>

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
              disabled={connecting}
              activeOpacity={0.85}
              style={{
                backgroundColor: connecting ? '#A8D4EA' : '#5AA3C8',
                borderRadius: 14, paddingVertical: 14,
                alignItems: 'center', flexDirection: 'row',
                justifyContent: 'center', gap: 8,
              }}
            >
              {connecting ? (
                <>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Menghubungkan...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="wifi" size={16} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Hubungkan</Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ─── Main: WiFiManager ──────────────────────────────────────
export default function WiFiManager({ onConnected }) {
  const [networks,      setNetworks]      = useState([]);
  const [scanning,      setScanning]      = useState(true);
  const [scanError,     setScanError]     = useState(null);
  const [wifiStatus,    setWifiStatus]    = useState(null);
  const [selectedNet,   setSelectedNet]   = useState(null);
  const [showConnect,   setShowConnect]   = useState(false);
  const [successSSID,   setSuccessSSID]   = useState(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [scanHint,      setScanHint]      = useState(null);
  const [localIp,       setLocalIp]       = useState(null);
  const [retryInfo,     setRetryInfo]     = useState(null);

  // Cek apakah komponen masih mounted saat async selesai —
  // penting untuk interval scan yang terus berjalan.
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const headerOpac = useRef(new Animated.Value(0)).current;
  const headerY    = useRef(new Animated.Value(-20)).current;
  const spinAnim   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerOpac, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(headerY,    { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, [headerOpac, headerY]);

  useEffect(() => {
    if (scanning) {
      Animated.loop(
        Animated.timing(spinAnim, { toValue: 1, duration: 1200, useNativeDriver: true })
      ).start();
    } else {
      spinAnim.setValue(0);
    }
  }, [scanning, spinAnim]);

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const doScan = useCallback(async () => {
    if (!mountedRef.current) return;
    setScanning(true);
    setScanError(null);
    setScanHint(null);
    setRetryInfo(null);

    const ipAddress = await getLocalIpAddress();
    if (!mountedRef.current) return;
    setLocalIp(ipAddress);
    const connectedToEspAp = isEspSetupIp(ipAddress);

    // Ambil status dulu (ringan) supaya tahu ESP hidup atau tidak.
    let statusResult = null;
    try {
      setScanHint('Menghubungi ESP32...');
      statusResult = await getWifiStatus();
    } catch (err) {
      // Diam — status gagal tidak fatal, lanjut scan.
      logError('WifiManager.status', err);
    } finally {
      if (mountedRef.current) setScanHint(null);
    }

    // Scan jaringan dengan progress retry.
    let scanResult = { networks: [] };
    let scanErrorObj = null;
    try {
      setScanHint('ESP32 memindai jaringan WiFi...');
      scanResult = await scanNetworks((attempt, max) => {
        if (mountedRef.current) setRetryInfo(`Percobaan ${attempt}/${max}...`);
      });
    } catch (err) {
      scanErrorObj = err;
      logError('WifiManager.scan', err);
    } finally {
      if (mountedRef.current) { setScanHint(null); setRetryInfo(null); }
    }

    if (!mountedRef.current) return;

    const hasNetworks = (scanResult.networks || []).length > 0;
    const hasStatus   = !!statusResult;

    if (!hasNetworks && !hasStatus) {
      if (connectedToEspAp) {
        setScanError(
          `HP sudah di jaringan ESP (${ipAddress}), tetapi ESP32 belum merespons.\n\n` +
          `Kemungkinan penyebab:\n` +
          `• ESP32 masih proses koneksi ke WiFi kampus (~10 detik)\n` +
          `• Data seluler/VPN aktif — Android memblokir HTTP ke 192.168.4.1\n` +
          `• Pilih "Tetap terhubung" jika ada peringatan "WiFi tanpa internet"\n\n` +
          `Tunggu 10 detik lalu tekan Coba Lagi.`
        );
      } else {
        setScanError(
          (scanErrorObj ? toUserMessage(scanErrorObj) + '\n\n' : '') +
          'Pastikan HP terhubung ke WiFi "UniFlow-Setup".'
        );
      }
      setScanning(false);
      return;
    }

    setNetworks(scanResult.networks || []);
    if (statusResult) setWifiStatus(statusResult);
    setScanning(false);
  }, []);

  // Auto-scan: sekali saat mount + polling berkala.
  useEffect(() => {
    doScan();
    const iv = setInterval(doScan, SCAN_INTERVAL_MS);
    return () => clearInterval(iv);
  }, [doScan]);

  const handleSelectNetwork = (network) => {
    setSelectedNet(network);
    setShowConnect(true);
  };

  const handleManualNetwork = () => {
    setSelectedNet({ ssid: '', secured: true, rssi: -60, manual: true });
    setShowConnect(true);
  };

  const handleSuccess = (ssid) => {
    // ESP sudah konfirmasi success → ke dashboard setelah delay pendek.
    setShowConnect(false);
    setSuccessSSID(ssid);
    setTimeout(() => onConnected?.(), 800);
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await disconnectWifi();
      setWifiStatus(null);
      setSuccessSSID(null);
      doScan();
    } catch (err) {
      logError('WifiManager.disconnect', err);
      setScanError(toUserMessage(err, 'Gagal memutuskan koneksi'));
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
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>{wifiStatus.ssid}</Text>
              <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', marginTop: 1 }}>
                {wifiStatus.ip ? `IP: ${wifiStatus.ip}` : 'Terhubung'}
                {wifiStatus.signal ? ` · ${wifiStatus.signal} dBm` : ''}
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
        {scanError ? (
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
          <>
            {successSSID && !wifiStatus?.connected && (
              <View style={{
                backgroundColor: '#F0FDF4', borderRadius: 12, padding: 12,
                flexDirection: 'row', alignItems: 'center', gap: 9,
                borderWidth: 1, borderColor: '#BBF7D0', marginBottom: 12,
              }}>
                <ActivityIndicator size="small" color="#22C55E" />
                <Text style={{ fontSize: 13, color: '#15803D', fontWeight: '600', flex: 1 }}>
                  Menghubungkan ke {successSSID}...
                </Text>
              </View>
            )}

            {wifiStatus?.connected && (
              <View style={{
                backgroundColor: '#F0FDF4', borderRadius: 12, padding: 12,
                flexDirection: 'row', alignItems: 'center', gap: 9,
                borderWidth: 1, borderColor: '#BBF7D0', marginBottom: 12,
              }}>
                <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
                <Text style={{ fontSize: 13, color: '#15803D', fontWeight: '600', flex: 1 }}>
                  Berhasil terhubung ke {wifiStatus.ssid}
                </Text>
              </View>
            )}

            {sortedNetworks.map((network, idx) => (
              <NetworkItem
                key={`${network.ssid}-${idx}`}
                network={network}
                onPress={handleSelectNetwork}
                isConnected={wifiStatus?.connected && wifiStatus.ssid === network.ssid}
              />
            ))}
          </>
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
