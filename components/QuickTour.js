import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Modal,
  Animated, Dimensions, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Defs, Rect, Mask } from 'react-native-svg';

const { width: SW, height: SH } = Dimensions.get('window');
const TOUR_KEY = 'uniflow_tour_done';
const PAD = 8;

const STEPS = [
  {
    id: 'welcome',
    title: 'Selamat datang di UniFlow!',
    desc: 'Aplikasi monitoring kualitas air real-time kampus Telkom University. Mari kenalan dulu.',
    refKey: null,
    icon: 'water',
    scrollY: 0,
  },
  {
    id: 'wqi',
    title: 'Skor WQI',
    desc: 'Water Quality Index, skor 0-100. Tap kartu atas untuk lihat riwayat kualitas air keseluruhan.',
    refKey: 'refWQI',
    icon: 'analytics',
    scrollY: 0,
  },
  {
    id: 'average',
    title: 'Rata-rata Sensor',
    desc: 'Ringkasan average menampilkan rata-rata pH, suhu, TDS, dan kekeruhan dari data terbaru.',
    refKey: 'refStats',
    icon: 'stats-chart',
    scrollY: 0,
  },
  {
    id: 'params',
    title: 'Parameter Air',
    desc: 'Tap kartu untuk lihat riwayat historis dan export CSV. Dot kanan atas menunjukkan koneksi device.',
    refKey: 'refParams',
    icon: 'grid',
    scrollY: 120,
  },
  {
    id: 'start',
    title: 'Start / Stop Sesi',
    desc: 'Mulai sesi pengukuran sebelum ambil sampel. Data otomatis di-tag dengan lokasi sesi.',
    refKey: 'refStartBtn',
    icon: 'play-circle',
    scrollY: 320,
  },
  {
    id: 'notif',
    title: 'Notifikasi Alert',
    desc: 'Bell menyala jika parameter melewati ambang batas Permenkes No. 32/2017.',
    refKey: 'refNotifBtn',
    icon: 'notifications',
    scrollY: 0,
  },
  {
    id: 'settings',
    title: 'Pengaturan',
    desc: 'Atur threshold, kelola device sensor, konfigurasi WiFi ESP32, dan ulangi tour ini.',
    refKey: 'refSettingBtn',
    icon: 'settings',
    scrollY: 0,
  },
  {
    id: 'ai',
    title: 'AI Assistant',
    desc: 'Buka AI Assistant untuk melihat history chat, membuat sesi baru, dan mengirim pertanyaan tentang data kualitas air.',
    refKey: 'refAI',
    icon: 'chatbubble-ellipses',
    scrollY: 0,
  },
  {
    id: 'done',
    title: 'Siap digunakan!',
    desc: 'Tour bisa diulang kapan saja dari Pengaturan > Panduan Aplikasi.',
    refKey: null,
    icon: 'checkmark-circle',
    scrollY: 0,
  },
];

const Spotlight = ({ highlight, blinkAnim }) => {
  if (!highlight) {
    return (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.72)' }]} />
    );
  }

  const { top, left, width, height } = highlight;
  const r = 16;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={SW} height={SH}>
        <Defs>
          <Mask id="mask">
            <Rect x="0" y="0" width={SW} height={SH} fill="white" />
            <Rect
              x={left - PAD}
              y={top - PAD}
              width={width + PAD * 2}
              height={height + PAD * 2}
              rx={r}
              ry={r}
              fill="black"
            />
          </Mask>
        </Defs>
        <Rect
          x="0"
          y="0"
          width={SW}
          height={SH}
          fill="rgba(0,0,0,0.75)"
          mask="url(#mask)"
        />
      </Svg>

      <Animated.View style={{
        position: 'absolute',
        top: top - PAD,
        left: left - PAD,
        width: width + PAD * 2,
        height: height + PAD * 2,
        borderRadius: r,
        borderWidth: 2,
        borderColor: 'rgba(124,185,216,0.95)',
        opacity: blinkAnim,
      }} />
    </View>
  );
};

export default function QuickTour({ visible, onDone, refs = {}, scrollRef, onNavigateToAI }) {
  const [step, setStep] = useState(0);
  const [highlight, setHighlight] = useState(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const blinkAnim = useRef(new Animated.Value(1)).current;

  const current = STEPS[step];

  const measureStep = useCallback((refKey) => {
    if (!refKey || !refs[refKey]?.current) {
      setHighlight(null);
      return;
    }

    refs[refKey].current.measure((_x, _y, width, height, pageX, pageY) => {
      setHighlight({ top: pageY, left: pageX, width, height });
    });
  }, [refs]);

  useEffect(() => {
    if (!visible) return undefined;

    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true,
    }).start();

    if (scrollRef?.current) {
      scrollRef.current.scrollTo({ y: current.scrollY ?? 0, animated: true });
    }

    const t = setTimeout(() => measureStep(current.refKey), 450);
    return () => clearTimeout(t);
  }, [step, visible, current.refKey, current.scrollY, fadeAnim, measureStep, scrollRef]);

  useEffect(() => {
    if (!highlight) return undefined;

    blinkAnim.setValue(1);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, { toValue: 0.35, duration: 420, useNativeDriver: true }),
        Animated.timing(blinkAnim, { toValue: 1, duration: 420, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [highlight, blinkAnim]);

  const finish = async () => {
    await AsyncStorage.setItem(TOUR_KEY, 'true');
    setStep(0);
    setHighlight(null);
    onDone?.();
  };

  const goNext = async () => {
    if (current.id === 'ai' && onNavigateToAI) {
      await finish();
      onNavigateToAI();
      return;
    }

    if (step < STEPS.length - 1) setStep((s) => s + 1);
    else finish();
  };

  const goBack = () => setStep((s) => Math.max(0, s - 1));

  const getTooltipTop = () => {
    if (!highlight) return SH / 2 - 130;
    const below = highlight.top + highlight.height + PAD + 16;
    const tooltipH = 220;
    if (below + tooltipH < SH - 40) return below;
    return Math.max(24, highlight.top - PAD - tooltipH - 16);
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent>
      <Spotlight highlight={highlight} blinkAnim={blinkAnim} />

      <Animated.View style={{
        position: 'absolute',
        top: getTooltipTop(),
        left: 20,
        right: 20,
        opacity: fadeAnim,
      }}>
        <View style={{
          backgroundColor: '#fff', borderRadius: 20, padding: 20,
          shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.18, shadowRadius: 20, elevation: 14,
        }}>
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
          }}>
            <View style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: '#EFF8FF',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Ionicons name={current.icon} size={19} color="#5AA3C8" />
            </View>
            <Text style={{ fontSize: 11, color: '#8BAFC0', fontWeight: '600' }}>
              {step + 1} / {STEPS.length}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 4, marginBottom: 12 }}>
            {STEPS.map((tourStep, i) => (
              <View key={tourStep.id} style={{
                height: 3,
                borderRadius: 2,
                flex: i === step ? 2 : 1,
                backgroundColor: i <= step ? '#7CB9D8' : '#E2EEF5',
              }} />
            ))}
          </View>

          <Text style={{ fontSize: 15, fontWeight: '800', color: '#1A3040', marginBottom: 6 }}>
            {current.title}
          </Text>
          <Text style={{ fontSize: 13, color: '#6B7280', lineHeight: 20, marginBottom: 18 }}>
            {current.desc}
          </Text>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            {step === 0 ? (
              <TouchableOpacity
                onPress={finish}
                style={{
                  flex: 1,
                  borderWidth: 1.5,
                  borderColor: '#D1E8F5',
                  borderRadius: 11,
                  paddingVertical: 10,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#8BAFC0', fontWeight: '600', fontSize: 13 }}>Lewati</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={goBack}
                style={{
                  width: 42,
                  borderWidth: 1.5,
                  borderColor: '#D1E8F5',
                  borderRadius: 11,
                  paddingVertical: 10,
                  alignItems: 'center',
                }}
              >
                <Ionicons name="chevron-back" size={17} color="#8BAFC0" />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={goNext}
              style={{
                flex: 1,
                borderRadius: 11,
                paddingVertical: 10,
                backgroundColor: step === STEPS.length - 1 ? '#22C55E' : '#5AA3C8',
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                {current.id === 'ai' ? 'Buka AI' : step === STEPS.length - 1 ? 'Mulai Pakai' : 'Lanjut'}
              </Text>
              <Ionicons
                name={current.id === 'ai' ? 'open-outline' : step === STEPS.length - 1 ? 'checkmark' : 'chevron-forward'}
                size={15}
                color="#fff"
              />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

export const useShouldShowTour = () => {
  const [should, setShould] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(TOUR_KEY).then((val) => {
      setShould(val !== 'true');
      setChecked(true);
    });
  }, []);

  const resetTour = async () => {
    await AsyncStorage.removeItem(TOUR_KEY);
    setShould(true);
  };

  return { shouldShowTour: should, tourChecked: checked, resetTour };
};
