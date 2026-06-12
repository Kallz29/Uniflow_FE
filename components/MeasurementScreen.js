import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  getLatestSensor, getAllDevices, getMeasurements,
  startMeasurement, stopMeasurement, updateDevice,
} from '../services/api';
import { toUserMessage, logError } from '../utils/errorHandler';

const REFRESH_INTERVAL = 3000;
const START_COLOR = '#5AA3C8';
const START_COLOR_DARK = '#3E8FB8';
const STOP_COLOR_DARK = '#DC2626';

const parseWIB = (str) => {
  if (!str) return new Date();
  return new Date(new Date(str).getTime() + 7 * 60 * 60 * 1000);
};

const formatElapsed = (sec) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
};

const PARAM_META = [
  { key: 'ph', label: 'pH', unit: 'pH', icon: 'water' },
  { key: 'temperature', label: 'Suhu', unit: '°C', icon: 'thermometer' },
  { key: 'tds', label: 'TDS', unit: 'ppm', icon: 'flask' },
  { key: 'turbidity', label: 'Kekeruhan', unit: 'NTU', icon: 'eyedrop' },
];

export default function MeasurementScreen({ onBack }) {
  const [latest, setLatest] = useState(null);
  const [devices, setDevices] = useState([]);
  const [activeMeasurement, setActiveMeasurement] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [step, setStep] = useState('idle');
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [locationInput, setLocationInput] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [latestRes, devRes, measRes] = await Promise.all([
        getLatestSensor(),
        getAllDevices(),
        getMeasurements(),
      ]);
      setLatest(latestRes.data);
      setDevices(devRes.data || []);
      const sessions = measRes.data || [];
      setActiveMeasurement(sessions.find((s) => s.status === 'active') || null);
    } catch (err) {
      logError('MeasurementScreen.fetch', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(iv);
  }, [fetchData]);

  useEffect(() => {
    if (!activeMeasurement?.start_time) {
      setElapsed(0);
      return;
    }
    const startMs = new Date(activeMeasurement.start_time).getTime();
    const tick = () => {
      const diff = Math.floor((Date.now() - startMs) / 1000);
      setElapsed(diff > 0 ? diff : 0);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [activeMeasurement?.start_time]);

  const handleStart = async () => {
    const loc = locationInput.trim();
    if (!loc) {
      Alert.alert('Lokasi kosong', 'Masukkan lokasi dulu.');
      return;
    }
    if (!selectedDevice?.id || !selectedDevice?.device_code) {
      Alert.alert('Perangkat belum dipilih', 'Pilih perangkat dulu.');
      return;
    }
    if (selectedDevice.status !== 'active') {
      Alert.alert('Perangkat offline', 'Sesi hanya bisa dimulai dari perangkat yang online.');
      return;
    }

    setActionLoading(true);
    try {
      await updateDevice(selectedDevice.id, { location: loc });
      await startMeasurement(selectedDevice.device_code);
      setStep('idle');
      setSelectedDevice(null);
      setLocationInput('');
      fetchData();
    } catch (err) {
      Alert.alert('Gagal', toUserMessage(err, 'Gagal memulai sesi'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    const code = activeMeasurement?.device?.device_code
      ?? activeMeasurement?.device_code
      ?? devices.find((d) => d.id === activeMeasurement?.device_id)?.device_code;
    if (!code) return;

    setActionLoading(true);
    try {
      await stopMeasurement(code);
      setActiveMeasurement(null);
      setElapsed(0);
      fetchData();
    } catch (err) {
      Alert.alert('Gagal', toUserMessage(err, 'Gagal menghentikan sesi'));
    } finally {
      setActionLoading(false);
    }
  };

  const params = latest
    ? PARAM_META.map((p) => ({ ...p, value: latest[p.key] }))
    : [];

  return (
    <View style={{ flex: 1, backgroundColor: '#F0F7FB' }}>
      <LinearGradient
        colors={[START_COLOR, START_COLOR_DARK]}
        style={{ paddingTop: 52, paddingBottom: 20, paddingHorizontal: 20 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={onBack}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#fff' }}>Sesi Pengukuran</Text>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>
              {activeMeasurement ? `Aktif · ${activeMeasurement.location || ''}` : 'Tidak ada sesi aktif'}
            </Text>
          </View>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#7CB9D8" />
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12 }}>
          {step === 'idle' && (
            <TouchableOpacity
              onPress={activeMeasurement ? handleStop : () => setStep('pick_device')}
              disabled={actionLoading}
              activeOpacity={0.85}
              style={{
                backgroundColor: activeMeasurement ? STOP_COLOR_DARK : START_COLOR,
                borderRadius: 14, paddingVertical: 16,
                flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10,
              }}
            >
              {actionLoading ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name={activeMeasurement ? 'stop-circle' : 'play-circle'} size={22} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
                    {activeMeasurement ? 'Stop Sesi' : 'Start Sesi'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {step === 'pick_device' && (
            <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: '#D1E8F5' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#1A3040' }}>Pilih Perangkat</Text>
                <TouchableOpacity onPress={() => setStep('idle')}>
                  <Ionicons name="close" size={20} color="#8BAFC0" />
                </TouchableOpacity>
              </View>
              {devices.map((d) => (
                <TouchableOpacity
                  key={d.id}
                  disabled={d.status !== 'active'}
                  onPress={() => {
                    setSelectedDevice(d);
                    setLocationInput(d.location || '');
                    setStep('input_location');
                  }}
                  style={{
                    flexDirection: 'row', alignItems: 'center',
                    backgroundColor: d.status === 'active' ? '#F0F9FF' : '#F8FAFC',
                    borderRadius: 12, padding: 12, marginBottom: 8,
                    borderWidth: 1.5, borderColor: d.status === 'active' ? '#D1E8F5' : '#E5E7EB',
                    opacity: d.status === 'active' ? 1 : 0.68,
                  }}
                >
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#3E8FB8', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                    <Ionicons name="hardware-chip" size={16} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#1A3040' }}>{d.device_code}</Text>
                    <Text style={{ fontSize: 11, color: '#8BAFC0' }}>
                      {d.status === 'active' ? (d.location || 'Lokasi belum diatur') : 'Perangkat offline'}
                    </Text>
                  </View>
                  <View style={{ backgroundColor: d.status === 'active' ? '#D1FAE5' : '#FEE2E2', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: d.status === 'active' ? '#065F46' : '#991B1B' }}>
                      {d.status === 'active' ? 'Online' : 'Offline'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {step === 'input_location' && (
            <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: '#D1E8F5' }}>
              <TouchableOpacity onPress={() => setStep('pick_device')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                <Ionicons name="chevron-back" size={16} color={START_COLOR} />
                <Text style={{ fontSize: 12, color: START_COLOR, fontWeight: '600' }}>Ganti Perangkat</Text>
              </TouchableOpacity>

              <View style={{ backgroundColor: '#F0F9FF', borderRadius: 10, padding: 10, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="hardware-chip" size={16} color="#3E8FB8" />
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#1A3040' }}>{selectedDevice?.device_code}</Text>
              </View>

              <Text style={{ fontSize: 12, fontWeight: '700', color: '#1A3040', marginBottom: 6 }}>Lokasi Pengukuran</Text>
              <TextInput
                value={locationInput}
                onChangeText={setLocationInput}
                placeholder="Contoh: Asrama, IPAL, Sport Center..."
                placeholderTextColor="#B0CFE0"
                autoFocus
                style={{
                  borderWidth: 1.5, borderColor: '#D1E8F5', borderRadius: 10,
                  padding: 12, fontSize: 14, color: '#1A3040', backgroundColor: '#F9FAFB', marginBottom: 14,
                }}
              />

              <TouchableOpacity
                onPress={handleStart}
                disabled={actionLoading || !locationInput.trim()}
                style={{
                  backgroundColor: locationInput.trim() ? START_COLOR : '#C5DDE8',
                  borderRadius: 12, paddingVertical: 13,
                  flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
                }}
              >
                {actionLoading ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Ionicons name="play-circle" size={18} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                      Mulai di {locationInput || '...'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {latest && (
            <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: '#D1E8F5' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: activeMeasurement ? '#22C55E' : '#94A3B8' }} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#1A3040' }}>
                  {activeMeasurement ? 'Data Live' : 'Data Terakhir'}
                </Text>
                <Text style={{ fontSize: 11, color: '#8BAFC0', marginLeft: 'auto' }}>
                  WQI: {latest.wqi_score ? Math.round(latest.wqi_score) : '-'}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {params.map((p) => (
                  <View
                    key={p.label}
                    style={{
                      width: '47%', backgroundColor: '#F0F9FF',
                      borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#D1E8F5',
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <Ionicons name={p.icon} size={13} color="#5AA3C8" />
                      <Text style={{ fontSize: 11, color: '#8BAFC0', fontWeight: '600' }}>{p.label}</Text>
                    </View>
                    <Text style={{ fontSize: 22, fontWeight: '800', color: '#1A3040' }}>
                      {p.value != null ? parseFloat(p.value).toFixed(1) : '-'}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#8BAFC0' }}>{p.unit}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {activeMeasurement && (
            <View style={{ backgroundColor: '#F0FDF4', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: '#BBF7D0' }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#166534', marginBottom: 8 }}>Info Sesi</Text>
              {[
                { label: 'ID Sesi', value: `#${activeMeasurement.id}` },
                { label: 'Lokasi', value: activeMeasurement.location || '-' },
                { label: 'Mulai', value: parseWIB(activeMeasurement.start_time).toLocaleString('id-ID') },
                { label: 'Durasi', value: formatElapsed(elapsed) },
              ].map((row) => (
                <View key={row.label} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontSize: 12, color: '#6B7280' }}>{row.label}</Text>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#1A3040' }}>{row.value}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
