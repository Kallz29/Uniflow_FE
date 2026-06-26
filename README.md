# UniFlow Mobile

UniFlow Mobile adalah aplikasi Expo React Native untuk monitoring kualitas air secara real-time. Aplikasi ini terhubung ke backend UniFlow dan ESP32 untuk menampilkan data sensor, status perangkat, sesi pengukuran, riwayat, alert, WiFi setup, dan AI Assistant.

Versi aplikasi: `1.0.2`

Platform utama: Android

## Fitur Utama

- Dashboard Water Quality Index (WQI) dan parameter air.
- Monitoring pH, suhu, TDS, dan kekeruhan.
- Status perangkat sensor dan pengelolaan perangkat.
- Riwayat data dengan filter lokasi, tanggal, dan jam.
- Export CSV dari backend sesuai filter data.
- Sesi pengukuran berdasarkan lokasi sampel.
- Alert saat parameter melewati threshold.
- Pengaturan threshold kualitas air.
- WiFi Manager untuk konfigurasi ESP32 lewat AP `UniFlow-Setup`.
- AI Assistant dengan sesi chat, riwayat pesan, buat sesi baru, dan hapus sesi.
- About Us dan Quick Tour.

## Teknologi

- Expo SDK 51
- React Native 0.74
- React 18
- `@expo/vector-icons`
- `@react-native-async-storage/async-storage`
- `expo-network`
- `expo-file-system`
- `expo-sharing`

## Konfigurasi

Backend utama diatur di [config.js](./config.js):

```js
export const BASE_URL = 'https://api.uniflow.me/api';
```

Endpoint ESP32 WiFi setup menggunakan:

```txt
http://192.168.4.1/api/wifi
```

## Menjalankan Aplikasi

```bash
npm install
npm start
```

Android:

```bash
npm run android
```

Web preview:

```bash
npm run web
```

Build export:

```bash
npm run build
```

EAS preview APK:

```bash
eas build -p android --profile preview
```

## Struktur Utama

| Path | Fungsi |
| --- | --- |
| `App.js` | Routing screen utama berbasis state |
| `components/Dashboard.js` | Dashboard monitoring, alert, settings, threshold, device modal |
| `components/MeasurementScreen.js` | Start/stop sesi pengukuran |
| `components/HistoryModal.js` | Riwayat, filter, marker sesi, export CSV |
| `components/WifiManager.js` | Konfigurasi WiFi ESP32 |
| `components/AIAssistant.js` | Chat AI berbasis backend session |
| `components/QuickTour.js` | Panduan penggunaan aplikasi |
| `components/AboutUs.js` | Informasi tim |
| `services/api.js` | Wrapper endpoint backend |
| `services/espWifi.js` | Wrapper endpoint WiFi ESP32 |
| `services/espDevice.js` | Deteksi ESP32 mode setup |
| `utils/apiClient.js` | HTTP client, timeout, dan normalisasi error |
| `utils/waterQuality.js` | Helper mapping sensor, WQI, status, dan tanggal |
| `utils/dashboardCache.js` | Cache snapshot dashboard |
| `styles/` | StyleSheet per komponen |
| `constants/colors.js` | Palet warna aplikasi |

## Alur Screen

Setelah splash, aplikasi membuka `wifi-manager`. Dari dashboard, user dapat membuka:

- `about`
- `ai-assistant`
- `wifi-manager`
- `measurement`

Routing masih dikelola di `App.js` melalui state `currentScreen`.

## Catatan Data

Riwayat yang tampil di aplikasi dibatasi maksimal 100 data terakhir agar UI tetap ringan. Untuk mengambil seluruh data, gunakan export CSV yang langsung mengambil file dari backend sesuai filter aktif.

## Validasi Sebelum Commit

```bash
npm run build
npx expo-doctor
```

Pastikan file cache lokal seperti `node_modules/`, `.expo/`, `.expo-shared/`, dan `dist/` tidak ikut commit kecuali memang dibutuhkan.
