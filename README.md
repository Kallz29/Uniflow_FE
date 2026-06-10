<<<<<<< HEAD
# UniFlow - React Native App

Aplikasi mobile monitoring kualitas air untuk universitas dengan React Native dan Expo.

## Fitur

- ✅ Splash Screen dengan animasi logo
- ✅ Dashboard monitoring 4 parameter air (pH, Suhu, Padatan Terlarut, Kekeruhan)
- ✅ Riwayat data lengkap dengan history modal (3 bulan terakhir, ~360 entries)
- ✅ Export/Share data CSV
- ✅ Auto-delete data lama (>3 bulan)
- ✅ Halaman About Us dengan carousel tim (4 orang)
- ✅ Navigasi antar halaman
- ✅ Design sesuai palette warna biru UniFlow
- ✅ Bahasa Indonesia
- ✅ Full JavaScript (tanpa TypeScript)
- ✅ **Styles terpisah di folder `/styles/`**
- ✅ **Data terpisah di folder `/data/`**
- ✅ **Constants terpisah di folder `/constants/`**

## Setup

1. Install dependencies:
```bash
npm install
```

2. Tambahkan gambar team ke folder `assets/`:
   - `team1.jpg` - Anggota tim 1
   - `team2.jpg` - Anggota tim 2
   - `team3.jpg` - Anggota tim 3
   - `team4.jpg` - Anggota tim 4

3. Pastikan file `logo.png` ada di folder `assets/`

4. Jalankan aplikasi:
```bash
npx expo start
```

## Struktur File

### Komponen
- `App.js` - Main app dengan routing
- `components/SplashScreen.js` - Splash screen dengan animasi
- `components/Dashboard.js` - Dashboard monitoring parameter air
- `components/AboutUs.js` - Halaman About Us dengan carousel tim
- `components/StatusCard.js` - Card status kualitas air
- `components/WaterQualityCard.js` - Card parameter individual
- `components/HistoryModal.js` - Modal untuk menampilkan riwayat data

### Data
- `data/teamMembers.js` - Data anggota tim (nama, NIM)

### Styles (StyleSheet terpisah)
- `styles/dashboardStyles.js` - Styles untuk Dashboard
- `styles/aboutUsStyles.js` - Styles untuk About Us
- `styles/statusCardStyles.js` - Styles untuk Status Card
- `styles/waterQualityCardStyles.js` - Styles untuk Water Quality Card
- `styles/historyModalStyles.js` - Styles untuk History Modal
- `styles/splashScreenStyles.js` - Styles untuk Splash Screen

### Constants
- `constants/colors.js` - Color palette dan gradients UniFlow

## Navigasi

- Dashboard: Icon person di kanan atas → About Us
- About Us: Tombol "Kembali" di kiri atas → Dashboard
- Carousel About Us: Swipe horizontal untuk melihat 4 anggota tim
- Klik pada card parameter → Buka History Modal
- Klik pada StatusCard → Buka Overall Quality History

## Data Structure

### Team Members
Setiap anggota tim memiliki:
- `id`: ID unik
- `name`: Nama lengkap
- `role`: Role/jabatan (tidak digunakan di UI)
- `nim`: Nomor Induk Mahasiswa
- `image`: Path ke gambar

### Water Quality Parameters
Setiap parameter memiliki:
- `id`: ID unik
- `title`: Nama parameter
- `value`: Nilai saat ini
- `unit`: Satuan
- `status`: 'good' | 'warning' | 'danger'
- `iconName`: Nama icon dari Ionicons
- `range`: Rentang nilai
- `accuracy`: Akurasi sensor
- `color`: Array warna untuk gradient
- `history`: Array data historis

### History Entry
Setiap entry history memiliki:
- `timestamp`: Tanggal dan waktu
- `value`: Nilai pengukuran
- `unit`: Satuan
- `status`: Status kualitas

## Standar

Sesuai dengan PERMENKES RI No. 32 Tahun 2017 tentang Standar Baku Mutu Kesehatan Lingkungan dan Persyaratan Kesehatan Air.

## Update Data Tim

Edit file `data/teamMembers.js` untuk mengubah data anggota tim:
```javascript
{
  id: 1,
  name: 'Nama Lengkap',
  role: 'Jabatan', // tidak ditampilkan
  nim: '123456789',
  image: require('../assets/team1.jpg'),
}
```
=======
# waterquality-fe
>>>>>>> c591669e7259ec408239467b81df9247ccaa7e6a
