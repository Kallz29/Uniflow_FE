import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { dashboardStyles as styles } from '../styles/dashboardStyles';

export default function ParameterCard({ item, width, onPress }) {
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
        <View style={styles.paramCardIconWrap}>
          <Ionicons name={item.iconName} size={16} color="rgba(255,255,255,0.9)" />
        </View>
        <Text style={styles.paramCardLabel}>{item.title}</Text>
        <View style={styles.paramCardValueRow}>
          <Text style={styles.paramCardValue}>{item.value}</Text>
          <Text style={styles.paramCardUnit}>{item.unit}</Text>
        </View>
        {item.calibrationHint && (
          <View style={{
            marginTop: 7,
            alignSelf: 'flex-start',
            backgroundColor: 'rgba(255,255,255,0.22)',
            borderRadius: 8,
            paddingHorizontal: 7,
            paddingVertical: 3,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
          }}>
            <Ionicons name="construct-outline" size={10} color="#fff" />
            <Text style={{ fontSize: 9, color: '#fff', fontWeight: '700' }}>
              {item.calibrationHint}
            </Text>
          </View>
        )}
      </LinearGradient>
      <View style={[styles.paramCardBottom, { backgroundColor: item.colors[1] + 'CC' }]}>
        <Text style={styles.paramCardRange}>{item.anomaly || item.range}</Text>
      </View>
    </TouchableOpacity>
  );
}
