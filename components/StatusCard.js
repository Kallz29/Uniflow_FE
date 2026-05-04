import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { statusCardStyles as styles } from '../styles/statusCardStyles';

const STATUS_CONFIG = {
  good:    { label: 'Baik',   colors: ['#4ADE80', '#22C55E'], icon: 'checkmark-circle' },
  warning: { label: 'Sedang', colors: ['#FBBF24', '#F59E0B'], icon: 'warning' },
  danger:  { label: 'Buruk',  colors: ['#F87171', '#EF4444'], icon: 'alert-circle' },
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
  const progressWidth = wqiScore != null
    ? `${Math.min(100, Math.max(0, Number(wqiScore)))}%`
    : '0%';

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
          },
        ]}
      >
        <LinearGradient colors={config.colors} style={styles.iconContainer}>
          <Ionicons name={config.icon} size={32} color="#FFFFFF" />
        </LinearGradient>

        <View style={styles.content}>
          <Text style={styles.title}>Kualitas Air</Text>
          <Text style={[styles.status, { color: config.colors[1] }]}>{config.label}</Text>
          <View style={styles.progressBar}>
            <LinearGradient
              colors={config.colors}
              style={[styles.progressFill, { width: progressWidth }]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
          </View>
        </View>

        <View style={styles.scoreContainer}>
          <Text style={styles.score}>{score}</Text>
          <Text style={styles.scoreLabel}>Skor</Text>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}