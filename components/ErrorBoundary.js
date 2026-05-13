import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { logError } from '../utils/errorHandler';

// ─── ErrorBoundary ─────────────────────────────────────────
// React class component — satu-satunya cara untuk menangkap
// error runtime dari render tree. Membungkus seluruh app di App.js
// supaya crash komponen tidak menampilkan layar putih.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    logError('ErrorBoundary', error);
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn('[ErrorBoundary] componentStack:', info?.componentStack);
    }
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.container}>
        <View style={styles.iconWrap}>
          <Ionicons name="alert-circle-outline" size={40} color="#F87171" />
        </View>

        <Text style={styles.title}>Aplikasi mengalami kendala</Text>
        <Text style={styles.subtitle}>
          Terjadi kesalahan yang tidak terduga. Silakan coba mulai ulang tampilan.
        </Text>

        {__DEV__ && (
          <ScrollView style={styles.devBox} contentContainerStyle={{ padding: 12 }}>
            <Text style={styles.devText}>{String(error?.message || error)}</Text>
          </ScrollView>
        )}

        <TouchableOpacity
          onPress={this.handleReset}
          activeOpacity={0.85}
          style={styles.retryBtn}
        >
          <Ionicons name="refresh" size={16} color="#fff" />
          <Text style={styles.retryText}>Muat Ulang</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

// Styles didefinisikan inline agar ErrorBoundary tetap berfungsi
// meski file styles eksternal yang rusak justru menjadi sumber error.
const styles = {
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F7FB',
    padding: 32,
    paddingTop: Platform.OS === 'ios' ? 80 : 60,
  },
  iconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18, fontWeight: '700', color: '#1A3040',
    marginBottom: 8, textAlign: 'center',
  },
  subtitle: {
    fontSize: 13, color: '#6B7280',
    textAlign: 'center', lineHeight: 20, marginBottom: 20,
  },
  devBox: {
    maxHeight: 160, width: '100%',
    backgroundColor: '#FEF2F2', borderRadius: 10,
    borderWidth: 1, borderColor: '#FECACA',
    marginBottom: 20,
  },
  devText: {
    fontSize: 11, color: '#991B1B',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#5AA3C8',
    borderRadius: 12, paddingHorizontal: 22, paddingVertical: 12,
  },
  retryText: {
    color: '#fff', fontWeight: '700', fontSize: 14,
  },
};
