/* ==========================================================================
   Rafael L3 — Dashboard Admin
   admin.js — logika login, form editor otomatis, dan simpan-instan ke
   Cloudflare Worker (KV) — TIDAK LAGI unduh-manual.

   CATATAN PENTING SOAL CARA KERJA DASHBOARD INI (baca sebelum ubah kode):

   Situs portofolio ini di-hosting di GitHub Pages (hosting statis), tapi
   TEKS, FOTO, dan PRODUK tidak lagi disimpan sebagai file statis yang
   perlu commit — ketiganya disimpan di Cloudflare KV lewat Worker yang
   sama dengan yang menangani login (lihat AUTH_API_BASE di bawah, dan
   worker/src/index.js untuk source Worker-nya). Alurnya sekarang:

     1. Kamu login (POST /login -> Worker mengecek lalu membalas token
        JWT, sama seperti sebelumnya).
     2. Begitu login sukses, dashboard mengambil DRAFT AWAL dari
        GET /content, GET /photo, DAN GET /products (bukan lagi langsung
        memakai CONTENT/PRODUCTS bawaan) — supaya kamu selalu mulai
        mengedit dari versi yang SEDANG LIVE di situs, bukan dari
        fallback statis yang bisa saja sudah usang. Kalau GET /content
        mengembalikan `content: null` (KV memang belum pernah diisi sama
        sekali), draft awal baru jatuh balik ke CONTENT bawaan — untuk
        produk, GET /products mengembalikan array KOSONG kalau memang
        belum ada produk (bukan sinyal fallback, katalog kosong itu valid).
     3. Dashboard menampilkan draft itu sebagai form, dikelompokkan
        persis seperti struktur section di content.js, ditambah satu
        section khusus Foto (lihat wireFotoField()) dan satu section
        khusus Katalog Produk (lihat wireProductsSection()).
     4. Setiap kali kamu ubah field/produk, ada live preview jadi kamu
        bisa lihat hasilnya sebelum yakin, dan status "ada perubahan
        belum disimpan" muncul di topbar.
     5. Klik "Simpan Perubahan" (bar bawah) ATAU "Apply Changes" (pojok
        kanan atas, keduanya memanggil fungsi yang sama) -> dashboard
        mengirim PUT /content, PUT /photo (kalau kamu ganti foto), dan
        PUT /products (kalau ada perubahan produk) ke Worker. Begitu
        berhasil, KV langsung ter-update. Lain kali situs utama/shop
        (atau tab dashboard lain) di-refresh, GET /content|/photo|/products
        otomatis mengembalikan versi baru ini — TIDAK ADA proses
        build/commit/push sama sekali, dan TIDAK ADA file yang perlu
        diunduh manual.
     6. Kalau berubah pikiran sebelum sempat Simpan, klik "Revert" — ini
        MEMBUANG seluruh draft yang sedang diedit (teks, foto, DAN
        produk) dan mengambil ulang versi tersimpan terakhir dari server,
        seperti "undo semua" ke titik terakhir kali disimpan.

   Kenapa masih ada CONTENT statis di content.js? Itu sekarang murni
   FALLBACK/DEFAULT — dipakai kalau KV benar-benar belum pernah diisi,
   atau kalau Worker sedang tidak bisa dihubungi saat dashboard dibuka.
   Lihat komentar di assets/js/content.js untuk detail lengkapnya. Pola
   yang sama berlaku untuk PRODUCTS di shop-content.js.
   ========================================================================== */

(function () {
  "use strict";

  // ------------------------------------------------------------
  // KONFIGURASI
  // ------------------------------------------------------------
  // URL Cloudflare Worker yang menangani /login, /verify, /content,
  // dan /photo. HARUS SAMA dengan RL3_AUTH_API_BASE di content.js —
  // kalau alamat Worker berubah, ganti di DUA tempat itu (tidak ada
  // tempat ketiga).
  const AUTH_API_BASE = "https://dashboard-key.ffkz946.workers.dev";

  // Key sessionStorage tempat token JWT disimpan. Sengaja pakai
  // sessionStorage (bukan localStorage) supaya token OTOMATIS hilang
  // begitu tab/browser ditutup — dashboard admin tidak "nempel" permanen
  // di browser yang dipakai bersama atau di komputer publik.
  const TOKEN_STORAGE_KEY = "rl3_admin_token";

  // Berapa lama animasi fade login -> dashboard (ms). HARUS SAMA dengan
  // --admin-transition-duration di admin.css — kalau salah satu diubah,
  // ubah juga yang satunya, supaya class is-transitioning-out/in dilepas
  // JS tepat saat animasi CSS-nya selesai (tidak lebih cepat/lambat).
  const ADMIN_TRANSITION_MS = 420;

  // ------------------------------------------------------------
  // STATE
  // ------------------------------------------------------------
  // draftContent = salinan kerja dari teks yang sedang diedit di form.
  // Diisi dari GET /content (atau fallback CONTENT bawaan) saat login,
  // dan direset ulang dari server lagi tiap kali tombol Revert ditekan.
  let draftContent = null;

  // draftPhotoDataUrl = foto BARU yang dipilih user lewat input file
  // (base64 data URL), belum tentu sudah disimpan ke server. null berarti
  // user belum memilih foto baru sama sekali di sesi edit ini (foto yang
  // sedang live TIDAK berubah kalau field ini null saat Simpan ditekan
  // — lihat saveAll(), PUT /photo cuma dipanggil kalau field ini terisi).
  let draftPhotoDataUrl = null;

  // currentPhotoDataUrl = foto yang SEDANG tersimpan di server (hasil
  // GET /photo), dipakai buat preview awal & buat Revert kembali ke sini.
  let currentPhotoDataUrl = null;

  // isSaving = flag guard supaya tombol Simpan/Apply Changes tidak bisa
  // dipencet dobel (klik ganda / klik saat request sebelumnya belum
  // selesai) yang bisa memicu dua PUT /content beriringan.
  let isSaving = false;

  // draftProducts = salinan kerja array produk katalog shop yang sedang
  // diedit (tambah/hapus/ubah field). Diisi dari GET /products saat
  // login, dan direset ulang dari server tiap kali Revert ditekan — pola
  // identik draftContent, tapi array (bukan object), dan TIDAK ada
  // "currentProducts" terpisah (beda dengan foto) karena tidak ada
  // konsep "belum tentu terkirim, tunggu tombol Simpan" untuk field
  // gambar per-produk — begitu file dipilih, langsung jadi bagian
  // draftProducts (base64-nya), sama seperti field teks primitif lain.
  let draftProducts = [];

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

    const existingToken = getStoredToken();
    if (existingToken) {
      // Ada token tersimpan dari sesi sebelumnya — cek dulu ke worker
      // apakah masih valid sebelum langsung buka dashboard. Token bisa
      // sudah kedaluwarsa (umur 24 jam) atau di-tolak worker karena
      // alasan lain, jadi jangan asal percaya isi sessionStorage.
      //
      // Jalur ini (auto-login saat refresh halaman) SENGAJA tidak pakai
      // animasi fade seperti transitionToDashboard() di bawah — animasi
      // itu cocok sebagai respons atas klik "Masuk", tapi terasa aneh
      // kalau muncul begitu saja saat halaman baru selesai dimuat.
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
    const btn = document.getElementById("logoutBtn");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const hasUnsaved = document.body.classList.contains("has-unsaved-changes");
      if (hasUnsaved) {
        const ok = confirm(
          "Ada perubahan yang belum disimpan. Yakin mau keluar? Perubahan itu akan hilang (situs live TIDAK berubah karena belum sempat di-Apply Changes)."
        );
        if (!ok) return;
      }
      clearStoredToken();
      draftContent = null;
      draftPhotoDataUrl = null;
      currentPhotoDataUrl = null;
      draftProducts = [];
      document.body.classList.remove("has-unsaved-changes");
      showLoginScreen();
    });
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
      // Kalau /verify gagal karena network, jangan langsung anggap token
      // invalid dan tendang user keluar — anggap saja verifikasi gagal
      // dan biarkan login screen tampil lagi supaya user bisa coba ulang.
      return { valid: false };
    }
  }

  function getStoredToken() {
    try {
      return sessionStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      // Sebagian browser (mode private ketat / storage diblokir) bisa
      // melempar error saat mengakses sessionStorage.
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
  }

  // Ambil draft AWAL dari server: GET /content (teks) + GET /photo
  // (foto), lalu isi draftContent/currentPhotoDataUrl dari hasilnya.
  // Kalau /content mengembalikan content: null (KV belum pernah diisi
  // sama sekali), jatuh balik ke CONTENT bawaan content.js. Dipisah jadi
  // fungsi sendiri supaya bisa dipakai ulang oleh enterDashboard() DAN
  // revertChanges() (revert = "ambil ulang draft dari server", persis
  // proses yang sama dengan saat pertama masuk dashboard).
  //
  // PENTING soal CONTENT sebagai bare identifier: sama seperti
  // penjelasan sebelumnya, CONTENT diakses langsung (bukan
  // window.CONTENT) karena content.js mendeklarasikannya dengan
  // top-level `const` di dalam <script> classic, bukan type="module".
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

    // draftPhotoDataUrl direset setiap kali draft diambil ulang dari
    // server (masuk dashboard pertama kali, atau setelah Revert) — draft
    // foto yang belum disimpan memang seharusnya tidak "menempel" lewat
    // proses ini.
    draftPhotoDataUrl = null;

    // Produk: GET /products membalas array KOSONG kalau memang belum ada
    // produk sama sekali (bukan sinyal error/fallback, lihat catatan di
    // worker/src/index.js) — jadi array kosong dari server DIPAKAI apa
    // adanya, TIDAK ditimpa fallback PRODUCTS. Fallback hanya dipakai
    // kalau request-nya sendiri gagal total (network/parse error).
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
  // TANPA animasi fade, karena bukan respons langsung atas klik user.
  async function enterDashboard(username) {
    await loadDraftFromServer();

    document.getElementById("loginScreen").hidden = true;
    document.getElementById("dashboardScreen").hidden = false;
    document.body.classList.add("is-dashboard");

    const whoEl = document.getElementById("loggedInAs");
    if (whoEl) whoEl.textContent = username || "";

    buildFormFromContent(draftContent);
    refreshFotoPreview();
    renderProductsSection();
    clearUnsavedState();
  }

  // Dipakai SETELAH submit form login sukses — dengan animasi fade out
  // (login-screen) lalu fade in (dashboard-screen), sesuai durasi
  // ADMIN_TRANSITION_MS (harus sinkron dengan --admin-transition-duration
  // di admin.css). Fetch draft dari server (loadDraftFromServer) sengaja
  // dijalankan BERSAMAAN dengan fade out (Promise.all), bukan berurutan
  // setelahnya — supaya total waktu tunggu user tidak jadi
  // "fade out selesai, BARU mulai nunggu fetch", melainkan dua proses ini
  // tumpang tindih dan dashboard baru fade in begitu KEDUANYA selesai.
  async function transitionToDashboard(username) {
    document.body.classList.add("is-transitioning-out");

    await Promise.all([wait(ADMIN_TRANSITION_MS), loadDraftFromServer()]);

    document.getElementById("loginScreen").hidden = true;
    document.getElementById("dashboardScreen").hidden = false;
    document.body.classList.remove("is-transitioning-out");

    const whoEl = document.getElementById("loggedInAs");
    if (whoEl) whoEl.textContent = username || "";

    buildFormFromContent(draftContent);
    refreshFotoPreview();
    renderProductsSection();
    clearUnsavedState();

    // Trigger reflow supaya browser "melihat" #dashboardScreen dalam
    // keadaan opacity:0 (dari CSS `#dashboardScreen { opacity: 0; }`)
    // SEBELUM class is-transitioning-in ditambah pada frame berikutnya
    // — tanpa ini, browser bisa saja menggabungkan kedua perubahan
    // style jadi satu batch dan transition opacity tidak sempat
    // ter-animasi sama sekali (dashboard langsung muncul instan, tanpa
    // fade in yang diminta).
    document.getElementById("dashboardScreen").offsetHeight;

    document.body.classList.add("is-transitioning-in");
    await wait(ADMIN_TRANSITION_MS);
    document.body.classList.remove("is-transitioning-in");
    document.body.classList.add("is-dashboard");
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ==============================================================
  // FORM GENERATOR
  // ------------------------------------------------------------
  // Membaca struktur draftContent (hasil clone dari CONTENT di
  // content.js) dan otomatis bikin section + field form untuk tiap
  // bagian. Ini supaya kalau suatu saat field baru ditambah di
  // content.js, dashboard TIDAK perlu diedit manual satu-satu — form
  // baru otomatis muncul (walau labelnya masih generik, lihat
  // humanizeKey()).
  // ==============================================================

  // Label section yang lebih manusiawi + urutan tampil. Section yang
  // tidak ada di daftar ini tetap dirender (fallback ke humanizeKey),
  // cuma taruh di akhir.
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

  // Field yang isinya HTML (ada tag <strong>, <br>, dst) — dirender
  // sebagai textarea dengan catatan supaya tag-nya tidak dihapus tanpa
  // sadar, alih-alih <input> teks satu baris biasa.
  const HTML_FIELDS = new Set(["skill.desc"]);

  // Field yang secara semantik multi-baris walau tidak mengandung HTML
  // (deskripsi panjang) — tetap pakai textarea supaya nyaman diedit.
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

    buildNav(orderedKeys);
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

  // path = array of keys/indices dari root draftContent sampai ke value
  // ini, contoh: ["hero", "meta", "location"] atau ["karya", "releases", 2, "title"]
  function renderFieldsInto(parentEl, value, path) {
    if (Array.isArray(value)) {
      renderArrayField(parentEl, value, path);
      return;
    }

    if (value !== null && typeof value === "object") {
      Object.keys(value).forEach((key) => {
        const childPath = path.concat(key);
        const childValue = value[key];

        if (
          (childValue !== null && typeof childValue === "object")
        ) {
          // Nested object/array -> subgroup dengan label, supaya
          // strukturnya kelihatan (mis. hero.panel.navItems).
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

    // value primitif di root path (jarang terjadi di struktur ini, tapi
    // dijaga untuk kelengkapan)
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
        // array of primitives (contoh: logoBar.items, hero.panel.navItems)
        renderPrimitiveField(wrap, item, itemPath, String(index), true);
      }
    });
  }

  function describeArrayItem(item, index) {
    // Coba cari field yang paling representatif untuk dijadikan label
    // kartu (misalnya "title" pada rilisan karya, "label" pada tools).
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

  // Ubah camelCase / snake-ish key jadi label yang gampang dibaca,
  // mis. "pageTitle" -> "Page Title", "btnAccent" -> "Btn Accent".
  function humanizeKey(key) {
    const withSpaces = String(key)
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ");
    return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
  }

  // ==============================================================
  // SIDEBAR NAV (loncat antar section)
  // ==============================================================
  function buildNav(orderedKeys) {
    const nav = document.getElementById("formNav");
    nav.innerHTML = "";

    // Link "Foto" ditambah manual di awal — section-nya statis di HTML
    // (admin/index.html), bukan hasil generate dari orderedKeys (yang
    // berasal dari struktur content, sedangkan foto disimpan terpisah).
    const fotoLink = document.createElement("a");
    fotoLink.href = "#section-foto";
    fotoLink.className = "form-nav-link";
    fotoLink.textContent = "Foto (Avatar Chat)";
    fotoLink.addEventListener("click", (e) => {
      e.preventDefault();
      const target = document.getElementById("section-foto");
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    nav.appendChild(fotoLink);

    // Link "Katalog Produk" — sama alasannya dengan link Foto di atas:
    // section-nya statis di HTML (#section-produk), bukan hasil generate
    // dari orderedKeys, karena produk disimpan terpisah dari content.js.
    const produkLink = document.createElement("a");
    produkLink.href = "#section-produk";
    produkLink.className = "form-nav-link";
    produkLink.textContent = "Katalog Produk (Shop)";
    produkLink.addEventListener("click", (e) => {
      e.preventDefault();
      const target = document.getElementById("section-produk");
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    nav.appendChild(produkLink);

    orderedKeys.forEach((key) => {
      const link = document.createElement("a");
      link.href = "#section-" + key;
      link.className = "form-nav-link";
      link.textContent = SECTION_LABELS[key] || humanizeKey(key);
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const target = document.getElementById("section-" + key);
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      nav.appendChild(link);
    });
  }

  // ==============================================================
  // FIELD FOTO (avatar chat widget)
  // ------------------------------------------------------------
  // Terpisah dari form generator otomatis (foto bukan bagian dari
  // content.js) — cukup diambil dari base64 file yang dipilih user
  // lewat <input type="file">, lalu disimpan ke draftPhotoDataUrl.
  // Belum dikirim ke server sampai saveAll() dipanggil (tombol
  // Simpan/Apply Changes).
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

      // Validasi kasar di sisi client (Worker tetap validasi ulang di
      // PUT /photo — ini cuma supaya user dapat feedback instan tanpa
      // perlu menunggu roundtrip network dulu).
      if (!file.type.startsWith("image/")) {
        alert("File yang dipilih bukan gambar. Pilih file PNG/JPG/WEBP/GIF.");
        input.value = "";
        return;
      }
      const MAX_FILE_BYTES = 1.6 * 1024 * 1024; // ~1.6MB file asli -> ~2.2MB base64
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

  // Update <img> pratinjau foto: prioritaskan draftPhotoDataUrl (foto
  // baru yang baru dipilih, belum disimpan), lalu currentPhotoDataUrl
  // (foto yang sedang live di server), lalu fallback ke foto default
  // repo (assets/img/stickers.jpg) kalau keduanya kosong (KV belum
  // pernah diisi foto sama sekali).
  function refreshFotoPreview() {
    const img = document.getElementById("fotoAvatarPreview");
    if (!img) return;
    img.src = draftPhotoDataUrl || currentPhotoDataUrl || "../assets/img/stickers.jpg";

    const filenameEl = document.getElementById("fotoAvatarFilename");
    if (filenameEl && !draftPhotoDataUrl) {
      filenameEl.textContent = currentPhotoDataUrl
        ? "Pakai foto yang sedang tersimpan di server"
        : "Belum ada foto baru dipilih";
    }
  }

  // ==============================================================
  // KATALOG PRODUK (shop) — tambah, edit field, hapus
  // ------------------------------------------------------------
  // Terpisah dari form generator otomatis (produk bukan bagian dari
  // content.js, disimpan di KV key "products" sendiri — lihat
  // worker/src/index.js). Field nama & harga murni draft lokal (baru
  // terkirim ke server saat klik Simpan/Apply Changes, sama seperti
  // field teks lain) — TAPI field gambar BEDA: begitu file dipilih,
  // langsung diupload ke R2 lewat POST /product-image (lihat
  // uploadProductImage() di bawah), bukan ditunda sampai Simpan.
  //
  // Kenapa gambar diupload langsung (tidak ditunda)? Karena file gambar
  // itu besar (bisa sampai beberapa MB) — kalau ditunda dan disimpan di
  // memory sebagai base64 dulu (pola lama), draft jadi berat & lambat
  // kalau ada banyak produk. Dengan upload langsung, yang disimpan di
  // draftProducts cuma imageUrl (string pendek), draft tetap ringan
  // berapa pun banyak produknya.
  //
  // KONSEKUENSI dari pola ini: kalau kamu upload foto baru untuk suatu
  // produk lalu klik "Revert" SEBELUM sempat klik Simpan, file yang
  // sudah terlanjur terupload ke R2 akan jadi FILE YATIM (tidak dipakai
  // produk mana pun) — worker/src/index.js tidak melakukan pembersihan
  // otomatis untuk kasus ini karena Worker tidak tahu draft mana yang
  // "dibatalkan". Ini trade-off yang wajar (file yatim sesekali tidak
  // masalah, dan tidak menambah kerumitan cleanup otomatis), TAPI setiap
  // penggantian/penghapusan foto yang TERJADI (bukan dibatalkan) selalu
  // diikuti pemanggilan DELETE /product-image untuk foto LAMA-nya (lihat
  // removeImgBtn & removeBtn di bawah) — supaya file R2 TIDAK menumpuk
  // dalam pemakaian normal sehari-hari.
  // ==============================================================
  const MAX_PRODUCT_IMAGE_FILE_BYTES = 5 * 1024 * 1024; // 5MB — samakan dengan MAX_PRODUCT_IMAGE_FILE_BYTES di worker/src/index.js

  // Upload satu file gambar ke R2 lewat POST /product-image. Balas
  // string imageUrl kalau berhasil, atau melempar Error dengan pesan
  // yang sudah cocok ditampilkan langsung ke user (lewat alert) kalau
  // gagal.
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

  // Hapus satu file gambar produk dari R2 lewat DELETE /product-image.
  // SENGAJA tidak melempar error kalau gagal (cuma dicatat ke console) —
  // kegagalan hapus file lama TIDAK boleh menghalangi alur utama (ganti/
  // hapus produk tetap harus jalan di sisi UI walau pembersihan R2-nya
  // gagal; file yatim yang tersisa lebih baik daripada UI yang macet).
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
        // Fokus ke field nama produk yang baru saja ditambah, supaya
        // user bisa langsung ketik tanpa perlu klik dulu — produk baru
        // selalu ditambah di akhir daftar (lihat renderProductsSection).
        const list = document.getElementById("productList");
        const lastNameInput = list && list.querySelector(".product-item-card:last-child .field-input");
        if (lastNameInput) lastNameInput.focus();
      });
    }
  }

  // Id unik sederhana untuk produk baru — cukup untuk membedakan item di
  // dalam satu array (dipakai key hapus/edit), bukan untuk keperluan
  // keamanan apa pun. crypto.randomUUID tersedia di semua browser modern
  // yang juga mendukung fitch/fetch dkk yang sudah dipakai dashboard ini,
  // tapi tetap disediakan fallback sederhana untuk jaga-jaga.
  function generateProductId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return "produk-" + Date.now() + "-" + Math.random().toString(16).slice(2, 8);
  }

  // Bangun ulang SELURUH daftar kartu produk dari draftProducts. Dipanggil
  // tiap kali draftProducts berubah bentuk (tambah/hapus item) — untuk
  // edit field dalam SATU produk yang sudah ada, event listener input
  // langsung menulis ke draftProducts tanpa perlu render ulang seluruh
  // daftar (supaya fokus/kursor input tidak "lompat" tiap ketik satu
  // huruf), lihat renderProductCard() di bawah.
  function renderProductsSection() {
    const list = document.getElementById("productList");
    if (!list) return;
    list.innerHTML = "";

    if (draftProducts.length === 0) {
      const empty = document.createElement("p");
      empty.className = "field-note";
      empty.textContent = "Belum ada produk. Klik \"+ Tambah Produk\" di bawah untuk menambah produk pertama.";
      list.appendChild(empty);
    } else {
      draftProducts.forEach((product, index) => {
        list.appendChild(renderProductCard(product, index));
      });
    }

    refreshPreview();
  }

  function renderProductCard(product, index) {
    const card = document.createElement("div");
    card.className = "array-item-card product-item-card";

    const header = document.createElement("div");
    header.className = "product-item-header";

    const label = document.createElement("div");
    label.className = "array-item-label";
    label.textContent = "#" + (index + 1) + (product.name ? " — " + product.name : " — (belum ada nama)");
    header.appendChild(label);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn-remove-product";
    removeBtn.title = "Hapus produk ini";
    removeBtn.setAttribute("aria-label", "Hapus produk ini");
    removeBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"></path></svg> Hapus';
    removeBtn.addEventListener("click", () => {
      const hasContent = product.name.trim() || product.price > 0 || product.imageUrl;
      if (hasContent && !confirm("Hapus produk \"" + (product.name || "(tanpa nama)") + "\" dari katalog? Perubahan ini baru permanen setelah kamu klik Simpan/Apply Changes.")) {
        return;
      }
      // Hapus juga file gambarnya dari R2 kalau ada, supaya tidak
      // menumpuk jadi sampah (lihat deleteProductImage()) — dijalankan
      // "fire and forget" (tidak di-await di sini), UI tetap responsif
      // langsung menghapus kartu produk dari daftar tanpa menunggu
      // konfirmasi network dulu.
      if (product.imageUrl) {
        deleteProductImage(product.imageUrl);
      }
      draftProducts = draftProducts.filter((p) => p.id !== product.id);
      markUnsaved();
      renderProductsSection();
    });
    header.appendChild(removeBtn);

    card.appendChild(header);

    // ---- Field: gambar produk ----
    const imgField = document.createElement("div");
    imgField.className = "field";
    const imgLabel = document.createElement("label");
    imgLabel.className = "field-label";
    imgLabel.textContent = "Foto produk";
    imgField.appendChild(imgLabel);

    const imgWrap = document.createElement("div");
    imgWrap.className = "field-image field-image-square";

    const imgPreview = document.createElement("img");
    imgPreview.className = "field-image-preview field-image-preview-square";
    imgPreview.alt = "Pratinjau foto produk";
    imgPreview.src = product.imageUrl || "";
    imgPreview.style.display = product.imageUrl ? "" : "none";

    const imgPlaceholder = document.createElement("div");
    imgPlaceholder.className = "field-image-placeholder";
    imgPlaceholder.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 7h18l-1.5 12.5a2 2 0 01-2 1.5H6.5a2 2 0 01-2-1.5L3 7z"/><path d="M8 7V5a4 4 0 018 0v2"/></svg>';
    imgPlaceholder.style.display = product.imageUrl ? "none" : "flex";

    imgWrap.appendChild(imgPreview);
    imgWrap.appendChild(imgPlaceholder);

    const imgControls = document.createElement("div");
    imgControls.className = "field-image-controls";

    const imgPickBtn = document.createElement("button");
    imgPickBtn.type = "button";
    imgPickBtn.className = "btn btn-outline";
    imgPickBtn.textContent = "Pilih Foto...";

    const imgFilename = document.createElement("span");
    imgFilename.className = "field-image-filename";
    imgFilename.textContent = product.imageUrl ? "Foto sudah diupload" : "Belum ada foto";

    const imgInput = document.createElement("input");
    imgInput.type = "file";
    imgInput.accept = "image/png,image/jpeg,image/webp,image/gif";
    imgInput.className = "field-image-input";

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

      // Nonaktifkan tombol pilih foto + tampilkan status "Mengupload..."
      // selama request berlangsung, supaya jelas ini butuh waktu (upload
      // beberapa MB tidak instan seperti FileReader base64 lokal dulu)
      // dan mencegah user memilih file lain di tengah upload yang sedang
      // berjalan.
      imgPickBtn.disabled = true;
      imgFilename.textContent = "Mengupload...";

      uploadProductImage(file)
        .then((imageUrl) => {
          product.imageUrl = imageUrl;
          markUnsaved();
          renderProductsSection();
          // Foto LAMA (kalau ada) sudah tidak dipakai produk ini lagi
          // setelah diganti foto baru -> hapus dari R2 supaya tidak
          // menumpuk. Dijalankan setelah render supaya UI (yang sudah
          // menampilkan foto baru) tidak menunggu proses cleanup ini.
          if (oldImageUrl) {
            deleteProductImage(oldImageUrl);
          }
        })
        .catch((err) => {
          alert(err.message || "Gagal mengupload gambar. Coba lagi.");
          imgPickBtn.disabled = false;
          imgFilename.textContent = product.imageUrl ? "Foto sudah diupload" : "Belum ada foto";
        })
        .finally(() => {
          imgInput.value = "";
        });
    });

    imgControls.appendChild(imgPickBtn);
    imgControls.appendChild(imgFilename);
    imgControls.appendChild(imgInput);

    if (product.imageUrl) {
      const removeImgBtn = document.createElement("button");
      removeImgBtn.type = "button";
      removeImgBtn.className = "btn-remove-product-image";
      removeImgBtn.textContent = "Hapus foto ini";
      removeImgBtn.addEventListener("click", () => {
        const oldImageUrl = product.imageUrl;
        product.imageUrl = null;
        markUnsaved();
        renderProductsSection();
        deleteProductImage(oldImageUrl);
      });
      imgControls.appendChild(removeImgBtn);
    }

    imgWrap.appendChild(imgControls);
    imgField.appendChild(imgWrap);
    card.appendChild(imgField);

    // ---- Field: nama produk ----
    const nameField = document.createElement("div");
    nameField.className = "field";
    const nameLabel = document.createElement("label");
    nameLabel.className = "field-label";
    nameLabel.textContent = "Nama produk";
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "field-input";
    nameInput.value = product.name;
    nameInput.placeholder = "Misal: Sample Pack — Prawirotaman Nights Vol. 1";
    nameInput.addEventListener("input", () => {
      product.name = nameInput.value;
      label.textContent = "#" + (index + 1) + (product.name ? " — " + product.name : " — (belum ada nama)");
      markUnsaved();
      refreshPreview();
    });
    nameField.appendChild(nameLabel);
    nameField.appendChild(nameInput);
    card.appendChild(nameField);

    // ---- Field: harga produk ----
    const priceField = document.createElement("div");
    priceField.className = "field";
    const priceLabel = document.createElement("label");
    priceLabel.className = "field-label";
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
  // Preview ringan yang menampilkan beberapa field paling terlihat
  // (bukan render ulang seluruh halaman index.html — itu di luar
  // cakupan dashboard ini, dan menduplikasi seluruh main.js di sini
  // hanya akan menambah risiko preview "beda" dari situs aslinya).
  // Preview ini membantu memastikan field terisi seperti yang
  // dimaksud sebelum di-download.
  // ==============================================================
  function refreshPreview() {
    const c = draftContent;
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

    const productsList = document.getElementById("previewProducts");
    if (productsList) {
      productsList.innerHTML = "";
      if (draftProducts.length === 0) {
        const empty = document.createElement("p");
        empty.className = "field-note";
        empty.style.margin = "0";
        empty.textContent = "Katalog masih kosong.";
        productsList.appendChild(empty);
      } else {
        draftProducts.forEach((p) => {
          const row = document.createElement("div");
          row.className = "preview-product-row";
          const thumbHTML = p.imageUrl
            ? '<img src="' + p.imageUrl + '" alt="" class="preview-product-thumb" />'
            : '<span class="preview-product-thumb preview-product-thumb-empty"></span>';
          row.innerHTML =
            thumbHTML +
            '<span class="preview-product-name">' + escapeHtml(p.name || "(belum ada nama)") + "</span>" +
            '<span class="preview-product-price">Rp' + (Number(p.price) || 0).toLocaleString("id-ID") + "</span>";
          productsList.appendChild(row);
        });
      }
    }
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
  // SIMPAN — PUT /content (+ PUT /photo kalau ada foto baru, + PUT
  // /products kalau ada perubahan produk)
  // ------------------------------------------------------------
  // Ini pengganti alur "unduh content.js lalu upload manual" yang lama.
  // Dipanggil oleh DUA tombol yang perilakunya identik: tombol "Simpan
  // Perubahan" di bar bawah, dan "Apply Changes" di topbar kanan atas —
  // user secara eksplisit minta keduanya ada, jadi keduanya disediakan,
  // tapi tidak ada gunanya duplikasi logika, jadi keduanya memanggil
  // saveAll() yang sama persis.
  //
  // PUT /products SELALU dipanggil (bukan cuma kalau ada perubahan
  // spesifik) — beda dengan /photo yang cuma dikirim kalau
  // draftPhotoDataUrl terisi. Alasannya: field gambar produk sudah
  // TERKIRIM ke R2 duluan (lihat uploadProductImage(), dipanggil saat
  // file dipilih, bukan saat Simpan), jadi tidak ada cara murah untuk
  // tahu "apakah draftProducts benar-benar berubah dari currentProducts
  // di server" tanpa nge-diff seluruh array — lebih sederhana & aman
  // untuk selalu kirim ulang draftProducts LENGKAP setiap Simpan, sama
  // seperti /content.
  // ==============================================================
  function wireSaveButtons() {
    const bottomBtn = document.getElementById("downloadBtn");
    if (bottomBtn) bottomBtn.addEventListener("click", saveAll);
    // applyChangesBtn di-wire di wireTopbarButtons() (bersama revertBtn),
    // memanggil saveAll() yang sama.
  }

  async function saveAll() {
    if (isSaving) return; // guard klik dobel
    isSaving = true;

    const bottomBtn = document.getElementById("downloadBtn");
    const applyBtn = document.getElementById("applyChangesBtn");
    const revertBtn = document.getElementById("revertBtn");
    const status = document.getElementById("downloadStatus");

    setButtonLoading(bottomBtn, true, "Menyimpan...");
    if (applyBtn) applyBtn.disabled = true;
    if (revertBtn) revertBtn.disabled = true;
    setTopbarSaveStatus("saving", "Menyimpan...");

    try {
      const token = getStoredToken();
      if (!token) {
        throw new Error("Sesi login sudah berakhir. Silakan login ulang lalu coba simpan kembali.");
      }

      const contentRes = await fetch(AUTH_API_BASE + "/content", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify(draftContent),
      });
      const contentData = await contentRes.json().catch(() => null);
      if (!contentRes.ok || !contentData || !contentData.success) {
        throw new Error((contentData && contentData.error) || "Gagal menyimpan teks ke server.");
      }

      // Foto cuma dikirim kalau user benar-benar memilih foto baru di
      // sesi edit ini (draftPhotoDataUrl terisi) — kalau tidak, foto yang
      // sedang live di server dibiarkan apa adanya, TIDAK ditimpa dengan
      // apa pun (mis. tidak "direset" ke fallback bawaan).
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
          throw new Error((photoData && photoData.error) || "Gagal menyimpan foto ke server.");
        }
        currentPhotoDataUrl = draftPhotoDataUrl;
        draftPhotoDataUrl = null;
      }

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
        throw new Error((productsData && productsData.error) || "Gagal menyimpan katalog produk ke server.");
      }

      clearUnsavedState();
      setTopbarSaveStatus("saved", "Tersimpan");

      if (status) {
        status.textContent =
          "Tersimpan. Situs live sudah menampilkan perubahan ini (refresh tab situs untuk melihatnya).";
        status.classList.add("is-visible");
        window.clearTimeout(status._hideTimer);
        status._hideTimer = window.setTimeout(() => {
          status.classList.remove("is-visible");
        }, 8000);
      }
    } catch (err) {
      setTopbarSaveStatus("error", "Gagal menyimpan");
      if (status) {
        status.textContent =
          "Gagal menyimpan: " + (err && err.message ? err.message : String(err));
        status.classList.add("is-visible");
        window.clearTimeout(status._hideTimer);
        status._hideTimer = window.setTimeout(() => {
          status.classList.remove("is-visible");
        }, 8000);
      }
    } finally {
      isSaving = false;
      setButtonLoading(bottomBtn, false);
      if (applyBtn) applyBtn.disabled = false;
      if (revertBtn) revertBtn.disabled = false;
    }
  }

  // ==============================================================
  // TOPBAR: Apply Changes / Revert
  // ==============================================================
  function wireTopbarButtons() {
    const applyBtn = document.getElementById("applyChangesBtn");
    if (applyBtn) applyBtn.addEventListener("click", saveAll);

    const revertBtn = document.getElementById("revertBtn");
    if (revertBtn) revertBtn.addEventListener("click", revertChanges);
  }

  // Buang SEMUA draft yang sedang diedit (teks & foto), ambil ulang versi
  // tersimpan terakhir dari server, lalu bangun ulang form dari situ.
  // Ini SENGAJA tidak "undo satu langkah" — ini reset penuh ke titik
  // terakhir kali disimpan, sesuai makna "Revert" yang diminta.
  async function revertChanges() {
    const hasUnsaved = document.body.classList.contains("has-unsaved-changes");
    if (hasUnsaved) {
      const ok = confirm(
        "Ini akan membuang SEMUA perubahan yang belum disimpan dan mengambil ulang versi terakhir dari server. Lanjutkan?"
      );
      if (!ok) return;
    }

    const revertBtn = document.getElementById("revertBtn");
    const applyBtn = document.getElementById("applyChangesBtn");
    if (revertBtn) setButtonLoading(revertBtn, true, "Memuat...");
    if (applyBtn) applyBtn.disabled = true;
    setTopbarSaveStatus("saving", "Memuat ulang...");

    try {
      await loadDraftFromServer();
      buildFormFromContent(draftContent);
      refreshFotoPreview();
      renderProductsSection();
      clearUnsavedState();
      setTopbarSaveStatus("saved", "Direvert");
    } catch (err) {
      setTopbarSaveStatus("error", "Gagal revert");
    } finally {
      if (revertBtn) setButtonLoading(revertBtn, false);
      if (applyBtn) applyBtn.disabled = false;
    }
  }

  // ------------------------------------------------------------
  // Helper status "belum disimpan" — dipakai field text (renderPrimitiveField)
  // DAN field foto (wireFotoField), jadi disatukan di sini alih-alih
  // duplikasi document.body.classList.add(...) di dua tempat.
  // ------------------------------------------------------------
  function markUnsaved() {
    document.body.classList.add("has-unsaved-changes");
    setTopbarSaveStatus("idle", "Ada perubahan");
  }

  function clearUnsavedState() {
    document.body.classList.remove("has-unsaved-changes");
  }

  function setTopbarSaveStatus(state, label) {
    const el = document.getElementById("topbarSaveStatus");
    if (!el) return;
    el.textContent = label || "";
    el.setAttribute("data-state", state || "");
  }

  function downloadTextFile(filename, text) {
    const blob = new Blob([text], { type: "text/javascript;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Serializer khusus: mirip JSON.stringify tapi dengan gaya penulisan
  // JS object literal (key tanpa kutip kalau valid identifier, single
  // quote untuk string, indentasi 2 spasi) supaya file yang dihasilkan
  // terasa "ditulis tangan", bukan hasil dump JSON.
  function serializeValue(value, indentLevel) {
    const pad = "  ".repeat(indentLevel);
    const padInner = "  ".repeat(indentLevel + 1);

    if (value === null) return "null";

    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }

    if (typeof value === "string") {
      return toJsString(value);
    }

    if (Array.isArray(value)) {
      if (value.length === 0) return "[]";
      const items = value.map(
        (item) => padInner + serializeValue(item, indentLevel + 1)
      );
      return "[\n" + items.join(",\n") + "\n" + pad + "]";
    }

    if (typeof value === "object") {
      const keys = Object.keys(value);
      if (keys.length === 0) return "{}";

      // Object kecil berisi cuma value primitif (contoh: { label: '...',
      // href: '...' } di dalam array navbar.links) ditulis satu baris,
      // sama seperti gaya asli content.js — supaya nanti kalau file hasil
      // export di-diff di GitHub, diff-nya tetap rapi per-baris-per-item
      // alih-alih tiap object pecah jadi banyak baris.
      const allPrimitive = keys.every((k) => {
        const v = value[k];
        return v === null || (typeof v !== "object");
      });
      if (allPrimitive) {
        const inline = keys
          .map((k) => {
            const keyStr = isValidIdentifier(k) ? k : toJsString(k);
            return keyStr + ": " + serializeValue(value[k], 0);
          })
          .join(", ");
        const oneLine = "{ " + inline + " }";
        if (oneLine.length <= 100) return oneLine;
      }

      const items = keys.map((k) => {
        const keyStr = isValidIdentifier(k) ? k : toJsString(k);
        return padInner + keyStr + ": " + serializeValue(value[k], indentLevel + 1);
      });
      return "{\n" + items.join(",\n") + "\n" + pad + "}";
    }

    return "null";
  }

  function isValidIdentifier(str) {
    return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(str);
  }

  // Pakai single-quote seperti gaya asli content.js, escape single-quote
  // internal, dan pertahankan karakter lain (termasuk double-quote di
  // dalam string, seperti pada field quote.cards[].text) apa adanya.
  function toJsString(str) {
    const escaped = String(str)
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/\n/g, "\\n");
    return "'" + escaped + "'";
  }

  function generateContentJsFile(content) {
    const header =
      "/* ==========================================================================\n" +
      "   Rafael L3 — Portfolio\n" +
      "   content.js — SATU-SATUNYA sumber semua teks di website ini.\n" +
      "\n" +
      "   File ini di-generate dari Dashboard Admin pada " +
      new Date().toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" }) +
      ".\n" +
      "   Upload file ini ke assets/js/content.js di repo GitHub untuk\n" +
      "   menerapkan perubahan ke situs live.\n" +
      "   ========================================================================== */\n\n" +
      "const CONTENT = ";

    const footer = ";\n";

    return header + serializeValue(content, 0) + footer;
  }

  // wireSaveButtons dipanggil di init() supaya tombol siap dari awal,
  // walau baru relevan setelah dashboard terbuka.
  document.addEventListener("DOMContentLoaded", wireSaveButtons);
})();
