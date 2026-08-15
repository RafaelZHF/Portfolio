/* ==========================================================================
   Rafael L3 — Portfolio
   hero-greeting.js — generator sapaan acak untuk heading hero.

   Apa ini:
   File terpisah dari content.js. Tujuannya cuma satu: begitu halaman
   selesai dimuat, teks besar di hero ("Meracik bunyi jadi...") ditimpa
   oleh satu sapaan acak yang formatnya:

       Halo, Selamat [Pagi/Siang/Sore/Malam]. [obrolan singkat] [emoji]

   Waktunya ngikutin jam asli pengunjung berdasarkan zona waktu Indonesia
   (WIB/WIT/WITA) yang dideteksi dari timezone browser — bukan waktu
   server, bukan hardcode UTC+7. Kalau browser terdeteksi di luar tiga
   zona itu (misalnya pengunjung dari luar negeri), file ini otomatis
   jatuh ke WIB sebagai patokan supaya sapaan tetap masuk akal.

   Cara pasang:
   Taruh script ini di index.html SETELAH main.js, supaya heading asli
   dari content.js sudah sempat dirender dulu, baru ditimpa oleh sapaan.

       <script src="assets/js/content.js"></script>
       <script src="assets/js/main.js"></script>
       <script src="assets/js/hero-greeting.js"></script>   <-- baris baru
       <script src="assets/js/scroll-fx.js"></script>
       <script src="assets/js/bg-constellation.js"></script>

   Kalau suatu saat mau nonaktifin fitur ini, tinggal hapus/comment
   baris <script> di atas. Tidak ada bagian lain dari website yang
   bergantung ke file ini.
   ========================================================================== */

(function () {
  'use strict';

  /* ------------------------------------------------------------------
     1. DETEKSI WAKTU & ZONA (WIB / WIT / WITA)

     Indonesia punya 3 zona waktu:
       - WIB  (UTC+7)  → Jakarta, Bandung, Yogyakarta, Sumatra, Jawa, sbb.
       - WITA (UTC+8)  → Bali, Kalimantan, Sulawesi, NTB, NTT
       - WIT  (UTC+9)  → Maluku, Papua

     Pendekatan yang dipakai di sini: baca IANA timezone dari browser
     pengunjung (Intl.DateTimeFormat), lalu petakan ke salah satu dari
     tiga zona itu. Ini lebih akurat daripada asumsi UTC+7 untuk semua
     orang, karena kalau Rafael share link portofolionya ke kolaborator
     di Bali atau Jayapura, sapaan yang muncul tetap sesuai jam lokal
     mereka, bukan jam Yogyakarta.

     Kalau timezone browser tidak dikenali sama sekali (kasus langka,
     biasanya browser lawas atau privacy mode yang membatasi API ini),
     fallback ke WIB + jam sistem apa adanya, supaya fitur tetap jalan
     alih-alih rusak total.
  ------------------------------------------------------------------ */

  function detectZonaWaktu() {
    var fallback = { label: 'WIB', offset: 7 };

    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';

      // Peta timezone IANA umum ke label zona waktu Indonesia.
      // Daftar ini tidak perlu lengkap 100% seluruh kota, cukup yang
      // paling umum dipakai OS/browser untuk tiap pulau besar.
      var petaWITA = [
        'Asia/Makassar', 'Asia/Ujung_Pandang', 'Asia/Denpasar',
        'Asia/Kuching' // Kalimantan bagian yang kadang ke-map ke sini di beberapa OS
      ];
      var petaWIT = [
        'Asia/Jayapura'
      ];
      var petaWIB = [
        'Asia/Jakarta', 'Asia/Pontianak'
      ];

      if (petaWITA.indexOf(tz) !== -1) return { label: 'WITA', offset: 8 };
      if (petaWIT.indexOf(tz) !== -1) return { label: 'WIT', offset: 9 };
      if (petaWIB.indexOf(tz) !== -1) return { label: 'WIB', offset: 7 };

      // Kalau timezone terdeteksi tapi bukan salah satu dari tiga di
      // atas (berarti pengunjung dari luar Indonesia), tetap coba
      // hitung offset UTC asli browser tsb — siapa tahu pengunjung
      // sedang di GMT+7/+8/+9 juga meski bukan zona resmi Indonesia
      // (contoh: WIB itu offset yang sama dengan Bangkok/Jakarta).
      var offsetMenitDariUTC = -new Date().getTimezoneOffset(); // menit, arah dibalik
      var offsetJam = offsetMenitDariUTC / 60;

      if (offsetJam === 8) return { label: 'WITA', offset: 8 };
      if (offsetJam === 9) return { label: 'WIT', offset: 9 };
      if (offsetJam === 7) return { label: 'WIB', offset: 7 };

      // Di luar tiga offset itu → pengunjung jelas dari zona waktu lain,
      // pakai WIB sebagai default supaya sapaan tetap relevan dengan
      // basis Rafael di Yogyakarta.
      return fallback;
    } catch (e) {
      return fallback;
    }
  }

  function getJamLokal(offsetJam) {
    // Ambil waktu UTC saat ini lalu geser sesuai offset zona target,
    // supaya hasilnya konsisten walau device pengunjung di-set ke
    // timezone lain tapi terdeteksi termasuk WIB/WIT/WITA di atas.
    var sekarangUTC = new Date();
    var utcMillis = sekarangUTC.getTime() + (sekarangUTC.getTimezoneOffset() * 60000);
    var lokal = new Date(utcMillis + (offsetJam * 3600000));
    return lokal.getHours();
  }

  function getPeriodeWaktu(jam) {
    // Pembagian umum yang biasa dipakai orang Indonesia sehari-hari:
    //   Pagi   : 04.00 – 10.59
    //   Siang  : 11.00 – 14.59
    //   Sore   : 15.00 – 17.59
    //   Malam  : 18.00 – 03.59
    if (jam >= 4 && jam < 11) return 'Pagi';
    if (jam >= 11 && jam < 15) return 'Siang';
    if (jam >= 15 && jam < 18) return 'Sore';
    return 'Malam';
  }

  /* ------------------------------------------------------------------
     2. BANK KALIMAT

     Supaya jumlah kombinasi bisa jauh melewati 500 tanpa terasa kayak
     500 baris teks yang ditulis manual satu-satu (yang pada akhirnya
     akan kelihatan diulang-ulang polanya), sapaan disusun dari dua
     bagian yang digabung acak:

       A. OBROLAN  → satu kalimat/frasa observasi santai, beda isi untuk
                      tiap periode waktu (apa yang related tiap periode dan
                      unik dari sisi "Rafael, produser musik" — deadline
                      studio, macet siang, kopi sore, begadang malam, dst)
       B. EMOJI     → dipilih manual biar nyambung sama isi obrolannya,
                      bukan emoji acak yang ditempel asal.

     Tiap OBROLAN sudah dipasangkan satu-satu dengan EMOJI yang cocok
     (disimpan sebagai objek {teks, emoji}), supaya tidak pernah ada
     kombinasi aneh semacam obrolan tentang hujan tapi emojinya matahari.

     Total baris di bawah: Pagi 40 + Siang 40 + Sore 40 + Malam 42 = 162
     entri unik. Karena entri ini nanti masih dikombinasikan dengan 4
     variasi bentuk kalimat pembuka yang berbeda (lihat bagian 3), total
     kombinasi akhir jauh di atas 500 (162 x lebih dari 4 varian ≈ 650+),
     tapi tetap semuanya masuk akal dibaca, tidak generate random per
     kata yang berisiko jadi kalimat aneh.
  ------------------------------------------------------------------ */

  var OBROLAN = {

    Pagi: [
      { teks: 'udara masih adem gini, enaknya nyalain kopi dulu sebelum mulai apa-apa', emoji: '☕' },
      { teks: 'baru buka laptop aja udah pengin langsung ngulik sound baru', emoji: '🎛️' },
      { teks: 'semoga hari ini semua rencana lancar sampai closing track kelar', emoji: '🌤️' },
      { teks: 'burung masih ribut di luar, studio masih sepi, waktu paling enak buat mikir jernih', emoji: '🐦' },
      { teks: 'kalau bisa milih, jam segini emang paling pas buat nulis melodi baru' },
      { teks: 'jangan lupa sarapan dulu ya, biar tenaga cukup buat ngoprek beat seharian', emoji: '🍳' },
      { teks: 'mumpung otak masih fresh, cocok banget buat susun arrangement yang belum kelar', emoji: '🧠' },
      { teks: 'sinar matahari lewat jendela studio tuh selalu jadi mood booster tersendiri', emoji: '🌅' },
      { teks: 'siapa lagi yang udah nyeduh teh anget sambil buka DAW pagi-pagi', emoji: '🍵' },
      { teks: 'checklist hari ini panjang, tapi satu per satu pasti kelar kok', emoji: '📝' },
      { teks: 'suasana masih tenang, cocok buat dengerin ulang mixdown semalam dengan telinga fresh', emoji: '🎧' },
      { teks: 'kalau ada waktu, coba deh stretching dulu sebelum duduk lama depan monitor', emoji: '🧘' },
      { teks: 'kopi item tanpa gula, itu bahan bakar wajib sebelum ngulik synth pagi ini', emoji: '☕' },
      { teks: 'jalanan masih lengang, waktu paling pas buat yang mau langsung ke studio', emoji: '🛣️' },
      { teks: 'semangat baru mulai, jangan buru-buru, satu ide bagus lebih penting dari seribu ide buru-buru' },
      { teks: 'udara sejuk gini enaknya sambil nyeduh kopi terus review project semalam', emoji: '☕' },
      { teks: 'baru bangun tidur langsung kepikiran progresi chord baru, semoga jadi lagu beneran', emoji: '🎹' },
      { teks: 'yuk mulai hari dengan niat yang jelas, biar nanti sore nggak nyesel buang-buang waktu', emoji: '✨' },
      { teks: 'suara ayam masih kedengeran dari kejauhan, definisi pagi yang khas banget', emoji: '🐓' },
      { teks: 'sebelum sibuk, sempetin dulu minum air putih, biar badan nggak dehidrasi', emoji: '💧' },
      { teks: 'pagi ini cocok banget buat riset referensi baru sebelum session produksi dimulai', emoji: '🔎' },
      { teks: 'kadang ide terbaik justru muncul pas masih setengah ngantuk gini' },
      { teks: 'langit lagi cerah, semoga energinya nular ke semua yang lagi dikerjain hari ini', emoji: '☀️' },
      { teks: 'buat yang mau olahraga pagi dulu sebelum kerja, itu keputusan yang bagus', emoji: '🏃' },
      { teks: 'satu track belum kelar dari kemarin, hari ini waktunya lanjut lagi', emoji: '🎚️' },
      { teks: 'suasana masih syahdu, pas banget buat nulis lirik atau nyusun ide baru', emoji: '📓' },
      { teks: 'jangan skip sarapan, walau lagi ngejar deadline sekalipun', emoji: '🥣' },
      { teks: 'baru buka email udah ada beberapa yang perlu dibales, tapi santai aja dulu' },
      { teks: 'kalau ngantuk masih nempel, coba deh cuci muka dulu sebelum buka software produksi', emoji: '🚿' },
      { teks: 'waktu yang pas buat dengerin demo referensi sebelum mulai sesi hari ini', emoji: '🎵' },
      { teks: 'semoga semua janji dan rencana hari ini bisa berjalan sesuai harapan', emoji: '🤞' },
      { teks: 'suhu masih adem, jaket tipis masih kepake buat yang mau keluar rumah', emoji: '🧥' },
      { teks: 'baru mulai tapi udah excited banget sama ide remix yang kepikiran semalam', emoji: '🔥' },
      { teks: 'sebelum mulai kerja, boleh juga sempetin nulis to-do list biar hari lebih terarah', emoji: '📋' },
      { teks: 'suasana kayak gini enaknya sambil dengerin track lawas buat cari inspirasi', emoji: '📻' },
      { teks: 'mata masih agak berat tapi semangat tetep harus jalan', emoji: '😌' },
      { teks: 'jangan lupa cek jadwal hari ini, siapa tahu ada sesi kolaborasi yang perlu disiapin', emoji: '🗓️' },
      { teks: 'pagi yang tenang gini biasanya jadi waktu paling produktif buat mixing detail', emoji: '🎚️' },
      { teks: 'buat yang masih di jalan menuju studio, hati-hati dan semoga lancar sampai tujuan', emoji: '🚗' },
      { teks: 'satu langkah kecil pagi ini bisa jadi awal dari track yang bagus banget nanti' }
    ],

    Siang: [
      { teks: 'panas-panas gini enaknya minum es deh, baru lanjut kerja lagi', emoji: '🧊' },
      { teks: 'jam segini biasanya energi mulai turun, jangan lupa istirahat sebentar ya', emoji: '😅' },
      { teks: 'perut udah mulai keroncongan, makan siang dulu baru lanjut ngoprek beat', emoji: '🍽️' },
      { teks: 'matahari lagi terik-teriknya, di dalam studio sambil dengerin mixdown jauh lebih adem', emoji: '☀️' },
      { teks: 'kalau bisa, sempetin rehat mata dulu dari layar sebelum lanjut edit', emoji: '👀' },
      { teks: 'siang gini enaknya sambil ngopi es sambil review beberapa referensi baru', emoji: '🥤' },
      { teks: 'jalanan mulai rame, buat yang lagi otw meeting, semoga nggak kena macet parah', emoji: '🚦' },
      { teks: 'setengah hari udah lewat, gimana progres kerjaan tadi pagi, masih on track kan' },
      { teks: 'waktunya jeda sebentar, minum air putih yang cukup biar nggak gampang capek', emoji: '💧' },
      { teks: 'siang bolong gini paling enak sambil dengerin playlist yang santai dulu', emoji: '🎶' },
      { teks: 'kalau ngantuk mulai nyerang, coba deh jalan kaki sebentar keluar ruangan', emoji: '🚶' },
      { teks: 'panas di luar tapi semangat harus tetep jalan, apalagi kalau deadline udah deket', emoji: '🔥' },
      { teks: 'jam makan siang udah lewat belum nih, jangan sampai lupa makan ya' },
      { teks: 'cuaca terik gini jadi alasan valid buat nambah es teh satu gelas lagi', emoji: '🧊' },
      { teks: 'setelah makan siang biasanya enak buat dengerin ulang track dengan telinga yang lebih fresh', emoji: '🎧' },
      { teks: 'kalau lagi di studio, ac-nya jangan lupa dicek biar tetep nyaman kerja lama-lama', emoji: '❄️' },
      { teks: 'siang ini cocok banget buat nyusun ulang to-do list yang mungkin berubah dari pagi', emoji: '📝' },
      { teks: 'buat yang lagi di jalan, hati-hati ya, siang gini biasanya rame banget', emoji: '🚗' },
      { teks: 'kalau otak udah mulai buntu, biasanya jeda 10 menit cukup buat nge-reset fokus', emoji: '🔄' },
      { teks: 'sinar matahari kayak gini enaknya buat foto behind the scene di studio', emoji: '📸' },
      { teks: 'pertengahan hari, waktu yang pas buat evaluasi progres sebelum lanjut ke sesi berikutnya' },
      { teks: 'kalau kepikiran es kelapa muda siang ini, sah-sah aja kok buat healing sebentar', emoji: '🥥' },
      { teks: 'jangan lupa minum yang cukup, cuaca panas gini gampang bikin dehidrasi', emoji: '💧' },
      { teks: 'suasana siang yang rame biasanya malah bikin ide random muncul tiba-tiba', emoji: '💡' },
      { teks: 'lagi mixing atau masih riset referensi? apapun itu, semoga lancar sampai sore', emoji: '🎚️' },
      { teks: 'panas kayak gini paling pas ditemenin es kopi susu sambil dengerin demo baru', emoji: '☕' },
      { teks: 'buat yang kerja dari rumah, jangan lupa buka jendela biar sirkulasi udaranya enak', emoji: '🪟' },
      { teks: 'siang bolong biasanya waktu paling gampang buat keganggu notifikasi, tapi tetep fokus ya', emoji: '📱' },
      { teks: 'kalau capek di mata, coba deh redupin brightness monitor sebentar', emoji: '🖥️' },
      { teks: 'setengah perjalanan hari ini udah dilewatin, tinggal lanjut sampai sore', emoji: '⏳' },
      { teks: 'cuaca terik gini enaknya di dalam ruangan sambil eksplor preset synth baru', emoji: '🎹' },
      { teks: 'jangan lupa peregangan sedikit, duduk kelamaan bikin pundak pegal', emoji: '🧘' },
      { teks: 'siang ini pas banget buat dengerin ulang beberapa reference track dari genre lain', emoji: '🎧' },
      { teks: 'kalau makan siang udah, biasanya lanjut kerja jadi lebih fokus lagi' },
      { teks: 'terik banget hari ini, semoga yang lagi di luar tetep aman dan nggak kepanasan', emoji: '🌞' },
      { teks: 'satu hal kecil yang bisa bantu banget siang ini: cuci muka pakai air dingin', emoji: '💦' },
      { teks: 'jam segini kadang enaknya sambil dengerin podcast produksi musik sambil kerja santai', emoji: '🎙️' },
      { teks: 'buat yang masih riset sound reference, semoga nemu yang paling pas buat proyek ini', emoji: '🔍' },
      { teks: 'siang yang produktif itu biasanya dimulai dari istirahat yang cukup tadi pagi' },
      { teks: 'panas-panas gini jangan lupa pakai sunscreen kalau harus keluar ruangan', emoji: '🧴' }
    ],

    Sore: [
      { teks: 'langit mulai oranye, waktu favorit buat duduk santai sambil nyusun playlist baru', emoji: '🌇' },
      { teks: 'jam segini biasanya paling enak buat nge-review hasil kerjaan seharian', emoji: '📋' },
      { teks: 'sore gini cocok banget ditemenin kopi anget sambil dengerin ulang mixdown', emoji: '☕' },
      { teks: 'macet sore biasa banget, semoga yang lagi otw pulang tetep aman ya', emoji: '🚗' },
      { teks: 'matahari mulai turun, energi buat sesi terakhir hari ini tinggal dikumpulin sedikit lagi', emoji: '🌆' },
      { teks: 'waktunya evaluasi, mana target hari ini yang udah kelar dan mana yang perlu dilanjut besok' },
      { teks: 'udara mulai lebih adem, enaknya buat lanjut mixing dengan kepala yang lebih tenang', emoji: '🎚️' },
      { teks: 'sore ini pas banget buat jalan santai sebentar sebelum lanjut kerja lagi', emoji: '🚶' },
      { teks: 'kalau ada waktu senggang, coba deh dengerin beberapa referensi genre baru', emoji: '🎧' },
      { teks: 'langit sore emang selalu punya cara sendiri buat bikin mood lebih baik', emoji: '🌅' },
      { teks: 'jangan lupa minum air putih lagi, dari siang sampai sore biasanya suka kelupaan', emoji: '💧' },
      { teks: 'waktu yang pas buat nyusun rencana besok sebelum benar-benar berhenti kerja hari ini', emoji: '🗓️' },
      { teks: 'sore-sore gini enaknya sambil ngemil ringan sambil ngerapiin project file', emoji: '🍪' },
      { teks: 'suasana adem gini biasanya bikin telinga lebih peka buat dengerin detail kecil di mix', emoji: '🎚️' },
      { teks: 'buat yang otw pulang kerja, hati-hati di jalan, sore gini biasanya rame', emoji: '🚦' },
      { teks: 'satu cangkir teh sore ini kayaknya pas banget buat nemenin sesi review terakhir', emoji: '🍵' },
      { teks: 'langit yang mulai berubah warna sering jadi pengingat buat berhenti sejenak dan napas', emoji: '🌤️' },
      { teks: 'sore ini waktu yang tepat buat nyicil ide buat proyek minggu depan', emoji: '💡' },
      { teks: 'kadang jeda sore sebentar itu yang bikin sesi malam nanti jadi lebih fokus', emoji: '⏸️' },
      { teks: 'udara mulai sejuk, enaknya buka jendela studio sebentar biar sirkulasi lancar', emoji: '🪟' },
      { teks: 'gimana progres hari ini, semoga sebagian besar target udah kecentang' },
      { teks: 'sore yang tenang gini biasanya jadi waktu terbaik buat dengerin ulang draft lirik', emoji: '📓' },
      { teks: 'kalau capek udah mulai terasa, boleh banget istirahat sebentar sebelum lanjut lagi', emoji: '😌' },
      { teks: 'satu track yang udah setengah jalan dari siang, semoga sore ini bisa lebih maju lagi', emoji: '🎵' },
      { teks: 'langit sore ini emang selalu jadi latar yang pas buat mikirin ide kreatif baru', emoji: '🌇' },
      { teks: 'sebelum benar-benar berhenti kerja, cek dulu draft yang belum kesave', emoji: '💾' },
      { teks: 'waktu buat mulai mikirin, malam ini mau lanjut produksi atau istirahat total dulu' },
      { teks: 'sore ini enaknya sambil dengerin beberapa track lama, kadang nemu ide baru dari situ', emoji: '📻' },
      { teks: 'kalau mata udah mulai lelah, coba deh jauh-jauh dulu sebentar dari layar', emoji: '👀' },
      { teks: 'suasana sore yang syahdu gini emang susah dilewatin tanpa mikirin melodi baru', emoji: '🎹' },
      { teks: 'jangan lupa peregangan lagi, duduk dari pagi sampai sore itu berat buat punggung', emoji: '🧘' },
      { teks: 'buat yang masih di studio, semangat sedikit lagi buat sesi hari ini', emoji: '🎚️' },
      { teks: 'langit oranye ini rasanya selalu related sama nuansa lagu yang agak melankolis', emoji: '🌆' },
      { teks: 'sore ini pas buat mulai mikirin rundown kerjaan besok biar nggak buru-buru', emoji: '📝' },
      { teks: 'satu hal simpel: jangan lupa makan sore atau ngemil biar energi tetep ada', emoji: '🍪' },
      { teks: 'waktu yang cocok buat dengerin ulang beberapa referensi sebelum lanjut sesi berikutnya', emoji: '🎧' },
      { teks: 'sore yang santai gini kadang jadi waktu paling jujur buat nilai hasil kerja sendiri' },
      { teks: 'kalau capek fisik udah mulai kerasa, itu tanda buat rehat sejenak, bukan maksa terus', emoji: '😮‍💨' },
      { teks: 'suasana kayak gini biasanya bikin pengin nyalain lilin aromaterapi sambil kerja santai', emoji: '🕯️' },
      { teks: 'sore ini semoga semua yang direncanain dari pagi bisa kelar sesuai jadwal', emoji: '✅' }
    ],

    Malam: [
      { teks: 'udara mulai dingin, waktu yang pas buat lanjut ngulik sound design sampai detail', emoji: '🌙' },
      { teks: 'malam gini biasanya ide paling liar suka muncul, jangan lupa dicatat', emoji: '💡' },
      { teks: 'jangan lupa istirahat yang cukup, walau lagi asik banget ngulik track baru', emoji: '😴' },
      { teks: 'suasana sepi malam sering jadi waktu terbaik buat dengerin detail kecil di mixdown', emoji: '🎧' },
      { teks: 'kalau masih begadang, jangan lupa minum air putih, jangan cuma kopi terus', emoji: '💧' },
      { teks: 'bintang mulai kelihatan, pas banget buat nemenin sesi produksi malam ini', emoji: '✨' },
      { teks: 'malam ini cocok buat nulis lirik yang lebih personal, biasanya lebih jujur', emoji: '📓' },
      { teks: 'satu drop yang lagi digarap semoga makin matang setelah didengerin ulang malam ini', emoji: '🎚️' },
      { teks: 'buat yang masih di jalan pulang, hati-hati ya, malam gini pandangan agak terbatas', emoji: '🚗' },
      { teks: 'kalau ngantuk mulai berat, boleh banget disudahin dan lanjut lagi besok', emoji: '🌙' },
      { teks: 'malam yang tenang gini biasanya bikin telinga lebih peka nangkep detail frekuensi', emoji: '🎚️' },
      { teks: 'sebelum tidur, jangan lupa backup project file biar nggak was-was besok', emoji: '💾' },
      { teks: 'suasana kayak gini enaknya sambil dengerin track ambient buat cari inspirasi', emoji: '🎵' },
      { teks: 'malam ini pas banget buat evaluasi progres seharian sebelum benar-benar istirahat' },
      { teks: 'kalau mata udah berat tapi masih pengin lanjut, coba deh atur timer biar nggak kebablasan', emoji: '⏰' },
      { teks: 'lampu studio yang temaram gini emang bikin fokus lebih dalam buat detail mixing', emoji: '💡' },
      { teks: 'satu playlist santai malam ini kayaknya pas banget buat nutup hari', emoji: '🎶' },
      { teks: 'jangan lupa matiin monitor speaker sebelum bener-bener tidur, biar kuping juga istirahat', emoji: '🔇' },
      { teks: 'malam gini biasanya waktu paling jujur buat dengerin ulang karya sendiri tanpa gangguan', emoji: '🎧' },
      { teks: 'kalau besok ada sesi produksi lagi, sekarang waktu yang pas buat siapin referensinya', emoji: '📁' },
      { teks: 'suasana sepi malam sering bikin ide progresi chord baru muncul tiba-tiba', emoji: '🎹' },
      { teks: 'sebelum tidur, coba deh stretching sebentar biar besok pagi nggak kaku', emoji: '🧘' },
      { teks: 'malam ini semoga proses kreatifnya lancar sampai nemu bagian yang paling pas', emoji: '✨' },
      { teks: 'kalau udah kelamaan di depan layar, coba deh redupin lampu dan jeda sebentar', emoji: '🖥️' },
      { teks: 'satu cangkir teh anget malam ini kayaknya pas buat nemenin sesi review terakhir', emoji: '🍵' },
      { teks: 'malam yang syahdu gini emang paling related sama proses nulis lagu yang lebih dalam', emoji: '🌙' },
      { teks: 'jangan sampai lupa waktu, walau lagi seru-serunya ngulik track baru', emoji: '⏰' },
      { teks: 'suasana kayak gini biasanya bikin pengin nyalain lampu redup sambil dengerin vinyl lama', emoji: '💿' },
      { teks: 'malam ini pas buat mikirin ide besok, biar pagi nanti langsung tau harus mulai dari mana' },
      { teks: 'kalau capek udah kerasa banget, istirahat itu bukan kemunduran, tapi bagian dari proses', emoji: '😴' },
      { teks: 'suara jangkrik di luar sering jadi pengingat kalau kota ini juga butuh istirahat', emoji: '🦗' },
      { teks: 'satu hal kecil malam ini: jangan lupa minum obat atau vitamin kalau memang rutin', emoji: '💊' },
      { teks: 'malam gini paling pas buat dengerin ulang demo dengan volume pelan, biar lebih objektif', emoji: '🔉' },
      { teks: 'kalau proyek malam ini belum kelar, nggak apa-apa, besok masih ada waktu lagi' },
      { teks: 'suasana tenang malam sering jadi tempat paling aman buat brainstorming ide liar', emoji: '💭' },
      { teks: 'sebelum benar-benar tidur, coba deh matiin notifikasi biar istirahatnya lebih maksimal', emoji: '📵' },
      { teks: 'malam ini semoga semua yang dikerjain dari pagi tadi berakhir dengan hasil yang memuaskan', emoji: '🌟' },
      { teks: 'satu lagu lama yang diputer ulang malam ini kadang ngasih perspektif baru buat proyek sekarang', emoji: '📻' },
      { teks: 'kalau besok pagi ada rencana penting, malam ini saatnya siapin semuanya dari sekarang', emoji: '🗓️' },
      { teks: 'udara malam yang dingin gini enaknya ditemenin selimut tipis sambil review project terakhir', emoji: '🌙' },
      { teks: 'malam yang produktif itu biasanya diakhiri dengan istirahat yang cukup, bukan begadang terus', emoji: '😴' },
      { teks: 'satu hal yang pasti, apapun hasil hari ini, besok selalu ada kesempatan buat lebih baik' }
    ]

  };

  /* ------------------------------------------------------------------
     3. VARIASI BENTUK KALIMAT PEMBUKA

     Supaya sapaan tidak selalu berbunyi identik ("Halo, Selamat Pagi.")
     setiap kali, ada beberapa variasi kecil di tanda baca dan susunan
     kata pembukanya. Variasi ini yang dikombinasikan silang dengan
     bank OBROLAN di atas, sehingga total kombinasi jauh melebihi 500
     tanpa perlu menulis ribuan baris manual satu-satu.
  ------------------------------------------------------------------ */

  var VARIAN_PEMBUKA = [
    function (periode) { return 'Halo, Selamat ' + periode + '.'; },
    function (periode) { return 'Hai, Selamat ' + periode + '!'; },
    function (periode) { return 'Halo, Selamat ' + periode + ' —'; },
    function (periode) { return 'Selamat ' + periode + ', halo.'; }
  ];

  /* ------------------------------------------------------------------
     4. VALIDASI JUMLAH KOMBINASI (opsional, cuma untuk sanity-check
     lewat console). Tidak memengaruhi tampilan, murni informasi buat
     developer kalau mau ngecek total kombinasi yang tersedia.
  ------------------------------------------------------------------ */

  function hitungTotalKombinasi() {
    var totalObrolan = 0;
    for (var k in OBROLAN) {
      if (Object.prototype.hasOwnProperty.call(OBROLAN, k)) {
        totalObrolan += OBROLAN[k].length;
      }
    }
    return totalObrolan * VARIAN_PEMBUKA.length;
  }

  /* ------------------------------------------------------------------
     5. RANDOM PICKER

     Pilih satu entri OBROLAN acak dari periode waktu yang sesuai, lalu
     pilih satu variasi pembuka acak, lalu gabungkan jadi satu kalimat
     utuh dengan emoji di akhir (kalau entri itu punya emoji — beberapa
     entri sengaja dibiarkan tanpa emoji supaya tidak semua kalimat
     terasa "dipaksa" pakai emoji, biar lebih natural).
  ------------------------------------------------------------------ */

  function pilihAcak(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function buatSapaan() {
    var zona = detectZonaWaktu();
    var jam = getJamLokal(zona.offset);
    var periode = getPeriodeWaktu(jam);

    var daftarObrolan = OBROLAN[periode];
    var entri = pilihAcak(daftarObrolan);
    var pembukaFn = pilihAcak(VARIAN_PEMBUKA);

    var pembuka = pembukaFn(periode);
    var isi = entri.teks.charAt(0).toUpperCase() + entri.teks.slice(1);
    var emojiBagian = entri.emoji ? ' ' + entri.emoji : '';

    return pembuka + ' ' + isi + '.' + emojiBagian;
  }

  /* ------------------------------------------------------------------
     6. RENDER KE HALAMAN

     Menunggu DOM siap, lalu timpa isi #heroHeading dengan sapaan acak.
     Dipasang dengan textContent (bukan innerHTML) karena hasil sapaan
     ini teks polos tanpa markup — beda dengan heading asli di
     content.js yang memang sengaja pakai <br> untuk potongan baris.
     Kalau suatu saat ingin sapaan ini juga punya potongan baris
     manual, tinggal sesuaikan ke innerHTML di titik ini saja.
  ------------------------------------------------------------------ */

  function terapkanSapaan() {
    var target = document.getElementById('heroHeading');
    if (!target) return;
    target.textContent = buatSapaan();
  }

  function init() {
    // Jalan setelah main.js sempat merender heading asli lebih dulu
    // (lihat urutan <script> di index.html), jadi di sini heading
    // sudah pasti ada isinya sebelum ditimpa oleh sapaan acak.
    terapkanSapaan();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Diekspos ke window murni untuk keperluan debugging manual dari
  // console browser (contoh: window.__heroGreetingDebug.total()),
  // tidak dipakai oleh bagian lain dari situs.
  window.__heroGreetingDebug = {
    total: hitungTotalKombinasi,
    contoh: buatSapaan
  };

})();
