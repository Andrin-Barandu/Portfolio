(() => {
  "use strict";
  const data = window.PORTFOLIO;
  const desktop = document.querySelector("#desktop");
  const windowsRoot = document.querySelector("#windows");
  const mobile = window.matchMedia("(max-width:760px)");
  const states = new Map();
  let topZ = 10;
  let lastFocus = null;
  let desktopHidden = false;
  const escape = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );
  const safeURL = (value) => {
    if (!value) return "";
    try {
      const url = new URL(value, location.href);
      return ["http:", "https:", "file:"].includes(url.protocol)
        ? escape(value)
        : "";
    } catch {
      return "";
    }
  };
  const announce = (text) => {
    document.querySelector("#announcer").textContent = text;
  };
  const category = (id) => data.categories.find((item) => item.id === id);
  const apps = [
    { id: "work", name: "Portfolio", symbol: "▥" },
    { id: "about", name: "About", symbol: "ab" },
    { id: "cv", name: "CV", symbol: "CV" },
    { id: "contact", name: "Contact", symbol: "✉" },
  ];
  function cover(project) {
    const words = {
      ekz: "ekz",
      photo: "Frames.",
      motion: "move.",
      "3d": "3D /",
      branding: "Aa.",
      print: "PAPER",
      web: "Hello_",
    };
    const image = safeURL(project.thumbnail);
    return `<div class="cover cover-${escape(project.cover || "web")}">${image ? `<img src="${image}" alt="${escape(project.title)}" loading="lazy">` : `<span class="cover-kicker">${escape(category(project.category)?.name || "Selected work")}</span><span class="cover-word">${escape(project.coverText || words[project.cover] || project.title)}</span><span class="cover-bottom">${project.id === "ekz" ? "Unternehmenskommunikation" : project.placeholder ? "Portfolio preview" : project.subtitle || ""}</span>`}</div>`;
  }
  function renderDesktop() {
    document.querySelector("#desktop-icons").innerHTML =
      data.categories
        .map(
          (item) =>
            `<button class="desktop-icon" data-folder="${escape(item.id)}" aria-label="${escape(item.name)} öffnen"><span class="folder-icon"><span class="folder-symbol">${escape(item.symbol)}</span></span><span>${escape(item.name)}</span></button>`,
        )
        .join("") +
      apps
        .slice(1)
        .map(
          (item) =>
            `<button class="desktop-icon" data-folder="${item.id}" aria-label="${item.name} öffnen"><span class="file-icon">${item.symbol}</span><span>${item.name}${item.id === "cv" ? ".pdf" : ""}</span></button>`,
        )
        .join("");
    document.querySelector("#dock-apps").innerHTML = apps
      .map(
        (item) =>
          `<button class="dock-button" data-open="${item.id}" aria-label="${item.name} öffnen"><span class="dock-icon ${item.id}-app">${item.symbol}</span><span class="dock-label">${item.name}</span></button>`,
      )
      .join("");
  }
  function syncDock() {
    document
      .querySelectorAll("#dock-apps [data-open]")
      .forEach((button) =>
        button.classList.toggle("running", states.has(button.dataset.open)),
      );
    const tray = document.querySelector("#dock-minimized");
    const minimized = [...states.values()].filter(s =>
      (s.minimized || s.dockRestoring) && !apps.some(a => a.id === s.id));
    const ids = new Set(minimized.map(s => s.id));
    for (const button of tray.querySelectorAll('[data-restore]')) {
      if (!ids.has(button.dataset.restore)) button.remove();
    }
    for (const state of minimized) {
      if ([...tray.children].some(button => button.dataset.restore === state.id)) continue;
      const button = document.createElement('button');
      button.className = 'dock-button';
      button.dataset.restore = state.id;
      button.setAttribute('aria-label', `${state.title} wiederherstellen`);
      button.title = state.title;
      button.innerHTML = `<span class="dock-icon minimized-app">${escape(state.title.slice(0, 3))}</span>`;
      tray.append(button);
    }
  }
  function focusWindow(state, keyboard = false) {
    states.forEach((s) => {
      s.el.classList.remove("active");
      if (mobile.matches) s.el.inert = true;
    });
    state.el.classList.add("active");
    state.el.style.zIndex = ++topZ;
    state.el.inert = false;
    lastFocus = state.id;
    if (keyboard) state.el.focus({ preventScroll: true });
  }
  function focusNext() {
    const next = [...states.values()]
      .filter((s) => !s.minimized)
      .sort((a, b) => Number(b.el.style.zIndex) - Number(a.el.style.zIndex))[0];
    if (next) focusWindow(next, true);
    else {
      lastFocus = null;
      document
        .querySelector('[data-open="work"]')
        .focus({ preventScroll: true });
    }
  }
  // Animate the live window into its own dock slot, without duplicating media.
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  function dockTarget(state) {
    return [...document.querySelectorAll("[data-restore], #dock-apps [data-open]")]
      .find(button => button.dataset.restore === state.id || button.dataset.open === state.id)
      || document.querySelector('[data-open="work"]');
  }
  function animateDock(state, minimizing) {
    const el = state.el;
    const previous = state.dockAnimation;
    const interrupted = previous && previous.playState !== "finished";
    const current = interrupted ? {
      transform:getComputedStyle(el).transform,
      opacity:getComputedStyle(el).opacity
    } : null;
    if (previous) { previous.onfinish=null; previous.cancel(); }
    // The entrance animation must never restart after the dock animation ends.
    el.style.animation = 'none';
    el.classList.add('dock-animating');
    el.classList.remove('minimized');
    el.style.transformOrigin = '50% 100%';
    state.dockRestoring = !minimizing;
    state.minimized = minimizing;
    syncDock();
    const target = dockTarget(state);
    const tray = document.querySelector('#dock-minimized');
    if (target?.parentElement === tray) {
      const t=target.getBoundingClientRect(), r=tray.getBoundingClientRect();
      if (t.right > r.right-8) tray.scrollLeft += t.right-r.right+8;
      else if (t.left < r.left+8) tray.scrollLeft -= r.left-t.left+8;
    }
    const from = el.getBoundingClientRect();
    const to = target.querySelector('.dock-icon')?.getBoundingClientRect() || target.getBoundingClientRect();
    const dx = to.left+to.width/2-(from.left+from.width/2);
    const dy = to.top+to.height-from.bottom;
    const scale = Math.max(.01,Math.min(to.width/from.width,to.height/from.height));
    const full = {transform:'translate3d(0,0,0) scale(1)',opacity:1};
    const small = {transform:`translate3d(${dx}px,${dy}px,0) scale(${scale})`,opacity:0};
    // One interpolation curve, with no clip-path repaint or intermediate stops.
    const frames = minimizing ? [current || full,small] : [current || small,full];
    if (minimizing) { el.inert=true;el.setAttribute('aria-hidden','true');focusNext(); }
    else { el.inert=false;el.removeAttribute('aria-hidden');focusWindow(state,true); }
    const finish = () => {
      const animation = state.dockAnimation;
      if (animation) animation.onfinish=null;
      // Commit the final CSS state while transitions are still disabled.
      el.classList.toggle('minimized',state.minimized);
      animation?.cancel();
      state.dockAnimation=null;
      el.style.removeProperty('transform-origin');
      void el.offsetWidth;
      el.classList.remove('dock-animating');
      state.dockRestoring=false;
      syncDock();
    };
    if (reducedMotion.matches || !el.animate) {finish();return;}
    state.dockAnimation=el.animate(frames,{
      duration:interrupted?300:520,
      easing:'cubic-bezier(.25,.1,.25,1)',fill:'both'
    });
    state.dockAnimation.onfinish=finish;
  }
  function minimize(state) {
    if (state.minimized) return;
    animateDock(state,true);
    announce(`${state.title} minimiert. Im Dock wieder öffnen.`);
  }
  function restore(state) {
    if (!state) return;
    if (!state.minimized) {focusWindow(state,true);return;}
    animateDock(state,false);
  }
  function closeWindow(state) {
    if (state.dockAnimation) {state.dockAnimation.onfinish=null;state.dockAnimation.cancel();}
    state.el.classList.remove("dock-animating");
    states.delete(state.id);
    state.el.classList.add("closing");
    state.el.inert = true;
    setTimeout(() => state.el.remove(), 190);
    syncDock();
    focusNext();
    announce(`${state.title} geschlossen`);
  }
  function maximize(state) {
    if (mobile.matches || state.dockAnimation) return;
    state.maximized = !state.maximized;
    state.el.classList.toggle("maximized", state.maximized);
    state.el
      .querySelector(".maximize")
      .setAttribute(
        "aria-label",
        state.maximized
          ? "Fenstergrösse wiederherstellen"
          : "Fenster maximieren",
      );
    focusWindow(state);
  }
  function clampWindow(state) {
    if (mobile.matches || state.maximized) return;
    const width = desktop.clientWidth,
      height = desktop.clientHeight;
    const w = Math.min(
      parseFloat(state.el.style.width),
      Math.max(340, width - 20),
    );
    const h = Math.min(
      parseFloat(state.el.style.height),
      Math.max(250, height - 110),
    );
    state.el.style.width = w + "px";
    state.el.style.height = h + "px";
    state.el.style.left =
      Math.max(8, Math.min(parseFloat(state.el.style.left), width - w - 8)) +
      "px";
    state.el.style.top =
      Math.max(8, Math.min(parseFloat(state.el.style.top), height - h - 100)) +
      "px";
  }
  function createWindow(id, title, html, options = {}) {
    if (states.has(id)) {
      restore(states.get(id));
      return states.get(id);
    }
    const el = document.createElement("section");
    el.className = `window ${options.className || ""}`;
    el.dataset.window = id;
    el.tabIndex = -1;
    el.setAttribute("role", "region");
    el.setAttribute("aria-label", title);
    const offset = (states.size % 5) * 24;
    Object.assign(el.style, {
      left: (options.x ?? 160 + offset) + "px",
      top: (options.y ?? 60 + offset) + "px",
      width: (options.width ?? 690) + "px",
      height: (options.height ?? 470) + "px",
    });
    el.innerHTML = `<div class="titlebar"><div class="traffic"><button class="close" aria-label="${escape(title)} schliessen" title="Schliessen"><span>×</span></button><button class="minimize" aria-label="${escape(title)} minimieren" title="Minimieren"><span>−</span></button><button class="maximize" aria-label="Fenster maximieren" title="Maximieren"><span>↗</span></button></div><div class="titlebar-title">${escape(title)}</div></div><div class="window-body">${html}</div>${options.status ? `<div class="finder-status">${escape(options.status)}</div>` : ""}<div class="resize-handle" aria-hidden="true"></div>`;
    const state = { id, title, el, minimized: false, maximized: false };
    states.set(id, state);
    windowsRoot.append(el);
    el.addEventListener("pointerdown", () => focusWindow(state));
    el.addEventListener("focusin", () => {
      if (!el.classList.contains("active")) focusWindow(state);
    });
    el.querySelector(".close").onclick = () => closeWindow(state);
    el.querySelector(".minimize").onclick = () => minimize(state);
    el.querySelector(".maximize").onclick = () => maximize(state);
    const titlebar = el.querySelector(".titlebar");
    titlebar.addEventListener("dblclick", (e) => {
      if (!e.target.closest("button")) maximize(state);
    });
    function manipulation(handle, resizing) {
      handle.addEventListener("pointerdown", (e) => {
        if (
          mobile.matches ||
          state.maximized || state.dockAnimation ||
          e.button !== 0 ||
          e.target.closest("button")
        )
          return;
        e.preventDefault();
        focusWindow(state);
        handle.setPointerCapture(e.pointerId);
        const origin = {
          x: e.clientX,
          y: e.clientY,
          left: el.offsetLeft,
          top: el.offsetTop,
          width: el.offsetWidth,
          height: el.offsetHeight,
        };
        const move = (event) => {
          const dx = event.clientX - origin.x,
            dy = event.clientY - origin.y;
          if (resizing) {
            el.style.width =
              Math.min(
                Math.max(340, origin.width + dx),
                desktop.clientWidth - origin.left - 8,
              ) + "px";
            el.style.height =
              Math.min(
                Math.max(250, origin.height + dy),
                desktop.clientHeight - origin.top - 100,
              ) + "px";
          } else {
            el.style.left =
              Math.max(
                0,
                Math.min(
                  origin.left + dx,
                  desktop.clientWidth - el.offsetWidth,
                ),
              ) + "px";
            el.style.top =
              Math.max(
                0,
                Math.min(origin.top + dy, desktop.clientHeight - 148),
              ) + "px";
          }
        };
        const end = () => {
          handle.removeEventListener("pointermove", move);
          handle.removeEventListener("pointerup", end);
          handle.removeEventListener("pointercancel", end);
        };
        handle.addEventListener("pointermove", move);
        handle.addEventListener("pointerup", end);
        handle.addEventListener("pointercancel", end);
      });
    }
    manipulation(titlebar, false);
    manipulation(el.querySelector(".resize-handle"), true);
    clampWindow(state);
    focusWindow(state);
    syncDock();
    return state;
  }
  function sidebar(selected) {
    return `<aside class="sidebar"><p class="side-label">FAVORITEN</p><button class="side-button ${selected === "work" ? "selected" : ""}" data-open="work"><span class="side-symbol">▦</span>Alle Arbeiten</button>${data.categories.map((c) => `<button class="side-button ${selected === c.id ? "selected" : ""}" data-open="${escape(c.id)}"><span class="side-symbol">${escape(c.symbol)}</span>${escape(c.name)}</button>`).join("")}<p class="side-label" style="margin-top:25px">PERSÖNLICH</p>${apps
      .slice(1)
      .map(
        (a) =>
          `<button class="side-button ${selected === a.id ? "selected" : ""}" data-open="${a.id}"><span class="side-symbol">${a.id === "about" ? "☻" : a.id === "cv" ? "▤" : "✉"}</span>${a.name}</button>`,
      )
      .join("")}</aside>`;
  }
  // All Finder navigation shares one window identity, including its dock slot.
  function showFinder(title, html, status, selected) {
    let state = states.get('work');
    if (!state) {
      state = createWindow('work', title, html, {
        width:720,height:500,x:Math.max(32,desktop.clientWidth*.2),y:75,status
      });
    } else {
      state.title = title;
      state.el.setAttribute('aria-label',title);
      state.el.querySelector('.titlebar-title').textContent=title;
      state.el.querySelector('.close').setAttribute('aria-label',`${title} schliessen`);
      state.el.querySelector('.minimize').setAttribute('aria-label',`${title} minimieren`);
      state.el.querySelector('.window-body').innerHTML=html;
      state.el.querySelector('.finder-status').textContent=status;
      restore(state);
    }
    state.finderLocation=selected;
    for (const button of state.el.querySelectorAll('.sidebar [data-open]')) {
      if (button.dataset.open===selected) button.setAttribute('aria-current','page');
      else button.removeAttribute('aria-current');
    }
    const body=state.el.querySelector('.window-body');
    body.scrollTop=0;
    // Replaced sidebar controls must not leave keyboard focus on a removed node.
    const heading=body.querySelector('h1,h2');
    if (heading) {heading.tabIndex=-1;heading.focus({preventScroll:true});}
    return state;
  }
  function openFinder(id) {
    const current = category(id);
    const projects = data.projects.filter(
      (p) => id === "work" || p.category === id,
    );
    const title = current?.name || "Alle Arbeiten";
    const html = `<div class="finder">${sidebar(id)}<div class="finder-main"><div class="finder-toolbar"><div><h2>${escape(title)}</h2><p>${escape(current?.description || "Eine Auswahl aus meiner kreativen Welt.")}</p></div><span class="view-label" aria-hidden="true">▦</span></div><div class="project-grid">${projects.map((p) => `<button class="project-card" data-project="${escape(p.id)}">${cover(p)}<h3>${escape(p.title)}</h3><p>${escape(p.subtitle)}</p></button>`).join("") || '<p class="empty-note">Neue Arbeiten folgen.</p>'}</div></div></div>`;
    return showFinder(title, html,
      `${projects.length} ${projects.length === 1 ? "Projekt" : "Projekte"} · Andrin Barandun`,id);
  }

  function videoPlayer(project) {
    if (!/^[A-Za-z0-9_-]{11}$/.test(project.youtubeId || '')) return '';
    return `<div class="youtube-player"><button class="video-load" data-play-video="${project.youtubeId}" data-video-title="${escape(project.title)}"><span aria-hidden="true">▷</span><strong>${escape(project.title)}</strong><span>Video abspielen</span></button></div><p class="video-fallback"><a href="https://www.youtube.com/watch?v=${project.youtubeId}" target="_blank" rel="noopener noreferrer">Auf YouTube ansehen ↗</a></p>`;
  }
  function openProject(id) {
    const p = data.projects.find((p) => p.id === id);
    if (!p) return;
    const metadata = [
      p.role && `<span>Rolle<br><strong>${escape(p.role)}</strong></span>`,
      p.year && `<span>Jahr<br><strong>${escape(p.year)}</strong></span>`,
      p.tools?.length &&
        `<span>Tools<br><strong>${escape(p.tools.join(" · "))}</strong></span>`,
    ]
      .filter(Boolean)
      .join("");
    const media = (p.images || [])
      .filter((url) => safeURL(url))
      .map(
        (url, i) =>
          `<img class="detail-image" src="${safeURL(url)}" alt="${escape(p.title)} — Ansicht ${i + 1}" loading="lazy">`,
      )
      .join("");
    createWindow(
      "project-" + id,
      p.title + " — " + (p.subtitle || ""),
      `<article class="project-detail">${cover(p)}<div class="content-page"><p class="eyebrow">${escape(p.label || category(p.category)?.name || "Projekt")}</p><h1>${escape(p.title)}</h1><p class="detail-subtitle">${escape(p.subtitle)}</p>${metadata ? `<div class="detail-meta">${metadata}</div>` : ""}<p>${escape(p.description)}</p>${videoPlayer(p)}${p.placeholder ? '<div class="empty-note">Projektvorschau · Originalmedien und vollständige Projektbeschreibung folgen.</div>' : ""}${(p.sections || []).map((s) => `<h2>${escape(s.title)}</h2><p>${escape(s.text)}</p>`).join("")}${
        safeURL(p.video)
          ? p.video.includes("youtube.com/embed/")
            ? `<div class="detail-video-wrapper">
         <iframe
           class="detail-video"
           src="${safeURL(p.video)}"
           title="${escape(p.title)}"
           allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
           allowfullscreen>
         </iframe>
       </div>`
            : `<video
         class="detail-video"
         controls
         playsinline
         preload="metadata"
         src="${safeURL(p.video)}">
       </video>`
          : ""
      }${media}${safeURL(p.url) ? `<a class="primary" href="${safeURL(p.url)}" target="_blank" rel="noopener noreferrer">${escape(p.urlLabel || "Projekt besuchen ↗")}</a>` : ""}</div></article>`,
      {
        width: 660,
        height: 560,
        x: Math.max(24, desktop.clientWidth * 0.29),
        y: 45,
      },
    );
  }
  function open(id, inFinder = false) {
    desktopHidden = false;
    if (id === "work" || category(id)) {
      openFinder(id);
      return;
    }
    if (!inFinder && states.has(id)) {
      restore(states.get(id));
      return;
    }
    const showWindow = inFinder
      ? (viewId,title,html) => showFinder(title,
          `<div class="finder">${sidebar(viewId)}<div class="finder-main">${html}</div></div>`,
          'Andrin Barandun',viewId)
      : createWindow;
    if (id === "welcome")
      showWindow(
        id,
        "Willkommen auf meinem Desktop",
        `<p class="eyebrow">Design · Film · Digital</p><h1>Andrin<br>Barandun<span>.</span></h1><p class="intro">${escape(data.title)}<br>${escape(data.intro)}</p><div class="welcome-actions"><button class="primary" data-open="work">Arbeiten entdecken <span>↗</span></button><button class="secondary" data-open="about">Über mich</button></div><p class="welcome-footer">Viele Disziplinen. Eine kreative Perspektive.</p>`,
        {
          className: "welcome-window",
          width: 435,
          height: 395,
          x: Math.max(30, desktop.clientWidth * 0.065),
          y: Math.max(210, desktop.clientHeight * 0.32),
        },
      );
    if (id === "featured") {
      const p = data.projects.find((p) => p.id === "ekz");
      if (!p) return;
      showWindow(
        id,
        "Projekt — EKZ",
        `${p.thumbnail ? cover(p) : '<div class="featured-cover"><p class="eyebrow">PROJEKT / EKZ</p><span class="featured-logo">ekz</span><div class="feature-caption"><span>Energie in Geschichten.</span><span>VIDEO ↗</span></div></div>'}<div class="featured-info"><div><h2>EKZ Unternehmenskommunikation</h2><p>Konzeption · Produktion · Postproduktion</p></div><button class="round-link" data-project="ekz" aria-label="EKZ Projekt öffnen">↗</button></div>`,
        {
          className: "featured-window",
          width: 410,
          height: 358,
          x: Math.max(465, desktop.clientWidth * 0.435),
          y: Math.max(90, desktop.clientHeight * 0.15),
        },
      );
    }
    if (id === "about")
      showWindow(
        id,
        "About — Andrin",
        `<article class="content-page"><div class="large-letter">ab.</div><p class="eyebrow">Hallo, ich bin Andrin.</p><h1>${escape(data.intro)}</h1><p>${escape(data.about)}</p><div class="skill-tags">${data.categories.map((c) => `<span>${escape(c.name)}</span>`).join("")}</div><button class="primary" data-open="contact">Kontakt aufnehmen ↗</button></article>`,
        { width: 520, height: 540 },
      );
    if (id === "cv")
      showWindow(
        id,
        "CV — Andrin Barandun",
        `<article class="content-page"><p class="eyebrow">Lebenslauf</p><h1>${escape(data.name)}</h1><p>${escape(data.title)}</p>${safeURL(data.cv) ? `<p>Erfahrung, Ausbildung und Kompetenzen auf einen Blick.</p><a class="primary" href="${safeURL(data.cv)}" target="_blank" rel="noopener" download>Lebenslauf herunterladen ↓</a>` : '<div class="empty-note">Der Lebenslauf wird hier als PDF ergänzt.</div>'}</article>`,
        { width: 480, height: 380 },
      );
    if (id === "contact")
      showWindow(
        id,
        "Contact — Let’s talk",
        `<article class="content-page"><p class="eyebrow">Kontakt</p><h1>Gute Ideen beginnen<br>mit einem Hallo.</h1><p>Für kreative Projekte und neue Perspektiven.</p>${data.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) ? `<a class="primary" href="mailto:${escape(encodeURIComponent(data.email).replace("%40", "@"))}">${escape(data.email)} ↗</a>` : '<div class="empty-note">Die Kontaktadresse wird bald ergänzt.</div>'}</article>`,
        { width: 480, height: 350 },
      );
  }
  renderDesktop();
  document.addEventListener("click", (e) => {
    const play = e.target.closest('[data-play-video]');
    if (play && /^[A-Za-z0-9_-]{11}$/.test(play.dataset.playVideo)) {
      const frame = document.createElement('iframe');
      frame.src = `https://www.youtube-nocookie.com/embed/${play.dataset.playVideo}?autoplay=1&rel=0`;
      frame.title = play.dataset.videoTitle;
      frame.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share';
      frame.allowFullscreen = true;
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      play.replaceWith(frame);return;
    }
    const opener = e.target.closest("[data-open]");
    if (opener) {
      open(opener.dataset.open, Boolean(opener.closest(".sidebar")));
      return;
    }
    const project = e.target.closest("[data-project]");
    if (project) {
      openProject(project.dataset.project);
      return;
    }
    const restorer = e.target.closest("[data-restore]");
    if (restorer) {
      restore(states.get(restorer.dataset.restore));
      return;
    }
    const icon = e.target.closest("[data-folder]");
    if (icon) {
      document
        .querySelectorAll(".desktop-icon")
        .forEach((i) => i.classList.remove("selected"));
      icon.classList.add("selected");
      if (mobile.matches || e.detail === 0 || e.pointerType === "touch")
        open(icon.dataset.folder);
      return;
    }
    if (e.target.closest("[data-desktop]")) {
      if (!desktopHidden) {
        const visible = [...states.values()].filter((s) => !s.minimized);
        visible.forEach((s) => {
          s.hiddenByDesktop = true;
          minimize(s);
        });
        desktopHidden = true;
      } else {
        states.forEach((s) => {
          if (s.hiddenByDesktop) {
            restore(s);
            s.hiddenByDesktop = false;
          }
        });
        desktopHidden = false;
      }
    }
  });
  document.querySelector("#desktop-icons").addEventListener("dblclick", (e) => {
    const icon = e.target.closest("[data-folder]");
    if (icon) open(icon.dataset.folder);
  });
  document.querySelector("#desktop-icons").addEventListener("keydown", (e) => {
    const icons = [...document.querySelectorAll(".desktop-icon")];
    const i = icons.indexOf(document.activeElement);
    if (i < 0) return;
    if (["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].includes(e.key)) {
      e.preventDefault();
      icons[
        (i +
          (e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : -1) +
          icons.length) %
          icons.length
      ].focus();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && lastFocus && states.has(lastFocus)) {
      e.preventDefault();
      closeWindow(states.get(lastFocus));
    }
  });
  window.addEventListener("resize", () => {
    states.forEach(clampWindow);
    states.forEach(
      (s) =>
        (s.el.inert =
          s.minimized ||
          (mobile.matches && !s.el.classList.contains("active"))),
    );
  });
  function tick() {
    const now = new Date();
    document.querySelector("#clock").textContent = new Intl.DateTimeFormat(
      "de-CH",
      {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      },
    ).format(now);
    document.querySelector("#clock").dateTime = now.toISOString();
  }
  tick();
  setInterval(tick, 30000);
  if (!mobile.matches) {
    open("featured");
    open("welcome");
  }
})();
