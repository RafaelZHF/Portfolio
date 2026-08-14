# Rafael L3 — Portofolio Artist

Situs portofolio pribadi untuk **Rafael L3**, remix & produser musik elektronik asal Prawirotaman, Yogyakarta. Dibangun murni dengan HTML, CSS, dan JavaScript (tanpa framework/build step), dengan desain terinspirasi sistem desain [Linear.app](https://linear.app) — dark theme, blur, grid background, dan animasi halus.

## Fitur

- 100% statis — HTML/CSS/JS murni, tidak butuh Node.js atau proses build
- **Seluruh teks website terpusat di satu file** (`assets/js/content.js`) — mengedit kata-kata di halaman tidak perlu menyentuh `index.html`
- Desain gelap ala Linear: warna, tipografi (Inter), radius, shadow, dan gradasi disesuaikan
- Animasi reveal-on-scroll, counter angka, progress bar genre, orbit skill, marquee genre, cursor spotlight
- Navigasi mobile (drawer) + navbar blur saat scroll
- Konten 100% Bahasa Indonesia, ditulis natural (bukan template)
- Responsif penuh: desktop, tablet, mobile

## Struktur folder

```
rafael-l3-portfolio/
├── index.html
├── assets/
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── content.js   ← SEMUA teks website ada di sini
│   │   └── main.js      ← logika & animasi, membaca teks dari content.js
│   ├── audio/           ← efek suara notifikasi widget chat (kirim/terima)
│   └── img/
└── README.md
```

## Cara menjalankan secara lokal

Karena situs ini statis, cukup buka `index.html` langsung di browser, atau jalankan server lokal sederhana:

```bash
# Python
python3 -m http.server 8000

# Node (jika ada)
npx serve .
```

Lalu buka `http://localhost:8000`.

## Cara deploy ke GitHub Pages

1. Buat repository baru di GitHub, misalnya `rafael-l3-portfolio`.
2. Upload seluruh isi folder ini (jangan folder pembungkusnya, langsung isinya: `index.html`, `assets/`, dll) ke repository tersebut.
   ```bash
   git init
   git add .
   git commit -m "Initial commit: portofolio Rafael L3"
   git branch -M main
   git remote add origin https://github.com/USERNAME/rafael-l3-portfolio.git
   git push -u origin main
   ```
3. Di GitHub, buka tab **Settings** → **Pages**.
4. Pada **Source**, pilih branch `main` dan folder `/ (root)`.
5. Klik **Save**. Tunggu 1–2 menit, situs akan aktif di:
   ```
   https://USERNAME.github.io/rafael-l3-portfolio/
   ```

## Kustomisasi

- **Teks & konten**: edit `assets/js/content.js` — **jangan** edit `index.html`. Setiap kalimat di halaman (judul, deskripsi, daftar karya, statistik, footer, dll) ada di file itu, dikelompokkan per section dengan komentar penjelas. Simpan filenya, refresh browser, selesai.
- **Warna**: ubah nilai di `:root` pada `assets/css/style.css` (variabel `--color-*`).
- **Font**: diambil dari Google Fonts (Inter). Jika ingin offline penuh, unduh font-nya dan ganti baris `@import` di awal `style.css`.
- **Email & Instagram**: ubah nilai `email` dan `btnInstagram` di bagian `kontak` pada `assets/js/content.js` (bukan di `index.html`).
- **Statistik angka**: ubah nilai `count` pada array `stats` di bagian `statistik` pada `assets/js/content.js`.
- **Struktur/HTML/CSS**: kalau suatu saat perlu menambah section baru atau mengubah tata letak elemen, itu baru perlu edit `index.html` dan `assets/js/main.js` bersamaan — tapi untuk sekadar ganti kata-kata, cukup `content.js` saja.

## Dashboard Admin

Situs ini punya halaman `/admin` untuk mengedit teks tanpa buka kode langsung.

**Cara kerjanya:**
1. Buka `admin/index.html` (link diskrit juga ada di titik `·` paling ujung footer situs, atau akses langsung `namamu.github.io/repo/admin/`).
2. Login pakai username/password yang tersimpan di Cloudflare Secrets worker kamu (`https://dashboard-key.ffkz946.workers.dev`).
3. Form akan otomatis menampilkan semua field yang ada di `content.js`, dikelompokkan per section, dengan pratinjau ringan di panel kanan.
4. Setelah selesai edit, klik **"Unduh content.js"** — file baru akan ter-download ke komputer kamu.
5. Upload file itu ke repo GitHub (replace `assets/js/content.js`), commit, push. Situs live berubah setelah GitHub Pages selesai build (~1-2 menit).

**Penting — kenapa tidak otomatis tersimpan:** GitHub Pages adalah hosting statis, jadi tidak ada cara aman bagi browser untuk langsung menulis ke repo GitHub tanpa menyimpan token/credential sensitif di sisi client. Alur "edit → unduh → upload manual" ini sengaja dipilih supaya tidak ada token GitHub apa pun yang perlu disimpan di browser publik, dan kamu tetap punya jejak commit history yang jelas tiap kali konten berubah.

**Soal foto:** dashboard ini saat ini baru menangani teks. Portofolio ini sendiri cuma pakai satu foto (`assets/img/stickers.jpg`, avatar widget chat) — untuk menggantinya, replace file itu langsung di repo dengan nama file yang sama.

**Keamanan:** worker sudah dilengkapi rate limiting (5x gagal login → lock 15 menit), perbandingan password constant-time, dan token JWT berumur 24 jam. Token login disimpan di `sessionStorage` browser (bukan `localStorage`), jadi otomatis hilang begitu tab/browser ditutup — cocok untuk dipakai di komputer publik/bersama tanpa risiko sesi "nempel".

## Kredit desain

Struktur visual dan sistem desain terinspirasi dari [Linear.app](https://linear.app). Seluruh konten, copy, dan branding adalah milik Rafael L3.

---

Dibuat dengan ❤️ untuk Rafael L3, Yogyakarta.
