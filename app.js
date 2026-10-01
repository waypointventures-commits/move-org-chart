(function () {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const el = (tag, attrs = {}, children = []) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k === 'style') n.setAttribute('style', v);
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (v !== null && v !== undefined && v !== false) n.setAttribute(k, v === true ? '' : v);
    }
    for (const c of [].concat(children)) if (c) n.append(c);
    return n;
  };

  const CHEV = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const PEOPLE = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9" r="2.6"/><path d="M15.5 19a4.6 4.6 0 0 1 5-4.4"/></svg>';
  const BUILDING = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v15M14 9h5a1 1 0 0 1 1 1v10M3 20h18M8 8h2M8 12h2M8 16h2"/></svg>';

  // One accent per house; everything under a house inherits it.
  const ACCENT = { mh: '#11726B', eh: '#B8860B', tdh: '#3E6D9C', mkh: '#C2563C', fh: '#6E7F2B', pch: '#7B4F8E', edh: '#2E8B6A', strategy: '#4F5D75', avantej: '#11726B' };

  const state = { data: null, byId: new Map(), parent: new Map(), view: 'hq', zoom: { hq: 1, branch: 1 }, pan: { hq: { x: 0, y: 0 }, branch: { x: 0, y: 0 } } };

  // ---------- indexing ----------
  function index(node, parent) {
    state.byId.set(node.id, node);
    if (parent) state.parent.set(node.id, parent);
    (node.children || []).forEach((c) => index(c, node));
    (node.aside || []).forEach((c) => index(c, node));
  }
  function accentOf(id) {
    let n = state.byId.get(id);
    while (n) { if (ACCENT[n.id]) return ACCENT[n.id]; n = state.parent.get(n.id); }
    return null;
  }
  function houseOf(id) {
    let n = state.byId.get(id);
    while (n) { if (n.house) return n.house; n = state.parent.get(n.id); }
    return null;
  }
  function chain(id) {
    const out = [];
    let n = state.byId.get(id);
    while (n) { out.unshift(n); n = state.parent.get(n.id); }
    return out;
  }

  // ---------- avatars ----------
  const GENERIC = /per branch|per country|one per|ad hoc|council|see the|house$|·/i;
  function initials(holder) {
    if (!holder || GENERIC.test(holder)) return null;
    const parts = holder.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return null;
    return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  function avatar(node) {
    const ini = initials(node.holder);
    const a = el('span', { class: 'avatar', 'aria-hidden': 'true' });
    if (ini) a.textContent = ini;
    else a.innerHTML = node.kind === 'ref' || node.kind === 'entity' ? BUILDING : PEOPLE;
    return a;
  }

  // ---------- rendering ----------
  let seq = 0;
  function nodeButton(node, depth = 2) {
    const kind = node.kind ? ` ${node.kind}` : '';
    const hasKids = !!(node.children && node.children.length);
    const foldable = hasKids && depth >= 2;
    const accent = accentOf(node.id);
    const btn = el('button', {
      class: `node${kind}${foldable ? ' has-children' : ''}${node.level ? ' has-lvl' : ''}`,
      type: 'button',
      'data-id': node.id,
      'data-count': hasKids ? `${node.children.length} hidden` : null,
      style: `--i:${seq++};${accent ? `--accent:${accent};` : ''}`,
      'aria-haspopup': 'dialog',
      onclick: () => openPanel(node.id),
      onmouseenter: () => hover(btn, true),
      onmouseleave: () => hover(btn, false),
      onfocus: () => hover(btn, true),
      onblur: () => hover(btn, false)
    });
    btn.append(avatar(node));
    const t = el('div', { class: 't' });
    t.append(el('span', { class: 'role', text: node.role }));
    if (node.holder) t.append(el('span', { class: 'who', text: node.holder }));
    if (node.sub) t.append(el('span', { class: 'sub', text: node.sub }));
    if (node.seats) {
      const seats = el('div', { class: 'seats' });
      node.seats.forEach((s) => {
        const seat = el('div', { class: `seat${s.holder ? '' : ' open'}` });
        seat.append(el('b', { text: s.holder ? `${s.label}: ${s.holder}` : `${s.label}: open seat` }));
        if (s.note) seat.append(el('span', { class: 'note', text: s.note }));
        seats.append(seat);
      });
      t.append(seats);
    }
    (node.tags || []).forEach((tag) => t.append(el('span', { class: `hat ${tag.kind || ''}`.trim(), text: tag.text })));
    btn.append(t);
    if (node.level) btn.append(el('span', { class: 'lvl', text: node.level, title: node.levelNote ? `Level ${node.level}, ${node.levelNote}` : `Level ${node.level}` }));
    if (foldable) {
      btn.append(el('span', {
        class: 'chev', role: 'button', tabindex: '0', 'aria-label': 'Show or hide this team', html: CHEV,
        onclick: (e) => { e.stopPropagation(); toggle(btn.closest('li')); },
        onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); toggle(btn.closest('li')); } }
      }));
    }
    return btn;
  }

  function renderTree(node, depth = 0) {
    const li = el('li', { 'data-id': node.id });
    li.append(nodeButton(node, depth));
    const hasAside = !!(node.aside && node.aside.length);
    if (node.children && node.children.length) {
      const layout = node.layout === 'h' ? 'h' : 'v';
      const cols = layout === 'h' && (depth === 1 || node.rail === 'cols');
      const ul = el('ul', { class: `${layout === 'h' ? (cols ? 'h depts' : 'h') : 'v'}${hasAside ? ' tall' : ''}` });
      node.children.forEach((c) => ul.append(renderTree(c, depth + 1)));
      li.append(ul);
    }
    if (hasAside) {
      const wrap = el('div', { class: 'aside' });
      node.aside.forEach((a) => wrap.append(nodeButton(a, 1)));
      li.append(wrap);
    }
    return li;
  }

  function mount(rootEl, tree) {
    rootEl.innerHTML = '';
    seq = 0;
    const ul = el('ul', { class: 'tree' });
    ul.append(renderTree(tree));
    rootEl.append(ul);
    placeAsides(rootEl);
  }
  function placeAsides(rootEl) {
    rootEl.querySelectorAll('li > .aside').forEach((aside) => {
      const btn = aside.parentElement.querySelector(':scope > .node');
      aside.style.top = `${btn.offsetHeight + 16}px`;
    });
  }

  function toggle(li, force) {
    if (!li) return;
    const collapse = force === undefined ? !li.classList.contains('collapsed') : force;
    li.classList.toggle('collapsed', collapse);
    apply(state.view);
  }
  function setAll(collapsed) {
    const root = state.view === 'hq' ? $('#tree-hq') : $('#tree-branch');
    root.querySelectorAll('li').forEach((li) => {
      if (!li.querySelector(':scope > ul')) return;
      li.classList.toggle('collapsed', collapsed && ancestors(li).length >= 2);
    });
    fit(state.view);
  }
  function ancestors(li) {
    const out = [];
    let p = li.parentElement && li.parentElement.closest('li');
    while (p) { out.push(p); p = p.parentElement && p.parentElement.closest('li'); }
    return out;
  }

  // ---------- stats and levels ----------
  function renderStats(data) {
    let seats = 0, open = 0, houses = 0;
    const walk = (n) => {
      if (n.house) houses++;
      if (n.kind !== 'ref' && n.kind !== 'entity' && n.kind !== 'adhoc' && n.id !== 'cm') seats++;
      if (n.seats) n.seats.forEach((s) => { seats++; if (!s.holder) open++; });
      (n.children || []).forEach(walk); (n.aside || []).forEach(walk);
    };
    walk(data.hq);
    const stats = $('#stats');
    [[houses, 'Houses'], [seats, 'Seats'], [3, 'Countries'], [open, 'Open seats']].forEach(([v, k]) => {
      stats.append(el('div', { class: 'stat' }, [el('b', { text: String(v) }), el('span', { text: k })]));
    });
  }
  function renderLevels(levels) {
    const grid = $('#levels-grid');
    grid.innerHTML = '';
    levels.forEach((lv) => {
      const card = el('div', { class: 'lv' });
      card.append(el('div', { class: 'lv-head' }, [el('span', { class: 'num', text: lv.id }), el('span', { class: 'name', text: lv.name })]));
      const ul = el('ul');
      lv.who.forEach((w) => ul.append(el('li', { text: w })));
      card.append(ul);
      grid.append(card);
    });
  }

  // ---------- panel ----------
  function openPanel(id) {
    const node = state.byId.get(id);
    if (!node) return;
    const parent = state.parent.get(id);
    const accent = accentOf(id) || '#11726B';
    const wrap = $('#panel-content');
    wrap.innerHTML = '';
    wrap.setAttribute('style', `--accent:${accent}`);

    const head = el('div', { class: 'panel-head' });
    const path = chain(id);
    if (path.length > 1) {
      const crumbs = el('div', { class: 'crumbs' });
      path.slice(0, -1).forEach((n, i) => {
        if (i) crumbs.append(el('span', { class: 'sep', text: '›' }));
        crumbs.append(el('button', { type: 'button', text: initials(n.holder) ? n.holder : n.role, onclick: () => openPanel(n.id) }));
      });
      head.append(crumbs);
    }
    const idRow = el('div', { class: 'id' });
    idRow.append(avatar(node));
    const titles = el('div');
    const house = node.house || houseOf(id);
    if (house) titles.append(el('p', { class: 'eyebrow', text: house }));
    titles.append(el('h2', { id: 'panel-role', text: node.role }));
    const holderLine = el('p', { class: 'holder' });
    if (node.holder) holderLine.append(el('b', { text: node.holder }));
    if (node.title) holderLine.append(document.createTextNode(`${node.holder ? ' · ' : ''}${node.title}`));
    if (node.sub && !node.seats) holderLine.append(document.createTextNode(`${node.holder || node.title ? ' · ' : ''}${node.sub}`));
    if (holderLine.childNodes.length) titles.append(holderLine);
    idRow.append(titles);
    head.append(idRow);
    wrap.append(head);

    const body = el('div', { class: 'panel-body' });
    const facts = el('div', { class: 'facts' });
    const reportsTo = node.reportsTo || (parent ? parent.role : null);
    if (reportsTo) {
      const f = el('div', { class: 'fact' }, [el('small', { text: 'Reports to' })]);
      if (parent && parent.kind !== 'ref') f.append(el('button', { type: 'button', text: reportsTo, onclick: () => openPanel(parent.id) }));
      else f.append(el('b', { text: reportsTo }));
      facts.append(f);
    }
    if (node.level) facts.append(el('div', { class: 'fact' }, [el('small', { text: 'Growth Map' }), el('b', { text: `${node.level}${node.levelNote ? ` · ${node.levelNote}` : ''}` })]));
    if (node.kind === 'entity') facts.append(el('div', { class: 'fact' }, [el('small', { text: 'Status' }), el('b', { text: 'Separate entity' })]));
    if (facts.childNodes.length) body.append(facts);

    if (node.tags && node.tags.length) {
      const row = el('div', { class: 'pill-row' });
      node.tags.forEach((t) => row.append(el('span', { class: `pill ${t.kind || ''}`.trim(), text: t.text })));
      body.append(row);
    }
    if (node.seats) {
      body.append(el('h3', { text: 'Seats' }));
      const ul = el('ul', { class: 'seatlist' });
      node.seats.forEach((s) => {
        const li = el('li');
        li.append(el('span', { text: s.label }));
        li.append(s.holder ? el('b', { text: s.holder }) : el('span', { class: 'open', text: 'Open seat' }));
        ul.append(li);
      });
      body.append(ul);
    }
    if (node.about) body.append(el('p', { class: 'about', text: node.about }));
    if (node.duties && node.duties.length) {
      body.append(el('h3', { text: 'What this seat owns' }));
      const ul = el('ul', { class: 'duties' });
      node.duties.forEach((t) => ul.append(el('li', { text: t })));
      body.append(ul);
    }
    const team = [].concat(node.aside || [], node.children || []);
    if (team.length) {
      body.append(el('h3', { text: 'Team' }));
      const ul = el('ul', { class: 'team' });
      team.forEach((c) => {
        const b = el('button', { type: 'button', style: `--accent:${accentOf(c.id) || accent}`, onclick: () => openPanel(c.id) });
        b.append(avatar(c));
        const tx = el('span');
        tx.append(document.createTextNode(c.role));
        if (c.holder) tx.append(el('small', { text: c.holder }));
        b.append(tx);
        ul.append(el('li', {}, b));
      });
      body.append(ul);
    }
    wrap.append(body);

    $('#panel').classList.add('is-open');
    $('#panel').setAttribute('aria-hidden', 'false');
    $('#panel').scrollTop = 0;
    $('#scrim').hidden = false;
    history.replaceState(null, '', `#${state.view}/${id}`);
  }
  function closePanel() {
    $('#panel').classList.remove('is-open');
    $('#panel').setAttribute('aria-hidden', 'true');
    $('#scrim').hidden = true;
    history.replaceState(null, '', `#${state.view}`);
  }

  // ---------- route lighting ----------
  function clearRoute(root) {
    root.querySelectorAll('.on-path, .on-route, .rl, .rr').forEach((n) => n.classList.remove('on-path', 'on-route', 'rl', 'rr'));
    root.querySelectorAll('.node.path').forEach((n) => n.classList.remove('path'));
    root.classList.remove('lit');
  }
  function lightRoute(nodeEl) {
    const root = nodeEl.closest('.view');
    root.classList.add('lit');
    const asideWrap = nodeEl.closest('.aside');
    if (asideWrap) {
      asideWrap.classList.add('on-path');
      const hostLi = asideWrap.closest('li');
      const ul = hostLi.querySelector(':scope > ul');
      if (ul) ul.classList.add('on-route');
      climb(hostLi, true);
      return;
    }
    climb(nodeEl.closest('li'), false);
  }
  function climb(li, markSelf) {
    let cur = li;
    while (cur) {
      cur.classList.add('on-path');
      if (cur !== li || markSelf) { const b = cur.querySelector(':scope > .node'); if (b) b.classList.add('path'); }
      const ul = cur.parentElement;
      if (!ul || !ul.classList.contains('h') && !ul.classList.contains('v')) break;
      ul.classList.add('on-route');
      const kids = Array.from(ul.children);
      const i = kids.indexOf(cur);
      if (ul.classList.contains('v')) {
        kids.slice(0, i).forEach((k) => k.classList.add('rl'));
      } else {
        const n = kids.length, mid = 0.5, c = (i + 0.5) / n;
        const lo = Math.min(c, mid), hi = Math.max(c, mid);
        kids.forEach((k, j) => {
          if (j === i) return;
          const l = j / n, m = (j + 0.5) / n, r = (j + 1) / n;
          if (l >= lo - 1e-6 && m <= hi + 1e-6) k.classList.add('rl');
          if (m >= lo - 1e-6 && r <= hi + 1e-6) k.classList.add('rr');
        });
      }
      const parentLi = ul.closest('li');
      if (!parentLi) break;
      cur = parentLi;
    }
  }
  function hover(btn, on) {
    if (window.matchMedia('(hover: none)').matches) return;
    const root = btn.closest('.view');
    if (!root || root.classList.contains('searching')) return;
    clearRoute(root);
    root.classList.toggle('hovering', on);
    if (on) lightRoute(btn);
  }

  // ---------- search ----------
  function search(q) {
    const root = state.view === 'hq' ? $('#view-hq') : $('#view-branch');
    const term = q.trim().toLowerCase();
    root.classList.remove('hovering');
    root.classList.toggle('searching', !!term);
    root.querySelectorAll('.node').forEach((n) => n.classList.remove('hit'));
    clearRoute(root);
    $('#empty').hidden = true;
    if (!term) return;
    let hits = 0;
    root.querySelectorAll('.node').forEach((n) => {
      const node = state.byId.get(n.dataset.id);
      const hay = [node.role, node.holder, node.title, node.sub, node.house, ...(node.seats || []).map((s) => `${s.label} ${s.holder || ''}`), ...(node.tags || []).map((t) => t.text)]
        .filter(Boolean).join(' ').toLowerCase();
      if (hay.includes(term)) {
        hits++;
        n.classList.add('hit');
        ancestors(n.closest('li')).forEach((a) => a.classList.remove('collapsed'));
        lightRoute(n);
      }
    });
    $('#empty').hidden = hits > 0;
    apply(state.view);
  }

  // ---------- pan and zoom (desktop only) ----------
  function isDesktop() { return window.matchMedia('(min-width: 900px)').matches; }
  function apply(view) {
    const root = $(`#tree-${view}`), canvas = $(`#canvas-${view}`);
    if (!isDesktop()) { root.style.transform = ''; canvas.style.height = ''; return; }
    const z = state.zoom[view], p = state.pan[view];
    root.style.transform = `translate(${p.x}px, ${p.y}px) scale(${z})`;
    canvas.style.height = `${Math.max(420, root.offsetHeight * z + p.y + 20)}px`;
  }
  function fit(view) {
    if (!isDesktop()) { apply(view); return; }
    const canvas = $(`#canvas-${view}`), root = $(`#tree-${view}`);
    const z = Math.min(1, (canvas.clientWidth - 16) / root.offsetWidth);
    state.zoom[view] = Math.max(0.45, z);
    state.pan[view] = { x: Math.max(0, (canvas.clientWidth - root.offsetWidth * state.zoom[view]) / 2), y: 0 };
    apply(view);
  }
  function zoomBy(view, factor) {
    const canvas = $(`#canvas-${view}`);
    const z0 = state.zoom[view];
    const z = Math.min(1.8, Math.max(0.45, z0 * factor));
    const cx = canvas.clientWidth / 2;
    state.pan[view].x = cx - (cx - state.pan[view].x) * (z / z0);
    state.zoom[view] = z;
    apply(view);
  }
  function wirePanZoom(view) {
    const canvas = $(`#canvas-${view}`);
    canvas.querySelectorAll('[data-zoom]').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.zoom;
      if (k === 'fit') fit(view); else zoomBy(view, k === 'in' ? 1.2 : 1 / 1.2);
    }));
    let drag = null;
    canvas.addEventListener('pointerdown', (e) => {
      if (!isDesktop() || e.button !== 0 || e.target.closest('.zoom')) return;
      drag = { x: e.clientX, y: e.clientY, px: state.pan[view].x, py: state.pan[view].y, moved: false, id: e.pointerId };
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 5) return;
      if (!drag.moved) { drag.moved = true; canvas.classList.add('dragging'); try { canvas.setPointerCapture(drag.id); } catch (err) { /* ignore */ } }
      state.pan[view] = { x: drag.px + dx, y: drag.py + dy };
      apply(view);
    });
    const end = () => {
      if (!drag) return;
      if (drag.moved) setTimeout(() => canvas.classList.remove('dragging'), 0);
      drag = null;
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('wheel', (e) => {
      if (!isDesktop() || !(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      zoomBy(view, e.deltaY < 0 ? 1.1 : 1 / 1.1);
    }, { passive: false });
  }

  // ---------- views ----------
  function setView(view) {
    state.view = view;
    document.querySelectorAll('.view-btn').forEach((b) => {
      const on = b.dataset.view === view;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    $('#view-hq').hidden = view !== 'hq';
    $('#view-branch').hidden = view !== 'branch';
    $('#hint').textContent = view === 'hq'
      ? 'Tap a box for details. Drag to pan, use the buttons to zoom, or hover a box to trace its line.'
      : 'How every branch is organised. Tap a box for details.';
    search($('#search').value);
    history.replaceState(null, '', `#${view}`);
    requestAnimationFrame(() => fit(view));
  }

  // ---------- theme ----------
  function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('move-theme', t); } catch (e) { /* storage unavailable */ }
  }
  function currentTheme() {
    const explicit = document.documentElement.getAttribute('data-theme');
    if (explicit) return explicit;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  // ---------- boot ----------
  fetch('data/org.json', { cache: 'no-cache' })
    .then((r) => r.json())
    .then((data) => {
      state.data = data;
      $('#updated-foot').textContent = data.updated;
      index(data.hq, null);
      index(data.entity, null);
      index(data.branch.tree, null);
      mount($('#tree-hq'), data.hq);
      $('#entity').append(nodeButton(data.entity));
      mount($('#tree-branch'), data.branch.tree);
      $('#branch-intro').textContent = data.branch.intro;
      $('#branch-note').textContent = data.branch.note;
      renderStats(data);
      renderLevels(data.levels);
      wirePanZoom('hq');
      wirePanZoom('branch');

      document.querySelectorAll('.view-btn').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
      $('#expand').addEventListener('click', () => setAll(false));
      $('#collapse').addEventListener('click', () => setAll(true));
      $('#levels-toggle').addEventListener('click', (e) => {
        const open = $('#levels').hidden;
        $('#levels').hidden = !open;
        e.currentTarget.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      $('#theme').addEventListener('click', () => setTheme(currentTheme() === 'dark' ? 'light' : 'dark'));
      $('#search').addEventListener('input', (e) => search(e.target.value));
      $('#search').addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.target.value = ''; search(''); e.target.blur(); } });
      $('#panel-close').addEventListener('click', closePanel);
      $('#scrim').addEventListener('click', closePanel);
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closePanel();
        if (e.key === '/' && !/input|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); $('#search').focus(); }
      });
      window.addEventListener('resize', () => { placeAsides($('#tree-hq')); placeAsides($('#tree-branch')); fit(state.view); });
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { placeAsides($('#tree-hq')); fit(state.view); });

      const [view, id] = location.hash.replace('#', '').split('/');
      setView(view === 'branch' ? 'branch' : 'hq');
      if (id && state.byId.has(id)) openPanel(id);
    })
    .catch((err) => {
      $('#tree-hq').textContent = 'The chart data could not be loaded.';
      console.error(err);
    });
})();
