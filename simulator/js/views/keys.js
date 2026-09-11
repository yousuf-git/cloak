/**
 * Keys — the hierarchy as a graph you can interrogate.
 *
 * Two modes. "Everything" shows the whole lattice. Trace mode picks one human
 * secret and lights only what that secret can actually reach, which is the
 * fastest way to answer the question people really have: if someone holds this,
 * what can they open?
 */
window.Atlas = window.Atlas || {};
Atlas.views = Atlas.views || {};

Atlas.views.keys = (function () {
  'use strict';
  const { esc, codeRef } = Atlas.ui;

  const W = 46; /* node height */

  /* Hand-placed so the edges read cleanly. x, y are the top-left corner. */
  const LAYOUT = {
    'master-password':  { x: 24,  y: 110, w: 148 },
    'recovery-key':     { x: 24,  y: 214, w: 148 },
    'org-recovery-key': { x: 24,  y: 462, w: 148 },

    'master-key':       { x: 216, y: 100, w: 172 },
    'auth-hash':        { x: 216, y: 162, w: 172 },
    'recovery-wk':      { x: 216, y: 224, w: 172 },
    'org-recovery-wk':  { x: 216, y: 462, w: 172 },

    'personal-dek':     { x: 432, y: 148, w: 156 },
    'identity-sk':      { x: 432, y: 248, w: 156 },
    'identity-pk':      { x: 432, y: 324, w: 156 },

    'org-dek':          { x: 632, y: 386, w: 148 },

    'dotenvx-sk':       { x: 806, y: 300, w: 168 },
    'vault-fields':     { x: 806, y: 392, w: 168 },
    'env-values':       { x: 806, y: 478, w: 168 },
  };

  const SERVER = { x: 716, y: 14, w: 224, h: 44 };
  const BOUNDARY = { x: 8, y: 78, w: 1012, h: 500 };

  /* Edges drawn on the canvas. `dashed` marks a break-glass or informational
     relationship rather than the everyday path. */
  const EDGES = [
    ['master-password', 'master-key'],
    ['master-password', 'auth-hash'],
    ['recovery-key', 'recovery-wk'],
    ['org-recovery-key', 'org-recovery-wk'],
    ['master-key', 'personal-dek'],
    ['recovery-wk', 'personal-dek'],
    ['personal-dek', 'identity-sk'],
    ['identity-sk', 'identity-pk', { dashed: true }],
    ['identity-sk', 'org-dek'],
    ['org-recovery-wk', 'org-dek', { dashed: true }],
    ['org-dek', 'dotenvx-sk'],
    ['org-dek', 'vault-fields'],
    ['dotenvx-sk', 'env-values'],
  ];

  const ROOTS = ['master-password', 'recovery-key', 'org-recovery-key'];

  let trace = null; /* null = show everything */

  /* Node subtitles are a fixed width; anything longer gets clipped visually. */
  function shortSize(size) {
    return size.length > 22 ? size.slice(0, 21) + '\u2026' : size;
  }

  /* ── geometry ─────────────────────────────────────────────────────────── */
  const box = (id) => {
    const p = LAYOUT[id];
    return { ...p, h: W, cx: p.x + p.w / 2, cy: p.y + W / 2, right: p.x + p.w, bottom: p.y + W };
  };

  function curve(a, b) {
    const dx = Math.max(34, (b.x - a.right) * 0.55);
    return `M ${a.right} ${a.cy} C ${a.right + dx} ${a.cy}, ${b.x - dx} ${b.cy}, ${b.x} ${b.cy}`;
  }

  /** Everything reachable downstream of a root, following `unlocks`. */
  function reachable(rootId) {
    const seen = new Set([rootId]);
    const queue = [rootId];
    while (queue.length) {
      const k = Atlas.ui.keyById(queue.shift());
      if (!k) continue;
      for (const next of k.unlocks) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    /* identity-pk hangs off identity-sk as an informational edge, not an unlock. */
    if (seen.has('identity-sk')) seen.add('identity-pk');
    return seen;
  }

  /* ── render ───────────────────────────────────────────────────────────── */

  function svg() {
    const lit = trace ? reachable(trace) : null;

    const edges = EDGES.map(([from, to, opt]) => {
      const a = box(from);
      const b = box(to);
      const on = !lit || (lit.has(from) && lit.has(to));
      return `<path class="gedge" d="${curve(a, b)}"
        ${opt && opt.dashed ? 'data-dashed="true"' : ''}
        ${lit ? (on ? 'data-lit="true"' : 'data-dim="true"') : ''} />`;
    }).join('');

    /* authHash leaving the boundary for the server. */
    const ah = box('auth-hash');
    const wireOn = !lit || lit.has('auth-hash');
    const wire = `<path class="gedge" data-dashed="true"
      d="M ${ah.right} ${ah.cy} C ${ah.right + 150} ${ah.cy}, ${SERVER.x - 120} ${SERVER.y + SERVER.h / 2}, ${SERVER.x} ${SERVER.y + SERVER.h / 2}"
      ${lit ? (wireOn ? 'data-lit="true"' : 'data-dim="true"') : ''} />`;

    const nodes = Object.keys(LAYOUT)
      .map((id) => {
        const k = Atlas.ui.keyById(id);
        if (!k) return '';
        const b = box(id);
        const on = !lit || lit.has(id);
        return `
          <g class="gnode" data-node="${esc(id)}"
             data-kind="${esc(k.kind)}"
             ${k.keystone ? 'data-keystone="true"' : ''}
             ${lit ? (on ? 'data-lit="true"' : 'data-dim="true"') : ''}
             tabindex="0" role="button" aria-label="${esc(k.name)}">
            <rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="7"></rect>
            <text x="${b.x + 12}" y="${b.y + 19}">${esc(k.name)}</text>
            <text class="gsub" x="${b.x + 12}" y="${b.y + 34}">${esc(shortSize(k.size))}</text>
          </g>`;
      })
      .join('');

    return `
      <svg class="graph-svg" viewBox="0 0 1032 596" width="100%" height="596"
           role="img" aria-label="Cloak key hierarchy">
        <defs>
          <marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4"
                  markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 8 4 L 0 8 z" fill="#3B4757"></path>
          </marker>
          <marker id="arrow-lit" viewBox="0 0 8 8" refX="7" refY="4"
                  markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 8 4 L 0 8 z" fill="#E8C65A"></path>
          </marker>
        </defs>

        <rect class="gboundary" x="${BOUNDARY.x}" y="${BOUNDARY.y}"
              width="${BOUNDARY.w}" height="${BOUNDARY.h}" rx="11"></rect>
        <text class="gboundary-label" x="${BOUNDARY.x + 16}" y="${BOUNDARY.y + 20}">
          on the user&#39;s device &mdash; nothing below ever leaves
        </text>

        <g class="gnode" data-node="__server" style="cursor:default">
          <rect x="${SERVER.x}" y="${SERVER.y}" width="${SERVER.w}" height="${SERVER.h}"
                rx="7" style="fill:#141922;stroke:#29323F"></rect>
          <text x="${SERVER.x + 14}" y="${SERVER.y + 19}">To the server</text>
          <text class="gsub" x="${SERVER.x + 14}" y="${SERVER.y + 33}">proves identity, decrypts nothing</text>
        </g>

        ${edges}
        ${wire}
        ${nodes}
      </svg>`;
  }

  function controls() {
    const btn = (id, label) =>
      `<button class="flow-tab" data-trace="${esc(id)}" aria-selected="${trace === id}"
         style="padding:6px 12px">${esc(label)}</button>`;
    return `
      <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:14px">
        <span class="hint" style="margin-right:6px">Trace from</span>
        <button class="flow-tab" data-trace="" aria-selected="${trace === null}"
                style="padding:6px 12px">Everything</button>
        ${ROOTS.map((id) => btn(id, Atlas.ui.keyById(id).name)).join('')}
      </div>`;
  }

  function traceNote() {
    if (!trace) {
      return `<p class="hint">Each arrow is one lock opening the next. Pick a secret above to see only what it reaches.</p>`;
    }
    const k = Atlas.ui.keyById(trace);
    const set = reachable(trace);
    const opens = Array.from(set).filter((id) => id !== trace).length;
    const reachesData = set.has('vault-fields');
    return `
      <div class="panel panel-brass" style="margin-top:4px">
        <p class="insp-text">
          <strong>${esc(k.name)}</strong> opens ${opens} further ${opens === 1 ? 'thing' : 'things'}.
          ${
            reachesData
              ? 'That path reaches vault ciphertext, so this secret is sufficient to read the org&rsquo;s data.'
              : 'That path does not reach vault ciphertext on its own.'
          }
        </p>
      </div>`;
  }

  function paint(stage) {
    Atlas.ui.$('#graph', stage).innerHTML = svg();
    Atlas.ui.$('#graph-controls', stage).innerHTML = controls();
    Atlas.ui.$('#trace-note', stage).innerHTML = traceNote();
  }

  function render(stage) {
    trace = null;
    stage.innerHTML = `
      <div class="stage-head">
        <h1 class="stage-title">Key hierarchy</h1>
        <p class="stage-lede">
          A chain of locks. Each level opens exactly the next one, and only the bottom level &mdash;
          the Org DEK &mdash; ever touches real data. That is why changing a password is cheap:
          it re-wraps 32 bytes and re-encrypts nothing.
        </p>
      </div>

      <div id="graph-controls"></div>
      <div class="graph-wrap" id="graph"></div>
      <div id="trace-note" style="margin-top:12px"></div>

      <div class="section">
        <h2 class="section-title">Stored envelopes</h2>
        <p class="stage-lede" style="font-size:14px;margin-bottom:14px">
          What the database actually holds. Every one of these is opaque to the server,
          which has no key that opens any of them.
        </p>
        <div class="grid-2">
          ${Atlas.envelopes
            .map(
              (e) => `
            <div class="panel">
              <div class="mono" style="font-size:12.5px;color:var(--paper);margin-bottom:9px">${esc(e.field)}</div>
              <dl style="margin:0">
                ${Atlas.ui.row('Holds', esc(e.holds))}
                ${Atlas.ui.row('Wrapped by', esc(e.wrappedBy))}
                ${Atlas.ui.row('Primitive', esc(e.primitive))}
                ${Atlas.ui.row(
                  'Opened by',
                  `<button class="chip chip-brass" data-key-link="${esc(e.opensWith)}" style="cursor:pointer">${esc(
                    Atlas.ui.keyById(e.opensWith).name,
                  )}</button>`,
                )}
              </dl>
              ${e.note ? `<p class="insp-text" style="margin-top:10px;font-size:12.5px">${esc(e.note)}</p>` : ''}
            </div>`,
            )
            .join('')}
        </div>
      </div>

      <div class="section">
        <h2 class="section-title">Hashed, not encrypted</h2>
        <p class="stage-lede" style="font-size:14px;margin-bottom:14px">
          These are one-way. Nobody reverses them &mdash; not the server, not an attacker with the
          whole database. You can only re-hash a candidate and compare.
        </p>
        <div class="grid-2">
          ${Atlas.hashes
            .map(
              (h) => `
            <div class="panel">
              <div class="mono" style="font-size:12.5px;color:var(--paper);margin-bottom:7px">${esc(h.field)}</div>
              <div style="display:flex;gap:6px;margin-bottom:9px">
                ${Atlas.ui.chip(h.primitive)}${Atlas.ui.chip('of ' + h.of)}
              </div>
              <p class="insp-text" style="font-size:12.5px">${esc(h.why)}</p>
              <div style="margin-top:10px">${codeRef(h.code)}</div>
            </div>`,
            )
            .join('')}
        </div>
      </div>
    `;

    paint(stage);
    stage.addEventListener('click', onClick);
    stage.addEventListener('keydown', onKeydown);
    stage._paint = () => paint(stage);
  }

  function onClick(ev) {
    const t = ev.target.closest('[data-trace]');
    if (t) {
      trace = t.dataset.trace || null;
      ev.currentTarget._paint();
      return;
    }
    const node = ev.target.closest('[data-node]');
    if (node && node.dataset.node !== '__server') Atlas.ui.inspectKey(node.dataset.node);
  }

  function onKeydown(ev) {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    const node = ev.target.closest('[data-node]');
    if (node && node.dataset.node !== '__server') {
      ev.preventDefault();
      Atlas.ui.inspectKey(node.dataset.node);
    }
  }

  function teardown(stage) {
    stage.removeEventListener('click', onClick);
    stage.removeEventListener('keydown', onKeydown);
  }

  return { id: 'keys', label: 'Keys', hint: 'graph', title: 'Key hierarchy', render, teardown };
})();
