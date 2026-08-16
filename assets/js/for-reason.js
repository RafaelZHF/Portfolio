/* ==========================================================================
   Rafael L3 — Portfolio
   for-reason.js — kumpulan alasan random untuk teks badge status MERAH
   (offline) dan KUNING (idle), dipakai oleh fetch-status.js.

   Apa ini:
   File ini TIDAK jalan sendiri. Isinya cuma data yang ditempel ke
   window.ALASAN_STATUS supaya fetch-status.js bisa mengambil satu baris
   secara acak tiap kali status Discord berubah jadi offline atau idle —
   jadi teks badge tidak itu-itu saja terus, ada variasinya, tapi tetap
   masuk akal (bukan alasan random yang aneh-aneh, dan tidak nyeleneh
   sama jam berapa sekarang — lihat bagian "Kenapa dibagi per waktu"
   di bawah).

   Kenapa dipisah dari fetch-status.js:
   Supaya nambah/ubah/hapus alasan tinggal edit file ini saja, tidak perlu
   utak-atik logika WebSocket/REST di fetch-status.js sama sekali. Dua
   tanggung jawab yang beda: file ini "isi teksnya apa", fetch-status.js
   "kapan dan bagaimana teks itu dipasang ke badge".

   Cara pasang:
   Taruh script ini di index.html SEBELUM fetch-status.js, supaya
   window.ALASAN_STATUS sudah tersedia duluan saat fetch-status.js
   mulai jalan.

       <script src="assets/js/content.js"></script>
       <script src="assets/js/main.js"></script>
       <script src="assets/js/for-reason.js"></script>     <-- baris baru
       <script src="assets/js/fetch-status.js"></script>
       <script src="assets/js/hero-greeting.js"></script>
       <script src="assets/js/scroll-fx.js"></script>
       <script src="assets/js/bg-constellation.js"></script>

   Kalau file ini dihapus/belum dipasang, fetch-status.js tetap jalan
   normal — otomatis balik pakai teks statis tunggal dari TEKS_STATUS
   di dalam fetch-status.js sendiri. Jadi file ini sifatnya tambahan/
   opsional, bukan wajib.

   ==========================================================================
   KENAPA DIBAGI PER WAKTU (bagian penting, baca ini kalau mau nambah
   alasan baru):

   Banyak alasan cuma masuk akal di jam tertentu. Bukan cuma soal
   "tidur" doang (tidur siang aneh kalau muncul jam 3 pagi) — banyak
   aktivitas harian lain juga kena aturan yang sama: mustahil "main
   sama kucing/anjing" tengah malam waktu semua orang di rumah udah
   tidur, ganjil juga "sarapan" muncul jam 9 malam, atau "pulang
   sekolah" muncul jam 6 pagi. Supaya badge tidak nyeleneh begitu,
   tiap warna (merah/kuning) dibagi jadi dua kelompok:

     - "netral"  : alasan yang BENERAN masuk akal DI JAM BERAPAPUN,
                   tidak terikat rutinitas harian sama sekali (misal
                   "lagi mandi" — orang bisa mandi jam berapa saja,
                   "WiFi router mati" — bisa kapan saja, tidak
                   tergantung jam). Ini SELALU ikut jadi kandidat,
                   berapapun jam sekarang.

     - "waktu"   : alasan yang terikat rutinitas/jam tertentu,
                   dikelompokkan ke salah satu dari 5 rentang di bawah.
                   Ini CUMA ikut jadi kandidat kalau jam sekarang lagi
                   ada di rentang itu. Termasuk di sini: alasan tidur
                   (pagi/siang/malam), alasan makan (sarapan/makan
                   siang/makan malam), DAN aktivitas rumahan yang
                   biasanya cuma kejadian di jam-jam tertentu (main
                   sama hewan peliharaan, jemur baju, berangkat/pulang
                   sekolah-kerja, dsb) — bukan cuma yang judulnya
                   eksplisit soal "tidur".

   Lima rentang waktu yang dipakai (jam device pengunjung situs, 24 jam):
     dini_hari : 00:00 - 03:59  (tengah malam sampai sebelum subuh)
     pagi      : 04:00 - 10:59  (subuh sampai sebelum siang)
     siang     : 11:00 - 14:59  (tengah hari)
     sore      : 15:00 - 17:59  (menjelang matahari terbenam)
     malam     : 18:00 - 23:59  (habis maghrib sampai sebelum tengah malam)

   Batas jam di atas sengaja dibulatkan kasar (bukan hitungan astronomis
   presisi) karena tujuannya cuma "kedengeran wajar", bukan akurasi ilmiah.
   Logika pemilihan jam-nya sendiri ada di fetch-status.js (fungsi
   ambilRentangWaktuSekarang), file ini cuma nyimpen datanya per rentang.

   Mau nambah alasan baru? Tanya ke diri sendiri dulu: "kalau ini
   muncul jam 3 pagi, masih masuk akal nggak?"
   - Kalau IYA (masuk akal jam berapapun) -> taruh di array "netral"
     warna yang sesuai.
   - Kalau TIDAK (cuma masuk akal di jam tertentu) -> taruh di dalam
     objek "waktu", pada key rentang yang paling pas. Boleh taruh
     alasan yang sama di lebih dari satu rentang kalau memang masuk
     akal di keduanya (misal "lagi rebahan santai" bisa cocok di siang
     DAN malam sekaligus — tinggal taruh di dua-duanya).
   ========================================================================== */

(function () {
  'use strict';

  window.ALASAN_STATUS = {

    /* ------------------------------------------------------------------
       MERAH — Discord offline / tidak terhubung sama sekali.
       ------------------------------------------------------------------ */
    merah: {

      /* Alasan offline yang beneran tidak terikat jam — cocok kapan saja. */
      netral: [
        'Rafael Sedang offline, mungkin laptopnya lagi mati',
        'Rafael Sedang offline, mungkin HP-nya lowbat terus mati',
        'Rafael Sedang offline, mungkin baru keluar rumah',
        'Rafael Sedang offline, mungkin lagi di luar tanpa sinyal',
        'Rafael Sedang offline, mungkin lagi mandi',
        'Rafael Sedang offline, mungkin lagi sholat',
        'Rafael Sedang offline, mungkin lagi ibadah',
        'Rafael Sedang offline, mungkin lagi makan di luar',
        'Rafael Sedang offline, mungkin lagi nongkrong sama temen',
        'Rafael Sedang offline, mungkin lagi kerja kelompok',
        'Rafael Sedang offline, mungkin lagi rapat offline',
        'Rafael Sedang offline, mungkin lagi meeting di luar',
        'Rafael Sedang offline, mungkin baterai laptopnya habis',
        'Rafael Sedang offline, mungkin lagi charge HP sambil ditinggal',
        'Rafael Sedang offline, mungkin lupa nyalain PC',
        'Rafael Sedang offline, mungkin lagi di jalan pulang',
        'Rafael Sedang offline, mungkin lagi di perjalanan',
        'Rafael Sedang offline, mungkin lagi naik motor',
        'Rafael Sedang offline, mungkin lagi nyetir mobil',
        'Rafael Sedang offline, mungkin lagi belanja ke minimarket',
        'Rafael Sedang offline, mungkin lagi ke warung',
        'Rafael Sedang offline, mungkin lagi antar jemput keluarga',
        'Rafael Sedang offline, mungkin lagi bantu orang tua',
        'Rafael Sedang offline, mungkin lagi ngobrol sama keluarga',
        'Rafael Sedang offline, mungkin PC-nya lagi update Windows',
        'Rafael Sedang offline, mungkin router WiFi-nya lagi mati',
        'Rafael Sedang offline, mungkin listrik rumahnya lagi padam',
        'Rafael Sedang offline, mungkin internetnya lagi gangguan',
        'Rafael Sedang offline, mungkin lagi servis laptop',
        'Rafael Sedang offline, mungkin lagi ada acara keluarga',
        'Rafael Sedang offline, mungkin lagi kondangan',
        'Rafael Sedang offline, mungkin lupa bawa charger',
        'Rafael Sedang offline, mungkin device-nya lagi restart',
        'Rafael Sedang offline, mungkin lagi log out sengaja buat fokus',
        'Rafael Sedang offline, mungkin lagi digital detox sebentar',
        'Rafael Sedang offline, mungkin lagi ada urusan mendadak'
      ],

      /* Alasan offline yang terikat jam — dipilih sesuai jam realtime. */
      waktu: {

        /* 00:00 - 03:59 : tengah malam, aktivitas luar/keluarga sudah tutup */
        dini_hari: [
          'Rafael Sedang offline, mungkin baru tidur',
          'Rafael Sedang offline, mungkin lagi tidur malam',
          'Rafael Sedang offline, mungkin udah bobo dari tadi',
          'Rafael Sedang offline, mungkin lagi begadang sambil merem',
          'Rafael Sedang offline, mungkin ketiduran lupa logout'
        ],

        /* 04:00 - 10:59 : rutinitas pagi sebelum aktivitas utama mulai */
        pagi: [
          'Rafael Sedang offline, mungkin lagi tidur pagi',
          'Rafael Sedang offline, mungkin baru bangun terus mandi',
          'Rafael Sedang offline, mungkin lagi sholat subuh',
          'Rafael Sedang offline, mungkin lagi sarapan',
          'Rafael Sedang offline, mungkin lagi siap-siap berangkat sekolah',
          'Rafael Sedang offline, mungkin lagi siap-siap berangkat kuliah',
          'Rafael Sedang offline, mungkin lagi berangkat kerja',
          'Rafael Sedang offline, mungkin lagi lari pagi',
          'Rafael Sedang offline, mungkin lagi olahraga pagi',
          'Rafael Sedang offline, mungkin masih di perjalanan ke sekolah/kantor'
        ],

        /* 11:00 - 14:59 : jam istirahat siang, makan siang, jam terpanas */
        siang: [
          'Rafael Sedang offline, mungkin lagi tidur siang',
          'Rafael Sedang offline, mungkin lagi istirahat siang',
          'Rafael Sedang offline, mungkin lagi sholat dzuhur',
          'Rafael Sedang offline, mungkin lagi makan siang',
          'Rafael Sedang offline, mungkin lagi jam istirahat sekolah/kantor',
          'Rafael Sedang offline, mungkin lagi kepanasan terus rebahan bentar'
        ],

        /* 15:00 - 17:59 : jam pulang sekolah/kerja, olahraga sore */
        sore: [
          'Rafael Sedang offline, mungkin lagi sholat ashar',
          'Rafael Sedang offline, mungkin lagi pulang sekolah',
          'Rafael Sedang offline, mungkin lagi pulang kuliah',
          'Rafael Sedang offline, mungkin lagi pulang kerja',
          'Rafael Sedang offline, mungkin lagi olahraga sore',
          'Rafael Sedang offline, mungkin lagi main futsal',
          'Rafael Sedang offline, mungkin lagi nyantai sore-sore di luar'
        ],

        /* 18:00 - 23:59 : jam makan malam, kumpul keluarga, mulai ngantuk */
        malam: [
          'Rafael Sedang offline, mungkin lagi sholat maghrib',
          'Rafael Sedang offline, mungkin lagi sholat isya',
          'Rafael Sedang offline, mungkin lagi makan malam',
          'Rafael Sedang offline, mungkin lagi kumpul keluarga malam ini',
          'Rafael Sedang offline, mungkin lagi nonton bioskop',
          'Rafael Sedang offline, mungkin lagi nonton konser',
          'Rafael Sedang offline, mungkin lagi jalan-jalan ke mall',
          'Rafael Sedang offline, mungkin lagi liburan',
          'Rafael Sedang offline, mungkin lagi mudik',
          'Rafael Sedang offline, mungkin lagi cuci motor',
          'Rafael Sedang offline, mungkin lagi beres-beres kamar',
          'Rafael Sedang offline, mungkin baru mau tidur',
          'Rafael Sedang offline, mungkin lagi bobo cantik duluan',
          'Rafael Sedang offline, mungkin udah capek terus tidur duluan'
        ]
      }
    },

    /* ------------------------------------------------------------------
       KUNING — Discord online tapi idle (nggak lagi produksi).
       ------------------------------------------------------------------ */
    kuning: {

      /* Alasan idle yang beneran tidak terikat jam — cocok kapan saja.
         Catatan: "main/kasih makan kucing-anjing", "jemur baju", "ambil
         paket/laundry", dsb SENGAJA TIDAK ditaruh di sini lagi — itu
         semua dipindah ke rentang "waktu" karena kenyataannya orang
         nggak jemur baju atau nerima kurir tengah malam. Yang tersisa
         di bawah ini murni yang benar-benar lepas dari jam: aktivitas
         di dalam rumah/di depan device yang bisa kejadian jam berapa
         saja tanpa terasa aneh. */
      netral: [
        'Rafael Sedang idle, mungkin baru diluar',
        'Rafael Sedang idle, mungkin baru bikin kopi',
        'Rafael Sedang idle, mungkin baru bikin teh',
        'Rafael Sedang idle, mungkin baru ambil minum',
        'Rafael Sedang idle, mungkin baru ngemil',
        'Rafael Sedang idle, mungkin lagi rebahan sebentar',
        'Rafael Sedang idle, mungkin lagi scroll HP di kasur',
        'Rafael Sedang idle, mungkin lagi ke kamar mandi',
        'Rafael Sedang idle, mungkin lagi nyapu kamar',
        'Rafael Sedang idle, mungkin lagi cuci piring',
        'Rafael Sedang idle, mungkin lagi lipat baju',
        'Rafael Sedang idle, mungkin lagi nonton YouTube',
        'Rafael Sedang idle, mungkin lagi nonton drakor',
        'Rafael Sedang idle, mungkin lagi baca manga',
        'Rafael Sedang idle, mungkin lagi baca komik',
        'Rafael Sedang idle, mungkin lagi main HP',
        'Rafael Sedang idle, mungkin lagi mabar HP',
        'Rafael Sedang idle, mungkin lagi buka sosmed sebentar',
        'Rafael Sedang idle, mungkin lagi bales chat orang lain',
        'Rafael Sedang idle, mungkin lagi telfonan',
        'Rafael Sedang idle, mungkin lagi video call',
        'Rafael Sedang idle, mungkin lagi dengerin musik sambil santai',
        'Rafael Sedang idle, mungkin lagi rebahan mikir ide baru',
        'Rafael Sedang idle, mungkin lagi stretching sebentar',
        'Rafael Sedang idle, mungkin lagi push up bentar',
        'Rafael Sedang idle, mungkin lagi keluar kamar sebentar',
        'Rafael Sedang idle, mungkin lagi dipanggil orang tua sebentar',
        'Rafael Sedang idle, mungkin lagi buang sampah',
        'Rafael Sedang idle, mungkin lagi charge HP di ruang lain',
        'Rafael Sedang idle, mungkin lagi ganti device',
        'Rafael Sedang idle, mungkin lagi pindah dari HP ke laptop',
        'Rafael Sedang idle, mungkin lagi mikir sambil jalan-jalan kecil',
        'Rafael Sedang idle, mungkin lagi break sebentar dari layar',
        'Rafael Sedang idle, mungkin lagi ngerenggangin badan',
        'Rafael Sedang idle, mungkin lagi cek kulkas',
        'Rafael Sedang idle, mungkin lagi manasin makanan',
        'Rafael Sedang idle, mungkin lagi nyuci muka',
        'Rafael Sedang idle, mungkin lagi gosok gigi',
        'Rafael Sedang idle, mungkin lagi ganti baju',
        'Rafael Sedang idle, mungkin lagi rapihin meja kerja'
      ],

      /* Alasan idle yang terikat jam — dipilih sesuai jam realtime. */
      waktu: {

        /* 00:00 - 03:59 : tengah malam, cuma aktivitas dalam kamar sendiri
           yang masuk akal. Hewan peliharaan & orang rumah lain diasumsikan
           sudah tidur, jadi TIDAK ada alasan "main kucing/anjing" atau
           "ngobrol sama keluarga" di rentang ini. */
        dini_hari: [
          'Rafael Sedang idle, mungkin ketiduran sebentar di depan layar',
          'Rafael Sedang idle, mungkin ngantuk berat tengah malam gini',
          'Rafael Sedang idle, mungkin lagi begadang sambil rebahan'
        ],

        /* 04:00 - 10:59 : rutinitas pagi, rumah mulai ramai lagi jadi
           hewan peliharaan & interaksi keluarga masuk akal di sini */
        pagi: [
          'Rafael Sedang idle, mungkin baru bangun tidur',
          'Rafael Sedang idle, mungkin lagi sarapan',
          'Rafael Sedang idle, mungkin lagi masak buat sarapan',
          'Rafael Sedang idle, mungkin lagi siap-siap berangkat',
          'Rafael Sedang idle, mungkin lagi mandi pagi',
          'Rafael Sedang idle, mungkin lagi olahraga pagi bentar',
          'Rafael Sedang idle, mungkin lagi kasih makan kucing',
          'Rafael Sedang idle, mungkin lagi kasih makan anjing',
          'Rafael Sedang idle, mungkin lagi main sama kucing bentar',
          'Rafael Sedang idle, mungkin lagi main sama anjing bentar',
          'Rafael Sedang idle, mungkin lagi jemur baju',
          'Rafael Sedang idle, mungkin lagi cek jemuran'
        ],

        /* 11:00 - 14:59 : jam makan siang & kurir/laundry biasa datang siang hari */
        siang: [
          'Rafael Sedang idle, mungkin baru masak buat makan siang',
          'Rafael Sedang idle, mungkin lagi makan siang',
          'Rafael Sedang idle, mungkin lagi istirahat siang bentar',
          'Rafael Sedang idle, mungkin lagi ngantuk gara-gara abis makan siang',
          'Rafael Sedang idle, mungkin lagi nonton TV bentar pas jam istirahat',
          'Rafael Sedang idle, mungkin lagi ambil paket',
          'Rafael Sedang idle, mungkin lagi buka pintu buat kurir',
          'Rafael Sedang idle, mungkin lagi ambil laundry',
          'Rafael Sedang idle, mungkin lagi main sama kucing',
          'Rafael Sedang idle, mungkin lagi main sama anjing'
        ],

        /* 15:00 - 17:59 : sore hari, jam santai keluarga di rumah */
        sore: [
          'Rafael Sedang idle, mungkin lagi ngemil sore',
          'Rafael Sedang idle, mungkin lagi santai sore-sore',
          'Rafael Sedang idle, mungkin baru pulang terus rebahan bentar',
          'Rafael Sedang idle, mungkin lagi nyeduh kopi sore',
          'Rafael Sedang idle, mungkin lagi main sama kucing',
          'Rafael Sedang idle, mungkin lagi main sama anjing',
          'Rafael Sedang idle, mungkin lagi cek jemuran sebelum diangkat'
        ],

        /* 18:00 - 23:59 : jam makan malam & kumpul keluarga sebelum tidur */
        malam: [
          'Rafael Sedang idle, mungkin baru masak buat makan malam',
          'Rafael Sedang idle, mungkin lagi makan malam',
          'Rafael Sedang idle, mungkin lagi nonton TV bareng keluarga',
          'Rafael Sedang idle, mungkin lagi kumpul keluarga sebentar',
          'Rafael Sedang idle, mungkin lagi ngobrol sama adik/kakak',
          'Rafael Sedang idle, mungkin lagi nyantai sebelum tidur',
          'Rafael Sedang idle, mungkin lagi rebahan sambil main HP malam-malam'
        ]
      }
    }

  };

})();
