/* ==========================================================================
   Rafael L3 — Shop
   shop-content.js — DEFAULT/FALLBACK katalog produk + logika ambil versi
   terbaru dari Cloudflare Worker (KV), supaya produk yang ditambah/dihapus
   dari Dashboard Admin langsung tampil di halaman /shop/ tanpa commit/push
   manual.

   File ini SENGAJA dipisah dari assets/js/content.js (bukan ditambahkan
   sebagai satu section baru di dalam CONTENT) karena produk disimpan di
   KV KEY TERPISAH ("products", bukan bagian dari "content") — sama seperti
   foto avatar (KV key "photo:avatar") yang juga punya fallback & alur
   fetch sendiri, terpisah dari CONTENT. Lihat worker/src/index.js untuk
   detail endpoint GET/PUT /products.

   ADA DUA SUMBER PRODUK SEKARANG:
   1. Array PRODUCTS di bawah ini — dipakai sebagai FALLBACK. Berguna untuk
      (a) shop pertama kali di-setup sebelum pernah sekali pun ada produk
      ditambahkan dari dashboard, (b) jaga-jaga kalau Worker sedang tidak
      bisa dihubungi (halaman shop tidak boleh kosong/rusak hanya karena
      Worker down).
   2. Cloudflare Worker (endpoint GET /products) — SUMBER UTAMA. Setiap
      kali dashboard menyimpan produk (tambah/hapus), data ini yang
      ter-update. shop/assets/shop.js memanggil RL3_loadRemoteProducts()
      di bawah sebelum merender katalog, supaya versi yang tampil SELALU
      versi Worker kalau berhasil diambil, dan baru jatuh balik ke isi
      default di bawah kalau gagal (network error, Worker down, dsb).

   TIAP PRODUK: { id, name, price, imageUrl }. imageUrl adalah URL
   PUBLIK ke file gambar ASLI (PNG/JPG/JPEG/WEBP/GIF) yang tersimpan di
   Cloudflare R2 (BUKAN base64) — lihat worker/src/index.js
   (handlePostProductImage) dan komentar PRODUCT_IMAGES_BUCKET di
   worker/wrangler.toml untuk detail lengkap kenapa & bagaimana. Nilai
   imageUrl di array PRODUCTS (fallback) di bawah boleh null (tampil
   sebagai ikon placeholder di shop) atau URL gambar publik mana pun —
   BEDA dengan produk yang disimpan lewat dashboard (yang imageUrl-nya
   WAJIB dari hasil upload ke R2 milik situs ini sendiri, divalidasi
   Worker), fallback statis di file ini bebas dari validasi itu karena
   tidak pernah melewati Worker.

   PENTING — beda dengan content.js: kalau Worker berhasil dihubungi tapi
   KV memang belum pernah diisi produk sama sekali (baru pertama kali
   setup), GET /products balas array KOSONG ([]), bukan null. Array kosong
   itu tetap dianggap "berhasil" dan DIPAKAI apa adanya (katalog kosong
   ditampilkan ke pengunjung) — bukan sinyal untuk jatuh ke fallback
   PRODUCTS di bawah. Fallback di bawah hanya dipakai kalau Worker BENAR-
   BENAR tidak bisa dihubungi (network error/timeout/JSON rusak).
   ========================================================================== */

const PRODUCTS = [
  {
    id: 'contoh-001',
    name: 'Sample Pack — Prawirotaman Nights Vol. 1',
    price: 75000,
    imageUrl: null
  }
];

/* ==========================================================================
   AMBIL VERSI TERBARU DARI CLOUDFLARE WORKER
   ------------------------------------------------------------------
   RL3_AUTH_API_BASE HARUS SAMA dengan yang ada di assets/js/content.js
   dan admin/assets/admin.js (satu Worker yang sama menangani /content,
   /photo, DAN /products) — kalau alamat Worker berubah, ganti di
   SEMUA tempat itu, termasuk file ini.

   RL3_loadRemoteProducts() SENGAJA tidak auto-run di sini (tidak ada
   pemanggilan diri sendiri) — shop.js yang memanggilnya di awal
   (sebelum renderProducts()), mengikuti pola yang sama persis dengan
   RL3_loadRemoteContent() di content.js/main.js.
   ========================================================================== */
const RL3_SHOP_AUTH_API_BASE = "https://dashboard-key.ffkz946.workers.dev";

// Batas waktu tunggu fetch /products (ms) sebelum menyerah dan pakai
// fallback default di atas. Sama seperti RL3_REMOTE_FETCH_TIMEOUT_MS di
// content.js — halaman shop tidak boleh menggantung lama hanya karena
// Worker lambat merespons.
const RL3_SHOP_REMOTE_FETCH_TIMEOUT_MS = 4000;

async function RL3_shopFetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { method: "GET", signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Dipanggil sekali oleh shop.js sebelum renderProducts(). Selalu resolve
// dengan sebuah array (tidak pernah reject) — kegagalan apa pun (network,
// timeout, JSON rusak) ditangani sebagai "pakai fallback PRODUCTS", bukan
// error yang perlu ditangkap pemanggil. Array kosong yang BERHASIL diambil
// dari Worker (katalog memang belum ada produk) tetap dibalas apa adanya,
// BUKAN ditimpa fallback — lihat catatan panjang di atas kenapa ini beda
// dengan RL3_loadRemoteContent().
async function RL3_loadRemoteProducts() {
  try {
    const res = await RL3_shopFetchWithTimeout(RL3_SHOP_AUTH_API_BASE + "/products", RL3_SHOP_REMOTE_FETCH_TIMEOUT_MS);
    if (!res.ok) return PRODUCTS.slice(); // Worker membalas error -> diam-diam pakai fallback.

    const data = await res.json();
    if (data && data.success && Array.isArray(data.products)) {
      return data.products;
    }
    return PRODUCTS.slice();
  } catch {
    // Network error / timeout (AbortError) / JSON tidak valid -> diam-diam
    // pakai fallback default. Tidak ditampilkan sebagai error ke
    // pengunjung karena halaman shop tetap berfungsi normal dengan
    // fallback.
    return PRODUCTS.slice();
  }
}
