/* ==========================================================================
   Rafael L3 — Portfolio
   fetch-status.js — status "sedang apa sekarang" di badge hero, diambil
   realtime dari Discord lewat Lanyard API (https://github.com/Phineas/lanyard).

   Apa ini:
   File terpisah dari content.js & main.js. Tugasnya cuma satu: menimpa
   titik + teks di badge hero ("● Sedang menggarap materi baru di studio")
   supaya warnanya dan tulisannya mengikuti status Discord asli secara
   realtime, bukan teks statis yang ditulis tangan di content.js.

   Tiga mode:
     🔴 MERAH   → Discord offline / tidak terhubung sama sekali.
     🟡 KUNING  → Discord online tapi lagi idle (nggak lagi produksi).
     🟢 HIJAU   → Discord online DAN sedang membuka salah satu aplikasi
                  produksi yang dipantau (lihat APLIKASI_DIPANTAU di
                  bawah) — teks badge otomatis berganti jadi nama
                  aplikasi itu.

   Cara kerja singkat:
   1. Ambil status awal lewat REST API (sekali saja, cepat) supaya badge
      langsung terisi begitu halaman dibuka, tidak nunggu WebSocket.
   2. Buka koneksi WebSocket ke Lanyard supaya update berikutnya realtime
      tanpa perlu polling berulang-ulang.
   3. Kalau WebSocket putus (internet goyang, laptop sleep, tab lama di
      background, dll), otomatis nyambung lagi dengan jeda yang makin
      lama tiap percobaan (exponential backoff) — supaya tidak mbombardir
      server Lanyard dengan permintaan connect bertubi-tubi.
   4. Kalau WebSocket gagal terus lebih dari beberapa kali berturut-turut,
      otomatis pindah ke mode "polling" (REST API dicek ulang tiap
      beberapa menit) supaya badge tetap ada isinya walau tidak realtime.

   Wajib diisi sebelum dipakai:
   Ganti nilai DISCORD_USER_ID di bawah ini dengan User ID Discord kamu
   sendiri (bukan username, tapi angka panjang — aktifkan Developer Mode
   di Discord: Setelan > Advanced > Developer Mode, lalu klik-kanan nama
   kamu > Copy User ID). Lanyard cuma bisa memantau akun yang sudah
   join server Discord resminya: https://discord.gg/lanyard — kalau
   belum join, presence tidak akan pernah muncul walau ID sudah benar.

   Cara pasang:
   Taruh script ini di index.html SETELAH main.js (supaya elemen
   #heroBadgeText sudah pasti ada isinya dulu dari content.js, baru
   ditimpa oleh status realtime). Boleh sebelum atau sesudah
   hero-greeting.js, karena keduanya menimpa elemen yang berbeda
   (hero-greeting.js menimpa heading, file ini menimpa badge).

       <script src="assets/js/content.js"></script>
       <script src="assets/js/main.js"></script>
       <script src="assets/js/for-reason.js"></script>     <-- opsional, taruh SEBELUM baris ini
       <script src="assets/js/fetch-status.js"></script>   <-- baris baru
       <script src="assets/js/hero-greeting.js"></script>
       <script src="assets/js/scroll-fx.js"></script>
       <script src="assets/js/bg-constellation.js"></script>

   Soal for-reason.js (opsional):
   File terpisah lain, for-reason.js, berisi daftar 50+ alasan random
   untuk teks status MERAH & KUNING (lihat komentar di file itu). Kalau
   dipasang SEBELUM fetch-status.js ini, badge akan menampilkan alasan
   acak yang berbeda-beda tiap kali statusnya berubah jadi offline/idle,
   bukan cuma satu kalimat tetap. Kalau file itu tidak dipasang, tidak
   masalah — fetch-status.js otomatis pakai teks statis tunggal dari
   TEKS_STATUS di bawah, sama seperti sebelum for-reason.js ada.

   Kalau suatu saat mau nonaktifin fitur ini, tinggal hapus/comment
   baris <script> di atas. Badge akan otomatis kembali ke teks statis
   dari content.js seperti semula — tidak ada bagian lain dari website
   yang bergantung ke file ini.
   ========================================================================== */

(function () {
  'use strict';

  /* ========================================================================
     1. KONFIGURASI — bagian yang boleh/perlu diubah manual.
     ======================================================================== */

  /* WAJIB DIISI. User ID Discord (angka panjang), bukan username.
     Lihat catatan "Wajib diisi sebelum dipakai" di komentar atas. */
  var DISCORD_USER_ID = '1138565660671221820';

  /* Daftar aplikasi produksi yang dipantau untuk status HIJAU.
     - "cocok": kata kunci yang dicari di dalam nama aktivitas Discord
       (huruf besar/kecil diabaikan, dan cukup mengandung kata kunci ini
       — jadi "Ableton Live 12" tetap cocok dengan kata kunci "ableton").
     - "label": teks yang akan tampil di badge kalau aplikasi ini yang
       lagi dibuka. Kalau dikosongkan (''), label memakai nama aktivitas
       asli yang dikirim oleh Discord apa adanya.
     Mau nambah/ganti aplikasi yang dipantau? Tinggal tambah/ubah baris
     di array ini, tidak perlu sentuh bagian lain dari file. */
  var APLIKASI_DIPANTAU = [
    { cocok: 'fl studio', label: 'FL Studio 26' },
    { cocok: 'acid pro', label: 'ACID Pro 11 Suite' },
    { cocok: 'ableton', label: 'Ableton' },
    { cocok: 'cubase', label: 'Cubase' }
  ];

  /* Teks badge untuk tiap mode selain HIJAU (HIJAU pakai "label" di atas).
     Ini teks FALLBACK/default — dipakai kalau for-reason.js belum
     dipasang, atau kalau window.ALASAN_STATUS ternyata kosong/rusak.
     Kalau for-reason.js aktif dan isinya valid, fungsi ambilTeksAcak()
     di bawah akan memilih baris acak dari sana untuk merah & kuning,
     BUKAN dari sini. */
  var TEKS_STATUS = {
    merah: 'Rafael Sedang offline, mungkin baru tidur',
    kuning: 'Rafael Sedang idle, mungkin baru diluar',
    /* Dipakai kalau Discord online/dnd tapi TIDAK ketahuan lagi buka
       salah satu APLIKASI_DIPANTAU (misal cuma browsing atau chat).
       Diperlakukan sama seperti kuning karena artinya "online, tapi
       belum tentu lagi produksi" — bukan aktif menggarap materi.
       Catatan: baris ini SELALU dipakai apa adanya (tidak diacak lewat
       for-reason.js), karena ini bukan "alasan idle" tapi memang teks
       tetap untuk kondisi "online tapi bukan lagi di aplikasi produksi". */
    aktifTanpaAplikasi: 'Rafael Online!, Sedang Produksi'
  };

  /* Mengambil satu baris teks acak dari window.ALASAN_STATUS (diisi oleh
     for-reason.js) untuk warna 'merah' atau 'kuning'. Kalau file itu
     belum dipasang, atau strukturnya kosong/rusak, otomatis jatuh balik
     ke TEKS_STATUS di atas supaya badge tetap terisi teks yang valid —
     tidak pernah sampai kosong gara-gara sumber acak ini.

     Struktur yang diharapkan dari for-reason.js untuk tiap warna:
       { netral: [...], waktu: { dini_hari: [...], pagi: [...], ... } }
     "netral" selalu ikut jadi kandidat, "waktu" cuma yang rentangnya
     cocok sama jam sekarang (lihat ambilRentangWaktuSekarang di bawah)
     yang ikut ditambahkan sebagai kandidat. Baris diacak dari gabungan
     keduanya, supaya alasan yang nyinggung waktu (misal "lagi tidur
     siang", "lagi main sama kucing") tidak muncul di jam yang janggal.

     SENGAJA tidak selalu mengacak baris baru: kalau warna yang diminta
     SAMA dengan state.statusTerakhir.warna, teks LAMA yang sudah
     tampil dipertahankan apa adanya. Ini penting karena presence dari
     Lanyard bisa datang berkali-kali untuk status yang sebenarnya
     tidak berubah (reconnect WebSocket, heartbeat, polling REST) —
     tanpa pengecekan ini, badge akan kelihatan "berkedip" ganti
     kalimat setiap beberapa saat padahal Rafael masih di status yang
     sama persis. Baris baru hanya diacak saat warna benar-benar
     berpindah (misal dari hijau ke kuning, atau kuning ke merah), ATAU
     saat rentang waktu sudah bergeser sejak teks lama dipasang (lihat
     "teksLamaSudahLewatWaktu" di bawah) — supaya kalau Rafael offline
     dari jam 13:50 sampai 15:10 misalnya, teksnya ikut pindah dari
     alasan "siang" ke alasan "sore" begitu jamnya lewat, bukan macet
     di alasan siang yang sudah tidak nyambung. */
  function ambilTeksAcak(warna) {
    var data = window.ALASAN_STATUS && window.ALASAN_STATUS[warna];
    var netral = (data && Array.isArray(data.netral)) ? data.netral : [];
    var rentangSekarang = ambilRentangWaktuSekarang();
    var kandidatWaktu = (data && data.waktu && Array.isArray(data.waktu[rentangSekarang]))
      ? data.waktu[rentangSekarang]
      : [];
    var kandidat = netral.concat(kandidatWaktu);
    var punyaSumberAcakValid = kandidat.length > 0;

    var warnaSama = state.statusTerakhir && state.statusTerakhir.warna === warna;
    var teksLamaMasihDariSumberAcak = warnaSama
      && punyaSumberAcakValid
      && kandidat.indexOf(state.statusTerakhir.teks) !== -1;

    /* Kalau teks lama itu sebetulnya sebuah alasan "waktu" (bukan
       netral), tapi rentang waktu sekarang sudah beda dari rentang
       saat teks itu pertama dipasang, anggap teks lama itu SUDAH
       KEDALUWARSA — jangan dipertahankan, biar diacak ulang dari
       kandidat rentang yang baru. Alasan netral tidak pernah dianggap
       kedaluwarsa karena memang tidak terikat jam sama sekali. */
    var teksLamaAdalahAlasanNetral = netral.indexOf(state.statusTerakhir && state.statusTerakhir.teks) !== -1;
    var teksLamaSudahLewatWaktu = teksLamaMasihDariSumberAcak
      && !teksLamaAdalahAlasanNetral
      && state.statusTerakhir.rentangWaktu
      && state.statusTerakhir.rentangWaktu !== rentangSekarang;

    if (teksLamaMasihDariSumberAcak && !teksLamaSudahLewatWaktu) {
      return { teks: state.statusTerakhir.teks, rentangWaktu: state.statusTerakhir.rentangWaktu };
    }

    if (!punyaSumberAcakValid) {
      return { teks: TEKS_STATUS[warna], rentangWaktu: null };
    }

    var indeksAcak = Math.floor(Math.random() * kandidat.length);
    /* rentangWaktu dicatat SEKARANG (bukan diambil ulang nanti) supaya
       konsisten sama kandidat yang benar-benar dipakai untuk mengacak
       baris ini, jaga-jaga kalau jam berubah tepat di antara baris ini
       dieksekusi dan baris berikutnya (kasus yang sangat jarang, tapi
       lebih aman dicatat di sini). */
    return { teks: kandidat[indeksAcak], rentangWaktu: rentangSekarang };
  }

  /* Lima rentang waktu (jam device pengunjung, 24 jam) yang dipakai
     for-reason.js untuk mengelompokkan alasan yang terikat waktu.
     Lihat komentar "KENAPA DIBAGI PER WAKTU" di kepala for-reason.js
     untuk alasan lengkap kenapa rentang ini dipilih dan apa isinya. */
  function ambilRentangWaktuSekarang() {
    var jam = new Date().getHours(); // 0-23, mengikuti jam lokal device.

    if (jam >= 0 && jam < 4) return 'dini_hari';   // 00:00 - 03:59
    if (jam >= 4 && jam < 11) return 'pagi';       // 04:00 - 10:59
    if (jam >= 11 && jam < 15) return 'siang';     // 11:00 - 14:59
    if (jam >= 15 && jam < 18) return 'sore';      // 15:00 - 17:59
    return 'malam';                                // 18:00 - 23:59
  }

  /* Endpoint resmi Lanyard. Tidak perlu diubah kecuali kamu self-host
     server Lanyard sendiri. */
  var LANYARD_REST_URL = 'https://api.lanyard.rest/v1/users/';
  var LANYARD_SOCKET_URL = 'wss://api.lanyard.rest/socket';

  /* Kalau koneksi WebSocket gagal berturut-turut sebanyak ini, file ini
     berhenti mencoba WebSocket dan pindah permanen ke mode polling REST
     supaya tidak terus-menerus mencoba sesuatu yang jelas bermasalah
     (misal browser/jaringan pengunjung memang memblokir WebSocket). */
  var MAKS_PERCOBAAN_ULANG_SOCKET = 6;

  /* Jeda antar polling REST saat mode fallback aktif (dua menit). */
  var JEDA_POLLING_MS = 2 * 60 * 1000;

  /* ========================================================================
     2. STATE internal file ini. Sengaja dikumpulkan di satu objek supaya
        gampang dilacak dan tidak nyebar jadi banyak variabel lepas.
     ======================================================================== */

  var state = {
    socket: null,
    heartbeatTimer: null,
    reconnectTimer: null,
    pollingTimer: null,
    percobaanUlang: 0,
    modePolling: false,
    /* Menyimpan warna+teks(+rentangWaktu) terakhir yang berhasil
       diterapkan, supaya kalau ada update baru yang datanya kosong/
       rusak, badge tidak ditimpa jadi kosong — tetap pakai status
       terakhir yang valid. rentangWaktu dipakai khusus oleh
       ambilTeksAcak() untuk tahu kapan sebuah alasan "terikat waktu"
       harus dianggap kedaluwarsa karena jamnya sudah bergeser. */
    statusTerakhir: null
  };

  /* ========================================================================
     3. LOGIKA MURNI — mengubah data presence Lanyard jadi { warna, teks }.
        Dipisah dari bagian jaringan/DOM di bawah supaya gampang dibaca
        ulang tanpa perlu mikirin WebSocket/fetch sama sekali.
     ======================================================================== */

  /* Mencari apakah salah satu APLIKASI_DIPANTAU sedang aktif di dalam
     array "activities" yang dikirim Discord. Mengembalikan entri dari
     APLIKASI_DIPANTAU yang cocok (beserta nama aktivitas aslinya untuk
     fallback label), atau null kalau tidak ada yang cocok. */
  function cariAplikasiDipantauYangAktif(activities) {
    if (!Array.isArray(activities) || activities.length === 0) return null;

    for (var i = 0; i < activities.length; i++) {
      var aktivitas = activities[i];
      var namaAktivitas = aktivitas && typeof aktivitas.name === 'string' ? aktivitas.name : '';
      if (!namaAktivitas) continue;

      var namaKecil = namaAktivitas.toLowerCase();
      for (var j = 0; j < APLIKASI_DIPANTAU.length; j++) {
        var target = APLIKASI_DIPANTAU[j];
        if (namaKecil.indexOf(target.cocok.toLowerCase()) !== -1) {
          return { target: target, namaAktivitasAsli: namaAktivitas };
        }
      }
    }
    return null;
  }

  /* Fungsi inti: data presence mentah dari Lanyard -> { warna, teks }.
     Ditulis defensif habis-habisan (banyak pengecekan "kalau ada")
     karena ini satu-satunya tempat yang akan crash-in seluruh badge
     kalau bentuk data dari API berubah sedikit saja dan tidak dijaga. */
  function petakanPresenceKeStatus(presence) {
    if (!presence || typeof presence !== 'object') return null;

    var statusDiscord = typeof presence.discord_status === 'string'
      ? presence.discord_status
      : 'offline';

    if (statusDiscord === 'offline') {
      var hasilMerah = ambilTeksAcak('merah');
      return { warna: 'merah', teks: hasilMerah.teks, rentangWaktu: hasilMerah.rentangWaktu };
    }

    if (statusDiscord === 'idle') {
      var hasilKuning = ambilTeksAcak('kuning');
      return { warna: 'kuning', teks: hasilKuning.teks, rentangWaktu: hasilKuning.rentangWaktu };
    }

    /* Sisa kemungkinan: 'online' atau 'dnd'. Keduanya diperlakukan sama
       di sini — cek dulu apakah lagi buka salah satu aplikasi produksi
       yang dipantau. */
    var hasilCari = cariAplikasiDipantauYangAktif(presence.activities);
    if (hasilCari) {
      var teksLabel = hasilCari.target.label && hasilCari.target.label.length > 0
        ? hasilCari.target.label
        : hasilCari.namaAktivitasAsli;
      /* rentangWaktu: null karena ini teks nama aplikasi asli, bukan
         alasan yang diacak dari for-reason.js — tidak ada konsep
         "kedaluwarsa karena jam berganti" untuk baris ini. */
      return { warna: 'hijau', teks: teksLabel, rentangWaktu: null };
    }

    /* Online/dnd tapi bukan lagi buka aplikasi produksi yang dipantau. */
    return { warna: 'kuning', teks: TEKS_STATUS.aktifTanpaAplikasi, rentangWaktu: null };
  }

  /* ========================================================================
     4. PENERAPAN KE DOM — sengaja dipisah dari logika di atas supaya
        bagian ini murni "cara nampilinnya", bukan "cara mikirinnya".
     ======================================================================== */

  function terapkanStatusKeBadge(status) {
    if (!status || !status.warna || !status.teks) return;

    var dotEl = document.querySelector('.hero-badge .dot-live');
    var teksEl = document.getElementById('heroBadgeText');
    if (!dotEl || !teksEl) return;

    dotEl.classList.remove('dot-live--merah', 'dot-live--kuning', 'dot-live--hijau');
    dotEl.classList.add('dot-live--' + status.warna);
    teksEl.textContent = status.teks;

    state.statusTerakhir = status;
  }

  /* Dipanggil tiap kali ada data presence baru, dari sumber manapun
     (REST awal, INIT_STATE, atau PRESENCE_UPDATE dari WebSocket). */
  function prosesPresenceBaru(presence) {
    var status = petakanPresenceKeStatus(presence);
    /* Kalau pemetaan gagal (data rusak/kosong), JANGAN timpa badge —
       biarkan status terakhir yang masih valid tetap tampil daripada
       badge tiba-tiba kosong gara-gara satu payload yang aneh. */
    if (status) terapkanStatusKeBadge(status);
  }

  /* ========================================================================
     5. REST API — dipakai untuk pengisian awal yang cepat, dan juga
        sebagai fallback polling kalau WebSocket menyerah.
     ======================================================================== */

  function ambilStatusLewatRest() {
    if (!DISCORD_USER_ID || DISCORD_USER_ID.indexOf('GANTI_DENGAN') === 0) {
      /* ID belum diisi — jangan tembak request yang pasti gagal, cukup
         diamkan di console supaya pemilik situs sadar harus mengisi
         DISCORD_USER_ID, tanpa mengganggu pengunjung biasa. */
      console.warn('[fetch-status.js] DISCORD_USER_ID belum diisi — status realtime tidak akan aktif.');
      return;
    }

    fetch(LANYARD_REST_URL + encodeURIComponent(DISCORD_USER_ID))
      .then(function (res) {
        if (!res.ok) throw new Error('Respons REST Lanyard tidak OK: ' + res.status);
        return res.json();
      })
      .then(function (json) {
        if (json && json.success && json.data) {
          prosesPresenceBaru(json.data);
        }
      })
      .catch(function (err) {
        /* Gagal diam-diam ke console saja. Badge tetap menampilkan teks
           statis bawaan content.js sampai ada sumber data yang berhasil,
           jadi kegagalan di sini tidak pernah membuat halaman rusak. */
        console.warn('[fetch-status.js] Gagal mengambil status awal lewat REST:', err);
      });
  }

  function mulaiPolling() {
    if (state.modePolling) return; // sudah jalan, jangan dobel.
    state.modePolling = true;

    console.warn('[fetch-status.js] WebSocket gagal berulang kali, pindah ke mode polling REST tiap ' + (JEDA_POLLING_MS / 60000) + ' menit.');

    hentikanSemuaTimerSocket();

    /* Polling berjalan sendiri, terpisah dari alur WebSocket, jadi
       tidak perlu coba-coba WebSocket lagi selama mode ini aktif. */
    state.pollingTimer = window.setInterval(ambilStatusLewatRest, JEDA_POLLING_MS);
  }

  /* ========================================================================
     6. WEBSOCKET — jalur utama untuk update realtime.
        Mengikuti protokol resmi Lanyard: Hello (op 1) -> kirim Initialize
        (op 2) -> kirim Heartbeat (op 3) tiap heartbeat_interval -> terima
        Event (op 0) berisi INIT_STATE lalu PRESENCE_UPDATE.
     ======================================================================== */

  function hentikanSemuaTimerSocket() {
    if (state.heartbeatTimer) {
      window.clearInterval(state.heartbeatTimer);
      state.heartbeatTimer = null;
    }
    if (state.reconnectTimer) {
      window.clearTimeout(state.reconnectTimer);
      state.reconnectTimer = null;
    }
  }

  function tutupSocketDenganAman() {
    hentikanSemuaTimerSocket();
    if (state.socket) {
      /* Lepas semua handler dulu sebelum close, supaya event close/error
         dari socket lama yang sedang ditutup tidak ikut memicu logika
         reconnect (yang bisa menyebabkan dua socket aktif bersamaan). */
      state.socket.onopen = null;
      state.socket.onmessage = null;
      state.socket.onerror = null;
      state.socket.onclose = null;
      try { state.socket.close(); } catch (e) { /* sudah tertutup, abaikan */ }
      state.socket = null;
    }
  }

  function jadwalkanSambungUlang() {
    if (state.modePolling) return; // sudah menyerah ke polling, tidak perlu lagi.

    state.percobaanUlang += 1;

    if (state.percobaanUlang > MAKS_PERCOBAAN_ULANG_SOCKET) {
      mulaiPolling();
      return;
    }

    /* Exponential backoff dengan sedikit jitter acak, dibatasi maksimal
       30 detik supaya tidak menunggu kelamaan tapi juga tidak
       membombardir server: percobaan ke-1 ~2 detik, ke-2 ~4 detik,
       ke-3 ~8 detik, dst, sampai batas atas. */
    var dasarJeda = Math.min(30000, 1000 * Math.pow(2, state.percobaanUlang));
    var jitter = Math.random() * 1000;
    var jeda = dasarJeda + jitter;

    state.reconnectTimer = window.setTimeout(bukaSocket, jeda);
  }

  function tanganiPesanSocket(event) {
    var pesan;
    try {
      pesan = JSON.parse(event.data);
    } catch (e) {
      console.warn('[fetch-status.js] Pesan WebSocket tidak bisa di-parse sebagai JSON, diabaikan.');
      return;
    }
    if (!pesan || typeof pesan.op !== 'number') return;

    switch (pesan.op) {
      case 1: /* Hello — berisi heartbeat_interval yang harus dipatuhi. */
        var intervalMs = pesan.d && typeof pesan.d.heartbeat_interval === 'number'
          ? pesan.d.heartbeat_interval
          : 30000; // jaga-jaga kalau field ini tidak ada, pakai 30 detik.

        if (state.heartbeatTimer) window.clearInterval(state.heartbeatTimer);
        state.heartbeatTimer = window.setInterval(function () {
          if (state.socket && state.socket.readyState === WebSocket.OPEN) {
            state.socket.send(JSON.stringify({ op: 3 }));
          }
        }, intervalMs);

        /* Langsung kirim Initialize begitu Hello diterima, sesuai spek. */
        state.socket.send(JSON.stringify({
          op: 2,
          d: { subscribe_to_id: DISCORD_USER_ID }
        }));
        break;

      case 0: /* Event — INIT_STATE (data awal) atau PRESENCE_UPDATE. */
        if (pesan.t === 'INIT_STATE' || pesan.t === 'PRESENCE_UPDATE') {
          if (pesan.d) prosesPresenceBaru(pesan.d);
        }
        break;

      /* Opcode lain (mis. balasan heartbeat) sengaja tidak perlu
         ditangani apa-apa di sisi client. */
    }
  }

  function bukaSocket() {
    if (!DISCORD_USER_ID || DISCORD_USER_ID.indexOf('GANTI_DENGAN') === 0) {
      return; // sudah diperingatkan lewat ambilStatusLewatRest(), cukup diam di sini.
    }

    /* Kalau tab sedang tidak terlihat, tunda membuka socket sampai tab
       terlihat lagi (ditangani oleh listener visibilitychange di bawah)
       — menghindari buka koneksi sia-sia untuk tab yang sedang di-tab
       belakang dan browser kemungkinan akan langsung men-throttle-nya. */
    if (document.visibilityState === 'hidden') return;

    tutupSocketDenganAman();

    try {
      state.socket = new WebSocket(LANYARD_SOCKET_URL);
    } catch (e) {
      console.warn('[fetch-status.js] Gagal membuat koneksi WebSocket:', e);
      jadwalkanSambungUlang();
      return;
    }

    state.socket.onopen = function () {
      /* Koneksi berhasil dan stabil — reset hitungan percobaan supaya
         backoff mulai dari awal lagi kalau nanti putus lagi di lain
         waktu (bukan melanjutkan dari hitungan lama yang lebih lambat). */
      state.percobaanUlang = 0;
    };

    state.socket.onmessage = tanganiPesanSocket;

    state.socket.onerror = function () {
      /* onerror pada WebSocket browser tidak membawa detail yang
         berguna (demi keamanan) dan SELALU diikuti oleh onclose,
         jadi logika reconnect cukup ditaruh satu kali saja di onclose
         supaya tidak terjadwal dua kali untuk kejadian yang sama. */
    };

    state.socket.onclose = function () {
      hentikanSemuaTimerSocket();
      jadwalkanSambungUlang();
    };
  }

  /* Kalau tab balik keliatan lagi setelah lama di background, dan
     ternyata socket sudah tidak terbuka (banyak browser diam-diam
     memutus WebSocket dari tab yang lama tidak aktif), sambungkan
     ulang dengan segera alih-alih menunggu jadwal backoff berikutnya. */
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    if (state.modePolling) return;
    var socketTertutup = !state.socket || state.socket.readyState === WebSocket.CLOSED;
    if (socketTertutup) {
      state.percobaanUlang = 0;
      bukaSocket();
    }
  });

  /* ========================================================================
     7. INISIALISASI
     ======================================================================== */

  function init() {
    if (typeof WebSocket === 'undefined') {
      /* Browser sangat lawas tanpa dukungan WebSocket sama sekali —
         langsung pakai mode polling REST dari awal tanpa buang waktu
         mencoba WebSocket yang pasti gagal. */
      ambilStatusLewatRest();
      mulaiPolling();
      return;
    }

    /* Ambil status awal lewat REST dulu (cepat tampil), lalu buka
       WebSocket untuk update selanjutnya secara realtime. Keduanya
       sengaja tidak saling menunggu supaya badge terisi secepat
       mungkin — kalau REST datang belakangan setelah WebSocket, hasil
       WebSocket yang terapkanStatusKeBadge terakhir yang menang, dan
       itu tidak masalah karena datanya sama-sama presence terkini. */
    ambilStatusLewatRest();
    bukaSocket();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* Diekspos ke window murni untuk keperluan debugging manual dari
     console browser (contoh: window.__statusDebug.statusTerakhir()),
     tidak dipakai oleh bagian lain dari situs. */
  window.__statusDebug = {
    statusTerakhir: function () { return state.statusTerakhir; },
    petakanPresenceKeStatus: petakanPresenceKeStatus,
    paksaSambungUlang: function () {
      state.percobaanUlang = 0;
      state.modePolling = false;
      if (state.pollingTimer) {
        window.clearInterval(state.pollingTimer);
        state.pollingTimer = null;
      }
      bukaSocket();
    }
  };

})();
