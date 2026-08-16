/* ==========================================================================
   Rafael L3 — Floating Chat Widget
   floating-chat.js

   Widget chat AI mengambang di pojok kiri bawah. Terpisah total dari
   main.js/content.js supaya tidak menyentuh logika render konten yang
   sudah ada — file ini murni menambah komponen baru.

   Cara kerja singkat:
   1. Badge bulat (launcher) di pojok kiri bawah → diklik buka/tutup panel.
   2. Pesan pengguna dikirim via fetch POST ke Worker (CHAT_API_URL).
      Worker itu yang menyimpan API key Gemini + system prompt di sisi
      server (env var / secret), JADI TIDAK ADA API KEY DI FILE INI.
   3. Riwayat percakapan disimpan sementara di sessionStorage supaya
      tidak hilang saat reload halaman, tapi otomatis bersih saat tab
      ditutup. Tidak memakai localStorage (sesuai batasan lingkungan ini
      dan supaya tidak ada data yang "menetap" di browser pengunjung).
   ========================================================================== */

(function () {
  'use strict';

  /* ------------------------------------------------------------------
     0. KONFIGURASI
        Ganti CHAT_API_URL kalau alamat Worker berubah.
  ------------------------------------------------------------------ */
  var CHAT_CONFIG = {
    apiUrl: 'https://chatassistent.ffkz946.workers.dev/',
    botName: 'Asisten Rafael',
    botInitial: 'R',
    avatarImg: 'assets/img/stickers.jpg',
    statusText: 'Biasanya balas cepat',
    greeting: 'Halo! Aku asisten AI-nya Rafael. Ada yang mau ditanyain soal karya, skill, atau cara kontak Rafael?',
    placeholder: 'Ketik pesan...',
    footerNote: 'Ditenagai oleh AI — bisa saja salah',
    storageKey: 'fcChatHistory_v1',
    maxHistorySent: 12, /* jumlah pesan terakhir yang dikirim sebagai konteks ke API, biar payload tidak makin besar seiring waktu */
    sentSoundSrc: 'assets/audio/sent.mp3',
    receivedSoundSrc: 'assets/audio/received.mp3',
    soundVolume: 0.5 /* 0–1, dibikin agak pelan biar tidak mengagetkan/mengganggu kalau pengunjung sedang dengar musik/video lain */
  };

  /* ------------------------------------------------------------------
     1. STATE
  ------------------------------------------------------------------ */
  var state = {
    open: false,
    sending: false,
    history: [], /* array of {role: 'user'|'bot', text: string, time: string} */
    unreadCount: 0
  };

  /* ------------------------------------------------------------------
     2. UTIL
  ------------------------------------------------------------------ */
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* Format jam gaya WhatsApp: "14.05" (24 jam, dua digit, dipisah titik
     sesuai kebiasaan penulisan jam di Indonesia). Dipanggil setiap kali
     pesan baru dibuat, dan dipakai ulang saat pesan lama dari
     sessionStorage dirender kembali. */
  function formatTimeNow() {
    var d = new Date();
    var hh = String(d.getHours()).padStart(2, '0');
    var mm = String(d.getMinutes()).padStart(2, '0');
    return hh + '.' + mm;
  }

  /* Avatar bot dirender sebagai <img> (foto custom), dengan teks inisial
     sebagai fallback tersembunyi kalau gambarnya gagal dimuat (path
     salah / file kehapus / dsb) — supaya yang muncul bukan ikon gambar
     rusak, tapi tetap avatar kotak berwarna seperti semula. Dipakai
     bareng di 3 tempat: avatar header, avatar per-pesan, dan avatar
     indikator "sedang mengetik". */
  function avatarInner() {
    return '<img class="fc-avatar-img" src="' + escapeHtml(CHAT_CONFIG.avatarImg) + '" alt="" />' +
      '<span class="fc-avatar-fallback">' + escapeHtml(CHAT_CONFIG.botInitial) + '</span>';
  }

  /* Dipasang lewat addEventListener setelah avatar di-append ke DOM
     (bukan atribut onerror inline di string HTML), biar konsisten
     dengan pola event listener yang dipakai di seluruh file ini.
     scopeEl dibatasi ke elemen yang baru dibuat (root widget / satu
     baris pesan) supaya query-nya kecil, bukan scan ulang seluruh body
     tiap kali ada pesan baru. */
  function bindAvatarImgFallback(scopeEl) {
    if (!scopeEl) return;
    var imgs = scopeEl.querySelectorAll('.fc-avatar-img');
    for (var i = 0; i < imgs.length; i++) {
      imgs[i].addEventListener('error', function () {
        var wrap = this.parentElement;
        if (wrap) wrap.classList.add('fc-avatar-broken');
      }, { once: true });
    }
  }

  /* ------------------------------------------------------------------
     2b. EFEK SUARA (kirim / terima)
        Dua elemen <audio> dibuat sekali (bukan `new Audio()` tiap kali
        pesan terkirim) supaya file sudah ter-preload di memori dan
        langsung terdengar tanpa jeda network saat diputar. Dibungkus
        try/catch + .catch() pada Promise play() karena beberapa browser
        (terutama Safari/iOS dan Chrome versi tertentu) menolak audio
        yang diputar di luar konteks interaksi user secara langsung, atau
        kalau pengunjung sudah mematikan suara situs lewat pengaturan
        browser-nya. Kalau itu terjadi, chat tetap harus jalan normal
        tanpa suara — bukan malah error dan mem-block pengiriman pesan. */
  var sentAudioEl = null;
  var receivedAudioEl = null;

  function getSentAudio() {
    if (!sentAudioEl) {
      sentAudioEl = new Audio(CHAT_CONFIG.sentSoundSrc);
      sentAudioEl.volume = CHAT_CONFIG.soundVolume;
      sentAudioEl.preload = 'auto';
    }
    return sentAudioEl;
  }

  function getReceivedAudio() {
    if (!receivedAudioEl) {
      receivedAudioEl = new Audio(CHAT_CONFIG.receivedSoundSrc);
      receivedAudioEl.volume = CHAT_CONFIG.soundVolume;
      receivedAudioEl.preload = 'auto';
    }
    return receivedAudioEl;
  }

  function playSound(audioEl) {
    if (!audioEl) return;
    try {
      /* currentTime direset ke 0 dulu: kalau pengunjung kirim beberapa
         pesan berturut-turut dengan cepat, suara sebelumnya mungkin
         belum selesai — tanpa reset ini, .play() pada elemen yang masih
         "sedang jalan" akan diam saja (browser tidak restart otomatis). */
      audioEl.currentTime = 0;
      var playPromise = audioEl.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(function () {
          /* Autoplay diblokir browser, atau file gagal dimuat — abaikan
             secara senyap. Fungsi kirim/terima pesan tetap harus jalan
             normal tanpa suara. */
        });
      }
    } catch (err) {
      /* Browser sangat lama tanpa dukungan Audio API sama sekali — abaikan. */
    }
  }

  function playSentSound() { playSound(getSentAudio()); }
  function playReceivedSound() { playSound(getReceivedAudio()); }

  function loadHistory() {
    try {
      var raw = sessionStorage.getItem(CHAT_CONFIG.storageKey);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      return [];
    } catch (err) {
      return [];
    }
  }

  function saveHistory() {
    try {
      sessionStorage.setItem(CHAT_CONFIG.storageKey, JSON.stringify(state.history));
    } catch (err) {
      /* sessionStorage penuh atau diblokir (mode private ketat) — abaikan,
         chat tetap jalan, hanya riwayat tidak persist saat reload. */
    }
  }

  /* ------------------------------------------------------------------
     3. BANGUN DOM WIDGET
  ------------------------------------------------------------------ */
  function buildWidget() {
    var root = document.createElement('div');
    root.className = 'fc-root';
    root.id = 'fcRoot';

    root.innerHTML =
      /* data-own-scroll="true": memberitahu assets/js/scroll-fx.js (efek
         momentum smooth-scroll milik halaman) supaya TIDAK meng-intercept
         event wheel/scroll di dalam panel ini. Tanpa atribut ini, mouse
         wheel di atas area chat akan ikut menggerakkan scroll halaman
         utama, bukan menggulir isi chat — scrollbar tetap bisa di-drag
         karena itu jalur berbeda (bukan event wheel), tapi mouse wheel
         "dicuri" duluan oleh listener wheel milik halaman. Pola yang sama
         sudah dipakai di #quoteCarousel (lihat index.html). */
      '<div class="fc-panel" id="fcPanel" role="dialog" aria-label="' + escapeHtml(CHAT_CONFIG.botName) + '" aria-hidden="true" data-own-scroll="true">' +
        '<div class="fc-header">' +
          '<div class="fc-avatar" aria-hidden="true">' + avatarInner() + '<span class="fc-avatar-dot"></span></div>' +
          '<div class="fc-header-info">' +
            '<div class="fc-header-name">' + escapeHtml(CHAT_CONFIG.botName) + '</div>' +
            '<div class="fc-header-status" id="fcHeaderStatus">' + escapeHtml(CHAT_CONFIG.statusText) + '</div>' +
          '</div>' +
          '<button class="fc-header-close" id="fcCloseBtn" aria-label="Tutup chat" type="button">' +
            '<svg fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' +
          '</button>' +
        '</div>' +
        '<div class="fc-body" id="fcBody"></div>' +
        '<div class="fc-footer">' +
          '<div class="fc-input-row">' +
            '<textarea class="fc-input" id="fcInput" placeholder="' + escapeHtml(CHAT_CONFIG.placeholder) + '" rows="1" maxlength="800" aria-label="Tulis pesan"></textarea>' +
            '<button class="fc-send" id="fcSendBtn" type="button" aria-label="Kirim pesan" disabled>' +
              '<svg fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>' +
            '</button>' +
          '</div>' +
          '<p class="fc-footer-note">' + escapeHtml(CHAT_CONFIG.footerNote) + '</p>' +
        '</div>' +
      '</div>' +
      '<div class="fc-launcher" id="fcLauncher" role="button" tabindex="0" aria-label="Buka chat">' +
        '<span class="fc-launcher-dot" aria-hidden="true"></span>' +
        '<span class="fc-unread-badge" id="fcUnreadBadge" aria-hidden="true">0</span>' +
        '<svg class="fc-icon-chat" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"></path></svg>' +
        '<svg class="fc-icon-close" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' +
      '</div>';

    document.body.appendChild(root);
    bindAvatarImgFallback(root);
    return root;
  }

  /* ------------------------------------------------------------------
     4. RENDER PESAN
  ------------------------------------------------------------------ */
  function renderEmptyState(bodyEl) {
    bodyEl.innerHTML =
      '<div class="fc-empty-state">' +
        '<svg fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"></path></svg>' +
        '<strong>Mulai obrolan</strong>' +
        '<span>' + escapeHtml(CHAT_CONFIG.greeting) + '</span>' +
      '</div>';
  }

  function appendMessageRow(role, text, opts) {
    opts = opts || {};
    var bodyEl = document.getElementById('fcBody');
    if (!bodyEl) return null;

    /* Kalau ini pesan pertama, hapus empty-state dulu */
    var emptyState = bodyEl.querySelector('.fc-empty-state');
    if (emptyState) emptyState.remove();

    var row = document.createElement('div');
    row.className = 'fc-msg-row ' + (role === 'user' ? 'fc-msg-user' : 'fc-msg-bot');

    var avatar = '';
    if (role !== 'user') {
      avatar = '<div class="fc-msg-avatar" aria-hidden="true">' + avatarInner() + '</div>';
    }

    var bubbleClass = 'fc-msg-bubble' + (opts.isError ? ' fc-msg-error' : '');
    row.innerHTML = avatar + '<div class="' + bubbleClass + '"></div>';

    var bubbleEl = row.querySelector('.fc-msg-bubble');

    /* Teks pesan dan jam dipisah jadi dua elemen span terpisah di dalam
       bubble. Pesan pakai textContent (bukan innerHTML) supaya balasan
       API tidak pernah dirender sebagai HTML/JS — mencegah XSS dari sisi
       respons AI. Keduanya sengaja dibiarkan mengalir sebagai inline
       (lihat .fc-msg-text/.fc-msg-time di floating-chat.css) supaya jam
       otomatis nempel di ujung baris teks terakhir kalau muat, atau
       turun ke barisnya sendiri kalau tidak — pola yang sama seperti
       WhatsApp — tanpa perlu JS mengukur lebar teks. */
    var textSpan = document.createElement('span');
    textSpan.className = 'fc-msg-text';
    textSpan.textContent = text;

    var timeSpan = document.createElement('span');
    timeSpan.className = 'fc-msg-time';
    timeSpan.textContent = opts.time || formatTimeNow();

    bubbleEl.appendChild(textSpan);
    bubbleEl.appendChild(timeSpan);

    bodyEl.appendChild(row);
    bindAvatarImgFallback(row);
    bodyEl.scrollTop = bodyEl.scrollHeight;
    return row;
  }

  function showTypingIndicator() {
    var bodyEl = document.getElementById('fcBody');
    if (!bodyEl) return;
    var row = document.createElement('div');
    row.className = 'fc-msg-row fc-msg-bot';
    row.id = 'fcTypingRow';
    row.innerHTML =
      '<div class="fc-msg-avatar" aria-hidden="true">' + avatarInner() + '</div>' +
      '<div class="fc-msg-bubble"><div class="fc-typing-dots"><span></span><span></span><span></span></div></div>';
    bodyEl.appendChild(row);
    bindAvatarImgFallback(row);
    bodyEl.scrollTop = bodyEl.scrollHeight;
  }

  function hideTypingIndicator() {
    var row = document.getElementById('fcTypingRow');
    if (row) row.remove();
  }

  function renderAllHistory() {
    var bodyEl = document.getElementById('fcBody');
    if (!bodyEl) return;
    bodyEl.innerHTML = '';

    if (state.history.length === 0) {
      renderEmptyState(bodyEl);
      return;
    }

    state.history.forEach(function (msg) {
      /* msg.time bisa saja kosong kalau riwayat ini disimpan sebelum
         fitur jam ditambahkan (sessionStorage lama) — appendMessageRow
         akan otomatis isi jam sekarang sebagai fallback lewat formatTimeNow(). */
      appendMessageRow(msg.role, msg.text, { isError: !!msg.isError, time: msg.time });
    });
  }

  /* ------------------------------------------------------------------
     5. PANGGIL API (Cloudflare Worker → Gemini, key aman di server)
  ------------------------------------------------------------------ */
  function extractReplyText(data) {
    /* Worker bisa saja membungkus balasan dengan beberapa bentuk field
       yang berbeda. Coba beberapa kemungkinan umum supaya widget tetap
       jalan walau bentuk JSON persis dari Worker sedikit berbeda. */
    if (!data) return null;
    if (typeof data === 'string') return data;
    if (typeof data.reply === 'string') return data.reply;
    if (typeof data.message === 'string') return data.message;
    if (typeof data.text === 'string') return data.text;
    if (typeof data.response === 'string') return data.response;
    if (typeof data.answer === 'string') return data.answer;
    if (typeof data.output === 'string') return data.output;

    /* Bentuk mentah ala Gemini generateContent, kalau Worker meneruskan
       apa adanya: candidates[0].content.parts[0].text */
    try {
      if (data.candidates && data.candidates[0] && data.candidates[0].content &&
          data.candidates[0].content.parts && data.candidates[0].content.parts[0] &&
          typeof data.candidates[0].content.parts[0].text === 'string') {
        return data.candidates[0].content.parts[0].text;
      }
    } catch (err) { /* abaikan, lanjut ke fallback di bawah */ }

    return null;
  }

  function sendMessageToApi(userText) {
    var recentHistory = state.history.slice(-CHAT_CONFIG.maxHistorySent).map(function (m) {
      return { role: m.role === 'user' ? 'user' : 'assistant', text: m.text };
    });

    var payload = {
      message: userText,
      history: recentHistory
    };

    return fetch(CHAT_CONFIG.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (res) {
      if (!res.ok) {
        throw new Error('Server merespons dengan status ' + res.status);
      }
      return res.json().catch(function () {
        throw new Error('Respons server tidak berupa JSON yang valid.');
      });
    }).then(function (data) {
      var replyText = extractReplyText(data);
      if (!replyText) {
        throw new Error('Format respons dari server tidak dikenali.');
      }
      return replyText;
    });
  }

  /* ------------------------------------------------------------------
     6. HANDLER KIRIM PESAN
  ------------------------------------------------------------------ */
  function handleSend() {
    if (state.sending) return;

    var inputEl = document.getElementById('fcInput');
    var sendBtn = document.getElementById('fcSendBtn');
    if (!inputEl) return;

    var text = inputEl.value.trim();
    if (!text) return;

    /* Tambah pesan user. Jam diambil sekali lalu dipakai untuk history
       maupun elemen yang dirender, supaya keduanya selalu sinkron. */
    var userTime = formatTimeNow();
    state.history.push({ role: 'user', text: text, time: userTime });
    appendMessageRow('user', text, { time: userTime });
    saveHistory();
    playSentSound();

    inputEl.value = '';
    autoResizeInput(inputEl);
    updateSendButtonState();

    state.sending = true;
    if (sendBtn) sendBtn.disabled = true;
    inputEl.disabled = true;
    showTypingIndicator();

    sendMessageToApi(text)
      .then(function (replyText) {
        hideTypingIndicator();
        var botTime = formatTimeNow();
        state.history.push({ role: 'bot', text: replyText, time: botTime });
        appendMessageRow('bot', replyText, { time: botTime });
        saveHistory();
        playReceivedSound();

        if (!state.open) {
          state.unreadCount += 1;
          updateUnreadBadge();
        }
      })
      .catch(function (err) {
        hideTypingIndicator();
        var friendlyMsg = 'Duh, lagi ada gangguan pas nyambungin ke server. Coba lagi sebentar lagi, ya.';
        var errTime = formatTimeNow();
        state.history.push({ role: 'bot', text: friendlyMsg, isError: true, time: errTime });
        appendMessageRow('bot', friendlyMsg, { isError: true, time: errTime });
        saveHistory();
        /* Sengaja TIDAK memutar suara "terima" di sini. Ini pesan error
           sistem, bukan balasan asli dari bot — bunyi notifikasi ceria
           pas ada kegagalan justru terasa salah konteks. */
        console.error('[floating-chat] Gagal mengambil balasan:', err);
      })
      .finally(function () {
        state.sending = false;
        inputEl.disabled = false;
        updateSendButtonState();
        inputEl.focus();
      });
  }

  function autoResizeInput(inputEl) {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 96) + 'px';
  }

  function updateSendButtonState() {
    var inputEl = document.getElementById('fcInput');
    var sendBtn = document.getElementById('fcSendBtn');
    if (!inputEl || !sendBtn) return;
    sendBtn.disabled = state.sending || inputEl.value.trim().length === 0;
  }

  function updateUnreadBadge() {
    var badge = document.getElementById('fcUnreadBadge');
    if (!badge) return;
    if (state.unreadCount > 0) {
      badge.textContent = state.unreadCount > 9 ? '9+' : String(state.unreadCount);
      badge.classList.add('is-visible');
    } else {
      badge.classList.remove('is-visible');
    }
  }

  /* ------------------------------------------------------------------
     7. BUKA / TUTUP PANEL
  ------------------------------------------------------------------ */
  function openPanel() {
    var root = document.getElementById('fcRoot');
    var panel = document.getElementById('fcPanel');
    var launcher = document.getElementById('fcLauncher');
    if (!root || !panel) return;

    state.open = true;
    state.unreadCount = 0;
    updateUnreadBadge();

    root.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
    if (launcher) launcher.setAttribute('aria-label', 'Tutup chat');

    var inputEl = document.getElementById('fcInput');
    if (inputEl) {
      /* Delay kecil supaya fokus terjadi setelah transisi buka mulai,
         mencegah "loncatan" scroll di beberapa browser mobile. */
      window.setTimeout(function () { inputEl.focus(); }, 120);
    }
  }

  function closePanel() {
    var root = document.getElementById('fcRoot');
    var panel = document.getElementById('fcPanel');
    var launcher = document.getElementById('fcLauncher');
    if (!root || !panel) return;

    state.open = false;
    root.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    if (launcher) launcher.setAttribute('aria-label', 'Buka chat');
  }

  function togglePanel() {
    if (state.open) closePanel();
    else openPanel();
  }

  /* ------------------------------------------------------------------
     8. PASANG EVENT LISTENERS
  ------------------------------------------------------------------ */
  function attachEvents() {
    var launcher = document.getElementById('fcLauncher');
    var closeBtn = document.getElementById('fcCloseBtn');
    var inputEl = document.getElementById('fcInput');
    var sendBtn = document.getElementById('fcSendBtn');
    var root = document.getElementById('fcRoot');

    if (launcher) {
      launcher.addEventListener('click', togglePanel);
      launcher.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          togglePanel();
        }
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', closePanel);
    }

    if (inputEl) {
      inputEl.addEventListener('input', function () {
        autoResizeInput(inputEl);
        updateSendButtonState();
      });

      inputEl.addEventListener('keydown', function (e) {
        /* Enter = kirim, Shift+Enter = baris baru */
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSend();
        }
      });
    }

    if (sendBtn) {
      sendBtn.addEventListener('click', handleSend);
    }

    /* Tutup panel dengan tombol Escape, untuk aksesibilitas keyboard */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && state.open) {
        closePanel();
      }
    });

    /* Klik di luar panel (tapi bukan di launcher) menutup panel — hanya
       untuk layar lebar, supaya di mobile tidak menutup tak sengaja
       saat mencoba mengetuk keyboard/pesan. */
    document.addEventListener('click', function (e) {
      if (!state.open) return;
      if (window.innerWidth < 640) return;
      if (!root) return;
      if (root.contains(e.target)) return;
      closePanel();
    });
  }

  /* ------------------------------------------------------------------
     9. INIT
  ------------------------------------------------------------------ */
  async function init() {
    if (document.getElementById('fcRoot')) return; /* mencegah duplikat kalau script termuat 2x */

    /* Ambil foto avatar terbaru dari Worker (kalau ada yang pernah
       di-upload lewat Dashboard Admin) SEBELUM buildWidget() dipanggil,
       supaya avatarInner() (dipakai di header, tiap bubble pesan, dan
       typing indicator) langsung memakai foto yang benar sejak render
       pertama — tidak perlu re-render ulang tiap tempat setelahnya.

       RL3_loadRemotePhoto() didefinisikan di content.js (di-load lebih
       dulu di index.html) dan SELALU resolve (null kalau gagal/belum
       pernah upload) — kalau null, CHAT_CONFIG.avatarImg dibiarkan apa
       adanya (fallback assets/img/stickers.jpg bawaan repo). */
    if (typeof RL3_loadRemotePhoto === 'function') {
      var remoteAvatar = await RL3_loadRemotePhoto();
      if (remoteAvatar) {
        CHAT_CONFIG.avatarImg = remoteAvatar;
      }
    }

    buildWidget();
    state.history = loadHistory();
    renderAllHistory();
    attachEvents();
    updateSendButtonState();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
