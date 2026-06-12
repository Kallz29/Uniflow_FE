import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { dashboardStyles as styles } from '../styles/dashboardStyles';

export default function ParameterCard({ item, width, onPress, deviceStatus }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      style={[styles.paramCard, { width }]}
    >
      <LinearGradient
        colors={item.colors}
        style={styles.paramCardTop}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={{
          position: 'absolute',
          top: 10,
          right: 10,
          width: 9,
          height: 9,
          borderRadius: 4.5,
          backgroundColor: deviceStatus === 'active' ? '#4ADE80' : '#F87171',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.55)',
        }} />
        <View style={styles.paramCardIconWrap}>
          <Ionicons name={item.iconName} size={16} color="rgba(255,255,255,0.9)" />
        </View>
        <Text style={styles.paramCardLabel}>{item.title}</Text>
        <View style={styles.paramCardValueRow}>
          <Text style={styles.paramCardValue}>{item.value}</Text>
          <Text style={styles.paramCardUnit}>{item.unit}</Text>
        </View>
      </LinearGradient>
      <View style={[styles.paramCardBottom, { backgroundColor: item.colors[1] + 'CC' }]}>
        <Text style={styles.paramCardRange}>{item.range}</Text>
      </View>
    </TouchableOpacity>
  );
}
