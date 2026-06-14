# UniFlow Frontend Guidelines

React Native Expo Mobile Application

Versi 1.0 - Juni 2026

## Overview

UniFlow Frontend adalah aplikasi mobile berbasis Expo React Native untuk monitoring kualitas air real-time. Aplikasi ini terhubung ke backend UniFlow dan ESP32 untuk menampilkan data sensor, Water Quality Index (WQI), riwayat parameter, notifikasi alert, sesi pengukuran, konfigurasi perangkat, WiFi Manager, dan AI Assistant.

Platform utama: Android

Framework: Expo SDK 51, React Native 0.74

Backend Base URL: `https://api.uniflow.me/api`

ESP32 Setup API: `http://192.168.4.1/api/wifi`

Format Data: JSON

Timezone Tampilan: WIB / `id-ID`

## 1. Struktur Project

Struktur utama aplikasi:

| Path | Fungsi |
| --- | --- |
| `App.js` | Routing screen utama aplikasi |
| `components/Dashboard.js` | Dashboard monitoring, WQI, alerts, settings, device modal |
| `components/MeasurementScreen.js` | Start/stop sesi pengukuran dan live data saat sesi aktif |
| `components/HistoryModal.js` | Riwayat parameter, filter lokasi/tanggal/jam, export CSV |
| `components/WifiManager.js` | Konfigurasi WiFi ESP32 melalui AP `UniFlow-Setup` |
| `components/AIAssistant.js` | Chat AI, sesi chat, history pesan |
| `components/QuickTour.js` | Panduan penggunaan aplikasi |
| `components/SplashScreen.js` | Splash/loading awal aplikasi |
| `services/api.js` | Wrapper endpoint backend |
| `services/espWifi.js` | Helper endpoint WiFi ESP32 |
| `services/espDevice.js` | Helper cek koneksi ESP32 |
| `utils/apiClient.js` | HTTP client utama dengan timeout dan error normalization |
| `utils/waterQuality.js` | Mapping data sensor, status, threshold, WQI helpers |
| `utils/dashboardCache.js` | Cache snapshot dashboard |
| `styles/` | StyleSheet per komponen |
| `assets/` | Logo, app icon, dan gambar |

## 2. Konfigurasi Aplikasi

### Backend URL

Konfigurasi backend berada di:

```js
// config.js
export const BASE_URL = 'https://api.uniflow.me/api';
```

Semua request backend harus lewat `services/api.js` atau `utils/apiClient.js`.

### Expo Config

File utama:

- `app.json`
- `eas.json`
- `app.plugin.js`

Catatan:

- `app.json` tidak boleh memakai field yang tidak valid pada schema Expo.
- Cleartext HTTP untuk ESP32 tidak ditaruh langsung di `android.usesCleartextTraffic`, tetapi diatur melalui `app.plugin.js`.
- `icon` dan `android.adaptiveIcon.foregroundImage` harus memakai asset square.

## 3. Routing dan Screen

Routing masih dikelola sederhana di `App.js` menggunakan state `currentScreen`.

Screen utama:

| Screen Key | Component | Deskripsi |
| --- | --- | --- |
| `splash` | `SplashScreen` | Tampilan awal aplikasi |
| `dashboard` | `Dashboard` | Home monitoring |
| `about` | `AboutUs` | Informasi tim/profil |
| `ai` | `AIAssistant` | Chatbot UniFlow |
| `wifi` | `WifiManager` | Konfigurasi WiFi ESP32 |
| `measurement` | `MeasurementScreen` | Sesi pengukuran |

Prinsip routing:

- Gunakan callback `onNavigate...` dari parent untuk pindah screen.
- Jangan membuat navigation state tersebar di banyak komponen.
- Screen yang membutuhkan back action menerima callback `onBack`.

## 4. Dashboard

Dashboard adalah pusat monitoring kualitas air.

Endpoint yang digunakan:

| Endpoint | Fungsi |
| --- | --- |
| `GET /sensors/latest` | Data sensor terbaru |
| `GET /sensors?limit=100` | Riwayat ringkas untuk chart/history |
| `GET /sensors/stats` | Statistik rata-rata |
| `GET /alerts?limit=20` | Notifikasi alert |
| `GET /threshold` | Batas normal parameter |
| `GET /devices` | Status perangkat |
| `GET /measurements` | Sesi pengukuran aktif |

UI utama:

- WQI card untuk kualitas air keseluruhan.
- Average stats strip untuk WQI, pH, suhu, TDS, dan NTU.
- Tombol Start/Stop sesi.
- Parameter cards untuk pH, suhu, TDS, dan kekeruhan.
- Alert modal.
- Settings modal.
- Device modal.
- Threshold modal.

Guideline:

- Dashboard harus tetap bisa tampil walau salah satu endpoint sekunder gagal.
- Gunakan snapshot cache untuk fallback saat backend tidak dapat dijangkau.
- Jangan tampilkan status device berulang di setiap parameter card. Gunakan satu indikator global.
- Status terbaru ditampilkan dengan format ringkas seperti `Diperbarui Baru saja`.

## 5. Parameter Air

Parameter yang ditampilkan:

| Parameter | Field Backend | Unit | Normalisasi UI |
| --- | --- | --- | --- |
| pH | `ph` | pH | 1 desimal |
| Suhu | `temperature` | Celsius | 1 desimal |
| TDS | `tds` | ppm | 0 desimal |
| Kekeruhan | `turbidity` | NTU | 1 desimal |

Guideline:

- Gunakan helper `mapSensorToCards` dari `utils/waterQuality.js`.
- Gunakan threshold aktif untuk menentukan status parameter.
- Tap parameter card membuka `HistoryModal`.
- Hindari label teknis yang tidak familiar untuk user akhir kecuali diperlukan.

## 6. Measurement Sessions

Sesi pengukuran digunakan untuk menandai data sensor berdasarkan lokasi pengambilan sampel.

Endpoint:

| Endpoint | Fungsi |
| --- | --- |
| `GET /devices` | Pilih perangkat |
| `PUT /devices/:id` | Update lokasi perangkat sebelum sesi |
| `POST /measurements/start` | Mulai sesi |
| `POST /measurements/stop` | Stop sesi |
| `GET /measurements` | Verifikasi sesi aktif |
| `GET /sensors/latest` | Live data saat sesi |

Alur UI:

1. User membuka halaman sesi.
2. User memilih device yang aktif.
3. User mengisi lokasi pengukuran.
4. Frontend update lokasi device.
5. Frontend memanggil start measurement.
6. Saat sesi aktif, tombol berubah menjadi Stop dan durasi berjalan.
7. User menekan Stop untuk menyelesaikan sesi.

Guideline implementasi:

- Device dengan `status: active` boleh dipilih.
- Jangan memaksa device menjadi offline hanya karena `last_seen` kosong bila backend mengirim `status: active`.
- Start/stop measurement memakai timeout lebih panjang karena ini aksi penting.
- Jika start request gagal, lakukan verifikasi ulang dengan `GET /measurements` sebelum menampilkan error.
- Durasi dihitung di frontend dari `start_time`.
- Timestamp backend tanpa timezone harus diperlakukan konsisten agar durasi tidak macet.

Status UI:

| Kondisi | Tampilan |
| --- | --- |
| Tidak ada sesi aktif | Tombol Start biru |
| Sesi aktif | Tombol Stop merah/rose, durasi dan lokasi tampil center |
| Request berjalan | Loading indicator pada tombol |
| Request gagal | Alert formal dengan instruksi koneksi |

## 7. History dan Export CSV

Komponen: `components/HistoryModal.js`

Fitur:

- Menampilkan data maksimal 100 baris di UI.
- Filter lokasi.
- Filter rentang tanggal.
- Filter rentang jam.
- Export CSV dari backend.
- Menampilkan marker sesi melalui data measurement.

Endpoint:

| Endpoint | Fungsi |
| --- | --- |
| `GET /sensors?limit=100` | Data riwayat ringkas |
| `GET /sensors/export/csv?...` | Export seluruh data sesuai filter |
| `GET /measurements` | Mapping data ke sesi |

Guideline:

- UI list dibatasi agar performa mobile tetap ringan.
- Export CSV harus menggunakan endpoint backend, bukan CSV lokal dari 100 data yang tampil.
- Label tombol filter harus formal. Hindari wording seperti `Pilih filter dulu`; gunakan `Tentukan filter untuk melanjutkan`.
- Input jam harus bisa diketik manual dan dinormalisasi ke rentang 0-23.
- Jika tidak ada data sesuai filter, tampilkan empty state dan tombol hapus filter.

## 8. Alerts dan Notifikasi

Komponen utama: `Dashboard.js`

Endpoint:

| Endpoint | Fungsi |
| --- | --- |
| `GET /alerts?limit=20` | Ambil daftar alert |
| `PATCH /alerts/:id/read` | Tandai satu alert dibaca |
| `PATCH /alerts/read-all` | Tandai semua alert dibaca |

Mapping severity:

| Severity | Warna Utama | UI |
| --- | --- | --- |
| `warning` | Kuning/oranye | Peringatan |
| `danger` | Merah | Bahaya |
| `critical` | Merah pekat | Kritis |

Guideline:

- Alert unread ditampilkan lebih menonjol.
- Gunakan badge `BARU` untuk alert unread.
- Pesan alert harus tetap terbaca, jangan terlalu padat.
- Mark as read dipicu saat alert disentuh.
- Gunakan tombol `Tandai semua dibaca` saat ada unread count.

## 9. Device Management

Komponen: Device modal di `Dashboard.js`

Endpoint:

| Endpoint | Fungsi |
| --- | --- |
| `GET /devices` | List perangkat |
| `POST /devices` | Tambah perangkat |
| `PUT /devices/:id` | Update nama/lokasi/status |
| `DELETE /devices/:id` | Hapus perangkat |

Guideline:

- Device baru dari frontend harus tampil offline/inactive sampai backend menerima data MQTT dari device.
- Device yang sudah mengirim data akan berubah active dari backend.
- Kode device hanya boleh huruf, angka, dash, dan underscore.
- Hapus device harus memakai confirmation dialog.
- Device list harus menampilkan nama device, lokasi, dan status.

## 10. WiFi Manager ESP32

Komponen: `components/WifiManager.js`

ESP32 base URL:

```txt
http://192.168.4.1/api/wifi
```

Endpoint ESP32:

| Endpoint | Method | Fungsi |
| --- | --- | --- |
| `/scan` | GET | Scan jaringan WiFi |
| `/status` | GET | Cek status WiFi ESP32 |
| `/connect` | POST | Kirim SSID/password ke ESP32 |
| `/disconnect` | POST | Disconnect WiFi ESP32 |

Response `/status` dari IoT:

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

- Saat ESP32 sudah connected, tampilkan status `Connected - SSID`.
- Jangan auto redirect saat user membuka WiFi Manager dan ESP32 sudah connected; beri tombol kembali ke Dashboard.
- Saat user baru selesai connect lewat modal, boleh redirect ke Dashboard setelah pesan sukses singkat.
- Gunakan polling `/status` setelah POST `/connect`.
- Anggap request ke ESP32 bisa putus saat ESP32 berpindah jaringan; lanjutkan polling sebelum menyatakan gagal.
- Tampilkan instruksi agar HP terhubung ke `UniFlow-Setup`, data seluler/VPN dimatikan sementara, dan pilih tetap terhubung bila Android memberi warning WiFi tanpa internet.

## 11. AI Assistant

Komponen: `components/AIAssistant.js`

Endpoint:

| Endpoint | Fungsi |
| --- | --- |
| `POST /chat/sessions` | Buat sesi chat |
| `GET /chat/sessions` | List sesi |
| `GET /chat/sessions/:id/messages` | Ambil history pesan |
| `POST /chat/sessions/:id/messages` | Kirim pesan |
| `DELETE /chat/sessions/:id` | Hapus sesi |

Guideline:

- User message di kanan, AI response di kiri.
- Tampilkan loading saat menunggu AI response.
- Sediakan new chat dan delete session.
- Error AI harus tampil sebagai pesan ramah, bukan stack trace.
- Gunakan title default formal seperti `Sesi Baru`.

## 12. Error Handling

Semua request backend harus melewati `utils/apiClient.js`.

Jenis error:

| Kondisi | Pesan UI |
| --- | --- |
| Timeout | `Permintaan memakan waktu terlalu lama. Periksa koneksi lalu coba lagi.` |
| Network error | `Tidak dapat terhubung ke server. Periksa koneksi internet perangkat Anda.` |
| HTTP error dari backend | Gunakan `message` atau `error` dari response |
| Unknown error | Gunakan fallback sesuai konteks |

Guideline:

- Jangan tampilkan error mentah seperti `TypeError: Network request failed`.
- Gunakan `toUserMessage(err, fallback)` untuk pesan user.
- Gunakan `logError(tag, err)` untuk debug di mode development.
- Untuk aksi penting seperti start/stop sesi, lakukan retry atau verifikasi ulang jika memungkinkan.

## 13. Data Formatting

### Tanggal dan Waktu

Gunakan format `id-ID`.

Contoh:

```js
new Date(value).toLocaleString('id-ID')
```

Guideline:

- Tampilkan waktu relatif di dashboard bila memungkinkan: `Baru saja`, `5 menit lalu`.
- Untuk sesi, tampilkan tanggal mulai dan durasi.
- Durasi sesi dihitung di frontend dan diperbarui tiap 1 detik.

### Angka Sensor

| Data | Format |
| --- | --- |
| WQI | `Math.round(value)` |
| pH | `toFixed(1)` |
| Suhu | `toFixed(1)` |
| TDS | `toFixed(0)` |
| NTU | `toFixed(1)` |

## 14. Design System

Palet utama:

| Token | Warna | Penggunaan |
| --- | --- | --- |
| Primary | `#5AA3C8` | Tombol utama, icon, highlight |
| Primary Dark | `#3E8FB8` | Gradient/header |
| Background | `#F0F7FB` | Background screen |
| Text Dark | `#1A3040` | Judul dan teks utama |
| Muted | `#8BAFC0` | Subtitle dan secondary text |
| Success | `#22C55E` | Connected, success |
| Warning | `#F59E0B` | Warning state |
| Danger | `#E11D48` | Stop session, danger action |

Guideline UI:

- Gunakan rounded card konsisten pada radius 12-16.
- Gunakan icon dari `@expo/vector-icons/Ionicons`.
- Tombol destructive seperti Stop/Hapus memakai merah/rose.
- Tombol utama memakai biru UniFlow.
- Hindari indikator status berulang di banyak card; gunakan satu indikator global bila statusnya mewakili keseluruhan device.
- Teks aplikasi harus formal dan jelas.

## 15. Build dan Validation

Script:

```bash
npm install
npm start
npm run web
npm run build
```

EAS:

```bash
eas build -p android --profile preview
```

Validation checklist:

- `npm run build` sukses.
- `npx expo-doctor` lulus semua check.
- `app.json` valid.
- Asset icon aplikasi berbentuk square.
- `.expo/` tidak tracked oleh Git.
- `dist/` tidak ikut commit kecuali memang dibutuhkan.

## 16. Git dan File Output

File yang sebaiknya tidak di-commit:

- `node_modules/`
- `.expo/`
- `.expo-shared/`
- `dist/`
- `.env`
- file cache lokal

File yang boleh di-commit:

- Source code `components/`, `services/`, `utils/`, `styles/`
- `app.json`
- `app.plugin.js`
- `eas.json`
- `package.json`
- `package-lock.json`
- asset aplikasi yang dipakai
- dokumentasi `.md`

## 17. Rekomendasi Pengembangan

- Pisahkan logic API dari UI component.
- Gunakan helper di `utils/waterQuality.js` untuk mapping sensor.
- Jangan menambahkan dependency baru tanpa kebutuhan jelas.
- Untuk perubahan UI besar, validasi di viewport mobile terlebih dahulu.
- Untuk flow IoT/WiFi, selalu anggap koneksi bisa putus saat ESP32 berpindah jaringan.
- Untuk flow measurement, selalu verifikasi ulang sesi aktif setelah request gagal sebelum menampilkan error final.
- Untuk wording, gunakan Bahasa Indonesia formal dan ringkas.
