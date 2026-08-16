/* ==========================================================================
   Rafael L3 — Portfolio
   scroll-fx.js — lapisan pemanis efek scroll.

   File ini SENGAJA dipisah dari main.js. main.js sudah punya reveal-on-scroll
   dasar (fade + translate) dan itu tidak diubah. File ini menambah tiga hal
   di atasnya, semuanya independen dan bisa dihapus tanpa mematahkan apa pun:

     1. Momentum smooth-scroll — scroll fisik (wheel/trackpad/swipe) tidak
        langsung "melompat" mengikuti native scroll, tapi diinterpolasi
        (lerp) tiap frame, jadi terasa berat & licin ala Linear.app / Lenis.
     2. Progress bar tipis di bawah navbar — menunjukkan seberapa jauh
        pengunjung sudah scroll halaman.
     3. Parallax halus di elemen dekoratif (panel hero, glow, chapter
        number) — bikin kesan depth ringan tanpa mengorbankan performa.

   Semua fitur mati total kalau prefers-reduced-motion aktif, dan momentum
   scroll otomatis mati di perangkat sentuh (mobile/tablet) karena native
   touch-scroll di HP sudah smooth secara default & momentum buatan lewat
   JS di touch device justru terasa "melawan jari" alih-alih membantu.
   ========================================================================== */

(function () {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouchDevice = window.matchMedia('(hover: none), (pointer: coarse)').matches;

  /* ------------------------------------------------------------------
     0. Progress bar scroll — jalan di semua perangkat, ringan.
  ------------------------------------------------------------------ */
  function initScrollProgress() {
    const wrap = document.createElement('div');
    wrap.className = 'scroll-progress';
    wrap.setAttribute('aria-hidden', 'true');
    const bar = document.createElement('div');
    bar.className = 'scroll-progress-bar';
    wrap.appendChild(bar);
    document.body.appendChild(wrap);

    let ticking = false;

    function update() {
      ticking = false;
      const doc = document.documentElement;
      const scrollTop = doc.scrollTop || document.body.scrollTop;
      const scrollHeight = (doc.scrollHeight || document.body.scrollHeight) - doc.clientHeight;
      const progress = scrollHeight > 0 ? Math.min(1, Math.max(0, scrollTop / scrollHeight)) : 0;
      bar.style.width = (progress * 100).toFixed(2) + '%';
    }

    function onScroll() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return { getElement: () => bar };
  }

  /* ------------------------------------------------------------------
     1. Momentum smooth-scroll (lerp-based, via wheel interception)

        PENTING soal desain ini: posisi scroll SEBENARNYA (window.scrollY)
        tetap satu-satunya sumber kebenaran — kita tidak pernah mengunci
        overflow dokumen atau membungkus body dalam elemen transform.
        Pendekatan itu (umum di beberapa library) berisiko: kalau
        listener wheel gagal attach karena alasan apa pun, scroll bisa
        mati total karena overflow-nya sudah dikunci duluan. Di sini,
        kalau initMomentumScroll() gagal atau tidak berjalan, scroll
        NATIVE tetap 100% berfungsi seperti biasa — tidak ada risiko.

        Cara kerjanya: event wheel di-intercept (preventDefault), delta-
        nya diakumulasi ke variabel `target`. Tiap frame, `current`
        di-lerp mendekati `target`, lalu diterapkan lewat native
        `window.scrollTo(0, current)`. Jadi yang bergerak halus adalah
        posisi scroll SUNGGUHAN, bukan transform kosmetik — scrollbar,
        anchor link, tombol back-to-top, keyboard (PageDown/spasi/arrow),
        dan assistive tech semuanya tetap bekerja normal karena mereka
        semua pada akhirnya juga cuma memanggil/membaca window.scrollY.
  ------------------------------------------------------------------ */
  function initMomentumScroll() {
    if (prefersReducedMotion || isTouchDevice) return null;
    if (!('requestAnimationFrame' in window)) return null;

    const html = document.documentElement;

    function getMaxScroll() {
      return Math.max(0, html.scrollHeight - window.innerHeight);
    }

    // Halaman terlalu pendek untuk momentum-scroll berguna — biarkan
    // native scroll biasa saja.
    if (getMaxScroll() < window.innerHeight * 0.5) return null;

    let current = window.scrollY;
    let target = window.scrollY;
    let rafId = null;
    let isAnimating = false;

    function clampTarget() {
      target = Math.min(getMaxScroll(), Math.max(0, target));
    }

    function applyScroll(y) {
      // PENTING: project ini punya `scroll-behavior: smooth` secara
      // global di CSS (untuk anchor link biasa). Kalau dipanggil tanpa
      // opsi eksplisit, window.scrollTo(0, y) akan ikut memicu animasi
      // smooth-scroll BAWAAN BROWSER pada tiap panggilan — dan karena
      // kita memanggilnya tiap frame (~60x/detik) dengan target yang
      // selalu berubah, animasi bawaan itu tidak pernah sempat selesai
      // bergerak (saling menimpa satu sama lain setiap 16ms), sehingga
      // secara efektif scroll terlihat macet/tidak berpindah sama
      // sekali. `behavior: 'instant'` memastikan tiap panggilan
      // langsung menempatkan posisi tanpa animasi tambahan dari
      // browser — kehalusan geraknya sudah sepenuhnya berasal dari
      // interpolasi lerp kita sendiri di tick(), jadi ini tetap terasa
      // smooth, hanya saja "smooth"-nya kita yang kendalikan.
      window.scrollTo({ top: y, left: 0, behavior: 'instant' });
    }

    function tick() {
      const diff = target - current;

      if (Math.abs(diff) < 0.4) {
        current = target;
        applyScroll(current);
        isAnimating = false;
        rafId = null;
        return; // berhenti nge-loop kalau sudah settle, hemat CPU/baterai
      }

      // Faktor lerp kecil = kesan "berat/momentum" ala Linear.app,
      // tapi cukup besar supaya tetap terasa responsif (bukan lag).
      current += diff * 0.11;
      applyScroll(current);
      rafId = requestAnimationFrame(tick);
    }

    function ensureLoop() {
      if (!isAnimating) {
        isAnimating = true;
        rafId = requestAnimationFrame(tick);
      }
    }

    function onWheel(e) {
      // Biarkan pintasan browser (Ctrl+scroll untuk zoom, dsb) apa adanya.
      if (e.ctrlKey || e.metaKey) return;

      // Kalau event wheel terjadi di dalam elemen yang punya scroll
      // sendiri (mis. quote carousel yang bisa digeser horizontal),
      // biarkan elemen itu yang menangani — jangan rebut wheel-nya.
      const scrollableAncestor = e.target.closest('[data-own-scroll]');
      if (scrollableAncestor) return;

      e.preventDefault();

      // deltaMode 1 = baris (umumnya Firefox), dikalikan agar sebanding
      // dengan deltaMode 0 (pixel, Chrome/Safari default).
      const multiplier = e.deltaMode === 1 ? 18 : 1;
      target += e.deltaY * multiplier;
      clampTarget();
      ensureLoop();
    }

    // Kalau scroll terjadi lewat jalur LAIN yang bukan wheel kita
    // (keyboard PageDown/Home/End/arrow, klik-drag scrollbar, atau
    // window.scrollTo() programmatic dari anchor-link/back-to-top di
    // main.js), sinkronkan current & target ke posisi itu supaya wheel
    // berikutnya melanjutkan dari sana, bukan "menarik balik" ke posisi
    // lama yang sudah tidak relevan.
    //
    // Cara membedakannya BUKAN lewat jendela waktu (mis. "abaikan
    // event scroll dalam 50ms setelah kita memanggil scrollTo()") —
    // itu rapuh, karena event 'scroll' browser tidak selalu dispatch
    // sinkron persis setelah scrollTo() dipanggil, kadang telat
    // beberapa puluh ms terutama saat rAF loop sedang padat. Sebagai
    // gantinya, kita bandingkan posisi: kalau window.scrollY saat ini
    // masih dekat dengan `current` (posisi terakhir yang KITA set
    // sendiri), event ini pasti gema dari applyScroll() kita —
    // toleransi 2.5px menampung pembulatan sub-pixel browser & jitter
    // wajar saat lerp mendekati titik henti. Kalau selisihnya jauh
    // lebih besar dari itu, scroll ini genuinely datang dari luar
    // (keyboard/scrollbar/kode lain).
    function onNativeScroll() {
      if (Math.abs(window.scrollY - current) < 2.5) return;
      current = window.scrollY;
      target = window.scrollY;
    }

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('scroll', onNativeScroll, { passive: true });
    window.addEventListener('resize', clampTarget, { passive: true });

    return {
      destroy() {
        window.removeEventListener('wheel', onWheel);
        window.removeEventListener('scroll', onNativeScroll);
        window.removeEventListener('resize', clampTarget);
        if (rafId) cancelAnimationFrame(rafId);
      },
    };
  }

  /* ------------------------------------------------------------------
     2. Parallax halus untuk elemen dekoratif

        Dihitung dari posisi tiap elemen relatif terhadap viewport
        (bukan posisi scroll absolut), jadi tetap benar di semua
        section, tidak cuma di hero. Pergerakannya sangat kecil
        (maks ~24px) — cukup untuk memberi kesan depth, tidak
        sampai mengganggu keterbacaan atau terasa norak.
  ------------------------------------------------------------------ */
  function initParallax() {
    if (prefersReducedMotion) return;

    const targets = [];

    // .hero-panel-glow sudah punya `transform: translateX(-50%)` bawaan
    // di style.css (untuk centering horizontal) — kalau JS menimpa
    // style.transform langsung, centering itu akan hilang. Jadi
    // gerakan parallax-nya digabung lewat CSS custom property
    // (--parallax-y) yang dipakai di dalam transform, bukan menimpa.
    const glow = document.querySelector('.hero-panel-glow');
    if (glow) {
      glow.style.transform = 'translateX(-50%) translate3d(0, var(--parallax-y, 0px), 0)';
      targets.push({ el: glow, strength: 0.12, useVar: true });
    }

    // .hero-panel (card "Sesi Produksi") SENGAJA tidak dijadikan target
    // parallax di sini — panel ini harus diam total dari awal, tidak
    // ikut translate3d saat scroll.

    // Nomor bab besar ("01", "02", dst) — gerak sedikit lebih lambat
    // dari konten di sekitarnya, kesan depth ala majalah editorial.
    document.querySelectorAll('.chapter-num').forEach((el) => {
      targets.push({ el, strength: 0.06 });
    });

    if (!targets.length) return;

    targets.forEach((t) => t.el.classList.add('parallax-layer'));

    let ticking = false;
    const viewportH = () => window.innerHeight || document.documentElement.clientHeight;

    function update() {
      ticking = false;
      const vh = viewportH();
      targets.forEach((t) => {
        const rect = t.el.getBoundingClientRect();
        // Posisi elemen relatif terhadap tengah viewport, dinormalisasi
        // ke rentang kira-kira [-1, 1] saat elemen melintasi layar.
        const centerOffset = (rect.top + rect.height / 2) - vh / 2;
        const translate = (centerOffset * t.strength * -1).toFixed(2);
        if (t.useVar) {
          t.el.style.setProperty('--parallax-y', `${translate}px`);
        } else {
          t.el.style.transform = `translate3d(0, ${translate}px, 0)`;
        }
      });
    }

    function onScroll() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
  }

  /* ------------------------------------------------------------------
     Init — ditunda sampai skeleton loader di main.js benar-benar selesai
     (event 'rl3:content-revealed', dipancarkan dari revealRealContent()
     di main.js). Ini penting: selama skeleton tampil, body punya
     overflow:hidden (lihat body.is-loading di style.css) sehingga
     window.scrollY selalu 0 — kalau momentum-scroll dipasang lebih awal,
     tinggi wrapper akan terukur di kondisi yang belum final. Menunggu
     event ini memastikan scroll-fx baru aktif setelah halaman benar-benar
     bisa discroll & kontennya sudah lengkap.

     Jaring pengaman: kalau main.js entah kenapa tidak pernah memancarkan
     event itu (mis. skrip lain gagal load), tetap init setelah window
     'load' + jeda wajar, supaya efek scroll tidak hilang selamanya.
  ------------------------------------------------------------------ */
  let initialized = false;
  function init() {
    if (initialized) return;
    initialized = true;
    initScrollProgress();
    initMomentumScroll();
    initParallax();
  }

  document.addEventListener('rl3:content-revealed', init, { once: true });

  window.addEventListener('load', () => {
    setTimeout(init, 4200); // sedikit lebih lama dari jaring-pengaman main.js (4000ms)
  });
})();
