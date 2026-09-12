/* ==========================================================================
   AANGAN — motion layer
   Lenis smooth scroll + GSAP ScrollTrigger/SplitText
   Every module is optional: each guards on element presence.
   ========================================================================== */
(() => {
  'use strict';

  const QS      = new URLSearchParams(location.search);
  const FULL    = QS.has('full');           // ?full=1 — whole page in one tall viewport (QA capture)
  const SNAP    = QS.has('snap') || FULL;   // ?snap=1[&y=3000] — static render for screenshots
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COARSE  = window.matchMedia('(pointer: coarse)').matches;
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const clamp = (n, a, b) => Math.min(Math.max(n, a), b);

  const hasGSAP = typeof window.gsap !== 'undefined';
  if (hasGSAP) {
    gsap.registerPlugin(ScrollTrigger);
    if (window.SplitText) gsap.registerPlugin(SplitText);
    gsap.defaults({ ease: 'power3.out' });
  }

  /* ------------------------------------------------------------------ *
   * Smooth scroll
   * ------------------------------------------------------------------ */
  let lenis = null;

  function initScroll() {
    if (REDUCED || SNAP || typeof window.Lenis === 'undefined' || !hasGSAP) {
      document.documentElement.style.scrollBehavior = 'smooth';
      return;
    }
    lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.6,
      lerp: null
    });
    window.__lenis = lenis;
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);

    // In-page anchors
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]:not([href="#"])');
      if (!a) return;
      const target = $(a.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: -90, duration: 1.4 });
    });
  }
  const stopScroll  = () => lenis ? lenis.stop()  : document.body.classList.add('is-locked');
  const startScroll = () => lenis ? lenis.start() : document.body.classList.remove('is-locked');

  /* ------------------------------------------------------------------ *
   * Preloader  (first visit of the session only)
   * ------------------------------------------------------------------ */
  function initLoader(done) {
    const el = $('.loader');
    if (!el) { done(); return; }

    const seen = sessionStorage.getItem('aangan:seen') === '1';
    if (seen || REDUCED || SNAP || !hasGSAP) {
      el.remove();
      document.body.style.removeProperty('overflow');
      done();
      return;
    }
    sessionStorage.setItem('aangan:seen', '1');
    stopScroll();

    const counter = $('.loader__count', el);
    const bar     = $('.loader__bar i', el);
    const letters = $$('.loader__mark span', el);
    const sub     = $('.loader__sub', el);
    const rule    = $('.loader__rule', el);
    const place   = $('.loader__place', el);

    // --- Real progress, not a fixed countdown -------------------------------
    // The bar tracks things that genuinely have to finish: the typeface, the
    // hero photograph, and the document itself.
    let target = 6, shown = 0, settled = false;
    const bump = (v) => { target = Math.max(target, v); };

    const fonts = document.fonts ? document.fonts.ready : Promise.resolve();
    fonts.then(() => { bump(46); revealMark(); });

    const hero = $('.hero__media img') || $('.csh img') || $('main img');
    if (hero) {
      const onHero = () => bump(82);
      (hero.decode ? hero.decode().then(onHero, onHero) : Promise.resolve().then(onHero));
    } else bump(82);

    if (document.readyState === 'complete') bump(100);
    else window.addEventListener('load', () => bump(100));
    setTimeout(() => bump(100), 4000);   // never hold the page hostage

    // --- The wordmark arrives as soon as it can be drawn correctly ----------
    let revealed = false;
    function revealMark() {
      if (revealed) return;
      revealed = true;
      gsap.timeline()
        .to(letters, { yPercent: 0, duration: 1.1, stagger: 0.045, ease: 'expo.out' })
        .fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: 0.9, ease: 'expo.out' }, 0.25)
        .to(sub, { opacity: 1, duration: 0.6 }, 0.35);
    }
    setTimeout(revealMark, 900);   // if the font stalls, show it anyway

    // Chrome in immediately so the screen is never inert
    gsap.fromTo([place, counter], { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: 0.7, stagger: 0.08, ease: 'power3.out' });

    const finish = () => {
      if (settled) return;
      settled = true;
      counter.textContent = '100';
      bar.style.width = '100%';
      exit();
    };

    const tick = () => {
      if (settled) return;
      shown += (target - shown) * 0.12;
      if (target >= 100 && target - shown < 1.2) { finish(); return; }
      counter.textContent = String(Math.round(shown)).padStart(3, '0');
      bar.style.width = shown + '%';
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    // requestAnimationFrame is throttled in a background tab, so the intro
    // must not depend on it alone — otherwise a visitor who switches away
    // comes back to a locked page.
    setTimeout(finish, 6000);

    // --- Hand over to the page ---------------------------------------------
    function exit() {
      gsap.timeline({
        onComplete: () => { el.remove(); startScroll(); }
      })
        .to([place, counter, sub], { opacity: 0, duration: 0.3, ease: 'power2.in' })
        .to(rule, { scaleX: 0, transformOrigin: 'right', duration: 0.4, ease: 'power2.in' }, '<')
        .to(letters, { yPercent: -110, duration: 0.7, stagger: 0.03, ease: 'expo.in' }, '-=0.15')
        .to(el, { clipPath: 'inset(0% 0% 100% 0%)', duration: 1, ease: 'expo.inOut' }, '-=0.25');

      // The hero starts moving while the curtain is still lifting, so the two
      // read as one gesture rather than two separate animations.
      setTimeout(done, 420);
    }
  }

  /* ------------------------------------------------------------------ *
   * Page transitions
   * ------------------------------------------------------------------ */
  function initCurtain() {
    const curtain = $('.curtain');
    if (!curtain) return;
    const panels = $$('i', curtain);

    const lift = () => {
      if (!hasGSAP) { gsapless(); return; }
      gsap.set(panels, { scaleY: 1, transformOrigin: 'top' });
      gsap.to(panels, {
        scaleY: 0, duration: 0.85, ease: 'expo.inOut',
        stagger: { each: 0.05, from: 'start' }
      });
    };
    const gsapless = () => panels.forEach(p => { p.style.transform = 'scaleY(0)'; });

    // Only lift if we arrived through a transition
    if (sessionStorage.getItem('aangan:nav') === '1') {
      sessionStorage.removeItem('aangan:nav');
      lift();
    } else {
      gsapless();
    }

    if (REDUCED || !hasGSAP) return;

    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href]');
      if (!a) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (a.target === '_blank' || a.hasAttribute('download')) return;
      if (url.pathname === location.pathname && url.hash) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      if (url.href === location.href) { e.preventDefault(); return; }

      e.preventDefault();
      sessionStorage.setItem('aangan:nav', '1');
      stopScroll();
      gsap.set(panels, { transformOrigin: 'bottom' });
      gsap.to(panels, {
        scaleY: 1, duration: 0.62, ease: 'expo.inOut',
        stagger: { each: 0.045, from: 'start' },
        onComplete: () => { location.href = url.href; }
      });
    });

    window.addEventListener('pageshow', (e) => { if (e.persisted) { lift(); startScroll(); } });
  }

  /* ------------------------------------------------------------------ *
   * Cursor
   * ------------------------------------------------------------------ */
  function initCursor() {
    const cur = $('.cursor');
    if (!cur || COARSE || REDUCED || !hasGSAP) { if (cur) cur.remove(); return; }
    const label = $('.cursor__label', cur);
    const xTo = gsap.quickTo(cur, 'x', { duration: 0.42, ease: 'power3' });
    const yTo = gsap.quickTo(cur, 'y', { duration: 0.42, ease: 'power3' });

    window.addEventListener('mousemove', (e) => {
      xTo(e.clientX); yTo(e.clientY);
      if (!cur.classList.contains('is-ready')) cur.classList.add('is-ready');
    }, { passive: true });

    document.addEventListener('mouseover', (e) => {
      const t = e.target.closest('[data-cursor]');
      if (t) {
        const mode = t.dataset.cursor;
        cur.classList.toggle('is-view', mode !== 'link');
        cur.classList.toggle('is-link', mode === 'link');
        if (mode !== 'link') label.textContent = t.dataset.cursorLabel || 'View';
        return;
      }
      if (e.target.closest('a, button, input, textarea, select, [role="button"]')) {
        cur.classList.add('is-link'); cur.classList.remove('is-view');
      } else {
        cur.classList.remove('is-link', 'is-view');
      }
    });
    document.addEventListener('mouseleave', () => cur.classList.remove('is-ready'));
    document.addEventListener('mouseenter', () => cur.classList.add('is-ready'));
  }

  /* ------------------------------------------------------------------ *
   * Header
   * ------------------------------------------------------------------ */
  function initHeader() {
    const header = $('.header');
    if (!header) return;

    // auto  — hides when scrolling down (default)
    // never — always visible, so a sticky bar can sit flush beneath it
    const mode = header.dataset.hide || 'auto';
    const solidAfter = header.dataset.solid === 'always' ? -1 : (window.innerHeight * 0.72);
    let last = 0;

    // Publish the real header height so sticky bars can sit flush beneath it.
    const measure = () => document.documentElement.style
      .setProperty('--header-h', Math.round(header.offsetHeight) + 'px');
    measure();
    window.addEventListener('resize', debounce(measure, 150));
    if (document.fonts) document.fonts.ready.then(measure);

    const onScroll = (y) => {
      header.classList.toggle('is-solid', solidAfter < 0 ? y > 12 : y > solidAfter);
      if (mode === 'auto') {
        header.classList.toggle('is-hidden', y > last && y > 400 && !$('.menu.is-open'));
      }
      last = y;
    };
    if (lenis) lenis.on('scroll', ({ scroll }) => onScroll(scroll));
    else window.addEventListener('scroll', () => onScroll(window.scrollY), { passive: true });
    onScroll(window.scrollY);
  }

  function initMenu() {
    const btn  = $('.burger');
    const menu = $('.menu');
    if (!btn || !menu) return;
    const close = () => {
      menu.classList.remove('is-open');
      btn.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      startScroll();
    };
    btn.addEventListener('click', () => {
      const open = !menu.classList.contains('is-open');
      menu.classList.toggle('is-open', open);
      btn.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', String(open));
      open ? stopScroll() : startScroll();
    });
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  }

  /* ------------------------------------------------------------------ *
   * Text splitting + reveals
   * ------------------------------------------------------------------ */
  const splits = [];

  function splitLines(el) {
    if (!window.SplitText) return null;
    const s = new SplitText(el, { type: 'lines', mask: 'lines', linesClass: 'sline' });
    splits.push({ el, s });
    return s;
  }

  function initType(afterLoader) {
    if (REDUCED || SNAP || !hasGSAP || !window.SplitText) {
      $$('[data-reveal], [data-split]').forEach(e => { e.style.opacity = '1'; });
      $$('[data-wipe]').forEach(e => { e.style.clipPath = 'none'; });
      return;
    }

    // Headlines that split into masked lines
    $$('[data-split]').forEach((el) => {
      const s = splitLines(el);
      if (!s) return;
      gsap.set(el, { opacity: 1 });
      const isHero = el.hasAttribute('data-split-hero');
      const tween = {
        yPercent: 112,
        duration: 1.25,
        stagger: 0.085,
        ease: 'expo.out'
      };
      if (isHero) {
        gsap.from(s.lines, { ...tween, delay: afterLoader ? 0.1 : 0.45 });
      } else {
        gsap.from(s.lines, {
          ...tween,
          scrollTrigger: { trigger: el, start: 'top 88%', once: true }
        });
      }
    });

    // Generic reveals
    $$('[data-reveal]').forEach((el) => {
      const d = parseFloat(el.dataset.delay || 0);
      const hero = el.hasAttribute('data-reveal-hero');
      const y = el.dataset.reveal === 'fade' ? 0 : 26;
      if (hero) {
        gsap.fromTo(el, { opacity: 0, y }, {
          opacity: 1, y: 0, duration: 1.1, ease: 'power3.out',
          delay: d + 0.45, clearProps: 'transform'
        });
      } else {
        gsap.fromTo(el, { opacity: 0, y }, {
          opacity: 1, y: 0, duration: 1.05, delay: d, ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 90%', once: true }
        });
      }
    });

    // Image mask wipes
    $$('[data-wipe]').forEach((el) => {
      gsap.fromTo(el, { clipPath: 'inset(0% 0% 100% 0%)' }, {
        clipPath: 'inset(0% 0% 0% 0%)',
        duration: 1.35,
        ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 92%', once: true }
      });
      const img = $('img', el);
      if (img) gsap.fromTo(img, { scale: 1.22 }, {
        scale: 1, duration: 1.6, ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 92%', once: true }
      });
    });

    // Re-split on width change (no re-animation — just reflow)
    let w = window.innerWidth;
    window.addEventListener('resize', debounce(() => {
      if (Math.abs(window.innerWidth - w) < 60) return;
      w = window.innerWidth;
      splits.forEach(({ s }) => s.revert());
      splits.length = 0;
      ScrollTrigger.refresh();
    }, 260));
  }

  /* ------------------------------------------------------------------ *
   * Parallax
   * ------------------------------------------------------------------ */
  function initParallax() {
    if (REDUCED || !hasGSAP) return;

    const heroImg = $('.hero__media img');
    if (heroImg) {
      gsap.to(heroImg, {
        yPercent: 16, scale: 1.02, ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
      });
      gsap.to('.hero__inner', {
        yPercent: -14, opacity: 0.1, ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
      });
    }

    $$('[data-parallax]').forEach((el) => {
      const amt = parseFloat(el.dataset.parallax) || 12;
      gsap.fromTo(el, { yPercent: -amt / 2 }, {
        yPercent: amt / 2, ease: 'none',
        scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true }
      });
    });

    const csh = $('.csh img');
    if (csh) gsap.to(csh, {
      yPercent: 14, ease: 'none',
      scrollTrigger: { trigger: '.csh', start: 'top top', end: 'bottom top', scrub: true }
    });
  }

  /* ------------------------------------------------------------------ *
   * Manifesto — word by word
   * ------------------------------------------------------------------ */
  function initManifesto() {
    const el = $('[data-words]');
    if (!el) return;
    const raw = el.textContent.trim();
    const accents = (el.dataset.accent || '').split('|').map(s => s.trim().toLowerCase()).filter(Boolean);
    el.textContent = '';
    raw.split(/\s+/).forEach((word, i) => {
      const span = document.createElement('span');
      span.className = 'w';
      const clean = word.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
      if (accents.includes(clean)) span.classList.add('accent');
      span.textContent = word;
      el.appendChild(span);
      el.appendChild(document.createTextNode(' '));
    });

    const words = $$('.w', el);
    if (REDUCED || !hasGSAP) { words.forEach(w => w.classList.add('on')); return; }

    gsap.to(words, {
      color: (i, t) => t.classList.contains('accent') ? '#AE4E2B' : '#14110D',
      ease: 'none',
      stagger: 1,
      scrollTrigger: { trigger: el, start: 'top 78%', end: 'bottom 58%', scrub: 0.6 }
    });
  }

  /* ------------------------------------------------------------------ *
   * Horizontal pinned gallery
   * ------------------------------------------------------------------ */
  function initHScroll() {
    const sec = $('.hscroll');
    if (!sec || !hasGSAP) return;
    const track = $('.hscroll__track', sec);
    if (!track) return;

    if (FULL || REDUCED || window.innerWidth < 820) {
      sec.classList.add('is-swipe');
      initCarouselProgress(sec);
      return;
    }

    const distance = () => Math.max(0, track.scrollWidth - window.innerWidth + 32);

    gsap.to(track, {
      x: () => -distance(),
      ease: 'none',
      scrollTrigger: {
        trigger: sec,
        start: 'top top',
        end: () => '+=' + distance(),
        pin: true,
        scrub: 0.8,
        anticipatePin: 1,
        invalidateOnRefresh: true
      }
    });
  }

  /* ------------------------------------------------------------------ *
   * Swipe carousel progress (small screens)
   * ------------------------------------------------------------------ */
  function initCarouselProgress(sec) {
    const view = $('.hscroll__viewport', sec);
    if (!view || $('.hprog', sec)) return;
    const bar = document.createElement('div');
    bar.className = 'hprog';
    bar.setAttribute('aria-hidden', 'true');
    bar.innerHTML = '<i></i>';
    sec.appendChild(bar);
    const thumb = $('i', bar);

    const update = () => {
      const max = view.scrollWidth - view.clientWidth;
      if (max <= 0) { bar.style.display = 'none'; return; }
      bar.style.display = '';
      const frac = view.clientWidth / view.scrollWidth;
      const pos = clamp(view.scrollLeft / max, 0, 1);
      thumb.style.width = (frac * 100).toFixed(2) + '%';
      thumb.style.transform = 'translateX(' + (pos * (1 / frac - 1) * 100).toFixed(2) + '%)';
    };
    view.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', debounce(update, 150));
    requestAnimationFrame(update);
    window.addEventListener('load', update);
  }

  /* ------------------------------------------------------------------ *
   * Floating action bar (small screens)
   * ------------------------------------------------------------------ */
  function initMobileBar() {
    if (window.innerWidth > 720 || $('.mbar')) return;
    // The enquiry page is the call to action; a floating one would just repeat it.
    if ($('.form')) return;

    const bar = document.createElement('div');
    bar.className = 'mbar';
    bar.innerHTML =
      '<a class="mbar__cta" href="contact.html">Start a project' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h16M13.5 5.5 20 12l-6.5 6.5"/></svg>' +
      '</a>' +
      '<a class="mbar__ico" href="tel:+912240001188" aria-label="Call the studio">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.5 3.5h-2a2 2 0 0 0-2 2.2c.5 6.6 5.7 11.8 12.3 12.3a2 2 0 0 0 2.2-2v-2a1 1 0 0 0-.8-1l-2.7-.6a1 1 0 0 0-1 .4l-.9 1.2a12.5 12.5 0 0 1-5-5l1.2-.9a1 1 0 0 0 .4-1l-.6-2.7a1 1 0 0 0-1-.8z"/></svg>' +
      '</a>' +
      '<a class="mbar__ico" href="https://wa.me/919820041188?text=Hello%20Aangan%20%E2%80%94%20I%27d%20like%20to%20talk%20about%20a%20project." target="_blank" rel="noopener" aria-label="Message the studio on WhatsApp">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.4 11.7a8.3 8.3 0 0 1-12.3 7.3l-4.6 1.5 1.5-4.5A8.3 8.3 0 1 1 20.4 11.7z"/><path d="M9.5 8.7c.15-.4.35-.4.6-.4h.45c.2 0 .38.02.55.42l.62 1.5c.1.25.02.45-.1.6l-.36.45c-.1.15-.16.28 0 .52a5.6 5.6 0 0 0 2.35 2c.25.1.4.08.52-.04l.45-.52c.15-.18.33-.17.52-.1l1.4.72c.25.15.35.3.35.5 0 .72-.55 1.42-1.4 1.42-1 0-2.9-.62-4.4-2.12S9.3 10.5 9.3 9.6c0-.4.1-.6.2-.9z"/></svg>' +
      '</a>';
    document.body.appendChild(bar);
    document.body.classList.add('has-mbar');

    const cta = $('.cta');
    const showFrom = window.innerHeight * 0.7;

    const update = (y) => {
      const menuOpen = !!$('.menu.is-open');
      // Step aside for the page's own closing call to action.
      const nearEnd = cta ? cta.getBoundingClientRect().top < window.innerHeight * 0.85 : false;
      bar.classList.toggle('is-on', y > showFrom && !nearEnd && !menuOpen);
    };
    if (lenis) lenis.on('scroll', ({ scroll }) => update(scroll));
    else window.addEventListener('scroll', () => update(window.scrollY), { passive: true });
    update(window.scrollY);
  }

  /* ------------------------------------------------------------------ *
   * Counters
   * ------------------------------------------------------------------ */
  function initCounters() {
    $$('[data-count]').forEach((el) => {
      const end = parseFloat(el.dataset.count);
      const dec = (el.dataset.count.split('.')[1] || '').length;
      const fmt = (v) => {
        const s = dec ? v.toFixed(dec) : Math.round(v).toString();
        return el.dataset.pad ? s.padStart(parseInt(el.dataset.pad, 10), '0') : s;
      };
      if (REDUCED || SNAP || !hasGSAP) { el.textContent = fmt(end); return; }
      const o = { v: 0 };
      gsap.to(o, {
        v: end, duration: 2.1, ease: 'power2.out',
        onUpdate: () => { el.textContent = fmt(o.v); },
        scrollTrigger: { trigger: el, start: 'top 90%', once: true }
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * Marquee — duplicate track for a seamless loop
   * ------------------------------------------------------------------ */
  function initMarquee() {
    $$('.marquee').forEach((m) => {
      const track = $('.marquee__track', m);
      if (!track) return;
      const clone = track.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      m.appendChild(clone);
    });
  }

  /* ------------------------------------------------------------------ *
   * Magnetic buttons
   * ------------------------------------------------------------------ */
  function initMagnetic() {
    if (COARSE || REDUCED || !hasGSAP) return;
    $$('[data-magnetic]').forEach((el) => {
      const strength = parseFloat(el.dataset.magnetic) || 0.32;
      const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * strength);
        yTo((e.clientY - (r.top + r.height / 2)) * strength);
      });
      el.addEventListener('mouseleave', () => { xTo(0); yTo(0); });
    });
  }

  /* ------------------------------------------------------------------ *
   * Work list — cursor-following preview
   * ------------------------------------------------------------------ */
  function initPeek() {
    const peek = $('.wpeek');
    const rows = $$('.wrow');
    if (!peek || !rows.length || COARSE || REDUCED || !hasGSAP) return;
    const imgs = $$('img', peek);
    const xTo = gsap.quickTo(peek, 'x', { duration: 0.75, ease: 'power3' });
    const yTo = gsap.quickTo(peek, 'y', { duration: 0.75, ease: 'power3' });

    rows.forEach((row, i) => {
      row.addEventListener('mouseenter', () => {
        imgs.forEach((im, j) => im.classList.toggle('is-active', j === i));
        peek.classList.add('is-on');
      });
      row.addEventListener('mouseleave', () => peek.classList.remove('is-on'));
    });
    const list = rows[0].parentElement;
    list.addEventListener('mousemove', (e) => { xTo(e.clientX); yTo(e.clientY); });
  }

  /* ------------------------------------------------------------------ *
   * Custom select (hero commission bar)
   * ------------------------------------------------------------------ */
  function initFields() {
    const fields = $$('.field');
    if (!fields.length) return;

    const closeAll = (except) => fields.forEach((f) => {
      if (f === except) return;
      $('.field__pop', f).classList.remove('is-open');
      $('.field__btn', f).setAttribute('aria-expanded', 'false');
    });

    fields.forEach((field) => {
      const btn  = $('.field__btn', field);
      const pop  = $('.field__pop', field);
      const val  = $('.field__v span', field);
      const opts = $$('button', pop);
      let hl = Math.max(0, opts.findIndex(o => o.getAttribute('aria-selected') === 'true'));

      const setHl = (i) => {
        hl = (i + opts.length) % opts.length;
        opts.forEach((o, j) => o.classList.toggle('is-hl', j === hl));
        opts[hl].scrollIntoView({ block: 'nearest' });
      };
      const open = () => {
        closeAll(field);
        pop.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
        setHl(hl);
      };
      const close = (focus) => {
        pop.classList.remove('is-open');
        btn.setAttribute('aria-expanded', 'false');
        if (focus) btn.focus();
      };
      const choose = (i) => {
        opts.forEach((o, j) => o.setAttribute('aria-selected', String(j === i)));
        val.textContent = opts[i].dataset.label || opts[i].textContent.trim();
        field.dataset.value = opts[i].dataset.value || '';
        close(true);
        field.dispatchEvent(new CustomEvent('field:change', { bubbles: true }));
      };

      btn.addEventListener('click', () => pop.classList.contains('is-open') ? close(false) : open());
      opts.forEach((o, i) => o.addEventListener('click', () => choose(i)));

      field.addEventListener('keydown', (e) => {
        const isOpen = pop.classList.contains('is-open');
        if (e.key === 'Escape') { close(true); return; }
        if (!isOpen && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
          if (document.activeElement === btn) { e.preventDefault(); open(); }
          return;
        }
        if (!isOpen) return;
        if (e.key === 'ArrowDown')  { e.preventDefault(); setHl(hl + 1); }
        if (e.key === 'ArrowUp')    { e.preventDefault(); setHl(hl - 1); }
        if (e.key === 'Home')       { e.preventDefault(); setHl(0); }
        if (e.key === 'End')        { e.preventDefault(); setHl(opts.length - 1); }
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(hl); }
      });
    });

    document.addEventListener('click', (e) => { if (!e.target.closest('.field')) closeAll(null); });

    // Segmented control
    const seg = $('.combar__seg');
    if (seg) {
      $$('button', seg).forEach((b) => {
        b.addEventListener('click', () => {
          $$('button', seg).forEach(x => x.setAttribute('aria-pressed', 'false'));
          b.setAttribute('aria-pressed', 'true');
          updateComReadout();
        });
      });
    }

    const readout = $('[data-combar-readout]');
    function updateComReadout() {
      if (!readout) return;
      const seg = $('.combar__seg button[aria-pressed="true"]');
      const type = seg ? seg.dataset.value : 'residential';
      const loc  = $('[data-field="location"]')?.dataset.value || 'all';
      const sty  = $('[data-field="style"]')?.dataset.value || 'all';
      const n = window.AANGAN_PROJECTS
        ? window.AANGAN_PROJECTS.filter(p =>
            (type === 'all' || p.group === type) &&
            (loc === 'all' || p.city.toLowerCase() === loc) &&
            (sty === 'all' || p.style === sty)).length
        : 0;
      readout.textContent = n === 0 ? 'No matches — view all' : `${n} matching ${n === 1 ? 'project' : 'projects'}`;
    }
    document.addEventListener('field:change', updateComReadout);
    updateComReadout();

    const go = $('.combar__go');
    if (go) go.addEventListener('click', () => {
      const seg = $('.combar__seg button[aria-pressed="true"]');
      const p = new URLSearchParams();
      if (seg) p.set('type', seg.dataset.value);
      const loc = $('[data-field="location"]')?.dataset.value;
      const sty = $('[data-field="style"]')?.dataset.value;
      const bud = $('[data-field="budget"]')?.dataset.value;
      if (loc && loc !== 'all') p.set('city', loc);
      if (sty && sty !== 'all') p.set('style', sty);
      if (bud && bud !== 'ask') p.set('budget', bud);
      location.href = 'work.html?' + p.toString();
    });
  }

  /* ------------------------------------------------------------------ *
   * Work page filters
   * ------------------------------------------------------------------ */
  function initFilters() {
    const bar = $('.filters');
    if (!bar) return;
    const chips = $$('.chip', bar);
    const cards = $$('.pcard');
    const empty = $('.empty');
    const count = $('[data-filter-count]');

    const apply = (cat, animate = true) => {
      chips.forEach(c => c.setAttribute('aria-pressed', String(c.dataset.cat === cat)));
      let shown = 0;
      cards.forEach((card) => {
        const match = cat === 'all' || card.dataset.cat === cat;
        if (match) shown++;
        if (!hasGSAP || REDUCED || !animate) {
          card.hidden = !match;
          return;
        }
        if (match) {
          card.hidden = false;
          gsap.fromTo(card, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' });
        } else {
          gsap.to(card, {
            opacity: 0, y: 10, duration: 0.28, ease: 'power2.in',
            onComplete: () => { card.hidden = true; }
          });
        }
      });
      if (empty) empty.hidden = shown > 0;
      if (count) count.textContent = String(shown).padStart(2, '0');
      if (hasGSAP) setTimeout(() => ScrollTrigger.refresh(), 420);
      const url = new URL(location.href);
      cat === 'all' ? url.searchParams.delete('type') : url.searchParams.set('type', cat);
      history.replaceState(null, '', url);
    };

    /* ---- collapse / expand -------------------------------------------- */
    // The control lives in the header now, not inside the bar.
    const toggle = $('.header__filter');
    const current = $('.filters__current');
    const num = $('.filters__num');
    const collapsible = () => window.innerWidth > 720;

    const setOpen = (open) => {
      bar.classList.toggle('is-open', open);
      if (toggle) toggle.setAttribute('aria-expanded', String(open));
    };
    const label = (cat) => {
      const chip = chips.find(c => c.dataset.cat === cat) || chips[0];
      const sup = $('sup', chip);
      return {
        name: (chip.childNodes[0].textContent || '').trim(),
        n: sup ? sup.textContent.trim() : ''
      };
    };
    const sync = (cat) => {
      if (!current) return;
      const { name, n } = label(cat);
      current.textContent = name;
      if (num) num.textContent = n;
    };

    if (toggle) {
      toggle.addEventListener('click', () => setOpen(!bar.classList.contains('is-open')));
      document.addEventListener('click', (e) => {
        if (!collapsible() || !bar.classList.contains('is-open')) return;
        if (!e.target.closest('.filters') && !e.target.closest('.header__filter')) setOpen(false);
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && bar.classList.contains('is-open')) setOpen(false);
      });
      // Open on arrival, then fold away once you start looking at the work.
      let folded = false;
      const foldOnScroll = (y) => {
        if (folded || !collapsible()) return;
        if (y > window.innerHeight * 0.35) { folded = true; setOpen(false); }
      };
      if (lenis) lenis.on('scroll', ({ scroll }) => foldOnScroll(scroll));
      else window.addEventListener('scroll', () => foldOnScroll(window.scrollY), { passive: true });
    }

    chips.forEach(c => c.addEventListener('click', () => {
      apply(c.dataset.cat);
      sync(c.dataset.cat);
      if (collapsible()) setOpen(false);
    }));

    const initial = new URLSearchParams(location.search).get('type');
    if (initial && chips.some(c => c.dataset.cat === initial)) { apply(initial, false); sync(initial); }
    else {
      if (count) count.textContent = String(cards.length).padStart(2, '0');
      sync('all');
    }
  }

  /* ------------------------------------------------------------------ *
   * Quote carousel
   * ------------------------------------------------------------------ */
  function initQuotes() {
    const wrap = $('.quotes');
    if (!wrap) return;
    const items = $$('[data-quote]', wrap);
    if (items.length < 2) return;
    const prev = $('[data-q="prev"]', wrap);
    const next = $('[data-q="next"]', wrap);
    const now  = $('[data-q-now]', wrap);
    let i = 0;

    const show = (n, dir) => {
      const from = items[i];
      i = (n + items.length) % items.length;
      const to = items[i];
      if (now) now.textContent = String(i + 1).padStart(2, '0');
      if (!hasGSAP || REDUCED) {
        items.forEach((it, j) => { it.hidden = j !== i; });
        return;
      }
      gsap.to(from, {
        opacity: 0, y: -12 * dir, duration: 0.28, ease: 'power2.in',
        onComplete: () => {
          from.hidden = true;
          to.hidden = false;
          gsap.fromTo(to, { opacity: 0, y: 14 * dir }, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out' });
        }
      });
    };
    items.forEach((it, j) => { it.hidden = j !== 0; });
    if (now) now.textContent = '01';
    prev?.addEventListener('click', () => show(i - 1, -1));
    next?.addEventListener('click', () => show(i + 1, 1));

    // Swipe between quotes on touch
    let x0 = null, y0 = null;
    wrap.addEventListener('touchstart', (e) => {
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
    }, { passive: true });
    wrap.addEventListener('touchend', (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      const dy = e.changedTouches[0].clientY - y0;
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.6) show(i + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
      x0 = y0 = null;
    }, { passive: true });
  }

  /* ------------------------------------------------------------------ *
   * FAQ accordion
   * ------------------------------------------------------------------ */
  function initFaq() {
    $$('.faq__i').forEach((item) => {
      const q = $('.faq__q', item);
      const a = $('.faq__a', item);
      if (!q || !a) return;
      q.setAttribute('aria-expanded', 'false');
      q.addEventListener('click', () => {
        const open = !item.classList.contains('is-open');
        item.classList.toggle('is-open', open);
        q.setAttribute('aria-expanded', String(open));
        if (!hasGSAP || REDUCED) { a.style.height = open ? 'auto' : '0'; return; }
        gsap.killTweensOf(a);
        if (open) {
          // measure the panel while it is still clipped, then animate to that height
          const target = a.scrollHeight;
          gsap.fromTo(a, { height: a.offsetHeight }, {
            height: target,
            duration: 0.55,
            ease: 'expo.out',
            onComplete: () => { a.style.height = 'auto'; ScrollTrigger.refresh(); }
          });
        } else {
          gsap.fromTo(a, { height: a.offsetHeight }, {
            height: 0,
            duration: 0.42,
            ease: 'expo.inOut',
            onComplete: () => ScrollTrigger.refresh()
          });
        }
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * Enquiry form (client-side only — nothing is transmitted)
   * ------------------------------------------------------------------ */
  function initForm() {
    const form = $('.form');
    if (!form) return;

    $$('.pickers', form).forEach((group) => {
      $$('.pick', group).forEach((p) => {
        p.addEventListener('click', () => {
          const multi = group.dataset.multi === 'true';
          if (!multi) $$('.pick', group).forEach(x => x.setAttribute('aria-pressed', 'false'));
          p.setAttribute('aria-pressed', multi ? String(p.getAttribute('aria-pressed') !== 'true') : 'true');
        });
      });
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      let ok = true;
      $$('[data-required]', form).forEach((input) => {
        const fld = input.closest('.fld');
        const val = input.value.trim();
        const bad = !val || (input.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val));
        fld.classList.toggle('is-bad', bad);
        if (bad && ok) { input.focus(); ok = false; }
      });
      if (!ok) return;
      form.classList.add('is-sent');
      if (hasGSAP && !REDUCED) {
        gsap.from($('.form__done', form), { opacity: 0, y: 20, duration: 0.7 });
      }
      if (lenis) lenis.scrollTo(form, { offset: -140, duration: 1 });
    });

    $$('.fld input, .fld textarea', form).forEach((i) => {
      i.addEventListener('input', () => i.closest('.fld').classList.remove('is-bad'));
    });
  }

  /* ------------------------------------------------------------------ *
   * Footer word — subtle scroll drift
   * ------------------------------------------------------------------ */
  function initFooterWord() {
    const w = $('.footer__word');
    if (!w || !hasGSAP || REDUCED) return;
    gsap.fromTo(w, { xPercent: -4 }, {
      xPercent: 4, ease: 'none',
      scrollTrigger: { trigger: '.footer', start: 'top bottom', end: 'bottom bottom', scrub: true }
    });
  }

  /* ------------------------------------------------------------------ *
   * Current year
   * ------------------------------------------------------------------ */
  function initYear() {
    $$('[data-year]').forEach(e => { e.textContent = new Date().getFullYear(); });
  }

  /* ------------------------------------------------------------------ *
   * Utils
   * ------------------------------------------------------------------ */
  function debounce(fn, ms) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  }

  /* ------------------------------------------------------------------ *
   * Boot
   * ------------------------------------------------------------------ */
  let booted = false;

  function applyFullMode() {
    const css = document.createElement('style');
    css.textContent = `
      .hero { height: 900px !important; min-height: 0 !important; }
      .csh { height: 760px !important; min-height: 0 !important; }
      .hscroll { overflow: hidden !important; }
      .hscroll__viewport { height: auto !important; padding-block: 5rem !important; }
      .hscroll__track { flex-wrap: wrap !important; gap: 2rem !important; }
      @media (min-width: 900px) {
        .hcard, .hcard--wide, .hcard--tall, .hscroll__lead { width: calc(33.333% - 1.4rem) !important; }
      }
      @media (max-width: 899px) {
        .hcard, .hcard--wide, .hcard--tall, .hscroll__lead { width: 100% !important; }
      }
      .process__stick, .filters { position: static !important; }
      .cursor, .cue { display: none !important; }
    `;
    document.head.appendChild(css);
    // ?off=N shifts the page up by N px so tall pages can be captured in halves
    const off = parseInt(QS.get('off') || '0', 10);
    if (off) document.body.style.marginTop = (-off) + 'px';
  }

  function boot() {
    document.documentElement.classList.add('no-fv');
    if (FULL) applyFullMode();
    initScroll();
    initCurtain();
    initCursor();
    initHeader();
    initMenu();
    initMarquee();
    initYear();
    initFields();
    initFilters();
    initQuotes();
    initFaq();
    initForm();

    const start = (afterLoader) => {
      initType(afterLoader);
      initParallax();
      initManifesto();
      initHScroll();
      initCounters();
      initMagnetic();
      initPeek();
      initFooterWord();
      initMobileBar();
      if (hasGSAP) {
        requestAnimationFrame(() => ScrollTrigger.refresh());
        window.addEventListener('load', () => ScrollTrigger.refresh());
      }
      if (SNAP && hasGSAP) {
        const y = parseInt(QS.get('y') || '0', 10);
        const place = () => {
          ScrollTrigger.refresh();
          if (y) { window.scrollTo(0, y + 1); window.scrollTo(0, y); }
          ScrollTrigger.update();
        };
        const repaint = (n) => {
          if (n <= 0) return;
          document.documentElement.style.setProperty('--snap-tick', String(n));
          requestAnimationFrame(() => repaint(n - 1));
        };
        place();
        [60, 250, 600, 1200, 2000].forEach(ms => setTimeout(() => { place(); repaint(6); }, ms));
        window.addEventListener('load', () => setTimeout(() => { place(); repaint(12); }, 80));
      }
    };

    const once = () => {
      if (booted) return;
      booted = true;
      initLoader(() => start(true));
    };
    const fonts = document.fonts ? document.fonts.ready : Promise.resolve();
    fonts.then(once);
    setTimeout(once, 2500); // safety net if font loading stalls
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
