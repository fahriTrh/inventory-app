# 💡 LampuStock — Inventory Manajemen Lampu

Aplikasi inventory barang lampu berbasis web, dibangun dengan Express.js + Supabase, cocok dijalankan dalam WebView Kodular.

---

## 🗂️ Struktur Project

```
inventory-app/
├── server.js               ← Entry point Express
├── supabaseClient.js       ← Koneksi Supabase
├── .env.example            ← Template environment variables
├── routes/
│   ├── products.js         ← CRUD produk
│   ├── stock.js            ← Transaksi stok
│   ├── upload.js           ← Upload gambar ke Supabase Storage
│   └── dashboard.js        ← Summary dashboard
├── public/
│   ├── index.html          ← Halaman utama (SPA)
│   ├── css/style.css       ← Stylesheet
│   └── js/app.js           ← Logic frontend
└── supabase_setup.sql      ← Script SQL untuk setup database
```

---

## ⚙️ Cara Setup

### 1. Setup Supabase

1. Buat akun di [supabase.com](https://supabase.com)
2. Klik **New Project**, isi nama dan password database
3. Tunggu project selesai dibuat (~1 menit)
4. Buka menu **SQL Editor** di sidebar kiri
5. Copy-paste seluruh isi file `supabase_setup.sql` ke editor
6. Klik **Run** — tabel dan storage bucket akan terbuat otomatis

### 2. Ambil Credentials Supabase

1. Di dashboard Supabase, buka **Project Settings → API**
2. Copy **Project URL** (contoh: `https://abcxyz.supabase.co`)
3. Copy **service_role key** (bukan anon key — service_role punya akses penuh)

### 3. Setup Project Lokal

```bash
# Clone atau copy folder project
cd inventory-app

# Install dependencies
npm install

# Buat file .env dari template
cp .env.example .env
```

Edit file `.env`:
```
SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGci...
PORT=3000
```

### 4. Jalankan Server

```bash
# Mode development (auto-restart)
npm run dev

# Mode production
npm start
```

Buka browser: `http://localhost:3000`

---

## 🚀 Deploy ke Railway (Hosting Gratis)

1. Push project ke GitHub
2. Buka [railway.app](https://railway.app), login dengan GitHub
3. Klik **New Project → Deploy from GitHub repo**
4. Pilih repo project ini
5. Tambahkan environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `PORT` = 3000
6. Railway akan otomatis deploy dan kasih URL publik

---

## 📱 Setup Kodular (WebView)

1. Buka [kodular.io](https://kodular.io)
2. Buat project baru
3. Tambahkan komponen **WebViewer** ke screen
4. Set property **HomeURL** ke URL server kamu
   - Lokal (testing via USB): `http://192.168.x.x:3000`
   - Production: URL dari Railway/Render
5. Set **UsesLocation = false**, **FollowLinks = true**
6. Build APK

> **Tips:** Untuk upload foto dari kamera HP di WebView, tambahkan permission `android.permission.CAMERA` dan `android.permission.READ_EXTERNAL_STORAGE` di Kodular manifest.

---

## 📡 API Endpoints

| Method | URL | Fungsi |
|--------|-----|--------|
| GET | `/api/dashboard` | Summary dashboard |
| GET | `/api/products` | List produk (query: search, category) |
| GET | `/api/products/:id` | Detail produk |
| POST | `/api/products` | Tambah produk |
| PUT | `/api/products/:id` | Edit produk |
| DELETE | `/api/products/:id` | Hapus produk |
| GET | `/api/stock` | Riwayat transaksi (query: product_id, limit) |
| POST | `/api/stock` | Tambah transaksi stok |
| POST | `/api/upload/image` | Upload gambar (multipart/form-data, field: image) |
| DELETE | `/api/upload/image` | Hapus gambar (body: { url }) |

---

## 🔑 Catatan Keamanan

- File ini menggunakan `service_role` key Supabase yang punya akses penuh. **Jangan expose key ini di frontend.**
- Untuk produksi dengan multi-user, tambahkan sistem autentikasi (JWT/session) di Express.
- Pertimbangkan rate limiting menggunakan package `express-rate-limit`.
