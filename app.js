(function () {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const el = (tag, attrs = {}, children = []) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (v !== null && v !== undefined && v !== false) n.setAttribute(k, v === true ? '' : v);
    }
    for (const c of [].concat(children)) if (c) n.append(c);
    return n;
  };

  const CHEV = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const state = { data: null, byId: new Map(), parent: new Map(), view: 'hq' };

  // ---------- indexing ----------
  function index(node, parent) {
    state.byId.set(node.id, node);
    if (parent) state.parent.set(node.id, parent);
    (node.children || []).forEach((c) => index(c, node));
    (node.aside || []).forEach((c) => index(c, node));
  }

  // ---------- rendering ----------
  function nodeButton(node, depth = 2) {
    const kind = node.kind ? ` ${node.kind}` : '';
    const hasKids = !!(node.children && node.children.length);
    const btn = el('button', {
      class: `node${kind}${hasKids && depth >= 2 ? ' has-children' : ''}`,
      type: 'button',
      'data-id': node.id,
      'aria-haspopup': 'dialog',
      onclick: () => openPanel(node.id)
    });
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
    if (hasKids && depth >= 2) {
      btn.append(el('span', {
        class: 'chev',
        role: 'button',
        tabindex: '0',
        'aria-label': 'Show or hide this team',
        html: CHEV,
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
      const ul = el('ul', { class: `${layout === 'h' ? (depth === 1 ? 'h depts' : 'h') : 'v'}${hasAside ? ' tall' : ''}` });
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
    const ul = el('ul', { class: 'tree' });
    ul.append(renderTree(tree));
    rootEl.append(ul);
    placeAsides(rootEl);
  }

  function placeAsides(rootEl) {
    rootEl.querySelectorAll('li > .aside').forEach((aside) => {
      const li = aside.parentElement;
      const btn = li.querySelector(':scope > .node');
      aside.style.top = `${btn.offsetHeight + 14}px`;
    });
  }
  window.addEventListener('resize', () => { placeAsides($('#tree-hq')); placeAsides($('#tree-branch')); });

  function toggle(li, force) {
    if (!li) return;
    const collapse = force === undefined ? !li.classList.contains('collapsed') : force;
    li.classList.toggle('collapsed', collapse);
  }

  function setAll(collapsed) {
    const root = state.view === 'hq' ? $('#tree-hq') : $('#tree-branch');
    root.querySelectorAll('li').forEach((li) => {
      if (!li.querySelector(':scope > ul')) return;
      // keep the top two tiers open when collapsing, so the page never goes blank
      const depth = ancestors(li).length;
      toggle(li, collapsed && depth >= 2);
    });
  }

  function ancestors(li) {
    const out = [];
    let p = li.parentElement && li.parentElement.closest('li');
    while (p) { out.push(p); p = p.parentElement && p.parentElement.closest('li'); }
    return out;
  }

  // ---------- levels ----------
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
    const body = $('#panel-body');
    body.innerHTML = '';
    const parent = state.parent.get(id);
    const house = node.house || findHouse(id);
    if (house) body.append(el('p', { class: 'eyebrow', text: house }));
    body.append(el('h2', { id: 'panel-role', text: node.role }));
    const holderLine = el('p', { class: 'holder' });
    if (node.holder) holderLine.append(el('b', { text: node.holder }));
    if (node.title) holderLine.append(document.createTextNode(`${node.holder ? ' · ' : ''}${node.title}`));
    if (node.sub && !node.seats) holderLine.append(document.createTextNode(`${node.holder || node.title ? ' · ' : ''}${node.sub}`));
    if (holderLine.childNodes.length) body.append(holderLine);

    if (node.tags && node.tags.length) {
      const row = el('div', { class: 'pill-row' });
      node.tags.forEach((t) => row.append(el('span', { class: `pill ${t.kind || ''}`.trim(), text: t.text })));
      body.append(row);
    }

    const dl = el('dl');
    const reportsTo = node.reportsTo || (parent ? parent.role : null);
    if (reportsTo) dl.append(el('dt', { text: 'Reports to' }), el('dd', { text: reportsTo }));
    if (node.level) dl.append(el('dt', { text: 'Growth Map' }), el('dd', { text: `${node.level}${node.levelNote ? ` (${node.levelNote})` : ''}` }));
    if (node.kind === 'entity') dl.append(el('dt', { text: 'Status' }), el('dd', { text: 'Separate entity, not a MOVE reporting line' }));
    if (dl.childNodes.length) body.append(dl);

    if (node.seats) {
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

    const team = [].concat(node.aside || [], node.children || []);
    if (team.length) {
      body.append(el('p', { class: 'eyebrow', text: 'Team' }));
      const ul = el('ul', { class: 'team' });
      team.forEach((c) => {
        const b = el('button', { type: 'button', onclick: () => openPanel(c.id) });
        b.append(document.createTextNode(c.role));
        if (c.holder) b.append(el('small', { text: c.holder }));
        ul.append(el('li', {}, b));
      });
      body.append(ul);
    }

    $('#panel').classList.add('is-open');
    $('#panel').setAttribute('aria-hidden', 'false');
    $('#scrim').hidden = false;
    history.replaceState(null, '', `#${state.view}/${id}`);
  }

  function closePanel() {
    $('#panel').classList.remove('is-open');
    $('#panel').setAttribute('aria-hidden', 'true');
    $('#scrim').hidden = true;
    history.replaceState(null, '', `#${state.view}`);
  }

  function findHouse(id) {
    let n = state.byId.get(id);
    while (n) {
      if (n.house) return n.house;
      n = state.parent.get(n.id);
    }
    return null;
  }

  // ---------- search ----------
  function search(q) {
    const root = state.view === 'hq' ? $('#view-hq') : $('#view-branch');
    const term = q.trim().toLowerCase();
    root.classList.toggle('searching', !!term);
    root.querySelectorAll('.node').forEach((n) => n.classList.remove('hit', 'path'));
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
        const li = n.closest('li');
        ancestors(li).forEach((a) => { toggle(a, false); a.querySelector(':scope > .node').classList.add('path'); });
      }
    });
    $('#empty').hidden = hits > 0;
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
      ? 'Tap a box for details. Use the chevron to fold a team away.'
      : 'How every branch is organised. Tap a box for details.';
    search($('#search').value);
    history.replaceState(null, '', `#${view}`);
  }

  // ---------- boot ----------
  fetch('data/org.json', { cache: 'no-cache' })
    .then((r) => r.json())
    .then((data) => {
      state.data = data;
      $('#updated').textContent = data.updated;
      $('#updated-foot').textContent = data.updated;
      index(data.hq, null);
      index(data.entity, null);
      index(data.branch.tree, null);
      mount($('#tree-hq'), data.hq);
      $('#entity').append(nodeButton(data.entity));
      mount($('#tree-branch'), data.branch.tree);
      $('#branch-intro').textContent = data.branch.intro;
      $('#branch-note').textContent = data.branch.note;
      renderLevels(data.levels);

      document.querySelectorAll('.view-btn').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
      $('#expand').addEventListener('click', () => setAll(false));
      $('#collapse').addEventListener('click', () => setAll(true));
      $('#levels-toggle').addEventListener('click', (e) => {
        const open = $('#levels').hidden;
        $('#levels').hidden = !open;
        e.currentTarget.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      $('#search').addEventListener('input', (e) => search(e.target.value));
      $('#search').addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.target.value = ''; search(''); } });
      $('#panel-close').addEventListener('click', closePanel);
      $('#scrim').addEventListener('click', closePanel);
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });

      // deep link: #hq/coo or #branch
      const [view, id] = location.hash.replace('#', '').split('/');
      setView(view === 'branch' ? 'branch' : 'hq');
      if (id && state.byId.has(id)) openPanel(id);
    })
    .catch((err) => {
      $('#tree-hq').textContent = 'The chart data could not be loaded.';
      console.error(err);
    });
})();
