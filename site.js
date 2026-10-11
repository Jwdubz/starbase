/* Starbase Wraps concept - our own code. Motion is mandatory (prefers-reduced-motion intentionally not read).
   One Pause/Play control (WCAG 2.2.2) stops every ambient loop and film. */
(function(){
  'use strict';
  function boot(){
  var g = window.gsap, ST = window.ScrollTrigger, Split = window.SplitText;
  g.registerPlugin(ST, Split);
  var html = document.documentElement;
  var paused = false;
  var ambient = [];             // looping tweens the Pause button owns
  var pending = new Set();      // reveal timelines not yet played

  /* ---- smooth scroll (Lenis lerp 0.1 - measured on the SOTD) ---- */
  var lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1, smoothWheel: true, syncTouch: false });
  lenis.on('scroll', ST.update);
  g.ticker.add(function(t){ lenis.raf(t * 1000); });
  g.ticker.lagSmoothing(0);
  lenis.stop(); window.scrollTo(0,0);

  document.querySelectorAll('a[href^="#"]').forEach(function(a){
    a.addEventListener('click', function(e){
      var id = a.getAttribute('href'); if (id.length < 2) return;
      var el = document.querySelector(id); if (!el) return;
      e.preventDefault(); lenis.scrollTo(el, { offset: id === '#top' ? 0 : -70, duration: 1.2, easing: function(x){ return 1 - Math.pow(1 - x, 4); } });
    });
  });

  /* ---- films: autoplay muted loop playsinline; poster stays if the cut is not on disk ---- */
  var films = [].slice.call(document.querySelectorAll('video.film'));
  films.forEach(function(v){
    v.muted = true; v.defaultMuted = true; v.setAttribute('muted',''); v.playsInline = true; v.setAttribute('playsinline','');
    var fail = function(){ v.classList.add('nofilm'); };
    v.addEventListener('error', fail);
    var src = v.querySelector('source');
    if (src) src.addEventListener('error', fail);
  });
  /* only decode films that are on screen: phones cap hardware decoders, and off-screen films left mid-page tiles black */
  var filmsOn = false, seen = new Set();
  function tryPlay(v){ if (filmsOn && !paused && seen.has(v) && !v.classList.contains('nofilm')){ var p=v.play(); if(p&&p.catch)p.catch(function(){}); } }
  if ('IntersectionObserver' in window){
    var fio = new IntersectionObserver(function(es){ es.forEach(function(e){ if (e.isIntersecting){ seen.add(e.target); tryPlay(e.target); } else { seen.delete(e.target); e.target.pause(); } }); }, { rootMargin: '200px 0px' });
    films.forEach(function(v){ fio.observe(v); });
  } else { films.forEach(function(v){ seen.add(v); }); }
  function playFilms(){ filmsOn = true; films.forEach(tryPlay); }
  function pauseFilms(){ films.forEach(function(v){ v.pause(); }); }

  /* ---- splits ---- */
  var splits = [];
  function splitEl(el){
    var s = Split.create(el, { type: 'lines', mask: 'lines', linesClass: 'split-line', autoSplit: false });
    (s.masks || []).forEach(function(m){ m.classList.add('split-mask'); });
    g.set(s.lines, { yPercent: el._done ? 0 : 130 });
    el._split = s; el._lines = s.lines;
  }
  document.querySelectorAll('[data-split]').forEach(function(el){ splitEl(el); splits.push(el); });
  document.querySelectorAll('[data-reveal]').forEach(function(el){ g.set(el, { autoAlpha: 0, y: 26 }); });

  function reveal(el){
    if (el._done) return; el._done = true; pending.delete(el);
    if (el._lines) g.to(el._lines, { yPercent: 0, duration: 0.55, ease: 'power3.out', stagger: 0.04, overwrite: true });
    else g.to(el, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power2.out', overwrite: true });
  }
  function finishAll(){ pending.forEach(function(el){ el._done = true; if (el._lines) g.set(el._lines,{yPercent:0}); else g.set(el,{autoAlpha:1,y:0}); }); pending.clear(); }

  /* ---- loader → intro ---- */
  var hero = document.querySelector('.hero');
  var heroLines = [].slice.call(hero.querySelectorAll('[data-split]'));
  var loader = document.querySelector('.loader');
  var num = loader.querySelector('.loader__num');
  var meter = { v: 0 };
  var phone = matchMedia('(max-width: 820px)').matches;
  var intro;
  if (phone){
    /* phone: no loader, CTA usable immediately (<1s) */
    loader.style.display = 'none';
    lenis.start(); playFilms();
    intro = g.timeline({ delay: 0 });
    intro.fromTo('.hdr', { y: -12, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.45, ease: 'power3.out' }, 0)
         .add(function(){ heroLines.forEach(function(el){ el._done = true; }); }, 0)
         .to(heroLines.map(function(el){ return el._lines; }).flat(), { yPercent: 0, duration: 0.6, ease: 'power3.out', stagger: 0.07 }, 0)
         .add(function(){ hero.querySelectorAll('[data-reveal]').forEach(reveal); }, 0.15)
         .fromTo('.hero__media', { clipPath: 'inset(10% 8% 10% 8% round 1rem)' }, { clipPath: 'inset(0% 0% 0% 0% round 1rem)', duration: 1.1, ease: 'expo.out' }, 0.2)
         .fromTo('#film-hero', { scale: 1.12 }, { scale: 1.04, duration: 1.4, ease: 'expo.out' }, 0.2)
         .add(function(){ alignHero(); setTimeout(alignHero, 50); setTimeout(alignHero, 400); }, 0.5);
  } else {
  intro = g.timeline({ delay: 0.15 });
  intro.to(meter, { v: 98, duration: 1.5, ease: 'power2.out', onUpdate: function(){ num.textContent = Math.round(meter.v); } }, 0)
       .to('.loader__bar i', { scaleX: 1, duration: 1.5, ease: 'power2.out' }, 0)
       .to(loader, { clipPath: 'inset(0 0 100% 0)', duration: 1.0, ease: 'expo.inOut' }, 1.65)
       .add(function(){ lenis.start(); playFilms(); }, 2.0)
       .fromTo('.hdr', { y: -24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.8, ease: 'power3.out' }, 2.05)
       .add(function(){ heroLines.forEach(function(el){ el._done = true; }); }, 1.9)
       .to(heroLines.map(function(el){ return el._lines; }).flat(), { yPercent: 0, duration: 0.85, ease: 'power3.out', stagger: 1.0 }, 1.9)
       .fromTo('.hero__media', { clipPath: 'inset(18% 12% 18% 12% round 1rem)' }, { clipPath: 'inset(0% 0% 0% 0% round 1rem)', duration: 1.4, ease: 'expo.out' }, 6.2)
       .fromTo('#film-hero', { scale: 1.18 }, { scale: 1.04, duration: 1.8, ease: 'expo.out' }, 6.2)
       .add(function(){ hero.querySelectorAll('[data-reveal]').forEach(reveal); }, 6.4)
       .add(function(){ alignHero(); }, 7.5)
       .add(function(){ alignHero(); setTimeout(alignHero, 50); setTimeout(alignHero, 400); }, 6.5)
       .set(loader, { display: 'none' });
  }
  window.__intro = intro;

  /* ---- scroll reveals: fire before entry (lesson from Larson walk) ---- */
  splits.concat([].slice.call(document.querySelectorAll('[data-reveal]'))).forEach(function(el){
    if (hero.contains(el)) return;
    pending.add(el);
    ST.create({ trigger: el, start: 'top 140%', once: true, onEnter: function(){ reveal(el); } });
  });
  // per-frame safety sweep: anything on screen or scrolled past that a trigger missed
  g.ticker.add(function(){
    if (!pending.size || !intro.progress() || intro.progress() < 0.6) return;
    var vh = innerHeight;
    pending.forEach(function(el){ var r = el.getBoundingClientRect(); if (r.top < vh * 1.4) reveal(el); });
  });

  /* ---- clip-open media on scroll ---- */
  document.querySelectorAll('[data-clip]').forEach(function(el){
    if (el.classList.contains('hero__media')) return;
    g.fromTo(el, { clipPath: 'inset(10% 8% 10% 8% round 1rem)' }, { clipPath: 'inset(0% 0% 0% 0% round 1rem)', ease: 'none',
      scrollTrigger: { trigger: el, start: 'top 100%', end: 'top 35%', scrub: 0.5 } });
  });
  // hero film drifts as you leave
  g.to('#film-hero', { yPercent: 10, ease: 'none', scrollTrigger: { trigger: '.hero__media', start: 'top 60%', end: 'bottom top', scrub: 0.5 } });

  /* ---- collage parallax (desktop only; phone/tablet is a clean single column) ---- */
  g.matchMedia().add('(min-width: 821px)', function(){
  document.querySelectorAll('.card[data-speed]').forEach(function(c){
    var s = parseFloat(c.dataset.speed) || 0;
    g.fromTo(c, { y: function(){ return innerHeight * s; } }, { y: function(){ return -innerHeight * s; }, ease: 'none',
      scrollTrigger: { trigger: c, start: 'top bottom', end: 'bottom top', scrub: 0.6, invalidateOnRefresh: true } });
    var media = c.querySelector('img, video.film'); if (media) g.fromTo(media, { scale: 1.12 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: c, start: 'top bottom', end: 'center center', scrub: 0.6 } });
  });
  });

  /* ---- counters ---- */
  document.querySelectorAll('[data-count]').forEach(function(n){
    var to = +n.dataset.count, o = { v: Math.round(to * 0.6) };
    ST.create({ trigger: n, start: 'top 95%', once: true, onEnter: function(){
      n.textContent = o.v;
      g.to(o, { v: to, duration: 1.4, ease: 'power2.out', onUpdate: function(){ n.textContent = Math.round(o.v); } });
    }});
  });

  /* ---- ambient loops (Pause owns these) ---- */
  var hexRect = document.querySelector('.hexfield__rect');
  ambient.push(g.to(hexRect, { x: -134.4, y: -232.8, duration: 26, ease: 'none', repeat: -1 }));
  var track = document.querySelector('.ticker__track');
  var tick = g.to(track, { xPercent: -50, duration: 28, ease: 'none', repeat: -1 });
  ambient.push(tick);
  var heroBreath = g.to('#film-hero', { scale: 1.0, duration: 9, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 4, transformOrigin: '50% 50%' });
  ambient.push(heroBreath);
  // ticker reacts to scroll velocity
  var vel = 1;
  lenis.on('scroll', function(e){ vel = 1 + Math.min(Math.abs(e.velocity) / 12, 4); });
  g.ticker.add(function(){ if (paused) return; tick.timeScale(g.utils.interpolate(tick.timeScale(), vel, 0.08)); vel = g.utils.interpolate(vel, 1, 0.05); });
  // hex field leans with scroll
  g.to('.hexfield', { rotate: 6, ease: 'none', scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 1 } });

  /* ---- film rail: drag on desktop, native swipe on touch ---- */
  var rail = document.querySelector('[data-rail]');
  if (rail){
    var down = false, sx = 0, sl = 0, moved = false;
    rail.addEventListener('pointerdown', function(e){ if (e.pointerType !== 'mouse') return; down = true; moved = false; sx = e.clientX; sl = rail.scrollLeft; rail.style.scrollSnapType = 'none'; rail.style.cursor = 'grabbing'; });
    addEventListener('pointermove', function(e){ if (!down) return; var d = e.clientX - sx; if (Math.abs(d) > 4) moved = true; rail.scrollLeft = sl - d; });
    addEventListener('pointerup', function(){ if (!down) return; down = false; rail.style.scrollSnapType = ''; rail.style.cursor = ''; });
    rail.addEventListener('click', function(e){ if (moved){ e.preventDefault(); moved = false; } }, true);
    rail.addEventListener('wheel', function(e){ if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) e.stopPropagation(); }, { passive: true });
  }

  /* ---- Pause / Play (one control) ---- */
  var btn = document.querySelector('.motion');
  var txt = btn.querySelector('.motion__txt');
  btn.addEventListener('click', function(){
    paused = !paused;
    btn.setAttribute('aria-pressed', String(paused));
    btn.setAttribute('aria-label', paused ? 'Play Motion' : 'Pause Motion');
    txt.textContent = paused ? 'Play' : 'Pause';
    html.classList.toggle('is-paused', paused);
    if (paused){
      if (intro.progress() < 1) intro.progress(1);
      finishAll();
      ambient.forEach(function(t){ t.pause(); });
      pauseFilms();
    } else {
      ambient.forEach(function(t){ t.resume(); });
      playFilms();
    }
    /* Pause freezes all motion: GSAP + smooth scroll */ if(window.gsap){gsap.globalTimeline[paused?'pause':'resume']();}if(typeof lenis!=='undefined'&&lenis){lenis.options.smoothWheel=!paused;}
  });

  /* ---- header state: solid after the hero top, light over paper sections ---- */
  var hdr = document.querySelector('.hdr');
  var setSolid = function(){ hdr.classList.toggle('hdr--solid', (window.scrollY || 0) > 60); }; lenis.on('scroll', setSolid); addEventListener('scroll', setSolid, { passive: true }); setSolid();
  document.querySelectorAll('.tint,.work,.ask').forEach(function(sec){
    ST.create({ trigger: sec, start: 'top 40px', end: 'bottom 40px', onToggle: function(s){ hdr.classList.toggle('hdr--light', s.isActive); } });
  });
  /* ---- phone/tablet menu sheet ---- */
  var menuBtn = document.querySelector('.hdr__menu');
  function setMenu(open){ hdr.classList.toggle('is-open', open); menuBtn.setAttribute('aria-expanded', String(open)); menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Menu'); }
  if (menuBtn){
    menuBtn.addEventListener('click', function(){ setMenu(!hdr.classList.contains('is-open')); });
    document.querySelectorAll('.hdr__nav a').forEach(function(a){ a.addEventListener('click', function(){ setMenu(false); }); });
    addEventListener('keydown', function(e){ if (e.key === 'Escape' && hdr.classList.contains('is-open')){ setMenu(false); menuBtn.focus(); } });
    matchMedia('(min-width: 821px)').addEventListener('change', function(m){ if (m.matches) setMenu(false); });
  }

  /* ---- re-fit + re-split headlines when the width changes (resize / rotate) ---- */
  var lastW = innerWidth, rt;
  function resplit(){
    if (intro.progress() < 1) intro.progress(1);
    splits.forEach(function(el){ if (el._split) el._split.revert(); });
    fit();
    splits.forEach(splitEl);
    ST.refresh();
    setTimeout(alignHero, 0);
    setTimeout(alignHero, 120);
  }
  addEventListener('resize', function(){ if (innerWidth === lastW) return; lastW = innerWidth; clearTimeout(rt); rt = setTimeout(resplit, 160); });
  window.__resplit = resplit;
  addEventListener('load', function(){ ST.refresh(); });
  }
  /* fit the hero headline lines to the column before splitting (no clipped words at any width) */
  function alignHero(){
    var h = document.querySelector('.hero__h'); if (!h) return;
    var payoff = h.querySelector('.hl--payoff') || h.querySelectorAll('.hl')[4];
    if (!payoff) return;
    var media = document.querySelector('.hero__media'); if (!media) return;
    payoff.style.transform = 'none';
    payoff.style.fontSize = '';
    payoff.style.width = 'max-content';
    payoff.style.maxWidth = 'none';
    payoff.style.display = 'block';
    payoff.style.marginLeft = 'auto';
    payoff.style.marginRight = 'auto';
    payoff.style.textAlign = 'center';

    var tipEl = payoff.querySelector('.em--period');
    function tipRight(){
      var lineR = payoff.getBoundingClientRect().right;
      var glyphR = lineR;
      if (tipEl){
        var walk = document.createTreeWalker(tipEl, NodeFilter.SHOW_TEXT);
        var n = walk.nextNode();
        if (n && n.textContent.length){
          var r = document.createRange();
          r.setStart(n, n.textContent.length - 1);
          r.setEnd(n, n.textContent.length);
          glyphR = r.getBoundingClientRect().right;
        } else glyphR = tipEl.getBoundingClientRect().right;
      }
      return Math.max(lineR, glyphR) + 4;
    }
    var radius = parseFloat(getComputedStyle(media).borderTopRightRadius) || 16;
    var target = media.getBoundingClientRect().right - (radius + 12);
    /* phone: WORLD. fills the headline's content width (desktop keeps the film-edge alignment) */
    if (window.matchMedia && matchMedia('(max-width: 600px)').matches) target = h.getBoundingClientRect().right - 2;
    var left = payoff.getBoundingClientRect().left;
    if (target - left < 40) return;
    var lo = 12, hi = Math.min((target - left) * 1.2, innerWidth * 0.45);
    var lead = h.querySelector('.hl');
    var best = (parseFloat(getComputedStyle(lead).fontSize) || 48) * 1.6;
    for (var i = 0; i < 40; i++){
      var mid = (lo + hi) / 2;
      payoff.style.fontSize = mid + 'px';
      var pr = tipRight();
      if (pr > target) hi = mid;
      else if (pr < target - 0.5) lo = mid;
      else { best = mid; break; }
      best = mid;
    }
    payoff.style.fontSize = best + 'px';
    while (tipRight() > target && best > 12){ best *= 0.985; payoff.style.fontSize = best + 'px'; }
    document.documentElement.dataset.heroAlign = '68';
  }

  function fit(){
    var h = document.querySelector('.hero__h'); if (!h) return;
    h.style.fontSize = '';
    var cs = parseFloat(getComputedStyle(h).fontSize), ratio = 1;
    // only lines 1–2 - line 3 is sized to the film edge by alignHero
    [].slice.call(h.querySelectorAll('.hl')).slice(0, 2).forEach(function(l){
      var w = l.scrollWidth, a = l.clientWidth;
      if (a > 0 && w > a * 0.97) ratio = Math.min(ratio, (a * 0.97) / w);
    });
    if (ratio < 1) h.style.fontSize = (cs * ratio) + 'px';
    alignHero();
  }
  var go = function(){ fit(); boot(); requestAnimationFrame(function(){ requestAnimationFrame(alignHero); }); }; /* alignHero after media */
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(go); else addEventListener('load', go);
})();
