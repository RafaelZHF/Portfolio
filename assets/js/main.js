/* ==========================================================================
   Rafael L3 — Portfolio
   main.js — seluruh interaksi, animasi, DAN penulisan teks ke halaman.

   PENTING soal teks:
   Semua kalimat/kata yang tampil di halaman ini TIDAK ditulis di sini,
   melainkan diambil dari file assets/js/content.js (variabel CONTENT).
   Kalau mau ganti teks, edit content.js — file ini (main.js) cukup
   dibiarkan apa adanya, karena isinya cuma "logika", bukan "kata-kata".
   ========================================================================== */

(function () {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------------
     0. Render semua teks dari CONTENT ke dalam HTML.
        Ini jalan paling pertama, sebelum semua interaksi di bawahnya,
        supaya elemen yang perlu di-observe/animate sudah ada isinya.
  ------------------------------------------------------------------ */
  function renderContent() {
    if (typeof CONTENT === 'undefined') {
      console.error('content.js belum di-load sebelum main.js, atau variabel CONTENT tidak ditemukan.');
      return;
    }

    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };
    const setHTML = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = value;
    };

    /* ---- META (judul tab + SEO) ---- */
    document.title = CONTENT.meta.pageTitle;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', CONTENT.meta.metaDescription);
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', CONTENT.meta.ogTitle);
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', CONTENT.meta.ogDescription);

    /* ---- NAVBAR ---- */
    document.querySelectorAll('[data-c="navbar.brand"]').forEach(el => {
      const span = el.querySelector('.js-brand-text');
      if (span) span.textContent = CONTENT.navbar.brand;
    });
    const navLinksEl = document.getElementById('navLinks');
    if (navLinksEl) {
      navLinksEl.innerHTML = CONTENT.navbar.links.map(l => `<a href="${l.href}">${l.label}</a>`).join('');
    }
    setText('navBtnGhost', CONTENT.navbar.btnGhost);
    setText('navBtnPrimary', CONTENT.navbar.btnPrimary);

    /* ---- MOBILE DRAWER ---- */
    setText('drawerBrandText', CONTENT.mobileDrawer.brand);
    const drawerLinksEl = document.getElementById('drawerLinks');
    if (drawerLinksEl) {
      drawerLinksEl.innerHTML = CONTENT.mobileDrawer.links.map(l => `<a href="${l.href}">${l.label}</a>`).join('');
    }
    setText('drawerBtnOutline', CONTENT.mobileDrawer.btnOutline);
    setText('drawerBtnPrimary', CONTENT.mobileDrawer.btnPrimary);

    /* ---- HERO ---- */
    setText('heroBadgeText', CONTENT.hero.badge);
    setHTML('heroHeading', CONTENT.hero.heading);
    setText('heroSub', CONTENT.hero.subheading);
    setText('heroMetaLocation', CONTENT.hero.meta.location);
    setText('heroMetaRole', CONTENT.hero.meta.role);
    setText('heroMetaGenre', CONTENT.hero.meta.genreCount);
    setText('heroBtnAccent', CONTENT.hero.btnAccent);
    setText('heroBtnOutline', CONTENT.hero.btnOutline);
    const heroLinkCtaEl = document.getElementById('heroLinkCta');
    if (heroLinkCtaEl) {
      heroLinkCtaEl.innerHTML = `${CONTENT.hero.linkCta.text} <strong>${CONTENT.hero.linkCta.strong}</strong> →`;
    }

    /* Panel pratinjau hero */
    setText('panelSidebarLabel1', CONTENT.hero.panel.sidebarLabel1);
    const panelNavItemsEl = document.getElementById('panelNavItems');
    if (panelNavItemsEl) {
      const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';
      panelNavItemsEl.innerHTML = CONTENT.hero.panel.navItems.map((label, i) =>
        `<div class="hero-panel-nav-item${i === 0 ? ' active' : ''}">${icon}${label}</div>`
      ).join('');
    }
    setText('panelSidebarLabel2', CONTENT.hero.panel.sidebarLabel2);
    const panelNavItemsArsipEl = document.getElementById('panelNavItemsArsip');
    if (panelNavItemsArsipEl) {
      const icons = [
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 20V10M18 20V4M6 20v-4"/></svg>',
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>'
      ];
      panelNavItemsArsipEl.innerHTML = CONTENT.hero.panel.navItemsArsip.map((label, i) =>
        `<div class="hero-panel-nav-item">${icons[i] || ''}${label}</div>`
      ).join('');
    }
    setText('panelStatusChip', CONTENT.hero.panel.statusChip);
    setText('panelHeading', CONTENT.hero.panel.heading);
    const panelTextEl = document.getElementById('panelText');
    if (panelTextEl) {
      panelTextEl.innerHTML = CONTENT.hero.panel.text.replace(/bar_32/, '<code>bar_32</code>');
    }
    const panelActivityEl = document.getElementById('panelActivity');
    if (panelActivityEl) {
      panelActivityEl.innerHTML = CONTENT.hero.panel.activity.map((a, i) => `
        <div class="activity-row">
          <span class="activity-avatar"${i === 1 ? ' style="background:linear-gradient(135deg,var(--grad-cyan),var(--grad-warm));"' : ''}></span>
          <div><span class="who">${a.who}</span><span class="when">${a.when}</span><p>${a.note}</p></div>
        </div>`).join('');
    }

    /* ---- LOGO BAR (marquee genre) ---- */
    setText('logoBarLabel', CONTENT.logoBar.label);
    const marqueeTrackEl = document.getElementById('marqueeTrack');
    if (marqueeTrackEl) {
      /* item diulang 2x supaya animasi berjalan terlihat menyambung */
      const doubled = [...CONTENT.logoBar.items, ...CONTENT.logoBar.items];
      marqueeTrackEl.innerHTML = doubled.map(item => `<span class="marquee-item">${item}</span>`).join('');
    }

    /* ---- 01 TENTANG ---- */
    setText('tentangEyebrowIndex', CONTENT.tentang.eyebrowIndex);
    setText('tentangEyebrowText', CONTENT.tentang.eyebrow);
    const tentangHeadingEl = document.getElementById('tentangHeading');
    if (tentangHeadingEl) {
      tentangHeadingEl.innerHTML = `${CONTENT.tentang.heading}<br><span class="muted">${CONTENT.tentang.headingMuted}</span>`;
    }
    const tentangCardsEl = document.getElementById('tentangCards');
    if (tentangCardsEl) {
      const icons = [
        '<svg width="100" height="90" viewBox="0 0 100 90" fill="none"><path d="M50 10L88 30V60L50 80L12 60V30L50 10Z" stroke="rgba(255,255,255,0.35)" stroke-width="1"/><path d="M50 10V80M12 30L50 50L88 30M12 60L50 50L50 80" stroke="rgba(255,255,255,0.35)" stroke-width="1"/><ellipse cx="50" cy="30" rx="18" ry="8" stroke="rgba(255,255,255,0.5)" stroke-width="1"/></svg>',
        '<svg width="100" height="90" viewBox="0 0 100 90" fill="none"><circle cx="50" cy="45" r="30" stroke="rgba(255,255,255,0.35)" stroke-width="1"/><circle cx="50" cy="45" r="18" stroke="rgba(255,255,255,0.35)" stroke-width="1"/><path d="M50 15V75M20 45H80" stroke="rgba(255,255,255,0.25)" stroke-width="1"/><circle cx="50" cy="45" r="4" fill="rgba(255,255,255,0.5)"/></svg>',
        '<svg width="100" height="90" viewBox="0 0 100 90" fill="none"><path d="M15 65 Q25 20 35 65 T55 65 T75 65 T90 45" stroke="rgba(255,255,255,0.4)" stroke-width="1.2" fill="none"/><path d="M15 50 Q25 35 35 50 T55 50 T75 50" stroke="rgba(255,255,255,0.2)" stroke-width="1" fill="none"/></svg>'
      ];
      tentangCardsEl.innerHTML = CONTENT.tentang.cards.map((c, i) => `
        <div class="feature-card">
          <div class="feature-icon">${icons[i] || ''}</div>
          <h3>${c.title}</h3>
          <p>${c.text}</p>
        </div>`).join('');
    }

    /* ---- 02 GENRE ---- */
    setText('genreChapterNum', CONTENT.genre.chapterNum);
    setText('genreTitle', CONTENT.genre.title);
    setText('genreDesc', CONTENT.genre.desc);
    setText('genreLinkText', CONTENT.genre.link);
    const genreVisualEl = document.getElementById('genreVisual');
    if (genreVisualEl) {
      const colors = ['var(--grad-cyan)', 'var(--grad-warm)', 'var(--color-accent)', 'var(--grad-pink)', 'var(--grad-violet)', '#ff8a5a'];
      genreVisualEl.innerHTML = CONTENT.genre.bars.map((b, i) => `
        <div class="genre-row">
          <span class="genre-tag">${b.tag}</span>
          <div class="genre-bar-track"><div class="genre-bar-fill" data-width="${b.width}" style="background:${colors[i] || 'var(--color-accent)'};"></div></div>
          <span class="genre-pct">${b.pct}</span>
        </div>`).join('');
    }

    /* ---- 03 SKILL ---- */
    setText('skillChapterNum', CONTENT.skill.chapterNum);
    setText('skillTitle', CONTENT.skill.title);
    setHTML('skillDesc', CONTENT.skill.desc);
    setText('skillLinkText', CONTENT.skill.link);
    setHTML('skillOrbitCore', CONTENT.skill.orbitCore);
    setText('nodeRemix', CONTENT.skill.nodeRemix);
    setText('nodeProduce', CONTENT.skill.nodeProduce);

    /* ---- 04 KARYA ---- */
    setText('karyaChapterNum', CONTENT.karya.chapterNum);
    setText('karyaTitle', CONTENT.karya.title);
    setText('karyaDesc', CONTENT.karya.desc);
    setText('karyaLinkText', CONTENT.karya.link);
    const fileTabLabelEl = document.getElementById('releaseFileTabLabel');
    if (fileTabLabelEl) fileTabLabelEl.textContent = CONTENT.karya.fileTabLabel;
    const releaseListEl = document.getElementById('releaseList');
    if (releaseListEl) {
      releaseListEl.innerHTML = CONTENT.karya.releases.map(r => `
        <div class="release-item">
          <span class="release-line-num">${r.num}</span>
          <span class="release-badge ${r.badge}">${r.badgeLabel}</span>
          <span class="release-title">${r.title}</span>
          <span class="release-genre-tag">${r.genre}</span>
        </div>`).join('');
    }

    /* ---- 05 ALAT KERJA ---- */
    setText('alatChapterNum', CONTENT.alat.chapterNum);
    setText('alatTitle', CONTENT.alat.title);
    setText('alatDesc', CONTENT.alat.desc);
    setText('alatLinkText', CONTENT.alat.link);
    const toolsVisualEl = document.getElementById('toolsVisual');
    if (toolsVisualEl) {
      toolsVisualEl.innerHTML = CONTENT.alat.tools.map(t => `
        <div class="tool-chip"><span class="tool-chip-icon" style="background:${t.color};">${t.icon}</span><span>${t.label}</span></div>
      `).join('');
    }

    /* ---- 06 STATISTIK ---- */
    setText('statistikEyebrowIndex', CONTENT.statistik.eyebrowIndex);
    setText('statistikEyebrowText', CONTENT.statistik.eyebrow);
    setText('statistikHeading', CONTENT.statistik.heading);
    setText('statistikDesc', CONTENT.statistik.desc);
    const statsGridEl = document.getElementById('statsGrid');
    if (statsGridEl) {
      statsGridEl.innerHTML = CONTENT.statistik.stats.map(s => `
        <div class="stat-item">
          <div class="stat-num" data-count="${s.count}">0${s.suffix ? `<span class="stat-suffix">${s.suffix}</span>` : ''}</div>
          <div class="stat-label">${s.label}</div>
        </div>`).join('');
    }

    /* ---- 07 QUOTE (carousel geser-otomatis) ---- */
    setText('quoteEyebrowIndex', CONTENT.quote.eyebrowIndex);
    setText('quoteEyebrowText', CONTENT.quote.eyebrow);
    setText('quoteHeading', CONTENT.quote.heading);
    const quoteTrackEl = document.getElementById('quoteTrack');
    if (quoteTrackEl) {
      const cardClasses = ['card-light', 'card-accent', 'card-dark'];
      const avatarStyles = [
        'background:linear-gradient(135deg,#f7bf8b,#ff5ad0);',
        'background:linear-gradient(135deg,#fff,#c7cdfa);',
        'background:linear-gradient(135deg,var(--grad-cyan),var(--color-accent));'
      ];
      const cardHTML = (q, i) => `
        <div class="quote-card ${cardClasses[i] || 'card-light'}" data-quote-index="${i}">
          <p class="quote-text">${q.text}</p>
          <div class="quote-foot">
            <span class="quote-avatar" style="${avatarStyles[i] || ''}"></span>
            <div><div class="quote-name">${q.name}</div><div class="quote-role">${q.role}</div></div>
          </div>
        </div>`;
      // Kartu digandakan 3x berturut-turut supaya track bisa "berputar" tanpa
      // pernah kelihatan mentok/kosong di ujung (ilusi loop tak berhenti).
      const cards = CONTENT.quote.cards;
      const loopedHTML = [...cards, ...cards, ...cards]
        .map((q, i) => cardHTML(q, i % cards.length))
        .join('');
      quoteTrackEl.innerHTML = loopedHTML;
    }

    /* ---- MOTTO ---- */
    setText('mottoQuoteMark', CONTENT.motto.quoteMark);
    setText('mottoText', CONTENT.motto.text);
    setText('mottoSub', CONTENT.motto.sub);

    /* ---- 08 KONTAK / CTA FINAL ---- */
    setText('kontakEyebrowIndex', CONTENT.kontak.eyebrowIndex);
    setText('kontakEyebrowText', CONTENT.kontak.eyebrow);
    setText('kontakHeading', CONTENT.kontak.heading);
    setText('kontakDesc', CONTENT.kontak.desc);
    setText('kontakBtnEmail', CONTENT.kontak.btnEmail);
    const kontakEmailLinkEl = document.getElementById('kontakBtnEmail');
    if (kontakEmailLinkEl) kontakEmailLinkEl.setAttribute('href', 'mailto:' + CONTENT.kontak.email);
    setText('btnInstagram', CONTENT.kontak.btnInstagram);

    /* ---- FOOTER ---- */
    setText('footerBrandText', CONTENT.footer.brand);
    setText('footerTagline', CONTENT.footer.tagline);
    const footerColsEl = document.getElementById('footerCols');
    if (footerColsEl) {
      footerColsEl.innerHTML = CONTENT.footer.columns.map(col => `
        <div class="footer-col">
          <h4>${col.heading}</h4>
          <ul>${col.links.map(l => `<li><a href="${l.href}">${l.label}</a></li>`).join('')}</ul>
        </div>`).join('');
    }
    const footerCopyrightEl = document.getElementById('footerCopyright');
    if (footerCopyrightEl) {
      footerCopyrightEl.innerHTML = `© <span id="tahunSekarang">2026</span> ${CONTENT.footer.copyright}`;
    }
    setText('footerLocation', CONTENT.footer.location);
  }

  renderContent();

  /* ------------------------------------------------------------------
     1. Skeleton loading awal
        Skeleton ditahan tampil minimal SKELETON_MIN_DURATION supaya
        animasi shimmer-nya sempat terlihat jelas (konten asli sebenarnya
        sudah siap dari renderContent() di atas, jadi ini murni jeda
        tampilan, bukan menunggu data). Urutannya:
        1) tunggu window 'load' + durasi minimum
        2) skeleton fade-out (class is-hidden)
        3) body lepas status is-loading + konten asli (.real-content)
           fade-in barengan (class is-revealed)
  ------------------------------------------------------------------ */
  const SKELETON_MIN_DURATION = prefersReducedMotion ? 0 : 900; // ms

  function revealRealContent() {
    const skeletonLoader = document.getElementById('skeletonLoader');
    const realContentEls = document.querySelectorAll('.real-content');

    document.body.classList.remove('is-loading');
    document.body.style.overflow = '';

    if (skeletonLoader) skeletonLoader.classList.add('is-hidden');
    realContentEls.forEach((el) => el.classList.add('is-revealed'));

    // Lepas skeleton dari alur dokumen setelah transisi opacity-nya selesai,
    // supaya tidak menghalangi interaksi/scroll walau sudah invisible.
    setTimeout(() => {
      if (skeletonLoader) skeletonLoader.style.display = 'none';
    }, 600);

    // Beri tahu skrip lain (mis. scroll-fx.js) bahwa konten asli sudah
    // tampil & body sudah bisa discroll normal (overflow sudah dilepas
    // di atas). Dipancarkan lewat CustomEvent, bukan pengecekan class,
    // supaya skrip lain tidak perlu polling.
    document.dispatchEvent(new CustomEvent('rl3:content-revealed'));
  }

  window.addEventListener('load', () => {
    setTimeout(revealRealContent, SKELETON_MIN_DURATION);
  });

  // Jaring pengaman: kalau event 'load' entah kenapa tidak pernah terpicu
  // (mis. resource lambat/gagal), tetap tampilkan halaman setelah waktu wajar
  // supaya pengunjung tidak terjebak melihat skeleton selamanya.
  setTimeout(revealRealContent, 4000);

  /* ------------------------------------------------------------------
     2. Navbar: efek blur & background saat scroll
  ------------------------------------------------------------------ */
  const navbar = document.getElementById('navbar');
  const backToTop = document.getElementById('backToTop');

  function handleScrollUI() {
    const y = window.scrollY;
    if (navbar) navbar.classList.toggle('is-scrolled', y > 12);
    if (backToTop) backToTop.classList.toggle('is-visible', y > 700);
  }
  handleScrollUI();
  window.addEventListener('scroll', handleScrollUI, { passive: true });

  if (backToTop) {
    backToTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    });
  }

  /* ------------------------------------------------------------------
     3. Smooth scroll untuk semua tautan anchor internal
  ------------------------------------------------------------------ */
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const targetId = link.getAttribute('href');
      if (!targetId || targetId === '#') return;
      const target = document.querySelector(targetId);
      if (!target) return;
      e.preventDefault();
      const offset = 76;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
      closeDrawer();
    });
  });

  /* ------------------------------------------------------------------
     4. Menu mobile (drawer)
  ------------------------------------------------------------------ */
  const navToggle = document.getElementById('navToggle');
  const drawer = document.getElementById('mobileDrawer');
  const drawerClose = document.getElementById('drawerClose');

  function openDrawer() {
    if (!drawer) return;
    drawer.classList.add('is-open');
    navToggle && navToggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }
  function closeDrawer() {
    if (!drawer) return;
    drawer.classList.remove('is-open');
    navToggle && navToggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  navToggle && navToggle.addEventListener('click', openDrawer);
  drawerClose && drawerClose.addEventListener('click', closeDrawer);
  drawer && drawer.addEventListener('click', (e) => {
    if (e.target === drawer) closeDrawer();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDrawer();
  });

  /* ------------------------------------------------------------------
     5. Reveal on scroll (IntersectionObserver)
        Class is-visible di-toggle setiap elemen masuk/keluar viewport,
        bukan cuma sekali — jadi animasi reveal terus berulang tiap
        discroll, baik ke bawah maupun ke atas, tanpa perlu refresh.
  ------------------------------------------------------------------ */
  const revealEls = document.querySelectorAll('.reveal, .reveal-stagger');

  if ('IntersectionObserver' in window && !prefersReducedMotion) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entry.target.classList.toggle('is-visible', entry.isIntersecting);
        });
      },
      { threshold: 0.14, rootMargin: '0px 0px -60px 0px' }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-visible'));
  }

  /* ------------------------------------------------------------------
     6. Counter angka statistik
  ------------------------------------------------------------------ */
  const counters = document.querySelectorAll('.stat-num[data-count]');

  function animateCounter(el) {
    const target = parseInt(el.getAttribute('data-count'), 10) || 0;
    const suffix = el.querySelector('.stat-suffix');
    const suffixHTML = suffix ? suffix.outerHTML : '';
    const duration = 1400;
    const start = performance.now();

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.floor(eased * target);
      el.innerHTML = value + suffixHTML;
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        el.innerHTML = target + suffixHTML;
      }
    }
    if (prefersReducedMotion) {
      el.innerHTML = target + suffixHTML;
      return;
    }
    requestAnimationFrame(tick);
  }

  if ('IntersectionObserver' in window) {
    const counterIO = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            counterIO.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 }
    );
    counters.forEach((el) => counterIO.observe(el));
  }

  /* ------------------------------------------------------------------
     7. Genre bar fill animation
  ------------------------------------------------------------------ */
  const genreVisual = document.getElementById('genreVisual');
  if (genreVisual) {
    const bars = genreVisual.querySelectorAll('.genre-bar-fill');
    const genreIO = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            bars.forEach((bar, i) => {
              setTimeout(() => {
                bar.style.width = bar.getAttribute('data-width') + '%';
              }, i * 90);
            });
            genreIO.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.3 }
    );
    genreIO.observe(genreVisual);
  }

  /* ------------------------------------------------------------------
     8. Skill orbit — node mengorbit lembut mengelilingi inti
  ------------------------------------------------------------------ */
  const nodeRemix = document.getElementById('nodeRemix');
  const nodeProduce = document.getElementById('nodeProduce');

  if (nodeRemix && nodeProduce && !prefersReducedMotion) {
    let t = 0;
    function orbit() {
      t += 0.006;
      const r1 = 105;
      const r2 = 92;
      const a1 = t;
      const a2 = t + Math.PI; // berlawanan sisi
      nodeRemix.style.transform = `translate(${Math.cos(a1) * r1 * 0.35}px, ${Math.sin(a1) * r1 * 0.2}px)`;
      nodeProduce.style.transform = `translate(${Math.cos(a2) * r2 * 0.35}px, ${Math.sin(a2) * r2 * 0.2}px)`;
      requestAnimationFrame(orbit);
    }
    requestAnimationFrame(orbit);
  }

  /* ------------------------------------------------------------------
     9. Cursor spotlight halus (hanya area hero, desktop saja)
  ------------------------------------------------------------------ */
  const cursorSpot = document.getElementById('cursorSpot');
  const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;

  if (cursorSpot && !isTouchDevice && !prefersReducedMotion) {
    let mouseX = 0, mouseY = 0, curX = 0, curY = 0;
    let active = false;

    window.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (e.clientY < window.innerHeight * 1.1) {
        cursorSpot.style.opacity = '1';
        active = true;
      } else if (active) {
        cursorSpot.style.opacity = '0';
        active = false;
      }
    });

    function followCursor() {
      curX += (mouseX - curX) * 0.09;
      curY += (mouseY - curY) * 0.09;
      cursorSpot.style.left = curX + 'px';
      cursorSpot.style.top = curY + 'px';
      requestAnimationFrame(followCursor);
    }
    requestAnimationFrame(followCursor);
  } else if (cursorSpot) {
    cursorSpot.style.display = 'none';
  }

  /* ------------------------------------------------------------------
     10. Marquee — pause saat hover (desktop)
  ------------------------------------------------------------------ */
  const marqueeTrack = document.getElementById('marqueeTrack');
  if (marqueeTrack) {
    const marqueeWrap = marqueeTrack.parentElement;
    marqueeWrap.addEventListener('mouseenter', () => {
      marqueeTrack.style.animationPlayState = 'paused';
    });
    marqueeWrap.addEventListener('mouseleave', () => {
      marqueeTrack.style.animationPlayState = 'running';
    });
  }

  /* ------------------------------------------------------------------
     14. Quote carousel — geser otomatis, bisa ditarik manual (drag/swipe/
         scroll), dan menyorot (highlight) satu kartu yang sedang ada
         di tengah. Tanpa tombol prev/next.

         Cara kerja singkat:
         - quoteTrackEl berisi kartu yang sudah digandakan 3x (lihat
           renderContent di atas) supaya track selalu punya kartu di
           kiri & kanan, sehingga bisa "berputar" tanpa terlihat mentok.
         - Posisi digerakkan lewat transform: translateX, bukan properti
           `scrollLeft`, supaya gerakannya presisi sub-pixel dan mulus.
         - Sebuah loop requestAnimationFrame menggeser track pelan-pelan
           terus-menerus (auto-play). Interaksi pengguna (hover, drag,
           sentuh) menjeda auto-play sementara, lalu jalan lagi.
         - Tiap frame, kartu yang jaraknya paling dekat ke titik tengah
           carousel diberi class .is-active (membesar & terang penuh),
           sisanya diredupkan — inilah efek "menyorot satu per satu".
  ------------------------------------------------------------------ */
  const quoteCarousel = document.getElementById('quoteCarousel');
  const quoteTrack = document.getElementById('quoteTrack');

  if (quoteCarousel && quoteTrack) {
    const originalCount = (typeof CONTENT !== 'undefined' && CONTENT.quote && CONTENT.quote.cards)
      ? CONTENT.quote.cards.length
      : quoteTrack.children.length / 3;

    let cardW = 0;      // lebar satu kartu termasuk gap
    let setW = 0;       // lebar total satu set (originalCount kartu)
    let x = 0;           // posisi translateX saat ini (negatif = geser ke kiri)
    let isDown = false;  // sedang drag manual?
    let startX = 0;      // posisi pointer saat drag mulai
    let startXPos = 0;   // posisi x saat drag mulai
    let dragMoved = false;
    let resumeTimer = null;
    let paused = false;

    const AUTOPLAY_SPEED = 0.9; // px per frame (~54px/detik di 60fps) — cukup terasa mengalir, ganti kartu tiap ±7 detik
    const RESUME_DELAY = 1400;   // ms jeda sebelum autoplay lanjut setelah interaksi

    function measure() {
      const firstCard = quoteTrack.children[0];
      const secondCard = quoteTrack.children[1];
      if (!firstCard || !secondCard) return;
      cardW = secondCard.offsetLeft - firstCard.offsetLeft;
      setW = cardW * originalCount;
      // Mulai dari tengah (set ke-2 dari 3) supaya ada ruang gerak
      // penuh ke kiri maupun kanan sebelum perlu di-wrap.
      if (x === 0) x = -setW;
      applyTransform();
    }

    function applyTransform() {
      quoteTrack.style.transform = `translate3d(${x}px,0,0)`;
    }

    function wrap() {
      // Begitu geser melewati satu set penuh ke salah satu arah,
      // lompat balik sejauh persis satu set — karena kartu di set
      // sebelah adalah duplikat identik, lompatan ini tidak terlihat.
      if (x <= -setW * 2) x += setW;
      else if (x > -setW * 0) x -= setW;
      applyTransform();
    }

    function highlightActive() {
      const carouselRect = quoteCarousel.getBoundingClientRect();
      const centerPoint = carouselRect.left + carouselRect.width / 2;
      let closest = null;
      let closestDist = Infinity;
      Array.from(quoteTrack.children).forEach((card) => {
        const r = card.getBoundingClientRect();
        const cardCenter = r.left + r.width / 2;
        const dist = Math.abs(cardCenter - centerPoint);
        if (dist < closestDist) {
          closestDist = dist;
          closest = card;
        }
      });
      Array.from(quoteTrack.children).forEach((card) => {
        card.classList.toggle('is-active', card === closest);
      });
    }

    function frame() {
      if (!paused && !isDown && !prefersReducedMotion) {
        x -= AUTOPLAY_SPEED;
        wrap();
      }
      highlightActive();
      requestAnimationFrame(frame);
    }

    function schedulePause() {
      paused = true;
      if (resumeTimer) clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => { paused = false; }, RESUME_DELAY);
    }

    // ---- Hover (desktop): jeda selagi kursor di atas carousel ----
    quoteCarousel.addEventListener('mouseenter', () => { paused = true; });
    quoteCarousel.addEventListener('mouseleave', () => {
      if (!isDown) {
        if (resumeTimer) clearTimeout(resumeTimer);
        paused = false;
      }
    });

    // ---- Drag manual (mouse & sentuh, lewat Pointer Events) ----
    quoteCarousel.addEventListener('pointerdown', (e) => {
      isDown = true;
      dragMoved = false;
      startX = e.clientX;
      startXPos = x;
      quoteCarousel.classList.add('is-dragging');
      if (resumeTimer) clearTimeout(resumeTimer);
      try { quoteCarousel.setPointerCapture(e.pointerId); } catch (err) {}
    });

    quoteCarousel.addEventListener('pointermove', (e) => {
      if (!isDown) return;
      const delta = e.clientX - startX;
      if (Math.abs(delta) > 3) dragMoved = true;
      x = startXPos + delta;
      wrap();
    });

    function endDrag() {
      if (!isDown) return;
      isDown = false;
      quoteCarousel.classList.remove('is-dragging');
      schedulePause();
    }
    quoteCarousel.addEventListener('pointerup', endDrag);
    quoteCarousel.addEventListener('pointercancel', endDrag);
    quoteCarousel.addEventListener('pointerleave', () => { if (isDown) endDrag(); });

    // Cegah klik "nyangkut" jadi navigasi kalau ternyata itu adalah swipe.
    quoteCarousel.addEventListener('click', (e) => {
      if (dragMoved) { e.preventDefault(); e.stopPropagation(); }
    }, true);

    // ---- Scroll roda mouse / trackpad juga bisa menggeser manual ----
    quoteCarousel.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) return; // biarkan scroll vertikal halaman jalan normal
      e.preventDefault();
      x -= e.deltaX;
      wrap();
      schedulePause();
    }, { passive: false });

    window.addEventListener('resize', measure);

    // Ukur setelah font & layout stabil, lalu mulai loop animasi.
    requestAnimationFrame(() => {
      measure();
      requestAnimationFrame(frame);
    });
  }

  /* ------------------------------------------------------------------
     11. Tahun otomatis di footer
  ------------------------------------------------------------------ */
  const tahunEl = document.getElementById('tahunSekarang');
  if (tahunEl) tahunEl.textContent = new Date().getFullYear();

  /* ------------------------------------------------------------------
     12. Tombol Instagram — placeholder ramah (belum ada tautan asli)
  ------------------------------------------------------------------ */
  const btnInstagram = document.getElementById('btnInstagram');
  if (btnInstagram) {
    const originalLabel = CONTENT.kontak.btnInstagram;
    btnInstagram.addEventListener('click', (e) => {
      if (btnInstagram.getAttribute('href') === '#') {
        e.preventDefault();
        btnInstagram.textContent = CONTENT.kontak.instagramPlaceholder;
        setTimeout(() => { btnInstagram.textContent = originalLabel; }, 2600);
      }
    });
  }

  /* ------------------------------------------------------------------
     13. Aktifkan link navbar sesuai section yang sedang dilihat
  ------------------------------------------------------------------ */
  const sections = document.querySelectorAll('main section[id], main[id]');
  const navAnchors = document.querySelectorAll('.nav-links a, .mobile-drawer-links a');

  if ('IntersectionObserver' in window && sections.length) {
    const navIO = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('id');
            navAnchors.forEach((a) => {
              a.style.color = a.getAttribute('href') === '#' + id ? 'var(--color-text-primary)' : '';
            });
          }
        });
      },
      { threshold: 0, rootMargin: '-45% 0px -50% 0px' }
    );
    sections.forEach((s) => navIO.observe(s));
  }

})();
