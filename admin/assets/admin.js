/* ==========================================================================
   Rafael L3 — Dashboard Admin
   admin.js — logika login, page routing (Overview/UI Settings/Product
   Display/Profile), form editor otomatis, dan simpan-instan ke Cloudflare
   Worker (KV) — TIDAK LAGI unduh-manual.

   CATATAN PENTING SOAL CARA KERJA DASHBOARD INI (baca sebelum ubah kode):

   Situs portofolio ini di-hosting di GitHub Pages (hosting statis), tapi
   TEKS, FOTO, dan PRODUK tidak lagi disimpan sebagai file statis yang
   perlu commit — ketiganya disimpan di Cloudflare KV lewat Worker yang
   sama dengan yang menangani login (lihat AUTH_API_BASE di bawah, dan
   worker/src/index.js untuk source Worker-nya). Alurnya:

     1. Kamu login (POST /login -> Worker mengecek lalu membalas token
        JWT).
     2. Begitu login sukses, dashboard mengambil DRAFT AWAL dari
        GET /content, GET /photo, DAN GET /products — supaya kamu selalu
        mulai mengedit dari versi yang SEDANG LIVE di situs.
     3. Dashboard menampilkan draft itu di tiga halaman terpisah: UI
        Settings (teks + foto), Product Display (katalog shop), dan
        Profile (info sesi login kamu sendiri) — ditambah halaman
        Overview sebagai halaman utama saat dashboard dibuka.
     4. Setiap kali kamu ubah field/produk, status "ada perubahan belum
        disimpan" muncul di topbar.
     5. Klik "Simpan Perubahan" (bar bawah) ATAU "Apply Changes" (topbar,
        keduanya memanggil fungsi yang sama) -> dashboard mengirim
        PUT /content, PUT /photo (kalau ganti foto), dan PUT /products
        (kalau ada perubahan produk) ke Worker.
     6. "Revert" membuang seluruh draft yang sedang diedit dan mengambil
        ulang versi tersimpan terakhir dari server.

   SOAL HALAMAN PROFILE — PENTING DIBACA SEBELUM MENGUBAH:
   Dashboard ini pakai SATU akun admin tunggal (ADMIN_USERNAME/
   ADMIN_PASSWORD tersimpan sebagai Cloudflare Secrets di Worker, BUKAN
   tabel/database banyak user). Endpoint GET /verify cuma membalas
   { valid, username } — username di situ adalah string yang sama persis
   dengan yang diketik di form login, bukan hasil query ke sistem user
   manapun. Karena itu halaman Profile TIDAK BISA "mendeteksi siapa dari
   banyak kemungkinan orang yang sedang login" — ia menampilkan sesi akun
   tunggal itu (username dari token, jam login, sisa masa berlaku token
   24 jam dihitung dari saat login). Kalau suatu saat kamu tambah sistem
   multi-admin sungguhan di Worker, halaman ini perlu endpoint baru untuk
   itu — lihat computeProfileState() di bagian PROFILE PAGE di bawah.

   SOAL KARTU PETA DI OVERVIEW:
   Peta menampilkan lokasi ESTIMASI dari sesi browser yang SEDANG membuka
   dashboard ini (kamu, saat ini) — bukan daftar/riwayat semua orang yang
   pernah login. Ini dari layanan geolocation IP publik (ipapi.co, lihat
   fetchVisitorGeo() di bagian OVERVIEW), bukan GPS presisi, dan tidak ada
   penyimpanan riwayat di server manapun — murni ditampilkan sekali per
   sesi dashboard dibuka.

   Kenapa masih ada CONTENT statis di content.js? Itu murni FALLBACK/
   DEFAULT — dipakai kalau KV benar-benar belum pernah diisi, atau kalau
   Worker sedang tidak bisa dihubungi saat dashboard dibuka. Pola yang
   sama berlaku untuk PRODUCTS di shop-content.js.
   ========================================================================== */

(function () {
  "use strict";

  // ------------------------------------------------------------
  // KONFIGURASI
  // ------------------------------------------------------------
  // URL Cloudflare Worker yang menangani /login, /verify, /content,
  // /photo, /products, /product-image. HARUS SAMA dengan
  // RL3_AUTH_API_BASE di content.js — kalau alamat Worker berubah, ganti
  // di DUA tempat itu (tidak ada tempat ketiga).
  const AUTH_API_BASE = "https://dashboard-key.ffkz946.workers.dev";

  // Key sessionStorage tempat token JWT disimpan. Sengaja pakai
  // sessionStorage (bukan localStorage) supaya token OTOMATIS hilang
  // begitu tab/browser ditutup.
  const TOKEN_STORAGE_KEY = "rl3_admin_token";

  // Key sessionStorage tempat WAKTU LOGIN (epoch ms) disimpan — dipakai
  // murni untuk ditampilkan di halaman Profile ("Waktu masuk" / "Sesi
  // berakhir sekitar"), TIDAK dipakai Worker untuk validasi apa pun
  // (validasi token tetap sepenuhnya di server lewat /verify).
  const LOGIN_TIME_STORAGE_KEY = "rl3_admin_login_time";

  // Berapa lama animasi fade login -> dashboard (ms). HARUS SAMA dengan
  // --admin-transition-duration di admin.css.
  const ADMIN_TRANSITION_MS = 420;

  // Umur token JWT di server (lihat README2.md bagian 5) — dipakai
  // murni untuk estimasi "Sesi berakhir sekitar" di halaman Profile,
  // BUKAN sumber kebenaran (kebenarannya tetap /verify di server, yang
  // akan menolak token walau estimasi klien di sini belum "habis").
  const TOKEN_LIFETIME_MS = 24 * 60 * 60 * 1000;

  // localStorage key untuk state sidebar (grup mana yang diciutkan,
  // apakah sidebar penuh diciutkan) — preferensi UI murni, aman
  // disimpan permanen (beda dengan token, ini bukan kredensial).
  const SIDENAV_COLLAPSED_KEY = "rl3_admin_sidenav_collapsed";
  const SIDENAV_GROUP_STATE_KEY = "rl3_admin_sidenav_groups";

  // ------------------------------------------------------------
  // STATE
  // ------------------------------------------------------------
  let draftContent = null;
  let draftPhotoDataUrl = null;
  let currentPhotoDataUrl = null;
  let isSaving = false;
  let draftProducts = [];

  // currentPage = halaman aktif saat ini ("overview" | "ui-settings" |
  // "product-display" | "profile"). Disinkronkan dengan location.hash.
  let currentPage = "overview";

  // Interval handle untuk jam Overview (dibersihkan/di-set ulang tidak
  // perlu karena hanya dibuat sekali di init(), tapi disimpan di sini
  // untuk kejelasan/debug).
  let overviewClockInterval = null;

  // Leaflet map instance + marker, dibuat sekali dan dipakai ulang
  // (bukan dibuat ulang tiap kali halaman Overview dibuka) supaya tidak
  // ada memory leak dari re-init Leaflet berkali-kali.
  let leafletMap = null;
  let leafletMarker = null;
  let hasFetchedVisitorGeo = false;

  // ------------------------------------------------------------
  // ENTRY POINT
  // ------------------------------------------------------------
  document.addEventListener("DOMContentLoaded", init);

  function init() {
    wireLoginForm();
    wireLogoutButton();
    wireTopbarButtons();
    wireFotoField();
    wireProductsSection();
    wireSideNav();
    wirePageRouting();
    wireMobileNav();

    const existingToken = getStoredToken();
    if (existingToken) {
      verifyToken(existingToken).then((result) => {
        if (result.valid) {
          enterDashboard(result.username);
        } else {
          clearStoredToken();
          showLoginScreen();
        }
      });
    } else {
      showLoginScreen();
    }
  }

  // ==============================================================
  // LOGIN
  // ==============================================================
  function wireLoginForm() {
    const form = document.getElementById("loginForm");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const username = document.getElementById("loginUsername").value;
      const password = document.getElementById("loginPassword").value;
      const errorBox = document.getElementById("loginError");
      const submitBtn = document.getElementById("loginSubmit");

      errorBox.textContent = "";
      errorBox.classList.remove("is-visible");
      setButtonLoading(submitBtn, true, "Masuk...");

      try {
        const res = await fetch(AUTH_API_BASE + "/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });

        let data;
        try {
          data = await res.json();
        } catch {
          data = null;
        }

        if (!res.ok || !data || !data.success) {
          const msg =
            res.status === 429
              ? "Terlalu banyak percobaan gagal. Coba lagi nanti."
              : (data && data.error) || "Username atau password salah.";
          errorBox.textContent = msg;
          errorBox.classList.add("is-visible");
          setButtonLoading(submitBtn, false);
          return;
        }

        storeToken(data.token);
        storeLoginTime(Date.now());
        await transitionToDashboard(username);
      } catch (err) {
        // Kemungkinan network error, worker down, atau CORS ditolak
        // (mis. domain saat ini beda dari ALLOWED_ORIGIN di worker).
        errorBox.textContent =
          "Tidak bisa menghubungi server autentikasi. Cek koneksi internet, atau pastikan domain ini sudah diizinkan (ALLOWED_ORIGIN) di worker.";
        errorBox.classList.add("is-visible");
        setButtonLoading(submitBtn, false);
      }
    });
  }

  function wireLogoutButton() {
    // DUA tombol logout sekarang ("Keluar" di footer sidebar, dan
    // "Keluar dari akun ini" di halaman Profile) — keduanya memanggil
    // fungsi yang identik, jadi disatukan lewat doLogout() alih-alih
    // duplikasi logika konfirmasi.
    const sideBtn = document.getElementById("logoutBtn");
    if (sideBtn) sideBtn.addEventListener("click", doLogout);

    const profileBtn = document.getElementById("profileLogoutBtn");
    if (profileBtn) profileBtn.addEventListener("click", doLogout);
  }

  function doLogout() {
    const hasUnsaved = document.body.classList.contains("has-unsaved-changes");
    if (hasUnsaved) {
      const ok = confirm(
        "Ada perubahan yang belum disimpan. Yakin mau keluar? Perubahan itu akan hilang (situs live TIDAK berubah karena belum sempat di-Apply Changes)."
      );
      if (!ok) return;
    }
    clearStoredToken();
    clearLoginTime();
    draftContent = null;
    draftPhotoDataUrl = null;
    currentPhotoDataUrl = null;
    draftProducts = [];
    document.body.classList.remove("has-unsaved-changes");
    showLoginScreen();
  }

  async function verifyToken(token) {
    try {
      const res = await fetch(AUTH_API_BASE + "/verify", {
        method: "GET",
        headers: { Authorization: "Bearer " + token },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !data.valid) {
        return { valid: false };
      }
      return { valid: true, username: data.username };
    } catch {
      return { valid: false };
    }
  }

  function getStoredToken() {
    try {
      return sessionStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  function storeToken(token) {
    try {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    } catch {
      /* Kalau storage diblokir, dashboard tetap bisa dipakai untuk sesi
         ini saja — cuma tidak akan "diingat" kalau halaman di-refresh. */
    }
  }

  function clearStoredToken() {
    try {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      /* no-op */
    }
  }

  // storeLoginTime/getStoredLoginTime/clearLoginTime — murni untuk
  // ditampilkan di halaman Profile (lihat computeProfileState()), bukan
  // bagian dari alur autentikasi. Kalau gagal ditulis (storage diblokir),
  // halaman Profile jatuh balik menampilkan "—" alih-alih error, lihat
  // refreshProfilePage().
  function storeLoginTime(epochMs) {
    try {
      sessionStorage.setItem(LOGIN_TIME_STORAGE_KEY, String(epochMs));
    } catch {
      /* no-op */
    }
  }

  function getStoredLoginTime() {
    try {
      const raw = sessionStorage.getItem(LOGIN_TIME_STORAGE_KEY);
      const n = raw ? Number(raw) : NaN;
      return Number.isFinite(n) ? n : null;
    } catch {
      return null;
    }
  }

  function clearLoginTime() {
    try {
      sessionStorage.removeItem(LOGIN_TIME_STORAGE_KEY);
    } catch {
      /* no-op */
    }
  }

  function setButtonLoading(btn, isLoading, loadingLabel) {
    if (!btn) return;
    if (isLoading) {
      btn.dataset.originalLabel = btn.textContent;
      btn.textContent = loadingLabel || "Memuat...";
      btn.disabled = true;
    } else {
      btn.textContent = btn.dataset.originalLabel || btn.textContent;
      btn.disabled = false;
    }
  }

  // ==============================================================
  // SWITCH SCREEN: LOGIN <-> DASHBOARD
  // ==============================================================
  function showLoginScreen() {
    document.getElementById("loginScreen").hidden = false;
    document.getElementById("dashboardScreen").hidden = true;
    document.body.classList.remove("is-dashboard", "is-transitioning-out", "is-transitioning-in");
    const pwField = document.getElementById("loginPassword");
    if (pwField) pwField.value = "";
    stopOverviewClock();
  }

  async function loadDraftFromServer() {
    let remoteContent = null;
    try {
      const res = await fetch(AUTH_API_BASE + "/content", { method: "GET" });
      const data = await res.json().catch(() => null);
      if (res.ok && data && data.success && data.content) {
        remoteContent = data.content;
      }
    } catch {
      // Network error / worker down -> remoteContent tetap null,
      // jatuh balik ke CONTENT bawaan di bawah.
    }

    draftContent = JSON.parse(JSON.stringify(remoteContent || CONTENT));

    try {
      const res = await fetch(AUTH_API_BASE + "/photo", { method: "GET" });
      const data = await res.json().catch(() => null);
      currentPhotoDataUrl = res.ok && data && data.success ? data.dataUrl || null : null;
    } catch {
      currentPhotoDataUrl = null;
    }

    draftPhotoDataUrl = null;

    try {
      const res = await fetch(AUTH_API_BASE + "/products", { method: "GET" });
      const data = await res.json().catch(() => null);
      if (res.ok && data && data.success && Array.isArray(data.products)) {
        draftProducts = JSON.parse(JSON.stringify(data.products));
      } else {
        draftProducts = typeof PRODUCTS !== "undefined" ? JSON.parse(JSON.stringify(PRODUCTS)) : [];
      }
    } catch {
      draftProducts = typeof PRODUCTS !== "undefined" ? JSON.parse(JSON.stringify(PRODUCTS)) : [];
    }
  }

  // Dipakai saat AUTO-LOGIN (token dari sessionStorage masih valid) —
  // TANPA animasi fade.
  async function enterDashboard(username) {
    await loadDraftFromServer();

    document.getElementById("loginScreen").hidden = true;
    document.getElementById("dashboardScreen").hidden = false;
    document.body.classList.add("is-dashboard");

    setLoggedInUsername(username);
    buildFormFromContent(draftContent);
    refreshFotoPreview();
    renderProductsSection();
    clearUnsavedState();
    startOverviewClock();
    checkWorkerStatus();
    navigateToPage(getPageFromHash(), { skipHashUpdate: true });
  }

  // Dipakai SETELAH submit form login sukses — dengan animasi fade.
  async function transitionToDashboard(username) {
    document.body.classList.add("is-transitioning-out");

    await Promise.all([wait(ADMIN_TRANSITION_MS), loadDraftFromServer()]);

    document.getElementById("loginScreen").hidden = true;
    document.getElementById("dashboardScreen").hidden = false;
    document.body.classList.remove("is-transitioning-out");

    setLoggedInUsername(username);
    buildFormFromContent(draftContent);
    refreshFotoPreview();
    renderProductsSection();
    clearUnsavedState();
    startOverviewClock();
    checkWorkerStatus();
    // Login baru selalu masuk ke Overview dulu, apa pun hash yang
    // kebetulan tertinggal dari sesi sebelumnya.
    navigateToPage("overview");

    document.getElementById("dashboardScreen").offsetHeight;

    document.body.classList.add("is-transitioning-in");
    await wait(ADMIN_TRANSITION_MS);
    document.body.classList.remove("is-transitioning-in");
    document.body.classList.add("is-dashboard");
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Set nama akun yang login di DUA tempat sekaligus: chip profil
  // topbar (loggedInAs) dan halaman Profile (profileUsername/profileName)
  // — disatukan di sini supaya kedua tempat itu tidak bisa "kelupaan"
  // di-update salah satu saat login/auto-login terjadi.
  function setLoggedInUsername(username) {
    const name = username || "";
    const whoEl = document.getElementById("loggedInAs");
    if (whoEl) whoEl.textContent = name;
    refreshProfilePage(name);
  }

  // ==============================================================
  // PAGE ROUTING (Overview / UI Settings / Product Display / Profile)
  // ------------------------------------------------------------
  // Empat "halaman" dashboard sekarang adalah <section data-page="...">
  // yang di-toggle lewat class is-active, bukan satu scroll panjang
  // seperti versi sebelumnya. Navigasi dikendalikan oleh location.hash
  // (mis. #ui-settings) supaya URL bisa di-refresh/di-bookmark ke
  // halaman yang sama, dan diklik dari mana saja lewat elemen ber-
  // attribute [data-page] (link sidebar, chip profil topbar, dst).
  // ==============================================================
  const VALID_PAGES = ["overview", "ui-settings", "product-display", "profile"];
  const PAGE_TITLES = {
    overview: "Overview",
    "ui-settings": "UI Settings",
    "product-display": "Product Display",
    profile: "Profile",
  };

  function getPageFromHash() {
    const raw = (location.hash || "").replace(/^#/, "");
    return VALID_PAGES.indexOf(raw) !== -1 ? raw : "overview";
  }

  function wirePageRouting() {
    // Klik pada APAPUN yang punya [data-page] menavigasi ke halaman itu
    // — dipasang lewat satu delegated listener di document supaya
    // elemen baru (mis. hasil re-render sidebar) otomatis ikut tertangani
    // tanpa perlu di-wire ulang satu-satu.
    document.addEventListener("click", (e) => {
      const trigger = e.target.closest("[data-page]");
      if (!trigger) return;
      e.preventDefault();
      navigateToPage(trigger.getAttribute("data-page"));
    });

    window.addEventListener("hashchange", () => {
      navigateToPage(getPageFromHash(), { skipHashUpdate: true });
    });
  }

  function navigateToPage(pageKey, opts) {
    const key = VALID_PAGES.indexOf(pageKey) !== -1 ? pageKey : "overview";
    const options = opts || {};

    currentPage = key;

    document.querySelectorAll(".dashboard-page").forEach((el) => {
      el.classList.toggle("is-active", el.getAttribute("data-page") === key);
    });

    document.querySelectorAll(".side-link[data-page]").forEach((el) => {
      el.classList.toggle("is-active", el.getAttribute("data-page") === key);
    });

    const titleEl = document.getElementById("topbarPageTitle");
    if (titleEl) titleEl.textContent = PAGE_TITLES[key] || "Dashboard";

    if (!options.skipHashUpdate && location.hash.replace(/^#/, "") !== key) {
      history.replaceState(null, "", "#" + key);
    }

    // Kalau grup sidebar yang berisi link aktif sedang diciutkan, buka
    // otomatis supaya halaman yang lagi dibuka tidak "hilang" dari
    // pandangan di sidebar.
    const activeLink = document.querySelector('.side-link[data-page="' + key + '"]');
    const parentGroup = activeLink && activeLink.closest(".side-group-collapsible");
    if (parentGroup && parentGroup.getAttribute("data-collapsed") === "true") {
      setGroupCollapsed(parentGroup, false);
    }

    // Overview: begitu halaman ini aktif, mulai fetch lokasi pengakses
    // (sekali per sesi dashboard, lihat guard hasFetchedVisitorGeo di
    // dalam fungsinya) dan pastikan peta Leaflet me-render ukurannya
    // dengan benar (Leaflet butuh invalidateSize() kalau container-nya
    // sempat disembunyikan lewat display:none saat pertama diinisialisasi).
    if (key === "overview") {
      ensureLeafletMap();
      fetchVisitorGeo();
      refreshOverviewStats();
    }

    // Menutup drawer sidebar mobile setiap kali pindah halaman (kalau
    // sedang terbuka) — di layar sempit, navigasi = maksud user sudah
    // selesai memilih, drawer tidak perlu tetap menutupi layar.
    document.body.classList.remove("mobile-nav-open");
  }

  // ==============================================================
  // SIDEBAR — grup collapsible + collapse sidebar penuh
  // ------------------------------------------------------------
  // Dua state independen, disimpan terpisah di localStorage (preferensi
  // tampilan murni, aman disimpan permanen — beda dengan token login):
  //   1. Grup mana yang diciutkan (mis. "Settings" ditutup) ->
  //      SIDENAV_GROUP_STATE_KEY, object { [groupName]: boolean }
  //   2. Apakah SELURUH sidebar diciutkan jadi mode ikon saja ->
  //      SIDENAV_COLLAPSED_KEY, "true"/"false"
  // ==============================================================
  function wireSideNav() {
    // ---- Toggle per-grup ----
    document.querySelectorAll(".side-group-collapsible").forEach((group) => {
      const toggleBtn = group.querySelector(".side-group-toggle");
      if (!toggleBtn) return;
      toggleBtn.addEventListener("click", () => {
        const isCollapsed = group.getAttribute("data-collapsed") === "true";
        setGroupCollapsed(group, !isCollapsed);
      });
    });

    // Terapkan state grup yang tersimpan dari sesi sebelumnya.
    const savedGroupState = readJsonFromStorage(SIDENAV_GROUP_STATE_KEY, {});
    document.querySelectorAll(".side-group-collapsible").forEach((group) => {
      const name = group.getAttribute("data-group");
      if (name && savedGroupState[name]) {
        setGroupCollapsed(group, true, { skipSave: true });
      }
    });

    // ---- Toggle sidebar penuh (mode ikon) ----
    const collapseBtn = document.getElementById("sideNavCollapseBtn");
    if (collapseBtn) {
      collapseBtn.addEventListener("click", () => {
        const isCollapsed = document.body.classList.contains("side-nav-collapsed");
        setSideNavCollapsed(!isCollapsed);
      });
    }
    const savedFullCollapse = readFromStorage(SIDENAV_COLLAPSED_KEY) === "true";
    setSideNavCollapsed(savedFullCollapse, { skipSave: true });
  }

  function setGroupCollapsed(groupEl, collapsed, opts) {
    const options = opts || {};
    groupEl.setAttribute("data-collapsed", collapsed ? "true" : "false");
    const toggleBtn = groupEl.querySelector(".side-group-toggle");
    if (toggleBtn) toggleBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");

    if (!options.skipSave) {
      const name = groupEl.getAttribute("data-group");
      if (name) {
        const state = readJsonFromStorage(SIDENAV_GROUP_STATE_KEY, {});
        state[name] = collapsed;
        writeJsonToStorage(SIDENAV_GROUP_STATE_KEY, state);
      }
    }
  }

  function setSideNavCollapsed(collapsed, opts) {
    const options = opts || {};
    document.body.classList.toggle("side-nav-collapsed", collapsed);
    const btn = document.getElementById("sideNavCollapseBtn");
    if (btn) btn.setAttribute("title", collapsed ? "Perluas sidebar" : "Ciutkan sidebar");

    if (!options.skipSave) {
      writeToStorage(SIDENAV_COLLAPSED_KEY, collapsed ? "true" : "false");
    }

    // Leaflet perlu tahu ukuran container-nya berubah setiap kali
    // sidebar diciutkan/dibuka (lebar kolom kanan ikut berubah), atau
    // peta akan tampil terpotong/blank sampai user resize window manual.
    if (leafletMap) {
      window.setTimeout(() => leafletMap.invalidateSize(), 240);
    }
  }

  // ---- Mobile drawer (sidebar overlay di layar sempit) ----
  function wireMobileNav() {
    const btn = document.getElementById("mobileNavBtn");
    if (btn) {
      btn.addEventListener("click", () => {
        document.body.classList.toggle("mobile-nav-open");
      });
    }

    // Klik di luar drawer (backdrop, lewat pseudo-element ::after)
    // menutup drawer — dideteksi lewat klik pada <body> di luar .side-nav.
    document.addEventListener("click", (e) => {
      if (!document.body.classList.contains("mobile-nav-open")) return;
      if (e.target.closest(".side-nav") || e.target.closest("#mobileNavBtn")) return;
      document.body.classList.remove("mobile-nav-open");
    });
  }

  // ---- Helper localStorage kecil, dengan try/catch (sama alasannya
  // dengan getStoredToken dkk — sebagian browser bisa memblokir storage) ----
  function readFromStorage(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  function writeToStorage(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* no-op */
    }
  }
  function readJsonFromStorage(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }
  function writeJsonToStorage(key, obj) {
    try {
      localStorage.setItem(key, JSON.stringify(obj));
    } catch {
      /* no-op */
    }
  }

  // ==============================================================
  // FORM GENERATOR (UI Settings)
  // ------------------------------------------------------------
  // Membaca struktur draftContent (hasil clone dari CONTENT di
  // content.js) dan otomatis bikin section + field form untuk tiap
  // bagian. Logika ini TIDAK berubah dari versi sebelumnya — cuma
  // targetnya sekarang khusus halaman UI Settings (#formSections di
  // dalam #page-ui-settings), bukan satu-satunya isi dashboard.
  // ==============================================================
  const SECTION_LABELS = {
    meta: "Meta (Tab Browser & SEO)",
    navbar: "Navbar",
    mobileDrawer: "Menu Mobile",
    hero: "Hero (Bagian Paling Atas)",
    logoBar: "Logo Bar (Daftar Genre Berjalan)",
    tentang: "01 — Tentang Saya",
    genre: "02 — Genre",
    skill: "03 — Keahlian",
    karya: "04 — Karya",
    alat: "05 — Alat Kerja",
    statistik: "06 — Statistik",
    quote: "07 — Prinsip Kerja",
    motto: "Motto Besar",
    kontak: "08 — Kontak",
    footer: "Footer",
  };

  const SECTION_ORDER = Object.keys(SECTION_LABELS);

  const HTML_FIELDS = new Set(["skill.desc"]);

  const LONG_TEXT_KEYS = new Set([
    "desc",
    "subheading",
    "text",
    "ogDescription",
    "metaDescription",
    "tagline",
  ]);

  function buildFormFromContent(content) {
    const container = document.getElementById("formSections");
    container.innerHTML = "";

    const orderedKeys = Object.keys(content).sort((a, b) => {
      const ia = SECTION_ORDER.indexOf(a);
      const ib = SECTION_ORDER.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });

    orderedKeys.forEach((sectionKey) => {
      const sectionEl = renderSection(sectionKey, content[sectionKey]);
      container.appendChild(sectionEl);
    });

    buildUiSettingsSubnav(orderedKeys);
    refreshPreview();
  }

  function renderSection(sectionKey, sectionValue) {
    const section = document.createElement("section");
    section.className = "form-section";
    section.id = "section-" + sectionKey;

    const heading = document.createElement("h2");
    heading.className = "form-section-title";
    heading.textContent = SECTION_LABELS[sectionKey] || humanizeKey(sectionKey);
    section.appendChild(heading);

    const body = document.createElement("div");
    body.className = "form-section-body";
    section.appendChild(body);

    renderFieldsInto(body, sectionValue, [sectionKey]);

    return section;
  }

  function renderFieldsInto(parentEl, value, path) {
    if (Array.isArray(value)) {
      renderArrayField(parentEl, value, path);
      return;
    }

    if (value !== null && typeof value === "object") {
      Object.keys(value).forEach((key) => {
        const childPath = path.concat(key);
        const childValue = value[key];

        if (childValue !== null && typeof childValue === "object") {
          const group = document.createElement("div");
          group.className = "field-group";
          const label = document.createElement("div");
          label.className = "field-group-label";
          label.textContent = humanizeKey(key);
          group.appendChild(label);
          parentEl.appendChild(group);
          renderFieldsInto(group, childValue, childPath);
        } else {
          renderPrimitiveField(parentEl, childValue, childPath, key);
        }
      });
      return;
    }

    renderPrimitiveField(parentEl, value, path, path[path.length - 1]);
  }

  function renderArrayField(parentEl, arr, path) {
    const wrap = document.createElement("div");
    wrap.className = "array-field";
    parentEl.appendChild(wrap);

    arr.forEach((item, index) => {
      const itemPath = path.concat(index);

      if (item !== null && typeof item === "object") {
        const card = document.createElement("div");
        card.className = "array-item-card";

        const cardLabel = document.createElement("div");
        cardLabel.className = "array-item-label";
        cardLabel.textContent = describeArrayItem(item, index);
        card.appendChild(cardLabel);

        renderFieldsInto(card, item, itemPath);
        wrap.appendChild(card);
      } else {
        renderPrimitiveField(wrap, item, itemPath, String(index), true);
      }
    });
  }

  function describeArrayItem(item, index) {
    const candidateKeys = ["title", "label", "name", "tag", "who", "heading"];
    for (const k of candidateKeys) {
      if (typeof item[k] === "string" && item[k].trim()) {
        return "#" + (index + 1) + " — " + item[k];
      }
    }
    return "Item #" + (index + 1);
  }

  function renderPrimitiveField(parentEl, value, path, keyForLabel, isArrayPrimitive) {
    const wrap = document.createElement("div");
    wrap.className = "field";

    const id = "field-" + path.join("-");
    const dotPath = path.filter((p) => typeof p === "string").join(".");

    const label = document.createElement("label");
    label.className = "field-label";
    label.setAttribute("for", id);
    label.textContent = isArrayPrimitive
      ? "Item " + (Number(keyForLabel) + 1)
      : humanizeKey(keyForLabel);
    wrap.appendChild(label);

    const type = typeof value;
    let input;

    if (type === "number") {
      input = document.createElement("input");
      input.type = "number";
      input.value = value;
    } else if (HTML_FIELDS.has(dotPath) || shouldUseTextarea(keyForLabel, value)) {
      input = document.createElement("textarea");
      input.value = value;
      input.rows = HTML_FIELDS.has(dotPath) ? 5 : 3;
      if (HTML_FIELDS.has(dotPath)) {
        const note = document.createElement("p");
        note.className = "field-note";
        note.textContent =
          "Mengandung tag HTML (mis. <strong>, <br>) — tag ini dipertahankan apa adanya, hanya edit teksnya.";
        wrap.appendChild(note);
      }
    } else {
      input = document.createElement("input");
      input.type = "text";
      input.value = value;
    }

    input.id = id;
    input.className = "field-input";
    input.addEventListener("input", () => {
      setValueAtPath(draftContent, path, coerceValue(input));
      markUnsaved();
      refreshPreview();
    });

    wrap.appendChild(input);
    parentEl.appendChild(wrap);
  }

  function shouldUseTextarea(key, value) {
    if (typeof value !== "string") return false;
    if (LONG_TEXT_KEYS.has(key)) return true;
    return value.length > 90;
  }

  function coerceValue(inputEl) {
    if (inputEl.type === "number") {
      const n = Number(inputEl.value);
      return Number.isFinite(n) ? n : 0;
    }
    return inputEl.value;
  }

  function setValueAtPath(obj, path, value) {
    let cur = obj;
    for (let i = 0; i < path.length - 1; i++) {
      cur = cur[path[i]];
    }
    cur[path[path.length - 1]] = value;
  }

  function humanizeKey(key) {
    const withSpaces = String(key)
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ");
    return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
  }

  // ==============================================================
  // SUBNAV UI SETTINGS (loncat antar section di dalam halaman ini)
  // ------------------------------------------------------------
  // Pengganti buildNav() versi lama — dulu ini adalah SATU-SATUNYA
  // sidebar dashboard (termasuk link ke section Foto & Produk yang
  // sekarang sudah jadi halaman/section terpisah). Sekarang khusus
  // subnav internal halaman UI Settings, targetnya #uiSettingsSubnav
  // (kolom kiri di dalam .settings-layout), dan hanya berisi section
  // yang memang ada di halaman ini (Foto + section dari content.js).
  // ==============================================================
  function buildUiSettingsSubnav(orderedKeys) {
    const nav = document.getElementById("uiSettingsSubnav");
    if (!nav) return;
    nav.innerHTML = "";

    const allKeys = [{ id: "foto", label: "Foto (Avatar Chat)" }].concat(
      orderedKeys.map((key) => ({
        id: key,
        label: SECTION_LABELS[key] || humanizeKey(key),
      }))
    );

    allKeys.forEach((entry, index) => {
      const link = document.createElement("a");
      link.href = "#section-" + entry.id;
      link.className = "form-nav-link";
      if (index === 0) link.classList.add("is-active");
      link.textContent = entry.label;
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const target = document.getElementById("section-" + entry.id);
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
        nav.querySelectorAll(".form-nav-link").forEach((l) => l.classList.remove("is-active"));
        link.classList.add("is-active");
      });
      nav.appendChild(link);
    });
  }

  // ==============================================================
  // FIELD FOTO (avatar chat widget)
  // ------------------------------------------------------------
  // Logika tidak berubah dari versi sebelumnya — foto disimpan
  // terpisah dari content.js (KV key "photo:avatar"). Satu tambahan:
  // refreshFotoPreview() sekarang JUGA memperbarui avatar di chip
  // profil topbar dan di halaman Profile, karena keduanya menampilkan
  // foto yang sama (lihat catatan di admin/index.html section Foto).
  // ==============================================================
  function wireFotoField() {
    const pickBtn = document.getElementById("fotoAvatarPickBtn");
    const input = document.getElementById("fotoAvatarInput");
    const filenameEl = document.getElementById("fotoAvatarFilename");
    if (!pickBtn || !input) return;

    pickBtn.addEventListener("click", () => input.click());

    input.addEventListener("change", () => {
      const file = input.files && input.files[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        alert("File yang dipilih bukan gambar. Pilih file PNG/JPG/WEBP/GIF.");
        input.value = "";
        return;
      }
      const MAX_FILE_BYTES = 1.6 * 1024 * 1024;
      if (file.size > MAX_FILE_BYTES) {
        alert("Ukuran file terlalu besar. Pakai gambar di bawah ~1.5MB.");
        input.value = "";
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        draftPhotoDataUrl = String(reader.result || "");
        if (filenameEl) filenameEl.textContent = file.name;
        markUnsaved();
        refreshFotoPreview();
      };
      reader.onerror = () => {
        alert("Gagal membaca file gambar. Coba file lain.");
      };
      reader.readAsDataURL(file);
    });
  }

  function refreshFotoPreview() {
    const resolvedSrc = draftPhotoDataUrl || currentPhotoDataUrl || "../assets/img/stickers.jpg";

    const img = document.getElementById("fotoAvatarPreview");
    if (img) img.src = resolvedSrc;

    const filenameEl = document.getElementById("fotoAvatarFilename");
    if (filenameEl && !draftPhotoDataUrl) {
      filenameEl.textContent = currentPhotoDataUrl
        ? "Pakai foto yang sedang tersimpan di server"
        : "Belum ada foto baru dipilih";
    }

    // Chip avatar di topbar (background-image, bulat kecil).
    const topbarAvatar = document.getElementById("topbarProfileAvatar");
    if (topbarAvatar) topbarAvatar.style.backgroundImage = "url('" + resolvedSrc + "')";

    // Avatar besar di halaman Profile.
    const profileAvatarImg = document.getElementById("profileAvatarImg");
    if (profileAvatarImg) profileAvatarImg.src = resolvedSrc;
  }

  // ==============================================================
  // PRODUCT DISPLAY — tambah, edit field, hapus
  // ------------------------------------------------------------
  // Semua fungsi fetch (uploadProductImage/deleteProductImage) TIDAK
  // BERUBAH dari versi sebelumnya — endpoint, urutan request, dan
  // trade-off (upload gambar langsung, bukan ditunda sampai Simpan)
  // semuanya sama persis, lihat README2.md bagian 3.6-3.7 untuk kenapa.
  // Yang berubah HANYA renderProductCard(): dulu list vertikal, sekarang
  // grid card 1:1 (imageUrl sebagai cover foto persegi), mengikuti
  // referensi desain.
  // ==============================================================
  const MAX_PRODUCT_IMAGE_FILE_BYTES = 5 * 1024 * 1024; // 5MB — samakan dengan MAX_PRODUCT_IMAGE_FILE_BYTES di worker/src/index.js

  async function uploadProductImage(file) {
    const token = getStoredToken();
    if (!token) {
      throw new Error("Sesi login sudah berakhir. Silakan login ulang lalu coba lagi.");
    }
    const res = await fetch(AUTH_API_BASE + "/product-image", {
      method: "POST",
      headers: {
        "Content-Type": file.type,
        Authorization: "Bearer " + token,
      },
      body: file,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || !data.success || !data.imageUrl) {
      throw new Error((data && data.error) || "Gagal mengupload gambar ke server.");
    }
    return data.imageUrl;
  }

  async function deleteProductImage(imageUrl) {
    const token = getStoredToken();
    if (!token || !imageUrl) return;
    try {
      await fetch(AUTH_API_BASE + "/product-image", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ imageUrl }),
      });
    } catch (err) {
      console.error("Gagal menghapus gambar produk lama dari R2 (tidak fatal):", err);
    }
  }

  function wireProductsSection() {
    const addBtn = document.getElementById("addProductBtn");
    if (addBtn) {
      addBtn.addEventListener("click", () => {
        draftProducts.push({
          id: generateProductId(),
          name: "",
          price: 0,
          imageUrl: null,
        });
        markUnsaved();
        renderProductsSection();
        // Fokus ke field nama produk yang baru saja ditambah.
        const list = document.getElementById("productList");
        const lastNameInput = list && list.querySelector(".product-card:last-child .field-input");
        if (lastNameInput) lastNameInput.focus();
      });
    }
  }

  function generateProductId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return "produk-" + Date.now() + "-" + Math.random().toString(16).slice(2, 8);
  }

  function renderProductsSection() {
    const list = document.getElementById("productList");
    if (!list) return;
    list.innerHTML = "";

    if (draftProducts.length === 0) {
      const empty = document.createElement("p");
      empty.className = "product-empty-note";
      empty.textContent = 'Belum ada produk. Klik "+ Tambah Produk" di atas untuk menambah produk pertama.';
      list.appendChild(empty);
    } else {
      draftProducts.forEach((product, index) => {
        list.appendChild(renderProductCard(product, index));
      });
    }

    const badge = document.getElementById("productCountBadge");
    if (badge) badge.textContent = String(draftProducts.length);

    const statEl = document.getElementById("statProductCount");
    if (statEl) statEl.textContent = String(draftProducts.length);

    refreshPreview();
  }

  // Bangun satu kartu grid produk: foto persegi (dengan tombol ganti/
  // hapus foto mengambang di bawahnya), lalu field nama & harga.
  // Struktur DOM sengaja mengikuti class CSS .product-card-* di
  // admin.css (lihat bagian PRODUCT DISPLAY PAGE) — beda total dari
  // .array-item-card/.product-item-card versi list lama.
  function renderProductCard(product, index) {
    const card = document.createElement("div");
    card.className = "product-card";

    // ---- Header: nomor urut + tombol hapus produk ----
    const header = document.createElement("div");
    header.className = "product-card-header";

    const indexLabel = document.createElement("span");
    indexLabel.className = "product-card-index";
    indexLabel.textContent = "#" + (index + 1);
    header.appendChild(indexLabel);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn-remove-product";
    removeBtn.title = "Hapus produk ini";
    removeBtn.setAttribute("aria-label", "Hapus produk ini");
    removeBtn.innerHTML =
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"></path></svg> Hapus';
    removeBtn.addEventListener("click", () => {
      const hasContent = product.name.trim() || product.price > 0 || product.imageUrl;
      if (
        hasContent &&
        !confirm(
          'Hapus produk "' +
            (product.name || "(tanpa nama)") +
            '" dari katalog? Perubahan ini baru permanen setelah kamu klik Simpan/Apply Changes.'
        )
      ) {
        return;
      }
      if (product.imageUrl) {
        deleteProductImage(product.imageUrl);
      }
      draftProducts = draftProducts.filter((p) => p.id !== product.id);
      markUnsaved();
      renderProductsSection();
    });
    header.appendChild(removeBtn);
    card.appendChild(header);

    // ---- Foto produk (persegi, tombol ganti foto mengambang) ----
    const imgWrap = document.createElement("div");
    imgWrap.className = "product-card-image-wrap";

    if (product.imageUrl) {
      const imgPreview = document.createElement("img");
      imgPreview.className = "product-card-image";
      imgPreview.alt = "Pratinjau foto produk";
      imgPreview.src = product.imageUrl;
      imgWrap.appendChild(imgPreview);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "product-card-image-placeholder";
      placeholder.innerHTML =
        '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 7h18l-1.5 12.5a2 2 0 01-2 1.5H6.5a2 2 0 01-2-1.5L3 7z"/><path d="M8 7V5a4 4 0 018 0v2"/></svg>';
      imgWrap.appendChild(placeholder);
    }

    const imgInput = document.createElement("input");
    imgInput.type = "file";
    imgInput.accept = "image/png,image/jpeg,image/webp,image/gif";
    imgInput.className = "field-image-input";

    const imgPickBtn = document.createElement("button");
    imgPickBtn.type = "button";
    imgPickBtn.className = "product-card-image-btn";
    imgPickBtn.textContent = product.imageUrl ? "Ganti Foto" : "Pilih Foto...";
    imgPickBtn.addEventListener("click", () => imgInput.click());

    imgInput.addEventListener("change", () => {
      const file = imgInput.files && imgInput.files[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        alert("File yang dipilih bukan gambar. Pilih file PNG/JPG/JPEG/WEBP/GIF.");
        imgInput.value = "";
        return;
      }
      if (file.size > MAX_PRODUCT_IMAGE_FILE_BYTES) {
        alert("Ukuran file terlalu besar. Maksimal " + Math.round(MAX_PRODUCT_IMAGE_FILE_BYTES / (1024 * 1024)) + "MB.");
        imgInput.value = "";
        return;
      }

      const oldImageUrl = product.imageUrl;
      imgPickBtn.disabled = true;
      imgPickBtn.textContent = "Mengupload...";

      uploadProductImage(file)
        .then((imageUrl) => {
          product.imageUrl = imageUrl;
          markUnsaved();
          renderProductsSection();
          if (oldImageUrl) {
            deleteProductImage(oldImageUrl);
          }
        })
        .catch((err) => {
          alert(err.message || "Gagal mengupload gambar. Coba lagi.");
          imgPickBtn.disabled = false;
          imgPickBtn.textContent = product.imageUrl ? "Ganti Foto" : "Pilih Foto...";
        })
        .finally(() => {
          imgInput.value = "";
        });
    });

    imgWrap.appendChild(imgPickBtn);
    imgWrap.appendChild(imgInput);
    card.appendChild(imgWrap);

    if (product.imageUrl) {
      const removeImgBtn = document.createElement("button");
      removeImgBtn.type = "button";
      removeImgBtn.className = "product-card-image-remove";
      removeImgBtn.textContent = "Hapus foto ini";
      removeImgBtn.addEventListener("click", () => {
        const oldImageUrl = product.imageUrl;
        product.imageUrl = null;
        markUnsaved();
        renderProductsSection();
        deleteProductImage(oldImageUrl);
      });
      card.appendChild(removeImgBtn);
    }

    // ---- Field: nama produk ----
    const nameField = document.createElement("div");
    nameField.className = "product-card-field";
    const nameLabel = document.createElement("label");
    nameLabel.className = "product-card-field-label";
    nameLabel.textContent = "Nama produk";
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "field-input";
    nameInput.value = product.name;
    nameInput.placeholder = "Misal: Sample Pack Vol. 1";
    nameInput.addEventListener("input", () => {
      product.name = nameInput.value;
      markUnsaved();
      refreshPreview();
    });
    nameField.appendChild(nameLabel);
    nameField.appendChild(nameInput);
    card.appendChild(nameField);

    // ---- Field: harga produk ----
    const priceField = document.createElement("div");
    priceField.className = "product-card-field";
    const priceLabel = document.createElement("label");
    priceLabel.className = "product-card-field-label";
    priceLabel.textContent = "Harga (Rp)";
    const priceInput = document.createElement("input");
    priceInput.type = "number";
    priceInput.className = "field-input";
    priceInput.min = "0";
    priceInput.step = "1000";
    priceInput.value = product.price;
    priceInput.addEventListener("input", () => {
      const n = Number(priceInput.value);
      product.price = Number.isFinite(n) && n >= 0 ? n : 0;
      markUnsaved();
      refreshPreview();
    });
    priceField.appendChild(priceLabel);
    priceField.appendChild(priceInput);
    card.appendChild(priceField);

    return card;
  }

  // ------------------------------------------------------------
  // Preview ringan (kolom kanan halaman UI Settings). Logika sama
  // persis dengan versi sebelumnya, MINUS blok preview produk — produk
  // sekarang punya halaman sendiri (Product Display) dengan grid card
  // penuh, jadi ringkasan kecil di sini sudah tidak diperlukan lagi
  // (dan #previewProducts tidak lagi ada di admin/index.html).
  // ------------------------------------------------------------
  function refreshPreview() {
    const c = draftContent;
    if (!c) return;

    setText("previewPageTitle", c.meta.pageTitle);
    setText("previewHeroHeading", stripTags(c.hero.heading));
    setText("previewHeroSub", c.hero.subheading);
    setText("previewHeroLocation", c.hero.meta.location);

    const genreList = document.getElementById("previewGenreList");
    if (genreList) {
      genreList.innerHTML = "";
      c.logoBar.items.forEach((g) => {
        const chip = document.createElement("span");
        chip.className = "preview-chip";
        chip.textContent = g;
        genreList.appendChild(chip);
      });
    }

    const releaseList = document.getElementById("previewReleases");
    if (releaseList) {
      releaseList.innerHTML = "";
      c.karya.releases.forEach((r) => {
        const row = document.createElement("div");
        row.className = "preview-release-row";
        row.innerHTML =
          '<span class="preview-release-num">' + escapeHtml(r.num) + "</span>" +
          '<span class="preview-release-title">' + escapeHtml(r.title) + "</span>" +
          '<span class="preview-release-genre">' + escapeHtml(r.genre) + "</span>";
        releaseList.appendChild(row);
      });
    }

    setText("previewEmail", c.kontak.email);
    setText("previewFooterTagline", c.footer.tagline);

    refreshOverviewStats();
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function stripTags(html) {
    return String(html).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // ==============================================================
  // OVERVIEW PAGE — ringkasan konten
  // ------------------------------------------------------------
  // Angka murni dihitung dari draftContent/draftProducts yang SUDAH
  // ada di memori (tidak ada fetch tambahan) — jadi ikut update
  // langsung setiap kali kamu ubah field di UI Settings atau
  // tambah/hapus produk di Product Display, tanpa perlu pindah
  // halaman dulu.
  // ==============================================================
  function refreshOverviewStats() {
    const c = draftContent;
    if (!c) return;
    setText("statReleaseCount", String((c.karya && c.karya.releases && c.karya.releases.length) || 0));
    setText("statGenreCount", String((c.logoBar && c.logoBar.items && c.logoBar.items.length) || 0));
    setText("statToolCount", String((c.alat && c.alat.items && c.alat.items.length) || 0));
    setText("statProductCount", String(draftProducts.length));
  }

  // Cek cepat apakah Worker bisa dihubungi (dipakai untuk titik status
  // hijau/kuning/merah di kartu "Status Server"). GET /content dipilih
  // sebagai endpoint cek karena tidak butuh token (publicly readable,
  // lihat README2.md bagian 3.2) — jadi ini murni cek konektivitas,
  // BUKAN pengecekan ulang validitas token (itu sudah ditangani terpisah
  // oleh verifyToken() di alur login/auto-login).
  async function checkWorkerStatus() {
    const dot = document.getElementById("ovWorkerDot");
    const label = document.getElementById("ovWorkerLabel");
    if (!dot || !label) return;

    dot.setAttribute("data-state", "checking");
    label.textContent = "Mengecek koneksi Worker…";

    try {
      const res = await fetch(AUTH_API_BASE + "/content", { method: "GET" });
      if (res.ok) {
        dot.setAttribute("data-state", "ok");
        label.textContent = "Worker & Cloudflare KV terhubung normal";
      } else {
        dot.setAttribute("data-state", "error");
        label.textContent = "Worker merespons tapi ada masalah (HTTP " + res.status + ")";
      }
    } catch {
      dot.setAttribute("data-state", "error");
      label.textContent = "Tidak bisa menghubungi Worker. Cek koneksi internet.";
    }
  }

  // ==============================================================
  // OVERVIEW PAGE — jam, sapaan, cuaca
  // ------------------------------------------------------------
  // Deteksi zona waktu (WIB/WITA/WIT) memakai pola yang SAMA PERSIS
  // dengan assets/js/hero-greeting.js di situs utama (detectZonaWaktu
  // di sana) — supaya dashboard dan situs publik selalu menampilkan
  // sapaan/jam yang konsisten untuk browser yang sama, alih-alih dua
  // logika terpisah yang bisa saling berbeda kalau salah satu diubah
  // di kemudian hari tanpa ubah yang lain.
  // ==============================================================
  function detectZonaWaktuOverview() {
    const fallback = { label: "WIB", offset: 7 };
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      const petaWITA = ["Asia/Makassar", "Asia/Ujung_Pandang", "Asia/Denpasar", "Asia/Kuching"];
      const petaWIT = ["Asia/Jayapura"];
      const petaWIB = ["Asia/Jakarta", "Asia/Pontianak"];

      if (petaWITA.indexOf(tz) !== -1) return { label: "WITA", offset: 8 };
      if (petaWIT.indexOf(tz) !== -1) return { label: "WIT", offset: 9 };
      if (petaWIB.indexOf(tz) !== -1) return { label: "WIB", offset: 7 };

      const offsetJam = -new Date().getTimezoneOffset() / 60;
      if (offsetJam === 8) return { label: "WITA", offset: 8 };
      if (offsetJam === 9) return { label: "WIT", offset: 9 };
      if (offsetJam === 7) return { label: "WIB", offset: 7 };
      return fallback;
    } catch {
      return fallback;
    }
  }

  function greetingForHour(hour) {
    if (hour >= 4 && hour < 11) return "Selamat pagi";
    if (hour >= 11 && hour < 15) return "Selamat siang";
    if (hour >= 15 && hour < 18) return "Selamat sore";
    return "Selamat malam";
  }

  const HARI_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const BULAN_ID = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];

  function startOverviewClock() {
    if (overviewClockInterval) return; // sudah jalan, jangan bikin interval dobel
    tickOverviewClock();
    overviewClockInterval = window.setInterval(tickOverviewClock, 1000);
  }

  function stopOverviewClock() {
    if (overviewClockInterval) {
      window.clearInterval(overviewClockInterval);
      overviewClockInterval = null;
    }
  }

  function tickOverviewClock() {
    const zona = detectZonaWaktuOverview();
    const now = new Date();

    // Hitung waktu di zona WIB/WITA/WIT terdeteksi dengan basis UTC,
    // BUKAN pakai toLocaleString(timeZone: ...) — supaya perilakunya
    // konsisten dengan hero-greeting.js di situs utama (yang juga
    // menghitung manual dari offset, bukan API locale yang bisa beda
    // dukungannya antar browser).
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    const zonedDate = new Date(utcMs + zona.offset * 3600000);

    const h = zonedDate.getHours();
    const m = zonedDate.getMinutes();
    const hh = String(h).padStart(2, "0");
    const mm = String(m).padStart(2, "0");

    setText("ovClockTime", hh + ":" + mm);
    setText("ovClockZone", zona.label);

    const greetingHeadingEl = document.getElementById("ovGreetingHeading");
    const greetingLabelEl = document.getElementById("ovGreetingLabel");
    const displayName = document.getElementById("loggedInAs") ? document.getElementById("loggedInAs").textContent : "";
    if (greetingLabelEl) greetingLabelEl.textContent = greetingForHour(h);
    if (greetingHeadingEl) {
      greetingHeadingEl.textContent = displayName ? "Halo, " + displayName + "!" : "Halo!";
    }

    const dateStr =
      HARI_ID[zonedDate.getDay()] + ", " + zonedDate.getDate() + " " + BULAN_ID[zonedDate.getMonth()] + " " + zonedDate.getFullYear();
    setText("ovDate", dateStr);
  }

  // ==============================================================
  // OVERVIEW PAGE — lokasi pengakses (IP geolocation) + peta + cuaca
  // ------------------------------------------------------------
  // Layanan dipakai:
  //   - ipapi.co/json/  : IP publik + estimasi kota/negara + lat/lon.
  //     Gratis untuk pemakaian ringan, TANPA API key, dan mendukung
  //     CORS langsung dari browser (makanya bisa dipanggil dari sini,
  //     bukan dari sisi Worker).
  //   - Open-Meteo       : cuaca saat ini berdasarkan lat/lon yang sama
  //     dari ipapi.co, juga gratis & tanpa API key.
  //   - Leaflet + tile OpenStreetMap : render peta, sepenuhnya open-
  //     source, tanpa API key (beda dengan Google Maps).
  //
  // SEKALI PER SESI: fetch ini hanya dijalankan sekali setiap dashboard
  // dibuka (guard hasFetchedVisitorGeo), bukan tiap kali halaman
  // Overview dikunjungi ulang dalam sesi yang sama — supaya tidak
  // membebani ipapi.co dengan request berulang tanpa alasan tiap kali
  // kamu pindah-pindah halaman dashboard.
  //
  // KETERBATASAN YANG PERLU DISADARI (juga sudah dijelaskan di teks UI,
  // #page-overview -> .ov-map-note): ini estimasi lokasi dari infrastruktur
  // jaringan (IP), BUKAN GPS presisi — bisa meleset sampai level
  // kota/wilayah, apalagi kalau memakai VPN. Tidak ada riwayat/log
  // disimpan di server manapun; murni ditampilkan langsung di
  // browser untuk sesi ini saja.
  // ==============================================================
  function ensureLeafletMap() {
    if (leafletMap || typeof L === "undefined") return;
    const container = document.getElementById("ovMapContainer");
    if (!container) return;

    leafletMap = L.map(container, {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: false, // biar scroll halaman dashboard tidak "kejebak" ter-zoom peta
    }).setView([-7.801, 110.364], 11); // fallback awal: Yogyakarta, sebelum lokasi asli ketemu

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    }).addTo(leafletMap);

    window.setTimeout(() => leafletMap.invalidateSize(), 100);
  }

  async function fetchVisitorGeo() {
    if (hasFetchedVisitorGeo) return;
    hasFetchedVisitorGeo = true;

    const badge = document.getElementById("ovMapBadge");
    if (badge) {
      badge.textContent = "Mendeteksi…";
      badge.removeAttribute("data-state");
    }

    let geo = null;
    try {
      const res = await fetch("https://ipapi.co/json/");
      const data = await res.json().catch(() => null);
      if (data && !data.error && typeof data.latitude === "number" && typeof data.longitude === "number") {
        geo = data;
      }
    } catch {
      geo = null;
    }

    if (!geo) {
      if (badge) {
        badge.textContent = "Tidak terdeteksi";
        badge.setAttribute("data-state", "error");
      }
      setText("ovLoc", "");
      const locWrap = document.getElementById("ovLoc");
      if (locWrap) {
        locWrap.innerHTML =
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0118 0z"></path><circle cx="12" cy="10" r="3"></circle></svg><span>Lokasi tidak terdeteksi</span>';
      }
      fetchWeather(null);
      return;
    }

    const cityLabel = [geo.city, geo.region, geo.country_name].filter(Boolean).join(", ");

    if (badge) {
      badge.textContent = geo.ip ? "IP " + geo.ip : "Terdeteksi";
      badge.setAttribute("data-state", "ok");
    }

    const locWrap = document.getElementById("ovLoc");
    if (locWrap) {
      locWrap.innerHTML =
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0118 0z"></path><circle cx="12" cy="10" r="3"></circle></svg><span>' +
        escapeHtml(cityLabel || "Lokasi tidak diketahui") +
        "</span>";
    }

    if (leafletMap) {
      leafletMap.setView([geo.latitude, geo.longitude], 12);
      if (leafletMarker) {
        leafletMarker.setLatLng([geo.latitude, geo.longitude]);
      } else {
        leafletMarker = L.marker([geo.latitude, geo.longitude]).addTo(leafletMap);
      }
      leafletMarker.bindPopup(escapeHtml(cityLabel || "Lokasi pengakses") + (geo.ip ? "<br>IP: " + escapeHtml(geo.ip) : ""));
      window.setTimeout(() => leafletMap.invalidateSize(), 150);
    }

    fetchWeather({ lat: geo.latitude, lon: geo.longitude });
  }

  const WEATHER_CODE_MAP = {
    0: { icon: "☀️", desc: "Cerah" },
    1: { icon: "🌤️", desc: "Cerah berawan sebagian" },
    2: { icon: "⛅", desc: "Berawan sebagian" },
    3: { icon: "☁️", desc: "Mendung" },
    45: { icon: "🌫️", desc: "Berkabut" },
    48: { icon: "🌫️", desc: "Kabut es" },
    51: { icon: "🌦️", desc: "Gerimis ringan" },
    53: { icon: "🌦️", desc: "Gerimis sedang" },
    55: { icon: "🌦️", desc: "Gerimis lebat" },
    61: { icon: "🌧️", desc: "Hujan ringan" },
    63: { icon: "🌧️", desc: "Hujan sedang" },
    65: { icon: "🌧️", desc: "Hujan lebat" },
    71: { icon: "🌨️", desc: "Salju ringan" },
    80: { icon: "🌧️", desc: "Hujan lokal ringan" },
    81: { icon: "🌧️", desc: "Hujan lokal sedang" },
    82: { icon: "⛈️", desc: "Hujan lokal lebat" },
    95: { icon: "⛈️", desc: "Badai petir" },
    96: { icon: "⛈️", desc: "Badai petir + hujan es" },
    99: { icon: "⛈️", desc: "Badai petir hebat" },
  };

  async function fetchWeather(coords) {
    const iconEl = document.getElementById("ovWeatherIcon");
    const tempEl = document.getElementById("ovWeatherTemp");
    const descEl = document.getElementById("ovWeatherDesc");

    // Fallback koordinat: Yogyakarta (basis Rafael), dipakai kalau
    // deteksi IP di atas gagal total — supaya kartu cuaca tetap
    // menampilkan sesuatu yang relevan alih-alih kosong.
    const lat = coords ? coords.lat : -7.801;
    const lon = coords ? coords.lon : 110.364;

    try {
      const url =
        "https://api.open-meteo.com/v1/forecast?latitude=" +
        lat +
        "&longitude=" +
        lon +
        "&current=temperature_2m,weather_code&timezone=auto";
      const res = await fetch(url);
      const data = await res.json().catch(() => null);

      if (data && data.current && typeof data.current.temperature_2m === "number") {
        const code = data.current.weather_code;
        const info = WEATHER_CODE_MAP[code] || { icon: "🌡️", desc: "Cuaca" };
        if (iconEl) iconEl.textContent = info.icon;
        if (tempEl) tempEl.textContent = Math.round(data.current.temperature_2m) + "°C";
        if (descEl) descEl.textContent = info.desc;
      } else {
        throw new Error("bad weather payload");
      }
    } catch {
      if (iconEl) iconEl.textContent = "—";
      if (tempEl) tempEl.textContent = "—";
      if (descEl) descEl.textContent = "Cuaca tidak tersedia";
    }
  }

  // ==============================================================
  // PROFILE PAGE
  // ------------------------------------------------------------
  // Lihat catatan panjang di header file ini ("SOAL HALAMAN PROFILE")
  // untuk kenapa halaman ini menampilkan SATU sesi akun tunggal, bukan
  // daftar banyak user. Data yang ditampilkan di sini:
  //   - Username : dari token JWT (via /verify), sama dengan yang tampil
  //     di chip topbar.
  //   - Waktu masuk : dicatat di klien saat login sukses (storeLoginTime
  //     di wireLoginForm), BUKAN dari server (Worker tidak menyimpan
  //     riwayat waktu login).
  //   - Sesi berakhir sekitar : Waktu masuk + TOKEN_LIFETIME_MS (24 jam,
  //     lihat README2.md bagian 5.1) — estimasi klien, validitas
  //     SEBENARNYA tetap ditentukan server tiap kali /verify dipanggil.
  // ==============================================================
  function refreshProfilePage(username) {
    setText("profileName", username || "—");
    setText("profileUsername", username || "—");

    const loginTime = getStoredLoginTime();
    if (loginTime) {
      setText("profileLoginTime", formatDateTimeId(new Date(loginTime)));
      setText("profileExpiry", formatDateTimeId(new Date(loginTime + TOKEN_LIFETIME_MS)) + " (estimasi)");
    } else {
      // Kasus ini terjadi saat AUTO-LOGIN dari sessionStorage yang
      // tersisa dari sesi sebelumnya, sebelum LOGIN_TIME_STORAGE_KEY
      // ada (mis. sesi lama sebelum fitur Profile ini ditambahkan) —
      // tampilkan keterangan jujur alih-alih tanggal palsu.
      setText("profileLoginTime", "Tidak tercatat (sesi berjalan sebelum fitur ini aktif)");
      setText("profileExpiry", "Tidak diketahui — coba login ulang untuk mengaktifkan pencatatan ini");
    }
  }

  function formatDateTimeId(date) {
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return (
      HARI_ID[date.getDay()] + ", " + date.getDate() + " " + BULAN_ID[date.getMonth()] + " " + date.getFullYear() + " " + hh + ":" + mm
    );
  }

  // ==============================================================
  // UNSAVED STATE TRACKING
  // ------------------------------------------------------------
  // Satu sumber kebenaran (body.has-unsaved-changes) dipakai oleh
  // BANYAK indikator visual sekaligus: titik kuning di topbar
  // (.unsaved-dot), enable/disable tombol Apply Changes & Revert di
  // topbar, dan tombol Simpan Perubahan di download-bar bawah — semua
  // ikut ter-toggle otomatis lewat CSS/JS begitu class ini berubah,
  // supaya tidak ada dua "tombol simpan" yang bisa beda status.
  // ==============================================================
  function markUnsaved() {
    document.body.classList.add("has-unsaved-changes");
    const applyBtn = document.getElementById("applyChangesBtn");
    const revertBtn = document.getElementById("revertBtn");
    const downloadBtn = document.getElementById("downloadBtn");
    if (applyBtn) applyBtn.disabled = false;
    if (revertBtn) revertBtn.disabled = false;
    if (downloadBtn) downloadBtn.disabled = false;
    setSaveStatus("", "");
  }

  function clearUnsavedState() {
    document.body.classList.remove("has-unsaved-changes");
    const applyBtn = document.getElementById("applyChangesBtn");
    const revertBtn = document.getElementById("revertBtn");
    const downloadBtn = document.getElementById("downloadBtn");
    if (applyBtn) applyBtn.disabled = true;
    if (revertBtn) revertBtn.disabled = true;
    if (downloadBtn) downloadBtn.disabled = true;
  }

  function setSaveStatus(text, state) {
    const topbarStatus = document.getElementById("topbarSaveStatus");
    if (topbarStatus) {
      topbarStatus.textContent = text;
      if (state) {
        topbarStatus.setAttribute("data-state", state);
      } else {
        topbarStatus.removeAttribute("data-state");
      }
    }
    const downloadStatus = document.getElementById("downloadStatus");
    if (downloadStatus) {
      downloadStatus.textContent = text;
      downloadStatus.classList.toggle("is-visible", Boolean(text));
    }
  }

  // ==============================================================
  // TOPBAR BUTTONS: Apply Changes / Revert (+ tombol Simpan Perubahan
  // di download-bar bawah, keduanya memanggil fungsi yang sama)
  // ==============================================================
  function wireTopbarButtons() {
    const applyBtn = document.getElementById("applyChangesBtn");
    const revertBtn = document.getElementById("revertBtn");
    const downloadBtn = document.getElementById("downloadBtn");

    if (applyBtn) applyBtn.addEventListener("click", saveAll);
    if (downloadBtn) downloadBtn.addEventListener("click", saveAll);
    if (revertBtn) revertBtn.addEventListener("click", revertAll);
  }

  async function saveAll() {
    if (isSaving) return;
    const token = getStoredToken();
    if (!token) {
      setSaveStatus("Sesi berakhir, silakan login ulang.", "error");
      doLogout();
      return;
    }

    isSaving = true;
    const applyBtn = document.getElementById("applyChangesBtn");
    const downloadBtn = document.getElementById("downloadBtn");
    setButtonLoading(applyBtn, true, "Menyimpan...");
    setButtonLoading(downloadBtn, true, "Menyimpan...");
    setSaveStatus("Menyimpan perubahan...", "saving");

    try {
      // PUT /content — selalu dikirim (teks selalu dianggap "milik"
      // draft yang sedang aktif, walau tidak setiap section berubah).
      const contentRes = await fetch(AUTH_API_BASE + "/content", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ content: draftContent }),
      });
      const contentData = await contentRes.json().catch(() => null);
      if (!contentRes.ok || !contentData || !contentData.success) {
        throw new Error((contentData && contentData.error) || "Gagal menyimpan teks (PUT /content).");
      }

      // PUT /photo — HANYA dikirim kalau ada foto baru dipilih di sesi
      // ini (draftPhotoDataUrl tidak null). Kalau tidak diganti, foto
      // lama di server dibiarkan apa adanya (tidak perlu re-upload).
      if (draftPhotoDataUrl) {
        const photoRes = await fetch(AUTH_API_BASE + "/photo", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token,
          },
          body: JSON.stringify({ dataUrl: draftPhotoDataUrl }),
        });
        const photoData = await photoRes.json().catch(() => null);
        if (!photoRes.ok || !photoData || !photoData.success) {
          throw new Error((photoData && photoData.error) || "Gagal menyimpan foto (PUT /photo).");
        }
        currentPhotoDataUrl = draftPhotoDataUrl;
        draftPhotoDataUrl = null;
      }

      // PUT /products — selalu dikirim juga (sama alasannya dengan
      // /content: draftProducts adalah satu-satunya sumber kebenaran
      // untuk katalog yang sedang diedit).
      const productsRes = await fetch(AUTH_API_BASE + "/products", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ products: draftProducts }),
      });
      const productsData = await productsRes.json().catch(() => null);
      if (!productsRes.ok || !productsData || !productsData.success) {
        throw new Error((productsData && productsData.error) || "Gagal menyimpan produk (PUT /products).");
      }

      clearUnsavedState();
      refreshFotoPreview();
      setSaveStatus("Tersimpan — situs live sudah diperbarui.", "saved");
      window.setTimeout(() => setSaveStatus("", ""), 4000);
    } catch (err) {
      setSaveStatus(err.message || "Gagal menyimpan. Coba lagi.", "error");
    } finally {
      isSaving = false;
      setButtonLoading(applyBtn, false);
      setButtonLoading(downloadBtn, false);
      // has-unsaved-changes bisa saja masih true kalau ada error di
      // atas (mis. /products gagal setelah /content sukses) — pastikan
      // tombol tetap aktif untuk dicoba lagi, bukan ikut ke-disable
      // oleh clearUnsavedState() yang gagal terpanggil.
      if (document.body.classList.contains("has-unsaved-changes")) {
        if (applyBtn) applyBtn.disabled = false;
        const revertBtn = document.getElementById("revertBtn");
        if (revertBtn) revertBtn.disabled = false;
        if (downloadBtn) downloadBtn.disabled = false;
      }
    }
  }

  async function revertAll() {
    const hasUnsaved = document.body.classList.contains("has-unsaved-changes");
    if (hasUnsaved) {
      const ok = confirm("Buang semua perubahan yang belum disimpan dan ambil ulang versi terakhir dari server?");
      if (!ok) return;
    }

    const revertBtn = document.getElementById("revertBtn");
    setButtonLoading(revertBtn, true, "Mengambil ulang...");
    setSaveStatus("Mengambil ulang dari server...", "saving");

    try {
      await loadDraftFromServer();
      buildFormFromContent(draftContent);
      refreshFotoPreview();
      renderProductsSection();
      clearUnsavedState();
      setSaveStatus("Draft direset ke versi tersimpan terakhir.", "saved");
      window.setTimeout(() => setSaveStatus("", ""), 3500);
    } catch {
      setSaveStatus("Gagal mengambil ulang data dari server.", "error");
    } finally {
      setButtonLoading(revertBtn, false);
    }
  }
})();
