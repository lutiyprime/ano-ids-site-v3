/* АНО «ИДС» — интерактив и motion. Без зависимостей. */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(pointer: fine)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return [].slice.call((c || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var store = {
    get: function (k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }
  };
  function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function hexA(hex, a) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h.replace(/./g, '$&$&');
    var n = parseInt(h, 16);
    return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  var scrollHooks = []; // компоненты ниже добавляют сюда обработчики прокрутки и смены размера

  /* ——— Шторка: вход на страницу и переходы между страницами ———
     На шторке полный логотип; знак делает оборот за SPIN мс от клика по ссылке.
     Новая страница продолжает тот же оборот (html.tr, см. scripts/build.mjs) и поднимает шторку, когда он заканчивается. */
  var SPIN = 1100; // совпадает с --spin в site.css
  var root = document.documentElement;
  var curtain = $('.curtain');
  var arrived = root.classList.contains('tr') && !!window.IDS_TR;
  var firstVisit = !store.get('ids-seen');
  var holdFor = arrived ? Math.max(0, SPIN - 120 - (Date.now() - window.IDS_TR)) : 0;
  var startDelay = reduce ? 0 : arrived ? holdFor + 300 : (firstVisit ? 1500 : 380);
  store.set('ids-seen', '1');

  function lift() {
    curtain.classList.add('lift');
    setTimeout(function () { root.classList.remove('tr'); }, 900);
  }
  function liftCurtain() {
    if (!curtain) return;
    if (reduce) { curtain.style.display = 'none'; return; }
    curtain.classList.remove('drop', 'go');
    if (arrived) setTimeout(lift, holdFor);
    else if (firstVisit) {
      curtain.classList.add('intro');
      setTimeout(lift, 1250);
    } else {
      requestAnimationFrame(function () { requestAnimationFrame(lift); });
    }
  }
  liftCurtain();

  window.addEventListener('pageshow', function (e) {
    if (e.persisted && curtain) {
      store.set('ids-tr', '');
      root.classList.remove('tr');
      curtain.classList.remove('drop', 'go', 'intro');
      curtain.classList.add('lift');
    }
  });

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || reduce || !curtain) return;
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target === '_blank' || a.hasAttribute('download')) return;
    var href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#' || /^(mailto|tel):/.test(href)) return;
    var url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname && url.hash) return;
    e.preventDefault();
    closeMenu(true);
    store.set('ids-tr', String(Date.now()));
    root.classList.remove('tr');
    curtain.classList.remove('lift', 'intro');
    curtain.classList.add('drop');
    void curtain.offsetWidth;
    curtain.classList.add('go');
    setTimeout(function () { location.href = url.href; }, 520);
  });

  /* ——— Шапка: цвет по секции, скрытие при прокрутке, прогресс ——— */
  var header = $('[data-header]');
  var themed = $$('[data-theme]');
  var bar = $('.progress span');
  var lastY = window.scrollY;
  var menuOpen = false;

  function updateHeader() {
    var y = window.scrollY;
    if (header) {
      header.classList.toggle('is-scrolled', y > 10);
      if (!menuOpen) {
        if (y > lastY + 4 && y > 320) header.classList.add('is-hidden');
        else if (y < lastY - 4 || y < 320) header.classList.remove('is-hidden');
      }
      var probe = header.offsetHeight / 2, on = 'dark';
      if (!menuOpen) {
        for (var i = 0; i < themed.length; i++) {
          var r = themed[i].getBoundingClientRect();
          if (r.top <= probe && r.bottom > probe) { on = themed[i].getAttribute('data-theme'); break; }
        }
      }
      header.setAttribute('data-on', on);
    }
    if (bar) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = 'scaleX(' + (max > 0 ? clamp(y / max, 0, 1) : 0) + ')';
    }
    lastY = y;
  }

  /* ——— Мобильное меню ——— */
  var burger = $('.burger');
  var menu = $('#menu');
  function openMenu() {
    if (!menu) return;
    menuOpen = true;
    menu.hidden = false;
    document.body.classList.add('menu-open');
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Закрыть меню');
    header.classList.remove('is-hidden');
    requestAnimationFrame(function () { menu.classList.add('open'); });
    updateHeader();
  }
  function closeMenu(instant) {
    if (!menu || !menuOpen) return;
    menuOpen = false;
    menu.classList.remove('open');
    document.body.classList.remove('menu-open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Открыть меню');
    setTimeout(function () { if (!menuOpen) menu.hidden = true; }, instant ? 0 : 700);
    updateHeader();
  }
  if (burger) burger.addEventListener('click', function () { menuOpen ? closeMenu() : openMenu(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });

  /* ——— Разбивка заголовков на слова (маска построчно) ——— */
  function wrapWords(el, cls, inner) {
    var words = [];
    (function walk(node) {
      [].slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/([ \t\n]+)/).forEach(function (p) {
            if (!p) return;
            if (/^[ \t\n]+$/.test(p)) { frag.appendChild(document.createTextNode(' ')); return; }
            var w = document.createElement('span');
            w.className = cls;
            if (inner) {
              var wi = document.createElement('span');
              wi.className = inner;
              wi.textContent = p;
              w.appendChild(wi);
            } else w.textContent = p;
            frag.appendChild(w);
            words.push(w);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
      });
    })(el);
    return words;
  }

  function staggerByLine(words, base) {
    var lines = [], lineOf = [];
    words.forEach(function (w) {
      var t = Math.round(w.getBoundingClientRect().top);
      var idx = -1;
      for (var i = 0; i < lines.length; i++) if (Math.abs(lines[i] - t) < 6) { idx = i; break; }
      if (idx < 0) { lines.push(t); idx = lines.length - 1; }
      lineOf.push(idx);
    });
    var count = {};
    words.forEach(function (w, i) {
      var l = lineOf[i];
      count[l] = (count[l] || 0) + 1;
      w.firstChild.style.setProperty('--d', (base + l * 0.11 + (count[l] - 1) * 0.03).toFixed(3) + 's');
    });
  }

  var splits = $$('[data-split]');
  splits.forEach(function (el) {
    if (reduce) return;
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    var words = wrapWords(el, 'w', 'wi');
    words.forEach(function (w) { w.setAttribute('aria-hidden', 'true'); });
    el._words = words;
  });
  function restagger() {
    splits.forEach(function (el) {
      if (el._words) staggerByLine(el._words, parseFloat(el.style.getPropertyValue('--d')) || 0);
    });
  }
  restagger();

  /* ——— Рамка выделения в CTA облегает фактические строки заголовка ——— */
  var frames = $$('[data-frame]');
  function fitFrames() {
    frames.forEach(function (f) {
      var h = f.firstElementChild;
      if (!h) return;
      f.style.width = '';
      var rg = document.createRange(), rs, l = Infinity, r = -Infinity;
      rg.selectNodeContents(h);
      rs = rg.getClientRects();
      for (var i = 0; i < rs.length; i++) if (rs[i].width) { l = Math.min(l, rs[i].left); r = Math.max(r, rs[i].right); }
      if (r > l) f.style.width = Math.ceil(r - f.getBoundingClientRect().left + 2) + 'px';
    });
  }
  if (frames.length) {
    fitFrames();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitFrames);
    scrollHooks.push(function (resized) { if (resized) fitFrames(); });
  }

  /* ——— Появление при прокрутке ——— */
  function startReveals() {
    var targets = $$('[data-reveal],[data-split],[data-line],[data-frame],.hl,.ico');
    if (reduce || !('IntersectionObserver' in window)) {
      targets.forEach(function (el) { el.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    targets.forEach(function (el) { io.observe(el); });
  }
  setTimeout(startReveals, startDelay);

  /* ——— Текст, который «проявляется» по мере прокрутки ——— */
  var fills = $$('[data-fill]').map(function (el) {
    return { el: el, words: reduce ? [] : wrapWords(el, 'fw') };
  });
  function updateFills() {
    var vh = window.innerHeight;
    fills.forEach(function (f) {
      if (!f.words.length) return;
      var r = f.el.getBoundingClientRect();
      var p = clamp((vh * 0.88 - r.top) / (r.height + vh * 0.3), 0, 1);
      var n = Math.round(p * f.words.length);
      for (var i = 0; i < f.words.length; i++) f.words[i].classList.toggle('on', i < n);
    });
  }

  /* ——— Принцип работы: закреплённый сценарий из четырёх шагов ——— */
  var steps = $('[data-steps]');
  var stepItems = steps ? $$('[data-step]', steps) : [];
  var stepNum = steps ? $('[data-step-num]', steps) : null;
  var rail = steps ? $('.process-rail', steps) : null;
  var curStep = 0;
  function pinCheck() {
    if (!steps) return;
    var pin = !reduce && window.innerWidth > 980 && window.innerHeight > 620;
    steps.classList.toggle('is-pinned', pin);
    if (!pin) stepItems.forEach(function (li) { li.classList.add('on'); });
  }
  function setStep(i) {
    if (i === curStep) return;
    var dir = i > curStep ? 1 : -1;
    curStep = i;
    stepItems.forEach(function (li, k) { li.classList.toggle('on', k === i); });
    if (stepNum) {
      stepNum.textContent = '0' + (i + 1);
      if (stepNum.animate) stepNum.animate([{ transform: 'translateY(' + (dir * 100) + '%)' }, { transform: 'none' }], { duration: 700, easing: 'cubic-bezier(.2,.7,0,1)' });
    }
  }
  function updateSteps() {
    if (!steps || !steps.classList.contains('is-pinned')) return;
    var r = steps.getBoundingClientRect();
    var total = steps.offsetHeight - window.innerHeight;
    var p = clamp(-r.top / total, 0, 1);
    setStep(Math.min(stepItems.length - 1, Math.floor(p * stepItems.length * 0.999)));
    if (rail) rail.style.setProperty('--p', p.toFixed(4));
  }
  pinCheck();
  if (steps && steps.classList.contains('is-pinned')) stepItems.forEach(function (li, k) { li.classList.toggle('on', k === 0); });

  /* ——— Параллакс крупных номеров ——— */
  var parallax = $$('[data-parallax]');
  var spins = $$('[data-spin]');
  function updateParallax() {
    if (reduce) return;
    spins.forEach(function (el) { el.style.transform = 'rotate(' + (window.scrollY * -0.06).toFixed(2) + 'deg)'; });
    parallax.forEach(function (el) {
      el.style.transform = 'translate3d(0,' + (window.scrollY * 0.18).toFixed(1) + 'px,0)';
    });
  }

  /* ——— Цикл прокрутки ——— */
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      updateHeader(); updateFills(); updateSteps(); updateParallax();
      scrollHooks.forEach(function (fn) { fn(); });
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () { pinCheck(); restagger(); scrollHooks.forEach(function (fn) { fn(true); }); onScroll(); });
  onScroll();

  /* ——— Реестровые числа «набираются» ——— */
  function scramble(el) {
    var final = el.textContent, len = final.length, start = performance.now(), dur = 900;
    (function frame(now) {
      var t = clamp((now - start) / dur, 0, 1), out = '';
      for (var i = 0; i < len; i++) {
        var ch = final.charAt(i);
        if (!/\d/.test(ch) || t * len * 1.15 > i + 1) out += ch;
        else out += Math.floor(Math.random() * 10);
      }
      el.textContent = out;
      if (t < 1) requestAnimationFrame(frame); else el.textContent = final;
    })(start);
  }
  if (!reduce && 'IntersectionObserver' in window) {
    var so = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { so.unobserve(e.target); setTimeout(function () { scramble(e.target); }, 250); }
      });
    }, { threshold: 0.6 });
    $$('[data-scramble]').forEach(function (el) { so.observe(el); });
  }

  /* ——— Магнитные кнопки ——— */
  if (finePointer && !reduce) {
    $$('[data-magnetic]').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var dx = (e.clientX - r.left - r.width / 2) / (r.width / 2);
        var dy = (e.clientY - r.top - r.height / 2) / (r.height / 2);
        el.style.transition = 'transform .25s cubic-bezier(.2,.7,0,1), color .45s, border-color .45s';
        el.style.transform = 'translate(' + (dx * 6).toFixed(1) + 'px,' + (dy * 5).toFixed(1) + 'px)';
      });
      el.addEventListener('pointerleave', function () {
        el.style.transition = 'transform .7s cubic-bezier(.2,.7,0,1), color .45s, border-color .45s';
        el.style.transform = '';
      });
    });
  }

  /* ——— Поле наблюдения (hero): сетка точек и рамка выделения ——— */
  function Field(canvas) {
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var W = 0, H = 0, gap = 26, running = false, visible = true;
    var target = null, lastMove = -1e9;
    var fx = 0, fy = 0, fw = 150, fh = 104;
    // цвета берём из темы секции: на светлом фоне точки тёмные, на тёмном — светлые
    var cs = getComputedStyle(canvas);
    var fg = cs.getPropertyValue('--fg').trim() || cssVar('--paper') || '#F5F2EC';
    var ac = cs.getPropertyValue('--acc').trim() || cssVar('--accent') || '#00B0B2';
    if (fg.charAt(0) !== '#') fg = '#F5F2EC';
    if (ac.charAt(0) !== '#') ac = '#00B0B2';
    var mono = cssVar('--mono') || 'monospace';

    function size() {
      var r = canvas.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      gap = W < 680 ? 22 : 26;
      if (!fx) { fx = W * 0.72; fy = H * 0.38; }
    }
    function draw(time) {
      var t = time / 1000;
      var auto = time - lastMove > 2600 || !target;
      var tx, ty;
      if (auto) {
        tx = W * (0.68 + 0.18 * Math.sin(t * 0.21)) ;
        ty = H * (0.42 + 0.2 * Math.sin(t * 0.33 + 1.2));
        if (W < 680) { tx = W * (0.5 + 0.3 * Math.sin(t * 0.21)); ty = H * (0.62 + 0.12 * Math.sin(t * 0.33)); }
      } else { tx = target.x; ty = target.y; }
      fx += (tx - fx) * (auto ? 0.02 : 0.08);
      fy += (ty - fy) * (auto ? 0.02 : 0.08);
      var bw = 150 + 26 * Math.sin(t * 0.7), bh = 104 + 16 * Math.sin(t * 0.9 + 0.6);
      fw += (bw - fw) * 0.1; fh += (bh - fh) * 0.1;

      ctx.clearRect(0, 0, W, H);
      var scan = (t * 60) % (H + 200) - 100;
      var x0 = fx - fw / 2, y0 = fy - fh / 2, x1 = fx + fw / 2, y1 = fy + fh / 2;
      var ox = (W % gap) / 2, oy = (H % gap) / 2;
      for (var y = oy; y < H; y += gap) {
        var sd = Math.abs(y - scan), sb = sd < 90 ? (1 - sd / 90) * 0.16 : 0;
        for (var x = ox; x < W; x += gap) {
          var inside = x > x0 && x < x1 && y > y0 && y < y1;
          if (inside) {
            ctx.fillStyle = hexA(ac, 0.95);
            ctx.fillRect(x - 1, y - 1, 2, 2);
          } else {
            var dx = Math.max(x0 - x, 0, x - x1), dy = Math.max(y0 - y, 0, y - y1);
            var d = Math.sqrt(dx * dx + dy * dy), nb = d < 120 ? (1 - d / 120) * 0.22 : 0;
            ctx.fillStyle = hexA(fg, 0.09 + sb + nb);
            ctx.fillRect(x - 0.75, y - 0.75, 1.5, 1.5);
          }
        }
      }
      // направляющие через центр рамки
      ctx.strokeStyle = hexA(fg, 0.07);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.round(fx) + 0.5, 0); ctx.lineTo(Math.round(fx) + 0.5, H);
      ctx.moveTo(0, Math.round(fy) + 0.5); ctx.lineTo(W, Math.round(fy) + 0.5);
      ctx.stroke();
      // скобки рамки
      var s = 16;
      ctx.strokeStyle = ac;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(x0, y0 + s); ctx.lineTo(x0, y0); ctx.lineTo(x0 + s, y0);
      ctx.moveTo(x1 - s, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y0 + s);
      ctx.moveTo(x1, y1 - s); ctx.lineTo(x1, y1); ctx.lineTo(x1 - s, y1);
      ctx.moveTo(x0 + s, y1); ctx.lineTo(x0, y1); ctx.lineTo(x0, y1 - s);
      ctx.stroke();
      // подпись координат
      ctx.font = '10px ' + mono;
      ctx.fillStyle = hexA(ac, 0.9);
      ctx.fillText('X ' + (fx / W).toFixed(2) + '  Y ' + (fy / H).toFixed(2), x0, y0 - 9);
      ctx.fillStyle = hexA(fg, 0.4);
      ctx.fillText(Math.round(fw) + '×' + Math.round(fh), x1 - 44, y1 + 16);
    }
    function loop(time) {
      if (!running) return;
      draw(time);
      requestAnimationFrame(loop);
    }
    function play() { if (!running && visible && !document.hidden) { running = true; requestAnimationFrame(loop); } }
    function pause() { running = false; }

    size();
    window.addEventListener('resize', function () { size(); if (reduce) draw(0); });
    if (reduce) { draw(0); return; }
    var host = canvas.parentNode;
    host.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      var r = canvas.getBoundingClientRect();
      target = { x: e.clientX - r.left, y: e.clientY - r.top };
      lastMove = performance.now();
    });
    host.addEventListener('pointerleave', function () { target = null; });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; visible ? play() : pause(); }).observe(canvas);
    }
    document.addEventListener('visibilitychange', function () { document.hidden ? pause() : play(); });
    play();
  }
  $$('[data-field]').forEach(function (c) { if (c.getContext) Field(c); });

  /* ——— Схема корта: камеры → зрение → трекинг → события ——— */
  var SVGNS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs, parent) {
    var el = document.createElementNS(SVGNS, tag);
    for (var k in attrs) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  }
  function Court(host) {
    var fig = host.closest('figure');
    var pipe = fig ? $$('[data-pipeline] li', fig) : [];
    var svg = svgEl('svg', { viewBox: '0 0 220 120', class: 'court', role: 'img', 'aria-label': 'Схема корта для падела: камеры, выделение игроков и мяча, траектории и игровые события' });
    host.appendChild(svg);
    // разметка корта 20×10 м, 1 м = 10 единиц
    var base = svgEl('g', {}, svg);
    for (var gx = 20; gx < 210; gx += 10) svgEl('line', { x1: gx, y1: 10, x2: gx, y2: 110, class: 'c-grid' }, base);
    for (var gy = 20; gy < 110; gy += 10) svgEl('line', { x1: 10, y1: gy, x2: 210, y2: gy, class: 'c-grid' }, base);
    svgEl('rect', { x: 10, y: 10, width: 200, height: 100, class: 'c-line' }, base);
    svgEl('line', { x1: 40.5, y1: 10, x2: 40.5, y2: 110, class: 'c-line' }, base);
    svgEl('line', { x1: 179.5, y1: 10, x2: 179.5, y2: 110, class: 'c-line' }, base);
    svgEl('line', { x1: 40.5, y1: 60, x2: 179.5, y2: 60, class: 'c-line' }, base);
    svgEl('path', { d: 'M10 50 V10 H50 M10 70 V110 H50 M210 50 V10 H170 M210 70 V110 H170', class: 'c-glass' }, base);
    svgEl('line', { x1: 110, y1: 6, x2: 110, y2: 114, class: 'c-net' }, base);

    // слой 0 — камеры
    var conesL = svgEl('g', { 'data-only': '0' }, svg);
    var camL = svgEl('g', { 'data-layer': '0' }, svg);
    [[4, 4, 1], [216, 4, -1], [4, 116, 1], [216, 116, -1]].forEach(function (c) {
      var dir = c[0] < 110 ? 1 : -1, vy = c[1] < 60 ? 1 : -1;
      svgEl('path', { d: 'M' + c[0] + ' ' + c[1] + ' L' + (c[0] + dir * 116) + ' ' + (c[1] + vy * 34) + ' M' + c[0] + ' ' + c[1] + ' L' + (c[0] + dir * 56) + ' ' + (c[1] + vy * 104), class: 'cone' }, conesL);
      svgEl('rect', { x: c[0] - 2, y: c[1] - 1.5, width: 4, height: 3, class: 'ball' }, camL);
    });
    svgEl('text', { x: 6, y: 1.5, class: 'lbl' }, camL).textContent = 'КАМЕРА 1';
    svgEl('text', { x: 186, y: 1.5, class: 'lbl' }, camL).textContent = 'КАМЕРА 2';

    var trailL = svgEl('g', { 'data-layer': '2' }, svg);
    var evL = svgEl('g', { 'data-layer': '3' }, svg);
    var bodies = svgEl('g', {}, svg);
    var boxL = svgEl('g', { 'data-layer': '1' }, svg);

    var players = [
      { bx: 45, by: 36, ph: 0.3 }, { bx: 52, by: 84, ph: 1.7 },
      { bx: 168, by: 34, ph: 2.6 }, { bx: 174, by: 82, ph: 4.1 }
    ].map(function (p, i) {
      p.dot = svgEl('circle', { r: 2.2, class: 'pl' }, bodies);
      p.box = svgEl('rect', { width: 11, height: 11, class: 'box' }, boxL);
      p.lbl = svgEl('text', { class: 'lbl' }, boxL);
      p.lbl.textContent = 'ИГРОК ' + (i + 1);
      p.trail = svgEl('polyline', { class: 'trail' }, trailL);
      p.hist = [];
      return p;
    });
    var ball = { el: svgEl('circle', { r: 1.1, class: 'ball' }, bodies), box: svgEl('rect', { width: 6, height: 6, class: 'box' }, boxL), lbl: svgEl('text', { class: 'lbl' }, boxL), trail: svgEl('polyline', { class: 'trail', style: 'opacity:.9' }, trailL), hist: [] };
    ball.lbl.textContent = 'МЯЧ';

    var shot = null, from = 0, step = -1, stepStart = 0, STEP = 2600;
    var layers = $$('[data-layer]', svg);
    function setStepView(s) {
      layers.forEach(function (g) { g.style.opacity = +g.getAttribute('data-layer') <= s ? 1 : 0; });
      conesL.style.opacity = s === 0 ? 1 : 0;
      pipe.forEach(function (li, k) { li.classList.toggle('on', k <= s); });
    }
    function pos(p, t) {
      return { x: p.bx + 7 * Math.sin(t * 0.8 + p.ph) + 3 * Math.sin(t * 1.9 + p.ph * 2), y: p.by + 9 * Math.sin(t * 0.6 + p.ph * 1.3) + 2 * Math.cos(t * 2.1 + p.ph) };
    }
    function newShot(t) {
      var leftSide = from < 2;
      var to = leftSide ? 2 + Math.round(Math.random()) : Math.round(Math.random());
      var dur = 1.1 + Math.random() * 0.3;
      shot = { from: from, to: to, t0: t, dur: dur, bounced: false };
    }
    function event(x, y, label) {
      var g = svgEl('g', {}, evL);
      var ring = svgEl('circle', { cx: x, cy: y, r: 1, class: 'ev-ring' }, g);
      var txt = svgEl('text', { x: x + 3, y: y - 3, class: 'ev' }, g);
      txt.textContent = label;
      if (ring.animate) {
        ring.animate([{ r: 1, opacity: 1 }, { r: 7, opacity: 0 }], { duration: 1200, easing: 'ease-out' });
        g.animate([{ opacity: 1 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }], { duration: 1600 }).onfinish = function () { g.remove(); };
      } else setTimeout(function () { g.remove(); }, 1600);
    }
    function poly(hist) { return hist.map(function (h) { return h.x.toFixed(1) + ',' + h.y.toFixed(1); }).join(' '); }

    var running = false, visible = false, t0 = null;
    function frame(now) {
      if (!running) return;
      if (t0 === null) { t0 = now; stepStart = now; step = 0; setStepView(0); }
      var t = (now - t0) / 1000;
      if (now - stepStart > (step === 3 ? STEP * 2 : STEP)) {
        step = (step + 1) % 4; stepStart = now; setStepView(step);
        if (step === 0) { players.forEach(function (p) { p.hist = []; }); ball.hist = []; }
      }
      players.forEach(function (p) {
        var q = pos(p, t);
        p.cur = q;
        p.dot.setAttribute('cx', q.x.toFixed(2)); p.dot.setAttribute('cy', q.y.toFixed(2));
        p.box.setAttribute('x', (q.x - 5.5).toFixed(2)); p.box.setAttribute('y', (q.y - 5.5).toFixed(2));
        p.lbl.setAttribute('x', (q.x - 5.5).toFixed(2)); p.lbl.setAttribute('y', (q.y - 7).toFixed(2));
        p.hist.push(q); if (p.hist.length > 90) p.hist.shift();
        if (step >= 2) p.trail.setAttribute('points', poly(p.hist.filter(function (_, i) { return i % 3 === 0; })));
      });
      if (!shot) newShot(t);
      var k = (t - shot.t0) / shot.dur;
      var a = players[shot.from].cur, b = players[shot.to].cur;
      if (k >= 1) { from = shot.to; newShot(t); k = 0; a = players[shot.from].cur; b = players[shot.to].cur; }
      var bx = a.x + (b.x - a.x) * k, by = a.y + (b.y - a.y) * k;
      if (!shot.bounced && k > 0.68) {
        shot.bounced = true;
        if (step >= 3) event(bx, by, 'ОТСКОК');
      }
      ball.el.setAttribute('cx', bx.toFixed(2)); ball.el.setAttribute('cy', by.toFixed(2));
      ball.box.setAttribute('x', (bx - 3).toFixed(2)); ball.box.setAttribute('y', (by - 3).toFixed(2));
      ball.lbl.setAttribute('x', (bx + 4).toFixed(2)); ball.lbl.setAttribute('y', (by + 1).toFixed(2));
      ball.hist.push({ x: bx, y: by }); if (ball.hist.length > 40) ball.hist.shift();
      if (step >= 2) ball.trail.setAttribute('points', poly(ball.hist));
      requestAnimationFrame(frame);
    }
    function play() { if (!running && visible && !document.hidden) { running = true; requestAnimationFrame(frame); } }
    function pause() { running = false; }

    if (reduce) {
      players.forEach(function (p) {
        var q = pos(p, 1);
        p.dot.setAttribute('cx', q.x); p.dot.setAttribute('cy', q.y);
        p.box.setAttribute('x', q.x - 5.5); p.box.setAttribute('y', q.y - 5.5);
        p.lbl.setAttribute('x', q.x - 5.5); p.lbl.setAttribute('y', q.y - 7);
      });
      ball.el.setAttribute('cx', 120); ball.el.setAttribute('cy', 48);
      ball.box.setAttribute('x', 117); ball.box.setAttribute('y', 45);
      ball.lbl.setAttribute('x', 124); ball.lbl.setAttribute('y', 49);
      setStepView(1);
      return;
    }
    setStepView(0);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; visible ? play() : pause(); }, { threshold: 0.2 }).observe(svg);
    } else { visible = true; play(); }
    document.addEventListener('visibilitychange', function () { document.hidden ? pause() : play(); });
  }
  $$('[data-court]').forEach(Court);

  /* ——— Главная, проект: удар по мячу, собранный из точек ———
     Та же сетка точек, что в первом экране, складывается в игрока с ракеткой. Прокрутка ведёт замах и удар,
     затем поверх появляется то, что «видят» камеры: рамки, скелет позы, траектории и события «удар» и «отскок».
     Мир сцены — 470×275 условных единиц (≈ см), земля на высоте GY; оси подписаны в метрах. */
  function Swing(sec) {
    var canvas = $('[data-swing-canvas]', sec);
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext('2d');
    var pipe = $$('[data-swing-steps] li', sec);
    var cs = getComputedStyle(sec);
    var hex = function (v, d) { v = (v || '').trim(); return v.charAt(0) === '#' ? v : d; };
    var FG = hex(cs.getPropertyValue('--fg'), '#F5F2EC');
    var AC = hex(cs.getPropertyValue('--acc'), '#00B0B2');
    var AT = hex(cs.getPropertyValue('--acc-text'), '#3FD0D2');
    var BG = hex(cs.getPropertyValue('--bg'), '#062F3B');
    var mono = cssVar('--mono') || 'monospace';
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var WW = 470, WH = 275, GY = 40, NET = 330, NETH = 50;
    var W = 0, H = 0, S = 1, OX = 0, OY = 0, gap = 8, gw = 5, dots = [];
    var pinned = false, target = 0, cur = -1, raf = 0;
    var D2R = Math.PI / 180;
    var ramp = function (p, a, b) { return clamp((p - a) / (b - a), 0, 1); };

    // Позы удара справа (форхенд). Поля: доля прокрутки, бедро x и y, корпус°, плечо°, предплечье°, ракетка°,
    // свободная рука — плечо° и предплечье°, подъём пятки задней ноги (0…1). Углы — от оси x против часовой.
    var KEYS = [
      [0.00, 132, 80, 86, 292, 12, 58, 284, 30, 0],
      [0.24, 132, 80, 86, 292, 12, 58, 284, 30, 0],
      [0.42, 124, 79, 97, 215, 140, 100, 320, 20, 0],
      [0.48, 129, 77, 91, 250, 280, 245, 300, 330, 0.2],
      [0.52, 136, 78, 80, 310, 350, 365, 250, 215, 0.45],
      [0.64, 142, 81, 82, 400, 519, 585, 235, 300, 1],
      [1.00, 142, 81, 82, 400, 519, 585, 235, 300, 1]
    ];
    // монотонная кубическая интерполяция (Фритч — Карлсон): движение плавное и без «перелётов» поз
    var KP = KEYS.map(function (k) { return k[0]; }), TAN = [];
    for (var ch = 1; ch < KEYS[0].length; ch++) {
      var y = KEYS.map(function (k) { return k[ch]; }), n = y.length, d = [], m = [];
      for (var i = 0; i < n - 1; i++) d.push((y[i + 1] - y[i]) / (KP[i + 1] - KP[i]));
      m[0] = 0; m[n - 1] = 0;
      for (i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
      for (i = 0; i < n - 1; i++) {
        if (!d[i]) { m[i] = 0; m[i + 1] = 0; continue; }
        var a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b;
        if (h > 9) { var tt = 3 / Math.sqrt(h); m[i] = tt * a * d[i]; m[i + 1] = tt * b * d[i]; }
      }
      TAN[ch] = m;
    }
    function chan(p) {
      var i = 0;
      while (i < KP.length - 2 && p > KP[i + 1]) i++;
      var h = KP[i + 1] - KP[i], t = clamp((p - KP[i]) / h, 0, 1), t2 = t * t, t3 = t2 * t, out = [];
      for (var c = 1; c < KEYS[0].length; c++) {
        out[c] = (2 * t3 - 3 * t2 + 1) * KEYS[i][c] + (t3 - 2 * t2 + t) * h * TAN[c][i] +
          (-2 * t3 + 3 * t2) * KEYS[i + 1][c] + (t3 - t2) * h * TAN[c][i + 1];
      }
      return out;
    }
    function dir(a) { return [Math.cos(a * D2R), Math.sin(a * D2R)]; }
    function add(p, v, l) { return [p[0] + v[0] * l, p[1] + v[1] * l]; }
    function knee(hip, ank, L1, L2) { // колено по двум звеньям: стопа стоит на месте, колено смотрит вперёд
      var dx = ank[0] - hip[0], dy = ank[1] - hip[1], dd = Math.min(Math.sqrt(dx * dx + dy * dy), L1 + L2 - 0.01);
      var a = Math.atan2(dy, dx) + Math.acos(clamp((L1 * L1 + dd * dd - L2 * L2) / (2 * L1 * dd), -1, 1));
      return [hip[0] + Math.cos(a) * L1, hip[1] + Math.sin(a) * L1];
    }
    function rig(p) {
      var k = chan(p), hip = [k[1], GY + k[2]], td = dir(k[3]);
      var sh = add(hip, td, 47), neck = add(hip, td, 54), head = add(neck, dir(k[3] - 8), 20);
      var el = add(sh, dir(k[4]), 29), wr = add(el, dir(k[5]), 26), rd = dir(k[6]);
      var el2 = add(sh, dir(k[7]), 28), wr2 = add(el2, dir(k[8]), 24);
      var aF = [176, GY + 7], aB = [90 + k[9] * 7, GY + 7 + k[9] * 11];
      return {
        hip: hip, mid: add(hip, td, 22), sh: sh, neck: neck, head: head, el: el, wr: wr, el2: el2, wr2: wr2,
        kF: knee(hip, aF, 45, 44), aF: aF, tF: [196, GY + 2], kB: knee(hip, aB, 45, 44), aB: aB, tB: [110, GY + 2],
        rd: rd, rc: add(wr, rd, 31), rb: add(wr, rd, -4), rt: add(wr, rd, 14)
      };
    }
    // мяч: подлёт к ракетке, после удара — через сетку, отскок и уход за край
    var C = rig(0.52).rc, B0 = [492, GY + 130], B1 = [405, GY], B2 = [492, GY + 64];
    function arc(a, b, u, hh) { return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u + hh * Math.sin(Math.PI * u)]; }
    function ballAt(p) {
      if (p < 0.28 || p > 0.9) return null;
      if (p <= 0.52) return arc(B0, C, (p - 0.28) / 0.24, 26);
      if (p <= 0.71) return arc(C, B1, (p - 0.52) / 0.19, 80);
      return arc(B1, B2, (p - 0.71) / 0.19, 46);
    }

    function X(x) { return OX + x * S; }
    function Y(y) { return OY + (WH - y) * S; }
    function size() {
      var r = canvas.getBoundingClientRect();
      if (!r.width) return;
      W = r.width; H = r.height;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      S = Math.min(W / WW, H / WH); OX = (W - WW * S) / 2; OY = (H - WH * S) / 2;
      gap = clamp(Math.round(S * 5.2), 5, 10); gw = gap / S;
      dots = [];
      var ox = (W % gap) / 2 + gap / 2, oy = (H % gap) / 2 + gap / 2, n = 0;
      for (var yy = oy, iy = 0; yy < H; yy += gap, iy++) {
        for (var xx = ox, ix = 0; xx < W; xx += gap, ix++) {
          var s1 = Math.sin(++n * 12.9898) * 43758.5453;
          dots.push({ x: xx, y: yy, wx: (xx - OX) / S, wy: WH - (yy - OY) / S, k: (ix + iy) & 1, r: s1 - Math.floor(s1) });
        }
      }
    }
    function segD(px, py, a, b) {
      var vx = b[0] - a[0], vy = b[1] - a[1], wx = px - a[0], wy = py - a[1];
      var l = vx * vx + vy * vy, t = l ? clamp((wx * vx + wy * vy) / l, 0, 1) : 0;
      var dx = wx - vx * t, dy = wy - vy * t;
      return Math.sqrt(dx * dx + dy * dy);
    }
    function label(txt, x, y, col, align) {
      var w = ctx.measureText(txt).width;
      if (align === 'right') x -= w;
      ctx.fillStyle = col;
      ctx.textAlign = 'left';
      ctx.fillText(txt, clamp(x, 4, W - 4 - w), y);
    }
    function trail(fn, from, to, step, every, col, a, r) { // точки через равные расстояния вдоль пути
      var last = null, acc = 0;
      ctx.fillStyle = hexA(col, a);
      for (var s = from; s <= to; s += step) {
        var q = fn(s);
        if (!q) { last = null; continue; }
        var x = X(q[0]), y = Y(q[1]);
        if (last) acc += Math.hypot(x - last[0], y - last[1]);
        if (!last || acc >= every) { acc = 0; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
        last = [x, y];
      }
    }
    function corners(x0, y0, x1, y1, s) {
      ctx.beginPath();
      ctx.moveTo(x0, y0 + s); ctx.lineTo(x0, y0); ctx.lineTo(x0 + s, y0);
      ctx.moveTo(x1 - s, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y0 + s);
      ctx.moveTo(x1, y1 - s); ctx.lineTo(x1, y1); ctx.lineTo(x1 - s, y1);
      ctx.moveTo(x0 + s, y1); ctx.lineTo(x0, y1); ctx.lineTo(x0, y1 - s);
      ctx.stroke();
    }
    function tag(txt, x, y, col) { // подпись на подложке цвета фона — перекрывает подписи осей
      var w = ctx.measureText(txt).width;
      x = clamp(x, 4, W - 8 - w);
      ctx.fillStyle = BG;
      ctx.fillRect(x - 3, y - 10, w + 6, 14);
      label(txt, x, y, col);
    }
    function chip(txt, x, y, a) { // метка события: залитая плашка
      ctx.font = '10px ' + mono;
      var w = ctx.measureText(txt).width + 12;
      x = clamp(x, 4, W - 4 - w);
      ctx.fillStyle = hexA(AC, 0.92 * a);
      ctx.fillRect(Math.round(x), Math.round(y - 13), Math.round(w), 17);
      label(txt, x + 6, y, hexA(BG, a));
    }

    function draw(p, still) {
      if (!W) return;
      var R = rig(p), ball = ballAt(p);
      var mat = still ? 1 : ramp(p, 0.04, 0.22);
      var cams = still ? 1 : ramp(p, 0.02, 0.12);
      var det = still ? 1 : ramp(p, 0.22, 0.3);
      var sk = still ? 1 : ramp(p, 0.26, 0.34);
      var trk = still ? 1 : ramp(p, 0.44, 0.5);
      var ana = still ? 1 : ramp(p, 0.74, 0.8);
      ctx.clearRect(0, 0, W, H);
      if ('letterSpacing' in ctx) ctx.letterSpacing = '1px';

      // фигура: части тела — отрезки с толщиной; 0 — ближняя сторона, 1 — дальняя, 2 — ручка ракетки
      var P = [
        [R.hip, R.mid, 11, 0], [R.mid, R.sh, 12, 0], [R.sh, R.neck, 3.5, 0], [R.head, R.head, 11, 0],
        [R.sh, R.el, 5.5, 0], [R.el, R.wr, 4.6, 0], [R.wr, R.wr, 4.6, 0],
        [R.sh, R.el2, 5.2, 1], [R.el2, R.wr2, 4.4, 1],
        [R.hip, R.kF, 8.5, 0], [R.kF, R.aF, 6.3, 0], [R.aF, R.tF, 4, 0],
        [R.hip, R.kB, 8.5, 1], [R.kB, R.aB, 6.3, 1], [R.aB, R.tB, 4, 1],
        [R.rb, R.rt, 2.6, 2]
      ];
      var bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
      P.forEach(function (q) {
        for (var e = 0; e < 2; e++) {
          bx0 = Math.min(bx0, q[e][0] - q[2]); bx1 = Math.max(bx1, q[e][0] + q[2]);
          by0 = Math.min(by0, q[e][1] - q[2]); by1 = Math.max(by1, q[e][1] + q[2]);
        }
      });
      bx0 = Math.min(bx0, R.rc[0] - 18); bx1 = Math.max(bx1, R.rc[0] + 18);
      by0 = Math.min(by0, R.rc[1] - 18); by1 = Math.max(by1, R.rc[1] + 18);
      var m = gw * 1.2, rdx = R.rd[0], rdy = R.rd[1];
      var scanY = mat > 0 && mat < 1 ? OY + mat * WH * S : -1e9;

      for (var i = 0; i < dots.length; i++) {
        var dt = dots[i], wx = dt.wx, wy = dt.wy, a = 0.1, sz = 1.4, col = FG, v = 0;
        if (Math.abs(wy - GY) < gw * 0.5 && wx > 4 && wx < WW - 4) a = 0.3; // земля
        else if (Math.abs(wx - NET) < gw * 0.5 && wy > GY && wy < GY + NETH + gw * 0.5) a = wy > GY + NETH - gw * 0.5 ? 0.55 : 0.28; // сетка корта
        if (mat > 0 && wx > bx0 - m && wx < bx1 + m && wy > by0 - m && wy < by1 + m) {
          var best = 1e9, kind = -1;
          for (var j = 0; j < P.length; j++) {
            var dd = segD(wx, wy, P[j][0], P[j][1]) - P[j][2];
            if (dd < best) { best = dd; kind = P[j][3]; }
          }
          // голова ракетки — эллипс; ракетка для падела без струн, с отверстиями: часть точек внутри гаснет
          var ux = wx - R.rc[0], uy = wy - R.rc[1];
          var q = Math.sqrt(Math.pow((ux * rdx + uy * rdy) / 17, 2) + Math.pow((uy * rdx - ux * rdy) / 13.5, 2));
          var de = (q - 1) * 13.5;
          if (de < best) { best = de; kind = q < 0.78 && dt.k ? 4 : 3; }
          v = clamp(0.5 - best / (gw * 0.65), 0, 1) * clamp((mat - dt.r * 0.6) / 0.4, 0, 1);
          if (v > 0) {
            if (kind >= 2) { col = AT; if (kind === 4) v *= 0.35; }
            a = Math.max(a, 0.1 + v * (kind === 1 ? 0.5 : 0.86));
            sz = 1.4 + v * (kind === 1 ? 1.1 : 1.6);
          }
        }
        if (scanY > -1e8) { var sd = Math.abs(dt.y - scanY); if (sd < gap * 2) a += (1 - sd / (gap * 2)) * 0.22; }
        if (ball) {
          var bd = Math.hypot(wx - ball[0], wy - ball[1]);
          if (bd < gw * 1.1) { col = AT; a = Math.max(a, 1 - bd / (gw * 1.6)); sz = Math.max(sz, 3.2 - bd / gw); }
        }
        ctx.fillStyle = hexA(col, Math.min(a, 1));
        ctx.fillRect(dt.x - sz / 2, dt.y - sz / 2, sz, sz);
      }

      ctx.font = '10px ' + mono;
      ctx.lineWidth = 1;
      // оси в метрах — «числовая ось», как в первом экране
      var ax = X(6), ay = Y(GY - 22), ly = Math.min(ay + 18, H - 3);
      ctx.strokeStyle = hexA(FG, 0.22);
      ctx.beginPath();
      ctx.moveTo(X(6), ay + 0.5); ctx.lineTo(X(WW - 6), ay + 0.5);
      ctx.moveTo(ax + 0.5, Y(GY)); ctx.lineTo(ax + 0.5, Y(WH - 8));
      for (var t = 10; t <= WW - 10; t += 10) { var big = (t - 10) % 100 === 0; ctx.moveTo(Math.round(X(t)) + 0.5, ay); ctx.lineTo(Math.round(X(t)) + 0.5, ay + (big ? 7 : 3)); }
      for (t = 0; t <= 250; t += 10) { big = t % 100 === 0; ctx.moveTo(ax, Math.round(Y(GY + t)) + 0.5); ctx.lineTo(ax + (big ? 7 : 3), Math.round(Y(GY + t)) + 0.5); }
      ctx.stroke();
      for (t = 0; t <= 4; t++) label(t + (t ? '' : ' м'), X(10 + t * 100) + 3, ly, hexA(FG, 0.45));
      if (W > 520) for (t = 1; t <= 2; t++) label(t + ' м', ax + 11, Y(GY + t * 100) + 4, hexA(FG, 0.45));

      // камеры и их поле зрения
      if (cams > 0) {
        var cone = cams * (still ? 0.6 : 1 - 0.6 * ramp(p, 0.42, 0.52));
        [[14, 262, 1], [WW - 14, 262, -1]].forEach(function (c, k) {
          ctx.strokeStyle = hexA(AC, 0.36 * cone);
          ctx.setLineDash([3, 4]);
          ctx.beginPath();
          ctx.moveTo(X(c[0]), Y(c[1])); ctx.lineTo(X(c[2] > 0 ? 300 : 110), Y(GY));
          ctx.moveTo(X(c[0]), Y(c[1])); ctx.lineTo(X(c[2] > 0 ? 60 : 420), Y(GY));
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = hexA(AC, cams);
          ctx.fillRect(X(c[0]) - 5, Y(c[1]) - 3.5, 10, 7);
          label('КАМЕРА ' + (k + 1), X(c[0]) + (c[2] > 0 ? 10 : -10), Y(c[1]) + 4, hexA(AT, 0.9 * cams), c[2] > 0 ? 'left' : 'right');
        });
      }

      // трекинг: путь мяча и дуга головы ракетки
      if (trk > 0) {
        var rc = function (s) { return rig(s).rc; };
        trail(ballAt, 0.28, Math.min(p, 0.52), 0.001, 6, AT, 0.6 * trk * (still ? 0.4 : 1 - 0.6 * ramp(p, 0.52, 0.6)), 1.1);
        if (p > 0.52) trail(ballAt, 0.52, Math.min(p, 0.9), 0.001, 6, AT, 0.75 * trk, 1.2);
        // ракетка — «хвост» последних положений, а не вся петля замаха
        var t0 = Math.max(0.4, Math.min(p, 0.66) - 0.08);
        for (var tt = 0; tt < 4; tt++) trail(rc, t0 + tt * 0.02, Math.min(t0 + (tt + 1) * 0.02, p, 0.66), 0.0015, 7, AC, (0.15 + tt * 0.14) * trk * (1 - ramp(p, 0.68, 0.76)), 1.5);
      }

      // компьютерное зрение: рамка игрока и скелет позы
      if (det > 0) {
        var x0 = X(bx0) - 8, x1 = X(bx1) + 8, y0 = Y(by1) - 8, y1 = Y(Math.max(by0, GY)) + 4;
        ctx.strokeStyle = hexA(AC, det);
        ctx.lineWidth = 1.25;
        corners(Math.round(x0) + 0.5, Math.round(y0) + 0.5, Math.round(x1) + 0.5, Math.round(y1) + 0.5, 12);
        ctx.lineWidth = 1;
        label('ИГРОК 1', x0, y0 - 8, hexA(AT, det));
      }
      if (sk > 0) {
        var J = [R.head, R.sh, R.el, R.wr, R.el2, R.wr2, R.hip, R.kF, R.aF, R.kB, R.aB];
        ctx.strokeStyle = hexA(AC, 0.85 * sk);
        ctx.beginPath();
        [[0, 1], [1, 2], [2, 3], [1, 4], [4, 5], [1, 6], [6, 7], [7, 8], [6, 9], [9, 10]].forEach(function (e) {
          ctx.moveTo(X(J[e[0]][0]), Y(J[e[0]][1])); ctx.lineTo(X(J[e[1]][0]), Y(J[e[1]][1]));
        });
        ctx.moveTo(X(R.wr[0]), Y(R.wr[1])); ctx.lineTo(X(R.rc[0]), Y(R.rc[1]));
        ctx.stroke();
        ctx.fillStyle = hexA(AT, sk);
        J.forEach(function (q) { ctx.fillRect(X(q[0]) - 2, Y(q[1]) - 2, 4, 4); });
        ctx.strokeStyle = hexA(AT, sk);
        ctx.beginPath(); ctx.arc(X(R.rc[0]), Y(R.rc[1]), 3, 0, Math.PI * 2); ctx.stroke();
      }

      // мяч: рамка, подпись и проекции на оси с координатами
      if (ball && det > 0) {
        var mx = X(ball[0]), my = Y(ball[1]), bo = det * ramp(p, 0.3, 0.34) || (still ? 1 : 0);
        if (bo > 0) {
          ctx.strokeStyle = hexA(AC, bo);
          corners(Math.round(mx - 9) + 0.5, Math.round(my - 9) + 0.5, Math.round(mx + 9) + 0.5, Math.round(my + 9) + 0.5, 5);
          label('МЯЧ', mx + 14, my - 6, hexA(AT, bo));
          var pr = bo * (still ? 1 : trk);
          if (pr > 0) {
            ctx.strokeStyle = hexA(FG, 0.22 * pr);
            ctx.setLineDash([2, 4]);
            ctx.beginPath(); ctx.moveTo(mx, my + 10); ctx.lineTo(mx, ay); ctx.moveTo(mx - 10, my); ctx.lineTo(ax, my); ctx.stroke();
            ctx.setLineDash([]);
            tag('X ' + ((ball[0] - 10) / 100).toFixed(2), mx + 4, ly, hexA(AT, pr));
            tag('Y ' + ((ball[1] - GY) / 100).toFixed(2), ax + 11, my + 4, hexA(AT, pr));
          }
        }
      }

      // события: удар и отскок; на шаге «анализ событий» — плашки
      [[0.52, C, 'УДАР'], [0.71, B1, 'ОТСКОК']].forEach(function (ev) {
        if (p < ev[0]) return;
        var ex = X(ev[1][0]), ey = Y(ev[1][1]), k = (p - ev[0]) / 0.07;
        if (k < 1 && !still) {
          ctx.strokeStyle = hexA(FG, 1 - k);
          ctx.beginPath(); ctx.arc(ex, ey, 4 + 26 * k, 0, Math.PI * 2); ctx.stroke();
        }
        var la = still ? 1 : ramp(p, ev[0], ev[0] + 0.03);
        ctx.strokeStyle = hexA(FG, 0.7 * la);
        ctx.beginPath(); ctx.arc(ex, ey, 4, 0, Math.PI * 2); ctx.stroke();
        if (ana > 0) chip(ev[2], ex + 8, ey - 12, ana);
        else label(ev[2], ex + 8, ey - 10, hexA(FG, 0.85 * la));
      });

      var step = still ? 3 : p < 0.24 ? 0 : p < 0.44 ? 1 : p < 0.74 ? 2 : 3;
      if (!still && p < 0.02) step = -1;
      pipe.forEach(function (li, k) { li.classList.toggle('on', k <= step); });
    }

    function pinTest() {
      pinned = !reduce && window.innerWidth > 980 && window.innerHeight > 680;
      sec.classList.toggle('is-pinned', pinned);
    }
    function progress() {
      var vh = window.innerHeight;
      if (pinned) {
        var r = sec.getBoundingClientRect(), lead = vh * 0.35;
        return clamp((lead - r.top) / (sec.offsetHeight - vh + lead), 0, 1);
      }
      var c = canvas.getBoundingClientRect();
      return clamp((vh * 0.9 - c.top) / (vh * 0.7), 0, 1);
    }
    function tick() {
      raf = 0;
      var dd = target - cur;
      cur = cur < 0 || Math.abs(dd) < 0.0006 ? target : cur + dd * 0.16;
      draw(cur);
      if (cur !== target) raf = requestAnimationFrame(tick);
    }
    function update(resized) {
      if (resized) { pinTest(); size(); if (reduce) { draw(0.8, true); return; } cur = -1; }
      if (reduce) return;
      var p = progress();
      if (pinned && p > 0.12 && !sec._shown) {
        sec._shown = true;
        $$('[data-reveal],[data-split],.hl,.ico', sec).forEach(function (el) { el.classList.add('in'); });
      }
      if (p === target && cur === target) return;
      target = p;
      if (!raf) raf = requestAnimationFrame(tick);
    }

    pinTest();
    size();
    if (reduce) draw(0.8, true);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (reduce) draw(0.8, true); else { cur = -1; update(); } });
    scrollHooks.push(update);
    update();
  }
  $$('[data-swing]').forEach(Swing);

  /* ——— Копирование реквизитов ——— */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (res, rej) {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy') ? res() : rej(); } catch (e) { rej(e); }
      ta.remove();
    });
  }
  var copyStatus = $('[data-copy-status]');
  function clean(s) { return s.replace(/ /g, ' ').replace(/\s+/g, ' ').trim(); }
  function flash(btn, msg) {
    var label = btn.querySelector('span') || btn;
    var old = label.textContent;
    btn.classList.add('done'); label.textContent = 'Скопировано';
    if (copyStatus) copyStatus.textContent = msg;
    setTimeout(function () { btn.classList.remove('done'); label.textContent = old; }, 1600);
  }
  $$('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var row = btn.parentNode, dt = $('dt', row), dd = $('[data-copy-value]', row);
      copyText(clean(dd.textContent)).then(function () { flash(btn, clean(dt.textContent) + ': скопировано'); }, function () { if (copyStatus) copyStatus.textContent = 'Не удалось скопировать. Выделите текст вручную.'; });
    });
  });
  var copyAll = $('[data-copy-all]');
  if (copyAll) copyAll.addEventListener('click', function () {
    var lines = $$('[data-registry] > div').map(function (row) { return clean($('dt', row).textContent) + ': ' + clean($('[data-copy-value]', row).textContent); });
    copyText(lines.join('\n')).then(function () { flash(copyAll, 'Все реквизиты скопированы'); }, function () { if (copyStatus) copyStatus.textContent = 'Не удалось скопировать. Выделите текст вручную.'; });
  });

  /* ——— Форма обращения ——— */
  var form = $('[data-form]');
  if (form) {
    var status = $('[data-form-status]', form);
    var fields = $$('.field', form);
    fields.forEach(function (f) {
      var input = $('input,textarea', f);
      var sync = function () { f.classList.toggle('filled', !!input.value); if (input.value) f.classList.remove('invalid'); };
      input.addEventListener('input', sync); input.addEventListener('change', sync); sync();
    });
    function setStatus(msg, cls) { status.textContent = msg; status.className = 'form-status' + (cls ? ' ' + cls : ''); }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var ok = true;
      fields.forEach(function (f) {
        var input = $('input,textarea', f), bad = input.required && !input.value.trim();
        if (input.name === 'contact' && input.value.trim()) {
          var v = input.value.trim();
          bad = !(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || /^\+?[\d\s()-]{10,}$/.test(v));
        }
        f.classList.toggle('invalid', bad);
        if (bad) ok = false;
      });
      var consent = form.elements.consent;
      if (!consent.checked) ok = false;
      if (!ok) { setStatus('Заполните обязательные поля и подтвердите согласие на обработку данных.', 'err'); return; }
      var action = form.getAttribute('action');
      if (!action) { setStatus('Отправка формы пока не подключена.', 'err'); return; }
      var btn = $('button[type="submit"]', form);
      btn.disabled = true; setStatus('Отправляем…');
      fetch(action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
        .then(function (r) {
          if (!r.ok) throw new Error(r.status);
          form.reset();
          fields.forEach(function (f) { f.classList.remove('filled'); });
          setStatus('Спасибо! Заявка отправлена, мы свяжемся с вами.', 'ok');
        })
        .catch(function () { setStatus('Не удалось отправить. Попробуйте ещё раз позже.', 'err'); })
        .then(function () { btn.disabled = false; });
    });
  }

  /* ═══════════ v3: иконки, мотивы, стыки, уведомление ═══════════ */

  /* Иконки: <i class="ico" data-icon="search"></i>. Линии прорисовываются при появлении */
  var ICONS = {
    search: 'M10.5 4.5a6 6 0 1 1 0 12a6 6 0 1 1 0-12z|M15 15l5 5',
    compare: 'M4 5h7v14H4z|M13 5h7v14h-7z|M6.5 9h2|M15.5 12h2',
    code: 'M8 8l-4 4 4 4|M16 8l4 4-4 4|M13.5 5.5l-3 13',
    launch: 'M12 3a9 9 0 1 1 0 18a9 9 0 1 1 0-18z|M10 8.5l5 3.5-5 3.5z',
    chat: 'M4 5h16v11H10l-6 4z|M8 9.5h8|M8 12.5h5',
    team: 'M9 6a3 3 0 1 1 0 6a3 3 0 1 1 0-6z|M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5|M16 7.5a2.5 2.5 0 1 1 0 5|M17 14.5c2.4.4 4 2.2 4 5',
    report: 'M6 3h9l4 4v14H6z|M15 3v4h4|M9 12h7|M9 16h5',
    eye: 'M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z|M12 9a3 3 0 1 1 0 6a3 3 0 1 1 0-6z',
    camera: 'M3 7h13v10H3z|M16 10.5l5-3v9l-5-3',
    track: 'M3 18c3-8 6-1 9-6s5-6 9-6|M3 18h.01|M21 6h.01',
    event: 'M12 8.5a3.5 3.5 0 1 1 0 7a3.5 3.5 0 1 1 0-7z|M12 2.5v3|M12 18.5v3|M2.5 12h3|M18.5 12h3',
    shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z|M8.5 12l2.5 2.5 4.5-5',
    check: 'M4 12.5l5 5L20 6.5',
    target: 'M12 3a9 9 0 1 1 0 18a9 9 0 1 1 0-18z|M12 7.5a4.5 4.5 0 1 1 0 9a4.5 4.5 0 1 1 0-9z|M12 11.5v1',
    layers: 'M12 4l9 5-9 5-9-5z|M3 14l9 5 9-5',
    key: 'M8 10a4 4 0 1 1 0 .01|M11.5 12H21|M18 12v3|M15 12v2',
    flag: 'M5 21V4|M5 4h12l-2.5 4L17 12H5'
  };
  $$('[data-icon]').forEach(function (el) {
    var d = ICONS[el.getAttribute('data-icon')];
    if (!d) return;
    var svg = svgEl('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' });
    d.split('|').forEach(function (path) {
      var p = svgEl('path', { d: path }, svg);
      p.style.setProperty('--len', 90);
    });
    el.appendChild(svg);
  });

  /* Мотивы: графика в пустых колонках. <div class="motif" data-motif="network" aria-hidden="true"></div> */
  var MOTIFS = {
    aperture: function (g) {
      svgEl('circle', { cx: 100, cy: 100, r: 92, class: 'm-faint' }, g);
      var r1 = svgEl('g', { class: 'm-spin' }, g);
      svgEl('circle', { cx: 100, cy: 100, r: 80, class: 'm-line', 'stroke-dasharray': '2 6' }, r1);
      for (var i = 0; i < 12; i++) {
        var a = i * Math.PI / 6;
        svgEl('line', { x1: 100 + 80 * Math.cos(a), y1: 100 + 80 * Math.sin(a), x2: 100 + 88 * Math.cos(a), y2: 100 + 88 * Math.sin(a), class: 'm-line' }, r1);
      }
      var r2 = svgEl('g', { class: 'm-spin-r' }, g);
      svgEl('circle', { cx: 100, cy: 100, r: 62, class: 'm-acc', 'stroke-dasharray': '120 270' }, r2);
      svgEl('circle', { cx: 162, cy: 100, r: 3, class: 'm-fill' }, r2);
      svgEl('circle', { cx: 100, cy: 100, r: 44, class: 'm-faint' }, g);
      svgEl('line', { x1: 0, y1: 100, x2: 200, y2: 100, class: 'm-faint' }, g);
      svgEl('line', { x1: 100, y1: 0, x2: 100, y2: 200, class: 'm-faint' }, g);
      svgEl('text', { x: 0, y: 196, class: 'm-txt' }, g).textContent = 'ИДС · ЗАДАЧА → РЕШЕНИЕ';
      return true;
    },
    network: function (g) {
      var N = [[30, 40], [100, 24], [170, 50], [56, 110], [130, 100], [180, 140], [40, 176], [110, 168]];
      var E = [[0, 1], [1, 2], [0, 3], [1, 4], [2, 4], [3, 4], [4, 5], [3, 6], [6, 7], [4, 7], [5, 7]];
      E.forEach(function (e, i) {
        var a = N[e[0]], b = N[e[1]];
        svgEl('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 'm-line' }, g);
        if (i % 3 === 0) {
          var p = svgEl('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 'm-acc m-pulse' }, g);
          p.style.animationDelay = (i * 0.37).toFixed(2) + 's';
        }
      });
      N.forEach(function (n, i) {
        svgEl('circle', { cx: n[0], cy: n[1], r: i === 4 ? 6 : 3.5, class: i === 4 ? 'm-fill' : 'm-dot' }, g);
        if (i === 4) svgEl('circle', { cx: n[0], cy: n[1], r: 12, class: 'm-acc m-blink' }, g);
      });
      svgEl('text', { x: 142, y: 104, class: 'm-txt' }, g).textContent = 'ИДС';
      return true;
    },
    scan: function (g) {
      for (var y = 0; y < 5; y++) for (var x = 0; x < 5; x++) svgEl('circle', { cx: 24 + x * 38, cy: 24 + y * 38, r: 1.6, class: 'm-dot' }, g);
      svgEl('rect', { x: 4, y: 4, width: 192, height: 192, class: 'm-faint' }, g);
      var box = svgEl('g', { class: 'm-box' }, g);
      var s = 10, x0 = 8, y0 = 8, w = 56, h = 56;
      svgEl('path', { d: 'M' + x0 + ' ' + (y0 + s) + 'V' + y0 + 'H' + (x0 + s) + 'M' + (x0 + w - s) + ' ' + y0 + 'H' + (x0 + w) + 'V' + (y0 + s) + 'M' + (x0 + w) + ' ' + (y0 + h - s) + 'V' + (y0 + h) + 'H' + (x0 + w - s) + 'M' + (x0 + s) + ' ' + (y0 + h) + 'H' + x0 + 'V' + (y0 + h - s), class: 'm-acc' }, box);
      svgEl('circle', { cx: x0 + w / 2, cy: y0 + h / 2, r: 3, class: 'm-fill' }, box);
      svgEl('text', { x: x0, y: y0 - 4, class: 'm-txt' }, box).textContent = 'ОБЪЕКТ';
      return true;
    },
    doc: function (g) {
      svgEl('path', { d: 'M40 14h86l34 34v138H40z', class: 'm-line' }, g);
      svgEl('path', { d: 'M126 14v34h34', class: 'm-line' }, g);
      [[60, 70, 80], [60, 88, 64], [60, 106, 76], [60, 124, 50], [60, 142, 70]].forEach(function (l, i) {
        svgEl('rect', { x: 60, y: l[1], width: l[2], height: 4, class: 'm-fill m-grow', style: 'animation-delay:' + (i * 0.4) + 's;opacity:.85' }, g);
      });
      svgEl('circle', { cx: 150, cy: 168, r: 20, class: 'm-acc m-blink' }, g);
      svgEl('path', { d: 'M141 168l6 6 12-12', class: 'm-acc' }, g);
      return true;
    },
    orbit: function (g) {
      svgEl('circle', { cx: 78, cy: 100, r: 54, class: 'm-line' }, g);
      svgEl('circle', { cx: 122, cy: 100, r: 54, class: 'm-line' }, g);
      svgEl('circle', { cx: 100, cy: 100, r: 88, class: 'm-faint', 'stroke-dasharray': '2 5' }, g);
      var o = svgEl('g', { class: 'm-orbit' }, g);
      svgEl('circle', { cx: 188, cy: 100, r: 4, class: 'm-fill' }, o);
      svgEl('circle', { cx: 12, cy: 100, r: 2.5, class: 'm-dot' }, o);
      svgEl('path', { d: 'M100 57v86', class: 'm-acc' }, g);
      return true;
    }
  };
  $$('[data-motif]').forEach(function (el) {
    var fn = MOTIFS[el.getAttribute('data-motif')];
    if (!fn) return;
    var svg = svgEl('svg', { viewBox: '0 0 200 200', 'aria-hidden': 'true', focusable: 'false' });
    var g = svgEl('g', {}, svg);
    fn(g);
    el.appendChild(svg);
  });

  /* Анимации стыков и мотивов идут только на экране */
  var live = $$('[data-seam],.motif');
  if (!reduce && 'IntersectionObserver' in window) {
    var lo = new IntersectionObserver(function (es) {
      es.forEach(function (e) { e.target.classList.toggle('is-on', e.isIntersecting); });
    }, { rootMargin: '80px 0px' });
    live.forEach(function (el) { lo.observe(el); });
  }

  /* Уведомление о хранилище браузера (cookie сайт не ставит) */
  var NOTE_KEY = 'ids-storage-note';
  var noteSeen = false;
  try { noteSeen = localStorage.getItem(NOTE_KEY) === '1'; } catch (e) { noteSeen = true; }
  if (!noteSeen && document.body.getAttribute('data-page') !== 'cookies') {
    var note = document.createElement('div');
    note.className = 'notice';
    note.setAttribute('role', 'region');
    note.setAttribute('aria-label', 'Уведомление о хранении данных в браузере');
    note.innerHTML = '<p>Сайт не использует cookie и счётчики аналитики. Для анимации и этого уведомления в браузере хранятся две служебные отметки. <a href="cookies.html">Подробнее</a></p><button type="button">Понятно</button>';
    document.body.appendChild(note);
    setTimeout(function () { note.classList.add('show'); }, reduce ? 0 : startDelay + 600);
    $('button', note).addEventListener('click', function () {
      try { localStorage.setItem(NOTE_KEY, '1'); } catch (e) {}
      note.classList.remove('show');
      setTimeout(function () { note.remove(); }, 600);
    });
  }
})();
