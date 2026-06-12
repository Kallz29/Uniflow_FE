# UniFlow Mobile

UniFlow adalah aplikasi Expo React Native untuk monitoring kualitas air secara real-time.

## Fitur

- Dashboard WQI dan parameter air: pH, suhu, TDS, dan kekeruhan.
- Status koneksi perangkat sensor.
- Riwayat data per parameter dan WQI.
- Filter riwayat berdasarkan lokasi, tanggal, dan jam.
- Tampilan riwayat dibatasi maksimal 100 data terakhir sesuai filter.
- Export CSV langsung dari backend untuk mengambil seluruh data atau seluruh data sesuai filter.
- Sesi pengukuran dengan lokasi pengambilan sampel.
- Notifikasi alert saat parameter melewati ambang.
- AI Assistant dengan sesi chat dan riwayat percakapan.
- Pengaturan threshold, perangkat, WiFi ESP32, dan panduan aplikasi.

## Menjalankan Aplikasi

```bash
npm install
npm start
```

## Build

```bash
npm run build
```

## Struktur Utama

- `App.js`: routing utama aplikasi.
- `components/Dashboard.js`: dashboard monitoring.
- `components/HistoryModal.js`: riwayat, filter, dan export CSV.
- `components/MeasurementScreen.js`: start/stop sesi pengukuran.
- `components/AIAssistant.js`: halaman chat AI.
- `components/QuickTour.js`: panduan aplikasi.
- `services/api.js`: koneksi API backend.
- `styles/`: styling komponen.
- `constants/colors.js`: palet warna aplikasi.

## Catatan Data

Riwayat yang tampil di aplikasi dibatasi maksimal 100 data terakhir agar UI tetap ringan. Gunakan tombol download CSV untuk mengambil seluruh data dari backend, termasuk seluruh data yang cocok dengan filter lokasi atau rentang waktu.
