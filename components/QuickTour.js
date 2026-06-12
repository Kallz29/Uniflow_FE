import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Modal,
  Animated, Dimensions, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { height: SH } = Dimensions.get('window');
const TOUR_KEY = 'uniflow_tour_done';

const STEPS = [
  {
    id: 'welcome',
    title: 'Selamat datang di UniFlow!',
    desc: 'Aplikasi monitoring kualitas air real-time kampus Telkom University. Mari kenalan dulu dengan fitur-fiturnya.',
    refKey: null,
    icon: 'water',
    scrollY: 0,
  },
  {
    id: 'wqi',
    title: 'Skor WQI',
    desc: 'Water Quality Index - skor 0-100. Hijau = Baik, Kuning = Sedang, Merah = Buruk. Tap untuk lihat riwayat.',
    refKey: 'refWQI',
    icon: 'analytics',
    scrollY: 0,
  },
  {
    id: 'params',
    title: 'Parameter Air',
    desc: 'Tap kartu untuk lihat riwayat historis. Dot kanan atas = status koneksi device, dot kiri atas = status nilai.',
    refKey: 'refParams',
    icon: 'grid',
    scrollY: 100,
  },
  {
    id: 'start',
    title: 'Start / Stop Sesi',
    desc: 'Mulai sesi pengukuran sebelum ambil sampel. Data otomatis di-tag dengan lokasi sesi.',
    refKey: 'refStartBtn',
    icon: 'play-circle',
    scrollY: 300,
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
    id: 'done',
    title: 'Siap digunakan!',
    desc: 'Tour bisa diulang kapan saja dari menu Pengaturan.',
    refKey: null,
    icon: 'checkmark-circle',
    scrollY: 0,
  },
];

export default function QuickTour({ visible, onDone, refs = {}, scrollRef }) {
  const [step, setStep] = useState(0);
  const [highlight, setHighlight] = useState(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const current = STEPS[step];

  const measureRef = useCallback((refKey) => {
    if (!refKey || !refs[refKey]?.current) {
      setHighlight(null);
      return;
    }

    refs[refKey].current.measure((x, y, width, height, pageX, pageY) => {
      setHighlight({ top: pageY, left: pageX, width, height });
    });
  }, [refs]);

  useEffect(() => {
    if (!visible) return undefined;

    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start();

    if (scrollRef?.current) {
      scrollRef.current.scrollTo({ y: current.scrollY, animated: true });
    }

    const t = setTimeout(() => measureRef(current.refKey), 400);
    return () => clearTimeout(t);
  }, [step, visible, current.refKey, current.scrollY, fadeAnim, measureRef, scrollRef]);

  useEffect(() => {
    if (!highlight) return undefined;

    pulseAnim.setValue(1);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.025, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [highlight, pulseAnim]);

  const handleDone = async () => {
    await AsyncStorage.setItem(TOUR_KEY, 'true');
    setStep(0);
    onDone?.();
  };

  const handleNext = () => {
    if (step === STEPS.length - 1) handleDone();
    else setStep((s) => s + 1);
  };

  const handleBack = () => setStep((s) => Math.max(0, s - 1));

  const handleSkip = async () => {
    await AsyncStorage.setItem(TOUR_KEY, 'true');
    setStep(0);
    onDone?.();
  };

  const tooltipTop = highlight
    ? (highlight.top + highlight.height + 16 + 180 < SH
        ? highlight.top + highlight.height + 16
        : Math.max(24, highlight.top - 220))
    : SH / 2 - 140;

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent>
      <View style={StyleSheet.absoluteFill}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.68)' }]} />

        {highlight && (
          <Animated.View style={{
            position: 'absolute',
            top: highlight.top - 6,
            left: highlight.left - 6,
            width: highlight.width + 12,
            height: highlight.height + 12,
            borderRadius: 16,
            borderWidth: 2,
            borderColor: '#7CB9D8',
            transform: [{ scale: pulseAnim }],
            shadowColor: '#7CB9D8',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.9,
            shadowRadius: 10,
            elevation: 8,
          }} />
        )}

        <Animated.View style={{
          position: 'absolute',
          top: tooltipTop,
          left: 20,
          right: 20,
          opacity: fadeAnim,
        }}>
          <View style={{
            backgroundColor: '#fff', borderRadius: 20, padding: 20,
            shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.15, shadowRadius: 16, elevation: 10,
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <View style={{
                width: 38, height: 38, borderRadius: 19,
                backgroundColor: '#EFF8FF', justifyContent: 'center', alignItems: 'center',
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
                  height: 3, borderRadius: 2,
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
                  onPress={handleSkip}
                  style={{
                    flex: 1, borderWidth: 1.5, borderColor: '#D1E8F5',
                    borderRadius: 11, paddingVertical: 10, alignItems: 'center',
                  }}
                >
                  <Text style={{ color: '#8BAFC0', fontWeight: '600', fontSize: 13 }}>Lewati</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={handleBack}
                  style={{
                    width: 42, borderWidth: 1.5, borderColor: '#D1E8F5',
                    borderRadius: 11, paddingVertical: 10, alignItems: 'center',
                  }}
                >
                  <Ionicons name="chevron-back" size={17} color="#8BAFC0" />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={handleNext}
                style={{
                  flex: 1,
                  backgroundColor: step === STEPS.length - 1 ? '#22C55E' : '#5AA3C8',
                  borderRadius: 11, paddingVertical: 10,
                  flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5,
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
      </View>
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
