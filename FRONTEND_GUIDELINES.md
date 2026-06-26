# UniFlow Frontend Guidelines

React Native Expo Mobile Application

Versi 1.1 - Juni 2026

## Overview

UniFlow Frontend adalah aplikasi mobile berbasis Expo React Native untuk monitoring kualitas air real-time. Aplikasi terhubung ke backend UniFlow dan ESP32 untuk menampilkan data sensor, Water Quality Index (WQI), riwayat, alert, sesi pengukuran, pengaturan perangkat, WiFi Manager, About Us, Quick Tour, dan AI Assistant.

Platform utama: Android

Framework: Expo SDK 51, React Native 0.74

Backend Base URL: `https://api.uniflow.me/api`

ESP32 Setup API: `http://192.168.4.1/api/wifi`

Format data: JSON

Bahasa UI: Indonesia formal

## 1. Struktur Project

| Path | Fungsi |
| --- | --- |
| `App.js` | Routing screen utama berbasis state |
| `components/Dashboard.js` | Dashboard monitoring, WQI, alert, settings, threshold, device modal |
| `components/MeasurementScreen.js` | Start/stop sesi pengukuran dan live data |
| `components/HistoryModal.js` | Riwayat parameter, filter, marker sesi, export CSV |
| `components/WifiManager.js` | Konfigurasi WiFi ESP32 melalui AP `UniFlow-Setup` |
| `components/AIAssistant.js` | Chat AI berbasis backend session |
| `components/QuickTour.js` | Panduan penggunaan aplikasi |
| `components/SplashScreen.js` | Splash/loading awal aplikasi |
| `components/AboutUs.js` | Informasi tim |
| `components/ErrorBoundary.js` | Fallback error UI |
| `services/api.js` | Wrapper endpoint backend |
| `services/espWifi.js` | Wrapper endpoint WiFi ESP32 |
| `services/espDevice.js` | Deteksi ESP32 mode setup |
| `utils/apiClient.js` | HTTP client, timeout, dan normalisasi error |
| `utils/errorHandler.js` | AppError, pesan user, dan logging |
| `utils/waterQuality.js` | Mapping sensor, status, WQI, threshold, date helper |
| `utils/dashboardCache.js` | Cache snapshot dashboard |
| `styles/` | StyleSheet per komponen |
| `constants/colors.js` | Palet warna aplikasi |
| `assets/` | Logo, icon, dan gambar tim |

## 2. Konfigurasi Aplikasi

Backend URL berada di `config.js`:

```js
export const BASE_URL = 'https://api.uniflow.me/api';
```

Semua request backend harus lewat `services/api.js` dan `utils/apiClient.js`.

File konfigurasi Expo:

- `app.json`
- `eas.json`
- `app.plugin.js`

Catatan:

- `app.json` harus valid terhadap schema Expo.
- Cleartext HTTP untuk ESP32 diatur melalui `app.plugin.js`.
- `icon` dan `android.adaptiveIcon.foregroundImage` memakai asset square.
- Android package: `com.uniflow.mobile`.
- Version app saat ini: `1.0.2`, Android `versionCode` 3.

## 3. Routing dan Screen

Routing dikelola di `App.js` melalui state `currentScreen` dan object `SCREENS`.

| Screen Key | Component | Deskripsi |
| --- | --- | --- |
| `splash` | `SplashScreen` | Tampilan awal aplikasi |
| `dashboard` | `Dashboard` | Home monitoring |
| `about` | `AboutUs` | Informasi tim |
| `ai-assistant` | `AIAssistant` | Chatbot UniFlow |
| `wifi-manager` | `WifiManager` | Konfigurasi WiFi ESP32 |
| `measurement` | `MeasurementScreen` | Sesi pengukuran |

Setelah splash, aplikasi membuka `wifi-manager`.

Prinsip routing:

- Gunakan callback dari parent untuk pindah screen.
- Jangan menyebar navigation state ke banyak komponen.
- Screen yang butuh kembali menerima callback seperti `onBack`.
- Screen WiFi memakai callback `onConnected`.

## 4. Dashboard

Dashboard adalah pusat monitoring kualitas air.

Endpoint utama:

| Endpoint | Fungsi |
| --- | --- |
| `GET /sensors/latest` | Data sensor terbaru |
| `GET /sensors?limit=100` | Riwayat ringkas |
| `GET /sensors/stats` | Statistik rata-rata |
| `GET /alerts?limit=20` | Notifikasi alert |
| `GET /threshold` | Batas normal parameter |
| `GET /devices` | Status perangkat |
| `GET /measurements` | Sesi pengukuran |

UI utama:

- WQI card untuk kualitas air keseluruhan.
- Average stats untuk WQI, pH, suhu, TDS, dan NTU.
- Tombol Start/Stop sesi.
- Parameter cards untuk pH, suhu, TDS, dan kekeruhan.
- Alert modal.
- Settings modal.
- Device modal.
- Threshold modal.
- Shortcut AI Assistant, WiFi Manager, About Us, dan Measurement.

Guideline:

- Dashboard harus tetap bisa tampil walau endpoint sekunder gagal.
- Gunakan snapshot cache untuk fallback ketika backend tidak dapat dijangkau.
- Jangan menampilkan status perangkat berulang di setiap parameter card.
- Status terbaru harus ringkas dan mudah dipindai.
- Pesan error harus berasal dari `toUserMessage`, bukan error mentah fetch.

## 5. Parameter Air

| Parameter | Field Backend | Unit | Format UI |
| --- | --- | --- | --- |
| pH | `ph` | pH | 1 desimal |
| Suhu | `temperature` | Celsius | 1 desimal |
| TDS | `tds` | ppm | 0 desimal |
| Kekeruhan | `turbidity` | NTU | 1 desimal |

Guideline:

- Gunakan helper dari `utils/waterQuality.js`.
- Threshold aktif menentukan status parameter.
- Tap parameter card membuka `HistoryModal`.
- Hindari istilah teknis berlebihan di UI user akhir.

## 6. Measurement Sessions

Sesi pengukuran digunakan untuk menandai data sensor berdasarkan lokasi pengambilan sampel.

Endpoint:

| Endpoint | Fungsi |
| --- | --- |
| `GET /devices` | Pilih perangkat |
| `PUT /devices/:id` | Update lokasi perangkat |
| `POST /measurements/start` | Mulai sesi |
| `POST /measurements/stop` | Stop sesi |
| `GET /measurements` | Verifikasi sesi aktif |
| `GET /sensors/latest` | Live data saat sesi |

Alur:

1. User membuka halaman sesi.
2. User memilih device aktif.
3. User mengisi lokasi pengukuran.
4. Frontend update lokasi device.
5. Frontend memulai measurement.
6. Saat sesi aktif, durasi berjalan.
7. User menekan Stop untuk menyelesaikan sesi.

Guideline:

- Device dengan `status: active` boleh dipilih.
- Jangan memaksa device menjadi offline hanya karena `last_seen` kosong jika backend mengirim `status: active`.
- Start/stop memakai timeout lebih panjang.
- Jika request start/stop gagal, verifikasi ulang sesi aktif sebelum menampilkan error final.
- Durasi dihitung dari `start_time` dan diperbarui tiap detik.
- Timestamp backend tanpa timezone harus diparse konsisten.

## 7. History dan Export CSV

Komponen: `components/HistoryModal.js`

Endpoint:

| Endpoint | Fungsi |
| --- | --- |
| `GET /sensors?limit=100` | Data riwayat ringkas |
| `GET /sensors/export/csv?...` | Export seluruh data sesuai filter |
| `GET /measurements` | Mapping data ke sesi |

Fitur:

- Menampilkan maksimal 100 data di UI.
- Filter lokasi.
- Filter rentang tanggal.
- Filter rentang jam.
- Export CSV dari backend.
- Marker sesi melalui data measurement.

Guideline:

- UI list dibatasi untuk performa mobile.
- Export CSV harus dari backend, bukan dari 100 data yang sedang tampil.
- Input jam bisa diketik manual dan dinormalisasi ke rentang 0-23.
- Empty state harus menyediakan aksi hapus filter.
- Wording filter harus formal dan jelas.

## 8. Alerts

Endpoint:

| Endpoint | Fungsi |
| --- | --- |
| `GET /alerts?unread=true&limit=N` | Ambil alert |
| `PATCH /alerts/:id/read` | Tandai satu alert dibaca |
| `PATCH /alerts/read-all` | Tandai semua alert dibaca |

Mapping severity:

| Severity | Tampilan |
| --- | --- |
| `warning` | Peringatan |
| `danger` | Bahaya |
| `critical` | Kritis |

Guideline:

- Alert unread tampil lebih menonjol.
- Gunakan badge `BARU` untuk alert unread.
- Mark as read dipicu saat alert disentuh.
- Sediakan `Tandai semua dibaca` saat ada unread count.

## 9. Device Management

Endpoint:

| Endpoint | Fungsi |
| --- | --- |
| `GET /devices` | List perangkat |
| `POST /devices` | Tambah perangkat |
| `PUT /devices/:id` | Update nama, lokasi, atau status |
| `DELETE /devices/:id` | Hapus perangkat |

Guideline:

- Device baru dari frontend dibuat dengan `status: inactive`.
- Device berubah active berdasarkan backend setelah menerima data dari perangkat.
- Kode device hanya boleh huruf, angka, dash, dan underscore.
- Hapus device harus memakai confirmation dialog.
- Device list menampilkan nama, kode/lokasi, dan status.

## 10. WiFi Manager ESP32

Komponen: `components/WifiManager.js`

Base URL:

```txt
http://192.168.4.1/api/wifi
```

Endpoint:

| Endpoint | Method | Fungsi |
| --- | --- | --- |
| `/scan` | GET | Scan jaringan WiFi |
| `/status` | GET | Cek status WiFi ESP32 |
| `/connect` | POST | Kirim SSID/password |
| `/disconnect` | POST | Disconnect WiFi ESP32 |

Response `/status`:

```json
{
  "connected": true,
  "ap_mode": false,
  "ssid": "TelU-IOT",
  "ip": "192.168.x.x",
  "signal": -60,
  "ap_ip": "192.168.4.1"
}
```

Guideline:

- Instruksikan user menghubungkan HP ke `UniFlow-Setup`.
- Minta user mematikan data seluler/VPN sementara jika koneksi ESP32 sulit.
- Gunakan polling `/status` setelah `/connect`.
- Request ke ESP32 boleh putus saat perangkat pindah jaringan; lanjutkan polling sebelum menyatakan gagal.
- `Connection: close` harus dipertahankan di request ESP32 untuk menghindari hang.
- Jangan auto redirect hanya karena ESP32 sudah connected saat user membuka WiFi Manager.
- Setelah user berhasil connect lewat modal, boleh kembali ke Dashboard setelah pesan sukses singkat.

## 11. AI Assistant

Komponen: `components/AIAssistant.js`

AI Assistant memakai backend chat session.

Endpoint:

| Endpoint | Fungsi |
| --- | --- |
| `POST /chat/sessions` | Buat sesi chat |
| `GET /chat/sessions` | List sesi |
| `PATCH /chat/sessions/:id` | Update judul sesi |
| `PUT /chat/sessions/:id` | Fallback update judul |
| `GET /chat/sessions/:id/messages` | Ambil history pesan |
| `POST /chat/sessions/:id/messages` | Kirim pesan |
| `DELETE /chat/sessions/:id` | Hapus sesi |

Guideline:

- User message di kanan, AI response di kiri.
- Tampilkan loading saat menunggu respons AI.
- Sediakan drawer riwayat chat.
- Sediakan tombol `+ Baru`.
- Hapus sesi harus memakai modal konfirmasi.
- Error AI tampil sebagai pesan ramah.
- Judul default formal: `Sesi Baru`.
- Judul sesi diperbarui dari pesan pertama user.
- Jangan menambahkan AI mock keyword di komponen produksi.
- Respons markdown boleh dibersihkan sebelum tampil jika styling markdown belum didukung.

## 12. Error Handling

Semua request backend harus melewati `utils/apiClient.js`.

Jenis error:

| Kondisi | Pesan UI |
| --- | --- |
| Timeout | `Permintaan memakan waktu terlalu lama. Periksa koneksi lalu coba lagi.` |
| Network error | `Tidak dapat terhubung ke server. Periksa koneksi internet perangkat Anda.` |
| HTTP error backend | Gunakan `message` atau `error` dari response |
| Unknown error | Gunakan fallback sesuai konteks |

Guideline:

- Jangan tampilkan `TypeError: Network request failed` ke user.
- Gunakan `toUserMessage(err, fallback)`.
- Gunakan `logError(tag, err)` untuk debug.
- Untuk aksi penting, lakukan retry atau verifikasi ulang jika memungkinkan.

## 13. Data Formatting

Gunakan locale `id-ID`.

```js
new Date(value).toLocaleString('id-ID')
```

Format angka:

| Data | Format |
| --- | --- |
| WQI | `Math.round(value)` |
| pH | `toFixed(1)` |
| Suhu | `toFixed(1)` |
| TDS | `toFixed(0)` |
| NTU | `toFixed(1)` |

Guideline:

- Tampilkan waktu relatif di dashboard jika memungkinkan.
- Tampilkan durasi sesi dan waktu mulai.
- Gunakan `parseLocalDate` untuk timestamp backend yang perlu distabilkan.

## 14. Design System

Palet utama:

| Token | Warna | Penggunaan |
| --- | --- | --- |
| Primary | `#5AA3C8` | Tombol utama, icon, highlight |
| Primary Light | `#7CB9D8` | Splash/header variasi |
| Primary Dark | `#3E8FB8` | Gradient/header |
| Background | `#F0F7FB` | Background screen |
| Text Dark | `#1A3040` | Judul dan teks utama |
| Muted | `#8BAFC0` | Subtitle dan secondary text |
| Success | `#22C55E` | Connected, success |
| Warning | `#F59E0B` | Warning state |
| Danger | `#E11D48` | Stop session, danger action |

Guideline UI:

- Gunakan icon dari `@expo/vector-icons/Ionicons`.
- Tombol destructive seperti Stop/Hapus memakai merah/rose.
- Tombol utama memakai biru UniFlow.
- Gunakan card radius konsisten sesuai style existing.
- Hindari status yang berulang di banyak card.
- Teks harus formal, jelas, dan tidak terlalu panjang.
- Pastikan teks tombol tidak terpotong di layar kecil.

## 15. Build dan Validation

Script:

```bash
npm install
npm start
npm run android
npm run web
npm run build
```

EAS:

```bash
eas build -p android --profile preview
```

Checklist:

- `npm run build` sukses.
- `npx expo-doctor` lulus.
- `app.json` valid.
- Asset icon aplikasi square.
- `.expo/` tidak tracked.
- `dist/` tidak ikut commit kecuali memang dibutuhkan.

## 16. Git dan File Output

Jangan commit:

- `node_modules/`
- `.expo/`
- `.expo-shared/`
- `dist/`
- `.env`
- file cache lokal

Boleh commit:

- Source code `components/`, `services/`, `utils/`, `styles/`
- `app.json`
- `app.plugin.js`
- `eas.json`
- `package.json`
- `package-lock.json`
- Asset aplikasi yang dipakai
- Dokumentasi `.md`

## 17. Rekomendasi Pengembangan

- Pisahkan logic API dari UI component.
- Gunakan helper di `utils/waterQuality.js` untuk mapping sensor dan formatting.
- Jangan menambah dependency baru tanpa kebutuhan jelas.
- Untuk perubahan UI besar, validasi di layar mobile terlebih dahulu.
- Untuk flow IoT/WiFi, anggap koneksi bisa putus saat ESP32 berpindah jaringan.
- Untuk flow measurement, verifikasi ulang sesi aktif setelah request gagal.
- Untuk AI Assistant, pertahankan session-based backend flow.
- Untuk wording, gunakan Bahasa Indonesia formal dan ringkas.
