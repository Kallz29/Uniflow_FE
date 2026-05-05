import React, { useState, useEffect } from 'react';
import { SafeAreaView, StatusBar } from 'react-native';
import SplashScreen from './components/SplashScreen';
import Dashboard from './components/Dashboard';
import AboutUs from './components/AboutUs';
import AIAssistant from './components/AIAssistant';
import WiFiManager from './components/WifiManager';
import { BASE_URL } from './config';

const ESP_STATUS_URL = 'http://192.168.4.1/api/wifi/status';

// Cek apakah HP lagi konek ke ESP32 AP
const checkESPReachable = async () => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(ESP_STATUS_URL, { signal: controller.signal });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    clearTimeout(timeout);
    return false;
  }
};

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('splash');

  useEffect(() => {
    const timer = setTimeout(async () => {
      // Kalau bisa ping ESP → HP lagi konek ke UniFlow-Setup → tampilkan WiFi Manager
      const espReachable = await checkESPReachable();
      if (espReachable) {
        setCurrentScreen('wifi-manager');
      } else {
        setCurrentScreen('dashboard');
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <StatusBar barStyle="light-content" backgroundColor="#5AA3C8" />

      {currentScreen === 'splash' && <SplashScreen />}

      {currentScreen === 'wifi-manager' && (
        <WiFiManager
          onConnected={() => setCurrentScreen('dashboard')}
        />
      )}

      {currentScreen === 'dashboard' && (
        <Dashboard
          onNavigateToAbout={() => setCurrentScreen('about')}
          onNavigateToAI={() => setCurrentScreen('ai-assistant')}
          onNavigateToWifi={() => setCurrentScreen('wifi-manager')}
        />
      )}

      {currentScreen === 'about' && (
        <AboutUs onBack={() => setCurrentScreen('dashboard')} />
      )}

      {currentScreen === 'ai-assistant' && (
        <AIAssistant onBack={() => setCurrentScreen('dashboard')} />
      )}
    </SafeAreaView>
  );
}