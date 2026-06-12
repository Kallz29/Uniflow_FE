import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Modal, View, Text, ScrollView, TouchableOpacity,
  Share, Alert, TextInput, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { historyModalStyles as styles } from '../styles/historyModalStyles';
import { logError } from '../utils/errorHandler';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { exportSensorCSV, getAllSensors } from '../services/api';

// ─── Konstanta ─────────────────────────────────────────────
const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const DAYS_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

// ─── Helpers kalender ──────────────────────────────────────
const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();
const toWibDate = (value) => {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  const utc = new Date(value);
  return new Date(utc.getTime() + 7 * 60 * 60 * 1000);
};

const HISTORY_FIELD = {
  0: { field: 'wqi_score', unit: 'Skor' },
  1: { field: 'ph', unit: 'pH' },
  2: { field: 'temperature', unit: '°C' },
  3: { field: 'tds', unit: 'ppm' },
  4: { field: 'turbidity', unit: 'NTU' },
};

const getBackendStatus = (item, dataId) => {
  if (dataId === 0) {
    const status = String(item.wqi_status || '').toLowerCase();
    if (status === 'buruk' || status === 'danger') return 'danger';
    if (status === 'sedang' || status === 'warning') return 'warning';
    return 'good';
  }

  return item.status || item.sensor_status || 'good';
};

const mapSensorsToHistory = (rows, dataId) => {
  const meta = HISTORY_FIELD[dataId];
  if (!meta) return [];

  return (rows || [])
    .filter((item) => item?.[meta.field] != null)
    .map((item) => {
      const rawValue = Number(item[meta.field]);
      const value = Number.isFinite(rawValue)
        ? rawValue.toFixed(meta.field === 'tds' || meta.field === 'wqi_score' ? 0 : 1)
        : String(item[meta.field]);

      return {
        timestamp: toWibDate(item.created_at),
        value,
        unit: meta.unit,
        status: getBackendStatus(item, dataId),
        location: item.session_location || item.location || null,
      };
    });
};

const Sparkline = ({ data, color = '#7CB9D8', width = 120, height = 36 }) => {
  if (!data || data.length < 2) return null;

  const values = data
    .slice(0, 20)
    .map((d) => parseFloat(d.value))
    .filter((v) => !isNaN(v));
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const point = (value, index) => ({
    x: (index / (values.length - 1)) * width,
    y: height - ((value - min) / range) * height,
  });

  return (
    <View style={{ width, height, position: 'relative', overflow: 'hidden' }}>
      {values.map((v, i) => {
        if (i === 0) return null;
        const p1 = point(values[i - 1], i - 1);
        const p2 = point(v, i);
        const lineWidth = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: (p1.x + p2.x) / 2 - lineWidth / 2,
              top: (p1.y + p2.y) / 2 - 0.75,
              width: lineWidth,
              height: 1.5,
              backgroundColor: color,
              borderRadius: 1,
              transform: [{ rotate: `${angle}deg` }],
            }}
          />
        );
      })}
      <View style={{
        position: 'absolute',
        left: point(values[values.length - 1], values.length - 1).x - 3,
        top: point(values[values.length - 1], values.length - 1).y - 3,
        width: 6, height: 6, borderRadius: 3,
        backgroundColor: color,
      }} />
    </View>
  );
};

// ─── Calendar Filter Modal ─────────────────────────────────
function CalendarFilterModal({ visible, onClose, onApply, history, zones }) {
  const now = new Date();

  const dataDateSet = useMemo(() => {
    const set = new Set();
    history.forEach((h) => {
      const d = toWibDate(h.timestamp);
      set.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    });
    return set;
  }, [history]);

  const hasDataOnDate = (year, month, day) =>
    dataDateSet.has(`${year}-${month}-${day}`);

  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [selecting, setSelecting] = useState('start');
  const [activeZone, setActiveZone] = useState(null);
  const [startHour, setStartHour] = useState(0);
  const [endHour, setEndHour] = useState(23);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  const toDateObj = (d) => d ? new Date(d.year, d.month, d.day) : null;

  const handleSelectDay = (day) => {
    const selected = { year: viewYear, month: viewMonth, day };
    if (selecting === 'start') {
      setStartDate(selected);
      setEndDate(null);
      setSelecting('end');
    } else {
      const s = toDateObj(startDate);
      const e = new Date(viewYear, viewMonth, day);
      if (e < s) {
        setEndDate(startDate);
        setStartDate(selected);
      } else {
        setEndDate(selected);
      }
      setSelecting('start');
    }
  };

  const isInRange = (day) => {
    if (!startDate || !endDate) return false;
    const d = new Date(viewYear, viewMonth, day);
    return d > toDateObj(startDate) && d < toDateObj(endDate);
  };

  const isStart = (day) =>
    startDate && startDate.year === viewYear &&
    startDate.month === viewMonth && startDate.day === day;

  const isEnd = (day) =>
    endDate && endDate.year === viewYear &&
    endDate.month === viewMonth && endDate.day === day;

  const handleReset = () => {
    setStartDate(null);
    setEndDate(null);
    setSelecting('start');
    setActiveZone(null);
    setStartHour(0);
    setEndHour(23);
  };

  const handleApply = () => {
    onApply({ startDate, endDate, zone: activeZone, startHour, endHour });
    onClose();
  };

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  const formatSelected = (d) => {
    if (!d) return '--';
    return `${d.day} ${MONTHS_SHORT[d.month]} ${d.year}`;
  };

  // Hitung berapa data per zona (untuk badge)
  const zoneCountMap = useMemo(() => {
    const map = {};
    history.forEach((h) => {
      if (h.location) map[h.location] = (map[h.location] || 0) + 1;
    });
    return map;
  }, [history]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <ScrollView
          style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header modal */}
          <View style={{
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            padding: 16, borderBottomWidth: 1, borderBottomColor: '#EAF4FB',
          }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#1A3040' }}>Filter</Text>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <TouchableOpacity onPress={handleReset}>
                <Text style={{ fontSize: 12, color: '#8BAFC0', fontWeight: '600' }}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={22} color="#8BAFC0" />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── ZONA SECTION ── */}
          <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#1A3040' }}>
                Lokasi
              </Text>
              {zones && zones.length === 0 && (
                <Text style={{ fontSize: 11, color: '#B0CFE0', fontStyle: 'italic' }}>
                  Belum ada data zona
                </Text>
              )}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {/* Pill "Semua" */}
                <TouchableOpacity
                  onPress={() => setActiveZone(null)}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 7,
                    borderRadius: 20, borderWidth: 1.5,
                    borderColor: activeZone === null ? '#7CB9D8' : '#D1E8F5',
                    backgroundColor: activeZone === null ? '#7CB9D8' : '#F9FAFB',
                    flexDirection: 'row', alignItems: 'center', gap: 5,
                  }}
                >
                  <Ionicons
                    name="layers-outline"
                    size={12}
                    color={activeZone === null ? '#fff' : '#8BAFC0'}
                  />
                  <Text style={{
                    fontSize: 12, fontWeight: '700',
                    color: activeZone === null ? '#fff' : '#8BAFC0',
                  }}>
                    Semua
                  </Text>
                  <View style={{
                    backgroundColor: activeZone === null ? 'rgba(255,255,255,0.35)' : '#EAF4FB',
                    borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1, minWidth: 18, alignItems: 'center',
                  }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: activeZone === null ? '#fff' : '#5AA3C8' }}>
                      {history.length}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Pill per zona */}
                {(zones || []).map((z) => (
                  <TouchableOpacity
                    key={z}
                    onPress={() => setActiveZone(activeZone === z ? null : z)}
                    style={{
                      paddingHorizontal: 14, paddingVertical: 7,
                      borderRadius: 20, borderWidth: 1.5,
                      borderColor: activeZone === z ? '#5AA3C8' : '#D1E8F5',
                      backgroundColor: activeZone === z ? '#EFF8FF' : '#F9FAFB',
                      flexDirection: 'row', alignItems: 'center', gap: 5,
                    }}
                  >
                    <Ionicons
                      name="location-outline"
                      size={12}
                      color={activeZone === z ? '#2A7DA0' : '#8BAFC0'}
                    />
                    <Text style={{
                      fontSize: 12, fontWeight: '700',
                      color: activeZone === z ? '#2A7DA0' : '#8BAFC0',
                    }}>
                      {z}
                    </Text>
                    {zoneCountMap[z] != null && (
                      <View style={{
                        backgroundColor: activeZone === z ? '#D1E8F5' : '#EAF4FB',
                        borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1, minWidth: 18, alignItems: 'center',
                      }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#5AA3C8' }}>
                          {zoneCountMap[z]}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: '#EAF4FB', marginTop: 12, marginHorizontal: 16 }} />

          {/* ── TANGGAL SECTION ── */}
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#1A3040', paddingHorizontal: 16, paddingTop: 14, marginBottom: 8 }}>
            Rentang Tanggal
          </Text>

          {/* Pilih range indicator */}
          <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: 4 }}>
            <TouchableOpacity
              onPress={() => setSelecting('start')}
              style={{
                flex: 1, borderRadius: 12, padding: 10, borderWidth: 1.5,
                borderColor: selecting === 'start' ? '#7CB9D8' : '#D1E8F5',
                backgroundColor: selecting === 'start' ? '#EFF8FF' : '#F9FAFB',
              }}
            >
              <Text style={{ fontSize: 10, color: '#8BAFC0', fontWeight: '600', marginBottom: 3 }}>DARI</Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: startDate ? '#1A3040' : '#B0CFE0' }}>
                {formatSelected(startDate)}
              </Text>
            </TouchableOpacity>

            <View style={{ justifyContent: 'center' }}>
              <Ionicons name="arrow-forward" size={16} color="#B0CFE0" />
            </View>

            <TouchableOpacity
              onPress={() => setSelecting('end')}
              style={{
                flex: 1, borderRadius: 12, padding: 10, borderWidth: 1.5,
                borderColor: selecting === 'end' ? '#7CB9D8' : '#D1E8F5',
                backgroundColor: selecting === 'end' ? '#EFF8FF' : '#F9FAFB',
              }}
            >
              <Text style={{ fontSize: 10, color: '#8BAFC0', fontWeight: '600', marginBottom: 3 }}>SAMPAI</Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: endDate ? '#1A3040' : '#B0CFE0' }}>
                {formatSelected(endDate)}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Hint */}
          <Text style={{ fontSize: 11, color: '#8BAFC0', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 2 }}>
            {selecting === 'start' ? 'Ketuk tanggal mulai' : 'Ketuk tanggal akhir'}
          </Text>

          {/* JAM SECTION */}
          <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#1A3040', marginBottom: 10 }}>
              Rentang Jam
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {/* Dari Jam */}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, color: '#8BAFC0', fontWeight: '600', marginBottom: 4 }}>DARI JAM</Text>
                <TextInput
                  value={String(startHour).padStart(2, '0') + ':00'}
                  keyboardType="numeric"
                  maxLength={5}
                  placeholder="00:00"
                  placeholderTextColor="#B0CFE0"
                  onChangeText={(v) => {
                    const num = parseInt(v.replace(/\D/g, ''), 10);
                    if (!isNaN(num) && num >= 0 && num <= 23) setStartHour(num);
                  }}
                  style={{
                    borderWidth: 1.5, borderColor: '#D1E8F5', borderRadius: 10,
                    padding: 10, fontSize: 15, fontWeight: '700', color: '#1A3040',
                    backgroundColor: '#F9FAFB', textAlign: 'center',
                  }}
                />
              </View>

              <Ionicons name="arrow-forward" size={16} color="#B0CFE0" style={{ marginTop: 16 }} />

              {/* Sampai Jam */}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, color: '#8BAFC0', fontWeight: '600', marginBottom: 4 }}>SAMPAI JAM</Text>
                <TextInput
                  value={String(endHour).padStart(2, '0') + ':59'}
                  keyboardType="numeric"
                  maxLength={5}
                  placeholder="23:59"
                  placeholderTextColor="#B0CFE0"
                  onChangeText={(v) => {
                    const num = parseInt(v.replace(/\D/g, ''), 10);
                    if (!isNaN(num) && num >= 0 && num <= 23) setEndHour(num);
                  }}
                  style={{
                    borderWidth: 1.5, borderColor: '#D1E8F5', borderRadius: 10,
                    padding: 10, fontSize: 15, fontWeight: '700', color: '#1A3040',
                    backgroundColor: '#F9FAFB', textAlign: 'center',
                  }}
                />
              </View>
            </View>

            {startHour === 0 && endHour === 23 && (
              <Text style={{ fontSize: 10, color: '#B0CFE0', marginTop: 6 }}>
                Default: semua jam (00:00 - 23:59)
              </Text>
            )}
          </View>

          {/* Navigasi bulan */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}>
            <TouchableOpacity
              onPress={prevMonth}
              style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: '#EAF4FB', justifyContent: 'center', alignItems: 'center' }}
            >
              <Ionicons name="chevron-back" size={18} color="#5AA3C8" />
            </TouchableOpacity>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#1A3040' }}>
              {MONTHS_ID[viewMonth]} {viewYear}
            </Text>
            <TouchableOpacity
              onPress={nextMonth}
              style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: '#EAF4FB', justifyContent: 'center', alignItems: 'center' }}
            >
              <Ionicons name="chevron-forward" size={18} color="#5AA3C8" />
            </TouchableOpacity>
          </View>

          {/* Header hari */}
          <View style={{ flexDirection: 'row', paddingHorizontal: 16, marginBottom: 6 }}>
            {DAYS_ID.map((d) => (
              <View key={d} style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: '#8BAFC0' }}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Grid kalender */}
          <View style={{ paddingHorizontal: 16 }}>
            {Array.from({ length: totalCells / 7 }).map((_, weekIdx) => (
              <View key={weekIdx} style={{ flexDirection: 'row', marginBottom: 4 }}>
                {Array.from({ length: 7 }).map((_, dayIdx) => {
                  const cellNum = weekIdx * 7 + dayIdx;
                  const day = cellNum - firstDay + 1;
                  const isValid = day >= 1 && day <= daysInMonth;
                  const hasData = isValid && hasDataOnDate(viewYear, viewMonth, day);
                  const inRange = isValid && isInRange(day);
                  const isS = isValid && isStart(day);
                  const isE = isValid && isEnd(day);
                  const isMarked = isS || isE;
                  return (
                    <TouchableOpacity
                      key={dayIdx}
                      onPress={() => isValid && handleSelectDay(day)}
                      activeOpacity={isValid ? 0.7 : 1}
                      style={{
                        flex: 1, height: 38, alignItems: 'center', justifyContent: 'center',
                        backgroundColor: isMarked ? '#7CB9D8' : inRange ? '#EAF4FB' : 'transparent',
                        borderRadius: isMarked ? 10 : inRange ? 0 : 10,
                        borderTopLeftRadius: isS ? 10 : inRange ? 0 : 10,
                        borderBottomLeftRadius: isS ? 10 : inRange ? 0 : 10,
                        borderTopRightRadius: isE ? 10 : inRange ? 0 : 10,
                        borderBottomRightRadius: isE ? 10 : inRange ? 0 : 10,
                      }}
                    >
                      {isValid ? (
                        <>
                          <Text style={{
                            fontSize: 13, fontWeight: isMarked ? '700' : '500',
                            color: isMarked ? '#fff' : inRange ? '#2A7DA0' : '#1A3040',
                          }}>
                            {day}
                          </Text>
                          {hasData && !isMarked && (
                            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#7CB9D8', position: 'absolute', bottom: 4 }} />
                          )}
                        </>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>

          {/* Tombol Apply */}
          <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            <TouchableOpacity
              onPress={handleApply}
              disabled={!startDate && !activeZone}
              activeOpacity={0.85}
              style={{
                backgroundColor: (startDate || activeZone) ? '#7CB9D8' : '#C5DDE8',
                borderRadius: 14, paddingVertical: 13, alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                {startDate && endDate
                  ? `Tampilkan ${formatSelected(startDate)} – ${formatSelected(endDate)}${activeZone ? ` · ${activeZone}` : ''}`
                  : startDate
                    ? `Tampilkan dari ${formatSelected(startDate)}${activeZone ? ` · ${activeZone}` : ''}`
                    : activeZone
                      ? `Tampilkan zona: ${activeZone}`
                      : 'Pilih filter dulu'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── HistoryModal ──────────────────────────────────────────
export default function HistoryModal({
  visible,
  onClose,
  data,
  measurementsList = [],
  allZones = [],
}) {
  const { title, color, history = [] } = data;

  const HEADER_COLORS = ['#2E7CA8', '#1A5E8A'];

  const [showFilter, setShowFilter] = useState(false);
  const [activeFilter, setActiveFilter] = useState({
    startDate: null,
    endDate: null,
    zone: null,
    startHour: 0,
    endHour: 23,
  });

  // ── Quick zone filter langsung dari header list (tanpa buka modal) ──
  const [quickZone, setQuickZone] = useState(null);
  const [displayHistory, setDisplayHistory] = useState(history);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);

  const statusConfig = {
    good: { bg: '#DCFCE7', color: '#166534', label: 'Normal' },
    warning: { bg: '#FEF3C7', color: '#92400E', label: 'Peringatan' },
    danger: { bg: '#FEE2E2', color: '#991B1B', label: 'Bahaya' },
  };

  const formatDate = (date) => {
    const d = toWibDate(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const timeStr = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === today.toDateString()) return `Hari ini, ${timeStr}`;
    if (d.toDateString() === yesterday.toDateString()) return `Kemarin, ${timeStr}`;
    return `${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}, ${timeStr}`;
  };

  const buildSensorQueryParams = useCallback(() => {
    const pad = (n) => String(n).padStart(2, '0');
    const params = { limit: 100 };
    const zone = activeFilter.zone || quickZone;

    if (zone) {
      params.zone = zone;
    }

    if (activeFilter.startDate) {
      const { startDate, endDate, startHour = 0, endHour = 23 } = activeFilter;
      params.start = `${startDate.year}-${pad(startDate.month + 1)}-${pad(startDate.day)} ${pad(startHour)}:00:00`;
      const ed = endDate || startDate;
      params.end = `${ed.year}-${pad(ed.month + 1)}-${pad(ed.day)} ${pad(endHour)}:59:59`;
    }

    return params;
  }, [activeFilter, quickZone]);

  const loadFilteredHistory = useCallback(async () => {
    const hasBackendFilter = !!activeFilter.startDate || !!activeFilter.zone || !!quickZone;

    if (!hasBackendFilter) {
      setDisplayHistory(history);
      setHistoryError(null);
      return;
    }

    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await getAllSensors(buildSensorQueryParams());
      setDisplayHistory(mapSensorsToHistory(res.data || [], data.id));
    } catch (err) {
      logError('HistoryModal.loadFilteredHistory', err);
      setHistoryError('Tidak dapat mengambil data filter dari backend.');
    } finally {
      setHistoryLoading(false);
    }
  }, [activeFilter, quickZone, history, data.id, buildSensorQueryParams]);

  useEffect(() => {
    loadFilteredHistory();
  }, [loadFilteredHistory]);

  // Semua zona unik dari history dan daftar lokasi device yang pernah di-set
  const zones = useMemo(() => {
    const fromHistory = history.map((h) => h.location).filter(Boolean);
    return [...new Set([...fromHistory, ...allZones])].sort();
  }, [history, allZones]);

  // Filter utama dari CalendarFilterModal
  const filteredByModal = useMemo(() => {
    const { startDate, endDate, zone, startHour = 0, endHour = 23 } = activeFilter;
    let result = displayHistory;

    if (startDate) {
      const start = new Date(startDate.year, startDate.month, startDate.day, startHour, 0, 0);
      const end = endDate
        ? new Date(endDate.year, endDate.month, endDate.day, endHour, 59, 59)
        : new Date(startDate.year, startDate.month, startDate.day, endHour, 59, 59);

      result = result.filter((entry) => {
        const raw = toWibDate(entry.timestamp);
        return raw >= start && raw <= end;
      });
    }

    if (zone) {
      result = result.filter((entry) => entry.location === zone);
    }

    return result;
  }, [displayHistory, activeFilter]);

  // Filter tambahan: quick zone pill di bawah header list
  const filteredHistory = useMemo(() => {
    if (!quickZone) return filteredByModal;
    return filteredByModal.filter((entry) => entry.location === quickZone);
  }, [filteredByModal, quickZone]);

  const getTrend = (index) => {
    if (index === filteredHistory.length - 1) return 'stable';
    const cur = parseFloat(filteredHistory[index].value);
    const prv = parseFloat(filteredHistory[index + 1].value);
    if (cur > prv) return 'up';
    if (cur < prv) return 'down';
    return 'stable';
  };

  const trendMeta = {
    up: { icon: 'trending-up', color: '#16A34A', label: 'Naik' },
    down: { icon: 'trending-down', color: '#DC2626', label: 'Turun' },
    stable: { icon: 'remove', color: '#8BAFC0', label: 'Stabil' },
  };

  const isFiltered = !!activeFilter.startDate || !!activeFilter.zone;

  const filterLabel = () => {
    const { startDate, endDate, zone, startHour = 0, endHour = 23 } = activeFilter;
    const parts = [];

    if (startDate) {
      const s = `${startDate.day} ${MONTHS_SHORT[startDate.month]} ${startDate.year}`;
      const e = endDate
        ? ` - ${endDate.day} ${MONTHS_SHORT[endDate.month]} ${endDate.year}`
        : '';
      const timeStr = (startHour !== 0 || endHour !== 23)
        ? ` - ${String(startHour).padStart(2, '0')}:00-${String(endHour).padStart(2, '0')}:59`
        : '';
      parts.push(s + e + timeStr);
    }

    if (zone) parts.push(zone);

    return parts.join(' · ') || null;
  };

  // ─── Build CSV string ───────────────────────────────────
  // ─── Export params ──────────────────────────────────────
  const isInSession = (timestamp) => {
    if (!measurementsList.length) return null;

    const t = toWibDate(timestamp);

    for (const session of measurementsList) {
      const start = toWibDate(session.start_time);
      const end = session.end_time ? toWibDate(session.end_time) : new Date();

      if (t >= start && t <= end) {
        return session;
      }
    }

    return false;
  };

  const buildCSVWithSession = (rows) => {
    const hasLocation = rows.some((r) => r.location);
    const hasSessions = measurementsList.length > 0;
    const escapeCsv = (val) => {
      const s = String(val ?? '');
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const cols = [
      'No',
      'Timestamp',
      hasLocation && 'Zona',
      'Value',
      'Unit',
      'Status',
      hasSessions && 'Sesi',
      hasSessions && 'ID Sesi',
    ].filter(Boolean);

    const header = cols.map(escapeCsv).join(',') + '\n';
    const body = rows.map((entry, i) => {
      const d = toWibDate(entry.timestamp);
      const pad = (n) => String(n).padStart(2, '0');
      const ts = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      const statusMap = { good: 'Normal', warning: 'Peringatan', danger: 'Bahaya' };
      const statusLabel = statusMap[entry.status] || entry.status || 'Normal';
      const session = hasSessions ? isInSession(entry.timestamp) : null;
      const sessionLabel = session === null
        ? ''
        : session
          ? `Ya - ${session.location || `Sesi #${session.id}`}`
          : '-';
      const sessionId = session ? String(session.id) : '-';

      const values = [
        String(i + 1),
        ts,
        hasLocation && (entry.location ?? ''),
        String(entry.value),
        entry.unit,
        statusLabel,
        hasSessions && sessionLabel,
        hasSessions && sessionId,
      ].filter((v) => v !== false);

      return values.map(escapeCsv).join(',');
    }).join('\n');

    return header + body;
  };

  const buildExportFileName = () => {
    const safeName = title.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const dateStr = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}`;
    const zoneStr = (activeFilter.zone || quickZone || 'semua')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .toLowerCase();

    return `uniflow_${safeName}_${dateStr}_${zoneStr}.csv`;
  };

  const buildBackendExportParams = () => {
    const pad = (n) => String(n).padStart(2, '0');
    const params = {};

    if (activeFilter.zone || quickZone) {
      params.zone = activeFilter.zone || quickZone;
    }

    if (activeFilter.startDate) {
      const { startDate, endDate, startHour = 0, endHour = 23 } = activeFilter;
      params.start = `${startDate.year}-${pad(startDate.month + 1)}-${pad(startDate.day)} ${pad(startHour)}:00:00`;
      const ed = endDate || startDate;
      params.end = `${ed.year}-${pad(ed.month + 1)}-${pad(ed.day)} ${pad(endHour)}:59:59`;
    }

    return params;
  };

  const fetchBackendCSV = async () => {
    const url = exportSensorCSV(buildBackendExportParams());
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const csvContent = await response.text();
    if (!csvContent || csvContent.trim().length === 0) {
      Alert.alert('Tidak Ada Data', 'Backend tidak mengembalikan data untuk filter ini.');
      return null;
    }

    return csvContent;
  };

  // ─── Export CSV ─────────────────────────────────────────
  const handleExport = async () => {
    try {
      const fileName = buildExportFileName();
      const csvContent = await fetchBackendCSV();
      if (!csvContent) return;

      const fileUri = FileSystem.documentDirectory + fileName;
      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: `Export ${title}`,
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        await Share.share({ message: csvContent, title: fileName });
      }
    } catch (err) {
      logError('HistoryModal.export', err);
      Alert.alert('Export Gagal', `Tidak dapat mengekspor data.\n${err.message}`);
    }
  };

  const handleExportWeb = async () => {
    try {
      const fileName = buildExportFileName();
      const csvContent = await fetchBackendCSV();
      if (!csvContent) return;

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      logError('HistoryModal.exportWeb', err);
      Alert.alert('Export Gagal', 'Tidak dapat mengekspor data.');
    }
  };
  // Reset quick zone ketika filter modal berubah
  const handleApplyFilter = (filter) => {
    setActiveFilter(filter);
    setQuickZone(null);
  };

  const clearAllFilters = () => {
    setActiveFilter({ startDate: null, endDate: null, zone: null, startHour: 0, endHour: 23 });
    setQuickZone(null);
  };

  const showingZoneLabel = quickZone || activeFilter.zone;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>

        {/* ── Header ── */}
        <LinearGradient
          colors={HEADER_COLORS}
          style={styles.header}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.headerContent}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.headerTitle}>Riwayat {title}</Text>
              <Text style={styles.headerSubtitle}>
                {filteredHistory.length} data
                {(isFiltered || quickZone)
                  ? ` · ${[filterLabel(), quickZone].filter(Boolean).join(' · ')}`
                  : ' · 3 bulan terakhir'}
              </Text>
              {filteredHistory.length > 1 && (
                <View style={{ marginTop: 8, opacity: 0.85 }}>
                  <Sparkline
                    data={[...filteredHistory].reverse().slice(0, 24)}
                    color="rgba(255,255,255,0.9)"
                    width={160}
                    height={32}
                  />
                </View>
              )}
            </View>

            <View style={styles.headerBtns}>
              <TouchableOpacity
                onPress={() => setShowFilter(true)}
                style={[
                  styles.headerBtn,
                  isFiltered && { backgroundColor: 'rgba(255,255,255,0.35)' },
                ]}
              >
                <Ionicons
                  name={isFiltered ? 'funnel' : 'funnel-outline'}
                  size={17}
                  color="#fff"
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={Platform.OS === 'web' ? handleExportWeb : handleExport}
                style={styles.headerBtn}>
                <Ionicons name="download-outline" size={18} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
                <Ionicons name="close" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Active filter chips */}
          {(isFiltered || quickZone) && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, gap: 6 }}>
              {isFiltered && (
                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: 5,
                  backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 20,
                  paddingHorizontal: 10, paddingVertical: 4,
                }}>
                  <Ionicons name="calendar" size={11} color="#fff" />
                  <Text style={{ fontSize: 11, color: '#fff', fontWeight: '600' }}>{filterLabel()}</Text>
                  <TouchableOpacity onPress={() => setActiveFilter({ startDate: null, endDate: null, zone: null, startHour: 0, endHour: 23 })}>
                    <Ionicons name="close-circle" size={13} color="rgba(255,255,255,0.8)" />
                  </TouchableOpacity>
                </View>
              )}
              {quickZone && (
                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: 5,
                  backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 20,
                  paddingHorizontal: 10, paddingVertical: 4,
                }}>
                  <Ionicons name="location" size={11} color="#fff" />
                  <Text style={{ fontSize: 11, color: '#fff', fontWeight: '600' }}>{quickZone}</Text>
                  <TouchableOpacity onPress={() => setQuickZone(null)}>
                    <Ionicons name="close-circle" size={13} color="rgba(255,255,255,0.8)" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </LinearGradient>

        {/* ── Quick Zone Filter Pills (tampil di bawah header jika multi-zona) ── */}
        {zones.length > 1 && (
          <View style={{
            backgroundColor: '#F0F9FF',
            borderBottomWidth: 1, borderBottomColor: '#EAF4FB',
            paddingVertical: 10, paddingHorizontal: 16,
          }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <Ionicons name="location-outline" size={13} color="#8BAFC0" style={{ marginRight: 2 }} />
                {/* Pill "Semua" */}
                <TouchableOpacity
                  onPress={() => setQuickZone(null)}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 5,
                    borderRadius: 16, borderWidth: 1.5,
                    borderColor: quickZone === null ? '#7CB9D8' : '#D1E8F5',
                    backgroundColor: quickZone === null ? '#7CB9D8' : '#fff',
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: quickZone === null ? '#fff' : '#8BAFC0' }}>
                    Semua
                  </Text>
                </TouchableOpacity>

                {zones.map((z) => (
                  <TouchableOpacity
                    key={z}
                    onPress={() => setQuickZone(quickZone === z ? null : z)}
                    style={{
                      paddingHorizontal: 12, paddingVertical: 5,
                      borderRadius: 16, borderWidth: 1.5,
                      borderColor: quickZone === z ? '#5AA3C8' : '#D1E8F5',
                      backgroundColor: quickZone === z ? '#EFF8FF' : '#fff',
                      flexDirection: 'row', alignItems: 'center', gap: 4,
                    }}
                  >
                    <Ionicons name="location-outline" size={11} color={quickZone === z ? '#2A7DA0' : '#8BAFC0'} />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: quickZone === z ? '#2A7DA0' : '#8BAFC0' }}>
                      {z}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* ── List ── */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: historyError ? '#FEF2F2' : '#F8FBFF',
          borderBottomWidth: 1,
          borderBottomColor: historyError ? '#FECACA' : '#EAF4FB',
          paddingHorizontal: 16,
          paddingVertical: 10,
        }}>
          {historyLoading ? (
            <ActivityIndicator size="small" color="#5AA3C8" />
          ) : historyError ? (
            <Ionicons name="warning-outline" size={15} color="#DC2626" />
          ) : (
            <Ionicons name="information-circle-outline" size={15} color="#5AA3C8" />
          )}
          <Text style={{ flex: 1, fontSize: 11, lineHeight: 16, color: historyError ? '#991B1B' : '#5F7F91' }}>
            {historyLoading
              ? 'Memuat 100 data terakhir sesuai filter...'
              : historyError || 'Menampilkan maksimal 100 data terakhir sesuai filter. Download CSV untuk mengambil seluruh data.'}
          </Text>
          {historyError && (
            <TouchableOpacity onPress={loadFilteredHistory}>
              <Text style={{ fontSize: 11, color: '#DC2626', fontWeight: '700' }}>Coba lagi</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.listWrap}>
            {filteredHistory.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Ionicons
                  name={(isFiltered || quickZone) ? 'search-outline' : 'time-outline'}
                  size={36}
                  color="#C5DDE8"
                />
                <Text style={styles.emptyText}>
                  {(isFiltered || quickZone) ? 'Tidak ada data untuk filter ini' : 'Belum ada data riwayat'}
                </Text>
                {(isFiltered || quickZone) && (
                  <TouchableOpacity onPress={clearAllFilters} style={{ marginTop: 8 }}>
                    <Text style={{ fontSize: 12, color: '#7CB9D8', fontWeight: '600' }}>Hapus semua filter</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              filteredHistory.map((entry, index) => {
                const trend = getTrend(index);
                const tmeta = trendMeta[trend];
                const config = statusConfig[entry.status] || statusConfig.good;

                return (
                  <View key={index} style={styles.card}>
                    <View style={styles.cardTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardDate}>{formatDate(entry.timestamp)}</Text>
                        {/* Tampilkan zona jika ada dan tidak sedang difilter ke 1 zona */}
                        {entry.location && !showingZoneLabel && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 }}>
                            <Ionicons name="location-outline" size={11} color="#8BAFC0" />
                            <Text style={{ fontSize: 11, color: '#8BAFC0', fontWeight: '500' }}>
                              {entry.location}
                            </Text>
                          </View>
                        )}
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
                        <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
                      </View>
                    </View>
                    <View style={styles.cardBody}>
                      <View style={styles.valueRow}>
                        <Text style={styles.value}>{entry.value}</Text>
                        <Text style={styles.unit}>{entry.unit}</Text>
                      </View>
                      <View style={[styles.trendPill, { backgroundColor: tmeta.color + '18' }]}>
                        <Ionicons name={tmeta.icon} size={13} color={tmeta.color} />
                        <Text style={[styles.trendText, { color: tmeta.color }]}>{tmeta.label}</Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      </View>

      {/* Calendar Filter Modal */}
      <CalendarFilterModal
        visible={showFilter}
        onClose={() => setShowFilter(false)}
        onApply={handleApplyFilter}
        history={history}
        zones={zones}
      />
    </Modal>
  );
}

