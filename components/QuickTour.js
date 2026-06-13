import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Modal,
  Animated, InteractionManager, StyleSheet, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Defs, Rect, Mask } from 'react-native-svg';

const TOUR_KEY = 'uniflow_tour_done';
const PAD = 8;
const SCREEN_MARGIN = 16;
const TOOLTIP_MAX_W = 380;
const TOOLTIP_EST_H = 248;
const MEASURE_DELAYS = [80, 180, 320];

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
    id: 'start',
    title: 'Start / Stop Sesi',
    desc: 'Mulai sesi pengukuran sebelum ambil sampel. Data otomatis di-tag dengan lokasi sesi.',
    refKey: 'refStartBtn',
    icon: 'play-circle',
    scrollY: 0,
  },
  {
    id: 'params',
    title: 'Parameter Air',
    desc: 'Tap kartu untuk lihat riwayat historis dan export CSV. Dot kanan atas menunjukkan koneksi device.',
    refKey: 'refParams',
    icon: 'grid',
    scrollY: 180,
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

const clamp = (value, min, max) => {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
};

const Spotlight = ({ highlight, screenWidth, screenHeight }) => {
  if (!highlight) {
    return (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.72)' }]} />
    );
  }

  const { top, left, width: targetWidth, height: targetHeight } = highlight;
  const r = 16;
  const cutout = {
    x: Math.max(0, left - PAD),
    y: Math.max(0, top - PAD),
    width: Math.max(1, targetWidth + PAD * 2),
    height: Math.max(1, targetHeight + PAD * 2),
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <Mask id="mask">
            <Rect x="0" y="0" width={screenWidth} height={screenHeight} fill="white" />
            <Rect
              x={cutout.x}
              y={cutout.y}
              width={cutout.width}
              height={cutout.height}
              rx={r}
              ry={r}
              fill="black"
            />
          </Mask>
        </Defs>
        <Rect
          x="0"
          y="0"
          width={screenWidth}
          height={screenHeight}
          fill="rgba(0,0,0,0.75)"
          mask="url(#mask)"
        />
      </Svg>

      <Animated.View style={{
        position: 'absolute',
        top: cutout.y,
        left: cutout.x,
        width: cutout.width,
        height: cutout.height,
        borderRadius: r,
        borderWidth: 2,
        borderColor: 'rgba(124,185,216,0.95)',
        opacity: 1,
      }} />
    </View>
  );
};

export default function QuickTour({ visible, onDone, refs = {}, scrollRef }) {
  const window = useWindowDimensions();
  const [step, setStep] = useState(0);
  const [highlight, setHighlight] = useState(null);
  const [measuring, setMeasuring] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const measureRunId = useRef(0);

  const current = STEPS[step];
  const isCompact = window.width < 430 || window.height < 720;

  const measureStep = useCallback((refKey, runId = measureRunId.current, commit = true) => {
    if (!refKey || !refs[refKey]?.current) {
      setHighlight(null);
      setMeasuring(false);
      return;
    }

    const node = refs[refKey].current;
    const onMeasure = (left, top, width, height) => {
      if (runId !== measureRunId.current) return;

      if (!width || !height) {
        if (commit) {
          setHighlight(null);
          setMeasuring(false);
        }
        return;
      }
      const targetWidth = Math.min(width, window.width - SCREEN_MARGIN * 2);
      const targetHeight = Math.min(height, window.height - SCREEN_MARGIN * 2);

      if (!commit) return;

      setHighlight({
        top: clamp(top, SCREEN_MARGIN, window.height - targetHeight - SCREEN_MARGIN),
        left: clamp(left, SCREEN_MARGIN, window.width - targetWidth - SCREEN_MARGIN),
        width: targetWidth,
        height: targetHeight,
      });
      setMeasuring(false);
    };

    if (typeof node.measureInWindow === 'function') {
      node.measureInWindow((left, top, width, height) => onMeasure(left, top, width, height));
      return;
    }

    node.measure((_x, _y, width, height, pageX, pageY) => onMeasure(pageX, pageY, width, height));
  }, [refs, window.height, window.width]);

  useEffect(() => {
    if (!visible) return undefined;

    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true,
    }).start();
    return undefined;
  }, [visible, fadeAnim]);

  useEffect(() => {
    if (!visible) return undefined;

    measureRunId.current += 1;
    const runId = measureRunId.current;
    const timers = [];
    if (current.refKey) {
      setMeasuring(true);
      setHighlight(null);
    }
    const interaction = InteractionManager.runAfterInteractions(() => {
      if (runId !== measureRunId.current) return;

      if (scrollRef?.current) {
        scrollRef.current.scrollTo({ y: current.scrollY ?? 0, animated: false });
      }

      MEASURE_DELAYS.forEach((delay, index) => {
        const isLastMeasure = index === MEASURE_DELAYS.length - 1;
        const timer = setTimeout(() => measureStep(current.refKey, runId, isLastMeasure), delay);
        timers.push(timer);
      });
    });

    return () => {
      timers.forEach(clearTimeout);
      interaction?.cancel?.();
    };
  }, [step, visible, current.refKey, current.scrollY, measureStep, scrollRef]);

  useEffect(() => {
    if (!visible) return undefined;
    if (!current.refKey) {
      setHighlight(null);
      setMeasuring(false);
    }
    return undefined;
  }, [current.refKey, visible]);

  const finish = async () => {
    await AsyncStorage.setItem(TOUR_KEY, 'true');
    setStep(0);
    setHighlight(null);
    onDone?.();
  };

  const goNext = () => {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
    else finish();
  };

  const goBack = () => setStep((s) => Math.max(0, s - 1));

  const getTooltipLayout = (targetHighlight) => {
    const width = Math.min(window.width - SCREEN_MARGIN * 2, TOOLTIP_MAX_W);
    const fallbackLeft = (window.width - width) / 2;

    if (isCompact) {
      return {
        top: clamp(window.height - TOOLTIP_EST_H - 14, SCREEN_MARGIN, window.height - 180),
        left: SCREEN_MARGIN,
        width: window.width - SCREEN_MARGIN * 2,
      };
    }

    if (!targetHighlight) {
      return {
        top: clamp(window.height / 2 - TOOLTIP_EST_H / 2, SCREEN_MARGIN, window.height - TOOLTIP_EST_H - SCREEN_MARGIN),
        left: fallbackLeft,
        width,
      };
    }

    const below = targetHighlight.top + targetHighlight.height + PAD + 16;
    const above = targetHighlight.top - PAD - TOOLTIP_EST_H - 16;
    const centerLeft = targetHighlight.left + targetHighlight.width / 2 - width / 2;
    const left = clamp(centerLeft, SCREEN_MARGIN, window.width - width - SCREEN_MARGIN);
    const hasRoomBelow = below + TOOLTIP_EST_H < window.height - SCREEN_MARGIN;

    return {
      top: hasRoomBelow ? below : clamp(above, SCREEN_MARGIN, window.height - TOOLTIP_EST_H - SCREEN_MARGIN),
      left,
      width,
    };
  };

  if (!visible) return null;

  const activeHighlight = measuring ? null : highlight;

  return (
    <Modal visible transparent animationType="none">
      <Spotlight highlight={activeHighlight} screenWidth={window.width} screenHeight={window.height} />

      <Animated.View style={{
        position: 'absolute',
        ...getTooltipLayout(activeHighlight),
        opacity: fadeAnim,
      }}>
        <View style={{
          backgroundColor: '#fff',
          borderRadius: isCompact ? 18 : 20,
          padding: isCompact ? 16 : 20,
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
                {step === STEPS.length - 1 ? 'Mulai Pakai' : 'Lanjut'}
              </Text>
              <Ionicons
                name={step === STEPS.length - 1 ? 'checkmark' : 'chevron-forward'}
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
