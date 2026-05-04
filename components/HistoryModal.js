import React, { useState, useMemo } from 'react';
import {
  Modal, View, Text, ScrollView, TouchableOpacity,
  Share, Linking, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { historyModalStyles as styles } from '../styles/historyModalStyles';
import { getSensorCSVUrl } from '../services/api';

// ─── Date Filter Picker ────────────────────────────────────
const MONTHS_ID = [
  'Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember',
];

function DateFilterModal({ visible, onClose, onApply, history }) {
  const now = new Date();

  const availableYears = useMemo(() => {
    const years = [...new Set(history.map((h) => new Date(h.timestamp).getFullYear()))].sort((a, b) => b - a);
    return years.length ? years : [now.getFullYear()];
  }, [history]);

  const [selYear,  setSelYear]  = useState(null);
  const [selMonth, setSelMonth] = useState(null);
  const [selDay,   setSelDay]   = useState(null);

  const availableMonths = useMemo(() => {
    if (!selYear) return [];
    const months = [...new Set(
      history
        .filter((h) => new Date(h.timestamp).getFullYear() === selYear)
        .map((h) => new Date(h.timestamp).getMonth())
    )].sort((a, b) => a - b);
    return months;
  }, [selYear, history]);

  const availableDays = useMemo(() => {
    if (selYear == null || selMonth == null) return [];
    const days = [...new Set(
      history
        .filter((h) => {
          const d = new Date(h.timestamp);
          return d.getFullYear() === selYear && d.getMonth() === selMonth;
        })
        .map((h) => new Date(h.timestamp).getDate())
    )].sort((a, b) => a - b);
    return days;
  }, [selYear, selMonth, history]);

  const handleReset = () => { setSelYear(null); setSelMonth(null); setSelDay(null); };
  const handleApply = () => { onApply({ year: selYear, month: selMonth, day: selDay }); onClose(); };

  const pill = (label, active, onPress, disabled = false) => (
    <TouchableOpacity
      key={label}
      onPress={disabled ? undefined : onPress}
      activeOpacity={disabled ? 1 : 0.7}
      style={{
        paddingHorizontal: 14, paddingVertical: 7,
        borderRadius: 20, marginRight: 8, marginBottom: 8,
        backgroundColor: active ? '#7CB9D8' : '#EAF4FB',
        opacity: disabled ? 0.4 : 1,
        borderWidth: 1,
        borderColor: active ? '#5AA3C8' : '#C5DDE8',
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: '600', color: active ? '#fff' : '#4A8BAA' }}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 32 }}>
          {/* Header */}
          <View style={{
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            padding: 16, borderBottomWidth: 1, borderBottomColor: '#EAF4FB',
          }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#1A3040' }}>Filter Tanggal</Text>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <TouchableOpacity onPress={handleReset}>
                <Text style={{ fontSize: 12, color: '#8BAFC0', fontWeight: '600' }}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={22} color="#8BAFC0" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={{ paddingHorizontal: 16, paddingTop: 16 }}>
            {/* Tahun */}
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#8BAFC0', marginBottom: 8, letterSpacing: 0.5 }}>
              TAHUN
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
              {availableYears.map((y) =>
                pill(String(y), selYear === y, () => {
                  setSelYear(y);
                  setSelMonth(null);
                  setSelDay(null);
                })
              )}
            </View>

            {/* Bulan */}
            <Text style={{ fontSize: 11, fontWeight: '700', color: selYear ? '#8BAFC0' : '#C5DDE8', marginBottom: 8, letterSpacing: 0.5 }}>
              BULAN
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
              {selYear
                ? availableMonths.map((m) =>
                    pill(MONTHS_ID[m], selMonth === m, () => { setSelMonth(m); setSelDay(null); })
                  )
                : pill('Pilih tahun dulu', false, null, true)
              }
            </View>

            {/* Tanggal */}
            <Text style={{ fontSize: 11, fontWeight: '700', color: selMonth != null ? '#8BAFC0' : '#C5DDE8', marginBottom: 8, letterSpacing: 0.5 }}>
              TANGGAL
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 }}>
              {selMonth != null
                ? availableDays.map((d) => pill(String(d), selDay === d, () => setSelDay(d)))
                : pill('Pilih bulan dulu', false, null, true)
              }
            </View>
          </ScrollView>

          {/* Apply */}
          <View style={{ paddingHorizontal: 16 }}>
            <TouchableOpacity
              onPress={handleApply}
              style={{ backgroundColor: '#7CB9D8', borderRadius: 14, paddingVertical: 13, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Terapkan Filter</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── HistoryModal ──────────────────────────────────────────
export default function HistoryModal({ visible, onClose, data }) {
  const { title, color, history = [] } = data;

  // ── Selalu pakai warna gelap-biru untuk header agar icon terlihat ──
  // Gradient dari data bisa terlalu terang (biru muda), jadi kita
  // paksa header pakai warna yang cukup gelap + kontras
  const rawColors  = Array.isArray(color) ? color : [color, color];
  // Darken: overlay gradient gelap di atas warna asli via warna header solid
  const HEADER_COLORS = ['#2E7CA8', '#1A5E8A']; // biru tua — selalu kontras

  const [showFilter,   setShowFilter]   = useState(false);
  const [activeFilter, setActiveFilter] = useState({ year: null, month: null, day: null });

  const statusConfig = {
    good:    { bg: '#DCFCE7', color: '#166534', label: 'Normal' },
    warning: { bg: '#FEF3C7', color: '#92400E', label: 'Peringatan' },
    danger:  { bg: '#FEE2E2', color: '#991B1B', label: 'Bahaya' },
  };

  const formatDate = (date) => {
    // Strip 'Z' agar tidak di-offset +7 jam oleh browser/RN
    let d;
    if (typeof date === 'string') {
      d = new Date(date.replace('Z', ''));
    } else if (date instanceof Date) {
      d = date;
    } else {
      d = new Date(date);
    }
    const today     = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const timeStr = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === today.toDateString())     return `Hari ini, ${timeStr}`;
    if (d.toDateString() === yesterday.toDateString()) return `Kemarin, ${timeStr}`;
    return `${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}, ${timeStr}`;
  };

  const filteredHistory = useMemo(() => {
    const { year, month, day } = activeFilter;
    if (!year) return history;
    return history.filter((entry) => {
      const d = new Date(entry.timestamp);
      if (d.getFullYear() !== year) return false;
      if (month != null && d.getMonth() !== month) return false;
      if (day   != null && d.getDate()  !== day)   return false;
      return true;
    });
  }, [history, activeFilter]);

  const getTrend = (index) => {
    if (index === filteredHistory.length - 1) return 'stable';
    const cur = parseFloat(filteredHistory[index].value);
    const prv = parseFloat(filteredHistory[index + 1].value);
    if (cur > prv) return 'up';
    if (cur < prv) return 'down';
    return 'stable';
  };

  const trendMeta = {
    up:     { icon: 'trending-up',   color: '#16A34A', label: 'Naik'   },
    down:   { icon: 'trending-down', color: '#DC2626', label: 'Turun'  },
    stable: { icon: 'remove',        color: '#8BAFC0', label: 'Stabil' },
  };

  const isFiltered = activeFilter.year != null;

  const filterLabel = () => {
    const { year, month, day } = activeFilter;
    if (!year) return null;
    const parts = [String(year)];
    if (month != null) parts.push(MONTHS_ID[month]);
    if (day   != null) parts.push(String(day));
    return parts.join(', ');
  };

  const handleExport = async () => {
    const csvUrl = getSensorCSVUrl(90);
    try {
      if (await Linking.canOpenURL(csvUrl)) {
        await Linking.openURL(csvUrl);
      } else {
        await Share.share({ message: `Download CSV data sensor: ${csvUrl}`, title: `UniFlow - Riwayat ${title}` });
      }
    } catch (err) { console.error('Export error:', err); }
  };

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
                {filteredHistory.length} data{isFiltered ? ` · ${filterLabel()}` : ' · 3 bulan terakhir'}
              </Text>
            </View>

            {/* Tombol aksi — background solid agar selalu terlihat */}
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

              <TouchableOpacity onPress={handleExport} style={styles.headerBtn}>
                <Ionicons name="download-outline" size={18} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
                <Ionicons name="close" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Active filter chip */}
          {isFiltered && (
            <View style={{ flexDirection: 'row', marginTop: 10 }}>
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 5,
                backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 20,
                paddingHorizontal: 10, paddingVertical: 4,
              }}>
                <Ionicons name="calendar" size={11} color="#fff" />
                <Text style={{ fontSize: 11, color: '#fff', fontWeight: '600' }}>{filterLabel()}</Text>
                <TouchableOpacity onPress={() => setActiveFilter({ year: null, month: null, day: null })}>
                  <Ionicons name="close-circle" size={13} color="rgba(255,255,255,0.8)" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </LinearGradient>

        {/* ── List ── */}
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.listWrap}>
            {filteredHistory.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Ionicons
                  name={isFiltered ? 'search-outline' : 'time-outline'}
                  size={36}
                  color="#C5DDE8"
                />
                <Text style={styles.emptyText}>
                  {isFiltered ? 'Tidak ada data untuk filter ini' : 'Belum ada data riwayat'}
                </Text>
                {isFiltered && (
                  <TouchableOpacity
                    onPress={() => setActiveFilter({ year: null, month: null, day: null })}
                    style={{ marginTop: 8 }}
                  >
                    <Text style={{ fontSize: 12, color: '#7CB9D8', fontWeight: '600' }}>Hapus filter</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : filteredHistory.map((entry, index) => {
              const trend  = getTrend(index);
              const tmeta  = trendMeta[trend];
              const config = statusConfig[entry.status] || statusConfig.good;
              return (
                <View key={index} style={styles.card}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardDate}>{formatDate(entry.timestamp)}</Text>
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
            })}
          </View>
        </ScrollView>

      </View>

      {/* Date Filter Modal */}
      <DateFilterModal
        visible={showFilter}
        onClose={() => setShowFilter(false)}
        onApply={setActiveFilter}
        history={history}
      />
    </Modal>
  );
}