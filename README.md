# YouClip — YouTube → Short-Form Clipper

Ubah satu link YouTube (atau video yang di-upload) menjadi beberapa klip vertikal 9:16
siap-upload untuk TikTok, Reels, dan Shorts — lengkap dengan auto-reframe berbasis wajah,
color grading, watermark brand, dan **subtitle yang di-burn langsung ke video**.

Aplikasi terdiri dari dua bagian:

| Bagian | Teknologi | Lokasi | Port default |
|--------|-----------|--------|--------------|
| Frontend | Next.js 14 (App Router) | `src/` | `3000` |
| Backend  | Express + SQLite | `server/` | `5000` |
| Pemrosesan video/AI | Python + ffmpeg | `scripts/` | — |

---

## 1. Prasyarat (WAJIB untuk hasil klip nyata)

Tanpa dependency di bawah ini, backend tetap berjalan tetapi akan **fallback ke video
contoh** alih-alih memotong video asli. Untuk hasil produksi yang benar, pasang semuanya:

### Node.js
- Node.js 18+ (disarankan 20/22).
- `npm install` di root **dan** di `server/`.

### Python 3 + library
Script pemrosesan dipanggil lewat interpreter Python. Executable dideteksi otomatis
(`python3` → `python`, atau override lewat env `PYTHON_BIN`).

```bash
python3 -m pip install -r scripts/requirements.txt
```

Isi `scripts/requirements.txt`:
- `yt-dlp` — download video + metadata YouTube
- `opencv-python-headless` — deteksi wajah untuk auto-reframe
- `youtube-transcript-api` — ambil transcript untuk pemilihan klip & subtitle sinkron

### ffmpeg / ffprobe
Disediakan otomatis lewat paket npm `ffmpeg-static` dan `ffprobe-static`
(terpasang saat `npm install`). Tidak perlu instalasi sistem terpisah.

### Font watermark (opsional)
Watermark memakai font sistem yang terdeteksi otomatis (DejaVu / Liberation / Noto /
Arial). Untuk memaksa font tertentu, set env `WATERMARK_FONT_FILE=/path/ke/font.ttf`.

### Akses internet
Server harus bisa menjangkau YouTube (untuk yt-dlp & transcript). Di lingkungan
tanpa internet keluar, download akan gagal dan sistem memakai fallback.

---

## 2. Menjalankan

```bash
# 1. Pasang dependency
npm install
(cd server && npm install)
python3 -m pip install -r scripts/requirements.txt

# 2. Jalankan frontend + backend bersamaan (dev)
npm run dev
#   frontend → http://localhost:3000
#   backend  → http://localhost:5000

# atau produksi
npm run build
npm start
```

Login default admin: **username** `admin` / **password** `admin123`
(dibuat otomatis di database saat pertama kali jalan).

---

## 3. Konfigurasi (environment variables)

| Variabel | Default | Keterangan |
|----------|---------|------------|
| `PYTHON_BIN` | auto (`python3`→`python`) | Paksa executable Python tertentu |
| `WATERMARK_FONT_FILE` | auto-detect | Path font `.ttf` untuk watermark |
| `GOOGLE_CLIENT_ID` | `''` | Client ID Google OAuth (opsional; login manual tetap jalan) |
| `NEXT_PUBLIC_API_URL` / `BACKEND_URL` | `http://127.0.0.1:5000` | URL backend yang dipakai frontend |

---

## 4. Cara kerja pipeline (input link YouTube)

1. **`POST /api/clips`** menerima link → simpan sebagai task `processing`.
2. **Metadata** (judul, deskripsi, durasi) diambil via `yt-dlp --dump-json`.
3. **Analisis** (`scripts/analyze_content.py`):
   - Ambil transcript (ID → EN → auto-generated), toleran ke semua versi API.
   - Bangun segmen 25–60 dtk di batas kalimat / jeda intonasi.
   - Skor tiap segmen (**skor viralitas nyata**: densitas kata, kata-hook,
     kelengkapan kalimat, durasi ideal) dan pilih yang terbaik.
   - Hasilkan **timing subtitle per-kata** relatif ke awal klip.
4. **Render** (`server/clipper.js`):
   - Download video (yt-dlp), potong tiap segmen.
   - Crop 9:16 valid untuk semua rasio + auto-reframe wajah (`auto_reframe.py`).
   - Color grade, watermark, **subtitle burned-in (.ass)** memakai timing asli.
   - Encode H.264/AAC, `faststart`, 30fps.
5. Hasil: 5 klip MP4 asli tersaji di dashboard, bisa di-preview & di-download.

> **Fallback aman:** jika langkah mana pun gagal (tanpa internet / tanpa dependency /
> video tanpa transcript), sistem tidak crash — ia memakai pembagian waktu merata dan/atau
> video contoh, sehingga UI tetap berfungsi.

---

## 5. Sumber selain YouTube

Selain link YouTube, `source_video_url` juga bisa berupa URL video langsung
(mis. hasil upload / http(s) `.mp4`) atau file lokal. Pipeline yang sama
(`renderDirectSubclips`) akan dipakai, melewati yt-dlp.

---

## 6. Endpoint utama

| Method | Path | Fungsi |
|--------|------|--------|
| POST | `/api/clips` | Proses link (UI dashboard) |
| GET  | `/api/clips` | Daftar klip user |
| POST | `/v2/tasks/video-to-shorts` | API task video→shorts |
| GET  | `/v2/tasks/:id` | Status & hasil task |
| GET  | `/api/download` | Proxy download klip |
| GET  | `/player/:project_id` | Halaman preview klip |

Autentikasi: header `Authorization: Bearer <api-key>`, `x-api-key`, atau `user-id`.
