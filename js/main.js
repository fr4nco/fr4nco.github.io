(function () {
  "use strict";

  const root = document.documentElement;
  const body = document.body;
  const M = window.Motion;

  // Las animaciones se muestran siempre, aunque el sistema tenga "reducir movimiento" activado.
  // Motion consulta esa preferencia en su primera animación, así que se responde "no" antes de usarlo.
  const nativeMatchMedia = window.matchMedia.bind(window);
  window.matchMedia = query => /prefers-reduced-motion/.test(query)
    ? { matches: false, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false; } }
    : nativeMatchMedia(query);
  const canHover = window.matchMedia("(hover: hover)").matches;
  const useMotion = Boolean(M);
  const ease = [0.22, 1, 0.36, 1];

  if (!useMotion) root.classList.add("sin-motion");

  // Sin Motion no hay zoom: el nombre de la navegación aparece cuando la firma sale de la vista
  if (!useMotion) {
    const titulo = document.querySelector(".hero__name");
    new IntersectionObserver(([e]) => {
      document.getElementById("nav").classList.toggle("con-nombre", !e.isIntersecting);
    }).observe(titulo);
  }

  /* ---------- Navegación ---------- */

  const nav = document.getElementById("nav");
  const toggle = document.querySelector(".nav__toggle");
  const menuLinks = document.querySelectorAll(".nav__links a");
  const progress = document.querySelector(".scroll-progress");
  const mobileNav = window.matchMedia("(max-width: 860px)");

  function setMenu(open) {
    body.classList.toggle("menu-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
    if (open && useMotion && mobileNav.matches) {
      M.animate(menuLinks, { opacity: [0, 1], y: [24, 0] }, { delay: M.stagger(0.06, { startDelay: 0.08 }), duration: 0.5, ease });
    }
  }

  toggle.addEventListener("click", () => setMenu(!body.classList.contains("menu-open")));
  menuLinks.forEach(link => link.addEventListener("click", () => setMenu(false)));
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") setMenu(false);
  });

  function onScroll() {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    nav.classList.toggle("is-scrolled", y > 20);
    progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Resalta el enlace de la sección visible
  const sections = document.querySelectorAll("main section[id]");
  const sectionObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      menuLinks.forEach(link => {
        link.classList.toggle("is-active", link.getAttribute("href") === "#" + entry.target.id);
      });
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  sections.forEach(s => sectionObserver.observe(s));

  /* ---------- Texto que se escribe solo ---------- */

  const typed = document.querySelector(".typed");
  if (typed) {
    const words = JSON.parse(typed.dataset.words);
    let w = 0, i = 0, deleting = false;
    const tick = () => {
      const word = words[w];
      i += deleting ? -1 : 1;
      typed.textContent = word.slice(0, i);
      let delay = deleting ? 35 : 70;
      if (!deleting && i === word.length) { deleting = true; delay = 1800; }
      else if (deleting && i === 0) { deleting = false; w = (w + 1) % words.length; delay = 350; }
      setTimeout(tick, delay);
    };
    setTimeout(tick, 1100);
  }

  /* ---------- Firma: se escribe siguiendo el recorrido de la lapicera ---------- */

  // Cada trazo de la máscara es la línea central de la tinta; al avanzar su dash
  // se descubre la firma real en el orden en que se escribe.
  const firmaSvg = document.querySelector(".hero__firma");
  if (firmaSvg) {
    const trazos = [...firmaSvg.querySelectorAll(".firma-trazos path")];
    const pluma = firmaSvg.querySelector(".firma-pluma");
    const VELOCIDAD = 4200; // unidades del dibujo por segundo
    const LEVANTE = 0.05;   // pausa al levantar la lapicera entre trazos (s)
    let t = 0;
    const plan = trazos.map(path => {
      const len = path.getTotalLength();
      path.style.strokeDasharray = `${len} ${len}`;
      path.style.strokeDashoffset = `${len}`;
      const dur = Math.max(0.05, len / VELOCIDAD);
      const item = { path, len, start: t, dur };
      t += dur + (len > 40 ? LEVANTE : 0);
      return item;
    });
    const total = t;
    // Acelera al empezar el trazo y frena al terminarlo, como la mano
    const mano = k => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
    let inicio = null;
    const cuadro = now => {
      if (inicio === null) inicio = now;
      const s = (now - inicio) / 1000;
      let activo = null;
      for (const it of plan) {
        const k = Math.min(1, Math.max(0, (s - it.start) / it.dur));
        if (k > 0) it.path.style.visibility = "visible";
        const avance = mano(k);
        it.path.style.strokeDashoffset = `${it.len * (1 - avance)}`;
        if (k > 0 && k < 1) activo = { it, avance };
      }
      if (activo) {
        const pt = activo.it.path.getPointAtLength(activo.it.len * activo.avance);
        pluma.setAttribute("transform", `translate(${pt.x} ${pt.y})`);
        pluma.style.opacity = "1";
      } else {
        pluma.style.opacity = "0";
      }
      if (s < total) {
        requestAnimationFrame(cuadro);
      } else {
        trazos.forEach(p => { p.style.strokeDasharray = "none"; p.style.visibility = "visible"; });
      }
    };
    setTimeout(() => requestAnimationFrame(cuadro), 350);
  }

  /* ---------- Reloj de la escena con la hora real ---------- */

  // Se gira con el atributo transform de SVG, que usa un centro exacto (405, 70)
  const hands = {
    hora: document.querySelector(".reloj-hora"),
    min: document.querySelector(".reloj-min"),
    seg: document.querySelector(".reloj-seg")
  };
  const setHand = (el, deg) => el.setAttribute("transform", `rotate(${deg} 405 70)`);
  const tickClock = () => {
    const d = new Date();
    const s = d.getSeconds(), m = d.getMinutes() + s / 60, h = (d.getHours() % 12) + m / 60;
    setHand(hands.hora, h * 30);
    setHand(hands.min, m * 6);
    setHand(hands.seg, s * 6);
  };
  tickClock();
  setInterval(tickClock, 1000);

  /* ---------- Brillo que sigue al cursor ---------- */

  document.querySelectorAll(".glow").forEach(el => {
    el.addEventListener("pointermove", e => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
    });
  });

  /* ---------- Animaciones con Motion ---------- */

  if (useMotion) {
    const { animate, stagger, inView, scroll, press, spring } = M;
    const springSoft = { type: spring, stiffness: 140, damping: 18 };
    const springPop = { type: spring, bounce: 0.45, visualDuration: 0.6 };

    // Entrada del hero: una sola secuencia orquestada
    animate(".intro", { opacity: [0, 1], y: [18, 0] }, { delay: stagger(0.1, { startDelay: 0.75 }), duration: 0.7, ease });

    animate(".scene", { opacity: [0, 1], scale: [0.94, 1] }, { duration: 0.9, ease });
    animate(".scene .edificio", { scaleY: [0, 1] }, { delay: stagger(0.06, { startDelay: 0.3 }), duration: 0.7, ease });
    animate(".scene .ventanitas rect", { opacity: [0, 1] }, { delay: stagger(0.04, { startDelay: 0.8, from: "center" }), duration: 0.25 });
    animate(".scene .monitor", { opacity: [0, 1], scaleY: [0.7, 1] }, { delay: 0.5, ...springPop });
    animate(".scene .pantalla", { opacity: [0, 1, 0.3, 1] }, { delay: 0.9, duration: 0.6 });
    animate(".scene .map-punto", { scale: [0, 1] }, { delay: stagger(0.12, { startDelay: 1.2 }), ...springPop });
    // Franco aparece desde detrás del escritorio y luego se abre la laptop
    animate(".scene .persona", { opacity: [0, 1], y: [70, 0] }, { delay: 0.55, type: spring, bounce: 0.3, visualDuration: 0.9 });
    animate(".scene .laptop", { scaleY: [0, 1] }, { delay: 1.1, ...springPop });
    const deskIn = animate(".scene__front", { y: ["20%", "0%"] }, { delay: 0.4, duration: 1, ease });

    // Detalles en bucle de la oficina (se pausan cuando el hero no está en pantalla)
    const loops = [];
    const startLoops = () => {
      document.querySelectorAll(".scene .ventanitas rect").forEach(win => {
        if (Math.random() < 0.5) return;
        loops.push(animate(win, { opacity: [1, 0.15, 1] }, {
          duration: 0.6, repeat: Infinity, repeatDelay: 3 + Math.random() * 6, delay: Math.random() * 4
        }));
      });
      loops.push(animate(".scene .map-onda", { scale: [1, 3.4], opacity: [0.9, 0] },
        { duration: 2.2, repeat: Infinity, delay: stagger(0.55), ease: "easeOut" }));

      const lines = document.querySelectorAll(".scene .linea-codigo");
      const cycle = lines.length * 0.28 + 2.2;
      loops.push(animate(lines, { scaleX: [0, 1] },
        { duration: 0.32, delay: stagger(0.28), repeat: Infinity, repeatDelay: cycle - 0.32, ease: "easeOut" }));

      loops.push(animate(".scene .vapor", { opacity: [0, 0.7, 0], y: [4, -12] },
        { duration: 2.8, delay: stagger(1.4), repeat: Infinity, ease: "easeInOut" }));
      // Respiración sutil y logo de la laptop que late
      loops.push(animate(".scene .persona", { scaleY: [1, 1.008], scaleX: [1, 1.003] },
        { duration: 3.2, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }));
      loops.push(animate(".scene .laptop-logo", { opacity: [1, 0.55] },
        { duration: 1.8, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }));
      loops.push(animate(".scene .planta", { rotate: [-2.5, 2.5] },
        { duration: 3.4, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }));
      loops.push(animate(".scene .brillo-pantalla", { opacity: [0.7, 1] },
        { duration: 2.6, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }));
    };
    setTimeout(startLoops, 1800);

    inView(".hero", () => {
      loops.forEach(c => c.play());
      return () => loops.forEach(c => c.pause());
    });

    /* ----- Zoom al monitor: el gran momento del sitio ----- */

    const hero = document.querySelector(".hero");
    const stage = document.querySelector(".hero__stage");
    const heroText = document.querySelector(".hero__text");
    const zoomEl = document.querySelector(".scene-zoom");
    const scene = document.querySelector(".scene");
    const layers = [...document.querySelectorAll(".scene__layer")];
    const mapa = document.querySelector(".mapa");
    const mapaSvg = mapa.querySelector(".mapa__svg");
    const mapaTitulo = mapa.querySelector(".mapa__titulo");
    const panel = mapa.querySelector(".mapa__panel");
    const pins = [...mapa.querySelectorAll(".pin")];
    const panelItems = [...panel.querySelectorAll("li")];
    const hint = document.querySelector(".scroll-hint");

    const SCREEN = { x: 318, y: 192, w: 134, h: 84 }; // pantalla del monitor en coordenadas de la escena (480×440)
    const NAV_H = 72;
    const clamp01 = v => Math.min(1, Math.max(0, v));
    const range = (p, a, b) => clamp01((p - a) / (b - a));
    const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

    hero.classList.add("hero--zoom");
    let target = null;
    let zooming = false;
    let mapaOn = false;
    let progress = 0;

    // Calcula dónde está la pantalla sin zoom y cómo llevarla a ocupar la vista
    function measure() {
      const prev = zoomEl.style.transform;
      zoomEl.style.transform = "none";
      const r = zoomEl.getBoundingClientRect();
      zoomEl.style.transform = prev;
      const st = stage.getBoundingClientRect();

      // Las capas miden 106 % de la escena y empiezan en -3 %
      const lw = r.width * 1.06, lh = r.height * 1.06;
      const sx = r.left - r.width * 0.03 + (SCREEN.x / 480) * lw;
      const sy = r.top - r.height * 0.03 + (SCREEN.y / 440) * lh;
      const sw = (SCREEN.w / 480) * lw, sh = (SCREEN.h / 440) * lh;

      // La pantalla queda justo debajo de la navegación: en anchas cubre el resto de la vista,
      // en angostas ocupa todo el ancho y deja lugar abajo para la lista
      const wide = st.width / st.height >= 1.1;
      const free = st.height - NAV_H;
      // En anchas cubre la vista, pero sin achicar tanto el alto visible que queden puntos del mapa afuera
      const cover = Math.max(st.width / sw, free / sh);
      const fitPins = free / (sh * 78 / 84);
      const scale = wide ? Math.min(cover, fitPins) : st.width / sw;
      const cx = st.left + st.width / 2;
      const cy = st.top + NAV_H + (sh * scale) / 2;
      target = {
        wide, scale, sw,
        ox: sx + sw / 2 - r.left,
        oy: sy + sh / 2 - r.top,
        dx: cx - (sx + sw / 2),
        dy: cy - (sy + sh / 2),
        height: sh * scale
      };
      layoutMapa();
    }

    // Ubica título, puntos y panel sobre el mapa a tamaño completo
    function layoutMapa() {
      // Con el alto exacto de la pantalla escalada, "slice" recorta los costados y "meet" deja bandas laterales
      const st0 = stage.getBoundingClientRect();
      mapaSvg.setAttribute("preserveAspectRatio", target.sw * target.scale > st0.width + 0.5 ? "xMidYMin slice" : "xMidYMin meet");
      Object.assign(mapaSvg.style, { top: `${NAV_H}px`, height: `${target.height}px` });

      const st = stage.getBoundingClientRect();
      const ctm = mapaSvg.getScreenCTM();
      const toStage = (x, y) => {
        const pt = mapaSvg.createSVGPoint();
        pt.x = x; pt.y = y;
        const p = pt.matrixTransform(ctm);
        return { x: p.x - st.left, y: p.y - st.top };
      };

      const t = toStage(340, 196.5);
      Object.assign(mapaTitulo.style, { left: `${t.x}px`, top: `${t.y}px` });
      pins.forEach(pin => {
        const p = toStage(Number(pin.dataset.x), Number(pin.dataset.y));
        Object.assign(pin.style, { left: `${p.x}px`, top: `${p.y}px` });
      });

      const corner = toStage(406, 201);
      const bottom = toStage(318, 276);
      if (target.wide && st.width - corner.x >= 300) {
        Object.assign(panel.style, { left: `${corner.x}px`, top: `${corner.y}px`, right: "0", bottom: "0", width: "", height: "" });
      } else {
        Object.assign(panel.style, { left: "0", right: "0", top: `${bottom.y}px`, bottom: "0", width: "", height: "" });
      }
    }

    function setMapa(on) {
      if (on === mapaOn) return;
      mapaOn = on;
      mapa.classList.toggle("is-on", on);
      loops.forEach(c => (on ? c.pause() : c.play()));
      if (on) {
        animate(mapaTitulo, { opacity: [0, 1], y: [10, 0] }, { duration: 0.5, ease });
        animate(pins, { scale: [0, 1] }, { delay: stagger(0.08, { startDelay: 0.1 }), type: spring, bounce: 0.45, visualDuration: 0.5 });
        animate(panelItems, { opacity: [0, 1], x: [24, 0] }, { delay: stagger(0.07, { startDelay: 0.2 }), duration: 0.6, ease });
      }
    }

    function update(p) {
      progress = p;

      // 1. El texto se retira
      const out = range(p, 0, 0.14);
      heroText.style.opacity = String(1 - out);
      heroText.style.transform = `translateX(${-60 * out}px)`;
      heroText.style.filter = out > 0 ? `blur(${8 * out}px)` : "";
      hint.style.opacity = String(1 - range(p, 0, 0.05));
      nav.classList.toggle("con-nombre", out >= 0.5);

      // 2. La cámara entra al monitor
      const z = easeInOut(range(p, 0.04, 0.62));
      if (z > 0 && !zooming) {
        zooming = true;
        layers.forEach(layer => animate(layer, { x: 0, y: 0 }, { duration: 0.3 }));
        animate(scene, { rotateX: 0, rotateY: 0 }, { duration: 0.3 });
        measure();
      } else if (z === 0 && zooming) {
        zooming = false;
      }
      if (target) {
        zoomEl.style.transformOrigin = `${target.ox}px ${target.oy}px`;
        zoomEl.style.transform = z > 0
          ? `translate(${target.dx * z}px, ${target.dy * z}px) scale(${1 + (target.scale - 1) * z})`
          : "";
      }

      // 3. La pantalla se vuelve la interfaz real de proyectos
      const fade = range(p, 0.56, 0.66);
      mapa.style.opacity = String(fade);
      mapa.style.visibility = fade > 0 ? "visible" : "";
      setMapa(fade >= 1);
    }

    scroll(update, { target: hero, offset: ["start start", "end end"] });

    let resizeZoom;
    window.addEventListener("resize", () => {
      clearTimeout(resizeZoom);
      resizeZoom = setTimeout(() => { if (zooming) measure(); update(progress); }, 120);
    });

    /* ----- Enlaces internos que cruzan el inicio: recorren el zoom en vez de saltarlo ----- */

    // El zoom avanza con el scroll, así que un salto (o el scroll suave del navegador, que dura
    // menos de un segundo y no existe con las animaciones de Windows apagadas) lo saltea.
    // Acá el tramo del inicio se recorre despacio, con una pausa en el mapa, y el resto rápido.
    const DURACION_ZOOM = 2600; // ms para recorrer todo el inicio
    const PAUSA_MAPA = 450;
    let recorrido = null;

    const scrollInstantaneo = y => window.scrollTo({ top: y, behavior: "instant" });
    const finInicio = () => hero.offsetTop + hero.offsetHeight - window.innerHeight;
    const destinoDe = el => {
      if (el === hero) return 0;
      const padding = parseFloat(getComputedStyle(root).scrollPaddingTop) || 0;
      return Math.max(0, el.getBoundingClientRect().top + window.scrollY - padding);
    };

    function tramo(desde, hasta, duracion) {
      return new Promise(resolve => {
        const t0 = performance.now();
        const paso = now => {
          if (!recorrido) return resolve(false);
          const k = Math.min(1, (now - t0) / duracion);
          scrollInstantaneo(desde + (hasta - desde) * easeInOut(k));
          if (k < 1) requestAnimationFrame(paso); else resolve(true);
        };
        requestAnimationFrame(paso);
      });
    }
    const esperar = ms => new Promise(r => setTimeout(r, ms));
    const rapido = d => Math.min(1100, Math.max(450, Math.abs(d) * 0.5));

    async function irA(el, hash) {
      const id = {};
      recorrido = id;
      const inicio = window.scrollY;
      const destino = destinoDe(el);
      const fin = finInicio();
      const largo = Math.max(1, fin - hero.offsetTop);
      const lento = d => Math.max(500, DURACION_ZOOM * Math.abs(d) / largo);

      if (inicio < fin - 2 && destino > fin) {
        // Bajando: inicio despacio, pausa en el mapa, después rápido hasta la sección
        if (!await tramo(inicio, fin, lento(fin - inicio))) return;
        await esperar(PAUSA_MAPA);
        if (recorrido !== id || !await tramo(fin, destino, rapido(destino - fin))) return;
      } else if (inicio > fin + 2 && destino < fin) {
        // Subiendo: rápido hasta el mapa y el inicio despacio (el zoom se deshace)
        if (!await tramo(inicio, fin, rapido(inicio - fin))) return;
        if (recorrido !== id || !await tramo(fin, destino, lento(fin - destino))) return;
      } else {
        if (!await tramo(inicio, destino, rapido(destino - inicio))) return;
      }
      if (recorrido === id) recorrido = null;
      try { history.pushState(null, "", hash); } catch (err) { /* file:// en algunos navegadores */ }
    }

    // La rueda, el touch o una tecla cortan el recorrido: el usuario retoma el control
    ["wheel", "touchstart", "keydown"].forEach(ev =>
      window.addEventListener(ev, () => { recorrido = null; }, { passive: true }));

    document.addEventListener("click", e => {
      const link = e.target.closest('a[href^="#"]');
      if (!link || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const hash = link.getAttribute("href");
      if (hash.length < 2 || link.classList.contains("skip-link")) return;
      const el = document.getElementById(hash.slice(1));
      if (!el || !el.closest("main") && el !== hero) return;
      // Solo los que cruzan el inicio; los del mapa (#p-argos...) y los cercanos siguen normales
      const fin = finInicio();
      const destino = destinoDe(el);
      const cruza = (window.scrollY < fin - 2 && destino > fin) || (window.scrollY > fin + 2 && destino < fin);
      if (!cruza) return;
      e.preventDefault();
      irA(el, hash);
    });

    // Puntos del mapa y lista del panel se resaltan entre sí
    mapa.querySelectorAll("[data-p]").forEach(el => {
      const key = el.dataset.p;
      const pair = mapa.querySelectorAll(`[data-p="${key}"]`);
      el.addEventListener("pointerenter", () => pair.forEach(x => x.classList.add("is-hot")));
      el.addEventListener("pointerleave", () => pair.forEach(x => x.classList.remove("is-hot")));
      el.addEventListener("focus", () => pair.forEach(x => x.classList.add("is-hot")));
      el.addEventListener("blur", () => pair.forEach(x => x.classList.remove("is-hot")));
    });

    // Parallax de las capas de la escena con el mouse (solo antes del zoom)
    if (canHover) {
      deskIn.then(() => {
        stage.addEventListener("pointermove", e => {
          if (zooming) return;
          const r = scene.getBoundingClientRect();
          const nx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 2) / 2));
          const ny = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height / 2) / 2));
          layers.forEach(layer => {
            const d = Number(layer.dataset.depth);
            animate(layer, { x: -nx * d, y: -ny * d }, springSoft);
          });
          animate(scene, { rotateY: nx * 5, rotateX: -ny * 5, transformPerspective: 1000 }, springSoft);
        });
        stage.addEventListener("pointerleave", () => {
          if (zooming) return;
          layers.forEach(layer => animate(layer, { x: 0, y: 0 }, springSoft));
          animate(scene, { rotateY: 0, rotateX: 0 }, springSoft);
        });
      });

      // Botones del inicio con efecto magnético
      document.querySelectorAll(".hero .btn, .hero__social a").forEach(btn => {
        btn.addEventListener("pointermove", e => {
          const r = btn.getBoundingClientRect();
          animate(btn, {
            x: (e.clientX - r.left - r.width / 2) * 0.25,
            y: (e.clientY - r.top - r.height / 2) * 0.35
          }, springSoft);
        });
        btn.addEventListener("pointerleave", () => animate(btn, { x: 0, y: 0 }, springPop));
      });
    }

    // Los logos de los proyectos traen su propia animación; recargarlos la reinicia cada vez que aparecen
    document.querySelectorAll(".project__logo").forEach(logo => {
      const src = logo.getAttribute("src");
      inView(logo, () => {
        logo.src = `${src}?r=${Date.now()}`;
        return () => {}; // seguir observando para repetir al volver
      }, { amount: 0.6 });
    });

    // Portadas vivas: las capturas de SofIA se alternan mientras el caso está en pantalla
    const coverLoops = {
      "p-sofia": el => {
        const [, segunda, tercera] = el.querySelectorAll(".capturas img");
        return [
          animate(segunda, { opacity: [0, 0, 1, 1, 0, 0] },
            { duration: 12, repeat: Infinity, times: [0, 0.28, 0.33, 0.61, 0.66, 1], ease: "easeInOut" }),
          animate(tercera, { opacity: [0, 0, 1, 1, 0] },
            { duration: 12, repeat: Infinity, times: [0, 0.61, 0.66, 0.95, 1], ease: "easeInOut" })
        ];
      }
    };
    Object.entries(coverLoops).forEach(([id, start]) => {
      const caso = document.getElementById(id);
      if (!caso) return;
      inView(caso, () => {
        const controls = start(caso);
        return () => controls.forEach(c => c.stop());
      }, { amount: 0.35 });
    });

    // Sobre mí: la frase se ilumina palabra por palabra al avanzar el scroll
    const manifiesto = document.querySelector(".manifiesto");
    if (manifiesto) {
      const palabras = manifiesto.textContent.trim().split(/\s+/);
      manifiesto.setAttribute("aria-label", manifiesto.textContent.trim());
      manifiesto.innerHTML = palabras.map(w => `<span class="pm" aria-hidden="true">${w}</span>`).join(" ");
      manifiesto.classList.add("manifiesto--vivo");
      const spans = [...manifiesto.querySelectorAll(".pm")];
      scroll(p => {
        const lit = Math.round(p * spans.length);
        spans.forEach((s, i) => s.classList.toggle("is-lit", i < lit));
      }, { target: manifiesto, offset: ["start 0.85", "end 0.45"] });
    }

    // Contacto: el asunto se escribe solo la primera vez que aparece la ventana
    const asunto = document.querySelector(".asunto");
    if (asunto) {
      const texto = asunto.dataset.texto;
      asunto.textContent = "";
      inView(".mensaje", () => {
        let i = 0;
        const escribir = () => {
          asunto.textContent = texto.slice(0, ++i);
          if (i < texto.length) setTimeout(escribir, 45);
        };
        setTimeout(escribir, 300);
      }, { amount: 0.5 });
    }

    press(".btn", el => {
      animate(el, { scale: 0.94 }, { duration: 0.12 });
      return () => animate(el, { scale: 1 }, springPop);
    });
  }

  /* ---------- Copiar correo ---------- */

  const toast = document.getElementById("toast");
  let toastTimer;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2200);
  }

  const copyBtn = document.getElementById("copiar-email");
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(copyBtn.dataset.email);
      copyBtn.innerHTML = '<i class="fas fa-check"></i>';
      if (useMotion) M.animate(copyBtn.firstChild, { scale: [0, 1], rotate: [-90, 0] }, { type: M.spring, bounce: 0.5, visualDuration: 0.4 });
      showToast("Correo copiado");
      setTimeout(() => { copyBtn.innerHTML = '<i class="far fa-copy"></i>'; }, 2000);
    } catch (err) {
      showToast(copyBtn.dataset.email);
    }
  });

  /* ---------- Servicios: se enciende la fila que pasa por el centro ---------- */

  const servicios = document.querySelector(".servicios");
  if (servicios) {
    servicios.classList.add("servicios--vivo");
    const filas = [...servicios.children];
    filas[0].classList.add("is-active");
    const centro = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        filas.forEach(f => f.classList.toggle("is-active", f === entry.target));
      });
    }, { rootMargin: "-42% 0px -42% 0px" });
    filas.forEach(f => centro.observe(f));
  }

  /* ---------- Tecnologías: qué usa cada proyecto ---------- */

  const stack = document.querySelector(".stack");
  const leyenda = document.querySelectorAll(".leyenda button");
  if (stack && leyenda.length) {
    const colores = {};
    leyenda.forEach(b => { colores[b.dataset.p] = b.style.getPropertyValue("--c"); });
    const techs = [...stack.querySelectorAll("li[data-usos]")];

    // Puntos de color al lado de cada tecnología, uno por proyecto que la usa
    techs.forEach(li => {
      const usos = li.dataset.usos.split(" ").filter(Boolean);
      if (!usos.length) return;
      const nombres = usos.map(u => [...leyenda].find(b => b.dataset.p === u).textContent.trim());
      li.insertAdjacentHTML("beforeend",
        `<span class="usos" title="Usado en ${nombres.join(", ")}">${usos.map(u => `<i style="--c:${colores[u]}"></i>`).join("")}</span>`);
    });

    let fijo = null;
    const filtrar = p => {
      stack.classList.toggle("filtrando", Boolean(p));
      if (p) stack.style.setProperty("--f", colores[p]);
      techs.forEach(li => li.classList.toggle("usa", Boolean(p) && li.dataset.usos.split(" ").includes(p)));
    };
    leyenda.forEach(b => {
      b.addEventListener("pointerenter", () => filtrar(b.dataset.p));
      b.addEventListener("pointerleave", () => filtrar(fijo));
      b.addEventListener("focus", () => filtrar(b.dataset.p));
      b.addEventListener("blur", () => filtrar(fijo));
      b.addEventListener("click", () => {
        fijo = fijo === b.dataset.p ? null : b.dataset.p;
        leyenda.forEach(x => x.classList.toggle("is-on", x.dataset.p === fijo));
        b.setAttribute("aria-pressed", String(fijo === b.dataset.p));
        filtrar(fijo);
      });
    });
  }

  document.getElementById("anio").textContent = new Date().getFullYear();

  /* ---------- Fondo de partículas conectadas ---------- */

  const canvas = document.getElementById("fondo");
  const ctx = canvas.getContext("2d");
  const mouse = { x: -9999, y: -9999 };
  let particles = [];
  let width, height, dpr, rafId;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = Math.min(60, Math.floor((width * height) / 22000));
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 1.4 + 0.5
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    const linkDist = 130;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > width) p.vx *= -1;
      if (p.y < 0 || p.y > height) p.vy *= -1;

      // Repulsión suave del cursor
      const dxm = p.x - mouse.x, dym = p.y - mouse.y;
      const dm = Math.hypot(dxm, dym);
      if (dm < 120 && dm > 0) {
        p.x += (dxm / dm) * 1.2;
        p.y += (dym / dm) * 1.2;
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(160, 200, 255, 0.45)";
      ctx.fill();

      for (let j = i + 1; j < particles.length; j++) {
        const q = particles[j];
        const d = Math.hypot(p.x - q.x, p.y - q.y);
        if (d < linkDist) {
          ctx.strokeStyle = `rgba(124, 140, 255, ${(1 - d / linkDist) * 0.16})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.stroke();
        }
      }
    }
    rafId = requestAnimationFrame(draw);
  }

  resize();
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  });

  window.addEventListener("pointermove", e => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
  document.addEventListener("pointerleave", () => { mouse.x = mouse.y = -9999; });
  // Pausa la animación cuando la pestaña no está visible
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) cancelAnimationFrame(rafId);
    else rafId = requestAnimationFrame(draw);
  });
  draw();
})();
