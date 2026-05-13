import React, { useState, useMemo } from 'react';
import {
  Modal, View, Text, ScrollView, TouchableOpacity,
  Share, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { historyModalStyles as styles } from '../styles/historyModalStyles';
import { getSensorCSVUrl } from '../services/api';
import { logError } from '../utils/errorHandler';

// ─── Konstanta ─────────────────────────────────────────────
const MONTHS_ID = [
  'Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember',
];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const DAYS_ID = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];

// ─── Helpers kalender ──────────────────────────────────────
const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

// ─── Calendar Filter Modal ─────────────────────────────────
function CalendarFilterModal({ visible, onClose, onApply, history }) {
  const now = new Date();

  // Cari tahun & bulan yang ada datanya
  const dataDateSet = useMemo(() => {
    const set = new Set();
    history.forEach((h) => {
      const d = new Date(h.timestamp);
      set.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    });
    return set;
  }, [history]);

  const hasDataOnDate = (year, month, day) =>
    dataDateSet.has(`${year}-${month}-${day}`);

  // State kalender
  const [viewYear,  setViewYear]  = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [startDate, setStartDate] = useState(null); // { year, month, day }
  const [endDate,   setEndDate]   = useState(null);
  const [selecting, setSelecting] = useState('start'); // 'start' | 'end'

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
        // Kalau end < start, swap
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
    startDate &&
    startDate.year === viewYear &&
    startDate.month === viewMonth &&
    startDate.day === day;

  const isEnd = (day) =>
    endDate &&
    endDate.year === viewYear &&
    endDate.month === viewMonth &&
    endDate.day === day;

  const handleReset = () => {
    setStartDate(null);
    setEndDate(null);
    setSelecting('start');
  };

  const handleApply = () => {
    onApply({ startDate, endDate });
    onClose();
  };

  const daysInMonth   = getDaysInMonth(viewYear, viewMonth);
  const firstDay      = getFirstDayOfMonth(viewYear, viewMonth);
  const totalCells    = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  const formatSelected = (d) => {
    if (!d) return '--';
    return `${d.day} ${MONTHS_SHORT[d.month]} ${d.year}`;
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <View style={{
          backgroundColor: '#fff',
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          paddingBottom: 32,
        }}>
          {/* Header modal */}
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

          {/* Pilih range indicator */}
          <View style={{
            flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4,
          }}>
            {/* Start */}
            <TouchableOpacity
              onPress={() => setSelecting('start')}
              style={{
                flex: 1, borderRadius: 12, padding: 10,
                borderWidth: 1.5,
                borderColor: selecting === 'start' ? '#7CB9D8' : '#D1E8F5',
                backgroundColor: selecting === 'start' ? '#EFF8FF' : '#F9FAFB',
              }}
            >
              <Text style={{ fontSize: 10, color: '#8BAFC0', fontWeight: '600', marginBottom: 3 }}>
                DARI
              </Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: startDate ? '#1A3040' : '#B0CFE0' }}>
                {formatSelected(startDate)}
              </Text>
            </TouchableOpacity>

            <View style={{ justifyContent: 'center' }}>
              <Ionicons name="arrow-forward" size={16} color="#B0CFE0" />
            </View>

            {/* End */}
            <TouchableOpacity
              onPress={() => setSelecting('end')}
              style={{
                flex: 1, borderRadius: 12, padding: 10,
                borderWidth: 1.5,
                borderColor: selecting === 'end' ? '#7CB9D8' : '#D1E8F5',
                backgroundColor: selecting === 'end' ? '#EFF8FF' : '#F9FAFB',
              }}
            >
              <Text style={{ fontSize: 10, color: '#8BAFC0', fontWeight: '600', marginBottom: 3 }}>
                SAMPAI
              </Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: endDate ? '#1A3040' : '#B0CFE0' }}>
                {formatSelected(endDate)}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Hint */}
          <Text style={{ fontSize: 11, color: '#8BAFC0', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 2 }}>
            {selecting === 'start' ? 'Ketuk tanggal mulai' : 'Ketuk tanggal akhir'}
          </Text>

          {/* Navigasi bulan */}
          <View style={{
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            paddingHorizontal: 16, paddingVertical: 12,
          }}>
            <TouchableOpacity
              onPress={prevMonth}
              style={{
                width: 34, height: 34, borderRadius: 10,
                backgroundColor: '#EAF4FB', justifyContent: 'center', alignItems: 'center',
              }}
            >
              <Ionicons name="chevron-back" size={18} color="#5AA3C8" />
            </TouchableOpacity>

            <Text style={{ fontSize: 15, fontWeight: '700', color: '#1A3040' }}>
              {MONTHS_ID[viewMonth]} {viewYear}
            </Text>

            <TouchableOpacity
              onPress={nextMonth}
              style={{
                width: 34, height: 34, borderRadius: 10,
                backgroundColor: '#EAF4FB', justifyContent: 'center', alignItems: 'center',
              }}
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
                  const cellNum  = weekIdx * 7 + dayIdx;
                  const day      = cellNum - firstDay + 1;
                  const isValid  = day >= 1 && day <= daysInMonth;
                  const hasData  = isValid && hasDataOnDate(viewYear, viewMonth, day);
                  const inRange  = isValid && isInRange(day);
                  const isS      = isValid && isStart(day);
                  const isE      = isValid && isEnd(day);
                  const isMarked = isS || isE;

                  return (
                    <TouchableOpacity
                      key={dayIdx}
                      onPress={() => isValid && handleSelectDay(day)}
                      activeOpacity={isValid ? 0.7 : 1}
                      style={{
                        flex: 1, height: 38, alignItems: 'center', justifyContent: 'center',
                        backgroundColor: isMarked
                          ? '#7CB9D8'
                          : inRange
                            ? '#EAF4FB'
                            : 'transparent',
                        borderRadius: isMarked ? 10 : inRange ? 0 : 10,
                        borderTopLeftRadius:  isS ? 10 : inRange ? 0 : 10,
                        borderBottomLeftRadius: isS ? 10 : inRange ? 0 : 10,
                        borderTopRightRadius: isE ? 10 : inRange ? 0 : 10,
                        borderBottomRightRadius: isE ? 10 : inRange ? 0 : 10,
                      }}
                    >
                      {isValid ? (
                        <>
                          <Text style={{
                            fontSize: 13,
                            fontWeight: isMarked ? '700' : '500',
                            color: isMarked ? '#fff' : inRange ? '#2A7DA0' : '#1A3040',
                          }}>
                            {day}
                          </Text>
                          {/* Dot indikator ada data */}
                          {hasData && !isMarked && (
                            <View style={{
                              width: 4, height: 4, borderRadius: 2,
                              backgroundColor: '#7CB9D8',
                              position: 'absolute', bottom: 4,
                            }} />
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
              disabled={!startDate}
              activeOpacity={0.85}
              style={{
                backgroundColor: startDate ? '#7CB9D8' : '#C5DDE8',
                borderRadius: 14, paddingVertical: 13, alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                {startDate && endDate
                  ? `Tampilkan ${formatSelected(startDate)} – ${formatSelected(endDate)}`
                  : startDate
                    ? `Tampilkan dari ${formatSelected(startDate)}`
                    : 'Pilih tanggal dulu'}
              </Text>
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

  const HEADER_COLORS = ['#2E7CA8', '#1A5E8A'];

  const [showFilter,   setShowFilter]   = useState(false);
  const [activeFilter, setActiveFilter] = useState({ startDate: null, endDate: null });

  const statusConfig = {
    good:    { bg: '#DCFCE7', color: '#166534', label: 'Normal' },
    warning: { bg: '#FEF3C7', color: '#92400E', label: 'Peringatan' },
    danger:  { bg: '#FEE2E2', color: '#991B1B', label: 'Bahaya' },
  };

  const formatDate = (date) => {
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
    const { startDate, endDate } = activeFilter;
    if (!startDate) return history;

    const start = new Date(startDate.year, startDate.month, startDate.day, 0, 0, 0);
    const end   = endDate
      ? new Date(endDate.year, endDate.month, endDate.day, 23, 59, 59)
      : new Date(startDate.year, startDate.month, startDate.day, 23, 59, 59);

    return history.filter((entry) => {
      const d = entry.timestamp instanceof Date
        ? entry.timestamp
        : new Date(String(entry.timestamp).replace('Z', ''));
      return d >= start && d <= end;
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

  const isFiltered = !!activeFilter.startDate;

  const filterLabel = () => {
    const { startDate, endDate } = activeFilter;
    if (!startDate) return null;
    const s = `${startDate.day} ${MONTHS_SHORT[startDate.month]} ${startDate.year}`;
    if (!endDate) return s;
    const e = `${endDate.day} ${MONTHS_SHORT[endDate.month]} ${endDate.year}`;
    return `${s} – ${e}`;
  };

  const handleExport = async () => {
    const csvUrl = getSensorCSVUrl(90);
    try {
      if (await Linking.canOpenURL(csvUrl)) {
        await Linking.openURL(csvUrl);
      } else {
        await Share.share({ message: `Download CSV data sensor: ${csvUrl}`, title: `UniFlow - Riwayat ${title}` });
      }
    } catch (err) {
      logError('HistoryModal.export', err);
    }
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
                <TouchableOpacity onPress={() => setActiveFilter({ startDate: null, endDate: null })}>
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
                    onPress={() => setActiveFilter({ startDate: null, endDate: null })}
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

      {/* Calendar Filter Modal */}
      <CalendarFilterModal
        visible={showFilter}
        onClose={() => setShowFilter(false)}
        onApply={setActiveFilter}
        history={history}
      />
    </Modal>
  );
}