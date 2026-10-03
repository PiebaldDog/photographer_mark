/* =============================================================
   Марк Вернер — лендинг фотографа
   Vanilla JS: reveal, header, nav, slider, accordion, progress
   ============================================================= */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 1. REVEAL ON SCROLL ---------- */
  // Fail-safe: reveal state is applied only when JS is active (html.js, set in <head>),
  // so a JS failure can never leave the page blank.
  var revealables = [].slice.call(document.querySelectorAll('.reveal'));

  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealables.forEach(function (el) { el.classList.add('is-visible'); });
  } else {
    var pending = revealables.slice();

    function reveal(el) {
      el.classList.add('is-visible');
      var i = pending.indexOf(el);
      if (i !== -1) pending.splice(i, 1);
    }

    var revealObserver = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          reveal(entry.target);
          obs.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -9% 0px', threshold: 0.08 });

    revealables.forEach(function (el) { revealObserver.observe(el); });

    // Manual sweep as a safety net: IntersectionObserver callbacks are not delivered
    // reliably in hidden/occluded documents, which would leave content invisible.
    var sweepQueued = false;
    function sweep() {
      sweepQueued = false;
      if (!pending.length) return;
      var limit = window.innerHeight * 0.92;
      for (var i = pending.length - 1; i >= 0; i--) {
        var r = pending[i].getBoundingClientRect();
        if (r.top < limit && r.bottom > 0) reveal(pending[i]);
      }
    }
    function queueSweep() {
      if (sweepQueued) return;
      sweepQueued = true;
      window.requestAnimationFrame(sweep);
    }

    window.addEventListener('scroll', queueSweep, { passive: true });
    window.addEventListener('resize', queueSweep, { passive: true });
    document.addEventListener('visibilitychange', queueSweep);
    // synchronous first pass so above-the-fold content is never briefly hidden
    sweep();
    queueSweep();
  }

  /* ---------- 2. HEADER STATE + SCROLL PROGRESS ---------- */
  var header = document.querySelector('[data-header]');
  var progressBar = document.querySelector('[data-progress]');
  var ticking = false;

  function onScroll() {
    var y = window.pageYOffset || document.documentElement.scrollTop;

    if (header) header.classList.toggle('is-scrolled', y > 40);

    if (progressBar) {
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      var ratio = docHeight > 0 ? y / docHeight : 0;
      progressBar.style.width = Math.min(100, Math.max(0, ratio * 100)) + '%';
    }

    ticking = false;
  }

  window.addEventListener('scroll', function () {
    if (!ticking) { window.requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });
  onScroll();

  /* ---------- 3. MOBILE NAV ---------- */
  var navToggle = document.querySelector('[data-nav-toggle]');
  var navLinks = document.querySelectorAll('[data-nav] a');

  function setNav(open) {
    document.body.classList.toggle('nav-open', open);
    if (navToggle) {
      navToggle.setAttribute('aria-expanded', String(open));
      navToggle.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    }
  }

  if (navToggle) {
    navToggle.addEventListener('click', function () {
      setNav(!document.body.classList.contains('nav-open'));
    });
  }

  navLinks.forEach(function (link) {
    link.addEventListener('click', function () { setNav(false); });
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && document.body.classList.contains('nav-open')) setNav(false);
  });

  // Поворот экрана или смена ширины на планшетную/десктопную.
  // Мобильная панель живёт только до 900px (@media), а правило
  // body.nav-open{overflow:hidden} — без медиазапроса. Если в момент
  // поворота меню было открыто, класс остаётся на body, панель уходит в
  // строку шапки (position:static) и становится невидимой, а страница
  // остаётся с overflow:hidden — прокрутка пропадает совсем, пока не
  // перезагрузишь. Проверено замером на 1280px. Поэтому явно закрываем.
  // Именно слушатель resize, а не matchMedia(...).change: у медиазапроса
  // пересчёт привязан к шагу отрисовки, и в свёрнутой вкладке событие не
  // приходит вовсе. На живом экране разницы нет, а проверять можно.
  window.addEventListener('resize', function () {
    if (window.innerWidth > 900) setNav(false);
  });

  /* ---------- 4. SMOOTH ANCHOR SCROLL (header offset) ---------- */
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      // Кнопки с data-open-modal открывают форму. Этот обработчик висит на
      // самом элементе, а модальный — на document, поэтому без guard
      // страница сначала уехала бы к #contacts, и только потом открылось окно.
      if (link.hasAttribute('data-open-modal')) {
        e.preventDefault();
        return;
      }

      var id = link.getAttribute('href');
      if (!id || id === '#') return;

      var target = document.querySelector(id);
      if (!target) return;

      e.preventDefault();

      var headerH = header ? header.offsetHeight : 0;
      // Ловим большие отступы у секций: при якорном переходе из меню
      // лучше прокрутить чуть ниже начала секции, чтобы заголовок не
      // «прилипал» к краю паддинга. Берём 40% от padding-top секции,
      // но не больше 64px.
      var extra = 0;
      if (target && window.getComputedStyle) {
        var pts = parseFloat(window.getComputedStyle(target).paddingTop) || 0;
        extra = Math.min(pts * 0.6, 96);
      }
      var top = target.getBoundingClientRect().top + window.pageYOffset - headerH + extra;

      window.scrollTo({
        top: Math.max(0, top),
        behavior: reduceMotion ? 'auto' : 'smooth'
      });

      if (history.replaceState) history.replaceState(null, '', id);
    });
  });

  /* ---------- 5. TESTIMONIALS SLIDER ---------- */
  document.querySelectorAll('[data-slider]').forEach(function (root) {
    var track = root.querySelector('[data-track]');
    var slides = Array.prototype.slice.call(root.querySelectorAll('.slide'));
    var prevBtn = root.querySelector('[data-prev]');
    var nextBtn = root.querySelector('[data-next]');
    var currentEl = root.querySelector('[data-current]');
    var totalEl = root.querySelector('[data-total]');
    var dotsBox = root.querySelector('[data-dots]');

    if (!track || slides.length === 0) return;

    var index = 0;

    if (totalEl) totalEl.textContent = pad(slides.length);

    // dots
    var dots = slides.map(function (_, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-label', 'Отзыв ' + (i + 1));
      b.addEventListener('click', function () { go(i); });
      if (dotsBox) dotsBox.appendChild(b);
      return b;
    });

    function pad(n) { return n < 10 ? '0' + n : String(n); }

    function go(i) {
      index = (i + slides.length) % slides.length;
      track.style.transform = 'translate3d(' + (-index * 100) + '%, 0, 0)';

      if (currentEl) currentEl.textContent = pad(index + 1);

      dots.forEach(function (d, di) {
        d.classList.toggle('is-active', di === index);
        d.setAttribute('aria-selected', String(di === index));
      });

      slides.forEach(function (s, si) {
        // keeps off-screen slides out of the tab order
        if (si !== index) s.setAttribute('aria-hidden', 'true');
        else s.removeAttribute('aria-hidden');
      });
    }

    if (prevBtn) prevBtn.addEventListener('click', function () { go(index - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { go(index + 1); });

    // keyboard
    root.setAttribute('tabindex', '0');
    root.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
    });

    // swipe / drag
    var startX = 0, delta = 0, dragging = false;

    root.addEventListener('pointerdown', function (e) {
      if (e.target.closest('button')) return;
      dragging = true;
      startX = e.clientX;
      delta = 0;
      track.style.transition = 'none';
    });

    root.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      delta = e.clientX - startX;
      var pct = (delta / root.querySelector('[data-viewport]').offsetWidth) * 100;
      track.style.transform = 'translate3d(' + (-index * 100 + pct) + '%, 0, 0)';
    });

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      track.style.transition = '';
      var threshold = 60;
      if (delta < -threshold) go(index + 1);
      else if (delta > threshold) go(index - 1);
      else go(index);
    }

    root.addEventListener('pointerup', endDrag);
    root.addEventListener('pointercancel', endDrag);
    root.addEventListener('pointerleave', endDrag);

    // touch fallback
    var touchX = null;
    root.addEventListener('touchstart', function (e) { touchX = e.touches[0].clientX; }, { passive: true });
    root.addEventListener('touchend', function (e) {
      if (touchX === null) return;
      var dx = e.changedTouches[0].clientX - touchX;
      if (dx < -50) go(index + 1);
      else if (dx > 50) go(index - 1);
      touchX = null;
    });

    go(0);
  });

  /* ---------- 6. FAQ ACCORDION ---------- */
  document.querySelectorAll('[data-acc]').forEach(function (acc) {
    var buttons = Array.prototype.slice.call(acc.querySelectorAll('[data-acc-btn]'));

    function close(btn) {
      var panel = document.getElementById(btn.getAttribute('aria-controls'));
      if (!panel) return;
      btn.setAttribute('aria-expanded', 'false');
      panel.classList.remove('is-open');
      panel.style.height = panel.scrollHeight + 'px';
      // force reflow then collapse
      void panel.offsetHeight;
      panel.style.height = '0px';
    }

    function open(btn) {
      var panel = document.getElementById(btn.getAttribute('aria-controls'));
      if (!panel) return;
      btn.setAttribute('aria-expanded', 'true');
      panel.classList.add('is-open');
      panel.style.height = panel.scrollHeight + 'px';
      panel.addEventListener('transitionend', function handler(ev) {
        if (ev.propertyName !== 'height') return;
        if (btn.getAttribute('aria-expanded') === 'true') panel.style.height = 'auto';
        panel.removeEventListener('transitionend', handler);
      });
    }

    buttons.forEach(function (btn) {
      var panel = document.getElementById(btn.getAttribute('aria-controls'));
      if (panel) panel.style.height = '0px';

      btn.addEventListener('click', function () {
        var isOpen = btn.getAttribute('aria-expanded') === 'true';
        if (isOpen) {
          close(btn);
        } else {
          buttons.forEach(function (other) {
            if (other !== btn && other.getAttribute('aria-expanded') === 'true') close(other);
          });
          open(btn);
        }
      });
    });

    // keep open panels correct on resize
    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        buttons.forEach(function (btn) {
          if (btn.getAttribute('aria-expanded') !== 'true') return;
          var panel = document.getElementById(btn.getAttribute('aria-controls'));
          if (panel) panel.style.height = 'auto';
        });
      }, 160);
    });
  });

  /* ---------- 7. MOBILE STICKY CTA ---------- */
  var mcta = document.querySelector('[data-mcta]');
  var footer = document.querySelector('.footer');

  if (mcta && footer && 'IntersectionObserver' in window) {
    var footerVisible = false;

    var footerObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        footerVisible = entry.isIntersecting;
        updateMcta();
      });
    }, { threshold: 0.06 });

    footerObs.observe(footer);

    function updateMcta() {
      var y = window.pageYOffset || document.documentElement.scrollTop;
      var shouldShow = y > window.innerHeight * 0.9 && !footerVisible;
      mcta.classList.toggle('is-visible', shouldShow);
    }

    window.addEventListener('scroll', function () {
      window.requestAnimationFrame(updateMcta);
    }, { passive: true });

    updateMcta();
  }
})();
