/**
 * Under the Cloak — shell, router, command palette.
 *
 * Classic scripts rather than ES modules, deliberately: this has to open by
 * double-clicking index.html from a file:// URL, and module imports fail CORS
 * there. Everything hangs off window.Atlas and load order is set in index.html.
 */
window.Atlas = window.Atlas || {};

Atlas.app = (function () {
  'use strict';
  const { esc, $ } = Atlas.ui;

  const ORDER = ['map', 'keys', 'flows', 'custody', 'roles', 'events', 'risks', 'catalogue'];

  const GROUPS = [
    { label: 'Understand', items: ['map', 'keys', 'flows'] },
    { label: 'Operate', items: ['custody', 'roles', 'events'] },
    { label: 'Assess', items: ['risks'] },
    { label: 'Look up', items: ['catalogue'] },
  ];

  const ICONS = {
    map: 'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z M9 3v15 M15 6v15',
    keys: 'M15 7a4 4 0 1 0-3.4 3.95L13 12l2 2 2-2 2 2 2-2-4.5-4.5A4 4 0 0 0 15 7z',
    flows: 'M4 6h10 M4 12h16 M4 18h7 M17 3l4 3-4 3 M14 15l4 3-4 3',
    custody: 'M12 2l8 4v6c0 5-3.4 9-8 10-4.6-1-8-5-8-10V6z',
    roles: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M3 20a6 6 0 0 1 12 0 M17 8a2.5 2.5 0 1 0 0-5 M17 20a5 5 0 0 0-1.5-3.6',
    events: 'M4 4h16v4H4z M4 12h16v4H4z M8 8v4 M16 16v4',
    risks: 'M12 3l9 16H3z M12 9v5 M12 17v.5',
    catalogue: 'M4 5h16 M4 10h16 M4 15h16 M4 20h10',
  };

  let currentView = null;

  function icon(id) {
    return `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="${ICONS[id] || ''}"></path></svg>`;
  }

  /* ── routing ──────────────────────────────────────────────────────────── */

  function go(id, opts) {
    const view = Atlas.views[id];
    if (!view) return go('map');

    const stage = $('#stage');

    if (currentView && currentView.teardown) currentView.teardown(stage);
    Atlas.ui.closeInspector();

    stage.innerHTML = '';
    stage.scrollTop = 0;
    currentView = view;
    view.render(stage);

    if (!opts || !opts.silent) {
      const hash = '#/' + id;
      if (location.hash !== hash) history.pushState({ view: id }, '', hash);
    }

    document.title = view.title + ' — Under the Cloak';
    paintNav();
    closeNavDrawer();
  }

  function paintNav() {
    $('#nav').innerHTML = GROUPS.map(
      (g) => `
      <div class="nav-group">
        <div class="nav-group-label">${esc(g.label)}</div>
        ${g.items
          .map((id) => {
            const v = Atlas.views[id];
            if (!v) return '';
            return `
            <button class="nav-item" data-view="${esc(id)}"
                    aria-current="${currentView && currentView.id === id}">
              ${icon(id)}
              <span>${esc(v.label)}</span>
              <span class="nav-item-hint">${esc(v.hint || '')}</span>
            </button>`;
          })
          .join('')}
      </div>`,
    ).join('');
  }

  function fromHash() {
    const id = (location.hash || '').replace(/^#\/?/, '');
    return ORDER.includes(id) ? id : 'map';
  }

  /* ── nav drawer (small screens) ───────────────────────────────────────── */

  function toggleNavDrawer() {
    const shell = $('#shell');
    shell.dataset.nav = shell.dataset.nav === 'open' ? 'closed' : 'open';
  }
  function closeNavDrawer() {
    const shell = $('#shell');
    if (shell) shell.dataset.nav = 'closed';
  }

  /* ── command palette ──────────────────────────────────────────────────── */

  let paletteItems = [];
  let paletteActive = 0;

  function buildIndex() {
    const out = [];

    ORDER.forEach((id) => {
      const v = Atlas.views[id];
      if (v) out.push({ kind: 'view', label: v.label, sub: v.hint, run: () => go(id) });
    });

    Atlas.keys.forEach((k) =>
      out.push({
        kind: 'key',
        label: k.name,
        sub: k.size,
        haystack: k.summary,
        run: () => {
          go('keys');
          Atlas.ui.inspectKey(k.id);
        },
      }),
    );

    Atlas.flows.forEach((f) =>
      out.push({
        kind: 'flow',
        label: f.name,
        sub: f.steps.length + ' steps',
        haystack: f.lede,
        run: () => {
          Atlas.views.flows.open(f.id);
          go('flows');
        },
      }),
    );

    Atlas.risks.forEach((r) =>
      out.push({
        kind: 'risk',
        label: r.name,
        sub: r.severity,
        haystack: r.summary,
        run: () => {
          go('risks');
          Atlas.views.risks.inspectRisk(r);
        },
      }),
    );

    Atlas.envelopes.forEach((e) =>
      out.push({
        kind: 'field',
        label: e.field,
        sub: e.holds,
        haystack: e.wrappedBy + ' ' + e.primitive,
        run: () => {
          go('keys');
          Atlas.ui.inspectKey(e.opensWith);
        },
      }),
    );

    Atlas.events.groups.forEach((g) =>
      g.actions.forEach((a) =>
        out.push({
          kind: 'event',
          label: a.id,
          sub: g.name,
          haystack: a.blurb,
          run: () => go('events'),
        }),
      ),
    );

    Atlas.primitives.forEach((p) =>
      out.push({ kind: 'primitive', label: p.name, sub: p.role, haystack: p.blurb, run: () => go('map') }),
    );

    Atlas.glossary.forEach((t) =>
      out.push({
        kind: 'term',
        label: t.term,
        sub: t.expand || 'term',
        haystack: t.def,
        run: () => go('catalogue'),
      }),
    );

    return out;
  }

  function search(q) {
    const needle = q.trim().toLowerCase();
    if (!needle) return paletteItems.slice(0, 9);
    const scored = [];
    for (const item of paletteItems) {
      const label = item.label.toLowerCase();
      const hay = ((item.sub || '') + ' ' + (item.haystack || '')).toLowerCase();
      let score = -1;
      if (label.startsWith(needle)) score = 0;
      else if (label.includes(needle)) score = 1;
      else if (hay.includes(needle)) score = 2;
      if (score >= 0) scored.push({ item, score });
    }
    scored.sort((a, b) => a.score - b.score || a.item.label.length - b.item.label.length);
    return scored.slice(0, 24).map((s) => s.item);
  }

  let results = [];

  function paintPalette() {
    const q = $('#palette-input').value;
    results = search(q);
    paletteActive = Math.min(paletteActive, Math.max(0, results.length - 1));

    $('#palette-results').innerHTML = results.length
      ? results
          .map(
            (r, i) => `
        <button class="presult" data-idx="${i}" data-active="${i === paletteActive}">
          <span class="presult-kind">${esc(r.kind)}</span>
          <span>${esc(r.label)}</span>
          <span class="presult-sub">${esc(r.sub || '')}</span>
        </button>`,
          )
          .join('')
      : `<div class="palette-empty">Nothing matches &ldquo;${esc(q)}&rdquo;</div>`;
  }

  function openPalette() {
    const back = $('#palette-backdrop');
    back.hidden = false;
    const input = $('#palette-input');
    input.value = '';
    paletteActive = 0;
    paintPalette();
    input.focus();
  }

  function closePalette() {
    $('#palette-backdrop').hidden = true;
  }

  function runActive() {
    const item = results[paletteActive];
    if (!item) return;
    closePalette();
    item.run();
  }

  /* ── boot ─────────────────────────────────────────────────────────────── */

  function init() {
    paletteItems = buildIndex();

    $('#nav').addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-view]');
      if (btn) go(btn.dataset.view);
    });

    $('#nav-toggle').addEventListener('click', toggleNavDrawer);
    $('#palette-open').addEventListener('click', openPalette);

    $('#palette-input').addEventListener('input', paintPalette);

    $('#palette-results').addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-idx]');
      if (!btn) return;
      paletteActive = Number(btn.dataset.idx);
      runActive();
    });

    $('#palette-backdrop').addEventListener('mousedown', (ev) => {
      if (ev.target.id === 'palette-backdrop') closePalette();
    });

    document.addEventListener('keydown', (ev) => {
      const paletteOpen = !$('#palette-backdrop').hidden;

      if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 'k') {
        ev.preventDefault();
        paletteOpen ? closePalette() : openPalette();
        return;
      }

      if (ev.key === 'Escape') {
        if (paletteOpen) closePalette();
        else if (Atlas.ui.inspectorOpen()) Atlas.ui.closeInspector();
        else closeNavDrawer();
        return;
      }

      if (paletteOpen) {
        if (ev.key === 'ArrowDown') {
          ev.preventDefault();
          paletteActive = Math.min(results.length - 1, paletteActive + 1);
          paintPalette();
        } else if (ev.key === 'ArrowUp') {
          ev.preventDefault();
          paletteActive = Math.max(0, paletteActive - 1);
          paintPalette();
        } else if (ev.key === 'Enter') {
          ev.preventDefault();
          runActive();
        }
        return;
      }

      /* Number keys jump between views, when not typing in a field. */
      const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
      if (!typing && /^[1-8]$/.test(ev.key)) {
        go(ORDER[Number(ev.key) - 1]);
      }
    });

    window.addEventListener('popstate', () => go(fromHash(), { silent: true }));

    go(fromHash(), { silent: true });
  }

  return { init, go };
})();

document.addEventListener('DOMContentLoaded', Atlas.app.init);
