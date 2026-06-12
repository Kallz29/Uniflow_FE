import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import { statusCardStyles as styles } from '../styles/statusCardStyles';

const STATUS_CONFIG = {
  good:    { label: 'Baik',   colors: ['#4ADE80', '#22C55E'], icon: 'checkmark-circle' },
  warning: { label: 'Sedang', colors: ['#FBBF24', '#F59E0B'], icon: 'warning' },
  danger:  { label: 'Buruk',  colors: ['#F87171', '#EF4444'], icon: 'alert-circle' },
};

const ScoreRing = ({ score }) => {
  const size = 88;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = score != null && score !== '-'
    ? Math.min(100, Math.max(0, Number(score)))
    : 0;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.2)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.9)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={{ alignItems: 'center' }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: '#fff' }}>{score ?? '-'}</Text>
        <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.8)', fontWeight: '600' }}>SKOR</Text>
      </View>
    </View>
  );
};

export default function StatusCard({ onHistoryClick, wqiScore, wqiStatus }) {
  const scaleAnim  = useRef(new Animated.Value(0.95)).current;
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(scaleAnim,  { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(fadeAnim,   { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  const handlePressIn  = () =>
    Animated.spring(buttonScale, { toValue: 0.97, useNativeDriver: true }).start();
  const handlePressOut = () =>
    Animated.spring(buttonScale, { toValue: 1,    useNativeDriver: true }).start();

  const config       = STATUS_CONFIG[wqiStatus] || STATUS_CONFIG.good;
  const score        = wqiScore ?? '-';

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onHistoryClick}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={!onHistoryClick}
    >
      <Animated.View
        style={[
          styles.card,
          {
            transform: [{ scale: Animated.multiply(scaleAnim, buttonScale) }],
            opacity: fadeAnim,
            padding: 0,
            overflow: 'hidden',
          },
        ]}
      >
        <LinearGradient
          colors={config.colors}
          style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, width: '100%' }}
        >
          <ScoreRing score={score} />

          <View style={{ flex: 1, marginLeft: 16 }}>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '600', marginBottom: 2 }}>
              Kualitas Air
            </Text>
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 4 }}>
              {config.label}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name={config.icon} size={14} color="rgba(255,255,255,0.85)" />
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>
                Ketuk untuk riwayat
              </Text>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
}
