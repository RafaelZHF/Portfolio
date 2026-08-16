/* ==========================================================================
   Rafael L3 — Shop
   shop.js — seluruh interaksi & penulisan teks/produk ke halaman /shop/.

   File ini mengikuti pola yang sama persis dengan assets/js/main.js di
   situs utama (render dari data, urutan "ambil data dulu baru render",
   skeleton loading, reveal-on-scroll, navbar scroll effect), tapi
   cakupannya lebih sempit karena halaman shop jauh lebih sederhana dari
   index.html (tidak ada hero panel, orbit skill, quote carousel, dst).

   DUA SUMBER DATA di halaman ini:
   1. CONTENT (dari ../assets/js/content.js) — dipakai untuk brand navbar
      & footer, supaya konsisten dengan situs utama kalau kamu ganti nama
      brand/tagline dari dashboard. Struktur & cara ambilnya SAMA PERSIS
      dengan main.js (RL3_loadRemoteContent()).
   2. Produk (dari ../assets/js/shop-content.js, fungsi
      RL3_loadRemoteProducts()) — katalog yang ditampilkan di grid.
   ========================================================================== */

(function () {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------------
     0. Render brand navbar & footer dari CONTENT.
        Link navigasi navbar/footer SENGAJA tidak dirender dari
        CONTENT.navbar.links/CONTENT.footer.columns di sini — lihat
        komentar panjang di shop/index.html soal kenapa (link itu berisi
        anchor section situs utama yang tidak ada di halaman ini).
        Yang dirender dari CONTENT cukup brand text, footer tagline,
        footer copyright, dan footer location — semuanya teks aman yang
        tidak bergantung pada section apa pun.
  ------------------------------------------------------------------ */
  function renderShopChrome() {
    if (typeof CONTENT === 'undefined') {
      console.error('content.js belum di-load sebelum shop.js, atau variabel CONTENT tidak ditemukan.');
      return;
    }

    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };

    setText('navBrandText', CONTENT.navbar.brand);
    setText('footerBrandText', CONTENT.footer.brand);
    setText('footerTagline', CONTENT.footer.tagline);
    setText('footerLocation', CONTENT.footer.location);

    const footerCopyrightEl = document.getElementById('footerCopyright');
    if (footerCopyrightEl) {
      footerCopyrightEl.innerHTML = `© <span id="tahunSekarang">${new Date().getFullYear()}</span> ${CONTENT.footer.copyright}`;
    }

    // Kolom footer dipakai ulang APA ADANYA dari CONTENT.footer.columns —
    // link-link di dalamnya (Tentang, Genre, dst) memang mengarah balik
    // ke index.html utama (anchor #id), bukan ke halaman shop, jadi aman
    // dirender persis seperti di situs utama. Hanya perlu diperbaiki
    // supaya href yang berupa "#..." (anchor situs utama) diarahkan ke
    // ../index.html#... — kalau tidak, dari halaman shop anchor itu akan
    // mencoba scroll ke section yang tidak ada di sini.
    const footerColsEl = document.getElementById('footerCols');
    if (footerColsEl) {
      footerColsEl.innerHTML = CONTENT.footer.columns.map(col => `
        <div class="footer-col">
          <h4>${col.heading}</h4>
          <ul>${col.links.map(l => {
            const href = l.href.startsWith('#') ? '../index.html' + l.href : l.href;
            return `<li><a href="${href}">${l.label}</a></li>`;
          }).join('')}</ul>
        </div>`).join('');
    }
  }

  /* ------------------------------------------------------------------
     1. Render grid produk dari array produk yang sudah diambil (remote
        atau fallback — lihat init() di bawah untuk urutan pemanggilan).
  ------------------------------------------------------------------ */
  const PLACEHOLDER_ICON_SVG = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">
      <path d="M3 7h18l-1.5 12.5a2 2 0 01-2 1.5H6.5a2 2 0 01-2-1.5L3 7z"/>
      <path d="M8 7V5a4 4 0 018 0v2"/>
    </svg>`;

  function formatRupiah(price) {
    const n = Number(price) || 0;
    return 'Rp' + n.toLocaleString('id-ID');
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function renderProducts(products) {
    const gridEl = document.getElementById('productGrid');
    const emptyEl = document.getElementById('shopEmpty');
    if (!gridEl || !emptyEl) return;

    if (!Array.isArray(products) || products.length === 0) {
      gridEl.style.display = 'none';
      gridEl.innerHTML = '';
      emptyEl.style.display = 'block';
      return;
    }

    emptyEl.style.display = 'none';
    gridEl.style.display = 'grid';

    // Produk BELUM bisa diklik (pembayaran belum ada) — kartu sengaja
    // dirender sebagai <div>, bukan <a>, dan diberi badge "Segera" supaya
    // jelas bagi pengunjung ini bukan tombol mati/rusak, melainkan memang
    // belum aktif. Lihat product-card { cursor: default } di shop.css.
    gridEl.innerHTML = products.map((p) => {
      const media = p.imageUrl
        ? `<img alt="${escapeHtml(p.name)}" src="${p.imageUrl}" loading="lazy" />`
        : PLACEHOLDER_ICON_SVG;
      return `
        <div class="product-card reveal">
          <span class="product-card-soon-badge">Segera</span>
          <div class="product-card-media">${media}</div>
          <div class="product-card-body">
            <h3 class="product-card-name">${escapeHtml(p.name)}</h3>
            <p class="product-card-price">${formatRupiah(p.price)}</p>
          </div>
        </div>`;
    }).join('');

    // Kartu produk baru saja ditulis ke DOM lewat innerHTML di atas, jadi
    // belum ter-observe oleh IntersectionObserver reveal-on-scroll (yang
    // di-setup sekali di initRevealObserver() sebelum kartu ini ada).
    // Daftarkan ulang di sini supaya animasi reveal tetap jalan untuk
    // kartu produk juga, bukan cuma header halaman.
    if (revealObserver) {
      gridEl.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));
    } else {
      gridEl.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible'));
    }
  }

  /* ------------------------------------------------------------------
     2. Reveal on scroll (IntersectionObserver) — pola identik main.js.
        Disiapkan sebagai observer yang bisa dipakai ulang (bukan cuma
        sekali jalan saat load), karena kartu produk baru ditambahkan ke
        DOM belakangan (setelah fetch /products selesai) — lihat
        renderProducts() di atas.
  ------------------------------------------------------------------ */
  let revealObserver = null;

  function initRevealObserver() {
    if (!('IntersectionObserver' in window) || prefersReducedMotion) {
      document.querySelectorAll('.reveal, .reveal-stagger').forEach((el) => el.classList.add('is-visible'));
      return;
    }
    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entry.target.classList.toggle('is-visible', entry.isIntersecting);
        });
      },
      { threshold: 0.14, rootMargin: '0px 0px -60px 0px' }
    );
    document.querySelectorAll('.reveal, .reveal-stagger').forEach((el) => revealObserver.observe(el));
  }

  /* ------------------------------------------------------------------
     3. Navbar scroll effect & back-to-top — disalin apa adanya dari
        main.js (perilaku harus identik dengan situs utama).
  ------------------------------------------------------------------ */
  function initNavbarScrollUI() {
    const navbar = document.getElementById('navbar');
    const backToTop = document.getElementById('backToTop');

    function handleScrollUI() {
      const y = window.scrollY;
      if (navbar) navbar.classList.toggle('is-scrolled', y > 12);
      if (backToTop) backToTop.classList.toggle('is-visible', y > 700);
    }
    handleScrollUI();
    window.addEventListener('scroll', handleScrollUI, { passive: true });

    if (backToTop) {
      backToTop.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
      });
    }
  }

  /* ------------------------------------------------------------------
     4. Skeleton loading — pola identik main.js: tunggu window 'load' +
        durasi minimum + data produk selesai diambil, baru lepas skeleton.
  ------------------------------------------------------------------ */
  const SKELETON_MIN_DURATION = prefersReducedMotion ? 0 : 900; // ms
  let hasRevealed = false;

  function revealRealContent() {
    if (hasRevealed) return;
    hasRevealed = true;

    const skeletonLoader = document.getElementById('skeletonLoader');
    const realContentEls = document.querySelectorAll('.real-content');

    document.body.classList.remove('is-loading');
    document.body.style.overflow = '';

    if (skeletonLoader) skeletonLoader.classList.add('is-hidden');
    realContentEls.forEach((el) => el.classList.add('is-revealed'));

    setTimeout(() => {
      if (skeletonLoader) skeletonLoader.style.display = 'none';
    }, 600);

    document.dispatchEvent(new CustomEvent('rl3:content-revealed'));
  }

  /* ------------------------------------------------------------------
     INIT — urutan: render chrome (brand/footer) dari CONTENT, lalu
     ambil produk (remote atau fallback), render grid, baru setup
     reveal observer + navbar scroll, baru lepas skeleton.
  ------------------------------------------------------------------ */
  async function init() {
    renderShopChrome();

    const remoteContentReady =
      typeof RL3_loadRemoteContent === 'function' ? RL3_loadRemoteContent() : Promise.resolve();
    const productsReady =
      typeof RL3_loadRemoteProducts === 'function' ? RL3_loadRemoteProducts() : Promise.resolve([]);

    // RL3_loadRemoteContent() sudah dipanggil oleh content.js/main.js di
    // index.html utama, tapi shop/index.html TIDAK memuat main.js (shop.js
    // sudah mencakup semua yang dibutuhkan halaman ini) — jadi panggilan
    // di sini yang pertama & satu-satunya untuk halaman shop. Setelah
    // remote content diambil (mengisi ulang CONTENT in-place, lihat
    // content.js), render ulang brand/footer supaya memakai versi
    // terbaru, bukan cuma fallback statis yang sempat dirender di atas.
    const [, products] = await Promise.all([remoteContentReady, productsReady]);
    renderShopChrome();
    renderProducts(products);

    initRevealObserver();
    initNavbarScrollUI();

    const windowLoadPromise = new Promise((resolve) => {
      if (document.readyState === 'complete') resolve();
      else window.addEventListener('load', resolve, { once: true });
    });

    await windowLoadPromise;
    setTimeout(revealRealContent, SKELETON_MIN_DURATION);
  }

  // Jaring pengaman: kalau init() entah kenapa macet/gagal total (mis.
  // error tak terduga di salah satu langkah), tetap tampilkan halaman
  // setelah 6 detik alih-alih skeleton menggantung selamanya — pola sama
  // dengan safety net di main.js.
  setTimeout(revealRealContent, 6000);

  init().catch((err) => {
    console.error('shop.js: gagal inisialisasi halaman shop.', err);
    revealRealContent();
  });

})();
