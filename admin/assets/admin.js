/* ==========================================================================
   Rafael L3 — Dashboard Admin
   admin.js — logika login, form editor otomatis, dan export content.js

   CATATAN PENTING SOAL CARA KERJA DASHBOARD INI (baca sebelum ubah kode):

   Website portofolio ini di-hosting di GitHub Pages, yaitu hosting statis —
   artinya tidak ada server yang bisa "menyimpan" perubahan secara langsung
   dari browser. Jadi dashboard ini TIDAK menulis apa pun ke GitHub secara
   otomatis. Alurnya:

     1. Kamu login (dicek oleh Cloudflare Worker kamu, lihat AUTH_API_BASE
        di bawah) supaya cuma kamu yang bisa buka dashboard ini.
     2. Dashboard membaca CONTENT yang sedang aktif (dari content.js) dan
        menampilkannya sebagai form, dikelompokkan persis seperti struktur
        section di content.js.
     3. Setiap kali kamu ubah field, ada live preview jadi kamu bisa lihat
        hasilnya sebelum yakin.
     4. Kalau sudah pas, klik "Unduh content.js" — dashboard men-generate
        ulang file content.js (format & komentar dipertahankan persis
        seperti aslinya) dan file itu ke-download ke komputer kamu.
     5. Kamu upload manual file itu ke repo GitHub kamu (replace
        assets/js/content.js yang lama), commit, push. Situs live akan
        ke-update begitu GitHub Pages selesai build (~1-2 menit).

   Ini disengaja seperti ini (bukan keterbatasan yang lupa diperbaiki) —
   supaya tidak perlu simpan token GitHub apa pun di browser publik, dan
   supaya kamu tetap punya kontrol penuh + jejak commit history yang jelas
   tiap kali konten berubah.
   ========================================================================== */

(function () {
  "use strict";

  // ------------------------------------------------------------
  // KONFIGURASI
  // ------------------------------------------------------------
  // URL Cloudflare Worker yang menangani /login dan /verify.
  const AUTH_API_BASE = "https://dashboard-key.ffkz946.workers.dev";

  // Key sessionStorage tempat token JWT disimpan. Sengaja pakai
  // sessionStorage (bukan localStorage) supaya token OTOMATIS hilang
  // begitu tab/browser ditutup — dashboard admin tidak "nempel" permanen
  // di browser yang dipakai bersama atau di komputer publik.
  const TOKEN_STORAGE_KEY = "rl3_admin_token";

  // ------------------------------------------------------------
  // STATE
  // ------------------------------------------------------------
  // draftContent = salinan kerja dari CONTENT yang sedang diedit di form.
  // Dipisah dari CONTENT asli (yang di-load dari content.js) supaya ada
  // sumber "asli" untuk dibandingkan / direset kalau perlu.
  let draftContent = null;

  // ------------------------------------------------------------
  // ENTRY POINT
  // ------------------------------------------------------------
  document.addEventListener("DOMContentLoaded", init);

  function init() {
    wireLoginForm();
    wireLogoutButton();

    const existingToken = getStoredToken();
    if (existingToken) {
      // Ada token tersimpan dari sesi sebelumnya — cek dulu ke worker
      // apakah masih valid sebelum langsung buka dashboard. Token bisa
      // sudah kedaluwarsa (umur 24 jam) atau di-tolak worker karena
      // alasan lain, jadi jangan asal percaya isi sessionStorage.
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
        enterDashboard(username);
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
          "Ada perubahan yang belum diunduh. Yakin mau keluar? Perubahan yang belum diunduh sebagai content.js akan hilang."
        );
        if (!ok) return;
      }
      clearStoredToken();
      draftContent = null;
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
    document.body.classList.remove("is-dashboard");
    const pwField = document.getElementById("loginPassword");
    if (pwField) pwField.value = "";
  }

  function enterDashboard(username) {
    document.getElementById("loginScreen").hidden = true;
    document.getElementById("dashboardScreen").hidden = false;
    document.body.classList.add("is-dashboard");

    const whoEl = document.getElementById("loggedInAs");
    if (whoEl) whoEl.textContent = username || "";

    if (!draftContent) {
      // Deep clone CONTENT dari content.js supaya draftContent independen
      // — mengedit draft tidak menyentuh objek CONTENT asli.
      //
      // PENTING: CONTENT diakses sebagai bare identifier di sini, BUKAN
      // window.CONTENT. content.js mendeklarasikannya dengan top-level
      // `const CONTENT = {...}` di dalam <script> biasa (bukan
      // type="module"). Top-level const/let dalam classic script TIDAK
      // menjadi properti window — beda dengan var. Bindingnya cuma hidup
      // sebagai identifier di script scope global, yang tetap bisa
      // diakses oleh <script> lain yang dimuat setelahnya (persis seperti
      // main.js mengakses CONTENT.meta.pageTitle secara langsung, bukan
      // window.CONTENT.meta.pageTitle). window.CONTENT akan selalu
      // undefined di sini.
      draftContent = JSON.parse(JSON.stringify(CONTENT));
      buildFormFromContent(draftContent);
    }
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
      document.body.classList.add("has-unsaved-changes");
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
  // LIVE PREVIEW
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
  // EXPORT / DOWNLOAD content.js
  // ------------------------------------------------------------
  // Generate ulang file content.js dari draftContent, dengan format
  // (komentar, pengelompokan, gaya penulisan objek) dipertahankan
  // supaya file hasil download terlihat konsisten dengan yang asli
  // dan tetap gampang dibaca/di-diff di GitHub.
  // ==============================================================
  function wireExportButton() {
    const btn = document.getElementById("downloadBtn");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const fileContents = generateContentJsFile(draftContent);
      downloadTextFile("content.js", fileContents);
      document.body.classList.remove("has-unsaved-changes");

      const status = document.getElementById("downloadStatus");
      if (status) {
        status.textContent =
          "Terunduh. Upload file ini ke assets/js/content.js di repo GitHub kamu untuk menerapkan perubahan.";
        status.classList.add("is-visible");
        window.clearTimeout(status._hideTimer);
        status._hideTimer = window.setTimeout(() => {
          status.classList.remove("is-visible");
        }, 8000);
      }
    });
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

  // wireExportButton dipanggil di init supaya tombol siap dari awal,
  // walau baru relevan setelah dashboard terbuka.
  document.addEventListener("DOMContentLoaded", wireExportButton);
})();
