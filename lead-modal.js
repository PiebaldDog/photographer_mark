/* ============================================================================
   МОДАЛЬНОЕ ОКНО С ФОРМОЙ ЗАЯВКИ — переносимый блок
   ----------------------------------------------------------------------------
   Подключение: <script src="lead-modal.js" defer></script> перед </body>

   Настраивать скрипт НЕ нужно. Всё читается из разметки:

     .lm[data-lm-timeout="12000"]   через сколько мс показать аварийную
                                   ссылку, если форма не пришла
     iframe[data-src]               ссылка на форму (без ?iframe=1 нельзя)
     [data-open-modal]              кнопки, открывающие форму
     [data-lm-close]                крестик и подложка
     .lm__fallback > a              href синхронизируется сам из data-src

   Классы: .lm, .lm__overlay, .lm__dialog, .lm__head, .lm__badge, .lm__title,
           .lm__subtitle, .lm__body, .lm-frame, .lm-frame__loader,
           .lm-frame__spinner, .lm__note, .lm__fallback, .lm__close
           (is-open, is-loaded, is-failed)

   Блок БЕЗОПАСЕН при подключении дважды — второй запуск ничего не делает.
   ============================================================================ */
(function () {
  'use strict';

  if (window.__lmBound) return;          // защита от двойного подключения
  window.__lmBound = true;

  /* ------------------------------------------------------------------
     Блокировка прокрутки. Счётчик общий для всей страницы, поэтому
     модалка и мобильное меню не мешают друг другу: кто последний
     закрылся — тот и вернул прокрутку. Мобильное меню использует
     ровно эти же две функции.
     ------------------------------------------------------------------ */
  function lockScroll() {
    window.__scrollLocks = (window.__scrollLocks || 0) + 1;
    document.documentElement.style.overflow = 'hidden';
  }
  function unlockScroll() {
    window.__scrollLocks = Math.max(0, (window.__scrollLocks || 0) - 1);
    if (!window.__scrollLocks) document.documentElement.style.overflow = '';
  }
  window.LMLock = { lock: lockScroll, unlock: unlockScroll };

  /* ---------------------------------------------------------------- поиск */
  var modal = document.querySelector('.lm') || document.getElementById('leadModal');
  if (!modal) return;

  var frame = modal.querySelector('.lm-frame') || modal.getElementById('lmFrame');
  var iframe = frame ? frame.querySelector('iframe') : null;
  var fallback = modal.querySelector('.lm__fallback') || document.getElementById('lmFallback');
  var fallbackLink = fallback ? fallback.querySelector('a') : null;

  var timeoutMs = parseInt(modal.getAttribute('data-lm-timeout'), 10) || 12000;
  var lastFocused = null;
  var formStarted = false;

  // Аварийная ссылка всегда ведёт на ту же форму, что и iframe —
  // URL достаточно вписать один раз, в data-src.
  var formUrl = iframe ? (iframe.getAttribute('data-src') || '') : '';
  if (formUrl && fallbackLink && !fallbackLink.getAttribute('data-manual')) {
    fallbackLink.setAttribute('href', formUrl);
  }

  /* ------------------------------------------------------------ загрузка */
  /* Обработчики вешаем ДО установки src. Иначе при попадании в кэш
     событие load успевает пролететь мимо и спиннер не гаснет. */
  function loadForm() {
    if (formStarted || !iframe) return;
    formStarted = true;

    function markLoaded() {
      if (!frame) return;
      frame.classList.add('is-loaded');
      frame.classList.remove('is-failed');
      if (fallback) fallback.hidden = true;
    }
    function markFailed() {
      if (!frame) return;
      frame.classList.add('is-failed');
      if (fallback) fallback.hidden = false;
    }

    iframe.addEventListener('load', markLoaded);
    iframe.addEventListener('error', markFailed);

    // Страховка: если за timeoutMs ничего не пришло — убираем спиннер
    // и показываем ссылку, чтобы посетитель не ушёл молча
    window.setTimeout(function () {
      if (!frame.classList.contains('is-loaded')) markFailed();
    }, timeoutMs);

    var src = iframe.getAttribute('data-src');
    if (src) iframe.src = src;
  }

  /* ------------------------------------------------------- открыть/закрыть */
  function open() {
    if (modal.classList.contains('is-open')) return;
    lastFocused = document.activeElement;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    lockScroll();
    loadForm();
    var closeBtn = modal.querySelector('.lm__close');
    if (closeBtn) closeBtn.focus();
  }

  function close() {
    if (!modal.classList.contains('is-open')) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    unlockScroll();
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  /* ---------------------------------------------------------------- события */
  // data-open-modal — открыть, data-lm-close — закрыть.
  // Слушатель на документе, поэтому работает и с кнопками,
  // которые появятся позже.
  document.addEventListener('click', function (e) {
    var opener = e.target.closest('[data-open-modal], [data-lm-open]');
    if (opener) {
      e.preventDefault();      // href="#..." не должен прыгать по странице
      open();
      return;
    }
    if (e.target.closest('[data-lm-close]')) close();
  });

  // Escape закрывает. Внутри iframe Escape не доходит до нас —
  // это ограничение браузера, лечится только рамкой вокруг.
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') close();

    // Карточка тарифа может быть <div role="button" data-open-modal> —
    // на них нужен Enter/Пробел, иначе недоступны с клавиатуры
    if ((e.key === 'Enter' || e.key === ' ') && document.activeElement) {
      var card = document.activeElement.closest('[data-open-modal]');
      var isNative = card && /^(A|BUTTON|INPUT)$/.test(card.tagName);
      if (card && !isNative) {
        e.preventDefault();
        open();
      }
    }
  });
})();
