# AI Assistant Customization Guide

Panduan ini berlaku untuk implementasi AI Assistant terbaru di folder root proyek `Uniflow_FE`.

## Mengubah Teks Awal

Teks sapaan berada di `components/AIAssistant.js`:

```js
const GREETING = 'Halo! Saya asisten AI UniFlow...';
const GREETING_SHORT = 'Halo! Ada yang bisa saya bantu?';
```

Gunakan `GREETING` untuk sesi pertama yang panjang dan `GREETING_SHORT` untuk sesi baru atau sesi kosong.

## Mengubah Suggested Questions

Suggested questions berada di konstanta `SUGGESTED`:

```js
const SUGGESTED = [
  'Apa standar pH air minum yang aman?',
  'Berapa suhu air yang ideal?',
  'Apa itu TDS dan berapa batas amannya?',
  'Bagaimana cara mengukur kekeruhan air?',
];
```

Rekomendasi:

- Maksimal 4-6 pertanyaan agar layar tetap rapi.
- Gunakan pertanyaan singkat.
- Topik sebaiknya tetap berhubungan dengan kualitas air, parameter sensor, WQI, atau penggunaan UniFlow.

## Mengubah Tampilan

Style AI Assistant berada di:

```txt
styles/aiAssistantStyles.js
```

Bagian yang umum diubah:

| Style | Fungsi |
| --- | --- |
| `header` | Area judul atas |
| `messages` | Area scroll pesan |
| `bubble` | Base style bubble pesan |
| `bubbleUser` | Bubble pesan user |
| `bubbleAI` | Bubble pesan AI |
| `inputBar` | Area input bawah |
| `drawer` | Drawer riwayat chat |
| `sessionItem` | Item sesi di drawer |

Gunakan warna dari `constants/colors.js` bila memungkinkan agar konsisten dengan UniFlow.

## Mengubah Integrasi Backend

Endpoint chat didefinisikan di `services/api.js`:

```js
createChatSession(title)
getAllChatSessions()
updateChatSession(sessionId, title)
getChatMessages(sessionId)
sendChatMessage(sessionId, message)
deleteChatSession(sessionId)
```

Jika backend berubah:

- Ubah path endpoint di `services/api.js`.
- Ubah parsing respons AI di `handleSend`.
- Ubah mapping pesan di `loadMessagesForSession`.
- Pertahankan error handling melalui `toUserMessage` dan `logError`.

## Mengubah Batas Input

Batas input ada pada `TextInput`:

```js
maxLength={500}
```

Jika dinaikkan, pastikan backend juga menerima panjang pesan yang sama.

## Mengubah Judul Sesi Otomatis

Judul sesi dibuat dari pesan pertama user dengan helper:

```js
const buildTitle = (text) => {
  const trimmed = text.trim();
  return trimmed.length > 40 ? trimmed.slice(0, 40).trimEnd() + '...' : trimmed;
};
```

Ubah angka `40` jika ingin judul lebih panjang atau lebih pendek.

## Troubleshooting

### Sesi tidak muncul

- Pastikan backend `/chat/sessions` aktif.
- Periksa `BASE_URL` di `config.js`.
- Cek log dari `AIAssistant.initSession`.

### Pesan tidak terkirim

- Pastikan endpoint `POST /chat/sessions/:id/messages` mengembalikan `content`, `ai_response`, `data.content`, atau `data.ai_response`.
- Periksa timeout dan koneksi internet.

### Riwayat tidak update

- Pastikan `refreshHistory()` dipanggil setelah kirim, buat sesi, atau hapus sesi.
- Pastikan backend mengurutkan sesi terbaru di awal list.

### Timestamp tidak sesuai

- Timestamp diparse dengan `parseLocalDate` dari `utils/waterQuality.js`.
- Pastikan backend mengirim `created_at` yang konsisten.

## Validasi

Jalankan:

```bash
npm run build
```

Lalu uji manual:

- Buka AI Assistant.
- Kirim pesan pertama.
- Pastikan judul sesi berubah.
- Buat sesi baru.
- Hapus sesi.
- Tutup dan buka ulang aplikasi untuk memastikan riwayat termuat.
