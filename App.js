import React, { useState, useEffect } from 'react';
import { SafeAreaView, StatusBar } from 'react-native';

import SplashScreen from './components/SplashScreen';
import Dashboard from './components/Dashboard';
import AboutUs from './components/AboutUs';
import AIAssistant from './components/AIAssistant';
import WiFiManager from './components/WifiManager';
import ErrorBoundary from './components/ErrorBoundary';

const SPLASH_DURATION_MS = 3000;

// Konfigurasi layar — mapping dari nama screen ke render function.
// Membuat App.js tetap pendek meski jumlah screen bertambah.
const SCREENS = {
  splash: () => <SplashScreen />,
  dashboard: (nav) => (
    <Dashboard
      onNavigateToAbout={() => nav('about')}
      onNavigateToAI={() => nav('ai-assistant')}
      onNavigateToWifi={() => nav('wifi-manager')}
    />
  ),
  about: (nav) => <AboutUs onBack={() => nav('dashboard')} />,
  'ai-assistant': (nav) => <AIAssistant onBack={() => nav('dashboard')} />,
  'wifi-manager': (nav) => <WiFiManager onConnected={() => nav('dashboard')} />,
};

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('splash');

  useEffect(() => {
    const timer = setTimeout(() => setCurrentScreen('wifi-manager'), SPLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  const renderScreen = SCREENS[currentScreen] || SCREENS.splash;

  return (
    <ErrorBoundary>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
        <StatusBar barStyle="light-content" backgroundColor="#5AA3C8" />
        {renderScreen(setCurrentScreen)}
      </SafeAreaView>
    </ErrorBoundary>
  );
}
