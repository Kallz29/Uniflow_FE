import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Modal,
  Animated, Dimensions, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SW } = Dimensions.get('window');
const TOUR_KEY = 'uniflow_tour_done';

const STEPS = [
  {
    id: 'welcome',
    title: 'Selamat datang di UniFlow!',
    desc: 'Aplikasi monitoring kualitas air real-time untuk kampus Telkom University. Mari kenalan dulu dengan fitur-fiturnya.',
    highlight: null,
    icon: 'water',
  },
  {
    id: 'wqi',
    title: 'Skor WQI',
    desc: 'Water Quality Index - skor 0-100 kualitas air keseluruhan. Hijau = Baik, Kuning = Sedang, Merah = Buruk.',
    highlight: { top: 160, left: 16, width: SW - 32, height: 90 },
    arrowDir: 'up',
    icon: 'analytics',
  },
  {
    id: 'params',
    title: 'Parameter Air',
    desc: 'Tap kartu untuk lihat riwayat historis per parameter. Dot warna di pojok kiri atas menunjukkan status saat ini.',
    highlight: { top: 310, left: 16, width: SW - 32, height: 180 },
    arrowDir: 'up',
    icon: 'grid',
  },
  {
    id: 'start',
    title: 'Tombol Start / Stop',
    desc: 'Mulai sesi pengukuran sebelum mengambil sampel air. Data yang masuk akan di-tag dengan lokasi sesi tersebut.',
    highlight: { top: 500, left: 16, width: SW - 32, height: 48 },
    arrowDir: 'up',
    icon: 'play-circle',
  },
  {
    id: 'notif',
    title: 'Notifikasi Alert',
    desc: 'Bell akan menyala jika ada parameter yang melewati ambang batas Permenkes No. 32/2017.',
    highlight: { top: 52, left: SW - 140, width: 40, height: 40 },
    arrowDir: 'down',
    icon: 'notifications',
  },
  {
    id: 'settings',
    title: 'Pengaturan',
    desc: 'Atur threshold parameter, kelola perangkat sensor, dan konfigurasi WiFi ESP32.',
    highlight: { top: 52, left: SW - 48, width: 36, height: 40 },
    arrowDir: 'down',
    icon: 'settings',
  },
  {
    id: 'history',
    title: 'Riwayat & Export',
    desc: 'Tap kartu parameter, lihat riwayat, filter by tanggal/jam/zona, lalu export CSV langsung dari backend.',
    highlight: null,
    icon: 'time',
  },
  {
    id: 'done',
    title: 'Siap digunakan!',
    desc: 'Kamu bisa buka tour ini lagi kapan saja dari menu Pengaturan.',
    highlight: null,
    icon: 'checkmark-circle',
  },
];

export default function QuickTour({ visible, onDone }) {
  const [step, setStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const current = STEPS[step];
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;

  useEffect(() => {
    if (!visible) return;
    fadeAnim.setValue(0);
    slideAnim.setValue(20);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [step, visible, fadeAnim, slideAnim]);

  useEffect(() => {
    if (!current?.highlight || !visible) return undefined;
    pulseAnim.setValue(1);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.03, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [step, visible, current?.highlight, pulseAnim]);

  const handleDone = async () => {
    await AsyncStorage.setItem(TOUR_KEY, 'true');
    onDone?.();
    setStep(0);
  };

  const handleNext = () => {
    if (isLast) {
      handleDone();
    } else {
      setStep((s) => s + 1);
    }
  };

  const handleBack = () => setStep((s) => Math.max(0, s - 1));

  const handleSkip = async () => {
    await AsyncStorage.setItem(TOUR_KEY, 'true');
    onDone?.();
    setStep(0);
  };

  const tooltipStyle = current.highlight && current.arrowDir === 'up'
    ? { top: current.highlight.top + current.highlight.height + 20 }
    : { bottom: 100 };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <View style={{ flex: 1 }}>
        <View style={{
          ...StyleSheet.absoluteFillObject,
          backgroundColor: 'rgba(0,0,0,0.72)',
        }} />

        {current.highlight && (
          <Animated.View style={{
            position: 'absolute',
            top: current.highlight.top - 6,
            left: current.highlight.left - 6,
            width: current.highlight.width + 12,
            height: current.highlight.height + 12,
            borderRadius: 16,
            borderWidth: 2.5,
            borderColor: '#7CB9D8',
            backgroundColor: 'transparent',
            transform: [{ scale: pulseAnim }],
            shadowColor: '#7CB9D8',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.8,
            shadowRadius: 12,
            elevation: 10,
          }} />
        )}

        <Animated.View style={[{
          position: 'absolute',
          left: 20,
          right: 20,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        }, tooltipStyle]}>
          <View style={{
            backgroundColor: '#fff',
            borderRadius: 20,
            padding: 20,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.15,
            shadowRadius: 20,
            elevation: 12,
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View style={{
                width: 40, height: 40, borderRadius: 20,
                backgroundColor: '#EFF8FF', justifyContent: 'center', alignItems: 'center',
              }}>
                <Ionicons name={current.icon} size={20} color="#5AA3C8" />
              </View>
              <Text style={{ fontSize: 11, color: '#8BAFC0', fontWeight: '600' }}>
                {step + 1} / {STEPS.length}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 5, marginBottom: 14 }}>
              {STEPS.map((tourStep, i) => (
                <View
                  key={tourStep.id}
                  style={{
                    height: 4,
                    borderRadius: 2,
                    flex: i === step ? 2 : 1,
                    backgroundColor: i <= step ? '#7CB9D8' : '#E2EEF5',
                  }}
                />
              ))}
            </View>

            <Text style={{ fontSize: 16, fontWeight: '800', color: '#1A3040', marginBottom: 8 }}>
              {current.title}
            </Text>
            <Text style={{ fontSize: 13, color: '#6B7280', lineHeight: 20, marginBottom: 20 }}>
              {current.desc}
            </Text>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              {isFirst ? (
                <TouchableOpacity
                  onPress={handleSkip}
                  style={{
                    flex: 1, borderWidth: 1.5, borderColor: '#D1E8F5',
                    borderRadius: 12, paddingVertical: 11, alignItems: 'center',
                  }}
                >
                  <Text style={{ color: '#8BAFC0', fontWeight: '600', fontSize: 13 }}>Lewati</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={handleBack}
                  style={{
                    width: 44, borderWidth: 1.5, borderColor: '#D1E8F5',
                    borderRadius: 12, paddingVertical: 11, alignItems: 'center',
                  }}
                >
                  <Ionicons name="chevron-back" size={18} color="#8BAFC0" />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={handleNext}
                activeOpacity={0.85}
                style={{
                  flex: 1, backgroundColor: isLast ? '#16A34A' : '#5AA3C8',
                  borderRadius: 12, paddingVertical: 11,
                  flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                  {isLast ? 'Mulai Pakai' : 'Lanjut'}
                </Text>
                {!isLast && <Ionicons name="chevron-forward" size={16} color="#fff" />}
                {isLast && <Ionicons name="checkmark" size={16} color="#fff" />}
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
