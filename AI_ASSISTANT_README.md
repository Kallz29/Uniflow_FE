# UniFlow AI Assistant

Dokumen ini menjelaskan implementasi AI Assistant terbaru di UniFlow Mobile. AI Assistant sekarang memakai backend chat session, bukan lagi respons lokal berbasis keyword.

## File Terkait

| Path | Fungsi |
| --- | --- |
| `components/AIAssistant.js` | UI chat, drawer riwayat, sesi baru, hapus sesi, kirim pesan |
| `styles/aiAssistantStyles.js` | Style khusus AI Assistant |
| `services/api.js` | Endpoint chat session dan message |
| `utils/errorHandler.js` | Normalisasi pesan error untuk UI |
| `utils/waterQuality.js` | `parseLocalDate` untuk timestamp chat |
| `App.js` | Routing screen `ai-assistant` |

## Fitur

- Membuat sesi chat baru otomatis jika belum ada sesi.
- Memuat sesi terakhir saat halaman dibuka.
- Drawer riwayat chat.
- Buat chat baru.
- Hapus sesi dengan modal konfirmasi.
- Auto-scroll ke pesan terbaru.
- Suggested questions saat percakapan masih kosong.
- Batas input 500 karakter.
- Loading indicator saat menunggu respons AI.
- Error ditampilkan sebagai pesan ramah, bukan stack trace.
- Judul sesi otomatis diperbarui dari pesan pertama user.
- Markdown sederhana dari respons AI dibersihkan sebelum tampil di bubble.

## Endpoint Backend

| Method | Endpoint | Fungsi |
| --- | --- | --- |
| `POST` | `/chat/sessions` | Membuat sesi chat |
| `GET` | `/chat/sessions` | Mengambil daftar sesi |
| `PATCH` | `/chat/sessions/:id` | Update judul sesi |
| `PUT` | `/chat/sessions/:id` | Fallback update judul bila PATCH tidak tersedia |
| `GET` | `/chat/sessions/:id/messages` | Mengambil pesan sesi |
| `POST` | `/chat/sessions/:id/messages` | Mengirim pesan user dan menerima respons AI |
| `DELETE` | `/chat/sessions/:id` | Menghapus sesi |

Semua endpoint diakses melalui `services/api.js` dan `utils/apiClient.js`.

## Alur Saat Halaman Dibuka

1. `AIAssistant` memanggil `getAllChatSessions()`.
2. Jika ada sesi, aplikasi memuat pesan dari sesi terbaru.
3. Jika belum ada sesi, aplikasi membuat `Sesi Baru`.
4. Jika request gagal, tampil layar error dengan tombol `Coba Lagi` dan `Kembali`.

## Alur Kirim Pesan

1. User mengisi input dan menekan tombol kirim.
2. Pesan user langsung ditambahkan ke UI.
3. `sendChatMessage(sessionId, userText)` dipanggil ke backend.
4. Respons AI ditambahkan ke UI setelah markdown sederhana dibersihkan.
5. Jika pesan tersebut adalah pesan pertama, judul sesi diperbarui dari isi pesan user.
6. Riwayat sesi direfresh.

## State Penting

| State | Fungsi |
| --- | --- |
| `messages` | Daftar pesan yang sedang tampil |
| `inputText` | Isi input user |
| `isTyping` | Loading indicator respons AI |
| `drawerOpen` | Status drawer riwayat |
| `chatHistory` | Daftar sesi di drawer |
| `currentSessionId` | Sesi aktif |
| `isFirstMessage` | Penanda untuk update judul sesi |
| `loadingSession` | Loading saat inisialisasi |
| `sessionError` | Error saat memuat sesi |
| `deleteTarget` | Target sesi yang akan dihapus |

## Konvensi UI

- Pesan user berada di kanan.
- Pesan AI berada di kiri dengan avatar kecil.
- Header memakai judul `UniFlow AI`.
- Drawer menampilkan daftar `Riwayat Chat`.
- Tombol `+ Baru` membuat sesi baru.
- Tombol hapus sesi harus menampilkan konfirmasi.
- Gunakan Bahasa Indonesia formal dan ringkas.

## Error Handling

Gunakan helper berikut:

```js
import { toUserMessage, logError } from '../utils/errorHandler';
```

Prinsip:

- Jangan tampilkan error mentah dari fetch.
- Log error dengan tag yang jelas untuk debugging.
- Tampilkan pesan fallback yang mudah dipahami user.
- Timeout pengiriman pesan AI diset lebih panjang di `sendChatMessage`, yaitu 45 detik.

## Suggested Questions

Daftar pertanyaan awal ada di konstanta `SUGGESTED` pada `components/AIAssistant.js`.

Saat menambah pertanyaan:

- Gunakan Bahasa Indonesia.
- Fokus pada kualitas air, WQI, pH, suhu, TDS, kekeruhan, PERMENKES, atau cara penggunaan UniFlow.
- Hindari teks terlalu panjang agar pill tetap rapi di layar mobile.

## Catatan Pengembangan

- Jangan mengembalikan AI Assistant ke mode mock keyword kecuali untuk kebutuhan demo offline yang eksplisit.
- Jangan memanggil `fetch` langsung dari komponen; tambahkan wrapper di `services/api.js`.
- Jika format respons backend berubah, update parsing di `handleSend`.
- Jika format pesan backend berubah, update `loadMessagesForSession`.
- Jika backend belum mendukung `PATCH`, `updateChatSession` sudah punya fallback ke `PUT`.
