/* ==========================================================================
   Rafael L3 — Portfolio
   bg-constellation.js — lapisan latar rasi bintang yang hidup & animatif.

   File ini SENGAJA berdiri sendiri, terpisah dari main.js dan scroll-fx.js.
   Tidak menyentuh logika di file lain, tidak mengubah teks (semua teks tetap
   dari content.js), dan bisa dihapus kapan saja (tinggal buang <script> tag-nya
   di index.html) tanpa mematahkan bagian portofolio yang lain.

   Yang dikerjakan file ini:
     1. Menggambar titik-titik bintang tersebar acak di seluruh layar,
        masing-masing berkedip (twinkle) dengan ritme sendiri-sendiri —
        supaya latar terasa "bernapas", bukan statis.
     2. Dari waktu ke waktu, salah satu dari 12 pola rasi ZODIAK (Aries,
        Taurus, Gemini, Cancer, Leo, Virgo, Libra, Scorpio, Sagittarius,
        Capricorn, Aquarius, Pisces — bentuk garis mengikuti pola rasi
        bintang aslinya, bukan garis acak) dipilih ACAK, ditempatkan di
        posisi ACAK di layar, lalu garis-garis penghubungnya digambar
        SENDIRI secara bertahap dengan kurva easing yang halus (bukan
        kecepatan konstan) — efek "menyambung sendiri" yang terasa
        natural, bukan mekanis. Setelah pola selesai terbentuk, ada jeda
        singkat lalu muncul efek GLOW aesthetic di seluruh garis & titik
        simpulnya, glow itu memuncak lalu meredup, ada jeda singkat lagi,
        baru rasi itu memudar (fade out) sepenuhnya. Siklus lalu lanjut
        ke rasi lain (acak lagi, boleh berulang — memang diminta "random"),
        dengan jeda antar-rasi yang singkat supaya ritme terasa hidup,
        tidak membosankan.
     3. Seluruh lapisan ini bereaksi lembut ke posisi kursor (parallax
        ringan) — ini yang dimaksud "reflektif": langit terasa merespons,
        bukan cuma dekorasi mati.

   Digambar di <canvas>, bukan elemen DOM per titik, karena titiknya banyak
   dan terus bergerak tiap frame — canvas jauh lebih ringan untuk kasus ini
   dan tidak akan membebani reveal-on-scroll / animasi lain yang sudah ada.

   Otomatis nonaktif total kalau prefers-reduced-motion aktif (titik-titik
   tetap digambar diam, tanpa kedip/animasi rasi), mengikuti prinsip
   aksesibilitas yang sama dengan main.js & scroll-fx.js.
   ========================================================================== */

(function () {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------------
     0. Siapkan elemen <canvas>, disisipkan di dalam .bg-layer yang
        sudah ada (di antara .bg-grid dan .bg-glow), supaya ikut
        tercakup dalam lapisan latar fixed yang sudah dirancang di
        style.css — tidak perlu bikin sistem posisi baru.
  ------------------------------------------------------------------ */
  const bgLayer = document.querySelector('.bg-layer');
  if (!bgLayer) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'bg-constellation';
  canvas.setAttribute('aria-hidden', 'true');
  const glowEl = bgLayer.querySelector('.bg-glow');
  if (glowEl) {
    bgLayer.insertBefore(canvas, glowEl);
  } else {
    bgLayer.appendChild(canvas);
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  /* ------------------------------------------------------------------
     1. Pola 12 rasi ZODIAK, dari Aries s/d Pisces (urutan zodiak asli).
        Koordinat dalam skala 0–1 (relatif terhadap kotak pola sendiri),
        supaya gampang di-scale & ditempatkan di posisi acak layar.

        PENTING: titik & garis di bawah ini mengikuti bentuk asterism
        rasi bintang yang sesungguhnya (pola bintang terang & garis
        hubung yang dikenal umum untuk tiap zodiak), disederhanakan
        secukupnya supaya tetap ringan digambar & tetap terbaca sebagai
        siluet rasi tersebut — bukan garis acak yang cuma "nyambung-
        nyambung" tanpa bentuk.
  ------------------------------------------------------------------ */
  const CONSTELLATIONS = [
    {
      // Aries: rasi kecil, 4 bintang utama (Hamal → Sheratan → Mesarthim
      // → 41 Arietis) membentuk garis melengkung yang jelas menekuk
      // seperti kail/tanduk domba — titik tengah ditarik naik supaya
      // lekukannya kebaca, bukan garis lurus datar.
      name: 'Aries',
      points: [[0.08,0.70],[0.34,0.62],[0.56,0.66],[0.80,0.34],[0.96,0.08]],
      lines: [[0,1],[1,2],[2,3],[3,4]]
    },
    {
      // Taurus: segitiga Hyades sebagai kepala banteng (dgn Aldebaran
      // di sudut kanan sebagai "mata merah"), dua tanduk panjang
      // melengkung simetris ke atas dari kedua sudut atas kepala —
      // siluet kepala banteng bertanduk yang jadi ciri khas Taurus.
      name: 'Taurus',
      points: [[0.32,0.56],[0.50,0.48],[0.46,0.70],[0.20,0.74],[0.62,0.30],[0.74,0.08],[0.22,0.32],[0.06,0.10]],
      lines: [[0,1],[1,2],[2,0],[0,3],[1,4],[4,5],[0,6],[6,7]]
    },
    {
      // Gemini: dua garis kepala-ke-kaki paralel untuk Castor & Pollux
      // (si kembar), disambung beberapa "rusuk" horizontal seperti
      // tangga — asterism Gemini yang paling dikenal umum.
      name: 'Gemini',
      points: [[0.18,0.06],[0.60,0.14],[0.20,0.30],[0.56,0.34],[0.24,0.54],[0.54,0.56],[0.30,0.76],[0.52,0.78],[0.34,0.96],[0.50,0.96]],
      lines: [[0,2],[1,3],[2,3],[2,4],[3,5],[4,5],[4,6],[5,7],[6,7],[6,8],[7,9]]
    },
    {
      // Cancer: rasi paling redup di zodiak, siluetnya memang tipis —
      // bentuk Y terbalik sederhana dari 3 lengan pendek bertemu di
      // pusat (mendekati posisi gugus M44/Beehive di tengah).
      name: 'Cancer',
      points: [[0.50,0.10],[0.48,0.42],[0.22,0.62],[0.10,0.88],[0.78,0.60],[0.90,0.86]],
      lines: [[0,1],[1,2],[2,3],[1,4],[4,5]]
    },
    {
      // Leo: "sickle" (sabit, seperti tanda tanya terbalik) untuk
      // kepala-dada singa, berujung di Regulus, lalu segitiga badan-
      // ekor menyambung dari Regulus ke Denebola — bentuk singa
      // berbaring yang jadi ciri khas paling dikenal di langit.
      name: 'Leo',
      points: [[0.10,0.46],[0.12,0.28],[0.24,0.14],[0.40,0.12],[0.46,0.28],[0.34,0.40],[0.46,0.28],[0.66,0.32],[0.86,0.30],[0.96,0.50],[0.70,0.62],[0.46,0.28]],
      lines: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,0],[4,7],[7,8],[8,9],[9,10],[10,7]]
    },
    {
      // Virgo: figur memanjang berbentuk "Y" besar / layang-layang,
      // dengan Spica (bintang paling terang) di ujung bawah — pola
      // umum yang dipakai untuk menggambarkan sosok Virgo.
      name: 'Virgo',
      points: [[0.14,0.10],[0.30,0.24],[0.24,0.44],[0.40,0.36],[0.56,0.46],[0.50,0.28],[0.66,0.16],[0.78,0.32],[0.68,0.52],[0.80,0.70],[0.72,0.92]],
      lines: [[0,1],[1,2],[1,3],[3,4],[3,5],[5,6],[6,7],[7,8],[4,8],[8,9],[9,10]]
    },
    {
      // Libra: rasi paling sederhana di zodiak (satu-satunya berbentuk
      // benda mati) — 4 bintang utama membentuk layang-layang tipis
      // yang merepresentasikan lengan & alas timbangan.
      name: 'Libra',
      points: [[0.50,0.12],[0.16,0.52],[0.84,0.46],[0.44,0.62],[0.58,0.90]],
      lines: [[0,1],[0,2],[1,3],[2,3],[3,4]]
    },
    {
      // Scorpio: salah satu rasi paling ikonik & mudah dikenali — kepala
      // (3 bintang melengkung: Beta/Delta/Pi Scorpii) menyambung lewat
      // Antares (jantung merah), lalu tubuh melengkung panjang turun
      // dan menekuk naik lagi ke sengat ekor (Shaula) — huruf "J" khas.
      name: 'Scorpio',
      points: [[0.08,0.10],[0.20,0.04],[0.30,0.12],[0.28,0.24],[0.36,0.34],[0.42,0.48],[0.46,0.62],[0.54,0.74],[0.66,0.82],[0.80,0.80],[0.90,0.68],[0.88,0.54]],
      lines: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11]]
    },
    {
      // Sagittarius: pola "Teapot" — badan pentagon rapat (tutup,
      // dua sisi, alas) dengan cerat menonjol ke kiri dan pegangan
      // menonjol ke kanan, persis siluet poci teh yang jadi asterism
      // paling terkenal & mudah dikenali untuk Sagittarius.
      name: 'Sagittarius',
      points: [[0.10,0.42],[0.30,0.30],[0.30,0.14],[0.52,0.10],[0.66,0.24],[0.64,0.42],[0.46,0.50],[0.30,0.46],[0.48,0.66],[0.42,0.84],[0.62,0.60],[0.82,0.56],[0.90,0.40],[0.78,0.28]],
      lines: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,1],[6,7],[1,0],[6,8],[8,9],[5,10],[10,11],[11,12],[12,13],[13,4]]
    },
    {
      // Capricorn: satu alur "perahu" terbuka & menyatu — sisi atas
      // panjang menurun landai dari puncak sempit (kepala kambing) di
      // kiri sampai ke ujung ekor ikan di kanan, lalu sisi bawah
      // menutup baliknya kembali ke puncak — digambar sebagai SATU
      // loop sederhana tanpa cabang yang saling silang, supaya siluet
      // huruf V lebar terbuka khas Capricorn terlihat bersih & jelas.
      name: 'Capricorn',
      points: [[0.04,0.34],[0.20,0.18],[0.38,0.24],[0.54,0.14],[0.72,0.24],[0.90,0.40],[0.96,0.60],[0.80,0.72],[0.60,0.62],[0.44,0.70],[0.28,0.58],[0.14,0.50]],
      lines: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11],[11,0]]
    },
    {
      // Aquarius: alur "Y" mengalir dari sosok penuang air (Sadalmelik
      // di pundak) turun bercabang seperti aliran sungai kecil — pola
      // ini yang paling umum dipakai untuk merepresentasikan Aquarius.
      name: 'Aquarius',
      points: [[0.54,0.06],[0.50,0.24],[0.32,0.34],[0.66,0.32],[0.20,0.48],[0.40,0.50],[0.62,0.48],[0.80,0.42],[0.14,0.68],[0.32,0.72],[0.50,0.76],[0.70,0.68],[0.88,0.62]],
      lines: [[0,1],[1,2],[1,3],[2,4],[2,5],[3,6],[3,7],[4,8],[5,9],[6,10],[7,11],[7,12]]
    },
    {
      // Pisces: dua "tali" bintang panjang yang menjuntai dari dua
      // arah berlawanan dan bertemu di satu simpul tengah (Alrescha,
      // "titik ikatan"), membentuk huruf V raksasa terbuka — masing-
      // masing tali berakhir di lingkaran kecil bintang yang
      // merepresentasikan seekor ikan. Digambar sebagai dua cabang
      // terpisah dari titik tengah (bukan satu garis zigzag menerus),
      // supaya bentuk "V terikat di tengah" khas Pisces terlihat jelas.
      name: 'Pisces',
      points: [[0.06,0.14],[0.16,0.28],[0.14,0.44],[0.24,0.56],[0.20,0.70],[0.32,0.60],[0.44,0.46],[0.58,0.50],[0.70,0.62],[0.66,0.76],[0.78,0.82],[0.88,0.70],[0.94,0.54],[0.86,0.40]],
      lines: [[0,1],[1,2],[2,3],[3,4],[3,5],[5,6],[6,7],[7,8],[8,9],[8,10],[10,11],[11,12],[12,13]]
    }
  ];

  /* ------------------------------------------------------------------
     2. Setup canvas full-viewport, mengikuti resize, dengan devicePixelRatio
        yang dibatasi (maks 2) supaya tidak berat di layar retina/4K.
  ------------------------------------------------------------------ */
  let W = 0, H = 0, DPR = 1;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  resize();

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resize();
      seedStars();
    }, 150);
  });

  /* ------------------------------------------------------------------
     3. Titik-titik bintang latar — tersebar acak, tiap titik punya
        ritme kedip (twinkle) sendiri supaya tidak terasa berkedip
        serempak seperti lampu disko.
  ------------------------------------------------------------------ */
  let stars = [];

  function starCount() {
    // Kepadatan mengikuti luas layar, dengan batas atas supaya tetap ringan.
    const density = (W * H) / 9000;
    return Math.max(60, Math.min(170, Math.round(density)));
  }

  function seedStars() {
    const n = starCount();
    stars = new Array(n).fill(0).map(() => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.1 + 0.4,
      baseAlpha: Math.random() * 0.35 + 0.25,
      twinkleSpeed: Math.random() * 0.0016 + 0.0006,
      twinklePhase: Math.random() * Math.PI * 2,
      drift: (Math.random() - 0.5) * 0.008,
      // Bintang biasa (bukan hasil scroll-burst) langsung tampil penuh
      // sejak awal — tidak perlu fade-in, supaya first paint halaman
      // tetap instan seperti sebelumnya.
      spawnAlpha: 1,
      spawnAlphaTarget: 1
    }));
  }
  seedStars();

  /* ------------------------------------------------------------------
     3b. Scroll-reactive starfield "refresh" — dipanggil dari sistem
         scroll di bagian bawah file (lihat bagian 8). Tugasnya: setiap
         kali pengunjung scroll cukup jauh, sebagian titik bintang LAMA
         (yang paling lama "bertugas") diganti dengan titik BARU di
         posisi acak, dengan bias posisi mengikuti arah scroll —
         scroll ke bawah memunculkan bintang baru condong dari sisi
         bawah layar, scroll ke atas dari sisi atas — seolah-olah
         bintang baru itu "masuk" ke dalam frame mengikuti gerakan
         scroll, bukan muncul acak tak berhubungan di tengah layar.

         Bintang pengganti tidak langsung full-alpha; mereka fade-in
         (spawnAlpha 0 -> 1) selama beberapa ratus ms, supaya
         kemunculannya terasa halus, bukan "kedip"/"pop" mendadak yang
         mengganggu.

         Total populasi bintang TETAP dibatasi oleh starCount() yang
         sudah ada — ini bukan menambah jumlah bintang tanpa batas
         selama discroll lama, melainkan mengganti sebagian bintang
         lama dengan yang baru, jadi tetap ringan berapa pun lama
         halaman discroll.
  ------------------------------------------------------------------ */
  let starCursor = 0; // indeks bergilir, supaya penggantian merata ke seluruh array, bukan selalu titik yang sama

  function refreshStars(count, biasDirection) {
    if (!stars.length) return;
    const n = Math.min(count, stars.length);
    for (let i = 0; i < n; i++) {
      const idx = starCursor % stars.length;
      starCursor++;
      const s = stars[idx];

      // Bias posisi Y sesuai arah scroll: scroll ke bawah (biasDirection
      // > 0) -> bintang baru lebih sering muncul di area bawah layar;
      // scroll ke atas -> lebih sering di area atas. Dicampur dengan
      // posisi full-random supaya tetap terasa "tersebar acak", bukan
      // baris rapi di satu tepi layar.
      const biasedY = biasDirection > 0
        ? H * (0.55 + Math.random() * 0.45)   // condong ke bawah
        : biasDirection < 0
          ? H * (Math.random() * 0.45)         // condong ke atas
          : Math.random() * H;                  // tanpa bias (fallback)

      s.x = Math.random() * W;
      s.y = biasedY;
      s.r = Math.random() * 1.1 + 0.4;
      s.baseAlpha = Math.random() * 0.35 + 0.25;
      s.twinkleSpeed = Math.random() * 0.0016 + 0.0006;
      s.twinklePhase = Math.random() * Math.PI * 2;
      s.drift = (Math.random() - 0.5) * 0.008;
      // Mulai dari transparan, akan di-lerp naik ke 1 di drawStars().
      s.spawnAlpha = 0;
      s.spawnAlphaTarget = 1;
    }
  }

  /* ------------------------------------------------------------------
     4. Easing kecil untuk animasi penggambaran garis — supaya gerak
        "menyambung sendiri" terasa natural (mulai lembut, isi tengah
        lancar, berhenti lembut), bukan kecepatan konstan yang terasa
        kaku/robotic.
  ------------------------------------------------------------------ */
  function easeInOutCubic(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }
  // Easing lembut untuk kurva glow (naik cepat, turun lebih lembut)
  // dipakai di fase GLOW supaya efeknya terasa "bernapas", bukan lampu
  // dinyalakan/dimatikan mendadak.
  function glowCurve(x) {
    // Kurva segitiga dihaluskan (smoothstep di kedua sisi puncak).
    if (x <= 0 || x >= 1) return 0;
    const rise = Math.min(1, x / 0.35);
    const fall = Math.min(1, (1 - x) / 0.65);
    const s = Math.min(rise, fall);
    return s * s * (3 - 2 * s);
  }

  /* ------------------------------------------------------------------
     5. Rasi bintang aktif — dipilih acak, ditempatkan acak, digambar
        bertahap dengan easing, bertahan sesaat, lalu ber-glow
        (menyala aesthetic), redup, jeda singkat, lalu memudar penuh.
        Satu siklus penuh lalu lanjut ke rasi berikutnya (acak lagi,
        boleh berulang — memang diminta "random"). Durasi tiap fase
        dibuat singkat & padat supaya ritme pergantian terasa cepat,
        tidak membosankan.
  ------------------------------------------------------------------ */
  const PHASE = {
    DRAWING: 'drawing',   // garis menyambung sendiri, easing halus
    HOLDING: 'holding',   // jeda sebentar, bentuk sudah utuh & diam
    GLOWING: 'glowing',   // efek glow aesthetic naik lalu turun
    LINGER: 'linger',     // jeda singkat setelah glow reda, sebelum pudar
    FADING: 'fading'      // memudar (fade out) sepenuhnya
  };

  let active = null; // pola rasi yang sedang tampil di layar

  function pickSpot(pattern) {
    // Ukuran kotak pola di layar: proporsional ke layar tapi dengan
    // batas wajar, supaya rasi tidak raksasa di monitor lebar atau
    // kekecilan di HP.
    const minSide = Math.min(W, H);
    const size = Math.max(220, Math.min(460, minSide * 0.55));
    const margin = 24;
    const maxX = Math.max(margin, W - size - margin);
    const maxY = Math.max(margin, H - size - margin);
    const originX = margin + Math.random() * (maxX - margin || 1);
    const originY = margin + Math.random() * (maxY - margin || 1);

    return {
      pattern,
      size,
      originX,
      originY,
      // titik dunia (koordinat layar sesungguhnya), dihitung sekali saat
      // rasi ini ditempatkan
      world: pattern.points.map(([px, py]) => ({
        x: originX + px * size,
        y: originY + py * size
      })),
      phase: PHASE.DRAWING,
      // progres 0..1 untuk animasi "menyambung sendiri" (mentah, sebelum
      // di-easing — easing diterapkan saat dipakai untuk menggambar)
      drawProgress: 0,
      holdTimer: 0,
      glowTimer: 0,
      lingerTimer: 0,
      fadeAlpha: 0,
      // Durasi tiap fase dipersingkat dibanding versi sebelumnya supaya
      // pergantian antar rasi terasa lebih cepat & hidup, tidak lama
      // menggantung di satu bentuk.
      holdDuration: 550 + Math.random() * 350,   // jeda sebentar sebelum glow
      glowDuration: 900,                          // durasi kurva glow naik-turun
      lingerDuration: 350 + Math.random() * 250   // jeda singkat setelah glow reda
    };
  }

  function spawnNext() {
    const pattern = CONSTELLATIONS[Math.floor(Math.random() * CONSTELLATIONS.length)];
    active = pickSpot(pattern);
  }

  // Jeda sebelum rasi pertama muncul, supaya halaman tidak langsung
  // "ramai" di detik pertama — titik-titik bintang biasa dulu yang terlihat.
  let spawnDelay = prefersReducedMotion ? Infinity : 1200;

  /* ------------------------------------------------------------------
     6. Parallax lembut mengikuti kursor — ini bagian "reflektif".
        Pola lerp-nya sama seperti cursorSpot di main.js (curX/curY
        mengejar target dengan faktor kecil tiap frame), supaya terasa
        konsisten dengan interaksi lain yang sudah ada di portofolio.
  ------------------------------------------------------------------ */
  const isTouchDevice = window.matchMedia('(hover: none), (pointer: coarse)').matches;
  let targetPX = 0, targetPY = 0, curPX = 0, curPY = 0;

  if (!isTouchDevice && !prefersReducedMotion) {
    window.addEventListener('mousemove', (e) => {
      // Normalisasi -1..1 dari tengah layar, lalu skala kecil (piksel),
      // supaya pergeseran terasa halus, bukan mengikuti kursor 1:1.
      targetPX = ((e.clientX / W) - 0.5) * 2;
      targetPY = ((e.clientY / H) - 0.5) * 2;
    }, { passive: true });
  }

  /* ------------------------------------------------------------------
     6b. Reaksi terhadap scroll — supaya latar terasa "hidup" & tidak
         monoton saat pengunjung menjelajah halaman, bukan cuma diam
         menunggu timer internal.

         .bg-layer bersifat position:fixed (lihat style.css), jadi
         canvas ini SECARA VISUAL tidak otomatis bergerak mengikuti
         scroll — makanya reaksi terhadap scroll di sini dibuat manual:
         setiap kali pengunjung scroll melewati jarak tertentu, kita
         (a) "menyegarkan" sebagian titik bintang latar lewat
         refreshStars() (titik lama diganti titik baru, condong muncul
         dari arah yang baru saja discroll), dan (b) kalau saat itu
         tidak sedang ada rasi yang tampil, langsung memicu rasi BARU
         (spawnNext(), melewati spawnDelay normal) supaya scroll terasa
         seperti "membuka" bagian langit yang baru, bukan cuma
         menunggu rasi lama selesai dengan sendirinya.

         Rasi yang SEDANG tampil tidak pernah diinterupsi/dipotong oleh
         scroll — animasi menyambung-glow-fade yang sudah diminta tetap
         berjalan utuh dan halus; scroll hanya mempercepat GILIRAN rasi
         berikutnya muncul, bukan mengubah cara satu rasi itu sendiri
         digambar.

         Threshold jarak dibuat kecil (dituntut "sering, tiap sedikit
         scroll") — jarak yang sudah terkumpul diterjemahkan langsung
         menjadi trigger lewat SCROLL_DISTANCE_UNIT (lihat penjelasan
         di handleScrollTrigger di bawah), tanpa cooldown waktu
         terpisah, supaya scroll cepat sekalipun tetap terasa
         sepenuhnya responsif — tidak ada efek yang "hilang" karena
         dibatasi jeda waktu.
  ------------------------------------------------------------------ */
  if (!prefersReducedMotion) {
    const SCROLL_DISTANCE_UNIT = 110; // px terkumulasi sebelum satu "unit" trigger
    const STARS_PER_TRIGGER = 3;      // berapa titik bintang di-refresh tiap trigger

    let lastScrollY = window.scrollY;
    let accumulated = 0;   // jarak (px) yang sudah terkumpul menuju unit trigger berikutnya
    let accDirection = 0;  // arah scroll yang sedang diakumulasi: 1 = turun, -1 = naik
    let scrollTicking = false;

    function triggerLivelyRefresh(direction) {
      // (a) Selalu segarkan beberapa titik bintang latar, condong ke
      //     arah scroll — ini yang bikin field-nya terasa terus
      //     "berganti" walau rasi sedang tidak muncul sama sekali.
      refreshStars(STARS_PER_TRIGGER, direction);

      // (b) Kalau slot rasi sedang kosong, majukan giliran rasi
      //     berikutnya sekarang juga (lewati sisa spawnDelay yang
      //     sedang berjalan). Rasi yang SEDANG digambar/nge-glow/fade
      //     tidak pernah disentuh di sini — biar tetap utuh & smooth.
      //     spawnNext() langsung mengisi `active` secara sinkron,
      //     sehingga pengecekan `if (!active)` di tick() pada frame
      //     berikutnya otomatis menjadi false — tidak ada risiko
      //     rasi yang baru saja dibuat di sini ter-spawn dua kali.
      if (!active) {
        spawnNext();
      }
    }

    function handleScrollTrigger() {
      const nowY = window.scrollY;
      const rawDelta = nowY - lastScrollY;
      lastScrollY = nowY;
      if (rawDelta === 0) return;

      const direction = rawDelta > 0 ? 1 : -1;

      // Pembalikan arah (scroll turun lalu tiba-tiba naik) memulai
      // akumulasi baru dari nol, supaya bias posisi bintang & rasa
      // "unit scroll" selalu mengikuti arah SEKARANG, bukan sisa
      // campuran dari arah sebelumnya.
      if (direction !== accDirection) {
        accumulated = 0;
        accDirection = direction;
      }

      accumulated += Math.abs(rawDelta);

      // requestAnimationFrame (lewat onScroll di bawah) sudah membatasi
      // pemanggilan fungsi ini maksimum sekali per frame, jadi loop di
      // bawah ini murni menerjemahkan jarak scroll terkumpul menjadi
      // jumlah trigger yang sepadan — tidak perlu cooldown waktu
      // terpisah lagi, supaya scroll cepat tetap terasa sepenuhnya
      // responsif (setiap unit jarak yang terlewati selalu menghasilkan
      // efeknya, tidak ada yang "hilang" karena dibatasi waktu).
      while (accumulated >= SCROLL_DISTANCE_UNIT) {
        accumulated -= SCROLL_DISTANCE_UNIT;
        triggerLivelyRefresh(direction);
      }
    }

    function onScroll() {
      if (!scrollTicking) {
        scrollTicking = true;
        requestAnimationFrame(() => {
          scrollTicking = false;
          handleScrollTrigger();
        });
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });

    // Kalau ukuran layar berubah (resize/orientasi), sinkronkan ulang
    // referensi posisi supaya tidak ada lompatan delta besar yang
    // salah terbaca sebagai "scroll jauh" tepat setelah resize.
    window.addEventListener('resize', () => {
      lastScrollY = window.scrollY;
    }, { passive: true });
  }

  /* ------------------------------------------------------------------
     7. Loop utama.
  ------------------------------------------------------------------ */
  let lastT = performance.now();
  let running = true;

  function drawStars(t, offX, offY) {
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      let alpha = s.baseAlpha;
      if (!prefersReducedMotion) {
        alpha = s.baseAlpha + Math.sin(t * s.twinkleSpeed + s.twinklePhase) * 0.22;
        // Drift super halus supaya langit terasa mengambang pelan.
        s.x += s.drift;
        if (s.x < -5) s.x = W + 5;
        if (s.x > W + 5) s.x = -5;
        // Fade-in halus untuk bintang yang baru saja di-refresh lewat
        // scroll (lihat refreshStars()) — lerp menuju spawnAlphaTarget
        // (selalu 1) supaya kemunculannya terasa halus, bukan instan.
        if (s.spawnAlpha < s.spawnAlphaTarget) {
          s.spawnAlpha = Math.min(1, s.spawnAlpha + 0.045);
        }
      }
      alpha = Math.max(0.05, Math.min(0.65, alpha)) * s.spawnAlpha;
      ctx.beginPath();
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.arc(s.x + offX, s.y + offY, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawConstellation(dt, offX, offY) {
    if (!active) return;
    const c = active;
    const pts = c.world;
    const lines = c.pattern.lines;

    // -- Update fase --
    if (c.phase === PHASE.DRAWING) {
      // Durasi menyambung dipersingkat (dari ~1.4s jadi ~0.9s) supaya
      // proses "bentuk berubah" tidak terasa lama/boring, tetap cukup
      // untuk terlihat menyambung bertahap, bukan muncul instan.
      c.drawProgress += dt / 900;
      if (c.drawProgress >= 1) {
        c.drawProgress = 1;
        c.phase = PHASE.HOLDING;
      }
    } else if (c.phase === PHASE.HOLDING) {
      c.holdTimer += dt;
      if (c.holdTimer >= c.holdDuration) {
        c.phase = PHASE.GLOWING;
      }
    } else if (c.phase === PHASE.GLOWING) {
      c.glowTimer += dt;
      if (c.glowTimer >= c.glowDuration) {
        c.phase = PHASE.LINGER;
      }
    } else if (c.phase === PHASE.LINGER) {
      c.lingerTimer += dt;
      if (c.lingerTimer >= c.lingerDuration) {
        c.phase = PHASE.FADING;
      }
    } else if (c.phase === PHASE.FADING) {
      // Fade out dipercepat sedikit (dari ~1.1s jadi ~0.75s) supaya
      // giliran rasi berikutnya datang lebih cepat.
      c.fadeAlpha += dt / 750;
      if (c.fadeAlpha >= 1) {
        active = null;
        // Jeda antar-rasi dipersingkat supaya ritme pergantian bentuk
        // terasa lebih cepat & hidup, tidak menggantung lama di layar
        // kosong sebelum rasi berikutnya muncul.
        spawnDelay = 400 + Math.random() * 700;
        return;
      }
    }

    // Easing halus untuk progres garis (dipakai hanya saat DRAWING;
    // fase lain progres sudah penuh = 1).
    const drawT = easeInOutCubic(c.drawProgress);

    const fade = c.phase === PHASE.FADING ? Math.max(0, 1 - c.fadeAlpha) : 1;

    // Kurva glow: 0 di luar fase GLOWING, naik→puncak→turun halus
    // selama fase GLOWING berlangsung.
    const glowT = c.phase === PHASE.GLOWING
      ? glowCurve(c.glowTimer / c.glowDuration)
      : 0;

    // -- Alpha dasar (tanpa glow) --
    const baseLineAlpha = 0.34 * fade;
    const baseDotAlpha = 0.85 * fade;
    const baseHaloAlpha = 0.16 * fade;

    // -- Boost dari efek glow: garis & titik ikut lebih terang, dan
    //    halo titik jadi lebih besar/menyala saat glow memuncak, supaya
    //    terasa seperti rasi "menyala" sesaat sebelum pudar.
    const lineAlpha = Math.min(1, baseLineAlpha + glowT * 0.5 * fade);
    const dotAlpha = Math.min(1, baseDotAlpha + glowT * 0.15 * fade);
    const haloAlpha = Math.min(1, baseHaloAlpha + glowT * 0.55 * fade);
    const haloRadius = 10 + glowT * 9; // halo membesar saat glow menyala

    // -- Garis yang "menyambung sendiri": tiap segmen digambar penuh
    //    secara berurutan mengikuti drawProgress (yang sudah di-easing)
    //    total, bukan semua segmen tumbuh bersamaan & bukan kecepatan
    //    konstan — awal & akhir tiap segmen melambat sedikit sehingga
    //    terasa lebih natural, seperti digambar tangan, bukan mesin.
    const segCount = lines.length;
    const segProgressRaw = drawT * segCount;

    ctx.lineWidth = c.phase === PHASE.GLOWING ? 1.1 + glowT * 0.7 : 1.1;
    ctx.strokeStyle = `rgba(199, 210, 255, ${lineAlpha})`;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Saat fase GLOWING aktif, tambahkan shadow blur tipis pada goresan
    // garis itu sendiri supaya glow terasa menyatu dengan garisnya,
    // bukan cuma bulatan di titik simpul.
    if (glowT > 0.01) {
      ctx.shadowBlur = 8 * glowT;
      ctx.shadowColor = `rgba(142, 154, 255, ${0.9 * fade})`;
    } else {
      ctx.shadowBlur = 0;
    }

    for (let i = 0; i < segCount; i++) {
      const segT = Math.max(0, Math.min(1, segProgressRaw - i));
      if (segT <= 0) continue;
      const [a, b] = lines[i];
      const p1 = pts[a], p2 = pts[b];
      const mx = p1.x + (p2.x - p1.x) * segT;
      const my = p1.y + (p2.y - p1.y) * segT;
      ctx.beginPath();
      ctx.moveTo(p1.x + offX, p1.y + offY);
      ctx.lineTo(mx + offX, my + offY);
      ctx.stroke();
    }

    ctx.shadowBlur = 0; // reset supaya tidak "bocor" ke elemen lain

    // -- Titik-titik simpul rasi: sedikit lebih besar & terang dari
    //    bintang latar biasa, dengan glow tipis ala aksen brand
    //    (--color-accent adalah indigo #5e6ad2 → dipakai di sini untuk
    //    glow-nya supaya terasa menyatu dengan identitas visual situs).
    //    Saat fase GLOWING, halo ini membesar & menyala lebih terang —
    //    inilah efek "glow aesthetic" yang diminta setelah pola selesai
    //    terbentuk, sebelum akhirnya rasi memudar.
    const visiblePoints = c.phase === PHASE.DRAWING
      ? Math.ceil(segProgressRaw) + 1
      : pts.length;

    for (let i = 0; i < Math.min(visiblePoints, pts.length); i++) {
      const p = pts[i];
      const px = p.x + offX, py = p.y + offY;

      if (haloAlpha > 0.005) {
        const grad = ctx.createRadialGradient(px, py, 0, px, py, haloRadius);
        grad.addColorStop(0, `rgba(142, 154, 255, ${haloAlpha})`);
        grad.addColorStop(1, 'rgba(142, 154, 255, 0)');
        ctx.beginPath();
        ctx.fillStyle = grad;
        ctx.arc(px, py, haloRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.beginPath();
      ctx.fillStyle = `rgba(255,255,255,${dotAlpha})`;
      ctx.arc(px, py, 1.8 + glowT * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function tick(now) {
    if (!running) return;
    const dt = Math.min(now - lastT, 50); // clamp supaya tab yang lama nganggur tidak "meloncat"
    lastT = now;

    // Parallax: kejar target secara halus (lerp), sama seperti cursorSpot.
    curPX += (targetPX - curPX) * 0.05;
    curPY += (targetPY - curPY) * 0.05;
    const offX = curPX * 10; // pergeseran maksimum ~10px, sangat halus
    const offY = curPY * 8;

    ctx.clearRect(0, 0, W, H);

    drawStars(now, offX * 0.4, offY * 0.4); // titik latar bergeser lebih pelan (lapisan "jauh")
    drawConstellation(dt, offX, offY);

    if (!prefersReducedMotion) {
      if (!active) {
        if (spawnDelay !== Infinity) {
          spawnDelay -= dt;
          if (spawnDelay <= 0) spawnNext();
        }
      }
    }

    requestAnimationFrame(tick);
  }

  // Untuk reduced-motion: gambar sekali saja secara statis (titik-titik
  // diam, tanpa rasi yang beranimasi), lalu berhenti — tidak ada loop
  // rAF yang jalan terus-menerus.
  if (prefersReducedMotion) {
    ctx.clearRect(0, 0, W, H);
    drawStars(0, 0, 0);
  } else {
    requestAnimationFrame(tick);
  }

  /* ------------------------------------------------------------------
     8. Hemat baterai/CPU: hentikan loop saat tab tidak terlihat,
        lanjutkan saat kembali aktif. Konsisten dengan semangat
        "tidak membebani" yang sudah jadi prinsip file scroll-fx.js.
  ------------------------------------------------------------------ */
  document.addEventListener('visibilitychange', () => {
    if (prefersReducedMotion) return;
    if (document.hidden) {
      running = false;
    } else if (!running) {
      running = true;
      lastT = performance.now();
      requestAnimationFrame(tick);
    }
  });
})();
