/* ==========================================================================
   Rafael L3 — Portfolio
   content.js — SATU-SATUNYA sumber semua teks di website ini.

   Cara pakai:
   - Mau ganti kalimat/kata apapun di website? Cari di sini, edit,
     lalu simpan. Tidak perlu buka index.html sama sekali.
   - Setiap bagian sudah dikelompokkan sesuai section di halaman
     (Navbar, Hero, Tentang, Genre, dst) supaya gampang ditemukan.
   - Struktur objek (nama key, urutan array) JANGAN diubah — yang
     boleh diubah cuma isi teksnya (yang ada di antara tanda kutip).
   - File ini di-load lebih dulu oleh index.html, sebelum main.js,
     supaya main.js bisa langsung memakai variabel CONTENT di bawah.
   ========================================================================== */

const CONTENT = {

  /* ------------------------------------------------------------------
     META — judul tab browser, deskripsi untuk mesin pencari & preview
     link (Open Graph) saat link website dibagikan di WhatsApp/medsos.
  ------------------------------------------------------------------ */
  meta: {
    pageTitle: "Rafael L3 — Remix & Produser Musik Elektronik",
    metaDescription: "Rafael L3, remixer dan produser musik elektronik asal Yogyakarta. Bermain di ranah Breakbeat, Funkot, Progressive House, Hardtechno, Bigroom, dan Trap.",
    ogTitle: "Rafael L3 — Remix & Produser Musik Elektronik",
    ogDescription: "Portofolio resmi Rafael L3. Dari Prawirotaman, Yogyakarta, untuk siapapun yang masih mau belajar setiap saat."
  },

  /* ------------------------------------------------------------------
     NAVBAR — menu atas (desktop) & tombol aksinya.
     Dipakai juga oleh menu mobile (drawer) di bawah.
  ------------------------------------------------------------------ */
  navbar: {
    brand: "Rafael L3",
    links: [
      { label: "Tentang", href: "#tentang" },
      { label: "Genre", href: "#genre" },
      { label: "Keahlian", href: "#skill" },
      { label: "Karya", href: "#karya" },
      { label: "Alat Kerja", href: "#alat" },
      { label: "Kontak", href: "#kontak" }
    ],
    btnGhost: "Hubungi Saya",
    btnPrimary: "Dengarkan Karya"
  },

  /* ------------------------------------------------------------------
     MENU MOBILE (drawer yang muncul saat tombol ☰ ditekan di HP)
  ------------------------------------------------------------------ */
  mobileDrawer: {
    brand: "Rafael L3",
    links: [
      { label: "Tentang", href: "#tentang" },
      { label: "Genre", href: "#genre" },
      { label: "Keahlian", href: "#skill" },
      { label: "Karya", href: "#karya" },
      { label: "Alat Kerja", href: "#alat" },
      { label: "Kontak", href: "#kontak" }
    ],
    btnOutline: "Hubungi Saya",
    btnPrimary: "Dengarkan Karya"
  },

  /* ------------------------------------------------------------------
     HERO — bagian paling atas halaman (judul besar + panel pratinjau
     ala dashboard studio).
  ------------------------------------------------------------------ */
  hero: {
    badge: "Sedang menggarap materi baru di studio",
    heading: "Meracik bunyi jadi<br>pengalaman yang menggerakkan tubuh.",
    subheading: "Saya Rafael L3 — remixer dan produser musik elektronik yang percaya bahwa satu drop yang tepat bisa mengubah suasana satu ruangan penuh orang.",
    meta: {
      location: "📍 Prawirotaman, Yogyakarta",
      role: "🎚️ Remix & Produksi",
      genreCount: "🎧 6 Genre Aktif"
    },
    btnAccent: "Putar Karya Terbaru",
    btnOutline: "Ajak Kolaborasi",
    linkCta: {
      text: "Kenalan lebih jauh dengan cerita di baliknya",
      strong: "di sini"
    },
    /* Panel pratinjau di dalam hero, meniru tampilan dashboard studio */
    panel: {
      sidebarLabel1: "Ruang Kerja",
      navItems: [
        "Sesi Produksi",
        "Daftar Remix",
        "Referensi Genre"
      ],
      sidebarLabel2: "Arsip",
      navItemsArsip: [
        "Progres Bulanan",
        "Sesi Terjadwal"
      ],
      statusChip: "Dalam proses",
      heading: 'Remix "Malam di Prawirotaman" — Progressive House',
      text: "Menata ulang bagian breakdown supaya transisi ke build-up terasa lebih napas panjang, bukan langsung meledak di bar_32. Layer pad masih perlu di-automate sedikit lagi.",
      activity: [
        {
          who: "Rafael L3",
          when: "2 jam lalu",
          note: "Selesai re-arrange struktur intro, breakdown dipindah ke bar 48."
        },
        {
          who: "Catatan studio",
          when: "baru saja",
          note: "Sidechain kick-bass masih perlu dirapatkan sedikit di frekuensi 80–120Hz."
        }
      ]
    }
  },

  /* ------------------------------------------------------------------
     LOGO BAR — teks berjalan (marquee) berisi daftar genre.
  ------------------------------------------------------------------ */
  logoBar: {
    label: "Ranah bunyi yang saya jelajahi setiap hari",
    /* Daftar genre yang tampil berjalan. Ini otomatis diulang 2x oleh
       main.js supaya animasinya terlihat menyambung terus — jadi
       cukup isi 6 genre aslinya saja di sini, jangan ditulis 2x. */
    items: [
      "Breakbeat",
      "Funkot",
      "Progressive House",
      "Hardtechno",
      "Bigroom",
      "Trap"
    ]
  },

  /* ------------------------------------------------------------------
     01 — TENTANG SAYA
  ------------------------------------------------------------------ */
  tentang: {
    eyebrowIndex: "01",
    eyebrow: "Tentang Saya",
    heading: "Bukan sekadar menekan tombol play.",
    headingMuted: "Setiap remix punya alasan kenapa ia harus dibongkar dan disusun ulang — supaya rasanya pas untuk momen yang tepat, di ruangan yang tepat.",
    cards: [
      {
        title: "Ditata dari kebiasaan mendengar",
        text: "Kebiasaan saya menyusun ulang lagu berangkat dari ribuan jam mendengarkan set DJ dan membedah kenapa satu transisi terasa mulus sementara yang lain terasa dipaksakan."
      },
      {
        title: "Fokus di dua hal saja",
        text: "Remix dan produksi. Saya sengaja tidak menyebar diri ke mixing-mastering orang lain atau DJ-ing rutin, supaya waktu dan energi terpakai maksimal untuk dua keahlian ini."
      },
      {
        title: "Belajar tidak pernah berhenti",
        text: "Genre berubah, software berkembang, telinga saya pun terus dilatih ulang. Motto saya sederhana: selama masih bisa bernapas, masih ada ruang untuk belajar hal baru."
      }
    ]
  },

  /* ------------------------------------------------------------------
     02 — GENRE (chapter kiri-teks / kanan-grafik batang)
  ------------------------------------------------------------------ */
  genre: {
    chapterNum: "2.0 — Ranah Bunyi",
    title: "Enam genre, satu cara mendengar",
    desc: "Saya tidak menempel di satu warna musik saja. Breakbeat dan Funkot mengajarkan saya soal groove lokal yang jujur, sementara Progressive House dan Bigroom melatih kesabaran membangun energi. Hardtechno dan Trap jadi tempat saya melepas sisi paling agresif.",
    link: "Dengarkan penerapannya di karya saya",
    /* Persentase bar di grafik genre. Angka "width" itu tinggi bar
       dalam persen (0-100), "pct" adalah teks angka yang tampil. */
    bars: [
      { tag: "Breakbeat", width: 88, pct: "88%" },
      { tag: "Funkot", width: 82, pct: "82%" },
      { tag: "Progressive House", width: 94, pct: "94%" },
      { tag: "Hardtechno", width: 75, pct: "75%" },
      { tag: "Bigroom", width: 79, pct: "79%" },
      { tag: "Trap", width: 70, pct: "70%" }
    ]
  },

  /* ------------------------------------------------------------------
     03 — SKILL / KEAHLIAN (chapter kanan-teks / kiri-grafik orbit)
  ------------------------------------------------------------------ */
  skill: {
    chapterNum: "3.0 — Keahlian Utama",
    title: "Dua keahlian yang saya dalami sungguh-sungguh",
    /* Perhatikan: bagian ini pakai <strong> dan <br><br>, jadi kalau
       diedit, tag HTML-nya tetap dipertahankan supaya tampilannya
       tidak berubah. */
    desc: '<strong style="color:var(--color-text-secondary)">Remix</strong> — membongkar struktur lagu orang lain, menemukan elemen yang paling kuat, lalu menyusunnya ulang dengan sudut pandang baru tanpa menghilangkan identitas aslinya.<br><br><strong style="color:var(--color-text-secondary)">Produce</strong> — membangun trek dari nol: sound design, arrangement, sampai proses mixing awal sebelum dikirim ke mastering.',
    link: "Lihat alat yang saya pakai untuk keduanya",
    orbitCore: "FOCUSED<br>SKILLS",
    nodeRemix: "🎛️ Remix",
    nodeProduce: "🎹 Produce"
  },

  /* ------------------------------------------------------------------
     04 — KARYA (chapter kiri-teks / kanan-daftar rilis)
  ------------------------------------------------------------------ */
  karya: {
    chapterNum: "4.0 — Katalog Karya",
    title: "Beberapa hasil yang sedang saya banggakan",
    desc: "Sebagian masih berupa demo internal, sebagian lain sudah siap dibagikan ke luar. Daftar di samping akan terus diperbarui seiring materi baru rampung dari studio.",
    link: "Minta tautan dengar penuh",
    fileTabLabel: "katalog_rafael-l3.playlist",
    /* Daftar trek. badge boleh "new" (label "RILIS") atau "wip"
       (label "REMIX"/"DEMO" — tulis labelnya sendiri di field
       "badgeLabel" karena keduanya sama-sama status "wip"). */
    releases: [
      { num: "01", badge: "new", badgeLabel: "RILIS", title: "Malam di Prawirotaman", genre: "Progressive House" },
      { num: "02", badge: "wip", badgeLabel: "REMIX", title: "Gadis Yogyakarta (Rafael L3 Edit)", genre: "Funkot" },
      { num: "03", badge: "new", badgeLabel: "RILIS", title: "Retak Beton", genre: "Hardtechno" },
      { num: "04", badge: "wip", badgeLabel: "DEMO", title: "Langkah Tanpa Arah", genre: "Breakbeat" },
      { num: "05", badge: "new", badgeLabel: "RILIS", title: "Overdrive Anthem", genre: "Bigroom" },
      { num: "06", badge: "wip", badgeLabel: "DEMO", title: "Trap Malioboro", genre: "Trap" }
    ]
  },

  /* ------------------------------------------------------------------
     05 — ALAT KERJA (chapter kanan-teks / kiri-daftar tools)
  ------------------------------------------------------------------ */
  alat: {
    chapterNum: "5.0 — Ruang Kerja",
    title: "Perkakas yang menemani tiap sesi",
    desc: "Bukan soal software paling mahal atau plugin paling viral. Saya lebih memilih segelintir alat yang benar-benar saya kuasai luar-dalam, dibanding menumpuk banyak tapi setengah-setengah.",
    link: "Tanya rekomendasi setup",
    /* Daftar chip alat kerja. "icon" adalah singkatan yang tampil di
       kotak warna kecil, "color" adalah warna kotak itu (kode hex),
       "label" adalah nama alatnya. */
    tools: [
      { icon: "FL", color: "#8b5cf6", label: "FL Studio" },
      { icon: "Ab", color: "#111", label: "Ableton Live" },
      { icon: "Sr", color: "#22c55e", label: "Serum" },
      { icon: "Vi", color: "#ef4444", label: "Vital" },
      { icon: "Ox", color: "#f59e0b", label: "OTT / Izotope" },
      { icon: "Mi", color: "#5e6ad2", label: "Audio Interface" }
    ]
  },

  /* ------------------------------------------------------------------
     06 — STATISTIK (angka yang naik/counting saat di-scroll)
  ------------------------------------------------------------------ */
  statistik: {
    eyebrowIndex: "06",
    eyebrow: "Sejauh Ini",
    heading: "Angka bukan tujuan utama, tapi jujur menggambarkan proses",
    desc: "Ini bukan pencapaian instan — semuanya terkumpul dari jam-jam yang dihabiskan sendirian di depan monitor studio.",
    /* "count" = angka akhir yang dituju, "suffix" = tanda tambahan
       setelah angka (misalnya "+"), boleh dikosongkan jika tidak
       perlu (lihat contoh genre & tahun di bawah). */
    stats: [
      { count: 47, suffix: "+", label: "Trek diselesaikan" },
      { count: 6, suffix: "", label: "Genre yang digarap aktif" },
      { count: 1200, suffix: "+", label: "Jam sesi produksi tercatat" },
      { count: 3, suffix: "", label: "Tahun konsisten menekuni bidang ini" }
    ]
  },

  /* ------------------------------------------------------------------
     07 — QUOTE / PRINSIP KERJA (3 kartu kutipan)
  ------------------------------------------------------------------ */
  quote: {
    eyebrowIndex: "07",
    eyebrow: "Cara Saya Bekerja",
    heading: "Prinsip yang saya pegang tiap masuk studio",
    cards: [
      {
        text: '"Remix yang bagus itu bukan yang paling ramai, tapi yang tahu kapan harus diam sejenak."',
        name: "Rafael L3",
        role: "Tentang dinamika breakdown"
      },
      {
        text: '"Kalau telinga sudah capek, berhenti dulu. Keputusan mixing paling buruk lahir dari sesi yang dipaksakan."',
        name: "Rafael L3",
        role: "Tentang menjaga kualitas telinga"
      },
      {
        text: '"Belajar genre baru itu seperti pindah kota — awalnya asing, lama-lama jadi rumah kedua."',
        name: "Rafael L3",
        role: "Tentang eksplorasi lintas genre"
      }
    ]
  },

  /* ------------------------------------------------------------------
     MOTTO BESAR (kutipan besar di tengah halaman, sebelum kontak)
  ------------------------------------------------------------------ */
  motto: {
    quoteMark: '"',
    text: "Keep learning at all times & place — selama saya masih bisa bernapas, selalu ada satu hal baru yang layak dipelajari.",
    sub: "— Rafael L3, motto pribadi yang dipegang di setiap sesi produksi"
  },

  /* ------------------------------------------------------------------
     08 — CTA FINAL / KONTAK
  ------------------------------------------------------------------ */
  kontak: {
    eyebrowIndex: "08",
    eyebrow: "Mari Terhubung",
    heading: "Ada ide kolaborasi?",
    desc: "Baik untuk remix, produksi trek baru, atau sekadar diskusi soal sound design — kotak masuk saya selalu terbuka.",
    btnEmail: "Kirim Email",
    email: "halo@rafaell3.id",
    btnInstagram: "Instagram @rafaell3",
    /* Teks yang muncul sesaat saat tombol Instagram ditekan (karena
       tautan asli Instagram belum dipasang). Setelah beberapa detik
       tombolnya otomatis kembali ke teks btnInstagram di atas. */
    instagramPlaceholder: "Tautan menyusul, hubungi via email dulu ya"
  },

  /* ------------------------------------------------------------------
     FOOTER — bagian paling bawah halaman
  ------------------------------------------------------------------ */
  footer: {
    brand: "Rafael L3",
    tagline: "Remix & produser musik elektronik. Berbasis di Prawirotaman, Yogyakarta City, Indonesia.",
    columns: [
      {
        heading: "Jelajah",
        links: [
          { label: "Tentang", href: "#tentang" },
          { label: "Genre", href: "#genre" },
          { label: "Keahlian", href: "#skill" },
          { label: "Karya", href: "#karya" }
        ]
      },
      {
        heading: "Genre",
        links: [
          { label: "Breakbeat", href: "#genre" },
          { label: "Funkot", href: "#genre" },
          { label: "Progressive House", href: "#genre" },
          { label: "Hardtechno", href: "#genre" }
        ]
      },
      {
        heading: "Lainnya",
        links: [
          { label: "Bigroom", href: "#genre" },
          { label: "Trap", href: "#genre" },
          { label: "Alat Kerja", href: "#alat" }
        ]
      },
      {
        heading: "Kontak",
        links: [
          { label: "halo@rafaell3.id", href: "mailto:halo@rafaell3.id" },
          { label: "Ajak Kolaborasi", href: "#kontak" },
          { label: "Kembali ke Atas", href: "#beranda" }
        ]
      }
    ],
    /* Baris paling bawah footer. "tahun" diisi otomatis oleh main.js
       dengan tahun berjalan saat ini, jadi tidak perlu diubah manual
       tiap tahun. */
    copyright: "Rafael L3. Dibuat dengan sepenuh hati dari Yogyakarta.",
    location: "Yogyakarta, Indonesia"
  }

};
