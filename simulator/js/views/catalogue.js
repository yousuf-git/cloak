/**
 * Catalogue — everything in one flat, filterable table.
 *
 * The other views explain. This one just answers "what is that thing" as fast
 * as possible. Rows are derived from the same records the other views read,
 * never copied, so there is exactly one place a fact can go stale.
 */
window.Atlas = window.Atlas || {};
Atlas.views = Atlas.views || {};

Atlas.views.catalogue = (function () {
  'use strict';
  const { esc, codeRef, inspect } = Atlas.ui;

  /* Ordered by how often someone comes looking for the thing. */
  const CATEGORIES = [
    { id: 'term', label: 'Terms' },
    { id: 'key', label: 'Keys' },
    { id: 'envelope', label: 'Envelopes' },
    { id: 'hash', label: 'Hashes' },
    { id: 'field', label: 'Stored fields' },
    { id: 'zone', label: 'Places' },
    { id: 'role', label: 'Roles' },
    { id: 'capability', label: 'Capabilities' },
    { id: 'flow', label: 'Flows' },
    { id: 'state', label: 'States' },
    { id: 'event', label: 'Events' },
    { id: 'secret', label: 'Server secrets' },
    { id: 'primitive', label: 'Primitives' },
    { id: 'risk', label: 'Risks' },
    { id: 'loss', label: 'If you lose it' },
  ];

  let filter = '';
  let category = 'all';
  let sort = 'grouped';

  /** `desktop/src-tauri/src/crypto/kdf.rs:22` -> `kdf.rs:22`, full path on hover. */
  function shortCode(path) {
    if (!path) return '<span class="cat-dim">&mdash;</span>';
    const tail = path.split('/').pop();
    return `<span class="code-ref" title="${esc(path)}">${esc(tail)}</span>`;
  }

  /* ── build rows from the canonical records ────────────────────────────── */

  function buildRows() {
    const rows = [];
    const zone = (id) => {
      const z = Atlas.ui.zoneById(id);
      return z ? z.short : id;
    };

    Atlas.glossary.forEach((t) =>
      rows.push({
        category: 'term',
        name: t.term,
        shape: t.expand || '\u2014',
        lives: 'vocabulary',
        note: t.def,
        code: t.code || null,
        haystack: (t.expand || '') + ' ' + (t.seeAlso || ''),
        open: () =>
          inspect({
            kicker: 'term',
            title: t.term,
            body: `
              ${t.expand ? `<div class="insp-section"><div class="insp-label">Short for</div>
                <p class="insp-text">${esc(t.expand)}</p></div>` : ''}
              <div class="insp-section"><p class="insp-text">${esc(t.def)}</p></div>
              ${t.seeAlso ? `<div class="insp-section"><div class="insp-label">See also</div>
                <p class="insp-text">${esc(t.seeAlso)}</p></div>` : ''}
              ${t.code ? `<div class="insp-section"><div class="insp-label">Source</div>${codeRef(t.code)}</div>` : ''}`,
          }),
      }),
    );

    Atlas.keys.forEach((k) =>
      rows.push({
        category: 'key',
        name: k.name,
        shape: k.size,
        shapeMono: true,
        lives: zone(k.zone),
        note: k.form,
        code: k.code,
        tone: k.public ? 'verd' : k.zone === 'device-ram' || k.zone === 'ephemeral' ? 'brass' : null,
        haystack: [k.kind, k.group, k.summary, k.produced].join(' '),
        open: () => Atlas.ui.inspectKey(k.id),
      }),
    );

    Atlas.envelopes.forEach((e) =>
      rows.push({
        category: 'envelope',
        name: e.field,
        mono: true,
        shape: e.primitive,
        lives: 'Database',
        note: e.holds + ', wrapped by ' + e.wrappedBy,
        code: null,
        haystack: [e.holds, e.wrappedBy, e.note || ''].join(' '),
        open: () => Atlas.ui.inspectKey(e.opensWith),
      }),
    );

    Atlas.hashes.forEach((h) =>
      rows.push({
        category: 'hash',
        name: h.field,
        mono: true,
        shape: h.primitive,
        lives: 'Database',
        note: 'One-way hash of ' + h.of,
        code: h.code,
        haystack: h.why,
        open: () =>
          inspect({
            kicker: 'one-way hash',
            title: h.field,
            body: `
              <div class="insp-section"><p class="insp-text">${esc(h.why)}</p></div>
              <div class="insp-section"><div class="insp-label">Properties</div><dl style="margin:0">
                ${Atlas.ui.row('Hash of', esc(h.of))}
                ${Atlas.ui.row('Primitive', esc(h.primitive))}
                ${Atlas.ui.row('Reversible', 'No — you can only re-hash and compare')}
              </dl></div>
              <div class="insp-section"><div class="insp-label">Source</div>${codeRef(h.code)}</div>`,
          }),
      }),
    );

    Atlas.serverSecrets.forEach((s) =>
      rows.push({
        category: 'secret',
        name: s.name,
        mono: true,
        shape: s.size,
        lives: 'Host .env',
        note: s.purpose,
        code: 'api/.env.example',
        tone: s.risk ? 'rust' : null,
        haystack: s.rotation,
        open: () =>
          inspect({
            kicker: 'server deployment secret',
            title: s.name,
            body: `
              <div class="insp-section">
                <p class="insp-text">${esc(s.purpose)}</p>
                <p class="insp-text"><strong>This cannot decrypt vault data.</strong> An attacker
                  who reads the whole environment file can forge access tokens and impersonate any
                  user at the API, which gets them ciphertext and nothing else.</p>
              </div>
              <div class="insp-section"><div class="insp-label">Properties</div><dl style="margin:0">
                ${Atlas.ui.row('Size', esc(s.size))}
                ${Atlas.ui.row('If rotated', esc(s.rotation))}
                ${Atlas.ui.row('At rest', 'Plaintext on the server host')}
              </dl></div>
              ${
                s.risk
                  ? `<div class="insp-section"><div class="insp-label">Known issue</div>
                     <button class="chip chip-rust" data-risk-jump="${esc(s.risk)}" style="cursor:pointer">
                       ${esc(Atlas.ui.riskById(s.risk).name)}</button></div>`
                  : ''
              }`,
          }),
      }),
    );

    Atlas.primitives.forEach((p) =>
      rows.push({
        category: 'primitive',
        name: p.name,
        shape: p.verb,
        lives: 'Device',
        note: p.blurb,
        code: p.code,
        haystack: [p.role, p.detail].join(' '),
        open: () =>
          inspect({
            kicker: p.role,
            title: p.name,
            body: `
              <div class="insp-section"><p class="insp-text">${esc(p.detail)}</p></div>
              <div class="insp-section"><div class="insp-label">Parameters</div><dl style="margin:0">
                ${p.params.map(([k, v]) => Atlas.ui.row(k, esc(v))).join('')}
              </dl></div>
              <div class="insp-section"><div class="insp-label">Source</div>${codeRef(p.code)}</div>`,
          }),
      }),
    );

    Atlas.encryptedFields.forEach((f) =>
      rows.push({
        category: 'field',
        name: f.collection,
        mono: true,
        shape: 'collection',
        lives: 'Database',
        note: 'Encrypted: ' + f.encrypted,
        extra: 'Plaintext: ' + f.plain,
        code: null,
        haystack: f.encrypted + ' ' + f.plain,
        open: () =>
          inspect({
            kicker: 'stored collection',
            title: f.collection,
            body: `
              <div class="insp-section"><div class="insp-label">Encrypted under the Org DEK</div>
                <p class="insp-text mono" style="color:var(--brass-lit)">${esc(f.encrypted)}</p></div>
              <div class="insp-section"><div class="insp-label">Readable in a database dump</div>
                <p class="insp-text mono">${esc(f.plain)}</p></div>
              <div class="insp-section">
                <p class="insp-text">Everything not listed as encrypted is stored in the clear so the
                  client can list, search and sort without decrypting first.</p></div>`,
          }),
      }),
    );

    Atlas.events.groups.forEach((g) =>
      g.actions.forEach((a) =>
        rows.push({
          category: 'event',
          name: a.id,
          mono: true,
          shape: g.name,
          lives: 'audit-log',
          note: a.blurb,
          code: null,
          tone: a.weight === 'high' ? 'brass' : null,
          haystack: g.name,
          open: null,
        }),
      ),
    );

    Atlas.risks.forEach((r) =>
      rows.push({
        category: 'risk',
        name: r.name,
        shape: r.severity,
        lives: '—',
        note: r.summary,
        code: r.code,
        tone: r.severity === 'inherent' || r.severity === 'operational' ? 'rust' : null,
        haystack: [r.mechanism, r.defence, r.residual].join(' '),
        open: () => Atlas.views.risks.inspectRisk(r),
      }),
    );

    Atlas.zones.forEach((z) =>
      rows.push({
        category: 'zone',
        name: z.name,
        shape: z.custody === 'none' ? 'not stored' : z.custody,
        lives: z.short,
        note: z.blurb,
        code: z.code,
        tone: z.custody === 'user' || z.custody === 'none' ? 'brass' : null,
        haystack: (z.holds || []).map((h) => h.join(' ')).join(' '),
        open: () =>
          inspect({
            kicker: 'where things live',
            title: z.name,
            body: `
              <div class="insp-section"><p class="insp-text">${esc(z.blurb)}</p></div>
              ${
                (z.holds || []).length
                  ? `<div class="insp-section"><div class="insp-label">Holds</div><dl style="margin:0">
                     ${z.holds.map(([n, note]) => Atlas.ui.row(n, esc(note))).join('')}</dl></div>`
                  : ''
              }
              <div class="insp-section"><div class="insp-label">Source</div>${codeRef(z.code)}</div>`,
          }),
      }),
    );

    Object.keys(Atlas.roles.matrix).forEach((role) => {
      const caps = Atlas.roles.matrix[role];
      rows.push({
        category: 'role',
        name: role,
        shape: 'rank ' + Atlas.roles.rank[role],
        lives: 'organization',
        note: caps.join(', '),
        code: Atlas.roles.code,
        haystack: 'permission authorization member',
        open: () =>
          inspect({
            kicker: 'role',
            title: role,
            body: `
              <div class="insp-section">
                <p class="insp-text"><strong>Roles are authorization, not cryptography.</strong></p>
                <p class="insp-text" style="margin-top:8px">${esc(Atlas.roles.note)}</p>
              </div>
              <div class="insp-section"><div class="insp-label">Can do</div><dl style="margin:0">
                ${Atlas.roles.actions
                  .filter((a) => caps.includes(a.id))
                  .map((a) => Atlas.ui.row(a.id, esc(a.blurb)))
                  .join('')}</dl></div>
              ${
                Atlas.roles.actions.filter((a) => !caps.includes(a.id)).length
                  ? `<div class="insp-section"><div class="insp-label">Cannot do</div><dl style="margin:0">
                     ${Atlas.roles.actions
                       .filter((a) => !caps.includes(a.id))
                       .map((a) => Atlas.ui.row(a.id, esc(a.blurb)))
                       .join('')}</dl></div>`
                  : ''
              }
              <div class="insp-section"><div class="insp-label">Source</div>${codeRef(Atlas.roles.code)}</div>`,
          }),
      });
    });

    Atlas.roles.actions.forEach((a) => {
      const holders = Object.keys(Atlas.roles.matrix).filter((r) => Atlas.roles.matrix[r].includes(a.id));
      rows.push({
        category: 'capability',
        name: a.id,
        mono: true,
        shape: 'capability',
        lives: 'organization',
        note: a.blurb,
        extra: 'Held by: ' + holders.join(', '),
        code: Atlas.roles.code,
        haystack: holders.join(' '),
        open: null,
      });
    });

    Atlas.flows.forEach((f) =>
      rows.push({
        category: 'flow',
        name: f.name,
        shape: f.steps.length + ' steps',
        lives: '\u2014',
        note: f.lede,
        code: f.code,
        haystack: f.entry + ' ' + f.steps.map((st) => st.title).join(' '),
        open: () => {
          Atlas.views.flows.open(f.id);
          Atlas.app.go('flows');
        },
      }),
    );

    Atlas.membershipStates.forEach((m) =>
      rows.push({
        category: 'state',
        name: m.name,
        mono: true,
        shape: 'membership row',
        lives: 'organization',
        note: m.blurb,
        code: null,
        tone: m.canRead ? 'brass' : null,
        haystack: m.canRead ? 'can decrypt read access' : 'sees nothing no access',
        open: null,
      }),
    );

    Atlas.authStates.forEach((a) =>
      rows.push({
        category: 'state',
        name: a.id,
        mono: true,
        shape: 'client auth',
        lives: 'desktop app',
        note: a.blurb,
        code: 'desktop/src/stores/auth.ts:15',
        tone: a.id === 'unlocked' ? 'brass' : null,
        haystack: 'state machine status',
        open: null,
      }),
    );

    Atlas.lossMatrix.forEach((l) =>
      rows.push({
        category: 'loss',
        name: l.lost,
        shape: l.fatal ? 'unrecoverable' : 'recoverable',
        lives: '\u2014',
        note: l.consequence,
        extra: 'Way back: ' + l.recovery,
        code: null,
        tone: l.fatal ? 'rust' : null,
        haystack: l.recovery,
        open: null,
      }),
    );

    return rows;
  }

  let ROWS = [];

  /* ── filtering ────────────────────────────────────────────────────────── */

  function visible() {
    const q = filter.trim().toLowerCase();
    let out = ROWS.filter((r) => category === 'all' || r.category === category);
    if (q) {
      out = out.filter((r) =>
        (r.name + ' ' + r.shape + ' ' + r.lives + ' ' + r.note + ' ' + (r.extra || '') + ' ' + (r.haystack || ''))
          .toLowerCase()
          .includes(q),
      );
    }
    if (sort === 'az') {
      out = out.slice().sort((a, b) => a.name.localeCompare(b.name));
    }
    return out;
  }

  /* ── render ───────────────────────────────────────────────────────────── */

  function rowHtml(r, index) {
    return `
      <tr class="cat-row" data-idx="${index}" ${r.open ? 'tabindex="0" role="button"' : ''}
          data-clickable="${!!r.open}">
        <td>
          <span class="cat-name ${r.mono ? 'mono' : ''}">${esc(r.name)}</span>
        </td>
        <td><span class="chip ${r.tone ? 'chip-' + r.tone : ''}">${esc(r.category)}</span></td>
        <td class="cat-dim ${r.shapeMono ? 'mono' : ''}">${esc(r.shape)}</td>
        <td class="cat-dim">${esc(r.lives)}</td>
        <td class="cat-note">
          ${esc(r.note)}
          ${r.extra ? `<span class="cat-extra">${esc(r.extra)}</span>` : ''}
        </td>
        <td>${shortCode(r.code)}</td>
      </tr>`;
  }

  function paint(stage) {
    const rows = visible();

    Atlas.ui.$('#cat-facets', stage).innerHTML = [
      { id: 'all', label: 'Everything', n: ROWS.length },
      ...CATEGORIES.map((c) => ({ id: c.id, label: c.label, n: ROWS.filter((r) => r.category === c.id).length })),
    ]
      .map(
        (f) => `
      <button class="flow-tab" data-cat="${esc(f.id)}" aria-selected="${category === f.id}"
              style="padding:5px 11px;font-size:12.5px">
        ${esc(f.label)} <span style="color:var(--paper-faint);margin-left:3px">${f.n}</span>
      </button>`,
      )
      .join('');

    Atlas.ui.$('#cat-count', stage).textContent =
      rows.length === ROWS.length ? `${ROWS.length} entries` : `${rows.length} of ${ROWS.length}`;

    Atlas.ui.$('#cat-sort', stage).innerHTML = [
      ['grouped', 'Grouped'],
      ['az', 'A–Z'],
    ]
      .map(
        ([id, label]) => `
      <button class="flow-tab" data-sort="${id}" aria-selected="${sort === id}"
              style="padding:5px 11px;font-size:12.5px">${label}</button>`,
      )
      .join('');

    if (!rows.length) {
      Atlas.ui.$('#cat-body', stage).innerHTML =
        `<tr><td colspan="6" style="padding:30px;text-align:center;color:var(--paper-faint)">
           Nothing matches &ldquo;${esc(filter)}&rdquo;</td></tr>`;
      return;
    }

    let html = '';
    let lastCat = null;
    rows.forEach((r, i) => {
      if (sort === 'grouped' && category === 'all' && r.category !== lastCat) {
        const c = CATEGORIES.find((x) => x.id === r.category);
        html += `<tr class="cat-group"><td colspan="6">${esc(c ? c.label : r.category)}</td></tr>`;
        lastCat = r.category;
      }
      html += rowHtml(r, ROWS.indexOf(r));
    });
    Atlas.ui.$('#cat-body', stage).innerHTML = html;
  }

  function render(stage) {
    ROWS = buildRows();
    filter = '';
    category = 'all';
    sort = 'grouped';

    stage.innerHTML = `
      <div class="stage-head">
        <h1 class="stage-title">Catalogue</h1>
        <p class="stage-lede">
          Every key, envelope, hash, stored field, audit action and known weak point in one table.
          Type to narrow it. Click a row for the full entry.
        </p>
      </div>

      <div class="cat-controls">
        <input id="cat-filter" class="cat-input" placeholder="Filter the catalogue"
               aria-label="Filter the catalogue" autocomplete="off" spellcheck="false">
        <div id="cat-sort" style="display:flex;gap:4px"></div>
        <span id="cat-count" class="pcount"></span>
      </div>

      <div id="cat-facets" style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:16px"></div>

      <div class="cat-wrap">
        <table class="cat">
          <thead>
            <tr>
              <th style="width:16%">Name</th>
              <th style="width:82px">Kind</th>
              <th style="width:13%">Shape</th>
              <th style="width:92px">Lives in</th>
              <th>Detail</th>
              <th style="width:120px">Source</th>
            </tr>
          </thead>
          <tbody id="cat-body"></tbody>
        </table>
      </div>

      <p class="hint" style="margin-top:14px">
        Every row is derived from the same records the other sections read, so a fact has one
        place to go stale rather than two.
      </p>
    `;

    paint(stage);

    const input = Atlas.ui.$('#cat-filter', stage);
    input.addEventListener('input', () => {
      filter = input.value;
      paint(stage);
    });

    stage.addEventListener('click', onClick);
    stage.addEventListener('keydown', onKeydown);
    stage._paint = () => paint(stage);
  }

  function activate(el) {
    const row = ROWS[Number(el.dataset.idx)];
    if (row && row.open) row.open();
  }

  function onClick(ev) {
    const stage = ev.currentTarget;

    const jump = ev.target.closest('[data-risk-jump]');
    if (jump) {
      const r = Atlas.ui.riskById(jump.dataset.riskJump);
      if (r) Atlas.views.risks.inspectRisk(r);
      return;
    }

    const cat = ev.target.closest('[data-cat]');
    if (cat) {
      category = cat.dataset.cat;
      paint(stage);
      return;
    }

    const s = ev.target.closest('[data-sort]');
    if (s) {
      sort = s.dataset.sort;
      paint(stage);
      return;
    }

    const row = ev.target.closest('.cat-row');
    if (row) activate(row);
  }

  function onKeydown(ev) {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    const row = ev.target.closest('.cat-row');
    if (row) {
      ev.preventDefault();
      activate(row);
    }
  }

  function teardown(stage) {
    stage.removeEventListener('click', onClick);
    stage.removeEventListener('keydown', onKeydown);
  }

  return {
    id: 'catalogue',
    label: 'Catalogue',
    hint: 'everything',
    title: 'Catalogue',
    render,
    teardown,
  };
})();
